// Clock changes made with no signal (Start / End My Day, lunch, pause) are
// kept on the phone and sent when it's back online.
//
// BUG FIX (audit 2026-10-26) — job updates already had an offline queue
// (offlineQueue.ts), but clocking in or out did not: with no signal the app
// said "Saved locally, but couldn't sync", then undid the clock-in, so the
// shift was lost. Each change is stored with the real time it happened (the
// patch carries the timestamps), replayed in order, and the screen keeps
// showing it in the meantime.
import { supabase } from "./supabase";
import { saveShiftDay, isNetworkError } from "./shiftLog";

export type PendingClock = {
  id: string; employeeId: string; at: number;
  patch: Record<string, any>;  // employees row update, exactly as it would have been sent
  shiftDay?: { ownerId: string; date: string; hours: number; clockOutAt: number };
};

const key = (employeeId: string) => "crm.pendingClock." + employeeId;
const read = (employeeId: string): PendingClock[] => { try { return JSON.parse(localStorage.getItem(key(employeeId)) || "[]"); } catch { return []; } };
const write = (employeeId: string, list: PendingClock[]) => { try { if (list.length) localStorage.setItem(key(employeeId), JSON.stringify(list)); else localStorage.removeItem(key(employeeId)); } catch { /* storage blocked */ } };

export function queueClockChange(employeeId: string, patch: Record<string, any>, shiftDay?: PendingClock["shiftDay"]) {
  const list = read(employeeId);
  list.push({ id: Math.random().toString(36).slice(2), employeeId, at: Date.now(), patch, shiftDay });
  write(employeeId, list);
}

export const pendingClockChanges = (employeeId: string): PendingClock[] => read(employeeId);

// What the employee row will look like once everything waiting is sent —
// used to keep the clock showing the right state across a reload.
export const mergedPendingPatch = (employeeId: string): Record<string, any> =>
  read(employeeId).reduce((acc, p) => ({ ...acc, ...p.patch }), {} as Record<string, any>);

// Sends waiting changes in order; stops at the first one that still can't go.
export async function replayClockChanges(employeeId: string): Promise<{ sent: number; left: number }> {
  let list = read(employeeId);
  let sent = 0;
  while (list.length) {
    const p = list[0];
    try {
      // A shift total saved with no employee change (the row already synced).
      if (!Object.keys(p.patch).length) {
        if (p.shiftDay) { const r = await saveShiftDay({ ownerId: p.shiftDay.ownerId, employeeId, date: p.shiftDay.date, hours: p.shiftDay.hours, clockOutAt: p.shiftDay.clockOutAt }); if (!r.ok && r.network) break; }
        list = list.slice(1); write(employeeId, list); sent++; continue;
      }
      let { data, error } = await (supabase as any).from("employees").update(p.patch).eq("id", employeeId).select("id");
      if (error && isNetworkError(error)) break;
      if (error) {
        // A column this database doesn't have yet (same fallback as the
        // online path): send just the clock fields.
        const { lastShiftHours, lastShiftDate, ...core } = p.patch;
        void lastShiftHours; void lastShiftDate;
        ({ data, error } = await (supabase as any).from("employees").update(core).eq("id", employeeId).select("id"));
        if (error && isNetworkError(error)) break;
      }
      if (error || !data?.length) console.warn("[OfflineClock] the server refused a saved clock change — dropped:", error?.message || "no matching employee", p);
      if (p.shiftDay) await saveShiftDay({ ownerId: p.shiftDay.ownerId, employeeId, date: p.shiftDay.date, hours: p.shiftDay.hours, clockOutAt: p.shiftDay.clockOutAt });
    } catch (e: any) { if (isNetworkError(e)) break; }
    list = list.slice(1);
    write(employeeId, list);
    sent++;
  }
  return { sent, left: list.length };
}
