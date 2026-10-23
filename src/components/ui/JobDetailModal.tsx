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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, weekdayLabels, computeNextRecurringDate, isEmployeeUnavailable, computeDiscountsTotal, equipmentList, requiredChemicalsList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, compressImageFile, getEffectiveRate, mediaSrc, dataUrlToBlob, uploadJobMedia, deleteJobMediaByUrl, reconcileCrewAfterAssign, insertJobRequestSafely, checkVideoLimits, buildJobCalendarDescription, buildChecklistFromServices } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField, JobChecklistItem, ChecklistPhoto, JobVideo, JobSignOff } from "../../types";
import { twilioSend, sendEmail, sendViaGmail, sendOwnerGmailOnly, emailShell, emailButton, logOutboundSmsToInbox } from "../../lib/messaging";
import { sendPushNotification } from "../../lib/push";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { createGCalEvent as createGCalEventApi, updateGCalEvent as updateGCalEventApi, deleteGCalEvent as deleteGCalEventApi, refreshEmpGoogleToken } from "../../lib/googleApi";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { supabase } from "../../lib/supabase";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";
import { Modal } from "./Modal";
import { InvoicePreviewModal } from "./InvoicePreviewModal";
import { StripePaymentModal } from "./StripePaymentModal";
import { Badge } from "./Badge";
import { Stat } from "./Stat";
import { PBar } from "./PBar";
import { PageFade } from "./PageFade";
import { TimeframeSelector } from "./TimeframeSelector";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { PropertyMapEmbed } from "./PropertyMapEmbed";

const PRE_DEFAULTS: JobChecklistItem[] = [
  { id: "pre1", label: "Take photos of existing damage", done: false },
  { id: "pre2", label: "Confirm water access", done: false },
  { id: "pre3", label: "Check weather conditions", done: false },
  { id: "pre4", label: "Note any pre-existing issues", done: false },
];
const DURING_DEFAULTS: JobChecklistItem[] = [
  { id: "dur1", label: "Apply cleaning solution", done: false },
  { id: "dur2", label: "Scrub affected areas", done: false },
  { id: "dur3", label: "Rinse thoroughly", done: false },
];
const POST_DEFAULTS: JobChecklistItem[] = [
  { id: "post1", label: "Customer walkthrough", done: false },
  { id: "post2", label: "Collect payment", done: false },
  { id: "post3", label: "Get customer signature", done: false },
  { id: "post4", label: "Take after photos", done: false },
];

function ChecklistSection({ jobId, title, emoji, items, onUpdate, crewOptions = [] }: {
  jobId: string;
  title: string; emoji: string;
  items: JobChecklistItem[];
  onUpdate: (items: JobChecklistItem[]) => void;
  // FEATURE — "assign specific checklist items to specific employees."
  // The crew currently assigned to this job, so the owner can pick who a
  // given item belongs to. Empty when the job has no crew yet.
  crewOptions?: { id: string; name: string }[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const done = items.filter(i => i.done).length;
  const allDone = done === items.length;

  const toggle = (id: string) =>
    onUpdate(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
  const updateNotes = (id: string, notes: string) =>
    onUpdate(items.map(it => it.id === id ? { ...it, notes } : it));
  const updateAssignee = (id: string, assignedTo: string) =>
    onUpdate(items.map(it => it.id === id ? { ...it, assignedTo: assignedTo || undefined } : it));
  const addPhoto = async (id: string, dataUrl: string) => {
    const mediaId = uid();
    const url = await uploadJobMedia(dataUrlToBlob(dataUrl), `${jobId}/checklist-${id}-${mediaId}.jpg`, "image/jpeg");
    const media = url ? { id: mediaId, url } : { id: mediaId, dataUrl };
    onUpdate(items.map(it => it.id === id ? { ...it, photos: [...(it.photos || []), media] } : it));
  };
  const removePhoto = (itemId: string, photoId: string) =>
    onUpdate(items.map(it => it.id === itemId ? { ...it, photos: (it.photos || []).filter(p => p.id !== photoId) } : it));

  return (
    <Glass className={"p-3 !bg-black/40 " + (allDone ? "!border-green-700/40" : "")}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1">
          <span>{emoji}</span>{title}
        </div>
        <div className={"text-xs font-bold " + (allDone ? "text-green-400" : "text-white/40")}>
          {done}/{items.length} {allDone && "✓"}
        </div>
      </div>
      <div className="space-y-1">
        {items.map(item => (
          <div key={item.id} className="rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-2 hover:bg-white/5 rounded-lg">
              <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)}
                className="w-4 h-4 accent-green-500 cursor-pointer flex-shrink-0" />
              <span className={"text-xs flex-1 " + (item.done ? "line-through text-white/30" : "text-white/80")}>
                {item.label}
              </span>
              {item.assignedTo && (
                <span className="text-[9px] text-purple-300/80 bg-purple-950/40 border border-purple-700/30 rounded-full px-1.5 py-0.5 flex-shrink-0">
                  {crewOptions.find(c => c.id === item.assignedTo)?.name || "assigned"}
                </span>
              )}
              {(item.photos || []).length > 0 && (
                <span className="text-[9px] text-blue-400/70">📷{item.photos!.length}</span>
              )}
              <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                className="text-white/20 hover:text-white/60 flex-shrink-0 transition">
                <ChevronRight size={12} className={"transition-transform " + (expanded === item.id ? "rotate-90" : "")} />
              </button>
            </div>
            {expanded === item.id && (
              <div className="pl-6 pr-2 pb-2 space-y-2">
                {/* FEATURE — "assign specific checklist items to specific
                    employees." Left blank ("Anyone on crew"), any assigned
                    crew member can check it; picking a name restricts it to
                    them (see PortalChecklistSection's matching enforcement). */}
                {crewOptions.length > 0 && (
                  <GSel value={item.assignedTo || ""} onChange={(e: any) => updateAssignee(item.id, e.target.value)} className="!text-xs">
                    <option value="" className="bg-black">Anyone on crew</option>
                    {crewOptions.map(c => <option key={c.id} value={c.id} className="bg-black">{c.name}</option>)}
                  </GSel>
                )}
                <GTxt rows={1} value={item.notes || ""} onChange={e => updateNotes(item.id, e.target.value)}
                  placeholder="Add notes..." className="!text-xs" />
                {(item.photos || []).length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {(item.photos || []).map(p => (
                      <div key={p.id} className="relative w-14 h-14 rounded-lg overflow-hidden border border-white/10 group">
                        <img src={mediaSrc(p.url, p.dataUrl)} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => removePhoto(item.id, p.id)}
                          className="absolute top-0.5 right-0.5 bg-black/80 text-white rounded p-0.5 opacity-0 group-hover:opacity-100">
                          <X size={8} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="cursor-pointer inline-block">
                  <input type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      compressImageFile(f).then(dataUrl => addPhoto(item.id, dataUrl));
                      e.target.value = "";
                    }} />
                  <div className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 cursor-pointer transition">
                    <Plus size={8} />📷 Add Photo
                  </div>
                </label>
              </div>
            )}
          </div>
        ))}
      </div>
    </Glass>
  );
}

// Small embedded map for a job address — see PropertyMapEmbed for why this
// replaced the Street View Static API (403 key-restriction errors).
function StreetViewThumb({ address }: { address: string; apiKey?: string }) {
  return <PropertyMapEmbed address={address} height={144} />;
}

// Small "type a name, hit Enter or click +" input used to add equipment or
// chemical items that aren't on the preset list — owners aren't limited to
// whatever's hardcoded in equipmentList/requiredChemicalsList.
function CustomItemInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  const submit = () => { const t = v.trim(); if (!t) return; onAdd(t); setV(""); };
  return (
    <div className="flex gap-2">
      <input
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder={placeholder}
        className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/80 placeholder:text-white/30 focus:outline-none focus:border-brand-500/50"
      />
      <button onClick={submit} disabled={!v.trim()} className="text-xs px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white disabled:opacity-40">
        <Plus size={11} className="inline mr-1" />Add
      </button>
    </div>
  );
}

// Races any promise against a hard timeout — a thrown error already gets
// caught by try/catch, but a HUNG promise (an awaited Supabase/Google call
// that never resolves or rejects, e.g. from internal auth-lock contention)
// skips catch entirely and can block a button's loading state forever. This
// is the actual fix for "button hangs on a 401" — the 401 itself throws
// fine; it's the surrounding await chain that can stall.
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label + " timed out")), ms)),
  ]);

export function JobDetailModal({ jobId, job, onClose, customers = [], employees = [], updateJob, toast, gToken = "", settings = {} as any, setSettings, estimates = [], setEstimates = (() => {}) as any, onPortal = (_id: string) => {}, ownerId = "", services = [] as any[] }: { jobId: any; job: any; onClose: any; customers?: any[]; employees?: any[]; updateJob: any; toast: any; gToken?: string; settings?: any; setSettings?: any; estimates?: any[]; setEstimates?: any; onPortal?: (id: string) => void; ownerId?: string; services?: any[] }) {
  const [commNote, setCommNote] = useState("");
  const [sendingInvoice, setSendingInvoice] = useState(false);
  // FEATURE — owner in-person checkout: manual card entry via Stripe
  // Elements (StripePaymentModal), scoped to this job's amount/linked
  // invoice, for when the owner personally works a self-assigned job. Mirrors
  // InvoicesPage.tsx's stripePayInvoice pattern (same StripePaymentModal
  // component/props) rather than building a second charge UI.
  const [chargeCardOpen, setChargeCardOpen] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [commType, setCommType] = useState("note");
  const [chemName, setChemName] = useState("");
  const [chemGal, setChemGal] = useState(0);
  const [chemCost, setChemCost] = useState(0);
  const [tagInput, setTagInput] = useState("");
  const [attUploading, setAttUploading] = useState(false);
  const attFileInputRef = useRef<HTMLInputElement | null>(null);
  const [, forceTick] = useState(0);
  const notifyEmployeesRef = useRef<(emps: any[], buildSubject: (emp: any) => string, buildHtml: (emp: any) => string) => Promise<number>>(() => Promise.resolve(0));
  const [showSignOff, setShowSignOff] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [gSyncing, setGSyncing] = useState(false);
  const [notifying, setNotifying] = useState(false);
  // FEATURE — field parity for the owner working a job themselves. The
  // employee portal has always had On My Way / I'm Here / Running Late for
  // a technician on-site; the owner's own JobDetailModal had Time Tracking
  // and checklists/photos but nothing for the customer-facing "I'm en
  // route" / "running behind" moments — an owner self-assigned to a job
  // had a strictly worse in-the-field experience than an employee on the
  // exact same job. Same message templates/send paths as EmployeePortal.tsx.
  const [sendingOtw, setSendingOtw] = useState(false);
  const [sendingRunningLate, setSendingRunningLate] = useState(false);
  // BUG FIX — "location sharing wasn't showing the owner." The owner's own
  // #/portal visit always renders the read-only OwnerTeamPortal preview
  // (App.tsx's isOwnerView), which has no location-sharing toggle at all —
  // there was genuinely no code path anywhere that could ever set
  // locationSharing:true on the owner's own employees row, so they could
  // never appear on the Live Team/Crew View map no matter what. Mirrors
  // EmployeePortal.tsx's own one-shot toggle (same fields, same optimistic-
  // then-confirmed pattern) since Time Tracking here is the owner's actual
  // real self-service control, per docs/ARCHITECTURE.md's "Owner self-assign" note.
  const [ownerLocSharingPending, setOwnerLocSharingPending] = useState(false);
  const [optimisticOwnerLocSharing, setOptimisticOwnerLocSharing] = useState<boolean | undefined>(undefined);
  // BUG FIX (audit) — this used to match `employees.find(e => e.role ===
  // "owner")` — i.e. "the" owner row, not the row for whoever's actually
  // signed in right now. A manager (who also gets this same modal, per
  // docs/ARCHITECTURE.md's manager-CRM-access model) opening a job would find and
  // toggle the OWNER's own location, not their own — silently overwriting
  // someone else's shared-location state. Resolved from the real signed-in
  // Supabase session instead, matching by user_id (or email as a fallback
  // for a not-yet-linked row), so this only ever affects the caller's own
  // record — for the owner themselves, that's still their own "owner" row.
  const [myAuthUser, setMyAuthUser] = useState<{ id: string; email: string } | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }: any) => {
      if (data?.user) setMyAuthUser({ id: data.user.id, email: (data.user.email || "").toLowerCase() });
    }).catch(() => {});
  }, []);
  const ownerEmpRow = myAuthUser
    ? employees.find((e: any) => e.user_id === myAuthUser.id || (e.email || "").toLowerCase() === myAuthUser.email)
    : undefined;
  const ownerLocationSharing = optimisticOwnerLocSharing !== undefined ? optimisticOwnerLocSharing : !!(ownerEmpRow as any)?.locationSharing;
  const toggleOwnerLocationSharing = () => {
    const empId = (ownerEmpRow as any)?.id;
    if (!empId) { toast?.("Couldn't find your own crew record — try reloading", "red"); return; }
    const turningOn = !ownerLocationSharing;
    if (turningOn) {
      if (!navigator.geolocation) { toast?.("This browser doesn't support location sharing", "red"); return; }
      setOwnerLocSharingPending(true);
      let settled = false;
      const safety = setTimeout(() => { if (settled) return; settled = true; setOwnerLocSharingPending(false); toast?.("Location request timed out", "red"); }, 12000);
      navigator.geolocation.getCurrentPosition(
        async pos => {
          if (settled) return; settled = true; clearTimeout(safety);
          setOwnerLocSharingPending(false);
          setOptimisticOwnerLocSharing(true);
          toast?.("📍 Location sharing active", "green");
          const { error } = await (supabase as any).from("employees").update({ locationSharing: true, lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() } }).eq("id", empId);
          if (error) {
            console.error("[Owner Location Share] error:", error.message);
            setOptimisticOwnerLocSharing(false);
            toast?.("Failed to save location sharing — " + error.message, "red");
          }
        },
        err => {
          if (settled) return; settled = true; clearTimeout(safety); setOwnerLocSharingPending(false);
          console.error("[Owner Location Share] error:", err.code, err.message);
          toast?.(err.code === 1 ? "Location permission denied — enable it in your browser/device settings" : "Couldn't get your location — try again", "red");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return;
    }
    setOptimisticOwnerLocSharing(false);
    (supabase as any).from("employees").update({ locationSharing: false }).eq("id", empId).then((r: any) => {
      if (r?.error) toast?.("Failed to save — " + r.error.message, "red");
    });
  };
  // ITEM (edit-mode parity) — was a single showRequestForm boolean driving one
  // shared dropdown-based request form, so requesting a SPECIFIC employee
  // meant opening a global form and picking them from a <select> — not a true
  // per-employee control like the new-job form's per-row Assign/Request
  // toggle. Now tracks WHICH employee's inline request panel is open, so each
  // not-yet-crewed employee gets their own Assign / Request pair directly on
  // their row, matching JobsPage.tsx's new-job crew picker.
  const [requestOpenId, setRequestOpenId] = useState<string | null>(null);
  const [requestEmpId, setRequestEmpId] = useState("");
  const [requestMsg, setRequestMsg] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleEmpId, setScheduleEmpId] = useState("");
  const [scheduling, setScheduling] = useState(false);
  // AUDIT FIX — the owner never had any visibility into whether a sent
  // request was still pending, accepted, or declined — job_requests was
  // write-only from this side. A declined request produced zero signal; the
  // job just sat crew-less, indistinguishable from a request never having
  // been sent at all (exactly the "assigning/requesting employees doesn't
  // work" report). Keyed by employee_id — last request per employee wins.
  const [jobRequestStatuses, setJobRequestStatuses] = useState<Record<string, { status: string; denial_reason?: string }>>({});
  const fetchJobRequestStatuses = useCallback(async () => {
    if (!jobId) return;
    try {
      const { data, error } = await (supabase as any).from("job_requests").select("employee_id, status, denial_reason").eq("job_id", jobId);
      if (!error && Array.isArray(data)) {
        const map: Record<string, { status: string; denial_reason?: string }> = {};
        data.forEach((r: any) => { map[r.employee_id] = { status: r.status, denial_reason: r.denial_reason }; });
        setJobRequestStatuses(map);
      }
    } catch { /* job_requests table may not exist yet */ }
  }, [jobId]);
  useEffect(() => {
    fetchJobRequestStatuses();
    const interval = setInterval(fetchJobRequestStatuses, 15000);
    return () => clearInterval(interval);
  }, [fetchJobRequestStatuses]);

  // Live timer tick while clock is running
  useEffect(() => {
    if (!job?.clockInAt) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [job?.clockInAt]);

  // Detect schedule/address changes on an already-crewed job and notify assigned
  // employees automatically. Skips the initial mount and skips when the modal is
  // reused for a different job (jobId change resets the baseline silently).
  // Must stay ABOVE the `if (!job) return null` below — hooks can never follow an
  // early return, or the hook count differs between renders where job is/isn't set
  // (React error #310, "rendered fewer hooks than expected").
  const prevScheduleRef = useRef<{ jobId: string; date?: string; time?: string; address?: string; status?: string }>({
    jobId, date: job?.scheduledDate, time: job?.scheduledTime, address: job?.address, status: job?.status,
  });
  // Looks up the first crew member with a usable (or refreshable) Google
  // token and autoSyncCalendar on — same selection the event was originally
  // created under in scheduleAndNotify, so update/delete target the calendar
  // that actually holds the event instead of the owner's own calendar (which
  // was never where employee-assigned events live).
  const findSyncableEmpToken = async (): Promise<string | null> => {
    const crewEmps = (job!.crew || []).map((id: string) => employees.find(e => e.id === id)).filter(Boolean);
    for (const emp of crewEmps) {
      try {
        const { data: empRow } = await withTimeout<any>(
          (supabase as any).from("employees").select("google_token, google_token_expires_at, google_refresh_token, autoSyncCalendar").eq("id", (emp as any).id).maybeSingle(),
          6000, "Employee lookup"
        );
        if (empRow?.autoSyncCalendar === false) continue;
        let tok = empRow?.google_token;
        const validTok = tok && empRow?.google_token_expires_at && new Date(empRow.google_token_expires_at).getTime() > Date.now();
        if (tok && !validTok && empRow?.google_refresh_token) {
          const refreshed = await refreshEmpGoogleToken(settings?.googleBackendUrl, empRow.google_refresh_token);
          if (refreshed?.token) {
            tok = refreshed.token;
            // FIX 10 (mobile round 6) — this used to only keep the refreshed
            // token in the local `tok` variable for this one calendar sync
            // call, then discard it — unlike the other two refresh copies in
            // this file, which persist back to the employees row. Without
            // this, the row stayed stale and got re-refreshed from scratch
            // on every future call here until the employee's own 5-min
            // interval happened to catch up.
            (supabase as any).from("employees").update({ google_token: refreshed.token, google_token_expires_at: new Date(refreshed.expiresAt).toISOString() }).eq("id", (emp as any).id).then(() => {}, () => {});
          } else {
            tok = null;
          }
        } else if (!validTok) {
          tok = null;
        }
        if (tok) return tok;
      } catch { /* try next crew member */ }
    }
    return null;
  };
  useEffect(() => {
    if (!job) return;
    const prev = prevScheduleRef.current;
    if (prev.jobId !== jobId) {
      prevScheduleRef.current = { jobId, date: job.scheduledDate, time: job.scheduledTime, address: job.address, status: job.status };
      return;
    }
    const crewEmps = (job.crew || []).map((id: string) => employees.find(e => e.id === id)).filter(Boolean);
    const withEmail = crewEmps.filter((e: any) => e.email);
    const changes: string[] = [];
    if (prev.date !== job.scheduledDate) changes.push(`date changed to ${job.scheduledDate}`);
    if (prev.time !== job.scheduledTime) changes.push(`time changed to ${job.scheduledTime || "unscheduled"}`);
    if (prev.address !== job.address) changes.push(`address changed to ${job.address}`);
    const justCancelled = prev.status !== "cancelled" && job.status === "cancelled";
    prevScheduleRef.current = { jobId, date: job.scheduledDate, time: job.scheduledTime, address: job.address, status: job.status };
    if (changes.length > 0 && withEmail.length > 0) {
      notifyEmployeesRef.current(
        withEmail,
        () => `Job Updated — ${job.address}`,
        (emp: any) => emailShell(settings,"Job Updated", `<p>Hi ${emp.firstName},</p><p>Your job has changed:</p><ul>${changes.map(c => `<li>${c}</li>`).join("")}</ul>`)
      ).then((sent: number) => { if (sent > 0) toast(`Notified ${sent} crew member${sent !== 1 ? "s" : ""} of the change`, "green"); });
    }
    // Calendar sync happens immediately on the same change, not on a timer.
    if (job.googleEventId && justCancelled) {
      findSyncableEmpToken().then(tok => {
        if (!tok) return;
        deleteGCalEventApi(tok, job.googleEventId!).then(() => updateJob(jobId, { googleEventId: undefined })).catch(() => {});
      });
    } else if (job.googleEventId && (changes.includes(`date changed to ${job.scheduledDate}`) || prev.time !== job.scheduledTime) && job.scheduledDate) {
      findSyncableEmpToken().then(tok => {
        if (!tok) return;
        const startDt = new Date(`${job.scheduledDate}T${job.scheduledTime || "09:00"}:00`);
        const endDt = new Date(startDt.getTime() + (Number(job.duration) || 2) * 3600000);
        updateGCalEventApi(tok, job.googleEventId!, { start: startDt.toISOString(), end: endDt.toISOString(), location: job.address }).catch(() => {});
      });
    }
  }, [job?.scheduledDate, job?.scheduledTime, job?.address, job?.status, jobId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) return null;
  const c = customers.find(x => x.id === job.customerId);

  // Direct assignment = automatic acceptance: toggling an employee onto the crew
  // here saves immediately (no accept/decline step) and emails them right away.
  // Only the "Request" flow (sendJobRequest below) requires the employee to
  // accept/decline via the Incoming Requests section of their portal.
  const toggleCrew = eid => {
    // DIAGNOSTIC — unlike scheduleAndNotify/sendJobRequest below, this used to
    // have zero error handling: a synchronous throw anywhere in this body
    // (e.g. updateJob not being the function this modal expects) aborted
    // silently — no toast, no network request, nothing in the console unless
    // devtools happened to be open. Wrapped in try/catch below so any future
    // failure here is loud instead of invisible; this log stays even after
    // the bug is found, matching this file's existing [Verify]-style tags.
    console.log("[EditCrewAssign] toggleCrew called — jobId:", jobId, "eid:", eid, "job.crew:", job?.crew, "updateJob is function:", typeof updateJob === "function");
    try {
      const crew = job.crew || [];
      const adding = !crew.includes(eid);
      const newCrew = adding ? [...crew, eid] : crew.filter(x => x !== eid);
      // crewAssignedAt records when each employee was added, so the portal's
      // Today tab can show a "New Assignment" banner for anything assigned
      // recently — this doubles as the durable assignment record itself.
      const patch: any = { crew: newCrew };
      if (adding) patch.crewAssignedAt = { ...(job.crewAssignedAt || {}), [eid]: Date.now() };
      console.log("[EditCrewAssign] calling updateJob with patch:", patch);
      updateJob(jobId, patch);
      // FEATURE — push this assignment onto (or off of) the employee's OWN
      // Google Calendar, if they've connected one. Server-side because the
      // owner's browser has no access to any employee's Google token — see
      // functions/api/employee-calendar-sync.ts. Fire-and-forget: a sync
      // failure (not connected, token expired) must never block the actual
      // crew assignment, which already succeeded above.
      // SECURITY FIX (audit finding) — employee-calendar-sync.ts now requires
      // a real session and derives ownerId from it server-side, never from
      // the request body — attach the caller's own token here.
      (async () => {
        const { data: { session: syncSession } } = await supabase.auth.getSession();
        return fetch("/api/employee-calendar-sync", {
          method: "POST", headers: { "Content-Type": "application/json", ...(syncSession?.access_token ? { Authorization: `Bearer ${syncSession.access_token}` } : {}) },
          body: JSON.stringify({
            employeeId: eid, jobId, action: adding ? "upsert" : "delete",
            title: (customers.find(x => x.id === job.customerId)?.firstName ? customers.find(x => x.id === job.customerId).firstName + " " + customers.find(x => x.id === job.customerId).lastName + " — " : "") + "Service",
            date: job.scheduledDate, time: job.scheduledTime, durationMinutes: (Number(job.duration) || 2) * 60,
            location: job.address,
            notes: buildJobCalendarDescription(job, customers.find(x => x.id === job.customerId), `${window.location.origin}${window.location.pathname}#/portal?job=${encodeURIComponent(job.id)}`, "View job in Crew Portal"),
          }),
        });
      })().catch(() => {});
      if (adding) {
        // reconcileCrewAfterAssign — `newCrew` was computed from this
        // modal's own possibly-stale `job.crew` prop. If an employee accepted
        // a different pending request for this same job moments ago (or
        // Alfred/another device assigned someone) and this browser's poll
        // hasn't caught up yet, the write above would silently overwrite
        // that addition. Merges it back in instead of losing it.
        reconcileCrewAfterAssign(jobId, newCrew, patch.crewAssignedAt, p => updateJob(jobId, p)).catch(() => {});
      }
      if (adding) {
        const emp = employees.find(e => e.id === eid);
        if (emp?.email) {
          const cust = customers.find(x => x.id === job.customerId);
          notifyEmployeesRef.current(
            [emp],
            () => `You've Been Assigned — ${job.scheduledDate || job.address}`,
            () => emailShell(settings,"You've Been Assigned", `<p>Hi ${emp.firstName},</p><p>You've been assigned to a job:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : ""}</ul><p>This job is already on your schedule — no action needed.</p>`)
          ).then((sent: number) => { if (sent > 0) toast?.(`Notified ${emp.firstName} ✓`, "green"); }).catch((e: any) => console.warn("[EditCrewAssign] notify email failed (non-fatal):", e?.message));
        }
        if (emp) {
          // FEATURE — real push notification, same event email already
          // covers. Fire-and-forget, never blocks/breaks the assignment
          // itself if it fails (see sendPushNotification's own comment).
          sendPushNotification({
            ownerId, employeeId: emp.id,
            title: "You've been assigned a job",
            body: `${job.scheduledDate || ""}${job.scheduledTime ? " at " + job.scheduledTime : ""} — ${job.address || ""}`.trim(),
            url: "/#/portal", tag: "job-assigned-" + jobId,
          });
        }
      }
    } catch (e: any) {
      console.error("[EditCrewAssign] toggleCrew threw:", e?.message, e);
      toast?.("Failed to update crew — " + (e?.message || "unknown error"), "red");
    }
  };

  // Sends one notification per employee. Prefers the EMPLOYEE'S OWN connected Gmail
  // account (their token, persisted in their employees row when they connect Google
  // in the portal) so the email comes from/through their own account; falls back to
  // the owner's connected Gmail account when unavailable.
  const notifyEmployees = async (
    emps: any[],
    buildSubject: (emp: any) => string,
    buildHtml: (emp: any) => string
  ): Promise<number> => {
    // Lookups run in parallel (not one-at-a-time) so a single slow row never
    // delays everyone else's notification, and the timeout is short (3s) so
    // the owner-channel fallback kicks in fast instead of stalling.
    const results = await Promise.allSettled(emps.filter(e => e.email).map(async emp => {
      const subj = buildSubject(emp);
      const html = buildHtml(emp);
      let viaEmpGmail = false;
      try {
        const { data: empRow } = await withTimeout<any>(
          (supabase as any).from("employees").select("google_token, google_token_expires_at, google_refresh_token, google_email").eq("id", emp.id).maybeSingle(),
          6000, "Employee lookup"
        );
        let tok = empRow?.google_token;
        const validTok = tok && empRow?.google_token_expires_at && new Date(empRow.google_token_expires_at).getTime() > Date.now();
        if (tok && !validTok && empRow?.google_refresh_token && settings?.googleBackendUrl) {
          // Employee's token is expired — this needs THEIR refresh_token, not
          // the owner's session. (Audit round 2 — sendViaGmail's old ambient
          // supabase.auth.refreshSession() fallback, which this comment used
          // to warn about, has been removed entirely; it now only ever uses
          // the explicit token/refreshToken passed in, so there's no longer a
          // path for it to silently pick up the owner's or any other
          // session's token here.)
          const refreshed = await refreshEmpGoogleToken(settings.googleBackendUrl, empRow.google_refresh_token);
          if (refreshed?.token) {
            tok = refreshed.token;
            (supabase as any).from("employees").update({ google_token: refreshed.token, google_token_expires_at: new Date(refreshed.expiresAt).toISOString() }).eq("id", emp.id).then(() => {}, () => {});
          } else tok = null;
        } else if (!validTok) {
          tok = null;
        }
        if (tok) {
          console.log("[GoogleConnect] Job email send — using EMPLOYEE's own Gmail account:", empRow.google_email || emp.email, "for", emp.firstName || emp.id);
          await withTimeout(sendViaGmail(tok, empRow.google_email || emp.email, emp.email, subj, html), 6000, "Gmail send");
          viaEmpGmail = true;
        }
      } catch (err) {
        console.warn("Employee Gmail send failed — falling back to owner channel:", err);
      }
      if (!viaEmpGmail) {
        await withTimeout(sendEmail(settings, { to: emp.email, subject: subj, body: html }), 6000, "Email send");
      }
      return true;
    }));
    return results.filter(r => r.status === "fulfilled").length;
  };
  notifyEmployeesRef.current = notifyEmployees;

  // Generates an invoice (an Estimate record flagged invoiced=true) from this
  // completed job's amount, then emails the customer a payment link. The link
  // re-uses the same client-portal flow estimates already use, where the
  // customer can pay in full, pay a deposit, or — once a deposit is on
  // record — pay the remaining balance. "Send Invoice" only validates contact
  // info and opens the preview modal — the actual send happens in
  // confirmSendInvoice once the owner reviews/edits it and clicks Send there.
  const sendInvoice = () => {
    const c = customers.find(x => x.id === job.customerId);
    if (!c?.email && !c?.phone) { toast("No contact info for this customer. Add email or phone first.", "red"); return; }
    setShowInvoicePreview(true);
  };
  const confirmSendInvoice = async (subject: string, bodyHtml: string) => {
    console.log("[SendInvoice] confirmSendInvoice called — job:", jobId, "customer:", job.customerId);
    const c = customers.find(x => x.id === job.customerId);
    if (!c) return;
    setSendingInvoice(true);
    try {
      // FEATURE 7 — fold this job's manual discounts into the generated
      // invoice, so a discount applied on the job actually reduces what the
      // customer is asked to pay instead of silently being dropped.
      const jobDiscountTotal = computeDiscountsTotal(job.discounts, Number(job.amount) || 0);
      const newInv = {
        id: uid(),
        customerId: job.customerId,
        lineItems: [{ id: uid(), description: job.notes || job.address || "Service", quantity: 1, unitPrice: Number(job.amount) || 0 }],
        subtotal: Number(job.amount) || 0,
        discount: jobDiscountTotal,
        discounts: job.discounts || [],
        depositRequired: 0,
        tax: 0,
        total: Math.max(0, (Number(job.amount) || 0) - jobDiscountTotal),
        status: "approved" as const,
        createdAt: today(),
        validUntil: daysFromNow(30),
        invoiced: true,
        invoicedAt: today(),
        owner_id: ownerId,
      };
      // [SendInvoice] this used to only call setEstimates (local React state)
      // with no Supabase write — the payLink texted/emailed to the customer
      // points at #/estimate/{newInv.id}; if that row never reaches Supabase
      // the link 404s and the invoice never shows up in InvoicesPage (which
      // reads straight from Supabase), even though this screen shows success.
      console.log("[SendInvoice] inserting new invoice", newInv.id, "amount", newInv.total);
      const insertResult = await withTimeout<any>((supabase as any).from("estimates").insert(newInv), 10000, "Invoice save");
      if (insertResult?.error) {
        console.error("[SendInvoice] estimate insert failed:", insertResult.error.message);
        throw new Error("Couldn't save invoice — " + insertResult.error.message);
      }
      console.log("[SendInvoice] invoice saved to Supabase ✓");
      setEstimates((prev: any[]) => [...prev, newInv]);
      // FIX 17 — #/portal/ID is the employee portal's route, not a customer
      // invoice view; #/estimate/ID is the public no-login pay/sign portal.
      const payLink = `${window.location.origin}${window.location.pathname}#/estimate/${newInv.id}`;
      if (c.email) {
        const html = emailShell(settings,subject, bodyHtml + emailButton("View & Pay Invoice", payLink));
        await withTimeout(sendOwnerGmailOnly(settings as any, c.email, subject, html), 10000, "Invoice email");
      } else {
        const smsBody = `Hi ${c.firstName}, your invoice for $${(Number(job.amount) || 0).toFixed(2)} is ready: ${payLink}`;
        await withTimeout(twilioSend(settings as any, c.phone!, smsBody), 10000, "Invoice SMS");
        logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone!, customerId: c.id, body: smsBody }).catch(() => {});
      }
      updateJob(jobId, { invoiceSentAt: today(), paymentType: "Invoice" as any, paymentStatus: job.paymentStatus === "Paid" ? job.paymentStatus : "Pending" as any });
      console.log("[SendInvoice] sent via", c.email ? "email" : "SMS", "to", c.firstName);
      toast(`Invoice sent to ${c.firstName} ✓`, "green");
      setShowInvoicePreview(false);
    } catch (err: any) {
      console.error("[SendInvoice] — error:", err?.message || err);
      toast(err?.message || "Failed to send invoice", "red");
    } finally {
      setSendingInvoice(false);
    }
  };

  // Owner in-person "Charge Card" checkout — manual card entry (Stripe
  // Elements Payment Element), no card-on-file required. Scoped to this
  // job's own linked invoice if one already exists (an Estimate row with
  // jobId === job.id and invoiced: true), otherwise just charges the job's
  // amount directly and marks the job paid. Mirrors markPaidViaStripe in
  // InvoicesPage.tsx.
  const linkedInvoice = (estimates || []).find((e: any) => e.jobId === jobId && e.invoiced);
  const chargeCardSuccess = async (paymentIntentId: string) => {
    updateJob(jobId, { paymentStatus: "Paid", paymentType: "Card" as any, amountCollected: Number(job.amount) || 0, stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" } as any);
    if (linkedInvoice) {
      setEstimates((prev: any[]) => prev.map(e => e.id === linkedInvoice.id ? { ...e, paidAt: today(), status: "approved", stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" as const } : e));
      (supabase as any).from("estimates").update({ paidAt: today(), status: "approved", stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" }).eq("id", linkedInvoice.id)
        .then(() => {}, (e: any) => console.warn("[ChargeCard] invoice sync failed:", e?.message));
    }
    setChargeCardOpen(false);
    toast("Payment received ✓", "green");
  };

  // BUG 16 — send a review request for a completed job. Links to the #/rate
  // page (4–5★ → Google review, 1–3★ → private feedback). Prefers SMS via
  // Twilio, falls back to email.
  const sendReviewRequest = async () => {
    const c = customers.find(x => x.id === job.customerId);
    if (!c) { toast("No customer on this job", "red"); return; }
    if (!c.phone && !c.email) { toast("No phone or email on file for this customer", "red"); return; }
    setSendingReview(true);
    try {
      const companyName = settings.companyName || "CRM Starter";
      const rateLink = `${window.location.origin}${window.location.pathname}#/rate?c=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.firstName)}&g=${encodeURIComponent(settings.googlePlaceId || "")}&rl=${encodeURIComponent((settings as any).googleReviewLink || "")}&co=${encodeURIComponent(companyName)}&gm=${encodeURIComponent(String((settings as any).reviewGoogleMinStars || 4))}`;
      if (settings.twilioSid && c.phone) {
        await withTimeout(twilioSend(settings as any, c.phone, `Hi ${c.firstName}, thanks for choosing ${companyName}! How did we do? ${rateLink}`), 10000, "Review SMS");
        logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: `Hi ${c.firstName}, thanks for choosing ${companyName}! How did we do? ${rateLink}` }).catch(() => {});
        updateJob(jobId, { reviewRequestedAt: today() } as any);
        console.log("[ReviewRequest] sent via SMS to", c.firstName);
        toast(`Review request sent to ${c.firstName} ✓`, "green");
      } else if (c.email) {
        // BLOCKER 4 (mobile round 9) — was sendEmail(), which docs/ARCHITECTURE.md flags
        // as the repeated-regression path (Resend fallback instead of the
        // owner's own Gmail); every other customer-facing send in the portal
        // already uses sendOwnerGmailOnly, this one hadn't been switched over.
        const html = emailShell(settings, "How did we do?", `<p>Hi ${c.firstName},</p><p>Thanks for choosing ${companyName}! We'd love your feedback on your recent service.</p>` + emailButton("Leave a Review", rateLink));
        await withTimeout(sendOwnerGmailOnly(settings as any, c.email, `How did we do, ${c.firstName}?`, html), 10000, "Review email");
        updateJob(jobId, { reviewRequestedAt: today() } as any);
        console.log("[ReviewRequest] sent via email to", c.firstName);
        toast(`Review request emailed to ${c.firstName} ✓`, "green");
      } else if (c.phone) {
        // No Twilio configured and no email on file — last resort: open the
        // owner's own SMS app prefilled. This has NOT actually sent anything
        // yet (the owner still has to hit send in their phone's app), so it
        // must not claim success the way the two branches above do.
        window.location.href = "sms:" + c.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(`Hi ${c.firstName}, how did we do? ${rateLink}`);
        updateJob(jobId, { reviewRequestedAt: today() } as any);
        console.log("[ReviewRequest] opened native SMS composer for", c.firstName, "(Twilio not configured)");
        toast(`Opening your texts to message ${c.firstName} — add Twilio in Settings to send automatically`, "yellow");
      }
    } catch (err: any) {
      console.error("[ReviewRequest] — error:", err?.message || err);
      toast(err?.message || "Failed to send review request", "red");
    } finally {
      setSendingReview(false);
    }
  };

  const notifyCrew = async () => {
    const crewEmps = (job.crew || []).map(id => employees.find(e => e.id === id)).filter(Boolean);
    const withEmail = crewEmps.filter(e => e.email);
    if (!withEmail.length) { toast("No crew members have email addresses set", "yellow"); return; }
    setNotifying(true);
    try {
      const c = customers.find(x => x.id === job.customerId);
      const jobLink = `${window.location.origin}${window.location.pathname}#/portal`;
      const sent = await notifyEmployees(
        withEmail,
        () => `Job Assignment — ${job.scheduledDate}`,
        emp => emailShell(settings,"Job Assignment", `<p>Hi ${emp.firstName},</p><p>You've been assigned to a job:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${c ? `<li><b>Customer:</b> ${c.firstName} ${c.lastName}</li>` : ""}</ul>` + emailButton("Open Crew Portal", jobLink))
      );
      toast(sent > 0 ? `Notified ${sent} crew member${sent !== 1 ? "s" : ""} ✓` : "Email send failed — check Gmail connection in Settings → Integrations", sent > 0 ? "green" : "red");
    } catch (err: any) {
      toast(err?.message || "Failed to notify crew", "red");
    } finally {
      setNotifying(false);
    }
  };

  const sendJobRequest = async () => {
    const emp = employees.find(e => e.id === requestEmpId);
    if (!emp) return;
    setRequestSending(true);
    try {
      if (!ownerId) {
        toast("Still finishing sign-in — wait a moment and try again", "red");
        setRequestSending(false);
        return;
      }
      const { data, error } = await insertJobRequestSafely({
        job_id: jobId,
        employee_id: requestEmpId,
        owner_id: ownerId,
        status: "pending",
        message: requestMsg.trim() || null,
      });
      if (!error && data) {
        // The save succeeded — the request is on the books regardless of whether
        // the notification email below succeeds, so the UI must reflect success
        // here and treat the email as best-effort, not a precondition.
        if (emp.email) {
          const reqUrl = `${window.location.origin}${window.location.pathname}#/portal?request=${data.id}`;
          const cust = customers.find((x: any) => x.id === job.customerId);
          try {
            await notifyEmployees(
              [emp],
              () => `Job Request — ${job.scheduledDate}`,
              () => emailShell(settings,"Job Request", `<p>Hi ${emp.firstName},</p><p>${requestMsg || "You have a new job request:"}</p>
                <ul>
                  <li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li>
                  <li><b>Address:</b> ${job.address}</li>
                  ${cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : ""}
                  ${job.amount ? `<li><b>Amount:</b> $${job.amount}</li>` : ""}
                </ul>
                <div style="text-align:center;margin:22px 0 4px">
                  <a href="${reqUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;margin-right:8px">✓ Accept Job</a>
                  <a href="${reqUrl}&action=deny" style="display:inline-block;background:#ffffff;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px">✗ Decline</a>
                </div>`)
            );
          } catch (err) {
            console.warn("Job request email notification failed — request still saved:", err);
          }
        }
        toast(`Request sent to ${emp.firstName} ✓`, "green");
        console.log("[Verify] requesting employees for jobs — working");
        setRequestOpenId(null);
        setRequestMsg("");
        setRequestEmpId("");
        fetchJobRequestStatuses();
      } else {
        toast("Request failed — run the job_requests SQL in Supabase first", "red");
        console.warn("[Verify] requesting employees for jobs — failed:", error?.message);
      }
    } catch (err: any) {
      toast(err?.message || "Error sending request", "red");
    } finally {
      setRequestSending(false);
    }
  };

  // Schedule & Notify — assigns crew immediately, attempts a Google Calendar event
  // on the employee's own calendar (only possible if they've connected Google and
  // their token has been persisted to Supabase), and sends a "you're scheduled"
  // email without requiring acceptance.
  const scheduleAndNotify = async () => {
    const emp = employees.find(e => e.id === scheduleEmpId);
    if (!emp) return;
    setScheduling(true);
    // The crew assignment and notification must complete even if Google Calendar
    // sync fails OR hangs (a 401 from an expired/disconnected employee token can
    // trigger an internal Supabase token-refresh attempt that itself stalls) —
    // a calendar problem should never leave this button stuck on "Scheduling…"
    // forever, and it should never block the actual crew save either.
    try {
      const crew = job.crew || [];
      if (!crew.includes(emp.id)) updateJob(jobId, { crew: [...crew, emp.id] });

      let calendarSynced = false;
      let calendarSkippedReason = "";
      if (job.scheduledDate) {
        try {
          const { data: empRow } = await withTimeout<any>(
            (supabase as any).from("employees").select("google_token, google_token_expires_at, google_refresh_token, autoSyncCalendar").eq("id", emp.id).maybeSingle(),
            6000, "Employee lookup"
          );
          let tok = empRow?.google_token;
          const validTok = tok && empRow?.google_token_expires_at && new Date(empRow.google_token_expires_at).getTime() > Date.now();
          // BUG FIX — "jobs aren't syncing to Google Calendar for employees
          // or owners." This required settings.googleBackendUrl to even
          // ATTEMPT a token refresh — but that field is a leftover from an
          // old separate-backend architecture this app doesn't use anymore
          // (see refreshEmpGoogleToken's own same-origin /api/google-refresh
          // fallback, which works fine with no backendUrl at all). Almost no
          // deployment has googleBackendUrl set, so this skipped the refresh
          // entirely for basically everyone — an access token expires after
          // ~1hr, so any sync attempt after that point silently fell through
          // to "not connected" even though the employee genuinely was.
          if (tok && !validTok && empRow?.google_refresh_token) {
            const refreshed = await refreshEmpGoogleToken(settings?.googleBackendUrl, empRow.google_refresh_token);
            if (refreshed?.token) {
              tok = refreshed.token;
              (supabase as any).from("employees").update({ google_token: refreshed.token, google_token_expires_at: new Date(refreshed.expiresAt).toISOString() }).eq("id", emp.id).then(() => {}, () => {});
            } else tok = null;
          } else if (!validTok) {
            tok = null;
          }
          if (tok && empRow?.autoSyncCalendar !== false) {
            const timeStr = job.scheduledTime || "09:00";
            const startDt = new Date(`${job.scheduledDate}T${timeStr}:00`);
            const endDt = new Date(startDt.getTime() + (Number(job.duration) || 2) * 3600000);
            const cust = customers.find(x => x.id === job.customerId);
            const custName = cust ? `${cust.firstName} ${cust.lastName}` : "Customer";
            // Race against a hard timeout so a hung token-refresh/API call can never
            // block this flow — 10s is generous for a real network round trip.
            const evId = await Promise.race([
              createGCalEventApi(tok, { title: `CRM Starter Job: ${custName}`, start: startDt.toISOString(), end: endDt.toISOString(), location: job.address, description: buildJobCalendarDescription(job, cust, `${window.location.origin}${window.location.pathname}#/portal?job=${encodeURIComponent(job.id)}`) }),
              new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Google Calendar sync timed out")), 10000)),
            ]);
            updateJob(jobId, { googleEventId: evId });
            calendarSynced = true;
          } else {
            calendarSkippedReason = empRow?.autoSyncCalendar === false ? "employee has auto-sync turned off" : "employee hasn't connected Google";
          }
        } catch (err) {
          console.warn("Google Calendar sync failed — continuing without it:", err);
          calendarSkippedReason = "calendar sync failed";
        }
      }

      const cust = customers.find(x => x.id === job.customerId);
      try {
        await notifyEmployees(
          [emp],
          () => `You've Been Scheduled — ${job.scheduledDate}`,
          () => emailShell(settings,"You've Been Scheduled", `<p>Hi ${emp.firstName},</p><p>You've been scheduled for a job — you're confirmed, no action needed:</p><ul><li><b>Date:</b> ${job.scheduledDate}${job.scheduledTime ? " at " + job.scheduledTime : ""}</li><li><b>Address:</b> ${job.address}</li>${cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : ""}</ul>${calendarSynced ? "<p>This has been added to your Google Calendar.</p>" : ""}`)
        );
      } catch (err) {
        console.warn("Schedule notification email failed — crew assignment still saved:", err);
      }

      if (calendarSynced) {
        toast(`${emp.firstName} scheduled & notified — calendar synced ✓`, "green");
      } else {
        toast(`Crew assigned! (Google Calendar sync skipped — ${calendarSkippedReason || "no Google token"})`, "yellow");
      }
      setShowScheduleForm(false);
      setScheduleEmpId("");
    } catch (err) {
      console.error("Error scheduling employee:", err);
      toast("Error scheduling employee", "red");
    } finally {
      setScheduling(false);
    }
  };

  // BLOCKER — adding a custom equipment/chemical here only ever wrote it onto
  // THIS job's own array. It displayed fine on this job (and in the employee
  // portal, which already reads job.equipment/job.requiredChemicals), but the
  // next job started from scratch with no memory of it — "custom equipment
  // saved for future jobs" never actually persisted anywhere reusable. A
  // brand-new value (not already in the preset list) now also gets appended
  // to settings so it shows up as a one-click preset button on every future
  // job, not just retyped each time. setSettings is optional (older callers
  // that haven't threaded it through yet) so this never throws either way.
  const toggleEquip = eq => {
    const list = job.equipment || [];
    const adding = !list.includes(eq);
    updateJob(jobId, { equipment: adding ? [...list, eq] : list.filter(x => x !== eq) });
    if (adding && !equipmentList.includes(eq) && setSettings) {
      setSettings((s: any) => (s.customEquipmentList || []).includes(eq) ? s : { ...s, customEquipmentList: [...(s.customEquipmentList || []), eq] });
    }
  };
  const toggleRequiredChemical = chem => {
    const list = job.requiredChemicals || [];
    const adding = !list.includes(chem);
    updateJob(jobId, { requiredChemicals: adding ? [...list, chem] : list.filter(x => x !== chem) });
    if (adding && !requiredChemicalsList.includes(chem) && setSettings) {
      setSettings((s: any) => (s.customChemicalsList || []).includes(chem) ? s : { ...s, customChemicalsList: [...(s.customChemicalsList || []), chem] });
    }
  };
  const toggleTag = t => {
    const tags = job.tags || [];
    updateJob(jobId, { tags: tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t] });
  };
  const addTag = () => {
    if (!tagInput.trim()) return;
    const tags = job.tags || [];
    if (tags.includes(tagInput.trim())) { setTagInput(""); return; }
    updateJob(jobId, { tags: [...tags, tagInput.trim()] });
    setTagInput("");
  };
  const removeTag = t => updateJob(jobId, { tags: (job.tags || []).filter(x => x !== t) });
  // BUG FIX — "work order attachments" used to be a fake feature: a
  // filename/type the owner typed in by hand, with a Download button that
  // literally just toasted "Would download <name>" — no real file ever
  // existed. Now uploads the real file to the same job-media Storage
  // bucket photos/videos already use, so employees can actually open a
  // real PDF/photo/video (e.g. a multi-page commercial job spec sheet).
  const handleAttFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttUploading(true);
    try {
      for (const file of Array.from(files)) {
        const kind = file.type === "application/pdf" ? "pdf" : file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "other";
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${jobId}/workorder-${uid()}-${safeName}`;
        const url = await uploadJobMedia(file, path, file.type);
        if (!url) { toast?.(`Failed to upload ${file.name} — Storage may not be set up yet`, "red"); continue; }
        const entry = { id: uid(), name: file.name, type: kind, url, size: file.size, uploadedAt: Date.now() };
        updateJob(jobId, { attachments: [...(job.attachments || []), entry] });
        toast?.(`${file.name} attached ✓`, "green");
      }
    } finally {
      setAttUploading(false);
      if (attFileInputRef.current) attFileInputRef.current.value = "";
    }
  };
  const removeAtt = (id: string) => {
    const target = (job.attachments || []).find((a: any) => a.id === id);
    updateJob(jobId, { attachments: (job.attachments || []).filter((a: any) => a.id !== id) });
    if (target?.url) deleteJobMediaByUrl([target.url]).catch(() => {});
  };
  // FIX 5 — Owner self-assign: when the owner (identified by the same
  // `owner_<email>` synthetic id the Crew toggle uses) is on this job's crew,
  // clocking in/out here also flips their employees row's dayClockInAt so they
  // show up in Live Crew View exactly like a technician on shift.
  // FIX 2/4 (mobile round 4) — this used to rebuild the id from
  // `settings.ownerName ? owner_${settings.googleEmail || "owner"} : null`,
  // which (a) went null for any owner who never opened Settings → Company to
  // set ownerName (e.g. a fresh Google OAuth signup), and (b) fell back to
  // the literal string "owner" instead of the real account email when
  // googleEmail wasn't set — producing "owner_owner", which never matches
  // the real `owner_<email>` row App.tsx's self-assign effect actually
  // creates. Read the real id straight off the owner's own employees row
  // instead of reconstructing it from settings, which can't go stale.
  const ownerEmployee = employees.find((e: any) => e.role === "owner");
  const ownerEmpId = ownerEmployee?.id || null;
  const ownerOnCrew = !!ownerEmpId && (job.crew || []).includes(ownerEmpId);
  const clockIn = () => {
    updateJob(jobId, { clockInAt: Date.now() });
    toast("Clocked in");
    // AUDIT FIX — missing the documented RLS 0-row-silent-success check
    // (docs/ARCHITECTURE.md): this could match 0 rows with no error at all, leaving
    // Live Team View silently disagreeing with what the owner sees here.
    // EmployeePortal.tsx's equivalent writes to this same field all check
    // this; this parallel owner-side path hadn't been brought up to match.
    if (ownerOnCrew) (supabase as any).from("employees").update({ dayClockInAt: Date.now() }).eq("id", ownerEmpId).select("id")
      .then((r: any) => {
        if (r?.error) { console.warn("[Payroll] owner dayClockInAt save failed:", r.error.message); toast("Clocked in locally, but failed to sync — " + r.error.message, "red"); }
        else if (!Array.isArray(r?.data) || r.data.length === 0) { console.warn("[Payroll] owner dayClockInAt update matched 0 rows for", ownerEmpId); toast("Clocked in locally, but the server didn't confirm — Live Crew View may not show you as on shift.", "red"); }
      })
      .catch((e: any) => console.warn("[Payroll] owner dayClockInAt save threw:", e?.message));
  };
  const clockOut = () => {
    const started = job.clockInAt;
    if (!started) return;
    const hrs = (Date.now() - started) / 3600000;
    const rounded = Math.round(hrs * 100) / 100;
    updateJob(jobId, { clockInAt: null, loggedHours: Math.round(((Number(job.loggedHours) || 0) + rounded) * 100) / 100 });
    toast("+" + rounded + "h logged");
    // AUDIT FIX — was only resetting dayClockInAt. Every EmployeePortal.tsx
    // end-of-shift write also resets dayLunchStartAt/dayPausedMinutes (the
    // same shift-timer fields, shared table) — leaving those behind here
    // means a lunch/pause value from today's shift corrupts tomorrow's
    // elapsed-time math (netSecs subtracts dayPausedMinutes from elapsed).
    // Also added the same 0-row check as clockIn above.
    if (ownerOnCrew) (supabase as any).from("employees").update({ dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0 }).eq("id", ownerEmpId).select("id")
      .then((r: any) => {
        if (r?.error) toast("Clocked out locally, but failed to sync — " + r.error.message, "red");
        else if (!Array.isArray(r?.data) || r.data.length === 0) toast("Clocked out locally, but the server didn't confirm — check your shift status.", "red");
      }, () => {});
  };
  // Same message/send pattern as EmployeePortal.tsx's sendOtw — SMS if the
  // customer has a phone (Twilio), otherwise Gmail (never Resend — docs/ARCHITECTURE.md
  // "Critical rules": field-portal-style customer notifications must use
  // sendOwnerGmailOnly).
  const sendOnMyWay = async () => {
    const cust = customers.find(x => x.id === job.customerId);
    setSendingOtw(true);
    const msg = `Hi ${cust?.firstName || "there"}, your ${settings?.companyName || "CRM Starter"} technician is on the way!`;
    try {
      if (cust?.phone) {
        await withTimeout(twilioSend(settings as any, cust.phone, msg), 15000, "OTW SMS");
        logOutboundSmsToInbox({ contactName: `${cust.firstName} ${cust.lastName}`, contactPhone: cust.phone, customerId: cust.id, body: msg }).catch(() => {});
      } else if (cust?.email) {
        const html = emailShell(settings, "On My Way", `<p>${msg}</p>`);
        await withTimeout(sendOwnerGmailOnly(settings as any, cust.email, "Your technician is on the way", html), 15000, "OTW email");
      } else {
        throw new Error("No phone or email on file for this customer.");
      }
      updateJob(jobId, { commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: today(), note: `📍 On my way message sent to ${cust?.firstName || "customer"}` }] });
      toast(`✅ Message sent to ${cust?.firstName || "customer"}`, "green");
    } catch (e: any) {
      toast(`❌ Failed to send — ${e?.message || "reason unknown"}`, "red");
    } finally {
      setSendingOtw(false);
    }
  };
  // "I'm Here" — internal arrival marker only (no customer message), same
  // as EmployeePortal.tsx's version: flips a scheduled job to in_progress
  // and feeds the Live Crew View's arrival-based status labels.
  const markArrived = () => {
    updateJob(jobId, { arrivedAt: Date.now(), status: job.status === "scheduled" ? "in_progress" : job.status });
    toast("📍 Marked arrived");
  };
  const sendRunningLateSingle = async () => {
    const minutesStr = window.prompt("How many minutes behind?", "15");
    if (!minutesStr) return;
    const minutes = Math.max(1, Math.round(Number(minutesStr) || 0));
    if (!minutes) return;
    const cust = customers.find(x => x.id === job.customerId);
    setSendingRunningLate(true);
    const newEta = new Date(Date.now() + minutes * 60000).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const msg = `Your ${settings?.companyName || "CRM Starter"} technician is running approximately ${minutes} minutes behind. New ETA: ${newEta}. We apologize for the delay.`;
    try {
      if (cust?.phone) {
        await withTimeout(twilioSend(settings as any, cust.phone, `Hi ${cust.firstName || ""}, ${msg}`), 15000, "Running late SMS");
        logOutboundSmsToInbox({ contactName: `${cust.firstName} ${cust.lastName}`, contactPhone: cust.phone, customerId: cust.id, body: `Hi ${cust.firstName || ""}, ${msg}` }).catch(() => {});
      } else if (cust?.email) {
        const html = emailShell(settings, "Running Late", `<p>Hi ${cust.firstName || ""},</p><p>${msg}</p>`);
        await withTimeout(sendOwnerGmailOnly(settings as any, cust.email, "Your technician is running late", html), 15000, "Running late email");
      } else {
        throw new Error("No phone or email on file for this customer.");
      }
      const newScheduledTime = (() => {
        if (!job.scheduledTime) return undefined;
        const [h, m] = job.scheduledTime.split(":").map(Number);
        const d = new Date(); d.setHours(h, m + minutes, 0, 0);
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      })();
      updateJob(jobId, {
        commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: today(), note: `⏱ Running late +${minutes}min — notified customer` }],
        ...(newScheduledTime ? { scheduledTime: newScheduledTime } : {}),
      });
      toast(`✅ Notified ${cust?.firstName || "customer"} — running ${minutes}min late`, "green");
    } catch (e: any) {
      toast(`❌ Failed to send — ${e?.message || "reason unknown"}`, "red");
    } finally {
      setSendingRunningLate(false);
    }
  };
  const handleGoogleSync = async () => {
    if (!gToken || !job.scheduledDate) { toast("Add a scheduled date first"); return; }
    setGSyncing(true);
    try {
      const timeStr = job.scheduledTime || "09:00";
      const startDt = new Date(`${job.scheduledDate}T${timeStr}:00`);
      const endDt = new Date(startDt.getTime() + (Number(job.duration) || 2) * 3600000);
      const customer = customers.find((x: any) => x.id === job.customerId);
      const calCoName = settings?.companyName || "CRM Starter";
      const title = customer ? `${customer.firstName} ${customer.lastName} — ${calCoName} Service` : `${calCoName} Service`;
      // FEATURE — "a clickable link to the employee portal (or, if it's an
      // owner working, to the owner job) — whichever crew member actually
      // needs to open this from the calendar." A real employee (not just
      // the owner) on the crew gets the field-portal deep link; otherwise
      // (owner working it themselves, no crew yet) it points at the
      // owner's own Jobs page.
      const hasEmployeeCrew = (job.crew || []).some((id: any) => {
        const emp = employees.find((e: any) => e.id === id || e.user_id === id);
        return emp && emp.role !== "owner";
      });
      const description = hasEmployeeCrew
        ? buildJobCalendarDescription(job, customer, `${window.location.origin}${window.location.pathname}#/portal?job=${encodeURIComponent(job.id)}`, "View job in Crew Portal")
        : buildJobCalendarDescription(job, customer, `${window.location.origin}${window.location.pathname}#/jobs?open=${encodeURIComponent(job.id)}`);
      if (job.googleEventId) {
        await updateGCalEventApi(gToken, job.googleEventId, { title, start: startDt.toISOString(), end: endDt.toISOString(), location: job.address, description });
        toast("Google Calendar event updated ✓");
      } else {
        const evId = await createGCalEventApi(gToken, { title, start: startDt.toISOString(), end: endDt.toISOString(), location: job.address, description });
        updateJob(jobId, { googleEventId: evId });
        toast("Synced to Google Calendar ✓");
      }
    } catch {
      toast("Google sync failed — check connection");
    }
    setGSyncing(false);
  };

  const addComm = () => {
    if (!commNote.trim()) return;
    const entry = { id: uid(), type: commType, date: today(), note: commNote.trim() };
    updateJob(jobId, { commLog: [...(job.commLog || []), entry] });
    setCommNote("");
  };
  const addChem = () => {
    if (!chemName.trim()) return;
    const entry = { name: chemName, gallons: Number(chemGal), cost: Number(chemCost) };
    updateJob(jobId, { chemicalsUsed: [...(job.chemicalsUsed || []), entry] });
    setChemName(""); setChemGal(0); setChemCost(0);
  };
  const removeChem = idx => updateJob(jobId, { chemicalsUsed: (job.chemicalsUsed || []).filter((_, i) => i !== idx) });

  const updateChecklist = (field: "preChecklist" | "duringChecklist" | "postChecklist", items: JobChecklistItem[]) =>
    updateJob(jobId, { [field]: items });

  // FEATURE — "assign specific checklist items to specific employees."
  // The crew currently on this job, resolved to real names, for the
  // per-item assignee picker in ChecklistSection above.
  const checklistCrewOptions = (Array.isArray(job.crew) ? job.crew : [])
    .map((c: any) => {
      const id = typeof c === "string" ? c : (c?.id ?? c?.employeeId ?? c?.employee_id ?? c?.user_id ?? "");
      const emp = employees.find((e: any) => e.id === id || e.user_id === id);
      return emp ? { id: emp.id, name: `${emp.firstName} ${emp.lastName}`.trim() } : null;
    })
    .filter(Boolean) as { id: string; name: string }[];

  const openSignOff = () => {
    setSignerName(job.signOff?.signerName || "");
    setShowSignOff(true);
  };

  const saveSignOff = () => {
    if (!signerName.trim()) { toast("Please enter customer name"); return; }
    const ts = new Date().toLocaleString();
    updateJob(jobId, { signOff: { signerName: signerName.trim(), timestamp: ts } });
    toast("Sign-off saved");
    printSignOff(signerName.trim(), ts);
  };

  const printSignOff = (name: string, ts: string) => {
    const customer = customers.find(x => x.id === job.customerId);
    const beforePhoto = (job.photos || []).find(p => p.type === "before" && (p.url || p.dataUrl));
    const afterPhoto = (job.photos || []).find(p => p.type === "after" && (p.url || p.dataUrl));
    const preItems = job.preChecklist || PRE_DEFAULTS;
    const postItems = job.postChecklist || POST_DEFAULTS;
    const preIssues = preItems.filter(i => i.notes).map(i => `<li>${i.label}: ${i.notes}</li>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Job Sign-Off</title>
<style>
  body { font-family: Arial, sans-serif; max-width: 700px; margin: 40px auto; color: #111; font-size: 14px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
  .section { margin-bottom: 20px; }
  .section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 10px; }
  .photos { display: flex; gap: 16px; margin-bottom: 16px; }
  .photos img { width: 48%; border-radius: 8px; border: 1px solid #ddd; }
  .photo-label { font-size: 10px; text-align: center; color: #888; margin-top: 4px; }
  .disclaimer { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 14px; font-size: 12px; color: #444; line-height: 1.6; }
  .sig-block { margin-top: 24px; border-top: 2px solid #111; padding-top: 16px; }
  .sig-name { font-size: 20px; font-family: Georgia, serif; margin-bottom: 4px; }
  .sig-ts { font-size: 11px; color: #888; }
  .checklist { list-style: none; padding: 0; }
  .checklist li { padding: 3px 0; font-size: 13px; }
  .checklist li.done::before { content: "✓ "; color: green; font-weight: bold; }
  .checklist li.undone::before { content: "○ "; color: #ccc; }
</style></head><body>
<h1>Service Completion Sign-Off</h1>
<div class="sub">Generated ${ts}</div>
<div class="section">
  <h2>Customer & Job Details</h2>
  <p><strong>Customer:</strong> ${customer ? customer.firstName + " " + customer.lastName : "N/A"}</p>
  <p><strong>Address:</strong> ${job.address || "N/A"}</p>
  <p><strong>Service Date:</strong> ${job.scheduledDate || "N/A"}</p>
  <p><strong>Total Amount:</strong> $${(job.amount || 0).toFixed(2)}</p>
  <p><strong>Payment:</strong> ${job.paymentType || "N/A"} · ${job.paymentStatus || "Pending"}</p>
</div>
${(beforePhoto || afterPhoto) ? `<div class="section">
  <h2>Before &amp; After Photos</h2>
  <div class="photos">
    ${beforePhoto ? `<div><img src="${mediaSrc(beforePhoto.url, beforePhoto.dataUrl)}" alt="Before"/><div class="photo-label">BEFORE</div></div>` : ""}
    ${afterPhoto ? `<div><img src="${mediaSrc(afterPhoto.url, afterPhoto.dataUrl)}" alt="After"/><div class="photo-label">AFTER</div></div>` : ""}
  </div>
</div>` : ""}
<div class="section">
  <h2>Post-Job Checklist</h2>
  <ul class="checklist">
    ${postItems.map(i => `<li class="${i.done ? "done" : "undone"}">${i.label}${i.notes ? ` — <em>${i.notes}</em>` : ""}</li>`).join("")}
  </ul>
</div>
${preIssues ? `<div class="section"><h2>Pre-Existing Conditions Noted</h2><ul>${preIssues}</ul></div>` : ""}
${job.notes ? `<div class="section"><h2>Job Notes</h2><p>${job.notes}</p></div>` : ""}
<div class="section">
  <h2>Legal Disclaimer</h2>
  <div class="disclaimer">
    I confirm that all services have been completed to my satisfaction. I accept the work as described above and acknowledge that the service provider is not liable for pre-existing conditions documented in the pre-job checklist. By signing below, I authorize payment of the amount stated and release the company from further obligation for this service call.
  </div>
</div>
<div class="sig-block">
  <div class="sig-name">${name}</div>
  <div class="sig-ts">Signed: ${ts}</div>
  <div style="margin-top:12px;font-size:11px;color:#aaa;">Digital signature — customer typed and confirmed their full name</div>
</div>
</body></html>`;
    const w = window.open("", "_blank", "width=800,height=900");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const totalChemCost = (job.chemicalsUsed || []).reduce((s, c) => s + Number(c.cost), 0);
  const totalGallons = (job.chemicalsUsed || []).reduce((s, c) => s + Number(c.gallons), 0);

  // Timer display
  const liveHrs = job.clockInAt ? (Date.now() - job.clockInAt) / 3600000 : 0;
  const liveDisplay = (() => {
    const total = Math.floor(liveHrs * 3600);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map(n => String(n).padStart(2, "0")).join(":");
  })();

  const attIcon = t => t === "image" ? "🖼️" : t === "pdf" ? "📄" : "📎";

  return (
    <Modal open={!!jobId} onClose={onClose} title={"Job · " + (c?.firstName + " " + c?.lastName)} maxW="max-w-2xl">
      <div className="space-y-4">
        {job.address && <StreetViewThumb address={job.address} apiKey={settings.googleMapsKey || settings.mapsKey} />}

        {/* FIX 5 — customer + job summary, always visible at the top: name,
            phone, address, and the estimate/quote amount, none of which the
            modal surfaced before (the title only showed the customer's name). */}
        <Glass className="p-3 !bg-black/40 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold text-sm truncate">{c ? `${c.firstName} ${c.lastName}` : "Unknown customer"}</div>
            {job.amount > 0 && (() => {
              // FEATURE 7 — show the discounted total up top too, not just
              // down in the Discounts section, so it's visible at a glance.
              const discTotal = computeDiscountsTotal(job.discounts, Number(job.amount) || 0);
              return discTotal > 0 ? (
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-white/30 line-through">{fmt(job.amount)}</div>
                  <div className="text-lg font-bold text-green-400">{fmt(Math.max(0, job.amount - discTotal))}</div>
                </div>
              ) : <div className="text-lg font-bold text-green-400 flex-shrink-0">{fmt(job.amount)}</div>;
            })()}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
            {c?.phone && (
              <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-white transition"><Phone size={11} />{c.phone}</a>
            )}
            {c?.email && (
              <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-white transition"><Mail size={11} />{c.email}</a>
            )}
            {!c?.phone && !c?.email && <span className="italic text-white/30">No contact info on file</span>}
          </div>
          {job.address && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition">
              <MapPin size={11} />{job.address}
            </a>
          )}
        </Glass>

        {/* Priority + Duration + Recurring + Job Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><AlertCircle size={10} />Priority</label>
            <GSel value={job.priority || "normal"} onChange={e => updateJob(jobId, { priority: e.target.value })}>
              {priorityLevels.map(p => <option key={p.key} value={p.key} className="bg-black">{p.label}</option>)}
            </GSel>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Est. Duration (hrs)</label><GInput type="number" step="0.25" value={job.duration || ""} onChange={e => updateJob(jobId, { duration: e.target.value })} placeholder="e.g. 3.5" /></div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Recurring</label>
            <label className="flex items-center gap-2 h-[34px] px-1 cursor-pointer">
              <input type="checkbox" checked={!!job.isRecurring} onChange={e => updateJob(jobId, { isRecurring: e.target.checked, recurringMode: job.recurringMode || "preset", recurringFreq: job.recurringFreq || "monthly" })} className="accent-brand-600 w-3.5 h-3.5" />
              <span className="text-xs text-white/70">This job repeats</span>
            </label>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Job Type <span className="text-white/30">(drives crew pay rate)</span></label>
            <GSel value={job.jobType || "residential"} onChange={e => updateJob(jobId, { jobType: e.target.value as any })}>
              <option value="residential" className="bg-black">Residential</option>
              <option value="commercial" className="bg-black">Commercial</option>
            </GSel>
          </div>
        </div>

        {/* FEATURE — "when scheduling or editing a job, you should be able
            to edit the service items — change the price, change if it's a
            which service it is, or add-on additional services." Jobs
            previously had no editable price or service selection at all
            (only estimates did) — amount was a flat number set once at
            creation, and there was no concept of "which service(s)" beyond
            the residential/commercial Job Type above. Price stays directly
            editable by hand; the service checklist is an optional helper
            that sums the Settings → Service Catalog prices for whichever
            services are checked, for owners who'd rather build the price
            from services than type a number. */}
        <div className="p-3 rounded-xl border border-white/10 bg-black/20 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <label className="text-xs text-white/60 flex-shrink-0">Price</label>
            <div className="flex items-center gap-2">
              <GInput type="number" step="0.01" value={job.amount ?? ""} onChange={e => updateJob(jobId, { amount: Number(e.target.value) || 0 })} placeholder="0.00" className="!w-32 !text-right" />
            </div>
          </div>
          {services.length > 0 && (
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider font-semibold mb-1.5">Services (optional — check to add on, then Recalculate)</div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {services.map((s: any) => {
                  const selected = (job.serviceIds || []).includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        const current: string[] = job.serviceIds || [];
                        const next = selected ? current.filter(id => id !== s.id) : [...current, s.id];
                        if (!selected) {
                          const newItems = buildChecklistFromServices([{ serviceId: s.id }], services);
                          if (newItems.length > 0) {
                            const existingLabels = new Set((job.preChecklist || []).map((c: any) => (c.label || "").trim().toLowerCase()));
                            const toAdd = newItems.filter(it => !existingLabels.has(it.label.trim().toLowerCase()));
                            if (toAdd.length > 0) {
                              updateJob(jobId, { serviceIds: next, preChecklist: [...(job.preChecklist || []), ...toAdd] });
                              toast?.(`Added ${toAdd.length} checklist item${toAdd.length > 1 ? "s" : ""} from ${s.name} ✓`);
                              return;
                            }
                          }
                        }
                        updateJob(jobId, { serviceIds: next });
                      }}
                      className={"px-2.5 py-1 rounded-full text-xs border transition " + (selected ? "bg-brand-900/40 border-brand-600/50 text-brand-200" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80")}
                    >
                      {s.name} · {fmt(s.basePrice || 0)}
                    </button>
                  );
                })}
              </div>
              {(job.serviceIds || []).length > 0 && (
                <button
                  onClick={() => {
                    const total = (job.serviceIds || []).reduce((sum: number, id: string) => sum + (services.find((s: any) => s.id === id)?.basePrice || 0), 0);
                    updateJob(jobId, { amount: total });
                    toast?.("Price recalculated from selected services ✓");
                  }}
                  className="text-[11px] text-brand-400 hover:text-brand-300"
                >
                  Recalculate price from selected services →
                </button>
              )}
            </div>
          )}
        </div>

        {/* FEATURE 3 — customizable recurring schedule. recurringMode picks
            which shape applies; computeNextRecurringDate (lib/utils.ts) is the
            single shared calculation both this owner-side modal's preview AND
            the actual next-job auto-scheduling (JobsPage.tsx + EmployeePortal.tsx
            Complete handlers) use, so the date shown here can never disagree
            with the date that's actually scheduled. */}
        {job.isRecurring && (
          <div className="p-3 rounded-xl border border-blue-700/30 bg-blue-950/10 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-300"><Repeat size={12} />Repeat Schedule</div>
            <GSel value={job.recurringMode || "preset"} onChange={e => updateJob(jobId, { recurringMode: e.target.value as any })}>
              <option value="preset" className="bg-black">Preset (weekly, monthly, etc.)</option>
              <option value="days" className="bg-black">Every X days</option>
              <option value="weeks" className="bg-black">Every X weeks</option>
              <option value="months" className="bg-black">Every X months</option>
              <option value="weekdays" className="bg-black">Specific days of week</option>
            </GSel>

            {(!job.recurringMode || job.recurringMode === "preset") && (
              <GSel value={job.recurringFreq || "monthly"} onChange={e => updateJob(jobId, { recurringFreq: e.target.value })}>
                {recurringFreqs.map(f => <option key={f.key} value={f.key} className="bg-black">{f.label}</option>)}
              </GSel>
            )}

            {(job.recurringMode === "days" || job.recurringMode === "weeks" || job.recurringMode === "months") && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">Every</span>
                <GInput type="number" min="1" step="1" value={job.recurringInterval || 1} onChange={e => updateJob(jobId, { recurringInterval: Math.max(1, Number(e.target.value) || 1) })} className="!w-20" />
                <span className="text-xs text-white/50">{job.recurringMode}</span>
              </div>
            )}

            {job.recurringMode === "weekdays" && (
              <div className="flex flex-wrap gap-1.5">
                {weekdayLabels.map((lbl, i) => {
                  const active = (job.recurringWeekdays || []).includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const cur: number[] = job.recurringWeekdays || [];
                        const next = active ? cur.filter((d: number) => d !== i) : [...cur, i].sort();
                        updateJob(jobId, { recurringWeekdays: next });
                      }}
                      className={"px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition " + (active ? "bg-brand-600 border-brand-500 text-brand-fg" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="text-[10px] text-white/40">Next occurrence after this one: {computeNextRecurringDate(job, job.scheduledDate)}</div>
          </div>
        )}

        {/* FEATURE 7 — manual discounts on this job, each with its own
            title/description and $ or %, stackable. Job.amount stays the
            list price; computeDiscountsTotal (lib/utils.ts) is the same
            shared calculation EstimateBuilder/EstimatePreview use. */}
        <div className="p-3 rounded-xl border border-white/10 bg-black/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5"><Percent size={12} />Discounts</div>
            <button
              type="button"
              onClick={() => updateJob(jobId, { discounts: [...(job.discounts || []), { id: uid(), label: "", type: "amount", value: 0 }] })}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <Plus size={11} />Add Discount
            </button>
          </div>
          {(job.discounts || []).map((d: any) => (
            <div key={d.id} className="flex items-center gap-2">
              <GInput
                value={d.label}
                onChange={e => updateJob(jobId, { discounts: (job.discounts || []).map((x: any) => x.id === d.id ? { ...x, label: e.target.value } : x) })}
                placeholder="e.g. Veteran discount"
                className="!text-xs flex-1 min-w-0"
              />
              <GSel
                value={d.type}
                onChange={e => updateJob(jobId, { discounts: (job.discounts || []).map((x: any) => x.id === d.id ? { ...x, type: e.target.value } : x) })}
                className="!text-xs !w-20 flex-shrink-0"
              >
                <option value="amount" className="bg-black">$</option>
                <option value="percent" className="bg-black">%</option>
              </GSel>
              <GInput
                type="number"
                step={d.type === "percent" ? "1" : "0.01"}
                value={d.value}
                onChange={e => updateJob(jobId, { discounts: (job.discounts || []).map((x: any) => x.id === d.id ? { ...x, value: Number(e.target.value) || 0 } : x) })}
                className="!text-xs !w-24 flex-shrink-0"
              />
              <button
                type="button"
                onClick={() => updateJob(jobId, { discounts: (job.discounts || []).filter((x: any) => x.id !== d.id) })}
                className="p-1.5 text-white/30 hover:text-brand-400 flex-shrink-0"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {(job.discounts || []).length === 0 && <div className="text-[10px] text-white/30">No discounts on this job</div>}
          {(job.discounts || []).length > 0 && (() => {
            const discTotal = computeDiscountsTotal(job.discounts, Number(job.amount) || 0);
            return (
              <div className="text-[10px] text-green-400 pt-1 border-t border-white/5">
                Total discount: − {fmt(discTotal)} · Amount after discount: {fmt(Math.max(0, (Number(job.amount) || 0) - discTotal))}
              </div>
            );
          })()}
        </div>

        {/* FIX 10 — effective pay rate for each crew member on THIS job's type */}
        {(job.crew || []).length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-green-400/80 -mt-1">
            {(job.crew || []).map((empId: string) => {
              const emp = employees.find((e: any) => e.id === empId);
              if (!emp) return null;
              const rate = getEffectiveRate(emp, job);
              return <span key={empId} className="flex items-center gap-1"><DollarSign size={10} />{emp.firstName}: {fmt(rate)}/hr</span>;
            })}
          </div>
        )}

        {/* Time Tracking */}
        <Glass className={"p-3 " + (job.clockInAt ? "!bg-green-950/20 !border-green-600/40" : "!bg-black/40")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={"p-2 rounded-lg " + (job.clockInAt ? "bg-green-900/40 animate-pulse" : "bg-white/5")}><Clock size={14} className={job.clockInAt ? "text-green-400" : "text-white/60"} /></div>
              <div>
                <div className="text-xs text-white/60 uppercase tracking-wider">Time Tracking</div>
                <div className="text-sm flex items-center gap-1.5">
                  {job.clockInAt ? <span className="font-mono text-green-400 text-base font-bold">{liveDisplay}</span> : (
                    <span className="text-white/50 flex items-center gap-1">
                      Logged:
                      {/* Owner-editable — loggedHours was previously read-only
                          text, set only by the Clock In/Out toggle below. If
                          an employee forgets to clock out (or clocks out
                          late) the resulting hours are wrong with no way to
                          correct them short of editing the raw DB row. */}
                      <input
                        type="number" min="0" step="0.25"
                        defaultValue={job.loggedHours || 0}
                        key={job.loggedHours}
                        onBlur={e => {
                          const next = Math.max(0, Number(e.target.value) || 0);
                          if (next !== (job.loggedHours || 0)) { updateJob(jobId, { loggedHours: next }); toast?.("Logged hours updated ✓", "green"); }
                        }}
                        className="w-14 text-white font-semibold bg-transparent border-b border-white/20 focus:border-brand-500/60 focus:outline-none text-center"
                      />h
                    </span>
                  )}
                  {!job.clockInAt && job.duration && <span className="text-white/40"> · est {job.duration}h</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {ownerEmpRow && (
                <button
                  onClick={toggleOwnerLocationSharing}
                  disabled={ownerLocSharingPending}
                  title="Share your location with your own Live Team/Crew View"
                  className={"flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition disabled:opacity-50 " + (ownerLocationSharing ? "bg-blue-900/40 border-blue-600/40 text-blue-300" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80")}
                >
                  {ownerLocSharingPending
                    ? <div className="w-2.5 h-2.5 border border-white/40 border-t-transparent rounded-full animate-spin" />
                    : <MapPin size={11} />}
                  {ownerLocationSharing ? "📍 Sharing" : "Share Location"}
                </button>
              )}
              {job.clockInAt ? <GBtn variant="danger" onClick={clockOut} className="!text-xs">Clock Out</GBtn> : <GBtn onClick={clockIn} className="!text-xs"><Play size={10} className="inline mr-1" />Clock In</GBtn>}
            </div>
          </div>
        </Glass>

        {/* Field Actions — On My Way / I'm Here / Running Late, same as the
            employee portal, for when the owner is working this job themselves. */}
        {job.status !== "completed" && job.status !== "cancelled" && (
          <div className="grid grid-cols-3 gap-2">
            <button onClick={sendOnMyWay} disabled={sendingOtw} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-blue-950/20 border border-blue-800/30 text-blue-300 hover:bg-blue-900/30 transition text-[11px] disabled:opacity-50">
              <Navigation size={14} />{sendingOtw ? "Sending…" : "On My Way"}
            </button>
            <button onClick={markArrived} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-green-950/20 border border-green-800/30 text-green-300 hover:bg-green-900/30 transition text-[11px]">
              <MapPin size={14} />{job.arrivedAt ? "Arrived ✓" : "I'm Here"}
            </button>
            <button onClick={sendRunningLateSingle} disabled={sendingRunningLate} className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl bg-yellow-950/20 border border-yellow-800/30 text-yellow-300 hover:bg-yellow-900/30 transition text-[11px] disabled:opacity-50">
              <Clock size={14} />{sendingRunningLate ? "Sending…" : "Running Late"}
            </button>
          </div>
        )}

        {/* Payment status + Send Invoice — only once the job is actually done */}
        {job.status === "completed" && (
          <Glass className={"p-3 flex items-center justify-between gap-3 " + (job.paymentStatus === "Paid" ? "!bg-green-950/15 !border-green-700/30" : "!bg-yellow-950/15 !border-yellow-700/30")}>
            <div className="text-xs text-white/60">
              <div className={"font-semibold mb-0.5 " + (job.paymentStatus === "Paid" ? "text-green-300" : "text-yellow-300")}>
                {job.paymentStatus === "Paid" ? `Paid (${job.paymentType || "Cash"})` : job.paymentType === "Invoice" || job.invoiceSentAt ? "Unpaid — Invoice Sent" : "Unpaid"}
              </div>
              {job.amountCollected ? `${job.amountCollected} collected` : "Email the customer an invoice with a payment link — full, deposit, or remaining balance."}
            </div>
            {job.paymentStatus !== "Paid" && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 flex-shrink-0">
                {/* FEATURE — owner in-person checkout for self-assigned jobs.
                    No permission gate (the owner isn't subject to
                    can_process_payments — that's for employees). Manual card
                    entry via Stripe Elements, same StripePaymentModal
                    component InvoicesPage.tsx uses for "Pay Now (in-app)". */}
                {!!settings?.stripePublishableKey && c && (
                  <GBtn onClick={() => setChargeCardOpen(true)} className="!text-xs !py-1.5 !bg-gradient-to-r !from-[#635BFF] !to-[#4F46E5] !border-[#635BFF]/50">
                    <CreditCard size={11} className="inline mr-1" />Charge Card
                  </GBtn>
                )}
                <GSel value="" onChange={e => { if (e.target.value) updateJob(jobId, { paymentStatus: "Paid", paymentType: e.target.value as any, amountCollected: Number(job.amount) || 0 }); }} className="!text-xs !py-1.5 !w-28">
                  <option value="" className="bg-black">Mark Paid…</option>
                  {["Cash", "Check", "Card", "Zelle", "Venmo"].map(m => <option key={m} value={m} className="bg-black">{m}</option>)}
                </GSel>
                <GBtn onClick={sendInvoice} disabled={sendingInvoice} className="!text-xs !py-1.5">
                  {sendingInvoice ? "Sending…" : <><Send size={11} className="inline mr-1" />Send Invoice</>}
                </GBtn>
              </div>
            )}
          </Glass>
        )}

        {/* Send Review Request — completed jobs only (BUG 16) */}
        {job.status === "completed" && (
          <Glass className="p-3 flex items-center justify-between gap-3 !bg-purple-950/15 !border-purple-700/30">
            <div className="text-xs text-white/60">
              <div className="font-semibold mb-0.5 text-purple-300 flex items-center gap-1"><Star size={11} />Review Request</div>
              {(job as any).reviewRequestedAt ? `Sent ${(job as any).reviewRequestedAt}` : "Ask the customer for a review — 4–5★ routes to Google, low ratings stay private."}
              {(job as any).skipReviewRequest && !(job as any).reviewRequestedAt && (
                <div className="text-[10px] text-yellow-400 mt-1">⚠ The crew flagged this job to skip the automated review request — sending here still works if you want to override that.</div>
              )}
            </div>
            <GBtn onClick={sendReviewRequest} disabled={sendingReview} className="!text-xs !py-1.5 flex-shrink-0">
              {sendingReview ? "Sending…" : <><Star size={11} className="inline mr-1" />Send Review Request</>}
            </GBtn>
          </Glass>
        )}

        {/* Google Calendar Sync */}
        {gToken && (
          <div className={"flex items-center justify-between p-3 rounded-xl border " + (job.googleEventId ? "bg-green-950/20 border-green-700/40" : "bg-white/5 border-white/10")}>
            <div className="flex items-center gap-2">
              <Globe size={14} className={job.googleEventId ? "text-green-400" : "text-white/50"} />
              <div>
                <div className="text-xs font-medium">{job.googleEventId ? "Synced to Google Calendar" : "Google Calendar Sync"}</div>
                {job.googleEventId && <div className="text-[10px] text-green-400/70">Event ID: {job.googleEventId.slice(0, 12)}…</div>}
              </div>
            </div>
            <GBtn onClick={handleGoogleSync} disabled={gSyncing} className={"!text-xs !py-1.5 " + (job.googleEventId ? "!bg-green-900/40 !border-green-700/50 !text-green-300 hover:!bg-green-800/50" : "")}>
              {gSyncing ? "Syncing…" : job.googleEventId ? "↻ Update" : "☁ Sync"}
            </GBtn>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Tag size={10} />Tags</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {jobTagOptions.map(t => {
              const sel = (job.tags || []).includes(t);
              return <button key={t} onClick={() => toggleTag(t)} className={"text-[10px] px-2.5 py-1 rounded-full border transition " + (sel ? "bg-brand-900/40 border-brand-500/50 text-brand-300" : "bg-white/5 border-white/10 text-white/50 hover:text-white")}>{t}</button>;
            })}
          </div>
          {(job.tags || []).filter(t => !jobTagOptions.includes(t)).length > 0 && <div className="flex gap-1 flex-wrap mb-2">
            {(job.tags || []).filter(t => !jobTagOptions.includes(t)).map(t => <span key={t} className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/40 text-blue-300">{t}<button onClick={() => removeTag(t)} className="hover:text-danger-400"><X size={8} /></button></span>)}
          </div>}
          <div className="flex gap-2">
            <GInput placeholder="Custom tag..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} className="!py-1.5 !text-xs" />
            <GBtn onClick={addTag} className="!py-1.5 !px-3"><Plus size={12} /></GBtn>
          </div>
        </div>

        {/* Crew */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-white/60 flex items-center gap-1"><Users size={10} />Crew</label>
            <div className="flex items-center gap-1.5">
              {(job.crew || []).length > 0 && (
                <button onClick={notifyCrew} disabled={notifying}
                  className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/30 text-blue-400 hover:text-blue-300 transition disabled:opacity-50">
                  <Mail size={9} />{notifying ? "Sending…" : "Notify"}
                </button>
              )}
              <button onClick={() => setShowScheduleForm(s => !s)}
                className="text-[10px] flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-700/30 text-purple-300 hover:text-purple-200 transition">
                <Calendar size={9} />Schedule & Notify
              </button>
            </div>
          </div>
          {/* FIX 6 — the toggle pills below already removed someone on a second
              click, but nothing signaled that a red/selected pill WAS a
              "click to remove" control — from the owner's side this read as
              "no way to unschedule/remove crew." An explicit "Assigned Crew"
              row with a literal X button makes removal a discoverable, named
              action distinct from the "pick more crew" pills underneath. */}
          {(job.crew || []).length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Assigned Crew</div>
              <div className="flex gap-1.5 flex-wrap">
                {(job.crew || []).map((eid: string) => {
                  const emp = eid === ownerEmpId ? ownerEmployee : employees.find(e => e.id === eid);
                  if (!emp) return null;
                  return (
                    <span key={eid} className="inline-flex items-center gap-1.5 text-xs pl-3 pr-1.5 py-1.5 rounded-lg border bg-brand-900/40 border-brand-500/50 text-brand-300">
                      {emp.firstName} {emp.lastName}{eid === ownerEmpId ? " (Owner)" : ""}
                      <button onClick={() => toggleCrew(eid)} title={`Remove ${emp.firstName} from this job`}
                        className="p-0.5 rounded hover:bg-brand-800/60 text-brand-300 hover:text-white transition">
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{(job.crew || []).length > 0 ? "Add More" : "Assign Crew"}</div>
          <div className="flex flex-wrap gap-1.5">
            {/* Owner self-assign — uses the same ownerEmployee/ownerEmpId
                derived above (from the real employees row, not settings) so
                this button doesn't silently disappear for an owner who never
                set settings.ownerName. Owner isn't request-able (there's no
                one else to accept/decline on their behalf), so just Assign. */}
            {ownerEmployee && !(job.crew || []).includes(ownerEmpId) && (
              <button key="owner" onClick={() => toggleCrew(ownerEmpId)}
                className="text-xs px-3 py-1.5 rounded-lg border transition bg-white/5 border-white/10 text-white/60 hover:text-white">
                {ownerEmployee.firstName} {ownerEmployee.lastName} (Owner)
              </button>
            )}
          </div>
          {/* ITEM (edit-mode parity) — was one button per employee (click =
              instant assign), with requesting only reachable via a separate
              global "Request" button + single-select dropdown above. Each
              not-yet-crewed employee now gets its own Assign / Request pair,
              matching the new-job form's per-employee toggle — you can assign
              one and request another on the same existing job, individually.
              role !== "owner" — the owner already has their own dedicated
              button above. Already-assigned crew are excluded here too —
              removal happens via the explicit X in "Assigned Crew" above. */}
          <div className="space-y-1.5 mt-1.5">
            {employees.filter(e => e.status === "active" && e.role !== "owner" && !(job.crew || []).includes(e.id)).map(e => {
              // FEATURE 5 — flag unavailable crew right on the assignment
              // button, covering both specific blocked dates and recurring
              // weekday-offs.
              const unavail = job.scheduledDate && isEmployeeUnavailable(e as any, job.scheduledDate);
              const requestOpen = requestOpenId === e.id;
              // FEATURE — lightweight job-assignment hint from owner-set
              // skills/weaknesses (e.g. "doesn't like roofs"). Just a loose
              // substring match against the job's type/service text — a
              // nudge for the owner to consider, never a hard block.
              const jobContext = `${job.jobType || ""} ${job.address || ""}`.toLowerCase();
              const matchedSkill = (e.skills || []).find((s: string) => s.trim() && jobContext.includes(s.trim().toLowerCase()));
              const weaknessHit = (e.weaknesses || "").split(/[,.;]/).map((w: string) => w.trim()).find((w: string) => w.length > 3 && jobContext.includes(w.toLowerCase()));
              return (
                <div key={e.id} className={"rounded-lg border overflow-hidden " + (unavail ? "bg-yellow-950/10 border-yellow-700/30" : "bg-white/5 border-white/10")}>
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <span className={"text-xs flex items-center gap-1.5 " + (unavail ? "text-yellow-300" : "text-white/70")} title={unavail ? `⚠️ ${e.firstName} is unavailable on this day. Schedule anyway?` : undefined}>
                      {e.firstName} {e.lastName}{unavail ? " ⚠️" : ""}
                      {matchedSkill && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-950/50 text-green-300" title={`Skill on file: ${matchedSkill}`}>✓ {matchedSkill}</span>}
                      {weaknessHit && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-950/50 text-orange-300" title={e.weaknesses}>⚠ may not be a fit</span>}
                      {jobRequestStatuses[e.id]?.status === "pending" && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-yellow-950/50 text-yellow-300">Request pending</span>
                      )}
                      {jobRequestStatuses[e.id]?.status === "denied" && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-950/50 text-brand-300" title={jobRequestStatuses[e.id]?.denial_reason || undefined}>
                          Declined{jobRequestStatuses[e.id]?.denial_reason ? `: ${jobRequestStatuses[e.id]!.denial_reason}` : ""}
                        </span>
                      )}
                    </span>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => toggleCrew(e.id)}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-brand-950/30 hover:bg-brand-900/40 border border-brand-700/30 text-brand-300 hover:text-brand-200 transition">
                        Assign
                      </button>
                      <button onClick={() => { setRequestOpenId(requestOpen ? null : e.id); setRequestEmpId(e.id); setRequestMsg(""); }}
                        className={"text-[10px] font-semibold px-2.5 py-1 rounded-md border transition " + (requestOpen ? "bg-yellow-900/50 border-yellow-600/50 text-yellow-200" : "bg-yellow-950/20 hover:bg-yellow-900/30 border-yellow-700/30 text-yellow-400 hover:text-yellow-300")}>
                        Request
                      </button>
                    </div>
                  </div>
                  {requestOpen && (
                    <div className="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-yellow-700/20">
                      <textarea value={requestMsg} onChange={ev => setRequestMsg(ev.target.value)}
                        placeholder="Message to employee (optional)…" rows={2}
                        className="w-full bg-black/60 border border-white/20 rounded-lg px-2.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-yellow-500/50 resize-none" />
                      <div className="flex gap-2">
                        {/* FIX 4 — disable up front instead of only erroring after
                            the click when ownerId (seeded from getLastOwnerId() at
                            App.tsx bootstrap) hasn't resolved yet. */}
                        <button onClick={sendJobRequest} disabled={requestSending || !ownerId}
                          title={!ownerId ? "Still finishing sign-in — wait a moment" : undefined}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-black text-xs font-bold transition">
                          <Send size={11} />{requestSending ? "Sending…" : !ownerId ? "Finishing sign-in…" : "Send Request"}
                        </button>
                        <button onClick={() => setRequestOpenId(null)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {employees.filter(e => e.status === "active" && e.role !== "owner" && !(job.crew || []).includes(e.id)).length === 0 && (
              <div className="text-[11px] text-white/30">No other active employees available</div>
            )}
          </div>
          {/* FEATURE 5 — explicit warning banner for anyone already assigned
              whose availability conflicts with this job's date (e.g. the
              date was set/changed after they were assigned). */}
          {job.scheduledDate && (() => {
            const unavailNames = (job.crew || []).filter((eid: string) => isEmployeeUnavailable(employees.find(e => e.id === eid) as any, job.scheduledDate)).map((eid: string) => employees.find(e => e.id === eid)?.firstName);
            if (unavailNames.length === 0) return null;
            console.log("[Verify] employee availability warnings — working — flagged:", unavailNames.join(", "));
            return (
              <div className="mt-2 text-[11px] text-yellow-300 bg-yellow-950/30 border border-yellow-700/40 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                ⚠️ {unavailNames.join(", ")} is unavailable on this day. Schedule anyway?
              </div>
            );
          })()}
          {showScheduleForm && (
            <div className="mt-3 p-3 rounded-xl bg-purple-950/20 border border-purple-700/30 space-y-2">
              <div className="text-xs text-purple-300 font-semibold">Schedule & Notify — assigns immediately, no acceptance needed</div>
              <select value={scheduleEmpId} onChange={e => setScheduleEmpId(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50">
                <option value="">Select employee…</option>
                {employees.filter(e => e.status === "active").map(e => (
                  <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
                ))}
              </select>
              <div className="text-[10px] text-white/40">Adds them to crew, emails "You've been scheduled," and adds a Google Calendar event on their calendar if they've connected one.</div>
              <div className="flex gap-2">
                <button onClick={scheduleAndNotify} disabled={!scheduleEmpId || scheduling}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-xs font-bold transition">
                  <Calendar size={11} />{scheduling ? "Scheduling…" : "Schedule & Notify"}
                </button>
                <button onClick={() => setShowScheduleForm(false)}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 text-xs transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Equipment */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Required Equipment <span className="text-white/30">(crew sees this before starting)</span></label>
          <div className="flex gap-2 flex-wrap mb-2">
            {/* fullEquipmentList — merges in any custom equipment saved from a
                previous job (settings.customEquipmentList) so it becomes a
                one-click preset going forward instead of being retyped every
                time. See toggleEquip above. */}
            {[...equipmentList, ...((settings as any)?.customEquipmentList || [])].map(eq => {
              const sel = (job.equipment || []).includes(eq);
              return <button key={eq} onClick={() => toggleEquip(eq)} className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-brand-900/40 border-brand-500/50 text-brand-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>{eq}</button>;
            })}
            {(job.equipment || []).filter((eq: string) => !equipmentList.includes(eq) && !((settings as any)?.customEquipmentList || []).includes(eq)).map((eq: string) => (
              <button key={eq} onClick={() => toggleEquip(eq)} className="text-xs px-3 py-1.5 rounded-lg border bg-brand-900/40 border-brand-500/50 text-brand-300 flex items-center gap-1">{eq}<X size={10} /></button>
            ))}
          </div>
          <CustomItemInput placeholder="Add custom equipment…" onAdd={v => toggleEquip(v)} />
        </div>

        {/* Required chemicals */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Required Materials</label>
          <div className="flex gap-2 flex-wrap mb-2">
            {[...requiredChemicalsList, ...((settings as any)?.customChemicalsList || [])].map(chem => {
              const sel = (job.requiredChemicals || []).includes(chem);
              return <button key={chem} onClick={() => toggleRequiredChemical(chem)} className={"text-xs px-3 py-1.5 rounded-lg border transition " + (sel ? "bg-purple-900/40 border-purple-500/50 text-purple-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>{chem}</button>;
            })}
            {(job.requiredChemicals || []).filter((chem: string) => !requiredChemicalsList.includes(chem) && !((settings as any)?.customChemicalsList || []).includes(chem)).map((chem: string) => (
              <button key={chem} onClick={() => toggleRequiredChemical(chem)} className="text-xs px-3 py-1.5 rounded-lg border bg-purple-900/40 border-purple-500/50 text-purple-300 flex items-center gap-1">{chem}<X size={10} /></button>
            ))}
          </div>
          <CustomItemInput placeholder="Add custom material…" onAdd={v => toggleRequiredChemical(v)} />
        </div>

        {/* Job Notes — visible to both owner and the assigned employee in their job detail view */}
        <div>
          <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><FileText size={10} />Notes <span className="text-white/30 font-normal">(visible to crew)</span></label>
          <GTxt rows={2} value={job.notes || ""} onChange={e => updateJob(jobId, { notes: e.target.value })} placeholder="Service details, access instructions..." />
        </div>

        {/* Internal Notes */}
        <div>
          <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Clipboard size={10} />Internal Notes (crew only)</label>
          <GTxt rows={2} value={job.internalNotes || ""} onChange={e => updateJob(jobId, { internalNotes: e.target.value })} placeholder="Site details, warnings, tips for next visit..." />
        </div>

        {/* Pre-Job Checklist */}
        <ChecklistSection
          jobId={jobId}
          title="Pre-Job Checklist"
          emoji="🔵"
          items={job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS}
          onUpdate={items => updateChecklist("preChecklist", items)}
          crewOptions={checklistCrewOptions}
        />

        {/* During Job Checklist */}
        <ChecklistSection
          jobId={jobId}
          title="During Job Checklist"
          emoji="🟡"
          items={job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS}
          onUpdate={items => updateChecklist("duringChecklist", items)}
          crewOptions={checklistCrewOptions}
        />

        {/* Post-Job Checklist */}
        <ChecklistSection
          jobId={jobId}
          title="Post-Job Checklist"
          emoji="🟢"
          items={job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS}
          onUpdate={items => updateChecklist("postChecklist", items)}
          crewOptions={checklistCrewOptions}
        />

        {/* Photos (Before / After) */}
        <Glass className="p-3 !bg-black/40">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1"><Eye size={10} />Before / After Photos</div>
            <div className="text-xs text-white/50">{(job.photos || []).length} photo{(job.photos || []).length !== 1 ? "s" : ""}</div>
          </div>

          {/* Before/After comparison slider(s) — BUG FIX: "it matched the
              wrong photo to the wrong photo." Paired by pairIndex (the Nth
              before with the Nth after) instead of just grabbing whichever
              before/after happened to be first in the array, so multiple
              before/after pairs on the same job (different areas of the
              property) each render as their own correctly-matched slider. */}
          {(() => {
            const befores = (job.photos || []).filter(p => p.type === "before" && (p.url || p.dataUrl));
            const afters = (job.photos || []).filter(p => p.type === "after" && (p.url || p.dataUrl));
            if (befores.length === 0 || afters.length === 0) return null;
            const count = Math.max(befores.length, afters.length);
            const pairs: { before?: any; after?: any }[] = [];
            for (let i = 0; i < count; i++) {
              const b = befores.find((p: any) => (p.pairIndex ?? befores.indexOf(p)) === i) || befores[i];
              const a = afters.find((p: any) => (p.pairIndex ?? afters.indexOf(p)) === i) || afters[i];
              if (b && a) pairs.push({ before: b, after: a });
            }
            return pairs.map((pair, i) => (
              <div key={i} className={i > 0 ? "mt-2" : ""}>
                <BeforeAfterSlider before={mediaSrc(pair.before.url, pair.before.dataUrl)} after={mediaSrc(pair.after.url, pair.after.dataUrl)} />
              </div>
            ));
          })()}

          {(job.photos || []).length > 0 && <div className="grid grid-cols-3 gap-2 mb-2 mt-2">
            {(job.photos || []).map((p, i) => (
              <div key={p.id || i} className="relative group aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900 border border-brand-900/30">
                {(p.url || p.dataUrl) ? <img src={mediaSrc(p.url, p.dataUrl)} alt={p.caption || ""} className="absolute inset-0 w-full h-full object-cover" />
                  : <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">{p.type === "before" ? "📷" : p.type === "after" ? "✨" : "🖼️"}</div>}
                <div className={"absolute top-1 left-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded " + (p.type === "before" ? "bg-blue-600/90" : p.type === "after" ? "bg-green-600/90" : "bg-black/70")}>{p.type || "photo"}</div>
                <button onClick={() => updateJob(jobId, { photos: (job.photos || []).filter(x => x !== p) })} className="absolute top-1 right-1 p-1 rounded bg-black/70 opacity-0 group-hover:opacity-100 hover:bg-brand-900/80 text-white/80"><X size={10} /></button>
                {p.caption && <div className="absolute bottom-0 left-0 right-0 p-1 text-[9px] bg-gradient-to-t from-black/90 to-transparent truncate">{p.caption}</div>}
              </div>
            ))}
          </div>}
          <div className="grid grid-cols-3 gap-2">
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                const files = Array.from(e.target.files || []);
                files.forEach(f => {
                  compressImageFile(f).then(async dataUrl => {
                    const id = uid();
                    const url = await uploadJobMedia(dataUrlToBlob(dataUrl), `${jobId}/photo-${id}.jpg`, "image/jpeg");
                    const newPhoto = url
                      ? { id, type: "before", caption: "Before — " + today(), url, addedAt: today() }
                      : { id, type: "before", caption: "Before — " + today(), dataUrl, addedAt: today() };
                    const nextPhotos = [...(job.photos || []), newPhoto];
                    updateJob(jobId, { photos: nextPhotos });
                  });
                });
                e.target.value = "";
                toast("Before photo added");
              }} />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs font-medium transition"><Plus size={12} />📷 Before</div>
            </label>
            <label className="cursor-pointer">
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => {
                const files = Array.from(e.target.files || []);
                files.forEach(f => {
                  compressImageFile(f).then(async dataUrl => {
                    const id = uid();
                    const url = await uploadJobMedia(dataUrlToBlob(dataUrl), `${jobId}/photo-${id}.jpg`, "image/jpeg");
                    const newPhoto = url
                      ? { id, type: "after", caption: "After — " + today(), url, addedAt: today() }
                      : { id, type: "after", caption: "After — " + today(), dataUrl, addedAt: today() };
                    const nextPhotos = [...(job.photos || []), newPhoto];
                    updateJob(jobId, { photos: nextPhotos });
                  });
                });
                e.target.value = "";
                toast("After photo added");
              }} />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-green-950/30 hover:bg-green-900/40 border border-green-700/40 text-green-300 text-xs font-medium transition"><Plus size={12} />✨ After</div>
            </label>
            <label className="cursor-pointer">
              <input type="file" accept="video/*" capture="environment" className="hidden" onChange={async e => {
                const f = e.target.files?.[0]; if (!f) return;
                // BUG FIX — this used to be its own stale 80MB-size-only check with
                // no duration limit at all, out of sync with the real 10s/10MB
                // limit (checkVideoLimits) enforced everywhere else video gets
                // captured (EmployeePortal). Use the same shared check so the
                // owner gets the same warning an employee would.
                const limitErr = await checkVideoLimits(f);
                if (limitErr) { toast(limitErr, "red"); e.target.value = ""; return; }
                const r = new FileReader();
                r.onload = async ev => {
                  const dataUrl = ev.target!.result as string;
                  const id = uid();
                  const ext = (f.type.split("/")[1] || "mp4").replace("quicktime", "mov");
                  const url = await uploadJobMedia(f, `${jobId}/video-${id}.${ext}`, f.type);
                  const vid: JobVideo = url ? { id, url, caption: today(), addedAt: today() } : { id, dataUrl, caption: today(), addedAt: today() };
                  updateJob(jobId, { videos: [...(job.videos || []), vid] });
                };
                r.readAsDataURL(f);
                e.target.value = "";
                toast("Video added");
              }} />
              <div className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs font-medium transition"><Plus size={12} />🎥 Video</div>
            </label>
          </div>
          {(job.videos || []).length > 0 && (
            <div className="mt-2 space-y-2">
              <div className="text-[10px] text-white/40 uppercase tracking-wider">Videos ({(job.videos || []).length})</div>
              <div className="grid grid-cols-2 gap-2">
                {(job.videos || []).map((v, i) => (
                  <div key={v.id || i} className="relative rounded-lg overflow-hidden bg-black border border-purple-900/30 group">
                    <video src={mediaSrc(v.url, v.dataUrl)} controls className="w-full max-h-32 object-contain" />
                    <button onClick={() => updateJob(jobId, { videos: (job.videos || []).filter(x => x.id !== v.id) })}
                      className="absolute top-1 right-1 p-1 rounded bg-black/70 opacity-0 group-hover:opacity-100 hover:bg-brand-900/80 text-white/80"><X size={10} /></button>
                    {v.caption && <div className="text-[9px] text-white/40 px-1 pb-1">{v.caption}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="text-[10px] text-white/40 mt-1.5">Tip: on mobile, tapping opens the camera directly. Drag the slider on comparison view.</div>
        </Glass>

        {/* Attachments */}
        <Glass className="p-3 !bg-black/40">
          <div className="flex items-center justify-between mb-2"><div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1"><FileText size={10} />Work Order Attachments</div><div className="text-xs text-white/50">{(job.attachments || []).length} file{(job.attachments || []).length !== 1 ? "s" : ""}</div></div>
          <div className="text-[10px] text-white/40 mb-2">Attach PDFs, photos, or videos (e.g. a multi-page commercial job spec sheet) — visible to any employee assigned to this job.</div>
          <input ref={attFileInputRef} type="file" multiple accept=".pdf,image/*,video/*" className="hidden" onChange={e => handleAttFiles(e.target.files)} />
          <GBtn onClick={() => attFileInputRef.current?.click()} disabled={attUploading} className="w-full mb-2 !py-1.5 !text-xs flex items-center justify-center gap-1.5">
            {attUploading ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white/70 rounded-full animate-spin" />Uploading…</> : <><Plus size={12} />Attach File(s)</>}
          </GBtn>
          {(job.attachments || []).length > 0 && <div className="space-y-1">
            {(job.attachments || []).map(a => <div key={a.id} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded hover:bg-white/10">
              <div className="flex items-center gap-2 flex-1 min-w-0"><span>{attIcon(a.type)}</span><span className="truncate">{a.name}</span></div>
              <div className="flex items-center gap-1">
                {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="p-1 text-white/50 hover:text-white"><Download size={10} /></a> : <button onClick={() => toast("This attachment has no file — it was added before real uploads existed. Remove and re-attach it.")} className="p-1 text-white/30"><Download size={10} /></button>}
                <button onClick={() => removeAtt(a.id)} className="p-1 text-white/40 hover:text-danger-400"><X size={10} /></button>
              </div>
            </div>)}
          </div>}
        </Glass>

        {/* Chemical Usage */}
        <Glass className="p-3 !bg-black/40">
          <div className="flex items-center justify-between mb-2"><div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1"><FlaskConical size={10} />Chemical Usage</div><div className="text-xs text-white/50">{totalGallons}gal · {fmt(totalChemCost)}</div></div>
          <div className="grid grid-cols-7 gap-2 mb-2">
            <GInput placeholder="Chemical" value={chemName} onChange={e => setChemName(e.target.value)} className="col-span-3 !py-1.5 !text-xs" />
            <GInput type="number" step="0.1" placeholder="Gal" value={chemGal} onChange={e => setChemGal(e.target.value)} className="col-span-1 !py-1.5 !text-xs" />
            <GInput type="number" step="0.01" placeholder="Cost $" value={chemCost} onChange={e => setChemCost(e.target.value)} className="col-span-2 !py-1.5 !text-xs" />
            <GBtn onClick={addChem} className="col-span-1 !py-1.5 !text-xs"><Plus size={12} /></GBtn>
          </div>
          {(job.chemicalsUsed || []).length > 0 && <div className="space-y-1">
            {(job.chemicalsUsed || []).map((ch, i) => <div key={i} className="flex items-center justify-between text-xs p-1.5 bg-white/5 rounded"><span>{ch.name}</span><span className="text-white/50">{ch.gallons}gal · {fmt(ch.cost)}</span><button onClick={() => removeChem(i)} className="text-danger-400 hover:text-danger-300"><X size={10} /></button></div>)}
          </div>}
        </Glass>

        {/* Job Costing & Profitability */}
        <Glass className="p-3 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1"><DollarSign size={10} />Job Costing & Profitability</div>
          <div className="flex items-center gap-3 mb-3 p-2 bg-black/40 border border-brand-900/30 rounded-xl">
            <label className="flex items-center gap-2 cursor-pointer text-sm flex-1">
              <input type="checkbox" checked={!!job.isCash} onChange={e => updateJob(jobId, { isCash: e.target.checked })} className="w-4 h-4" />
              <span className="text-white/80">💵 Cash payment</span>
            </label>
            {job.isCash && <span className="text-[9px] px-2 py-1 rounded-full bg-green-900/30 border border-green-700/40 text-green-300">Separate for taxes</span>}
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <label className="flex items-center gap-2 cursor-pointer text-xs p-2 bg-black/40 border border-brand-900/20 rounded-xl">
              <input type="checkbox" checked={!!job.noShow} onChange={e => updateJob(jobId, { noShow: e.target.checked })} className="w-3.5 h-3.5" />
              <span className="text-white/70">🚫 No-show</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs p-2 bg-black/40 border border-blue-900/20 rounded-xl">
              <input type="checkbox" checked={!!job.rainGuarantee} onChange={e => updateJob(jobId, { rainGuarantee: e.target.checked, rainGuaranteeDate: e.target.checked ? today() : null })} className="w-3.5 h-3.5" />
              <span className="text-white/70">🌧️ Rain guarantee</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs p-2 bg-black/40 border border-yellow-900/20 rounded-xl col-span-2">
              <input type="checkbox" checked={!!job.weatherOverride} onChange={e => updateJob(jobId, { weatherOverride: e.target.checked })} className="w-3.5 h-3.5" />
              <span className="text-white/70">⚡ Proceed despite weather (weather override)</span>
            </label>
          </div>
          {job.rainGuarantee && <div className="mb-3 p-2 bg-blue-950/20 border border-blue-700/30 rounded-xl text-xs">
            <div className="text-blue-300 font-semibold mb-1">48-hour rain guarantee active</div>
            <div className="text-blue-200/60">Guarantee set: {job.rainGuaranteeDate}. If it rains within 48h, this job is eligible for a free re-spray. Check weather and follow up with customer.</div>
          </div>}

          {/* Sq footage + rate calculator */}
          <div className="mb-3 p-2 bg-black/40 border border-brand-900/20 rounded-xl">
            <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Square Footage Calculator</div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-white/40 mb-0.5 block">Sq Ft</label>
                <GInput type="number" value={job.sqFootage || ""} onChange={e => updateJob(jobId, { sqFootage: Number(e.target.value) })} placeholder="2400" className="!py-1 !text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-0.5 block">Rate / sq ft</label>
                <GInput type="number" step="0.001" value={job.sqFtRate || ""} onChange={e => updateJob(jobId, { sqFtRate: Number(e.target.value) })} placeholder="0.15" className="!py-1 !text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-white/40 mb-0.5 block">Est. Price</label>
                <div className="py-1 px-2 bg-black/60 border border-brand-900/20 rounded-lg text-xs font-bold text-brand-400">
                  {job.sqFootage && job.sqFtRate ? fmt(job.sqFootage * job.sqFtRate) : "—"}
                </div>
              </div>
            </div>
            {job.sqFootage && job.sqFtRate && Math.abs((job.sqFootage * job.sqFtRate) - job.amount) > 10 && (
              <button onClick={() => updateJob(jobId, { amount: Math.round(job.sqFootage * job.sqFtRate * 100) / 100 })} className="mt-1.5 text-[10px] text-blue-400 hover:text-blue-300">
                Apply {fmt(job.sqFootage * job.sqFtRate)} to job price →
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider">Labor Cost ($)</label>
              <GInput type="number" step="0.01" value={job.laborCost || ""} onChange={e => updateJob(jobId, { laborCost: Number(e.target.value) })} placeholder="0.00" className="!py-1.5 !text-xs mt-1" />
            </div>
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider">Material Cost ($)</label>
              <GInput type="number" step="0.01" value={job.materialCost || ""} onChange={e => updateJob(jobId, { materialCost: Number(e.target.value) })} placeholder="0.00" className="!py-1.5 !text-xs mt-1" />
            </div>
          </div>
          {(() => {
            const labor = Number(job.laborCost) || 0;
            const materials = Number(job.materialCost) || 0;
            const chems = totalChemCost;
            const totalCost = labor + materials + chems;
            const revenue = job.amount || 0;
            const profit = revenue - totalCost;
            const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
            const marginTone = Number(margin) >= 60 ? "text-green-400" : Number(margin) >= 40 ? "text-yellow-400" : "text-brand-400";
            return <div className="space-y-1.5">
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] mb-2">
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Revenue</div><div className="font-bold text-white">{fmt(revenue)}</div></div>
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Costs</div><div className="font-bold text-brand-400">{fmt(totalCost)}</div></div>
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Profit</div><div className={"font-bold " + (profit >= 0 ? "text-green-400" : "text-brand-400")}>{fmt(profit)}</div></div>
                <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50">Margin</div><div className={"font-bold " + marginTone}>{margin}%</div></div>
              </div>
              {totalCost > 0 && <div className="h-2 rounded-full overflow-hidden bg-black/40 flex">
                <div className="bg-blue-600/70" style={{ width: (labor / totalCost * 100) + "%" }} title={"Labor " + fmt(labor)} />
                <div className="bg-orange-500/70" style={{ width: (materials / totalCost * 100) + "%" }} title={"Materials " + fmt(materials)} />
                <div className="bg-yellow-500/70" style={{ width: (chems / totalCost * 100) + "%" }} title={"Chemicals " + fmt(chems)} />
              </div>}
              {totalCost > 0 && <div className="flex gap-3 text-[9px] text-white/50">
                <span><span className="inline-block w-2 h-2 rounded-full bg-blue-600/70 mr-1" />Labor {fmt(labor)}</span>
                <span><span className="inline-block w-2 h-2 rounded-full bg-orange-500/70 mr-1" />Materials {fmt(materials)}</span>
                {chems > 0 && <span><span className="inline-block w-2 h-2 rounded-full bg-yellow-500/70 mr-1" />Chemicals {fmt(chems)}</span>}
              </div>}
            </div>;
          })()}
        </Glass>

        {/* Comm Log */}
        <Glass className="p-3 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1"><MessageSquare size={10} />Communication Log</div>
          <div className="flex gap-2 mb-2">
            <GSel value={commType} onChange={e => setCommType(e.target.value)} className="!w-28 !py-1.5 !text-xs">
              <option value="note" className="bg-black">note</option>
              <option value="call" className="bg-black">call</option>
              <option value="text" className="bg-black">text</option>
              <option value="email" className="bg-black">email</option>
            </GSel>
            <GInput placeholder="Add entry..." value={commNote} onChange={e => setCommNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addComm()} className="!py-1.5 !text-xs" />
            <GBtn onClick={addComm} className="!py-1.5"><Plus size={12} /></GBtn>
          </div>
          {(job.commLog || []).length > 0 && <div className="space-y-1 max-h-32 overflow-y-auto">
            {(job.commLog || []).slice().reverse().map(e => {
              // Notes save a full ISO timestamp (FIX 6); older/other entry types
              // may still just be a bare YYYY-MM-DD date — show both sensibly.
              const d = new Date(e.date);
              const label = !isNaN(d.getTime()) && e.date.length > 10
                ? d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                : e.date;
              return <div key={e.id} className="text-xs p-2 bg-white/5 rounded flex items-center gap-2"><Badge tone="gray">{e.type}</Badge><span className="flex-1">{e.note}</span><span className="text-white/40 flex-shrink-0">{label}</span></div>;
            })}
          </div>}
        </Glass>

        {/* Payment & Completion */}
        <Glass className="p-3 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1"><CreditCard size={10} />Payment & Completion</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Payment Type</label>
              <GSel value={job.paymentType || ""} onChange={e => updateJob(jobId, { paymentType: e.target.value as any })}>
                <option value="" className="bg-black">— Select —</option>
                {["Cash", "Check", "Card", "Zelle", "Venmo", "Invoice"].map(t => <option key={t} value={t} className="bg-black">{t}</option>)}
              </GSel>
            </div>
            <div>
              <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Payment Status</label>
              <GSel value={job.paymentStatus || ""} onChange={e => updateJob(jobId, { paymentStatus: e.target.value as any })}>
                <option value="" className="bg-black">— Select —</option>
                {["Pending", "Partial", "Paid"].map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
              </GSel>
            </div>
          </div>
          <div className="mb-3">
            <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Amount Collected ($)</label>
            <GInput type="number" step="0.01" value={job.amountCollected ?? ""} onChange={e => updateJob(jobId, { amountCollected: Number(e.target.value) })} placeholder="0.00" className="!py-1.5 !text-xs" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-2.5 bg-green-950/20 border border-green-700/30 rounded-xl">
            <input type="checkbox" checked={!!job.customerAccepted} onChange={e => updateJob(jobId, { customerAccepted: e.target.checked })} className="w-4 h-4 accent-green-500" />
            <div>
              <div className="text-sm font-medium text-white/90">✅ Customer Accepts Work Complete</div>
              <div className="text-[10px] text-white/50 mt-0.5">Customer acknowledges job is done to satisfaction</div>
            </div>
          </label>
        </Glass>

        {/* Client Sign-Off */}
        <Glass className={"p-3 " + (job.signOff ? "!bg-green-950/20 !border-green-700/40" : "!bg-black/40")}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1">
              <CheckSquare size={10} />Client Sign-Off
            </div>
            {job.signOff && <div className="text-[10px] text-green-400 font-semibold">✓ Signed</div>}
          </div>
          {job.signOff ? (
            <div className="space-y-1">
              {(job.signOff as any).sigType === "draw" && ((job.signOff as any).sigUrl || (job.signOff as any).sigData) ? (
                <img src={mediaSrc((job.signOff as any).sigUrl, (job.signOff as any).sigData)} alt="Signature" className="bg-white rounded-lg max-h-16" />
              ) : (
                <div className="text-sm font-medium text-white/90">{job.signOff.signerName}</div>
              )}
              <div className="text-[11px] text-white/40">{job.signOff.timestamp}</div>
              <div className="flex gap-2 mt-2">
                <GBtn onClick={() => printSignOff(job.signOff!.signerName, job.signOff!.timestamp)} className="!text-xs !py-1.5">
                  <Download size={11} className="inline mr-1" />Print / Save PDF
                </GBtn>
                <GBtn variant="danger" onClick={() => updateJob(jobId, { signOff: null })} className="!text-xs !py-1.5">
                  Clear Signature
                </GBtn>
              </div>
            </div>
          ) : (
            <div>
              <div className="text-xs text-white/50 mb-3">
                Generate a completion document with before/after photos, checklist summary, and customer signature. Opens a printable PDF.
              </div>
              <GBtn onClick={openSignOff} className="w-full !justify-center">
                <CheckSquare size={13} className="inline mr-1.5" />Generate Sign-Off Document
              </GBtn>
            </div>
          )}
        </Glass>

        {/* Sign-Off Modal */}
        {showSignOff && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setShowSignOff(false)}>
            <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div className="text-base font-semibold">Client Sign-Off</div>
                <button onClick={() => setShowSignOff(false)} className="text-white/40 hover:text-white"><X size={16} /></button>
              </div>
              <div className="mb-4 p-3 bg-white/5 rounded-xl text-xs text-white/60 leading-relaxed">
                By signing, the customer confirms all services were completed to their satisfaction and acknowledges pre-existing conditions documented during the pre-job inspection.
              </div>
              <div className="mb-2">
                <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">Services Performed</label>
                <div className="p-2 bg-white/5 rounded-lg text-xs text-white/70">
                  {job.notes || "Service"} · Total: ${(job.amount || 0).toFixed(2)}
                </div>
              </div>
              <div className="mb-4">
                <label className="text-xs text-white/50 uppercase tracking-wider mb-1.5 block">
                  Customer Full Name (Digital Signature) <span className="text-brand-400">*</span>
                </label>
                <GInput
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Type full name to sign..."
                  className="!text-base !font-serif"
                  onKeyDown={e => { if (e.key === "Enter" && signerName.trim()) saveSignOff(); }}
                />
                {signerName && (
                  <div className="mt-1.5 px-2 py-1 border-b border-white/20 text-lg font-serif text-white/80 italic">
                    {signerName}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-white/30 mb-4">
                Timestamp will be recorded automatically at time of signing.
              </div>
              <div className="flex gap-2">
                <GBtn onClick={() => setShowSignOff(false)} variant="ghost" className="flex-1 !justify-center">Cancel</GBtn>
                <GBtn onClick={saveSignOff} className="flex-1 !justify-center !bg-green-800 hover:!bg-green-700">
                  <CheckSquare size={13} className="inline mr-1" />Sign & Save PDF
                </GBtn>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end"><GBtn onClick={onClose}>Done</GBtn></div>
      </div>
      <InvoicePreviewModal
        open={showInvoicePreview}
        onClose={() => setShowInvoicePreview(false)}
        onConfirm={confirmSendInvoice}
        sending={sendingInvoice}
        data={(() => {
          const c = customers.find(x => x.id === job.customerId);
          if (!c) return null;
          return { customerName: c.firstName, address: job.address || "", amount: Number(job.amount) || 0, companyName: settings.companyName || "CRM Starter", payLink: "" };
        })()}
      />
      <StripePaymentModal
        open={chargeCardOpen}
        onClose={() => setChargeCardOpen(false)}
        publishableKey={settings?.stripePublishableKey || ""}
        stripeAccountId={(settings as any)?.stripeConnectAccountId}
        amount={Number(job.amount) || 0}
        description={linkedInvoice ? `Invoice #${linkedInvoice.id.slice(-8).toUpperCase()}` : `Job payment — ${job.address || ""}`}
        invoiceId={linkedInvoice?.id}
        onSuccess={chargeCardSuccess}
        disableLink
      />
    </Modal>
  );
}

// ===== PIPELINE =====
// ===== PIPELINE SCROLL CONTAINER =====
// Handles horizontal scroll with visible scrollbar + touch swipe on mobile
