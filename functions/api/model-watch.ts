// model-watch.ts — runs the model watch (_lib/modelWatch.ts) and shows its
// results.
//   GET  /api/model-watch[?key=…]  — scheduler / GitHub Actions. Runs for
//        every business at most every 6 hours (or when ?force=1 with the
//        key). If MODEL_WATCH_KEY (or REMINDERS_CRON_SECRET) is set in
//        Cloudflare, ?key= must match it.
//   POST /api/model-watch { action: "status" | "check" } — signed in. "status"
//        returns this business's model health and the shared replacement
//        list; "check" re-runs the watch for this business now (at most
//        every 10 minutes).
import { resolveCallerOwnerId } from "./_lib/ownerSecrets";
import { runModelWatch, type ModelHealthDoc } from "./_lib/modelWatch";
import { loadModelOverrides } from "./_lib/modelOverrides";
import { SUPABASE_URL } from "./_lib/env";

const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const lastCheckByOwner = new Map<string, number>();

export const onRequestGet = async (context: { request: Request; env: Record<string, string> }) => {
  const secret = context.env.MODEL_WATCH_KEY || context.env.REMINDERS_CRON_SECRET;
  const url = new URL(context.request.url);
  const key = url.searchParams.get("key");
  if (secret && key !== secret) return json({ error: "Invalid key" }, 403);
  const r = await runModelWatch(context.env, { force: !!secret && key === secret && url.searchParams.get("force") === "1" });
  return json(r);
};

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  const serviceKey = context.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return json({ error: "SUPABASE_SERVICE_ROLE_KEY isn't set" }, 500);
  const token = (context.request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const ownerId = await resolveCallerOwnerId(token).catch(() => null);
  if (!ownerId) return json({ error: "Sign in first." }, 401);
  const { action } = await context.request.json().catch(() => ({})) as { action?: string };
  if (action === "check") {
    const last = lastCheckByOwner.get(ownerId) || 0;
    if (Date.now() - last > 10 * 60 * 1000) { lastCheckByOwner.set(ownerId, Date.now()); await runModelWatch(context.env, { onlyOwner: ownerId }); }
  }
  const rows = await fetch(`${SUPABASE_URL}/rest/v1/owner_records?owner_id=eq.${encodeURIComponent(ownerId)}&kind=eq.model_health&id=eq.status&select=data&limit=1`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }).then(r => r.json()).catch(() => []);
  const health: ModelHealthDoc | null = Array.isArray(rows) && rows[0]?.data ? rows[0].data : null;
  const shared = await loadModelOverrides(serviceKey, action === "check");
  return json({
    health,
    overrides: shared.overrides || {},
    nvidiaWorking: shared.nvidiaWorking || [],
    openrouterFree: (shared.openrouterFree || []).slice(0, 8),
    newFree: (shared.newFree || []).slice(0, 10),
    checkedAt: shared.checkedAt || null,
  });
};
