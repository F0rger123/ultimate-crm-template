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
import { fmt, uid, today, localDateStr, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, compressImageFile, mediaSrc, dataUrlToBlob, uploadJobMedia } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell, logOutboundSmsToInbox } from "../../lib/messaging";
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
import { LiveMap } from "../ui/LiveMap";
import { supabase } from "../../lib/supabase";

// FIX 8 — same default checklist items JobDetailModal.tsx/EmployeePortal.tsx
// fall back to when a job's preChecklist/duringChecklist/postChecklist are
// still empty. A brand-new job (from the manual "Schedule Job" form or
// Alfred's schedule_job) never writes these columns at all — they only get
// populated in Supabase the first time someone actually checks an item in
// the field portal — so without this same fallback here, every job that
// hasn't been touched yet in the field showed "No checklist items on this
// job" / 0/0 in the owner's Crew View, even though a default checklist is
// exactly what the assigned employee will see and work through.
const CREW_PRE_DEFAULTS = [
  { id: "pre1", label: "Take before photos of the work area", done: false },
  { id: "pre2", label: "Confirm site access", done: false },
  { id: "pre3", label: "Review job scope with customer", done: false },
  { id: "pre4", label: "Note any pre-existing issues", done: false },
];
const CREW_DURING_DEFAULTS = [
  { id: "dur1", label: "Complete the scoped work", done: false },
  { id: "dur2", label: "Keep work area clean and safe", done: false },
  { id: "dur3", label: "Document any extra work or changes", done: false },
];
const CREW_POST_DEFAULTS = [
  { id: "post1", label: "Customer walkthrough", done: false },
  { id: "post2", label: "Collect payment", done: false },
  { id: "post3", label: "Get customer signature", done: false },
  { id: "post4", label: "Take after photos", done: false },
];

export function CrewView({ jobs = [], setJobs, customers = [], employees = [], toast, settings = {} as any, setSettings, estimates = [], setEstimates = (() => {}) as any, refetchEmployees = (() => {}) as any, ownerId = "" }: { jobs?: any[]; setJobs?: any; customers?: any[]; employees?: any[]; toast?: any; settings?: any; setSettings?: any; estimates?: any[]; setEstimates?: any; refetchEmployees?: any; ownerId?: string }) {
  const [empFilter, setEmpFilter] = useState("all");
  const [crewDate, setCrewDate] = useState(today());
  const [liveDetailId, setLiveDetailId] = useState<string | null>(null);

  const activeEmps = employees.filter(e => e.status === "active");
  // AUDIT ITEM 13 — this page had its OWN separate "on shift" filter, still
  // requiring status === "active" — the exact bug already fixed in
  // Dashboard.tsx's Live Team View, just never applied here too. Per
  // instruction: dayClockInAt being set IS "on shift", no other condition.
  const liveEmps = employees.filter((e: any) => !!e.dayClockInAt);
  // FIX 3 — clocking out clears dayClockInAt, so someone who worked a full
  // shift and ended it today would otherwise vanish from this view entirely.
  // lastShiftDate is written via localDateStr() (local date), so match with
  // the same helper rather than the UTC-based today() used elsewhere in this file.
  const shiftEndedEmps = employees.filter((e: any) =>
    !e.dayClockInAt && e.lastShiftDate === localDateStr() && Number(e.lastShiftHours) > 0
  );
  // AUDIT ITEM 13 — same first-load grace period as Dashboard.tsx's Live
  // Team View, so a brief empty employees array before the initial Supabase
  // fetch resolves never reads as "no one has started their shift."
  const [crewDataSettled, setCrewDataSettled] = useState(employees.length > 0);
  useEffect(() => {
    if (employees.length > 0) { setCrewDataSettled(true); return; }
    const t = setTimeout(() => setCrewDataSettled(true), 2500);
    return () => clearTimeout(t);
  }, [employees.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh employee rows every 10s while anyone is sharing their
  // location, so the Live Now map's pins move in real time rather than only
  // updating whenever something else happens to trigger a refetch.
  useEffect(() => {
    const anySharing = activeEmps.some((e: any) => e.locationSharing);
    if (!anySharing) return;
    const interval = setInterval(() => { refetchEmployees(); }, 10000);
    return () => clearInterval(interval);
  }, [activeEmps.some((e: any) => e.locationSharing)]); // eslint-disable-line react-hooks/exhaustive-deps
  const dayJobs = jobs
    .filter(j => j.scheduledDate === crewDate && j.status !== "cancelled")
    .filter(j => empFilter === "all" || (j.crew || []).includes(empFilter))
    .sort((a, b) => { const po = { urgent: 0, high: 1, normal: 2, low: 3 }; return (po[a.priority || "normal"] - po[b.priority || "normal"]); });

  // FIX 8 — this used to be local-state-only (plain setJobs, no Supabase
  // write at all), directly violating docs/ARCHITECTURE.md's documented "checklist sync
  // ... written immediately on toggle, not batched" invariant. A checklist
  // tick, photo add, or "Mark Complete" from this page's Stops view looked
  // like it worked (local state updated) but silently reverted on the next
  // poll since the server row never changed — and never reached the
  // employee portal or the owner's other views either.
  const updateJob = (jid: string, patch: any) => {
    setJobs((prev: any[]) => prev.map(j => j.id === jid ? { ...j, ...patch } : j));
    (supabase as any).from("jobs").update(patch).eq("id", jid)
      .then((r: any) => { if (r?.error) { console.error("[CrewView] updateJob failed:", r.error.message); toast?.("Failed to save — " + r.error.message, "red"); } })
      .catch((e: any) => { console.error("[CrewView] updateJob threw:", e?.message); toast?.("Failed to save — " + (e?.message || "unknown error"), "red"); });
  };
  // FIX 8 — phase-aware so a tick actually lands in whichever of
  // preChecklist/duringChecklist/postChecklist/checklist the item came from
  // (see the combined allChecklistItems list below), instead of always
  // writing to the legacy `checklist` array no matter where the item lives.
  const toggleCk = (jid: string, phase: "preChecklist" | "duringChecklist" | "postChecklist" | "checklist", idx: number) => {
    const j = jobs.find((x: any) => x.id === jid);
    if (!j) return;
    // FIX 8 — allChecklistItems (above) displays CREW_*_DEFAULTS whenever the
    // job's own array is still empty, but this used to toggle against
    // `(j as any)[phase] || []` — an empty array for any job that hasn't
    // been touched yet — so ticking a DEFAULT item persisted `{ [phase]: [] }`
    // to Supabase, silently erasing the default checklist (and the tick)
    // instead of seeding it. Fall back to the same defaults here so the full
    // list (with the toggle applied) is what actually gets saved.
    const defaults = phase === "preChecklist" ? CREW_PRE_DEFAULTS : phase === "duringChecklist" ? CREW_DURING_DEFAULTS : phase === "postChecklist" ? CREW_POST_DEFAULTS : [];
    const current = (j as any)[phase]?.length ? (j as any)[phase] : defaults;
    const updated = current.map((c: any, i: number) => i === idx ? { ...c, done: !c.done } : c);
    updateJob(jid, { [phase]: updated });
  };
  const clockIn = jid => { updateJob(jid, { clockInAt: Date.now() }); toast("Clocked in ✓"); };
  const clockOut = j => {
    if (!j.clockInAt) return;
    const hrs = Math.round(((Date.now() - j.clockInAt) / 3600000) * 100) / 100;
    updateJob(j.id, { clockInAt: null, loggedHours: Math.round(((Number(j.loggedHours) || 0) + hrs) * 100) / 100 });
    toast("+" + hrs + "h logged");
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Crew header */}
      <Glass className="p-4 !bg-gradient-to-br !from-brand-950/40 !to-black/70">
        <div className="flex items-center justify-between mb-3">
          <div><h2 className="font-bold text-lg">🚛 Crew Dashboard</h2><div className="text-xs text-white/60">Field view · {dayJobs.length} stop{dayJobs.length !== 1 ? "s" : ""} today</div></div>
          <GInput type="date" value={crewDate} onChange={e => setCrewDate(e.target.value)} className="!text-xs !py-1.5 !w-36" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setEmpFilter("all")} className={"px-2.5 py-1 rounded-lg text-xs border transition " + (empFilter === "all" ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60")}>All crew</button>
          {activeEmps.map(e => <button key={e.id} onClick={() => setEmpFilter(e.id)} className={"px-2.5 py-1 rounded-lg text-xs border transition " + (empFilter === e.id ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60")}>{e.firstName}</button>)}
        </div>
      </Glass>

      {/* Hours this week per crew member — sums loggedHours directly off
          completed jobs, the same source of truth the Employees tab uses, so
          the owner can see total time without leaving Crew View. */}
      <Glass className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={15} className="text-blue-400" />
          <h3 className="font-semibold text-sm">Hours This Week</h3>
        </div>
        <div className="space-y-1.5">
          {activeEmps.map((e: any) => {
            const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
            const hrs = jobs
              .filter((j: any) => (j.crew || []).includes(e.id) && j.status === "completed" && j.scheduledDate >= weekStart)
              .reduce((s: number, j: any) => s + Number(j.loggedHours || 0), 0);
            return (
              <div key={e.id} className="flex items-center justify-between text-xs px-1">
                <span className="text-white/70 flex items-center gap-1.5">
                  {e.firstName} {e.lastName}
                  {e.dayClockInAt && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" title="On the clock now" />}
                </span>
                <span className="text-white/50 font-mono">{hrs.toFixed(1)}h</span>
              </div>
            );
          })}
          {activeEmps.length === 0 && <div className="text-center py-2 text-xs text-white/30">No active crew members</div>}
        </div>
      </Glass>

      {/* Live Now — every job currently clocked in, across all employees and
          dates; click one to see clock-in time, checklist progress, photos,
          notes, and Street View, plus add a note for the employee. */}
      <Glass className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users2 size={15} className="text-green-400" />
          <h3 className="font-semibold text-sm">Live Now</h3>
          {liveEmps.length > 0 && <Badge tone="green">{liveEmps.length} on shift</Badge>}
        </div>

        {/* Live employee locations (red pins) — only employees who opted in
            (locationSharing) and have a fix from the last 10 minutes.
            PLUS job-location pins (blue) — the property address itself, for
            any job someone has arrived at and not finished, straight from
            the job's own geocoded lat/lng (set when the address was entered
            via AddressAutocomplete). This shows up regardless of whether
            that employee has location sharing on, since "where is this job"
            shouldn't depend on a separate opt-in the employee may not have
            granted — it's the address they were already assigned to. */}
        {(() => {
          const empPins = activeEmps
            .filter((e: any) => e.locationSharing && e.lastLocation && Date.now() - (e.lastLocation.updatedAt || 0) < 10 * 60000)
            .map((e: any) => ({ id: e.id, label: e.firstName, lat: e.lastLocation.lat, lng: e.lastLocation.lng, updatedAt: e.lastLocation.updatedAt, kind: "employee" as const }));
          const jobPins = jobs
            .filter((j: any) => j.arrivedAt && j.status !== "completed" && j.status !== "cancelled" && typeof j.lat === "number" && typeof j.lng === "number")
            .map((j: any) => ({ id: "job-" + j.id, label: j.customerName || j.address || "Job", lat: j.lat, lng: j.lng, updatedAt: j.arrivedAt, kind: "job" as const }));
          const pins = [...empPins, ...jobPins];
          if (pins.length === 0) {
            return (
              <div className="mb-3 h-20 rounded-xl bg-black/20 border border-white/10 flex items-center justify-center text-xs text-white/30">
                No employees sharing location, and no jobs currently arrived-at with a known address location
              </div>
            );
          }
          return (
            <div className="mb-3 space-y-1.5">
              <LiveMap apiKey={settings?.mapsKey || settings?.googleMapsKey || ""} pins={pins} />
              <div className="text-[10px] text-white/40 flex items-center gap-3">
                {empPins.length > 0 && <span>🔴 {empPins.length} employee{empPins.length !== 1 ? "s" : ""} sharing location</span>}
                {jobPins.length > 0 && <span>🔵 {jobPins.length} job{jobPins.length !== 1 ? "s" : ""} on site</span>}
              </div>
            </div>
          );
        })()}

        {liveEmps.length === 0 && shiftEndedEmps.length === 0 ? (
          <div className="text-center py-6 text-white/30 text-sm">
            <Clock size={20} className="mx-auto mb-2 opacity-30" />
            {crewDataSettled ? "No one has started their shift yet" : "Loading crew status…"}
          </div>
        ) : liveEmps.length > 0 ? (
          <div className="space-y-2">
            {liveEmps.map((e: any) => {
              const todayStr = today();
              const empJobs = jobs.filter((j: any) => (j.crew || []).includes(e.id) && j.scheduledDate === todayStr);
              const currentJob = empJobs.find((j: any) => j.status === "in_progress") || empJobs.find((j: any) => j.arrivedAt && j.status !== "completed") || null;
              const cust = currentJob ? customers.find((x: any) => x.id === currentJob.customerId) : null;
              const pausedMs = (Number(e.dayPausedMinutes) || 0) * 60000;
              const onLunch = !!e.dayLunchStartAt;
              const lunchMs = onLunch ? Math.max(0, Date.now() - Number(e.dayLunchStartAt)) : 0;
              const netMs = Math.max(0, Date.now() - Number(e.dayClockInAt) - pausedMs - lunchMs);
              const shiftH = Math.floor(netMs / 3600000);
              const shiftM = Math.floor((netMs % 3600000) / 60000);
              const shiftDisplay = `${shiftH}h ${String(shiftM).padStart(2, "0")}m`;
              return (
                <button key={e.id} onClick={() => currentJob && setLiveDetailId(currentJob.id)}
                  className={"w-full flex items-center gap-3 p-3 rounded-xl border transition text-left " + (currentJob ? "bg-black/30 border-white/10 hover:border-green-600/40 cursor-pointer" : "bg-black/20 border-white/5 cursor-default")}>
                  <div className="w-10 h-10 rounded-lg bg-green-900/40 border border-green-600/40 flex items-center justify-center flex-shrink-0 font-bold text-green-400 text-sm">
                    {(e.firstName?.[0] || "?")}{(e.lastName?.[0] || "")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{e.firstName} {e.lastName}</div>
                    <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap mt-0.5">
                      <span className={"font-mono " + (onLunch ? "text-yellow-400" : "text-green-400")}>{onLunch ? "⏸ " : "⏱ "}{shiftDisplay}</span>
                      {onLunch && <span className="text-yellow-400/70">on lunch</span>}
                      {currentJob && <span className="truncate max-w-[130px]">{cust ? `${cust.firstName} ${cust.lastName}` : currentJob.address}</span>}
                      {currentJob?.arrivedAt && <span className="text-green-400">✓ on site</span>}
                    </div>
                  </div>
                  {currentJob && <ChevronRight size={14} className="text-white/30 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* FIX 3 — employees whose shift already ended today. */}
        {shiftEndedEmps.length > 0 && (
          <div className="space-y-2 mt-2 pt-2 border-t border-white/5">
            {shiftEndedEmps.map((e: any) => {
              const h = Math.floor(Number(e.lastShiftHours) || 0);
              const m = Math.round(((Number(e.lastShiftHours) || 0) - h) * 60);
              return (
                <div key={e.id} className="w-full flex items-center gap-3 p-3 rounded-xl border bg-black/10 border-white/5 opacity-70">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 font-bold text-white/40 text-sm">
                    {(e.firstName?.[0] || "?")}{(e.lastName?.[0] || "")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white/70">{e.firstName} {e.lastName}</div>
                    <div className="text-xs text-white/40 mt-0.5">Shift Ended · Total: {h}h {String(m).padStart(2, "0")}m</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Glass>

      <JobDetailModal
        jobId={liveDetailId}
        job={jobs.find((j: any) => j.id === liveDetailId)}
        onClose={() => setLiveDetailId(null)}
        customers={customers}
        employees={employees}
        // BLOCKER — this used to pass liveUpdateJob, a narrower write that
        // only persisted clock/lunch fields and crew immediately (everything
        // else relied on the 30s bulk autosave in App.tsx, which itself
        // deliberately EXCLUDES paymentStatus/paymentType/amountCollected/
        // status/etc — it assumes something writes those immediately). A job
        // opened from this Live Now view had nowhere that ever persisted a
        // Mark Paid, status change, or checklist edit — it looked like it
        // saved (optimistic local state) and then silently reverted on the
        // next poll. `updateJob` below (already used for this page's own
        // Stops-view checklist/Complete actions) writes the full patch
        // immediately and is the one JobDetailModal should always have had.
        updateJob={updateJob}
        toast={toast}
        settings={settings}
        setSettings={setSettings}
        estimates={estimates}
        setEstimates={setEstimates}
        ownerId={ownerId}
      />

      {/* GPS Route for crew */}
      {dayJobs.length > 0 && <button onClick={() => {
        const addresses = dayJobs.map(j => encodeURIComponent(j.address || "")).filter(Boolean);
        if (addresses.length === 0) return;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (addresses.length === 1) {
          const url = isIOS ? "maps://maps.apple.com/?daddr=" + addresses[0] : "https://www.google.com/maps/dir/?api=1&destination=" + addresses[0];
          window.open(url, "_blank");
        } else {
          // Multi-stop Google Maps route (up to 8 waypoints)
          const dest = addresses[addresses.length - 1];
          const waypoints = addresses.slice(0, -1).join("|");
          const url = "https://www.google.com/maps/dir/?api=1&destination=" + dest + "&waypoints=" + waypoints + "&travelmode=driving";
          window.open(url, "_blank");
        }
      }} className="w-full flex items-center justify-center gap-2 py-3 bg-green-950/30 border border-green-700/40 text-green-300 rounded-2xl hover:bg-green-900/40 transition font-semibold text-sm">
        <Navigation size={16} />Open Full Route in Maps ({dayJobs.length} stops)
      </button>}

      {dayJobs.length === 0 && <div className="text-center py-16 text-white/50">
        <Truck size={40} className="mx-auto mb-3 opacity-30" />
        <div className="text-sm font-medium">No jobs for {crewDate}</div>
        <div className="text-xs mt-1 text-white/40">Check a different date or assign crew to jobs</div>
      </div>}

      {dayJobs.map((j, stopIdx) => {
        const c = customers.find(x => x.id === j.customerId);
        // FIX 8 — this only ever read the legacy single `checklist` array.
        // Jobs use the 3-phase preChecklist/duringChecklist/postChecklist
        // arrays (see docs/ARCHITECTURE.md), which is where real checklist data actually
        // lives for any job created under the current system — `checklist`
        // is empty for those, so this always showed "0/0" regardless of true
        // progress. Combine all four sources, same pattern Dashboard.tsx's
        // checklistProgress already uses.
        // FIX 8 — fall back to the same default checklist the field portal
        // shows when a job hasn't had any items persisted to Supabase yet
        // (see CREW_*_DEFAULTS above) — matches JobDetailModal.tsx's and
        // EmployeePortal.tsx's own `job.preChecklist?.length ? ... : DEFAULTS`
        // pattern so a freshly-scheduled, not-yet-touched job still shows its
        // real checklist instead of "0/0."
        const allChecklistItems = [
          ...(j.preChecklist?.length ? j.preChecklist : CREW_PRE_DEFAULTS).map((it: any, i: number) => ({ ...it, _phase: "preChecklist" as const, _idx: i })),
          ...(j.duringChecklist?.length ? j.duringChecklist : CREW_DURING_DEFAULTS).map((it: any, i: number) => ({ ...it, _phase: "duringChecklist" as const, _idx: i })),
          ...(j.postChecklist?.length ? j.postChecklist : CREW_POST_DEFAULTS).map((it: any, i: number) => ({ ...it, _phase: "postChecklist" as const, _idx: i })),
          ...(j.checklist || []).map((it: any, i: number) => ({ ...it, _phase: "checklist" as const, _idx: i })),
        ];
        const doneCount = allChecklistItems.filter((ck: any) => ck.done).length;
        const pct = allChecklistItems.length ? Math.round((doneCount / allChecklistItems.length) * 100) : 0;
        const videoCount = (j.videos || []).length;
        const isClockedIn = !!j.clockInAt;
        const liveHrs = isClockedIn ? ((Date.now() - j.clockInAt) / 3600000) : 0;
        const prioColor = { urgent: "border-l-danger-500", high: "border-l-yellow-500", normal: "border-l-transparent", low: "border-l-transparent" }[j.priority || "normal"];

        return <div key={j.id} className={"bg-black/60 border border-brand-900/30 rounded-2xl overflow-hidden border-l-4 " + prioColor}>
          {/* Stop header */}
          <div className={"p-4 " + (isClockedIn ? "bg-green-950/30" : "")}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0 text-brand-fg">{stopIdx + 1}</div>
                  <div className="font-bold text-base">{c?.firstName} {c?.lastName}</div>
                  {j.priority === "urgent" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger-600/40 text-danger-200 font-bold border border-danger-500/50">🚨 URGENT</span>}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-white/70 ml-9">
                  <MapPin size={13} />
                  <span className="truncate">{j.address}</span>
                </div>
                {c?.phone && <div className="flex items-center gap-1.5 text-sm text-white/70 ml-9 mt-0.5">
                  <Phone size={13} />
                  <a href={"tel:" + c.phone} className="text-brand-400 hover:underline">{c.phone}</a>
                </div>}
                {j.internalNotes && <div className="ml-9 mt-2 px-3 py-2 rounded-lg bg-yellow-950/30 border border-yellow-700/40 text-[11px] text-yellow-200">
                  ⚠️ {j.internalNotes}
                </div>}
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold text-brand-400">{fmt(j.amount)}</div>
                {j.isCash && <div className="text-[10px] text-green-400 font-bold">💵 CASH</div>}
                <div className="text-[10px] text-white/50">{j.duration}h est.</div>
              </div>
            </div>

            {/* OTW + Maps quick actions */}
            <div className="mt-3 ml-9 flex gap-2">
              <a href={"https://maps.google.com/?q=" + encodeURIComponent(j.address || "")} target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-950/30 border border-blue-700/40 text-blue-300 text-xs font-medium hover:bg-blue-900/40 active:scale-95 transition">
                <Navigation size={12} />Directions
              </a>
              {(c?.phone || c?.email) && <button onClick={async () => {
                if (j.scheduledDate && j.scheduledDate !== today()) {
                  const ok = window.confirm(`This job is scheduled for ${j.scheduledDate}, not today. Send the "on my way" message anyway?`);
                  if (!ok) return;
                }
                const eta = new Date(Date.now() + 17 * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                const msg = `Hi ${c.firstName}! Your technician is on the way! ETA: ${eta}. — ${(settings as any)?.companyName || "CRM Starter"}`;
                if (settings?.twilioSid && c.phone) {
                  try { await twilioSend(settings, c.phone, msg); logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {}); toast("OTW text sent to " + c.firstName + " ✓"); }
                  catch (e: any) { toast(e?.message || "Failed to send OTW text", "red"); }
                } else if (c.email) {
                  try {
                    const html = emailShell(settings,"On My Way", `<p>${msg}</p>`);
                    await sendEmail(settings, { to: c.email, subject: "Your technician is on the way", body: html });
                    toast("OTW email sent to " + c.firstName + " ✓");
                  } catch (e: any) { toast(e?.message || "Failed to send OTW email", "red"); }
                } else if (c.phone) {
                  window.location.href = "sms:" + c.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(msg);
                }
              }} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-orange-950/30 border border-orange-700/40 text-orange-300 text-xs font-medium hover:bg-orange-900/40 active:scale-95 transition">
                <Send size={12} />OTW
              </button>}
              {c?.phone && <a href={"tel:" + c.phone} className="px-3 flex items-center justify-center py-2 rounded-xl bg-green-950/30 border border-green-700/40 text-green-300 hover:bg-green-900/40 active:scale-95 transition">
                <Phone size={12} />
              </a>}
            </div>

            {/* Clock in/out */}
            <div className="mt-3 ml-9">
              {isClockedIn ? (
                <button onClick={() => clockOut(j)} className="w-full py-3 rounded-xl bg-green-900/40 border-2 border-green-500/60 text-green-300 font-bold text-sm flex items-center justify-center gap-2 animate-pulse">
                  <Clock size={16} />{String(Math.floor(liveHrs)).padStart(2, "0")}:{String(Math.floor((liveHrs * 60) % 60)).padStart(2, "0")}:{String(Math.floor((liveHrs * 3600) % 60)).padStart(2, "0")} · Tap to clock out
                </button>
              ) : (
                <button onClick={() => clockIn(j.id)} className="w-full py-3 rounded-xl bg-brand-700/40 border-2 border-brand-500/60 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-700/60 active:scale-95 transition">
                  <Play size={16} />Clock In — Stop {stopIdx + 1}
                </button>
              )}
            </div>
          </div>

          {/* Checklist — always visible regardless of job status (scheduled, in_progress, completed) */}
          {<div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-white/50 uppercase tracking-wider">Checklist</div>
              <div className="text-[11px] font-semibold">{pct}% done</div>
            </div>
            <div className="h-1.5 bg-black/40 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-gradient-to-r from-brand-500 to-green-500 transition-all" style={{ width: pct + "%" }} />
            </div>
            <div className="space-y-2">
              {allChecklistItems.length === 0 && <div className="text-xs text-white/30 italic">No checklist items on this job.</div>}
              {allChecklistItems.map((ck: any) => (
                <label key={ck._phase + ck._idx} className={"flex items-start gap-3 p-3 rounded-xl cursor-pointer transition active:scale-95 " + (ck.done ? "bg-green-950/20 border border-green-700/30" : "bg-white/5 border border-white/10")}>
                  <input type="checkbox" checked={ck.done} onChange={() => toggleCk(j.id, ck._phase, ck._idx)} className="w-5 h-5 rounded accent-green-500 flex-shrink-0 mt-0.5" />
                  <span className={"text-sm " + (ck.done ? "line-through text-white/50" : "text-white/90")}>{ck.label}</span>
                </label>
              ))}
            </div>

            {/* Photos quick-add */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  compressImageFile(f).then(async dataUrl => {
                    const id = uid();
                    const url = await uploadJobMedia(dataUrlToBlob(dataUrl), `${j.id}/photo-${id}.jpg`, "image/jpeg");
                    const newPhoto = url ? { id, type: "before", url, addedAt: today(), caption: "Before" } : { id, type: "before", dataUrl, addedAt: today(), caption: "Before" };
                    updateJob(j.id, { photos: [...(j.photos || []), newPhoto] });
                  });
                  e.target.value = "";
                  toast("Before photo added");
                }} />
                <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-950/30 border border-blue-700/40 text-blue-300 text-xs font-medium">📷 Before</div>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                  const f = e.target.files?.[0]; if (!f) return;
                  compressImageFile(f).then(async dataUrl => {
                    const id = uid();
                    const url = await uploadJobMedia(dataUrlToBlob(dataUrl), `${j.id}/photo-${id}.jpg`, "image/jpeg");
                    const newPhoto = url ? { id, type: "after", url, addedAt: today(), caption: "After" } : { id, type: "after", dataUrl, addedAt: today(), caption: "After" };
                    updateJob(j.id, { photos: [...(j.photos || []), newPhoto] });
                  });
                  e.target.value = "";
                  toast("After photo added");
                }} />
                <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-950/30 border border-green-700/40 text-green-300 text-xs font-medium">✨ After</div>
              </label>
            </div>
            {(j.photos || []).length > 0 && <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              {(j.photos || []).map((p, i) => <div key={i} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 relative">
                {(p.url || p.dataUrl) ? <img src={mediaSrc(p.url, p.dataUrl)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/10 flex items-center justify-center text-lg">{p.type === "before" ? "📷" : "✨"}</div>}
              </div>)}
            </div>}

            {/* Mark complete - always show if not done */}
            {j.status !== "completed" && (
              // BUG FIX — "I checked off a couple things and it told the
              // owner the job got completed even though it wasn't." This
              // button always fully completed the job on tap regardless of
              // checklist %, even though its own label ("Mark Complete (40%
              // checked)") implied it was just saving progress. Now it only
              // completes outright at 100%; below that it asks for an
              // explicit confirmation naming the real percentage first.
              <button onClick={() => {
                if (pct < 100 && !window.confirm(`Only ${pct}% of the checklist is checked off. Mark this job complete anyway?`)) return;
                if (j.clockInAt) clockOut(j); updateJob(j.id, { status: "completed" }); toast("✅ Job complete!");
              }} className={"mt-3 w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition " + (pct === 100 ? "bg-green-700 hover:bg-green-600 text-white" : "bg-green-950/50 border-2 border-green-700/50 text-green-300 hover:bg-green-900/40")}>
                <CheckCircle size={16} />{pct === 100 ? "Mark Job Complete ✓" : "Mark Complete (" + pct + "% checked)"}
              </button>
            )}
            {j.status === "completed" && <div className="mt-3 py-2.5 rounded-xl bg-green-950/30 border border-green-600/40 text-green-300 text-sm text-center font-semibold flex items-center justify-center gap-2"><CheckCircle size={14} />Completed · {j.loggedHours || 0}h logged</div>}
          </div>}
        </div>;
      })}

      {dayJobs.length > 0 && <div className="text-center text-xs text-white/40 pb-4">
        <div>{dayJobs.filter(j => j.status === "completed").length}/{dayJobs.length} complete · {fmt(dayJobs.reduce((s, j) => s + j.amount, 0))} revenue</div>
      </div>}
    </div>
  );
}

// ===== PERSONAL BUDGET PAGE =====
