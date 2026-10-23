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

export function AnalyticsPage({ jobs = [], customers = [], estimates = [], expenses = [] }) {
  const [timeframe, setTimeframe] = useState("6m");
  const [compareTimeframe, setCompareTimeframe] = useState("1y");
  const [chartType, setChartType] = useState("area"); // area | bar | line
  const [activeCharts, setActiveCharts] = useState(["revenue","jobs","closeRate","pipeline"]);
  const [showComparison, setShowComparison] = useState(true);
  const [granularity, setGranularity] = useState("monthly"); // weekly | monthly | quarterly

  const completed = jobs.filter(j => j.status === "completed");
  const tfDays = TIMEFRAMES.find(t => t.key === timeframe)?.days || 180;
  const compDays = TIMEFRAMES.find(t => t.key === compareTimeframe)?.days || 365;

  // Build time series for any metric
  const buildSeries = (daysBack, gran) => {
    const points = [];
    const now = new Date();
    const n = gran === "weekly" ? Math.min(daysBack / 7, 24) : gran === "quarterly" ? Math.min(daysBack / 91, 8) : Math.min(daysBack / 30, 24);
    const step = gran === "weekly" ? 7 : gran === "quarterly" ? 91 : 30;

    for (let i = Math.floor(n) - 1; i >= 0; i--) {
      const end = new Date(now); end.setDate(end.getDate() - i * step);
      const start = new Date(end); start.setDate(start.getDate() - step);
      const startStr = start.toISOString().slice(0,10);
      const endStr = end.toISOString().slice(0,10);

      const periodJobs = completed.filter(j => j.scheduledDate >= startStr && j.scheduledDate < endStr);
      const periodEst = estimates.filter(e => e.createdAt >= startStr && e.createdAt < endStr);
      const periodExp = expenses.filter(e => e.date >= startStr && e.date < endStr);
      const periodCust = customers.filter(c => c.createdAt >= startStr && c.createdAt < endStr);

      const revenue = periodJobs.reduce((s, j) => s + j.amount, 0);
      const expTotal = periodExp.reduce((s, e) => s + Number(e.amount), 0);
      const approved = periodEst.filter(e => e.status === "approved").length;
      const label = gran === "weekly"
        ? end.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : gran === "quarterly"
        ? "Q" + (Math.floor(end.getMonth() / 3) + 1) + " '" + String(end.getFullYear()).slice(2)
        : end.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      points.push({
        label,
        revenue,
        expenses: expTotal,
        profit: revenue - expTotal,
        jobs: periodJobs.length,
        newCustomers: periodCust.length,
        estimates: periodEst.length,
        closeRate: periodEst.length > 0 ? Math.round(approved / periodEst.length * 100) : 0,
        avgJobValue: periodJobs.length > 0 ? Math.round(revenue / periodJobs.length) : 0,
        pipeline: jobs.filter(j => j.status === "scheduled" && j.scheduledDate >= startStr && j.scheduledDate < endStr).reduce((s,j)=>s+j.amount,0),
      });
    }
    return points;
  };

  const primary = buildSeries(tfDays, granularity);
  const comparison = showComparison ? buildSeries(compDays, granularity) : [];

  const chartConfig = {
    revenue:      { label: "Revenue",        color: themeColor("--chart-1"), format: fmt },
    expenses:     { label: "Expenses",       color: "#7c3aed", format: fmt },
    profit:       { label: "Profit",         color: "#16a34a", format: fmt },
    jobs:         { label: "Jobs Done",      color: "#f59e0b", format: v => v },
    newCustomers: { label: "New Customers",  color: "#06b6d4", format: v => v },
    closeRate:    { label: "Close Rate %",   color: "#8b5cf6", format: v => v + "%" },
    avgJobValue:  { label: "Avg Job Value",  color: "#f97316", format: fmt },
    pipeline:     { label: "Pipeline",       color: "#64748b", format: fmt },
  };

  const toggleChart = k => setActiveCharts(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);

  const tfTotals = {
    revenue: primary.reduce((s,p) => s + p.revenue, 0),
    jobs: primary.reduce((s,p) => s + p.jobs, 0),
    profit: primary.reduce((s,p) => s + p.profit, 0),
    customers: primary.reduce((s,p) => s + p.newCustomers, 0),
  };

  const tooltipStyle = { background: "rgba(0,0,0,0.95)", border: "1px solid #262626", borderRadius: "10px", fontSize: "11px" };

  const renderChart = (dataKey, cfg) => {
    const data = primary;
    const color = cfg.color;
    if (chartType === "bar") return (
      <BarChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#73737318" />
        <XAxis dataKey="label" stroke="#ffffff40" fontSize={9} />
        <YAxis stroke="#ffffff40" fontSize={9} tickFormatter={cfg.format} width={45} />
        <Tooltip contentStyle={tooltipStyle} formatter={v => [cfg.format(v), cfg.label]} />
        <Bar dataKey={dataKey} fill={color} radius={[4,4,0,0]} name={cfg.label} />
        {showComparison && comparison.length > 0 && <Bar dataKey={dataKey} data={comparison} fill={color + "55"} radius={[4,4,0,0]} name={"vs " + compareTimeframe} />}
      </BarChart>
    );
    if (chartType === "line") return (
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#73737318" />
        <XAxis dataKey="label" stroke="#ffffff40" fontSize={9} />
        <YAxis stroke="#ffffff40" fontSize={9} tickFormatter={cfg.format} width={45} />
        <Tooltip contentStyle={tooltipStyle} formatter={v => [cfg.format(v), cfg.label]} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} name={cfg.label} />
        {showComparison && comparison.length > 0 && <Line type="monotone" data={comparison} dataKey={dataKey} stroke={color + "55"} strokeWidth={1.5} strokeDasharray="4 4" dot={false} name={"vs " + compareTimeframe} />}
      </LineChart>
    );
    return (
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <defs><linearGradient id={"ag-"+dataKey} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.4} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#73737318" />
        <XAxis dataKey="label" stroke="#ffffff40" fontSize={9} />
        <YAxis stroke="#ffffff40" fontSize={9} tickFormatter={cfg.format} width={45} />
        <Tooltip contentStyle={tooltipStyle} formatter={v => [cfg.format(v), cfg.label]} />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={"url(#ag-"+dataKey+")"} dot={false} name={cfg.label} />
        {showComparison && comparison.length > 0 && <Area type="monotone" data={comparison} dataKey={dataKey} stroke={color + "66"} strokeWidth={1.5} strokeDasharray="4 4" fill="none" dot={false} name={"vs " + compareTimeframe} />}
      </AreaChart>
    );
  };

  const tfLabel = TIMEFRAMES.find(t => t.key === timeframe)?.label || "6M";

  return (
    <div className="space-y-5">
      {/* Header controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><TrendingUp size={20} className="text-brand-400" />Analytics</h2>
          <div className="text-xs text-white/50 mt-0.5">Interactive charts · multiple views · comparison mode</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Granularity */}
          <div className="flex gap-1 bg-black/40 border border-brand-900/30 rounded-xl p-1">
            {["weekly","monthly","quarterly"].map(g => <button key={g} onClick={() => setGranularity(g)} className={"px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase transition " + (granularity === g ? "bg-brand-600/40 text-white" : "text-white/40 hover:text-white")}>{g[0].toUpperCase()}</button>)}
          </div>
          {/* Chart type */}
          <div className="flex gap-1 bg-black/40 border border-brand-900/30 rounded-xl p-1">
            {[["area","∿"],["bar","▌"],["line","╱"]].map(([t,icon]) => <button key={t} onClick={() => setChartType(t)} title={t} className={"px-2.5 py-1 rounded-lg text-sm font-bold transition " + (chartType === t ? "bg-brand-600/40 text-white" : "text-white/40 hover:text-white")}>{icon}</button>)}
          </div>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} options={["30d","90d","6m","1y","3y","all"]} />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Revenue", val: fmt(tfTotals.revenue), sub: tfLabel + " total", icon: DollarSign, color: "text-brand-400" },
          { label: "Jobs", val: tfTotals.jobs, sub: "completed", icon: Briefcase, color: "text-amber-400" },
          { label: "Profit", val: fmt(tfTotals.profit), sub: tfTotals.revenue > 0 ? Math.round(tfTotals.profit/tfTotals.revenue*100) + "% margin" : "—", icon: TrendingUp, color: tfTotals.profit >= 0 ? "text-green-400" : "text-brand-400" },
          { label: "New Customers", val: tfTotals.customers, sub: "acquired", icon: Users, color: "text-cyan-400" },
        ].map(s => {
          const Icon = s.icon;
          return <Glass key={s.label} className="p-4 group cursor-default">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs text-white/50">{s.label}</div>
              <Icon size={14} className={s.color + " opacity-70 group-hover:opacity-100 transition"} />
            </div>
            <div className={"text-2xl font-bold " + s.color}>{s.val}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{s.sub}</div>
          </Glass>;
        })}
      </div>

      {/* Chart selector pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-white/40">Charts:</span>
        {Object.entries(chartConfig).map(([k, cfg]) => (
          <button key={k} onClick={() => toggleChart(k)} className={"px-3 py-1 rounded-full border text-[10px] font-semibold transition " + (activeCharts.includes(k) ? "text-white border-opacity-60" : "text-white/30 border-white/10 hover:text-white/60")} style={activeCharts.includes(k) ? { borderColor: cfg.color + "80", background: cfg.color + "20" } : {}}>
            <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ background: cfg.color }} />
            {cfg.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setShowComparison(!showComparison)} className={"px-3 py-1 rounded-full border text-[10px] font-semibold transition " + (showComparison ? "bg-purple-600/20 border-purple-500/50 text-purple-300" : "bg-black/40 border-white/10 text-white/40")}>
            {showComparison ? "✓ Comparing" : "Compare"}
          </button>
          {showComparison && <TimeframeSelector value={compareTimeframe} onChange={setCompareTimeframe} options={["30d","90d","6m","1y","3y","all"]} compact />}
        </div>
      </div>

      {/* Charts grid — dynamic based on selected charts */}
      <div className={"grid gap-4 " + (activeCharts.length === 1 ? "grid-cols-1" : activeCharts.length === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 lg:grid-cols-2")}>
        {activeCharts.map(k => {
          const cfg = chartConfig[k];
          if (!cfg) return null;
          const periodTotal = primary.reduce((s, p) => s + (p[k] || 0), 0);
          const max = Math.max(...primary.map(p => p[k] || 0));
          const trend = primary.length >= 2 ? ((primary[primary.length-1][k] - primary[0][k]) / (primary[0][k] || 1) * 100).toFixed(1) : null;
          return (
            <Glass key={k} className="p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                  <h3 className="font-semibold text-sm">{cfg.label}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {trend !== null && <span className={"text-xs font-semibold " + (Number(trend) >= 0 ? "text-green-400" : "text-brand-400")}>{Number(trend) >= 0 ? "↑" : "↓"}{Math.abs(Number(trend))}%</span>}
                  <span className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.format(periodTotal)}</span>
                </div>
              </div>
              <div className="text-[10px] text-white/40 mb-3">
                Peak: {cfg.format(max)}
                {showComparison && comparison.length > 0 && <span className="ml-2 opacity-60">dashed = {compareTimeframe}</span>}
              </div>
              <ResponsiveContainer width="100%" height={activeCharts.length === 1 ? 280 : 200}>
                {renderChart(k, cfg)}
              </ResponsiveContainer>
            </Glass>
          );
        })}
      </div>

      {/* Combined revenue + profit overlay chart */}
      {activeCharts.length === 0 && <Glass className="p-10 text-center"><TrendingUp size={40} className="mx-auto mb-3 text-white/20 anim-float" /><div className="text-white/50">Select charts above to display</div></Glass>}

      {/* Always-visible: revenue vs expenses vs profit combo */}
      <Glass className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><BarChart2 size={14} className="text-brand-400" />Revenue vs Expenses vs Profit</h3>
          <div className="flex gap-2 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-brand-500 text-brand-fg" />Revenue</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-violet-600" />Expenses</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-600" />Profit</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={primary} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#73737318" />
            <XAxis dataKey="label" stroke="#ffffff40" fontSize={9} />
            <YAxis stroke="#ffffff40" fontSize={9} tickFormatter={v => "$" + (v >= 1000 ? Math.round(v/1000) + "k" : v)} width={45} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(Number(v))} />
            <Bar dataKey="revenue" fill={themeColor("--chart-1")} radius={[3,3,0,0]} name="Revenue" />
            <Bar dataKey="expenses" fill="#7c3aed" radius={[3,3,0,0]} name="Expenses" />
            <Line type="monotone" dataKey="profit" stroke="#16a34a" strokeWidth={2.5} dot={false} name="Profit" />
          </ComposedChart>
        </ResponsiveContainer>
      </Glass>

      {/* Jobs + New Customers side by side */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Glass className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Briefcase size={14} className="text-amber-400" />Jobs Completed Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={primary} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#73737318" />
              <XAxis dataKey="label" stroke="#ffffff40" fontSize={9} />
              <YAxis stroke="#ffffff40" fontSize={9} width={30} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="jobs" fill="#f59e0b" radius={[4,4,0,0]} name="Jobs" />
            </BarChart>
          </ResponsiveContainer>
        </Glass>
        <Glass className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={14} className="text-cyan-400" />Customer Growth</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={primary} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs><linearGradient id="cgrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4}/><stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/></linearGradient></defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#73737318" />
              <XAxis dataKey="label" stroke="#ffffff40" fontSize={9} />
              <YAxis stroke="#ffffff40" fontSize={9} width={30} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="newCustomers" stroke="#06b6d4" strokeWidth={2.5} fill="url(#cgrad)" dot={false} name="New Customers" />
            </AreaChart>
          </ResponsiveContainer>
        </Glass>
      </div>

      {/* Close rate + avg job value */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Glass className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Target size={14} className="text-purple-400" />Close Rate Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={primary} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#73737318" />
              <XAxis dataKey="label" stroke="#ffffff40" fontSize={9} />
              <YAxis stroke="#ffffff40" fontSize={9} tickFormatter={v => v+"%"} domain={[0,100]} width={40} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [v + "%", "Close Rate"]} />
              <Line type="monotone" dataKey="closeRate" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: "#8b5cf6", r: 3 }} name="Close Rate" />
              {showComparison && comparison.length > 0 && <Line type="monotone" data={comparison} dataKey="closeRate" stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name={"vs " + compareTimeframe} />}
            </LineChart>
          </ResponsiveContainer>
        </Glass>
        <Glass className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><DollarSign size={14} className="text-orange-400" />Avg Job Value Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={primary} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#73737318" />
              <XAxis dataKey="label" stroke="#ffffff40" fontSize={9} />
              <YAxis stroke="#ffffff40" fontSize={9} tickFormatter={v => "$"+(v>=1000?Math.round(v/1000)+"k":v)} width={45} />
              <Tooltip contentStyle={tooltipStyle} formatter={v => [fmt(Number(v)), "Avg Job Value"]} />
              <Line type="monotone" dataKey="avgJobValue" stroke="#f97316" strokeWidth={2.5} dot={{ fill: "#f97316", r: 3 }} name="Avg Job Value" />
              {showComparison && comparison.length > 0 && <Line type="monotone" data={comparison} dataKey="avgJobValue" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </Glass>
      </div>
    </div>
  );
}

