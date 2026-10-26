// Replacement models chosen by the model watch (_lib/modelWatch.ts), applied
// wherever Alfred calls an AI model (/api/call-model and the texting agents).
// When a provider retires a model, or a free model keeps failing, the watch
// records a working one from the same provider here; every call then uses
// it without a code change. One shared record (owner_records, owner
// "__global__", kind "model_watch", id "overrides") — which models a
// provider offers is the same for every business. Cached for 10 minutes.
import { SUPABASE_URL } from "./env";

export const GLOBAL_OWNER = "__global__";
export type ModelOverride = { model: string; was: string; reason: string; at: string };
export type ModelWatchDoc = {
  checkedAt?: string;
  overrides?: Record<string, ModelOverride>;
  nvidiaWorking?: string[];             // NVIDIA models verified to answer (with tools), best first
  openrouterFree?: string[];            // OpenRouter free models with tool support, best first
  newFree?: { provider: string; model: string; firstSeen: string }[];
  seen?: Record<string, string[]>;
  events?: { at: string; text: string }[];
};

let cache: { doc: ModelWatchDoc; at: number } | null = null;
const TTL_MS = 10 * 60 * 1000;

export async function loadModelOverrides(serviceKey?: string, force = false): Promise<ModelWatchDoc> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.doc;
  if (!serviceKey) return cache?.doc || {};
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/owner_records?owner_id=eq.${GLOBAL_OWNER}&kind=eq.model_watch&id=eq.overrides&select=data&limit=1`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
    const rows = await res.json().catch(() => []);
    cache = { doc: (Array.isArray(rows) && rows[0]?.data) || {}, at: Date.now() };
  } catch { cache = { doc: cache?.doc || {}, at: Date.now() }; }
  return cache.doc;
}

export const setModelOverridesCache = (doc: ModelWatchDoc) => { cache = { doc, at: Date.now() }; };

// The model a slot should call right now (the watch's replacement, if any).
export function effectiveModel<T extends { modelId: string; endpoint?: string }>(slot: string, def: T): T {
  const o = cache?.doc.overrides?.[slot];
  if (!def || !o?.model || o.model === def.modelId) return def;
  const copy: any = { ...def, modelId: o.model };
  // Gemini's endpoint has the model in its path.
  if (def.endpoint && /generativelanguage\.googleapis\.com/.test(def.endpoint)) copy.endpoint = def.endpoint.replace(/models\/[^:/]+:/, `models/${o.model}:`);
  return copy;
}

// NVIDIA models to fall back to when the chosen one is slow: the watch's
// verified list first, then the built-in ones.
export const nvidiaFallbacks = (defaults: string[]): string[] => {
  const w = cache?.doc.nvidiaWorking || [];
  return w.length ? Array.from(new Set([...w, ...defaults])) : defaults;
};
