import React, { useState, useEffect, useRef } from "react";
import {
  Clock, Briefcase, Calendar, ChevronLeft, CheckSquare, Camera,
  LogOut, MapPin, Phone, User, Play, Pause, Square, Plus, X, Eye, EyeOff, DollarSign, BookOpen,
  ChevronRight, Home, List, CheckCircle, AlertCircle, AlertTriangle, Image, FileText,
  Video, PenLine, Shield, Navigation, Database, Route, ToggleRight, ToggleLeft, Download, Bell, CreditCard, Mic, WifiOff, RefreshCw
} from "lucide-react";
import { supabase, getStoredGoogleConnection, fetchOwnerGoogleToken, clearLocalAuthSession } from "../../lib/supabase";
import { getEmpGoogleToken, isEmpGoogleTokenValid, saveEmpGoogleToken, clearEmpGoogleToken, refreshEmpGoogleToken, getValidEmpGoogleToken, createGCalEvent, updateGCalEvent, onGoogleAuthFailure, verifyGoogleTokenLive } from "../../lib/googleApi";
import { sendViaGmail, sendEmail, sendOwnerGmailOnly, emailShell, emailButton, twilioSend, logOutboundSmsToInbox } from "../../lib/messaging";
import { Glass } from "../ui/Glass";
import { BrandMark } from "../ui/BrandMark";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GTxt } from "../ui/GTxt";
import { GSel } from "../ui/GSel";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { loadMapsScript, AddressAutocomplete } from "../ui/AddressAutocomplete";
import { LiveMap } from "../ui/LiveMap";
import { PropertyMapEmbed } from "../ui/PropertyMapEmbed";
import { SaveCardModal } from "../ui/SaveCardModal";
import { InstallAppButton } from "../ui/InstallAppButton";
import { PushOptInPrompt } from "../ui/PushOptInPrompt";
import { sendPushNotification } from "../../lib/push";
import { SopModal } from "../ui/SopModal";
import { chargeSavedPaymentMethod, sendPaymentReceipt, listCustomerPaymentMethods } from "../../lib/stripe";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { fmt, uid, today, localDateStr, localDateKey, shiftDayStr, daysFromNow, computeJobRatingScore, setOAuthIntent, compressImageFile, getEffectiveRate, computeNextRecurringDate, weekdayLabels, normalizeJobRow, totalJobPhotoCount, mediaSrc, dataUrlToBlob, uploadJobMedia, checkVideoLimits, stripLegacyJobFields, reconcileCrewAfterAssign, getPollIntervalMs, getPayPeriodBounds, haversineMiles, resolveTermsForJobType, buildJobCalendarDescription, haptic, queueOfflineJobPatch, getPendingJobPatches, clearPendingJobPatch, fetchDriveDistance } from "../../lib/utils";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { callModel, MODELS } from "../../lib/api";
import { matchVoiceCommand } from "../../lib/voiceCommands";
import { usePollGate } from "../../hooks/usePollGate";
import { usePersistent } from "../../hooks/usePersistent";
import type { Job, Employee, Customer, AppSettings, JobChecklistItem, EmployeeOnboarding } from "../../types";

const PRE_DEFAULTS: JobChecklistItem[] = [
  { id: "pre1", label: "Take before photos of the work area", done: false },
  { id: "pre2", label: "Confirm site access", done: false },
  { id: "pre3", label: "Review job scope with customer", done: false },
  { id: "pre4", label: "Note any pre-existing issues", done: false },
];
const DURING_DEFAULTS: JobChecklistItem[] = [
  { id: "dur1", label: "Complete the scoped work", done: false },
  { id: "dur2", label: "Keep work area clean and safe", done: false },
  { id: "dur3", label: "Document any extra work or changes", done: false },
];
const POST_DEFAULTS: JobChecklistItem[] = [
  { id: "post1", label: "Customer walkthrough", done: false },
  { id: "post2", label: "Collect payment", done: false },
  { id: "post3", label: "Get customer signature", done: false },
  { id: "post4", label: "Take after photos", done: false },
];

// Payment status label shown on completed jobs — owner and employee views
// both use this so "Paid (Cash)" / "Unpaid — Invoice Sent" / "Unpaid" read
// the same everywhere.
export function paymentStatusLabel(job: Job): string {
  if (job.paymentStatus === "Paid") return `Paid (${job.paymentType || "Cash"})`;
  if (job.paymentType === "Invoice" || job.invoiceSentAt) return "Unpaid — Invoice Sent";
  if (job.paymentStatus === "Pending") return "Unpaid";
  return "Unpaid";
}

// Embedded map for a job address — see PropertyMapEmbed for why this
// replaced the Street View Static API (403 key-restriction errors).
function StreetViewThumb({ address }: { address: string; apiKey?: string }) {
  return <PropertyMapEmbed address={address} height={144} />;
}
// Formats a job's estimated duration (decimal hours) as "Est. 3 hours" /
// "Est. 1 hour" / "Est. 2h 30m" for fractional values.
const formatEstDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `Est. ${h} hour${h === 1 ? "" : "s"}`;
  if (h === 0) return `Est. ${m} min`;
  return `Est. ${h}h ${m}m`;
};

// Races a promise against a hard timeout so a hung await (no error, no resolve —
// e.g. internal Supabase/Google auth-lock contention) can never block a button's
// loading state forever; a normal rejection is still caught by the caller as usual.
const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label + " timed out")), ms)),
  ]);

// Shifts a "HH:MM" scheduled time by +/- minutes, wrapping within a 24h day.
// Used by Running Late so the job's scheduled time (and anything downstream
// that reads it — calendar sync, "up next" sorting) reflects the delay.
const shiftScheduledTime = (time: string | undefined, minutes: number): string | undefined => {
  if (!time) return time;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const total = ((h * 60 + m + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// Normalizes a single crew entry to a comparable id string. Crew is meant to be a
// plain array of employee-id strings, but Supabase JSONB round-trips and older
// write paths have been known to store objects ({ id }, { employeeId }) instead —
// a bare `c === empId` string comparison silently fails (no error, just an empty
// result) against those, which looks exactly like "the job isn't assigned" even
// though the data is there. Also tolerates a stringified-JSON crew column.
const crewEntryId = (c: any): string => {
  if (c == null) return "";
  if (typeof c === "string") return c.trim().toLowerCase();
  if (typeof c === "object") {
    const v = c.id ?? c.employeeId ?? c.employee_id ?? c.user_id ?? c.userId ?? "";
    return String(v).trim().toLowerCase();
  }
  return String(c).trim().toLowerCase();
};

const normalizeCrewArray = (crew: any): any[] => {
  if (Array.isArray(crew)) return crew;
  if (typeof crew === "string" && crew.trim().startsWith("[")) {
    try { const parsed = JSON.parse(crew); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return [];
};

export const crewIncludesEmployee = (crew: any, empId?: string | null, empUserId?: string | null): boolean => {
  const list = normalizeCrewArray(crew).map(crewEntryId);
  const targets = [empId, empUserId].filter(Boolean).map(v => String(v).trim().toLowerCase());
  if (targets.length === 0) return false;
  return list.some(c => c && targets.includes(c));
};

// Shared email-safe "label ... value" row for the end-of-day summary
// emails — see its call sites' BUG FIX comment for why this replaced
// display:flex (Gmail/Outlook both ignore flexbox in email HTML).
const emailSummaryRow = (label: string, value: string): string =>
  `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px;color:#333">${label}</td><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px;font-weight:700;text-align:right;color:#111">${value}</td></tr>`;

// BUG FIX — "it said I never allowed the permission but I did." Every
// geolocation failure (denied, GPS unavailable indoors, a plain timeout —
// all extremely common in the field, none of them mean the browser
// permission was ever actually denied) was shown as "Location denied —
// enable in settings," which is simply false for the other two error
// codes and reads as the app not recognizing a permission the employee
// really did grant. Classify by the real GeolocationPositionError code.
const geoErrorMessage = (err: GeolocationPositionError): string => {
  if (err.code === err.PERMISSION_DENIED) return "Location permission denied — enable it for this site in your browser/phone settings.";
  if (err.code === err.POSITION_UNAVAILABLE) return "Couldn't get a GPS fix right now (weak signal or indoors) — try again outside or near a window.";
  return "Location request timed out — try again.";
};

export const PERMISSION_DEFS = [
  { key: "can_view_jobs",          label: "View assigned jobs",        desc: "See their job schedule" },
  { key: "can_clock_in",           label: "Clock in / out",            desc: "Track time on jobs" },
  { key: "can_upload_photos",      label: "Upload photos",             desc: "Take before/after photos" },
  { key: "can_complete_checklist", label: "Complete checklist",        desc: "Check off job items" },
  { key: "can_get_signoff",        label: "Get customer sign-off",     desc: "Collect customer signature" },
  { key: "can_view_pay",           label: "View pay info",             desc: "See pay rate and history" },
  { key: "can_view_calendar",      label: "View calendar",             desc: "See weekly/monthly schedule" },
  { key: "can_add_notes",          label: "Add job notes",             desc: "Leave notes on jobs" },
] as const;

export const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  can_view_jobs: true, can_clock_in: true, can_upload_photos: true,
  can_complete_checklist: true, can_get_signoff: true,
  can_view_pay: true, can_view_calendar: true, can_add_notes: true,
  // ITEMS 3/5 — mirrors EmployeesPage.tsx's PERMISSION_DEFS_EMP/DEFAULT_PERMS;
  // off by default since these touch invoicing/money, unlike the operational
  // perms above.
  can_create_invoices: false, can_send_invoices: false, can_process_payments: false,
};

function PortalChecklistSection({ jobId, title, emoji, items, onUpdate, allowPhotos = false, disabled = false, toast = () => {}, crewOptions = [], myEmployeeId = "" }: {
  jobId: string;
  title: string; emoji: string;
  items: JobChecklistItem[];
  onUpdate: (items: JobChecklistItem[]) => void;
  allowPhotos?: boolean;
  disabled?: boolean;
  toast?: (msg: string, tone?: any) => void;
  // FEATURE — "assign specific checklist items to specific employees, make
  // sure the whole process for multiple employees working on a job works
  // well." Items with no assignedTo stay open to every crew member on the
  // job (unchanged behavior); an assigned item can only be checked by that
  // person (or is shown read-only, with their name, to everyone else) —
  // the checklist itself already lives on the job row, so every crew
  // member already sees the same list/state, this just restricts WHO can
  // toggle a given item.
  crewOptions?: { id: string; name: string }[];
  myEmployeeId?: string;
}) {
  const done = items.filter(i => i.done).length;
  const isMine = (item: JobChecklistItem) => !item.assignedTo || item.assignedTo === myEmployeeId;
  const toggle = (id: string) => {
    if (disabled) return;
    const item = items.find(it => it.id === id);
    if (item && !isMine(item)) { toast(`This item is assigned to ${crewOptions.find(c => c.id === item.assignedTo)?.name || "another crew member"}`, "yellow"); return; }
    haptic(10);
    onUpdate(items.map(it => it.id === id ? { ...it, done: !it.done } : it));
  };
  const updateNotes = (id: string, notes: string) => onUpdate(items.map(it => it.id === id ? { ...it, notes } : it));

  // FEATURE — voice-to-text checklist notes. Wet/gloved hands make typing
  // on a phone slow mid-job; this uses the browser's built-in Web Speech
  // API (no API key, no backend call) — supported on Chrome/Safari/Edge
  // mobile, not on Firefox, so the mic button only renders when the API
  // actually exists rather than showing a control that'd silently do
  // nothing on an unsupported browser.
  const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const [recordingItemId, setRecordingItemId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const toggleVoiceNote = (item: JobChecklistItem) => {
    if (!SpeechRecognitionCtor) return;
    if (recordingItemId === item.id) {
      recognitionRef.current?.stop();
      return;
    }
    recognitionRef.current?.stop();
    const rec = new SpeechRecognitionCtor();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(" ").trim();
      if (!transcript) return;
      const existing = (item.notes || "").trim();
      updateNotes(item.id, existing ? existing + " " + transcript : transcript);
    };
    rec.onerror = (e: any) => { console.warn("[VoiceNote] speech recognition error:", e?.error); };
    rec.onend = () => setRecordingItemId(cur => cur === item.id ? null : cur);
    recognitionRef.current = rec;
    setRecordingItemId(item.id);
    try { rec.start(); } catch { setRecordingItemId(null); }
  };
  useEffect(() => () => recognitionRef.current?.stop(), []);
  const addItemPhoto = async (id: string, dataUrl: string, isVideo: boolean, contentType?: string) => {
    const mediaId = uid();
    const ext = isVideo ? (contentType?.split("/")[1] || "mp4").replace("quicktime", "mov") : "jpg";
    const url = await uploadJobMedia(dataUrlToBlob(dataUrl), `${jobId}/checklist-${id}-${mediaId}.${ext}`, contentType || (isVideo ? undefined : "image/jpeg"));
    const media = url ? { id: mediaId, url } : { id: mediaId, dataUrl };
    onUpdate(items.map(it => it.id === id
      ? isVideo ? { ...it, videos: [...(it.videos || []), media] } : { ...it, photos: [...(it.photos || []), media] }
      : it));
  };
  const deleteItemMedia = (id: string, mediaId: string, isVideo: boolean) => {
    onUpdate(items.map(it => it.id === id
      ? isVideo ? { ...it, videos: (it.videos || []).filter(v => v.id !== mediaId) } : { ...it, photos: (it.photos || []).filter(p => p.id !== mediaId) }
      : it));
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">{emoji} {title}</div>
        <div className={"text-xs font-bold " + (done === items.length ? "text-green-400" : "text-white/40")}>
          {done}/{items.length}
        </div>
      </div>
      <div className="space-y-1.5">
        {items.map(item => (
          <div key={item.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5">
            <div className="flex items-start gap-2">
              <input type="checkbox" id={`checklist-item-${item.id}`} checked={item.done} onChange={() => toggle(item.id)}
                disabled={disabled || !isMine(item)}
                title={!disabled && !isMine(item) ? `Assigned to ${crewOptions.find(c => c.id === item.assignedTo)?.name || "another crew member"}` : undefined}
                className={"mt-0.5 w-4 h-4 flex-shrink-0 " + (disabled || !isMine(item) ? "opacity-50 cursor-not-allowed" : "accent-green-500 cursor-pointer")} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* BUG FIX (mobile audit) — only the 16x16px checkbox itself
                      was tappable; the row's own div had no onClick. A <label
                      htmlFor> pairs with the checkbox by id (no DOM nesting
                      required) so tapping the item text — the natural mobile
                      gesture, used per checklist item per job all day —
                      toggles it too, without touching the camera icon's own
                      click handling next to it. */}
                  <label htmlFor={`checklist-item-${item.id}`} className={"text-sm flex-1 " + (disabled || !isMine(item) ? "" : "cursor-pointer") + " " + (item.done ? "line-through text-white/30" : "text-white/80")}>
                    {item.label}
                    {item.assignedTo && (
                      <span className={"ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full border " + (isMine(item) ? "text-purple-300 bg-purple-950/40 border-purple-700/30" : "text-white/40 bg-white/5 border-white/10")}>
                        {isMine(item) ? "you" : (crewOptions.find(c => c.id === item.assignedTo)?.name || "assigned")}
                      </span>
                    )}
                  </label>
                  {allowPhotos && (
                    <label className="cursor-pointer flex-shrink-0">
                      {/* capture="environment" opens the device camera directly on mobile
                          (native camera app) and a file picker with a camera option on
                          desktop; accepting both photo and video mime types lets one
                          button cover both, and the file is auto-uploaded on selection —
                          there's no separate "upload" step. */}
                      <input type="file" accept="image/*,video/*" capture="environment" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]; if (!f) return;
                          const isVideo = f.type.startsWith("video/");
                          if (isVideo) {
                            // ITEM 11 — same 30s/50MB cap as the top-level before/after
                            // video capture (addVideo below) — this path had none before.
                            checkVideoLimits(f).then(err => {
                              if (err) { toast(err, "red"); return; }
                              const r = new FileReader();
                              r.onload = ev => addItemPhoto(item.id, ev.target!.result as string, true, f.type);
                              r.readAsDataURL(f);
                            });
                          } else {
                            compressImageFile(f).then(dataUrl => addItemPhoto(item.id, dataUrl, false));
                          }
                          e.target.value = "";
                        }} />
                      <div className="p-1 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 text-blue-400/80 hover:text-blue-300 transition">
                        <Camera size={12} />
                      </div>
                    </label>
                  )}
                </div>
                {/* Per-item photo/video thumbnails */}
                {((item.photos || []).length > 0 || (item.videos || []).length > 0) && (
                  <div className="mt-1.5 flex gap-1.5 flex-wrap">
                    {(item.photos || []).map((p, pi) => (
                      <div key={p.id || pi} className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 relative">
                        <img src={mediaSrc(p.url, p.dataUrl)} alt="" className="w-full h-full object-cover" />
                        {!disabled && (
                          <button onClick={() => deleteItemMedia(item.id, p.id, false)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-danger-700 text-white flex items-center justify-center">
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    ))}
                    {(item.videos || []).map((v, vi) => (
                      <div key={v.id || vi} className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-white/10 relative bg-black">
                        <video src={mediaSrc(v.url, v.dataUrl)} className="w-full h-full object-cover" />
                        <Video size={14} className="absolute inset-0 m-auto text-white/80" />
                        {!disabled && (
                          <button onClick={() => deleteItemMedia(item.id, v.id, true)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 hover:bg-danger-700 text-white flex items-center justify-center">
                            <X size={9} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={item.notes || ""}
                    onChange={e => updateNotes(item.id, e.target.value)}
                    placeholder="Add note..."
                    className="flex-1 min-w-0 bg-transparent border-0 border-b border-white/10 text-xs text-white/50 placeholder-white/20 focus:outline-none focus:border-white/30 py-0.5"
                  />
                  {SpeechRecognitionCtor && !disabled && (
                    <button
                      type="button"
                      onClick={() => toggleVoiceNote(item)}
                      title={recordingItemId === item.id ? "Stop recording" : "Add note by voice"}
                      className={"flex-shrink-0 p-1 rounded-lg transition " + (recordingItemId === item.id ? "bg-danger-600 text-white animate-pulse" : "bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10")}
                    >
                      <Mic size={11} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_SIGNOFF_DISCLAIMER = "I confirm that all services have been completed to my satisfaction. I accept the work as described and acknowledge that {{company}} is not liable for pre-existing conditions documented in the pre-job checklist. I understand that this serves as a legally binding acceptance of completed work.";

// FEATURE — proximity arrival prompt: "You're near the job site — notify the
// owner you've arrived?" shown once a watched GPS fix lands within this
// radius of the job's geocoded lat/lng. 150m is a reasonable "at the
// property" default for consumer GPS accuracy (which itself can be 10-50m+),
// wide enough to trigger from the driveway/curb without requiring the phone
// be inside the house. NOTE: as of this feature, nothing in the app actually
// geocodes a job's address into lat/lng on save (AddressAutocomplete only
// returns address text, never place.geometry.location) — so this only fires
// for jobs that happen to have lat/lng already populated some other way
// (e.g. manually, or a future geocode step). See JobDetailView's arrival-
// watch effect below.
const ARRIVAL_PROMPT_RADIUS_METERS = 150;

// FIX 13 — exported so the owner's Dashboard can reuse the exact same
// streamlined, mobile-optimized job view a field employee sees (sign-off,
// checklist with photo upload, clock in/out — no admin fields) instead of
// opening the full JobDetailModal for a job the OWNER is personally working.
export function JobDetailView({ job, customer, onBack, onUpdateJob, toast, companyName = "the company", onComplete, perms: permsOverride, maxLunchMinutes = 30, onJobCompleted, googleMapsKey = "", paidLunchBreaks = false, signOffDisclaimer = "", settings = {} as AppSettings, setEstimates = (() => {}) as any, setCustomers = (() => {}) as any, nextJob = null, nextJobCustomer = null, laterJobsToday = [], onArrived, autoComplete = false, employeeName = "", employeeEmail = "", isPreview = false, employees = [] as Employee[], chemicals = [] as any[], busyDates = [] as string[] }: {
  job: Job; customer?: Customer; onBack: () => void;
  onUpdateJob: (patch: Partial<Job>) => void | Promise<any>; toast: (msg: string, tone?: any) => void;
  companyName?: string; onComplete?: () => void; perms?: Record<string, boolean>; maxLunchMinutes?: number;
  onJobCompleted?: (job: Job) => void; googleMapsKey?: string; paidLunchBreaks?: boolean; signOffDisclaimer?: string;
  settings?: AppSettings; setEstimates?: any; setCustomers?: any; nextJob?: Job | null; nextJobCustomer?: Customer | null;
  employees?: Employee[];
  // FEATURE — "upload photos of equipment so an employee can see what they
  // need." Matched against job.equipment/requiredChemicals by name in the
  // Required Equipment & Chemicals section below.
  chemicals?: any[];
  // FEATURE (round 13, item 20) — every job scheduled later TODAY (after this
  // one), used by the Running Late cascade-notify prompt below.
  laterJobsToday?: Array<{ job: Job; customer: Customer | null }>;
  onArrived?: () => void; autoComplete?: boolean; employeeName?: string; employeeEmail?: string; isPreview?: boolean;
  // FEATURE — "reschedule a partially-completed job" date picker highlights
  // days this employee is already scheduled elsewhere, as a lightweight
  // stand-in for "view the calendar" without pulling the full jobs array
  // into this component.
  busyDates?: string[];
}) {
  const effPerms = { ...DEFAULT_PERMISSIONS, ...(permsOverride || {}) };
  const [addCardOpen, setAddCardOpen] = useState(false);
  // Tracks whether the Add Card modal was opened from the in-flow payment
  // step (as opposed to the profile-level "Add Card on File" button) — lets
  // onSaved reload the card list and select the new card immediately, so it
  // can be charged in the same flow instead of the picker showing stale data.
  const [addCardFromMethodStep, setAddCardFromMethodStep] = useState(false);
  const [cascadePrompt, setCascadePrompt] = useState<{ minutes: number } | null>(null);
  const [cascadeSending, setCascadeSending] = useState(false);
  // ITEM 7 — on-site checkout: charging the job total to a card on file.
  const [chargingCardNow, setChargingCardNow] = useState(false);
  // FEATURE — "employees should be able to add multiple cards, set a
  // default, and charge in person." The charge button only ever used the
  // single default card (customer.savedPaymentMethodId) with no way to
  // pick a different one on file — this loads the customer's real card
  // list from Stripe (same listCustomerPaymentMethods the owner's
  // CustomerDetail.tsx already uses) so a picker can appear when there's
  // more than one.
  const [jobCards, setJobCards] = useState<{ id: string; brand?: string; last4?: string }[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [note, setNote] = useState("");
  const [delayNote, setDelayNote] = useState("");
  const [delayNoteOpen, setDelayNoteOpen] = useState(false);
  const [runningLateOpen, setRunningLateOpen] = useState(false);
  const [sendingRunningLate, setSendingRunningLate] = useState(false);
  const [lateReasonNote, setLateReasonNote] = useState("");
  const [lateChannel, setLateChannel] = useState<"sms" | "email">(customer?.phone ? "sms" : "email");
  const [otwOpen, setOtwOpen] = useState(false);
  const [otwChannel, setOtwChannel] = useState<"sms" | "email">(customer?.phone ? "sms" : "email");
  const [sendingOtw, setSendingOtw] = useState(false);
  // FIX 8 — "Report Problem": lets the employee flag an issue (broken
  // equipment, property damage, etc.) straight from the job, the same way
  // OTW/Running Late already notify the customer — this notifies the owner
  // instead, and leaves a permanent record on the job so it shows up in Live
  // Crew View.
  const [reportProblemOpen, setReportProblemOpen] = useState(false);
  const [reportProblemText, setReportProblemText] = useState("");
  const [sendingReportProblem, setSendingReportProblem] = useState(false);
  // FEATURE — "if the job didn't go well, let them opt this job out of the
  // automated review request." skipReviewRequest (migration 0094) is checked
  // by run-automations.ts's review_request candidate filter.
  const [savingSkipReview, setSavingSkipReview] = useState(false);
  const toggleSkipReviewRequest = async () => {
    setSavingSkipReview(true);
    try {
      const next = !(job as any).skipReviewRequest;
      const result = await withTimeout(Promise.resolve(onUpdateJob({ skipReviewRequest: next } as any)), 15000, "Skip review request save");
      if (result?.error) { toast("Failed to save — " + result.error.message, "red"); return; }
      toast(next ? "Won't send a review request for this job ✓" : "Review request re-enabled for this job ✓", "green");
    } catch (e: any) {
      toast("Failed to save — " + (e?.message || "unknown error"), "red");
    } finally {
      setSavingSkipReview(false);
    }
  };
  // FEATURE — "mark a job not-completed/partially-complete, e.g. ran out of
  // chemicals at 90%, with a reason, optional customer message, and a
  // reschedule date." Mirrors the Report Problem pattern above: logs to
  // commLog (visible to the owner everywhere job activity already shows),
  // pushes the job back to "scheduled" on the new date, and optionally
  // notifies the customer — all with the same toast-success/toast-failure
  // convention as every other send action in this file.
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleReasonNote, setRescheduleReasonNote] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleNotifyCustomer, setRescheduleNotifyCustomer] = useState(true);
  const [rescheduleChannel, setRescheduleChannel] = useState<"sms" | "email">(customer?.phone ? "sms" : "email");
  const [sendingReschedule, setSendingReschedule] = useState(false);
  const RESCHEDULE_REASONS = ["Ran out of materials/supplies", "Equipment issue", "Weather", "Customer not home / access issue", "Ran out of time", "Other"];
  const [, forceTick] = useState(0);
  const [showSignOff, setShowSignOff] = useState(false);
  // Tracks whether Sign-Off was opened from mid-way through the Complete Job
  // flow ("Get Sign-Off First"), so saving the signature resumes that flow
  // instead of dropping back to the plain job detail view.
  const [signOffReturnToComplete, setSignOffReturnToComplete] = useState(false);
  const [signerName, setSignerName] = useState("");
  // "Complete Job" flow: review (checklist/sign-off status) → payment → summary
  const [completeStep, setCompleteStep] = useState<"" | "review" | "payment" | "method" | "tip" | "invoice" | "invoice-preview" | "summary">("");
  // FEATURE — "employees should be able to add multiple cards, set a
  // default, and charge in person." The charge button only ever used the
  // single default card (customer.savedPaymentMethodId) with no way to
  // pick a different one on file — this loads the customer's real card
  // list from Stripe (same listCustomerPaymentMethods the owner's
  // CustomerDetail.tsx already uses) so a picker can appear when there's
  // more than one.
  useEffect(() => {
    if (completeStep !== "method" || !customer?.stripeCustomerId || cardsLoaded) return;
    setCardsLoaded(true);
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const cards = await listCustomerPaymentMethods(token, customer.stripeCustomerId!);
        setJobCards(cards);
        setSelectedCardId(customer.savedPaymentMethodId && cards.some(c => c.id === customer.savedPaymentMethodId) ? customer.savedPaymentMethodId : (cards[0]?.id || ""));
      } catch (e: any) {
        console.warn("[JobCharge] failed to load card list, falling back to default only:", e?.message);
      }
    })();
  }, [completeStep, customer?.stripeCustomerId, cardsLoaded]);
  const [paidChoice, setPaidChoice] = useState<"yes" | "no" | "">("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [sendingCompleteInvoice, setSendingCompleteInvoice] = useState(false);
  const [completeSummary, setCompleteSummary] = useState<{ hours: number; amount: number; paymentStatus: string } | null>(null);
  // Tip prompt shown right after a successful in-person card-on-file charge,
  // before handing the phone back to the customer/employee — a separate
  // Stripe charge for the tip amount (the base job charge already went
  // through), same pattern JobDetailModal's owner-side checkout doesn't need
  // since owners aren't the ones physically handing the phone over.
  const [tipChargingNow, setTipChargingNow] = useState(false);
  const [customTipInput, setCustomTipInput] = useState("");
  const [invoiceEditSubject, setInvoiceEditSubject] = useState("");
  const [invoiceEditNote, setInvoiceEditNote] = useState("");
  const [invoiceChannel, setInvoiceChannel] = useState<"email" | "sms">("email");

  // CRITICAL FIX — Complete Job wizard's "Google isn't connected" banner (and
  // the same banner on Running Late/OTW below) used to check
  // settings.googleConnected, which is only ever true on the owner's OWN
  // device (set by applyGoogleIdentity in App.tsx from that device's
  // Supabase auth session). An employee's phone never has that flag, even
  // though sendOwnerGmailOnly/sendInvoiceFromPortal already fetch a working
  // token cross-device via getStoredGoogleConnection() → fetchOwnerGoogleToken()
  // (see lib/messaging.ts) — so the send actually works while this banner
  // wrongly claimed it wouldn't. Check the SAME two sources the real send
  // path uses, so the banner reflects reality instead of a device-local flag.
  const [googleLive, setGoogleLive] = useState<boolean>(() => !!getStoredGoogleConnection()?.token);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (getStoredGoogleConnection()?.token) { if (!cancelled) setGoogleLive(true); return; }
      const cloud = await fetchOwnerGoogleToken();
      if (!cancelled) setGoogleLive(!!cloud?.token);
    };
    check();
    window.addEventListener("focus", check);
    return () => { cancelled = true; window.removeEventListener("focus", check); };
  }, []);

  // Auto-start the complete flow when the parent tells us to (e.g. tapping
  // "Complete" directly on a Today-tab job card rather than going through
  // View Details first).
  useEffect(() => {
    if (autoComplete && job.status !== "completed") {
      setCompleteStep("review");
      setPaidChoice("");
      setPaymentMethod("");
    }
  }, []); // run once on mount // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — proximity arrival prompt. While this job is open (not yet
  // arrived, not completed/cancelled, and the job has a geocoded lat/lng —
  // see ARRIVAL_PROMPT_RADIUS_METERS above), watch GPS and offer to mark
  // arrival once the employee's live position lands within the radius.
  // Guarded so it: never starts without lat/lng on the job, never re-prompts
  // once shown/handled for this job (arrivalHandledRef, local state — reset
  // only on remount, e.g. leaving and reopening this job), and stops
  // watching (clearWatch) the moment it fires or on unmount/nav-away, so it
  // never runs longer than this view is actually on screen.
  const [showArrivalPrompt, setShowArrivalPrompt] = useState(false);
  const arrivalWatchIdRef = useRef<number | null>(null);
  const arrivalHandledRef = useRef(false);
  useEffect(() => {
    arrivalHandledRef.current = false;
    setShowArrivalPrompt(false);
    if (job.arrivedAt || job.status === "completed" || job.status === "cancelled") return;
    if (typeof job.lat !== "number" || typeof job.lng !== "number") return;
    if (!navigator.geolocation) return;
    try {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (arrivalHandledRef.current) return;
          const { latitude, longitude, accuracy } = pos.coords;
          // Ignore low-accuracy fixes near/above the radius itself — a noisy
          // 300m-accuracy fix "matching" a 150m radius would be a false
          // positive, not a real arrival.
          if (accuracy != null && accuracy > ARRIVAL_PROMPT_RADIUS_METERS) return;
          const meters = haversineMiles(job.lat as number, job.lng as number, latitude, longitude) * 1609.34;
          if (meters <= ARRIVAL_PROMPT_RADIUS_METERS) {
            arrivalHandledRef.current = true;
            setShowArrivalPrompt(true);
            if (arrivalWatchIdRef.current != null) {
              navigator.geolocation.clearWatch(arrivalWatchIdRef.current);
              arrivalWatchIdRef.current = null;
            }
          }
        },
        (err) => {
          console.warn("[Arrival Prompt] GPS watch error:", err.code, err.message);
          // Permission denied (or any other terminal error) — stop watching
          // for the rest of this mount instead of leaving a dead watch
          // running or re-prompting for permission.
          arrivalHandledRef.current = true;
          if (arrivalWatchIdRef.current != null) {
            navigator.geolocation.clearWatch(arrivalWatchIdRef.current);
            arrivalWatchIdRef.current = null;
          }
        },
        { enableHighAccuracy: true, maximumAge: 20000, timeout: 20000 }
      );
      arrivalWatchIdRef.current = watchId;
    } catch (e: any) {
      console.warn("[Arrival Prompt] couldn't start GPS watch:", e?.message);
    }
    return () => {
      if (arrivalWatchIdRef.current != null) {
        navigator.geolocation.clearWatch(arrivalWatchIdRef.current);
        arrivalWatchIdRef.current = null;
      }
    };
    // job.id (not just lat/lng) so switching jobs resets arrivalHandledRef;
    // job.arrivedAt/status so arriving (via this prompt, the manual button,
    // or elsewhere) immediately stops the watch.
  }, [job.id, job.arrivedAt, job.status, job.lat, job.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Same action the manual "I'm Here" button below performs — the arrival
  // prompt's "Yes" reuses this exact function rather than a second,
  // parallel notify path.
  // BUG FIX — "when an employee presses arrive at job it should
  // automatically also notify the customer, not just the owner." This only
  // ever updated the job and claimed "owner notified" in the toast — no
  // customer message was ever sent. Fires automatically (no channel picker,
  // unlike On My Way/Running Late which ask) since arrival should just
  // happen the instant it's marked: SMS if a phone's on file, otherwise
  // email, silently skipped only if neither exists.
  const markArrived = async () => {
    // BUG FIX — "if an employee says they arrived it should automatically
    // clock them in." arrivedAt was recorded but the job's own per-job
    // clockInAt (distinct from the whole-day shift timer, and what the
    // owner's own Time Tracking control in this modal reads) was never
    // set — arriving didn't actually start the job clock.
    onUpdateJob({ arrivedAt: Date.now(), status: job.status === "scheduled" ? "in_progress" : job.status, ...(job.clockInAt ? {} : { clockInAt: Date.now() }) });
    haptic(20);
    // AUDIT FIX — this toast claimed "owner notified" but never actually
    // notified the owner at all, only the customer below. A second,
    // separate arrival implementation elsewhere in this file (JobCard's
    // own arriveCard) DID notify the owner, but via generic sendEmail()
    // (Resend-capable) instead of sendOwnerGmailOnly — this codebase's own
    // "never default to Resend" rule (docs/ARCHITECTURE.md) — with its failure fully
    // swallowed. Both are now the same real owner ping, via Gmail only.
    toast("Marked as arrived ✓ — owner notified");
    onArrived?.();
    const arrivalMsg = `Hi ${customer?.firstName || "there"}, your CRM Starter technician has arrived and is getting started!`;
    try {
      if (customer?.phone) {
        await twilioSend(settings as any, customer.phone, arrivalMsg);
        logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: arrivalMsg }).catch(() => {});
      } else if (customer?.email) {
        const html = emailShell(settings, "We've Arrived", `<p>${arrivalMsg}</p>`);
        await sendOwnerGmailOnly(settings as any, customer.email, "Your technician has arrived", html);
      }
    } catch (e: any) {
      console.warn("[Arrival] customer notify failed:", e?.message);
    }
    const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
    if (ownerEmail) {
      const ownerHtml = emailShell(settings, "Crew Arrived", `<p>${customer ? customer.firstName + " " + customer.lastName : job.address} — technician has arrived on site.</p><p>Address: ${job.address}</p>`);
      sendOwnerGmailOnly(settings as any, ownerEmail, `Arrived — ${job.address}`, ownerHtml).catch((e: any) => console.warn("[Arrival] owner notify failed:", e?.message));
    }
  };

  const hasRequiredGear = (job.equipment || []).length > 0 || (job.requiredChemicals || []).length > 0;
  const sendRunningLate = async (minutes: number) => {
    // See sendOtw's matching comment — a delayed "running late" text is
    // actively misleading, so this also fails fast offline rather than
    // queuing.
    if (typeof navigator !== "undefined" && !navigator.onLine) { toast("No internet connection — sending a message needs a live connection. Try again once you're back online.", "red"); return; }
    setSendingRunningLate(true);
    const nowMs = Date.now() + minutes * 60000;
    const newEta = new Date(nowMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const noteStr = lateReasonNote.trim() ? ` Reason: ${lateReasonNote.trim()}.` : "";
    const msg = `Your CRM Starter technician is running approximately ${minutes} minutes behind.${noteStr} New ETA: ${newEta}. We apologize for the delay.`;
    try {
      if (lateChannel === "sms") {
        if (!customer?.phone) throw new Error("No phone on file for this customer.");
        await withTimeout(twilioSend(settings as any, customer.phone, `Hi ${customer.firstName}, ${msg}`), 15000, "Running late SMS");
        logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: `Hi ${customer.firstName}, ${msg}` }).catch(() => {});
      } else {
        if (!customer?.email) throw new Error("No email on file for this customer.");
        const html = emailShell(settings, "Running Late", `<p>Hi ${customer.firstName},</p><p>${msg}</p>`);
        await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, "Your technician is running late", html), 15000, "Running late email");
      }
      const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
      if (ownerEmail) {
        const ownerHtml = emailShell(settings, "Crew Running Late", `<p>${customer ? customer.firstName + " " + customer.lastName : job.address} — running ~${minutes} min late${lateReasonNote.trim() ? ` (${lateReasonNote.trim()})` : ""}.</p><p>Address: ${job.address}</p>`);
        sendOwnerGmailOnly(settings as any, ownerEmail, `Running late — ${job.address}`, ownerHtml).catch(() => {});
      }
      const newScheduledTime = shiftScheduledTime(job.scheduledTime, minutes);
      onUpdateJob({
        commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: localDateStr(), note: `⏱ Running late +${minutes}min — notified customer via ${lateChannel === "sms" ? "text" : "email"}${lateReasonNote.trim() ? ` (${lateReasonNote.trim()})` : ""}` }],
        ...(newScheduledTime ? { scheduledTime: newScheduledTime } : {}),
      });
      toast(`✅ Message sent to ${customer?.firstName || "customer"}`, "green");
      console.log("[Verify] Running Late toast + send — working");
      setRunningLateOpen(false);
      setLateReasonNote("");
      // FEATURE (round 13, item 20) — offer to cascade the delay notice to
      // every OTHER customer scheduled later today, instead of leaving them
      // to find out only when their own job runs late too.
      if (laterJobsToday.length > 0) setCascadePrompt({ minutes });
    } catch (e: any) {
      console.error("[RunningLate] — error:", e?.message || e);
      toast(`❌ Failed to send — ${e?.message || "reason unknown"}`, "red");
    } finally {
      setSendingRunningLate(false);
    }
  };

  // FEATURE (round 13, item 20) — best-effort notify of every later job
  // today; each send is caught individually so one bad contact doesn't stop
  // the rest, and the final toast reports real sent/failed counts.
  const sendCascadeRunningLate = async (minutes: number) => {
    setCascadeSending(true);
    let sent = 0, failed = 0;
    for (const { job: lj, customer: lc } of laterJobsToday) {
      if (!lc) { failed++; continue; }
      const msg = `Hi ${lc.firstName}, heads up — your CRM Starter crew is running about ${minutes} minutes behind schedule today. We'll keep you posted as we get closer. Thanks for your patience!`;
      try {
        if (lc.phone) {
          await twilioSend(settings as any, lc.phone, msg);
          logOutboundSmsToInbox({ contactName: `${lc.firstName} ${lc.lastName}`, contactPhone: lc.phone, customerId: lc.id, body: msg }).catch(() => {});
        } else if (lc.email) {
          await sendOwnerGmailOnly(settings as any, lc.email, "Running a bit behind today", emailShell(settings, "Running Late", `<p>Hi ${lc.firstName},</p><p>${msg}</p>`));
        } else {
          throw new Error("No phone or email on file");
        }
        sent++;
      } catch (e: any) {
        failed++;
        console.warn("[RunningLate cascade] failed for", lc.id, "—", e?.message);
      }
    }
    setCascadeSending(false);
    setCascadePrompt(null);
    toast(failed > 0 ? `Notified ${sent} customer${sent !== 1 ? "s" : ""}, ${failed} failed` : `Notified ${sent} following customer${sent !== 1 ? "s" : ""} ✓`, failed > 0 ? "yellow" : "green");
  };

  const sendOtw = async () => {
    // FEATURE — "if certain functions cannot work offline, display an
    // error message indicating limited functionality." Sending a real SMS/
    // email needs a live connection to Twilio/Gmail — there's nothing
    // useful to queue for later (an "on my way" text sent an hour late is
    // worse than not sending one), so this fails fast with a clear reason
    // instead of hanging on the 15s timeout below only to fail anyway.
    if (typeof navigator !== "undefined" && !navigator.onLine) { toast("No internet connection — sending a message needs a live connection. Try again once you're back online.", "red"); return; }
    setSendingOtw(true);
    const msg = `Hi ${customer?.firstName || "there"}, your CRM Starter technician is on the way!`;
    try {
      if (otwChannel === "sms") {
        if (!customer?.phone) throw new Error("No phone on file for this customer.");
        await withTimeout(twilioSend(settings as any, customer.phone, msg), 15000, "OTW SMS");
        logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: msg }).catch(() => {});
      } else {
        if (!customer?.email) throw new Error("No email on file for this customer.");
        const html = emailShell(settings, "On My Way", `<p>${msg}</p>`);
        await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, "Your technician is on the way", html), 15000, "OTW email");
      }
      onUpdateJob({ commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: localDateStr(), note: `📍 On my way message sent via ${otwChannel === "sms" ? "text" : "email"}` }] });
      toast(`✅ Message sent to ${customer?.firstName || "customer"}`, "green");
      console.log("[Verify] On My Way toast + send — working");
      setOtwOpen(false);
    } catch (e: any) {
      console.error("[OTW] — error:", e?.message || e);
      toast(`❌ Failed to send — ${e?.message || "reason unknown"}`, "red");
    } finally {
      setSendingOtw(false);
    }
  };

  // FIX 8 — "Report Problem": logs to commLog (so it's visible to the owner
  // wherever job activity already shows, including Live Crew View) AND emails
  // the owner immediately, matching the toast-on-success-and-failure
  // convention every other send action in this file follows.
  const sendReportProblem = async () => {
    if (!reportProblemText.trim()) { toast("Describe the issue first", "red"); return; }
    setSendingReportProblem(true);
    const note = `🚨 ISSUE REPORTED by ${employeeName || "crew"}: ${reportProblemText.trim()}`;
    try {
      // BUG FIX — "it just sat at saving for a while and I got a timed-out
      // error" even though the write likely succeeded a few seconds later.
      // onUpdateJob (updateJob in this file) already has its OWN internal
      // timeout + one retry (up to ~40s worst case) before it ever resolves
      // with {error} — wrapping it AGAIN here with a SHORTER 15s outer
      // timeout meant this outer race always lost first on any real
      // slowness, firing a premature "timed out" toast while the actual
      // update kept running in the background (withTimeout doesn't abort
      // the underlying request, just stops waiting on it) and often landed
      // successfully moments later with nobody watching. The outer ceiling
      // now safely exceeds the inner worst case instead of undercutting it.
      const result = await withTimeout(Promise.resolve(onUpdateJob({ commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: localDateStr(), note }] })), 45000, "Report problem save");
      if (result?.error) {
        console.error("[ReportProblem] — error:", result.error.message);
        toast("Saved locally, but failed to sync — " + result.error.message, "red");
        return;
      }
      // AUDIT FIX — this used to fire-and-forget the email (.catch(console.warn)
      // only) and then ALWAYS toast success regardless of whether it actually
      // sent — a hung Gmail circuit or missing owner email meant the employee
      // saw "reported ✓" while the owner never got anything. Now awaited, and
      // also CCs the reporting employee's own email (via the owner's
      // connected Gmail, since employees don't all have their own Google
      // linked) so they have a written copy of what they reported.
      const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
      const recipients = [ownerEmail, employeeEmail].filter(Boolean);
      let emailSent = false;
      let emailError = "";
      if (recipients.length > 0) {
        const html = emailShell(settings, "Issue Reported", `<p><b>${employeeName || "A crew member"}</b> reported an issue on the job at <b>${job.address || "a job"}</b>:</p><p style="background:#fff3cd;color:#333;padding:10px;border-radius:6px">${reportProblemText.trim()}</p>`);
        try {
          await withTimeout(sendOwnerGmailOnly(settings as any, recipients.join(", "), `⚠️ Issue reported — ${job.address || "job"}`, html), 15000, "Report problem email");
          emailSent = true;
        } catch (e: any) {
          emailError = e?.message || "unknown error";
          console.warn("[ReportProblem] email failed:", emailError);
        }
      }
      console.log("[ReportProblem] logged for job", job.id, "· email sent:", emailSent, "· recipients:", recipients);
      if (!ownerEmail) {
        toast("Reported and saved to job notes — but no owner email is on file, so no email was sent. Ask the owner to set one in Settings.", "red");
      } else if (emailSent) {
        toast("Problem reported to the owner ✓", "green");
      } else {
        toast("Saved to job notes, but the email failed to send — " + emailError, "red");
      }
      setReportProblemOpen(false);
      setReportProblemText("");
    } catch (e: any) {
      console.error("[ReportProblem] — error:", e?.message || e);
      toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red");
    } finally {
      setSendingReportProblem(false);
    }
  };

  const sendReschedule = async () => {
    if (!rescheduleReason) { toast("Pick a reason first", "red"); return; }
    // FEATURE — "let me press Finish to mark a job not-finished WITHOUT
    // picking a reschedule date — it should show up in Unscheduled." A date
    // is now optional: no date clears scheduledDate entirely (which is what
    // already qualifies a job for the owner's Unscheduled tab), a picked
    // date sets it as before. Either way needsReschedule is set so the
    // owner's Unscheduled tab surfaces it — including the picked-a-date
    // case, per explicit request, until the owner clears it by confirming
    // a real schedule.
    const hasDate = !!rescheduleDate;
    setSendingReschedule(true);
    const reasonText = rescheduleReason === "Other" && rescheduleReasonNote.trim() ? rescheduleReasonNote.trim() : rescheduleReason;
    const note = hasDate
      ? `⏸️ NOT COMPLETED by ${employeeName || "crew"} — ${reasonText}. Rescheduled to ${rescheduleDate}.`
      : `⏸️ NOT COMPLETED by ${employeeName || "crew"} — ${reasonText}. Needs a new date — moved to Unscheduled.`;
    try {
      // BUG FIX — see the identical fix + full explanation on Report
      // Problem's save above: onUpdateJob already retries internally for
      // up to ~40s, so this outer ceiling must exceed that, not undercut it.
      const result = await withTimeout(Promise.resolve(onUpdateJob({
        status: "scheduled",
        scheduledDate: hasDate ? rescheduleDate : "",
        needsReschedule: true,
        commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: localDateStr(), note }],
      })), 45000, "Reschedule save");
      if (result?.error) {
        console.error("[Reschedule] — error:", result.error.message);
        toast("Saved locally, but failed to sync — " + result.error.message, "red");
        return;
      }
      let msgSent = false;
      let msgError = "";
      if (rescheduleNotifyCustomer) {
        const custMsg = hasDate
          ? `Hi ${customer?.firstName || "there"}, we weren't able to finish today's service (${reasonText.toLowerCase()}) and have rescheduled you for ${new Date(rescheduleDate + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}. Sorry for the inconvenience — we'll take care of it then!`
          : `Hi ${customer?.firstName || "there"}, we weren't able to finish today's service (${reasonText.toLowerCase()}). We'll reach out shortly to get you rescheduled. Sorry for the inconvenience!`;
        try {
          if (rescheduleChannel === "sms") {
            if (!customer?.phone) throw new Error("No phone on file for this customer.");
            await withTimeout(twilioSend(settings as any, customer.phone, custMsg), 15000, "Reschedule SMS");
            logOutboundSmsToInbox({ contactName: `${customer?.firstName} ${customer?.lastName}`, contactPhone: customer.phone, customerId: customer?.id, body: custMsg }).catch(() => {});
          } else {
            if (!customer?.email) throw new Error("No email on file for this customer.");
            const html = emailShell(settings, "Job Rescheduled", `<p>${custMsg}</p>`);
            await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, "Your service has been rescheduled", html), 15000, "Reschedule email");
          }
          msgSent = true;
        } catch (e: any) {
          msgError = e?.message || "unknown error";
          console.warn("[Reschedule] customer notify failed:", msgError);
        }
      }
      haptic(15);
      const baseMsg = hasDate ? `Job rescheduled to ${rescheduleDate}` : "Job marked not finished — moved to Unscheduled";
      if (!rescheduleNotifyCustomer) {
        toast(`${baseMsg} ✓`, "green");
      } else if (msgSent) {
        toast(`${baseMsg} — customer notified ✓`, "green");
      } else {
        toast(`${baseMsg}, but the customer message failed — ${msgError}`, "red");
      }
      setRescheduleOpen(false);
      setRescheduleReason("");
      setRescheduleReasonNote("");
      setRescheduleDate("");
      onBack();
    } catch (e: any) {
      console.error("[Reschedule] — error:", e?.message || e);
      toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red");
    } finally {
      setSendingReschedule(false);
    }
  };

  const addPhoto = async (type: "before" | "after", dataUrl: string, explicitPairIndex?: number, requirementId?: string) => {
    const id = uid();
    const caption = (type === "before" ? "Before" : "After") + " — " + localDateStr();
    const url = await uploadJobMedia(dataUrlToBlob(dataUrl), `${job.id}/photo-${id}.jpg`, "image/jpeg");
    // BUG FIX — "it matched the wrong photo to the wrong photo. Is there a
    // way we can link a before and after for each photo?" The slider used
    // to just grab the FIRST "before" and FIRST "after" in the whole
    // photos array with no pairing at all — with more than one before/
    // after pair on a job (different areas of the same property), that
    // silently mismatched whichever ones happened to be first. pairIndex
    // links the Nth "before" taken to the Nth "after" taken, so multiple
    // real pairs render as multiple correctly-matched sliders instead of
    // one wrong one. explicitPairIndex lets the "assign to a specific
    // before" picker (below) override the default next-slot assignment
    // when the employee wants to link an after to a SPECIFIC earlier
    // before rather than whichever's next in line.
    const pairIndex = explicitPairIndex ?? (job.photos || []).filter((p: any) => p.type === type).length;
    const newPhoto = url ? { id, type, pairIndex, caption, url, uploadedAt: localDateStr() } : { id, type, pairIndex, caption, dataUrl, uploadedAt: localDateStr() };
    const nextPhotos = [...(job.photos || []), newPhoto];
    // FEATURE — commercial work-order photo requirements (migration 0094):
    // tags this photo against the requirement it satisfies so
    // WorkOrderRequirementsCard can compute real progress, without touching
    // the existing before/after slider logic above at all.
    const nextTags = requirementId ? { ...((job as any).photoRequirementTags || {}), [id]: requirementId } : (job as any).photoRequirementTags;
    try {
      // BUG FIX — same outer-shorter-than-inner-timeout bug as Report
      // Problem/Reschedule above.
      const result = await withTimeout(Promise.resolve(onUpdateJob({ photos: nextPhotos, ...(requirementId ? { photoRequirementTags: nextTags } : {}) } as any)), 45000, "Photo upload");
      if (result?.error) {
        console.error("[PhotoSync] — error:", result.error.message);
        toast("Photo saved locally, but failed to sync — " + result.error.message, "red");
      } else {
        haptic(15);
        toast(type === "before" ? "Before photo added ✓" : "After photo added ✓", "green");
      }
    } catch (e: any) {
      console.error("[PhotoSync] — error:", e?.message || e);
      toast("Photo saved locally, but failed to sync — " + (e?.message || "unknown error"), "red");
    }
  };

  const addVideo = async (file: File, requirementId?: string) => {
    // ITEM 11 — shared with PortalChecklistSection's checklist-item video
    // capture (see checkVideoLimits) so both paths enforce the same cap.
    const limitErr = await checkVideoLimits(file);
    if (limitErr) { toast(limitErr, "red"); return; }
    const r = new FileReader();
    r.onload = async ev => {
      const dataUrl = ev.target!.result as string;
      const id = uid();
      const ext = (file.type.split("/")[1] || "mp4").replace("quicktime", "mov");
      const url = await uploadJobMedia(file, `${job.id}/video-${id}.${ext}`, file.type);
      const newVideo = url ? { id, url, caption: "Field video", addedAt: localDateStr() } : { id, dataUrl, caption: "Field video", addedAt: localDateStr() };
      const nextTags = requirementId ? { ...((job as any).photoRequirementTags || {}), [id]: requirementId } : (job as any).photoRequirementTags;
      // BUG FIX (audit) — unlike addPhoto right above it, this fired
      // "Video added ✓" unconditionally with no timeout wrapper and no
      // check of the update's result — a failed sync (owner never sees
      // the video) looked identical to a successful one. Mirrors addPhoto's
      // withTimeout + result-check + red-toast-on-failure pattern.
      try {
        const result = await withTimeout(Promise.resolve(onUpdateJob({ videos: [...(job.videos || []), newVideo], ...(requirementId ? { photoRequirementTags: nextTags } : {}) } as any)), 45000, "Video upload");
        if (result?.error) {
          console.error("[VideoSync] — error:", result.error.message);
          toast("Video saved locally, but failed to sync — " + result.error.message, "red");
        } else {
          toast("Video added ✓", "green");
        }
      } catch (e: any) {
        console.error("[VideoSync] — error:", e?.message || e);
        toast("Video saved locally, but failed to sync — " + (e?.message || "unknown error"), "red");
      }
    };
    r.readAsDataURL(file);
  };

  const addNote = () => {
    if (!note.trim()) return;
    // FIX 6 — full ISO timestamp (not just localDateStr()'s bare date) so the owner
    // can tell when during the day a note was left, not just which day. The
    // "today's field notes" dashboard alerts match on the date PREFIX (see
    // App.tsx / Dashboard.tsx), so this stays compatible with those.
    const entry = { id: uid(), type: "note" as const, date: new Date().toISOString(), note: note.trim() };
    onUpdateJob({ commLog: [...(job.commLog || []), entry] });
    setNote("");
    toast("Note added ✓", "green");
  };

  // Saves the signature only — completion itself (and any payment info) is
  // handled by the separate "Complete Job" flow, so sign-off can happen
  // independently without forcing the job closed.
  // BUG FIX — "Pressing Sign and Save after the customer signs does not
  // work." Two compounding problems, found from the owner's own console
  // logs ("Media upload to Storage timed out", "Sign off saved timed out"):
  // (1) the signature-photo upload has its own 15s timeout, and the JOB
  // update after it has ANOTHER 15s timeout — back to back, that's up to
  // 30 SECONDS of total silent waiting with the button still enabled and no
  // "Saving…" indicator at all, which reads as "the button doesn't do
  // anything" long before either timeout actually fires and finally shows
  // an error. (2) With no busy state, a frustrated employee tapping it
  // again just re-runs the whole slow chain from scratch. Now: a visible
  // saving/disabled state the instant it's pressed, a single bounded 20s
  // deadline over the WHOLE operation (upload + save) instead of two
  // separate 15s waits stacking, and the button can't be double-tapped
  // mid-save.
  const [savingSignOff, setSavingSignOff] = useState(false);
  const saveSignOff = async () => {
    if (savingSignOff) return;
    if (sigMode === "type") {
      if (!signerName.trim()) return;
    } else if (!sigDrawData) return;
    setSavingSignOff(true);
    try {
      await withTimeout((async () => {
        let sigUrl: string | undefined;
        if (sigMode === "draw" && sigDrawData) {
          sigUrl = (await uploadJobMedia(dataUrlToBlob(sigDrawData), `${job.id}/signoff-${uid()}.png`, "image/png")) || undefined;
        }
        // FEATURE — manager sign-off (commercial work orders) writes to its
        // own separate fields instead of the customer signOff object, so a
        // customer's own sign-off (if this job also has one) is never
        // overwritten by a manager's, or vice versa.
        if (sigTarget === "manager") {
          const patch: Partial<Job> = {
            managerSignedAt: new Date().toISOString(),
            managerSignedBy: signerName.trim() || "Manager",
            managerSignatureDataUrl: sigMode === "draw" ? (sigUrl || sigDrawData || undefined) : undefined,
          };
          const result = await onUpdateJob(patch);
          if (result?.error) throw new Error(result.error.message);
          return;
        }
        const signOff: any = {
          signerName: signerName.trim() || "Drawn signature",
          timestamp: new Date().toISOString(),
          sigType: sigMode,
          ...(sigMode === "draw" ? (sigUrl ? { sigUrl } : { sigData: sigDrawData }) : {}),
        };
        // AUDIT H (mobile round 4) — this used to fire onUpdateJob and
        // unconditionally toast "saved" without awaiting the result.
        // onUpdateJob never rejects (it resolves {error} on failure, see
        // updateJob above), so a genuine Supabase save failure was silently
        // swallowed — the customer's signature could be lost while the
        // employee saw a green success toast.
        const result = await onUpdateJob({ signOff });
        if (result?.error) throw new Error(result.error.message);
      })(), 25000, "Sign-off save");
      toast(sigTarget === "manager" ? "Manager sign-off saved ✓" : "Sign-off saved ✓", "green");
      setShowSignOff(false);
      setSigTarget("customer");
      if (signOffReturnToComplete) {
        setSignOffReturnToComplete(false);
        setCompleteStep("review");
      }
    } catch (e: any) {
      toast("Sign-off not saved — " + (e?.message || "unknown error") + ". Check your connection and try again.", "red");
    } finally {
      setSavingSignOff(false);
    }
  };

  // AUDIT H (mobile round 4) — checklist toggle/notes/photo/video actions
  // (PortalChecklistSection's onUpdate) used to call onUpdateJob completely
  // fire-and-forget, with no toast at all on success or failure. A failed
  // save (RLS, dropped connection, etc.) looked identical to a successful one
  // — the checkbox visually flipped locally but nothing was actually
  // persisted. Only toast on FAILURE here (not on every successful toggle —
  // the checkbox itself is the success confirmation and a toast on every tap
  // would be noisy), matching this file's other checklist-adjacent saves.
  // FEATURE — "assign specific checklist items to specific employees."
  // Resolve the crew on THIS job to real names for the assignee badges, and
  // resolve which one is the person currently viewing the portal (matched
  // by email, the one identifier JobDetailView reliably gets passed) so
  // PortalChecklistSection can tell "assigned to me" apart from "assigned
  // to someone else on the crew."
  const checklistCrewOptions = normalizeCrewArray(job.crew)
    .map(crewEntryId)
    .map(id => employees.find((e: any) => e.id === id || e.user_id === id))
    .filter(Boolean)
    .map((e: any) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`.trim() }));
  const myEmployeeIdForChecklist = employees.find((e: any) => e.email === employeeEmail)?.id || "";

  const saveChecklist = async (label: string, patch: Partial<Job>) => {
    try {
      // BUG FIX — same outer-shorter-than-inner-timeout bug as above.
      const result = await withTimeout(Promise.resolve(onUpdateJob(patch)), 45000, label + " checklist save");
      if (result?.error) toast(label + " checklist item didn't save — " + result.error.message, "red");
    } catch (e: any) {
      toast(label + " checklist item didn't save — " + (e?.message || "unknown error"), "red");
    }
  };

  // FEATURE — hands-free voice control for the checklist. Per-item note
  // dictation already existed (PortalChecklistSection's mic button), but
  // wet/gloved hands mid-job can't tap a checkbox either — this lets a
  // crew member just say an item's name to check it off, or describe a
  // problem out loud to open the existing Report Problem flow pre-filled,
  // without touching the phone at all. Same Web Speech API (no key, no
  // backend call) the per-item note dictation above already relies on.
  //
  // GUARDRAIL — this whole feature is deliberately scoped to two, and only
  // two, effects: toggling checklist item done/not-done, and pre-filling
  // (never sending) the Report Problem draft. Nothing voice-driven here can
  // complete a job, send an SMS/email, or touch a customer — those stay
  // behind their own explicit buttons. Multi-item batches and the AI
  // fallback below only ever pick from the job's OWN existing checklist item
  // ids; neither can invent a new action. Every match, single or multi, is
  // shown back to the crew member as a "Did you mean…" card they must
  // explicitly confirm before anything saves — nothing applies from voice
  // alone, so a misheard word never silently changes the job.
  const VoiceCmdCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const [voiceCmdActive, setVoiceCmdActive] = useState(false);
  const voiceCmdRecRef = useRef<any>(null);
  const voiceCmdKeepRef = useRef(false);
  type VoiceMatch = { list: "pre" | "during" | "post"; item: JobChecklistItem; action: "check" | "uncheck" };
  const [voicePending, setVoicePending] = useState<{ matches: VoiceMatch[]; transcript: string } | null>(null);
  const [voiceNoMatch, setVoiceNoMatch] = useState<string | null>(null);
  const [voiceThinking, setVoiceThinking] = useState(false);
  const [voiceTypedText, setVoiceTypedText] = useState("");
  const normalizeVoice = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  // BUG FIX — "voice commands are very bad, fuzzy matching does not work."
  // The matcher required an EXACT token match ("rinse" in the checklist item
  // vs. the speech engine hearing "rinsed", or "ladder" vs "ladders") — one
  // different suffix and the word simply never matched at all, which is the
  // single most common way speech-to-text output differs from a checklist
  // label. A tiny stemmer (strip -ing/-ed/-es/-s) plus a substring fallback
  // for longer words makes near-misses actually count as fuzzy matches
  // instead of requiring a letter-for-letter hit.
  const stemVoiceWord = (w: string): string => w.replace(/(ing|ies|ed|es|s)$/,
    m => (w.length - m.length >= 3 ? "" : m));
  const voiceWordsMatch = (a: string, b: string): boolean => {
    if (a === b) return true;
    const sa = stemVoiceWord(a), sb = stemVoiceWord(b);
    if (sa === sb) return true;
    // Longer words tolerate a mis-transcribed tail/head (e.g. "drivewy" ~ "driveway").
    if (a.length >= 5 && b.length >= 5 && (a.startsWith(b.slice(0, 4)) || b.startsWith(a.slice(0, 4)))) return true;
    return false;
  };
  const VOICE_PROBLEM_KEYWORDS = ["problem", "issue", "broken", "damage", "damaged", "hazard", "injury", "hurt", "leak", "leaking", "not working", "malfunction"];
  const VOICE_UNCHECK_KEYWORDS = ["uncheck", "undo", "not done", "unmark", "wasn't done", "mistake"];
  const VOICE_STOPWORDS = new Set(["check", "off", "mark", "done", "complete", "completed", "the", "item", "finished", "please", "and"]);
  const findVoiceChecklistMatch = (transcript: string): { list: "pre" | "during" | "post"; item: JobChecklistItem; score: number } | null => {
    const words = Array.from(new Set(normalizeVoice(transcript).split(" ").filter(w => w.length > 2 && !VOICE_STOPWORDS.has(w))));
    if (words.length === 0) return null;
    let best: { list: "pre" | "during" | "post"; item: JobChecklistItem; score: number } | null = null;
    const sources: Array<["pre" | "during" | "post", JobChecklistItem[]]> = [["pre", preItems], ["during", durItems], ["post", postItems]];
    for (const [key, list] of sources) {
      for (const item of list) {
        const itemWords = normalizeVoice(item.label).split(" ").filter(w => w.length > 2);
        if (itemWords.length === 0) continue;
        const overlap = itemWords.filter(iw => words.some(w => voiceWordsMatch(iw, w))).length;
        const score = overlap / itemWords.length;
        if (overlap > 0 && (!best || score > best.score)) best = { list: key, item, score };
      }
    }
    // Lowered from 0.5 — fuzzy stemmed matches already reduce false
    // positives enough that requiring half the item's words was too strict
    // for short labels ("Rinse thoroughly" needing both words verbatim).
    return best && best.score >= 0.4 ? best : null;
  };
  // FEATURE — "I just completed these things" (plural). Splits on
  // and/commas/"then" so one breath covering several items ("ladder setup
  // and the gutters and the walkway") is matched item-by-item instead of
  // only ever finding the single best-scoring item in the whole sentence.
  const splitVoiceSegments = (transcript: string): string[] =>
    transcript.split(/\s*,\s*|\s+and then\s+|\s+and also\s+|\s+then\s+|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
  const findVoiceChecklistMatches = (transcript: string): VoiceMatch[] => {
    const globalUncheck = VOICE_UNCHECK_KEYWORDS.some(k => normalizeVoice(transcript).includes(k));
    const segments = splitVoiceSegments(transcript);
    const bySegment = segments.length > 1 ? segments : [transcript];
    const seen = new Map<string, VoiceMatch>();
    for (const seg of bySegment) {
      const m = findVoiceChecklistMatch(seg);
      if (!m) continue;
      const wantUncheck = VOICE_UNCHECK_KEYWORDS.some(k => normalizeVoice(seg).includes(k)) || (bySegment.length === 1 && globalUncheck);
      const existing = seen.get(m.item.id);
      if (!existing || m.score > 0) seen.set(m.item.id, { list: m.list, item: m.item, action: wantUncheck ? "uncheck" : "check" });
    }
    return Array.from(seen.values());
  };
  // FEATURE — AI-assisted fallback when the plain word-overlap match above
  // finds nothing (a paraphrase, a synonym, background noise mangling a
  // word). Only runs if the owner has an AI model + key configured in
  // Settings; fails silently (falls through to "didn't recognize") if not,
  // rather than blocking the whole voice feature on an API key. The model
  // is given ONLY this job's checklist item ids/labels and told to pick
  // from them — its output is still whitelist-checked against real item ids
  // below before ever reaching voicePending, and even then only reaches the
  // same confirm-first flow every other match goes through.
  const aiMatchChecklist = async (transcript: string): Promise<VoiceMatch[]> => {
    const priority: string[] = (settings as any)?.modelPriority || ["claude", "openai", "gemini", "groq", "mistral"];
    const modelKeys = (settings as any)?.modelKeys || {};
    const modelId = priority.find((mid: string) => { const m = (MODELS as any)[mid]; return m && (!m.needsKey || !!modelKeys[mid]); });
    if (!modelId) return [];
    const sources: Array<["pre" | "during" | "post", JobChecklistItem[]]> = [["pre", preItems], ["during", durItems], ["post", postItems]];
    const catalog = sources.flatMap(([list, items]) => items.map(it => ({ id: it.id, list, label: it.label })));
    if (catalog.length === 0) return [];
    try {
      const res = await withTimeout(callModel({
        modelId,
        apiKey: modelKeys[modelId],
        maxTokens: 300,
        systemPrompt: "You match a spoken phrase from a service crew member to items on their job checklist. Reply with ONLY a JSON array, nothing else — no prose, no markdown fences. Each element: {\"id\": \"<one of the given item ids>\", \"action\": \"check\" or \"uncheck\"}. Only include items you're reasonably confident the speaker meant. If none match, reply with an empty array [].",
        messages: [{ role: "user", content: `Checklist items:\n${catalog.map(c => `${c.id}: ${c.label}`).join("\n")}\n\nSpoken phrase: "${transcript}"` }],
      }), 12000, "Voice AI match");
      const text = (res.text || "").trim();
      const jsonStr = text.startsWith("[") ? text : (text.match(/\[[\s\S]*\]/) || [""])[0];
      const parsed = JSON.parse(jsonStr || "[]");
      if (!Array.isArray(parsed)) return [];
      const byId = new Map(catalog.map(c => [c.id, c]));
      return parsed
        .filter((p: any) => p && typeof p.id === "string" && byId.has(p.id))
        .map((p: any) => {
          const c = byId.get(p.id)!;
          const item = (c.list === "pre" ? preItems : c.list === "during" ? durItems : postItems).find(it => it.id === c.id)!;
          return { list: c.list, item, action: p.action === "uncheck" ? "uncheck" : "check" } as VoiceMatch;
        });
    } catch (e: any) {
      console.warn("[VoiceAI] checklist match failed:", e?.message);
      return [];
    }
  };
  const confirmVoicePending = () => {
    if (!voicePending) return;
    const { matches } = voicePending;
    const patch = (list: "pre" | "during" | "post", items: JobChecklistItem[]) => {
      const forList = matches.filter(m => m.list === list);
      if (forList.length === 0) return items;
      return items.map(it => { const m = forList.find(x => x.item.id === it.id); return m ? { ...it, done: m.action === "check" } : it; });
    };
    const nextPre = patch("pre", preItems), nextDur = patch("during", durItems), nextPost = patch("post", postItems);
    if (matches.some(m => m.list === "pre")) saveChecklist("Pre-Job", { preChecklist: nextPre });
    if (matches.some(m => m.list === "during")) saveChecklist("During-Job", { duringChecklist: nextDur });
    if (matches.some(m => m.list === "post")) saveChecklist("Post-Job", { postChecklist: nextPost });
    toast(`🎙️ ${matches.map(m => (m.action === "check" ? "✓ " : "Unmarked: ") + m.item.label).join(" · ")}`, "green");
    setVoicePending(null);
    setVoiceTypedText("");
  };
  const cancelVoicePending = () => { setVoicePending(null); setVoiceNoMatch(null); setVoiceTypedText(""); };
  // FEATURE — "voice typing should understand actions, not just transcribe
  // or check off checklist items." Extends the existing voice-command
  // recognizer (problem-keyword detection + checklist matching, above) with
  // a fixed set of job actions — "send the invoice," "pull up the
  // signature," "I just finished this job," etc (see lib/voiceCommands.ts).
  // Anything that sends a real message to the customer or otherwise can't be
  // easily undone (matchVoiceCommand's `dangerous` flag) requires a spoken-
  // aloud confirm via window.confirm before it actually fires — a misheard
  // "send the invoice" should never silently text a customer.
  const dispatchVoiceAction = async (match: NonNullable<ReturnType<typeof matchVoiceCommand>>) => {
    if (match.dangerous && !window.confirm(`Voice command heard: "${match.label}". Do this now?`)) {
      toast("🎙️ Cancelled", "yellow");
      return;
    }
    switch (match.id) {
      case "send_invoice":
        toast("🎙️ Sending invoice…", "yellow");
        await sendInvoiceFromPortal();
        break;
      case "open_signature":
        setShowSignOff(true);
        toast("🎙️ Opening signature screen", "green");
        break;
      case "start_complete_job":
        startCompleteFlow();
        toast("🎙️ Starting job completion", "green");
        break;
      case "on_my_way":
        await sendOtw();
        break;
      case "running_late":
        // Doesn't send directly — "running late" needs a minutes value this
        // recognizer has no reliable way to parse from speech, so it opens
        // the existing panel for the employee to pick one and confirm there.
        setRunningLateOpen(true);
        toast("🎙️ Opening Running Late — pick how many minutes", "green");
        break;
      case "report_problem":
        setReportProblemOpen(true);
        toast("🎙️ Opening problem report", "green");
        break;
      case "clock_in":
      case "clock_out":
        toast("🎙️ Clock in/out isn't available from this screen — use the shift timer on the main job list.", "yellow");
        break;
    }
  };

  const handleVoiceCommand = async (raw: string) => {
    const transcript = raw.trim();
    if (!transcript) return;
    setVoiceNoMatch(null);
    const actionMatch = matchVoiceCommand(transcript);
    if (actionMatch) {
      await dispatchVoiceAction(actionMatch);
      return;
    }
    const norm = normalizeVoice(transcript);
    if (VOICE_PROBLEM_KEYWORDS.some(k => norm.includes(k))) {
      setReportProblemText(transcript);
      setReportProblemOpen(true);
      toast("🎙️ Heard a problem — review and send below", "yellow");
      return;
    }
    let matches = findVoiceChecklistMatches(transcript);
    if (matches.length === 0) {
      setVoiceThinking(true);
      matches = await aiMatchChecklist(transcript);
      setVoiceThinking(false);
    }
    if (matches.length === 0) { setVoiceNoMatch(transcript); toast(`🎙️ Didn't recognize an item in "${transcript}" — type it below`, "red"); return; }
    setVoicePending({ matches, transcript });
  };
  const toggleVoiceCommands = () => {
    if (!VoiceCmdCtor) return;
    if (voiceCmdActive) { voiceCmdKeepRef.current = false; voiceCmdRecRef.current?.stop(); setVoiceCmdActive(false); return; }
    voiceCmdKeepRef.current = true;
    const startOne = () => {
      const rec = new VoiceCmdCtor();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        const result = e.results[e.results.length - 1];
        if (result?.isFinal) handleVoiceCommand(result[0].transcript);
      };
      rec.onerror = (e: any) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          voiceCmdKeepRef.current = false; setVoiceCmdActive(false); toast("Microphone access denied", "red");
        }
      };
      // Same restart-on-end defensive pattern as VoiceMicButton/per-item
      // dictation above — the browser recognizer times out on silence even
      // in continuous mode, and rec.start() can throw if the previous
      // instance hasn't fully torn down yet.
      rec.onend = () => {
        if (!voiceCmdKeepRef.current) return;
        try { startOne(); } catch { setTimeout(() => { if (voiceCmdKeepRef.current) startOne(); }, 300); }
      };
      voiceCmdRecRef.current = rec;
      try { rec.start(); } catch { setTimeout(() => { if (voiceCmdKeepRef.current) startOne(); }, 300); }
    };
    startOne();
    setVoiceCmdActive(true);
    toast("🎙️ Listening — say an item name (or several) to check off, or describe a problem", undefined);
  };
  useEffect(() => () => { voiceCmdKeepRef.current = false; voiceCmdRecRef.current?.stop(); }, []);

  // Draw-mode signature canvas
  const [sigMode, setSigMode] = useState<"type" | "draw">("type");
  const [sigDrawData, setSigDrawData] = useState<string | null>(null);
  // FEATURE — commercial work orders sometimes need a MANAGER sign-off,
  // distinct from the customer sign-off this whole screen was built for.
  // Reuses the exact same drawing canvas/type-name UI rather than building a
  // second one — sigTarget just decides which job fields get written on
  // save (managerSignatureDataUrl/managerSignedAt/managerSignedBy vs the
  // existing signOff object).
  const [sigTarget, setSigTarget] = useState<"customer" | "manager">("customer");
  // FEATURE — "make sure you can assign a before photo to an after photo."
  // addPhoto("after", ...) used to always just get the next sequential
  // pairIndex — correct when there's exactly one open "before" waiting,
  // ambiguous the moment there's more than one (which before does this
  // after actually belong to?). When multiple are unpaired, hold the
  // compressed photo here and show a picker instead of guessing.
  const [pendingAfterPhoto, setPendingAfterPhoto] = useState<string | null>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const sigDrawing = useRef(false);
  const sigLastPos = useRef({ x: 0, y: 0 });
  // BUG FIX (mobile audit) — canvas has a fixed intrinsic resolution
  // (width={580} height={160}) but renders at CSS width "w-full", which on
  // a phone is far narrower — e.g. ~340px. Without scaling, drawn ink
  // diverged from the actual finger position (worse toward the right edge)
  // on every phone, breaking signature capture. Scale client coords by the
  // ratio between the canvas's real resolution and its displayed size.
  const sigGetPos = (canvas: HTMLCanvasElement, e: any) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
  };
  const sigStartDraw = (e: any) => {
    const canvas = sigCanvasRef.current; if (!canvas) return;
    sigDrawing.current = true;
    sigLastPos.current = sigGetPos(canvas, e);
  };
  const sigDraw = (e: any) => {
    if (!sigDrawing.current) return;
    e.preventDefault();
    const canvas = sigCanvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    ctx.strokeStyle = "#1e3a8a"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const pos = sigGetPos(canvas, e);
    ctx.beginPath(); ctx.moveTo(sigLastPos.current.x, sigLastPos.current.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    sigLastPos.current = pos;
  };
  const sigStopDraw = () => {
    if (!sigDrawing.current) return;
    sigDrawing.current = false;
    const canvas = sigCanvasRef.current; if (canvas) setSigDrawData(canvas.toDataURL());
  };
  const sigClear = () => {
    const canvas = sigCanvasRef.current; if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSigDrawData(null);
  };
  const switchSigMode = (m: "type" | "draw") => {
    setSigMode(m); setSignerName(""); sigClear();
  };

  // BUG FIX — see addPhoto's comment: pair the Nth "before" with the Nth
  // "after" by pairIndex (older photos taken before this fix existed
  // fall back to array order via index, same effective behavior they had
  // before) instead of always grabbing whichever before/after happens to
  // be first in the array regardless of which areas they're actually of.
  const photoPairs: { before?: any; after?: any }[] = (() => {
    const befores = (job.photos || []).filter((p: any) => p.type === "before" && (p.url || p.dataUrl));
    const afters = (job.photos || []).filter((p: any) => p.type === "after" && (p.url || p.dataUrl));
    const count = Math.max(befores.length, afters.length);
    const pairs: { before?: any; after?: any }[] = [];
    for (let i = 0; i < count; i++) {
      const b = befores.find((p: any) => (p.pairIndex ?? befores.indexOf(p)) === i) || befores[i];
      const a = afters.find((p: any) => (p.pairIndex ?? afters.indexOf(p)) === i) || afters[i];
      if (b || a) pairs.push({ before: b, after: a });
    }
    return pairs;
  })();
  const beforePhoto = photoPairs[0]?.before;
  const afterPhoto = photoPairs[0]?.after;

  const preItems = job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS;
  const durItems = job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS;
  const postItems = job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS;
  const allItems = [...preItems, ...durItems, ...postItems];
  const allDone = allItems.length > 0 && allItems.every(i => i.done);

  // "Complete Job" flow — review status, collect payment info, finalize.
  const checklistRemaining = allItems.filter(i => !i.done).length;
  const startCompleteFlow = () => {
    // FEATURE — "before they finish a job they need to make sure they have
    // [required photos/videos] done." A soft gate, not a hard block — a
    // real field situation (equipment failure, safety issue) shouldn't trap
    // someone in an unfinishable job, but it should require them to
    // consciously say "continue anyway" rather than silently skipping it.
    if (job.isWorkOrder && Array.isArray(job.photoRequirements) && job.photoRequirements.length > 0) {
      const tags = (job as any).photoRequirementTags || {};
      const unmet = job.photoRequirements.filter((req: any) => {
        const count = req.kind === "video"
          ? (job.videos || []).filter((v: any) => tags[v.id] === req.id).length
          : (job.photos || []).filter((p: any) => tags[p.id] === req.id).length;
        return count < req.minCount;
      });
      if (unmet.length > 0) {
        const list = unmet.map((r: any) => r.label || (r.kind === "video" ? "video" : "photo")).join(", ");
        if (!window.confirm(`This work order is still missing required photos/videos for: ${list}. Complete anyway?`)) return;
      }
    }
    setCompleteStep("review"); setPaidChoice(""); setPaymentMethod("");
  };

  const sendInvoiceFromPortal = async (customSubject?: string, customNote?: string) => {
    console.log("[SendInvoice] sendInvoiceFromPortal called — channel:", invoiceChannel, "job:", job.id, "customer:", customer?.id);
    if (!customer?.email && !customer?.phone) {
      console.warn("[SendInvoice] aborting — no email or phone on file for customer", customer?.id);
      toast("No contact info for this customer. Add email or phone first.", "red");
      return false;
    }
    setSendingCompleteInvoice(true);
    try {
      const newInv = {
        id: uid(), customerId: job.customerId,
        lineItems: [{ id: uid(), description: job.notes || job.address || "Service", quantity: 1, unitPrice: Number(job.amount) || 0 }],
        subtotal: Number(job.amount) || 0, discount: 0, depositRequired: 0, tax: 0, total: Number(job.amount) || 0,
        status: "approved" as const, createdAt: localDateStr(), validUntil: daysFromNow(30), invoiced: true, invoicedAt: localDateStr(),
        // The employee has no separate "ownerId" concept of their own here —
        // this invoice belongs to whichever owner the source job belongs to,
        // so inherit it straight off the job row (fetched with owner_id via
        // App.tsx's select("*")) rather than plumbing a new prop through.
        owner_id: (job as any).owner_id,
      };
      // [SendInvoice] this used to ONLY call setEstimates (local React state)
      // with no Supabase insert at all — the same "local-state-only mutation"
      // anti-pattern already found and fixed in InvoicesPage.tsx's markPaid.
      // The payLink texted/emailed to the customer points at
      // #/estimate/{newInv.id}; if that row never reaches Supabase, the
      // customer's link 404s and the invoice never appears anywhere in the
      // owner's CRM (InvoicesPage reads straight from Supabase) — from the
      // owner's side that's indistinguishable from "Send Invoice did
      // nothing," even though the employee's own screen shows a success
      // toast. Insert BEFORE sending so a save failure fails loud (via the
      // catch below) instead of handing the customer a dead link.
      console.log("[SendInvoice] inserting new invoice", newInv.id, "for customer", customer?.id, "amount", newInv.total);
      // [SendInvoice] this insert previously had no timeout guard — if Supabase
      // hung (e.g. a stuck internal navigator-lock, the exact scenario
      // withTimeout's own doc comment describes), this await never resolved OR
      // rejected, so the function never reached the catch/finally below and the
      // button was stuck on "Sending…" forever with no toast, no error, nothing.
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
      const subject = customSubject?.trim() || `Invoice — ${companyName}`;
      const noteHtml = customNote?.trim() ? `<p style="font-style:italic;color:rgba(255,255,255,0.6)">${customNote.trim()}</p>` : "";
      if (invoiceChannel === "sms") {
        if (!customer.phone) throw new Error("No phone on file for this customer.");
        console.log("[SendInvoice] sending via SMS to", customer.phone);
        await withTimeout(twilioSend(settings as any, customer.phone, `Hi ${customer.firstName}, your invoice for ${fmt(Number(job.amount) || 0)} is ready: ${payLink}`), 15000, "Invoice SMS");
        console.log("[SendInvoice] SMS send resolved ✓");
        toast(`Invoice texted to ${customer.firstName} ✓`, "green");
        logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: `Hi ${customer.firstName}, your invoice for ${fmt(Number(job.amount) || 0)} is ready: ${payLink}` }).catch(() => {});
      } else {
        if (!customer.email) throw new Error("No email on file for this customer.");
        const html = emailShell(settings, "Invoice", `<p>Hi ${customer.firstName},</p>${noteHtml}<p>Thanks for choosing us! Your service at <b>${job.address}</b> is complete.</p><p><b>Amount due:</b> $${(Number(job.amount) || 0).toFixed(2)}</p>` + emailButton("View & Pay Invoice", payLink));
        console.log("[SendInvoice] sending via Gmail to", customer.email);
        await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, subject, html), 10000, "Invoice email");
        console.log("[SendInvoice] Gmail send resolved ✓");
        toast(`📧 Invoice emailed to ${customer.firstName} ✓`, "green");
      }
      return true;
    } catch (err: any) {
      console.error("[SendInvoice] invoice send — error:", err?.message || err);
      toast(`Failed to send invoice — ${err?.message || "unknown error"}`, "red");
      return false;
    } finally {
      setSendingCompleteInvoice(false);
      console.log("[SendInvoice] sendInvoiceFromPortal finished, sendingCompleteInvoice reset to false");
    }
  };

  const finalizeCompletion = async (paymentStatus: "Paid" | "Pending", method?: string, invoiceSent?: boolean) => {
    let hrs = Number(job.loggedHours) || 0;
    const patch: Partial<Job> = { status: "completed", completedAt: new Date().toISOString(), pipelineStage: paymentStatus === "Paid" ? "paid" : "completed" };
    if (job.clockInAt) {
      const lunchMs = paidLunchBreaks ? 0 : (job.lunchMinutes || 0) * 60000;
      const added = Math.round((Date.now() - job.clockInAt - lunchMs) / 36000) / 100;
      hrs = Math.round((hrs + added) * 100) / 100;
      patch.clockInAt = null; patch.lunchStartAt = null; patch.loggedHours = hrs;
    } else if (job.arrivedAt && !hrs) {
      // FIX 3 — employees normally never set the per-job clockInAt at all (only
      // the owner's own JobDetailModal Clock In/Out uses it); the field portal's
      // "I'm Here" button only sets arrivedAt + the whole-day shift timer. Without
      // this fallback, loggedHours stayed 0 forever for every employee-completed
      // job, which is why hours/pay never showed up in the owner's Hours/Payroll
      // tabs or the employee's own Pay tab — those all read job.loggedHours.
      const lunchMs = paidLunchBreaks ? 0 : (job.lunchMinutes || 0) * 60000;
      const added = Math.max(0, Math.round((Date.now() - job.arrivedAt - lunchMs) / 36000) / 100);
      hrs = added;
      patch.loggedHours = hrs;
    } else if (!hrs) {
      // AUDIT FIX — a job completed with NEITHER a per-job clockInAt NOR an
      // "I'm Here" arrivedAt on file (e.g. marked complete straight from the
      // job card, or arrivedAt never got tapped) used to leave loggedHours
      // completely unset — not even 0 — which is exactly what "completed
      // job hours/dollar amounts not appearing in the Pay tab" looks like,
      // since every Pay tab total is a sum over job.loggedHours. Explicitly
      // writing 0 at least makes the job show up (as $0/0h, visibly
      // incomplete) instead of silently vanishing from every total.
      console.warn("[FinalizeCompletion] job", job.id, "completed with no clockInAt/arrivedAt on file — loggedHours defaulting to 0; hours won't be accurate for this job.");
      patch.loggedHours = 0;
    }
    if (paymentStatus === "Paid") {
      patch.paymentType = (method as any) || "Cash";
      patch.paymentStatus = "Paid";
      patch.amountCollected = Number(job.amount) || 0;
    } else {
      patch.paymentStatus = "Pending";
      if (invoiceSent) { patch.paymentType = "Invoice"; patch.invoiceSentAt = localDateStr(); }
    }
    // Show the summary immediately (local state already reflects completion),
    // but await the actual Supabase write so the toast tells the truth and the
    // completion can't silently revert on the next poll. onJobCompleted (rating +
    // calendar sync) is best-effort — a throw in there must never block the
    // screen from advancing to the summary.
    try { onJobCompleted?.({ ...job, ...patch } as Job); } catch (e) { console.warn("[Complete Job] onJobCompleted callback failed:", e); }
    // FEATURE 3 (mobile round 7) — the owner previously got NO email at all
    // when a job finished (only an end-of-day rollup, hours-only, no
    // checklist/signature/photos). Best-effort, non-blocking — a failed
    // notification email must never stop the completion flow itself.
    // Skipped entirely in the owner's read-only "Team Portal" preview
    // (isPreview) so walking through the wizard there doesn't fire a real
    // "job completed" email about a completion that was never actually saved.
    if (!isPreview) (async () => {
      const ownerEmail = settings?.myEmail || settings?.companyEmail;
      if (!ownerEmail) return;
      const completedJob = { ...job, ...patch } as any;
      const allChecklist = [...(completedJob.preChecklist || []), ...(completedJob.duringChecklist || []), ...(completedJob.postChecklist || []), ...(completedJob.checklist || [])];
      const ckDone = allChecklist.filter((c: any) => c.done).length;
      const empName = employeeName || "A crew member";
      const companyName = settings?.companyName || "CRM Starter";
      const photoCount = totalJobPhotoCount(completedJob);
      const beforeAfterThumbs = (completedJob.photos || []).slice(0, 4).filter((p: any) => p.url || p.dataUrl)
        .map((p: any) => `<img src="${mediaSrc(p.url, p.dataUrl)}" alt="${p.type || "photo"}" style="width:100px;height:100px;object-fit:cover;border-radius:8px;margin:0 6px 6px 0" />`).join("");
      const sigImg = (job.signOff?.sigUrl || job.signOff?.sigData) ? `<img src="${mediaSrc(job.signOff.sigUrl, job.signOff.sigData)}" alt="signature" style="max-width:260px;background:#fff;border-radius:6px;padding:6px;margin-top:4px" />` : "";
      const rows = `
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Technician</span><strong>${empName}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Address</span><strong>${job.address || ""}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Checklist completed</span><strong>${ckDone}/${allChecklist.length}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Payment status</span><strong>${patch.paymentStatus}${patch.paymentType ? " (" + patch.paymentType + ")" : ""}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Amount</span><strong>${fmt(patch.amountCollected ?? job.amount ?? 0)}</strong></div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee"><span>Photos attached</span><strong>${photoCount}</strong></div>
      `;
      const customerLine = customer ? `<p>Customer: <b>${customer.firstName} ${customer.lastName}</b></p>` : "";
      const notesHtml = job.notes ? `<p><b>Notes:</b> ${job.notes}</p>` : "";
      const sigHtml = job.signOff ? `<p><b>Signed by:</b> ${job.signOff.signerName || "customer"}${sigImg}</p>` : "<p style=\"color:#999\">No customer sign-off collected.</p>";
      const photosHtml = beforeAfterThumbs ? `<p><b>Photos:</b></p><div>${beforeAfterThumbs}</div>` : "";
      sendEmail(settings as any, {
        to: ownerEmail, subject: `Job completed — ${empName} — ${job.address || ""}`,
        body: emailShell(settings, "Job Completed", `<p>${empName} just completed a job.</p>${customerLine}${rows}${notesHtml}${sigHtml}${photosHtml}`),
      }).catch((e: any) => console.warn("[Complete Job] owner summary email failed:", e?.message));
    })();
    // FEATURE — "text... once the job is finished." OTW/Running Late/
    // Arrived already text the customer at each stage; completion was the
    // one stage with no customer-facing text at all (only the owner-facing
    // summary email just above). Automatic and best-effort, same treatment
    // as that email — never blocks the completion flow itself.
    if (!isPreview && customer?.phone && settings?.twilioSid) {
      const doneMsg = `Hi ${customer.firstName}, your ${settings?.companyName || "CRM Starter"} service at ${job.address || "your property"} is all finished! Thanks for choosing us.`;
      twilioSend(settings as any, customer.phone, doneMsg)
        .then(() => logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: doneMsg }).catch(() => {}))
        .catch((e: any) => console.warn("[Complete Job] customer completion text failed:", e?.message));
    }
    setCompleteSummary({ hours: hrs, amount: Number(job.amount) || 0, paymentStatus: paymentStatus === "Paid" ? `Paid (${patch.paymentType})` : invoiceSent ? "Unpaid — Invoice Sent" : "Unpaid" });
    setCompleteStep("summary");
    try {
      // BUG FIX — same outer-shorter-than-inner-timeout bug as above.
      const result = await withTimeout(Promise.resolve(onUpdateJob(patch)), 45000, "Mark complete save");
      if (result?.error) {
        console.error("[Complete Job] — error:", result.error.message || result.error);
        toast("Completed locally, but the server didn't confirm — " + (result.error.message || "check connection"), "red");
      } else {
        haptic([15, 60, 15]);
        toast("✅ Job completed successfully", "green");
      }
    } catch (e: any) {
      console.error("[Complete Job] — error:", e?.message || e);
      toast("Completed locally, but the server didn't confirm — " + (e?.message || "check connection"), "red");
    }
  };

  // ── Customer sign-off overlay ─────────────────────────────────────────────
  if (showSignOff) {
    return (
      <div className="h-dvh h-screen overflow-hidden bg-black text-white flex flex-col">
        <div className="sticky top-0 z-20 bg-black/95 border-b border-brand-900/30 px-4 py-3 flex items-center gap-3">
          <button onClick={() => { setShowSignOff(false); if (signOffReturnToComplete) { setSignOffReturnToComplete(false); setCompleteStep("review"); } }} className="p-2 rounded-xl hover:bg-white/10 text-white/60 -ml-2">
            <ChevronLeft size={20} />
          </button>
          <div className="font-semibold">{sigTarget === "manager" ? "Manager Sign-Off" : "Customer Sign-Off"}</div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 max-w-lg mx-auto space-y-4">
          {/* FEATURE — commercial work orders sometimes need a MANAGER
              sign-off separate from the customer's — this toggle picks
              which one the canvas below actually saves to. */}
          {job.requiresManagerSignoff && (
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              <button onClick={() => setSigTarget("customer")} className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition " + (sigTarget === "customer" ? "bg-brand-700/40 text-white border border-brand-700/50" : "text-white/50")}>Customer</button>
              <button onClick={() => setSigTarget("manager")} className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition " + (sigTarget === "manager" ? "bg-purple-700/40 text-white border border-purple-700/50" : "text-white/50")}>Manager</button>
            </div>
          )}
          {/* Services summary */}
          <Glass className="p-4 !bg-black/40">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-semibold">Services Completed</div>
            <div className="text-sm text-white/80">{job.notes || job.address}</div>
            {job.amount > 0 && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-white/50 text-sm">Total</span>
                <span className="text-xl font-black text-green-400">{fmt(job.amount)}</span>
              </div>
            )}
          </Glass>

          {/* Before / After photos — one slider per correctly-matched pair
              (see photoPairs above), not just the first before/after found. */}
          {photoPairs.length > 0 && (
            <Glass className="p-4 !bg-black/40 space-y-3">
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Before / After{photoPairs.length > 1 ? ` (${photoPairs.length})` : ""}</div>
              {photoPairs.map((pair, i) => (
                <div key={i}>
                  {pair.before && pair.after ? (
                    <BeforeAfterSlider before={mediaSrc(pair.before.url, pair.before.dataUrl)} after={mediaSrc(pair.after.url, pair.after.dataUrl)} />
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {pair.before && <div className="rounded-xl overflow-hidden aspect-video"><img src={mediaSrc(pair.before.url, pair.before.dataUrl)} alt="Before" className="w-full h-full object-cover" /></div>}
                      {pair.after && <div className="rounded-xl overflow-hidden aspect-video"><img src={mediaSrc(pair.after.url, pair.after.dataUrl)} alt="After" className="w-full h-full object-cover" /></div>}
                    </div>
                  )}
                </div>
              ))}
            </Glass>
          )}

          {/* Legal disclaimer — job-specific terms, then Settings → Terms &
              Conditions, then the standard fallback wording, in that order */}
          <Glass className="p-4 !bg-white/5 !border-white/10">
            <div className="flex items-start gap-2 mb-3">
              <Shield size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">
                {(signOffDisclaimer || DEFAULT_SIGNOFF_DISCLAIMER).replace(/\{\{company\}\}/g, companyName)}
              </div>
            </div>
          </Glass>

          {/* Signature input — type or draw, both legally binding with a timestamp */}
          <Glass className="p-4 !bg-black/40">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-2 font-semibold flex items-center gap-1">
              <PenLine size={11} />Digital Signature
            </div>
            <div className="flex gap-2 mb-3">
              {([["type", "⌨️ Type"], ["draw", "✍️ Draw"]] as const).map(([m, l]) => (
                <button key={m} onClick={() => switchSigMode(m)} className={"flex-1 py-2 rounded-xl text-xs font-semibold border transition " + (sigMode === m ? "bg-blue-900/40 border-blue-500/60 text-blue-200" : "bg-black/30 border-white/10 text-white/50 hover:text-white")}>{l}</button>
              ))}
            </div>
            {sigMode === "type" ? (
              <>
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Full name..."
                  className="w-full bg-transparent border-b-2 border-brand-600/40 focus:border-brand-500 text-white text-lg py-2 focus:outline-none placeholder-white/20"
                />
                {signerName.trim() && (
                  <div className="mt-3 p-3 bg-white/5 rounded-xl text-center">
                    <div className="text-white/40 text-[10px] uppercase mb-1">Signature Preview</div>
                    <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }} className="text-2xl text-white/80">{signerName}</div>
                    <div className="text-[10px] text-white/30 mt-2">{new Date().toLocaleString()}</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  placeholder="Full name (optional, for the record)"
                  className="w-full bg-transparent border-b border-white/10 focus:border-brand-500 text-white text-sm py-1.5 mb-2 focus:outline-none placeholder-white/20"
                />
                <div className="bg-white rounded-xl overflow-hidden border-2 border-dashed border-gray-300">
                  <canvas ref={sigCanvasRef} width={580} height={160} className="w-full cursor-crosshair touch-none" style={{ height: 160 }}
                    onMouseDown={sigStartDraw} onMouseMove={sigDraw} onMouseUp={sigStopDraw} onMouseLeave={sigStopDraw}
                    onTouchStart={sigStartDraw} onTouchMove={sigDraw} onTouchEnd={sigStopDraw} />
                </div>
                <div className="flex items-center justify-between text-xs text-white/40 mt-2">
                  <span>Sign above with your finger or mouse</span>
                  <button onClick={sigClear} className="text-brand-400 hover:text-brand-300">Clear</button>
                </div>
              </>
            )}
          </Glass>

          <GBtn onClick={saveSignOff} disabled={savingSignOff || (sigMode === "type" ? !signerName.trim() : !sigDrawData)} className="w-full !justify-center !py-3">
            <CheckCircle size={16} />{savingSignOff ? "Saving…" : "Sign & Save"}
          </GBtn>
        </div>
      </div>
    );
  }

  // ── "Complete Job" flow — review → payment → summary ─────────────────────
  if (completeStep) {
    return (
      <div className="h-dvh h-screen overflow-hidden bg-black text-white flex flex-col">
        <div className="sticky top-0 z-20 bg-black/95 border-b border-brand-900/30 px-4 py-3 flex items-center gap-3">
          {completeStep !== "summary" && (
            <button onClick={() => setCompleteStep("")} className="p-2 rounded-xl hover:bg-white/10 text-white/60 -ml-2">
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="font-semibold">Complete Job</div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-4">
          {completeStep === "review" && (
            <>
              <Glass className="p-4 !bg-black/40 space-y-2.5">
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-1">Status Check</div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Checklist</span>
                  <span className={checklistRemaining === 0 ? "text-green-400 font-semibold" : "text-yellow-400 font-semibold"}>
                    {allItems.length - checklistRemaining}/{allItems.length} done
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Customer sign-off</span>
                  <span className={job.signOff ? "text-green-400 font-semibold" : "text-yellow-400 font-semibold"}>
                    {job.signOff ? "Obtained ✓" : "Not obtained"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/70">Payment</span>
                  <span className="text-yellow-400 font-semibold">Not yet collected</span>
                </div>
              </Glass>
              {(checklistRemaining > 0 || !job.signOff) && (
                <div className="text-xs text-white/40 text-center">
                  {checklistRemaining > 0 && `${checklistRemaining} checklist item${checklistRemaining !== 1 ? "s" : ""} remaining. `}
                  {!job.signOff && "No sign-off yet. "}
                  You can still continue.
                </div>
              )}
              {!job.signOff && (
                <GBtn variant="ghost" onClick={() => { setCompleteStep(""); setSignOffReturnToComplete(true); setShowSignOff(true); }} className="w-full !justify-center">
                  <PenLine size={14} className="inline mr-1.5" />Get Sign-Off First
                </GBtn>
              )}
              <GBtn
                onClick={async () => {
                  // FEATURE — "set up automated charge payments for recurring
                  // jobs... dates fluctuate, but bill automatically when we
                  // have that recurring job." This job may land on any date
                  // (the whole point — a Monday one month, a Thursday the
                  // next), so billing is tied to the job actually being
                  // completed, not a fixed calendar day. If the customer has
                  // opted in (CustomerDetail.tsx → Recurring Billing →
                  // "Auto-charge on completion") and has a card on file,
                  // charge it right here and skip straight past the manual
                  // "did they pay / how did they pay" screens — those stay
                  // exactly as they were for every non-opted-in job.
                  const autoEligible = !!(job.isRecurring && (customer as any)?.autoChargeRecurringJobs && customer?.savedPaymentMethodId && customer?.stripeCustomerId && effPerms.can_process_payments && settings?.stripePublishableKey);
                  if (!autoEligible) { setCompleteStep("payment"); return; }
                  setChargingCardNow(true);
                  try {
                    await chargeSavedPaymentMethod(customer.stripeCustomerId!, customer.savedPaymentMethodId!, Math.round((Number(job.amount) || 0) * 100), "usd", `Recurring job — ${job.address || ""}`, undefined, (job as any).owner_id);
                    toast(`Auto-charged ${fmt(job.amount)} to card on file ✓`, "green");
                    sendPaymentReceipt({
                      customerPhone: customer?.phone, customerEmail: customer?.email, customerFirstName: customer?.firstName, customerId: customer?.id,
                      amountCents: Math.round((Number(job.amount) || 0) * 100), description: `Job at ${job.address || ""}`, ownerId: (job as any).owner_id,
                    }).catch((e: any) => console.warn("[PaymentReceipt] failed:", e?.message));
                    setPaidChoice("yes");
                    setCompleteStep("tip");
                  } catch (e: any) {
                    // Auto-charge failing (expired card, insufficient funds,
                    // etc.) must never silently skip payment collection — fall
                    // through to the normal manual flow so it's still handled.
                    toast("Auto-charge failed — " + (e?.message || "unknown error") + " — collect payment manually", "red");
                    setCompleteStep("payment");
                  } finally {
                    setChargingCardNow(false);
                  }
                }}
                disabled={chargingCardNow}
                className="w-full !justify-center !py-3"
              >
                {chargingCardNow ? "Charging saved card…" : <>Continue <ChevronRight size={14} className="inline ml-1" /></>}
              </GBtn>
            </>
          )}

          {completeStep === "payment" && (
            <>
              <div className="text-lg font-bold">Has the customer paid yet?</div>
              <div className="text-sm text-white/50">Amount due: <span className="text-green-400 font-semibold">{fmt(job.amount)}</span></div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { setPaidChoice("yes"); setCompleteStep("method"); }} className="py-4 rounded-xl border-2 border-green-600/50 bg-green-950/30 text-green-300 font-semibold hover:bg-green-900/40 transition">Yes</button>
                <button onClick={() => { setPaidChoice("no"); setCompleteStep("invoice"); }} className="py-4 rounded-xl border-2 border-white/10 bg-black/40 text-white/70 font-semibold hover:border-white/30 transition">No</button>
              </div>
            </>
          )}

          {completeStep === "method" && (
            <>
              <div className="text-lg font-bold">How did they pay?</div>
              {/* ITEM 7 — on-site checkout: charge the customer's card on
                  file for real via Stripe (not just a manual "Card" note),
                  gated behind can_process_payments same as the other Stripe
                  actions in this file. If they have no card on file, "Add
                  Card on File" further up this same job screen covers "enter
                  payment details in person." */}
              {effPerms.can_process_payments && customer?.savedPaymentMethodId && customer?.stripeCustomerId && !!settings?.stripePublishableKey && (
                <div className="space-y-2">
                  {/* FEATURE — "employees should be able to add multiple
                      cards[and] charge in person" — only shows a picker
                      when there's actually more than one card, so the
                      common single-card case stays exactly as simple as
                      before. */}
                  {jobCards.length > 1 && (
                    <GSel value={selectedCardId} onChange={(e: any) => setSelectedCardId(e.target.value)} className="!text-sm">
                      {jobCards.map(c => (
                        <option key={c.id} value={c.id} className="bg-black">
                          {c.brand || "Card"} ····{c.last4 || "----"}{c.id === customer.savedPaymentMethodId ? " (default)" : ""}
                        </option>
                      ))}
                    </GSel>
                  )}
                  <button
                    onClick={async () => {
                      if (chargingCardNow) return;
                      const chargeCardId = selectedCardId || customer.savedPaymentMethodId!;
                      setChargingCardNow(true);
                      try {
                        // BUG FIX (Stripe audit) — this was the one charge call
                        // site in this file NOT passing owner_id, unlike the
                        // tip charges right below it. Without it
                        // (and with no invoiceId either, since this is a raw
                        // job charge), stripe-action.ts had nothing to resolve
                        // the real business from and fell back to the
                        // platform-wide key — the wrong Stripe account, or a
                        // hard failure if no platform key is set at all.
                        await chargeSavedPaymentMethod(customer.stripeCustomerId!, chargeCardId, Math.round((Number(job.amount) || 0) * 100), "usd", `Job payment — ${job.address || ""}`, undefined, (job as any).owner_id);
                        toast(`Charged ${fmt(job.amount)} to card on file ✓`, "green");
                        setCompleteStep("tip");
                      } catch (e: any) {
                        toast("Charge failed: " + (e?.message || "unknown error"), "red");
                      } finally {
                        setChargingCardNow(false);
                      }
                    }}
                    disabled={chargingCardNow}
                    className="w-full py-3 rounded-xl border-2 border-emerald-600/50 bg-emerald-950/30 text-emerald-300 font-semibold hover:bg-emerald-900/40 transition flex items-center justify-center gap-1.5"
                  >
                    <CreditCard size={14} />{chargingCardNow ? "Charging…" : `Charge ${fmt(job.amount)} to card on file${jobCards.length <= 1 ? ` (${customer.savedPaymentMethodLabel || "saved"})` : ""}`}
                  </button>
                </div>
              )}
              {/* FEATURE — "there's no way to enter the card information" /
                  "there should be a Pay in Person button" / "ensure you can
                  always create a new card, not just show one." This used to
                  only appear when the customer had NO card on file at all,
                  so once a first card existed there was never a way to key
                  in a SECOND new card for a customer who wants to pay with
                  a different one today. Now always available — opens the
                  same real Add Card flow (SaveCardModal) right from the
                  payment step regardless of what's already on file; see the
                  addCardFromMethodStep-gated onSaved handler below, which
                  reloads the card list and selects the new card so it can
                  be charged immediately without leaving this screen. */}
              {effPerms.can_process_payments && !!settings?.stripePublishableKey && (
                <button
                  onClick={() => { setAddCardFromMethodStep(true); setAddCardOpen(true); }}
                  className="w-full py-3 rounded-xl border-2 border-white/15 bg-white/5 text-white/70 hover:border-emerald-500/50 hover:text-emerald-300 transition flex items-center justify-center gap-1.5"
                >
                  <CreditCard size={14} />{customer?.savedPaymentMethodId ? "Add a New Card" : "Add Card on File"}
                </button>
              )}
              {/* FEATURE — "just send an invoice and save the card on file
                  automatically." An employee who just added/has a card but
                  the customer would rather be invoiced (not charged right
                  now) previously had no way back to the invoice flow from
                  here short of navigating away — the card they just saved
                  stays on file either way (SaveCardModal already wrote it),
                  this just routes to the same invoice step "No" uses. */}
              {effPerms.can_send_invoices && (
                <button onClick={() => { setPaidChoice("no"); setCompleteStep("invoice"); }} className="w-full text-center text-xs text-white/40 hover:text-white/70 transition py-1">
                  Send an invoice instead {customer?.savedPaymentMethodId ? "(card stays saved on file)" : ""}
                </button>
              )}
              {/* BUG FIX (owner report) — "pressed complete, chose card, it
                  just says complete... doesn't say if it charged the
                  client." This grid is a MANUAL note only — it never touches
                  Stripe, unlike the emerald "Charge to card on file" button
                  above. "Card" here read identically to a real charge with
                  nothing distinguishing them, so an employee could easily
                  believe a customer's card was actually charged when it
                  wasn't. Relabeled (only when a real charge option exists at
                  all, so there's something to contrast against) and paired
                  with an explicit toast on Mark Complete so it's never silent
                  about what did or didn't happen. */}
              <div className="grid grid-cols-2 gap-2">
                {["Cash", "Check", "Card", "Zelle", "Venmo", "Other"].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)} className={"py-3 rounded-xl border-2 text-sm font-semibold transition " + (paymentMethod === m ? "border-green-500 bg-green-950/30 text-green-300" : "border-white/10 bg-black/40 text-white/60 hover:border-white/30")}>
                    {m === "Card" && effPerms.can_process_payments && !!settings?.stripePublishableKey ? "Card (paid elsewhere)" : m}
                  </button>
                ))}
              </div>
              <GBtn
                onClick={() => {
                  if (paymentMethod === "Card") {
                    toast("Marked as paid by card — no charge was processed through this app. Nothing was collected from the customer's card here.", "yellow");
                  }
                  finalizeCompletion("Paid", paymentMethod || "Cash");
                }}
                disabled={!paymentMethod}
                className="w-full !justify-center !py-3"
              >
                <CheckCircle size={16} className="inline mr-1.5" />Mark Complete
              </GBtn>
            </>
          )}

          {completeStep === "tip" && (
            <>
              <div className="text-lg font-bold">Add a tip?</div>
              <div className="text-sm text-white/50">Hand the phone to the customer, or ask them directly.</div>
              <div className="grid grid-cols-4 gap-2">
                {[15, 18, 20, 25].map(pct => {
                  const tipAmt = Math.round((Number(job.amount) || 0) * (pct / 100) * 100) / 100;
                  return (
                    <button
                      key={pct}
                      disabled={tipChargingNow}
                      onClick={async () => {
                        setTipChargingNow(true);
                        try {
                          await chargeSavedPaymentMethod(customer!.stripeCustomerId!, customer!.savedPaymentMethodId!, Math.round(tipAmt * 100), "usd", `Tip — ${job.address || ""}`, undefined, (job as any).owner_id);
                          toast(`Tip of ${fmt(tipAmt)} charged ✓`, "green");
                          sendPaymentReceipt({
                            customerPhone: customer?.phone, customerEmail: customer?.email, customerFirstName: customer?.firstName, customerId: customer?.id,
                            amountCents: Math.round(((Number(job.amount) || 0) + tipAmt) * 100), description: `Job at ${job.address || ""} (incl. ${fmt(tipAmt)} tip)`, ownerId: (job as any).owner_id,
                          }).catch((e: any) => console.warn("[PaymentReceipt] failed:", e?.message));
                        } catch (e: any) {
                          toast("Tip charge failed: " + (e?.message || "unknown error"), "red");
                        } finally {
                          setTipChargingNow(false);
                          await finalizeCompletion("Paid", "Card (charged on file)");
                        }
                      }}
                      className="py-3 rounded-xl border-2 border-white/10 bg-black/40 text-white/70 hover:border-emerald-500/50 hover:text-emerald-300 transition text-center disabled:opacity-50"
                    >
                      <div className="font-bold text-sm">{pct}%</div>
                      <div className="text-[10px] text-white/40">{fmt(tipAmt)}</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <GInput type="number" step="1" placeholder="Custom $ amount" value={customTipInput} onChange={e => setCustomTipInput(e.target.value)} className="!text-sm flex-1" />
                <GBtn
                  disabled={tipChargingNow || !customTipInput || Number(customTipInput) <= 0}
                  onClick={async () => {
                    const amt = Number(customTipInput);
                    setTipChargingNow(true);
                    try {
                      await chargeSavedPaymentMethod(customer!.stripeCustomerId!, customer!.savedPaymentMethodId!, Math.round(amt * 100), "usd", `Tip — ${job.address || ""}`, undefined, (job as any).owner_id);
                      toast(`Tip of ${fmt(amt)} charged ✓`, "green");
                      sendPaymentReceipt({
                        customerPhone: customer?.phone, customerEmail: customer?.email, customerFirstName: customer?.firstName, customerId: customer?.id,
                        amountCents: Math.round(((Number(job.amount) || 0) + amt) * 100), description: `Job at ${job.address || ""} (incl. ${fmt(amt)} tip)`, ownerId: (job as any).owner_id,
                      }).catch((e: any) => console.warn("[PaymentReceipt] failed:", e?.message));
                    } catch (e: any) {
                      toast("Tip charge failed: " + (e?.message || "unknown error"), "red");
                    } finally {
                      setTipChargingNow(false);
                      setCustomTipInput("");
                      await finalizeCompletion("Paid", "Card (charged on file)");
                    }
                  }}
                  className="!text-xs !px-4"
                >
                  Charge
                </GBtn>
              </div>
              <button
                disabled={tipChargingNow}
                onClick={() => {
                  sendPaymentReceipt({
                    customerPhone: customer?.phone, customerEmail: customer?.email, customerFirstName: customer?.firstName, customerId: customer?.id,
                    amountCents: Math.round((Number(job.amount) || 0) * 100), description: `Job at ${job.address || ""}`, ownerId: (job as any).owner_id,
                  }).catch((e: any) => console.warn("[PaymentReceipt] failed:", e?.message));
                  finalizeCompletion("Paid", "Card (charged on file)");
                }}
                className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-white/50 hover:text-white/80 hover:border-white/30 transition text-sm font-medium disabled:opacity-50"
              >
                No tip — finish up
              </button>
            </>
          )}

          {/* ITEMS 3/5 — an employee without can_send_invoices can still mark
              a job unpaid, but skips straight past the invoice-composing
              step instead of being offered a Send Invoice action. */}
          {completeStep === "invoice" && !effPerms.can_send_invoices && (
            <>
              <div className="text-lg font-bold">Job marked unpaid</div>
              <div className="text-sm text-white/50">You don't have permission to send invoices — ask {companyName} to send one, or an owner/manager can send it from the CRM.</div>
              <GBtn onClick={() => finalizeCompletion("Pending", undefined, false)} className="w-full !justify-center !py-3">
                <CheckCircle size={16} className="inline mr-1.5" />Mark Complete
              </GBtn>
            </>
          )}
          {completeStep === "invoice" && effPerms.can_send_invoices && (
            <>
              <div className="text-lg font-bold">Send invoice to customer?</div>
              <div className="text-sm text-white/50">Amount: <span className="text-green-400 font-semibold">{fmt(job.amount)}</span> · {customer?.firstName || "Customer"}</div>
              {/* Channel selector */}
              <div className="flex gap-2">
                {(["email", "sms"] as const).map(ch => (
                  <button key={ch} onClick={() => setInvoiceChannel(ch)}
                    className={"flex-1 py-2 rounded-xl border text-sm font-semibold transition " + (invoiceChannel === ch ? "border-brand-500/60 bg-brand-950/30 text-brand-300" : "border-white/10 bg-white/5 text-white/50 hover:border-white/30")}>
                    {ch === "email" ? "📧 Email" : "💬 Text"}
                  </button>
                ))}
              </div>
              {invoiceChannel === "email" && !customer?.email && (
                <div className="text-xs text-yellow-400/80 bg-yellow-950/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                  No email on file — add one in customer settings or switch to Text.
                </div>
              )}
              {invoiceChannel === "sms" && !customer?.phone && (
                <div className="text-xs text-yellow-400/80 bg-yellow-950/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                  No phone on file — add one in customer settings or switch to Email.
                </div>
              )}
              {invoiceChannel === "email" && customer?.email && !googleLive && (
                <div className="text-xs text-yellow-400/80 bg-yellow-950/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                  Google isn't connected — connect it in Settings → Integrations, or switch to Text.
                </div>
              )}
              {invoiceChannel === "sms" && customer?.phone && !settings?.twilioSid && (
                <div className="text-xs text-yellow-400/80 bg-yellow-950/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                  Twilio isn't configured — add it in Settings → Integrations, or switch to Email.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {/* FEATURE — "there should be a Pay in Person button, not
                    just Send Invoice." Previously "No" only ever led to
                    send-invoice-or-skip — no way to actually collect
                    payment on the spot even though the very next step
                    (method) already has full card-on-file charging and
                    manual payment-method marking built in; it just wasn't
                    reachable from here. */}
                {effPerms.can_process_payments && (
                  <button
                    onClick={() => { setPaidChoice("yes"); setCompleteStep("method"); }}
                    className="col-span-2 py-3 rounded-xl border-2 border-emerald-600/50 bg-emerald-950/30 text-emerald-300 font-semibold hover:bg-emerald-900/40 transition flex items-center justify-center gap-1.5"
                  >
                    <CreditCard size={14} />Pay In Person Now
                  </button>
                )}
                <GBtn onClick={() => {
                  // [SendInvoice] — this used to be a *silently disabled*
                  // button (no onClick fires at all on a disabled element)
                  // whenever the customer had no email/phone on file for the
                  // selected channel. From the employee's side that reads as
                  // "I pressed Send Invoice and nothing happened at all" —
                  // no toast, no error, because the click never even
                  // registered. Always clickable now; if contact info is
                  // genuinely missing, say so out loud instead of just
                  // dimming the button.
                  console.log("[SendInvoice] 'Yes — Preview' clicked — channel:", invoiceChannel, "customer:", customer?.id);
                  if (invoiceChannel === "email" && !customer?.email) {
                    toast("No email on file for this customer — add one or switch to Text.", "red");
                    return;
                  }
                  if (invoiceChannel === "sms" && !customer?.phone) {
                    toast("No phone on file for this customer — add one or switch to Email.", "red");
                    return;
                  }
                  setInvoiceEditSubject(`Invoice — ${companyName}`);
                  setInvoiceEditNote("");
                  setCompleteStep("invoice-preview");
                }} className="!py-3 !justify-center">
                  Yes — Preview
                </GBtn>
                <GBtn variant="ghost" onClick={() => finalizeCompletion("Pending", undefined, false)} className="!py-3 !justify-center">
                  No, Skip
                </GBtn>
              </div>
            </>
          )}

          {completeStep === "invoice-preview" && (
            <>
              <div className="text-lg font-bold">Invoice Preview</div>
              <Glass className="p-4 !bg-black/40 space-y-3">
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-0.5">To</div>
                  <div className="text-sm font-semibold">{customer?.firstName} {customer?.lastName}</div>
                  <div className="text-xs text-white/40">{customer?.email || customer?.phone || "No contact on file"}</div>
                </div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Subject</div>
                  <input value={invoiceEditSubject} onChange={e => setInvoiceEditSubject(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50" />
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/40 uppercase tracking-wider">Amount Due</div>
                  <div className="text-2xl font-black text-green-400">{fmt(job.amount)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-0.5">Job</div>
                  <div className="text-sm text-white/70">{job.address}</div>
                  {job.notes && <div className="text-xs text-white/40 mt-1 italic">{job.notes}</div>}
                </div>
                <div>
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Note to customer (optional)</div>
                  <textarea value={invoiceEditNote} onChange={e => setInvoiceEditNote(e.target.value)}
                    rows={2} placeholder="Thank you for your business! Let us know if you have any questions."
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 resize-none focus:outline-none focus:border-brand-500/50" />
                </div>
              </Glass>
              <div className="grid grid-cols-2 gap-3">
                <GBtn onClick={async () => {
                  console.log("[SendInvoice] 'Send Invoice ✓' clicked");
                  const sent = await sendInvoiceFromPortal(invoiceEditSubject, invoiceEditNote);
                  console.log("[SendInvoice] sendInvoiceFromPortal returned:", sent);
                  if (sent) finalizeCompletion("Pending", undefined, true);
                }} disabled={sendingCompleteInvoice} className="!py-3 !justify-center !bg-gradient-to-r !from-green-700 !to-green-900 !border-green-600/50">
                  {sendingCompleteInvoice ? "Sending…" : "Send Invoice ✓"}
                </GBtn>
                <GBtn variant="ghost" onClick={() => setCompleteStep("invoice")} className="!py-3 !justify-center">
                  Back
                </GBtn>
              </div>
            </>
          )}

          {completeStep === "summary" && completeSummary && (
            <>
              <div className="text-center py-2">
                <div className="w-16 h-16 rounded-full bg-green-900/40 border border-green-600/50 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={28} className="text-green-400" />
                </div>
                <div className="text-xl font-bold">Job Complete!</div>
              </div>
              <Glass className="p-4 !bg-black/40 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Time</div>
                  <div className="text-lg font-bold">{completeSummary.hours}h</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Amount</div>
                  <div className="text-lg font-bold text-green-400">{fmt(completeSummary.amount)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/40 uppercase">Payment</div>
                  <div className="text-xs font-bold mt-1">{completeSummary.paymentStatus}</div>
                </div>
              </Glass>
              {nextJob && (
                <Glass className="p-4 !bg-blue-950/15 !border-blue-700/30">
                  <div className="text-xs text-blue-400/80 uppercase tracking-wider mb-2 font-semibold">Up Next</div>
                  <div className="text-sm font-medium">{nextJobCustomer ? `${nextJobCustomer.firstName} ${nextJobCustomer.lastName}` : nextJob.address}</div>
                  <div className="text-xs text-white/40 mt-0.5">{nextJob.address}{nextJob.scheduledTime ? ` · ${nextJob.scheduledTime}` : ""}</div>
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextJob.address || "")}&travelmode=driving`} target="_blank" rel="noreferrer" className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-900/30 hover:bg-blue-800/40 border border-blue-700/30 text-blue-300 text-sm font-semibold transition">
                    <Navigation size={14} />Get Directions
                  </a>
                </Glass>
              )}
              <GBtn onClick={() => { setCompleteStep(""); if (onComplete) onComplete(); }} className="w-full !justify-center !py-3">
                Done
              </GBtn>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh h-screen overflow-y-auto bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 border-b border-brand-900/30 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white -ml-2">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{job.address}</div>
          <div className="text-xs text-white/50">{job.scheduledDate} {job.scheduledTime ? "· " + job.scheduledTime : ""}</div>
        </div>
        <div className={"px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide " +
          (job.status === "completed" ? "bg-green-900/40 text-green-300" :
           job.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
           "bg-blue-900/40 text-blue-300")}>
          {(job.status || "").replace("_", " ")}
        </div>
      </div>

      {/* FEATURE — "employees should see who else is working with them on
          each job." job.crew is a list of employee ids/entries; resolve
          against the real employees list and show everyone but the viewer
          themselves. */}
      {(() => {
        const crewIds = normalizeCrewArray(job.crew).map(crewEntryId);
        const others = employees.filter((emp: any) => crewIds.includes(emp.id) && emp.email !== employeeEmail);
        if (others.length === 0) return null;
        return (
          <div className="px-4 pt-3 flex items-center gap-2 text-xs text-white/50 flex-wrap">
            <User size={13} className="text-white/30" />
            Working with: {others.map((emp: any) => `${emp.firstName} ${emp.lastName}`.trim()).join(", ")}
          </div>
        );
      })()}

      {/* FEATURE — proximity arrival prompt, shown once GPS lands within
          ARRIVAL_PROMPT_RADIUS_METERS of the job's lat/lng. Lightweight,
          dismissible overlay — "Yes" reuses markArrived (same action as the
          manual "I'm Here" button below), "Dismiss" just closes it and it
          will not reopen for this job this mount. */}
      {showArrivalPrompt && (
        <div className="fixed top-16 left-3 right-3 z-30 max-w-lg mx-auto">
          <Glass className="p-3 !bg-blue-950/95 !border-blue-600/50 shadow-2xl flex items-start gap-3">
            <MapPin size={16} className="text-blue-300 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white">You're near the job site</div>
              <div className="text-[11px] text-white/60 mt-0.5">Notify the owner you've arrived?</div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setShowArrivalPrompt(false); markArrived(); }}
                  className="flex-1 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 border border-blue-500/60 text-white text-xs font-bold transition"
                >
                  Yes, I'm here
                </button>
                <button
                  onClick={() => setShowArrivalPrompt(false)}
                  className="px-3 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-white/80 transition"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </Glass>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Payment status — only meaningful once the job is done */}
        {job.status === "completed" && (
          <Glass className={"p-3 flex items-center justify-between gap-3 " + (job.paymentStatus === "Paid" ? "!bg-green-950/20 !border-green-700/30" : "!bg-yellow-950/20 !border-yellow-700/30")}>
            <div>
              <div className={"text-xs font-bold " + (job.paymentStatus === "Paid" ? "text-green-300" : "text-yellow-300")}>{paymentStatusLabel(job)}</div>
              <div className="text-[10px] text-white/40 mt-0.5">
                {job.amountCollected ? `${fmt(job.amountCollected)} collected` : `${fmt(job.amount)} due`}
                {job.completedAt ? ` · Completed ${new Date(job.completedAt).toLocaleDateString()}` : ""}
                {job.loggedHours ? ` · ${job.loggedHours}h worked` : ""}
              </div>
            </div>
          </Glass>
        )}

        {/* Customer info */}
        {customer ? (
          <Glass className="p-4 !bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center font-bold flex-shrink-0 text-brand-fg">
                {customer.firstName?.[0] || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{customer.firstName} {customer.lastName}</div>
                {customer.phone && (
                  <a href={"tel:" + customer.phone} className="text-sm text-blue-400 flex items-center gap-1 mt-0.5">
                    <Phone size={11} />{customer.phone}
                  </a>
                )}
              </div>
              {customer.phone && (
                <a href={"https://maps.google.com/?q=" + encodeURIComponent(job.address)} target="_blank" rel="noreferrer"
                  className="p-2 rounded-xl bg-blue-950/30 border border-blue-700/30 text-blue-400">
                  <MapPin size={14} />
                </a>
              )}
            </div>
            {customer.gateCode && <div className="mt-2 text-xs text-yellow-400/80">🔐 Gate code: {customer.gateCode}</div>}
            {customer.hasDog && <div className="mt-0.5 text-xs text-orange-400/80">🐕 Dog on property{customer.dogName ? ` — ${customer.dogName}` : ""}</div>}
          </Glass>
        ) : job.customerId ? (
          <Glass className="p-4 !bg-black/40">
            <div className="text-sm text-white/40 italic">Customer info loading...</div>
          </Glass>
        ) : null}

        <StreetViewThumb address={job.address} apiKey={googleMapsKey} />

        {/* Job notes — set by the owner when scheduling, editable anytime in JobDetailModal */}
        {job.notes && (
          <Glass className="p-4 !bg-blue-950/15 !border-blue-700/25">
            <div className="text-xs text-blue-400/80 uppercase tracking-wider mb-1 font-semibold flex items-center gap-1"><FileText size={11} />Job Notes</div>
            <div className="text-sm text-white/80">{job.notes}</div>
          </Glass>
        )}

        {/* FEATURE — "allow owners to attach work orders — PDF files,
            photos, or videos — to job orders that employees can see. For
            example, a commercial job may have a five-page PDF." Read-only
            here — attaching/removing is owner-only, in JobDetailModal. */}
        {(job.attachments || []).filter((a: any) => a.url).length > 0 && (
          <Glass className="p-4 !bg-black/40">
            <div className="text-xs text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1"><FileText size={11} />Work Order Attachments</div>
            <div className="space-y-1.5">
              {(job.attachments || []).filter((a: any) => a.url).map((a: any) => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm p-2.5 bg-white/5 rounded-lg hover:bg-white/10 transition">
                  <span className="truncate flex items-center gap-2 text-white/80">
                    {a.type === "pdf" ? "📄" : a.type === "image" ? "🖼️" : a.type === "video" ? "🎬" : "📎"} {a.name}
                  </span>
                  <Download size={13} className="text-white/40 flex-shrink-0" />
                </a>
              ))}
            </div>
          </Glass>
        )}

        {/* Required equipment & chemicals — confirm before starting */}
        {hasRequiredGear && (
          <Glass className={"p-4 " + (job.equipmentChecked ? "!bg-green-950/20 !border-green-700/30" : "!bg-yellow-950/15 !border-yellow-700/30")}>
            <div className="text-xs text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1">
              <CheckSquare size={12} />Required Equipment & Chemicals
              {!job.equipmentChecked && <span className="text-yellow-400 ml-auto text-[10px] normal-case">Confirm before starting</span>}
            </div>
            {/* FEATURE — "upload photos of equipment so an employee can see
                what they need." Matches each required item's label against
                the Inventory & Equipment catalog by name — if it has photos
                or a reference link on file there, show them right here
                instead of a bare label the employee has to guess at. */}
            <div className="space-y-1.5 mb-3">
              {[...(job.equipment || []).map(l => ({ label: l, tone: "red" as const })), ...(job.requiredChemicals || []).map(l => ({ label: l, tone: "purple" as const }))].map(({ label, tone }) => {
                const matched = chemicals.find((c: any) => (c.name || "").toLowerCase().trim() === label.toLowerCase().trim());
                const photos = matched?.photos || [];
                return (
                  <div key={label}>
                    <div className="flex items-center gap-1.5">
                      <span className={"text-[10px] px-2 py-1 rounded-lg border " + (tone === "red" ? "bg-danger-950/30 border-danger-700/30 text-danger-300" : "bg-purple-950/30 border-purple-700/30 text-purple-300")}>{label}</span>
                      {matched?.itemLink && (
                        <a href={/^https?:\/\//i.test(matched.itemLink) ? matched.itemLink : "https://" + matched.itemLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline">Reference ↗</a>
                      )}
                    </div>
                    {photos.length > 0 && (
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {photos.map((p: any) => (
                          <img key={p.id} src={mediaSrc(p.url, p.dataUrl)} alt={label} className="w-14 h-14 rounded-lg object-cover border border-white/10 cursor-pointer" onClick={() => window.open(mediaSrc(p.url, p.dataUrl), "_blank")} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!job.equipmentChecked} onChange={e => onUpdateJob({ equipmentChecked: e.target.checked })}
                className="w-4 h-4 accent-green-500 cursor-pointer" />
              <span className="text-xs text-white/70">I have all required equipment and materials</span>
            </label>
          </Glass>
        )}

        {/* Running Late — proactively warn the customer (and owner) on any active job. */}
        {job.status !== "completed" && job.status !== "cancelled" && (customer?.phone || customer?.email) && (
          <Glass className="p-3 !bg-orange-950/15 !border-orange-700/30">
            {runningLateOpen ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-orange-300">Running Late — notify customer</div>
                {/* Send via — never silently defaults to a provider that isn't configured */}
                <div>
                  <div className="text-[10px] text-white/50 mb-1.5">Send via</div>
                  <div className="flex gap-1.5">
                    {/* ISSUE (round 10) — these used to be `disabled` outright
                        whenever the customer had no phone/email, which reads
                        from the owner's side as "the button just doesn't
                        work" with zero explanation (the same silent-disable
                        problem already fixed for Send Invoice above — see
                        that comment). Always clickable now; a missing-contact
                        state is explained via title tooltip + the warning
                        banner below, and the actual send still refuses with a
                        clear toast (see sendRunningLate) if picked anyway. */}
                    <button title={!customer?.phone ? "This customer has no phone number on file" : "Send by text"} onClick={() => setLateChannel("sms")}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-semibold transition " + (lateChannel === "sms" ? "border-orange-500 bg-orange-900/40 text-orange-200" : !customer?.phone ? "border-white/5 bg-black/20 text-white/25" : "border-white/10 bg-black/30 text-white/50 hover:border-white/30")}>
                      💬 Text
                    </button>
                    <button title={!customer?.email ? "This customer has no email on file" : "Send by email (via the owner's connected Gmail)"} onClick={() => setLateChannel("email")}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-semibold transition " + (lateChannel === "email" ? "border-orange-500 bg-orange-900/40 text-orange-200" : !customer?.email ? "border-white/5 bg-black/20 text-white/25" : "border-white/10 bg-black/30 text-white/50 hover:border-white/30")}>
                      📧 Email
                    </button>
                  </div>
                  {lateChannel === "email" && !customer?.email && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">This customer has no email on file — add one in customer settings, or switch to Text.</div>
                  )}
                  {lateChannel === "sms" && !customer?.phone && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">This customer has no phone on file — add one in customer settings, or switch to Email.</div>
                  )}
                  {lateChannel === "sms" && !settings?.twilioSid && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">Twilio isn't configured — add it in Settings → Integrations, or switch to Email.</div>
                  )}
                  {lateChannel === "email" && !googleLive && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">Google isn't connected — connect it in Settings → Integrations, or switch to Text.</div>
                  )}
                </div>
                {/* Reason templates */}
                <div>
                  <div className="text-[10px] text-white/50 mb-1.5">Reason (optional)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Stuck in traffic", "Previous job ran over", "Equipment issue", "Weather delay"].map(t => (
                      <button key={t} onClick={() => setLateReasonNote(lateReasonNote === t ? "" : t)}
                        className={"text-[10px] px-2.5 py-1 rounded-lg border transition " + (lateReasonNote === t ? "bg-orange-800/50 border-orange-500/60 text-orange-200" : "bg-white/5 border-white/15 text-white/60 hover:border-orange-700/40 hover:text-orange-300")}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={lateReasonNote}
                    onChange={e => setLateReasonNote(e.target.value)}
                    placeholder="Custom note…"
                    className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-orange-700/60"
                  />
                </div>
                {/* Time picker */}
                <div>
                  <div className="text-[10px] text-white/50 mb-1.5">How many minutes late?</div>
                  <div className="flex gap-1.5">
                    {[5, 10, 15, 20, 30].map(m => (
                      <button key={m} disabled={sendingRunningLate} onClick={() => sendRunningLate(m)} className="flex-1 py-2 rounded-lg bg-orange-900/30 border border-orange-700/40 text-orange-300 text-sm font-semibold hover:bg-orange-900/50 disabled:opacity-50 transition">
                        {sendingRunningLate ? "…" : m}
                      </button>
                    ))}
                  </div>
                </div>
                <button onClick={() => { setRunningLateOpen(false); setLateReasonNote(""); }} className="text-[11px] text-white/30 hover:text-white/60">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setRunningLateOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-orange-300 hover:text-orange-200 transition">
                <Clock size={12} />Running Late
              </button>
            )}
          </Glass>
        )}

        {/* On My Way — send channel choice, never silently defaults away from the chosen channel */}
        {job.status !== "completed" && job.status !== "cancelled" && (customer?.phone || customer?.email) && (
          <Glass className="p-3 !bg-blue-950/15 !border-blue-700/30">
            {otwOpen ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-blue-300">On My Way — notify customer</div>
                <div>
                  <div className="text-[10px] text-white/50 mb-1.5">Send via</div>
                  <div className="flex gap-1.5">
                    <button title={!customer?.phone ? "This customer has no phone number on file" : "Send by text"} onClick={() => setOtwChannel("sms")}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-semibold transition " + (otwChannel === "sms" ? "border-blue-500 bg-blue-900/40 text-blue-200" : !customer?.phone ? "border-white/5 bg-black/20 text-white/25" : "border-white/10 bg-black/30 text-white/50 hover:border-white/30")}>
                      💬 Text
                    </button>
                    <button title={!customer?.email ? "This customer has no email on file" : "Send by email (via the owner's connected Gmail)"} onClick={() => setOtwChannel("email")}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-semibold transition " + (otwChannel === "email" ? "border-blue-500 bg-blue-900/40 text-blue-200" : !customer?.email ? "border-white/5 bg-black/20 text-white/25" : "border-white/10 bg-black/30 text-white/50 hover:border-white/30")}>
                      📧 Email
                    </button>
                  </div>
                  {otwChannel === "email" && !customer?.email && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">This customer has no email on file — add one in customer settings, or switch to Text.</div>
                  )}
                  {otwChannel === "sms" && !customer?.phone && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">This customer has no phone on file — add one in customer settings, or switch to Email.</div>
                  )}
                  {otwChannel === "sms" && !settings?.twilioSid && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">Twilio isn't configured — add it in Settings → Integrations, or switch to Email.</div>
                  )}
                  {otwChannel === "email" && !googleLive && (
                    <div className="text-[10px] text-yellow-400/80 mt-1">Google isn't connected — connect it in Settings → Integrations, or switch to Text.</div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={sendingOtw}
                    onClick={sendOtw}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 border border-blue-500/60 text-white text-xs font-bold disabled:opacity-40 transition">
                    {sendingOtw ? "Sending…" : "Send"}
                  </button>
                  <button onClick={() => setOtwOpen(false)} className="text-[11px] text-white/30 hover:text-white/60 px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setOtwOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-blue-300 hover:text-blue-200 transition">
                <Navigation size={12} />On My Way
              </button>
            )}
          </Glass>
        )}

        {/* FEATURE (round 13, item 10) — lets an employee put a customer's
            card on file in person (e.g. the customer wants to pay on-site).
            Reuses SaveCardModal (same component the customer's own portal
            uses), with enteredByEmployee wording on its legal consent
            checkbox, and syncs the resulting Stripe references back onto the
            customer record so the owner sees it immediately. Not shown in
            the owner's read-only preview (isPreview) or without Stripe
            configured. */}
        {!isPreview && effPerms.can_process_payments && !!settings?.stripePublishableKey && customer && (
          <Glass className="p-3 !bg-emerald-950/15 !border-emerald-700/30">
            <button onClick={() => setAddCardOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-emerald-300 hover:text-emerald-200 transition">
              <CreditCard size={12} />
              {customer.savedPaymentMethodId ? `Card on file: ${customer.savedPaymentMethodLabel || "saved"} — update` : "Add Card on File"}
            </button>
          </Glass>
        )}

        {/* FEATURE (round 13, item 20) — cascade Running Late prompt. */}
        {cascadePrompt && (
          <Glass className="p-3 !bg-orange-950/20 !border-orange-700/40 space-y-2">
            <div className="text-xs font-semibold text-orange-300">Notify the other {laterJobsToday.length} customer{laterJobsToday.length !== 1 ? "s" : ""} scheduled today too?</div>
            <div className="text-[10px] text-white/50">They'll get a heads-up that the crew is running ~{cascadePrompt.minutes} min behind, without a specific new time.</div>
            <div className="flex gap-2">
              <button disabled={cascadeSending} onClick={() => sendCascadeRunningLate(cascadePrompt.minutes)} className="flex-1 py-2 rounded-lg bg-orange-700/40 border border-orange-500/50 text-white text-xs font-bold disabled:opacity-40">
                {cascadeSending ? "Sending…" : "Yes, notify them"}
              </button>
              <button disabled={cascadeSending} onClick={() => setCascadePrompt(null)} className="px-3 text-[11px] text-white/40 hover:text-white/60">No thanks</button>
            </div>
          </Glass>
        )}

        {!isPreview && customer && (
          <SaveCardModal
            open={addCardOpen}
            onClose={() => setAddCardOpen(false)}
            publishableKey={settings?.stripePublishableKey || ""}
            stripeAccountId={(settings as any)?.stripeConnectAccountId}
            useCallerSession
            email={customer.email || ""}
            name={`${customer.firstName} ${customer.lastName}`}
            existingStripeCustomerId={customer.stripeCustomerId}
            companyName={companyName}
            enteredByEmployee
            // No full jobs[] list is passed into this view — only the job
            // currently being worked — so "recurring client" is derived from
            // that job (plus the customer's own recurring-payment flag if
            // set), per the fallback rule when there's no direct
            // customer-level recurring indicator.
            isRecurringClient={!!customer.recurringPayment?.enabled || !!job.isRecurring}
            onSaved={async (stripeCustomerId, paymentMethodId, label, consentAt) => {
              setCustomers((prev: Customer[]) => prev.map(c => c.id === customer.id ? { ...c, stripeCustomerId, savedPaymentMethodId: paymentMethodId, savedPaymentMethodLabel: label, cardConsentAt: consentAt || c.cardConsentAt } : c));
              // BUG FIX (audit) — the card itself is already genuinely saved
              // in Stripe by this point (SaveCardModal only calls onSaved
              // after a real confirmed SetupIntent); this write just
              // persists the REFERENCE onto the owner_id-scoped customers
              // row so the rest of the CRM knows about it. It used to be
              // fire-and-forget with no result check — a 0-row RLS mismatch
              // here would leave the card working in Stripe but invisible
              // to the CRM (and to the next "Charge to card on file"
              // attempt) with a toast that still claimed success.
              const result = await (supabase as any).from("customers").update({ stripeCustomerId, savedPaymentMethodId: paymentMethodId, savedPaymentMethodLabel: label, cardConsentAt: consentAt }).eq("id", customer.id).select("id");
              if (result?.error || !Array.isArray(result?.data) || result.data.length === 0) {
                console.warn("[AddCardOnFile] Supabase sync failed:", result?.error?.message || "0 rows matched");
                toast?.("Card saved in Stripe, but couldn't sync to the customer record — it may not show as on file next time. Try again or tell the owner.", "red");
              } else {
                toast?.("Card saved on file ✓", "green");
              }
              setAddCardOpen(false);
              // Opened from the payment step ("Add a New Card" mid-checkout)
              // — merge the new card into jobCards and select it immediately
              // so the "Charge to card on file" button appears with the new
              // card ready to go, without needing a page reload.
              if (addCardFromMethodStep) {
                setAddCardFromMethodStep(false);
                setJobCards(prev => prev.some(c => c.id === paymentMethodId) ? prev : [...prev, { id: paymentMethodId, brand: label?.split(" ")[0], last4: label?.match(/\d{4}$/)?.[0] }]);
                setSelectedCardId(paymentMethodId);
              }
            }}
          />
        )}

        {/* FIX 8 — Report Problem: unlike OTW/Running Late, this doesn't need
            customer contact info at all — it goes to the owner, not the
            customer — so it's available on any active job regardless of
            whether the customer has a phone/email on file. */}
        {job.status !== "completed" && job.status !== "cancelled" && (
          <Glass className="p-3 !bg-brand-950/15 !border-brand-700/30">
            {reportProblemOpen ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-brand-300">Report a Problem to the Owner</div>
                <textarea
                  value={reportProblemText}
                  onChange={e => setReportProblemText(e.target.value)}
                  rows={3}
                  placeholder="What's wrong? (e.g. broken equipment, property damage, safety issue...)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-700/60"
                />
                <div className="flex gap-2">
                  <button
                    disabled={sendingReportProblem}
                    onClick={sendReportProblem}
                    className="flex-1 py-2 rounded-lg bg-brand-600 border border-brand-500/60 text-brand-fg text-xs font-bold disabled:opacity-40 transition">
                    {sendingReportProblem ? "Sending…" : "Send Report"}
                  </button>
                  <button onClick={() => { setReportProblemOpen(false); setReportProblemText(""); }} className="text-[11px] text-white/30 hover:text-white/60 px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setReportProblemOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-brand-300 hover:text-brand-200 transition">
                <AlertTriangle size={12} />Report Problem
              </button>
            )}
            {/* FEATURE — "if the job didn't go well, don't send a review
                request." Independent of the report-problem text box above —
                usable even without filing a written report. */}
            <button
              disabled={savingSkipReview}
              onClick={toggleSkipReviewRequest}
              className={"w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] mt-1 pt-1.5 border-t border-brand-700/20 transition disabled:opacity-40 " + ((job as any).skipReviewRequest ? "text-yellow-300 hover:text-yellow-200" : "text-white/40 hover:text-white/70")}
            >
              {(job as any).skipReviewRequest ? "✓ Review request won't be sent for this job (tap to undo)" : "Don't send a review request after this job"}
            </button>
          </Glass>
        )}

        {/* FEATURE — "mark not completed / partially complete (e.g. ran out
            of chemicals at 90%) with a reason, optionally message the
            customer, and pick a reschedule day." */}
        {job.status !== "completed" && job.status !== "cancelled" && (
          <Glass className="p-3 !bg-orange-950/15 !border-orange-700/30">
            {rescheduleOpen ? (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-orange-300">Can't Finish — Reschedule</div>
                <select value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-700/60">
                  <option value="" className="bg-black">Why couldn't the job finish?</option>
                  {RESCHEDULE_REASONS.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}
                </select>
                {rescheduleReason === "Other" && (
                  <input value={rescheduleReasonNote} onChange={e => setRescheduleReasonNote(e.target.value)} placeholder="Describe the reason..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-orange-700/60" />
                )}
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-1">Reschedule to (optional)</label>
                  <input type="date" value={rescheduleDate} min={localDateStr()} onChange={e => setRescheduleDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-orange-700/60" />
                  {rescheduleDate && busyDates.includes(rescheduleDate) && (
                    <div className="text-[10px] text-orange-300/80 mt-1">⚠ You already have another job scheduled that day.</div>
                  )}
                  {!rescheduleDate && (
                    <div className="text-[10px] text-white/40 mt-1">No date? Press Finish — this job moves to the owner's Unscheduled list to pick a day later.</div>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                  <input type="checkbox" checked={rescheduleNotifyCustomer} onChange={e => setRescheduleNotifyCustomer(e.target.checked)} className="accent-orange-600" />
                  Message the customer
                </label>
                {rescheduleNotifyCustomer && (
                  <div className="flex gap-1.5">
                    <button onClick={() => setRescheduleChannel("sms")} disabled={!customer?.phone}
                      className={"flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition disabled:opacity-30 " + (rescheduleChannel === "sms" ? "bg-orange-700/40 border border-orange-500/60 text-orange-200" : "bg-white/5 border border-white/10 text-white/50")}>
                      Text
                    </button>
                    <button onClick={() => setRescheduleChannel("email")} disabled={!customer?.email}
                      className={"flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition disabled:opacity-30 " + (rescheduleChannel === "email" ? "bg-orange-700/40 border border-orange-500/60 text-orange-200" : "bg-white/5 border border-white/10 text-white/50")}>
                      Email
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    disabled={sendingReschedule}
                    onClick={sendReschedule}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-orange-600 to-orange-800 border border-orange-500/60 text-white text-xs font-bold disabled:opacity-40 transition">
                    {sendingReschedule ? "Saving…" : rescheduleDate ? "Save & Reschedule" : "Finish (no date yet)"}
                  </button>
                  <button onClick={() => { setRescheduleOpen(false); setRescheduleReason(""); setRescheduleReasonNote(""); setRescheduleDate(""); }} className="text-[11px] text-white/30 hover:text-white/60 px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setRescheduleOpen(true)} className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-orange-300 hover:text-orange-200 transition">
                <Calendar size={12} />Can't Finish / Reschedule
              </button>
            )}
          </Glass>
        )}

        {/* I'm Here — mark arrival at this job location (active/today jobs only) */}
        {job.status !== "completed" && (
          <Glass className={"p-4 " + (job.arrivedAt ? "!bg-green-950/20 !border-green-700/40" : "!bg-black/40")}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Location Status</div>
                {job.arrivedAt ? (
                  <div className="text-sm font-semibold text-green-400">
                    ✓ Arrived — {new Date(job.arrivedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </div>
                ) : (
                  <div className="text-sm text-white/60">
                    {job.loggedHours ? `${job.loggedHours}h logged` : "Not arrived yet"}
                    {job.duration ? ` · Est. ${formatEstDuration(job.duration)}` : ""}
                  </div>
                )}
              </div>
              {!job.arrivedAt && (
                <GBtn onClick={markArrived} className="!gap-2">
                  <MapPin size={14} />I'm Here
                </GBtn>
              )}
            </div>
          </Glass>
        )}

        {/* Photos & Videos */}
        {/* FEATURE — commercial/night job work orders. Per-section photo/
            video count requirements (owner-defined at scheduling, JobsPage.tsx)
            the field crew must actually meet, not just a generic "attach
            photos" reminder — matches the owner's example ("5 photos of this
            section, 10 of this section, a video of this"). Photos/videos
            uploaded here tag job.photoRequirementTags so progress is real,
            not just a count of everything ever uploaded to the job. */}
        {job.isWorkOrder && Array.isArray(job.photoRequirements) && job.photoRequirements.length > 0 && (
          <Glass className="p-4 !bg-purple-950/10 !border-purple-700/30">
            <div className="text-xs text-purple-300 uppercase tracking-wider mb-1 flex items-center gap-1">
              <FileText size={12} />Work Order Requirements
              {job.workOrderNumber && <span className="text-white/40 normal-case tracking-normal ml-1">#{job.workOrderNumber}</span>}
            </div>
            {job.workOrderClient && <div className="text-[11px] text-white/40 mb-2">{job.workOrderClient}</div>}
            <div className="space-y-2">
              {job.photoRequirements.map((req: any) => {
                const tags = (job as any).photoRequirementTags || {};
                const photoCount = (job.photos || []).filter((p: any) => tags[p.id] === req.id).length;
                const videoCount = (job.videos || []).filter((v: any) => tags[v.id] === req.id).length;
                const count = req.kind === "video" ? videoCount : photoCount;
                const met = count >= req.minCount;
                return (
                  <div key={req.id} className={"flex items-center justify-between gap-2 p-2 rounded-lg border " + (met ? "bg-green-950/15 border-green-700/30" : "bg-black/30 border-white/10")}>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-white/80 truncate flex items-center gap-1.5">
                        {met && <CheckCircle size={11} className="text-green-400 flex-shrink-0" />}
                        {req.label || (req.kind === "video" ? "Video" : "Photo")}
                      </div>
                      {req.instructions && <div className="text-[10px] text-white/40 truncate">{req.instructions}</div>}
                      <div className="text-[10px] text-white/40">{count} / {req.minCount} {req.kind}{req.minCount !== 1 ? "s" : ""}</div>
                    </div>
                    {effPerms.can_upload_photos && (
                      <label className="cursor-pointer flex-shrink-0">
                        <input
                          type="file"
                          accept={req.kind === "video" ? "video/*" : "image/*"}
                          capture="environment"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (req.kind === "video") addVideo(f, req.id);
                            else compressImageFile(f).then(dataUrl => addPhoto("after", dataUrl, undefined, req.id));
                            e.target.value = "";
                          }}
                        />
                        <div className="px-2.5 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/50 border border-purple-700/40 text-purple-200 text-[10px] font-medium flex items-center gap-1">
                          <Plus size={11} />{req.kind === "video" ? "Video" : "Photo"}
                        </div>
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            {job.requiresManagerSignoff && (
              <div className="mt-2 text-[10px] text-white/40 flex items-center gap-1.5">
                <AlertTriangle size={10} />
                {job.managerSignedAt ? `Manager signed off ${job.managerSignedAt.slice(0, 10)} ✓` : "This work order also requires a manager sign-off — see Sign-Off below."}
              </div>
            )}
          </Glass>
        )}

        <Glass className="p-4 !bg-black/40">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-3 flex items-center gap-1">
            <Image size={12} />Photos & Videos
          </div>
          {beforePhoto && afterPhoto && (
            <div className="mb-3">
              <BeforeAfterSlider before={mediaSrc(beforePhoto.url, beforePhoto.dataUrl)} after={mediaSrc(afterPhoto.url, afterPhoto.dataUrl)} />
            </div>
          )}
          {effPerms.can_upload_photos && (
            <div className="grid grid-cols-3 gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    compressImageFile(f).then(dataUrl => addPhoto("before", dataUrl));
                    e.target.value = "";
                  }} />
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-blue-950/30 hover:bg-blue-900/40 border border-blue-700/40 text-blue-300 text-xs font-medium transition text-center">
                  <Plus size={13} /><span>📷 Before</span>
                </div>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    compressImageFile(f).then(dataUrl => {
                      const unpairedBefores = photoPairs.filter(p => p.before && !p.after);
                      if (unpairedBefores.length > 1) setPendingAfterPhoto(dataUrl);
                      else addPhoto("after", dataUrl);
                    });
                    e.target.value = "";
                  }} />
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-green-950/30 hover:bg-green-900/40 border border-green-700/40 text-green-300 text-xs font-medium transition text-center">
                  <Plus size={13} /><span>✨ After</span>
                </div>
              </label>
              <label className="cursor-pointer">
                <input type="file" accept="video/*" capture="environment" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) addVideo(f); e.target.value = ""; }} />
                <div className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs font-medium transition text-center">
                  <Video size={13} /><span>Video</span>
                </div>
              </label>
            </div>
          )}
          {/* FEATURE — "assign a before photo to an after photo." More than
              one "before" is waiting for a match — ask which one this
              "after" actually belongs to instead of guessing positionally. */}
          {pendingAfterPhoto && (
            <div className="fixed inset-0 z-[400] bg-black/85 flex items-center justify-center p-4" onClick={() => setPendingAfterPhoto(null)}>
              <div className="bg-black border border-white/15 rounded-2xl p-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <div className="text-sm font-semibold mb-3">Which "before" does this photo match?</div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {photoPairs.filter(p => p.before && !p.after).map(p => (
                    <button key={p.before.id} onClick={() => { addPhoto("after", pendingAfterPhoto, p.before.pairIndex); setPendingAfterPhoto(null); }}
                      className="relative aspect-square rounded-lg overflow-hidden border-2 border-white/10 hover:border-green-500 transition">
                      <img src={mediaSrc(p.before.url, p.before.dataUrl)} alt="Before" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <button onClick={() => setPendingAfterPhoto(null)} className="w-full py-2 rounded-xl bg-white/5 text-white/50 text-xs">Cancel</button>
              </div>
            </div>
          )}
          {(job.photos || []).length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(job.photos || []).map((p, i) => (p.url || p.dataUrl) ? (
                <div key={p.id || i} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img src={mediaSrc(p.url, p.dataUrl)} alt="" className="w-full h-full object-cover" />
                  <div className={"absolute top-1 left-1 text-[8px] px-1 py-0.5 rounded font-bold uppercase " +
                    (p.type === "before" ? "bg-blue-600/90" : "bg-green-600/90")}>{p.type}</div>
                  {effPerms.can_upload_photos && (
                    <button onClick={() => { if (window.confirm("Delete this photo?")) onUpdateJob({ photos: (job.photos || []).filter(x => (x.id || x) !== (p.id || p)) }); }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-brand-700 hover:text-brand-fg text-white flex items-center justify-center transition">
                      <X size={11} />
                    </button>
                  )}
                </div>
              ) : null)}
            </div>
          )}
          {(job.videos || []).length > 0 && (
            <div className="mt-2 space-y-2">
              {(job.videos || []).map((v, i) => (
                <div key={v.id || i} className="rounded-xl overflow-hidden bg-black/60 relative">
                  <video src={mediaSrc(v.url, v.dataUrl)} controls className="w-full rounded-xl" style={{ maxHeight: 200 }} />
                  {effPerms.can_upload_photos && (
                    <button onClick={() => { if (window.confirm("Delete this video?")) onUpdateJob({ videos: (job.videos || []).filter(x => (x.id || x) !== (v.id || v)) }); }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 hover:bg-brand-700 hover:text-brand-fg text-white flex items-center justify-center transition">
                      <X size={13} />
                    </button>
                  )}
                  {v.addedAt && <div className="text-[10px] text-white/30 px-2 pb-1">{v.addedAt}</div>}
                </div>
              ))}
            </div>
          )}
        </Glass>

        {/* Checklists */}
        <Glass className="p-4 !bg-black/40">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1">
              <CheckSquare size={12} />Job Checklists
            </div>
            {effPerms.can_complete_checklist && (
              <div className="flex items-center gap-1.5">
                {VoiceCmdCtor && (
                  <button
                    type="button"
                    onClick={toggleVoiceCommands}
                    title={voiceCmdActive ? "Stop listening" : "Hands-free: check off items, describe a problem, or say \"send the invoice\" / \"pull up the signature\" / \"I just finished this job\" / \"on my way\" / \"running late\""}
                    className={"flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition " + (voiceCmdActive ? "bg-brand-600/70 text-brand-fg animate-pulse" : "bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10")}
                  >
                    <Mic size={11} />{voiceCmdActive ? "Listening…" : "Voice Commands"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setVoiceNoMatch(v => v === null ? "" : null)}
                  title="Type a checklist command instead of speaking"
                  className={"flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition " + (voiceNoMatch !== null && !voicePending ? "bg-white/15 text-white" : "bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10")}
                >
                  <List size={11} />Type Instead
                </button>
              </div>
            )}
          </div>

          {/* GUARDRAIL — nothing above ever applies on its own; this card is
              the one place a voice/typed checklist match actually saves,
              and only once the crew member taps Yes. */}
          {voiceThinking && (
            <div className="mb-3 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/50 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white/70 animate-spin inline-block" />
              Checking with AI…
            </div>
          )}
          {voicePending && (
            <div className="mb-3 p-3 rounded-xl bg-brand-950/20 border border-brand-800/40 space-y-2">
              <div className="text-[11px] text-white/50">🎙️ Heard: "{voicePending.transcript}"</div>
              <div className="text-sm font-medium">Did you mean:</div>
              <ul className="space-y-1">
                {voicePending.matches.map(m => (
                  <li key={m.item.id} className="text-sm flex items-center gap-2">
                    <span className={m.action === "check" ? "text-green-400" : "text-amber-400"}>{m.action === "check" ? "✓" : "✕"}</span>
                    {m.item.label}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pt-1">
                <GBtn onClick={confirmVoicePending} className="!text-xs !py-1.5">Yes, do it</GBtn>
                <button onClick={cancelVoicePending} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white">No, cancel</button>
              </div>
            </div>
          )}
          {voiceNoMatch !== null && !voicePending && (
            <div className="mb-3 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="text-[11px] text-white/50">{voiceNoMatch ? `🎙️ Didn't catch a checklist item in: "${voiceNoMatch}"` : "Type what you just did, e.g. \"finished the first room and set up the ladder\""}</div>
              <div className="flex gap-2">
                <GInput placeholder="Type what you meant…" value={voiceTypedText} onChange={(e: any) => setVoiceTypedText(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && voiceTypedText.trim() && handleVoiceCommand(voiceTypedText)} className="flex-1 !text-xs" />
                <GBtn onClick={() => voiceTypedText.trim() && handleVoiceCommand(voiceTypedText)} className="!text-xs !py-1.5">Go</GBtn>
                <button onClick={() => { setVoiceNoMatch(null); setVoiceTypedText(""); }} className="text-xs px-2 text-white/40 hover:text-white">✕</button>
              </div>
            </div>
          )}

          <PortalChecklistSection
            jobId={job.id}
            title="Pre-Job" emoji="🔵" allowPhotos
            items={preItems}
            onUpdate={items => saveChecklist("Pre-Job", { preChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
            toast={toast}
            crewOptions={checklistCrewOptions}
            myEmployeeId={myEmployeeIdForChecklist}
          />
          <PortalChecklistSection
            jobId={job.id}
            title="During Job" emoji="🟡" allowPhotos
            items={durItems}
            onUpdate={items => saveChecklist("During-Job", { duringChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
            toast={toast}
            crewOptions={checklistCrewOptions}
            myEmployeeId={myEmployeeIdForChecklist}
          />
          <PortalChecklistSection
            jobId={job.id}
            title="Post-Job" emoji="🟢" allowPhotos
            items={postItems}
            onUpdate={items => saveChecklist("Post-Job", { postChecklist: items })}
            disabled={!effPerms.can_complete_checklist}
            toast={toast}
            crewOptions={checklistCrewOptions}
            myEmployeeId={myEmployeeIdForChecklist}
          />
        </Glass>

        {/* Customer sign-off */}
        {job.signOff && (
          <Glass className="p-4 !bg-green-950/20 !border-green-700/30">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={14} className="text-green-400" />
              <div className="text-xs font-semibold text-green-300">Customer Signed Off</div>
            </div>
            {job.signOff.sigType === "draw" && (job.signOff.sigUrl || job.signOff.sigData) ? (
              <img src={mediaSrc(job.signOff.sigUrl, job.signOff.sigData)} alt="Signature" className="mt-1 bg-white rounded-lg max-h-20" />
            ) : (
              <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }} className="text-lg text-white/80 mt-1">{job.signOff.signerName}</div>
            )}
            <div className="text-[10px] text-white/30 mt-1">{new Date(job.signOff.timestamp).toLocaleString()}</div>
          </Glass>
        )}
        {job.status === "completed" ? (
          onComplete && (
            <button onClick={onComplete}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-green-900/30 hover:bg-green-800/40 border border-green-700/30 text-green-300 text-sm font-semibold transition">
              <ChevronLeft size={14} />Back to Jobs
            </button>
          )
        ) : (
          <div className="space-y-2">
            {effPerms.can_get_signoff && !job.signOff && (
              <GBtn variant="ghost" onClick={() => setShowSignOff(true)} className="w-full !justify-center">
                <PenLine size={14} className="inline mr-1.5" />Get Customer Sign-Off
              </GBtn>
            )}
            <GBtn onClick={startCompleteFlow} className="w-full !justify-center !py-3 !bg-gradient-to-r !from-green-700 !to-green-900 !border-green-600/50">
              <CheckCircle size={16} />Complete Job
            </GBtn>
          </div>
        )}

        {/* Internal notes */}
        {job.internalNotes && (
          <Glass className="p-4 !bg-yellow-950/20 !border-yellow-700/30">
            <div className="text-xs text-yellow-400/80 uppercase tracking-wider mb-1 font-semibold">📋 Site Notes</div>
            <div className="text-sm text-white/80">{job.internalNotes}</div>
          </Glass>
        )}

        {/* Notes — view existing always, add only if permitted */}
        {(effPerms.can_add_notes || (job.commLog || []).length > 0) && (
          <Glass className="p-4 !bg-black/40">
            {effPerms.can_add_notes && (
              <>
                <div className="text-xs text-white/60 uppercase tracking-wider mb-2">Add Note</div>
                <GTxt rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Report an issue, leave a status update..." />
                <GBtn onClick={addNote} className="mt-2 w-full !justify-center" disabled={!note.trim()}>
                  <Plus size={14} />Add Note
                </GBtn>
              </>
            )}
            {(job.commLog || []).length > 0 && (
              <div className={effPerms.can_add_notes ? "mt-3 space-y-1.5 max-h-40 overflow-y-auto" : "space-y-1.5 max-h-40 overflow-y-auto"}>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Notes</div>
                {[...(job.commLog || [])].reverse().slice(0, 5).map(e => (
                  <div key={e.id} className="text-xs p-2 bg-white/5 rounded-lg">
                    <div className="text-white/80">{e.note}</div>
                    <div className="text-white/30 mt-0.5">{e.date}</div>
                  </div>
                ))}
              </div>
            )}
          </Glass>
        )}
      </div>
    </div>
  );
}

// ── Owner Team Portal ─────────────────────────────────────────────────────────
function OwnerTeamPortal({ jobs, employees, customers, onClose, googleMapsKey, toast, settings }: {
  jobs: Job[]; employees: Employee[]; customers: Customer[]; onClose: () => void; googleMapsKey?: string; toast?: (msg: string, tone?: string) => void; settings?: any;
}) {
  const [selectedEmpId, setSelectedEmpId] = useState<string>("all");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  // ITEM 7 — match the real employee Today tab's 4am shift-day cutover (see
  // shiftDayStr's use below in the main portal) so the owner's preview of a
  // night worker's Today list doesn't disagree with what that employee
  // actually sees on their own device.
  const todayStr = shiftDayStr();

  const viewEmp = selectedEmpId === "all" ? null : employees.find(e => e.id === selectedEmpId);
  const viewEmpForFilter = selectedEmpId === "all" ? null : employees.find(e => e.id === selectedEmpId);
  const visibleJobs = selectedEmpId === "all"
    ? jobs
    // FIX 14 — same crew-matching bug class already fixed everywhere else
    // (naive .includes(id) silently misses object-shaped/stringified crew
    // entries or an employees.id vs employees.user_id mismatch) — here it
    // meant the owner's Team Portal preview, filtered to one employee,
    // could fail to show jobs (including recurring ones) that WERE actually
    // assigned to them.
    : jobs.filter(j => crewIncludesEmployee(j.crew, selectedEmpId, (viewEmpForFilter as any)?.user_id));
  const todayJobs = visibleJobs.filter(j => j.scheduledDate === todayStr && j.status !== "cancelled");

  if (selectedJobId) {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) { setSelectedJobId(null); return null; }
    const customer = customers.find(c => c.id === job.customerId);
    return (
      <JobDetailView
        job={job}
        customer={customer}
        onBack={() => setSelectedJobId(null)}
        // FIX 4 (mobile round 6) — this used to be a silent no-op
        // (`() => {}`), so the owner's "Team Portal" preview let them walk
        // through the ENTIRE Complete Job wizard (checklist, payment,
        // signature) with nothing ever persisted and no indication any of
        // it was inert — reads exactly like "pressing buttons does
        // nothing." This is intentionally a read-only preview of what an
        // employee sees (see docs/ARCHITECTURE.md's isOwnerView note), so make that
        // explicit instead of pretending to work: tell them plainly and
        // point at the real place to act.
        onUpdateJob={() => { toast?.("Preview only — open this job from the Jobs page to make real changes.", "yellow"); return Promise.resolve({}); }}
        toast={toast || (() => {})}
        googleMapsKey={googleMapsKey}
        // BLOCKER 9 (mobile round 7) — this was never passed, so OTW/Send
        // Invoice inside this preview called sendOwnerGmailOnly/twilioSend
        // with an empty {} settings object, which always throws "not
        // configured" regardless of the owner's real, working Twilio/Gmail
        // setup — reading exactly like "says send but doesn't send."
        // Threading the real settings through makes these buttons send for
        // real, same as everywhere else in the app.
        settings={settings}
        isPreview
      />
    );
  }

  return (
    <div className="h-dvh h-screen overflow-hidden bg-black text-white flex flex-col">
      <header className="sticky top-0 z-20 bg-black/95 border-b border-brand-900/30 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white -ml-2">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 font-semibold">Team Portal</div>
        <select
          value={selectedEmpId}
          onChange={e => setSelectedEmpId(e.target.value)}
          className="bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500/50"
        >
          <option value="all">All Employees</option>
          {employees.filter(e => e.status === "active").map(e => (
            <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
          ))}
        </select>
        {/* Escape hatch — this view only shows because the owner's session is still
            active on this browser. An employee sharing the device needs a way to reach
            their own login instead of being stuck looking at the owner's team preview. */}
        <button
          onClick={async () => { try { await withTimeout(supabase.auth.signOut({ scope: "local" }), 6000, "Sign out"); } catch { /* local hash change below still gets them to login either way */ } await clearLocalAuthSession(); window.location.hash = "/portal"; }}
          className="text-[10px] text-white/40 hover:text-white/70 underline whitespace-nowrap"
        >
          Not you? Sign in
        </button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 max-w-lg mx-auto space-y-4">
        {/* Employee cards */}
        {selectedEmpId === "all" && (
          <div className="grid grid-cols-2 gap-3">
            {employees.filter(e => e.status === "active").map(emp => {
              const empJobs = jobs.filter(j => crewIncludesEmployee(j.crew, emp.id, (emp as any).user_id));
              const empTodayJobs = empJobs.filter(j => j.scheduledDate === todayStr);
              const active = empJobs.find(j => j.clockInAt);
              return (
                <button key={emp.id} onClick={() => setSelectedEmpId(emp.id)}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-brand-600/30 text-left transition">
                  <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center font-bold text-sm mb-2 text-brand-fg">
                    {emp.firstName?.[0] || "?"}{emp.lastName?.[0] || ""}
                  </div>
                  <div className="font-semibold text-sm">{emp.firstName} {emp.lastName}</div>
                  <div className="text-[10px] text-white/40 capitalize mt-0.5">{emp.role}</div>
                  <div className="mt-2 text-xs text-white/50">{empTodayJobs.length} job{empTodayJobs.length !== 1 ? "s" : ""} today</div>
                  {active && <div className="text-[10px] text-green-400 animate-pulse mt-1">● Clocked in</div>}
                </button>
              );
            })}
          </div>
        )}

        {/* Today's jobs for selected employee */}
        <div>
          <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
            <span>{viewEmp ? `${viewEmp.firstName}'s Jobs Today` : "Today's Jobs"}</span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{todayJobs.length}</span>
          </div>
          {todayJobs.length === 0 ? (
            <div className="text-center py-8 text-white/30 text-sm">No jobs today</div>
          ) : (
            <div className="space-y-2">
              {todayJobs.map(j => {
                const c = customers.find(x => x.id === j.customerId);
                return (
                  <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                    className="w-full text-left p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-brand-600/30 transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{j.address}</div>
                        {c && (
                          <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap">
                            <span>{c.firstName} {c.lastName}</span>
                            {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/80 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                          </div>
                        )}
                      </div>
                      <div className={"text-[10px] px-2 py-0.5 rounded-full font-bold uppercase " +
                        (j.status === "completed" ? "bg-green-900/40 text-green-300" :
                         j.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
                         "bg-blue-900/40 text-blue-300")}>
                        {(j.status || "").replace("_", " ")}
                      </div>
                    </div>
                    <div className="text-xs text-white/40 mt-1">{j.scheduledTime || "All day"}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming for selected employee */}
        {viewEmp && (
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3">All Assigned Jobs</div>
            <div className="space-y-2">
              {visibleJobs.filter(j => j.scheduledDate > todayStr).slice(0, 10).map(j => {
                const c = customers.find(x => x.id === j.customerId);
                return (
                  <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                    className="w-full text-left p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{j.address}</div>
                      {c && (
                        <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap">
                          <span>{c.firstName} {c.lastName}</span>
                          {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/70 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-white/40 flex-shrink-0">{j.scheduledDate}</div>
                  </button>
                );
              })}
              {visibleJobs.filter(j => j.scheduledDate > todayStr).length === 0 && (
                <div className="text-center py-6 text-sm text-white/30">No upcoming jobs</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ShiftEndDigestModal — shown when an employee taps "End My Day" (the
// whole-shift dayClockInAt/dayLunchStartAt/dayPausedMinutes clock, NOT the
// per-job clock in JobDetailView) before the clock-out write actually fires.
// Gives them a last look at their day — hours, jobs completed, and any
// flagged issues pulled from real data already tracked on `jobs` for today
// (unchecked checklist items, no-shows, internal notes) — rather than
// silently ending the shift on a single tap. Top-level component per
// docs/ARCHITECTURE.md/BUG 4 — never define new components inside EmployeePortal's body.
function ShiftEndDigestModal({ hoursLabel, jobsCompleted, jobsToday, flaggedIssues, onConfirm, onCancel, confirming }: {
  hoursLabel: string;
  jobsCompleted: number;
  jobsToday: number;
  flaggedIssues: string[];
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center sm:p-4" onClick={() => !confirming && onCancel()}>
      <div className="w-full h-full sm:h-auto sm:max-w-md sm:max-h-[85vh] bg-neutral-950 border border-white/10 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-brand-600 flex-shrink-0 text-brand-fg">
          <div className="font-bold text-brand-fg flex items-center gap-2"><Clock size={16} />End My Day</div>
          <button onClick={onCancel} disabled={confirming} className="p-2 rounded-lg hover:bg-white/15 text-white transition disabled:opacity-40"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
          <div className="text-sm text-white/60">Here's your day before you clock out:</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-2xl font-bold text-green-300">{hoursLabel}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wide mt-0.5">Hours Worked</div>
            </div>
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
              <div className="text-2xl font-bold text-blue-300">{jobsCompleted}<span className="text-sm text-white/30">/{jobsToday}</span></div>
              <div className="text-[10px] text-white/40 uppercase tracking-wide mt-0.5">Jobs Completed</div>
            </div>
          </div>
          {flaggedIssues.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-bold text-yellow-300 flex items-center gap-1.5 uppercase tracking-wide">
                <AlertTriangle size={13} />Flagged from today
              </div>
              <div className="space-y-1.5">
                {flaggedIssues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl bg-yellow-950/20 border border-yellow-700/30 text-xs text-yellow-100/80">
                    <AlertCircle size={13} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-950/20 border border-green-700/30 text-xs text-green-300">
              <CheckCircle size={14} className="flex-shrink-0" />Nothing flagged — clean day!
            </div>
          )}
        </div>
        <div className="flex gap-2 p-4 border-t border-white/10 flex-shrink-0">
          <GBtn variant="ghost" onClick={onCancel} disabled={confirming} className="flex-1 !justify-center disabled:opacity-50">
            Cancel
          </GBtn>
          <GBtn onClick={onConfirm} disabled={confirming} className="flex-1 !justify-center !bg-gradient-to-r !from-green-700 !to-green-900 !border-green-600/50 disabled:opacity-50">
            {confirming ? "Ending Day…" : "Confirm — End My Day"}
          </GBtn>
        </div>
      </div>
    </div>
  );
}

export function EmployeePortal({ empSession, setEmpSession, jobs, setJobs, employees, customers, setCustomers = (() => {}) as any, settings, toast, isOwnerView = false, onClose = () => {}, refetchEmployees, estimates = [], setEstimates = (() => {}) as any, weatherData = null as any, chemicals = [] as any[], trainingModules = [] as any[] }: {
  empSession: any; setEmpSession: (s: any) => void;
  jobs: Job[]; setJobs: (fn: (prev: Job[]) => Job[]) => void;
  employees: Employee[]; customers: Customer[]; setCustomers?: any;
  settings: AppSettings; toast: (msg: string, tone?: any) => void;
  isOwnerView?: boolean; onClose?: () => void;
  weatherData?: { current: any; forecast?: any[] } | null;
  refetchEmployees?: () => Promise<void>;
  estimates?: any[]; setEstimates?: any;
  chemicals?: any[];
  trainingModules?: any[];
}) {
  // EGRESS FIX — skip the jobs poll below while the tab is hidden or the
  // employee has been idle 5+ minutes (e.g. mid-shift with the phone locked).
  //
  // SYNC FIX — this used to call usePollGate() with no onVisible callback,
  // unlike App.tsx's own usage (which force-refetches immediately on
  // returning to the tab). That meant switching between two open sessions of
  // the SAME account — e.g. Chrome tab and the installed PWA "app" — showed
  // stale clock-in/job state in whichever one had been in the background,
  // for up to a full poll interval (60-120s, see getPollIntervalMs) after
  // switching to it. refetchJobsRef isn't populated until the jobs-poll
  // effect below runs, but that's fine here — this callback only fires on a
  // later visibilitychange event, well after mount.
  const shouldPollJobs = usePollGate(() => { refetchJobsRef.current?.().catch(() => {}); refetchEmployees?.(); });
  const TAB_TO_SLUG: Record<string, string> = { today: "", calendar: "calendar", jobs: "jobs", pay: "pay", google: "google", onboarding: "onboarding", training: "training" };
  const SLUG_TO_TAB: Record<string, "today" | "calendar" | "jobs" | "pay" | "google" | "onboarding" | "training"> = { "": "today", calendar: "calendar", jobs: "jobs", pay: "pay", google: "google", onboarding: "onboarding", training: "training" };
  const tabFromHash = (): "today" | "calendar" | "jobs" | "pay" | "google" | "onboarding" | "training" => {
    const slug = window.location.hash.replace(/^#\/?/, "").split("?")[0].replace(/^portal\/?/, "");
    return SLUG_TO_TAB[slug] || "today";
  };
  const [tab, setTabState] = useState<"today" | "calendar" | "jobs" | "pay" | "google" | "onboarding" | "training">(tabFromHash);
  // Keeps the URL in sync with the active tab (#/portal, #/portal/calendar, #/portal/jobs,
  // #/portal/pay, #/portal/google, #/portal/onboarding) without going through App.tsx's
  // page-level routing — page stays "portal" the whole time, so App's hash-sync effect
  // never overwrites this.
  const setTab = (next: "today" | "calendar" | "jobs" | "pay" | "google" | "onboarding" | "training") => {
    setTabState(next);
    const slug = TAB_TO_SLUG[next];
    window.location.hash = slug ? "/portal/" + slug : "/portal";
  };
  // Respond to direct navigation / browser back-forward landing on a #/portal/* sub-path
  useEffect(() => {
    const handler = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // AUDIT FIX — the Pay tab (hours/amounts/paid status) otherwise only
  // refreshes on the shared cross-device poll's cadence (settings-controlled,
  // can be 60-120s) or realtime, which reads as "pay tabs don't seem to be
  // updating" if the owner just changed something and the employee switches
  // to Pay right after. Pull fresh employees data the moment this tab opens.
  useEffect(() => {
    if (tab === "pay") refetchEmployees?.();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [pendingCompleteJobId, setPendingCompleteJobId] = useState<string | null>(null);
  const [activeJobMenuOpen, setActiveJobMenuOpen] = useState(false);
  // FEATURE 1 — shows "Shift ended · Total 7h 23m" for a few seconds after End My Day
  // FIX 11 — persists the "Shift ended · Total 7h 23m" banner for the REST of
  // the day (until the next calendar day), surviving reloads via localStorage.
  const [shiftEndedMsg, setShiftEndedMsgState] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem("crm.shiftEnded");
      if (raw) { const o = JSON.parse(raw); if (o.date === new Date().toISOString().slice(0, 10)) return o.msg; }
    } catch { /* ignore */ }
    return null;
  });
  const setShiftEndedMsg = (msg: string | null) => {
    setShiftEndedMsgState(msg);
    try {
      if (msg) localStorage.setItem("crm.shiftEnded", JSON.stringify({ date: new Date().toISOString().slice(0, 10), msg }));
      else localStorage.removeItem("crm.shiftEnded");
    } catch { /* ignore */ }
  };
  // BUG 4 — Running Late picker state lives on the PARENT (keyed by job id), not
  // inside JobCard. JobCard is re-created on every 1s tick / 3s poll re-render,
  // which remounted it and reset any local useState — making the picker flash
  // shut. Hoisting it here keeps it open across those re-renders.
  const [lateOpenJobId, setLateOpenJobId] = useState<string | null>(null);
  const [lateNoteText, setLateNoteText] = useState("");
  const [sendingLateJobId, setSendingLateJobId] = useState<string | null>(null);
  // FIX 3 — selected minutes for the Running Late picker (parent-hoisted so it
  // survives the frequent re-renders). null = nothing picked yet.
  const [lateMinutes, setLateMinutes] = useState<number | null>(null);
  // FIX 2 — explicit Email/Text channel choice for Running Late + OTW on job
  // cards (never silently defaults away from the chosen channel). Shared across cards since only
  // one picker is open at a time.
  const [lateCardChannel, setLateCardChannel] = useState<"sms" | "email">("sms");
  const [otwOpenJobId, setOtwOpenJobId] = useState<string | null>(null);
  const [otwCardChannel, setOtwCardChannel] = useState<"sms" | "email">("sms");
  const [sendingOtwJobId, setSendingOtwJobId] = useState<string | null>(null);
  // CRITICAL FIX — same googleLive check as JobDetailView above: the job-card
  // OTW/Running Late banners used settings.googleConnected (owner-device-only)
  // instead of the actual cross-device token lookup the real send already
  // uses (sendOwnerGmailOnly → getStoredGoogleConnection/fetchOwnerGoogleToken).
  const [googleLiveCard, setGoogleLiveCard] = useState<boolean>(() => !!getStoredGoogleConnection()?.token);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (getStoredGoogleConnection()?.token) { if (!cancelled) setGoogleLiveCard(true); return; }
      const cloud = await fetchOwnerGoogleToken();
      if (!cancelled) setGoogleLiveCard(!!cloud?.token);
    };
    check();
    window.addEventListener("focus", check);
    return () => { cancelled = true; window.removeEventListener("focus", check); };
  }, []);
  // FEATURE — shift-end digest: "End My Day" opens this confirmation modal
  // (real today's-jobs/hours data, see ShiftEndDigestModal) instead of
  // clocking out immediately. endDayConfirming disables the modal's buttons
  // while the actual clock-out write is in flight so a slow network can't
  // leave it double-tappable.
  const [showEndDayDigest, setShowEndDayDigest] = useState(false);
  const [endDayConfirming, setEndDayConfirming] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  // ISSUE 5 (round 11) — this used to let the EMPLOYEE write their own
  // paidPeriods/paidDays as a "confirm you received this pay" self-
  // attestation. The owner explicitly does not want that: only the owner's
  // own "Mark as Paid" (EmployeesPage.tsx, writes the same employees.
  // paidPeriods/paidDays/paidJobs columns) should ever flip a period/day to
  // paid — the employee side is read-only status display now (see the Pay
  // tab render below, which reads paidPeriods/paidDays directly with no
  // click-to-mark affordance).
  const [payCalMonthOffset, setPayCalMonthOffset] = useState(0);
  const [selectedCalDay, setSelectedCalDay] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ order: Job[]; totalDuration: string; totalDistance: string; etas: string[]; origin: { lat: number; lng: number } | string } | null>(null);
  const [calMode, setCalMode] = useState<"week" | "month">("month");
  // FIX 8 — localDateStr() is UTC-derived and rolls to the next date ~4-8pm US
  // local time; scheduledDate is a local calendar date the owner picked, so
  // an evening open of the Calendar tab could pre-select a day that's
  // already "tomorrow" in UTC and show zero jobs for what the employee
  // considers today. localDateStr() matches local Date components instead.
  const [calSelectedDate, setCalSelectedDate] = useState(localDateStr());
  const [calWeekOffset, setCalWeekOffset] = useState(0);
  const [calMonthOffset, setCalMonthOffset] = useState(0);
  const [calDragJobId, setCalDragJobId] = useState<string | null>(null);
  const [calCtxMenu, setCalCtxMenu] = useState<{ jobId: string; x: number; y: number } | null>(null);
  const calMonthEdgeTimerRef = useRef<any>(null);
  const [driveTimes, setDriveTimes] = useState<Record<string, string>>({});
  const [completionNotif, setCompletionNotif] = useState<{ message: string; nextJobId?: string } | null>(null);
  const [nextJobEta, setNextJobEta] = useState<{ jobId: string; etaTime: string; lateMinutes: number } | null>(null);
  const fetchedDriveIds = useRef(new Set<string>());
  // Lets handleAcceptRequest/handleInlineAccept trigger an immediate jobs refetch
  // right after a successful accept, instead of waiting up to 10s for the next poll.
  const refetchJobsRef = useRef<() => Promise<void>>(async () => {});
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginFirst, setLoginFirst] = useState("");
  const [loginLast, setLoginLast] = useState("");
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteRecord, setInviteRecord] = useState<any>(null);
  // BUG FIX — "fix the logo on the sign-up/login page." Before the employee
  // has signed in, `settings` here is just whatever's in this DEVICE's own
  // localStorage (App.tsx's usePersistent) — which is empty on a crew
  // member's own phone that's never been the owner's device, so the login
  // screen always fell back to the generic CRM Starter mark, never the real
  // business logo. RLS on app_settings is permissive read (see docs/ARCHITECTURE.md),
  // same public-branding pattern the public forms use, so once
  // the invite resolves to an owner_id, fetch just that owner's branding
  // directly, independent of local session state.
  const [inviteBranding, setInviteBranding] = useState<{ logoUrl?: string; companyName?: string } | null>(null);
  useEffect(() => {
    const ownerId = inviteRecord?.owner_id;
    if (!ownerId) return;
    (supabase as any).from("app_settings").select("data").eq("owner_id", ownerId).maybeSingle()
      .then((r: any) => { if (r?.data?.data) setInviteBranding({ logoUrl: r.data.data.logoUrl, companyName: r.data.data.companyName }); })
      .catch(() => {});
  }, [inviteRecord?.owner_id]);
  // Locally-resolved employee when the prop array hasn't re-fetched yet (e.g. after invite registration)
  const [localEmployee, setLocalEmployee] = useState<any>(null);
  const [retrying, setRetrying] = useState(false);
  const autoRetryDoneRef = useRef(false);
  // Job request system
  // Local customer cache — populated by direct Supabase fetches when a job's
  // customerId is not found in the customers prop (e.g. RLS delay, stale parent
  // state). Keyed by customer id so lookups are O(1).
  const [localCustomerCache, setLocalCustomerCache] = useState<Record<string, Customer>>({});
  // findCustomer: checks prop array first (fast path), then local cache.
  const findCustomer = (id?: string | null): Customer | undefined => {
    if (!id) return undefined;
    return customers.find(c => c.id === id) ?? localCustomerCache[id];
  };

  const [requestId, setRequestId] = useState<string | null>(null);
  const [requestData, setRequestData] = useState<any>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [showDenyForm, setShowDenyForm] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [requestDone, setRequestDone] = useState<string | null>(null);
  // AUDIT FIX — Accept/Decline had no withTimeout protection (unlike every
  // other field-portal action button per docs/ARCHITECTURE.md's own rule) and no
  // loading state, so a hung Supabase call (a known real failure mode in
  // this app — navigator-lock contention, see JobsPage.tsx) left these
  // buttons clickable with zero feedback and no eventual error — reads
  // exactly like "assigning/requesting employees doesn't work."
  const [respondingToRequest, setRespondingToRequest] = useState(false);
  // Employee availability
  const [availability, setAvailability] = useState<string[]>([]);
  // FEATURE 5 — recurring weekday unavailability (e.g. "every Sunday"),
  // alongside the existing specific-date availability array above.
  const [recurringDaysOff, setRecurringDaysOff] = useState<number[]>([]);
  const [markingPeriodPaid, setMarkingPeriodPaid] = useState<string | null>(null);
  const [autoSyncCalendar, setAutoSyncCalendar] = useState(true);
  const [showAvailability, setShowAvailability] = useState(false);
  // Optimistic override for "Start/End My Day" — if the employees table is
  // missing the dayClockInAt column (a 400 on the update), the button must
  // still flip and stay flipped instead of silently reverting on the next
  // refetch, since the underlying request never persisted. undefined means
  // "trust the server value".
  const [optimisticDayClockInAt, setOptimisticDayClockInAt] = useState<number | null | undefined>(undefined);
  // FIX 5 — instant "📍 Sharing" badge before the Supabase round-trip / next poll.
  const [optimisticLocationSharing, setOptimisticLocationSharing] = useState<boolean | undefined>(undefined);
  // FEATURE — "keep updating the owner" while clocked in with sharing on
  // (see the ref+effect right after myEmployee is declared below, and its
  // use inside startAutoMileageTracking's watchPosition callback).
  const locationSharingRef = useRef(false);
  const lastLocationPushRef = useRef(0);
  const [optimisticDayLunchStartAt, setOptimisticDayLunchStartAt] = useState<number | null | undefined>(undefined);
  // BUG FIX — after "End My Day," lastShiftHours/lastShiftDate had NO
  // optimistic equivalent at all (unlike dayClockInAt/dayLunchStartAt/
  // locationSharing above), so the just-ended shift's hours only reached the
  // Pay tab once refetchEmployees() resolved and the myEmployee PROP updated.
  // Any delay/hiccup in that round trip meant "clock out, hours don't show
  // up" — the fix mirrors the existing optimistic pattern for this pair too.
  const [optimisticLastShiftHours, setOptimisticLastShiftHours] = useState<number | undefined>(undefined);
  const [optimisticLastShiftDate, setOptimisticLastShiftDate] = useState<string | undefined>(undefined);
  const [payChartRange, setPayChartRange] = useState<"7d" | "4wk" | "12mo" | "custom">("7d");
  // ITEM 17 — which pay period's per-job breakdown is expanded.
  const [expandedPayPeriod, setExpandedPayPeriod] = useState<string | null>(null);
  // ITEM 2 — SOPs modal, reachable from the header on any tab.
  const [sopOpen, setSopOpen] = useState(false);
  // FEATURE — employee-submitted mileage log (mileage_logs table, migration
  // 0023), synced via Supabase so the owner can see/approve it from any
  // device — the existing ExpensesPage.tsx mileage tab is owner-side and
  // localStorage-only, with no way for an employee to submit into it at all.
  const [mileageLogs, setMileageLogs] = useState<any[]>([]);
  const [mileageForm, setMileageForm] = useState({ date: localDateStr(), from: "", to: "", miles: "", purpose: "" });
  const [mileageSubmitting, setMileageSubmitting] = useState(false);
  // BLOCKER 11 (mobile round 7) — the only "custom period" controls anywhere
  // on this tab were fixed presets (7 days / 4 weeks / 12 months) or the
  // calendar's month prev/next (capped at the current month) — there was no
  // way to actually pick an arbitrary date range as asked for.
  const [payCustomStart, setPayCustomStart] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [payCustomEnd, setPayCustomEnd] = useState(() => localDateStr());
  // Drives a spinner on the "Share My Location" button for the window between
  // tapping it and the browser's permission prompt resolving — previously the
  // button gave zero feedback during that gap, which read as "does nothing".
  const [locationPermissionPending, setLocationPermissionPending] = useState(false);
  // Tracks whether the current pause is a lunch break (shows countdown) or a general pause.
  // Stored in localStorage so it survives re-renders but not page reloads intentionally —
  // on reload the type resets to "pause", which is fine since the countdown state resets too.
  const [pauseIsLunch, setPauseIsLunch] = useState<boolean>(() => {
    try { return localStorage.getItem("crm.pauseIsLunch") === "1"; } catch { return false; }
  });
  const setPauseMode = (isLunch: boolean) => {
    setPauseIsLunch(isLunch);
    try { localStorage.setItem("crm.pauseIsLunch", isLunch ? "1" : "0"); } catch {}
  };
  // Forces a re-render every second so the shift timer reads HH:MM:SS live —
  // the value itself is never read, only its change triggers the re-render.
  const [, setShiftTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setShiftTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  // Login extras
  const [forgotSent, setForgotSent] = useState(false);
  // Incoming job requests on Today tab
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);
  const [inlineDenyId, setInlineDenyId] = useState<string | null>(null);
  const [inlineDenyReason, setInlineDenyReason] = useState("");
  // AUDIT FIX — same withTimeout/loading-state gap as handleAcceptRequest/
  // handleDenyRequest above, for the inline "Incoming Requests" card path.
  // Tracked per-request-id since multiple inline cards can show at once.
  const [respondingToInlineId, setRespondingToInlineId] = useState<string | null>(null);

  // Normalize Supabase snake_case columns to the camelCase Employee shape the
  // rest of the code expects. BLOCKER — this used to normalize none of the
  // shift-timer or payroll fields at all (unlike App.tsx's own
  // normalizeEmployee, which the OWNER's side reads through), so if any of
  // those camelCase columns landed lowercase in Postgres (unquoted DDL —
  // see docs/ARCHITECTURE.md), the EMPLOYEE'S OWN view of their shift/pay status could
  // silently disagree with what the owner sees for the exact same row.
  const normalizeEmp = (e: any) => !e ? null : ({
    ...e,
    id: e.id || "",
    firstName: e.firstName || e.first_name || "",
    lastName: e.lastName || e.last_name || "",
    role: e.role || "Technician",
    status: e.status || "active",
    hourlyRate: e.hourlyRate ?? e.hourly_rate ?? 0,
    email: e.email || "",
    dayClockInAt: e.dayClockInAt ?? e.dayclockinat ?? e.day_clock_in_at ?? null,
    dayLunchStartAt: e.dayLunchStartAt ?? e.daylunchstartat ?? e.day_lunch_start_at ?? null,
    dayPausedMinutes: e.dayPausedMinutes ?? e.daypausedminutes ?? e.day_paused_minutes ?? 0,
    locationSharing: e.locationSharing ?? e.locationsharing ?? e.location_sharing ?? false,
    lastLocation: e.lastLocation ?? e.lastlocation ?? e.last_location ?? null,
    paidPeriods: e.paidPeriods ?? e.paidperiods ?? e.paid_periods ?? {},
    paidDays: e.paidDays ?? e.paiddays ?? e.paid_days ?? {},
    paidJobs: e.paidJobs ?? e.paidjobs ?? e.paid_jobs ?? {},
    paymentLog: e.paymentLog ?? e.paymentlog ?? e.payment_log ?? [],
    lastShiftHours: e.lastShiftHours ?? e.lastshifthours ?? e.last_shift_hours ?? 0,
    lastShiftDate: e.lastShiftDate ?? e.lastshiftdate ?? e.last_shift_date ?? "",
  });

  // Capture hash synchronously on first render, before App.tsx's hash-sync effect can strip the invite param
  const capturedHashRef = useRef(window.location.hash);

  // Parse invite code from URL hash — e.g. #/portal?invite=ABC123
  useEffect(() => {
    const hash = capturedHashRef.current;
    const match = hash.match(/[?&]invite=([A-Z0-9]+)/i);
    if (!match) return;
    const code = match[1];
    setInviteCode(code);

    const applyInvite = (inv: any) => {
      if (!inv) { setLoginError("Invalid or expired invite link."); return; }
      if (inv.used) { setLoginError("This invite has already been used. Please sign in instead."); return; }
      // Normalise field names — Supabase uses snake_case, localStorage uses camelCase
      const firstName = inv.firstName || (inv.employee_name || "").split(" ")[0] || "";
      const lastName = inv.lastName || (inv.employee_name || "").split(" ").slice(1).join(" ") || "";
      const email = inv.email || inv.employee_email || "";
      const role = inv.role || "Technician";
      const hourlyRate = inv.hourlyRate ?? inv.hourly_rate ?? 0;
      const normalised = { ...inv, firstName, lastName, email, role, hourlyRate };
      setInviteRecord(normalised);
      setLoginEmail(email);
      setLoginFirst(firstName);
      setLoginLast(lastName);
      setLoginMode("register");
    };

    const lookup = async () => {
      // If the user already has a session, skip invite processing — they're registered.
      // Never call signOut() here: Supabase fires the SIGNED_OUT event asynchronously,
      // which can race with a SIGNED_IN that follows, killing the just-created session.
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) return;

      // 1. Try the service-role invite-lookup function first — works from
      // any browser/device. Routed through functions/api/invite-action.ts
      // rather than a direct Supabase query because the invites table's RLS
      // is now owner_id-scoped (supabase/migrations/0033_multitenant_owner_
      // scoping.sql) and there's no session/owner_id yet to scope an
      // anonymous code lookup by — a public `SELECT true` policy would leak
      // every business's pending invites, not just this one code.
      try {
        const res = await fetch("/api/invite-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "lookup", code }),
        });
        const result = await res.json().catch(() => ({} as any));
        if (res.ok && result?.invite) {
          applyInvite(result.invite);
          return;
        }
        if (res.status === 404 || res.status === 410) {
          applyInvite(null);
          return;
        }
        // Any other server error — fall through to localStorage
      } catch { /* fall through */ }

      // 2. Fallback: localStorage (same browser as owner)
      try {
        const stored: any[] = JSON.parse(localStorage.getItem("crm.invites") || "[]");
        const inv = stored.find((i: any) => i.code === code);
        applyInvite(inv ?? null);
      } catch {
        applyInvite(null);
      }
    };

    lookup();
  }, []);

  // Parse job request ID from URL hash (#/portal?request=UUID)
  useEffect(() => {
    const hash = capturedHashRef.current;
    const match = hash.match(/[?&]request=([a-f0-9-]{36})/i);
    if (match) setRequestId(match[1]);
  }, []);

  // FEATURE — "a clickable link that can take you to the CRM to view the
  // job in the employee portal." The Google Calendar event this app creates
  // links here (#/portal?job=UUID) — opens straight into that job's detail
  // view instead of just the generic portal home. Waits for `jobs` to
  // actually load (not just empSession) since selecting an id before the
  // real job list has arrived would silently no-op.
  useEffect(() => {
    const hash = capturedHashRef.current;
    const match = hash.match(/[?&]job=([a-f0-9-]{36})/i);
    if (match && jobs.some(j => j.id === match[1])) setSelectedJobId(match[1]);
  }, [jobs]); // eslint-disable-line react-hooks/exhaustive-deps

  const myEmployee = empSession
    ? (employees.find(e => (e as any).user_id === empSession.user.id) ||
       employees.find(e => e.email?.toLowerCase() === empSession.user.email?.toLowerCase()) ||
       localEmployee ||
       null)
    : null;

  // AUDIT FIX — "fire/suspend an employee, revoke their access." App.tsx's
  // resolveUserRole only blocks a NON-active employee at sign-in — a
  // status flip while this portal is already open in a tab (the owner
  // fires someone mid-shift) was never re-checked, so that tab could keep
  // clocking in/out, messaging customers, etc. indefinitely on its
  // existing session. `employees` is already polled every ~3-10s for Live
  // Crew View/shift sync elsewhere in this file — this just acts on it:
  // the moment this employee's own row shows a non-active status, sign
  // them out for real, the same way App.tsx already does at login.
  useEffect(() => {
    const status = (myEmployee as any)?.status;
    if (!myEmployee || !status || status === "active") return;
    console.warn("[Access] employee status changed to", status, "mid-session — signing out");
    toast?.(status === "terminated" ? "Your access to this account has been removed." : "Your access is currently paused — contact your employer.", "red");
    supabase.auth.signOut().catch(() => {});
  }, [(myEmployee as any)?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — "keep updating the owner" while clocked in with sharing on,
  // not just a one-time GPS snapshot at the moment the toggle was flipped.
  // Piggybacks on the mileage tracker's existing watchPosition callback
  // (startAutoMileageTracking below) rather than running a second GPS
  // watcher. That callback is created once and doesn't re-render, so it
  // needs a ref (not the reactive value directly) to see the CURRENT
  // locationSharing state on every position update over the life of the watch.
  useEffect(() => {
    locationSharingRef.current = optimisticLocationSharing !== undefined ? optimisticLocationSharing : !!(myEmployee as any)?.locationSharing;
  }, [optimisticLocationSharing, (myEmployee as any)?.locationSharing]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — new-hire onboarding packet (migration 0039). Owner assigns
  // this from EmployeesPage's invite modal by copying settings.
  // onboardingTemplateItems into a real employee_onboarding row; this loads
  // that row (if any) so it can be checked off here in the portal.
  const [onboarding, setOnboarding] = useState<EmployeeOnboarding | null>(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [onboardingSavingId, setOnboardingSavingId] = useState<string | null>(null);

  // FEATURE — "make the employee portal work offline and automatically
  // sync when back online." isOnline drives the persistent banner below;
  // pendingSyncCount reflects the offline job-patch queue (see updateJob's
  // queueOfflineJobPatch calls) so the employee can see there's real
  // unsynced work waiting, not just a vague "offline" label.
  const isOnline = useOnlineStatus();
  const [pendingSyncCount, setPendingSyncCount] = useState(() => getPendingJobPatches().length);
  const [syncingOffline, setSyncingOffline] = useState(false);
  useEffect(() => {
    if (!isOnline) { setPendingSyncCount(getPendingJobPatches().length); return; }
    const pending = getPendingJobPatches();
    if (pending.length === 0) return;
    setSyncingOffline(true);
    (async () => {
      let succeeded = 0;
      for (const p of pending) {
        try {
          const res = await withTimeout<any>((supabase as any).from("jobs").update(p.patch).eq("id", p.jobId).select("id"), 20000, "Offline sync");
          if (!res?.error && res?.data?.length > 0) { clearPendingJobPatch(p.jobId); succeeded++; }
        } catch (e: any) {
          console.warn("[OfflineSync] failed to replay patch for job", p.jobId, ":", e?.message);
        }
      }
      setPendingSyncCount(getPendingJobPatches().length);
      setSyncingOffline(false);
      if (succeeded > 0) toast?.(`Synced ${succeeded} offline change${succeeded !== 1 ? "s" : ""} ✓`, "green");
    })();
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — "a training process for employees... training tests with
  // multiple-choice questions that are graded." myTrainingCompletions is
  // this employee's own pass/fail history, fetched once myEmployee is
  // known; activeTrainingModule/quizAnswers/trainingResult drive the
  // read-then-quiz flow rendered in the Training tab below.
  const [myTrainingCompletions, setMyTrainingCompletions] = useState<any[]>([]);
  const [activeTrainingModule, setActiveTrainingModule] = useState<any | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [trainingResult, setTrainingResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [submittingTraining, setSubmittingTraining] = useState(false);
  useEffect(() => {
    if (!myEmployee?.id) { setMyTrainingCompletions([]); return; }
    (supabase as any).from("training_completions").select("*").eq("employee_id", myEmployee.id)
      .then((r: any) => { if (!r?.error) setMyTrainingCompletions(Array.isArray(r?.data) ? r.data : []); })
      .catch(() => {});
  }, [myEmployee?.id]);
  const startTrainingModule = (m: any) => { setActiveTrainingModule(m); setQuizAnswers({}); setTrainingResult(null); };
  const submitTrainingQuiz = async () => {
    if (!activeTrainingModule || !myEmployee?.id) return;
    const quiz = activeTrainingModule.quiz || [];
    if (quiz.length === 0) {
      // Instructions-only module — marked complete on read, no grading.
      setTrainingResult({ score: 100, passed: true });
    } else {
      const correct = quiz.filter((q: any) => quizAnswers[q.id] === q.correctIndex).length;
      const score = Math.round((correct / quiz.length) * 100);
      const passed = score >= (activeTrainingModule.passingScore ?? 80);
      setTrainingResult({ score, passed });
    }
    setSubmittingTraining(true);
    try {
      const score = quiz.length === 0 ? 100 : Math.round((quiz.filter((q: any) => quizAnswers[q.id] === q.correctIndex).length / quiz.length) * 100);
      const passed = quiz.length === 0 ? true : score >= (activeTrainingModule.passingScore ?? 80);
      const row = {
        id: uid(), owner_id: (myEmployee as any).owner_id, module_id: activeTrainingModule.id,
        employee_id: myEmployee.id, employee_name: myEmployee.name, score, passed,
        answers: quizAnswers, completed_at: new Date().toISOString(),
      };
      // BUG FIX (audit) — every other async button handler in this file
      // wraps its Supabase call in withTimeout so a hung request can't
      // leave Submit stuck on its busy state forever; this one didn't.
      const { error } = await withTimeout<any>((supabase as any).from("training_completions").insert(row), 15000, "Training result save");
      if (error) { toast?.("Couldn't save your training result — " + error.message, "red"); return; }
      setMyTrainingCompletions(prev => [...prev, row]);
      toast?.(passed ? "Training passed ✓" : "Training result submitted", passed ? "green" : "yellow");
    } catch (e: any) {
      toast?.("Couldn't save your training result — " + (e?.message || "unknown error"), "red");
    } finally {
      setSubmittingTraining(false);
    }
  };
  useEffect(() => {
    if (!myEmployee?.id) { setOnboarding(null); return; }
    let cancelled = false;
    (async () => {
      setOnboardingLoading(true);
      try {
        const { data, error }: any = await withTimeout<any>(
          (supabase as any).from("employee_onboarding").select("*").eq("employee_id", myEmployee.id).maybeSingle(),
          10000, "Onboarding load"
        );
        if (!cancelled && !error) setOnboarding(data || null);
      } catch (e: any) {
        // table may not exist yet, or the request timed out — not fatal, the
        // tab just won't show (see the nav `show` condition below).
        console.warn("[Onboarding] load failed:", e?.message);
      } finally {
        if (!cancelled) setOnboardingLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [myEmployee?.id]);

  const toggleOnboardingItem = async (itemId: string, done: boolean) => {
    if (!onboarding) return;
    const prevOnboarding = onboarding;
    const nextItems = (onboarding.items || []).map((it: any) =>
      it.id === itemId ? { ...it, done, completedAt: done ? new Date().toISOString() : null } : it
    );
    setOnboarding({ ...onboarding, items: nextItems });
    setOnboardingSavingId(itemId);
    try {
      // BUG FIX (audit) — checked only a thrown error before; a 0-row RLS
      // mismatch resolves with no error at all (docs/ARCHITECTURE.md's "0-row silent
      // success"), so a real failure here would still toast "Marked
      // complete ✓" with nothing actually saved.
      const { error, data }: any = await withTimeout<any>(
        (supabase as any).from("employee_onboarding").update({ items: nextItems, updated_at: new Date().toISOString() }).eq("id", onboarding.id).select("id"),
        10000, "Onboarding save"
      );
      if (error) throw new Error(error.message);
      if (!Array.isArray(data) || data.length === 0) throw new Error("Save didn't match your onboarding record — try refreshing the page.");
      toast(done ? "Marked complete ✓" : "Marked incomplete", "green");
    } catch (e: any) {
      setOnboarding(prevOnboarding);
      toast("Couldn't save — " + (e?.message || "unknown error"), "red");
    } finally {
      setOnboardingSavingId(null);
    }
  };

  // ISSUE 16 (round 4) — GPS auto-mileage tracking. Runs entirely in the
  // browser (watchPosition), so it only accumulates while this tab is open
  // and the OS hasn't suspended it — a real limitation of browser
  // geolocation vs. a native app, not something fixable from here. It's a
  // genuine improvement over "nothing happens unless you tap Auto-Estimate"
  // and stacks with (doesn't replace) the existing Maps-based estimate and
  // manual entry, which stay as fallbacks if GPS never got a fix. Persisted
  // to localStorage (not Supabase) keyed by employee+day so a reload
  // mid-shift on the SAME device doesn't lose the running total; nothing
  // here needs a schema change since the final number is only ever written
  // to the existing mileage_logs table on submit, same as manual entry.
  const dayTrackKey = "crm.dayAutoMiles." + ((myEmployee as any)?.id || "x") + "." + localDateStr();
  const [dayTrackedMiles, setDayTrackedMiles] = usePersistent<number>(dayTrackKey, 0);
  const gpsWatchIdRef = useRef<number | null>(null);
  const lastGpsPosRef = useRef<{ lat: number; lng: number; t: number } | null>(null);
  const autoMileageEnabled = (settings as any)?.autoMileageTrackingEnabled !== false; // default ON
  // Haversine distance in miles between two lat/lng points.
  const haversineMiles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const R = 3958.8; // Earth radius, miles
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  };
  const startAutoMileageTracking = () => {
    // FEATURE — this watcher now also drives live location sharing (see
    // locationSharingRef above), not just mileage — so it needs to start
    // whenever EITHER is active, not only when mileage auto-tracking is
    // enabled. Previously "keep updating the owner while sharing" had no
    // mechanism at all: the toggle only ever captured ONE GPS fix at the
    // moment it was flipped on, then never updated again — which read
    // exactly like "the pin goes stale/doesn't persist."
    if ((!autoMileageEnabled && !locationSharingRef.current) || !navigator.geolocation || gpsWatchIdRef.current != null) return;
    lastGpsPosRef.current = null;
    try {
      gpsWatchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          const now = Date.now();
          // Filter GPS noise: ignore low-accuracy fixes (>100m) and any
          // implied speed over 100mph, which is almost always a jump/glitch
          // rather than real movement — without this, a stationary phone's
          // jittering fix alone can silently rack up "miles."
          if (accuracy != null && accuracy > 100) return;
          const prev = lastGpsPosRef.current;
          if (prev && autoMileageEnabled) {
            const miles = haversineMiles(prev, { lat, lng });
            const hours = Math.max((now - prev.t) / 3600000, 1 / 3600);
            if (miles / hours <= 100 && miles > 0.005) {
              setDayTrackedMiles((m: number) => Math.round((m + miles) * 100) / 100);
            }
          }
          lastGpsPosRef.current = { lat, lng, t: now };
          // Throttled live-location push — every ~90s while sharing is on,
          // not every single GPS fix (which can fire every few seconds and
          // would otherwise hammer Supabase for no real benefit).
          if (locationSharingRef.current && myEmployee?.id && now - lastLocationPushRef.current > 90000) {
            lastLocationPushRef.current = now;
            // BUG FIX (audit finding) — no 0-row check meant a silent RLS
            // mismatch left a stale pin on the owner's map with no signal
            // anywhere it happened; passive background write, so this logs
            // rather than toasts (a toast every ~90s would be its own bug).
            (supabase as any).from("employees").update({ lastLocation: { lat, lng, updatedAt: now } }).eq("id", myEmployee.id).select("id")
              .then((r: any) => {
                if (r?.error) console.warn("[Share Location] periodic update failed:", r.error.message);
                else if (!r?.data || r.data.length === 0) console.warn("[Share Location] periodic update matched 0 rows");
              })
              .catch((e: any) => console.warn("[Share Location] periodic update threw:", e?.message));
          }
        },
        (err) => console.warn("[Mileage] GPS watch error:", err.message),
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
      );
      console.log("[Mileage] auto-tracking started");
    } catch (e: any) {
      console.warn("[Mileage] couldn't start GPS tracking:", e?.message);
    }
  };
  const stopAutoMileageTracking = () => {
    if (gpsWatchIdRef.current != null) {
      navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      gpsWatchIdRef.current = null;
      console.log("[Mileage] auto-tracking stopped —", dayTrackedMiles, "mi logged");
    }
  };
  // Stop tracking if the component unmounts mid-shift (nav away, tab close).
  useEffect(() => () => stopAutoMileageTracking(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // Resume tracking on mount if a shift is already in progress (e.g. the
  // employee reloaded the page mid-shift) — otherwise it would only ever
  // start from a fresh tap of "Start My Day."
  useEffect(() => {
    if ((myEmployee as any)?.dayClockInAt) startAutoMileageTracking();
  }, [(myEmployee as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — mobile browsers throttle/suspend background tabs, so
  // watchPosition's callback can go quiet (or stop firing entirely) the
  // moment the employee switches apps or locks the phone — a genuine
  // browser-platform limit no website can fully override (only an
  // installed native app gets real background location). The one thing
  // that IS fixable: get a fresh fix the INSTANT the tab becomes visible
  // again, rather than leaving the owner looking at a stale pin until the
  // next ~90s tick (which itself may not have fired at all while backgrounded).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!locationSharingRef.current || !navigator.geolocation) return;
      const empId = (myEmployee as any)?.id;
      if (!empId) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lastLocationPushRef.current = Date.now();
          (supabase as any).from("employees").update({ lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() } }).eq("id", empId).select("id")
            .then((r: any) => {
              if (r?.error) console.warn("[Share Location] resume-on-visible update failed:", r.error.message);
              else if (!r?.data || r.data.length === 0) console.warn("[Share Location] resume-on-visible update matched 0 rows");
            });
        },
        () => { /* permission may have lapsed while backgrounded — next manual toggle will re-prompt */ },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [(myEmployee as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (optimisticDayClockInAt !== undefined && (myEmployee as any)?.dayClockInAt === optimisticDayClockInAt) {
      setOptimisticDayClockInAt(undefined);
    }
  }, [(myEmployee as any)?.dayClockInAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (optimisticDayLunchStartAt !== undefined && (myEmployee as any)?.dayLunchStartAt === optimisticDayLunchStartAt) {
      setOptimisticDayLunchStartAt(undefined);
    }
  }, [(myEmployee as any)?.dayLunchStartAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (optimisticLocationSharing !== undefined && !!(myEmployee as any)?.locationSharing === optimisticLocationSharing) {
      setOptimisticLocationSharing(undefined);
    }
  }, [(myEmployee as any)?.locationSharing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (optimisticLastShiftHours !== undefined && Number((myEmployee as any)?.lastShiftHours) === optimisticLastShiftHours) {
      setOptimisticLastShiftHours(undefined);
    }
  }, [(myEmployee as any)?.lastShiftHours]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (optimisticLastShiftDate !== undefined && (myEmployee as any)?.lastShiftDate === optimisticLastShiftDate) {
      setOptimisticLastShiftDate(undefined);
    }
  }, [(myEmployee as any)?.lastShiftDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective dayClockInAt — used by shift timer bar AND startDayShiftIfNeeded.
  // Keeps optimistic value until Supabase confirms it so the timer never flickers.
  const empDayClockInAt: number | null = optimisticDayClockInAt !== undefined
    ? optimisticDayClockInAt
    : ((myEmployee as any)?.dayClockInAt ?? null);
  const effLastShiftHours: number = optimisticLastShiftHours !== undefined
    ? optimisticLastShiftHours
    : (Number((myEmployee as any)?.lastShiftHours) || 0);
  const effLastShiftDate: string = optimisticLastShiftDate !== undefined
    ? optimisticLastShiftDate
    : ((myEmployee as any)?.lastShiftDate || "");

  // Shared function so both JobCard's "I'm Here" button and JobDetailView's
  // "I'm Here" button can auto-start the shift timer in one place.
  const startDayShiftIfNeeded = async () => {
    if (empDayClockInAt) return; // already running
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    // BLOCKER 10 (mobile round 7) — this is the OTHER place dayClockInAt gets
    // set fresh (auto-start via "I'm Here" on a job card). toggleDay's own
    // Resume-Day backdating (below, in the Today tab) never applied here, so
    // ending a shift and then just tapping "I'm Here" on the next job — the
    // more common flow than opening the Today tab and pressing Start My Day —
    // silently restarted the whole-day timer at zero instead of resuming.
    const localLastShift = (() => {
      try { return JSON.parse(localStorage.getItem("crm.lastShift." + empId) || "null"); } catch { return null; }
    })();
    // BLOCKER 13 (mobile round 9) — shiftDayStr() (4am cutover), not
    // localDateStr() (plain midnight), so a night-shift worker tapping "I'm
    // Here" a few minutes after local midnight still resumes the same
    // overnight shift instead of getting treated as a new calendar day.
    const alreadyWorkedTodayHours = (myEmployee as any)?.lastShiftDate === shiftDayStr()
      ? Number((myEmployee as any)?.lastShiftHours) || 0
      : (localLastShift?.date === shiftDayStr() ? Number(localLastShift?.hours) || 0 : 0);
    const nextVal = Date.now() - Math.round(alreadyWorkedTodayHours * 3600000);
    setOptimisticDayClockInAt(nextVal);
    try {
      const result = await (supabase as any)
        .from("employees")
        .update({ dayClockInAt: nextVal, dayLunchStartAt: null, dayPausedMinutes: 0 })
        .eq("id", empId)
        .select("id");
      if (result?.error) {
        console.warn("Auto-start shift failed:", result.error.message);
        setOptimisticDayClockInAt(undefined);
      } else if (!result?.data || result.data.length === 0) {
        console.warn("Auto-start shift — update matched 0 rows (blocked by permissions?)");
        setOptimisticDayClockInAt(undefined);
      } else {
        refetchEmployees?.();
        toast(alreadyWorkedTodayHours > 0 ? "Shift resumed ✓" : "Shift started automatically ✓");
      }
    } catch (e: any) {
      console.warn("Auto-start shift failed:", e?.message);
      setOptimisticDayClockInAt(undefined);
    }
  };

  // Log whenever the lookup inputs change so we can see if employees is empty on first render.
  // Also auto-retries once against Supabase when myEmployee isn't found in the prop array.
  useEffect(() => {
    if (!empSession) return;
    const userId = empSession.user.id;
    const email = empSession.user.email;

    if (!myEmployee && !autoRetryDoneRef.current) {
      autoRetryDoneRef.current = true;
      const uid2 = empSession.user.id;
      const email2 = empSession.user.email || "";
      // Ask parent to re-fetch from Supabase first (updates the employees prop)
      const doFetch = async () => {
        await refetchEmployees?.();
        // Then query directly in case the prop hasn't re-rendered yet
        try {
          const { data: byId } = await (supabase as any)
            .from("employees").select("*").eq("user_id", uid2).maybeSingle();
          if (byId) { setLocalEmployee(normalizeEmp(byId)); return; }
          const { data: byEmail } = await (supabase as any)
            .from("employees").select("*").ilike("email", email2).maybeSingle();
          if (byEmail) {
            // BUG FIX (audit finding) — no result check; a silent RLS
            // mismatch would still optimistically set local state as if the
            // link succeeded. Passive auto-retry (autoRetryDoneRef resets
            // each mount, so a failure here self-heals on the next page
            // load) — logs rather than toasts.
            const linkResult = await (supabase as any).from("employees").update({ user_id: uid2 }).eq("id", byEmail.id).select("id");
            if (linkResult?.error) console.warn("[EmployeeLink] user_id link failed:", linkResult.error.message);
            else if (!linkResult?.data || linkResult.data.length === 0) console.warn("[EmployeeLink] user_id link matched 0 rows");
            setLocalEmployee(normalizeEmp({ ...byEmail, user_id: uid2 }));
          }
        } catch { /* table may not exist */ }
      };
      doFetch();
    }
  }, [empSession, employees, localEmployee]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch job request data when employee logs in
  useEffect(() => {
    if (!requestId || !empSession) return;
    const load = async () => {
      setRequestLoading(true);
      try {
        const { data } = await (supabase as any)
          .from("job_requests").select("*").eq("id", requestId).maybeSingle();
        setRequestData(data);
      } catch { /* table may not exist */ }
      setRequestLoading(false);
    };
    load();
  }, [requestId, empSession?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load availability from employee record
  useEffect(() => {
    if (!myEmployee) return;
    const av = (myEmployee as any).availability;
    if (Array.isArray(av) && av.length > 0) setAvailability(av);
    const rdo = (myEmployee as any).recurringDaysOff;
    if (Array.isArray(rdo) && rdo.length > 0) setRecurringDaysOff(rdo);
    // Explicit both directions (was previously only ever set to false, never
    // back to true) so a value that legitimately changed server-side — e.g.
    // synced from another of this employee's own sessions/devices — is
    // reflected here too, not just on this one component's first mount.
    setAutoSyncCalendar((myEmployee as any).autoSyncCalendar !== false);
  }, [(myEmployee as any)?.id, (myEmployee as any)?.autoSyncCalendar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load this employee's own mileage log history on login/employee switch.
  useEffect(() => {
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    (async () => {
      try {
        const { data, error } = await (supabase as any).from("mileage_logs").select("*").eq("employee_id", empId).order("date", { ascending: false }).limit(50);
        if (!error && Array.isArray(data)) setMileageLogs(data);
      } catch { /* table may not exist yet */ }
    })();
  }, [(myEmployee as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — mileage auto-estimate: fills in miles (and from/to, if blank)
  // using that day's actual job addresses and Google's Distance Matrix
  // service, same API this file already uses for drive-time estimates
  // (fetchDriveTime above) and route optimization (optimizeRoute below).
  const [mileageEstimating, setMileageEstimating] = useState(false);
  const autoEstimateMileage = async () => {
    const dateStr = mileageForm.date || localDateStr();
    const dayJobs = myJobs.filter(j => j.scheduledDate === dateStr && j.address).sort((a, b) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
    const origin = mileageForm.from.trim() || homeBaseAddress || dayJobs[0]?.address;
    const destination = mileageForm.to.trim() || dayJobs[dayJobs.length - 1]?.address;
    if (!origin || !destination) { toast("No jobs found on " + dateStr + " to estimate from — enter From/To manually", "yellow"); return; }
    const distanceKey = (settings as any).googleGeocodingKey || settings.googleMapsKey;
    if (!distanceKey) { toast("Add a Google Maps API key in Settings to use auto-estimate", "red"); return; }
    setMileageEstimating(true);
    try {
      const { miles, durationText } = await withTimeout(fetchDriveDistance(origin, destination, distanceKey), 8000, "Distance calculation");
      setMileageForm(f => ({ ...f, from: f.from.trim() || origin, to: f.to.trim() || destination, miles: miles.toFixed(1) }));
      toast(`Estimated ${miles.toFixed(1)} mi (${durationText}) ✓ — review before saving`, "green");
    } catch (e: any) {
      toast("Couldn't estimate — " + (e?.message || "enter miles manually"), "red");
    } finally {
      setMileageEstimating(false);
    }
  };

  const submitMileageLog = async () => {
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    const miles = Number(mileageForm.miles) || 0;
    if (miles <= 0) { toast("Enter a mileage amount greater than 0", "red"); return; }
    setMileageSubmitting(true);
    // AUDIT FIX — mileage used to default to "pending" and Expenses>Mileage
    // (owner CRM) only ever queried status="approved", so submissions sat
    // invisible until the owner found and approved them in EmployeesPage.
    // Owner asked for mileage to sync automatically with no approval gate —
    // auto-approve on submit; the owner can still flag/deny a bad entry
    // after the fact from EmployeesPage, which will pull it back out of Expenses.
    // BUG FIX — mileage_logs is owner_id-scoped RLS (WITH CHECK owner_id =
    // current_owner_id()); this insert never set owner_id at all, so
    // Postgres wrote NULL and RLS rejected every single submission outright
    // (NULL never equals the check function's result) — root cause of
    // "mileage isn't showing up in the owner's Mileage section": it wasn't
    // a display bug, submissions were never reaching the table since the
    // multi-tenant RLS rollout. myEmployee.owner_id is the same value
    // written on this employee's own row at invite time.
    const row = { id: uid(), employee_id: empId, date: mileageForm.date || localDateStr(), from: mileageForm.from, to: mileageForm.to, miles, purpose: mileageForm.purpose, status: "approved", owner_id: (myEmployee as any)?.owner_id || null };
    try {
      const { error } = await (supabase as any).from("mileage_logs").insert(row);
      if (error) {
        console.error("[Mileage] insert failed:", error.message);
        toast("Couldn't save mileage — " + error.message, "red");
      } else {
        setMileageLogs(prev => [row, ...prev]);
        setMileageForm({ date: localDateStr(), from: "", to: "", miles: "", purpose: "" });
        toast("Mileage logged ✓", "green");
      }
    } catch (e: any) {
      toast("Couldn't save mileage — " + (e?.message || "unknown error"), "red");
    } finally {
      setMileageSubmitting(false);
    }
  };

  // Home base specifically re-syncs whenever Supabase's value changes (not
  // just once per login) — the periodic employees poll means a home base
  // set on another device shows up here within a few seconds instead of
  // requiring a fresh login on this device to ever see it. Guarded by a
  // recent-local-edit window so a poll landing mid-keystroke (saveHomeBaseAddress
  // fires on every change) never clobbers text the user is actively typing.
  useEffect(() => {
    const remote = (myEmployee as any)?.homeBaseAddress;
    if (remote && remote !== homeBaseAddress && Date.now() - homeBaseLastEditRef.current > 5000) {
      setHomeBaseAddressState(remote);
    }
  }, [(myEmployee as any)?.homeBaseAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate the Google connection from Supabase if localStorage doesn't have it
  // (different browser/device, or localStorage cleared) — so a real, still-valid
  // token saved by App.tsx's OAuth callback shows "Connected" without re-asking.
  // AUDIT FIX (Google keeps showing disconnected) — this used to only depend on
  // [myEmployee.id, empSession.user.id], both stable for the whole session, so
  // it effectively ran ONCE per login. If localStorage's token was invalid at
  // that moment (or absent) and the DB didn't have one YET either, this never
  // got another chance to hydrate later even after employees.google_token got
  // a real value from elsewhere (a different device's refresh, or the initial
  // OAuth callback landing a beat after this ran) — the employee stayed
  // "disconnected" until a full reload happened to re-run this by luck. Now
  // depends on the actual DB token fields, so any fresh value reaching the
  // `employees` prop (poll or realtime, both already wired for this table)
  // re-evaluates hydration immediately.
  useEffect(() => {
    if (!myEmployee || !empSession?.user?.id) return;
    const uid = empSession.user.id;
    const existing = getEmpGoogleToken(uid);
    if (isEmpGoogleTokenValid(existing)) return;
    const dbToken = (myEmployee as any).google_token;
    const dbExpiresAt = (myEmployee as any).google_token_expires_at;
    const dbRefreshToken = (myEmployee as any).google_refresh_token;
    if (!dbToken && !dbRefreshToken) return;
    // Hydrate even when the access token itself has already expired, as long
    // as there's a refresh_token — otherwise the silent-refresh effect below
    // never gets a chance to run on a device that's never connected before,
    // and the employee sees a "reconnect" prompt for a self-healing state.
    const expiresAt = dbExpiresAt ? new Date(dbExpiresAt).getTime() : 0;
    // Don't overwrite localStorage with an older DB snapshot than what's
    // already cached — only hydrate forward, never backward.
    if (existing?.token && existing.expiresAt >= (Number.isFinite(expiresAt) ? expiresAt : 0)) return;
    saveEmpGoogleToken(uid, {
      token: dbToken || "",
      refreshToken: dbRefreshToken || undefined,
      email: (myEmployee as any).google_email || empSession.user.email || "",
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : 0,
    });
    console.log("[GoogleConnect] EmployeePortal — hydrated Google token from Supabase (employees.google_token)");
    setGoogleHydrateTick(t => t + 1);
  }, [(myEmployee as any)?.id, empSession?.user?.id, (myEmployee as any)?.google_token, (myEmployee as any)?.google_token_expires_at, (myEmployee as any)?.google_refresh_token]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG FIX — "shows Google connected even when it's actually disconnected."
  // The "Connected ✓" banner was computed purely from a locally cached
  // token's expiresAt, which never learns a token was invalidated (revoked,
  // failed refresh_token exchange) until the cache's own expiry catches up —
  // could be up to an hour of showing a stale green badge. gFetch (shared by
  // owner and employee Google calls) now calls every onGoogleAuthFailure
  // subscriber the moment a 401 survives a refresh attempt.
  useEffect(() => {
    return onGoogleAuthFailure(() => {
      const uid = empSession?.user?.id;
      if (!uid) return;
      clearEmpGoogleToken(uid);
      setGoogleHydrateTick(t => t + 1);
      toast?.("Your Google connection expired — reconnect from the Google tab to resume calendar sync.", "red");
    });
  }, [empSession?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Silently refresh an expired Google access token using the stored
  // refresh_token before ever asking the employee to reconnect. Checked on
  // mount and every 5 minutes — Google access tokens last ~1hr, so this
  // catches expiry well before it would actually block a calendar/Gmail call.
  useEffect(() => {
    if (!empSession?.user?.id) return;
    const uid = empSession.user.id;
    const tryRefresh = async () => {
      const existing = getEmpGoogleToken(uid);
      if (isEmpGoogleTokenValid(existing) || !existing?.refreshToken) return;
      // FIX 10 (mobile round 6) — this used to bail out entirely when no
      // custom googleBackendUrl was configured, even though
      // refreshEmpGoogleToken already falls back to this project's own
      // same-origin /api/google-refresh Cloudflare Pages Function when
      // backendUrl is undefined. A backendUrl is an OPTIONAL self-hosted
      // override — requiring it here meant this refresh never even
      // attempted for the common case (no custom backend configured),
      // which is the actual reason tokens "kept expiring and didn't
      // persist": nothing was ever retrying them.
      const backendUrl = settings?.googleBackendUrl;
      const refreshed = await refreshEmpGoogleToken(backendUrl, existing.refreshToken);
      if (!refreshed?.token) {
        // A real refresh attempt (refresh_token WAS present) failed — only
        // now is it honest to call this "expired, needs reconnect" rather
        // than a transient, self-healing state.
        setEmpGoogleRefreshFailed(true);
        setEmpGoogleConfigMissing(!!refreshed?.configMissing);
        return;
      }
      setEmpGoogleRefreshFailed(false);
      setEmpGoogleConfigMissing(false);
      saveEmpGoogleToken(uid, { ...existing, token: refreshed.token, expiresAt: refreshed.expiresAt });
      // BUG FIX — "...catch is not a function," repeating in the console
      // on every Google token refresh. See lib/googleApi.ts's comment on
      // this same class of bug (raw PostgrestBuilder has no .catch()).
      // BUG FIX (audit) — discarded both success and error with no row-count
      // check; a genuinely failed persist here was invisible (low severity —
      // this retries every 5 minutes regardless — but inconsistent with the
      // row-check pattern this same effect family uses elsewhere).
      (supabase as any).from("employees")
        .update({ google_token: refreshed.token, google_token_expires_at: new Date(refreshed.expiresAt).toISOString() })
        .eq("user_id", uid).select("id")
        .then((r: any) => {
          if (r?.error || !Array.isArray(r?.data) || r.data.length === 0) console.warn("[GoogleRefresh] persist failed:", r?.error?.message || "0 rows matched");
        }, (e: any) => console.warn("[GoogleRefresh] persist failed:", e?.message));
      setGoogleHydrateTick(t => t + 1);
    };
    tryRefresh();
    const interval = setInterval(tryRefresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [empSession?.user?.id, settings?.googleBackendUrl]);

  // Fetch incoming job requests for this employee. The loading flag only
  // gates the very first fetch — flipping it on every 10s background poll
  // made the "Incoming Requests" section vanish and reappear continuously,
  // which is what caused the Today tab to visibly jump up and down.
  const incomingFirstLoadRef = useRef(true);
  useEffect(() => {
    if (!empSession || !myEmployee) return;
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    const load = async () => {
      if (incomingFirstLoadRef.current) setIncomingLoading(true);
      try {
        // ISSUE 10 — this silently swallowed EVERY error (missing table,
        // missing/blocking RLS policy, etc.), which is indistinguishable
        // from "no requests yet" in the UI. Log it so a request that really
        // was created but isn't showing up has an actual error message to
        // debug instead of just an empty list — see
        // supabase/migrations/0018_job_requests_table.sql, which is the one
        // most likely to not have been run yet (confirm it's applied the
        // same way migration 0019 was).
        const { data, error } = await (supabase as any)
          .from("job_requests")
          .select("*")
          .eq("employee_id", empId)
          .order("created_at", { ascending: false });
        if (error) console.error("[IncomingRequests] fetch failed:", error.message, "— run supabase/migrations/0018_job_requests_table.sql if it hasn't been applied yet");
        if (Array.isArray(data)) setIncomingRequests(data);
      } catch (e: any) { console.error("[IncomingRequests] fetch threw:", e?.message); }
      if (incomingFirstLoadRef.current) { setIncomingLoading(false); incomingFirstLoadRef.current = false; }
    };
    load();
    const interval = setInterval(() => { if (shouldPollJobs()) load(); }, 5000);
    return () => clearInterval(interval);
  }, [(myEmployee as any)?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch jobs from Supabase so Supabase-side crew assignments are visible.
  // Runs once when the employee resolves, then polls every 5s (plus a
  // realtime subscription where available) so changes the owner — or this
  // employee on another device — makes while this portal is open show up
  // without a manual refresh.
  useEffect(() => {
    if (!empSession || !myEmployee) return;
    const empId = myEmployee.id;
    const empUserId = (myEmployee as any).user_id;
    const load = async () => {
      try {
        // FIX 3 (mobile round 8) — root cause of "not all assigned jobs show
        // on the calendar": this used to try narrowing by crew membership
        // first (two separate queries, since crew entries may store either
        // the employee's `id` or their `user_id`), and only fell through to
        // fetching everything if BOTH narrow queries came back empty. But if
        // attempt1 (crew contains `id`) found ANY jobs at all, attempt2 (crew
        // contains `user_id`) — and therefore attempt3, the fetch-everything
        // fallback — never ran, silently dropping every job crewed under the
        // OTHER id shape from local state entirely. myJobs' client-side
        // filter (crewIncludesEmployee) already correctly checks both id
        // shapes, so the fix is to just always fetch everything and let that
        // filter do its job, rather than trying to out-guess it with a
        // narrower server-side query that can silently short-circuit.
        const { data: allData } = await (supabase as any).from("jobs").select("*");
        let data: any[] = Array.isArray(allData) ? allData : [];

        // BLOCKER 2 (mobile round 7) — casing-normalize every job row coming
        // out of Supabase (loggedHours/clockInAt/etc can fold to lowercase —
        // see normalizeJobRow), or the employee's own Pay tab silently reads
        // 0 hours even though the real number is on the row already.
        if (Array.isArray(data)) data = data.map(normalizeJobRow);
        // Fields the employee's own clock/lunch actions own — an in-flight
        // Supabase write for one of these (or a stale/slow row read) must never
        // win against a more recent local change, or the clock-out → clock-in
        // toggle can revert mid-air on the next poll tick and look stuck.
        const EMPLOYEE_OWNED_FIELDS = ["clockInAt", "lunchStartAt", "lunchMinutes", "lunchExceeded", "loggedHours"] as const;
        if (Array.isArray(data) && data.length > 0) {
          setJobs(prev => {
            const supabaseMap = new Map(data.map((j: any) => [j.id, j]));
            const merged = prev.map(j => {
              if (!supabaseMap.has(j.id)) return j;
              const remote = supabaseMap.get(j.id);
              const next = { ...j, ...remote };
              // BLOCKER 2 fix — only let the local copy win when it actually
              // HAS a value; previously this always overwrote with the local
              // value even when undefined (e.g. right after a fresh page
              // load before local state was populated), discarding perfectly
              // good remote hours/clock data and making them look zeroed.
              EMPLOYEE_OWNED_FIELDS.forEach(f => {
                const localVal = (j as any)[f];
                if (localVal !== undefined && localVal !== null) next[f] = localVal;
              });
              return next;
            });
            const existingIds = new Set(prev.map(j => j.id));
            const added = data.filter((j: any) => !existingIds.has(j.id));
            const result = [...merged, ...added];
            const myJobsFiltered = result.filter(j => crewIncludesEmployee(j.crew, empId, empUserId));
            return result;
          });
        }
      } catch (e) { console.warn("ALL JOBS — fetch failed:", e); }
    };
    refetchJobsRef.current = load;
    load();
    let channel: any = null;
    try {
      channel = (supabase as any)
        .channel("emp-jobs-sync-" + empId)
        .on("postgres_changes", { event: "*", schema: "public", table: "jobs" }, () => { load(); })
        .subscribe();
    } catch { /* realtime may not be enabled on this project */ }
    // EGRESS FIX — was an unconditional 3s poll; realtime above already
    // covers instant updates, this is now just the fallback, and skips
    // entirely while the tab is hidden or the employee is idle 5+ minutes.
    // Widened 10s -> 60s, now using the owner-configurable interval
    // (Settings, default 120s): `load()` is a select("*") on jobs, which
    // carries every job's inline base64 photos/videos (types/index.ts
    // Photo.dataUrl etc.) — a fast fallback poll re-downloads all of that
    // every tick for every open employee portal, which is the dominant
    // driver of a real Supabase egress overage. Realtime already handles
    // the instant case.
    const interval = setInterval(() => { if (shouldPollJobs()) load(); }, getPollIntervalMs(settings));
    return () => {
      clearInterval(interval);
      try { channel?.unsubscribe(); } catch { /* ignore */ }
    };
  }, [(myEmployee as any)?.id, (settings as any)?.pollIntervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodically refetch the employees table so a Google connection (or any
  // other field) made on a DIFFERENT device shows up here without requiring
  // a full page reload — without this, each device's `employees` state was
  // only ever fetched once at mount and never converged with what another
  // device wrote to the same Supabase row.
  useEffect(() => {
    if (!empSession?.user?.id) return;
    // EGRESS — was a hardcoded 10s regardless of the owner's configured
    // fallback-poll interval; every logged-in employee session polling the
    // full employees table that often adds up fast with more than one or
    // two crew members.
    const interval = setInterval(() => { if (shouldPollJobs()) refetchEmployees?.(); }, getPollIntervalMs(settings));
    return () => clearInterval(interval);
  }, [empSession?.user?.id, (settings as any)?.pollIntervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge owner-set permissions with defaults (all-on for existing employees with no permissions field)
  const perms: Record<string, boolean> = { ...DEFAULT_PERMISSIONS, ...((myEmployee as any)?.permissions || {}) };

  // This whole component also mounts for the owner's "preview as team" view
  // (isOwnerView), which has no empSession/myEmployee at all — none of the
  // employee-specific filtering, logging, or fetching below is meaningful
  // there, so it's gated on empSession rather than running unconditionally.
  const myJobs = empSession && myEmployee
    ? jobs.filter(j => crewIncludesEmployee(j.crew, myEmployee.id, (myEmployee as any).user_id))
    : [];
  if (empSession) {
  }

  // Fetch any job's customer directly from Supabase when it isn't found in the
  // customers prop. Each missing ID gets its own .single() query so a bad ID
  // doesn't poison the whole batch. Results land in localCustomerCache (local
  // state — always reliable). Failed or timed-out IDs also get a sentinel entry
  // so the card stops showing "loading..." and shows "Unknown Customer" instead.
  // missingCustomerFetchRef prevents duplicate in-flight requests.
  const missingCustomerFetchRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!empSession || myJobs.length === 0) return;
    const knownIds = new Set([
      ...customers.map((c: any) => c.id),
      ...Object.keys(localCustomerCache),
    ]);
    const missingIds = Array.from(new Set(myJobs.map(j => j.customerId).filter(Boolean)))
      .filter(id => !knownIds.has(id) && !missingCustomerFetchRef.current.has(id));
    if (missingIds.length === 0) return;

    const storeSentinel = (id: string) => {
      setLocalCustomerCache(prev => ({ ...prev, [id]: { id, firstName: "Unknown", lastName: "Customer" } as any }));
    };

    for (const id of missingIds) {
      missingCustomerFetchRef.current.add(id);
      const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 3000));
      const query = (supabase as any).from("customers").select("*").eq("id", id).single();
      Promise.race([query, timeout])
        .then((r: any) => {
          if (r === null) {
            console.error("CUSTOMER FETCH ERROR: timed out for customerId", id);
            storeSentinel(id);
            return;
          }
          if (r?.error) {
            const err = r.error;
            console.error("CUSTOMER FETCH ERROR | customerId:", id,
              "\n  status:", err?.status,
              "\n  message:", err?.message,
              "\n  details:", err?.details,
              "\n  hint:", err?.hint,
              "\n  full:", JSON.stringify(err));
            storeSentinel(id);
            return;
          }
          const c: Customer = r.data;
          if (!c) {
            console.error("CUSTOMER FETCH ERROR: no data returned | customerId:", id, "| status:", r?.status);
            storeSentinel(id);
            return;
          }
          setLocalCustomerCache(prev => ({ ...prev, [c.id]: c }));
          setCustomers((prev: any[]) => prev.find(x => x.id === c.id) ? prev : [...prev, c]);
        })
        .catch((e: any) => {
          console.error("CUSTOMER FETCH ERROR (thrown) | customerId:", id,
            "\n  message:", e?.message);
          storeSentinel(id);
        });
    }
  }, [empSession, myJobs.map(j => j.customerId).join(","), customers.length, Object.keys(localCustomerCache).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 1: When the jobs array changes (3s Supabase poll), snap calSelectedDate
  // back to today so newly-assigned jobs that are scheduled today are visible
  // immediately without the employee having to navigate the calendar manually.
  // Cancelled jobs are already excluded from calVisibleJobs (see render below).
  useEffect(() => {
    setCalSelectedDate(localDateStr());
  }, [jobs.map(j => j.id + j.status).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time location sharing — runs the whole time the toggle is on (not
  // gated on being clocked in — the owner may want to see crew location
  // before/after a shift too), posting a GPS fix to Supabase so the owner's
  // Crew View → Live Now map can plot it. Stops automatically the moment
  // the toggle flips off (watch is torn down by the effect cleanup).
  // BUG FIX — "the location tracking is not accurate enough and does not
  // update fast enough." The old version called getCurrentPosition COLD
  // every 15s — each call restarts GPS acquisition from scratch, which is
  // both slower AND less accurate than letting the GPS chip stay warm and
  // continuously refine its fix. watchPosition does exactly that — the OS
  // keeps the radio/chip active and pushes a new fix as soon as one's
  // available, typically both quicker and tighter than a fresh cold start
  // every time. Throttled to at most one DB write per 10s (down from 15s)
  // so Live Team View updates faster without hammering Supabase on every
  // single watch callback (which can fire much more often than that).
  useEffect(() => {
    const empId = (myEmployee as any)?.id;
    const sharing = (myEmployee as any)?.locationSharing;
    if (!empId || !sharing) return;
    if (!navigator.geolocation) { toast("This browser doesn't support location sharing", "red"); return; }
    let deniedToastShown = false;
    let lastPostAt = 0;
    const MIN_POST_INTERVAL_MS = 10000;
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const now = Date.now();
        if (now - lastPostAt < MIN_POST_INTERVAL_MS) return;
        lastPostAt = now;
        // BUG FIX (audit finding) — no 0-row check; a silent RLS mismatch
        // meant this live-tracking write could stop actually reaching the
        // owner's Live Team View with nothing but a normal-looking watch
        // callback still firing.
        (supabase as any).from("employees").update({
          lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, updatedAt: now },
        }).eq("id", empId).select("id").then((r: any) => {
          if (r?.error) console.warn("Location post failed:", r.error.message);
          else if (!r?.data || r.data.length === 0) console.warn("Location post matched 0 rows");
          else refetchEmployees?.();
        });
      },
      (err) => {
        // BUG FIX — "Live Team View isn't working... it said I never
        // allowed the permission but I did." This showed the SAME
        // "permission denied" toast for a genuine denial, a transient GPS
        // timeout, or GPS being briefly unavailable (routine indoors/
        // between buildings on a job site) — the last two are not
        // permission problems and don't mean sharing actually stopped
        // (the watch keeps running either way), but the alarming wrong
        // message made it look like it had.
        if (!deniedToastShown && err.code === err.PERMISSION_DENIED) { deniedToastShown = true; toast(geoErrorMessage(err), "red"); }
        console.warn("Geolocation error:", err.code, err.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [(myEmployee as any)?.id, (myEmployee as any)?.locationSharing]);

  // 24h job reminder — checks once on load (and hourly while the portal stays open)
  // for jobs starting within the next 24h, and emails the employee via their own
  // connected Gmail account. Dedupes via localStorage so each job only reminds once.
  useEffect(() => {
    if (!myEmployee || !empSession?.user?.id) return;
    const checkReminders = async () => {
      const empToken = await getValidEmpGoogleToken(empSession.user.id, settings?.googleBackendUrl);
      if (!empToken) return;
      const remindedKey = "crm.empReminded";
      let reminded: string[] = [];
      try { reminded = JSON.parse(localStorage.getItem(remindedKey) || "[]"); } catch { /* ignore */ }
      const now = Date.now();
      myJobs.forEach(j => {
        if (!j.scheduledDate || j.status === "completed" || reminded.includes(j.id)) return;
        const startDt = new Date(`${j.scheduledDate}T${j.scheduledTime || "09:00"}:00`).getTime();
        const hoursAway = (startDt - now) / 3600000;
        if (hoursAway > 0 && hoursAway <= 24) {
          console.log("[GoogleConnect] Employee job reminder — using EMPLOYEE's own Gmail account:", empToken!.email, "(never the owner's)");
          // BUG FIX — "the UI for the reminder does not look good." This was
          // the one email in the whole app sent as a bare, unstyled <p> with
          // no emailShell wrapper — every other email (Running Late, On My
          // Way, Invoice, Job Completed, etc.) uses it. Same branded shell
          // + a button back to the portal, matching the rest of the app.
          const portalLink = `${window.location.origin}${window.location.pathname}#/portal?job=${encodeURIComponent(j.id)}`;
          const reminderHtml = emailShell(settings, "Job Tomorrow", `<p>Hi ${myEmployee.firstName},</p><p>Reminder — you have a job coming up:</p><ul><li><b>Address:</b> ${j.address}</li><li><b>Date:</b> ${j.scheduledDate}${j.scheduledTime ? " at " + j.scheduledTime : ""}</li></ul>` + emailButton("Open Crew Portal", portalLink));
          sendViaGmail(
            empToken!.token, empToken!.email, empToken!.email,
            `Reminder: Job Tomorrow — ${j.address}`,
            reminderHtml
          ).then(() => {
            reminded.push(j.id);
            try { localStorage.setItem(remindedKey, JSON.stringify(reminded)); } catch { /* ignore */ }
          }).catch(() => {});
        }
      });
    };
    checkReminders();
    const h = setInterval(checkReminders, 60 * 60 * 1000);
    return () => clearInterval(h);
  }, [(myEmployee as any)?.id, myJobs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 8 — same UTC-vs-local mismatch as calSelectedDate above: this feeds
  // both the Today tab's job list and the Calendar tab's "isToday"
  // highlighting, so it must agree with the employee's actual local date.
  // ITEM 7 — plain local midnight still isn't right for a night-shift worker:
  // a job scheduled for tonight that runs past midnight used to vanish from
  // the Today tab (and lose its "isToday" calendar highlight) the instant the
  // calendar date rolled over, even though the employee was still actively
  // clocked in on it. shiftDayStr() applies the same 4am cutover the
  // whole-day shift timer already uses elsewhere in this file (dayClockInAt/
  // lastShiftDate) so a job started the night before keeps counting as
  // "today" until 4am, not local midnight.
  const todayStr = shiftDayStr();
  const todayJobs = myJobs.filter(j => j.scheduledDate === todayStr && j.status !== "cancelled");

  const weekStart = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10);
  })();
  const weekEnd = (() => {
    const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().slice(0, 10);
  })();
  const weekJobs = myJobs.filter(j => j.scheduledDate >= weekStart && j.scheduledDate <= weekEnd);

  // FIX 9 / FIX 5 (mobile round 3) — job.loggedHours (time on-site, see
  // finalizeCompletion) is the primary source, but employees.lastShiftHours/
  // lastShiftDate (the whole-day shift timer total, set on "End My Day") and
  // a currently-in-progress shift (dayClockInAt, not ended yet) can both
  // cover time no job captured at all. This used to be computed inline just
  // for weekStart/weekEnd — the Pay tab further down reimplemented its own
  // "hours in a date range" from scratch for each 14-day period WITHOUT this
  // top-up at all, so hours/pay showed correctly on the Today tab but as $0
  // on the Pay tab for anyone whose hours came mostly from the shift timer
  // rather than completed jobs. Shared as one function so both call sites
  // (and any future one) can't independently diverge again.
  const computeEmployeeShiftTopUp = (startDate: string, endDate: string): number => {
    // BUG FIX — this used to re-read myEmployee.lastShiftDate/lastShiftHours/
    // dayClockInAt straight off the prop, shadowing the optimistic-aware
    // empDayClockInAt/effLastShiftHours/effLastShiftDate defined above. Right
    // after "End My Day," the optimistic values are set immediately but the
    // prop only catches up once refetchEmployees() resolves — using the raw
    // prop here meant the Pay tab could show stale (pre-clock-out) hours for
    // however long that round trip took, reading exactly like "hours don't
    // show up." Use the effective (optimistic-first) values instead.
    const empLastShiftDate = effLastShiftDate;
    const empLastShiftHours = effLastShiftHours;
    const jobHoursOnShiftDate = empLastShiftDate
      ? myJobs.filter(j => j.status === "completed" && j.scheduledDate === empLastShiftDate).reduce((s, j) => s + Number(j.loggedHours || 0), 0)
      : 0;
    // Only the SINGLE most recent shift is ever stored server-side (no daily
    // history), so this can only top up that one day, and only the
    // shortfall beyond whatever job hours already landed on that same date
    // (never double-counted).
    const endedShiftTopUp = (empLastShiftDate && empLastShiftDate >= startDate && empLastShiftDate <= endDate)
      ? Math.max(0, empLastShiftHours - jobHoursOnShiftDate)
      : 0;
    // Still clocked in (dayClockInAt set, hasn't pressed "End My Day" yet) —
    // mirrors the live netShiftHoursNow formula used by the shift-timer
    // button below, so the two can't disagree once the shift actually ends.
    const liveShiftTopUp = (empDayClockInAt && todayStr >= startDate && todayStr <= endDate)
      ? (() => {
          const pausedMin = Number((myEmployee as any)?.dayPausedMinutes) || 0;
          const lunchStart = (myEmployee as any)?.dayLunchStartAt;
          const currentPauseMs = lunchStart ? Date.now() - lunchStart : 0;
          const liveHours = Math.max(0, (Date.now() - empDayClockInAt - pausedMin * 60000 - currentPauseMs) / 3600000);
          const jobHoursToday = myJobs.filter(j => j.status === "completed" && j.scheduledDate === todayStr).reduce((s, j) => s + Number(j.loggedHours || 0), 0);
          return Math.max(0, liveHours - jobHoursToday);
        })()
      : 0;
    // Avoid double-counting if lastShiftDate also happens to be today
    // (clocked in again after already ending a shift earlier the same day)
    // — the live figure supersedes the ended-shift one for today specifically.
    return (empLastShiftDate === todayStr && empDayClockInAt) ? liveShiftTopUp : liveShiftTopUp + endedShiftTopUp;
  };

  const weekShiftTopUpHours = computeEmployeeShiftTopUp(weekStart, weekEnd);
  const weekHours = weekJobs.reduce((s, j) => s + Number(j.loggedHours || 0), 0) + weekShiftTopUpHours;
  const weekJobsDone = weekJobs.filter(j => j.status === "completed").length;
  const weekPay = weekHours * (myEmployee?.hourlyRate || 0);

  const upNextJob = [...myJobs]
    .filter(j => j.scheduledDate >= todayStr && j.status !== "completed")
    .sort((a, b) => {
      const da = a.scheduledDate + (a.scheduledTime || "23:59");
      const db = b.scheduledDate + (b.scheduledTime || "23:59");
      return da.localeCompare(db);
    })[0] ?? null;
  const upNextCustomer = upNextJob ? findCustomer(upNextJob.customerId) : null;

  const payStart = (() => { const d = new Date(); d.setDate(d.getDate() - 14); return d.toISOString().slice(0, 10); })();
  const periodJobs = myJobs.filter(j => j.status === "completed" && j.scheduledDate >= payStart);
  const periodHours = periodJobs.reduce((s, j) => s + Number(j.loggedHours || j.duration || 0), 0);
  const estimatedPay = periodHours * (myEmployee?.hourlyRate || 0);

  const activeClockJobs = myJobs.filter(j => !!j.clockInAt);
  const activeClockJob = activeClockJobs[0];
  const formatElapsed = (clockInAt: number): string => {
    const sec = Math.max(0, Math.floor((Date.now() - clockInAt) / 1000));
    return [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map(n => String(n).padStart(2, "0")).join(":");
  };

  // Columns known to exist on every deployment of the jobs table. If a full
  // patch is rejected (e.g. an optional column like completedAt/amountCollected
  // isn't in this project's schema), the WHOLE update is discarded by
  // PostgREST — which silently drops critical fields like `status`. To stop a
  // "Mark Complete" from reverting on the next 3s poll, retry with just this
  // safe subset so the important fields always land.
  // [FIXHOURS] — completedAt must NOT be added here. It was added briefly in
  // a previous round, which defeated the entire point of this fallback list:
  // completedAt is an OPTIONAL column (see supabase/migrations/0015) that
  // isn't guaranteed to exist yet on every deployment. With it in this list,
  // any owner who hasn't run that migration got the retry-with-safe-columns
  // ALSO fail (PostgREST rejects the whole patch if ANY column is unknown) —
  // silently dropping `status`/`loggedHours` too, which is exactly what
  // "hours show in the employee portal (local state) but never reach the
  // owner CRM" looks like. Once the migration is run, completedAt reaches
  // Supabase fine on the FIRST attempt (the full, unfiltered patch below) —
  // it never needed to be in this fallback-only list at all.
  const CORE_JOB_COLUMNS = [
    "status", "paymentStatus", "paymentType", "loggedHours", "amountCollected", "invoiceSentAt", "arrivedAt",
    // "crewAssignedAt" was missing here (same gap as App.tsx's bulk autosave
    // and Dashboard's OWNER_CORE_JOB_COLUMNS) — see the comment there.
    "crew", "crewAssignedAt", "clockInAt", "lunchStartAt", "pipelineStage", "photos", "videos", "preChecklist", "duringChecklist",
    "postChecklist", "signOff", "scheduledTime", "commLog", "equipmentChecked", "notes",
  ] as const;
  const updateJob = (jobId: string, patch: Partial<Job>): Promise<any> => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, ...patch } : j));
    // Persist immediately rather than waiting on the 30s App-level auto-save —
    // the jobs-fetch poll below runs every 3s and merges Supabase's row straight
    // over local state, so anything not yet saved can get silently reverted by
    // the very next poll tick.
    // BUG FIX — "photo saved locally but failed to sync," "pre-job
    // checklist sync timed out." Both go through THIS shared write path,
    // which had no timeout/retry of its own — a single slow or dropped
    // connection (routine at a job site on spotty cell signal) permanently
    // failed the whole save with no second attempt, unlike every other
    // write path in this app (schedule_job's insert, etc.) which already
    // retries once before giving up. One retry after a real timeout, not
    // just the column-mismatch retry that already existed below.
    // BUG FIX — "the changes for a job were not saved" with no error shown.
    // PostgREST returns success/no-error on an UPDATE that matched ZERO
    // rows (RLS's owner_id-scoped policy silently filtering it out) —
    // .select("id") lets that be told apart from a real success so callers
    // (e.g. the Reschedule flow) don't report "saved ✓" for a write that
    // silently did nothing.
    // FEATURE — offline support. A save attempted while the device is
    // offline is guaranteed to time out (no point burning the full 20s +
    // retry window) — queue it immediately instead, and let the `online`
    // event flush effect below replay it once connectivity returns. This
    // is what makes "changes for a job were not saved" while offline
    // become "saved offline — synced automatically at 4:32pm" instead.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      queueOfflineJobPatch(jobId, patch);
      setPendingSyncCount(getPendingJobPatches().length);
      return Promise.resolve({ queuedOffline: true });
    }
    const attempt = () => withTimeout<any>((supabase as any).from("jobs").update(patch).eq("id", jobId).select("id"), 20000, "Job save");
    return attempt()
      .catch((e: any) => { console.warn("[updateJob] first attempt failed/timed out — retrying once:", e?.message); return attempt().catch((e2: any) => ({ error: e2 })); })
      .then(async (result: any) => {
        // A retry-exhausted failure while offline (e.g. the device dropped
        // connectivity mid-save, after the initial onLine check above
        // passed) queues for later instead of surfacing as a hard error —
        // same reasoning as the up-front check.
        if (result?.error && typeof navigator !== "undefined" && !navigator.onLine) {
          queueOfflineJobPatch(jobId, patch);
          setPendingSyncCount(getPendingJobPatches().length);
          return { queuedOffline: true };
        }
        if (result?.error) {
          console.warn("[updateJob] full patch failed:", result.error.message, "— retrying core fields only");
          const core: any = {};
          CORE_JOB_COLUMNS.forEach(k => { if ((patch as any)[k] !== undefined) core[k] = (patch as any)[k]; });
          if (Object.keys(core).length > 0) {
            const retry = await (supabase as any).from("jobs").update(core).eq("id", jobId).select("id");
            if (retry?.error) { console.error("[updateJob] core retry failed:", retry.error.message); return retry; }
            if (!retry?.data || retry.data.length === 0) { console.error("[updateJob] core retry matched 0 rows — blocked by permissions"); return { error: { message: "Update rejected by the server (permissions)" } }; }
            console.log("[FIXHOURS] core-columns retry succeeded — status/hours/pay synced to Supabase despite full-patch rejection:", Object.keys(core));
            return retry;
          }
          return result;
        }
        if (!result?.data || result.data.length === 0) {
          console.error("[updateJob] matched 0 rows — blocked by permissions for job", jobId);
          return { error: { message: "Update rejected by the server (permissions)" } };
        }
        return result;
      })
      .catch((e: any) => { console.warn("[updateJob] failed to save:", e?.message); return { error: e }; });
  };

  // FEATURE 3 — the owner's own Complete button (JobsPage.tsx) already
  // auto-schedules the next occurrence of a recurring job, but employees
  // completing jobs through the field portal is the more common path and had
  // no equivalent at all — a recurring job completed here would just never
  // get its next occurrence created. Mirrors JobsPage.tsx's approach (reset
  // status/hours/clock/checklist/logs, new id) using the same shared
  // computeNextRecurringDate so both paths can never compute different dates
  // for the same schedule.
  const createRecurringJob = (sourceJob: Job) => {
    if (!sourceJob.isRecurring) return;
    const nextDate = computeNextRecurringDate(sourceJob, sourceJob.scheduledDate);
    const nextJob: any = {
      // stripLegacyJobFields — sourceJob may still carry a poisoned
      // organizationId/org_id key from before that bug was reverted; a bare
      // spread would carry it into this brand-new row and fail the insert.
      ...stripLegacyJobFields(sourceJob), id: uid(), status: "scheduled", scheduledDate: nextDate,
      loggedHours: 0, clockInAt: null, arrivedAt: null, completedAt: null,
      checklist: (sourceJob.checklist || []).map((ck: any) => ({ ...ck, done: false })),
      preChecklist: (sourceJob.preChecklist || []).map((ck: any) => ({ ...ck, done: false })),
      duringChecklist: (sourceJob.duringChecklist || []).map((ck: any) => ({ ...ck, done: false })),
      postChecklist: (sourceJob.postChecklist || []).map((ck: any) => ({ ...ck, done: false })),
      commLog: [], photos: [], chemicalsUsed: [], paymentStatus: undefined, amountCollected: undefined,
    };
    setJobs((prev: any[]) => [...prev, nextJob]);
    (supabase as any).from("jobs").insert(nextJob)
      .then(async (r: any) => {
        if (r?.error) {
          // FIX 14 — completedAt is a newer, optional column (migration
          // 0015); if it isn't there yet, PostgREST rejects the whole insert
          // — including `crew` — so the recurring job never reached Supabase
          // and the employee (who reads jobs straight from Supabase) never
          // saw it at all. Retry without it so the job still lands.
          console.error("[Recurring] insert failed:", r.error.message, "— retrying with core columns");
          const { completedAt, ...coreJob } = nextJob;
          const retry = await (supabase as any).from("jobs").insert(coreJob);
          if (retry?.error) { console.error("[Recurring] core-column retry also failed:", retry.error.message); toast?.("Job completed, but couldn't auto-schedule the next occurrence — " + retry.error.message, "red"); }
          else toast?.("Next recurring job auto-scheduled for " + nextDate, "green");
        }
        else toast?.("Next recurring job auto-scheduled for " + nextDate, "green");
      })
      .catch((e: any) => { console.error("[Recurring] insert threw:", e?.message); toast?.("Job completed, but couldn't auto-schedule the next occurrence", "red"); });
  };

  // Tick every second when any job is clocked in so card timers update live
  const [, setCardTick] = useState(0);
  useEffect(() => {
    if (!activeClockJob) return;
    const t = setInterval(() => setCardTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, [activeClockJob?.id]);

  // Fetch drive time via the Distance Matrix REST endpoint directly — see
  // fetchDriveDistance's own comment (lib/utils.ts) for why not the JS
  // DistanceMatrixService class.
  const fetchDriveTime = (jobId: string, address: string) => {
    if (fetchedDriveIds.current.has(jobId)) return;
    fetchedDriveIds.current.add(jobId);
    const loc = userLocationRef.current;
    const distanceKey = (settings as any).googleGeocodingKey || settings.googleMapsKey;
    if (!loc || !distanceKey) return;
    fetchDriveDistance(`${loc.lat},${loc.lng}`, address, distanceKey)
      .then(({ durationText }) => { if (durationText) setDriveTimes(prev => ({ ...prev, [jobId]: durationText })); })
      .catch(() => { /* silently fail — this is a nice-to-have ETA, not critical */ });
  };

  // Route optimization for today's jobs — uses the Maps JS DirectionsService
  // (optimizeWaypoints) to reorder stops for the shortest total drive, then
  // hands that order off to a Google Maps URL for actual turn-by-turn nav.
  // Resolves an origin point for the route: fresh GPS fix first (don't rely on
  // the silent background fetch from mount, which may never have resolved if
  // permission was slow/denied), then the employee's saved Home Base address,
  // then — rather than dead-ending with nothing — the first stop itself, so
  // Route always produces a usable result instead of silently doing nothing.
  const resolveRouteOrigin = (): Promise<{ lat: number; lng: number } | string | null> => {
    return new Promise(resolve => {
      if (userLocationRef.current) { resolve(userLocationRef.current); return; }
      if (!navigator.geolocation) { resolve(homeBaseAddress || null); return; }
      const timer = setTimeout(() => resolve(homeBaseAddress || null), 6000);
      navigator.geolocation.getCurrentPosition(
        pos => { clearTimeout(timer); const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }; userLocationRef.current = loc; resolve(loc); },
        () => { clearTimeout(timer); resolve(homeBaseAddress || null); },
        { timeout: 5500 }
      );
    });
  };

  // Guaranteed fallback — needs no API key, no DirectionsService, nothing that
  // can fail or hang: it just opens Maps with every stop as a waypoint in
  // whatever order they're already in. This is what fires if the optimized
  // route can't be computed for any reason, so the button always does something.
  const openPlainMapsRoute = (stops: Job[], origin: { lat: number; lng: number } | string | null) => {
    const dest = encodeURIComponent(stops[stops.length - 1].address);
    const waypts = stops.slice(0, -1).map(j => encodeURIComponent(j.address)).join("|");
    const originParam = origin ? `&origin=${encodeURIComponent(typeof origin === "string" ? origin : `${origin.lat},${origin.lng}`)}` : "";
    window.open(`https://www.google.com/maps/dir/?api=1${originParam}&destination=${dest}${waypts ? "&waypoints=" + waypts : ""}&travelmode=driving`, "_blank");
  };

  const optimizeRoute = async () => {
    const stops = todayJobs.filter(j => j.status !== "completed" && j.address);
    if (stops.length === 0) { toast("No jobs left today to route", "yellow"); return; }
    setRouteLoading(true);
    const origin = await resolveRouteOrigin();
    const effectiveOrigin = origin || stops[0].address;
    const routeStops = origin ? stops : stops.slice(1);
    if (!origin) toast("Couldn't get your location — routing from the first job instead", "yellow");
    if (routeStops.length === 0) {
      // Single stop — no optimization needed, just go.
      setRouteLoading(false);
      openPlainMapsRoute(stops, origin);
      return;
    }
    if (!settings.googleMapsKey) {
      setRouteLoading(false);
      toast("No Google Maps key set — opening unoptimized route", "yellow");
      openPlainMapsRoute(routeStops, origin);
      return;
    }
    try {
      await withTimeout(loadMapsScript(settings.googleMapsKey), 8000, "Maps script load");
      const gm = (window as any).google?.maps;
      if (!gm?.DirectionsService) throw new Error("DirectionsService unavailable");
      const svc = new gm.DirectionsService();
      const destination = routeStops[routeStops.length - 1].address;
      const waypoints = routeStops.slice(0, -1).map(j => ({ location: j.address, stopover: true }));
      const result: any = await withTimeout(new Promise((resolve, reject) => {
        svc.route(
          { origin: effectiveOrigin, destination, waypoints, optimizeWaypoints: true, travelMode: gm.TravelMode.DRIVING },
          (res: any, status: string) => status === "OK" && res?.routes?.[0] ? resolve(res) : reject(new Error("DirectionsService status: " + status))
        );
      }), 10000, "Route calculation");
      setRouteLoading(false);
      const route = result.routes[0];
      const order: Job[] = (route.waypoint_order || []).map((idx: number) => routeStops[idx]).concat([routeStops[routeStops.length - 1]]);
      let totalSec = 0, totalMeters = 0;
      const etas: string[] = [];
      let cursor = Date.now();
      (route.legs || []).forEach((leg: any) => {
        totalSec += leg.duration?.value || 0;
        totalMeters += leg.distance?.value || 0;
        cursor += (leg.duration?.value || 0) * 1000;
        etas.push(new Date(cursor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
      });
      setRouteInfo({
        order,
        totalDuration: Math.round(totalSec / 60) + " min",
        totalDistance: (totalMeters / 1609.34).toFixed(1) + " mi",
        etas,
        origin: effectiveOrigin,
      });
    } catch (err: any) {
      // Optimization failed or hung — fall back to a plain, unoptimized Maps
      // link rather than leaving the employee with nothing. The button must
      // always produce a usable result.
      console.warn("Route optimization failed — opening unoptimized route instead:", err);
      setRouteLoading(false);
      toast("Couldn't optimize the route — opening it in Google Maps instead", "yellow");
      openPlainMapsRoute(routeStops, origin);
    }
  };

  // Recalculates drive time/distance/ETAs for a manually-reordered stop list —
  // fixed order this time (no optimizeWaypoints), since the whole point of a
  // manual reorder is to override the algorithm's choice.
  const recalcRouteForOrder = (newOrder: Job[]) => {
    if (!settings.googleMapsKey) return;
    const gm = (window as any).google?.maps;
    if (!gm?.DirectionsService) return;
    const svc = new gm.DirectionsService();
    const originStr = typeof routeInfo!.origin === "string" ? routeInfo!.origin : routeInfo!.origin;
    const destination = newOrder[newOrder.length - 1].address;
    const waypoints = newOrder.slice(0, -1).map(j => ({ location: j.address, stopover: true }));
    svc.route(
      { origin: originStr, destination, waypoints, optimizeWaypoints: false, travelMode: gm.TravelMode.DRIVING },
      (result: any, status: string) => {
        if (status !== "OK" || !result?.routes?.[0]) { toast("Couldn't recalculate route", "red"); return; }
        const route = result.routes[0];
        let totalSec = 0, totalMeters = 0;
        const etas: string[] = [];
        let cursor = Date.now();
        (route.legs || []).forEach((leg: any) => {
          totalSec += leg.duration?.value || 0;
          totalMeters += leg.distance?.value || 0;
          cursor += (leg.duration?.value || 0) * 1000;
          etas.push(new Date(cursor).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
        });
        setRouteInfo(prev => prev ? {
          ...prev,
          order: newOrder,
          totalDuration: Math.round(totalSec / 60) + " min",
          totalDistance: (totalMeters / 1609.34).toFixed(1) + " mi",
          etas,
        } : prev);
      }
    );
  };

  const moveStop = (index: number, dir: -1 | 1) => {
    if (!routeInfo) return;
    const next = [...routeInfo.order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setRouteInfo({ ...routeInfo, order: next }); // optimistic reorder, then refresh ETAs
    recalcRouteForOrder(next);
  };

  const dragStopIndexRef = useRef<number | null>(null);
  const onStopDragStart = (i: number) => { dragStopIndexRef.current = i; };
  const onStopDrop = (i: number) => {
    if (!routeInfo || dragStopIndexRef.current === null || dragStopIndexRef.current === i) return;
    const next = [...routeInfo.order];
    const [moved] = next.splice(dragStopIndexRef.current, 1);
    next.splice(i, 0, moved);
    dragStopIndexRef.current = null;
    setRouteInfo({ ...routeInfo, order: next });
    recalcRouteForOrder(next);
  };

  const openRouteInMaps = () => {
    if (!routeInfo) return;
    const dest = encodeURIComponent(routeInfo.order[routeInfo.order.length - 1].address);
    const waypts = routeInfo.order.slice(0, -1).map(j => encodeURIComponent(j.address)).join("|");
    const originStr = typeof routeInfo.origin === "string" ? routeInfo.origin : `${routeInfo.origin.lat},${routeInfo.origin.lng}`;
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${dest}${waypts ? "&waypoints=" + waypts : ""}&travelmode=driving`, "_blank");
  };

  // Get user location once, then fire drive-time lookups for upcoming jobs
  useEffect(() => {
    if (!settings.googleMapsKey) return;
    navigator.geolocation.getCurrentPosition(pos => {
      userLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      myJobs.filter(j => j.scheduledDate >= todayStr).forEach(j => fetchDriveTime(j.id, j.address));
    }, () => {});
  }, []); // run once on mount

  // Navigate back after job completion, show next-job notification
  // Rolls a completed job's score into the employee's overall rating (simple
  // running average, weighted 75/25 toward history so one bad day can't tank it
  // and one good day can't fully redeem a pattern of lateness).
  const recordJobRating = (job: Job) => {
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    const score = computeJobRatingScore(job);
    const prevScore = (myEmployee as any)?.ratingScore;
    const nextScore = typeof prevScore === "number" ? Math.round(prevScore * 0.75 + score * 0.25) : score;
    // BUG FIX (audit finding) — result was fully swallowed; a silent RLS
    // mismatch left this employee's rating never actually updating with
    // no signal anywhere. Background computation (no user-facing action),
    // so this logs rather than toasts.
    (supabase as any).from("employees").update({ ratingScore: nextScore }).eq("id", empId).select("id").then(
      (r: any) => {
        if (r?.error) console.warn("[Rating] update failed:", r.error.message);
        else if (!r?.data || r.data.length === 0) console.warn("[Rating] update matched 0 rows");
      },
      (e: any) => console.warn("[Rating] update threw:", e?.message)
    );
  };

  const handleJobComplete = () => {
    const nextJob = [...myJobs]
      .filter(j => j.id !== selectedJobId && j.scheduledDate >= todayStr && j.status !== "completed")
      .sort((a, b) => {
        const da = a.scheduledDate + (a.scheduledTime || "23:59");
        const db = b.scheduledDate + (b.scheduledTime || "23:59");
        return da.localeCompare(db);
      })[0] ?? null;
    setSelectedJobId(null);
    setTab("jobs");
    setNextJobEta(null);
    if (nextJob) {
      const nc = customers.find(c => c.id === nextJob.customerId);
      const name = nc ? `${nc.firstName} ${nc.lastName}` : "";
      setCompletionNotif({
        message: `Job complete! Next: ${name ? name + " · " : ""}${nextJob.address}`,
        nextJobId: nextJob.id,
      });
      checkNextJobEta(nextJob);
    } else {
      toast("✅ All done! No more jobs today.");
    }
  };

  // Estimates whether the employee will arrive late to the next job based on
  // live drive time from their current location, vs. that job's scheduled start.
  const checkNextJobEta = (nextJob: Job) => {
    const loc = userLocationRef.current;
    const distanceKey = (settings as any).googleGeocodingKey || settings.googleMapsKey;
    if (!loc || !distanceKey || !nextJob.scheduledTime) { setNextJobEta(null); return; }
    fetchDriveDistance(`${loc.lat},${loc.lng}`, nextJob.address, distanceKey).then(({ durationSeconds }) => {
      if (!durationSeconds) return;
      const arrival = new Date(Date.now() + durationSeconds * 1000);
      const scheduled = new Date(`${nextJob.scheduledDate}T${nextJob.scheduledTime}:00`);
      const lateMinutes = Math.round((arrival.getTime() - scheduled.getTime()) / 60000);
      setNextJobEta({
        jobId: nextJob.id,
        etaTime: arrival.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        lateMinutes,
      });
    }).catch(() => { /* silently fail — same as the other ETA lookups */ });
  };

  const messageNextJobCustomer = async (job: Job, lateMinutes: number) => {
    const cust = findCustomer(job.customerId);
    if (!cust?.phone && !cust?.email) { toast("No phone or email on file for this customer", "yellow"); return; }
    if (job.scheduledDate && job.scheduledDate !== localDateStr()) {
      const ok = window.confirm(`This job is scheduled for ${job.scheduledDate}, not today. Send the "on my way" message anyway?`);
      if (!ok) return;
    }
    const eta = nextJobEta?.etaTime || "shortly";
    const msg = lateMinutes > 0
      ? `Hi ${cust!.firstName}, running a few minutes behind — ETA ${eta}. Sorry for the delay!`
      : `Hi ${cust!.firstName}, on my way — ETA ${eta}. See you soon!`;
    if (settings?.twilioSid && cust!.phone) {
      try {
        await withTimeout(twilioSend(settings as any, cust!.phone, msg), 15000, "OTW SMS");
        toast("On the way message sent to " + cust!.firstName + " ✓", "green");
        logOutboundSmsToInbox({ contactName: `${cust!.firstName} ${cust!.lastName}`, contactPhone: cust!.phone, customerId: cust!.id, body: msg }).catch(() => {});
      }
      catch (e: any) { console.error("[OTW] — error:", e?.message); toast(e?.message || "Failed to send OTW text", "red"); }
    } else if (cust!.email) {
      try {
        const html = emailShell(settings, "On My Way", `<p>${msg}</p>`);
        await withTimeout(sendOwnerGmailOnly(settings as any, cust!.email, "Your technician is on the way", html), 15000, "OTW email");
        toast("On the way message sent to " + cust!.firstName + " ✓", "green");
      } catch (e: any) { console.error("[OTW] — error:", e?.message); toast(e?.message || "Failed to send OTW email", "red"); }
    } else if (cust!.phone) {
      // No Twilio and no email on file — open the tech's own SMS app prefilled.
      window.location.href = "sms:" + cust!.phone.replace(/\D/g, "") + "?body=" + encodeURIComponent(msg);
      toast("Opening your texts to notify " + cust!.firstName + " — add Twilio in Settings to send automatically", "yellow");
    }
  };

  // BUG FIX (user report) — "signing in and signing out... takes forever,
  // I have to keep pressing it... it should have a spinning animation."
  // doSignOut itself already had a timeout — what it never had was any
  // visible loading state, so nothing stopped a second/third tap while the
  // first was still in flight, and there was no feedback that anything was
  // happening at all.
  const [signingOut, setSigningOut] = useState(false);
  const doSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    // scope: "local" — sign out only this device. The default ("global")
    // revokes the refresh token everywhere, which would also sign this
    // employee out of any other device/browser they're logged into.
    // BUG FIX — "pressing sign out did not let me when it was in the
    // middle of trying to share my location, which just kept spinning."
    // supabase.auth.signOut() had no timeout — if it hung (this codebase
    // has documented real cases of Supabase auth calls hanging under some
    // network conditions), the button just spun forever with no way out.
    // Local sign-out (clearing the session client-side) can always
    // succeed regardless of the network call, so force it through either
    // way after a bounded wait rather than leaving the employee stuck.
    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 6000, "Sign out");
    } catch (e: any) {
      console.warn("[SignOut] server call timed out/failed — signing out locally anyway:", e?.message);
    } finally {
      await clearLocalAuthSession();
      setEmpSession(null);
      window.location.hash = "/portal";
      setSigningOut(false);
    }
  };

  const doRetryLink = async () => {
    if (!empSession) return;
    setRetrying(true);
    const email = empSession.user.email || "";
    const userId = empSession.user.id;
    try {
      // Try by user_id first, then email
      let found: any = null;
      const { data: byId } = await (supabase as any)
        .from("employees").select("*").eq("user_id", userId).maybeSingle();
      if (byId) { found = byId; }
      else {
        const { data: byEmail } = await (supabase as any)
          .from("employees").select("*").ilike("email", email).maybeSingle();
        if (byEmail) {
          found = byEmail;
          // Link user_id for next time. BUG FIX (audit finding) — no
          // result check meant a silent RLS-mismatch failure here still
          // let this session work for the current page load (found is
          // still set below), but left the DB unlinked — so the very next
          // real login (a fresh session) would fail to find this employee
          // by user_id again and need ANOTHER manual "Retry Link" tap,
          // with no indication why the fix wasn't actually sticking.
          const linkResult = await (supabase as any).from("employees").update({ user_id: userId }).eq("id", byEmail.id).select("id");
          if (linkResult?.error) { console.warn("[EmployeeLink] retry-link failed:", linkResult.error.message); toast("Linked for this session, but couldn't save permanently — " + linkResult.error.message, "red"); }
          else if (!linkResult?.data || linkResult.data.length === 0) { console.warn("[EmployeeLink] retry-link matched 0 rows"); toast("Linked for this session, but the server rejected saving it — try again later", "red"); }
        }
      }
      if (found) setLocalEmployee(normalizeEmp(found));
      else toast("No employee record found for " + email + ". Ask your manager to add your email.");
    } catch (e) {
      console.error("doRetryLink error:", e);
    }
    setRetrying(false);
  };

  const doForgotPassword = async () => {
    if (!loginEmail.trim()) { setLoginError("Enter your email first"); return; }
    try {
      // resetPasswordForEmail resolves with {error} rather than throwing on
      // failure — a bare try/catch alone would show "sent ✓" even when it
      // failed (rate limit, malformed email, etc).
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
        redirectTo: `${window.location.origin}${window.location.pathname}#/reset-password`,
      });
      if (error) { console.error("[Forgot Password/employee] — error:", error.message); setLoginError("Could not send reset email — " + error.message); return; }
      setForgotSent(true);
    } catch (e: any) { setLoginError("Could not send reset email — " + (e?.message || "try again")); }
  };

  // Create or update a Google Calendar event on the EMPLOYEE'S OWN calendar
  // using their own stored OAuth token, after they accept a job (creates) or
  // complete one (updates the existing event so it reflects the outcome, or
  // creates one if none exists yet). Silently no-ops if they haven't
  // connected Google, their token has expired, or auto-sync is off.
  const syncingJobIdsRef = useRef<Set<string>>(new Set());
  const syncJobToCalendar = async (job: Job | undefined, opts: { completed?: boolean; silent?: boolean } = {}) => {
    if (!job || !job.scheduledDate || !empSession?.user?.id) return;
    // Auto-sync defaults to on (matches the prior always-sync behavior) but the
    // employee can turn it off in the Google tab — when off, they add jobs to
    // their calendar manually via the per-job "Add to Google Calendar" button.
    if (!autoSyncCalendar) return;
    // BUG FIX — "make sure it doesn't accidentally create duplicates."
    // Real risk once the backfill pass (below) exists alongside the
    // reactive triggers (accepting a job request, completing a job): two
    // calls for the SAME job can overlap — e.g. the hourly backfill is
    // mid-flight for a job right as the employee accepts a request for
    // that same job. Both would read "no event yet" before either write
    // lands and both create one, leaving a duplicate. One in-flight guard
    // per job id, regardless of which trigger fired, closes that race.
    if (syncingJobIdsRef.current.has(job.id)) return;
    syncingJobIdsRef.current.add(job.id);
    const empToken = await getValidEmpGoogleToken(empSession.user.id, settings?.googleBackendUrl);
    if (!empToken) { syncingJobIdsRef.current.delete(job.id); return; }
    try {
      const timeStr = job.scheduledTime || "09:00";
      const startDt = new Date(`${job.scheduledDate}T${timeStr}:00`);
      const endDt = new Date(startDt.getTime() + (Number(job.duration) || 2) * 3600000);
      const cust = customers.find(c => c.id === job.customerId);
      const custName = cust ? `${cust.firstName} ${cust.lastName}` : "Customer";
      // BUG FIX — "when it adds Google jobs to calendars, it should include
      // a clickable link and URL to view the job in the employee portal, as
      // well as the client name and other details." This description was
      // just a bare comma-joined checklist item list — no link, no client
      // name/phone, nothing to actually act on from the calendar entry.
      // Same buildJobCalendarDescription the owner's own sync already uses
      // (AlfredPage.tsx/JobsPage.tsx), pointed at THIS employee's portal
      // deep link instead of the owner's Jobs page.
      const portalLink = `${window.location.origin}${window.location.pathname}#/portal?job=${encodeURIComponent(job.id)}`;
      const description = buildJobCalendarDescription(job, cust, portalLink, "View job in Crew Portal");
      const title = `${opts.completed ? "✓ " : ""}CRM Starter Job: ${custName}${opts.completed ? " (Completed)" : ""}`;
      // BUG FIX — this read/wrote job.googleEventId, the OWNER's OWN
      // calendar-event tracking field (see JobsPage.tsx/AlfredPage.tsx's
      // owner sync). An employee syncing to THEIR OWN calendar would
      // overwrite that field with the employee's event id, corrupting the
      // owner's own calendar link — and if the owner had already synced
      // first, this code would wrongly treat the OWNER's event id as "I
      // (the employee) already have an event," skip creating one, and never
      // sync at all. crewGoogleEventIds (jsonb, keyed by employee id — same
      // column the server-side employeeCalendarSync.ts already uses when
      // the OWNER assigns crew) is the correct, employee-specific tracker.
      const myEventId = (job as any).crewGoogleEventIds?.[myEmployee.id];
      if (myEventId) {
        await updateGCalEvent(empToken!.token, myEventId, { title, location: job.address, description });
        if (!opts.silent) toast("📅 Google Calendar event updated");
      } else {
        const evId = await createGCalEvent(empToken!.token, {
          title, start: startDt.toISOString(), end: endDt.toISOString(), location: job.address, description,
        });
        const nextMap = { ...((job as any).crewGoogleEventIds || {}), [myEmployee.id]: evId };
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, crewGoogleEventIds: nextMap } as any : j));
        // AUDIT FIX — this write was completely unchecked (no error, no
        // 0-row check, no retry). If it silently failed (RLS 0-row, network
        // blip), the next 3s cross-device poll overwrites this tab's local
        // state with the still-empty crewGoogleEventIds from the server,
        // and the hourly backfill pass then calls createGCalEvent AGAIN for
        // the same job — recreating the exact duplicate-calendar-event bug
        // the per-employee JSONB tracking field exists to prevent, just on
        // a later pass instead of a concurrent one.
        (supabase as any).from("jobs").update({ crewGoogleEventIds: nextMap }).eq("id", job.id).select("id").then(
          (r: any) => { if (!Array.isArray(r?.data) || r.data.length === 0) console.warn("[CalendarSync] crewGoogleEventIds save matched 0 rows for job", job.id, "— may create a duplicate event on the next backfill"); },
          (e: any) => console.warn("[CalendarSync] crewGoogleEventIds save failed:", e?.message)
        );
        if (!opts.silent) toast("📅 Added to your Google Calendar");
      }
    } catch (e) {
      console.warn("Employee calendar sync failed:", e);
    } finally {
      syncingJobIdsRef.current.delete(job.id);
    }
  };
  const syncAcceptedJobToCalendar = (job: Job | undefined) => syncJobToCalendar(job);

  // BUG FIX — "it never auto-added the job offer created for me onto my
  // calendar... I'm talking about past jobs too, not just the new ones."
  // syncJobToCalendar only ever ran reactively (accepting a job REQUEST, or
  // completing a job) — a job the owner assigned directly (not via the
  // request/accept flow) never triggered any client-side sync at all, and
  // there was no catch-up pass for jobs assigned before this ever worked.
  // Same pattern as the 24h reminder effect above: runs once on load and
  // hourly while the portal stays open, and syncs every one of my upcoming
  // (not completed/cancelled) jobs that doesn't already have a synced event
  // for me — naturally a no-op after the first pass since a synced job
  // gets a crewGoogleEventIds entry and won't match again.
  useEffect(() => {
    if (!myEmployee || !autoSyncCalendar || !empSession?.user?.id) return;
    const backfill = async () => {
      const empToken = await getValidEmpGoogleToken(empSession.user.id, settings?.googleBackendUrl);
      if (!empToken) return;
      for (const j of myJobs) {
        if (!j.scheduledDate || j.status === "completed" || j.status === "cancelled") continue;
        if ((j as any).crewGoogleEventIds?.[myEmployee.id]) continue;
        await syncJobToCalendar(j, { silent: true });
      }
    };
    backfill();
    const h = setInterval(backfill, 60 * 60 * 1000);
    return () => clearInterval(h);
  }, [myEmployee?.id, autoSyncCalendar, myJobs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAcceptRequest = async () => {
    if (!requestData || !myEmployee || respondingToRequest) return;
    setRespondingToRequest(true);
    try {
      // BUG FIX (audit finding) — no .select("id")/empty-result check meant
      // an RLS-scoped 0-row silent failure here left job_requests.status
      // stuck on "pending" forever with no error surfaced — the employee
      // saw "Job accepted!" (below) regardless.
      const statusResult = await withTimeout<any>(
        (supabase as any).from("job_requests").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", requestId).select("id"),
        15000, "Accept request"
      );
      if (statusResult?.error) console.warn("[CrewFlow] job_requests status update failed:", statusResult.error.message);
      else if (!statusResult?.data || statusResult.data.length === 0) console.warn("[CrewFlow] job_requests status update matched 0 rows");
      if (requestData.job_id) {
        const empId = myEmployee.id;
        const empUserId = (myEmployee as any).user_id;
        const targetJob = jobs.find(j => j.id === requestData.job_id);
        const currentCrew = targetJob?.crew || [];
        if (!crewIncludesEmployee(currentCrew, empId, empUserId)) {
          const newCrew = [...currentCrew, empId];
          // crewAssignedAt must be set here too, same as the owner's direct-assign
          // path (toggleCrew in JobDetailModal) — without it, this employee never
          // gets a "New Assignment" banner on their Today tab for a job they just
          // accepted, even though they're genuinely on the crew.
          const newCrewAssignedAt = { ...(targetJob?.crewAssignedAt || {}), [empId]: Date.now() };
          // Optimistic local update
          setJobs(prev => prev.map(j => j.id === requestData.job_id ? { ...j, crew: newCrew, crewAssignedAt: newCrewAssignedAt } : j));
          // Save MUST be awaited before refetching — otherwise the refetch below can
          // land before this write commits and overwrite the optimistic crew with the
          // still-empty array from Supabase, which is exactly why accepted jobs were
          // vanishing again right after acceptance.
          const saveResult = await withTimeout<any>(
            (supabase as any).from("jobs").update({ crew: newCrew, crewAssignedAt: newCrewAssignedAt }).eq("id", requestData.job_id).select("id"),
            15000, "Accept request — crew save"
          );
          if (saveResult?.error) {
            toast("Accepted, but couldn't add you to the job's crew — " + saveResult.error.message, "red");
          } else if (!saveResult?.data || saveResult.data.length === 0) {
            toast("Accepted, but the server rejected adding you to the job's crew", "red");
          } else {
            // reconcileCrewAfterAssign — this write was based on this
            // portal's own possibly-stale local copy of the job's crew. If
            // the owner directly assigned someone else to this same job (or
            // another employee accepted a different pending request for it)
            // moments ago and this browser hasn't polled since, the write
            // above would silently overwrite that addition instead of
            // adding alongside it.
            reconcileCrewAfterAssign(requestData.job_id, newCrew, newCrewAssignedAt, p =>
              (supabase as any).from("jobs").update(p).eq("id", requestData.job_id)
            ).catch(() => {});
          }
        }
        // Confirm against Supabase immediately rather than waiting up to 10s for the
        // next poll — the optimistic setJobs above already updated myJobs for instant
        // UI feedback; this just reconciles with the server-confirmed state right away.
        refetchJobsRef.current().catch(() => {});
        syncAcceptedJobToCalendar(jobs.find(j => j.id === requestData.job_id));
      }
      setRequestDone("accepted");
      toast("Job accepted! You're on the crew. ✓");
    } catch (e: any) {
      console.error("[CrewFlow] accept request failed:", e?.message || e);
      toast("Error accepting request — " + (e?.message || "check connection"), "red");
    } finally {
      setRespondingToRequest(false);
    }
  };

  const handleDenyRequest = async () => {
    if (respondingToRequest) return;
    setRespondingToRequest(true);
    try {
      const result = await withTimeout<any>(
        (supabase as any).from("job_requests").update({ status: "denied", denial_reason: denyReason.trim(), responded_at: new Date().toISOString() }).eq("id", requestId).select("id"),
        15000, "Decline request"
      );
      if (result?.error) throw new Error(result.error.message);
      if (!result?.data || result.data.length === 0) throw new Error("the server rejected the change");
      setRequestDone("denied");
      toast("Request declined.");
    } catch (e: any) {
      console.error("[CrewFlow] deny request failed:", e?.message || e);
      toast("Error declining request — " + (e?.message || "check connection"), "red");
    } finally {
      setRespondingToRequest(false);
    }
  };

  const [homeBaseAddress, setHomeBaseAddressState] = useState("");
  const [, setGoogleHydrateTick] = useState(0);
  // FIX 10 (mobile round 6) — tracks whether the last actual refresh
  // attempt (a real POST with a real refresh_token) failed, so the
  // "reconnect" banner reflects a genuine failure instead of just "no
  // refresh_token on file yet".
  const [empGoogleRefreshFailed, setEmpGoogleRefreshFailed] = useState(false);
  // AUDIT — refreshEmpGoogleToken tags a failure as configMissing when the
  // Cloudflare Pages Function reports GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET
  // aren't set. That's a permanent server-side gap no amount of employee
  // "Reconnect" clicking can fix, but the banner below used to show the same
  // generic "token expired, reconnect" message either way — tracked
  // separately so the employee (and whoever they forward the screenshot to)
  // knows to escalate instead of retrying forever.
  const [empGoogleConfigMissing, setEmpGoogleConfigMissing] = useState(false);
  // FEATURE — "should show the actual status if connected," not just "a
  // token is cached and its self-reported expiry hasn't passed yet." Mirrors
  // GoogleWorkspacePage.tsx's existing owner-side live check (a real
  // round-trip to Google's tokeninfo endpoint) — the owner side already had
  // this; the employee side only ever trusted the cache. null = not checked
  // yet / checking, true = verified live just now, false = verified dead.
  const [empGoogleVerified, setEmpGoogleVerified] = useState<boolean | null>(null);
  useEffect(() => {
    if (tab !== "google" || !empSession?.user?.id) return;
    const uid = empSession.user.id;
    let cancelled = false;
    (async () => {
      const existing = getEmpGoogleToken(uid);
      if (!existing?.token) { if (!cancelled) setEmpGoogleVerified(null); return; }
      setEmpGoogleVerified(null); // "verifying…"
      try {
        let result = await withTimeout(verifyGoogleTokenLive(existing.token), 8000, "GoogleVerify");
        if (!result.valid && existing.refreshToken) {
          const refreshed = await withTimeout(refreshEmpGoogleToken(settings?.googleBackendUrl, existing.refreshToken), 10000, "GoogleRefresh");
          if (refreshed?.token) {
            saveEmpGoogleToken(uid, { ...existing, token: refreshed.token, expiresAt: refreshed.expiresAt });
            result = await withTimeout(verifyGoogleTokenLive(refreshed.token), 8000, "GoogleVerify");
          }
        }
        if (cancelled) return;
        setEmpGoogleVerified(result.valid);
        if (!result.valid) setEmpGoogleRefreshFailed(true);
      } catch (e: any) {
        if (cancelled) return;
        console.warn("[GoogleToken] employee verification chain failed or timed out:", e?.message);
        setEmpGoogleVerified(false);
        setEmpGoogleRefreshFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, empSession?.user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showCanceledJobs, setShowCanceledJobs] = useState(false);
  const [jobsStatusFilter, setJobsStatusFilter] = useState<"all" | "scheduled" | "today" | "completed">("all");
  const [jobsSearchText, setJobsSearchText] = useState("");
  const [pastCollapsed, setPastCollapsedState] = useState(() => {
    try { const v = localStorage.getItem("crm.portal.pastCollapsed"); return v === null ? true : v === "1"; } catch { return true; }
  });
  const setPastCollapsed = (v: boolean | ((p: boolean) => boolean)) => setPastCollapsedState(prev => {
    const next = typeof v === "function" ? v(prev) : v;
    try { localStorage.setItem("crm.portal.pastCollapsed", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });
  const [upcomingCollapsed, setUpcomingCollapsedState] = useState(() => {
    try { return localStorage.getItem("crm.portal.upcomingCollapsed") === "1"; } catch { return false; }
  });
  const setUpcomingCollapsed = (v: boolean | ((p: boolean) => boolean)) => setUpcomingCollapsedState(prev => {
    const next = typeof v === "function" ? v(prev) : v;
    try { localStorage.setItem("crm.portal.upcomingCollapsed", next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  });
  const homeBaseLastEditRef = useRef(0);
  const saveHomeBaseAddress = async (addr: string) => {
    homeBaseLastEditRef.current = Date.now();
    setHomeBaseAddressState(addr);
    // Supabase is the source of truth for cross-device sync — write there
    // first and check the result explicitly (Supabase resolves with {error}
    // rather than throwing on failure, so a bare try/catch alone would miss
    // a real failure). localStorage is only updated AFTER a confirmed
    // success, purely as an instant-load cache for this device.
    const empId = (myEmployee as any)?.id;
    if (!empId) return;
    try {
      // BUG FIX — "you never told me whether the home base field saves —
      // previously it would not save." This never checked for a 0-row
      // response, only `error` — PostgREST returns SUCCESS with an empty
      // result when an owner_id-scoped RLS write matches zero rows (see
      // docs/ARCHITECTURE.md), which read as "saved" here even when nothing was
      // actually written. .select("id") makes that 0-row case visible.
      const result = await (supabase as any).from("employees").update({ homeBaseAddress: addr }).eq("id", empId).select("id");
      if (result?.error) { toast("Failed to save home base — " + result.error.message, "red"); return; }
      if (!Array.isArray(result?.data) || result.data.length === 0) { toast("Home base didn't save — the server didn't confirm the change", "red"); return; }
    } catch (e: any) {
      toast("Failed to save home base — " + (e?.message || "try again"), "red");
      return;
    }
    try {
      const uid = empSession?.user?.id;
      if (uid) localStorage.setItem("crm.homeBase." + uid, addr);
    } catch { /* ignore */ }
  };

  // Load home base from localStorage immediately on mount (instant, no Supabase
  // round-trip needed) so it survives a refresh even before myEmployee resolves.
  useEffect(() => {
    const uid = empSession?.user?.id;
    if (!uid) return;
    try {
      const cached = localStorage.getItem("crm.homeBase." + uid);
      if (cached) setHomeBaseAddressState(cached);
    } catch { /* ignore */ }
  }, [empSession?.user?.id]);

  // BUG FIX — "I checked the auto-sync box and it didn't stay/persist/save."
  // This wrote to Supabase but never checked the result and swallowed any
  // error completely (`catch { /* ignore */ }`) — the exact silent-fail
  // pattern docs/ARCHITECTURE.md flags as a repeated regression. Local state flipped
  // immediately regardless of whether the write actually succeeded, so a
  // failed save looked identical to a working one until the next reload
  // quietly reverted it with zero explanation. Now checks the real response,
  // reverts the toggle and tells the owner exactly why on failure, confirms
  // on success — same toast-on-every-action rule as every other button here.
  const toggleAutoSyncCalendar = async () => {
    const next = !autoSyncCalendar;
    setAutoSyncCalendar(next);
    const empId = (myEmployee as any)?.id;
    if (!empId) { toast?.("Couldn't save — no employee record found.", "red"); setAutoSyncCalendar(!next); return; }
    try {
      const { error, data } = await (supabase as any).from("employees").update({ autoSyncCalendar: next }).eq("id", empId).select("id");
      if (error) throw error;
      // AUDIT FIX — added the documented .select("id") 0-row check
      // (docs/ARCHITECTURE.md) — an RLS-filtered 0-row update reports no error at all.
      if (!Array.isArray(data) || data.length === 0) throw new Error("the server didn't confirm the change");
      toast?.(next ? "Jobs will now auto-add to your Google Calendar ✓" : "Auto-sync to Google Calendar turned off ✓", "green");
    } catch (e: any) {
      setAutoSyncCalendar(!next);
      toast?.("Couldn't save that setting — " + (e?.message || "unknown error"), "red");
    }
  };

  const toggleAvailability = async (dateStr: string) => {
    const next = availability.includes(dateStr)
      ? availability.filter(d => d !== dateStr)
      : [...availability, dateStr];
    setAvailability(next);
    try {
      const empId = (myEmployee as any)?.id || (myEmployee as any)?.user_id;
      if (empId) {
        const result = await (supabase as any).from("employees").update({ availability: next }).eq("id", empId).select("id");
        if (result?.error) { console.warn("[Availability] save failed:", result.error.message); toast?.("Failed to save availability — " + result.error.message, "red"); }
        else if (!result?.data || result.data.length === 0) { console.warn("[Availability] save matched 0 rows"); toast?.("Couldn't save availability — the server rejected the change", "red"); }
      }
    } catch (e: any) { console.warn("[Availability] save threw:", e?.message); toast?.("Failed to save availability", "red"); }
  };

  // FEATURE 5 — recurring weekday off (0=Sun..6=Sat), same persistence
  // pattern as toggleAvailability above.
  const toggleRecurringDayOff = async (day: number) => {
    const next = recurringDaysOff.includes(day)
      ? recurringDaysOff.filter(d => d !== day)
      : [...recurringDaysOff, day].sort();
    setRecurringDaysOff(next);
    try {
      const empId = (myEmployee as any)?.id || (myEmployee as any)?.user_id;
      if (empId) {
        const result = await (supabase as any).from("employees").update({ recurringDaysOff: next }).eq("id", empId).select("id");
        if (result?.error) { console.warn("[Availability] recurring save failed:", result.error.message); toast?.("Failed to save recurring availability — " + result.error.message, "red"); }
        else if (!result?.data || result.data.length === 0) { console.warn("[Availability] recurring save matched 0 rows"); toast?.("Couldn't save recurring availability — the server rejected the change", "red"); }
      }
    } catch (e: any) { console.warn("[Availability] recurring save threw:", e?.message); toast?.("Failed to save recurring availability", "red"); }
  };

  // FEATURE — "employees should be able to mark it as paid, not mark it
  // unpaid... owner should be notified... owner can reverse it." Reverses
  // the "ISSUE 5 (round 11)" read-only-for-employees decision, but only in
  // the paid direction: this can only flip an unpaid period to paid, never
  // the reverse (the no-op guard below), and every write is logged with
  // markedBy: "employee" (see EmployeesPage.tsx's Payroll view, which reads
  // that field to show which paid marks were owner vs employee confirmed,
  // and still has full toggle control to reverse either kind).
  const markPeriodPaidByEmployee = async (period: { start: string; end: string; label: string; pay: number }) => {
    if (!myEmployee || markingPeriodPaid) return;
    const empId = (myEmployee as any).id;
    const currentPaidPeriods = (myEmployee as any).paidPeriods || {};
    if (currentPaidPeriods[period.start] === "paid") return; // already paid — never un-marks
    setMarkingPeriodPaid(period.start);
    const nextPaidPeriods = { ...currentPaidPeriods, [period.start]: "paid" };
    const currentLog = Array.isArray((myEmployee as any).paymentLog) ? (myEmployee as any).paymentLog : [];
    // BUG FIX — "Payroll crashed: Invalid time value." This entry used `at`
    // (an ISO string), but every other employee paymentLog entry (EmployeesPage.tsx's
    // togglePeriod/toggleDay) writes `paidAt` as a numeric Date.now() —
    // PayrollCalendar's `new Date(p.paidAt).toISOString()` got `undefined`
    // for every employee-confirmed entry and threw, crashing the whole
    // Payroll tab. Matches the existing convention now.
    const logEntry = { id: uid(), paidAt: Date.now(), type: "period", periodStart: period.start, periodEnd: period.end, amount: period.pay, markedBy: "employee" };
    const nextLog = [...currentLog, logEntry];
    try {
      const result = await (supabase as any).from("employees").update({ paidPeriods: nextPaidPeriods, paymentLog: nextLog }).eq("id", empId).select("id");
      if (result?.error) { toast("Couldn't confirm payment — " + result.error.message, "red"); return; }
      if (!result?.data || result.data.length === 0) { toast("Couldn't confirm payment — the server rejected the change", "red"); return; }
      toast(`Marked ${period.label} as paid ✓ — the owner has been notified`, "green");
      refetchEmployees?.();
      const ownerIdForPush = (myEmployee as any).owner_id;
      if (ownerIdForPush) {
        const empName = `${(myEmployee as any).firstName || ""} ${(myEmployee as any).lastName || ""}`.trim() || "An employee";
        sendPushNotification({
          ownerId: ownerIdForPush,
          title: "Employee marked pay received",
          body: `${empName} confirmed they were paid for ${period.label} (${fmt(period.pay)}) — tap to review.`,
          // BUG FIX (user report) — "click to view doesn't work." Plain
          // "/#/employees" only ever landed on the list — ?open=ID feeds
          // App.tsx's existing applyOpenParam/alfredHighlight mechanism
          // (same one email "View" links use), which EmployeesPage now
          // reads to actually open this employee's Payroll tab.
          url: "/#/employees?open=" + empId,
          tag: "employee-marked-paid-" + empId + "-" + period.start,
        });
      }
    } catch (e: any) {
      toast("Couldn't confirm payment — " + (e?.message || "check connection"), "red");
    } finally {
      setMarkingPeriodPaid(null);
    }
  };

  const handleInlineAccept = async (req: any) => {
    if (!myEmployee || respondingToInlineId) return;
    setRespondingToInlineId(req.id);
    try {
      const inlineStatusResult = await withTimeout<any>(
        (supabase as any).from("job_requests").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", req.id).select("id"),
        15000, "Inline accept request"
      );
      if (inlineStatusResult?.error) console.warn("[CrewFlow] inline job_requests status update failed:", inlineStatusResult.error.message);
      else if (!inlineStatusResult?.data || inlineStatusResult.data.length === 0) console.warn("[CrewFlow] inline job_requests status update matched 0 rows");
      if (req.job_id) {
        const empId = myEmployee.id;
        const empUserId = (myEmployee as any).user_id;
        const targetJob = jobs.find(j => j.id === req.job_id);
        const currentCrew = targetJob?.crew || [];
        let crewSaveError: string | null = null;
        if (!crewIncludesEmployee(currentCrew, empId, empUserId)) {
          const newCrew = [...currentCrew, empId];
          // Same as handleAcceptRequest — set crewAssignedAt so the Today tab's
          // "New Assignment" banner still shows for a job accepted via a request,
          // not just via the owner's direct-assign toggle.
          const newCrewAssignedAt = { ...(targetJob?.crewAssignedAt || {}), [empId]: Date.now() };
          // Optimistic local update
          setJobs(prev => prev.map(j => j.id === req.job_id ? { ...j, crew: newCrew, crewAssignedAt: newCrewAssignedAt } : j));
          // Must await the save before refetching — see handleAcceptRequest for why
          // an un-awaited fire-and-forget write here let the refetch race ahead and
          // clobber the optimistic crew with Supabase's still-stale (empty) row.
          const saveResult = await withTimeout<any>(
            (supabase as any).from("jobs").update({ crew: newCrew, crewAssignedAt: newCrewAssignedAt }).eq("id", req.job_id).select("id"),
            15000, "Inline accept — crew save"
          );
          // BUG FIX — this result used to be captured and never checked, so a
          // failed crew write (RLS, bad column, network) still showed the green
          // "you're on the crew" toast below even though the employee was never
          // actually added — exactly the "accept works but doesn't work" report.
          // Extended (audit finding) to also catch the RLS 0-row silent
          // success case, not just a real `.error`.
          if (saveResult?.error) crewSaveError = saveResult.error.message;
          else if (!saveResult?.data || saveResult.data.length === 0) crewSaveError = "the server rejected the change";
          else {
            // reconcileCrewAfterAssign — same cross-actor race as
            // handleAcceptRequest above (this is the inline-card accept path).
            reconcileCrewAfterAssign(req.job_id, newCrew, newCrewAssignedAt, p =>
              (supabase as any).from("jobs").update(p).eq("id", req.job_id)
            ).catch(() => {});
          }
        }
        // Confirm against Supabase immediately rather than waiting up to 10s for the
        // next poll — the optimistic setJobs above already updated myJobs for instant
        // UI feedback; this just reconciles with the server-confirmed state right away.
        refetchJobsRef.current().catch(() => {});
        syncAcceptedJobToCalendar(jobs.find(j => j.id === req.job_id));
        if (crewSaveError) {
          setIncomingRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "accepted" } : r));
          toast("Accepted, but couldn't add you to the job's crew — " + crewSaveError, "red");
          return;
        }
      }
      setIncomingRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "accepted" } : r));
      toast("Job accepted! You're on the crew. ✓");
    } catch (e: any) { console.error("[CrewFlow] inline accept failed:", e?.message || e); toast("Error accepting request — " + (e?.message || "check connection"), "red"); }
    finally { setRespondingToInlineId(null); }
  };

  const handleInlineDeny = async (req: any) => {
    if (respondingToInlineId) return;
    setRespondingToInlineId(req.id);
    try {
      const inlineDenyResult = await withTimeout<any>(
        (supabase as any).from("job_requests").update({ status: "denied", denial_reason: inlineDenyReason.trim(), responded_at: new Date().toISOString() }).eq("id", req.id).select("id"),
        15000, "Inline decline request"
      );
      if (inlineDenyResult?.error) throw new Error(inlineDenyResult.error.message);
      if (!inlineDenyResult?.data || inlineDenyResult.data.length === 0) throw new Error("the server rejected the change");
      setIncomingRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: "denied" } : r));
      setInlineDenyId(null);
      setInlineDenyReason("");
      toast("Request declined.");
    } catch (e: any) { toast("Error declining request — " + (e?.message || "check connection"), "red"); }
    finally { setRespondingToInlineId(null); }
  };

  // Requests the same Calendar + Gmail scopes the owner's Google connect
  // uses, so the provider_token this comes back with already has the
  // permissions needed to auto-connect Calendar/Gmail — App.tsx's
  // persistEmployeeGoogleToken (already wired for employee sessions) picks
  // up that token from the auth callback with no further action needed here.
  const handleEmployeeGoogleLogin = () => {
    setOAuthIntent("employee");
    // ISSUE 13 (round 2) — this was the one Google sign-in call site in the
    // whole app missing access_type:"offline"+prompt:"consent" (every other
    // one — App.tsx, the other employee-side connect flow further down this
    // file, SettingsModal.tsx, GoogleWorkspacePage.tsx — already has it).
    // Without it Google never returns a refresh_token, so the provider_token
    // this flow hands to App.tsx's persistEmployeeGoogleToken silently
    // expires after ~1hr with nothing able to refresh it — exactly "keeps
    // disconnecting."
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        scopes: "email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
  };

  const doLogin = async () => {
    // BUG FIX (user report) — "signing in and signing out... takes
    // forever... sometimes doesn't even work." No timeout and no
    // try/catch here — a dropped connection made signInWithPassword throw
    // instead of resolving with a normal {error}, skipping
    // setLoginLoading(false) entirely and leaving the button stuck on
    // "Please wait…" forever with no way out but reloading.
    setLoginLoading(true); setLoginError("");
    let data: any, error: any;
    try {
      const res = await withTimeout<any>(supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd }), 20000, "Sign in");
      data = res.data; error = res.error;
    } catch (e: any) {
      setLoginLoading(false);
      setLoginError(/timed out/i.test(e?.message || "") ? "That's taking too long — check your connection and try again." : (e?.message || "Sign-in failed — check your connection and try again."));
      return;
    }
    setLoginLoading(false);
    if (error) { setLoginError(error.message); return; }

    const session = data.session!;
    const metaRole = session.user.user_metadata?.role;
    const email = session.user.email || "";


    // Anyone who successfully completes signInWithPassword is an email/password user — treat as employee.
    // Google OAuth users cannot reach this path. Never sign them out here.
    const matchedEmployee = employees.find(e => e.email?.toLowerCase() === email.toLowerCase());

    // Cache the employee role now — but only once we actually know this account is an
    // employee (matched an existing record, or about to create one from an invite).
    // Caching unconditionally on any successful sign-in would also tag a non-employee
    // account (e.g. an owner who mistakenly signs into the portal form) as a permanent
    // employee, which is exactly the kind of misclassification that breaks the portal.
    if (matchedEmployee || inviteRecord) {
      try { localStorage.setItem("crew_role_" + session.user.id, "employee"); } catch { /* ignore */ }
    }

    // Repair missing role metadata so App.tsx auth-state-change recognises them on reload
    if (!metaRole) {
      const fixedRole = matchedEmployee
        ? ((matchedEmployee as any).role?.toLowerCase().includes("manager") ? "manager" : "technician")
        : "technician";
      supabase.auth.updateUser({ data: { role: fixedRole } }).catch(() => {});
    }

    // Link the employee record to this Supabase user ID so lookups by user_id work
    if (matchedEmployee && !(matchedEmployee as any).user_id) {
      (supabase as any).from("employees")
        .update({ user_id: session.user.id })
        .eq("id", matchedEmployee.id)
        .then(() => {}).catch(() => {});
    }

    // If they arrived via invite and have no employee record yet, create one now
    let isManager = (matchedEmployee as any)?.role?.toLowerCase?.().includes("manager") || false;
    if (!matchedEmployee && inviteRecord) {
      const authRole = inviteRecord.role?.toLowerCase().includes("manager") ? "manager" : "technician";
      isManager = authRole === "manager";
      const newEmp = {
        firstName: inviteRecord.firstName || "",
        lastName: inviteRecord.lastName || "",
        email: inviteRecord.email || email,
        role: authRole === "manager" ? "Manager" : "Technician",
        hourlyRate: inviteRecord.hourlyRate ?? 0,
        user_id: session.user.id,
        status: "active",
        // Inherit the owner_id the invite itself was created under (see
        // EmployeesPage.tsx generateInvite) — this employee has no session
        // of their own yet to derive it from. See the invite-lookup TODO
        // above: this whole path is blocked pre-session under owner-scoped
        // invites RLS anyway until that follow-up lands.
        owner_id: inviteRecord.owner_id,
      };
      // AUDIT 9 — this insert used to be fire-and-forget with no error
      // handling at all. If it failed (RLS, a duplicate email constraint,
      // etc.) the new manager/employee looked signed-in in THIS browser via
      // setLocalEmployee below, but no real employees row ever existed —
      // meaning any other device, or this one after a cache clear, could
      // never resolve their role again, with nothing telling anyone it
      // failed. Await it and surface a real error instead of silently
      // continuing as if it worked.
      const insertResult = await (supabase as any).from("employees").insert(newEmp);
      if (insertResult?.error) {
        console.error("[ManagerInvite] failed to create employee record:", insertResult.error.message);
        toast("Signed in, but couldn't create your team record — " + insertResult.error.message + ". Contact your owner.", "red");
      } else {
      }
      // Set locally so myEmployee resolves immediately without waiting for parent re-fetch
      setLocalEmployee(normalizeEmp(newEmp));
    }

    refetchEmployees?.();

    // Managers get the CRM, not the portal — once their role is established, send
    // them to the dashboard. A full reload re-runs App.tsx's session resolution
    // cleanly via resolveUserRole, rather than juggling empSession/hasCrmSession
    // across two components mid-flight.
    if (isManager) {
      try { localStorage.setItem("crew_role_" + session.user.id, "manager"); } catch { /* ignore */ }
      toast("Welcome back! Redirecting to your dashboard…");
      window.location.hash = "/dashboard";
      window.location.reload();
      return;
    }

    setEmpSession(session);
    toast("Welcome back!");
  };

  const doRegister = async () => {
    if (!loginFirst.trim() || !loginLast.trim()) { setLoginError("Enter your full name"); return; }
    if (loginPwd.length < 6) { setLoginError("Password must be at least 6 characters"); return; }
    // Validate invite email matches
    if (inviteCode && inviteRecord && loginEmail.toLowerCase() !== inviteRecord.email.toLowerCase()) {
      setLoginError(`This invite was sent to ${inviteRecord.email}. Please use that email address.`);
      return;
    }
    // BUG FIX (user report) — same "takes forever / sometimes doesn't even
    // work" root cause as doLogin: no timeout, no try/catch, so a dropped
    // connection left this stuck on "Please wait…" forever instead of
    // failing with a clear message.
    setLoginLoading(true); setLoginError("");
    const authRole = inviteRecord?.role?.toLowerCase().includes("manager") ? "manager" : "technician";
    let signInData: any, signInErr: any;
    try {
      const { error } = await withTimeout(supabase.auth.signUp({
        email: loginEmail, password: loginPwd,
        options: { data: { role: authRole, firstName: loginFirst, lastName: loginLast } },
      }), 20000, "Create account");
      if (error) { setLoginError(error.message); return; }
      // Auto sign-in after registration
      const res = await withTimeout<any>(supabase.auth.signInWithPassword({ email: loginEmail, password: loginPwd }), 20000, "Sign in");
      signInData = res.data; signInErr = res.error;
    } catch (e: any) {
      setLoginError(/timed out/i.test(e?.message || "") ? "That's taking too long — check your connection and try again." : (e?.message || "Sign-up failed — check your connection and try again."));
      return;
    } finally {
      setLoginLoading(false);
    }
    if (!signInErr && signInData.session) {
      const newUserId = signInData.session.user.id;

      // Mark invite used + link the employees row to this new auth user —
      // both routed through the service-role invite-action function (see
      // its header comment): under the new owner_id-scoped RLS, this
      // brand-new session has no employees.user_id link yet, so
      // current_owner_id() can't resolve anything for it to write these
      // rows directly, even though it's the same person who just proved
      // ownership of the invite code.
      let linkedEmployee: any = null;
      if (inviteCode) {
        try {
          // SECURITY — the server now derives WHICH invite/employee to link
          // solely from the invite row itself (owner_id + employee_email)
          // and verifies who's asking via this real access token, not from
          // any client-supplied id/email — see invite-action.ts's own
          // header comment for why that used to be a full account-takeover
          // hole. newUserId/employeeId/email are no longer read server-side;
          // kept out of the body so nothing here implies they still matter.
          const res = await fetch("/api/invite-action", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${signInData.session.access_token}` },
            body: JSON.stringify({ action: "consume", code: inviteCode }),
          });
          const result = await res.json().catch(() => ({} as any));
          if (res.ok) linkedEmployee = result?.employee || null;
        } catch { /* fall through — worst case, employee stays unlinked until next lookup-by-email */ }
        try {
          const stored: any[] = JSON.parse(localStorage.getItem("crm.invites") || "[]");
          localStorage.setItem("crm.invites", JSON.stringify(
            stored.map(i => i.code === inviteCode ? { ...i, used: true } : i)
          ));
        } catch { /* ignore */ }
      }

      // Provide the employee record immediately so myEmployee resolves without waiting for parent re-fetch
      if (linkedEmployee) setLocalEmployee(normalizeEmp(linkedEmployee));

      refetchEmployees?.();

      // Managers get the CRM, not the portal. See doLogin for why a reload (vs.
      // juggling empSession/hasCrmSession across components) is used here.
      const isManager = authRole === "manager" || (linkedEmployee as any)?.role?.toLowerCase?.().includes("manager");
      if (isManager) {
        try { localStorage.setItem("crew_role_" + newUserId, "manager"); } catch { /* ignore */ }
        toast("Account created! Redirecting to your dashboard…");
        window.location.hash = "/dashboard";
        window.location.reload();
        return;
      }

      setEmpSession(signInData.session);
      toast("Welcome! Account created ✓");
    } else {
      toast("Account created! Please sign in.");
      setLoginMode("login");
    }
  };

  // ── Owner view — shown when owner clicks "Team Portal" in sidebar ────────
  if (isOwnerView) {
    return (
      <OwnerTeamPortal
        jobs={jobs}
        employees={employees}
        customers={customers}
        onClose={onClose}
        googleMapsKey={settings?.googleMapsKey || settings?.mapsKey}
        toast={toast}
        settings={settings}
      />
    );
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!empSession) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            {/* BRANDING FIX — this always showed CRM Starter's own generic
                product mark, never the actual service business's
                logo, even though the business name right below it already
                used settings.companyName. Every other owner/customer-facing
                surface (email, client portal estimate/invoice pages) shows
                the owner's real uploaded logoUrl when set — the employee
                portal login screen was the one place still stuck on the
                generic mark regardless. */}
            {((settings as any)?.logoUrl || inviteBranding?.logoUrl) ? (
              <img src={(settings as any)?.logoUrl || inviteBranding?.logoUrl} alt={settings.companyName || inviteBranding?.companyName || "Company logo"} className="w-16 h-16 rounded-2xl object-contain mx-auto mb-4 shadow-lg bg-white/5" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center mx-auto mb-4 shadow-lg text-brand-fg">
                <BrandMark className="w-10 h-10" />
              </div>
            )}
            <div className="text-xl font-bold">{settings.companyName || inviteBranding?.companyName || "CRM Starter"}</div>
            <div className="text-sm text-white/50 mt-1">{inviteRecord ? "Create Your Crew Account" : "Employee Portal"}</div>
          </div>

          {!inviteRecord && (
            <div className="flex gap-1 p-1 mb-5 rounded-xl bg-white/5 border border-white/10">
              <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 transition">
                Owner / Manager
              </button>
              <button className="flex-1 py-2 rounded-lg text-xs font-medium bg-brand-600/30 border border-brand-500/40 text-white transition">
                Employee Portal
              </button>
              <button onClick={() => { window.location.hash = "/client"; }} className="flex-1 py-2 rounded-lg text-xs font-medium text-white/40 hover:text-white/70 transition">
                Customer
              </button>
            </div>
          )}

          <div className="space-y-3">
            {/* Invite banner */}
            {inviteRecord && (
              <div className="p-3 rounded-xl bg-green-950/30 border border-green-700/30">
                <div className="text-xs text-green-300 font-semibold mb-0.5">You've been invited!</div>
                <div className="text-xs text-white/50">Create your account below to access your schedule and jobs.</div>
              </div>
            )}
            {inviteCode && !inviteRecord && loginError && (
              <div className="p-3 rounded-xl bg-danger-950/30 border border-danger-700/30 text-xs text-danger-300">{loginError}</div>
            )}
            {loginMode === "register" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">First Name</label>
                  <GInput value={loginFirst} onChange={e => setLoginFirst(e.target.value)} placeholder="Jane" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Last Name</label>
                  <GInput value={loginLast} onChange={e => setLoginLast(e.target.value)} placeholder="Smith" />
                </div>
              </div>
            )}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Work Email</label>
              <GInput type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                placeholder="you@example.com" onKeyDown={e => e.key === "Enter" && (loginMode === "login" ? doLogin() : doRegister())} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/50 block">Password</label>
                <button type="button" onClick={() => setShowLoginPwd(s => !s)} className="text-xs font-medium text-white/60 hover:text-white underline-offset-2 hover:underline">{showLoginPwd ? "Hide" : "Show"}</button>
              </div>
              <div className="relative">
                <GInput type={showLoginPwd ? "text" : "password"} value={loginPwd} onChange={e => setLoginPwd(e.target.value)}
                  placeholder="••••••••" className="!pr-11" onKeyDown={e => e.key === "Enter" && (loginMode === "login" ? doLogin() : doRegister())} />
                <button type="button" onClick={() => setShowLoginPwd(s => !s)} aria-label={showLoginPwd ? "Hide password" : "Show password"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-white/40 hover:text-white/80">
                  {showLoginPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {loginError && !(inviteCode && !inviteRecord) && (
              <div className="p-3 bg-brand-950/40 border border-brand-700/50 rounded-xl text-sm text-brand-300">
                {loginError}
              </div>
            )}
            <GBtn onClick={loginMode === "login" ? doLogin : doRegister}
              disabled={loginLoading || !loginEmail || !loginPwd}
              className="w-full !justify-center !py-3 !flex !items-center !gap-2.5">
              {/* BUG FIX (user report) — "add a loader or animation saying
                  something like signing in." Was text-only. */}
              {loginLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />}
              {loginLoading ? (loginMode === "login" ? "Signing in…" : "Creating account…") : loginMode === "login" ? "Sign In" : "Create Account"}
            </GBtn>
            {loginMode === "login" && (
              forgotSent ? (
                <div className="text-center text-sm text-green-400 py-1">
                  ✓ Password reset email sent — check your inbox.
                </div>
              ) : (
                <button onClick={doForgotPassword}
                  className="w-full text-center text-xs text-white/30 hover:text-white/60 transition py-1">
                  Forgot password?
                </button>
              )
            )}
            <button onClick={() => { setLoginMode(m => m === "login" ? "register" : "login"); setLoginError(""); setForgotSent(false); }}
              className="w-full text-center text-sm text-white/40 hover:text-white/70 transition">
              {loginMode === "login" ? "New here? Create an account →" : "← Back to sign in"}
            </button>

            <div className="flex items-center gap-3 pt-1">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={handleEmployeeGoogleLogin}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-white text-gray-900 font-semibold text-sm shadow-lg hover:bg-gray-50 active:scale-95 transition-all"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>
          </div>
          <div className="mt-8 text-center text-xs text-white/20">
            Ask your manager for your portal access credentials
          </div>
        </div>
      </div>
    );
  }

  // ── Account not linked ────────────────────────────────────────────────────
  if (!myEmployee) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle size={40} className="text-yellow-400 mb-4" />
        <div className="text-lg font-bold mb-2">Account Not Linked</div>
        <div className="text-sm text-white/50 mb-4 max-w-xs">
          Your account ({empSession.user.email}) isn't linked to an employee record yet.
          {" "}If you just registered, tap Retry — it may take a moment to sync.
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <GBtn onClick={doRetryLink} disabled={retrying} className="w-full justify-center">
            {retrying ? "Checking…" : "Retry"}
          </GBtn>
          <GBtn onClick={doSignOut} disabled={signingOut} variant="ghost" className="w-full justify-center">
            {signingOut ? <div className="inline-block w-3.5 h-3.5 mr-1.5 border-2 border-white/30 border-t-white rounded-full animate-spin align-middle" /> : <LogOut size={14} className="inline mr-1.5" />}
            {signingOut ? "Signing out…" : "Sign Out"}
          </GBtn>
        </div>
      </div>
    );
  }

  // ── Job Request Page ──────────────────────────────────────────────────────
  if (requestId && empSession && myEmployee) {
    if (requestDone) {
      const reqJob = requestData ? jobs.find(j => j.id === requestData.job_id) : null;
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle size={52} className={(requestDone === "accepted" ? "text-green-400" : "text-white/30") + " mb-4"} />
          <div className="text-xl font-bold mb-2">
            {requestDone === "accepted" ? "Job Accepted!" : "Request Declined"}
          </div>
          {requestDone === "accepted" && reqJob && (
            <div className="text-sm text-white/60 mb-1">
              {reqJob.scheduledDate}{reqJob.scheduledTime ? " at " + reqJob.scheduledTime : ""}
            </div>
          )}
          <div className="text-sm text-white/50 mb-8 max-w-xs">
            {requestDone === "accepted"
              ? "You've been added to the crew. The job appears in your schedule."
              : "The owner has been notified. You can update your availability in the Calendar tab."}
          </div>
          <GBtn onClick={() => { setRequestId(null); setRequestDone(null); }}>Go to My Portal</GBtn>
        </div>
      );
    }
    if (requestLoading) {
      // No spinner — just render nothing for the brief moment before the
      // request details arrive, rather than blocking on a loading state.
      return <div className="min-h-screen bg-black" />;
    }
    if (!requestData) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle size={40} className="text-danger-400 mb-4" />
          <div className="text-lg font-bold mb-2">Request Not Found</div>
          <div className="text-sm text-white/50 mb-6">This link may have expired or already been used.</div>
          <GBtn onClick={() => setRequestId(null)} variant="ghost">Go to Portal</GBtn>
        </div>
      );
    }
    if (requestData.status !== "pending") {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <CheckCircle size={40} className={(requestData.status === "accepted" ? "text-green-400" : "text-brand-400") + " mb-4"} />
          <div className="text-lg font-bold mb-2 capitalize">Already {requestData.status}</div>
          <div className="text-sm text-white/50 mb-6">You already responded to this job request.</div>
          <GBtn onClick={() => setRequestId(null)} variant="ghost">Go to Portal</GBtn>
        </div>
      );
    }
    const reqJob = jobs.find(j => j.id === requestData.job_id);
    const reqCustomer = reqJob ? customers.find(c => c.id === reqJob.customerId) : null;
    return (
      <div className="h-dvh h-screen overflow-hidden bg-black text-white flex flex-col">
        <header className="sticky top-0 z-20 bg-black/95 border-b border-brand-900/30 px-4 py-3">
          <div className="font-semibold text-center">Job Request</div>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 max-w-lg mx-auto space-y-4">
          <Glass className="p-5 !bg-blue-950/20 !border-blue-700/30">
            <div className="text-xs text-blue-300 uppercase tracking-wider font-semibold mb-3">
              You've been requested for a job
            </div>
            <div className="space-y-2.5">
              {reqJob && (
                <>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin size={14} className="text-white/40 flex-shrink-0 mt-0.5" />
                    <span className="font-semibold">{reqJob.address}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} className="text-white/40 flex-shrink-0" />
                    <span>{reqJob.scheduledDate}{reqJob.scheduledTime ? " at " + reqJob.scheduledTime : ""}</span>
                  </div>
                </>
              )}
              {reqCustomer && (
                <div className="flex items-center gap-2 text-sm">
                  <User size={14} className="text-white/40 flex-shrink-0" />
                  <span>{reqCustomer.firstName} {reqCustomer.lastName}</span>
                </div>
              )}
              {reqJob && reqJob.amount > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign size={14} className="text-white/40 flex-shrink-0" />
                  <span className="text-green-400 font-semibold">{fmt(reqJob.amount)}</span>
                </div>
              )}
            </div>
            {requestData.message && (
              <div className="mt-4 p-3 rounded-xl bg-white/5 text-sm text-white/70 italic border border-white/10">
                "{requestData.message}"
              </div>
            )}
          </Glass>

          {showDenyForm ? (
            <div className="space-y-3">
              <div className="text-sm text-white/60">Reason for declining (optional):</div>
              <GTxt rows={3} value={denyReason} onChange={e => setDenyReason(e.target.value)}
                placeholder="e.g. Already booked, unavailable that day…" />
              <div className="flex gap-3">
                <GBtn variant="danger" onClick={handleDenyRequest} disabled={respondingToRequest} className="flex-1 !justify-center disabled:opacity-50">
                  {respondingToRequest ? "Declining…" : "Confirm Decline"}
                </GBtn>
                <GBtn variant="ghost" onClick={() => setShowDenyForm(false)} disabled={respondingToRequest} className="!px-4">
                  Cancel
                </GBtn>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <GBtn onClick={handleAcceptRequest} disabled={respondingToRequest}
                className="flex-1 !justify-center !py-3.5 !bg-gradient-to-r !from-green-700 !to-green-900 !border-green-600/50 disabled:opacity-50">
                <CheckCircle size={16} />{respondingToRequest ? "Accepting…" : "Accept Job"}
              </GBtn>
              <GBtn variant="danger" onClick={() => setShowDenyForm(true)} disabled={respondingToRequest}
                className="flex-1 !justify-center !py-3.5 disabled:opacity-50">
                <X size={16} />Decline
              </GBtn>
            </div>
          )}

          <button onClick={() => setRequestId(null)}
            className="w-full text-center text-xs text-white/30 hover:text-white/60 transition py-2">
            Skip — go to portal
          </button>
        </div>
      </div>
    );
  }

  // ── Selected job detail ───────────────────────────────────────────────────
  if (selectedJobId) {
    const job = jobs.find(j => j.id === selectedJobId);
    if (!job) { setSelectedJobId(null); return null; }
    const customer = findCustomer(job.customerId);
    // Next job today (or soonest after) that isn't this one, completed, or
    // cancelled — shown on the post-completion summary with directions.
    const nextJob = myJobs
      .filter(j => j.id !== job.id && j.status !== "completed" && j.status !== "cancelled" && j.scheduledDate >= todayStr)
      .sort((a, b) => (a.scheduledDate + (a.scheduledTime || "23:59")).localeCompare(b.scheduledDate + (b.scheduledTime || "23:59")))[0] || null;
    const nextJobCustomer = nextJob ? findCustomer(nextJob.customerId) || null : null;
    // FEATURE (round 13, item 20) — every OTHER job scheduled later today
    // (not just the immediate next one), for the Running Late cascade prompt.
    const laterJobsToday = myJobs
      .filter(j => j.id !== job.id && j.status !== "completed" && j.status !== "cancelled" && j.scheduledDate === todayStr && (j.scheduledTime || "23:59") > (job.scheduledTime || ""))
      .sort((a, b) => (a.scheduledTime || "23:59").localeCompare(b.scheduledTime || "23:59"))
      .map(j => ({ job: j, customer: findCustomer(j.customerId) || null }));
    return (
      <JobDetailView
        job={job}
        customer={customer}
        onBack={() => setSelectedJobId(null)}
        onUpdateJob={patch => updateJob(selectedJobId, patch)}
        toast={toast}
        companyName={settings.companyName || "CRM Starter"}
        onComplete={handleJobComplete}
        perms={perms}
        maxLunchMinutes={settings.maxLunchMinutes ?? 30}
        onJobCompleted={(j: Job) => { recordJobRating(j); syncJobToCalendar(j, { completed: true, silent: true }); createRecurringJob(j); }}
        googleMapsKey={settings.googleMapsKey || settings.mapsKey}
        paidLunchBreaks={!!settings.paidLunchBreaks}
        signOffDisclaimer={job.signOffTerms || resolveTermsForJobType(settings, job.jobType) || settings.terms || ""}
        settings={settings}
        setEstimates={setEstimates}
        setCustomers={setCustomers}
        nextJob={nextJob}
        nextJobCustomer={nextJobCustomer}
        laterJobsToday={laterJobsToday}
        employees={employees}
        chemicals={chemicals}
        onArrived={startDayShiftIfNeeded}
        autoComplete={pendingCompleteJobId === selectedJobId}
        employeeName={myEmployee ? `${myEmployee.firstName} ${myEmployee.lastName || ""}`.trim() : ""}
        employeeEmail={empSession?.user?.email || (myEmployee as any)?.email || ""}
        busyDates={myJobs.filter(j => j.status !== "cancelled" && j.status !== "completed" && j.id !== job.id).map(j => j.scheduledDate).filter(Boolean)}
      />
    );
  }

  // ── Portal ────────────────────────────────────────────────────────────────
  const role = empSession.user.user_metadata?.role || "technician";

  const toGCalUrl = (job: Job) => {
    const d = job.scheduledDate.replace(/-/g, "");
    const next = new Date(job.scheduledDate + "T12:00:00");
    next.setDate(next.getDate() + 1);
    const e = next.toISOString().slice(0, 10).replace(/-/g, "");
    const title = encodeURIComponent(`Job: ${job.address}`);
    const loc = encodeURIComponent(job.address);
    const notes = encodeURIComponent(job.notes || "");
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${d}/${e}&location=${loc}&details=${notes}`;
  };

  const notifyOwnerArrival = (job: Job, cust: Customer | undefined) => {
    const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
    if (!ownerEmail) return;
    const html = emailShell(settings, "Crew Arrived", `<p>${myEmployee.firstName} ${myEmployee.lastName} has arrived at a job:</p><ul><li><b>Address:</b> ${job.address}</li>${cust ? `<li><b>Customer:</b> ${cust.firstName} ${cust.lastName}</li>` : ""}<li><b>Time:</b> ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</li></ul>`);
    // AUDIT FIX — was sendEmail() (Resend-capable) with its failure fully
    // swallowed. docs/ARCHITECTURE.md is explicit: field-portal sends must use
    // sendOwnerGmailOnly, never sendEmail/Resend — this was a regression
    // from that rule, matching this file's own sendRunningLate owner-ping
    // a few thousand lines up, which already does it correctly.
    sendOwnerGmailOnly(settings as any, ownerEmail, `${myEmployee.firstName} arrived — ${job.address}`, html).catch((e: any) => console.warn("[Arrival] owner notify failed:", e?.message));
  };

  const JobCard = ({ job }: { job: Job }) => {
    const customer = findCustomer(job.customerId);
    const preItems = job.preChecklist?.length ? job.preChecklist : PRE_DEFAULTS;
    const postItems = job.postChecklist?.length ? job.postChecklist : POST_DEFAULTS;
    const allItems = [...preItems, ...(job.duringChecklist?.length ? job.duringChecklist : DURING_DEFAULTS), ...postItems];
    const doneCount = allItems.filter(i => i.done).length;
    // BUG 4 — read/write the parent-hoisted picker state so it survives the
    // frequent re-renders that otherwise remounted this card and flashed it shut.
    const latePickerOpen = lateOpenJobId === job.id;
    const setLatePickerOpen = (open: boolean) => setLateOpenJobId(open ? job.id : null);
    const sendingLate = sendingLateJobId === job.id;
    const lateNote = lateOpenJobId === job.id ? lateNoteText : "";
    const setLateNote = (v: string) => setLateNoteText(v);

    const otwOpenCard = otwOpenJobId === job.id;
    const setOtwOpenCard = (open: boolean) => setOtwOpenJobId(open ? job.id : null);
    const sendingOtwCard = sendingOtwJobId === job.id;

    const sendOTW = async () => {
      if (!customer) { console.warn("[OTW] no customer object"); toast("No customer info for this job", "yellow"); return; }
      setSendingOtwJobId(job.id);
      const msg = `Hi ${customer.firstName || "there"}, your CRM Starter technician is on the way!`;
      try {
        if (otwCardChannel === "sms") {
          if (!customer.phone) throw new Error("No phone on file for this customer.");
          await withTimeout(twilioSend(settings as any, customer.phone, msg), 15000, "OTW SMS");
          logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: msg }).catch(() => {});
        } else {
          if (!customer.email) throw new Error("No email on file for this customer.");
          const html = emailShell(settings, "On My Way", `<p>${msg}</p>`);
          await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, "Your technician is on the way", html), 15000, "OTW email");
        }
        updateJob(job.id, { commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: localDateStr(), note: `📍 On my way message sent via ${otwCardChannel === "sms" ? "text" : "email"}` }] });
        toast(`✅ Message sent to ${customer.firstName || "customer"}`, "green");
        setOtwOpenJobId(null);
      } catch (err: any) {
        console.error("[OTW] — error:", err?.message || err);
        toast(`❌ Failed to send — ${err?.message || "reason unknown"}`, "red");
      } finally {
        setSendingOtwJobId(null);
      }
    };
    const sendRunningLateCard = async (e: React.MouseEvent, minutes: number) => {
      e.stopPropagation();
      if (!customer) { console.warn("[RunningLate] no customer object"); toast("No customer info for this job", "yellow"); return; }
      if (!customer.phone && !customer.email) { console.warn("[RunningLate] customer has no phone/email"); toast("No contact info for this customer", "yellow"); return; }
      setSendingLateJobId(job.id);
      const nowMs = Date.now() + minutes * 60000;
      const newEta = new Date(nowMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const reason = lateNote.trim() ? ` — ${lateNote.trim()}` : "";
      const msg = `Running ${minutes} min late${reason}. New ETA: ${newEta}. -CRM Starter`;
      try {
        if (lateCardChannel === "sms") {
          if (!customer.phone) throw new Error("No phone on file for this customer.");
          await withTimeout(twilioSend(settings as any, customer.phone, `Hi ${customer.firstName}, ${msg}`), 15000, "Running late SMS");
          toast(`✅ Message sent to ${customer.firstName}`, "green");
          logOutboundSmsToInbox({ contactName: `${customer.firstName} ${customer.lastName}`, contactPhone: customer.phone, customerId: customer.id, body: `Hi ${customer.firstName}, ${msg}` }).catch(() => {});
        } else {
          if (!customer.email) throw new Error("No email on file for this customer.");
          const html = emailShell(settings, "Running Late", `<p>Hi ${customer.firstName},</p><p>${msg}</p>`);
          await withTimeout(sendOwnerGmailOnly(settings as any, customer.email, "Your technician is running late", html), 15000, "Running late email");
          toast(`✅ Message sent to ${customer.firstName}`, "green");
        }
        const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
        if (ownerEmail) {
          const ownerMsg = emailShell(settings, "Crew Running Late", `<p>${myEmployee.firstName} ${myEmployee.lastName} is running ~${minutes} min late to ${job.address}${lateNote.trim() ? ` (${lateNote.trim()})` : ""}.</p>`);
          sendOwnerGmailOnly(settings as any, ownerEmail, `Running late — ${job.address}`, ownerMsg).catch(() => {});
        }
        const newScheduledTime = shiftScheduledTime(job.scheduledTime, minutes);
        updateJob(job.id, {
          commLog: [...(job.commLog || []), { id: uid(), type: "note" as const, date: localDateStr(), note: `⏱ Running late +${minutes}min${lateNote.trim() ? ` (${lateNote.trim()})` : ""} — customer notified via ${lateCardChannel === "sms" ? "text" : "email"}` }],
          ...(newScheduledTime ? { scheduledTime: newScheduledTime } : {}),
        });
      } catch (err: any) {
        const errMsg = err?.message || "";
        console.error("[RunningLate] — error:", errMsg);
        if (/401|expired|reconnect/i.test(errMsg)) toast("❌ Failed to send — Google token expired, reconnect Google in Settings.", "red");
        else toast(`❌ Failed to send — ${errMsg || "reason unknown"}`, "red");
      } finally {
        setSendingLateJobId(null);
        setLateOpenJobId(null);
        setLateNoteText("");
        setLateMinutes(null);
      }
    };

    const arriveCard = async (e: React.MouseEvent) => {
      e.stopPropagation();
      // Same fixes as JobDetailView's markArrived: auto clock-in on
      // arrival, and actually notify the customer (this only ever emailed
      // the owner before).
      updateJob(job.id, { arrivedAt: Date.now(), status: job.status === "scheduled" ? "in_progress" : job.status, ...(job.clockInAt ? {} : { clockInAt: Date.now() }) });
      toast("Marked as arrived ✓ — owner notified");
      const cust = customers.find(c => c.id === job.customerId);
      notifyOwnerArrival?.(job, cust);
      startDayShiftIfNeeded();
      const arrivalMsg = `Hi ${cust?.firstName || "there"}, your CRM Starter technician has arrived and is getting started!`;
      try {
        if (cust?.phone) {
          await twilioSend(settings as any, cust.phone, arrivalMsg);
          logOutboundSmsToInbox({ contactName: `${cust.firstName} ${cust.lastName}`, contactPhone: cust.phone, customerId: cust.id, body: arrivalMsg }).catch(() => {});
        } else if (cust?.email) {
          const html = emailShell(settings, "We've Arrived", `<p>${arrivalMsg}</p>`);
          await sendOwnerGmailOnly(settings as any, cust.email, "Your technician has arrived", html);
        }
      } catch (e2: any) {
        console.warn("[Arrival] customer notify failed:", e2?.message);
      }
    };

    const isNextUp = job.id === completionNotif?.nextJobId;
    const isOverScheduleCard = !!(job.clockInAt && job.duration && (Date.now() - job.clockInAt) / 3600000 > Number(job.duration));
    const isCompletedCard = job.status === "completed";
    return (
      <div
        className={"rounded-2xl border transition " + (isCompletedCard ? "bg-white/[0.02] border-white/5 opacity-60" : isOverScheduleCard ? "bg-yellow-950/15 border-yellow-700/40" : job.clockInAt ? "bg-green-950/10 border-green-700/30" : isNextUp ? "bg-blue-950/15 border-blue-600/40" : "bg-white/5 border-white/10 hover:bg-white/8 hover:border-brand-600/20")}
      >
        {isCompletedCard && (
          <div className="px-4 pt-2.5 pb-0">
            <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide flex items-center gap-1"><CheckCircle size={11} />Completed</span>
          </div>
        )}
        {isOverScheduleCard && (
          <div className="px-4 pt-2.5 pb-0">
            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wide flex items-center gap-1"><AlertCircle size={10} />Running over schedule</span>
          </div>
        )}
        {isNextUp && !isOverScheduleCard && (
          <div className="px-4 pt-2.5 pb-0">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide animate-pulse">▶ Up Next</span>
          </div>
        )}
        {/* Clickable main area */}
        <button onClick={() => setSelectedJobId(job.id)} className="w-full text-left p-4 pb-3">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{job.address}</div>
              {customer ? (
                <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap">
                  <span>{customer.firstName} {customer.lastName}</span>
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/80 hover:text-blue-300 flex items-center gap-0.5">
                      <Phone size={9} />{customer.phone}
                    </a>
                  )}
                </div>
              ) : job.customerId ? (
                <div className="text-xs text-white/30 italic">Customer info loading...</div>
              ) : null}
            </div>
            <div className={"text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 " +
              (job.status === "completed" ? "bg-green-900/40 text-green-300" :
               job.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
               "bg-blue-900/40 text-blue-300")}>
              {(job.status || "").replace("_", " ")}
            </div>
          </div>
          <div className="text-xs text-white/40">
            {job.scheduledDate}{job.scheduledTime ? " · " + job.scheduledTime : ""}
            {job.duration ? <span className="ml-2 text-white/50">{formatEstDuration(job.duration)}</span> : null}
            {job.loggedHours ? <span className="ml-2 text-white/50">{job.loggedHours}h logged</span> : null}
          </div>
          {allItems.length > 0 && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: (doneCount / allItems.length * 100) + "%" }} />
              </div>
              <span className="text-[10px] text-white/40">{doneCount}/{allItems.length}</span>
            </div>
          )}
        </button>
        {/* Actions row: Directions + Clock in/out */}
        <div className="px-4 pb-3 flex items-center gap-2 border-t border-white/5 pt-2.5">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address)}`}
            target="_blank" rel="noreferrer"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-300 transition flex-shrink-0">
            <Navigation size={10} />Directions
          </a>
          {driveTimes[job.id] && (
            <span className="text-[10px] text-white/40 flex-shrink-0">🚗 ~{driveTimes[job.id]}</span>
          )}
          {!job.arrivedAt && job.status !== "completed" && (
            <button onClick={arriveCard}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-[10px] font-semibold transition flex-shrink-0">
              <MapPin size={10} />I've Arrived
            </button>
          )}
          <div className="flex-1" />
          {job.status === "completed"
            ? <div className="text-xs text-white/30">Done ✓</div>
            : job.loggedHours ? <div className="text-xs text-white/30">{job.loggedHours}h logged</div>
            : null
          }
        </div>
        {/* OTW + Running Late — any non-completed job */}
        {job.status !== "completed" && job.status !== "cancelled" && (
          <div className="px-4 pb-2 space-y-2" onClick={e => e.stopPropagation()}>
            {latePickerOpen ? (
              <div className="p-2 rounded-xl bg-orange-950/20 border border-orange-700/30 space-y-2">
                <div className="text-[10px] text-orange-300 font-semibold">Running Late</div>
                {/* Send via — explicit choice, never silently defaults away from the chosen channel */}
                <div className="flex gap-1">
                  <button title={!customer?.phone ? "This customer has no phone number on file" : "Send by text"} onClick={e => { e.stopPropagation(); setLateCardChannel("sms"); }}
                    className={"flex-1 py-1 rounded-lg border text-[10px] font-semibold transition " + (lateCardChannel === "sms" ? "border-orange-500 bg-orange-900/40 text-orange-200" : !customer?.phone ? "border-white/5 bg-black/20 text-white/25" : "border-white/10 bg-black/30 text-white/50")}>
                    💬 Text
                  </button>
                  <button title={!customer?.email ? "This customer has no email on file" : "Send by email (via the owner's connected Gmail)"} onClick={e => { e.stopPropagation(); setLateCardChannel("email"); }}
                    className={"flex-1 py-1 rounded-lg border text-[10px] font-semibold transition " + (lateCardChannel === "email" ? "border-orange-500 bg-orange-900/40 text-orange-200" : !customer?.email ? "border-white/5 bg-black/20 text-white/25" : "border-white/10 bg-black/30 text-white/50")}>
                    📧 Email
                  </button>
                </div>
                {lateCardChannel === "sms" && !settings?.twilioSid && (
                  <div className="text-[9px] text-yellow-400/80">Twilio isn't configured — add it in Settings, or switch to Email.</div>
                )}
                {lateCardChannel === "email" && !customer?.email && (
                  <div className="text-[9px] text-yellow-400/80">This customer has no email on file — add one in customer settings, or switch to Text.</div>
                )}
                {lateCardChannel === "sms" && !customer?.phone && (
                  <div className="text-[9px] text-yellow-400/80">This customer has no phone on file — add one in customer settings, or switch to Email.</div>
                )}
                {lateCardChannel === "email" && customer?.email && !googleLiveCard && (
                  <div className="text-[9px] text-yellow-400/80">Google isn't connected — connect it in Settings, or switch to Text.</div>
                )}
                {/* Reason templates */}
                <div className="flex flex-wrap gap-1">
                  {["Stuck in traffic", "Previous job ran over", "Equipment issue", "Weather delay"].map(t => (
                    <button key={t} onClick={e => { e.stopPropagation(); setLateNote(lateNote === t ? "" : t); }}
                      className={"text-[9px] px-2 py-1 rounded-lg border transition " + (lateNote === t ? "bg-orange-800/50 border-orange-500/60 text-orange-200" : "bg-white/5 border-white/15 text-white/50 hover:border-orange-700/40 hover:text-orange-300")}>
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={lateNote}
                  onChange={e => { e.stopPropagation(); setLateNote(e.target.value); }}
                  onClick={e => e.stopPropagation()}
                  placeholder="Custom note (optional)…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-white placeholder-white/30 focus:outline-none focus:border-orange-700/60"
                />
                <div className="text-[10px] text-white/50">How many minutes late?</div>
                <div className="flex gap-1">
                  {[5, 10, 15, 20, 30].map(m => (
                    <button key={m} onClick={e => { e.stopPropagation(); setLateMinutes(m); }}
                      className={"flex-1 py-1.5 rounded-lg border text-xs font-bold transition " + (lateMinutes === m ? "bg-orange-600 border-orange-400 text-white" : "bg-orange-900/40 border-orange-700/40 text-orange-300 hover:bg-orange-900/60")}>
                      {m}
                    </button>
                  ))}
                </div>
                {/* Explicit Send button — a picked minute value only SELECTS now;
                    the message isn't sent until the tech confirms here. */}
                <button
                  disabled={sendingLate || lateMinutes == null}
                  onClick={e => sendRunningLateCard(e, lateMinutes || 0)}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-orange-600 to-orange-800 border border-orange-500/60 text-white text-xs font-bold disabled:opacity-40 hover:from-orange-500 hover:to-orange-700 transition flex items-center justify-center gap-1.5">
                  <Navigation size={12} />{sendingLate ? "Sending…" : lateMinutes == null ? "Pick minutes above" : `Send "${lateMinutes} min late" message`}
                </button>
                <button onClick={e => { e.stopPropagation(); setLatePickerOpen(false); setLateNote(""); setLateMinutes(null); }} className="text-[10px] text-white/30 hover:text-white/60">Cancel</button>
              </div>
            ) : otwOpenCard ? (
              <div className="p-2 rounded-xl bg-blue-950/20 border border-blue-700/30 space-y-2">
                <div className="text-[10px] text-blue-300 font-semibold">On My Way</div>
                <div className="flex gap-1">
                  <button title={!customer?.phone ? "This customer has no phone number on file" : "Send by text"} onClick={e => { e.stopPropagation(); setOtwCardChannel("sms"); }}
                    className={"flex-1 py-1 rounded-lg border text-[10px] font-semibold transition " + (otwCardChannel === "sms" ? "border-blue-500 bg-blue-900/40 text-blue-200" : !customer?.phone ? "border-white/5 bg-black/20 text-white/25" : "border-white/10 bg-black/30 text-white/50")}>
                    💬 Text
                  </button>
                  <button title={!customer?.email ? "This customer has no email on file" : "Send by email (via the owner's connected Gmail)"} onClick={e => { e.stopPropagation(); setOtwCardChannel("email"); }}
                    className={"flex-1 py-1 rounded-lg border text-[10px] font-semibold transition " + (otwCardChannel === "email" ? "border-blue-500 bg-blue-900/40 text-blue-200" : !customer?.email ? "border-white/5 bg-black/20 text-white/25" : "border-white/10 bg-black/30 text-white/50")}>
                    📧 Email
                  </button>
                </div>
                {otwCardChannel === "sms" && !settings?.twilioSid && (
                  <div className="text-[9px] text-yellow-400/80">Twilio isn't configured — add it in Settings, or switch to Email.</div>
                )}
                {otwCardChannel === "email" && !customer?.email && (
                  <div className="text-[9px] text-yellow-400/80">This customer has no email on file — add one in customer settings, or switch to Text.</div>
                )}
                {otwCardChannel === "sms" && !customer?.phone && (
                  <div className="text-[9px] text-yellow-400/80">This customer has no phone on file — add one in customer settings, or switch to Email.</div>
                )}
                {otwCardChannel === "email" && customer?.email && !googleLiveCard && (
                  <div className="text-[9px] text-yellow-400/80">Google isn't connected — connect it in Settings, or switch to Text.</div>
                )}
                <div className="flex gap-1">
                  <button disabled={sendingOtwCard} onClick={e => { e.stopPropagation(); sendOTW(); }}
                    className="flex-1 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-800 border border-blue-500/60 text-white text-xs font-bold disabled:opacity-40 transition">
                    {sendingOtwCard ? "Sending…" : "Send"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setOtwOpenCard(false); }} className="text-[10px] text-white/30 hover:text-white/60 px-2">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {(customer?.phone || customer?.email) && (
                  <button onClick={e => { e.stopPropagation(); setOtwCardChannel(customer?.phone ? "sms" : "email"); setOtwOpenCard(true); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-blue-950/30 border border-blue-700/40 text-blue-300 text-[10px] font-semibold hover:bg-blue-900/40 transition">
                    <Navigation size={10} />OTW
                  </button>
                )}
                {(customer?.phone || customer?.email) && (
                  <button onClick={e => { e.stopPropagation(); setLateCardChannel(customer?.phone ? "sms" : "email"); setLatePickerOpen(true); }}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-orange-950/30 border border-orange-700/40 text-orange-300 text-[10px] font-semibold hover:bg-orange-900/40 transition">
                    <Clock size={10} />Running Late
                  </button>
                )}
                {!customer?.phone && !customer?.email && job.customerId && (
                  <div className="text-[10px] text-white/30 italic py-1.5">No contact info for this customer</div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="px-4 pb-3 flex gap-2">
          <button onClick={() => setSelectedJobId(job.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold transition">
            <ChevronRight size={12} />View Details
          </button>
          {!isCompletedCard && (
            <button onClick={e => { e.stopPropagation(); setPendingCompleteJobId(job.id); setSelectedJobId(job.id); }}
              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-green-950/40 hover:bg-green-900/50 border border-green-700/40 text-green-300 text-xs font-semibold transition">
              <CheckCircle size={12} />Complete
            </button>
          )}
        </div>
      </div>
    );
  };


  return (
    <div className="h-dvh h-screen overflow-hidden bg-black text-white flex flex-col">
      {/* Training module viewer/quiz — full-screen overlay, closed by
          finishing the module or tapping the X. Read the instructions,
          then (if the module has a quiz) answer it and get graded. */}
      {activeTrainingModule && (
        <div className="fixed inset-0 z-[250] bg-black overflow-y-auto">
          <div className="sticky top-0 z-10 bg-black/95 border-b border-brand-900/30 px-4 py-3 flex items-center justify-between">
            <div className="font-semibold text-sm truncate pr-2">{activeTrainingModule.title}</div>
            <button onClick={() => setActiveTrainingModule(null)} className="p-1.5 text-white/50 hover:text-white flex-shrink-0"><X size={18} /></button>
          </div>
          <div className="max-w-lg mx-auto p-4 space-y-4 pb-24">
            {!trainingResult && (
              <>
                {activeTrainingModule.body && (
                  <Glass className="p-4"><div className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed">{activeTrainingModule.body}</div></Glass>
                )}
                {(activeTrainingModule.media || []).length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {activeTrainingModule.media.map((md: any) => (
                      md.type === "video"
                        ? <video key={md.id} src={md.url} controls className="w-full rounded-xl border border-white/10" />
                        : <img key={md.id} src={md.url} alt="" className="w-full rounded-xl border border-white/10 object-cover" />
                    ))}
                  </div>
                )}
                {(activeTrainingModule.quiz || []).length > 0 ? (
                  <div className="space-y-3">
                    <div className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-1"><CheckSquare size={12} />Quiz — {activeTrainingModule.passingScore ?? 80}% to pass</div>
                    {activeTrainingModule.quiz.map((q: any, qi: number) => (
                      <Glass key={q.id} className="p-3 space-y-2">
                        <div className="text-sm font-medium">{qi + 1}. {q.question}</div>
                        <div className="space-y-1.5">
                          {q.options.map((opt: string, oi: number) => (
                            <label key={oi} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-white/5">
                              <input type="radio" name={q.id} checked={quizAnswers[q.id] === oi} onChange={() => setQuizAnswers(prev => ({ ...prev, [q.id]: oi }))} className="accent-brand-600 flex-shrink-0" />
                              <span className="text-sm text-white/80">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </Glass>
                    ))}
                    <GBtn
                      onClick={submitTrainingQuiz}
                      disabled={submittingTraining || activeTrainingModule.quiz.some((q: any) => quizAnswers[q.id] === undefined)}
                      className="w-full !py-3"
                    >
                      {submittingTraining ? "Grading…" : "Submit Quiz"}
                    </GBtn>
                  </div>
                ) : (
                  <GBtn onClick={submitTrainingQuiz} disabled={submittingTraining} className="w-full !py-3">
                    {submittingTraining ? "Saving…" : "Mark as Read"}
                  </GBtn>
                )}
              </>
            )}
            {trainingResult && (
              <Glass className={"p-6 text-center space-y-3 " + (trainingResult.passed ? "!bg-green-950/20 !border-green-700/30" : "!bg-brand-950/20 !border-brand-700/30")}>
                {trainingResult.passed ? <CheckCircle size={32} className="text-green-400 mx-auto" /> : <AlertTriangle size={32} className="text-danger-400 mx-auto" />}
                <div className="text-xl font-bold">{trainingResult.passed ? "Passed" : "Not Passed"}</div>
                {(activeTrainingModule.quiz || []).length > 0 && <div className="text-sm text-white/60">Score: {trainingResult.score}%{!trainingResult.passed && ` (need ${activeTrainingModule.passingScore ?? 80}%)`}</div>}
                <div className="flex gap-2 pt-2">
                  {!trainingResult.passed && (activeTrainingModule.quiz || []).length > 0 && (
                    <GBtn variant="ghost" onClick={() => { setQuizAnswers({}); setTrainingResult(null); }} className="flex-1">Retake</GBtn>
                  )}
                  <GBtn onClick={() => setActiveTrainingModule(null)} className="flex-1">Done</GBtn>
                </div>
              </Glass>
            )}
          </div>
        </div>
      )}

      {/* FEATURE — persistent offline banner. Job edits (checklist toggles,
          clock in/out, photos, etc.) already update local state instantly
          regardless of connectivity — this just makes that state visible so
          it doesn't read as "did my tap even register." Actions that
          genuinely need a live connection (sending texts, charging a card)
          check isOnline themselves at their own call sites and show a
          specific "needs internet" message instead of hanging. */}
      {!isOnline && (
        <div className="flex-shrink-0 bg-yellow-900/40 border-b border-yellow-700/40 px-4 py-1.5 text-center text-[11px] font-medium text-yellow-200 flex items-center justify-center gap-1.5">
          <WifiOff size={12} />You're offline — changes are being saved and will sync automatically once you're back online.
        </div>
      )}
      {isOnline && syncingOffline && (
        <div className="flex-shrink-0 bg-blue-900/40 border-b border-blue-700/40 px-4 py-1.5 text-center text-[11px] font-medium text-blue-200 flex items-center justify-center gap-1.5">
          <RefreshCw size={12} className="animate-spin" />Syncing {pendingSyncCount} offline change{pendingSyncCount !== 1 ? "s" : ""}…
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-black/95 border-b border-brand-900/30 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        {/* BRANDING FIX (round 2) — the owner asked to remove the icon badge
            entirely here, just the "CRM Starter" wordmark text, matching the
            owner CRM sidebar's own logo exactly (App.tsx — plain text, no
            icon at all). */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-extrabold text-lg text-white tracking-tight truncate">CRM <span className="text-brand-500">Starter</span></span>
        </div>
        {/* Employee info + actions */}
        <div className="flex items-center gap-2.5">
          {activeClockJobs.length > 0 && (
            <div className="relative">
              <button
                onClick={() => activeClockJobs.length > 1 ? setActiveJobMenuOpen(o => !o) : setSelectedJobId(activeClockJob.id)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-green-950/40 border border-green-700/40 text-green-300 text-[11px] font-semibold transition hover:bg-green-900/50"
              >
                <span className="relative flex items-center justify-center w-2 h-2 flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
                </span>
                <span className="hidden sm:inline">Active Job{activeClockJobs.length > 1 ? "s (" + activeClockJobs.length + ")" : ""}</span>
                <span className="font-mono">{formatElapsed(activeClockJob.clockInAt!)}</span>
              </button>
              {activeJobMenuOpen && activeClockJobs.length > 1 && (
                <div className="absolute right-0 top-full mt-2 w-60 rounded-xl bg-black border border-white/10 shadow-2xl overflow-hidden z-30">
                  {activeClockJobs.map(j => {
                    const c = customers.find(x => x.id === j.customerId);
                    return (
                      <button key={j.id} onClick={() => { setSelectedJobId(j.id); setActiveJobMenuOpen(false); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-white/10 transition border-b border-white/5 last:border-0">
                        <div className="text-xs font-semibold truncate text-white">{j.address}</div>
                        <div className="text-[10px] text-white/40 flex items-center gap-1.5">
                          {c && <span>{c.firstName} {c.lastName}</span>}
                          <span className="font-mono text-green-400">{formatElapsed(j.clockInAt!)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="text-right hidden xs:block">
            <div className="text-xs font-semibold text-white/80 leading-tight">{myEmployee.firstName} {myEmployee.lastName}</div>
            <div className="text-[10px] text-white/40 capitalize leading-tight">{myEmployee.role}</div>
          </div>
          {/* PWA install — small icon-only button just left of the avatar,
              same treatment as the owner CRM header. Was a full-width red
              banner under the header before; per explicit user feedback that
              was too prominent for this portal, so it's now a quiet icon
              here instead (still renders something in every browser state —
              see InstallAppButton.tsx). */}
          <InstallAppButton className="!p-2 !bg-transparent !border-0 !text-white/40 hover:!text-white hover:!bg-white/10 !rounded-xl flex-shrink-0" label="" />
          {/* BUG FIX — replaces the old always-visible header notification
              toggle with a one-time opt-in pop-up (see PushOptInPrompt.tsx). */}
          {(myEmployee as any)?.owner_id && <PushOptInPrompt ownerId={(myEmployee as any).owner_id} employeeId={myEmployee.id} />}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-700/60 to-brand-900/60 border border-brand-700/30 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {myEmployee.firstName?.[0] || "?"}{myEmployee.lastName?.[0] || ""}
          </div>
          {/* ITEM 2 — SOPs, always reachable from the header (not folded into
              the today/calendar/jobs/pay/google tab union, which threads
              through this whole file and would be a much larger/riskier
              change to extend). */}
          <button onClick={() => setSopOpen(true)} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition flex-shrink-0" title="SOPs & Instructions">
            <BookOpen size={16} />
          </button>
          <button onClick={doSignOut} disabled={signingOut} className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition flex-shrink-0 disabled:opacity-60" title="Sign out">
            {signingOut ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <LogOut size={16} />}
          </button>
        </div>
      </header>

      <SopModal open={sopOpen} onClose={() => setSopOpen(false)} ownerId={(myEmployee as any)?.owner_id || ""} currentEmployeeId={myEmployee?.id || ""} />

      {/* Persistent shift timer bar — visible on all tabs while clocked in */}
      {empDayClockInAt && (() => {
        const empDayLunchStartAt: number | null = optimisticDayLunchStartAt !== undefined
          ? optimisticDayLunchStartAt
          : ((myEmployee as any)?.dayLunchStartAt ?? null);
        const dayPausedMinutes = Number((myEmployee as any)?.dayPausedMinutes) || 0;
        const currentPauseMs = empDayLunchStartAt ? Math.max(0, Date.now() - empDayLunchStartAt) : 0;
        const netSecs = Math.max(0, Math.floor((Date.now() - empDayClockInAt - dayPausedMinutes * 60000 - currentPauseMs) / 1000));
        const hh = Math.floor(netSecs / 3600);
        const mm = Math.floor((netSecs % 3600) / 60);
        const ss = netSecs % 60;
        const display = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
        const onLunch = !!empDayLunchStartAt;
        const locationSharing = optimisticLocationSharing !== undefined ? optimisticLocationSharing : !!(myEmployee as any)?.locationSharing;
        const empId = (myEmployee as any)?.id;
        const headerToggleLocation = async () => {
          if (!empId) return;
          const turningOn = !locationSharing;
          if (turningOn && navigator.geolocation) {
            setLocationPermissionPending(true);
            let settled = false;
            const safety = setTimeout(() => { if (settled) return; settled = true; setLocationPermissionPending(false); toast("Location request timed out", "red"); }, 12000);
            navigator.geolocation.getCurrentPosition(
              async pos => {
                if (settled) return; settled = true; clearTimeout(safety);
                setLocationPermissionPending(false);
                // Optimistic flip so the "📍 Sharing" badge shows instantly.
                setOptimisticLocationSharing(true);
                toast("📍 Location sharing active", "green");
                // Write BOTH fields in one update so the badge state and the pin
                // land together — a split write meant a missing/slow second
                // update left the badge off even though coords were captured.
                const { error, data } = await (supabase as any).from("employees").update({ locationSharing: true, lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() } }).eq("id", empId).select("id");
                // BUG FIX — this write had no failure feedback at all (the
                // "off" branch below already toasts on error; "on" silently
                // logged to console only). If this update failed for any
                // reason (RLS, a transient network blip), the badge kept
                // showing "📍 Sharing" from the optimistic flip above with
                // nothing ever actually persisted — looking exactly like
                // "location sharing doesn't stick after a reload," because
                // reloading re-reads the real (never-updated) DB value.
                // Revert the optimistic flip and tell the owner outright
                // instead of leaving a UI state that isn't real.
                // AUDIT FIX — also added the documented .select("id") 0-row
                // check (docs/ARCHITECTURE.md) — `error` alone misses an RLS-filtered
                // 0-row "success."
                if (error || !Array.isArray(data) || data.length === 0) {
                  console.error("[Share Location] — error saving:", error?.message || "matched 0 rows");
                  setOptimisticLocationSharing(false);
                  toast("Failed to save location sharing — " + (error?.message || "the server didn't confirm the save"), "red");
                } else {
                  refetchEmployees?.();
                  // Start the watcher so location keeps updating every ~90s
                  // instead of this one GPS snapshot being the only fix ever
                  // sent — a no-op if it's already running (e.g. mileage
                  // auto-tracking already had it going).
                  startAutoMileageTracking();
                }
              },
              err => { if (settled) return; settled = true; clearTimeout(safety); setLocationPermissionPending(false); console.error("[Share Location] — error:", err.code, err.message); toast(geoErrorMessage(err), "red"); },
              { enableHighAccuracy: true, timeout: 10000 }
            );
            return;
          } else if (turningOn && !navigator.geolocation) {
            toast("This browser doesn't support location sharing", "red"); return;
          }
          // Turning OFF
          setOptimisticLocationSharing(false);
          try {
            const result = await (supabase as any).from("employees").update({ locationSharing: false }).eq("id", empId).select("id");
            if (result?.error) { toast("Failed to save — " + result.error.message, "red"); return; }
            if (!Array.isArray(result?.data) || result.data.length === 0) { toast("Turned off locally, but the server didn't confirm — it may still show as sharing to the owner.", "red"); return; }
            refetchEmployees?.();
          } catch (e: any) { toast("Failed to save — " + (e?.message || "try again"), "red"); }
        };
        // BUG FIX — "the top banner for an active shift should show the job,
        // or at least let you click the banner to go to the job you're in."
        // This bar showed "Shift Active" + a timer only, with no reference
        // to which job the clock is actually running against, and no way to
        // jump to it short of hunting through the job list.
        const activeJobForBar = activeClockJob;
        return (
          <>
            <div
              onClick={activeJobForBar ? () => setSelectedJobId(activeJobForBar.id) : undefined}
              className={"flex items-center justify-between px-4 py-1.5 border-b text-xs font-semibold " + (activeJobForBar ? "cursor-pointer " : "") + (onLunch ? "bg-yellow-950/40 border-yellow-800/30 text-yellow-400" : "bg-green-950/30 border-green-800/20 text-green-400")}>
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className={"absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping " + (onLunch ? "bg-yellow-400" : "bg-green-400")} />
                  <span className={"relative inline-flex rounded-full h-2 w-2 " + (onLunch ? "bg-yellow-400" : "bg-green-400")} />
                </span>
                <span className="flex-shrink-0">{onLunch ? "On Lunch / Paused" : "Shift Active"}</span>
                {activeJobForBar && <span className="truncate opacity-70 font-normal">· {activeJobForBar.address}</span>}
              </span>
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                <button onClick={headerToggleLocation} disabled={locationPermissionPending}
                  className={"flex items-center gap-1 px-2 py-0.5 rounded-lg border transition disabled:opacity-50 " + (locationSharing ? "bg-blue-900/40 border-blue-600/40 text-blue-300" : "bg-white/5 border-white/10 text-white/40 hover:text-white/70")}>
                  {locationPermissionPending
                    ? <div className="w-2.5 h-2.5 border border-white/40 border-t-transparent rounded-full animate-spin" />
                    : <MapPin size={10} />}
                  {locationSharing ? "📍 Sharing" : "Share location"}
                </button>
                <span className="font-mono tracking-widest">{display}</span>
              </div>
            </div>
          </>
        );
      })()}

      {/* Content */}
      <main className="flex-1 min-h-0 overflow-y-auto pb-24">
        {completionNotif && (() => {
          const nextJob = completionNotif.nextJobId ? jobs.find(j => j.id === completionNotif.nextJobId) : null;
          const cust = nextJob ? customers.find(c => c.id === nextJob.customerId) : null;
          const eta = nextJobEta?.jobId === nextJob?.id ? nextJobEta : null;
          const isLate = eta && eta.lateMinutes > 5;
          return (
            <div className="px-4 pt-4 max-w-lg mx-auto">
              <div className="p-3 rounded-xl bg-green-950/40 border border-green-700/40">
                <div className="flex items-center gap-3">
                  <span className="text-lg flex-shrink-0">✅</span>
                  <div className="flex-1 text-sm text-green-300 min-w-0">{completionNotif.message}</div>
                  <button onClick={() => setCompletionNotif(null)} className="text-white/30 hover:text-white/60 transition flex-shrink-0">
                    <X size={14} />
                  </button>
                </div>
                {nextJob && (
                  <div className="mt-2 pt-2 border-t border-green-700/20 space-y-2">
                    {eta && (
                      <div className={"text-xs font-semibold " + (isLate ? "text-yellow-400" : "text-green-400")}>
                        {isLate
                          ? `⚠️ Running ${eta.lateMinutes} min behind — ETA ${eta.etaTime}`
                          : `You're on schedule! ETA ${eta.etaTime}${nextJob.scheduledTime ? " · next job at " + nextJob.scheduledTime : ""}`}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextJob.address)}`} target="_blank" rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-xs font-semibold transition">
                        <Navigation size={11} />Directions
                      </a>
                      {cust?.phone && (
                        <button onClick={() => messageNextJobCustomer(nextJob, eta?.lateMinutes || 0)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white/70 text-xs font-semibold transition">
                          Message {cust.firstName}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
        <div className="p-4 max-w-lg mx-auto space-y-4">

          {/* Today tab */}
          {tab === "today" && <>
            {/* Welcome header. BUG FIX — "there are two buttons labeled
                Routes; there should be only one." This header shortcut and
                the "Today's Route" card further down both called the exact
                same optimizeRoute — removed this one since the card below
                also shows the resulting distance/duration, which this
                bare button never did. */}
            <div className="pb-1">
              <div className="text-xl font-bold text-white">Welcome, {myEmployee.firstName}!</div>
              <div className="text-sm text-white/50 mt-0.5">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </div>
            </div>

            {/* Next 3 Jobs — compact glance-and-go mini-itinerary so seeing
                what's next doesn't require switching to the Jobs tab. Reuses
                the exact same selectedJobId → JobDetailView path the full
                Jobs list already uses (see the "Selected job detail" branch
                above this component's Portal render) — tapping a card here
                opens the identical job detail view, nothing duplicated. */}
            {(() => {
              const upNext3 = myJobs
                .filter(j => j.status !== "completed" && j.status !== "cancelled" && j.scheduledDate >= todayStr)
                .sort((a, b) => (a.scheduledDate + (a.scheduledTime || "23:59")).localeCompare(b.scheduledDate + (b.scheduledTime || "23:59")))
                .slice(0, 3);
              if (upNext3.length === 0) return null;
              return (
                <Glass className="p-4 !bg-black/30">
                  <div className="flex items-center gap-2 mb-3">
                    <List size={14} className="text-brand-400" />
                    {/* BUG FIX — "it shows Next Job and Today's Jobs — should
                        just say Today's Jobs, not Next Job." This mini-list
                        can include jobs beyond today (up to 3 upcoming), so
                        it can't honestly share the "Today's Jobs" title with
                        the full same-day section below — "Up Next" avoids
                        the flagged "Next Job" wording without claiming to be
                        the same list. */}
                    <div className="text-sm font-bold text-white">Up Next</div>
                  </div>
                  <div className="space-y-2">
                    {upNext3.map(j => {
                      const c = findCustomer(j.customerId);
                      const isToday = j.scheduledDate === todayStr;
                      const priorityDot =
                        j.priority === "urgent" ? "bg-danger-500" :
                        j.priority === "high" ? "bg-orange-400" :
                        j.priority === "low" ? "bg-white/20" : "bg-blue-400";
                      return (
                        <button key={j.id} onClick={() => setSelectedJobId(j.id)}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-brand-600/30 transition text-left">
                          <span className={"w-2 h-2 rounded-full flex-shrink-0 " + priorityDot} title={`${j.priority || "normal"} priority`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{c ? `${c.firstName} ${c.lastName}` : "Unknown Customer"}</div>
                            <div className="text-[11px] text-white/50 truncate flex items-center gap-1 mt-0.5">
                              <MapPin size={9} className="flex-shrink-0" />{j.address}
                            </div>
                          </div>
                          <div className="flex flex-col items-end flex-shrink-0 gap-1">
                            <div className="text-[11px] font-semibold text-white/70 whitespace-nowrap">
                              {isToday ? (j.scheduledTime || "Today") : new Date(j.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" })}
                            </div>
                            <div className={"text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase " +
                              (j.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" : "bg-blue-900/40 text-blue-300")}>
                              {(j.status || "").replace("_", " ")}
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-white/20 flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </Glass>
              );
            })()}

            {/* Weather — same OpenWeather-backed data the owner's Dashboard
                shows (App.tsx fetches it once, keyed off settings.owmKey);
                crew scheduling outdoor service jobs need rain/wind
                risk visible without switching to the owner's CRM. Silently
                renders nothing if no API key is configured, matching
                Dashboard's own "no fake data" rule. */}
            {weatherData?.current && (
              <Glass className="p-3 !bg-blue-950/10 !border-blue-700/20 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="text-2xl font-bold text-white">{weatherData.current.temp}°F</div>
                  <div className="text-xs text-white/50 capitalize">{weatherData.current.description || weatherData.current.condition?.replace("_", " ")}</div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/50 flex-wrap justify-end">
                  <span className={weatherData.current.rainChance > 50 ? "text-blue-400 font-semibold" : ""}>💧 {weatherData.current.rainChance}%</span>
                  {weatherData.current.wind > 20 && <span className="text-yellow-400 font-semibold">💨 {weatherData.current.wind}mph</span>}
                  <span>💦 {weatherData.current.humidity}%</span>
                </div>
              </Glass>
            )}

            {/* Start My Day — overall work-hours clock, separate from clocking
                into an individual job (job clock-in/out tracks time per stop;
                this tracks the whole shift). */}
            {(() => {
              const dayClockInAt = optimisticDayClockInAt !== undefined ? optimisticDayClockInAt : (myEmployee as any)?.dayClockInAt;
              const dayLunchStartAt = optimisticDayLunchStartAt !== undefined ? optimisticDayLunchStartAt : (myEmployee as any)?.dayLunchStartAt;
              const dayPausedMinutes = Number((myEmployee as any)?.dayPausedMinutes) || 0;
              const empId = (myEmployee as any)?.id;
              // FIX 2 — if the employee already ended their shift once today,
              // "Start My Day" must never overwrite dayClockInAt with a fresh
              // Date.now() (which reset the visible timer back to 0:00 and
              // silently discarded the hours already logged). Track today's
              // already-worked hours from the last End-My-Day and, on Resume,
              // backdate the new dayClockInAt by that amount so the timer
              // continues from where it left off instead of restarting.
              // FIX 2 — prefer the Supabase-synced lastShiftHours/lastShiftDate, but
              // fall back to a localStorage copy for THIS device/browser. If the
              // migration adding those two columns was never run against the real
              // Supabase project, the server write silently fails (see toggleDay's
              // retry chain below) and the Resume feature would otherwise never
              // work at all, no matter how correct this logic is — the localStorage
              // copy guarantees same-device Resume always works regardless.
              const localLastShift = (() => {
                if (!empId) return null;
                try { return JSON.parse(localStorage.getItem("crm.lastShift." + empId) || "null"); } catch { return null; }
              })();
              // BLOCKER 13 (mobile round 9) — shiftDayStr() (4am cutover)
              // instead of localDateStr() (midnight), so ending/resuming a
              // shift that straddles local midnight doesn't get treated as
              // two different days and silently reset to zero.
              const alreadyWorkedTodayHours = (myEmployee as any)?.lastShiftDate === shiftDayStr()
                ? Number((myEmployee as any)?.lastShiftHours) || 0
                : (localLastShift?.date === shiftDayStr() ? Number(localLastShift?.hours) || 0 : 0);
              const isResuming = !dayClockInAt && alreadyWorkedTodayHours > 0;
              const onLunch = !!dayLunchStartAt;
              const currentPauseMs = onLunch ? Date.now() - dayLunchStartAt : 0;
              const netShiftHoursNow = dayClockInAt
                ? Math.max(0, (Date.now() - dayClockInAt - dayPausedMinutes * 60000 - currentPauseMs) / 3600000)
                : 0;
              const shiftSecs = Math.floor(netShiftHoursNow * 3600);
              const shiftHHMMSS = [Math.floor(shiftSecs / 3600), Math.floor((shiftSecs % 3600) / 60), shiftSecs % 60].map(n => String(n).padStart(2, "0")).join(":");
              // BUG FIX — "I arrived at / completed an unscheduled job today,
              // but End Day said I worked nothing." This only ever matched
              // jobs whose scheduledDate literally equals today, which
              // excludes any job with no scheduled date at all (booked/
              // worked same-day) or one rescheduled away from today on
              // paper but actually done today. Also count a job as "today"
              // if it was actually arrived at or completed today, regardless
              // of what its scheduledDate says.
              const isTodayTs = (v: any): boolean => {
                if (!v) return false;
                const d = typeof v === "number" ? new Date(v) : new Date(String(v));
                return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === localDateStr();
              };
              const sendEndOfDaySummary = async (finalHours: number) => {
                const todayStr = localDateStr();
                const todaysJobs = myJobs.filter(j => j.scheduledDate === todayStr || isTodayTs(j.completedAt) || isTodayTs(j.arrivedAt));
                const completedToday = todaysJobs.filter(j => j.status === "completed");
                const loggedHoursToday = Math.round(todaysJobs.reduce((s, j) => s + (Number(j.loggedHours) || 0), 0) * 100) / 100;
                const hours = loggedHoursToday > 0 ? loggedHoursToday : finalHours;
                const pay = Math.round(hours * (myEmployee?.hourlyRate || 0) * 100) / 100;
                const allCk = todaysJobs.flatMap(j => [...(j.preChecklist || []), ...(j.duringChecklist || []), ...(j.postChecklist || []), ...(j.checklist || [])]);
                const ckDone = allCk.filter((c: any) => c.done).length;
                const ckRate = allCk.length > 0 ? Math.round((ckDone / allCk.length) * 100) : 100;
                const revenueToday = completedToday.reduce((s, j) => s + (Number(j.amount) || 0), 0);

                const empName = `${myEmployee.firstName} ${myEmployee.lastName || ""}`.trim();
                // BUG FIX — "jobs completed 1 should have a space before the
                // number" (same for hours/pay/checklist). These rows used
                // display:flex to push the label and value apart — Gmail's
                // clipped CSS support and Outlook both ignore flexbox
                // entirely in email HTML, so the label and value collapsed
                // together with no space between them ("Jobs completed1").
                // A <table> row is the actual reliable way to lay out two
                // ends of a line in HTML email; emailSummaryRow below is
                // shared by both the employee and owner copies.
                const summaryRows = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${emailSummaryRow("Jobs completed", String(completedToday.length))}
                  ${emailSummaryRow("Hours worked", `${hours}h`)}
                  ${emailSummaryRow("Estimated pay", fmt(pay))}
                  ${emailSummaryRow("Checklist completion", `${ckRate}%`)}
                </table>`;
                const companyName = settings?.companyName || "CRM Starter";

                // BUG FIX — "the employee's email should be a little more
                // encouraging" — was a single flat "Nice work today" line
                // regardless of how the day actually went. Picks a warmer,
                // more specific line based on real performance (completed
                // everything + clean checklists vs. just got through it),
                // so it reads like actual recognition, not a form letter.
                const encouragement = completedToday.length === 0
                  ? `Rough one today, ${myEmployee.firstName} — no jobs marked complete. Reach out if anything got in the way.`
                  : ckRate >= 95
                  ? `🌟 Amazing work today, ${myEmployee.firstName}! ${completedToday.length} job${completedToday.length !== 1 ? "s" : ""} done and every checklist buttoned up — that's exactly the standard we want. Go enjoy your evening!`
                  : completedToday.length >= 3
                  ? `Great hustle today, ${myEmployee.firstName}! ${completedToday.length} jobs done — that's a strong day's work. Thank you for grinding it out.`
                  : `Nice work today, ${myEmployee.firstName}! Thanks for putting in the effort — every job done well adds up.`;

                // ISSUE 10 (round 11) — used generic sendEmail (Resend-capable
                // fallback) for an in-portal automated send; per docs/ARCHITECTURE.md's
                // critical rule, field-portal automated sends must go through
                // the owner's own connected Gmail (sendOwnerGmailOnly), never
                // silently fall back to Resend.
                if (myEmployee?.email) {
                  const payTabLink = `${window.location.origin}${window.location.pathname}#/portal/pay`;
                  sendOwnerGmailOnly(settings as any, myEmployee.email, `Your day summary — ${todayStr}`, emailShell(settings, "End of Day Summary", `<p>${encouragement}</p>${summaryRows}` + emailButton("View Pay Tab", payTabLink)))
                    .catch((e: any) => console.error("[EndOfDaySummary] employee copy failed to send:", e?.message));
                }
                const ownerEmail = settings?.myEmail || settings?.companyEmail;
                if (ownerEmail) {
                  // FEATURE — the owner's copy used to be the SAME 4-line
                  // summary as the employee's own, plus one revenue line.
                  // The owner is the one who actually needs to act on
                  // problems (a job left incomplete, an unpaid job, low
                  // checklist completion) — give them the real per-job
                  // breakdown instead of just totals.
                  const notCompletedToday = todaysJobs.filter(j => j.status !== "completed" && j.status !== "cancelled");
                  const jobRows = todaysJobs.map(j => {
                    const cust = customers.find((c: any) => c.id === j.customerId);
                    const custName = cust ? `${cust.firstName || ""} ${cust.lastName || ""}`.trim() : (j.address || "Unknown");
                    const statusColor = j.status === "completed" ? "#16a34a" : j.status === "cancelled" ? "#9ca3af" : "#d97706";
                    const paymentLabel = j.status === "completed" ? paymentStatusLabel(j) : "—";
                    return `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px;color:#333">${custName}${j.address ? ` <span style="color:#888">· ${j.address}</span>` : ""}</td><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:13px;text-align:right;white-space:nowrap"><span style="color:${statusColor};font-weight:600">${(j.status || "").replace("_", " ")}</span>${j.status === "completed" ? ` · ${fmt(j.amount)} · ${paymentLabel}` : ""}</td></tr>`;
                  }).join("") || `<tr><td colspan="2" style="color:#888;font-size:13px;padding:6px 0">No jobs scheduled today.</td></tr>`;
                  const alertsHtml = notCompletedToday.length > 0
                    ? `<div style="margin-top:12px;padding:10px 12px;background:#fff7ed;border:1px solid #fdba74;border-radius:8px;color:#9a3412;font-size:13px"><strong>⚠️ ${notCompletedToday.length} job${notCompletedToday.length !== 1 ? "s" : ""} not marked completed:</strong> ${notCompletedToday.map(j => { const c = customers.find((x: any) => x.id === j.customerId); return c ? `${c.firstName} ${c.lastName}` : j.address; }).join(", ")}</div>`
                    : "";
                  const milesToday = dayTrackedMiles > 0.1 ? emailSummaryRow("Miles tracked (GPS)", `${dayTrackedMiles.toFixed(1)} mi`) : "";
                  // BUG FIX — "add a clickable action button, such as 'View
                  // Pay Tab' or 'View Dashboard,' in the end-of-day email
                  // summary." Neither copy had any link back into the app
                  // at all before.
                  const dashboardLink = `${window.location.origin}${window.location.pathname}#/dashboard`;
                  const ownerBody = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${summaryRows.replace(/<\/?table[^>]*>/g, "")}${milesToday}${emailSummaryRow("Revenue today (this employee)", fmt(revenueToday))}</table>
                    <h3 style="margin:18px 0 6px;font-size:14px;color:#333">Today's jobs (${todaysJobs.length})</h3>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${jobRows}</table>
                    ${alertsHtml}` + emailButton("View Dashboard", dashboardLink);
                  sendOwnerGmailOnly(settings as any, ownerEmail, `Day summary — ${empName} — ${todayStr}${notCompletedToday.length > 0 ? " ⚠️" : ""}`, emailShell(settings, `Day Summary — ${empName}`, ownerBody))
                    .catch((e: any) => console.error("[EndOfDaySummary] owner copy failed to send:", e?.message));
                } else {
                  console.warn("[EndOfDaySummary] no owner email on file (settings.myEmail/companyEmail both empty) — owner copy not sent");
                }
              };
              const toggleDay = async () => {
                if (!empId) return;
                haptic(20);
                const endingDay = !!dayClockInAt;
                // FIX 2 — Resuming after an earlier End-My-Day must never reset the
                // visible timer to 0:00. Backdate the new dayClockInAt by whatever
                // was already logged today (isResuming/alreadyWorkedTodayHours,
                // computed above) so `now - dayClockInAt` picks up right where the
                // last shift left off instead of restarting from scratch. The time
                // spent "ended" in between is simply not counted, which is correct.
                const nextVal = endingDay ? null : Date.now() - Math.round(alreadyWorkedTodayHours * 3600000);
                const finalHours = Math.round(netShiftHoursNow * 100) / 100;
                // FIX 2 (mobile round 8) — confirms the Resume flow actually
                // continued from the prior total rather than restarting at
                // zero; alreadyWorkedTodayHours/isResuming are read straight
                // off myEmployee (Supabase-backed), so this is correct
                // whether the employee stayed on this tab, switched tabs and
                // came back, or reloaded the app entirely.
                if (!endingDay && isResuming) console.log("[Verify] Resume Day — continuing from", alreadyWorkedTodayHours.toFixed(2), "h already logged today (not resetting to 0)");
                // Flip immediately — a Supabase update() call resolves with an
                // {error} object on a 400 rather than throwing, so a try/catch
                // around it alone was silently swallowing real failures (the
                // success toast fired and refetchEmployees() then reverted the
                // UI right back since the row was never actually updated).
                setOptimisticDayClockInAt(nextVal);
                // Human-readable total (7h 23m) shown in a banner before the
                // timer disappears, and logged to lastShiftHours below.
                const totH = Math.floor(finalHours);
                const totM = Math.round((finalHours - totH) * 60);
                const totalLabel = `${totH}h ${String(totM).padStart(2, "0")}m`;
                if (endingDay) {
                  setOptimisticDayLunchStartAt(null);
                  // BUG FIX — set immediately so the Pay tab reflects this
                  // shift's hours right away instead of waiting on
                  // refetchEmployees() to resolve (see computeEmployeeShiftTopUp).
                  setOptimisticLastShiftHours(finalHours);
                  setOptimisticLastShiftDate(shiftDayStr());
                  sendEndOfDaySummary(finalHours);
                  // Persist for the rest of the day (no auto-hide) — FIX 11.
                  setShiftEndedMsg(`Shift ended · Total ${totalLabel}`);
                  // BUG FIX — tracked miles used to ONLY pre-fill the Log
                  // Mileage form for the employee to separately open that
                  // tab and manually submit. In practice nobody did, so
                  // "mileage isn't showing up in the owner's Mileage
                  // section" was really "it was tracked but never actually
                  // written to mileage_logs at all." Auto-submit the day's
                  // tracked total straight to mileage_logs now (same
                  // auto-approve shape submitMileageLog uses), so it's
                  // guaranteed to reach the owner without a second manual
                  // step. Still ALSO pre-fills the form below in case the
                  // employee wants to log something in addition/instead.
                  stopAutoMileageTracking();
                  if (dayTrackedMiles > 0.1 && empId) {
                    const autoMiles = Math.round(dayTrackedMiles * 100) / 100;
                    const autoRow = { id: uid(), employee_id: empId, date: localDateStr(), from: "", to: "", miles: autoMiles, purpose: "Auto-tracked shift mileage", status: "approved", owner_id: (myEmployee as any)?.owner_id || null };
                    (supabase as any).from("mileage_logs").insert(autoRow)
                      .then((r: any) => {
                        if (r?.error) { console.error("[Mileage] auto-submit failed:", r.error.message); toast?.("Mileage tracked (" + autoMiles + " mi) but failed to sync — log it manually in the Mileage tab", "yellow"); }
                        else setMileageLogs(prev => [autoRow, ...prev]);
                      })
                      .catch((e: any) => console.error("[Mileage] auto-submit threw:", e?.message));
                  }
                  if (dayTrackedMiles > 0.1) {
                    setMileageForm(f => (f.miles ? f : { ...f, miles: dayTrackedMiles.toFixed(1) }));
                  }
                } else {
                  // Starting a fresh shift clears any prior "shift ended" banner.
                  setShiftEndedMsg(null);
                  setDayTrackedMiles(0);
                  startAutoMileageTracking();
                }
                // Always write the localStorage fallback immediately, regardless of
                // how the Supabase write below goes — this is what guarantees
                // Resume works on this device even if the lastShiftHours/
                // lastShiftDate columns don't exist yet server-side.
                if (endingDay && empId) {
                  try { localStorage.setItem("crm.lastShift." + empId, JSON.stringify({ hours: finalHours, date: shiftDayStr() })); } catch { /* ignore */ }
                }
                const patch: any = endingDay
                  ? { dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0, lastShiftHours: finalHours, lastShiftDate: shiftDayStr() }
                  : { dayClockInAt: nextVal, dayLunchStartAt: null, dayPausedMinutes: 0 };
                // BUG FIX — "End My Day doesn't save; hours are still running
                // when I come back." PostgREST returns 204/no-error on an
                // UPDATE that matched ZERO rows (e.g. RLS's owner_id-scoped
                // policy silently filtering the row out) — the old code only
                // checked result.error, so a write that silently did NOTHING
                // still showed "Shift ended ✓" and the optimistic UI briefly
                // showed 0:00, then reverted once refetchEmployees() pulled
                // back the real (unchanged) row. .select("id") forces
                // PostgREST to return the actually-affected rows so an
                // empty array can be told apart from a real success.
                try {
                  let result = await (supabase as any).from("employees").update(patch).eq("id", empId).select("id");
                  if (result?.error) {
                    // Retry with ONLY the shift-timer columns from migration 0002 —
                    // a missing lastShiftHours/lastShiftDate column must not stop
                    // dayClockInAt from persisting, or the owner never sees the shift.
                    console.warn("[HoursSync] full patch failed:", result.error.message, "— retrying without lastShiftHours/lastShiftDate");
                    const core = endingDay
                      ? { dayClockInAt: null, dayLunchStartAt: null, dayPausedMinutes: 0 }
                      : { dayClockInAt: nextVal, dayLunchStartAt: null, dayPausedMinutes: 0 };
                    result = await (supabase as any).from("employees").update(core).eq("id", empId).select("id");
                  }
                  if (result?.error) {
                    // Even dayLunchStartAt/dayPausedMinutes (migration 0002) may be
                    // missing — fall back to JUST dayClockInAt (migration 0001, the
                    // oldest/most foundational column) so the owner's Live Team View
                    // at least sees the shift, even if pause/lunch tracking can't save.
                    console.warn("[HoursSync] core patch also failed:", result.error.message, "— retrying dayClockInAt only. Run supabase/migrations/0001 and 0002 in the Supabase SQL editor.");
                    result = await (supabase as any).from("employees").update({ dayClockInAt: nextVal }).eq("id", empId).select("id");
                  }
                  if (result?.error) {
                    console.error("[HoursSync] — error:", result.error.message);
                    toast("Saved locally, but couldn't sync to the server: " + result.error.message, "red");
                    setOptimisticDayClockInAt(undefined);
                  } else if (!result?.data || result.data.length === 0) {
                    console.error("[HoursSync] — update matched 0 rows (blocked by permissions?) for employee", empId);
                    toast("Couldn't save — the server rejected the change (permissions). Contact the owner.", "red");
                    setOptimisticDayClockInAt(undefined);
                  } else {
                    refetchEmployees?.();
                    toast(endingDay ? `Shift ended · Total ${totalLabel} logged, summary emailed` : "Day started — owner can see you're on shift");
                  }
                } catch (e: any) {
                  console.error("[HoursSync] — error:", e?.message || e);
                  toast("Saved locally, but couldn't sync to the server: " + (e?.message || "unknown error"), "red");
                  setOptimisticDayClockInAt(undefined);
                }
              };
              const toggleLunchPause = async (isLunch?: boolean) => {
                if (!empId || !dayClockInAt) return;
                const turningOn = !onLunch;
                if (turningOn) {
                  setOptimisticDayLunchStartAt(Date.now());
                  if (isLunch !== undefined) setPauseMode(isLunch);
                } else {
                  setOptimisticDayLunchStartAt(null);
                  setPauseMode(false);
                }
                const patch: any = turningOn
                  ? { dayLunchStartAt: Date.now() }
                  : { dayLunchStartAt: null, dayPausedMinutes: dayPausedMinutes + currentPauseMs / 60000 };
                try {
                  const result = await (supabase as any).from("employees").update(patch).eq("id", empId).select("id");
                  if (result?.error) { toast("Failed to save — " + result.error.message, "red"); return; }
                  if (!result?.data || result.data.length === 0) { toast("Failed to save — the server rejected the change", "red"); return; }
                  refetchEmployees?.();
                  if (turningOn) {
                    toast(isLunch ? "Lunch started — timer paused 🍽️" : "Timer paused ⏸");
                  } else {
                    toast("Timer resumed ▶");
                  }
                } catch (e: any) {
                  toast("Saved locally, but couldn't sync to the server: " + (e?.message || ""), "red");
                }
              };
              const maxLunchMins = Number((settings as any)?.maxLunchMinutes ?? 30);
              const lunchElapsedSecs = onLunch ? Math.floor(currentPauseMs / 1000) : 0;
              const lunchRemainSecs = Math.max(0, maxLunchMins * 60 - lunchElapsedSecs);
              const lunchOverSecs = Math.max(0, lunchElapsedSecs - maxLunchMins * 60);
              const lunchCountdownHHMMSS = [Math.floor(lunchRemainSecs / 3600), Math.floor((lunchRemainSecs % 3600) / 60), lunchRemainSecs % 60].map(n => String(n).padStart(2, "0")).join(":");
              // BUG FIX — this Today-tab toggle used to read `myEmployee.
              // locationSharing` directly with NO optimistic state at all,
              // completely separate from the header shift-bar's toggle
              // (which DOES use optimisticLocationSharing). Result: tapping
              // "Share My Location" here updated the header instantly (it
              // showed active) but this control kept showing "off" until
              // refetchEmployees() actually resolved — reading exactly like
              // "I have to press the banner at top, and it still doesn't
              // show here." Same source of truth as the header now.
              const locationSharing = optimisticLocationSharing !== undefined ? optimisticLocationSharing : !!(myEmployee as any)?.locationSharing;
              const toggleLocationSharing = async () => {
                if (!empId) { toast("Still loading your profile — try again in a moment", "yellow"); return; }
                const turningOn = !locationSharing;
                // Request the permission prompt immediately on tap — previously
                // this only flipped a DB flag and GPS posting silently waited
                // for the employee to also be clocked in, so pressing the
                // button while off-shift looked like it "did nothing" with no
                // permission prompt and no feedback at all.
                if (turningOn && navigator.geolocation) {
                  setLocationPermissionPending(true);
                  // Belt-and-suspenders timeout: some mobile browsers/WebViews
                  // don't reliably honor getCurrentPosition's own `timeout`
                  // option and just never call either callback, which is what
                  // left the button stuck on "Requesting location permission…"
                  // forever. This guarantees the pending state always clears.
                  let settled = false;
                  const safety = setTimeout(() => {
                    if (settled) return;
                    settled = true;
                    setLocationPermissionPending(false);
                    toast("Location request timed out — try again", "red");
                  }, 12000);
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      if (settled) return;
                      settled = true; clearTimeout(safety);
                      setLocationPermissionPending(false);
                      setOptimisticLocationSharing(true);
                      toast("📍 Location sharing active");
                      (supabase as any).from("employees").update({ lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, updatedAt: Date.now() }, locationSharing: true }).eq("id", empId).select("id").then((r: any) => {
                        if (r?.error || !Array.isArray(r?.data) || r.data.length === 0) { console.error("[Share Location] — error saving coords:", r?.error?.message || "matched 0 rows"); setOptimisticLocationSharing(false); toast("Failed to save location sharing — " + (r?.error?.message || "the server didn't confirm the save"), "red"); }
                        else { refetchEmployees?.(); startAutoMileageTracking(); }
                      });
                    },
                    (err) => {
                      if (settled) return;
                      settled = true; clearTimeout(safety);
                      setLocationPermissionPending(false);
                      console.error("[Share Location] — error:", err.code, err.message);
                      toast(geoErrorMessage(err), "red");
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                  // BUG FIX — there was no `return` here, so execution fell
                  // straight through to the unconditional write below EVERY
                  // time this ran (turning on), racing against the position
                  // callback's own write above. Whichever one landed second
                  // silently won — this one writes locationSharing:true with
                  // NO coordinates, so if it landed after the real coords
                  // write, the badge would show "on" with lastLocation
                  // never actually set. The getCurrentPosition callback
                  // above already handles the full write (coords + flag +
                  // optimistic state + error toast) for this case.
                  return;
                } else if (turningOn && !navigator.geolocation) {
                  toast("This browser doesn't support location sharing", "red");
                  return;
                }
                // Only reaches here for "turning off."
                setOptimisticLocationSharing(false);
                try {
                  const result = await (supabase as any).from("employees").update({ locationSharing: turningOn }).eq("id", empId).select("id");
                  if (result?.error) { setOptimisticLocationSharing(true); toast("Failed to save — " + result.error.message, "red"); return; }
                  if (!Array.isArray(result?.data) || result.data.length === 0) { setOptimisticLocationSharing(true); toast("Failed to save — the server didn't confirm the change.", "red"); return; }
                  refetchEmployees?.();
                } catch (e: any) { setOptimisticLocationSharing(true); toast("Failed to save — " + (e?.message || "try again"), "red"); }
              };
              // FEATURE — shift-end digest data, computed from real data
              // already tracked on `jobs` for today (never a new tracking
              // field): checklist arrays, internalNotes/notes, and noShow.
              // "End My Day" opens ShiftEndDigestModal with this instead of
              // clocking out immediately; toggleDay() (the real write) only
              // fires once the employee taps Confirm in the modal.
              const todaysJobsForDigest = myJobs.filter(j => j.scheduledDate === todayStr);
              const completedTodayForDigest = todaysJobsForDigest.filter(j => j.status === "completed");
              const digestFlaggedIssues: string[] = [];
              todaysJobsForDigest.forEach(j => {
                const cust = findCustomer(j.customerId);
                const label = cust ? `${cust.firstName} ${cust.lastName}`.trim() : (j.address || "Job");
                if (j.noShow) digestFlaggedIssues.push(`${label} — marked as no-show`);
                if (j.status === "cancelled" && j.cancelReason) digestFlaggedIssues.push(`${label} — cancelled: ${j.cancelReason}`);
                if (j.status === "completed") {
                  const allCk = [...(j.preChecklist || []), ...(j.duringChecklist || []), ...(j.postChecklist || []), ...(j.checklist || [])];
                  const unchecked = allCk.filter((c: any) => !c.done);
                  if (unchecked.length > 0) digestFlaggedIssues.push(`${label} — ${unchecked.length} checklist item${unchecked.length > 1 ? "s" : ""} left unchecked`);
                }
                if (j.internalNotes && j.internalNotes.trim()) {
                  const note = j.internalNotes.trim();
                  digestFlaggedIssues.push(`${label} — internal note: "${note.slice(0, 70)}${note.length > 70 ? "…" : ""}"`);
                }
              });
              const digestHours = Math.round(netShiftHoursNow * 100) / 100;
              const digestTotH = Math.floor(digestHours);
              const digestTotM = Math.round((digestHours - digestTotH) * 60);
              const digestHoursLabel = `${digestTotH}h ${String(digestTotM).padStart(2, "0")}m`;
              const confirmEndDay = async () => {
                setEndDayConfirming(true);
                try {
                  await withTimeout(toggleDay(), 20000, "End My Day");
                } catch (e: any) {
                  // toggleDay() already shows its own success/failure toast
                  // internally; this only guards against withTimeout's own
                  // rejection (a hung request) leaving the modal stuck open.
                  console.error("[ShiftEndDigest] — error:", e?.message || e);
                  toast("Still working on it — check your connection and try again if it doesn't clear", "yellow");
                } finally {
                  setEndDayConfirming(false);
                  setShowEndDayDigest(false);
                }
              };
              return (
                <>
                  {showEndDayDigest && (
                    <ShiftEndDigestModal
                      hoursLabel={digestHoursLabel}
                      jobsCompleted={completedTodayForDigest.length}
                      jobsToday={todaysJobsForDigest.length}
                      flaggedIssues={digestFlaggedIssues}
                      onConfirm={confirmEndDay}
                      onCancel={() => !endDayConfirming && setShowEndDayDigest(false)}
                      confirming={endDayConfirming}
                    />
                  )}
                  {shiftEndedMsg && !dayClockInAt && (
                    <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-green-950/40 border border-green-700/40 text-green-300 font-semibold text-sm">
                      <CheckCircle size={16} />{shiftEndedMsg}
                    </div>
                  )}
                  {dayClockInAt && (
                    <div className="text-center py-2 rounded-2xl">
                      <div className={"font-mono text-2xl font-bold tracking-wider " + (onLunch ? "text-yellow-400" : "text-green-300")}>
                        {shiftHHMMSS}
                      </div>
                      {onLunch && (
                        pauseIsLunch ? (
                          lunchOverSecs > 0 ? (
                            <div className="text-[10px] font-sans font-normal text-brand-400/80 mt-0.5">
                              🍽️ Lunch over by {Math.ceil(lunchOverSecs / 60)}m — tap Resume when back
                            </div>
                          ) : (
                            <div className="text-xs font-sans font-semibold text-yellow-400 mt-0.5">
                              🍽️ {lunchCountdownHHMMSS} remaining
                            </div>
                          )
                        ) : (
                          <div className="text-[10px] font-sans font-normal text-yellow-400/70 mt-0.5">⏸ Timer paused</div>
                        )
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => (dayClockInAt ? setShowEndDayDigest(true) : toggleDay())} className={"flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition active:scale-95 " + (dayClockInAt ? "bg-green-900/40 border-2 border-green-500/60 text-green-300" : isResuming ? "bg-blue-900/40 border-2 border-blue-500/60 text-blue-300 hover:bg-blue-900/60" : "bg-brand-700/40 border-2 border-brand-500/60 text-white hover:bg-brand-700/60")}>
                      {dayClockInAt ? <Clock size={16} /> : isResuming ? <Play size={16} /> : <Clock size={16} />}
                      {dayClockInAt ? "End My Day" : isResuming ? "Resume" : "Start My Day"}
                    </button>
                    {dayClockInAt && onLunch && (
                      <button onClick={() => toggleLunchPause()} className="flex-shrink-0 flex items-center justify-center gap-1.5 px-4 rounded-2xl font-semibold text-sm transition active:scale-95 bg-yellow-900/40 border-2 border-yellow-500/60 text-yellow-300">
                        <Play size={14} />Resume
                      </button>
                    )}
                    {dayClockInAt && !onLunch && (
                      <button onClick={() => toggleLunchPause(false)} className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 rounded-2xl font-semibold text-xs transition active:scale-95 bg-white/5 border-2 border-white/10 text-white/60 hover:text-white">
                        <Pause size={13} />Pause
                      </button>
                    )}
                    {dayClockInAt && !onLunch && (
                      <button onClick={() => toggleLunchPause(true)} className="flex-shrink-0 flex items-center justify-center gap-1.5 px-3 rounded-2xl font-semibold text-xs transition active:scale-95 bg-yellow-950/40 border-2 border-yellow-700/40 text-yellow-400 hover:bg-yellow-900/30">
                        🍽️ Lunch
                      </button>
                    )}
                  </div>
                  <button onClick={toggleLocationSharing} disabled={locationPermissionPending} className={"w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition disabled:opacity-60 " + (locationSharing ? "bg-blue-900/30 border border-blue-500/40 text-blue-300" : "bg-white/5 border border-white/10 text-white/50")}>
                    {locationPermissionPending
                      ? <div className="w-3 h-3 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                      : <MapPin size={12} />}
                    {locationPermissionPending ? "Requesting location permission…" : locationSharing ? "Sharing my location with owner 🟢" : "Share My Location (off)"}
                  </button>
                  {/* FIX 11 — sharing itself never needs a Maps key (just browser
                      geolocation); the map preview is a nice-to-have bonus, not a
                      requirement. Without a key, show a plain confirmation badge
                      instead of LiveMap's "add a Maps API key" placeholder, which
                      read as if sharing were broken/incomplete. */}
                  {locationSharing && (myEmployee as any)?.lastLocation?.lat != null && (
                    (settings.googleMapsKey || settings.mapsKey) ? (
                      <LiveMap
                        apiKey={settings.googleMapsKey || settings.mapsKey || ""}
                        pins={[{ id: empId, label: (myEmployee as any).firstName || "Me", lat: (myEmployee as any).lastLocation.lat, lng: (myEmployee as any).lastLocation.lng, updatedAt: (myEmployee as any).lastLocation.updatedAt }]}
                      />
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-blue-950/20 border border-blue-700/30 text-blue-300 text-xs">
                        <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400" /></span>
                        Location updated {new Date((myEmployee as any).lastLocation.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} — owner can see you on Live Crew View
                      </div>
                    )
                  )}
                </>
              );
            })()}

            {/* FEATURE — "the employee map view already shows their
                location, but we need a map that displays pins for where
                their jobs are, with a line connecting stop 1, stop 2, stop
                3, stop 4." A real ordered route: today's jobs, numbered by
                scheduled time, connected by a polyline (LiveMap's new
                routeLine prop) — distinct from the location-SHARING map
                above, which only ever shows the employee's own live GPS
                dot. Jobs need their own geocoded lat/lng (set when the
                address was picked via AddressAutocomplete — see
                CrewView.tsx's identical job-pin comment); a job entered by
                hand without ever touching the address autocomplete won't
                have one yet and is simply skipped here, same as it already
                is on the owner's Crew View map. */}
            {(() => {
              const routeJobs = myJobs
                .filter((j: any) => j.scheduledDate === todayStr && j.status !== "cancelled" && typeof j.lat === "number" && typeof j.lng === "number")
                .sort((a: any, b: any) => (a.scheduledTime || "").localeCompare(b.scheduledTime || ""));
              if (routeJobs.length === 0) return null;
              const mapsKey = settings.googleMapsKey || settings.mapsKey || "";
              if (!mapsKey) return null;
              const routePins = routeJobs.map((j: any, i: number) => ({
                id: "route-" + j.id, label: j.customerName || j.address || `Stop ${i + 1}`,
                lat: j.lat, lng: j.lng, updatedAt: Date.now(), kind: "job" as const, stopNumber: i + 1,
              }));
              return (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-white/70 flex items-center gap-1.5"><Route size={12} className="text-blue-400" />Today's Route ({routeJobs.length} stop{routeJobs.length !== 1 ? "s" : ""})</div>
                  <LiveMap apiKey={mapsKey} pins={routePins} routeLine heightClassName="h-64" />
                </div>
              );
            })()}

            {/* New Assignment banner — recently crew-assigned jobs the
                employee hasn't acknowledged yet. */}
            {(() => {
              const empId = (myEmployee as any)?.id;
              if (!empId) return null;
              let dismissed: string[] = [];
              try { dismissed = JSON.parse(localStorage.getItem("crm.dismissedAssignments") || "[]"); } catch { /* ignore */ }
              const newAssignments = myJobs.filter(j => {
                const at = j.crewAssignedAt?.[empId];
                return at && Date.now() - at < 24 * 3600000 && !dismissed.includes(`${j.id}:${at}`);
              });
              if (newAssignments.length === 0) return null;
              const dismiss = (j: Job) => {
                const key = `${j.id}:${j.crewAssignedAt?.[empId]}`;
                const next = [...dismissed, key];
                try { localStorage.setItem("crm.dismissedAssignments", JSON.stringify(next)); } catch { /* ignore */ }
                setCardTick(t => t + 1);
              };
              return (
                <div className="space-y-2">
                  {newAssignments.map(j => {
                    const cust = customers.find(c => c.id === j.customerId);
                    return (
                      <div key={j.id} className="flex items-center gap-3 p-3 rounded-2xl bg-blue-950/30 border border-blue-600/40">
                        <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0"><Bell size={14} className="text-blue-300" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-blue-200">New Assignment</div>
                          <div className="text-xs text-white/60 truncate">{j.scheduledDate}{j.scheduledTime ? ` · ${j.scheduledTime}` : ""} — {cust ? `${cust.firstName} ${cust.lastName}` : j.address}</div>
                        </div>
                        <button onClick={() => dismiss(j)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white flex-shrink-0">Got it</button>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Weekly overview mini-calendar */}
            <div className="flex items-center justify-between gap-1.5">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(); d.setDate(d.getDate() - d.getDay() + i);
                const dStr = d.toISOString().slice(0, 10);
                const isToday = dStr === todayStr;
                const hasJob = myJobs.some(j => j.scheduledDate === dStr);
                return (
                  <button key={dStr} onClick={() => { setCalSelectedDate(dStr); setTab("calendar"); }}
                    className={"flex-1 flex flex-col items-center gap-1 py-2 rounded-xl border transition " + (isToday ? "bg-brand-950/30 border-brand-700/40" : "bg-white/5 border-white/5 hover:bg-white/10")}>
                    <div className="text-[9px] text-white/40 uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })[0]}</div>
                    <div className={"text-xs font-bold " + (isToday ? "text-brand-300" : "text-white/70")}>{d.getDate()}</div>
                    <div className={"w-1.5 h-1.5 rounded-full " + (hasJob ? "bg-blue-400" : "bg-transparent")} />
                  </button>
                );
              })}
            </div>

            {/* BUG FIX — "get rid of the start job, upload photo and get
                signature buttons on the dashboard for employee portal
                because they can do that individually inside of the job."
                These 3 buttons never did anything themselves — all three
                just navigated to the same job's detail view, where the
                real actions already live. Removed as pure redundancy. */}

            {/* Route optimization for today's jobs */}
            {todayJobs.filter(j => j.status !== "completed" && j.address).length >= 1 && (
              <Glass className="p-4 !bg-black/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Navigation size={14} className="text-blue-400 flex-shrink-0" />
                    <div className="text-sm font-semibold truncate">Today's Route</div>
                  </div>
                  <button onClick={optimizeRoute} disabled={routeLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-xs font-semibold transition disabled:opacity-40 flex-shrink-0">
                    <Route size={12} />{routeLoading ? "Optimizing…" : "Route"}
                  </button>
                </div>
                {routeInfo && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-4 text-xs text-white/50">
                      <span>🚗 <span className="text-white/80 font-semibold">{routeInfo.totalDistance}</span></span>
                      <span>⏱ <span className="text-white/80 font-semibold">{routeInfo.totalDuration}</span> drive time</span>
                    </div>
                    <div className="text-[9px] text-white/30">Drag a stop, or use the arrows, to reorder manually</div>
                    <div className="space-y-1">
                      {routeInfo.order.map((j, i) => {
                        const c = customers.find(x => x.id === j.customerId);
                        return (
                          <div key={j.id}
                            draggable
                            onDragStart={() => onStopDragStart(i)}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => onStopDrop(i)}
                            className="flex items-center gap-2 text-xs p-1.5 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/5 transition">
                            <span className="w-5 h-5 rounded-full bg-blue-900/50 text-blue-300 flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                            <span className="flex-1 truncate text-white/70">{j.address}{c ? " · " + c.firstName + " " + c.lastName : ""}</span>
                            <span className="text-white/40 flex-shrink-0">ETA {routeInfo.etas[i]}</span>
                            <div className="flex flex-col flex-shrink-0">
                              <button onClick={() => moveStop(i, -1)} disabled={i === 0} className="text-white/30 hover:text-white disabled:opacity-20 leading-none">▲</button>
                              <button onClick={() => moveStop(i, 1)} disabled={i === routeInfo.order.length - 1} className="text-white/30 hover:text-white disabled:opacity-20 leading-none">▼</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={openRouteInMaps}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white text-gray-900 text-xs font-semibold mt-2 hover:bg-gray-50 transition">
                      <Navigation size={12} />Open Route in Google Maps
                    </button>
                  </div>
                )}
              </Glass>
            )}

            {/* Incoming job requests */}
            {(() => {
              const pending = incomingRequests.filter(r => r.status === "pending");
              if (incomingLoading) return null;
              if (incomingRequests.length === 0) return null;
              return (
                <div>
                  {pending.length > 0 && (
                    <div className="mb-1 flex items-center gap-2">
                      <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Incoming Requests</div>
                      <span className="px-2 py-0.5 rounded-full bg-yellow-600 text-[10px] font-bold text-black">{pending.length}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {pending.map(req => {
                      const reqJob = jobs.find(j => j.id === req.job_id);
                      const reqCust = reqJob ? customers.find(c => c.id === reqJob.customerId) : null;
                      return (
                        <div key={req.id} className="rounded-2xl bg-yellow-950/20 border border-yellow-700/30 overflow-hidden">
                          <div className="p-3">
                            <div className="flex items-start gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                {reqJob && <div className="font-semibold text-sm truncate">{reqJob.address}</div>}
                                <div className="flex items-center gap-2 text-xs text-white/50 mt-0.5 flex-wrap">
                                  {reqJob && <span>📅 {reqJob.scheduledDate}{reqJob.scheduledTime ? " · " + reqJob.scheduledTime : ""}</span>}
                                  {reqCust && <span>👤 {reqCust.firstName} {reqCust.lastName}</span>}
                                  {reqJob && reqJob.amount > 0 && <span className="text-green-400 font-semibold">{fmt(reqJob.amount)}</span>}
                                </div>
                                {req.message && <div className="mt-1.5 text-xs text-white/60 italic bg-white/5 px-2 py-1 rounded-lg">"{req.message}"</div>}
                              </div>
                            </div>
                            {inlineDenyId === req.id ? (
                              <div className="space-y-2">
                                <textarea value={inlineDenyReason} onChange={e => setInlineDenyReason(e.target.value)}
                                  placeholder="Reason (optional)…" rows={2}
                                  className="w-full bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none resize-none" />
                                <div className="flex gap-2">
                                  <button onClick={() => handleInlineDeny(req)} disabled={respondingToInlineId === req.id}
                                    className="flex-1 py-2 rounded-xl bg-brand-700 hover:bg-brand-600 text-brand-fg text-xs font-bold transition disabled:opacity-50">
                                    {respondingToInlineId === req.id ? "Declining…" : "Confirm Decline"}
                                  </button>
                                  <button onClick={() => { setInlineDenyId(null); setInlineDenyReason(""); }} disabled={respondingToInlineId === req.id}
                                    className="px-3 py-2 rounded-xl bg-white/5 text-white/50 text-xs transition disabled:opacity-50">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => handleInlineAccept(req)} disabled={respondingToInlineId === req.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-white text-xs font-bold transition disabled:opacity-50">
                                  <CheckCircle size={13} />{respondingToInlineId === req.id ? "Accepting…" : "Accept"}
                                </button>
                                <button onClick={() => setInlineDenyId(req.id)} disabled={respondingToInlineId === req.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-brand-950/50 hover:bg-brand-900/60 border border-brand-700/40 text-brand-300 text-xs font-semibold transition disabled:opacity-50">
                                  <X size={13} />Decline
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
              <Glass className="p-3 !bg-white/5 text-center">
                <div className="text-xl font-black text-white">{weekHours.toFixed(1)}<span className="text-[11px] font-normal text-white/40">h</span></div>
                <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Hours This<br/>Week</div>
              </Glass>
              <Glass className="p-3 !bg-white/5 text-center">
                <div className="text-xl font-black text-white">{weekJobsDone}</div>
                <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Jobs<br/>Done</div>
              </Glass>
              {perms.can_view_pay ? (
                <Glass className="p-3 !bg-green-950/20 !border-green-700/30 text-center">
                  <div className="text-xl font-black text-green-400">{fmt(weekPay)}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Est.<br/>Pay</div>
                </Glass>
              ) : (
                <Glass className="p-3 !bg-blue-950/20 !border-blue-700/30 text-center">
                  <div className="text-xl font-black text-blue-400">{todayJobs.length}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 leading-tight">Today's<br/>Jobs</div>
                </Glass>
              )}
            </div>

            {/* Up Next highlight (only when next job is a future date, not today) */}
            {upNextJob && upNextJob.scheduledDate !== todayStr && (
              <div className="relative pt-3">
                <div className="absolute top-0 left-3 z-10 px-2.5 py-0.5 rounded-full bg-brand-600 text-[10px] font-bold text-brand-fg uppercase tracking-wide shadow">
                  Up Next
                </div>
                <Glass className="p-4 !bg-blue-950/20 !border-blue-700/30">
                  <div className="font-semibold text-sm">{upNextJob.address}</div>
                  {upNextCustomer && <div className="text-xs text-white/50 mt-0.5">{upNextCustomer.firstName} {upNextCustomer.lastName}</div>}
                  <div className="text-xs text-white/40 mt-1">
                    {upNextJob.scheduledDate}{upNextJob.scheduledTime ? " · " + upNextJob.scheduledTime : ""}
                  </div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(upNextJob.address)}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2 transition">
                    <Navigation size={11} />Get Directions
                  </a>
                </Glass>
              </div>
            )}

            {/* Today's jobs.
                BUG FIX — "when they have three jobs it shows 'blank out of
                blank jobs completed.' After completing the first job, the
                Today tab should show the two remaining jobs; after the
                second, the last remaining job." The list itself now only
                shows what's still left to do today — a completed job
                dropping off the list IS the progress indicator, so the
                confusing "X of Y" counter line is gone; the badge counts
                what's remaining, not the original total. */}
            {(() => {
              const remainingTodayJobs = todayJobs.filter(j => j.status !== "completed");
              const completedCount = todayJobs.length - remainingTodayJobs.length;
              return (
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 flex items-center gap-2">
                    <span>Today's Jobs</span>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{remainingTodayJobs.length} left</span>
                    {completedCount > 0 && <span className="px-2 py-0.5 rounded-full bg-green-900/30 text-green-400">{completedCount} done</span>}
                  </div>
                  {todayJobs.length === 0 ? (
                    <div className="text-center py-10 text-white/30 space-y-2">
                      <CheckCircle size={32} className="mx-auto opacity-30" />
                      <div className="font-semibold text-white/40">No jobs scheduled for today</div>
                      <div className="text-xs leading-relaxed text-white/30">
                        {myJobs.length > 0 ? (
                          <>You have {myJobs.filter(j => j.scheduledDate > todayStr && j.status !== "cancelled").length} upcoming job{myJobs.filter(j => j.scheduledDate > todayStr && j.status !== "cancelled").length !== 1 ? "s" : ""} — tap <span className="font-semibold text-white/50">All Jobs</span> to view them.</>
                        ) : (
                          <>No jobs are assigned to you yet. Your manager will send them here when scheduled.</>
                        )}
                      </div>
                    </div>
                  ) : remainingTodayJobs.length === 0 ? (
                    <div className="text-center py-10 text-green-400/60 space-y-2">
                      <CheckCircle size={32} className="mx-auto" />
                      <div className="font-semibold">All {todayJobs.length} of today's jobs are done 🎉</div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {remainingTodayJobs.map(j => <JobCard key={j.id} job={j} />)}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Upcoming this week */}
            {weekJobs.filter(j => j.scheduledDate > todayStr).length > 0 && (
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3">Upcoming This Week</div>
                <div className="space-y-2">
                  {weekJobs.filter(j => j.scheduledDate > todayStr).map(j => <JobCard key={j.id} job={j} />)}
                </div>
              </div>
            )}

          </>}

          {/* Calendar tab */}
          {tab === "calendar" && (() => {
            const calWeekDates = Array.from({ length: 7 }, (_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - d.getDay() + i + calWeekOffset * 7);
              return d.toISOString().slice(0, 10);
            });
            const calMonthBase = new Date();
            calMonthBase.setDate(1);
            calMonthBase.setMonth(calMonthBase.getMonth() + calMonthOffset);
            const calMonthYear = calMonthBase.getFullYear();
            const calMonthMonth = calMonthBase.getMonth();
            const calDaysInMonth = new Date(calMonthYear, calMonthMonth + 1, 0).getDate();
            const calFirstDay = new Date(calMonthYear, calMonthMonth, 1).getDay();
            const calMonthLabel = calMonthBase.toLocaleDateString("en-US", { month: "long", year: "numeric" });
            // Cancelled jobs are hidden from the calendar by default — same
            // "Show Cancelled" convention as the All Jobs tab — rather than
            // the calendar showing every assigned job regardless of status
            // with no way to filter cancellations out.
            const calVisibleJobs = showCanceledJobs ? myJobs : myJobs.filter(j => j.status !== "cancelled");
            const calCanceledCount = myJobs.filter(j => j.status === "cancelled").length;
            const calDayJobs = calVisibleJobs.filter(j => j.scheduledDate === calSelectedDate);
            // AUDIT — the [EmpCalendar] trace log here (FIX 3, mobile round
            // 8) ran on every render of this tab, which re-renders on every
            // 3s/10s jobs poll and realtime update while an employee has the
            // Calendar tab open — flooding the console all day. The pipeline
            // bug it was tracing is confirmed fixed; removed rather than left
            // logging continuously.

            return (
              <>
                {/* Week / Month toggle + Availability */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex flex-1 bg-white/5 rounded-xl p-1">
                    <button onClick={() => setCalMode("week")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${calMode === "week" ? "bg-brand-600 text-brand-fg" : "text-brand-fg/50 hover:text-white"}`}>
                      Week
                    </button>
                    <button onClick={() => setCalMode("month")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${calMode === "month" ? "bg-brand-600 text-brand-fg" : "text-brand-fg/50 hover:text-white"}`}>
                      Month
                    </button>
                  </div>
                  <button onClick={() => setShowAvailability(v => !v)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition ${showAvailability ? "bg-orange-600/30 border-orange-500/50 text-orange-300" : "bg-white/5 border-white/10 text-white/40 hover:text-white/70"}`}>
                    <Eye size={12} />{showAvailability ? "Done" : "Availability"}
                  </button>
                </div>
                {calCanceledCount > 0 && (
                  <button onClick={() => setShowCanceledJobs(v => !v)} className={"w-full flex items-center justify-center gap-1.5 py-1.5 mb-3 rounded-xl border text-xs font-medium transition " + (showCanceledJobs ? "bg-brand-950/20 border-brand-700/40 text-brand-300" : "bg-black/30 border-white/10 text-white/40 hover:text-white/60")}>
                    {showCanceledJobs ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {showCanceledJobs ? `Showing ${calCanceledCount} canceled job${calCanceledCount !== 1 ? "s" : ""}` : `Show Canceled (${calCanceledCount})`}
                  </button>
                )}
                {showAvailability && (
                  <div className="mb-3 space-y-2">
                    <div className="p-2.5 rounded-xl bg-orange-950/20 border border-orange-700/30 text-xs text-orange-200/70">
                      Tap dates to mark yourself <b>unavailable</b>. Gray dates = blocked. Owner will see these when scheduling.
                      {availability.length > 0 && <span className="ml-2 text-orange-300">{availability.length} day{availability.length !== 1 ? "s" : ""} blocked</span>}
                    </div>
                    {/* FEATURE 5 — recurring weekday off (e.g. "every Sunday"),
                        separate from the specific-date picker below. */}
                    <div className="p-2.5 rounded-xl bg-orange-950/10 border border-orange-700/20">
                      <div className="text-xs text-orange-200/70 mb-2">Recurring days off <span className="text-white/30">(every week)</span></div>
                      <div className="flex flex-wrap gap-1.5">
                        {weekdayLabels.map((lbl, i) => {
                          const active = recurringDaysOff.includes(i);
                          return (
                            <button
                              key={i}
                              type="button"
                              onClick={() => toggleRecurringDayOff(i)}
                              className={"px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition " + (active ? "bg-orange-600 border-orange-500 text-white" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {calMode === "week" && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <button onClick={() => setCalWeekOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronLeft size={16} />
                      </button>
                      <div className="text-xs text-white/60 font-semibold">
                        {new Date(calWeekDates[0] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" – "}
                        {new Date(calWeekDates[6] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      <button onClick={() => setCalWeekOffset(o => o + 1)} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {/* 7-day strip */}
                    <div className="grid grid-cols-7 gap-1 mb-4">
                      {calWeekDates.map(dateStr => {
                        const d = new Date(dateStr + "T12:00:00");
                        const dayJobs = calVisibleJobs.filter(j => j.scheduledDate === dateStr);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === calSelectedDate && !showAvailability;
                        // FEATURE 5 — a recurring day off (e.g. "every Sunday")
                        // must show as blocked here too, not just specific dates.
                        const isUnavail = availability.includes(dateStr) || recurringDaysOff.includes(d.getDay());
                        return (
                          <button key={dateStr}
                            onClick={() => showAvailability ? toggleAvailability(dateStr) : setCalSelectedDate(dateStr)}
                            className={`flex flex-col items-center py-2 rounded-xl transition ${
                              isUnavail ? "bg-gray-800/60 border border-gray-600/30" :
                              isSelected ? "bg-brand-600" :
                              isToday ? "bg-brand-950/40 border border-brand-700/30" : "bg-white/5 hover:bg-white/10"
                            }`}>
                            <div className={`text-[10px] ${isUnavail ? "text-gray-500" : isSelected || isToday ? "text-white/80" : "text-white/40"}`}>
                              {d.toLocaleDateString("en-US", { weekday: "narrow" })}
                            </div>
                            <div className={`text-sm font-bold leading-tight ${isUnavail ? "text-gray-500" : isSelected ? "text-white" : isToday ? "text-brand-400" : "text-white/70"}`}>
                              {d.getDate()}
                            </div>
                            <div className="w-1.5 h-1.5 mt-0.5">
                              {isUnavail ? <div className="w-1.5 h-1.5 rounded-full bg-gray-600" /> :
                               dayJobs.length > 0 && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-brand-400"}`} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {/* Jobs for selected day */}
                    <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                      <span>{new Date(calSelectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                      {calDayJobs.length > 0 && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{calDayJobs.length}</span>}
                    </div>
                    {calDayJobs.length === 0 ? (
                      <div className="text-center py-8 text-white/30 text-sm">No jobs scheduled</div>
                    ) : (
                      <div className="space-y-2">
                        {calDayJobs.map(j => {
                          const c = customers.find(x => x.id === j.customerId);
                          return (
                            <div key={j.id} className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                              <button onClick={() => setSelectedJobId(j.id)} className="w-full text-left p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{j.address}</div>
                                    {c && (
                          <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap">
                            <span>{c.firstName} {c.lastName}</span>
                            {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/80 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                          </div>
                        )}
                                  </div>
                                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 ${
                                    j.status === "completed" ? "bg-green-900/40 text-green-300" :
                                    j.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
                                    "bg-blue-900/40 text-blue-300"
                                  }`}>{(j.status || "").replace("_", " ")}</div>
                                </div>
                                {j.scheduledTime && <div className="text-xs text-white/40 mt-1">🕐 {j.scheduledTime}</div>}
                              </button>
                              <div className="px-3 pb-2 flex items-center gap-3 border-t border-white/5 pt-2">
                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(j.address)}`}
                                  target="_blank" rel="noreferrer"
                                  className="text-[10px] text-blue-400/70 hover:text-blue-300 flex items-center gap-1 transition">
                                  <Navigation size={9} />Directions
                                </a>
                                <a href={toGCalUrl(j)} target="_blank" rel="noreferrer"
                                  className="text-[10px] text-green-400/70 hover:text-green-300 flex items-center gap-1 transition">
                                  <Calendar size={9} />Add to Google Cal
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {calMode === "month" && (
                  <>
                    {/* Month navigation — prev/next buttons are also drag targets:
                        hovering while dragging a job for 500ms auto-advances the month */}
                    <div className="flex items-center justify-between mb-3">
                      <button
                        onClick={() => setCalMonthOffset(o => o - 1)}
                        onDragOver={e => {
                          e.preventDefault();
                          if (!calDragJobId) return;
                          if (!calMonthEdgeTimerRef.current) {
                            calMonthEdgeTimerRef.current = setTimeout(() => {
                              setCalMonthOffset(o => o - 1);
                              calMonthEdgeTimerRef.current = null;
                            }, 500);
                          }
                        }}
                        onDragLeave={() => { clearTimeout(calMonthEdgeTimerRef.current); calMonthEdgeTimerRef.current = null; }}
                        onDrop={() => { clearTimeout(calMonthEdgeTimerRef.current); calMonthEdgeTimerRef.current = null; }}
                        className={"p-2 rounded-lg text-white/50 hover:text-white transition " + (calDragJobId ? "hover:bg-blue-900/40 border border-dashed border-blue-700/40" : "hover:bg-white/10")}>
                        <ChevronLeft size={16} />
                      </button>
                      <div className="text-sm font-semibold">{calMonthLabel}</div>
                      <button
                        onClick={() => setCalMonthOffset(o => o + 1)}
                        onDragOver={e => {
                          e.preventDefault();
                          if (!calDragJobId) return;
                          if (!calMonthEdgeTimerRef.current) {
                            calMonthEdgeTimerRef.current = setTimeout(() => {
                              setCalMonthOffset(o => o + 1);
                              calMonthEdgeTimerRef.current = null;
                            }, 500);
                          }
                        }}
                        onDragLeave={() => { clearTimeout(calMonthEdgeTimerRef.current); calMonthEdgeTimerRef.current = null; }}
                        onDrop={() => { clearTimeout(calMonthEdgeTimerRef.current); calMonthEdgeTimerRef.current = null; }}
                        className={"p-2 rounded-lg text-white/50 hover:text-white transition " + (calDragJobId ? "hover:bg-blue-900/40 border border-dashed border-blue-700/40" : "hover:bg-white/10")}>
                        <ChevronRight size={16} />
                      </button>
                    </div>
                    {/* Day-of-week headers */}
                    <div className="grid grid-cols-7 gap-0.5 mb-1">
                      {["S","M","T","W","T","F","S"].map((d, i) => (
                        <div key={i} className="text-center text-[10px] text-white/30 font-semibold py-1">{d}</div>
                      ))}
                    </div>
                    {/* Month grid — day cells are drop targets when dragging a job */}
                    <div className="grid grid-cols-7 gap-0.5 mb-4">
                      {Array.from({ length: calFirstDay }, (_, i) => <div key={"e" + i} />)}
                      {Array.from({ length: calDaysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dateStr = `${calMonthYear}-${String(calMonthMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const dayJobs = calVisibleJobs.filter(j => j.scheduledDate === dateStr);
                        const isToday = dateStr === todayStr;
                        const isSelected = dateStr === calSelectedDate && !showAvailability;
                        // FEATURE 5 — recurring weekday off applies here too.
                        const isUnavail = availability.includes(dateStr) || recurringDaysOff.includes(new Date(calMonthYear, calMonthMonth, day).getDay());
                        return (
                          <button key={day}
                            onClick={() => showAvailability ? toggleAvailability(dateStr) : setCalSelectedDate(dateStr)}
                            onDragOver={e => { if (calDragJobId) e.preventDefault(); }}
                            onDrop={e => {
                              e.preventDefault();
                              if (!calDragJobId) return;
                              updateJob(calDragJobId, { scheduledDate: dateStr });
                              setCalDragJobId(null);
                              setCalSelectedDate(dateStr);
                              toast("Job moved to " + new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }));
                            }}
                            className={`flex flex-col items-center py-1.5 rounded-lg transition min-h-[44px] ${
                              calDragJobId ? "cursor-copy" : ""
                            } ${
                              isUnavail ? "bg-gray-800/60 border border-gray-600/30" :
                              isSelected ? "bg-brand-600" :
                              isToday ? "bg-brand-950/50 border border-brand-700/30" : "hover:bg-white/8"
                            }`}>
                            <div className={`text-sm font-semibold ${
                              isUnavail ? "text-gray-500" : isSelected ? "text-white" : isToday ? "text-brand-400" : "text-white/60"
                            }`}>
                              {day}
                            </div>
                            {isUnavail ? (
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                            ) : dayJobs.length > 0 ? (
                              <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-brand-400"}`} />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    {/* Jobs for selected day — draggable + right-click context menu */}
                    <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2 flex items-center gap-2">
                      <span>{new Date(calSelectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                      {calDayJobs.length > 0 && <span className="px-2 py-0.5 rounded-full bg-white/10 text-white/60">{calDayJobs.length}</span>}
                      {calDragJobId && <span className="text-[10px] text-blue-300 animate-pulse">Drop on a date to reschedule</span>}
                    </div>
                    {calDayJobs.length === 0 ? (
                      <div className="text-center py-6 text-white/30 text-sm">No jobs this day</div>
                    ) : (
                      <div className="space-y-2">
                        {calDayJobs.map(j => {
                          const c = customers.find(x => x.id === j.customerId);
                          return (
                            <div key={j.id}
                              draggable
                              onDragStart={() => setCalDragJobId(j.id)}
                              onDragEnd={() => setCalDragJobId(null)}
                              onContextMenu={e => {
                                e.preventDefault();
                                setCalCtxMenu({ jobId: j.id, x: e.clientX, y: e.clientY });
                              }}
                              className={"rounded-xl border overflow-hidden transition cursor-grab active:cursor-grabbing " + (calDragJobId === j.id ? "opacity-50 border-blue-600/60 bg-blue-950/20" : "bg-white/5 border-white/10")}>
                              <button onClick={() => setSelectedJobId(j.id)} className="w-full text-left p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-sm truncate">{j.address}</div>
                                    {c && (
                                      <div className="text-xs text-white/50 flex items-center gap-2 flex-wrap">
                                        <span>{c.firstName} {c.lastName}</span>
                                        {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/80 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                                      </div>
                                    )}
                                  </div>
                                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase flex-shrink-0 ${
                                    j.status === "completed" ? "bg-green-900/40 text-green-300" :
                                    j.status === "in_progress" ? "bg-yellow-900/40 text-yellow-300" :
                                    "bg-blue-900/40 text-blue-300"
                                  }`}>{(j.status || "").replace("_", " ")}</div>
                                </div>
                                {j.scheduledTime && <div className="text-xs text-white/40 mt-0.5">🕐 {j.scheduledTime}</div>}
                              </button>
                              <div className="px-3 pb-2 flex items-center gap-3 border-t border-white/5 pt-2">
                                <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(j.address)}`}
                                  target="_blank" rel="noreferrer"
                                  className="text-[10px] text-blue-400/70 hover:text-blue-300 flex items-center gap-1 transition">
                                  <Navigation size={9} />Directions
                                </a>
                                <a href={toGCalUrl(j)} target="_blank" rel="noreferrer"
                                  className="text-[10px] text-green-400/70 hover:text-green-300 flex items-center gap-1 transition">
                                  <Calendar size={9} />Add to Google Cal
                                </a>
                                <span className="text-[10px] text-white/20 ml-auto">drag to reschedule</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Right-click context menu — positioned at click coords, not at bottom of page */}
                    {calCtxMenu && (() => {
                      const ctxJob = myJobs.find(j => j.id === calCtxMenu.jobId);
                      if (!ctxJob) return null;
                      return (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setCalCtxMenu(null)} />
                          <div
                            className="fixed z-50 w-48 rounded-xl bg-black/95 border border-white/15 shadow-2xl overflow-hidden"
                            style={{ left: Math.min(calCtxMenu.x, window.innerWidth - 200), top: Math.min(calCtxMenu.y, window.innerHeight - 200) }}>
                            <div className="px-3 py-2 border-b border-white/10">
                              <div className="text-[11px] font-semibold text-white/80 truncate">{ctxJob.address}</div>
                              <div className="text-[10px] text-white/40">{ctxJob.scheduledDate}</div>
                              {/* ISSUE 9 (round 11) — tapping a completed job on this
                                  calendar used to only ever show address/date here — no
                                  hours, no earnings, no paid status, even though the job
                                  itself already has all of it (loggedHours, getEffectiveRate,
                                  employees.paidJobs). "Says completed but shows nothing" was
                                  literally true for this popup specifically. */}
                              {ctxJob.status === "completed" && (
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-300">
                                    {Number(ctxJob.loggedHours) || 0}h
                                  </span>
                                  {!(settings as any)?.hideJobAmountsFromEmployees && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-900/40 text-green-300">
                                      {fmt(Number(ctxJob.loggedHours || 0) * getEffectiveRate(myEmployee, ctxJob))}
                                    </span>
                                  )}
                                  <span className={"text-[10px] font-bold px-1.5 py-0.5 rounded-full " + (((myEmployee as any)?.paidJobs?.[ctxJob.id] === "paid") ? "bg-green-900/40 text-green-300" : "bg-yellow-900/30 text-yellow-300")}>
                                    {(myEmployee as any)?.paidJobs?.[ctxJob.id] === "paid" ? "Paid" : "Pending"}
                                  </span>
                                </div>
                              )}
                            </div>
                            <button onClick={() => { setSelectedJobId(calCtxMenu.jobId); setCalCtxMenu(null); }}
                              className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition flex items-center gap-2">
                              <ChevronRight size={12} />View Details
                            </button>
                            <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ctxJob.address)}`}
                              target="_blank" rel="noreferrer"
                              onClick={() => setCalCtxMenu(null)}
                              className="block px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition flex items-center gap-2">
                              <Navigation size={12} />Navigate
                            </a>
                            <a href={toGCalUrl(ctxJob)} target="_blank" rel="noreferrer"
                              onClick={() => setCalCtxMenu(null)}
                              className="block px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition flex items-center gap-2">
                              <Calendar size={12} />Add to Google Cal
                            </a>
                            {!ctxJob.arrivedAt && ctxJob.status !== "completed" && (
                              <button onClick={() => {
                                // FIX — this used to only set arrivedAt, never
                                // flipping status to "in_progress" like every
                                // other "arrive" path in this file does (see
                                // the main job card / "I'm Here" button). A
                                // job marked arrived here stayed "scheduled"
                                // forever, so it never showed as in-progress
                                // on the owner's Dashboard/Live Team View.
                                updateJob(calCtxMenu.jobId, { arrivedAt: Date.now(), status: ctxJob.status === "scheduled" ? "in_progress" : ctxJob.status });
                                toast("Marked as arrived ✓");
                                setCalCtxMenu(null);
                              }} className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white transition flex items-center gap-2">
                                <MapPin size={12} />Mark Arrived
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </>
            );
          })()}

          {/* All Jobs tab — grouped by date */}
          {tab === "jobs" && (() => {
            const jwEnd = (() => { const d = new Date(); d.setDate(d.getDate() + (6 - d.getDay())); return d.toISOString().slice(0, 10); })();
            // Apply status filter first, then search text
            const statusFiltered = myJobs.filter(j => {
              if (j.status === "cancelled" && !showCanceledJobs) return false;
              // BUG FIX — this only checked status, not date, so a job whose
              // date came and went without anyone marking it completed/no-
              // show/cancelled (status stuck at "scheduled") still showed up
              // under the "Upcoming" tab — worse, the grouping logic just
              // below classifies anything with scheduledDate < today into
              // "Past / Completed" regardless of this filter, so it visibly
              // showed a PAST job inside a section literally being viewed
              // via the "Upcoming" button. Require a present/future date too
              // — a genuinely overdue-but-still-scheduled job now only shows
              // under "All" (grouped correctly under Past/Completed there).
              if (jobsStatusFilter === "scheduled") return (j.status === "scheduled" || j.status === ("active" as any)) && j.scheduledDate >= todayStr;
              // "Today" — every job scheduled today, whatever its status
              // (scheduled/in_progress/completed), plus anything actively
              // in_progress right now even if it was scheduled a different
              // day (matches the owner Dashboard's own "Today" card fix).
              if (jobsStatusFilter === "today") return j.scheduledDate === todayStr || j.status === "in_progress";
              if (jobsStatusFilter === "completed") return j.status === "completed";
              return true;
            });
            const searchLower = jobsSearchText.trim().toLowerCase();
            const visibleJobs = searchLower
              ? statusFiltered.filter(j => {
                  const cust = customers.find((c: any) => c.id === j.customerId);
                  const custName = cust ? (cust.firstName + " " + cust.lastName).toLowerCase() : "";
                  return custName.includes(searchLower) || (j.address || "").toLowerCase().includes(searchLower) || (j.scheduledDate || "").includes(searchLower);
                })
              : statusFiltered;
            const canceledCount = myJobs.filter(j => j.status === "cancelled").length;
            const activeGrp  = visibleJobs.filter(j => !!j.clockInAt);
            const todayGrp   = visibleJobs.filter(j => !j.clockInAt && j.scheduledDate === todayStr && j.status !== "completed");
            const weekGrp    = visibleJobs.filter(j => !j.clockInAt && j.scheduledDate > todayStr && j.scheduledDate <= jwEnd);
            const upcomingGrp = visibleJobs.filter(j => !j.clockInAt && j.scheduledDate > jwEnd);
            const earlierGrp = visibleJobs.filter(j => !j.clockInAt && (j.scheduledDate < todayStr || j.status === "completed"));

            const Group = ({ label, jobs: grpJobs, collapsed, onToggle }: { label: string; jobs: typeof myJobs; collapsed?: boolean; onToggle?: () => void }) => {
              if (grpJobs.length === 0) return null;
              return (
                <div>
                  <button
                    onClick={onToggle}
                    className={"w-full text-xs text-white/40 uppercase tracking-widest font-bold mb-2 flex items-center gap-2 " + (onToggle ? "cursor-pointer hover:text-white/60" : "")}
                  >
                    <span>{label}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 font-normal">{grpJobs.length}</span>
                    {onToggle && <ChevronRight size={12} className={"transition-transform " + (collapsed ? "" : "rotate-90")} />}
                  </button>
                  {!collapsed && <div className="space-y-2">{grpJobs.map(j => <JobCard key={j.id} job={j} />)}</div>}
                </div>
              );
            };

            return (
              <div className="space-y-4">
                {/* Filter + search row */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    {([["all", "All"], ["scheduled", "Upcoming"], ["today", "Today"], ["completed", "Completed"]] as const).map(([k, l]) => (
                      <button key={k} onClick={() => setJobsStatusFilter(k)}
                        className={"px-3 py-1.5 rounded-lg text-xs font-medium transition flex-1 " + (jobsStatusFilter === k ? "bg-brand-700/60 text-brand-fg" : "bg-black/40 border border-white/10 text-white/50 hover:text-white")}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <input
                      value={jobsSearchText}
                      onChange={e => setJobsSearchText(e.target.value)}
                      placeholder="Search by customer, address, or date…"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand-600/40"
                    />
                    {jobsSearchText && (
                      <button onClick={() => setJobsSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Route button — optimize today's stops (FEATURE 2) */}
                {todayJobs.filter(j => j.status !== "completed" && j.address).length >= 1 && (
                  <button onClick={optimizeRoute} disabled={routeLoading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/40 text-blue-300 text-sm font-semibold transition disabled:opacity-40">
                    <Route size={15} />{routeLoading ? "Optimizing route…" : "Route Today's Jobs"}
                  </button>
                )}
                {canceledCount > 0 && jobsStatusFilter === "all" && (
                  <button onClick={() => setShowCanceledJobs(v => !v)} className={"w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-medium transition " + (showCanceledJobs ? "bg-brand-950/20 border-brand-700/40 text-brand-300" : "bg-black/30 border-white/10 text-white/40 hover:text-white/60")}>
                    {showCanceledJobs ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {showCanceledJobs ? `Showing ${canceledCount} canceled job${canceledCount !== 1 ? "s" : ""}` : `Show Canceled (${canceledCount})`}
                  </button>
                )}
                {myJobs.length === 0 ? (
                  <div className="text-center py-14 text-white/30 px-4">
                    <Briefcase size={36} className="mx-auto mb-3 opacity-20" />
                    <div className="font-semibold text-white/40 mb-1">No jobs assigned yet</div>
                    <div className="text-sm leading-relaxed">When your manager assigns you to a job, it will appear here.</div>
                  </div>
                ) : visibleJobs.length === 0 ? (
                  <div className="text-center py-10 text-white/30 text-sm">No jobs match this filter.</div>
                ) : (
                  <>
                    <Group label="Active" jobs={activeGrp} />
                    {/* BUG FIX (user report) — "sort jobs on the employee
                        portal from soonest to farthest for the day... make
                        sure there's a Today section... it should show from
                        soonest to latest." Today had no sort at all (whatever
                        order myJobs happened to be in); This Week/Upcoming
                        only sorted by date, so same-day jobs weren't ordered
                        by time either. Untimed jobs (scheduledTime "") sort
                        to the end of their day, same convention already used
                        elsewhere in this file (e.g. findNextJob). */}
                    <Group label="Today" jobs={[...todayGrp].sort((a, b) => (a.scheduledTime || "23:59").localeCompare(b.scheduledTime || "23:59"))} />
                    <Group label="This Week" jobs={[...weekGrp].sort((a, b) => (a.scheduledDate + (a.scheduledTime || "23:59")).localeCompare(b.scheduledDate + (b.scheduledTime || "23:59")))} />
                    <Group label="Upcoming" jobs={[...upcomingGrp].sort((a, b) => (a.scheduledDate + (a.scheduledTime || "23:59")).localeCompare(b.scheduledDate + (b.scheduledTime || "23:59")))} collapsed={upcomingCollapsed} onToggle={() => setUpcomingCollapsed(c => !c)} />
                    <Group label="Past / Completed" jobs={earlierGrp.sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate))} collapsed={pastCollapsed} onToggle={() => setPastCollapsed(c => !c)} />
                  </>
                )}
              </div>
            );
          })()}

          {/* Pay tab */}
          {tab === "pay" && (() => {
            // AUDIT FIX (Pay tab missing hours) — a completed job can carry
            // scheduledDate: "" (unscheduled jobs are a real, deliberately-
            // used state elsewhere in this codebase — see EstimatesPage.tsx/
            // App.tsx). Every period/day/chart bucket below used to filter
            // strictly on job.scheduledDate, so a completed job with real
            // loggedHours but no scheduledDate silently never appeared
            // ANYWHERE in the Pay tab. Falls back to completedAt (the date it
            // was actually finished) so its hours land somewhere sensible
            // instead of vanishing.
            const jobDateKey = (j: any): string => j.scheduledDate || (j.completedAt ? String(j.completedAt).slice(0, 10) : "");
            // Build pay period history (14-day periods going back 3 months)
            const periods: Array<{ label: string; start: string; end: string; hours: number; pay: number; jobs: number; jobsList: any[] }> = [];
            const now = new Date();
            for (let i = 0; i < 6; i++) {
              // ISSUE 2 — fixed-anchor periods (see getPayPeriodBounds) so this
              // can never disagree with the owner's own "current period" or
              // with itself on a later reload — see that function's comment.
              const { start: s, end: e } = getPayPeriodBounds(now, i);
              const start = new Date(s + "T00:00:00");
              const end = new Date(e + "T00:00:00");
              const pJobs = myJobs.filter(j => jobDateKey(j) >= s && jobDateKey(j) <= e);
              // FIX 5 (mobile round 3) — this used to only count job.loggedHours,
              // missing the shift-timer top-up (ended OR still-in-progress)
              // that the Today tab's widget already includes — so an employee
              // whose hours came mostly from the whole-day shift timer instead
              // of completed jobs saw $0 here even though Today showed hours.
              const hrs = pJobs.reduce((acc, j) => acc + Number(j.loggedHours || 0), 0) + computeEmployeeShiftTopUp(s, e);
              periods.push({
                label: i === 0 ? "Current Period" : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
                start: s, end: e,
                hours: Math.round(hrs * 10) / 10,
                pay: Math.round(hrs * (myEmployee?.hourlyRate || 0) * 100) / 100,
                jobs: pJobs.filter(j => j.status === "completed").length,
                // ITEM 17 — per-job breakdown for this period, so the owner's
                // aggregate hours/pay total (which was the only thing shown
                // before) can be expanded into what it's actually made of.
                jobsList: pJobs.filter(j => j.status === "completed" && Number(j.loggedHours) > 0)
                  .map(j => ({ id: j.id, address: j.address, date: jobDateKey(j), hours: Number(j.loggedHours) || 0, pay: Math.round((Number(j.loggedHours) || 0) * (myEmployee?.hourlyRate || 0) * 100) / 100 })),
              });
            }
            const current = periods[0];
            const lastClosed = periods[1];
            const expectedHours = 80; // typical 2-week period
            const TAX_RATE = 0.20;
            const takeHome = Math.round(current.pay * (1 - TAX_RATE) * 100) / 100;
            // FIX 5 — "where does the Pay tab fetch hours from": the jobs
            // table (via the `jobs` prop, polled from Supabase by App.tsx,
            // filtered here to this employee's crew) for loggedHours, plus
            // this employee's own dayClockInAt/lastShiftHours (via the
            // `employees` prop) for the shift-timer top-up. No separate
            // Supabase query happens in this component — it all reads
            // already-fetched, live-polled parent state.

            // Outstanding balance — ONLY the owner marks individual 14-day pay
            // periods as paid/unpaid (Employees → Pay — see EmployeesPage.tsx's
            // "Mark as Paid"), keyed by each period's start date in
            // paidPeriods. Anything not explicitly marked paid counts as
            // pending. Read-only here — no employee-side write path.
            const paidPeriodsMap: Record<string, "paid" | "unpaid"> = (myEmployee as any)?.paidPeriods || {};
            const periodsWithStatus = periods.filter(p => p.pay > 0).map(p => ({ ...p, status: paidPeriodsMap[p.start] || "unpaid" }));
            const totalPaid = Math.round(periodsWithStatus.filter(p => p.status === "paid").reduce((s, p) => s + p.pay, 0) * 100) / 100;
            const pendingPay = Math.round(periodsWithStatus.filter(p => p.status === "unpaid").reduce((s, p) => s + p.pay, 0) * 100) / 100;
            const pendingHours = Math.round(periodsWithStatus.filter(p => p.status === "unpaid").reduce((s, p) => s + p.hours, 0) * 10) / 10;

            // Year-to-date + prior-year earnings, bucketed by the calendar year
            // each job's logged hours fall in — same hrs × rate math as the pay
            // periods above, just rolled up annually for tax purposes.
            const earningsByYear: Record<string, number> = {};
            myJobs.forEach(j => {
              const dk = jobDateKey(j);
              if (!dk || !Number(j.loggedHours)) return;
              const yr = dk.slice(0, 4);
              earningsByYear[yr] = (earningsByYear[yr] || 0) + Number(j.loggedHours) * (myEmployee?.hourlyRate || 0);
            });
            const thisYear = String(new Date().getFullYear());
            const ytdGross = Math.round((earningsByYear[thisYear] || 0) * 100) / 100;
            const priorYears = Object.keys(earningsByYear).filter(y => y !== thisYear).sort((a, b) => b.localeCompare(a));

            // Simplified estimator — SE-style 15.3% + a federal-bracket approximation,
            // same shape as the owner's business tax estimate. Real withholding
            // depends on W-4 elections; this is a ballpark, not payroll advice.
            const seRateEst = 0.153;
            const fedRateEst = ytdGross > 89075 ? 0.24 : ytdGross > 41775 ? 0.22 : ytdGross > 11000 ? 0.12 : 0.10;
            const estAnnualTax = Math.round(ytdGross * (seRateEst + fedRateEst) * 100) / 100;
            const estAnnualTakeHome = Math.round((ytdGross - estAnnualTax) * 100) / 100;

            const downloadTaxPdf = () => {
              const periodRows = periods.filter(p => p.pay > 0).map(p => `<tr><td>${p.label}</td><td>${p.start} — ${p.end}</td><td class="r">${p.hours}</td><td class="r">$${p.pay.toFixed(2)}</td></tr>`).join("");
              const priorRows = priorYears.map(y => `<tr><td>${y}</td><td class="r">$${earningsByYear[y].toFixed(2)}</td></tr>`).join("");
              const empName = `${myEmployee?.firstName || ""} ${myEmployee?.lastName || ""}`.trim() || "Employee";
              const html = `<!DOCTYPE html><html><head><title>Tax Summary — ${empName}</title>
              <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:900px;margin:auto;font-size:13px}
              h1{color:#111111;font-size:24px}h2{color:#333;font-size:16px;border-bottom:2px solid #111111;padding-bottom:6px;margin:24px 0 12px}
              .header{display:flex;justify-content:space-between;align-items:start;border-bottom:3px solid #111111;padding-bottom:16px;margin-bottom:24px}
              .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px}
              .kpi{background:#f9f9f9;padding:16px;border-radius:8px;border:1px solid #eee}
              .kpi label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#888}
              .kpi .val{font-size:20px;font-weight:bold;color:#111111;margin-top:4px}
              table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px}
              th{background:#f0f0f0;padding:8px 10px;text-align:left;border-bottom:2px solid #ccc;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
              td{padding:7px 10px;border-bottom:1px solid #eee}.r{text-align:right}
              .total-row{background:#f5f5f5;font-weight:bold;color:#111111}
              .disclaimer{margin-top:32px;padding:12px;background:#fffbf0;border:1px solid #f0c040;border-radius:6px;font-size:11px;color:#555}
              @media print{body{padding:20px}}</style></head><body>
              <div class="header">
                <div><h1>${settings.companyName || "CRM Starter"}</h1><p style="color:#666;margin-top:4px">Employee Tax Summary — ${empName} · ${thisYear} · Generated ${localDateStr()}</p></div>
              </div>
              <div class="kpis">
                <div class="kpi"><label>YTD Gross Earnings</label><div class="val">$${ytdGross.toFixed(2)}</div></div>
                <div class="kpi"><label>Est. Tax (Fed + SE)</label><div class="val">$${estAnnualTax.toFixed(2)}</div></div>
                <div class="kpi"><label>Est. Take-Home</label><div class="val">$${estAnnualTakeHome.toFixed(2)}</div></div>
              </div>
              <h2>Pay Period Breakdown (${thisYear})</h2>
              <table><thead><tr><th>Period</th><th>Dates</th><th class="r">Hours</th><th class="r">Gross Pay</th></tr></thead>
              <tbody>${periodRows || `<tr><td colspan="4">No pay periods logged yet</td></tr>`}<tr class="total-row"><td colspan="3">YTD Total</td><td class="r">$${ytdGross.toFixed(2)}</td></tr></tbody></table>
              ${priorYears.length ? `<h2>Previous Tax Years</h2><table><thead><tr><th>Year</th><th class="r">Gross Earnings</th></tr></thead><tbody>${priorRows}</tbody></table>` : ""}
              <div class="disclaimer">⚠️ <strong>Disclaimer:</strong> This is a simplified estimate for personal planning only and is not tax advice. Your actual withholding and liability depend on your filing status, W-4 elections, and other income. Consult a qualified tax professional.</div>
              <script>window.onload=()=>setTimeout(window.print,400)</script></body></html>`;
              const w = window.open("", "_blank");
              if (w) { w.document.write(html); w.document.close(); }
              toast("Tax summary opened — save as PDF");
            };

            return (
              <>
                {/* AUDIT FIX — moved to the top of the Pay tab per owner
                    request; was previously the last thing in this tab. */}
                <Glass className="p-4 !bg-black/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-white/50 uppercase tracking-wider">Log Mileage</div>
                    <button onClick={autoEstimateMileage} disabled={mileageEstimating}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-blue-950/30 hover:bg-blue-900/40 border border-blue-700/30 text-blue-300 hover:text-blue-200 transition disabled:opacity-50">
                      {mileageEstimating ? "Estimating…" : "🧭 Auto-Estimate"}
                    </button>
                  </div>
                  {/* ISSUE 16 (round 4) — GPS auto-tracking status + one-tap
                      fill, distinct from the Maps-based Auto-Estimate above
                      (that one looks up job addresses; this one is the
                      phone's actual measured movement today). */}
                  {autoMileageEnabled && dayTrackedMiles > 0 && (
                    <div className="flex items-center justify-between gap-2 mb-2 px-2.5 py-1.5 rounded-lg bg-green-950/20 border border-green-800/30">
                      <span className="text-[10px] text-green-300">📍 {dayTrackedMiles.toFixed(1)} mi tracked automatically today</span>
                      {/* FIX — this only silently filled the Miles field below
                          with no toast/confirmation at all (every user-facing
                          action needs one — see docs/ARCHITECTURE.md). On a phone, where
                          the Miles input can be a screen-height away or the
                          keyboard/viewport is already scrolled, tapping this
                          gave no visible sign anything happened, which reads
                          as "the button doesn't work" even though the state
                          update itself was landing fine. */}
                      <button onClick={() => { setMileageForm(f => ({ ...f, miles: dayTrackedMiles.toFixed(1) })); toast("Filled in " + dayTrackedMiles.toFixed(1) + " mi below — tap Log Mileage to save it", "green"); }} className="text-[9px] font-semibold px-3 py-1.5 rounded bg-green-800/50 hover:bg-green-700/60 text-white flex-shrink-0">Use this</button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <GDate value={mileageForm.date} onChange={(e: any) => setMileageForm(f => ({ ...f, date: e.target.value }))} className="!text-xs !py-2" />
                    <GInput type="number" min="0" step="0.1" placeholder="Miles" value={mileageForm.miles} onChange={(e: any) => setMileageForm(f => ({ ...f, miles: e.target.value }))} className="!text-xs !py-2" />
                    <GInput placeholder="From" value={mileageForm.from} onChange={(e: any) => setMileageForm(f => ({ ...f, from: e.target.value }))} className="!text-xs !py-2" />
                    <GInput placeholder="To" value={mileageForm.to} onChange={(e: any) => setMileageForm(f => ({ ...f, to: e.target.value }))} className="!text-xs !py-2" />
                  </div>
                  <div className="text-[10px] text-white/30 mb-2">Auto-Estimate uses your home base address (or that day's first job) through your last job of the day, via Google Maps. {autoMileageEnabled ? "GPS auto-tracking runs in the background while you're clocked in on this device." : "GPS auto-tracking is off — enable it in Settings."}</div>
                  <GInput placeholder="Purpose (optional)" value={mileageForm.purpose} onChange={(e: any) => setMileageForm(f => ({ ...f, purpose: e.target.value }))} className="!text-xs !py-2 mb-2" />
                  <GBtn onClick={submitMileageLog} disabled={mileageSubmitting} className="w-full !text-xs">{mileageSubmitting ? "Saving…" : "Log Mileage"}</GBtn>
                  {mileageLogs.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                      {mileageLogs.slice(0, 8).map((m: any) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="min-w-0 truncate text-white/60">{m.date} · {m.from || "—"} → {m.to || "—"} · {m.miles}mi</div>
                          <span className={"px-2 py-0.5 rounded-full text-[9px] font-bold flex-shrink-0 " + (m.status === "approved" ? "bg-green-700 text-white" : m.status === "denied" ? "bg-danger-900/50 text-danger-300" : "bg-yellow-950/40 border border-yellow-700/40 text-yellow-300")}>{m.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Glass>

                <Glass className="p-5 !bg-gradient-to-br !from-green-950/30 !to-black/60 !border-green-700/30">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Current Pay Rate</div>
                      <div className="text-3xl font-black text-green-400">{fmt(myEmployee?.hourlyRate || 0)}<span className="text-base font-normal text-white/50">/hr</span></div>
                      <div className="text-xs text-white/40 mt-1 capitalize">{myEmployee?.role}</div>
                    </div>
                    {typeof (myEmployee as any)?.ratingScore === "number" && (
                      <div className="text-right">
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">Rating</div>
                        <div className="text-xl font-black text-yellow-400">{(myEmployee as any).ratingScore}<span className="text-xs text-white/40">/100</span></div>
                      </div>
                    )}
                  </div>
                </Glass>

                <Glass className="p-4 !bg-black/40">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-2">This Pay Period</div>
                  <div className="flex justify-between text-[11px] text-white/40 mb-1">
                    <span>{current.hours}h worked</span>
                    <span>{expectedHours}h expected</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden mb-3">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: Math.min(100, current.hours / expectedHours * 100) + "%" }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 rounded-xl bg-green-950/20 border border-green-700/20">
                      <div className="text-[10px] text-white/40 uppercase">Estimated Gross</div>
                      <div className="text-xl font-black text-green-400">{fmt(current.pay)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-white/40 uppercase flex items-center gap-1">Est. Take-Home <span className="text-white/25">(after ~20% tax)</span></div>
                      <div className="text-xl font-black text-white/80">{fmt(takeHome)}</div>
                    </div>
                  </div>
                </Glass>

                {/* Outstanding balance — clear paid vs pending separation */}
                <Glass className="p-4 !bg-black/40">
                  <div className="text-xs text-white/50 uppercase tracking-wider mb-3">Outstanding Balance</div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="p-3 rounded-xl bg-yellow-950/20 border border-yellow-700/30">
                      <div className="text-[10px] text-yellow-400/70 uppercase">Pending Pay</div>
                      <div className="text-xl font-black text-yellow-400">{fmt(pendingPay)}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{pendingHours}h across unpaid periods</div>
                    </div>
                    <div className="p-3 rounded-xl bg-green-950/20 border border-green-700/30">
                      <div className="text-[10px] text-green-400/70 uppercase">Total Paid</div>
                      <div className="text-xl font-black text-green-400">{fmt(totalPaid)}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{periodsWithStatus.some(p => p.status === "paid") ? `${periodsWithStatus.filter(p => p.status === "paid").length} period${periodsWithStatus.filter(p => p.status === "paid").length !== 1 ? "s" : ""} marked paid` : "Not marked paid yet"}</div>
                    </div>
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {periodsWithStatus.map(p => (
                      <div key={p.start} className="rounded-lg bg-white/5 overflow-hidden">
                        <button onClick={() => setExpandedPayPeriod(prev => prev === p.start ? null : p.start)} className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left">
                          <span className="text-[10px] text-white/50 flex items-center gap-1.5">
                            <ChevronRight size={10} className={"transition-transform " + (expandedPayPeriod === p.start ? "rotate-90" : "")} />
                            {p.label} <span className="text-white/30">({p.jobsList.length} job{p.jobsList.length !== 1 ? "s" : ""})</span>
                          </span>
                          {/* ISSUE 5 (round 11) reversed, paid-direction only
                              (see markPeriodPaidByEmployee's own comment) —
                              an employee can confirm they were paid, which
                              notifies the owner and can only be reversed by
                              the owner, never re-marked unpaid from here. */}
                          {p.status === "paid" ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-900/40 text-green-300">Paid</span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); markPeriodPaidByEmployee(p); }}
                              disabled={markingPeriodPaid === p.start}
                              title="Confirm you received payment for this period — notifies the owner"
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-300 hover:bg-yellow-800/40 transition disabled:opacity-50"
                            >
                              {markingPeriodPaid === p.start ? "Confirming…" : "Mark Paid"}
                            </button>
                          )}
                        </button>
                        {/* ITEM 17 — per-job breakdown, expandable, instead of
                            only ever showing the period's combined total. */}
                        {expandedPayPeriod === p.start && (
                          <div className="px-2.5 pb-2 space-y-1">
                            {p.jobsList.length === 0 ? (
                              <div className="text-[10px] text-white/30 py-1">No individual jobs logged this period</div>
                            ) : p.jobsList.map(jb => (
                              <div key={jb.id} className="flex items-center justify-between text-[10px] text-white/50 px-1.5 py-1 rounded bg-black/30">
                                <span className="truncate flex-1">{jb.date} · {jb.address || "Job"}</span>
                                <span className="flex-shrink-0 ml-2">{jb.hours}h · {fmt(jb.pay)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {lastClosed && lastClosed.pay > 0 && (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div>
                        <div className="text-[10px] text-white/40 uppercase">Last Pay Period</div>
                        <div className="text-xs text-white/50">{lastClosed.start} — {lastClosed.end}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-white/70">{fmt(lastClosed.pay)}</div>
                        <div className="text-[10px] text-white/30">{lastClosed.hours}h · assumed paid</div>
                      </div>
                    </div>
                  )}
                </Glass>

                {/* FIX 3 — daily calendar view: every day this month with logged
                    hours, its earnings (respecting per-job-type rate overrides via
                    getEffectiveRate), and an individually-markable paid/unpaid
                    status — separate from the 14-day period marking above. */}
                {(() => {
                  const calBase = new Date();
                  calBase.setMonth(calBase.getMonth() + payCalMonthOffset, 1);
                  const year = calBase.getFullYear(), month = calBase.getMonth();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const firstDow = new Date(year, month, 1).getDay();
                  // ISSUE 5 (round 11) — read-only status; only the owner's
                  // own "Mark as Paid" (EmployeesPage.tsx) writes paidDays.
                  const paidDaysMap: Record<string, "paid" | "unpaid"> = (myEmployee as any)?.paidDays || {};
                  type DayCell = { key: string; day: number; hours: number; pay: number; status: "paid" | "unpaid"; jobCount: number; hasScheduled: boolean };
                  const dayCells: Array<DayCell | null> = [];
                  for (let i = 0; i < firstDow; i++) dayCells.push(null);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    const allDayJobs = myJobs.filter(j => jobDateKey(j) === key);
                    const loggedJobs = allDayJobs.filter(j => Number(j.loggedHours) > 0);
                    const hours = Math.round(loggedJobs.reduce((s, j) => s + Number(j.loggedHours || 0), 0) * 100) / 100;
                    const pay = Math.round(loggedJobs.reduce((s, j) => s + Number(j.loggedHours || 0) * getEffectiveRate(myEmployee, j), 0) * 100) / 100;
                    const hasScheduled = allDayJobs.some(j => j.status === "scheduled" || j.status === "completed");
                    dayCells.push({ key, day: d, hours, pay, status: paidDaysMap[key] || "unpaid", jobCount: allDayJobs.length, hasScheduled });
                  }
                  const monthLabel = calBase.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                  const monthTotal = dayCells.reduce((s, c) => s + (c?.pay || 0), 0);
                  const selectedDayJobs = selectedCalDay ? myJobs.filter(j => jobDateKey(j) === selectedCalDay) : [];
                  return (
                    <Glass className="p-4 !bg-black/40">
                      <div className="flex items-center justify-between mb-3">
                        <button onClick={() => setPayCalMonthOffset(o => o - 1)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50"><ChevronLeft size={14} /></button>
                        <div className="text-xs font-semibold text-white/70">{monthLabel}</div>
                        <button onClick={() => setPayCalMonthOffset(o => Math.min(0, o + 1))} disabled={payCalMonthOffset >= 0} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 disabled:opacity-30"><ChevronRight size={14} /></button>
                      </div>
                      <div className="grid grid-cols-7 gap-1 text-center mb-1">
                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="text-[9px] text-white/30 font-semibold">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {dayCells.map((c, i) => c === null ? <div key={i} /> : (
                          <button
                            key={i}
                            // ISSUE 5 (round 11) — tapping a worked day used to
                            // call markDayPaid (toggle paid/unpaid) directly;
                            // now it only ever opens the day's job detail
                            // panel below — status is view-only, set solely by
                            // the owner's own Mark as Paid.
                            onClick={() => {
                              if (c.hours > 0 || c.hasScheduled) setSelectedCalDay(selectedCalDay === c.key ? null : c.key);
                            }}
                            disabled={!c.hasScheduled && c.hours === 0}
                            className={"aspect-square rounded-lg text-[9px] flex flex-col items-center justify-center gap-0.5 transition " +
                              (c.hours > 0
                                ? (c.status === "paid" ? "bg-green-900/40 border border-green-600/40 text-green-300 hover:bg-green-800/40" : "bg-yellow-950/30 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/40")
                                : c.hasScheduled
                                  ? "bg-blue-950/30 border border-blue-700/30 text-blue-300 hover:bg-blue-900/30"
                                  : "text-white/20")}
                            title={c.hours > 0 ? `${c.hours}h · ${fmt(c.pay)} · ${c.status === "paid" ? "Paid" : "Pending — waiting on the owner to mark this paid"} — tap for details` : c.hasScheduled ? `${c.jobCount} job${c.jobCount !== 1 ? "s" : ""} scheduled — tap for details` : undefined}
                          >
                            <span className="font-semibold">{c.day}</span>
                            {c.hours > 0 ? <span>{c.hours}h</span> : c.hasScheduled ? <span className="w-1 h-1 rounded-full bg-blue-400 mx-auto" /> : null}
                          </button>
                        ))}
                      </div>
                      {/* Selected day detail panel */}
                      {selectedCalDay && selectedDayJobs.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                          <div className="text-[10px] text-white/40 uppercase tracking-wider">{selectedCalDay}</div>
                          {selectedDayJobs.map(j => {
                            const c = customers.find(x => x.id === j.customerId);
                            return (
                              <div key={j.id} className="flex items-center justify-between gap-2 text-[11px] bg-black/30 rounded-lg px-2.5 py-1.5">
                                <div className="min-w-0">
                                  <div className="text-white/70 truncate">{j.address}</div>
                                  {c && <div className="text-white/40">{c.firstName} {c.lastName}</div>}
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className={"text-[10px] font-bold px-2 py-0.5 rounded-full " + (j.status === "completed" ? "bg-green-900/40 text-green-300" : "bg-blue-900/40 text-blue-300")}>{j.status}</div>
                                  {/* ISSUE 14/15 (round 3) — this used to hide entirely for any
                                      job with 0 logged hours (a scheduled-but-not-yet-worked job
                                      showed nothing at all), and always included the $ earned
                                      with no way for the owner to suppress it. Now always shows
                                      hours; the $ figure is gated by the owner's
                                      hideJobAmountsFromEmployees Settings toggle. */}
                                  <div className="text-white/40 text-[9px] mt-0.5">
                                    {j.loggedHours || 0}h{!(settings as any)?.hideJobAmountsFromEmployees && <> · {fmt(Number(j.loggedHours || 0) * getEffectiveRate(myEmployee, j))}</>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {!(settings as any)?.hideJobAmountsFromEmployees && (
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10 text-[10px]">
                          <span className="text-white/40">Month total</span>
                          <span className="font-bold text-white/70">{fmt(monthTotal)}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[9px] text-white/30 flex-wrap">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-700/60" />Scheduled</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-700/60" />Unpaid hours</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-700/60" />Paid</span>
                        <span>· tap logged-hour day to mark paid</span>
                      </div>
                    </Glass>
                  );
                })()}

                {/* Earnings Over Time chart removed — redundant with Hours & Earnings section below */}

                {/* Hours & Earnings breakdown — daily/weekly/monthly granularity,
                    pulled from real loggedHours on completed jobs (same source
                    of truth as the pay periods above). */}
                {(() => {
                  const rate = myEmployee?.hourlyRate || 0;
                  // BLOCKER 11 (mobile round 7) — bucketed hours used to be
                  // job.loggedHours only, unlike the Pay Period table above
                  // which already includes computeEmployeeShiftTopUp — so an
                  // employee whose hours came mostly from the whole-day
                  // shift timer (not a completed job) saw this chart
                  // under-report vs. the numbers just above it. Adding the
                  // top-up on whichever single bucket contains lastShiftDate
                  // keeps both sections consistent.
                  // AUDIT FIX — both helpers used to filter on raw
                  // job.scheduledDate (excluding empty-scheduledDate
                  // completed jobs entirely) and every caller below built its
                  // bucket boundaries via toISOString() on a locally-
                  // constructed Date, which can roll back a calendar day for
                  // any US timezone — see jobDateKey/localDateKey above.
                  const bucketHours = (dateKeys: string[]): { name: string; hours: number; earnings: number }[] =>
                    dateKeys.map(key => {
                      const jobHrs = myJobs.filter(j => jobDateKey(j) === key).reduce((s, j) => s + (Number(j.loggedHours) || 0), 0);
                      const topUp = computeEmployeeShiftTopUp(key, key);
                      const hrs = jobHrs + topUp;
                      return { name: key, hours: Math.round(hrs * 100) / 100, earnings: Math.round(hrs * rate * 100) / 100 };
                    });
                  const bucketRangeHours = (s: string, e: string): number =>
                    myJobs.filter(j => jobDateKey(j) >= s && jobDateKey(j) <= e).reduce((acc, j) => acc + (Number(j.loggedHours) || 0), 0) + computeEmployeeShiftTopUp(s, e);
                  let chartData: { name: string; hours: number; earnings: number }[];
                  let ChartComp: any = BarChart;
                  if (payChartRange === "7d") {
                    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return localDateKey(d); });
                    chartData = bucketHours(days).map((d, i) => ({ ...d, name: new Date(days[i] + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }) }));
                  } else if (payChartRange === "4wk") {
                    chartData = Array.from({ length: 4 }, (_, i) => {
                      const end = new Date(); end.setDate(end.getDate() - (3 - i) * 7);
                      const start = new Date(end); start.setDate(start.getDate() - 6);
                      const s = localDateKey(start), e = localDateKey(end);
                      const hrs = bucketRangeHours(s, e);
                      return { name: `${start.getMonth() + 1}/${start.getDate()}`, hours: Math.round(hrs * 100) / 100, earnings: Math.round(hrs * rate * 100) / 100 };
                    });
                  } else if (payChartRange === "custom") {
                    const s = payCustomStart, e = payCustomEnd > payCustomStart ? payCustomEnd : payCustomStart;
                    const spanDays = Math.max(1, Math.round((new Date(e).getTime() - new Date(s).getTime()) / 86400000) + 1);
                    if (spanDays <= 31) {
                      const days = Array.from({ length: spanDays }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return localDateKey(d); });
                      chartData = bucketHours(days).map((d, i) => ({ ...d, name: new Date(days[i] + "T12:00:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) }));
                    } else {
                      const weeks = Math.ceil(spanDays / 7);
                      chartData = Array.from({ length: weeks }, (_, i) => {
                        const wStart = new Date(s); wStart.setDate(wStart.getDate() + i * 7);
                        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
                        const ws = localDateKey(wStart), we = (localDateKey(wEnd) > e ? e : localDateKey(wEnd));
                        const hrs = bucketRangeHours(ws, we);
                        return { name: `${wStart.getMonth() + 1}/${wStart.getDate()}`, hours: Math.round(hrs * 100) / 100, earnings: Math.round(hrs * rate * 100) / 100 };
                      });
                    }
                  } else {
                    ChartComp = LineChart;
                    chartData = Array.from({ length: 12 }, (_, i) => {
                      const d = new Date(); d.setMonth(d.getMonth() - (11 - i)); d.setDate(1);
                      const key = localDateKey(d).slice(0, 7);
                      const monthStart = key + "-01";
                      const monthEnd = localDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
                      const hrs = bucketRangeHours(monthStart, monthEnd);
                      return { name: d.toLocaleDateString("en-US", { month: "short" }), hours: Math.round(hrs * 100) / 100, earnings: Math.round(hrs * rate * 100) / 100 };
                    });
                  }
                  const DataComp: any = payChartRange === "12mo" ? Line : Bar;
                  return (
                    <Glass className="p-4 !bg-black/40 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="text-xs text-white/50 uppercase tracking-wider">Hours & Earnings</div>
                        <div className="flex gap-1 p-0.5 bg-black/40 border border-white/10 rounded-lg">
                          {([["7d", "7 Days"], ["4wk", "4 Weeks"], ["12mo", "12 Months"], ["custom", "Custom"]] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setPayChartRange(k)} className={"px-2 py-1 rounded text-[10px] font-medium transition " + (payChartRange === k ? "bg-brand-700/40 text-white" : "text-white/40")}>{l}</button>
                          ))}
                        </div>
                      </div>
                      {payChartRange === "custom" && (
                        <div className="flex items-center gap-2 text-xs text-white/60">
                          <input type="date" value={payCustomStart} max={payCustomEnd} onChange={e => setPayCustomStart(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white" />
                          <span>to</span>
                          <input type="date" value={payCustomEnd} min={payCustomStart} max={localDateStr()} onChange={e => setPayCustomEnd(e.target.value)} className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white" />
                        </div>
                      )}
                      <div>
                        <div className="text-[10px] text-white/40 mb-1">Hours</div>
                        <div style={{ width: "100%", height: 130 }}>
                          <ResponsiveContainer>
                            <ChartComp data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
                              <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} formatter={(v: any) => `${v}h`} />
                              <DataComp dataKey="hours" {...(payChartRange === "12mo" ? { stroke: "#60a5fa", strokeWidth: 2, dot: false } : { fill: "#60a5fa", radius: [4, 4, 0, 0] })} />
                            </ChartComp>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 mb-1">Earnings</div>
                        <div style={{ width: "100%", height: 130 }}>
                          <ResponsiveContainer>
                            <ChartComp data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} axisLine={false} tickLine={false} width={36} />
                              <Tooltip contentStyle={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} formatter={(v: any) => fmt(v)} />
                              <DataComp dataKey="earnings" {...(payChartRange === "12mo" ? { stroke: "#22c55e", strokeWidth: 2, dot: false } : { fill: "#22c55e", radius: [4, 4, 0, 0] })} />
                            </ChartComp>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </Glass>
                  );
                })()}

                {/* BUG FIX — "clean up the pay tab, so much unnecessary and
                    duplicate content." This "Pay Period History" list used
                    to repeat every period's label/hours/pay/jobs count —
                    the exact same data the Outstanding Balance section
                    above already shows for every period (plus its paid/
                    unpaid status and expandable per-job breakdown, which
                    this list didn't even have). Strictly a subset; removed
                    rather than kept as a second, less-informative copy. */}

                {/* Tax Center */}
                <Glass className="p-4 !bg-black/40">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-white/50 uppercase tracking-wider">Tax Center · {thisYear}</div>
                    <GBtn onClick={downloadTaxPdf} className="!text-xs !py-1.5"><Download size={11} className="inline mr-1" />Tax PDF</GBtn>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="p-2.5 rounded-xl bg-green-950/20 border border-green-700/20">
                      <div className="text-[10px] text-white/40 uppercase">YTD Gross</div>
                      <div className="text-base font-black text-green-400">{fmt(ytdGross)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-yellow-950/20 border border-yellow-700/20">
                      <div className="text-[10px] text-white/40 uppercase">Est. Tax</div>
                      <div className="text-base font-black text-yellow-400">{fmt(estAnnualTax)}</div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-[10px] text-white/40 uppercase">Est. Take-Home</div>
                      <div className="text-base font-black text-white/80">{fmt(estAnnualTakeHome)}</div>
                    </div>
                  </div>
                  <div className="text-[10px] text-white/30">
                    Estimate uses ~15.3% SE-style tax + a federal bracket approximation on YTD gross earnings — not official payroll or tax advice.
                  </div>
                  {priorYears.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Previous Tax Years</div>
                      <div className="space-y-1">
                        {priorYears.map(y => (
                          <div key={y} className="flex justify-between text-xs text-white/60">
                            <span>{y}</span>
                            <span className="font-semibold text-white/80">{fmt(earningsByYear[y])}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Glass>


                <div className="text-[10px] text-white/20 text-center pt-2">
                  Pay estimates are based on logged hours × hourly rate.<br />Contact your manager for official payroll figures.
                </div>
              </>
            );
          })()}
          {/* Onboarding tab */}
          {tab === "onboarding" && (() => {
            const items = onboarding?.items || [];
            const doneCount = items.filter((it: any) => it.done).length;
            const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
            return (
              <div className="space-y-3">
                <Glass className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-sm flex items-center gap-1.5"><CheckSquare size={14} />Onboarding Checklist</div>
                    <span className="text-xs text-white/50">{doneCount}/{items.length} complete</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                    <div className={"h-full rounded-full transition-all " + (pct === 100 ? "bg-green-500" : "bg-blue-500")} style={{ width: pct + "%" }} />
                  </div>
                  {pct === 100 && items.length > 0 && (
                    <div className="mt-2 text-xs text-green-400 flex items-center gap-1.5"><CheckCircle size={13} />All set — you've completed onboarding!</div>
                  )}
                </Glass>
                {onboardingLoading && <div className="text-center text-xs text-white/30 py-6">Loading…</div>}
                {!onboardingLoading && items.length === 0 && (
                  <div className="text-center text-xs text-white/30 py-10">No onboarding items assigned.</div>
                )}
                <div className="space-y-2">
                  {items.map((it: any) => (
                    <Glass key={it.id} className={"p-3 " + (it.done ? "!bg-green-950/10 !border-green-700/20" : "")}>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!it.done}
                          disabled={onboardingSavingId === it.id}
                          onChange={e => toggleOnboardingItem(it.id, e.target.checked)}
                          className="w-4 h-4 mt-0.5 accent-green-600 flex-shrink-0 disabled:opacity-50"
                        />
                        <div className="flex-1 min-w-0">
                          <div className={"text-sm " + (it.done ? "text-green-300 line-through decoration-green-700/60" : "text-white/85")}>{it.title}</div>
                          {it.description && <div className="text-xs text-white/40 mt-0.5">{it.description}</div>}
                          {it.done && it.completedAt && <div className="text-[10px] text-green-400/60 mt-1">Completed {new Date(it.completedAt).toLocaleDateString()}</div>}
                        </div>
                        {onboardingSavingId === it.id && <div className="w-3.5 h-3.5 border border-white/30 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />}
                      </label>
                    </Glass>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Training tab */}
          {tab === "training" && (() => {
            const passedIds = new Set(myTrainingCompletions.filter((c: any) => c.passed).map((c: any) => c.module_id));
            const latestFor = (moduleId: string) => myTrainingCompletions.filter((c: any) => c.module_id === moduleId).sort((a: any, b: any) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())[0];
            return (
              <div className="space-y-3">
                {trainingModules.length === 0 && <div className="text-center text-xs text-white/30 py-10">No training modules assigned yet.</div>}
                {trainingModules.map((m: any) => {
                  const passed = passedIds.has(m.id);
                  const latest = latestFor(m.id);
                  return (
                    <Glass key={m.id} className={"p-4 " + (passed ? "!bg-green-950/10 !border-green-700/20" : m.required ? "!bg-yellow-950/10 !border-yellow-700/20" : "")}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm flex items-center gap-1.5">
                            {passed ? <CheckCircle size={14} className="text-green-400 flex-shrink-0" /> : <BookOpen size={14} className="text-white/40 flex-shrink-0" />}
                            {m.title}
                          </div>
                          <div className="text-[10px] text-white/40 mt-0.5">
                            {m.required ? "Required" : "Optional"}{m.quiz?.length ? ` · ${m.quiz.length} question quiz` : " · No quiz"}
                            {latest && ` · Last attempt ${Math.round(latest.score)}%`}
                          </div>
                        </div>
                        <GBtn onClick={() => startTrainingModule(m)} className="!text-xs !py-1.5 flex-shrink-0">{passed ? "Retake" : "Start"}</GBtn>
                      </div>
                    </Glass>
                  );
                })}
              </div>
            );
          })()}

          {/* Google tab */}
          {tab === "google" && (() => {
            const empUserId = empSession?.user?.id;
            const storedToken = empUserId ? getEmpGoogleToken(empUserId) : null;
            // empGoogleValid: cache-only claim (token present, self-reported
            // expiry not passed). empGoogleVerified (state, set by the live
            // tokeninfo-check effect above): the actual, just-now-confirmed
            // truth. A cache-valid token that verification proved dead
            // (empGoogleVerified === false) must NOT show "Connected ✓".
            const empGoogleValid = isEmpGoogleTokenValid(storedToken) && empGoogleVerified !== false;
            const empGoogleVerifying = !!storedToken?.token && empGoogleVerified === null;
            const empGoogleIdentityLinked = empSession
              ? (empSession.user?.identities || []).some((i: any) => i.provider === "google")
              : false;
            // Linked but no valid token — only treat this as "needs reconnect" when
            // there's also no refresh_token to silently fix it with (the 5-minute
            // background refresh effect above handles that case automatically), OR
            // a real refresh attempt with that refresh_token already failed
            // (empGoogleRefreshFailed — FIX 10, mobile round 6). Showing "reconnect"
            // the instant the 1hr access token expires, even though a refresh_token
            // exists and hasn't been tried/has succeeded before, was alarming
            // employees over a transient, self-healing state — but silently retrying
            // forever against a revoked refresh_token with no visible failure state
            // was the opposite problem.
            const empGoogleExpired = empGoogleIdentityLinked && !empGoogleValid && !empGoogleVerifying && (!storedToken?.refreshToken || empGoogleRefreshFailed);
            const empGoogleEmail = storedToken?.email
              || ((empSession?.user?.identities || []).find((i: any) => i.provider === "google")?.identity_data?.email || "");
            const upcomingForCal = myJobs
              .filter(j => j.scheduledDate >= todayStr && j.status !== "completed")
              .sort((a, b) => {
                const da = a.scheduledDate + (a.scheduledTime || "23:59");
                const db = b.scheduledDate + (b.scheduledTime || "23:59");
                return da.localeCompare(db);
              })
              .slice(0, 20);
            const handleConnectGoogle = async () => {
              // Cache the role BEFORE redirecting — once linkIdentity/signInWithOAuth
              // navigates away, no more JS runs on this page, so this must be set
              // synchronously now, not after the redirect comes back. On return,
              // resolveUserRole checks this cache first so a momentary Supabase query
              // race can never misclassify a freshly-Google-linked employee as owner.
              if (empSession?.user?.id) {
                try { localStorage.setItem("crew_role_" + empSession.user.id, "employee"); } catch { /* ignore */ }
              }
              // BUG FIX (Google accounts mixed up) — without this, lib/supabase.ts's
              // pre-React bridge had no way to tell this OAuth completion apart
              // from the OWNER's own connect/reconnect, and wrote this
              // employee's token into the shared owner-facing slot — every
              // "owner" send (invoices, job assignments, daily briefing) then
              // went out from THIS employee's Gmail instead. Must be set
              // synchronously before the redirect, same as the role cache above.
              setOAuthIntent("employee");
              const SCOPES = [
                "https://www.googleapis.com/auth/calendar",
                "https://www.googleapis.com/auth/calendar.events",
                "https://mail.google.com/",
                "https://www.googleapis.com/auth/drive.file",
                "https://www.googleapis.com/auth/contacts.readonly",
                "https://www.googleapis.com/auth/tasks",
              ].join(" ");
              const redirectTo = `${window.location.origin}${window.location.pathname}#/portal`;
              // ISSUE 13 (round 3) — linkIdentity is the path Supabase actually
              // takes here (it redirects straight to Google without throwing),
              // so the signInWithOAuth fallback below — the ONLY place that had
              // access_type/prompt — almost never ran. Without offline+consent
              // on THIS call, Google never issues a refresh_token, so the
              // silent-refresh effect above has nothing to refresh with and the
              // access token dies after ~1hr — exactly "keeps disconnecting."
              const { error } = await (supabase.auth as any).linkIdentity({
                provider: "google",
                options: { redirectTo, scopes: SCOPES, queryParams: { access_type: "offline", prompt: "consent" } },
              });
              if (error) {
                // Fallback: full OAuth sign-in (some Supabase plans don't support linkIdentity)
                supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: {
                    redirectTo,
                    scopes: SCOPES,
                    queryParams: { access_type: "offline", prompt: "consent" },
                  },
                });
              }
            };
            return (
              <div className="space-y-4">
                {/* Connect / connected / expired banner */}
                {empGoogleVerifying ? (
                  <Glass className="p-4 !bg-black/40">
                    <div className="flex items-center gap-3">
                      <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      <div className="text-sm text-white/60">Verifying connection…</div>
                    </div>
                  </Glass>
                ) : empGoogleValid ? (
                  <Glass className="p-4 !bg-green-950/20 !border-green-700/30">
                    <div className="flex items-center gap-3 mb-3">
                      <CheckCircle size={18} className="text-green-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-green-300">Google Connected ✓</div>
                        {empGoogleEmail && <div className="text-xs text-white/50 mt-0.5">Connected as {empGoogleEmail}</div>}
                        <div className="text-xs text-white/40 mt-0.5">Calendar sync is active — jobs auto-added on accept</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (!window.confirm("Disconnect your Google account? This will stop calendar sync and Gmail sending from your portal.")) return;
                        if (empUserId) {
                          try { localStorage.removeItem("emp_google_token_" + empUserId); } catch { /* ignore */ }
                          saveEmpGoogleToken(empUserId, null as any);
                        }
                        toast("Google account disconnected", "green");
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-brand-950/30 hover:bg-brand-900/40 border border-brand-700/30 text-brand-300 text-xs font-semibold transition"
                    >
                      <X size={12} />Disconnect Google
                    </button>
                  </Glass>
                ) : empGoogleExpired ? (
                  <Glass className={"p-4 " + (empGoogleConfigMissing ? "!bg-danger-950/20 !border-danger-700/30" : "!bg-yellow-950/20 !border-yellow-700/30")}>
                    <div className="flex items-center gap-3 mb-3">
                      <AlertCircle size={18} className={(empGoogleConfigMissing ? "text-danger-400" : "text-yellow-400") + " flex-shrink-0"} />
                      <div className="flex-1 min-w-0">
                        <div className={"font-semibold text-sm " + (empGoogleConfigMissing ? "text-danger-300" : "text-yellow-300")}>
                          {empGoogleConfigMissing ? "Google Sync Unavailable — Server Setup Needed" : "Google Connection Expired"}
                        </div>
                        {empGoogleEmail && <div className="text-xs text-white/50 mt-0.5">{empGoogleEmail}</div>}
                        {/* AUDIT — reconnecting can't fix a missing
                            GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET on the
                            server; every "expired" banner used to say the
                            same generic thing regardless of cause, so an
                            employee (and the owner they escalated to) had no
                            way to tell "just expired" from "will never work
                            until an admin fixes Cloudflare." */}
                        <div className="text-xs text-white/40 mt-0.5">
                          {empGoogleConfigMissing
                            ? "This isn't something reconnecting will fix — ask the business owner to check Settings → Integrations → Google."
                            : "Your access token expired — reconnect to resume calendar sync"}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleConnectGoogle}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-black font-semibold text-sm active:scale-95 transition-all"
                    >
                      Reconnect Google
                    </button>
                  </Glass>
                ) : (
                  <Glass className="p-4 !bg-black/40">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/30 to-blue-900/30 border border-blue-700/30 flex items-center justify-center flex-shrink-0">
                        <Calendar size={18} className="text-blue-400" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm">Connect Your Google Account</div>
                        <div className="text-xs text-white/40 mt-0.5">Sync jobs to your personal Google Calendar</div>
                      </div>
                    </div>
                    <button
                      onClick={handleConnectGoogle}
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                      Connect Google Account
                    </button>
                  </Glass>
                )}

                {empGoogleValid && (
                  <Glass className="p-4 !bg-black/40 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">Auto-sync jobs to Google Calendar</div>
                      <div className="text-xs text-white/40 mt-0.5">
                        {autoSyncCalendar
                          ? "Every assigned or accepted job is added to your calendar automatically"
                          : "Add jobs to your calendar manually with the button below"}
                      </div>
                    </div>
                    <button onClick={toggleAutoSyncCalendar} className={"transition flex-shrink-0 " + (autoSyncCalendar ? "text-blue-400" : "text-white/30")}>
                      {autoSyncCalendar ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </Glass>
                )}

                <Glass className="p-4 !bg-black/40">
                  <label className="text-sm font-semibold mb-1 block flex items-center gap-1.5"><MapPin size={13} className="text-blue-400" />Home Base</label>
                  <div className="text-xs text-white/40 mb-2">Your starting address — used as the origin point when optimizing today's route</div>
                  <AddressAutocomplete
                    value={homeBaseAddress}
                    onChange={v => saveHomeBaseAddress(v)}
                    placeholder="412 Oak Ridge Ln, your area"
                    mapsKey={settings.googleMapsKey || settings.mapsKey || ""}
                    knownAddresses={Array.from(new Set([...myJobs.map(j => j.address), ...customers.map((c: any) => c.address)].filter(Boolean)))}
                  />
                </Glass>

                {/* Upcoming jobs to add */}
                {upcomingForCal.length === 0 ? (
                  <div className="text-center py-10 text-white/30">
                    <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                    <div>No upcoming jobs to sync</div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Upcoming Jobs</div>
                    <div className="space-y-2">
                      {upcomingForCal.map(j => {
                        const c = customers.find(x => x.id === j.customerId);
                        return (
                          <Glass key={j.id} className="p-3 !bg-black/40">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate">{j.address}</div>
                                {c && (
                                  <div className="text-xs text-white/40 flex items-center gap-2 flex-wrap">
                                    <span>{c.firstName} {c.lastName}</span>
                                    {c.phone && <a href={`tel:${c.phone}`} onClick={(e: React.MouseEvent) => e.stopPropagation()} className="text-blue-400/70 hover:text-blue-300 flex items-center gap-0.5"><Phone size={9} />{c.phone}</a>}
                                  </div>
                                )}
                                <div className="text-xs text-white/30 mt-0.5">
                                  {j.scheduledDate}{j.scheduledTime ? " · " + j.scheduledTime : ""}
                                </div>
                              </div>
                              <a
                                href={toGCalUrl(j)}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 border border-blue-700/30 text-blue-300 text-[10px] font-semibold transition flex-shrink-0"
                              >
                                <Plus size={10} />Add
                              </a>
                            </div>
                          </Glass>
                        );
                      })}
                    </div>
                    <div className="text-[10px] text-white/20 text-center pt-1">
                      Tapping "Add" opens Google Calendar. When connected above, jobs sync automatically.
                    </div>
                  </>
                )}

                {/* Privacy note */}
                <div className="p-3 rounded-xl bg-yellow-950/20 border border-yellow-700/20 text-xs text-yellow-200/60 flex items-start gap-2">
                  <Shield size={12} className="flex-shrink-0 mt-0.5" />
                  <span>Your personal Google account is private. Employers cannot see your personal Gmail or Calendar events.</span>
                </div>
              </div>
            );
          })()}

        </div>
      </main>

      {/* Bottom nav — filtered by permissions */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/95 border-t border-brand-900/30 flex items-center justify-around px-2 py-2 safe-bottom z-30">
        {([
          { id: "today",    label: "Today",    icon: Home,       show: true },
          { id: "calendar", label: "Calendar", icon: Calendar,   show: perms.can_view_calendar },
          { id: "jobs",     label: "All Jobs", icon: List,       show: perms.can_view_jobs },
          { id: "pay",      label: "My Pay",   icon: DollarSign, show: perms.can_view_pay },
          { id: "onboarding", label: "Onboarding", icon: CheckSquare, show: !!onboarding },
          { id: "training", label: "Training", icon: BookOpen, show: trainingModules.length > 0 },
          { id: "google",   label: "Google",   icon: Database,   show: true },
        ] as const).filter(t => t.show).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id as typeof tab)}
            className={"flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition " +
              (tab === id ? "text-brand-400" : "text-white/40 hover:text-white/70")}>
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
