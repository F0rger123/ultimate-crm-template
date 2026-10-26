// Settings → AI Models: what the automatic model watch found
// (functions/api/_lib/modelWatch.ts) — each AI model's last test, models it
// swapped automatically, new free models, and free providers not set up yet.
import React, { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Sparkles, ExternalLink, Shuffle } from "lucide-react";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { fetchModelWatch, type ModelWatchStatus } from "../../lib/modelWatch";

const KIND_TEXT: Record<string, string> = { ok: "working", key: "key not working", credit: "out of credit", limit: "rate-limited right now", gone: "model retired", error: "not answering" };
const ago = (iso?: string | null) => { if (!iso) return "never"; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };

export function ModelWatchPanel({ toast }: { toast?: (m: string, tone?: any) => void }) {
  const [busy, setBusy] = useState(false);
  const [s, setS] = useState<ModelWatchStatus | null>(null);
  const [err, setErr] = useState("");
  const load = async (action: "status" | "check") => {
    setBusy(true); setErr("");
    try { setS(await fetchModelWatch(action)); if (action === "check") toast?.("AI models checked", "green"); }
    catch (e: any) { setErr(e?.message || "Couldn't load the model watch"); }
    finally { setBusy(false); }
  };
  useEffect(() => { load("status"); }, []);
  const slots = Object.entries(s?.health?.slots || {});
  const overrides = Object.entries(s?.overrides || {});
  return (
    <Glass className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-sm flex items-center gap-2"><Shuffle size={14} className="text-purple-400" />Automatic model watch</div>
          <div className="text-[11px] text-white/50 mt-0.5">Every few hours the CRM tests each AI model you have a key for, swaps any model a provider retires for a working one from the same provider, and looks for new free models. Last check: {ago(s?.health?.checkedAt || s?.checkedAt)}.</div>
        </div>
        <GBtn variant="ghost" onClick={() => load("check")} disabled={busy} className="!text-xs flex-shrink-0"><RefreshCw size={12} className={"inline mr-1 " + (busy ? "animate-spin" : "")} />{busy ? "Checking…" : "Check now"}</GBtn>
      </div>
      {err && <div className="text-xs text-red-300">{err}</div>}
      {slots.length > 0 && (
        <div className="space-y-1">
          {slots.map(([slot, h]) => (
            <div key={slot} className="flex items-start gap-2 text-xs">
              {h.ok ? <CheckCircle size={13} className="text-green-400 mt-0.5 flex-shrink-0" /> : h.kind === "limit" ? <AlertTriangle size={13} className="text-yellow-300 mt-0.5 flex-shrink-0" /> : <XCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />}
              <div className="min-w-0"><span className="font-medium">{slot}</span> <span className="text-white/50">— {h.model} · {KIND_TEXT[h.kind] || h.kind}{h.ok && h.ms ? ` (${(h.ms / 1000).toFixed(1)}s)` : ""}</span></div>
            </div>
          ))}
        </div>
      )}
      {s && slots.length === 0 && !busy && <div className="text-xs text-white/50">No results yet — press Check now.</div>}
      {overrides.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Swapped automatically</div>
          {overrides.map(([slot, o]) => <div key={slot} className="text-xs text-white/70">{slot}: {o.was} → <span className="text-white">{o.model}</span> <span className="text-white/40">({o.reason}, {ago(o.at)})</span></div>)}
        </div>
      )}
      {(s?.newFree?.length || 0) > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1 flex items-center gap-1"><Sparkles size={10} />New free models</div>
          <div className="text-xs text-white/60">{s!.newFree.slice(0, 6).map(n => `${n.model} (${n.provider})`).join(", ")} — OpenRouter ones are used automatically; NVIDIA ones once they pass a test.</div>
        </div>
      )}
      {(s?.health?.suggestions?.length || 0) > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Free AI providers you haven't connected</div>
          <div className="space-y-1">
            {s!.health!.suggestions.map(p => (
              <a key={p.provider} href={p.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-purple-200 hover:text-white">
                <ExternalLink size={11} />{p.name}<span className="text-white/40">— {p.why}</span>
              </a>
            ))}
          </div>
          <div className="text-[11px] text-white/40 mt-1">Signing up needs your own free account — then paste the key above and the watch takes it from there.</div>
        </div>
      )}
    </Glass>
  );
}
