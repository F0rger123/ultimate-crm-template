// ─── Square Web Payments SDK loader ────────────────────────────────────────────
// Mirrors lib/stripe.ts's loadStripeJs exactly — same lazy-singleton-promise
// pattern, same "load the real vendor SDK once, reuse it" shape. Square's
// access token/location id never reach the browser; everything server-side
// goes through functions/api/square-action.ts (same-origin proxy, same
// reasoning as stripe-action.ts's own security-audit comment).

// Square Web Payments SDK host follows VITE_SQUARE_ENVIRONMENT (sandbox |
// production, default production) — must match the server-side SQUARE_ENVIRONMENT. One real charge
// path, not a test one that silently doesn't move money.
let squareSdkPromise: Promise<any> | null = null;

export const loadSquareJs = (): Promise<any> => {
  if (!squareSdkPromise) {
    squareSdkPromise = new Promise((resolve, reject) => {
      if ((window as any).Square) { resolve((window as any).Square); return; }
      const script = document.createElement("script");
      script.src = (import.meta.env.VITE_SQUARE_ENVIRONMENT === "sandbox") ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js";
      script.onload = () => resolve((window as any).Square);
      script.onerror = () => reject(new Error("Failed to load Square Web Payments SDK"));
      document.head.appendChild(script);
    });
  }
  return squareSdkPromise;
};

// BUG FIX — "I pressed Save and it just says stuck at saving." This (and the
// two owner-Settings calls below) used a bare fetch() with NO timeout at
// all, unlike stripeAction's own 20s AbortController — a hung Cloudflare
// Function request (cold start, dropped connection) meant this promise
// simply never resolved OR rejected, so the calling button's `finally`
// never ran and it was stuck on "Saving…" forever with no way out short of
// reloading the page. Every call in this file now goes through one fetch
// helper with a real timeout, matching stripeAction's treatment exactly.
const fetchWithTimeout = async (url: string, init: RequestInit, ms = 20000): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("Square request timed out — check your connection and try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
};

const squareAction = async (action: string, body: Record<string, unknown>): Promise<any> => {
  let authHeader: string | undefined;
  try {
    const { supabase } = await import("./supabase");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) authHeader = `Bearer ${session.access_token}`;
  } catch { /* anonymous customer — no session, fine for public actions */ }
  const res = await fetchWithTimeout("/api/square-action", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(authHeader ? { Authorization: authHeader } : {}) },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok || data?.error) throw new Error(data?.error || `Square error ${res.status}`);
  return data;
};

export interface SquarePublicConfig {
  connected: boolean;
  applicationId?: string;
  locationId?: string;
  mode?: "sandbox" | "production";
}

// Public — safe for an anonymous customer page to call (no secret involved,
// same trust level as fetching a Stripe publishable key).
export const getPublicSquareConfig = (ownerId: string): Promise<SquarePublicConfig> =>
  squareAction("get_public_square_config", { ownerId });

export const createSquarePayment = (opts: { sourceId: string; invoiceId?: string; amountCents?: number; tipCents?: number; description?: string; ownerId?: string; payType?: string; promoId?: string; referrerId?: string }): Promise<{ id: string; status: string }> =>
  squareAction("create_payment", opts);

// amountCents omitted = full refund (server looks up the real original
// amount itself); passed = a real partial refund of exactly that amount.
// Owner-authenticated call — squareAction attaches the current Supabase
// session token automatically when one exists.
export const refundSquarePayment = (paymentId: string, amountCents?: number, invoiceId?: string): Promise<{ id: string; amount: number; status: string }> =>
  squareAction("refund_payment", { paymentId, amountCents, invoiceId });

// AUDIT FIX — server-verified "mark this invoice paid" for Square, callable
// from an unauthenticated/customer session where a direct Supabase write
// would silently match 0 rows under owner_id-scoped RLS. Mirrors
// confirmInvoicePayment in lib/stripe.ts.
export const confirmSquareInvoicePayment = async (invoiceId: string, paymentId: string): Promise<void> => {
  const result = await squareAction("confirm_invoice_payment", { invoiceId, paymentId });
  if (result?.error) throw new Error(result.error);
};

// Owner-authenticated Settings actions.
export const getOwnerSquareStatus = (accessToken: string) =>
  fetchWithTimeout("/api/square-action", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "get_owner_square_status" }),
  }).then(r => r.json());

export const saveOwnerSquareKeys = (accessToken: string, opts: { squareAccessToken?: string; squareLocationId?: string; squareApplicationId?: string; squareWebhookSignatureKey?: string; mode?: "sandbox" | "production" }) =>
  fetchWithTimeout("/api/square-action", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: "save_owner_square_keys", ...opts }),
  }).then(r => r.json());

// ─── Recurring billing (Square Subscriptions) ─────────────────────────────
// Square has no hosted-checkout-link equivalent for subscriptions the way
// Stripe does — a Customer + Card must be created server-side from a
// tokenized sourceId, which means the owner taps/swipes the card in person
// through SquareRecurringSetupModal.tsx (mirrors SquarePaymentModal.tsx's
// existing one-time tokenize flow).
export const createSquareRecurringPlan = (opts: {
  sourceId: string; crmCustomerId: string; amountCents: number; cadence: "WEEKLY" | "MONTHLY" | "ANNUAL";
  description?: string; customerEmail?: string; customerName?: string;
}): Promise<{ success: boolean; subscriptionId: string; status: string }> =>
  squareAction("create_square_recurring_plan", opts);

export const cancelSquareRecurringPlan = (subscriptionId: string): Promise<{ success: boolean; status: string }> =>
  squareAction("cancel_square_recurring_plan", { subscriptionId });
