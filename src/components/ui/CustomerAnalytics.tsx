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
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { Stat } from "./Stat";
import { PBar } from "./PBar";
import { PageFade } from "./PageFade";
import { TimeframeSelector } from "./TimeframeSelector";

export function CustomerAnalytics({ customers = [], jobs = [], estimates = [] }) {
  const [sortBy, setSortBy] = useState("ltv");
  const [churnFilter, setChurnFilter] = useState("all");

  const enriched = customers.map(c => {
    const cJobs = jobs.filter(j => j.customerId === c.id && j.status === "completed");
    const cEsts = estimates.filter(e => e.customerId === c.id);
    const revenue = cJobs.reduce((s, j) => s + (j.amount || 0), 0);
    const jobCount = cJobs.length;
    const lastJobDate = cJobs.map(j => j.scheduledDate).sort().pop() || null;
    const avgJobVal = jobCount ? revenue / jobCount : 0;
    const daysSinceLast = lastJobDate ? daysSince(lastJobDate) : 999;
    const firstJobDate = cJobs.map(j => j.scheduledDate).sort()[0] || null;
    const tenure = firstJobDate ? daysSince(firstJobDate) : 0;
    const freq = jobCount > 1 && tenure > 0 ? tenure / (jobCount - 1) : 0; // avg days between jobs
    // LTV = revenue + projected future value (3 more jobs at avg, discounted 20% for churn risk)
    const churnRisk = daysSinceLast > 180 ? "high" : daysSinceLast > 90 ? "medium" : "low";
    const churnDiscount = churnRisk === "high" ? 0.3 : churnRisk === "medium" ? 0.7 : 1.0;
    const projectedJobs = Math.min(5, Math.round(365 / Math.max(freq, 30)));
    const projectedLTV = revenue + projectedJobs * avgJobVal * churnDiscount;
    const estAccepted = cEsts.filter(e => e.status === "approved").length;
    const closeRate = cEsts.length ? Math.round((estAccepted / cEsts.length) * 100) : null;
    // Upsell opportunity
    const upsells = [];
    if (revenue > 500 && !cJobs.some(j => (j as any).isRecurring)) upsells.push("Maintenance plan");
    if (jobCount >= 3 && !c.notes?.includes("contract")) upsells.push("Annual contract");
    if (daysSinceLast > 150 && daysSinceLast < 300) upsells.push("Re-engagement offer");
    return { ...c, revenue, jobCount, lastJobDate, avgJobVal, daysSinceLast, churnRisk, projectedLTV, closeRate, upsells, tenure, freq };
  }).filter(c => c.jobCount > 0 || c.totalSpent > 0);

  const sorted = [...enriched]
    .filter(c => churnFilter === "all" || c.churnRisk === churnFilter)
    .sort((a, b) => {
      if (sortBy === "ltv") return b.projectedLTV - a.projectedLTV;
      if (sortBy === "revenue") return b.revenue - a.revenue;
      if (sortBy === "jobs") return b.jobCount - a.jobCount;
      if (sortBy === "churn") return b.daysSinceLast - a.daysSinceLast;
      return 0;
    });

  const totalLTV = enriched.reduce((s, c) => s + c.projectedLTV, 0);
  const avgLTV = enriched.length ? totalLTV / enriched.length : 0;
  const highChurn = enriched.filter(c => c.churnRisk === "high").length;
  const topCustomer = enriched.sort((a, b) => b.projectedLTV - a.projectedLTV)[0];

  const churnColor = r => r === "high" ? "text-brand-400 bg-brand-950/30 border-brand-700/40" : r === "medium" ? "text-yellow-400 bg-yellow-950/30 border-yellow-700/40" : "text-green-400 bg-green-950/30 border-green-700/40";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Total LTV" value={fmt(totalLTV)} />
        <Stat icon={TrendingUp} label="Avg LTV" value={fmt(avgLTV)} />
        <Stat icon={AlertTriangle} label="Churn Risk" value={highChurn + " high"} />
        <Stat icon={Star} label="Top Customer" value={topCustomer ? topCustomer.firstName + " " + topCustomer.lastName[0] + "." : "—"} />
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {[["all", "All"], ["low", "✅ Low risk"], ["medium", "⚠️ Medium"], ["high", "🔴 High risk"]].map(([k, l]) => (
            <button key={k} onClick={() => setChurnFilter(k)} className={"px-2.5 py-1 rounded-lg text-[11px] border transition " + (churnFilter === k ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          Sort by:
          {[["ltv", "LTV"], ["revenue", "Revenue"], ["jobs", "Jobs"], ["churn", "Last seen"]].map(([k, l]) => (
            <button key={k} onClick={() => setSortBy(k)} className={"px-2 py-1 rounded border " + (sortBy === k ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60")}>{l}</button>
          ))}
        </div>
      </div>

      {/* LTV Chart — top 8 customers */}
      {enriched.length > 0 && <Glass className="p-4">
        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp size={13} className="text-green-400" />Top Customer Revenue & Projected LTV</h4>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={[...enriched].sort((a, b) => b.projectedLTV - a.projectedLTV).slice(0, 8).map(c => ({ name: c.firstName + " " + c.lastName[0] + ".", revenue: Math.round(c.revenue), ltv: Math.round(c.projectedLTV) }))} margin={{ top: 4, right: 4, left: 4, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#73737318" />
            <XAxis dataKey="name" stroke="#ffffff40" fontSize={9} angle={-30} textAnchor="end" interval={0} />
            <YAxis stroke="#ffffff40" fontSize={9} tickFormatter={v => "$" + (v >= 1000 ? Math.round(v/1000) + "k" : v)} width={40} />
            <Tooltip contentStyle={{ background: "#0a0a0a", border: "1px solid #73737360", borderRadius: 8, fontSize: 11 }} formatter={v => fmt(Number(v))} />
            <Bar dataKey="revenue" fill="#ffffff" radius={[3,3,0,0]} name="Revenue" />
            <Bar dataKey="ltv" fill="#16a34a" radius={[3,3,0,0]} name="Projected LTV" opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 justify-center mt-2 text-[10px] text-white/50">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-brand-600 inline-block text-brand-fg" />Actual revenue</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-600 inline-block" />Projected LTV</span>
        </div>
      </Glass>}

      <Glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/30 bg-black/40">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/60">Customer</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Revenue</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60 hidden md:table-cell">Projected LTV</th>
              <th className="text-center px-4 py-3 text-xs uppercase tracking-wider text-white/60 hidden lg:table-cell">Churn Risk</th>
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/60 hidden xl:table-cell">Upsell Ops</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60 hidden md:table-cell">Last Service</th>
            </tr></thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.id} className="border-b border-brand-900/10 hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.firstName} {c.lastName}</div>
                    <div className="text-[10px] text-white/50 flex items-center gap-2 mt-0.5">
                      <span>{c.jobCount} job{c.jobCount !== 1 ? "s" : ""}</span>
                      {c.closeRate !== null && <span>· {c.closeRate}% close</span>}
                      {c.freq > 0 && <span>· every {Math.round(c.freq)}d</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-brand-400">{fmt(c.revenue)}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-400 hidden md:table-cell">{fmt(c.projectedLTV)}</td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <span className={"text-[10px] px-2 py-1 rounded-full border font-semibold uppercase tracking-wider " + churnColor(c.churnRisk)}>{c.churnRisk}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {c.upsells.slice(0, 2).map(u => <span key={u} className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/30 border border-purple-700/40 text-purple-300">{u}</span>)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {c.lastJobDate ? <div>
                      <div className="text-xs">{c.lastJobDate}</div>
                      <div className={"text-[10px] " + (c.daysSinceLast > 180 ? "text-brand-400" : c.daysSinceLast > 90 ? "text-yellow-400" : "text-white/50")}>{c.daysSinceLast}d ago</div>
                    </div> : <span className="text-white/30 text-xs">—</span>}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-white/40">No customers match this filter</td></tr>}
            </tbody>
          </table>
        </div>
      </Glass>

      {/* Lead Source ROI */}
      {(() => {
        const srcMap: Record<string, {source: string; customers: number; revenue: number; jobs: number}> = {};
        customers.forEach(c => {
          const src = c.leadSource || "Unknown";
          if (!srcMap[src]) srcMap[src] = { source: src, customers: 0, revenue: 0, jobs: 0 };
          srcMap[src].customers++;
          const cJobs = jobs.filter(j => j.customerId === c.id && j.status === "completed");
          srcMap[src].revenue += cJobs.reduce((s, j) => s + j.amount, 0);
          srcMap[src].jobs += cJobs.length;
        });
        const srcArr = Object.values(srcMap).filter(s => s.customers > 0).sort((a, b) => b.revenue - a.revenue);
        if (srcArr.length === 0) return null;
        const maxRev = Math.max(...srcArr.map(s => s.revenue));
        return <Glass className="p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-brand-400" />Lead Source ROI</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-brand-900/30 text-[10px] uppercase text-white/50">
                <th className="text-left pb-2">Source</th>
                <th className="text-right pb-2">Customers</th>
                <th className="text-right pb-2">Jobs</th>
                <th className="text-right pb-2">Revenue</th>
                <th className="text-right pb-2">$/Customer</th>
                <th className="text-left pb-2 pl-4">Revenue share</th>
              </tr></thead>
              <tbody>
                {srcArr.map(s => <tr key={s.source} className="border-b border-brand-900/10 hover:bg-white/5">
                  <td className="py-2.5 font-medium">{s.source}</td>
                  <td className="py-2.5 text-right text-white/70">{s.customers}</td>
                  <td className="py-2.5 text-right text-white/70">{s.jobs}</td>
                  <td className="py-2.5 text-right font-bold text-brand-400">{fmt(s.revenue)}</td>
                  <td className="py-2.5 text-right text-white/60">{s.customers > 0 ? fmt(s.revenue / s.customers) : "—"}</td>
                  <td className="py-2.5 pl-4">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-brand-600 rounded-full text-brand-fg" style={{ width: maxRev > 0 ? (s.revenue/maxRev*100) + "%" : "0%" }} /></div>
                      <span className="text-[10px] text-white/40 w-8 text-right">{maxRev > 0 ? Math.round(s.revenue/srcArr.reduce((a,b)=>a+b.revenue,0)*100) : 0}%</span>
                    </div>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </Glass>;
      })()}
    </div>
  );
}

// ===== ADDRESS AUTOCOMPLETE (Google Maps Places API) =====
