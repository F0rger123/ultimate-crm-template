// Same reasoning as twilio-send.ts — Buffer's GraphQL API at api.buffer.com
// never returns Access-Control-Allow-Origin, so a browser fetch() straight
// to it is rejected by CORS before the request completes ("blocked by CORS
// policy: Response to preflight request doesn't pass access control check").
// lib/messaging.ts's bufferGraphQL() used to call api.buffer.com directly,
// which made every Buffer feature (org lookup, channel list, posting)
// silently fail with a CORS error, not a Buffer error. This function runs
// server-side (no CORS restriction applies) and is called same-origin (no
// CORS restriction applies to calling IT from the browser), so it proxies
// the real Buffer GraphQL call through.
export const onRequestPost = async (context: { request: Request }) => {
  try {
    const { apiKey, query, variables } = await context.request.json() as {
      apiKey?: string; query?: string; variables?: Record<string, unknown>;
    };
    if (!apiKey || !query) {
      return new Response(JSON.stringify({ error: "Missing apiKey/query" }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    }
    const bufferRes = await fetch("https://api.buffer.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, variables: variables || {} }),
    });
    const data = await bufferRes.json().catch(() => ({} as any));
    if (!bufferRes.ok || data?.errors) {
      return new Response(JSON.stringify({ error: data?.errors?.[0]?.message || `Buffer error ${bufferRes.status}` }), {
        status: bufferRes.ok ? 502 : bufferRes.status, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ data: data.data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "Proxy error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};
