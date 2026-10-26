// "Check Alfred's connections" — runs /api/alfred-health (every AI model key,
// Twilio and its incoming-text webhook, Google, the database tables Alfred
// needs, the reminders scheduler) and lists each result with how to fix it.
import React, { useState } from "react";
import { Activity, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { withTimeout } from "../../lib/utils";
import { Glass } from "./Glass";

export type AlfredHealthResult = { ok: boolean; summary: string; checkedAt: string; checks: { area: string; name: string; ok: boolean; detail: string; fix?: string }[] };

export async function runAlfredHealthCheck(): Promise<AlfredHealthResult> {
  const { data } = await (supabase as any).auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sign in as the owner first.");
  const res = await withTimeout(fetch("/api/alfred-health", { method: "POST", headers: { Authorization: `Bearer ${token}` } }), 60000, "Health check");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || `Health check failed (${res.status})`);
  return body as AlfredHealthResult;
}

export function AlfredHealthPanel({ toast }: { toast?: (m: string, tone?: any) => void }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AlfredHealthResult | null>(null);
  const run = async () => {
    setBusy(true);
    try {
      const r = await runAlfredHealthCheck();
      setResult(r);
      toast?.(r.summary, r.ok ? "green" : "yellow");
    } catch (e: any) {
      toast?.("Health check failed — " + (e?.message || "unknown error"), "red");
    } finally { setBusy(false); }
  };
  const areas = result ? Array.from(new Set(result.checks.map(c => c.area))) : [];
  return (
    <Glass className="p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-semibold text-sm flex items-center gap-2"><Activity size={14} className="text-purple-400" />Alfred health check</div>
          <div className="text-[11px] text-white/50 mt-0.5">Tests every AI key, Twilio (and its incoming-text webhook), Google, the database tables Alfred needs, and the reminders scheduler.</div>
        </div>
        <button onClick={run} disabled={busy} className="text-xs px-3 py-1.5 rounded-lg bg-purple-700/40 border border-purple-600/50 hover:bg-purple-700/60 transition disabled:opacity-50">
          {busy ? "Checking…" : result ? "Check again" : "Check Alfred's connections"}
        </button>
      </div>
      {result && (
        <div className="space-y-3">
          <div className={"text-xs font-semibold " + (result.ok ? "text-green-400" : "text-yellow-300")}>{result.summary}</div>
          {areas.map(area => (
            <div key={area}>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{area}</div>
              <div className="space-y-1">
                {result.checks.filter(c => c.area === area).map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {c.ok ? <CheckCircle size={13} className="text-green-400 mt-0.5 flex-shrink-0" /> : <XCircle size={13} className="text-danger-400 mt-0.5 flex-shrink-0" />}
                    <div className="min-w-0">
                      <span className="font-medium">{c.name}</span> <span className="text-white/50">— {c.detail}</span>
                      {c.fix && <div className="text-[11px] text-yellow-200/80 mt-0.5">Fix: {c.fix}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Glass>
  );
}
