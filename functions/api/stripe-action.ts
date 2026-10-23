// SECURITY AUDIT (round 12) — CRITICAL FIX. lib/stripe.ts used to call
// api.stripe.com DIRECTLY FROM THE BROWSER using the Stripe SECRET key,
// which lived in `settings.stripeSecretKeyEnc` — a value loaded into
// EVERY session's `settings` object, including ClientPortal.tsx and
// ClientAuthPortal.tsx, the UNAUTHENTICATED/customer-facing pages a real
// customer opens to pay their invoice. "Encrypted" there meant XOR'd with a
// hardcoded salt (lib/crypto.ts's obfuscate/deobfuscate, which ships in the
// same JS bundle) — trivially reversible by anyone who opens devtools on an
// invoice/payment link. That handed the FULL Stripe secret key — full
// account access: create arbitrary charges, issue refunds, read every
// saved customer's payment methods and PII — to every single customer who
// ever viewed a payment page. This endpoint is the fix: the secret key now
// lives ONLY in this Cloudflare Pages Function's environment variable
// (STRIPE_SECRET_KEY, set in the Cloudflare dashboard — same pattern as
// TWILIO_AUTH_TOKEN), and the browser (owner OR customer) only ever calls
// this same-origin endpoint with an action name + non-sensitive params.
// The secret key never reaches client code again.
//
// Setup: Cloudflare Pages → this project → Settings → Environment variables
// → add STRIPE_SECRET_KEY (sk_live_... or sk_test_...). Settings →
// Integrations → Stripe now only needs the PUBLISHABLE key (safe to expose
// client-side by design — that's what it's for).
//
// SECOND FIX bundled in here: create_payment_intent/create_checkout_session
// used to trust whatever `amountCents` the CALLER claimed. A tampered
// client could request a PaymentIntent for $0.01 against a $500 invoice.
// When `invoiceId` is provided, this function now looks up that invoice's
// real `total` in Supabase itself and charges THAT — the client's claimed
// amount is ignored whenever an invoiceId is present.

import { getOwnerSecrets } from "./_lib/ownerSecrets";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./_lib/env";
import { computeAmountDue, paidPatch } from "./_lib/amountDue";


// MULTI-TENANT (Phase F) — each business can now store its own Stripe keys
// in owner_stripe_accounts (service-role-only table, see migration
// 0033_multitenant_owner_scoping.sql). This resolves which secret key to
// charge with:
//   1. If an invoiceId is given, the invoice's OWN owner_id (read from the
//      estimates row itself, never trusted from the client) wins — this is
//      the same "never trust client-claimed amounts/identity" pattern this
//      file already uses for amountCents.
//   2. Otherwise fall back to a client-supplied ownerId (only meaningful for
//      actions that don't reference an invoice, e.g. create_customer for a
//      saved card — still safe, since it only affects which business's
//      Stripe account the resulting object lives in, not who gets charged).
//   3. If no owner-specific key is on file, fall back to the platform-wide
//      STRIPE_SECRET_KEY env var, so deployments that haven't set up
//      per-owner keys yet keep working unmodified.
// STRIPE CONNECT — an owner who completed the OAuth "Connect with Stripe"
// flow (functions/api/stripe-connect-oauth.ts) has a `stripe_account_id`
// (acct_...) instead of their own raw secret key. Connect-mode calls use
// THIS PLATFORM's own secret key (STRIPE_SECRET_KEY) plus a
// `Stripe-Account: acct_...` header, which is Stripe's documented way for a
// platform to act on a connected account's behalf — the connected account
// never hands over a raw secret key at all. Legacy manual-key owners (who
// pasted their own sk_.../whsec_... in Settings before Connect existed)
// keep working exactly as before — stripe_account_id is simply null for
// them, and the resolver below falls through to their own secretKey.
const getOwnerStripeAccount = async (
  ownerId: string,
  serviceRoleKey: string
): Promise<{ secretKey?: string; publishableKey?: string; webhookSecret?: string; mode?: string; stripeAccountId?: string } | null> => {
  if (!ownerId || !serviceRoleKey) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/owner_stripe_accounts?owner_id=eq.${encodeURIComponent(ownerId)}&select=stripe_secret_key,stripe_publishable_key,stripe_webhook_secret,stripe_mode,stripe_account_id`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  const t = (v: any) => (typeof v === "string" ? v.trim() : "") || undefined; // a pasted key with a stray space fails as "invalid API key"
  return { secretKey: t(row.stripe_secret_key), publishableKey: t(row.stripe_publishable_key), webhookSecret: t(row.stripe_webhook_secret), mode: row.stripe_mode, stripeAccountId: t(row.stripe_account_id) };
};

// BUG FIX — same RLS-vs-anon-key mismatch as getInvoiceAmountCents below:
// an anonymous customer paying their invoice link has no session, so the
// anon-key read here returned zero rows under the real owner_id-scoped RLS
// policy and this whole resolution chain (which Stripe account to charge
// against) silently failed. serviceRoleKey bypasses RLS for this one
// specific, unguessable-id-bounded lookup, same trust model public-data.ts
// already uses throughout for anonymous customer reads.
const getEstimateOwnerId = async (invoiceId: string, serviceRoleKey: string): Promise<string | null> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=owner_id`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.owner_id ? rows[0].owner_id : null;
};

// Resolves the authenticated caller's own owner_id from a Supabase access
// token, via the SAME current_owner_id() logic the DB uses (looked up here
// through the employees table with the anon key + the caller's own JWT, so
// RLS on `employees` itself enforces "you can only ever resolve to your own
// tenant" — this function cannot be tricked into returning someone else's
// owner_id no matter what the client claims).
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

// SECURITY FIX (audit finding) — resolveCallerOwnerId alone only proves
// "this caller belongs to this tenant," which was being used to gate
// account-management actions that any regular employee session should NOT
// be able to do server-side (an attacker with a compromised/malicious
// technician login could otherwise overwrite the business's live Stripe
// keys, issue refunds, cancel recurring plans, or enumerate/delete stored
// customer payment methods). Mirrors _lib/ownerSecrets.ts's
// resolveCallerIsOwnerOrManager — duplicated per this file's existing
// convention of not sharing helpers across function files.
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

// The business a signed-in STAFF member (owner or crew) belongs to, or null.
// Unlike resolveCallerOwnerId, a customer-portal account (no employees row
// and no business of its own) is not staff and gets null.
const resolveStaffOwnerId = async (accessToken: string, serviceRoleKey: string): Promise<string | null> => {
  if (!accessToken || !serviceRoleKey) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
  const user = userRes.ok ? await userRes.json().catch(() => null) as any : null;
  if (!user?.id) return null;
  const sr = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const emp = await (await fetch(`${SUPABASE_URL}/rest/v1/employees?user_id=eq.${encodeURIComponent(user.id)}&select=owner_id&limit=1`, { headers: sr })).json().catch(() => []);
  if (Array.isArray(emp) && emp[0]?.owner_id) return emp[0].owner_id;
  const own = await (await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(user.id)}&select=owner_id&limit=1`, { headers: sr })).json().catch(() => []);
  return Array.isArray(own) && own.length ? user.id : null;
};

// Which Stripe key/account a business charges through.
const stripeCredsFor = async (ownerId: string, serviceRoleKey: string, platformSecretKey?: string) => {
  const acct = await getOwnerStripeAccount(ownerId, serviceRoleKey);
  return acct?.stripeAccountId ? { secretKey: platformSecretKey, stripeAccount: acct.stripeAccountId } : { secretKey: acct?.secretKey || platformSecretKey, stripeAccount: undefined as string | undefined };
};

const stripeFetch = async (secretKey: string, method: string, path: string, params?: Record<string, string>, stripeAccount?: string, idempotencyKey?: string) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(secretKey + ":")}`,
      ...(stripeAccount ? { "Stripe-Account": stripeAccount } : {}),
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      // SECURITY FIX (audit finding) — no Stripe Idempotency-Key was ever
      // sent, so a retried request (network blip, a double-tap before a
      // button disables) against a real money-moving call
      // (charge_saved_payment_method, refund) creates a second real
      // PaymentIntent/refund instead of Stripe returning the cached first
      // result. Only passed by callers who derive a stable key from the
      // operation's own identity (see charge_saved_payment_method/refund
      // below) — omitted elsewhere, unchanged behavior for everything else.
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" && params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = (data as any)?.error?.message || `Stripe error ${res.status}`;
    throw new Error(msg);
  }
  return data;
};

// Looks up the real invoice total (in the estimates table — invoices ARE
// estimate rows with invoiced:true, see docs/ARCHITECTURE.md) so a caller can never pay
// less than what's actually owed by lying about the amount.
//
// BUG FIX — "Stripe is having problems." This read used the ANON key, which
// used to work back when estimates had a permissive USING(true) RLS policy
// — but that's since been replaced with a real owner_id-scoped policy
// (owner_id = current_owner_id()), and an anonymous customer paying their
// invoice link has no session for current_owner_id() to resolve at all. The
// anon-key read below has therefore been silently returning ZERO rows for
// every invoiceId-based payment, which this function then reports as
// "invoice not found" — every real customer payment that went through
// invoiceId (as opposed to a raw client-supplied amount) has been failing
// outright. serviceRoleKey bypasses RLS the same way every other anonymous-
// customer read in this app already does (see public-data.ts) — safe here
// because invoiceId is only ever used to look up ONE specific amount, never
// returned to the caller or used to enumerate other rows.
// SECURITY FIX (audit finding) — list_payment_methods/detach_payment_method/
// charge_saved_payment_method only ever checked "is the caller an owner/
// manager of SOME tenant," never that the target Stripe customer actually
// belongs to THAT tenant. Stripe customer/payment-method ids are global
// across every business still sharing the platform-wide STRIPE_SECRET_KEY
// (i.e. hasn't configured their own keys/Connect account) — without this
// check, any owner/manager could pass another business's real cus_.../pm_...
// id and list, detach, or charge that customer's saved card. Mirrors the
// verification detach_my_payment_method already does for the customer-facing
// path, applied to the staff-facing one.
const verifyStripeCustomerOwnedBy = async (stripeCustomerId: string, ownerId: string, serviceRoleKey: string): Promise<boolean> => {
  if (!stripeCustomerId || !ownerId || !serviceRoleKey) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?stripeCustomerId=eq.${encodeURIComponent(stripeCustomerId)}&owner_id=eq.${encodeURIComponent(ownerId)}&select=id&limit=1`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
};

const getInvoiceAmountCents = async (invoiceId: string, serviceRoleKey: string): Promise<number> => {
  if (!serviceRoleKey) throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=total`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await res.json().catch(() => []);
  const total = Array.isArray(rows) ? Number(rows[0]?.total) : NaN;
  if (!total || total <= 0) throw new Error("Could not verify invoice amount — invoice not found or has no total.");
  return Math.round(total * 100);
};

// SAVE-CARD SUPPORT — "save this card" during a real invoice payment needs
// the PaymentIntent to carry a real Stripe `customer` + setup_future_usage
// at CREATION time (Stripe attaches the payment method to that customer
// automatically on successful confirmation; it can't be bolted on
// afterward). The customer identity is derived from the invoice itself —
// never a client-claimed customerId — same "never trust the caller" rule
// getInvoiceAmountCents already follows for amount.
const resolveInvoiceCustomerForSave = async (
  invoiceId: string,
  serviceRoleKey: string
): Promise<{ crmCustomerId: string; stripeCustomerId?: string; email?: string; name?: string } | null> => {
  // BUG FIX — same RLS-vs-anon-key mismatch as getInvoiceAmountCents above.
  const estRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(invoiceId)}&select=customerId`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const estRows = await estRes.json().catch(() => []);
  const crmCustomerId = Array.isArray(estRows) ? estRows[0]?.customerId : null;
  if (!crmCustomerId || !serviceRoleKey) return null;
  const custRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(crmCustomerId)}&select=email,firstName,lastName,stripeCustomerId`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const custRows = await custRes.json().catch(() => []);
  const cust = Array.isArray(custRows) ? custRows[0] : null;
  if (!cust) return null;
  return { crmCustomerId, stripeCustomerId: cust.stripeCustomerId || undefined, email: cust.email || undefined, name: [cust.firstName, cust.lastName].filter(Boolean).join(" ") || undefined };
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const platformSecretKey = context.env.STRIPE_SECRET_KEY;
  // BUG FIX — a Connect-mode owner (no manual keys of their own) had NO
  // publishable key returned to them at all: get_owner_keys_status only
  // ever read owner_stripe_accounts.stripe_publishable_key, which is only
  // populated by the manual "Advanced: use your own API keys" path, never
  // by the Connect OAuth flow. That silently broke every customer-facing
  // payment for a Connect owner (StripePaymentModal/SaveCardModal never
  // even got a key to call loadStripeJs with) — the "easier" path was
  // actually the one that didn't work. A PLATFORM publishable key (safe to
  // expose — that's what publishable keys are for) is the correct
  // client-side key for a Direct charge against a connected account, paired
  // with that account's id via Stripe.js's `stripeAccount` option.
  const platformPublishableKey = context.env.STRIPE_PUBLISHABLE_KEY;
  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;

    // save_owner_keys / get_owner_keys_status manage owner_stripe_accounts
    // directly and never touch api.stripe.com — handled before the
    // platform-key check below, since a business using ONLY their own keys
    // shouldn't need a platform STRIPE_SECRET_KEY configured at all.
    if (action === "save_owner_keys" || action === "get_owner_keys_status") {
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) {
        return new Response(JSON.stringify({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      // SECURITY FIX (audit finding) — save_owner_keys lets a caller
      // overwrite the business's live Stripe secret key/webhook secret,
      // silently redirecting every future customer charge to an attacker-
      // controlled account. resolveCallerOwnerId alone only proved "same
      // tenant" — any regular employee session could call this. Now
      // requires owner/manager. get_owner_keys_status (read-only status,
      // no secrets returned) stays available to any tenant member.
      const caller = action === "save_owner_keys" ? await resolveCallerIsOwnerOrManager(accessToken) : null;
      const callerOwnerId = action === "save_owner_keys" ? caller?.ownerId : await resolveCallerOwnerId(accessToken);
      if (!callerOwnerId) {
        return new Response(JSON.stringify({ error: action === "save_owner_keys" ? "Only the business owner or a manager can change payment keys." : "Not signed in." }), { status: action === "save_owner_keys" ? 403 : 401, headers: { "Content-Type": "application/json" } });
      }

      if (action === "get_owner_keys_status") {
        const acct = await getOwnerStripeAccount(callerOwnerId, serviceRoleKey);
        return json({
          connected: !!acct?.stripeAccountId,
          stripeAccountId: acct?.stripeAccountId ? acct.stripeAccountId.replace(/^(acct_.{4}).*/, "$1…") : "",
          stripeAccountIdFull: acct?.stripeAccountId || "",
          hasSecretKey: !!acct?.secretKey,
          hasWebhookSecret: !!acct?.webhookSecret,
          // Connect owner with no manual publishable key of their own falls
          // back to the platform's — see the comment on platformPublishableKey
          // above for why this is the correct key for this case, not a bug.
          publishableKey: acct?.publishableKey || (acct?.stripeAccountId ? (platformPublishableKey || "") : ""),
          mode: acct?.mode || "test",
          webhookUrl: `${new URL(context.request.url).origin}/api/stripe-webhook?oid=${encodeURIComponent(callerOwnerId)}`,
        });
      }

      // save_owner_keys — caller can only ever write their OWN owner_id row,
      // resolved server-side above, never a client-supplied one. Manual-key
      // fields stay supported as a fallback for owners not using Connect —
      // functions/api/stripe-connect-oauth.ts writes stripe_account_id
      // separately once an owner completes the OAuth flow.
      const { publishableKey, secretKey: newSecretKey, webhookSecret, mode } = body;
      const patch: Record<string, any> = { owner_id: callerOwnerId, updated_at: new Date().toISOString() };
      if (publishableKey !== undefined) patch.stripe_publishable_key = publishableKey || null;
      if (newSecretKey !== undefined && newSecretKey !== "") patch.stripe_secret_key = newSecretKey; // blank = leave existing key untouched
      if (webhookSecret !== undefined && webhookSecret !== "") patch.stripe_webhook_secret = webhookSecret;
      if (mode !== undefined) patch.stripe_mode = mode === "live" ? "live" : "test";
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/owner_stripe_accounts`, {
        method: "POST",
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!saveRes.ok) {
        const errText = await saveRes.text().catch(() => "");
        return new Response(JSON.stringify({ error: "Failed to save Stripe keys: " + errText }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      return json({ success: true });
    }

    // FEATURE — "prioritize importing existing Stripe customers/cards."
    // Owner-CRM-only, same auth pattern as list_payment_methods right below
    // (never a client-claimed ownerId — always resolved from the caller's
    // own session token). Lists real Stripe customers so the owner can
    // link them to (or create) CRM customer records — see
    // ImportStripeCustomersModal.tsx. Returns whether each Stripe customer
    // has at least one card on file (a cheap has_more probe, not the full
    // card details — those load per-customer via list_payment_methods only
    // once the owner actually picks one to import, so this stays fast even
    // with a large Stripe customer list).
    if (action === "list_stripe_customers") {
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const callerOwnerId = serviceRoleKey ? await resolveCallerOwnerId(accessToken) : null;
      if (serviceRoleKey && !callerOwnerId) {
        return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });
      }
      const acct = callerOwnerId && serviceRoleKey ? await getOwnerStripeAccount(callerOwnerId, serviceRoleKey) : null;
      const secretKey = acct?.secretKey || platformSecretKey;
      const stripeAccount = acct?.stripeAccountId;
      if (!secretKey) return new Response(JSON.stringify({ error: "Stripe isn't configured for this business yet." }), { status: 500, headers: { "Content-Type": "application/json" } });
      const startingAfter = body.startingAfter ? `&starting_after=${encodeURIComponent(body.startingAfter)}` : "";
      const custRes = await stripeFetch(secretKey, "GET", `customers?limit=100${startingAfter}`, undefined, stripeAccount);
      const customersOut = (custRes.data || []).map((c: any) => ({ id: c.id, name: c.name || "", email: c.email || "", phone: c.phone || "", created: c.created }));
      return json({ customers: customersOut, hasMore: !!custRes.has_more });
    }

    // list_payment_methods / detach_payment_method — owner-CRM-only actions
    // exposing/manipulating a customer's stored cards. SECURITY FIX (audit
    // finding) — was gated only by "same tenant" (resolveCallerOwnerId), so
    // any employee session could enumerate or delete another customer's
    // stored payment methods; now requires owner/manager.
    if (action === "list_payment_methods" || action === "detach_payment_method") {
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const caller = serviceRoleKey ? await resolveCallerIsOwnerOrManager(accessToken) : null;
      const callerOwnerId = caller?.ownerId || null;
      if (serviceRoleKey && !callerOwnerId) {
        return new Response(JSON.stringify({ error: "Only the business owner or a manager can manage saved cards." }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      const acct = callerOwnerId && serviceRoleKey ? await getOwnerStripeAccount(callerOwnerId, serviceRoleKey) : null;
      const secretKey = acct?.secretKey || platformSecretKey;
      const stripeAccount = acct?.stripeAccountId;
      if (!secretKey) return new Response(JSON.stringify({ error: "Stripe isn't configured for this business yet." }), { status: 500, headers: { "Content-Type": "application/json" } });

      if (action === "list_payment_methods") {
        if (!body.customerId) throw new Error("Missing customerId");
        if (serviceRoleKey && !(await verifyStripeCustomerOwnedBy(body.customerId, callerOwnerId!, serviceRoleKey))) {
          return new Response(JSON.stringify({ error: "That customer doesn't belong to your business." }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
        const pmRes = await stripeFetch(secretKey, "GET", `payment_methods?customer=${encodeURIComponent(body.customerId)}&type=card`, undefined, stripeAccount);
        const methods = (pmRes.data || []).map((pm: any) => ({ id: pm.id, brand: pm.card?.brand, last4: pm.card?.last4, expMonth: pm.card?.exp_month, expYear: pm.card?.exp_year }));
        return json({ paymentMethods: methods });
      }
      // detach_payment_method — never trust a client-claimed paymentMethodId
      // alone: fetch it from Stripe first to find its real owning customer,
      // then verify that customer belongs to the caller's own tenant, same
      // as detach_my_payment_method's customer-facing check below.
      if (!body.paymentMethodId) throw new Error("Missing paymentMethodId");
      {
        const pmCheck = await stripeFetch(secretKey, "GET", `payment_methods/${encodeURIComponent(body.paymentMethodId)}`, undefined, stripeAccount);
        if (serviceRoleKey && !(await verifyStripeCustomerOwnedBy(pmCheck?.customer, callerOwnerId!, serviceRoleKey))) {
          return new Response(JSON.stringify({ error: "That card doesn't belong to your business." }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
      }
      await stripeFetch(secretKey, "POST", `payment_methods/${encodeURIComponent(body.paymentMethodId)}/detach`, {}, stripeAccount);
      return json({ success: true });
    }

    // get_my_saved_card — the CUSTOMER-safe counterpart to list_payment_methods
    // above. A customer's Supabase session is a separate auth realm from
    // owner/employee sessions (see ClientAuthPortal.tsx) and is never a row
    // in `employees`, so it can't use resolveCallerOwnerId/list_payment_methods
    // without loosening that owner-only check. Instead: verify the caller's
    // own email against the `customers` table (service role — a customer's
    // own anon-key session can't read `customers` directly under the
    // owner-scoped RLS in migration 0033) and return ONLY that one
    // customer's own card — never any other customer's, never a list.
    if (action === "get_my_saved_card") {
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) return json({ card: null });
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
      const user = userRes.ok ? await userRes.json().catch(() => null) as any : null;
      const email = user?.email;
      if (!email) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });

      // BUG FIX (audit finding) — a customer can be linked to MULTIPLE
      // businesses (see public-data.ts get_customer_portal_data's
      // multi-business `accounts` array). Without filtering by owner_id, this
      // always resolved to whichever linked business's row the query happens
      // to return first, regardless of which business tab is active on the
      // client — a card action for Business B could silently act on Business
      // A's row. body.ownerId (the client's currently-active business) scopes
      // it correctly when provided; falls back to unscoped for old callers.
      const custQueryUrl = `${SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=stripeCustomerId,owner_id&limit=1` + (body.ownerId ? `&owner_id=eq.${encodeURIComponent(body.ownerId)}` : "");
      const custRes = await fetch(custQueryUrl, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      const custRows = await custRes.json().catch(() => []);
      const cust = Array.isArray(custRows) ? custRows[0] : null;
      if (!cust?.stripeCustomerId) return json({ card: null });

      const acct = cust.owner_id ? await getOwnerStripeAccount(cust.owner_id, serviceRoleKey) : null;
      const secretKey = acct?.secretKey || platformSecretKey;
      if (!secretKey) return json({ card: null });
      const pmRes = await stripeFetch(secretKey, "GET", `payment_methods?customer=${encodeURIComponent(cust.stripeCustomerId)}&type=card&limit=1`, undefined, acct?.stripeAccountId);
      const pm = (pmRes.data || [])[0];
      if (!pm) return json({ card: null });
      return json({ card: { brand: pm.card?.brand, last4: pm.card?.last4, expMonth: pm.card?.exp_month, expYear: pm.card?.exp_year } });
    }

    // get_my_saved_cards / detach_my_payment_method — the CUSTOMER-safe,
    // MULTI-card counterparts to get_my_saved_card/detach_payment_method
    // above. Same email-verified-against-`customers` pattern as
    // get_my_saved_card (a customer session can't use resolveCallerOwnerId,
    // never a row in `employees`) — lets a customer see and manage every
    // card they've saved, not just the most recent one.
    if (action === "get_my_saved_cards" || action === "detach_my_payment_method") {
      const isList = action === "get_my_saved_cards";
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) return isList ? json({ cards: [] }) : new Response(JSON.stringify({ error: "Not configured." }), { status: 500, headers: { "Content-Type": "application/json" } });
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
      const user = userRes.ok ? await userRes.json().catch(() => null) as any : null;
      const email = user?.email;
      if (!email) return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });

      // BUG FIX (audit finding) — same multi-business owner_id scoping as
      // get_my_saved_card above.
      const custQueryUrl2 = `${SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(email)}&select=stripeCustomerId,owner_id&limit=1` + (body.ownerId ? `&owner_id=eq.${encodeURIComponent(body.ownerId)}` : "");
      const custRes = await fetch(custQueryUrl2, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      const custRows = await custRes.json().catch(() => []);
      const cust = Array.isArray(custRows) ? custRows[0] : null;
      if (!cust?.stripeCustomerId) return isList ? json({ cards: [] }) : new Response(JSON.stringify({ error: "No card on file." }), { status: 404, headers: { "Content-Type": "application/json" } });

      const acct = cust.owner_id ? await getOwnerStripeAccount(cust.owner_id, serviceRoleKey) : null;
      const secretKey = acct?.secretKey || platformSecretKey;
      if (!secretKey) return isList ? json({ cards: [] }) : new Response(JSON.stringify({ error: "Stripe isn't configured for this business yet." }), { status: 500, headers: { "Content-Type": "application/json" } });

      if (action === "get_my_saved_cards") {
        const pmRes = await stripeFetch(secretKey, "GET", `payment_methods?customer=${encodeURIComponent(cust.stripeCustomerId)}&type=card`, undefined, acct?.stripeAccountId);
        const cards = (pmRes.data || []).map((pm: any) => ({ id: pm.id, brand: pm.card?.brand, last4: pm.card?.last4, expMonth: pm.card?.exp_month, expYear: pm.card?.exp_year }));
        return json({ cards });
      }
      // detach_my_payment_method — NEVER trust the client-claimed
      // paymentMethodId alone: fetch it from Stripe first and confirm it
      // actually belongs to THIS customer before detaching, so one
      // customer's session can't detach another customer's card by
      // guessing/passing an arbitrary payment_method id.
      if (!body.paymentMethodId) return new Response(JSON.stringify({ error: "Missing paymentMethodId" }), { status: 400, headers: { "Content-Type": "application/json" } });
      const pmCheck = await stripeFetch(secretKey, "GET", `payment_methods/${encodeURIComponent(body.paymentMethodId)}`, undefined, acct?.stripeAccountId);
      if (pmCheck?.customer !== cust.stripeCustomerId) {
        return new Response(JSON.stringify({ error: "That card doesn't belong to your account." }), { status: 403, headers: { "Content-Type": "application/json" } });
      }
      await stripeFetch(secretKey, "POST", `payment_methods/${encodeURIComponent(body.paymentMethodId)}/detach`, {}, acct?.stripeAccountId);
      return json({ success: true });
    }

    // send_payment_receipt — fires after ANY successful charge (customer
    // self-pay, employee in-person card-on-file, owner-processed) regardless
    // of who's holding the phone/browser. Runs server-side because it needs
    // the owner's Twilio/Gmail credentials, which must never reach a
    // customer's (or, for that matter, a compromised employee's) browser —
    // same reasoning as the Stripe secret key fix this whole file is built
    // around. Texts if the customer has a phone on file, else emails via the
    // owner's connected Gmail; never both, never neither silently — the
    // caller gets a clear success/error either way so a failed receipt can
    // be surfaced as a toast without ever blocking/rolling back the charge
    // itself (the charge already succeeded by the time this runs).
    if (action === "send_payment_receipt") {
      const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceRoleKey) return new Response(JSON.stringify({ error: "Receipts require SUPABASE_SERVICE_ROLE_KEY to be configured." }), { status: 500, headers: { "Content-Type": "application/json" } });

      // SECURITY FIX — this needed no sign-in and took the business (a bare
      // body.ownerId), phone/email, name and amount from the request, so
      // anyone could make any business text or email any number a fake
      // "payment received" message. Now: staff (owner/crew) of the business
      // can send for their own business; anyone else only for an invoice
      // that really has a payment on record, to that invoice's customer's
      // own phone/email, for at most the invoice total.
      const receiptToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const staffOwnerId = receiptToken ? await resolveStaffOwnerId(receiptToken, serviceRoleKey) : null;
      let resolvedOwnerId: string | null = null;
      if (body.invoiceId) {
        const invRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(body.invoiceId)}&select=*`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
        const inv = ((await invRes.json().catch(() => [])) as any[])?.[0];
        if (!inv?.owner_id) return new Response(JSON.stringify({ error: "Invoice not found." }), { status: 404, headers: { "Content-Type": "application/json" } });
        resolvedOwnerId = inv.owner_id;
        if (staffOwnerId !== inv.owner_id) {
          const hasPayment = !!inv.paidAt || Number(inv.paidDeposit) > 0 || (Array.isArray(inv.paymentLog) && inv.paymentLog.some((e: any) => e?.type === "paid"));
          if (!hasPayment) return new Response(JSON.stringify({ error: "No payment is recorded on this invoice yet." }), { status: 400, headers: { "Content-Type": "application/json" } });
          const cRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(inv.customerId || "")}&owner_id=eq.${encodeURIComponent(inv.owner_id)}&select=id,firstName,phone,email`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
          const c = ((await cRes.json().catch(() => [])) as any[])?.[0];
          body.customerPhone = c?.phone || "";
          body.customerEmail = c?.email || "";
          body.customerFirstName = c?.firstName || "";
          body.customerId = c?.id || null;
          // The amount actually paid, from the invoice's own record.
          const lastPaid = Array.isArray(inv.paymentLog) ? [...inv.paymentLog].reverse().find((e: any) => e?.type === "paid" && Number(e?.amount) > 0) : null;
          const paidDollars = Number(lastPaid?.amount) || Number(inv.paidFull) || Number(inv.paidDeposit) || Number(inv.total) || 0;
          body.amountCents = Math.round(Math.min(paidDollars, Number(inv.total) || paidDollars) * 100);
        }
      } else {
        resolvedOwnerId = staffOwnerId;
      }
      if (!resolvedOwnerId) return new Response(JSON.stringify({ error: "Sign in to send a receipt." }), { status: 401, headers: { "Content-Type": "application/json" } });
      body.description = String(body.description || "").slice(0, 120);
      body.customerFirstName = String(body.customerFirstName || "").slice(0, 60);

      const settingsRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(resolvedOwnerId)}&select=data&limit=1`, {
        headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      });
      const settingsRows = await settingsRes.json().catch(() => []);
      const s = Array.isArray(settingsRows) ? settingsRows[0]?.data || {} : {};
      // SECURITY FIX — Twilio auth token and the Google refresh_token moved
      // out of app_settings.data into owner_secrets (migration 0085 — see
      // its comment for the full story); this function used to read both
      // straight off `s` above, which now only ever holds masked
      // placeholders for them. Resolve the real values from owner_secrets
      // instead, same as every other server function that needs them.
      const ownerSecrets = await getOwnerSecrets(resolvedOwnerId, serviceRoleKey);
      const companyName = s.companyName || "CRM Starter";
      const amount = (Number(body.amountCents) / 100 || 0).toFixed(2);
      const description = body.description || "";
      const custName = body.customerFirstName || "there";

      if (body.customerPhone && ownerSecrets?.twilioAccountSid && ownerSecrets?.twilioAuthToken && ownerSecrets?.twilioFromNumber) {
        const smsBody = `Hi ${custName}, this confirms your payment of $${amount} to ${companyName}${description ? " for " + description : ""}. Thank you!`;
        const auth = `Basic ${btoa(`${ownerSecrets.twilioAccountSid}:${ownerSecrets.twilioAuthToken}`)}`;
        const params = new URLSearchParams({ To: body.customerPhone, From: ownerSecrets.twilioFromNumber, Body: smsBody });
        const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ownerSecrets.twilioAccountSid}/Messages.json`, {
          method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
        });
        if (!smsRes.ok) return new Response(JSON.stringify({ error: "Twilio send failed: " + (await smsRes.text().catch(() => "")).slice(0, 200) }), { status: 502, headers: { "Content-Type": "application/json" } });
        // Log to inbox_threads, same as every other outbound SMS.
        try {
          const normDigits = (p: string) => (p || "").replace(/\D/g, "");
          const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&select=id,contact_phone,messages&owner_id=eq.${encodeURIComponent(resolvedOwnerId)}`, {
            headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
          });
          const threads = await threadsRes.json().catch(() => []);
          const existing = Array.isArray(threads) ? threads.find((t: any) => normDigits(t.contact_phone) === normDigits(body.customerPhone)) : null;
          const msg = { id: crypto.randomUUID(), dir: "out", body: smsBody, ts: Date.now() };
          if (existing) {
            // BUG FIX — "my SMS inbox messages disappeared from one
            // conversation." This read the thread's messages array, then
            // PATCHed a brand-new array back — if an inbound webhook (or
            // any other sender) appended its own message to the SAME
            // thread in between that read and this write, this overwrote
            // it with a version that never had it, silently deleting it.
            // append_inbox_message (Postgres function, see migration 0062)
            // does the append inside one atomic UPDATE instead, so it can
            // never race with another appender.
            await fetch(`${SUPABASE_URL}/rest/v1/rpc/append_inbox_message`, {
              method: "POST", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ p_thread_id: existing.id, p_message: msg, p_unread: false }),
            });
          } else {
            await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads`, {
              method: "POST", headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({ id: crypto.randomUUID(), channel: "sms", contact_name: custName, contact_phone: body.customerPhone, customer_id: body.customerId || null, unread: false, messages: [msg], last_message_at: msg.ts, updated_at: new Date().toISOString(), owner_id: resolvedOwnerId }),
            });
          }
        } catch { /* non-fatal — receipt itself already sent */ }
        return json({ success: true, channel: "sms" });
      }

      if (body.customerEmail && s.googleProviderToken) {
        let accessTok = s.googleProviderToken;
        // Access token likely stale by the time this fires (owner may not
        // have opened the app in a while) — refresh via the same Cloudflare
        // Function the client uses, rather than duplicating Google's OAuth
        // token-exchange logic here.
        if (ownerSecrets?.googleRefreshToken && (!s.googleTokenExpiresAt || Date.now() > Number(s.googleTokenExpiresAt) - 60000)) {
          try {
            const origin = new URL(context.request.url).origin;
            const refreshRes = await fetch(`${origin}/api/google-refresh`, {
              method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: ownerSecrets.googleRefreshToken }),
            });
            const refreshData = await refreshRes.json().catch(() => null) as any;
            if (refreshRes.ok && refreshData?.access_token) accessTok = refreshData.access_token;
          } catch { /* fall through with the possibly-stale token; Gmail send below will just fail clearly */ }
        }
        const subject = `Payment Receipt — ${companyName}`;
        const html = `<p>Hi ${custName},</p><p>This confirms your payment of <strong>$${amount}</strong> to ${companyName}${description ? " for " + description : ""}.</p><p>Thank you for your business!</p>`;
        const mime = [`To: ${body.customerEmail}`, `Subject: ${subject}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, ``, html].join("\r\n");
        const raw = btoa(unescape(encodeURIComponent(mime))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        const gmailRes = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST", headers: { Authorization: `Bearer ${accessTok}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }),
        });
        if (!gmailRes.ok) return new Response(JSON.stringify({ error: "Gmail send failed: " + (await gmailRes.text().catch(() => "")).slice(0, 200) }), { status: 502, headers: { "Content-Type": "application/json" } });
        return json({ success: true, channel: "email" });
      }

      return new Response(JSON.stringify({ error: "No phone or email on file for this customer — receipt not sent." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Every remaining action calls api.stripe.com and needs a secret key —
    // resolve the calling owner's own key/Connect account first, falling
    // back to the platform-wide env var (requirement: existing/legacy
    // deployments keep working unmodified).
    let secretKey = platformSecretKey;
    let stripeAccount: string | undefined;
    let resolvedOwnerIdOuter: string | null = null;
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      let resolvedOwnerId: string | null = null;
      if (body.invoiceId) resolvedOwnerId = await getEstimateOwnerId(body.invoiceId, serviceRoleKey);
      // BUG FIX — an owner-authenticated call (e.g. the owner adding a
      // customer's card from CustomerDetail.tsx) had no invoiceId and no
      // client-supplied ownerId either, so it silently fell through to the
      // platform-wide key/account for EVERY owner — a card added this way
      // was being created in the wrong Stripe account entirely. A verified
      // session token (when present) resolves the real caller identity the
      // same trustworthy way save_owner_keys/get_owner_keys_status already
      // do above — preferred over a client-claimed body.ownerId, which is
      // now the last-resort fallback (still needed for the one legitimate
      // case where there's no session at all: an off-session
      // fee charge, run from an employee session whose own id isn't the
      // business owner's).
      if (!resolvedOwnerId) {
        const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (accessToken) resolvedOwnerId = await resolveCallerOwnerId(accessToken);
      }
      if (!resolvedOwnerId && body.ownerId) resolvedOwnerId = body.ownerId;
      resolvedOwnerIdOuter = resolvedOwnerId;
      if (resolvedOwnerId) {
        const acct = await getOwnerStripeAccount(resolvedOwnerId, serviceRoleKey);
        if (acct?.stripeAccountId) { stripeAccount = acct.stripeAccountId; }
        else if (acct?.secretKey) { secretKey = acct.secretKey; }
      }
    }
    if (!secretKey) {
      return new Response(JSON.stringify({ error: "Stripe isn't configured for this business yet — add keys in Settings → Integrations → Stripe, or (platform admin) set STRIPE_SECRET_KEY in the Cloudflare Pages dashboard." }), {
        status: 500, headers: { "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "create_payment_intent": {
        // SECURITY FIX (audit finding) — with no invoiceId, resolvedOwnerIdOuter
        // (computed above, used to pick which business's Stripe key/account
        // this charge goes through) fell all the way back to a client-claimed
        // body.ownerId with zero verification — an unauthenticated caller
        // could pass an arbitrary ownerId + amountCents and get a real,
        // confirmable PaymentIntent created against that business's Stripe
        // account. Same guard create_checkout_session already uses: require a
        // real verified session whenever there's no invoiceId to anchor the
        // owner/amount instead. (If this passes, the earlier resolvedOwnerId
        // block already resolved the SAME accessToken to the SAME ownerId —
        // it never actually reached the body.ownerId fallback at all.)
        if (!body.invoiceId) {
          const accessTokenGuard = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
          const verifiedOwnerId = await resolveCallerOwnerId(accessTokenGuard);
          if (!verifiedOwnerId) {
            return new Response(JSON.stringify({ error: "Not authenticated — sign in and try again." }), { status: 401, headers: { "Content-Type": "application/json" } });
          }
        }
        // BUG FIX — "payment security in general." The invoiceId-verified
        // amount ignored any tip entirely, which meant a customer paying
        // with a tip could ONLY be trusted for the raw client-supplied
        // amount (tip included) — the one payment path in this app that
        // still fully trusted the client. A tip only ever ADDS to what's
        // charged (never a way to underpay), so it's safe to accept
        // separately and add it on top of the server-verified base — the
        // base itself is still never client-controlled when invoiceId is
        // given.
        const tipCents = Math.max(0, Math.round(Number(body.tipCents) || 0));
        // Amount due is recomputed server-side for the option the customer
        // picked (deposit / balance / full, minus a verified promo) — see
        // _lib/amountDue.ts. The browser's claimed amount is never used.
        const due = body.invoiceId ? await computeAmountDue({ invoiceId: body.invoiceId, serviceRoleKey, payType: body.payType, promoId: body.promoId, referrerId: body.referrerId }) : null;
        const amountCents = (due ? due.baseCents : Math.round(Number(body.amountCents) || 0)) + tipCents;
        if (amountCents <= 0) throw new Error("Invalid amount");
        const params: Record<string, string> = {
          amount: String(amountCents),
          currency: body.currency || "usd",
          description: body.description || "",
          "automatic_payment_methods[enabled]": "true",
        };
        if (body.invoiceId) params["metadata[invoiceId]"] = body.invoiceId;
        if (due) { params["metadata[payType]"] = due.payType; params["metadata[baseCents]"] = String(due.baseCents); params["metadata[tipCents]"] = String(Math.max(0, amountCents - due.baseCents)); }
        // FEATURE — "save this card" checkbox during a real invoice payment
        // (StripePaymentModal). Stripe requires `customer` +
        // setup_future_usage to be set at PaymentIntent CREATION time, not
        // bolted on after — so this resolves the paying customer from the
        // invoice itself (never trusts a client-claimed customerId, same
        // rule the amount check above already follows) and reuses their
        // existing Stripe customer if one's on file, or lets Stripe create
        // one implicitly via the `customer` param on confirmation.
        let resolvedCrmCustomerId: string | undefined;
        let resolvedStripeCustomerId: string | undefined;
        if (body.saveCard && body.invoiceId && serviceRoleKey) {
          const info = await resolveInvoiceCustomerForSave(body.invoiceId, serviceRoleKey);
          if (info) {
            resolvedCrmCustomerId = info.crmCustomerId;
            if (info.stripeCustomerId) {
              resolvedStripeCustomerId = info.stripeCustomerId;
            } else {
              const created = await stripeFetch(secretKey, "POST", "customers", { email: info.email || "", name: info.name || "" }, stripeAccount);
              resolvedStripeCustomerId = created.id;
            }
            params.customer = resolvedStripeCustomerId;
            params["setup_future_usage"] = "off_session";
          }
        }
        const intent = await stripeFetch(secretKey, "POST", "payment_intents", params, stripeAccount);
        return json({
          id: intent.id, client_secret: intent.client_secret, status: intent.status,
          ...(resolvedStripeCustomerId ? { stripeCustomerId: resolvedStripeCustomerId, crmCustomerId: resolvedCrmCustomerId } : {}),
        });
      }
      case "retrieve_payment_intent": {
        if (!body.id) throw new Error("Missing id");
        const intent = await stripeFetch(secretKey, "GET", `payment_intents/${encodeURIComponent(body.id)}`, undefined, stripeAccount);
        // Status only — this needs no sign-in, so never hand back the client
        // secret, the Stripe customer, or card details.
        return json({ id: intent.id, status: intent.status, amount: intent.amount, currency: intent.currency });
      }
      // AUDIT FIX — ClientAuthPortal.tsx's post-payment write used to PATCH
      // `estimates` directly from the CUSTOMER's own Supabase Auth session.
      // Per docs/ARCHITECTURE.md's owner_id-scoped RLS model, a customer never resolves
      // to that invoice's owner_id, so that write matched ZERO rows EVERY
      // SINGLE TIME — no error, no toast, completely silent (the exact
      // documented 0-row-silent-success gotcha) — and was never checked or
      // caught. The card genuinely charged successfully; only the CRM's own
      // record of it depended entirely on the Stripe webhook eventually
      // arriving (a manual per-owner Cloudflare/Stripe dashboard setup step
      // that may not be configured). This action is the real fix: verify
      // the payment really succeeded via Stripe's own API (never trust a
      // client-claimed status) using the SAME owner-key resolution as every
      // other action here, then write with the service role (bypasses RLS
      // the same way stripe-webhook.ts already does) and actually check the
      // result — a same-origin, same-trust-level backstop that doesn't wait
      // on webhook delivery.
      case "confirm_invoice_payment": {
        if (!body.invoiceId || !body.paymentIntentId) throw new Error("Missing invoiceId or paymentIntentId");
        if (!serviceRoleKey) throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard.");
        const intent = await stripeFetch(secretKey, "GET", `payment_intents/${encodeURIComponent(body.paymentIntentId)}`, undefined, stripeAccount);
        if (intent?.status !== "succeeded") {
          return new Response(JSON.stringify({ error: `Payment intent status is "${intent?.status}", not succeeded — invoice not marked paid.` }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        // SECURITY FIX (audit finding — CRITICAL) — this never checked that
        // the given paymentIntentId was actually created FOR this invoiceId.
        // create_payment_intent stamps metadata.invoiceId on creation (see
        // above) — a caller could pay a small/unrelated invoice once to get
        // one real succeeded paymentIntentId, then call this action with
        // THAT id and a different, larger invoiceId under the same owner to
        // mark it paid without paying for it. Require the intent's own
        // metadata to match the invoice being marked paid, and cross-check
        // the amount actually matches too (belt and suspenders — catches a
        // legacy intent created before metadata was added).
        // The intent itself (created server-side above) records what was due
        // for the option the customer chose; older intents fall back to the
        // invoice total.
        const expectedAmountCents = Number(intent?.metadata?.baseCents) || await getInvoiceAmountCents(body.invoiceId, serviceRoleKey).catch(() => 0);
        const intentInvoiceId = intent?.metadata?.invoiceId;
        if (intentInvoiceId !== body.invoiceId || !expectedAmountCents || Number(intent.amount) < expectedAmountCents) {
          return new Response(JSON.stringify({ error: "This payment doesn't match the invoice being confirmed — nothing was marked paid." }), { status: 400, headers: { "Content-Type": "application/json" } });
        }
        const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
        const getRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(body.invoiceId)}&select=paymentLog,paidDeposit`, { headers: authHeaders });
        const rows = await getRes.json().catch(() => []);
        const existingLog = Array.isArray(rows) && Array.isArray(rows[0]?.paymentLog) ? rows[0].paymentLog : [];
        const alreadyLogged = existingLog.some((e: any) => e?.type === "paid" && e?.stripePaymentIntentId === body.paymentIntentId);
        const newLog = alreadyLogged ? existingLog : [...existingLog, { id: crypto.randomUUID(), at: new Date().toISOString(), type: "paid", amount: (intent.amount || 0) / 100, stripePaymentIntentId: body.paymentIntentId, note: "Paid via Stripe (customer portal)" }];
        const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/estimates?id=eq.${encodeURIComponent(body.invoiceId)}&select=id`, {
          method: "PATCH",
          headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify({ ...paidPatch(rows[0], intent?.metadata?.payType || "full", ((Number(intent.amount) || 0) - (Number(intent?.metadata?.tipCents) || 0)) / 100), stripePaymentIntentId: body.paymentIntentId, stripePaymentStatus: "paid", paymentLog: newLog }),
        });
        const updated = await patchRes.json().catch(() => []);
        if (!patchRes.ok || !Array.isArray(updated) || updated.length === 0) {
          return new Response(JSON.stringify({ error: "Payment succeeded with Stripe, but the invoice record couldn't be updated (0 rows matched) — contact the business directly to confirm your invoice shows paid." }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
        return json({ success: true });
      }
      case "create_checkout_session": {
        // SECURITY FIX (audit finding) — with no invoiceId, resolvedOwnerIdOuter
        // (used above to pick which business's Stripe key/account to charge
        // through) falls all the way back to a client-claimed body.ownerId,
        // and amountCents/description were fully client-controlled too. An
        // unauthenticated caller could pass an arbitrary ownerId + amount and
        // get a real Checkout Session created against that business's Stripe
        // account — no money is stolen (the customer still has to pay), but
        // it lets anyone mint "invoice" checkout links purporting to be from
        // any business, and probes which ownerIds have Stripe configured.
        // Require a real verified session whenever there's no invoiceId to
        // anchor the owner/amount instead, same guard charge_saved_payment_
        // method uses.
        if (!body.invoiceId) {
          const accessTokenGuard = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
          const verifiedOwnerId = await resolveCallerOwnerId(accessTokenGuard);
          if (!verifiedOwnerId) {
            return new Response(JSON.stringify({ error: "Not authenticated — sign in and try again." }), { status: 401, headers: { "Content-Type": "application/json" } });
          }
        }
        const due = body.invoiceId ? await computeAmountDue({ invoiceId: body.invoiceId, serviceRoleKey, payType: body.payType }) : null;
        const amountCents = due ? due.baseCents : Math.round(Number(body.amountCents) || 0);
        if (amountCents <= 0) throw new Error("Invalid amount");
        const params: Record<string, string> = {
          mode: "payment",
          success_url: body.successUrl,
          cancel_url: body.cancelUrl,
          "line_items[0][price_data][currency]": body.currency || "usd",
          "line_items[0][price_data][product_data][name]": body.description || "Invoice payment",
          "line_items[0][price_data][unit_amount]": String(amountCents),
          "line_items[0][quantity]": "1",
        };
        if (body.customerEmail) params.customer_email = body.customerEmail;
        if (body.invoiceId) { params.client_reference_id = body.invoiceId; params["metadata[invoiceId]"] = body.invoiceId; }
        if (due) { params["metadata[payType]"] = due.payType; params["metadata[baseCents]"] = String(due.baseCents); }
        const session = await stripeFetch(secretKey, "POST", "checkout/sessions", params, stripeAccount);
        return json({ id: session.id, url: session.url, payment_status: session.payment_status, payment_intent: session.payment_intent });
      }
      // FEATURE — real recurring billing. Owner sets up a recurring plan for
      // one of their own customers (from CustomerDetail.tsx); this is
      // configuration by the AUTHENTICATED OWNER of their own pricing, not a
      // customer-facing amount, so amountCents is trusted here the same way
      // create_customer already trusts owner-supplied name/email — the
      // "never trust the client" rule elsewhere in this file exists
      // specifically to stop a CUSTOMER from lying about what THEY owe, not
      // to stop an owner from setting their own price. Uses Stripe Checkout
      // in subscription mode with inline price_data (a real, fully
      // supported recurring-price shape — same pattern platform-billing.ts
      // already uses for CRM Starter's own SaaS billing), so no Stripe Product
      // catalog setup is required on the owner's account.
      case "create_recurring_checkout_session": {
        const amountCents = Math.round(Number(body.amountCents) || 0);
        if (amountCents <= 0) throw new Error("Invalid amount");
        const interval = ["day", "week", "month", "year"].includes(body.interval) ? body.interval : "month";
        const intervalCount = Math.max(1, Math.round(Number(body.intervalCount) || 1));
        if (!body.crmCustomerId) throw new Error("Missing crmCustomerId");
        const params: Record<string, string> = {
          mode: "subscription",
          success_url: body.successUrl,
          cancel_url: body.cancelUrl,
          "line_items[0][price_data][currency]": body.currency || "usd",
          "line_items[0][price_data][product_data][name]": body.description || "Recurring service",
          "line_items[0][price_data][unit_amount]": String(amountCents),
          "line_items[0][price_data][recurring][interval]": interval,
          "line_items[0][price_data][recurring][interval_count]": String(intervalCount),
          "line_items[0][quantity]": "1",
          "subscription_data[metadata][crmCustomerId]": body.crmCustomerId,
        };
        if (resolvedOwnerIdOuter) params["subscription_data[metadata][ownerId]"] = resolvedOwnerIdOuter;
        if (body.customerEmail) params.customer_email = body.customerEmail;
        const session = await stripeFetch(secretKey, "POST", "checkout/sessions", params, stripeAccount);
        return json({ id: session.id, url: session.url });
      }
      // cancel_recurring_subscription — owner-only, stops future billing.
      // Stripe's DELETE cancels immediately (no partial-period refund is
      // issued automatically — same as Stripe's own dashboard "Cancel
      // subscription" default).
      case "cancel_recurring_subscription": {
        // SECURITY FIX (audit finding) — was reachable by any authenticated
        // tenant member; cancelling a customer's recurring billing plan is
        // an owner/manager-level action.
        {
          const accessTokenGuard = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
          const guard = await resolveCallerIsOwnerOrManager(accessTokenGuard);
          const staffOwner = serviceRoleKey ? await resolveStaffOwnerId(accessTokenGuard, serviceRoleKey) : null;
          if (!guard || !staffOwner || staffOwner !== guard.ownerId) return new Response(JSON.stringify({ error: "Only the business owner or a manager can cancel a recurring plan." }), { status: 403, headers: { "Content-Type": "application/json" } });
          if (!body.subscriptionId) throw new Error("Missing subscriptionId");
          // Same as refund: the caller's own account, and the plan must be theirs.
          ({ secretKey, stripeAccount } = await stripeCredsFor(guard.ownerId, serviceRoleKey!, platformSecretKey));
          if (!secretKey) throw new Error("Stripe isn't configured for this business yet.");
          const sub = await stripeFetch(secretKey, "GET", `subscriptions/${encodeURIComponent(body.subscriptionId)}`, undefined, stripeAccount);
          const owned = sub?.metadata?.ownerId === guard.ownerId || (sub?.customer && await verifyStripeCustomerOwnedBy(sub.customer, guard.ownerId, serviceRoleKey!));
          if (!owned) return new Response(JSON.stringify({ error: "That plan doesn't belong to your business." }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
        const sub = await stripeFetch(secretKey, "DELETE", `subscriptions/${encodeURIComponent(body.subscriptionId)}`, undefined, stripeAccount);
        return json({ success: true, status: sub.status || "canceled" });
      }
      case "retrieve_checkout_session": {
        if (!body.sessionId) throw new Error("Missing sessionId");
        // Owner/crew only (InvoicesPage) — a Checkout Session carries the
        // payer's name, email and address.
        {
          const accessTokenGuard = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
          const staffOwner = serviceRoleKey ? await resolveStaffOwnerId(accessTokenGuard, serviceRoleKey) : null;
          if (!staffOwner) return new Response(JSON.stringify({ error: "Not authenticated — sign in and try again." }), { status: 401, headers: { "Content-Type": "application/json" } });
          ({ secretKey, stripeAccount } = await stripeCredsFor(staffOwner, serviceRoleKey!, platformSecretKey));
          if (!secretKey) throw new Error("Stripe isn't configured for this business yet.");
        }
        const session = await stripeFetch(secretKey, "GET", `checkout/sessions/${encodeURIComponent(body.sessionId)}`, undefined, stripeAccount);
        return json(session);
      }
      case "create_customer": {
        // BUG FIX — "I press Add Card and it just says missing email." Not
        // every customer record has an email on file (phone-only customers
        // are common for a service business), but a Stripe Customer
        // doesn't actually require one — only this endpoint's own hard check
        // did. Require AT LEAST a name or email (Stripe needs something to
        // identify the customer by), never email specifically.
        if (!body.email && !body.name) throw new Error("Missing customer name or email");
        const params: Record<string, string> = { name: body.name || "" };
        if (body.email) params.email = body.email;
        const customer = await stripeFetch(secretKey, "POST", "customers", params, stripeAccount);
        return json({ id: customer.id, email: customer.email, name: customer.name });
      }
      case "create_setup_intent": {
        if (!body.customerId) throw new Error("Missing customerId");
        const intent = await stripeFetch(secretKey, "POST", "setup_intents", { customer: body.customerId, "payment_method_types[0]": "card" }, stripeAccount);
        return json({ id: intent.id, client_secret: intent.client_secret, status: intent.status });
      }
      case "charge_saved_payment_method": {
        // SECURITY FIX (audit finding — CRITICAL) — this action actually
        // executes a real off-session charge (confirm:"true"), unlike
        // create_payment_intent (which only creates an intent the customer
        // must separately confirm client-side). The comment below claimed
        // "only ever called from authenticated CRM UI" but nothing here
        // enforced that — with no invoiceId (every field-portal in-person/
        // tip/fee charge omits it, see EmployeePortal.tsx), amountCents,
        // ownerId, customerId, and paymentMethodId were all trusted
        // verbatim from the request body, so an unauthenticated caller
        // could charge an arbitrary amount to an arbitrary business's
        // customer. Now requires a real session; the resolved caller's own
        // owner_id (resolvedOwnerIdOuter, set above) must have actually
        // matched, not fallen back to a client-claimed body.ownerId, before
        // this executes any money movement. The remaining "employee trusts
        // their own job.amount" gap for non-invoice charges is a much
        // narrower, already-legitimate-access insider concern (that
        // employee could just as easily edit the job before charging
        // through the normal UI) — this fix closes the actual open-to-
        // anyone exploit. resolvedOwnerIdOuter alone isn't sufficient
        // proof — the outer resolution chain above falls back to a
        // client-claimed body.ownerId when no session resolves, which is
        // exactly what an unauthenticated attacker would hit. Re-verify a
        // REAL session directly here, independent of that fallback.
        let verifiedOwnerIdForCharge: string | null = null;
        {
          const accessTokenGuard = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
          verifiedOwnerIdForCharge = await resolveCallerOwnerId(accessTokenGuard);
          if (!verifiedOwnerIdForCharge) {
            return new Response(JSON.stringify({ error: "Not authenticated — sign in and try again." }), { status: 401, headers: { "Content-Type": "application/json" } });
          }
        }
        const due = body.invoiceId ? await computeAmountDue({ invoiceId: body.invoiceId, serviceRoleKey, payType: body.payType }) : null;
        const amountCents = due ? due.baseCents : Math.round(Number(body.amountCents) || 0);
        if (!body.customerId || !body.paymentMethodId) throw new Error("Missing customerId/paymentMethodId");
        if (amountCents <= 0) throw new Error("Invalid amount");
        // SECURITY FIX (audit finding) — verifiedOwnerIdForCharge only proved
        // "a real session," not that body.customerId is actually THIS
        // caller's own tenant's customer. Same cross-tenant risk as
        // list_payment_methods/detach_payment_method above.
        if (serviceRoleKey && !(await verifyStripeCustomerOwnedBy(body.customerId, verifiedOwnerIdForCharge, serviceRoleKey))) {
          return new Response(JSON.stringify({ error: "That customer doesn't belong to your business." }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
        const params: Record<string, string> = {
          amount: String(amountCents),
          currency: body.currency || "usd",
          description: body.description || "",
          customer: body.customerId,
          payment_method: body.paymentMethodId,
          off_session: "true",
          confirm: "true",
        };
        if (body.invoiceId) params["metadata[invoiceId]"] = body.invoiceId;
        if (due) { params["metadata[payType]"] = due.payType; params["metadata[baseCents]"] = String(due.baseCents); params["metadata[tipCents]"] = String(Math.max(0, amountCents - due.baseCents)); }
        // Idempotency key derived from the invoice when one is given (the
        // charge is then fully determined by it — safe to reuse on retry).
        // SECURITY/SYNC FIX (audit finding) — ad-hoc charges (field-portal
        // tips/fees, no invoiceId) used to get a fresh crypto.randomUUID()
        // key on every single call, which is exactly the charge type most
        // likely to be retried by a flaky field connection (see the
        // withTimeout pattern these buttons already use because of hangs) —
        // a retried/double-tapped tip could create two real PaymentIntents.
        // Derive a stable key from the charge's own identity instead, bucketed
        // to a 60s window so a genuinely new charge for the same
        // customer/card/amount a minute later still gets its own key.
        const chargeIdemKey = body.invoiceId
          ? `charge-${body.invoiceId}`
          : `charge-${body.customerId}-${body.paymentMethodId}-${amountCents}-${Math.floor(Date.now() / 60000)}`;
        const intent = await stripeFetch(secretKey, "POST", "payment_intents", params, stripeAccount, chargeIdemKey);
        return json({ id: intent.id, client_secret: intent.client_secret, status: intent.status });
      }
      case "refund": {
        // SECURITY FIX (audit finding) — the "OWNER-ONLY in practice" claim
        // below was a UI convention, not a server-enforced one: this was
        // reachable by any authenticated employee session. Now actually
        // requires owner/manager server-side, matching what the comment
        // always claimed.
        // SECURITY FIX — the Stripe account above is picked from body.invoiceId
        // when one is sent, and any signed-in account (even a customer-portal
        // one, which has no employees row) passed the owner/manager check. A
        // customer could pay an invoice, then refund their own payment by
        // sending that invoiceId + payment id. Now the refund always runs on
        // the CALLER's own business account, and the payment must belong to
        // that business (its invoice or its Stripe customer).
        {
          const accessTokenGuard = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
          const guard = await resolveCallerIsOwnerOrManager(accessTokenGuard);
          const staffOwner = serviceRoleKey ? await resolveStaffOwnerId(accessTokenGuard, serviceRoleKey) : null;
          if (!guard || !staffOwner || staffOwner !== guard.ownerId) return new Response(JSON.stringify({ error: "Only the business owner or a manager can issue refunds." }), { status: 403, headers: { "Content-Type": "application/json" } });
          if (!body.paymentIntentId) throw new Error("Missing paymentIntentId");
          ({ secretKey, stripeAccount } = await stripeCredsFor(guard.ownerId, serviceRoleKey!, platformSecretKey));
          if (!secretKey) throw new Error("Stripe isn't configured for this business yet.");
          const pi = await stripeFetch(secretKey, "GET", `payment_intents/${encodeURIComponent(body.paymentIntentId)}`, undefined, stripeAccount);
          const piInvoiceOwner = pi?.metadata?.invoiceId ? await getEstimateOwnerId(pi.metadata.invoiceId, serviceRoleKey!) : null;
          const recorded = async () => {
            const r = await fetch(`${SUPABASE_URL}/rest/v1/estimates?stripePaymentIntentId=eq.${encodeURIComponent(body.paymentIntentId)}&owner_id=eq.${encodeURIComponent(guard.ownerId)}&select=id&limit=1`, { headers: { apikey: serviceRoleKey!, Authorization: `Bearer ${serviceRoleKey}` } });
            const rows = await r.json().catch(() => []);
            return Array.isArray(rows) && rows.length > 0;
          };
          const owned = piInvoiceOwner === guard.ownerId || (pi?.customer && await verifyStripeCustomerOwnedBy(pi.customer, guard.ownerId, serviceRoleKey!)) || await recorded();
          if (!owned) return new Response(JSON.stringify({ error: "That payment doesn't belong to your business." }), { status: 403, headers: { "Content-Type": "application/json" } });
        }
        // OWNER-ONLY — only ever called from InvoicesPage/JobDetailModal
        // (authenticated CRM), never exposed to the customer-facing portal.
        // FEATURE — partial refunds: an owner can now issue a specific
        // amount instead of only ever refunding the full charge. Omitting
        // `amount` refunds the full remaining amount (Stripe's own default
        // behavior) — passing it does a real partial refund.
        if (!body.paymentIntentId) throw new Error("Missing paymentIntentId");
        const params: Record<string, string> = { payment_intent: body.paymentIntentId };
        if (body.amountCents !== undefined && body.amountCents !== null) {
          const amt = Math.round(Number(body.amountCents));
          if (!amt || amt <= 0) throw new Error("Invalid refund amount");
          params.amount = String(amt);
        }
        // Refund is fully determined by (paymentIntentId, amount) — safe to
        // reuse this key on retry instead of risking a double refund.
        const refundIdemKey = `refund-${body.paymentIntentId}-${params.amount || "full"}`;
        const refund = await stripeFetch(secretKey, "POST", "refunds", params, stripeAccount, refundIdemKey);
        return json({ success: true, id: refund.id, amount: refund.amount, status: refund.status });
      }
      default:
        return new Response(JSON.stringify({ error: "Unknown action: " + action }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Stripe proxy error" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }
};

const json = (data: any) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
