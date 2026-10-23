// FEATURE — A2P 10DLC campaign compliance status check (Twilio's own term for
// what the owner called "ATP checking"). Same CORS-proxy pattern as
// twilio-send.ts (Twilio's REST API returns no CORS headers for a browser
// fetch) — this Cloudflare Pages Function runs server-side and same-origin,
// so it can reach Twilio's Messaging Compliance API and hand back a plain
// status the app can show/gate on. See lib/messaging.ts's checkA2pCampaignStatus.
//
// HONEST CAVEAT (audit) — the exact JSON shape of Twilio's list response for
// GET /Services/{sid}/Compliance/Usa2p has NOT been verified against a live
// Twilio account from here (no live credentials available in this
// environment). Twilio's list resources generally wrap results under a key
// matching the resource's snake_case name (e.g. "us_app_to_person") alongside
// a "meta" paging object, which may not match the "compliance" key this was
// originally written against. To make a wrong guess here fail SAFE rather
// than silently: this checks several plausible shapes (a wrapped array under
// a few likely keys, the bare response itself being an array, or a single
// campaign object at the top level) and both snake_case and camelCase field
// names. `raw` in the response is always the FULL, untouched Twilio payload
// (not just the parsed guess) specifically so that if `registered`/
// `campaignStatus` come back wrong the first time you click "Check Campaign
// Status" in Settings, the real shape is right there in the response to
// paste back for a one-line fix — rather than an opaque "didn't work."
import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    let { sid, token, messagingServiceSid, ownerId } = await context.request.json() as {
      sid?: string; token?: string; messagingServiceSid?: string; ownerId?: string;
    };
    // SECURITY FIX (audit finding — same class as twilio-account-status.ts)
    // — a client-supplied ownerId used to be enough to pull ANOTHER
    // business's real Twilio credentials with zero proof of ownership. Only
    // honored now when the caller has a real session resolving to that same
    // ownerId; sid/token passed directly (an owner testing unsaved
    // credentials) is unaffected — that path never touches owner_secrets.
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (ownerId && serviceRoleKey) {
      const authHeader = context.request.headers.get("Authorization") || "";
      const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      const resolvedOwnerId = await resolveCallerOwnerId(accessToken);
      if (!resolvedOwnerId || resolvedOwnerId !== ownerId) {
        return new Response(JSON.stringify({ error: "Not authenticated for this business." }), {
          status: 401, headers: { "Content-Type": "application/json" },
        });
      }
      const secrets = await getOwnerSecrets(ownerId, serviceRoleKey);
      if (secrets?.twilioAuthToken) {
        sid = secrets.twilioAccountSid || sid;
        token = secrets.twilioAuthToken;
        messagingServiceSid = secrets.twilioMessagingServiceSid || messagingServiceSid;
      }
    }
    if (!sid || !token || !messagingServiceSid) {
      return new Response(JSON.stringify({ error: "Missing sid/token/messagingServiceSid" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const twilioRes = await fetch(
      `https://messaging.twilio.com/v1/Services/${messagingServiceSid}/Compliance/Usa2p`,
      { headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` } }
    );
    const data = await twilioRes.json().catch(() => ({} as any));
    if (!twilioRes.ok) {
      return new Response(JSON.stringify({ error: data?.message || `Twilio error ${twilioRes.status}`, raw: data }), {
        status: twilioRes.status, headers: { "Content-Type": "application/json" },
      });
    }

    const arrayCandidates = [data?.compliance, data?.us_app_to_person, data?.usAppToPerson, Array.isArray(data) ? data : null];
    const list = arrayCandidates.find((c: any) => Array.isArray(c)) || [];
    // A Messaging Service normally has exactly one active A2P campaign once
    // registered — fall back to treating the whole payload as a single
    // campaign object if no array shape matched at all.
    const campaign = list[0] || (data?.campaign_status || data?.campaignStatus ? data : null);
    const status = campaign?.campaign_status ?? campaign?.campaignStatus ?? null;
    const id = campaign?.campaign_id ?? campaign?.campaignId ?? campaign?.sid ?? null;

    return new Response(JSON.stringify({
      registered: !!campaign,
      campaignStatus: status,
      campaignId: id,
      raw: data,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
