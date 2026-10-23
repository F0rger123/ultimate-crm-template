import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./_lib/env";
// FEATURE — "let people sign up and pay for CRM Starter, and help me get
// paid." This is the PLATFORM's own billing (CRM Starter charging a signed-up
// business owner a subscription) — completely separate from stripe-action.ts
// (that file is per-owner, for THEIR business charging ITS OWN customers).
// Requires NEW Cloudflare Pages env vars, distinct from the existing
// STRIPE_SECRET_KEY/STRIPE_PUBLISHABLE_KEY (which stay per-owner):
//   PLATFORM_STRIPE_SECRET_KEY      — the CRM Starter platform's own Stripe secret key
//   PLATFORM_STRIPE_WEBHOOK_SECRET  — see platform-billing-webhook.ts
//   PLATFORM_STRIPE_PUBLISHABLE_KEY — safe to expose client-side (it's a "pk_"
//     key, not a secret) — enables the embedded, in-app checkout UI
//     (CheckoutPage.tsx) instead of a full redirect to Stripe's hosted page.
//     Optional: if unset, create_signup_checkout_session silently falls back
//     to the original hosted-redirect flow, so nothing breaks without it.
// Plan prices are defined server-side below (PLANS), matching
// src/components/pages/LandingPage.tsx's PLANS export — kept as the same
// numbers, not fetched from Stripe, so pricing-page copy and what's
// actually charged can never drift apart silently. Checkout uses Stripe's
// inline `price_data` (a real, fully supported recurring-price shape) so
// nothing needs to be pre-created as a Product/Price in the Stripe
// dashboard — just the one secret key.
const TRIAL_DAYS = 14;
// FEATURE — "invite a friend, both sides get a discount." Flat percent for
// both the referrer's one-time credit and the referee's first billing cycle
// — simple, symmetric, easy for an owner to explain to another owner.
const REFERRAL_DISCOUNT_PERCENT = 20;

const PLANS: Record<string, { monthly: number; annual: number }> = {
  solo: { monthly: 29, annual: 23 },
  crew: { monthly: 59, annual: 47 },
  growth: { monthly: 119, annual: 95 },
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

const stripeFetch = async (secretKey: string, method: string, path: string, params?: Record<string, string>) => {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Basic ${btoa(secretKey + ":")}`,
      ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "POST" && params ? new URLSearchParams(params).toString() : undefined,
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error((data as any)?.error?.message || `Stripe error ${res.status}`);
  return data;
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    const platformSecretKey = context.env.PLATFORM_STRIPE_SECRET_KEY;
    if (!serviceRoleKey) return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY." }, 500);
    const svcHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

    // FEATURE — "it should ask them to pay first, then create an account."
    // These two actions run BEFORE any auth check — there's no account yet
    // to authenticate as. The public pricing page hits create_signup_
    // checkout_session directly (no login required); after Stripe redirects
    // back, the signup-complete screen calls verify_signup_session to
    // confirm the payment actually went through before it lets anyone type
    // a password — never trust a query-string session_id on its own.
    if (action === "create_signup_checkout_session") {
      if (!platformSecretKey) return json({ error: "Platform billing isn't configured yet (PLATFORM_STRIPE_SECRET_KEY missing)." }, 500);
      const plan = String(body.plan || "").toLowerCase();
      const interval = body.interval === "year" ? "year" : "month";
      const priceDef = PLANS[plan];
      if (!priceDef) return json({ error: `Unknown plan "${body.plan}".` }, 400);
      // FEATURE — "make the checkout page look like a real payment flow with
      // a good-looking custom UI." Stripe's `ui_mode: "embedded"` renders the
      // same PCI-compliant Stripe iframe INSIDE our own branded page
      // (CheckoutPage.tsx) instead of a full-page redirect to
      // checkout.stripe.com — no card data ever reaches this app's servers
      // either way (still well within PCI SAQ-A). Only used when a
      // publishable key is actually configured; otherwise this silently
      // behaves exactly as before (hosted redirect via `url`), so it's a
      // pure additive upgrade, never a breaking change.
      const publishableKey = context.env.PLATFORM_STRIPE_PUBLISHABLE_KEY;
      const embedded = body.uiMode === "embedded" && !!publishableKey;
      if (embedded) {
        if (!body.returnUrl) return json({ error: "Missing returnUrl." }, 400);
      } else {
        if (!body.successUrl || !body.cancelUrl) return json({ error: "Missing successUrl/cancelUrl." }, 400);
      }
      const amountCents = Math.round((interval === "year" ? priceDef.annual : priceDef.monthly) * 100);
      const params: Record<string, string> = {
        mode: "subscription",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": `CRM Starter — ${plan[0].toUpperCase() + plan.slice(1)} (${interval === "year" ? "Annual" : "Monthly"})`,
        "line_items[0][price_data][unit_amount]": String(amountCents),
        "line_items[0][price_data][recurring][interval]": interval,
        "line_items[0][quantity]": "1",
        "metadata[plan]": plan,
        "metadata[interval]": interval,
        "subscription_data[metadata][plan]": plan,
        "subscription_data[metadata][interval]": interval,
        // Real card capture happens inside Stripe's own iframe/hosted page —
        // no card data ever reaches this app's servers (keeps this well
        // within PCI SAQ-A, the same reasoning as every other Stripe
        // Checkout use in this codebase).
        ...(embedded
          ? { ui_mode: "embedded", return_url: body.returnUrl }
          : { success_url: body.successUrl, cancel_url: body.cancelUrl }),
      };
      // FEATURE — "invite another owner, both sides get a discount." A
      // referred signup's own first-cycle discount is applied HERE, at
      // checkout (never trust a client-claimed discount after the fact); the
      // REFERRER's side is credited later in complete_signup, once we know a
      // real account+payment actually resulted from the code. The code
      // itself is only ever looked up, never trusted as "valid" without a
      // real matching platform_subscriptions row.
      const referredByCode = String(body.referredByCode || "").trim().toUpperCase();
      if (referredByCode && serviceRoleKey) {
        const refRow = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?referralCode=eq.${encodeURIComponent(referredByCode)}&select=owner_id&limit=1`, { headers: svcHeaders });
        const refRows = await refRow.json().catch(() => []);
        if (Array.isArray(refRows) && refRows[0]?.owner_id) {
          params["metadata[referredByCode]"] = referredByCode;
          try {
            const coupon = await stripeFetch(platformSecretKey, "POST", "coupons", { percent_off: String(REFERRAL_DISCOUNT_PERCENT), duration: "once" });
            params["discounts[0][coupon]"] = coupon.id;
          } catch (e: any) {
            console.warn("[PlatformBilling] referee coupon creation failed, proceeding without discount:", e?.message);
          }
        }
      }
      const session = await stripeFetch(platformSecretKey, "POST", "checkout/sessions", params);
      return embedded ? json({ clientSecret: session.client_secret, publishableKey }) : json({ url: session.url });
    }

    if (action === "verify_signup_session") {
      if (!platformSecretKey) return json({ error: "Platform billing isn't configured yet." }, 500);
      const sessionId = String(body.sessionId || "");
      if (!sessionId) return json({ error: "Missing sessionId." }, 400);
      const session = await stripeFetch(platformSecretKey, "GET", `checkout/sessions/${encodeURIComponent(sessionId)}`);
      if (session.payment_status !== "paid" && session.status !== "complete") {
        return json({ error: "Payment hasn't been confirmed yet — if you just paid, wait a moment and refresh." }, 400);
      }
      return json({
        email: session.customer_details?.email || session.customer_email || "",
        plan: session.metadata?.plan || "",
        interval: session.metadata?.interval || "month",
        stripeCustomerId: session.customer || null,
        stripeSubscriptionId: session.subscription || null,
      });
    }

    // send_trial_discount_emails — NOT owner-authenticated (no single owner
    // to authenticate as; it emails MANY owners at once), so it must live
    // here, before the ownerId auth gate below, same reasoning as
    // create_signup_checkout_session/verify_signup_session above. Gated
    // instead by a shared secret header so this can be wired to a scheduled
    // trigger (pg_cron + pg_net calling this URL monthly, or any external
    // scheduler) without being a publicly callable mass-email button.
    // Requires two new Cloudflare env vars: CRON_SECRET (shared secret, also
    // set in the pg_cron job's http_post headers) and PLATFORM_RESEND_API_KEY
    // (the platform's OWN transactional email account — separate from every
    // owner's individual Gmail connection, since this is CRM Starter emailing
    // ITS OWN trial customers, not an owner emailing theirs).
    if (action === "send_trial_discount_emails") {
      const cronSecret = context.env.CRON_SECRET;
      const providedSecret = context.request.headers.get("x-cron-secret") || "";
      if (!cronSecret || providedSecret !== cronSecret) return json({ error: "Unauthorized" }, 401);
      const resendKey = context.env.PLATFORM_RESEND_API_KEY;
      if (!resendKey) return json({ error: "PLATFORM_RESEND_API_KEY not configured — set it in the Cloudflare Pages dashboard." }, 500);
      if (!platformSecretKey) return json({ error: "Platform billing isn't configured yet." }, 500);

      const cutoff = new Date(Date.now() - 30 * 86400000).toISOString();
      // Only owners currently mid-trial who haven't been emailed this offer
      // in the last 30 days — never active/paying or already-canceled owners.
      const rowsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/platform_subscriptions?status=eq.trialing&or=(trialDiscountEmailSentAt.is.null,trialDiscountEmailSentAt.lt.${encodeURIComponent(cutoff)})&select=owner_id`,
        { headers: svcHeaders }
      );
      const rows: any[] = await rowsRes.json().catch(() => []);
      let sent = 0, skipped = 0, failed = 0;
      for (const row of Array.isArray(rows) ? rows : []) {
        try {
          const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(row.owner_id)}`, { headers: svcHeaders });
          const user = userRes.ok ? await userRes.json().catch(() => null) as any : null;
          const email = user?.email;
          if (!email) { skipped++; continue; }
          // One coupon per owner, deterministic id so a re-run of this sweep
          // (or the owner clicking the email link twice) doesn't create
          // duplicates — Stripe errors on a duplicate id, which is treated
          // as "already exists, fine" rather than a failure.
          const couponId = `TRIALOFFER-${row.owner_id}`.slice(0, 64).replace(/[^a-zA-Z0-9_-]/g, "");
          try {
            await stripeFetch(platformSecretKey, "POST", "coupons", { id: couponId, percent_off: "50", duration: "once", max_redemptions: "1" });
          } catch { /* already exists — fine, reuse it */ }
          const link = `${context.env.APP_ORIGIN || "https://app.example.com"}/#/pricing?offer=${encodeURIComponent(couponId)}`;
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: context.env.PLATFORM_RESEND_FROM || "CRM Starter <billing@example.com>",
              to: email,
              subject: "50% off your first month of CRM Starter",
              html: `<p>Hi there,</p><p>Your CRM Starter trial is still active — as a thank-you for trying it out, here's 50% off your first month if you subscribe this week.</p><p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Claim 50% off</a></p><p>This offer expires once redeemed once, so grab it whenever you're ready.</p><p>— The CRM Starter Team</p>`,
            }),
          });
          if (!emailRes.ok) { failed++; continue; }
          await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(row.owner_id)}`, {
            method: "PATCH", headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ trialDiscountEmailSentAt: new Date().toISOString() }),
          });
          sent++;
        } catch (e: any) {
          console.warn("[PlatformBilling] trial discount email failed for", row.owner_id, ":", e?.message);
          failed++;
        }
      }
      return json({ success: true, sent, skipped, failed });
    }

    const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const ownerId = await resolveCallerOwnerId(accessToken);
    if (!ownerId) return json({ error: "Not signed in." }, 401);

    // complete_signup — called once, right after a brand-new owner account
    // is created via the pay-first flow (see SignupComplete UI in App.tsx).
    // Re-verifies the Checkout Session against Stripe itself server-side
    // (never trusts the client's word that payment succeeded) and writes
    // the REAL paid subscription for this brand-new ownerId — replacing
    // the free-trial row start_trial would otherwise have created.
    if (action === "complete_signup") {
      if (!platformSecretKey) return json({ error: "Platform billing isn't configured yet." }, 500);
      const sessionId = String(body.sessionId || "");
      if (!sessionId) return json({ error: "Missing sessionId." }, 400);
      const session = await stripeFetch(platformSecretKey, "GET", `checkout/sessions/${encodeURIComponent(sessionId)}`);
      if (session.payment_status !== "paid" && session.status !== "complete") {
        return json({ error: "Payment hasn't been confirmed yet." }, 400);
      }
      const plan = String(session.metadata?.plan || "").toLowerCase();
      const interval = session.metadata?.interval === "year" ? "year" : "month";
      let subStatus = "active";
      let currentPeriodEnd: string | null = null;
      if (session.subscription) {
        const sub = await stripeFetch(platformSecretKey, "GET", `subscriptions/${encodeURIComponent(session.subscription)}`);
        subStatus = sub.status || "active";
        currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
        // SECURITY/CORRECTNESS FIX (audit finding — High) — the pay-first
        // signup flow (create_signup_checkout_session above) can't stamp
        // ownerId in subscription_data.metadata at creation time, since no
        // account exists yet at that point. platform-billing-webhook.ts's
        // customer.subscription.updated/deleted handlers key EXCLUSIVELY
        // off sub.metadata?.ownerId — without this, an owner who cancels
        // through the real Stripe Billing Portal genuinely stops being
        // billed, but platform_subscriptions.status silently never updates
        // to reflect it, so getPlanLimits keeps granting full paid-plan
        // access forever. Now THIS is the point ownerId is finally known —
        // patch it onto the live Stripe subscription right here, once,
        // right after the account is actually created.
        if (!sub.metadata?.ownerId) {
          await stripeFetch(platformSecretKey, "POST", `subscriptions/${encodeURIComponent(session.subscription)}`, { "metadata[ownerId]": ownerId }).catch(() => {
            // Non-fatal — the subscription row below still gets created/
            // updated correctly; only future webhook-driven sync would be
            // affected, and this is retried harmlessly on any later call.
          });
        }
      }
      // SECURITY FIX (audit finding) — nothing previously stopped a SECOND,
      // unrelated account from calling complete_signup with the SAME
      // sessionId (e.g. leaked via browser history on a shared computer, a
      // pasted support-ticket URL, a referrer header) and getting itself
      // marked active on the entitlement tied to someone else's real
      // payment — for free, with the real payer possibly never even
      // noticing anything looked wrong. A Stripe subscription id is unique
      // per real subscription created, so checking whether it's already
      // claimed by a DIFFERENT owner_id (before writing this owner's own
      // row) closes that off; the SAME owner retrying this call (a dropped
      // response, a page refresh) still succeeds exactly as before.
      if (session.subscription) {
        const dupCheck = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?stripe_subscription_id=eq.${encodeURIComponent(session.subscription)}&select=owner_id`, { headers: svcHeaders });
        const dupRows = await dupCheck.json().catch(() => []);
        const claimedBy = Array.isArray(dupRows) && dupRows[0]?.owner_id;
        if (claimedBy && claimedBy !== ownerId) {
          console.error("[PlatformBilling] complete_signup REJECTED — subscription", session.subscription, "already claimed by a different owner_id. Attempted by:", ownerId, "already owned by:", claimedBy);
          return json({ error: "This payment has already been used to activate a different account. If that wasn't you, contact support — no charge has been made to this account." }, 409);
        }
      }
      const existing = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=owner_id`, { headers: svcHeaders });
      const existingRows = await existing.json().catch(() => []);
      const row = {
        owner_id: ownerId, status: subStatus, plan, interval,
        stripe_customer_id: session.customer || null, stripe_subscription_id: session.subscription || null,
        current_period_end: currentPeriodEnd, trial_ends_at: null,
      };
      const isUpdate = Array.isArray(existingRows) && existingRows.length > 0;
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/platform_subscriptions${isUpdate ? `?owner_id=eq.${encodeURIComponent(ownerId)}` : ""}`,
        { method: isUpdate ? "PATCH" : "POST", headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(row) }
      );
      if (!res.ok) return json({ error: "Payment confirmed, but saving your subscription failed — " + (await res.text().catch(() => "")).slice(0, 200) }, 500);

      // FEATURE — "invite another owner, both sides get a discount." This is
      // the point a referred signup's payment is confirmed as REAL (never
      // trust the client's word) — credit the referrer now, once, via a
      // unique constraint on owner_referral_credits.referred_owner_id so a
      // retried/duplicate complete_signup call can't double-credit the same
      // referral. Applies a one-cycle percent-off coupon directly to the
      // referrer's live Stripe subscription — best-effort; a failure here
      // never blocks the new owner's own account/payment, which already
      // succeeded above.
      const referredByCode = String(session.metadata?.referredByCode || "").trim().toUpperCase();
      if (referredByCode && serviceRoleKey) {
        try {
          const refRow = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?referralCode=eq.${encodeURIComponent(referredByCode)}&select=owner_id,stripe_subscription_id&limit=1`, { headers: svcHeaders });
          const refRows = await refRow.json().catch(() => []);
          const referrer = Array.isArray(refRows) ? refRows[0] : null;
          if (referrer?.owner_id && referrer.owner_id !== ownerId) {
            const creditInsert = await fetch(`${SUPABASE_URL}/rest/v1/owner_referral_credits`, {
              method: "POST", headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
              body: JSON.stringify({
                referrer_owner_id: referrer.owner_id, referred_owner_id: ownerId, referral_code: referredByCode,
                referrer_discount_percent: REFERRAL_DISCOUNT_PERCENT, referee_discount_percent: REFERRAL_DISCOUNT_PERCENT,
              }),
            });
            // A 409/constraint failure here means this referral was already
            // credited (the unique index on referred_owner_id) — correct,
            // not an error, so the coupon below only applies on a genuine
            // first credit.
            if (creditInsert.ok && referrer.stripe_subscription_id) {
              const coupon = await stripeFetch(platformSecretKey, "POST", "coupons", { percent_off: String(REFERRAL_DISCOUNT_PERCENT), duration: "once" });
              await stripeFetch(platformSecretKey, "POST", `subscriptions/${encodeURIComponent(referrer.stripe_subscription_id)}`, { coupon: coupon.id });
            }
          }
        } catch (e: any) {
          console.warn("[PlatformBilling] referral credit failed (non-fatal):", e?.message);
        }
      }

      return json({ success: true, plan, interval, status: subStatus });
    }

    // get_my_referral_link — generates (once) and returns this owner's own
    // referral code + shareable signup link. Idempotent: an existing code is
    // never regenerated, so a link already shared/copied keeps working.
    if (action === "get_my_referral_link") {
      const existing = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=referralCode&limit=1`, { headers: svcHeaders });
      const rows = await existing.json().catch(() => []);
      let code = Array.isArray(rows) ? rows[0]?.referralCode : null;
      if (!code) {
        code = ownerId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 5).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
        const isUpdate = Array.isArray(rows) && rows.length > 0;
        const res2 = await fetch(
          `${SUPABASE_URL}/rest/v1/platform_subscriptions${isUpdate ? `?owner_id=eq.${encodeURIComponent(ownerId)}` : ""}`,
          { method: isUpdate ? "PATCH" : "POST", headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ owner_id: ownerId, referralCode: code }) }
        );
        if (!res2.ok) return json({ error: "Couldn't generate a referral code — try again." }, 500);
      }
      return json({ referralCode: code, discountPercent: REFERRAL_DISCOUNT_PERCENT });
    }

    // start_trial — called once, right after a new owner finishes signing
    // up. Idempotent: never resets an existing trial/subscription row.
    if (action === "start_trial") {
      const existing = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=owner_id`, { headers: svcHeaders });
      const existingRows = await existing.json().catch(() => []);
      if (Array.isArray(existingRows) && existingRows.length > 0) return json({ success: true, alreadyStarted: true });
      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions`, {
        method: "POST",
        headers: { ...svcHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ owner_id: ownerId, status: "trialing", trial_ends_at: trialEndsAt }),
      });
      if (!res.ok) return json({ error: "Couldn't start trial — " + (await res.text().catch(() => "")).slice(0, 200) }, 500);
      return json({ success: true, trialEndsAt });
    }

    if (action === "get_status") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=*&limit=1`, { headers: svcHeaders });
      const rows = await res.json().catch(() => []);
      return json({ subscription: Array.isArray(rows) ? rows[0] || null : null });
    }

    if (action === "create_checkout_session") {
      if (!platformSecretKey) return json({ error: "Platform billing isn't configured yet (PLATFORM_STRIPE_SECRET_KEY missing)." }, 500);
      const plan = String(body.plan || "").toLowerCase();
      const interval = body.interval === "year" ? "year" : "month";
      const priceDef = PLANS[plan];
      if (!priceDef) return json({ error: `Unknown plan "${body.plan}".` }, 400);
      const amountCents = Math.round((interval === "year" ? priceDef.annual : priceDef.monthly) * 100);

      // Reuse an existing Stripe customer for this owner if one's on file
      // (avoids creating a duplicate customer object every time they visit
      // the billing page), else let Checkout create one.
      const subRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=stripe_customer_id&limit=1`, { headers: svcHeaders });
      const subRows = await subRes.json().catch(() => []);
      const existingCustomerId = Array.isArray(subRows) ? subRows[0]?.stripe_customer_id : undefined;

      const params: Record<string, string> = {
        mode: "subscription",
        success_url: body.successUrl,
        cancel_url: body.cancelUrl,
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": `CRM Starter — ${plan[0].toUpperCase() + plan.slice(1)} (${interval === "year" ? "Annual" : "Monthly"})`,
        "line_items[0][price_data][unit_amount]": String(amountCents),
        "line_items[0][price_data][recurring][interval]": interval,
        "line_items[0][quantity]": "1",
        "metadata[ownerId]": ownerId,
        "metadata[plan]": plan,
        "metadata[interval]": interval,
        "subscription_data[metadata][ownerId]": ownerId,
        "subscription_data[metadata][plan]": plan,
        "subscription_data[metadata][interval]": interval,
      };
      if (existingCustomerId) params.customer = existingCustomerId;
      else if (body.email) params.customer_email = body.email;
      // FEATURE — "email trial users a limited-time discount." The email
      // (see send_trial_discount_emails below) links back here with a
      // ?offer=CODE the client passes through as discountCode. Verified
      // against Stripe itself before applying — never trusted blind, so a
      // stale/tampered/expired code just silently doesn't discount instead
      // of erroring the whole checkout.
      if (body.discountCode) {
        try {
          const coupon = await stripeFetch(platformSecretKey, "GET", `coupons/${encodeURIComponent(body.discountCode)}`);
          if (coupon?.valid !== false) params["discounts[0][coupon]"] = body.discountCode;
        } catch (e: any) {
          console.warn("[PlatformBilling] discountCode lookup failed, proceeding without it:", e?.message);
        }
      }
      const session = await stripeFetch(platformSecretKey, "POST", "checkout/sessions", params);
      return json({ url: session.url });
    }

    // create_portal_session — real Stripe-hosted self-service billing
    // (update card, change plan, cancel) instead of building a custom
    // cancel/upgrade UI here.
    if (action === "create_portal_session") {
      if (!platformSecretKey) return json({ error: "Platform billing isn't configured yet." }, 500);
      const subRes = await fetch(`${SUPABASE_URL}/rest/v1/platform_subscriptions?owner_id=eq.${encodeURIComponent(ownerId)}&select=stripe_customer_id&limit=1`, { headers: svcHeaders });
      const subRows = await subRes.json().catch(() => []);
      const customerId = Array.isArray(subRows) ? subRows[0]?.stripe_customer_id : undefined;
      if (!customerId) return json({ error: "No billing account on file yet — subscribe first." }, 400);
      const portal = await stripeFetch(platformSecretKey, "POST", "billing_portal/sessions", { customer: customerId, return_url: body.returnUrl });
      return json({ url: portal.url });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "Platform billing error" }, 400);
  }
};
