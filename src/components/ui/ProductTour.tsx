import React, { useEffect, useRef, useState } from "react";
import { Sparkles, ArrowRight, X, Send, Bot } from "lucide-react";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";

// FEATURE — "for new users who sign up on the free plan, take them through
// demos... blur everything except the area being shown, then show arrows
// with prompts like 'click here' or 'scroll here.' Include actions beyond
// basic tasks... allow users to skip steps if they wish." A real spotlight
// product tour: for a step with a `target`, everything EXCEPT that DOM
// element (matched by its `data-tour` attribute — see App.tsx's nav
// buttons and CustomersPage.tsx's Add button) is darkened/blurred via four
// backdrop bars around its live bounding rect, with a callout card and
// arrow pointing at it. A step with no target (welcome, the Alfred demo,
// done) renders as a plain centered card instead. Triggered once for a
// brand-new signup — see the settings.productTourPending flag App.tsx
// sets right after OnboardingFlow finishes.

type TourStep = {
  id: string;
  title: string;
  body: string;
  target?: string; // matches a data-tour="..." attribute
  page?: string; // page to navigate to before locating the target
  kind?: "welcome" | "alfred-demo" | "done";
};

const STEPS: TourStep[] = [
  { id: "welcome", kind: "welcome", title: "Welcome to CRM Starter 👋", body: "Quick tour — five things worth knowing on day one. Skip anytime, or come back to it later from Settings → Onboarding." },
  { id: "customers", title: "Add your first customer", target: "new-customer-btn", page: "customers", body: "Every job, estimate, and invoice starts with a customer record. Tap here to add one — name, phone, and address is all you need to start." },
  { id: "jobs", title: "Schedule work", target: "nav-jobs", body: "Once you've got a customer, Jobs is where you schedule the work, assign crew, and track it from Scheduled to Done." },
  { id: "alfred", kind: "alfred-demo", title: "Meet Alfred", body: "Your AI assistant — ask it anything about your business, or have it take real actions for you." },
  { id: "employees", title: "Track your crew", target: "nav-employees", body: "The Employees page is where you invite crew and set pay rates. Once they're clocked in, watch them live on the Dashboard's Live Crew View — location, current job, and checklist progress, updated every few seconds." },
  { id: "done", kind: "done", title: "You're set 🎉", body: "That's the core loop: customers → jobs → crew. Alfred, invoicing, and automations are all in the sidebar whenever you're ready for them." },
];

const ALFRED_DEMO_Q = "What's on my schedule this week?";
const ALFRED_DEMO_A = "You've got 4 jobs scheduled this week — 2 today, completed jobs on track for $1,240 collected so far, and no overdue invoices. Want me to text a reminder to tomorrow's first customer?";

export function ProductTour({ onNav, onFinish, onSkip }: { onNav: (page: string) => void; onFinish: () => void; onSkip: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[stepIndex];
  const advancedRef = useRef(false);

  useEffect(() => {
    advancedRef.current = false;
    if (step.page) onNav(step.page);
    if (!step.target) { setRect(null); return; }
    let raf = 0;
    const locate = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setRect(el.getBoundingClientRect());
      } else {
        raf = requestAnimationFrame(locate);
      }
    };
    const t = setTimeout(locate, 250); // let the page-nav render settle first
    const onResize = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.removeEventListener("scroll", onResize, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Clicking the actual spotlighted element also advances the tour — the
  // natural "I did the thing" signal, not just a Next button.
  useEffect(() => {
    if (!step.target) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el) return;
    const onClick = () => { if (!advancedRef.current) { advancedRef.current = true; setTimeout(next, 400); } };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect]);

  const next = () => {
    if (stepIndex >= STEPS.length - 1) { onFinish(); return; }
    setStepIndex(i => i + 1);
  };
  const back = () => setStepIndex(i => Math.max(0, i - 1));

  const PAD = 10;
  const hasSpotlight = !!rect;

  return (
    <div className="fixed inset-0 z-[500]">
      {hasSpotlight && rect ? (
        <>
          {/* Four backdrop bars — blurred + darkened everywhere except a live cutout around the target's real bounding rect. */}
          <div className="absolute inset-x-0 top-0 bg-black/70 backdrop-blur-sm transition-all duration-300" style={{ height: Math.max(0, rect.top - PAD) }} />
          <div className="absolute inset-x-0 bottom-0 bg-black/70 backdrop-blur-sm transition-all duration-300" style={{ top: rect.bottom + PAD }} />
          <div className="absolute bg-black/70 backdrop-blur-sm transition-all duration-300" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, left: 0, width: Math.max(0, rect.left - PAD) }} />
          <div className="absolute bg-black/70 backdrop-blur-sm transition-all duration-300" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, left: rect.right + PAD, right: 0 }} />
          {/* Glowing outline around the live target — never blurred/covered */}
          <div
            className="absolute rounded-xl border-2 border-brand-500 pointer-events-none transition-all duration-300"
            style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, boxShadow: "0 0 0 4px rgba(255,255,255,0.25), 0 0 24px rgba(255,255,255,0.5)" }}
          />
          {/* Callout — positioned to the side of the target with room to breathe, flips to the other side if it'd run off-screen. */}
          <TourCallout step={step} rect={rect} index={stepIndex} total={STEPS.length} onNext={next} onBack={back} onSkip={onSkip} />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
          <TourCenterCard step={step} index={stepIndex} total={STEPS.length} onNext={next} onBack={back} onSkip={onSkip} />
        </div>
      )}
    </div>
  );
}

function TourProgress({ index, total }: { index: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={"h-1.5 rounded-full transition-all " + (i === index ? "w-5 bg-brand-500 text-brand-fg" : i < index ? "w-1.5 bg-brand-800 text-brand-fg" : "w-1.5 bg-white/15")} />
      ))}
    </div>
  );
}

function TourCallout({ step, rect, index, total, onNext, onBack, onSkip }: { step: TourStep; rect: DOMRect; index: number; total: number; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  // Prefer placing the callout to the right of a left-side sidebar target;
  // otherwise below it. Clamped so it never runs off-screen on a small window.
  const placeRight = rect.left < window.innerWidth * 0.4;
  const top = Math.min(Math.max(rect.top, 16), window.innerHeight - 260);
  const style: React.CSSProperties = placeRight
    ? { top, left: Math.min(rect.right + 24, window.innerWidth - 340) }
    : { top: Math.min(rect.bottom + 20, window.innerHeight - 260), left: Math.max(16, Math.min(rect.left, window.innerWidth - 340)) };
  return (
    <Glass className="absolute w-80 p-4 !bg-black/95 space-y-3 animate-fade-in" style={style}>
      <div className="flex items-center gap-1.5 text-[10px] text-brand-400 font-semibold uppercase tracking-wider">
        {placeRight ? "← Click here" : "↑ Click here"}
      </div>
      <div className="font-bold text-white">{step.title}</div>
      <p className="text-sm text-white/60 leading-relaxed">{step.body}</p>
      <div className="flex items-center justify-between pt-1">
        <TourProgress index={index} total={total} />
        <div className="flex items-center gap-2">
          <button onClick={onSkip} className="text-xs text-white/30 hover:text-white/60">Skip tour</button>
          <GBtn onClick={onNext} className="!text-xs !py-1.5">Next <ArrowRight size={12} className="inline ml-1" /></GBtn>
        </div>
      </div>
    </Glass>
  );
}

function TourCenterCard({ step, index, total, onNext, onBack, onSkip }: { step: TourStep; index: number; total: number; onNext: () => void; onBack: () => void; onSkip: () => void }) {
  return (
    <Glass className="w-full max-w-md p-6 !bg-black/95 space-y-4 animate-fade-in relative">
      <button onClick={onSkip} className="absolute top-3 right-3 text-white/30 hover:text-white/60"><X size={16} /></button>
      <div className="w-12 h-12 rounded-full bg-brand-900/40 border border-brand-600/40 flex items-center justify-center">
        <Sparkles size={20} className="text-brand-400" />
      </div>
      <div>
        <div className="text-xl font-bold text-white">{step.title}</div>
        <p className="text-sm text-white/60 leading-relaxed mt-1.5">{step.body}</p>
      </div>
      {step.kind === "alfred-demo" && <AlfredDemo />}
      <div className="flex items-center justify-between pt-1">
        <TourProgress index={index} total={total} />
        <div className="flex items-center gap-2">
          {index > 0 && <button onClick={onBack} className="text-xs text-white/30 hover:text-white/60">Back</button>}
          <button onClick={onSkip} className="text-xs text-white/30 hover:text-white/60">Skip tour</button>
          <GBtn onClick={onNext} className="!text-xs !py-1.5">
            {step.kind === "done" ? "Get started" : "Next"} <ArrowRight size={12} className="inline ml-1" />
          </GBtn>
        </div>
      </div>
    </Glass>
  );
}

// FEATURE — "show how to message Alfred: ask a question, have them type or
// press send for a demo question, then display Alfred responding with cool
// animations and transitions." Fully scripted/canned — deliberately never
// calls the real AI (no cost, no dependency on the account having a model
// key configured yet) — this is a demo of the INTERACTION, not a live query.
function AlfredDemo() {
  const [typed, setTyped] = useState("");
  const [sent, setSent] = useState(false);
  const [showReply, setShowReply] = useState(false);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setTyped(ALFRED_DEMO_Q.slice(0, i));
      if (i >= ALFRED_DEMO_Q.length) {
        clearInterval(iv);
        setTimeout(() => setSent(true), 500);
        setTimeout(() => setShowReply(true), 1400);
      }
    }, 35);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-3 space-y-2.5">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand-700/80 text-brand-fg text-sm px-3 py-2">
          {typed}<span className="inline-block w-0.5 h-3.5 bg-white/70 ml-0.5 align-middle animate-pulse" style={{ opacity: typed.length < ALFRED_DEMO_Q.length ? 1 : 0 }} />
        </div>
      </div>
      {sent && !showReply && (
        <div className="flex justify-end"><Send size={11} className="text-white/30" /></div>
      )}
      {showReply && (
        <div className="flex justify-start animate-fade-in">
          <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-white/10 text-white/90 text-sm px-3 py-2 flex items-start gap-1.5">
            <Bot size={13} className="text-brand-400 flex-shrink-0 mt-0.5" />
            <span>{ALFRED_DEMO_A}</span>
          </div>
        </div>
      )}
    </div>
  );
}
