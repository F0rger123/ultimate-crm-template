// Real Web Push notifications — works on Android (any Chromium browser,
// installed or not) and on iOS 16.4+ (Safari), but on iOS ONLY for a PWA
// actually added to the Home Screen first (iOS refuses permission requests
// from a plain Safari tab — see requestPushPermission's error message,
// which is the one thing this code can't route around, it's an Apple
// platform requirement, not a bug here).
import { supabase } from "./supabase";
import { withTimeout } from "./utils";

// Public by design (same trust level as a Stripe publishable key) — pairs
// with VAPID_PRIVATE_KEY, which only ever lives server-side as a Cloudflare
// Pages environment variable (functions/api/send-push.ts). Regenerating
// this pair would invalidate every existing subscriber, so treat it as
// fixed once real users have subscribed.
export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || "";

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

export type PushSupportState = "unsupported" | "ios-needs-install" | "denied" | "ready" | "not-configured";

// iOS Safari only exposes the Push API to a page running as an installed
// Home Screen app (`navigator.standalone` / display-mode: standalone) — a
// regular browser tab has no PushManager at all there, even on 16.4+. This
// check is what lets the UI show "install the app first" instead of a
// confusing silent failure.
export const getPushSupportState = (): PushSupportState => {
  if (!VAPID_PUBLIC_KEY) return "not-configured";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)")?.matches;
  if (isIos && !isStandalone) return "ios-needs-install";
  if (Notification.permission === "denied") return "denied";
  return "ready";
};

export const isPushSubscribed = async (): Promise<boolean> => {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
};

// Requests permission, subscribes via the browser's real push service
// (Chrome -> FCM, Safari -> Apple's push service, Firefox -> autopush —
// all handled transparently by the browser once given a VAPID key), and
// saves the subscription to Supabase scoped to this owner (+ optionally
// the specific employee/customer). Returns an error string on failure, or
// null on success.
export const subscribeToPush = async (opts: { ownerId: string; employeeId?: string; customerId?: string }): Promise<string | null> => {
  const state = getPushSupportState();
  if (state === "not-configured") return "Push notifications aren't set up for this app yet (the administrator needs to add VAPID keys).";
  if (state === "unsupported") return "This browser doesn't support push notifications.";
  if (state === "ios-needs-install") return "On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there and try again — iOS only allows notifications for an installed app, not a browser tab.";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "Notifications are blocked — check your device/browser settings to allow them for this app." : "Permission wasn't granted.";
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as any });
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return "Subscription came back incomplete — try again.";
    const { error } = await (supabase as any).from("push_subscriptions").upsert({
      owner_id: opts.ownerId,
      employee_id: opts.employeeId || null,
      customer_id: opts.customerId || null,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    }, { onConflict: "endpoint" });
    if (error) return "Saved locally but couldn't sync to your account — " + error.message;
    return null;
  } catch (e: any) {
    return e?.message || "Couldn't subscribe to push notifications.";
  }
};

export const unsubscribeFromPush = async (): Promise<void> => {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await (supabase as any).from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* best-effort */ }
};

// Fire-and-forget trigger for the server to actually send one — every real
// notification point in the app (job assigned, new inbox message, etc.)
// calls this the same way it already calls twilioSend/sendEmail for other
// channels. Never throws — a push failing should never break the action
// that triggered it.
export const sendPushNotification = async (opts: {
  ownerId: string;
  employeeId?: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<void> => {
  try {
    // SECURITY FIX — the server now requires a real session and resolves
    // the caller's own owner_id from it (ignoring opts.ownerId) — see
    // functions/api/send-push.ts's own comment. getSession() has a
    // documented hang bug in this codebase with no timeout.
    let accessToken: string | undefined;
    try {
      const { data } = await withTimeout(supabase.auth.getSession(), 8000, "Get session");
      accessToken = data?.session?.access_token;
    } catch { /* fall through — server will reject with no valid session */ }
    // BUG FIX (user report — "no native notifications at all, on Android")
    // — fetch() only rejects on a genuine network failure, never on a
    // non-2xx HTTP response, so a real server-side failure here (most
    // commonly: VAPID_PRIVATE_KEY or SUPABASE_SERVICE_ROLE_KEY never set as
    // a Cloudflare Pages environment variable — see functions/api/send-
    // push.ts's own setup comment) was completely invisible — not even a
    // console.warn, on either the sender's or the recipient's device, in
    // EVERY call site that ever calls this function. Every push in the
    // whole app could be silently failing 100% of the time with zero trace
    // anywhere. Now actually reads the response and logs the real reason.
    const res = await fetch("/api/send-push", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify(opts),
    });
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      console.error("[Push] send-push failed (" + res.status + "):", data?.error || "unknown error — check Cloudflare Pages env vars VAPID_PRIVATE_KEY / VAPID_SUBJECT / SUPABASE_SERVICE_ROLE_KEY are set");
    } else if (data?.sent === 0 && data?.total === 0) {
      console.warn("[Push] no registered devices for this target — the recipient never completed the 'turn on notifications' opt-in prompt on this device.");
    } else {
      console.log("[Push] sent:", data?.sent, "/", data?.total);
    }
  } catch (e: any) {
    console.warn("[Push] send threw:", e?.message);
  }
};
