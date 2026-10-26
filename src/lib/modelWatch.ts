// Browser side of the model watch (functions/api/_lib/modelWatch.ts): read
// this business's AI model health, ask for a fresh check, and turn new watch
// events into notifications.
import { supabase } from "./supabase";

export type ModelWatchStatus = {
  health: null | {
    checkedAt: string;
    slots: Record<string, { provider: string; model: string; ok: boolean; kind: string; ms?: number; error?: string; since: string }>;
    events: { at: string; text: string; kind: string }[];
    suggestions: { provider: string; name: string; url: string; why: string }[];
  };
  overrides: Record<string, { model: string; was: string; reason: string; at: string }>;
  nvidiaWorking: string[];
  openrouterFree: string[];
  newFree: { provider: string; model: string; firstSeen: string }[];
  checkedAt: string | null;
};

export async function fetchModelWatch(action: "status" | "check" = "status"): Promise<ModelWatchStatus> {
  const { data } = await (supabase as any).auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sign in first.");
  const res = await fetch("/api/model-watch", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Model watch failed (${res.status})`);
  return body as ModelWatchStatus;
}

const SEEN_KEY = "crm.modelWatchSeenAt";
// Events newer than the last time this browser looked (first look: none —
// only events from then on become notifications).
export function takeNewModelWatchEvents(s: ModelWatchStatus): { at: string; text: string; kind: string }[] {
  const events = s.health?.events || [];
  let seen = "";
  try { seen = localStorage.getItem(SEEN_KEY) || ""; } catch { /* storage blocked */ }
  const latest = events[0]?.at || new Date().toISOString();
  try { localStorage.setItem(SEEN_KEY, latest > seen ? latest : seen || latest); } catch { /* storage blocked */ }
  if (!seen) return [];
  return events.filter(e => e.at > seen);
}
