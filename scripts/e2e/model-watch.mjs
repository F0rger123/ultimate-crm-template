// Model watch (functions/api/_lib/modelWatch.ts + /api/model-watch +
// /api/call-model) against fake AI providers and a fake Supabase — nothing
// real is contacted:
//   - NVIDIA retired a model → swapped for one that answers and calls tools
//   - Google retired gemini-2.5-flash → swapped for the newest flash model,
//     and /api/call-model then really calls the new one (new endpoint too)
//   - a dead key and an out-of-credit account → health + one event each
//   - runs within 6 hours are skipped; a new free OpenRouter model is noticed
//   node scripts/e2e/model-watch.mjs
import { build } from "esbuild";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const api = path.resolve("functions/api").split(path.sep).join("/");
const out = path.join(os.tmpdir(), "model-watch-" + Date.now() + ".mjs");
const hasSetEnv = fs.readFileSync(`${api}/_lib/env.ts`, "utf8").includes("setEnv");
await build({ stdin: { contents: `export * as watch from "${api}/model-watch.ts"; export * as callModel from "${api}/call-model.ts"; export * as lib from "${api}/_lib/modelWatch.ts";${hasSetEnv ? ` export * as envMod from "${api}/_lib/env.ts";` : ""}`, resolveDir: path.resolve("."), loader: "ts" }, bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "error" });

const OWNER = "own1";
const records = new Map();
let nvCatalog = ["moonshotai/kimi-k2.6", "deepseek-ai/deepseek-v4.1-flash", "nvidia/nemotron-3-super-120b-a12b", "nvidia/nemotron-3.5-lightning-30b-a3b", "meta/llama-3.3-70b-instruct"]; // muse-glimmer retired
let orCatalog = [{ id: "a/free-one:free", context_length: 100000, supported_parameters: ["tools"], pricing: { prompt: "0", completion: "0" } }];
const calls = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url)); const m = (init.method || "GET").toUpperCase();
  const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  const body = init.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
  if (u.hostname === "integrate.api.nvidia.com") {
    if (m === "GET") return j({ data: nvCatalog.map(id => ({ id })) });
    calls.push({ host: "nvidia", model: body.model, tools: !!body.tools });
    if (body.model === "nvidia/nemotron-3-super-120b-a12b") return j({ choices: [{ message: { content: "OK" } }] }); // answers but never calls tools
    return j({ choices: [{ message: { content: "", tool_calls: body.tools ? [{ id: "1", function: { name: "ok_check", arguments: "{}" } }] : [] } }] });
  }
  if (u.hostname === "openrouter.ai") return j({ data: orCatalog });
  if (u.hostname === "generativelanguage.googleapis.com") {
    if (m === "GET") return j({ models: ["gemini-3.0-flash", "gemini-2.5-pro", "text-embedding-004"].map(n => ({ name: "models/" + n, supportedGenerationMethods: n.startsWith("text-") ? ["embedContent"] : ["generateContent"] })) });
    const model = u.pathname.match(/models\/([^:]+):/)[1];
    calls.push({ host: "google", model });
    if (model === "gemini-2.5-flash") return j({ error: { message: "models/gemini-2.5-flash is not found for API version v1beta" } }, 404);
    return j({ candidates: [{ content: { parts: [{ text: "OK" }] } }] });
  }
  if (u.hostname === "api.groq.com") return m === "GET" ? j({ error: { message: "Invalid API Key" } }, 401) : j({ error: { message: "Invalid API Key" } }, 401);
  if (u.hostname === "api.anthropic.com") return m === "GET" ? j({ data: [{ id: "claude-sonnet-5-5" }] }) : j({ error: { message: "Your credit balance is too low to access the Anthropic API." } }, 400);
  if (u.pathname === "/auth/v1/user") return j({ id: OWNER });
  if (u.pathname.endsWith("/rpc/current_member")) return j({ active: true, owner_id: OWNER, role: "owner", office: true });
  if (u.pathname.endsWith("/employees")) return j([]);
  if (u.pathname.endsWith("/owner_secrets")) return j([{ owner_id: OWNER, model_keys: { nvidia_muse: "nvapi-x", gemini: "g-key", groq: "gsk-bad", claude: "sk-ant" } }]);
  if (u.pathname.endsWith("/owner_records")) {
    if (m === "GET") { const k = `${u.searchParams.get("owner_id").slice(3)}|${u.searchParams.get("kind").slice(3)}|${u.searchParams.get("id").slice(3)}`; return j(records.has(k) ? [{ data: records.get(k) }] : []); }
    for (const r of body) records.set(`${r.owner_id}|${r.kind}|${r.id}`, JSON.parse(JSON.stringify(r.data)));
    return j([], 201);
  }
  return j({});
};
const mod = await import(pathToFileURL(out).href);
const env = { SUPABASE_SERVICE_ROLE_KEY: "svc", SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" };
mod.envMod?.setEnv?.(env);
const r = {};
const get = async (q = "") => (await mod.watch.onRequestGet({ request: new Request("https://app.test/api/model-watch" + q), env })).json();
const post = async action => (await mod.watch.onRequestPost({ request: new Request("https://app.test/api/model-watch", { method: "POST", headers: { Authorization: "Bearer t", "Content-Type": "application/json" }, body: JSON.stringify({ action }) }), env })).json();

const run1 = await get();
const shared = records.get("__global__|model_watch|overrides");
r.nvidiaRetiredSwapped = shared?.overrides?.nvidia_muse?.model === "moonshotai/kimi-k2.6" && shared.overrides.nvidia_muse.was === "meta/muse-glimmer-30b";
r.geminiRetiredSwapped = shared?.overrides?.gemini?.model === "gemini-3.0-flash";
r.toolLessModelNotTrusted = !(shared?.nvidiaWorking || []).includes("nvidia/nemotron-3-super-120b-a12b") && (shared?.nvidiaWorking || []).length >= 2;
r.keepsWorkingModels = !shared?.overrides?.claude && !shared?.overrides?.groq;
const health = records.get(`${OWNER}|model_health|status`);
r.deadKeyReported = health?.slots?.groq?.kind === "key" && health.events.some(e => /groq AI key stopped working/.test(e.text));
r.outOfCreditReported = health?.slots?.claude?.kind === "credit" && health.events.some(e => /claude AI account is out of credit/.test(e.text));
r.replacementNoticed = health?.events?.some(e => /switched a model automatically/.test(e.text));
r.suggestsFreeProviders = (health?.suggestions || []).some(s => s.provider === "cerebras") && !(health?.suggestions || []).some(s => s.provider === "google");

// /api/call-model now calls the replacement.
calls.length = 0;
const cm = await mod.callModel.onRequestPost({ request: new Request("https://app.test/api/call-model", { method: "POST", headers: { Authorization: "Bearer t", "Content-Type": "application/json" }, body: JSON.stringify({ modelId: "gemini", messages: [{ role: "user", content: "hi" }] }) }), env });
r.callsUseReplacement = cm.status === 200 && calls.some(c => c.host === "google" && c.model === "gemini-3.0-flash") && !calls.some(c => c.model === "gemini-2.5-flash");

const run2 = await get();
r.secondRunSkipped = run2.skipped === true;
orCatalog = [...orCatalog, { id: "b/brand-new:free", context_length: 200000, supported_parameters: ["tools"], pricing: { prompt: "0", completion: "0" } }];
const evCount = records.get(`${OWNER}|model_health|status`).events.length;
const status = await post("check");
r.newFreeModelNoticed = (status.newFree || []).some(n => n.model === "b/brand-new:free");
r.noDuplicateEvents = records.get(`${OWNER}|model_health|status`).events.filter(e => /groq AI key stopped working/.test(e.text)).length === 1 && status.health.events.length <= evCount + 1;
r.statusForUi = !!status.health?.slots?.gemini?.ok && status.overrides?.gemini?.model === "gemini-3.0-flash";

fs.rmSync(out, { force: true });
console.log(JSON.stringify(r, null, 1));
const ok = Object.values(r).every(Boolean);
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
