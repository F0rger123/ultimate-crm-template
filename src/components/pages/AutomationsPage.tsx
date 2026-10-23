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
import { useAutomationEngine } from "../../hooks/useAutomationEngine";
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
import { BackgroundAutomationsPanel } from "../ui/BackgroundAutomationsPanel";

export function AutomationsPage({ automations = [], setAutomations, jobs = [], customers = [], estimates = [], settings = {} as any, setSettings = (() => {}) as any, toast }: { automations?: any[]; setAutomations?: any; jobs?: any[]; customers?: any[]; estimates?: any[]; settings?: any; setSettings?: any; toast?: any }) {
  const [builderOpen, setBuilderOpen] = useState<{ open: boolean; data: any }>({ open: false, data: null });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [logOpen, setLogOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [execLog, setExecLog] = useState<any[]>([]);
  const runWorkflow = async (a: any, ctx: any, toastFn: any, s: any) => ({ triggered: true, log: [] } as { triggered: boolean; log: any[] });

  // The automation engine already runs globally in App.tsx so it fires
  // regardless of which page is open — running it again here would double-fire
  // every trigger (e.g. two SMS sends) whenever this page happens to be mounted.

  const toggle = id => setAutomations(automations.map(a => a.id === id ? { ...a, active: !a.active } : a));
  const del = id => { if (confirm("Delete this workflow?")) setAutomations(automations.filter(a => a.id !== id)); };

  const inferCtxType = a => {
    const t = (a.steps?.[0]?.label || a.trigger || "").toLowerCase();
    if (t.match(/job complete|after job|post.?job/)) return "job_complete";
    if (t.match(/job start|crew start/)) return "job_started";
    if (t.match(/job schedul|24h before/)) return "job_scheduled";
    if (t.match(/estimate sent|quote sent/)) return "estimate_sent";
    if (t.match(/new (customer|inquiry|lead)/)) return "customer_added";
    if (t.match(/invoice|unpaid|overdue/)) return "invoice_unpaid";
    if (t.match(/review|rating/)) return "review_submitted";
    return "manual";
  };

  const testRun = async a => {
    const mockCustomer = customers[0] || { firstName: "Jennifer", lastName: "Walsh", email: "j@example.com", phone: "+15555550201" };
    const mockJob = jobs.find(j => j.status === "completed") || jobs[0] || { id: "mock", amount: 742, scheduledDate: today(), status: "completed" };
    const result = await runWorkflow(a, { type: inferCtxType(a), job: mockJob, customer: mockCustomer, estimate: estimates[0] || null, daysSinceInvoiced: 8, daysSinceLast: 200, rating: 5 }, toast, settings);
    if (!result.triggered) { toast(`Trigger didn't match — click Edit to adjust`, "error"); return; }
    setAutomations(prev => prev.map(x => x.id === a.id ? { ...x, count: (x.count || 0) + 1, lastTriggered: today(), runLog: [...(x.runLog || []), ...result.log].slice(0, 50) } : x));
    toast(`✅ Test run — ${result.log.length} step${result.log.length !== 1 ? "s" : ""} fired`);
  };

  const openBuilder = (data = null) => setBuilderOpen({ open: true, data: data || { name: "", category: "other", icon: "⚡", steps: [{ id: uid(), type: "trigger", label: "Choose a trigger…" }] } });

  const catOf = a => {
    const t = (a.trigger || a.steps?.[0]?.label || "").toLowerCase();
    if (t.match(/estimate|quote/)) return "estimates";
    if (t.match(/job|crew|schedule/)) return "jobs";
    if (t.match(/invoice|payment|paid|overdue|unpaid/)) return "payments";
    if (t.match(/review|complete/)) return "reviews";
    if (t.match(/annual|birthday|anniversary|month|seasonal/)) return "lifecycle";
    if (t.match(/referral/)) return "referrals";
    return "other";
  };

  const NODE_COLORS = {
    trigger:   { bg: "#171717", border: "#737373", text: "#e5e5e5", icon: "▶" },
    condition: { bg: "#171717", border: "#525252", text: "#d4d4d4", icon: "⬡" },
    delay:     { bg: "#171717", border: "#404040", text: "#a3a3a3", icon: "⏳" },
    action:    { bg: "#262626", border: "#d4d4d4", text: "#ffffff", icon: "⚡" },
    branch:    { bg: "#262626", border: "#a3a3a3", text: "#d4d4d4", icon: "⑂" },
  };

  const catMeta = {
    estimates: { label: "Estimates", icon: FileText, color: "#a3a3a3", bg: "rgba(255,255,255,0.05)" },
    jobs:      { label: "Jobs",      icon: Briefcase, color: "#a3a3a3", bg: "rgba(255,255,255,0.05)" },
    payments:  { label: "Payments",  icon: DollarSign, color: "#a3a3a3", bg: "rgba(255,255,255,0.05)" },
    reviews:   { label: "Reviews",   icon: Star, color: "#a3a3a3", bg: "rgba(255,255,255,0.05)" },
    lifecycle: { label: "Lifecycle", icon: Heart, color: "#a3a3a3", bg: "rgba(255,255,255,0.05)" },
    referrals: { label: "Referrals", icon: Award, color: "#a3a3a3", bg: "rgba(255,255,255,0.05)" },
    other:     { label: "Other",     icon: Workflow, color: "#a3a3a3", bg: "rgba(255,255,255,0.05)" }
  };

  const filtered = automations
    .filter(a => !search || (a.name + a.trigger + a.action).toLowerCase().includes(search.toLowerCase()))
    .filter(a => category === "all" || catOf(a) === category);

  const activeCount = automations.filter(a => a.active).length;
  const totalRuns = automations.reduce((s, a) => s + (a.count || 0), 0);

  // Render inline node flow strip for a workflow card
  const NodeStrip = ({ steps }) => {
    const show = (steps || []).slice(0, 5);
    return (
      <div className="flex items-center gap-0 overflow-hidden">
        {show.map((step, i) => {
          const nc = NODE_COLORS[step.type] || NODE_COLORS.action;
          return (
            <React.Fragment key={step.id || i}>
              {i > 0 && <div className="w-5 h-px flex-shrink-0" style={{ background: "linear-gradient(90deg, " + NODE_COLORS[show[i-1].type]?.border + ", " + nc.border + ")" }} />}
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium flex-shrink-0 border" style={{ background: nc.bg, borderColor: nc.border + "80", color: nc.text }}>
                <span>{nc.icon}</span>
                <span className="max-w-[80px] truncate hidden sm:block">{step.label || step.type}</span>
              </div>
            </React.Fragment>
          );
        })}
        {(steps || []).length > 5 && (
          <>
            <div className="w-4 h-px bg-white/20 flex-shrink-0" />
            <span className="text-[9px] text-white/40 flex-shrink-0">+{steps.length - 5}</span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header bar — gradient banner matching the app's red/black identity
          (see JobsPage.tsx / EstimatesPage.tsx header treatment). All the
          global toggles/caps that used to live inline here (pause switch,
          send-rate caps, late-employee notify, owner stats email) now live
          in the "Automation Settings" modal below so this page opens
          straight onto the workflow list instead of a wall of controls. */}
      <div className="relative overflow-hidden rounded-2xl border border-brand-900/30 bg-gradient-to-br from-brand-950/40 via-black to-purple-950/20 p-5">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-brand-600/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-purple-600/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Workflow size={20} className="text-white" />
              Automation Hub
              <Badge tone={settings?.automationsPaused === false ? "green" : "gray"}>
                {settings?.automationsPaused === false ? "● Live" : "⏸ Paused"}
              </Badge>
            </h2>
            <div className="text-xs text-white/50 mt-0.5">{activeCount} active · {totalRuns} total runs · workflows fire automatically as events happen</div>
          </div>
          {/* flex-wrap — on a phone these four buttons ran past the card edge and
              the card's overflow-hidden cut "New Workflow" off. */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <GBtn variant="ghost" onClick={() => setLogOpen(!logOpen)} className={"!text-xs " + (execLog.length > 0 ? "!border-green-700/50 !text-green-400" : "")}>
              <Activity size={12} className="inline mr-1.5" />Log {execLog.length > 0 && `(${execLog.length})`}
            </GBtn>
            <GBtn variant="ghost" onClick={() => setTemplatesOpen(true)} className="!text-xs">
              <Layers size={12} className="inline mr-1.5" />Templates
            </GBtn>
            <GBtn variant="ghost" onClick={() => setSettingsOpen(true)} className={"!text-xs " + (settings?.automationsPaused === false ? "" : "!border-brand-700/50 !text-brand-300")}>
              <Settings size={12} className="inline mr-1.5" />Automation Settings
            </GBtn>
            <GBtn onClick={() => openBuilder()} className="!text-sm">
              <Plus size={14} className="inline mr-1.5" />New Workflow
            </GBtn>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Active", value: activeCount, icon: "🟢", color: "text-green-400" },
          { label: "Paused", value: automations.length - activeCount, icon: "⏸", color: "text-white/50" },
          { label: "Total Runs", value: totalRuns, icon: "▶", color: "text-white" },
          { label: "Fired Today", value: automations.filter(a => a.lastTriggered === today()).length, icon: "⚡", color: "text-yellow-400" },
        ].map(s => (
          <Glass key={s.label} className="p-4 flex items-center gap-3 hover:!border-white/20 transition-colors">
            <span className="text-2xl">{s.icon}</span>
            <div>
              <div className={"text-2xl font-bold " + s.color}>{s.value}</div>
              <div className="text-[10px] text-white/50">{s.label}</div>
            </div>
          </Glass>
        ))}
      </div>

      {/* Automation Settings modal — pause switch, send-rate caps,
          late-employee auto-notify, owner stats email. Same fields/handlers
          as before, just relocated out of the page body. */}
      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Automation Settings" maxW="max-w-2xl">
        <div className="space-y-4">
          {/* CRITICAL — kill switch (automation spam incident). Defaults to
              PAUSED for every existing owner (settings.automationsPaused is
              undefined until someone touches this toggle, and `!== false` reads
              undefined as paused) — the repeat-send bug meant real customers got
              messaged 10+ times, so automations stay off until the owner
              consciously flips this back on having read what changed. The engine
              (useAutomationEngine.ts) checks this exact same flag and skips
              every send entirely while paused — this isn't just a UI hint. */}
          <Glass className={"p-4 " + (settings?.automationsPaused === false ? "!bg-emerald-950/10 !border-emerald-700/20" : "!bg-brand-950/20 !border-brand-700/40")}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  {settings?.automationsPaused === false ? "🟢 Automations are running" : "⏸ All automations are paused"}
                </div>
                <div className="text-xs text-white/60 mt-0.5 max-w-xl">
                  {settings?.automationsPaused === false
                    ? "Workflows send automatically as events happen. Use this switch any time to stop every automation instantly."
                    : "A bug let editing a workflow silently reset its \"already sent\" memory, causing repeat messages to the same customers. That's fixed (edits now preserve send history, and a session-level guard blocks any duplicate send). Automations stay off until you turn them back on here."}
                </div>
              </div>
              <button
                onClick={() => {
                  const nowPaused = settings?.automationsPaused === false;
                  try {
                    setSettings((s: any) => ({ ...s, automationsPaused: s?.automationsPaused === false }));
                    toast?.(nowPaused ? "⏸ All automations paused — nothing will send" : "🟢 Automations enabled — workflows will send as events happen");
                  } catch (e: any) {
                    toast?.("Couldn't change the automation kill switch: " + (e?.message || String(e)), "error");
                  }
                }}
                className={"flex-shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition " + (settings?.automationsPaused === false ? "bg-white/10 hover:bg-brand-900/30 text-white/70 hover:text-brand-300" : "bg-emerald-600 hover:bg-emerald-500 text-white")}
              >
                {settings?.automationsPaused === false ? "Pause All Automations" : "Enable Automations"}
              </button>
            </div>
          </Glass>

          {/* FEATURE — "make automations run in the background... there
              should be a way to build it and find it." Real, discoverable
              home for the background job: shows whether it's actually been
              checking in (functions/api/run-automations.ts stamps
              settings.lastAutomationRunAt on every real attempt, including
              one that finds nothing to do), a one-click manual trigger for
              testing without waiting up to 15 minutes for the external
              pinger, and the exact setup instructions/URL to copy into
              cron-job.org or a Cloudflare Cron Trigger — no digging through
              docs to find where this lives. */}
          <BackgroundAutomationsPanel settings={settings} toast={toast} />

          {/* FEATURE — global default + bulk apply for the per-automation
              "Auto-send" / "Ask first" toggle (the small button on each
              workflow card, below). Most owners want ALL (or almost all)
              workflows to behave the same way, and flipping each one
              individually is tedious — this sets settings.automationDefaultAutoApprove
              (applied to any NEW workflow created from here on) and offers a
              one-click "Apply to all" that bulk-updates every existing
              automation's autoApprove flag at once. */}
          <Glass className="p-4 !bg-purple-950/10 !border-purple-700/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5">📝 Default Send Behavior</div>
                <div className="text-xs text-white/50 mt-0.5 max-w-xl">
                  Most workflows ask for your approval (the "Ask first" popup) before sending. Applies to every new workflow you create, and can bulk-set every existing one below. Each workflow can still be switched individually from its card.
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => setSettings((s: any) => ({ ...s, automationDefaultAutoApprove: false }))}
                  className={"px-3 py-1.5 text-xs font-semibold transition " + (!settings?.automationDefaultAutoApprove ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70")}
                >Ask first</button>
                <button
                  onClick={() => setSettings((s: any) => ({ ...s, automationDefaultAutoApprove: true }))}
                  className={"px-3 py-1.5 text-xs font-semibold transition " + (settings?.automationDefaultAutoApprove ? "bg-green-600 text-white" : "text-white/40 hover:text-white/70")}
                >Auto-send</button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/5">
              <span className="text-[10px] text-white/40 mr-auto">Apply the setting above to every existing workflow right now:</span>
              <GBtn variant="ghost" className="!text-[10px] !py-1" onClick={() => {
                setAutomations(automations.map(x => ({ ...x, autoApprove: false })));
                toast?.("Every workflow now asks for approval before sending");
              }}>Set all to Ask first</GBtn>
              <GBtn variant="ghost" className="!text-[10px] !py-1" onClick={() => {
                setAutomations(automations.map(x => ({ ...x, autoApprove: true })));
                toast?.("Every workflow now sends automatically, no popup");
              }}>Set all to Auto-send</GBtn>
            </div>
          </Glass>

          {/* FEATURE — explicit cap on total automation sends per day, on top of
              the existing one-touch-per-customer-per-day guardrail. That existing
              rule stops any ONE customer being messaged twice in a day, but does
              nothing to stop a single automation from legitimately matching e.g.
              200 customers at once (a seasonal promo) and queuing all 200 into
              one approval batch — this cap holds the excess back and warns
              instead of dumping an unbounded blast on "Send All". */}
          <Glass className="p-4 !bg-blue-950/10 !border-blue-700/20 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5">🛡 Max Automation Sends Per Day</div>
                <div className="text-xs text-white/50 mt-0.5 max-w-xl">Caps how many customers can be reached by automations in a single day, across every workflow combined. If a batch would exceed this, the extra sends are held back with a warning instead of going out — raise it if you're running a planned mass promo.</div>
              </div>
              <GInput
                type="number" min="1" step="1"
                value={settings?.automationMaxSendsPerDay ?? 50}
                onChange={(e: any) => setSettings((s: any) => ({ ...s, automationMaxSendsPerDay: Math.max(1, Number(e.target.value) || 50) }))}
                className="!w-24 !text-sm flex-shrink-0"
              />
            </div>
            {/* AUDIT FIX — the per-day cap alone doesn't stop a huge batch from
                hitting Twilio all at once the moment "Send All" is clicked — a
                200-customer approved batch still fires 200 texts in the same
                second, which is exactly the kind of burst that trips carrier
                filtering/A2P throughput limits (and is generally how "spam"
                gets flagged). Per-hour/per-minute caps throttle the actual send
                RATE, independent of the daily total. 0 or blank = no limit
                (same "off" convention as elsewhere in this app). */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-white/5">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5">⏱ Max Sends Per Hour</div>
                <div className="text-xs text-white/50 mt-0.5 max-w-xl">Throttles how fast a big approved batch actually goes out, independent of the daily cap above. Leave blank/0 for no hourly limit.</div>
              </div>
              <GInput
                type="number" min="0" step="1"
                value={settings?.automationMaxSendsPerHour ?? ""}
                placeholder="No limit"
                onChange={(e: any) => setSettings((s: any) => ({ ...s, automationMaxSendsPerHour: Math.max(0, Number(e.target.value) || 0) }))}
                className="!w-24 !text-sm flex-shrink-0"
              />
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-white/5">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5">⏱ Max Sends Per Minute</div>
                <div className="text-xs text-white/50 mt-0.5 max-w-xl">The tightest throttle of the three — caps burst rate within any single minute. Leave blank/0 for no per-minute limit.</div>
              </div>
              <GInput
                type="number" min="0" step="1"
                value={settings?.automationMaxSendsPerMinute ?? ""}
                placeholder="No limit"
                onChange={(e: any) => setSettings((s: any) => ({ ...s, automationMaxSendsPerMinute: Math.max(0, Number(e.target.value) || 0) }))}
                className="!w-24 !text-sm flex-shrink-0"
              />
            </div>
          </Glass>

          {/* Late-employee auto-notifications — separate from the workflow builder
              above since it reads live clock-in/job timing rather than firing on a
              discrete event; surfaced as a banner+button on the affected job in
              Crew View → Live Now when a crew member is running behind. */}
          <Glass className="p-4 !bg-amber-950/10 !border-amber-700/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5">⏰ Late Employee Auto-Notifications</div>
                <div className="text-xs text-white/50 mt-0.5">When a crew member runs behind schedule, show a one-tap option in Crew View to text/email the next client a new ETA.</div>
              </div>
              <button onClick={() => setSettings((s: any) => ({ ...s, autoNotifyLate: !s.autoNotifyLate }))} className={"flex-shrink-0 w-12 h-7 rounded-full transition relative " + (settings?.autoNotifyLate ? "bg-amber-600" : "bg-white/10")}>
                <div className={"absolute top-1 w-5 h-5 rounded-full bg-white transition " + (settings?.autoNotifyLate ? "left-6" : "left-1")} />
              </button>
            </div>
            {settings?.autoNotifyLate && (
              <div className="grid md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-amber-700/20">
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Late threshold (minutes)</label>
                  <GInput type="number" value={settings?.lateThresholdMinutes ?? 15} onChange={(e: any) => setSettings((s: any) => ({ ...s, lateThresholdMinutes: Number(e.target.value) }))} className="!text-xs" />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Message template</label>
                  <GInput value={settings?.lateNotifyTemplate || "Your technician is running slightly behind. New ETA: {{eta}}. We apologize for the delay."} onChange={(e: any) => setSettings((s: any) => ({ ...s, lateNotifyTemplate: e.target.value }))} className="!text-xs" placeholder="Use {{eta}} for the new estimated time" />
                </div>
              </div>
            )}
          </Glass>

          {/* FEATURE — owner-configurable frequency/time for the "Owner:
              End-of-Day Summary" report automation (useAutomationEngine.ts
              owner_daily_summary spec). Read fresh off settings every 15-min
              engine tick, so a change here takes effect on the next poll without
              a reload — no separate "save" step needed. */}
          <Glass className="p-4 !bg-purple-950/10 !border-purple-700/20">
            <div className="text-sm font-semibold flex items-center gap-1.5">📊 Owner Stats Email</div>
            <div className="text-xs text-white/50 mt-0.5 max-w-xl">Controls the "Owner: End-of-Day Summary" automation (Templates → Owner) — a real email with today's jobs completed, revenue, and new leads, computed the same way the Dashboard's "Send Daily Briefing Now" button does.</div>
            <div className="grid md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-purple-700/20">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Frequency</label>
                <GSel value={settings?.ownerSummaryFreq || "daily"} onChange={(e: any) => setSettings((s: any) => ({ ...s, ownerSummaryFreq: e.target.value }))} className="!text-xs">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly (Mondays)</option>
                  <option value="off">Off</option>
                </GSel>
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Send hour (24h, local time)</label>
                <GInput type="number" min="0" max="23" value={settings?.ownerSummaryHour ?? 18} onChange={(e: any) => setSettings((s: any) => ({ ...s, ownerSummaryHour: Math.max(0, Math.min(23, Number(e.target.value) || 0)) }))} className="!text-xs" />
              </div>
            </div>
          </Glass>

          {/* Drives the "VIP customer milestone" trigger and the "Customer is
              a VIP" condition in the workflow builder (useAutomationEngine.ts
              vip_thank_you / customer_is_vip), both of which compare against
              customer.totalSpent. */}
          <Glass className="p-4 !bg-yellow-950/10 !border-yellow-700/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold flex items-center gap-1.5">👑 VIP Customer Threshold</div>
                <div className="text-xs text-white/50 mt-0.5 max-w-xl">Lifetime spend at which a customer counts as a VIP. Used by the "VIP customer milestone" trigger and the "Customer is a VIP" condition.</div>
              </div>
              <GInput
                type="number" min="1" step="50"
                value={settings?.automationVipSpendThreshold ?? 2000}
                onChange={(e: any) => setSettings((s: any) => ({ ...s, automationVipSpendThreshold: Math.max(1, Number(e.target.value) || 2000) }))}
                className="!w-28 !text-sm flex-shrink-0"
              />
            </div>
          </Glass>
        </div>
      </Modal>

      {/* Execution log */}
      {logOpen && (
        <Glass className="p-4 !bg-black/80 !border-green-700/30">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className="w-2 h-2 rounded-full bg-green-400 anim-pulse" />
              Execution Log
              <span className="text-[10px] text-white/40 font-normal">{execLog.length} entries</span>
            </div>
            <button onClick={() => setLogOpen(false)} className="text-white/40 hover:text-white"><X size={14} /></button>
          </div>
          {execLog.length === 0
            ? <div className="text-xs text-white/40 text-center py-6">No executions yet. Click ▶ Test on any workflow, or trigger one by changing a job status.</div>
            : <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {execLog.slice(0, 30).map((l, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-green-950/20 border border-green-800/30 text-xs">
                  <span className="flex-shrink-0">{l.channel === "email" ? "📧" : l.channel === "sms" ? "💬" : l.channel === "task" ? "✅" : l.channel === "delay" ? "⏳" : "🔔"}</span>
                  <span className="flex-1 truncate text-white/80">{l.message}</span>
                  {l.workflowName && <span className="text-[9px] text-white/40 flex-shrink-0">{l.workflowName}</span>}
                  <span className="text-[9px] text-white/30 flex-shrink-0">{new Date(l.ts).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          }
        </Glass>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search workflows…" className="bg-black/40 border border-brand-900/30 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-brand-500/60 w-48" />
        </div>
        <div className="flex gap-1 bg-black/40 border border-brand-900/30 rounded-xl p-1">
          <button onClick={() => setCategory("all")} className={"px-2.5 py-1 rounded-lg text-[10px] font-semibold transition " + (category === "all" ? "bg-brand-600/30 text-white" : "text-white/40 hover:text-white")}>All {automations.length}</button>
          {Object.entries(catMeta).map(([k, m]) => {
            const n = automations.filter(a => catOf(a) === k).length;
            if (!n) return null;
            const Icon = m.icon;
            return <button key={k} onClick={() => setCategory(k === category ? "all" : k)} className={"px-2 py-1 rounded-lg text-[10px] font-semibold transition flex items-center gap-1 " + (category === k ? "text-white" : "text-white/40 hover:text-white")} style={category === k ? { background: m.bg } : {}}>
              <Icon size={9} style={{ color: m.color }} />{m.label} {n}
            </button>;
          })}
        </div>
      </div>

      {/* Workflow cards — n8n style */}
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Workflow size={48} className="mx-auto mb-4 text-white/20 anim-float" />
          <div className="text-white/50 font-semibold mb-1">No workflows yet</div>
          <div className="text-xs text-white/30 mb-4">Create your first automation or pick a template</div>
          <div className="flex gap-2 justify-center">
            <GBtn onClick={() => setTemplatesOpen(true)} variant="ghost">Browse Templates</GBtn>
            <GBtn onClick={() => openBuilder()}>New Workflow</GBtn>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {filtered.map(a => {
            const cat = catOf(a);
            const cm = catMeta[cat];
            const CatIcon = cm.icon;
            const steps = a.steps || [];
            const isActive = a.active;
            const hovered = hoveredId === a.id;

            return (
              <div
                key={a.id}
                className="group relative rounded-2xl border transition-all duration-200"
                style={{
                  background: isActive ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)",
                  borderColor: hovered ? (isActive ? "#9333ea60" : "#ffffff20") : (isActive ? "#7c3aed30" : "#40404020"),
                  boxShadow: hovered && isActive ? "0 0 0 1px #9333ea40, 0 8px 32px -8px rgba(0,0,0,0.8)" : "none"
                }}
                onMouseEnter={() => setHoveredId(a.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                {/* Active indicator bar */}
                {isActive && <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl bg-white/60" />}

                <div className="p-4">
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="text-2xl flex-shrink-0">{a.icon || "⚡"}</div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm leading-tight truncate">{a.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CatIcon size={9} style={{ color: cm.color }} />
                          <span className="text-[10px]" style={{ color: cm.color }}>{cm.label}</span>
                          {steps.length > 0 && <span className="text-[9px] text-white/30">· {steps.length} steps</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Run count badge */}
                      {(a.count || 0) > 0 && (
                        <div className="px-2 py-0.5 rounded-full text-[9px] font-bold border" style={{ background: "rgba(147,51,234,0.15)", borderColor: "#9333ea40", color: "#c084fc" }}>
                          ▶ {a.count} run{a.count !== 1 ? "s" : ""}
                        </div>
                      )}
                      {/* Toggle */}
                      <button onClick={() => toggle(a.id)} className="flex-shrink-0" title={isActive ? "Turn off" : "Turn on"}>
                        {isActive
                          ? <ToggleRight size={28} className="text-green-400 hover:text-green-300 transition" />
                          : <ToggleLeft size={28} className="text-white/25 hover:text-white/50 transition" />
                        }
                      </button>
                      {/* FEATURE — "keep generating pop-ups... allow owners
                          to disable these pop-ups per automation." The
                          automation still runs either way; this only
                          decides whether it waits for a Send All click or
                          fires straight through. */}
                      <button
                        onClick={() => setAutomations(automations.map(x => x.id === a.id ? { ...x, autoApprove: !x.autoApprove } : x))}
                        title={a.autoApprove ? "Sends automatically — click to require approval again" : "Requires your approval each time — click to send automatically, no popup"}
                        className={"flex-shrink-0 px-1.5 py-0.5 rounded-lg border text-[9px] font-semibold transition " + (a.autoApprove ? "bg-green-950/40 border-green-700/40 text-green-300" : "bg-white/5 border-white/10 text-white/40 hover:text-white/70")}
                      >
                        {a.autoApprove ? "Auto-send" : "Ask first"}
                      </button>
                    </div>
                  </div>

                  {/* Node flow strip */}
                  <div className="mb-3 p-2 rounded-xl border border-white/5 bg-black/40 overflow-hidden">
                    {steps.length > 0 ? (
                      <NodeStrip steps={steps} />
                    ) : (
                      <div className="flex items-center gap-2 text-xs">
                        <div className="px-2 py-1 rounded-lg text-[10px] border" style={{ background: NODE_COLORS.trigger.bg, borderColor: NODE_COLORS.trigger.border + "80", color: NODE_COLORS.trigger.text }}>
                          ▶ {a.trigger || "Trigger"}
                        </div>
                        <div className="w-8 h-px bg-white/20" />
                        <div className="px-2 py-1 rounded-lg text-[10px] border" style={{ background: NODE_COLORS.action.bg, borderColor: NODE_COLORS.action.border + "80", color: NODE_COLORS.action.text }}>
                          ⚡ {a.action || "Action"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer row */}
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-white/35 flex items-center gap-2">
                      {a.lastTriggered
                        ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Last ran {a.lastTriggered}</>
                        : <><span className="w-1.5 h-1.5 rounded-full bg-white/20 inline-block" /> Never triggered</>
                      }
                    </div>
                    {/* Action buttons — appear on hover */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150">
                      <button onClick={() => testRun(a)} title="Test run" className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/40 hover:text-green-400 transition flex items-center gap-1 text-[10px]">
                        <Play size={11} /> Test
                      </button>
                      <button onClick={() => openBuilder(a)} title="Edit" className="p-1.5 rounded-lg hover:bg-purple-900/30 text-white/40 hover:text-purple-400 transition flex items-center gap-1 text-[10px]">
                        <Edit size={11} /> Edit
                      </button>
                      <button onClick={() => del(a.id)} title="Delete" className="p-1.5 rounded-lg hover:bg-danger-900/30 text-white/40 hover:text-danger-400 transition">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template Gallery */}
      <Modal open={templatesOpen} onClose={() => setTemplatesOpen(false)} title="Workflow Templates" maxW="max-w-4xl">
        <div className="space-y-3">
          <div className="text-xs text-white/60">Click any template to open it in the workflow builder. Customize it, then save.</div>
          {/* BUG FIX — "automation templates can't be moved on mobile and
              don't fit the screen." This grid had its OWN max-height +
              scroll on top of the Modal's own scrollable body — two nested
              touch-scroll containers fighting over the same swipe gesture
              is a classic mobile bug (the browser can only give the
              gesture to one of them, and which one "wins" is inconsistent
              across devices, often reading as "stuck"/unscrollable).
              Letting the Modal's single outer scroll handle all of it. */}
          <div className="grid md:grid-cols-2 gap-3">
            {(AUTOMATION_TEMPLATES as any[]).map(tpl => (
              <button key={tpl.id} onClick={() => {
                const cloned = { name: tpl.name, category: tpl.category, icon: tpl.icon, description: tpl.description, steps: tpl.steps.map(s => ({ ...s, id: uid() })), trigger: tpl.steps[0]?.label || "", action: tpl.steps.find(s => s.type === "action")?.label || "" };
                setBuilderOpen({ open: true, data: cloned });
                setTemplatesOpen(false);
              }} className="text-left p-4 rounded-xl bg-black/40 border border-brand-900/20 hover:border-purple-500/50 hover:bg-purple-950/20 transition group">
                <div className="flex items-start gap-3">
                  <div className="text-3xl">{tpl.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm group-hover:text-purple-300 transition">{tpl.name}</div>
                    <div className="text-[10px] text-white/50 mt-0.5 line-clamp-2">{tpl.description}</div>
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      {tpl.steps.slice(0, 6).map((s, i) => {
                        const nc = NODE_COLORS[s.type] || NODE_COLORS.action;
                        return <span key={i} className="text-[9px] px-1.5 py-0.5 rounded border" style={{ background: nc.bg, borderColor: nc.border + "60", color: nc.text }}>{nc.icon}</span>;
                      })}
                      {tpl.steps.length > 6 && <span className="text-[9px] text-white/30">+{tpl.steps.length - 6}</span>}
                      <span className="text-[9px] text-white/30 ml-1">{tpl.steps.length} steps</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {/* Blank template */}
            <button onClick={() => { openBuilder(); setTemplatesOpen(false); }} className="text-left p-4 rounded-xl border border-dashed border-white/20 hover:border-purple-500/50 hover:bg-purple-950/10 transition">
              <div className="flex items-center gap-3">
                <span className="text-3xl">➕</span>
                <div>
                  <div className="font-semibold text-sm text-white/70">Start from blank</div>
                  <div className="text-[10px] text-white/40">Build your own workflow step by step</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Visual Workflow Builder */}
      <VisualWorkflowBuilder open={builderOpen.open} data={builderOpen.data} settings={settings} onClose={() => setBuilderOpen({ open: false, data: null })} onSave={d => {
        const firstTrigger = d.steps.find(s => s.type === "trigger");
        const firstAction = d.steps.find(s => s.type === "action");
        // CRITICAL FIX (automation spam) — root cause of automations re-firing
        // for every past recipient: VisualWorkflowBuilder's own `w` state (see
        // its useEffect seeding from `data`) only ever carries id/name/
        // category/icon/description/steps — it never had sentLog, count,
        // active, or lastTriggered to begin with. This handler used to trust
        // `d` for those fields anyway (`d.count || 0`, `d.active !== false`,
        // etc.), which silently reset them to blank/defaults on every single
        // save. For sentLog specifically, that means the dedup memory the
        // engine (useAutomationEngine.ts) relies on to never message the same
        // person twice was wiped out the moment the owner opened an existing
        // automation and hit Save — so it looked "fixed" until anyone edited
        // a workflow, then every past recipient got messaged again. Always
        // carry these forward from the CURRENT stored automation, never from
        // the builder's draft.
        const existing = d.id ? automations.find(a => a.id === d.id) : null;
        const newAuto = {
          id: d.id || uid(), name: d.name, trigger: firstTrigger?.label || "Manual", action: firstAction?.label || "",
          steps: d.steps, isWorkflow: true, category: d.category, icon: d.icon, description: d.description,
          count: existing?.count ?? 0,
          lastTriggered: existing?.lastTriggered ?? null,
          active: existing?.active ?? true,
          sentLog: existing?.sentLog ?? {},
          runLog: existing?.runLog ?? [],
          // Preserve an existing workflow's own send-behavior choice on edit;
          // a brand new one picks up the owner's "Default Send Behavior"
          // setting above instead of silently defaulting to "ask first".
          autoApprove: existing ? existing.autoApprove : !!(settings as any)?.automationDefaultAutoApprove,
        };
        if (existing) setAutomations(automations.map(a => a.id === d.id ? newAuto : a));
        else setAutomations([...automations, newAuto]);
        setBuilderOpen({ open: false, data: null });
        toast("Workflow saved · " + d.steps.length + " steps");
      }} />
    </div>
  );
}

// ===== VISUAL WORKFLOW BUILDER (n8n-style) =====
