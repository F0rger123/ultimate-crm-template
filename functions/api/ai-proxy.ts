// ai-proxy.ts — same-origin CORS proxy for AI provider calls that don't
// support browser CORS at all (confirmed live: integrate.api.nvidia.com
// returns no Access-Control-Allow-Origin header on either the preflight or
// the actual response — a direct browser fetch is blocked outright, not
// conditionally). lib/api.ts's callModel previously fell back to a public
// third-party proxy (corsproxy.io) on any CORS/network TypeError; that
// proxy is now returning 403 Forbidden on every request (verified live),
// which is the real reason NVIDIA models "don't work" — there was no
// working path at all, not a key/config problem. Routing through this
// Cloudflare Function instead removes the third-party dependency AND stops
// sending the user's API key to an unrelated public service.
//
// Locked to the exact provider hostnames this app actually calls — never a
// general-purpose open relay to arbitrary URLs (would otherwise let any
// caller use this deployment to proxy requests anywhere, at this app's
// expense/reputation).
const ALLOWED_HOSTS = new Set([
  "integrate.api.nvidia.com",
  "api.groq.com",
  "api.mistral.ai",
  "openrouter.ai",
  "api.openai.com",
]);

export const onRequestPost = async (context: { request: Request }) => {
  try {
    const { url, headers, body } = await context.request.json() as { url?: string; headers?: Record<string, string>; body?: string };
    if (!url) return new Response(JSON.stringify({ error: "Missing url" }), { status: 400, headers: { "Content-Type": "application/json" } });
    let parsed: URL;
    try { parsed = new URL(url); } catch { return new Response(JSON.stringify({ error: "Invalid url" }), { status: 400, headers: { "Content-Type": "application/json" } }); }
    if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
      return new Response(JSON.stringify({ error: `Host not allowed: ${parsed.hostname}` }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    const upstream = await fetch(parsed.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(headers || {}) },
      body: body || "{}",
    });
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "ai-proxy error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
