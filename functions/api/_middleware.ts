import { setEnv, SUPABASE_URL } from "./_lib/env";

export const onRequest = async (context: { env: Record<string, string>; next: () => Promise<Response> }) => {
  setEnv(context.env);
  if (!SUPABASE_URL) {
    return new Response(JSON.stringify({ error: "Server missing SUPABASE_URL env var — see README.md → Cloudflare setup." }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  return context.next();
};
