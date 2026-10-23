// social-oauth-exchange.ts — same reasoning as functions/api/google-refresh.ts:
// exchanging an OAuth authorization code for an access token requires the
// platform app's client secret, which must never ship in the frontend
// bundle. Settings -> Integrations -> Social lets the owner paste their own
// app's CLIENT ID (safe, public, used client-side to build the authorize
// URL — see src/lib/socialOAuth.ts's buildSocialAuthorizeUrl) but the
// matching CLIENT SECRET has to live here instead, as a Cloudflare Pages
// environment variable, never in settings/app_settings (that blob syncs to
// every session including unauthenticated portal pages — see docs/ARCHITECTURE.md's
// Stripe-key-leak precedent this exact pattern already fixed once).
//
// One-time setup per platform the owner wants to connect (Cloudflare
// dashboard -> this project -> Settings -> Environment variables):
//   Facebook/Instagram (same Meta app): FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
// LinkedIn support removed per explicit request — no LinkedIn posting
// anywhere in this app anymore. TikTok is deliberately NOT handled here — its content-posting API
// requires hosted video media (this app's photos/video are local data URIs,
// not public URLs), so a token alone wouldn't let it actually post; it
// stays on the existing share-sheet/clipboard-paste flow regardless of
// whether a token exists.
export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const { platform, code } = await context.request.json() as { platform?: string; code?: string };
    if (!platform || !code) {
      return new Response(JSON.stringify({ error: "Missing platform or code" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    const redirectUri = `${new URL(context.request.url).origin}/#/social-oauth-callback`;

    if (platform === "facebook" || platform === "instagram") {
      const clientId = context.env.FACEBOOK_APP_ID;
      const clientSecret = context.env.FACEBOOK_APP_SECRET;
      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: "Server missing FACEBOOK_APP_ID/FACEBOOK_APP_SECRET env vars — add them in the Cloudflare Pages dashboard" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      const url = `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code })}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || !data?.access_token) {
        return new Response(JSON.stringify({ error: data?.error?.message || `Facebook token exchange error ${res.status}` }), { status: res.status || 500, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ access_token: data.access_token, expires_in: data.expires_in }), { headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `${platform} isn't supported for direct token exchange — it needs hosted media to actually post, so there's nothing a token alone would unlock. Use the share-sheet flow instead.` }), { status: 400, headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
