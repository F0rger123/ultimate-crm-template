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
  Paperclip, ImageIcon, FileImage, MoreVertical, Mic, Upload, Link, Lock, User, Video, Square
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line,
  ComposedChart, Legend
} from "recharts";
import { fmt, uid, today, localDateStr, localDateKey, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, forecastFor, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, withTimeout, totalJobPhotoCount, desktopNotifsSupported, desktopNotifPermission, requestDesktopNotifPermission } from "../../lib/utils";
// BLOCKER 5/9 (mobile round 9) — same robust crew-matching helper the
// employee portal uses (tolerates object-shaped crew entries, stringified
// JSON, casing, and the employees.id vs employees.user_id mismatch). Live
// Crew View was matching with a bare `(j.crew||[]).includes(e.id)`, which
// silently found no current job for a clocked-in employee whenever their
// crew entry used a different id shape — the card then had no job to hang
// its checklist/photo count off of, which is why Live Crew View "doesn't
// show checklists or before/after photos" even though the data exists.
import { crewIncludesEmployee, JobDetailView } from "./EmployeePortal";
import { supabase } from "../../lib/supabase";

// FIX 8 — same default checklist items JobDetailModal.tsx/EmployeePortal.tsx/
// CrewView.tsx fall back to when a job's checklist arrays are still empty. A
// freshly-scheduled job never has preChecklist/duringChecklist/postChecklist
// populated in Supabase until an employee checks an item in the field — so
// without this same fallback, Live Team View showed "0/0" for every job that
// hadn't been touched yet in the field, not just ones with no checklist at all.
const DASH_PRE_DEFAULTS = [
  { id: "pre1", label: "Take before photos of the work area", done: false },
  { id: "pre2", label: "Confirm site access", done: false },
  { id: "pre3", label: "Review job scope with customer", done: false },
  { id: "pre4", label: "Note any pre-existing issues", done: false },
];
const DASH_DURING_DEFAULTS = [
  { id: "dur1", label: "Complete the scoped work", done: false },
  { id: "dur2", label: "Keep work area clean and safe", done: false },
  { id: "dur3", label: "Document any extra work or changes", done: false },
];
const DASH_POST_DEFAULTS = [
  { id: "post1", label: "Customer walkthrough", done: false },
  { id: "post2", label: "Collect payment", done: false },
  { id: "post3", label: "Get customer signature", done: false },
  { id: "post4", label: "Take after photos", done: false },
];
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendOwnerGmailOnly, logOutboundSmsToInbox, emailShell } from "../../lib/messaging";

import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { Glass } from "../ui/Glass";
import { OwnerShiftBar } from "../ui/OwnerShiftBar";
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
import { InvoicePreviewModal } from "../ui/InvoicePreviewModal";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { CustomerModal } from "../ui/CustomerModal";
import { CustomerDetail } from "../ui/CustomerDetail";
import { CustomerAnalytics } from "../ui/CustomerAnalytics";
import { EstimateBuilder } from "../ui/EstimateBuilder";
import { EstimatePreview } from "../ui/EstimatePreview";
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

// Street View Static images proved unreliable across this key's
// restrictions — link straight to Google Maps for the address instead.
function MiniStreetViewThumb({ address, mapsKey }: { address: string; mapsKey?: string }) {
  if (!address) {
    return (
      <div className="w-14 h-14 rounded-lg bg-green-900/40 border border-green-600/40 flex items-center justify-center flex-shrink-0">
        <Clock size={16} className="text-green-400" />
      </div>
    );
  }
  return (
    <a
      href={`https://www.google.com/maps?q=${encodeURIComponent(address)}`}
      target="_blank"
      rel="noopener noreferrer"
      title="View property on Google Maps"
      className="w-14 h-14 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center flex-shrink-0"
    >
      <MapPin size={16} className="text-brand-400" />
    </a>
  );
}

export function Dashboard({ jobs = [], setJobs = (() => {}) as any, customers = [], estimates = [], setEstimates = (() => {}) as any, automations = [], stats, goals, vehicles = [], maintenance = [], chemicals = [], settings = {} as AppSettings, setSettings = () => {}, onNav, toast, weatherData = null, weatherFetchError = null, inboxThreads = [], employees = [], crewFetchError = false, reviews = [], onSendDailyBriefing, onViewJob = (id: string) => {}, ownerId = "" }: { jobs?: any[]; setJobs?: any; customers?: any[]; estimates?: any[]; setEstimates?: any; automations?: any[]; stats?: any; goals?: any; vehicles?: any[]; maintenance?: any[]; chemicals?: any[]; settings?: AppSettings; setSettings?: any; onNav?: any; toast?: any; weatherData?: any; weatherFetchError?: string | null; inboxThreads?: any[]; employees?: any[]; crewFetchError?: boolean; reviews?: any[]; onSendDailyBriefing?: () => Promise<void>; onViewJob?: (id: string) => void; ownerId?: string }) {
  const [sendingDashInvoiceId, setSendingDashInvoiceId] = useState<string | null>(null);
  // BUG FIX (user report) — "if an owner collapses it, it should stay
  // collapsed when navigating to another part of the website, reloading
  // the page, closing and reopening the site." Plain useState reset to
  // false on every remount (any navigation away from Dashboard unmounts
  // this component); persisting to localStorage survives all three.
  const [needsInvoiceCollapsed, setNeedsInvoiceCollapsed] = useState(() => {
    try { return localStorage.getItem("crm.dashboardInvoicesCollapsed") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("crm.dashboardInvoicesCollapsed", needsInvoiceCollapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [needsInvoiceCollapsed]);
  // "Today" consolidated at-a-glance card (crew status + jobs due today +
  // overdue invoices + low stock) — collapsible so it doesn't permanently
  // eat vertical space once the owner's checked it once each morning.
  const [todayCardCollapsed, setTodayCardCollapsed] = useState(false);
  const [previewInvoiceJob, setPreviewInvoiceJob] = useState<any>(null);
  const [desktopNotifDismissed, setDesktopNotifDismissed] = useState(false);
  // AUDIT ITEM 13 — an empty `employees` array on the very first render is
  // ambiguous: it could mean "no crew configured yet" or "the initial
  // Supabase fetch just hasn't resolved yet". Showing "No one on shift"
  // during that brief window is exactly the flicker the owner keeps
  // reporting. Give the first load a couple seconds' grace before trusting
  // an empty result at all.
  const [crewDataSettled, setCrewDataSettled] = useState(employees.length > 0);
  useEffect(() => {
    if (employees.length > 0) { setCrewDataSettled(true); return; }
    // BLOCKER 9 (mobile round 9) — "works on PC, shows nothing on phone,
    // same account": a fixed 2.5s grace period assumes the first employees
    // fetch always lands that fast. A PC session usually already has this
    // data warm (recent poll/cache); a freshly-opened session on another
    // device is doing a cold Supabase fetch over a mobile connection, which
    // can easily take longer — the grace period expired and locked in "No
    // one on shift" before the real data ever arrived. Longer grace period,
    // plus a log to confirm on a real device whether this is a timing issue
    // (log fires with employees.length still 0) or something else (fires
    // with employees already populated, meaning this effect isn't the cause).
    const t = setTimeout(() => {
      console.log("[LiveCrew] grace period elapsed — employees.length:", employees.length, employees.length === 0 ? "(still empty — likely a slow/failed fetch, not a rendering bug)" : "(had data all along)");
      setCrewDataSettled(true);
    }, 6000);
    return () => clearTimeout(t);
  }, [employees.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps
  // FIX 3 — was requiring j.clockInAt to be truthy, but Complete Job always
  // clears clockInAt to null when finishing a clocked-in job (it rolls the
  // elapsed time into loggedHours instead) — so this filter could never match
  // a job that had actually been worked and completed through the normal
  // field-portal flow. Status + payment state alone is what "needs an
  // invoice" actually means.
  const needsInvoiceJobs = jobs.filter((j: any) => j.status === "completed" && j.paymentStatus !== "Paid" && !j.invoiceSentAt);
  const sendDashInvoice = async (job: any, subject: string, bodyHtml: string) => {
    console.log("[SendInvoice] sendDashInvoice called — job:", job.id, "customer:", job.customerId);
    const cust = customers.find((c: any) => c.id === job.customerId);
    if (!cust?.email) { console.warn("[SendInvoice] aborting — no email on file for customer", job.customerId); toast?.("Customer has no email on file", "red"); return; }
    setSendingDashInvoiceId(job.id);
    try {
      const newInv = {
        id: uid(), customerId: job.customerId,
        lineItems: [{ id: uid(), description: job.notes || job.address || "Service", quantity: 1, unitPrice: Number(job.amount) || 0 }],
        subtotal: Number(job.amount) || 0, discount: 0, depositRequired: 0, tax: 0, total: Number(job.amount) || 0,
        status: "approved" as const, createdAt: today(), validUntil: daysFromNow(30), invoiced: true, invoicedAt: today(),
        // BUG FIX — missing owner_id meant this insert violated the
        // owner_id-scoped RLS policy added by the multi-tenant migration
        // (estimates_owner_scoped: WITH CHECK owner_id = current_owner_id()),
        // so the row was silently rejected — "Send Invoice" on the Dashboard
        // looked like it worked (no visible crash before this fix's error
        // surfacing) but never actually persisted; a reload showed nothing.
        owner_id: ownerId,
      };
      // [SendInvoice] this insert used to be fire-and-forget (not awaited) —
      // a failed save only logged a console.warn while the function carried
      // on building a payLink for a row that never reached Supabase, then
      // reported success anyway. Await it (with a timeout so a hung request
      // can't strand the button on "Sending…") and throw on failure so the
      // owner actually sees it didn't work.
      console.log("[SendInvoice] inserting new invoice", newInv.id, "amount", newInv.total);
      const insertResult = await withTimeout<any>((supabase as any).from("estimates").insert(newInv), 10000, "Invoice save");
      if (insertResult?.error) {
        console.error("[SendInvoice] estimate insert failed:", insertResult.error.message);
        throw new Error("Couldn't save invoice — " + insertResult.error.message);
      }
      console.log("[SendInvoice] invoice saved to Supabase ✓");
      setEstimates((prev: any[]) => [...prev, newInv]);
      // FIX 17 — #/portal/ID is the EMPLOYEE portal's route, not a customer
      // invoice view; #/estimate/ID is the public, no-login single-estimate
      // pay/sign portal (ClientPortal).
      const payLink = `${window.location.origin}${window.location.pathname}#/estimate/${newInv.id}`;
      const html = bodyHtml + `<div style="text-align:center;margin:22px 0 4px"><a href="${payLink}" style="display:inline-block;background:#111111;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px">View & Pay Invoice</a></div>`;
      // Hard timeout — a hung Gmail fetch (no built-in timeout) is exactly what
      // left the button stuck on "Sending…" forever. This guarantees the await
      // always settles so `finally` runs and the button resets. sendOwnerGmailOnly
      // (lib/messaging.ts) already auto-refreshes the Google session on a 401
      // and retries once before giving up.
      console.log("[SendInvoice] sending via Gmail to", cust.email);
      await withTimeout(sendOwnerGmailOnly(settings as any, cust.email, subject, html), 10000, "Invoice email");
      console.log("[SendInvoice] Gmail send resolved ✓");
      const jobPatch = { invoiceSentAt: today(), paymentType: "Invoice", paymentStatus: job.paymentStatus === "Paid" ? job.paymentStatus : "Pending" };
      setJobs((prev: any[]) => prev.map((j: any) => j.id === job.id ? { ...j, ...jobPatch } : j));
      // AUDIT FIX — this write was fully silent (console-only). The email
      // itself already sent successfully by this point, so a failure here
      // shouldn't read as "the invoice send failed" — but with zero
      // visibility, a dropped write meant this job kept reappearing on the
      // "Needs Invoice" dashboard card indefinitely with no explanation of
      // why re-sending never seems to "take."
      (supabase as any).from("jobs").update(jobPatch).eq("id", job.id).select("id")
        .then((r: any) => {
          if (r?.error) { console.error("[SendInvoice] job patch (invoiceSentAt) failed:", r.error.message); toast?.("Invoice sent, but this job may still show as needing an invoice — " + r.error.message, "yellow"); return; }
          if (!Array.isArray(r?.data) || r.data.length === 0) { console.error("[SendInvoice] job patch matched 0 rows"); toast?.("Invoice sent, but this job may still show as needing an invoice — the update didn't confirm.", "yellow"); }
        })
        .catch((e: any) => { console.error("[SendInvoice] job patch (invoiceSentAt) threw:", e?.message); toast?.("Invoice sent, but this job may still show as needing an invoice.", "yellow"); });
      toast?.(`📧 Invoice sent to ${cust.firstName} ✓`, "green");
      setPreviewInvoiceJob(null);
    } catch (e: any) {
      console.error("[SendInvoice] — error:", e?.message || e);
      const msg = e?.message === "Invoice email timed out"
        ? "Send timed out — check your Gmail connection in Settings → Integrations"
        : /expired|401|reconnect/i.test(e?.message || "")
        ? "Google token expired — reconnect in Settings → Integrations"
        : (e?.message || "Failed to send invoice");
      toast?.(msg, "red");
    } finally {
      setSendingDashInvoiceId(null);
      console.log("[SendInvoice] sendDashInvoice finished, sendingDashInvoiceId reset");
    }
  };
  const pipelineVal = jobs.filter(j => j.status !== "completed").reduce((s, j) => s + j.amount, 0);
  const dayOfMonth = new Date().getDate();
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();

  const nowD = new Date();
  const weekStart = new Date(nowD); weekStart.setDate(nowD.getDate() - nowD.getDay());
  const monthStart = new Date(nowD.getFullYear(), nowD.getMonth(), 1);
  const completedJobs = jobs.filter(j => j.status === "completed");
  const weekStartStr = localDateKey(weekStart);
  const monthStartStr = localDateKey(monthStart);
  // BUG FIX — "Today $ / This Week $ aren't accurate, aren't pulling real
  // data." revToday/revWeek used to sum job.amount (the job's QUOTED price)
  // for jobs COMPLETED on that date — not the same thing as money actually
  // COLLECTED that date. A job completed today with an invoice paid three
  // days later counted as "today's revenue" the moment it was marked done,
  // while a five-year-old job whose invoice finally got paid today
  // contributed nothing to "today." "Revenue today/this week" now means
  // exactly what those words say: the real total of invoices/estimates
  // actually PAID on that date (paidAt), summed by their real invoiced
  // total (e.stotal is the real amount charged — job.amount can drift
  // from it once line items/discounts are added at invoicing time), using
  // the same local-date-string comparison FIX 2 already established below
  // to avoid the UTC-midnight parsing bug (paidAt is a plain "YYYY-MM-DD"
  // string from today(), same shape as scheduledDate).
  const paidEstimates = estimates.filter((e: any) => !!e.paidAt);
  const revToday = paidEstimates.filter((e: any) => e.paidAt === localDateStr()).reduce((s: number, e: any) => s + (Number(e.total) || 0), 0);
  const revWeek = paidEstimates.filter((e: any) => e.paidAt >= weekStartStr).reduce((s: number, e: any) => s + (Number(e.total) || 0), 0);
  // Month/year-to-date figures below stay on the existing "completed jobs,
  // scheduledDate" basis deliberately — those are used for the run-rate/
  // forecast and YoY comparisons, which are about WORK DONE (a pipeline/
  // production metric), not cash collected — a different, still-accurate
  // question from "how much money did I actually make today/this week."
  const revMonth = completedJobs.filter(j => j.scheduledDate >= monthStartStr).reduce((s, j) => s + j.amount, 0);
  const avgJobVal = completedJobs.length > 0 ? completedJobs.reduce((s, j) => s + j.amount, 0) / completedJobs.length : 0;

  // FIX 5 — run-rate/forecast must project from MONTH-TO-DATE revenue
  // (revMonth), not stats.totalRev (all-time) — the latter grows unbounded
  // and produces a forecast many multiples too high the longer the business
  // has been running.
  const runRate = dayOfMonth > 0 ? Math.round((revMonth / dayOfMonth) * daysInMonth) : 0;
  const forecast = Math.max(runRate, Math.round(pipelineVal * (stats.closeRate / 100 || 0.6)));

  // Year-over-year comparison
  const thisYearStart = new Date(nowD.getFullYear(), 0, 1).toISOString().slice(0,10);
  const lastYearStart = new Date(nowD.getFullYear()-1, 0, 1).toISOString().slice(0,10);
  const lastYearEnd = new Date(nowD.getFullYear()-1, nowD.getMonth(), nowD.getDate()).toISOString().slice(0,10);
  const revThisYear = completedJobs.filter(j => j.scheduledDate >= thisYearStart).reduce((s,j) => s+j.amount, 0);
  const revLastYear = completedJobs.filter(j => j.scheduledDate >= lastYearStart && j.scheduledDate <= lastYearEnd).reduce((s,j) => s+j.amount, 0);
  const yoyPct = revLastYear > 0 ? Math.round((revThisYear - revLastYear) / revLastYear * 100) : null;

  const outstanding = jobs.filter(j => j.status === "scheduled" || j.status === "in_progress").slice(0, 5);
  const outTotal = outstanding.reduce((s, j) => s + j.amount, 0);
  const tKey = today();
  const in7 = daysFromNow(7);
  const upcoming = jobs.filter(j => j.scheduledDate >= tKey && j.scheduledDate <= in7 && j.status !== "cancelled").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 5);
  const pending = estimates.filter(e => e.status === "pending").slice(0, 4);

  // Recent activity from live state
  // 6-month revenue from actual completed jobs
  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    const monthKey = d.toISOString().slice(0, 7); // "2025-05"
    const monthJobs = completedJobs.filter(j => (j.scheduledDate || "").startsWith(monthKey));
    return {
      month: d.toLocaleDateString("en-US", { month: "short" }),
      revenue: monthJobs.reduce((s, j) => s + j.amount, 0),
      jobs: monthJobs.length,
    };
  });
  const hasAnyRevData = revenueByMonth.some(r => r.revenue > 0);

  // Real activity feed — build from actual CRM data sorted by recency
  const activity = (() => {
    const events = [];
    // Recent jobs
    jobs.filter(j => j.scheduledDate).slice(-10).forEach(j => {
      const c = customers.find(x => x.id === j.customerId);
      const name = c ? c.firstName + " " + c.lastName : "Customer";
      if (j.status === "completed") events.push({ date: j.scheduledDate, text: "✅ Completed: " + name + " — " + j.address?.split(",")[0], amount: j.amount, icon: CheckCircle });
      else if (j.status === "scheduled") events.push({ date: j.scheduledDate, text: "📅 Scheduled: " + name, amount: j.amount, icon: Calendar });
      else if (j.status === "cancelled") events.push({ date: j.scheduledDate, text: "❌ Cancelled: " + name + (j.noShow ? " (no-show)" : ""), icon: Ban });
    });
    // Recent estimates
    estimates.filter(e => e.createdAt).slice(-8).forEach(e => {
      const c = customers.find(x => x.id === e.customerId);
      const name = c ? c.firstName + " " + c.lastName : "Customer";
      if (e.status === "approved") events.push({ date: e.signedAt || e.createdAt, text: "✍️ Signed: " + name + " — estimate approved", amount: e.total, icon: FileText });
      else if (e.paidAt) events.push({ date: e.paidAt, text: "💳 Paid: " + name, amount: e.total, icon: DollarSign });
      else events.push({ date: e.createdAt, text: "📋 Quote sent: " + name, amount: e.total, icon: FileText });
    });
    // Recent customers
    customers.filter(c => c.createdAt && daysSince(c.createdAt) <= 30).slice(-5).forEach(c => {
      events.push({ date: c.createdAt, text: "👤 New customer: " + c.firstName + " " + c.lastName + (c.leadSource ? " via " + c.leadSource : ""), icon: Users });
    });
    // Recent payments
    estimates.filter(e => e.paidAt && daysSince(e.paidAt) <= 14).forEach(e => {
      const c = customers.find(x => x.id === e.customerId);
      events.push({ date: e.paidAt, text: "💰 Payment received: " + (c ? c.firstName + " " + c.lastName : "Customer"), amount: e.total + (e.tip || 0), icon: DollarSign });
    });
    return events.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 8);
  })();

  const wAlerts = [];
  // FIX 10 — this used to fall back to seedWeather's hardcoded fake forecast
  // whenever weatherData was falsy (no key, still loading, or a failed
  // fetch) — meaning a real OWM key that was merely invalid, rate-limited,
  // or pointed at a location OWM couldn't geocode still produced "real-
  // looking" rain/wind/heat alerts built entirely from fake seed numbers.
  // Falls back to an empty forecast instead — every consumer below already
  // handles zero days/no current reading by simply not alerting/badging.
  const wForecast = weatherData?.forecast ?? [];
  const wCurrent = weatherData?.current ?? null;
  wForecast.forEach(f => {
    if (f.rainChance > 50) wAlerts.push({ type: "rain", day: f.day, msg: f.rainChance + "% rain", icon: "🌧️" });
    if ((f.lowTemp || f.temp) <= 32) wAlerts.push({ type: "freeze", day: f.day, msg: "Freeze " + (f.lowTemp || f.temp) + "°F", icon: "🥶" });
    if (f.wind >= 15) wAlerts.push({ type: "wind", day: f.day, msg: "Wind " + f.wind + "mph", icon: "💨" });
    if (f.temp >= 90) wAlerts.push({ type: "hot", day: f.day, msg: "🌡️ " + f.temp + "°F — HOT SURFACE WARNING: SH may flash dry. Schedule early AM or after 6pm. Pre-wet surfaces.", icon: "🥵" });
    else if (f.temp >= 85) wAlerts.push({ type: "hot", day: f.day, msg: f.temp + "°F — surfaces may be warm. Pre-wet before applying SH.", icon: "☀️" });
  });
  const bestDay = wForecast.find(f => f.rainChance < 30 && f.temp >= 45 && f.temp < 85 && f.wind < 15 && (f.lowTemp || f.temp) > 32);

  // FIX 5 — this must compare THIS MONTH's revenue against the monthly goal.
  // stats.totalRev is ALL-TIME completed revenue (see App.tsx); dividing an
  // all-time total by a monthly goal is exactly what produced nonsensical
  // percentages like "173,000%" that only ever grew, never reset.
  const revPct = goals.revenue > 0 ? Math.round((revMonth / goals.revenue) * 100) : 0;
  const jobsPct = goals.jobCount > 0 ? Math.round((stats.doneMonth / goals.jobCount) * 100) : 0;

  // Smart alerts: maintenance due, low stock, urgent jobs, stale quotes, weather risk
  const alerts = [];

  // Vehicle maintenance
  if (settings.notifyMaintenance !== false) {
    vehicles.forEach(v => {
      const logs = (Array.isArray(maintenance) ? maintenance : []).filter(m => m.vehicleId === v.id);
      const lastOil = logs.filter(l => l.type === "Oil Change").sort((a, b) => b.date.localeCompare(a.date))[0];
      const milesSince = lastOil ? (v.mileage - lastOil.mileage) : 999999;
      const daysSinceOil = lastOil ? daysSince(lastOil.date) : 999;
      if (milesSince >= 5000 || daysSinceOil >= 90) {
        alerts.push({ key: "mnt-" + v.id, icon: Truck, tone: "yellow", msg: v.name + " oil change due (" + (lastOil ? milesSince.toLocaleString() + "mi since" : "never logged") + ")", action: () => onNav("fleet") });
      }
    });
  }

  // Low chemical stock
  if (settings.notifyLowStock !== false) {
    const low = chemicals.filter(c => c.stock <= c.reorderLevel);
    if (low.length > 0) alerts.push({ key: "stock", icon: FlaskConical, tone: "red", msg: low.length + " supply item" + (low.length > 1 ? "s" : "") + " at reorder: " + low.map(c => c.name.split(" ")[0]).slice(0, 3).join(", "), action: () => onNav("chemicals") });
  }

  // Urgent jobs
  const urgentJobs = jobs.filter(j => j.priority === "urgent" && j.status !== "completed" && j.status !== "cancelled");
  if (urgentJobs.length > 0) alerts.push({ key: "urgent", icon: AlertCircle, tone: "red", msg: urgentJobs.length + " urgent job" + (urgentJobs.length > 1 ? "s" : "") + " need attention", action: () => onNav("jobs") });

  // Stale quotes
  const staleQuotes = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7);
  if (staleQuotes.length > 0) alerts.push({ key: "stale", icon: FileText, tone: "yellow", msg: staleQuotes.length + " quote" + (staleQuotes.length > 1 ? "s" : "") + " over 7 days old — follow up", action: () => onNav("estimates") });

  // Weather — wForecast is now [] (never fake seed data) whenever there's no
  // key or no successful fetch yet, so this naturally can't fire on made-up
  // data; the owmKey gate just avoids computing it for nothing.
  if (settings.notifyWeather !== false && settings.owmKey) {
    const rainyDays = wForecast.filter(f => f.rainChance >= 70).map(f => f.day);
    if (rainyDays.length > 0) {
      const atRisk = jobs.filter(j => j.status === "scheduled").length;
      if (atRisk > 0) alerts.push({ key: "wx", icon: Cloud, tone: "blue", msg: "Rain forecast: " + rainyDays.join(", ") + " — check scheduled jobs", action: () => onNav("calendar") });
    }
  }

  // Overdue invoices
  const overdueInv = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14);
  if (overdueInv.length > 0) alerts.push({ key: "overdue", icon: Receipt, tone: "red", msg: overdueInv.length + " invoice" + (overdueInv.length !== 1 ? "s" : "") + " overdue " + (overdueInv.length === 1 ? daysSince(overdueInv[0].invoicedAt) + "d" : ""), action: () => onNav("invoices") });

  // Expired estimates
  const expiredEst = estimates.filter(e => e.status === "pending" && e.validUntil && daysSince(e.validUntil) > 0);
  if (expiredEst.length > 0) alerts.push({ key: "expired", icon: Clock, tone: "yellow", msg: expiredEst.length + " estimate" + (expiredEst.length !== 1 ? "s" : "") + " expired — send new quote", action: () => onNav("estimates") });

  // Today's jobs reminder
  const todayStr = today();
  const todayJobs = jobs.filter(j => j.scheduledDate === todayStr && j.status === "scheduled");
  if (todayJobs.length > 0) alerts.push({ key: "today", icon: Calendar, tone: "blue", msg: todayJobs.length + " job" + (todayJobs.length !== 1 ? "s" : "") + " scheduled today — check route", action: () => onNav("jobs") });

  // Stale pipeline leads
  const staleLeads = jobs.filter(j => ["lead","contacted","estimate_sent"].includes(j.pipelineStage) && daysSince(j.stageChangedAt || j.scheduledDate || j.createdAt) >= 14);
  if (staleLeads.length > 0) alerts.push({ key: "staleleads", icon: Activity, tone: "orange", msg: staleLeads.length + " pipeline lead" + (staleLeads.length !== 1 ? "s" : "") + " inactive 14+ days", action: () => onNav("pipeline") });

  // Unread inbox messages
  const unreadCount = (typeof inboxThreads !== "undefined" ? inboxThreads : []).filter(t => t.unread).length;
  if (unreadCount > 0) alerts.push({ key: "inbox", icon: MessageSquare, tone: "blue", msg: unreadCount + " unread message" + (unreadCount !== 1 ? "s" : "") + " in inbox", action: () => onNav("inbox") });

  // Employee late-arrival flags — jobs clocked in well after their scheduled start
  const lateToday = jobs.filter(j => {
    if (j.scheduledDate !== todayStr || !j.clockInAt || !j.scheduledTime) return false;
    const scheduled = new Date(`${j.scheduledDate}T${j.scheduledTime}:00`).getTime();
    return (j.clockInAt - scheduled) / 60000 > 15;
  });
  if (lateToday.length > 0) {
    alerts.push({ key: "late", icon: Clock, tone: "yellow", msg: lateToday.length + " late arrival" + (lateToday.length !== 1 ? "s" : "") + " today", action: () => onNav("jobs") });
  }

  // Employee notes/issues logged on jobs today (field reports flagged via the portal's "Add Note")
  const todaysIssueNotes = jobs
    .filter(j => j.scheduledDate === todayStr)
    .flatMap(j => (j.commLog || []).filter((e: any) => e.type === "note" && (e.date || "").startsWith(todayStr)).map((e: any) => ({ job: j, entry: e })));
  if (todaysIssueNotes.length > 0) {
    alerts.push({ key: "fieldnotes", icon: MessageSquare, tone: "orange", msg: todaysIssueNotes.length + " field note" + (todaysIssueNotes.length !== 1 ? "s" : "") + " from crew today", action: () => onNav("jobs") });
  }

  // Low chemical stock alert
  const lowStock = (typeof chemicals !== "undefined" ? chemicals : []).filter(c => c.stock <= c.reorderLevel);
  if (lowStock.length > 0) alerts.push({ key: "lowstock", icon: FlaskConical, tone: "yellow", msg: lowStock.length + " supply item" + (lowStock.length !== 1 ? "s" : "") + " low — " + lowStock[0]?.name + " needs reorder", action: () => onNav("chemicals") });

  // Fleet maintenance due
  const maintDueFleet = (typeof vehicles !== "undefined" ? vehicles : []).filter(v => {
    const lastOil = (typeof maintenance !== "undefined" ? maintenance : []).filter(m => m.vehicleId === v.id && (m.type||"").toLowerCase().includes("oil")).sort((a,b) => b.date?.localeCompare(a.date))[0];
    return !lastOil || daysSince(lastOil.date) > 90;
  });
  if (maintDueFleet.length > 0) alerts.push({ key: "fleet", icon: Truck, tone: "yellow", msg: maintDueFleet.length + " vehicle" + (maintDueFleet.length !== 1 ? "s" : "") + " due for oil change", action: () => onNav("fleet") });

  // No-shows this week
  const recentNoShows = (typeof jobs !== "undefined" ? jobs : []).filter(j => j.noShow && daysSince(j.scheduledDate) <= 7);
  if (recentNoShows.length > 0) alerts.push({ key: "noshow", icon: AlertTriangle, tone: "red", msg: recentNoShows.length + " no-show" + (recentNoShows.length !== 1 ? "s" : "") + " this week — follow up", action: () => onNav("jobs") });

  // Unsigned estimates (sent but not signed in 48h)
  const unsignedEst = (typeof estimates !== "undefined" ? estimates : []).filter(e => e.status === "pending" && e.sentAt && daysSince(e.sentAt) >= 2 && !e.signedAt);
  if (unsignedEst.length > 0) alerts.push({ key: "unsigned", icon: FileText, tone: "yellow", msg: unsignedEst.length + " estimate" + (unsignedEst.length !== 1 ? "s" : "") + " sent but not signed (48h+)", action: () => onNav("estimates") });

  const toneClass = t => ({
    red: "bg-danger-950/30 border-danger-600/50 text-danger-300",
    yellow: "bg-yellow-950/20 border-yellow-700/40 text-yellow-300",
    blue: "bg-blue-950/20 border-blue-700/40 text-blue-300",
    orange: "bg-orange-950/20 border-orange-700/40 text-orange-300",
    green: "bg-green-950/20 border-green-700/40 text-green-300"
  }[t] || "bg-white/5 border-white/10 text-white/70");

  // Live team view — who's clocked in right now, on which job, and how far
  // along their checklist is. Re-renders every 5s so elapsed time and any
  // newly clocked-in/out crew show up without a manual refresh (the
  // underlying jobs data itself already syncs via App.tsx's realtime/3s
  // poll — this tick is what makes the elapsed-time display itself update
  // even on a render where the data hasn't changed).
  const [, liveTeamTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => liveTeamTick(t => t + 1), 3000);
    return () => clearInterval(interval);
  }, []);
  // Live team = employees currently on shift (shift timer `dayClockInAt`),
  // NOT the old per-job `clockInAt` (removed when the per-job clock was
  // replaced by the whole-shift timer). Each on-shift employee is paired with
  // the job they're currently at (in_progress first, else an arrived-at job).
  const todayStrLive = today();
  // FIX 1 — this used to require e.status === "active" (strict-equality
  // allowlist). Anything unexpected in that field — a stray capitalized
  // "Active" from someone editing the Supabase table directly, a status this
  // app doesn't know about yet, a normalize gap — silently dropped an
  // otherwise genuinely-clocked-in employee from the whole view with no
  // error anywhere. Being clocked in (dayClockInAt truthy) already proves
  // they're on shift; only an explicit "inactive" should ever exclude them.
  // AUDIT ITEM 13 — even the "not inactive" denylist could still exclude a
  // genuinely clocked-in employee (any status value this app doesn't
  // recognize yet). Per explicit instruction: dayClockInAt being set IS
  // "on shift" — no other condition gates it, full stop.
  const liveEmps = employees.filter((e: any) => !!e.dayClockInAt);
  const liveTeam = liveEmps.map((e: any) => {
    // BUG FIX — this required scheduledDate === today exactly, so a job the
    // employee is ACTIVELY on right now (arrived, in_progress) but whose
    // scheduledDate is some other day (rescheduled, ran past midnight,
    // logged a day off from when it was originally booked) was invisible
    // here — the owner saw the employee as "active" with a location, but no
    // job, even though arrivedAt was correctly set. "Currently on this job"
    // (in_progress, or arrived and not completed) is a real-time signal
    // that should never depend on the job's scheduled date matching today.
    const empJobs = jobs
      .filter((j: any) => crewIncludesEmployee(j.crew, e.id, e.user_id) && (j.scheduledDate === todayStrLive || j.status === "in_progress" || (j.arrivedAt && j.status !== "completed" && j.status !== "cancelled")))
      .sort((a: any, b: any) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
    // FIX 3 (mobile round 6) — this used to fall all the way to `null` (no
    // checklist/photo card at all) for a clocked-in employee who hasn't been
    // marked "arrived" at any job yet (e.g. still driving to the first one).
    // Falling back to their next not-yet-completed job today means the card
    // still shows which job they're headed to and its checklist (0/N so
    // far), instead of reading as "checklists/photos are broken" when
    // there's simply nothing recorded yet.
    const currentJob = empJobs.find((j: any) => j.status === "in_progress")
      || empJobs.find((j: any) => j.arrivedAt && j.status !== "completed")
      || empJobs.find((j: any) => j.status !== "completed" && j.status !== "cancelled")
      || null;
    // FIX 3 — "Job 2 of 3" / completed-today counters for the crew card.
    const jobIndex = currentJob ? empJobs.findIndex((j: any) => j.id === currentJob.id) + 1 : 0;
    const completedTodayCount = empJobs.filter((j: any) => j.status === "completed").length;
    return { emp: e, job: currentJob, jobIndex, totalJobsToday: empJobs.length, completedTodayCount };
  });
  // GROUPING (additive presentation layer over `liveTeam`) — when two or more
  // on-shift employees are paired with the SAME current job (job.crew has
  // multiple people, e.g. two techs on one job), `liveTeam` above still
  // produces one row per employee, which rendered as duplicate cards both
  // pointing at the same job/checklist/address. This groups same-job rows
  // into a single "crew" entry (job + all member rows) purely for rendering;
  // an employee whose current job nobody else shares stays a "single" entry,
  // rendered identically to before. Does not touch on-shift detection,
  // crewStatusLabel, checklistProgress, or the 3s poll above.
  type LiveTeamRow = (typeof liveTeam)[number];
  const liveTeamGrouped: Array<
    { kind: "single"; row: LiveTeamRow } | { kind: "crew"; job: any; rows: LiveTeamRow[] }
  > = (() => {
    const byJobId = new Map<string, LiveTeamRow[]>();
    for (const row of liveTeam) {
      if (!row.job) continue;
      const arr = byJobId.get(row.job.id) || [];
      arr.push(row);
      byJobId.set(row.job.id, arr);
    }
    const seenGroupedJobIds = new Set<string>();
    const out: Array<{ kind: "single"; row: LiveTeamRow } | { kind: "crew"; job: any; rows: LiveTeamRow[] }> = [];
    for (const row of liveTeam) {
      const sharedRows = row.job ? byJobId.get(row.job.id) : undefined;
      if (row.job && sharedRows && sharedRows.length > 1) {
        if (seenGroupedJobIds.has(row.job.id)) continue;
        seenGroupedJobIds.add(row.job.id);
        out.push({ kind: "crew", job: row.job, rows: sharedRows });
      } else {
        out.push({ kind: "single", row });
      }
    }
    return out;
  })();
  // FIX 3 — an employee who clocked out today disappears from Live Team View
  // entirely (dayClockInAt goes null on end-of-day), which reads as "nobody
  // worked today" even though they did a full shift. toggleDay's clock-out
  // (EmployeePortal.tsx) writes lastShiftDate via localDateStr() (LOCAL date,
  // not the UTC-based today()/todayStrLive above), so the match here must use
  // localDateStr() too or a clock-out near end-of-day would never match.
  const shiftEndedTeam = employees.filter((e: any) =>
    !e.dayClockInAt && e.lastShiftDate === localDateStr() && Number(e.lastShiftHours) > 0
  );
  // FIX 8 — "My Hours": the owner gets a real employees row (see App.tsx
  // ownerEmpRowEnsuredRef effect) keyed `owner_<email>`, so their own clocked
  // time and crew-assigned jobs can be summarized the same way a technician's
  // can, right on the dashboard.
  // FIX 5 (mobile round 4) — this used to rebuild the id from
  // `settings.ownerName ? owner_${settings.googleEmail || "owner"} : null`,
  // the same divergent-copy bug found in JobDetailModal: it went null for
  // any owner who never set settings.ownerName, and fell back to the
  // literal "owner" (producing "owner_owner", matching nothing real) when
  // googleEmail wasn't set. Read the real row straight off `employees` by
  // role instead — it can't drift out of sync with what App.tsx actually
  // created.
  const ownerEmp = employees.find((e: any) => e.role === "owner") || null;
  const ownerEmpId = ownerEmp?.id || null;
  const ownerOnShift = !!ownerEmp?.dayClockInAt;
  const ownerShiftMs = ownerOnShift ? Math.max(0, Date.now() - Number(ownerEmp.dayClockInAt) - (Number(ownerEmp.dayPausedMinutes) || 0) * 60000) : 0;
  const weekStartLive = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
  const ownerJobsToday = ownerEmpId ? jobs.filter((j: any) => crewIncludesEmployee(j.crew, ownerEmpId, ownerEmp?.user_id) && j.scheduledDate === todayStrLive) : [];
  const ownerJobsThisWeek = ownerEmpId ? jobs.filter((j: any) => crewIncludesEmployee(j.crew, ownerEmpId, ownerEmp?.user_id) && j.scheduledDate >= weekStartLive) : [];
  const ownerHoursToday = ownerJobsToday.reduce((s: number, j: any) => s + (Number(j.loggedHours) || 0), 0);
  const ownerHoursThisWeek = ownerJobsThisWeek.reduce((s: number, j: any) => s + (Number(j.loggedHours) || 0), 0);

  // BLOCKER — `checklist` is the legacy pre-phase-split field; jobs seeded
  // from an approved estimate (App.tsx) set BOTH `checklist` AND
  // `preChecklist` to the SAME combined array, so unconditionally appending
  // `j.checklist` on top of the (already-defaulted) pre/during/post lists
  // double-counted every one of those items — a job with 7 real custom
  // items showed up to 14, or a mismatched fraction depending on how many
  // were done, matching reports of checklist totals looking wrong/partial.
  // `checklist` should only ever be used for genuinely OLD jobs that predate
  // the pre/during/post split (no phase data at all) — never alongside it.
  const getAllChecklistItems = (j: any): any[] =>
    (j.preChecklist?.length || j.duringChecklist?.length || j.postChecklist?.length || !j.checklist?.length)
      ? [
          ...(j.preChecklist?.length ? j.preChecklist : DASH_PRE_DEFAULTS),
          ...(j.duringChecklist?.length ? j.duringChecklist : DASH_DURING_DEFAULTS),
          ...(j.postChecklist?.length ? j.postChecklist : DASH_POST_DEFAULTS),
        ]
      : j.checklist;
  const checklistProgress = (j: any) => {
    // FIX 8 — fall back to defaults so a not-yet-touched job shows its real
    // (default) checklist progress instead of "0/0" — see DASH_*_DEFAULTS above.
    const items = getAllChecklistItems(j);
    if (items.length === 0) return null;
    const done = items.filter((it: any) => it.done).length;
    return { done, total: items.length, pct: Math.round((done / items.length) * 100) };
  };
  const fmtElapsed = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  // FIX 3 — status label for the crew member's current job: Running Late (past
  // scheduled start, not arrived), Just Started (arrived <15min ago), Almost
  // Done (checklist ≥80% but not finished), otherwise On Time.
  const crewStatusLabel = (j: any, prog: { done: number; total: number; pct: number } | null): { label: string; tone: string } => {
    if (j?.scheduledTime && j.scheduledDate === todayStrLive && !j.arrivedAt) {
      const scheduledMs = new Date(`${j.scheduledDate}T${j.scheduledTime}:00`).getTime();
      if (!Number.isNaN(scheduledMs) && Date.now() > scheduledMs + 10 * 60000) return { label: "Running Late", tone: "red" };
    }
    if (prog && prog.pct >= 80 && prog.pct < 100) return { label: "Almost Done", tone: "blue" };
    if (j?.arrivedAt && Date.now() - Number(j.arrivedAt) < 15 * 60000) return { label: "Just Started", tone: "blue" };
    return { label: "On Time", tone: "green" };
  };

  // ==== "Today" card computations ====
  // Crew status — reuses liveTeam/crewStatusLabel/checklistProgress computed
  // above (no re-implementation of clock-in detection or checklist math).
  const todayLiveWithStatus = liveTeam.map((t: any) => ({ ...t, status: crewStatusLabel(t.job, t.job ? checklistProgress(t.job) : null) }));
  const todayLateCount = todayLiveWithStatus.filter((t: any) => t.status.label === "Running Late").length;
  // Jobs due today — every non-cancelled job scheduled today (broader than
  // the `todayJobs` alert above, which only counts status==="scheduled", so
  // an in-progress or already-completed job still shows here) — PLUS any
  // job actively in_progress regardless of its scheduledDate. A job an
  // employee is genuinely working on right now (arrived, clocked in) but
  // that was scheduled for an earlier date must still show up here — same
  // "overdue but actively being worked" gap already fixed on the Live Team
  // View pairing filter above.
  const todayJobsList = jobs
    .filter((j: any) => j.status !== "cancelled" && (j.scheduledDate === todayStr || j.status === "in_progress"))
    .sort((a: any, b: any) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
  // Overdue invoices — reuses `overdueInv` computed above for the smart
  // alerts row (estimates.invoiced && !paidAt && daysSince(invoicedAt) > 14),
  // matching App.tsx's `overdueCount` convention (~line 1898) rather than a
  // new definition.
  const overdueInvTotal = overdueInv.reduce((s: number, e: any) => s + (Number(e.total) || 0), 0);
  // Low chemical stock — reuses `lowStock` computed above for the smart
  // alerts row (c.stock <= c.reorderLevel), same threshold ChemicalsPage.tsx
  // uses for its own low-stock banner.

  // FIX 5 — the owner's own crew-assigned jobs, shown inline on the dashboard
  // (not just a link to the Jobs page) so they get the same full checklist,
  // customer info, and signature-capture functionality a technician gets in
  // CrewView's "Live Now" detail modal, via the same JobDetailModal.
  const [ownerDetailId, setOwnerDetailId] = useState<string | null>(null);
  // BLOCKER — "My Week Ahead" days with more than one job were dead clicks
  // (onClick only fired for `single`); the owner had no way to see them at
  // all from here short of leaving the dashboard for the full Jobs page.
  // This opens a full-screen list of every job on that date instead.
  const [ownerDayJobsDate, setOwnerDayJobsDate] = useState<string | null>(null);
  // FIX 8 — Live Team View previously only ever showed a done/total COUNT for
  // checklists, never the actual items — "0/0" (or any count) with nothing to
  // click into wasn't distinguishable from "checklist data isn't loading" at
  // a glance. Click the progress badge to expand the real item list (done
  // AND not-done) inline, without needing the separate Job Detail modal.
  const [expandedChecklistJobId, setExpandedChecklistJobId] = useState<string | null>(null);
  // FIX 13 — this used to only write a hardcoded, narrow whitelist of fields
  // (clock/crew/checklist/status/signature) straight to Supabase — fine for
  // the handful of actions Dashboard.tsx itself triggered directly, but the
  // streamlined JobDetailView (below) sends many other patch shapes this
  // whitelist never anticipated: signOff (not "signature"), completedAt,
  // pipelineStage, paymentStatus/paymentType/amountCollected, invoiceSentAt,
  // commLog, arrivedAt — every one of those would have been silently
  // dropped, never reaching Supabase, with no error surfaced at all. Mirrors
  // EmployeePortal.tsx's own updateJob: write the FULL patch first, and only
  // fall back to a conservative core-column subset if PostgREST rejects the
  // whole thing (e.g. an optional column that doesn't exist on this
  // deployment yet — see docs/ARCHITECTURE.md's "safe column" note).
  const OWNER_CORE_JOB_COLUMNS = [
    "status", "paymentStatus", "paymentType", "loggedHours", "amountCollected", "invoiceSentAt", "arrivedAt",
    // "crewAssignedAt" was missing here (same gap as App.tsx's bulk autosave
    // and EmployeePortal's CORE_JOB_COLUMNS) — a full-patch write that
    // included crew always includes crewAssignedAt too; if the full write
    // 400s on some unrelated column and falls back to this safe-subset
    // retry, crew itself would still land but its assignment timestamp
    // silently wouldn't, dropping the "New Assignment" banner for no
    // apparent reason.
    "crew", "crewAssignedAt", "clockInAt", "lunchStartAt", "lunchMinutes", "lunchExceeded", "pipelineStage", "photos", "videos",
    "preChecklist", "duringChecklist", "postChecklist", "signOff", "commLog", "notes",
  ] as const;
  const ownerUpdateJob = (jid: string, patch: any): Promise<any> => {
    setJobs((prev: any[]) => prev.map((j: any) => j.id === jid ? { ...j, ...patch } : j));
    return (supabase as any).from("jobs").update(patch).eq("id", jid).select("id")
      .then(async (result: any) => {
        if (!result?.error && (!Array.isArray(result?.data) || result.data.length === 0)) {
          // AUDIT FIX — missing the documented RLS 0-row-silent-success check
          // (docs/ARCHITECTURE.md). Used for the owner's own Clock In/Out, arrival, and
          // checklist writes — a silently-dropped write here means the
          // owner's own shift clock reads as stuck without any explanation.
          console.warn("[ownerUpdateJob] update matched 0 rows for", jid);
          toast?.("Failed to save — the server didn't confirm the update.", "red");
          return { ...result, error: result?.error || new Error("0 rows matched") };
        }
        if (result?.error) {
          console.warn("[ownerUpdateJob] full patch failed:", result.error.message, "— retrying core fields only");
          const core: any = {};
          OWNER_CORE_JOB_COLUMNS.forEach(k => { if ((patch as any)[k] !== undefined) core[k] = (patch as any)[k]; });
          if (Object.keys(core).length > 0) {
            const retry = await (supabase as any).from("jobs").update(core).eq("id", jid).select("id");
            if (retry?.error) { console.error("[ownerUpdateJob] core retry failed:", retry.error.message); toast?.("Failed to save — " + retry.error.message, "red"); }
            else if (!Array.isArray(retry?.data) || retry.data.length === 0) { console.error("[ownerUpdateJob] core retry matched 0 rows"); toast?.("Failed to save — the server didn't confirm the update.", "red"); }
            return retry;
          }
          toast?.("Failed to save — " + result.error.message, "red");
          return result;
        }
        return result;
      })
      .catch((e: any) => { console.error("[ownerUpdateJob] threw:", e?.message); toast?.("Failed to save — " + (e?.message || "unknown error"), "red"); return { error: e }; });
  };

  // FIX 2 (mobile round 5) — "My Active Job": the single job (of the owner's
  // crew-assigned jobs today) most likely to be what they're working on right
  // now — an in-progress job wins outright, otherwise the earliest
  // not-yet-completed job today by scheduled time. Drives the quick-action
  // card below (Clock In/Out, I'm Here) so the owner doesn't have to open the
  // full job modal just to start their clock or mark arrival, mirroring what
  // a technician gets on their own portal's job card. Checklist/photos/
  // signature still route through the existing JobDetailModal below (tap the
  // card) rather than a second parallel implementation of that UI.
  const ownerActiveJob = (() => {
    const candidates = ownerJobsToday.filter((j: any) => j.status !== "completed" && j.status !== "cancelled");
    if (candidates.length === 0) return null;
    const inProgress = candidates.find((j: any) => j.status === "in_progress" || j.clockInAt);
    if (inProgress) return inProgress;
    return [...candidates].sort((a: any, b: any) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""))[0];
  })();
  const ownerActiveCustomer = ownerActiveJob ? customers.find((c: any) => c.id === ownerActiveJob.customerId) : null;
  const ownerActiveJobProg = ownerActiveJob ? checklistProgress(ownerActiveJob) : null;
  const ownerClockIn = () => {
    if (!ownerActiveJob) return;
    ownerUpdateJob(ownerActiveJob.id, { clockInAt: Date.now() });
    toast?.("Clocked in");
  };
  const ownerClockOut = () => {
    if (!ownerActiveJob?.clockInAt) return;
    const rounded = Math.round(((Date.now() - ownerActiveJob.clockInAt) / 3600000) * 100) / 100;
    ownerUpdateJob(ownerActiveJob.id, { clockInAt: null, loggedHours: Math.round(((Number(ownerActiveJob.loggedHours) || 0) + rounded) * 100) / 100 });
    toast?.("+" + rounded + "h logged");
  };
  const ownerMarkArrived = () => {
    if (!ownerActiveJob) return;
    ownerUpdateJob(ownerActiveJob.id, { arrivedAt: Date.now(), status: ownerActiveJob.status === "scheduled" ? "in_progress" : ownerActiveJob.status });
    toast?.("Marked as arrived ✓");
  };
  // FIX 5 (mobile round 6) — "My Work": OTW/Running Late for the owner's own
  // active job, mirroring EmployeePortal.tsx's sendOtw/sendRunningLate (same
  // SMS-first send, same inbox logging, same toast-on-success-and-failure
  // rule from docs/ARCHITECTURE.md) so the owner has the same field-communication tools
  // a technician has, without leaving the dashboard.
  const [ownerSendingOtw, setOwnerSendingOtw] = useState(false);
  const [ownerSendingLate, setOwnerSendingLate] = useState(false);
  // BLOCKER 11 (mobile round 9) — this owner-side copy only ever tried
  // Twilio and gave up with "No phone on file" if the customer had only an
  // email, or a bare Twilio-error toast if Twilio wasn't configured — no
  // email fallback at all, unlike EmployeePortal.tsx's sendOtw/sendRunningLate
  // (which let the tech explicitly pick Text or Email). Real customer data in
  // this business has plenty of email-only contacts, and this deployment's
  // console shows Twilio isn't configured yet (see BLOCKER 1) — so this
  // button could never succeed before. Falls back to the owner's Gmail on a
  // "Twilio not configured" error, or uses email outright when there's no
  // phone on file, and always resolves to a definite success/failure toast.
  const ownerSendOtw = async () => {
    if (!ownerActiveJob) return;
    if (!ownerActiveCustomer?.phone && !ownerActiveCustomer?.email) { toast?.("No phone or email on file for this customer — failed", "red"); return; }
    setOwnerSendingOtw(true);
    const msg = `Hi ${ownerActiveCustomer.firstName || "there"}, your CRM Starter technician is on the way!`;
    try {
      if (ownerActiveCustomer.phone) {
        try {
          await withTimeout(twilioSend(settings as any, ownerActiveCustomer.phone, msg), 15000, "OTW SMS");
          logOutboundSmsToInbox({ contactName: `${ownerActiveCustomer.firstName} ${ownerActiveCustomer.lastName}`, contactPhone: ownerActiveCustomer.phone, customerId: ownerActiveCustomer.id, body: msg }).catch(() => {});
          console.log("[OTW] sent via SMS to", ownerActiveCustomer.firstName);
          toast?.(`On the way message sent to ${ownerActiveCustomer.firstName} ✓`, "green");
          return;
        } catch (smsErr: any) {
          const notConfigured = (smsErr?.message || "").includes("Twilio not configured");
          if (!notConfigured || !ownerActiveCustomer.email) {
            console.error("[OTW] — error:", smsErr?.message || smsErr);
            toast?.(smsErr?.message || "Failed to send on-my-way message", "red");
            return;
          }
          console.warn("[OTW] Twilio not configured — falling back to email");
        }
      }
      if (!ownerActiveCustomer.email) { toast?.("No email on file to fall back to — failed", "red"); return; }
      const html = emailShell(settings,"On My Way", `<p>${msg}</p>`);
      await withTimeout(sendOwnerGmailOnly(settings as any, ownerActiveCustomer.email, "Your technician is on the way", html), 15000, "OTW email");
      console.log("[OTW] sent via email to", ownerActiveCustomer.firstName);
      toast?.(`On the way message sent to ${ownerActiveCustomer.firstName} ✓ (email)`, "green");
    } catch (e: any) {
      console.error("[OTW] — error:", e?.message || e);
      toast?.(e?.message || "Failed to send on-my-way message", "red");
    } finally {
      setOwnerSendingOtw(false);
    }
  };
  const ownerSendRunningLate = async (minutes: number) => {
    if (!ownerActiveJob) return;
    if (!ownerActiveCustomer?.phone && !ownerActiveCustomer?.email) { toast?.("No phone or email on file for this customer — failed", "red"); return; }
    setOwnerSendingLate(true);
    const newEta = new Date(Date.now() + minutes * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const msg = `Hi ${ownerActiveCustomer.firstName}, your CRM Starter technician is running approximately ${minutes} minutes behind. New ETA: ${newEta}. We apologize for the delay.`;
    try {
      if (ownerActiveCustomer.phone) {
        try {
          await withTimeout(twilioSend(settings as any, ownerActiveCustomer.phone, msg), 15000, "Running late SMS");
          logOutboundSmsToInbox({ contactName: `${ownerActiveCustomer.firstName} ${ownerActiveCustomer.lastName}`, contactPhone: ownerActiveCustomer.phone, customerId: ownerActiveCustomer.id, body: msg }).catch(() => {});
          console.log("[RunningLate] sent via SMS to", ownerActiveCustomer.firstName);
          toast?.(`Message sent to ${ownerActiveCustomer.firstName} ✓`, "green");
          return;
        } catch (smsErr: any) {
          const notConfigured = (smsErr?.message || "").includes("Twilio not configured");
          if (!notConfigured || !ownerActiveCustomer.email) {
            console.error("[RunningLate] — error:", smsErr?.message || smsErr);
            toast?.(smsErr?.message || "Failed to send running-late notice", "red");
            return;
          }
          console.warn("[RunningLate] Twilio not configured — falling back to email");
        }
      }
      if (!ownerActiveCustomer.email) { toast?.("No email on file to fall back to — failed", "red"); return; }
      const html = emailShell(settings,"Running Late", `<p>${msg}</p>`);
      await withTimeout(sendOwnerGmailOnly(settings as any, ownerActiveCustomer.email, "Your technician is running late", html), 15000, "Running late email");
      console.log("[RunningLate] sent via email to", ownerActiveCustomer.firstName);
      toast?.(`Message sent to ${ownerActiveCustomer.firstName} ✓ (email)`, "green");
    } catch (e: any) {
      console.error("[RunningLate] — error:", e?.message || e);
      toast?.(e?.message || "Failed to send running-late notice", "red");
    } finally {
      setOwnerSendingLate(false);
    }
  };

  const w: any = settings.dashboardWidgets || { quickActions: true, kpis: true, revenuePeriods: true, goals: true, outstanding: true, charts: true, activity: true };
  const [custOpen, setCustOpen] = useState(false);
  const widgetDefs = [
    { k: "quickActions", l: "Quick Actions" },
    { k: "kpis", l: "KPI Cards" },
    { k: "revenuePeriods", l: "Revenue Periods" },
    { k: "goals", l: "Goals & Forecast" },
    { k: "invoices", l: "Outstanding Invoices" },
    { k: "weather", l: "Weather Widget" },
    { k: "outstanding", l: "Outstanding / Upcoming" },
    { k: "charts", l: "Revenue Chart" },
    { k: "activity", l: "Recent Activity" }
  ];
  const toggleWidget = k => {
    const next = { ...w, [k]: !w[k] };
    setSettings(s => ({ ...s, dashboardWidgets: next }));
  };

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="text-xs text-white/40 mt-0.5">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setCustOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-black/40 border border-brand-900/30 rounded-xl text-xs text-white/50 hover:text-white hover:border-brand-600/50 transition"
              title="Customize widgets"
            >
              <Settings size={12} />Widgets
            </button>
            {custOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setCustOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-52 bg-black/95 border border-brand-900/40 rounded-xl shadow-2xl z-50 overflow-hidden p-2 space-y-1">
                  {widgetDefs.map(wd => (
                    <button key={wd.k} onClick={() => toggleWidget(wd.k)} className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-lg text-xs text-left">
                      <div className={"w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 " + (w[wd.k] !== false ? "bg-brand-600 border-brand-500 text-brand-fg" : "border-white/30")}>
                        {w[wd.k] !== false && <span className="text-[8px]">✓</span>}
                      </div>
                      <span className={w[wd.k] !== false ? "text-white/80" : "text-white/40"}>{wd.l}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* "Today" — consolidated at-a-glance card: crew status, jobs due
          today, overdue invoices, low chemical stock. Sits at the very top
          (the owner's most-used landing page, usually opened on a phone
          first thing in the morning) so none of these four things require
          navigating to a separate page just to check. Mobile-first: single
          column that stacks to a 2- then 4-col grid as the viewport grows;
          collapsible so it doesn't permanently eat vertical space. */}
      <Glass className="p-4">
        <button onClick={() => setTodayCardCollapsed(v => !v)} className="w-full flex items-center gap-2 mb-1 text-left">
          <Sun size={15} className="text-yellow-400 flex-shrink-0" />
          <h3 className="font-semibold text-sm flex-1">Today</h3>
          <ChevronRight size={14} className={"text-white/40 transition-transform flex-shrink-0 " + (todayCardCollapsed ? "" : "rotate-90")} />
        </button>
        {!todayCardCollapsed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
            {/* Crew status */}
            <div className="p-3 rounded-xl bg-black/30 border border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-1"><Users2 size={12} className="text-green-400" />Crew</div>
              <div className="text-lg font-bold">{liveTeam.length} <span className="text-xs font-normal text-white/40">on shift</span></div>
              {todayLateCount > 0 ? (
                <div className="text-[11px] text-danger-400 mt-0.5">{todayLateCount} running late</div>
              ) : liveTeam.length > 0 ? (
                <div className="text-[11px] text-green-400 mt-0.5">On time</div>
              ) : (
                <div className="text-[11px] text-white/30 mt-0.5">{crewDataSettled ? "No one clocked in" : "Loading…"}</div>
              )}
            </div>

            {/* Jobs due today */}
            <button onClick={() => onNav?.("jobs")} className="text-left p-3 rounded-xl bg-black/30 border border-white/10 hover:border-blue-600/40 transition">
              <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-1"><Calendar size={12} className="text-blue-400" />Jobs today</div>
              <div className="text-lg font-bold">{todayJobsList.length}</div>
              {todayJobsList.length > 0 ? (() => {
                const first = todayJobsList[0];
                const c = customers.find((x: any) => x.id === first.customerId);
                const name = c ? `${c.firstName} ${c.lastName || ""}`.trim() : "Customer";
                return (
                  <div className="text-[11px] text-white/50 mt-0.5 truncate">
                    {name}{first.scheduledTime ? ` · ${first.scheduledTime}` : ""}{first.status ? ` · ${first.status.replace("_", " ")}` : ""}
                    {todayJobsList.length > 1 && ` +${todayJobsList.length - 1} more`}
                  </div>
                );
              })() : <div className="text-[11px] text-white/30 mt-0.5">Nothing scheduled</div>}
            </button>

            {/* Overdue invoices */}
            <button onClick={() => onNav?.("invoices")} className="text-left p-3 rounded-xl bg-black/30 border border-white/10 hover:border-brand-600/40 transition">
              <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-1"><Receipt size={12} className="text-danger-400" />Overdue invoices</div>
              <div className="text-lg font-bold">{overdueInv.length}</div>
              {overdueInv.length > 0 ? (
                <div className="text-[11px] text-danger-400 mt-0.5">{fmt(overdueInvTotal)} · past due 14+ days</div>
              ) : <div className="text-[11px] text-white/30 mt-0.5">None overdue</div>}
            </button>

            {/* Low chemical stock */}
            <button onClick={() => onNav?.("chemicals")} className="text-left p-3 rounded-xl bg-black/30 border border-white/10 hover:border-yellow-600/40 transition">
              <div className="flex items-center gap-1.5 text-[11px] text-white/50 mb-1"><FlaskConical size={12} className="text-yellow-400" />Low stock</div>
              <div className="text-lg font-bold">{lowStock.length}</div>
              {lowStock.length > 0 ? (
                <div className="text-[11px] text-yellow-400 mt-0.5 truncate">
                  {lowStock.slice(0, 2).map((c: any) => c.name.split(" ")[0]).join(", ")}{lowStock.length > 2 ? ` +${lowStock.length - 2}` : ""}
                </div>
              ) : <div className="text-[11px] text-white/30 mt-0.5">All stocked</div>}
            </button>
          </div>
        )}
      </Glass>

      {/* ITEM 10 — one-time prompt to enable desktop alerts, so "Report
          Problem" (and future crew-activity events) can reach the owner even
          when this tab isn't focused, not just via the in-app bell/toast and
          email. Only shown when permission hasn't been asked yet or was
          dismissed this session; never shown again once granted or denied. */}
      {desktopNotifsSupported() && desktopNotifPermission() === "default" && !desktopNotifDismissed && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/15 text-xs text-white/80">
          <Bell size={13} className="flex-shrink-0" />
          <span className="flex-1">Enable desktop alerts to get notified instantly when a crew member reports a problem — even if this tab isn't open.</span>
          <button onClick={async () => { await requestDesktopNotifPermission(); setDesktopNotifDismissed(true); }} className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-brand-fg font-semibold whitespace-nowrap">Enable</button>
          <button onClick={() => setDesktopNotifDismissed(true)} className="text-white/40 hover:text-white"><X size={14} /></button>
        </div>
      )}

      {/* Smart alerts - compact single row */}
      {alerts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {alerts.slice(0, 5).map(a => {
            const Icon = a.icon;
            return <button key={a.key} onClick={a.action} className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs hover:scale-[1.02] transition " + toneClass(a.tone)}>
              <Icon size={11} className="flex-shrink-0" />
              <span className="max-w-[200px] truncate">{a.msg}</span>
            </button>;
          })}
          {alerts.length > 5 && <span className="text-xs text-white/40 self-center">+{alerts.length - 5} more</span>}
        </div>
      )}

      {/* Live team view — always rendered (shows an explicit empty state when
          no one is clocked in, rather than vanishing entirely); auto-refreshes
          every 30s via the liveTeamTick interval above. */}
      <Glass className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users2 size={15} className="text-green-400" />
          <h3 className="font-semibold text-sm">Live Team View</h3>
          {liveTeam.length > 0 && <Badge tone="green">{liveTeam.length} on shift</Badge>}
          {crewFetchError && <Badge tone="yellow">⚠ updating… showing last known data</Badge>}
        </div>
        {/* BLOCKER 5 (mobile round 9) — a one-line, real-data summary of how
            the crew's day is going, computed from the same liveTeam data
            (status labels, job counts, checklist progress) already used for
            each card below — not a separate LLM call, since this view
            already polls every 3s and a network round-trip per tick would
            make it feel laggy for something this data already answers. */}
        {liveTeam.length > 0 && (() => {
          const withStatus = liveTeam.map(t => ({ ...t, status: crewStatusLabel(t.job, t.job ? checklistProgress(t.job) : null) }));
          const lateCount = withStatus.filter(t => t.status.label === "Running Late").length;
          const totalJobsTodayAll = liveTeam.reduce((s, t) => s + t.totalJobsToday, 0);
          const completedTodayAll = liveTeam.reduce((s, t) => s + t.completedTodayCount, 0);
          const aheadCount = withStatus.filter(t => t.completedTodayCount > 0 && t.status.label !== "Running Late").length;
          const parts: string[] = [];
          parts.push(lateCount > 0 ? `⚠ ${lateCount} crew member${lateCount > 1 ? "s" : ""} running late` : "✓ Crew is on time");
          if (totalJobsTodayAll > 0) parts.push(`${completedTodayAll} of ${totalJobsTodayAll} jobs done today`);
          if (lateCount === 0 && aheadCount > 0) parts.push(`${aheadCount} finished ${aheadCount > 1 ? "jobs" : "a job"} ahead of schedule`);
          return (
            <div className={"mb-3 px-3 py-2 rounded-xl text-xs font-medium " + (lateCount > 0 ? "bg-brand-950/20 border border-brand-700/30 text-brand-300" : "bg-green-950/20 border border-green-700/30 text-green-300")}>
              {parts.join(" · ")}
            </div>
          );
        })()}
        {liveTeam.length === 0 ? (
          <div className="text-center py-6 text-sm text-white/40">
            {crewDataSettled ? "No one on shift — waiting for crew to start their day" : "Loading crew status…"}
          </div>
        ) : (
          <div className="space-y-2">
            {liveTeamGrouped.map((item) => {
              if (item.kind === "crew") {
                // GROUPED CREW CARD — multiple on-shift employees sharing the
                // same current job. Job data (address, status, checklist,
                // photos/videos) is shared since it belongs to the job, not
                // any one employee; each member's name and their own live
                // location badge are listed individually below.
                const j = item.job;
                const rows = item.rows;
                const c = customers.find(x => x.id === j.customerId) || null;
                const prog = checklistProgress(j);
                const photoCount = totalJobPhotoCount(j);
                const videoCount = (j.videos || []).length;
                const mapsKey = settings.googleMapsKey || settings.mapsKey;
                const status = crewStatusLabel(j, prog);
                const reportedIssue = [...(j.commLog || [])].reverse().find((c: any) => typeof c.note === "string" && c.note.startsWith("🚨 ISSUE REPORTED") && c.date === todayStrLive);
                const totalJobsToday = rows[0].totalJobsToday;
                const completedTodayCount = rows[0].completedTodayCount;
                const jobIndex = rows[0].jobIndex;
                return (
                  <div key={"crew-" + j.id} className="flex items-center gap-3 p-3 rounded-xl border bg-black/30 border-white/10">
                    <div onClick={() => onViewJob(j.id)} className="cursor-pointer"><MiniStreetViewThumb address={j.address} mapsKey={mapsKey} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={"text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0 " +
                          (status.tone === "red" ? "bg-danger-900/40 text-danger-300" : status.tone === "blue" ? "bg-blue-900/40 text-blue-300" : "bg-green-900/40 text-green-300")}>
                          {status.label}
                        </span>
                        {reportedIssue && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0 bg-brand-600/40 text-brand-200 border border-brand-500/50 animate-pulse">
                            ⚠️ Issue Reported
                          </span>
                        )}
                      </div>
                      {/* Crew member chips — name + individual live-location dot per member */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {rows.map(({ emp: re }) => (
                          <span key={re.id} className="flex items-center gap-1 text-[11px] font-medium bg-white/5 border border-white/10 rounded-full pl-0.5 pr-2 py-0.5">
                            <span className="w-4 h-4 rounded-full bg-green-950/40 border border-green-700/30 flex items-center justify-center text-green-400 font-bold text-[8px] flex-shrink-0">
                              {(re.firstName?.[0] || "?")}{(re.lastName?.[0] || "")}
                            </span>
                            <span onClick={() => onViewJob(j.id)} className="cursor-pointer hover:underline">{re.firstName} {re.lastName}</span>
                            {re.locationSharing && re.lastLocation?.updatedAt && (
                              <span className="flex items-center gap-1 text-blue-400" title={"Location updated " + new Date(re.lastLocation.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}>
                                <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" /></span>
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-white/50 truncate mt-1 flex items-center gap-1">
                        <MapPin size={10} className="flex-shrink-0" />{c ? `${c.firstName} ${c.lastName} — ${j.address}` : j.address}
                      </div>
                      {reportedIssue && (
                        <div className="text-[11px] text-brand-300 bg-brand-950/30 border border-brand-700/40 rounded-lg px-2 py-1 mt-1">
                          {reportedIssue.note.replace("🚨 ISSUE REPORTED", "🚨").trim()}
                        </div>
                      )}
                      <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap mt-1">
                        {j.arrivedAt && <span className="text-green-400">✓ on site</span>}
                        {totalJobsToday > 0 && <span className="text-white/40">Job {jobIndex} of {totalJobsToday}</span>}
                        {photoCount > 0 && <span className="flex items-center gap-1"><ImageIcon size={10} />{photoCount} photo{photoCount !== 1 ? "s" : ""}</span>}
                        {videoCount > 0 && <span className="flex items-center gap-1"><Video size={10} />{videoCount} video{videoCount !== 1 ? "s" : ""}</span>}
                      </div>
                      {totalJobsToday > 0 && (() => {
                        const dailyPct = Math.round((completedTodayCount / totalJobsToday) * 100);
                        const hue = Math.round((dailyPct / 100) * 120);
                        return (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden max-w-[160px]">
                              <div className="h-full rounded-full transition-all" style={{ width: dailyPct + "%", background: `hsl(${hue}, 70%, 45%)` }} />
                            </div>
                            <span className="text-[10px] text-white/40 flex-shrink-0">{completedTodayCount}/{totalJobsToday} jobs today · {dailyPct}%</span>
                          </div>
                        );
                      })()}
                      {prog && (
                        <div className="mt-1.5">
                          <button onClick={() => setExpandedChecklistJobId(id => id === j.id ? null : j.id)} className="w-full flex items-center gap-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden max-w-[160px]">
                              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: prog.pct + "%" }} />
                            </div>
                            <span className="text-[10px] text-white/40 flex items-center gap-1 flex-shrink-0 hover:text-white/70"><CheckSquare size={10} />{prog.done}/{prog.total}</span>
                          </button>
                          {expandedChecklistJobId === j.id && (
                            <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto pr-1">
                              {getAllChecklistItems(j).map((ck: any, i: number) => (
                                <div key={i} className={"text-[10px] flex items-center gap-1.5 " + (ck.done ? "text-white/40 line-through" : "text-white/70")}>
                                  {ck.done ? <CheckSquare size={10} className="text-green-500 flex-shrink-0" /> : <Square size={10} className="text-white/30 flex-shrink-0" />}
                                  {ck.label}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button onClick={() => onViewJob(j.id)} className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60 hover:text-white flex-shrink-0">View Details</button>
                  </div>
                );
              }
              const { emp: e, job: j, jobIndex, totalJobsToday, completedTodayCount } = item.row;
              const c = j ? customers.find(x => x.id === j.customerId) : null;
              const pausedMs = (Number(e.dayPausedMinutes) || 0) * 60000;
              const onLunch = !!e.dayLunchStartAt;
              const lunchMs = onLunch ? Math.max(0, Date.now() - Number(e.dayLunchStartAt)) : 0;
              const shiftMs = Math.max(0, Date.now() - Number(e.dayClockInAt) - pausedMs - lunchMs);
              const prog = j ? checklistProgress(j) : null;
              const photoCount = j ? totalJobPhotoCount(j) : 0;
              const videoCount = j ? (j.videos || []).length : 0;
              const mapsKey = settings.googleMapsKey || settings.mapsKey;
              const status = crewStatusLabel(j, prog);
              // FIX 8 — surface a reported problem (EmployeePortal.tsx's
              // "Report Problem" button) right on the Live Team card, not
              // just buried in the job's comm log. commLog entries only
              // carry a day-granularity `date` (today(), matching every
              // other commLog entry in this codebase — see OTW/Running Late),
              // so "today's" reports is the most precise freshness check
              // available, rather than a misleading hour-precision window.
              const reportedIssue = j ? [...(j.commLog || [])].reverse().find((c: any) => typeof c.note === "string" && c.note.startsWith("🚨 ISSUE REPORTED") && c.date === todayStrLive) : null;
              return (
                <div key={e.id} className={"flex items-center gap-3 p-3 rounded-xl border " + (onLunch ? "bg-yellow-950/20 border-yellow-700/40" : "bg-black/30 border-white/10")}>
                  {/* FEATURE — name/photo now open the full job, same as the
                      "View Details" button, so there's no need to hunt for a
                      tiny button to see what a crew member is working on. */}
                  <div onClick={() => j && onViewJob(j.id)} className={j ? "cursor-pointer" : ""}>
                    {j ? <MiniStreetViewThumb address={j.address} mapsKey={mapsKey} /> : (
                      <div className="w-14 h-14 rounded-lg bg-green-950/30 border border-green-700/30 flex items-center justify-center flex-shrink-0 text-green-400 font-bold text-sm">
                        {(e.firstName?.[0] || "?")}{(e.lastName?.[0] || "")}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div onClick={() => j && onViewJob(j.id)} className={"text-sm font-medium truncate " + (j ? "cursor-pointer hover:underline" : "")}>{e.firstName} {e.lastName}</div>
                      {j && (
                        <span className={"text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0 " +
                          (status.tone === "red" ? "bg-danger-900/40 text-danger-300" : status.tone === "blue" ? "bg-blue-900/40 text-blue-300" : "bg-green-900/40 text-green-300")}>
                          {status.label}
                        </span>
                      )}
                      {reportedIssue && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0 bg-brand-600/40 text-brand-200 border border-brand-500/50 animate-pulse">
                          ⚠️ Issue Reported
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-white/50 truncate mt-0.5 flex items-center gap-1">
                      {j ? <><MapPin size={10} className="flex-shrink-0" />{c ? `${c.firstName} ${c.lastName} — ${j.address}` : j.address}</> : <span className="text-white/30">No active job</span>}
                    </div>
                    {reportedIssue && (
                      <div className="text-[11px] text-brand-300 bg-brand-950/30 border border-brand-700/40 rounded-lg px-2 py-1 mt-1">
                        {reportedIssue.note.replace("🚨 ISSUE REPORTED", "🚨").trim()}
                      </div>
                    )}
                    <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap mt-1">
                      <span className={"font-mono " + (onLunch ? "text-yellow-400" : "text-green-400")}>{onLunch ? "⏸ " : "⏱ "}{fmtElapsed(shiftMs)} shift</span>
                      {onLunch && <span className="text-yellow-400/70">on lunch</span>}
                      {j?.arrivedAt && <span className="text-green-400">✓ on site</span>}
                      {totalJobsToday > 0 && (
                        <span className="text-white/40">
                          {j ? `Job ${jobIndex} of ${totalJobsToday}` : totalJobsToday === completedTodayCount ? `${totalJobsToday} job${totalJobsToday !== 1 ? "s" : ""} done today` : `${completedTodayCount + 1}${completedTodayCount === 0 ? "st" : completedTodayCount === 1 ? "nd" : completedTodayCount === 2 ? "rd" : "th"} job today`}
                        </span>
                      )}
                      {photoCount > 0 && <span className="flex items-center gap-1"><ImageIcon size={10} />{photoCount} photo{photoCount !== 1 ? "s" : ""}</span>}
                      {videoCount > 0 && <span className="flex items-center gap-1"><Video size={10} />{videoCount} video{videoCount !== 1 ? "s" : ""}</span>}
                      {/* FIX 11 — a simple always-available badge, independent of
                          whether a Google Maps key is configured (CrewView's
                          "Live Now" map is the full-map view when a key exists). */}
                      {e.locationSharing && e.lastLocation?.updatedAt && (
                        <span className="flex items-center gap-1 text-blue-400">
                          <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-400" /></span>
                          📍 {new Date(e.lastLocation.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {/* FEATURE — daily job-completion progress, distinct from
                        the per-job checklist bar below: how many of TODAY's
                        assigned jobs this crew member has finished (1 of 3
                        done = 33%), not how far along the current job's
                        checklist is. Color runs red (just started) to green
                        (all done today) along the way, per explicit request. */}
                    {totalJobsToday > 0 && (() => {
                      const dailyPct = Math.round((completedTodayCount / totalJobsToday) * 100);
                      const hue = Math.round((dailyPct / 100) * 120); // 0=red, 120=green
                      return (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden max-w-[160px]">
                            <div className="h-full rounded-full transition-all" style={{ width: dailyPct + "%", background: `hsl(${hue}, 70%, 45%)` }} />
                          </div>
                          <span className="text-[10px] text-white/40 flex-shrink-0">{completedTodayCount}/{totalJobsToday} jobs today · {dailyPct}%</span>
                        </div>
                      );
                    })()}
                    {prog && (
                      <div className="mt-1.5">
                        <button onClick={() => setExpandedChecklistJobId(id => id === j.id ? null : j.id)} className="w-full flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden max-w-[160px]">
                            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: prog.pct + "%" }} />
                          </div>
                          <span className="text-[10px] text-white/40 flex items-center gap-1 flex-shrink-0 hover:text-white/70"><CheckSquare size={10} />{prog.done}/{prog.total}</span>
                        </button>
                        {expandedChecklistJobId === j.id && (
                          <div className="mt-1.5 space-y-1 max-h-40 overflow-y-auto pr-1">
                            {getAllChecklistItems(j).map((ck: any, i: number) => (
                              <div key={i} className={"text-[10px] flex items-center gap-1.5 " + (ck.done ? "text-white/40 line-through" : "text-white/70")}>
                                {ck.done ? <CheckSquare size={10} className="text-green-500 flex-shrink-0" /> : <Square size={10} className="text-white/30 flex-shrink-0" />}
                                {ck.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {j && <button onClick={() => onViewJob(j.id)} className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/60 hover:text-white flex-shrink-0">View Details</button>}
                </div>
              );
            })}
          </div>
        )}

        {/* FIX 3 — employees whose shift already ended today, so the owner
            can still see who worked and their total hours after clock-out. */}
        {shiftEndedTeam.length > 0 && (
          <div className="space-y-2 mt-2 pt-2 border-t border-white/5">
            {shiftEndedTeam.map((e: any) => {
              const h = Math.floor(Number(e.lastShiftHours) || 0);
              const m = Math.round(((Number(e.lastShiftHours) || 0) - h) * 60);
              return (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border bg-black/20 border-white/5 opacity-70">
                  <div className="w-14 h-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-white/40 font-bold text-sm">
                    {(e.firstName?.[0] || "?")}{(e.lastName?.[0] || "")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-white/70">{e.firstName} {e.lastName}</div>
                    <div className="text-xs text-white/40 mt-0.5">Shift Ended · Total: {h}h {String(m).padStart(2, "0")}m</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Glass>

      {/* FIX 2 (mobile round 5) — "My Active Job": the owner's own crew-
          assigned job for today, with the same quick actions a technician
          gets on their portal job card (Clock In/Out, I'm Here), so the
          owner doesn't have to open the full job modal for the basics.
          Checklist progress is shown here; the actual checklist items,
          photo upload, and signature capture are one tap away via the
          existing JobDetailModal below (setOwnerDetailId) rather than a
          second, divergent copy of that UI built inline here. */}
      {/* ITEM 6 (discoverability) — this whole card only ever rendered when
          the owner had a crew-assigned job today, so an owner testing "self-
          serve clock in" with no job assigned to themselves today saw
          nothing at all — indistinguishable from the feature not existing.
          Explicit empty state instead, so it's clear what to do next. */}
      {!ownerActiveJob && (
        <Glass className="p-4 !bg-black/30">
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Briefcase size={13} />
            No job assigned to you today — assign yourself to a job's crew to see it here.
          </div>
          <div className="mt-2"><OwnerShiftBar ownerEmp={ownerEmp} toast={toast} /></div>
        </Glass>
      )}
      {ownerActiveJob && (
        <Glass className="p-4 !border-green-700/30">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={15} className="text-green-400" />
            <h3 className="font-semibold text-sm">My Work</h3>
            {ownerActiveJob.clockInAt && <Badge tone="green">Clocked in</Badge>}
          </div>
          <button onClick={() => setOwnerDetailId(ownerActiveJob.id)} className="w-full text-left mb-3 p-2.5 rounded-xl border border-white/10 bg-black/30 hover:border-green-600/40 transition">
            <div className="text-sm font-medium truncate">{ownerActiveCustomer ? `${ownerActiveCustomer.firstName} ${ownerActiveCustomer.lastName}` : "Customer"}</div>
            <div className="text-[11px] text-white/40 flex items-center gap-1 truncate"><MapPin size={10} />{ownerActiveJob.address}</div>
            {ownerActiveJobProg && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-[10px] text-white/40 mb-1"><span>Checklist</span><span>{ownerActiveJobProg.done}/{ownerActiveJobProg.total}</span></div>
                <PBar value={ownerActiveJobProg.done} max={ownerActiveJobProg.total || 1} />
              </div>
            )}
          </button>
          <div className="flex gap-2 flex-wrap">
            {!ownerActiveJob.arrivedAt && (
              <GBtn onClick={ownerMarkArrived} className="flex-1 !justify-center !text-xs"><MapPin size={12} className="inline mr-1" />I'm Here</GBtn>
            )}
            {/* A per-job timer left running from before can still be stopped. */}
            {ownerActiveJob.clockInAt && (
              <GBtn variant="danger" onClick={ownerClockOut} className="flex-1 !justify-center !text-xs"><Clock size={12} className="inline mr-1" />Stop job timer</GBtn>
            )}
          </div>
          {/* The owner clocks in for the day, not per job. */}
          <div className="mt-2"><OwnerShiftBar ownerEmp={ownerEmp} toast={toast} /></div>
          {/* FIX 5 (mobile round 6) — OTW/Running Late, same customer-facing
              tools a technician has in the field portal. */}
          <div className="flex gap-2 flex-wrap mt-2">
            <GBtn variant="ghost" disabled={ownerSendingOtw} onClick={ownerSendOtw} className="flex-1 !justify-center !text-xs">{ownerSendingOtw ? "Sending…" : "On My Way"}</GBtn>
            <GBtn variant="ghost" disabled={ownerSendingLate} onClick={() => ownerSendRunningLate(15)} className="flex-1 !justify-center !text-xs">{ownerSendingLate ? "Sending…" : "Running Late (+15m)"}</GBtn>
          </div>
        </Glass>
      )}

      {/* FIX 8 — My Hours: the owner's own tracked time, mirroring what a
          technician sees, computed from their own employees row + crew-assigned jobs. */}
      {ownerEmpId && (
        <Glass className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className={ownerOnShift ? "text-green-400" : "text-white/40"} />
            <h3 className="font-semibold text-sm">My Hours</h3>
            {ownerOnShift && <Badge tone="green">On shift</Badge>}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[10px] text-white/40 uppercase">Current Shift</div>
              <div className={"text-lg font-bold font-mono " + (ownerOnShift ? "text-green-400" : "text-white/30")}>{ownerOnShift ? fmtElapsed(ownerShiftMs) : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase">Logged Today</div>
              <div className="text-lg font-bold">{ownerHoursToday.toFixed(1)}h</div>
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase">Logged This Week</div>
              <div className="text-lg font-bold">{ownerHoursThisWeek.toFixed(1)}h</div>
            </div>
          </div>
          {ownerJobsToday.length === 0 ? (
            <div className="text-[10px] text-white/30 text-center mt-2">Clock in for the day from My Work or the Jobs page to track your hours here.</div>
          ) : (
            <div className="mt-3 space-y-1.5">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">My Jobs Today</div>
              {ownerJobsToday.map((j: any) => {
                const c = customers.find((x: any) => x.id === j.customerId);
                const prog = checklistProgress(j);
                return (
                  <button key={j.id} onClick={() => setOwnerDetailId(j.id)} className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-black/30 hover:border-green-600/40 transition text-left">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{c ? `${c.firstName} ${c.lastName}` : j.address}</div>
                      <div className="text-[10px] text-white/40 truncate flex items-center gap-2">
                        <span className={j.status === "completed" ? "text-green-400" : "text-white/40"}>{j.status}</span>
                        {prog && <span>{prog.done}/{prog.total} checklist</span>}
                      </div>
                    </div>
                    <ChevronRight size={13} className="text-white/30 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
          {/* FIX 5 (mobile round 6) — "personal calendar showing the owner's
              assigned jobs": a compact next-7-days strip, distinct from
              today's list above. Single-job days link straight to that job;
              multi-job days just show the count (open Jobs/Calendar for
              full detail) to keep this compact. */}
          {ownerEmpId && (() => {
            const weekAhead = Array.from({ length: 7 }, (_, i) => daysFromNow(i + 1));
            const upcoming = weekAhead
              .map(d => ({ date: d, jobs: jobs.filter((j: any) => crewIncludesEmployee(j.crew, ownerEmpId, ownerEmp?.user_id) && j.scheduledDate === d && j.status !== "cancelled") }))
              .filter(d => d.jobs.length > 0);
            if (upcoming.length === 0) return null;
            return (
              <div className="mt-3 space-y-1.5">
                <div className="text-[10px] text-white/40 uppercase tracking-wider">My Week Ahead</div>
                {upcoming.map(({ date, jobs: dayJobs }) => {
                  const single = dayJobs.length === 1 ? dayJobs[0] : null;
                  const label = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
                  return (
                    <button
                      key={date}
                      onClick={() => single ? setOwnerDetailId(single.id) : setOwnerDayJobsDate(date)}
                      className="w-full flex items-center justify-between gap-2 p-2 rounded-xl border border-white/10 bg-black/20 text-left hover:border-green-600/40 transition"
                    >
                      <span className="text-xs text-white/60">{label}</span>
                      <span className="text-[10px] text-white/40">{dayJobs.length} job{dayJobs.length > 1 ? "s" : ""}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </Glass>
      )}

      {/* FIX 13 — this used to be the full admin JobDetailModal (every field:
          pipeline stage, tags, equipment, chemicals, discounts, Google Calendar
          sync, etc.) even though this popup only ever opens for a job the
          OWNER is personally out working — all that admin surface is exactly
          what "shows too much info" was about. JobDetailView is the same
          streamlined, mobile-optimized view a field employee gets (sign-off,
          checklist with photo upload, clock in/out, OTW/Running Late, Report
          Problem) with no admin-only fields at all. */}
      {/* FIX — day with 2+ jobs from "My Week Ahead" (previously a dead
          click). Full-screen list of every job that date; tapping one drills
          into the same single-job JobDetailView the "My Jobs Today" rows
          already use. */}
      {ownerDayJobsDate && (() => {
        const dayJobs = jobs
          .filter((j: any) => crewIncludesEmployee(j.crew, ownerEmpId, ownerEmp?.user_id) && j.scheduledDate === ownerDayJobsDate && j.status !== "cancelled")
          .sort((a: any, b: any) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
        const label = new Date(ownerDayJobsDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
        return (
          // z-[100], not z-50 — the FAB and toast stack are ALSO z-50 and
          // render later in the DOM (App.tsx), so equal z-index means THEY
          // paint on top of this at that tie; bumped above everything in the
          // owner shell. No min-h-screen: that's a min-HEIGHT of 100vh
          // stacked on top of inset-0's own top/bottom-derived sizing, and
          // on mobile Safari 100vh doesn't track the real visible viewport
          // as the URL bar shows/hides — the two sizing rules can disagree
          // enough to leave the dashboard visible through a gap at the
          // bottom while scrolling. inset-0 alone (matching every other
          // full-screen overlay in this file) sizes correctly against the
          // real viewport in all cases.
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-black text-white">
            <div className="sticky top-0 z-10 bg-black/95 backdrop-blur border-b border-white/10 p-4 flex items-center gap-3">
              <button onClick={() => setOwnerDayJobsDate(null)} className="text-white/60 hover:text-white flex-shrink-0">
                <ChevronLeft size={22} />
              </button>
              <div>
                <div className="font-bold text-base">{label}</div>
                <div className="text-xs text-white/40">{dayJobs.length} job{dayJobs.length !== 1 ? "s" : ""} scheduled</div>
              </div>
            </div>
            <div className="p-4 space-y-2">
              {dayJobs.map((j: any) => {
                const c = customers.find((x: any) => x.id === j.customerId);
                const prog = checklistProgress(j);
                return (
                  <button
                    key={j.id}
                    onClick={() => { setOwnerDayJobsDate(null); setOwnerDetailId(j.id); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-black/30 hover:border-green-600/40 transition text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c ? `${c.firstName} ${c.lastName}` : j.address}</div>
                      <div className="text-[10px] text-white/40 truncate flex items-center gap-2 mt-0.5">
                        {j.scheduledTime && <span>{j.scheduledTime}</span>}
                        <span className={j.status === "completed" ? "text-green-400" : "text-white/40"}>{j.status}</span>
                        {prog && <span>{prog.done}/{prog.total} checklist</span>}
                      </div>
                    </div>
                    <ChevronRight size={13} className="text-white/30 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {ownerDetailId && (() => {
        const j = jobs.find((x: any) => x.id === ownerDetailId);
        if (!j) return null;
        const c = customers.find((x: any) => x.id === j.customerId);
        return (
          // Same z-[100]/bg-black fix as the day-list modal above — this
          // wrapper previously had no background of its own at all (relying
          // solely on JobDetailView's inner min-h-screen div to paint black),
          // and sat at z-50, tied with the FAB/toast stack that renders after
          // it in the DOM and so visually wins the tie.
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-black">
            <JobDetailView
              job={j}
              customer={c}
              onBack={() => setOwnerDetailId(null)}
              onUpdateJob={patch => ownerUpdateJob(j.id, patch)}
              toast={toast}
              companyName={settings.companyName || "CRM Starter"}
              maxLunchMinutes={(settings as any).maxLunchMinutes ?? 30}
              googleMapsKey={(settings as any).googleMapsKey || (settings as any).mapsKey}
              paidLunchBreaks={!!(settings as any).paidLunchBreaks}
              signOffDisclaimer={j.signOffTerms || (settings as any).termsAndConditions || (settings as any).terms || ""}
              settings={settings as any}
              setEstimates={setEstimates}
              employeeName={ownerEmp?.firstName || (settings as any).ownerName || "Owner"}
            />
          </div>
        );
      })()}

      {/* BUG FIX — "there are two different items that say Completed Needs
          Invoice and Outstanding Invoice, keep only one or merge them."
          These were two genuinely different pipeline stages (invoice not
          sent yet vs. sent-but-unpaid) rendered as two separate cards —
          merged into one "Invoices" card with both sections stacked under
          a single combined count/header, instead of two cards competing
          for the same visual real estate on the dashboard. Both sections'
          own row content/actions are unchanged. */}
      {/* BUG FIX (user report) — "it should display only the 'Needs invoice
          sent' items, not the 'awaiting payment' entries." Dropped the
          unpaidInvoices/"Awaiting payment" section entirely; count/overdue
          badge now reflect only needsInvoiceJobs. */}
      {(() => {
        if (needsInvoiceJobs.length === 0) return null;
        return (
          <Glass className="p-4 !bg-yellow-950/15 !border-yellow-700/30">
            <button onClick={() => setNeedsInvoiceCollapsed(c => !c)} className="w-full flex items-center gap-2 mb-3 text-left">
              <AlertTriangle size={14} className="text-yellow-400" />
              <h3 className="font-semibold text-sm flex-1">Invoices</h3>
              <Badge tone="yellow">{needsInvoiceJobs.length}</Badge>
              <ChevronRight size={14} className={"text-white/40 transition-transform " + (needsInvoiceCollapsed ? "" : "rotate-90")} />
            </button>
            {!needsInvoiceCollapsed && (
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Needs invoice sent ({needsInvoiceJobs.length})</div>
                <div className="space-y-2">
                  {needsInvoiceJobs.slice(0, 5).map((j: any) => {
                    const cust = customers.find((c: any) => c.id === j.customerId);
                    return (
                      <div key={j.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{cust ? `${cust.firstName} ${cust.lastName}` : j.address}</div>
                          <div className="text-xs text-white/40">{j.address} · {fmt(j.amount)}</div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => { setJobs((prev: any[]) => prev.map(x => x.id === j.id ? { ...x, invoiceSentAt: today(), paymentType: x.paymentType || "Invoice" } : x)); toast?.("Marked as sent (outside the CRM)", "green"); }} title="Already sent this invoice outside the CRM" className="px-2 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white text-xs transition">
                            Mark Sent
                          </button>
                          <GBtn onClick={() => setPreviewInvoiceJob(j)} disabled={sendingDashInvoiceId === j.id} className="!text-xs !py-1.5">
                            {sendingDashInvoiceId === j.id ? "Sending…" : "Send Invoice"}
                          </GBtn>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {needsInvoiceJobs.length > 5 && (
                  <button onClick={() => onNav("invoices")} className="w-full mt-2 text-xs text-white/40 hover:text-white/60 text-center">View all {needsInvoiceJobs.length} →</button>
                )}
              </div>
            )}
          </Glass>
        );
      })()}

      {/* End-of-day summary — auto-generated from today's job/crew activity.
          Recomputed on every render from live props, so it updates the moment
          a job completes, an employee clocks in/out, a payment lands, or an
          invoice goes out — no manual refresh or separate trigger needed. */}
      {(() => {
        const todaysJobs = jobs.filter(j => j.scheduledDate === todayStr);
        const completedToday = todaysJobs.filter(j => j.status === "completed");
        if (todaysJobs.length === 0) return null;
        const ratedEmployees = employees.filter((e: any) => typeof e.ratingScore === "number");
        const invoicesSentToday = estimates.filter((e: any) => e.invoiced && e.invoicedAt === todayStr).length;
        const paymentsToday = estimates.filter((e: any) => e.paidAt === todayStr);
        const revenueToday = paymentsToday.reduce((s: number, e: any) => s + (Number(e.total) || 0), 0);
        const clockedInNow = employees.filter((e: any) => !!e.dayClockInAt).length;
        return (
          <Glass className="p-4 !bg-black/40">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">📋 Daily Summary — {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</div>
              {onSendDailyBriefing && (
                <button onClick={onSendDailyBriefing} className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-blue-950/30 border border-blue-700/30 text-blue-300 hover:bg-blue-900/40 transition flex-shrink-0">
                  <Mail size={10} />Email Briefing
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
              <div className="text-center p-2.5 rounded-xl bg-green-950/20 border border-green-700/20">
                <div className="text-xl font-black text-green-400">{completedToday.length}/{todaysJobs.length}</div>
                <div className="text-[10px] text-white/40 uppercase mt-0.5">Jobs Done</div>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-yellow-950/20 border border-yellow-700/20">
                <div className="text-xl font-black text-yellow-400">{lateToday.length}</div>
                <div className="text-[10px] text-white/40 uppercase mt-0.5">Late Arrivals</div>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-orange-950/20 border border-orange-700/20">
                <div className="text-xl font-black text-orange-400">{todaysIssueNotes.length}</div>
                <div className="text-[10px] text-white/40 uppercase mt-0.5">Field Notes</div>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-blue-950/20 border border-blue-700/20">
                <div className="text-xl font-black text-blue-400">{clockedInNow}</div>
                <div className="text-[10px] text-white/40 uppercase mt-0.5">On Shift Now</div>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-purple-950/20 border border-purple-700/20">
                <div className="text-xl font-black text-purple-400">{invoicesSentToday}</div>
                <div className="text-[10px] text-white/40 uppercase mt-0.5">Invoices Sent</div>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-green-950/20 border border-green-700/20">
                <div className="text-xl font-black text-green-400">{fmt(revenueToday)}</div>
                <div className="text-[10px] text-white/40 uppercase mt-0.5">Collected Today</div>
              </div>
            </div>
            {ratedEmployees.length > 0 && (
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Crew Ratings</div>
                <div className="flex flex-wrap gap-2">
                  {ratedEmployees.map((e: any) => (
                    <span key={e.id} className={"text-[10px] px-2.5 py-1 rounded-full border " + (e.ratingScore >= 80 ? "bg-green-950/30 border-green-700/30 text-green-300" : e.ratingScore >= 60 ? "bg-yellow-950/30 border-yellow-700/30 text-yellow-300" : "bg-brand-950/30 border-brand-700/30 text-brand-300")}>
                      {e.firstName} {e.lastName} — {e.ratingScore}/100
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Glass>
        );
      })()}

      {/* Top row: revenue periods.
          BUG FIX — "remove New Estimate / Schedule Job from the dashboard,
          they should automatically be at the bottom on mobile, on desktop
          use the normal workflow." Both duplicated the mobile FAB (see
          App.tsx's ALL_FAB_ACTIONS — "New Quote"/"Schedule Job" already
          exist there, already bottom-positioned on mobile) and the normal
          per-page Add buttons on Estimates/Jobs — this row was a third,
          redundant path to the same two actions cluttering the top of the
          dashboard. Removed; the FAB and each page's own Add button are
          the one real path now, exactly matching the request. */}
      {/* BUG FIX (user report) — "these widgets need to fill the page fully."
          This was grid-cols-6 with only 4 permanent cards (Today/This
          Week/This Month/Year to Date) — the 5th slot (the conditional
          "N Stop Route" card) is absent on most days, leaving 1-2 empty
          column tracks of dead space on the right on desktop instead of
          the cards stretching to fill the row. 4 columns matches the
          real, always-present card count. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(() => {
          const todayRoute = jobs.filter(j => j.scheduledDate === tKey && j.status === "scheduled");
          if (todayRoute.length === 0) return null;
          const mapsUrl = "https://www.google.com/maps/dir/" + todayRoute.map(j => encodeURIComponent(j.address || "")).join("/");
          return <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-hover glass-hover bg-black/40 border border-blue-900/30 rounded-2xl p-4 text-left hover:border-blue-600/50 transition">
            <Navigation size={18} className="mb-2 text-blue-400" />
            <div className="font-bold text-sm">{todayRoute.length} Stop Route</div>
            <div className="text-[10px] text-blue-300/70">Open in Maps</div>
          </a>;
        })()}
        <Glass className="p-4 flex flex-col justify-between">
          <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Today</div>
          <div>
            <div className="text-3xl font-black text-brand-400 mt-2">{fmt(revToday)}</div>
            <div className="text-[10px] text-white/40 mt-1">{todayJobs.length} job{todayJobs.length !== 1 ? "s" : ""} scheduled</div>
          </div>
        </Glass>
        <Glass className="p-4 flex flex-col justify-between">
          <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">This Week</div>
          <div>
            <div className="text-3xl font-black text-brand-400 mt-2">{fmt(revWeek)}</div>
            <div className="text-[10px] text-white/40 mt-1">{jobs.filter(j => new Date(j.scheduledDate) >= weekStart && j.status !== "cancelled").length} jobs</div>
          </div>
        </Glass>
        <Glass className="p-4 flex flex-col justify-between">
          <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">This Month</div>
          <div>
            <div className="text-3xl font-black text-brand-400 mt-2">{fmt(revMonth)}</div>
            <div className="text-[10px] text-white/40 mt-1">{goals.revenue > 0 ? Math.round(revMonth / goals.revenue * 100) + "% of goal" : "No goal set"}</div>
          </div>
        </Glass>
        <Glass className="p-4 flex flex-col justify-between">
          <div className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Year to Date</div>
          <div>
            <div className="text-3xl font-black text-brand-400 mt-2">{fmt(revThisYear)}</div>
            <div className={"text-[10px] font-semibold mt-1 " + (yoyPct === null ? "text-white/40" : yoyPct >= 0 ? "text-green-400" : "text-brand-400")}>
              {yoyPct === null ? "No prior year data" : (yoyPct >= 0 ? "▲" : "▼") + " " + Math.abs(yoyPct) + "% vs last year"}
            </div>
          </div>
        </Glass>
      </div>

      {/* KPI row - 4 across — every "change" badge below is calculated from
          real job/estimate data, never a hardcoded placeholder percentage. */}
      {(() => {
        const lastMonthRev = revenueByMonth.length >= 2 ? revenueByMonth[revenueByMonth.length - 2].revenue : 0;
        const revMoMPct = lastMonthRev > 0 ? Math.round((revMonth - lastMonthRev) / lastMonthRev * 100) : null;
        const newJobsThisWeek = jobs.filter(j => j.createdAt && daysSince(j.createdAt) <= 7).length;
        return w.kpis && <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <Stat icon={DollarSign} label="Total Revenue" value={fmt(stats.totalRev)} change={revMoMPct !== null ? `${revMoMPct >= 0 ? "+" : ""}${revMoMPct}% MoM` : undefined} />
          <Stat icon={Briefcase} label="Active Jobs" value={stats.activeJobs} change={newJobsThisWeek > 0 ? `+${newJobsThisWeek} this wk` : undefined} />
          <Stat icon={Target} label="Close Rate" value={stats.closeRate + "%"} />
        {(() => {
          const recurringJobs = jobs.filter(j => j.isRecurring && j.status === "completed" && daysSince(j.scheduledDate) <= 30);
          const mrr = recurringJobs.reduce((s, j) => s + j.amount, 0);
          return <Stat icon={RefreshCw} label="Recurring Rev" value={fmt(mrr)} change={mrr > 0 ? "🔄 MRR" : "—"} />;
        })()}
        </div>;
      })()}

      {/* Weather Widget — today's job impact */}
      {/* FIX 10 — this used to render wCurrent (seedWeather's hardcoded 72°F
          fallback) as if it were a real reading whenever no OWM key was set,
          with only a tiny "Forecast" label (easy to miss) hinting it wasn't
          live. Show an explicit setup prompt instead — never a fake
          temperature — so there's no ambiguity about whether a number on
          screen is real. */}
      {(w.weather ?? true) && !settings.owmKey && (
        <Glass className="p-4 !bg-white/5">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Cloud size={13} className="text-white/30 flex-shrink-0" />
            Add an OpenWeatherMap API key in Settings → API Keys to see real weather here.
          </div>
        </Glass>
      )}
      {/* FIX 10 — a key being SET is not the same as the fetch having
          SUCCEEDED (invalid key, bad/ungeocodable location, rate limit, etc.
          all fail). Show the actual failure instead of quietly falling back
          to fake seed numbers, and show an explicit loading state instead of
          rendering wCurrent fields against a null value. */}
      {(w.weather ?? true) && settings.owmKey && weatherFetchError && !wCurrent && (
        <Glass className="p-4 !bg-brand-950/15 !border-brand-700/30">
          <div className="flex items-center gap-2 text-sm text-brand-300">
            <Cloud size={13} className="text-brand-400 flex-shrink-0" />
            Weather fetch failed — {weatherFetchError}. Check your OpenWeatherMap key in Settings → API Keys and your location in Settings → Company.
          </div>
        </Glass>
      )}
      {(w.weather ?? true) && settings.owmKey && !wCurrent && !weatherFetchError && (
        <Glass className="p-4 !bg-white/5">
          <div className="flex items-center gap-2 text-sm text-white/50">
            <Cloud size={13} className="text-white/30 flex-shrink-0 animate-pulse" />
            Loading live weather…
          </div>
        </Glass>
      )}
      {(w.weather ?? true) && settings.owmKey && wCurrent && (() => {
        const todayJobs_ = jobs.filter(j => j.scheduledDate === localDateStr() && j.status === "scheduled");
        const rainRisk = wCurrent.rainChance > 50;
        const freezeRisk = wCurrent.temp < 35;
        const windRisk = wCurrent.wind > 20;
        if (todayJobs_.length === 0 && !rainRisk && !freezeRisk) return null;
        return <Glass className={"p-4 " + (rainRisk || freezeRisk ? "!bg-blue-950/20 !border-blue-700/30" : "!bg-black/40")}>
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-sm flex items-center gap-2"><Cloud size={13} className="text-blue-400" />Today's Weather Impact</div>
            <div className="flex items-center gap-3">
              <div className="text-xl font-bold">{wCurrent.temp}°F</div>
              <span className="text-[10px] text-green-400">● Live</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs mb-2">
            <span className="text-white/60 capitalize">{wCurrent.description || wCurrent.condition?.replace("_"," ")}</span>
            <span className={"font-semibold " + (wCurrent.rainChance > 50 ? "text-blue-400" : "text-white/40")}>💧 {wCurrent.rainChance}% rain</span>
            {windRisk && <span className="text-yellow-400">💨 {wCurrent.wind}mph winds</span>}
            <span className="text-white/40">💦 {wCurrent.humidity}% humidity</span>
          </div>
          {/* FIX A — settings.owmKey being valid doesn't mean weatherLocation
              is set; fetchRealWeather silently falls back to your area when
              it's blank. Flag that here so the owner knows this reading
              isn't for their actual jobs' location. */}
          {!((settings as any).weatherLocation || "").trim() && (
            <div className="text-[10px] text-yellow-400/80 mb-2">⚠ Using default location (your area) — add your business location in Settings → Company.</div>
          )}
          {todayJobs_.length > 0 ? <div className="pt-2 border-t border-white/5">
            <div className="text-[10px] text-white/50 mb-1">{todayJobs_.length} job{todayJobs_.length !== 1 ? "s" : ""} scheduled today</div>
            {(rainRisk || freezeRisk || windRisk)
              ? <div className={"text-xs font-semibold " + (freezeRisk ? "text-brand-400" : "text-yellow-400")}>{freezeRisk ? "🌡️ Too cold to wash — consider rescheduling" : rainRisk ? "🌧️ Rain likely — notify customers?" : "💨 High winds — roof jobs may need rescheduling"}</div>
              : <div className="text-xs text-green-400">✅ Good conditions for all {todayJobs_.length} scheduled job{todayJobs_.length !== 1 ? "s" : ""}</div>}
          </div> : <div className="text-xs text-white/40">No jobs scheduled today</div>}
        </Glass>;
      })()}

      {/* BUG FIX — "remove the Upcoming and Recent Activity widgets, as well
          as the Pending Quotes widget." All three removed below. That left
          this 2-column grid with only the Goals card in it (Upcoming was
          the left column's other item; Pending Quotes + Recent Activity
          WERE the entire right column) — collapsed to a single wrapper
          around Goals alone instead of leaving an empty second grid column. */}
      <div className="flex flex-col gap-4">
        {/* Goals */}
        {w.goals && <Glass className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-sm flex items-center gap-2"><Target size={13} className="text-brand-400" />Goals</div>
              <button onClick={() => onNav("reports")} className="text-[10px] text-brand-400 hover:text-brand-300">Analytics →</button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Month Revenue</span><span className={revPct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{fmt(revMonth)} / {fmt(goals.revenue)} ({revPct}%)</span></div>
                <PBar value={revMonth} max={goals.revenue || 1} />
              </div>
              {settings.quarterlyRevenueGoal > 0 && (() => {
                const qStart = new Date(); qStart.setMonth(Math.floor(qStart.getMonth() / 3) * 3, 1);
                const qRev = jobs.filter(j => j.status === "completed" && j.scheduledDate >= qStart.toISOString().slice(0,10)).reduce((s,j)=>s+j.amount,0);
                const qPct = Math.round(qRev / settings.quarterlyRevenueGoal * 100);
                return <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Quarter Revenue</span><span className={qPct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{fmt(qRev)} / {fmt(settings.quarterlyRevenueGoal)} ({qPct}%)</span></div>
                  <PBar value={qRev} max={settings.quarterlyRevenueGoal} />
                </div>;
              })()}
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Jobs Done</span><span className={jobsPct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{stats.doneMonth} / {goals.jobCount}</span></div>
                <PBar value={stats.doneMonth} max={goals.jobCount || 1} />
              </div>
              {settings.annualRevenueGoal > 0 && (() => {
                const yrStart = new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
                const yrRev = jobs.filter(j => j.status === "completed" && j.scheduledDate >= yrStart).reduce((s, j) => s + j.amount, 0);
                const pct = Math.round(yrRev / settings.annualRevenueGoal * 100);
                return <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Annual Revenue</span><span className={pct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{fmt(yrRev)} / {fmt(settings.annualRevenueGoal)} ({pct}%)</span></div>
                  <PBar value={yrRev} max={settings.annualRevenueGoal} />
                </div>;
              })()}
              {settings.customerAcquisitionGoal > 0 && (() => {
                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
                const newCust = customers.filter((c: any) => c.createdAt >= monthStart).length;
                const pct = Math.round(newCust / settings.customerAcquisitionGoal * 100);
                return <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-white/70">New Customers</span><span className={pct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{newCust} / {settings.customerAcquisitionGoal}</span></div>
                  <PBar value={newCust} max={settings.customerAcquisitionGoal} />
                </div>;
              })()}
              {settings.avgJobValueGoal > 0 && (() => {
                const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
                const monthJobs = jobs.filter(j => j.status === "completed" && j.scheduledDate >= monthStart);
                const avgVal = monthJobs.length > 0 ? monthJobs.reduce((s, j) => s + j.amount, 0) / monthJobs.length : 0;
                const pct = Math.round(avgVal / settings.avgJobValueGoal * 100);
                return <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Avg Job Value</span><span className={pct >= 75 ? "text-green-400 font-bold" : "text-white/60"}>{fmt(avgVal)} / {fmt(settings.avgJobValueGoal)}</span></div>
                  <PBar value={avgVal} max={settings.avgJobValueGoal} />
                </div>;
              })()}
              {settings.reviewRatingGoal > 0 && reviews.length > 0 && (() => {
                const avgRating = reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length;
                const pct = Math.round(avgRating / settings.reviewRatingGoal * 100);
                return <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Review Rating</span><span className={pct >= 95 ? "text-green-400 font-bold" : "text-white/60"}>⭐ {avgRating.toFixed(1)} / {settings.reviewRatingGoal}</span></div>
                  <PBar value={avgRating} max={settings.reviewRatingGoal} />
                </div>;
              })()}
              <div className="pt-2 border-t border-brand-900/20 space-y-2">
                <div className="flex justify-between text-xs"><span className="text-white/50">Run-rate forecast</span><span className={forecast >= (goals.revenue || 10000) ? "text-green-400 font-bold" : "text-yellow-400 font-semibold"}>{fmt(forecast)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/40">Day {dayOfMonth}/{daysInMonth}</span><span className="text-white/40">{fmt(Math.round(revMonth / dayOfMonth))}/day avg</span></div>
                {forecast < (goals.revenue || 0) && <div className="text-[10px] text-brand-400">⚠️ {fmt((goals.revenue||0) - forecast)} short of goal at current pace</div>}
                {forecast >= (goals.revenue || 0) && goals.revenue > 0 && <div className="text-[10px] text-green-400">✅ On track to hit monthly goal</div>}
              </div>
            </div>
          </Glass>}
      </div>

      {/* BUG FIX — "get rid of active automation on the dashboard and get
          rid of the duplicate weather widgets." This whole section used to
          render a SECOND full weather card (identical data as the
          standalone Weather Widget above) plus an Active Automations list
          nobody asked to keep here (it already has its own page). Now just
          the revenue chart, full width. */}
      {w.charts && <Glass className="p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div>
            <div className="font-semibold text-sm flex items-center gap-2"><BarChart2 size={13} className="text-brand-400" />Revenue (6 months)</div>
            {hasAnyRevData && <div className="text-[10px] text-white/40 mt-0.5">{fmt(revenueByMonth.reduce((s, m) => s + (m.revenue || 0), 0))} total · 6-month trend</div>}
          </div>
          <button onClick={() => onNav("analytics")} className="text-[10px] text-brand-400 hover:text-brand-300 flex items-center gap-1">Full analytics <ChevronRight size={10} /></button>
        </div>
        {hasAnyRevData ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueByMonth} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="rdg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={themeColor("--chart-1")} stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#9f1239" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="month" stroke="#ffffff20" fontSize={11} tick={{ fill: "#ffffff70" }} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff10" fontSize={10} tick={{ fill: "#ffffff50" }} tickLine={false} axisLine={false} tickFormatter={v => "$" + (v >= 1000 ? Math.round(v / 1000) + "k" : v)} width={40} />
              <Tooltip contentStyle={{ background: "rgba(0,0,0,0.95)", border: "1px solid rgba(159,18,57,0.5)", borderRadius: "10px", fontSize: "11px", padding: "8px 12px" }} formatter={v => [fmt(Number(v)), "Revenue"]} labelStyle={{ color: "#ffffff90", marginBottom: "4px" }} cursor={{ stroke: themeColor("--brand-600", 0.3), strokeWidth: 1 }} />
              <Area type="monotone" dataKey="revenue" stroke={themeColor("--chart-1")} strokeWidth={2.5} fill="url(#rdg)" dot={{ fill: themeColor("--chart-1"), strokeWidth: 0, r: 3 }} activeDot={{ r: 5, fill: themeColor("--chart-1"), strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-center">
            <BarChart2 size={28} className="text-white/10 mb-2" />
            <div className="text-xs text-white/30">No completed jobs yet</div>
            <button onClick={() => onNav("jobs")} className="mt-2 text-[11px] text-brand-400 hover:text-brand-300">Add your first job →</button>
          </div>
        )}
      </Glass>}

      <InvoicePreviewModal
        open={!!previewInvoiceJob}
        onClose={() => setPreviewInvoiceJob(null)}
        sending={!!previewInvoiceJob && sendingDashInvoiceId === previewInvoiceJob.id}
        onConfirm={(subject, bodyHtml) => sendDashInvoice(previewInvoiceJob, subject, bodyHtml)}
        data={previewInvoiceJob ? (() => {
          const cust = customers.find((c: any) => c.id === previewInvoiceJob.customerId);
          return { customerName: cust?.firstName || "Customer", address: previewInvoiceJob.address || "", amount: Number(previewInvoiceJob.amount) || 0, companyName: settings?.companyName || "CRM Starter", payLink: "" };
        })() : null}
      />
    </div>
  );
}

// ===== CUSTOMERS =====
