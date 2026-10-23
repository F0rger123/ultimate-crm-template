import { SUPABASE_URL } from "./env";
// employeeCalendarSync.ts — pushes a job onto (or off of) an assigned
// EMPLOYEE's own Google Calendar, from the OWNER's side of an assignment.
//
// EmployeePortal.tsx already has a working sync (syncJobToCalendar) — but it
// only ever runs in the EMPLOYEE's own browser session, using their token
// out of localStorage, triggered when THEY accept/view a job. It never runs
// when the OWNER is the one doing the assigning (JobsPage.tsx, JobDetailModal,
// either Alfred's assign_employee tool) — the owner's browser has no access
// to any employee's Google token at all, so that has to happen server-side,
// with the service-role key, against the employee's own stored
// google_token/google_refresh_token (employees table — see docs/ARCHITECTURE.md).
//
// This is what makes "when I assign someone to a job it should show up on
// their calendar" actually true regardless of which side does the
// assigning, not just when the employee happens to open their own portal.


export type SyncAction = "upsert" | "delete";

export interface SyncOpts {
  employeeId: string;
  ownerId: string | null;
  jobId: string;
  action: SyncAction;
  title?: string;
  date?: string; // YYYY-MM-DD, required for "upsert"
  time?: string; // HH:MM, defaults to 09:00
  durationMinutes?: number; // default 120
  location?: string;
  notes?: string;
  origin: string; // for the /api/google-refresh proxy
}

export type SyncResult = { success: true; eventId?: string } | { skipped: true; reason: string } | { error: string };

export const syncEmployeeJobToCalendar = async (env: Record<string, string>, opts: SyncOpts): Promise<SyncResult> => {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return { skipped: true, reason: "SUPABASE_SERVICE_ROLE_KEY not configured — employee calendar sync needs it to read the employee's stored Google token safely (never exposed to the browser)." };
  const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  const ownerScope = opts.ownerId ? `&owner_id=eq.${encodeURIComponent(opts.ownerId)}` : "";
  const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?id=eq.${encodeURIComponent(opts.employeeId)}&select=google_token,google_refresh_token,google_token_expires_at,autoSyncCalendar${ownerScope}`, { headers: authHeaders });
  const empRows = await empRes.json().catch(() => []);
  const emp = Array.isArray(empRows) ? empRows[0] : null;
  if (!emp) return { skipped: true, reason: "employee not found" };
  if (!emp.google_refresh_token && !emp.google_token) return { skipped: true, reason: "employee hasn't connected their Google account" };
  // BUG FIX — this used to read `autosynccalendar` (all-lowercase) on the
  // theory that the real column had been created unquoted and folded to
  // lowercase (docs/ARCHITECTURE.md's documented casing gotcha) — but that theory was
  // never actually verified against the live schema. There are TWO real
  // columns on this table: a stale `autosynccalendar` (lowercase, defaults
  // false, never written by anything) and the real `"autoSyncCalendar"`
  // (camelCase, properly quoted) that EmployeePortal.tsx's own toggle
  // actually reads and writes. Checking the wrong one meant an employee who
  // correctly turned sync ON in their portal (writing true to the real
  // column) still got silently skipped here forever, because the OTHER,
  // never-updated column still read false.
  if (emp.autoSyncCalendar === false) return { skipped: true, reason: "employee turned off calendar auto-sync in their portal" };

  let accessToken = emp.google_token || "";
  if (emp.google_refresh_token && (!emp.google_token_expires_at || Date.now() > Number(emp.google_token_expires_at) - 60000)) {
    try {
      const refreshRes = await fetch(`${opts.origin}/api/google-refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: emp.google_refresh_token }),
      });
      const refreshData = await refreshRes.json().catch(() => null) as any;
      if (refreshRes.ok && refreshData?.access_token) accessToken = refreshData.access_token;
    } catch { /* fall through with whatever token we have */ }
  }
  if (!accessToken) return { skipped: true, reason: "couldn't get a valid Google token for this employee" };

  // Look up any existing event id for THIS employee on THIS job.
  const jobRes = await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(opts.jobId)}&select=id,crewGoogleEventIds`, { headers: authHeaders });
  const jobRows = await jobRes.json().catch(() => []);
  const job = Array.isArray(jobRows) ? jobRows[0] : null;
  if (!job) return { skipped: true, reason: "job not found" };
  const eventMap: Record<string, string> = job.crewGoogleEventIds || {};
  const existingEventId = eventMap[opts.employeeId];

  if (opts.action === "delete") {
    if (!existingEventId) return { success: true };
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => {});
    const nextMap = { ...eventMap };
    delete nextMap[opts.employeeId];
    await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(opts.jobId)}`, {
      method: "PATCH", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ crewGoogleEventIds: nextMap }),
    }).catch(() => {});
    return { success: true };
  }

  // upsert
  if (!opts.date) return { error: "date required to create/update a calendar event" };
  const startDate = new Date(`${opts.date}T${opts.time || "09:00"}:00`);
  if (isNaN(startDate.getTime())) return { error: "couldn't parse date/time" };
  const endDate = new Date(startDate.getTime() + (opts.durationMinutes || 120) * 60000);
  const body = JSON.stringify({
    summary: opts.title || "Service Job",
    description: opts.notes || "",
    location: opts.location || "",
    start: { dateTime: startDate.toISOString() },
    end: { dateTime: endDate.toISOString() },
  });

  if (existingEventId) {
    const patchRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingEventId)}`, {
      method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body,
    });
    if (patchRes.ok) return { success: true, eventId: existingEventId };
    // Event may have been deleted directly in Google — fall through to create a new one.
  }

  const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body,
  });
  if (!createRes.ok) return { error: "Google Calendar error: " + (await createRes.text().catch(() => "")).slice(0, 200) };
  const created = await createRes.json().catch(() => null) as any;
  if (!created?.id) return { error: "Google Calendar didn't return an event id" };
  await fetch(`${SUPABASE_URL}/rest/v1/jobs?id=eq.${encodeURIComponent(opts.jobId)}`, {
    method: "PATCH", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ crewGoogleEventIds: { ...eventMap, [opts.employeeId]: created.id } }),
  }).catch(() => {});
  return { success: true, eventId: created.id };
};
