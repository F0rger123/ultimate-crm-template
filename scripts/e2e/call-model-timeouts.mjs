// functions/api/call-model.ts with a fake NVIDIA (no real calls, short
// fake clock): a big request gets more time than a small one, a slow NVIDIA
// model falls back to a faster NVIDIA model, a 400 doesn't burn fallbacks,
// and when every NVIDIA model times out the error says what to do.
//   node scripts/e2e/call-model-timeouts.mjs
import { build } from "esbuild";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const out = path.join(os.tmpdir(), "call-model-" + Date.now() + ".mjs");
// Also exposes _lib/env's setEnv when there is one (the template sets env per request in _middleware.ts).
const api = path.resolve("functions/api").split(path.sep).join("/");
const envExport = fs.existsSync(`${api}/_lib/env.ts`) ? ` export * as envMod from "${api}/_lib/env.ts";` : "";
await build({ stdin: { contents: `export * from "${api}/call-model.ts";${envExport}`, resolveDir: path.resolve("."), loader: "ts" }, bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "error" });

// Fake clock: setTimeout(ms) fires after ms/1000 real ms, and we record ms.
const timeouts = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (fn, ms, ...a) => { if (ms >= 1000) timeouts.push(ms); return realSetTimeout(fn, Math.max(1, ms / 1000), ...a); };

let behaviour = {};
const nvCalls = [];
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  if (u.pathname === "/auth/v1/user") return j({ id: "own1" });
  if (u.pathname.endsWith("/employees")) return j([]);
  if (u.pathname.endsWith("/rpc/current_member")) return j({ active: true, owner_id: "own1", role: "owner", office: true }); // cleaning CRM's caller lookup
  if (u.pathname.endsWith("/owner_secrets")) return j([{ model_keys: { nvidia_deepseek_r1: "nvapi-test" } }]);
  if (u.hostname === "integrate.api.nvidia.com") {
    const model = JSON.parse(init.body).model; nvCalls.push(model);
    const b = behaviour[model] || "ok";
    if (b === "hang") return new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" }))));
    if (b === "400") return j({ error: { message: "bad request" } }, 400);
    return j({ choices: [{ message: { content: "answer from " + model } }] });
  }
  return j({});
};
const mod = await import(pathToFileURL(out).href);
mod.envMod?.setEnv?.({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" });
const call = async (content) => {
  const req = new Request("https://app.test/api/call-model", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer t" }, body: JSON.stringify({ modelId: "nvidia_deepseek_r1", messages: [{ role: "user", content }] }) });
  const res = await mod.onRequestPost({ request: req, env: { SUPABASE_SERVICE_ROLE_KEY: "svc", SUPABASE_URL: "https://x.supabase.co" } });
  return { status: res.status, body: await res.json() };
};
const r = {};
const reset = () => { timeouts.length = 0; nvCalls.length = 0; };

reset(); behaviour = {};
let x = await call("hi");
const smallTimeout = timeouts[0];
r.smallRequestWorks = x.status === 200 && /kimi-k2\.6/.test(x.body.text) && smallTimeout === 45000;

reset();
x = await call("client list ".repeat(5000));
r.bigRequestGetsMoreTime = timeouts[0] > smallTimeout && timeouts[0] <= 110000;

reset(); behaviour = { "moonshotai/kimi-k2.6": "hang" };
x = await call("hi");
r.slowModelFallsBack = x.status === 200 && /nemotron-3\.5-lightning/.test(x.body.text) && nvCalls.length === 2;

reset(); behaviour = { "moonshotai/kimi-k2.6": "400" };
x = await call("hi");
r.badRequestNoFallback = x.status === 400 && nvCalls.length === 1;

reset(); behaviour = { "moonshotai/kimi-k2.6": "hang", "nvidia/nemotron-3.5-lightning-30b-a3b": "hang", "deepseek-ai/deepseek-v4.1-flash": "hang" };
x = await call("hi");
r.allSlowClearMessage = x.status === 500 && /NVIDIA didn't answer in time \(tried 3/.test(x.body.error) && /Settings → AI Models/.test(x.body.error);

fs.rmSync(out, { force: true });
globalThis.setTimeout = realSetTimeout;
console.log(JSON.stringify(r, null, 1));
const ok = Object.values(r).every(Boolean);
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
