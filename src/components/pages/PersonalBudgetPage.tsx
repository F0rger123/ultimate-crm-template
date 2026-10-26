// auto-extracted from CRM Starter monolith
import { parseDateLoose } from "../../lib/customerImport";
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
import { ImportDataModal } from "../ui/ImportDataModal";

export function PersonalBudgetPage({ toast }) {
  const [transactions, setTransactions] = usePersistent("crm.personal.transactions", []);
  const [budgets, setBudgets] = usePersistent("crm.personal.budgets", {
    housing: 1200, food: 600, transport: 400, entertainment: 200, health: 150, savings: 500, other: 300
  });
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({ date: today(), description: "", amount: "", category: "Food & Dining", type: "expense", account: "Checking" });
  const [timeframe, setTimeframe] = useState("30d");
  const [editBudget, setEditBudget] = useState(null);
  // FEATURE — "add more options and different tracking features and goals
  // for the personal budget section. It's kind of basic." Two real
  // additions beyond the existing budget-vs-actual/transaction tracking:
  // savings/financial goals with a target + deadline + contribution
  // tracking, and recurring bills/income so a rent payment or paycheck
  // doesn't have to be typed in by hand every single period.
  const [section, setSection] = useState<"overview" | "goals" | "recurring">("overview");
  const [personalGoals, setPersonalGoals] = usePersistent<any[]>("crm.personal.goals", []);
  const [goalModal, setGoalModal] = useState(false);
  const [gf, setGf] = useState({ name: "", target: "", deadline: "" });
  const [recurringItems, setRecurringItems] = usePersistent<any[]>("crm.personal.recurring", []);
  const [recurModal, setRecurModal] = useState(false);
  const [rf, setRf] = useState({ description: "", amount: "", category: "Housing", type: "expense", frequency: "monthly", nextDate: today() });

  const categories = ["Housing", "Food & Dining", "Transportation", "Entertainment", "Health & Fitness", "Savings", "Clothing", "Phone", "Subscriptions", "Family", "Other"];
  const accounts = ["Checking", "Savings", "Credit Card", "Cash"];
  const catKey = c => c.toLowerCase().split(" ")[0];

  const tfTx = filterByTimeframe(transactions, "date", timeframe);
  const income = tfTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const spent = tfTx.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const net = income - spent;

  const saveTx = () => {
    if (!f.description.trim() || !f.amount) return;
    setTransactions(prev => [{ ...f, id: uid(), amount: Number(f.amount) }, ...prev]);
    setF({ date: today(), description: "", amount: "", category: "Food & Dining", type: "expense", account: "Checking" });
    setModal(false);
    toast("Transaction added");
  };

  // ── Savings/Financial Goals ────────────────────────────────────────────
  const saveGoal = () => {
    const target = Number(gf.target);
    if (!gf.name.trim() || !target || target <= 0) { toast("Give the goal a name and a target greater than 0", "red"); return; }
    setPersonalGoals(prev => [...prev, { id: uid(), name: gf.name.trim(), target, current: 0, deadline: gf.deadline || undefined, createdAt: today() }]);
    setGf({ name: "", target: "", deadline: "" });
    setGoalModal(false);
    toast("Goal added 🎯");
  };
  const contributeToGoal = (id: string, amount: number) => {
    setPersonalGoals(prev => prev.map(g => g.id === id ? { ...g, current: Math.max(0, (Number(g.current) || 0) + amount) } : g));
  };
  const deleteGoal = (id: string) => setPersonalGoals(prev => prev.filter(g => g.id !== id));

  // ── Recurring bills/income ──────────────────────────────────────────────
  const advanceDate = (dateStr: string, freq: string): string => {
    const d = new Date(dateStr + "T00:00:00");
    if (freq === "weekly") d.setDate(d.getDate() + 7);
    else if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1); // monthly
    return d.toISOString().slice(0, 10);
  };
  const saveRecurring = () => {
    if (!rf.description.trim() || !rf.amount) { toast("Give it a description and amount", "red"); return; }
    setRecurringItems(prev => [...prev, { id: uid(), ...rf, amount: Number(rf.amount) }]);
    setRf({ description: "", amount: "", category: "Housing", type: "expense", frequency: "monthly", nextDate: today() });
    setRecurModal(false);
    toast("Recurring item added ✓");
  };
  const logRecurring = (item: any) => {
    setTransactions(prev => [{ id: uid(), date: today(), description: item.description, amount: item.amount, category: item.category, type: item.type, account: "Checking" }, ...prev]);
    setRecurringItems(prev => prev.map(r => r.id === item.id ? { ...r, nextDate: advanceDate(r.nextDate, r.frequency) } : r));
    toast(`Logged ${item.description} — next due ${advanceDate(item.nextDate, item.frequency)}`, "green");
  };
  const deleteRecurring = (id: string) => setRecurringItems(prev => prev.filter(r => r.id !== id));

  // ── Monthly trend (last 6 months, real transaction data) ───────────────
  const monthlyTrend = (() => {
    const months: { key: string; label: string; income: number; spent: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      months.push({ key, label: d.toLocaleDateString(undefined, { month: "short" }), income: 0, spent: 0 });
    }
    for (const t of transactions) {
      const key = (t.date || "").slice(0, 7);
      const m = months.find(x => x.key === key);
      if (!m) continue;
      if (t.type === "income") m.income += Number(t.amount) || 0; else m.spent += Number(t.amount) || 0;
    }
    return months;
  })();

  const spentByCategory = categories.reduce((acc, cat) => {
    acc[cat] = tfTx.filter(t => t.type === "expense" && t.category === cat).reduce((s, t) => s + Number(t.amount), 0);
    return acc;
  }, {});

  const totalBudgeted = Object.values(budgets).reduce((s, v) => s + Number(v), 0);

  // FEATURE — "import personal expenses with a Google Sheet link." Same
  // shared ImportDataModal CustomersPage/ExpensesPage already use for
  // Google Sheets links (and pasted/CSV text), mapped onto a personal
  // transaction instead of a business Expense.
  const [personalImportOpen, setPersonalImportOpen] = useState(false);
  const personalImportFieldMap = {
    date: ["date", "transaction date", "expense date"],
    description: ["description", "memo", "details", "item"],
    amount: ["amount", "cost", "total", "price"],
    category: ["category", "type", "expense category"],
  };
  const handlePersonalImport = (rows: Record<string, string>[]) => {
    const imported = rows.map(raw => ({
      id: uid(),
      // Audit 2026-10-26: bank exports say "10/05/2026"; reports group by
      // YYYY-MM-DD, so unconverted dates fell out of every monthly total.
      date: (raw.date && /^\d{4}-\d{2}-\d{2}$/.test(parseDateLoose(raw.date)) ? parseDateLoose(raw.date) : "") || today(),
      description: raw.description || "Imported transaction",
      amount: Math.abs(Number((raw.amount || "").replace(/[^0-9.-]/g, "")) || 0),
      category: raw.category || "Other",
      type: "expense" as const,
      account: "Checking",
    })).filter(t => t.amount > 0);
    if (imported.length === 0) { toast("No valid rows found — need at least an Amount column", "red"); return; }
    setTransactions((prev: any[]) => [...imported, ...prev]);
    toast(`✅ Imported ${imported.length} transaction(s)`, "green");
  };

  const exportPersonalPDF = () => {
    const rows = tfTx.map(t => `<tr><td>${t.date}</td><td>${t.category}</td><td>${t.description}</td><td>${t.account}</td><td class="${t.type === "income" ? "inc" : "exp"}">${t.type === "income" ? "+" : "−"}$${Number(t.amount).toFixed(2)}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Personal Budget</title><style>body{font-family:Arial,sans-serif;padding:32px;max-width:800px;margin:auto}h1{color:#333}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f0f0f0;padding:8px;text-align:left;border-bottom:2px solid #ccc;text-transform:uppercase;font-size:10px}td{padding:7px;border-bottom:1px solid #eee}.inc{color:green;font-weight:bold}.exp{color:#b91c1c;font-weight:bold}.sum{margin:16px 0;padding:12px;background:#f9f9f9;border-radius:8px;display:flex;gap:32px}.sk{font-size:11px;color:#666}.sv{font-size:18px;font-weight:bold}</style></head><body><h1>Personal Budget</h1><p style="color:#666">${TIMEFRAMES.find(t => t.key === timeframe)?.label || "All"} · ${today()}</p><div class="sum"><div><div class="sk">Income</div><div class="sv" style="color:green">$${income.toFixed(2)}</div></div><div><div class="sk">Spent</div><div class="sv" style="color:#b91c1c">$${spent.toFixed(2)}</div></div><div><div class="sk">Net</div><div class="sv" style="color:${net>=0?"green":"#b91c1c"}">${net>=0?"+":"−"}$${Math.abs(net).toFixed(2)}</div></div></div><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Account</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>setTimeout(window.print,300)</script></body></html>`;
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-lg flex items-center gap-2"><Heart size={18} className="text-brand-400" />Personal Budget</h2>
          <div className="text-xs text-white/50 mt-0.5">Track personal income & spending — separate from the business</div>
        </div>
        <div className="flex items-center gap-2">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} options={["7d","30d","90d","6m","1y","all"]} compact />
          <GBtn variant="ghost" onClick={() => setPersonalImportOpen(true)} className="!text-xs"><Download size={12} className="inline mr-1 rotate-180" />Import</GBtn>
          <GBtn variant="ghost" onClick={exportPersonalPDF} className="!text-xs"><Download size={12} className="inline mr-1" />PDF</GBtn>
          <GBtn onClick={() => setModal(true)} className="!text-xs"><Plus size={12} className="inline mr-1" />Add</GBtn>
        </div>
      </div>
      <ImportDataModal open={personalImportOpen} onClose={() => setPersonalImportOpen(false)} title="Import Personal Transactions" fieldMap={personalImportFieldMap} onImport={handlePersonalImport} toast={toast} />

      {/* Section tabs */}
      <div className="flex gap-2">
        {([["overview", "Overview"], ["goals", `🎯 Goals${personalGoals.length ? ` (${personalGoals.length})` : ""}`], ["recurring", `🔁 Recurring${recurringItems.length ? ` (${recurringItems.length})` : ""}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setSection(k)} className={"px-3 py-1.5 rounded-lg text-xs font-medium border transition " + (section === k ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>{l}</button>
        ))}
      </div>

      {section === "overview" && <>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 bg-green-950/20 border border-green-700/30 rounded-2xl">
          <div className="text-[10px] text-green-400 uppercase tracking-wider mb-1">💵 Income</div>
          <div className="text-2xl font-bold text-green-400">{fmt(income)}</div>
        </div>
        <div className="p-4 bg-brand-950/20 border border-brand-700/30 rounded-2xl">
          <div className="text-[10px] text-brand-400 uppercase tracking-wider mb-1">💳 Spent</div>
          <div className="text-2xl font-bold text-brand-400">{fmt(spent)}</div>
        </div>
        <div className={"p-4 border rounded-2xl " + (net >= 0 ? "bg-green-950/20 border-green-700/30" : "bg-brand-950/20 border-brand-700/30")}>
          <div className={"text-[10px] uppercase tracking-wider mb-1 " + (net >= 0 ? "text-green-400" : "text-brand-400")}>{net >= 0 ? "✅ Surplus" : "⚠️ Deficit"}</div>
          <div className={"text-2xl font-bold " + (net >= 0 ? "text-green-400" : "text-brand-400")}>{net >= 0 ? "+" : ""}{fmt(net)}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Budget vs Actual */}
        <Glass className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Budget vs Actual</h3>
            <div className="text-xs text-white/40">Budgeted: {fmt(totalBudgeted)}/mo</div>
          </div>
          <div className="space-y-3">
            {categories.filter(cat => (budgets[catKey(cat)] || 0) > 0 || spentByCategory[cat] > 0).map(cat => {
              const budget = budgets[catKey(cat)] || 0;
              const actual = spentByCategory[cat] || 0;
              const pct = budget > 0 ? Math.min(100, (actual / budget * 100)) : 0;
              const over = actual > budget && budget > 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/70">{cat}</span>
                    <div className="flex items-center gap-2">
                      <span className={over ? "text-brand-400 font-bold" : "text-white/60"}>{fmt(actual)}</span>
                      <button onClick={() => setEditBudget({ key: catKey(cat), label: cat, value: budget })} className="text-white/30 hover:text-white/60 text-[10px]">/{fmt(budget)} ✏️</button>
                    </div>
                  </div>
                  <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                    <div className={"h-full rounded-full transition-all " + (over ? "bg-brand-500" : pct > 80 ? "bg-yellow-500" : "bg-gradient-to-r from-green-500 to-green-600")} style={{ width: pct + "%" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Glass>

        {/* Recent transactions */}
        <Glass className="p-5">
          <h3 className="font-semibold text-sm mb-4">Transactions</h3>
          {tfTx.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">No transactions yet — add your first one</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {tfTx.slice(0, 30).map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-white/5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: t.type === "income" ? "rgba(16,185,129,0.15)" : "rgba(64,64,64,0.15)" }}>
                    {t.type === "income" ? "💵" : { "Food & Dining": "🍔", Housing: "🏠", Transportation: "🚗", Entertainment: "🎮", "Health & Fitness": "💪", Savings: "🏦", Clothing: "👕", Phone: "📱", Subscriptions: "📺", Family: "👨‍👩‍👧", Other: "💸" }[t.category] || "💸"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.description}</div>
                    <div className="text-xs text-white/40">{t.category} · {t.date}</div>
                  </div>
                  <div className={"font-bold text-sm flex-shrink-0 " + (t.type === "income" ? "text-green-400" : "text-brand-400")}>
                    {t.type === "income" ? "+" : "−"}{fmt(Number(t.amount))}
                  </div>
                  <button onClick={() => setTransactions(prev => prev.filter(x => x.id !== t.id))} className="p-1 rounded hover:bg-danger-900/30 text-white/30 hover:text-danger-400"><Trash2 size={10} /></button>
                </div>
              ))}
            </div>
          )}
        </Glass>
      </div>

      {/* Monthly trend — real transaction data, last 6 months */}
      <Glass className="p-5">
        <h3 className="font-semibold text-sm mb-4">Income vs. Spending — Last 6 Months</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" stroke="rgba(255,255,255,0.3)" fontSize={11} />
            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={11} />
            <Tooltip contentStyle={{ background: "#000", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} formatter={(v: any) => fmt(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="spent" name="Spent" fill="#b91c1c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Glass>
      </>}

      {section === "goals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/50">Save toward something specific — a vacation, a down payment, an emergency fund.</div>
            <GBtn onClick={() => setGoalModal(true)} className="!text-xs flex-shrink-0"><Plus size={12} className="inline mr-1" />New Goal</GBtn>
          </div>
          {personalGoals.length === 0 ? (
            <div className="text-center py-12 text-white/40 text-sm"><Target size={28} className="mx-auto mb-2 opacity-30" />No savings goals yet</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {personalGoals.map((g: any) => {
                const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
                const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline + "T00:00:00").getTime() - Date.now()) / 86400000) : null;
                return (
                  <Glass key={g.id} className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-semibold text-sm">{g.name}</div>
                        {g.deadline && <div className="text-[10px] text-white/40">{daysLeft !== null && daysLeft >= 0 ? `${daysLeft} days left` : daysLeft !== null ? "Overdue" : ""} · due {g.deadline}</div>}
                      </div>
                      <button onClick={() => deleteGoal(g.id)} className="p-1 rounded hover:bg-danger-900/30 text-white/30 hover:text-danger-400 flex-shrink-0"><Trash2 size={12} /></button>
                    </div>
                    <div className="flex justify-between text-xs mb-1"><span className="text-white/60">{fmt(g.current)} / {fmt(g.target)}</span><span className={pct >= 100 ? "text-green-400 font-bold" : "text-white/60"}>{pct}%</span></div>
                    <PBar value={g.current} max={g.target || 1} />
                    <div className="flex gap-2 mt-3">
                      <GBtn variant="ghost" className="!text-xs !py-1.5 flex-1" onClick={() => contributeToGoal(g.id, 25)}>+$25</GBtn>
                      <GBtn variant="ghost" className="!text-xs !py-1.5 flex-1" onClick={() => contributeToGoal(g.id, 100)}>+$100</GBtn>
                      {pct >= 100 && <Badge tone="green">🎉 Reached!</Badge>}
                    </div>
                  </Glass>
                );
              })}
            </div>
          )}
        </div>
      )}

      {section === "recurring" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-white/50">Bills and income that repeat — log one with a tap instead of retyping it every period.</div>
            <GBtn onClick={() => setRecurModal(true)} className="!text-xs flex-shrink-0"><Plus size={12} className="inline mr-1" />New Recurring</GBtn>
          </div>
          {recurringItems.length === 0 ? (
            <div className="text-center py-12 text-white/40 text-sm"><Repeat size={28} className="mx-auto mb-2 opacity-30" />No recurring bills or income set up yet</div>
          ) : (
            <div className="space-y-2">
              {recurringItems.map((r: any) => {
                const due = r.nextDate <= today();
                return (
                  <Glass key={r.id} className={"p-3 flex items-center gap-3 " + (due ? "!border-yellow-600/40" : "")}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ background: r.type === "income" ? "rgba(16,185,129,0.15)" : "rgba(64,64,64,0.15)" }}>{r.type === "income" ? "💵" : "🔁"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.description}</div>
                      <div className="text-xs text-white/40">{r.category} · {r.frequency} · next {r.nextDate}{due ? " — due" : ""}</div>
                    </div>
                    <div className={"font-bold text-sm flex-shrink-0 " + (r.type === "income" ? "text-green-400" : "text-brand-400")}>{r.type === "income" ? "+" : "−"}{fmt(Number(r.amount))}</div>
                    <GBtn onClick={() => logRecurring(r)} className={"!text-[10px] !py-1.5 !px-2.5 flex-shrink-0 " + (due ? "" : "!bg-white/10 hover:!bg-white/15")}>Log Now</GBtn>
                    <button onClick={() => deleteRecurring(r.id)} className="p-1.5 rounded hover:bg-danger-900/30 text-white/30 hover:text-danger-400 flex-shrink-0"><Trash2 size={12} /></button>
                  </Glass>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Transaction Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Transaction" maxW="max-w-sm">
        <div className="space-y-3">
          <div className="flex gap-2">
            {["expense","income"].map(t => (
              <button key={t} onClick={() => setF({ ...f, type: t })} className={"flex-1 py-2 rounded-xl border text-xs font-semibold uppercase transition " + (f.type === t ? (t === "income" ? "bg-green-900/40 border-green-500/50 text-green-200" : "bg-brand-900/40 border-brand-500/50 text-brand-200") : "bg-black/40 border-white/10 text-white/50 hover:text-white")}>
                {t === "income" ? "💵 Income" : "💳 Expense"}
              </button>
            ))}
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Date</label><GDate value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Description</label><GInput value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Groceries, rent, paycheck..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Amount ($)</label><GInput type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} placeholder="0.00" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Account</label><GSel value={f.account} onChange={e => setF({ ...f, account: e.target.value })} className="!text-xs">{accounts.map(a => <option key={a} value={a} className="bg-black">{a}</option>)}</GSel></div>
          </div>
          {f.type === "expense" && <div><label className="text-xs text-white/60 mb-1 block">Category</label><GSel value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className="!text-xs">{categories.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel></div>}
          <div className="flex gap-2 justify-end pt-1">
            <GBtn variant="ghost" onClick={() => setModal(false)}>Cancel</GBtn>
            <GBtn onClick={saveTx} disabled={!f.description.trim() || !f.amount}>Add</GBtn>
          </div>
        </div>
      </Modal>

      {/* Edit Budget Modal */}
      <Modal open={!!editBudget} onClose={() => setEditBudget(null)} title="Set Monthly Budget" maxW="max-w-xs">
        {editBudget && <div className="space-y-3">
          <div className="text-sm text-white/70">{editBudget.label}</div>
          <div><label className="text-xs text-white/60 mb-1 block">Monthly limit ($)</label>
            <GInput type="number" autoFocus value={editBudget.value} onChange={e => setEditBudget({ ...editBudget, value: Number(e.target.value) })} onKeyDown={e => { if (e.key === "Enter") { setBudgets(prev => ({ ...prev, [editBudget.key]: Number(editBudget.value) })); setEditBudget(null); toast("Budget updated"); }}} />
          </div>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setEditBudget(null)}>Cancel</GBtn>
            <GBtn onClick={() => { setBudgets(prev => ({ ...prev, [editBudget.key]: Number(editBudget.value) })); setEditBudget(null); toast("Budget updated"); }}>Save</GBtn>
          </div>
        </div>}
      </Modal>

      {/* New Goal Modal */}
      <Modal open={goalModal} onClose={() => setGoalModal(false)} title="New Savings Goal" maxW="max-w-xs">
        <div className="space-y-3">
          <div><label className="text-xs text-white/60 mb-1 block">Goal name</label><GInput autoFocus value={gf.name} onChange={e => setGf({ ...gf, name: e.target.value })} placeholder="e.g. Emergency fund" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Target ($)</label><GInput type="number" value={gf.target} onChange={e => setGf({ ...gf, target: e.target.value })} placeholder="5000" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Deadline (optional)</label><GDate value={gf.deadline} onChange={e => setGf({ ...gf, deadline: e.target.value })} /></div>
          <div className="flex gap-2 justify-end pt-1">
            <GBtn variant="ghost" onClick={() => setGoalModal(false)}>Cancel</GBtn>
            <GBtn onClick={saveGoal}>Save Goal</GBtn>
          </div>
        </div>
      </Modal>

      {/* New Recurring Item Modal */}
      <Modal open={recurModal} onClose={() => setRecurModal(false)} title="New Recurring Item" maxW="max-w-sm">
        <div className="space-y-3">
          <div className="flex gap-2">
            {["expense", "income"].map(t => (
              <button key={t} onClick={() => setRf({ ...rf, type: t })} className={"flex-1 py-2 rounded-xl border text-xs font-semibold uppercase transition " + (rf.type === t ? (t === "income" ? "bg-green-900/40 border-green-500/50 text-green-200" : "bg-brand-900/40 border-brand-500/50 text-brand-200") : "bg-black/40 border-white/10 text-white/50 hover:text-white")}>
                {t === "income" ? "💵 Income" : "💳 Expense"}
              </button>
            ))}
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Description</label><GInput value={rf.description} onChange={e => setRf({ ...rf, description: e.target.value })} placeholder="Rent, Netflix, Paycheck..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Amount ($)</label><GInput type="number" step="0.01" value={rf.amount} onChange={e => setRf({ ...rf, amount: e.target.value })} placeholder="0.00" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Frequency</label><GSel value={rf.frequency} onChange={e => setRf({ ...rf, frequency: e.target.value })} className="!text-xs"><option value="weekly" className="bg-black">Weekly</option><option value="monthly" className="bg-black">Monthly</option><option value="yearly" className="bg-black">Yearly</option></GSel></div>
          </div>
          {rf.type === "expense" && <div><label className="text-xs text-white/60 mb-1 block">Category</label><GSel value={rf.category} onChange={e => setRf({ ...rf, category: e.target.value })} className="!text-xs">{categories.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel></div>}
          <div><label className="text-xs text-white/60 mb-1 block">Next due date</label><GDate value={rf.nextDate} onChange={e => setRf({ ...rf, nextDate: e.target.value })} /></div>
          <div className="flex gap-2 justify-end pt-1">
            <GBtn variant="ghost" onClick={() => setRecurModal(false)}>Cancel</GBtn>
            <GBtn onClick={saveRecurring} disabled={!rf.description.trim() || !rf.amount}>Save</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== BUDGET & TAX PAGE =====
