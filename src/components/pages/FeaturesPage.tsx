import React from "react";
import {
  Calendar, Users2, FileText, CreditCard, MessageSquare, Bot, Smartphone,
  Trash2, Gift, Star, MapPin, Camera, CheckCircle2, ClipboardList,
  Clock, Mail, Wallet, Sparkles, Workflow, PhoneCall, Layers, Palmtree,
} from "lucide-react";
import {
  Reveal, MarketingStyles, BackgroundBlobs, MarketingNav, MarketingFooter,
  MarketingPageHeader, MarketingFinalCta, MarketingPage, useDocumentMeta,
} from "./MarketingShared";

// ─── #/features — dedicated, categorized feature breakdown ────────────────
// Richer version of the condensed grid on LandingPage.tsx — same underlying,
// verified-real capabilities (see docs/ARCHITECTURE.md "Working features" + Key files
// and LandingPage.tsx's FEATURES list, which this content is drawn from),
// just organized into the categories a service owner actually
// thinks in ("For Owners", "For Your Crew", "For Your Clients", "Payments",
// "AI Assistant") with more than a one-line description per item.

type FeatureItem = { icon: React.ElementType; title: string; body: string; bullets: string[] };
type Category = { key: string; label: string; blurb: string; items: FeatureItem[] };

const CATEGORIES: Category[] = [
  {
    key: "owners",
    label: "For Owners",
    blurb: "Run the whole business — scheduling, quoting, and the numbers — from one screen instead of five apps.",
    items: [
      {
        icon: Calendar,
        title: "Scheduling & Crew Assignment",
        body: "Drag jobs onto the calendar, assign the right crew members, and watch every job move through its lifecycle — from Unscheduled to Done — synced live to the field the moment it changes.",
        bullets: ["Unscheduled-jobs banner so nothing falls through the cracks", "Crew assignment synced instantly to the mobile portal", "Full job history per customer"],
      },
      {
        icon: FileText,
        title: "Estimates & Invoices",
        body: "Send branded estimates a customer can review and e-sign online, then convert the same record straight into an invoice — no re-entry, no separate invoicing tool.",
        bullets: ["Customer e-signature on estimates", "One-click estimate → invoice conversion", "Full invoice/payment status tracking"],
      },
      {
        icon: ClipboardList,
        title: "Job Requests & Pipeline",
        body: "Track incoming leads and job requests through a pipeline view so nothing waits in an inbox — see what's new, what's quoted, and what's ready to schedule.",
        bullets: ["Lead intake form embeddable on your own website", "Pipeline view from request to scheduled job"],
      },
      {
        icon: Sparkles,
        title: "Reports & Analytics",
        body: "See how the business is actually doing — job volume, revenue, and crew activity — without exporting spreadsheets to figure it out.",
        bullets: ["Owner Today dashboard summary", "Reports & analytics views built in"],
      },
    ],
  },
  {
    key: "crew",
    label: "For Your Crew",
    blurb: "A mobile field portal built for someone standing on a job site, not at a desk.",
    items: [
      {
        icon: Smartphone,
        title: "Mobile Field Portal",
        body: "Crew members log into their own portal on their phone to see their jobs for the day, follow the job through to completion, and clock in and out — all without calling the office.",
        bullets: ["Employee itinerary card + shift-end digest", "Invite-code signup — no admin setup per employee"],
      },
      {
        icon: Clock,
        title: "Shift & Job Time Tracking",
        body: "A whole-day shift clock (clock in, lunch, clock out) separate from per-job time tracking, so hours and job durations are both accurate — including the owner's own self-assigned jobs.",
        bullets: ["Shift timer with lunch tracking", "Per-job clock in/out"],
      },
      {
        icon: CheckCircle2,
        title: "Pre/During/Post Job Checklists",
        body: "Structured checklists for before, during, and after each job keep quality consistent from crew member to crew member, with progress visible to the office in real time.",
        bullets: ["Checklist progress bar on the Live Team View", "Voice-to-text checklist notes"],
      },
      {
        icon: MapPin,
        title: "Live Crew Tracking & GPS",
        body: "See who's on shift, where they are, and how far along their checklist is — refreshed every few seconds on the owner dashboard, with GPS arrival-notify prompts as crew reach a job.",
        bullets: ["On Time / Running Late / Just Started / Almost Done status", "Optimistic location updates, no lag on the dashboard"],
      },
      {
        icon: Camera,
        title: "Job Photo Documentation",
        body: "Before/after photos are attached directly to the job record from the field — visible to the office immediately, and to the customer through their portal.",
        bullets: ["Photo count visible on Live Team View", "Tied to the job record permanently"],
      },
    ],
  },
  {
    key: "clients",
    label: "For Your Clients",
    blurb: "Give every customer a real, self-serve portal instead of a string of missed calls.",
    items: [
      {
        icon: Users2,
        title: "Client Portal",
        body: "Every customer gets their own secure login to view job history, review and sign estimates, and pay invoices — no shared inbox, no account juggling on your end.",
        bullets: ["Separate customer auth session from owner/employee logins", "Sign, decline, or pay directly from a link"],
      },
      {
        icon: MessageSquare,
        title: "On-The-Way & Running-Late Texts",
        body: "Automated SMS lets customers know when the crew is heading their way, or if a job is running behind — sent straight from the field portal, logged to the office inbox too.",
        bullets: ["Sent via Twilio, logged to a shared Inbox", "No customer left guessing when the crew will show"],
      },
      {
        icon: Gift,
        title: "Referral Program",
        body: "Turn happy customers into new leads with a built-in referral link and reward tracking, without running a separate referral platform.",
        bullets: ["Shareable referral link per customer", "Built-in reward tracking"],
      },
      {
        icon: Star,
        title: "Review Requests",
        body: "Ask satisfied customers for a Google review automatically right after the job's marked done, while the work is still fresh in their mind.",
        bullets: ["Fires right after job completion", "No manual follow-up required"],
      },
    ],
  },
  {
    key: "payments",
    label: "Payments",
    blurb: "Get paid without bolting on a third-party payment app.",
    items: [
      {
        icon: CreditCard,
        title: "Stripe Payment Processing",
        body: "Direct Stripe integration for deposits, full payments, or an in-person card charge on-site — the money side lives in the same record as the job and invoice.",
        bullets: ["Deposits or full payment", "In-person card charge support"],
      },
      {
        icon: Wallet,
        title: "Invoice & Payment Status Tracking",
        body: "An invoice is the same record as its estimate, just flagged invoiced — so payment status, history, and the original quote are never out of sync with each other.",
        bullets: ["Estimates and invoices share one source of truth", "Clear paid / unpaid status everywhere it's shown"],
      },
    ],
  },
  {
    key: "ai",
    label: "Alfred AI",
    blurb: "Alfred is built into the CRM itself, with real access to your live data — not a chatbot bolted on top that just answers generic questions.",
    items: [
      {
        icon: Bot,
        title: "An Assistant That Actually Runs Things",
        body: "Alfred doesn't just answer questions — it acts directly on your CRM. Schedule a job, create and send an estimate, assign crew, reschedule or cancel a job, log an expense, check stock, text a supplier, pull your business stats — all from one conversation, in the app or by text.",
        bullets: ["Dozens of real actions, not a scripted demo", "Reads your actual jobs, customers, invoices, and crew — live"],
      },
      {
        icon: PhoneCall,
        title: "Text Alfred Like a Real Employee",
        body: "Alfred has its own phone number — text it from the truck, and it can handle the same requests it would in the app: \"reschedule the Miller job to Thursday,\" \"who's clocked in right now,\" \"send a reminder to the 3pm appointment.\" More than one phone can be authorized to text it for a single business.",
        bullets: ["No app open required — just send a text", "Extra authorized phone numbers per business"],
      },
      {
        icon: Palmtree,
        title: "Vacation Mode & Autonomy Levels",
        body: "Going out of town? Set vacation mode and choose how much Alfred handles on its own — freely manage scheduling and messaging while you're out, queue everything for your approval first, or just take messages until you're back.",
        bullets: ["Manage Everything / Ask First / Hold Everything", "Follow-up reminders it tracks and reports back on"],
      },
      {
        icon: Mail,
        title: "Owner's Own Gmail, Not a \"noreply\" Address",
        body: "Automated emails — On The Way notices, Running Late alerts, invoices — send from the owner's own connected Gmail account, so replies land where the owner actually reads them. Alfred can also draft and send from that same connection, create Calendar events, add Google Tasks, and upload files to Drive.",
        bullets: ["No generic Resend/noreply sender for customer-facing sends", "Same Gmail/Calendar/Drive connection Alfred and the rest of the app share"],
      },
    ],
  },
  {
    key: "automations",
    label: "Automations",
    blurb: "A real drag-and-drop workflow builder with pre-built templates — set it up once, and it runs itself.",
    items: [
      {
        icon: Workflow,
        title: "Visual Workflow Builder",
        body: "Build a follow-up sequence by dragging blocks onto a canvas — a trigger, a wait/condition, an action — instead of configuring settings in a form. Add an SMS or email step, a tag, or even a webhook to another tool.",
        bullets: ["Trigger → Condition/Wait → Action → Tag/Webhook blocks", "Toggle any automation on or off without deleting it"],
      },
      {
        icon: Layers,
        title: "Pre-Built Templates for the Whole Customer Lifecycle",
        body: "Ready-to-use templates cover the sequences a service business actually needs: a new-lead auto-reply, an estimate-not-viewed nudge, a review request 48 hours after the job, an overdue-invoice reminder, a re-service reminder 90 days out, a referral ask after the third job, birthday and seasonal promos, and day-of job reminders.",
        bullets: ["Estimate follow-up escalation (soft nudge, then urgency)", "Payment-overdue and 90-day re-service reminders included"],
      },
      {
        icon: Sparkles,
        title: "Automatic Review & Follow-Up Requests",
        body: "Fires a review request automatically once a job's marked done, and can escalate an unviewed estimate or an overdue invoice on its own schedule — no owner has to remember to follow up.",
        bullets: ["Review requests fire right after job completion", "Escalating reminders instead of a single one-shot text"],
      },
    ],
  },
];

export function FeaturesPage({
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
    "Features — Scheduling, Automation & AI for Service | CRM Starter",
    "Every feature in CRM Starter's service CRM: drag-and-drop scheduling, estimates & invoicing, Stripe payments, a mobile field portal with GPS and checklists, drag-and-drop automations, and Alfred — a built-in AI assistant that can schedule jobs and message customers on its own."
  );
  return (
    // BUG FIX — see the identical fix + comment in LandingPage.tsx: this
    // div must be the scrolling pane itself since html/body/#root are
    // locked to overflow:hidden app-wide.
    <div className="h-dvh h-screen overflow-y-auto bg-black text-white overflow-x-hidden isolate">
      <MarketingStyles />
      <BackgroundBlobs />
      <MarketingNav active="features" onNavigate={onNavigate} onGetStarted={onGetStarted} isLoggedIn={isLoggedIn} onGoToDashboard={onGoToDashboard} onRoadmap={onRoadmap} />

      <MarketingPageHeader
        eyebrow="Every capability, in one place"
        title={<>Built to run <span className="lp-hero-gradient">the whole job</span>, start to finish</>}
        subtitle="From the first lead to the paid invoice — here's everything CRM Starter actually does, organized by who it's for."
      />

      {/* ── Category jump nav ──────────────────────────────────────────────── */}
      <Reveal className="px-4 md:px-6 mb-8">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-2">
          {CATEGORIES.map(c => (
            <a
              key={c.key}
              href={"#" + c.key}
              className="px-3.5 py-1.5 rounded-full glass text-xs text-white/60 hover:text-white hover:border-brand-700/40 transition-colors"
            >
              {c.label}
            </a>
          ))}
        </div>
      </Reveal>

      {CATEGORIES.map((cat, ci) => (
        <section key={cat.key} id={cat.key} className="px-4 md:px-6 py-10 md:py-14 max-w-6xl mx-auto scroll-mt-20">
          <Reveal className="mb-8 md:mb-10 flex items-start md:items-end justify-between flex-col md:flex-row gap-2">
            <div>
              <div className="text-brand-400 text-xs font-bold tracking-widest uppercase mb-2">
                {String(ci + 1).padStart(2, "0")} — {cat.label}
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">{cat.label}</h2>
            </div>
            <p className="text-white/50 text-sm md:text-base max-w-md">{cat.blurb}</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {cat.items.map((f, i) => (
              <Reveal key={f.title} delay={(i % 2) * 100}>
                <div className="lp-card-hover glass p-6 md:p-7 h-full">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-600/20 to-brand-900/20 border border-brand-700/30 flex items-center justify-center mb-5">
                    <f.icon size={22} className="text-brand-400" />
                  </div>
                  <h3 className="font-bold text-white mb-2 text-base md:text-lg">{f.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed mb-4">{f.body}</p>
                  <ul className="space-y-2">
                    {f.bullets.map(b => (
                      <li key={b} className="flex items-start gap-2 text-xs md:text-sm text-white/60">
                        <CheckCircle2 size={14} className="text-brand-500 mt-0.5 flex-shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      ))}

      <MarketingFinalCta
        onGetStarted={onGetStarted}
        heading="See it running your own jobs"
        body="Every feature above is live in the product today — set up your business and try it on your real schedule."
      />

      <MarketingFooter onNavigate={onNavigate} onGetStarted={onGetStarted} />
    </div>
  );
}
