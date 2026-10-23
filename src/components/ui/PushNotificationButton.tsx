// Real push-notification opt-in button — owner request: "actual push
// notifications for mobile when you download it, for iPhones and
// Androids." Same always-visible, explains-itself-in-every-state pattern as
// InstallAppButton.tsx right next to it (that one gets you the installed
// app; this one turns on real notifications once you're using it).
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, BellRing, CheckCircle } from "lucide-react";
import { getPushSupportState, isPushSubscribed, subscribeToPush, unsubscribeFromPush } from "../../lib/push";

export function PushNotificationButton({
  ownerId, employeeId, className = "", label = "Notifications", labelClassName = "",
}: {
  ownerId: string;
  employeeId?: string;
  className?: string;
  label?: string;
  labelClassName?: string;
}) {
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [helpModal, setHelpModal] = useState<"ios" | "denied" | "on" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    isPushSubscribed().then(setSubscribed);
  }, []);

  const toggle = async () => {
    if (!ownerId) return;
    if (subscribed) {
      setBusy(true);
      await unsubscribeFromPush();
      setSubscribed(false);
      setBusy(false);
      return;
    }
    const state = getPushSupportState();
    if (state === "ios-needs-install") { setHelpModal("ios"); return; }
    if (state === "denied") { setHelpModal("denied"); return; }
    setBusy(true);
    const error = await subscribeToPush({ ownerId, employeeId });
    setBusy(false);
    if (error) {
      setErrorMsg(error);
      setHelpModal(error.includes("Home Screen") ? "ios" : error.includes("blocked") ? "denied" : "error");
      return;
    }
    setSubscribed(true);
    setHelpModal("on");
  };

  return (
    <>
      <button
        onClick={toggle}
        disabled={busy}
        className={"flex items-center justify-center " + (label ? "gap-1.5 px-3 py-1.5" : "") + " rounded-xl border text-xs font-semibold transition disabled:opacity-50 " + (subscribed ? "bg-green-900/30 border-green-700/40 text-green-300 hover:bg-green-900/50" : "bg-brand-900/30 border-brand-700/40 text-brand-300 hover:bg-brand-900/50") + " " + className}
      >
        {subscribed ? <BellRing size={13} className="flex-shrink-0" /> : <Bell size={13} className="flex-shrink-0" />}
        {/* BUG FIX — same phantom-gap centering issue as InstallAppButton:
            an empty label still rendered an empty, gapped <span>, pushing
            the icon off-center in the icon-only header button. */}
        {label && <span className={labelClassName}>{busy ? "…" : subscribed ? "Notifications On" : label}</span>}
      </button>

      {helpModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70" onClick={() => setHelpModal(null)}>
          <div className="bg-neutral-950 border border-white/10 rounded-2xl p-5 max-w-sm text-sm text-white space-y-3" onClick={e => e.stopPropagation()}>
            {helpModal === "ios" && (
              <>
                <div className="font-semibold">Add to Home Screen first</div>
                <p className="text-white/70 leading-relaxed">iPhone/iPad only allow real notifications for an app added to your Home Screen, not a Safari tab.</p>
                <ol className="list-decimal list-inside space-y-1.5 text-white/70">
                  <li>Tap the Share button (square with an arrow) in Safari's toolbar.</li>
                  <li>Scroll down and tap "Add to Home Screen."</li>
                  <li>Open the app from your Home Screen, then tap this button again.</li>
                </ol>
              </>
            )}
            {helpModal === "denied" && (
              <>
                <div className="font-semibold">Notifications are blocked</div>
                <p className="text-white/70 leading-relaxed">You (or this device) previously blocked notifications for this app. Check your browser or phone's notification settings for this site/app and allow them, then try again.</p>
              </>
            )}
            {helpModal === "on" && (
              <>
                <div className="font-semibold flex items-center gap-2"><CheckCircle size={16} className="text-green-400" />Notifications turned on</div>
                <p className="text-white/70 leading-relaxed">You'll get real push notifications on this device, even when the app isn't open.</p>
              </>
            )}
            {helpModal === "error" && (
              <>
                <div className="font-semibold">Couldn't turn on notifications</div>
                <p className="text-white/70 leading-relaxed">{errorMsg}</p>
              </>
            )}
            <button onClick={() => setHelpModal(null)} className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold">Got it</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
