// Model watch — keeps Alfred's AI models working without anyone editing code.
//
// FEATURE (user request — "automatically check the health of our free API
// providers, look for new ones, and if a free provider expires, replace it
// with a different one or update it"). Runs from the scheduler
// (/api/check-reminders, at most every 6 hours) and the daily GitHub
// Actions workflow (.github/workflows/model-watch.yml → /api/model-watch),
// or on demand from Settings → AI Models → Check connections. Each run:
//   1. Reads the providers' live model lists (NVIDIA and OpenRouter are
//      public; the others are read with any business's saved key).
//   2. For every model slot, if the provider no longer offers that model —
//      or a business's test call says it's gone — picks a replacement from
//      the same provider (preferred list, then same family), checks it
//      answers (and can call tools where that matters), and records it in
//      the shared override list (_lib/modelOverrides.ts) that every AI call
//      reads.
//   3. Keeps a verified list of working NVIDIA models (used as fallbacks
//      when the chosen one is slow) and the current free OpenRouter models
//      with tool support; notes newly appeared free models.
//   4. For each business with saved keys: a tiny test call per model —
//      saved as that business's model health (owner_records kind
//      "model_health"), with an event when a key stops working, runs out of
//      credit or a model is replaced (the app turns events into
//      notifications), plus free providers it hasn't connected yet.
// What it can't do: sign up for a new provider. Those need the owner to
// create a free account and paste the key; the health record lists them
// with links.
import { SUPABASE_URL } from "./env";
import { MODELS, type ModelDef } from "./modelSlots";
import { GLOBAL_OWNER, loadModelOverrides, setModelOverridesCache, type ModelWatchDoc } from "./modelOverrides";

type Provider = ModelDef["provider"];
type PingResult = { ok: boolean; ms: number; status: number; kind: "ok" | "key" | "credit" | "limit" | "gone" | "error"; error?: string; toolCall?: boolean };
export type ModelHealthDoc = {
  checkedAt: string;
  slots: Record<string, { provider: string; model: string; ok: boolean; kind: PingResult["kind"]; ms?: number; error?: string; since: string }>;
  events: { at: string; text: string; kind: string }[];
  suggestions: { provider: string; name: string; url: string; why: string }[];
};

// Replacements, best first. Only models that exist in the provider's live
// list are used; anything new that matches a family is also considered.
const PREFERRED: Record<Provider, string[]> = {
  anthropic: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
  openai: ["gpt-4o", "gpt-4.1", "gpt-4.1-mini", "gpt-4o-mini"],
  google: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  groq: ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b", "qwen/qwen3-32b"],
  mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
  cerebras: ["gpt-oss-120b", "llama-3.3-70b", "qwen-3-32b", "llama3.1-8b"],
  nvidia: ["moonshotai/kimi-k2.6", "deepseek-ai/deepseek-v4.1-flash", "nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3.5-lightning-30b-a3b", "meta/muse-glimmer-30b", "meta/llama-3.3-70b-instruct", "qwen/qwen3-235b-a22b", "mistralai/mistral-large-2-instruct"],
  openrouter: [],
};
const FAMILY: Record<Provider, RegExp> = {
  anthropic: /^claude-(sonnet|opus)/, openai: /^gpt-4/, google: /^gemini-[\d.]+-(flash|pro)$/, groq: /(gpt-oss|llama-3\.3-70b|qwen)/,
  mistral: /^mistral-(large|medium|small)/, cerebras: /(gpt-oss|llama|qwen)/, nvidia: /(kimi|deepseek|nemotron|llama-3\.3-70b|qwen3)/, openrouter: /:free$/,
};
const FREE_PROVIDERS: { slot: string; provider: string; name: string; url: string; why: string }[] = [
  { slot: "gemini", provider: "google", name: "Google Gemini", url: "https://aistudio.google.com/apikey", why: "Free tier, reads photos/PDFs and voice notes" },
  { slot: "groq", provider: "groq", name: "Groq", url: "https://console.groq.com/keys", why: "Free tier, very fast, also does voice notes" },
  { slot: "cerebras", provider: "cerebras", name: "Cerebras", url: "https://cloud.cerebras.ai", why: "Free tier, very fast" },
  { slot: "openrouter", provider: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/keys", why: "Many free models — Alfred picks working ones automatically" },
  { slot: "nvidia_deepseek_r1", provider: "nvidia", name: "NVIDIA", url: "https://build.nvidia.com", why: "Free models (Kimi, DeepSeek, Nemotron)" },
  { slot: "mistral", provider: "mistral", name: "Mistral", url: "https://console.mistral.ai/api-keys", why: "Free experiment plan" },
];

const withTimeout = async (url: string, init: RequestInit, ms: number) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(t); }
};

export const classifyFailure = (status: number, text: string): PingResult["kind"] => {
  const s = text.toLowerCase();
  if (status === 402 || /credit|billing|insufficient|balance|exceeded your current quota|payment/.test(s)) return "credit";
  if (status === 401 || status === 403 || /invalid.{0,20}(api )?key|unauthori[sz]ed|authentication|api key not valid|permission/.test(s)) return "key";
  if (status === 404 || /model.{0,40}(not found|does not exist|not available|no longer|deprecated|decommission|retired|unknown|invalid)|not a valid model|model_not_found|no endpoints found|unsupported model/.test(s)) return "gone";
  if (status === 429 || /rate.?limit|too many requests|quota/.test(s)) return "limit";
  return "error";
};

// A tiny real request. With tools, also checks the model actually calls one.
export async function pingModel(def: ModelDef, key: string, opts: { tools?: boolean; timeoutMs?: number } = {}): Promise<PingResult> {
  const t0 = Date.now();
  const prompt = opts.tools ? "Call the ok_check tool now." : "Reply with the single word OK.";
  try {
    let res: Response;
    if (def.provider === "anthropic") {
      res = await withTimeout(def.endpoint, { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: def.modelId, max_tokens: 64, messages: [{ role: "user", content: prompt }], ...(opts.tools ? { tools: [{ name: "ok_check", description: "Health check.", input_schema: { type: "object", properties: {} } }] } : {}) }) }, opts.timeoutMs || 20000);
    } else if (def.provider === "google") {
      res = await withTimeout(`${def.endpoint}?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 64, thinkingConfig: { thinkingBudget: 0 } }, ...(opts.tools ? { tools: [{ functionDeclarations: [{ name: "ok_check", description: "Health check.", parameters: { type: "object", properties: {} } }] }] } : {}) }) }, opts.timeoutMs || 20000);
    } else {
      res = await withTimeout(def.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(def.provider === "openrouter" ? { "HTTP-Referer": "https://example.com", "X-Title": "CRM model watch" } : {}) },
        body: JSON.stringify({ model: def.modelId, max_tokens: 64, messages: [{ role: "user", content: prompt }], ...(opts.tools ? { tools: [{ type: "function", function: { name: "ok_check", description: "Health check.", parameters: { type: "object", properties: {} } } }] } : {}) }) }, opts.timeoutMs || 20000);
    }
    const text = await res.text();
    const ms = Date.now() - t0;
    if (!res.ok) return { ok: false, ms, status: res.status, kind: classifyFailure(res.status, text), error: text.slice(0, 200) };
    let toolCall = false;
    try {
      const j = JSON.parse(text);
      toolCall = !!(j?.content?.some?.((b: any) => b.type === "tool_use") || j?.choices?.[0]?.message?.tool_calls?.length || j?.candidates?.[0]?.content?.parts?.some?.((p: any) => p.functionCall));
    } catch { /* not JSON */ }
    return { ok: true, ms, status: res.status, kind: "ok", toolCall };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - t0, status: 0, kind: "error", error: e?.name === "AbortError" ? "timed out" : (e?.message || "failed") };
  }
}

// Live model lists. NVIDIA and OpenRouter are public; the rest need a key.
async function readCatalog(provider: Provider, key?: string): Promise<string[] | null> {
  const get = async (url: string, headers: Record<string, string> = {}) => {
    const r = await withTimeout(url, { headers }, 15000).catch(() => null);
    return r?.ok ? r.json().catch(() => null) : null;
  };
  try {
    if (provider === "nvidia") { const j: any = await get("https://integrate.api.nvidia.com/v1/models"); return j?.data?.map((m: any) => m.id) || null; }
    if (provider === "openrouter") {
      const j: any = await get("https://openrouter.ai/api/v1/models");
      if (!j?.data) return null;
      return j.data.filter((m: any) => (String(m.id).endsWith(":free") || (m.pricing?.prompt === "0" && m.pricing?.completion === "0")) && (m.supported_parameters || []).includes("tools"))
        .sort((a: any, b: any) => (b.context_length || 0) - (a.context_length || 0)).map((m: any) => m.id);
    }
    if (!key) return null;
    if (provider === "anthropic") { const j: any = await get("https://api.anthropic.com/v1/models?limit=100", { "x-api-key": key, "anthropic-version": "2023-06-01" }); return j?.data?.map((m: any) => m.id) || null; }
    if (provider === "google") { const j: any = await get(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`); return j?.models?.filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m: any) => String(m.name).replace(/^models\//, "")) || null; }
    const base: Record<string, string> = { openai: "https://api.openai.com/v1/models", groq: "https://api.groq.com/openai/v1/models", mistral: "https://api.mistral.ai/v1/models", cerebras: "https://api.cerebras.ai/v1/models" };
    if (base[provider]) { const j: any = await get(base[provider], { Authorization: `Bearer ${key}` }); return j?.data?.map((m: any) => m.id) || null; }
  } catch { /* fall through */ }
  return null;
}

const versionScore = (id: string): number => {
  const nums: string[] = id.match(/\d+(\.\d+)?/g) || [];
  return nums.reduce((s: number, n: string, i: number) => s + Number(n) / Math.pow(100, i), 0);
};

export function replacementCandidates(provider: Provider, current: string, catalog: string[]): string[] {
  const have = new Set(catalog);
  const preferred = PREFERRED[provider].filter(m => have.has(m) && m !== current);
  const family = catalog.filter(m => FAMILY[provider].test(m) && m !== current && !preferred.includes(m) && !/(embed|vision-only|tts|whisper|guard|audio|image|realtime|search|preview-\d{2}-\d{2})/i.test(m))
    .sort((a, b) => versionScore(b) - versionScore(a));
  if (provider === "openrouter") return catalog.filter(m => m !== current);
  // Same tier first (a retired "flash" is replaced by the newest flash, not a pro).
  const tier = (current.match(/(flash|pro|sonnet|opus|haiku|large|medium|small|mini|lightning|super|flash-lite)/) || [])[0];
  const all = [...preferred, ...family];
  if (!tier) return all;
  const sameTier = [...family, ...preferred].filter(m => m.includes(tier)).sort((a, b) => versionScore(b) - versionScore(a));
  return Array.from(new Set([...sameTier, ...all]));
}

const sb = (serviceKey: string) => {
  const h = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  return {
    get: async (path: string) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: h }).catch(() => null); const j = r ? await r.json().catch(() => []) : []; return Array.isArray(j) ? j : []; },
    put: async (ownerId: string, kind: string, id: string, data: any) => {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/owner_records?on_conflict=owner_id,kind,id`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ owner_id: ownerId, kind, id, data, deleted_at: null }]) }).catch(() => null);
      return !!r?.ok;
    },
  };
};

export async function runModelWatch(env: Record<string, string>, opts: { force?: boolean; onlyOwner?: string; minHoursBetween?: number } = {}): Promise<{ skipped?: boolean; checkedAt?: string; replaced: string[]; owners: number; error?: string }> {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return { replaced: [], owners: 0, error: "SUPABASE_SERVICE_ROLE_KEY isn't set" };
  const db = sb(serviceKey);
  const doc: ModelWatchDoc = JSON.parse(JSON.stringify(await loadModelOverrides(serviceKey, true)));
  const hours = opts.minHoursBetween ?? 6;
  if (!opts.force && !opts.onlyOwner && doc.checkedAt && Date.now() - Date.parse(doc.checkedAt) < hours * 3600000) return { skipped: true, checkedAt: doc.checkedAt, replaced: [], owners: 0 };
  const now = new Date().toISOString();
  doc.overrides = doc.overrides || {}; doc.events = doc.events || []; doc.seen = doc.seen || {}; doc.newFree = doc.newFree || [];
  const replaced: string[] = [];

  // Businesses with saved keys (all, or the one asking).
  const ownerRows = await db.get(`owner_secrets?select=owner_id,model_keys${opts.onlyOwner ? `&owner_id=eq.${encodeURIComponent(opts.onlyOwner)}` : ""}&limit=500`);
  const owners = ownerRows.filter((r: any) => r.model_keys && typeof r.model_keys === "object" && Object.values(r.model_keys).some(Boolean));
  const keyFor = (slot: string) => { for (const o of owners) { const k = o.model_keys?.[slot]; if (typeof k === "string" && k.trim()) return k.trim(); } return ""; };
  const anyKeyForProvider = (p: Provider) => { for (const [slot, def] of Object.entries(MODELS)) if (def.provider === p) { const k = keyFor(slot); if (k) return { slot, key: k }; } return null; };

  const catalogs: Partial<Record<Provider, string[]>> = {};
  const providers = Array.from(new Set(Object.values(MODELS).map(d => d.provider)));
  await Promise.all(providers.map(async p => { const c = await readCatalog(p, anyKeyForProvider(p)?.key); if (c?.length) catalogs[p] = c; }));

  const current = (slot: string) => doc.overrides![slot]?.model || MODELS[slot].modelId;
  const replace = async (slot: string, reason: string, key?: string) => {
    const def = MODELS[slot];
    const catalog = catalogs[def.provider];
    if (!catalog) return false;
    const was = current(slot);
    const needTools = def.provider === "nvidia" || def.provider === "openrouter";
    for (const cand of replacementCandidates(def.provider, was, catalog).slice(0, 6)) {
      const candDef: ModelDef = { ...def, modelId: cand, endpoint: def.provider === "google" ? def.endpoint.replace(/models\/[^:/]+:/, `models/${cand}:`) : def.endpoint };
      if (key) {
        const p = await pingModel(candDef, key, { tools: needTools });
        if (!p.ok || (needTools && !p.toolCall)) continue;
      }
      doc.overrides![slot] = { model: cand, was, reason, at: now };
      const text = `${slot}: switched from ${was} to ${cand} (${reason})`;
      doc.events!.unshift({ at: now, text });
      replaced.push(text);
      return true;
    }
    return false;
  };

  // 1. Models a provider no longer lists.
  for (const [slot, def] of Object.entries(MODELS)) {
    const catalog = catalogs[def.provider];
    if (!catalog || def.provider === "openrouter") continue; // OpenRouter picks live free models per request
    if (!catalog.includes(current(slot))) await replace(slot, "the provider no longer offers it", keyFor(slot) || undefined);
  }
  // An override whose original model is back and listed again is kept — it was verified working.

  // 2. Verified NVIDIA fallbacks; current free OpenRouter models; new free models.
  const nvKey = anyKeyForProvider("nvidia");
  if (nvKey && catalogs.nvidia) {
    const working: string[] = [];
    for (const cand of replacementCandidates("nvidia", "", catalogs.nvidia).slice(0, 6)) {
      const p = await pingModel({ ...MODELS[nvKey.slot], modelId: cand }, nvKey.key, { tools: true, timeoutMs: 25000 });
      if (p.ok && p.toolCall) working.push(cand);
      if (working.length >= 4) break;
    }
    if (working.length) doc.nvidiaWorking = working;
  }
  if (catalogs.openrouter) doc.openrouterFree = catalogs.openrouter.slice(0, 15);
  for (const p of ["openrouter", "nvidia"] as Provider[]) {
    const list = p === "openrouter" ? (catalogs.openrouter || []) : (catalogs.nvidia || []).filter(m => FAMILY.nvidia.test(m));
    if (!list.length) continue;
    const seen = new Set(doc.seen![p] || []);
    if (seen.size) for (const m of list) if (!seen.has(m)) doc.newFree!.unshift({ provider: p, model: m, firstSeen: now });
    doc.seen![p] = list;
  }
  doc.newFree = doc.newFree!.slice(0, 20);

  // 3. Each business's keys.
  for (const o of owners.slice(0, 200)) {
    const ownerId = String(o.owner_id);
    const prev: ModelHealthDoc | undefined = (await db.get(`owner_records?owner_id=eq.${encodeURIComponent(ownerId)}&kind=eq.model_health&id=eq.status&select=data&limit=1`))[0]?.data;
    const health: ModelHealthDoc = { checkedAt: now, slots: {}, events: (prev?.events || []).slice(0, 30), suggestions: [] };
    await Promise.all(Object.entries(MODELS).map(async ([slot, base]) => {
      const key = String(o.model_keys?.[slot] || "").trim();
      if (!key) return;
      let def: ModelDef = { ...base, modelId: current(slot), endpoint: base.provider === "google" ? base.endpoint.replace(/models\/[^:/]+:/, `models/${current(slot)}:`) : base.endpoint };
      let p = await pingModel(def, key);
      if (!p.ok && p.kind === "gone" && await replace(slot, "it stopped working (model gone)", key)) {
        def = { ...def, modelId: current(slot), endpoint: base.provider === "google" ? base.endpoint.replace(/models\/[^:/]+:/, `models/${current(slot)}:`) : base.endpoint };
        p = await pingModel(def, key);
      }
      const was = prev?.slots?.[slot];
      health.slots[slot] = { provider: base.provider, model: def.modelId, ok: p.ok, kind: p.kind, ms: p.ms, error: p.ok ? undefined : p.error, since: was && was.kind === p.kind ? was.since : now };
      // Tell the owner once when something starts failing in a way they must fix.
      if ((p.kind === "key" || p.kind === "credit") && was?.kind !== p.kind) {
        health.events.unshift({ at: now, kind: p.kind, text: p.kind === "key" ? `Your ${slot} AI key stopped working — paste a fresh one in Settings → AI Models.` : `Your ${slot} AI account is out of credit — top it up, or Alfred will keep using your other AI providers.` });
      }
      if (p.ok && was && !was.ok && (was.kind === "key" || was.kind === "credit")) health.events.unshift({ at: now, kind: "ok", text: `Your ${slot} AI key is working again.` });
    }));
    for (const r of replaced) if (!health.events.some(e => e.text === r)) health.events.unshift({ at: now, kind: "replaced", text: "Alfred switched a model automatically — " + r });
    health.events = health.events.slice(0, 30);
    health.suggestions = FREE_PROVIDERS.filter(f => !Object.entries(MODELS).some(([slot, d]) => d.provider === f.provider && String(o.model_keys?.[slot] || "").trim()))
      .map(({ provider, name, url, why }) => ({ provider, name, url, why }));
    await db.put(ownerId, "model_health", "status", health);
  }

  doc.checkedAt = now;
  doc.events = doc.events!.slice(0, 50);
  await db.put(GLOBAL_OWNER, "model_watch", "overrides", doc);
  setModelOverridesCache(doc);
  return { checkedAt: now, replaced, owners: owners.length };
}
