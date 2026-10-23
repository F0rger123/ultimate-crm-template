// SECURITY FIX — owner-only save/status endpoint for owner_secrets
// (migration 0085): Twilio credentials, AI model API keys, and the Google
// OAuth refresh_token. See that migration's comment and
// _lib/ownerSecrets.ts's header comment for the full story — these used to
// live in app_settings.data, readable by every one of an owner's own
// employees. Mirrors stripe-action.ts's save_owner_keys/get_owner_keys_status
// shape exactly, with one addition: gated to resolveCallerIsOwnerOrManager
// (not just "resolves to this tenant"), since a regular employee should be
// able to neither READ nor WRITE these, unlike ordinary business data.

import { getOwnerSecrets, resolveCallerIsOwnerOrManager } from "./_lib/ownerSecrets";
import { SUPABASE_URL } from "./_lib/env";

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }, 500);
  }
  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;

    const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const caller = await resolveCallerIsOwnerOrManager(accessToken);
    if (!caller) return json({ error: "Not signed in, or your account doesn't have access to these settings." }, 401);

    if (action === "get_owner_secrets_status") {
      const s = await getOwnerSecrets(caller.ownerId, serviceRoleKey);
      const modelKeys = s?.modelKeys || {};
      return json({
        hasTwilioToken: !!s?.twilioAuthToken,
        twilioAccountSid: s?.twilioAccountSid || "",
        twilioFromNumber: s?.twilioFromNumber || "",
        twilioMessagingServiceSid: s?.twilioMessagingServiceSid || "",
        hasGoogleRefreshToken: !!s?.googleRefreshToken,
        modelKeysConfigured: Object.fromEntries(Object.keys(modelKeys).map(k => [k, !!modelKeys[k]])),
      });
    }

    if (action === "save_owner_secrets") {
      const {
        twilioAccountSid, twilioAuthToken, twilioFromNumber, twilioMessagingServiceSid,
        googleRefreshToken, modelKeyUpdates,
      } = body;
      const authHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
      const existing = await getOwnerSecrets(caller.ownerId, serviceRoleKey);
      const nextModelKeys = { ...(existing?.modelKeys || {}) };
      if (modelKeyUpdates && typeof modelKeyUpdates === "object") {
        for (const k of Object.keys(modelKeyUpdates)) {
          const v = modelKeyUpdates[k];
          if (v !== undefined && v !== "") nextModelKeys[k] = v; // blank = leave existing key untouched
        }
      }
      const patch: Record<string, any> = { owner_id: caller.ownerId, updated_at: new Date().toISOString(), model_keys: nextModelKeys };
      if (twilioAccountSid !== undefined) patch.twilio_account_sid = twilioAccountSid || null;
      if (twilioAuthToken !== undefined && twilioAuthToken !== "") patch.twilio_auth_token = twilioAuthToken; // blank = leave existing token untouched
      if (twilioFromNumber !== undefined) patch.twilio_from_number = twilioFromNumber || null;
      if (twilioMessagingServiceSid !== undefined) patch.twilio_messaging_service_sid = twilioMessagingServiceSid || null;
      if (googleRefreshToken !== undefined && googleRefreshToken !== "") patch.google_refresh_token = googleRefreshToken;
      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/owner_secrets`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!saveRes.ok) {
        const errText = await saveRes.text().catch(() => "");
        return json({ error: "Failed to save: " + errText }, 500);
      }
      return json({ success: true });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "owner-secrets-action error" }, 500);
  }
};
