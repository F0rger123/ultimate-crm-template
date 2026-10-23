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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { supabase } from "../../lib/supabase";
import { Glass } from "../ui/Glass";
import { ImportDataModal } from "../ui/ImportDataModal";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { PBar } from "../ui/PBar";
import { PageFade } from "../ui/PageFade";
import { TimeframeSelector } from "../ui/TimeframeSelector";
import { AddressAutocomplete } from "../ui/AddressAutocomplete";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { CustomerModal } from "../ui/CustomerModal";
import { CustomerDetail } from "../ui/CustomerDetail";
import { CustomerAnalytics } from "../ui/CustomerAnalytics";
import { EstimateBuilder } from "../ui/EstimateBuilder";
import { EstimatePreview } from "../ui/EstimatePreview";
import { JobDetailModal } from "../ui/JobDetailModal";
import { PipelineScrollContainer } from "../ui/PipelineScrollContainer";
import { SwipeableCard } from "../ui/SwipeableCard";
import { ReviewMonitor } from "../ui/ReviewMonitor";
import { ReviewLandingPage } from "../ui/ReviewLandingPage";
import { ReviewPreview } from "../ui/ReviewPreview";
import { VisualWorkflowBuilder } from "../ui/VisualWorkflowBuilder";
import { AutomationEditor } from "../ui/AutomationEditor";
import { VoiceMicButton } from "../ui/VoiceMicButton";
import { DocumentVault } from "../ui/DocumentVault";
import { ESignatureStep } from "../ui/ESignatureStep";
import { CACCalculator } from "../ui/CACCalculator";
import { MileageUpdateModal } from "../ui/MileageUpdateModal";
import { VehicleModal } from "../ui/VehicleModal";
import { MaintenanceModal } from "../ui/MaintenanceModal";
import { SocialCalendar } from "../ui/SocialCalendar";
import { BulkPhotoUpload } from "../ui/BulkPhotoUpload";
import { ReviewToGraphic } from "../ui/ReviewToGraphic";
import { ABTestPanel } from "../ui/ABTestPanel";
import { CampaignScheduler } from "../ui/CampaignScheduler";
import { PinSettings } from "../ui/PinSettings";
import { ServiceCatalogSection } from "../ui/ServiceCatalogSection";
import { TemplateEditor } from "../ui/TemplateEditor";
import { AIModelsSection } from "../ui/AIModelsSection";
import { WeeklyBusinessReview } from "../ui/WeeklyBusinessReview";
import { WeeklyReflectionTab } from "../ui/WeeklyReflectionTab";

export function ExpensesPage({ expenses = [], setExpenses, toast = (() => {}) as any }) {
  const [modal, setModal] = useState({ open: false, data: null });
  const [filterCat, setFilterCat] = useState("all");
  const [timeframe, setTimeframe] = useState("30d");
  const [tab, setTab] = useState("expenses"); // expenses | mileage
  const [mileageLog, setMileageLog] = usePersistent("crm.mileage", []);
  const [f, setF] = useState({ id: "", date: today(), category: "Supplies", description: "", amount: "", vendor: "", isCash: false, taxDeductible: true, receiptDataUrl: null });
  const [mf, setMf] = useState({ date: today(), from: "Shop - your area", to: "", miles: "", purpose: "", roundTrip: false });
  const [mileModal, setMileModal] = useState(false);
  // AUDIT FIX (mobile round 10) — "Mileage does not appear in the Expenses
  // section": this tab used to only read/write crm.mileage (owner's own
  // manual local entries) and never touched the mileage_logs Supabase table
  // employees actually submit to from the field portal (EmployeePortal.tsx)
  // and the owner approves in EmployeesPage.tsx. Approved employee mileage
  // now merges into this tab's totals so it actually shows up as an expense.
  const [employeeMileage, setEmployeeMileage] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    const fetchEmployeeMileage = async () => {
      try {
        const { data, error } = await (supabase as any).from("mileage_logs").select("*").eq("status", "approved");
        if (!cancelled && !error && Array.isArray(data)) setEmployeeMileage(data);
      } catch (e: any) {
        console.warn("[Expenses] mileage_logs fetch failed:", e?.message);
      }
    };
    fetchEmployeeMileage();
    const interval = setInterval(fetchEmployeeMileage, 60000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const categories = ["Supplies", "Materials", "Equipment", "Fuel", "Advertising", "Insurance", "Vehicle", "Tools", "Software", "Meals", "Phone", "Other"];
  const IRS_RATE = 0.67; // 2024 IRS mileage rate per mile

  // Normalized, unified shape so the mileage list/totals below don't need to
  // special-case the owner's local entries vs. employee-submitted (approved)
  // Supabase entries.
  const combinedMileageLog = [
    ...mileageLog,
    ...employeeMileage.map((m: any) => ({
      id: m.id, date: m.date, from: m.from, to: m.to, miles: Number(m.miles) || 0,
      deduction: (Number(m.miles) || 0) * IRS_RATE, purpose: m.purpose || "",
      source: "employee", employeeId: m.employee_id,
    })),
  ];

  const tfExp = filterByTimeframe(expenses, "date", timeframe);
  const displayed = filterCat === "all" ? tfExp : tfExp.filter(e => e.category === filterCat);
  const tfMiles = filterByTimeframe(combinedMileageLog, "date", timeframe);

  const totExp = displayed.reduce((s, e) => s + Number(e.amount), 0);
  const totMiles = tfMiles.reduce((s, m) => s + Number(m.miles), 0);
  const mileDeduction = totMiles * IRS_RATE;
  const deductible = displayed.filter(e => e.taxDeductible).reduce((s, e) => s + Number(e.amount), 0);

  const openAdd = () => { setF({ id: "", date: today(), category: "Supplies", description: "", amount: "", vendor: "", isCash: false, taxDeductible: true, receiptDataUrl: null }); setModal({ open: true, data: null }); };
  const openEdit = exp => { setF({ ...exp }); setModal({ open: true, data: exp }); };
  const save = () => {
    if (!f.description.trim() || !f.amount) return;
    if (f.id) setExpenses(prev => prev.map(e => e.id === f.id ? { ...f } : e));
    else setExpenses(prev => [{ ...f, id: uid() }, ...prev]);
    setModal({ open: false, data: null });
  };
  const del = id => { if (confirm("Delete expense?")) setExpenses(prev => prev.filter(e => e.id !== id)); };

  // FEATURE — "make budget personalized to each owner, allow importing from
  // Google Sheets, PDF, or CSV." Same shared ImportDataModal CustomersPage
  // uses; the fieldMap here matches Expense's own shape instead.
  const [importOpen, setImportOpen] = useState(false);
  const expenseImportFieldMap = {
    date: ["date", "transaction date", "expense date"],
    description: ["description", "memo", "details", "item"],
    amount: ["amount", "cost", "total", "price"],
    category: ["category", "type", "expense category"],
    vendor: ["vendor", "payee", "merchant", "paid to"],
  };
  const handleExpenseImport = (rows: Record<string, string>[]) => {
    const imported = rows.map(raw => ({
      id: uid(),
      date: raw.date || today(),
      description: raw.description || "Imported expense",
      amount: Number((raw.amount || "").replace(/[^0-9.-]/g, "")) || 0,
      category: raw.category || "Supplies",
      vendor: raw.vendor || "",
      isCash: false,
      taxDeductible: true,
    })).filter(e => e.amount > 0);
    if (imported.length === 0) { toast("No valid rows found — need at least an Amount column", "red"); return; }
    setExpenses(prev => [...imported, ...prev]);
    toast(`✅ Imported ${imported.length} expense(s)`, "green");
  };

  const saveMileage = () => {
    if (!mf.to.trim() || !mf.miles) return;
    const miles = Number(mf.miles) * (mf.roundTrip ? 2 : 1);
    setMileageLog(prev => [{ ...mf, id: uid(), miles, deduction: miles * IRS_RATE }, ...prev]);
    setMf({ date: today(), from: "Shop - your area", to: "", miles: "", purpose: "", roundTrip: false });
    setMileModal(false);
  };

  const exportPDF = () => {
    const rows = displayed.map(e => `<tr><td>${e.date}</td><td>${e.category}</td><td>${e.vendor || "—"}</td><td>${e.description}</td><td style="text-align:right">${fmt(Number(e.amount))}</td><td style="text-align:center">${e.isCash ? "💵" : "💳"}</td><td style="text-align:center">${e.taxDeductible ? "✓" : ""}</td></tr>`).join("");
    const mileRows = tfMiles.map(m => `<tr><td>${m.date}</td><td>${m.from} → ${m.to}</td><td>${m.miles} mi</td><td>${fmt(m.deduction)}</td><td>${m.purpose}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Expense Report — CRM Starter</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:900px;margin:auto}h1{color:#111111;margin:0}h2{color:#555;font-size:14px;margin-top:0}.header{display:flex;justify-content:space-between;border-bottom:3px solid #111111;padding-bottom:16px;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:24px}th{background:#f9f9f9;padding:8px 10px;text-align:left;border-bottom:2px solid #ddd;text-transform:uppercase;font-size:10px;letter-spacing:.5px}td{padding:8px 10px;border-bottom:1px solid #eee}.total{background:#f5f5f5;font-weight:bold;color:#111111}.sum{margin-top:8px;text-align:right;font-size:13px}@media print{body{padding:20px}}</style></head><body>
    <div class="header"><div><h1>CRM Starter</h1><h2>Expense Report · ${tfLabel} · Generated ${today()}</h2></div><div style="text-align:right;font-size:12px;color:#666">your area · (555) 555-0100</div></div>
    <h3>Expenses</h3><table><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th style="text-align:right">Amount</th><th style="text-align:center">Method</th><th style="text-align:center">Deductible</th></tr></thead><tbody>${rows}<tr class="total"><td colspan="4">TOTAL</td><td style="text-align:right">${fmt(totExp)}</td><td></td><td></td></tr></tbody></table>
    <div class="sum">Tax-deductible total: <strong>${fmt(deductible)}</strong></div>
    ${tfMiles.length ? `<h3 style="margin-top:32px">Mileage Log (IRS rate $${IRS_RATE}/mi)</h3><table><thead><tr><th>Date</th><th>Route</th><th>Miles</th><th>Deduction</th><th>Purpose</th></tr></thead><tbody>${mileRows}<tr class="total"><td colspan="2">TOTAL</td><td>${totMiles.toFixed(1)} mi</td><td>${fmt(mileDeduction)}</td><td></td></tr></tbody></table>
    <div class="sum">Grand total (expenses + mileage deduction): <strong>${fmt(totExp + mileDeduction)}</strong></div>` : ""}
    <script>window.onload=()=>setTimeout(window.print,300)</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  };

  const catTotals = categories.map(cat => ({ cat, total: tfExp.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0) })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
  const tfLabel = TIMEFRAMES.find(t => t.key === timeframe)?.label || "All";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-black/40 border border-brand-900/30 rounded-xl p-1">
          {["expenses","mileage"].map(t => <button key={t} onClick={() => setTab(t)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition " + (tab === t ? "bg-brand-600 text-brand-fg" : "text-white/50 hover:text-white")}>{t === "expenses" ? "💸 Expenses" : "🚗 Mileage"}</button>)}
        </div>
        {/* BUG FIX — "the import button and other elements are partially
            cut off on mobile." Four controls in one row with no wrap of
            their own — the outer header row could wrap around this whole
            group, but nothing let the group wrap internally, so on a
            narrow screen the tail end just ran off-viewport instead of
            dropping to a second line. */}
        <div className="flex items-center gap-2 flex-wrap">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} options={["7d","30d","90d","6m","1y","all"]} compact />
          <GBtn variant="ghost" onClick={exportPDF} className="!text-xs"><Download size={12} className="inline mr-1" />Export PDF</GBtn>
          {tab === "expenses" && <GBtn variant="ghost" onClick={() => setImportOpen(true)} className="!text-xs"><Download size={12} className="inline mr-1 rotate-180" />Import</GBtn>}
          {tab === "expenses" ? <GBtn onClick={openAdd} className="!text-xs"><Plus size={12} className="inline mr-1" />Add Expense</GBtn> : <GBtn onClick={() => setMileModal(true)} className="!text-xs"><Plus size={12} className="inline mr-1" />Log Miles</GBtn>}
        </div>
      </div>
      <ImportDataModal open={importOpen} onClose={() => setImportOpen(false)} title="Import Expenses" fieldMap={expenseImportFieldMap} onImport={handleExpenseImport} toast={toast} />

      {tab === "expenses" && <>
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={DollarSign} label={"Total (" + tfLabel + ")"} value={fmt(totExp)} />
          <Stat icon={Receipt} label="Entries" value={displayed.length} />
          <Stat icon={TrendingUp} label="Tax Deductible" value={fmt(deductible)} />
          <Stat icon={Percent} label="Deductible %" value={totExp > 0 ? Math.round(deductible / totExp * 100) + "%" : "—"} />
          {/* AUDIT FIX (mobile round 10) — mileage previously only showed up
              on its own separate tab; surfaced here too, in the main
              Expenses view, since mileage IS a deductible expense. */}
          <button onClick={() => setTab("mileage")} className="text-left"><Stat icon={Route} label={"Mileage Deduction (" + totMiles.toFixed(0) + " mi)"} value={fmt(mileDeduction)} /></button>
        </div>

        {/* Category breakdown */}
        {catTotals.length > 0 && <Glass className="p-4">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3">By Category</div>
          <div className="space-y-2">
            {catTotals.slice(0, 6).map(c => <div key={c.cat} className="flex items-center gap-3">
              <div className="text-xs text-white/70 w-24 truncate">{c.cat}</div>
              <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-brand-600 rounded-full text-brand-fg" style={{ width: (c.total / catTotals[0].total * 100) + "%" }} /></div>
              <div className="text-xs font-semibold text-brand-400 w-16 text-right">{fmt(c.total)}</div>
            </div>)}
          </div>
        </Glass>}

        {/* Filters */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setFilterCat("all")} className={"text-xs px-2.5 py-1 rounded-lg border transition " + (filterCat === "all" ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>All ({tfExp.length})</button>
          {categories.filter(c => tfExp.some(e => e.category === c)).map(c => <button key={c} onClick={() => setFilterCat(c)} className={"text-xs px-2.5 py-1 rounded-lg border transition " + (filterCat === c ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>{c}</button>)}
        </div>

        {/* Expense list */}
        <Glass className="overflow-hidden">
          {displayed.length === 0 ? <div className="text-center py-12 text-white/40"><Receipt size={32} className="mx-auto mb-2 opacity-30" /><div>No expenses in this period</div></div>
          : <div className="divide-y divide-brand-900/10">
            {displayed.map(e => (
              <div key={e.id} className="flex items-start gap-3 p-4 hover:bg-white/5 group">
                <div className="w-10 h-10 rounded-xl bg-black/40 border border-brand-900/30 flex items-center justify-center flex-shrink-0 text-lg">{e.receiptDataUrl ? "🧾" : {Supplies:"🧴", Chemicals:"⚗️", Equipment:"🔧", Fuel:"⛽", Advertising:"📣", Insurance:"🛡️", Vehicle:"🚗", Tools:"🔨", Software:"💻", Meals:"🍔", Phone:"📱"}[e.category] || "💸"}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{e.description}</span>
                    <Badge>{e.category}</Badge>
                    {e.isCash && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-900/30 border border-green-700/40 text-green-300">💵 Cash</span>}
                    {e.taxDeductible && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/40 text-blue-300">✓ Deductible</span>}
                  </div>
                  <div className="text-xs text-white/50 mt-0.5 flex items-center gap-2">
                    <span>{e.date}</span>
                    {e.vendor && <><span>·</span><span>{e.vendor}</span></>}
                  </div>
                  {e.receiptDataUrl && <div className="mt-1.5"><img src={e.receiptDataUrl} alt="Receipt" className="h-10 rounded border border-white/10 object-cover" /></div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-brand-400 font-bold">{fmt(Number(e.amount))}</div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => openEdit(e)} className="p-1.5 rounded hover:bg-white/10 text-white/50"><Edit size={11} /></button>
                    <button onClick={() => del(e.id)} className="p-1.5 rounded hover:bg-danger-900/30 text-white/50 hover:text-danger-400"><Trash2 size={11} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>}
        </Glass>
      </>}

      {tab === "mileage" && <>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat icon={Route} label="Total Miles" value={totMiles.toFixed(1)} />
          <Stat icon={DollarSign} label="IRS Deduction" value={fmt(mileDeduction)} />
          <Stat icon={TrendingUp} label="Rate" value={"$" + IRS_RATE + "/mi"} />
        </div>
        <Glass className="overflow-hidden">
          {tfMiles.length === 0 ? <div className="text-center py-12 text-white/40"><Route size={32} className="mx-auto mb-2 opacity-30" /><div>No mileage logged in this period</div></div>
          : <div className="divide-y divide-brand-900/10">
            {tfMiles.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-4 hover:bg-white/5 group">
                <div className="w-9 h-9 rounded-xl bg-black/40 border border-brand-900/30 flex items-center justify-center flex-shrink-0 text-lg">🚗</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                    {m.from} → {m.to}
                    {m.source === "employee" && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/40 text-blue-300">👤 Employee</span>}
                  </div>
                  <div className="text-xs text-white/50">{m.date} · {m.purpose}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-brand-400">{m.miles} mi</div>
                  <div className="text-xs text-white/50">{fmt(m.deduction)}</div>
                </div>
                {m.source === "employee"
                  ? <div className="w-[27px] flex-shrink-0" title="Approved from an employee's field-portal submission — manage in Employees" />
                  : <button onClick={() => setMileageLog(prev => prev.filter(x => x.id !== m.id))} className="p-1.5 rounded hover:bg-danger-900/30 text-white/50 hover:text-danger-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={11} /></button>}
              </div>
            ))}
          </div>}
        </Glass>
      </>}

      {/* Add Expense Modal */}
      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? "Edit Expense" : "Add Expense"} maxW="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Date</label><GDate value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Category</label><GSel value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className="!text-xs">{categories.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel></div>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Description</label><GInput value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="SH 12.5% drum, 55gal" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Amount ($)</label><GInput type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="0.00" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Vendor</label><GInput value={f.vendor} onChange={e => setF({ ...f, vendor: e.target.value })} placeholder="HD Supply" /></div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={f.isCash} onChange={e => setF({ ...f, isCash: e.target.checked })} className="w-4 h-4" />
              <span>💵 Cash payment</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={f.taxDeductible} onChange={e => setF({ ...f, taxDeductible: e.target.checked })} className="w-4 h-4" />
              <span>Tax deductible</span>
            </label>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Receipt photo</label>
            <label className="cursor-pointer block">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                const file = e.target.files?.[0]; if (!file) return;
                const r = new FileReader(); r.onload = ev => setF(prev => ({ ...prev, receiptDataUrl: ev.target.result })); r.readAsDataURL(file);
                e.target.value = "";
              }} />
              <div className={"flex items-center gap-2 p-3 rounded-xl border-2 border-dashed transition " + (f.receiptDataUrl ? "border-green-600/50 bg-green-950/20" : "border-brand-900/30 hover:border-brand-600/50 hover:bg-brand-950/10")}>
                {f.receiptDataUrl ? <><img src={f.receiptDataUrl} alt="Receipt" className="h-12 rounded object-cover" /><span className="text-xs text-green-400">✓ Receipt attached</span><button onClick={e => { e.preventDefault(); setF({ ...f, receiptDataUrl: null }); }} className="ml-auto text-white/40 hover:text-brand-400"><X size={12} /></button></> : <><Receipt size={16} className="text-white/30" /><span className="text-xs text-white/50">Tap to photograph receipt</span></>}
              </div>
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setModal({ open: false, data: null })}>Cancel</GBtn>
            <GBtn onClick={save} disabled={!f.description.trim() || !f.amount}>Save</GBtn>
          </div>
        </div>
      </Modal>

      {/* Mileage Modal */}
      <Modal open={mileModal} onClose={() => setMileModal(false)} title="Log Mileage" maxW="max-w-sm">
        <div className="space-y-3">
          <div><label className="text-xs text-white/60 mb-1 block">Date</label><GDate value={mf.date} onChange={e => setMf({ ...mf, date: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">From</label><GInput value={mf.from} onChange={e => setMf({ ...mf, from: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">To</label><GInput value={mf.to} onChange={e => setMf({ ...mf, to: e.target.value })} placeholder="412 Oak Ridge Ln, your area" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Miles (one way)</label><GInput type="number" step="0.1" value={mf.miles} onChange={e => setMf({ ...mf, miles: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Purpose</label><GInput value={mf.purpose} onChange={e => setMf({ ...mf, purpose: e.target.value })} placeholder="Job: Harrison service" /></div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input type="checkbox" checked={mf.roundTrip} onChange={e => setMf({ ...mf, roundTrip: e.target.checked })} className="w-4 h-4" />
            Round trip (miles × 2)
          </label>
          {mf.miles && <div className="p-2 bg-black/40 border border-brand-900/30 rounded-lg text-xs text-center">
            Deduction: <span className="font-bold text-brand-400">{fmt(Number(mf.miles) * (mf.roundTrip ? 2 : 1) * IRS_RATE)}</span> at ${IRS_RATE}/mi
          </div>}
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setMileModal(false)}>Cancel</GBtn>
            <GBtn onClick={saveMileage} disabled={!mf.to.trim() || !mf.miles}>Log Miles</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== CHEMICALS =====
