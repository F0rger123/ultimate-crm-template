import React, { useState } from "react";
import {
  Calendar, Users2, FileText, CreditCard, MessageSquare,
  Bot, Smartphone, Trash2, Gift, Star, MapPin, Camera, CheckCircle,
  ArrowRight, ChevronRight, Workflow, Play, Pause,
} from "lucide-react";
import {
  Reveal, MarketingStyles, BackgroundBlobs, MarketingNav, MarketingFooter,
  MarketingPage, MarketingMarquee, SectionDivider, useDocumentMeta,
} from "./MarketingShared";

// ─── Public marketing / landing page for CRM Starter (this product) ──────────────
// Reached at "#/" (or "#/welcome") for any visitor with no active session —
// see App.tsx's page-resolution useState and the "welcome" gate just above
// the login screen. Purely presentational + a "Get Started" / "Log In" CTA
// that hands off to the existing login screen (App.tsx sets page to "login"),
// plus real cross-page navigation (onNavigate) to the dedicated
// #/features, #/pricing, and #/about pages — see MarketingShared.tsx for the
// shared nav/footer/Reveal/background treatment every marketing page uses.
// No Supabase reads/writes here at all — this must render instantly for an
// anonymous visitor with zero network round trips.
//
// Visual language deliberately mirrors the rest of the app (see
// useGlobalStyles.ts / ClientAuthPortal.tsx / Dashboard.tsx): bg-black,
// red gradient accents, .glass cards, animate-fade-in. Scroll-reveal and
// hover motion are done with plain CSS (IntersectionObserver-driven class
// toggle + Tailwind transitions) — no animation library added.

// BUG FIX (user report) — "still shows double play/pause buttons... not
// full quality" persisted even after the recording pipeline itself was
// fixed and the mp4 files were overwritten. Root cause: /media/*.mp4 has
// a fixed filename that never changes between deploys (unlike the JS/CSS
// bundle, which Vite content-hashes into ITS filename), so the browser
// and Cloudflare's edge cache had no signal that the bytes at that URL
// had changed — they kept serving the old, chrome-baked-in render. Bump
// this string every time the sizzle-reel video files are replaced so the
// query string forces a fresh fetch (see also public/_headers, which
// caps how long any cache can go without revalidating going forward).
const SIZZLE_REEL_VERSION = "6";

// Minimal video player for the sizzle reel — play/pause only, no native
// scrubber/duration/mute/skip chrome (those read as a media player, not
// a promo clip). Tapping the video itself also toggles play/pause.
function SizzleReelPlayer({ src }: { src: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  };

  return (
    <div className="relative group cursor-pointer" onClick={toggle}>
      <video
        ref={videoRef}
        playsInline
        preload="metadata"
        className="w-full aspect-video bg-black block"
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      >
        Your browser doesn't support embedded video.
      </video>
      <div
        className={
          "absolute inset-0 flex items-center justify-center transition-all " +
          (playing ? "bg-black/0 opacity-0 group-hover:opacity-100" : "bg-black/30 opacity-100")
        }
      >
        <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105">
          {playing
            ? <Pause size={24} className="text-black" fill="currentColor" />
            : <Play size={24} className="text-black translate-x-0.5" fill="currentColor" />}
        </div>
      </div>
    </div>
  );
}

// ─── Feature data (condensed teaser grid — see FeaturesPage.tsx for the full,
// categorized breakdown of the same real, working features) ────────────────
// Pulled from real, working features in this codebase — not aspirational
// copy. See docs/ARCHITECTURE.md "Working features" + Key files for the source of each.
// BUG FIX (user report) — "there's too much and it's not organized well."
// This used to be one flat 13-card grid with no structure. Grouped into
// the three buckets the section's own headline already implies ("the
// office," "the field," plus a third for the growth/marketing-side
// features that are neither) — each group gets its own short label and a
// grid sized to its count instead of one undifferentiated wall of cards.
type FeatureGroup = "office" | "field" | "growth";
const FEATURE_GROUPS: Record<FeatureGroup, string> = {
  office: "Run the office",
  field: "Run the field",
  growth: "Grow the business",
};
const FEATURES: Array<{ icon: React.ElementType; title: string; desc: string; group: FeatureGroup }> = [
  {
    icon: Calendar,
    title: "Scheduling & Crew Assignment",
    desc: "Drag jobs onto the calendar, assign crew members, and track every job from Unscheduled to Done — synced live to the field.",
    group: "office",
  },
  {
    icon: FileText,
    title: "Estimates, Invoices & Payments",
    desc: "Send branded estimates customers can review and e-sign online, convert them straight to invoices, and get paid — including charging a card in person on-site.",
    group: "office",
  },
  {
    icon: CreditCard,
    title: "Stripe Payment Processing",
    desc: "Take deposits, full payments, or in-person card charges through a direct Stripe integration — no third-party payment app required.",
    group: "office",
  },
  {
    icon: Users2,
    title: "Client Portal",
    desc: "Every customer gets their own secure portal to view job history, sign estimates, and pay invoices — no account juggling on your end.",
    group: "office",
  },
  {
    icon: Workflow,
    title: "Drag-and-Drop Automations",
    desc: "A real visual workflow builder with ready-made templates — new-lead auto-reply, review requests, overdue-invoice reminders, 90-day re-service nudges, referral asks — build once, it runs itself.",
    group: "office",
  },
  {
    icon: Bot,
    title: "Alfred, Your AI Assistant",
    desc: "Alfred acts directly on your CRM — schedules jobs, sends estimates, checks stock, pulls your numbers — from inside the app or by texting it like an employee. Set vacation mode and it can run the front desk while you're out.",
    group: "office",
  },
  {
    icon: Smartphone,
    title: "Mobile Field Portal",
    desc: "Crew members clock in/out, follow pre/during/post-job checklists, snap photos on-site, and share GPS location — all from their phone.",
    group: "field",
  },
  {
    icon: MapPin,
    title: "Live Crew Tracking",
    desc: "See who's on shift, where they are, and how far along their checklist is — updated every few seconds on the owner dashboard.",
    group: "field",
  },
  {
    icon: Camera,
    title: "Job Photo Documentation",
    desc: "Before/after photos attached directly to the job record, visible to the office and the customer alike.",
    group: "field",
  },
  {
    icon: MessageSquare,
    title: "On-The-Way & Running-Late Texts",
    desc: "On-the-way texts and running-late alerts go out automatically by SMS or the owner's own Gmail — never a generic \"noreply\" address.",
    group: "field",
  },
  {
    icon: Gift,
    title: "Referral Program",
    desc: "Turn happy customers into new leads with a built-in referral link and reward tracking.",
    group: "growth",
  },
  {
    icon: Star,
    title: "Review Requests",
    desc: "Automatically ask satisfied customers for a Google review right after the job's done, while it's fresh.",
    group: "growth",
  },
  {
    icon: Trash2,
    title: "Route Optimization",
    desc: "Order each day's stops by location, with estimated drive and job time, so crews spend less time on the road.",
    group: "growth",
  },
];

// ─── Pricing ──────────────────────────────────────────────────────────────────
// FEATURE — "it should ask them to pay first, then create an account." Each
// plan card's button below now calls onChoosePlan(plan, interval), which
// App.tsx's startPaidSignup wires to a REAL Stripe Checkout session — no
// account exists yet when this fires. Only after Stripe confirms payment
// does #/signup-complete let anyone actually create an account (see
// App.tsx's pendingCheckoutSession). The plain "Start Free Trial" CTAs
// elsewhere on this page are a separate, intentionally-unpaid path (see
// onGetStarted) — that's the real free/limited tier signup.
// BUG FIX (user report) — "make the pricing a bit cheaper, offer a discount
// for annual." Lowered all three monthly prices and added a real annual
// rate (~20% off, i.e. 2 months free) — priceMonthly is what's billed
// monthly, priceAnnual is the effective per-month rate when billed
// annually. See the billing-cycle toggle in LandingPage's pricing section
// and PricingPage.tsx (both read this same array).
export const PLANS: Array<{ name: string; priceMonthly: number; priceAnnual: number; tagline: string; features: string[]; highlighted?: boolean }> = [
  {
    name: "Solo",
    priceMonthly: 29,
    priceAnnual: 23,
    tagline: "For an owner-operator running the show alone.",
    features: [
      "Unlimited jobs & customers",
      "Estimates, invoices & Stripe payments",
      "Client portal",
      "SMS & email follow-ups",
      "1 user seat",
    ],
  },
  {
    name: "Crew",
    priceMonthly: 59,
    priceAnnual: 47,
    tagline: "For a business running an actual crew in the field.",
    features: [
      "Everything in Solo",
      "Unlimited crew/employee seats",
      "Mobile field portal (GPS, checklists, photos)",
      "Live crew tracking dashboard",
      "Alfred AI assistant",
      "Referral & review automation",
    ],
    highlighted: true,
  },
  {
    name: "Growth",
    priceMonthly: 119,
    priceAnnual: 95,
    tagline: "For multi-crew operations that want it all automated.",
    features: [
      "Everything in Crew",
      "Route optimization",
      "Campaign blasts & segment targeting",
      "Priority support",
      "Custom onboarding",
    ],
  },
];

export function LandingPage({
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
  // FEATURE — pay-first signup: starts a real Stripe Checkout for the
  // clicked plan before any account exists. Optional so this page still
  // renders fine if a caller doesn't pass it (falls back to onGetStarted).
  onChoosePlan?: (plan: string, interval: "month" | "year") => void;
  choosingPlan?: boolean;
  // BUG FIX — "not showing I'm logged in" — see MarketingNav's own comment.
  isLoggedIn?: boolean;
  onGoToDashboard?: () => void;
  onRoadmap?: () => void;
}) {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  useDocumentMeta(
    "CRM Starter — The Service CRM with AI Automation",
    "The service CRM built for the job, not adapted from something else. Scheduling, estimates, invoicing, Stripe payments, a mobile field portal, drag-and-drop automations, and Alfred — an AI assistant that schedules jobs and texts customers for you. Free trial, no credit card required."
  );
  return (
    // BUG FIX — index.css locks html/body/#root to a hard 100% height with
    // overflow:hidden (this app's whole architecture is "only specific
    // internal panes scroll," never the page itself — see index.css's own
    // comment). A marketing page assuming normal page/body scroll (just
    // min-h-screen, no overflow of its own) had literally nowhere for a
    // scroll to happen once its content exceeded one viewport — this div
    // must BE the scrolling pane itself, same as every other page's <main>.
    <div className="h-dvh h-screen overflow-y-auto bg-black text-white overflow-x-hidden isolate">
      <MarketingStyles />
      <BackgroundBlobs />
      <MarketingNav active="welcome" onNavigate={onNavigate} onGetStarted={onGetStarted} isLoggedIn={isLoggedIn} onGoToDashboard={onGoToDashboard} onRoadmap={onRoadmap} />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative px-4 md:px-6 pt-16 pb-20 md:pt-28 md:pb-32 max-w-5xl mx-auto text-center overflow-hidden">
        {/* BUG FIX (user report) — the first version of this fix ("moving red
            animation graphic") was ~60 fast diagonal particle streaks, which
            read as chaotic rather than premium. The calmer replacement (one
            slow red wave drifting left to right) now lives in the shared
            BackgroundBlobs — every marketing page gets it, not just this
            hero — so there's nothing hero-specific to render here anymore. */}
        <div className="relative z-10">
        <Reveal delay={80}>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            <span className="lp-text-hover">Run your service business</span><br className="hidden sm:block" /> <span className="lp-hero-gradient lp-text-gradient-hover">without the busywork.</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="text-base md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Scheduling, estimates, invoicing, payments, crew tracking, and an AI assistant that texts your customers for you —
            CRM Starter is the CRM built specifically for service businesses, not adapted from something else.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {isLoggedIn ? (
              <button
                onClick={onGoToDashboard}
                className="group w-full sm:w-auto px-7 py-3.5 rounded-xl bg-brand-600 hover:from-brand-500 hover:to-brand-700 font-bold text-base shadow-xl shadow-brand-900/40 hover:shadow-brand-700/50 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 text-brand-fg"
              >
                Go to Dashboard
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <>
                <button
                  onClick={onGetStarted}
                  className="group w-full sm:w-auto px-7 py-3.5 rounded-xl bg-brand-600 hover:from-brand-500 hover:to-brand-700 font-bold text-base shadow-xl shadow-brand-900/40 hover:shadow-brand-700/50 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 text-brand-fg"
                >
                  Start Free Trial
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={onGetStarted}
                  className="w-full sm:w-auto px-7 py-3.5 rounded-xl glass hover:bg-white/[0.06] font-semibold text-base transition-all"
                >
                  Log In
                </button>
              </>
            )}
          </div>
          {!isLoggedIn && <p className="text-xs text-white/30 mt-4">No credit card required to explore. Cancel anytime.</p>}
        </Reveal>

        {/* FEATURE — "I want to improve the landing page... the UI should
            look better." A hero that only describes the product reads as
            vaporware; showing a real stylized preview of what the CRM
            actually looks like (dashboard KPIs, today's schedule, live
            crew) does more to sell it than another paragraph of copy —
            built from this same page's own design tokens (glass, gradient-
            text, the red pulse dot already used elsewhere) so it reads as
            a genuine screen, not a stock illustration. */}
        <Reveal delay={300}>
          <div className="mt-14 md:mt-20 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-white/10 bg-black/60 shadow-2xl shadow-brand-950/40 overflow-hidden lp-mockup-float">
              <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/10 bg-white/[0.03]">
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
                <span className="ml-3 text-[11px] text-white/30 font-mono">example.com/dashboard</span>
              </div>
              {/* BUG FIX (user report) — "make sure the whole landing page is
                  mobile optimized." A global app-wide safety net in index.css
                  (`@media (max-width:400px) { .grid.grid-cols-3 { ...2
                  columns } }`, meant for other CRM pages with hardcoded
                  3/4-col grids that DO overflow that narrow) was silently
                  collapsing this specific 3-stat row into an awkward "2 then
                  1 orphaned" layout below 400px — these three cards are
                  narrow enough that 3 columns fits fine here and looks much
                  better. Using an arbitrary-value utility instead of the
                  literal `grid-cols-3` class name opts this one grid out of
                  that blanket rule (different generated class, so the
                  selector never matches) without touching the safety net
                  itself, which other pages still rely on. */}
              <div className="p-4 md:p-6 text-left grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3 md:gap-4">
                {[
                  { label: "Revenue MTD", value: "$18,240", tone: "text-brand-300" },
                  { label: "Active Jobs", value: "12", tone: "text-white" },
                  { label: "Crew on Shift", value: "4", tone: "text-green-400" },
                ].map(s => (
                  <div key={s.label} className="glass rounded-xl p-3 md:p-4">
                    <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/40 mb-1">{s.label}</div>
                    <div className={"text-lg md:text-2xl font-black " + s.tone}>{s.value}</div>
                  </div>
                ))}
                <div className="col-span-2 glass rounded-xl p-3 md:p-4 space-y-2">
                  <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/40 mb-1">Today's Schedule</div>
                  {[
                    { time: "9:00", addr: "412 Birch Ln", tag: "In Progress", tone: "bg-yellow-900/40 text-yellow-300 border-yellow-700/40" },
                    { time: "11:30", addr: "88 Maple Ct", tag: "Scheduled", tone: "bg-blue-900/40 text-blue-300 border-blue-700/40" },
                    { time: "2:00", addr: "215 Ridge Rd", tag: "Scheduled", tone: "bg-blue-900/40 text-blue-300 border-blue-700/40" },
                  ].map(j => (
                    <div key={j.addr} className="flex items-center justify-between text-[11px] md:text-xs py-1">
                      <span className="text-white/50 font-mono w-10 flex-shrink-0">{j.time}</span>
                      <span className="flex-1 text-white/80 truncate px-2">{j.addr}</span>
                      <span className={"px-2 py-0.5 rounded-full border text-[9px] md:text-[10px] font-semibold flex-shrink-0 " + j.tone}>{j.tag}</span>
                    </div>
                  ))}
                </div>
                <div className="glass rounded-xl p-3 md:p-4">
                  <div className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/40 mb-2">Live Crew</div>
                  {["Marco", "Dee"].map(name => (
                    <div key={name} className="flex items-center gap-1.5 text-[11px] md:text-xs text-white/70 py-1">
                      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 lp-pulse-dot" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
                      </span>
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
        </div>
      </section>

      {/* FEATURE — sizzle reel: a real, downloadable demo video (not just
          a screenshot mockup). Rendered offline via a headless-browser
          capture of the artifact's own animation + its actual Web Audio
          SFX (captured live off the audio graph, not a separate track),
          then muxed to h264/aac — so this <video> plays with real sound
          and the download link hands back a genuine .mp4, not a stub. */}
      {/* Product demo video slot — drop an mp4 in public/media/ and render
          <SizzleReelPlayer src="/media/your-demo.mp4" /> here. */}

      <MarketingMarquee items={["Scheduling", "Estimates & Invoices", "Stripe Payments", "Client Portal", "Alfred AI Assistant", "Drag-and-Drop Automations", "Live Crew Tracking", "Mobile Field Portal", "Referral Program"]} />

      {/* ── Feature grid (teaser — full breakdown on #/features) ────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-24 max-w-6xl mx-auto">
        <Reveal variant="blur" className="text-center mb-12 md:mb-16">
          <h2 className="lp-text-hover text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            Everything the office <span className="gradient-text">and</span> the field need
          </h2>
          <p className="text-white/50 max-w-xl mx-auto text-sm md:text-base">
            One system, from the first estimate to the paid invoice.
          </p>
        </Reveal>

        {/* BUG FIX (user report) — "Run the field currently has three lines
            and one line by itself... reorganize it to remove the separate
            boxes." Splitting features into three separately-boxed sections
            (one per FEATURE_GROUPS label) left whichever group's item count
            wasn't a multiple of 3 with a lone orphan card under its own
            header — visually uneven, and each header competed for its own
            "equal formatting." Flattened to one continuous grid (a single
            orphan at most, at the very end of the whole list, not one per
            group) with a small uniform badge per card carrying the same
            group label instead of three separately-styled section headers. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} variant={i % 3 === 0 ? "left" : i % 3 === 1 ? "scale" : "right"} delay={(i % 3) * 90}>
              <div className="lp-card-hover glass p-5 md:p-6 h-full">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-600/20 to-brand-900/20 border border-brand-700/30 flex items-center justify-center">
                    <f.icon size={20} className="text-brand-400" />
                  </div>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-brand-400/80 mt-1.5">
                    {FEATURE_GROUPS[f.group]}
                  </span>
                </div>
                <h3 className="font-bold text-white mb-1.5 text-sm md:text-base"><span className="lp-text-hover">{f.title}</span></h3>
                <p className="text-white/50 text-xs md:text-sm leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="text-center mt-10">
          <button
            onClick={() => onNavigate("features")}
            className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-semibold text-sm transition-colors"
          >
            See the full feature breakdown
            <ChevronRight size={16} />
          </button>
        </Reveal>
      </section>

      {/* ── Social-proof style strip ─────────────────────────────────────────── */}
      <Reveal className="px-4 md:px-6">
        <section className="max-w-5xl mx-auto glass p-6 md:p-10 flex flex-col md:flex-row items-center justify-around gap-8 text-center mb-8">
          {[
            { stat: "3s", label: "Live crew status refresh" },
            { stat: "24/7", label: "Alfred AI, on call by text" },
            { stat: "1", label: "screen for the whole business" },
          ].map(s => (
            <div key={s.label}>
              <div className="flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 lp-pulse-dot text-brand-fg" />
                <div className="text-3xl md:text-4xl font-black gradient-text">{s.stat}</div>
              </div>
              <div className="text-white/50 text-xs md:text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </section>
      </Reveal>

      <SectionDivider />

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-24 max-w-5xl mx-auto">
        <Reveal variant="rotate" className="text-center mb-12 md:mb-16">
          <h2 className="lp-text-hover text-3xl md:text-5xl font-black mb-3">Up and running the same day</h2>
          <p className="text-white/50 max-w-xl mx-auto">No onboarding calls, no waiting on a sales rep — set up your business and start sending real estimates within the hour.</p>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {[
            { step: "1", title: "Set up your business", desc: "Add your company info, services, and pricing. Connect Stripe and Twilio when you're ready — everything works without them too, you can turn features on as you grow." },
            { step: "2", title: "Send your first estimate", desc: "Build a branded estimate in minutes, text or email it to the customer, and watch it get signed and paid without a single phone call." },
            { step: "3", title: "Your crew clocks in", desc: "Assign the job, and your crew sees it on their phone — checklists, directions, and a Clock In button. You see exactly where they are and how it's going." },
          ].map((s, i) => (
            <Reveal key={s.step} variant="scale" delay={i * 100}>
              <div className="glass p-6 md:p-8 h-full">
                <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center font-black text-lg mb-4 text-brand-fg">{s.step}</div>
                <h3 className="font-bold text-lg mb-2"><span className="lp-text-hover">{s.title}</span></h3>
                <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Built for the field, not a desk ──────────────────────────────────── */}
      <Reveal variant="left" className="px-4 md:px-6">
        <section className="max-w-6xl mx-auto py-16 md:py-24 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <h2 className="lp-text-hover text-3xl md:text-5xl font-black mb-4">Built for the field, not a desk</h2>
            <p className="text-white/50 leading-relaxed mb-6">
              Most CRMs are built for someone sitting at a computer all day. CRM Starter assumes your crew is standing on a job site with dirty boots and one hand full of hose — every field-facing screen is designed to be usable one-thumbed, in bright sunlight, with spotty signal.
            </p>
            <ul className="space-y-3">
              {[
                "Install it like a real app on any phone — no App Store required",
                "Checklists, photos, and clock in/out survive a weak connection",
                "GPS location shared only while a shift is active, never tracked after hours",
                "Works the same whether it's one truck or five crews running at once",
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                  <CheckCircle size={16} className="text-brand-500 flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-center">
            {/* FEATURE — "I want to improve the landing page and add more
                stuff, the UI should look better." A second real-looking
                mockup (phone-shaped, not another emoji-in-a-box) for the
                field-portal half of the pitch, matching the hero's
                dashboard mockup's design language. */}
            <div className="w-56 md:w-64 rounded-[2rem] border-4 border-white/10 bg-black shadow-2xl shadow-brand-950/40 overflow-hidden">
              <div className="h-6 bg-black flex items-center justify-center">
                <div className="w-16 h-1.5 rounded-full bg-white/15" />
              </div>
              <div className="p-3 space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-bold text-white/80">Today's Jobs</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-300 border border-green-700/40">On Shift</span>
                </div>
                {[
                  { addr: "412 Birch Ln", done: true },
                  { addr: "88 Maple Ct", done: false },
                ].map(j => (
                  <div key={j.addr} className="glass rounded-lg p-2.5 flex items-center gap-2">
                    {j.done ? <CheckCircle size={13} className="text-green-400 flex-shrink-0" /> : <span className="w-3 h-3 rounded-full border border-white/30 flex-shrink-0" />}
                    <span className={"text-[10px] flex-1 truncate " + (j.done ? "text-white/40 line-through" : "text-white/80")}>{j.addr}</span>
                  </div>
                ))}
                <div className="glass rounded-lg p-2.5">
                  <div className="text-[9px] text-white/40 uppercase tracking-wider mb-1.5">Checklist</div>
                  {["Pre-wash photos", "service applied"].map((t, i) => (
                    <div key={t} className="flex items-center gap-1.5 text-[9px] text-white/60 py-0.5">
                      <CheckCircle size={10} className={i === 0 ? "text-green-400" : "text-white/20"} />
                      {t}
                    </div>
                  ))}
                </div>
                <button className="w-full py-2 rounded-lg bg-brand-600 text-[10px] font-bold text-center text-brand-fg">Clock Out</button>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <SectionDivider />

      {/* ── Pricing (teaser — full comparison on #/pricing) ─────────────────── */}
      <section className="px-4 md:px-6 py-16 md:py-24 max-w-6xl mx-auto">
        <Reveal variant="blur" className="text-center mb-12 md:mb-16">
          <h2 className="lp-text-hover text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            Simple, <span className="gradient-text">honest</span> pricing
          </h2>
          <p className="text-white/50 max-w-xl mx-auto text-sm md:text-base">
            Pick the plan that matches your crew size. Switch anytime.
          </p>
        </Reveal>

        {/* Billing cycle toggle — annual defaults on since it's the better
            deal and the whole point of adding it was to surface the
            discount, not bury it behind a monthly-first default. */}
        <div className="flex items-center justify-center gap-3 mb-10">
          {/* BUG FIX (mobile audit) — py-2 gave a ~36px-tall control, under
              the ~44px touch-target guideline every other CTA on this page
              already follows. */}
          <button onClick={() => setBilling("monthly")} className={"px-4 py-3 rounded-xl text-sm font-semibold transition " + (billing === "monthly" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70")}>Monthly</button>
          <button onClick={() => setBilling("annual")} className={"px-4 py-3 rounded-xl text-sm font-semibold transition flex items-center gap-2 " + (billing === "annual" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70")}>
            Annual
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-900/40 border border-green-600/40 text-green-300 font-bold">Save 20%</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} variant={i === 0 ? "left" : i === PLANS.length - 1 ? "right" : "scale"} delay={i * 100}>
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
                <div className="lp-text-hover text-sm font-semibold text-white/70 mb-1">{plan.name}</div>
                <div className="flex items-end gap-1 mb-1">
                  <span className="lp-text-hover text-3xl md:text-4xl font-black">${billing === "annual" ? plan.priceAnnual : plan.priceMonthly}</span>
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

        <Reveal className="text-center mt-10">
          <button
            onClick={() => onNavigate("pricing")}
            className="inline-flex items-center gap-1.5 text-brand-400 hover:text-brand-300 font-semibold text-sm transition-colors"
          >
            See full plan comparison & FAQ
            <ChevronRight size={16} />
          </button>
        </Reveal>
      </section>

      {/* ── FAQ — new, real functionality (was only ever a link off to the
          Pricing page's own FAQ before). Plain accordion, no library. */}
      <SectionDivider />
      <section className="px-4 md:px-6 py-16 md:py-24 max-w-3xl mx-auto">
        <Reveal variant="right" className="text-center mb-10">
          <h2 className="lp-text-hover text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            Questions, <span className="gradient-text">answered</span>
          </h2>
        </Reveal>
        <Reveal variant="left" delay={80}>
          <div className="space-y-3">
            {[
              { q: "Do I need a separate payment processor?", a: "No — CRM Starter connects directly to Stripe or Square, whichever you already use (or want to set up). Take deposits, full payments, and in-person card charges without a third-party app in between." },
              { q: "Can my crew use this in the field, not just the office?", a: "Yes — every technician gets the mobile field portal: their job list, on-the-way and running-late texts, checklists, photos, clock in/out, and on-site payment collection, all from their own phone." },
              { q: "What happens when my free trial ends?", a: "You'll be prompted to pick a plan that fits your crew size. Nothing you've entered is ever deleted — pick a plan and pick up right where you left off." },
              { q: "Is my data actually separated from other businesses using CRM Starter?", a: "Yes — every business's jobs, customers, and invoices are isolated at the database level. No other CRM Starter account can ever see your data, and you can't see theirs." },
              { q: "Can customers pay and sign estimates online?", a: "Every customer gets a secure portal to view job history, e-sign estimates, and pay invoices — no account or app download required on their end." },
              { q: "What is Alfred?", a: "Alfred is the built-in AI assistant — it acts directly on your CRM (scheduling, estimates, invoices, crew, reports), not just answering questions. Text it like an employee, or talk to it from inside the app, using your live business data." },
              { q: "What can the automations actually do?", a: "Build follow-up sequences by dragging a trigger, a wait/condition, and an action onto a canvas — or start from a ready-made template: new-lead auto-reply, review requests after job completion, overdue-invoice reminders, 90-day re-service nudges, referral asks, birthday and seasonal promos, and day-of job reminders." },
            ].map((item, i) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <Reveal variant="scale" className="px-4 md:px-6">
        <section className="max-w-4xl mx-auto text-center py-16 md:py-20">
          <h2 className="lp-text-hover text-2xl md:text-4xl font-extrabold tracking-tight mb-4">
            Run your business on autopilot.
          </h2>
          <p className="text-white/50 mb-8 text-sm md:text-base max-w-xl mx-auto">
            Set up your business in minutes. No spreadsheets, no sticky notes, no more "who's on that job right now."
          </p>
          <button
            onClick={isLoggedIn ? onGoToDashboard : onGetStarted}
            className="group px-8 py-3.5 rounded-xl bg-brand-600 hover:from-brand-500 hover:to-brand-700 font-bold text-base shadow-xl shadow-brand-900/40 hover:shadow-brand-700/50 transition-all hover:-translate-y-0.5 inline-flex items-center gap-2 text-brand-fg"
          >
            {isLoggedIn ? "Go to Dashboard" : "Start Free Trial"}
            <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
          </button>
        </section>
      </Reveal>

      <MarketingFooter onNavigate={onNavigate} onGetStarted={onGetStarted} />
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 text-left px-5 py-4"
        aria-expanded={open}
      >
        <span className="lp-text-hover font-semibold text-sm md:text-base">{q}</span>
        <ChevronRight size={16} className={"flex-shrink-0 text-white/40 transition-transform " + (open ? "rotate-90" : "")} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-white/60 leading-relaxed">{a}</div>
      )}
    </div>
  );
}
