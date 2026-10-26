// SECURITY FIX — moves the actual AI-provider API call server-side so the
// real API key never has to live in browser-readable state again. Every AI
// model key (Claude/OpenAI/Gemini/Groq/Mistral/NVIDIA/OpenRouter) used to
// live in app_settings.data (JSONB), readable by every one of an owner's own
// signed-in employees — see migration 0085's comment for the full story.
// This is a server-side port of lib/api.ts's callModel — same provider
// dispatch logic, same request/response shape — with the key resolved here
// via owner_secrets instead of accepted from the client. lib/api.ts's own
// callModel is now a thin authenticated proxy to this endpoint, so every
// existing call site (AlfredPage.tsx, EmployeePortal.tsx's voice-checklist
// AI match, VisualWorkflowBuilder.tsx's AI Draft) needed ZERO changes.
//
// Usable by any authenticated CRM session (owner OR employee) — Alfred and
// the voice-checklist feature are both already legitimately used by
// employees today; the point of this fix is hiding the KEY, not restricting
// who gets to use the AI features it powers (same reasoning as Twilio SMS
// sending already being employee-usable via twilio-send.ts).

import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";
import { MODELS } from "./_lib/modelSlots";
import { loadModelOverrides, effectiveModel, nvidiaFallbacks } from "./_lib/modelOverrides";

// The model table lives in _lib/modelSlots.ts (shared with the model watch).

const OPENROUTER_FREE_FALLBACKS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  // OpenRouter's own free router: picks whichever free model is up.
  "openrouter/free",
];

let openRouterFreeModelsCache: string[] | null = null;
let openRouterFreeModelsFetchedAt = 0;
const OPENROUTER_CATALOG_TTL_MS = 30 * 60 * 1000;
const getOpenRouterFreeModels = async (): Promise<string[]> => {
  if (openRouterFreeModelsCache && Date.now() - openRouterFreeModelsFetchedAt < OPENROUTER_CATALOG_TTL_MS) return openRouterFreeModelsCache;
  try {
    const res = await fetchWithTimeout("https://openrouter.ai/api/v1/models", {}, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json() as { data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string }; supported_parameters?: string[] }> };
    const free = (j.data || [])
      .filter(m => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
      .filter(m => (m.supported_parameters || []).includes("tools") || (m.supported_parameters || []).includes("tool_choice"))
      .map(m => m.id);
    if (free.length > 0) { openRouterFreeModelsCache = free; openRouterFreeModelsFetchedAt = Date.now(); return free; }
    throw new Error("no free tool-capable models");
  } catch { return []; }
};

// FEATURE — "any API key you use, specifically OpenRouter, works for
// screenshots too." OpenRouter's own /models catalog (same public,
// unauthenticated, CORS-open endpoint getOpenRouterFreeModels already
// uses) publishes each model's real input modalities under
// architecture.input_modalities — filtering on "image" there, instead of
// tool support, is how a vision request picks a model that can actually
// see the picture instead of silently ignoring it. Kept as its own cache
// (not merged with the tool-capable list) since a vision-capable model
// isn't necessarily tool-capable and vice versa — the image-analysis
// calls that use this list never pass `tools` anyway.
let openRouterFreeVisionModelsCache: string[] | null = null;
let openRouterFreeVisionModelsFetchedAt = 0;
const getOpenRouterFreeVisionModels = async (): Promise<string[]> => {
  if (openRouterFreeVisionModelsCache && Date.now() - openRouterFreeVisionModelsFetchedAt < OPENROUTER_CATALOG_TTL_MS) return openRouterFreeVisionModelsCache;
  try {
    const res = await fetchWithTimeout("https://openrouter.ai/api/v1/models", {}, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json() as { data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string }; architecture?: { input_modalities?: string[] } }> };
    const free = (j.data || [])
      .filter(m => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
      .filter(m => (m.architecture?.input_modalities || []).includes("image"))
      .map(m => m.id);
    if (free.length > 0) { openRouterFreeVisionModelsCache = free; openRouterFreeVisionModelsFetchedAt = Date.now(); return free; }
    throw new Error("no free vision-capable models");
  } catch { return []; }
};

// Anthropic-shaped content blocks are this app's one neutral wire format
// for a multimodal message (every client call site — the Alfred screenshot/
// receipt analyzer — builds this shape regardless of which model will
// actually receive it). True per-provider request format is only decided
// here, server-side, so a new provider only ever needs a translator added
// in ONE place.
type AnthropicBlock = { type: string; text?: string; source?: { type: string; media_type?: string; data?: string } };
const hasImageBlock = (messages: Array<{ role: string; content: unknown }>): boolean =>
  messages.some(m => Array.isArray(m.content) && (m.content as AnthropicBlock[]).some(b => b.type === "image"));

const extractErrorMessage = (text: string, status: number): string => {
  try {
    const j = JSON.parse(text);
    const msg = j?.detail || j?.error?.message || j?.error || j?.message || j?.title;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch { /* not JSON */ }
  return text.slice(0, 200) || `Request failed (${status})`;
};

// BUG FIX (user report — "I sent 2 screenshots, he said 'analyzing
// screenshot 1 of 2' and never did anything else, just sat there.") None
// of this file's outbound fetches (to Anthropic/OpenAI/Google/OpenRouter,
// or OpenRouter's own /models catalog) ever had a timeout — a free
// OpenRouter vision model silently hanging (common; free-tier models are
// flaky) meant this Worker just sat awaiting a response with nothing to
// ever move it along. The CLIENT'S OWN AbortController (see AlfredPage.tsx's
// callVisionModel) does eventually kill ITS fetch to this endpoint, but
// that only ends the browser's wait — it does nothing to stop THIS
// function's separate, already-in-flight fetch to the actual provider,
// which is the one really stuck. Give every outbound call here its own
// bounded timeout so a dead provider fails fast instead of hanging.
const fetchWithTimeout = async (url: string, opts: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === "AbortError") throw new Error(`Request to ${new URL(url).hostname} timed out.`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const safeFetch = async (url: string, opts: RequestInit, timeoutMs = 25000): Promise<any> => {
  const res = await fetchWithTimeout(url, opts, timeoutMs);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`HTTP ${res.status}: ${extractErrorMessage(text, res.status)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

// BUG FIX (user report — a big trash-can client import sent to Alfred
// failed with "Request to integrate.api.nvidia.com timed out"). Every text
// request got the same 20-25s limit, but a long pasted list plus Alfred's
// full tool list can take a free NVIDIA/OpenRouter model well over a
// minute to answer. The limit now grows with the size of the request
// (45s for a normal message, up to 110s for a very large one). Waiting on
// the provider costs no Worker CPU time, so this only changes how long a
// genuinely dead provider takes to be given up on.
const requestTimeoutMs = (body: { systemPrompt?: string; messages: unknown; tools?: unknown[] }) => {
  const size = (body.systemPrompt || "").length + JSON.stringify(body.messages || []).length + JSON.stringify(body.tools || []).length;
  return Math.min(110000, 45000 + Math.floor(size / 1000) * 1000);
};

// Same NVIDIA key works for every model on build.nvidia.com, so when the
// chosen one times out or is overloaded, a faster one gets the same request
// before Alfred moves on to a different provider.
const NVIDIA_FALLBACKS = ["nvidia/nemotron-3.5-lightning-30b-a3b", "deepseek-ai/deepseek-v4.1-flash"];

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var." }, 500);
  try {
    const body = await context.request.json() as {
      modelId: string; systemPrompt?: string; messages: Array<{ role: string; content: unknown }>;
      tools?: unknown[]; maxTokens?: number;
    };
    const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const ownerId = await resolveCallerOwnerId(accessToken);
    if (!ownerId) return json({ error: "Not signed in." }, 401);

    // A model the provider retired is swapped for a working one by the model watch.
    await loadModelOverrides(serviceRoleKey);
    const def = effectiveModel(body.modelId, MODELS[body.modelId]);
    if (!def) return json({ error: `Unknown model key: "${body.modelId}"` }, 400);
    const secrets = await getOwnerSecrets(ownerId, serviceRoleKey);
    const apiKey = secrets?.modelKeys?.[body.modelId] || "";
    const maxTokens = body.maxTokens ?? 4096;

    if (def.provider === "anthropic") {
      if (!apiKey) return json({ error: "No Anthropic API key set. Go to Settings → AI Models and paste your Anthropic API key." }, 400);
      const reqBody: Record<string, unknown> = { model: def.modelId, max_tokens: maxTokens, messages: body.messages };
      if (body.systemPrompt) reqBody.system = body.systemPrompt;
      if (body.tools?.length) reqBody.tools = body.tools;
      const data = await safeFetch(def.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(reqBody),
      }, requestTimeoutMs(body));
      const text = data.content?.find((b: any) => b.type === "text")?.text ?? "";
      const toolUses = (data.content ?? []).filter((b: any) => b.type === "tool_use").map((b: any) => ({ id: b.id, name: b.name, input: b.input ?? {} }));
      return json({ text, toolUses, stopReason: data.stop_reason ?? "end_turn", raw: data.content });
    }

    if (def.provider === "google") {
      if (!apiKey) return json({ error: "No Google AI API key — add one in Settings → AI Models." }, 400);
      const contents = body.messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => {
          if (typeof m.content === "string") return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
          if (Array.isArray(m.content) && (m.content as any[])[0]?.type === "tool_result") {
            const parts = (m.content as Array<{ tool_use_id: string; content: string }>).map(tr => ({
              functionResponse: { name: tr.tool_use_id, response: (() => { try { return JSON.parse(tr.content); } catch { return { result: tr.content }; } })() },
            }));
            return { role: "user", parts };
          }
          // BUG FIX (user report — "any API key... should work for
          // screenshots too") — an Anthropic-shaped multimodal block array
          // (our one neutral wire format for a screenshot/receipt/PDF
          // analysis call — see hasImageBlock's comment) used to fall
          // through to the line below unchanged: hardcoded role "model"
          // (wrong — these are always a "user" turn) and the raw
          // {type:"image", source:{...}} blocks handed to Gemini as-is,
          // which doesn't recognize that shape at all and just sees no
          // image. Real Gemini parts (text/functionCall/inlineData) never
          // carry a `type` field, so checking for one is how this tells
          // "our neutral format, needs translating" apart from "Gemini's
          // own raw parts, echoed back from an earlier assistant turn in
          // this same multi-round tool loop — already correct, pass
          // through untouched."
          if (Array.isArray(m.content) && (m.content as AnthropicBlock[]).some(b => "type" in b)) {
            const parts = (m.content as AnthropicBlock[]).map(b => {
              if (b.type === "image" && b.source?.data) return { inlineData: { mimeType: b.source.media_type || "image/jpeg", data: b.source.data } };
              if (b.type === "document" && b.source?.data) return { inlineData: { mimeType: "application/pdf", data: b.source.data } };
              return { text: b.text ?? "" };
            });
            return { role: "user", parts };
          }
          if (Array.isArray(m.content)) return { role: "model", parts: m.content };
          return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] };
        });
      const geminiTools = body.tools?.length
        ? [{ functionDeclarations: (body.tools as Array<{ name: string; description: string; input_schema: unknown }>).map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }]
        : undefined;
      const url = `${def.endpoint}?key=${apiKey}`;
      const data = await safeFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents,
          ...(geminiTools ? { tools: geminiTools } : {}),
          generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
          ...(body.systemPrompt ? { systemInstruction: { parts: [{ text: body.systemPrompt }] } } : {}),
        }),
      }, requestTimeoutMs(body));
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts.filter((p: any) => typeof p.text === "string" && p.text).map((p: any) => p.text).join("");
      const toolUses = parts.filter((p: any) => p.functionCall).map((p: any) => ({ id: p.functionCall.name, name: p.functionCall.name, input: p.functionCall.args ?? {} }));
      const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
      return json({ text, toolUses, stopReason, raw: parts.length ? parts : [{ text }] });
    }

    // ── OpenAI-compatible (OpenAI, Groq, Mistral, NVIDIA, OpenRouter) ──────
    if (!apiKey) {
      const hint = def.provider === "nvidia" ? ` Get a free key and add it in Settings → AI Models — it should start with "nvapi-".` : "";
      return json({ error: `No API key set for this model.${hint} Add one in Settings → AI Models.` }, 400);
    }
    // BUG FIX (user report — "any API key... specifically OpenRouter,
    // should work for screenshots too") — this used to keep ONLY the text
    // blocks out of a multimodal (Anthropic-shaped) content array and drop
    // every image/document block entirely, so a screenshot sent through
    // any OpenAI-compatible provider silently reached the model as if no
    // image had ever been attached — not an error, just a wrong answer
    // with no image context at all. Real image blocks now translate to
    // OpenAI's documented image_url shape (a base64 data: URL — every one
    // of these providers accepts that, no separate upload step needed).
    // A "document" (PDF) block has no equivalent across this whole
    // provider family — degrades to a plain text note instead of silently
    // vanishing, so the model (and the person reading its answer) knows
    // why it can't see the actual file.
    const openAiMessages: Array<Record<string, unknown>> = [...(body.systemPrompt ? [{ role: "system", content: body.systemPrompt }] : [])];
    for (const m of body.messages) {
      if (m.role !== "user" && m.role !== "assistant") continue;
      if (typeof m.content === "string") openAiMessages.push({ role: m.role, content: m.content });
      else if (Array.isArray(m.content) && (m.content as any[])[0]?.type === "tool_result") {
        for (const tr of m.content as Array<{ tool_use_id: string; content: string }>) openAiMessages.push({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content });
      } else if (m.role === "assistant" && m.content && typeof m.content === "object" && !Array.isArray(m.content)) {
        openAiMessages.push(m.content as Record<string, unknown>);
      } else if (Array.isArray(m.content)) {
        const blocks = m.content as AnthropicBlock[];
        const hasNonText = blocks.some(b => b.type !== "text");
        if (!hasNonText) {
          openAiMessages.push({ role: m.role, content: blocks.map(b => b.text ?? "").join("") });
        } else {
          const parts: Array<Record<string, unknown>> = [];
          for (const b of blocks) {
            if (b.type === "text") parts.push({ type: "text", text: b.text ?? "" });
            else if (b.type === "image" && b.source?.data) parts.push({ type: "image_url", image_url: { url: `data:${b.source.media_type || "image/jpeg"};base64,${b.source.data}` } });
            else if (b.type === "document") parts.push({ type: "text", text: "[A PDF was attached here, but this AI provider can't read PDF files directly — only images. Switch to Claude in Settings → AI Models to analyze PDFs.]" });
          }
          openAiMessages.push({ role: m.role, content: parts });
        }
      } else openAiMessages.push({ role: m.role, content: String(m.content) });
    }
    const openAiTools = body.tools?.length
      ? (body.tools as Array<{ name: string; description: string; input_schema: unknown }>).map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }))
      : undefined;
    const openAiHeaders: Record<string, string> = {
      "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}`,
      ...(def.provider === "openrouter" ? { "HTTP-Referer": "https://example.com", "X-Title": "CRM Starter CRM" } : {}),
    };
    let modelCandidates: string[];
    if (def.provider === "openrouter") {
      if (hasImageBlock(body.messages)) {
        const visionModels = await getOpenRouterFreeVisionModels();
        // No vision-capable free model found live (catalog fetch failed,
        // or genuinely none right now) — falling through to the tool-
        // capable list would silently send the image to a text-only
        // model, the exact bug this whole fix is for. Fail clearly
        // instead so the owner knows to try a different provider for
        // this one request, rather than getting a confidently wrong answer.
        if (visionModels.length === 0) return json({ error: "No free vision-capable model is currently available on OpenRouter. Try again shortly, or use Claude/GPT-4o/Gemini in Settings → AI Models for image analysis." }, 400);
        // BUG FIX (user report — "sent 2 screenshots, he said 'analyzing
        // screenshot 1 of 2' and just sat there") — 8 candidates were
        // fetched here specifically so a dead free vision model could fall
        // back to another one, but the loop below only ever fell back on a
        // 404 ("model doesn't exist"). Free OpenRouter vision models
        // routinely fail in every OTHER way instead — overloaded, 500,
        // 503, or simply hanging — so in practice this fallback list was
        // almost never actually used: the very first candidate dying any
        // way but a 404 threw immediately and the request just sat there
        // (from the browser's view) until the full per-attempt timeout
        // elapsed. Capped at 3 (not 8) with a short per-candidate timeout
        // below so working through all of them still fits well inside the
        // client's own 45s abort budget (see AlfredPage.tsx's
        // callVisionModel) instead of racing it.
        modelCandidates = visionModels.slice(0, 3);
      } else {
        const live = await getOpenRouterFreeModels();
        modelCandidates = Array.from(new Set([...live, ...OPENROUTER_FREE_FALLBACKS])).slice(0, 8);
      }
    } else if (def.provider === "nvidia" && !hasImageBlock(body.messages)) {
      modelCandidates = Array.from(new Set([def.modelId, ...nvidiaFallbacks(NVIDIA_FALLBACKS)])).slice(0, 4);
    } else modelCandidates = [def.modelId];

    const isVisionRequest = def.provider === "openrouter" && hasImageBlock(body.messages);
    // Text: the chosen model gets the full size-based time; each fallback a
    // shorter, fixed slice so trying them all still ends in reasonable time.
    const firstTimeoutMs = isVisionRequest ? 12000 : requestTimeoutMs(body);
    const fallbackTimeoutMs = isVisionRequest ? 12000 : (modelCandidates.length > 3 ? 20000 : 40000);
    let data: any;
    let lastErr: unknown;
    for (const [ci, candidateModel] of modelCandidates.entries()) {
      const openAiBody = JSON.stringify({ model: candidateModel, max_tokens: maxTokens, messages: openAiMessages, ...(openAiTools ? { tools: openAiTools } : {}) });
      try {
        data = await safeFetch(def.endpoint, { method: "POST", headers: openAiHeaders, body: openAiBody }, ci === 0 ? firstTimeoutMs : fallbackTimeoutMs);
        lastErr = undefined;
        break;
      } catch (err: any) {
        lastErr = err;
        // Auth/billing errors won't differ across candidates (same API
        // key) — no point burning the timeout budget retrying those.
        // Everything else (404, overloaded, 500/503, timed out) is exactly
        // the kind of per-model flakiness this fallback list exists for.
        if ((err?.status === 401 || err?.status === 402 || err?.status === 403) || modelCandidates.length <= 1) throw err;
        // NVIDIA: only move to another model when this one was slow or
        // overloaded — a bad request (400) would fail the same way on all.
        if (def.provider === "nvidia" && !(/timed out/i.test(err?.message || "") || err?.status === 429 || (err?.status || 0) >= 500)) throw err;
        continue;
      }
    }
    if (!data) {
      if (def.provider === "nvidia" && /timed out/i.test((lastErr as any)?.message || "")) {
        throw new Error(`NVIDIA didn't answer in time (tried ${modelCandidates.length} of its models). Its free models get slow when busy — try again, or add a second provider (Gemini, Groq, Claude…) in Settings → AI Models so Alfred can switch automatically.`);
      }
      throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    }
    const choice = data.choices?.[0]?.message;
    const text = choice?.content ?? "";
    const toolUses = (choice?.tool_calls ?? []).map((tc: any) => ({ id: tc.id, name: tc.function?.name ?? "", input: (() => { try { return JSON.parse(tc.function?.arguments || "{}"); } catch { return {}; } })() }));
    const stopReason = toolUses.length > 0 ? "tool_use" : "end_turn";
    return json({ text, toolUses, stopReason, raw: choice ?? { role: "assistant", content: text } });
  } catch (e: any) {
    return json({ error: e?.message || "call-model proxy error" }, e?.status || 500);
  }
};
