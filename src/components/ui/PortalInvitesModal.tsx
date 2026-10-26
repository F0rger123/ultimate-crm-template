// Customers → "Portal invites": text/email every customer their personal
// customer-portal link (details pre-filled, they just pick a password), and
// the "invite new customers automatically" switch.
import React, { useState } from "react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { getPortalInvites, sendPortalInvites } from "../../lib/portalInvites";

export function PortalInvitesModal({ open, onClose, customers = [], settings = {} as any, setSettings, toast }: { open: boolean; onClose: () => void; customers?: any[]; settings?: any; setSettings?: any; toast?: (m: string, tone?: any) => void }) {
  const [resend, setResend] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<string>("");
  const reachable = customers.filter((c: any) => c.pipelineStage !== "lead" && !c.isTestClient && ((c.phone && settings?.twilioSid) || (c.email && (settings?.googleConnected || settings?.googleProviderToken))));
  const noContact = customers.filter((c: any) => c.pipelineStage !== "lead" && !c.phone && !c.email).length;
  const auto = settings?.autoPortalInvite !== false;

  const run = async () => {
    if (!reachable.length) return;
    if (!window.confirm(`Send portal invites to up to ${reachable.length} customer${reachable.length !== 1 ? "s" : ""}${resend ? " (including ones already invited)" : " who haven't been invited yet"}?`)) return;
    setBusy(true); setResult(""); setProgress([0, reachable.length]);
    try {
      const invites = await getPortalInvites(reachable.map((c: any) => c.id));
      const todo = invites.filter(i => !i.claimed && (resend || !i.sentAt));
      const r = await sendPortalInvites(settings, todo, (d, t) => setProgress([d, t]));
      const already = invites.length - todo.length;
      const msg = `Sent ${r.sent}` + (already ? ` · ${already} already invited or signed up` : "") + (r.skipped ? ` · ${r.skipped} skipped (no way to reach them)` : "") + (r.failed ? ` · ${r.failed} failed${r.errors.length ? ": " + r.errors.join("; ") : ""}` : "");
      setResult(msg);
      toast?.(msg, r.failed ? "yellow" : "green");
    } catch (e: any) {
      setResult("Couldn't send — " + (e?.message || "unknown error"));
      toast?.("Couldn't send — " + (e?.message || "unknown error"), "red");
    } finally { setBusy(false); setProgress(null); }
  };

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Customer portal invites" maxW="max-w-md">
      <div className="space-y-4 text-sm">
        <div className="text-xs text-white/60">Each customer gets their own link. Their name, email and phone are already filled in — they just choose a password, and they can see their jobs, invoices and coupons and pay online.</div>
        <label className="flex items-start gap-2 text-xs cursor-pointer rounded-xl border border-white/10 p-3">
          <input type="checkbox" checked={auto} onChange={e => setSettings?.((s: any) => ({ ...s, autoPortalInvite: e.target.checked }))} className="accent-green-500 mt-0.5" />
          <span><span className="font-semibold text-white">Invite new customers automatically</span><br /><span className="text-white/50">When you add a customer (not imports or leads), they get their link right away.</span></span>
        </label>
        <div className="rounded-xl border border-white/10 p-3 space-y-1 text-xs">
          <div><span className="font-semibold text-white">{reachable.length}</span> customer{reachable.length !== 1 ? "s" : ""} can be reached{settings?.twilioSid ? " (text first, email otherwise)" : " by email"}.</div>
          {noContact > 0 && <div className="text-white/45">{noContact} have no phone or email on file.</div>}
          {!settings?.twilioSid && !(settings?.googleConnected || settings?.googleProviderToken) && <div className="text-yellow-300">Connect Twilio or Google in Settings to send invites.</div>}
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={resend} onChange={e => setResend(e.target.checked)} className="accent-brand-500" />Also resend to customers who were invited before but haven't signed up</label>
        {progress && <div className="text-xs text-white/60">Sending… {progress[0]} / {progress[1]}</div>}
        {result && <div className="text-xs text-green-300">{result}</div>}
        <div className="flex gap-2 justify-end">
          <GBtn variant="ghost" onClick={onClose} disabled={busy}>Close</GBtn>
          <GBtn onClick={run} disabled={busy || !reachable.length}>{busy ? "Sending…" : "Send invites"}</GBtn>
        </div>
      </div>
    </Modal>
  );
}
