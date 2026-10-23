import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./_lib/env";
// FEATURE (round 4) — a single persistent Alfred conversation for system
// notifications (estimate-viewed, and future similar events), instead of
// each event creating its own throwaway chat. The tricky part: the events
// that need to write here (customer viewing an estimate on the
// unauthenticated public estimate page, ClientPortal.tsx) have no owner
// Supabase session — nothing to scope an `owner_id` write to.
//
// MULTI-TENANT (Phase G) — under migration 0033_multitenant_owner_scoping.sql,
// `alfred_conversations` (like every other table) is now locked down to
// `owner_id = current_owner_id()`. The old "just grab the one app_settings
// row" trick both (a) can no longer even see a row via the anon key here,
// since there's no user session for PostgREST/RLS to resolve
// current_owner_id() through on a server-to-server call, and (b) was already
// an unsound assumption once more than one business exists.
//
// This function now resolves the correct owner_id one of three ways, in
// order of preference (safest/most-specific first):
//   1. An authenticated OWNER session (App.tsx's check-in/briefing effects,
//      which run inside the logged-in CRM) sends its Supabase access token
//      in the Authorization header. We resolve owner_id server-side from
//      THAT token via the employees table, the exact same
//      resolveCallerOwnerId pattern stripe-action.ts uses — the caller can
//      never spoof another business's owner_id this way, no matter what the
//      request body claims.
//   1b. If no Authorization header is present, App.tsx's own callers instead
//      pass `ownerId` directly (it's literally `crmUserId` — the owner's own
//      resolved auth uid, already the trusted scoping value App.tsx sends on
//      every direct owner_id-scoped write elsewhere in that same file, e.g.
//      its app_settings upsert). No worse a trust boundary than the rest of
//      this file already relies on for that caller; kept only as a fallback
//      to (1) so a future authenticated caller that DOES send a token gets
//      the stronger, server-verified resolution.
//   2. An UNAUTHENTICATED customer-facing page (ClientPortal.tsx,
//      ClientAuthPortal.tsx) has no session, but always has a concrete
//      row it's acting on — an estimate, job, or customer id already
//      loaded from Supabase. We look up THAT row's own owner_id
//      server-side (service role, bypasses RLS) — again, never trusted
//      from the client directly, only the id is, and the id only ever
//      unlocks the one business that row already belongs to.
//   3. Last resort, for callers with no session and no row to key off of:
//      loop over every app_settings row (service role) and post the
//      notification once per owner. Should be rare in practice — every
//      current caller in this codebase has an id to key off of (see 2).
//
// All of this requires SUPABASE_SERVICE_ROLE_KEY (Cloudflare Pages ->
// Settings -> Environment variables), same as invite-action.ts /
// stripe-action.ts's owner-key flows — without it we can no longer safely
// resolve or write anything here now that RLS is owner-scoped everywhere.


const NOTIFICATIONS_THREAD_ID = "system-notifications";
const MAX_MESSAGES = 200; // cap so this thread can't grow unbounded

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Same pattern as stripe-action.ts's resolveCallerOwnerId: resolves the
// authenticated caller's OWN owner_id from their Supabase access token via
// the employees table, using the anon key + the caller's own JWT so RLS on
// `employees` itself enforces "you can only ever resolve to your own
// tenant" — never trickable into returning someone else's owner_id.
const resolveCallerOwnerId = async (accessToken: string): Promise<string | null> => {
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

// Resolves owner_id from a row the (unauthenticated) caller is already
// legitimately acting on — an estimate/invoice, a job, or a customer — via
// the service role key (bypasses RLS, since there's no session to satisfy
// current_owner_id() with here). The client only ever supplies the row id,
// never the owner_id itself, so this can't be used to spoof another
// business's owner_id.
const resolveOwnerIdFromRow = async (
  table: "estimates" | "jobs" | "customers",
  id: string,
  serviceRoleKey: string
): Promise<string | null> => {
  if (!id) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=owner_id`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows[0]?.owner_id ? rows[0].owner_id : null;
};

// Appends `message` into owner `ownerId`'s persistent "Alfred Notifications"
// thread. Extracted so the last-resort "no id to key off of" path can loop
// this once per owner without duplicating the merge logic.
const postToOwner = async (ownerId: string, title: string | undefined, message: string, serviceRoleKey: string) => {
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/alfred_conversations?id=eq.${NOTIFICATIONS_THREAD_ID}&owner_id=eq.${encodeURIComponent(ownerId)}&select=messages`,
    { headers }
  );
  const existingRows = existingRes.ok ? await existingRes.json().catch(() => []) : [];
  const existing = Array.isArray(existingRows) ? existingRows[0] : null;

  // role: "alfred" (not the AlfredMessage type's "assistant") — matches
  // what AlfredPage.tsx actually writes/reads at runtime (isUser = m.role
  // === "user", everything else renders as Alfred's own bubble).
  const newMsg = { id: crypto.randomUUID(), role: "alfred", content: message.trim(), timestamp: Date.now() };
  const prevMessages = Array.isArray(existing?.messages) ? existing.messages : [];
  const messages = [...prevMessages, newMsg].slice(-MAX_MESSAGES);
  const nowIso = new Date().toISOString();

  if (existing) {
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/alfred_conversations?id=eq.${NOTIFICATIONS_THREAD_ID}&owner_id=eq.${encodeURIComponent(ownerId)}`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ messages, updated_at: nowIso }),
      }
    );
    if (!patchRes.ok) {
      const errText = await patchRes.text().catch(() => "");
      console.error("[AlfredNotify] PATCH failed for owner", ownerId, "(" + patchRes.status + "):", errText);
      return false;
    }
  } else {
    const postRes = await fetch(`${SUPABASE_URL}/rest/v1/alfred_conversations`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        id: NOTIFICATIONS_THREAD_ID, owner_id: ownerId, title: title || "Alfred Notifications",
        messages, created_at: nowIso, updated_at: nowIso,
      }),
    });
    if (!postRes.ok) {
      const errText = await postRes.text().catch(() => "");
      console.error("[AlfredNotify] POST failed for owner", ownerId, "(" + postRes.status + "):", errText);
      return false;
    }
  }
  console.log("[AlfredNotify] appended to system-notifications for owner", ownerId);
  return true;
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      return json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }, 500);
    }

    const { title, message, estimateId, jobId, customerId, ownerId: bodyOwnerId } = await context.request.json() as {
      title?: string; message?: string; estimateId?: string; jobId?: string; customerId?: string; ownerId?: string;
    };
    if (!message || !message.trim()) return json({ error: "Missing message" }, 400);

    // 1. Authenticated owner session (App.tsx check-in/briefing/goal-tracking
    // effects — all four now attach the caller's own session token).
    const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    let ownerId: string | null = accessToken ? await resolveCallerOwnerId(accessToken) : null;
    // SECURITY FIX (audit finding) — this used to fall back to a bare
    // client-supplied ownerId with NO verification at all whenever no
    // (or an invalid) token was sent, letting anyone who knew/guessed a
    // business's owner_id inject fake "Alfred" notifications into that
    // business's trusted in-app feed — pure spoofing/phishing surface, no
    // login required. Every real caller now sends a real session token
    // (see App.tsx) or resolves ownerId from an estimateId/jobId/customerId
    // it's already legitimately acting on (path 2/3 below) — bodyOwnerId is
    // no longer trusted on its own for anything (kept in the destructure
    // above only so an old cached client sending it doesn't 400).

    // 2. Unauthenticated customer-facing pages — resolve via the row they're
    // already legitimately acting on (see resolveOwnerIdFromRow above).
    if (!ownerId && estimateId) ownerId = await resolveOwnerIdFromRow("estimates", estimateId, serviceRoleKey);
    if (!ownerId && jobId) ownerId = await resolveOwnerIdFromRow("jobs", jobId, serviceRoleKey);
    if (!ownerId && customerId) ownerId = await resolveOwnerIdFromRow("customers", customerId, serviceRoleKey);

    if (ownerId) {
      const ok = await postToOwner(ownerId, title, message, serviceRoleKey);
      return ok ? json({ ok: true }) : json({ error: "Failed to update notifications thread" }, 502);
    }

    // 3. Last resort — no session, no id to key off of. Notify every owner
    // rather than guessing an arbitrary one. Every current in-app caller
    // passes an id (see above), so this path should rarely if ever fire —
    // it exists as a safety net so a future caller that forgets to pass one
    // doesn't just silently vanish into "no owner configured yet".
    console.warn("[AlfredNotify] no session and no estimateId/jobId/customerId given — broadcasting to all owners");
    const ownersRes = await fetch(`${SUPABASE_URL}/rest/v1/app_settings?select=owner_id`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!ownersRes.ok) return json({ error: "Could not resolve any owners (app_settings read failed)" }, 502);
    const ownerRows = await ownersRes.json().catch(() => []);
    const ownerIds: string[] = Array.isArray(ownerRows) ? ownerRows.map((r: any) => r?.owner_id).filter(Boolean) : [];
    if (ownerIds.length === 0) return json({ error: "No owner configured yet" }, 404);
    let anyOk = false;
    for (const oid of ownerIds) {
      const ok = await postToOwner(oid, title, message, serviceRoleKey);
      anyOk = anyOk || ok;
    }
    return anyOk ? json({ ok: true, broadcast: true, count: ownerIds.length }) : json({ error: "Failed to update notifications thread for any owner" }, 502);
  } catch (e: any) {
    console.error("[AlfredNotify] handler error:", e?.message);
    return json({ error: e?.message || "Server error" }, 500);
  }
};
