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

export function ReportsPage({ jobs = [], customers = [], estimates = [], expenses = [], employees = [], chemicals = [] }) {
  const [timeframe, setTimeframe] = useState("30d");
  const [revenueView, setRevenueView] = useState("monthly");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Filter by timeframe — supports custom range
  const tfJobs = (() => {
    if (timeframe === "custom" && customStart && customEnd) {
      return jobs.filter(j => j.status === "completed" && j.scheduledDate >= customStart && j.scheduledDate <= customEnd);
    }
    return filterByTimeframe(jobs.filter(j => j.status === "completed"), "scheduledDate", timeframe);
  })();
  const tfEstimates = (() => {
    if (timeframe === "custom" && customStart && customEnd) {
      return estimates.filter(e => e.createdAt >= customStart && e.createdAt <= customEnd);
    }
    return filterByTimeframe(estimates, "createdAt", timeframe);
  })();
  const tfExpenses = (() => {
    if (timeframe === "custom" && customStart && customEnd) {
      return expenses.filter(e => e.date >= customStart && e.date <= customEnd);
    }
    return filterByTimeframe(expenses, "date", timeframe);
  })();

  const approved = tfEstimates.filter(e => e.status === "approved").length;
  const total = tfEstimates.length;
  const cr = total ? Math.round((approved / total) * 100) : 0;
  const totalRev = tfJobs.reduce((s, j) => s + j.amount, 0);
  const todayRev = jobs.filter(j => j.status === "completed" && j.scheduledDate === today()).reduce((s, j) => s + j.amount, 0);
  const thisWeekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
  const thisWeekRev = jobs.filter(j => j.status === "completed" && j.scheduledDate >= thisWeekStart).reduce((s, j) => s + j.amount, 0);
  const thisMonthRev = jobs.filter(j => j.status === "completed" && j.scheduledDate?.slice(0, 7) === today().slice(0, 7)).reduce((s, j) => s + j.amount, 0);
  const totalExp = tfExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const gp = totalRev - totalExp;
  const gpPct = totalRev > 0 ? Math.round((gp / totalRev) * 100) : 0;
  const top = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);

  // Tip tracking
  const totalTips = tfJobs.reduce((s, j) => s + (Number(j.tip) || 0), 0);
  const avgTip = tfJobs.filter(j => j.tip > 0).length > 0 ? totalTips / tfJobs.filter(j => j.tip > 0).length : 0;
  const tipRate = tfJobs.length > 0 ? Math.round(tfJobs.filter(j => j.tip > 0).length / tfJobs.length * 100) : 0;

  // Payment method breakdown
  const cashJobs = tfJobs.filter(j => j.isCash);
  const cashRev = cashJobs.reduce((s, j) => s + j.amount, 0);
  const cardRev = totalRev - cashRev;
  const cashPct = totalRev > 0 ? Math.round(cashRev / totalRev * 100) : 0;

  const noShowCount = jobs.filter(j => j.noShow).length;
  const noShowRate = jobs.filter(j => j.status === "cancelled" || j.status === "completed").length > 0
    ? Math.round(noShowCount / (jobs.filter(j => j.status === "cancelled" || j.status === "completed").length) * 100)
    : 0;
  const avgJobValue = tfJobs.length > 0 ? Math.round(totalRev / tfJobs.length) : 0;
  const tfLabel = timeframe === "custom" ? (customStart + " — " + customEnd) : (TIMEFRAMES.find(t => t.key === timeframe)?.label || "All");

  // Build monthly revenue from real job data
  const buildMonthlyRevenue = () => {
    const months: Record<string, {month: string; revenue: number; jobs: number; expenses: number}> = {};
    const now = new Date();
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      months[key] = { month: key, revenue: 0, jobs: 0, expenses: 0 };
    }
    tfJobs.forEach(j => {
      if (!j.scheduledDate) return;
      const d = new Date(j.scheduledDate);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (months[key]) { months[key].revenue += j.amount || 0; months[key].jobs++; }
    });
    tfExpenses.forEach(e => {
      if (!e.date) return;
      const d = new Date(e.date);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      if (months[key]) months[key].expenses += Number(e.amount) || 0;
    });
    return Object.values(months);
  };
  const monthlyRevenue = buildMonthlyRevenue();

  // Crew performance filtered by timeframe
  const crewStats = employees.filter(e => e.status === "active").map(e => {
    const crewJobs = tfJobs.filter(j => (j.crew || []).includes(e.id));
    const rev = crewJobs.reduce((s, j) => s + (j.amount || 0), 0);
    const hrs = crewJobs.reduce((s, j) => s + (Number(j.loggedHours) || 0), 0);
    return { name: e.firstName + " " + (e.lastName?.[0] || "") + ".", role: e.role, jobs: crewJobs.length, revenue: rev, hours: hrs, efficiency: hrs > 0 ? Math.round(rev / hrs) : 0 };
  }).sort((a, b) => b.revenue - a.revenue);

  // Chemical usage from filtered jobs
  const chemAgg: Record<string, {name: string; gallons: number; cost: number}> = {};
  tfJobs.forEach(j => (j.chemicalsUsed || []).forEach(ch => {
    const k = ch.name || "Unknown";
    if (!chemAgg[k]) chemAgg[k] = { name: k, gallons: 0, cost: 0 };
    chemAgg[k].gallons += Number(ch.gallons) || 0;
    chemAgg[k].cost += Number(ch.cost) || 0;
  }));
  const chemArr = Object.values(chemAgg).sort((a, b) => b.cost - a.cost);
  const totalChemCost = chemArr.reduce((s, c) => s + c.cost, 0);
  const totalChemGal = chemArr.reduce((s, c) => s + c.gallons, 0);


  const avgDaysToPay = (() => {
    const paid = tfEstimates.filter(e => e.paidAt && e.invoicedAt);
    if (!paid.length) return "—";
    const avg = paid.reduce((s, e) => s + daysSince(e.invoicedAt) - daysSince(e.paidAt), 0) / paid.length;
    return Math.round(Math.abs(avg)) + "d";
  })();

  return (
    <div className="space-y-5">
      {/* Header with timeframe */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-bold text-lg">Reports</h2>
          <div className="text-xs text-white/50">Showing {tfJobs.length} jobs · {tfLabel} window</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <TimeframeSelector value={timeframe} onChange={setTimeframe} options={["7d","30d","90d","6m","1y","all","custom"]} />
          {timeframe === "custom" && <>
            <GInput type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="!text-xs !py-1.5 !w-36" />
            <span className="text-white/50 text-xs">to</span>
            <GInput type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="!text-xs !py-1.5 !w-36" />
          </>}
          <GBtn variant="ghost" className="!text-xs" onClick={() => {
            const headers = "Date,Customer,Service,Amount,Status,Invoice,Cash\n";
            const rows = tfJobs.map(j => {
              const c = customers.find(x => x.id === j.customerId);
              return `"${j.scheduledDate}","${c ? c.firstName + " " + c.lastName : ""}","${j.address?.split(",")[0] || ""}","${j.amount}","${j.status}","${j.isCash ? "yes" : "no"}"`;
            }).join("\n");
            const blob = new Blob([headers + rows], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "crm-report-" + today() + ".csv"; a.click();
            URL.revokeObjectURL(url);
          }}><Download size={12} className="inline mr-1" />CSV</GBtn>
          <GBtn variant="ghost" className="!text-xs" onClick={() => {
            const html = `<!DOCTYPE html><html><head><title>CRM Starter Report</title><style>body{font-family:Arial;padding:32px;color:#111;max-width:900px;margin:auto}h1{color:#111111}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}th{background:#f0f0f0;padding:8px;text-align:left;border-bottom:2px solid #ccc;text-transform:uppercase;font-size:10px}td{padding:7px;border-bottom:1px solid #eee}.num{text-align:right}.kpi{display:inline-block;padding:12px 20px;margin:8px;border:1px solid #ddd;border-radius:8px;text-align:center;min-width:100px}.kv{font-size:22px;font-weight:bold;color:#111111}.kl{font-size:10px;color:#888;text-transform:uppercase}</style></head><body><h1>CRM Starter</h1><p style="color:#666">${tfLabel} Report · ${today()}</p><div style="margin:16px 0">${[["Revenue",fmt(totalRev)],["Jobs",tfJobs.length],["Close Rate",cr+"%"],["Profit",fmt(gp)]].map(([l,v])=>`<div class="kpi"><div class="kv">${v}</div><div class="kl">${l}</div></div>`).join("")}</div><h2>Job Breakdown</h2><table><thead><tr><th>Date</th><th>Customer</th><th>Address</th><th class="num">Amount</th><th>Status</th></tr></thead><tbody>${tfJobs.slice(0,100).map(j=>{const c=customers.find(x=>x.id===j.customerId);return`<tr><td>${j.scheduledDate}</td><td>${c?c.firstName+" "+c.lastName:""}</td><td>${j.address?.split(",")[0]||""}</td><td class="num">$${j.amount}</td><td>${j.status}</td></tr>`;}).join("")}</tbody></table><p style="font-size:10px;color:#999;margin-top:24px">CRM Starter · your area</p><script>window.onload=()=>setTimeout(window.print,300)<\/script></body></html>`;
            const w = window.open("","_blank"); if(w){w.document.write(html);w.document.close();}
          }}><FileText size={12} className="inline mr-1" />PDF</GBtn>
        </div>
      </div>

      {/* Revenue collected today / this week / this month */}
      <div className="grid grid-cols-3 gap-3">
        <Glass className="p-4 text-center">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Today</div>
          <div className="text-2xl font-black text-brand-400">{fmt(todayRev)}</div>
          <div className="text-[10px] text-white/40">{jobs.filter(j => j.status === "completed" && j.scheduledDate === today()).length} jobs</div>
        </Glass>
        <Glass className="p-4 text-center">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">This Week</div>
          <div className="text-2xl font-black text-brand-400">{fmt(thisWeekRev)}</div>
          <div className="text-[10px] text-white/40">{jobs.filter(j => j.status === "completed" && j.scheduledDate >= thisWeekStart).length} jobs</div>
        </Glass>
        <Glass className="p-4 text-center">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">This Month</div>
          <div className="text-2xl font-black text-brand-400">{fmt(thisMonthRev)}</div>
          <div className="text-[10px] text-white/40">{jobs.filter(j => j.status === "completed" && j.scheduledDate?.slice(0,7) === today().slice(0,7)).length} jobs</div>
        </Glass>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label={"Revenue (" + tfLabel + ")"} value={fmt(totalRev)} />
        <Stat icon={Receipt} label={"Expenses (" + tfLabel + ")"} value={fmt(totalExp)} />
        <Stat icon={TrendingUp} label={"Gross Profit"} value={fmt(gp)} change={gpPct + "%"} />
        <Stat icon={Percent} label="Close Rate" value={cr + "%"} />
        <Stat icon={Briefcase} label="Jobs Completed" value={tfJobs.length} />
        <Stat icon={DollarSign} label="Avg Job Value" value={fmt(avgJobValue)} />
        <Stat icon={Clock} label="Avg Days to Pay" value={avgDaysToPay} />
        <Stat icon={Users} label="Customers" value={customers.length} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Cash Revenue</div>
          <div className="text-xl font-bold text-green-400">{fmt(cashRev)}</div>
          <div className="text-xs text-white/50">{cashPct}% of total · {cashJobs.length} jobs</div>
          <div className="mt-2 h-1.5 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{width: cashPct + "%"}} /></div>
        </Glass>
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Card Revenue</div>
          <div className="text-xl font-bold text-blue-400">{fmt(cardRev)}</div>
          <div className="text-xs text-white/50">{100-cashPct}% of total · {tfJobs.length - cashJobs.length} jobs</div>
          <div className="mt-2 h-1.5 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{width: (100-cashPct) + "%"}} /></div>
        </Glass>
        <Glass className="p-4">
          <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Tips Collected</div>
          <div className="text-xl font-bold text-yellow-400">{fmt(totalTips)}</div>
          <div className="text-xs text-white/50">{tipRate}% tip rate · avg {fmt(avgTip)}/tip</div>
          <div className="mt-2 h-1.5 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-yellow-400 rounded-full" style={{width: Math.min(tipRate, 100) + "%"}} /></div>
        </Glass>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Glass className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold">Revenue vs Expenses</h3>
            <TimeframeSelector value={timeframe} onChange={setTimeframe} compact options={["30d","90d","6m","1y","all"]} />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#73737322" />
              <XAxis dataKey="month" stroke="#ffffff60" fontSize={11} />
              <YAxis stroke="#ffffff60" fontSize={11} tickFormatter={v => "$" + (v >= 1000 ? Math.round(v/1000) + "k" : v)} />
              <Tooltip contentStyle={{ background: "rgba(0,0,0,0.9)", border: "1px solid #9f1239", borderRadius: "8px" }} formatter={(v, n) => [fmt(Number(v)), n === "revenue" ? "Revenue" : "Expenses"]} />
              <Bar dataKey="revenue" fill={themeColor("--chart-1")} radius={[6,6,0,0]} name="revenue" />
              <Bar dataKey="expenses" fill={themeColor("--chart-3")} radius={[6,6,0,0]} name="expenses" />
            </BarChart>
          </ResponsiveContainer>
        </Glass>
        <Glass className="p-5">
          <h3 className="font-semibold mb-4">Close Rate</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={[{ name: "Closed", value: cr }, { name: "Open", value: 100 - cr }]} cx="50%" cy="50%" innerRadius={55} outerRadius={85} startAngle={90} endAngle={-270} dataKey="value">
                  <Cell fill={themeColor("--chart-1")} />
                  <Cell fill="#1f1f1f" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-3xl font-bold">{cr}%</div>
              <div className="text-xs text-white/50">{approved} of {total}</div>
            </div>
          </div>
        </Glass>
      </div>
      <Glass className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold">Seasonal Revenue Trend</h3>
          <div className="flex items-center gap-3">
            <div className="text-xs text-white/40">Next month forecast: <span className="text-green-400 font-bold">{fmt(monthlyRevenue.slice(-3).reduce((s,m)=>s+m.revenue,0)/3*1.1)}</span></div>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={monthlyRevenue}>
            <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={themeColor("--chart-1")} stopOpacity={0.6} /><stop offset="100%" stopColor="#9f1239" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#73737322" />
            <XAxis dataKey="month" stroke="#ffffff60" fontSize={11} />
            <YAxis stroke="#ffffff60" fontSize={11} tickFormatter={v => "$" + (v >= 1000 ? Math.round(v/1000) + "k" : v)} />
            <Tooltip contentStyle={{ background: "rgba(0,0,0,0.9)", border: "1px solid #9f1239", borderRadius: "8px" }} formatter={v => fmt(Number(v))} />
            <Area type="monotone" dataKey="revenue" stroke={themeColor("--chart-1")} strokeWidth={2} fill="url(#sg)" name="Revenue" />
          </AreaChart>
        </ResponsiveContainer>
      </Glass>

      {/* Year-over-Year comparison */}
      {(() => {
        const now = new Date();
        const thisYear = now.getFullYear();
        const lastYear = thisYear - 1;
        const thisYearJobs = jobs.filter(j => j.status === "completed" && j.scheduledDate?.startsWith(String(thisYear)));
        const lastYearJobs = jobs.filter(j => j.status === "completed" && j.scheduledDate?.startsWith(String(lastYear)));
        const thisYearRev = thisYearJobs.reduce((s,j)=>s+j.amount,0);
        const lastYearRev = lastYearJobs.reduce((s,j)=>s+j.amount,0);
        const growth = lastYearRev > 0 ? ((thisYearRev - lastYearRev) / lastYearRev * 100).toFixed(1) : null;
        const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const yoyData = months.map((m, i) => {
          const thisRev = jobs.filter(j => j.status==="completed" && j.scheduledDate?.startsWith(thisYear+"-"+(String(i+1).padStart(2,"0")))).reduce((s,j)=>s+j.amount,0);
          const lastRev = jobs.filter(j => j.status==="completed" && j.scheduledDate?.startsWith(lastYear+"-"+(String(i+1).padStart(2,"0")))).reduce((s,j)=>s+j.amount,0);
          return { month: m, [thisYear]: thisRev, [lastYear]: lastRev };
        });
        return <Glass className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Year-over-Year</h3>
            {growth && <div className={`text-sm font-bold ${Number(growth)>=0?"text-green-400":"text-brand-400"}`}>{Number(growth)>=0?"+":""}{growth}% vs {lastYear}</div>}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-black/40 border border-brand-900/20 rounded-xl text-center">
              <div className="text-xs text-white/50 mb-1">{thisYear} Revenue</div>
              <div className="text-2xl font-bold text-brand-400">{fmt(thisYearRev)}</div>
              <div className="text-xs text-white/40">{thisYearJobs.length} jobs</div>
            </div>
            <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-center">
              <div className="text-xs text-white/50 mb-1">{lastYear} Revenue</div>
              <div className="text-2xl font-bold text-white/60">{fmt(lastYearRev)}</div>
              <div className="text-xs text-white/40">{lastYearJobs.length} jobs</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={yoyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#73737322" />
              <XAxis dataKey="month" stroke="#ffffff40" fontSize={10} />
              <YAxis stroke="#ffffff40" fontSize={10} tickFormatter={v => "$"+(v>=1000?Math.round(v/1000)+"k":v)} />
              <Tooltip contentStyle={{ background:"rgba(0,0,0,0.9)", border:"1px solid #9f1239", borderRadius:"8px", fontSize:"11px" }} formatter={v => fmt(Number(v))} />
              <Bar dataKey={thisYear} fill={themeColor("--chart-1")} radius={[4,4,0,0]} name={String(thisYear)} />
              <Bar dataKey={lastYear} fill="#7c3aed44" radius={[4,4,0,0]} name={String(lastYear)} />
            </BarChart>
          </ResponsiveContainer>
        </Glass>;
      })()}

      {/* Close Rate by Lead Source */}
      {(() => {
        const srcMap: Record<string, {source: string; total: number; converted: number}> = {};
        customers.forEach(c => {
          const src = c.leadSource || "Unknown";
          if (!srcMap[src]) srcMap[src] = { source: src, total: 0, converted: 0 };
          srcMap[src].total++;
          const hasJob = jobs.some(j => j.customerId === c.id && j.status === "completed");
          if (hasJob) srcMap[src].converted++;
        });
        const srcArr = Object.values(srcMap).filter(s => s.total >= 1).sort((a,b) => (b.converted/b.total) - (a.converted/a.total));
        if (srcArr.length === 0) return null;
        return <Glass className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-brand-400" />Close Rate by Lead Source</h3>
          <div className="space-y-3">
            {srcArr.map(s => {
              const rate = Math.round(s.converted / s.total * 100);
              return <div key={s.source} className="flex items-center gap-3">
                <div className="text-xs text-white/70 w-28 flex-shrink-0 truncate">{s.source}</div>
                <div className="flex-1 h-3 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-600 rounded-full transition-all text-brand-fg" style={{ width: rate + "%" }} />
                </div>
                <div className="text-xs font-bold w-10 text-right">{rate}%</div>
                <div className="text-[10px] text-white/40 w-16 text-right">{s.converted}/{s.total}</div>
              </div>;
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-brand-900/20 text-[10px] text-white/40">Conversion = customers who had at least one completed job</div>
        </Glass>;
      })()}

      {/* Crew Performance */}
      {crewStats.length > 0 && <Glass className="p-5">
        <div className="flex items-center gap-2 mb-4"><UserCheck size={14} className="text-brand-400" /><h3 className="font-semibold">Crew Performance</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/30 text-xs uppercase tracking-wider text-white/50">
              <th className="text-left py-2">Tech</th>
              <th className="text-right py-2">Jobs</th>
              <th className="text-right py-2 hidden sm:table-cell">Hours</th>
              <th className="text-right py-2">Revenue</th>
              <th className="text-right py-2 hidden md:table-cell">$/hr</th>
            </tr></thead>
            <tbody>
              {crewStats.map((c, i) => <tr key={i} className="border-b border-brand-900/10 hover:bg-white/5">
                <td className="py-2.5"><div className="flex items-center gap-2"><div className={"w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold " + (i === 0 ? "bg-brand-600" : "bg-white/10")}>{i + 1}</div><div><div className="font-medium">{c.name}</div><div className="text-[10px] text-white/40">{c.role}</div></div></div></td>
                <td className="py-2.5 text-right font-semibold">{c.jobs}</td>
                <td className="py-2.5 text-right text-white/70 hidden sm:table-cell">{c.hours.toFixed(1)}h</td>
                <td className="py-2.5 text-right font-bold text-brand-400">{fmt(c.revenue)}</td>
                <td className="py-2.5 text-right text-green-400 hidden md:table-cell">{c.efficiency ? "$" + c.efficiency : "—"}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </Glass>}

      {/* Chemical Usage */}
      {chemArr.length > 0 && <Glass className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2"><FlaskConical size={14} className="text-brand-400" /><h3 className="font-semibold">Chemical Cost Report</h3></div>
          <div className="flex gap-4 text-xs text-white/50">
            <span>Total used: {totalChemGal.toFixed(1)} gal</span>
            <span className="text-brand-400 font-bold">{fmt(totalChemCost)} total cost</span>
            <span>Avg per job: {tfJobs.length > 0 ? fmt(totalChemCost / tfJobs.length) : "—"}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-brand-900/30 text-[10px] uppercase text-white/50">
              <th className="text-left pb-2">Chemical</th>
              <th className="text-right pb-2">Gallons</th>
              <th className="text-right pb-2">Cost</th>
              <th className="text-right pb-2">% of total</th>
              <th className="text-left pb-2 pl-4">Usage bar</th>
            </tr></thead>
            <tbody>
              {chemArr.map((c, i) => {
                const pct = totalChemCost ? (c.cost / totalChemCost) * 100 : 0;
                return <tr key={i} className="border-b border-brand-900/10 hover:bg-white/5">
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2 text-right text-white/70">{c.gallons.toFixed(1)}</td>
                  <td className="py-2 text-right font-bold text-brand-400">{fmt(c.cost)}</td>
                  <td className="py-2 text-right text-white/60">{pct.toFixed(0)}%</td>
                  <td className="py-2 pl-4"><div className="h-2 bg-black/40 rounded-full overflow-hidden w-24"><div className="h-full bg-brand-600 rounded-full text-brand-fg" style={{ width: pct + "%" }} /></div></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
        {totalChemCost > 0 && totalRev > 0 && <div className="mt-3 pt-3 border-t border-brand-900/20 text-xs text-white/50 flex gap-4">
          <span>Chemical cost as % of revenue: <span className="text-brand-400 font-bold">{(totalChemCost / totalRev * 100).toFixed(1)}%</span></span>
          <span>Industry benchmark: ~8-12%</span>
          {(totalChemCost / totalRev * 100) > 15 && <span className="text-yellow-400">⚠ Above benchmark — review chemical sourcing</span>}
        </div>}
      </Glass>}

      <Glass className="p-5">
        <h3 className="font-semibold mb-4">Top Customers</h3>
        <div className="space-y-2">
          {top.map((c, i) => <div key={c.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5">
            <div className={"w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold " + (i === 0 ? "bg-brand-600" : "bg-white/10")}>#{i + 1}</div>
            <div className="flex-1"><div className="font-medium text-sm">{c.firstName} {c.lastName}</div><div className="text-xs text-white/50">{c.email}</div></div>
            <div className="font-bold text-brand-400">{fmt(c.totalSpent)}</div>
          </div>)}
        </div>
      </Glass>

      {/* Average job value by service type */}
      {(() => {
        const svcMap: Record<string, {name: string; jobs: number; total: number}> = {};
        tfJobs.forEach(j => {
          // Group by the job's first line item / tag, falling back to job type.
          const svc = (j as any).lineItems?.[0]?.description || (j.tags || [])[0] || ((j as any).jobType === "commercial" ? "Commercial" : "Residential");
          if (!svcMap[svc]) svcMap[svc] = { name: svc, jobs: 0, total: 0 };
          svcMap[svc].jobs++;
          svcMap[svc].total += j.amount;
        });
        const svcArr = Object.values(svcMap).sort((a,b) => (b.total/b.jobs) - (a.total/a.jobs));
        if (svcArr.length === 0) return null;
        const maxAvg = Math.max(...svcArr.map(s => s.total / s.jobs));
        return <Glass className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart2 size={14} className="text-brand-400" />Avg Job Value by Service</h3>
          <div className="space-y-3">
            {svcArr.map(s => {
              const avg = s.total / s.jobs;
              return <div key={s.name} className="flex items-center gap-3">
                <div className="text-xs text-white/70 w-36 truncate flex-shrink-0">{s.name}</div>
                <div className="flex-1 h-2.5 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-600 rounded-full text-brand-fg" style={{ width: (avg/maxAvg*100) + "%" }} />
                </div>
                <div className="text-xs font-bold text-brand-400 w-16 text-right">{fmt(avg)}</div>
                <div className="text-[10px] text-white/40 w-12 text-right">{s.jobs} jobs</div>
              </div>;
            })}
          </div>
        </Glass>;
      })()}
      <Glass className="p-5">
        <h3 className="font-semibold mb-4">Lead Source ROI Report</h3>
        {(() => {
          const srcColors = { Google:"#4285F4", Facebook:"#1877F2", Referral:"#16a34a", Nextdoor:"#11B981", Website:"#a3a3a3", Instagram:"#E1306C", "Yard Sign":"#f59e0b", Angi:"#ea580c", Thumbtack:"#7c3aed", Direct:"#64748b", Other:"#94a3b8" };
          const srcMap: Record<string, {source: string; count: number; revenue: number}> = {};
          customers.forEach(c => {
            const src = c.leadSource || "Unknown";
            if (!srcMap[src]) srcMap[src] = { source: src, count: 0, revenue: 0 };
            srcMap[src].count++;
            srcMap[src].revenue += c.totalSpent || 0;
          });
          const srcArr = Object.values(srcMap).sort((a, b) => b.revenue - a.revenue);
          const total = srcArr.reduce((s, x) => s + x.count, 0);
          const pieData = srcArr.map(s => ({ ...s, value: Math.round(s.count / total * 100), color: srcColors[s.source] || "#64748b" }));
          return <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2}>
                  {pieData.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "rgba(0,0,0,0.9)", border: "1px solid #9f1239", borderRadius: "8px", fontSize: "11px" }} formatter={(v, n, p) => [p.payload.count + " customers · " + fmt(p.payload.revenue), p.payload.source]} />
              </PieChart>
            </ResponsiveContainer>
            {/* Full ROI table */}
            <table className="w-full text-xs mt-3">
              <thead><tr className="border-b border-brand-900/30 text-[10px] uppercase text-white/40">
                <th className="text-left pb-2">Source</th>
                <th className="text-right pb-2">Customers</th>
                <th className="text-right pb-2">Revenue</th>
                <th className="text-right pb-2">Avg LTV</th>
                <th className="text-right pb-2">% of Revenue</th>
              </tr></thead>
              <tbody>
                {srcArr.map(s => {
                  const totalRev_ = srcArr.reduce((x,y) => x + y.revenue, 0);
                  const avgLTV = s.count > 0 ? s.revenue / s.count : 0;
                  const pct = totalRev_ > 0 ? (s.revenue / totalRev_ * 100).toFixed(1) : 0;
                  return <tr key={s.source} className="border-b border-brand-900/10 hover:bg-white/5">
                    <td className="py-2 flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: srcColors[s.source] || "#64748b" }} />{s.source}</td>
                    <td className="py-2 text-right text-white/60">{s.count}</td>
                    <td className="py-2 text-right font-bold text-brand-400">{fmt(s.revenue)}</td>
                    <td className="py-2 text-right text-white/70">{fmt(avgLTV)}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-brand-500 rounded-full text-brand-fg" style={{width: pct + "%"}} /></div>
                        <span className="text-white/50">{pct}%</span>
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
            {srcArr.length === 0 && <div className="text-xs text-white/40 text-center py-4">Add lead source to customers to see ROI data</div>}
          </>;
        })()}
      </Glass>

      {/* Labor Hours Report */}
      {employees.length > 0 && <Glass className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock size={14} className="text-brand-400" />Labor Hours Report</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/30 text-[10px] uppercase text-white/50">
              <th className="text-left pb-2">Employee</th>
              <th className="text-right pb-2">Jobs</th>
              <th className="text-right pb-2">Hours</th>
              <th className="text-right pb-2">Revenue</th>
              <th className="text-right pb-2">$/hr</th>
            </tr></thead>
            <tbody>
              {employees.filter(e => e.status === "active").map(e => {
                const crewJobs = tfJobs.filter(j => (j.crew || []).includes(e.id));
                const hrs = crewJobs.reduce((s, j) => s + (Number(j.loggedHours) || 0), 0);
                const rev = crewJobs.reduce((s, j) => s + j.amount, 0);
                return <tr key={e.id} className="border-b border-brand-900/10 hover:bg-white/5">
                  <td className="py-2.5"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-[10px] font-bold text-brand-fg">{e.firstName?.[0]}</div>{e.firstName} {e.lastName?.[0]}.</div></td>
                  <td className="py-2.5 text-right text-white/70">{crewJobs.length}</td>
                  <td className="py-2.5 text-right font-semibold">{hrs.toFixed(1)}h</td>
                  <td className="py-2.5 text-right text-brand-400 font-bold">{fmt(rev)}</td>
                  <td className="py-2.5 text-right text-white/60">{hrs > 0 ? fmt(rev / hrs) : "—"}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </Glass>}

      {/* Customer Acquisition Cost + Revenue by Payment Method */}
      <div className="grid md:grid-cols-2 gap-5">
        <Glass className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign size={14} className="text-brand-400" />Revenue by Payment Method</h3>
          {(() => {
            const cash = tfJobs.filter(j => j.isCash).reduce((s, j) => s + j.amount, 0);
            const card = tfJobs.filter(j => !j.isCash).reduce((s, j) => s + j.amount, 0);
            const total = cash + card;
            return <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-green-950/20 border border-green-700/30 rounded-xl text-center">
                  <div className="text-xl font-bold text-green-400">{fmt(cash)}</div>
                  <div className="text-xs text-white/50 mt-0.5">💵 Cash</div>
                  <div className="text-[10px] text-white/40">{total > 0 ? (cash/total*100).toFixed(0) : 0}% of revenue</div>
                </div>
                <div className="p-3 bg-blue-950/20 border border-blue-700/30 rounded-xl text-center">
                  <div className="text-xl font-bold text-blue-400">{fmt(card)}</div>
                  <div className="text-xs text-white/50 mt-0.5">💳 Card / Check</div>
                  <div className="text-[10px] text-white/40">{total > 0 ? (card/total*100).toFixed(0) : 0}% of revenue</div>
                </div>
              </div>
              <div className="h-3 bg-black/40 rounded-full overflow-hidden flex">
                <div className="bg-green-500 h-full transition-all" style={{ width: total > 0 ? (cash/total*100) + "%" : "0%" }} />
                <div className="bg-blue-500 h-full transition-all" style={{ width: total > 0 ? (card/total*100) + "%" : "100%" }} />
              </div>
              <div className="text-[10px] text-white/40 text-center">Based on {tfJobs.length} completed jobs in {tfLabel} window</div>
            </div>;
          })()}
        </Glass>

        <Glass className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Target size={14} className="text-brand-400" />Customer Acquisition Cost</h3>
          <CACCalculator tfExpenses={tfExpenses} customers={customers} timeframe={timeframe} />
        </Glass>
      </div>
      {/* Accounts Receivable Aging Report */}
      {(() => {
        const unpaid = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt);
        if (unpaid.length === 0) return null;
        const buckets = [
          { label: "Current (0-30d)", min: 0, max: 30, color: "text-green-400", bg: "bg-green-500" },
          { label: "31-60 days", min: 31, max: 60, color: "text-yellow-400", bg: "bg-yellow-400" },
          { label: "61-90 days", min: 61, max: 90, color: "text-orange-400", bg: "bg-orange-500" },
          { label: "90+ days", min: 91, max: 9999, color: "text-brand-400", bg: "bg-brand-500" },
        ].map(b => {
          const items = unpaid.filter(e => { const d = daysSince(e.invoicedAt); return d >= b.min && d <= b.max; });
          return { ...b, items, total: items.reduce((s,e) => s + e.total, 0) };
        });
        const totalAR = unpaid.reduce((s,e) => s + e.total, 0);
        return (
          <Glass className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Clock size={14} className="text-brand-400" />A/R Aging Report</h3>
              <div className="text-sm font-bold text-brand-400">Total Outstanding: {fmt(totalAR)}</div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {buckets.map(b => (
                <div key={b.label} className="p-3 bg-black/40 rounded-xl border border-brand-900/20">
                  <div className="text-[10px] text-white/50 mb-1">{b.label}</div>
                  <div className={"text-xl font-bold " + b.color}>{fmt(b.total)}</div>
                  <div className="text-[10px] text-white/40">{b.items.length} invoice{b.items.length !== 1 ? "s" : ""}</div>
                  <div className="mt-2 h-1 bg-black/40 rounded-full overflow-hidden"><div className={"h-full rounded-full " + b.bg} style={{ width: totalAR > 0 ? (b.total/totalAR*100)+"%" : "0%" }} /></div>
                </div>
              ))}
            </div>
            {buckets[3].items.length > 0 && <div className="border-t border-brand-900/30 pt-3">
              <div className="text-xs text-brand-400 font-semibold mb-2">⚠️ 90+ days — action needed</div>
              {buckets[3].items.slice(0,5).map(inv => {
                const cu = customers.find(x => x.id === inv.customerId);
                return <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-brand-900/10 text-xs">
                  <span className="text-white/70">{cu ? cu.firstName + " " + cu.lastName : "?"}</span>
                  <span className="text-white/40">{daysSince(inv.invoicedAt)}d overdue</span>
                  <span className="font-bold text-brand-400">{fmt(inv.total)}</span>
                </div>;
              })}
            </div>}
          </Glass>
        );
      })()}

      {/* Seasonal Trend Analysis */}
      {(() => {
        const seasonalData = [
          { season: "Winter", months: [12,1,2], icon: "❄️", color: "#60a5fa" },
          { season: "Spring", months: [3,4,5], icon: "🌸", color: "#34d399" },
          { season: "Summer", months: [6,7,8], icon: "☀️", color: "#fbbf24" },
          { season: "Fall",   months: [9,10,11], icon: "🍂", color: "#d4d4d4" },
        ].map(s => {
          const seasonJobs = jobs.filter(j => j.status === "completed" && j.scheduledDate && s.months.includes(new Date(j.scheduledDate + "T00:00:00").getMonth() + 1));
          const rev = seasonJobs.reduce((sum, j) => sum + j.amount, 0);
          return { ...s, jobs: seasonJobs.length, rev };
        });
        const maxRev = Math.max(...seasonalData.map(s => s.rev), 1);
        return (
          <Glass className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart2 size={14} className="text-brand-400" />Seasonal Trend Analysis</h3>
            <div className="grid grid-cols-4 gap-3">
              {seasonalData.map(s => (
                <div key={s.season} className="text-center">
                  <div className="text-3xl mb-2">{s.icon}</div>
                  <div className="font-bold text-sm">{s.season}</div>
                  <div className="mt-3 mx-auto w-12 bg-black/40 rounded-full overflow-hidden" style={{height: "80px", display:"flex", alignItems:"flex-end"}}>
                    <div className="w-full rounded-full transition-all" style={{height: (s.rev/maxRev*100) + "%", background: s.color, minHeight: s.rev > 0 ? "8px" : "0"}} />
                  </div>
                  <div className="text-xs font-bold mt-2" style={{color: s.color}}>{fmt(s.rev)}</div>
                  <div className="text-[10px] text-white/50">{s.jobs} jobs</div>
                  {s.rev === Math.max(...seasonalData.map(x => x.rev)) && s.rev > 0 && <div className="text-[9px] text-yellow-400 mt-1">🏆 Peak season</div>}
                </div>
              ))}
            </div>
            <div className="mt-4 text-[10px] text-white/40 text-center">Based on {jobs.filter(j => j.status === "completed").length} completed jobs — all time</div>
          </Glass>
        );
      })()}

      {/* Lifetime Value Report */}
      <Glass className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Award size={14} className="text-yellow-400" />Lifetime Value Report</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {(() => {
            const ltvAll = customers.map(c => c.totalSpent || 0);
            const avgLTV = ltvAll.length ? Math.round(ltvAll.reduce((s,v) => s+v, 0) / ltvAll.length) : 0;
            const medianLTV = ltvAll.length ? [...ltvAll].sort((a,b)=>a-b)[Math.floor(ltvAll.length/2)] : 0;
            const highValue = customers.filter(c => (c.totalSpent||0) >= 1000).length;
            const churned = customers.filter(c => {
              const lastJob = jobs.filter(j => j.customerId === c.id && j.status === "completed").sort((a,b) => b.scheduledDate?.localeCompare(a.scheduledDate))[0];
              return !lastJob || daysSince(lastJob.scheduledDate) > 365;
            }).length;
            return [
              { label: "Avg LTV", value: fmt(avgLTV), color: "text-brand-400" },
              { label: "Median LTV", value: fmt(medianLTV), color: "text-white" },
              { label: "High Value (>$1k)", value: highValue, color: "text-green-400" },
              { label: "Churned (>1yr)", value: churned, color: "text-yellow-400" },
            ].map(s => <div key={s.label} className="p-3 bg-black/40 rounded-xl border border-brand-900/20 text-center">
              <div className="text-[10px] text-white/50 mb-1">{s.label}</div>
              <div className={"text-xl font-bold " + s.color}>{s.value}</div>
            </div>);
          })()}
        </div>
        {/* Top customers by LTV */}
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Top Customers by Lifetime Value</div>
        <div className="space-y-2">
          {[...customers].sort((a,b) => (b.totalSpent||0) - (a.totalSpent||0)).slice(0,8).map((c,i) => {
            const jobCount = jobs.filter(j => j.customerId === c.id && j.status === "completed").length;
            const maxLTV = customers.reduce((m,x) => Math.max(m, x.totalSpent||0), 1);
            return <div key={c.id} className="flex items-center gap-3">
              <div className={"w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 " + (i===0?"bg-yellow-500 text-black":i===1?"bg-gray-400 text-black":i===2?"bg-orange-500 text-black":"bg-white/10 text-white/60")}>{i+1}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{c.firstName} {c.lastName}</div>
                <div className="text-[10px] text-white/40">{jobCount} jobs · {c.tags?.join(", ") || c.leadSource || "—"}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-brand-400">{fmt(c.totalSpent||0)}</div>
                <div className="w-20 h-1 bg-black/40 rounded-full overflow-hidden mt-1"><div className="h-full bg-brand-500 rounded-full text-brand-fg" style={{width: ((c.totalSpent||0)/maxLTV*100)+"%"}} /></div>
              </div>
            </div>;
          })}
        </div>
      </Glass>

      <WeeklyBusinessReview jobs={jobs} customers={customers} estimates={estimates} expenses={expenses} />
    </div>
  );
}

