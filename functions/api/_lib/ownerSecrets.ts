import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";
// SECURITY FIX — shared resolver for owner_secrets (migration 0085), the
// service-role-only home for Twilio credentials, AI model API keys, and the
// Google OAuth refresh_token — moved out of app_settings.data specifically
// because every one of an owner's own employees could otherwise read them
// straight off the app_settings REST response (see migration 0085's own
// comment for the full story). Every server-side function that needs one of
// these secrets resolves it HERE, by owner_id, using the service-role key —
// never by trusting a value the client sent.


export type OwnerSecrets = {
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  twilioMessagingServiceSid?: string;
  googleRefreshToken?: string;
  modelKeys?: Record<string, string>;
};

export const getOwnerSecrets = async (ownerId: string, serviceRoleKey: string): Promise<OwnerSecrets | null> => {
  if (!ownerId || !serviceRoleKey) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/owner_secrets?owner_id=eq.${encodeURIComponent(ownerId)}&select=twilio_account_sid,twilio_auth_token,twilio_from_number,twilio_messaging_service_sid,google_refresh_token,model_keys`,
    { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
  );
  const rows = await res.json().catch(() => []);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  const trim = (v: any) => (typeof v === "string" ? v.trim() : "") || undefined;
  return {
    // Trimmed: a pasted value with a stray space or newline breaks every call.
    twilioAccountSid: trim(row.twilio_account_sid),
    twilioAuthToken: trim(row.twilio_auth_token),
    twilioFromNumber: trim(row.twilio_from_number),
    twilioMessagingServiceSid: trim(row.twilio_messaging_service_sid),
    googleRefreshToken: trim(row.google_refresh_token),
    modelKeys: row.model_keys && typeof row.model_keys === "object" ? Object.fromEntries(Object.entries(row.model_keys).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])) as Record<string, string> : {},
  };
};

// Resolves the authenticated caller's own owner_id from a Supabase access
// token — same current_owner_id() logic the DB itself uses, looked up
// through the employees table with the anon key + the caller's own JWT, so
// RLS on `employees` enforces "you can only ever resolve to your own
// tenant." Duplicated per-file in this codebase (see stripe-action.ts/
// square-action.ts) rather than a shared import, matching existing
// convention — kept here too so any new secrets-aware function can reuse it.
export const resolveCallerOwnerId = async (accessToken: string): Promise<string | null> => {
  if (!accessToken) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null) as any;
  const uid = user?.id;
  if (!uid) return null;
  const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?user_id=eq.${encodeURIComponent(uid)}&select=owner_id&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const empRows = await empRes.json().catch(() => []);
  return Array.isArray(empRows) && empRows[0]?.owner_id ? empRows[0].owner_id : uid;
};

// SECURITY — resolveCallerOwnerId alone only proves "this caller belongs to
// this tenant," which is enough for reading/writing that tenant's OWN
// business data (jobs, customers) but not nearly enough for secrets that
// tenant's own regular employees shouldn't be able to read OR overwrite
// (imagine a technician quietly repointing the business's Twilio number at
// their own account). This additionally checks the caller's own employees
// row has role "owner" or "manager" — the same trust tier SettingsModal.tsx
// already gates the Settings page itself on client-side; this is that same
// boundary enforced server-side, where it actually matters.
export const resolveCallerIsOwnerOrManager = async (accessToken: string): Promise<{ ownerId: string; role: string } | null> => {
  if (!accessToken) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json().catch(() => null) as any;
  const uid = user?.id;
  if (!uid) return null;
  const empRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?user_id=eq.${encodeURIComponent(uid)}&select=owner_id,role&limit=1`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  const empRows = await empRes.json().catch(() => []);
  const row = Array.isArray(empRows) ? empRows[0] : null;
  // No employees row at all (the owner's very first login, before their
  // self-assign row exists yet) still counts as the owner — their own uid
  // IS the tenant id in that case, same fallback current_owner_id() uses.
  if (!row) return { ownerId: uid, role: "owner" };
  const role = (row.role || "").toLowerCase();
  if (role !== "owner" && role !== "manager") return null;
  return { ownerId: row.owner_id || uid, role };
};
