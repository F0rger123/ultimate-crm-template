// The owner's whole-day clock (Jobs page + Dashboard "My Work").
//
// FEATURE — "you don't clock in on an individual job; you clock in for the
// day." Same shift fields the field portal uses on the owner's own
// employees row (dayClockInAt / dayPausedMinutes / lastShiftHours /
// lastShiftDate — see CLAUDE.md "Shift timer sync"), so the owner shows up
// in Live Crew View and My Hours exactly like a technician. Clocking in again
// later the same day resumes the same shift.
import React, { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { shiftDayStr, withTimeout } from "../../lib/utils";

const fmtDur = (ms: number) => { const m = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };

// onChange reports the clock-in time right away (null when clocked out), so a
// page can react before the employees sync catches up.
export function OwnerShiftBar({ ownerEmp, toast, compact = false, onChange }: { ownerEmp: any; toast?: (m: string, tone?: any) => void; compact?: boolean; onChange?: (clockInAt: number | null) => void }) {
  // Optimistic value until the 3s employees poll catches up: undefined = use the row.
  const [optimistic, setOptimistic] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const rowClockIn = ownerEmp ? (ownerEmp.dayClockInAt ?? ownerEmp.dayclockinat ?? null) : null;
  useEffect(() => { if (optimistic !== undefined && (rowClockIn || null) === (optimistic || null)) setOptimistic(undefined); }, [rowClockIn]); // eslint-disable-line react-hooks/exhaustive-deps
  const clockInAt = optimistic !== undefined ? optimistic : (rowClockIn ? Number(rowClockIn) : null);
  useEffect(() => { if (!clockInAt) return; const t = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(t); }, [clockInAt]);
  if (!ownerEmp) return null;

  const paused = (Number(ownerEmp.dayPausedMinutes) || 0) * 60000;
  const workedMs = clockInAt ? Date.now() - clockInAt - paused : 0;
  const earlierToday = ownerEmp.lastShiftDate === shiftDayStr() ? Number(ownerEmp.lastShiftHours) || 0 : 0;

  const write = async (patch: Record<string, any>, ok: string) => {
    setBusy(true);
    try {
      const r: any = await withTimeout((supabase as any).from("employees").update(patch).eq("id", ownerEmp.id).select("id"), 10000, "Clock");
      if (r?.error) throw new Error(r.error.message);
      if (!r?.data?.length) throw new Error("the server didn't save it (your employee row may belong to another account)");
      toast?.(ok, "green");
      return true;
    } catch (e: any) {
      toast?.("Couldn't save — " + (e?.message || "unknown error"), "red");
      setOptimistic(undefined);
      return false;
    } finally { setBusy(false); }
  };
  const clockIn = async () => {
    const next = Date.now() - Math.round(earlierToday * 3600000);
    setOptimistic(next);
    onChange?.(next);
    if (!(await write({ dayClockInAt: next, dayLunchStartAt: null, dayPausedMinutes: 0 }, earlierToday ? "Shift resumed ✓" : "Clocked in for the day ✓"))) onChange?.(null);
  };
  const clockOut = async () => {
    if (!clockInAt) return;
    const hours = Math.round((workedMs / 3600000) * 100) / 100;
    setOptimistic(null);
    onChange?.(null);
    if (!(await write({ dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0, lastShiftHours: hours, lastShiftDate: shiftDayStr() }, `Clocked out — ${fmtDur(workedMs)} today ✓`))) onChange?.(clockInAt);
  };

  return (
    <div className={"flex items-center gap-3 rounded-xl border px-3 py-2 " + (clockInAt ? "border-green-700/40 bg-green-950/20" : "border-white/10 bg-black/30") + (compact ? "" : " justify-between flex-wrap")}>
      <div className="flex items-center gap-2 text-xs min-w-0">
        <Clock size={14} className={clockInAt ? "text-green-400" : "text-white/40"} />
        {clockInAt
          ? <span><span className="text-green-300 font-semibold">On the clock</span> <span className="text-white/50">· {fmtDur(workedMs)} today</span></span>
          : <span className="text-white/60">{earlierToday ? `Off the clock · ${earlierToday.toFixed(2)}h worked today` : "Not clocked in today"}</span>}
      </div>
      <button onClick={clockInAt ? clockOut : clockIn} disabled={busy}
        className={"text-xs px-3 py-1.5 rounded-lg border font-medium transition disabled:opacity-50 flex-shrink-0 " + (clockInAt ? "bg-brand-900/30 border-brand-700/50 text-danger-200 hover:bg-brand-900/50" : "bg-green-900/30 border-green-700/50 text-green-200 hover:bg-green-900/50")}>
        {busy ? "Saving…" : clockInAt ? "Clock out for the day" : earlierToday ? "Clock back in" : "Clock in for the day"}
      </button>
    </div>
  );
}
