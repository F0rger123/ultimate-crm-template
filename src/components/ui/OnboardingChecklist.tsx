import React, { useMemo, useState } from "react";
import { CheckCircle, Circle, X, ChevronUp, ListChecks } from "lucide-react";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";

// FEATURE — "implement a guided onboarding checklist with a persistent
// progress bar for new accounts, blurring the interface and showing
// step-by-step instructions and demos, then confirming completion." This is
// separate from OnboardingFlow.tsx (the one-time full-screen wizard that
// collects business info before the app is ever shown) — this checklist
// stays around AFTER that wizard, as a persistent widget that tracks real
// progress against the live data (first customer added, first job created,
// etc.) rather than a one-shot form. Each step's "done" state is derived
// from actual app state wherever possible, not a self-reported checkbox, so
// it can't drift from what's actually been set up.
type ChecklistStep = {
  id: string;
  title: string;
  demo: string;
  page: string;
  done: boolean;
};

export function OnboardingChecklist({
  settings, setSettings, customers, jobs, estimates, employees, setPage, toast,
}: {
  settings: any; setSettings: (fn: (s: any) => any) => void;
  customers: any[]; jobs: any[]; estimates: any[]; employees: any[];
  setPage: (p: string) => void; toast: (msg: string, tone?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeStep, setActiveStep] = useState<ChecklistStep | null>(null);

  const hasIntegration = !!(settings?.twilioAccountSid || settings?.twilioSid || settings?.googleRefreshToken || settings?.twilioConfigured || settings?.googleConnected);

  const steps: ChecklistStep[] = useMemo(() => [
    {
      id: "customer",
      title: "Add your first customer",
      demo: "Go to Customers → New Customer, and fill in their name, phone, and property address. This is the foundation every job and estimate is built on.",
      page: "customers",
      done: customers.length > 0,
    },
    {
      id: "job",
      title: "Create your first job",
      demo: "Go to Jobs → New Job, pick a customer, and schedule a date. Once it's on the calendar, you can assign crew and track it through completion.",
      page: "jobs",
      done: jobs.length > 0,
    },
    {
      id: "estimate",
      title: "Send your first estimate",
      demo: "Go to Estimates → New Estimate, add your line items, and send it — the customer gets a link where they can view, sign, and pay online.",
      page: "estimates",
      done: estimates.length > 0,
    },
    {
      id: "employee",
      title: "Invite your crew",
      demo: "Go to Employees → Invite Employee to generate a signup link — they'll set their own password and show up in Live Crew View once they clock in.",
      page: "employees",
      done: employees.length > 1, // > 1 because the owner's own auto-provisioned row always counts as 1
    },
    {
      id: "integration",
      title: "Connect texting or email",
      demo: "Go to Settings → Integrations to connect Twilio (for SMS) or your Google account (for Gmail send) — this powers On My Way texts, invoice reminders, and Alfred's automations.",
      page: "settings",
      done: hasIntegration,
    },
  ], [customers.length, jobs.length, estimates.length, employees.length, hasIntegration]);

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;
  const hidden = settings?.onboardingChecklistHidden === true;

  // Once every real step is done, the widget quietly retires — no
  // permanent nag once setup is genuinely finished.
  if (hidden || (allDone && !expanded)) return null;

  const dismissForever = () => {
    setSettings(prev => ({ ...prev, onboardingChecklistHidden: true }));
    toast("You can reopen this anytime from Settings → Onboarding", "green");
  };

  const openStep = (s: ChecklistStep) => setActiveStep(s);
  const goToStep = () => {
    if (!activeStep) return;
    setPage(activeStep.page);
    setActiveStep(null);
    setExpanded(false);
  };

  return (
    <>
      {/* Guided step overlay — blurs the interface and shows the demo/instructions for the selected step */}
      {activeStep && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setActiveStep(null)}>
          <Glass className="p-6 max-w-md w-full space-y-4 !bg-black/90" onClick={(e: any) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-brand-900/40 border border-brand-600/40 flex items-center justify-center flex-shrink-0">
                <ListChecks size={16} className="text-brand-400" />
              </div>
              <div className="font-bold text-lg">{activeStep.title}</div>
            </div>
            <div className="text-sm text-white/70 leading-relaxed">{activeStep.demo}</div>
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={() => setActiveStep(null)} className="flex-1">Close</GBtn>
              <GBtn onClick={goToStep} className="flex-1">Take me there →</GBtn>
            </div>
          </Glass>
        </div>
      )}

      {/* Persistent widget — collapsed pill or expanded checklist */}
      <div className="fixed bottom-5 right-5 z-[90]">
        {expanded ? (
          <Glass className="w-72 p-4 !bg-black/95 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold flex items-center gap-1.5"><ListChecks size={14} className="text-brand-400" />Getting Started</div>
              <div className="flex items-center gap-1">
                <button onClick={() => setExpanded(false)} className="p-1 text-white/40 hover:text-white"><ChevronUp size={14} className="rotate-180" /></button>
                <button onClick={dismissForever} className="p-1 text-white/40 hover:text-brand-400"><X size={14} /></button>
              </div>
            </div>
            <div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand-600 to-green-600 transition-all duration-500 ease-out" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
              </div>
              <div className="text-[10px] text-white/40 mt-1">{doneCount} of {steps.length} complete</div>
            </div>
            <div className="space-y-1.5">
              {steps.map(s => (
                <button key={s.id} onClick={() => openStep(s)} className={"w-full flex items-center gap-2 text-left text-xs p-2 rounded-lg transition " + (s.done ? "text-white/40" : "text-white/80 hover:bg-white/5")}>
                  {s.done ? <CheckCircle size={14} className="text-green-500 flex-shrink-0" /> : <Circle size={14} className="text-white/25 flex-shrink-0" />}
                  <span className={s.done ? "line-through" : ""}>{s.title}</span>
                </button>
              ))}
            </div>
          </Glass>
        ) : (
          <button onClick={() => setExpanded(true)} className="flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-black/90 border border-brand-700/40 shadow-xl hover:border-brand-500/60 transition">
            <div className="relative w-6 h-6">
              <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
                <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
                <circle cx="12" cy="12" r="10" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round"
                  strokeDasharray={`${(doneCount / steps.length) * 62.8} 62.8`} className="transition-all duration-500 ease-out" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-white">{doneCount}/{steps.length} setup</span>
          </button>
        )}
      </div>
    </>
  );
}
