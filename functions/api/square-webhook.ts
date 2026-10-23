import { SUPABASE_URL, SQUARE_ENVIRONMENT } from "./_lib/env";
// AUDIT FIX — Square recurring subscriptions had NO webhook or status-sync
// of any kind (square-action.ts's create_square_recurring_plan comment
// openly flagged this as out of scope until now). After a subscription
// started, nothing in this app ever checked back in — a declined renewal,
// or a subscription cancelled straight from Square's own dashboard, left
// customers.recurringPlan.status stuck on "active" forever. This endpoint
// mirrors stripe-webhook.ts's own shape and trust model closely: signature
// verification is the real authorization boundary, then a service-role
// write records what actually happened.
//
// Setup (per owner, since each business has its own Square account):
// 1. Square Developer Dashboard → your app → Webhooks → Subscriptions →
//    Add Endpoint → https://<your-domain>/api/square-webhook?oid=<ownerId>
//    (the ownerId is shown in Settings → Integrations → Square once this
//    is wired into the UI — for now, ask support/read it off the owner's
//    own account id).
// 2. Subscribe to events: subscription.updated, invoice.updated.
// 3. Square shows a Signature Key when you save the subscription — paste
//    that into Settings → Integrations → Square (square_webhook_signature_key
//    column on owner_square_accounts, service-role-only, same as Stripe's
//    webhook secret).
//
// Requires SUPABASE_SERVICE_ROLE_KEY (see stripe-webhook.ts's own header
// comment for the full reasoning — owner_id-scoped RLS means an anon-key
// write here would silently match 0 rows).

const squareApiBase = () => SQUARE_ENVIRONMENT === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

// Square's signature scheme: base64(HMAC-SHA256(signatureKey, notificationUrl + rawBody)).
// Compared against the x-square-hmacsha256-signature header. Verified with
// the platform's native Web Crypto SubtleCrypto, matching this codebase's
// existing "direct API calls, no SDK" pattern (see stripe-webhook.ts).
const verifySquareSignature = async (notificationUrl: string, body: string, signatureHeader: string, signatureKey: string): Promise<boolean> => {
  if (!signatureHeader || !signatureKey) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(signatureKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(notificationUrl + body));
  let expected = "";
  const bytes = new Uint8Array(sigBuf);
  for (let i = 0; i < bytes.length; i++) expected += String.fromCharCode(bytes[i]);
  expected = btoa(expected);
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  return diff === 0;
};

const getOwnerSquareAccount = async (ownerId: string, serviceRoleKey: string) => {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/owner_square_accounts?owner_id=eq.${encodeURIComponent(ownerId)}&select=square_access_token,square_webhook_signature_key`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] : null;
};

// Subscription events don't carry the CRM's own customer id (Square's
// Subscription object has no arbitrary metadata field the way Stripe's
// does) — square-action.ts already stashes squareSubscriptionId on the CRM
// customer row when the plan is created, so that's the correlation key
// back the other direction. PostgREST's jsonb ->> operator lets this filter
// straight on the nested field without a dedicated column.
const findCustomerBySquareSubscription = async (ownerId: string, subscriptionId: string, serviceRoleKey: string): Promise<{ id: string } | null> => {
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/customers?owner_id=eq.${encodeURIComponent(ownerId)}&recurringPlan->>squareSubscriptionId=eq.${encodeURIComponent(subscriptionId)}&select=id&limit=1`,
    { headers: authHeaders }
  );
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.id ? rows[0] : null;
};

const patchCustomerRecurringPlan = async (crmCustomerId: string, patch: Record<string, unknown>, serviceRoleKey: string): Promise<boolean> => {
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(crmCustomerId)}&select=recurringPlan`, { headers: authHeaders });
  const rows = await getRes.json().catch(() => []);
  const existing = Array.isArray(rows) && rows[0]?.recurringPlan ? rows[0].recurringPlan : {};
  const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(crmCustomerId)}&select=id`, {
    method: "PATCH",
    headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ recurringPlan: { ...existing, ...patch } }),
  });
  if (!res.ok) { console.error("[SquareWebhook] recurringPlan update failed:", res.status, await res.text().catch(() => "")); return false; }
  const updated = await res.json().catch(() => []);
  return Array.isArray(updated) && updated.length > 0;
};

// Same "insert a real paid invoice row" pattern as stripe-webhook.ts's
// recordRecurringPayment, deduped on squareInvoiceId (migration 0083) since
// Square, like Stripe, redelivers webhooks on any non-2xx response.
const recordRecurringPayment = async (crmCustomerId: string, ownerId: string, amountCents: number, description: string, squareInvoiceId: string, serviceRoleKey: string): Promise<void> => {
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  if (squareInvoiceId) {
    const dupRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?squareInvoiceId=eq.${encodeURIComponent(squareInvoiceId)}&select=id&limit=1`, { headers: authHeaders });
    const dupRows = await dupRes.json().catch(() => []);
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      console.log("[SquareWebhook] recurring payment for Square invoice", squareInvoiceId, "already recorded — skipping duplicate insert");
      return;
    }
  }
  const amount = amountCents / 100;
  const today = new Date().toISOString().slice(0, 10);
  await fetch(`${SUPABASE_URL}/rest/v1/estimates`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      id: crypto.randomUUID(), customerId: crmCustomerId, owner_id: ownerId, invoiced: true, status: "accepted",
      title: description || "Recurring service",
      items: [{ id: crypto.randomUUID(), description: description || "Recurring service", qty: 1, price: amount }],
      total: amount, paidAt: today, stripePaymentStatus: "paid", squareInvoiceId: squareInvoiceId || undefined,
      paymentLog: [{ id: crypto.randomUUID(), at: new Date().toISOString(), type: "paid", amount, note: "Recurring payment via Square (" + squareInvoiceId + ")" }],
      createdAt: Date.now(),
    }),
  }).catch(e => console.error("[SquareWebhook] recordRecurringPayment insert failed:", e?.message));
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const url = new URL(context.request.url);
  const oid = url.searchParams.get("oid");
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!oid) return new Response(JSON.stringify({ error: "Missing ?oid= on webhook URL — see this file's setup comment." }), { status: 400, headers: { "Content-Type": "application/json" } });
  if (!serviceRoleKey) return new Response(JSON.stringify({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var." }), { status: 500, headers: { "Content-Type": "application/json" } });

  const acct = await getOwnerSquareAccount(oid, serviceRoleKey);
  if (!acct?.square_webhook_signature_key) {
    return new Response(JSON.stringify({ error: `No Square webhook signature key on file for owner ${oid} — add one in Settings → Integrations → Square.` }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  // MUST read the raw body text before any JSON parsing — the signature is
  // computed over the exact bytes Square sent.
  const payload = await context.request.text();
  const sigHeader = context.request.headers.get("x-square-hmacsha256-signature") || "";
  const valid = await verifySquareSignature(context.request.url, payload, sigHeader, acct.square_webhook_signature_key);
  if (!valid) return new Response(JSON.stringify({ error: "Invalid Square signature" }), { status: 400, headers: { "Content-Type": "application/json" } });

  let event: any;
  try { event = JSON.parse(payload); } catch { return new Response(JSON.stringify({ error: "Malformed JSON body" }), { status: 400, headers: { "Content-Type": "application/json" } }); }

  try {
    if (event.type === "subscription.updated") {
      const sub = event.data?.object?.subscription || {};
      const subId = sub.id;
      if (subId) {
        const cust = await findCustomerBySquareSubscription(oid, subId, serviceRoleKey);
        if (cust) {
          // Square subscription statuses: PENDING, ACTIVE, CANCELED, PAUSED, DEACTIVATED.
          const statusMap: Record<string, string> = { ACTIVE: "active", CANCELED: "canceled", PAUSED: "paused", DEACTIVATED: "canceled", PENDING: "pending" };
          const mapped = statusMap[sub.status] || sub.status?.toLowerCase() || "unknown";
          await patchCustomerRecurringPlan(cust.id, { status: mapped, ...(mapped === "canceled" ? { canceledAt: new Date().toISOString() } : {}) }, serviceRoleKey);
        } else {
          console.warn("[SquareWebhook] subscription.updated for", subId, "— no matching CRM customer found for owner", oid);
        }
      }
    } else if (event.type === "invoice.updated") {
      // Square's Invoices API drives subscription billing; invoice.status
      // is one of DRAFT/UNPAID/SCHEDULED/PARTIALLY_PAID/PAID/PAYMENT_PENDING/
      // FAILED/CANCELED/REFUNDED. subscription_id correlates it back to the
      // subscription (and from there, the CRM customer) the same way as above.
      const invoice = event.data?.object?.invoice || {};
      const subId = invoice.subscription_id;
      if (subId) {
        const cust = await findCustomerBySquareSubscription(oid, subId, serviceRoleKey);
        if (cust) {
          if (invoice.status === "PAID") {
            const amountCents = invoice.payment_requests?.[0]?.computed_amount_money?.amount || invoice.payment_requests?.[0]?.fixed_amount_requested_money?.amount || 0;
            if (amountCents > 0) {
              await patchCustomerRecurringPlan(cust.id, { status: "active", lastPaidAt: new Date().toISOString(), lastAmount: amountCents / 100 }, serviceRoleKey);
              await recordRecurringPayment(cust.id, oid, amountCents, invoice.title || "Recurring service", invoice.id || "", serviceRoleKey);
            }
          } else if (invoice.status === "FAILED" || invoice.status === "PAYMENT_PENDING") {
            await patchCustomerRecurringPlan(cust.id, { status: invoice.status === "FAILED" ? "payment_failed" : "pending", lastFailedAt: invoice.status === "FAILED" ? new Date().toISOString() : undefined }, serviceRoleKey);
          } else if (invoice.status === "CANCELED") {
            await patchCustomerRecurringPlan(cust.id, { status: "canceled", canceledAt: new Date().toISOString() }, serviceRoleKey);
          }
        } else {
          console.warn("[SquareWebhook] invoice.updated for subscription", subId, "— no matching CRM customer found for owner", oid);
        }
      }
    } else {
      return new Response(JSON.stringify({ received: true, ignored: event.type }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[SquareWebhook] handler error:", e?.message);
    return new Response(JSON.stringify({ error: e?.message || "Webhook handler error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
