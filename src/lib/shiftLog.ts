// Shift log — every working day's shift total per employee (table
// employee_shift_days, migration 0004), so weekly hours and pay count every
// shift, not just the latest one. See the migration's comment for the bug.
//
// A day's total already includes Resume-Day time (the clock is backdated by
// what was worked earlier that day), so one number per employee per shift
// day is the whole story; saving again the same day replaces it.
import { supabase } from "./supabase";

export type ShiftDay = { employee_id: string; date: string; hours: number };

let tableMissing = false;
const isMissingTable = (msg: string) => /employee_shift_days|relation .* does not exist|could not find the table|schema cache/i.test(msg);

export async function saveShiftDay(row: { ownerId: string; employeeId: string; date: string; hours: number; clockOutAt?: number }): Promise<{ ok: boolean; error?: string; network?: boolean }> {
  if (tableMissing || !row.ownerId || !row.employeeId) return { ok: false, error: "shift log not set up" };
  try {
    const { error } = await (supabase as any).from("employee_shift_days").upsert({
      owner_id: row.ownerId, employee_id: row.employeeId, date: row.date,
      hours: Math.max(0, Math.min(24, Math.round(row.hours * 100) / 100)),
      last_clock_out: row.clockOutAt ? new Date(row.clockOutAt).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "employee_id,date" });
    if (error) {
      if (isMissingTable(error.message || "")) { tableMissing = true; console.warn("[ShiftLog] employee_shift_days isn't set up yet — run supabase/migrations/0004_employee_shift_days.sql. Falling back to the last shift only."); }
      return { ok: false, error: error.message, network: isNetworkError(error) };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "failed", network: true };
  }
}

export async function fetchShiftDays(filter: { employeeId?: string; ownerId?: string }, sinceDate: string): Promise<ShiftDay[]> {
  if (tableMissing) return [];
  try {
    let q = (supabase as any).from("employee_shift_days").select("employee_id,date,hours").gte("date", sinceDate).limit(5000);
    if (filter.employeeId) q = q.eq("employee_id", filter.employeeId);
    if (filter.ownerId) q = q.eq("owner_id", filter.ownerId);
    const { data, error } = await q;
    if (error) { if (isMissingTable(error.message || "")) tableMissing = true; return []; }
    return (data || []).map((r: any) => ({ employee_id: String(r.employee_id), date: String(r.date).slice(0, 10), hours: Number(r.hours) || 0 }));
  } catch { return []; }
}

// Date → hours for one employee: the log, plus the last shift kept on the
// employee row (covers a day not logged yet, or before the migration runs).
export function shiftHoursByDay(days: ShiftDay[], employeeId: string, lastShift?: { date?: string; hours?: number }): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of days) if (d.employee_id === employeeId) m.set(d.date, Math.max(m.get(d.date) || 0, d.hours));
  if (lastShift?.date && Number(lastShift.hours) > 0) m.set(lastShift.date, Math.max(m.get(lastShift.date) || 0, Number(lastShift.hours)));
  return m;
}

// Time on the clock that no completed job covers, for every shift day in the
// range: each day adds (day total − job hours that day), never below zero.
// A day that's still running uses its live total instead of the saved one.
export function extraShiftHours(byDay: Map<string, number>, jobHoursOn: (date: string) => number, startDate: string, endDate: string, live?: { date: string; hours: number }): number {
  let total = 0;
  for (const [date, hours] of byDay) {
    if (date < startDate || date > endDate) continue;
    if (live && live.date === date) continue;
    total += Math.max(0, hours - jobHoursOn(date));
  }
  if (live && live.date >= startDate && live.date <= endDate) total += Math.max(0, live.hours - jobHoursOn(live.date));
  return total;
}

export const isNetworkError = (e: any): boolean =>
  (typeof navigator !== "undefined" && navigator.onLine === false) ||
  /failed to fetch|networkerror|network request failed|load failed|timed out|timeout|fetch failed|internet/i.test(String(e?.message || e || ""));
