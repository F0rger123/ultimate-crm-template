// AUDIT 6 — Cloudflare Pages Function, auto-deployed from this /functions
// directory (no wrangler.toml needed, per Cloudflare Pages convention).
//
// Twilio's REST API never returns Access-Control-Allow-Origin headers, so a
// browser fetch() straight to api.twilio.com is rejected by CORS before the
// request even completes — no matter how correct the SID/Token/From number
// are. lib/messaging.ts's twilioSend() used to do exactly that as its
// fallback whenever no `twilioBackendUrl` was configured, which was always,
// since there was never even a Settings field to set one. That made every
// SMS send in the app (OTW, Running Late, invoice texts, campaigns,
// reviews, automations, Alfred, promotions...) silently fail. This function
// runs server-side (no CORS restriction applies to it) and same-origin (no
// CORS restriction applies to calling IT from the browser either), so it
// proxies the real Twilio call through.
import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";
import { SUPABASE_URL } from "./_lib/env";

const normalizePhoneDigits = (p?: string | null): string => {
  const d = (p || "").replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    let { sid, token, to, from, body, ownerId } = await context.request.json() as {
      sid?: string; token?: string; to?: string; from?: string; body?: string; ownerId?: string;
    };
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;

    // SECURITY FIX (audit finding — CRITICAL) — this endpoint had NO auth
    // check at all: it accepted any `ownerId` in the request body and used
    // it to resolve that business's real Twilio credentials server-side,
    // then sent the SMS. `ownerId` is a UUID but not a secret — several
    // public, unauthenticated endpoints (e.g. get_referral_customer,
    // get_estimate) return it. Anyone who obtained a business's owner_id
    // could send arbitrary SMS through their real Twilio number/reputation
    // to any phone, at their expense. Now requires a real session and
    // ALWAYS uses the owner_id resolved from that session — the
    // client-supplied ownerId in the body is ignored entirely.
    const authHeader = context.request.headers.get("Authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    const resolvedOwnerId = await resolveCallerOwnerId(accessToken);
    if (!resolvedOwnerId) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }
    ownerId = resolvedOwnerId;

    // SECURITY FIX — sid/token used to always come straight from the
    // client's own request body, meaning the raw Twilio auth token had to
    // live in browser-readable state (app_settings.data) for every send to
    // work — see migration 0085's comment for the full story. Now resolved
    // SERVER-SIDE from owner_secrets whenever ownerId is given (every real
    // call site in the app does — see setCurrentOwnerIdForSms in
    // messaging.ts), overriding anything the client claims. The client-
    // supplied sid/token/from fallback only remains for a caller that
    // somehow has no ownerId at all, so a send never breaks outright.
    if (ownerId && serviceRoleKey) {
      const secrets = await getOwnerSecrets(ownerId, serviceRoleKey);
      if (secrets?.twilioAuthToken) {
        sid = secrets.twilioAccountSid || sid;
        token = secrets.twilioAuthToken;
        from = secrets.twilioFromNumber || from;
      }
    }
    if (!sid || !token || !to || !from || !body) {
      return new Response(JSON.stringify({ error: "Missing sid/token/to/from/body" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }

    // SECURITY FIX (found via audit) — this proxy used to forward straight
    // to Twilio with zero opt-out check of its own, trusting lib/messaging.
    // ts's twilioSend() (browser-side) to be the only thing that ever
    // enforces STOP. Re-verified here server-side whenever the caller
    // supplies ownerId (every real call site in the app now does — see
    // setCurrentOwnerIdForSms in messaging.ts); if it's missing (e.g. an
    // older/custom caller), this falls back to not blocking, same as
    // before, rather than breaking sends.
    if (ownerId && serviceRoleKey) {
      try {
        const toDigits = normalizePhoneDigits(to);
        const custRes = await fetch(
          `${SUPABASE_URL}/rest/v1/customers?owner_id=eq.${encodeURIComponent(ownerId)}&select=phone,smsOptOut&smsOptOut=eq.true`,
          { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
        );
        const optedOutRows = await custRes.json().catch(() => []);
        const isOptedOut = Array.isArray(optedOutRows) && optedOutRows.some((c: any) => normalizePhoneDigits(c.phone) === toDigits && toDigits);
        if (isOptedOut) {
          return new Response(JSON.stringify({ error: "This contact has opted out of text messages (replied STOP) — SMS blocked." }), {
            status: 403, headers: { "Content-Type": "application/json" },
          });
        }
      } catch (e: any) {
        console.warn("[Twilio Send] opt-out check failed, allowing send:", e?.message);
      }
    }

    const formData = new URLSearchParams({ To: to, From: from, Body: body });
    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });
    const data = await twilioRes.json().catch(() => ({} as any));
    if (!twilioRes.ok) {
      // ITEM 32 — a 404 here almost always means the value saved as the
      // Twilio Account SID isn't actually an Account SID ("AC...") — most
      // often an API Key SID ("SK...") or Messaging Service SID ("MG...")
      // pasted into the wrong Settings field. Same hint twilio-account-status
      // already gives on its own SID check, added here too since this is the
      // path a real SMS send (not just the "Check Status" button) hits.
      const hint = twilioRes.status === 404 && !sid.startsWith("AC")
        ? ` (this SID starts with "${sid.slice(0, 2)}", but a Twilio Account SID always starts with "AC" — check Settings → Integrations)`
        : "";
      return new Response(JSON.stringify({ error: (data?.message || `Twilio error ${twilioRes.status}`) + hint }), {
        status: twilioRes.status, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ success: true, sid: data?.sid }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
