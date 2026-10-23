import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./_lib/env";
// MULTI-TENANT (Phase C) — under the new owner_id-scoped RLS (migration
// 0033_multitenant_owner_scoping.sql), the `invites` table can no longer
// have a public `SELECT true` policy: that would let anyone dump every
// business's pending invites (employee names/emails/hourly rates) across
// every tenant, not just look up the one row matching a code they were
// given. But a brand-new employee opening `#/portal?invite=CODE` has NO
// session yet — nothing to scope an owner_id-restricted RLS policy by.
//
// Same problem one step later: right after that employee signs up, linking
// their new `employees.user_id` and marking the invite used both need to
// write to owner_id-scoped tables (`employees`, `invites`) before their own
// session even has a linked employees row for `current_owner_id()` to
// resolve through — a chicken-and-egg RLS deadlock.
//
// This function is the fix for both, using the Supabase service role key
// (server-side only, bypasses RLS) — but unlike a public policy, it only
// ever touches the ONE row matched by an exact `code`, never exposes the
// table.
//
// SECURITY FIX — this "consume" action used to trust three client-supplied
// values with zero verification: `newUserId` (which auth user to link),
// `employeeId`/`email` (which employees row to link it to), and it never
// checked whether the invite `code` actually matched a real, unused row
// before proceeding. Combined, that meant ANY caller with their own
// throwaway Supabase Auth session could POST
// {action:"consume", code:"anything", newUserId:"<their own uid>",
//  employeeId:"<any known employees.id>"} and link their own account to
// ANY employee row on ANY business — including the owner's own
// auto-created row (predictable id: `owner_<email>`, per docs/ARCHITECTURE.md) — full
// read/write takeover of that business's jobs/customers/invoices/settings
// (including its Twilio/Stripe/AI keys). Fixed by: (1) re-fetching the
// invite by code and requiring it exist and be unused before doing
// anything else, (2) deriving which employee to link SOLELY from fields
// stored on that invite row itself (owner_id + employee_email), never from
// the request body, (3) verifying newUserId against a real Supabase-
// verified access token instead of trusting the client's word for it —
// same pattern already used correctly elsewhere (see public-data.ts's
// resolveCallerEmail), and (4) using the invite UPDATE's own returned row
// to confirm THIS request actually won the "used=false" race before
// proceeding to link anything, so two concurrent consume calls for the
// same code can't both succeed.

const resolveCallerUser = async (accessToken: string): Promise<{ id: string; email: string } | null> => {
  if (!accessToken) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const user = await res.json().catch(() => null) as any;
  return user?.id ? { id: user.id, email: (user.email || "").toLowerCase() } : null;
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" };

  try {
    const body = await context.request.json() as Record<string, any>;
    const action = body?.action;
    const code = (body?.code || "").trim();
    if (!code) return json({ error: "Missing code" }, 400);

    if (action === "lookup") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/invites?code=eq.${encodeURIComponent(code)}&select=*`, { headers });
      const rows = await res.json().catch(() => []);
      const invite = Array.isArray(rows) ? rows[0] : null;
      if (!invite) return json({ error: "Invite not found" }, 404);
      if (invite.used) return json({ error: "This invite has already been used." }, 410);
      return json({ invite });
    }

    if (action === "consume") {
      // The caller must be signed in as a REAL Supabase user — never trust
      // a client-supplied "newUserId" for who's being linked.
      const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const caller = await resolveCallerUser(accessToken);
      if (!caller) return json({ error: "Not signed in." }, 401);

      // Re-fetch the invite by code ourselves — never trust that the
      // client's claim of "this code is valid and unused" is true.
      const inviteRes = await fetch(`${SUPABASE_URL}/rest/v1/invites?code=eq.${encodeURIComponent(code)}&select=*`, { headers });
      const inviteRows = await inviteRes.json().catch(() => []);
      const invite = Array.isArray(inviteRows) ? inviteRows[0] : null;
      if (!invite) return json({ error: "Invite not found." }, 404);
      if (invite.used) return json({ error: "This invite has already been used." }, 410);

      // Claim it atomically — `used=eq.false` in the filter means this
      // UPDATE only ever affects a row if it's STILL unused at the moment
      // this specific request runs; `return=representation` lets us see
      // whether OUR request actually won that race (empty result = someone
      // else claimed it a moment earlier).
      const claimRes = await fetch(`${SUPABASE_URL}/rest/v1/invites?code=eq.${encodeURIComponent(code)}&used=eq.false`, {
        method: "PATCH", headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ used: true, used_at: new Date().toISOString(), used_by: caller.id }),
      });
      const claimedRows = await claimRes.json().catch(() => []);
      if (!claimRes.ok || !Array.isArray(claimedRows) || claimedRows.length === 0) {
        return json({ error: "This invite was just used by someone else — ask for a new invite link." }, 410);
      }

      // Link the placeholder employees row this invite was actually issued
      // for — scoped to THIS invite's own owner_id + employee_email, both
      // read from the invite row itself, never from the request body. This
      // is the one thing that makes it impossible for this endpoint to
      // link an attacker's session to a different business's employee.
      let linkedEmployee: any = null;
      if (invite.owner_id && invite.employee_email) {
        const filter = `owner_id=eq.${encodeURIComponent(invite.owner_id)}&email=ilike.${encodeURIComponent(invite.employee_email)}`;
        await fetch(`${SUPABASE_URL}/rest/v1/employees?${filter}`, {
          method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ user_id: caller.id }),
        });
        const getRes = await fetch(`${SUPABASE_URL}/rest/v1/employees?${filter}&select=*`, { headers });
        const rows = await getRes.json().catch(() => []);
        linkedEmployee = Array.isArray(rows) ? rows[0] : null;
      }
      return json({ success: true, employee: linkedEmployee });
    }

    return json({ error: "Unknown action: " + action }, 400);
  } catch (e: any) {
    return json({ error: e?.message || "invite-action error" }, 400);
  }
};

const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
