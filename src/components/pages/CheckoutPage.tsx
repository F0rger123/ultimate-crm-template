import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, Lock, ShieldCheck, CheckCircle, RefreshCw } from "lucide-react";
import { MarketingStyles, BackgroundBlobs } from "./MarketingShared";
import { PLANS } from "./LandingPage";
import { BrandMark } from "../ui/BrandMark";

// ─── #/checkout — branded, embedded payment page ───────────────────────────
// FEATURE — "make the checkout page look like a real payment flow for the
// CRM, with a good-looking custom UI." Previously `startPaidSignup` in
// App.tsx sent the visitor straight to a full-page redirect on
// checkout.stripe.com — functional, but nothing about it looked like part
// of CRM Starter. This page uses Stripe's `ui_mode: "embedded"` Checkout (see
// platform-billing.ts's create_signup_checkout_session): the actual card
// fields still render inside Stripe's own PCI-compliant iframe (no card
// data ever touches this app's servers — same PCI SAQ-A posture as before),
// but it's mounted INSIDE this custom-branded page instead of a redirect,
// so the plan summary, trust badges, and step progress around it are all
// ours. If PLATFORM_STRIPE_PUBLISHABLE_KEY isn't configured server-side yet,
// the server silently returns a plain `url` instead of a `clientSecret` and
// this page falls back to the original hosted-redirect flow — never a hard
// failure just because that one optional env var is missing.
export function CheckoutPage({
  plan, interval, referredByCode, onBack,
}: {
  plan: string;
  interval: "month" | "year";
  referredByCode?: string;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [mounting, setMounting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);

  const planDef = PLANS.find(p => p.name.toLowerCase() === plan.toLowerCase()) || PLANS[1];
  const price = interval === "year" ? planDef.priceAnnual : planDef.priceMonthly;

  useEffect(() => {
    let cancelled = false;
    let checkoutInstance: any = null;
    setLoading(true);
    setMounting(false);
    setError(null);

    const loadStripeJs = () =>
      new Promise<void>((resolve, reject) => {
        if ((window as any).Stripe) { resolve(); return; }
        const existing = document.querySelector('script[src="https://js.stripe.com/v3/"]');
        if (existing) {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Couldn't load Stripe.js")));
          return;
        }
        const s = document.createElement("script");
        s.src = "https://js.stripe.com/v3/";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Couldn't load Stripe.js"));
        document.head.appendChild(s);
      });

    (async () => {
      try {
        const origin = `${window.location.origin}${window.location.pathname}`;
        const res = await fetch("/api/platform-billing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_signup_checkout_session",
            plan: plan.toLowerCase(),
            interval,
            uiMode: "embedded",
            ...(referredByCode ? { referredByCode } : {}),
            returnUrl: `${origin}#/signup-complete?session_id={CHECKOUT_SESSION_ID}`,
            successUrl: `${origin}#/signup-complete?session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${origin}#/pricing`,
          }),
        });
        const data = await res.json().catch(() => null as any);
        if (cancelled) return;
        if (!res.ok || (!data?.clientSecret && !data?.url)) {
          setError(data?.error || `Couldn't start checkout (server returned ${res.status}) — try again or contact support.`);
          setLoading(false);
          return;
        }
        // Graceful fallback — embedded checkout isn't configured server-side
        // (PLATFORM_STRIPE_PUBLISHABLE_KEY missing), so the server already
        // built a normal hosted session instead. Use it exactly as before.
        if (!data.clientSecret && data.url) {
          window.location.href = data.url;
          return;
        }
        await loadStripeJs();
        if (cancelled) return;
        const stripe = (window as any).Stripe(data.publishableKey);
        checkoutInstance = await stripe.initEmbeddedCheckout({ clientSecret: data.clientSecret });
        if (cancelled) { checkoutInstance.destroy(); return; }
        setLoading(false);
        setMounting(true);
        requestAnimationFrame(() => {
          if (mountRef.current && !cancelled) checkoutInstance.mount(mountRef.current);
        });
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || "Couldn't load checkout — try again."); setLoading(false); }
      }
    })();

    return () => {
      cancelled = true;
      if (checkoutInstance) { try { checkoutInstance.destroy(); } catch {} }
    };
  }, [plan, interval, referredByCode, attempt]);

  return (
    <div className="h-dvh h-screen overflow-y-auto bg-black text-white overflow-x-hidden isolate">
      <MarketingStyles />
      <BackgroundBlobs />
      <style>{`
        @keyframes co-step-in { 0% { opacity: 0; transform: translateY(16px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .co-panel { animation: co-step-in 0.4s cubic-bezier(0.16,1,0.3,1); }
        @keyframes co-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .co-shimmer { background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 37%, rgba(255,255,255,0.04) 63%); background-size: 200% 100%; animation: co-shimmer 1.4s ease-in-out infinite; }
      `}</style>

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition">
            <ChevronLeft size={16} /> Back to plans
          </button>
          <div className="flex items-center gap-2">
            <BrandMark className="w-6 h-6" />
            <span className="font-bold text-sm tracking-tight">CRM <span className="text-brand-500">Starter</span></span>
          </div>
        </div>

        {/* Step progress — same visual language as the onboarding wizard
            (OnboardingFlow.tsx), so the funnel reads as one continuous,
            polished flow instead of switching styles mid-signup. */}
        <div className="max-w-md mx-auto mb-10">
          <div className="relative flex items-center justify-between">
            <div className="absolute left-3.5 right-3.5 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 -z-0" />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 h-0.5 bg-brand-600 -z-0 text-brand-fg" style={{ width: "50%" }} />
            {["Plan", "Payment", "Account"].map((label, i) => (
              <div key={label} className="relative z-10 flex flex-col items-center gap-1.5">
                <div className={"w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold " + (i === 0 ? "bg-green-700 text-white" : i === 1 ? "bg-brand-600 text-brand-fg" : "bg-white/10 text-white/30")}>
                  {i === 0 ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className={"text-[11px] " + (i <= 1 ? "text-white/60" : "text-white/25")}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="co-panel grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8 items-start">
          {/* ── Order summary ─────────────────────────────────────────────── */}
          <div className="md:col-span-2 glass rounded-2xl p-6 md:p-7 order-2 md:order-1">
            <div className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-1">You're subscribing to</div>
            <div className="text-2xl font-black mb-1">{planDef.name}</div>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-3xl font-black">${price}</span>
              <span className="text-white/40 text-sm mb-1">/mo, billed {interval === "year" ? "annually" : "monthly"}</span>
            </div>
            {interval === "year" && (
              <div className="text-xs text-green-400 mb-3">${price * 12}/yr — 20% less than monthly billing</div>
            )}
            <p className="text-white/45 text-sm mb-5">{planDef.tagline}</p>
            <div className="h-px bg-white/10 mb-5" />
            <ul className="space-y-2.5 mb-6">
              {planDef.features.map((feat, i) => (
                <li
                  key={feat}
                  className="flex items-start gap-2 text-sm text-white/70 co-panel"
                  style={{ animationDelay: `${80 + i * 60}ms`, animationFillMode: "backwards" }}
                >
                  <CheckCircle size={15} className="text-brand-500 mt-0.5 flex-shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
            {referredByCode && (
              <div className="mb-5 p-3 rounded-xl bg-green-950/30 border border-green-700/40 text-xs text-green-300">
                Referral code <span className="font-mono font-semibold">{referredByCode}</span> applied — 20% off your first billing cycle.
              </div>
            )}
            <div className="space-y-2 text-xs text-white/40">
              <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-white/30" /> Payments secured &amp; processed by Stripe</div>
              <div className="flex items-center gap-2"><Lock size={14} className="text-white/30" /> Your card details never touch CRM Starter servers</div>
              <div className="flex items-center gap-2"><CheckCircle size={14} className="text-white/30" /> Cancel anytime, no long-term contract</div>
            </div>
          </div>

          {/* ── Payment ────────────────────────────────────────────────────── */}
          <div className="md:col-span-3 order-1 md:order-2">
            <div className="bg-white rounded-2xl p-1 min-h-[420px] shadow-2xl shadow-black/40 overflow-hidden">
              {error ? (
                <div className="min-h-[420px] flex flex-col items-center justify-center gap-4 p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-600 font-bold text-lg">!</div>
                  <div className="text-gray-900 font-semibold text-sm max-w-xs">{error}</div>
                  <button
                    onClick={() => setAttempt(a => a + 1)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition"
                  >
                    <RefreshCw size={14} /> Try again
                  </button>
                </div>
              ) : loading ? (
                <div className="p-6 space-y-3">
                  <div className="co-shimmer h-9 rounded-lg" />
                  <div className="co-shimmer h-9 rounded-lg" />
                  <div className="flex gap-3">
                    <div className="co-shimmer h-9 rounded-lg flex-1" />
                    <div className="co-shimmer h-9 rounded-lg flex-1" />
                  </div>
                  <div className="co-shimmer h-11 rounded-lg mt-4" />
                  <div className="text-center text-xs text-gray-400 pt-2">Loading secure payment form…</div>
                </div>
              ) : null}
              <div ref={mountRef} className={error || loading ? "hidden" : "min-h-[420px]"} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
