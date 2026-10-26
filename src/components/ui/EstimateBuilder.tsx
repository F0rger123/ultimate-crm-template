// auto-extracted from CRM Starter monolith
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  LayoutDashboard, Users, FileText, Briefcase, Bot, BarChart3,
  Settings, Bell, Menu, X, Plus, Search, Edit, Trash2, Send,
  DollarSign, TrendingUp, CheckCircle, Clock, MapPin, Phone, Mail,
  Calendar, AlertTriangle, Truck, Receipt, FlaskConical, MessageSquare,
  Sun, Moon, Download, Undo2, Redo2, Volume2, Play, Cloud, Star,
  Award, Target, Shield, Key, Eye, EyeOff, Save, ChevronRight,
  ChevronLeft, GripVertical, Tag, Copy, Ban, RefreshCw, Percent,
  CreditCard, Repeat, XCircle, Activity, Zap, UserCheck, AlertCircle,
  Clipboard, Heart, Dumbbell, Droplet, Smile, Flame, Wind, Snowflake,
  Globe, Share2, Trophy, ExternalLink, Workflow, ToggleLeft, ToggleRight,
  Navigation, TrendingDown, PieChart as PieIcon, Package, Wrench,
  CheckSquare, Route, Users2, Layers, ArrowRight, BarChart2, Filter,
  Paperclip, ImageIcon, FileImage, MoreVertical, Mic, Upload, Link, Lock, User
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line,
  ComposedChart, Legend
} from "recharts";
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, weekdayLabels, computeDepositAmount, computeDiscountsTotal, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { CustomerPicker } from "./CustomerPicker";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { Stat } from "./Stat";
import { PBar } from "./PBar";
import { PageFade } from "./PageFade";
import { TimeframeSelector } from "./TimeframeSelector";

export function EstimateBuilder({ open, onClose, customers = [], services = [], settings = {}, onSave, estimateTemplates = [], setEstimateTemplates = (..._args: any[]) => {}, initialCustomerId = "", initialDraft = null }: { open: boolean; onClose: any; customers?: any[]; services?: any[]; settings?: any; onSave: any; estimateTemplates?: any[]; setEstimateTemplates?: any; initialCustomerId?: string; initialDraft?: { customerId?: string; lineItems?: any[]; notes?: string; discount?: number; depositRequired?: number } | null }) {
  const [cid, setCid] = useState("");
  const [items, setItems] = useState([]);
  const [vu, setVu] = useState(daysFromNow(30));
  const [discount, setDiscount] = useState(0);
  // FEATURE 7 — stackable named discounts (each $ or %), on top of the legacy
  // flat `discount` number above (kept only so old templates that already
  // set tpl.discount still apply their amount — no UI control for it anymore,
  // superseded by this list).
  const [discounts, setDiscounts] = useState<Array<{ id: string; label: string; type: "amount" | "percent"; value: number }>>([]);
  const [depositRequired, setDepositRequired] = useState(0);
  // FEATURE 6 — whether depositRequired is a flat dollar amount or a % of total.
  const [depositType, setDepositType] = useState<"amount" | "percent">("amount");
  // FEATURE (round 13, item 4) — mandatory vs optional deposit.
  const [depositMandatory, setDepositMandatory] = useState(false);
  // FIX 4 (mobile round 2) — recurring services quoted at the estimate
  // stage. Same field shape as Job's recurring fields (see types/index.ts)
  // so createJobFromApprovedEstimate can copy these straight onto the job.
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMode, setRecurringMode] = useState<"preset" | "days" | "weeks" | "months" | "weekdays">("preset");
  const [recurringFreq, setRecurringFreq] = useState("monthly");
  const [recurringInterval, setRecurringInterval] = useState(1);
  const [recurringWeekdays, setRecurringWeekdays] = useState<number[]>([]);
  const [terms, setTerms] = useState("");
  const [notes, setNotes] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const toggleExpand = (id: string) => setExpandedItems(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const [estimateType, setEstimateType] = useState<"standard" | "options" | "package">("standard");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("primary");
  const [packages, setPackages] = useState<Array<{ id: string; name: string; description: string; lineItems: any[] }>>([
    { id: uid(), name: "Basic", description: "", lineItems: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }] },
    { id: uid(), name: "Premium", description: "", lineItems: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }] },
  ]);
  const taxRate = Number((settings as any)?.taxRate || 0);

  // BUG FIX — "stays stuck on a client, super broken." This reset ran on
  // every change to `customers`, and the app refreshes that list every few
  // seconds — so while you built a quote it kept snapping the customer back
  // (to the first customer, or to the one it was opened for) and wiping the
  // line items. Now it resets only when the builder opens, or when it's
  // re-opened for a different customer / draft.
  const [saveError, setSaveError] = useState("");
  const openedRef = useRef(false);
  const openKeyRef = useRef("");
  useEffect(() => {
    if (!open) { openedRef.current = false; return; }
    const key = `${initialCustomerId || ""}|${initialDraft ? JSON.stringify(initialDraft).length + ":" + (initialDraft.customerId || "") : ""}`;
    if (openedRef.current && openKeyRef.current === key) return;
    openedRef.current = true;
    openKeyRef.current = key;
    setSaveError("");
    {
      // Lead Intake's "Convert to Estimate" (LeadIntakePage.tsx) opens this
      // builder pre-targeted at a specific customer via initialCustomerId,
      // same one-shot pattern as the FAB's autoOpenNew — falls back to the
      // first customer in the list (prior default behavior) when unset.
      // FEATURE (user report) — "Send a new estimate" button on a declined
      // quote, letting the owner adjust the price before resending.
      // initialDraft seeds this same blank-form reset with the declined
      // quote's line items/discount/deposit/notes instead of empty
      // defaults, so it's a real starting point to edit down, not a
      // from-scratch redo. Fresh ids on every line item — this always
      // creates a NEW estimate row, never mutates the declined one.
      const draftCustomerId = initialDraft?.customerId || initialCustomerId;
      // No silent default to the first customer — pick on purpose.
      setCid(draftCustomerId || "");
      setItems(initialDraft?.lineItems?.length
        ? initialDraft.lineItems.map((li: any) => ({ id: uid(), description: li.description, quantity: li.quantity, unitPrice: li.unitPrice }))
        : [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }]);
      setVu(daysFromNow(30));
      setDiscount(Number(initialDraft?.discount) || 0);
      setDiscounts([]);
      setDepositRequired(Number(initialDraft?.depositRequired) || 0);
      setDepositType((initialDraft as any)?.depositType === "percent" ? "percent" : "amount");
      setDepositMandatory(!!(initialDraft as any)?.depositMandatory);
      setIsRecurring(false);
      setRecurringMode("preset");
      setRecurringFreq("monthly");
      setRecurringInterval(1);
      setRecurringWeekdays([]);
      setTerms("Payment due upon completion. 3-day cancellation notice requested. Weather reschedules free of charge.");
      setNotes(initialDraft?.notes || "");
      setSavingTemplate(false);
      setTemplateName("");
      setEstimateType("standard");
      setSelectedAddressId("primary");
      setPackages([
        { id: uid(), name: "Basic", description: "", lineItems: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }] },
        { id: uid(), name: "Premium", description: "", lineItems: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }] },
      ]);
    }
  }, [open, initialCustomerId, initialDraft]); // eslint-disable-line react-hooks/exhaustive-deps

  const sub = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0);
  // FEATURE 7 — combined total of every stacked discount + the legacy flat field.
  const discountsTotal = computeDiscountsTotal(discounts, sub) + Number(discount);
  const afterDisc = Math.max(0, sub - discountsTotal);
  const tax = afterDisc * (taxRate / 100);
  const tot = afterDisc + tax;
  // FEATURE 6 — actual deposit dollar figure, whichever mode is selected.
  // A deposit can never be more than the estimate itself.
  const depositAmt = Math.min(tot, computeDepositAmount({ depositRequired: Number(depositRequired), depositType }, tot));

  const addDiscount = () => setDiscounts(prev => [...prev, { id: uid(), label: "", type: "amount", value: 0 }]);
  const updateDiscountRow = (id: string, patch: any) => setDiscounts(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
  const removeDiscount = (id: string) => setDiscounts(prev => prev.filter(d => d.id !== id));

  const addSvc = (sid: string) => {
    const s = services.find((x: any) => x.id === sid);
    if (!s) return;
    const price = Number((s as any).basePrice || (s as any).price || 0);
    const desc = s.name;
    const custDesc = (s as any).customerDescription || "";
    const intNotes = (s as any).internalNotes || "";
    setItems((prev: any[]) => [...prev.filter((i: any) => i.description), { id: uid(), description: desc, quantity: 1, unitPrice: price, catalogPrice: price, notes: custDesc || undefined, notesInternal: false, _serviceInternalNotes: intNotes || undefined, serviceId: sid }]);
    if (intNotes && !internalNote.includes(intNotes)) {
      setInternalNote(prev => prev ? prev + "\n" + intNotes : intNotes);
    }
    // Auto-apply this service's default deposit the first time a service
    // carrying one is added — only when the owner hasn't already set a
    // deposit by hand, so it never silently overwrites a manual choice.
    if ((s as any).depositRequired && !depositRequired) {
      setDepositRequired(Number((s as any).depositRequired));
      setDepositType((s as any).depositType || "amount");
      setDepositMandatory(!!(s as any).depositMandatory);
    }
  };

  const loadTemplate = tpl => {
    setItems((tpl.lineItems || []).map(li => ({ ...li, id: uid() })));
    if (tpl.discount) setDiscount(tpl.discount);
    if (tpl.discounts) setDiscounts(tpl.discounts.map((d: any) => ({ ...d, id: uid() })));
    if (tpl.depositRequired) setDepositRequired(tpl.depositRequired);
    if (tpl.depositType) setDepositType(tpl.depositType);
    setDepositMandatory(!!tpl.depositMandatory);
    if (tpl.isRecurring) {
      setIsRecurring(true);
      setRecurringMode(tpl.recurringMode || "preset");
      setRecurringFreq(tpl.recurringFreq || "monthly");
      setRecurringInterval(tpl.recurringInterval || 1);
      setRecurringWeekdays(tpl.recurringWeekdays || []);
    }
    if (tpl.terms) setTerms(tpl.terms);
    if (tpl.notes) setNotes(tpl.notes);
    // Custom-uploaded PDF templates can't be parsed into structured line
    // items, so the original file is just opened for reference instead.
    if (tpl._docType === "pdf" && tpl._docContent) {
      window.open(tpl._docContent, "_blank");
    }
  };

  // Custom estimate templates uploaded as HTML or PDF. HTML text is pulled in
  // as the template's notes (best-effort — there's no reliable way to turn
  // arbitrary markup into structured line items); a PDF can't be parsed at
  // all, so it's kept as-is and opened for reference when loaded.
  const handleUploadTemplate = (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const reader = new FileReader();
    reader.onload = () => {
      if (isPdf) {
        setEstimateTemplates(prev => [...prev, {
          id: uid(), name: file.name, lineItems: [], terms: "", notes: `Custom PDF template: ${file.name}`,
          _docType: "pdf", _docContent: reader.result as string, createdAt: today(),
        }]);
      } else {
        const text = String(reader.result).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        setEstimateTemplates(prev => [...prev, {
          id: uid(), name: file.name, lineItems: [], terms: "", notes: text.slice(0, 2000),
          _docType: "html", _docContent: String(reader.result), createdAt: today(),
        }]);
      }
    };
    if (isPdf) reader.readAsDataURL(file); else reader.readAsText(file);
  };

  const saveAsTemplate = () => {
    if (!templateName.trim()) return;
    const tpl = {
      id: uid(), name: templateName.trim(), lineItems: items, discount: Number(discount), discounts, depositRequired: Number(depositRequired), depositType, depositMandatory, terms, notes, createdAt: today(),
      ...(isRecurring ? { isRecurring, recurringMode, recurringFreq, recurringInterval, recurringWeekdays } : {}),
    };
    setEstimateTemplates(prev => [...prev, tpl]);
    setSavingTemplate(false);
    setTemplateName("");
  };

  const submit = () => {
    // Say what's missing instead of doing nothing.
    if (!cid || !customers.some((c: any) => c.id === cid)) { setSaveError("Choose a customer first."); return; }
    if (estimateType !== "package" && items.some((i: any) => !String(i.description || "").trim())) { setSaveError("Every line needs a description (or remove the empty line)."); return; }
    if (estimateType !== "package" && !items.length) { setSaveError("Add at least one line item."); return; }
    if (estimateType === "package" && !packages.some(p => p.lineItems.some((li: any) => String(li.description || "").trim()))) { setSaveError("Give at least one package a line item."); return; }
    setSaveError("");
    const pkgData = estimateType === "package" ? packages.map(p => ({
      ...p,
      subtotal: p.lineItems.reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unitPrice), 0),
    })) : undefined;
    const usedItems = estimateType === "package" ? [] : items;
    onSave({
      id: uid(), customerId: cid, estimateType, lineItems: usedItems, packages: pkgData, subtotal: sub, discount: Number(discount), discounts, depositRequired: Number(depositRequired), depositType, depositMandatory, tax, total: tot, status: "pending", createdAt: today(), validUntil: vu, viewed: false, viewedAt: null, terms, notes, internalNote,
      ...(isRecurring ? { isRecurring, recurringMode, recurringFreq, recurringInterval, recurringWeekdays } : {}),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Build Estimate" maxW="max-w-3xl">
      <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block">Customer</label><CustomerPicker customers={customers} value={cid} onChange={id => { setCid(id); setSelectedAddressId("primary"); setSaveError(""); }} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Valid until</label><GDate value={vu} onChange={e => setVu(e.target.value)} /></div>
        </div>

        {/* Address selector — shown when customer has additional addresses */}
        {(() => {
          const cust = customers.find((c: any) => c.id === cid);
          const addrs = cust?.addresses || [];
          if (!addrs.length) return null;
          return (
            <div>
              <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><MapPin size={10} />Service Address</label>
              <GSel value={selectedAddressId} onChange={e => setSelectedAddressId(e.target.value)} className="!text-xs">
                <option value="primary" className="bg-black">Primary — {cust?.address}</option>
                {addrs.map((a: any) => <option key={a.id} value={a.id} className="bg-black">{a.label ? `${a.label} — ` : ""}{a.street}{a.city ? `, ${a.city}` : ""}</option>)}
              </GSel>
            </div>
          );
        })()}

        {/* Estimate Type selector */}
        <div>
          <label className="text-xs text-white/60 mb-1.5 block">Estimate Type</label>
          <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
            {([["standard", "Standard", "Fixed price, accept/decline"], ["options", "Options", "Customer toggles items"], ["package", "Package", "Customer picks a tier"]] as const).map(([v, label, desc]) => (
              <button key={v} onClick={() => setEstimateType(v)} className={"flex-1 px-2 py-2 rounded-lg text-xs text-center transition " + (estimateType === v ? "bg-brand-600 text-brand-fg font-medium" : "text-white/50 hover:text-white hover:bg-white/5")}>
                <div className="font-medium">{label}</div>
                <div className={"text-[9px] mt-0.5 " + (estimateType === v ? "text-brand-200/70" : "text-white/30")}>{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Template loader */}
        <div className="flex items-center gap-2 p-3 bg-purple-950/20 border border-purple-700/30 rounded-xl">
          <Layers size={13} className="text-purple-400 flex-shrink-0" />
          <label className="text-xs text-white/60 flex-shrink-0">Load template:</label>
          <GSel onChange={e => { if (e.target.value) { const t = estimateTemplates.find(x => x.id === e.target.value); if (t) loadTemplate(t); e.target.value = ""; } }} value="" className="!text-xs flex-1">
            <option value="" className="bg-black">— Choose template —</option>
            {estimateTemplates.map(t => <option key={t.id} value={t.id} className="bg-black">{t.name}{t._docType ? ` (custom ${t._docType.toUpperCase()})` : ""}</option>)}
          </GSel>
          <label className="text-xs px-2.5 py-1.5 rounded-lg border border-purple-700/40 text-purple-300 hover:bg-purple-900/30 cursor-pointer flex-shrink-0 flex items-center gap-1">
            <Upload size={11} />Upload
            <input type="file" accept=".html,.htm,.pdf,application/pdf,text/html" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadTemplate(f); e.target.value = ""; }} />
          </label>
        </div>

        <div className="p-3 bg-black/40 border border-brand-900/20 rounded-xl">
          <label className="text-xs text-white/60 mb-1 block">Add from catalog</label>
          <GSel onChange={e => e.target.value && addSvc(e.target.value)} value="">
            <option value="" className="bg-black">Select service…</option>
            {(services as any[]).map(s => {
              const price = s.basePrice || s.price || 0;
              const range = s.minPrice && s.maxPrice ? ` (${fmt(s.minPrice)}–${fmt(s.maxPrice)})` : "";
              return <option key={s.id} value={s.id} className="bg-black">{s.name} — {fmt(price)}{range}</option>;
            })}
          </GSel>
        </div>

        {/* Package builder — shown only for package type */}
        {estimateType === "package" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-white/60">Packages ({packages.length})</label>
              {packages.length < 4 && <button onClick={() => setPackages(p => [...p, { id: uid(), name: `Package ${p.length + 1}`, description: "", lineItems: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }] }])} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"><Plus size={12} />Add Package</button>}
            </div>
            {packages.map((pkg, pi) => (
              <Glass key={pkg.id} className="p-3 !bg-black/40">
                <div className="flex items-center gap-2 mb-2">
                  <GInput value={pkg.name} onChange={e => setPackages(p => p.map((x, i) => i === pi ? { ...x, name: e.target.value } : x))} placeholder="Package name (e.g. Basic)" className="!text-xs font-medium flex-1" />
                  {packages.length > 2 && <button onClick={() => setPackages(p => p.filter((_, i) => i !== pi))} className="p-1.5 text-danger-400/60 hover:text-danger-400"><Trash2 size={12} /></button>}
                </div>
                <GInput value={pkg.description} onChange={e => setPackages(p => p.map((x, i) => i === pi ? { ...x, description: e.target.value } : x))} placeholder="What's included…" className="!text-xs mb-2" />
                <div className="space-y-1.5">
                  {pkg.lineItems.map((li: any) => (
                    // BUG FIX (mobile audit) — this grid had no md: breakpoints
                    // at all, unlike the near-identical non-package line-item
                    // grid below it — Service/Qty/Price squeezed to ~20-30px
                    // slivers on a 375px screen, effectively unusable for
                    // estimates built on-site in front of the customer.
                    <div key={li.id} className="grid grid-cols-12 gap-1 items-center">
                      <div className="col-span-12 md:col-span-7"><GInput placeholder="Service" value={li.description} onChange={e => setPackages(p => p.map((x, i) => i === pi ? { ...x, lineItems: x.lineItems.map((l: any) => l.id === li.id ? { ...l, description: e.target.value } : l) } : x))} className="!text-xs" /></div>
                      <div className="col-span-4 md:col-span-2"><GInput type="number" placeholder="Qty" value={li.quantity} onChange={e => setPackages(p => p.map((x, i) => i === pi ? { ...x, lineItems: x.lineItems.map((l: any) => l.id === li.id ? { ...l, quantity: e.target.value } : l) } : x))} className="!text-xs" /></div>
                      <div className="col-span-5 md:col-span-2"><GInput type="number" step="0.01" min="0" placeholder="$" value={li.unitPrice} onChange={e => setPackages(p => p.map((x, i) => i === pi ? { ...x, lineItems: x.lineItems.map((l: any) => l.id === li.id ? { ...l, unitPrice: e.target.value } : l) } : x))} className="!text-xs" /></div>
                      <div className="col-span-3 md:col-span-1 text-right">{pkg.lineItems.length > 1 && <button onClick={() => setPackages(p => p.map((x, i) => i === pi ? { ...x, lineItems: x.lineItems.filter((l: any) => l.id !== li.id) } : x))} className="p-1 text-brand-400/60 hover:text-brand-400"><X size={10} /></button>}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button onClick={() => setPackages(p => p.map((x, i) => i === pi ? { ...x, lineItems: [...x.lineItems, { id: uid(), description: "", quantity: 1, unitPrice: 0 }] } : x))} className="text-[10px] text-brand-400/60 hover:text-brand-400 flex items-center gap-1"><Plus size={10} />Add line</button>
                  <div className="text-xs font-bold text-brand-400">{fmt(pkg.lineItems.reduce((s: number, l: any) => s + Number(l.quantity) * Number(l.unitPrice), 0))}</div>
                </div>
              </Glass>
            ))}
          </div>
        )}

        <div className={estimateType === "package" ? "hidden" : ""}>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-white/60">{estimateType === "options" ? "Line items (every item is customer-toggleable by default — check \"req\" to lock one in)" : "Line items"}</label>
            <div className="flex items-center gap-2">
              {/* Every item defaults to toggleable now (see the "req"
                  checkbox below) — this clears any items marked required
                  back to that default in one click. */}
              {estimateType === "options" && items.some((i: any) => i.optional === false) && (
                <button onClick={() => setItems((items as any[]).map(i => ({ ...i, optional: undefined })))} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">Make all toggleable</button>
              )}
              <button onClick={() => setSavingTemplate(!savingTemplate)} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1"><Save size={10} />Save as template</button>
              <button onClick={() => setItems([...items, { id: uid(), description: "", quantity: 1, unitPrice: 0 }])} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"><Plus size={12} /> Add</button>
            </div>
          </div>
          {savingTemplate && <div className="flex gap-2 mb-2 p-2.5 bg-purple-950/20 border border-purple-700/30 rounded-xl">
            <GInput placeholder="Template name (e.g. Standard + Add-on Package)" value={templateName} onChange={e => setTemplateName(e.target.value)} onKeyDown={e => e.key === "Enter" && saveAsTemplate()} className="!text-xs flex-1" />
            <GBtn onClick={saveAsTemplate} disabled={!templateName.trim()} className="!text-xs !py-1.5 flex-shrink-0">Save</GBtn>
            <button onClick={() => setSavingTemplate(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
          </div>}
          <div className="space-y-1.5">
            {(items as any[]).map(it => {
              const isExpanded = expandedItems.includes(it.id);
              return (
                <div key={it.id} className={"rounded-xl border transition " + (isExpanded ? "border-white/15 bg-white/5" : "border-transparent")}>
                  <div className="grid grid-cols-12 gap-2 items-center p-1">
                    <div className="col-span-12 md:col-span-6">
                      <GInput placeholder="Description" value={it.description} onChange={e => setItems((items as any[]).map(i => i.id === it.id ? { ...i, description: e.target.value } : i))} />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <GInput type="number" placeholder="Qty" value={it.quantity} onChange={e => setItems((items as any[]).map(i => i.id === it.id ? { ...i, quantity: e.target.value } : i))} />
                    </div>
                    <div className="col-span-5 md:col-span-3">
                      <GInput type="number" step="0.01" min="0" placeholder="Price" value={it.unitPrice} onChange={e => setItems((items as any[]).map(i => i.id === it.id ? { ...i, unitPrice: e.target.value } : i))} />
                      {it.catalogPrice && Number(it.catalogPrice) !== Number(it.unitPrice) && (
                        <div className="text-[9px] text-blue-400/60 mt-0.5">Suggested: {fmt(Number(it.catalogPrice))}</div>
                      )}
                    </div>
                    <div className="col-span-3 md:col-span-1 flex items-center justify-end gap-0.5">
                      {/* BUG FIX — "options quote logic doesn't make sense,
                          some items can't be toggled." Every item in an
                          Options quote is customer-toggleable BY DEFAULT
                          now (that's what choosing "Options" as the
                          estimate type means) — this checkbox is the rare
                          exception: mark ONE item required/locked instead
                          of opting each item INTO being toggleable one at
                          a time (the old, easy-to-forget default that left
                          most real quotes with unclickable items). */}
                      {estimateType === "options" && (
                        <label title="Required — customer can't remove this item" className="flex items-center gap-0.5 cursor-pointer mr-1">
                          <input type="checkbox" checked={it.optional === false} onChange={e => setItems((items as any[]).map(i => i.id === it.id ? { ...i, optional: e.target.checked ? false : undefined } : i))} className="w-3 h-3 accent-blue-500" />
                          <span className="text-[9px] text-blue-400">req</span>
                        </label>
                      )}
                      <button onClick={() => toggleExpand(it.id)} title="Notes & photo" className={"p-1.5 rounded-lg transition " + (isExpanded ? "bg-white/10 text-white" : "text-white/30 hover:text-white hover:bg-white/5")}>
                        <Paperclip size={12} />
                      </button>
                      {(items as any[]).length > 1 && <button onClick={() => setItems((items as any[]).filter(i => i.id !== it.id))} className="p-1.5 text-danger-400/60 hover:text-danger-400 hover:bg-danger-900/20 rounded-lg"><Trash2 size={12} /></button>}
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-2 pb-2 space-y-2">
                      <div className="flex items-start gap-2">
                        {it.photo && <img src={it.photo} alt="" className="w-12 h-12 rounded-lg object-cover border border-white/10 flex-shrink-0" />}
                        <label className="cursor-pointer flex-shrink-0">
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                            const f = e.target.files?.[0]; if (!f) return;
                            const r = new FileReader();
                            r.onload = ev => setItems((items as any[]).map(i => i.id === it.id ? { ...i, photo: ev.target!.result as string } : i));
                            r.readAsDataURL(f); e.target.value = "";
                          }} />
                          <div className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 cursor-pointer transition">
                            <Plus size={8} />{it.photo ? "Change Photo" : "📷 Add Photo"}
                          </div>
                        </label>
                        {it.photo && <button onClick={() => setItems((items as any[]).map(i => i.id === it.id ? { ...i, photo: undefined } : i))} className="text-[10px] text-danger-400/60 hover:text-danger-400 px-1.5 py-1 rounded border border-danger-900/30">Remove</button>}
                      </div>
                      <div className="flex items-center gap-2">
                        <GTxt rows={1} value={it.notes || ""} onChange={e => setItems((items as any[]).map(i => i.id === it.id ? { ...i, notes: e.target.value } : i))} placeholder={it.notesInternal ? "Internal note (crew only)…" : "Notes (visible on estimate)…"} className="!text-xs flex-1" />
                        <label className="flex items-center gap-1 text-[10px] text-white/50 whitespace-nowrap cursor-pointer flex-shrink-0">
                          <input type="checkbox" checked={!!it.notesInternal} onChange={e => setItems((items as any[]).map(i => i.id === it.id ? { ...i, notesInternal: e.target.checked } : i))} className="w-3 h-3 accent-yellow-500" />
                          <Lock size={8} className="text-yellow-400" />Internal
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FEATURE 7 — stackable named discounts (title + $ or %), each shows
            on the estimate/invoice the client sees. */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-white/60 block">Discounts</label>
            <button type="button" onClick={addDiscount} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={11} />Add Discount</button>
          </div>
          <div className="space-y-1.5">
            {discounts.map(d => (
              <div key={d.id} className="flex items-center gap-2">
                <GInput value={d.label} onChange={e => updateDiscountRow(d.id, { label: e.target.value })} placeholder="e.g. First-time customer discount" className="!text-xs flex-1 min-w-0" />
                <GSel value={d.type} onChange={e => updateDiscountRow(d.id, { type: e.target.value })} className="!text-xs !w-24 flex-shrink-0">
                  <option value="amount" className="bg-black">$</option>
                  <option value="percent" className="bg-black">%</option>
                </GSel>
                <GInput type="number" step={d.type === "percent" ? "1" : "0.01"} value={d.value} onChange={e => updateDiscountRow(d.id, { value: Number(e.target.value) || 0 })} className="!text-xs !w-24 flex-shrink-0" />
                <button type="button" onClick={() => removeDiscount(d.id)} className="p-1.5 text-white/30 hover:text-danger-400 flex-shrink-0"><Trash2 size={12} /></button>
              </div>
            ))}
            {discounts.length === 0 && <div className="text-[10px] text-white/30">No discounts added</div>}
          </div>
        </div>

        <div>
          <label className="text-xs text-white/60 mb-1 block">Deposit Required</label>
          <div className="flex items-center gap-2">
            <GInput type="number" step={depositType === "percent" ? "1" : "0.01"} value={depositRequired} onChange={e => setDepositRequired(e.target.value)} className="flex-1" />
            <GSel value={depositType} onChange={e => setDepositType(e.target.value as any)} className="!w-24 flex-shrink-0">
              <option value="amount" className="bg-black">$</option>
              <option value="percent" className="bg-black">%</option>
            </GSel>
          </div>
          {Number(depositRequired) > 0 && <div className="text-[10px] text-white/40 mt-1">Deposit due now: {fmt(depositAmt)} · Balance due after service: {fmt(Math.max(0, tot - depositAmt))}</div>}
          {/* FEATURE (round 13, item 4) — mandatory vs optional deposit. When
              mandatory, the customer's estimate page only offers "Pay a
              Deposit Now" — no "Pay in Full Now"/"Pay in Full After Service"
              alternative — so the deposit actually gets collected before the
              job is booked instead of being skippable. */}
          {Number(depositRequired) > 0 && (
            <label className="flex items-center gap-2 mt-2 text-xs text-white/60 cursor-pointer">
              <input type="checkbox" checked={depositMandatory} onChange={e => setDepositMandatory(e.target.checked)} className="accent-brand-600" />
              Require this deposit — customer can't skip to "pay in full" or "pay later"
            </label>
          )}
        </div>

        {/* FIX 4 (mobile round 2) — recurring option at the quote stage, so a
            recurring service can be sold/approved before a job even exists.
            Mirrors JobsPage/JobDetailModal's recurring editor. */}
        <div className="p-3 rounded-xl border border-white/10 bg-black/20 space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="accent-brand-600 w-3.5 h-3.5" />
            <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5"><Repeat size={12} />This is a recurring service</span>
          </label>
          {isRecurring && (
            <div className="p-3 rounded-xl border border-blue-700/30 bg-blue-950/10 space-y-2.5">
              <GSel value={recurringMode} onChange={e => setRecurringMode(e.target.value as any)}>
                <option value="preset" className="bg-black">Preset (weekly, monthly, etc.)</option>
                <option value="days" className="bg-black">Every X days</option>
                <option value="weeks" className="bg-black">Every X weeks</option>
                <option value="months" className="bg-black">Every X months</option>
                <option value="weekdays" className="bg-black">Specific days of week</option>
              </GSel>

              {recurringMode === "preset" && (
                <GSel value={recurringFreq} onChange={e => setRecurringFreq(e.target.value)}>
                  {recurringFreqs.map(f => <option key={f.key} value={f.key} className="bg-black">{f.label}</option>)}
                </GSel>
              )}

              {(recurringMode === "days" || recurringMode === "weeks" || recurringMode === "months") && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">Every</span>
                  <GInput type="number" min="1" step="1" value={recurringInterval} onChange={e => setRecurringInterval(Math.max(1, Number(e.target.value) || 1))} className="!w-20" />
                  <span className="text-xs text-white/50">{recurringMode}</span>
                </div>
              )}

              {recurringMode === "weekdays" && (
                <div className="flex flex-wrap gap-1.5">
                  {weekdayLabels.map((lbl, i) => {
                    const active = recurringWeekdays.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRecurringWeekdays(prev => active ? prev.filter(d => d !== i) : [...prev, i].sort())}
                        className={"px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition " + (active ? "bg-brand-600 border-brand-500 text-brand-fg" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="text-[10px] text-white/40">Once approved and scheduled, this recurring pattern carries over to the job automatically.</div>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Shield size={10} />Terms & Conditions</label><GTxt rows={3} value={terms} onChange={e => setTerms(e.target.value)} placeholder="Payment terms, cancellation policy..." className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Clipboard size={10} />Customer Notes <span className="text-white/30 font-normal">(visible on estimate)</span></label><GTxt rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. 'Includes cleanup and haul-away'" className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Lock size={10} className="text-yellow-400" />Internal Notes <span className="text-white/30 font-normal">(crew only, not shown to customer)</span></label><GTxt rows={2} value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Gate code, dog warning, access issues, chemical notes..." className="!text-xs border-yellow-900/30" /></div>
        </div>

        <Glass className="p-4 !rounded-xl bg-black/60">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-white/70"><span>Subtotal</span><span>{fmt(sub)}</span></div>
            {discounts.map(d => Number(d.value) > 0 && (
              <div key={d.id} className="flex justify-between text-green-400"><span>{d.label || "Discount"}{d.type === "percent" ? ` (${d.value}%)` : ""}</span><span>− {fmt(d.type === "percent" ? sub * (Number(d.value) / 100) : Number(d.value))}</span></div>
            ))}
            {Number(discount) > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><span>− {fmt(Number(discount))}</span></div>}
            <div className="flex justify-between text-white/70"><span>Tax ({taxRate}%)</span><span>{fmt(tax)}</span></div>
            <div className="flex justify-between font-bold text-white text-base pt-2 border-t border-brand-900/30"><span>Total</span><span className="text-brand-400">{fmt(tot)}</span></div>
            {Number(depositRequired) > 0 && (
              <>
                <div className="flex justify-between text-yellow-400 text-xs pt-1"><span>Deposit due now</span><span>{fmt(depositAmt)}</span></div>
                <div className="flex justify-between text-white/50 text-xs"><span>Balance due after service</span><span>{fmt(Math.max(0, tot - depositAmt))}</span></div>
              </>
            )}
          </div>
        </Glass>

        {saveError && <div className="text-xs text-danger-300 text-right" role="alert">{saveError}</div>}
        <div className="flex gap-2 justify-end"><GBtn variant="ghost" onClick={onClose}>Cancel</GBtn><GBtn onClick={submit} data-builder-save>Create</GBtn></div>
      </div>
    </Modal>
  );
}

