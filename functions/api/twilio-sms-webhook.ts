// FEATURE — Twilio A2P 10DLC compliance: real STOP/START opt-out handling,
// plus a keyword-based "via text" double opt-in flow. ALSO (Inbox audit,
// round 2) persists every inbound message — not just STOP/START/keyword
// ones — straight to inbox_threads, so a text arrives in the owner's Inbox
// (via the existing Supabase realtime subscription InboxPage.tsx already
// has on that table) the instant Twilio receives it, whether or not the
// app happens to be open. Before this, ordinary messages relied entirely
// on InboxPage.tsx polling Twilio's REST API every 15s WHILE the owner's
// Inbox tab was open — nothing arrived if it wasn't. That client-side poll
// still exists as a fallback (e.g. for a deployment that hasn't configured
// this webhook yet), just at a longer interval now that it's not the only
// path.
//
// One-time setup in the Twilio console (code alone can't do this part):
// Messaging -> Services -> (your Messaging Service) -> Integration ->
// "Incoming Messages" -> Webhook -> POST -> https://<your-domain>/api/twilio-sms-webhook
// (If you send from a standalone number with no Messaging Service, set this
// under Phone Numbers -> your number -> Messaging -> "A message comes in".)
//
// Signature verification (X-Twilio-Signature) uses THIS BUSINESS's own
// Twilio Auth Token (Settings -> Integrations -> Twilio, stored in
// owner_secrets) — never a shared Cloudflare env var, since this platform
// is multi-tenant and every owner has their own separate Twilio account.
// TWILIO_AUTH_TOKEN as a Cloudflare Pages env var still exists ONLY as a
// last-resort fallback for an owner who hasn't connected their own Twilio
// account yet, or a single-tenant deployment with no owner_secrets at all —
// most owners never need to set it. Without either, this endpoint still
// works, just unverified — worst case of a forged request is one
// customer's opt-in flag flipping at the business whose Twilio number was
// guessed.

import { runAlfredSmsAgent, sendAlfredSms } from "./_lib/alfredSmsAgent";
import { runAlfredCustomerAgent } from "./_lib/alfredCustomerAgent";
import { getOwnerSecrets } from "./_lib/ownerSecrets";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./_lib/env";


// Sends the customer-facing agent's reply to the CUSTOMER (not the owner)
// and logs it in THEIR thread, marked via:"alfred" so it's badged in the
// Inbox the same way an owner-directed Alfred reply is.
const sendCustomerAgentReply = async (ctx: { authHeaders: Record<string, string>; ownerId: string | null; twilioSid?: string; twilioToken?: string; twilioFrom?: string }, toPhone: string, body: string): Promise<void> => {
  if (!ctx.twilioSid || !ctx.twilioToken || !ctx.twilioFrom) return;
  const auth = `Basic ${btoa(`${ctx.twilioSid}:${ctx.twilioToken}`)}`;
  const params = new URLSearchParams({ To: toPhone, From: ctx.twilioFrom, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${ctx.twilioSid}/Messages.json`, {
    method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
  });
  if (!res.ok) { console.error("[TwilioSmsWebhook] customer agent reply send failed:", await res.text().catch(() => "")); return; }
  try {
    const msg = { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" };
    // BUG FIX — "my SMS inbox conversation got split up again." Used to
    // fetch-then-find-then-conditionally-append with NO create branch at
    // all (relying on "the inbound handler already created this thread
    // moments ago" — a real race, not a guarantee). find_or_create_inbox_thread
    // (migration 0090/0091) does the whole find-or-create-and-append as one
    // atomic, advisory-lock-serialized call, so this can never race the
    // inbound handler's own write for the same number, and self-heals
    // instead of silently dropping the reply if the thread somehow isn't
    // there yet.
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
      method: "POST", headers: { ...ctx.authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ p_owner_id: ctx.ownerId, p_channel: "sms", p_contact_phone: toPhone, p_contact_name: toPhone, p_customer_id: null, p_message: msg, p_unread: false }),
    });
  } catch (e: any) { console.error("[TwilioSmsWebhook] failed to log customer agent reply:", e?.message); }
};

const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
const START_WORDS = ["START", "UNSTOP", "YES"];
const CONFIRM_WORDS = ["Y", "YES"];
const DEFAULT_OPT_IN_KEYWORD = "DEALS";

// FIX — Twilio's `From`/`To` always arrive E.164 with the US country code
// ("+15555550100" → digits "1555 555 0100", 11 digits), but a number the
// owner types into Settings (myPhone/alfredExtraPhones) is normally just
// the 10-digit local number ("555 555 0100" → "555 555 0100") — plain digit
// stripping alone left those two NEVER equal, so the "is this the owner
// texting Alfred?" check (authorizedPhones.includes(fromDigits)) silently
// failed every time for a US number entered without a country code. This
// was the root cause of "I texted Alfred and it just logged to the Inbox
// like a normal customer message, Alfred never replied." Strip a leading
// "1" off an 11-digit result so both forms normalize to the same 10 digits.
const normalizePhoneDigits = (p: string) => {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};

// Twilio's request-signing scheme: HMAC-SHA1(authToken, url + sorted(key+value
// pairs, concatenated with no separator)), base64-encoded, compared to the
// X-Twilio-Signature header. See twilio.com/docs/usage/security#validating-requests.
const verifyTwilioSignature = async (url: string, params: Record<string, string>, signature: string, authToken: string): Promise<boolean> => {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) data += key + params[key];
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(authToken), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return expected === signature;
};

const twiml = (message?: string) => new Response(
  `<?xml version="1.0" encoding="UTF-8"?><Response>${message ? `<Message>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message>` : ""}</Response>`,
  { headers: { "Content-Type": "text/xml" } }
);

// MULTI-TENANT (Phase G) — under migration 0033_multitenant_owner_scoping.sql,
// app_settings is now owner_id-scoped RLS, so an anon-key `limit=1` read
// (a) can't resolve current_owner_id() at all on this server-to-server call
// (no session) and would return zero rows regardless, and (b) was already an
// unsound "there's only ever one business" assumption. This webhook receives
// an inbound SMS to a specific Twilio number — Twilio sends that as the `To`
// field in the POST body — and each owner's own outbound Twilio number is
// already stored as `settings.twilioFrom` (see lib/messaging.ts / the Twilio
// section of SettingsModal.tsx). Match the inbound `To` against every
// owner's stored `twilioFrom` (service role, bypasses RLS) to find which
// business this text belongs to, instead of guessing "the" owner.
//
// Falls back to the OLD limit=1/anon-key behavior when
// SUPABASE_SERVICE_ROLE_KEY isn't configured yet, so a single-owner
// deployment that hasn't set up the new env var (or hasn't applied migration
// 0033 yet, so RLS is still permissive) keeps working unmodified — same
// fallback style stripe-action.ts uses for STRIPE_SECRET_KEY.
interface ResolvedOwnerSettings {
  companyName: string;
  keyword: string;
  ownerId: string | null;
  myPhone: string;
  alfredExtraPhones: string[];
  // Owner can assign a specific "extra" phone directly to one employee
  // (Settings → AI Models → "Other numbers allowed to text Alfred" — each
  // entry has an "Assign to" dropdown) instead of it defaulting to full
  // owner-level access. Keyed by normalized phone digits -> employee id.
  alfredExtraPhoneRoles: Record<string, string>;
  alfredSmsEnabled: boolean;
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;
  modelKeys: Record<string, string>;
  modelPriority: string[];
  activeModel: string;
  openaiKey: string;
  googleProviderToken: string;
  googleRefreshToken: string;
  googleTokenExpiresAt: number;
  testModeEnabled: boolean;
  // set_standing_preference (owner's own text-Alfred) writes these when the
  // owner says "from now on just confirm reschedules yourself" / "don't
  // ask before sending invoices" — read here so the customer-facing agent
  // (which has no access to the owner conversation's memory) can honor them.
  alfredAutoApproveReschedules: boolean;
  alfredAutoApproveInvoiceSends: boolean;
  alfredPersonality: string;
  // FEATURE — text-Alfred had no weather tool at all ("Alfred said it does
  // not have weather reporting capabilities"), even though the in-app
  // Alfred/Dashboard already show real weather. Same OpenWeatherMap key +
  // location the in-app widget uses.
  owmKey: string;
  weatherLocation: string;
  companyAddress: string;
  alfredVoiceReplies: "off" | "always" | "ask";
  myEmail: string;
  // FEATURE — owner-controlled Alfred capability gates (Settings → Alfred
  // → Capabilities), same map AlfredPage.tsx's in-app chat enforces —
  // threaded through here so text-Alfred honors the exact same choices.
  alfredCapabilities: Record<string, boolean>;
  // FEATURE — vacation/out-of-office mode set via Alfred's set_vacation_mode
  // tool (in-app or text) — threaded through here so text-Alfred sees it
  // proactively in its system prompt, same pattern as alfredCapabilities.
  vacationMode?: { active: boolean; startDate?: string; endDate?: string; autonomyLevel?: string; checkInFrequency?: string; notes?: string };
  alfredAutonomyLevel?: string;
}

const shapeSettings = (row: any, data: any): ResolvedOwnerSettings => ({
  companyName: data?.companyName || "CRM Starter",
  keyword: (data?.smsOptInKeyword || DEFAULT_OPT_IN_KEYWORD).toUpperCase(),
  ownerId: row?.owner_id || null,
  myPhone: data?.myPhone || "",
  alfredExtraPhones: Array.isArray(data?.alfredExtraPhones) ? data.alfredExtraPhones.filter((p: any) => typeof p === "string" && p.trim()) : [],
  alfredExtraPhoneRoles: data?.alfredExtraPhoneRoles && typeof data.alfredExtraPhoneRoles === "object" ? data.alfredExtraPhoneRoles : {},
  alfredSmsEnabled: !!data?.alfredSmsEnabled,
  twilioSid: data?.twilioSid || "",
  twilioToken: data?.twilioToken || "",
  twilioFrom: data?.twilioFrom || "",
  // Text-Alfred uses the SAME provider config as the in-app Alfred — every
  // key the owner has saved (Claude, GPT-4o, Gemini, Groq, Mistral, NVIDIA
  // models) plus their priority order, so a business running on Gemini or a
  // free NVIDIA model gets that same provider over text, not just Claude.
  modelKeys: data?.modelKeys && typeof data.modelKeys === "object" ? data.modelKeys : {},
  modelPriority: Array.isArray(data?.modelPriority) ? data.modelPriority : [],
  activeModel: data?.activeModel || "",
  // FEATURE — voice memo support: a text-to-Alfred voice memo (MMS with an
  // audio attachment) is transcribed via OpenAI Whisper before being handed
  // to the agent, so "just talking" to Alfred works the same as typing.
  // Reuses whichever OpenAI key is already saved for the in-app Alfred
  // (Settings → AI Models) — no separate setup needed if that's configured.
  openaiKey: data?.modelKeys?.openai || "",
  googleProviderToken: data?.googleProviderToken || "",
  googleRefreshToken: data?.googleRefreshToken || "",
  googleTokenExpiresAt: Number(data?.googleTokenExpiresAt) || 0,
  testModeEnabled: !!data?.testModeEnabled,
  alfredAutoApproveReschedules: !!data?.alfredAutoApproveReschedules,
  alfredAutoApproveInvoiceSends: !!data?.alfredAutoApproveInvoiceSends,
  alfredPersonality: data?.alfredPersonality || "drillsergeant",
  owmKey: data?.owmKey || "",
  weatherLocation: data?.weatherLocation || "",
  companyAddress: data?.companyAddress || "",
  // FEATURE — text-Alfred gains an email tool (send_me_files via:"email"),
  // matching the in-app chat's Gmail send. Needs to know where to send it.
  myEmail: data?.myEmail || data?.companyEmail || "",
  // FEATURE — free voice-memo replies (Settings → Alfred → Voice Replies).
  // "off" (default): always plain text. "always": every reply from Alfred
  // over text goes out as a real voice memo (MMS audio) instead. "ask":
  // stays text by default, but a reply is sent as a voice memo whenever
  // the owner's OWN message that turn asked for one ("send that as a
  // voice memo", "say it instead", etc. — see VOICE_REQUEST_PHRASES
  // below). Uses Cloudflare Workers AI's free MeloTTS model — no
  // ElevenLabs/paid API required, standard voice only (no cloning).
  // BUG FIX — "Alfred still can't send voice messages back." Root cause
  // (found live, not guessed): this owner's alfredVoiceReplies was simply
  // unset in the database, which fell back to "off" — meaning voice replies
  // were disabled entirely regardless of any other fix, since "off" never
  // reaches the wantsVoice check at all. The feature only exists to answer
  // "I sent voice, why no voice back," and "ask" mode (now correctly
  // triggers on any real inbound voice memo — see the isInboundVoiceMemo
  // fix) is the low-risk match for that expectation: plain texts stay text,
  // only a voice memo (or an explicit typed request) gets a voice reply.
  // Defaulting unset to "ask" instead of "off" means this works out of the
  // box with no Settings trip required, for every deployment, not just an
  // explicit opt-in.
  alfredVoiceReplies: (data?.alfredVoiceReplies === "always" || data?.alfredVoiceReplies === "off") ? data.alfredVoiceReplies : "ask",
  alfredCapabilities: (data?.alfredCapabilities && typeof data.alfredCapabilities === "object") ? data.alfredCapabilities : {},
  vacationMode: (data?.vacationMode && typeof data.vacationMode === "object") ? data.vacationMode : undefined,
  alfredAutonomyLevel: data?.alfredAutonomyLevel || undefined,
});

const fetchAppSettings = async (env: Record<string, string>, toNumber: string): Promise<ResolvedOwnerSettings> => {
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const toDigits = normalizePhoneDigits(toNumber);
  try {
    if (serviceRoleKey) {
      const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
      // Prefer a direct PostgREST JSONB-text filter (matches the exact
      // stored string) — falls back to fetching all rows and matching in JS
      // (digits-only) below if that finds nothing, since `twilioFrom` may be
      // stored in a different format than Twilio's E.164 `To` (e.g.
      // "(555) 555-0100" vs "+15555550100").
      if (toNumber) {
        // BUG FIX (root cause of "text-Alfred just never responds, with no
        // error anywhere") — this used to fetch with `limit=1` and no
        // ORDER BY. Confirmed live: two app_settings rows existed with the
        // IDENTICAL twilioFrom (an orphaned duplicate owner_id with zero
        // real business data anywhere — no employees/jobs/customers — but
        // alfredSmsEnabled left at its default null/false). Which row
        // Postgres happened to return first was arbitrary per-request, so
        // some inbound texts silently resolved to the dead account's
        // settings — Alfred correctly appeared "disabled" for those
        // requests with nothing to indicate why, and any message that
        // landed there got logged to THAT owner's Inbox instead, not the
        // real one. Fetch every match (still narrow — a handful of rows at
        // most) and deterministically prefer one with alfredSmsEnabled on,
        // logging loudly if this ever happens again so it's diagnosable
        // instead of silently misrouting.
        const exactRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=owner_id,data&data-%3E%3EtwilioFrom=eq.${encodeURIComponent(toNumber)}&limit=5`, { headers });
        const exactRows = await exactRes.json().catch(() => []);
        if (Array.isArray(exactRows) && exactRows.length > 0) {
          if (exactRows.length > 1) {
            console.error("[TwilioSmsWebhook] MULTIPLE app_settings rows share twilioFrom", toNumber, "— owner_ids:", exactRows.map((r: any) => r.owner_id).join(", "), "— this is a data problem (duplicate/orphaned owner account), not just a routing quirk; clean up the extra row(s) in Supabase.");
          }
          const exactRow = exactRows.find((r: any) => r?.data?.alfredSmsEnabled) || exactRows[0];
          return shapeSettings(exactRow, exactRow?.data);
        }
      }
      const allRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=owner_id,data`, { headers });
      const allRows = await allRes.json().catch(() => []);
      const match = Array.isArray(allRows)
        ? allRows.find((r: any) => toDigits && normalizePhoneDigits(r?.data?.twilioFrom || "") === toDigits)
        : null;
      if (match) return shapeSettings(match, match?.data);
      console.warn("[TwilioSmsWebhook] no app_settings row's twilioFrom matched inbound To:", toNumber);
      return shapeSettings(null, null);
    }

    // Fallback — no service role key configured, old single-tenant behavior.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=owner_id,data&limit=1`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    const rows = await res.json().catch(() => []);
    const row = Array.isArray(rows) ? rows[0] : null;
    return shapeSettings(row, row?.data);
  } catch {
    return shapeSettings(null, null);
  }
};

// FEATURE — voice memo support. A voice memo sent to Alfred arrives as an
// MMS with an audio attachment (Twilio's NumMedia/MediaUrl0/
// MediaContentType0 fields on the same inbound webhook POST — no separate
// endpoint needed). Twilio media URLs require the SAME Basic Auth as any
// other Twilio API call to fetch (they're not public), so this can only run
// once the real Account SID/Auth Token are configured.
//
// TRANSCRIPTION: tries Cloudflare Workers AI FIRST (free — Cloudflare's own
// hosted Whisper model, no OpenAI key needed at all), only falling back to
// OpenAI's Whisper API if that's not available. Workers AI requires a
// one-time "AI" binding added to this Pages project: Cloudflare dashboard →
// this project → Settings → Functions → "AI" bindings → add binding named
// "AI" (no wrangler.toml needed — this is a Pages-native binding, not the
// separate Workers Cron Trigger feature this repo deliberately doesn't have
// set up). Free tier: 10,000 "neurons" per day, comfortably enough for
// normal voice-memo volume.
const transcribeViaWorkersAI = async (ai: any, audioBuf: ArrayBuffer): Promise<string | null> => {
  if (!ai) return null;
  try {
    const result: any = await ai.run("@cf/openai/whisper", { audio: Array.from(new Uint8Array(audioBuf)) });
    const text = (result?.text || "").trim();
    return text || null;
  } catch (e: any) {
    console.warn("[TwilioSmsWebhook] Workers AI transcription failed, will try OpenAI fallback if configured:", e?.message);
    return null;
  }
};

// FEATURE — free voice-memo replies. Cloudflare Workers AI's MeloTTS model
// (same "AI" binding transcribeViaWorkersAI above already uses for the
// opposite direction) is included in the free Workers AI tier — no
// ElevenLabs key, no per-character cost, standard voice only (explicitly
// what was asked for: "make it free, without requiring ElevenLabs...use a
// standard voice instead of a cloned one"). Uploads the resulting audio to
// a public Supabase Storage bucket (same pattern as customer documents)
// since Twilio's MediaUrl needs a real fetchable URL, not raw bytes.
const synthesizeSpeechViaWorkersAI = async (ai: any, text: string): Promise<ArrayBuffer | null> => {
  if (!ai) { console.warn("[TwilioSmsWebhook] voice reply requested but no Workers AI binding is configured — add an `AI` binding to this Cloudflare Pages project (Settings → Functions → Bindings) to enable free TTS voice replies."); return null; }
  if (!text.trim()) return null;
  // BUG FIX (real data this time — owner captured live Cloudflare logs) —
  // the binding IS attached and correctly invoked; the model call itself
  // fails with Workers AI's own "3043: Internal server error", a generic
  // upstream inference failure, not a config/auth/quota problem (those
  // return distinct, named errors). This can be transient OR triggered by
  // a specific input shape. Try once as before, then once more with a
  // trimmed, simplified payload (no `lang` param, shorter text) in case
  // the exact input is what's tipping the model over — cheap insurance
  // against either cause, still well inside the caller's own 20s deadline.
  const attempt = async (prompt: string, includeLang: boolean): Promise<ArrayBuffer | null> => {
    const result: any = await ai.run("@cf/myshell-ai/melotts", includeLang ? { prompt, lang: "en" } : { prompt });
    const b64 = result?.audio;
    if (!b64) {
      console.warn("[TwilioSmsWebhook] Workers AI TTS returned no audio field — raw result:", JSON.stringify(result)?.slice(0, 500));
      return null;
    }
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  };
  try {
    return await attempt(text.slice(0, 1000), true);
  } catch (e: any) {
    console.warn("[TwilioSmsWebhook] Workers AI TTS failed (attempt 1):", e?.message, "· full error:", JSON.stringify(e, Object.getOwnPropertyNames(e || {}))?.slice(0, 500));
    try {
      return await attempt(text.slice(0, 300), false);
    } catch (e2: any) {
      console.warn("[TwilioSmsWebhook] Workers AI TTS failed (attempt 2, simplified):", e2?.message, "· full error:", JSON.stringify(e2, Object.getOwnPropertyNames(e2 || {}))?.slice(0, 500));
      return null;
    }
  }
};

const uploadVoiceMemo = async (serviceRoleKey: string, audioBuf: ArrayBuffer): Promise<string | null> => {
  if (!serviceRoleKey) return null;
  try {
    const path = `${crypto.randomUUID()}.mp3`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/alfred-voice/${path}`, {
      method: "POST",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "audio/mpeg" },
      body: audioBuf,
    });
    if (!res.ok) { console.warn("[TwilioSmsWebhook] voice memo upload failed:", await res.text().catch(() => "")); return null; }
    return `${SUPABASE_URL}/storage/v1/object/public/alfred-voice/${path}`;
  } catch (e: any) {
    console.warn("[TwilioSmsWebhook] voice memo upload threw:", e?.message);
    return null;
  }
};

// Loose phrase match for "ask" mode — deliberately generous (a false
// negative just means the owner gets text instead of the voice memo they
// asked for, which is a minor inconvenience; a false positive costs one
// harmless extra TTS call) rather than requiring exact wording.
const VOICE_REQUEST_PHRASES = /\b(voice memo|voice message|voice note|say (it|that)|read (it|that)( to me)?|as a voice|out loud)\b/i;

const transcribeViaOpenAI = async (audioBuf: ArrayBuffer, openaiKey: string): Promise<string | null> => {
  if (!openaiKey) return null;
  try {
    const form = new FormData();
    form.append("file", new Blob([audioBuf]), "voice-memo.ogg");
    form.append("model", "whisper-1");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${openaiKey}` }, body: form,
    });
    if (!res.ok) throw new Error(`OpenAI Whisper failed (${res.status})`);
    const data = await res.json() as { text?: string };
    return (data.text || "").trim() || null;
  } catch (e: any) {
    console.error("[TwilioSmsWebhook] OpenAI transcription failed:", e?.message);
    return null;
  }
};

// FEATURE — "text/upload a photo or PDF to Alfred and say 'upload this to
// this client'." Downloads the MMS media from Twilio (same auth pattern the
// voice-memo path already uses) and uploads it straight into the SAME
// public Storage bucket customer documents already live in
// (DocumentVault.tsx's DOCS_BUCKET) — so once attach_file_to_customer (see
// alfredSmsAgent.ts) records the URL against a customer, it shows up in
// their Document Vault exactly like a file the owner uploaded from the
// browser, no special-casing needed anywhere else in the app.
const DOCS_BUCKET = "customer-docs";
const uploadInboundMedia = async (serviceRoleKey: string, mediaBuf: ArrayBuffer, contentType: string, ownerId: string | null): Promise<{ url: string; fileName: string } | null> => {
  if (!serviceRoleKey) return null;
  try {
    const ext = contentType.split("/")[1]?.split(";")[0] || "bin";
    const fileName = `alfred-inbound-${Date.now()}.${ext}`;
    // Owner-id-prefixed path — required by the storage RLS policy scoping
    // this staging folder per business (see the storage security
    // migration). This write goes through the service role key, which
    // bypasses RLS regardless — the prefix is defense-in-depth /
    // consistency with the browser-side upload path, not load-bearing here.
    const path = `_alfred-inbound/${ownerId || "unknown"}/${crypto.randomUUID()}-${fileName}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${DOCS_BUCKET}/${path}`, {
      method: "POST",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": contentType || "application/octet-stream" },
      body: mediaBuf,
    });
    if (!res.ok) { console.warn("[TwilioSmsWebhook] inbound media upload failed:", await res.text().catch(() => "")); return null; }
    return { url: `${SUPABASE_URL}/storage/v1/object/public/${DOCS_BUCKET}/${path}`, fileName };
  } catch (e: any) {
    console.warn("[TwilioSmsWebhook] inbound media upload threw:", e?.message);
    return null;
  }
};

// BUG FIX — Twilio's own MediaUrl0 requires Basic Auth (twilioSid:twilioToken)
// to fetch, so storing it directly on an inbox_threads message and pointing
// an <audio>/<img> tag at it from the browser silently fails (no way to pass
// Basic Auth via a plain src=). Downloads it once here (with the required
// auth) and re-hosts it through uploadInboundMedia's public bucket, so the
// Inbox can actually play/display it with a normal src=.
const rehostInboundMediaForInbox = async (mediaUrl: string, contentType: string, twilioSid: string, twilioToken: string, serviceRoleKey: string, ownerId: string | null): Promise<string | null> => {
  try {
    const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}` } });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const uploaded = await uploadInboundMedia(serviceRoleKey, buf, contentType, ownerId);
    return uploaded?.url || null;
  } catch (e: any) {
    console.warn("[TwilioSmsWebhook] rehostInboundMediaForInbox failed:", e?.message);
    return null;
  }
};

// Falls back to the plain text body whenever there's no audio, no working
// transcription path, or the transcription call itself fails — Alfred still
// gets SOMETHING to respond to rather than the whole request silently dying.
const resolveIncomingText = async (params: Record<string, string>, bodyRaw: string, twilioSid: string, twilioToken: string, openaiKey: string, workersAi: any, serviceRoleKey?: string, ownerId?: string | null): Promise<string> => {
  const numMedia = Number(params.NumMedia || "0");
  if (numMedia <= 0) return bodyRaw;
  const contentType = params.MediaContentType0 || "";
  if (contentType.startsWith("image/") || contentType === "application/pdf") {
    const mediaUrl = params.MediaUrl0;
    if (!mediaUrl || !twilioSid || !twilioToken || !serviceRoleKey) {
      return bodyRaw || "[sent a file, but the server isn't fully set up to receive it — check Twilio credentials and that SUPABASE_SERVICE_ROLE_KEY is configured]";
    }
    try {
      const mediaRes = await fetch(mediaUrl, { headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}` } });
      if (!mediaRes.ok) throw new Error(`Twilio media fetch failed (${mediaRes.status})`);
      const buf = await mediaRes.arrayBuffer();
      const uploaded = await uploadInboundMedia(serviceRoleKey, buf, contentType, ownerId ?? null);
      if (!uploaded) return bodyRaw || "[sent a file, but it couldn't be saved — try again]";
      console.log("[TwilioSmsWebhook] inbound file uploaded:", uploaded.url);
      // Deliberately NOT prefixed "[sent a" — isTranscriptionFailureNote()
      // only short-circuits actual failure notes; this is real, actionable
      // content the agent needs to see and act on (attach_file_to_customer).
      return `[Attached file ready to save — url: ${uploaded.url}, type: ${contentType}, fileName: ${uploaded.fileName}]${bodyRaw ? `\n\n${bodyRaw}` : "\n\n(no caption — ask which customer this is for if it's not obvious from context)"}`;
    } catch (e: any) {
      console.error("[TwilioSmsWebhook] inbound file handling failed:", e?.message);
      return bodyRaw || "[sent a file but saving it failed — try again]";
    }
  }
  if (!contentType.startsWith("audio/")) return bodyRaw || "[sent an attachment that isn't a voice memo, photo, or PDF — no text to respond to]";
  const mediaUrl = params.MediaUrl0;
  if (!mediaUrl || !twilioSid || !twilioToken) {
    console.warn("[TwilioSmsWebhook] voice memo received but Twilio media can't be fetched — check the Account SID/Auth Token");
    return bodyRaw || "[sent a voice memo, but couldn't fetch it — check the Twilio Account SID in Settings]";
  }
  try {
    const audioRes = await fetch(mediaUrl, { headers: { Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}` } });
    if (!audioRes.ok) throw new Error(`Twilio media fetch failed (${audioRes.status})`);
    const audioBuf = await audioRes.arrayBuffer();
    const transcript = (await transcribeViaWorkersAI(workersAi, audioBuf)) || (await transcribeViaOpenAI(audioBuf, openaiKey));
    if (!transcript) {
      return bodyRaw || "[sent a voice memo, but transcription isn't set up — either add the free \"AI\" binding in Cloudflare Pages settings, or add an OpenAI key in Settings → AI Models]";
    }
    console.log("[TwilioSmsWebhook] voice memo transcribed:", transcript.slice(0, 100));
    return bodyRaw ? `${transcript}\n\n(caption: ${bodyRaw})` : transcript;
  } catch (e: any) {
    console.error("[TwilioSmsWebhook] voice memo transcription failed:", e?.message);
    return bodyRaw || "[sent a voice memo but transcription failed — try typing instead]";
  }
};

// BUG FIX — every resolveIncomingText failure path above returns one of
// these bracketed diagnostic strings instead of real transcript text. That
// string used to get handed straight to the LLM as if it were the user's
// actual message — the model, having no way to know it was a system note
// about a setup problem, just paraphrased it into a generic customer-
// service apology ("I'm sorry, I can't process voice memos yet") and threw
// away the actually-useful part (which specific thing needs fixing:
// missing Cloudflare "AI" binding, no OpenAI key, bad Twilio credentials,
// etc). Detecting this and answering with it directly — no model call at
// all — means whoever sent the voice memo gets the REAL reason, not a
// vague brush-off.
const isTranscriptionFailureNote = (text: string): boolean => text.startsWith("[sent a");

export const onRequestPost = async (context: { request: Request; env: Record<string, string>; waitUntil: (p: Promise<any>) => void }) => {
  try {
    const raw = await context.request.text();
    const params = Object.fromEntries(new URLSearchParams(raw));
    // AUDIT #3.4 (round 4) — unconditional entry log, independent of which
    // branch (STOP/START/keyword/ordinary) this message ends up taking, so
    // "is the webhook even being hit" is answerable from Cloudflare Pages'
    // Functions log tab alone, without needing to reason about which of the
    // more specific logs further down should have fired.
    console.log("[TwilioSmsWebhook] inbound request received — From:", params.From, "Body:", (params.Body || "").slice(0, 80));

    const bodyRaw = params.Body || "";
    const body = bodyRaw.trim().toUpperCase();
    const from = params.From || "";
    if (!from) return twiml();

    const isStop = STOP_WORDS.includes(body);
    const isStart = START_WORDS.includes(body);
    const resolved = await fetchAppSettings(context.env, params.To || "");
    const { companyName, keyword, ownerId, myPhone, alfredExtraPhones, alfredExtraPhoneRoles, alfredSmsEnabled, modelPriority, activeModel, openaiKey, googleProviderToken, googleTokenExpiresAt, testModeEnabled, alfredAutoApproveReschedules, alfredPersonality, owmKey, weatherLocation, companyAddress, alfredVoiceReplies, myEmail, alfredCapabilities, vacationMode, alfredAutonomyLevel } = resolved;
    // SECURITY FIX — Twilio auth token, the Google refresh_token, and every
    // AI model key moved out of app_settings.data into owner_secrets
    // (migration 0085 — see its comment for the full story). `resolved`
    // above now only ever carries masked placeholders for these; every real
    // send/refresh/model-call in this file (and the alfred*Agent modules it
    // calls into) needs the REAL values, resolved here via owner_secrets
    // instead.
    let { twilioSid, twilioToken, twilioFrom, modelKeys, googleRefreshToken } = resolved as any;
    if (ownerId && context.env.SUPABASE_SERVICE_ROLE_KEY) {
      const secrets = await getOwnerSecrets(ownerId, context.env.SUPABASE_SERVICE_ROLE_KEY);
      if (secrets) {
        twilioSid = secrets.twilioAccountSid || twilioSid;
        twilioToken = secrets.twilioAuthToken || twilioToken;
        twilioFrom = secrets.twilioFromNumber || twilioFrom;
        modelKeys = secrets.modelKeys && Object.keys(secrets.modelKeys).length ? secrets.modelKeys : modelKeys;
        googleRefreshToken = secrets.googleRefreshToken || googleRefreshToken;
      }
    }

    // SECURITY FIX — "why am I putting my personal Twilio auth token inside
    // Cloudflare? Each company uses its own Twilio credentials." Correct:
    // this platform is multi-tenant and every owner already connects their
    // OWN Twilio account (owner_secrets.twilioAuthToken, resolved just
    // above). Verifying every inbound webhook against one single platform-
    // wide TWILIO_AUTH_TOKEN would only ever be right for ONE tenant — for
    // everyone else it would silently reject every real inbound text (their
    // Twilio account signs with THEIR OWN auth token, never the platform
    // one). Signature verification is moved to HERE (after the owner/
    // twilioToken lookup above, instead of before it) so it can verify
    // against THIS message's own business's Twilio Auth Token — falling
    // back to the platform-wide TWILIO_AUTH_TOKEN only as a last resort
    // (an owner who hasn't connected their own Twilio account yet, or a
    // single-tenant deployment that never set up owner_secrets at all).
    // BUG FIX (root cause of "I text Alfred, no response at all," confirmed
    // live) — this owner's stored twilioSid is "SK24..." — a Twilio API KEY
    // SID, not a real Account SID (those always start "AC"). Twilio signs
    // X-Twilio-Signature with the ACCOUNT Auth Token specifically — an API
    // Key's secret never produces a matching signature, no matter how
    // correct it looks otherwise (right length, right format). Sending
    // texts kept working fine the whole time (Twilio's REST API accepts an
    // API Key SID/Secret pair as Basic Auth too, so outbound was never
    // affected) — only inbound verification was silently rejecting every
    // real message with 403 since the day per-owner verification shipped,
    // which is exactly why sms_dedupe/alfred_sms_threads went completely
    // silent that day while outbound Alfred replies kept right on working.
    // A SID that doesn't even look like an Account SID can never verify
    // successfully regardless of the token paired with it — same as having
    // no usable token at all, so route it to that existing fail-open path
    // instead of failing closed on a credential-entry mistake the owner has
    // no way to see or diagnose.
    const twilioSidLooksReal = /^AC[0-9a-f]{32}$/i.test(twilioSid || "");
    const effectiveAuthToken = (twilioSidLooksReal && twilioToken) || context.env.TWILIO_AUTH_TOKEN;
    // Without the account's Auth Token the signature can't be checked, so
    // anyone who knows this URL could post a fake text "from" the owner's
    // phone and drive owner-level Alfred. Instead, ask Twilio whether this
    // exact message really arrived (from/to must match). A message that
    // doesn't exist is rejected; if Twilio can't be asked, it's let through
    // as before, so real texts are never lost.
    if (!twilioSidLooksReal && twilioToken && twilioSid && !context.env.TWILIO_AUTH_TOKEN) {
      const d10 = (p: string) => String(p || "").replace(/\D/g, "").slice(-10);
      const sid = params.MessageSid || params.SmsSid || "";
      const acct = params.AccountSid || "";
      if (!/^(SM|MM)[0-9a-f]{32}$/i.test(sid) || !/^AC[0-9a-f]{32}$/i.test(acct)) {
        console.warn("[TwilioSmsWebhook] unsigned request without a real MessageSid/AccountSid — rejecting");
        return new Response("Invalid request", { status: 403 });
      }
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 5000);
      const check = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${acct}/Messages/${sid}.json`, {
        headers: { Authorization: "Basic " + btoa(`${twilioSid}:${twilioToken}`) }, signal: ctl.signal,
      }).catch(() => null);
      clearTimeout(t);
      if (check?.status === 404) {
        console.warn("[TwilioSmsWebhook] message", sid, "doesn't exist at Twilio — rejecting forged request");
        return new Response("Invalid request", { status: 403 });
      }
      if (check?.ok) {
        const m: any = await check.json().catch(() => null);
        if (!m || d10(m.from) !== d10(params.From || "") || d10(m.to) !== d10(params.To || "")) {
          console.warn("[TwilioSmsWebhook] message", sid, "from/to don't match Twilio's record — rejecting");
          return new Response("Invalid request", { status: 403 });
        }
      } else {
        console.warn("[TwilioSmsWebhook] couldn't confirm message", sid, "with Twilio (" + (check?.status ?? "network") + ") — processing anyway");
      }
    }
    if (!twilioSidLooksReal && twilioToken) {
      console.warn("[TwilioSmsWebhook] owner", ownerId, "has a Twilio SID that isn't a real Account SID (starts with", (twilioSid || "").slice(0, 2) || "?", "not AC) — likely an API Key pasted into the Account SID field. Skipping signature verification instead of rejecting every inbound text; fix in Settings → Integrations → Twilio using the Account SID/Auth Token from the main Twilio Console dashboard, not an API Key.");
    }
    if (effectiveAuthToken) {
      const signature = context.request.headers.get("X-Twilio-Signature") || "";
      const valid = await verifyTwilioSignature(context.request.url, params, signature, effectiveAuthToken);
      if (!valid) {
        console.warn("[TwilioSmsWebhook] signature verification failed for owner", ownerId, "— rejecting");
        return new Response("Invalid signature", { status: 403 });
      }
    } else {
      console.warn("[TwilioSmsWebhook] no Twilio Auth Token available (neither this owner's own nor a platform fallback) — processing without signature verification");
    }

    const isOptInKeyword = body === keyword;
    const isConfirm = CONFIRM_WORDS.includes(body);

    // MULTI-TENANT — every read/write below now goes through the SAME
    // credentials + owner scoping fetchAppSettings resolved above: service
    // role key + this business's owner_id when both are available (RLS is
    // live and we identified the owner), otherwise the old anon-key/
    // unscoped behavior (RLS still permissive, or no service role key
    // configured yet) — same fallback contract as fetchAppSettings itself.
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    const authHeaders = serviceRoleKey
      ? { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }
      : { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` };
    let ownerFilter = ownerId ? `&owner_id=eq.${encodeURIComponent(ownerId)}` : "";

    // BUG FIX — Twilio redelivering the same inbound webhook (slow response,
    // network retry) used to run the whole agent a second time and send a
    // real second SMS reply — verified live: two near-identical "Will
    // what?" replies logged ~1s apart in the owner's Inbox for one inbound
    // text. The inbound message log below was already deduped by
    // MessageSid, but nothing stopped the agent/send from running twice.
    // Atomic insert into a dedicated table: the first delivery of a given
    // MessageSid proceeds normally; any redelivery hits the primary key
    // conflict and is dropped here, before any branch below ever runs.
    const msgSid = params.MessageSid || "";
    if (msgSid) {
      try {
        const dedupeRes = await fetch(`${SUPABASE_URL}/rest/v1/sms_dedupe`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
          body: JSON.stringify({ sid: msgSid }),
        });
        const dedupeRows = await dedupeRes.json().catch(() => null);
        if (dedupeRes.ok && Array.isArray(dedupeRows) && dedupeRows.length === 0) {
          console.warn("[TwilioSmsWebhook] duplicate delivery detected for", msgSid, "— skipping, already processed");
          return twiml();
        }
      } catch (e: any) {
        // Dedupe table missing/unreachable must never block real messages —
        // fail open (process normally) rather than silently dropping texts.
        console.warn("[TwilioSmsWebhook] dedupe check failed, processing anyway:", e?.message);
      }
    }

    const fromDigits = normalizePhoneDigits(from);

    // FEATURE — text-Alfred bridge. If the owner opted in (Settings →
    // AI Models/Twilio → "Text Alfred from my phone") and this inbound
    // message is FROM the owner's own personal number (settings.myPhone),
    // hand the whole thing to the AI agent instead of any of the
    // customer-facing opt-in/STOP/ordinary-message logic below — a text
    // from the owner is never a customer opt-out/opt-in action. Checked
    // before everything else so STOP/keyword words the owner might
    // legitimately type ("stop the job", "cancel that") never get
    // misinterpreted as an SMS compliance action.
    //
    // FEATURE — also checks alfredExtraPhones (Settings → AI Models →
    // "Numbers allowed to text Alfred"), so an owner testing the CUSTOMER
    // side of texting from their own main number (myPhone) can register a
    // SECOND number for Alfred conversations without losing access to
    // either — either number reaching this webhook is treated as "this is
    // Alfred, not a customer."
    const authorizedPhones = [myPhone, ...alfredExtraPhones].filter(Boolean).map(normalizePhoneDigits);
    // Owner can explicitly assign one of the "extra" numbers to a specific
    // employee (Settings → AI Models → "Assign to" dropdown) instead of it
    // defaulting to owner-level access. When that's set, it wins even
    // though the number is technically still in authorizedPhones — the
    // owner's explicit assignment is the real intent, not "extra owner".
    const assignedEmployeeId = alfredExtraPhoneRoles[fromDigits] || "";
    // BUG FIX — "Alfred refuses an employee who was explicitly granted
    // access" (Settings → Employees → Edit → Portal Permissions → Text
    // Alfred). If that same phone number was ALSO ever added to Settings →
    // AI Models → "Numbers allowed to text Alfred" (e.g. for earlier
    // testing) without an explicit "Assign to" pick, the check just above
    // (`authorizedPhones.includes(fromDigits) && !assignedEmployeeId`) used
    // to unconditionally win — routing that employee's texts into the
    // OWNER-only Alfred agent, whose system prompt only knows how to talk to
    // the owner. That agent then correctly (from ITS perspective) refused
    // once it realized from the conversation content that it wasn't
    // actually talking to the owner. A number an employee's own record
    // claims via can_text_alfred is a more specific, more recent grant than
    // a loose "extra owner number" list — it should win, except for the
    // owner's own real primary number, which must always stay owner-level
    // regardless of what else got added to that list.
    let preResolvedEmployee: any = null;
    if (fromDigits !== normalizePhoneDigits(myPhone)) {
      try {
        const preEmpRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?select=id,firstName,lastName,phone,permissions,dayClockInAt,dayPausedMinutes,lastShiftHours,lastShiftDate,hourlyRate,google_token,google_refresh_token,google_token_expires_at${ownerFilter}`, { headers: authHeaders });
        const preEmpRows = await preEmpRes.json().catch(() => []);
        preResolvedEmployee = Array.isArray(preEmpRows)
          ? (assignedEmployeeId ? preEmpRows.find((e: any) => e.id === assignedEmployeeId) : null)
            || preEmpRows.find((e: any) => e.phone && normalizePhoneDigits(e.phone) === fromDigits && e.permissions?.can_text_alfred === true)
          : null;
      } catch (e: any) {
        console.warn("[TwilioSmsWebhook] pre-check employee lookup failed, falling back to owner-phone logic:", e?.message);
      }
    }
    if (alfredSmsEnabled && authorizedPhones.includes(fromDigits) && !assignedEmployeeId && !preResolvedEmployee) {
      const ctx = { authHeaders, ownerId, companyName, twilioSid, twilioToken, twilioFrom, origin: new URL(context.request.url).origin, fromPhone: from, googleProviderToken, googleRefreshToken, googleTokenExpiresAt, testModeEnabled, ownerAuthorizedPhones: authorizedPhones, alfredPersonality, owmKey, weatherLocation, companyAddress, myEmail, alfredCapabilities, vacationMode, alfredAutonomyLevel, env: context.env as Record<string, string> };
      // BUG FIX — this branch never logged the OWNER's own inbound text to
      // inbox_threads at all (only to alfred_sms_threads, which the Inbox
      // UI never reads) — sendAlfredSms below only logs Alfred's OUTGOING
      // reply. So the Inbox showed a one-sided thread of nothing but
      // Alfred's replies with no visible question ever asked, which read as
      // "messages going out from Alfred as if they're incoming" — there was
      // no incoming side to contrast them against at all. Log it the same
      // way the ordinary-message path below does, dir:"in", so the owner
      // sees their own side of the conversation too.
      context.waitUntil((async () => {
        try {
          const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerFilter}`, { headers: authHeaders });
          const existingThreads = await threadsRes.json().catch(() => []);
          // BUG FIX — "one whole SMS conversation is missing from the
          // Inbox." This used to fall back to matching ANY thread whose
          // contact_phone was one of the owner's authorized phones whenever
          // there was no exact match yet — meant to avoid "starting a new
          // thread the first time a second registered number ever texts
          // in," but it actually meant every distinct authorized number
          // (owner's real phone, a second personal test number, an
          // employee's own registered Alfred number) permanently got
          // folded into whichever ONE of those threads was created first,
          // forever. Confirmed live: an employee's Alfred texts from their
          // own registered number never got their own Inbox thread at all —
          // every message silently appended into the owner's separate
          // personal Alfred thread instead. A thread must always represent
          // one distinct real phone number — exact match only.
          const existingThread = Array.isArray(existingThreads) ? existingThreads.find((t: any) => normalizePhoneDigits(t.contact_phone) === fromDigits) : null;
          const msgId = params.MessageSid || crypto.randomUUID();
          const alreadyHave = existingThread && (Array.isArray(existingThread.messages) ? existingThread.messages : []).some((m: any) => m?.id === msgId);
          if (alreadyHave) return;
          // BUG FIX — a voice-memo MMS (or a photo/PDF) has an empty Body,
          // never carried any media reference into the logged message at
          // all — the Inbox showed a literal blank entry with nothing to
          // tap, silently dropping the actual attachment. Re-hosted through
          // rehostInboundMediaForInbox (Twilio's MediaUrl0 needs Basic Auth
          // to fetch, which a plain <audio src=> can't do) so InboxPage.tsx
          // can actually play/display it.
          const inNumMedia = Number(params.NumMedia || "0");
          const inMediaType = inNumMedia > 0 ? (params.MediaContentType0 || "") : "";
          const inMediaUrl = inNumMedia > 0 && params.MediaUrl0
            ? await rehostInboundMediaForInbox(params.MediaUrl0, inMediaType, twilioSid, twilioToken, context.env.SUPABASE_SERVICE_ROLE_KEY, ownerId)
            : null;
          const newMsg = {
            id: msgId, sid: params.MessageSid || null, dir: "in",
            body: bodyRaw || (inMediaUrl ? (inMediaType.startsWith("audio/") ? "[voice memo]" : inMediaType.startsWith("image/") ? "[photo]" : "[attachment]") : ""),
            ts: Date.now(),
            ...(inMediaUrl ? { mediaUrl: inMediaUrl, mediaType: inMediaType } : {}),
          };
          // BUG FIX — "my SMS inbox conversation got split up again."
          // find_or_create_inbox_thread (migration 0090/0091) replaces the
          // separate "append if existingThread, else insert a new row"
          // branches above with one atomic, advisory-lock-serialized call —
          // closes the exact race where this handler and another concurrent
          // writer (e.g. logOutboundSmsToInbox logging an Alfred reply at
          // the same moment) could both decide no thread exists yet and
          // both insert one, permanently splitting the conversation.
          await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
            method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" },
            // BUG FIX — "label the Alfred thread 'you'." A raw phone number
            // was just as unclear in the Inbox list as "Alfred" (see
            // alfredSmsAgent.ts's matching fix) — "You" is what this thread
            // actually is from the owner's own point of view.
            body: JSON.stringify({ p_owner_id: ownerId || null, p_channel: "sms", p_contact_phone: from, p_contact_name: "You", p_customer_id: null, p_message: newMsg, p_unread: true }),
          });
        } catch (e: any) { console.error("[TwilioSmsWebhook] failed to log inbound Alfred text:", e?.message); }
      })());
      // FIX — Twilio abandons an unanswered webhook after ~15s with nothing
      // shown to the owner. A multi-step request (e.g. "reschedule this job
      // AND text the customer") can easily need multiple Anthropic
      // round-trips + several Supabase writes, well past that window. Ack
      // Twilio immediately with an empty response (so the request always
      // "succeeds" from Twilio's side), then keep running the actual agent
      // in the background via waitUntil and deliver the real answer as its
      // own follow-up text a few seconds later via the Messages API —
      // exactly like sendSms elsewhere in this agent already does, so it
      // also gets logged to the Inbox like every other outbound text.
      // OUTER WATCHDOG — runAlfredSmsAgent already gives up on its own after
      // ~75s and replies with whatever it managed to finish (see its
      // overallDeadline), but that only guards against the agent loop
      // itself running long. Something else in this chain (transcription,
      // a Supabase call with no timeout) could still hang indefinitely, and
      // per the owner's report, a "huge" multi-action text sometimes got NO
      // reply at all — total silence, no error either. Racing the whole
      // chain against a fixed outer deadline means SOMETHING always gets
      // texted back, in plain simple English, no matter what hangs.
      const withDeadline = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
        Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);

      context.waitUntil(
        withDeadline(
          resolveIncomingText(params, bodyRaw, twilioSid, twilioToken, openaiKey, (context.env as any).AI, context.env.SUPABASE_SERVICE_ROLE_KEY, ownerId)
            .then((text) => isTranscriptionFailureNote(text) ? text : runAlfredSmsAgent(ctx, modelKeys, modelPriority, activeModel, from, text))
            .catch((e: any) => {
              console.error("[TwilioSmsWebhook] Alfred SMS agent failed:", e?.message);
              return "Sorry, something went wrong on my end — try texting again.";
            }),
          90000,
          "Sorry, that took too long and I had to stop — try again, maybe as a couple of shorter texts instead of one big one."
        ).then(async (reply) => {
          // FEATURE — free voice-memo replies. "always" mode voices every
          // reply; "ask" mode only voices this one if the owner's OWN
          // message (bodyRaw, before transcription-mangling) requested it.
          // BUG FIX (2nd report — still silent after the first fix) —
          // restructured from "wait for TTS, THEN decide what to send" to
          // "send the real text reply FIRST, unconditionally, then attempt
          // a voice memo as a separate best-effort follow-up." The earlier
          // version made voice a REPLACEMENT for text, so it stayed
          // possible for total silence if TTS hung/failed in a way that
          // slipped past every guard, or if Twilio itself rejected the MMS
          // send (unsupported codec, size limit — a failure that was never
          // checked at all before). Sending the guaranteed, fast, already-
          // proven text path first makes total silence structurally
          // impossible regardless of what the free TTS/MMS step does.
          const textRes = await sendAlfredSms(ctx, from, reply);
          // BUG FIX — "I send Alfred a voice memo and never get one back."
          // "ask" mode tested VOICE_REQUEST_PHRASES against bodyRaw — but a
          // real inbound voice memo has an EMPTY Body (Twilio sends the
          // audio only via MediaUrl0, no text), so this could never match
          // for the exact case it's supposed to catch. Sending voice is
          // itself the clearest possible signal the owner wants voice back
          // — treat an inbound audio MMS as satisfying "ask" mode directly,
          // in addition to (still) checking for an explicit typed phrase.
          const isInboundVoiceMemo = Number(params.NumMedia || "0") > 0 && (params.MediaContentType0 || "").startsWith("audio/");
          const wantsVoice = alfredVoiceReplies === "always" || (alfredVoiceReplies === "ask" && (isInboundVoiceMemo || VOICE_REQUEST_PHRASES.test(bodyRaw || "")));
          if (wantsVoice) {
            try {
              const mediaUrl = await withDeadline((async () => {
                const audio = await synthesizeSpeechViaWorkersAI((context.env as any).AI, reply);
                return audio ? await uploadVoiceMemo(context.env.SUPABASE_SERVICE_ROLE_KEY, audio) : null;
              })(), 20000, null as string | null);
              if (mediaUrl) {
                // Empty body — the text reply already went out above; this
                // follow-up is audio-only so the owner isn't sent the same
                // text twice.
                const voiceRes = await sendAlfredSms(ctx, from, "🔊", mediaUrl);
                if (!voiceRes.ok) console.warn("[TwilioSmsWebhook] voice memo MMS follow-up failed:", voiceRes.error);
              } else {
                console.warn("[TwilioSmsWebhook] voice memo requested but TTS/upload failed or timed out — text reply already sent");
              }
            } catch (e: any) {
              console.warn("[TwilioSmsWebhook] voice memo synthesis threw (text reply already sent):", e?.message);
            }
          }
          return textRes;
        }).catch((e: any) => {
          console.error("[TwilioSmsWebhook] failed to deliver Alfred reply at all:", e?.message);
          return sendAlfredSms(ctx, from, "Sorry, something went wrong sending my reply — try again.").catch(() => {});
        })
      );
      return twiml();
    }

    // FEATURE — employees the owner has explicitly opted in
    // (employees.permissions.can_text_alfred, off by default — toggled in
    // Settings/Employees, same pattern as customers.alfredAutoRespond) can
    // text a THIRD, narrower Alfred agent scoped to only their own record:
    // clock in/out, check their own hours, see their own jobs, manage their
    // own connected Google Calendar. Checked after the owner-phone branch
    // (an owner number always wins) and before the customer STOP/opt-in
    // logic below, matching that same "resolve who this is once" shape.
    {
      // Reuse the pre-check lookup above (same query) instead of hitting
      // Supabase twice for the same row on every single inbound text.
      const employee = preResolvedEmployee;
      if (employee) {
        const empCtx = { authHeaders, ownerId, companyName, twilioSid, twilioToken, twilioFrom, origin: new URL(context.request.url).origin, owmKey, weatherLocation, companyAddress, env: context.env as Record<string, string> };
        context.waitUntil((async () => {
          try {
            const text = await resolveIncomingText(params, bodyRaw, twilioSid, twilioToken, openaiKey, (context.env as any).AI, context.env.SUPABASE_SERVICE_ROLE_KEY, ownerId);
            let reply: string;
            if (isTranscriptionFailureNote(text)) {
              reply = text;
            } else {
              const { runAlfredEmployeeAgent } = await import("./_lib/alfredEmployeeAgent");
              reply = await runAlfredEmployeeAgent(empCtx, employee, modelKeys, modelPriority, text).catch((e: any) => {
                console.error("[TwilioSmsWebhook] Alfred employee agent failed:", e?.message);
                return "Sorry, something went wrong on my end — try texting again.";
              });
            }
            await sendAlfredSms(empCtx as any, from, reply);
          } catch (e: any) {
            console.error("[TwilioSmsWebhook] employee Alfred branch failed:", e?.message);
          }
        })());
        return twiml();
      }
    }

    // No normalized phone column to filter on server-side (formats vary:
    // "(555) 555-0100" vs "+15555550100") — fetch and match in JS.
    let listRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,phone,firstName,lastName,smsOptInPending,alfredAutoRespond${ownerFilter}`, {
      headers: authHeaders,
    });
    // FIX — verified live: app_settings.owner_id is already populated on
    // this deployment, but customers/inbox_threads don't have an owner_id
    // column yet (migration 0033 not applied), so `&owner_id=eq.X` 400s the
    // whole query and this used to silently resolve to "no customers at
    // all" — every STOP/opt-in match and the Inbox sync below would fail
    // with zero trace. If the scoped query fails, drop the filter and retry
    // once for the rest of this request (both here and for inbox_threads).
    if (!listRes.ok && ownerFilter) {
      console.warn("[TwilioSmsWebhook] scoped customers query failed (" + listRes.status + ") — retrying unscoped; migration 0033 likely not applied yet");
      ownerFilter = "";
      listRes = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,phone,firstName,lastName,smsOptInPending,alfredAutoRespond`, { headers: authHeaders });
    }
    const list = await listRes.json().catch(() => []);
    const match = Array.isArray(list) ? list.find((c: any) => normalizePhoneDigits(c.phone) === fromDigits) : null;

    // ISSUE 7 (Inbox audit) — this webhook used to bail out immediately for
    // any ORDINARY message ("InboxPage's poll handles display"), meaning
    // real-time inbound SMS only ever reached inbox_threads while the
    // owner's browser tab happened to be open and polling Twilio's REST API
    // every 15s. Writing it here too means it's captured the instant it
    // arrives regardless of whether the app is open, via the SAME
    // find-existing-thread-by-phone-or-create merge every other write path
    // in this app uses (see lib/messaging.ts's logOutboundSmsToInbox and
    // InboxPage.tsx's syncThreadToSupabase) — one consistent place threads
    // get merged, instead of the client being the only thing that can do it.
    // This also means the client-side poll can safely run less often (it's
    // now just a fallback/catch-up for whenever this webhook isn't
    // configured yet), directly reducing Twilio REST API usage.
    try {
      const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerFilter}`, {
        headers: authHeaders,
      });
      if (!threadsRes.ok) console.error("[TwilioSmsWebhook] inbox_threads read failed (" + threadsRes.status + "):", await threadsRes.clone().text().catch(() => ""));
      const existingThreads = await threadsRes.json().catch(() => []);
      const existingThread = Array.isArray(existingThreads)
        ? existingThreads.find((t: any) => normalizePhoneDigits(t.contact_phone) === fromDigits)
        : null;
      // ISSUE 17 (round 3) — neither write below checked res.ok; a non-2xx
      // (RLS rejection, a column that doesn't exist, a malformed JSONB
      // payload) was completely silent — no error log, no thrown exception,
      // just a text message that vanished with zero trace. That made "SMS
      // not showing in the inbox despite the webhook being set up" nearly
      // undiagnosable from the Cloudflare Function logs. Log the actual
      // Supabase response body on failure now.
      //
      // ISSUE 2 (round 6) — ROOT CAUSE of double-showing messages: this used
      // crypto.randomUUID() for every message's id, a value with no
      // relationship to the physical Twilio message. InboxPage.tsx's OWN
      // Twilio REST poll (a fallback that also runs while the owner's tab is
      // open) can independently pick up the SAME inbound message and, since
      // it used a locally-generated uid() too, had no way to recognize "this
      // is the one the webhook already recorded." Both this file and
      // InboxPage.tsx's poll now key the message's id off Twilio's own
      // MessageSid (always present on an inbound webhook POST) — the one
      // identifier both write paths can agree on regardless of which side
      // processes it first or what "now" happens to read on each side (the
      // two paths previously used DIFFERENT timestamp sources for the same
      // message — Date.now() here vs. Twilio's own DateSent on the poll
      // side — so a body+ts dedup check could never reliably catch this).
      const msgId = params.MessageSid || crypto.randomUUID();
      // BUG FIX — see rehostInboundMediaForInbox's comment above: a
      // voice-memo/photo/PDF MMS logged with an empty body and no media
      // reference showed as a literal blank message in the Inbox.
      const inNumMedia2 = Number(params.NumMedia || "0");
      const inMediaType2 = inNumMedia2 > 0 ? (params.MediaContentType0 || "") : "";
      const inMediaUrl2 = inNumMedia2 > 0 && params.MediaUrl0
        ? await rehostInboundMediaForInbox(params.MediaUrl0, inMediaType2, twilioSid, twilioToken, context.env.SUPABASE_SERVICE_ROLE_KEY, ownerId)
        : null;
      const newMsg = {
        id: msgId, sid: params.MessageSid || null, dir: "in",
        body: bodyRaw || (inMediaUrl2 ? (inMediaType2.startsWith("audio/") ? "[voice memo]" : inMediaType2.startsWith("image/") ? "[photo]" : "[attachment]") : ""),
        ts: Date.now(),
        ...(inMediaUrl2 ? { mediaUrl: inMediaUrl2, mediaType: inMediaType2 } : {}),
      };
      const alreadyHave = existingThread && (Array.isArray(existingThread.messages) ? existingThread.messages : []).some((m: any) => m?.id === msgId);
      if (alreadyHave) {
        console.log("[TwilioSmsWebhook] message", msgId, "already recorded — skipping duplicate insert");
      } else {
        // BUG FIX — "my SMS inbox conversation got split up again."
        // find_or_create_inbox_thread (migration 0090/0091) replaces the
        // separate append-vs-insert branches with one atomic, advisory-
        // lock-serialized call — this same phone number can also be
        // written to by sendSms's Alfred-reply logging around the same
        // moment; the old read-then-branch here could race it and end up
        // creating a second thread for the same number instead of finding
        // the one the other write just created.
        const contactName = match ? `${match.firstName || ""} ${match.lastName || ""}`.trim() || from : from;
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ p_owner_id: ownerId || null, p_channel: "sms", p_contact_phone: from, p_contact_name: contactName, p_customer_id: match?.id || null, p_message: newMsg, p_unread: true }),
        });
        if (!rpcRes.ok) console.error("[TwilioSmsWebhook] find_or_create_inbox_thread failed (" + rpcRes.status + "):", await rpcRes.text().catch(() => ""));
      }
      // FEATURE — real push notification for a new inbound text, same event
      // the Inbox realtime subscription already surfaces while the tab's
      // open — this is what shows up on the owner's phone lock screen when
      // it isn't. Fire-and-forget within this same background task; never
      // lets a push failure affect the actual SMS/Inbox logging above.
      if (ownerId && !alreadyHave) {
        const pushContactLabel = match ? `${match.firstName || ""} ${match.lastName || ""}`.trim() || from : from;
        fetch(`${new URL(context.request.url).origin}/api/send-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ownerId,
            title: `New text from ${pushContactLabel}`,
            body: newMsg.body || "New message",
            url: "/#/inbox", tag: "inbox-" + msgId,
          }),
        }).catch(() => {});
      }
    } catch (e: any) {
      console.error("[TwilioSmsWebhook] failed to persist inbound message to inbox_threads:", e?.message);
      // Non-fatal — the client-side poll is still a fallback for this.
    }

    // FEATURE — customer-facing Alfred auto-response (opt-in per customer,
    // off by default — see CustomerDetail.tsx's toggle). Only for a matched,
    // opted-in customer's ORDINARY message — never for STOP/START/keyword
    // compliance actions (those still go through the exact flow below,
    // unmodified). Runs in the background the same way the owner bridge
    // does; if no model is configured this just returns null and nothing
    // changes from today's behavior (message stays logged for the owner to
    // answer manually).
    // BUG FIX (audit finding — vacation mode marketed "set vacation mode
    // and it can run the front desk while you're out" but this branch only
    // ever checked the customer's own opt-in, never vacationMode at all —
    // turning vacation mode on did nothing for customers who hadn't
    // separately opted in, contradicting the marketing copy. Vacation mode
    // now also opens front-desk auto-response for EVERY matched customer
    // while the window is active, using the same active+date-range check
    // App.tsx already uses for the owner check-in cadence — except when the
    // owner set autonomyLevel to "hold_everything", which means don't act
    // without them, not "act on everything."
    const vacationFrontDeskActive = !!(
      vacationMode?.active &&
      vacationMode.autonomyLevel !== "hold_everything" &&
      (!vacationMode.startDate || !vacationMode.endDate ||
        (new Date().toISOString().slice(0, 10) >= vacationMode.startDate && new Date().toISOString().slice(0, 10) <= vacationMode.endDate))
    );
    if (!isStop && !isStart && !isOptInKeyword && !isConfirm && match && (match.alfredAutoRespond || vacationFrontDeskActive)) {
      const custCtx = { authHeaders, ownerId, companyName, twilioSid, twilioToken, twilioFrom, ownerPhone: myPhone, autoApproveReschedules: alfredAutoApproveReschedules };
      context.waitUntil(
        resolveIncomingText(params, bodyRaw, twilioSid, twilioToken, openaiKey, (context.env as any).AI, context.env.SUPABASE_SERVICE_ROLE_KEY, ownerId)
          .then((text) => isTranscriptionFailureNote(text)
            // A customer should never see an internal setup detail like
            // "add the AI binding in Cloudflare" — keep it generic, unlike
            // the owner/employee branches which get the real diagnostic.
            ? "Sorry, I couldn't quite make out that voice memo — mind sending it as a text instead?"
            : runAlfredCustomerAgent(custCtx, match, modelKeys, modelPriority, text))
          .then((reply) => { if (reply) return sendCustomerAgentReply(custCtx, from, reply); })
          .catch((e: any) => console.error("[TwilioSmsWebhook] customer Alfred agent failed:", e?.message))
      );
      return twiml();
    }

    if (!isStop && !isStart && !isOptInKeyword && !isConfirm) return twiml(); // ordinary message — already persisted above

    const origin = new URL(context.request.url).origin;
    const termsUrl = `${origin}/#/terms?co=${encodeURIComponent(companyName)}`;
    const privacyUrl = `${origin}/#/privacy?co=${encodeURIComponent(companyName)}`;

    const patchCustomer = async (id: string, patch: Record<string, unknown>) => {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) console.error("[TwilioSmsWebhook] patch failed for", id, ":", await res.text().catch(() => ""));
      return res.ok;
    };

    // ISSUE 1 (round 8) — the confirmation/welcome TwiML replies below are
    // real outbound SMS Twilio sends to the customer, but until now nothing
    // ever recorded them in inbox_threads — they were invisible in the
    // owner's Inbox, which read as "the auto-reply isn't showing as
    // outgoing" (it wasn't showing at all). Persist each one as a normal
    // dir:"out" message in the same thread the inbound trigger message just
    // landed in. Id is derived from the triggering MessageSid (not a fresh
    // random one) so a Twilio webhook retry of the SAME inbound request can
    // never log the reply twice.
    const persistOutboundReply = async (text: string) => {
      try {
        // Still need one read to dedupe a Twilio webhook retry (same
        // replyId already logged) — that's a different concern from the
        // find-or-create race below, so it stays.
        const threadsRes = await fetch(`${SUPABASE_URL}/rest/v1/inbox_threads?channel=eq.sms&select=id,contact_phone,messages${ownerFilter}`, {
          headers: authHeaders,
        });
        const existingThreads = await threadsRes.json().catch(() => []);
        const existingThread = Array.isArray(existingThreads)
          ? existingThreads.find((t: any) => normalizePhoneDigits(t.contact_phone) === fromDigits)
          : null;
        const replyId = params.MessageSid ? params.MessageSid + "-reply" : crypto.randomUUID();
        const alreadyHave = existingThread && (Array.isArray(existingThread.messages) ? existingThread.messages : []).some((m: any) => m?.id === replyId);
        if (alreadyHave) return;
        const replyMsg = { id: replyId, dir: "out", body: text, ts: Date.now() };
        // BUG FIX — "my SMS inbox conversation got split up again."
        // find_or_create_inbox_thread (migration 0090/0091) replaces the
        // separate append-vs-insert branches with one atomic call, closing
        // the race between this auto-reply logger and the inbound-message
        // logger above both writing to the same phone number's thread.
        const contactName = match ? `${match.firstName || ""} ${match.lastName || ""}`.trim() || from : from;
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ p_owner_id: ownerId || null, p_channel: "sms", p_contact_phone: from, p_contact_name: contactName, p_customer_id: match?.id || null, p_message: replyMsg, p_unread: false }),
        });
        if (!rpcRes.ok) console.error("[TwilioSmsWebhook] find_or_create_inbox_thread (auto-reply) failed (" + rpcRes.status + "):", await rpcRes.text().catch(() => ""));
      } catch (e: any) {
        console.error("[TwilioSmsWebhook] failed to persist auto-reply:", e?.message);
      }
    };

    if (isStop) {
      if (match?.id) {
        await patchCustomer(match.id, { smsOptOut: true, optOutDate: new Date().toISOString().slice(0, 10), smsOptIn: false, smsOptInPending: false });
        console.log("[TwilioSmsWebhook] opted OUT customer", match.id);
      } else {
        console.warn("[TwilioSmsWebhook] STOP from unrecognized number:", from);
      }
      // No auto-reply here — if Advanced Opt-Out is enabled on the Messaging
      // Service, Twilio already sends the required confirmation text at the
      // carrier level; replying here too would double-text the customer.
      return twiml();
    }

    // Confirmation step of the double opt-in (Twilio "via text" keyword flow)
    // — only completes the opt-in if THIS number actually has a pending
    // request on file, so a stray "Y"/"YES" from someone who never texted
    // the keyword doesn't silently opt them in.
    if (isConfirm && match?.smsOptInPending) {
      await patchCustomer(match.id, { smsOptIn: true, smsOptInAt: new Date().toISOString(), smsOptInPending: false, smsOptOut: false });
      console.log("[TwilioSmsWebhook] confirmed opt-in for customer", match.id);
      const replyText = `You're confirmed! Welcome to ${companyName} text updates — appointment reminders, on-my-way alerts, and occasional offers. Msg freq varies (~1-4/mo). Msg&data rates may apply. Reply HELP for help, STOP to cancel anytime.`;
      await persistOutboundReply(replyText);
      return twiml(replyText);
    }

    if (isOptInKeyword) {
      let customerId = match?.id;
      if (!customerId) {
        // New number, no existing customer record — create a minimal one so
        // the pending opt-in has somewhere to live. Mirrors LeadFormPage.tsx's
        // bare-minimum new-lead shape.
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/customers`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=representation" },
          body: JSON.stringify([{ id: crypto.randomUUID(), firstName: "", lastName: "", phone: from, email: "", totalSpent: 0, createdAt: new Date().toISOString(), smsOptInPending: true, smsOptInPendingAt: new Date().toISOString(), owner_id: ownerId || null }]),
        });
        const inserted = await insertRes.json().catch(() => null);
        customerId = Array.isArray(inserted) ? inserted[0]?.id : undefined;
        if (!customerId) console.error("[TwilioSmsWebhook] failed to create customer for new opt-in number:", from);
      } else {
        await patchCustomer(customerId, { smsOptInPending: true, smsOptInPendingAt: new Date().toISOString() });
      }
      console.log("[TwilioSmsWebhook] opt-in keyword received, pending confirmation for", customerId || from);
      const replyText = `Thanks for texting ${keyword} to ${companyName}! Reply Y to confirm you want text updates (appointment reminders & offers, ~1-4 msgs/mo). Msg&data rates may apply. Terms: ${termsUrl} Privacy: ${privacyUrl}`;
      await persistOutboundReply(replyText);
      return twiml(replyText);
    }

    // isStart (plain STOP-reversal, not the keyword flow above) — checked
    // explicitly (not just "fell through the checks above") so a bare "Y"
    // that ISN'T a pending-confirmation reply (isConfirm is true for "Y" too,
    // but that branch above already returned if it applied) can never
    // silently opt someone in here just because it also passed the top-level
    // gate — "Y" alone is not one of START_WORDS.
    if (isStart) {
      if (match?.id) {
        await patchCustomer(match.id, { smsOptOut: false, smsOptIn: true, smsOptInAt: new Date().toISOString(), smsOptInPending: false });
        console.log("[TwilioSmsWebhook] opted back IN customer", match.id);
      } else {
        console.warn("[TwilioSmsWebhook] START from unrecognized number:", from);
      }
    }
    return twiml();
  } catch (e: any) {
    console.error("[TwilioSmsWebhook] handler error:", e?.message);
    // Still 200 + empty TwiML — a bug in our own bookkeeping must never cause
    // Twilio to treat a real inbound message as failed/retry it.
    return twiml();
  }
};
