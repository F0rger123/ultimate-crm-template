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
import { fmt, uid, today, localDateStr, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, weekdayLabels, computeNextRecurringDate, describeRecurringSchedule, isEmployeeUnavailable, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, withTimeout, getEffectiveRate, totalJobPhotoCount, stripLegacyJobFields, insertClientIdRowWithRetry, insertJobRequestSafely, buildJobCalendarDescription } from "../../lib/utils";
const weatherRisk = (_dateStr: string): {icon: string; level: string; reason: string} | null => null;
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell, emailButton, getFreshOwnerGoogleToken, logOutboundSmsToInbox } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
import { deleteByIds } from "../../lib/dbBulk";
import { OwnerShiftBar } from "../ui/OwnerShiftBar";
import { crewIncludesEmployee } from "./EmployeePortal";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { createGCalEvent, updateGCalEvent, deleteGCalEvent as deleteGCalEventDirect } from "../../lib/googleApi";
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
import { BulkJobImportModal } from "../ui/BulkJobImportModal";
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

export function JobsPage({ jobs = [], setJobs, customers = [], setCustomers = (() => {}) as any, employees = [], estimates = [], setEstimates = () => {}, settings = {} as AppSettings, setSettings, toast, posts = [], setPosts = () => {}, setTimeline = () => {}, initialDetailId = null, onInitialDetailIdConsumed = () => {}, onPortal = (_id: string) => {}, ownerId = "", autoOpenNew = false, onAutoOpenNewConsumed, autoOpenNewWorkOrder = false, onAutoOpenNewWorkOrderConsumed, highlightId = null, pushUndo = (_desc: string, _fn: () => void, _redoFn?: () => void) => {}, markRecentlyDeleted = (_table: "jobs" | "customers" | "estimates", _ids: string[]) => {}, unmarkRecentlyDeleted = (_table: "jobs" | "customers" | "estimates", _ids: string[]) => {}, services = [] as any[] }: { jobs?: any[]; setJobs?: any; customers?: any[]; setCustomers?: any; employees?: any[]; estimates?: any[]; setEstimates?: any; settings?: AppSettings; setSettings?: any; toast?: any; posts?: any[]; setPosts?: any; setTimeline?: any; initialDetailId?: string | null; onInitialDetailIdConsumed?: () => void; onPortal?: (id: string) => void; ownerId?: string; autoOpenNew?: boolean; onAutoOpenNewConsumed?: () => void; autoOpenNewWorkOrder?: boolean; onAutoOpenNewWorkOrderConsumed?: () => void; highlightId?: string | null; pushUndo?: (desc: string, fn: () => void, redoFn?: () => void) => void; markRecentlyDeleted?: (table: "jobs" | "customers" | "estimates", ids: string[]) => void; unmarkRecentlyDeleted?: (table: "jobs" | "customers" | "estimates", ids: string[]) => void; services?: any[] }) {
  const [tab, setTab] = useState("scheduled");
  // FEATURE — "Alfred spotlight": jump to whichever tab the highlighted job
  // actually lives on (it may not be the currently-open tab), then glow +
  // scroll to it, driven by App.tsx's spotlight queue.
  useEffect(() => {
    if (!highlightId) return;
    const j = jobs.find((x: any) => x.id === highlightId);
    if (j) setTab(!j.scheduledDate && j.status !== "completed" && j.status !== "cancelled" ? "unscheduled" : j.status);
    setTimeout(() => document.querySelector(`[data-job-id="${highlightId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }, [highlightId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState(cancelReasons[0]);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);
  const confirmDelete = async () => {
    if (!deleteModal) return;
    const jid = deleteModal;
    const deletedJob = jobs.find((x: any) => x.id === jid);
    setJobs((prev: any[]) => prev.filter((x: any) => x.id !== jid));
    markRecentlyDeleted("jobs", [jid]);
    if (jid === detailId) setDetailId(null);
    // BUG FIX — pushUndo existed in App.tsx but nothing in the app ever
    // called it, so the Undo button was permanently disabled (undoCount
    // stuck at 0). Wiring the highest-value destructive actions (job/
    // customer/estimate/invoice delete) so Undo actually has something to do.
    if (deletedJob) {
      pushUndo(`Deleted job at ${deletedJob.address || "unknown address"}`, () => {
        unmarkRecentlyDeleted("jobs", [jid]);
        setJobs((prev: any[]) => [deletedJob, ...prev]);
        (supabase as any).from("jobs").insert(deletedJob).then((r: any) => {
          if (r?.error) toast("Restored locally, but failed to restore on server — " + r.error.message, "red");
        }).catch(() => {});
      }, () => {
        setJobs((prev: any[]) => prev.filter((x: any) => x.id !== jid));
        markRecentlyDeleted("jobs", [jid]);
        (supabase as any).from("jobs").delete().eq("id", jid).select("id").then((r: any) => {
          if (r?.error) toast("Removed locally, but failed to remove on server — " + r.error.message, "red");
          else if (!r?.data || r.data.length === 0) toast("Removed locally, but the server rejected the change", "red");
        }).catch(() => {});
      });
    }
    // Must also delete server-side — otherwise the next cross-device sync
    // poll just re-fetches this row from Supabase and it reappears locally.
    // The query builder is thenable but not a real Promise, so calling
    // .catch() directly on the chain throws "catch is not a function" —
    // that thrown error was aborting this function before the modal closed,
    // which is why it used to stay open after confirming. await + try/catch
    // avoids relying on .catch() existing on the builder at all.
    try {
      // BUG FIX (audit finding) — checked only `error`, not whether the
      // RLS-scoped delete actually matched a row; "Job permanently
      // deleted" could show even on a 0-row silent no-op. Matches
      // CustomersPage.tsx's equivalent delete, which already does this.
      const { error, data } = await (supabase as any).from("jobs").delete().eq("id", jid).select("id");
      if (error) {
        console.warn("Job delete failed to save server-side:", error.message);
        toast("Deleted locally, but failed to delete from server — " + error.message, "red");
        setDeleteModal(null);
        return;
      }
      if (!data || data.length === 0) {
        console.warn("Job delete matched 0 rows server-side — likely blocked by permissions");
        toast("Deleted locally, but the server rejected the delete — check permissions", "red");
        setDeleteModal(null);
        return;
      }
    } catch (err: any) {
      console.warn("Job delete failed to save server-side:", err?.message);
      toast("Deleted locally, but failed to delete from server — " + (err?.message || "unknown error"), "red");
      setDeleteModal(null);
      return;
    }
    setDeleteModal(null);
    toast("Job permanently deleted");
  };
  const [detailId, setDetailId] = useState(null);
  // BUG FIX — "jobs aren't syncing to Google Calendar for owners." The
  // owner's manual "☁ Sync" button inside JobDetailModal reads a `gToken`
  // prop that this page never actually passed — it silently defaulted to
  // "" every time, so the button always failed with "Add a scheduled date
  // first" regardless of whether Google was connected or the date was set.
  // Resolve (and proactively refresh) a real token whenever the detail
  // modal is opened.
  const [gToken, setGToken] = useState("");
  useEffect(() => {
    if (!detailId) return;
    getFreshOwnerGoogleToken(settings as any, (token: string) => setGToken(token)).then((token: string | null) => { if (token) setGToken(token); });
  }, [detailId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link into a specific job's detail — e.g. from Dashboard's Live Team
  // View "View" button, which navigates here with a target job already known.
  useEffect(() => {
    if (!initialDetailId) return;
    setDetailId(initialDetailId);
    onInitialDetailIdConsumed();
  }, [initialDetailId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [prioFilter, setPrioFilter] = useState("all");
  const [search, setSearch] = useState("");
  // FIX 12 — was only 3 sort buttons (Date/Priority/Amount), each with a
  // single fixed direction and no Status option. Full dropdown with the
  // exact options requested; "Recently Scheduled" (newest date first) is
  // the default.
  const [sortBy, setSortBy] = useState("date_desc");
  const [routeOpen, setRouteOpen] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]);
  const [bulkAction, setBulkAction] = useState(null);
  const [, forceTick] = useState(0);
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  // BUG FIX — "it keeps creating/adding duplicate jobs on the Google
  // calendar." The "Schedule Job" submit button had no re-entrancy guard
  // at all — a double-tap (easy on mobile, or just a slow first click)
  // fired this whole async handler twice, creating two real job rows AND
  // two Google Calendar events for what was meant to be one job. Simple
  // time-boxed lock rather than threading a saving-state through every
  // exit path of this large handler.
  const newJobSubmittingRef = useRef(false);
  // ISSUE 21 — FAB's "Schedule Job" now opens this modal immediately instead
  // of just landing on the Jobs tab.
  useEffect(() => {
    if (!autoOpenNew) return;
    setNewJobForm(emptyNewJobForm());
    setNewJobOpen(true);
    onAutoOpenNewConsumed?.();
  }, [autoOpenNew]); // eslint-disable-line react-hooks/exhaustive-deps
  // FEATURE — WorkOrdersPage.tsx's "New Work Order" button lands here with
  // the work-order toggle already on, instead of duplicating the whole New
  // Job form a second time in a separate page.
  useEffect(() => {
    if (!autoOpenNewWorkOrder) return;
    setNewJobForm({ ...emptyNewJobForm(), isWorkOrder: true, jobType: "commercial" } as any);
    setNewJobOpen(true);
    onAutoOpenNewWorkOrderConsumed?.();
  }, [autoOpenNewWorkOrder]); // eslint-disable-line react-hooks/exhaustive-deps
  // FIX 4 — recurring options weren't reachable from job CREATION at all
  // (JobDetailModal has a full recurring editor, but that's post-creation
  // only). One shared factory for the "empty form" shape so the initial
  // useState, and both places that reset it before opening the modal, can't
  // drift out of sync with each other.
  // FIX 5 — crewEmpId (singular) only ever let the owner pick ONE crew member
  // when scheduling a job; crewEmpIds (array) lets multiple be selected at
  // once, all saved to the job's crew array together.
  const emptyNewJobForm = () => ({ customerId: "", address: "", lat: undefined as number | undefined, lng: undefined as number | undefined, amount: "", scheduledDate: today(), scheduledTime: "", priority: "normal", notes: "", duration: "", crewEmpIds: [] as string[], jobType: "residential", isRecurring: false, recurringMode: "preset" as "preset" | "days" | "weeks" | "months" | "weekdays", recurringFreq: "monthly", recurringInterval: 1, recurringWeekdays: [] as number[], checklist: [] as { id: string; label: string }[] });
  const [newJobForm, setNewJobForm] = useState(emptyNewJobForm());
  // BLOCKER — this used to be ONE shared mode applied to every selected
  // employee at once, so there was no way to assign one crew member directly
  // while requesting another on the same job (the actual ask), and — worse —
  // an owner who meant "assign" for everyone but had this default to
  // "request" (or vice versa) would see an employee they thought was
  // assigned sitting only in job_requests, silently absent from crew/myJobs.
  // Per-employee mode removes that whole class of mismatch.
  const [crewModeById, setCrewModeById] = useState<Record<string, "assign" | "request">>({});
  const [quickReqJobId, setQuickReqJobId] = useState<string | null>(null);
  const [quickReqEmpId, setQuickReqEmpId] = useState("");
  const [quickReqMsg, setQuickReqMsg] = useState("");
  // FIX 6 — inline "schedule this accepted quote" picker for the Unscheduled section.
  const [schedulingJobId, setSchedulingJobId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [quickReqSending, setQuickReqSending] = useState(false);

  // Live tick for any running clocks
  useEffect(() => {
    if (!jobs.some(j => j.clockInAt)) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [jobs]);

  // Route optimization using nearest-neighbor heuristic on lat/lng
  const baseGeo = { lat: 39.9626, lng: -76.7277 }; // your area depot
  const dist = (a, b) => Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2));
  const optimizeRoute = scheduledJobs => {
    const withGeo = scheduledJobs.map(j => ({ ...j, lat: j.lat || baseGeo.lat + (Math.random() - 0.5) * 0.1, lng: j.lng || baseGeo.lng + (Math.random() - 0.5) * 0.15 }));
    if (withGeo.length <= 1) return withGeo;
    const visited = new Set();
    const route = [];
    let current = baseGeo;
    while (route.length < withGeo.length) {
      let nearest = null;
      let nearestDist = Infinity;
      withGeo.forEach(j => {
        if (visited.has(j.id)) return;
        const d = dist(current, j);
        if (d < nearestDist) { nearestDist = d; nearest = j; }
      });
      if (nearest) { visited.add(nearest.id); route.push(nearest); current = nearest; }
    }
    return route;
  };

  const todayScheduled = jobs.filter(j => j.scheduledDate === localDateStr() && j.status === "scheduled");
  const optimizedRoute = optimizeRoute(todayScheduled);

  // BUG FIX — the owner asked for an "Unscheduled" section like the
  // Calendar page already has, right in the Jobs page tab bar. It existed
  // as a banner (see the "Unscheduled — Needs a Date" block below) but only
  // rendered when there was at least one unscheduled job, so it looked like
  // the feature didn't exist at all whenever the list was empty — same
  // vanish-when-empty bug fixed for Lead Intake's sort/filter bar. Now a
  // real tab, always visible, matching the other four.
  const tabs = { unscheduled: "Unscheduled", scheduled: "Scheduled", in_progress: "In Progress", completed: "Completed", cancelled: "Cancelled" };
  const prioOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
  // FEATURE — "jobs that need to be rescheduled should also show up in the
  // unscheduled jobs section," even ones a crew member already picked a new
  // date for from the field (EmployeePortal.tsx's Can't Finish/Reschedule) —
  // needsReschedule stays true until the owner confirms/clears it below, so
  // these don't just blend into the normal Scheduled list unnoticed.
  const isUnscheduled = (j: any) => (!j.scheduledDate || j.needsReschedule) && j.status !== "completed" && j.status !== "cancelled";
  const filtered = jobs
    .filter(j => tab === "unscheduled" ? isUnscheduled(j) : j.status === tab)
    .filter(j => prioFilter === "all" || (j.priority || "normal") === prioFilter)
    .filter(j => {
      if (!search.trim()) return true;
      const c = customers.find(x => x.id === j.customerId);
      const q = search.toLowerCase();
      return (c?.firstName + " " + c?.lastName).toLowerCase().includes(q) || (j.address || "").toLowerCase().includes(q) || (j.tags || []).some(t => t.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      if (sortBy === "amount_desc") return b.amount - a.amount;
      if (sortBy === "amount_asc") return a.amount - b.amount;
      if (sortBy === "priority") return (prioOrder[a.priority || "normal"] - prioOrder[b.priority || "normal"]) || a.scheduledDate.localeCompare(b.scheduledDate);
      if (sortBy === "status") return String(a.status || "").localeCompare(String(b.status || "")) || a.scheduledDate.localeCompare(b.scheduledDate);
      if (sortBy === "date_asc") return a.scheduledDate.localeCompare(b.scheduledDate) || (prioOrder[a.priority || "normal"] - prioOrder[b.priority || "normal"]);
      // ISSUE 8 — "date_desc" (the default) always sorted by scheduledDate,
      // which is meaningless for the Completed/Cancelled tabs (it reflects
      // when the job was booked FOR, not when it actually finished or was
      // called off — a job scheduled for next week that got cancelled today
      // would sort above one cancelled an hour ago). Use the tab-appropriate
      // timestamp: completedAt for Completed, cancelledAt for Cancelled,
      // falling back to scheduledDate if the timestamp is missing (jobs
      // completed/cancelled before this field existed).
      const dateKey = tab === "completed" ? "completedAt" : tab === "cancelled" ? "cancelledAt" : "scheduledDate";
      const aDate = (a as any)[dateKey] || a.scheduledDate || "";
      const bDate = (b as any)[dateKey] || b.scheduledDate || "";
      return String(bDate).localeCompare(String(aDate)) || (prioOrder[a.priority || "normal"] - prioOrder[b.priority || "normal"]);
    });

  const move = (jid, ns) => {
    setJobs(jobs.map(j => j.id === jid ? { ...j, status: ns } : j));
    // Auto-text customer when job is confirmed/scheduled
    if (ns === "scheduled") {
      const j = jobs.find(x => x.id === jid);
      const c = j && customers.find(x => x.id === j.customerId);
      if (c?.phone && settings?.twilioSid) {
        const coName = (settings as any)?.companyName || "CRM Starter";
        const coPhone = (settings as any)?.companyPhone || "(555) 555-0100";
        const msg = "Hi " + c.firstName + "! Your service has been confirmed for " + (j.scheduledDate || "your requested date") + ". We'll text you when we're on the way. Questions? Call " + coPhone + ". — " + coName;
        twilioSend(settings, c.phone, msg)
          .then(() => logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {}))
          .catch((e: any) => console.warn("[JobsPage] scheduled-confirmation text failed:", e?.message));
      }
    }
    // Job completed thank-you text (separate from review request)
    if (ns === "completed") {
      const j = jobs.find(x => x.id === jid);
      const c = j && customers.find(x => x.id === j.customerId);
      if (c?.phone && settings?.twilioSid) {
        const msg = "Hi " + c.firstName + "! Your home is looking great 🙌 Thank you for choosing CRM Starter. We appreciate your business! If you ever need us again, reply or call (555) 555-0100. — CRM Starter";
        setTimeout(() => twilioSend(settings, c.phone, msg)
          .then(() => logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {}))
          .catch((e: any) => console.warn("[JobsPage] job-completed thank-you text failed:", e?.message)), 1000);
      }
      // Auto-add to customer timeline
      if (j && c) {
        setTimeline(prev => ({ ...prev, [c.id]: [{ id: uid(), type: "job", note: "Job completed — " + fmt(j.amount), date: today() }, ...(prev[c.id] || [])] }));
      }
      // Referral credit — if this referred customer's FIRST completed job
      // just happened, credit whoever referred them. Checked against jobs
      // BEFORE this update lands, so it only fires once per referral.
      if (j && c?.referredBy) {
        const priorCompleted = jobs.filter(x => x.customerId === c.id && x.status === "completed" && x.id !== j.id);
        if (priorCompleted.length === 0) {
          const referrer = customers.find(x => x.id === c.referredBy);
          if (referrer) {
            const creditAmount = Number((settings as any)?.referralSettings?.referrerCredit) || 25;
            const newOwed = (Number(referrer.referralCreditOwed) || 0) + creditAmount;
            setCustomers((prev: any[]) => prev.map(x => x.id === referrer.id ? { ...x, referralCreditOwed: newOwed } : x));
            // BUG FIX — "make sure referrals actually work." This only ever
            // updated local React state — never Supabase — so the credit
            // was invisible on any other device and got silently wiped out
            // the next time customers synced from the server (the server's
            // still-stale referralCreditOwed would just overwrite this
            // tab's local bump right back to what it was). Same real
            // write + 0-row-check pattern every other owner_id-scoped
            // update in this app uses (docs/ARCHITECTURE.md).
            (supabase as any).from("customers").update({ referralCreditOwed: newOwed }).eq("id", referrer.id).select("id")
              .then((r: any) => { if (r?.error || !r?.data?.length) console.error("[Referral] credit sync failed:", r?.error?.message || "0 rows matched"); })
              .catch((e: any) => console.error("[Referral] credit sync threw:", e?.message));
            toast?.(`${referrer.firstName} earned $${creditAmount} referral credit for referring ${c.firstName} ✓`, "green");
          }
        }
      }
      // Auto-post if Social auto-post is enabled in settings
      if (settings?.autoPostCompletedJobs && j) {
        // BUG FIX — this hardcoded "(555) 555-0100", "#yourbusiness",
        // and "your area" regardless of the owner's actual business — every
        // auto-drafted post advertised a placeholder phone number and a
        // different company's hashtag. Now pulls from real settings.
        const companyName = (settings as any)?.companyName || "CRM Starter";
        const companyPhone = (settings as any)?.companyPhone || settings?.myPhone || "";
        const cityTag = ((settings as any)?.companyCity || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        const area = j.address?.split(",")[1]?.trim() || (settings as any)?.companyCity || "";
        const serviceType = (j as any).lineItems?.[0]?.description || "job";
        const caption = "✅ Just wrapped a " + serviceType + (area ? " in " + area : "") + "! 💧\n\nAnother property looking fresh. Ready to transform yours?\n\n" + (companyPhone ? "Free quotes → " + companyPhone : "Free quotes — reach out today!") + "\n\n#smallbusiness" + (cityTag ? " #" + cityTag : "") + " #localservice";
        setPosts(prev => [{ id: uid(), platform: "instagram", type: "completed_job", caption, scheduledFor: today(), hashtags: "#smallbusiness" + (cityTag ? " #" + cityTag : ""), status: "scheduled", likes: 0, shares: 0, comments: 0, reach: 0, autoGenerated: true }, ...prev]);
        // "Auto-post" only auto-DRAFTS — Instagram's API requires hosted
        // media to actually publish (see lib/socialOAuth.ts), so every
        // Instagram post here still needs a manual share regardless of this
        // setting. Say so plainly instead of implying it already went out.
        toast(`📱 Draft post ready for review in the Social tab (Instagram still needs a manual share — ${companyName})`);
      }
    }
  };
  const toggleCk = (jid, idx) => setJobs(jobs.map(j => j.id === jid ? { ...j, checklist: (j.checklist || []).map((c, i) => i === idx ? { ...c, done: !c.done } : c) } : j));
  const updateJob = (jid, patch) => {
    const oldJob = jobs.find(j => j.id === jid);
    setJobs(jobs.map(j => j.id === jid ? { ...j, ...patch } : j));
    // FIX 7 — write the WHOLE patch immediately, unconditionally. This used to
    // only push specific field categories (clock/lunch, crew, photos) right
    // away and leave everything else (notes, scheduledTime, equipmentChecked,
    // etc.) to the App-level 30s bulk autosave — but that bulk save now
    // excludes every employee-writable field (to stop it clobbering fresher
    // employee-portal writes with a stale owner-browser copy, see App.tsx),
    // so anything ONLY relying on the bulk save would never persist at all.
    // Writing the full patch here closes that gap; the specific blocks below
    // still run for their extra side effects (toasts, crew-write verification,
    // job_requests sync) — the writes overlap harmlessly.
    // BUG FIX — "changes for a job were not saved" with zero error toast.
    // This general write only ever checked result?.error and never showed
    // a toast on failure at all — and (per docs/ARCHITECTURE.md's owner_id-scoped RLS)
    // an UPDATE that matches ZERO rows server-side still comes back with
    // no error (PostgREST 204), so a silently-RLS-blocked write looked
    // completely indistinguishable from a real save. .select("id") lets a
    // 0-row response be told apart from a genuine success, and both cases
    // now surface a real toast, matching every other write path in the app.
    (supabase as any).from("jobs").update(patch).eq("id", jid).select("id")
      .then((result: any) => {
        if (result?.error) { console.warn("[updateJob] full patch failed:", result.error.message); toast?.("Failed to save job changes — " + result.error.message, "red"); }
        else if (!result?.data || result.data.length === 0) { console.warn("[updateJob] full patch matched 0 rows — likely blocked by permissions"); toast?.("Couldn't save — the server rejected the change", "red"); }
      })
      .catch((e: any) => { console.warn("[updateJob] full patch threw:", e?.message); toast?.("Failed to save job changes — " + (e?.message || "unknown error"), "red"); });
    // Crew assignment must reach Supabase immediately — the employee portal
    // polls Supabase directly, and waiting for the 30s auto-save interval in
    // App.tsx means an assignment can sit invisible to the employee that long.
    // Clock-in/lunch/hours fields are excluded from the App-level 30s bulk
    // autosave (so it never clobbers a more-recent write the employee portal
    // made directly), so any owner-side edit to them must be pushed to
    // Supabase immediately right here instead.
    const EMPLOYEE_OWNED_FIELDS = ["clockInAt", "lunchStartAt", "lunchMinutes", "lunchExceeded", "loggedHours"] as const;
    const ownedPatch: any = {};
    EMPLOYEE_OWNED_FIELDS.forEach(f => { if ((patch as any)[f] !== undefined) ownedPatch[f] = (patch as any)[f]; });
    // BUG FIX (audit finding) — these two writes checked only `.error`, not
    // whether the RLS-scoped update actually matched a row (the same 0-row-
    // silent-success gotcha the "full patch" write above already guards
    // against with .select("id")). The crew-assignment one is the worse of
    // the two: it showed "Crew updated ✓" even when the write silently
    // affected 0 rows — a false-positive success telling the owner an
    // assignment saved when it didn't.
    if (Object.keys(ownedPatch).length > 0) {
      (supabase as any).from("jobs").update(ownedPatch).eq("id", jid).select("id")
        .then((result: any) => {
          if (result?.error) toast?.("Failed to save — " + result.error.message, "red");
          else if (!result?.data || result.data.length === 0) toast?.("Couldn't save — the server rejected the change", "red");
        })
        .catch((e: any) => toast?.("Failed to save: " + e?.message, "red"));
    }
    if (patch.crew !== undefined) {
      const crewPatch: any = { crew: patch.crew };
      if (patch.crewAssignedAt !== undefined) crewPatch.crewAssignedAt = patch.crewAssignedAt;
      (supabase as any).from("jobs").update(crewPatch).eq("id", jid).select("id")
        .then((result: any) => {
          if (result?.error) { toast?.("Crew assignment failed to save — " + result.error.message, "red"); console.warn("[Verify] scheduling/assigning employees — failed:", result.error.message); }
          else if (!result?.data || result.data.length === 0) { toast?.("Couldn't save — the server rejected the crew assignment", "red"); console.warn("[Verify] scheduling/assigning employees — 0 rows matched"); }
          else { toast?.("Crew updated ✓", "green"); console.log("[Verify] scheduling/assigning employees — working"); }
        })
        .catch((e: any) => {
          console.warn("[CrewFlow] crew save threw:", e?.message);
          toast?.("Crew assignment failed to save", "red");
        });
    }
    // FIX 6 — photos/checklists must reach Supabase immediately, not wait on
    // the 30s bulk jobs autosave in App.tsx. That bulk upsert re-sends every
    // job's full row every cycle; a single job with several photos can push
    // the whole batch over PostgREST's request-size limit and silently fail
    // the entire cycle, which looked exactly like "photos don't sync" (see
    // compressImageFile in lib/utils.ts for the other half of this fix).
    const IMMEDIATE_SYNC_FIELDS = ["photos", "videos", "checklist", "preChecklist", "duringChecklist", "postChecklist"] as const;
    const immediatePatch: any = {};
    IMMEDIATE_SYNC_FIELDS.forEach(f => { if ((patch as any)[f] !== undefined) immediatePatch[f] = (patch as any)[f]; });
    if (Object.keys(immediatePatch).length > 0) {
      // BUG FIX (audit finding) — no 0-row check meant photos/checklists
      // could silently fail to save (RLS mismatch) with no error shown.
      (supabase as any).from("jobs").update(immediatePatch).eq("id", jid).select("id")
        .then((result: any) => {
          if (result?.error) toast?.("Failed to save — " + result.error.message, "red");
          else if (!result?.data || result.data.length === 0) toast?.("Couldn't save — the server rejected the change", "red");
        })
        .catch((e: any) => toast?.("Failed to save: " + e?.message, "red"));
    }
    // FIX 10 — when a job's date changes, keep any PENDING crew request for it
    // in sync. The request row references job_id (so the portal already reads
    // the live date), but we bump updated_at + write the new date so realtime
    // subscribers re-render and the record itself reflects the reschedule.
    if (patch.scheduledDate !== undefined && oldJob && patch.scheduledDate !== oldJob.scheduledDate) {
      // BUG FIX (audit) — checked only `error`, never row count, so a 0-row
      // RLS mismatch never even tried the fallback retry below it.
      (supabase as any).from("job_requests")
        .update({ scheduled_date: patch.scheduledDate, updated_at: new Date().toISOString() })
        .eq("job_id", jid).eq("status", "pending").select("id")
        .then((r: any) => {
          if (r?.error || !Array.isArray(r?.data) || r.data.length === 0) {
            // scheduled_date column may not exist (or 0 rows matched) — retry with just updated_at.
            (supabase as any).from("job_requests").update({ updated_at: new Date().toISOString() }).eq("job_id", jid).eq("status", "pending").select("id")
              .then((r2: any) => { if (r2?.error || !Array.isArray(r2?.data) || r2.data.length === 0) console.warn("[Reschedule] could not update requests:", r2?.error?.message || "0 rows matched"); });
          }
        })
        .catch((e: any) => console.warn("[Reschedule] request update failed:", e?.message));
    }
    // Sync Google Calendar when date or time changes. BUG FIX — this read
    // (settings as any).googleToken, a field nothing in this app ever
    // writes (the real field is googleProviderToken/localStorage — see
    // getFreshOwnerGoogleToken in lib/messaging.ts) so this sync has been
    // silently dead since it was written; every job reschedule quietly
    // failed to move the matching Google Calendar event.
    if (oldJob?.googleEventId && (settings as any)?.googleConnected) {
      if (patch.scheduledDate !== undefined || patch.scheduledTime !== undefined) {
        const newDate = patch.scheduledDate ?? oldJob.scheduledDate;
        const newTime = patch.scheduledTime ?? oldJob.scheduledTime ?? "09:00";
        if (newDate) {
          const startDt = new Date(newDate + "T" + (newTime || "09:00") + ":00");
          const hrs = Number(patch.duration ?? oldJob.duration) || 2;
          const endDt = new Date(startDt.getTime() + hrs * 3600000);
          getFreshOwnerGoogleToken(settings as any).then(token => {
            if (!token) return;
            updateGCalEvent(token, oldJob.googleEventId, {
              start: startDt.toISOString(),
              end: endDt.toISOString(),
            }, (settings as any).googleCalendarId || "primary").catch(() => {});
          }).catch(() => {});
        }
      }
    }
  };
  const confirmCancel = () => {
    const j = jobs.find(x => x.id === cancelModal);
    setJobs(jobs.map(x => x.id === cancelModal ? { ...x, status: "cancelled", cancelReason, cancelledAt: new Date().toISOString() } : x));
    setCancelModal(null);
    toast("Job cancelled");
    // Delete Google Calendar event if connected
    if (j?.googleEventId && settings?.googleConnected) {
      getFreshOwnerGoogleToken(settings as any).then(token => {
        if (token) deleteGCalEventDirect(token, j.googleEventId).catch(() => {});
      }).catch(() => {});
    }
  };
  const clockIn = jid => { updateJob(jid, { clockInAt: Date.now() }); toast("Clocked in"); };
  // "Is the owner working this job right now?" — on its crew, not finished,
  // and either started / arrived, or it's today's job while they're on the
  // clock. Only then does a card show work details (full checklist, photos,
  // OTW); otherwise it stays a short summary — tap it to open everything.
  const ownerEmp = employees.find((e: any) => e.role === "owner") || null;
  // undefined = trust the employees row; set by OwnerShiftBar the moment the
  // owner taps clock in/out, until the next sync shows the same thing.
  const [ownerClockOverride, setOwnerClockOverride] = useState<number | null | undefined>(undefined);
  const rowOnClock = !!(ownerEmp?.dayClockInAt ?? ownerEmp?.dayclockinat);
  useEffect(() => { if (ownerClockOverride !== undefined && rowOnClock === !!ownerClockOverride) setOwnerClockOverride(undefined); }, [rowOnClock]); // eslint-disable-line react-hooks/exhaustive-deps
  const ownerOnClock = ownerClockOverride !== undefined ? !!ownerClockOverride : rowOnClock;
  const isOwnerWorkingOn = (j: any) => {
    if (!ownerEmp || !crewIncludesEmployee(j.crew, ownerEmp.id, ownerEmp.user_id)) return false;
    if (j.status === "completed" || j.status === "cancelled") return false;
    return j.status === "in_progress" || !!j.arrivedAt || !!j.clockInAt || (j.scheduledDate === localDateStr() && ownerOnClock);
  };
  const clockOut = j => {
    if (!j.clockInAt) return;
    const hrs = Math.round(((Date.now() - j.clockInAt) / 3600000) * 100) / 100;
    updateJob(j.id, { clockInAt: null, loggedHours: Math.round(((Number(j.loggedHours) || 0) + hrs) * 100) / 100 });
    toast("+" + hrs + "h logged");
  };

  const sendQuickJobRequest = async (job: any) => {
    const emp = employees.find(e => e.id === quickReqEmpId);
    if (!emp) return;
    setQuickReqSending(true);
    try {
      // ownerId is captured once at app auth-bootstrap (App.tsx) and passed
      // down as a prop — this component must never call
      // supabase.auth.getSession() itself, since that call is known to hang
      // indefinitely under Supabase internal navigator-lock contention, which
      // is exactly what left this button stuck on "Sending…" forever.
      console.log("[CrewRequest] quick-request ownerId:", ownerId || "(empty)");
      if (!ownerId) {
        console.warn("[CrewRequest] quick-request blocked — ownerId still empty");
        toast?.("Still finishing sign-in — wait a moment and try again", "red");
        return;
      }
      const portalUrl = `${window.location.origin}${window.location.pathname}`;
      const { data: row, error } = await insertJobRequestSafely({
        job_id: job.id,
        employee_id: emp.id,
        owner_id: ownerId,
        status: "pending",
        message: quickReqMsg.trim() || null,
      });
      if (!error && row?.id) {
        const requestUrl = `${portalUrl}#/portal?request=${row.id}`;
        const c = customers.find((x: any) => x.id === job.customerId);
        if (emp.email) {
          const html = emailShell(settings,"Job Request", `<p>Hi ${emp.firstName},</p><p>${quickReqMsg || "You have a new job request:"}</p>
              <ul>
                <li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li>
                <li><b>Address:</b> ${job.address}</li>
                ${c ? `<li><b>Customer:</b> ${c.firstName} ${c.lastName}</li>` : ""}
              </ul>` + emailButton("View Request — Accept or Decline", requestUrl));
          withTimeout(sendEmail(settings, { to: emp.email, subject: `Job Request — ${job.scheduledDate}`, body: html }), 8000, "Email send").catch((e: any) => console.warn("Job request email failed — request still saved:", e?.message));
        }
        if (toast) toast(`Request sent to ${emp.firstName} ✓`, "green");
        setQuickReqJobId(null);
        setQuickReqEmpId("");
        setQuickReqMsg("");
      } else {
        if (toast) toast("Request failed — " + (error?.message || "run the job_requests SQL in Supabase first"), "red");
      }
    } catch (e: any) {
      if (toast) toast(e?.message || "Error sending request", "red");
    } finally {
      setQuickReqSending(false);
    }
  };

  // Touch swipe handling
  const touchRef = useRef({});
  const handleTouchStart = (jid, e) => { touchRef.current[jid] = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchEnd = (jid, e, job) => {
    const start = touchRef.current[jid];
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = Math.abs(e.changedTouches[0].clientY - start.y);
    if (dx < -80 && dy < 50 && job.status === "in_progress") {
      move(jid, "completed");
      toast("Job completed!");
    } else if (dx < -80 && dy < 50 && job.status === "scheduled") {
      move(jid, "in_progress");
      toast("Job started");
    }
    delete touchRef.current[jid];
  };

  return (
    <div className="space-y-4">
      {/* Route Optimization Modal */}
      <Modal open={routeOpen} onClose={() => setRouteOpen(false)} title="Today's Optimized Route" maxW="max-w-lg">
        {optimizedRoute.length === 0 ? <div className="text-center py-8 text-white/50 text-sm">No jobs scheduled for today yet.</div> : <div className="space-y-3">
          <div className="text-xs text-white/60 mb-2">Nearest-neighbor route from your area depot · {optimizedRoute.length} stops</div>
          <div className="flex items-start gap-2">
            <div className="flex flex-col items-center pt-1">
              <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-brand-fg">🏠</div>
              <div className="w-px flex-1 bg-brand-700/40 my-0.5" style={{ minHeight: "20px" }} />
            </div>
            <div className="flex-1 min-w-0 pt-0.5"><div className="text-xs font-semibold">your area Depot</div><div className="text-[10px] text-white/50">Start here</div></div>
          </div>
          {optimizedRoute.map((j, idx) => {
            const c = customers.find(x => x.id === j.customerId);
            const wr = weatherRisk(j.scheduledDate);
            return <div key={j.id} className="flex items-start gap-2">
              <div className="flex flex-col items-center pt-1">
                <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-brand-fg">{idx + 1}</div>
                {idx < optimizedRoute.length - 1 && <div className="w-px bg-brand-700/40 my-0.5" style={{ height: "24px" }} />}
              </div>
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-sm">{c?.firstName} {c?.lastName}</div>
                  <div className="text-xs text-brand-400 font-semibold">{fmt(j.amount)}</div>
                </div>
                <div className="text-[11px] text-white/60 truncate">{j.address}</div>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {j.duration && <span className="text-[10px] text-white/50">⏱ {j.duration}h</span>}
                  {j.priority && j.priority !== "normal" && <Badge tone={j.priority === "urgent" ? "red" : "yellow"}>{j.priority}</Badge>}
                  {wr && <span className="text-[10px] text-yellow-300">{wr.icon} {wr.reason}</span>}
                </div>
              </div>
            </div>;
          })}
          <div className="pt-3 border-t border-brand-900/20 text-xs text-white/50 flex justify-between">
            <span>Estimated total: {optimizedRoute.reduce((s, j) => s + (j.duration || 2), 0)}h</span>
            <span>Revenue: {fmt(optimizedRoute.reduce((s, j) => s + j.amount, 0))}</span>
          </div>
          <GBtn onClick={() => { navigator.clipboard?.writeText(optimizedRoute.map((j, i) => { const c = customers.find(x => x.id === j.customerId); return (i + 1) + ". " + c?.firstName + " " + c?.lastName + " — " + j.address; }).join("\n")); toast("Route copied"); }} variant="ghost" className="w-full !text-xs"><Copy size={12} className="inline mr-1.5" />Copy route</GBtn>
        </div>}
      </Modal>

      <BulkJobImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        customers={customers}
        setCustomers={setCustomers}
        jobs={jobs}
        setJobs={setJobs}
        employees={employees}
        settings={settings}
        toast={toast}
        ownerId={ownerId}
      />

      {/* New Job Modal */}
      <Modal open={newJobOpen} onClose={() => setNewJobOpen(false)} title="Schedule New Job" maxW="max-w-lg">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Customer</label>
            <GSel value={newJobForm.customerId} onChange={e => {
              const c = customers.find(x => x.id === e.target.value);
              setNewJobForm(f => ({ ...f, customerId: e.target.value, address: c?.address || f.address }));
            }}>
              <option value="" className="bg-black">— Select customer —</option>
              {customers.map(c => <option key={c.id} value={c.id} className="bg-black">{c.firstName} {c.lastName}</option>)}
            </GSel>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Service address</label>
            {(() => {
              const selCust = customers.find(c => c.id === newJobForm.customerId);
              const extraAddrs = selCust?.addresses || [];
              if (extraAddrs.length > 0) {
                const allAddrs = [
                  { id: "__primary__", label: "Primary", street: selCust?.address || "" },
                  ...extraAddrs.map((a: any) => ({ id: a.id, label: a.label || a.street, street: [a.street, a.city, a.state].filter(Boolean).join(", ") })),
                  { id: "__custom__", label: "Custom address…", street: "" },
                ];
                const selectedId = allAddrs.find(a => a.street === newJobForm.address)?.id || "__primary__";
                return (
                  <div className="space-y-2">
                    <GSel
                      value={selectedId}
                      onChange={e => {
                        const picked = allAddrs.find(a => a.id === e.target.value);
                        if (picked && picked.id !== "__custom__") {
                          setNewJobForm(f => ({ ...f, address: picked.street }));
                        }
                      }}
                    >
                      {allAddrs.map(a => (
                        <option key={a.id} value={a.id} className="bg-black">
                          {a.label}{a.street ? ` — ${a.street.slice(0, 40)}` : ""}
                        </option>
                      ))}
                    </GSel>
                    {selectedId === "__custom__" && (
                      <AddressAutocomplete value={newJobForm.address} onChange={v => setNewJobForm(f => ({ ...f, address: v }))} onPlaceSelect={p => setNewJobForm(f => ({ ...f, lat: p.lat, lng: p.lng }))} mapsKey={settings.googleMapsKey || settings.mapsKey || ""} placeholder="123 Main St, your area" knownAddresses={customers.map((c: any) => c.address).filter(Boolean)} />
                    )}
                  </div>
                );
              }
              return <AddressAutocomplete value={newJobForm.address} onChange={v => setNewJobForm(f => ({ ...f, address: v }))} mapsKey={settings.googleMapsKey || settings.mapsKey || ""} placeholder="123 Main St, your area" knownAddresses={customers.map((c: any) => c.address).filter(Boolean)} />;
            })()}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Date</label>
              <GDate value={newJobForm.scheduledDate} onChange={e => setNewJobForm(f => ({ ...f, scheduledDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Time (optional)</label>
              <GInput type="time" value={newJobForm.scheduledTime} onChange={e => setNewJobForm(f => ({ ...f, scheduledTime: e.target.value }))} />
            </div>
          </div>
          {/* ITEM 2 — warn if the picked time leaves less than the configured
              default buffer between this job and another already scheduled
              the same day (same crew member, if one's picked; otherwise any
              same-day job). Informational only — does not block saving. */}
          {newJobForm.scheduledDate && newJobForm.scheduledTime && (() => {
            const bufferMin = Number((settings as any)?.defaultBufferMinutes) || 30;
            const [h, m] = newJobForm.scheduledTime.split(":").map(Number);
            const startMin = h * 60 + (m || 0);
            const durMin = Math.round((Number(newJobForm.duration) || 2) * 60);
            const endMin = startMin + durMin;
            const sameDay = jobs.filter((j: any) => j.scheduledDate === newJobForm.scheduledDate && j.scheduledTime && j.status !== "cancelled");
            const conflict = sameDay.find((j: any) => {
              const [jh, jm] = j.scheduledTime.split(":").map(Number);
              const jStart = jh * 60 + (jm || 0);
              const jEnd = jStart + Math.round((Number(j.duration) || 2) * 60);
              const gap = jStart >= endMin ? jStart - endMin : startMin - jEnd;
              return gap < bufferMin;
            });
            if (!conflict) return null;
            const cName = customers.find((c: any) => c.id === conflict.customerId);
            return (
              <div className="text-[11px] text-yellow-400 bg-yellow-950/20 border border-yellow-700/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <AlertTriangle size={11} className="flex-shrink-0" />
                Less than {bufferMin} min of travel buffer before/after {cName?.firstName || "another job"}'s {conflict.scheduledTime} appointment
              </div>
            );
          })()}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Amount ($)</label>
              <GInput type="number" placeholder="0" value={newJobForm.amount} onChange={e => setNewJobForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Priority</label>
              <GSel value={newJobForm.priority} onChange={e => setNewJobForm(f => ({ ...f, priority: e.target.value }))}>
                {priorityLevels.map(p => <option key={p.key} value={p.key} className="bg-black capitalize">{p.key}</option>)}
              </GSel>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Job Type <span className="text-white/30">(drives crew pay rate overrides)</span></label>
            <GSel value={newJobForm.jobType} onChange={e => setNewJobForm(f => ({ ...f, jobType: e.target.value }))}>
              <option value="residential" className="bg-black">Residential</option>
              <option value="commercial" className="bg-black">Commercial</option>
            </GSel>
          </div>
          {/* FEATURE — commercial/night job work orders (e.g. Home Depot,
              Lowe's). Still an ordinary Job row (same portal, same crew
              assignment, same checklist/photo machinery — see docs/ARCHITECTURE.md's
              "invoices are just estimates" convention for the same pattern)
              with extra fields for the stricter commercial workflow: a real
              work order number, per-section photo/video count requirements
              the field portal enforces before Complete, and an optional
              manager digital sign-off. See migration 0094 for the columns. */}
          <div className="p-3 rounded-xl border border-white/10 bg-black/20 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!(newJobForm as any).isWorkOrder} onChange={e => setNewJobForm(f => ({ ...f, isWorkOrder: e.target.checked, jobType: e.target.checked ? "commercial" : f.jobType } as any))} className="accent-brand-600 w-3.5 h-3.5" />
              <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5"><FileText size={12} />This is a work order (commercial/night job)</span>
            </label>
            {(newJobForm as any).isWorkOrder && (
              <div className="p-3 rounded-xl border border-purple-700/30 bg-purple-950/10 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-white/50 mb-1 block">Work Order #</label>
                    <GInput placeholder="WO-4521" value={(newJobForm as any).workOrderNumber || ""} onChange={e => setNewJobForm(f => ({ ...f, workOrderNumber: e.target.value } as any))} />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 mb-1 block">Client</label>
                    <GInput placeholder="Home Depot #4521" value={(newJobForm as any).workOrderClient || ""} onChange={e => setNewJobForm(f => ({ ...f, workOrderClient: e.target.value } as any))} />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!(newJobForm as any).requiresManagerSignoff} onChange={e => setNewJobForm(f => ({ ...f, requiresManagerSignoff: e.target.checked } as any))} className="accent-purple-600 w-3.5 h-3.5" />
                  <span className="text-xs text-white/70">Requires a manager digital sign-off on completion</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!(newJobForm as any).isNightJob} onChange={e => setNewJobForm(f => ({ ...f, isNightJob: e.target.checked } as any))} className="accent-purple-600 w-3.5 h-3.5" />
                  <span className="text-xs text-white/70">Night job (shows on the Calendar's separate Night Jobs view)</span>
                </label>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] text-white/50">Required Photos/Videos</label>
                    <button
                      type="button"
                      onClick={() => setNewJobForm(f => ({ ...f, photoRequirements: [...((f as any).photoRequirements || []), { id: uid(), label: "", kind: "photo", minCount: 1, instructions: "" }] } as any))}
                      className="text-[10px] text-purple-300 hover:text-purple-200"
                    >
                      + Add requirement
                    </button>
                  </div>
                  <div className="space-y-2">
                    {((newJobForm as any).photoRequirements || []).map((req: any, i: number) => (
                      <div key={req.id} className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-lg p-1.5">
                        <GInput placeholder="Section (e.g. loading dock)" value={req.label} onChange={e => setNewJobForm(f => ({ ...f, photoRequirements: ((f as any).photoRequirements || []).map((r: any, idx: number) => idx === i ? { ...r, label: e.target.value } : r) } as any))} className="!text-xs flex-1" />
                        <GSel value={req.kind} onChange={e => setNewJobForm(f => ({ ...f, photoRequirements: ((f as any).photoRequirements || []).map((r: any, idx: number) => idx === i ? { ...r, kind: e.target.value } : r) } as any))} className="!text-xs !w-24">
                          <option value="photo" className="bg-black">Photo</option>
                          <option value="video" className="bg-black">Video</option>
                        </GSel>
                        <GInput type="number" min="1" value={req.minCount} onChange={e => setNewJobForm(f => ({ ...f, photoRequirements: ((f as any).photoRequirements || []).map((r: any, idx: number) => idx === i ? { ...r, minCount: Math.max(1, Number(e.target.value) || 1) } : r) } as any))} className="!text-xs !w-14" />
                        <button type="button" onClick={() => setNewJobForm(f => ({ ...f, photoRequirements: ((f as any).photoRequirements || []).filter((_: any, idx: number) => idx !== i) } as any))} className="text-brand-400/70 hover:text-brand-300 p-1"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-white/60 mb-1 block">Est. Duration <span className="text-white/30">(hours)</span></label>
            <GInput type="number" step="0.25" min="0" placeholder="e.g. 3.5" value={newJobForm.duration || ""} onChange={e => setNewJobForm(f => ({ ...f, duration: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Notes (optional)</label>
            <GTxt placeholder="Service details, access instructions..." value={newJobForm.notes} onChange={e => setNewJobForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
          </div>

          {/* FIX 4 — recurring schedule, available at CREATION time now, not
              just when editing an existing job afterward. Mirrors
              JobDetailModal's editor 1:1 (same recurringMode options, same
              computeNextRecurringDate preview) so the two never disagree. */}
          <div className="p-3 rounded-xl border border-white/10 bg-black/20 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={newJobForm.isRecurring} onChange={e => setNewJobForm(f => ({ ...f, isRecurring: e.target.checked }))} className="accent-brand-600 w-3.5 h-3.5" />
              <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5"><Repeat size={12} />This is a recurring job</span>
            </label>
            {newJobForm.isRecurring && (
              <div className="p-3 rounded-xl border border-blue-700/30 bg-blue-950/10 space-y-2.5">
                <GSel value={newJobForm.recurringMode} onChange={e => setNewJobForm(f => ({ ...f, recurringMode: e.target.value as any }))}>
                  <option value="preset" className="bg-black">Preset (weekly, monthly, etc.)</option>
                  <option value="days" className="bg-black">Every X days</option>
                  <option value="weeks" className="bg-black">Every X weeks</option>
                  <option value="months" className="bg-black">Every X months</option>
                  <option value="weekdays" className="bg-black">Specific days of week</option>
                </GSel>

                {(!newJobForm.recurringMode || newJobForm.recurringMode === "preset") && (
                  <GSel value={newJobForm.recurringFreq} onChange={e => setNewJobForm(f => ({ ...f, recurringFreq: e.target.value }))}>
                    {recurringFreqs.map(f => <option key={f.key} value={f.key} className="bg-black">{f.label}</option>)}
                  </GSel>
                )}

                {(newJobForm.recurringMode === "days" || newJobForm.recurringMode === "weeks" || newJobForm.recurringMode === "months") && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/50">Every</span>
                    <GInput type="number" min="1" step="1" value={newJobForm.recurringInterval || 1} onChange={e => setNewJobForm(f => ({ ...f, recurringInterval: Math.max(1, Number(e.target.value) || 1) }))} className="!w-20" />
                    <span className="text-xs text-white/50">{newJobForm.recurringMode}</span>
                  </div>
                )}

                {newJobForm.recurringMode === "weekdays" && (
                  <div className="flex flex-wrap gap-1.5">
                    {weekdayLabels.map((lbl, i) => {
                      const active = (newJobForm.recurringWeekdays || []).includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const cur = newJobForm.recurringWeekdays || [];
                            const next = active ? cur.filter((d: number) => d !== i) : [...cur, i].sort();
                            setNewJobForm(f => ({ ...f, recurringWeekdays: next }));
                          }}
                          className={"px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition " + (active ? "bg-brand-600 border-brand-500 text-brand-fg" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                )}

                {newJobForm.scheduledDate && (
                  <div className="text-[10px] text-white/40">Next occurrence after this one: {computeNextRecurringDate(newJobForm, newJobForm.scheduledDate)}</div>
                )}
              </div>
            )}
          </div>

          {/* FEATURE — "when scheduling a job, you should be able to edit
              the checklist then and there as an owner." Custom items here
              become the job's real pre-job checklist (what the field portal
              actually shows the crew) — leave it empty to keep the standard
              default checklist every job falls back to otherwise. */}
          <div>
            <label className="text-xs text-white/60 block mb-1">Checklist <span className="text-white/30">(optional — leave blank for the standard default)</span></label>
            <div className="space-y-1.5">
              {newJobForm.checklist.map((item, i) => (
                <div key={item.id} className="flex items-center gap-1.5">
                  <GInput value={item.label} onChange={e => setNewJobForm(f => ({ ...f, checklist: f.checklist.map((c, ci) => ci === i ? { ...c, label: e.target.value } : c) }))} className="flex-1 !text-xs" />
                  <button type="button" onClick={() => setNewJobForm(f => ({ ...f, checklist: f.checklist.filter((_, ci) => ci !== i) }))} className="p-1.5 rounded-lg text-white/30 hover:text-brand-400 hover:bg-brand-950/30 transition"><X size={14} /></button>
                </div>
              ))}
              <button type="button" onClick={() => setNewJobForm(f => ({ ...f, checklist: [...f.checklist, { id: uid(), label: "" }] }))} className="text-[11px] text-brand-400 hover:text-brand-300 transition">+ Add checklist item</button>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/60 block mb-1">Crew (optional, select multiple)</label>
            {/* FIX 5 — was a single-select <GSel>, so only one crew member
                could ever be picked when scheduling a job. Toggle-button pills
                (same pattern JobDetailModal already uses for editing an
                existing job's crew) let any number be selected at once, all
                saved to the job's crew array together on save. */}
            <div className="flex gap-1.5 flex-wrap">
              {employees.filter((e: any) => e.status !== "inactive").map((e: any) => {
                const sel = newJobForm.crewEmpIds.includes(e.id);
                const unavail = newJobForm.scheduledDate && isEmployeeUnavailable(e, newJobForm.scheduledDate);
                return (
                  <button key={e.id} type="button"
                    onClick={() => setNewJobForm(f => {
                      const already = f.crewEmpIds.includes(e.id);
                      // Default a newly-selected employee to "assign" — matches
                      // this control's previous default so existing behavior
                      // (pick people, they're on the crew) doesn't change for
                      // anyone who never touches the per-person toggle below.
                      if (!already) setCrewModeById(m => (m[e.id] ? m : { ...m, [e.id]: "assign" }));
                      return { ...f, crewEmpIds: already ? f.crewEmpIds.filter(id => id !== e.id) : [...f.crewEmpIds, e.id] };
                    })}
                    title={unavail ? `⚠️ ${e.firstName} is unavailable on this day. Schedule anyway?` : undefined}
                    className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-brand-900/40 border-brand-500/50 text-brand-300" : unavail ? "bg-yellow-950/20 border-yellow-700/40 text-yellow-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
                    {e.firstName} {e.lastName[0]}.{unavail ? " ⚠️" : ""}
                  </button>
                );
              })}
              {employees.filter((e: any) => e.status !== "inactive").length === 0 && <div className="text-[11px] text-white/30">No active employees yet</div>}
            </div>
            {/* FEATURE 5 — explicit warning banner, not just the pill
                annotation, so it's impossible to miss before saving. */}
            {(() => {
              const unavailNames = newJobForm.crewEmpIds
                .map(id => employees.find((e: any) => e.id === id))
                .filter((e: any) => e && newJobForm.scheduledDate && isEmployeeUnavailable(e, newJobForm.scheduledDate))
                .map((e: any) => e.firstName);
              return unavailNames.length > 0 ? (
                <div className="text-[11px] text-yellow-300 bg-yellow-950/30 border border-yellow-700/40 rounded px-2 py-1 mt-1 flex items-center gap-1">
                  ⚠️ {unavailNames.join(", ")} {unavailNames.length > 1 ? "are" : "is"} unavailable on this day. Schedule anyway?
                </div>
              ) : null;
            })()}
            {/* BLOCKER — per-employee Assign/Request, not one shared mode for
                the whole batch. Lets the owner assign one crew member directly
                while requesting another on the very same job. Each selected
                employee defaults to "assign" (set above) until toggled. */}
            {newJobForm.crewEmpIds.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {newJobForm.crewEmpIds.map(id => {
                  const emp = employees.find((e: any) => e.id === id);
                  if (!emp) return null;
                  const mode = crewModeById[id] || "assign";
                  return (
                    <div key={id} className="flex items-center justify-between gap-2 text-xs bg-black/30 border border-white/5 rounded-lg px-2.5 py-1.5">
                      <span className="text-white/70">{emp.firstName} {emp.lastName}</span>
                      <div className="flex gap-1 bg-black/40 border border-white/10 rounded-lg p-0.5">
                        <button type="button" onClick={() => setCrewModeById(m => ({ ...m, [id]: "assign" }))}
                          className={"px-2 py-1 rounded-md text-[10px] font-semibold transition " + (mode === "assign" ? "bg-brand-900/50 text-brand-300" : "text-white/40 hover:text-white/70")}>
                          Assign
                        </button>
                        <button type="button" onClick={() => setCrewModeById(m => ({ ...m, [id]: "request" }))}
                          className={"px-2 py-1 rounded-md text-[10px] font-semibold transition " + (mode === "request" ? "bg-yellow-900/50 text-yellow-300" : "text-white/40 hover:text-white/70")}>
                          Request
                        </button>
                      </div>
                    </div>
                  );
                })}
                <div className="text-[11px] text-white/30">
                  Assign adds them to the crew immediately and emails them — no response needed. Request sends a request they must accept or decline before they're on the crew.
                </div>
              </div>
            )}
            {/* FIX 4 — "Request" mode writes to job_requests with owner_id:
                ownerId; if the session bootstrap hasn't resolved it yet, warn
                up front instead of letting the owner hit save and find out via
                an error toast after the fact. */}
            {newJobForm.crewEmpIds.some(id => (crewModeById[id] || "assign") === "request") && !ownerId && (
              <div className="text-[11px] text-yellow-300 bg-yellow-950/30 border border-yellow-700/40 rounded px-2 py-1 mt-1 flex items-center gap-1">
                ⏳ Still finishing sign-in — the job will save, but wait a few seconds before requesting crew.
              </div>
            )}
            {/* FIX 10 — show each selected employee's effective pay rate for
                THIS job's type, so the owner can see at a glance whether the
                residential/commercial override applies before saving. */}
            {newJobForm.crewEmpIds.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                {newJobForm.crewEmpIds.map(id => {
                  const emp = employees.find((e: any) => e.id === id);
                  if (!emp) return null;
                  const rate = getEffectiveRate(emp, { jobType: newJobForm.jobType });
                  const hasOverride = (emp as any).jobTypeRates?.[newJobForm.jobType] != null;
                  return (
                    <div key={id} className="text-[11px] text-green-400/80 flex items-center gap-1">
                      <DollarSign size={10} />{emp.firstName}'s {newJobForm.jobType} rate: {fmt(rate)}/hr{hasOverride ? " (override)" : " (default)"}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <GBtn variant="ghost" onClick={() => setNewJobOpen(false)}>Cancel</GBtn>
            <GBtn onClick={async () => {
              if (newJobSubmittingRef.current) return;
              if (!newJobForm.customerId) { toast("Select a customer", "error"); return; }
              if (!newJobForm.scheduledDate) { toast("Enter a date", "error"); return; }
              newJobSubmittingRef.current = true;
              setTimeout(() => { newJobSubmittingRef.current = false; }, 4000);
              // BLOCKER — assignedEmps now splits per-employee by crewModeById
              // instead of one shared mode for the whole batch, so "assign
              // Alice, request Bob" on the same job is possible, and an owner
              // who only meant to assign can no longer have someone silently
              // land in job_requests instead because a single toggle applied
              // to everyone.
              const assignedEmps = newJobForm.crewEmpIds.map(id => employees.find((e: any) => e.id === id)).filter(Boolean) as any[];
              const directAssignEmps = assignedEmps.filter(e => (crewModeById[e.id] || "assign") === "assign");
              const requestEmps = assignedEmps.filter(e => (crewModeById[e.id] || "assign") === "request");
              const job = {
                id: uid(), customerId: newJobForm.customerId,
                address: newJobForm.address || customers.find(c => c.id === newJobForm.customerId)?.address || "",
                ...(typeof newJobForm.lat === "number" && typeof newJobForm.lng === "number" ? { lat: newJobForm.lat, lng: newJobForm.lng } : {}),
                amount: parseFloat(newJobForm.amount) || 0,
                status: "scheduled" as const,
                scheduledDate: newJobForm.scheduledDate,
                scheduledTime: newJobForm.scheduledTime,
                priority: newJobForm.priority as any,
                jobType: newJobForm.jobType as any,
                notes: newJobForm.notes,
                duration: newJobForm.duration ? Number(newJobForm.duration) : undefined,
                crew: directAssignEmps.map(e => e.id), checklist: [], photos: [], commLog: [], chemicalsUsed: [], equipment: [], tags: [],
                // FEATURE — custom checklist items entered at scheduling
                // time become the job's real preChecklist (what the field
                // portal shows) — empty when the owner left it blank, so
                // every existing fallback-to-standard-defaults behavior
                // elsewhere (JobDetailModal, EmployeePortal) is unaffected.
                ...(newJobForm.checklist.filter(c => c.label.trim()).length > 0
                  ? { preChecklist: newJobForm.checklist.filter(c => c.label.trim()).map(c => ({ id: c.id, label: c.label.trim(), done: false })) }
                  : {}),
                loggedHours: 0, createdAt: today(), owner_id: ownerId,
                // REVERTED — organizationId here caused the App.tsx 30s bulk
                // autosave to fail for every job ("Could not find the
                // organizationId column of jobs in the schema cache") once
                // any job carrying this field entered React state — that
                // autosave upserts the full in-memory job object and doesn't
                // know to strip this field. The column genuinely doesn't
                // exist on this deployment; do not re-add without confirming
                // otherwise (see AlfredPage.tsx's matching revert).
                ...(directAssignEmps.length > 0 ? { crewAssignedAt: Object.fromEntries(directAssignEmps.map(e => [e.id, Date.now()])) } : {}),
                ...(newJobForm.isRecurring ? {
                  isRecurring: true,
                  recurringMode: newJobForm.recurringMode,
                  recurringFreq: newJobForm.recurringFreq,
                  recurringInterval: newJobForm.recurringInterval,
                  recurringWeekdays: newJobForm.recurringWeekdays,
                } : {}),
                // FEATURE — commercial/night job work orders (migration 0094).
                ...((newJobForm as any).isWorkOrder ? {
                  isWorkOrder: true,
                  isNightJob: !!(newJobForm as any).isNightJob,
                  workOrderNumber: (newJobForm as any).workOrderNumber || "",
                  workOrderClient: (newJobForm as any).workOrderClient || "",
                  requiresManagerSignoff: !!(newJobForm as any).requiresManagerSignoff,
                  photoRequirements: ((newJobForm as any).photoRequirements || []).filter((r: any) => r.label.trim()),
                } : {}),
              };
              if (job.isRecurring) console.log("[Verify] recurring jobs with custom schedules — working — mode:", job.recurringMode);
              console.log("[CrewFlow] scheduling job — assigned:", directAssignEmps.map(e => e.firstName), "requested:", requestEmps.map(e => e.firstName), "crew field on insert:", job.crew);
              setJobs(prev => [...prev, job]);
              // Close the modal immediately — none of the follow-up work below
              // (Google Calendar, crew email/request) should be able to block
              // the UI if a network call hangs.
              setNewJobOpen(false);
              setNewJobForm(f => ({ ...f, crewEmpIds: [], lat: undefined, lng: undefined }));
              setCrewModeById({});
              toast("Job scheduled for " + newJobForm.scheduledDate);
              // A brand-new job previously only reached Supabase via the
              // 30s app-level auto-save batch — the employee's portal polls
              // Supabase directly every 3s, so a same-day crew assignment
              // looked like it "did nothing" for up to 30s. Insert it
              // immediately instead, and verify with a re-fetch so a failed
              // write surfaces as a visible error rather than silent data loss.
              (async () => {
                console.log("[Recurring] saving new job", job.id, "isRecurring:", (job as any).isRecurring, "crew:", job.crew);
                // BLOCKER — this whole IIFE previously had no try/catch. A
                // genuine network hang makes withTimeout's race REJECT (not
                // resolve with {error}), which threw straight out of this
                // async function with nothing to catch it — an unhandled
                // promise rejection that only ever showed up as "Error: Save
                // job timed out" in the console, never a toast, and never
                // attempted the safe-column retry below. The job stayed in
                // local state only and the employee portal (which reads jobs
                // straight from Supabase) never saw it — exactly the "jobs
                // don't show up" symptom. Every path out of this function
                // must now end in either a success log or a toast.
                try {
                  const { error } = await withTimeout<any>((supabase as any).from("jobs").insert(job), 30000, "Save job");
                  if (error) {
                    // FIX G — recurring jobs add isRecurring/recurringMode/
                    // recurringFreq/recurringInterval/recurringWeekdays columns
                    // (migration 0007) on top of the normal job payload. If that
                    // migration hasn't been run yet, PostgREST rejects the WHOLE
                    // insert (not just those columns) — so the job never reached
                    // Supabase at all, and the employee portal (which reads jobs
                    // straight from Supabase) never saw it, even though the
                    // owner's own screen showed "Job scheduled" from the
                    // optimistic local state above. Retry with those columns
                    // stripped so the job (and its crew) still lands.
                    console.error("[Recurring] new job insert failed:", error.message, "— retrying without recurring-schedule columns");
                    const { isRecurring, recurringMode, recurringFreq, recurringInterval, recurringWeekdays, ...coreJob } = job as any;
                    const retry = await withTimeout<any>((supabase as any).from("jobs").insert(coreJob), 30000, "Save job (retry)");
                    if (retry?.error) {
                      console.error("[Recurring] core-column retry also failed:", retry.error.message);
                      toast?.("Job created locally, but failed to save to the server — " + retry.error.message, "red");
                    } else if ((job as any).isRecurring) {
                      console.warn("[Recurring] job saved without its recurring-schedule columns — run supabase/migrations/0007_custom_recurring_schedule_columns.sql to enable auto-scheduling.");
                      toast?.("Job saved, but recurring schedule couldn't be saved — ask your admin to run the pending database migration.", "yellow");
                    }
                  } else {
                    console.log("[Recurring] new job saved to Supabase ✓", job.id);
                  }
                  // No verify SELECT round-trip — it needs a SELECT RLS policy
                  // that may be absent, and would otherwise spuriously warn on a
                  // save that actually succeeded. The 3s cross-device poll will
                  // reconcile local state with the server on its own.
                } catch (e: any) {
                  console.error("[Recurring] new job insert threw:", e?.message);
                  if (!String(e?.message || "").includes("timed out")) {
                    toast?.("Job created locally, but failed to save to the server — " + (e?.message || "connection issue, please retry"), "red");
                    return;
                  }
                  // A timeout means the CLIENT gave up waiting, not that the write
                  // failed server-side — under real Supabase slowness the original
                  // insert can still land seconds later. job.id is client-generated
                  // (uid()), so retrying is safe: a duplicate-key response on the
                  // retry means the first attempt actually went through.
                  console.warn("[Recurring] insert timed out — retrying once (Supabase may be slow or over its usage quota)");
                  const { error: retryErr } = await insertClientIdRowWithRetry("jobs", job).catch((e2: any) => ({ error: e2 }));
                  if (retryErr) {
                    console.error("[Recurring] job insert still failing after retry:", retryErr?.message);
                    toast?.("Job created locally, but Supabase isn't responding — check your Supabase dashboard for a usage/restriction warning, then try again", "red");
                  } else {
                    console.log("[Recurring] job saved on retry ✓", job.id);
                  }
                }
              })();
              // Create Google Calendar event if Google is connected
              // FIX 9 — only auto-create the calendar event when auto-sync is on
              // (defaults to on for backward compatibility).
              // BUG FIX — (settings as any).googleToken is never populated by
              // anything in this app (see getFreshOwnerGoogleToken in
              // lib/messaging.ts) so this create silently never fired; every
              // job created here should already have shown up on the owner's
              // Google Calendar and never did.
              if (((settings as any)?.autoSyncCalendar ?? true) && settings?.googleConnected && job.scheduledDate) {
                const c = customers.find(x => x.id === job.customerId);
                const startDt = new Date(job.scheduledDate + "T" + (job.scheduledTime || "09:00") + ":00");
                const endDt = new Date(startDt.getTime() + 2 * 60 * 60 * 1000);
                // FEATURE — "clickable link to the employee portal, or if
                // it's an owner working, to the owner job." Same crew-based
                // pick as JobDetailModal's handleGoogleSync.
                const hasEmployeeCrewNew = directAssignEmps.some((e: any) => e.role !== "owner");
                const calDescription = hasEmployeeCrewNew
                  ? buildJobCalendarDescription(job, c, `${window.location.origin}${window.location.pathname}#/portal?job=${encodeURIComponent(job.id)}`, "View job in Crew Portal")
                  : buildJobCalendarDescription(job, c, `${window.location.origin}${window.location.pathname}#/jobs?open=${encodeURIComponent(job.id)}`);
                getFreshOwnerGoogleToken(settings as any).then(token => {
                  if (!token) return null;
                  return createGCalEvent(token, {
                    title: (c ? c.firstName + " " + c.lastName + " — " : "") + "Service",
                    start: startDt.toISOString(),
                    end: endDt.toISOString(),
                    location: job.address || "",
                    description: calDescription,
                  });
                }).then(eventId => {
                  if (eventId) setJobs(prev => prev.map(j => j.id === job.id ? { ...j, googleEventId: eventId } : j));
                  else console.warn("[Calendar] auto-sync on new job produced no event id — token refresh or the create call likely failed silently upstream");
                }).catch((e: any) => {
                  // BUG FIX — "jobs still aren't automatically syncing to
                  // Google Calendar." This swallowed every failure with no
                  // trace at all — a stale/revoked Google token, a Calendar
                  // API error, anything — so the job just silently never
                  // showed up on the calendar with no way to tell why. Now
                  // logs the real reason and tells the owner, instead of
                  // failing invisibly forever.
                  console.error("[Calendar] auto-sync failed on new job:", e?.message || e);
                  toast?.("Job saved, but Google Calendar sync failed — " + (e?.message || "check your Google connection in Settings"), "red");
                });
              }
              // Notify each selected crew member — assigned (no response needed) or requested (accept/decline).
              // BLOCKER — split into the two per-employee lists computed above
              // instead of branching a single shared `directAssign` inside the
              // loop, so "assign Alice, request Bob" sends the right email to
              // the right person instead of applying one mode to everyone.
              const cust = customers.find(c => c.id === job.customerId);
              const custLine = cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : "";
              for (const assignedEmp of directAssignEmps) {
                if (!assignedEmp?.email) continue;
                const portalLink = `${window.location.origin}${window.location.pathname}#/portal`;
                const html = emailShell(settings,"Job Assignment", `<p>Hi ${assignedEmp.firstName},</p><p>You've been assigned to a new job:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${custLine}</ul>` + emailButton("Open Crew Portal", portalLink));
                withTimeout(sendEmail(settings, { to: assignedEmp.email, subject: `You've Been Assigned — ${job.scheduledDate}`, body: html }), 8000, "Email send").catch((e: any) => { console.warn("Assignment email failed — job still assigned:", e?.message); toast?.(`Assigned ${assignedEmp.firstName}, but the notification email failed to send`, "red"); });
              }
              for (const assignedEmp of requestEmps) {
                if (!assignedEmp?.email) continue;
                (async () => {
                  try {
                    console.log("[CrewRequest] ownerId at request time:", ownerId || "(empty)", "employee:", assignedEmp.firstName);
                    if (!ownerId) {
                      console.warn("[CrewRequest] blocked — ownerId still empty (session bootstrap not resolved yet)");
                      toast?.(`Job saved, but the request to ${assignedEmp.firstName} failed — still finishing sign-in, try again in a moment`, "red");
                      return;
                    }
                    const { data, error } = await insertJobRequestSafely({
                      job_id: job.id, employee_id: assignedEmp.id, owner_id: ownerId, status: "pending",
                    });
                    if (error || !data?.id) {
                      console.error("Failed to create job_request:", error);
                      toast?.(`Job saved, but the request to ${assignedEmp.firstName} failed — ` + (error?.message || "run the job_requests SQL in Supabase first"), "red");
                      return;
                    }
                    const reqUrl = `${window.location.origin}${window.location.pathname}#/portal?request=${data.id}`;
                    const html = emailShell(settings,"Job Request", `<p>Hi ${assignedEmp.firstName},</p><p>You have a new job request:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${custLine}</ul><div style="text-align:center;margin:22px 0 4px"><a href="${reqUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;margin-right:8px">✓ Accept Job</a><a href="${reqUrl}&action=deny" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px">✗ Decline</a></div>`);
                    withTimeout(sendEmail(settings, { to: assignedEmp.email, subject: `Job Request — ${job.scheduledDate}`, body: html }), 8000, "Email send").catch((e: any) => console.warn("Job request email failed — request still saved:", e?.message));
                  } catch (e: any) {
                    console.error("Crew request failed:", e);
                    toast?.(`Job saved, but the request to ${assignedEmp.firstName} failed — ` + (e?.message || "try again"), "red");
                  }
                })();
              }
            }}>Schedule Job</GBtn>
          </div>
        </div>
      </Modal>

      {/* Bulk action bar */}
      {bulkSelected.length > 0 && <Glass className="p-3 !bg-purple-950/30 !border-purple-600/40 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-purple-300">{bulkSelected.length} selected</span>
        <div className="flex gap-2 flex-wrap">
          {["scheduled", "in_progress", "completed", "cancelled"].map(s => <GBtn key={s} onClick={() => { setJobs(jobs.map(j => bulkSelected.includes(j.id) ? { ...j, status: s } : j)); setBulkSelected([]); toast("Updated " + bulkSelected.length + " jobs"); }} variant="ghost" className="!text-xs capitalize">{s.replace("_", " ")}</GBtn>)}
          <button onClick={async () => {
            let sent = 0, failed = 0;
            for (const jid of bulkSelected) {
              const j = jobs.find(x => x.id === jid);
              const c = customers.find(x => x.id === j?.customerId);
              if (!c?.phone) continue;
              const coName = (settings as any)?.companyName || "CRM Starter";
              const coPhone = (settings as any)?.companyPhone || "(555) 555-0100";
              const msg = "Hi " + c.firstName + ", reminder about your scheduled service on " + (j?.scheduledDate || "your upcoming date") + ". Questions? Call " + coPhone + " — " + coName;
              try {
                if (settings?.twilioSid) { await twilioSend(settings, c.phone, msg); logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {}); sent++; }
                else { window.location.href = "sms:" + c.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(msg); sent++; break; }
              } catch { failed++; }
            }
            setBulkSelected([]);
            toast("Reminders sent: " + sent + (failed > 0 ? " · " + failed + " failed" : ""));
          }} className="px-3 py-1.5 rounded-lg text-[11px] bg-blue-950/40 border border-blue-700/40 text-blue-300 hover:bg-blue-900/50"><Send size={11} className="inline mr-1" />Remind all</button>
          {/* FEATURE 5 (mobile round 7) — Download/Delete Selected were missing;
              only status-change bulk actions existed. */}
          <button onClick={() => {
            const rows = [["Address", "Customer", "Status", "Scheduled Date", "Amount"]];
            jobs.filter(j => bulkSelected.includes(j.id)).forEach(j => {
              const c = customers.find(x => x.id === j.customerId);
              rows.push([j.address || "", c ? `${c.firstName} ${c.lastName}` : "", j.status || "", j.scheduledDate || "", String(j.amount ?? "")]);
            });
            const csv = rows.map(r => r.map(v => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "jobs-selected-" + today() + ".csv";
            a.click();
            URL.revokeObjectURL(a.href);
            toast(`Downloaded ${bulkSelected.length} job${bulkSelected.length !== 1 ? "s" : ""}`);
          }} className="px-3 py-1.5 rounded-lg text-[11px] bg-black/40 border border-white/10 text-white/60 hover:text-white"><Download size={11} className="inline mr-1" />Download</button>
          <button onClick={() => {
            if (!window.confirm(`Permanently delete ${bulkSelected.length} job${bulkSelected.length !== 1 ? "s" : ""}? This can't be undone.`)) return;
            const ids = [...bulkSelected];
            setJobs(jobs.filter(j => !ids.includes(j.id)));
            markRecentlyDeleted("jobs", ids);
            setBulkSelected([]);
            // BUG FIX (audit finding) — no .select("id")/count check meant an
            // RLS-scoped partial (or total) 0-row match still showed "N
            // job(s) deleted" for the full requested count.
            deleteByIds("jobs", ids)
              .then(r => {
                if (r.deleted.length === 0) toast("Deleted locally, but the server rejected the change" + (r.error ? " — " + r.error : ""), "red");
                else if (r.failed) toast(`Only ${r.deleted.length} of ${ids.length} jobs actually deleted on the server`, "red");
                else toast(ids.length + " job(s) deleted");
              })
              .catch((e: any) => toast("Deleted locally, but failed to delete from server — " + (e?.message || ""), "red"));
          }} className="px-3 py-1.5 rounded-lg text-[11px] bg-danger-950/40 border border-danger-700/40 text-danger-300 hover:bg-danger-900/50"><Trash2 size={11} className="inline mr-1" />Delete</button>
          <button onClick={() => setBulkSelected([])} className="px-3 py-1.5 rounded-lg text-[11px] bg-white/5 border border-white/10 text-white/60"><X size={11} className="inline mr-1" />Deselect</button>
        </div>
      </Glass>}

      {/* FIX 6 — Unscheduled jobs (accepted quotes with no date yet, tagged
          "Needs Scheduling" when the estimate was approved) need a place the
          owner will actually see and act on them, not buried in the Scheduled
          tab looking like a normal job with a blank date. Now lives under
          the "Unscheduled" tab itself (see tabs object above) rather than as
          a banner above the tab bar. */}
      {tab === "unscheduled" && (() => {
        const unscheduled = filtered;
        if (unscheduled.length === 0) {
          return (
            <Glass className="p-8 text-center text-sm text-white/40">
              <Calendar size={24} className="mx-auto mb-2 text-white/15" />
              No unscheduled jobs right now — accepted quotes with no date yet will show up here.
            </Glass>
          );
        }
        return (
          <Glass className="p-4 !bg-purple-950/15 !border-purple-600/40">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={15} className="text-purple-400" />
              <h3 className="font-semibold text-sm">Unscheduled — Needs a Date</h3>
              <Badge tone="yellow">{unscheduled.length}</Badge>
            </div>
            <div className="space-y-2">
              {unscheduled.map(j => {
                const c = customers.find(x => x.id === j.customerId);
                const isScheduling = schedulingJobId === j.id;
                return (
                  <div key={j.id} data-job-id={j.id} className={"p-3 rounded-xl bg-black/30 border border-purple-700/30" + (highlightId === j.id ? " ring-2 ring-brand-500 shadow-[0_0_25px_rgba(255,255,255,0.65)]" : "")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate flex items-center gap-1.5">
                          {c ? `${c.firstName} ${c.lastName}` : j.address}
                          {j.needsReschedule && <Badge tone="yellow">Needs Reschedule</Badge>}
                        </div>
                        <div className="text-xs text-white/40 truncate">{j.address} · {fmt(j.amount)}{j.notes ? ` · ${j.notes}` : ""}{j.needsReschedule && j.scheduledDate ? ` · crew picked ${j.scheduledDate}` : ""}</div>
                      </div>
                      {!isScheduling && (
                        <GBtn onClick={() => { setSchedulingJobId(j.id); setScheduleDate(j.scheduledDate || today()); setScheduleTime(j.scheduledTime || ""); }} className="!text-xs !py-1.5 flex-shrink-0">
                          <Calendar size={12} className="inline mr-1" />{j.needsReschedule ? "Confirm Date" : "Schedule"}
                        </GBtn>
                      )}
                    </div>
                    {isScheduling && (
                      <div className="mt-3 flex items-end gap-2 flex-wrap">
                        <div className="flex-1 min-w-[130px]">
                          <label className="text-[10px] text-white/50 block mb-1">Date</label>
                          <GDate value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className="!py-1.5 !text-xs" />
                        </div>
                        <div className="flex-1 min-w-[110px]">
                          <label className="text-[10px] text-white/50 block mb-1">Time (optional)</label>
                          <GInput type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className="!py-1.5 !text-xs" />
                        </div>
                        <GBtn
                          disabled={!scheduleDate}
                          onClick={() => {
                            updateJob(j.id, { scheduledDate: scheduleDate, scheduledTime: scheduleTime, needsReschedule: false, tags: (j.tags || []).filter((t: string) => t !== "Needs Scheduling") });
                            toast(`Scheduled for ${scheduleDate}${scheduleTime ? " at " + scheduleTime : ""} ✓`, "green");
                            setSchedulingJobId(null);
                          }}
                          className="!text-xs !py-1.5"
                        >
                          Confirm
                        </GBtn>
                        <button onClick={() => setSchedulingJobId(null)} className="text-xs text-white/30 hover:text-white/60 px-2 py-1.5">Cancel</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Glass>
        );
      })()}

      {/* Weather risk alert — scheduled jobs in next 7 days with rain/wind/freeze */}
      {(() => {
        const atRisk = jobs
          .filter(j => j.status === "scheduled" && weatherRisk(j.scheduledDate))
          .map(j => ({ job: j, risk: weatherRisk(j.scheduledDate) }));
        if (atRisk.length === 0) return null;
        return <Glass className="p-4 !bg-gradient-to-br !from-blue-950/30 !to-black/60 !border-blue-600/40">
          <div className="flex items-center gap-2 mb-3">
            <Cloud size={16} className="text-blue-400" />
            <h3 className="font-semibold text-sm text-blue-300">Weather Risk — {atRisk.length} job{atRisk.length > 1 ? "s" : ""}</h3>
          </div>
          <div className="space-y-1.5">
            {atRisk.slice(0, 4).map(({ job: rj, risk }) => {
              const c = customers.find(x => x.id === rj.customerId);
              return <div key={rj.id} className="flex items-center gap-3 p-2 bg-black/40 rounded-lg text-xs">
                <span className="text-lg">{risk.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c?.firstName} {c?.lastName} · {rj.scheduledDate}</div>
                  <div className="text-[10px] text-white/50 truncate">{risk.reason} forecast</div>
                </div>
                <button onClick={() => { updateJob(rj.id, { scheduledDate: "" }); toast("Moved to unscheduled — reschedule from Calendar"); }} className="px-2 py-1 rounded-lg text-[10px] bg-blue-900/40 hover:bg-blue-800/50 text-blue-300 border border-blue-700/40 whitespace-nowrap">Reschedule</button>
                <button onClick={async () => {
                  if (!c?.phone) { toast("No phone number for " + c?.firstName, "error"); return; }
                  const msg = "Hi " + c.firstName + ", we have rain forecast for your service on " + rj.scheduledDate + ". Would you like to reschedule? What day works for you? — " + ((settings as any)?.companyName || "CRM Starter");
                  if (settings?.twilioSid) { try { await twilioSend(settings, c.phone, msg); logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {}); toast("Weather reschedule text sent to " + c.firstName + " ✓"); } catch(e) { toast(e.message, "error"); } }
                  else { window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg); }
                }} className="px-2 py-1 rounded-lg text-[10px] bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 whitespace-nowrap">Text customer</button>
              </div>;
            })}
            {atRisk.length > 4 && <div className="text-[10px] text-white/40 text-center pt-1">+{atRisk.length - 4} more at risk</div>}
          </div>
        </Glass>;
      })()}

      {/* Page header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-1">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <div className="text-xs text-white/40 mt-0.5">{jobs.filter(j => j.status === "scheduled").length} scheduled · {jobs.filter(j => j.status === "in_progress").length} in progress</div>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setBulkImportOpen(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-black/40 border border-white/10 rounded-2xl text-sm font-semibold text-white/70 hover:text-white hover:border-white/20 transition-all"
          >
            📋 Bulk Import
          </button>
          <button
            onClick={() => { setNewJobForm(emptyNewJobForm()); setNewJobOpen(true); }}
            className="flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 px-4 py-2.5 bg-brand-600 border border-brand-500/50 rounded-2xl text-sm font-semibold text-brand-fg shadow-lg shadow-brand-900/30 hover:shadow-brand-600/40 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={16} />Schedule Job
          </button>
        </div>
      </div>

      {/* FIX 3 — these tabs were already overflow-x-auto + whitespace-nowrap,
          but the buttons had no explicit flex-shrink-0/min-width, so on some
          mobile renderers they got squeezed narrower than their text instead
          of triggering the scroll, and the nowrap label spilled into the
          next tab (looked like "overlap"). Locking flex-shrink to 0 and
          giving each a floor width fixes that regardless of engine quirks,
          and the outer -mx-3 px-3 lets the scroll area bleed to the true
          screen edge while keeping the first/last tab clear of it. */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0">
        {Object.entries(tabs).map(([k, l]) => {
          const cnt = k === "unscheduled" ? jobs.filter(isUnscheduled).length : jobs.filter(j => j.status === k).length;
          const a = tab === k;
          return <button key={k} onClick={() => setTab(k)} className={"flex-shrink-0 min-w-[92px] text-center px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border " + (a ? "bg-brand-600 text-brand-fg border-brand-500/50" : "bg-black/40 text-white/60 hover:text-white border-brand-900/30")}>{l} ({cnt})</button>;
        })}
      </div>

      {/* BUG FIX — "there are two buttons that say Schedule Job. There
          should only be the one in the top right." Removed the duplicate
          that used to sit here in the search/filter row. */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <GInput placeholder="Search customer, address, tag..." value={search} onChange={e => setSearch(e.target.value)} className="!pl-9 !py-1.5 !text-xs" />
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-white/40 uppercase tracking-wider mr-1">Priority:</span>
          {["all", ...priorityLevels.map(p => p.key)].map(p => <button key={p} onClick={() => setPrioFilter(p)} className={"px-2.5 py-1 rounded-lg text-[11px] transition border capitalize " + (prioFilter === p ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>{p}</button>)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/40 uppercase tracking-wider">Sort:</span>
          <GSel value={sortBy} onChange={e => setSortBy(e.target.value)} className="!text-xs !py-1.5 !w-44">
            <option value="date_desc" className="bg-black">{tab === "completed" ? "Recently Completed" : tab === "cancelled" ? "Recently Cancelled" : "Recently Scheduled"}</option>
            <option value="date_asc" className="bg-black">Date (Oldest)</option>
            <option value="amount_desc" className="bg-black">Amount (Highest)</option>
            <option value="amount_asc" className="bg-black">Amount (Lowest)</option>
            <option value="priority" className="bg-black">Priority (Urgent First)</option>
            <option value="status" className="bg-black">Status</option>
          </GSel>
        </div>
        <GBtn onClick={() => setRouteOpen(true)} variant="ghost" className="!text-xs !py-1.5"><Navigation size={12} className="inline mr-1.5" />Route ({todayScheduled.length})</GBtn>
        <button onClick={() => { const all = filtered.map(j => j.id); setBulkSelected(bulkSelected.length === all.length ? [] : all); }} className="px-2.5 py-1.5 rounded-lg text-[11px] border border-brand-900/30 bg-black/40 text-white/60 hover:text-white flex items-center gap-1">
          <CheckSquare size={11} />{bulkSelected.length === filtered.length && filtered.length > 0 ? "Deselect all" : "Select all"}
        </button>
      </div>

      {/* The owner clocks in for the DAY, not per job (see OwnerShiftBar). */}
      <OwnerShiftBar ownerEmp={ownerEmp} toast={toast} onChange={setOwnerClockOverride} />

      {tab !== "unscheduled" && <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(j => {
          const c = customers.find(x => x.id === j.customerId);
          const dn = (j.checklist || []).filter(x => x.done).length;
          const crewNames = (j.crew || []).map(id => employees.find(e => e.id === id)).filter(Boolean);
          const jobCost = (Number(j.laborCost) || 0) + (Number(j.materialCost) || 0) + ((j.chemicalsUsed || []).reduce((s, ch) => s + Number(ch.cost), 0));
          const jobMargin = j.amount > 0 && jobCost > 0 ? Math.round(((j.amount - jobCost) / j.amount) * 100) : null;
          const isBulkSel = bulkSelected.includes(j.id);
          const working = isOwnerWorkingOn(j);
          const onCrew = !!ownerEmp && crewIncludesEmployee(j.crew, ownerEmp.id, ownerEmp.user_id);
          const ckTotal = (j.checklist || []).length;
          return (
            <Glass key={j.id} data-job-id={j.id} onClick={(e: any) => { if (!(e.target as HTMLElement).closest("button,a,input,select,textarea,label")) setDetailId(j.id); }} className={"p-5 transition-all relative overflow-hidden cursor-pointer " + (working ? "!border-green-600/50 " : "") + (isBulkSel ? "!border-purple-500/60 !bg-purple-950/10" : j.noShow ? "border-brand-500/60 bg-brand-950/20" : "hover:border-brand-600/50") + (highlightId === j.id ? " ring-2 ring-brand-500 shadow-[0_0_25px_rgba(var(--brand-rgb, 220,38,38),0.65)]" : "")} onTouchStart={e => handleTouchStart(j.id, e)} onTouchEnd={e => handleTouchEnd(j.id, e, j)}>
              {/* Priority stripe */}
              {j.priority && j.priority !== "normal" && <div className={"absolute top-0 left-0 w-1 h-full " + (priorityLevels.find(p => p.key === j.priority)?.color || "bg-gray-600")} />}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <input type="checkbox" checked={isBulkSel} onChange={() => setBulkSelected(prev => prev.includes(j.id) ? prev.filter(x => x !== j.id) : [...prev, j.id])} className="mt-1.5 w-3.5 h-3.5 rounded accent-purple-500 flex-shrink-0 cursor-pointer" />
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold">{c?.firstName} {c?.lastName}</div>
                    {working && <Badge tone="green">You're on this job</Badge>}
                    {j.priority && j.priority !== "normal" && <Badge tone={priorityLevels.find(p => p.key === j.priority)?.tone}>{j.priority}</Badge>}
                    {j.noShow && <Badge tone="red">No-show</Badge>}
                    {j.isRecurring && <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400 bg-blue-900/20 border border-blue-800/30 px-2 py-0.5 rounded-full"><Repeat size={8} />{describeRecurringSchedule(j)}</span>}
                    {j.cancelReason && j.status === "cancelled" && <span className="text-[9px] text-brand-400 bg-brand-950/40 border border-brand-800/30 px-2 py-0.5 rounded-full">{j.cancelReason}</span>}
                    {(j.tags || []).map(t => <span key={t} className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white/70">{t}</span>)}
                    {(() => { const wr = weatherRisk(j.scheduledDate); return wr && j.status === "scheduled" ? <span className={"inline-flex items-center gap-0.5 text-[9px] px-2 py-0.5 rounded-full border " + (wr.level === "high" ? "bg-brand-950/40 border-brand-700/50 text-brand-300" : "bg-yellow-950/30 border-yellow-700/40 text-yellow-300")} title={"Weather risk: " + wr.reason}>{wr.icon}{wr.reason}</span> : null; })()}
                  </div>
                  <div className="text-xs text-white/50 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} />
                    <span className="truncate">{j.address}</span>
                    <button onClick={() => {
                      const addr = encodeURIComponent(j.address || "");
                      // Use Apple Maps on iOS, Google Maps elsewhere
                      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                      const url = isIOS ? "maps://maps.apple.com/?daddr=" + addr : "https://maps.google.com/?daddr=" + addr;
                      window.open(url, "_blank");
                    }} className="text-brand-400 ml-1" title="Get directions"><MapPin size={10} /></button>
                  </div>
                  {j.duration && <div className="text-xs text-white/50 mt-0.5 flex items-center gap-1"><Clock size={10} />{j.duration}h est.{j.loggedHours > 0 ? " · " + j.loggedHours + "h logged" : ""}{j.clockInAt ? " · ⏱ running" : ""}</div>}
                  {working && (j.attachments || []).length > 0 && <div className="text-xs text-white/50 mt-0.5 flex items-center gap-1"><FileText size={10} />{j.attachments.length} attachment{j.attachments.length > 1 ? "s" : ""}</div>}
                  {/* FIX 7 (mobile round 6) — employee-uploaded photos/videos
                      had no visibility from this list at all; owner only
                      ever saw them by opening the job's detail modal. */}
                  {(() => {
                    // BLOCKER 12 (mobile round 7) — was (j.photos||[]).length
                    // only, missing photos taken via the per-checklist-item
                    // camera button (nested on pre/during/postChecklist
                    // items) — the more common capture path, per the default
                    // checklist copy ("Take photos of existing damage",
                    // "Take after photos"). totalJobPhotoCount aggregates both.
                    const photoCount = totalJobPhotoCount(j);
                    const videoCount = (j.videos || []).length;
                    if (!working || (photoCount === 0 && videoCount === 0)) return null;
                    return (
                      <div className="text-xs text-white/50 mt-0.5 flex items-center gap-1">
                        <ImageIcon size={10} />
                        {photoCount > 0 ? `${photoCount} photo${photoCount > 1 ? "s" : ""}` : ""}
                        {photoCount > 0 && videoCount > 0 ? " · " : ""}
                        {videoCount > 0 ? `${videoCount} video${videoCount > 1 ? "s" : ""}` : ""}
                      </div>
                    );
                  })()}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-brand-400">{fmt(j.amount)}</div>
                  {j.scheduledDate ? <div className="text-xs text-white/50">{j.scheduledDate}</div> : <div className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-600/50 text-amber-300 font-medium inline-block mt-0.5">Needs Scheduling</div>}
                  {j.isCash && <div className="text-[10px] text-green-400 font-semibold mt-0.5">💵 Cash</div>}
                  {jobMargin !== null && <div className={"text-[10px] font-semibold mt-0.5 " + (jobMargin >= 60 ? "text-green-400" : jobMargin >= 40 ? "text-yellow-400" : "text-brand-400")}>{jobMargin}% margin</div>}
                </div>
              </div>

              <div className="mb-1 flex items-center gap-2 flex-wrap text-xs">
                <span className="text-white/40 uppercase tracking-wider text-[10px]">Crew:</span>
                {crewNames.length > 0 ? crewNames.map(e => (
                  <span key={e.id} className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full bg-brand-900/30 border border-brand-800/40 text-brand-300">
                    <span className="w-4 h-4 rounded-full bg-brand-600 flex items-center justify-center text-[8px] font-bold text-brand-fg flex-shrink-0">{e.firstName[0]}{e.lastName?.[0] || ""}</span>
                    {e.firstName}
                  </span>
                )) : (
                  <button onClick={() => { setQuickReqJobId(j.id); setQuickReqEmpId(""); setQuickReqMsg(""); }}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-yellow-950/30 border border-yellow-700/40 text-yellow-400 hover:bg-yellow-900/40 transition">
                    <Send size={8} />Request Crew
                  </button>
                )}
                {j.paymentStatus && (
                  <span className={"ml-auto inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full border font-semibold " + (j.paymentStatus === "Paid" ? "bg-green-950/40 border-green-700/50 text-green-300" : j.paymentStatus === "Partial" ? "bg-yellow-950/40 border-yellow-700/50 text-yellow-300" : "bg-white/5 border-white/10 text-white/50")}>
                    {j.paymentStatus === "Paid" ? "✓" : j.paymentStatus === "Partial" ? "½" : "○"} {j.paymentStatus}{j.paymentType ? " · " + j.paymentType : ""}
                  </span>
                )}
              </div>
              {/* Quick crew request form */}
              {quickReqJobId === j.id && (
                <div className="mb-3 p-3 rounded-xl bg-yellow-950/20 border border-yellow-700/30 space-y-2">
                  <div className="text-[10px] text-yellow-300 font-semibold">Request an Employee</div>
                  <select value={quickReqEmpId} onChange={e => setQuickReqEmpId(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500/50">
                    <option value="">Select employee…</option>
                    {employees.filter((e: any) => e.status === "active").map((e: any) => {
                      // FEATURE 5 — isEmployeeUnavailable also covers recurring
                      // weekday-offs (e.g. "every Sunday"), not just specific
                      // blocked dates.
                      const unavail = j.scheduledDate && isEmployeeUnavailable(e, j.scheduledDate);
                      return <option key={e.id} value={e.id}>{e.firstName} {e.lastName}{unavail ? " ⚠ unavailable" : ""}</option>;
                    })}
                  </select>
                  {quickReqEmpId && (() => {
                    const emp = employees.find((e: any) => e.id === quickReqEmpId);
                    return isEmployeeUnavailable(emp, j.scheduledDate) ? (
                      <div className="text-[10px] text-yellow-300 bg-yellow-950/30 border border-yellow-700/40 rounded px-2 py-1">
                        ⚠️ {(emp as any)?.firstName} is unavailable on this day. Schedule anyway?
                      </div>
                    ) : null;
                  })()}
                  <textarea value={quickReqMsg} onChange={e => setQuickReqMsg(e.target.value)}
                    placeholder="Optional message…" rows={2}
                    className="w-full bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 resize-none" />
                  {/* FIX 4 — ownerId is seeded from getLastOwnerId() on mount but a
                      brand-new device/session still has a real, if short, window
                      where it's genuinely empty. Disabling here (instead of only
                      erroring after the click, as sendQuickJobRequest still does
                      as a defense-in-depth backstop) means the owner sees a
                      "finishing sign-in" state up front rather than a request
                      that appears to fire and then fails. */}
                  <div className="flex gap-2">
                    <button onClick={() => sendQuickJobRequest(j)} disabled={!quickReqEmpId || quickReqSending || !ownerId}
                      title={!ownerId ? "Still finishing sign-in — wait a moment" : undefined}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-black text-xs font-bold transition">
                      <Send size={10} />{quickReqSending ? "Sending…" : !ownerId ? "Finishing sign-in…" : "Send Request"}
                    </button>
                    <button onClick={() => setQuickReqJobId(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Full checklist only while the owner is actually working this
                  job; otherwise one progress line (open the job for details). */}
              {working ? (
                <div className="mb-3"><div className="flex items-center justify-between text-xs text-white/60 mb-1.5"><span>Checklist</span><span>{dn}/{ckTotal}</span></div><div className="space-y-1.5 max-h-32 overflow-y-auto">{(j.checklist || []).map((ck, idx) => <label key={idx} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={ck.done} onChange={() => toggleCk(j.id, idx)} className="w-4 h-4 rounded accent-brand-600" /><span className={ck.done ? "line-through text-white/40" : "text-white/80"}>{ck.label}</span></label>)}</div></div>
              ) : ckTotal > 0 ? (
                <div className="mb-3 flex items-center gap-2 text-[11px] text-white/45"><span>Checklist {dn}/{ckTotal}</span><div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-brand-600/70" style={{ width: `${Math.round((dn / ckTotal) * 100)}%` }} /></div></div>
              ) : null}

              <div className="md:hidden text-[10px] text-white/30 text-center mb-2 border border-dashed border-brand-900/20 rounded py-1">← swipe left to advance</div>

              <div className="flex gap-2 pt-2 border-t border-brand-900/30 flex-wrap">
                {/* On My Way — only when the owner is the one heading there. */}
                {(tab === "scheduled" || tab === "in_progress") && (working || (onCrew && j.scheduledDate === localDateStr())) && (() => {
                  const c = customers.find(x => x.id === j.customerId);
                  if (!c?.phone && !c?.email) return null;
                  return <button onClick={() => {
                    if (j.scheduledDate && j.scheduledDate !== localDateStr()) {
                      const ok = window.confirm(`This job is scheduled for ${j.scheduledDate}, not today. Send the "on my way" message anyway?`);
                      if (!ok) return;
                    }
                    const eta = new Date(Date.now() + 17 * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                    // Get live GPS location then include in message
                    const sendOTW = async (lat: number | null, lng: number | null) => {
                      const locationLink = lat != null ? "https://maps.google.com/?q=" + lat + "," + lng : null;
                      const omwMsg = `Hi ${c.firstName}! Your technician is on the way! ETA: ${eta}. 🚗` + (locationLink ? " Track me: " + locationLink : "") + " — CRM Starter";
                      if (settings?.twilioSid && c.phone) {
                        try { await twilioSend(settings, c.phone, omwMsg); logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: omwMsg }).catch(() => {}); toast("OTW text sent to " + c.firstName + " ✓"); }
                        catch (e: any) { toast(e?.message || "Failed to send OTW text", "red"); }
                      } else if (c.email) {
                        const html = emailShell(settings,"On My Way", `<p>${omwMsg}</p>`);
                        try {
                          await sendEmail(settings, { to: c.email, subject: "Your technician is on the way", body: html });
                          toast("OTW email sent to " + c.firstName + " ✓");
                        } catch (e: any) {
                          const msg = e?.message || "";
                          if (/401|expired|reconnect/i.test(msg)) {
                            toast("Cannot send email — Google token expired. Reconnect Google in Settings → Integrations.", "red");
                          } else {
                            toast(msg || "Failed to send OTW email", "red");
                          }
                        }
                      } else if (c.phone) {
                        window.location.href = "sms:" + c.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(omwMsg);
                      } else {
                        toast("No phone or email on file for " + c.firstName, "yellow");
                      }
                    };
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        pos => sendOTW(Number(pos.coords.latitude.toFixed(5)), Number(pos.coords.longitude.toFixed(5))),
                        () => sendOTW(null, null),
                        { timeout: 5000 }
                      );
                    } else { sendOTW(null, null); }
                  }} className="px-2.5 py-1.5 rounded-lg border bg-blue-950/30 border-blue-700/40 text-blue-300 hover:bg-blue-900/40 text-xs transition flex items-center gap-1" title="Notify customer: On My Way">
                    <Navigation size={10} />OTW
                  </button>;
                })()}
                {/* Per-job timers are gone (clock in for the day above); one
                    that's still running from before can be stopped here. */}
                {j.clockInAt && <button onClick={() => clockOut(j)} title="Stop this job's old timer" className="px-2.5 py-1.5 rounded-lg border bg-green-900/30 border-green-600/40 text-green-300 hover:bg-green-900/50 text-xs transition flex items-center gap-1"><Clock size={12} />Stop {((Date.now() - j.clockInAt) / 3600000).toFixed(2)}h</button>}
                {tab === "scheduled" && <>{onCrew ? <GBtn onClick={() => move(j.id, "in_progress")} className="flex-1 text-xs !py-1.5">Start</GBtn> : <div className="flex-1" />}
                  <button onClick={() => {
                    setJobs(jobs.map(x => x.id === j.id ? { ...x, status: "cancelled", noShow: true, cancelReason: "Customer no-show", cancelledAt: new Date().toISOString() } : x));
                    toast("Marked as no-show");
                    // Text Will about the no-show
                    if (settings?.twilioSid && settings?.myPhone) {
                      const c2 = customers.find(x => x.id === j.customerId);
                      twilioSend(settings, settings.myPhone, "⚠️ NO-SHOW: " + (c2 ? c2.firstName + " " + c2.lastName : "Customer") + " at " + j.address?.split(",")[0] + " on " + j.scheduledDate).catch(() => {});
                    }
                  }} className="px-2.5 py-1.5 rounded-lg border bg-orange-950/20 border-orange-700/40 text-orange-400 hover:bg-orange-900/30 text-xs" title="Mark as no-show">👻</button>
                  <button onClick={() => setCancelModal(j.id)} className="px-2.5 py-1.5 rounded-lg border bg-white/5 border-white/10 text-white/60 hover:text-danger-400 text-xs"><Ban size={12} /></button></>}
                {tab === "in_progress" && (() => { return <><GBtn onClick={() => {
                  if (j.clockInAt) clockOut(j);
                  move(j.id, "completed");
                  // FEATURE 3 — was gated on j.recurringFreq being set, which
                  // only the "preset" schedule mode ever populates; the newer
                  // days/weeks/months/weekdays modes have no recurringFreq at
                  // all, so this would silently skip auto-scheduling for them.
                  // computeNextRecurringDate (lib/utils.ts) is the single
                  // shared calculation for every mode.
                  if (j.isRecurring) {
                    const nextDate = computeNextRecurringDate(j, j.scheduledDate);
                    // BLOCKER 8 (mobile round 9) — this only ever called
                    // setJobs (LOCAL state) with no Supabase insert at all —
                    // unlike EmployeePortal.tsx's own createRecurringJob,
                    // which does insert. The very next 3s/10s refetch poll
                    // (App.tsx's refetchData, which merges Supabase's jobs
                    // over local state) had nothing server-side to merge in,
                    // so the "auto-scheduled" job silently vanished from the
                    // owner's own view within seconds — and, since it never
                    // reached the jobs table, it could never have shown up
                    // in the employee portal (which reads straight from
                    // Supabase) either. This is why completing a recurring
                    // job from here specifically ("commercial jobs" are
                    // usually owner-managed, not completed via the field
                    // portal) never produced a job employees could see.
                    // stripLegacyJobFields — `j` is an existing job object that
                    // may still carry a poisoned organizationId/org_id field
                    // from before that bug was reverted (see lib/utils.ts); a
                    // bare {...j} spread would carry it into this brand-new
                    // row and fail the insert below.
                    const nextJob: any = { ...stripLegacyJobFields(j), id: uid(), status: "scheduled", scheduledDate: nextDate, loggedHours: 0, clockInAt: null, arrivedAt: null, completedAt: null, checklist: (j.checklist || []).map(ck => ({ ...ck, done: false })), preChecklist: (j.preChecklist || []).map((ck: any) => ({ ...ck, done: false })), duringChecklist: (j.duringChecklist || []).map((ck: any) => ({ ...ck, done: false })), postChecklist: (j.postChecklist || []).map((ck: any) => ({ ...ck, done: false })), commLog: [], photos: [], videos: [], chemicalsUsed: [], paymentStatus: undefined, amountCollected: undefined, owner_id: ownerId };
                    console.log("[Recurring] auto-scheduling next occurrence for", nextDate, "— crew:", nextJob.crew);
                    setJobs(prev => [...prev.map(x => x.id === j.id ? { ...x, status: "completed" } : x), nextJob]);
                    (supabase as any).from("jobs").insert(nextJob)
                      .then(async (r: any) => {
                        if (r?.error) {
                          // FIX 14 — an unrecognized column (completedAt/videos
                          // are newer, optional additions — see migration
                          // 0015) makes PostgREST reject the WHOLE row, not
                          // just that field, so the recurring job never
                          // reached Supabase at all and the employee (who
                          // reads jobs straight from Supabase) never saw it —
                          // even though "crew" was populated correctly the
                          // whole time. Retry with a conservative column set
                          // known to exist so the job (and its crew) still
                          // lands even before that migration is run.
                          console.error("[Recurring] insert failed:", r.error.message, "— retrying with core columns");
                          const { completedAt, videos, ...coreJob } = nextJob;
                          const retry = await (supabase as any).from("jobs").insert(coreJob);
                          if (retry?.error) { console.error("[Recurring] core-column retry also failed:", retry.error.message); toast("Next job auto-scheduled locally, but failed to sync — " + retry.error.message, "red"); }
                          else toast("Next recurring job auto-scheduled for " + nextDate + " ✓");
                        }
                        else toast("Next recurring job auto-scheduled for " + nextDate + " ✓");
                      })
                      .catch((e: any) => { console.error("[Recurring] insert threw:", e?.message); toast("Next job auto-scheduled locally, but failed to sync — " + (e?.message || "unknown error"), "red"); });
                  }
                }} className="flex-1 text-xs !py-1.5">Complete</GBtn>
                <button onClick={() => setJobs(jobs.map(x => x.id === j.id ? { ...x, isCash: !x.isCash } : x))} title={j.isCash ? "Mark as card/check" : "Mark as cash payment"} className={"px-2.5 py-1.5 rounded-lg border text-xs transition " + (j.isCash ? "bg-green-900/40 border-green-700/50 text-green-300" : "bg-black/40 border-white/10 text-white/50 hover:text-green-400")}>💵</button>
                </>; })()}                {tab === "completed" && <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1 text-xs text-green-400"><CheckCircle size={12} /> Done{j.loggedHours ? " · " + j.loggedHours + "h" : ""}</div>
                  <button onClick={() => setJobs(jobs.map(x => x.id === j.id ? { ...x, isCash: !x.isCash } : x))} title={j.isCash ? "Switch to card" : "Mark as cash"} className={"px-2 py-1 rounded-lg border text-[10px] transition " + (j.isCash ? "bg-green-900/40 border-green-700/50 text-green-300" : "bg-black/40 border-white/10 text-white/30 hover:text-green-400")}>💵{j.isCash ? " Cash" : ""}</button>
                  {/* Profit breakdown button */}
                  <button onClick={() => setJobs(jobs.map(x => x.id === j.id ? { ...x, _showProfit: !x._showProfit } : x))} className="ml-auto text-[10px] px-2 py-1 bg-black/40 border border-white/10 text-white/40 hover:text-white rounded-lg transition">
                    {j._showProfit ? "▲ Hide" : "📊 Profit"}
                  </button>
                  {(() => {
                    const linked = estimates.filter(e => e.customerId === j.customerId && e.status === "approved" && !e.invoiced);
                    if (linked.length > 0) return <button onClick={() => { setEstimates(prev => prev.map(e => linked.some(l => l.id === e.id) ? { ...e, invoiced: true, invoicedAt: today() } : e)); toast("Invoice sent to " + (customers.find(c => c.id === j.customerId)?.firstName || "customer")); }} className="text-[10px] px-2.5 py-1 bg-green-950/40 border border-green-700/40 text-green-300 rounded-lg hover:bg-green-900/50 flex items-center gap-1"><Receipt size={9} />Invoice</button>;
                    return null;
                  })()}
                </div>}
                {/* Profit breakdown panel */}
                {tab === "completed" && j._showProfit && (() => {
                  const chemCost = (j.chemicalsUsed || []).reduce((s, ch) => s + Number(ch.cost || 0), 0);
                  const laborCost = Number(j.laborCost || 0);
                  const materialCost = Number(j.materialCost || 0);
                  const totalCost = chemCost + laborCost + materialCost;
                  const profit = j.amount - totalCost;
                  const margin = j.amount > 0 ? Math.round((profit / j.amount) * 100) : 0;
                  return <div className="mt-3 p-3 bg-black/60 border border-green-900/30 rounded-xl text-xs space-y-2">
                    <div className="font-semibold text-white/70 mb-2">📊 Job Profit Breakdown</div>
                    <div className="flex justify-between"><span className="text-white/60">Revenue</span><span className="font-bold text-green-400">{fmt(j.amount)}</span></div>
                    <div className="border-t border-white/10 pt-2 space-y-1">
                      <div className="flex justify-between"><span className="text-white/50">Chemicals</span><span className="text-brand-400">-{fmt(chemCost)}</span></div>
                      <div className="flex justify-between"><span className="text-white/50">Labor</span><span className="text-brand-400">-{fmt(laborCost)}</span></div>
                      <div className="flex justify-between"><span className="text-white/50">Materials</span><span className="text-brand-400">-{fmt(materialCost)}</span></div>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 font-bold">
                      <span>Net Profit</span>
                      <span className={profit >= 0 ? "text-green-400" : "text-brand-400"}>{fmt(profit)}</span>
                    </div>
                    <div className={"text-[10px] text-center py-1 rounded-lg " + (margin >= 60 ? "bg-green-950/40 text-green-400" : margin >= 40 ? "bg-yellow-950/40 text-yellow-400" : "bg-brand-950/40 text-brand-400")}>
                      {margin}% margin · {margin >= 60 ? "🔥 Strong" : margin >= 40 ? "👍 Good" : "⚠️ Low — check costs"}
                      {j.isCash && <span className="ml-2 text-green-400">· 💵 Cash (track separately for taxes)</span>}
                    </div>
                    {totalCost === 0 && <div className="text-[10px] text-white/30 text-center">Add labor/chemical costs in job detail for full breakdown</div>}
                  </div>;
                })()}
                {tab === "cancelled" && <button onClick={async () => {
                  const c = customers.find(x => x.id === j.customerId);
                  const newDate = prompt("New date (YYYY-MM-DD):", daysFromNow(7));
                  if (!newDate) return;
                  move(j.id, "scheduled");
                  setJobs(prev => prev.map(x => x.id === j.id ? { ...x, scheduledDate: newDate, status: "scheduled", cancelReason: "" } : x));
                  if (c?.phone) {
                    const msg = "Hi " + c.firstName + ", we've rescheduled your service to " + newDate + ". Reply to confirm or request a different date. — " + ((settings as any)?.companyName || "CRM Starter");
                    if (settings?.twilioSid) {
                      try { await twilioSend(settings, c.phone, msg); logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {}); toast("Rescheduled + customer texted ✓"); } catch { toast("Rescheduled — text failed"); }
                    } else {
                      window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg);
                    }
                  } else toast("Rescheduled to " + newDate);
                }} className="flex-1 text-xs text-blue-400 flex items-center justify-center gap-1 py-1.5 border border-blue-700/30 rounded-lg hover:bg-blue-950/30 transition"><RefreshCw size={10} />Reschedule + Text</button>}
                <button onClick={() => setDeleteModal(j.id)} className="flex-1 text-xs text-danger-400 flex items-center justify-center gap-1 py-1.5 border border-danger-700/30 rounded-lg hover:bg-danger-950/30 transition"><Trash2 size={10} />Delete Job</button>
              </div>
            </Glass>
          );
        })}
        {filtered.length === 0 && <div className="md:col-span-2 text-center py-12 text-white/40">No {tabs[tab].toLowerCase()} jobs</div>}
      </div>}

      <JobDetailModal jobId={detailId} job={jobs.find(j => j.id === detailId)} onClose={() => setDetailId(null)} customers={customers} employees={employees} updateJob={updateJob} toast={toast} gToken={gToken} settings={settings} setSettings={setSettings} estimates={estimates} setEstimates={setEstimates} onPortal={onPortal} ownerId={ownerId} services={services} />

      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)} title="Cancel Job">
        <div className="space-y-3">
          <GSel value={cancelReason} onChange={e => setCancelReason(e.target.value)}>{cancelReasons.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}</GSel>
          <div className="flex gap-2 justify-end"><GBtn variant="ghost" onClick={() => setCancelModal(null)}>Back</GBtn><GBtn variant="danger" onClick={confirmCancel}>Cancel Job</GBtn></div>
        </div>
      </Modal>

      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete Job">
        <div className="space-y-4">
          <div className="text-sm text-white/80">Permanently delete this job? This cannot be undone.</div>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setDeleteModal(null)}>Cancel</GBtn>
            <GBtn variant="danger" onClick={confirmDelete}><Trash2 size={12} className="inline mr-1.5" />Delete Permanently</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

