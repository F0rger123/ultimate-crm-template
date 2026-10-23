// FEATURE — live Twilio account health check ("is the account actually able
// to send", not just "are credentials present"). Same same-origin CORS-proxy
// pattern as twilio-send.ts/twilio-campaign-status.ts (Twilio's REST API
// returns no CORS headers for a browser-origin fetch). Two Twilio endpoints,
// fetched in parallel:
//   - GET /2010-04-01/Accounts/{Sid}.json      → account.status: "active" |
//     "suspended" (non-payment, abuse, etc.) | "closed"
//   - GET /2010-04-01/Accounts/{Sid}/Balance.json → current balance/currency
// A suspended account still returns 200 on the Account fetch (status just
// says "suspended") — that's the actual "can this account send" signal the
// owner asked for, more reliable than balance alone (a $0.00 balance can
// still be a perfectly active pay-as-you-go account with a card on file).
import { getOwnerSecrets, resolveCallerOwnerId } from "./_lib/ownerSecrets";

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    let { sid, token, ownerId } = await context.request.json() as { sid?: string; token?: string; ownerId?: string };
    // SECURITY FIX (audit finding) — this used to resolve and use ANY
    // client-supplied ownerId's real Twilio credentials with zero proof the
    // caller actually owns that business — a live Account SID + Auth Token
    // (which the resulting balance/status call authenticates with) plus the
    // account's balance/friendly name is a real information disclosure, not
    // just a benign status check. Only honored now when the caller has a
    // real session that resolves to that SAME ownerId (mirrors twilio-
    // send.ts's stricter "ignore the body entirely" fix, kept slightly
    // looser here only because sid/token can ALSO be passed directly by an
    // owner testing not-yet-saved credentials — that path never touches
    // owner_secrets at all, so it carries no cross-tenant risk on its own).
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
      if (secrets?.twilioAuthToken) { sid = secrets.twilioAccountSid || sid; token = secrets.twilioAuthToken; }
    }
    if (!sid || !token) {
      return new Response(JSON.stringify({ error: "Missing sid/token" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const auth = `Basic ${btoa(`${sid}:${token}`)}`;
    const [acctRes, balRes] = await Promise.all([
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}.json`, { headers: { Authorization: auth } }),
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, { headers: { Authorization: auth } }),
    ]);
    const acctData = await acctRes.json().catch(() => ({} as any));
    if (!acctRes.ok) {
      // ISSUE 10 (round 3) — a 404 here (as opposed to a 401) means the SID
      // resolved to no Account at all — almost always because the value in
      // Settings is a Messaging Service SID ("MG...") or an API Key SID
      // ("SK...") pasted into the Account SID field instead of the real
      // Account SID ("AC..."), not a credentials/funds problem. Surface that
      // distinction directly instead of Twilio's generic "not found" text so
      // it's actually actionable from the Campaigns page tooltip.
      const hint = acctRes.status === 404
        ? (sid.startsWith("AC") ? " (this Account SID doesn't exist on Twilio — check for a typo or a revoked subaccount)" : ` (this SID starts with "${sid.slice(0, 2)}", but an Account SID always starts with "AC" — you may have pasted a Messaging Service or API Key SID into the Account SID field)`)
        : acctRes.status === 401
        ? " (bad Account SID or Auth Token — re-copy both from the Twilio Console)"
        : "";
      return new Response(JSON.stringify({ error: (acctData?.message || `Twilio error ${acctRes.status}`) + hint, raw: acctData }), {
        status: acctRes.status, headers: { "Content-Type": "application/json" },
      });
    }
    const balData = balRes.ok ? await balRes.json().catch(() => ({} as any)) : null;

    return new Response(JSON.stringify({
      accountStatus: acctData?.status ?? null,       // "active" | "suspended" | "closed"
      accountType: acctData?.type ?? null,            // "Trial" | "Full"
      friendlyName: acctData?.friendly_name ?? null,
      balance: balData?.balance ?? null,
      currency: balData?.currency ?? null,
      balanceError: balRes.ok ? null : `Balance check failed (${balRes.status})`,
    }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
