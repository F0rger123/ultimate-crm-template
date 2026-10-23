import { supabase } from "./supabase";

// ─── Configurable poll interval (EGRESS) ───────────────────────────────────────
// Single source of truth for "how often do the cross-device fallback polls
// re-check Supabase" (jobs/customers/estimates, employees, app_settings,
// Alfred conversations/memory). Clamped so a bad/missing settings value can
// never produce a runaway fast poll (min 30s) or a value so long it stops
// being a meaningful fallback at all (max 600s).
export const DEFAULT_POLL_INTERVAL_MS = 120000;
export const POLL_INTERVAL_OPTIONS = [
  { label: "30 seconds (most responsive, highest egress)", value: 30000 },
  { label: "60 seconds", value: 60000 },
  { label: "120 seconds (recommended)", value: 120000 },
  { label: "300 seconds (lowest egress)", value: 300000 },
] as const;
// BUG FIX — this was owner-editable in Settings, but a user-chosen value here
// has no way to account for what actually drives egress cost (tab count,
// realtime already covering same-device changes, etc.) — the owner has no
// real basis to pick a "correct" number, and a bad pick either wastes egress
// or misses cross-device updates for minutes. Always automatic now: ignores
// any stored override and returns the single recommended interval.
export const getPollIntervalMs = (_settings?: { pollIntervalMs?: number } | null): number => DEFAULT_POLL_INTERVAL_MS;

// ─── Offline job-patch queue (employee portal) ─────────────────────────────────
// FEATURE — "make the employee portal work offline and automatically sync
// when back online." The portal already updates local state optimistically
// on every job write (see EmployeePortal's updateJob), so the UI itself
// already "works" offline — the real gap was that a failed Supabase write
// while offline just got logged to console and forgotten, with no retry
// once connectivity returned. These helpers back a small localStorage queue
// of job patches that failed specifically because the device was offline;
// EmployeePortal flushes it on the browser's `online` event. Patches for
// the same job are merged (last write per field wins), so a checklist
// toggled three times offline replays as one merged write, not three.
const PENDING_JOB_SYNC_KEY = "crm.pendingJobSync";

export type PendingJobPatch = { jobId: string; patch: Record<string, unknown>; queuedAt: number };

export const getPendingJobPatches = (): PendingJobPatch[] => {
  try { return JSON.parse(localStorage.getItem(PENDING_JOB_SYNC_KEY) || "[]"); } catch { return []; }
};

export const queueOfflineJobPatch = (jobId: string, patch: Record<string, unknown>): void => {
  try {
    const existing = getPendingJobPatches();
    const idx = existing.findIndex(p => p.jobId === jobId);
    if (idx >= 0) existing[idx] = { jobId, patch: { ...existing[idx].patch, ...patch }, queuedAt: Date.now() };
    else existing.push({ jobId, patch, queuedAt: Date.now() });
    localStorage.setItem(PENDING_JOB_SYNC_KEY, JSON.stringify(existing));
  } catch { /* localStorage unavailable — the offline edit still lives in in-memory jobs state for this session */ }
};

export const clearPendingJobPatch = (jobId: string): void => {
  try {
    const remaining = getPendingJobPatches().filter(p => p.jobId !== jobId);
    localStorage.setItem(PENDING_JOB_SYNC_KEY, JSON.stringify(remaining));
  } catch { /* ignore */ }
};

// ─── Job media (Storage-backed photos/videos/signatures) ──────────────────────
// Every Photo/ChecklistPhoto/JobVideo/JobSignOff can carry EITHER a Storage
// `url` (new captures, once the job-media bucket exists — see
// supabase/migrations/0017) OR a legacy inline `dataUrl`/`sigData` (every
// capture before this migration, or any capture where the Storage upload
// failed and fell back). Every render site must call mediaSrc() instead of
// reading .dataUrl directly, or Storage-backed media renders as broken.
export const mediaSrc = (url?: string | null, dataUrl?: string | null): string => url || dataUrl || "";

// Reconstructs a Blob from a data: URL (compressImageFile's output) for upload.
export const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(header)?.[1] || "image/jpeg";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

// ─── Image compression (FIX 6) ────────────────────────────────────────────────
// Job photos are stored as base64 dataURLs directly inside the `jobs.photos`
// JSONB column. An uncompressed phone-camera photo is routinely 3-8MB; each
// upload PATCHes the ENTIRE photos array back to Supabase, so a few full-res
// photos on one job blow past PostgREST/Cloudflare's request-body limit and
// the whole update is rejected — which look exactly like "photos don't sync",
// since nothing in the UI ever reports the failure as a size problem. Downscale
// to a reasonable max dimension and re-encode as JPEG before ever touching
// Supabase; this alone takes most photos from several MB down to ~100-300KB.
export const compressImageFile = (file: File, maxDim = 1600, quality = 0.72): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result as string); // fall back to uncompressed rather than losing the photo
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(reader.result as string); return; }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(reader.result as string);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
};

// ITEM 11 — shared video length/size cap. Previously only the top-level
// before/after video capture (EmployeePortal.tsx's addVideo) enforced this;
// the checklist-item video capture (PortalChecklistSection's file input) had
// no check at all, so a long/large video uploaded through a checklist item
// could still blow past Storage/egress limits (and, falling back to an
// inline dataUrl on an upload timeout, bloat the jobs row enough to make
// "Complete Job" saves intermittently fail — see docs/ARCHITECTURE.md's Complete Job
// wizard reliability notes). Both capture points now call this one check.
// Tightened from 30s/50MB — long/large field videos were the single biggest
// contributor to jobs-table egress bloat before Storage uploads existed, and
// still fall back to an inline base64 blob on any upload timeout/offline
// capture, so a hard low cap matters even with Storage in place.
export const MAX_JOB_VIDEO_SECONDS = 10;
export const MAX_JOB_VIDEO_MB = 10;

export const checkVideoLimits = (file: File): Promise<string | null> => {
  if (file.size > MAX_JOB_VIDEO_MB * 1024 * 1024) {
    return Promise.resolve(`Video exceeds ${MAX_JOB_VIDEO_MB}MB limit — trim to under ${MAX_JOB_VIDEO_SECONDS} seconds`);
  }
  return new Promise(resolve => {
    const vid = document.createElement("video");
    vid.preload = "metadata";
    const url = URL.createObjectURL(file);
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(vid.duration > MAX_JOB_VIDEO_SECONDS ? `Video exceeds ${MAX_JOB_VIDEO_SECONDS} seconds — please trim it first` : null);
    };
    // Can't read metadata (unsupported format, corrupt file) — don't block the
    // upload over a check that itself failed; let it through.
    vid.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    vid.src = url;
  });
};

// ─── Formatting ───────────────────────────────────────────────────────────────

// BUG FIX — "total was a dollar and the deposit was a dollar" on a $1 quote
// with a 50% deposit: this always rounded to whole dollars, so $0.50 showed
// as "$1" and $1.06 as "$1". Whole amounts still print without cents
// ("$300"); anything with cents shows them ("$0.50", "$1.06").
export const fmt = (n: number | undefined | null): string => {
  if (n == null || isNaN(Number(n))) return "$0";
  const v = Math.round(Number(n) * 100) / 100;
  const cents = Number.isInteger(v) ? 0 : 2;
  return "$" + v.toLocaleString("en-US", { minimumFractionDigits: cents, maximumFractionDigits: cents });
};

// SECURITY FIX (audit finding) — customer records (firstName/lastName etc.)
// are writable by unauthenticated public forms (lead intake,
// signup, referral signup — see public-data.ts's submit_* actions), which
// insert whatever the submitter typed verbatim. Several places build an
// HTML string by interpolating a customer field directly and then render it
// via dangerouslySetInnerHTML (estimate/promo send previews) or as an
// actual outbound email body — an attacker could submit a public form with
// firstName = "<img src=x onerror=...>" and have it execute in the OWNER's
// authenticated session the moment they preview/send to that customer.
// Escape any customer-sourced (or otherwise untrusted) value before it goes
// into an HTML template string.
export const escapeHtml = (s: string | undefined | null): string => {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Generate a real RFC-4122 UUID v4 rather than a short base-36 string. The
// Supabase tables (jobs, estimates, customers, employees, job_requests) have
// `id` columns that are frequently typed `uuid` — a short id like "a3f9k2m1"
// makes every INSERT fail with "invalid input syntax for type uuid", which is
// why job saves timed out and estimate sync errored. A UUID is accepted by a
// `uuid` column AND by a `text` column, so this works no matter how the schema
// is set up. Falls back to a manual v4 build where crypto.randomUUID is absent
// (older/non-secure contexts).
export const uid = (): string => {
  try {
    if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
      return (crypto as any).randomUUID();
    }
  } catch { /* fall through */ }
  // Manual RFC-4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// FEATURE — "automatically assign an employee" (bulk trash/cleaning job
// import). No location/skill-matching data exists to do real dispatch
// optimization, so this is a deliberately simple, honest heuristic:
// whichever assignable active employee has the FEWEST jobs already on
// their plate for that date gets the next one — spreads load evenly
// instead of always picking the same person. Same "assignable crew"
// filter used everywhere else a job gets a crew member (JobDetailModal.tsx).
// BUG FIX — "API keys with referer restrictions cannot be used with this
// API" (Google's own error). Distance Matrix API is, like Geocoding, one
// of the Google Maps Platform "web service" APIs that flatly refuses a
// referrer-restricted key — the JS google.maps.DistanceMatrixService class
// is permanently bound to whatever key loaded the Maps JS <script> tag
// (the SAME key that needs a referrer restriction for safe browser use
// everywhere else — Places autocomplete, map rendering), so it can never
// work with that key. Calling the REST endpoint directly (Google allows
// CORS on it) lets this use a genuinely separate, unrestricted key —
// settings.googleGeocodingKey, the same dedicated key CustomerMapView.tsx
// uses for geocoding.
export const fetchDriveDistance = async (origin: string, destination: string, apiKey: string): Promise<{ miles: number; durationText: string; durationSeconds: number }> => {
  const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${encodeURIComponent(apiKey)}`);
  const body = await res.json();
  if (body.status !== "OK") throw new Error(body.error_message || body.status || "Distance lookup failed");
  const el = body.rows?.[0]?.elements?.[0];
  if (el?.status !== "OK" || !el?.distance) throw new Error("No route found between those addresses");
  return { miles: el.distance.value / 1609.34, durationText: el.duration?.text || "", durationSeconds: el.duration?.value ?? 0 };
};

export const pickLeastLoadedEmployee = (jobs: any[], employees: any[], date: string): string | null => {
  const assignable = (employees || []).filter((e: any) => e.status === "active" && e.role !== "owner");
  if (assignable.length === 0) return null;
  const loadCount = (empId: string) => (jobs || []).filter((j: any) => j.scheduledDate === date && Array.isArray(j.crew) && j.crew.includes(empId) && j.status !== "cancelled").length;
  return assignable.reduce((best: any, e: any) => (loadCount(e.id) < loadCount(best.id) ? e : best), assignable[0]).id;
};

// ISSUE 3 (round 11) — Twilio requires E.164 (+1XXXXXXXXXX) for the To/From
// numbers on every send; customer/employee phone fields across the app get
// typed in every format imaginable ("(555) 555-0100", "555.555.0100",
// "7175550100", already-correct "+15555550100"). Normalizing at every input
// site would be easy to miss on a new form; normalizing once at the actual
// Twilio call site (see twilioSend in lib/messaging.ts) guarantees every
// send path — OTW, Running Late, Campaigns, automations, Alfred, the owner's
// Inbox — gets a valid number regardless of how it was originally entered.
// US/Canada (10-digit) numbers are assumed absent an explicit country code,
// since that's this app's whole install base; a number that already starts
// with "+" is trusted as-is (international).
export const toE164 = (raw: string): string => {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    // ITEM 33 — E.164 numbers are 8-15 digits after the "+" (ITU E.164 spec).
    // Anything shorter/longer almost always means the owner/customer typed a
    // partial or garbled number — fail here with an empty string (caller
    // treats "" as invalid) instead of forwarding junk to Twilio, which
    // rejects it with an opaque error far from the actual input.
    return digits.length >= 8 && digits.length <= 15 ? "+" + digits : "";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  // No "+" and not a recognizable 10/11-digit US number (e.g. a 7-digit
  // local number with no area code) — invalid rather than guessing.
  return "";
};

// BUG FIX — SMS Inbox showing two separate conversations for the same real
// phone number, one carrying Alfred's replies (badged "from Alfred") and one
// not. Root cause: every phone-matching call site in this app used plain
// `.replace(/\D/g, "")`, but Twilio's inbound `From`/`To` always arrive
// E.164 with the US country code ("+15555550100" -> "17175550100", 11
// digits), while a number typed into a form or stored on a customer record
// is normally the bare 10-digit local number ("7175550100") — those two
// never compared equal, so a thread created from a Twilio webhook event and
// a thread created/matched client-side (compose, backfill, outbound SMS
// logging) for the exact same number silently diverged into two rows.
// twilio-sms-webhook.ts already had the fix (strip a leading "1" off an
// 11-digit result) — this is that exact same function, shared so every
// client-side phone comparison (InboxPage.tsx, lib/messaging.ts) uses
// identical normalization to what the server writes.
export const normalizePhoneDigits = (p: string | null | undefined): string => {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};

// FEATURE — "when it adds a job to Google Calendar, it should show the
// address, client name, client phone number, and a clickable link back to
// the CRM." Google Calendar's own `location` field already carries the
// address (separate API field, not part of this description) — this builds
// everything else as the event's description/notes body. `portalPath` picks
// which app the link opens into: "#/portal?job=" for an employee (their own
// job detail view — see EmployeePortal.tsx's job= deep-link handling) or a
// plain job id anchor for the owner CRM. Shared by every job->Calendar sync
// call site (JobsPage.tsx, JobDetailModal.tsx) so all of them stay
// consistent instead of drifting apart one at a time.
// FEATURE — "each calendar event should include the customer name, address,
// phone number, a clickable link (employee portal if crew's assigned, else
// the owner job view), and the job notes." linkLabel/linkUrl let the caller
// decide which of those two links applies — see JobsPage.tsx/JobDetailModal
// for how that's picked based on job.crew.
export const buildJobCalendarDescription = (
  job: { id: string; notes?: string; address?: string },
  customer: { firstName?: string; lastName?: string; phone?: string } | null | undefined,
  linkUrl: string,
  linkLabel: string = "View job in CRM Starter"
): string => {
  const lines: string[] = [];
  if (customer) {
    const name = `${customer.firstName || ""} ${customer.lastName || ""}`.trim();
    if (name) lines.push(`Client: ${name}`);
    if (customer.phone) lines.push(`Phone: ${customer.phone}`);
  }
  if (job.address) lines.push(`Address: ${job.address}`);
  if (job.notes) lines.push("", job.notes);
  lines.push("", `${linkLabel}: ${linkUrl}`);
  return lines.join("\n");
};

// Live-format a US phone number as the user types, e.g. "(555) 555-0100" —
// purely cosmetic for input fields; toE164 above is what actually matters
// for sending. Keeps a leading "+" (international entry) untouched.
export const formatPhoneInput = (raw: string): string => {
  if ((raw || "").trim().startsWith("+")) return raw;
  const digits = (raw || "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const today = (): string => new Date().toISOString().slice(0, 10);

// AUDIT 3 — `today()` is UTC-based (toISOString), which rolls over to the
// next calendar date at 7-8pm US local time, not local midnight. That's fine
// for most call sites (scheduling dates set via <input type=date>, which is
// already local and only ever compared to itself), but the shift-timer's
// "same calendar day" check (Resume Day vs Start My Day, reset only at
// midnight) explicitly needs the EMPLOYEE'S local day boundary — using
// today() there meant an evening shift could get treated as spanning two
// different "days" hours before actual local midnight, causing Resume Day
// to incorrectly show Start My Day (which resets the clock) in the evening.
export const localDateStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// AUDIT FIX (Pay tab hours/earnings drift) — same class of bug as AUDIT 3
// above, but for arbitrary dates rather than "now": pay-period/chart bucket
// boundaries are built via `new Date(now); d.setDate(d.getDate() - n)`, which
// operates in the browser's LOCAL timezone, then were converted back to a
// YYYY-MM-DD key via `toISOString().slice(0,10)` — a UTC conversion. For any
// timezone west of UTC (all of the US), that can roll the boundary back to
// the PREVIOUS calendar day, especially in the evening — silently shifting a
// job right at a period/week/month boundary into the wrong bucket, or off
// the edge of the tracked window entirely. Use this instead of toISOString()
// whenever the Date was constructed via local-time arithmetic and needs to
// be compared against a local calendar-date string like job.scheduledDate.
export const localDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// BLOCKER 13 (mobile round 9) — the whole-day shift timer's "same day" check
// (Resume Day vs Start My Day) used localDateStr()'s plain midnight boundary,
// so a night-shift worker who ends (or auto-resumes via "I'm Here") a shift
// a few minutes either side of local midnight got treated as two different
// "days" — alreadyWorkedTodayHours came back 0, isResuming flipped to false,
// and the next clock-in silently reset the running total to zero instead of
// continuing it. Shift-continuity checks should use a 4am cutover instead:
// anything before 4am local still counts as part of the previous calendar
// day for shift-tracking purposes only (job scheduling/today's-date display
// elsewhere should keep using localDateStr()/today() unchanged).
export const shiftDayStr = (): string => {
  const d = new Date();
  if (d.getHours() < 4) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// ISSUE 2 — root cause of "Mark as Paid reverts after reload": both the
// employee's Pay tab (EmployeePortal.tsx) and the owner's Payroll tab
// (EmployeesPage.tsx's getCurrentPayPeriod) used to independently compute
// "the current pay period" as a SLIDING window — literally "today minus 13
// days" — recomputed fresh on every render from `new Date()`. That value
// shifts by one calendar day every day (and can differ between the owner's
// and employee's device if rendered at slightly different moments straddling
// midnight), so the `paidPeriods` key written when marking a period paid
// today (e.g. "2026-07-26") stops matching the "current period" key computed
// on the very next render that happens on a different day (e.g.
// "2026-07-27") — paidPeriodsMap[currentStart] comes back undefined, i.e.
// "unpaid", even though the write genuinely succeeded and is still sitting
// in Supabase under the old key. Anchoring every period to a fixed epoch
// (a Monday) makes period boundaries deterministic and IDENTICAL no matter
// who computes them or when — a period a device computed yesterday and one
// computed today for "the period that contains today" only differ once the
// real 14-day boundary is crossed, matching what "Mark as Paid" actually
// means (pay for a fixed period, not a rolling one).
const PAY_PERIOD_EPOCH = new Date(2024, 0, 1); // Monday, Jan 1 2024 — arbitrary fixed anchor
export const getPayPeriodBounds = (referenceDate: Date = new Date(), periodsAgo = 0): { start: string; end: string } => {
  const daysSinceEpoch = Math.floor((referenceDate.getTime() - PAY_PERIOD_EPOCH.getTime()) / 86400000);
  const periodIndex = Math.floor(daysSinceEpoch / 14) - periodsAgo;
  const start = new Date(PAY_PERIOD_EPOCH);
  start.setDate(start.getDate() + periodIndex * 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 13);
  return { start: localDateKey(start), end: localDateKey(end) };
};

export const daysFromNow = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const daysSince = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 0;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

// BLOCKER 2 (mobile round 7) — root cause of "Employees Hours/Payroll shows
// zero despite the hours existing in Supabase": jobs fetched from Supabase
// were used as-is with no casing normalization (unlike normalizeEmployee in
// App.tsx). `loggedHours` is quoted correctly in migration 0005, but any job
// row written before that migration ran, or a column added by hand through
// the Supabase dashboard without quoting, folds to `loggedhours` — every
// downstream `Number(j.loggedHours || j.duration || 0)` (EmployeesPage,
// Dashboard, JobsPage, EmployeePortal) then silently reads undefined as 0
// even though the real number is sitting right there under the lowercase
// key. Shared here so every Supabase job-fetch site (App.tsx's refetchData,
// EmployeePortal.tsx's own jobs poll) normalizes the same way.
// BLOCKER 12 (mobile round 7) — "photo count" badges (Live Crew View,
// Jobs list) only ever counted the top-level job.photos array (the
// dedicated Before/After gallery), but most of the photos an employee
// actually takes come from the per-checklist-item camera button
// (PortalChecklistSection.addItemPhoto in EmployeePortal.tsx), which stores
// them nested on preChecklist/duringChecklist/postChecklist items instead —
// a genuinely separate field, not just a naming mismatch. Counting only
// job.photos made real, saved photo activity look like it "went missing."
export const totalJobPhotoCount = (job: any): number => {
  if (!job) return 0;
  const top = Array.isArray(job.photos) ? job.photos.length : 0;
  const checklists = [job.preChecklist, job.duringChecklist, job.postChecklist, job.checklist];
  const nested = checklists.reduce((s: number, list: any) => s + (Array.isArray(list)
    ? list.reduce((s2: number, item: any) => s2 + (Array.isArray(item?.photos) ? item.photos.length : 0), 0)
    : 0), 0);
  return top + nested;
};

export const normalizeJobRow = (j: any): any => ({
  ...j,
  loggedHours: j.loggedHours ?? j.loggedhours ?? j.logged_hours ?? j.duration ?? 0,
  clockInAt: j.clockInAt ?? j.clockinat ?? j.clock_in_at ?? null,
  arrivedAt: j.arrivedAt ?? j.arrivedat ?? j.arrived_at ?? null,
  lunchStartAt: j.lunchStartAt ?? j.lunchstartat ?? j.lunch_start_at ?? null,
  lunchMinutes: j.lunchMinutes ?? j.lunchminutes ?? j.lunch_minutes ?? 0,
  invoiceSentAt: j.invoiceSentAt ?? j.invoicesentat ?? j.invoice_sent_at ?? null,
  amountCollected: j.amountCollected ?? j.amountcollected ?? j.amount_collected ?? 0,
  scheduledTime: j.scheduledTime ?? j.scheduledtime ?? j.scheduled_time ?? "",
  // crewAssignedAt was never in this list (unlike every other camelCase
  // field above) despite docs/ARCHITECTURE.md flagging it as JSONB and this project's
  // repeated history of unquoted-DDL columns folding to lowercase in
  // Postgres. If it was ever created without quotes, every read of
  // job.crewAssignedAt silently comes back undefined (crew visibility is
  // unaffected — that's a separate array field — but the "New Assignment"
  // banner and cross-actor crew merge in reconcileCrewAfterAssign both rely
  // on this being populated).
  crewAssignedAt: j.crewAssignedAt ?? j.crewassignedat ?? j.crew_assigned_at ?? {},
});

// ─── Timeframes ───────────────────────────────────────────────────────────────

export interface Timeframe {
  key: string;
  label: string;
  days: number;
}

export const TIMEFRAMES: Timeframe[] = [
  { key: "7d",  label: "7D",  days: 7   },
  { key: "30d", label: "30D", days: 30  },
  { key: "90d", label: "90D", days: 90  },
  { key: "6m",  label: "6M",  days: 180 },
  { key: "1y",  label: "1Y",  days: 365 },
  { key: "all", label: "All", days: 9999},
];

export const filterByTimeframe = <T extends Record<string, unknown>>(
  arr: T[],
  dateKey: keyof T,
  timeframe: string,
  customStart?: string,
  customEnd?: string
): T[] => {
  if (timeframe === "custom" && customStart && customEnd) {
    return arr.filter(item => {
      const d = item[dateKey] as string;
      return d >= customStart && d <= customEnd;
    });
  }
  const tf = TIMEFRAMES.find(t => t.key === timeframe);
  if (!tf || tf.days === 9999) return arr;
  const cutoff = daysFromNow(-tf.days);
  return arr.filter(item => (item[dateKey] as string) >= cutoff);
};

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineStage {
  key: string;
  label: string;
  color: string;
  border: string;
  text: string;
}

export const pipelineStages: PipelineStage[] = [
  { key: "lead",          label: "Lead",       color: "bg-gray-600",    border: "border-gray-600/40",    text: "text-gray-300"    },
  { key: "contacted",     label: "Contacted",  color: "bg-blue-600",    border: "border-blue-600/40",    text: "text-blue-300"    },
  { key: "estimate_sent", label: "Est Sent",   color: "bg-purple-600",  border: "border-purple-600/40",  text: "text-purple-300"  },
  { key: "approved",      label: "Approved",   color: "bg-yellow-500",  border: "border-yellow-500/40",  text: "text-yellow-300"  },
  { key: "scheduled",     label: "Scheduled",  color: "bg-orange-500",  border: "border-orange-500/40",  text: "text-orange-300"  },
  { key: "completed",     label: "Completed",  color: "bg-green-600",   border: "border-green-600/40",   text: "text-green-300"   },
  { key: "paid",          label: "Paid",       color: "bg-emerald-500", border: "border-emerald-500/40", text: "text-emerald-300" },
  { key: "lost",          label: "Lost",       color: "bg-danger-800",     border: "border-danger-800/40",     text: "text-danger-400"     },
];

// ─── Priority Levels ──────────────────────────────────────────────────────────

export interface PriorityLevel {
  key: string;
  label: string;
  color: string;
  tone: string;
}

export const priorityLevels: PriorityLevel[] = [
  { key: "low",    label: "Low",    color: "bg-gray-600",   tone: "gray"   },
  { key: "normal", label: "Normal", color: "bg-blue-600",   tone: "blue"   },
  { key: "high",   label: "High",   color: "bg-yellow-600", tone: "yellow" },
  { key: "urgent", label: "Urgent", color: "bg-danger-600",    tone: "red"    },
];

// ─── Job / Estimate Dropdowns ─────────────────────────────────────────────────

export const cancelReasons = [
  "Customer cancelled",
  "Weather",
  "No show",
  "Rescheduled",
  "Price dispute",
  "Equipment failure",
  "Other",
];

export const recurringFreqs = [
  { key: "weekly",    label: "Weekly",    days: 7   },
  { key: "biweekly",  label: "Bi-Weekly", days: 14  },
  { key: "monthly",   label: "Monthly",   days: 30  },
  { key: "quarterly", label: "Quarterly", days: 90  },
  { key: "biannual",  label: "Bi-Annual", days: 182 },
  { key: "annual",    label: "Annual",    days: 365 },
];

export const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// FEATURE 6 — resolves an estimate's deposit to an actual dollar figure,
// whether the owner configured it as a flat amount (depositType "amount",
// the default/back-compat behavior) or a percentage of the total.
export const computeDepositAmount = (
  est: { depositRequired?: number; depositType?: string } | undefined | null,
  total: number
): number => {
  if (!est?.depositRequired) return 0;
  if (est.depositType === "percent") return Math.round(total * (Number(est.depositRequired) / 100) * 100) / 100;
  return Number(est.depositRequired) || 0;
};

// FEATURE 7 — combines every stacked manual discount (each either a flat $ or
// a % of subtotal) into one dollar total. Single shared implementation so
// EstimateBuilder/ClientPortal/JobsPage/JobDetailModal can never disagree on
// what a given discounts[] array actually totals to.
export const computeDiscountsTotal = (discounts: Array<{ type?: string; value?: number }> | undefined, subtotal: number): number => {
  return (discounts || []).reduce((sum, d) => {
    const amt = d.type === "percent" ? subtotal * (Number(d.value) / 100) : Number(d.value) || 0;
    return sum + Math.max(0, amt);
  }, 0);
};

// FEATURE 5 — single shared "is this employee unavailable on this date" check
// (specific blocked date OR a recurring weekday-off), so every place that
// assigns crew (JobsPage's quick-request AND new-job dropdown, JobDetailModal's
// crew section) agrees on the same answer instead of each reimplementing —
// and possibly disagreeing on — the availability.includes() check.
export const isEmployeeUnavailable = (emp: { availability?: string[]; recurringDaysOff?: number[] } | undefined | null, dateStr: string | undefined | null): boolean => {
  if (!emp || !dateStr) return false;
  if ((emp.availability || []).includes(dateStr)) return true;
  const daysOff = emp.recurringDaysOff || [];
  if (daysOff.length === 0) return false;
  const day = new Date(dateStr + "T12:00:00").getDay();
  return daysOff.includes(day);
};

// FEATURE 5 — counts days off actually taken within [startDate, endDate]
// (inclusive, YYYY-MM-DD strings): specific blocked dates in range, plus every
// occurrence of a recurring weekday-off within that range. Used to compare
// against the owner-set maxDaysOffPerWeek/maxDaysOffPerMonth caps.
export const countDaysOffInRange = (emp: { availability?: string[]; recurringDaysOff?: number[] } | undefined | null, startDate: string, endDate: string): number => {
  if (!emp) return 0;
  const specific = (emp.availability || []).filter(d => d >= startDate && d <= endDate);
  const daysOff = emp.recurringDaysOff || [];
  let recurringCount = 0;
  if (daysOff.length > 0) {
    const start = new Date(startDate + "T12:00:00");
    const end = new Date(endDate + "T12:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10);
      if (daysOff.includes(d.getDay()) && !specific.includes(ds)) recurringCount++;
    }
  }
  return specific.length + recurringCount;
};

// FEATURE 4 — combines every distinct linked service's checklistTemplate into
// one flat job checklist (e.g. Install checklist + Inspection checklist),
// deduped by serviceId so a service appearing as multiple line items (a
// quantity split, say) doesn't duplicate its checklist. Single shared
// implementation so every job-creation call site (new job, estimate→job
// conversion, recurring next-occurrence) builds the same combined list the
// same way, rather than each one reimplementing — and possibly disagreeing
// on — the combine logic.
export const buildChecklistFromServices = (
  lineItems: Array<{ serviceId?: string }> | undefined,
  services: Array<{ id: string; checklistTemplate?: Array<{ label: string; required?: boolean; photoRequired?: boolean }> }> | undefined
): Array<{ id: string; label: string; done: boolean; required?: boolean; photoRequired?: boolean }> => {
  // id included (not just label/done) so this same array can seed BOTH the
  // legacy job.checklist field (CrewView/JobsPage progress %) and the real
  // field-portal checklist (job.preChecklist, which is what EmployeePortal.tsx
  // actually shows the crew — it only falls back to hardcoded PRE_DEFAULTS
  // when empty, so this is what makes custom items visible in the field,
  // not just sit unused in the legacy field).
  const combined: Array<{ id: string; label: string; done: boolean; required?: boolean; photoRequired?: boolean }> = [];
  const seenServiceIds = new Set<string>();
  for (const li of lineItems || []) {
    if (!li.serviceId || seenServiceIds.has(li.serviceId)) continue;
    seenServiceIds.add(li.serviceId);
    const svc = (services || []).find(s => s.id === li.serviceId);
    for (const item of svc?.checklistTemplate || []) {
      combined.push({ id: uid(), label: item.label, done: false, required: item.required, photoRequired: item.photoRequired });
    }
  }
  if (seenServiceIds.size > 1) console.log("[Verify] custom checklists per service (combining) — working — combined", seenServiceIds.size, "services into", combined.length, "items");
  return combined;
};

// FEATURE 3 — single source of truth for "what's the next occurrence date"
// across all recurring-schedule modes, so the owner-side (JobsPage.tsx) and
// employee-side (EmployeePortal.tsx) Complete-Job flows can never compute two
// different next dates for the same job (the exact "two independent copies
// of the same logic disagree" bug class this codebase has hit before).
export const computeNextRecurringDate = (job: { recurringMode?: string; recurringFreq?: string; recurringInterval?: number; recurringWeekdays?: number[]; scheduledDate?: string }, fromDateStr?: string): string => {
  const from = new Date((fromDateStr || job.scheduledDate || today()) + "T12:00:00");
  const mode = job.recurringMode || "preset";
  if (mode === "weekdays" && Array.isArray(job.recurringWeekdays) && job.recurringWeekdays.length > 0) {
    const wanted = new Set(job.recurringWeekdays);
    const d = new Date(from);
    for (let i = 1; i <= 14; i++) {
      d.setDate(from.getDate() + i);
      if (wanted.has(d.getDay())) return d.toISOString().slice(0, 10);
    }
    return from.toISOString().slice(0, 10);
  }
  if (mode === "days") {
    const n = Math.max(1, Number(job.recurringInterval) || 1);
    const d = new Date(from); d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }
  if (mode === "weeks") {
    const n = Math.max(1, Number(job.recurringInterval) || 1);
    const d = new Date(from); d.setDate(d.getDate() + n * 7);
    return d.toISOString().slice(0, 10);
  }
  if (mode === "months") {
    const n = Math.max(1, Number(job.recurringInterval) || 1);
    const d = new Date(from); d.setMonth(d.getMonth() + n);
    return d.toISOString().slice(0, 10);
  }
  // Preset (back-compat): fixed day-count lookup, same table used before
  // custom schedules existed.
  const days = recurringFreqs.find(f => f.key === job.recurringFreq)?.days || 30;
  const d = new Date(from); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// AUDIT A (mobile round 4) — the Jobs list badge used to always print
// job.recurringFreq regardless of recurringMode, so a "days"/"weeks"/
// "months"/"weekdays" schedule (anything but the legacy "preset" mode)
// showed a misleading label like "monthly" even when the actual schedule was
// e.g. "every 2 weeks" or "Mon/Wed". Single shared label builder so the Jobs
// list, Estimates list, and Calendar can't independently drift on this again.
export const describeRecurringSchedule = (job: { recurringMode?: string; recurringFreq?: string; recurringInterval?: number; recurringWeekdays?: number[] } | undefined | null): string => {
  if (!job) return "";
  const mode = job.recurringMode || "preset";
  if (mode === "weekdays") {
    const days = (job.recurringWeekdays || []).map(i => weekdayLabels[i]).filter(Boolean);
    return days.length ? days.join("/") : "weekly";
  }
  if (mode === "days") return "every " + Math.max(1, Number(job.recurringInterval) || 1) + "d";
  if (mode === "weeks") return "every " + Math.max(1, Number(job.recurringInterval) || 1) + "wk";
  if (mode === "months") return "every " + Math.max(1, Number(job.recurringInterval) || 1) + "mo";
  return recurringFreqs.find(f => f.key === job.recurringFreq)?.label || job.recurringFreq || "recurring";
};

export const equipmentList = [
  "Ladder",
  "Hand tools",
  "Power tools",
  "Safety gear (PPE)",
  "Extension cords",
  "Work vehicle / trailer",
];

export const requiredChemicalsList = [
  "Cleaning supplies",
  "Fasteners & hardware",
  "Paint / sealant",
  "Replacement parts",
];

export const jobTagOptions = [
  "Emergency", "Warranty", "Follow-up", "HOA", "Commercial", "VIP",
];

export const expenseCats = [
  "Fuel", "Materials", "Equipment", "Insurance", "Marketing",
  "Truck Payment", "Maintenance", "Subcontractors", "Office", "Other",
];

// ─── Alfred personalities ─────────────────────────────────────────────────────

export interface Personality {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  systemPrompt: string;
  greeting?: string;
  icon?: string;
  color?: string;
}

// FIX 6 — these systemPrompt strings are the single source of truth for how
// each personality actually talks (AlfredPage.tsx looks these up by `id`,
// not by array position — see the fix note there for why that mattered).
export const personalities: Personality[] = [
  {
    id: "drillsergeant",
    name: "Drill Sergeant",
    emoji: "🪖",
    desc: "No excuses. Get to work.",
    systemPrompt: "You are Alfred, AI chief-of-staff for CRM Starter, a service business in your area. Personality: DRILL SERGEANT. Be aggressive and motivating — every response is a pep talk crossed with an order. Use military terminology constantly (mission, sitrep, deploy, fall in line, at ease, dismissed, roger that, no excuses soldier). Use ALL CAPS for emphasis on key words or commands (e.g. 'GET THAT INVOICE OUT NOW' / 'OUTSTANDING WORK'). Keep responses SHORT and punchy — 2-4 lines usually. Call out laziness or slipping numbers hard. Celebrate wins hard. End every response with 'Alfred out.'",
    greeting: "LISTEN UP. What's the mission today? Alfred out.",
  },
  {
    id: "butler",
    name: "Butler",
    emoji: "🎩",
    desc: "Refined, efficient, loyal.",
    systemPrompt: "You are Alfred, a distinguished AI chief-of-staff for CRM Starter in your area. Personality: a formal, composed British butler. Always address the user as 'sir'. Be courteous, polished, and refined in every response — use British expressions and vocabulary (e.g. 'right away, sir', 'quite so', 'brilliant', 'I dare say', 'splendid', 'shall I'). Anticipate needs before being asked. Never use slang or casual American phrasing. Keep responses concise and unfailingly professional. End responses with 'Your servant, Alfred.'",
    greeting: "Good day, sir. How may I be of service?",
  },
  {
    id: "quietpro",
    name: "Quiet Pro",
    emoji: "🧠",
    desc: "Facts only. No filler.",
    systemPrompt: "You are Alfred, a no-nonsense AI assistant for CRM Starter in your area. Personality: silent professional. Terse and data-driven — lead with numbers and facts, prefer bullet points over prose. Skip pleasantries ON BUSINESS ANSWERS ONLY: no greeting/sign-off padding around a stats lookup or task result, no restating the question, no filler. This governs TONE, not topic — if the owner is just chatting or asks something off-work, still answer it, just keep your reply short and plain rather than warm.",
    greeting: "Ready.",
  },
  {
    id: "savage",
    name: "Savage Mode",
    emoji: "🔥",
    desc: "Roasts you into productivity.",
    systemPrompt: "You are Alfred in Savage Mode for CRM Starter in your area. Personality: roast comedian crossed with a sharp business coach. Sarcastic, witty, and brutally honest — roast the user's slipping numbers or procrastination, don't hold back on the jokes. Underneath the roasting, always be genuinely helpful and push them to actually improve. Never actually cruel or harmful, just savage. End with 'Stay dangerous. — Alfred'",
    greeting: "Oh look who decided to show up. What do you need? — Alfred",
  },
];

// ─── Weather helpers ──────────────────────────────────────────────────────────

export const weatherRisk = (rainChance: number, temp: number, wind: number): "none" | "rain" | "freeze" | "wind" | "hot" => {
  if (temp < 35) return "freeze";
  if (rainChance > 50) return "rain";
  if (wind > 20) return "wind";
  if (temp > 90) return "hot";
  return "none";
};

export const forecastFor = <T extends { date: string }>(forecast: T[], dateStr: string): T | undefined =>
  forecast.find(f => f.date === dateStr);

// ─── Automation helpers ───────────────────────────────────────────────────────

export const normalizeAutomation = (a: Record<string, unknown>) => ({
  id: (a.id as string) ?? uid(),
  name: (a.name as string) ?? "Untitled",
  trigger: (a.trigger as string) ?? "",
  action: (a.action as string) ?? "",
  active: (a.active as boolean) ?? false,
  lastTriggered: (a.lastTriggered as string | null) ?? null,
  count: (a.count as number) ?? 0,
  steps: (a.steps as unknown[]) ?? [],
  description: (a.description as string) ?? "",
});

// ─── Employee job rating ──────────────────────────────────────────────────────
// Scores a single completed job out of 100: on-time arrival (30pts), checklist
// completion (40pts), customer sign-off obtained (30pts). Used to roll up an
// employee's overall rating after each job they complete.
export const computeJobRatingScore = (job: Record<string, any>): number => {
  let score = 0;
  // On-time arrival
  if (job.scheduledDate && job.clockInAt) {
    const scheduled = new Date(`${job.scheduledDate}T${job.scheduledTime || "09:00"}:00`).getTime();
    const lateMinutes = (job.clockInAt - scheduled) / 60000;
    if (lateMinutes <= 5) score += 30;
    else if (lateMinutes <= 15) score += 20;
    else if (lateMinutes <= 30) score += 10;
  } else {
    score += 15; // no schedule to judge against — neutral credit
  }
  // Checklist completion
  const allItems = [...(job.preChecklist || []), ...(job.duringChecklist || []), ...(job.postChecklist || [])];
  if (allItems.length > 0) {
    score += Math.round((allItems.filter((i: any) => i.done).length / allItems.length) * 40);
  } else {
    score += 20;
  }
  // Customer sign-off
  if (job.signOff) score += 30;
  return Math.max(0, Math.min(100, score));
};

// ─── IRS Rate (mileage deduction) ────────────────────────────────────────────

export const IRS_RATE = 0.67; // 2024 rate per mile

// ─── Per-job-type pay rate override ──────────────────────────────────────────
// Employees have a default hourlyRate plus optional overrides keyed by job
// type (employee.jobTypeRates = { residential: 15, commercial: 18, ... }).
// A job's own jobType (falling back to its linked customer address's
// propertyType, since older jobs never set jobType directly) decides which
// override applies; no override/no match falls back to the flat hourlyRate.
export const getEffectiveRate = (employee: any, job: any): number => {
  const jobType = job?.jobType || job?.propertyType;
  const override = jobType ? employee?.jobTypeRates?.[jobType] : undefined;
  return override !== undefined && override !== null && override !== ("" as any)
    ? Number(override) || 0
    : Number(employee?.hourlyRate) || 0;
};

// ─── Job <-> Supabase columns ─────────────────────────────────────────────────
// The `jobs` table's columns are named to match the Job type's camelCase field
// names exactly (e.g. "customerId", "scheduledDate") — see the SQL in the
// Supabase SQL editor that adds these camelCase columns. No code-side mapping
// is needed; reads/writes pass Job objects straight through to Supabase.

// ─── withTimeout ──────────────────────────────────────────────────────────────
// Races a promise against a hard timeout so a hung await (no error, no
// resolve — e.g. a stuck Supabase internal navigator-lock, or a dead network
// request) can never block a button's loading state forever. A normal
// rejection from the wrapped promise still propagates to the caller as usual.
// FEATURE — "different [terms] versions for different job types (commercial
// vs residential)." Settings stores termsAndConditionsResidential/
// termsAndConditionsCommercial; this is the one place that picks between
// them so every consumer (customer sign-off, estimate default terms) agrees
// on the same fallback chain instead of each reimplementing it slightly
// differently.
export const resolveTermsForJobType = (settings: any, jobType?: string): string => {
  if (jobType === "commercial" && settings?.termsAndConditionsCommercial) return settings.termsAndConditionsCommercial;
  return settings?.termsAndConditionsResidential || settings?.termsAndConditions || "";
};

// ─── haptic ─────────────────────────────────────────────────────────────
// Re-exported from lib/haptics.ts — was a second, independent copy of the
// exact same function (drift risk: a future fix to one wouldn't reach the
// other). See haptics.ts for the real implementation and its full comment
// on the iOS platform limitation / Android gesture-reliability notes.
export { haptic } from "./haptics";

export const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label + " timed out")), ms)),
  ]);

// ─── computeGoalProgress ────────────────────────────────────────────────────
// Growth goals (GoalsPage.tsx) auto-track their `current` value from real
// jobs/customers data for every metric except "custom" (which keeps the old
// manually-typed-in current). Shared here (rather than living only in
// GoalsPage) because App.tsx's own reminder/celebration effect needs the
// exact same numbers to decide when a goal has actually been hit — computing
// it twice, slightly differently, would let the two silently disagree.
export const computeGoalProgress = (g: any, data: { jobs?: any[]; customers?: any[] }): { current: number; target: number; pct: number } => {
  const since = g.createdAt || "1970-01-01";
  const jobs = data.jobs || [];
  const customers = data.customers || [];
  let current = Number(g.current) || 0;
  const completedSince = () => jobs.filter((j: any) => j.status === "completed" && (j.scheduledDate || "") >= since);
  switch (g.metric) {
    case "revenue":
      current = completedSince().reduce((s: number, j: any) => s + (Number(j.amount) || 0), 0);
      break;
    case "jobs":
      current = completedSince().length;
      break;
    case "clients":
      current = customers.filter((c: any) => (c.createdAt || "") >= since).length;
      break;
    case "recurringClients":
      current = customers.filter((c: any) => c.recurringPayment?.enabled).length;
      break;
    case "leads":
      current = customers.filter((c: any) => c.pipelineStage === "lead" && !c.leadArchived && (c.createdAt || "") >= since).length;
      break;
    default:
      current = Number(g.current) || 0;
  }
  const target = Number(g.target) || 0;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return { current, target, pct };
};

// ─── stripLegacyJobFields ───────────────────────────────────────────────────
// organizationId/org_id have been added to a job payload twice now on the
// strength of evidence that didn't hold up — the column has never existed on
// this deployment (see JobsPage.tsx/AlfredPage.tsx revert comments). The real
// danger isn't the insert that adds it — it's that once such a field lands on
// a job object sitting in React state (and therefore in the "crm.jobs"
// localStorage cache via usePersistent), EVERY future spread of that job
// object (the 30s bulk autosave, "complete recurring job" duplicating it into
// next occurrence, etc.) carries it forward and keeps failing, even after the
// code that originally added it is reverted. Stripping defensively at every
// write site self-heals any job already poisoned in a user's browser instead
// of requiring them to clear localStorage.
const LEGACY_BAD_JOB_FIELDS = ["organizationId", "org_id"] as const;
export const stripLegacyJobFields = <T extends Record<string, any>>(job: T): T => {
  const copy: any = { ...job };
  LEGACY_BAD_JOB_FIELDS.forEach(f => delete copy[f]);
  return copy;
};

// ─── reconcileCrewAfterAssign ───────────────────────────────────────────────
// Four independent places compute a job's new crew array the same way:
// read whatever `crew` this surface's own local state last knew about,
// append/accept, blind-overwrite the whole array back to Supabase.
//   - JobDetailModal.tsx toggleCrew (owner direct-assign, every Edit Job UI)
//   - EmployeePortal.tsx handleAcceptRequest / handleInlineAccept (employee
//     accepting a pending request)
//   - AlfredPage.tsx's assign_employee tool
// None of them know about each other's in-flight writes, and `crew` is a
// plain JSONB array (not a Postgres array column), so there's no DB-side
// atomic append to fall back on. If two of these fire close together for
// the SAME job from two different actors/devices — the exact pattern of
// testing "assign X directly" and "request Y then have Y accept" back to
// back — each computes its new array from a snapshot that doesn't know
// about the other's addition, and whichever write reaches Supabase LAST
// silently overwrites the other's, dropping that person from the crew with
// no error anywhere. This is almost certainly why assignment/requests have
// seemed to "come and go" with no obvious trigger.
// This can't be made fully atomic without a Postgres function, but
// re-reading the live row immediately after writing and merging in anyone
// present there but missing from what was just written shrinks the danger
// window from "however stale local state is" (up to a full poll interval,
// tens of seconds) down to a single round trip. `writeFn` is whatever the
// caller normally uses to persist a patch, so this reuses each surface's
// own retry/toast/error handling rather than writing raw.
export const reconcileCrewAfterAssign = async (
  jobId: string,
  writtenCrew: string[],
  writtenCrewAssignedAt: Record<string, number>,
  writeFn: (patch: { crew: string[]; crewAssignedAt: Record<string, number> }) => void | Promise<any>
): Promise<void> => {
  try {
    const { data } = await (supabase as any).from("jobs").select("crew, crewAssignedAt").eq("id", jobId).maybeSingle();
    const liveCrew: any[] = Array.isArray(data?.crew) ? data.crew : [];
    const missing = liveCrew.filter(id => !writtenCrew.includes(id));
    if (missing.length === 0) return;
    console.warn("[CrewRace] another actor added", missing, "to job", jobId, "between our read and write — merging instead of overwriting");
    const merged = [...writtenCrew, ...missing];
    const mergedAssignedAt = { ...(data?.crewAssignedAt || {}), ...writtenCrewAssignedAt };
    await writeFn({ crew: merged, crewAssignedAt: mergedAssignedAt });
  } catch (e: any) {
    console.warn("[CrewRace] reconcile check failed (non-fatal):", e?.message);
  }
};

// ─── Timeout-safe insert retries ───────────────────────────────────────────
// withTimeout() rejecting on an insert means the CLIENT gave up waiting —
// not that the write failed server-side. Under real-world Supabase slowness
// (e.g. an over-quota/throttled project), the original request can still
// land a few seconds after the 15s window lapses. A naive "just retry" is
// unsafe though: retrying blindly can create a genuine duplicate row. These
// two helpers make retrying safe for the two shapes of insert this app does.

// For inserts where WE pick the id client-side (uid()) before writing — e.g.
// jobs. If the first attempt actually landed, Postgres rejects the identical
// retry with a primary-key violation, which reads as "already saved" instead
// of a real failure. Never use this for a server-generated-id table.
export const isDuplicateKeyError = (error: any): boolean =>
  error?.code === "23505" || /duplicate key/i.test(error?.message || "");

export const insertClientIdRowWithRetry = async (
  table: string,
  row: { id: string; [k: string]: any }
): Promise<{ error: any }> => {
  try {
    return await withTimeout<any>((supabase as any).from(table).insert(row), 30000, `Save ${table}`);
  } catch (e: any) {
    if (!String(e?.message || "").includes("timed out")) throw e;
    console.warn(`[insertClientIdRowWithRetry] ${table} insert timed out — retrying once (duplicate-key response on retry means the first attempt actually landed)`);
    const retry: any = await withTimeout<any>((supabase as any).from(table).insert(row), 30000, `Save ${table} (retry after timeout)`).catch((e2: any) => ({ error: e2 }));
    if (!retry?.error || isDuplicateKeyError(retry.error)) return { error: null };
    return retry;
  }
};

// job_requests.id is server-generated (gen_random_uuid()) — a blind retry
// would leave two live "pending" rows for the same job+employee. Check for a
// just-created matching request before retrying; if the first attempt
// actually landed, use that row instead of inserting a second one.
export const insertJobRequestSafely = async (payload: {
  job_id: string; employee_id: string; owner_id: string; status?: string; message?: string | null;
}): Promise<{ data: { id: string } | null; error: any }> => {
  try {
    return await withTimeout<any>(
      (supabase as any).from("job_requests").insert(payload).select("id").single(),
      30000, "Save request"
    );
  } catch (e: any) {
    if (!String(e?.message || "").includes("timed out")) throw e;
    console.warn("[insertJobRequestSafely] insert timed out — checking whether it landed before retrying");
    const existing: any = await withTimeout<any>(
      (supabase as any).from("job_requests").select("id").eq("job_id", payload.job_id).eq("employee_id", payload.employee_id)
        .eq("status", payload.status || "pending").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      8000, "Check existing request"
    ).catch(() => ({ data: null }));
    if (existing?.data?.id) {
      console.log("[insertJobRequestSafely] found the original request — it actually saved, just responded slowly");
      return { data: existing.data, error: null };
    }
    return await withTimeout<any>(
      (supabase as any).from("job_requests").insert(payload).select("id").single(),
      30000, "Save request (retry after timeout)"
    ).catch((e2: any) => ({ data: null, error: e2 }));
  }
};

const JOB_MEDIA_BUCKET = "job-media";

// Uploads a photo/video/signature to the job-media Storage bucket and
// returns its public URL — or `null` on ANY failure (bucket/policy not
// applied yet — see supabase/migrations/0017 — offline, timeout, etc.).
// Callers MUST treat null as "fall back to the dataUrl behavior from before
// this migration," never as a thrown error — this function itself never
// throws, so photo capture can never regress to worse than it was before
// Storage existed.
export const uploadJobMedia = async (blob: Blob, path: string, contentType?: string): Promise<string | null> => {
  try {
    const { error } = await withTimeout<any>(
      (supabase as any).storage.from(JOB_MEDIA_BUCKET).upload(path, blob, {
        contentType: contentType || blob.type || "application/octet-stream",
        upsert: true,
      }),
      15000,
      "Media upload to Storage"
    );
    if (error) { console.warn("[uploadJobMedia] upload failed, falling back to inline dataUrl:", error.message); return null; }
    const { data } = (supabase as any).storage.from(JOB_MEDIA_BUCKET).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e: any) {
    console.warn("[uploadJobMedia] threw, falling back to inline dataUrl:", e?.message);
    return null;
  }
};

// FEATURE — photo/video auto-deletion (owner opt-in, Settings → Data;
// disabled by default — see settings.mediaRetentionDays). Recovers the
// job-media Storage object's path from the public URL uploadJobMedia's
// getPublicUrl() produced, since deleting from Storage needs the path, not
// the URL. Returns null for legacy dataUrl-only media (nothing in Storage to
// delete for those — clearing the JSONB field is enough).
export const jobMediaPathFromUrl = (url: string): string | null => {
  const marker = `/object/public/${JOB_MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
};

// FEATURE — "once published, don't keep full videos/photos in backend
// storage, just a small preview." Deletes the given full-size media
// objects from the shared job-media Storage bucket by their public URL —
// used once a Social post is confirmed published and its lightweight
// thumbnail (see makeMediaThumbnail in SocialPage.tsx) has already
// replaced the reference, so nothing is lost, only the large original.
// Generates a small (max 480px) JPEG thumbnail from a photo OR the first
// frame of a video — client-side, via canvas, no server cost. Used to
// replace a full-size Social post attachment with a lightweight preview
// once it's confirmed published (see deleteJobMediaByUrl above and
// SocialPage.tsx's onPostPublished cleanup) — the original still lives on
// the actual platform the post went to, so keeping a full copy here is
// pure wasted storage.
export const makeMediaThumbnail = (url: string, mediaType: "image" | "video"): Promise<Blob | null> =>
  new Promise((resolve) => {
    const MAX_DIM = 480;
    const toThumb = (source: HTMLImageElement | HTMLVideoElement, w: number, h: number) => {
      const scale = Math.min(1, MAX_DIM / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => resolve(b), "image/jpeg", 0.75);
    };
    if (mediaType === "image") {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => toThumb(img, img.naturalWidth, img.naturalHeight);
      img.onerror = () => resolve(null);
      img.src = url;
    } else {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.preload = "metadata";
      video.onloadeddata = () => toThumb(video, video.videoWidth, video.videoHeight);
      video.onerror = () => resolve(null);
      video.src = url;
      video.currentTime = 0.1; // nudge past frame 0, which is often black on a lot of phone-recorded clips
    }
  });

// FEATURE — "make sure taxes are correct for the owner's state." State BASE
// sales tax rates (as of this writing) — a real, defensible starting point
// per state, NOT a full jurisdiction-accurate calculation. Actual charged
// tax often also includes county/city add-ons on top of this, and whether
// a SERVICE (vs. tangible goods) is taxable at all varies by state and
// isn't captured here either — this is intentionally presented in Settings
// as a starting suggestion the owner can verify/adjust, not an authoritative
// final number (that would need a real tax API like TaxJar/Avalara, which
// this app doesn't integrate).
export const US_STATE_BASE_TAX_RATES: Record<string, number> = {
  AL: 4, AK: 0, AZ: 5.6, AR: 6.5, CA: 7.25, CO: 2.9, CT: 6.35, DE: 0, FL: 6, GA: 4,
  HI: 4, ID: 6, IL: 6.25, IN: 7, IA: 6, KS: 6.5, KY: 6, LA: 4.45, ME: 5.5, MD: 6,
  MA: 6.25, MI: 6, MN: 6.875, MS: 7, MO: 4.225, MT: 0, NE: 5.5, NV: 6.85, NH: 0,
  NJ: 6.625, NM: 4.875, NY: 4, NC: 4.75, ND: 5, OH: 5.75, OK: 4.5, OR: 0, PA: 6,
  RI: 7, SC: 6, SD: 4.2, TN: 7, TX: 6.25, UT: 4.85, VT: 6, VA: 5.3, WA: 6.5,
  WV: 6, WI: 5, WY: 4, DC: 6,
};
const US_STATE_NAME_TO_CODE: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN",
  mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK", oregon: "OR",
  pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA",
  "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};
// Parses a free-text business address ("412 Oak Ridge Ln, your area 17403")
// into a 2-letter state code — same comma-split + trailing-segment
// approach lib/weather.ts's deriveWeatherLocation already uses for this
// address format, reused here rather than duplicated with different logic.
export const guessStateCodeFromAddress = (address: string): string | null => {
  const parts = (address || "").split(",").map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  const codeMatch = last.match(/\b([A-Z]{2})\b/);
  if (codeMatch && US_STATE_BASE_TAX_RATES[codeMatch[1]] !== undefined) return codeMatch[1];
  const nameOnly = last.replace(/\d+/g, "").trim().toLowerCase();
  return US_STATE_NAME_TO_CODE[nameOnly] || null;
};

export const deleteJobMediaByUrl = async (urls: (string | undefined | null)[]): Promise<void> => {
  const paths = urls.filter((u): u is string => !!u).map(jobMediaPathFromUrl).filter((p): p is string => !!p);
  if (paths.length === 0) return;
  try { await (supabase as any).storage.from(JOB_MEDIA_BUCKET).remove(paths); }
  catch (e: any) { console.warn("[MediaCleanup] Storage delete failed:", e?.message); }
};

// Sweeps completed jobs older than `retentionDays` and strips their
// photos/videos/checklist-item photos (both the JSONB references AND the
// actual Storage objects behind any `url`-backed one) — irreversible, only
// ever called when the owner has explicitly enabled this in Settings.
// Signatures (job.signOff) are deliberately left untouched — they're a
// service/approval record, not capture media. Called once per session from
// wherever it's wired in (see Dashboard.tsx), same "runs on page load,
// harmless no-op if nothing qualifies" pattern as Alfred's 7-day cleanup.
export const purgeOldJobMedia = async (
  jobs: any[],
  retentionDays: number,
  setJobs: (updater: (prev: any[]) => any[]) => void
): Promise<{ jobsPurged: number; filesDeleted: number }> => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const CHECKLIST_KEYS = ["preChecklist", "duringChecklist", "postChecklist"] as const;
  const hasMedia = (j: any) =>
    (j.photos || []).length > 0 || (j.videos || []).length > 0 ||
    CHECKLIST_KEYS.some(k => ((j[k] || []) as any[]).some((it: any) => (it.photos || []).length > 0));
  const candidates = jobs.filter(j => j.status === "completed" && j.scheduledDate && j.scheduledDate < cutoffStr && hasMedia(j));
  if (candidates.length === 0) return { jobsPurged: 0, filesDeleted: 0 };

  const paths: string[] = [];
  const collect = (arr: any[]) => (arr || []).forEach((m: any) => { const p = m.url && jobMediaPathFromUrl(m.url); if (p) paths.push(p); });
  for (const j of candidates) {
    collect(j.photos);
    collect(j.videos);
    for (const k of CHECKLIST_KEYS) for (const it of (j[k] || []) as any[]) collect(it.photos);
  }
  if (paths.length > 0) {
    try { await (supabase as any).storage.from(JOB_MEDIA_BUCKET).remove(paths); }
    catch (e: any) { console.warn("[MediaRetention] Storage delete failed (still clearing DB references):", e?.message); }
  }

  const stripJob = (j: any) => ({
    ...j,
    photos: [], videos: [],
    ...Object.fromEntries(CHECKLIST_KEYS.map(k => [k, (j[k] || []).map((it: any) => ({ ...it, photos: [] }))])),
  });
  const idSet = new Set(candidates.map(j => j.id));
  for (const j of candidates) {
    const stripped = stripJob(j);
    const patch = { photos: [], videos: [], preChecklist: stripped.preChecklist, duringChecklist: stripped.duringChecklist, postChecklist: stripped.postChecklist };
    await (supabase as any).from("jobs").update(patch).eq("id", j.id).then((r: any) => {
      if (r?.error) console.warn("[MediaRetention] job", j.id, "DB clear failed:", r.error.message);
    }).catch((e: any) => console.warn("[MediaRetention] job", j.id, "DB clear threw:", e?.message));
  }
  setJobs(prev => prev.map(j => idSet.has(j.id) ? stripJob(j) : j));
  console.log(`[MediaRetention] purged media from ${candidates.length} job(s) older than ${retentionDays} days, deleted ${paths.length} Storage file(s)`);
  return { jobsPurged: candidates.length, filesDeleted: paths.length };
};

// FEATURE — backfill: existing jobs captured BEFORE the Storage migration
// (see uploadJobMedia above) still carry full base64 photos/videos/signatures
// inline in the `jobs` table's JSONB columns — the original root cause of
// this project's Supabase egress overage (see supabase/migrations/0017).
// New captures already go to Storage; this is the one-time cleanup pass for
// everything captured before that existed. Owner-triggered only (Settings →
// Data), never automatic — rewriting/removing dataUrl is not reversible once
// the old row is overwritten, so each item is only stripped of its dataUrl
// AFTER its Storage upload is confirmed to have succeeded.
export interface MediaBackfillResult {
  jobsScanned: number;
  jobsUpdated: number;
  itemsMigrated: number;
  itemsFailed: number;
  bytesFreedApprox: number;
}

const dataUrlByteLength = (dataUrl: string): number => {
  const b64 = dataUrl.split(",")[1] || "";
  return Math.floor((b64.length * 3) / 4);
};

export const backfillJobMediaToStorage = async (
  jobs: any[],
  setJobs: (updater: (prev: any[]) => any[]) => void,
  onProgress?: (done: number, total: number) => void
): Promise<MediaBackfillResult> => {
  const CHECKLIST_KEYS = ["preChecklist", "duringChecklist", "postChecklist"] as const;
  const needsMigration = (j: any) =>
    (j.photos || []).some((p: any) => p.dataUrl && !p.url) ||
    (j.videos || []).some((v: any) => v.dataUrl && !v.url) ||
    (j.signOff?.sigData && !j.signOff?.sigUrl) ||
    CHECKLIST_KEYS.some(k => ((j[k] || []) as any[]).some((it: any) => (it.photos || []).some((p: any) => p.dataUrl && !p.url)));

  const candidates = jobs.filter(needsMigration);
  const result: MediaBackfillResult = { jobsScanned: candidates.length, jobsUpdated: 0, itemsMigrated: 0, itemsFailed: 0, bytesFreedApprox: 0 };
  if (candidates.length === 0) return result;

  // Migrates one photo/video-shaped item {id, dataUrl, ...} in place — on a
  // successful upload, dataUrl is deleted (base64 actually leaves the row)
  // and url is set; on failure the item is left completely untouched so it's
  // simply picked up again on the next run.
  const migrateItem = async (item: any, pathPrefix: string, defaultExt: string, defaultType: string): Promise<boolean> => {
    if (!item.dataUrl) return false;
    try {
      const blob = dataUrlToBlob(item.dataUrl);
      const url = await uploadJobMedia(blob, `${pathPrefix}-${item.id}.${defaultExt}`, blob.type || defaultType);
      if (!url) { result.itemsFailed++; return false; }
      result.bytesFreedApprox += dataUrlByteLength(item.dataUrl);
      delete item.dataUrl;
      item.url = url;
      result.itemsMigrated++;
      return true;
    } catch (e: any) {
      console.warn("[MediaBackfill] item", item.id, "failed:", e?.message);
      result.itemsFailed++;
      return false;
    }
  };

  let done = 0;
  for (const original of candidates) {
    const j = JSON.parse(JSON.stringify(original)); // deep clone — mutate freely, only commit on success
    let changed = false;

    for (const p of (j.photos || [])) if (p.dataUrl && !p.url) changed = (await migrateItem(p, `${j.id}/photo`, "jpg", "image/jpeg")) || changed;
    for (const v of (j.videos || [])) if (v.dataUrl && !v.url) changed = (await migrateItem(v, `${j.id}/video`, "mp4", "video/mp4")) || changed;
    for (const k of CHECKLIST_KEYS) for (const it of (j[k] || []) as any[]) for (const p of (it.photos || [])) if (p.dataUrl && !p.url) changed = (await migrateItem(p, `${j.id}/checklist`, "jpg", "image/jpeg")) || changed;
    // Signature uses a differently-named field (sigData/sigUrl, not
    // dataUrl/url) — handle it directly rather than forcing it through
    // migrateItem's generic {dataUrl/url} shape.
    if (j.signOff?.sigData && !j.signOff?.sigUrl) {
      try {
        const blob = dataUrlToBlob(j.signOff.sigData);
        const url = await uploadJobMedia(blob, `${j.id}/signature-${j.id}.png`, "image/png");
        if (url) {
          result.bytesFreedApprox += dataUrlByteLength(j.signOff.sigData);
          delete j.signOff.sigData;
          j.signOff.sigUrl = url;
          result.itemsMigrated++;
          changed = true;
        } else {
          result.itemsFailed++;
        }
      } catch (e: any) {
        console.warn("[MediaBackfill] signature for job", j.id, "failed:", e?.message);
        result.itemsFailed++;
      }
    }

    if (changed) {
      const patch = { photos: j.photos, videos: j.videos, preChecklist: j.preChecklist, duringChecklist: j.duringChecklist, postChecklist: j.postChecklist, signOff: j.signOff };
      const { error } = await (supabase as any).from("jobs").update(patch).eq("id", j.id);
      if (error) {
        console.warn("[MediaBackfill] job", j.id, "DB update failed:", error.message);
      } else {
        result.jobsUpdated++;
        setJobs(prev => prev.map(p => p.id === j.id ? { ...p, ...patch } : p));
      }
    }
    done++;
    onProgress?.(done, candidates.length);
  }
  console.log(`[MediaBackfill] scanned ${result.jobsScanned} job(s), updated ${result.jobsUpdated}, migrated ${result.itemsMigrated} item(s), ${result.itemsFailed} failed, ~${(result.bytesFreedApprox / 1024 / 1024).toFixed(1)}MB freed from the database`);
  return result;
};

// ITEM 10 — real OS-level "push-like" alerts for the owner (e.g. an employee's
// Report Problem) using the browser's built-in Notification API. This fires
// as long as the browser is running, even if the CRM tab isn't focused —
// there is NO server component here, so unlike true mobile push it can't
// reach the owner once the browser itself is fully closed; that would need a
// service worker + VAPID keys + a server endpoint to send from, which this
// single-page app (no backend server — see docs/ARCHITECTURE.md) doesn't have yet.
// Callers must never depend on this actually showing anything (permission
// may be denied/unsupported) — it's additive to the existing toast/bell and
// email, never a replacement for either.
export const desktopNotifsSupported = (): boolean => typeof window !== "undefined" && "Notification" in window;

export const desktopNotifPermission = (): NotificationPermission | "unsupported" =>
  desktopNotifsSupported() ? Notification.permission : "unsupported";

export const requestDesktopNotifPermission = async (): Promise<boolean> => {
  if (!desktopNotifsSupported()) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try { const result = await Notification.requestPermission(); return result === "granted"; }
  catch { return false; }
};

export const notifyDesktop = (title: string, body?: string, onClick?: () => void): void => {
  if (!desktopNotifsSupported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.ico" });
    // BUG FIX — clock-out/report-problem notifications previously had no
    // click behavior at all; clicking one should bring the owner straight
    // to the relevant screen instead of just dismissing it.
    if (onClick) n.onclick = () => { window.focus(); onClick(); n.close(); };
  } catch { /* best-effort only */ }
};

// BLOCKER 6 (mobile round 9) — Alfred's multi-step tool chains (create
// customer → schedule job → assign employees) each write to Supabase with no
// retry, so one transient network blip on the FIRST step ("create_customer")
// failed the entire chain with no second attempt, even though the operation
// itself is safely re-runnable (a fresh uid() each time means a retry can
// never create a duplicate row from the first attempt half-succeeding).
// `fn` is a factory (not a bare promise) since a promise can only be awaited
// once — retrying means calling it again to get a fresh in-flight request.
export const withTimeoutRetry = async <T,>(fn: () => Promise<T>, ms: number, label: string, retries = 1): Promise<T> => {
  let lastErr: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(fn(), ms, label);
    } catch (e: any) {
      lastErr = e;
      if (attempt < retries) console.warn(`[${label}] attempt ${attempt + 1} failed — retrying:`, e?.message || e);
    }
  }
  throw lastErr;
};

// ─── OAuth intent flag ─────────────────────────────────────────────────────────
// Google sign-in is shared infrastructure between the owner's login page and
// the employee portal's login page — the auth callback alone can't tell which
// one initiated it. Set right before calling signInWithOAuth from the
// EMPLOYEE login screen (consumed once in App.tsx's resolveUserRole) so a
// Google sign-in with no matching employees row falls through to "employee"
// (shows "Account Not Linked") instead of defaulting to "owner".
const OAUTH_INTENT_KEY = "crm.oauthIntent";
export function setOAuthIntent(intent: "employee"): void {
  try { sessionStorage.setItem(OAUTH_INTENT_KEY, intent); } catch { /* ignore */ }
}
export function consumeOAuthIntent(): "employee" | null {
  try {
    const v = sessionStorage.getItem(OAUTH_INTENT_KEY);
    if (v === "employee") { sessionStorage.removeItem(OAUTH_INTENT_KEY); return "employee"; }
  } catch { /* ignore */ }
  return null;
}

// ─── Where to land after a Google sign-in / connect ────────────────────────────
// BUG FIX — connecting (or reconnecting) Google always dropped the owner on
// the Google Workspace page, and so did Supabase quietly re-confirming an
// existing session (it reports that as a fresh "SIGNED_IN"), which looked
// like the app randomly jumping to the Google connection screen. Each
// "Connect Google" button records the page it was pressed on; after the
// OAuth round trip the app returns there (the dashboard for a plain sign-in).
const OAUTH_RETURN_KEY = "smocks.oauthReturnPage";
export function rememberOAuthReturnPage(page?: string): void {
  const p = page || (window.location.hash.replace(/^#\/?/, "").split(/[?&]/)[0]) || "dashboard";
  try { sessionStorage.setItem(OAUTH_RETURN_KEY, p); } catch { /* ignore */ }
}
export function consumeOAuthReturnPage(): string | null {
  try {
    const v = sessionStorage.getItem(OAUTH_RETURN_KEY);
    if (v) { sessionStorage.removeItem(OAUTH_RETURN_KEY); return v; }
  } catch { /* ignore */ }
  return null;
}

// ─── Last-owner-session flag ──────────────────────────────────────────────────
// Lets App.tsx seed hasCrmSession's initial state optimistically so a
// returning owner with a still-valid Supabase session renders straight into
// the dashboard instead of flashing the login form while the real session
// check resolves. Must be cleared (see App.tsx) the instant a session check
// comes back negative, or an expired/cleared session would leave the CRM
// shell rendered with nothing real backing it.
const LAST_OWNER_SESSION_KEY = "crm.lastOwnerSession";
export function getLastOwnerSessionFlag(): boolean {
  try { return localStorage.getItem(LAST_OWNER_SESSION_KEY) === "1"; } catch { return false; }
}
export function setLastOwnerSessionFlag(active: boolean): void {
  try {
    if (active) localStorage.setItem(LAST_OWNER_SESSION_KEY, "1");
    else localStorage.removeItem(LAST_OWNER_SESSION_KEY);
  } catch { /* ignore */ }
}

// FIX 3 — same seeding trick as hasCrmSession above, applied to crmUserId.
// hasCrmSession being seeded true (so a returning owner renders straight into
// the CRM) used to leave a real window where the CRM — including JobsPage's
// crew-assign/request actions — was fully interactive before crmUserId had
// actually resolved from the async session bootstrap (a real network round
// trip). Anything gated on ownerId during that window failed with "still
// finishing sign-in" even though, from the owner's side, they were already
// looking at a fully-rendered Jobs page. Caching the last-known owner id
// (cleared the instant a session check comes back negative/different, same
// as the session flag) lets crmUserId be populated INSTANTLY for a returning
// owner, closing the window entirely for the common case.
const LAST_OWNER_ID_KEY = "crm.lastOwnerId";
export function getLastOwnerId(): string {
  try { return localStorage.getItem(LAST_OWNER_ID_KEY) || ""; } catch { return ""; }
}
export function setLastOwnerId(id: string): void {
  try {
    if (id) localStorage.setItem(LAST_OWNER_ID_KEY, id);
    else localStorage.removeItem(LAST_OWNER_ID_KEY);
  } catch { /* ignore */ }
}

// ─── Route building (round 13, items 19/24) ─────────────────────────────────
// No Google Directions/Distance Matrix integration exists in this codebase
// (would mean a new billed API + a Cloudflare proxy function, out of scope
// for this pass) — this is a straight-line-distance nearest-neighbor route
// instead: greedy, starts from whichever job is scheduled earliest, then
// repeatedly picks the closest remaining stop. It's a real, useful ordering
// (typically within ~25% of true optimal for same-day local routes) using
// only lat/lng already stored on Job (set via AddressAutocomplete), with no
// external API calls or added cost. Jobs missing lat/lng fall back to
// scheduled-time order and are appended at the end, un-optimized.
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface RouteStop { jobId: string; kind: "job" }
export interface RouteLunchStop { kind: "lunch"; afterMinutes: number; durationMinutes: number }
export type RouteEntry = (RouteStop & { estMinutes: number }) | RouteLunchStop;

// Builds a same-day route order for a set of jobs, each needing lat/lng and
// an estimated on-site duration (minutes). Inserts a lunch break entry once
// cumulative elapsed time crosses lunchEarliestMinutes (minutes since route
// start, e.g. 240 = 4 hours in) — 0/undefined lunchMinutes skips it entirely.
export function buildOptimizedRoute(
  jobs: Array<{ id: string; lat?: number; lng?: number; scheduledTime?: string; estMinutes: number }>,
  opts: { lunchMinutes?: number; lunchEarliestMinutes?: number } = {}
): RouteEntry[] {
  const withCoords = jobs.filter(j => typeof j.lat === "number" && typeof j.lng === "number");
  const withoutCoords = jobs.filter(j => !(typeof j.lat === "number" && typeof j.lng === "number"))
    .sort((a, b) => (a.scheduledTime || "23:59").localeCompare(b.scheduledTime || "23:59"));

  const ordered: typeof jobs = [];
  const remaining = [...withCoords].sort((a, b) => (a.scheduledTime || "23:59").localeCompare(b.scheduledTime || "23:59"));
  let current = remaining.shift();
  if (current) ordered.push(current);
  while (remaining.length > 0 && current) {
    let bestIdx = 0, bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMiles(current.lat!, current.lng!, remaining[i].lat!, remaining[i].lng!);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    current = remaining.splice(bestIdx, 1)[0];
    ordered.push(current);
  }
  const fullOrder = [...ordered, ...withoutCoords];

  const lunchMinutes = opts.lunchMinutes || 0;
  const lunchEarliest = opts.lunchEarliestMinutes ?? 240;
  const entries: RouteEntry[] = [];
  let elapsed = 0;
  let lunchInserted = lunchMinutes <= 0;
  for (const j of fullOrder) {
    if (!lunchInserted && elapsed >= lunchEarliest) {
      entries.push({ kind: "lunch", afterMinutes: elapsed, durationMinutes: lunchMinutes });
      elapsed += lunchMinutes;
      lunchInserted = true;
    }
    entries.push({ kind: "job", jobId: j.id, estMinutes: j.estMinutes });
    elapsed += j.estMinutes;
  }
  return entries;
}
