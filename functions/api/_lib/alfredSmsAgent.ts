// alfredSmsAgent.ts — real (not mock) tool-calling agent that runs Alfred
// entirely server-side, invoked by twilio-sms-webhook.ts when the owner
// texts their own CRM Twilio number from their personal phone
// (settings.myPhone, gated by settings.alfredSmsEnabled). This lets the
// owner say things like "reschedule Tuesday's job with Mike to Thursday and
// text him" or "who's on job 2 right now" directly over SMS, with Alfred
// actually reading/writing the CRM (via the service-role key, same
// credentials the rest of this webhook already uses) and replying by text.
//
// This is a deliberately SMALLER tool set than the in-app Alfred
// (AlfredPage.tsx, ~25 tools) — only the handful of actions an owner is
// realistically going to want to trigger from a text message while away
// from the CRM. Everything it does is a REAL Supabase write via the service
// role — no staged/fake actions.
//
// MODEL CHOICE — this used to hard-code Anthropic Claude only, with a
// comment claiming it was "the one provider with no browser-CORS caveat."
// That reasoning never applied here: this file runs server-side in a
// Cloudflare Pages Function, not a browser, so CORS was never a constraint
// for ANY provider — the in-app Alfred (AlfredPage.tsx) only avoids some
// providers because IT runs in the browser. This file follows the exact
// same model-selection convention as the in-app Alfred instead: whichever
// provider is first in the owner's settings.modelPriority (falling back to
// settings.activeModel, then any model with a key at all) that has a key
// saved in settings.modelKeys, with automatic failover to the next
// configured provider on error — so an owner using Gemini, Kimi (NVIDIA),
// or any other supported provider for in-app Alfred gets the exact same
// provider over text, no separate Anthropic key required.
//
// Underscore-prefixed folder (_lib) — per Cloudflare Pages Functions
// convention this is NOT routable, purely a shared module for the actual
// route files (twilio-sms-webhook.ts) to import from.

import { prepareImportFromFile, runTextImport } from "./textImport";
import { syncEmployeeJobToCalendar } from "./employeeCalendarSync";
import { stripMarkdownForSms } from "./textFormat";
import { SUPABASE_URL } from "./env";
import { recGet, recList, recPut, OWNER_RECORDS_MISSING } from "./ownerRecords";
import { runBulkSendBatch } from "./bulkTextSend";
import { searchCustomers as auditSearch, findDuplicateCustomers, customersMissingInfo, filterCustomers } from "../../../src/lib/customerAudit";


// Mirrors the provider/endpoint/modelId table in src/lib/api.ts's MODELS —
// duplicated here (not imported) because functions/ is a separate Cloudflare
// Pages Functions build with no access to src/. Keep in sync if a model is
// added/renamed there.
const SMS_MODELS: Record<string, { provider: string; modelId: string; endpoint: string; name: string; maxTokens: number; supportsTools: boolean }> = {
  claude: { provider: "anthropic", modelId: "claude-sonnet-5-5", endpoint: "https://api.anthropic.com/v1/messages", name: "Claude", maxTokens: 4096, supportsTools: true },
  openai: { provider: "openai", modelId: "gpt-4o", endpoint: "https://api.openai.com/v1/chat/completions", name: "GPT-4o", maxTokens: 4096, supportsTools: true },
  gemini: { provider: "google", modelId: "gemini-2.5-flash", endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", name: "Gemini", maxTokens: 4096, supportsTools: true },
  groq: { provider: "openai-compat", modelId: "openai/gpt-oss-120b", endpoint: "https://api.groq.com/openai/v1/chat/completions", name: "Groq", maxTokens: 4096, supportsTools: true },
  mistral: { provider: "openai-compat", modelId: "mistral-large-latest", endpoint: "https://api.mistral.ai/v1/chat/completions", name: "Mistral", maxTokens: 4096, supportsTools: true },
  // BUG FIX — kept in sync with src/lib/api.ts's MODELS: the old Kimi K2.6
  // and Nemotron 70B slugs are dead on NVIDIA's catalog (confirmed live —
  // "Function ... not found for account"), same ids the in-app chat had.
  nvidia_kimi: { provider: "openai-compat", modelId: "deepseek-ai/deepseek-v4.1-flash", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", name: "DeepSeek V4.1 Flash", maxTokens: 4096, supportsTools: true },
  nvidia_nemotron: { provider: "openai-compat", modelId: "nvidia/nemotron-3.5-lightning-30b-a3b", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", name: "Nemotron 3.5 Lightning", maxTokens: 4096, supportsTools: true },
  nvidia_deepseek_r1: { provider: "openai-compat", modelId: "moonshotai/kimi-k2.6", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", name: "Kimi K2.6", maxTokens: 4096, supportsTools: true },
  nvidia_qwen: { provider: "openai-compat", modelId: "nvidia/nemotron-3-super-120b-a12b", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", name: "Nemotron 3 Super 120B", maxTokens: 4096, supportsTools: true },
  nvidia_muse: { provider: "openai-compat", modelId: "meta/muse-glimmer-30b", endpoint: "https://integrate.api.nvidia.com/v1/chat/completions", name: "Muse Glimmer 30B", maxTokens: 4096, supportsTools: true },
  // OpenRouter's free router (picks a free model that's up) and Cerebras's free tier.
  openrouter: { provider: "openai-compat", modelId: "openrouter/free", endpoint: "https://openrouter.ai/api/v1/chat/completions", name: "OpenRouter", maxTokens: 4096, supportsTools: true },
  cerebras: { provider: "openai-compat", modelId: "gpt-oss-120b", endpoint: "https://api.cerebras.ai/v1/chat/completions", name: "Cerebras", maxTokens: 4096, supportsTools: true },
};
const DEFAULT_MODEL_PRIORITY = ["claude", "openai", "gemini", "groq", "mistral"];

// FEATURE — mirrors src/lib/utils.ts's `personalities` array (in-app
// Alfred's Drill Sergeant/Butler/Quiet Pro/Savage Mode picker, Settings →
// Alfred). Duplicated here rather than imported — functions/ is a separate
// Cloudflare Pages Functions build with no access to src/ (same reasoning
// as SMS_MODELS above). Keep the wording in sync if a personality is
// added/edited there. Text-Alfred previously always used one generic,
// neutral voice regardless of what the owner picked in-app — the
// personality setting never reached this file at all.
const PERSONALITY_PROMPTS: Record<string, string> = {
  drillsergeant: "Personality: DRILL SERGEANT. Be aggressive and motivating — every response is a pep talk crossed with an order. Use military terminology (mission, sitrep, deploy, roger that, no excuses). Use ALL CAPS for emphasis on key words/commands. Keep it SHORT and punchy. End replies with 'Alfred out.' when it fits naturally.",
  butler: "Personality: a formal, composed British butler. Always address the owner as 'sir'. Be courteous, polished, and refined — use British expressions (e.g. 'right away, sir', 'quite so', 'splendid', 'shall I'). Never use slang or casual American phrasing. Keep it concise and unfailingly professional.",
  quietpro: "Personality: silent professional. Terse and data-driven — lead with numbers and facts. Skip pleasantries ON BUSINESS ANSWERS ONLY: no greeting/sign-off padding around a stats lookup or task result, no filler. This governs TONE, not topic — if the owner is just chatting or asks something off-work, still answer it, just keep it short and plain rather than warm.",
  savage: "Personality: Savage Mode — roast comedian crossed with a sharp business coach. Sarcastic, witty, brutally honest — roast slipping numbers or procrastination, don't hold back the jokes. Underneath it, stay genuinely helpful. Never actually cruel, just savage.",
};

// ─── Unified per-provider model caller (server-side — no CORS constraint) ──
// Returns { text, toolUses, stopReason, raw } — `raw` is pushed straight
// back as the next "assistant" turn's content on a tool-use round, same
// pattern src/lib/api.ts's callModel uses for the in-app Alfred.
const callSmsModel = async (
  modelKey: string,
  apiKey: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: any }>,
  tools: any[],
): Promise<{ text: string; toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>; stopReason: string; raw: unknown }> => {
  const def = SMS_MODELS[modelKey];
  if (!def) throw new Error(`Unknown model "${modelKey}"`);

  if (def.provider === "anthropic") {
    const body = { model: def.modelId, max_tokens: def.maxTokens, system: systemPrompt, messages, tools };
    const res = await fetch(def.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${def.name} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = await res.json() as { content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>; stop_reason?: string };
    const text = data.content?.find(b => b.type === "text")?.text ?? "";
    const toolUses = (data.content ?? []).filter(b => b.type === "tool_use").map(b => ({ id: b.id!, name: b.name!, input: b.input ?? {} }));
    return { text, toolUses, stopReason: data.stop_reason ?? "end_turn", raw: data.content };
  }

  if (def.provider === "google") {
    const contents = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => {
        if (typeof m.content === "string") return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
        if (Array.isArray(m.content) && m.content[0]?.type === "tool_result") {
          const parts = (m.content as Array<{ tool_use_id: string; content: string }>).map(tr => ({
            functionResponse: { name: tr.tool_use_id, response: (() => { try { return JSON.parse(tr.content); } catch { return { result: tr.content }; } })() },
          }));
          return { role: "user", parts };
        }
        if (Array.isArray(m.content)) return { role: "model", parts: m.content };
        return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] };
      });
    const geminiTools = tools?.length ? [{ functionDeclarations: tools.map((t: any) => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] : undefined;
    const res = await fetch(`${def.endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(geminiTools ? { tools: geminiTools } : {}),
        generationConfig: { maxOutputTokens: def.maxTokens, thinkingConfig: { thinkingBudget: 0 } },
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${def.name} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = await res.json() as { candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> }; finishReason?: string }> };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter(p => typeof p.text === "string" && p.text).map(p => p.text as string).join("");
    const toolUses = parts.filter(p => p.functionCall).map(p => {
      const fc = p.functionCall as { name: string; args?: Record<string, unknown> };
      return { id: fc.name, name: fc.name, input: fc.args ?? {} };
    });
    const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
    return { text, toolUses, stopReason, raw: parts.length ? parts : [{ text }] };
  }

  // openai-compat: OpenAI, Groq, Mistral, NVIDIA NIM — all mirror OpenAI's
  // chat completions API verbatim.
  const openAiMessages: Array<Record<string, unknown>> = [{ role: "system", content: systemPrompt }];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    if (typeof m.content === "string") {
      openAiMessages.push({ role: m.role, content: m.content });
    } else if (Array.isArray(m.content) && m.content[0]?.type === "tool_result") {
      for (const tr of m.content as Array<{ tool_use_id: string; content: string }>) {
        openAiMessages.push({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content });
      }
    } else if (m.role === "assistant" && m.content && typeof m.content === "object" && !Array.isArray(m.content)) {
      openAiMessages.push(m.content as Record<string, unknown>);
    } else if (Array.isArray(m.content)) {
      const text = (m.content as Array<{ type: string; text?: string }>).filter(b => b.type === "text").map(b => b.text ?? "").join("");
      openAiMessages.push({ role: m.role, content: text });
    }
  }
  const openAiTools = tools?.length ? tools.map((t: any) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })) : undefined;
  const res = await fetch(def.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: def.modelId, max_tokens: def.maxTokens, messages: openAiMessages, ...(openAiTools ? { tools: openAiTools } : {}) }),
  });
  if (!res.ok) throw new Error(`${def.name} HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; function?: { name: string; arguments?: string } }> } }> };
  const choice = data.choices?.[0]?.message;
  const text = choice?.content ?? "";
  const toolUses = (choice?.tool_calls ?? []).map(tc => ({ id: tc.id, name: tc.function?.name ?? "", input: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })() }));
  const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
  return { text, toolUses, stopReason, raw: choice ?? { role: "assistant", content: text } };
};

// Same US-country-code normalization fix as twilio-sms-webhook.ts — an
// E.164 number ("+15555550100") and a plain 10-digit one ("555 555 0100")
// must compare equal, or thread-matching here silently creates duplicate
// inbox threads for what's really the same contact.
const normalizePhoneDigits = (p: string) => {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};
const today = () => new Date().toISOString().slice(0, 10);

type Ctx = {
  authHeaders: Record<string, string>;
  ownerId: string | null;
  companyName: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  origin: string;
  // Whichever authorized number is actually texting Alfred right now — used
  // by the text_me tool as "send it back to whoever's asking," so it works
  // correctly whether the owner is texting from myPhone or one of
  // alfredExtraPhones, without needing a separate "which is the real owner
  // number" lookup.
  fromPhone?: string;
  // Owner's Google OAuth tokens (from app_settings, same fields the in-app
  // Gmail send already reads) — lets create_calendar_event act on the
  // owner's REAL Google Calendar from a text, not just the CRM's own job
  // records.
  googleProviderToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiresAt?: number;
  // Owner's own email — where send_me_files (via:"email") delivers to.
  myEmail?: string;
  // Owner-controlled Alfred capability gates (Settings → Alfred →
  // Capabilities) — same map/enforcement as the in-app chat.
  alfredCapabilities?: Record<string, boolean>;
  // Owner-set vacation/out-of-office mode (Alfred's set_vacation_mode tool,
  // in-app or via text) — read here so text-Alfred can see it proactively in
  // its system prompt without a tool round-trip, same as alfredCapabilities.
  vacationMode?: { active: boolean; startDate?: string; endDate?: string; autonomyLevel?: string; checkInFrequency?: string; notes?: string };
  // FEATURE — general (non-vacation) autonomy default, set at signup —
  // see App.tsx's company-setup wizard and AlfredPage.tsx's matching
  // system-prompt clause.
  alfredAutonomyLevel?: string;
  // Same Testing Mode gate lib/messaging.ts's twilioSend already enforces
  // client-side (settings.testModeEnabled) — this file sends via raw fetch
  // (it runs server-side, not through that wrapper), so bulk sends need
  // their own check or Testing Mode would do nothing to protect real
  // customers from a live blast triggered by text while the owner is
  // mid-test.
  testModeEnabled?: boolean;
  // Every phone number allowed to text Alfred as the owner (myPhone PLUS
  // alfredExtraPhones) — used only to consolidate the owner's Inbox thread:
  // without this, texting Alfred from a second registered phone created a
  // totally separate thread also named "Alfred", which read as duplicate/
  // missing conversations even though nothing was actually lost.
  ownerAuthorizedPhones?: string[];
  // Which of the in-app Alfred's personalities (Settings → Alfred) the
  // owner picked — see PERSONALITY_PROMPTS below.
  alfredPersonality?: string;
  // Set by runAlfredSmsAgent itself right before the tool loop starts — lets
  // switch_ai_model check which providers actually have a key configured
  // without threading a new param through executeTool's signature.
  modelKeys?: Record<string, string>;
  // Cloudflare env, threaded through so tools that need service-role access
  // to OTHER records (e.g. an employee's own Google token — see
  // syncEmployeeJobToCalendar) can get it without a second HTTP round-trip.
  env: Record<string, string>;
  // FEATURE — get_weather tool. Same OpenWeatherMap key/location the in-app
  // weather widget uses (settings.owmKey/weatherLocation); companyAddress is
  // the fallback when the owner never filled in the dedicated location field.
  owmKey?: string;
  weatherLocation?: string;
  companyAddress?: string;
  // When this owner message started being handled — send_bulk_text refuses
  // a draft created after this (the owner hasn't seen that list yet).
  turnStartedAt?: number;
  // One-off texts sent this turn; past a few, Alfred has to use the
  // draft-and-approve bulk flow instead.
  directSendsThisTurn?: number;
  // The owner's phone, for reply-watch digests (reply watches only).
  ownerPhone?: string;
};

// ─── Supabase helpers (service-role REST, same pattern as the webhook) ────

// FIX — a read scoped with `&owner_id=eq.X` 400s outright on any table that
// doesn't have that column yet (migration 0033 not applied — verified live
// on this deployment: app_settings.owner_id is already populated, but
// customers/jobs/employees/inbox_threads have no such column yet), and
// PostgREST's error body isn't an array, so it used to just silently
// resolve to "no rows" — every lookup in this agent (find the customer,
// find the job) would quietly fail as "not found" instead of erroring.
// Detect that specific failure and retry once without the owner_id clause.
// BUG FIX — "enhance Alfred's tool reliability." A thrown fetch (dropped
// connection, DNS hiccup — routine on mobile data, and this function
// backs nearly every tool Alfred has) used to propagate straight up
// uncaught, so one transient network blip failed the whole tool call
// immediately with a generic error and no retry — worse odds than a
// human just trying again. One retry after a short backoff before giving
// up for real.
const sbGet = async (ctx: Ctx, path: string): Promise<any[]> => {
  const attempt = async (): Promise<any[]> => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: ctx.authHeaders });
    const data = await res.json().catch(() => []);
    if (Array.isArray(data)) return data;
    if (!res.ok && path.includes("owner_id=eq.")) {
      const strippedPath = path.replace(/&owner_id=eq\.[^&]+/, "");
      const retryRes = await fetch(`${SUPABASE_URL}/rest/v1/${strippedPath}`, { headers: ctx.authHeaders });
      const retryData = await retryRes.json().catch(() => []);
      return Array.isArray(retryData) ? retryData : [];
    }
    return [];
  };
  try {
    return await attempt();
  } catch (e: any) {
    console.warn("[AlfredSms] sbGet threw, retrying once:", e?.message, path);
    await new Promise(r => setTimeout(r, 400));
    try { return await attempt(); } catch (e2: any) { console.warn("[AlfredSms] sbGet retry also failed:", e2?.message, path); return []; }
  }
};

// docs/ARCHITECTURE.md "safe column retry" pattern — a write scoped by owner_id can
// fail outright if migration 0033 hasn't been applied yet (no such column),
// which would reject the ENTIRE insert/update, not just drop the filter.
// Try WITH owner_id first (the correct, tenant-scoped shape once the
// migration is live); on any non-2xx, retry once without it so this agent
// still works on a pre-migration single-tenant deployment.
// Deposit fields for an estimate row from depositPercent / depositAmount.
// Same shape the CRM's estimate builder saves (depositType "percent" | "amount").
const smsDepositFields = (input: any, total: number, allowRemove = false): { depositRequired: number; depositType: string; depositMandatory: boolean } | { error: string } => {
  const pct = Number(input.depositPercent) || 0, amt = Number(input.depositAmount) || 0;
  if (pct && amt) return { error: "Use depositPercent OR depositAmount, not both." };
  if (pct < 0 || pct > 100) return { error: "depositPercent must be between 0 and 100." };
  if (amt < 0 || (total > 0 && amt > total)) return { error: "depositAmount can't be more than the total." };
  if (!pct && !amt && !allowRemove) return { depositRequired: 0, depositType: "amount", depositMandatory: false };
  // The owner has to decide whether the customer may also pay in full —
  // don't guess. The model relays this question and calls again.
  if ((pct || amt) && typeof input.depositMandatory !== "boolean") {
    return { error: "NEEDS_CLARIFICATION — nothing was created yet. Ask the owner: \"Should they only be able to pay the deposit now, or choose between paying the deposit now or paying in full?\" Then call again with depositMandatory true (deposit only) or false (their choice)." };
  }
  return pct ? { depositRequired: pct, depositType: "percent", depositMandatory: !!input.depositMandatory }
             : { depositRequired: amt, depositType: "amount", depositMandatory: amt > 0 && !!input.depositMandatory };
};
const depositDollars = (d: { depositRequired: number; depositType: string }, total: number) =>
  d.depositType === "percent" ? Math.round(total * d.depositRequired) / 100 : Number(d.depositRequired) || 0;

const sbWrite = async (ctx: Ctx, path: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<{ ok: boolean; data: any; error?: string }> => {
  const withOwner = ctx.ownerId ? { ...body, owner_id: ctx.ownerId } : body;
  const attempt = async (payload: Record<string, unknown>) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(method === "POST" ? [payload] : payload),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
    return { ok: res.ok, data, error: res.ok ? undefined : (data?.message || text || `HTTP ${res.status}`) };
  };
  let result = await attempt(withOwner);
  if (!result.ok && ctx.ownerId) {
    console.warn("[AlfredSms] write with owner_id failed, retrying without it:", result.error);
    result = await attempt(body);
  }
  return result;
};

const ownerScope = (ctx: Ctx) => (ctx.ownerId ? `&owner_id=eq.${encodeURIComponent(ctx.ownerId)}` : "");

// Every row, past Supabase's 1,000-row page cap (a business with 1,500
// customers used to look like it had 1,000 — or 500 — to Alfred).
const sbGetAll = async (ctx: Ctx, path: string, max = 20000): Promise<any[]> => {
  const out: any[] = [];
  for (let offset = 0; offset < max; offset += 1000) {
    const page = await sbGet(ctx, `${path}&limit=1000&offset=${offset}&order=id.asc`);
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
};

// One plain question to whichever AI model the owner has set up (same
// priority/failover as the main agent), answered as JSON. Used for small
// reading jobs — e.g. "did this customer's reply answer the question?".
export const askModelJson = async (modelKeys: Record<string, string>, modelPriority: string[] | undefined, system: string, userText: string): Promise<any | null> => {
  const priority = modelPriority && modelPriority.length ? modelPriority : DEFAULT_MODEL_PRIORITY;
  const chain = [...priority, ...Object.keys(SMS_MODELS).filter(m => !priority.includes(m))].filter(m => SMS_MODELS[m] && modelKeys?.[m]);
  for (const m of chain) {
    try {
      const r = await Promise.race([
        callSmsModel(m, modelKeys[m], system, [{ role: "user", content: userText }], []),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timed out")), 20000)),
      ]);
      const match = String(r.text || "").match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch (e: any) { console.warn("[AlfredSms] askModelJson", m, "failed:", e?.message); }
  }
  return null;
};

// One tiny request to one model — for the Alfred health check.
export const pingSmsModel = async (modelKey: string, apiKey: string): Promise<{ ok: boolean; ms: number; name: string; error?: string }> => {
  const def = SMS_MODELS[modelKey];
  const t0 = Date.now();
  if (!def) return { ok: false, ms: 0, name: modelKey, error: "unknown model" };
  try {
    await Promise.race([
      callSmsModel(modelKey, apiKey, "Reply with the single word OK.", [{ role: "user", content: "ping" }], []),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("no answer in 20s")), 20000)),
    ]);
    return { ok: true, ms: Date.now() - t0, name: def.name };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - t0, name: def.name, error: String(e?.message || e).slice(0, 160) };
  }
};
export const SMS_MODEL_NAMES: Record<string, string> = Object.fromEntries(Object.entries(SMS_MODELS).map(([k, v]) => [k, v.name]));

// sendSms for other server modules (reply watches) — same opt-out check and
// Inbox logging as every Alfred send.
export const sendCustomerSmsAsAlfred = (ctx: any, to: string, body: string, contact?: { name?: string; customerId?: string }, isOwnerReply = false) =>
  sendSms(ctx as Ctx, to, body, isOwnerReply, contact);

// Reads a receipt / bill / statement / revenue report / tax form (photo,
// screenshot or PDF) with a vision-capable model the owner has a key for.
const FIN_DOC_PROMPT = `You read a small business's financial document (receipt, bill, invoice they paid, bank or card statement, revenue/sales report, or tax form). Reply with ONLY JSON, no prose:
{"documentType": "receipt"|"bill"|"bank_statement"|"card_statement"|"revenue_report"|"tax_document"|"other",
 "vendor": string, "date": "YYYY-MM-DD" or "",
 "items": [{"kind": "expense"|"income", "date": "YYYY-MM-DD" or "", "description": string, "amount": number, "category": one of "Fuel","Chemicals","Equipment","Insurance","Marketing","Truck Payment","Maintenance","Subcontractors","Office","Other" for expenses or "revenue" for income, "vendor": string}],
 "taxNotes": string (key figures from a tax document — form, year, totals, amounts owed/refunded — else ""),
 "summary": string (one short line)}
A single receipt is ONE expense item for its total (not each product line). A statement is one item per transaction. Money coming in (deposits, sales, payouts) is income. Never invent numbers you can't read.`;
const readFinancialDocument = async (ctx: Ctx, url: string, type: string, hint: string): Promise<any> => {
  if (!/^https:\/\//.test(url)) return { error: "fileUrl must be the https url from the attached-file line." };
  const fileRes = await fetch(url).catch(() => null);
  if (!fileRes?.ok) return { error: "Couldn't download that file." };
  const buf = new Uint8Array(await fileRes.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) return { error: "That file is over 15 MB — send a smaller photo or a few pages at a time." };
  const mime = (type || fileRes.headers.get("content-type") || "").split(";")[0] || (url.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const b64 = btoa(bin);
  const isPdf = mime === "application/pdf";
  const keys = ctx.modelKeys || {};
  const ask = `${FIN_DOC_PROMPT}${hint ? `\nThe owner said: "${hint}"` : ""}`;
  const parse = (t: string) => { const m = String(t || "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; };
  const tries: Array<() => Promise<any>> = [];
  if (keys.claude) tries.push(async () => {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": keys.claude, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 4096, messages: [{ role: "user", content: [isPdf ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } } : { type: "image", source: { type: "base64", media_type: mime, data: b64 } }, { type: "text", text: ask }] }] }) });
    if (!r.ok) throw new Error("Claude " + r.status);
    const d: any = await r.json(); return parse(d.content?.find((b: any) => b.type === "text")?.text);
  });
  if (keys.gemini) tries.push(async () => {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(keys.gemini)}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: ask }] }], generationConfig: { maxOutputTokens: 4096 } }) });
    if (!r.ok) throw new Error("Gemini " + r.status);
    const d: any = await r.json(); return parse(d.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join(""));
  });
  if (keys.openai && !isPdf) tries.push(async () => {
    const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.openai}` },
      body: JSON.stringify({ model: "gpt-4o", max_tokens: 4096, messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:${mime};base64,${b64}` } }, { type: "text", text: ask }] }] }) });
    if (!r.ok) throw new Error("OpenAI " + r.status);
    const d: any = await r.json(); return parse(d.choices?.[0]?.message?.content);
  });
  if (!tries.length) return { error: `Reading ${isPdf ? "PDFs" : "photos"} needs a Claude${isPdf ? "" : ", GPT-4o"} or Gemini key in Settings → AI Models.` };
  for (const t of tries) {
    try { const out = await t(); if (out) return out; } catch (e: any) { console.warn("[AlfredSms] financial document read failed:", e?.message); }
  }
  return { error: "Couldn't read that document — try a clearer photo, or send the numbers as text." };
};

// ─── Tool implementations ──────────────────────────────────────────────────

// BUG FIX — only looked at the first 500 customers, so with a bigger list
// most names "weren't found." Ask the server for name matches first; fall
// back to reading everyone.
const findCustomerByName = async (ctx: Ctx, name: string) => {
  const sel = `select=id,firstName,lastName,phone,email,documents,stripeCustomerId,savedPaymentMethodLabel${ownerScope(ctx)}`;
  const q = String(name || "").toLowerCase().trim();
  if (!q) return undefined;
  const parts = q.split(/\s+/).map(w => w.replace(/[^a-z0-9'-]/gi, "")).filter(Boolean);
  let rows: any[] = [];
  if (parts.length) {
    const first = encodeURIComponent(`*${parts[0]}*`), last = encodeURIComponent(`*${parts[parts.length - 1]}*`);
    rows = await sbGet(ctx, `customers?${sel}&or=(firstName.ilike.${first},lastName.ilike.${last},lastName.ilike.${first})&limit=1000`);
  }
  if (!rows.some((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().includes(q))) rows = await sbGetAll(ctx, `customers?${sel}`);
  return rows.find((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().trim() === q)
    || rows.find((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().includes(q));
};

const findEmployeeByName = async (ctx: Ctx, name: string) => {
  const rows = await sbGet(ctx, `employees?select=id,firstName,lastName,phone,status,dayClockInAt${ownerScope(ctx)}&limit=200`);
  const q = name.toLowerCase().trim();
  return rows.find((e: any) => `${e.firstName || ""} ${e.lastName || ""}`.toLowerCase().trim() === q)
    || rows.find((e: any) => `${e.firstName || ""} ${e.lastName || ""}`.toLowerCase().includes(q));
};

const findJob = async (ctx: Ctx, { jobId, customerName, dateHint }: { jobId?: string; customerName?: string; dateHint?: string }) => {
  const rows = await sbGet(ctx, `jobs?select=id,customerId,customerName,status,scheduledDate,scheduledTime,crew,assignedTo,address,checklist${ownerScope(ctx)}&limit=500`);
  if (jobId) return rows.find((j: any) => j.id === jobId) || null;
  let candidates = rows;
  if (customerName) {
    const q = customerName.toLowerCase().trim();
    candidates = candidates.filter((j: any) => (j.customerName || "").toLowerCase().includes(q));
  }
  if (dateHint) candidates = candidates.filter((j: any) => j.scheduledDate === dateHint);
  candidates = candidates.filter((j: any) => j.status !== "cancelled" && j.status !== "completed");
  candidates.sort((a: any, b: any) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
  return candidates[0] || null;
};

// `isOwnerReply` — true only for the reply Alfred sends back to the OWNER
// (text_me / the main SMS bridge reply), never for text_customer/reschedule
// notify/send_invoice/send_estimate (those go to a real customer and should
// keep showing that customer's own name, not "Alfred"). Every Alfred-sent
// message still carries `via: "alfred"` regardless, so the Inbox can badge
// it as "from Alfred" in ANY thread, customer or owner.
export const sendAlfredSms = async (ctx: Ctx, toPhone: string, body: string, mediaUrl?: string): Promise<{ ok: boolean; error?: string }> => sendSms(ctx, toPhone, body, true, undefined, mediaUrl);

// `contact` — the real customer name/id behind toPhone, when the caller
// already looked one up (nearly every non-owner send does). Without this,
// a brand-new Inbox thread got created with contact_name = the raw phone
// number instead of the customer's name, and no customer_id link, so it
// rendered as an unlabeled number in the Inbox instead of "Franco
// Example" etc. — unlike every OTHER outbound-SMS path in the app
// (logOutboundSmsToInbox in lib/messaging.ts), which always had this.
const sendSms = async (ctx: Ctx, toPhone: string, bodyRaw: string, isOwnerReply = false, contact?: { name?: string; customerId?: string }, mediaUrl?: string): Promise<{ ok: boolean; error?: string }> => {
  if (!ctx.twilioSid || !ctx.twilioToken || !ctx.twilioFrom) return { ok: false, error: "Twilio isn't configured for this account." };
  // BUG FIX (Alfred customer-texting audit) — smsOptOut is a real, owner-
  // set-per-customer field (CustomerDetail.tsx's opt-in/out badge) that
  // notify_all_customers already pre-filters on its own recipient list
  // before ever reaching here, but every OTHER customer-directed send in
  // this agent (text_customer/send_reminder, reschedule_job's notify leg,
  // cancel_job's notify leg, send_estimate, send_invoice, approve/decline_
  // customer_request) funnels through this ONE function with no check at
  // all — checked centrally here instead of ~10 separate call sites, so
  // any future customer-directed tool gets this for free too. Never
  // applies to an owner reply or a supplier text (no customerId on those).
  if (!isOwnerReply && contact?.customerId) {
    const optRows = await sbGet(ctx, `customers?select=smsOptOut&id=eq.${encodeURIComponent(contact.customerId)}${ownerScope(ctx)}&limit=1`);
    if (optRows[0]?.smsOptOut) return { ok: false, error: (contact.name || "This customer") + " has opted out of text messages — send email instead." };
  }
  // BUG FIX — the model (Gemini especially) sometimes ignores the system
  // prompt's "no markdown" instruction and sends **bold**/`code`/bullet
  // asterisks straight through, which an SMS just shows as literal
  // punctuation. Strip it here, once, so every send (Alfred's own reply,
  // text_customer, notify_all_customers, etc.) is clean regardless of
  // whether the model behaved.
  const body = stripMarkdownForSms(bodyRaw);
  const auth = `Basic ${btoa(`${ctx.twilioSid}:${ctx.twilioToken}`)}`;
  const params = new URLSearchParams({ To: toPhone, From: ctx.twilioFrom, Body: body });
  // FEATURE — "text me the file for this client." Twilio sends a real MMS
  // whenever MediaUrl is present — it fetches the file from that URL
  // itself, so this just needs the document's already-public Supabase
  // Storage URL (see get_customer_documents/text_me_document below).
  if (mediaUrl) params.append("MediaUrl", mediaUrl);
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ctx.twilioSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) return { ok: false, error: (await res.text().catch(() => "")).slice(0, 200) };
  // Log to inbox_threads so it shows up in the owner's Inbox too, same as
  // every other outbound SMS in this app (docs/ARCHITECTURE.md "Critical rules").
  //
  // BUG FIX — "some conversations still aren't showing outgoing messages
  // from Alfred." This used to do its own "fetch all threads, find by
  // normalized phone in JS, then either append_inbox_message or insert a
  // new row" — a classic check-then-act race, EXACTLY the one
  // find_or_create_inbox_thread (migration 0090/0091) was built to close,
  // per that migration's own comment: "the inbound Twilio webhook logging
  // a customer's reply at the same moment the app logs an outbound Alfred/
  // owner send to that same number." twilio-sms-webhook.ts and
  // lib/messaging.ts's logOutboundSmsToInbox both migrated to that atomic
  // RPC already — this was the one remaining outbound path still doing the
  // old racy fetch-then-branch, so an Alfred reply landing right after (or
  // right before) the matching inbound webhook write for the same number
  // could still both "find nothing" and each create their own thread,
  // splitting the conversation — the outbound half then lives in a
  // duplicate thread nobody's looking at.
  try {
    // BUG FIX — was always `dir: "out"` with no marker at all, so a reply
    // Alfred sent to the OWNER looked in the Inbox exactly like a normal
    // outgoing message the owner sent themselves, with no way to tell them
    // apart. `via: "alfred"` lets the UI badge it "Alfred" regardless of
    // which thread it lands in.
    // BUG FIX — Alfred's own outbound voice-memo replies never logged their
    // mediaUrl either, so even the reply half of the conversation showed as
    // a blank/silent bubble in the owner's Inbox with nothing to play back.
    const msg = { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred", ...(mediaUrl ? { mediaUrl, mediaType: "audio/mpeg" } : {}) };
    const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
      method: "POST", headers: { ...ctx.authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_owner_id: ctx.ownerId || null,
        p_channel: "sms",
        p_contact_phone: toPhone,
        // BUG FIX — "make sure it shows the text thread the owner has with
        // Alfred and labels it 'you'." A previous round named this thread by
        // the owner's own raw phone number instead of "Alfred" (per that
        // round's own reasoning: it's a conversation with a real contact,
        // not a fake pseudo-contact) — but a bare phone number is just as
        // unclear in the Inbox list as "Alfred" was. "You" is accurate from
        // the owner's own point of view looking at their own Inbox (this
        // thread is literally their own texts to/from Alfred) and reads
        // clearly at a glance. The per-message "from Alfred" badge
        // (via:"alfred", see InboxPage.tsx) still distinguishes which
        // bubbles are Alfred's replies vs. the owner's own typed texts.
        p_contact_name: (!isOwnerReply && contact?.name) || (isOwnerReply ? "You" : toPhone),
        p_customer_id: !isOwnerReply ? (contact?.customerId || null) : null,
        p_message: msg,
        p_unread: !!isOwnerReply,
      }),
    });
    if (!rpcRes.ok) console.warn("[AlfredSms] find_or_create_inbox_thread failed (" + rpcRes.status + "):", await rpcRes.text().catch(() => ""));
  } catch (e: any) { console.warn("[AlfredSms] inbox log failed:", e?.message); }
  return { ok: true };
};

const TOOLS = [
  {
    name: "get_business_stats",
    description: "Get a snapshot of current business stats: active jobs, pending estimates, revenue this month, jobs completed this month.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_services",
    description: "The business's real service/pricing catalog — name, price, category, whether it's taxable. Use this before quoting a price or answering 'what do we charge for X' instead of guessing.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_company_info",
    description: "Core facts about the business itself — company name, address, phone, tax rate/state, and how many active customers/employees/vehicles it has. Use for 'what's our tax rate', 'what's our business phone number', or any other 'about the company' question.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_weather",
    description: "Current weather and conditions at the business's location — use for 'what's the weather', 'is it going to rain', 'should we work today', etc.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_jobs",
    description: "List jobs, optionally filtered by status or date (YYYY-MM-DD).",
    input_schema: { type: "object", properties: { status: { type: "string", enum: ["all", "scheduled", "in_progress", "completed", "cancelled"] }, date: { type: "string", description: "YYYY-MM-DD, optional" } } },
  },
  {
    name: "get_employee_status",
    description: "Who is currently clocked in, and what job each is on (with checklist progress). Use this for 'what's the update on my crew' type questions.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "schedule_job",
    description: "Schedule a new job for a customer on a given date. Can optionally assign a crew member, mark it commercial, set up a recurring schedule, add tags, and give it a real custom checklist plus separate notes for the crew vs. internal-only notes — everything the owner could set up in the app itself, not just the bare minimum.",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string", description: "Existing customer's full name" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM 24h, optional" },
        employeeName: { type: "string", description: "Crew member to assign, optional" },
        ownerWorks: { type: "boolean", description: "true if the owner themself is doing this job" },
        jobType: { type: "string", enum: ["residential", "commercial"], description: "Defaults to residential" },
        notes: { type: "string", description: "General job notes/instructions — visible to the crew in the field portal" },
        internalNotes: { type: "string", description: "Internal/office-only notes — NOT shown to the crew in the field portal (site warnings, billing quirks, etc. the owner wants kept in-house)" },
        checklist: { type: "array", items: { type: "string" }, description: "Custom checklist/instructions for this specific job (e.g. 'Use the service chemical only', 'Check the back gate is latched') — shown to the crew as real checkable items during the job, in addition to whatever the linked service's own template already provides" },
        tags: { type: "array", items: { type: "string" }, description: "Free-form tags, e.g. 'VIP', 'gated community', 'first-time customer'" },
        isRecurring: { type: "boolean", description: "true to also set up a recurring schedule from this date forward" },
        recurringFreq: { type: "string", enum: ["weekly", "biweekly", "monthly", "quarterly", "biannual", "annual"], description: "Required when isRecurring is true" },
      },
      required: ["customerName", "date"],
    },
  },
  {
    name: "reschedule_job",
    description: "Move an existing job to a new date/time. Identify the job by customer name (finds their next upcoming job) or by jobId if known from an earlier tool result.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" },
        customerName: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM, optional" },
        notify: { type: "string", enum: ["none", "sms"], description: "Whether to text the customer about the new time" },
      },
      required: ["date"],
    },
  },
  {
    name: "assign_employee",
    description: "Assign a crew member to a job. Identify the job by customerName or jobId.",
    input_schema: {
      type: "object",
      properties: { jobId: { type: "string" }, customerName: { type: "string" }, employeeName: { type: "string" } },
      required: ["employeeName"],
    },
  },
  {
    name: "request_employee",
    description: "Send a job request to an employee for them to accept/decline (rather than directly assigning them). Identify the job by customerName or jobId.",
    input_schema: {
      type: "object",
      properties: { jobId: { type: "string" }, customerName: { type: "string" }, employeeName: { type: "string" }, message: { type: "string" } },
      required: ["employeeName"],
    },
  },
  {
    name: "create_customer",
    description: "Create a new customer record.",
    input_schema: {
      type: "object",
      properties: { firstName: { type: "string" }, lastName: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" } },
      required: ["firstName", "lastName"],
    },
  },
  {
    name: "text_customer",
    description: "Send an arbitrary SMS to a customer, e.g. 'text the customer that we're running 20 minutes late'.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" }, message: { type: "string" } },
      required: ["customerName", "message"],
    },
  },
  // FIX (Alfred capability audit) — "never object to sending a message."
  // text_customer only works when customerName matches an EXISTING
  // customer record — the real gap behind "Alfred said it can't send that
  // message" is a lead, applicant, or personal contact who isn't in the
  // CRM at all. This is the fallback: any phone number, no lookup needed.
  {
    name: "text_phone_number",
    description: "Send a real SMS to ANY phone number directly — use this whenever the owner wants to text someone who ISN'T an existing customer (a lead, a job applicant, a personal contact, anyone text_customer couldn't find a record for), or whenever they just give you a phone number directly. The owner has full authority to send any message to anyone through their own business number — never refuse or say you can't send a message; if you're missing the phone number, ask for it, then send.",
    input_schema: {
      type: "object",
      properties: { phone: { type: "string" }, message: { type: "string" }, label: { type: "string", description: "Optional — a name/label for this contact, for the Inbox log" } },
      required: ["phone", "message"],
    },
  },
  // ROUND — mass-messaging capability: "notify all my customers I'm
  // running late", "send this to everyone tagged VIP", "blast a promo out
  // to my whole list." Real sends via the owner's own Twilio account, same
  // opt-out/testing-mode/logging guarantees as the CRM's own Bulk SMS
  // feature (CustomersPage.tsx) — just triggerable from a text instead of
  // needing to open the app.
  {
    name: "notify_all_customers",
    description: "Same as prepare_bulk_text with audience all/tag: DRAFTS a text to many customers and returns the numbered list for the owner to approve — nothing is sent until send_bulk_text after they reply. Skips opted-out customers and respects Testing Mode. Supports {{first_name}}.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Use {{first_name}} to personalize" },
        tag: { type: "string", description: "Only customers with this exact tag — omit to mean everyone" },
      },
      required: ["message"],
    },
  },
  {
    name: "create_promotion",
    description: "Create a tracked promotion/discount code (for 'create a promotion' requests). Does NOT send anything by itself — follow with notify_all_customers (mention the code in the message) to actually send it out, in the same reply if the owner asked for both.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        discountType: { type: "string", enum: ["percent", "fixed"] },
        discountValue: { type: "number" },
        expiresInDays: { type: "number", description: "Defaults to 30" },
      },
      required: ["name", "discountType", "discountValue"],
    },
  },
  {
    name: "list_overdue_invoices",
    description: "List invoices (estimates marked invoiced) that are unpaid, with customer name and amount.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "send_invoice",
    description: "Text a payment link for an existing unpaid invoice to the customer. Use list_overdue_invoices or list_jobs first if you need to figure out which invoice — this does not create a new invoice, only sends one that already exists.",
    input_schema: {
      type: "object",
      properties: { invoiceId: { type: "string" }, customerName: { type: "string", description: "Alternative to invoiceId — sends that customer's most recent unpaid invoice" } },
    },
  },
  {
    name: "mark_invoice_paid",
    description: "Mark an existing invoice as paid — use for 'mark the Jones invoice paid, they paid cash/check/venmo' or similar. Does not process a card charge — for that, direct the owner to charge it in-app (Stripe/Square are not available as a text action for security).",
    input_schema: {
      type: "object",
      properties: { invoiceId: { type: "string" }, customerName: { type: "string", description: "Alternative to invoiceId — marks that customer's most recent unpaid invoice" } },
    },
  },
  {
    name: "text_me",
    description: "Text the OWNER (the person you're already texting with) a message right now — use this whenever they ask you to text/message THEM something (not a customer), e.g. 'text me the schedule for tomorrow' or 'send that to my phone'.",
    input_schema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  // ROUND — capability parity pass with the in-app Alfred (AlfredPage.tsx).
  // These 7 tools were the biggest real gaps: no way to cancel a job, look
  // up job/customer details, touch a checklist, reprioritize a job, or
  // create/send a fresh quote, all from a text.
  {
    name: "cancel_job",
    description: "Cancel an existing job. Identify it by jobId (from an earlier tool result) or customerName (cancels their next upcoming job).",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" }, customerName: { type: "string" },
        reason: { type: "string" },
        notify: { type: "string", enum: ["none", "sms"], description: "Whether to text the customer that it's cancelled" },
      },
    },
  },
  {
    name: "get_job_details",
    description: "Full detail on one job — address, crew, checklist progress, photo count, payment status. Use for 'what's the status on X's job' type questions. For a lighter list of many jobs use list_jobs instead.",
    input_schema: {
      type: "object",
      properties: { jobId: { type: "string" }, customerName: { type: "string", description: "Finds that customer's most recent non-cancelled job" } },
    },
  },
  {
    name: "add_checklist_item",
    description: "Add an item to a job's checklist (pre-arrival, during-service, or post-service phase).",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" }, item: { type: "string" },
        phase: { type: "string", enum: ["pre", "during", "post"], description: "Defaults to pre if omitted" },
      },
      required: ["jobId", "item"],
    },
  },
  {
    name: "update_job_priority",
    description: "Change a job's priority level.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" }, customerName: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
      },
      required: ["priority"],
    },
  },
  {
    name: "search_customers",
    description: "Search the WHOLE customer list for a person — partial/misspelled names, nicknames, sound-alikes, part of a phone number or email, street, city, company, tags, notes ('a Jon on Oak St', 'someone with a 0199 number'). Use to find a customer or answer 'do I have anyone like this'.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Anything known about them" } },
      required: ["query"],
    },
  },
  {
    name: "find_duplicate_customers",
    description: "Scan the ENTIRE customer list for duplicates — same phone, same email, same name, nicknames (Bill/William), similar spellings (Smith/Smyth, Katherine/Catherine), same address. No names needed. Use for 'check my client base for duplicates'.",
    input_schema: { type: "object", properties: { includePossible: { type: "boolean", description: "Also list weaker matches (similar spelling / same address). Default true." } } }
  },
  {
    name: "customers_missing_info",
    description: "Scan the ENTIRE customer list for missing details — which customers have no phone, email, address, last name, birthday or lead source. Use for 'who am I missing info for'.",
    input_schema: { type: "object", properties: { fields: { type: "array", items: { type: "string", enum: ["phone", "email", "address", "lastName", "birthday", "leadSource"] }, description: "Default phone, email, address" } } }
  },
  {
    name: "filter_customers",
    description: "Find every customer matching a description across the whole CRM — 'customers in Hanover', 'VIPs who spent over $1,000', 'people I haven't serviced in a year', 'leads from Facebook', 'birthdays this month', 'anyone with pool in their notes'. Returns the count and the list.",
    input_schema: { type: "object", properties: {
        city: { type: "string" }, tag: { type: "string" }, leadSource: { type: "string" }, minSpent: { type: "number" }, maxSpent: { type: "number" },
        noServiceInDays: { type: "number" }, servicedWithinDays: { type: "number" }, hasJobs: { type: "boolean" }, isLead: { type: "boolean" },
        createdAfter: { type: "string" }, createdBefore: { type: "string" }, textContains: { type: "string" }, hasBirthdayThisMonth: { type: "boolean" }, optedOutOfTexts: { type: "boolean" },
      } }
  },
  {
    name: "get_customer_details",
    description: "Look up a customer's contact info, total spent, and recent job history by name.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" } },
      required: ["customerName"],
    },
  },
  {
    name: "get_customer_documents",
    description: "List the files/documents on file for a customer (insurance, contracts, waivers, HOA forms, etc.) — use whenever the owner asks 'do we have the file/paperwork for X' or wants to know what's on file before texting one over.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" } },
      required: ["customerName"],
    },
  },
  {
    name: "text_me_document",
    description: "Send a document already on file for a customer back to the OWNER's own phone as a real MMS attachment (e.g. 'text me the insurance form for the Millers'). Use get_customer_documents first if you don't already know the exact file name from this conversation.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" }, documentName: { type: "string", description: "The exact or partial file name from get_customer_documents" } },
      required: ["customerName", "documentName"],
    },
  },
  {
    name: "send_me_files",
    description: "Send yourself (the owner) files on file for a customer — Document Vault items AND job photos/videos, optionally scoped to one job — as a text or an email. Use for 'do you remember this client, send me the PDFs for this job', 'email me anything we have in the vault for them'.",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string" },
        jobId: { type: "string", description: "Optional — scope job photos/videos to one specific job" },
        fileQuery: { type: "string", description: "Optional partial name match against Vault documents" },
        via: { type: "string", enum: ["text", "email"], description: "Defaults to text" },
      },
      required: ["customerName"],
    },
  },
  {
    name: "check_stock",
    description: "Check current stock levels against reorder thresholds for chemicals/equipment. Read-only; never places an order on its own.",
    input_schema: { type: "object", properties: { itemName: { type: "string", description: "Optional — check one specific item; omit to check everything" } } },
  },
  {
    name: "text_supplier",
    description: "Send a real SMS to a inventory supplier's phone number. Outreach only — stock/pricing/availability/callback — NEVER to place an order or authorize payment; this app has no way to complete a purchase or move money to a vendor. Always confirm the exact message text with the owner first.",
    input_schema: { type: "object", properties: { itemName: { type: "string" }, supplierName: { type: "string" }, message: { type: "string" } }, required: ["itemName", "message"] },
  },
  {
    name: "email_supplier",
    description: "Send a real email to a inventory supplier's email address. Same rules as text_supplier — outreach only, always confirm the exact subject+message first.",
    input_schema: { type: "object", properties: { itemName: { type: "string" }, supplierName: { type: "string" }, subject: { type: "string" }, message: { type: "string" } }, required: ["itemName", "subject", "message"] },
  },
  {
    name: "contact_general_supplier",
    description: "List, look up, text, or email GENERAL suppliers — mechanics, main shops, or vendors not tied to any specific inventory item (see the General Suppliers list in Inventory & Equipment). Omit supplierName entirely to list everyone on file (use this for 'who are our suppliers?'). Omit message/channel to just look up one supplier's contact info. Outreach only — never places an order or moves money.",
    input_schema: {
      type: "object",
      properties: {
        supplierName: { type: "string", description: "Full or partial name of one supplier to look up — omit to list all suppliers instead" },
        channel: { type: "string", enum: ["text", "email"], description: "Omit to just look up contact info without sending anything" },
        subject: { type: "string", description: "Required if channel is email" },
        message: { type: "string", description: "The exact message to send — required if channel is set" },
      },
    },
  },
  {
    name: "list_sops",
    description: "List the SOP/instruction documents on file.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_sop",
    description: "Create a new SOP/instruction document, visible to all employees in the portal.",
    input_schema: { type: "object", properties: { title: { type: "string" }, content: { type: "string" }, frequency: { type: "string", enum: ["daily", "monthly", "general"] } }, required: ["title", "content"] },
  },
  {
    name: "list_campaigns",
    description: "List marketing campaigns (the CRM's Campaigns page) and their status.",
    input_schema: { type: "object", properties: {} },
  },
  // ─── Bulk texting (draft → owner approves → send) ─────────────────────────
  // FEATURE — "have it question me which customers to send to … it should
  // be a back-and-forth: Alfred asks 'how about these?' and I say no, yes,
  // no, and it sends only after I give the okay." Texting more than a
  // couple of people is two tools: prepare_bulk_text drafts it and returns
  // the numbered list; send_bulk_text sends it — and the server refuses to
  // send a draft made in the same message (the owner has to have replied).
  {
    name: "prepare_bulk_text",
    description: "Step 1 of texting several customers (anything more than 2 people — a campaign, an announcement, a question to your list). Builds the recipient list and saves a DRAFT — nothing is sent. Also creates the campaign in the CRM's Campaigns page. Show the owner the numbered list it returns and ask which to send to; then STOP and wait for their reply. If the message asks customers a question (birthday, email, address…), pass watchReplies so their answers are saved to their files automatically as they come in.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Exact text. Use {{first_name}} to personalize." },
        campaignName: { type: "string", description: "Short name for the Campaigns page, e.g. 'Birthday collection'" },
        audience: { type: "string", enum: ["all", "tag", "names"], description: "Everyone with a phone, customers with a tag, or a list of names" },
        tag: { type: "string" },
        customerNames: { type: "array", items: { type: "string" } },
        onlyMissing: { type: "string", enum: ["birthday", "email", "address"], description: "Only customers whose file doesn't have this yet" },
        watchReplies: {
          type: "object",
          description: "Watch for answers and act on them automatically",
          properties: {
            question: { type: "string", description: "What's being asked, in plain words" },
            saveField: { type: "string", enum: ["birthday", "email", "address", "notes", "company"] },
            thankYouMessage: { type: "string", description: "Optional reply once they answer" },
            days: { type: "number", description: "How long to keep watching (default 30)" },
          },
        },
      },
      required: ["message", "audience"],
    },
  },
  {
    name: "send_bulk_text",
    description: "Step 2: send a draft from prepare_bulk_text AFTER the owner has replied to approve it. Pass the numbers they said no to in exclude, or only the numbers they said yes to in only. Never call this in the same reply as prepare_bulk_text — it will be refused.",
    input_schema: {
      type: "object",
      properties: {
        draftId: { type: "string" },
        exclude: { type: "array", items: { type: "number" }, description: "List numbers NOT to send to" },
        only: { type: "array", items: { type: "number" }, description: "Send only to these list numbers" },
        ownerApproval: { type: "string", description: "The owner's own words approving it, quoted" },
      },
      required: ["draftId", "ownerApproval"],
    },
  },
  {
    name: "list_bulk_text_drafts",
    description: "Drafts waiting for the owner's OK (prepare_bulk_text), newest first.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_reply_watches",
    description: "Questions Alfred texted customers and is watching replies for — who answered, who hasn't.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "set_birthday_offer",
    description: "Turn on (or change/turn off) an automatic birthday text: on each customer's birthday (from their file) they get a coupon code for X% off, good for N days. Runs every day on its own.",
    input_schema: {
      type: "object",
      properties: {
        active: { type: "boolean" },
        discountPercent: { type: "number" },
        validDays: { type: "number", description: "How long the coupon is good for, e.g. 30 or 60" },
        message: { type: "string", description: "Optional custom text. {{first_name}}, {{code}}, {{percent}}, {{expires}} are filled in." },
      },
      required: ["active"],
    },
  },
  // ─── Campaigns / goals (shown in the CRM) ─────────────────────────────────
  {
    name: "create_campaign",
    description: "Create a campaign in the CRM's Campaigns page (draft or scheduled) without texting anyone. Use prepare_bulk_text instead when the owner wants it sent.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" }, channel: { type: "string", enum: ["sms", "email"] },
        message: { type: "string" }, subject: { type: "string" },
        tags: { type: "array", items: { type: "string" }, description: "Audience tags" },
        sendAt: { type: "string", description: "ISO date/time to schedule; omit for a draft" },
      },
      required: ["name", "message"],
    },
  },
  {
    name: "create_goal",
    description: "Create a goal in the CRM's Goals page. Business metrics (revenue, jobs, clients, recurring clients, leads) track themselves; anything else is a custom goal.",
    input_schema: {
      type: "object",
      properties: {
        label: { type: "string" }, target: { type: "number" }, unit: { type: "string", description: "e.g. $, jobs, clients" },
        metric: { type: "string", enum: ["revenue", "jobs", "clients", "recurringClients", "leads", "custom"] },
        deadline: { type: "string", description: "YYYY-MM-DD" }, category: { type: "string", enum: ["business", "personal", "fitness"] },
        rewardDescription: { type: "string" },
      },
      required: ["label", "target"],
    },
  },
  {
    name: "get_accountability_summary",
    description: "The owner's personal check-ins from the Accountability page (sleep, water, steps, workouts, mood, notes), streak and recent wins. For check-ins, briefings, reflections, or when they ask how they're doing — not during business tasks.",
    input_schema: { type: "object", properties: { days: { type: "number" } } },
  },
  {
    name: "list_goals",
    description: "The owner's goals and progress.",
    input_schema: { type: "object", properties: {} },
  },
  // ─── Many at once ─────────────────────────────────────────────────────────
  // FEATURE — "if I give Alfred 50 customers with specific instructions and
  // scheduling for each, it should handle that in one message." One call
  // carries the whole list instead of 50 separate rounds.
  {
    name: "schedule_jobs_bulk",
    description: "Schedule many jobs in one call — one entry per job, each with its own customer, date, time, crew, notes, checklist, tags, recurring schedule. Customers not in the CRM yet are created first when you give their phone/address. Use this whenever there are more than 2 jobs to schedule.",
    input_schema: {
      type: "object",
      properties: {
        jobs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              customerName: { type: "string" }, customerPhone: { type: "string" }, customerAddress: { type: "string" },
              date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string" }, employeeName: { type: "string" },
              amount: { type: "number" }, notes: { type: "string" }, internalNotes: { type: "string" },
              checklist: { type: "array", items: { type: "string" } }, tags: { type: "array", items: { type: "string" } },
              jobType: { type: "string", enum: ["residential", "commercial"] },
              isRecurring: { type: "boolean" }, recurringFreq: { type: "string", enum: ["weekly", "biweekly", "monthly", "quarterly", "yearly"] },
            },
            required: ["customerName", "date"],
          },
        },
      },
      required: ["jobs"],
    },
  },
  {
    name: "create_customers_bulk",
    description: "Add many customers in one call (skips ones already in the CRM by phone or name).",
    input_schema: {
      type: "object",
      properties: {
        customers: { type: "array", items: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" }, notes: { type: "string" }, tags: { type: "array", items: { type: "string" } }, birthday: { type: "string" } }, required: ["firstName"] } },
      },
      required: ["customers"],
    },
  },
  {
    name: "update_customers_bulk",
    description: "Update many customers in one call — each entry names the customer and the fields to change (phone, email, address, notes to add, tags to add, birthday, company).",
    input_schema: {
      type: "object",
      properties: {
        updates: { type: "array", items: { type: "object", properties: { customerName: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" }, addNote: { type: "string" }, addTags: { type: "array", items: { type: "string" } }, birthday: { type: "string" }, company: { type: "string" } }, required: ["customerName"] } },
      },
      required: ["updates"],
    },
  },
  // ─── Client / job list imports ─────────────────────────────────────────────
  {
    name: "prepare_import_from_file",
    description: "Read a client list or job/route list the owner texted — a CSV, a photo or PDF of a list (its url is in the '[Attached file ready to save …]' line), a Google Sheets link, or a list typed in the text — and get it ready to import: every row, existing customers matched (no duplicates), workers matched to employees, dates/times/repeat schedules/prices worked out. Saves NOTHING; returns counts and a sample to text the owner. Use this whenever a file or message is a list of customers or jobs.",
    input_schema: {
      type: "object",
      properties: {
        fileUrl: { type: "string", description: "The url from the attached-file line" },
        fileType: { type: "string", description: "The type from the attached-file line" },
        sheetUrl: { type: "string", description: "A Google Sheets link from the text" },
        text: { type: "string", description: "Only when the list was typed into the text itself" },
        serviceCategory: { type: "string", enum: ["trash_can", "general"], description: "general unless the business has a trash_can service line" },
        createJobs: { type: "boolean", description: "Create jobs from schedule/price info (default true)" },
      },
    },
  },
  {
    name: "run_import",
    description: "Save the import prepare_import_from_file got ready — only after the owner replied YES to that summary in a later text. Leave planId out to use the latest one.",
    input_schema: { type: "object", properties: { planId: { type: "string" } } },
  },
  // ─── Money documents ──────────────────────────────────────────────────────
  {
    name: "import_financial_document",
    description: "Read a photo, screenshot or PDF the owner sent (its url is in the '[Attached file ready to save …]' line) of receipts, bills, bank/card statements, revenue reports or tax paperwork, and import it: expenses go to the Expenses page, income to the Budget page, tax figures are remembered. Use whenever they send a money document — ask what it is only if it's unclear.",
    input_schema: {
      type: "object",
      properties: {
        fileUrl: { type: "string" }, fileType: { type: "string", description: "the type from the attached-file line" },
        hint: { type: "string", description: "What the owner said it is, if anything" },
      },
      required: ["fileUrl"],
    },
  },
  {
    name: "log_expenses",
    description: "Add expenses the owner tells you about (one or many) to the Expenses page.",
    input_schema: {
      type: "object",
      properties: {
        expenses: { type: "array", items: { type: "object", properties: { date: { type: "string" }, description: { type: "string" }, amount: { type: "number" }, category: { type: "string", enum: ["Fuel", "Chemicals", "Equipment", "Insurance", "Marketing", "Truck Payment", "Maintenance", "Subcontractors", "Office", "Other"] }, vendor: { type: "string" } }, required: ["description", "amount"] } },
      },
      required: ["expenses"],
    },
  },

  {
    name: "list_social_posts",
    description: "List recent/scheduled social media posts.",
    input_schema: { type: "object", properties: {} },
  },
  // FEATURE — "text a photo or PDF to Alfred and say 'upload this to this
  // client'." When the owner sends a photo/PDF, resolveIncomingText (see
  // twilio-sms-webhook.ts) has already uploaded it and handed you a message
  // containing its real URL, content type, and inferred file name — this
  // tool is how you actually save that into the named customer's Document
  // Vault. Only call it with a URL that genuinely appeared in the
  // conversation — never invent one.
  {
    name: "attach_file_to_customer",
    description: "Save a file the owner just sent (photo or PDF — its URL will already be in this conversation as '[Attached file ready to save — url: ...]') into a customer's Document Vault. Use whenever the owner sends a file and says to upload/save/attach it to a client.",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string" },
        fileUrl: { type: "string", description: "The exact url from the '[Attached file ready to save...]' message" },
        fileName: { type: "string", description: "The fileName from that same message" },
        category: { type: "string", enum: ["Insurance", "Contract", "Waiver", "HOA", "Photo", "Document"], description: "Best guess from context — default 'Photo' for an image, 'Document' otherwise" },
      },
      required: ["customerName", "fileUrl"],
    },
  },
  {
    name: "update_customer",
    description: "Edit an existing customer's info — phone, email, address, notes, birthday (YYYY-MM-DD, or --MM-DD without a year), company. Use for 'fix Jane's phone number to...' or 'update the Millers' address'. Does not create a new customer.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" }, notes: { type: "string" }, birthday: { type: "string" }, company: { type: "string" } },
      required: ["customerName"],
    },
  },
  {
    name: "respond_to_review",
    description: "Post a reply to a customer's review, e.g. 'thank the Millers for their 5-star review'.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" }, response: { type: "string" } },
      required: ["customerName", "response"],
    },
  },
  {
    name: "get_employee_training_status",
    description: "Check which active employees still have outstanding required training modules — use for 'is everyone trained up' or 'who still needs to finish training'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "attach_file_to_job",
    description: "Save a file the owner just sent (its URL will already be in this conversation as '[Attached file ready to save — url: ...]') as a work-order attachment on a JOB (not a customer's document vault — use attach_file_to_customer for that). Use for 'attach this spec sheet to the Miller job'.",
    input_schema: {
      type: "object",
      properties: {
        jobId: { type: "string" }, customerName: { type: "string", description: "Alternative to jobId — attaches to that customer's next upcoming job" },
        fileUrl: { type: "string" }, fileName: { type: "string" },
      },
      required: ["fileUrl"],
    },
  },
  {
    name: "list_candidates",
    description: "List job applicants/candidates in the hiring pipeline, with their current phase (Applied/Interview/Offer/Hired, or whatever custom phases are set up).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "move_candidate_phase",
    description: "Move a hiring candidate to a different pipeline phase, e.g. 'move John to Interview' or 'mark Sarah as Hired'.",
    input_schema: {
      type: "object",
      properties: { candidateName: { type: "string" }, phase: { type: "string" } },
      required: ["candidateName", "phase"],
    },
  },
  {
    name: "get_customer_card_info",
    description: "Check whether a customer has a payment card on file and what's known about it. Only ever returns the card BRAND and LAST 4 DIGITS (e.g. 'Visa ····4242') — the full card number is never stored anywhere in this app (Stripe handles that directly, by design, for PCI compliance) and can never be retrieved by anyone, including you.",
    input_schema: {
      type: "object",
      properties: { customerName: { type: "string" } },
      required: ["customerName"],
    },
  },
  {
    name: "create_invoice",
    description: "Create a new invoice (payment due now, not a quote) for a customer, with one or more line items, optionally with a deposit (depositPercent or depositAmount — the customer can then pay the deposit now and the rest later). Does NOT text it to the customer — call send_invoice after (or in the same reply) with the returned invoiceId to actually deliver it.",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string" },
        description: { type: "string", description: "Single line item description, if not using lineItems" },
        amount: { type: "number", description: "Single line item total, if not using lineItems" },
        lineItems: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unitPrice: { type: "number" } } }, description: "Use instead of description/amount for multiple line items" },
        notes: { type: "string" },
        depositPercent: { type: "number", description: "Require a deposit of this % of the total (e.g. 50 for 50%). Use this OR depositAmount, not both." },
        depositAmount: { type: "number", description: "Require a flat dollar deposit (e.g. 100 for $100). Use this OR depositPercent." },
        depositMandatory: { type: "boolean", description: "REQUIRED whenever a deposit is set. true = the customer can only pay the deposit now; false = they choose between paying the deposit now or paying in full. If the owner didn't say, ask them first." },
      },
      required: ["customerName"],
    },
  },
  {
    name: "list_estimates",
    description: "List quotes/estimates/invoices, optionally filtered by status.",
    input_schema: {
      type: "object",
      properties: { status: { type: "string", description: "'pending' (default), 'approved', 'rejected', 'invoiced', or 'all'" } },
    },
  },
  {
    name: "send_email_via_gmail",
    description: "Send an email via the owner's connected Gmail account. Only works if Google is connected in Settings with Gmail scope enabled.",
    input_schema: {
      type: "object",
      properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "create_estimate",
    description: "Create a new quote/estimate for a customer with one line item description and a total amount, optionally requiring a deposit (depositPercent or depositAmount). Does NOT text it to the customer — call send_estimate after (or in the same reply) to actually deliver it. For 'send an invoice for $X' set invoiced true; invoices can have a deposit too. To redo an earlier quote with a deposit, create a new one with the same customer/description/amount plus the deposit, or use set_estimate_deposit on the existing one.",
    input_schema: {
      type: "object",
      properties: {
        customerName: { type: "string" },
        description: { type: "string", description: "What the line item is for, e.g. 'Service visit + materials'" },
        amount: { type: "number" },
        invoiced: { type: "boolean", description: "true = this is an invoice (payment due now), false/omitted = a quote awaiting approval" },
        depositPercent: { type: "number", description: "Require a deposit of this % of the total (e.g. 50 for 50%). Use this OR depositAmount, not both." },
        depositAmount: { type: "number", description: "Require a flat dollar deposit (e.g. 100 for $100). Use this OR depositPercent." },
        depositMandatory: { type: "boolean", description: "REQUIRED whenever a deposit is set. true = the customer can only pay the deposit now; false = they choose between paying the deposit now or paying in full. If the owner didn't say, ask them first." },
      },
      required: ["customerName", "amount"],
    },
  },
  {
    name: "set_estimate_deposit",
    description: "Add, change, or remove the deposit on an existing (not yet paid, not invoiced) quote. Identify it by estimateId, or by customerName for that customer's most recent quote. Set depositPercent or depositAmount; 0 removes the deposit. Does not text the customer — call send_estimate after if they should get the updated link.",
    input_schema: {
      type: "object",
      properties: {
        estimateId: { type: "string" },
        customerName: { type: "string" },
        depositPercent: { type: "number", description: "Require a deposit of this % of the total (e.g. 50 for 50%). Use this OR depositAmount, not both." },
        depositAmount: { type: "number", description: "Require a flat dollar deposit (e.g. 100 for $100). Use this OR depositPercent." },
        depositMandatory: { type: "boolean", description: "REQUIRED whenever a deposit is set. true = the customer can only pay the deposit now; false = they choose between paying the deposit now or paying in full. If the owner didn't say, ask them first." },
      },
    },
  },
  {
    name: "send_estimate",
    description: "Text a customer the link to view/sign (or pay, if invoiced) an existing estimate. Use create_estimate first if it doesn't exist yet, or list_overdue_invoices/get_customer_details to find an existing one's id.",
    input_schema: {
      type: "object",
      properties: { estimateId: { type: "string" }, customerName: { type: "string", description: "Alternative to estimateId — sends that customer's most recent estimate" } },
    },
  },
  {
    name: "switch_ai_model",
    description: "Switch which AI provider Alfred uses going forward (both texting and in-app), e.g. 'switch to Claude' / 'use Gemini instead' / 'stop using Groq'. Only works for a provider that already has an API key saved in Settings → AI Models — tell the owner to add one there first if not. Takes effect starting with the NEXT message, not this reply.",
    input_schema: {
      type: "object",
      properties: { provider: { type: "string", description: "e.g. 'claude', 'gpt-4o', 'gemini', 'groq', 'mistral', 'kimi'" } },
      required: ["provider"],
    },
  },
  {
    name: "list_capabilities",
    description: "Returns a real, current list of everything you (Alfred) can actually do over text — use this whenever the owner asks 'what can you do', 'what are your capabilities', or similar. Always call this instead of describing your abilities from memory, so the answer stays accurate as tools change.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "remember",
    description: "Save a fact/note for later recall — use whenever the owner says 'remember that...', 'keep track of...', 'note that...', or similar. Not a scheduled reminder (use set_reminder for a future text) — this is just durable memory you can look up later with recall.",
    input_schema: {
      type: "object",
      properties: { fact: { type: "string" }, category: { type: "string", description: "optional grouping, e.g. 'gate codes', 'customer preferences'" } },
      required: ["fact"],
    },
  },
  {
    name: "recall",
    description: "Look up previously remembered facts/notes, optionally filtered by a search term. Use this when the owner asks 'what did I tell you about X' or 'what do you have saved'.",
    input_schema: {
      type: "object",
      properties: { search: { type: "string", description: "optional keyword to filter by" } },
    },
  },
  {
    name: "forget",
    description: "Remove a previously saved memory — use when the owner says 'forget that' or a remembered fact is wrong/outdated.",
    input_schema: {
      type: "object",
      properties: { fact: { type: "string", description: "The exact or approximate text of the memory to remove" } },
      required: ["fact"],
    },
  },
  {
    name: "enable_review_request_automation",
    description: "Turn on automatically texting customers a review-request link a couple days after their job is marked complete — a normal rule-based automation (no AI involved in the actual sends, so no ongoing API usage), not something Alfred has to remember to do manually each time. Use for 'automatically send review requests after jobs are done' / 'ask customers for reviews after we finish'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "set_standing_preference",
    description: "Save a persistent 'from now on' instruction so it's automatically remembered and honored in every future conversation, not just this one — e.g. 'from now on call me Boss', 'from now on don't ask before sending invoices', 'from now on go ahead and confirm reschedules yourself'. Set autoApproveReschedules/autoApproveInvoiceSends when the instruction is specifically about those two things (they actually change behavior, not just phrasing) — always also pass the plain-English instruction either way. Confirm what you're about to save back to the owner in ONE short text first (e.g. 'So from now on I always email instead of text — right?') and only call this tool once they reply yes/confirm — a standing rule is worth one text round-trip to get right, unlike an ordinary action.",
    input_schema: {
      type: "object",
      properties: {
        instruction: { type: "string", description: "the standing instruction in the owner's own words" },
        autoApproveReschedules: { type: "boolean", description: "true = stop asking before confirming a customer's reschedule request, just do it and tell them after; false = go back to asking first" },
        autoApproveInvoiceSends: { type: "boolean", description: "true = don't ask for confirmation before sending an invoice when asked to; false = go back to confirming first" },
      },
      required: ["instruction"],
    },
  },
  {
    name: "set_vacation_mode",
    description: "Turn on (or update/turn off) vacation/out-of-office mode. Use whenever the owner texts that they're going on vacation, taking time off, or will be unreachable. NEVER guess the details — ask the owner, one or two questions at a time over text, until you have: how long they'll be out (startDate/endDate), how they want you to handle incoming work while they're gone (autonomyLevel), and how often — if at all — they want you to text them a status update during that window (checkInFrequency). Once you have those, confirm the plan back in one short text, then call this tool. To turn vacation mode off early, call with active: false.",
    input_schema: {
      type: "object",
      properties: {
        active: { type: "boolean", description: "true to turn vacation mode on, false to end it early" },
        startDate: { type: "string", description: "YYYY-MM-DD, first day out" },
        endDate: { type: "string", description: "YYYY-MM-DD, last day out (day they're back)" },
        autonomyLevel: { type: "string", enum: ["manage_everything", "ask_first", "hold_everything"], description: "manage_everything = you can handle scheduling/messaging/automations on the owner's behalf without asking; ask_first = prepare things but wait for the owner's OK before anything goes out; hold_everything = do nothing proactive, just take messages, until the owner is back" },
        checkInFrequency: { type: "string", enum: ["none", "daily", "every_few_days", "urgent_only"], description: "How often to text the owner a status update while they're out. urgent_only = only for things that truly can't wait." },
        notes: { type: "string", description: "Freeform notes on what the owner wants handled or avoided while out, in their own words" },
      },
      required: ["active"],
    },
  },
  {
    name: "get_vacation_status",
    description: "Check whether vacation/out-of-office mode is currently active and what its settings are. Use before deciding how autonomously to act, or if the owner asks 'am I still in vacation mode'.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "set_autonomy_level",
    description: "Sets the owner's STANDING (non-vacation) autonomy level — how much Alfred can do on its own day-to-day, not just while on vacation. Use when the owner says things like 'always ask me before texting customers', 'you can handle things on your own from now on', or 'don't do anything without me'. This is separate from vacation mode (set_vacation_mode) — vacation mode temporarily overrides this while it's active, then this standing level takes over again once vacation ends.",
    input_schema: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["manage_everything", "ask_first", "hold_everything"], description: "manage_everything = act immediately, no confirmation needed; ask_first = queue anything that sends a message, spends money, or changes a schedule/crew commitment for a quick yes/no first; hold_everything = never take those actions on your own, just answer questions and take messages" },
      },
      required: ["level"],
    },
  },
  {
    name: "set_reminder",
    description: "Schedule a text reminder to be sent back to the owner at a specific future time — use for 'remind me to X at/in/on Y', or 'from now on, every day at Y, do/tell me X' (pass recurring). Resolve the due time to an exact ISO 8601 datetime yourself (you're told today's date and time in the system prompt) before calling this — never pass a vague phrase. Requires an external cron pinger to actually fire (Settings → AI Models explains the one-time setup) — mention that if the owner seems unaware.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "what to remind the owner about" },
        dueAtIso: { type: "string", description: "exact ISO 8601 datetime to send the FIRST (or only) reminder, e.g. 2026-08-23T14:00:00" },
        recurring: { type: "string", enum: ["daily", "weekly"], description: "set for 'every day'/'every week' requests — repeats indefinitely at the same time until cancelled" },
      },
      required: ["message", "dueAtIso"],
    },
  },
  {
    name: "list_reminders",
    description: "List the owner's upcoming (not-yet-sent) reminders.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cancel_reminder",
    description: "Cancel a pending reminder. Use list_reminders first to find its id if the owner doesn't give you one directly.",
    input_schema: {
      type: "object",
      properties: { reminderId: { type: "string" } },
      required: ["reminderId"],
    },
  },
  {
    name: "get_calendar_summary",
    description: "What's on the schedule over a date range — use for 'what's on my calendar/agenda', 'what's my availability this week', etc. Cross-checks CRM jobs against the REAL connected Google Calendar and reports discrepancies both ways (a job that never synced to Google, or a Google event with no matching CRM job) — always mention discrepancies if there are any, don't just report a job count.",
    input_schema: {
      type: "object",
      properties: {
        startDate: { type: "string", description: "YYYY-MM-DD, defaults to today" },
        days: { type: "number", description: "how many days forward to include, default 7" },
      },
    },
  },
  {
    name: "create_calendar_event",
    description: "Add an event to the owner's actual Google Calendar (not just a CRM job — use schedule_job for an actual service job with a customer). Use this for things like 'put a dentist appointment on my calendar Thursday at 2pm' / 'add this to the calendar'.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "HH:MM 24h" },
        durationMinutes: { type: "number", description: "default 60" },
        notes: { type: "string" },
      },
      required: ["title", "date", "time"],
    },
  },
  {
    name: "delete_calendar_event",
    description: "Delete an event from the owner's Google Calendar — use for 'delete/remove this from my calendar'. Identify by eventId (from get_calendar_summary) or by title (+ optional date) and this looks it up.",
    input_schema: {
      type: "object",
      properties: { eventId: { type: "string" }, title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD, narrows the title search" } },
    },
  },
  {
    name: "update_calendar_event",
    description: "Move or edit an existing Google Calendar event — use for 'move this to Friday' / 'change the time on X'. Identify by eventId or title, pass only the fields that changed.",
    input_schema: {
      type: "object",
      properties: {
        eventId: { type: "string" },
        title: { type: "string", description: "used to find the event if no eventId, or the new title if eventId is given" },
        date: { type: "string", description: "YYYY-MM-DD, new date if moving it" },
        time: { type: "string", description: "HH:MM 24h, new time" },
        durationMinutes: { type: "number" },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "list_job_requests",
    description: "List pending job requests from employees (an employee asked to be assigned/take on a job and is waiting on approval).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "respond_to_job_request",
    description: "Approve or deny a pending employee job request. Use list_job_requests first to find its id.",
    input_schema: {
      type: "object",
      properties: {
        requestId: { type: "string" },
        approve: { type: "boolean" },
        reason: { type: "string", description: "optional, mainly useful when denying" },
      },
      required: ["requestId", "approve"],
    },
  },
  // FEATURE — customer-facing Alfred auto-response (opt-in per customer,
  // see CustomerDetail.tsx / alfredCustomerAgent.ts) creates a row here
  // whenever a customer asks for something that needs the owner's sign-off
  // (currently: reschedule requests). These three tools are how the owner
  // resolves them from a normal text — "yes reschedule him" naturally
  // triggers approve_customer_request via the model, no rigid keyword
  // parsing needed.
  {
    name: "list_pending_customer_requests",
    description: "List customer requests awaiting your yes/no (e.g. reschedule proposals Alfred set up after a customer texted in). Use this whenever the owner replies something like 'yes', 'sure', 'that works', or asks 'what's pending' shortly after a proposal — to find out what they're actually confirming.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "approve_customer_request",
    description: "Approve a pending customer request — actually performs the action (e.g. moves the job) and texts the customer to confirm. Use list_pending_customer_requests first if you don't already have the requestId.",
    input_schema: { type: "object", properties: { requestId: { type: "string" } }, required: ["requestId"] },
  },
  {
    name: "decline_customer_request",
    description: "Decline a pending customer request and text the customer that it doesn't work, optionally with a reason.",
    input_schema: { type: "object", properties: { requestId: { type: "string" }, reason: { type: "string" } }, required: ["requestId"] },
  },
  // FEATURE — "build that autonomy level thing... every owner sets their
  // own personalized permissions." When alfredAutonomyLevel (or a
  // vacation-mode override) is "ask_first", a capability-gated tool call
  // (see SMS_TOOL_CAPABILITY) doesn't run — it's queued here instead (same
  // alfred_pending_actions table the customer-reschedule flow above
  // already uses, generalized via kind:"action_confirmation" — see
  // migration 0096). These three let the owner review/approve/decline
  // those queued actions from the SAME text thread, same shape as
  // list_pending_customer_requests/approve_customer_request above.
  {
    name: "list_pending_approvals",
    description: "List Alfred's own queued actions awaiting your approval — things Alfred wanted to do (send a text, apply a discount, reschedule a job, etc.) but held because your autonomy level is set to 'ask first'. Use when the owner asks 'what's waiting on me' or replies 'yes'/'approve' after Alfred said something was queued.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "approve_pending_action",
    description: "Approve one of Alfred's own queued actions (from list_pending_approvals) — actually performs it now. Use list_pending_approvals first if you don't already have the actionId.",
    input_schema: { type: "object", properties: { actionId: { type: "string" } }, required: ["actionId"] },
  },
  {
    name: "decline_pending_action",
    description: "Decline one of Alfred's own queued actions (from list_pending_approvals) — it will never be performed.",
    input_schema: { type: "object", properties: { actionId: { type: "string" } }, required: ["actionId"] },
  },
];

// BUG FIX — a request that ran out of the whole 75s round budget on what
// should have been one quick tool call turned out to have no per-call
// timeout at all on these two Google fetches (unlike every LLM call, which
// already has a 12s AbortController) — a hung/slow Google response could
// silently eat the entire budget by itself. 8s is generous for a normal
// Calendar API round-trip and fails fast otherwise.
const fetchWithTimeout = async (url: string, init: RequestInit, ms = 8000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

// Shared by every Calendar tool below (create/update/delete/list) — was
// previously duplicated inline just inside create_calendar_event.
const getGoogleAccessToken = async (ctx: Ctx): Promise<string | null> => {
  if (!ctx.googleRefreshToken && !ctx.googleProviderToken) return null;
  let accessToken = ctx.googleProviderToken || "";
  if (ctx.googleRefreshToken && (!ctx.googleTokenExpiresAt || Date.now() > ctx.googleTokenExpiresAt - 60000)) {
    try {
      const refreshRes = await fetchWithTimeout(`${ctx.origin}/api/google-refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: ctx.googleRefreshToken }),
      });
      const refreshData = await refreshRes.json().catch(() => null) as any;
      if (refreshRes.ok && refreshData?.access_token) accessToken = refreshData.access_token;
    } catch { /* fall through with whatever token we have; the Calendar call below will fail clearly if it's stale */ }
  }
  return accessToken || null;
};

// FEATURE — gives text-Alfred an email tool, matching the in-app chat's
// existing Gmail send (send_me_files via:"email") — text-Alfred previously
// had no email capability at all, a real cross-channel parity gap. Same raw
// Gmail API MIME-send lib/messaging.ts's sendViaGmail uses client-side,
// reimplemented here since Cloudflare Functions can't import from src/lib.
const sendGmailFromCtx = async (ctx: Ctx, to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> => {
  const accessToken = await getGoogleAccessToken(ctx);
  if (!accessToken) return { ok: false, error: "Gmail isn't connected — connect Google in Settings → Integrations to send email." };
  const mime = [`To: ${to}`, `Subject: ${subject}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, ``, html].join("\r\n");
  const raw = btoa(unescape(encodeURIComponent(mime))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  try {
    const res = await fetchWithTimeout("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    }, 12000);
    if (!res.ok) return { ok: false, error: (await res.text().catch(() => "")).slice(0, 200) };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Gmail send failed" };
  }
};

// Google's events.list, mapped down to just what the discrepancy check and
// title-lookup (delete/update by name) need.
const fetchGoogleEventsInRange = async (accessToken: string, startIso: string, endIso: string): Promise<Array<{ id: string; title: string; start: string; end: string; location: string }>> => {
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(startIso)}&timeMax=${encodeURIComponent(endIso)}&singleEvents=true&orderBy=startTime&maxResults=100`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const data = await res.json().catch(() => null) as any;
  return (data?.items || []).map((ev: any) => ({
    id: ev.id, title: ev.summary || "(No title)",
    start: ev.start?.dateTime || ev.start?.date || "", end: ev.end?.dateTime || ev.end?.date || "",
    location: ev.location || "",
  }));
};

// FEATURE — same capability gate as AlfredPage.tsx's in-app chat (Settings
// → Alfred → Capabilities), enforced here too so text-Alfred honors the
// exact same owner choices instead of being a back door around them. Same
// 16-key granular taxonomy as AlfredPage.tsx's ALFRED_TOOL_CAPABILITY (see
// that file's comment) — split from the original 6 broad buckets so an
// owner can, e.g., allow individual customer texts without also allowing a
// mass blast to the whole list.
const SMS_TOOL_CAPABILITY: Record<string, string> = {
  create_customer: "add_customers", attach_file_to_customer: "add_customers", update_customer: "add_customers",
  schedule_job: "schedule_jobs",
  reschedule_job: "modify_jobs", cancel_job: "modify_jobs", update_job_priority: "modify_jobs", add_checklist_item: "modify_jobs", attach_file_to_job: "modify_jobs",
  assign_employee: "manage_crew", request_employee: "manage_crew", respond_to_job_request: "manage_crew", approve_customer_request: "manage_crew", decline_customer_request: "manage_crew",
  create_estimate: "create_quotes", create_invoice: "create_quotes", mark_invoice_paid: "create_quotes", set_estimate_deposit: "create_quotes",
  send_estimate: "send_quotes", send_invoice: "send_quotes",
  notify_all_customers: "mass_messaging", prepare_bulk_text: "mass_messaging", send_bulk_text: "mass_messaging", set_birthday_offer: "mass_messaging",
  schedule_jobs_bulk: "schedule_jobs", create_customers_bulk: "add_customers", update_customers_bulk: "add_customers",
  create_campaign: "automations",
  text_customer: "message_customers", text_phone_number: "message_customers",
  text_supplier: "message_suppliers", email_supplier: "message_suppliers", contact_general_supplier: "message_suppliers",
  send_email_via_gmail: "send_email",
  text_me_document: "send_files", send_me_files: "send_files",
  create_promotion: "automations", enable_review_request_automation: "automations",
  respond_to_review: "automations",
  create_sop: "sops",
  set_vacation_mode: "vacation_mode",
  create_calendar_event: "calendar", update_calendar_event: "calendar", delete_calendar_event: "calendar",
  move_candidate_phase: "manage_crew",
};
// Legacy -> granular migration, identical mapping to AlfredPage.tsx's
// ALFRED_LEGACY_GROUP — an owner who previously turned off one of the 6 old
// broad categories should have every new key under it stay off too, rather
// than silently re-enabling because the setting's key name changed.
const SMS_LEGACY_GROUP: Record<string, string> = {
  add_customers: "customers",
  schedule_jobs: "jobs", modify_jobs: "jobs", manage_crew: "jobs",
  create_quotes: "estimates", send_quotes: "estimates",
  message_customers: "messaging", mass_messaging: "messaging", message_suppliers: "messaging", send_email: "messaging", send_files: "messaging",
  automations: "automations", sops: "automations", vacation_mode: "automations",
  calendar: "calendar", drive_tasks: "calendar",
};
const effectiveSmsCapability = (ctx: Ctx, key: string): boolean => {
  const raw = ctx.alfredCapabilities || {};
  if (raw[key] !== undefined) return raw[key];
  const legacy = SMS_LEGACY_GROUP[key];
  return legacy && raw[legacy] !== undefined ? raw[legacy] : true;
};

// FEATURE — autonomy level (see set_autonomy_level/set_vacation_mode tool
// defs above). Resolution order: an ACTIVE vacation-mode window's own
// autonomyLevel is a temporary override (matches the App.tsx check-in
// cadence logic and the twilio-sms-webhook.ts front-desk gate — same
// active+date-range check, kept consistent across all three); otherwise
// the owner's standing (non-vacation) alfredAutonomyLevel applies.
// Defaulting a MISSING value to "manage_everything" (not "ask_first",
// even though the system prompt elsewhere describes "ask_first" as the
// assumed default for PHRASING purposes) is deliberate — every account
// that existed before this setting did is unset, and enforcement must
// never start blocking/queuing actions for them just because they never
// visited this setting.
type AutonomyLevel = "manage_everything" | "ask_first" | "hold_everything";
const resolveEffectiveAutonomy = (ctx: Ctx): AutonomyLevel => {
  const vac = ctx.vacationMode;
  if (vac?.active && vac.autonomyLevel) {
    const inWindow = !vac.startDate || !vac.endDate || (today() >= vac.startDate && today() <= vac.endDate);
    if (inWindow) return vac.autonomyLevel as AutonomyLevel;
  }
  return (ctx.alfredAutonomyLevel as AutonomyLevel) || "manage_everything";
};
// Tools that must NEVER be autonomy-gated even though they (or their
// capability) touch settings/approvals — gating them would deadlock the
// owner out of ever changing their own mind (hold_everything blocking the
// very tool that turns hold_everything off) or out of clearing their own
// approval queue (ask_first blocking the tools that resolve ask_first
// items).
const AUTONOMY_EXEMPT_TOOLS = new Set([
  "set_vacation_mode", "set_autonomy_level",
  "list_pending_approvals", "approve_pending_action", "decline_pending_action",
  "list_pending_customer_requests", "approve_customer_request", "decline_customer_request",
]);
// Short, plain-English description of what a gated tool call would do —
// shown to the owner in the approval queue and in Alfred's own "queued
// for your approval" reply. Falls back to a generic description for any
// gated tool not called out by name here (still functional, just less
// specific — safer than throwing on an unrecognized name).
const describeActionForOwner = (name: string, input: Record<string, any>): string => {
  switch (name) {
    case "text_customer": case "text_phone_number": return `text "${String(input.message || "").slice(0, 80)}" to ${input.phone || input.customerName || "a customer"}`;
    case "notify_all_customers": return `text every customer: "${String(input.message || "").slice(0, 80)}"`;
    case "send_estimate": return `send estimate ${input.estimateId || ""} to the customer`;
    case "send_invoice": return `send invoice ${input.invoiceId || ""} to the customer`;
    case "reschedule_job": return `reschedule job ${input.jobId || ""} to ${input.newDate || input.requestedDate || "a new date"}`;
    case "cancel_job": return `cancel job ${input.jobId || ""}`;
    case "assign_employee": return `assign an employee to job ${input.jobId || ""}`;
    case "request_employee": return `request an employee for job ${input.jobId || ""}`;
    case "mark_invoice_paid": return `mark invoice ${input.invoiceId || ""} as paid`;
    case "respond_to_review": return `post a reply to a review`;
    case "text_supplier": case "email_supplier": case "contact_general_supplier": return `contact a supplier: "${String(input.message || "").slice(0, 80)}"`;
    case "send_email_via_gmail": return `send an email: "${input.subject || ""}"`;
    case "delete_calendar_event": return `delete a calendar event`;
    case "create_promotion": return `create a promotion${input.name ? ": " + input.name : ""}`;
    default: return `run "${name}"`;
  }
};
const executeToolCore = async (ctx: Ctx, name: string, input: Record<string, any>): Promise<any> => {
  try {
    const __cap = SMS_TOOL_CAPABILITY[name];
    if (__cap && effectiveSmsCapability(ctx, __cap) === false) {
      return { error: `The owner has turned off Alfred's "${__cap}" capability in Settings → Alfred → Capabilities — this action can't be performed until they turn it back on.` };
    }
    switch (name) {
      case "get_business_stats": {
        const [jobs, estimates] = await Promise.all([
          sbGet(ctx, `jobs?select=id,status,amount,completedAt,createdAt${ownerScope(ctx)}&limit=2000`),
          sbGet(ctx, `estimates?select=id,status,invoiced,total,paidAt,createdAt${ownerScope(ctx)}&limit=2000`),
        ]);
        const monthPrefix = today().slice(0, 7);
        const activeJobs = jobs.filter((j: any) => j.status === "scheduled" || j.status === "in_progress").length;
        const pendingEst = estimates.filter((e: any) => !e.invoiced && e.status !== "declined").length;
        const revenueMonth = jobs.filter((j: any) => (j.completedAt || "").startsWith(monthPrefix)).reduce((s: number, j: any) => s + (Number(j.amount) || 0), 0);
        const completedMonth = jobs.filter((j: any) => (j.completedAt || "").startsWith(monthPrefix)).length;
        return { success: true, activeJobs, pendingEstimates: pendingEst, revenueThisMonth: revenueMonth, jobsCompletedThisMonth: completedMonth };
      }
      // FEATURE — "Alfred should literally know virtually everything about
      // the company it's working for." Real service/pricing catalog and
      // core company facts, instead of Alfred having to guess or only know
      // whatever happened to be in its system prompt.
      case "list_services": {
        const rows = await sbGet(ctx, `services?select=name,price,category,taxable${ownerScope(ctx)}&limit=200`);
        if (rows.length === 0) return { success: true, count: 0, services: [], note: "No services set up yet (Settings → Services)." };
        return { success: true, count: rows.length, services: rows.map((s: any) => ({ name: s.name, price: s.price, category: s.category, taxable: s.taxable !== false })) };
      }
      case "get_company_info": {
        const [settingsRows, custCount, empCount, vehicleCount] = await Promise.all([
          sbGet(ctx, `app_settings?select=data${ownerScope(ctx)}&limit=1`),
          sbGet(ctx, `customers?select=id${ownerScope(ctx)}&limit=5000`),
          sbGet(ctx, `employees?select=id,status${ownerScope(ctx)}&limit=200`),
          sbGet(ctx, `vehicles?select=id${ownerScope(ctx)}&limit=200`).catch(() => []),
        ]);
        const s = settingsRows[0]?.data || {};
        return {
          success: true,
          companyName: ctx.companyName,
          address: ctx.companyAddress || s.companyAddress || null,
          phone: s.companyPhone || null,
          taxRate: s.taxRate != null ? `${s.taxRate}%` : null,
          state: s.companyState || null,
          totalCustomers: custCount.length,
          activeEmployees: empCount.filter((e: any) => e.status === "active").length,
          fleetSize: Array.isArray(vehicleCount) ? vehicleCount.length : 0,
        };
      }
      case "get_weather": {
        if (!ctx.owmKey) return { success: false, error: "No weather API key configured (Settings → Company → Weather)." };
        // Same "derive from company address if no explicit weatherLocation"
        // fallback as src/lib/weather.ts's deriveWeatherLocation — Cloudflare
        // Functions can't import from src/, so this mirrors that logic rather
        // than sharing it directly.
        let location = (ctx.weatherLocation || "").trim();
        if (!location) {
          const parts = (ctx.companyAddress || "").split(",").map(s => s.trim()).filter(Boolean);
          if (parts.length >= 2) {
            const city = parts[1];
            const stateSeg = parts[parts.length - 1].replace(/\d+/g, "").trim();
            location = stateSeg ? `${city},${stateSeg}` : city;
          }
        }
        if (!location) location = "York,PA,US";
        const locParam = /^\d{5}$/.test(location) ? `zip=${location},US` : `q=${encodeURIComponent(location)}`;
        const res = await fetchWithTimeout(`https://api.openweathermap.org/data/2.5/weather?${locParam}&units=imperial&appid=${ctx.owmKey}`, {}, 8000);
        if (!res.ok) {
          const err = await res.json().catch(() => ({} as any));
          return { success: false, error: err?.message || `Weather API error ${res.status}` };
        }
        const data = await res.json() as any;
        return {
          success: true,
          location,
          tempF: Math.round(data.main?.temp),
          feelsLikeF: Math.round(data.main?.feels_like),
          condition: data.weather?.[0]?.description || "",
          windMph: Math.round(data.wind?.speed),
          humidity: data.main?.humidity,
        };
      }
      case "list_jobs": {
        let rows = await sbGet(ctx, `jobs?select=id,customerName,status,scheduledDate,scheduledTime,address,crew${ownerScope(ctx)}&limit=200`);
        if (input.status && input.status !== "all") rows = rows.filter((j: any) => j.status === input.status);
        if (input.date) rows = rows.filter((j: any) => j.scheduledDate === input.date);
        rows.sort((a: any, b: any) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
        return { success: true, jobs: rows.slice(0, 25).map((j: any) => ({ id: j.id, customer: j.customerName, status: j.status, date: j.scheduledDate, time: j.scheduledTime, address: j.address })) };
      }
      case "get_employee_status": {
        const emps = await sbGet(ctx, `employees?select=id,firstName,lastName,status,dayClockInAt${ownerScope(ctx)}&limit=200`);
        const onShift = emps.filter((e: any) => e.status === "active" && e.dayClockInAt);
        if (onShift.length === 0) return { success: true, summary: "No one is currently clocked in." };
        // FIX — this used to select a "checklist" column that doesn't exist
        // (the real columns are preChecklist/duringChecklist/postChecklist —
        // see docs/ARCHITECTURE.md), so PostgREST 400'd the WHOLE query on every call
        // and sbGet silently swallowed that into an empty array — every
        // on-shift employee always reported as "not currently on a job" no
        // matter what, which is exactly the bug reported: an employee who
        // had genuinely arrived at a job still came back as not on one.
        // Also broadened the match itself: a field employee's job goes
        // "in_progress" OR just carries an arrivedAt timestamp (the "I'm
        // Here" button) — status=eq.in_progress alone missed that case too,
        // same fix already applied to Dashboard.tsx's Live Team View.
        const jobs = await sbGet(ctx, `jobs?select=id,customerName,status,crew,preChecklist,duringChecklist,postChecklist,scheduledDate,arrivedAt${ownerScope(ctx)}&status=neq.completed&status=neq.cancelled&limit=200`);
        const report = onShift.map((e: any) => {
          const name = `${e.firstName || ""} ${e.lastName || ""}`.trim();
          const job = jobs.find((j: any) => Array.isArray(j.crew) && j.crew.includes(e.id) && (j.status === "in_progress" || !!j.arrivedAt));
          if (!job) return `${name}: clocked in, not currently on a job`;
          const checklist = [...(job.preChecklist || []), ...(job.duringChecklist || []), ...(job.postChecklist || [])];
          const done = checklist.filter((c: any) => c?.done).length;
          const pct = checklist.length ? Math.round((done / checklist.length) * 100) : null;
          return `${name}: on ${job.customerName}'s job${pct !== null ? ` (${pct}% checklist complete)` : ""}`;
        });
        return { success: true, summary: report.join("; ") };
      }
      case "schedule_job": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        let crew: string[] = [];
        if (input.employeeName) {
          const emp = await findEmployeeByName(ctx, input.employeeName);
          if (!emp) return { error: `No employee found matching "${input.employeeName}".` };
          crew = [emp.id];
        }
        if (input.isRecurring && !input.recurringFreq) return { error: "recurringFreq is required when isRecurring is true." };
        // FEATURE — "allow me to create a custom checklist and add
        // specific instructions... schedule recurring jobs, commercial
        // jobs, and tags." Same JobChecklistItem shape duringChecklist
        // uses everywhere else (JobDetailModal, EmployeePortal) — a plain
        // string list from Alfred becomes real, checkable field-portal
        // checklist items, not just text buried in notes.
        const checklist = Array.isArray(input.checklist) && input.checklist.length > 0
          ? input.checklist.map((label: string) => ({ id: crypto.randomUUID(), label, done: false }))
          : undefined;
        const job: Record<string, unknown> = {
          id: crypto.randomUUID(),
          customerId: cust.id,
          customerName: `${cust.firstName || ""} ${cust.lastName || ""}`.trim(),
          status: "scheduled",
          scheduledDate: input.date,
          scheduledTime: input.time || "",
          crew,
          notes: input.notes || "",
          jobType: input.jobType === "commercial" ? "commercial" : "residential",
          createdAt: new Date().toISOString(),
        };
        if (input.internalNotes) job.internalNotes = input.internalNotes;
        if (checklist) job.duringChecklist = checklist;
        if (Array.isArray(input.tags) && input.tags.length > 0) job.tags = input.tags;
        if (input.isRecurring) { job.isRecurring = true; job.recurringMode = "preset"; job.recurringFreq = input.recurringFreq; }
        const res = await sbWrite(ctx, "jobs", "POST", job);
        if (!res.ok) return { error: res.error };
        return { success: true, jobId: job.id, customer: job.customerName, date: job.scheduledDate, jobType: job.jobType, recurring: !!input.isRecurring, checklistItems: checklist?.length || 0 };
      }
      case "reschedule_job": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const patch: Record<string, unknown> = { scheduledDate: input.date };
        if (input.time) patch.scheduledTime = input.time;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        if (input.notify === "sms") {
          const cust = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(job.customerId)}&select=phone,firstName,lastName`))[0];
          if (cust?.phone) {
            const smsRes = await sendSms(ctx, cust.phone, `Hi ${cust.firstName || ""}, your ${ctx.companyName} appointment has been moved to ${input.date}${input.time ? " at " + input.time : ""}. Let us know if that doesn't work!`, false, { name: `${cust.firstName || ""} ${cust.lastName || ""}`.trim(), customerId: job.customerId });
            if (!smsRes.ok) return { success: true, jobId: job.id, notifyError: smsRes.error };
          }
        }
        return { success: true, jobId: job.id, newDate: input.date };
      }
      case "assign_employee": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const emp = await findEmployeeByName(ctx, input.employeeName);
        if (!emp) return { error: `No employee found matching "${input.employeeName}".` };
        const crew = Array.from(new Set([...(Array.isArray(job.crew) ? job.crew : []), emp.id]));
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ crew }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        // Push onto the employee's own Google Calendar if connected — see
        // _lib/employeeCalendarSync.ts. Fire-and-forget, never blocks the
        // assignment that already succeeded above.
        syncEmployeeJobToCalendar(ctx.env, {
          employeeId: emp.id, ownerId: ctx.ownerId, jobId: job.id, action: "upsert",
          title: (job.customerName ? job.customerName + " — " : "") + "Service",
          date: job.scheduledDate, time: job.scheduledTime, location: job.address,
          origin: ctx.origin,
        }).catch(() => {});
        return { success: true, jobId: job.id, employee: `${emp.firstName} ${emp.lastName}` };
      }
      case "create_customer": {
        // Same dedupe as the in-app Alfred's create_customer (AlfredPage.tsx)
        // — a re-asked/retried request used to create a second duplicate
        // customer row for the same person every time, matched on phone
        // first since it's the more reliable key.
        const dupPhone = (input.phone || "").replace(/\D/g, "");
        if (dupPhone || input.firstName) {
          const existing = await sbGet(ctx, `customers?select=id,firstName,lastName,phone${ownerScope(ctx)}&limit=2000`);
          const match = existing.find((c: any) =>
            (dupPhone && (c.phone || "").replace(/\D/g, "") === dupPhone) ||
            (!dupPhone && `${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase() === `${input.firstName || ""} ${input.lastName || ""}`.trim().toLowerCase())
          );
          if (match) return { success: true, customerId: match.id, note: "This customer already existed — reused the existing record instead of creating a duplicate." };
        }
        const row = { id: crypto.randomUUID(), firstName: input.firstName, lastName: input.lastName, phone: input.phone || "", email: input.email || "", address: input.address || "", totalSpent: 0, createdAt: new Date().toISOString() };
        const res = await sbWrite(ctx, "customers", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, customerId: row.id };
      }
      case "text_customer": {
        if ((ctx.directSendsThisTurn = (ctx.directSendsThisTurn || 0) + 1) > 3) return { error: "Refused: that's more than 3 separate texts in one go. Use prepare_bulk_text so the owner can approve the list first." };
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        if (!cust.phone) return { error: `${input.customerName} has no phone number on file.` };
        const res = await sendSms(ctx, cust.phone, input.message, false, { name: `${cust.firstName || ""} ${cust.lastName || ""}`.trim(), customerId: cust.id });
        if (!res.ok) return { error: res.error };
        return { success: true, sentTo: `${cust.firstName} ${cust.lastName}` };
      }
      case "text_phone_number": {
        if ((ctx.directSendsThisTurn = (ctx.directSendsThisTurn || 0) + 1) > 3) return { error: "Refused: that's more than 3 separate texts in one go. Use prepare_bulk_text so the owner can approve the list first." };
        if (!input.phone) return { error: "phone required" };
        if (!input.message) return { error: "message required" };
        const res = await sendSms(ctx, input.phone, input.message, false, { name: input.label || input.phone });
        if (!res.ok) return { error: res.error };
        return { success: true, sentTo: input.label || input.phone };
      }
      // Never sends directly any more — drafts it for the owner's OK
      // (see prepare_bulk_text / send_bulk_text).
      case "notify_all_customers":
        return executeToolCore(ctx, "prepare_bulk_text", { message: input.message, audience: input.tag ? "tag" : "all", tag: input.tag, campaignName: input.campaignName });
      case "create_promotion": {
        if (!input.name || !input.discountType || input.discountValue == null) return { error: "name, discountType, and discountValue required" };
        const code = (input.name as string).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10) || "SAVE" + Math.floor(Math.random() * 1000);
        const validFrom = today();
        const validUntil = new Date(Date.now() + (Number(input.expiresInDays) || 30) * 86400000).toISOString().slice(0, 10);
        // BUG FIX — written with snake_case names (discount_type,
        // valid_until…) the promotions table doesn't have, so every coupon
        // Alfred "created" was rejected. Same fields PromotionsPage saves.
        const row = {
          id: crypto.randomUUID(), owner_id: ctx.ownerId, name: input.name, code,
          discountType: input.discountType === "fixed" ? "fixed" : "percent", discountValue: Number(input.discountValue) || 0,
          validFrom, validTo: validUntil, redeemedCount: 0, audience: "all", status: "active", channel: "sms",
          createdAt: today(),
        };
        const res = await sbWrite(ctx, "promotions", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, promotionId: row.id, code, name: input.name, discount: `${input.discountValue}${input.discountType === "percent" ? "%" : "$"} off`, validUntil };
      }
      case "list_overdue_invoices": {
        const [rows, customers] = await Promise.all([
          sbGet(ctx, `estimates?select=id,customerId,total,invoiced,paidAt,invoicedAt${ownerScope(ctx)}&invoiced=eq.true&limit=200`),
          sbGet(ctx, `customers?select=id,firstName,lastName${ownerScope(ctx)}&limit=1000`),
        ]);
        const overdue = rows.filter((e: any) => !e.paidAt);
        if (overdue.length === 0) return { success: true, summary: "No overdue invoices." };
        const custName = (id: string) => { const c = customers.find((c: any) => c.id === id); return c ? `${c.firstName || ""} ${c.lastName || ""}`.trim() : "Unknown"; };
        return { success: true, invoices: overdue.slice(0, 15).map((e: any) => ({ id: e.id, customer: custName(e.customerId), amount: e.total, invoicedAt: e.invoicedAt })) };
      }
      case "send_invoice": {
        let inv: any = null;
        if (input.invoiceId) {
          inv = (await sbGet(ctx, `estimates?id=eq.${encodeURIComponent(input.invoiceId)}&select=id,customerId,total,paidAt,depositRequired,depositType`))[0];
        } else if (input.customerName) {
          const cust = await findCustomerByName(ctx, input.customerName);
          if (!cust) return { error: `No customer found matching "${input.customerName}".` };
          const rows = await sbGet(ctx, `estimates?customerId=eq.${encodeURIComponent(cust.id)}&invoiced=eq.true&select=id,customerId,total,paidAt,invoicedAt,createdAt,depositRequired,depositType${ownerScope(ctx)}`);
          const unpaid = rows.filter((e: any) => !e.paidAt).sort((a: any, b: any) => ((b.invoicedAt || b.createdAt || "") + b.id).localeCompare((a.invoicedAt || a.createdAt || "") + a.id));
          inv = unpaid[0];
          if (!inv) return { error: `${input.customerName} has no unpaid invoice on file.` };
        } else {
          return { error: "Need either invoiceId or customerName." };
        }
        if (!inv) return { error: "Invoice not found." };
        if (inv.paidAt) return { error: "That invoice is already paid." };
        const cust = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(inv.customerId)}&select=phone,firstName,lastName`))[0];
        if (!cust?.phone) return { error: "That customer has no phone number on file." };
        const link = `${ctx.origin}/#/estimate/${inv.id}`;
        const invDeposit = Number(inv.depositRequired) > 0 ? depositDollars({ depositRequired: Number(inv.depositRequired), depositType: inv.depositType || "amount" }, Number(inv.total) || 0) : 0;
        const invDepositText = invDeposit > 0 ? ` A deposit of $${invDeposit.toFixed(2)} is due now; the rest ($${Math.max(0, Number(inv.total) - invDeposit).toFixed(2)}) after service.` : "";
        const res = await sendSms(ctx, cust.phone, `Hi ${cust.firstName || ""}, here's your invoice from ${ctx.companyName} for $${Number(inv.total || 0).toFixed(2)}.${invDepositText} View and pay: ${link}`, false, { name: `${cust.firstName || ""} ${cust.lastName || ""}`.trim(), customerId: inv.customerId });
        if (!res.ok) return { error: res.error };
        return { success: true, sentTo: `${cust.firstName} ${cust.lastName}`, amount: inv.total, ...(invDeposit > 0 ? { depositDueNow: invDeposit } : {}), link };
      }
      // FEATURE — "mark the Jones invoice as paid, they paid me cash." A
      // genuinely common request Alfred had no tool for at all — same
      // write shape as InvoicesPage.tsx's own markPaid (paidAt + status
      // "approved" on the estimate, paymentStatus "Paid" mirrored onto the
      // linked job if there is one).
      case "mark_invoice_paid": {
        let inv: any = null;
        if (input.invoiceId) {
          inv = (await sbGet(ctx, `estimates?id=eq.${encodeURIComponent(input.invoiceId)}&select=id,customerId,jobId,total,paidAt`))[0];
        } else if (input.customerName) {
          const cust = await findCustomerByName(ctx, input.customerName);
          if (!cust) return { error: `No customer found matching "${input.customerName}".` };
          const rows = await sbGet(ctx, `estimates?customerId=eq.${encodeURIComponent(cust.id)}&invoiced=eq.true&select=id,customerId,jobId,total,paidAt,invoicedAt${ownerScope(ctx)}`);
          const unpaid = rows.filter((e: any) => !e.paidAt).sort((a: any, b: any) => (b.invoicedAt || "").localeCompare(a.invoicedAt || ""));
          inv = unpaid[0];
          if (!inv) return { error: `${input.customerName} has no unpaid invoice on file.` };
        } else {
          return { error: "Need either invoiceId or customerName." };
        }
        if (!inv) return { error: "Invoice not found." };
        if (inv.paidAt) return { success: true, note: "That invoice was already marked paid." };
        const paidAt = new Date().toISOString().slice(0, 10);
        const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(inv.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ paidAt, status: "approved" }),
        });
        if (!res.ok || (await res.clone().json().catch(() => [])).length === 0) return { error: "Couldn't mark that invoice paid (permissions or it no longer exists)." };
        if (inv.jobId) {
          fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(inv.jobId)}`, {
            method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ paymentStatus: "Paid" }),
          }).catch(() => {});
        }
        return { success: true, invoiceId: inv.id, amount: inv.total, paidAt };
      }
      case "cancel_job": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const patch = { status: "cancelled", cancelReason: input.reason || "" };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        let notifyWarning: string | undefined;
        if (input.notify === "sms") {
          const cust = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(job.customerId)}&select=phone,firstName,lastName`))[0];
          if (cust?.phone) {
            const msg = `Hi ${cust.firstName || ""}, your ${ctx.companyName} appointment${job.scheduledDate ? " on " + job.scheduledDate : ""} has been cancelled.${input.reason ? ` (${input.reason})` : ""} Reach out any time to reschedule.`;
            const smsRes = await sendSms(ctx, cust.phone, msg, false, { name: `${cust.firstName || ""} ${cust.lastName || ""}`.trim(), customerId: job.customerId });
            if (!smsRes.ok) notifyWarning = smsRes.error;
          } else {
            notifyWarning = "customer has no phone on file";
          }
        }
        return { success: true, jobId: job.id, ...(notifyWarning ? { notifyWarning } : {}) };
      }
      case "get_job_details": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const full = (await sbGet(ctx, `jobs?id=eq.${encodeURIComponent(job.id)}&select=id,customerId,customerName,address,scheduledDate,scheduledTime,status,amount,priority,notes,crew,preChecklist,duringChecklist,postChecklist,photos,paymentStatus,invoiced,paidAt`))[0];
        if (!full) return { error: "Job not found." };
        const emps = full.crew?.length ? await sbGet(ctx, `employees?select=id,firstName,lastName${ownerScope(ctx)}&limit=200`) : [];
        const crewNames = (full.crew || []).map((id: string) => { const e = emps.find((x: any) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; });
        const allCk = [...(full.preChecklist || []), ...(full.duringChecklist || []), ...(full.postChecklist || [])];
        return {
          jobId: full.id, customer: full.customerName, address: full.address, date: full.scheduledDate, time: full.scheduledTime,
          status: full.status, amount: full.amount, priority: full.priority, notes: full.notes, crew: crewNames,
          checklist: { totalItems: allCk.length, completed: allCk.filter((c: any) => c?.done).length },
          photoCount: (full.photos || []).length,
          paymentStatus: full.paymentStatus || (full.invoiced ? (full.paidAt ? "Paid" : "Invoiced, unpaid") : "Not invoiced"),
        };
      }
      case "add_checklist_item": {
        if (!input.jobId || !input.item) return { error: "jobId and item required" };
        const job = (await sbGet(ctx, `jobs?id=eq.${encodeURIComponent(input.jobId)}&select=preChecklist,duringChecklist,postChecklist`))[0];
        if (!job) return { error: "Job not found" };
        const phase = input.phase === "during" ? "duringChecklist" : input.phase === "post" ? "postChecklist" : "preChecklist";
        const updated = [...(job[phase] || []), { id: crypto.randomUUID(), label: input.item, done: false }];
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(input.jobId)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ [phase]: updated }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, added: input.item, phase };
      }
      case "update_job_priority": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ priority: input.priority }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, jobId: job.id, priority: input.priority };
      }
      // Whole-CRM search — see src/lib/customerAudit.ts.
      case "search_customers": {
        const all = await sbGetAll(ctx, `customers?select=*${ownerScope(ctx)}`);
        const r = auditSearch(all, String(input.query || ""), 15);
        if (!r.total) return { success: true, count: 0, customersChecked: all.length, note: "No one matched." };
        return { success: true, count: r.total, customersChecked: all.length, customers: r.results.map(x => ({ id: x.id, name: x.name, phone: x.phone, email: x.email, address: x.address, matchedOn: x.matched })) };
      }
      case "find_duplicate_customers": {
        const all = await sbGetAll(ctx, `customers?select=*${ownerScope(ctx)}`);
        const r = findDuplicateCustomers(all, { includePossible: input.includePossible !== false });
        return { success: true, customersChecked: r.customersChecked, groupsFound: r.groups.length, groups: r.groups.slice(0, 30).map(g => ({ strength: g.strength, reason: g.reason, names: g.customers.map(c => c.name) })) };
      }
      case "customers_missing_info": {
        const all = await sbGetAll(ctx, `customers?select=*${ownerScope(ctx)}`);
        const r = customersMissingInfo(all, Array.isArray(input.fields) ? input.fields : undefined, 25);
        return { success: true, ...r, customers: r.customers.map(c => `${c.name}: missing ${c.missing.join(", ")}`) };
      }
      case "filter_customers": {
        const [all, jb] = await Promise.all([
          sbGetAll(ctx, `customers?select=*${ownerScope(ctx)}`),
          sbGetAll(ctx, `jobs?select=customerId,scheduledDate,completedAt,status${ownerScope(ctx)}`),
        ]);
        const r = filterCustomers(all, jb, input || {}, 30);
        return { success: true, total: r.total, customersChecked: all.length, customers: r.customers.map(c => `${c.name}${c.phone ? " " + c.phone : ""}${c.lastService ? " · last service " + c.lastService : ""}${c.totalSpent ? " · $" + c.totalSpent : ""}`) };
      }
      case "get_customer_details": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        const jobs = await sbGet(ctx, `jobs?customerId=eq.${encodeURIComponent(cust.id)}&select=scheduledDate,status,amount${ownerScope(ctx)}&order=scheduledDate.desc&limit=5`);
        const full = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(cust.id)}&select=totalSpent,address`))[0];
        return {
          success: true, name: `${cust.firstName} ${cust.lastName}`.trim(), phone: cust.phone, email: cust.email,
          address: full?.address, totalSpent: full?.totalSpent || 0,
          recentJobs: jobs.map((j: any) => ({ date: j.scheduledDate, status: j.status, amount: j.amount })),
        };
      }
      case "get_customer_documents": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        const docs = Array.isArray(cust.documents) ? cust.documents : [];
        if (docs.length === 0) return { success: true, name: `${cust.firstName} ${cust.lastName}`.trim(), documents: [], note: "No documents on file for this customer." };
        return {
          success: true, name: `${cust.firstName} ${cust.lastName}`.trim(),
          documents: docs.map((d: any) => ({ name: d.name, category: d.category, uploadedAt: d.uploadedAt, textable: !!d.url })),
        };
      }
      case "text_me_document": {
        if (!ctx.fromPhone) return { error: "Don't know which number to text back." };
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        const docs = Array.isArray(cust.documents) ? cust.documents : [];
        const q = String(input.documentName || "").toLowerCase().trim();
        const doc = docs.find((d: any) => (d.name || "").toLowerCase() === q) || docs.find((d: any) => (d.name || "").toLowerCase().includes(q));
        if (!doc) return { error: `No document matching "${input.documentName}" found for ${cust.firstName}. On file: ${docs.map((d: any) => d.name).join(", ") || "none"}.` };
        if (!doc.url) return { error: `"${doc.name}" was uploaded before cloud sync and only exists on the device that added it — can't text it from here. Re-upload it in the customer's Document Vault to fix this for next time.` };
        const res = await sendSms(ctx, ctx.fromPhone, `${doc.name} — ${cust.firstName} ${cust.lastName}`, true, undefined, doc.url);
        if (!res.ok) return { error: res.error };
        return { success: true, sent: doc.name };
      }
      // FEATURE — "do you remember this client? send me the PDFs/photos for
      // this job" / "email me anything in the vault for them." Mirrors the
      // in-app chat's send_me_files tool (AlfredPage.tsx) for cross-channel
      // parity — pulls from both the Document Vault AND job photos/videos,
      // delivers via text (same pattern text_me_document uses) or email
      // (new — see sendGmailFromCtx above).
      case "send_me_files": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        const docs = Array.isArray(cust.documents) ? cust.documents : [];
        const q = String(input.fileQuery || "").toLowerCase().trim();
        const matchedDocs = docs.filter((d: any) => d.url && (!q || (d.name || "").toLowerCase().includes(q)));
        const custJobs = await sbGet(ctx, `jobs?customerId=eq.${encodeURIComponent(cust.id)}&select=id,address,photos,videos${ownerScope(ctx)}${input.jobId ? `&id=eq.${encodeURIComponent(input.jobId)}` : ""}`);
        const jobPhotos = (custJobs || []).flatMap((j: any) => (j.photos || []).filter((p: any) => p?.url).map((p: any) => ({ name: `Photo — ${j.address || "job"}`, url: p.url })));
        const jobVideos = (custJobs || []).flatMap((j: any) => (j.videos || []).filter((v: any) => v?.url).map((v: any) => ({ name: `Video — ${j.address || "job"}`, url: v.url })));
        const files = [...matchedDocs.map((d: any) => ({ name: d.name, url: d.url })), ...jobPhotos, ...jobVideos];
        if (files.length === 0) return { error: `No files with a cloud-synced URL found for ${cust.firstName}${input.jobId ? " on that job" : ""}${q ? ` matching "${input.fileQuery}"` : ""}. On file (docs): ${docs.map((d: any) => d.name).join(", ") || "none"}.` };
        const via = input.via === "email" ? "email" : "text";
        if (via === "email") {
          if (!ctx.myEmail) return { error: "No owner email saved yet — add one in Settings → Company first." };
          const html = `<p>Here's everything on file for ${cust.firstName} ${cust.lastName}:</p><ul>` + files.map((f: any) => `<li><a href="${f.url}">${f.name || "View file"}</a></li>`).join("") + `</ul>`;
          const res = await sendGmailFromCtx(ctx, ctx.myEmail, `Files — ${cust.firstName} ${cust.lastName}`, html);
          if (!res.ok) return { error: res.error };
          return { success: true, sentCount: files.length, via: "email" };
        }
        if (!ctx.fromPhone) return { error: "Don't know which number to text back." };
        const body = `Files for ${cust.firstName} ${cust.lastName}:\n` + files.map((f: any) => `${f.name}: ${f.url}`).join("\n");
        const res = await sendSms(ctx, ctx.fromPhone, body, true);
        if (!res.ok) return { error: res.error };
        return { success: true, sentCount: files.length, via: "text" };
      }
      // FEATURE — cross-channel parity with the in-app chat's text_supplier/
      // email_supplier/check_stock (AlfredPage.tsx). Reads the new
      // `chemicals` table (migration 0056) — this data used to be
      // localStorage-only, so text-Alfred had no way to see it at all.
      // Same sandboxing as the in-app version: outreach only, never places
      // an order or moves money — this app has no vendor-payment
      // infrastructure to automate beyond that regardless.
      case "check_stock": {
        const q = String(input.itemName || "").toLowerCase().trim();
        const all = await sbGet(ctx, `chemicals?select=name,stock,unit,reorderLevel,suppliers${ownerScope(ctx)}&limit=500`);
        const pool = q ? all.filter((c: any) => (c.name || "").toLowerCase().includes(q)) : all;
        if (pool.length === 0) return { error: q ? `No item found matching "${input.itemName}".` : "No chemicals/equipment on file yet." };
        const low = pool.filter((c: any) => Number(c.stock) <= Number(c.reorderLevel));
        return {
          success: true,
          items: pool.map((c: any) => ({ name: c.name, stock: c.stock, unit: c.unit, reorderLevel: c.reorderLevel, needsReorder: Number(c.stock) <= Number(c.reorderLevel), suppliers: (c.suppliers || []).map((s: any) => s.name) })),
          lowStockCount: low.length,
          note: low.length > 0 ? `${low.length} item(s) at or below reorder level: ${low.map((c: any) => c.name).join(", ")}. Ask before texting/emailing a supplier — never contact one without explicit go-ahead on the exact message.` : "Everything is above its reorder level.",
        };
      }
      case "text_supplier": {
        if (!ctx.fromPhone) return { error: "Don't know which number to text back." };
        const items = await sbGet(ctx, `chemicals?select=name,suppliers${ownerScope(ctx)}&limit=500`);
        const item = items.find((c: any) => (c.name || "").toLowerCase().trim() === String(input.itemName || "").toLowerCase().trim())
          || items.find((c: any) => (c.name || "").toLowerCase().includes(String(input.itemName || "").toLowerCase().trim()));
        if (!item) return { error: `No inventory item found named "${input.itemName}".` };
        const suppliers = (item.suppliers || []).filter((s: any) => s.phone);
        if (suppliers.length === 0) return { error: `"${item.name}" has no supplier phone number on file — add one in Inventory & Equipment first.` };
        const supplier = input.supplierName ? suppliers.find((s: any) => (s.name || "").toLowerCase().includes(String(input.supplierName).toLowerCase())) : suppliers[0];
        if (!supplier) return { error: `No supplier named "${input.supplierName}" on "${item.name}". Suppliers on file: ${suppliers.map((s: any) => s.name).join(", ")}` };
        if (!input.message?.trim()) return { error: "message is required — the exact SMS text to send." };
        const res = await sendSms(ctx, supplier.phone, input.message, false, { name: supplier.name });
        if (!res.ok) return { error: res.error };
        return { success: true, supplier: supplier.name, phone: supplier.phone, sent: input.message };
      }
      case "email_supplier": {
        const items = await sbGet(ctx, `chemicals?select=name,suppliers${ownerScope(ctx)}&limit=500`);
        const item = items.find((c: any) => (c.name || "").toLowerCase().trim() === String(input.itemName || "").toLowerCase().trim())
          || items.find((c: any) => (c.name || "").toLowerCase().includes(String(input.itemName || "").toLowerCase().trim()));
        if (!item) return { error: `No inventory item found named "${input.itemName}".` };
        const suppliers = (item.suppliers || []).filter((s: any) => s.email);
        if (suppliers.length === 0) return { error: `"${item.name}" has no supplier email on file — add one in Inventory & Equipment first.` };
        const supplier = input.supplierName ? suppliers.find((s: any) => (s.name || "").toLowerCase().includes(String(input.supplierName).toLowerCase())) : suppliers[0];
        if (!supplier) return { error: `No supplier named "${input.supplierName}" on "${item.name}" with an email on file.` };
        if (!input.subject?.trim() || !input.message?.trim()) return { error: "subject and message are required — the exact email to send." };
        const res = await sendGmailFromCtx(ctx, supplier.email, input.subject, `<p>${String(input.message).replace(/\n/g, "<br/>")}</p>`);
        if (!res.ok) return { error: res.error };
        return { success: true, supplier: supplier.name, email: supplier.email, sent: input.message };
      }
      case "contact_general_supplier": {
        const suppliers = await sbGet(ctx, `general_suppliers?select=*${ownerScope(ctx)}&limit=200`);
        // "Who are our suppliers?" — list everything on file instead of
        // erroring when no specific name was given.
        if (!input.supplierName?.trim()) {
          return { success: true, suppliers: suppliers.map((s: any) => ({ name: s.name, category: s.category, phone: s.phone, email: s.email, address: s.address })) };
        }
        const q = String(input.supplierName || "").toLowerCase().trim();
        const supplier = suppliers.find((s: any) => (s.name || "").toLowerCase().trim() === q)
          || suppliers.find((s: any) => (s.name || "").toLowerCase().includes(q));
        if (!supplier) return { error: `No general supplier found matching "${input.supplierName}". On file: ${suppliers.map((s: any) => s.name).join(", ") || "none yet"}.` };
        if (!input.channel) {
          return { success: true, name: supplier.name, category: supplier.category, phone: supplier.phone, email: supplier.email, address: supplier.address, website: supplier.website, notes: supplier.notes };
        }
        if (input.channel === "text") {
          if (!supplier.phone) return { error: `${supplier.name} has no phone number on file.` };
          if (!input.message?.trim()) return { error: "message is required — the exact SMS text to send." };
          const res = await sendSms(ctx, supplier.phone, input.message, false, { name: supplier.name });
          if (!res.ok) return { error: res.error };
          return { success: true, supplier: supplier.name, phone: supplier.phone, sent: input.message };
        }
        if (input.channel === "email") {
          if (!supplier.email) return { error: `${supplier.name} has no email on file.` };
          if (!input.subject?.trim() || !input.message?.trim()) return { error: "subject and message are required — the exact email to send." };
          const res = await sendGmailFromCtx(ctx, supplier.email, input.subject, `<p>${String(input.message).replace(/\n/g, "<br/>")}</p>`);
          if (!res.ok) return { error: res.error };
          return { success: true, supplier: supplier.name, email: supplier.email, sent: input.message };
        }
        return { error: "channel must be 'text' or 'email'" };
      }
      // FEATURE — cross-channel parity with the in-app chat's SOP/campaign/
      // social tools (AlfredPage.tsx). log_expense/list_expenses
      // are NOT ported here — expenses (like chemicals used to be) are
      // still localStorage-only, never reaching Supabase, so text-Alfred
      // (server-side) genuinely has no way to read or write them yet. That's
      // a real, separate gap (same class of fix chemicals got this round),
      // not something this tool list can work around.
      case "list_sops": {
        const rows = await sbGet(ctx, `sop_documents?select=id,title,frequency,kind${ownerScope(ctx)}`);
        return { success: true, count: rows.length, sops: rows.map((s: any) => ({ id: s.id, title: s.title, frequency: s.frequency, kind: s.kind })) };
      }
      case "create_sop": {
        if (!input.title?.trim() || !input.content?.trim()) return { error: "title and content are required." };
        const row = { id: crypto.randomUUID(), title: input.title, kind: "markdown", content: input.content, frequency: input.frequency || "general", assignedEmployeeIds: [], checklist: [] };
        const res = await sbWrite(ctx, "sop_documents", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, id: row.id, title: row.title };
      }
      // ─── Bulk texting: draft → owner approves → send ──────────────────────
      case "prepare_bulk_text": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        if (!String(input.message || "").trim()) return { error: "message required — ask the owner what it should say." };
        let rows = await sbGetAll(ctx, `customers?select=*${ownerScope(ctx)}`);
        const total = rows.length;
        rows = rows.filter((c: any) => c.phone && !c.smsOptOut && !(ctx.testModeEnabled && c.isTestClient));
        if (input.audience === "tag") {
          if (!input.tag) return { error: "tag required for audience 'tag'." };
          const t = String(input.tag).toLowerCase();
          rows = rows.filter((c: any) => Array.isArray(c.tags) && c.tags.some((x: string) => String(x).toLowerCase() === t));
        } else if (input.audience === "names") {
          const names: string[] = Array.isArray(input.customerNames) ? input.customerNames : [];
          if (!names.length) return { error: "customerNames required for audience 'names'." };
          const picked: any[] = [];
          const notFound: string[] = [];
          for (const nm of names) {
            const q = String(nm).toLowerCase().trim();
            const hit = rows.find((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().trim() === q) || rows.find((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().includes(q));
            if (hit && !picked.includes(hit)) picked.push(hit); else if (!hit) notFound.push(nm);
          }
          rows = picked;
          if (notFound.length) (input as any)._notFound = notFound;
        }
        if (input.onlyMissing) rows = rows.filter((c: any) => !String(c[input.onlyMissing] || "").trim());
        if (rows.length === 0) return { error: `Nobody matched — of ${total} customers, none have a phone number, haven't opted out, and fit "${input.audience}${input.tag ? " " + input.tag : ""}${input.onlyMissing ? ", missing " + input.onlyMissing : ""}".` };
        const recipients = rows.map((c: any, i: number) => ({ n: i + 1, customerId: c.id, name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.phone, firstName: c.firstName || "", phone: c.phone, status: "pending" }));
        const draftId = crypto.randomUUID();
        const campaignId = crypto.randomUUID();
        const camp = await recPut(ctx.authHeaders, ctx.ownerId, "campaigns", {
          id: campaignId, name: input.campaignName || String(input.message).slice(0, 40), ch: "sms", body: input.message, status: "draft",
          createdAt: new Date().toISOString(), recipientCount: recipients.length, matches: recipients.map((r: any) => r.customerId),
          segment: input.audience === "tag" && input.tag ? { tags: [input.tag] } : undefined, createdBy: "alfred", alfredDraftId: draftId,
        });
        if (!camp.ok) return { error: OWNER_RECORDS_MISSING + " (" + camp.error + ")" };
        const draft = { id: draftId, campaignId, message: input.message, recipients, status: "draft", createdAt: new Date().toISOString(), watchReplies: input.watchReplies || null };
        const saved = await recPut(ctx.authHeaders, ctx.ownerId, "bulk_text_draft", draft);
        if (!saved.ok) return { error: "Couldn't save the draft — " + saved.error };
        const SHOW = 40;
        return {
          success: true, draftId, notSentYet: true, recipientCount: recipients.length,
          list: recipients.slice(0, SHOW).map((r: any) => `${r.n}. ${r.name}`),
          more: recipients.length > SHOW ? recipients.length - SHOW : 0,
          notFound: (input as any)._notFound,
          sample: String(input.message).replace(/{{first_name}}/g, recipients[0].firstName || "there"),
          next: "Nothing has been sent. Text the owner the numbered list (and the sample message) and ask which to send to — e.g. 'all', 'not 3 and 7', or 'only 1, 2, 5'. Then stop and wait for their reply before calling send_bulk_text.",
        };
      }
      case "send_bulk_text": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const draft: any = await recGet(ctx.authHeaders, ctx.ownerId, "bulk_text_draft", String(input.draftId || ""));
        if (!draft) return { error: "That draft wasn't found — call list_bulk_text_drafts, or prepare a new one." };
        if (draft.status !== "draft") return { error: `That draft is already ${draft.status}.` };
        // The owner must have seen the list: a draft made during this same
        // message can't be sent until they reply.
        if (Date.parse(draft.createdAt) >= (ctx.turnStartedAt || 0)) {
          return { error: "Refused: the owner hasn't seen this list yet. Show them the numbered list and wait for their reply before sending." };
        }
        if (Date.now() - Date.parse(draft.createdAt) > 3 * 86400000) return { error: "That draft is more than 3 days old — prepare a fresh one so the list is current." };
        const only = new Set<number>((Array.isArray(input.only) ? input.only : []).map(Number));
        const exclude = new Set<number>((Array.isArray(input.exclude) ? input.exclude : []).map(Number));
        for (const r of draft.recipients) {
          const keep = only.size ? only.has(r.n) : !exclude.has(r.n);
          r.status = keep ? "pending" : "skipped";
          if (!keep) r.error = "owner said no";
        }
        const chosen = draft.recipients.filter((r: any) => r.status === "pending");
        if (!chosen.length) return { error: "With those choices nobody is left to send to." };
        draft.status = "sending"; draft.approvedAt = new Date().toISOString(); draft.approval = String(input.ownerApproval || "").slice(0, 200);
        if (draft.watchReplies?.question) {
          const days = Math.max(1, Math.min(120, Number(draft.watchReplies.days) || 30));
          const watch = {
            id: crypto.randomUUID(), campaignId: draft.campaignId, question: draft.watchReplies.question,
            saveField: draft.watchReplies.saveField || undefined, thankYouMessage: draft.watchReplies.thankYouMessage || undefined,
            customers: Object.fromEntries(chosen.map((r: any) => [r.customerId, { name: r.name, status: "waiting" }])),
            createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
          };
          const w = await recPut(ctx.authHeaders, ctx.ownerId, "reply_watch", watch);
          if (w.ok) draft.watchId = watch.id;
        }
        await recPut(ctx.authHeaders, ctx.ownerId, "bulk_text_draft", draft);
        if (!ctx.twilioSid || !ctx.twilioToken || !ctx.twilioFrom) return { error: "Twilio isn't configured for this account." };
        const after = await runBulkSendBatch(ctx.authHeaders, ctx.ownerId, { sid: ctx.twilioSid, token: ctx.twilioToken, from: ctx.twilioFrom }, draft, Date.now() + 35000);
        const left = after.recipients.filter(r => r.status === "pending").length;
        return {
          success: true, sent: after.sentCount, failed: after.failedCount, skipped: after.recipients.filter(r => r.status === "skipped").length,
          stillSending: left, watchingReplies: !!draft.watchId,
          note: left ? `${left} more go out automatically over the next several minutes.` : undefined,
        };
      }
      case "list_bulk_text_drafts": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const { ok, rows, error } = await recList(ctx.authHeaders, ctx.ownerId, "bulk_text_draft", { limit: 10 });
        if (!ok) return { error: OWNER_RECORDS_MISSING + " (" + error + ")" };
        return { success: true, drafts: rows.map((d: any) => ({ draftId: d.id, status: d.status, created: d.createdAt, recipients: d.recipients?.length || 0, sent: d.sentCount || 0, message: String(d.message || "").slice(0, 80) })) };
      }
      case "list_reply_watches": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const { ok, rows, error } = await recList(ctx.authHeaders, ctx.ownerId, "reply_watch", { limit: 10 });
        if (!ok) return { error: OWNER_RECORDS_MISSING + " (" + error + ")" };
        return { success: true, watches: rows.map((w: any) => {
          const cs = Object.values(w.customers || {}) as any[];
          return { question: w.question, savesTo: w.saveField, answered: cs.filter(c => c.status === "answered").length, waiting: cs.filter(c => c.status === "waiting").length, expires: w.expiresAt, recentAnswers: cs.filter(c => c.status === "answered").slice(-10).map(c => `${c.name}: ${c.answer}`) };
        }) };
      }
      case "set_birthday_offer": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const cur: any = (await recGet(ctx.authHeaders, ctx.ownerId, "birthday_offer", "default")) || {};
        const cfg = { ...cur, id: "default", active: !!input.active, discountPercent: Number(input.discountPercent ?? cur.discountPercent ?? 10), validDays: Number(input.validDays ?? cur.validDays ?? 30), message: input.message ?? cur.message };
        const r = await recPut(ctx.authHeaders, ctx.ownerId, "birthday_offer", cfg);
        if (!r.ok) return { error: OWNER_RECORDS_MISSING + " (" + r.error + ")" };
        const withBday = (await sbGetAll(ctx, `customers?select=id&birthday=not.is.null${ownerScope(ctx)}`)).length;
        return { success: true, active: cfg.active, discountPercent: cfg.discountPercent, validDays: cfg.validDays, customersWithBirthdayOnFile: withBday, note: "Runs every morning (needs the /api/check-reminders scheduler that already sends reminders)." };
      }
      // ─── Campaigns / goals ────────────────────────────────────────────────
      case "create_campaign": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const sendAt = input.sendAt ? new Date(input.sendAt) : null;
        if (sendAt && isNaN(sendAt.getTime())) return { error: "sendAt isn't a valid date/time." };
        const camp = { id: crypto.randomUUID(), name: input.name, ch: input.channel === "email" ? "email" : "sms", subject: input.subject || "", body: input.message, status: sendAt ? "scheduled" : "draft", sendAt: sendAt ? sendAt.toISOString() : undefined, createdAt: new Date().toISOString(), segment: Array.isArray(input.tags) && input.tags.length ? { tags: input.tags } : undefined, createdBy: "alfred" };
        const r = await recPut(ctx.authHeaders, ctx.ownerId, "campaigns", camp);
        if (!r.ok) return { error: OWNER_RECORDS_MISSING + " (" + r.error + ")" };
        return { success: true, campaignId: camp.id, status: camp.status, note: "It's in Campaigns in the CRM. Scheduled campaigns go out from the CRM at that time." };
      }
      case "list_campaigns": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const { ok, rows, error } = await recList(ctx.authHeaders, ctx.ownerId, "campaigns", { limit: 50 });
        if (!ok) return { error: OWNER_RECORDS_MISSING + " (" + error + ")" };
        return { success: true, count: rows.length, campaigns: rows.map((c: any) => ({ id: c.id, name: c.name, status: c.status, channel: c.ch, recipients: c.recipientCount, sent: c.sentCount })) };
      }
      case "create_goal": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const metric = ["revenue", "jobs", "clients", "recurringClients", "leads"].includes(input.metric) ? input.metric : "custom";
        const goal = { id: crypto.randomUUID(), category: input.category || (metric === "custom" ? "personal" : "business"), label: input.label, text: input.label, target: Number(input.target) || 0, current: 0, unit: input.unit || (metric === "revenue" ? "$" : metric === "custom" ? "" : metric), metric, deadline: input.deadline || undefined, rewardDescription: input.rewardDescription || undefined, done: false, createdAt: new Date().toISOString() };
        const r = await recPut(ctx.authHeaders, ctx.ownerId, "goals", goal);
        if (!r.ok) return { error: OWNER_RECORDS_MISSING + " (" + r.error + ")" };
        return { success: true, goalId: goal.id, label: goal.label, target: goal.target, metric };
      }
      case "get_accountability_summary": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const days = Math.max(1, Math.min(60, Number(input.days) || 7));
        const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
        const [ent, wn] = await Promise.all([recList(ctx.authHeaders, ctx.ownerId, "accountability", { limit: 400 }), recList(ctx.authHeaders, ctx.ownerId, "wins", { limit: 200 })]);
        if (!ent.ok) return { error: OWNER_RECORDS_MISSING + " (" + ent.error + ")" };
        const recent = ent.rows.filter((e: any) => (e.date || "") >= since);
        const avg = (k: string) => recent.length ? Math.round((recent.reduce((s2: number, e: any) => s2 + (Number(e[k]) || 0), 0) / recent.length) * 10) / 10 : null;
        const dates = new Set(ent.rows.map((e: any) => e.date));
        let streak = 0; for (let i = 0; i < 365; i++) { const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); if (dates.has(d)) streak++; else if (i > 0) break; }
        return { success: true, days, checkInsLogged: recent.length, streakDays: streak, checkedInToday: dates.has(today()), averages: { sleepHours: avg("sleep"), waterOz: avg("water"), steps: avg("steps"), workoutMinutes: avg("gymMinutes"), mood: avg("mood") }, workoutDays: recent.filter((e: any) => (Number(e.gymMinutes) || 0) > 0 || e.gym).length, notes: recent.filter((e: any) => e.notes).slice(0, 5).map((e: any) => `${e.date}: ${e.notes}`), wins: wn.ok ? wn.rows.filter((w: any) => (w.date || "") >= since).map((w: any) => w.text) : [] };
      }
      case "list_goals": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const { ok, rows, error } = await recList(ctx.authHeaders, ctx.ownerId, "goals", { limit: 50 });
        if (!ok) return { error: OWNER_RECORDS_MISSING + " (" + error + ")" };
        return { success: true, goals: rows.map((g: any) => ({ label: g.label || g.text, target: g.target, current: g.current, unit: g.unit, deadline: g.deadline, done: !!g.done })) };
      }
      // ─── Many at once ─────────────────────────────────────────────────────
      case "schedule_jobs_bulk": {
        const list: any[] = Array.isArray(input.jobs) ? input.jobs : [];
        if (!list.length) return { error: "jobs required" };
        if (list.length > 200) return { error: "That's more than 200 jobs in one go — split it into a few messages." };
        const results: string[] = [];
        let ok = 0, failed = 0;
        for (const j of list) {
          let cust = await findCustomerByName(ctx, j.customerName);
          if (!cust && (j.customerPhone || j.customerAddress)) {
            const [firstName, ...rest] = String(j.customerName || "").trim().split(/\s+/);
            const created: any = await executeToolCore(ctx, "create_customer", { firstName, lastName: rest.join(" "), phone: j.customerPhone, address: j.customerAddress });
            if (created?.success) cust = await findCustomerByName(ctx, j.customerName);
          }
          if (!cust) { failed++; results.push(`✗ ${j.customerName}: not in the CRM (give a phone or address to add them)`); continue; }
          const out: any = await executeToolCore(ctx, "schedule_job", { ...j, customerName: `${cust.firstName || ""} ${cust.lastName || ""}`.trim() });
          if (out?.success) {
            ok++;
            if (j.amount && out.jobId) await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(out.jobId)}`, { method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ amount: Number(j.amount) }) }).catch(() => {});
            if (j.customerAddress && out.jobId) await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(out.jobId)}`, { method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ address: j.customerAddress }) }).catch(() => {});
            results.push(`✓ ${out.customer} ${out.date}${j.time ? " " + j.time : ""}`);
          } else { failed++; results.push(`✗ ${j.customerName}: ${out?.error || "failed"}`); }
        }
        return { success: failed === 0, scheduled: ok, failed, results };
      }
      case "create_customers_bulk": {
        const list: any[] = Array.isArray(input.customers) ? input.customers : [];
        if (!list.length) return { error: "customers required" };
        const results: string[] = [];
        let added = 0, existed = 0, failed = 0;
        for (const c of list) {
          const out: any = await executeToolCore(ctx, "create_customer", c);
          const nm = `${c.firstName || ""} ${c.lastName || ""}`.trim();
          if (!out?.success) { failed++; results.push(`✗ ${nm}: ${out?.error || "failed"}`); continue; }
          if (out.note) existed++; else added++;
          const extra: Record<string, unknown> = {};
          if (c.notes) extra.notes = c.notes;
          if (Array.isArray(c.tags) && c.tags.length) extra.tags = c.tags;
          if (c.birthday) extra.birthday = c.birthday;
          if (Object.keys(extra).length && out.customerId) await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(out.customerId)}`, { method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(extra) }).catch(() => {});
          results.push(`${out.note ? "=" : "✓"} ${nm}`);
        }
        return { success: failed === 0, added, alreadyExisted: existed, failed, results };
      }
      case "update_customers_bulk": {
        const list: any[] = Array.isArray(input.updates) ? input.updates : [];
        if (!list.length) return { error: "updates required" };
        const results: string[] = [];
        let ok = 0, failed = 0;
        for (const u of list) {
          const cust = await findCustomerByName(ctx, u.customerName);
          if (!cust) { failed++; results.push(`✗ ${u.customerName}: not found`); continue; }
          const full = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(cust.id)}&select=notes,tags`))[0] || {};
          const patch: Record<string, unknown> = {};
          for (const f of ["phone", "email", "address", "birthday", "company"]) if (u[f]) patch[f] = u[f];
          if (u.addNote) patch.notes = [full.notes, u.addNote].filter(Boolean).join("\n");
          if (Array.isArray(u.addTags) && u.addTags.length) patch.tags = Array.from(new Set([...(Array.isArray(full.tags) ? full.tags : []), ...u.addTags]));
          if (!Object.keys(patch).length) { results.push(`= ${u.customerName}: nothing to change`); continue; }
          const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(cust.id)}`, { method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(patch) });
          const rows = await res.json().catch(() => []);
          if (res.ok && Array.isArray(rows) && rows.length) { ok++; results.push(`✓ ${u.customerName}: ${Object.keys(patch).join(", ")}`); }
          else { failed++; results.push(`✗ ${u.customerName}: ${(rows as any)?.message || "didn't save"}`); }
        }
        return { success: failed === 0, updated: ok, failed, results };
      }
      // ─── Money documents ──────────────────────────────────────────────────
      case "log_expenses": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const list: any[] = Array.isArray(input.expenses) ? input.expenses : [];
        if (!list.length) return { error: "expenses required" };
        let saved = 0;
        const errs: string[] = [];
        for (const e of list) {
          const row = { id: crypto.randomUUID(), date: e.date || today(), description: e.description, amount: Math.abs(Number(e.amount) || 0), category: e.category || "Other", vendor: e.vendor || "", isBusiness: true, isDeductible: true, source: "alfred" };
          const r = await recPut(ctx.authHeaders, ctx.ownerId, "expenses", row);
          if (r.ok) saved++; else errs.push(r.error || "failed");
        }
        if (!saved) return { error: OWNER_RECORDS_MISSING + " (" + errs[0] + ")" };
        return { success: true, saved, failed: list.length - saved, total: list.reduce((s, e) => s + Math.abs(Number(e.amount) || 0), 0) };
      }
      case "prepare_import_from_file": {
        return await prepareImportFromFile(ctx, input || {});
      }
      case "run_import": {
        return await runTextImport(ctx, input?.planId ? String(input.planId) : undefined);
      }
      case "import_financial_document": {
        if (!ctx.ownerId) return { error: "Can't tell which business this is." };
        const doc = await readFinancialDocument(ctx, String(input.fileUrl || ""), String(input.fileType || ""), String(input.hint || ""));
        if ("error" in doc) return { error: doc.error };
        const expenses = (doc.items || []).filter((i: any) => i.kind === "expense" && Number(i.amount));
        const income = (doc.items || []).filter((i: any) => i.kind === "income" && Number(i.amount));
        let expSaved = 0, incSaved = 0;
        for (const e of expenses) {
          const r = await recPut(ctx.authHeaders, ctx.ownerId, "expenses", { id: crypto.randomUUID(), date: e.date || doc.date || today(), description: e.description || doc.vendor || "Expense", amount: Math.abs(Number(e.amount)), category: e.category || "Other", vendor: e.vendor || doc.vendor || "", isBusiness: true, isDeductible: true, source: "alfred-document", receiptUrl: input.fileUrl });
          if (r.ok) expSaved++;
        }
        for (const i of income) {
          const r = await sbWrite(ctx, "manual_budget_entries", "POST", { id: crypto.randomUUID(), kind: "income", category: i.category || "revenue", label: i.description || "Income", amount: Math.abs(Number(i.amount)), date: i.date || doc.date || today() });
          if (r.ok) incSaved++;
        }
        if (doc.taxNotes) await sbWrite(ctx, "alfred_memory", "POST", { id: crypto.randomUUID(), text: `Tax info (${doc.documentType || "document"}${doc.date ? ", " + doc.date : ""}): ${doc.taxNotes}`, category: "finance", created_at: new Date().toISOString() }).catch(() => null);
        return {
          success: true, documentType: doc.documentType, vendor: doc.vendor, date: doc.date,
          expensesSaved: expSaved, expensesTotal: expenses.reduce((s: number, e: any) => s + Math.abs(Number(e.amount)), 0),
          incomeSaved: incSaved, incomeTotal: income.reduce((s: number, e: any) => s + Math.abs(Number(e.amount)), 0),
          taxNotesSaved: !!doc.taxNotes, summary: doc.summary,
          note: expenses.length && !expSaved ? OWNER_RECORDS_MISSING : undefined,
        };
      }
      case "list_social_posts": {
        const rows = await sbGet(ctx, `social_posts?select=id,caption,status,scheduledAt${ownerScope(ctx)}&order=scheduledAt.desc&limit=20`);
        if (rows.length === 0) return { success: true, count: 0, posts: [], note: "No scheduled posts, or social posts aren't cloud-synced on this deployment yet." };
        return { success: true, count: rows.length, posts: rows.map((p: any) => ({ id: p.id, caption: (p.caption || "").slice(0, 80), status: p.status, scheduledAt: p.scheduledAt })) };
      }
      case "attach_file_to_customer": {
        if (!input.fileUrl) return { error: "fileUrl required" };
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        const newDoc = {
          id: crypto.randomUUID(),
          name: input.fileName || input.fileUrl.split("/").pop() || "file",
          url: input.fileUrl,
          category: input.category || "Document",
          uploadedAt: new Date().toISOString().slice(0, 10),
        };
        const docs = [...(Array.isArray(cust.documents) ? cust.documents : []), newDoc];
        const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(cust.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ documents: docs }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, savedTo: `${cust.firstName} ${cust.lastName}`.trim(), fileName: newDoc.name };
      }
      // FEATURE — Alfred capability gap fill: editing an existing
      // customer's contact info. create_customer only ever handled brand
      // new customers — there was no way to fix a wrong phone number or
      // update an address by text at all.
      case "update_customer": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        const patch: Record<string, unknown> = {};
        for (const f of ["phone", "email", "address", "notes", "birthday", "company"] as const) if (input[f] !== undefined) patch[f] = input[f];
        if (Object.keys(patch).length === 0) return { error: "Nothing to update — provide at least one of phone/email/address/notes/birthday/company." };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(cust.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, customer: `${cust.firstName} ${cust.lastName}`.trim(), updated: Object.keys(patch) };
      }
      // FEATURE — Alfred capability gap fill: replying to a customer review
      // on the owner's behalf ("thank the Millers for their review and
      // apologize for the wait").
      case "respond_to_review": {
        const rows = await sbGet(ctx, `reviews?select=id,customerName,rating,text,response${ownerScope(ctx)}&limit=200`);
        const q = (input.customerName || "").toLowerCase().trim();
        const review = rows.find((r: any) => (r.customerName || "").toLowerCase().includes(q) && !r.response)
          || rows.find((r: any) => (r.customerName || "").toLowerCase().includes(q));
        if (!review) return { error: `No review found for "${input.customerName}".` };
        if (!input.response?.trim()) return { error: "response text required." };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews?id=eq.${encodeURIComponent(review.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ response: input.response, status: "responded" }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, customer: review.customerName, rating: review.rating };
      }
      // FEATURE — Alfred capability gap fill: who's outstanding on required
      // training. training_modules/training_completions are the tables the
      // new employee training system (owner-built modules, employee-taken
      // quizzes) writes to — Alfred had no visibility into them at all.
      case "get_employee_training_status": {
        const [modules, completions, employees] = await Promise.all([
          sbGet(ctx, `training_modules?select=id,data${ownerScope(ctx)}`),
          sbGet(ctx, `training_completions?select=module_id,employee_id,passed${ownerScope(ctx)}&limit=2000`),
          sbGet(ctx, `employees?select=id,firstName,lastName,status${ownerScope(ctx)}&limit=200`),
        ]);
        const requiredModules = modules.map((m: any) => m.data).filter((m: any) => m?.required);
        if (requiredModules.length === 0) return { success: true, note: "No required training modules set up." };
        const activeEmployees = employees.filter((e: any) => e.status === "active" && e.id !== "owner_" + (ctx.ownerId || ""));
        const passedSet = new Set(completions.filter((c: any) => c.passed).map((c: any) => `${c.module_id}:${c.employee_id}`));
        const outstanding: Array<{ employee: string; missing: string[] }> = [];
        for (const emp of activeEmployees) {
          const missing = requiredModules.filter((m: any) => !passedSet.has(`${m.id}:${emp.id}`)).map((m: any) => m.title);
          if (missing.length > 0) outstanding.push({ employee: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(), missing });
        }
        if (outstanding.length === 0) return { success: true, summary: "Every active employee is fully trained on all required modules." };
        return { success: true, outstanding };
      }
      // FEATURE — Alfred capability gap fill: attaching a text-sent file to
      // a JOB's work-order attachments (parallel to attach_file_to_customer,
      // which only writes to the customer's document vault). "attach this
      // PDF to the Miller job" for a commercial job spec sheet, etc.
      case "attach_file_to_job": {
        if (!input.fileUrl) return { error: "fileUrl required" };
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const jobRow = (await sbGet(ctx, `jobs?id=eq.${encodeURIComponent(job.id)}&select=attachments`))[0];
        const newAtt = {
          id: crypto.randomUUID(),
          name: input.fileName || input.fileUrl.split("/").pop() || "file",
          type: (input.fileName || input.fileUrl).toLowerCase().endsWith(".pdf") ? "pdf" : "other",
          url: input.fileUrl,
          uploadedAt: Date.now(),
        };
        const attachments = [...(Array.isArray(jobRow?.attachments) ? jobRow.attachments : []), newAtt];
        const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ attachments }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, attachedTo: job.customerName || job.id, fileName: newAtt.name };
      }
      // FEATURE — Alfred capability gap fill: hiring-pipeline visibility
      // and moving a candidate between phases (Applied/Interview/Offer/
      // Hired, or whatever custom phases the owner set up).
      case "list_candidates": {
        const rows = await sbGet(ctx, `candidates?select="firstName","lastName",phase,phone,email,"createdAt"${ownerScope(ctx)}&limit=200`);
        if (rows.length === 0) return { success: true, count: 0, candidates: [] };
        return { success: true, count: rows.length, candidates: rows.map((c: any) => ({ name: `${c.firstName || ""} ${c.lastName || ""}`.trim(), phase: c.phase, phone: c.phone, email: c.email })) };
      }
      case "move_candidate_phase": {
        if (!input.candidateName?.trim() || !input.phase?.trim()) return { error: "candidateName and phase are required." };
        const rows = await sbGet(ctx, `candidates?select=id,"firstName","lastName",phase${ownerScope(ctx)}&limit=200`);
        const q = input.candidateName.toLowerCase().trim();
        const cand = rows.find((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().includes(q));
        if (!cand) return { error: `No candidate found matching "${input.candidateName}".` };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/candidates?id=eq.${encodeURIComponent(cand.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ phase: input.phase }),
        });
        if (!res.ok) return { error: (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, candidate: `${cand.firstName} ${cand.lastName}`.trim(), from: cand.phase, to: input.phase };
      }
      case "get_customer_card_info": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        if (!cust.stripeCustomerId) return { success: true, name: `${cust.firstName} ${cust.lastName}`.trim(), hasCardOnFile: false };
        return {
          success: true, name: `${cust.firstName} ${cust.lastName}`.trim(), hasCardOnFile: true,
          cardOnFile: cust.savedPaymentMethodLabel || "A card is on file, but no brand/last-4 label was saved — check the customer's Payment Methods in the CRM for the exact card.",
          note: "This is the brand/last-4 only — the full card number is never stored anywhere and can't be retrieved by anyone.",
        };
      }
      case "create_invoice": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        if (!input.amount && !(Array.isArray(input.lineItems) && input.lineItems.length)) return { error: "amount or lineItems required" };
        const items = (Array.isArray(input.lineItems) && input.lineItems.length)
          ? input.lineItems.map((li: any) => ({ id: crypto.randomUUID(), description: li.description, quantity: li.quantity || 1, unitPrice: li.unitPrice || 0 }))
          : [{ id: crypto.randomUUID(), description: input.description || "Service", quantity: 1, unitPrice: Number(input.amount) || 0 }];
        const subtotal = items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
        // Ctx doesn't carry the owner's configured tax rate (a text-Alfred-
        // only gap vs. the in-app version, which reads settings.taxRate
        // directly) — 6% matches this app's own default fallback elsewhere.
        const tax = Math.round(subtotal * 0.06 * 100) / 100;
        const total = Math.round((subtotal + tax) * 100) / 100;
        const dep = smsDepositFields(input, total);
        if ("error" in dep) return { error: dep.error };
        const row = {
          id: crypto.randomUUID(), customerId: cust.id, lineItems: items, subtotal, discount: 0, depositRequired: 0, tax, total, ...dep,
          status: "approved", createdAt: today(), validUntil: today(), viewed: false, viewedAt: null,
          terms: "Payment due upon receipt.", notes: input.notes || "", invoiced: true, invoicedAt: today(),
        };
        const res = await sbWrite(ctx, "estimates", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, invoiceId: row.id, customer: `${cust.firstName} ${cust.lastName}`.trim(), total, ...(Number(dep.depositRequired) > 0 ? { depositDueNow: depositDollars(dep, total), balanceAfter: Math.max(0, Math.round((total - depositDollars(dep, total)) * 100) / 100) } : {}), next: "Call send_invoice with this invoiceId to text it to the customer." };
      }
      case "request_employee": {
        const job = await findJob(ctx, { jobId: input.jobId, customerName: input.customerName });
        if (!job) return { error: "Couldn't find that job." };
        const emp = await findEmployeeByName(ctx, input.employeeName);
        if (!emp) return { error: `No employee found matching "${input.employeeName}".` };
        const res = await sbWrite(ctx, "job_requests", "POST", { job_id: job.id, employee_id: emp.id, status: "pending", message: input.message || null });
        if (!res.ok) return { error: res.error };
        return { success: true, jobId: job.id, employee: `${emp.firstName} ${emp.lastName}`, status: "pending — awaiting the employee's response" };
      }
      case "list_estimates": {
        const wantStatus = (input.status || "pending").toLowerCase();
        const rows = await sbGet(ctx, `estimates?select=id,customerId,total,status,invoiced,paidAt,createdAt${ownerScope(ctx)}&limit=200`);
        const matches = (e: any) => {
          if (wantStatus === "all") return true;
          if (wantStatus === "invoiced") return !!e.invoiced;
          if (wantStatus === "pending") return e.status === "pending" && !e.invoiced;
          if (wantStatus === "approved") return e.status === "approved" && !e.invoiced;
          if (wantStatus === "rejected") return e.status === "rejected";
          return true;
        };
        const filtered = rows.filter(matches).sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        const custIds = Array.from(new Set(filtered.slice(0, 25).map((e: any) => e.customerId).filter(Boolean)));
        const custs = custIds.length ? await sbGet(ctx, `customers?id=in.(${custIds.map(id => encodeURIComponent(id)).join(",")})&select=id,firstName,lastName`) : [];
        return {
          success: true, status: wantStatus, count: filtered.length,
          estimates: filtered.slice(0, 25).map((e: any) => {
            const c = custs.find((x: any) => x.id === e.customerId);
            return { id: e.id, customer: c ? `${c.firstName} ${c.lastName}`.trim() : "Unknown customer", total: e.total, status: e.status, invoiced: !!e.invoiced, paid: !!e.paidAt, createdAt: e.createdAt };
          }),
        };
      }
      case "send_email_via_gmail": {
        if (!input.to || !input.subject || !input.body) return { error: "to, subject, body required" };
        const res = await sendGmailFromCtx(ctx, input.to, input.subject, `<p>${String(input.body).replace(/\n/g, "<br/>")}</p>`);
        if (!res.ok) return { error: res.error || "Gmail send failed — is Google connected in Settings → Integrations?" };
        return { success: true, sent: true, to: input.to, subject: input.subject };
      }
      case "create_estimate": {
        const cust = await findCustomerByName(ctx, input.customerName);
        if (!cust) return { error: `No customer found matching "${input.customerName}".` };
        const amount = Number(input.amount) || 0;
        if (amount <= 0) return { error: "amount must be greater than 0" };
        const invoiced = !!input.invoiced;
        const dep = smsDepositFields(input, amount);
        if (dep && "error" in dep) return { error: dep.error };
        const row = {
          id: crypto.randomUUID(), customerId: cust.id,
          lineItems: [{ id: crypto.randomUUID(), description: input.description || "Service", quantity: 1, unitPrice: amount }],
          subtotal: amount, discount: 0, depositRequired: 0, tax: 0, total: amount,
          ...(dep || {}),
          // BUG FIX — quotes were created already "approved", so the customer's
          // Review & Sign was rejected server-side ("already approved").
          status: invoiced ? "approved" : "pending", createdAt: today(), validUntil: today(),
          terms: "Payment due upon receipt.", notes: "", invoiced, ...(invoiced ? { invoicedAt: today() } : {}),
        };
        const res = await sbWrite(ctx, "estimates", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, estimateId: row.id, customer: `${cust.firstName} ${cust.lastName}`.trim(), total: amount, invoiced, ...(dep && Number((dep as any).depositRequired) > 0 ? { depositDueNow: depositDollars(dep as any, amount), balanceAfterService: Math.max(0, amount - depositDollars(dep as any, amount)) } : {}) };
      }
      case "set_estimate_deposit": {
        let est: any = null;
        if (input.estimateId) est = (await sbGet(ctx, `estimates?id=eq.${encodeURIComponent(input.estimateId)}&select=id,customerId,total,invoiced,paidAt,paidDeposit,status${ownerScope(ctx)}`))[0];
        else if (input.customerName) {
          const cust = await findCustomerByName(ctx, input.customerName);
          if (!cust) return { error: `No customer found matching "${input.customerName}".` };
          const rows = await sbGet(ctx, `estimates?customerId=eq.${encodeURIComponent(cust.id)}&invoiced=is.false&select=id,customerId,total,invoiced,paidAt,paidDeposit,status,createdAt${ownerScope(ctx)}`);
          est = rows.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
        } else return { error: "Need either estimateId or customerName." };
        if (!est) return { error: "Couldn't find that quote." };
        if (est.invoiced) return { error: "That one is already an invoice — deposits only apply to quotes." };
        if (est.paidAt || Number(est.paidDeposit) > 0) return { error: "The customer has already paid on that quote, so the deposit can't be changed." };
        const total = Number(est.total) || 0;
        const dep = smsDepositFields(input, total, true);
        if ("error" in dep) return { error: dep.error };
        const res = await sbWrite(ctx, `estimates?id=eq.${encodeURIComponent(est.id)}`, "PATCH", dep);
        if (!res.ok) return { error: res.error };
        if (!Array.isArray(res.data) || res.data.length === 0) return { error: "The update didn't save (no matching quote for this account)." };
        return { success: true, estimateId: est.id, total, depositDueNow: depositDollars(dep, total), balanceAfterService: Math.max(0, total - depositDollars(dep, total)) };
      }
      case "send_estimate": {
        let est: any = null;
        if (input.estimateId) {
          est = (await sbGet(ctx, `estimates?id=eq.${encodeURIComponent(input.estimateId)}&select=id,customerId,total,invoiced,paidAt,depositRequired,depositType`))[0];
        } else if (input.customerName) {
          const cust = await findCustomerByName(ctx, input.customerName);
          if (!cust) return { error: `No customer found matching "${input.customerName}".` };
          const rows = await sbGet(ctx, `estimates?customerId=eq.${encodeURIComponent(cust.id)}&select=id,customerId,total,invoiced,paidAt,createdAt,depositRequired,depositType${ownerScope(ctx)}`);
          est = rows.sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
          if (!est) return { error: `${input.customerName} has no estimate on file.` };
        } else {
          return { error: "Need either estimateId or customerName." };
        }
        if (!est) return { error: "Estimate not found." };
        const cust = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(est.customerId)}&select=phone,firstName,lastName`))[0];
        if (!cust?.phone) return { error: "That customer has no phone number on file." };
        const link = `${ctx.origin}/#/estimate/${est.id}`;
        const label = est.invoiced ? "invoice" : "estimate";
        const estDeposit = Number(est.depositRequired) > 0 ? depositDollars({ depositRequired: Number(est.depositRequired), depositType: est.depositType || "amount" }, Number(est.total) || 0) : 0;
        const estDepositText = estDeposit > 0 ? ` A deposit of $${estDeposit.toFixed(2)} is due ${est.invoiced ? "now" : "to book"}; the rest ($${Math.max(0, Number(est.total) - estDeposit).toFixed(2)}) after service.` : "";
        const res = await sendSms(ctx, cust.phone, `Hi ${cust.firstName || ""}, here's your ${label} from ${ctx.companyName} for $${Number(est.total || 0).toFixed(2)}.${estDepositText} View ${est.invoiced ? "and pay" : "and sign"}: ${link}`, false, { name: `${cust.firstName || ""} ${cust.lastName || ""}`.trim(), customerId: est.customerId });
        if (!res.ok) return { error: res.error };
        return { success: true, sentTo: cust.firstName, amount: est.total, type: label, ...(estDeposit > 0 ? { depositDueNow: estDeposit } : {}), link };
      }
      case "text_me": {
        if (!ctx.fromPhone) return { error: "Don't know which number to text back." };
        const res = await sendSms(ctx, ctx.fromPhone, input.message);
        if (!res.ok) return { error: res.error };
        return { success: true };
      }
      case "switch_ai_model": {
        const wanted = String(input.provider || "").toLowerCase().trim();
        const match = Object.entries(SMS_MODELS).find(([key, def]) =>
          key === wanted || key.replace(/^nvidia_/, "") === wanted || def.name.toLowerCase() === wanted || def.name.toLowerCase().includes(wanted) || wanted.includes(def.name.toLowerCase())
        );
        if (!match) return { error: `Don't recognize "${input.provider}" — available providers: ${Object.values(SMS_MODELS).map(d => d.name).join(", ")}.` };
        const [key, def] = match;
        if (!ctx.modelKeys?.[key]) return { error: `${def.name} isn't set up yet — no API key saved for it. Add one in Settings → AI Models first, then try again.` };
        const rows = await sbGet(ctx, `app_settings?select=owner_id,data${ownerScope(ctx)}&limit=1`);
        const row = rows[0];
        if (!row?.owner_id) return { error: "Couldn't find your settings to update." };
        const currentPriority: string[] = Array.isArray(row.data?.modelPriority) ? row.data.modelPriority : DEFAULT_MODEL_PRIORITY;
        const nextPriority = [key, ...currentPriority.filter((k: string) => k !== key)];
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(row.owner_id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ data: { ...row.data, activeModel: key, modelPriority: nextPriority } }),
        });
        if (!patchRes.ok) return { error: "Couldn't save the switch — " + (await patchRes.text().catch(() => "")).slice(0, 200) };
        return { success: true, switchedTo: def.name, note: "Takes effect starting with the next message." };
      }
      case "list_capabilities": {
        return {
          success: true,
          categories: {
            "Talk to customers": "Text an existing customer, text ANY phone number directly (leads, applicants, personal contacts — not just customers), mass-text everyone or a tagged group, look up a customer's saved card on file (brand/last4/expiry only — never the full card number, that's never stored anywhere)",
            "Run the business": "Create, reschedule, cancel jobs; reassign or request crew; create customers and estimates/invoices, then send them; add checklist items; check who's clocked in",
            "Look things up": "Business stats and revenue, today's/upcoming schedule, overdue invoices, full job or customer detail, the weather, a customer's documents on file",
            "Files": "Text me a photo or PDF and say which client it's for and I'll save it to their file — text 'send me [file] for [client]' and I'll send it right back as an MMS",
            "Remember and follow up": "Save facts/notes for later, save standing 'from now on' preferences, schedule one-time or recurring follow-up texts to you",
            "Admin": "Create a tracked promotion code, turn on auto review-request texting, approve/decline a reschedule a customer's own assistant proposed, switch which AI model I'm running on",
          },
          note: "Ask for anything in plain English — you don't need to name a tool.",
        };
      }
      case "remember": {
        if (!input.fact) return { error: "fact required" };
        // BUG FIX (memory-system audit, shared with the in-app chat's
        // remember_fact) — no duplicate check meant asking twice (or the
        // owner naturally restating something across separate texts)
        // created two identical rows, both injected into every future
        // conversation's system prompt on both channels (this table is
        // shared — see runAlfredSmsAgent's crossChannelBlock).
        const existing = await sbGet(ctx, `alfred_memory?select=id,text${ownerScope(ctx)}&limit=500`);
        if (existing.some((m: any) => (m.text || "").toLowerCase() === String(input.fact).toLowerCase())) {
          return { success: true, note: "Already remembered — didn't duplicate it." };
        }
        const row = { id: crypto.randomUUID(), text: input.fact, category: input.category || "general" };
        const res = await sbWrite(ctx, "alfred_memory", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, remembered: input.fact };
      }
      case "forget": {
        // FEATURE (memory-system audit) — symmetry with remember: "forget
        // that" over text now works, same as the in-app chat's forget_fact.
        if (!input.fact) return { error: "fact required — the exact or approximate text to forget" };
        const q = String(input.fact).toLowerCase();
        const rows = await sbGet(ctx, `alfred_memory?select=id,text${ownerScope(ctx)}&limit=500`);
        const match = rows.find((m: any) => (m.text || "").toLowerCase() === q || (m.text || "").toLowerCase().includes(q));
        if (!match) return { error: "Couldn't find a memory matching that — try recall first to see the exact wording." };
        // sbWrite is POST/PATCH-only (no delete verb) — issue the delete directly.
        const delRes = await fetch(`${SUPABASE_URL}/rest/v1/alfred_memory?id=eq.${encodeURIComponent(match.id)}`, { method: "DELETE", headers: ctx.authHeaders });
        if (!delRes.ok) return { error: "Failed to delete that memory." };
        return { success: true, forgot: match.text };
      }
      case "recall": {
        const rows = await sbGet(ctx, `alfred_memory?select=text,category,created_at${ownerScope(ctx)}&order=created_at.desc&limit=100`);
        const q = (input.search || "").toLowerCase().trim();
        const filtered = q ? rows.filter((r: any) => (r.text || "").toLowerCase().includes(q) || (r.category || "").toLowerCase().includes(q)) : rows;
        if (filtered.length === 0) return { success: true, memories: [], summary: q ? `Nothing saved matching "${input.search}".` : "Nothing saved yet." };
        return { success: true, memories: filtered.slice(0, 20).map((r: any) => r.text) };
      }
      case "enable_review_request_automation": {
        // The actual `automations` list lives in the owner's browser
        // localStorage, not Supabase — this server-side agent has no direct
        // access to it. Stage a flag on app_settings that App.tsx applies
        // the next time the owner's browser is open (adds the built-in
        // "Post-Job Review Request" automation if not already present),
        // same bridge pattern as alfredExtraPhoneRoles.
        const rows = await sbGet(ctx, `app_settings?select=owner_id,data${ownerScope(ctx)}&limit=1`);
        const row = rows[0];
        if (!row?.owner_id) return { error: "Couldn't find your settings to update." };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(row.owner_id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ data: { ...row.data, pendingEnableReviewRequestAutomation: true } }),
        });
        if (!res.ok) return { error: "Couldn't save — " + (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, note: "Will turn on the next time the CRM is opened in a browser (usually within a few seconds if it's already open)." };
      }
      case "set_standing_preference": {
        if (!input.instruction) return { error: "instruction required" };
        // Saved as a memory (category "preference") so it's auto-injected
        // into every future conversation's system prompt (see
        // runAlfredSmsAgent below) — the owner shouldn't have to repeat a
        // "from now on" instruction, and Alfred shouldn't need to call
        // recall itself to remember it.
        const memRow = { id: crypto.randomUUID(), text: input.instruction, category: "preference" };
        const memRes = await sbWrite(ctx, "alfred_memory", "POST", memRow);
        if (!memRes.ok) return { error: memRes.error };
        // autoApproveReschedules/autoApproveInvoiceSends are the two
        // preferences that need to actually CHANGE code behavior, not just
        // influence phrasing — reschedule auto-approval is read by the
        // separate customer-facing agent (alfredCustomerAgent.ts) which has
        // no access to this conversation's memory, so it has to be a real
        // settings flag, not just a remembered fact.
        if (input.autoApproveReschedules !== undefined || input.autoApproveInvoiceSends !== undefined) {
          const rows = await sbGet(ctx, `app_settings?select=owner_id,data${ownerScope(ctx)}&limit=1`);
          const row = rows[0];
          if (row?.owner_id) {
            const patch: Record<string, unknown> = { ...row.data };
            if (input.autoApproveReschedules !== undefined) patch.alfredAutoApproveReschedules = !!input.autoApproveReschedules;
            if (input.autoApproveInvoiceSends !== undefined) patch.alfredAutoApproveInvoiceSends = !!input.autoApproveInvoiceSends;
            await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(row.owner_id)}`, {
              method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({ data: patch }),
            });
          }
        }
        return { success: true, saved: input.instruction };
      }
      case "set_vacation_mode": {
        const rows = await sbGet(ctx, `app_settings?select=owner_id,data${ownerScope(ctx)}&limit=1`);
        const row = rows[0];
        if (!row?.owner_id) return { error: "Couldn't find your settings to update." };
        if (input.active === false) {
          const patch = { ...row.data, vacationMode: { ...(row.data?.vacationMode || {}), active: false } };
          const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(row.owner_id)}`, {
            method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ data: patch }),
          });
          if (!res.ok) return { error: "Couldn't save — " + (await res.text().catch(() => "")).slice(0, 200) };
          return { success: true, active: false };
        }
        if (!input.startDate || !input.endDate) return { error: "startDate and endDate are required to turn vacation mode on — ask the owner for their exact dates before calling this." };
        if (!input.autonomyLevel) return { error: "autonomyLevel is required — ask the owner how they want you to handle things while they're out." };
        if (!input.checkInFrequency) return { error: "checkInFrequency is required — ask the owner how often, if at all, they want a status text while they're out." };
        const vac = {
          active: true,
          startDate: input.startDate,
          endDate: input.endDate,
          autonomyLevel: input.autonomyLevel,
          checkInFrequency: input.checkInFrequency,
          notes: input.notes || "",
          setAt: new Date().toISOString(),
        };
        const patch = { ...row.data, vacationMode: vac };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(row.owner_id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ data: patch }),
        });
        if (!res.ok) return { error: "Couldn't save — " + (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true, ...vac };
      }
      case "get_vacation_status": {
        const vac = ctx.vacationMode as any;
        if (!vac?.active) return { success: true, active: false };
        const todayStr = today();
        const isCurrentlyOut = todayStr >= vac.startDate && todayStr <= vac.endDate;
        return { success: true, active: true, isCurrentlyOut, ...vac };
      }
      case "set_autonomy_level": {
        if (!input.level) return { error: "level required (manage_everything, ask_first, or hold_everything)" };
        const rows = await sbGet(ctx, `app_settings?select=owner_id,data${ownerScope(ctx)}&limit=1`);
        const row = rows[0];
        if (!row?.owner_id) return { error: "Couldn't find your settings to update." };
        const patch = { ...row.data, alfredAutonomyLevel: input.level };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(row.owner_id)}&select=owner_id`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ data: patch }),
        });
        if (!res.ok) return { error: "Couldn't save — " + (await res.text().catch(() => "")).slice(0, 200) };
        const savedRows = await res.json().catch(() => []);
        if (!Array.isArray(savedRows) || savedRows.length === 0) return { error: "Couldn't save — settings row didn't match." };
        return { success: true, level: input.level };
      }
      case "set_reminder": {
        if (!input.message || !input.dueAtIso) return { error: "message and dueAtIso required" };
        const dueAt = new Date(input.dueAtIso);
        if (isNaN(dueAt.getTime())) return { error: "dueAtIso isn't a valid date/time." };
        if (!ctx.fromPhone) return { error: "Don't know which number to remind." };
        const recurring = input.recurring === "daily" || input.recurring === "weekly" ? input.recurring : null;
        const row = { id: crypto.randomUUID(), phone: ctx.fromPhone, message: input.message, due_at: dueAt.toISOString(), sent: false, recurring };
        const res = await sbWrite(ctx, "alfred_reminders", "POST", row);
        if (!res.ok) return { error: res.error };
        return { success: true, reminderId: row.id, dueAt: dueAt.toISOString(), recurring: recurring || undefined };
      }
      case "list_reminders": {
        const rows = await sbGet(ctx, `alfred_reminders?select=id,message,due_at${ownerScope(ctx)}&sent=eq.false&order=due_at.asc&limit=25`);
        if (rows.length === 0) return { success: true, reminders: [], summary: "No pending reminders." };
        return { success: true, reminders: rows.map((r: any) => ({ id: r.id, message: r.message, dueAt: r.due_at })) };
      }
      case "cancel_reminder": {
        if (!input.reminderId) return { error: "reminderId required" };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/alfred_reminders?id=eq.${encodeURIComponent(input.reminderId)}`, {
          method: "DELETE", headers: ctx.authHeaders,
        });
        if (!res.ok) return { error: "Couldn't cancel — " + (await res.text().catch(() => "")).slice(0, 200) };
        return { success: true };
      }
      case "get_calendar_summary": {
        const start = input.startDate || today();
        const days = Math.max(1, Math.min(30, Number(input.days) || 7));
        const end = new Date(start + "T00:00:00");
        end.setDate(end.getDate() + days);
        const endStr = end.toISOString().slice(0, 10);
        const rows = await sbGet(ctx, `jobs?select=id,customerName,status,scheduledDate,scheduledTime,address,googleEventId${ownerScope(ctx)}&scheduledDate=gte.${start}&scheduledDate=lt.${endStr}&limit=200`);
        const active = rows.filter((j: any) => j.status !== "cancelled").sort((a: any, b: any) => (a.scheduledDate + (a.scheduledTime || "")).localeCompare(b.scheduledDate + (b.scheduledTime || "")));
        const crmJobs = active.map((j: any) => ({ date: j.scheduledDate, time: j.scheduledTime, customer: j.customerName, address: j.address, status: j.status, googleEventId: j.googleEventId || null }));

        // Cross-check against the REAL Google Calendar, same discrepancy
        // logic as the in-app Alfred's version of this tool.
        const accessToken = await getGoogleAccessToken(ctx);
        if (!accessToken) {
          if (active.length === 0) return { success: true, summary: `Nothing scheduled from ${start} to ${endStr}. Google Calendar isn't connected, so this is CRM jobs only.` };
          return { success: true, jobs: crmJobs, googleCalendarConnected: false, note: "Google Calendar isn't connected, so this is CRM jobs only — mention that if asked about their real calendar." };
        }
        const googleEvents = await fetchGoogleEventsInRange(accessToken, new Date(start + "T00:00:00").toISOString(), end.toISOString());
        const jobEventIds = new Set(crmJobs.map((j: any) => j.googleEventId).filter(Boolean));
        const fetchedIds = new Set(googleEvents.map(ev => ev.id));
        const jobsNotOnGoogleCalendar = crmJobs.filter((j: any) => !j.googleEventId || !fetchedIds.has(j.googleEventId)).map((j: any) => ({ date: j.date, time: j.time, customer: j.customer }));
        const googleOnlyEvents = googleEvents.filter(ev => !jobEventIds.has(ev.id)).map(ev => ({ title: ev.title, start: ev.start, end: ev.end, location: ev.location }));
        if (active.length === 0 && googleOnlyEvents.length === 0) return { success: true, summary: `Nothing scheduled from ${start} to ${endStr}.` };
        return {
          success: true, googleCalendarConnected: true,
          crmJobs, googleOnlyEvents,
          jobsNotOnGoogleCalendar,
          note: (googleOnlyEvents.length || jobsNotOnGoogleCalendar.length)
            ? "There are discrepancies between the CRM and Google Calendar — report both lists by name/date, don't just give a job count."
            : "CRM jobs and Google Calendar agree for this range.",
        };
      }
      case "create_calendar_event": {
        const accessToken = await getGoogleAccessToken(ctx);
        if (!accessToken) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
        const durationMin = Number(input.durationMinutes) || 60;
        const startIso = `${input.date}T${input.time}:00`;
        const startDate = new Date(startIso);
        if (isNaN(startDate.getTime())) return { error: "Couldn't parse that date/time." };
        const endDate = new Date(startDate.getTime() + durationMin * 60000);
        const evRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: input.title,
            description: input.notes || "",
            start: { dateTime: startDate.toISOString() },
            end: { dateTime: endDate.toISOString() },
          }),
        });
        if (!evRes.ok) return { error: "Google Calendar error: " + (await evRes.text().catch(() => "")).slice(0, 200) };
        const evData = await evRes.json().catch(() => null) as any;
        return { success: true, eventId: evData?.id, title: input.title, date: input.date, time: input.time };
      }
      case "delete_calendar_event": {
        const accessToken = await getGoogleAccessToken(ctx);
        if (!accessToken) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
        let eventId = input.eventId;
        if (!eventId && input.title) {
          const now = new Date();
          const farOut = new Date(now.getTime() + 90 * 24 * 3600000);
          const events = await fetchGoogleEventsInRange(accessToken, now.toISOString(), farOut.toISOString());
          const q = String(input.title).toLowerCase();
          const match = events.find(ev => ev.title.toLowerCase().includes(q) && (!input.date || ev.start.slice(0, 10) === input.date));
          if (!match) return { error: `No Google Calendar event found matching "${input.title}"${input.date ? " on " + input.date : ""} — call get_calendar_summary first to see what's actually there.` };
          eventId = match.id;
        }
        if (!eventId) return { error: "Need either eventId or a title to find it by." };
        const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!delRes.ok && delRes.status !== 410) return { error: "Google Calendar error: " + (await delRes.text().catch(() => "")).slice(0, 200) };
        return { success: true, deleted: true };
      }
      case "update_calendar_event": {
        const accessToken = await getGoogleAccessToken(ctx);
        if (!accessToken) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
        let eventId = input.eventId;
        if (!eventId && input.title) {
          const now = new Date();
          const farOut = new Date(now.getTime() + 90 * 24 * 3600000);
          const events = await fetchGoogleEventsInRange(accessToken, now.toISOString(), farOut.toISOString());
          const q = String(input.title).toLowerCase();
          const match = events.find(ev => ev.title.toLowerCase().includes(q));
          if (!match) return { error: `No Google Calendar event found matching "${input.title}" — call get_calendar_summary first to see what's actually there.` };
          eventId = match.id;
        }
        if (!eventId) return { error: "Need either eventId or a title to find it by." };
        const patch: Record<string, unknown> = {};
        if (input.title) patch.summary = input.title;
        if (input.notes !== undefined) patch.description = input.notes;
        if (input.date) {
          const startDate = new Date(`${input.date}T${input.time || "09:00"}:00`);
          if (isNaN(startDate.getTime())) return { error: "Couldn't parse that date/time." };
          patch.start = { dateTime: startDate.toISOString() };
          patch.end = { dateTime: new Date(startDate.getTime() + (Number(input.durationMinutes) || 60) * 60000).toISOString() };
        }
        const patchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
          method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(patch),
        });
        if (!patchRes.ok) return { error: "Google Calendar error: " + (await patchRes.text().catch(() => "")).slice(0, 200) };
        return { success: true, eventId };
      }
      case "list_job_requests": {
        const rows = await sbGet(ctx, `job_requests?select=id,employee_id,job_id,message,status${ownerScope(ctx)}&status=eq.pending&limit=50`);
        if (rows.length === 0) return { success: true, requests: [], summary: "No pending job requests." };
        const [emps, jbs] = await Promise.all([
          sbGet(ctx, `employees?select=id,firstName,lastName${ownerScope(ctx)}&limit=200`),
          sbGet(ctx, `jobs?select=id,customerName,scheduledDate${ownerScope(ctx)}&limit=500`),
        ]);
        return {
          success: true,
          requests: rows.map((r: any) => {
            const emp = emps.find((e: any) => e.id === r.employee_id);
            const job = jbs.find((j: any) => j.id === r.job_id);
            return { id: r.id, employee: emp ? `${emp.firstName} ${emp.lastName}` : r.employee_id, job: job ? `${job.customerName} (${job.scheduledDate})` : r.job_id, message: r.message };
          }),
        };
      }
      case "respond_to_job_request": {
        if (!input.requestId || input.approve === undefined) return { error: "requestId and approve required" };
        const patch: Record<string, unknown> = { status: input.approve ? "approved" : "denied", responded_at: new Date().toISOString() };
        if (!input.approve && input.reason) patch.denial_reason = input.reason;
        const res = await fetch(`${SUPABASE_URL}/rest/v1/job_requests?id=eq.${encodeURIComponent(input.requestId)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) return { error: "Couldn't update the request — " + (await res.text().catch(() => "")).slice(0, 200) };
        // Approving assigns the employee to the job's crew, same as the CRM's own approve action.
        if (input.approve) {
          const reqRow = (await sbGet(ctx, `job_requests?id=eq.${encodeURIComponent(input.requestId)}&select=employee_id,job_id`))[0];
          if (reqRow?.job_id && reqRow?.employee_id) {
            const job = (await sbGet(ctx, `jobs?id=eq.${encodeURIComponent(reqRow.job_id)}&select=id,crew`))[0];
            if (job) {
              const crew = Array.from(new Set([...(Array.isArray(job.crew) ? job.crew : []), reqRow.employee_id]));
              await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(job.id)}`, {
                method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
                body: JSON.stringify({ crew }),
              });
            }
          }
        }
        return { success: true, status: input.approve ? "approved" : "denied" };
      }
      case "list_pending_customer_requests": {
        const rows = await sbGet(ctx, `alfred_pending_actions?status=eq.pending&select=id,customer_id,job_id,kind,proposed,created_at${ownerScope(ctx)}&order=created_at.desc&limit=25`);
        if (rows.length === 0) return { success: true, requests: [], summary: "Nothing pending." };
        const customerIds = rows.map((r: any) => r.customer_id);
        const customers = await sbGet(ctx, `customers?id=in.(${customerIds.map(encodeURIComponent).join(",")})&select=id,firstName,lastName`);
        return {
          success: true,
          requests: rows.map((r: any) => {
            const c = customers.find((x: any) => x.id === r.customer_id);
            return { requestId: r.id, customer: c ? `${c.firstName} ${c.lastName}`.trim() : "Unknown", kind: r.kind, proposed: r.proposed, createdAt: r.created_at };
          }),
        };
      }
      case "approve_customer_request": {
        if (!input.requestId) return { error: "requestId required" };
        const row = (await sbGet(ctx, `alfred_pending_actions?id=eq.${encodeURIComponent(input.requestId)}&select=id,customer_id,job_id,kind,proposed,customer_phone,status`))[0];
        if (!row) return { error: "Request not found." };
        if (row.status !== "pending") return { error: `That request was already ${row.status}.` };
        if (row.kind === "reschedule") {
          const patch: Record<string, unknown> = { scheduledDate: row.proposed.toDate };
          if (row.proposed.toTime) patch.scheduledTime = row.proposed.toTime;
          const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(row.job_id)}`, {
            method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(patch),
          });
          if (!res.ok) return { error: "Couldn't move the job — " + (await res.text().catch(() => "")).slice(0, 200) };
        }
        await fetch(`${SUPABASE_URL}/rest/v1/alfred_pending_actions?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "approved", resolved_at: new Date().toISOString() }),
        });
        const custRow = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(row.customer_id)}&select=firstName,lastName`))[0];
        const confirmMsg = `Hi ${custRow?.firstName || ""}, you're all set — we've moved your appointment to ${row.proposed.toDate}${row.proposed.toTime ? " at " + row.proposed.toTime : ""}. See you then!`;
        const smsRes = await sendSms(ctx, row.customer_phone, confirmMsg, false, { name: `${custRow?.firstName || ""} ${custRow?.lastName || ""}`.trim(), customerId: row.customer_id });
        return { success: true, ...(smsRes.ok ? {} : { notifyWarning: smsRes.error }) };
      }
      case "decline_customer_request": {
        if (!input.requestId) return { error: "requestId required" };
        const row = (await sbGet(ctx, `alfred_pending_actions?id=eq.${encodeURIComponent(input.requestId)}&select=id,customer_id,customer_phone,status`))[0];
        if (!row) return { error: "Request not found." };
        if (row.status !== "pending") return { error: `That request was already ${row.status}.` };
        await fetch(`${SUPABASE_URL}/rest/v1/alfred_pending_actions?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "declined", resolved_at: new Date().toISOString() }),
        });
        const custRow = (await sbGet(ctx, `customers?id=eq.${encodeURIComponent(row.customer_id)}&select=firstName,lastName`))[0];
        const declineMsg = `Hi ${custRow?.firstName || ""}, unfortunately that time doesn't work${input.reason ? ` (${input.reason})` : ""} — give us a call/text and we'll find something that does.`;
        const smsRes = await sendSms(ctx, row.customer_phone, declineMsg, false, { name: `${custRow?.firstName || ""} ${custRow?.lastName || ""}`.trim(), customerId: row.customer_id });
        return { success: true, ...(smsRes.ok ? {} : { notifyWarning: smsRes.error }) };
      }
      case "list_pending_approvals": {
        const rows = await sbGet(ctx, `alfred_pending_actions?status=eq.pending&kind=eq.action_confirmation&select=id,proposed,created_at${ownerScope(ctx)}&order=created_at.desc&limit=25`);
        if (rows.length === 0) return { success: true, actions: [], summary: "Nothing waiting on your approval." };
        return { success: true, actions: rows.map((r: any) => ({ actionId: r.id, summary: r.proposed?.summary || describeActionForOwner(r.proposed?.toolName, r.proposed?.input || {}), createdAt: r.created_at })) };
      }
      case "approve_pending_action": {
        if (!input.actionId) return { error: "actionId required" };
        const row = (await sbGet(ctx, `alfred_pending_actions?id=eq.${encodeURIComponent(input.actionId)}&kind=eq.action_confirmation&select=id,proposed,status`))[0];
        if (!row) return { error: "Queued action not found." };
        if (row.status !== "pending") return { error: `That action was already ${row.status}.` };
        // Executes the ORIGINAL tool call for real — executeToolCore, not
        // executeTool, deliberately bypasses the autonomy gate here (it
        // already ran once when this was queued; running it again would
        // just re-queue the same action forever instead of performing it).
        const result = await executeToolCore(ctx, row.proposed.toolName, row.proposed.input || {});
        await fetch(`${SUPABASE_URL}/rest/v1/alfred_pending_actions?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "approved", resolved_at: new Date().toISOString() }),
        });
        return { success: true, approved: true, result };
      }
      case "decline_pending_action": {
        if (!input.actionId) return { error: "actionId required" };
        const row = (await sbGet(ctx, `alfred_pending_actions?id=eq.${encodeURIComponent(input.actionId)}&kind=eq.action_confirmation&select=id,status`))[0];
        if (!row) return { error: "Queued action not found." };
        if (row.status !== "pending") return { error: `That action was already ${row.status}.` };
        await fetch(`${SUPABASE_URL}/rest/v1/alfred_pending_actions?id=eq.${encodeURIComponent(row.id)}`, {
          method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ status: "declined", resolved_at: new Date().toISOString() }),
        });
        return { success: true, declined: true };
      }
      default:
        return { error: `Unknown tool "${name}".` };
    }
  } catch (e: any) {
    return { error: e?.message || "Tool execution failed." };
  }
};

// FEATURE — "build that autonomy level thing for Alfred... every owner
// sets their own personalized permissions." The real gate: sits IN FRONT
// of executeToolCore rather than inside it, so approve_pending_action can
// call executeToolCore directly to actually perform an already-approved
// action without hitting this gate a second time. Only tools with a
// capability mapping (SMS_TOOL_CAPABILITY) — the same "creates/sends/
// changes something" set Settings → Alfred → Capabilities already
// gates — are eligible; read-only lookups, reminders, and memory are
// never held up regardless of autonomy level, same scope the existing
// capability gate already uses.
const executeTool = async (ctx: Ctx, name: string, input: Record<string, any>): Promise<any> => {
  const cap = SMS_TOOL_CAPABILITY[name];
  if (!cap || AUTONOMY_EXEMPT_TOOLS.has(name)) return executeToolCore(ctx, name, input);
  const autonomy = resolveEffectiveAutonomy(ctx);
  if (autonomy === "manage_everything") return executeToolCore(ctx, name, input);
  const summary = describeActionForOwner(name, input);
  if (autonomy === "hold_everything") {
    return { error: `Your autonomy level is set to "hold everything," so Alfred won't ${summary} on its own right now. Say "set autonomy to ask first" or "manage everything" if you want Alfred to act again.` };
  }
  // ask_first — queue it instead of running it. Reuses the same table the
  // customer-reschedule proposal flow already uses (alfred_pending_actions,
  // migration 0096 generalized it to allow a row with no customer attached).
  const id = crypto.randomUUID();
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/alfred_pending_actions`, {
    method: "POST",
    headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ id, owner_id: ctx.ownerId, kind: "action_confirmation", proposed: { toolName: name, input, summary }, status: "pending", created_at: new Date().toISOString() }),
  });
  if (!insertRes.ok) {
    // If queuing itself fails, fail safe by NOT silently skipping the
    // action — surface the error instead of either running it unconfirmed
    // or pretending it's queued when it isn't.
    return { error: "Couldn't queue this for your approval — " + (await insertRes.text().catch(() => "")).slice(0, 200) };
  }
  return { success: true, awaitingApproval: true, actionId: id, summary, message: `Queued for your approval — I'll ${summary} once you approve it. Reply "approve" or "list pending approvals".` };
};

// ─── Conversation persistence ──────────────────────────────────────────────

// BUG FIX — "do you remember what we talked about yesterday?" should get
// a real yes/no, not a guess. Two gaps caused this to fail: (1) stored
// messages carried no timestamp at all, so even when yesterday's exchange
// WAS still visible, the model had no way to know it was yesterday rather
// than five minutes ago; (2) the whole stored history was hard-trimmed to
// the last 16 messages on every save — yesterday's conversation didn't
// just leave the model's view, it was permanently deleted. ts is now
// stored per message (used to render a real relative-time label injected
// into what the model sees — see withTimeLabels below), and per explicit
// request, the FULL history is kept forever in storage (plain text SMS
// messages are trivially small — this isn't the kind of data that
// meaningfully costs storage) — only the PROMPT sent to the model is
// windowed (PROMPT_WINDOW), purely to keep token cost/latency sane, never
// as a storage decision. recall() is the explicit fallback for anything
// older than the prompt window, called out in the system prompt.
const PROMPT_WINDOW = 40;
type ThreadMsg = { role: string; content: string; ts?: number };

// Full stored history, never trimmed.
const loadFullThread = async (ctx: Ctx, phone: string): Promise<ThreadMsg[]> => {
  if (!ctx.ownerId) return [];
  const rows = await sbGet(ctx, `alfred_sms_threads?owner_id=eq.${encodeURIComponent(ctx.ownerId)}&phone=eq.${encodeURIComponent(phone)}&select=messages&limit=1`);
  const msgs = rows[0]?.messages;
  return Array.isArray(msgs) ? msgs : [];
};

const saveThread = async (ctx: Ctx, phone: string, messages: ThreadMsg[]) => {
  if (!ctx.ownerId) return;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/alfred_sms_threads?owner_id=eq.${encodeURIComponent(ctx.ownerId)}&phone=eq.${encodeURIComponent(phone)}`, {
    method: "PATCH", headers: { ...ctx.authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ messages, updated_at: new Date().toISOString() }),
  });
  const updated = await res.json().catch(() => []);
  if (!res.ok || !Array.isArray(updated) || updated.length === 0) {
    await sbWrite(ctx, "alfred_sms_threads", "POST", { owner_id: ctx.ownerId, phone, messages, updated_at: new Date().toISOString() });
  }
};

// Renders a real relative-day label ("Today 2:14 PM" / "Yesterday 9:02 AM"
// / "Mon Aug 24") in front of each stored message's content before it goes
// to the model — the stored content itself is left untouched (this is
// display-only, applied fresh each time history is loaded) so re-labeling
// logic changes don't require a data migration.
const relativeDayLabel = (ts: number): string => {
  const d = new Date(ts);
  const now = new Date();
  const dayMs = 86400000;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / dayMs);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays > 1 && diffDays < 7) return `${d.toLocaleDateString([], { weekday: "long" })} ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
};
const withTimeLabels = (msgs: ThreadMsg[]): Array<{ role: string; content: string }> =>
  msgs.map(m => ({
    role: m.role,
    content: (m.role === "user" && m.ts) ? `[${relativeDayLabel(m.ts)}] ${m.content}` : m.content,
  }));

// BUG FIX — the timeout/round-cap fallback used to log raw tool names
// verbatim ("get_calendar_summary: done"), which read as garbled/one-word
// nonsense to the owner and, worse, threw away real data the tool call had
// already successfully returned (e.g. get_calendar_summary's job list) —
// exactly what happened on a voice-memo "what's on my calendar this week"
// request that ran out of time on the very next round. Humanize the tool
// name AND prefer whatever real content the tool already gave back
// (summary/note text, or a short digest of a jobs/crmJobs list) over a bare
// "done", so a timeout still relays the actual answer whenever one exists.
const humanizeToolName = (name: string): string => name.replace(/_/g, " ");
const summarizeToolResult = (name: string, out: any): string => {
  const label = humanizeToolName(name);
  if (out?.error) return `${label} — failed: ${out.error}`;
  const jobList: any[] | undefined = Array.isArray(out?.jobs) ? out.jobs : Array.isArray(out?.crmJobs) ? out.crmJobs : undefined;
  if (jobList) {
    if (jobList.length === 0) return `${label} — nothing found.`;
    const digest = jobList.slice(0, 5).map(j => `${j.date || ""}${j.time ? " " + j.time : ""} ${j.customer || j.address || ""}`.trim()).join("; ");
    return `${label} — ${digest}${jobList.length > 5 ? ` (+${jobList.length - 5} more)` : ""}`;
  }
  if (typeof out?.summary === "string" && out.summary) return `${label} — ${out.summary}`;
  if (typeof out?.note === "string" && out.note) return `${label} — ${out.note}`;
  return `${label} — done`;
};

// ─── Main entry point ──────────────────────────────────────────────────────

export const runAlfredSmsAgent = async (
  ctx: Ctx,
  modelKeys: Record<string, string>,
  modelPriority: string[] | undefined,
  activeModel: string | undefined,
  fromPhone: string,
  incomingText: string
): Promise<string> => {
  ctx.modelKeys = modelKeys;
  ctx.turnStartedAt = Date.now();
  ctx.directSendsThisTurn = 0;
  // Same ordering rule as the in-app Alfred (AlfredPage.tsx FIX 20):
  // modelPriority is the real order, activeModel is only consulted as a
  // fallback when no priority list is saved — activeModel does not jump
  // the queue. Any other model with a key but not in the priority list
  // still gets tried, just last.
  const priority = (modelPriority && modelPriority.length ? modelPriority : (activeModel ? [activeModel] : DEFAULT_MODEL_PRIORITY));
  const extra = Object.keys(SMS_MODELS).filter(mid => !priority.includes(mid) && !!modelKeys?.[mid]);
  const chain = [...priority, ...extra].filter(mid => SMS_MODELS[mid] && !!modelKeys?.[mid]);

  if (chain.length === 0) {
    return "Alfred over text needs an AI model API key set in Settings → AI Models (any provider — Claude, GPT-4o, Gemini, Groq, Mistral, or a free NVIDIA model like Kimi) — add one there and text again.";
  }

  const fullHistory = await loadFullThread(ctx, fromPhone);
  // messages = the full history plus this turn — what actually gets
  // persisted at the end (see saveThread call below). The model itself
  // only ever sees the last PROMPT_WINDOW of it (via convMessages further
  // down) — a token/latency limit, not a memory limit.
  const messages: ThreadMsg[] = [...fullHistory, { role: "user", content: incomingText, ts: Date.now() }];

  // Auto-inject standing "from now on" preferences (set_standing_preference)
  // into every conversation, instead of relying on the model to remember to
  // call recall on its own — a "from now on" instruction that only applies
  // when Alfred happens to think to look it up isn't actually persistent.
  let preferencesBlock = "";
  try {
    const prefs = await sbGet(ctx, `alfred_memory?select=text${ownerScope(ctx)}&category=eq.preference&order=created_at.desc&limit=15`);
    if (prefs.length > 0) {
      preferencesBlock = `\n\nSTANDING PREFERENCES the owner has told you to always follow (most recent first — a later one about the same topic overrides an earlier one):\n` + prefs.map((p: any) => `- ${p.text}`).join("\n");
    }
  } catch { /* non-fatal — proceed without preferences rather than fail the whole reply */ }

  // FEATURE — "the web chat and SMS should share memory." alfred_memory
  // (remember/recall/set_standing_preference, above) was already shared —
  // both channels read/write the exact same owner_id-scoped table. What
  // wasn't shared was awareness of the RAW conversation itself: texting
  // Alfred had no idea what was just discussed in the in-app chat a few
  // minutes earlier, and vice versa. This pulls the single most recently
  // updated web conversation (if touched in the last 48h) and summarizes
  // its last few exchanges into the system prompt — a short digest, not
  // the full transcript, so it doesn't blow up token cost on every text.
  let crossChannelBlock = "";
  try {
    const recentWebConvos = await sbGet(ctx, `alfred_conversations?select=title,messages,updated_at${ownerScope(ctx)}&order=updated_at.desc&limit=1`);
    const convo = recentWebConvos[0];
    if (convo?.updated_at && Date.now() - new Date(convo.updated_at).getTime() < 48 * 3600000 && Array.isArray(convo.messages) && convo.messages.length > 0) {
      const tail = convo.messages.slice(-6).map((m: any) => `${m.role === "alfred" ? "Alfred" : "Owner"}: ${String(m.content || "").slice(0, 200)}`).join("\n");
      crossChannelBlock = `\n\nRECENT ACTIVITY IN THE IN-APP CHAT (web, not this text thread — "${convo.title || "conversation"}", updated ${relativeDayLabel(new Date(convo.updated_at).getTime())}):\n${tail}\nThis is a DIFFERENT conversation channel than this SMS thread — treat it as background context on what the owner's been doing/asking about recently, not as literal history of THIS text conversation.`;
    }
  } catch { /* non-fatal — proceed without cross-channel context */ }

  const nowLocal = new Date().toISOString();
  const personalityClause = PERSONALITY_PROMPTS[ctx.alfredPersonality || "drillsergeant"] || PERSONALITY_PROMPTS.drillsergeant;
  const systemPrompt = `You are Alfred, the AI assistant for ${ctx.companyName}, a service business — texting back and forth with the OWNER over SMS while they're away from the CRM. ${personalityClause} The current date/time is ${nowLocal} (UTC). Use tools aggressively to actually read and modify the CRM — never just describe what you'd do. Keep replies SHORT (this is a text message, 1-3 sentences per item, no markdown) — the personality above shapes TONE, not length; still fit within that limit. If a tool result has an "error" field, tell the owner exactly what went wrong — do not claim success, and do not guess or describe an action vaguely if you're not certain the tool actually returned "success": true. When you finish an action, confirm plainly what happened.

CASUAL CONVERSATION: the owner can talk to you like a person, not just issue commands — "how's it going", a joke, venting about their day, a random question with nothing to do with the business. Actually engage with it in your own personality's voice; never refuse or deflect with something like "I'm not programmed for that" — you're not limited to business tasks, tools are just what you reach for when a request actually needs one. Nothing above about being terse/professional/etc. means refusing to talk — it only shapes HOW you say things, never WHETHER you're willing to.${preferencesBlock}${crossChannelBlock}

STANDING PREFERENCES: when the owner says something like "from now on...", "always...", "don't ask me about... anymore", or "call me...", that's a persistent instruction, not just for this one reply. First figure out whether it's really about your overall autonomy level (how much you check in before acting — "always ask before texting customers," "just handle it yourself from now on") vs. a narrower specific rule (everything else). A broad autonomy statement → set_autonomy_level. A narrower rule → set_standing_preference (it'll be listed above automatically in every future conversation from then on). Either way, send back ONE short confirming text first ("So from now on you want me to always ask before texting a customer about price — right?") and only call the tool once they reply yes — don't save it on the first message alone, and don't make them repeat the request a second time from scratch if they just say yes.

VACATION MODE: when the owner says they're going on vacation, taking time off, or will be unreachable, DO NOT guess the details — walk them through it one or two questions at a time over text (how long/what dates, how they want you to handle things while they're out, how often to check in with them) and only call set_vacation_mode once you actually have their answers, then confirm the plan back in one short text. ${ctx.vacationMode?.active ? `VACATION MODE IS CURRENTLY ${(today() >= (ctx.vacationMode.startDate || "") && today() <= (ctx.vacationMode.endDate || "")) ? "ACTIVE" : "SCHEDULED"} — out ${ctx.vacationMode.startDate} to ${ctx.vacationMode.endDate}, autonomy: ${ctx.vacationMode.autonomyLevel}, check-ins: ${ctx.vacationMode.checkInFrequency}${ctx.vacationMode.notes ? ", notes: " + ctx.vacationMode.notes : ""}.` : `Vacation mode is currently off. GENERAL (STANDING) AUTONOMY LEVEL: ${ctx.alfredAutonomyLevel || "manage_everything"}.`} This is ENFORCED in code, not just a tone guideline — a capability-gated action (texting/emailing someone, money changes, schedule/crew changes, automations) under ask_first gets automatically queued instead of run, and under hold_everything gets refused outright; you don't need to self-censor those calls, the system handles it and tells you what happened. Just make the call naturally and relay whatever it reports back (done / queued for approval / on hold) — never claim something is done unless the tool result actually said so. The owner can change the standing level anytime by saying things like "always ask me first" or "you can handle things yourself" (set_autonomy_level), separate from vacation mode (set_vacation_mode, which only overrides it temporarily). If they ask what's waiting on them, or reply "approve"/"yes" after something got queued, use list_pending_approvals/approve_pending_action/decline_pending_action.

MULTI-PART REQUESTS: when a single text asks for several distinct things ("who's working, AND create this customer, AND quote them, AND text it"), treat each as its own tool call and report EACH ONE'S real outcome by name in your reply — don't roll them into one vague summary line, and never describe a step as done unless its own tool result actually said so. If one step's tool result is an "error", say exactly which step failed and why, but still report the outcome of every OTHER step you did complete — don't let one failure make the whole reply vague about what did or didn't happen.

CLARIFYING QUESTIONS: if a request is missing something a tool needs (which customer, which date, which job when there are several matches), ask ONE short, specific question instead of guessing — then stop and wait for their reply. The full conversation history is remembered, so when they answer, pick up exactly where you left off and finish the original request; don't make them repeat themselves.

CONVERSATION MEMORY — this matters, get it right: every one of the owner's own messages below is prefixed with a real timestamp like "[Yesterday 2:14 PM]" or "[Monday 9:02 AM]" — that's ACTUAL when they sent it, not a guess. When asked something like "do you remember what we talked about yesterday" or "what did I ask you earlier", look at those real timestamps and answer from what's actually there — say specifically what it was, don't just say "yes I remember" with no content, and don't say "no" if it's genuinely visible above. If the conversation shown to you doesn't go back far enough to cover what they're asking about (nothing here is from that day), call recall first — the answer may be saved there from a previous session — before telling them you don't have it. Never claim to remember something you can't actually verify from either the visible history or a recall() result.

FOLLOWING UP LATER: you are not limited to replying only in this exact moment. If a task naturally needs a check-in later (e.g. "did the crew actually show up", "nudge me if Mike hasn't replied by 3", "nudge me if [job] isn't marked done by tonight"), use set_reminder to text yourself — meaning the owner — back at that time, resolving any relative time ("in 20 min", "by 3pm", "tonight") into an exact ISO datetime using the current date/time above. This is a real scheduled text, not just a note — use it whenever the owner asks to be followed up with, checked on, or reminded about something, even mid-conversation. For a standing "from now on, every day at X..." request, pass recurring: "daily" (or "weekly") on the same tool — it repeats indefinitely, not just once.

CUSTOMER REQUESTS AWAITING YOU: some customers have Alfred auto-response turned on for texting directly with them — when one of them asks to reschedule, that Alfred (a separate, more restricted agent) proposes it to YOU here rather than committing to anything itself, and texts you the details. If the owner replies "yes"/"sure"/"that works" (or similar) without more context, and there's a recent proposal in this conversation, that's almost always what they're confirming — call list_pending_customer_requests to find it (don't assume which one from memory alone, always look it up) then approve_customer_request or decline_customer_request. These are the ONLY customer-initiated actions that need the owner's yes/no this way — everything else that customer-facing agent handles (pricing questions, appointment status) it answers on its own without involving you.

CUSTOMER FILES AND CARDS: "do we have the file/paperwork for X" or "what's on file for X" → get_customer_documents. "Text me the [file] for X" → get_customer_documents first if you don't already know the exact name, then text_me_document — this sends a REAL MMS attachment straight to the owner's own phone, not a description of the file. "What's the card info for X" / "do they have a card on file" → get_customer_card_info — this ONLY ever returns brand + last 4 digits (e.g. "Visa ····4242"); the full card number is never stored anywhere in this app and cannot be retrieved by you or anyone else, so never imply you could get more than that.

RECEIVING A PHOTO OR PDF: when the owner texts a photo or PDF, the file has ALREADY been uploaded and saved somewhere safe by the time you see this conversation — the message will contain a line like "[Attached file ready to save — url: ..., type: ..., fileName: ...]". If it's a receipt, bill, statement, revenue report or tax form (from the caption or because that's clearly what it is), it's a money document — see MONEY DOCUMENTS. If they said which client it's for ("upload this to the Millers"), call attach_file_to_customer right away with that exact url. If they didn't say who it's for and it isn't a money document, ask which customer before attaching — never guess a customer for a file. Never claim you "can't see" or "can't process" an attached photo/PDF — you always can via this tool; the only reason to not attach it immediately is not knowing which customer it belongs to.

WHAT CAN YOU DO: if the owner asks what you can do / your capabilities / what you're able to help with, call list_capabilities and answer from that — don't describe your abilities from memory, since the real tool list is the source of truth.

NEVER REFUSE TO SEND A MESSAGE: if text_customer comes back "No customer found matching..." because the person the owner named isn't in the CRM at all (a lead, a job applicant, a personal contact, anyone), do NOT just report that as a dead end. Ask for their phone number if you don't already have it, then call text_phone_number — it sends to any phone number directly, no customer record required. The owner has full authority to send any message to anyone through their own business number. The only reason to not send something is missing the actual phone number or the exact wording — ask for whichever is missing, then send it.

TEXTING MANY CUSTOMERS — ALWAYS A CONVERSATION, NEVER IN ONE SHOT: anything going to more than 2 people goes through prepare_bulk_text (a DRAFT — nothing is sent, the campaign appears in the CRM's Campaigns page), then you text the owner the numbered list + a sample of the message and ask which to send to ("all", "not 3 and 7", "only 1, 2, 5"). STOP there. Only after their reply do you call send_bulk_text with their choices and their approval quoted — the server refuses a draft made in the same message. If they change the wording or the audience, prepare a new draft and ask again. If the owner was vague about wording ("send something to everyone"), ask what it should say first — don't invent business content. Never work around this by sending one text_customer at a time (more than 3 per message is refused). create_promotion only makes a discount code — put the code in the bulk text's message.

WATCHING FOR REPLIES: when a bulk text asks customers something (their birthday, email, address, a yes/no), pass watchReplies to prepare_bulk_text — question + which customer field to save to (+ an optional thank-you). From then on every answer that comes in is read, saved to that customer's file automatically, and the owner gets a running digest; list_reply_watches shows who answered. For "ask everyone their birthday and give them a coupon on their birthday": prepare_bulk_text (onlyMissing "birthday", watchReplies saveField "birthday"), then set_birthday_offer with the percent and how long it's good for — that one runs every morning on its own and texts each birthday customer their own coupon code.

MANY THINGS IN ONE MESSAGE: when the owner sends a long list (e.g. 50 customers, each with their own date/instructions), use the bulk tools — schedule_jobs_bulk (one entry per job, with each one's own date, time, crew, notes, checklist, tags, recurring), create_customers_bulk, update_customers_bulk — in as few calls as possible, carrying every detail they gave for each one. Don't drop or merge per-customer instructions, don't ask them to send it in pieces, and don't stop halfway: keep calling tools until every item is done, then report the totals plus any that failed by name.

CAMPAIGNS AND GOALS: create_campaign puts a draft/scheduled campaign in the CRM's Campaigns page; create_goal puts a goal in the Goals page (business metrics like revenue/jobs/clients track themselves). Never say you created one unless the tool returned success — if it says the records table isn't set up, tell the owner exactly that.

WHOLE-CRM QUESTIONS: you can scan every customer at once — never say you can only check names the owner gives you. Duplicates → find_duplicate_customers. "Do I have anyone like…" → search_customers. "Who's missing info" → customers_missing_info. "Customers who / in / with …" → filter_customers. Text the count first, then the names (keep it short; offer to text the full list).

PERSONAL VS. BUSINESS: while the owner is working through business (jobs, customers, quotes, scheduling), stay on it — don't drift into sleep, workouts, mood or personal reminders. get_accountability_summary is for check-ins, the morning briefing, reflections, or when they ask. Personal reminders ("remind me to call Mom Sunday at 6") use set_reminder like any reminder.

MONEY DOCUMENTS: when the owner sends a photo, screenshot or PDF of a receipt, bill, bank/card statement, revenue report or tax paperwork, call import_financial_document with its url — expenses land in Expenses, income in Budget, tax figures are remembered. Report what was imported (counts and totals). Spoken/typed expenses → log_expenses.

You can: text the owner back on request (text_me), remember arbitrary facts/notes for later (remember/recall — use this whenever they say "remember", "keep track of", or "note that"), save persistent "from now on" instructions that apply to every future conversation (set_standing_preference — see above), schedule future text reminders/follow-ups (set_reminder; list_reminders/cancel_reminder manage existing ones), summarize the schedule (get_calendar_summary), add a non-job event to the owner's real Google Calendar (create_calendar_event — use schedule_job instead for an actual service job tied to a customer), review/approve or deny employee job requests (list_job_requests, respond_to_job_request), resolve customer requests awaiting approval (list_pending_customer_requests, approve_customer_request, decline_customer_request — see above), message many customers at once or run a promotion (notify_all_customers, create_promotion — see above), and turn on automatically texting a review-request link a couple days after a job's marked complete (enable_review_request_automation — a real deterministic automation, not something you have to remember to do yourself each time). Core CRM actions: create/reschedule/cancel jobs, reprioritize a job, look up full job or customer detail (get_job_details, get_customer_details), add a checklist item, assign employees, create customers, check who's clocked in and what they're working on, and create/send quotes and invoices (create_estimate then send_estimate — two steps, creating one does NOT notify the customer). Quotes can require a deposit — pass depositPercent or depositAmount to create_estimate, or change one on an existing quote with set_estimate_deposit; never say deposits aren't supported. Use whichever tool actually matches what's being asked, and don't hesitate to chain several tool calls in one exchange if the request needs it (e.g. reschedule a job AND text the customer AND remember a preference). You can also receive and understand voice memos sent as a text — they're transcribed automatically before you ever see them, so just respond to the transcribed content normally.

BE CONCISE — this is a text message, and every extra sentence costs real API tokens. One short line per part of the request is enough (e.g. three parts to a request → three short checkmark lines, one per part, using the REAL names/numbers from what you actually did — never a placeholder or example name) — no throat-clearing, no restating the question, no closing pleasantries.

CRITICAL — NEVER INVENT A CUSTOMER: only call create_customer with a name the owner actually gave you in THIS conversation. If a request names a customer who isn't already in the CRM (e.g. "for my client John Smith" and no match comes back), create that customer using exactly that name — do not substitute, invent, or default to any other name for any reason.`;

  let finalText = "";
  let succeeded = false;
  // Plain-English log of what actually happened, built up across every tool
  // call in every round/model attempt — used to build a real (not vague)
  // fallback reply if we run out of time/rounds before the model itself
  // produces a closing text-only reply. Each entry is already the concise,
  // human-readable outcome of one action.
  const stepLog: string[] = [];
  // Owner reports (per the note this fixes) that "huge" multi-action texts
  // sometimes get NO reply at all. 10 rounds × up to a handful of models,
  // each round doing real network round-trips (LLM + several Supabase
  // calls), can run long enough to hit the Cloudflare Function's execution
  // ceiling — which kills this whole background task outright, so none of
  // the try/catch below ever gets a chance to run and nothing is ever sent.
  // A hard wall-clock budget, checked before every round/model, means we
  // always bail out with SOMETHING (built from stepLog) well before that
  // ceiling, instead of gambling the entire reply on finishing in time.
  const overallDeadline = Date.now() + 85_000;

  // Try each configured provider in priority order — a failure (bad key,
  // provider outage, timeout) falls through to the next one instead of
  // just failing the whole text, same failover behavior as in-app Alfred.
  for (const modelKey of chain) {
    if (Date.now() > overallDeadline) break;
    const apiKey = modelKeys[modelKey];
    const def = SMS_MODELS[modelKey];
    let rounds = 0;
    let localFinal = "";
    // Windowed + time-labeled for the model (see withTimeLabels) —
    // `messages` itself (full, unwindowed, real ts) is what actually gets
    // persisted via saveThread below, so neither the window nor the label
    // text ever affects what's stored, only what the model sees per call.
    let convMessages: Array<{ role: string; content: any }> = withTimeLabels(messages.slice(-PROMPT_WINDOW));
    let modelFailed = false;

    // BUG FIX — this was capped at 4 rounds total, including the FINAL
    // text-only round that actually produces the reply. A request needing
    // more than ~3 tool calls (e.g. "who's working, create this customer,
    // quote them $400, text it to them" — 4 separate tool calls on its own)
    // hit the cap mid-chain: the loop exited after round 4's tool call
    // with no further round ever run to write a real closing reply or
    // finish the remaining steps. Whatever text happened to be sitting in
    // `localFinal` from an earlier round (tool-calling rounds don't
    // reliably include any) got sent as the "answer" — explaining replies
    // that described actions vaguely or wrongly (a customer really did get
    // created; the SMS quote never actually got sent) with no error
    // surfaced anywhere. Twilio's own webhook timeout doesn't constrain
    // this — the whole thing already runs in the background via waitUntil
    // and the real reply goes out as its own follow-up text once ready,
    // not as the webhook response itself.
    let ranOutOfTime = false;
    while (rounds < 16) {
      if (Date.now() > overallDeadline) { ranOutOfTime = true; break; }
      rounds++;
      // A hung provider call (no error, no response) would otherwise burn
      // an unbounded amount of time silently. Hard-cap each individual
      // call so a stuck round fails fast and falls over to the next model
      // instead of the SMS just never arriving with no clue why.
      const controller = new AbortController();
      // 45s, not 12s: a reply that carries 50 jobs in one tool call takes
      // a while to write.
      const abortTimer = setTimeout(() => controller.abort(), 45000);
      try {
        const result = await Promise.race([
          callSmsModel(modelKey, apiKey, systemPrompt, convMessages, def.supportsTools ? TOOLS : []),
          new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("timed out")))),
        ]);
        clearTimeout(abortTimer);
        if (result.text) localFinal = result.text;
        if (result.toolUses.length > 0 && result.stopReason === "tool_use") {
          convMessages.push({ role: "assistant", content: result.raw });
          const results = await Promise.all(result.toolUses.map(async (tu) => {
            const out: any = await executeTool(ctx, tu.name, tu.input || {});
            stepLog.push(summarizeToolResult(tu.name, out));
            return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out) };
          }));
          convMessages.push({ role: "user", content: results });
          continue;
        }
        break;
      } catch (e: any) {
        clearTimeout(abortTimer);
        console.error(`[AlfredSms] ${def.name} call failed:`, e?.message);
        modelFailed = true;
        break;
      }
    }

    if (ranOutOfTime) break;
    if (!modelFailed) {
      finalText = localFinal;
      succeeded = true;
      break;
    }
  }

  // Guaranteed plain-English reply in every case — never leave the owner
  // with total silence. If we have real completed steps to report (from
  // stepLog) but never got a proper closing reply from the model (timed
  // out, hit the round cap, or every provider failed partway through),
  // report exactly what actually happened instead of a vague apology.
  if (!succeeded || !finalText) {
    if (stepLog.length > 0) {
      finalText = "Didn't finish everything in time, but here's what went through: " + stepLog.join("; ") + ".";
    } else if (!succeeded) {
      finalText = "Sorry, I hit an error reaching every configured AI model — try again in a bit, or check your API keys in Settings → AI Models.";
    } else {
      finalText = "Done.";
    }
  }
  await saveThread(ctx, fromPhone, [...messages, { role: "assistant", content: finalText, ts: Date.now() }]);
  return finalText;
};
