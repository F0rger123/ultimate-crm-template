import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./_lib/env";
// MULTI-TENANT — Stripe Connect OAuth. Lets an owner click "Connect with
// Stripe" in Settings and authorize this platform against their OWN Stripe
// account, instead of copy-pasting a raw secret key. On success we store
// only their connected account id (acct_...) in owner_stripe_accounts —
// never a secret key belonging to them. All API calls on their behalf go
// through THIS PLATFORM's own STRIPE_SECRET_KEY with a `Stripe-Account`
// header (see functions/api/stripe-action.ts), which is Stripe's documented
// pattern for platforms acting on a connected account.
//
// Setup (see docs/ARCHITECTURE.md / plan doc): Stripe Dashboard → Settings → Connect →
// enable "Platform or marketplace", grab the OAuth Client ID (ca_...), set
// its redirect URI to https://<domain>/api/stripe-connect-oauth. Then in
// Cloudflare Pages → Environment variables add:
//   STRIPE_CONNECT_CLIENT_ID   — the ca_... client id from the step above
//   STRIPE_CONNECT_STATE_SECRET — any random long string, used to sign the
//                                 OAuth `state` param so it can't be forged
//                                 to link a stolen `code` to someone else's
//                                 owner_id (falls back to
//                                 SUPABASE_SERVICE_ROLE_KEY if unset, but a
//                                 dedicated secret is recommended)
//   STRIPE_SECRET_KEY          — already required by stripe-action.ts; this
//                                 platform's OWN secret key is what's used
//                                 for the token exchange below (never the
//                                 connected account's)


const hmac = async (message: string, secret: string): Promise<string> => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

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

// POST { action: "get_authorize_url" } — called from Settings while the
// owner is signed in. Returns the URL to redirect the browser to.
export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const body = await context.request.json() as Record<string, any>;
    if (body?.action !== "get_authorize_url") {
      return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const clientId = context.env.STRIPE_CONNECT_CLIENT_ID;
    if (!clientId) {
      return new Response(JSON.stringify({ error: "Server missing STRIPE_CONNECT_CLIENT_ID env var — set up Stripe Connect in the Stripe Dashboard first (Settings → Connect), then add the Client ID in Cloudflare Pages." }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
    const accessToken = (context.request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const ownerId = await resolveCallerOwnerId(accessToken);
    if (!ownerId) {
      return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    const stateSecret = context.env.STRIPE_CONNECT_STATE_SECRET || context.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const sig = stateSecret ? await hmac(ownerId, stateSecret) : "";
    const state = `${ownerId}.${sig}`;
    const redirectUri = `${new URL(context.request.url).origin}/api/stripe-connect-oauth`;
    const url = `https://connect.stripe.com/oauth/authorize?${new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      scope: "read_write",
      redirect_uri: redirectUri,
      state,
    }).toString()}`;
    return new Response(JSON.stringify({ url }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Stripe Connect error" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
};

// GET — Stripe redirects the browser back here after the owner authorizes
// (or declines) on Stripe's own site. Verifies `state`, exchanges `code`
// for the connected account id, saves it, then redirects into the app.
export const onRequestGet = async (context: { request: Request; env: Record<string, string> }) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const errorParam = url.searchParams.get("error_description") || url.searchParams.get("error");
  const redirectTo = (query: string) => new Response(null, { status: 302, headers: { Location: `${url.origin}/#/settings?${query}` } });

  if (errorParam) return redirectTo(`stripe_connect_error=${encodeURIComponent(errorParam)}`);
  if (!code || !state) return redirectTo("stripe_connect_error=missing_code_or_state");

  const [ownerId, sig] = state.split(".");
  const stateSecret = context.env.STRIPE_CONNECT_STATE_SECRET || context.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!stateSecret || !ownerId || !sig) return redirectTo("stripe_connect_error=invalid_state");
  const expectedSig = await hmac(ownerId, stateSecret);
  // SECURITY FIX (audit finding — low severity) — a plain !== comparison on
  // a secret HMAC is a timing side-channel (same class of issue the webhook
  // signature checks elsewhere in this codebase already guard against);
  // low practical risk here (gates OAuth-code linking, not money movement),
  // fixed anyway to match the same constant-time comparison used for
  // Stripe/Square webhook signatures.
  const sigMatches = expectedSig.length === sig.length && (() => {
    let diff = 0;
    for (let i = 0; i < expectedSig.length; i++) diff |= expectedSig.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  })();
  if (!sigMatches) return redirectTo("stripe_connect_error=state_verification_failed");

  const platformSecretKey = context.env.STRIPE_SECRET_KEY;
  const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!platformSecretKey || !serviceRoleKey) return redirectTo("stripe_connect_error=server_not_configured");

  try {
    const tokenRes = await fetch("https://connect.stripe.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_secret: platformSecretKey, code, grant_type: "authorization_code" }).toString(),
    });
    const tokenData = await tokenRes.json().catch(() => ({} as any));
    if (!tokenRes.ok || !tokenData.stripe_user_id) {
      return redirectTo(`stripe_connect_error=${encodeURIComponent(tokenData?.error_description || "token_exchange_failed")}`);
    }
    const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/owner_stripe_accounts`, {
      method: "POST",
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ owner_id: ownerId, stripe_account_id: tokenData.stripe_user_id, updated_at: new Date().toISOString() }),
    });
    if (!saveRes.ok) return redirectTo("stripe_connect_error=save_failed");
    return redirectTo("stripe_connected=1");
  } catch (e: any) {
    return redirectTo(`stripe_connect_error=${encodeURIComponent(e?.message || "unknown")}`);
  }
};
