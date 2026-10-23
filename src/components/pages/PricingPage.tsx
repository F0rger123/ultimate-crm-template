import React, { useState } from "react";
import { CheckCircle, ChevronRight, Minus, ChevronDown } from "lucide-react";
import {
  Reveal, MarketingStyles, BackgroundBlobs, MarketingNav, MarketingFooter,
  MarketingPageHeader, MarketingFinalCta, MarketingPage, useDocumentMeta,
} from "./MarketingShared";
import { PLANS } from "./LandingPage";

// ─── #/pricing — dedicated pricing page ────────────────────────────────────
// Expands on the 3-tier pricing already shown (condensed) on LandingPage.tsx
// (imported from there as PLANS, so the numbers/tiers stay a single source
// of truth instead of drifting between the two pages) with a full feature-
// comparison table and a billing FAQ.
//
// This IS wired to a real billing system — each plan button starts a real
// Stripe Checkout session (see onChoosePlan/App.tsx's startPaidSignup), and
// the seat/customer limits described in COMPARISON_ROWS/FAQS below are the
// same ones actually enforced by lib/planLimits.ts (see CustomersPage.tsx/
// EmployeesPage.tsx's upgrade-prompt gating) — keep this content and that
// file's numbers in sync if either ever changes.

const COMPARISON_ROWS: Array<{ label: string; solo: boolean | string; crew: boolean | string; growth: boolean | string }> = [
  { label: "Unlimited jobs & customers", solo: true, crew: true, growth: true },
  { label: "Estimates, invoices & e-signature", solo: true, crew: true, growth: true },
  { label: "Stripe payments (deposits, full pay, in-person)", solo: true, crew: true, growth: true },
  { label: "Client portal", solo: true, crew: true, growth: true },
  { label: "SMS & email follow-ups (OTW, Running Late, reviews)", solo: true, crew: true, growth: true },
  { label: "User seats", solo: "1", crew: "Unlimited", growth: "Unlimited" },
  { label: "Mobile field portal (GPS, checklists, photos)", solo: false, crew: true, growth: true },
  { label: "Live crew tracking dashboard", solo: false, crew: true, growth: true },
  { label: "Alfred AI assistant (app + SMS)", solo: false, crew: true, growth: true },
  { label: "Referral & review automation", solo: false, crew: true, growth: true },
  { label: "Route optimization", solo: false, crew: false, growth: true },
  { label: "Campaign blasts & segment targeting", solo: false, crew: false, growth: true },
  { label: "Priority support & custom onboarding", solo: false, crew: false, growth: true },
];

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Is there a free trial?",
    a: "Yes — you can set up your business and explore CRM Starter without a credit card. You'll only be asked to pick a plan once you're ready to keep using it day to day.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes, anytime. Move up when you hire your first crew member, or down if your team shrinks — changes take effect on your next billing cycle, no penalty either direction.",
  },
  {
    q: "What happens if I add more crew than my plan includes?",
    a: "Solo is built for a single user seat (you). Crew and Growth both include unlimited crew/employee seats, so hiring doesn't mean a per-seat bill — just move up a tier once you're no longer a one-person operation.",
  },
  {
    q: "Do you charge extra for SMS or payment processing?",
    a: "SMS and email follow-ups are included in every plan. Payment processing runs through Stripe, which takes its own standard per-transaction processing fee — CRM Starter doesn't add a markup on top.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There's no long-term contract — cancel whenever you want and you won't be billed again for the next cycle.",
  },
  {
    q: "Is my data still mine if I cancel?",
    a: "Yes — your jobs, customers, and invoice history are yours. Reach out before canceling if you'd like an export.",
  },
];

function CompareCell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle size={17} className="text-brand-500 mx-auto" />;
  if (value === false) return <Minus size={15} className="text-white/20 mx-auto" />;
  return <span className="text-white/70 text-xs md:text-sm font-medium">{value}</span>;
}

// BUG FIX — "compare cost page doesn't fit the screen on mobile." The table
// below has min-w-[520px] inside an overflow-x-auto wrapper, so it never
// actually broke the page layout, but on a real phone (~350-390px viewport)
// it forced a horizontal scroll just to read a 3-column comparison — reads
// as "broken" even though nothing overflowed the page itself. Below md,
// swap the table for a stacked per-plan accordion that needs no horizontal
// scrolling at all; the full table still renders unchanged at md+.
function MobileCompareCard({ planName, planKey, highlighted }: { planName: string; planKey: "solo" | "crew" | "growth"; highlighted?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={"glass rounded-xl overflow-hidden " + (highlighted ? "border border-brand-600/40" : "")}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left">
        <span className={"font-semibold text-sm " + (highlighted ? "text-brand-400" : "text-white")}>{planName}</span>
        <ChevronDown size={16} className={"text-white/40 flex-shrink-0 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 animate-fade-in">
          {COMPARISON_ROWS.map(row => (
            <div key={row.label} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-white/5 last:border-0">
              {/* BUG FIX (mobile) — no min-w-0 on a flex child lets long
                  labels ("SMS & email follow-ups (OTW, Running Late,
                  reviews)") force this row wider than the phone screen
                  instead of wrapping, cutting the row off / forcing
                  horizontal scroll on narrow devices. */}
              <span className="text-white/60 flex-1 min-w-0">{row.label}</span>
              <span className="flex-shrink-0"><CompareCell value={row[planKey]} /></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4 md:px-6 md:py-5"
      >
        <span className="font-semibold text-sm md:text-base text-white">{q}</span>
        <ChevronDown size={18} className={"text-white/40 flex-shrink-0 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="px-5 pb-5 md:px-6 md:pb-6 -mt-1 text-white/55 text-sm leading-relaxed animate-fade-in">
          {a}
        </div>
      )}
    </div>
  );
}

export function PricingPage({
  onGetStarted,
  onNavigate,
  onChoosePlan,
  choosingPlan = false,
  isLoggedIn = false,
  onGoToDashboard,
  onRoadmap,
}: {
  onGetStarted: () => void;
  onNavigate: (page: MarketingPage) => void;
  // FEATURE — "it should ask them to pay first, then create an account."
  // Starts a real Stripe Checkout for the clicked plan before any account
  // exists — see App.tsx's startPaidSignup / pendingCheckoutSession.
  onChoosePlan?: (plan: string, interval: "month" | "year") => void;
  choosingPlan?: boolean;
  isLoggedIn?: boolean;
  onGoToDashboard?: () => void;
  onRoadmap?: () => void;
}) {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  useDocumentMeta(
    "Pricing — Service CRM Plans From $23/mo | CRM Starter",
    "CRM Starter pricing for field-service businesses: Solo for an owner-operator, Crew for a business running a real team (includes the Alfred AI assistant and live crew tracking), and Growth for multi-crew operations. No credit card required to start."
  );
  return (
    // BUG FIX — see the identical fix + comment in LandingPage.tsx: this
    // div must be the scrolling pane itself since html/body/#root are
    // locked to overflow:hidden app-wide.
    <div className="h-dvh h-screen overflow-y-auto bg-black text-white overflow-x-hidden isolate">
      <MarketingStyles />
      <BackgroundBlobs />
      <MarketingNav active="pricing" onNavigate={onNavigate} onGetStarted={onGetStarted} isLoggedIn={isLoggedIn} onGoToDashboard={onGoToDashboard} onRoadmap={onRoadmap} />

      <MarketingPageHeader
        eyebrow="Simple, honest pricing"
        title={<>Pick the plan that matches <span className="lp-hero-gradient">your crew size</span></>}
        subtitle="No per-feature upsells, no surprise fees. Switch tiers anytime as your business grows."
      />

      {/* ── Pricing cards ─────────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-10 md:py-14 max-w-6xl mx-auto">
        <div className="flex items-center justify-center gap-3 mb-8">
          <button onClick={() => setBilling("monthly")} className={"px-4 py-2 rounded-xl text-sm font-semibold transition " + (billing === "monthly" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70")}>Monthly</button>
          <button onClick={() => setBilling("annual")} className={"px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 " + (billing === "annual" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70")}>
            Annual
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/40 border border-green-600/40 text-green-300 font-bold">Save 20%</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 100}>
              <div
                className={
                  "lp-card-hover h-full flex flex-col p-6 md:p-7 rounded-2xl border relative overflow-hidden " +
                  (plan.highlighted
                    ? "bg-gradient-to-b from-brand-950/60 to-black border-brand-600/60 shadow-xl shadow-brand-900/30 md:-translate-y-2"
                    : "glass")
                }
              >
                {plan.highlighted && (
                  <div className="absolute top-0 right-0 bg-brand-600 text-[10px] font-bold px-3 py-1 rounded-bl-lg tracking-wide text-brand-fg">
                    MOST POPULAR
                  </div>
                )}
                <div className="text-sm font-semibold text-white/70 mb-1">{plan.name}</div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-3xl md:text-4xl font-black">${billing === "annual" ? plan.priceAnnual : plan.priceMonthly}</span>
                  <span className="text-white/40 text-sm mb-1">/mo</span>
                </div>
                {billing === "annual" && (
                  <div className="text-[11px] text-green-400 mb-1">Billed ${plan.priceAnnual * 12}/yr — vs ${plan.priceMonthly * 12}/yr monthly</div>
                )}
                <p className="text-white/45 text-xs md:text-sm mb-6 mt-1">{plan.tagline}</p>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2 text-xs md:text-sm text-white/70">
                      <CheckCircle size={15} className="text-brand-500 mt-0.5 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => onChoosePlan ? onChoosePlan(plan.name.toLowerCase(), billing === "annual" ? "year" : "month") : onGetStarted()}
                  disabled={choosingPlan}
                  className={
                    "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 " +
                    (plan.highlighted
                      ? "bg-brand-600 hover:from-brand-500 hover:to-brand-700 shadow-lg shadow-brand-900/30 hover:-translate-y-0.5 text-brand-fg"
                      : "bg-white/5 hover:bg-white/10 border border-white/10")
                  }
                >
                  {choosingPlan ? "Redirecting to checkout…" : <>Get Started<ChevronRight size={15} /></>}
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-10 md:py-16 max-w-5xl mx-auto">
        <Reveal className="text-center mb-10 md:mb-12">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            Compare <span className="gradient-text">every plan</span>
          </h2>
          <p className="text-white/50 max-w-xl mx-auto text-sm md:text-base">
            Exactly what's included, tier by tier.
          </p>
        </Reveal>

        <Reveal>
          {/* md+ — full side-by-side table */}
          <div className="hidden md:block glass rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left font-semibold text-white/70 px-4 md:px-6 py-4">Feature</th>
                  {PLANS.map(p => (
                    <th key={p.name} className={"text-center font-semibold px-3 py-4 " + (p.highlighted ? "text-brand-400" : "text-white/70")}>
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? "bg-white/[0.02]" : ""}>
                    <td className="px-4 md:px-6 py-3.5 text-white/70 text-xs md:text-sm">{row.label}</td>
                    <td className="text-center px-3 py-3.5"><CompareCell value={row.solo} /></td>
                    <td className="text-center px-3 py-3.5"><CompareCell value={row.crew} /></td>
                    <td className="text-center px-3 py-3.5"><CompareCell value={row.growth} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Below md — stacked accordion, no horizontal scroll needed */}
          <div className="md:hidden space-y-3">
            {PLANS.map(p => (
              <MobileCompareCard key={p.name} planName={p.name} planKey={p.name.toLowerCase() as "solo" | "crew" | "growth"} highlighted={p.highlighted} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-10 md:py-16 max-w-3xl mx-auto">
        <Reveal className="text-center mb-10 md:mb-12">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            Billing <span className="gradient-text">questions</span>
          </h2>
          <p className="text-white/50 max-w-xl mx-auto text-sm md:text-base">
            Everything else you'd want to know before signing up.
          </p>
        </Reveal>

        <div className="space-y-3">
          {FAQS.map((f, i) => (
            <Reveal key={f.q} delay={i * 60}>
              <FaqItem q={f.q} a={f.a} />
            </Reveal>
          ))}
        </div>
      </section>

      <MarketingFinalCta
        onGetStarted={onGetStarted}
        heading="Ready to pick a plan and get running?"
        body="Set up your business in minutes — no spreadsheets, no sticky notes, no more guessing who's on which job."
      />

      <MarketingFooter onNavigate={onNavigate} onGetStarted={onGetStarted} />
    </div>
  );
}
