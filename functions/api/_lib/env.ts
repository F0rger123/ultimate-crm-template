// Project config for every /api function, read from Cloudflare Pages env vars
// (Settings → Environment variables). Set per request by ../_middleware.ts —
// these are ES module live bindings, so importers always see current values.
export let SUPABASE_URL = "";
export let SUPABASE_ANON_KEY = "";
// "sandbox" | "production" — which Square API host every Square call uses.
export let SQUARE_ENVIRONMENT: "sandbox" | "production" = "production";

export const setEnv = (env: Record<string, string | undefined>) => {
  SUPABASE_URL = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  SQUARE_ENVIRONMENT = (env.SQUARE_ENVIRONMENT || env.VITE_SQUARE_ENVIRONMENT) === "sandbox" ? "sandbox" : "production";
};
