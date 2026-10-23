import React, { useEffect, useRef, useState } from "react";
import { Menu, X, ArrowRight } from "lucide-react";

// ─── Shared building blocks for CRM Starter's public marketing pages ─────────────
// Used by LandingPage.tsx (#/welcome), FeaturesPage.tsx (#/features),
// PricingPage.tsx (#/pricing), and AboutPage.tsx (#/about). Pulled out of
// LandingPage.tsx so the nav/footer/scroll-reveal/background treatment is
// defined once and every marketing page looks and feels like the same site
// instead of four independently-styled pages. See App.tsx's page-resolution
// useState + hashchange handler for how each of these routes is reached, and
// the "already-signed-in owner off the marketing/login pages" guard just
// above the login screen for why every one of these pages is only ever
// rendered when there's no active owner/employee session.

export type MarketingPage = "welcome" | "features" | "pricing" | "about";

// ─── SEO/AEO — per-page <title>/meta description ──────────────────────────
// FEATURE — "fully AEO and SEO optimize CRM Starter." This app is a hash-routed
// SPA (#/features, #/pricing, #/about all live under the ONE real URL —
// see App.tsx's page-resolution useState) — a search/AI crawler that
// doesn't execute JS only ever sees index.html's static <title>/<meta
// description> no matter which of these four marketing pages a human
// visitor is actually on. This can't fix that (there's no server-side
// render here), but it DOES make the tab title/meta description accurate
// for: (1) any crawler that DOES execute JS (Googlebot generally does),
// (2) a link shared while already on that page, (3) plain browser-tab UX.
// Restored to index.html's own values on unmount so navigating to a page
// that doesn't call this (or back to a non-marketing page) doesn't leave a
// stale title/description behind.
const DEFAULT_TITLE = "CRM Starter — AI-Powered CRM for Service Businesses";
const DEFAULT_DESCRIPTION = "CRM Starter is the service CRM built for the job, not adapted from something else — scheduling, estimates, invoicing, Stripe payments, a mobile field portal, drag-and-drop automations, and Alfred, a built-in AI assistant that schedules jobs and texts customers for you. Free trial, no credit card required.";
export function useDocumentMeta(title: string, description: string): void {
  useEffect(() => {
    const prevTitle = document.title;
    const metaEl = document.querySelector('meta[name="description"]');
    const prevDescription = metaEl?.getAttribute("content") || "";
    document.title = title;
    metaEl?.setAttribute("content", description);
    return () => {
      document.title = prevTitle || DEFAULT_TITLE;
      metaEl?.setAttribute("content", prevDescription || DEFAULT_DESCRIPTION);
    };
  }, [title, description]);
}

// ─── Scroll-reveal wrapper ─────────────────────────────────────────────────
// Adds "is-visible" once the element crosses into the viewport, which
// MarketingStyles below turns into a fade+slide-up transition. Falls back to
// already-visible if IntersectionObserver isn't available (very old
// browsers / SSR-safety) rather than leaving content invisible.
// FEATURE — "every animation when you scroll down is just fading in on the
// landing page; make them different." `variant` picks which of several
// distinct entrance treatments this section uses (see the matching
// .reveal-* classes in MarketingStyles below) — "up" (the original fade
// + rise) stays the default so every OTHER marketing page (features,
// pricing, about) that doesn't pass a variant keeps its exact existing
// look; LandingPage.tsx is the one that varies them section-to-section.
export type RevealVariant = "up" | "left" | "right" | "scale" | "rotate" | "blur";
export function Reveal({ children, className = "", delay = 0, variant = "up" }: { children: React.ReactNode; className?: string; delay?: number; variant?: RevealVariant }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { setVisible(true); obs.disconnect(); }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const variantClass = variant === "up" ? "reveal" : "reveal reveal-" + variant;
  return (
    <div
      ref={ref}
      className={variantClass + " " + (visible ? "reveal-visible " : "") + className}
      style={{ transitionDelay: visible ? delay + "ms" : "0ms" }}
    >
      {children}
    </div>
  );
}

// ─── Scoped styles: scroll-reveal + gradient blob motion ──────────────────
// Identical across every marketing page — render once per page (each page is
// its own top-level route/mount, so there's no dedupe concern with repeating
// a <style> tag the way there would be inside a single long-scroll page).
export function MarketingStyles() {
  return (
    <style>{`
      .reveal {
        opacity: 0;
        transform: translateY(24px);
        transition: opacity 0.7s ease, transform 0.7s ease;
      }
      /* BUG FIX (user report) — "these words are blurred... you can't read
         them" on the feature-grid and pricing headings (both use
         variant="blur"). Root cause: this reset and the .reveal-VARIANT
         rules below it have EQUAL CSS specificity (one class each), so
         the later-defined variant rule (e.g. .reveal-blur's
         filter:blur(10px)) always won the cascade regardless of whether
         .reveal-visible was also applied — the blur/scale/rotate never
         actually cleared, it just silently lost every time. Selector is
         now two classes (.reveal is always present alongside any variant
         class) so this reset wins no matter where it sits in the file. */
      .reveal.reveal-visible { opacity: 1; transform: translateY(0) translateX(0) scale(1) rotate(0deg); filter: blur(0); }

      /* FEATURE — scroll-entrance variety (see Reveal's variant prop). Each
         swaps the base .reveal's transform/filter, reusing the same
         opacity + .reveal-visible reset above. */
      .reveal-left { transform: translateX(-46px) translateY(0); }
      .reveal-right { transform: translateX(46px) translateY(0); }
      .reveal-scale { transform: scale(0.86) translateY(12px); transition: opacity 0.6s ease, transform 0.6s cubic-bezier(.34,1.4,.4,1); }
      .reveal-rotate { transform: translateY(20px) rotate(-3deg); transition: opacity 0.65s ease, transform 0.65s cubic-bezier(.16,1,.3,1); }
      .reveal-blur { transform: translateY(10px); filter: blur(10px); transition: opacity 0.6s ease, transform 0.6s ease, filter 0.6s ease; }

      @keyframes lp-blob-float {
        0%, 100% { transform: translate(0, 0) scale(1); }
        33% { transform: translate(20px, -30px) scale(1.08); }
        66% { transform: translate(-15px, 15px) scale(0.95); }
      }
      .lp-blob { animation: lp-blob-float 14s ease-in-out infinite; }
      .lp-blob-slow { animation: lp-blob-float 20s ease-in-out infinite reverse; }

      @keyframes lp-shimmer-text {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }
      .lp-hero-gradient {
        background: linear-gradient(90deg, #e5e5e5, #ffffff, #a3a3a3, #ffffff, #e5e5e5);
        background-size: 200% auto;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        animation: lp-shimmer-text 6s linear infinite;
      }

      .lp-card-hover {
        transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
      }
      .lp-card-hover:hover {
        transform: translateY(-4px);
        border-color: rgba(255,255,255,0.5);
        box-shadow: 0 12px 32px -12px rgba(255,255,255,0.35);
      }

      /* Slow single-direction wave — "a red wave going from the left side
         of the screen to the right." Two SVG copies placed side by side
         (each 50% of the track width) and the whole track slides left by
         exactly one copy's width, so it loops with no visible seam. Long,
         even duration (28s) reads as a calm drift, not "moving fast." */
      @keyframes lp-wave-drift {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .lp-wave-track { animation: lp-wave-drift 28s linear infinite; }

      /* Cursor reaction (desktop only, see BackgroundBlobs) — the wrapper
         nudges opposite the cursor for a slow parallax "the water
         reacts" feel; --mx/--my default to 50 (screen center) so there's
         no jump before the first mousemove fires. */
      .lp-wave-interact {
        transform: translate3d(calc((var(--mx, 50) - 50) * -0.5px), calc((var(--my, 50) - 50) * -0.22px), 0);
        transition: transform 0.6s cubic-bezier(.16,1,.3,1);
      }
      .lp-cursor-glow {
        position: fixed;
        top: 0; left: 0;
        width: 32rem; height: 32rem;
        transform: translate3d(calc(var(--gx, -9999px) - 16rem), calc(var(--gy, -9999px) - 16rem), 0);
        background: radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%);
        opacity: 0;
        transition: opacity 0.4s ease;
        will-change: transform;
      }

      @keyframes lp-marquee-scroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .lp-marquee-track { animation: lp-marquee-scroll 32s linear infinite; }
      .lp-marquee:hover .lp-marquee-track { animation-play-state: paused; }

      @keyframes lp-pulse-dot {
        0%, 100% { opacity: 0.5; transform: scale(0.92); }
        50% { opacity: 1; transform: scale(1.08); }
      }
      .lp-pulse-dot { animation: lp-pulse-dot 2.4s ease-in-out infinite; }

      @keyframes lp-divider-sweep-move {
        0% { transform: translateX(-120%); }
        100% { transform: translateX(320%); }
      }
      .lp-divider-sweep { animation: lp-divider-sweep-move 6s ease-in-out infinite; }

      /* Subtle ambient float for the hero's dashboard mockup — just enough
         motion to read as "alive," not distracting from the content in it. */
      @keyframes lp-mockup-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
      }
      .lp-mockup-float { animation: lp-mockup-float 6s ease-in-out infinite; }

      /* FEATURE — "add text animations when I hover over text on the
         landing page." Two reusable, CSS-only hover effects (no JS, no
         animation library — matches this page's existing convention):
         lp-text-hover lifts + glows red on hover, for headings/body copy;
         lp-text-gradient-hover sweeps the same red gradient the hero
         already uses across the text on hover, for standout titles. Both
         degrade to a plain, un-animated hover under reduced-motion. */
      .lp-text-hover {
        display: inline-block;
        transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), color 0.35s ease, text-shadow 0.35s ease;
      }
      .lp-text-hover:hover {
        transform: translateY(-2px);
        color: #a3a3a3;
        text-shadow: 0 0 20px rgba(255,255,255,0.5);
      }
      .lp-text-gradient-hover {
        display: inline-block;
        background: linear-gradient(90deg, #e5e5e5, #ffffff, #a3a3a3, #ffffff, #e5e5e5);
        background-size: 200% auto;
        background-position: 0% 50%;
        -webkit-background-clip: text;
        background-clip: text;
        transition: background-position 0.6s ease, transform 0.35s cubic-bezier(0.16,1,0.3,1);
      }
      .lp-text-gradient-hover:hover {
        background-position: 100% 50%;
        -webkit-text-fill-color: transparent;
        transform: translateY(-2px);
      }

      @media (prefers-reduced-motion: reduce) {
        .lp-blob, .lp-blob-slow, .lp-wave-track, .lp-marquee-track, .lp-pulse-dot, .lp-hero-gradient, .lp-divider-sweep, .lp-mockup-float {
          animation: none !important;
        }
        .lp-wave-interact { transform: none !important; transition: none !important; }
        .lp-cursor-glow { display: none !important; }
        .lp-text-hover, .lp-text-gradient-hover { transition: none !important; }
        .lp-text-hover:hover { transform: none; }
        .lp-text-gradient-hover:hover { transform: none; background-position: 0% 50%; }
      }
    `}</style>
  );
}

// BUG FIX (user report) — "way too crazy... don't know why the animation
// is moving so fast." The original hero graphic was ~60 fast diagonal
// particle streaks respawning continuously — read as noisy/chaotic
// instead of premium. Replaced everywhere (not just the hero — this is now
// part of the SHARED background every marketing page renders) with one
// slow, single-direction red wave drifting left to right, plus the
// existing soft blob glow toned down to match. Pure CSS transform loop
// (two SVG copies back to back so the 26s cycle loops seamlessly) — no
// per-frame JS, no canvas, nothing that can read as "fast."
export function BackgroundBlobs() {
  // BUG FIX — found while chasing "the wave isn't showing up at all" (and
  // it turned out the original blob glow behind it had the exact same
  // problem — confirmed by forcing the wave to lime-green at full opacity
  // and still seeing nothing). -z-10 on a fixed full-page background only
  // reliably stays BEHIND the rest of the page's content if the page's
  // own root wrapper establishes its own stacking context — otherwise a
  // negative z-index can escape upward and get compared against the
  // wrong ancestor's background, hiding the whole layer. The real fix is
  // each marketing page's root div getting `isolate` (see LandingPage.tsx
  // etc.) — -z-10 here is correct AS LONG AS that's in place.
  //
  // FEATURE — "make it so when my mouse hovers over it on PC, it
  // interacts and moves around." Split the wave into an outer wrapper
  // (reacts to the cursor, via CSS custom props updated on mousemove —
  // no React re-render per frame) and an inner track that keeps its own
  // independent drift animation; a transform on each composites fine
  // together. Desktop-only by design (mousemove never fires from a
  // touch tap, and the (hover: hover) check skips attaching the
  // listener at all on touch devices) and skipped under
  // prefers-reduced-motion.
  const waveWrapRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canHover = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (reduced || !canHover) return;

    function handleMove(e: MouseEvent) {
      const xPct = (e.clientX / window.innerWidth) * 100;
      const yPct = (e.clientY / window.innerHeight) * 100;
      waveWrapRef.current?.style.setProperty("--mx", String(xPct));
      waveWrapRef.current?.style.setProperty("--my", String(yPct));
      glowRef.current?.style.setProperty("--gx", e.clientX + "px");
      glowRef.current?.style.setProperty("--gy", e.clientY + "px");
      if (glowRef.current) glowRef.current.style.opacity = "1";
    }
    function handleLeave() {
      if (glowRef.current) glowRef.current.style.opacity = "0";
    }
    window.addEventListener("mousemove", handleMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handleLeave);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.documentElement.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="lp-blob absolute -top-32 -left-24 w-96 h-96 rounded-full bg-brand-700/15 blur-3xl" />
      <div className="lp-blob-slow absolute top-1/3 -right-32 w-[28rem] h-[28rem] rounded-full bg-brand-900/20 blur-3xl" />
      <div className="lp-blob absolute bottom-0 left-1/4 w-80 h-80 rounded-full bg-brand-800/10 blur-3xl" />
      <div ref={waveWrapRef} className="lp-wave-interact absolute bottom-0 left-0 w-[200%] h-[55vh] opacity-90">
        <div className="lp-wave-track flex w-full h-full">
          <WaveSvg /><WaveSvg />
        </div>
      </div>
      <div ref={glowRef} className="lp-cursor-glow" />
    </div>
  );
}

// One copy of the wave shape — BackgroundBlobs renders two side by side
// and slides the pair left, so the seam between them is never visible.
function WaveSvg() {
  return (
    <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-1/2 h-full flex-shrink-0">
      <defs>
        <linearGradient id="lp-wave-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#525252" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <path
        fill="url(#lp-wave-grad)"
        d="M0,192 C240,260 480,120 720,160 C960,200 1200,280 1440,208 L1440,320 L0,320 Z"
      />
    </svg>
  );
}

// ─── Thin animated divider — a moving light sweep across an otherwise plain
// horizontal rule, used between sections so motion isn't only concentrated
// in the hero.
export function SectionDivider() {
  return (
    <div className="relative h-px max-w-4xl mx-auto my-2 overflow-hidden">
      <div className="absolute inset-0 bg-white/10" />
      <div className="lp-divider-sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-brand-500 to-transparent" />
    </div>
  );
}

// ─── Infinite scrolling marquee of feature keywords — a common, very
// effective "this page is alive" technique on top of scroll-triggered
// reveals, which only animate once and then sit still. Pure CSS transform
// loop (two duplicated tracks back to back so it wraps seamlessly), pauses
// under prefers-reduced-motion via the .lp-marquee-track animation being
// disabled in MarketingStyles below.
export function MarketingMarquee({ items }: { items: string[] }) {
  const track = [...items, ...items];
  return (
    <div className="lp-marquee relative overflow-hidden border-y border-brand-900/30 bg-gradient-to-r from-brand-950/40 via-black to-brand-950/40 py-3">
      <div className="lp-marquee-track flex items-center gap-10 w-max">
        {track.map((item, i) => (
          <span key={i} className="flex items-center gap-10 text-xs md:text-sm font-semibold tracking-wide text-white/70 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0 text-brand-fg" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const NAV_LINKS: Array<{ page: MarketingPage; label: string }> = [
  { page: "features", label: "Features" },
  { page: "pricing", label: "Pricing" },
  { page: "about", label: "About" },
];

// ─── Persistent nav, shared across every marketing page ───────────────────
// `active` highlights the current page's link. `onNavigate` moves between
// marketing pages (App.tsx wires this to set both window.location.hash and
// its own `page` state — see App.tsx's navigateMarketing helper). `onGetStarted`
// is the existing Log In / Get Started hand-off to the login screen.
export function MarketingNav({
  active,
  onNavigate,
  onGetStarted,
  isLoggedIn = false,
  onGoToDashboard,
  onRoadmap,
}: {
  active: MarketingPage;
  onNavigate: (page: MarketingPage) => void;
  onGetStarted: () => void;
  // FEATURE — "still not seeing a way for users to request new features or
  // record bugs, upvote or downvote." #/roadmap already existed as a real
  // public page (read list + a "log in to submit" CTA — see App.tsx) but
  // had no link pointing at it from anywhere on the marketing site itself.
  onRoadmap?: () => void;
  // BUG FIX — "it's not showing I'm logged in when I go to the landing
  // page." A signed-in owner previewing the marketing site (via the
  // "CRM Starter" logo/nav click in the CRM — see App.tsx's marketingPreview
  // flag) saw a nav bar that still said "Log In" / "Start Free Trial" no
  // matter what, exactly as if they were a logged-out visitor — the one
  // signal that WAS already there (App.tsx's red "Previewing the marketing
  // site while logged in" strip above this nav) got contradicted right
  // underneath it. When true, replaces both CTAs with one real "Go to
  // Dashboard" button instead.
  isLoggedIn?: boolean;
  onGoToDashboard?: () => void;
}) {
  const [navOpen, setNavOpen] = useState(false);
  // FEATURE — "optimize the top bar, it's kind of basic." Condenses and
  // gains a stronger shadow/border once the page scrolls, the same
  // "elevates on scroll" polish most modern SaaS marketing sites use
  // instead of a flat, static bar the whole way down.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const linkClass = (p: MarketingPage) =>
    "relative py-1 transition-colors " + (active === p ? "text-white font-semibold" : "hover:text-white");

  return (
    <header className={"sticky top-0 z-40 backdrop-blur-md transition-all duration-300 " + (scrolled ? "bg-black/85 border-b border-white/15 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)]" : "bg-black/50 border-b border-white/5")}>
      <div className={"max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between transition-all duration-300 " + (scrolled ? "h-14" : "h-16")}>
        {/* BUG FIX — "the logo for the landing page is wrong; make it just
            the word CRM Starter and make it larger." Dropped the icon badge —
            this product's identity is the wordmark, not a generic gradient
            box — and sized the text up to actually read as a logo. */}
        <button
          onClick={() => onNavigate("welcome")}
          className="lp-text-hover flex items-center"
          aria-label="CRM Starter home"
        >
          <span className="font-black text-2xl md:text-[26px] tracking-tight">CRM <span className="text-brand-500">Starter</span></span>
        </button>

        <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
          {NAV_LINKS.map(l => (
            <button key={l.page} onClick={() => onNavigate(l.page)} className={linkClass(l.page)}>
              {l.label}
              {/* Animated underline — slides in under the active link instead
                  of just a color/weight change. */}
              <span className={"absolute left-0 -bottom-0.5 h-[1.5px] bg-brand-500 transition-all duration-300  text-brand-fg" + (active === l.page ? "w-full opacity-100" : "w-0 opacity-0")} />
            </button>
          ))}
          <span className="h-5 w-px bg-white/10" aria-hidden="true" />
          {isLoggedIn ? (
            <button
              onClick={onGoToDashboard}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:from-brand-500 hover:to-brand-700 transition-all font-semibold shadow-lg shadow-brand-900/30 hover:shadow-brand-700/40 hover:-translate-y-0.5 text-brand-fg"
            >
              Go to Dashboard
            </button>
          ) : (
            <>
              <button onClick={onGetStarted} className="text-white/70 hover:text-white transition-colors">
                Log In
              </button>
              <button
                onClick={onGetStarted}
                className="group px-4 py-2 rounded-lg bg-brand-600 hover:from-brand-500 hover:to-brand-700 transition-all font-semibold shadow-lg shadow-brand-900/30 hover:shadow-brand-700/40 hover:-translate-y-0.5 flex items-center gap-1.5 text-brand-fg"
              >
                Start Free Trial
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
              </button>
            </>
          )}
        </nav>

        {/* BUG FIX (mobile audit) — p-2 around a 22px icon is a ~38px tap
            target, under the ~44px guideline. */}
        <button className="md:hidden p-3 -mr-2 text-white/80" onClick={() => setNavOpen(o => !o)} aria-label="Toggle menu">
          {navOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {navOpen && (
        <div className="md:hidden border-t border-white/10 bg-black/95 px-4 py-4 space-y-3 animate-fade-in">
          {NAV_LINKS.map(l => (
            <button
              key={l.page}
              onClick={() => { setNavOpen(false); onNavigate(l.page); }}
              className={"block w-full text-left py-2 " + (active === l.page ? "text-white font-semibold" : "text-white/70")}
            >
              {l.label}
            </button>
          ))}
          {isLoggedIn ? (
            <button
              onClick={() => { setNavOpen(false); onGoToDashboard?.(); }}
              className="w-full px-4 py-2.5 rounded-lg bg-brand-600 font-semibold text-brand-fg"
            >
              Go to Dashboard
            </button>
          ) : (
            <>
              <button onClick={() => { setNavOpen(false); onGetStarted(); }} className="w-full text-left py-2 text-white/70">
                Log In
              </button>
              <button
                onClick={() => { setNavOpen(false); onGetStarted(); }}
                className="w-full px-4 py-2.5 rounded-lg bg-brand-600 font-semibold text-brand-fg"
              >
                Start Free Trial
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
}

// ─── Persistent footer, shared across every marketing page ────────────────
export function MarketingFooter({
  onNavigate,
  onGetStarted,
}: {
  onNavigate: (page: MarketingPage) => void;
  onGetStarted: () => void;
}) {
  return (
    <footer className="border-t border-white/10 px-4 md:px-6 py-10 mt-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <button onClick={() => onNavigate("welcome")} className="flex items-center">
            <span className="font-black text-lg tracking-tight text-white/80">CRM <span className="text-brand-500">Starter</span></span>
          </button>

          {/* BUG FIX (mobile audit) — bare text links with no vertical
              padding had an effective tap target of just the text's own
              line-height, well under the ~44px guideline. py-2 pads the tap
              area without changing how the text looks. */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs text-white/40">
            <button onClick={() => onNavigate("features")} className="py-2 hover:text-white/70 transition-colors">Features</button>
            <button onClick={() => onNavigate("pricing")} className="py-2 hover:text-white/70 transition-colors">Pricing</button>
            <button onClick={() => onNavigate("about")} className="py-2 hover:text-white/70 transition-colors">About</button>
            <a href="#/terms" className="py-2 hover:text-white/70 transition-colors">Terms</a>
            <a href="#/privacy" className="py-2 hover:text-white/70 transition-colors">Privacy</a>
            <button onClick={onGetStarted} className="py-2 hover:text-white/70 transition-colors">Log In</button>
          </div>

          <div className="text-[11px] text-white/25">
            © {new Date().getFullYear()} CRM Starter. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Small reusable page-header block for the non-welcome marketing pages ──
export function MarketingPageHeader({
  eyebrow,
  title,
  gradientWord,
  subtitle,
}: {
  eyebrow: string;
  title: React.ReactNode;
  gradientWord?: string;
  subtitle?: string;
}) {
  return (
    <section className="relative px-4 md:px-6 pt-14 pb-10 md:pt-20 md:pb-14 max-w-4xl mx-auto text-center">
      <Reveal>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-brand-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-ring text-brand-fg" />
          {eyebrow}
        </div>
      </Reveal>
      <Reveal delay={80}>
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tight leading-[1.08] mb-5">
          {title}
        </h1>
      </Reveal>
      {subtitle && (
        <Reveal delay={160}>
          <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        </Reveal>
      )}
    </section>
  );
}

// ─── Shared final CTA band, reused at the bottom of every inner marketing page
export function MarketingFinalCta({ onGetStarted, heading, body }: { onGetStarted: () => void; heading: string; body: string }) {
  return (
    <Reveal className="px-4 md:px-6">
      <section className="max-w-4xl mx-auto text-center py-16 md:py-20">
        <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-4">{heading}</h2>
        <p className="text-white/50 mb-8 text-sm md:text-base max-w-xl mx-auto">{body}</p>
        <button
          onClick={onGetStarted}
          className="group px-8 py-3.5 rounded-xl bg-brand-600 hover:from-brand-500 hover:to-brand-700 font-bold text-base shadow-xl shadow-brand-900/40 hover:shadow-brand-700/50 transition-all hover:-translate-y-0.5 inline-flex items-center gap-2 text-brand-fg"
        >
          Start Free Trial
          <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
        </button>
      </section>
    </Reveal>
  );
}
