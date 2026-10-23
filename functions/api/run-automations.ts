// FEATURE — "make automations run in the background, not just when your CRM
// is open." Real, working port of src/hooks/useAutomationEngine.ts's
// classify/gather/condition/dedup pipeline (copied faithfully — same
// categories, same timing/cooldown rules, same templates) to a Cloudflare
// Pages Function, so it can run independent of any browser tab.
//
// SCOPE — only automations with autoApprove:true (the owner's own explicit
// "send without asking me each time" choice — see AutomationsPage.tsx and
// the signup wizard's "Should new automations send automatically" question)
// are sent from here. An automation left on the default "review before
// sending" behavior is NOT gathered or sent here — it still only queues its
// approval popup while the owner's browser is open, same as before this
// endpoint existed. This preserves the existing review-gate design instead
// of silently sending customer messages with no one ever having seen them.
//
// Cloudflare PAGES Functions (this deployment) have no built-in Cron
// Trigger — same situation as check-reminders.ts (see its own comment).
// Setup: point an external pinger (cron-job.org, GitHub Actions, etc.) at
// https://<your-domain>/api/run-automations every 15 minutes (matching the
// in-app engine's own cadence). Optional hardening: set
// AUTOMATIONS_CRON_SECRET in the Cloudflare Pages dashboard and have your
// pinger call /api/run-automations?key=<that value>.

import { getOwnerSecrets } from "./_lib/ownerSecrets";
import { SUPABASE_URL } from "./_lib/env";


// ── Templates (verbatim copy of useAutomationEngine.ts's SMS_TEMPLATES) ────
const SMS_TEMPLATES: Record<string, string> = {
  new_lead:             "Hi {{first_name}}! Thanks for reaching out to CRM Starter. I'll send your estimate shortly. — CRM Starter",
  estimate_followup:    "Hi {{first_name}}, just checking in on your estimate. Ready to approve and get on the schedule? View & approve here: {{payment_link}} — CRM Starter",
  estimate_expiring:    "Hi {{first_name}}, your CRM Starter estimate for {{amount}} expires in 48 hours. Lock in this price here: {{payment_link}} — CRM Starter",
  estimate_viewed_ack:  "Hi {{first_name}}, glad you had a chance to look over your CRM Starter estimate! Approve and get scheduled here: {{payment_link}} — CRM Starter",
  estimate_accepted:    "Hi {{first_name}}, thanks for approving your CRM Starter estimate! We'll be in touch shortly to get you scheduled. View it anytime: {{payment_link}} — CRM Starter",
  payment_received:     "Hi {{first_name}}, thank you for your payment! We appreciate your business. — CRM Starter",
  job_reminder:         "Hi {{first_name}}, reminder: your CRM Starter service is coming up. We'll text when on the way. — CRM Starter",
  job_scheduled:        "Hi {{first_name}}, you're booked with CRM Starter for {{date}}! We'll send reminders as it gets closer. — CRM Starter",
  crew_starts:          "Hi {{first_name}}, your CRM Starter technician just started your service — we'll let you know when it's done!",
  review_request:       "Hi {{first_name}}, how did we do? A quick Google review means a lot: {{review_link}} — CRM Starter",
  payment_overdue_3:    "Hi {{first_name}}, friendly reminder — your CRM Starter invoice for {{amount}} is due. Pay here: {{payment_link}}",
  payment_overdue_7:    "Hi {{first_name}}, your CRM Starter invoice for {{amount}} is now a week overdue. Pay here: {{payment_link}}",
  payment_overdue_14:   "Hi {{first_name}}, your invoice for {{amount}} is 2+ weeks overdue. Please pay at your earliest convenience: {{payment_link}} — CRM Starter",
  maintenance_reminder: "Hi {{first_name}}, it's been 90 days since your last CRM Starter service — ready for a refresh? Book here: {{booking_link}}",
  birthday:             "Hi {{first_name}}! Happy birthday 🎂 Enjoy 10% off your next service — code BDAY10. Book here: {{booking_link}} — CRM Starter",
  seasonal_spring:      "Hi {{first_name}}, spring is here! Book your spring service this month and save 15%: {{booking_link}} — CRM Starter",
  seasonal_fall:        "Hi {{first_name}}, fall is a great time to get on the schedule before the busy season. Book here: {{booking_link}} — CRM Starter",
  abandoned_estimate_1: "Hi {{first_name}}, just checking in on your CRM Starter estimate for {{amount}}. Any questions? View & approve here: {{payment_link}}",
  abandoned_estimate_2: "Hi {{first_name}}, still thinking it over? Your CRM Starter estimate for {{amount}} is ready whenever you are: {{payment_link}}",
  abandoned_estimate_3: "Hi {{first_name}}, last check-in on your {{amount}} estimate — view & approve here: {{payment_link}}, or let us know if you have questions. — CRM Starter",
  reengage:             "Hi {{first_name}}, it's been 6 months since your last CRM Starter service! Book now and save 10%: {{booking_link}}",
  referral_ask:         "Hi {{first_name}}, thanks for being a loyal CRM Starter customer! Know anyone who could use our services? Refer them and you both save: {{referral_link}}",
  referral_reward:      "Hi {{first_name}}, your referral just booked — you've earned ${{reward}} credit toward your next CRM Starter service! 🎉 {{booking_link}}",
  referral_booked:      "Hi {{first_name}}, your referral just booked their first CRM Starter service! Thank you for spreading the word 🎉",
  anniversary:          "Hi {{first_name}}, happy anniversary with CRM Starter! Thanks for trusting us — enjoy 10% off your next service this month: {{booking_link}}",
  estimate_declined:    "Hi {{first_name}}, no problem on passing for now — if the price was the sticking point, reply BUDGET and we'll see what we can do. Your quote for {{amount}} stays on file, view it here: {{payment_link}} — CRM Starter",
  estimate_expired:     "Hi {{first_name}}, your CRM Starter quote for {{amount}} has expired. Want us to re-issue it at the same price? View it here: {{payment_link}}",
  job_cancelled:        "Hi {{first_name}}, sorry we missed you! Want to get back on the schedule? Book here: {{booking_link}} — CRM Starter",
  first_job_welcome:    "Hi {{first_name}}, thanks for your first job with CRM Starter! Save this number — text us anytime, or book your next service here: {{booking_link}} — CRM Starter",
  vip_thank_you:        "Hi {{first_name}}, you're one of our best customers — thank you! Enjoy 10% off your next CRM Starter service, on us. Book here: {{booking_link}} — CRM Starter",
  recurring_due:        "Hi {{first_name}}, your recurring CRM Starter service is coming due. Want us to put you back on the schedule? Book here: {{booking_link}} — CRM Starter",
  owner_reschedule:     "Heads up {{first_name}} — {{customer_name}} requested a reschedule for the job at {{job_address}} on {{date}}. Note: {{reschedule_note}}",
  owner_unassigned:     "Heads up {{first_name}} — the job for {{customer_name}} at {{job_address}} on {{date}} still has nobody assigned to it.",
};

const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
const fillTemplate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
const recurringFreqDays: Record<string, number> = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, "semi-annual": 182, annual: 365 };
const lastServiceDate = (jobs: any[], customerId: string): string | null => {
  const done = jobs.filter(j => j.customerId === customerId && j.status === "completed" && j.scheduledDate);
  if (done.length === 0) return null;
  return done.reduce((latest: string, j: any) => (j.scheduledDate > latest ? j.scheduledDate : latest), done[0].scheduledDate);
};

// ── Trigger classification (verbatim copy) ──────────────────────────────────
const classifyTrigger = (labelRaw: string): string | null => {
  const t = (labelRaw || "").toLowerCase();
  if (/estimate (declined|rejected)|quote (declined|rejected)/.test(t)) return "estimate_declined";
  if (/estimate expired|quote expired/.test(t)) return "estimate_expired";
  if (/job cancell?ed|cancell?ed job/.test(t)) return "job_cancelled";
  if (/first job|welcome new customer/.test(t)) return "first_job_welcome";
  if (/\bvip\b|top customer|best customer/.test(t)) return "vip_thank_you";
  if (/recurring (service )?(due|renewal)|next recurring/.test(t)) return "recurring_service_due";
  if (/reschedule request/.test(t)) return "owner_reschedule_request";
  if (/unassigned|no crew assigned/.test(t)) return "owner_unassigned_job";
  if (/new (lead|inquiry|customer)|lead (form )?submitted|inquiry submitted/.test(t)) return "new_lead";
  if (/expir/.test(t)) return "estimate_expiring";
  if (/24h before|before.*scheduled job/.test(t)) return "job_reminder";
  if (/job day morning|morning of/.test(t)) return "job_reminder_morning";
  if (/crew start/.test(t)) return "crew_starts";
  if (/job complete.*3rd|3rd.*job complete/.test(t)) return "referral_ask";
  if (/job complete|post.?job review|review request/.test(t)) return "review_request";
  if (/\bjob scheduled\b/.test(t)) return "job_scheduled";
  if (/quote unviewed|estimate sent|quote sent/.test(t)) return "estimate_followup";
  if (/estimate viewed/.test(t)) return "estimate_viewed";
  if (/estimate (accepted|signed)/.test(t)) return "estimate_accepted";
  if (/payment received/.test(t)) return "payment_received";
  if (/invoice (unpaid|overdue)/.test(t)) return "payment_overdue";
  if (/since service|maintenance|90 days/.test(t)) return "maintenance";
  if (/birthday/.test(t)) return "birthday";
  if (/march 1/.test(t)) return "seasonal_spring";
  if (/october 1/.test(t)) return "seasonal_fall";
  if (/not approved|abandoned|no response/.test(t)) return "abandoned_estimate";
  if (/no service|re-?engage|6 months/.test(t)) return "reengage";
  if (/anniversary|1 year since|year since first service/.test(t)) return "anniversary";
  if (/reward earned|referr.*reward/.test(t)) return "referral_reward";
  if (/referr.*book/.test(t)) return "referral_booked";
  if (/manual/.test(t)) return "manual";
  return null;
};

interface ConditionCtx { jobs?: any[]; referrals?: any[]; settings?: any }
const evalCondition = (key: string, cand: any, ctx: ConditionCtx = {}): boolean => {
  const custJobs = (ctx.jobs || []).filter((j: any) => j.customerId === cand.customer.id);
  const lastDone = custJobs.filter((j: any) => j.status === "completed" && j.scheduledDate)
    .reduce((latest: string | null, j: any) => (!latest || j.scheduledDate > latest ? j.scheduledDate : latest), null as string | null);
  switch (key) {
    case "estimate_pending": return cand.estimate?.status === "pending";
    case "estimate_not_viewed": return !cand.estimate?.viewed;
    case "estimate_viewed": return !!cand.estimate?.viewed;
    case "estimate_not_approved": return cand.estimate?.status !== "approved";
    case "estimate_approved": return cand.estimate?.status === "approved";
    case "invoice_unpaid": return !!cand.estimate?.invoiced && !cand.estimate?.paidAt;
    case "invoice_paid": return !!cand.estimate?.paidAt;
    case "job_completed": return cand.job?.status === "completed";
    case "estimate_unsigned": return !cand.estimate?.signedAt;
    case "quote_not_viewed": return !cand.estimate?.viewed;
    case "job_cancelled": return cand.job?.status === "cancelled";
    case "stale_customer": return !lastDone || daysSince(lastDone) >= 180;
    case "no_recent_job": return !lastDone || daysSince(lastDone) >= 30;
    case "no_new_job": return !custJobs.some((j: any) => j.status === "scheduled" || j.status === "in_progress");
    case "zero_referrals": return !(ctx.referrals || []).some((r: any) => r.referrerId === cand.customer.id);
    case "customer_is_vip": return Number(cand.customer.totalSpent || 0) >= (Number(ctx.settings?.automationVipSpendThreshold) || 2000);
    case "customer_opted_in_sms": return !cand.customer.smsOptOut;
    default: return true;
  }
};

const deriveDelayMinutesFromLabel = (label: string, fallbackMinutes: number): number => {
  const t = (label || "").toLowerCase();
  const h = t.match(/(\d+)\s*h(our)?s?\b/);
  if (h) return parseInt(h[1], 10) * 60;
  const d = t.match(/(\d+)\s*d(ay)?s?\b/);
  if (d) return parseInt(d[1], 10) * 1440;
  return fallbackMinutes;
};
const deriveDaysFromLabel = (label: string, fallbackDays: number): number => {
  const t = (label || "").toLowerCase();
  const h = t.match(/(\d+)\s*h(our)?s?\b/);
  if (h) return Math.max(1, Math.round(parseInt(h[1], 10) / 24));
  const d = t.match(/(\d+)\s*d(ay)?s?\b/);
  if (d) return parseInt(d[1], 10);
  return fallbackDays;
};

const extractDirectives = (steps: any[]): any[] => {
  const directives: any[] = [];
  let delayMinutes = 0;
  let explicitDelay = false;
  let conditions: string[] = [];
  for (let i = 1; i < steps.length; i++) {
    const s = steps[i];
    if (s.type === "delay") {
      const unitMin = s.unit === "hour" ? 60 : s.unit === "week" ? 10080 : 1440;
      delayMinutes += (s.duration || 1) * unitMin;
      explicitDelay = true;
    } else if (s.type === "condition") {
      if (typeof s.delay === "number") { delayMinutes += s.delay; explicitDelay = true; }
      if (s.check || s.condition) conditions.push(s.check || s.condition);
    } else if (s.type === "action" || s.type === "webhook") {
      directives.push({
        stepId: s.id, delayMinutes, explicitDelay, conditions: [...conditions],
        channel: s.type === "webhook" ? "webhook" : (s.channel || "sms"),
        messageBody: s.messageBody, templateKey: s.template, label: s.label || "",
        url: s.url, payload: s.payload,
      });
    }
  }
  return directives;
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const onRequestGet = async (context: { request: Request; env: Record<string, string> }) => onRequestPost(context);

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, 500);
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  // Same origin this function itself is deployed on — used to build real
  // #/estimate, #/rate, #/referral, #/lead-form links in message bodies,
  // the same way the in-browser engine uses window.location.origin.
  const origin = new URL(context.request.url).origin;

  // FEATURE — "there should be a way to build it and find it." AutomationsPage.tsx's
  // "Run Automations Now" button calls this SAME endpoint with the owner's
  // own session token instead of the cron secret — a real authenticated
  // session is its own valid auth, and scoping to just that one owner (not
  // every business on this deployment) makes a manual test click fast
  // instead of processing everyone else's queue too.
  const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  let onlyOwnerId: string | null = null;
  if (accessToken) {
    const { resolveCallerOwnerId } = await import("./_lib/ownerSecrets");
    onlyOwnerId = await resolveCallerOwnerId(accessToken);
    if (!onlyOwnerId) return json({ error: "Not signed in." }, 401);
  } else {
    // No session — this is the external cron pinger path, gated by the
    // secret instead (see this file's own setup comment).
    // SECURITY FIX (audit finding) — an unset AUTOMATIONS_CRON_SECRET used to
    // leave this branch wide open: any anonymous caller could trigger a full
    // outbound SMS/email automation pass for EVERY owner on this deployment,
    // on demand, repeatable at will. Fail closed instead — no secret
    // configured means no unauthenticated cron access, not "allow anyone."
    const secret = context.env.AUTOMATIONS_CRON_SECRET;
    if (!secret) return json({ error: "AUTOMATIONS_CRON_SECRET is not configured — set it in the Cloudflare Pages dashboard to enable the cron endpoint, or call this with an owner's own session token instead." }, 403);
    const key = new URL(context.request.url).searchParams.get("key");
    if (key !== secret) return json({ error: "Invalid key" }, 403);
  }

  // One owner at a time, oldest-updated automations first, so a large
  // deployment doesn't starve any one business if a run gets cut short.
  const ownerIds: string[] = onlyOwnerId ? [onlyOwnerId] : await (async () => {
    const ownersRes = await fetch(`${SUPABASE_URL}/rest/v1/automations?select=owner_id&order=updated_at.asc`, { headers });
    const ownerRows = await ownersRes.json().catch(() => []);
    return Array.from(new Set((Array.isArray(ownerRows) ? ownerRows : []).map((r: any) => r.owner_id))) as string[];
  })();

  let totalSent = 0, totalFailed = 0;
  const perOwner: Record<string, { sent: number; failed: number; skippedPaused?: boolean }> = {};

  for (const ownerId of ownerIds) {
    try {
      const result = await runForOwner(ownerId, serviceRoleKey, context.env, origin);
      perOwner[ownerId] = result;
      totalSent += result.sent;
      totalFailed += result.failed;
    } catch (e: any) {
      console.error("[run-automations] owner", ownerId, "failed:", e?.message);
      perOwner[ownerId] = { sent: 0, failed: 0 };
    }
  }
  return json({ sent: totalSent, failed: totalFailed, owners: perOwner });
};

const runForOwner = async (ownerId: string, serviceRoleKey: string, env: Record<string, string>, origin: string): Promise<{ sent: number; failed: number; skippedPaused?: boolean }> => {
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const [autoRes, settingsRes, jobsRes, custRes, estRes, refRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/automations?owner_id=eq.${encodeURIComponent(ownerId)}&select=id,data`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/jobs?owner_id=eq.${encodeURIComponent(ownerId)}&select=*`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/customers?owner_id=eq.${encodeURIComponent(ownerId)}&select=*`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/estimates?owner_id=eq.${encodeURIComponent(ownerId)}&select=*`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/referrals?owner_id=eq.${encodeURIComponent(ownerId)}&select=*`, { headers }).then(r => r.ok ? r : { json: async () => [] } as any).catch(() => ({ json: async () => [] } as any)),
  ]);
  const autoRows = await autoRes.json().catch(() => []);
  const automations: any[] = (Array.isArray(autoRows) ? autoRows : []).map((r: any) => r.data);
  const activeAutoApprove = automations.filter(a => a?.active && a?.autoApprove);

  const settingsRows = await settingsRes.json().catch(() => []);
  const settings = (Array.isArray(settingsRows) ? settingsRows[0]?.data : null) || {};
  // FEATURE — "there should be a way to find it." Stamps every real run
  // attempt — including one that finds nothing to do — BEFORE the
  // no-auto-approved-automations early return below, so a manual "Run Now"
  // click always visibly confirms it ran instead of looking like nothing
  // happened when there's simply nothing auto-approved yet.
  // attempt (not just successful sends) so AutomationsPage.tsx can show a
  // real "last checked Xm ago" instead of the owner having no way to tell
  // whether the background job is actually configured and running at all.
  fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(ownerId)}`, {
    method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ data: { ...settings, lastAutomationRunAt: new Date().toISOString() } }),
  }).catch(() => {});
  if (settings.automationsPaused !== false) return { sent: 0, failed: 0, skippedPaused: true };

  const jobs = await jobsRes.json().catch(() => []);
  const customers = await custRes.json().catch(() => []);
  const estimates = await estRes.json().catch(() => []);
  const referrals = await refRes.json().catch(() => []);

  const secrets = await getOwnerSecrets(ownerId, serviceRoleKey);
  const todayStr = today();
  const now = new Date();
  const hour = now.getHours();
  const mmdd = todayStr.slice(5);

  const paymentLink = (estId: string) => `${origin}/#/estimate/${estId}`;
  const bookingLink = () => `${origin}/#/lead-form?co=${encodeURIComponent(settings.companyName || "CRM Starter")}&ph=${encodeURIComponent(settings.companyPhone || "")}`;
  const referralLink = (c: any) => `${origin}/#/referral?ref=${encodeURIComponent(c.referralCode || "")}`;
  const reviewLink = (c: any) => `${origin}/#/rate?c=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.firstName)}&g=${encodeURIComponent(settings.googlePlaceId || "")}&rl=${encodeURIComponent(settings.googleReviewLink || "")}&co=${encodeURIComponent(settings.companyName || "CRM Starter")}`;

  // ── Category specs — same data, same rules as useAutomationEngine.ts's
  // specs table, just reading the arrays fetched above instead of React refs.
  const specs: Record<string, any> = {
    new_lead: { direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "new_lead",
      getCandidates: () => customers.filter((c: any) => Date.now() - new Date(c.createdAt).getTime() < 24 * 3600000).map((c: any) => ({ key: c.id, customer: c, anchorMs: new Date(c.createdAt).getTime() })) },
    estimate_expiring: { direction: "before", defaultDelayMinutes: 2880, defaultCooldownDays: 30, smsTemplateKey: "estimate_expiring",
      extraVars: (cand: any) => ({ payment_link: paymentLink(cand.estimate.id) }),
      getCandidates: () => estimates.filter((e: any) => e.status === "pending" && e.validUntil).map((e: any) => { const c = customers.find((x: any) => x.id === e.customerId); return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.validUntil).getTime() } : null; }).filter(Boolean) },
    job_reminder: { direction: "before", defaultDelayMinutes: 1440, defaultCooldownDays: 1, smsTemplateKey: "job_reminder",
      getCandidates: () => jobs.filter((j: any) => j.status === "scheduled" && j.scheduledDate).map((j: any) => { const c = customers.find((x: any) => x.id === j.customerId); if (!c) return null; const t = j.scheduledTime ? new Date(`${j.scheduledDate}T${j.scheduledTime}`) : new Date(`${j.scheduledDate}T08:00:00`); return { key: j.id, customer: c, job: j, anchorMs: t.getTime() }; }).filter(Boolean) },
    job_reminder_morning: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 1, smsTemplateKey: "job_reminder",
      getCandidates: () => (hour >= 6 && hour < 10) ? jobs.filter((j: any) => j.status === "scheduled" && j.scheduledDate === todayStr).map((j: any) => { const c = customers.find((x: any) => x.id === j.customerId); return c ? { key: j.id, customer: c, job: j, anchorMs: Date.now() } : null; }).filter(Boolean) : [] },
    crew_starts: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 1, smsTemplateKey: "crew_starts",
      getCandidates: () => jobs.filter((j: any) => j.status === "in_progress" && j.scheduledDate === todayStr).map((j: any) => { const c = customers.find((x: any) => x.id === j.customerId); return c ? { key: j.id, customer: c, job: j, anchorMs: Date.now() } : null; }).filter(Boolean) },
    job_scheduled: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "job_scheduled",
      getCandidates: () => jobs.filter((j: any) => j.status === "scheduled" && daysSince(j.createdAt || j.scheduledDate) <= 2).map((j: any) => { const c = customers.find((x: any) => x.id === j.customerId); return c ? { key: j.id, customer: c, job: j, anchorMs: Date.now() } : null; }).filter(Boolean) },
    review_request: { direction: "after", defaultDelayMinutes: 2880, defaultCooldownDays: 3650, smsTemplateKey: "review_request",
      extraVars: (cand: any) => ({ review_link: reviewLink(cand.customer) }),
      // FEATURE — "let the field crew opt a bad job out of the automated
      // review request." skipReviewRequest (migration 0094, set from
      // EmployeePortal.tsx's Report Problem panel) excludes it here — same
      // opt-out this cron-driven path shares with JobDetailModal's manual
      // send button.
      getCandidates: () => jobs.filter((j: any) => j.status === "completed" && !j.skipReviewRequest).map((j: any) => { const c = customers.find((x: any) => x.id === j.customerId); if (!c) return null; const completedDate = j.signOff?.timestamp?.slice(0, 10) || j.scheduledDate; if (!completedDate || daysSince(completedDate) > 14) return null; if (c.reviewRequested && daysSince(c.reviewRequested) < 90) return null; const anchorMs = j.signOff?.timestamp ? new Date(j.signOff.timestamp).getTime() : new Date(completedDate).getTime(); return { key: j.id, customer: c, job: j, anchorMs }; }).filter(Boolean) },
    estimate_followup: { direction: "after", defaultDelayMinutes: 1440, defaultCooldownDays: 3, conditionKey: "estimate_not_viewed", smsTemplateKey: "estimate_followup",
      getCandidates: () => estimates.filter((e: any) => e.status === "pending" && e.sentAt).map((e: any) => { const c = customers.find((x: any) => x.id === e.customerId); return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.sentAt).getTime() } : null; }).filter(Boolean) },
    estimate_viewed: { direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "estimate_viewed_ack",
      getCandidates: () => estimates.filter((e: any) => e.viewed && e.sentAt && daysSince(e.viewedAt || e.sentAt) <= 3).map((e: any) => { const c = customers.find((x: any) => x.id === e.customerId); return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.viewedAt || e.sentAt).getTime() } : null; }).filter(Boolean) },
    estimate_accepted: { direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "estimate_accepted",
      getCandidates: () => estimates.filter((e: any) => e.status === "approved" && daysSince(e.signedAt || e.sentAt || e.createdAt) <= 3).map((e: any) => { const c = customers.find((x: any) => x.id === e.customerId); return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.signedAt || e.sentAt || e.createdAt).getTime() } : null; }).filter(Boolean) },
    payment_received: { direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "payment_received",
      extraVars: (cand: any) => ({ referral_link: referralLink(cand.customer), referral_code: cand.customer.referralCode || "" }),
      getCandidates: () => estimates.filter((e: any) => e.invoiced && e.paidAt && daysSince(e.paidAt) <= 3).map((e: any) => { const c = customers.find((x: any) => x.id === e.customerId); return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.paidAt).getTime() } : null; }).filter(Boolean) },
    payment_overdue: { direction: "after", defaultDelayMinutes: 10080, defaultCooldownDays: 3650, conditionKey: "invoice_unpaid",
      extraVars: (cand: any) => ({ payment_link: paymentLink(cand.estimate.id) }),
      getCandidates: () => estimates.filter((e: any) => e.invoiced && !e.paidAt && e.invoicedAt).map((e: any) => { const c = customers.find((x: any) => x.id === e.customerId); return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.invoicedAt).getTime() } : null; }).filter(Boolean) },
    maintenance: { direction: "after", defaultDelayMinutes: 90 * 1440, defaultCooldownDays: 90, smsTemplateKey: "maintenance_reminder",
      getCandidates: () => customers.map((c: any) => { const last = lastServiceDate(jobs, c.id); return last ? { key: c.id + ":" + last, customer: c, anchorMs: new Date(last).getTime() } : null; }).filter(Boolean) },
    birthday: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 300, smsTemplateKey: "birthday",
      getCandidates: () => (hour >= 8 && hour < 9) ? customers.filter((c: any) => c.birthday && c.birthday.slice(5) === mmdd).map((c: any) => ({ key: c.id + ":" + now.getFullYear(), customer: c, anchorMs: Date.now() })) : [] },
    seasonal_spring: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 300, smsTemplateKey: "seasonal_spring",
      getCandidates: () => (now.getMonth() === 2 && now.getDate() <= 3) ? customers.map((c: any) => ({ key: c.id + ":" + now.getFullYear(), customer: c, anchorMs: Date.now() })) : [] },
    seasonal_fall: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 300, smsTemplateKey: "seasonal_fall",
      getCandidates: () => (now.getMonth() === 9 && now.getDate() <= 3) ? customers.map((c: any) => ({ key: c.id + ":" + now.getFullYear(), customer: c, anchorMs: Date.now() })) : [] },
    abandoned_estimate: { direction: "after", defaultDelayMinutes: 3 * 1440, defaultCooldownDays: 3650, conditionKey: "estimate_not_approved",
      getCandidates: () => estimates.filter((e: any) => e.status === "pending" && e.sentAt).map((e: any) => { const c = customers.find((x: any) => x.id === e.customerId); return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.sentAt).getTime() } : null; }).filter(Boolean) },
    reengage: { direction: "after", defaultDelayMinutes: 180 * 1440, defaultCooldownDays: 90, smsTemplateKey: "reengage",
      getCandidates: () => customers.map((c: any) => { const last = lastServiceDate(jobs, c.id); return last ? { key: c.id + ":" + last, customer: c, anchorMs: new Date(last).getTime() } : null; }).filter(Boolean) },
    anniversary: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 300, smsTemplateKey: "anniversary",
      getCandidates: () => customers.filter((c: any) => c.createdAt && daysSince(c.createdAt) >= 365 && c.createdAt.slice(5, 10) === mmdd).map((c: any) => ({ key: c.id + ":" + now.getFullYear(), customer: c, anchorMs: Date.now() })) },
    referral_ask: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "referral_ask",
      getCandidates: () => customers.filter((c: any) => jobs.filter((j: any) => j.customerId === c.id && j.status === "completed").length >= 3).map((c: any) => ({ key: c.id, customer: c, anchorMs: Date.now() })) },
    referral_reward: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "referral_reward",
      extraVars: (cand: any) => ({ reward: String(cand.referral?.reward ?? "") }),
      getCandidates: () => referrals.filter((r: any) => r.status === "completed" && r.reward).map((r: any) => { const c = customers.find((x: any) => x.id === r.referrerId); return c ? { key: r.id, customer: c, referral: r, anchorMs: Date.now() } : null; }).filter(Boolean) },
    referral_booked: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "referral_booked",
      getCandidates: () => referrals.filter((r: any) => r.status === "booked" && daysSince(r.createdAt) <= 14).map((r: any) => { const c = customers.find((x: any) => x.id === r.referrerId); return c ? { key: r.id, customer: c, referral: r, anchorMs: Date.now() } : null; }).filter(Boolean) },
    estimate_declined: { direction: "after", defaultDelayMinutes: 1440, defaultCooldownDays: 3650, smsTemplateKey: "estimate_declined",
      extraVars: (cand: any) => ({ payment_link: paymentLink(cand.estimate.id), decline_reason: cand.estimate?.declineReasonCategory || "" }),
      getCandidates: () => estimates.filter((e: any) => (e.status === "rejected" || !!e.declinedAt) && daysSince(e.declinedAt || e.createdAt) <= 30).map((e: any) => { const c = customers.find((x: any) => x.id === e.customerId); return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.declinedAt || e.createdAt).getTime() } : null; }).filter(Boolean) },
    estimate_expired: { direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 3650, conditionKey: "estimate_not_approved", smsTemplateKey: "estimate_expired",
      extraVars: (cand: any) => ({ payment_link: paymentLink(cand.estimate.id) }),
      getCandidates: () => estimates.filter((e: any) => (e.status === "pending" || e.status === "expired") && e.validUntil && new Date(e.validUntil).getTime() < Date.now() && daysSince(e.validUntil) <= 21).map((e: any) => { const c = customers.find((x: any) => x.id === e.customerId); return c ? { key: e.id, customer: c, estimate: e, anchorMs: new Date(e.validUntil).getTime() } : null; }).filter(Boolean) },
    job_cancelled: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 3650, smsTemplateKey: "job_cancelled",
      getCandidates: () => jobs.filter((j: any) => j.status === "cancelled" && daysSince(j.stageChangedAt || j.createdAt || j.scheduledDate) <= 14).map((j: any) => { const c = customers.find((x: any) => x.id === j.customerId); return c ? { key: j.id, customer: c, job: j, anchorMs: Date.now() } : null; }).filter(Boolean) },
    first_job_welcome: { direction: "after", defaultDelayMinutes: 60, defaultCooldownDays: 3650, smsTemplateKey: "first_job_welcome",
      getCandidates: () => customers.map((c: any) => { const done = jobs.filter((j: any) => j.customerId === c.id && j.status === "completed"); if (done.length !== 1) return null; const j = done[0]; const d = j.completedAt || j.signOff?.timestamp || j.scheduledDate; if (!d || daysSince(d) > 7) return null; return { key: c.id, customer: c, job: j, anchorMs: new Date(d).getTime() }; }).filter(Boolean) },
    vip_thank_you: { direction: "immediate", defaultDelayMinutes: 0, defaultCooldownDays: 180, smsTemplateKey: "vip_thank_you",
      extraVars: (cand: any) => ({ total_spent: `$${Number(cand.customer.totalSpent || 0).toFixed(2)}` }),
      getCandidates: () => { const threshold = Math.max(1, Number(settings.automationVipSpendThreshold) || 2000); return customers.filter((c: any) => Number(c.totalSpent || 0) >= threshold).filter((c: any) => jobs.some((j: any) => j.customerId === c.id && j.status === "completed" && daysSince(j.completedAt || j.scheduledDate) <= 14)).map((c: any) => ({ key: `${c.id}:vip:${now.getFullYear()}`, customer: c, anchorMs: Date.now() })); } },
    recurring_service_due: { direction: "after", defaultDelayMinutes: 0, defaultCooldownDays: 30, smsTemplateKey: "recurring_due",
      getCandidates: () => {
        const intervalDays = (j: any): number => {
          const mode = j.recurringMode;
          const n = Math.max(1, Number(j.recurringInterval) || 1);
          if (mode === "days") return n;
          if (mode === "weeks" || mode === "weekdays") return n * 7;
          if (mode === "months") return n * 30;
          return recurringFreqDays[j.recurringFreq] || 30;
        };
        const byCustomer = new Map<string, any>();
        for (const j of jobs) {
          if (!j.isRecurring || j.status !== "completed" || !j.scheduledDate) continue;
          const prev = byCustomer.get(j.customerId);
          if (!prev || j.scheduledDate > prev.scheduledDate) byCustomer.set(j.customerId, j);
        }
        const out: any[] = [];
        byCustomer.forEach((j, customerId) => {
          const c = customers.find((x: any) => x.id === customerId);
          if (!c) return;
          const dueMs = new Date(j.scheduledDate).getTime() + intervalDays(j) * 86400000;
          if (dueMs - Date.now() > 30 * 86400000) return;
          if (Date.now() - dueMs > 30 * 86400000) return;
          out.push({ key: `${j.id}:${j.scheduledDate}`, customer: c, job: j, anchorMs: dueMs - 3 * 86400000 });
        });
        return out;
      } },
  };

  const alreadySent = (auto: any, key: string, cooldownDays: number): boolean => {
    const last = auto.sentLog?.[key];
    return !!last && daysSince(last) < cooldownDays;
  };

  const dailyLog: Record<string, string> = settings.automationDailySendLog || {};
  const maxSendsPerDay = Math.max(1, Number(settings.automationMaxSendsPerDay) || 50);
  const alreadySentTodayCount = Object.values(dailyLog).filter(d => d === todayStr).length;
  const claimedCustomersThisRun = new Set<string>();
  const toSend: Array<{ auto: any; dedupKey: string; channel: string; subject: string; body: string; cand: any }> = [];

  for (const auto of activeAutoApprove) {
    const steps = auto.steps || [];
    const isLegacy = steps.length === 0;
    const triggerLabel = steps[0]?.label || auto.trigger || "";
    const category = classifyTrigger(triggerLabel) || classifyTrigger(auto.trigger);
    if (!category || !specs[category]) continue; // report/manual/review categories aren't ported here — see file header
    const spec = specs[category];

    let directives: any[];
    if (isLegacy) {
      const legacy: any = { stepId: "legacy", delayMinutes: spec.defaultDelayMinutes, explicitDelay: false, conditions: spec.conditionKey ? [spec.conditionKey] : [], channel: "sms", templateKey: spec.smsTemplateKey, label: auto.action || auto.name };
      if (category === "payment_overdue") {
        const days = deriveDaysFromLabel(triggerLabel, 7);
        legacy.delayMinutes = days * 1440;
        legacy.templateKey = days <= 3 ? "payment_overdue_3" : days <= 10 ? "payment_overdue_7" : "payment_overdue_14";
      } else if (category === "abandoned_estimate") {
        const days = deriveDaysFromLabel(triggerLabel, 3);
        legacy.delayMinutes = days * 1440;
        legacy.templateKey = days <= 3 ? "abandoned_estimate_1" : days <= 10 ? "abandoned_estimate_2" : "abandoned_estimate_3";
      } else {
        legacy.delayMinutes = deriveDelayMinutesFromLabel(triggerLabel, spec.defaultDelayMinutes);
      }
      directives = [legacy];
    } else {
      const raw = extractDirectives(steps);
      directives = spec.conditionKey ? raw.map((d: any) => d.conditions.includes(spec.conditionKey) ? d : { ...d, conditions: [...d.conditions, spec.conditionKey] }) : raw;
    }

    for (const dir of directives) {
      if (dir.channel === "webhook" || dir.channel === "task" || dir.channel === "internal" || dir.channel === "calendar") continue; // not ported in this pass — customer sms/email only
      const effectiveDelay = dir.explicitDelay ? dir.delayMinutes : dir.delayMinutes || spec.defaultDelayMinutes;
      for (const cand of spec.getCandidates()) {
        if (dir.channel === "sms" && cand.customer.smsOptOut) continue;
        if (dir.conditions.some((c: string) => !evalCondition(c, cand, { jobs, referrals, settings }))) continue;
        let ok: boolean;
        if (spec.direction === "before") { const untilMs = cand.anchorMs - Date.now(); ok = untilMs <= effectiveDelay * 60000 && untilMs > -3600000; }
        else if (spec.direction === "after") ok = Date.now() - cand.anchorMs >= effectiveDelay * 60000;
        else ok = true;
        if (!ok) continue;
        const dedupKey = `${category}:${dir.stepId}:${cand.key}`;
        const cooldownDays = dir.stepId === "legacy" ? spec.defaultCooldownDays : 3650;
        if (alreadySent(auto, dedupKey, cooldownDays)) continue;
        if (dailyLog[cand.customer.id] === todayStr) continue;
        if (claimedCustomersThisRun.has(cand.customer.id)) continue;
        if (alreadySentTodayCount + toSend.length >= maxSendsPerDay) continue;
        claimedCustomersThisRun.add(cand.customer.id);

        const vars: Record<string, string> = {
          first_name: cand.customer.firstName, last_name: cand.customer.lastName,
          amount: cand.estimate ? `$${cand.estimate.total}` : "", date: cand.job?.scheduledDate || "",
          address: cand.customer.address || "", review_link: "",
          payment_link: cand.estimate ? paymentLink(cand.estimate.id) : "",
          booking_link: bookingLink(), referral_link: referralLink(cand.customer), reward: "",
          company_phone: settings.companyPhone || settings.twilioFrom || "",
          ...(spec.extraVars ? spec.extraVars(cand) : {}),
        };
        const raw = dir.messageBody || (dir.templateKey && SMS_TEMPLATES[dir.templateKey]) || (spec.smsTemplateKey && SMS_TEMPLATES[spec.smsTemplateKey]) || `Hi {{first_name}}, ${dir.label || auto.action || auto.name}. — CRM Starter`;
        const coName = settings.companyName || "CRM Starter";
        const branded = coName === "CRM Starter" ? raw : raw.replace(/CRM Starter/g, coName);
        const body = fillTemplate(branded, vars);
        const subject = auto.name || dir.label || `Update from ${coName}`;
        toSend.push({ auto, dedupKey, channel: dir.channel, subject, body, cand });
      }
    }
  }

  if (toSend.length === 0) return { sent: 0, failed: 0 };

  let sent = 0, failed = 0;
  const patchesByAutoId: Record<string, { sentTo: Record<string, string>; sent: number }> = {};
  const newDailyLog = { ...dailyLog };
  const sentCustomersThisRun = new Set<string>();

  for (const item of toSend) {
    if (sentCustomersThisRun.has(item.cand.customer.id)) continue;
    const ok = await sendOneServerSide(item, settings, secrets, ownerId, serviceRoleKey, env);
    if (ok) {
      sent++;
      sentCustomersThisRun.add(item.cand.customer.id);
      newDailyLog[item.cand.customer.id] = todayStr;
      if (!patchesByAutoId[item.auto.id]) patchesByAutoId[item.auto.id] = { sentTo: {}, sent: 0 };
      patchesByAutoId[item.auto.id].sentTo[item.dedupKey] = todayStr;
      patchesByAutoId[item.auto.id].sent += 1;
    } else {
      failed++;
    }
  }

  // Persist sentLog/count back onto each automation row.
  for (const autoId of Object.keys(patchesByAutoId)) {
    const patch = patchesByAutoId[autoId];
    const row = automations.find(a => a.id === autoId);
    if (!row) continue;
    const nextData = { ...row, lastTriggered: todayStr, count: (row.count ?? 0) + patch.sent, sentLog: { ...(row.sentLog || {}), ...patch.sentTo } };
    await fetch(`${SUPABASE_URL}/rest/v1/automations?id=eq.${encodeURIComponent(autoId)}&owner_id=eq.${encodeURIComponent(ownerId)}`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ data: nextData, updated_at: new Date().toISOString() }),
    }).catch(() => {});
  }
  if (sent > 0) {
    await fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(ownerId)}`, {
      method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ data: { ...settings, automationDailySendLog: newDailyLog } }),
    }).catch(() => {});
  }
  return { sent, failed };
};

// Real Gmail access-token exchange, inline (same OAuth exchange
// functions/api/google-refresh.ts does) — avoids an extra HTTP hop to our
// own endpoint for what's already a same-process call.
const refreshGoogleAccessToken = async (refreshToken: string, env: Record<string, string>): Promise<string | null> => {
  const clientId = env.GOOGLE_CLIENT_ID, clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() });
  const data = await res.json().catch(() => ({} as any));
  return res.ok && data?.access_token ? data.access_token : null;
};

const emailShellSimple = (companyName: string, title: string, bodyHtml: string): string =>
  `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#fff;border-radius:12px"><h2 style="color:#dc2626;margin-top:0">${title}</h2>${bodyHtml}<p style="color:#888;font-size:12px;margin-top:24px">— ${companyName}</p></div>`;

const sendOneServerSide = async (
  item: { auto: any; channel: string; subject: string; body: string; cand: any },
  settings: any, secrets: any, ownerId: string, serviceRoleKey: string, env: Record<string, string>
): Promise<boolean> => {
  const c = item.cand.customer;
  let channel = item.channel;
  if (channel !== "email" && !c.phone && c.email) channel = "email";

  if (channel === "email") {
    if (!c.email) return false;
    if (!secrets?.googleRefreshToken) { console.warn("[Automations]", item.auto.name, "— no Google connection to send email"); return false; }
    const accessToken = await refreshGoogleAccessToken(secrets.googleRefreshToken, env);
    if (!accessToken) return false;
    const html = emailShellSimple(settings.companyName || "CRM Starter", item.subject, `<p>${item.body.replace(/\n/g, "<br/>")}</p>`);
    const mime = [`To: ${c.email}`, `Subject: ${item.subject}`, `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, ``, html].join("\r\n");
    const raw = btoa(unescape(encodeURIComponent(mime))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }),
    });
    if (!res.ok) { console.warn("[Automations]", item.auto.name, "— Gmail send failed:", res.status); return false; }
    return true;
  }

  if (!c.phone || c.smsOptOut) return false;
  if (!secrets?.twilioAuthToken || !secrets?.twilioAccountSid || !secrets?.twilioFromNumber) { console.warn("[Automations]", item.auto.name, "— Twilio not configured"); return false; }
  const auth = `Basic ${btoa(`${secrets.twilioAccountSid}:${secrets.twilioAuthToken}`)}`;
  const params = new URLSearchParams({ To: c.phone, From: secrets.twilioFromNumber, Body: item.body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${secrets.twilioAccountSid}/Messages.json`, {
    method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
  });
  if (!res.ok) { console.warn("[Automations]", item.auto.name, "— Twilio send failed:", res.status); return false; }
  // Log to inbox_threads the same way every other outbound SMS does.
  try {
    const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
    const normDigits = (p: string) => (p || "").replace(/\D/g, "");
    const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&owner_id=eq.${encodeURIComponent(ownerId)}&select=id,contact_phone`, { headers: authHeaders });
    const threads = await threadsRes.json().catch(() => []);
    const existing = Array.isArray(threads) ? threads.find((t: any) => normDigits(t.contact_phone) === normDigits(c.phone)) : null;
    const msg = { id: crypto.randomUUID(), dir: "out", body: item.body, ts: Date.now() };
    if (existing) {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/append_inbox_message`, {
        method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ p_thread_id: existing.id, p_message: msg, p_unread: false }),
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads`, {
        method: "POST", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ id: crypto.randomUUID(), channel: "sms", contact_name: `${c.firstName} ${c.lastName}`, contact_phone: c.phone, customer_id: c.id, unread: false, messages: [msg], last_message_at: msg.ts, updated_at: new Date().toISOString(), owner_id: ownerId }),
      });
    }
  } catch { /* non-fatal — the SMS itself already sent */ }
  return true;
};
