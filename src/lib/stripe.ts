import { supabase } from "./supabase";

// ─── Stripe.js loader ──────────────────────────────────────────────────────────

let stripeJsPromise: Promise<any> | null = null;

// BUG FIX — a Stripe CONNECT owner (no manual publishable key of their own —
// see get_owner_keys_status's platform-key fallback in stripe-action.ts) has
// their PaymentIntents created against the PLATFORM's own account with a
// Stripe-Account header, server-side. The client-side Stripe.js instance
// used to confirm that same PaymentIntent (and to mount the Payment
// Element / Payment Request Button) must ALSO be told which connected
// account it's operating against — `Stripe(platformPublishableKey, {
// stripeAccount: acct_... })` — or confirmation fails outright for every
// Connect-mode owner. `stripeAccount` is optional and a no-op for a legacy
// manual-key owner (stripeAccount undefined).
// Start downloading Stripe.js before the customer taps Pay, so the card form
// opens faster (the script is ~100KB and was only fetched after the tap).
export const preloadStripeJs = (): void => { loadStripeScript().catch(() => {}); };

const loadStripeScript = (): Promise<any> => {
  if (!stripeJsPromise) {
    stripeJsPromise = new Promise((resolve, reject) => {
      if ((window as any).Stripe) { resolve((window as any).Stripe); return; }
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      // BUG FIX — "Add Card on File just says Loading forever." If this
      // script gets silently blocked (content blocker, restrictive wifi/
      // firewall) neither onload nor onerror necessarily fires — this
      // promise then never resolves OR rejects, hanging every caller
      // (SaveCardModal, StripePaymentModal) indefinitely with no visible
      // error. 15s is generous for a real script load.
      const timer = setTimeout(() => reject(new Error("Stripe.js didn't load — check your connection (a content blocker or restrictive network may be blocking it) and try again.")), 15000);
      script.onload = () => { clearTimeout(timer); resolve((window as any).Stripe); };
      script.onerror = () => { clearTimeout(timer); reject(new Error("Failed to load Stripe.js")); };
      document.head.appendChild(script);
    });
    // A failed load must not permanently poison every future attempt —
    // clear the cached promise so the next call retries the script fresh.
    stripeJsPromise.catch(() => { stripeJsPromise = null; });
  }
  return stripeJsPromise;
};

export const loadStripeJs = (publishableKey: string, stripeAccount?: string): Promise<any> =>
  loadStripeScript().then(Stripe => Stripe(publishableKey, stripeAccount ? { stripeAccount } : undefined));

// SECURITY AUDIT (round 12) — every function below used to take a `secretKey`
// and call api.stripe.com DIRECTLY FROM THE BROWSER with it. That secret key
// came from `settings.stripeSecretKeyEnc`, which is loaded into every
// session's settings object — including ClientPortal.tsx/ClientAuthPortal.tsx,
// the customer-facing payment pages. "Encrypted" there only meant XOR'd with
// a hardcoded salt shipped in the same bundle (lib/crypto.ts) — trivially
// reversible, handing full Stripe account access to any customer who opened
// a payment link. All of that now routes through functions/api/stripe-action.ts,
// a same-origin Cloudflare Function that holds the real secret key in an
// environment variable and never returns it to the client. Nothing in this
// file touches a Stripe secret key anymore — only the publishable key
// (loadStripeJs above), which is safe to expose by design.
// BUG FIX — this fetch had no timeout, so a hung Cloudflare Function
// request (cold start, dropped connection) left the Settings "Save Stripe
// Settings" button stuck on "Saving…" forever with no error — nothing ever
// rejected the promise. AbortController + a 20s timeout matches the
// treatment docs/ARCHITECTURE.md requires for user-facing action buttons elsewhere in
// the app (field-portal withTimeout wrapper).
const stripeAction = async (action: string, params: Record<string, any> = {}, accessToken?: string): Promise<any> => {
  // Send the signed-in user's session when the caller didn't pass one —
  // owner-only actions (refunds, Checkout lookups) are refused without it.
  if (!accessToken) {
    accessToken = await Promise.race([
      supabase.auth.getSession().then(r => r.data.session?.access_token).catch(() => undefined),
      new Promise<undefined>(r => setTimeout(() => r(undefined), 3000)),
    ]);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res: Response;
  try {
    res = await fetch("/api/stripe-action", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify({ action, ...params }),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Stripe request timed out — check your connection and try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || `Stripe error ${res.status}`);
  return data;
};

// ─── Per-owner Stripe account management (Settings → Integrations → Stripe) ──
// Secret key / webhook secret never round-trip through app_settings.data
// (loaded into every session including unauthenticated portals — see the
// round-12 audit note above) — these two calls are the ONLY place they're
// ever sent, straight to stripe-action.ts, which stores them in the
// service-role-only owner_stripe_accounts table and never returns them.

export interface OwnerStripeStatus {
  connected: boolean;
  stripeAccountId: string;
  // Unmasked version of stripeAccountId above (that one's truncated for
  // display in Settings) — safe to expose client-side, a Connect account id
  // isn't secret, and it's required to actually initialize Stripe.js against
  // the right connected account (see loadStripeJs's stripeAccount param).
  stripeAccountIdFull: string;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  publishableKey: string;
  mode: "test" | "live";
  webhookUrl: string;
}

export const getOwnerStripeStatus = async (accessToken: string): Promise<OwnerStripeStatus> =>
  stripeAction("get_owner_keys_status", {}, accessToken);

export const saveOwnerStripeKeys = async (
  accessToken: string,
  keys: { publishableKey?: string; secretKey?: string; webhookSecret?: string; mode?: "test" | "live" }
): Promise<void> => {
  await stripeAction("save_owner_keys", keys, accessToken);
};

// ─── Stripe Connect (OAuth) ────────────────────────────────────────────────
// "Connect with Stripe" — see functions/api/stripe-connect-oauth.ts. Gets
// the authorize URL, then the caller does `window.location.href = url`;
// Stripe redirects back to that same Function's GET handler, which saves
// the connected account id and redirects into #/settings.
export const getStripeConnectAuthorizeUrl = async (accessToken: string): Promise<string> => {
  const res = await fetch("/api/stripe-connect-oauth", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "get_authorize_url" }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || `Stripe Connect error ${res.status}`);
  return data.url;
};

// ─── Owner-side saved-card management (Customer detail → Payment Methods) ──
// Owner-CRM-only — never exposed to ClientPortal/ClientAuthPortal. Requires
// the caller's own Supabase session token so stripe-action.ts can verify
// which business's Stripe account to query, same as the Settings save flow.

export interface StripeSavedCard { id: string; brand?: string; last4?: string; expMonth?: number; expYear?: number }

export const listCustomerPaymentMethods = async (accessToken: string, customerId: string): Promise<StripeSavedCard[]> => {
  const data = await stripeAction("list_payment_methods", { customerId }, accessToken);
  return data.paymentMethods || [];
};

export const detachPaymentMethod = async (accessToken: string, paymentMethodId: string): Promise<void> => {
  await stripeAction("detach_payment_method", { paymentMethodId }, accessToken);
};

// FEATURE — "prioritize importing existing Stripe customers/cards." See
// ImportStripeCustomersModal.tsx — lists real Stripe customers (name/email/
// phone only; actual card details load per-customer via
// listCustomerPaymentMethods above only once the owner picks one to link,
// so this stays fast even with a large Stripe customer list).
export interface StripeCustomerListItem { id: string; name: string; email: string; phone: string; created: number }
export const listStripeCustomers = async (accessToken: string, startingAfter?: string): Promise<{ customers: StripeCustomerListItem[]; hasMore: boolean }> => {
  const data = await stripeAction("list_stripe_customers", startingAfter ? { startingAfter } : {}, accessToken);
  return { customers: data.customers || [], hasMore: !!data.hasMore };
};

// ─── Customer-facing "card on file" display (ClientAuthPortal.tsx) ────────
// Customer sessions are a separate Supabase auth realm from owner/employee
// ones and can't use listCustomerPaymentMethods above (that's gated to
// owner/employee callers only) — this is the customer-safe counterpart,
// verified server-side against the caller's own email, returning only
// their own single card.
export const getMySavedCard = async (accessToken: string): Promise<StripeSavedCard | null> => {
  const data = await stripeAction("get_my_saved_card", {}, accessToken);
  return data.card || null;
};

// FEATURE — multi-card support: a customer can save more than one card and
// pick a default. get_my_saved_cards returns every card on file (not just
// the most recent); detach_my_payment_method removes one, server-verified
// to actually belong to the caller's own Stripe customer first.
export const getMySavedCards = async (accessToken: string): Promise<StripeSavedCard[]> => {
  const data = await stripeAction("get_my_saved_cards", {}, accessToken);
  return data.cards || [];
};

export const detachMyPaymentMethod = async (accessToken: string, paymentMethodId: string): Promise<void> => {
  await stripeAction("detach_my_payment_method", { paymentMethodId }, accessToken);
};

// ─── Payment Intents ───────────────────────────────────────────────────────────

export interface StripePaymentIntent {
  id: string;
  client_secret: string;
  status: string;
  // Only present when `saveCard` was requested and the server could resolve
  // a real customer to attach the card to (requires invoiceId — see
  // stripe-action.ts's resolveInvoiceCustomerForSave).
  stripeCustomerId?: string;
  crmCustomerId?: string;
}

// SECURITY FIX (audit finding) — this never accepted/forwarded an
// accessToken at all, for ANY caller. With no invoiceId (a real, supported
// case — see StripePaymentModal's "Job payment" description fallback for a
// job with no linked invoice yet), stripe-action.ts had nothing to resolve
// the calling owner from except a client-claimed body.ownerId — which this
// function never even sent, so that no-invoice charge was silently landing
// on the PLATFORM's own Stripe key/account instead of the job's real
// owner's, AND (since the raw endpoint has no such restriction) let anyone
// calling /api/stripe-action directly pass an arbitrary ownerId+amountCents
// to charge a real card against any business's Stripe account. Passing the
// caller's own session token (StripePaymentModal now fetches it) lets the
// server resolve the REAL caller identity via resolveCallerOwnerId, the
// same trustworthy path create_checkout_session/charge_saved_payment_method
// already require.
export const createPaymentIntent = async (
  amountCents: number,
  currency: string,
  description: string,
  metadata?: Record<string, string>,
  saveCard?: boolean,
  tipCents?: number,
  accessToken?: string,
  // Which option the customer picked (deposit / balance / full) and any
  // promo/referral — the server recomputes the real amount from these.
  payment?: { payType?: string; promoId?: string; referrerId?: string }
): Promise<StripePaymentIntent> =>
  stripeAction("create_payment_intent", {
    amountCents,
    currency,
    description,
    invoiceId: metadata?.invoiceId,
    saveCard: !!saveCard,
    tipCents: tipCents || 0,
    ...(payment || {}),
  }, accessToken);

export const retrievePaymentIntent = async (id: string): Promise<StripePaymentIntent> =>
  stripeAction("retrieve_payment_intent", { id });

// AUDIT FIX — server-verified "mark this invoice paid," callable from an
// unauthenticated/customer session where a direct Supabase write would
// silently match 0 rows under owner_id-scoped RLS (see stripe-action.ts's
// confirm_invoice_payment comment for the full story). Re-checks the
// payment intent's real status with Stripe itself before writing anything.
export const confirmInvoicePayment = async (invoiceId: string, paymentIntentId: string): Promise<void> => {
  await stripeAction("confirm_invoice_payment", { invoiceId, paymentIntentId });
};

// ─── Checkout Sessions (hosted checkout page) ─────────────────────────────────

export interface StripeCheckoutSession {
  id: string;
  url: string;
  payment_status: string;
  payment_intent?: string;
}

export const createCheckoutSession = async (
  opts: { amountCents: number; currency: string; description: string; successUrl: string; cancelUrl: string; customerEmail?: string; invoiceId?: string }
): Promise<StripeCheckoutSession> =>
  stripeAction("create_checkout_session", opts);

export const retrieveCheckoutSession = async (sessionId: string): Promise<StripeCheckoutSession> =>
  stripeAction("retrieve_checkout_session", { sessionId });

// ─── Customers + saved payment methods (for the client portal) ───────────────

export interface StripeCustomerObj { id: string; email?: string; name?: string }

// BUG FIX — ownerId was never passed here at all. stripe-action.ts resolves
// which business's Stripe account to use from body.invoiceId OR body.ownerId
// — neither was ever present on this call, so it ALWAYS silently fell back
// to the platform-wide key/account for every owner, Connect or manual-key.
// A card saved through SaveCardModal.tsx was being created in the wrong
// Stripe account entirely for any owner who wasn't relying on the platform
// fallback. Same fix for createSetupIntent below.
// `accessToken`, when the caller has one (owner/employee session — a
// customer session intentionally never passes one here, see
// SaveCardModal.tsx), lets the server resolve the REAL caller identity via
// resolveCallerOwnerId — preferred over the client-claimed `ownerId` below,
// which stays as the fallback for the one legitimate no-session case (the
// customer portal, which resolves its own ownerId server-side from the
// customer row itself before ever reaching this function).
export const createStripeCustomer = async (email: string, name: string, ownerId?: string, accessToken?: string): Promise<StripeCustomerObj> =>
  stripeAction("create_customer", { email, name, ownerId }, accessToken);

export interface StripeSetupIntent { id: string; client_secret: string; status: string }

export const createSetupIntent = async (customerId: string, ownerId?: string, accessToken?: string): Promise<StripeSetupIntent> =>
  stripeAction("create_setup_intent", { customerId, ownerId }, accessToken);

export const chargeSavedPaymentMethod = async (
  customerId: string,
  paymentMethodId: string,
  amountCents: number,
  currency: string,
  description: string,
  invoiceId?: string,
  // MULTI-TENANT (Phase F) — which business's Stripe secret key to charge
  // with. stripe-action.ts resolves invoiceId's own owner_id first (never
  // trusts the client) and only falls back to this when no invoiceId is
  // given — e.g. an off-session saved-card charge, which has no
  // invoice yet at charge time. Callers running from an employee session
  // (whose own Supabase session isn't necessarily the OWNER's) must pass the
  // job/customer's owner_id explicitly here so the right business gets
  // charged instead of silently falling back to the platform-wide key.
  ownerId?: string
): Promise<StripePaymentIntent> =>
  stripeAction("charge_saved_payment_method", { customerId, paymentMethodId, amountCents, currency, description, invoiceId, ownerId });

// amountCents omitted = full refund; passed = a real partial refund of
// exactly that amount.
export const refundPaymentIntent = async (paymentIntentId: string, amountCents?: number): Promise<{ id: string; amount: number }> => {
  const result = await stripeAction("refund", { paymentIntentId, amountCents });
  return { id: result.id, amount: result.amount };
};

// FEATURE — automatic payment confirmation receipt, sent server-side (see
// stripe-action.ts's send_payment_receipt) right after ANY successful
// charge, regardless of who processed it (customer self-pay, employee
// in-person, owner). Runs server-side because it needs the owner's Twilio/
// Gmail credentials, which must never reach a customer's browser. Texts if
// a phone is on file, else emails; throws on genuine failure so callers can
// toast a warning — the charge itself has already succeeded either way, so
// this should never block/undo it, only surface if the receipt itself
// didn't go out.
export const sendPaymentReceipt = async (opts: {
  customerPhone?: string; customerEmail?: string; customerFirstName?: string; customerId?: string;
  amountCents: number; description?: string;
  invoiceId?: string; ownerId?: string; accessToken?: string;
}): Promise<{ channel: "sms" | "email" }> =>
  stripeAction("send_payment_receipt", opts, opts.accessToken);

// ─── Recurring billing (subscriptions) ────────────────────────────────────
// Owner sets a fixed amount + cadence for one of their own customers; the
// resulting Checkout Session URL is sent to the customer (SMS/email) so
// they can enter a card once and be billed automatically going forward.
// Real Stripe subscription lifecycle events (successful renewal, failed
// charge, cancellation) are handled server-side in stripe-webhook.ts and
// written to customers.recurringPlan — never trust a client-side guess at
// whether a plan is "active".

export interface RecurringCheckoutSession { id: string; url: string }

export const createRecurringCheckoutSession = async (
  opts: {
    crmCustomerId: string; amountCents: number; interval: "day" | "week" | "month" | "year"; intervalCount?: number;
    description?: string; customerEmail?: string; successUrl: string; cancelUrl: string; ownerId?: string; accessToken?: string;
  }
): Promise<RecurringCheckoutSession> =>
  stripeAction("create_recurring_checkout_session", opts, opts.accessToken);

export const cancelRecurringSubscription = async (subscriptionId: string, ownerId?: string, accessToken?: string): Promise<void> => {
  await stripeAction("cancel_recurring_subscription", { subscriptionId, ownerId }, accessToken);
};
