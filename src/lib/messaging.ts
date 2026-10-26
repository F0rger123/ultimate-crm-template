import { supabase, getStoredGoogleConnection, setStoredGoogleToken, fetchOwnerGoogleToken } from "./supabase";
import { uid, withTimeout, toE164 } from "./utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TwilioSettings {
  twilioSid?: string;
  twilioToken?: string;
  // FIX 13 — Settings → Integrations (and every "is Twilio configured?" check
  // elsewhere: InboxPage, CampaignsPage) reads/writes the From number under
  // `twilioFrom`. This field was still called `twilioPhone` here, which meant
  // the owner could see a green "Configured ✓" badge in Settings while every
  // actual twilioSend() call threw "Twilio not configured" — the number it
  // was checking was never the field being filled in. Keeping twilioPhone as
  // a fallback in case anything still constructs a settings object with the
  // old name directly.
  twilioFrom?: string;
  twilioPhone?: string;
  twilioBackendUrl?: string;
  myPhone?: string;
  // FEATURE — A2P 10DLC campaign compliance ("ATP checking"). Required to
  // check campaign status — Twilio's compliance API is keyed off a Messaging
  // Service, not a raw From number.
  twilioMessagingServiceSid?: string;
  // Cached result of the last status check (see checkA2pCampaignStatus) so
  // the automation batch-approval gate doesn't have to hit Twilio's API on
  // every single gather tick — refreshed on-demand from Settings.
  twilioA2pCampaignStatus?: string;
  twilioA2pCampaignCheckedAt?: number;
  // Reference copy of the incoming-webhook URL configured in Twilio Console —
  // see the matching field on AppSettings (types/index.ts) for why this is
  // stored rather than only computed/displayed.
  twilioIncomingWebhookUrl?: string;
}

export interface EmailSettings {}

// ─── Buffer (social posting) ────────────────────────────────────────────────
// Buffer retired its old REST API (api.bufferapp.com/1/...) in favor of a
// GraphQL API at api.buffer.com, authenticated with a Bearer API key from
// https://publish.buffer.com/settings/api (see developers.buffer.com).
//
// BUG FIX — this used to call api.buffer.com DIRECTLY from the browser
// (exactly like the Twilio direct-API path). Buffer's API never returns
// Access-Control-Allow-Origin, so every call was rejected by CORS before it
// even reached Buffer ("blocked by CORS policy: Response to preflight
// request doesn't pass access control check") — org lookup, channel list,
// and posting were all 100% broken, not just occasionally failing. Routed
// through functions/api/buffer-action.ts (same-origin, server-side, no CORS
// restriction) instead, same fix as twilio-send.ts.
export interface BufferSettings {
  bufferApiKey?: string;
  bufferOrganizationId?: string;
  bufferChannelIds?: Record<string, string>;
}

const bufferGraphQL = async <T = any>(apiKey: string, query: string, variables: Record<string, unknown>): Promise<T> => {
  const res = await fetch("/api/buffer-action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, query, variables }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    throw new Error(json.error ?? `Buffer error ${res.status}`);
  }
  return json.data as T;
};

export interface BufferChannel {
  id: string;
  name: string;
  displayName: string;
  service: string;
  avatar?: string;
}

// Buffer's GraphQL schema scopes channels to an Organization — fetch the
// account's first/only org automatically so the user only has to paste an
// API key, not hunt down an org ID.
export const fetchBufferOrganizationId = async (apiKey: string): Promise<string | null> => {
  const data = await bufferGraphQL<{ account: { organizations: { id: string }[] } }>(
    apiKey,
    `query { account { organizations { id } } }`,
    {}
  );
  return data?.account?.organizations?.[0]?.id ?? null;
};

// BUG FIX — Buffer's schema uses custom scalar types for ids, not plain
// String. Declaring $organizationId as String! got Buffer's own GraphQL
// validator to reject the request outright ("used in position expecting
// type OrganizationId!") before it ever looked at the actual key/org —
// every "Find Channels" click failed with this, regardless of whether the
// API key was valid.
export const fetchBufferChannels = async (apiKey: string, organizationId: string): Promise<BufferChannel[]> => {
  const data = await bufferGraphQL<{ channels: BufferChannel[] }>(
    apiKey,
    `query GetChannels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName service avatar } }`,
    { organizationId }
  );
  return data?.channels ?? [];
};

// BUG FIX — scheduledAt was accepted as a param but never actually sent as
// `dueAt` in the mutation, so a "scheduled" post always just landed in
// Buffer's next open queue slot instead of the specific date/time picked in
// the UI. Buffer's schema wants mode `customScheduled` (not `addToQueue`)
// paired with a `dueAt` ISO datetime to honor an exact time.
//
// BUG FIX (real root cause of "the whole posting system doesn't work") —
// this mutation was built against a GUESSED shape of Buffer's schema that
// turned out to be wrong in several ways, verified against Buffer's real
// live GraphQL API (api.buffer.com) via introspection:
//   - `$schedulingType`/`$mode` were declared as `PostSchedulingTypeInput`/
//     `PostCreationModeInput` — NEITHER type exists in Buffer's schema at
//     all (introspection confirms). The real types are `SchedulingType`/
//     `ShareMode` (both enums) — same string values ("automatic"/
//     "notification", "shareNow"/"customScheduled" etc.) were already
//     right, only the declared GraphQL type name was wrong, which is
//     enough on its own to make the whole query invalid.
//   - `CreatePostInput.assets: [AssetInput!]!` is REQUIRED (non-null list)
//     and was never being sent at all — a required argument silently
//     missing fails query validation outright, every single time,
//     regardless of auth or channel. There is no `media`/`PostMediaInput`
//     field in the real schema — media goes through this `assets` list
//     instead, each entry shaped `{ image: { url } }` or `{ video: { url } }`.
//   - `CreatePostInput.needsApproval: Boolean!` is also REQUIRED and was
//     never sent either — same failure mode.
// Fixed to the verified real shape below — no more silent guess-and-hope,
// no more text-only fallback-on-failure hack (assets is just always sent,
// empty when there's no media, so there's nothing left to fall back from).
export const postToBuffer = async (
  settings: BufferSettings,
  platform: string,
  text: string,
  scheduledAt?: Date,
  mediaUrl?: string,
  mediaType?: "image" | "video"
): Promise<string> => {
  const { bufferApiKey, bufferChannelIds } = settings;
  const channelId = bufferChannelIds?.[platform];
  if (!bufferApiKey || !channelId) {
    throw new Error("Buffer not connected for this platform — add an API key and pick a channel in Settings.");
  }
  const assets = mediaUrl
    ? [mediaType === "video" ? { video: { url: mediaUrl } } : { image: { url: mediaUrl } }]
    : [];
  const data = await bufferGraphQL<{ createPost: { __typename: string; message?: string; post?: { id: string } } }>(
    bufferApiKey,
    `mutation CreatePost($text: String!, $channelId: ChannelId!, $schedulingType: SchedulingType!, $mode: ShareMode!, $dueAt: DateTime, $assets: [AssetInput!]!, $needsApproval: Boolean!) {
      createPost(input: { text: $text, channelId: $channelId, schedulingType: $schedulingType, mode: $mode, dueAt: $dueAt, assets: $assets, needsApproval: $needsApproval }) {
        __typename
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }`,
    {
      text, channelId, assets,
      schedulingType: scheduledAt ? "automatic" : "notification",
      mode: scheduledAt ? "customScheduled" : "shareNow",
      dueAt: scheduledAt ? scheduledAt.toISOString() : null,
      needsApproval: false,
    }
  );
  if (data?.createPost?.message) throw new Error(data.createPost.message);
  return data?.createPost?.post?.id || "";
};

// Real per-post analytics — Buffer's Post type exposes `metrics` (normalized
// reactions/impressions/reach/etc, populated by the destination network once
// a post is sent) and `externalLink` (the live URL of the published post).
// Only meaningful for posts actually sent through Buffer (i.e. we have the
// bufferPostId Buffer handed back from createPost) — there's no equivalent
// data source for posts published manually outside Buffer.
export interface BufferPostMetric { type: string; name: string; value: number; unit: string }

export const fetchBufferPostAnalytics = async (
  apiKey: string,
  postId: string
): Promise<{ metrics: BufferPostMetric[]; externalLink?: string; metricsUpdatedAt?: string } | null> => {
  const data = await bufferGraphQL<{ post: { id: string; externalLink?: string; metrics?: BufferPostMetric[]; metricsUpdatedAt?: string } }>(
    apiKey,
    `query GetPostMetrics($id: PostId!) { post(input: { id: $id }) { id externalLink metrics { type name value unit } metricsUpdatedAt } }`,
    { id: postId }
  );
  if (!data?.post) return null;
  return { metrics: data.post.metrics || [], externalLink: data.post.externalLink, metricsUpdatedAt: data.post.metricsUpdatedAt };
};

// ─── SMS opt-out enforcement ────────────────────────────────────────────────
// Twilio compliance gap (found in audit) — Customer.smsOptOut has existed on
// the type for a while and useAutomationEngine's sendOne already checked it,
// but NOTHING ever set it to true, so it never actually blocked anything, on
// any send path. twilioSend() has no access to the live `customers` React
// state (it's a plain lib function, not a hook) and no reliable way to look
// one up server-side (phone numbers aren't stored in a normalized format —
// a Supabase .eq() query would miss formatting variants like "(555) 555-0100"
// vs "+15555550100"). Instead, App.tsx calls setOptedOutPhones(customers)
// once whenever the live customers array changes, and every twilioSend() call
// anywhere in the app — automations, manual Inbox replies, OTW/Running Late/
// invoice texts, campaigns, review requests — checks this same in-memory set
// before sending, with zero changes needed at any of the ~45 call sites.
let optedOutPhoneDigits = new Set<string>();
// FIX — a customer phone can be stored as a plain 10-digit US number
// ("555 555 0100") while the number actually being sent to/checked against
// is E.164 with the country code ("+15555550100", 11 digits) — plain digit
// stripping alone left those two never equal, so an opted-out or
// test-client customer stored without a country code could silently slip
// past both checks. Strip a leading "1" off an 11-digit result so both
// forms compare equal (same fix applied in the Twilio Cloudflare Functions).
const normalizePhoneDigits = (p?: string | null) => {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};

export const setOptedOutPhones = (customers: { phone?: string; smsOptOut?: boolean }[]): void => {
  optedOutPhoneDigits = new Set(
    customers.filter(c => c.smsOptOut && c.phone).map(c => normalizePhoneDigits(c.phone))
  );
};

export const isPhoneOptedOut = (phone: string): boolean => {
  const digits = normalizePhoneDigits(phone);
  return !!digits && optedOutPhoneDigits.has(digits);
};

// SECURITY FIX (found via audit) — the opt-out check above only ever ran in
// this browser tab's own JS; functions/api/twilio-send.ts (the actual
// Twilio proxy every send eventually hits) had no way to independently
// re-verify it, so anyone who obtained a business's Twilio SID/Account
// Token (e.g. from app_settings, readable by any of that business's own
// signed-in employee sessions — see docs/ARCHITECTURE.md) could POST straight to that
// endpoint and text an opted-out number directly, bypassing this file
// entirely. Same in-memory-registry pattern as setOptedOutPhones above —
// App.tsx sets this once whenever the signed-in owner's id is known, and
// twilioSend() below passes it along so the server can do its own lookup.
let currentOwnerIdForSms: string | null = null;
export const setCurrentOwnerIdForSms = (ownerId: string | null): void => { currentOwnerIdForSms = ownerId; };

// ─── Testing mode (round 13, item 12) ───────────────────────────────────────
// Same in-memory-registry pattern as opt-out above (see comment there for
// why): App.tsx calls setTestModeContacts(customers, settings.testModeEnabled)
// whenever customers or that setting changes, and every send path below
// checks it before actually dispatching — so an owner can flag specific
// customers "Test Client" (CustomerModal) and, with the Settings → Testing
// Mode master switch on, run real end-to-end flows (estimates, automations,
// campaigns) against them with zero chance of a real SMS/email escaping to
// an actual customer, without needing to touch each of the ~45 call sites.
let testModeActive = false;
let testClientPhoneDigits = new Set<string>();
let testClientEmailsLower = new Set<string>();

export const setTestModeContacts = (
  customers: { phone?: string; email?: string; isTestClient?: boolean }[],
  enabled: boolean
): void => {
  testModeActive = !!enabled;
  testClientPhoneDigits = new Set(customers.filter(c => c.isTestClient && c.phone).map(c => normalizePhoneDigits(c.phone)));
  testClientEmailsLower = new Set(customers.filter(c => c.isTestClient && c.email).map(c => (c.email || "").trim().toLowerCase()));
};

const isTestModeBlockedPhone = (phone: string): boolean => {
  if (!testModeActive) return false;
  const digits = normalizePhoneDigits(phone);
  return !!digits && testClientPhoneDigits.has(digits);
};

const isTestModeBlockedEmail = (email: string): boolean => {
  if (!testModeActive) return false;
  const e = (email || "").trim().toLowerCase();
  return !!e && testClientEmailsLower.has(e);
};

// ─── Twilio SMS / WhatsApp ────────────────────────────────────────────────────

export const twilioSend = async (
  settings: TwilioSettings,
  to: string,
  body: string,
  channel: "sms" | "whatsapp" = "sms"
): Promise<void> => {
  if (channel === "sms" && isPhoneOptedOut(to)) {
    throw new Error("This contact has opted out of text messages (replied STOP) — SMS blocked.");
  }
  if (isTestModeBlockedPhone(to)) {
    console.log("[TestMode] SMS to test client blocked — would have sent:", body);
    return;
  }
  const { twilioSid, twilioToken, twilioBackendUrl } = settings;
  const twilioPhone = settings.twilioFrom || settings.twilioPhone;
  if (!twilioSid || !twilioToken || !twilioPhone) {
    throw new Error("Twilio not configured — add Account SID, Auth Token, and From number in Settings → Integrations.");
  }

  // ISSUE 3 (round 11) — normalize to E.164 right here, the one place every
  // SMS send path (OTW, Running Late, Campaigns, automations, Alfred, the
  // owner's Inbox) actually funnels through, regardless of what format the
  // number was stored/typed in upstream. See toE164 in lib/utils.ts.
  const fromE164 = toE164(twilioPhone);
  const toE164Num = toE164(to);
  if (!toE164Num) throw new Error("Invalid phone number — can't send SMS.");
  const from = channel === "whatsapp" ? `whatsapp:${fromE164}` : fromE164;
  const toNum = channel === "whatsapp" ? `whatsapp:${toE164Num}` : toE164Num;

  // AUDIT 6 — Twilio's REST API never returns CORS headers for browser-origin
  // requests, so a direct fetch() from here to api.twilio.com always fails
  // (opaque network error, not even a readable HTTP status) no matter how
  // correct the SID/Token/From are — this was the actual reason SMS sending
  // silently did nothing across the whole app. Route through this project's
  // own same-origin Cloudflare Pages Function (functions/api/twilio-send.ts)
  // by default; an explicitly configured twilioBackendUrl (self-hosted proxy)
  // still takes priority if the owner has one.
  const endpoint = twilioBackendUrl ? `${twilioBackendUrl}/sms` : "/api/twilio-send";
  const payload = twilioBackendUrl
    ? { to: toNum, from, body }
    // ownerId (see setCurrentOwnerIdForSms above) lets the server re-check
    // opt-out status itself instead of trusting this browser-side check as
    // the only line of defense.
    : { sid: twilioSid, token: twilioToken, to: toNum, from, body, ownerId: currentOwnerIdForSms };
  // SECURITY FIX (audit finding) — /api/twilio-send had no auth check at
  // all: anyone who obtained an ownerId (several public endpoints return
  // one) could POST directly to it and send SMS through that business's
  // real Twilio number/reputation to any phone, at their expense. The
  // server now requires this bearer token and resolves the caller's OWN
  // owner_id from it server-side, ignoring whatever ownerId the request
  // body claims — this token is just along for that check for our own
  // endpoint; an explicitly configured self-hosted twilioBackendUrl is the
  // owner's own server and doesn't need it. getSession() has a documented
  // hang bug in this codebase with no timeout — wrapped accordingly.
  let accessToken: string | undefined;
  if (!twilioBackendUrl) {
    // BUG FIX (user report — "failed to send review request, not
    // authenticated") — supabase.auth.getSession() has a documented
    // real-world hang/timeout issue in this codebase (navigator-lock
    // contention, seen elsewhere under real mobile network conditions) —
    // a single attempt timing out here silently sent the request with NO
    // Authorization header, which the server correctly (but unhelpfully)
    // rejects as "Not authenticated" — reading like an account problem
    // when it was actually just one slow/flaky getSession() call. One
    // retry before giving up, same "transient blip" pattern already used
    // for exactly this class of Supabase-call flakiness elsewhere in this
    // app (App.tsx's settings sync).
    try {
      const { data } = await withTimeout(supabase.auth.getSession(), 8000, "Get session");
      accessToken = data?.session?.access_token;
    } catch {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), 8000, "Get session (retry)");
        accessToken = data?.session?.access_token;
      } catch { /* fall through — server will reject with no valid session */ }
    }
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    console.error("[Twilio] send failed:", data?.error || res.status);
    throw new Error(data?.error || `Twilio error ${res.status}`);
  }
};

// ─── A2P 10DLC campaign compliance status ("ATP checking") ─────────────────
// Queries Twilio's Messaging Compliance API (via the same-origin proxy, same
// CORS reason as twilioSend above) for the current A2P campaign status
// attached to a Messaging Service. Campaign statuses Twilio uses: "VERIFIED"
// (approved, can send), "IN_PROGRESS"/"PENDING" (still under carrier review),
// "FAILED" (rejected — needs re-registration). Requires a Messaging Service
// SID (settings.twilioMessagingServiceSid) — a raw From phone number alone
// has no campaign resource to check.
export interface A2pCampaignStatus {
  registered: boolean;
  campaignStatus: string | null;
  campaignId: string | null;
}

export const checkA2pCampaignStatus = async (settings: TwilioSettings): Promise<A2pCampaignStatus> => {
  const { twilioSid, twilioToken, twilioMessagingServiceSid, twilioBackendUrl } = settings;
  if (!twilioSid || !twilioToken || !twilioMessagingServiceSid) {
    throw new Error("Add your Twilio Account SID, Auth Token, and Messaging Service SID in Settings → Integrations first.");
  }
  const endpoint = twilioBackendUrl ? `${twilioBackendUrl}/campaign-status` : "/api/twilio-campaign-status";
  const payload = twilioBackendUrl
    ? { messagingServiceSid: twilioMessagingServiceSid }
    // SECURITY FIX — ownerId lets the server resolve the REAL credentials
    // from owner_secrets, overriding whatever (now-masked) value is sent
    // here as `token` — see migration 0085's comment.
    : { sid: twilioSid, token: twilioToken, messagingServiceSid: twilioMessagingServiceSid, ownerId: currentOwnerIdForSms };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || `Twilio error ${res.status}`);
  // The exact shape of Twilio's real response hasn't been verified live from
  // this codebase — always log the untouched payload so the real shape is
  // visible in devtools the first time this runs against a live account, in
  // case registered/campaignStatus below parsed it wrong.
  console.log("[Twilio A2P] raw campaign status response:", data.raw ?? data);
  return { registered: !!data.registered, campaignStatus: data.campaignStatus || null, campaignId: data.campaignId || null };
};

// ─── Live Twilio account status (balance + suspension) ─────────────────────
// checkA2pCampaignStatus above answers "is the 10DLC campaign approved";
// this answers the more basic "can this account send AT ALL right now" —
// settings.twilioSid/Token/From being present only means credentials were
// typed in once, not that the account isn't suspended for non-payment or
// out of funds. See functions/api/twilio-account-status.ts.
export interface TwilioAccountStatus {
  accountStatus: string | null; // "active" | "suspended" | "closed"
  accountType: string | null;   // "Trial" | "Full"
  balance: string | null;
  currency: string | null;
  balanceError: string | null;
}

export const checkTwilioAccountStatus = async (settings: TwilioSettings): Promise<TwilioAccountStatus> => {
  const { twilioSid, twilioToken, twilioBackendUrl } = settings;
  if (!twilioSid || !twilioToken) {
    throw new Error("Add your Twilio Account SID and Auth Token in Settings → Integrations first.");
  }
  const endpoint = twilioBackendUrl ? `${twilioBackendUrl}/account-status` : "/api/twilio-account-status";
  // SECURITY FIX — ownerId lets the server resolve the REAL credentials
  // from owner_secrets — see migration 0085's comment / checkA2pCampaignStatus above.
  const payload = twilioBackendUrl ? { sid: twilioSid, token: twilioToken } : { sid: twilioSid, token: twilioToken, ownerId: currentOwnerIdForSms };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.error || `Twilio error ${res.status}`);
  return {
    accountStatus: data.accountStatus ?? null,
    accountType: data.accountType ?? null,
    balance: data.balance ?? null,
    currency: data.currency ?? null,
    balanceError: data.balanceError ?? null,
  };
};

// ─── Inbox sync (SMS) ─────────────────────────────────────────────────────────
// Every outbound SMS sent from anywhere in the app (owner's own Inbox compose,
// or an employee's OTW/Running Late/invoice-text from the field portal) needs
// to show up in the owner's Inbox, on every device. The Inbox itself stores
// each conversation as one row in `inbox_threads` with its message list in a
// single JSONB column (mirrors how `jobs` already stores arrays like `photos`
// as JSONB) rather than a normalized messages table — simplest schema that
// still lets InboxPage read/poll it like any other synced table. Degrades to
// a no-op (logged, not thrown) if the table doesn't exist yet so a missing
// migration never breaks the actual SMS send.
export interface InboxSyncMessage {
  id: string;
  dir: "in" | "out";
  body: string;
  ts: number;
  status?: "sending" | "sent" | "failed";
  subject?: string;
}

export const logOutboundSmsToInbox = async (
  opts: { contactName: string; contactPhone: string; customerId?: string | null; body: string; ownerId?: string | null }
): Promise<void> => {
  try {
    const newMsg: InboxSyncMessage = { id: uid(), dir: "out", body: opts.body, ts: Date.now(), status: "sent" };
    // BUG FIX — "the SMS inbox conversation got split up again." Used to be
    // a plain read-then-write: fetch every thread, find one by normalized
    // phone in JS, insert a new row if none found. That's a check-then-act
    // race against the exact same class of write happening server-side
    // (the Twilio webhook logging an inbound reply around the same
    // moment) — two concurrent callers could both see "no thread yet" and
    // both insert, permanently splitting one conversation into two.
    // find_or_create_inbox_thread (migration 0090) does the whole find-or-
    // create-and-append as one atomic, advisory-lock-serialized operation
    // server-side, so a concurrent second caller can't race it anymore.
    const { error: rpcError } = await (supabase as any).rpc("find_or_create_inbox_thread", {
      p_owner_id: opts.ownerId ?? null, p_channel: "sms", p_contact_phone: opts.contactPhone,
      p_contact_name: opts.contactName, p_customer_id: opts.customerId || null, p_message: newMsg, p_unread: false,
    });
    if (rpcError) console.warn("[Inbox Sync] find_or_create_inbox_thread failed:", rpcError.message);
  } catch (e: any) {
    console.warn("[Inbox Sync] failed to log outbound SMS:", e?.message);
  }
};

// FEATURE — automatic payment confirmation receipt, sent right after ANY
// successful charge (online invoice pay, in-person card-on-file, employee
// checkout) regardless of who processed it. Text if the customer has a
// phone on file (logged to inbox_threads like every other outbound SMS,
// per docs/ARCHITECTURE.md's "Critical rules"), otherwise email via the owner's Gmail
// (sendOwnerGmailOnly — never Resend, same rule). Throws only if the
// customer has neither on file; callers should treat that as non-fatal
// (the charge itself already succeeded) and just toast a warning.
export const sendPaymentReceipt = async (
  settings: TwilioSettings & EmailSettings & { googleConnected?: boolean; googleProviderToken?: string; googleEmail?: string; googleRefreshToken?: string; googleTokenExpiresAt?: number; googleBackendUrl?: string },
  customer: { firstName?: string; phone?: string; email?: string; id?: string },
  amountCents: number,
  description: string,
  companyName: string
): Promise<void> => {
  const amount = (amountCents / 100).toFixed(2);
  const name = customer.firstName || "there";
  if (customer.phone) {
    const body = `Hi ${name}, this confirms your payment of $${amount} to ${companyName}${description ? " for " + description : ""}. Thank you!`;
    await twilioSend(settings, customer.phone, body);
    await logOutboundSmsToInbox({ contactName: name, contactPhone: customer.phone, customerId: customer.id, body });
    return;
  }
  if (customer.email) {
    const html = emailShell(settings as any, "Payment Receipt", `
      <p>Hi ${name},</p>
      <p>This confirms your payment of <strong>$${amount}</strong> to ${companyName}${description ? " for " + description : ""}.</p>
      <p>Thank you for your business!</p>
    `);
    await sendOwnerGmailOnly(settings, customer.email, `Payment Receipt — ${companyName}`, html);
    return;
  }
  throw new Error("No phone or email on file — receipt not sent.");
};

// ─── Twilio incoming poll ─────────────────────────────────────────────────────

export interface TwilioMessage {
  sid: string;
  from: string;
  body: string;
  dateSent: string;
  direction: string;
}

export const pollTwilioIncoming = async (
  settings: TwilioSettings,
  since: string
): Promise<TwilioMessage[]> => {
  const { twilioSid, twilioToken, twilioBackendUrl } = settings;
  if (!twilioSid || !twilioToken) return [];

  if (twilioBackendUrl) {
    try {
      const res = await fetch(`${twilioBackendUrl}/sms/incoming?since=${since}`);
      if (!res.ok) return [];
      return res.json();
    } catch (e: any) {
      console.warn("[Twilio] inbound poll (custom backend) failed:", e?.message);
      return [];
    }
  }

  // AUDIT 6 — same CORS blocker as twilioSend; route through the same-origin
  // Pages Function instead of api.twilio.com directly.
  try {
    // The server only reads the SIGNED-IN business's texts (see twilio-inbound.ts).
    let accessToken: string | undefined;
    try { accessToken = (await withTimeout(supabase.auth.getSession(), 8000, "Get session")).data?.session?.access_token; } catch { /* server answers 401 */ }
    const res = await fetch("/api/twilio-inbound", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify({ sid: twilioSid, token: twilioToken, since, ownerId: currentOwnerIdForSms }),
    });
    if (!res.ok) { console.warn("[Twilio] inbound poll failed:", res.status); return []; }
    const data = await res.json() as { messages?: TwilioMessage[] };
    return data.messages ?? [];
  } catch (e: any) {
    console.warn("[Twilio] inbound poll threw:", e?.message);
    return [];
  }
};

// ─── Email via Gmail API ──────────────────────────────────────────────────────

// BUG FIX — RFC 2822 headers must be ASCII. Every Subject line in this app
// that includes a non-ASCII character (most commonly an em-dash "—", e.g.
// "Job completed — Jordan Lee") was placed directly in the raw MIME header
// as literal UTF-8 bytes with no encoding declaration — headers only get a
// Content-Type/charset for the BODY, never for their own bytes. Receiving
// clients then reinterpreted those UTF-8 bytes as Latin-1/Windows-1252,
// producing exactly the "Ã¢Â€Â”" mangling reported. RFC 2047 encoded-word
// syntax (=?UTF-8?B?...?=) is the correct way to put non-ASCII text in a
// header; pure-ASCII subjects are left untouched (encoding them is legal
// but pointless noise).
const encodeMimeSubject = (subject: string): string => {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
};

// BUG FIX — outgoing owner emails had no display name on the From header at
// all (just the bare Gmail address), so recipients saw whatever profile name
// happens to be set on the connected Google account — which could be
// anything (a personal name, an old business name, etc.), not a name the
// customer recognizes. This used to hardcode the PLATFORM brand ("Crew
// Boss") here regardless of Settings → Company — a customer receiving a
// review request or invoice email from "CRM Starter" instead of the actual
// business they hired (e.g. "Your Company") read as broken/
// confusing, and the owner asked for this fixed. Callers now pass the
// owner's real companyName; this constant is only the fallback for a
// deployment that hasn't set one yet.
export const EMAIL_FROM_NAME = "CRM Starter";

// Builds a proper `"Name" <email>` header; the quoted-string name is
// RFC-2047-encoded the same way Subject is if it contains non-ASCII, and any
// literal `"` in the name is stripped since it would otherwise terminate the
// quoted-string early.
const formatFromHeader = (email: string, name?: string): string => {
  if (!name) return email;
  const safeName = name.replace(/"/g, "");
  const encoded = /^[\x00-\x7F]*$/.test(safeName) ? safeName : encodeMimeSubject(safeName); // eslint-disable-line no-control-regex
  return `"${encoded}" <${email}>`;
};

const sendGmailRaw = async (googleProviderToken: string, fromEmail: string, to: string, subject: string, html: string, fromName?: string): Promise<Response> => {
  const mime = [
    `From: ${formatFromHeader(fromEmail, fromName)}`,
    `To: ${to}`,
    `Subject: ${encodeMimeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    html,
  ].join("\r\n");

  // base64url encode
  const raw = btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return fetch(
    "https://www.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${googleProviderToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );
};

// Google access tokens last ~1hr, and this is called from many places across
// the app (not just the Google Workspace settings page), so a stale token is
// the normal case, not the exception. On a 401, ask Supabase to refresh the
// session — Supabase holds Google's refresh token server-side from the
// initial OAuth link, so this works without needing our own backend or the
// OAuth client secret — and retry once before giving up. Without this, every
// Gmail send after the first hour would silently fail and fall through to
// Resend, which is exactly the "everything uses Resend" bug this fixes.
// ITEM 10 — a Google access token can only be refreshed with the client_id
// + client_secret it was issued under (this project's Google Sign-In runs
// through Supabase's own registered OAuth client), so the secret must live
// server-side. functions/api/google-refresh.ts holds it as a Cloudflare env
// var and does the actual token exchange; this just calls that same-origin
// endpoint. Returns null (never throws) so callers can fall back cleanly.
// FIX 2 (Gmail infinite-retry loop) — functions/api/google-refresh.ts returns a
// specific, recognizable error ("...missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET
// env vars...") when the Cloudflare Pages env vars simply haven't been set yet.
// That's a permanent config gap, not a transient failure — until the owner adds
// those vars in the Cloudflare dashboard, EVERY call here will fail the exact
// same way. Tagging that case as `configMissing` lets callers (sendViaGmail
// below) stop treating it like an ordinary retryable 401 and fail fast with a
// clear message instead of falling through to the much slower/riskier
// supabase.auth.refreshSession() fallback on every single send.
export const refreshGoogleAccessToken = async (
  refreshToken: string,
  backendUrl?: string
): Promise<{ token: string; expiresAt: number; configMissing: boolean } | null> => {
  const endpoint = backendUrl ? `${backendUrl}/google/refresh` : "/api/google-refresh";
  try {
    const res = await withTimeout(fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }), 8000, "Google token refresh");
    const data = await res.json().catch(() => ({} as any));
    if (!res.ok || !data?.access_token) {
      const errMsg = String(data?.error || res.status);
      const configMissing = /GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET/i.test(errMsg);
      console.warn("[GoogleToken] refresh failed:", errMsg, configMissing ? "— Cloudflare env vars not set" : "");
      return configMissing ? { token: "", expiresAt: 0, configMissing: true } : null;
    }
    return { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3300) * 1000, configMissing: false };
  } catch (e: any) {
    console.warn("[GoogleToken] refresh threw:", e?.message);
    return null;
  }
};

// GoogleConnect — reusable owner-token resolver for anything that isn't
// Gmail (Calendar create/update/delete, cross-checking the owner's real
// Google Calendar). JobsPage.tsx's job→Calendar sync and AlfredPage.tsx's
// create_calendar_event tool were BOTH silently dead this whole time because
// they read `settings.googleToken` — a field NOTHING in this app ever
// writes (see InboxPage.tsx's own version of this same bug, fixed earlier).
// The one real field is `googleProviderToken` (in React state) or
// localStorage via getStoredGoogleConnection() (the more current source —
// see sendOwnerGmailOnly above). This mirrors that same localStorage-first,
// proactive-refresh chain, just returning a plain access token string
// instead of sending an email, so any Calendar caller can share it.
export const getFreshOwnerGoogleToken = async (
  settings: { googleProviderToken?: string; googleRefreshToken?: string; googleTokenExpiresAt?: number; googleBackendUrl?: string },
  onTokenRefreshed?: (token: string, expiresAt: number) => void
): Promise<string | null> => {
  const stored = getStoredGoogleConnection();
  let token = stored?.token || settings.googleProviderToken || "";
  let refreshToken = stored?.refreshToken || settings.googleRefreshToken;
  let expiresAt = stored?.expiresAt || settings.googleTokenExpiresAt;

  if (!token && !refreshToken) {
    const cloud = await fetchOwnerGoogleToken();
    if (cloud?.token) { token = cloud.token; refreshToken = cloud.refreshToken; expiresAt = cloud.expiresAt; }
  }
  if (refreshToken && (!expiresAt || Date.now() > expiresAt - 2 * 60 * 1000)) {
    const refreshed = await refreshGoogleAccessToken(refreshToken, settings.googleBackendUrl);
    if (refreshed?.token) {
      token = refreshed.token;
      onTokenRefreshed?.(refreshed.token, refreshed.expiresAt);
    }
  }
  return token || null;
};

// FIX 1 (Gmail infinite-retry loop) — every Gmail 401 used to re-run the full
// refresh chain (Cloudflare token exchange, then a supabase.auth.refreshSession()
// fallback) with no memory of past failures. When the Cloudflare Function is
// missing its env vars (see refreshGoogleAccessToken above), that chain is
// guaranteed to fail every time — so every OTW/Running Late/invoice send
// repeated the identical doomed "[SendInvoice] Gmail 401" → "[GoogleToken]
// refresh failed" sequence back-to-back, and each one also called
// supabase.auth.refreshSession() — which operates on whichever session (owner
// OR employee) happened to trigger the send, and is a likely contributor to
// destabilizing an active employee session under repeated concurrent calls.
// After 2 consecutive failures this circuit opens and further sends fail
// immediately with a clear message instead of retrying — it self-resets after
// a cooldown so a later fix (e.g. reconnecting Google) can succeed again
// without requiring a full page reload.
let gmailRefreshFailureStreak = 0;
let gmailCircuitOpenedAt = 0;
// FIX 3 — gmailCircuitOpen() is checked on every single send attempt while
// the circuit is open (could be dozens across a busy shift), but the
// "circuit open" state itself only actually CHANGES twice: the moment it
// opens, and the moment the cooldown lets it reset. Log only on those two
// transitions instead of every check, or a stuck Gmail connection floods the
// console with the identical warning on every OTW/invoice/reminder attempt.
let gmailCircuitWarned = false;
const GMAIL_REFRESH_MAX_ATTEMPTS = 2;
const GMAIL_CIRCUIT_COOLDOWN_MS = 10 * 60 * 1000;
const gmailCircuitOpen = (): boolean => {
  if (gmailRefreshFailureStreak < GMAIL_REFRESH_MAX_ATTEMPTS) return false;
  if (Date.now() - gmailCircuitOpenedAt > GMAIL_CIRCUIT_COOLDOWN_MS) {
    console.log("[GoogleToken] Gmail refresh circuit reset — cooldown elapsed, allowing retries again");
    gmailRefreshFailureStreak = 0; // cooldown elapsed — allow one more attempt
    gmailCircuitWarned = false;
    return false;
  }
  return true;
};
const GMAIL_UNAVAILABLE_MSG = "Gmail unavailable — check Google connection in Settings.";

export const sendViaGmail = async (
  googleProviderToken: string,
  fromEmail: string,
  to: string,
  subject: string,
  html: string,
  opts?: { refreshToken?: string; tokenExpiresAt?: number; backendUrl?: string; onTokenRefreshed?: (token: string, expiresAt: number) => void; fromName?: string }
): Promise<void> => {
  if (isTestModeBlockedEmail(to)) {
    console.log("[TestMode] Email to test client blocked — would have sent:", subject);
    return;
  }
  let activeToken = googleProviderToken;

  // ITEM 10 — proactive refresh: if we know this token is already past (or
  // near) its ~1hr expiry, refresh BEFORE wasting a call that's certain to
  // 401. This is what actually stops "token keeps expiring" from being user
  // visible at all, rather than just reacting faster to the 401 after it
  // already happened.
  if (opts?.refreshToken && opts.tokenExpiresAt && Date.now() > opts.tokenExpiresAt - 2 * 60 * 1000 && !gmailCircuitOpen()) {
    const refreshed = await refreshGoogleAccessToken(opts.refreshToken, opts.backendUrl);
    if (refreshed?.token) {
      activeToken = refreshed.token;
      opts.onTokenRefreshed?.(refreshed.token, refreshed.expiresAt);
    }
  }

  let res = await sendGmailRaw(activeToken, fromEmail, to, subject, html, opts?.fromName);
  if (res.status === 401) {
    // FIX 1 — circuit breaker: after 2 consecutive failures, stop attempting
    // the refresh chain entirely and fail fast instead of repeating the same
    // doomed 401 → refresh-fail → Supabase-session-refresh sequence forever.
    if (gmailCircuitOpen()) {
      if (!gmailCircuitWarned) {
        gmailCircuitWarned = true;
        console.warn("[SendInvoice] Gmail refresh circuit open (failed", gmailRefreshFailureStreak, "times in a row) — further sends fail fast until", new Date(gmailCircuitOpenedAt + GMAIL_CIRCUIT_COOLDOWN_MS).toLocaleTimeString(), "(not logged again until then)");
      }
      throw new Error(GMAIL_UNAVAILABLE_MSG);
    }
    console.warn("[SendInvoice] Gmail 401 — attempting real Google token refresh");
    let freshToken: string | undefined;
    let configMissing = false;
    // ITEM 10 — the REAL fix: redeem the stored Google refresh_token via
    // Google's own token endpoint (through our server-side proxy). This
    // actually works, unlike supabase.auth.refreshSession() below, which
    // only refreshes Supabase's own session JWT — it does not re-authenticate
    // with Google, so the "fresh" provider_token it sometimes returns is
    // usually just the same stale one, or null.
    if (opts?.refreshToken) {
      const refreshed = await refreshGoogleAccessToken(opts.refreshToken, opts.backendUrl);
      if (refreshed?.token) {
        freshToken = refreshed.token;
        opts.onTokenRefreshed?.(refreshed.token, refreshed.expiresAt);
      } else if (refreshed?.configMissing) {
        configMissing = true;
      }
    }
    // FIX 2 — the Cloudflare Function reported its own config is incomplete
    // (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set). That's not recoverable
    // by retrying — skip the Supabase-session fallback below entirely (it was
    // never going to produce a real Google token anyway) and fail fast with a
    // clear, actionable message.
    if (!freshToken && configMissing) {
      gmailRefreshFailureStreak++;
      if (gmailRefreshFailureStreak >= GMAIL_REFRESH_MAX_ATTEMPTS) gmailCircuitOpenedAt = Date.now();
      throw new Error(GMAIL_UNAVAILABLE_MSG);
    }
    // BUG FIX (Google accounts mixed up, round 2) — this used to fall back to
    // supabase.auth.refreshSession()/getSession() here, which reads whichever
    // Supabase Auth session is CURRENTLY ACTIVE in this browser tab. sendViaGmail
    // is called for OWNER sends (sendOwnerGmailOnly/sendEmail) from contexts
    // where an EMPLOYEE could be the actual active session in the same
    // browser/device (a shared shop computer, or the owner testing the
    // employee portal without signing out first) — that ambient session has
    // no relation to the specific googleProviderToken this function was
    // explicitly called with. Using it here meant an owner-triggered send
    // could silently go out from — and then (via onTokenRefreshed below)
    // permanently persist — an employee's Gmail account into the owner's
    // slot. This function now only ever trusts the refresh_token exchange
    // above, tied to the specific account it was called for; if that account
    // has no refresh_token on file or the exchange fails, it fails fast with
    // a clear message instead of silently borrowing ambient browser state.
    if (!freshToken) {
      console.warn("[GoogleToken] no refresh_token available or refresh failed for this account — reconnect required (no longer falling back to the ambient browser session, see BUG FIX comment above)");
    }
    if (freshToken) {
      res = await sendGmailRaw(freshToken, fromEmail, to, subject, html, opts?.fromName);
    }
    // ITEM 10 — only surface "reconnect" once BOTH the real refresh_token
    // exchange AND the Supabase-session fallback have failed to produce a
    // token that actually works against Gmail.
    if (res.status === 401) {
      gmailRefreshFailureStreak++;
      if (gmailRefreshFailureStreak >= GMAIL_REFRESH_MAX_ATTEMPTS) {
        gmailCircuitOpenedAt = Date.now();
        throw new Error(GMAIL_UNAVAILABLE_MSG);
      }
      throw new Error("Google token expired — reconnect in Settings → Integrations.");
    }
    gmailRefreshFailureStreak = 0;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Gmail API error ${res.status}`);
  }
};

// Gmail-only send — no Resend fallback, ever. Used by flows that must never
// silently default to Resend (running late, on-my-way, in-portal invoice send):
// throws a clear, actionable error instead of falling through to a provider
// the owner never configured.
export const sendOwnerGmailOnly = async (
  settings: { googleConnected?: boolean; googleProviderToken?: string; googleEmail?: string; googleRefreshToken?: string; googleTokenExpiresAt?: number; googleBackendUrl?: string },
  to: string,
  subject: string,
  html: string
): Promise<void> => {
  // GoogleConnect ask #3 — settings.googleProviderToken is fed by React
  // state (App.tsx's applyGoogleIdentity / the app_settings cross-device
  // sync), which several rounds of testing showed can lag or race behind the
  // actual connection. localStorage (written synchronously the instant the
  // OAuth hash is seen, see lib/supabase.ts) is the authoritative record for
  // the ONE browser that ran the OAuth flow — check it first.
  const stored = getStoredGoogleConnection();
  let providerToken = stored?.token;
  let email = stored?.email;
  let refreshToken = stored?.refreshToken;
  let tokenExpiresAt = stored?.expiresAt;
  let tokenSource = stored?.token ? "localStorage" : "none";

  // CROSS-DEVICE — an employee's own phone/laptop never ran the owner's
  // OAuth flow, so it has no localStorage entry at all; this is the field
  // portal's OTW/Running Late/invoice-send path calling this function, so
  // that's the common case, not an edge case. Fetch the live token from the
  // shared app_settings row before falling back to whatever (possibly stale,
  // possibly never-populated) value happened to be on the `settings` prop.
  if (!providerToken) {
    const cloud = await fetchOwnerGoogleToken();
    if (cloud?.token) {
      providerToken = cloud.token;
      email = cloud.email;
      refreshToken = cloud.refreshToken;
      tokenExpiresAt = cloud.expiresAt;
      tokenSource = "supabase (cross-device)";
    }
  }

  if (!providerToken && settings.googleProviderToken) {
    providerToken = settings.googleProviderToken;
    email = settings.googleEmail;
    refreshToken = settings.googleRefreshToken;
    tokenExpiresAt = settings.googleTokenExpiresAt;
    tokenSource = "settings (legacy fallback)";
  }

  console.log("[GoogleConnect] sendOwnerGmailOnly — token source:", tokenSource);
  // BUG FIX — this used to also require `email` (the From address) before
  // attempting a send, but `email` is decoded from the OAuth JWT and can be
  // legitimately absent (decode failure, or a device that only ever got the
  // token via the cross-device app_settings mirror, which historically
  // didn't always carry an email alongside it) even though `providerToken`
  // is genuinely valid — Settings/Workspace pages only check for a token,
  // so this stricter check made a "Connected" account still fail to send.
  // `fromEmail` is only used to build the MIME `From:` header — Gmail's
  // send API sends as the authenticated token's own account regardless of
  // what that header says, so a missing email is safe to fall back on.
  if (!providerToken) {
    throw new Error("Gmail not connected — connect Google in Settings → Integrations to send email.");
  }
  await sendViaGmail(providerToken, email || settings.googleEmail || "", to, subject, html, {
    refreshToken,
    tokenExpiresAt,
    backendUrl: settings.googleBackendUrl,
    // A 401 mid-send triggers an automatic refresh inside sendViaGmail —
    // persist that fresh token to localStorage AND the shared app_settings
    // row (see setStoredGoogleToken) so every device — not just this one —
    // has the current token for its next send.
    onTokenRefreshed: (token, expiresAt) => setStoredGoogleToken(token, expiresAt, email),
    fromName: (settings as any)?.companyName || EMAIL_FROM_NAME,
  });
};

// ─── Email via Gmail (no Resend fallback — removed entirely, FIX 9) ───────────
// This used to fall back to Resend when Gmail wasn't connected or failed.
// Every email in this app now goes through the owner's connected Gmail
// account, full stop — this is functionally identical to sendOwnerGmailOnly,
// kept as a separate export only because many call sites already use the
// (to, subject, body) positional/object-args calling convention this
// function supports.
export const sendEmail = async (
  settings: EmailSettings & { googleConnected?: boolean; googleProviderToken?: string; googleEmail?: string; ownerName?: string; myEmail?: string; googleRefreshToken?: string; googleTokenExpiresAt?: number; googleBackendUrl?: string },
  toOrOpts: string | { to: string; subject: string; body: string; [key: string]: any },
  subject?: string,
  html?: string
): Promise<void> => {
  // Support both positional args and object form
  let to: string;
  let subj: string;
  let body: string;
  if (typeof toOrOpts === "object") {
    to = toOrOpts.to;
    subj = toOrOpts.subject;
    body = toOrOpts.body;
  } else {
    to = toOrOpts;
    subj = subject!;
    body = html!;
  }
  // GoogleConnect ask #3 — same localStorage → Supabase → settings fallback
  // chain as sendOwnerGmailOnly (see the comments there).
  const stored = getStoredGoogleConnection();
  let providerToken = stored?.token;
  let email = stored?.email;
  let refreshToken = stored?.refreshToken;
  let tokenExpiresAt = stored?.expiresAt;

  if (!providerToken) {
    const cloud = await fetchOwnerGoogleToken();
    if (cloud?.token) {
      providerToken = cloud.token;
      email = cloud.email;
      refreshToken = cloud.refreshToken;
      tokenExpiresAt = cloud.expiresAt;
    }
  }

  if (!providerToken && settings.googleProviderToken) {
    providerToken = settings.googleProviderToken;
    email = settings.googleEmail;
    refreshToken = settings.googleRefreshToken;
    tokenExpiresAt = settings.googleTokenExpiresAt;
  }

  // See the matching comment in sendOwnerGmailOnly above — email (the From
  // header) can legitimately be missing even with a fully valid token; only
  // the token itself is required to actually send.
  if (!providerToken) {
    throw new Error("Gmail not connected — connect Google in Settings → Integrations to send email.");
  }
  await sendViaGmail(providerToken, email || settings.googleEmail || "", to, subj, body, {
    refreshToken,
    tokenExpiresAt,
    backendUrl: settings.googleBackendUrl,
    onTokenRefreshed: (token, expiresAt) => setStoredGoogleToken(token, expiresAt, email),
    fromName: (settings as any)?.companyName || EMAIL_FROM_NAME,
  });
};

// ─── Branded HTML email shell ──────────────────────────────────────────────────
// One shared shell applied to every outgoing email (job assignments, requests,
// reminders, daily briefings, tomorrow's jobs, invoices, OTW/Running Late,
// end-of-day summaries, payment receipts) so they all look like real,
// mobile-friendly transactional email instead of plain text — branded header
// (logo if the owner has uploaded one in Settings → Company Profile, brand
// colors if set), readable typography, optional action button, and a real
// footer (company phone/address, unsubscribe link when a customer email is
// known). Wrapped in an outer table for consistent rendering across email
// clients (Gmail/Outlook strip <style> blocks, so all styling here is inline).
//
// ISSUE 2 (round 4) — first argument used to be a bare `companyName: string`,
// so this shell could only ever render the hardcoded red gradient with no
// logo/company colors, even on deployments that had already set a logo and
// brand colors in Settings. Accepts either a plain string (every existing
// call site keeps compiling and rendering exactly as before, just still
// without the extra branding) OR a settings-shaped object, so upgrading a
// call site to real branding is a one-line change (pass `settings` instead
// of `settings.companyName`) rather than a signature-breaking rewrite.
interface EmailBrand {
  companyName?: string;
  logoUrl?: string;
  brandColor?: string;
  brandAccent?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyEmail?: string;
}
export const emailShell = (brandOrName: string | EmailBrand, title: string, bodyHtml: string, unsubscribeEmail?: string): string => {
  const b: EmailBrand = typeof brandOrName === "string" ? { companyName: brandOrName } : (brandOrName || {});
  const companyName = b.companyName || "CRM Starter";
  const brandColor = b.brandColor || "#ffffff";
  const headerInner = b.logoUrl
    ? `<img src="${b.logoUrl}" alt="${companyName}" style="max-height:44px;max-width:220px;display:inline-block" />`
    : `<div style="font-size:21px;font-weight:800;letter-spacing:-0.02em;color:#fff">${companyName}</div>`;
  const footerContact = [b.companyPhone, b.companyAddress].filter(Boolean).join(" · ");
  const unsubHref = unsubscribeEmail ? `mailto:${unsubscribeEmail}?subject=${encodeURIComponent("Unsubscribe")}` : null;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#0a0a0a;color:#fff;border-radius:16px;overflow:hidden">
      <tr><td bgcolor="${brandColor}" style="background-color:${brandColor};padding:28px 24px;text-align:center">
        ${headerInner}
        <div style="font-size:13px;margin-top:4px;color:#ffffff">${title}</div>
      </td></tr>
      <tr><td style="padding:28px 24px;background:#111;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85)">${bodyHtml}</td></tr>
      <tr><td style="padding:16px 24px;text-align:center;font-size:11px;color:rgba(255,255,255,0.3);background:#0a0a0a">
        ${footerContact ? `<div style="margin-bottom:6px">${footerContact}</div>` : ""}
        Sent automatically by ${companyName}'s CRM Starter system.
        ${unsubHref ? `<div style="margin-top:6px"><a href="${unsubHref}" style="color:rgba(255,255,255,0.35);text-decoration:underline">Unsubscribe</a></div>` : ""}
      </td></tr>
    </table>
  </td></tr>
</table>`;
};

// A pill-style call-to-action button, used for "Open the crew portal" / "View
// estimate" / "Confirm" links so emails read as actionable, not just informative.
export const emailButton = (label: string, href: string): string => `
  <div style="text-align:center;margin:22px 0 4px">
    <a href="${href}" style="display:inline-block;background:#ffffff;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px">${label}</a>
  </div>`;

const jobCardHtml = (j: any, custName: string): string => `
  <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;margin-bottom:10px">
    <div style="font-weight:700;font-size:14px">${j.address || ""}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px">${j.scheduledTime ? j.scheduledTime + " · " : ""}${custName}</div>
    ${j.notes ? `<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px;font-style:italic">"${j.notes}"</div>` : ""}
  </div>`;

export const buildTomorrowJobsEmailHtml = (brand: string | Parameters<typeof emailShell>[0], empFirstName: string, jobsList: Array<{ job: any; custName: string }>): string => {
  const body = `<p style="font-size:14px;color:rgba(255,255,255,0.8)">Hi ${empFirstName}, here's your schedule for tomorrow:</p>` +
    jobsList.map(({ job, custName }) => jobCardHtml(job, custName)).join("") +
    `<p style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:16px">Open the crew portal for full details, directions, and checklists.</p>`;
  return emailShell(brand, "Tomorrow's Jobs", body);
};

// FEATURE — weekly schedule email: "employees should see who else is
// working with them on each job. Weekly email with schedule, crew, and
// 'View your schedule' button." crewNames is pre-resolved by the caller
// (App.tsx has the full employees list; this file doesn't) so this stays a
// pure HTML builder like every other email-template function here.
const weeklyJobCardHtml = (j: any, custName: string, crewNames: string[]): string => `
  <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px;margin-bottom:10px">
    <div style="font-weight:700;font-size:14px">${j.scheduledDate || ""}${j.scheduledTime ? " · " + j.scheduledTime : ""}</div>
    <div style="font-size:13px;margin-top:2px">${j.address || ""}</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px">${custName}</div>
    ${crewNames.length > 0 ? `<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-top:6px">👥 Working with: ${crewNames.join(", ")}</div>` : ""}
  </div>`;

export const buildWeeklyScheduleEmailHtml = (
  brand: string | Parameters<typeof emailShell>[0],
  empFirstName: string,
  jobsList: Array<{ job: any; custName: string; crewNames: string[] }>,
  portalUrl: string
): string => {
  const body = `<p style="font-size:14px;color:rgba(255,255,255,0.8)">Hi ${empFirstName}, here's your schedule for the week ahead:</p>` +
    jobsList.map(({ job, custName, crewNames }) => weeklyJobCardHtml(job, custName, crewNames)).join("") +
    emailButton("View Your Schedule", portalUrl);
  return emailShell(brand, "Your Week Ahead", body);
};

// BUG FIX — the owner asked for "more information at the end of the day":
// total revenue AND profit (not just revenue), a full per-job breakdown, and
// clickable action buttons — this used to be 4 flat numbers with nothing to
// act on or drill into.
export const buildDailyBriefingEmailHtml = (
  brand: string | Parameters<typeof emailShell>[0],
  stats: { completed: number; total: number; revenue: number; profit: number; late: number; issues: number },
  jobRows: Array<{ customerName: string; address?: string; amount: number; status: string }> = [],
  actionButtons: Array<{ label: string; href: string }> = []
): string => {
  const margin = stats.revenue > 0 ? Math.round((stats.profit / stats.revenue) * 100) : 0;
  const rowsHtml = jobRows.length
    ? jobRows.map(j => `<div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px">
        <span>${j.customerName}${j.address ? ` <span style="color:rgba(255,255,255,0.4)">· ${j.address}</span>` : ""}</span>
        <span style="white-space:nowrap;color:${j.status === "completed" ? "#4ade80" : j.status === "cancelled" ? "rgba(255,255,255,0.4)" : "#facc15"}">${j.status.replace("_", " ")}${j.status === "completed" ? ` · $${j.amount.toLocaleString()}` : ""}</span>
      </div>`).join("")
    : `<p style="font-size:12px;color:rgba(255,255,255,0.4)">No jobs scheduled today.</p>`;
  const buttonsHtml = actionButtons.map(b => emailButton(b.label, b.href)).join("");
  const body = `
    <p style="font-size:14px;color:rgba(255,255,255,0.8)">Here's how today went:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:10px">
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Jobs completed</td><td style="text-align:right;font-weight:700;font-size:13px">${stats.completed} / ${stats.total}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Revenue today</td><td style="text-align:right;font-weight:700;font-size:13px;color:#4ade80">$${stats.revenue.toLocaleString()}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Profit today</td><td style="text-align:right;font-weight:700;font-size:13px;color:${stats.profit >= 0 ? "#4ade80" : "#d4d4d4"}">$${stats.profit.toLocaleString()} (${margin}% margin)</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Late arrivals</td><td style="text-align:right;font-weight:700;font-size:13px;color:${stats.late > 0 ? "#facc15" : "#fff"}">${stats.late}</td></tr>
      <tr><td style="padding:8px 0;color:rgba(255,255,255,0.5);font-size:13px">Field notes/issues</td><td style="text-align:right;font-weight:700;font-size:13px;color:${stats.issues > 0 ? "#fb923c" : "#fff"}">${stats.issues}</td></tr>
    </table>
    <h3 style="margin:20px 0 8px;font-size:14px;color:rgba(255,255,255,0.9)">Today's jobs (${stats.total})</h3>
    ${rowsHtml}
    ${buttonsHtml}`;
  return emailShell(brand, "Daily Briefing", body);
};

// GUARANTEED weekly owner digest (see App.tsx's checkAndSendWeeklyDigest) —
// goal progress + overdue invoices + upcoming jobs in one email, not routed
// through the user-editable Automations list (an owner could delete/disable
// that automation and lose this without realizing; this fires on its own
// timer regardless, same opt-out-not-opt-in pattern as the daily briefing).
export const buildWeeklyOwnerDigestEmailHtml = (
  brand: string | Parameters<typeof emailShell>[0],
  data: {
    goals: Array<{ label: string; progress: number; target: number }>;
    overdueInvoices: Array<{ customerName?: string; total: number; daysOverdue: number }>;
    upcomingJobs: Array<{ customerName?: string; scheduledDate?: string; address?: string }>;
    revenueThisWeek: number;
    jobsCompletedThisWeek: number;
  }
): string => {
  const goalsHtml = data.goals.length
    ? data.goals.map(g => {
        const pct = g.target > 0 ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0;
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:4px"><span>${g.label}</span><span>${pct}%</span></div>
          <div style="height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:#ffffff"></div></div>
        </div>`;
      }).join("")
    : `<p style="font-size:12px;color:rgba(255,255,255,0.4)">No active goals set.</p>`;

  const overdueHtml = data.overdueInvoices.length
    ? data.overdueInvoices.slice(0, 8).map(i => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px"><span>${i.customerName || "Customer"}</span><span style="color:#fb923c">$${i.total.toLocaleString()} · ${i.daysOverdue}d</span></div>`).join("")
    : `<p style="font-size:12px;color:rgba(255,255,255,0.4)">Nothing overdue — nice work.</p>`;

  const upcomingHtml = data.upcomingJobs.length
    ? data.upcomingJobs.slice(0, 8).map(j => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:13px"><span>${j.customerName || "Job"}</span><span style="color:rgba(255,255,255,0.5)">${j.scheduledDate || ""}</span></div>`).join("")
    : `<p style="font-size:12px;color:rgba(255,255,255,0.4)">Nothing scheduled yet.</p>`;

  const body = `
    <p style="font-size:14px;color:rgba(255,255,255,0.8)">Your week at a glance:</p>
    <table style="width:100%;border-collapse:collapse;margin:10px 0 20px">
      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.5);font-size:13px">Revenue this week</td><td style="text-align:right;font-weight:700;font-size:13px;color:#4ade80">$${data.revenueThisWeek.toLocaleString()}</td></tr>
      <tr><td style="padding:6px 0;color:rgba(255,255,255,0.5);font-size:13px">Jobs completed</td><td style="text-align:right;font-weight:700;font-size:13px">${data.jobsCompletedThisWeek}</td></tr>
    </table>
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.4);margin-bottom:8px">Goal Progress</div>
    ${goalsHtml}
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.4);margin:20px 0 8px">Overdue Invoices${data.overdueInvoices.length ? ` (${data.overdueInvoices.length})` : ""}</div>
    ${overdueHtml}
    <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:rgba(255,255,255,0.4);margin:20px 0 8px">Upcoming Jobs</div>
    ${upcomingHtml}`;
  return emailShell(brand, "Your Weekly Rundown", body);
};
