// Sends a real Web Push notification to one owner's (optionally one
// employee's) registered device(s). See functions/api/_lib/webPush.ts for
// the actual RFC 8291/8292 implementation — this file is just the
// HTTP endpoint wiring: look up subscriptions, send to each, clean up any
// the push service reports as dead.
//
// Setup (Cloudflare Pages -> Settings -> Variables and Secrets):
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — generate a pair with
//   `npm run gen:vapid`; the same public key goes in VITE_VAPID_PUBLIC_KEY.
//   VAPID_SUBJECT — mailto: contact address (optional).
//   SUPABASE_SERVICE_ROLE_KEY.

import { sendWebPush, PushSubscriptionKeys } from "./_lib/webPush";
import { resolveCallerOwnerId } from "./_lib/ownerSecrets";
import { SUPABASE_URL } from "./_lib/env";


const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPrivateKey = context.env.VAPID_PRIVATE_KEY;
  if (!serviceRoleKey) return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var." }, 500);
  if (!vapidPrivateKey) return json({ error: "Server missing VAPID_PRIVATE_KEY env var — run npm run gen:vapid and set it in Cloudflare." }, 500);
  const vapidPublicKey = context.env.VAPID_PUBLIC_KEY || context.env.VITE_VAPID_PUBLIC_KEY || "";
  if (!vapidPublicKey) return json({ error: "Server missing VAPID_PUBLIC_KEY env var." }, 500);
  const vapidSubject = context.env.VAPID_SUBJECT || "mailto:admin@example.com";

  try {
    const body = await context.request.json() as { ownerId?: string; employeeId?: string; title?: string; body?: string; url?: string; tag?: string };
    let { ownerId, employeeId, title, body: msgBody, url, tag } = body;
    if (!ownerId || !title || !msgBody) return json({ error: "ownerId, title, and body are required" }, 400);

    // SECURITY FIX (audit finding) — this endpoint had no auth check: any
    // caller who guessed/obtained an ownerId could push arbitrary
    // notification text to that business's registered devices. Every real
    // call site (App.tsx crew-activity/payment notifications, CalendarPage,
    // JobDetailModal) runs inside an authenticated owner/employee session,
    // so this always resolves — the client-supplied ownerId is ignored in
    // favor of the one resolved from the caller's own session.
    const authHeader = context.request.headers.get("Authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const resolvedOwnerId = await resolveCallerOwnerId(accessToken);
    if (!resolvedOwnerId) return json({ error: "Not authenticated" }, 401);
    ownerId = resolvedOwnerId;

    // BUG FIX — "employees getting notifications meant for the owner."
    // Omitting employeeId used to match owner_id=eq.<ownerId> ALONE — but
    // every employee's own push subscription ALSO carries that same
    // owner_id (see subscribeToPush in lib/push.ts), so an owner-only send
    // (shift started, crew arrived, issue reported — see App.tsx's call
    // sites) was silently blasted to every employee's phone too instead of
    // just the owner's. employee_id=is.null scopes an owner-targeted send
    // to rows with no employee attached — the owner's own subscription(s)
    // only.
    const filter = employeeId
      ? `owner_id=eq.${encodeURIComponent(ownerId)}&employee_id=eq.${encodeURIComponent(employeeId)}`
      : `owner_id=eq.${encodeURIComponent(ownerId)}&employee_id=is.null`;
    const subsRes = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?${filter}&select=id,endpoint,p256dh,auth`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    const subs = await subsRes.json().catch(() => []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>;
    if (!Array.isArray(subs) || subs.length === 0) return json({ sent: 0, note: "No registered devices for this target." });

    const payload = { title, body: msgBody, url: url || "/", tag: tag || "crm-starter" };
    const staleIds: string[] = [];
    let sent = 0;
    for (const sub of subs) {
      const keys: PushSubscriptionKeys = { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth };
      const result = await sendWebPush(keys, payload, vapidPublicKey, vapidPrivateKey, vapidSubject);
      if (result.ok) sent++;
      else if (result.gone) staleIds.push(sub.id);
      else console.error("[send-push] failed for", sub.id, "-", result.status, result.error);
    }
    if (staleIds.length > 0) {
      // Best-effort cleanup — a dead subscription (uninstalled app, revoked
      // permission) just sits there wasting a send attempt every time
      // otherwise; not worth failing the whole request over.
      await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=in.(${staleIds.map(encodeURIComponent).join(",")})`, {
        method: "DELETE",
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      }).catch(() => {});
    }
    return json({ sent, total: subs.length, removed: staleIds.length });
  } catch (e: any) {
    return json({ error: e?.message || "Push send error" }, 500);
  }
};
