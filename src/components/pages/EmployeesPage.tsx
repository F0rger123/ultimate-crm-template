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
  Paperclip, ImageIcon, FileImage, MoreVertical, Mic, Upload, Link, Lock, User, UserX
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line,
  ComposedChart, Legend
} from "recharts";
import { fmt, uid, today, localDateStr, shiftDayStr, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, getEffectiveRate, weekdayLabels, countDaysOffInRange, getPayPeriodBounds } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell, emailButton } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
// BLOCKER 2/14 (mobile round 9) — crewIncludesEmployee is the same robust
// crew-matching helper the employee portal already uses (tolerates object-
// shaped crew entries, stringified-JSON crew columns, casing, and the
// employees.id vs employees.user_id mismatch). This page was comparing with
// a bare `(j.crew||[]).includes(e.id)`, which silently matched nothing
// whenever a job's crew array was written with a different id shape than
// this employee row's `id` — the root cause of "hours/payroll data exists
// in the console but the tab renders empty."
import { crewIncludesEmployee } from "./EmployeePortal";
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
import { UpgradePrompt } from "../ui/UpgradePrompt";
import type { PlanLimits } from "../../lib/planLimits";
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

interface InviteRecord { code: string; firstName: string; lastName: string; email: string; phone?: string; role: string; hourlyRate: number; createdAt: string; used?: boolean; permissions?: Record<string, boolean>; isNewHire?: boolean; }

const PERMISSION_DEFS_EMP = [
  { key: "can_view_jobs",          label: "View assigned jobs",    desc: "See their schedule" },
  { key: "can_clock_in",           label: "Clock in / out",        desc: "Track time on jobs" },
  { key: "can_upload_photos",      label: "Upload photos",         desc: "Before/after photos" },
  { key: "can_complete_checklist", label: "Complete checklist",    desc: "Check off job items" },
  { key: "can_get_signoff",        label: "Customer sign-off",     desc: "Collect signature" },
  { key: "can_view_pay",           label: "View pay info",         desc: "See pay & history" },
  { key: "can_view_calendar",      label: "View calendar",         desc: "Weekly/monthly view" },
  { key: "can_add_notes",          label: "Add job notes",         desc: "Leave notes on jobs" },
  // ITEMS 3/5 — granular billing permissions, off by default (opt-in, unlike
  // the operational perms above) since these touch money.
  { key: "can_create_invoices",    label: "Create invoices",       desc: "Generate a new invoice from a job" },
  { key: "can_send_invoices",      label: "Send invoices",         desc: "Email/text an invoice to the customer" },
  { key: "can_process_payments",   label: "Process payments",      desc: "Add cards on file, charge fees on-site" },
  // FEATURE — lets a specific employee text the company's Alfred number and
  // get a real (narrow, self-scoped-only) AI assistant back: clock in/out,
  // check their own hours, see their own jobs, manage their own connected
  // Google Calendar. Off by default — this is a new capability, not an
  // existing portal permission being surfaced, so it shouldn't silently
  // turn on for anyone until the owner opts them in.
  { key: "can_text_alfred",        label: "Text Alfred",           desc: "Clock in/out, check hours, and manage their calendar by texting Alfred" },
  // FEATURE — granular sub-permission, only meaningful (and only shown in
  // the UI) once can_text_alfred is on. Off by default even then — messaging
  // real customers is a bigger grant than the base clock-in/hours access,
  // so it needs its own explicit opt-in rather than riding along for free.
  { key: "can_text_alfred_message_customers", label: "Message customers via Alfred", desc: "Send a custom text to a customer on one of their own jobs, by asking Alfred", nestedUnder: "can_text_alfred" },
] as const;

const DEFAULT_PERMS: Record<string, boolean> = {
  can_view_jobs: true, can_clock_in: true, can_upload_photos: true,
  can_complete_checklist: true, can_get_signoff: true,
  can_view_pay: true, can_view_calendar: true, can_add_notes: true,
  can_create_invoices: false, can_send_invoices: false, can_process_payments: false,
  can_text_alfred: false, can_text_alfred_message_customers: false,
};

// FIX 8 — CRM-side permissions for a "Manager" role employee (distinct from
// PERMISSION_DEFS_EMP above, which govern the field/employee portal). Managers
// get the full owner CRM by default EXCEPT these areas, which are hidden
// unless the owner explicitly grants them — see App.tsx's nav-gating.
const MANAGER_CRM_PERM_DEFS = [
  { key: "alfred",         label: "Alfred AI Assistant", desc: "The in-app AI chatbot" },
  { key: "inbox",          label: "Inbox",               desc: "Email/texting with customers" },
  { key: "accountability", label: "Accountability Tools",desc: "Personal goals & reflections" },
  { key: "google",         label: "Google Workspace",    desc: "Owner's connected Gmail/Calendar/Drive" },
] as const;
const DEFAULT_MANAGER_PERMS: Record<string, boolean> = {
  alfred: false, inbox: false, accountability: false, google: false,
};

// ITEM 5 — "Mark as Paid" already existed (togglePeriod/toggleDay/
// markPeriodPaidFor below), but there was no calendar view of payments at
// all, and no record of WHEN a payment was actually made or how much — only
// a paid/unpaid status per period. Reads the append-only paymentLog each of
// those three functions now writes (one entry per "Mark Paid" click, dated
// with a real timestamp) and plots it on a month grid.
function PayrollCalendar({ employees, jobs = [] }: { employees: any[]; jobs?: any[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + monthOffset);
  const year = base.getFullYear(), month = base.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const monthLabel = base.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Payment log events (only visible after "Mark Paid" is used)
  const paymentsByDay: Record<string, { id: string; empName: string; amount: number; periodStart: string; periodEnd: string }[]> = {};
  employees.forEach((e: any) => {
    (e.paymentLog || []).forEach((p: any) => {
      // BUG FIX — "Payroll crashed: Invalid time value." A missing/malformed
      // paidAt (legacy rows, or a future write using the wrong field name
      // again) threw inside new Date(...).toISOString() and crashed the
      // WHOLE Payroll tab for every employee, not just the bad row. Skip
      // just that one entry instead.
      const d = new Date(p.paidAt ?? p.at ?? NaN);
      if (isNaN(d.getTime())) return;
      const dateKey = d.toISOString().slice(0, 10);
      (paymentsByDay[dateKey] ||= []).push({ id: p.id, empName: `${e.firstName} ${e.lastName}`, amount: Number(p.amount) || 0, periodStart: p.periodStart, periodEnd: p.periodEnd });
    });
  });

  // Job completion events — show all completed jobs by date so the calendar isn't empty before any payments are marked
  // ISSUE 6 (round 2) — the Jobs view showed a job count + hours per day but
  // no dollar figure, even though the owner asked specifically for "a #
  // amount for the day total." Tracked per-job (not per-empName row, which
  // would double count a job with 2+ crew) via jobAmountsByDay below.
  const jobsByDay: Record<string, { empName: string; hours: number; address: string; status: string }[]> = {};
  const jobAmountsByDay: Record<string, number> = {};
  const countedJobIdsByDay: Record<string, Set<string>> = {};
  jobs.forEach((j: any) => {
    if (j.status !== "completed" && j.status !== "scheduled") return;
    const dateKey = j.scheduledDate || (j.completedAt ? String(j.completedAt).slice(0, 10) : "");
    if (!dateKey) return;
    const [y, m] = dateKey.split("-").map(Number);
    if (y !== year || (m - 1) !== month) return;
    const empNames: string[] = [];
    employees.forEach((e: any) => {
      const crew: any[] = Array.isArray(j.crew) ? j.crew : [];
      const inCrew = crew.some((c: any) => {
        if (typeof c === "string") return c === e.id || c === (e as any).user_id;
        if (c && typeof c === "object") return c.id === e.id || c.user_id === (e as any).user_id;
        return false;
      });
      if (inCrew) empNames.push(`${e.firstName} ${e.lastName}`);
    });
    if (empNames.length === 0) empNames.push("Unassigned");
    empNames.forEach(name => {
      (jobsByDay[dateKey] ||= []).push({ empName: name, hours: Number(j.loggedHours) || 0, address: j.address || "—", status: j.status });
    });
    const seen = (countedJobIdsByDay[dateKey] ||= new Set());
    if (!seen.has(j.id)) {
      seen.add(j.id);
      jobAmountsByDay[dateKey] = (jobAmountsByDay[dateKey] || 0) + (Number(j.amount) || 0);
    }
  });

  // ISSUE 5 — this used to be a Jobs/Payments toggle the owner had to
  // switch between to see either kind of event. Combined into a single
  // per-day view: job dots (blue) and payment dots (green) both show on the
  // same cell, and the detail panel below lists both kinds together.
  const allDayKeys = new Set([...Object.keys(jobsByDay), ...Object.keys(paymentsByDay)]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Glass className="p-4">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setMonthOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><ChevronLeft size={14} /></button>
        <div className="text-sm font-semibold flex items-center gap-1.5"><Calendar size={13} className="text-green-400" />{monthLabel}</div>
        <button onClick={() => setMonthOffset(o => o + 1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><ChevronRight size={14} /></button>
      </div>
      <div className="flex items-center gap-3 mb-2 text-[10px] text-white/40">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Jobs</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />Payments</span>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-white/40 mb-1">
        {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dayJobs = jobsByDay[key] || [];
          const dayPayments = paymentsByDay[key] || [];
          const isSelected = selectedDay === key;
          const hasData = dayJobs.length > 0 || dayPayments.length > 0;
          const totalHours = dayJobs.reduce((s: number, ev: any) => s + (ev.hours || 0), 0);
          const totalPaid = dayPayments.reduce((s: number, ev: any) => s + (ev.amount || 0), 0);
          return (
            <button key={i} onClick={() => hasData && setSelectedDay(isSelected ? null : key)}
              disabled={!hasData}
              className={"aspect-square rounded-lg text-[10px] flex flex-col items-center justify-center gap-0.5 transition " +
                (hasData
                  ? "bg-black/30 border " + (isSelected ? "border-white/40" : "border-white/10") + " hover:bg-white/5 cursor-pointer"
                  : "text-white/30 cursor-default")}>
              <div>{d}</div>
              {hasData && (
                <div className="flex flex-col items-center gap-0.5">
                  {dayJobs.length > 0 && (
                    <>
                      {/* ISSUE 7 (round 11) — hours only rendered when
                          truthy, so a day whose jobs were all still
                          "scheduled" (0 logged hours — correct, nothing
                          worked yet) looked identical to a day whose
                          COMPLETED jobs had hours that failed to show. Show
                          the hours figure any time at least one job on this
                          day is completed, so "no hours shown" only ever
                          means "nothing completed here yet" — never an
                          ambiguous blank. */}
                      <span className="text-[8px] font-bold leading-none text-blue-300">
                        {dayJobs.length}j
                        {dayJobs.some(ev => ev.status === "completed") ? " " + totalHours.toFixed(1) + "h" : ""}
                      </span>
                      {(jobAmountsByDay[key] || 0) > 0 && <span className="text-[8px] font-bold leading-none text-blue-200">{fmt(jobAmountsByDay[key])}</span>}
                    </>
                  )}
                  {dayPayments.length > 0 && <span className="text-[8px] font-bold leading-none text-green-300">{fmt(totalPaid)}</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {selectedDay && (jobsByDay[selectedDay]?.length || paymentsByDay[selectedDay]?.length) && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-white/40 uppercase tracking-wider">{selectedDay}</div>
            {(jobAmountsByDay[selectedDay] || 0) > 0 && <div className="text-xs font-bold text-blue-300">{fmt(jobAmountsByDay[selectedDay])} job value</div>}
          </div>
          {(paymentsByDay[selectedDay] || []).map(ev => (
            <div key={ev.id} className="flex items-center justify-between text-xs bg-black/40 rounded-lg px-2.5 py-1.5">
              <span className="text-white/70">{ev.empName} <span className="text-white/40">({ev.periodStart}{ev.periodEnd !== ev.periodStart ? " – " + ev.periodEnd : ""})</span></span>
              <span className="font-semibold text-green-400">{fmt(ev.amount)} paid</span>
            </div>
          ))}
          {(jobsByDay[selectedDay] || []).map((ev, i) => (
            <div key={i} className="flex items-center justify-between text-xs bg-black/40 rounded-lg px-2.5 py-1.5">
              <span className="text-white/70 truncate min-w-0 flex-1 mr-2">{ev.empName} <span className="text-white/40">· {ev.address}</span></span>
              <div className="text-right flex-shrink-0">
                <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded-full " + (ev.status === "completed" ? "bg-green-900/40 text-green-300" : "bg-blue-900/40 text-blue-300")}>{ev.status}</span>
                {ev.hours > 0 && <span className="ml-1.5 text-white/50">{ev.hours}h</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {allDayKeys.size === 0 && (
        <div className="text-center py-4 text-xs text-white/30">No jobs or payments recorded this month</div>
      )}
    </Glass>
  );
}

export function EmployeesPage({ employees = [], setEmployees, jobs = [], setJobs = (() => {}) as any, customers = [], settings = {} as any, toast = (_msg: string, _tone?: string) => {}, autoOpenManagerInvite = false, onAutoOpenManagerInviteConsumed, initialView, onInitialViewConsumed, ownerId, planLimits, onUpgrade = () => {}, highlightId, onHighlightConsumed }: { employees?: any[]; setEmployees: any; jobs?: any[]; setJobs?: any; customers?: any[]; settings?: any; toast?: any; autoOpenManagerInvite?: boolean; onAutoOpenManagerInviteConsumed?: () => void; initialView?: "list" | "hours" | "payroll"; onInitialViewConsumed?: () => void; ownerId?: string; planLimits?: PlanLimits; onUpgrade?: () => void; highlightId?: string | null; onHighlightConsumed?: () => void }) {
  const [modal, setModal] = useState({ open: false, data: null });
  const [view, setView] = useState("list"); // list | hours | payroll
  // Hours tab — which employee's per-shift/per-job paid/unpaid breakdown is
  // currently expanded (owner request: "paid/unpaid status per shift not
  // displayed" — the table itself only showed aggregate hours).
  const [expandedHoursEmpId, setExpandedHoursEmpId] = useState<string | null>(null);
  // FEATURE — owner-side view/approve for employee-submitted mileage
  // (mileage_logs table, migration 0023; employee-side submit form lives in
  // EmployeePortal.tsx's Pay tab).
  const [mileageLogs, setMileageLogs] = useState<any[]>([]);
  useEffect(() => {
    if (view !== "mileage") return;
    (async () => {
      try {
        const { data, error } = await (supabase as any).from("mileage_logs").select("*").order("date", { ascending: false }).limit(200);
        if (!error && Array.isArray(data)) setMileageLogs(data);
      } catch { /* table may not exist yet */ }
    })();
  }, [view]);
  const reviewMileageLog = (id: string, status: "approved" | "denied") => {
    setMileageLogs(prev => prev.map(m => m.id === id ? { ...m, status } : m));
    // SECURITY/SYNC FIX (audit finding) — no .select("id")/0-row check, so
    // an RLS-mismatched write toasted "approved" while silently not saving.
    (supabase as any).from("mileage_logs").update({ status, reviewed_at: new Date().toISOString() }).eq("id", id).select("id")
      .then((r: any) => {
        if (!r?.error && Array.isArray(r?.data) && r.data.length > 0) { toast?.(status === "approved" ? "Mileage approved ✓" : "Mileage denied", "green"); return; }
        toast?.("Couldn't save — " + (r?.error?.message || "the server didn't confirm the update"), "red");
      })
      .catch((e: any) => toast?.("Couldn't save — " + (e?.message || "unknown error"), "red"));
  };
  // ISSUE 7 (round 2) — this used to default to "1st of the month → today",
  // a date range with no relationship to the fixed 14-day pay period
  // (getPayPeriodBounds) the rest of payroll now runs on. Hours completed
  // in a period that started in the PREVIOUS calendar month (e.g. viewing
  // on the 3rd of a new month, but the current pay period started on the
  // 27th) fell outside this window and looked like "missing hours" even
  // though the underlying job/crew data was correct — it was just the wrong
  // date range being displayed. Defaults to the actual current pay period
  // now; existing owners with an already-persisted range keep whatever
  // they had (usePersistent only applies this default when no value exists
  // yet) — the "This Pay Period" button below fixes it for them on demand.
  const [payPeriodStart, setPayPeriodStart] = usePersistent("crm.payPeriodStart", getPayPeriodBounds().start);
  const [payPeriodEnd, setPayPeriodEnd] = usePersistent("crm.payPeriodEnd", getPayPeriodBounds().end);
  const jumpToCurrentPayPeriod = () => {
    const b = getPayPeriodBounds();
    setPayPeriodStart(b.start); setPayPeriodEnd(b.end);
  };
  // ISSUE 7 (round 3) — the Hours tab shared payPeriodStart/payPeriodEnd
  // with the Payroll tab, both defaulting to the current fixed 14-day pay
  // period. That's the right default for "what do I owe right now" (Payroll)
  // but wrong for "does this employee's logged time look right" (Hours) —
  // an owner checking hours for a job completed weeks or months ago (July 9,
  // June 28) saw an all-zero table and reasonably read it as "hours aren't
  // showing," when the data was fine and only the 14-day window was hiding
  // it. Hours now gets its OWN date range, independent of Payroll's,
  // defaulting to the last 30 days with "All Time" and "This Pay Period"
  // quick-jump buttons.
  const ALL_TIME_START = "2000-01-01";
  const [hoursRangeStart, setHoursRangeStart] = usePersistent("crm.hoursRangeStart", daysFromNow(-30));
  const [hoursRangeEnd, setHoursRangeEnd] = usePersistent("crm.hoursRangeEnd", today());
  const [hoursEmpFilter, setHoursEmpFilter] = useState("");
  const jumpHoursToLast30 = () => { setHoursRangeStart(daysFromNow(-30)); setHoursRangeEnd(today()); };
  const jumpHoursToAllTime = () => { setHoursRangeStart(ALL_TIME_START); setHoursRangeEnd(today()); };
  const jumpHoursToCurrentPayPeriod = () => {
    const b = getPayPeriodBounds();
    setHoursRangeStart(b.start); setHoursRangeEnd(b.end);
  };
  const isHoursAllTime = hoursRangeStart === ALL_TIME_START;
  const [f, setF] = useState<any>({ id: "", firstName: "", lastName: "", role: "Technician", status: "active", hourlyRate: 18, phone: "", email: "", startDate: today(), emergencyContact: "", notes: "", permissions: { ...DEFAULT_PERMS } });
  const [showPortalInfo, setShowPortalInfo] = useState(false);
  // FEATURE — "one combined button instead of two." Invite Member / Add
  // Employee used to be two separate toolbar buttons with no relationship to
  // each other, which read as two competing ways to do the same thing. One
  // button now opens this small chooser first; picking either option opens
  // the existing (unchanged) invite or direct-add modal underneath — keeps
  // both fully-working flows intact instead of risking a deep merge of two
  // very different forms (one creates an invite code + pre-placeholder row,
  // the other saves a real employee row directly).
  const [addChooserOpen, setAddChooserOpen] = useState(false);
  // FEATURE — "whenever they hit their plan limit... it prompts them to
  // upgrade." Seat count excludes the owner's own auto-created row (role
  // "owner") — the limit is about team members, not the account itself.
  // Pending (not-yet-accepted) invites aren't counted — a known
  // simplification, see the equivalent note on the customer-limit gate.
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const seatCount = employees.filter((e: any) => e.role !== "owner").length;
  const atSeatLimit = !!planLimits && planLimits.employeeSeats !== null && seatCount >= planLimits.employeeSeats;
  const openAddTeamMember = () => {
    if (atSeatLimit) { setUpgradePromptOpen(true); return; }
    setAddChooserOpen(true);
  };
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = usePersistent<InviteRecord[]>("crm.invites", []);
  const [inviteF, setInviteF] = useState({ firstName: "", lastName: "", email: "", phone: "", role: "Technician", hourlyRate: 18, isNewHire: true });
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>({ ...DEFAULT_PERMS });
  const [inviteManagerPerms, setInviteManagerPerms] = useState<Record<string, boolean>>({ ...DEFAULT_MANAGER_PERMS });
  const [showInvitePerms, setShowInvitePerms] = useState(false);
  const [showEditPerms, setShowEditPerms] = useState(false);
  const [inviteCreated, setInviteCreated] = useState<InviteRecord | null>(null);
  const [resendingInvite, setResendingInvite] = useState<"email" | "sms" | null>(null);
  const portalUrl = window.location.origin + window.location.pathname + "#/portal";
  // FEATURE — new-hire onboarding packet. Template lives on
  // settings.onboardingTemplateItems (owner-editable in Settings → Templates
  // → Onboarding Packet); checking this box at invite time copies a snapshot
  // of that template into a real employee_onboarding row (migration 0039)
  // tied to this employee, independent of later template edits.
  const onboardingTemplateItems: { id: string; title: string; description?: string }[] = (settings as any)?.onboardingTemplateItems || [];
  const [sendOnboardingPacket, setSendOnboardingPacket] = useState(true);
  // employee_id -> employee_onboarding row, used to show completion progress
  // on the Team list below.
  const [onboardingByEmployee, setOnboardingByEmployee] = useState<Record<string, any>>({});
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await (supabase as any).from("employee_onboarding").select("*");
        if (!error && Array.isArray(data)) {
          const byId: Record<string, any> = {};
          data.forEach((row: any) => { byId[row.employee_id] = row; });
          setOnboardingByEmployee(byId);
        }
      } catch { /* table may not exist yet — run supabase/migrations/0039_employee_onboarding.sql */ }
    })();
  }, [view]);
  const assignOnboardingPacket = async (employeeId: string, firstName: string) => {
    if (onboardingTemplateItems.length === 0) return;
    const items = onboardingTemplateItems.map(t => ({ id: t.id, title: t.title, description: t.description, done: false, completedAt: null }));
    const row = { id: uid(), owner_id: ownerId, employee_id: employeeId, items };
    try {
      const { error } = await (supabase as any).from("employee_onboarding").upsert(row, { onConflict: "employee_id" });
      if (error) {
        console.error("[Onboarding] assign failed:", error.message);
        toast?.(`Invite created, but couldn't assign the onboarding packet — ${error.message}`, "red");
        return;
      }
      setOnboardingByEmployee(prev => ({ ...prev, [employeeId]: row }));
      toast?.(`Onboarding packet sent to ${firstName} ✓`, "green");
    } catch (e: any) {
      console.error("[Onboarding] assign threw:", e?.message);
      toast?.(`Invite created, but couldn't assign the onboarding packet — ${e?.message || "unknown error"}`, "red");
    }
  };

  const generateInvite = async () => {
    if (!inviteF.firstName.trim() || !inviteF.email.trim()) return;
    // SECURITY FIX — Math.random() is not cryptographically secure and the
    // appended Date.now() component made a code guessable within any
    // realistic sharing window. uid() is a real crypto.randomUUID() (see
    // lib/utils.ts) — 12 hex chars from it still carries far more entropy
    // than the old scheme ever did.
    const code = uid().replace(/-/g, "").slice(0, 12).toUpperCase();
    const inv: InviteRecord = { code, ...inviteF, hourlyRate: Number(inviteF.hourlyRate), createdAt: new Date().toISOString().slice(0, 10), permissions: invitePerms };
    // Save to localStorage (local UI state)
    setInvites(prev => [...prev, inv]);
    // Save to Supabase so the invite works from any browser/device
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from("invites").insert({
        code,
        employee_name: `${inv.firstName} ${inv.lastName}`,
        employee_email: inv.email,
        role: inv.role,
        hourly_rate: inv.hourlyRate,
        created_by: user?.id ?? null,
        owner_id: ownerId,
      });
    } catch { /* table may not exist yet — invite still works via localStorage in the same browser */ }
    // Pre-create employee record so the portal can match immediately. This
    // MUST also land in Supabase (not just local state) — refetchEmployees()
    // polls the table every few seconds and wholesale-replaces local state
    // with the server rows, so a local-only placeholder here would silently
    // vanish from the roster within seconds of being created.
    const alreadyExists = employees.some(e => e.email.toLowerCase() === inviteF.email.toLowerCase());
    let newEmployeeId: string | null = null;
    if (!alreadyExists) {
      newEmployeeId = uid();
      const preCreated = {
        id: newEmployeeId, firstName: inv.firstName, lastName: inv.lastName, email: inv.email,
        role: inv.role, hourlyRate: inv.hourlyRate, status: "active", phone: inv.phone || "",
        startDate: today(), emergencyContact: "", notes: "Invited — account pending",
        isNewHire: !!inv.isNewHire,
        permissions: invitePerms,
        managerPermissions: inv.role.toLowerCase().includes("manager") ? inviteManagerPerms : undefined,
        owner_id: ownerId,
      };
      setEmployees((prev: any[]) => [...prev, preCreated as any]);
      (supabase as any).from("employees").insert(preCreated)
        .then((r: any) => { if (r?.error) { console.warn("[Invite] pre-create employee row failed:", r.error.message); toast?.("Invite link created, but the employee record couldn't be saved — " + r.error.message + ". Signup with this invite may not work.", "red"); } })
        .catch((e: any) => { console.warn("[Invite] pre-create employee row threw:", e?.message); toast?.("Invite link created, but the employee record couldn't be saved — signup with this invite may not work.", "red"); });
    } else {
      newEmployeeId = employees.find(e => e.email.toLowerCase() === inviteF.email.toLowerCase())?.id || null;
    }
    if (sendOnboardingPacket && newEmployeeId) {
      assignOnboardingPacket(newEmployeeId, inv.firstName);
    }
    setInviteCreated(inv);
    // Send invite email via the owner's connected Gmail account
    const link = inviteLink(code);
    const companyName = settings?.companyName || "your company";
    const ownerName = settings?.ownerName || "Your Manager";
    try {
      await sendEmail(settings, {
        to: inviteF.email,
        subject: `You've been invited to join ${companyName} on CRM Starter`,
        // BUG FIX — "make sure the UI for all emails looks good" — this was
        // one of a small handful sent as bare inline HTML with no
        // emailShell wrapper (no logo/header, inconsistent with every
        // other transactional email in the app). Same shell + button
        // component the rest of the app uses.
        body: emailShell(settings, "You're Invited", `<p>Hi ${inviteF.firstName},</p><p>${ownerName} has invited you to join <strong>${companyName}</strong> on CRM Starter. Click below to create your employee account and access your schedule, pay, and job details.</p>` + emailButton("Create Your Account", link) + `<p style="font-size:12px;color:#888;">Or paste this link in your browser:<br/><a href="${link}">${link}</a></p>`),
      });
      toast(`Invite email sent to ${inviteF.email} ✓`, "green");
    } catch {
      // Gmail not connected — link was still created
      toast(`Invite created! Share the link manually with ${inviteF.firstName}.`, "yellow");
    }
  };

  const inviteLink = (code: string) => `${portalUrl}?invite=${code}`;

  useEffect(() => {
    if (modal.data) {
      setF({ ...modal.data, permissions: (modal.data as any).permissions || { ...DEFAULT_PERMS } });
    } else {
      setF({ id: "", firstName: "", lastName: "", role: "Technician", status: "active", hourlyRate: 18, phone: "", email: "", startDate: today(), emergencyContact: "", notes: "", permissions: { ...DEFAULT_PERMS } });
    }
    setShowEditPerms(false);
  }, [modal]);

  // FIX 8 — "Add Manager" in Settings → Company jumps here with the invite
  // modal pre-opened and role defaulted to Manager, since the actual invite
  // form (permissions, CRM access, invite code) already lives on this page.
  useEffect(() => {
    if (!autoOpenManagerInvite) return;
    setInviteOpen(true);
    setInviteCreated(null);
    setInviteF({ firstName: "", lastName: "", email: "", phone: "", role: "Manager", hourlyRate: 18, isNewHire: false });
    setInvitePerms({ ...DEFAULT_PERMS });
    setInviteManagerPerms({ ...DEFAULT_MANAGER_PERMS });
    setShowInvitePerms(false);
    setSendOnboardingPacket(true);
    onAutoOpenManagerInviteConsumed?.();
  }, [autoOpenManagerInvite]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lets a clicked desktop notification (clock-out, report-problem) land the
  // owner directly on the Hours tab instead of just opening this page on
  // whatever tab it last happened to be on.
  useEffect(() => {
    if (!initialView) return;
    setView(initialView);
    onInitialViewConsumed?.();
  }, [initialView]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG FIX (user report) — "notification says click to view it but that
  // doesn't work." The owner's Payroll notification (App.tsx's employee-
  // pay-confirm effect / push url) landed on this page but never actually
  // opened the specific employee — same alfredHighlight spotlight pattern
  // email "View" links use elsewhere. Opens that employee's edit modal on
  // the Payroll tab so the pay section they were pointed at is visible.
  useEffect(() => {
    if (!highlightId) return;
    const emp = employees.find((e: any) => e.id === highlightId);
    if (emp) { setView("payroll"); setModal({ open: true, data: emp }); }
    onHighlightConsumed?.();
  }, [highlightId, employees]); // eslint-disable-line react-hooks/exhaustive-deps

  // Employee edits (pay rate, paidPeriods, permissions, etc.) have no bulk
  // autosave the way `jobs` does — without an immediate Supabase write here,
  // changes like marking a pay period Paid only ever lived in the owner's
  // local React state and the employee's portal (which reads straight from
  // Supabase) never saw them.
  const save = () => {
    if (!f.firstName.trim()) return;
    const id = f.id || uid();
    const record = { ...f, id };
    if (f.id) setEmployees(prev => prev.map(e => e.id === f.id ? record : e));
    else setEmployees(prev => [...prev, record]);
    if (f.id) {
      // docs/ARCHITECTURE.md "safe column retry" pattern — this used to send the WHOLE
      // record in one PATCH. Postgres/PostgREST rejects an entire update if
      // ANY single column in the patch doesn't exist or doesn't type-check,
      // so one stale/missing field (e.g. lastShiftDate before migration 0004
      // was actually applied) silently blocked the owner's real edit —
      // permissions, pay rate, whatever they were actually trying to save —
      // with a schema-cache error that read like the whole feature was
      // broken. Retry with just the fields an owner actually edits from this
      // form if the full-object write fails, so a column gap elsewhere on
      // the row can never block a legitimate permissions/profile change.
      // BUG FIX (audit) — "home base isn't saving for the employee portal
      // again." homeBaseAddress was missing from this whitelist, so any
      // owner-side Edit Employee save that fell back to the core-columns
      // retry (any OTHER stale/mismatched column on that row triggering the
      // full-patch failure) silently dropped it while still reporting a
      // successful save.
      const EMPLOYEE_CORE_COLUMNS = [
        "firstName", "lastName", "email", "phone", "role", "status", "hourlyRate",
        "permissions", "managerPermissions", "can_create_invoices", "can_send_invoices", "can_process_payments",
        "jobTypeRates", "maxDaysOffPerWeek", "maxDaysOffPerMonth", "recurringDaysOff", "availability", "homeBaseAddress",
      ];
      // BUG FIX — "permissions don't always save": this never checked
      // whether the UPDATE actually matched a row. `.update(...)` with no
      // matching row under RLS returns success with an EMPTY data array, no
      // error at all — the classic silent-RLS-block pattern (docs/ARCHITECTURE.md: "if
      // a Supabase read returns 0 rows unexpectedly, suspect RLS"). That
      // read exactly like "I edited permissions, hit save, nothing
      // happened" with zero indication anything was wrong. `.select("id")`
      // lets a 0-row response be treated as the real failure it is instead
      // of silently doing nothing. Also: this path had NO success toast at
      // all, violating docs/ARCHITECTURE.md's "every action needs a success toast"
      // rule — an owner had no way to confirm a save that DID work either.
      (supabase as any).from("employees").update(record).eq("id", id).select("id")
        .then(async (r: any) => {
          if (!r?.error && Array.isArray(r?.data) && r.data.length > 0) { toast?.("Employee saved ✓", "green"); return; }
          if (r?.error) console.warn("[EmployeesPage] full save failed:", r.error.message, "— retrying with core columns only");
          else console.warn("[EmployeesPage] full save matched 0 rows (RLS?) — retrying with core columns only");
          const core: Record<string, unknown> = {};
          EMPLOYEE_CORE_COLUMNS.forEach(k => { if ((record as any)[k] !== undefined) core[k] = (record as any)[k]; });
          const retry = await (supabase as any).from("employees").update(core).eq("id", id).select("id");
          if (retry?.error) { toast?.("Saved locally, but failed to sync — " + retry.error.message, "red"); return; }
          if (!Array.isArray(retry?.data) || retry.data.length === 0) { toast?.("Saved locally, but the server didn't confirm the update — try again or refresh to check", "red"); return; }
          toast?.(r?.error ? "Saved (one field on this row has a schema mismatch and was skipped — everything else, including permissions, synced)" : "Employee saved ✓", r?.error ? "yellow" : "green");
        })
        .catch((e: any) => toast?.("Saved locally, but failed to sync — " + (e?.message || ""), "red"));
    }
    setModal({ open: false, data: null });
  };
  const del = id => {
    if (!confirm("Remove employee?")) return;
    setEmployees(prev => prev.filter(e => e.id !== id));
    // Must actually delete server-side — the 3s Live Crew poll fully replaces
    // local state from Supabase, so a local-only removal (e.g. revoking a
    // manager's access) would silently reappear on the very next poll.
    (supabase as any).from("employees").delete().eq("id", id).select("id")
      .then((r: any) => {
        if (r?.error) { toast?.("Removed locally, but failed to sync — " + r.error.message, "red"); return; }
        if (!Array.isArray(r?.data) || r.data.length === 0) { toast?.("Removed locally, but the server didn't confirm the delete — it may reappear. Try again or refresh to check.", "red"); return; }
        toast?.("Employee removed");
      })
      .catch((e: any) => toast?.("Removed locally, but failed to sync — " + (e?.message || ""), "red"));
  };
  // FEATURE — "fire an employee and revoke their portal access... don't
  // delete their account. Also let the owner mark someone as on leave/break
  // so they can restore it exactly as it was before." Three real states now
  // (see App.tsx's resolveUserRole, which is what actually enforces this at
  // login — this page only ever sets the status field):
  //   "active"     — normal, full access.
  //   "leave"      — temporary (break/PTO/leave of absence). Access paused;
  //                  flipping back to "active" restores everything exactly
  //                  as it was, since nothing else about the row is touched.
  //   "terminated" — fired. Access permanently revoked; the record itself is
  //                  kept (not this action) so the owner can separately
  //                  delete it via the trash icon once they're ready to.
  // Payroll/hours filters throughout this page used to only exclude the
  // legacy "inactive" status — extended to also exclude the two new paused-
  // access states so a fired or on-leave employee doesn't keep counting
  // toward active payroll totals.
  const isWorking = (e: any) => !["inactive", "leave", "terminated"].includes(e.status);
  const setEmployeeStatus = (id: string, status: "active" | "leave" | "terminated") => {
    if (status === "terminated" && !confirm("Revoke this employee's portal access? Their account stays on file — you can restore access or delete them entirely at any time.")) return;
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    (supabase as any).from("employees").update({ status }).eq("id", id).select("id")
      .then((r: any) => {
        if (r?.error || !r?.data?.length) { toast?.("Failed to update access — " + (r?.error?.message || "try again"), "red"); return; }
        toast?.(status === "terminated" ? "Access revoked ✓" : status === "leave" ? "Marked on leave ✓" : "Access restored ✓", "green");
      })
      .catch((e: any) => toast?.("Failed to update access — " + (e?.message || ""), "red"));
  };

  const roles = ["Owner", "Manager", "Lead Technician", "Technician", "Helper", "Office", "Sales"];

  // FIX 4 — job.loggedHours (time on-site per job, see EmployeePortal.tsx's
  // finalizeCompletion) is the primary source, but employees.lastShiftHours/
  // lastShiftDate (the whole-day shift timer total, set on "End My Day") can
  // cover time no job captured at all — e.g. a shift ended before any job was
  // marked complete yet. The employees table only ever stores the SINGLE most
  // recent shift (no full daily history exists server-side), so this can only
  // top up that one day, but that's exactly the day most likely to be under-
  // counted mid-period. Only add the shortfall (shift total minus whatever
  // job hours already landed on that same date) so a shift that's already
  // fully reflected via completed jobs is never double-counted.
  const shiftTopUpHours = (emp: any, startDate: string, endDate: string): number => {
    // FIX 7 — an employee still clocked in (dayClockInAt set, "End My Day"
    // not pressed yet) previously contributed NOTHING to Hours/Payroll until
    // they actually ended their shift — lastShiftDate/lastShiftHours only
    // get written at that point (see EmployeePortal.tsx's toggleDay). That
    // made payroll look "stuck"/stale for anyone currently on the clock.
    // Mirrors EmployeePortal.tsx's own live netShiftHoursNow formula exactly
    // (dayClockInAt → now, minus paused/lunch minutes) so the two can't
    // disagree once the shift actually ends and lastShiftHours is written.
    let liveTopUp = 0;
    // BLOCKER 13 (mobile round 9) — shiftDayStr() (4am cutover), matching
    // how EmployeePortal.tsx's toggleDay now writes lastShiftDate, so a
    // shift straddling local midnight is treated as the same shift day on
    // both the employee and owner sides (otherwise this top-up and the
    // employee's own Resume-Day check could disagree right around midnight).
    const todayStr = shiftDayStr();
    if (emp?.dayClockInAt && todayStr >= startDate && todayStr <= endDate) {
      const dayPausedMinutes = Number(emp.dayPausedMinutes) || 0;
      const onLunch = !!emp.dayLunchStartAt;
      const currentPauseMs = onLunch ? Date.now() - emp.dayLunchStartAt : 0;
      const liveShiftHours = Math.max(0, (Date.now() - emp.dayClockInAt - dayPausedMinutes * 60000 - currentPauseMs) / 3600000);
      const jobHoursToday = jobs
        .filter((j: any) => crewIncludesEmployee(j.crew, emp.id, emp.user_id) && j.status === "completed" && j.scheduledDate === todayStr)
        .reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
      liveTopUp = Math.max(0, liveShiftHours - jobHoursToday);
    }
    const shiftDate = emp?.lastShiftDate;
    if (!shiftDate || shiftDate < startDate || shiftDate > endDate) return liveTopUp;
    const jobHoursOnShiftDate = jobs
      .filter((j: any) => crewIncludesEmployee(j.crew, emp.id, emp.user_id) && j.status === "completed" && j.scheduledDate === shiftDate)
      .reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
    const shiftTotal = Number(emp.lastShiftHours) || 0;
    const endedShiftTopUp = Math.max(0, shiftTotal - jobHoursOnShiftDate);
    // If the employee is currently clocked in for today AND has a
    // lastShiftDate that's also today (started, ended, then started again the
    // same day), don't double-count — the live figure already supersedes it.
    return shiftDate === todayStr && emp?.dayClockInAt ? liveTopUp : liveTopUp + endedShiftTopUp;
  };

  // Calculate real hours from jobs (loggedHours on jobs they're crewed on),
  // plus any uncaptured whole-day shift time (see shiftTopUpHours above).
  const getEmployeeHours = (empId, startDate, endDate) => {
    const emp = employees.find((e: any) => e.id === empId);
    const jobHours = jobs
      .filter(j => crewIncludesEmployee(j.crew, empId, emp?.user_id) && j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate)
      .reduce((s, j) => s + Number(j.loggedHours || j.duration || 0), 0);
    const topUp = emp ? shiftTopUpHours(emp, startDate, endDate) : 0;
    return jobHours + topUp;
  };

  // Pay must respect per-job-type rate overrides (getEffectiveRate), so it's
  // computed per-job (hours × that job's effective rate) then summed — a flat
  // hours-total × hourlyRate would ignore commercial/residential overrides.
  // The shift-timer top-up isn't tied to any one job, so it's paid at the
  // employee's plain hourlyRate.
  const getEmployeePay = (emp: any, startDate: string, endDate: string) => {
    // BLOCKER 10 (mobile round 9) — owner-only alternate pay bases. Revenue
    // and profit are computed company-wide across all completed jobs in the
    // pay period (not just jobs the owner personally worked), since "% of
    // revenue/profit" describes how the business compensates its owner, not
    // a per-job labor rate the way hourlyRate is for crew. Profit reuses the
    // same chemCost + laborCost + materialCost formula JobsPage's own
    // per-job "Profit breakdown" panel uses, so the two can't disagree.
    if (emp.role === "owner" && emp.payBasis && emp.payBasis !== "hourly") {
      if (emp.payBasis === "custom") return Number(emp.payCustomAmount) || 0;
      const periodJobs = jobs.filter((j: any) => j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate);
      const revenue = periodJobs.reduce((s: number, j: any) => s + (Number(j.amount) || 0), 0);
      const pct = (Number(emp.payPercent) || 0) / 100;
      if (emp.payBasis === "percent_revenue") return revenue * pct;
      if (emp.payBasis === "percent_profit") {
        const costs = periodJobs.reduce((s: number, j: any) => {
          const chemCost = (j.chemicalsUsed || []).reduce((cs: number, ch: any) => cs + Number(ch.cost || 0), 0);
          return s + chemCost + Number(j.laborCost || 0) + Number(j.materialCost || 0);
        }, 0);
        return Math.max(0, revenue - costs) * pct;
      }
    }
    const jobPay = jobs
      .filter((j: any) => crewIncludesEmployee(j.crew, emp.id, emp.user_id) && j.status === "completed" && j.scheduledDate >= startDate && j.scheduledDate <= endDate)
      .reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0) * getEffectiveRate(emp, j), 0);
    const topUp = shiftTopUpHours(emp, startDate, endDate);
    const topUpPay = topUp * (Number(emp.hourlyRate) || 0);
    if (topUp > 0) {
    }
    return jobPay + topUpPay;
  };

  // FIX 5 (mobile round 5) — was a strict e.status === "active" allowlist,
  // the same brittleness Dashboard.tsx's Live Crew View already learned not
  // to use (see its FIX 1 comment): any employee whose status field is
  // unset, differently-cased, or otherwise not the exact string "active"
  // silently vanished from Hours/Payroll — while the Team list above has no
  // status filter at all, so the same employee still showed up there,
  // making it look like "hours aren't showing" even though the underlying
  // job/pay math was correct the whole time. Only an explicit "inactive"
  // should ever exclude someone.
  const totalPayroll = employees.filter(e => isWorking(e)).reduce((s, e) => {
    return s + getEmployeePay(e, payPeriodStart, payPeriodEnd);
  }, 0);

  // FIX 7 — the only "Mark as Paid" control in this whole page used to live
  // inside the per-employee Edit modal (opened via the pencil icon on a Team
  // card) — the Payroll tab itself, where the owner is actually looking at
  // pay period data, had no way to mark anything paid at all. Same rolling
  // 14-day-period math and the same paidPeriods JSONB key (period start
  // date) as the modal's togglePeriod, so marking paid here and there can
  // never disagree — just usable directly from the Payroll tab.
  const getCurrentPayPeriod = (emp: any) => {
    const empJobs = jobs.filter((j: any) => crewIncludesEmployee(j.crew, emp.id, emp.user_id) && j.status === "completed" && Number(j.loggedHours) > 0);
    // ISSUE 2 — fixed-anchor period (see getPayPeriodBounds's comment) so
    // this can never disagree with the employee's own Pay tab, or with
    // itself on a later render/reload, the way a "today minus 13 days"
    // sliding window did.
    const { start: s, end: e } = getPayPeriodBounds();
    const pJobs = empJobs.filter((j: any) => j.scheduledDate >= s && j.scheduledDate <= e);
    const hrs = Math.round(pJobs.reduce((acc: number, j: any) => acc + Number(j.loggedHours || 0), 0) * 10) / 10;
    const pay = Math.round(pJobs.reduce((acc: number, j: any) => acc + Number(j.loggedHours || 0) * getEffectiveRate(emp, j), 0) * 100) / 100;
    const paidPeriods: Record<string, "paid" | "unpaid"> = emp.paidPeriods || {};
    return { start: s, end: e, hours: hrs, pay, status: paidPeriods[s] || "unpaid" };
  };
  const markPeriodPaidFor = (emp: any, periodStart: string, nextStatus: "paid" | "unpaid", periodEnd?: string, amount?: number) => {
    const next = { ...(emp.paidPeriods || {}), [periodStart]: nextStatus };
    // ITEM 5 — paidPeriods only ever recorded a status per period start date,
    // never WHEN a payment was actually made or how much — there was no way
    // to build the requested "calendar view of payments, with details of who
    // was paid and when." Append-only log, one entry per "Mark Paid" click
    // (never removed on an "unpaid" toggle-back, so the historical record of
    // what actually happened stays intact even if a mistake gets corrected).
    const nextLog = nextStatus === "paid"
      ? [...(emp.paymentLog || []), { id: uid(), periodStart, periodEnd: periodEnd || periodStart, amount: amount ?? 0, paidAt: Date.now() }]
      : (emp.paymentLog || []);
    setEmployees((prev: any[]) => prev.map(x => x.id === emp.id ? { ...x, paidPeriods: next, paymentLog: nextLog } : x));
    (supabase as any).from("employees").update({ paidPeriods: next, paymentLog: nextLog }).eq("id", emp.id).select("id")
      .then(async (r: any) => {
        if (!r?.error && (!Array.isArray(r?.data) || r.data.length === 0)) {
          toast?.("Saved locally, but the server didn't confirm the pay status — try again or refresh to check.", "red");
          return;
        }
        if (r?.error) {
          // BLOCKER — paidPeriods and paymentLog are two SEPARATE columns
          // (migration 0019); PostgREST rejects the WHOLE update if either
          // one doesn't exist on this deployment yet, which previously meant
          // a missing paymentLog column (added after paidPeriods in an
          // earlier round) silently blocked the paid/unpaid STATUS from
          // saving too — exactly "Mark as Paid doesn't work", with the real
          // cause being one column, not the feature itself. Retry with just
          // paidPeriods so the status still lands even if the log can't yet.
          console.warn("[MarkPaid] full update failed:", r.error.message, "— retrying with paidPeriods only");
          const retry = await (supabase as any).from("employees").update({ paidPeriods: next }).eq("id", emp.id).select("id");
          if (retry?.error || !Array.isArray(retry?.data) || retry.data.length === 0) {
            console.error("[MarkPaid] paidPeriods-only retry also failed:", retry?.error?.message || "matched 0 rows");
            toast?.("Failed to save pay status — " + (retry?.error?.message || "the server didn't confirm the update"), "red");
          } else {
            console.warn("[MarkPaid] saved paid/unpaid status, but the payment log (who/when/how much) couldn't save — run supabase/migrations/0019_employee_payment_log.sql");
            toast?.(nextStatus === "paid" ? `${emp.firstName} marked as paid ✓ (payment log needs a pending database migration)` : `${emp.firstName} marked as unpaid`, "yellow");
          }
          return;
        }
        toast?.(nextStatus === "paid" ? `${emp.firstName} marked as paid ✓` : `${emp.firstName} marked as unpaid`, "green");
      })
      .catch((e: any) => { console.error("[MarkPaid] threw:", e?.message); toast?.("Failed to save pay status — " + (e?.message || "unknown error"), "red"); });
  };

  // FEATURE — per-JOB paid/unpaid marking (owner request: "no job dollar
  // amounts, ... owner can't mark jobs as paid" — the period/day toggles
  // above don't cover marking one specific job's labor cost). Same
  // safe-column-retry shape as markPeriodPaidFor, keyed by job id instead of
  // a period/day string, on the new `paidJobs` column (migration 0022).
  const markJobPaidFor = (emp: any, jobId: string, nextStatus: "paid" | "unpaid") => {
    const next = { ...((emp as any).paidJobs || {}), [jobId]: nextStatus };
    setEmployees((prev: any[]) => prev.map(x => x.id === emp.id ? { ...x, paidJobs: next } : x));
    (supabase as any).from("employees").update({ paidJobs: next }).eq("id", emp.id).select("id")
      .then((r: any) => {
        if (r?.error) {
          console.error("[MarkJobPaid] failed:", r.error.message, "— run supabase/migrations/0022_employee_paid_jobs.sql");
          toast?.("Saved locally, but couldn't sync — " + r.error.message, "red");
        } else if (!Array.isArray(r?.data) || r.data.length === 0) {
          toast?.("Saved locally, but the server didn't confirm the update — try again or refresh to check.", "red");
        } else {
          toast?.(nextStatus === "paid" ? "Job marked as paid ✓" : "Job marked as unpaid", "green");
        }
      })
      .catch((e: any) => toast?.("Saved locally, but couldn't sync — " + (e?.message || "unknown error"), "red"));
  };

  // Owner-editable hours per job, reachable directly from Payroll/Hours
  // instead of only via JobDetailModal (which isn't mounted on this page at
  // all — see the per-job breakdown rows below).
  const updateJobHours = (jobId: string, nextHours: number) => {
    setJobs((prev: any[]) => prev.map(j => j.id === jobId ? { ...j, loggedHours: nextHours } : j));
    (supabase as any).from("jobs").update({ loggedHours: nextHours }).eq("id", jobId).select("id")
      .then((r: any) => {
        if (r?.error) { toast?.("Saved locally, but couldn't sync hours — " + r.error.message, "red"); return; }
        if (!Array.isArray(r?.data) || r.data.length === 0) { toast?.("Saved locally, but the server didn't confirm the update — try again or refresh to check.", "red"); return; }
        toast?.("Hours updated ✓", "green");
      })
      .catch((e: any) => toast?.("Saved locally, but couldn't sync hours — " + (e?.message || "unknown error"), "red"));
  };

  // Shared per-job breakdown row — used in both the Payroll tab card and the
  // Hours tab's expandable row, so "owner edit hours" and "mark job paid"
  // work identically wherever they're used. A plain function returning JSX,
  // NOT a component defined inline (see EmployeePortal.tsx's JobDetailView
  // comment / docs/ARCHITECTURE.md's "BUG 4" note) — a nested component definition gets
  // a new function identity every render, which React treats as a different
  // element type and remounts, causing flicker on a page that re-renders on
  // every jobs/employees poll.
  const renderJobBreakdownRow = (emp: any, j: any) => {
    const rate = getEffectiveRate(emp, j);
    const jobPay = Number(j.loggedHours || 0) * rate;
    const paidJobs: Record<string, "paid" | "unpaid"> = (emp as any).paidJobs || {};
    const status = paidJobs[j.id] || "unpaid";
    return (
      <div key={j.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-black/30 rounded-lg text-[11px]">
        <div className="flex-1 min-w-0 truncate text-white/70">{j.scheduledDate} · {j.address?.split(",")[0] || "—"}</div>
        <input
          type="number" min="0" step="0.25"
          defaultValue={j.loggedHours || 0}
          key={j.id + ":" + j.loggedHours}
          onBlur={e => {
            const next = Math.max(0, Number(e.target.value) || 0);
            if (next !== (j.loggedHours || 0)) updateJobHours(j.id, next);
          }}
          className="w-14 text-center bg-black/40 border border-white/10 rounded-md text-white/80 focus:border-brand-500/60 focus:outline-none"
        />
        <span className="text-white/40 w-1">h</span>
        <span className="text-white/60 w-16 text-right">{fmt(jobPay)}</span>
        <button
          onClick={() => markJobPaidFor(emp, j.id, status === "paid" ? "unpaid" : "paid")}
          className={"text-[9px] font-bold px-2 py-1 rounded-full flex-shrink-0 transition " + (status === "paid" ? "bg-green-700 text-white" : "bg-yellow-950/40 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/40")}
        >
          {status === "paid" ? "✓ Paid" : "Mark Paid"}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {planLimits && (
        <UpgradePrompt
          open={upgradePromptOpen}
          onClose={() => setUpgradePromptOpen(false)}
          onUpgrade={() => { setUpgradePromptOpen(false); onUpgrade(); }}
          tier={planLimits.tier}
          resource="team members"
          limit={planLimits.employeeSeats || 0}
        />
      )}
      {planLimits?.employeeSeats !== null && planLimits && (
        <div className={"flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs " + (atSeatLimit ? "bg-brand-950/20 border-brand-700/40 text-brand-300" : "bg-white/5 border-white/10 text-white/50")}>
          <span>{seatCount} / {planLimits.employeeSeats} team seats used on {planLimits.tier === "solo" ? "the Solo plan" : "the Free plan"}</span>
          <button onClick={onUpgrade} className="text-brand-400 hover:text-brand-300 font-semibold flex-shrink-0">Upgrade →</button>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-black/40 border border-brand-900/30 rounded-xl p-1">
            {["list","hours","payroll","mileage"].map(v => <button key={v} onClick={() => setView(v)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition " + (view === v ? "bg-brand-600 text-brand-fg" : "text-white/50 hover:text-white")}>{v === "hours" ? "⏱ Hours" : v === "payroll" ? "💰 Payroll" : v === "mileage" ? "🚗 Mileage" : "👥 Team"}</button>)}
          </div>
          <div className="text-xs text-white/50">{employees.filter(e => isWorking(e)).length} active</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowPortalInfo(!showPortalInfo)} className="text-xs px-3 py-1.5 bg-black/40 border border-blue-700/40 text-blue-300 hover:bg-blue-950/30 rounded-xl transition flex items-center gap-1.5">
            <Globe size={12} />Team Portal
          </button>
          <GBtn onClick={openAddTeamMember}><Plus size={14} className="inline mr-1.5" />Add Team Member</GBtn>
        </div>
      </div>

      {showPortalInfo && (
        <div className="p-4 rounded-2xl bg-blue-950/20 border border-blue-700/30 space-y-3">
          <div className="text-sm font-semibold text-blue-300">Team Portal Access</div>
          <div className="text-xs text-white/60 leading-relaxed">
            Share this link with your employees. They create their own account with their work email, then see a limited view with only their assigned jobs, checklists, and pay summary.
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white/60 truncate">{portalUrl}</div>
            <button onClick={() => { navigator.clipboard.writeText(portalUrl); }} className="px-3 py-2 bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs rounded-xl hover:bg-blue-800/40 transition flex items-center gap-1"><Copy size={12} />Copy</button>
          </div>
          <div className="text-[11px] text-white/40">
            <strong className="text-white/60">Important:</strong> After an employee creates their account, make sure their email in this roster matches exactly. The portal matches by email to pull their jobs and pay info.
          </div>
        </div>
      )}

      {view === "list" && <div className="grid md:grid-cols-2 gap-4">
        {employees.map(e => (
          <Glass key={e.id} className={"p-4 group " + (!isWorking(e) ? "opacity-60" : "")}>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center text-base font-bold flex-shrink-0 text-brand-fg">{e.firstName?.[0]}{e.lastName?.[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{e.firstName} {e.lastName}</span>
                  <Badge tone={e.status === "terminated" ? "red" : e.status === "leave" ? "yellow" : e.status === "active" || !e.status ? "green" : "gray"}>
                    {e.status === "terminated" ? "Access Revoked" : e.status === "leave" ? "On Leave" : (e.status || "active")}
                  </Badge>
                  <Badge tone="blue">{e.role}</Badge>
                  {e.email && <Badge tone="gray">Portal Ready</Badge>}
                </div>
                <div className="text-xs text-white/60 mt-1 space-y-0.5">
                  {e.phone && <div className="flex items-center gap-1"><Phone size={10} />{e.phone}</div>}
                  {e.email && <div className="flex items-center gap-1"><Mail size={10} />{e.email}</div>}
                  <div className="flex items-center gap-1"><DollarSign size={10} />{fmt(e.hourlyRate)}/hr</div>
                  {e.startDate && <div className="flex items-center gap-1"><Calendar size={10} />Started {e.startDate}</div>}
                </div>
                {e.notes && <div className="text-[10px] text-white/40 mt-1 italic">{e.notes}</div>}
                {onboardingByEmployee[e.id] && (() => {
                  const items = onboardingByEmployee[e.id].items || [];
                  const doneCount = items.filter((it: any) => it.done).length;
                  const complete = items.length > 0 && doneCount === items.length;
                  return (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <CheckSquare size={10} className={complete ? "text-green-400" : "text-white/30"} />
                      <span className={"text-[10px] " + (complete ? "text-green-400" : "text-white/40")}>
                        Onboarding {doneCount}/{items.length}{complete ? " complete" : ""}
                      </span>
                      <div className="flex-1 max-w-[80px] h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className={"h-full rounded-full " + (complete ? "bg-green-500" : "bg-blue-500")} style={{ width: (items.length ? (doneCount / items.length) * 100 : 0) + "%" }} />
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                <button onClick={() => setModal({ open: true, data: e })} title="Edit" className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><Edit size={12} /></button>
                {e.status === "active" || !e.status ? (
                  <>
                    <button onClick={() => setEmployeeStatus(e.id, "leave")} title="Mark on leave/break (temporary)" className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/50 hover:text-yellow-400"><EyeOff size={12} /></button>
                    <button onClick={() => setEmployeeStatus(e.id, "terminated")} title="Fire — revoke access, keep record" className="p-1.5 rounded-lg hover:bg-danger-900/30 text-white/50 hover:text-danger-400"><UserX size={12} /></button>
                  </>
                ) : (
                  <button onClick={() => setEmployeeStatus(e.id, "active")} title="Restore access — exactly as it was" className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/50 hover:text-green-400"><Eye size={12} /></button>
                )}
                <button onClick={() => del(e.id)} title="Delete account permanently" className="p-1.5 rounded-lg hover:bg-danger-900/30 text-white/50 hover:text-danger-400"><Trash2 size={12} /></button>
              </div>
            </div>
          </Glass>
        ))}
        {employees.length === 0 && <div className="md:col-span-2 text-center py-16 text-white/40"><Users2 size={40} className="mx-auto mb-3 opacity-30" /><div>No employees yet</div></div>}
      </div>}

      {view === "hours" && <>
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>Range:</span>
            <GDate value={hoursRangeStart} onChange={e => setHoursRangeStart(e.target.value)} className="!text-xs !py-1.5 !w-36" />
            <span>to</span>
            <GDate value={hoursRangeEnd} onChange={e => setHoursRangeEnd(e.target.value)} className="!text-xs !py-1.5 !w-36" />
          </div>
          <div className="flex gap-1">
            <button onClick={jumpHoursToLast30} className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white/60 hover:text-white text-xs transition">
              Last 30 Days
            </button>
            <button onClick={jumpHoursToAllTime} className={"px-2.5 py-1 rounded-lg border text-xs transition " + (isHoursAllTime ? "bg-blue-900/40 border-blue-600/50 text-blue-200" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
              All Time
            </button>
            <button onClick={jumpHoursToCurrentPayPeriod} className="px-2.5 py-1 rounded-lg bg-green-950/30 border border-green-700/40 text-green-300 hover:bg-green-900/40 text-xs transition" title="Jump to the actual current 14-day pay period">
              This Pay Period
            </button>
          </div>
          <div className="flex gap-1">
            <button onClick={() => {
              const s = new Date(hoursRangeStart); s.setDate(s.getDate() - 7);
              const e = new Date(hoursRangeEnd); e.setDate(e.getDate() - 7);
              setHoursRangeStart(s.toISOString().slice(0, 10)); setHoursRangeEnd(e.toISOString().slice(0, 10));
            }} className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white/50 hover:text-white text-xs transition flex items-center gap-1">
              <ChevronLeft size={11} />Prev Week
            </button>
            <button
              disabled={hoursRangeEnd >= today()}
              onClick={() => {
                const s = new Date(hoursRangeStart); s.setDate(s.getDate() + 7);
                const e = new Date(hoursRangeEnd); e.setDate(e.getDate() + 7);
                const nextEnd = e.toISOString().slice(0, 10);
                // ISSUE 6 — Hours is a timesheet view; letting the owner page
                // into future weeks showed an all-zero table that looked broken.
                // Clamp the window so it never starts past today.
                if (nextEnd > today()) { setHoursRangeStart(today()); setHoursRangeEnd(today()); return; }
                setHoursRangeStart(s.toISOString().slice(0, 10)); setHoursRangeEnd(nextEnd);
              }}
              className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white/50 hover:text-white text-xs transition flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed">
              Next Week<ChevronRight size={11} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60 ml-auto">
            <span>Employee:</span>
            <GSel value={hoursEmpFilter} onChange={e => setHoursEmpFilter(e.target.value)} className="!text-xs !py-1.5 !w-44">
              <option value="">All employees</option>
              {employees.filter(e => isWorking(e)).map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}
            </GSel>
          </div>
        </div>
        {/* Mobile: stacked cards — the 8-column table below requires
            horizontal scrolling to see Rate/Est. Pay/paid status on a narrow
            screen, so mobile gets a wrapped/stacked layout instead. */}
        <div className="sm:hidden space-y-2">
          {employees.filter(e => isWorking(e) && (!hoursEmpFilter || e.id === hoursEmpFilter)).map(e => {
            const empJobs = jobs.filter(j => crewIncludesEmployee(j.crew, e.id, (e as any).user_id) && j.status === "completed" && j.scheduledDate >= hoursRangeStart && j.scheduledDate <= hoursRangeEnd);
            const hrs = getEmployeeHours(e.id, hoursRangeStart, hoursRangeEnd);
            const cost = getEmployeePay(e, hoursRangeStart, hoursRangeEnd);
            const todayStr = shiftDayStr();
            const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
            const allCompleted = jobs.filter((j: any) => crewIncludesEmployee(j.crew, e.id, (e as any).user_id) && j.status === "completed");
            const hoursToday = allCompleted.filter((j: any) => j.scheduledDate === todayStr).reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
            const hoursWeek = allCompleted.filter((j: any) => j.scheduledDate >= weekStart).reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
            const expanded = expandedHoursEmpId === e.id;
            return (
              <Glass key={e.id} className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold shrink-0 text-brand-fg">{e.firstName?.[0]}</div>
                  <div className="flex-1 min-w-0 font-medium truncate flex items-center gap-1.5">{e.firstName} {e.lastName}{(e as any).dayClockInAt && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" title="On the clock now" />}</div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-brand-400">{fmt(cost)}</div>
                    <div className="text-[10px] text-white/40">{fmt(e.hourlyRate)}/hr</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-white/10 text-center">
                  <div><div className="text-[9px] uppercase tracking-wider text-white/40">Today</div><div className="text-xs text-white/70">{hoursToday.toFixed(1)}h</div></div>
                  <div><div className="text-[9px] uppercase tracking-wider text-white/40">Week</div><div className="text-xs text-white/70">{hoursWeek.toFixed(1)}h</div></div>
                  <div><div className="text-[9px] uppercase tracking-wider text-white/40">Jobs</div><div className="text-xs text-white/60">{empJobs.length}</div></div>
                  <div><div className="text-[9px] uppercase tracking-wider text-white/40">Range</div><div className="text-xs text-white/80">{hrs.toFixed(1)}h</div></div>
                </div>
                {empJobs.length > 0 && (
                  <button onClick={() => setExpandedHoursEmpId(expanded ? null : e.id)} className="w-full mt-2 pt-2 border-t border-white/10 flex items-center justify-center gap-1 text-[11px] text-white/50 hover:text-white transition">
                    {expanded ? "Hide" : "Show"} paid/unpaid per shift <ChevronRight size={12} className={"transition-transform " + (expanded ? "rotate-90" : "")} />
                  </button>
                )}
                {expanded && (
                  <div className="space-y-1 mt-2">
                    {empJobs.map(j => renderJobBreakdownRow(e, j))}
                  </div>
                )}
              </Glass>
            );
          })}
          <Glass className="p-3 !bg-brand-950/20 !border-brand-900/30 flex items-center justify-between">
            <div className="text-xs font-bold">Total{hoursEmpFilter ? "" : " Payroll"} Est.<div className="text-[10px] font-normal text-white/40">{isHoursAllTime ? "all time" : hoursRangeStart + " – " + hoursRangeEnd}</div></div>
            <div className="text-brand-400 font-bold text-base">
              {fmt(employees.filter(e => isWorking(e) && (!hoursEmpFilter || e.id === hoursEmpFilter)).reduce((s, e) => s + getEmployeePay(e, hoursRangeStart, hoursRangeEnd), 0))}
            </div>
          </Glass>
        </div>

        <Glass className="overflow-hidden hidden sm:block">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/30 bg-black/40">
              <th className="text-left px-4 py-3 text-xs uppercase tracking-wider text-white/60">Employee</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Today</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">This Week</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Jobs</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Range Hours</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Rate</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60">Est. Pay</th>
              <th className="text-right px-4 py-3 text-xs uppercase tracking-wider text-white/60"></th>
            </tr></thead>
            <tbody>
              {employees.filter(e => isWorking(e) && (!hoursEmpFilter || e.id === hoursEmpFilter)).map(e => {
                const empJobs = jobs.filter(j => crewIncludesEmployee(j.crew, e.id, (e as any).user_id) && j.status === "completed" && j.scheduledDate >= hoursRangeStart && j.scheduledDate <= hoursRangeEnd);
                // FIX 5 (mobile round 5) — was job.loggedHours only, missing
                // the shift-timer top-up getEmployeeHours (used everywhere
                // else in this file, e.g. the Payroll tab/CSV export below)
                // already accounts for — an employee currently clocked in, or
                // who ended a shift without every minute captured on a
                // completed job, showed fewer "Range Hours" here than their
                // actual Payroll-tab total.
                const hrs = getEmployeeHours(e.id, hoursRangeStart, hoursRangeEnd);
                const cost = getEmployeePay(e, hoursRangeStart, hoursRangeEnd);
                // AUDIT — this [Hours] trace (BLOCKER 2, mobile round 9)
                // logged once per employee on every render of this table,
                // which re-renders on every jobs/employees poll while the
                // Hours tab is open — a real console flood, multiplied by
                // headcount. Crew matching is confirmed working; removed.
                // ITEM 7 — plain today() rolls over at local midnight (UTC,
                // actually — see today()'s own comment), so a completed
                // night-shift job still gets dropped from "Today" hours the
                // moment the calendar date changes. shiftDayStr()'s 4am
                // cutover matches getEmployeeHours' own already-fixed use
                // above (line 282), so this column can't disagree with it.
                const todayStr = shiftDayStr();
                const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
                const allCompleted = jobs.filter((j: any) => crewIncludesEmployee(j.crew, e.id, (e as any).user_id) && j.status === "completed");
                const hoursToday = allCompleted.filter((j: any) => j.scheduledDate === todayStr).reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
                const hoursWeek = allCompleted.filter((j: any) => j.scheduledDate >= weekStart).reduce((s: number, j: any) => s + Number(j.loggedHours || j.duration || 0), 0);
                const expanded = expandedHoursEmpId === e.id;
                return <React.Fragment key={e.id}>
                <tr className="border-b border-brand-900/10 hover:bg-white/5">
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-brand-fg">{e.firstName?.[0]}</div>{e.firstName} {e.lastName}{(e as any).dayClockInAt && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" title="On the clock now" />}</div></td>
                  <td className="px-4 py-3 text-right text-white/70">{hoursToday.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-white/70">{hoursWeek.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-white/60">{empJobs.length}</td>
                  <td className="px-4 py-3 text-right text-white/80">{hrs.toFixed(1)}h</td>
                  <td className="px-4 py-3 text-right text-white/60">{fmt(e.hourlyRate)}/hr</td>
                  <td className="px-4 py-3 text-right font-bold text-brand-400">{fmt(cost)}</td>
                  <td className="px-2 py-3 text-right">
                    {empJobs.length > 0 && (
                      <button onClick={() => setExpandedHoursEmpId(expanded ? null : e.id)} className="p-1 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition" title="Show paid/unpaid per shift">
                        <ChevronRight size={14} className={"transition-transform " + (expanded ? "rotate-90" : "")} />
                      </button>
                    )}
                  </td>
                </tr>
                {expanded && (
                  <tr className="border-b border-brand-900/10 bg-black/20">
                    <td colSpan={8} className="px-4 py-2.5">
                      <div className="space-y-1">
                        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Paid/unpaid per shift — edit hours or mark paid</div>
                        {empJobs.map(j => renderJobBreakdownRow(e, j))}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>;
              })}
              <tr className="bg-brand-950/20 font-bold border-t border-brand-900/30">
                <td className="px-4 py-3" colSpan={6}>Total{hoursEmpFilter ? "" : " Payroll"} Est. ({isHoursAllTime ? "all time" : hoursRangeStart + " – " + hoursRangeEnd})</td>
                <td className="px-4 py-3 text-right text-brand-400 text-base">
                  {fmt(employees.filter(e => isWorking(e) && (!hoursEmpFilter || e.id === hoursEmpFilter)).reduce((s, e) => s + getEmployeePay(e, hoursRangeStart, hoursRangeEnd), 0))}
                </td>
                <td></td>
              </tr>
            </tbody>
          </table>
          <div className="p-3 text-[10px] text-white/30 border-t border-brand-900/20">Hours pulled from logged time on completed jobs assigned to each crew member. Add hours via the clock in/out button on job cards.</div>
        </Glass>
      </>}

      {view === "payroll" && <div className="space-y-4">
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span>Pay period:</span>
            <GDate value={payPeriodStart} onChange={e => setPayPeriodStart(e.target.value)} className="!text-xs !py-1.5 !w-36" />
            <span>—</span>
            <GDate value={payPeriodEnd} onChange={e => setPayPeriodEnd(e.target.value)} className="!text-xs !py-1.5 !w-36" />
          </div>
          {/* Quick period navigation — jump back/forward 14 days */}
          <div className="flex gap-1">
            <button onClick={() => {
              const s = new Date(payPeriodStart); s.setDate(s.getDate() - 14);
              const e = new Date(payPeriodEnd); e.setDate(e.getDate() - 14);
              setPayPeriodStart(s.toISOString().slice(0, 10)); setPayPeriodEnd(e.toISOString().slice(0, 10));
            }} className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white/50 hover:text-white text-xs transition flex items-center gap-1">
              <ChevronLeft size={11} />Prev
            </button>
            <button onClick={() => {
              const s = new Date(payPeriodStart); s.setDate(s.getDate() + 14);
              const e = new Date(payPeriodEnd); e.setDate(e.getDate() + 14);
              setPayPeriodStart(s.toISOString().slice(0, 10)); setPayPeriodEnd(e.toISOString().slice(0, 10));
            }} className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white/50 hover:text-white text-xs transition flex items-center gap-1">
              Next<ChevronRight size={11} />
            </button>
            <button onClick={() => {
              const now = new Date();
              setPayPeriodStart(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10));
              setPayPeriodEnd(today());
            }} className="px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-white/50 hover:text-white text-xs transition">
              This Month
            </button>
          </div>
          <button onClick={() => {
            const rows = employees.filter(e => isWorking(e)).map(e => {
              const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
              const gross = getEmployeePay(e, payPeriodStart, payPeriodEnd);
              const fica = gross * 0.0765;
              const net = gross - fica;
              return `${e.firstName} ${e.lastName},${e.role},${hrs.toFixed(1)},${e.hourlyRate},${gross.toFixed(2)},${fica.toFixed(2)},${net.toFixed(2)}`;
            }).join("\n");
            const csv = "Name,Role,Hours,Rate,Gross,FICA (7.65%),Net\n" + rows;
            const blob = new Blob([csv], { type: "text/csv" });
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "payroll-" + payPeriodStart + ".csv"; a.click();
          }} className="text-xs px-3 py-1.5 bg-black/40 border border-brand-900/30 text-white/60 hover:text-white rounded-xl transition flex items-center gap-1"><Download size={12} />Export CSV</button>
        </div>
        <PayrollCalendar employees={employees} jobs={jobs} />
        <div className="grid gap-4">
          {employees.filter(e => isWorking(e)).map(e => {
            const hrs = getEmployeeHours(e.id, payPeriodStart, payPeriodEnd);
            const gross = getEmployeePay(e, payPeriodStart, payPeriodEnd);
            const fica = gross * 0.0765;
            const net = gross - fica;
            const empJobs = jobs.filter(j => crewIncludesEmployee(j.crew, e.id, (e as any).user_id) && j.status === "completed" && j.scheduledDate >= payPeriodStart && j.scheduledDate <= payPeriodEnd);
            // FIX 7 — current rolling 14-day pay period + paid/unpaid status,
            // so "Mark as Paid" is available right here instead of only
            // inside the separate per-employee Edit modal.
            const currentPeriod = getCurrentPayPeriod(e);
            return <Glass key={e.id} className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center font-bold text-brand-fg">{e.firstName?.[0]}{e.lastName?.[0]}</div>
                <div className="flex-1"><div className="font-semibold">{e.firstName} {e.lastName}</div><div className="text-xs text-white/50">{e.role} · {fmt(e.hourlyRate)}/hr</div></div>
                <div className="text-right"><div className="text-xl font-black text-green-400">{fmt(net)}</div><div className="text-[10px] text-white/40">net pay</div></div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-xs text-center">
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Jobs</div><div className="font-bold">{empJobs.length}</div></div>
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Hours</div><div className="font-bold">{hrs.toFixed(1)}h</div></div>
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Gross</div><div className="font-bold text-brand-400">{fmt(gross)}</div></div>
                <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">FICA</div><div className="font-bold text-yellow-400">-{fmt(fica)}</div></div>
              </div>
              {empJobs.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Jobs this period — edit hours or mark paid</div>
                  {empJobs.map(j => renderJobBreakdownRow(e, j))}
                </div>
              )}
              {currentPeriod.hours > 0 && (
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-white/50">Current period ({currentPeriod.start} – {currentPeriod.end}): <span className="text-white/80 font-semibold">{currentPeriod.hours}h · {fmt(currentPeriod.pay)}</span></div>
                  <button onClick={() => markPeriodPaidFor(e, currentPeriod.start, currentPeriod.status === "paid" ? "unpaid" : "paid", currentPeriod.end, currentPeriod.pay)}
                    className={"text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 transition " + (currentPeriod.status === "paid" ? "bg-green-700 text-white" : "bg-yellow-950/40 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/40")}>
                    {currentPeriod.status === "paid" ? "✓ Paid" : "Mark Paid"}
                  </button>
                </div>
              )}
            </Glass>;
          })}
        </div>
        <Glass className="p-4 !bg-gradient-to-r !from-brand-950/30 !to-black/60 !border-brand-600/40 text-center">
          <div className="text-xs text-white/50 mb-1">Total Payroll Period {payPeriodStart} — {payPeriodEnd}</div>
          <div className="text-3xl font-black text-brand-400">{fmt(totalPayroll)}</div>
          <div className="text-[10px] text-white/30 mt-1">Gross · FICA employer match additional 7.65%</div>
        </Glass>
      </div>}

      {view === "mileage" && (() => {
        const empName = (id: string) => { const e = employees.find((x: any) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : "Unknown"; };
        const pending = mileageLogs.filter((m: any) => m.status === "pending");
        const reviewed = mileageLogs.filter((m: any) => m.status !== "pending");
        const IRS_MILEAGE_RATE = 0.67;
        return (
          <div className="space-y-4">
            <div className="text-xs text-white/40">Entries submitted by employees from their own portal (Pay tab → Log Mileage) sync to Expenses → Mileage automatically — no approval needed. Deny an entry here to pull it back out if it looks wrong.</div>
            <Glass className="overflow-hidden">
              <div className="px-4 py-3 border-b border-brand-900/30 bg-black/40 text-xs uppercase tracking-wider text-white/60">Needs a second look ({pending.length})</div>
              {pending.length === 0 && <div className="p-6 text-center text-white/30 text-sm">Nothing flagged</div>}
              {pending.map((m: any) => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 border-b border-brand-900/10 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{empName(m.employee_id)} · {m.date}</div>
                    <div className="text-xs text-white/50 truncate">{m.from || "—"} → {m.to || "—"} {m.purpose ? `· ${m.purpose}` : ""}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold">{m.miles}mi</div>
                    <div className="text-[10px] text-white/40">{fmt(Number(m.miles) * IRS_MILEAGE_RATE)}</div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => reviewMileageLog(m.id, "approved")} className="text-[10px] font-bold px-2.5 py-1.5 rounded-full bg-green-700 hover:bg-green-600 text-white transition">Approve</button>
                    <button onClick={() => reviewMileageLog(m.id, "denied")} className="text-[10px] font-bold px-2.5 py-1.5 rounded-full bg-danger-950/40 border border-danger-700/40 text-danger-300 hover:bg-danger-900/40 transition">Deny</button>
                  </div>
                </div>
              ))}
            </Glass>
            {reviewed.length > 0 && (
              <Glass className="overflow-hidden">
                <div className="px-4 py-3 border-b border-brand-900/30 bg-black/40 text-xs uppercase tracking-wider text-white/60">Reviewed</div>
                {reviewed.map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-brand-900/10 text-xs">
                    <div className="flex-1 min-w-0 text-white/60 truncate">{empName(m.employee_id)} · {m.date} · {m.from || "—"} → {m.to || "—"} · {m.miles}mi</div>
                    <Badge tone={m.status === "approved" ? "green" : "gray"}>{m.status}</Badge>
                    {m.status === "approved" && (
                      <button onClick={() => reviewMileageLog(m.id, "denied")} className="text-[10px] font-semibold px-2 py-1 rounded-full bg-danger-950/40 border border-danger-700/40 text-danger-300 hover:bg-danger-900/40 transition flex-shrink-0">Remove</button>
                    )}
                  </div>
                ))}
              </Glass>
            )}
          </div>
        );
      })()}

      {/* Active invites */}
      {invites.filter(i => !i.used).length > 0 && view === "list" && (
        <Glass className="p-4 !bg-green-950/10 !border-green-700/20">
          <div className="text-xs font-semibold text-green-300 mb-2 flex items-center gap-1.5"><UserCheck size={12} />Pending Invites</div>
          <div className="space-y-2">
            {invites.filter(i => !i.used).map(inv => (
              <div key={inv.code} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{inv.firstName} {inv.lastName} <span className="text-white/40">·</span> <span className="text-white/50">{inv.email}</span></div>
                  <div className="text-[10px] text-white/30 mt-0.5">{inv.role} · {fmt(inv.hourlyRate)}/hr · Sent {inv.createdAt}</div>
                </div>
                <button onClick={() => navigator.clipboard.writeText(inviteLink(inv.code))} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition flex-shrink-0">
                  <Copy size={11} />Copy Link
                </button>
                <button onClick={() => setInvites(prev => prev.filter(i => i.code !== inv.code))} className="text-white/30 hover:text-brand-400 flex-shrink-0 transition">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        </Glass>
      )}

      {/* Invite modal */}
      {/* Add Team Member chooser — the merged entry point for what used to be
          two separate toolbar buttons (Invite Member / Add Employee). */}
      <Modal open={addChooserOpen} onClose={() => setAddChooserOpen(false)} title="Add Team Member" maxW="max-w-sm">
        <div className="space-y-2">
          <button
            onClick={() => {
              setAddChooserOpen(false);
              setInviteOpen(true); setInviteCreated(null);
              setInviteF({ firstName: "", lastName: "", email: "", phone: "", role: "Technician", hourlyRate: 18, isNewHire: true });
              setInvitePerms({ ...DEFAULT_PERMS }); setInviteManagerPerms({ ...DEFAULT_MANAGER_PERMS }); setShowInvitePerms(false); setSendOnboardingPacket(true);
            }}
            className="w-full text-left p-3.5 rounded-xl border border-green-700/40 bg-green-950/10 hover:bg-green-950/25 transition flex items-start gap-3"
          >
            <UserCheck size={18} className="text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-green-300">New Hire — Send Invite Link</div>
              <div className="text-[11px] text-white/50 mt-0.5">They sign up themselves via a link (text or email), and go through onboarding — SOPs/checklist included if you've set one up.</div>
            </div>
          </button>
          <button
            onClick={() => { setAddChooserOpen(false); setModal({ open: true, data: null }); }}
            className="w-full text-left p-3.5 rounded-xl border border-white/10 bg-black/30 hover:bg-white/5 transition flex items-start gap-3"
          >
            <Plus size={18} className="text-white/60 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold">Already Working Here — Add Directly</div>
              <div className="text-[11px] text-white/50 mt-0.5">For an existing employee — add their record to the CRM now, no invite link or self-signup needed.</div>
            </div>
          </button>
        </div>
      </Modal>

      <Modal open={inviteOpen} onClose={() => { setInviteOpen(false); setInviteCreated(null); }} title="Invite Team Member" maxW="max-w-md">
        {!inviteCreated ? (
          <div className="space-y-3">
            <div className="text-xs text-white/50 leading-relaxed">
              Fill in the employee's details. An invite link will be generated that pre-creates their account in the roster. Share the link with the employee — they click it to sign up on the team portal.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-white/60 mb-1 block">First name *</label><GInput value={inviteF.firstName} onChange={e => setInviteF(p => ({ ...p, firstName: e.target.value }))} /></div>
              <div><label className="text-xs text-white/60 mb-1 block">Last name</label><GInput value={inviteF.lastName} onChange={e => setInviteF(p => ({ ...p, lastName: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-white/60 mb-1 block">Work email *</label><GInput type="email" value={inviteF.email} onChange={e => setInviteF(p => ({ ...p, email: e.target.value }))} placeholder="employee@example.com" /></div>
              <div><label className="text-xs text-white/60 mb-1 block">Phone <span className="text-white/30 font-normal">(to text the link)</span></label><GInput type="tel" value={inviteF.phone} onChange={e => setInviteF(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 555-0100" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-white/60 mb-1 block">Role</label>
                <GSel value={inviteF.role} onChange={e => setInviteF(p => ({ ...p, role: e.target.value }))}>
                  {["Technician","Lead Technician","Manager","Helper","Office","Sales"].map(r => <option key={r} value={r} className="bg-black">{r}</option>)}
                </GSel>
              </div>
              <div><label className="text-xs text-white/60 mb-1 block">Hourly Rate ($)</label><GInput type="number" step="0.5" value={inviteF.hourlyRate} onChange={e => setInviteF(p => ({ ...p, hourlyRate: Number(e.target.value) }))} /></div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer py-1.5 px-3 border border-white/10 rounded-xl bg-black/30">
              <input type="checkbox" checked={inviteF.isNewHire} onChange={e => setInviteF(p => ({ ...p, isNewHire: e.target.checked }))}
                className="w-3.5 h-3.5 accent-brand-600 flex-shrink-0" />
              <div className="text-xs text-white/80">This is a new hire <span className="text-white/40">(flags their record for onboarding tracking)</span></div>
            </label>
            {/* FEATURE — new-hire onboarding packet. Only shown when the owner
                has actually built a template (Settings → Templates →
                Onboarding Packet); nothing to send otherwise. */}
            {onboardingTemplateItems.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer py-1.5 px-3 border border-green-700/30 rounded-xl bg-green-950/10">
                <input type="checkbox" checked={sendOnboardingPacket} onChange={e => setSendOnboardingPacket(e.target.checked)}
                  className="w-3.5 h-3.5 accent-green-600 flex-shrink-0" />
                <div>
                  <div className="text-xs text-white/80">Send onboarding packet</div>
                  <div className="text-[10px] text-white/40">Assigns this employee the {onboardingTemplateItems.length}-item onboarding checklist — they'll see it in their portal.</div>
                </div>
              </label>
            )}
            {/* Manager CRM permissions — only relevant when inviting a Manager.
                Full CRM access by default EXCLUDES these areas; the owner
                opts a manager INTO them here rather than out of them. */}
            {inviteF.role === "Manager" && (
              <div className="border border-purple-700/30 rounded-xl p-3 bg-purple-950/10 space-y-1">
                <div className="text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5"><Shield size={12} />Manager CRM Access</div>
                <div className="text-[10px] text-white/40 mb-2">Managers get full CRM access except these areas — check any you want to grant.</div>
                {MANAGER_CRM_PERM_DEFS.map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer py-1 group">
                    <input type="checkbox" checked={!!inviteManagerPerms[key]} onChange={e => setInviteManagerPerms(p => ({ ...p, [key]: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-purple-600 flex-shrink-0" />
                    <div>
                      <div className="text-xs text-white/80 group-hover:text-white transition">{label}</div>
                      <div className="text-[10px] text-white/40">{desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {/* Permissions editor */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowInvitePerms(o => !o)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition"
              >
                <span className="flex items-center gap-1.5"><Shield size={12} />Permissions</span>
                <span className="text-[10px] text-white/40">{showInvitePerms ? "▲ collapse" : "▼ expand"}</span>
              </button>
              {showInvitePerms && (
                <div className="px-3 pb-3 space-y-1 border-t border-white/10">
                  <div className="flex gap-3 pt-2 pb-1">
                    <button onClick={() => setInvitePerms(Object.fromEntries(PERMISSION_DEFS_EMP.map(d => [d.key, true])))} className="text-[10px] text-blue-400 hover:text-blue-300 transition">Select All</button>
                    <button onClick={() => setInvitePerms(Object.fromEntries(PERMISSION_DEFS_EMP.map(d => [d.key, false])))} className="text-[10px] text-brand-400 hover:text-brand-300 transition">Deselect All</button>
                  </div>
                  {PERMISSION_DEFS_EMP.map((def) => {
                    const nested = "nestedUnder" in def ? (def as any).nestedUnder as string : null;
                    if (nested && !invitePerms[nested]) return null;
                    return (
                      <label key={def.key} className={"flex items-center gap-2 cursor-pointer py-1 group" + (nested ? " pl-5" : "")}>
                        <input type="checkbox" checked={!!invitePerms[def.key]} onChange={e => setInvitePerms(p => ({ ...p, [def.key]: e.target.checked }))}
                          className="w-3.5 h-3.5 accent-brand-600 flex-shrink-0" />
                        <div>
                          <div className="text-xs text-white/80 group-hover:text-white transition">{def.label}</div>
                          <div className="text-[10px] text-white/40">{def.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <GBtn variant="ghost" onClick={() => setInviteOpen(false)}>Cancel</GBtn>
              <GBtn onClick={generateInvite} disabled={!inviteF.firstName.trim() || !inviteF.email.trim()}>Generate Invite Link</GBtn>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-green-950/30 border border-green-700/30 flex items-center gap-2">
              <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
              <div className="text-sm text-green-300">Invite created for {inviteCreated.firstName} {inviteCreated.lastName}</div>
            </div>
            <div>
              <div className="text-xs text-white/50 mb-1">Share this link with the employee:</div>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-xs font-mono text-white/60 truncate">{inviteLink(inviteCreated.code)}</div>
                <button onClick={() => navigator.clipboard.writeText(inviteLink(inviteCreated.code))} className="px-3 py-2 bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs rounded-xl hover:bg-blue-800/40 transition flex items-center gap-1">
                  <Copy size={11} />Copy
                </button>
              </div>
              {/* FEATURE — "add a link you can send via text or email." Email
                  already auto-sends the moment the invite is created (see
                  generateInvite); this adds a resend + a text option for the
                  same link, using this employee's phone (if given above). */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={async () => {
                    setResendingInvite("email");
                    try {
                      await sendEmail(settings, {
                        to: inviteCreated.email,
                        subject: `You've been invited to join ${settings?.companyName || "your company"} on CRM Starter`,
                        body: emailShell(settings, "You're Invited", `<p>Hi ${inviteCreated.firstName},</p><p>Click below to create your employee account.</p>` + emailButton("Create Your Account", inviteLink(inviteCreated.code)) + `<p style="font-size:12px;color:#888;">Or paste this link in your browser:<br/><a href="${inviteLink(inviteCreated.code)}">${inviteLink(inviteCreated.code)}</a></p>`),
                      });
                      toast("Invite email sent ✓", "green");
                    } catch (e: any) { toast("Couldn't send email — " + (e?.message || "unknown error"), "red"); }
                    finally { setResendingInvite(null); }
                  }}
                  disabled={resendingInvite === "email"}
                  className="flex-1 px-3 py-1.5 bg-black/40 border border-white/10 text-white/60 hover:text-white text-[11px] rounded-lg transition disabled:opacity-50"
                >{resendingInvite === "email" ? "Sending…" : "✉ Resend Email"}</button>
                <button
                  onClick={async () => {
                    if (!inviteCreated.phone) { toast("No phone number on file for this invite — add one and re-create it, or just copy the link", "yellow"); return; }
                    if (!settings?.twilioSid) { toast("Connect Twilio in Settings to text invite links", "yellow"); return; }
                    setResendingInvite("sms");
                    try {
                      await twilioSend(settings, inviteCreated.phone, `You've been invited to join ${settings?.companyName || "the team"}! Create your account: ${inviteLink(inviteCreated.code)}`);
                      toast("Invite texted ✓", "green");
                    } catch (e: any) { toast("Couldn't send text — " + (e?.message || "unknown error"), "red"); }
                    finally { setResendingInvite(null); }
                  }}
                  disabled={resendingInvite === "sms"}
                  className="flex-1 px-3 py-1.5 bg-black/40 border border-white/10 text-white/60 hover:text-white text-[11px] rounded-lg transition disabled:opacity-50"
                >{resendingInvite === "sms" ? "Sending…" : "💬 Text Link"}</button>
              </div>
            </div>
            <Glass className="p-3 !bg-black/40">
              <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5">Instructions for employee</div>
              <div className="text-xs text-white/60 space-y-1 leading-relaxed">
                <div>1. Open the invite link above</div>
                <div>2. Click "Create Account" and sign up with <strong className="text-white/80">{inviteCreated.email}</strong></div>
                <div>3. They'll land on the Team Portal with their schedule and pay info</div>
              </div>
            </Glass>
            <div className="text-[10px] text-white/30">
              Invite code: <span className="font-mono text-white/50">{inviteCreated.code}</span> · Their email must match exactly: <span className="font-mono text-white/50">{inviteCreated.email}</span>
            </div>
            <div className="flex justify-end">
              <GBtn onClick={() => { setInviteOpen(false); setInviteCreated(null); }}>Done</GBtn>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modal.open} onClose={() => setModal({ open: false, data: null })} title={modal.data ? "Edit Employee" : "Add Employee"} maxW="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">First name</label><GInput value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Last name</label><GInput value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Role</label><GSel value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>{roles.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}</GSel></div>
            <div><label className="text-xs text-white/60 mb-1 block">Default Hourly Rate ($)</label><GInput type="number" step="0.5" value={f.hourlyRate} onChange={e => setF({ ...f, hourlyRate: Number(e.target.value) })} /></div>
          </div>
          <div className="border border-white/10 rounded-xl p-3">
            <div className="text-xs font-semibold text-white/70 mb-2 flex items-center gap-1.5"><Percent size={12} />Job-Type Rate Overrides</div>
            <div className="text-[10px] text-white/40 mb-2">Leave blank to use the default hourly rate above. When a job is marked residential or commercial, its logged hours are paid at the matching override.</div>
            <div className="grid grid-cols-2 gap-2">
              {["residential", "commercial"].map(jt => (
                <div key={jt}>
                  <label className="text-xs text-white/60 mb-1 block capitalize">{jt} ($/hr)</label>
                  <GInput
                    type="number" step="0.5"
                    placeholder={String(f.hourlyRate)}
                    value={(f.jobTypeRates || {})[jt] ?? ""}
                    onChange={e => {
                      const v = e.target.value;
                      setF((p: any) => {
                        const next = { ...(p.jobTypeRates || {}) };
                        if (v === "") delete next[jt]; else next[jt] = Number(v);
                        return { ...p, jobTypeRates: next };
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          {/* BLOCKER 10 (mobile round 9) — "owner can set how they pay
              themselves (hourly, % profit, % revenue, custom)". Only shown
              for the owner's own record — a technician's pay stays plain
              hourly (with the job-type overrides above). getEmployeePay
              below branches on payBasis for role === "owner" only. */}
          {f.role === "owner" && (
            <div className="border border-purple-700/30 rounded-xl p-3 bg-purple-950/10 space-y-2">
              <div className="text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5"><DollarSign size={12} />How You Get Paid</div>
              <GSel value={f.payBasis || "hourly"} onChange={e => setF({ ...f, payBasis: e.target.value })}>
                <option value="hourly" className="bg-black">Hourly (same as crew, rate above)</option>
                <option value="percent_revenue" className="bg-black">% of revenue</option>
                <option value="percent_profit" className="bg-black">% of profit</option>
                <option value="custom" className="bg-black">Custom flat amount per period</option>
              </GSel>
              {(f.payBasis === "percent_revenue" || f.payBasis === "percent_profit") && (
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block">Percent (%)</label>
                  <GInput type="number" min="0" max="100" step="0.5" value={f.payPercent ?? ""} onChange={e => setF({ ...f, payPercent: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="e.g. 20" />
                  <div className="text-[9px] text-white/40 mt-1">
                    {f.payBasis === "percent_revenue"
                      ? "% of completed-job revenue in the selected pay period."
                      : "% of profit (completed-job revenue minus logged labor/material costs) in the selected pay period."}
                  </div>
                </div>
              )}
              {f.payBasis === "custom" && (
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block">Flat amount per pay period ($)</label>
                  <GInput type="number" min="0" step="10" value={f.payCustomAmount ?? ""} onChange={e => setF({ ...f, payCustomAmount: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="e.g. 1500" />
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="(555) 555-0100" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Start Date</label><GDate value={f.startDate} onChange={e => setF({ ...f, startDate: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Status</label><GSel value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="active" className="bg-black">Active</option><option value="leave" className="bg-black">On Leave / Break (temporary)</option><option value="terminated" className="bg-black">Terminated — revoke access</option></GSel>
              {f.status && f.status !== "active" && <div className="text-[10px] text-white/40 mt-1">Portal/CRM access is blocked while status isn't Active — their account and data are kept, and switching back to Active restores everything exactly as it was.</div>}
            </div>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Emergency Contact</label><GInput value={f.emergencyContact} onChange={e => setF({ ...f, emergencyContact: e.target.value })} placeholder="Name — (555) 555-0000" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>

          {/* FEATURE — skills/strengths/weaknesses, visible on the profile
              and used as a lightweight job-assignment hint (see the warning
              badge in the crew-assign picker on JobDetailModal/JobsPage). */}
          <div>
            <label className="text-xs text-white/60 mb-1 block">Skills (comma-separated — e.g. "install, repair, commercial")</label>
            <GInput
              value={(f.skills || []).join(", ")}
              onChange={e => setF({ ...f, skills: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
              placeholder="install, repair, commercial"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Strengths</label><GTxt rows={2} value={f.strengths || ""} onChange={e => setF({ ...f, strengths: e.target.value })} placeholder="Great with difficult customers, fast on ladders" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Weaknesses</label><GTxt rows={2} value={f.weaknesses || ""} onChange={e => setF({ ...f, weaknesses: e.target.value })} placeholder="Doesn't like roofs, slow starter in the morning" /></div>
          </div>

          {/* FEATURE — photo/video release opt-out, employee side. Mirrors
              CustomerModal.tsx's client-side toggle; see LegalPages.tsx
              TermsPage's "Photos & Video" clause. Data flag only for now. */}
          <label className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer">
            <input type="checkbox" checked={!!(f as any).mediaOptOut} onChange={e => setF({ ...f, mediaOptOut: e.target.checked })} className="accent-brand-600" />
            📵 Opt out of photo/video use for marketing
          </label>

          {/* Shift status — mirrors the employee's own "Start My Day" timer
              so the owner can see it's running (and how long the last
              completed shift was) without opening the employee portal. */}
          {f.id && ((f as any).dayClockInAt || (f as any).lastShiftHours != null) && (
            <div className={"p-3 rounded-xl border text-xs " + ((f as any).dayClockInAt ? "bg-green-950/20 border-green-700/40 text-green-300" : "bg-black/30 border-white/10 text-white/50")}>
              {(f as any).dayClockInAt
                ? `On the clock since ${new Date((f as any).dayClockInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : (f as any).lastShiftHours != null && `Last shift: ${(f as any).lastShiftHours}h on ${(f as any).lastShiftDate || "—"}`}
            </div>
          )}

          {/* FEATURE 5 — owner-set days-off caps. Enforcement is informational
              (a badge comparing actual days off taken to the cap), not a hard
              block — the employee still sets their own availability from the
              portal Calendar tab; this just gives the owner visibility. */}
          <div className="border border-white/10 rounded-xl p-3 space-y-2">
            <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5 mb-1"><Calendar size={12} />Days Off Limits</div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-[10px] text-white/50 mb-1 block">Max days off / week</label><GInput type="number" min="0" step="1" value={f.maxDaysOffPerWeek ?? ""} onChange={e => setF({ ...f, maxDaysOffPerWeek: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="No limit" /></div>
              <div><label className="text-[10px] text-white/50 mb-1 block">Max days off / month</label><GInput type="number" min="0" step="1" value={f.maxDaysOffPerMonth ?? ""} onChange={e => setF({ ...f, maxDaysOffPerMonth: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="No limit" /></div>
            </div>
            {f.id && (() => {
              const now = new Date();
              const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
              const weekStartStr = weekStart.toISOString().slice(0, 10);
              const weekEndStr = today();
              const monthStartStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
              const weekTaken = countDaysOffInRange(f, weekStartStr, weekEndStr);
              const monthTaken = countDaysOffInRange(f, monthStartStr, weekEndStr);
              const weekOver = f.maxDaysOffPerWeek != null && weekTaken > f.maxDaysOffPerWeek;
              const monthOver = f.maxDaysOffPerMonth != null && monthTaken > f.maxDaysOffPerMonth;
              const recurring: number[] = f.recurringDaysOff || [];
              return (
                <div className="text-[10px] space-y-1">
                  <div className={weekOver ? "text-brand-400" : "text-white/50"}>
                    This week: {weekTaken}{f.maxDaysOffPerWeek != null ? ` / ${f.maxDaysOffPerWeek}` : ""} day{weekTaken !== 1 ? "s" : ""} off{weekOver ? " ⚠ over limit" : ""}
                  </div>
                  <div className={monthOver ? "text-brand-400" : "text-white/50"}>
                    This month: {monthTaken}{f.maxDaysOffPerMonth != null ? ` / ${f.maxDaysOffPerMonth}` : ""} day{monthTaken !== 1 ? "s" : ""} off{monthOver ? " ⚠ over limit" : ""}
                  </div>
                  {recurring.length > 0 && <div className="text-white/40">Recurring days off: {recurring.map((d: number) => weekdayLabels[d]).join(", ")}</div>}
                  <div className="text-white/30">Set from the employee's own portal → Calendar → Availability.</div>
                </div>
              );
            })()}
          </div>

          {/* Pay — real hours pulled from this employee's completed jobs,
              broken into individually-markable 14-day pay periods. A period
              defaults to "unpaid" until the owner explicitly marks it paid;
              paidPeriods is keyed by the period's start date. */}
          {f.id && (() => {
            const empJobs = jobs.filter((j: any) => crewIncludesEmployee(j.crew, f.id, (f as any).user_id) && j.status === "completed" && Number(j.loggedHours) > 0);
            const paidPeriods: Record<string, "paid" | "unpaid"> = f.paidPeriods || {};
            const now = new Date();
            const periods = Array.from({ length: 6 }, (_, i) => {
              const end = new Date(now); end.setDate(end.getDate() - i * 14);
              const start = new Date(end); start.setDate(start.getDate() - 13);
              const s = start.toISOString().slice(0, 10);
              const e = end.toISOString().slice(0, 10);
              const pJobs = empJobs.filter((j: any) => j.scheduledDate >= s && j.scheduledDate <= e);
              const hrs = Math.round(pJobs.reduce((acc: number, j: any) => acc + Number(j.loggedHours || 0), 0) * 10) / 10;
              const pay = pJobs.reduce((acc: number, j: any) => acc + Number(j.loggedHours || 0) * getEffectiveRate(f, j), 0);
              return { start: s, end: e, label: i === 0 ? "Current" : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`, hours: hrs, pay: Math.round(pay * 100) / 100, status: paidPeriods[s] || "unpaid" };
            }).filter(p => p.hours > 0);
            const totalPaid = periods.filter(p => p.status === "paid").reduce((s, p) => s + p.pay, 0);
            const pendingPay = periods.filter(p => p.status === "unpaid").reduce((s, p) => s + p.pay, 0);
            // FIX 7 — "Mark Paid" previously only updated the modal's local
            // `f` state, which was silently lost unless the owner also
            // clicked the modal's separate Save button afterward — nothing
            // reached Supabase, so the employee's own Pay tab (which reads
            // straight from Supabase) never reflected it and the button
            // looked like it "did nothing." Write straight to Supabase (and
            // the live `employees` state) the moment it's clicked.
            const togglePeriod = (start: string) => {
              const nowPaid = paidPeriods[start] !== "paid";
              const next = { ...paidPeriods, [start]: nowPaid ? "paid" as const : "unpaid" as const };
              // ITEM 5 — this modal's own Mark Paid button didn't feed the
              // same paymentLog markPeriodPaidFor writes (see that function's
              // comment) — a payment marked from here would silently be
              // invisible on the new Payroll Calendar.
              const period = periods.find(p => p.start === start);
              const nextLog = nowPaid ? [...(f.paymentLog || []), { id: uid(), periodStart: start, periodEnd: period?.end || start, amount: period?.pay ?? 0, paidAt: Date.now() }] : (f.paymentLog || []);
              setF((p: any) => ({ ...p, paidPeriods: next, paymentLog: nextLog }));
              setEmployees((prev: any[]) => prev.map(e => e.id === f.id ? { ...e, paidPeriods: next, paymentLog: nextLog } : e));
              // BUG FIX — "marking as paid doesn't save" (this modal's own
              // togglePeriod/toggleDay, unlike markPeriodPaidFor's Payroll-tab
              // version above, never had the safe-column retry). paidPeriods
              // and paymentLog are two separate columns (migration 0019) —
              // PostgREST rejects the WHOLE update if either doesn't exist on
              // this deployment yet, which silently dropped the paid/unpaid
              // STATUS too, not just the log. Retry with paidPeriods alone so
              // the actual status always lands even if the log can't.
              (supabase as any).from("employees").update({ paidPeriods: next, paymentLog: nextLog }).eq("id", f.id).select("id")
                .then(async (r: any) => {
                  if (!r?.error && Array.isArray(r?.data) && r.data.length > 0) { toast?.(next[start] === "paid" ? "Marked as paid ✓" : "Marked as unpaid", "green"); return; }
                  console.warn("[MarkPaid] full update failed:", r?.error?.message || "matched 0 rows", "— retrying with paidPeriods only");
                  const retry = await (supabase as any).from("employees").update({ paidPeriods: next }).eq("id", f.id).select("id");
                  if (retry?.error || !Array.isArray(retry?.data) || retry.data.length === 0) { console.error("[MarkPaid] paidPeriods-only retry also failed:", retry?.error?.message || "matched 0 rows"); toast?.("Failed to save pay status — " + (retry?.error?.message || "the server didn't confirm the update"), "red"); }
                  else toast?.(next[start] === "paid" ? "Marked as paid ✓ (payment log needs a pending database migration)" : "Marked as unpaid", "yellow");
                })
                .catch((e: any) => { console.error("[MarkPaid] threw:", e?.message); toast?.("Failed to save pay status — " + (e?.message || "unknown error"), "red"); });
            };
            return (
              <div className="border border-white/10 rounded-xl p-3 space-y-2">
                <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5 mb-1"><DollarSign size={12} />Pay</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-green-950/20 border border-green-700/30">
                    <div className="text-[10px] text-green-400/70 uppercase">Total Paid</div>
                    <div className="text-lg font-black text-green-400">{fmt(totalPaid)}</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-yellow-950/20 border border-yellow-700/30">
                    <div className="text-[10px] text-yellow-400/70 uppercase">Pending</div>
                    <div className="text-lg font-black text-yellow-400">{fmt(pendingPay)}</div>
                  </div>
                </div>
                {periods.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {periods.map(p => {
                      // FEATURE — employees can now confirm their own pay
                      // (paid-direction only, see EmployeePortal.tsx's
                      // markPeriodPaidByEmployee) — flag it here so the owner
                      // can tell an employee self-confirmed vs. the owner
                      // marking it, since togglePeriod below still lets the
                      // owner reverse either kind freely.
                      const latestLogForPeriod = [...(f.paymentLog || [])].reverse().find((l: any) => l.periodStart === p.start);
                      const employeeConfirmed = p.status === "paid" && latestLogForPeriod?.markedBy === "employee";
                      return (
                      <div key={p.start} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-black/30 border border-white/5">
                        <div className="min-w-0">
                          <div className="text-xs text-white/70 flex items-center gap-1.5">
                            {p.label}
                            {employeeConfirmed && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-950/40 border border-blue-700/40 text-blue-300" title="This employee marked this period paid themselves">Employee-confirmed</span>}
                          </div>
                          <div className="text-[10px] text-white/40">{p.hours}h · {fmt(p.pay)}</div>
                        </div>
                        <button onClick={() => togglePeriod(p.start)} className={"text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 transition " + (p.status === "paid" ? "bg-green-700 text-white" : "bg-yellow-950/40 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/40")}>
                          {p.status === "paid" ? "✓ Paid" : "Mark Paid"}
                        </button>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
          {/* FIX 2 (mobile round 6) — "individual job breakdown with hours per
              job": the period/day sections above only ever aggregate; this is
              the actual per-job list (one row per completed job with logged
              hours), most recent first. */}
          {f.id && (() => {
            const jobRows = jobs
              .filter((j: any) => crewIncludesEmployee(j.crew, f.id, (f as any).user_id) && j.status === "completed" && Number(j.loggedHours) > 0)
              .sort((a: any, b: any) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""))
              .slice(0, 25);
            if (jobRows.length === 0) return null;
            return (
              <div className="border border-white/10 rounded-xl p-3 space-y-1.5">
                <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5 mb-1"><Briefcase size={12} />Job Breakdown</div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {jobRows.map((j: any) => {
                    const cust = customers?.find?.((c: any) => c.id === j.customerId);
                    const hrs = Number(j.loggedHours) || 0;
                    const pay = hrs * getEffectiveRate(f, j);
                    return (
                      <div key={j.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-black/30 border border-white/5 text-xs">
                        <div className="min-w-0">
                          <div className="text-white/70 truncate">{cust ? `${cust.firstName} ${cust.lastName}` : (j.address || "Job")}</div>
                          <div className="text-[10px] text-white/40">{j.scheduledDate}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-white/70">{hrs.toFixed(1)}h</div>
                          <div className="text-[10px] text-white/40">{fmt(pay)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          {/* FIX 3 — daily breakdown, parallel to the 14-day periods above but
              per individual day (employees.paidDays), matching what the
              employee sees in their own Pay tab calendar. */}
          {f.id && (() => {
            const paidDays: Record<string, "paid" | "unpaid"> = f.paidDays || {};
            const days = Array.from({ length: 14 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - i);
              const key = d.toISOString().slice(0, 10);
              const dayJobs = jobs.filter((j: any) => crewIncludesEmployee(j.crew, f.id, (f as any).user_id) && j.scheduledDate === key && Number(j.loggedHours) > 0);
              const hours = Math.round(dayJobs.reduce((s: number, j: any) => s + Number(j.loggedHours || 0), 0) * 100) / 100;
              const pay = Math.round(dayJobs.reduce((s: number, j: any) => s + Number(j.loggedHours || 0) * getEffectiveRate(f, j), 0) * 100) / 100;
              return { key, label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }), hours, pay, status: paidDays[key] || "unpaid" };
            }).filter(d => d.hours > 0);
            // FIX 7 — same immediate-write fix as togglePeriod above: this
            // must reach Supabase the moment it's clicked, not wait on the
            // modal's separate Save button.
            const toggleDay = (key: string) => {
              const nowPaid = paidDays[key] !== "paid";
              const next = { ...paidDays, [key]: nowPaid ? "paid" as const : "unpaid" as const };
              // ITEM 5 — same paymentLog hook as togglePeriod above.
              const day = days.find(d => d.key === key);
              const nextLog = nowPaid ? [...(f.paymentLog || []), { id: uid(), periodStart: key, periodEnd: key, amount: day?.pay ?? 0, paidAt: Date.now() }] : (f.paymentLog || []);
              setF((p: any) => ({ ...p, paidDays: next, paymentLog: nextLog }));
              setEmployees((prev: any[]) => prev.map(e => e.id === f.id ? { ...e, paidDays: next, paymentLog: nextLog } : e));
              // BUG FIX — same safe-column retry as togglePeriod above:
              // paidDays and paymentLog are separate columns, so a missing/
              // mismatched paymentLog column must not be able to block the
              // paidDays status itself from saving.
              // SECURITY/SYNC FIX (audit finding) — this write, unlike
              // togglePeriod above, never checked for the RLS 0-row-silent-
              // success case (docs/ARCHITECTURE.md): "Marked as paid" toasted even when
              // owner_id mismatch meant nothing actually saved.
              (supabase as any).from("employees").update({ paidDays: next, paymentLog: nextLog }).eq("id", f.id).select("id")
                .then(async (r: any) => {
                  if (!r?.error && Array.isArray(r?.data) && r.data.length > 0) { toast?.(next[key] === "paid" ? "Marked as paid ✓" : "Marked as unpaid", "green"); return; }
                  console.warn("[MarkPaid] full update failed:", r?.error?.message || "matched 0 rows", "— retrying with paidDays only");
                  const retry = await (supabase as any).from("employees").update({ paidDays: next }).eq("id", f.id).select("id");
                  if (retry?.error || !Array.isArray(retry?.data) || retry.data.length === 0) { console.error("[MarkPaid] paidDays-only retry also failed:", retry?.error?.message || "matched 0 rows"); toast?.("Failed to save pay status — " + (retry?.error?.message || "the server didn't confirm the update"), "red"); }
                  else toast?.(next[key] === "paid" ? "Marked as paid ✓ (payment log needs a pending database migration)" : "Marked as unpaid", "yellow");
                })
                .catch((e: any) => { console.error("[MarkPaid] threw:", e?.message); toast?.("Failed to save pay status — " + (e?.message || "unknown error"), "red"); });
            };
            if (days.length === 0) return null;
            return (
              <div className="border border-white/10 rounded-xl p-3 space-y-2">
                <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5 mb-1"><Calendar size={12} />Daily Breakdown (last 14 days)</div>
                <div className="space-y-1.5">
                  {days.map(d => (
                    <div key={d.key} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-black/30 border border-white/5">
                      <div className="min-w-0">
                        <div className="text-xs text-white/70">{d.label}</div>
                        <div className="text-[10px] text-white/40">{d.hours}h · {fmt(d.pay)}</div>
                      </div>
                      <button onClick={() => toggleDay(d.key)} className={"text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 transition " + (d.status === "paid" ? "bg-green-700 text-white" : "bg-yellow-950/40 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/40")}>
                        {d.status === "paid" ? "✓ Paid" : "Mark Paid"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {/* Manager CRM permissions — only for role: Manager. Owner can change
              or fully revoke a manager's CRM access here anytime; setting
              status to Leave or Terminated above (enforced in App.tsx's
              resolveUserRole, or deleting the employee) removes CRM access
              entirely regardless of these toggles. */}
          {f.role === "Manager" && (
            <div className="border border-purple-700/30 rounded-xl p-3 bg-purple-950/10 space-y-1">
              <div className="text-xs font-semibold text-purple-300 mb-1 flex items-center gap-1.5"><Shield size={12} />Manager CRM Access</div>
              <div className="text-[10px] text-white/40 mb-2">Full CRM access except these areas — check any you want to grant.</div>
              {MANAGER_CRM_PERM_DEFS.map(({ key, label, desc }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer py-1 group">
                  <input type="checkbox" checked={!!(f.managerPermissions || DEFAULT_MANAGER_PERMS)[key]} onChange={e => setF((p: any) => ({ ...p, managerPermissions: { ...(p.managerPermissions || DEFAULT_MANAGER_PERMS), [key]: e.target.checked } }))}
                    className="w-3.5 h-3.5 accent-purple-600 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-white/80 group-hover:text-white transition">{label}</div>
                    <div className="text-[10px] text-white/40">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
          {/* FEATURE — a standalone, hard-to-miss "Full Alfred Access" switch.
              can_text_alfred/can_text_alfred_message_customers already existed
              buried inside the long Portal Permissions list below (the second
              one only visible once the first is checked) — easy to miss, and
              the reported symptom ("employee texts Alfred, gets refused")
              gave no clue that the fix lived in a collapsed section two
              levels deep. One switch, right up top, grants both at once. */}
          <div className="border border-cyan-700/30 rounded-xl p-3 bg-cyan-950/10 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">🤖 Full Alfred Access</div>
              <div className="text-[10px] text-white/40 mt-0.5">Lets this employee text the company's Alfred number to clock in/out, check their hours/jobs, manage their calendar, and message customers on their own jobs.</div>
            </div>
            <button
              onClick={() => setF((p: any) => {
                const on = !(p.permissions?.can_text_alfred && p.permissions?.can_text_alfred_message_customers);
                return { ...p, permissions: { ...(p.permissions || DEFAULT_PERMS), can_text_alfred: on, can_text_alfred_message_customers: on } };
              })}
              className="flex-shrink-0 w-12 h-7 rounded-full transition relative"
              style={{ background: (f.permissions?.can_text_alfred && f.permissions?.can_text_alfred_message_customers) ? "#0891b2" : "rgba(255,255,255,0.1)" }}
            >
              <div className={"absolute top-1 w-5 h-5 rounded-full bg-white transition " + ((f.permissions?.can_text_alfred && f.permissions?.can_text_alfred_message_customers) ? "left-6" : "left-1")} />
            </button>
          </div>
          {/* Permissions editor */}
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowEditPerms(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition"
            >
              <span className="flex items-center gap-1.5"><Shield size={12} />Portal Permissions</span>
              <span className="text-[10px] text-white/40">{showEditPerms ? "▲ collapse" : "▼ expand"}</span>
            </button>
            {showEditPerms && (
              <div className="px-3 pb-3 space-y-1 border-t border-white/10">
                <div className="flex gap-3 pt-2 pb-1">
                  <button onClick={() => setF((p: any) => ({ ...p, permissions: Object.fromEntries(PERMISSION_DEFS_EMP.map(d => [d.key, true])) }))} className="text-[10px] text-blue-400 hover:text-blue-300 transition">Select All</button>
                  <button onClick={() => setF((p: any) => ({ ...p, permissions: Object.fromEntries(PERMISSION_DEFS_EMP.map(d => [d.key, false])) }))} className="text-[10px] text-brand-400 hover:text-brand-300 transition">Deselect All</button>
                </div>
                {PERMISSION_DEFS_EMP.map((def) => {
                  const perms = f.permissions || DEFAULT_PERMS;
                  const nested = "nestedUnder" in def ? (def as any).nestedUnder as string : null;
                  if (nested && !perms[nested]) return null;
                  return (
                    <label key={def.key} className={"flex items-center gap-2 cursor-pointer py-1 group" + (nested ? " pl-5" : "")}>
                      <input type="checkbox" checked={!!perms[def.key]} onChange={e => setF((p: any) => ({ ...p, permissions: { ...(p.permissions || DEFAULT_PERMS), [def.key]: e.target.checked } }))}
                        className="w-3.5 h-3.5 accent-brand-600 flex-shrink-0" />
                      <div>
                        <div className="text-xs text-white/80 group-hover:text-white transition">{def.label}</div>
                        <div className="text-[10px] text-white/40">{def.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <GBtn variant="ghost" onClick={() => setModal({ open: false, data: null })}>Cancel</GBtn>
            <GBtn onClick={save} disabled={!f.firstName.trim()}>Save</GBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ===== EXPENSES =====
