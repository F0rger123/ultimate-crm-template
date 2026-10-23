// AUDIT 6 — same CORS problem as twilio-send.ts, but for polling inbound
// SMS into the owner's Inbox (InboxPage's pollTwilioIncoming). Credentials
// are sent in the POST body rather than a query string so they don't end up
// logged in any CDN/proxy access log.
import { getOwnerSecrets } from "./_lib/ownerSecrets";

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    let { sid, token, since, ownerId } = await context.request.json() as {
      sid?: string; token?: string; since?: string; ownerId?: string;
    };
    // SECURITY FIX — resolved server-side from owner_secrets when ownerId is
    // given, same as twilio-send.ts (see migration 0085's comment).
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (ownerId && serviceRoleKey) {
      const secrets = await getOwnerSecrets(ownerId, serviceRoleKey);
      if (secrets?.twilioAuthToken) { sid = secrets.twilioAccountSid || sid; token = secrets.twilioAuthToken; }
    }
    if (!sid || !token) {
      return new Response(JSON.stringify({ error: "Missing sid/token" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    // FEATURE 7 (mobile round 7) — Twilio's Messages List Resource only
    // supports DateSent, DateSent<, and DateSent> as filter params; DateSent>=
    // isn't a real Twilio operator (unrecognized query params are silently
    // ignored), so this "since" filter never actually narrowed the request —
    // every poll re-fetched the same last-50 messages regardless.
    const sinceParam = since ? `&DateSent>${encodeURIComponent(since)}` : "";
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json?Direction=inbound&PageSize=50${sinceParam}`;
    const twilioRes = await fetch(url, {
      headers: { Authorization: `Basic ${btoa(`${sid}:${token}`)}` },
    });
    if (!twilioRes.ok) {
      const err = await twilioRes.json().catch(() => ({} as any));
      return new Response(JSON.stringify({ error: err?.message || `Twilio error ${twilioRes.status}`, messages: [] }), {
        status: twilioRes.status, headers: { "Content-Type": "application/json" },
      });
    }
    const data = await twilioRes.json() as { messages?: any[] };
    // BLOCKER — Twilio's raw Messages resource uses snake_case (date_sent),
    // but InboxPage.tsx and the TwilioMessage type (lib/messaging.ts) read
    // msg.dateSent (camelCase). Returning the raw objects unmapped meant
    // dateSent was always undefined, so every incoming text silently fell
    // back to Date.now() as its timestamp instead of when it was actually
    // sent — messages could show out of order in a burst, and "since" the
    // client sends back on the next poll would be based on the wrong time.
    const messages = (data.messages ?? []).map((m: any) => ({
      sid: m.sid, from: m.from, body: m.body, dateSent: m.date_sent, direction: m.direction,
    }));
    return new Response(JSON.stringify({ messages }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error", messages: [] }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
