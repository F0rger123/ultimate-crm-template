// ─── Direct platform OAuth (fallback to Buffer) ─────────────────────────────
// Buffer is the primary, recommended way to connect social accounts (it
// handles all platforms through one API key). These helpers let a user
// connect Instagram/Facebook (Meta) or TikTok directly instead, for
// platforms or accounts where Buffer isn't an option. LinkedIn removed per
// explicit request — no LinkedIn posting anywhere in this app anymore.
//
// The OAuth *authorization* step (redirecting to the platform and getting a
// `code` back) is safe to do entirely from the browser. The *token exchange*
// step needs the app's client secret, which can never live in frontend code
// — so, exactly like the existing Google OAuth flow in this app, the actual
// code-for-token exchange is proxied through an optional self-hosted backend
// (`settings.socialBackendUrl`). Without that backend configured, "Connect"
// will redirect and come back with a code but can't finish the exchange.

export type SocialPlatform = "facebook" | "instagram" | "tiktok";

export const socialOAuthRedirectUri = (): string =>
  `${window.location.origin}${window.location.pathname}#/social-oauth-callback`;

export const buildSocialAuthorizeUrl = (
  platform: SocialPlatform,
  clientId: string,
  state: string
): string => {
  const redirectUri = socialOAuthRedirectUri();
  switch (platform) {
    case "facebook":
    case "instagram":
      return `https://www.facebook.com/v19.0/dialog/oauth?${new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish",
        response_type: "code",
        state,
      })}`;
    case "tiktok":
      return `https://www.tiktok.com/v2/auth/authorize?${new URLSearchParams({
        client_key: clientId,
        response_type: "code",
        scope: "video.publish,user.info.basic",
        redirect_uri: redirectUri,
        state,
      })}`;
  }
};

export interface SocialOAuthToken {
  accessToken: string;
  expiresAt?: number;
  extra?: Record<string, unknown>;
}

// Exchanges the authorization `code` for an access token — required because
// the client secret can't be exposed in the browser. Defaults to this app's
// own token-exchange proxy (functions/api/social-oauth-exchange.ts, same
// pattern as /api/google-refresh — needs FACEBOOK_APP_SECRET/
// LINKEDIN_CLIENT_SECRET set as Cloudflare env vars). A custom backendUrl
// (Settings -> Integrations -> Social) overrides that default for anyone
// who'd rather run their own proxy instead.
//
// BUG FIX — this used to hard-require backendUrl and return null instantly
// otherwise, so "Connect Facebook/LinkedIn" could never actually finish
// without a self-hosted backend this app has never had (see docs/ARCHITECTURE.md — no
// separate backend server). That's exactly why account connections never
// worked. Now also surfaces the real failure reason (missing env vars, a
// bad code, etc.) instead of a bare null, so the "could not connect" toast
// can say something actionable.
export const exchangeSocialOAuthCode = async (
  backendUrl: string,
  platform: SocialPlatform,
  code: string
): Promise<SocialOAuthToken | { error: string } | null> => {
  try {
    const res = backendUrl
      ? await fetch(`${backendUrl}/oauth/${platform}/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, redirectUri: socialOAuthRedirectUri() }),
        })
      : await fetch("/api/social-oauth-exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform, code }),
        });
    const data = await res.json().catch(() => ({} as any)) as { access_token?: string; expires_in?: number; error?: string; [k: string]: unknown };
    if (!res.ok || !data?.access_token) return { error: data?.error || `HTTP ${res.status}` };
    return { accessToken: data.access_token, expiresAt: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined, extra: data };
  } catch (e: any) { return { error: e?.message || "Network error" }; }
};

// ─── Real posting (only for platforms whose APIs accept plain text) ────────
// Instagram and TikTok require hosted media (images/video) to publish via
// their APIs — this app's photos are local data URIs, not public URLs, so
// those two still rely on the existing share-sheet/clipboard fallback even
// once "connected". Facebook Pages accept plain text posts, so it posts for
// real once a direct token is connected.

export const postToFacebookPage = async (accessToken: string, pageId: string, message: string): Promise<void> => {
  const res = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: accessToken }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? `Facebook error ${res.status}`);
  }
};
