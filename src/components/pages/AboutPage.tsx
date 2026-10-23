import React from "react";
import {
  Calendar, Users2, MessageSquare, Bot, Smartphone, Wallet,
} from "lucide-react";
import {
  Reveal, MarketingStyles, BackgroundBlobs, MarketingNav, MarketingFooter,
  MarketingPageHeader, MarketingFinalCta, MarketingPage, useDocumentMeta,
} from "./MarketingShared";

// ─── #/about — story/positioning page for CRM Starter ─────────────────────────
// Marketing copy about the product and the problem it solves for a small
// service business owner — not a fabricated founding story with
// specific people/dates. Same visual language and shared nav/footer as the
// rest of the marketing site (see MarketingShared.tsx).

const PROBLEM_POINTS: Array<{ icon: React.ElementType; title: string; body: string }> = [
  {
    icon: Calendar,
    title: "Scheduling lived in a group text",
    body: "Who's on which job, whether the crew showed up, whether a reschedule actually made it to everyone — none of that should depend on someone checking their phone at the right moment.",
  },
  {
    icon: Wallet,
    title: "Estimates and invoices were two different tools",
    body: "A quote gets sent from one app, the invoice gets built somewhere else, and by the time payment comes in nobody's sure which version of the job scope is the real one.",
  },
  {
    icon: MessageSquare,
    title: "Customers were left guessing",
    body: "\"Is the crew still coming today?\" is a question that shouldn't require a phone call — and when it does, it's the office fielding it, not the software.",
  },
  {
    icon: Users2,
    title: "The crew and the office weren't looking at the same job",
    body: "The office sees a calendar entry. The crew sees an address. Neither one sees photos, checklists, or status until someone drives back to compare notes.",
  },
];

const PILLARS: Array<{ icon: React.ElementType; title: string; body: string }> = [
  {
    icon: Calendar,
    title: "One schedule, everyone sees it",
    body: "Jobs move from Unscheduled to Done in a system both the office and the field can see live — no separate calendar for the crew.",
  },
  {
    icon: Wallet,
    title: "One record, from quote to paid",
    body: "An estimate and its invoice are the same record. Sign it, convert it, get paid — nothing gets re-typed or lost in translation.",
  },
  {
    icon: Smartphone,
    title: "The field portal is built for a phone in a pocket",
    body: "Clock in, follow the checklist, snap photos, text the customer — all from the truck, without calling the office to ask what's next.",
  },
  {
    icon: Bot,
    title: "An assistant that can actually do things",
    body: "Alfred isn't a chatbot bolted onto a help page — it can schedule a job or pull a report, from the app or straight from a text.",
  },
];

export function AboutPage({
  onGetStarted,
  onNavigate,
  isLoggedIn = false,
  onGoToDashboard,
  onRoadmap,
}: {
  onGetStarted: () => void;
  onNavigate: (page: MarketingPage) => void;
  isLoggedIn?: boolean;
  onGoToDashboard?: () => void;
  onRoadmap?: () => void;
}) {
  useDocumentMeta(
    "About CRM Starter — Built for Service Crews, Not Adapted From Generic CRM Software",
    "CRM Starter exists because generic CRMs weren't built for a crew standing on a job site with dirty boots. One schedule the office and field both see live, one record from estimate to paid invoice, a field portal built for a phone in a pocket, and Alfred, an AI assistant that can actually take action, not just answer questions."
  );
  return (
    // BUG FIX — see the identical fix + comment in LandingPage.tsx: this
    // div must be the scrolling pane itself since html/body/#root are
    // locked to overflow:hidden app-wide.
    <div className="h-dvh h-screen overflow-y-auto bg-black text-white overflow-x-hidden isolate">
      <MarketingStyles />
      <BackgroundBlobs />
      <MarketingNav active="about" onNavigate={onNavigate} onGetStarted={onGetStarted} isLoggedIn={isLoggedIn} onGoToDashboard={onGoToDashboard} onRoadmap={onRoadmap} />

      <MarketingPageHeader
        eyebrow="Why CRM Starter exists"
        title={<>Built for people who run a <span className="lp-hero-gradient">wash business</span>, not a spreadsheet</>}
        subtitle="CRM Starter is a CRM for service businesses — one owner, one crew, one system, instead of five apps stitched together with text messages."
      />

      {/* ── Who it's for ─────────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-10 md:py-14 max-w-4xl mx-auto">
        <Reveal>
          <div className="glass rounded-2xl p-6 md:p-10">
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight mb-4">Who it's for</h2>
            <p className="text-white/60 text-sm md:text-base leading-relaxed mb-4">
              CRM Starter is built for service business owners — the owner-operator running solo,
              and the owner managing a real crew in the field. It's a single-business tool: one owner,
              their customers, and their crew, not a bloated platform built for a franchise chain and
              awkwardly scaled down.
            </p>
            <p className="text-white/60 text-sm md:text-base leading-relaxed">
              If your day involves quoting a job, getting a crew to the right address, keeping the
              customer in the loop, and eventually getting paid — that's the exact loop CRM Starter is
              built around.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── The problem ──────────────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-10 md:py-14 max-w-6xl mx-auto">
        <Reveal className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            The problem: <span className="gradient-text">everything lived somewhere different</span>
          </h2>
          <p className="text-white/50 max-w-2xl mx-auto text-sm md:text-base">
            A calendar app for scheduling. A texting app for the crew. Another one for customers.
            A separate tool for invoices. None of it talking to each other.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          {PROBLEM_POINTS.map((p, i) => (
            <Reveal key={p.title} delay={(i % 2) * 100}>
              <div className="lp-card-hover glass p-6 h-full">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-600/20 to-brand-900/20 border border-brand-700/30 flex items-center justify-center mb-4">
                  <p.icon size={20} className="text-brand-400" />
                </div>
                <h3 className="font-bold text-white mb-1.5 text-sm md:text-base">{p.title}</h3>
                <p className="text-white/50 text-xs md:text-sm leading-relaxed">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── What we believe / pillars ─────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-10 md:py-14 max-w-6xl mx-auto">
        <Reveal className="text-center mb-10 md:mb-14">
          <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-3">
            So we built <span className="gradient-text">one system</span> instead
          </h2>
          <p className="text-white/50 max-w-2xl mx-auto text-sm md:text-base">
            Every part of the job — schedule, crew, client, payment — lives in the same place and updates everyone at once.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
          {PILLARS.map((p, i) => (
            <Reveal key={p.title} delay={(i % 2) * 100}>
              <div className="lp-card-hover glass p-6 h-full">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-600/20 to-brand-900/20 border border-brand-700/30 flex items-center justify-center mb-4">
                  <p.icon size={20} className="text-brand-400" />
                </div>
                <h3 className="font-bold text-white mb-1.5 text-sm md:text-base">{p.title}</h3>
                <p className="text-white/50 text-xs md:text-sm leading-relaxed">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Closing statement ────────────────────────────────────────────── */}
      <Reveal className="px-4 md:px-6">
        <section className="max-w-4xl mx-auto glass p-8 md:p-12 rounded-2xl text-center my-8 md:my-12">
          <p className="text-lg md:text-2xl font-bold leading-snug text-white/90">
            Less time chasing your own schedule. More time actually washing.
          </p>
          <p className="text-white/45 text-sm md:text-base mt-4 max-w-xl mx-auto">
            That's the whole pitch — CRM Starter just gets out of the way so the job runs itself.
          </p>
        </section>
      </Reveal>

      <MarketingFinalCta
        onGetStarted={onGetStarted}
        heading="See it running your own business"
        body="Set up your business in minutes and put your next job through it."
      />

      <MarketingFooter onNavigate={onNavigate} onGetStarted={onGetStarted} />
    </div>
  );
}
