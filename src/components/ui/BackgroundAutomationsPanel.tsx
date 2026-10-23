// BackgroundAutomationsPanel.tsx — real, discoverable home for
// "automations run in the background" (functions/api/run-automations.ts).
// Shows whether the background job has actually been checking in, a manual
// "Run Now" trigger for testing without waiting on the external pinger, and
// the exact setup instructions/URL — all in one place instead of only
// living in a commit message or a chat reply.
import React, { useState } from "react";
import { RefreshCw, Copy, Check, Zap } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { Glass } from "./Glass";

const fmtAgo = (iso?: string): string => {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0 || Number.isNaN(ms)) return "never";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export function BackgroundAutomationsPanel({ settings, toast }: { settings?: any; toast?: any }) {
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/api/run-automations`;
  const lastRunAt: string | undefined = settings?.lastAutomationRunAt;
  const healthy = lastRunAt && Date.now() - new Date(lastRunAt).getTime() < 20 * 60000; // within ~1.3x the 15-min cadence

  const runNow = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) { toast?.("Not signed in", "red"); return; }
      const res = await fetch("/api/run-automations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.error) { toast?.("Run failed — " + (data?.error || res.status), "red"); return; }
      const mine = data?.owners ? Object.values(data.owners)[0] as any : data;
      if (mine?.skippedPaused) toast?.("Ran — automations are paused, nothing sent", "yellow");
      else if ((mine?.sent || 0) === 0 && (mine?.failed || 0) === 0) toast?.("Ran — nothing due to send right now", "green");
      else toast?.(`Ran — ${mine?.sent || 0} sent${mine?.failed ? `, ${mine.failed} failed` : ""} ✓`, mine?.failed ? "yellow" : "green");
    } catch (e: any) {
      toast?.("Run failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setRunning(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Glass className={"p-4 " + (healthy ? "!bg-emerald-950/10 !border-emerald-700/20" : "!bg-blue-950/10 !border-blue-700/20")}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold flex items-center gap-1.5">
            <Zap size={13} className={healthy ? "text-emerald-400" : "text-blue-400"} />
            Background Automations {healthy ? "— Running ✓" : lastRunAt ? "— Not Checking In Regularly" : "— Not Set Up Yet"}
          </div>
          <div className="text-xs text-white/60 mt-0.5 max-w-xl">
            Only automations set to <b>"Auto-send"</b> below run without you opening the app. Last checked: <b>{fmtAgo(lastRunAt)}</b>.
            {!healthy && " Set up the free pinger below so this runs every 15 minutes on its own."}
          </div>
        </div>
        <button onClick={runNow} disabled={running} className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition disabled:opacity-50 flex items-center gap-1.5">
          <RefreshCw size={12} className={running ? "animate-spin" : ""} />{running ? "Running…" : "Run Now"}
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-white/10">
        <div className="text-[11px] text-white/50 mb-1.5">
          To make this run automatically forever, point a free scheduler at this URL every 15 minutes — <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">cron-job.org</a> works well (free, no card required), or use a Cloudflare Cron Trigger if your plan has one (Cloudflare Pages dashboard → this project → Settings → Functions).
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white/70">{url}</code>
          <button onClick={copyUrl} className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[11px] font-medium transition flex items-center gap-1">
            {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}{copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </Glass>
  );
}
