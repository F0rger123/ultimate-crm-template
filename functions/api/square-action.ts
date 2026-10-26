import { SUPABASE_URL, SUPABASE_ANON_KEY, SQUARE_ENVIRONMENT } from "./_lib/env";
import { notifyOwnerInvoiceEvent } from "./_lib/ownerNotify";
import { redeemPromoForInvoice } from "./_lib/promoRedeem";
import { computeAmountDue, paidPatch } from "./_lib/amountDue";
// FEATURE — Square as an alternative payment provider to Stripe (owner
// request: "Is there a way we can give another option for users to connect
// payments? Something similar to Stripe... free on our end... accepts many
// payment methods... owners can switch between each one easily"). Mirrors
// stripe-action.ts's own shape almost exactly: keys never reach the
// browser, invoice amounts are always resolved server-side from the
// estimate's own stored total (never a client-claimed amount), and
// owner_square_accounts (migration 0064) is a service-role-only table, same
// as owner_stripe_accounts.
//
// Setup: an owner pastes their Square Access Token + Location ID (from
// Square Developer Dashboard → their app → Credentials/Locations) into
// Settings → Integrations → Square. Sandbox tokens for testing, production
// tokens for real charges — the "mode" field decides which Square API host
// this calls.


// Square API host follows the deployment-wide SQUARE_ENVIRONMENT env var
// (sandbox | production, default production) — see _lib/env.ts.
const squareApiBase = () => SQUARE_ENVIRONMENT === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

const getOwnerSquareAccount = async (
  ownerId: string,
  serviceRoleKey: string
): Promise<{ accessToken?: string; locationId?: string; applicationId?: string; mode?: string; webhookSignatureKey?: string } | null> => {
  if (!ownerId || !serviceRoleKey) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/owner_square_accounts?owner_id=eq.${encodeURIComponent(ownerId)}&select=square_access_token,square_location_id,square_application_id,square_mode,square_webhook_signature_key`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  // Trimmed: a pasted value with a stray space (seen live: " LGCC…" as the
  // location id) makes every Square payment fail with "location not found".
  const t = (v: any) => (typeof v === "string" ? v.trim() : "") || undefined;
  return { accessToken: t(row.square_access_token), locationId: t(row.square_location_id), applicationId: t(row.square_application_id), mode: row.square_mode || "sandbox", webhookSignatureKey: t(row.square_webhook_signature_key) };
};

const getEstimateOwnerId = async (invoiceId: string, serviceRoleKey: string): Promise<string | null> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=owner_id`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.owner_id ? rows[0].owner_id : null;
};

// Never trusts a client-claimed amount — same rule as stripe-action.ts's
// getInvoiceAmountCents.
const getInvoiceAmountCents = async (invoiceId: string, serviceRoleKey: string): Promise<number> => {
  if (!serviceRoleKey) throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY env var.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=total`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await res.json().catch(() => []);
  const total = Array.isArray(rows) ? Number(rows[0]?.total) : NaN;
  if (!total || total <= 0) throw new Error("Could not verify invoice amount — invoice not found or has no total.");
  return Math.round(total * 100);
};

const resolveCallerOwnerId = async (accessToken: string): Promise<string | null> => {
  if (!accessToken) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null) as any;
  const uid = user?.id;
  if (!uid) return null;
  const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?user_id=eq.${encodeURIComponent(uid)}&select=owner_id&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const empRows = await empRes.json().catch(() => []);
  return Array.isArray(empRows) && empRows[0]?.owner_id ? empRows[0].owner_id : uid;
};

// SECURITY FIX (audit finding) — mirrors stripe-action.ts's identically-
// named helper; resolveCallerOwnerId alone only proves "same tenant,"
// which isn't enough for key/refund/subscription-cancel actions.
const resolveCallerIsOwnerOrManager = async (accessToken: string): Promise<{ ownerId: string; role: string } | null> => {
  if (!accessToken) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null) as any;
  const uid = user?.id;
  if (!uid) return null;
  const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?user_id=eq.${encodeURIComponent(uid)}&select=owner_id,role&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const empRows = await empRes.json().catch(() => []);
  const row = Array.isArray(empRows) ? empRows[0] : null;
  if (!row) return { ownerId: uid, role: "owner" };
  const role = (row.role || "").toLowerCase();
  if (role !== "owner" && role !== "manager") return null;
  return { ownerId: row.owner_id || uid, role };
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }, 500);
  }
  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;

    if (action === "save_owner_square_keys" || action === "get_owner_square_status") {
      const accessTokenHdr = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      // SECURITY FIX (audit finding) — save_owner_square_keys lets a caller
      // overwrite the business's live Square access token/webhook key; was
      // gated only by "same tenant." Now requires owner/manager. Status
      // lookup (read-only, no secrets returned) stays open to any member.
      const callerOwnerId = action === "save_owner_square_keys"
        ? (await resolveCallerIsOwnerOrManager(accessTokenHdr))?.ownerId || null
        : await resolveCallerOwnerId(accessTokenHdr);
      if (!callerOwnerId) return json({ error: action === "save_owner_square_keys" ? "Only the business owner or a manager can change payment keys." : "Not signed in." }, action === "save_owner_square_keys" ? 403 : 401);

      if (action === "get_owner_square_status") {
        const acct = await getOwnerSquareAccount(callerOwnerId, serviceRoleKey);
        return json({
          connected: !!(acct?.accessToken && acct?.locationId),
          hasAccessToken: !!acct?.accessToken,
          locationId: acct?.locationId || "",
          applicationId: acct?.applicationId || "",
          mode: SQUARE_ENVIRONMENT,
          hasWebhookSignatureKey: !!acct?.webhookSignatureKey,
          webhookUrl: `${new URL(context.request.url).origin}/api/square-webhook?oid=${encodeURIComponent(callerOwnerId)}`,
        });
      }

      const trimmed = (v: any) => (typeof v === "string" ? v.trim() : v);
      const squareAccessToken = trimmed(body.squareAccessToken), squareLocationId = trimmed(body.squareLocationId), squareApplicationId = trimmed(body.squareApplicationId), squareWebhookSignatureKey = trimmed(body.squareWebhookSignatureKey);
      const patch: Record<string, any> = { owner_id: callerOwnerId, updated_at: new Date().toISOString(), square_mode: SQUARE_ENVIRONMENT };
      if (squareAccessToken !== undefined && squareAccessToken !== "") patch.square_access_token = squareAccessToken; // blank = leave existing token untouched
      if (squareLocationId !== undefined) patch.square_location_id = squareLocationId || null;
      if (squareApplicationId !== undefined) patch.square_application_id = squareApplicationId || null;
      // AUDIT FIX — lets an owner actually save the Signature Key Square
      // hands out when they create a webhook subscription, so
      // square-webhook.ts (subscription lifecycle sync — was entirely
      // missing before this) has something to verify incoming events with.
      if (squareWebhookSignatureKey !== undefined && squareWebhookSignatureKey !== "") patch.square_webhook_signature_key = squareWebhookSignatureKey;
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/owner_square_accounts`, {
        method: "POST",
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!saveRes.ok) {
        const errText = await saveRes.text().catch(() => "");
        return json({ error: "Failed to save Square keys: " + errText }, 500);
      }
      return json({ success: true });
    }

    // Public status — customer-facing pages need to know the applicationId
    // + locationId (both safe to expose, same as Stripe's publishable key)
    // to initialize Square's Web Payments SDK, without any auth.
    if (action === "get_public_square_config") {
      const { ownerId } = body;
      if (!ownerId) return json({ error: "Missing ownerId" }, 400);
      const acct = await getOwnerSquareAccount(ownerId, serviceRoleKey);
      if (!acct?.applicationId || !acct?.locationId) return json({ connected: false });
      return json({ connected: true, applicationId: acct.applicationId, locationId: acct.locationId, mode: SQUARE_ENVIRONMENT });
    }

    // create_payment — sourceId is a one-time card nonce from Square's Web
    // Payments SDK (tokenized client-side, never a raw card number reaching
    // this server or Supabase). Amount is ALWAYS resolved from the
    // invoice's own stored total when invoiceId is given — never trusts a
    // client-claimed amountCents, same rule as stripe-action.ts.
    if (action === "create_payment") {
      const { sourceId, invoiceId, tipCents } = body;
      if (!sourceId) return json({ error: "Missing sourceId (card token)" }, 400);
      let ownerId: string | null = null;
      if (invoiceId) ownerId = await getEstimateOwnerId(invoiceId, serviceRoleKey);
      if (!ownerId) {
        const accessTokenHdr = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (accessTokenHdr) ownerId = await resolveCallerOwnerId(accessTokenHdr);
      }
      // SECURITY FIX (audit finding) — this used to fall back to a client-
      // claimed body.ownerId with zero verification whenever there was no
      // invoiceId and no session — an unauthenticated caller could pass an
      // arbitrary ownerId + a card token/amountCents and push a REAL charge
      // (unlike Stripe's create_payment_intent, this actually moves money
      // immediately, no separate confirm step) against any business's Square
      // account. There is no legitimate caller of this action that has
      // neither an invoiceId nor a real session — removed entirely rather
      // than narrowed, matching stripe-action.ts's equivalent fix.
      if (!ownerId) return json({ error: "Could not resolve which business to charge — sign in and try again, or use a payment link with an invoice." }, 401);
      const acct = await getOwnerSquareAccount(ownerId, serviceRoleKey);
      if (!acct?.accessToken || !acct?.locationId) {
        return json({ error: "Square isn't configured for this business yet — add keys in Settings → Integrations → Square." }, 500);
      }
      const tip = Math.max(0, Math.round(Number(tipCents) || 0));
      // Server-side amount for the option the customer picked — see _lib/amountDue.ts.
      let due: Awaited<ReturnType<typeof computeAmountDue>> | null = null;
      if (invoiceId) {
        try { due = await computeAmountDue({ invoiceId, serviceRoleKey, payType: body.payType, promoId: body.promoId, referrerId: body.referrerId }); }
        catch (e: any) { return json({ error: e?.message || "Could not verify the amount due" }, 400); }
      }
      const amountCents = (due ? due.baseCents : Math.round(Number(body.amountCents) || 0)) + tip;
      if (amountCents <= 0) return json({ error: "Invalid amount" }, 400);

      const sqRes = await fetch(`${squareApiBase()}/v2/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${acct.accessToken}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-10-17",
        },
        body: JSON.stringify({
          source_id: sourceId,
          // SECURITY FIX (audit finding) — a fresh random idempotency_key
          // on every call means a browser retry after a dropped/timed-out
          // response (which already reached Square and succeeded) creates
          // a genuine SECOND charge. For an invoice payment, the operation
          // is fully determined by the invoice — reusing the same key for
          // the same invoiceId is safe and correct (Square returns the
          // cached first result instead of charging twice); ad-hoc charges
          // (field-portal tips/fees, no invoiceId) have no stable id to key
          // on, so they keep a random key — narrower risk (typically small
          // amounts, no auto-retry in the client today).
          idempotency_key: due ? `${invoiceId}-${due.payType[0]}${amountCents}`.slice(0, 45) : crypto.randomUUID(),
          amount_money: { amount: amountCents, currency: "USD" },
          location_id: acct.locationId,
          // {promo:ID} before the [payType:cents] tag, which must stay last.
          note: ((body.description || "").slice(0, 400) + (due?.promoId ? ` {promo:${due.promoId}}` : "") + (due ? ` [${due.payType}:${due.baseCents}]` : "")).trim(),
          ...(invoiceId ? { reference_id: invoiceId } : {}),
        }),
      });
      const sqData = await sqRes.json().catch(() => ({} as any));
      if (!sqRes.ok) {
        const msg = sqData?.errors?.[0]?.detail || `Square error ${sqRes.status}`;
        return json({ error: msg }, sqRes.status);
      }
      return json({ id: sqData?.payment?.id || "", status: sqData?.payment?.status || "COMPLETED" });
    }

    // refund_payment — OWNER-ONLY (InvoicesPage.tsx), mirrors stripe-action.ts's
    // "refund" case: real full or partial refund via Square's own Refunds
    // API. Resolves which business's Square account to refund through the
    // same caller-auth-token / invoiceId / client-ownerId fallback chain
    // used everywhere else in this file — never a client-claimed secret.
    if (action === "refund_payment") {
      let refundOwnerId = "";
      // SECURITY FIX (audit finding) — the "OWNER-ONLY" comment above was a
      // UI convention, not server-enforced; any authenticated employee
      // session could call this. Now actually requires owner/manager.
      {
        const accessTokenGuard = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        const guard = await resolveCallerIsOwnerOrManager(accessTokenGuard);
        if (!guard) return json({ error: "Only the business owner or a manager can issue refunds." }, 403);
        refundOwnerId = guard.ownerId;
      }
      const { paymentId, amountCents } = body;
      if (!paymentId) return json({ error: "Missing paymentId" }, 400);
      // SECURITY FIX — the Square account used to come from body.invoiceId
      // first, and any signed-in account (even a customer's) passed the check
      // above, so a customer could refund their own payment by sending their
      // invoice id. Refunds now always run on the caller's OWN business's
      // Square account, which only holds that business's payments.
      const ownerId = refundOwnerId;
      const acct = await getOwnerSquareAccount(ownerId, serviceRoleKey);
      if (!acct?.accessToken) return json({ error: "Square isn't configured for this business." }, 500);

      let refundAmountCents = Math.round(Number(amountCents) || 0);
      if (!refundAmountCents) {
        // Full refund — look up the original payment's own amount rather
        // than trusting a client-claimed total, same "never trust the
        // client for money" rule as everywhere else in this app.
        const payRes = await fetch(`${squareApiBase()}/v2/payments/${encodeURIComponent(paymentId)}`, {
          headers: { Authorization: `Bearer ${acct.accessToken}`, "Square-Version": "2024-10-17" },
        });
        const payData = await payRes.json().catch(() => ({} as any));
        refundAmountCents = payData?.payment?.amount_money?.amount || 0;
      }
      if (refundAmountCents <= 0) return json({ error: "Invalid refund amount" }, 400);

      const refundRes = await fetch(`${squareApiBase()}/v2/refunds`, {
        method: "POST",
        headers: { Authorization: `Bearer ${acct.accessToken}`, "Content-Type": "application/json", "Square-Version": "2024-10-17" },
        body: JSON.stringify({
          // SECURITY FIX (audit finding) — same reasoning as create_payment
          // above; a refund is fully determined by (paymentId, amount), so
          // this key is safe to reuse on retry instead of risking a double
          // refund.
          idempotency_key: `refund-${paymentId}-${refundAmountCents}`,
          amount_money: { amount: refundAmountCents, currency: "USD" },
          payment_id: paymentId,
        }),
      });
      const refundData = await refundRes.json().catch(() => ({} as any));
      if (!refundRes.ok) {
        const msg = refundData?.errors?.[0]?.detail || `Square error ${refundRes.status}`;
        return json({ error: msg }, refundRes.status);
      }
      return json({ success: true, id: refundData?.refund?.id || "", amount: refundAmountCents, status: refundData?.refund?.status || "PENDING" });
    }

    // FEATURE — real recurring billing via Square's own Subscriptions API.
    // Unlike Stripe (which has a hosted Checkout link a customer can open on
    // their own phone), Square's subscriptions require a Customer + a saved
    // Card object created server-side from a tokenized `sourceId` — so this
    // action is meant to be called right after the OWNER taps/swipes the
    // customer's card in person through SquareRecurringSetupModal.tsx
    // (mirrors SquarePaymentModal.tsx's existing one-time-payment tokenize
    // flow), same "card details never touch our servers, only a one-time
    // token does" model as create_payment above.
    if (action === "create_square_recurring_plan") {
      const { sourceId, crmCustomerId, amountCents, cadence, description, customerEmail, customerName } = body;
      if (!sourceId) return json({ error: "Missing sourceId (card token)" }, 400);
      if (!crmCustomerId) return json({ error: "Missing crmCustomerId" }, 400);
      const amt = Math.round(Number(amountCents) || 0);
      if (amt <= 0) return json({ error: "Invalid amount" }, 400);
      const validCadences = ["WEEKLY", "MONTHLY", "ANNUAL"];
      const planCadence = validCadences.includes(cadence) ? cadence : "MONTHLY";

      // SECURITY FIX (audit finding) — setting up recurring billing is an
      // owner/manager-level configuration action (only ever called from
      // CustomerDetail.tsx, an owner-CRM page); was gated only by "same
      // tenant," letting any employee session create one.
      const accessTokenHdr = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const callerGuard = await resolveCallerIsOwnerOrManager(accessTokenHdr);
      if (!callerGuard) return json({ error: "Only the business owner or a manager can set up recurring billing." }, 403);
      const callerOwnerId = callerGuard.ownerId;
      const acct = await getOwnerSquareAccount(callerOwnerId, serviceRoleKey);
      if (!acct?.accessToken || !acct?.locationId) {
        return json({ error: "Square isn't configured for this business yet — add keys in Settings → Integrations → Square." }, 500);
      }
      const sqHeaders = { Authorization: `Bearer ${acct.accessToken}`, "Content-Type": "application/json", "Square-Version": "2024-10-17" };

      try {
        // 1. Create (or reuse) a Square Customer for this CRM customer.
        const custRes = await fetch(`${squareApiBase()}/v2/customers`, {
          method: "POST", headers: sqHeaders,
          body: JSON.stringify({ idempotency_key: crypto.randomUUID(), given_name: customerName || undefined, email_address: customerEmail || undefined, reference_id: crmCustomerId }),
        });
        const custData = await custRes.json().catch(() => ({} as any));
        if (!custRes.ok) throw new Error(custData?.errors?.[0]?.detail || `Square error creating customer (${custRes.status})`);
        const squareCustomerId = custData?.customer?.id;

        // 2. Attach the tokenized card to that customer.
        const cardRes = await fetch(`${squareApiBase()}/v2/cards`, {
          method: "POST", headers: sqHeaders,
          body: JSON.stringify({ idempotency_key: crypto.randomUUID(), source_id: sourceId, card: { customer_id: squareCustomerId } }),
        });
        const cardData = await cardRes.json().catch(() => ({} as any));
        if (!cardRes.ok) throw new Error(cardData?.errors?.[0]?.detail || `Square error saving card (${cardRes.status})`);
        const squareCardId = cardData?.card?.id;

        // 3. Create a Catalog subscription plan + variation for this exact
        // price/cadence — Square has no inline "price_data" equivalent, a
        // real Catalog object is required for every subscription.
        const catalogRes = await fetch(`${squareApiBase()}/v2/catalog/object`, {
          method: "POST", headers: sqHeaders,
          body: JSON.stringify({
            idempotency_key: crypto.randomUUID(),
            object: {
              type: "SUBSCRIPTION_PLAN", id: "#plan",
              subscription_plan_data: {
                name: description || "Recurring service",
                subscription_plan_variations: [{
                  type: "SUBSCRIPTION_PLAN_VARIATION", id: "#variation",
                  subscription_plan_variation_data: {
                    name: description || "Recurring service",
                    phases: [{ cadence: planCadence, recurring_price_money: { amount: amt, currency: "USD" }, ordinal: 0 }],
                  },
                }],
              },
            },
          }),
        });
        const catalogData = await catalogRes.json().catch(() => ({} as any));
        if (!catalogRes.ok) throw new Error(catalogData?.errors?.[0]?.detail || `Square error creating subscription plan (${catalogRes.status})`);
        const variation = (catalogData?.related_objects || []).find((o: any) => o.type === "SUBSCRIPTION_PLAN_VARIATION") || catalogData?.catalog_object?.subscription_plan_data?.subscription_plan_variations?.[0];
        const planId = catalogData?.catalog_object?.id;
        const variationId = variation?.id;
        if (!variationId) throw new Error("Square didn't return a subscription plan variation id");

        // 4. Start the subscription — billing begins on the cadence above.
        const subRes = await fetch(`${squareApiBase()}/v2/subscriptions`, {
          method: "POST", headers: sqHeaders,
          body: JSON.stringify({ idempotency_key: crypto.randomUUID(), location_id: acct.locationId, plan_variation_id: variationId, customer_id: squareCustomerId, card_id: squareCardId }),
        });
        const subData = await subRes.json().catch(() => ({} as any));
        if (!subRes.ok) throw new Error(subData?.errors?.[0]?.detail || `Square error creating subscription (${subRes.status})`);

        // Save recurringPlan on the CRM customer row here (rather than
        // relying on a webhook, since Square's Subscriptions API doesn't
        // hand back an easy per-CRM-customer webhook correlation the way
        // Stripe's subscription_data.metadata does) — status starts
        // "active" since the card + subscription were both just created
        // successfully; a failed FUTURE renewal is caught by
        // square-webhook-driven status updates being out of scope for now,
        // so the owner should spot-check Square's own dashboard for
        // ongoing renewal health.
        const patch = {
          provider: "square", status: "active", amountCents: amt, interval: planCadence.toLowerCase() === "annual" ? "year" : planCadence.toLowerCase() === "weekly" ? "week" : "month",
          description: description || "Recurring service", squareSubscriptionId: subData?.subscription?.id, squareCustomerId, squareCardId, squarePlanId: planId, squareVariationId: variationId,
        };
        await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(crmCustomerId)}`, {
          method: "PATCH", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ recurringPlan: patch }),
        });

        return json({ success: true, subscriptionId: subData?.subscription?.id, status: subData?.subscription?.status || "ACTIVE" });
      } catch (e: any) {
        return json({ error: e?.message || "Failed to set up Square recurring plan" }, 500);
      }
    }

    // AUDIT FIX — same problem stripe-action.ts's confirm_invoice_payment
    // solves: ClientAuthPortal.tsx/ClientPortal.tsx can't write `estimates`
    // directly from a CUSTOMER session (owner_id-scoped RLS always matches
    // 0 rows for a non-owner caller — see docs/ARCHITECTURE.md). Verifies the payment
    // really completed via Square's own API first, then writes with the
    // service role and actually checks the result.
    if (action === "confirm_invoice_payment") {
      const { invoiceId, paymentId } = body;
      if (!invoiceId || !paymentId) return json({ error: "Missing invoiceId or paymentId" }, 400);
      const ownerId = await getEstimateOwnerId(invoiceId, serviceRoleKey);
      if (!ownerId) return json({ error: "Invoice not found" }, 404);
      const acct = await getOwnerSquareAccount(ownerId, serviceRoleKey);
      if (!acct?.accessToken) return json({ error: "Square isn't configured for this business." }, 500);
      const payRes = await fetch(`${squareApiBase()}/v2/payments/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Bearer ${acct.accessToken}`, "Square-Version": "2024-10-17" },
      });
      const payData = await payRes.json().catch(() => ({} as any));
      if (!payRes.ok || payData?.payment?.status !== "COMPLETED") {
        return json({ error: `Payment status is "${payData?.payment?.status || "unknown"}", not COMPLETED — invoice not marked paid.` }, 400);
      }
      // SECURITY FIX (audit finding — CRITICAL) — this checked the payment
      // was COMPLETED but never that it was actually made FOR this invoice.
      // create_payment sets reference_id: invoiceId at creation — a caller
      // could pay a small/unrelated invoice once to get one real COMPLETED
      // paymentId, then call this with THAT id and a different invoiceId
      // under the same owner to mark it paid without paying for it. Same
      // exploit and same fix as stripe-action.ts's confirm_invoice_payment.
      const noteTag = String(payData?.payment?.note || "").match(/\[(full|deposit|remaining):(\d+)\]$/);
      const paidPayType = noteTag ? noteTag[1] : "full";
      const expectedAmountCents = noteTag ? Number(noteTag[2]) : await getInvoiceAmountCents(invoiceId, serviceRoleKey).catch(() => 0);
      const paidAmountCents = Number(payData?.payment?.amount_money?.amount) || 0;
      if (payData?.payment?.reference_id !== invoiceId || !expectedAmountCents || paidAmountCents < expectedAmountCents) {
        return json({ error: "This payment doesn't match the invoice being confirmed — nothing was marked paid." }, 400);
      }
      const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=paymentLog,paidDeposit`, { headers: authHeaders });
      const rows = await getRes.json().catch(() => []);
      const existingLog = Array.isArray(rows) && Array.isArray(rows[0]?.paymentLog) ? rows[0].paymentLog : [];
      const alreadyLogged = existingLog.some((e: any) => e?.type === "paid" && e?.squarePaymentId === paymentId);
      const newLog = alreadyLogged ? existingLog : [...existingLog, { id: crypto.randomUUID(), at: new Date().toISOString(), type: "paid", amount: (payData.payment.amount_money?.amount || 0) / 100, squarePaymentId: paymentId, note: "Paid via Square (customer portal)" }];
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=id`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ ...paidPatch(rows[0], paidPayType, Math.min(paidAmountCents, expectedAmountCents) / 100), squarePaymentId: paymentId, stripePaymentStatus: "paid", paymentLog: newLog }),
      });
      const updated = await patchRes.json().catch(() => []);
      if (!patchRes.ok || !Array.isArray(updated) || updated.length === 0) {
        return json({ error: "Payment succeeded with Square, but the invoice record couldn't be updated (0 rows matched) — contact the business directly to confirm your invoice shows paid." }, 500);
      }
      if (!alreadyLogged) await notifyOwnerInvoiceEvent(context.env, new URL(context.request.url).origin, invoiceId, "paid", Math.min(paidAmountCents, expectedAmountCents) / 100).catch(() => {});
      const promoTag = String(payData?.payment?.note || "").match(/\{promo:([A-Za-z0-9-]+)\}/);
      if (promoTag) await redeemPromoForInvoice(serviceRoleKey, promoTag[1], invoiceId);
      return json({ success: true });
    }

    // cancel_square_recurring_plan — owner/manager-only. SECURITY FIX
    // (audit finding) — comment said "owner-only" but was only ever gated
    // by "same tenant"; any employee session could cancel a customer's
    // recurring plan.
    if (action === "cancel_square_recurring_plan") {
      const { subscriptionId } = body;
      if (!subscriptionId) return json({ error: "Missing subscriptionId" }, 400);
      const accessTokenHdr = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const callerOwnerId = (await resolveCallerIsOwnerOrManager(accessTokenHdr))?.ownerId || null;
      if (!callerOwnerId) return json({ error: "Only the business owner or a manager can cancel a recurring plan." }, 403);
      const acct = await getOwnerSquareAccount(callerOwnerId, serviceRoleKey);
      if (!acct?.accessToken) return json({ error: "Square isn't configured for this business." }, 500);
      const cancelRes = await fetch(`${squareApiBase()}/v2/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
        method: "POST", headers: { Authorization: `Bearer ${acct.accessToken}`, "Square-Version": "2024-10-17" },
      });
      const cancelData = await cancelRes.json().catch(() => ({} as any));
      if (!cancelRes.ok) return json({ error: cancelData?.errors?.[0]?.detail || `Square error ${cancelRes.status}` }, cancelRes.status);
      return json({ success: true, status: cancelData?.subscription?.status || "CANCELED" });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Square proxy error" }, 500);
  }
};
