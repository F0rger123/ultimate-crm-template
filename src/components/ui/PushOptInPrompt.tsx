// PushOptInPrompt.tsx — replaces the old always-visible "Notify Me" toggle
// button in the header. Explicit user feedback: "it shouldn't have a button
// that turns native notifications on and off; it should have a one-time
// pop-up that asks if you want to enable them, then natively enable push
// notifications." Shows once per device (tracked in localStorage, separate
// from any Notification.permission state so it still asks once even if the
// browser's own permission stayed "default" from a prior dismissal), then
// never again regardless of the answer — there's no persistent control left
// behind, matching what was asked for.
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell } from "lucide-react";
import { getPushSupportState, isPushSubscribed, subscribeToPush } from "../../lib/push";

const STORAGE_KEY = "crm.pushPrompted";

export function PushOptInPrompt({ ownerId, employeeId }: { ownerId: string; employeeId?: string }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  // BUG FIX — "double-check that native notifications work on iPhone."
  // subscribeToPush() already correctly detects iOS Safari running as a
  // plain browser tab (not installed to the Home Screen) — Apple only
  // delivers Web Push to an INSTALLED PWA, never a regular Safari tab —
  // and returns a real explanatory string for it. This component used to
  // throw that string away entirely: tapping "Enable" on an iPhone that
  // hadn't installed the app yet called subscribeToPush, got back an
  // unusable-but-ignored error string, and just silently closed the
  // popup — the owner had no idea why notifications never arrived.
  // needsIosInstall is checked up front so the very first thing an
  // un-installed iPhone user sees is the actual instructions, not a
  // button that was always going to fail.
  const [needsIosInstall, setNeedsIosInstall] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "default") { localStorage.setItem(STORAGE_KEY, "1"); return; }
    const state = getPushSupportState();
    if (state === "not-configured") return; // no VAPID keys on this deployment — don't nag, and don't remember the dismissal
    if (state === "unsupported") { localStorage.setItem(STORAGE_KEY, "1"); return; }
    let cancelled = false;
    isPushSubscribed().then(sub => {
      if (cancelled) return;
      if (sub) { localStorage.setItem(STORAGE_KEY, "1"); return; }
      if (state === "ios-needs-install") setNeedsIosInstall(true);
      // Small delay so this doesn't compete with the page's own first paint.
      setTimeout(() => { if (!cancelled) setShow(true); }, 1500);
    });
    return () => { cancelled = true; };
  }, [ownerId]);

  const dismiss = () => { localStorage.setItem(STORAGE_KEY, "1"); setShow(false); };
  const enable = async () => {
    setBusy(true);
    setErrorMsg(null);
    const err = await subscribeToPush({ ownerId, employeeId });
    setBusy(false);
    if (err) { setErrorMsg(err); return; } // keep the popup open so the message is actually seen
    dismiss();
  };

  if (!show) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70" onClick={dismiss}>
      <div className="bg-neutral-950 border border-white/10 rounded-2xl p-5 max-w-sm text-sm text-white space-y-3 text-center" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-brand-900/30 border border-brand-700/40 flex items-center justify-center mx-auto">
          <Bell size={20} className="text-brand-300" />
        </div>
        {needsIosInstall ? (
          <>
            <div className="font-semibold">Add to Home Screen for notifications</div>
            <p className="text-white/60 leading-relaxed">iPhone only allows notifications for an installed app, not a Safari tab. Tap the Share button below, then "Add to Home Screen" — open CRM Starter from that icon and you'll be able to turn notifications on.</p>
            <button onClick={dismiss} className="w-full py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs font-semibold transition">Got it</button>
          </>
        ) : (
          <>
            <div className="font-semibold">Turn on notifications?</div>
            <p className="text-white/60 leading-relaxed">Get notified about job updates, new messages, and schedule changes — even when the app is closed.</p>
            {errorMsg && <div className="text-[11px] text-yellow-300 bg-yellow-950/20 border border-yellow-700/30 rounded-lg p-2 text-left">{errorMsg}</div>}
            <div className="flex gap-2 pt-1">
              <button onClick={dismiss} className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white text-xs font-semibold transition">Not now</button>
              <button onClick={enable} disabled={busy} className="flex-1 py-2 rounded-xl bg-brand-700 hover:bg-brand-600 text-brand-fg text-xs font-semibold transition disabled:opacity-50">{busy ? "…" : "Enable"}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
