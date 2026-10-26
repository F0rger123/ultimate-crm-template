// alfred-health.ts — one check of everything Alfred depends on, run from
// Settings → AI Models ("Check Alfred's connections") or by asking Alfred.
//
// FEATURE — "do a health check on the API connections for Alfred." Uses the
// owner's REAL saved keys (owner_secrets), not the masked copies the browser
// has, and reports each piece in plain words with how to fix it:
//   - every AI model with a key: a one-word test request,
//   - Twilio: account status, and whether the business number's incoming-
//     text webhook points at this app (without it, texting Alfred and reply
//     watching can't work),
//   - Google: the saved sign-in still refreshes,
//   - database tables/columns Alfred's features need,
//   - the reminders scheduler (reminders overdue by 30+ minutes = not running).
// POST, owner's Supabase access token as Bearer.
import { SUPABASE_URL } from "./_lib/env";
import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";
import { pingSmsModel, SMS_MODEL_NAMES } from "./_lib/alfredSmsAgent";


type Check = { area: string; name: string; ok: boolean; detail: string; fix?: string };
const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY isn't set in Cloudflare Pages" }, 500);
  const token = (context.request.headers.get("Authorization") || "").replace(/^Bearer /, "");
  const ownerId = await resolveCallerOwnerId(token).catch(() => null);
  if (!ownerId) return json({ error: "Sign in as the owner to run this check." }, 401);
  const h = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const checks: Check[] = [];
  const [secrets, settingsRows] = await Promise.all([
    getOwnerSecrets(ownerId, serviceRoleKey),
    fetch(`${SUPABASE_URL}/rest/v1/app_settings?owner_id=eq.${encodeURIComponent(ownerId)}&select=data&limit=1`, { headers: h }).then(r => r.json()).catch(() => []),
  ]);
  const s: any = (Array.isArray(settingsRows) && settingsRows[0]?.data) || {};

  // ── AI models ──
  const keys = secrets?.modelKeys || {};
  const configured = Object.keys(keys).filter(k => keys[k] && SMS_MODEL_NAMES[k]);
  if (!configured.length) checks.push({ area: "AI", name: "AI models", ok: false, detail: "No AI model key is saved.", fix: "Settings → AI Models → add a key (Claude, GPT-4o, Gemini, Groq…)." });
  const pings = await Promise.all(configured.map(k => pingSmsModel(k, keys[k])));
  pings.forEach((p, i) => checks.push({ area: "AI", name: p.name, ok: p.ok, detail: p.ok ? `Answered in ${(p.ms / 1000).toFixed(1)}s` : p.error || "failed", fix: p.ok ? undefined : /401|403|invalid|api key/i.test(p.error || "") ? "The key was rejected — paste a fresh one in Settings → AI Models." : /429|quota|rate/i.test(p.error || "") ? "Out of credit or rate-limited at that provider." : "Provider didn't answer — try again, or move another model first in Settings → AI Models." }));
  const priority: string[] = Array.isArray(s.modelPriority) && s.modelPriority.length ? s.modelPriority : configured;
  const firstWorking = priority.find(k => pings[configured.indexOf(k)]?.ok);
  if (configured.length) checks.push({ area: "AI", name: "Model Alfred uses first", ok: !!firstWorking, detail: firstWorking ? SMS_MODEL_NAMES[firstWorking] : "None of the configured models answered.", fix: firstWorking ? undefined : "Fix or replace a model key above." });

  // ── Twilio ──
  const sid = secrets?.twilioAccountSid, tok = secrets?.twilioAuthToken, from = secrets?.twilioFromNumber;
  if (!sid || !tok || !from) {
    checks.push({ area: "Texting", name: "Twilio", ok: false, detail: "Twilio isn't fully set up (Account SID, Auth Token and phone number).", fix: "Settings → Integrations → Twilio." });
  } else {
    const auth = { Authorization: "Basic " + btoa(`${sid}:${tok}`) };
    const acct: any = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: auth }).then(async r => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) })).catch((e: any) => ({ ok: false, status: 0, body: { message: e?.message } }));
    checks.push({ area: "Texting", name: "Twilio account", ok: acct.ok && acct.body?.status === "active", detail: acct.ok ? `Account is ${acct.body?.status}` : `Twilio said ${acct.status}: ${acct.body?.message || "error"}`, fix: acct.ok && acct.body?.status === "active" ? undefined : acct.status === 401 ? "Account SID / Auth Token are wrong — use the ones on the main Twilio Console page (SID starts with AC)." : "Check the account in the Twilio Console." });
    if (!/^AC[0-9a-f]{32}$/i.test(sid)) checks.push({ area: "Texting", name: "Twilio Account SID", ok: false, detail: `Saved SID starts with "${sid.slice(0, 2)}", not "AC" — that's an API key, so incoming texts can't be verified.`, fix: "Paste the Account SID (starts with AC) from the Twilio Console home page." });
    if (acct.ok) {
      const nums: any = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(from)}`, { headers: auth }).then(r => r.json()).catch(() => ({}));
      const num = nums?.incoming_phone_numbers?.[0];
      const hook = String(num?.sms_url || "");
      if (!num) checks.push({ area: "Texting", name: "Incoming texts", ok: false, detail: `${from} isn't a number on this Twilio account (it may use a Messaging Service).`, fix: "In Twilio, make sure incoming messages go to https://<your app>/api/twilio-sms-webhook." });
      else checks.push({ area: "Texting", name: "Incoming texts", ok: /\/api\/twilio-sms-webhook/.test(hook), detail: hook ? `Incoming texts go to ${hook}` : "No incoming-message webhook set.", fix: /\/api\/twilio-sms-webhook/.test(hook) ? undefined : "Twilio Console → Phone Numbers → your number → Messaging → 'A message comes in' → Webhook → https://<your app>/api/twilio-sms-webhook (POST). Without it Alfred can't read texts or watch replies." });
    }
  }
  checks.push({ area: "Texting", name: "Text Alfred from your phone", ok: !!(s.alfredSmsEnabled && s.myPhone), detail: s.alfredSmsEnabled ? (s.myPhone ? `On, for ${s.myPhone}` : "On, but your phone number isn't saved") : "Off", fix: s.alfredSmsEnabled && s.myPhone ? undefined : "Settings → AI Models → turn on texting Alfred and save your cell number." });

  // ── Google ──
  if (!secrets?.googleRefreshToken) checks.push({ area: "Google", name: "Google (Gmail / Calendar)", ok: false, detail: "Not connected, or connected without offline access.", fix: "Settings → Integrations → Connect Google." });
  else if (!context.env.GOOGLE_CLIENT_ID || !context.env.GOOGLE_CLIENT_SECRET) checks.push({ area: "Google", name: "Google (Gmail / Calendar)", ok: false, detail: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET aren't set on the server, so the sign-in can't be renewed.", fix: "Add them in Cloudflare Pages → Settings → Environment variables." });
  else {
    const g: any = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: context.env.GOOGLE_CLIENT_ID, client_secret: context.env.GOOGLE_CLIENT_SECRET, refresh_token: secrets.googleRefreshToken, grant_type: "refresh_token" }).toString() }).then(async r => ({ ok: r.ok, body: await r.json().catch(() => ({})) })).catch(() => ({ ok: false, body: {} }));
    const scopes = String(g.body?.scope || "");
    checks.push({ area: "Google", name: "Google (Gmail / Calendar)", ok: g.ok, detail: g.ok ? `Connected${scopes ? " — " + ["gmail", "calendar", "drive"].filter(x => scopes.includes(x)).join(", ") : ""}` : `Google refused the saved sign-in (${g.body?.error || "error"})`, fix: g.ok ? undefined : g.body?.error === "invalid_grant" ? "Reconnect Google in Settings. If this keeps happening every week, publish the Google OAuth app (Testing apps expire sign-ins after 7 days)." : "Reconnect Google in Settings." });
  }

  // ── Voice (voice notes, dictation, Voice Mode fallback) ──
  {
    const engines = [context.env.AI ? "Cloudflare Whisper (free)" : "", keys.openai ? "OpenAI" : "", keys.groq ? "Groq" : "", keys.gemini ? "Gemini" : ""].filter(Boolean);
    checks.push({ area: "Voice", name: "Speech to text", ok: engines.length > 0,
      detail: engines.length ? "Voice notes are turned into text by: " + engines.join(", ") : "Nothing is set up to turn voice notes into text.",
      fix: engines.length ? undefined : "Free option: Cloudflare → Workers & Pages → this project → Settings → Bindings → Add → Workers AI, name it AI, then redeploy. Or add an OpenAI, Groq or Gemini key in Settings → AI Models." });
  }

  // ── Database ──
  const probe = async (path: string) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: h }).catch(() => null); return r ? { ok: r.ok, msg: r.ok ? "" : ((await r.json().catch(() => ({}))) as any)?.message || `HTTP ${r.status}` } : { ok: false, msg: "network" }; };
  const tables: [string, string, string][] = [
    ["owner_records", "Campaigns, goals, vehicles, expenses sync; bulk-text drafts; reply watching; birthday offers", "0003_owner_records_and_budget_entries.sql"],
    ["alfred_reminders", "Reminders and follow-ups", "schema.sql"],
    ["alfred_memory", "Alfred's memory", "schema.sql"],
    ["alfred_sms_threads", "Texting Alfred history", "schema.sql"],
    ["alfred_pending_actions", "Approvals (ask-first mode)", "schema.sql"],
    ["inbox_threads", "Inbox", "schema.sql"],
    ["promotions", "Coupons / birthday codes", "schema.sql"],
    ["manual_budget_entries", "Income Alfred imports", "0003_owner_records_and_budget_entries.sql"],
  ];
  for (const [t, what, file] of tables) {
    const r = await probe(`${t}?select=*&limit=1`);
    checks.push({ area: "Database", name: t, ok: r.ok, detail: r.ok ? what : `Missing or blocked — ${r.msg}`, fix: r.ok ? undefined : file === "schema.sql" ? "Run supabase/schema.sql in the Supabase SQL Editor." : `Run supabase/migrations/${file} in the Supabase SQL Editor.` });
  }
  const bday = await probe(`customers?select=birthday&limit=1`);
  checks.push({ area: "Database", name: "customers.birthday", ok: bday.ok, detail: bday.ok ? "Birthdays can be saved" : bday.msg, fix: bday.ok ? undefined : "Run supabase/migrations/0003_owner_records_and_budget_entries.sql (adds the column)." });

  // ── Scheduler ──
  const late = await fetch(`${SUPABASE_URL}/rest/v1/alfred_reminders?owner_id=eq.${encodeURIComponent(ownerId)}&sent=eq.false&due_at=lt.${encodeURIComponent(new Date(Date.now() - 30 * 60000).toISOString())}&select=id&limit=5`, { headers: h }).then(r => r.json()).catch(() => null);
  if (Array.isArray(late)) checks.push({ area: "Scheduler", name: "Reminders scheduler", ok: late.length === 0, detail: late.length ? `${late.length} reminder(s) are 30+ minutes overdue — the scheduler isn't calling /api/check-reminders.` : "No overdue reminders.", fix: late.length ? "Set up a free pinger (cron-job.org) to call https://<your app>/api/check-reminders every 5 minutes. It also sends birthday coupons and finishes big bulk texts." : undefined });

  const failed = checks.filter(c => !c.ok);
  return json({ ok: failed.length === 0, checkedAt: new Date().toISOString(), summary: failed.length ? `${failed.length} problem${failed.length !== 1 ? "s" : ""} found` : "Everything Alfred needs is working", checks });
};
