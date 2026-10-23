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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, mediaSrc } from "../../lib/utils";
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
import { useConfirm } from "./ConfirmModal";
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
import { DocumentVault } from "./DocumentVault";
import { crewIncludesEmployee } from "../pages/EmployeePortal";
import { supabase } from "../../lib/supabase";
import { listCustomerPaymentMethods, detachPaymentMethod, StripeSavedCard, createRecurringCheckoutSession, cancelRecurringSubscription } from "../../lib/stripe";
import { cancelSquareRecurringPlan } from "../../lib/square";
import { SquareRecurringSetupModal } from "./SquareRecurringSetupModal";
import { SaveCardModal } from "./SaveCardModal";
import { useIsMobile } from "../../hooks/useIsMobile";

// Same default checklist template used by Dashboard.tsx/JobDetailModal.tsx/
// EmployeePortal.tsx/CrewView.tsx — see renderJobRow's BUG FIX comment below.
const CD_PRE_DEFAULTS = [
  { id: "pre1", label: "Take photos of existing damage", done: false },
  { id: "pre2", label: "Confirm water access", done: false },
  { id: "pre3", label: "Check weather conditions", done: false },
  { id: "pre4", label: "Note any pre-existing issues", done: false },
];
const CD_DURING_DEFAULTS = [
  { id: "dur1", label: "Apply cleaning solution", done: false },
  { id: "dur2", label: "Scrub affected areas", done: false },
  { id: "dur3", label: "Rinse thoroughly", done: false },
];
const CD_POST_DEFAULTS = [
  { id: "post1", label: "Customer walkthrough", done: false },
  { id: "post2", label: "Collect payment", done: false },
  { id: "post3", label: "Get customer signature", done: false },
  { id: "post4", label: "Take after photos", done: false },
];

export function CustomerDetail({ customer: c, onClose, onDelete, onEdit, estimates = [], jobs = [], employees = [], timeline = {}, setTimeline = (..._args: any[]) => {}, settings = {} as any, toast = (..._args: any[]) => {}, setCustomers = (..._args: any[]) => {}, onOpenEstimate = (_id: string, _label?: string) => {} }) {
  const [tab, setTab] = useState("info");
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("note");
  // FIX 11 — past-jobs rows were plain, unclickable divs (address/date/amount/
  // status only) — clicking one did nothing, so photos, checklist, notes, and
  // which employee worked it were only ever visible from the Jobs page
  // itself. Click-to-expand shows all of that inline instead.
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  // FEATURE — "the popup should be in the CRM with the CRM's UI" — replaces
  // window.confirm() for delete actions with a real branded modal.
  const { confirmAsync, ConfirmDialog } = useConfirm();

  // FEATURE — owner-side view of a customer's saved cards (Payment Methods).
  // Customers can already save their OWN card via SaveCardModal from the
  // client portal / field portal; there was previously no owner-facing way
  // to see, add, or remove what's on file for a given customer.
  const [paymentMethods, setPaymentMethods] = useState<StripeSavedCard[]>([]);
  const [pmLoading, setPmLoading] = useState(false);
  const [pmDeletingId, setPmDeletingId] = useState<string | null>(null);
  const [addCardOpen, setAddCardOpen] = useState(false);

  const loadPaymentMethods = async () => {
    if (!c?.stripeCustomerId) { setPaymentMethods([]); return; }
    setPmLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const cards = await listCustomerPaymentMethods(token, c.stripeCustomerId);
      setPaymentMethods(cards);
    } catch (e: any) {
      console.error("[PaymentMethods] list failed:", e?.message);
      toast?.("Failed to load saved cards: " + (e?.message || "unknown error"), "red");
    } finally {
      setPmLoading(false);
    }
  };

  const removePaymentMethod = async (pm: StripeSavedCard) => {
    if (!(await confirmAsync({ message: `Remove ${pm.brand || "card"} •••• ${pm.last4 || "----"} from file?`, confirmLabel: "Remove Card" }))) return;
    setPmDeletingId(pm.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      await detachPaymentMethod(token, pm.id);
      toast?.("Card removed", "green");
      // If the removed card was the one saved for quick-charge on the
      // customer record (savedPaymentMethodId), clear that reference too so
      // job-payment "charge saved card" flows don't try to hit a
      // now-detached payment method.
      if (c.savedPaymentMethodId === pm.id) {
        setCustomers((prev: any[]) => prev.map((cust: any) => cust.id === c.id ? { ...cust, savedPaymentMethodId: undefined, savedPaymentMethodLabel: undefined } : cust));
        // BUG FIX — direct .catch() on a raw Supabase builder throws
        // ("...catch is not a function" — PostgrestBuilder only implements
        // .then(), not a full Promise). See lib/googleApi.ts's comment on
        // the same class of bug for the full explanation.
        (supabase as any).from("customers").update({ savedPaymentMethodId: null, savedPaymentMethodLabel: null }).eq("id", c.id).select("id")
          .then((result: any) => {
            if (result?.error || !Array.isArray(result?.data) || result.data.length === 0) {
              console.warn("[PaymentMethods] clear savedPaymentMethodId sync failed:", result?.error?.message || "0 rows matched");
            }
          }, (e: any) => console.warn("[PaymentMethods] clear savedPaymentMethodId sync failed:", e?.message));
      }
      await loadPaymentMethods();
    } catch (e: any) {
      console.error("[PaymentMethods] detach failed:", e?.message);
      toast?.("Failed to remove card: " + (e?.message || "unknown error"), "red");
    } finally {
      setPmDeletingId(null);
    }
  };

  // FEATURE — "employees/owners should be able to set a default [card]."
  // Multiple cards could already be saved (via SaveCardModal) and listed
  // (via listCustomerPaymentMethods), but nothing let the owner say WHICH
  // one is the default — savedPaymentMethodId/Label (what the job-payment
  // "charge card on file" buttons actually use) only ever got set to
  // whichever card happened to be added first.
  const [pmSettingDefaultId, setPmSettingDefaultId] = useState<string | null>(null);
  const makeDefaultPaymentMethod = async (pm: StripeSavedCard) => {
    setPmSettingDefaultId(pm.id);
    const label = `${pm.brand || "Card"} ····${pm.last4 || "----"}`;
    try {
      setCustomers((prev: any[]) => prev.map((cust: any) => cust.id === c.id ? { ...cust, savedPaymentMethodId: pm.id, savedPaymentMethodLabel: label } : cust));
      const res = await (supabase as any).from("customers").update({ savedPaymentMethodId: pm.id, savedPaymentMethodLabel: label }).eq("id", c.id).select("id");
      if (res?.error) throw new Error(res.error.message);
      if (!Array.isArray(res?.data) || res.data.length === 0) throw new Error("Save didn't match this customer's record — try refreshing the page.");
      toast?.(`${label} set as default ✓`, "green");
    } catch (e: any) {
      toast?.("Failed to set default: " + (e?.message || "unknown error"), "red");
    } finally {
      setPmSettingDefaultId(null);
    }
  };

  // FEATURE — real recurring billing (Stripe subscriptions). Owner sets a
  // fixed amount + cadence for this customer; the resulting hosted Checkout
  // link is handed to the owner to text/email — the customer enters a card
  // once there and is billed automatically going forward. Renewal/failure/
  // cancellation status is written server-side by stripe-webhook.ts into
  // customers.recurringPlan (never guessed client-side) — see lib/stripe.ts.
  const [recurOpen, setRecurOpen] = useState(false);
  const [recurAmount, setRecurAmount] = useState("");
  const [recurInterval, setRecurInterval] = useState<"week" | "month" | "year">("month");
  const [recurDesc, setRecurDesc] = useState("");
  const [recurCreating, setRecurCreating] = useState(false);
  const [recurLink, setRecurLink] = useState("");
  const [recurCanceling, setRecurCanceling] = useState(false);
  const [squareRecurOpen, setSquareRecurOpen] = useState(false);
  const plan = c?.recurringPlan;
  const squareConfigured = !!(settings?.squareApplicationId && settings?.squareLocationId);
  const squareCadence = recurInterval === "year" ? "ANNUAL" : recurInterval === "week" ? "WEEKLY" : "MONTHLY";

  const startRecurringPlan = async () => {
    const amountCents = Math.round(parseFloat(recurAmount) * 100);
    if (!amountCents || amountCents <= 0) { toast?.("Enter a valid amount", "red"); return; }
    setRecurCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const desc = recurDesc.trim() || "Recurring service";
      const session2 = await createRecurringCheckoutSession({
        crmCustomerId: c.id,
        amountCents,
        interval: recurInterval,
        description: desc,
        customerEmail: c.email || undefined,
        successUrl: window.location.origin + "/#/",
        cancelUrl: window.location.origin + "/#/",
        accessToken: token,
      });
      setRecurLink(session2.url);
      setCustomers((prev: any[]) => prev.map((cust: any) => cust.id === c.id ? { ...cust, recurringPlan: { status: "pending", amountCents, interval: recurInterval, description: desc, checkoutUrl: session2.url } } : cust));
      const saveRes = await (supabase as any).from("customers").update({ recurringPlan: { status: "pending", amountCents, interval: recurInterval, description: desc, checkoutUrl: session2.url } }).eq("id", c.id).select("id");
      if (saveRes?.error || !Array.isArray(saveRes?.data) || saveRes.data.length === 0) {
        console.warn("[RecurringPlan] save failed:", saveRes?.error?.message || "0 rows matched");
        toast?.("Link created, but couldn't save it to the customer record — the link below still works, but won't show here after you leave this page.", "yellow");
      } else {
        toast?.("Recurring plan link created — send it to the customer to activate", "green");
      }
    } catch (e: any) {
      toast?.("Failed to create recurring plan: " + (e?.message || "unknown error"), "red");
    } finally {
      setRecurCreating(false);
    }
  };

  const cancelRecurringPlan = async () => {
    if (!plan?.stripeSubscriptionId && !plan?.squareSubscriptionId) {
      // Never activated (customer hasn't completed checkout yet) — just clear it locally.
      setCustomers((prev: any[]) => prev.map((cust: any) => cust.id === c.id ? { ...cust, recurringPlan: null } : cust));
      const clearRes = await (supabase as any).from("customers").update({ recurringPlan: null }).eq("id", c.id).select("id");
      if (clearRes?.error || !Array.isArray(clearRes?.data) || clearRes.data.length === 0) {
        console.warn("[RecurringPlan] clear failed:", clearRes?.error?.message || "0 rows matched");
        toast?.("Cleared here, but didn't save — it may reappear after a refresh.", "yellow");
      }
      setRecurLink(""); setRecurOpen(false);
      return;
    }
    if (!(await confirmAsync({ message: "Cancel this customer's recurring plan? They will not be billed again.", confirmLabel: "Cancel Plan" }))) return;
    setRecurCanceling(true);
    try {
      if (plan.provider === "square" && plan.squareSubscriptionId) {
        await cancelSquareRecurringPlan(plan.squareSubscriptionId);
      } else if (plan.stripeSubscriptionId) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        await cancelRecurringSubscription(plan.stripeSubscriptionId, undefined, token);
      }
      setCustomers((prev: any[]) => prev.map((cust: any) => cust.id === c.id ? { ...cust, recurringPlan: { ...plan, status: "canceled" } } : cust));
      toast?.("Recurring plan canceled", "green");
    } catch (e: any) {
      toast?.("Failed to cancel: " + (e?.message || "unknown error"), "red");
    } finally {
      setRecurCanceling(false);
    }
  };

  useEffect(() => { if (c) { setTab("info"); setNote(""); loadPaymentMethods(); setRecurOpen(false); setRecurLink(""); } }, [c?.id]);

  if (!c) return null;
  const ce = estimates.filter(e => e.customerId === c.id);
  const cj = jobs.filter(j => j.customerId === c.id);
  const ct = (timeline[c.id] || []).slice().sort((a, b) => b.date.localeCompare(a.date));

  const addEntry = () => {
    if (!note.trim()) return;
    const e = { id: uid(), type: noteType, date: today(), note: note.trim(), author: "You" };
    setTimeline({ ...timeline, [c.id]: [...(timeline[c.id] || []), e] });
    setNote("");
  };

  const tIcon = t => ({
    call: { I: Phone, c: "text-green-400 bg-green-900/30" },
    text: { I: MessageSquare, c: "text-blue-400 bg-blue-900/30" },
    email: { I: Mail, c: "text-purple-400 bg-purple-900/30" },
    estimate: { I: FileText, c: "text-yellow-400 bg-yellow-900/30" },
    job: { I: CheckCircle, c: "text-brand-400 bg-brand-900/30" },
    note: { I: Clipboard, c: "text-white/60 bg-white/10" }
  }[t] || { I: Clipboard, c: "text-white/60 bg-white/10" });

  // ITEM 8/9 — this used to only live in the "Info" tab's Job History list;
  // the separate "Jobs" tab (below) had its own, older render that was just
  // a plain unclickable div — address/date/status/amount only, exactly the
  // "only shows address, date, status, amount" gap reported. Both tabs now
  // share this single expand-to-see-everything row so neither can drift out
  // of sync with the other again.
  const renderJobRow = (j: any) => {
    const isOpen = expandedJobId === j.id;
    // BLOCKER — jobs seeded from an approved estimate set BOTH `checklist`
    // and `preChecklist` to the SAME combined array (App.tsx), so
    // unconditionally concatenating legacy `checklist` alongside the
    // pre/during/post phases duplicated every one of those items in this
    // list — a job with 7 real items showed some of them twice. `checklist`
    // is only meaningful on its own for jobs that predate the phase split
    // (no pre/during/post data at all).
    // BUG FIX — "checklist items weren't showing." This was the only
    // checklist-rendering spot in the app with no default-template
    // fallback — Dashboard.tsx, JobDetailModal.tsx, EmployeePortal.tsx, and
    // CrewView.tsx all fall back to a default pre/during/post template when
    // a job's own arrays are still empty (real per-item state only gets
    // written once a field employee actually taps a checkbox — see
    // docs/ARCHITECTURE.md's Checklist sync note). Here, a job nobody had touched yet
    // showed NO checklist section at all, while the exact same job showed a
    // real (default) checklist everywhere else in the app.
    const hasPhaseChecklist = (j.preChecklist||[]).length || (j.duringChecklist||[]).length || (j.postChecklist||[]).length;
    const allChecklist = hasPhaseChecklist
      ? [...(j.preChecklist||[]), ...(j.duringChecklist||[]), ...(j.postChecklist||[])]
      : (j.checklist||[]).length > 0
        ? j.checklist
        : [...CD_PRE_DEFAULTS, ...CD_DURING_DEFAULTS, ...CD_POST_DEFAULTS];
    const ckDone = allChecklist.filter((it: any) => it.done).length;
    const crewNames = employees
      .filter((e: any) => crewIncludesEmployee(j.crew, e.id, e.user_id))
      .map((e: any) => `${e.firstName} ${e.lastName}`);
    return (
      <div key={j.id} className="bg-black/40 border border-brand-900/10 rounded-xl text-xs overflow-hidden">
        <button onClick={() => setExpandedJobId(isOpen ? null : j.id)} className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-white/5 transition">
          <div className="flex-1 min-w-0"><div className="font-medium truncate">{j.address?.split(",")[0]}</div><div className="text-white/40">{j.scheduledDate} · {fmt(j.amount)}</div></div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {j.photos?.filter((p: any) => p.url || p.dataUrl).length > 0 && <span className="text-[10px] text-white/40">{j.photos.filter((p: any) => p.url || p.dataUrl).length}📸</span>}
            {(j as any).videos?.filter((v: any) => v.url || v.dataUrl).length > 0 && <span className="text-[10px] text-white/40">{(j as any).videos.filter((v: any) => v.url || v.dataUrl).length}🎥</span>}
            <Badge tone={j.status==="completed"?"green":j.status==="scheduled"?"blue":"gray"}>{j.status}</Badge>
            <ChevronRight size={12} className={"text-white/30 transition-transform " + (isOpen ? "rotate-90" : "")} />
          </div>
        </button>
        {isOpen && (
          <div className="px-3 pb-3 pt-1 space-y-2 border-t border-white/5">
            <div className="text-[11px] text-white/50">
              <span className="text-white/70 font-medium">Crew: </span>{crewNames.length > 0 ? crewNames.join(", ") : "Not assigned"}
            </div>
            {allChecklist.length > 0 && (
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Checklist ({ckDone}/{allChecklist.length})</div>
                <div className="space-y-1">
                  {allChecklist.map((ck: any, i: number) => (
                    <div key={i} className={"flex items-center gap-1.5 text-[11px] " + (ck.done ? "text-white/40 line-through" : "text-white/70")}>
                      {ck.done ? <CheckSquare size={11} className="text-green-500 flex-shrink-0" /> : <span className="w-[11px] h-[11px] rounded border border-white/30 flex-shrink-0" />}
                      {ck.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(j.notes || j.internalNotes) && (
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Notes</div>
                <div className="text-[11px] text-white/70">{j.notes || j.internalNotes}</div>
              </div>
            )}
            {j.signOff && (
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Signature</div>
                <div className="text-[11px] text-white/70">
                  Signed by {j.signOff.signerName || "customer"}{j.signOff.timestamp ? ` on ${new Date(j.signOff.timestamp).toLocaleDateString()}` : ""}
                </div>
                {(j.signOff.sigUrl || j.signOff.sigData) && (
                  <img src={mediaSrc(j.signOff.sigUrl, j.signOff.sigData)} alt="signature" className="mt-1 max-w-[200px] bg-white rounded-lg p-1.5" />
                )}
              </div>
            )}
            {(j.photos||[]).some((p: any) => p.url || p.dataUrl) && (
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Photos</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {(j.photos||[]).filter((p: any) => p.url || p.dataUrl).map((p: any, i: number) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-black/40 cursor-pointer" onClick={() => window.open(mediaSrc(p.url, p.dataUrl), "_blank")}>
                      <img src={mediaSrc(p.url, p.dataUrl)} alt={p.type} className="absolute inset-0 w-full h-full object-cover" />
                      <div className={"absolute top-0.5 left-0.5 text-[7px] px-1 py-0.5 rounded-full font-bold " + (p.type === "before" ? "bg-blue-600 text-white" : "bg-green-600 text-white")}>{p.type}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* BUG FIX — job.videos was never rendered here at all (photos,
                checklist, and signature were, but not videos), so a video
                captured on a job was invisible in the customer's past-job
                detail even though it was captured/uploaded fine. */}
            {((j as any).videos||[]).some((v: any) => v.url || v.dataUrl) && (
              <div>
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Videos</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {((j as any).videos||[]).filter((v: any) => v.url || v.dataUrl).map((v: any, i: number) => (
                    <video key={i} src={mediaSrc(v.url, v.dataUrl)} controls className="w-full rounded-lg bg-black/60" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Modal open={!!c} onClose={onClose} title="Customer Details" maxW="max-w-2xl">
      {ConfirmDialog}
      <div className="space-y-4">
        <Glass className="p-5 !bg-gradient-to-br !from-brand-950/30 !to-black/60">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-brand-600 flex items-center justify-center text-lg font-bold text-brand-fg">{c.firstName[0]}{c.lastName[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xl font-bold">{c.firstName} {c.lastName}</div>
              <div className="text-xs text-white/60 mt-0.5">Since {c.createdAt}</div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-white/70"><Mail size={12} />{c.email || "—"}</div>
                <div className="flex items-center gap-2 text-white/70">
                  <Phone size={12} />{c.phone || "—"}
                  {c.phone && (
                    <span className={"text-[10px] px-1.5 py-0.5 rounded-full border " + (c.smsOptOut ? "border-brand-800/50 bg-brand-950/30 text-brand-400" : "border-green-800/50 bg-green-950/30 text-green-400")}>
                      {c.smsOptOut ? "SMS opted out" : "SMS opted in"}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-white/70"><MapPin size={12} />{c.address || "—"}</div>
                {/* FEATURE — "make sure that when I click on a customer
                    individually, it shows whether their payment
                    information is connected." The full Payment Methods
                    section further down already showed this, but it sat
                    lower on the Info tab where it was easy to miss — this
                    puts the same status right in the always-visible
                    header, matching the SMS opt-in/out badge's style. */}
                <div className="flex items-center gap-2 text-white/70">
                  <CreditCard size={12} />
                  {pmLoading ? (
                    <span className="text-[10px] text-white/40">Checking card on file…</span>
                  ) : (
                    <span className={"text-[10px] px-1.5 py-0.5 rounded-full border " + (paymentMethods.length > 0 ? "border-green-800/50 bg-green-950/30 text-green-400" : "border-white/10 bg-white/5 text-white/40")}>
                      {paymentMethods.length > 0 ? `Card on file · ${paymentMethods[0].brand || "Card"} •••• ${paymentMethods[0].last4 || "----"}` : "No card on file"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/50 uppercase tracking-wider">Lifetime</div>
              <div className="text-2xl font-bold text-brand-400">{fmt(c.totalSpent)}</div>
              <div className="flex items-center gap-1.5 justify-end mt-2">
                {onEdit && (
                  <button
                    onClick={() => onEdit(c)}
                    title="Edit customer"
                    className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition"
                  >
                    <Edit size={13} />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={async () => {
                      if (await confirmAsync({ message: `Delete ${c.firstName} ${c.lastName}? This cannot be undone.`, confirmLabel: "Delete Customer" })) {
                        onDelete(c);
                      }
                    }}
                    title="Delete customer"
                    className="p-1.5 rounded-lg border border-brand-900/40 bg-brand-950/20 text-brand-400/70 hover:text-brand-300 hover:bg-brand-950/40 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {(c.gateCode || c.hasDog || c.sensitivePlants) && (
            <div className="mt-4 pt-3 border-t border-brand-900/30">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Property Notes</div>
              <div className="space-y-1.5 text-xs">
                {c.gateCode && <div className="flex items-center gap-2"><span className="text-white/50">🔒 Gate code:</span><span className="font-mono text-white">{c.gateCode}</span></div>}
                {c.hasDog && <div className="flex items-center gap-2"><span className="text-white/50">🐕 Dog:</span><span>{c.dogName || "unnamed"}</span></div>}
                {c.sensitivePlants && <div className="flex items-center gap-2"><span className="text-white/50">🌿 Plants:</span><span>{c.sensitivePlants}</span></div>}
              </div>
            </div>
          )}

          {c.notes && <div className="mt-3 pt-3 border-t border-brand-900/30"><div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Notes</div><div className="text-sm text-white/70">{c.notes}</div></div>}
          {(c.customFields || []).length > 0 && <div className="mt-3 pt-3 border-t border-brand-900/30">
            <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Custom Fields</div>
            <div className="space-y-1">
              {c.customFields.map((cf, i) => cf.key && <div key={i} className="flex justify-between text-xs"><span className="text-white/50">{cf.key}</span><span className="font-medium">{cf.value}</span></div>)}
            </div>
          </div>}
        </Glass>

        <div className="flex gap-2 border-b border-brand-900/30 overflow-x-auto">
          {[["info", "Info"], ["estimates", "Estimates (" + ce.length + ")"], ["jobs", "Jobs (" + cj.length + ")"], ["timeline", "Timeline (" + ct.length + ")"], ["portal", "🌐 Portal"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={"px-4 py-2.5 text-sm font-medium transition relative whitespace-nowrap " + (tab === k ? "text-white" : "text-white/50")}>
              {l}
              {tab === k && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600 text-brand-fg" />}
            </button>
          ))}
        </div>

        <div className="min-h-[160px]">
          {tab === "info" && <div className="space-y-3">
            {/* Tags + Lead Source */}
            {((c.tags && c.tags.length > 0) || c.leadSource) && (
              <div className="flex flex-wrap gap-2 items-center">
                {(c.tags || []).map(t => <Badge key={t} tone={t === "VIP" ? "yellow" : t === "Commercial" ? "blue" : "gray"}>{t}</Badge>)}
                {c.leadSource && <span className="text-[10px] px-2 py-1 rounded-full bg-purple-900/30 border border-purple-700/40 text-purple-300">📍 {c.leadSource}</span>}
              </div>
            )}
            {/* Property info */}
            <Glass className="p-4 !bg-black/40">
              <div className="text-[10px] text-white/50 uppercase tracking-wider mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1"><MapPin size={9} />Property Info</div>
                {c.address && <a href={"https://maps.google.com/?q=" + encodeURIComponent(c.address) + "&t=k"} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-1">🛰️ Satellite view</a>}
              </div>
              {/* Google Maps Static satellite image */}
              {c.address && settings?.googleMapsKey && (
                <div className="mb-3 rounded-xl overflow-hidden border border-white/10">
                  <img
                    src={"https://maps.googleapis.com/maps/api/staticmap?center=" + encodeURIComponent(c.address) + "&zoom=18&size=600x200&maptype=satellite&markers=color:red|" + encodeURIComponent(c.address) + "&key=" + settings.googleMapsKey}
                    alt="Property satellite view"
                    className="w-full object-cover"
                    style={{height: "140px"}}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {c.sqFootage ? <div><div className="text-[10px] text-white/40">Square Footage</div><div className="font-semibold">{Number(c.sqFootage).toLocaleString()} sq ft</div></div>
                  : c.address && <div><div className="text-[10px] text-white/40">Square Footage</div>
                    <a href={"https://www.phila.gov/property/#/" + encodeURIComponent(c.address || "")} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300">Lookup from satellite →</a>
                  </div>}
                {c.gateCode && <div><div className="text-[10px] text-white/40">Gate Code</div><div className="font-mono font-bold text-yellow-300">🔒 {c.gateCode}</div></div>}
                {c.hasDog && <div><div className="text-[10px] text-white/40">Dog on Property</div><div className="font-semibold">🐕 {c.dogName || "Yes"}</div></div>}
                {c.sensitivePlants && <div className="col-span-2"><div className="text-[10px] text-white/40">Sensitive Plants</div><div className="text-white/80">🌿 {c.sensitivePlants}</div></div>}
                {c.propertyNotes && <div className="col-span-2"><div className="text-[10px] text-white/40">Notes</div><div className="text-white/70">{c.propertyNotes}</div></div>}
                {!c.sqFootage && !c.gateCode && !c.hasDog && !c.sensitivePlants && <div className="col-span-2 text-white/40 text-xs">No property notes — edit customer to add</div>}
              </div>
            </Glass>
            {/* Payment Methods — owner-side view of the customer's saved
                cards (Stripe). See SECURITY AUDIT note in lib/stripe.ts:
                this owner-only view goes through list_payment_methods /
                detach_payment_method, gated by the owner's own Supabase
                session token, never a raw Stripe key in the browser. */}
            <Glass className="p-4 !bg-black/40">
              <div className={"flex items-center justify-between mb-3 gap-2 " + (isMobile ? "flex-col items-stretch" : "flex-row")}>
                <div className="text-[10px] text-white/50 uppercase tracking-wider flex items-center gap-1"><CreditCard size={9} />Payment Methods</div>
                <GBtn onClick={() => setAddCardOpen(true)} className={"!py-1.5 !px-3 !text-xs " + (isMobile ? "!w-full !justify-center" : "")}>
                  <Plus size={12} />Add Card
                </GBtn>
              </div>
              {!c.stripeCustomerId ? (
                <div className="text-xs text-white/40 py-2 text-center">No card on file</div>
              ) : pmLoading ? (
                <div className="text-xs text-white/40 py-2 text-center">Loading…</div>
              ) : paymentMethods.length === 0 ? (
                <div className="text-xs text-white/40 py-2 text-center">No card on file</div>
              ) : (
                <div className="space-y-2">
                  {paymentMethods.map(pm => {
                    const isDefault = c.savedPaymentMethodId === pm.id;
                    return (
                      <div key={pm.id} className={"flex items-center gap-3 p-3 rounded-xl border " + (isDefault ? "bg-green-950/20 border-green-700/40" : "bg-white/5 border-white/10") + " " + (isMobile ? "flex-col items-stretch text-center" : "flex-row justify-between")}>
                        <div className="flex items-center gap-2 text-sm">
                          <CreditCard size={14} className="text-white/50 flex-shrink-0" />
                          <span className="capitalize">{pm.brand || "Card"} •••• {pm.last4 || "----"}</span>
                          {pm.expMonth && pm.expYear && <span className="text-white/40 text-xs">exp {String(pm.expMonth).padStart(2, "0")}/{String(pm.expYear).slice(-2)}</span>}
                          {isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-900/40 border border-green-600/40 text-green-300 font-bold uppercase tracking-wide">Default</span>}
                        </div>
                        <div className={"flex items-center gap-1 " + (isMobile ? "justify-center" : "")}>
                          {!isDefault && (
                            <button
                              onClick={() => makeDefaultPaymentMethod(pm)}
                              disabled={pmSettingDefaultId === pm.id}
                              className="text-xs text-white/50 hover:text-white disabled:opacity-40 px-2 py-1.5 rounded-lg hover:bg-white/10 transition"
                            >
                              {pmSettingDefaultId === pm.id ? "Setting…" : "Make Default"}
                            </button>
                          )}
                          <button
                            onClick={() => removePaymentMethod(pm)}
                            disabled={pmDeletingId === pm.id}
                            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 disabled:opacity-40 px-2 py-1.5 rounded-lg hover:bg-brand-950/30 transition"
                          >
                            <Trash2 size={12} />{pmDeletingId === pm.id ? "Removing…" : "Remove"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Glass>
            {/* FEATURE — "set up automated charge payments for recurring
                jobs... dates fluctuate... bill automatically when we have
                that recurring job." Distinct from the fixed-cadence
                Recurring Billing (Stripe subscription) section below this
                one — this bills whenever a recurring JOB dispatched to this
                customer is actually marked completed, whatever date that
                turns out to be (see the "Continue" button in
                EmployeePortal.tsx's Complete Job flow, which checks this
                flag). Only ever offered once a card is already on file. */}
            {c.stripeCustomerId && paymentMethods.length > 0 && (
              <Glass className="p-4 !bg-black/40">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!c.autoChargeRecurringJobs}
                    onChange={async e => {
                      const checked = e.target.checked;
                      setCustomers((prev: any[]) => prev.map((cust: any) => cust.id === c.id ? { ...cust, autoChargeRecurringJobs: checked } : cust));
                      const res = await (supabase as any).from("customers").update({ autoChargeRecurringJobs: checked }).eq("id", c.id).select("id");
                      if (res?.error || !res?.data?.length) toast?.("Failed to save — " + (res?.error?.message || "try again"), "red");
                      else toast?.(checked ? "Auto-charge on job completion enabled ✓" : "Auto-charge on job completion disabled", "green");
                    }}
                    className="mt-0.5 accent-brand-600 flex-shrink-0"
                  />
                  <div>
                    <div className="text-sm font-medium">Auto-charge recurring jobs on completion</div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      Whenever a recurring job for {c.firstName} is marked complete — whatever day it actually lands on — their card on file is charged for that job's amount automatically, no manual "charge card" tap needed.
                    </div>
                  </div>
                </label>
              </Glass>
            )}
            {/* Recurring Billing — real Stripe subscriptions, see
                createRecurringCheckoutSession in lib/stripe.ts. Status is
                only ever trusted from customers.recurringPlan, written
                server-side by stripe-webhook.ts once Stripe itself confirms
                a charge/cancellation — never assumed client-side. */}
            <Glass className="p-4 !bg-black/40">
              <div className={"flex items-center justify-between mb-3 gap-2 " + (isMobile ? "flex-col items-stretch" : "flex-row")}>
                <div className="text-[10px] text-white/50 uppercase tracking-wider flex items-center gap-1"><Repeat size={9} />Recurring Billing</div>
                {!plan || plan.status === "canceled" ? (
                  <GBtn onClick={() => setRecurOpen(o => !o)} className={"!py-1.5 !px-3 !text-xs " + (isMobile ? "!w-full !justify-center" : "")}>
                    <Plus size={12} />{recurOpen ? "Close" : "Set Up Plan"}
                  </GBtn>
                ) : null}
              </div>

              {plan && plan.status !== "canceled" ? (
                <div className="space-y-2">
                  <div className={"flex items-center gap-3 p-3 rounded-xl border " + (plan.status === "active" ? "bg-green-950/20 border-green-700/40" : plan.status === "payment_failed" ? "bg-danger-950/20 border-danger-700/40" : "bg-yellow-950/20 border-yellow-700/40") + " " + (isMobile ? "flex-col items-stretch text-center" : "flex-row justify-between")}>
                    <div className="text-sm">
                      <div className="font-semibold">{fmt((plan.amountCents || 0) / 100)} / {plan.interval}</div>
                      <div className="text-white/50 text-xs">{plan.description}</div>
                    </div>
                    <Badge tone={plan.status === "active" ? "green" : plan.status === "payment_failed" ? "red" : "yellow"}>
                      {plan.status === "active" ? "Active" : plan.status === "payment_failed" ? "Payment Failed" : "Awaiting card"}
                    </Badge>
                  </div>
                  {plan.status === "pending" && plan.checkoutUrl && (
                    <div className="text-xs text-white/50">Not active yet — send the customer this link to enter their card:
                      <div className={"flex gap-2 mt-2 " + (isMobile ? "flex-col" : "flex-row")}>
                        <button onClick={() => { navigator.clipboard?.writeText(plan.checkoutUrl); toast?.("Link copied", "green"); }} className="flex-1 px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition text-white/80">Copy Link</button>
                        {c.phone && <button onClick={() => window.open(`sms:${c.phone}?body=${encodeURIComponent("Set up automatic billing here: " + plan.checkoutUrl)}`)} className="flex-1 px-2 py-1.5 rounded-lg bg-blue-950/30 hover:bg-blue-950/50 transition text-blue-300">Text Link</button>}
                        {c.email && <button onClick={() => window.open(`mailto:${c.email}?subject=${encodeURIComponent("Set up automatic billing")}&body=${encodeURIComponent("Set up automatic billing here: " + plan.checkoutUrl)}`)} className="flex-1 px-2 py-1.5 rounded-lg bg-purple-950/30 hover:bg-purple-950/50 transition text-purple-300">Email Link</button>}
                      </div>
                    </div>
                  )}
                  <button onClick={cancelRecurringPlan} disabled={recurCanceling} className="w-full text-xs text-brand-400 hover:text-brand-300 disabled:opacity-40 px-2 py-1.5 rounded-lg hover:bg-brand-950/30 transition">
                    {recurCanceling ? "Canceling…" : "Cancel Recurring Plan"}
                  </button>
                </div>
              ) : recurOpen ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input value={recurAmount} onChange={e => setRecurAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount ($)" className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm outline-none focus:border-brand-500/50" />
                    <select value={recurInterval} onChange={e => setRecurInterval(e.target.value as any)} className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm outline-none focus:border-brand-500/50">
                      <option value="week">Weekly</option>
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </div>
                  <input value={recurDesc} onChange={e => setRecurDesc(e.target.value)} placeholder="Description (e.g. Monthly window cleaning)" className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm outline-none focus:border-brand-500/50" />
                  <div className={"flex gap-2 " + (isMobile ? "flex-col" : "flex-row")}>
                    <GBtn onClick={startRecurringPlan} disabled={recurCreating || !recurAmount} className="flex-1 !justify-center">
                      {recurCreating ? "Creating…" : "Send Stripe Link"}
                    </GBtn>
                    {squareConfigured && (
                      <button
                        onClick={() => { if (!recurAmount || Math.round(parseFloat(recurAmount) * 100) <= 0) { toast?.("Enter a valid amount", "red"); return; } setSquareRecurOpen(true); }}
                        className="flex-1 px-3 py-2 rounded-lg bg-[#006AFF]/20 border border-[#006AFF]/40 text-[#4d9fff] text-sm font-medium hover:bg-[#006AFF]/30 transition"
                      >
                        Charge Square Card
                      </button>
                    )}
                  </div>
                  <div className="text-[10px] text-white/30">Stripe sends the customer a link to enter their own card. Square requires the card in hand (in person or read over the phone).</div>
                </div>
              ) : (
                <div className="text-xs text-white/40 py-2 text-center">No recurring plan set up</div>
              )}
            </Glass>
            {squareConfigured && (
              <SquareRecurringSetupModal
                open={squareRecurOpen}
                onClose={() => setSquareRecurOpen(false)}
                applicationId={settings.squareApplicationId}
                locationId={settings.squareLocationId}
                crmCustomerId={c.id}
                amountCents={Math.round(parseFloat(recurAmount || "0") * 100)}
                cadence={squareCadence}
                description={recurDesc.trim() || "Recurring service"}
                customerEmail={c.email}
                customerName={[c.firstName, c.lastName].filter(Boolean).join(" ")}
                onSuccess={(subscriptionId) => {
                  const newPlan = { provider: "square", status: "active", amountCents: Math.round(parseFloat(recurAmount || "0") * 100), interval: recurInterval, description: recurDesc.trim() || "Recurring service", squareSubscriptionId: subscriptionId };
                  setCustomers((prev: any[]) => prev.map((cust: any) => cust.id === c.id ? { ...cust, recurringPlan: newPlan } : cust));
                  setSquareRecurOpen(false);
                  setRecurOpen(false);
                  toast?.("Recurring plan started via Square ✓", "green");
                }}
              />
            )}
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Jobs", value: cj.length, icon: "🔨" },
                { label: "Spent", value: fmt(c.totalSpent || 0), icon: "💰" },
                { label: "Avg Job", value: cj.length ? fmt(cj.reduce((s,j)=>s+j.amount,0)/cj.length) : "—", icon: "📊" }
              ].map(s => <div key={s.label} className="p-3 bg-black/40 border border-brand-900/20 rounded-xl text-center">
                <div className="text-lg">{s.icon}</div>
                <div className="font-bold text-sm mt-1">{s.value}</div>
                <div className="text-[10px] text-white/40">{s.label}</div>
              </div>)}
            </div>
            {/* Last job */}
            {cj.length > 0 && (() => {
              const last = cj.slice().sort((a,b) => b.scheduledDate.localeCompare(a.scheduledDate))[0];
              return <div className="flex items-center gap-3 p-3 bg-black/40 border border-brand-900/20 rounded-xl text-xs">
                <CheckCircle size={14} className="text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">Last service: {last.scheduledDate}</div>
                  <div className="text-white/50 truncate">{last.address}</div>
                </div>
                <div className="text-brand-400 font-bold">{fmt(last.amount)}</div>
                <Badge tone={last.status === "completed" ? "green" : "yellow"}>{last.status.replace("_"," ")}</Badge>
              </div>;
            })()}
            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => window.open("tel:" + c.phone)} className="flex flex-col items-center gap-1 p-3 bg-green-950/20 border border-green-700/30 rounded-xl hover:bg-green-950/40 transition text-xs text-green-300"><Phone size={16} />Call</button>
              <button onClick={() => window.open("sms:" + c.phone)} className="flex flex-col items-center gap-1 p-3 bg-blue-950/20 border border-blue-700/30 rounded-xl hover:bg-blue-950/40 transition text-xs text-blue-300"><MessageSquare size={16} />Text</button>
              <button onClick={() => {
                // FIX 12 — window.open("mailto:...") hands off to whatever the
                // OS has registered as the default mail handler, which is
                // Outlook on a lot of Windows machines regardless of what the
                // owner actually uses day-to-day. If they've connected Gmail
                // in Settings → Integrations, open Gmail's own web compose
                // (in-browser, no native app involved) instead — otherwise
                // fall back to a plain mailto: via location.href (window.open
                // on a mailto: URL can leave a stray blank tab behind in some
                // browsers; setting location.href does not).
                if ((settings as any)?.googleConnected && (settings as any)?.googleEmail) {
                  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(c.email)}`, "_blank", "noopener,noreferrer");
                } else {
                  window.location.href = "mailto:" + c.email;
                }
              }} className="flex flex-col items-center gap-1 p-3 bg-purple-950/20 border border-purple-700/30 rounded-xl hover:bg-purple-950/40 transition text-xs text-purple-300"><Mail size={16} />Email</button>
            </div>
          </div>}
          {/* BUG FIX — this used to be a plain, unclickable div: id/date/
              status/total only, no way to open, edit, send, or track
              progress on the actual estimate/invoice. onOpenEstimate
              (wired from CustomersPage) closes this modal and navigates to
              Estimates/Invoices with the row glowed, the same "spotlight"
              pattern Alfred's own navigation already uses. */}
          {tab === "estimates" && <div className="space-y-2">{ce.length ? ce.map(e => {
            const progressSteps = [
              { label: "Sent", done: true },
              { label: "Viewed", done: !!e.clientViewedAt },
              { label: e.invoiced ? "Approved" : "Signed", done: e.status === "approved" || !!e.invoiced },
              { label: e.invoiced ? "Paid" : "Invoiced", done: e.invoiced ? !!e.paidAt : false },
            ];
            return (
              <button key={e.id} onClick={() => onOpenEstimate(e.id, `#${e.id.toUpperCase()}`)} className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-brand-700/30 transition">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">#{e.id.toUpperCase()}{e.invoiced ? " · Invoice" : " · Quote"}</div>
                    <div className="text-xs text-white/50">{e.createdAt}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={e.status === "approved" ? "green" : e.status === "rejected" ? "red" : "yellow"}>{e.status}</Badge>
                    <span className="font-semibold text-brand-400">{fmt(e.total)}</span>
                    <ChevronRight size={14} className="text-white/30" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {progressSteps.map((s, i) => (
                    <React.Fragment key={s.label}>
                      {i > 0 && <div className={"h-px flex-1 " + (s.done ? "bg-green-600/50" : "bg-white/10")} />}
                      <span className={"text-[9px] px-1.5 py-0.5 rounded-full " + (s.done ? "bg-green-950/40 text-green-300" : "bg-white/5 text-white/30")}>{s.label}</span>
                    </React.Fragment>
                  ))}
                </div>
              </button>
            );
          }) : <div className="text-center py-6 text-white/40 text-sm">None</div>}</div>}
          {/* ITEM 9 — this was a plain, unclickable div: address/date/status/
              amount only, no way to see checklist/photos/signature/crew —
              exactly the reported gap. Now shares the same expand-to-see-
              everything row the Info tab's Job History list uses. */}
          {tab === "jobs" && <div className="space-y-2">{cj.length ? cj.map(j => renderJobRow(j)) : <div className="text-center py-6 text-white/40 text-sm">None</div>}</div>}
          {tab === "timeline" && <div className="space-y-3">
            <Glass className="p-3 !bg-black/40">
              <div className="flex gap-2 mb-2 flex-wrap">{["note", "call", "text", "email"].map(t => <button key={t} onClick={() => setNoteType(t)} className={"text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border transition capitalize " + (noteType === t ? "bg-brand-900/40 text-brand-300 border-brand-600/40" : "bg-white/5 text-white/50 border-white/10")}>{t}</button>)}</div>
              <div className="flex gap-2"><GInput placeholder={"Log a " + noteType + "..."} value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addEntry()} /><GBtn onClick={addEntry} disabled={!note.trim()}><Plus size={14} /></GBtn></div>
            </Glass>
            {ct.length ? <div className="relative pl-4">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-brand-900/30" />
              {ct.map(ev => {
                const { I, c: clr } = tIcon(ev.type);
                return <div key={ev.id} className="relative flex gap-3 pb-4">
                  <div className={"absolute -left-4 w-6 h-6 rounded-full flex items-center justify-center border-2 border-black " + clr}><I size={10} /></div>
                  <div className="ml-4 flex-1 bg-white/5 border border-white/5 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1"><span className="text-xs text-white/50 uppercase tracking-wider capitalize">{ev.type}</span><span className="text-xs text-white/40">{ev.date}</span></div>
                    <div className="text-sm">{ev.note}</div>
                    <div className="text-[10px] text-white/40 mt-1">by {ev.author}</div>
                  </div>
                </div>;
              })}
            </div> : <div className="text-center py-6 text-white/40 text-sm">No events logged</div>}
          </div>}

          {tab === "portal" && <div className="space-y-4">
            <div className="p-3 bg-blue-950/20 border border-blue-700/30 rounded-xl">
              <div className="text-xs text-blue-300 font-semibold mb-1 flex items-center gap-1.5">🌐 Customer Portal Preview</div>
              <div className="text-[10px] text-white/60">This is what {c.firstName} sees when they log in to their portal. Share link: <span className="text-blue-400 font-mono">crm.com/portal/{c.id?.slice(0,8)}</span></div>
            </div>
            {/* Estimates */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText size={10} />Estimates & Invoices</div>
              {ce.length === 0 ? <div className="text-xs text-white/40 py-3 text-center">No estimates yet</div>
              : <div className="space-y-2">
                {ce.map(e => <div key={e.id} className="flex items-center gap-3 p-3 bg-black/40 border border-brand-900/10 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{e.lineItems?.map(i => i.description).filter(Boolean).join(", ").slice(0, 40) || "Quote"}</div>
                    <div className="text-xs text-white/50">{e.createdAt} · {fmt(e.total)}</div>
                  </div>
                  <Badge tone={e.paidAt ? "green" : e.invoiced ? "yellow" : e.status === "approved" ? "blue" : "gray"}>{e.paidAt ? "Paid" : e.invoiced ? "Invoice" : e.status}</Badge>
                </div>)}
              </div>}
            </div>
            {/* Jobs + Photo Gallery */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5"><Briefcase size={10} />Job History & Photo Gallery</div>
                {/* ITEM 9 — dataUrl-only count/gate, same bug as the expandable
                    rows below: any Storage-uploaded photo (url, no dataUrl)
                    counted as zero and was excluded from this whole gallery. */}
                <span className="text-[10px] text-white/30">{cj.reduce((s,j) => s + (j.photos?.filter(p=>p.url || p.dataUrl).length||0), 0)} photos</span>
              </div>
              {/* All photos flat grid */}
              {cj.some(j => j.photos?.some(p => p.url || p.dataUrl)) && (
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {cj.flatMap(j => (j.photos||[]).filter(p => p.url || p.dataUrl).map((p,i) => ({
                    ...p, jobDate: j.scheduledDate, jobAddr: j.address?.split(",")[0], jobAmt: j.amount
                  }))).slice(0,12).map((p,i) => (
                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-black/40 group cursor-pointer"
                      onClick={() => window.open(mediaSrc(p.url, p.dataUrl), "_blank")}>
                      <img src={mediaSrc(p.url, p.dataUrl)} alt={p.type} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className={"absolute top-1 left-1 text-[8px] px-1.5 py-0.5 rounded-full font-bold " + (p.type === "before" ? "bg-blue-600 text-white" : "bg-green-600 text-white")}>{p.type}</div>
                      <div className="absolute bottom-1 left-1 right-1 text-[8px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity truncate">{p.jobAddr}</div>
                    </div>
                  ))}
                </div>
              )}
              {/* FIX 11 — job rows used to be plain unclickable divs, and (a
                  separate bug) the WHOLE list was hidden behind "does any job
                  have a photo" — a customer with jobs but no photos yet saw
                  no job history at all. Now always shown when jobs exist;
                  click a row to expand full checklist/photos/notes/crew. */}
              {cj.length > 0 ? (
                <div className="space-y-2">
                  {cj.slice(0,6).map(j => renderJobRow(j))}
                </div>
              ) : <div className="text-xs text-white/40 py-3 text-center">No jobs yet</div>}
            </div>
            {/* Outstanding balance */}
            {(() => {
              const outstanding = ce.filter(e => e.invoiced && !e.paidAt).reduce((s, e) => s + e.total, 0);
              if (outstanding <= 0) return <div className="p-3 bg-green-950/20 border border-green-700/30 rounded-xl text-xs text-green-300 flex items-center gap-2"><CheckCircle size={12} />No outstanding balance — all paid up ✓</div>;
              return <div className="space-y-2">
                <div className="p-3 bg-brand-950/20 border border-brand-700/30 rounded-xl flex items-center justify-between">
                  <div><div className="text-xs text-danger-300 font-semibold">Outstanding Balance</div><div className="text-[10px] text-white/60">{ce.filter(e => e.invoiced && !e.paidAt).length} invoice{ce.filter(e => e.invoiced && !e.paidAt).length !== 1 ? "s" : ""} unpaid</div></div>
                  <div className="text-2xl font-bold text-brand-400">{fmt(outstanding)}</div>
                </div>
                <button onClick={() => {
                  const link = "crm.com/portal/" + c.id + "?pay=balance";
                  navigator.clipboard?.writeText(link).catch(() => {});
                  toast("Pay link copied — send to customer");
                }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-900/30 border border-brand-700/40 text-brand-300 rounded-xl hover:bg-brand-900/50 transition text-xs font-medium">
                  <CreditCard size={12} />Copy Pay Remaining Balance Link
                </button>
              </div>;
            })()}

            {/* Payment History */}
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Receipt size={10} />Payment History</div>
              {ce.filter(e => e.paidAt).length === 0
                ? <div className="text-xs text-white/40 py-3 text-center">No payments recorded yet</div>
                : <div className="space-y-1.5">
                  {ce.filter(e => e.paidAt).map(e => (
                    <div key={e.id} className="flex items-center gap-3 p-2.5 bg-black/40 border border-green-900/20 rounded-xl">
                      <CheckCircle size={12} className="text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">{(e.lineItems || []).map(l => l.description).filter(Boolean).join(", ").slice(0,40) || "Service"}</div>
                        <div className="text-[10px] text-white/40">Paid {e.paidAt} · Invoice #{e.id.slice(-6).toUpperCase()}</div>
                      </div>
                      <div className="text-sm font-bold text-green-400">{fmt(e.total)}</div>
                    </div>
                  ))}
                  <div className="text-right text-xs text-white/50 pt-1">Total paid: <span className="font-bold text-white">{fmt(ce.filter(e => e.paidAt).reduce((s,e) => s + e.total, 0))}</span></div>
                </div>}
            </div>

            {/* Document Vault */}
            <DocumentVault customerId={c.id} />
          </div>}
        </div>
      </div>

      <SaveCardModal
        open={addCardOpen}
        onClose={() => setAddCardOpen(false)}
        publishableKey={settings?.stripePublishableKey || ""}
        stripeAccountId={(settings as any)?.stripeConnectAccountId}
        useCallerSession
        email={c.email || ""}
        name={`${c.firstName} ${c.lastName}`}
        existingStripeCustomerId={c.stripeCustomerId}
        companyName={settings?.companyName || "the company"}
        enteredByEmployee
        onSaved={async (stripeCustomerId, paymentMethodId, label) => {
          setCustomers((prev: any[]) => prev.map((cust: any) => cust.id === c.id ? { ...cust, stripeCustomerId, savedPaymentMethodId: paymentMethodId, savedPaymentMethodLabel: label } : cust));
          // BUG FIX (audit) — same class of fix as EmployeePortal.tsx's Add
          // Card on File: this write was fire-and-forget with no result
          // check, so a 0-row RLS mismatch left the card working in Stripe
          // but invisible to the CRM while still toasting success.
          const result = await (supabase as any).from("customers").update({ stripeCustomerId, savedPaymentMethodId: paymentMethodId, savedPaymentMethodLabel: label }).eq("id", c.id).select("id");
          if (result?.error || !Array.isArray(result?.data) || result.data.length === 0) {
            console.warn("[PaymentMethods] add-card Supabase sync failed:", result?.error?.message || "0 rows matched");
            toast?.("Card saved in Stripe, but couldn't sync to the customer record — try again.", "red");
          } else {
            toast?.("Card saved on file ✓", "green");
          }
          setAddCardOpen(false);
          loadPaymentMethods();
        }}
      />
    </Modal>
  );
}

// ===== ESTIMATES =====
