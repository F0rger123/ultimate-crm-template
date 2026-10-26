// check-reminders.ts — sends any Alfred SMS reminders (see
// functions/api/_lib/alfredSmsAgent.ts's set_reminder tool) that are now due.
//
// Cloudflare PAGES Functions (this deployment) have no built-in Cron
// Trigger — that's a Workers-only feature requiring a wrangler.toml this
// project deliberately doesn't have (see docs/ARCHITECTURE.md). So this endpoint needs
// something OUTSIDE Cloudflare pinging it on a schedule:
//
// 1. Go to https://cron-job.org (free) or use a GitHub Actions scheduled
//    workflow — anything that can hit a URL every few minutes.
// 2. Point it at: https://<your-domain>/api/check-reminders
// 3. Every 5 minutes is plenty — reminders just fire up to 5 minutes late,
//    never early (a reminder due at 2:00pm sent at 2:03pm is fine; this
//    endpoint only ever sends what's ALREADY due when it runs).
//
// Optional hardening: set REMINDERS_CRON_SECRET in Cloudflare Pages env vars
// and have your pinger call /api/check-reminders?key=<that value> — without
// it, this endpoint is still safe to leave open (it only ever sends
// reminders that already exist and are already due; nothing a caller
// controls), just slightly more guessable as an endpoint to hit repeatedly
// (harmless — sending an already-sent reminder again is prevented by the
// `sent` flag, checked and set atomically per-row below).
import { getOwnerSecrets } from "./_lib/ownerSecrets";
import { SUPABASE_URL } from "./_lib/env";
import { continueBulkSends } from "./_lib/bulkTextSend";
import { runBirthdayOffers } from "./_lib/birthdayOffers";


export const onRequest = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const secret = context.env.REMINDERS_CRON_SECRET;
  if (secret) {
    const key = new URL(context.request.url).searchParams.get("key");
    if (key !== secret) return new Response(JSON.stringify({ error: "Invalid key" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };

  // Same scheduler also finishes owner-approved bulk texts that didn't fit
  // in one go (_lib/bulkTextSend.ts) and sends birthday coupons
  // (_lib/birthdayOffers.ts). Both need migration 0003; without it they
  // find nothing and do nothing.
  const twilioFor = async (ownerId: string) => {
    const s = await getOwnerSecrets(ownerId, serviceRoleKey);
    return s?.twilioAccountSid && s?.twilioAuthToken && s?.twilioFromNumber ? { sid: s.twilioAccountSid, token: s.twilioAuthToken, from: s.twilioFromNumber } : null;
  };
  const companyFor = async (ownerId: string) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data&limit=1`, { headers }).catch(() => null);
    const rows = res ? await res.json().catch(() => []) : [];
    return (Array.isArray(rows) && rows[0]?.data?.companyName) || "us";
  };
  const bulk = await continueBulkSends(headers, twilioFor).catch((e: any) => ({ sent: 0, owners: 0, error: e?.message }));
  const birthdays = await runBirthdayOffers(headers, twilioFor, companyFor).catch((e: any) => ({ sent: 0, errors: [String(e?.message || e)] }));

  const dueRes = await fetch(`${SUPABASE_URL}/rest/v1/alfred_reminders?sent=eq.false&due_at=lte.${encodeURIComponent(new Date().toISOString())}&select=id,owner_id,phone,message,due_at,recurring`, { headers });
  const due = await dueRes.json().catch(() => []);
  if (!Array.isArray(due) || due.length === 0) return new Response(JSON.stringify({ sent: 0, bulk, birthdays }), { headers: { "Content-Type": "application/json" } });

  const settingsCache = new Map<string, any>();
  const getSettings = async (ownerId: string) => {
    if (settingsCache.has(ownerId)) return settingsCache.get(ownerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data&limit=1`, { headers });
    const rows = await res.json().catch(() => []);
    const s = Array.isArray(rows) ? rows[0]?.data || null : null;
    settingsCache.set(ownerId, s);
    return s;
  };

  // FEATURE — owner-configurable "don't bother me" window (Settings →
  // Notifications → Alfred Quiet Hours): quiet hours/weekends/vacation mode.
  // Local HH:MM is converted to UTC minutes-since-midnight client-side at
  // save time (see SettingsModal.tsx) using the browser's own offset, since
  // there's no stored per-owner IANA timezone anywhere in this app — accepts
  // being off by an hour right around a DST transition as a fair tradeoff
  // for not needing a whole timezone-database dependency for this.
  const isQuietNow = (s: any): boolean => {
    if (!s?.alfredDndEnabled && !s?.alfredVacationMode) return false;
    const now = new Date();
    if (s?.alfredVacationMode) {
      const until = s.alfredVacationUntil ? new Date(s.alfredVacationUntil + "T23:59:59Z") : null;
      if (!until || now <= until) return true;
    }
    if (!s?.alfredDndEnabled) return false;
    const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
    if (s.alfredDndWeekends && (day === 0 || day === 6)) return true;
    const startMin = Number(s.alfredDndStartUtcMin);
    const endMin = Number(s.alfredDndEndUtcMin);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) return false;
    const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
    return startMin <= endMin ? (nowMin >= startMin && nowMin < endMin) : (nowMin >= startMin || nowMin < endMin);
  };
  // Next quiet-hours end, in minutes-of-day (UTC) — used to push a deferred
  // reminder to right after quiet hours end rather than dropping it.
  const nextQuietEnd = (s: any): Date => {
    const now = new Date();
    if (s?.alfredVacationMode && s.alfredVacationUntil) {
      const d = new Date(s.alfredVacationUntil + "T23:59:59Z");
      d.setUTCMinutes(d.getUTCMinutes() + 1);
      return d;
    }
    const endMin = Number(s?.alfredDndEndUtcMin);
    const d = new Date(now);
    if (Number.isFinite(endMin)) {
      d.setUTCHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
      if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
    } else {
      d.setUTCHours(d.getUTCHours() + 1); // vacation mode w/ no end date: just retry in an hour
    }
    return d;
  };

  let sentCount = 0;
  const errors: string[] = [];
  for (const r of due) {
    // Check quiet hours BEFORE claiming, so a deferred reminder stays
    // unclaimed (sent:false) and gets picked up again once quiet hours end.
    const sPre = await getSettings(r.owner_id);
    if (isQuietNow(sPre)) {
      await fetch(`${SUPABASE_URL}/rest/v1/alfred_reminders?id=eq.${encodeURIComponent(r.id)}`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ due_at: nextQuietEnd(sPre).toISOString() }),
      }).catch(() => {});
      continue;
    }

    // Claim this row FIRST (sent:true) so two overlapping cron calls can
    // never double-send the same reminder — same idea as the webhook's
    // MessageSid dedup, just via a flag instead of an id check.
    const claim = await fetch(`${SUPABASE_URL}/rest/v1/alfred_reminders?id=eq.${encodeURIComponent(r.id)}&sent=eq.false`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ sent: true }),
    });
    const claimed = await claim.json().catch(() => []);
    if (!Array.isArray(claimed) || claimed.length === 0) continue; // another run already claimed it

    // SECURITY FIX — Twilio auth token moved out of app_settings.data into
    // owner_secrets (migration 0085); getSettings() above now only ever
    // returns a masked placeholder for it.
    const ownerSecrets = await getOwnerSecrets(r.owner_id, context.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!ownerSecrets?.twilioAccountSid || !ownerSecrets?.twilioAuthToken || !ownerSecrets?.twilioFromNumber) {
      errors.push(`${r.id}: Twilio not configured for owner ${r.owner_id}`);
      continue;
    }
    const auth = `Basic ${btoa(`${ownerSecrets.twilioAccountSid}:${ownerSecrets.twilioAuthToken}`)}`;
    const params = new URLSearchParams({ To: r.phone, From: ownerSecrets.twilioFromNumber, Body: `⏰ Reminder: ${r.message}` });
    const smsRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ownerSecrets.twilioAccountSid}/Messages.json`, {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
    });
    if (!smsRes.ok) {
      errors.push(`${r.id}: Twilio send failed (${smsRes.status})`);
      continue;
    }
    sentCount++;

    // Recurring reminders ("from now on, every day...") reschedule
    // themselves for the next occurrence instead of staying done forever —
    // same row, new due_at, unclaimed again. A daily/weekly reminder is
    // meant to repeat indefinitely until the owner cancels it.
    if (r.recurring === "daily" || r.recurring === "weekly") {
      const next = new Date(r.due_at);
      next.setDate(next.getDate() + (r.recurring === "daily" ? 1 : 7));
      await fetch(`${SUPABASE_URL}/rest/v1/alfred_reminders?id=eq.${encodeURIComponent(r.id)}`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ sent: false, due_at: next.toISOString() }),
      }).catch(() => {});
    }
  }

  return new Response(JSON.stringify({ sent: sentCount, errors, bulk, birthdays }), { headers: { "Content-Type": "application/json" } });
};
