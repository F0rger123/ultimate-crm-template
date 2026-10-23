// ─── Model definitions ─────────────────────────────────────────────────────────
// MODELS is a Record keyed by short name ("claude", "openai", etc.)
// `id` = short key (used in settings.activeModel, settings.modelKeys, priority arrays)
// `modelId` = actual API model ID sent in the request body

export interface ModelDef {
  id: string;           // Short key: "claude", "openai", etc.
  modelId: string;      // Actual API model ID: "claude-sonnet-5-5"
  name: string;
  label: string;
  provider: "anthropic" | "openai" | "google" | "groq" | "mistral" | "nvidia" | "openrouter" | "cerebras";
  endpoint: string;
  maxTokens: number;
  contextWindow: number;
  color: string;
  needsKey: boolean;    // false = works without key (fails gracefully with clear error)
  supportsTools: boolean;
  keyUrl: string;
  apiLabel: string;
  free?: boolean;        // true = no cost to the user (shown with a "Free" badge)
}

export const MODELS: Record<string, ModelDef> = {
  claude: {
    id: "claude",
    modelId: "claude-sonnet-5-5",
    name: "Claude",
    label: "Claude Sonnet 5.5 (Recommended)",
    provider: "anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    maxTokens: 4096,
    contextWindow: 200000,
    color: "from-orange-500 to-orange-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://console.anthropic.com/",
    apiLabel: "Anthropic API Key",
  },
  openai: {
    id: "openai",
    modelId: "gpt-4o",
    name: "GPT-4o",
    label: "GPT-4o (OpenAI)",
    provider: "openai",
    endpoint: "https://api.openai.com/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
    color: "from-green-500 to-green-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://platform.openai.com/api-keys",
    apiLabel: "OpenAI API Key",
  },
  gemini: {
    id: "gemini",
    modelId: "gemini-2.5-flash",
    name: "Gemini",
    label: "Gemini 2.5 Flash (Google)",
    provider: "google",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    maxTokens: 4096,
    contextWindow: 1000000,
    color: "from-blue-500 to-blue-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://aistudio.google.com/app/apikey",
    apiLabel: "Google AI API Key",
  },
  groq: {
    id: "groq",
    modelId: "openai/gpt-oss-120b",
    name: "Groq",
    label: "GPT-OSS 120B via Groq",
    provider: "groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
    color: "from-purple-500 to-purple-700",
    needsKey: true,
    free: true,
    supportsTools: true,
    keyUrl: "https://console.groq.com/keys",
    apiLabel: "Groq API Key",
  },
  mistral: {
    id: "mistral",
    modelId: "mistral-large-latest",
    name: "Mistral",
    label: "Mistral Large",
    provider: "mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 128000,
    color: "from-brand-500 to-brand-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://console.mistral.ai/api-keys/",
    apiLabel: "Mistral API Key",
  },
  // BUG FIX — "Kimi K2.6 gives a 404, and now it's gone from NVIDIA's
  // catalog entirely." Confirmed directly from NVIDIA's own build.nvidia.com
  // sample code (copied verbatim by the owner) — swapped for DeepSeek V4
  // Flash, a real current free model on their platform. Kept the same `id`
  // ("nvidia_kimi") so an owner who already had this slot in their saved
  // modelPriority doesn't need to re-add it — only what it actually points
  // at changed.
  nvidia_kimi: {
    id: "nvidia_kimi",
    modelId: "deepseek-ai/deepseek-v4.1-flash",
    name: "DeepSeek V4.1 Flash",
    label: "DeepSeek V4.1 Flash (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 16384,
    contextWindow: 1000000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/deepseek-ai/deepseek-v4.1-flash",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  // BUG FIX — swapped for the model the owner confirmed is actually live on
  // NVIDIA's catalog right now (nvidia/llama-3.1-nemotron-70b-instruct was
  // never verified and is very likely stale, same as Kimi K2.6 was).
  nvidia_nemotron: {
    id: "nvidia_nemotron",
    modelId: "nvidia/nemotron-3.5-lightning-30b-a3b",
    name: "Nemotron 3.5 Lightning",
    label: "Nemotron 3.5 Lightning 30B (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 16384,
    contextWindow: 128000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  nvidia_muse: {
    id: "nvidia_muse",
    modelId: "meta/muse-glimmer-30b",
    name: "Muse Glimmer 30B",
    label: "Muse Glimmer 30B (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 8192,
    contextWindow: 32000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    // Confirmed via NVIDIA's own model spec page: "Function Calling: Supported".
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/meta/muse-glimmer-30b",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  nvidia_deepseek_r1: {
    id: "nvidia_deepseek_r1",
    modelId: "moonshotai/kimi-k3",
    name: "Kimi K3",
    label: "Kimi K3 (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 8192,
    contextWindow: 128000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/moonshotai/kimi-k3",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  nvidia_qwen: {
    id: "nvidia_qwen",
    modelId: "nvidia/nemotron-3-super-120b-a12b",
    name: "Nemotron 3 Super 120B",
    label: "Nemotron 3 Super 120B (NVIDIA — Free)",
    provider: "nvidia",
    endpoint: "https://integrate.api.nvidia.com/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 32000,
    color: "from-green-500 to-emerald-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b",
    apiLabel: "NVIDIA API Key",
    free: true,
  },
  // Cerebras: free tier (rate-limited), OpenAI-compatible, very fast, and
  // GPT-OSS 120B handles tool calling. Key from cloud.cerebras.ai.
  cerebras: {
    id: "cerebras",
    modelId: "gpt-oss-120b",
    name: "Cerebras",
    label: "GPT-OSS 120B via Cerebras (Free)",
    provider: "cerebras",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 65536,
    color: "from-orange-400 to-red-600",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://cloud.cerebras.ai/",
    apiLabel: "Cerebras API Key",
    free: true,
  },
  // BUG FIX — re-added. Originally removed because the hardcoded model
  // (Llama 3.3 70B free) had no real tool-calling, and the whole point of
  // adding it was to give owners a second free provider so hitting
  // Gemini's daily quota doesn't block Alfred entirely. Turns out that was
  // a bad default model, not a platform limitation — OpenRouter's live
  // catalog (fetched directly, not guessed) currently has 18 different free
  // models that genuinely declare tool-calling support in their own
  // supported_parameters. GLM 5.2 is one of the strongest of those free
  // tool-capable models right now. getOpenRouterFreeModels() (below) keeps
  // this current automatically by re-checking the live catalog for BOTH
  // free pricing AND tool support — not just free pricing like before.
  openrouter: {
    id: "openrouter",
    modelId: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "OpenRouter",
    label: "OpenRouter (Nemotron 3 Super — Free, tool-capable)",
    provider: "openrouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    maxTokens: 4096,
    contextWindow: 131072,
    color: "from-violet-500 to-purple-700",
    needsKey: true,
    supportsTools: true,
    keyUrl: "https://openrouter.ai/keys",
    apiLabel: "OpenRouter API Key",
    free: true,
  },
};

// ISSUE 19 — OpenRouter's free-tier catalog rotates/deprecates models often
// (a slug that works today 404s a few weeks later), which is exactly what
// was happening: the hardcoded modelId went stale and every call 404'd
// before ever reaching a usable model. This fallback list gives callModel's
// OpenRouter branch other free slugs to retry against on a 404 instead of
// failing outright — keep the primary modelId above first in this list.
// BUG FIX — every single slug in the old version of this list (Llama 3.3/
// 3.1, Mistral 7B, Qwen 2.5 72B, Gemma 2 9B) has been fully REMOVED from
// OpenRouter's catalog since it was written, not just deprecated — none of
// them appear in a live /models fetch at all anymore. Refreshed against a
// live fetch (see getOpenRouterFreeModels below) to models actually free
// AND actually tool-capable (declare "tools" in supported_parameters) right
// now — this is what was silently missing before: the old code filtered on
// free pricing only, never checked tool support, so it could serve a free
// model that could never have called a tool no matter what.
export const OPENROUTER_FREE_FALLBACKS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  // OpenRouter's own free router: picks whichever free model is up.
  "openrouter/free",
];

// BUG FIX — "check that OpenRouter API keys work for Alfred": every single
// hardcoded slug above 404'd in a real live test ("No endpoints found for
// google/gemma-2-9b-it:free" — the LAST one tried, meaning all five had
// already failed). Hand-maintaining this list doesn't hold up — OpenRouter's
// free catalog genuinely rotates on its own schedule, not ours. OpenRouter
// publishes its full model catalog at a public, unauthenticated, CORS-open
// endpoint specifically so integrations can do this instead of guessing —
// fetch it once per session, filter to models that are actually free right
// now (prompt AND completion pricing both "0") AND actually declare tool-
// calling support, and try those FIRST, with the static list above only as
// a last-resort fallback if that fetch itself fails (offline, OpenRouter's
// own outage, etc.). Filtering on tool support too (not just free pricing)
// is the fix for OpenRouter being re-added at all — see MODELS.openrouter's
// comment for why it was removed and then brought back this way.
let openRouterFreeModelsCache: string[] | null = null;
let openRouterFreeModelsFetchedAt = 0;
const OPENROUTER_CATALOG_TTL_MS = 30 * 60 * 1000;
const getOpenRouterFreeModels = async (): Promise<string[]> => {
  if (openRouterFreeModelsCache && Date.now() - openRouterFreeModelsFetchedAt < OPENROUTER_CATALOG_TTL_MS) {
    return openRouterFreeModelsCache;
  }
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { data?: Array<{ id: string; pricing?: { prompt?: string; completion?: string }; supported_parameters?: string[] }> };
    const free = (json.data || [])
      .filter(m => m.pricing?.prompt === "0" && m.pricing?.completion === "0")
      .filter(m => (m.supported_parameters || []).includes("tools") || (m.supported_parameters || []).includes("tool_choice"))
      .map(m => m.id);
    if (free.length > 0) {
      openRouterFreeModelsCache = free;
      openRouterFreeModelsFetchedAt = Date.now();
      return free;
    }
    throw new Error("OpenRouter returned no free tool-capable models");
  } catch (e: any) {
    console.warn("[OpenRouter] live free-model catalog fetch failed, using static fallback list:", e?.message);
    return [];
  }
};

// ─── Safe fetch ───────────────────────────────────────────────────────────────

// BUG FIX — "it shouldn't show that type of error; it should just say a
// plain-text English error." A failed provider call used to surface its
// raw HTTP status + response body verbatim in the chat — a JSON:API-style
// error object (some providers, NVIDIA's NIM platform in particular,
// return structured `{status, title, detail}` bodies) showed up as a
// literal unreadable JSON blob. Pull the actual human-readable message out
// of whatever shape the provider used before falling back to the raw text.
const extractErrorMessage = (text: string, status: number): string => {
  try {
    const j = JSON.parse(text);
    const msg = j?.detail || j?.error?.message || j?.error || j?.message || j?.title;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  } catch { /* not JSON — fall through to raw text */ }
  return text.slice(0, 200) || `Request failed (${status})`;
};

export const safeFetch = async (url: string, opts: RequestInit): Promise<unknown> => {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`HTTP ${res.status}: ${extractErrorMessage(text, res.status)}`);
    (err as any).status = res.status;
    (err as any).retryAfter = res.headers.get("retry-after");
    throw err;
  }
  return res.json();
};

// ─── Rate limit error parser ──────────────────────────────────────────────────
// Returns { lockedUntil: timestamp } on a rate-limit/quota error, or null.

export const parseRateLimitError = (
  err: unknown,
  _modelId?: string,
): { lockedUntil: number } | null => {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as any)?.status as number | undefined;
  if (
    status === 429 ||
    msg.includes("429") ||
    /rate.?limit|quota.?exceed|too many requests/i.test(msg)
  ) {
    const rawRetry = (err as any)?.retryAfter as string | undefined;
    const seconds = rawRetry ? Math.max(10, parseInt(rawRetry, 10) || 60) : 60;
    return { lockedUntil: Date.now() + seconds * 1000 };
  }
  return null;
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CallModelResult {
  text: string;
  toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }>;
  stopReason: string;
  raw: unknown;
}

// ─── Unified model caller ─────────────────────────────────────────────────────
// Called by AlfredPage with: { modelId, apiKey, systemPrompt, messages, tools, maxTokens }
//
// SECURITY FIX — this used to call each provider's API directly from the
// browser using `opts.apiKey`, which callers read straight out of
// settings.modelKeys — readable by every one of an owner's own employees
// (see migration 0085's comment for the full story). Now a thin authenticated
// proxy to functions/api/call-model.ts, which does the exact same provider
// dispatch server-side, resolving the real key via owner_secrets instead of
// trusting whatever the client sends. `opts.apiKey` is accepted for call-site
// backward compatibility but ignored — every existing caller (AlfredPage.tsx,
// EmployeePortal.tsx's voice-checklist AI match, VisualWorkflowBuilder.tsx's
// AI Draft) needed no changes at all, since the request/response shape is
// identical to what this function always returned.
export const callModel = async (opts: {
  modelId: string;
  apiKey?: string;
  systemPrompt?: string;
  messages: Array<{ role: string; content: unknown }>;
  tools?: unknown[];
  maxTokens?: number;
  // FEATURE — "no button to stop Alfred from responding mid-chat." Optional
  // so every existing caller is unaffected; AlfredPage.tsx's stop button
  // aborts this fetch directly instead of just ignoring the eventual result
  // (which would still burn the API call and could still act on tools).
  signal?: AbortSignal;
}): Promise<CallModelResult> => {
  const { supabase } = await import("./supabase");
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) throw new Error("Not signed in — can't reach the AI model.");
  const res = await fetch("/api/call-model", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ modelId: opts.modelId, systemPrompt: opts.systemPrompt, messages: opts.messages, tools: opts.tools, maxTokens: opts.maxTokens }),
    signal: opts.signal,
  });
  const responseData = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const err: any = new Error(responseData?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return responseData as CallModelResult;
};

