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
import { themeColor } from "../../lib/theme";

export function BudgetPage({ jobs = [], estimates = [], expenses = [], settings = {} as AppSettings, toast, ownerId = "" }: { jobs?: any[]; estimates?: any[]; expenses?: any[]; settings?: AppSettings; toast?: any; ownerId?: string }) {
  const [timeframe, setTimeframe] = useState("1y");
  const [budgetGoals, setBudgetGoals] = useState(() => {
    try { return JSON.parse(localStorage.getItem("crm.budgetGoals") || "{}"); } catch { return {}; }
  });
  const [editGoal, setEditGoal] = useState(null); // { key, value }

  // FEATURE — "there's no way to edit your budget stuff... manually adding
  // things, manually subtracting things." Everything below was 100% derived
  // from real jobs/expenses records — no way to log a one-off income (a
  // cash tip not tied to a job, a reimbursement) or a manual adjustment.
  // manual_budget_entries (migration 0097) is a plain income/expense line
  // item, owner_id-scoped like every other table, folded into every total
  // below alongside the auto-derived numbers. Deleting a row is how a
  // manual entry gets "subtracted" back out.
  const [manualEntries, setManualEntries] = useState<any[]>([]);
  const [manualEntryModal, setManualEntryModal] = useState<{ kind: "income" | "expense" } | null>(null);
  const [meForm, setMeForm] = useState({ category: "", label: "", amount: "", date: today() });
  const [meSaving, setMeSaving] = useState(false);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any).from("manual_budget_entries").select("*").eq("owner_id", ownerId).order("date", { ascending: false });
        if (!cancelled && !error && Array.isArray(data)) setManualEntries(data);
        else if (error) console.warn("[Budget] manual_budget_entries fetch failed — run supabase/migrations/0097_manual_budget_entries.sql if this table doesn't exist yet:", error.message);
      } catch (e: any) {
        console.warn("[Budget] manual_budget_entries fetch threw:", e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, [ownerId]);

  const openManualEntry = (kind: "income" | "expense") => {
    setMeForm({ category: "", label: "", amount: "", date: today() });
    setManualEntryModal({ kind });
  };

  const saveManualEntry = async () => {
    if (!manualEntryModal || !meForm.category || !meForm.amount) { toast?.("Category and amount are required", "red"); return; }
    setMeSaving(true);
    const row = {
      id: uid(), owner_id: ownerId, kind: manualEntryModal.kind,
      category: meForm.category, label: meForm.label.trim(), amount: Number(meForm.amount) || 0, date: meForm.date,
    };
    try {
      const { data, error } = await (supabase as any).from("manual_budget_entries").insert(row).select().single();
      if (error) throw new Error(error.message);
      setManualEntries(prev => [data, ...prev]);
      toast?.("Manual " + manualEntryModal.kind + " entry added ✓", "green");
      setManualEntryModal(null);
    } catch (e: any) {
      toast?.("Couldn't save — " + (e?.message || "unknown error"), "red");
    } finally {
      setMeSaving(false);
    }
  };

  const deleteManualEntry = async (id: string) => {
    if (!confirm("Delete this manual entry?")) return;
    try {
      const { data, error } = await (supabase as any).from("manual_budget_entries").delete().eq("id", id).eq("owner_id", ownerId).select("id");
      if (error) throw new Error(error.message);
      if (!Array.isArray(data) || data.length === 0) throw new Error("Nothing was deleted — it may already be gone");
      setManualEntries(prev => prev.filter(m => m.id !== id));
      toast?.("Deleted", "green");
    } catch (e: any) {
      toast?.("Couldn't delete — " + (e?.message || "unknown error"), "red");
    }
  };

  const saveGoal = (key, value) => {
    const updated = { ...budgetGoals, [key]: Number(value) };
    setBudgetGoals(updated);
    localStorage.setItem("crm.budgetGoals", JSON.stringify(updated));
    setEditGoal(null);
    toast("Budget goal saved");
  };

  // Filtered data
  const tfJobs = filterByTimeframe(jobs.filter(j => j.status === "completed"), "scheduledDate", timeframe);
  const tfExp = filterByTimeframe(expenses, "date", timeframe);
  const tfManualIncome = filterByTimeframe(manualEntries.filter(m => m.kind === "income"), "date", timeframe);
  const tfManualExpense = filterByTimeframe(manualEntries.filter(m => m.kind === "expense"), "date", timeframe);
  const manualIncomeTotal = tfManualIncome.reduce((s, m) => s + Number(m.amount), 0);
  const manualExpenseTotal = tfManualExpense.reduce((s, m) => s + Number(m.amount), 0);
  const tfLabel = TIMEFRAMES.find(t => t.key === timeframe)?.label || "All";
  const IRS_RATE = 0.67;

  // P&L — manual entries folded in alongside the auto-derived job/expense
  // numbers (see the manual_budget_entries feature comment above).
  const grossRevenue = tfJobs.reduce((s, j) => s + j.amount, 0) + manualIncomeTotal;
  const cashRevenue = tfJobs.filter(j => j.isCash).reduce((s, j) => s + j.amount, 0);
  const cardRevenue = grossRevenue - cashRevenue - manualIncomeTotal;
  const totalExpenses = tfExp.reduce((s, e) => s + Number(e.amount), 0) + manualExpenseTotal;
  // Manual expense entries are treated as deductible by default — simplest
  // reasonable default for a quick manual adjustment, matching what most
  // ad-hoc business expenses actually are.
  const deductibleExp = tfExp.filter(e => e.taxDeductible).reduce((s, e) => s + Number(e.amount), 0) + manualExpenseTotal;

  // BUG FIX — "mileage gets approved but doesn't show up in the tax
  // section": this only ever read the owner's own local crm.mileage
  // entries, never the mileage_logs Supabase table employees actually
  // submit to from the field portal and the owner approves in
  // EmployeesPage.tsx. ExpensesPage.tsx already merges both (see its own
  // "AUDIT FIX — mobile round 10" comment) — this page just never got the
  // same fix, so approved employee mileage was invisible here specifically.
  const localMileage: any[] = (() => { try { const r = localStorage.getItem("crm.mileage"); return r ? JSON.parse(r) : []; } catch { return []; } })();
  const [approvedEmployeeMileage, setApprovedEmployeeMileage] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any).from("mileage_logs").select("*").eq("status", "approved");
        if (!cancelled && !error && Array.isArray(data)) setApprovedEmployeeMileage(data);
      } catch (e: any) {
        console.warn("[Budget] mileage_logs fetch failed:", e?.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const allMileage: any[] = [
    ...localMileage,
    ...approvedEmployeeMileage.map((m: any) => ({
      id: m.id, date: m.date, from: m.from, to: m.to, miles: Number(m.miles) || 0,
      deduction: (Number(m.miles) || 0) * IRS_RATE, purpose: m.purpose || "",
      source: "employee", employeeId: m.employee_id,
    })),
  ];
  const tfMileage: any[] = filterByTimeframe(allMileage, "date", timeframe);
  const totalMiles = tfMileage.reduce((s, m) => s + Number(m.miles), 0);
  const mileageDeduction = totalMiles * IRS_RATE;

  const netProfit = grossRevenue - totalExpenses;
  const netMargin = grossRevenue > 0 ? (netProfit / grossRevenue * 100).toFixed(1) : 0;
  const totalDeductions = deductibleExp + mileageDeduction;
  const taxableIncome = Math.max(0, grossRevenue - totalDeductions);
  // Self-employment tax estimate (~15.3% SE + ~22% federal bracket estimate)
  const seRateEst = 0.153;
  const fedRateEst = taxableIncome > 89075 ? 0.24 : taxableIncome > 41775 ? 0.22 : 0.12;
  const estTax = taxableIncome * (seRateEst + fedRateEst);
  const quarterlyTax = estTax / 4;

  // Expense by category for chart
  const expByCat: Record<string, number> = {};
  tfExp.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount); });
  tfManualExpense.forEach(m => { expByCat[m.category] = (expByCat[m.category] || 0) + Number(m.amount); });
  const expCatArr = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Revenue by month
  const monthlyData = (() => {
    const months: Record<string, { month: string; revenue: number; expenses: number; profit: number }> = {};
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short" });
      months[key] = { month: key, revenue: 0, expenses: 0, profit: 0 };
    }
    tfJobs.forEach(j => {
      if (!j.scheduledDate) return;
      const key = new Date(j.scheduledDate).toLocaleString("default", { month: "short" });
      if (months[key]) months[key].revenue += j.amount;
    });
    tfExp.forEach(e => {
      if (!e.date) return;
      const key = new Date(e.date).toLocaleString("default", { month: "short" });
      if (months[key]) months[key].expenses += Number(e.amount);
    });
    tfManualIncome.forEach(m => {
      if (!m.date) return;
      const key = new Date(m.date).toLocaleString("default", { month: "short" });
      if (months[key]) months[key].revenue += Number(m.amount);
    });
    tfManualExpense.forEach(m => {
      if (!m.date) return;
      const key = new Date(m.date).toLocaleString("default", { month: "short" });
      if (months[key]) months[key].expenses += Number(m.amount);
    });
    Object.values(months).forEach(m => { m.profit = m.revenue - m.expenses; });
    return Object.values(months);
  })();

  const exportTaxPDF = () => {
    const expRows = tfExp.filter(e => e.taxDeductible).map(e => `<tr><td>${e.date}</td><td>${e.category}</td><td>${e.vendor || "—"}</td><td>${e.description}</td><td class="r">${e.isCash ? "💵" : "💳"}</td><td class="r">$${Number(e.amount).toFixed(2)}</td></tr>`).join("");
    const mileRows = tfMileage.map(m => `<tr><td>${m.date}</td><td>${m.from} → ${m.to}</td><td class="r">${m.miles}</td><td class="r">$${(m.deduction || 0).toFixed(2)}</td><td>${m.purpose}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Tax Report — ${(settings as any)?.companyName || "CRM Starter"}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:900px;margin:auto;font-size:13px}
    h1{color:#111111;font-size:24px}h2{color:#333;font-size:16px;border-bottom:2px solid #111111;padding-bottom:6px;margin:24px 0 12px}
    .header{display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #111111;padding-bottom:16px;margin-bottom:24px}
    .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
    .kpi{background:#f9f9f9;padding:16px;border-radius:8px;border:1px solid #eee}
    .kpi label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888}
    .kpi .val{font-size:20px;font-weight:bold;color:#111111;margin-top:4px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}
    th{background:#f0f0f0;padding:8px 10px;text-align:left;border-bottom:2px solid #ccc;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
    td{padding:7px 10px;border-bottom:1px solid #eee}.r{text-align:right}
    .total-row{background:#f5f5f5;font-weight:bold;color:#111111}
    .disclaimer{margin-top:32px;padding:12px;background:#fffbf0;border:1px solid #f0c040;border-radius:6px;font-size:11px;color:#555}
    @media print{body{padding:20px}}</style></head><body>
    <div class="header">
      <div><h1>CRM Starter</h1><p style="color:#666;margin-top:4px">Tax Deduction Summary · ${tfLabel} · Generated ${today()}</p></div>
      <div style="text-align:right;color:#666;font-size:12px">your area<br>(555) 555-0100</div>
    </div>
    <div class="kpis">
      <div class="kpi"><label>Gross Revenue</label><div class="val">$${grossRevenue.toFixed(2)}</div></div>
      <div class="kpi"><label>Total Deductions</label><div class="val">$${totalDeductions.toFixed(2)}</div></div>
      <div class="kpi"><label>Est. Taxable Income</label><div class="val">$${taxableIncome.toFixed(2)}</div></div>
      <div class="kpi"><label>Cash Payments</label><div class="val">$${cashRevenue.toFixed(2)}</div></div>
      <div class="kpi"><label>Mileage Deduction</label><div class="val">$${mileageDeduction.toFixed(2)}</div></div>
      <div class="kpi"><label>Est. Quarterly Tax</label><div class="val">$${quarterlyTax.toFixed(2)}</div></div>
    </div>
    <h2>Business Expenses (Tax Deductible)</h2>
    <table><thead><tr><th>Date</th><th>Category</th><th>Vendor</th><th>Description</th><th class="r">Method</th><th class="r">Amount</th></tr></thead>
    <tbody>${expRows}<tr class="total-row"><td colspan="5">Total Deductible Expenses</td><td class="r">$${deductibleExp.toFixed(2)}</td></tr></tbody></table>
    ${tfMileage.length ? `<h2>Mileage Log (IRS Standard Rate: $${IRS_RATE}/mile)</h2>
    <table><thead><tr><th>Date</th><th>Route</th><th class="r">Miles</th><th class="r">Deduction</th><th>Purpose</th></tr></thead>
    <tbody>${mileRows}<tr class="total-row"><td colspan="2">Total</td><td class="r">${totalMiles.toFixed(1)}</td><td class="r">$${mileageDeduction.toFixed(2)}</td><td></td></tr></tbody></table>` : ""}
    <h2>Revenue Summary</h2>
    <table><thead><tr><th>Type</th><th class="r">Amount</th><th class="r">% of Total</th></tr></thead>
    <tbody>
      <tr><td>💳 Card/Check Payments</td><td class="r">$${cardRevenue.toFixed(2)}</td><td class="r">${grossRevenue > 0 ? (cardRevenue / grossRevenue * 100).toFixed(1) : 0}%</td></tr>
      <tr><td>💵 Cash Payments</td><td class="r">$${cashRevenue.toFixed(2)}</td><td class="r">${grossRevenue > 0 ? (cashRevenue / grossRevenue * 100).toFixed(1) : 0}%</td></tr>
      <tr class="total-row"><td>Total Revenue</td><td class="r">$${grossRevenue.toFixed(2)}</td><td class="r">100%</td></tr>
    </tbody></table>
    <div class="disclaimer">⚠️ <strong>Disclaimer:</strong> This report is for reference only and is not professional tax advice. Consult a qualified CPA or tax professional before filing. Estimated tax calculations use simplified bracket estimates and may not reflect your actual tax situation.</div>
    <script>window.onload=()=>setTimeout(window.print,400)</script></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
    toast("Tax report opened — save as PDF");
  };

  const GoalRow = ({ label, k, actual }) => {
    const goal = budgetGoals[k] || 0;
    const pct = goal > 0 ? Math.min(100, (actual / goal) * 100) : 0;
    const over = actual > goal && goal > 0;
    return (
      <div className="flex items-center gap-3 py-2 border-b border-brand-900/10 last:border-0">
        <div className="text-sm text-white/80 w-36 flex-shrink-0">{label}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={over ? "text-brand-400 font-bold" : "text-white/60"}>{fmt(actual)}</span>
            <button onClick={() => setEditGoal({ key: k, value: goal })} className="text-[10px] text-white/30 hover:text-brand-400">{goal > 0 ? "Goal: " + fmt(goal) : "Set goal"} ✏️</button>
          </div>
          {goal > 0 && <div className="h-1.5 bg-black/40 rounded-full overflow-hidden"><div className={"h-full rounded-full transition-all " + (over ? "bg-brand-500" : "bg-gradient-to-r from-brand-500 to-green-500")} style={{ width: pct + "%" }} /></div>}
        </div>
      </div>
    );
  };

  const [budgetTab, setBudgetTab] = useState("overview"); // overview | spreadsheet | tax

  // Budget categories
  const willBudgetCategories = {
    income: [
      { key: "residential", label: "Residential Jobs", icon: "🏠" },
      { key: "commercial", label: "Commercial Jobs", icon: "🏢" },
      { key: "tips", label: "Tips Received", icon: "💰" },
      { key: "other_income", label: "Other Income", icon: "➕" },
    ],
    expenses: [
      { key: "chemicals", label: "Materials & Supplies", icon: "📦" },
      { key: "fuel", label: "Fuel / Gas", icon: "⛽" },
      { key: "equipment", label: "Equipment & Tools", icon: "🔧" },
      { key: "vehicle", label: "Vehicle Maintenance", icon: "🚗" },
      { key: "advertising", label: "Advertising / Marketing", icon: "📢" },
      { key: "insurance", label: "Business Insurance", icon: "🛡️" },
      { key: "phone", label: "Phone / Software / Tech", icon: "📱" },
      { key: "subcontractors", label: "Subcontractors / Help", icon: "👷" },
      { key: "uniforms", label: "Uniforms / Clothing", icon: "👕" },
      { key: "meals", label: "Business Meals", icon: "🍔" },
      { key: "office", label: "Office / Admin", icon: "📋" },
      { key: "misc", label: "Miscellaneous", icon: "📦" },
    ]
  };

  // Map actual expenses to Your categories
  const mapToWillCategory = (expCategory = "") => {
    const c = expCategory.toLowerCase();
    if (c.includes("fuel") || c.includes("gas")) return "fuel";
    if (c.includes("chem") || c.includes("material") || c.includes("supply") || c.includes("supplies")) return "chemicals";
    if (c.includes("equipment") || c.includes("tool")) return "equipment";
    if (c.includes("vehicle") || c.includes("truck") || c.includes("car")) return "vehicle";
    if (c.includes("advertis") || c.includes("market") || c.includes("facebook") || c.includes("google")) return "advertising";
    if (c.includes("insurance")) return "insurance";
    if (c.includes("phone") || c.includes("software") || c.includes("tech")) return "phone";
    if (c.includes("labor") || c.includes("subcontract") || c.includes("crew")) return "subcontractors";
    if (c.includes("uniform") || c.includes("cloth")) return "uniforms";
    if (c.includes("food") || c.includes("meal")) return "meals";
    return "misc";
  };

  // Bucket actual expenses by category — manual entries store one of
  // willBudgetCategories.expenses' own keys directly (see the Add Manual
  // Entry modal below), so they add straight in with no mapping needed.
  const actualByCategory: Record<string, number> = {};
  tfExp.forEach(e => {
    const key = mapToWillCategory(e.category);
    actualByCategory[key] = (actualByCategory[key] || 0) + Number(e.amount);
  });
  tfManualExpense.forEach(m => {
    actualByCategory[m.category] = (actualByCategory[m.category] || 0) + Number(m.amount);
  });

  // Map job revenue to income categories and customer relations — manual
  // income entries (their category is one of willBudgetCategories.income's
  // own keys) add straight in the same way.
  const actualIncome: Record<string, number> = {
    residential: tfJobs.filter(j => (j as any).jobType !== "commercial").reduce((s, j) => s + j.amount, 0),
    commercial: tfJobs.filter(j => (j as any).jobType === "commercial").reduce((s, j) => s + j.amount, 0),
    tips: tfJobs.reduce((s, j) => s + (Number(j.tip) || 0), 0),
    other_income: 0,
  };
  tfManualIncome.forEach(m => {
    actualIncome[m.category] = (actualIncome[m.category] || 0) + Number(m.amount);
  });

  const totalIncome = Object.values(actualIncome).reduce((s, v) => s + (v as number), 0);
  const totalExpCats = Object.values(actualByCategory).reduce((s, v) => s + (v as number), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2"><PieIcon size={18} className="text-brand-400" />Budget & Taxes</h2>
          <div className="text-xs text-white/50 mt-0.5">P&L overview · tax deduction planning · Your budget</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} options={["30d", "90d", "6m", "1y", "all"]} />
          {/* FEATURE — "manually adding things, manually subtracting
              things." Everything else on this page was purely derived from
              real jobs/expenses records with no way to log an ad-hoc entry. */}
          <GBtn variant="ghost" onClick={() => openManualEntry("income")} className="!text-xs !border-green-700/40 !text-green-300"><Plus size={12} className="inline mr-1" />Income</GBtn>
          <GBtn variant="ghost" onClick={() => openManualEntry("expense")} className="!text-xs !border-brand-700/40 !text-brand-300"><Plus size={12} className="inline mr-1" />Expense</GBtn>
          <GBtn onClick={exportTaxPDF} className="!text-xs"><Download size={12} className="inline mr-1.5" />Tax PDF</GBtn>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {[["overview", "📊 Overview"], ["spreadsheet", "📋 Your Budget"], ["tax", "🧾 Tax Report"]].map(([k, l]) => (
          <button key={k} onClick={() => setBudgetTab(k)} className={"px-4 py-2 rounded-xl text-xs font-semibold border transition " + (budgetTab === k ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>{l}</button>
        ))}
      </div>

      {/* SPREADSHEET VIEW — Your real budget categories */}
      {budgetTab === "spreadsheet" && <div className="space-y-4">
        <Glass className="p-5 !bg-gradient-to-br !from-blue-950/20 !to-black/60 !border-blue-700/30">
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold flex items-center gap-2">📋 CRM Starter Budget Tracker <span className="text-[10px] text-white/40">— matches your Google Sheet structure</span></div>
            <a href="https://docs.google.com/spreadsheets/d/1Zrj9CO2luJJy6OUrBDyFA9unpmv09KKbCgt_RTvrDn0/edit" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><ExternalLink size={10} />Open in Google Sheets</a>
          </div>
          <div className="text-xs text-white/50">{tfLabel} · Auto-populated from your CRM data</div>
        </Glass>

        {/* INCOME */}
        <Glass className="overflow-hidden">
          <div className="px-4 py-3 bg-green-950/30 border-b border-green-800/30">
            <div className="font-bold text-sm text-green-300 flex items-center justify-between">
              <span>INCOME</span>
              <span>{fmt(totalIncome)}</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/20 text-[10px] text-white/40 uppercase">
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-right px-4 py-2">Amount</th>
              <th className="text-right px-4 py-2">% of Total</th>
            </tr></thead>
            <tbody>
              {willBudgetCategories.income.map(cat => {
                const val = actualIncome[cat.key] || 0;
                const pct = totalIncome > 0 ? (val / totalIncome * 100).toFixed(1) : 0;
                return <tr key={cat.key} className="border-b border-brand-900/10 hover:bg-white/5">
                  <td className="px-4 py-2.5 flex items-center gap-2">{cat.icon} {cat.label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-green-400">{val > 0 ? fmt(val) : <span className="text-white/30">—</span>}</td>
                  <td className="px-4 py-2.5 text-right text-white/50">{val > 0 ? pct + "%" : "—"}</td>
                </tr>;
              })}
              <tr className="bg-green-950/20 font-bold">
                <td className="px-4 py-3">TOTAL INCOME</td>
                <td className="px-4 py-3 text-right text-green-400">{fmt(totalIncome)}</td>
                <td className="px-4 py-3 text-right text-green-400">100%</td>
              </tr>
            </tbody>
          </table>
        </Glass>

        {/* EXPENSES */}
        <Glass className="overflow-hidden">
          <div className="px-4 py-3 bg-brand-950/30 border-b border-brand-800/30">
            <div className="font-bold text-sm text-brand-300 flex items-center justify-between">
              <span>EXPENSES</span>
              <span>{fmt(totalExpCats)}</span>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/20 text-[10px] text-white/40 uppercase">
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-right px-4 py-2">Actual</th>
              <th className="text-right px-4 py-2">Budget</th>
              <th className="text-right px-4 py-2">Variance</th>
            </tr></thead>
            <tbody>
              {willBudgetCategories.expenses.map(cat => {
                const actual = actualByCategory[cat.key] || 0;
                const budget = budgetGoals["exp_" + cat.key] || 0;
                const variance = budget > 0 ? actual - budget : null;
                return <tr key={cat.key} className="border-b border-brand-900/10 hover:bg-white/5">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">{cat.icon} {cat.label}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-brand-400">{actual > 0 ? fmt(actual) : <span className="text-white/30">—</span>}</td>
                  <td className="px-4 py-2.5 text-right">
                    <input type="number" placeholder="Set budget" defaultValue={budget || ""} onBlur={e => saveGoal("exp_" + cat.key, e.target.value)} className="w-20 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white text-right focus:outline-none focus:border-brand-500/50" />
                  </td>
                  <td className={"px-4 py-2.5 text-right text-xs font-semibold " + (variance === null ? "text-white/30" : variance > 0 ? "text-brand-400" : "text-green-400")}>
                    {variance === null ? "—" : (variance > 0 ? "+" : "") + fmt(Math.abs(variance)) + (variance > 0 ? " over" : " under")}
                  </td>
                </tr>;
              })}
              <tr className="bg-brand-950/20 font-bold">
                <td className="px-4 py-3">TOTAL EXPENSES</td>
                <td className="px-4 py-3 text-right text-brand-400">{fmt(totalExpCats)}</td>
                <td className="px-4 py-3 text-right text-white/50">{fmt(Object.entries(budgetGoals).filter(([k]) => k.startsWith("exp_")).reduce((s, [, v]) => s + Number(v), 0))}</td>
                <td className="px-4 py-3 text-right"></td>
              </tr>
            </tbody>
          </table>
        </Glass>

        {/* Manual entries — see the manual_budget_entries feature comment
            near the top of this component for the full reasoning. */}
        {(tfManualIncome.length > 0 || tfManualExpense.length > 0) && (
          <Glass className="overflow-hidden">
            <div className="px-4 py-3 bg-white/[0.03] border-b border-white/10 font-bold text-sm">Manual Entries ({tfLabel})</div>
            <div className="divide-y divide-white/5">
              {[...tfManualIncome.map(m => ({ ...m, _sign: 1 })), ...tfManualExpense.map(m => ({ ...m, _sign: -1 }))]
                .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
                .map(m => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-2.5 text-sm group">
                    <div className="min-w-0">
                      <div className="text-white/80">{m.label || (m._sign > 0 ? willBudgetCategories.income : willBudgetCategories.expenses).find(c => c.key === m.category)?.label || m.category}</div>
                      <div className="text-[10px] text-white/40">{m.date}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={"font-semibold " + (m._sign > 0 ? "text-green-400" : "text-brand-400")}>{m._sign > 0 ? "+" : "−"}{fmt(Number(m.amount))}</span>
                      <button onClick={() => deleteManualEntry(m.id)} className="p-1 rounded hover:bg-danger-900/30 text-white/30 hover:text-danger-400 opacity-0 group-hover:opacity-100 transition"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
            </div>
          </Glass>
        )}

        {/* NET */}
        <Glass className={"p-4 " + (totalIncome - totalExpCats >= 0 ? "!bg-green-950/20 !border-green-700/40" : "!bg-brand-950/20 !border-brand-700/40")}>
          <div className="flex items-center justify-between">
            <div className="font-bold text-lg">NET {totalIncome - totalExpCats >= 0 ? "PROFIT ✅" : "LOSS ⚠️"}</div>
            <div className={"text-3xl font-black " + (totalIncome - totalExpCats >= 0 ? "text-green-400" : "text-brand-400")}>{fmt(totalIncome - totalExpCats)}</div>
          </div>
          <div className="text-xs text-white/50 mt-1">Profit margin: {totalIncome > 0 ? ((totalIncome - totalExpCats) / totalIncome * 100).toFixed(1) : 0}%</div>
        </Glass>
      </div>}

      {/* OVERVIEW TAB */}
      {budgetTab === "overview" && <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat icon={DollarSign} label={`Revenue (${tfLabel})`} value={fmt(grossRevenue)} />
          <Stat icon={Receipt} label={`Expenses (${tfLabel})`} value={fmt(totalExpenses)} />
          <Stat icon={TrendingUp} label="Net Profit" value={fmt(netProfit)} change={netMargin + "%"} />
          <Stat icon={Percent} label="Profit Margin" value={netMargin + "%"} />
        </div>

        {/* Cash vs Card split */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Glass className="p-4 !bg-green-950/20 !border-green-700/30">
            <div className="text-[10px] text-green-400 uppercase tracking-wider mb-1">💵 Cash Revenue</div>
            <div className="text-2xl font-bold text-green-400">{fmt(cashRevenue)}</div>
            <div className="text-xs text-white/50 mt-0.5">{grossRevenue > 0 ? (cashRevenue / grossRevenue * 100).toFixed(1) : 0}% of total</div>
          </Glass>
          <Glass className="p-4">
            <div className="text-[10px] text-blue-400 uppercase tracking-wider mb-1">💳 Card/Check</div>
            <div className="text-2xl font-bold text-blue-400">{fmt(cardRevenue)}</div>
            <div className="text-xs text-white/50 mt-0.5">{grossRevenue > 0 ? (cardRevenue / grossRevenue * 100).toFixed(1) : 0}% of total</div>
          </Glass>
          <Glass className="p-4 !bg-purple-950/20 !border-purple-700/30">
            <div className="text-[10px] text-purple-400 uppercase tracking-wider mb-1">Total Deductions</div>
            <div className="text-2xl font-bold text-purple-400">{fmt(totalDeductions)}</div>
            <div className="text-xs text-white/50 mt-0.5">Expenses + mileage</div>
          </Glass>
          <Glass className="p-4 !bg-yellow-950/20 !border-yellow-700/30">
            <div className="text-[10px] text-yellow-400 uppercase tracking-wider mb-1">Est. Quarterly Tax</div>
            <div className="text-2xl font-bold text-yellow-400">{fmt(quarterlyTax)}</div>
            <div className="text-xs text-white/50 mt-0.5">Taxable: {fmt(taxableIncome)}</div>
          </Glass>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* P&L Chart */}
          <Glass className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart2 size={14} className="text-brand-400" />Monthly P&L</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#73737322" />
                <XAxis dataKey="month" stroke="#ffffff50" fontSize={10} />
                <YAxis stroke="#ffffff50" fontSize={10} tickFormatter={v => "$" + (v >= 1000 ? Math.round(v / 1000) + "k" : v)} />
                <Tooltip contentStyle={{ background: "#000", border: "1px solid #262626", borderRadius: "8px", fontSize: "11px" }} formatter={v => fmt(Number(v))} />
                <Bar dataKey="revenue" fill={themeColor("--chart-1")} radius={[4, 4, 0, 0]} name="Revenue" />
                <Bar dataKey="expenses" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Expenses" />
                <Bar dataKey="profit" fill="#16a34a" radius={[4, 4, 0, 0]} name="Profit" />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 justify-center mt-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-brand-500 text-brand-fg" />Revenue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-violet-600" />Expenses</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-600" />Profit</span>
            </div>
          </Glass>

          {/* Expense breakdown */}
          <Glass className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><PieIcon size={14} className="text-brand-400" />Expense Breakdown</h3>
            {expCatArr.length === 0 ? <div className="text-center py-12 text-white/40">No expenses in this period</div> : <>
              <div className="space-y-2.5">
                {expCatArr.map(([cat, amt], i) => {
                  const pct = totalExpenses > 0 ? (amt / totalExpenses * 100) : 0;
                  const colors = ["bg-brand-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-lime-500", "bg-green-500", "bg-teal-500", "bg-cyan-500"];
                  return <div key={cat} className="flex items-center gap-3">
                    <div className="text-xs text-white/70 w-24 truncate">{cat}</div>
                    <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                      <div className={"h-full rounded-full " + colors[i % colors.length]} style={{ width: pct + "%" }} />
                    </div>
                    <div className="text-xs font-semibold text-white/80 w-16 text-right">{fmt(amt)}</div>
                    <div className="text-[10px] text-white/40 w-8 text-right">{pct.toFixed(0)}%</div>
                  </div>;
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-brand-900/20 flex justify-between text-xs">
                <span className="text-white/50">Total expenses</span>
                <span className="font-bold text-brand-400">{fmt(totalExpenses)}</span>
              </div>
            </>}
          </Glass>
        </div>

        {/* Tax Planning */}
        <Glass className="p-5 !bg-gradient-to-br !from-yellow-950/20 !to-black/60 !border-yellow-700/30">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Receipt size={14} className="text-yellow-400" />Tax Planning ({tfLabel})</h3>
            <GBtn onClick={exportTaxPDF} variant="ghost" className="!text-xs"><Download size={11} className="inline mr-1" />Export for CPA</GBtn>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Deduction Summary</div>
              {[
                { label: "Deductible Expenses", amount: deductibleExp },
                { label: `Mileage (${totalMiles.toFixed(1)} mi × $${IRS_RATE})`, amount: mileageDeduction },
                { label: "Total Deductions", amount: totalDeductions, bold: true },
              ].map(r => (
                <div key={r.label} className={"flex items-center justify-between text-sm py-1.5 " + (r.bold ? "border-t border-yellow-700/30 mt-2 pt-3 font-bold" : "")}>
                  <span className={"text-white/" + (r.bold ? "90" : "70")}>{r.label}</span>
                  <span className={r.bold ? "text-yellow-400 text-base" : "text-white/80"}>{fmt(r.amount)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Estimated Tax Liability</div>
              {[
                { label: "Gross Revenue", amount: grossRevenue },
                { label: "— Total Deductions", amount: -totalDeductions },
                { label: "= Taxable Income", amount: taxableIncome, bold: true },
                { label: `Self-Employment (${(seRateEst * 100).toFixed(1)}%)`, amount: taxableIncome * seRateEst },
                { label: `Federal Income (~${(fedRateEst * 100).toFixed(0)}% bracket)`, amount: taxableIncome * fedRateEst },
                { label: "Quarterly Payment Est.", amount: quarterlyTax, bold: true },
              ].map(r => (
                <div key={r.label} className={"flex items-center justify-between text-sm py-1.5 " + (r.bold ? "border-t border-yellow-700/30 mt-2 pt-3 font-bold" : "")}>
                  <span className={"text-white/" + (r.bold ? "90" : "70")}>{r.label}</span>
                  <span className={r.bold ? "text-yellow-400 text-base" : r.amount < 0 ? "text-brand-400" : "text-white/80"}>{r.amount < 0 ? "− " + fmt(-r.amount) : fmt(r.amount)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 p-3 bg-yellow-950/30 border border-yellow-700/30 rounded-xl text-[10px] text-yellow-200/60">
            ⚠️ Estimated only — not professional tax advice. Consult your CPA. Self-employment estimated at 15.3%. Federal bracket estimated based on simplified 2024 rates.
          </div>
        </Glass>

        {/* Budget Goals */}
        <Glass className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2"><Target size={14} className="text-brand-400" />Budget Goals</h3>
            <div className="text-xs text-white/40">Click ✏️ to set a goal</div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Revenue Targets</div>
              <GoalRow label="Monthly Revenue" k="monthlyRev" actual={grossRevenue / Math.max(1, TIMEFRAMES.find(t => t.key === timeframe)?.days / 30)} />
              <GoalRow label="Annual Revenue" k="annualRev" actual={grossRevenue * (365 / Math.max(1, TIMEFRAMES.find(t => t.key === timeframe)?.days || 365))} />
              <GoalRow label="Avg Job Value" k="avgJob" actual={tfJobs.length ? grossRevenue / tfJobs.length : 0} />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Expense Limits</div>
              <GoalRow label="Monthly Expenses" k="monthlyExp" actual={totalExpenses / Math.max(1, TIMEFRAMES.find(t => t.key === timeframe)?.days / 30)} />
              <GoalRow label="Materials Budget" k="chemicals" actual={tfExp.filter(e => (e.category === "Materials" || e.category === "Chemicals")).reduce((s, e) => s + Number(e.amount), 0)} />
              <GoalRow label="Advertising Budget" k="advertising" actual={tfExp.filter(e => e.category === "Advertising").reduce((s, e) => s + Number(e.amount), 0)} />
            </div>
          </div>
        </Glass>
      </>}

      {/* Set Goal Modal */}
      <Modal open={!!editGoal} onClose={() => setEditGoal(null)} title="Set Budget Goal" maxW="max-w-xs">
        {editGoal && <div className="space-y-3">
          <div><label className="text-xs text-white/60 mb-1 block">Target Amount ($)</label><GInput type="number" autoFocus value={editGoal.value} onChange={e => setEditGoal({ ...editGoal, value: e.target.value })} onKeyDown={e => e.key === "Enter" && saveGoal(editGoal.key, editGoal.value)} /></div>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setEditGoal(null)}>Cancel</GBtn>
            <GBtn onClick={() => saveGoal(editGoal.key, editGoal.value)}>Save</GBtn>
          </div>
        </div>}
      </Modal>

      {/* Add Manual Entry Modal */}
      <Modal open={!!manualEntryModal} onClose={() => setManualEntryModal(null)} title={"Add Manual " + (manualEntryModal?.kind === "income" ? "Income" : "Expense")} maxW="max-w-sm">
        {manualEntryModal && <div className="space-y-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Category</label>
            <GSel value={meForm.category} onChange={e => setMeForm({ ...meForm, category: e.target.value })}>
              <option value="">Select a category…</option>
              {(manualEntryModal.kind === "income" ? willBudgetCategories.income : willBudgetCategories.expenses).map(c => (
                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
              ))}
            </GSel>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Description (optional)</label><GInput value={meForm.label} onChange={e => setMeForm({ ...meForm, label: e.target.value })} placeholder="e.g. Cash tip from Saturday job" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Amount ($)</label><GInput type="number" step="0.01" value={meForm.amount} onChange={e => setMeForm({ ...meForm, amount: e.target.value })} autoFocus /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Date</label><GDate value={meForm.date} onChange={e => setMeForm({ ...meForm, date: e.target.value })} /></div>
          {manualEntryModal.kind === "expense" && <div className="text-[10px] text-white/40">Treated as tax-deductible by default, same as a regular business expense.</div>}
          <div className="flex gap-2 justify-end pt-1">
            <GBtn variant="ghost" onClick={() => setManualEntryModal(null)}>Cancel</GBtn>
            <GBtn onClick={saveManualEntry} disabled={meSaving || !meForm.category || !meForm.amount}>{meSaving ? "Saving…" : "Add " + (manualEntryModal.kind === "income" ? "Income" : "Expense")}</GBtn>
          </div>
        </div>}
      </Modal>

      {/* TAX REPORT TAB */}
      {budgetTab === "tax" && <div className="space-y-4">
        <Glass className="p-5 !bg-gradient-to-br !from-yellow-950/20 !to-black/60 !border-yellow-700/30">
          <div className="font-semibold mb-1 flex items-center gap-2">🧾 Tax Summary — {tfLabel}</div>
          <div className="text-xs text-white/60">For your CPA. Export as PDF to send directly.</div>
        </Glass>
        <div className="grid md:grid-cols-2 gap-4">
          <Glass className="p-4 space-y-3">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Income Summary</div>
            <div className="flex justify-between text-sm"><span className="text-white/70">Gross Revenue</span><span className="font-bold">{fmt(grossRevenue)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-white/70">💵 Cash Payments</span><span className="text-green-400">{fmt(cashRevenue)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-white/70">💳 Card/Check</span><span className="text-blue-400">{fmt(cardRevenue)}</span></div>
          </Glass>
          <Glass className="p-4 space-y-3">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Deduction Summary</div>
            <div className="flex justify-between text-sm"><span className="text-white/70">Business Expenses</span><span className="font-bold text-brand-400">-{fmt(deductibleExp)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-white/70">Mileage ({totalMiles.toFixed(0)} mi × $0.67)</span><span className="text-brand-400">-{fmt(mileageDeduction)}</span></div>
            <div className="flex justify-between text-sm border-t border-brand-900/30 pt-2"><span className="font-semibold">Taxable Income (est.)</span><span className="font-bold">{fmt(taxableIncome)}</span></div>
          </Glass>
        </div>
        <Glass className="p-4 !bg-yellow-950/20 !border-yellow-700/30">
          <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Estimated Tax Liability</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between"><span className="text-white/70">Self-Employment Tax (15.3%)</span><span className="font-bold">{fmt(taxableIncome * 0.153)}</span></div>
            <div className="flex justify-between"><span className="text-white/70">Federal Income Tax (est.)</span><span className="font-bold">{fmt(taxableIncome * fedRateEst)}</span></div>
            <div className="flex justify-between col-span-2 border-t border-yellow-800/30 pt-2"><span className="font-bold text-yellow-300">Total Estimated Tax</span><span className="font-black text-yellow-300 text-lg">{fmt(estTax)}</span></div>
            <div className="flex justify-between col-span-2"><span className="text-white/60">Quarterly payment (÷4)</span><span className="font-bold text-yellow-400">{fmt(quarterlyTax)}</span></div>
          </div>
          <div className="text-[10px] text-white/30 mt-3">⚠️ These are estimates only. Consult your CPA before filing.</div>
        </Glass>
        <GBtn onClick={exportTaxPDF} className="w-full"><Download size={14} className="inline mr-2" />Export Full Tax PDF for CPA</GBtn>
      </div>}

    </div>
  );
}

// ===== ANALYTICS PAGE =====
