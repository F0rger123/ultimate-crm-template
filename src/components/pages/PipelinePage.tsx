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
import { useIsMobile } from "../../hooks/useIsMobile";
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

export function PipelinePage({ jobs = [], setJobs, customers = [], toast }) {
  // BUG FIX (mobile pipeline) — native HTML5 drag-and-drop (`draggable`) is a
  // mouse-oriented interaction. On touch devices it either does nothing or
  // fights with scrolling/swipe gestures, which is how a stage got changed
  // "by accident" while the owner was just trying to scroll a column. Same
  // single source-of-truth breakpoint the rest of the app uses (App.tsx,
  // Modal.tsx) — below it we swap drag-and-drop for an explicit "Move to…"
  // picker on each card instead of relying on any implicit gesture.
  const isMobile = useIsMobile();
  const [dragId, setDragId] = useState(null);
  const [lostJob, setLostJob] = useState(null);
  const [lostReason, setLostReason] = useState("Price too high");
  const [priorityFilter, setPriorityFilter] = useState("all");
  // FEATURE — "add ability to switch between Jobs view (progress through
  // pipeline stages) and Customer view (lifetime metrics)." Jobs view is
  // the existing kanban board, unchanged; Customer view is new, below.
  const [viewMode, setViewMode] = useState<"jobs" | "customers">("jobs");
  const [timeframe, setTimeframe] = useState("all");
  // FEATURE 6 (mobile round 7) — was a hardcoded constant with no way for the
  // owner to tune it; now an editable, persisted-per-device setting.
  const [staleThreshold, setStaleThreshold] = usePersistent<number>("crm.staleLeadThresholdDays", 14);
  // BLOCKER 18 (mobile round 9) — same fix as staleThreshold above, applied
  // to the "Bottleneck" avg-days-in-stage banner, which still had its "5
  // days" trigger hardcoded with no editable setting anywhere.
  const [bottleneckThreshold, setBottleneckThreshold] = usePersistent<number>("crm.bottleneckThresholdDays", 5);
  // FEATURE 6 — column display limit: show max 5 cards per stage with a
  // "Show N more" expander, so a column with 40 leads doesn't turn the whole
  // board into one giant unscrollable list.
  const [expandedStages, setExpandedStages] = useState<Record<string, boolean>>({});
  const lostReasons = ["Price too high", "Went with competitor", "Changed mind", "No response", "Not qualified", "Other"];

  const moveStg = (jid, stg) => {
    if (stg === "lost") { setLostJob(jid); return; }
    setJobs(jobs.map(j => j.id === jid ? { ...j, pipelineStage: stg, stageChangedAt: today() } : j));
  };

  // BUG 19 — auto-track jobs into the right column. Terminal job states always
  // win (a completed/paid/cancelled job can never be stranded in an earlier
  // column even if its pipelineStage was left behind); otherwise a manually-set
  // pipelineStage (owner drag) is respected, falling back to a sensible default
  // derived from the job's status/schedule so brand-new jobs still appear.
  const effStage = (j: any): string => {
    if (j.status === "cancelled") return "lost";
    if (j.status === "completed") return j.paymentStatus === "Paid" || j.pipelineStage === "paid" ? "paid" : "completed";
    if (j.pipelineStage) return j.pipelineStage;
    if (j.status === "in_progress") return "scheduled";
    if (j.scheduledDate) return "scheduled";
    return "lead";
  };

  const confirmLost = () => {
    setJobs(jobs.map(j => j.id === lostJob ? { ...j, pipelineStage: "lost", stageChangedAt: today(), lostReason } : j));
    setLostJob(null);
    toast("Marked lost: " + lostReason);
  };

  // Apply timeframe filter based on stageChangedAt or scheduledDate
  const tfDays = TIMEFRAMES.find(t => t.key === timeframe)?.days || 99999;
  const cutoff = Date.now() - tfDays * 86400000;
  const inTimeframe = jobs.filter(j => {
    if (timeframe === "all") return true;
    const d = j.stageChangedAt || j.scheduledDate;
    return d && new Date(d).getTime() >= cutoff;
  });

  const filtered = priorityFilter === "all" ? inTimeframe : inTimeframe.filter(j => (j.priority || "normal") === priorityFilter);

  // Pipeline health — avg days in each stage within timeframe
  const avgDays = pipelineStages.map(stg => {
    const sj = filtered.filter(j => effStage(j) === stg.key);
    if (!sj.length) return { stage: stg.label, avg: 0, count: 0 };
    const days = sj.map(j => daysSince(j.stageChangedAt || j.scheduledDate));
    return { stage: stg.label, avg: Math.round(days.reduce((s, d) => s + d, 0) / days.length), count: sj.length };
  });
  const bottleneck = avgDays.reduce((b, s) => s.avg > b.avg ? s : b, { stage: "", avg: 0, count: 0 });
  const tfLabel = TIMEFRAMES.find(t => t.key === timeframe)?.label || "All";

  // Win rate in timeframe
  const closedJobs = filtered.filter(j => effStage(j) === "paid" || effStage(j) === "completed");
  const lostJobs = filtered.filter(j => effStage(j) === "lost");
  const winRate = (closedJobs.length + lostJobs.length) > 0 ? Math.round(closedJobs.length / (closedJobs.length + lostJobs.length) * 100) : null;

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
            {(["jobs", "customers"] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)} className={"px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize " + (viewMode === v ? "bg-brand-700/40 text-white border border-brand-700/50" : "text-white/50")}>{v === "jobs" ? "📋 Jobs View" : "👥 Customer View"}</button>
            ))}
          </div>
          <TimeframeSelector value={timeframe} onChange={setTimeframe} options={["7d","30d","90d","6m","1y","all"]} />
          <div className="flex gap-1 items-center">
            <span className="text-xs text-white/40">Priority:</span>
            {["all", ...priorityLevels.map(p => p.key)].map(p => (
              <button key={p} onClick={() => setPriorityFilter(p)} className={"px-2.5 py-1 rounded-lg text-xs transition border capitalize " + (priorityFilter === p ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>{p}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/60">
          <span><span className="text-brand-400 font-bold">{filtered.length}</span> jobs</span>
          <span><span className="text-brand-400 font-bold">{fmt(filtered.reduce((s, j) => s + j.amount, 0))}</span> value</span>
          {winRate !== null && <span><span className="text-green-400 font-bold">{winRate}%</span> win rate</span>}
        </div>
      </div>

      {viewMode === "jobs" && <>
      {/* Bottleneck & health bar */}
      {bottleneck.avg >= bottleneckThreshold && (
        <Glass className="p-4 !bg-yellow-950/20 !border-yellow-700/40">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0" />
              <div>
                <span className="text-yellow-300 font-semibold">Bottleneck ({tfLabel}):</span>
                <span className="text-yellow-200 ml-1">{bottleneck.stage}</span>
                <span className="text-yellow-400/80 ml-2 text-sm">avg {bottleneck.avg}d · {bottleneck.count} job{bottleneck.count !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-auto flex-wrap">
              {/* FIX 17 — no flex-wrap here meant this row of per-stage
                  pills (one per pipeline stage with jobs in it — commonly
                  6-7) could overflow past the screen edge with no scroll
                  affordance on mobile, since the page's ancestor clips
                  overflow rather than showing a scrollbar. */}
              <div className="flex gap-2 text-[10px] flex-wrap">
                {avgDays.filter(s => s.count > 0).map(s => (
                  <div key={s.stage} className={"px-2 py-1 rounded-lg border " + (s.stage === bottleneck.stage ? "bg-yellow-950/40 border-yellow-700/50 text-yellow-300" : "bg-black/40 border-white/10 text-white/50")}>
                    {s.stage}: <span className="font-bold">{s.avg}d</span>
                  </div>
                ))}
              </div>
              {/* BLOCKER 18 (mobile round 9) — editable trigger, same inline
                  pattern as the Lead Aging Report's "Flag after" control below. */}
              <div className="flex items-center gap-1.5 text-[10px] text-yellow-300/70 flex-shrink-0">
                <span>Flag after</span>
                <input type="number" min={1} max={90} value={bottleneckThreshold} onChange={e => setBottleneckThreshold(Math.max(1, Number(e.target.value) || 5))} className="w-12 bg-black/40 border border-yellow-700/40 rounded-lg px-1.5 py-0.5 text-center text-yellow-200" />
                <span>avg days</span>
              </div>
            </div>
          </div>
        </Glass>
      )}

      {/* Lead aging report */}
      {(() => {
        const activeStages = ["lead","contacted","estimate_sent"];
        const stale = filtered.filter(j => activeStages.includes(effStage(j)) && daysSince(j.stageChangedAt || j.scheduledDate || j.createdAt) >= staleThreshold);
        if (stale.length === 0) return null;
        return (
          <Glass className="p-4 !bg-orange-950/20 !border-orange-700/40">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-orange-400" />
                <span className="text-orange-300 font-semibold text-sm">{stale.length} lead{stale.length !== 1 ? "s" : ""} with no activity in {staleThreshold}+ days</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px] text-orange-300/70">
                  <span>Flag after</span>
                  <input type="number" min={1} max={90} value={staleThreshold} onChange={e => setStaleThreshold(Math.max(1, Number(e.target.value) || 14))} className="w-12 bg-black/40 border border-orange-700/40 rounded-lg px-1.5 py-0.5 text-center text-orange-200" />
                  <span>days</span>
                </div>
                <span className="text-[10px] text-orange-400/60">Lead Aging Report</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-orange-400/60 border-b border-orange-700/30">
                  <th className="text-left pb-1.5">Address / Customer</th>
                  <th className="text-center pb-1.5">Stage</th>
                  <th className="text-right pb-1.5">Value</th>
                  <th className="text-right pb-1.5">Age</th>
                  <th className="text-right pb-1.5">Action</th>
                </tr></thead>
                <tbody>
                  {stale.map(j => {
                    const cu = customers.find(c => c.id === j.customerId);
                    const age = daysSince(j.stageChangedAt || j.scheduledDate || j.createdAt);
                    return <tr key={j.id} className="border-b border-orange-900/20 hover:bg-orange-950/10">
                      <td className="py-2"><div className="font-medium text-white/80">{j.address?.split(",")[0] || "Unknown"}</div>{cu && <div className="text-orange-300/60">{cu.firstName} {cu.lastName}</div>}</td>
                      <td className="py-2 text-center"><Badge tone="orange">{pipelineStages.find(s => s.key === effStage(j))?.label || effStage(j)}</Badge></td>
                      <td className="py-2 text-right font-semibold text-white/80">{fmt(j.amount)}</td>
                      <td className="py-2 text-right"><span className={age >= 30 ? "text-brand-400 font-bold" : "text-orange-300"}>{age}d</span></td>
                      <td className="py-2 text-right">
                        <button onClick={() => cu?.phone && (window.location.href = "sms:" + cu.phone.replace(/\D/g,""))} className="text-[10px] text-blue-400 hover:text-blue-300">Text</button>
                      </td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-[9px] text-orange-400/40">Leads aged 30+ days in red · Total at-risk value: {fmt(stale.reduce((s,j)=>s+j.amount,0))}</div>
          </Glass>
        );
      })()}

      <PipelineScrollContainer>
        <div className="flex gap-3 min-w-max px-1 pb-1">
          {pipelineStages.map(stg => {
            const sj = filtered.filter(j => effStage(j) === stg.key);
            const stgAvg = avgDays.find(a => a.stage === stg.label)?.avg || 0;
            return (
              <div key={stg.key} {...(isMobile ? {} : { onDragOver: e => e.preventDefault(), onDrop: e => { e.preventDefault(); if (dragId) moveStg(dragId, stg.key); setDragId(null); } })} className={"w-72 flex-shrink-0 bg-black/30 border rounded-2xl " + stg.border}>
                <div className={"p-3 rounded-t-2xl border-b " + stg.border} style={{ background: "linear-gradient(to right, var(--tw-gradient-from), var(--tw-gradient-to))" }}>
                  <div className={"p-3 rounded-t-2xl border-b " + stg.border + " bg-black/40"}>
                    <div className="flex items-center gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        <div className={"w-2 h-2 rounded-full " + stg.color} />
                        <span className={"font-semibold text-sm uppercase tracking-wider " + stg.text}>{stg.label}</span>
                      </div>
                      <span className={"text-xs px-2 py-0.5 rounded-full font-bold " + stg.color + "/20 " + stg.text}>{sj.length}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <div className="text-xs text-white/60">{fmt(sj.reduce((s, j) => s + j.amount, 0))}</div>
                      {stgAvg > 0 && <div className="text-[10px] text-white/40">avg {stgAvg}d</div>}
                    </div>
                  </div>
                </div>
                {/* BLOCKER 18 (mobile round 9) — expanding a stage with many
                    cards ("Show N more") used to grow this column's height
                    with no cap, so seeing the bottom of one long column meant
                    scrolling the WHOLE page — every other column scrolled
                    along with it. A capped height + its own overflow-y-auto
                    makes each column scroll independently instead. */}
                <div className="p-2 space-y-2 min-h-[200px] max-h-[65vh] overflow-y-auto">
                  {(expandedStages[stg.key] ? sj : sj.slice(0, 5)).map(j => {
                    const cu = customers.find(c => c.id === j.customerId);
                    const prio = priorityLevels.find(p => p.key === (j.priority || "normal")) || priorityLevels[1];
                    // BUG FIX (mobile pipeline) — desktop keeps the original
                    // draggable + swipe-hint card untouched. On mobile widths
                    // neither `draggable` (mouse-only) nor the swipe gesture
                    // is attached at all, so scrolling a column can never be
                    // misread as a stage change; an explicit "Move to…"
                    // picker below replaces both.
                    const card = (
                      <div
                        {...(isMobile ? {} : { draggable: true, onDragStart: () => setDragId(j.id) })}
                        className={"p-3 bg-black/60 rounded-xl select-none border " + stg.border + " hover:" + stg.border + (isMobile ? "" : " cursor-grab hover:border active:cursor-grabbing")}
                      >
                        <div className="flex items-start gap-2">
                          <div className={"w-1 h-full min-h-[40px] rounded-full flex-shrink-0 " + prio.color} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-medium text-sm truncate">{cu?.firstName} {cu?.lastName}</span>
                              {j.priority && j.priority !== "normal" && <Badge tone={prio.tone}>{prio.label}</Badge>}
                            </div>
                            <div className="text-[11px] text-white/50 truncate">{j.address}</div>
                            {j.tags && j.tags.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{j.tags.slice(0, 2).map(t => <span key={t} className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70">{t}</span>)}</div>}
                            <div className="flex items-center justify-between mt-1">
                              <div className={"text-xs font-semibold " + stg.text}>{fmt(j.amount)}</div>
                              {j.lostReason && stg.key === "lost" && <span className="text-[9px] text-danger-400">{j.lostReason}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 mt-2 pt-2 border-t border-white/5">
                          <button onClick={() => cu?.phone && (window.location.href = "tel:" + cu.phone.replace(/\D/g, ""))} className="flex-1 p-1 rounded hover:bg-green-900/30 text-white/50 hover:text-green-400 flex items-center justify-center" title={"Call " + cu?.firstName}><Phone size={10} /></button>
                          <button onClick={() => cu?.phone && (window.location.href = "sms:" + cu.phone.replace(/\D/g, ""))} className="flex-1 p-1 rounded hover:bg-blue-900/30 text-white/50 hover:text-blue-400 flex items-center justify-center" title={"Text " + cu?.firstName}><MessageSquare size={10} /></button>
                          {stg.key === "lost" ? (
                            <button onClick={() => { moveStg(j.id, "contacted"); toast("Lead re-opened → Contacted"); }} className="flex-1 p-1 rounded hover:bg-green-900/30 text-white/50 hover:text-green-400 flex items-center justify-center text-[9px] font-semibold gap-0.5"><RefreshCw size={9} />Re-open</button>
                          ) : (
                            <button onClick={() => cu?.email && (window.location.href = "mailto:" + cu.email)} className="flex-1 p-1 rounded hover:bg-purple-900/30 text-white/50 hover:text-purple-400 flex items-center justify-center" title={"Email " + cu?.firstName}><Mail size={10} /></button>
                          )}
                        </div>
                        {/* BUG FIX (mobile pipeline) — explicit tap-to-select
                            stage move, reusing the same GSel dropdown used
                            elsewhere on this page (e.g. the "Why lost?"
                            modal) rather than inventing a new picker
                            component. Only rendered on touch/narrow widths;
                            desktop is unaffected. */}
                        {isMobile && (
                          <div className="mt-2 pt-2 border-t border-white/5" onClick={e => e.stopPropagation()}>
                            <GSel
                              value=""
                              onChange={e => { const dest = e.target.value; if (dest) moveStg(j.id, dest); }}
                              className="!py-1 !text-[11px]"
                            >
                              <option value="" className="bg-black">Move to…</option>
                              {pipelineStages.filter(s => s.key !== stg.key).map(s => (
                                <option key={s.key} value={s.key} className="bg-black">{s.label}</option>
                              ))}
                            </GSel>
                          </div>
                        )}
                      </div>
                    );
                    return isMobile ? (
                      <React.Fragment key={j.id}>{card}</React.Fragment>
                    ) : (
                      <SwipeableCard key={j.id} job={j} stages={pipelineStages} onMove={moveStg} currentStage={stg.key}>
                        {card}
                      </SwipeableCard>
                    );
                  })}
                  {!expandedStages[stg.key] && sj.length > 5 && (
                    <button onClick={() => setExpandedStages(prev => ({ ...prev, [stg.key]: true }))} className="w-full text-center text-[11px] text-white/40 hover:text-white/70 py-1.5 rounded-lg hover:bg-white/5 transition">
                      Show {sj.length - 5} more…
                    </button>
                  )}
                  {expandedStages[stg.key] && sj.length > 5 && (
                    <button onClick={() => setExpandedStages(prev => ({ ...prev, [stg.key]: false }))} className="w-full text-center text-[11px] text-white/40 hover:text-white/70 py-1.5 rounded-lg hover:bg-white/5 transition">
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PipelineScrollContainer>
      </>}

      {/* FEATURE — Customer view: lifetime metrics (total paid, job count,
          current pipeline stage if they have an active job), auto-updates
          the same way Jobs view does since it reads straight from the live
          customers/jobs props — no separate data path to fall out of sync. */}
      {viewMode === "customers" && (() => {
        const rows = customers.map((c: any) => {
          const custJobs = jobs.filter((j: any) => j.customerId === c.id);
          const activeJob = custJobs
            .filter((j: any) => effStage(j) !== "paid" && effStage(j) !== "lost")
            .sort((a: any, b: any) => (b.stageChangedAt || b.scheduledDate || "").localeCompare(a.stageChangedAt || a.scheduledDate || ""))[0];
          const lastActivity = custJobs.map((j: any) => j.stageChangedAt || j.scheduledDate).filter(Boolean).sort().slice(-1)[0];
          return { customer: c, jobCount: custJobs.length, totalSpent: Number(c.totalSpent) || 0, activeStage: activeJob ? effStage(activeJob) : null, lastActivity };
        }).sort((a, b) => b.totalSpent - a.totalSpent);
        return (
          <Glass className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-[10px] text-white/40 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Customer</th>
                    <th className="py-2.5 px-4 text-right">Lifetime Value</th>
                    <th className="py-2.5 px-4 text-center">Jobs</th>
                    <th className="py-2.5 px-4">Current Stage</th>
                    <th className="py-2.5 px-4">Last Activity</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.customer.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2.5 px-4 font-medium">{r.customer.firstName} {r.customer.lastName}</td>
                      <td className="py-2.5 px-4 text-right text-brand-400 font-semibold">{fmt(r.totalSpent)}</td>
                      <td className="py-2.5 px-4 text-center text-white/60">{r.jobCount}</td>
                      <td className="py-2.5 px-4">{r.activeStage ? <Badge tone="orange">{pipelineStages.find(s => s.key === r.activeStage)?.label || r.activeStage}</Badge> : <span className="text-white/30 text-xs">—</span>}</td>
                      <td className="py-2.5 px-4 text-white/50 text-xs">{r.lastActivity || "—"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-white/40 text-sm">No customers yet</td></tr>}
                </tbody>
              </table>
            </div>
          </Glass>
        );
      })()}

      <Modal open={!!lostJob} onClose={() => setLostJob(null)} title="Why lost?">
        <div className="space-y-3">
          <GSel value={lostReason} onChange={e => setLostReason(e.target.value)}>
            {lostReasons.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}
          </GSel>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setLostJob(null)}>Cancel</GBtn>
            <GBtn variant="danger" onClick={confirmLost}>Mark Lost</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== CALENDAR =====
