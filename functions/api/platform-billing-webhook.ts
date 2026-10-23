import { SUPABASE_URL } from "./_lib/env";
// FEATURE — "help me get paid." Server-side, signature-verified source of
// truth for the PLATFORM's own subscriptions (CRM Starter charging a signed-up
// business, distinct from stripe-webhook.ts which tracks THAT business's
// own customers' invoice payments). Same HMAC verification pattern as
// stripe-webhook.ts.
//
// Setup:
// 1. Cloudflare Pages dashboard → this project → Settings → Environment
//    variables → add PLATFORM_STRIPE_SECRET_KEY and
//    PLATFORM_STRIPE_WEBHOOK_SECRET (from your OWN Stripe account — this is
//    the account CRM Starter revenue lands in, separate from any individual
//    owner's own connected Stripe account).
// 2. Stripe dashboard (your platform account) → Developers → Webhooks →
//    Add endpoint → https://<your-domain>/api/platform-billing-webhook
//    → select events: checkout.session.completed, customer.subscription.updated,
//      customer.subscription.deleted, invoice.payment_failed
// 3. Stripe shows the signing secret ("whsec_...") when you create the
//    endpoint — that's PLATFORM_STRIPE_WEBHOOK_SECRET.


const verifyStripeSignature = async (payload: string, sigHeader: string, secret: string): Promise<boolean> => {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(",").map(kv => { const i = kv.indexOf("="); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  const timestamp = parts["t"];
  const v1 = parts["v1"];
  if (!timestamp || !v1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
};

// SECURITY/CORRECTNESS FIX (audit finding — High) — customer.subscription.
// updated/deleted used to key EXCLUSIVELY off sub.metadata?.ownerId, which
// the pay-first signup flow (create_signup_checkout_session in
// platform-billing.ts) couldn't set at subscription-creation time (no
// account exists yet then) — platform-billing.ts's complete_signup now
// patches it in after the fact, but any subscription created BEFORE that
// fix shipped still has no metadata.ownerId and would silently no-op here
// forever, exactly like invoice.payment_failed already had to work around
// below. Same fallback: resolve by the subscription id already stored on
// the row from its own initial creation.
const resolveOwnerIdForSubscription = async (serviceRoleKey: string, sub: any): Promise<string | null> => {
  if (sub?.metadata?.ownerId) return sub.metadata.ownerId;
  if (!sub?.id) return null;
  const findRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?stripe_subscription_id=eq.${encodeURIComponent(sub.id)}&select=owner_id`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await findRes.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.owner_id ? rows[0].owner_id : null;
};

const upsertSubscription = async (serviceRoleKey: string, ownerId: string, patch: Record<string, unknown>): Promise<boolean> => {
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ owner_id: ownerId, ...patch, updated_at: new Date().toISOString() }),
  });
  return res.ok;
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const secret = context.env.PLATFORM_STRIPE_WEBHOOK_SECRET;
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server missing PLATFORM_STRIPE_WEBHOOK_SECRET or SUPABASE_SERVICE_ROLE_KEY." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const payload = await context.request.text();
  const sigHeader = context.request.headers.get("stripe-signature") || "";
  const valid = await verifyStripeSignature(payload, sigHeader, secret);
  if (!valid) return new Response(JSON.stringify({ error: "Invalid Stripe signature" }), { status: 400, headers: { "Content-Type": "application/json" } });

  let event: any;
  try { event = JSON.parse(payload); } catch { return new Response(JSON.stringify({ error: "Malformed JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } }); }

  try {
    let ok = true;
    if (event.type === "checkout.session.completed") {
      const session = event.data?.object || {};
      const ownerId = session.metadata?.ownerId;
      if (ownerId) {
        ok = await upsertSubscription(serviceRoleKey, ownerId, {
          status: "active",
          plan: session.metadata?.plan || null,
          interval: session.metadata?.interval || null,
          stripe_customer_id: session.customer || null,
          stripe_subscription_id: session.subscription || null,
        });
      }
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data?.object || {};
      const ownerId = await resolveOwnerIdForSubscription(serviceRoleKey, sub);
      if (ownerId) {
        // Stripe's subscription.status: active | past_due | canceled | unpaid | incomplete | trialing
        ok = await upsertSubscription(serviceRoleKey, ownerId, {
          status: sub.status,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          stripe_subscription_id: sub.id,
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : undefined,
        });
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data?.object || {};
      const ownerId = await resolveOwnerIdForSubscription(serviceRoleKey, sub);
      if (ownerId) ok = await upsertSubscription(serviceRoleKey, ownerId, { status: "canceled" });
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data?.object || {};
      const subId = typeof invoice.subscription === "string" ? invoice.subscription : undefined;
      // invoice objects don't carry the subscription's own metadata — look
      // the row up by subscription id instead of trusting anything on the
      // invoice itself.
      if (subId) {
        const findRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?stripe_subscription_id=eq.${encodeURIComponent(subId)}&select=owner_id`, {
          headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
        });
        const rows = await findRes.json().catch(() => []);
        const ownerId = Array.isArray(rows) ? rows[0]?.owner_id : null;
        if (ownerId) ok = await upsertSubscription(serviceRoleKey, ownerId, { status: "past_due" });
      }
    } else {
      return new Response(JSON.stringify({ received: true, ignored: event.type }), { headers: { "Content-Type": "application/json" } });
    }
    if (!ok) return new Response(JSON.stringify({ error: "Failed to update subscription" }), { status: 500, headers: { "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Webhook handler error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
