import React, { useState } from "react";
import { Building2, Users as UsersIcon, Upload, FileText, DollarSign, CheckCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GTxt } from "./GTxt";
import { uid, today, fmt } from "../../lib/utils";
import { parseDelimited, splitHeader, autoMapColumns, applyMapping, rowToCustomer, CUSTOMER_FIELD_MAP, CUSTOMER_FIELD_EXCLUDE } from "../../lib/customerImport";
import { CUSTOMER_LIMIT } from "../../lib/planLimits";
import type { AppSettings, Customer, Service } from "../../types";

const COMMON_SERVICES = ["Standard Service", "Repair", "Installation", "Maintenance Plan", "Consultation", "Commercial Service"];

// Same parser and column detection as the Customers page import (see
// lib/customerImport.ts) — email, phone, company, address/city/state/zip,
// notes, source, status and any other column all come through.
function parseCustomerCsv(text: string): Partial<Customer>[] {
  const parsed = splitHeader(parseDelimited(text));
  if (!parsed) return [];
  const mapping = autoMapColumns(parsed.headers, CUSTOMER_FIELD_MAP, CUSTOMER_FIELD_EXCLUDE);
  return applyMapping(parsed.headers, parsed.data, mapping).map(rowToCustomer).filter(Boolean).slice(0, CUSTOMER_LIMIT) as Partial<Customer>[];
}

export function OnboardingFlow({
  settings, setSettings, setCustomers, services = [], setServices, toast, onFinish,
}: {
  settings: AppSettings; setSettings: (fn: (s: AppSettings) => AppSettings) => void;
  setCustomers: (fn: (c: Customer[]) => Customer[]) => void;
  services?: Service[]; setServices: (fn: (s: Service[]) => Service[]) => void;
  toast: (msg: string, tone?: string) => void; onFinish: () => void;
}) {
  const [step, setStep] = useState(1);
  const [years, setYears] = useState(String(settings.onboardingYearsInBusiness || ""));
  const [teamSize, setTeamSize] = useState(String(settings.onboardingTeamSize || ""));
  const [servicesOffered, setServicesOffered] = useState<string[]>(settings.onboardingServicesOffered || []);
  const [csvText, setCsvText] = useState("");
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [rates, setRates] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    COMMON_SERVICES.forEach(name => {
      const existing = services.find(s => s.name.toLowerCase().includes(name.split(" ")[0].toLowerCase()));
      init[name] = existing ? String(existing.basePrice) : "";
    });
    return init;
  });

  const toggleService = (s: string) => setServicesOffered(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const saveStep1 = () => {
    setSettings(prev => ({ ...prev, onboardingYearsInBusiness: Number(years) || undefined, onboardingTeamSize: Number(teamSize) || undefined, onboardingServicesOffered: servicesOffered }));
    setStep(2);
  };

  const applyImport = (parsed: Partial<Customer>[]) => {
    if (parsed.length === 0) { toast("No valid rows found", "yellow"); return; }
    // First-run onboarding replaces seed demo data wholesale with the
    // owner's real imported list, rather than appending to fake records.
    setCustomers(() => parsed as Customer[]);
    setImportedCount(parsed.length);
    toast(`Imported ${parsed.length} client${parsed.length !== 1 ? "s" : ""} ✓`, "green");
  };

  const importFromPaste = () => applyImport(parseCustomerCsv(csvText));
  const importFromFile = (file: File) => {
    const r = new FileReader();
    r.onload = () => applyImport(parseCustomerCsv(r.result as string));
    r.readAsText(file);
  };

  const saveStep3 = () => {
    setServices(prev => prev.map(s => {
      const match = COMMON_SERVICES.find(name => s.name.toLowerCase().includes(name.split(" ")[0].toLowerCase()));
      const rate = match ? Number(rates[match]) : NaN;
      return rate > 0 ? { ...s, basePrice: rate } : s;
    }));
    setStep(4);
  };

  const finish = () => {
    setSettings(prev => ({ ...prev, onboardingComplete: true }));
    onFinish();
  };

  const skip = () => {
    setSettings(prev => ({ ...prev, onboardingComplete: true }));
    onFinish();
  };

  const steps = [
    { n: 1, label: "Your Business", icon: Building2 },
    { n: 2, label: "Import Clients", icon: UsersIcon },
    { n: 3, label: "Set Rates", icon: DollarSign },
    { n: 4, label: "Ready", icon: CheckCircle },
  ];

  // FEATURE — "it should have cool animations and transitions and UI."
  // A fade+slide entrance keyed by step number (React remounts the panel
  // whenever `key` changes, which restarts the CSS animation every time),
  // plus an animated fill bar under the step dots that actually tracks
  // progress instead of just recoloring instantly.
  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center overflow-y-auto">
      <style>{`
        @keyframes onb-step-in { 0% { opacity: 0; transform: translateY(16px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .onb-step-panel { animation: onb-step-in 0.38s cubic-bezier(0.16,1,0.3,1); }
        @keyframes onb-dot-pop { 0% { transform: scale(0.7); } 60% { transform: scale(1.15); } 100% { transform: scale(1); } }
        .onb-dot-active { animation: onb-dot-pop 0.35s ease-out; }
      `}</style>
      <div className="w-full max-w-lg px-5 py-8 space-y-5">
        <div className="flex items-center justify-between">
          <div className="relative flex items-center gap-2">
            {/* Track + animated fill behind the dots */}
            <div className="absolute left-3.5 right-3.5 top-1/2 -translate-y-1/2 h-0.5 bg-white/10 -z-0" />
            <div
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-brand-600 to-green-600 -z-0 transition-all duration-500 ease-out"
              style={{ width: `calc(${((step - 1) / (steps.length - 1)) * 100}% - ${((step - 1) / (steps.length - 1)) * 28}px)` }}
            />
            {steps.map(s => (
              <div key={s.n} className={"relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors duration-300 " + (s.n === step ? "bg-brand-600 text-brand-fg onb-dot-active" : s.n < step ? "bg-green-700 text-white" : "bg-white/10 text-white/30")}>
                {s.n < step ? <CheckCircle size={14} /> : s.n}
              </div>
            ))}
          </div>
          <button onClick={skip} className="text-xs text-white/30 hover:text-white/60">Skip for now →</button>
        </div>

        {step === 1 && (
          <Glass key={1} className="onb-step-panel p-6 space-y-4">
            <div>
              <div className="text-xl font-bold flex items-center gap-2"><Building2 size={20} className="text-brand-400" />Tell us about your business</div>
              <div className="text-sm text-white/40 mt-1">This helps us tailor the dashboard to you.</div>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Years in business</label>
              <GInput type="number" min="0" value={years} onChange={(e: any) => setYears(e.target.value)} placeholder="e.g. 3" />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Team size (including you)</label>
              <GInput type="number" min="1" value={teamSize} onChange={(e: any) => setTeamSize(e.target.value)} placeholder="e.g. 4" />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-2 block">Services offered</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_SERVICES.map(s => (
                  <button key={s} onClick={() => toggleService(s)} className={"px-3 py-1.5 rounded-xl text-xs font-medium border transition " + (servicesOffered.includes(s) ? "bg-brand-900/40 border-brand-500/60 text-brand-200" : "bg-black/30 border-white/10 text-white/50 hover:text-white")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <GBtn onClick={saveStep1} className="w-full !justify-center !py-3">Continue <ChevronRight size={14} className="inline ml-1" /></GBtn>
          </Glass>
        )}

        {step === 2 && (
          <Glass key={2} className="onb-step-panel p-6 space-y-4">
            <div>
              <div className="text-xl font-bold flex items-center gap-2"><UsersIcon size={20} className="text-brand-400" />Import your clients</div>
              <div className="text-sm text-white/40 mt-1">Paste a CSV, upload a file, or skip and add clients later.</div>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><FileText size={11} />Paste CSV (firstName,lastName,email,phone,address)</label>
              <GTxt rows={5} value={csvText} onChange={(e: any) => setCsvText(e.target.value)} placeholder={"firstName,lastName,email,phone,address\nJane,Doe,jane@example.com,7175550100,123 Main St"} />
              <GBtn variant="ghost" onClick={importFromPaste} disabled={!csvText.trim()} className="w-full mt-2 !text-xs">Import Pasted CSV</GBtn>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" /><span className="text-xs text-white/30">or</span><div className="flex-1 h-px bg-white/10" />
            </div>
            <label className="cursor-pointer block">
              <input type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importFromFile(f); e.target.value = ""; }} />
              <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-black/40 border border-dashed border-white/20 text-white/60 hover:text-white hover:border-white/40 transition text-sm">
                <Upload size={14} />Upload CSV File
              </div>
            </label>
            {importedCount !== null && (
              <div className="text-xs text-green-400 text-center">✓ {importedCount} client{importedCount !== 1 ? "s" : ""} imported</div>
            )}
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={() => setStep(1)} className="flex-1"><ChevronLeft size={14} className="inline mr-1" />Back</GBtn>
              <GBtn onClick={() => setStep(3)} className="flex-1">Continue <ChevronRight size={14} className="inline ml-1" /></GBtn>
            </div>
          </Glass>
        )}

        {step === 3 && (
          <Glass key={3} className="onb-step-panel p-6 space-y-4">
            <div>
              <div className="text-xl font-bold flex items-center gap-2"><DollarSign size={20} className="text-brand-400" />Set your rates</div>
              <div className="text-sm text-white/40 mt-1">Default pricing for common services — you can change these anytime in Services.</div>
            </div>
            <div className="space-y-2">
              {COMMON_SERVICES.map(s => (
                <div key={s} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white/70 flex-1">{s}</span>
                  <div className="w-28">
                    <GInput type="number" min="0" step="5" value={rates[s]} onChange={(e: any) => setRates(prev => ({ ...prev, [s]: e.target.value }))} placeholder="$0" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={() => setStep(2)} className="flex-1"><ChevronLeft size={14} className="inline mr-1" />Back</GBtn>
              <GBtn onClick={saveStep3} className="flex-1">Continue <ChevronRight size={14} className="inline ml-1" /></GBtn>
            </div>
          </Glass>
        )}

        {step === 4 && (
          <Glass key={4} className="onb-step-panel p-6 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-600/50 flex items-center justify-center mx-auto onb-dot-active">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <div className="text-xl font-bold">You're ready!</div>
            <div className="text-sm text-white/50">Your dashboard is set up. Here's what's waiting for you:</div>
            <div className="grid grid-cols-3 gap-2 text-left">
              <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                <div className="text-[10px] text-white/40 uppercase">Years</div>
                <div className="text-lg font-bold">{years || "—"}</div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                <div className="text-[10px] text-white/40 uppercase">Clients</div>
                <div className="text-lg font-bold">{importedCount ?? 0}</div>
              </div>
              <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                <div className="text-[10px] text-white/40 uppercase">Team</div>
                <div className="text-lg font-bold">{teamSize || "1"}</div>
              </div>
            </div>
            <GBtn onClick={finish} className="w-full !justify-center !py-3">Go to Dashboard →</GBtn>
          </Glass>
        )}
      </div>
    </div>
  );
}
