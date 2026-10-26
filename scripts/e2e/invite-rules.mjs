// node scripts/e2e/invite-rules.mjs .  — bundles functions/api/public-data.ts and checks the
// portal-invite e-mail rules against a fake Supabase. Contacts nothing real.
import { build } from "esbuild";
import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs";
import os from "node:os";

const repo = process.argv[2];
const out = path.join(os.tmpdir(), "invite-test-" + Date.now() + ".mjs");
// Also exposes _lib/env's setEnv (the template sets env per request in _middleware.ts).
const api = path.resolve(repo, "functions/api").split(path.sep).join("/");
const envExport = fs.existsSync(`${api}/_lib/env.ts`) ? ` export * as envMod from "${api}/_lib/env.ts";` : "";
await build({ stdin: { contents: `export * from "${api}/public-data.ts";${envExport}`, resolveDir: repo, loader: "ts" }, bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "error" });

const TOKEN = "AbCdEfGhIjKlMnOpQrSt";
let customer, calls, user;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url)); const m = (init.method || "GET").toUpperCase(); const p = u.pathname;
  calls.push({ m, p, q: u.search, body: init.body ? String(init.body) : "" });
  const j = (b, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
  if (p === "/auth/v1/user") return user ? j(user) : j({}, 401);
  if (p === "/auth/v1/admin/users") return j({ id: "new" });
  if (p.endsWith("/owner_records") && m === "GET") return j([{ owner_id: "own1", id: TOKEN, data: { customerId: "c1", createdAt: "2026-01-01" } }]);
  if (p.endsWith("/customers") && m === "GET") return j([customer]);
  if (p.endsWith("/customers") && m === "PATCH") { Object.assign(customer, JSON.parse(init.body)); return j([]); }
  return j([]);
};
const mod = await import(pathToFileURL(out).href);
const env = { SUPABASE_SERVICE_ROLE_KEY: "svc", SUPABASE_ANON_KEY: "anon", SUPABASE_URL: "https://x.supabase.co" };
mod.envMod?.setEnv?.(env);
const call = async (body, auth) => {
  const req = new Request("https://app.test/api/public-data", { method: "POST", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: "Bearer " + auth } : {}) }, body: JSON.stringify(body) });
  const res = await mod.onRequestPost({ request: req, env, waitUntil() {} });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};
const reset = (email) => { customer = { id: "c1", owner_id: "own1", firstName: "Jane", email }; calls = []; user = null; };
const adminCreates = () => calls.filter(c => c.p === "/auth/v1/admin/users");
const results = {};

reset("jane@example.com");
let r = await call({ action: "portal_signup_with_invite", token: TOKEN, email: "attacker@evil.test", password: "secret123" });
results.otherEmailRefused = r.status === 409 && adminCreates().length === 0 && customer.email === "jane@example.com";

reset("jane@example.com");
r = await call({ action: "portal_signup_with_invite", token: TOKEN, email: "Jane@Example.com", password: "secret123" });
results.onFileEmailConfirmed = r.status === 200 && r.body.success === true && adminCreates().length === 1 && JSON.parse(adminCreates()[0].body).email_confirm === true;

reset("");
r = await call({ action: "portal_signup_with_invite", token: TOKEN, email: "new@example.com", password: "secret123" });
results.noEmailNeedsConfirm = r.status === 200 && r.body.confirmEmail === true && adminCreates().length === 0 && customer.email === "new@example.com";

reset("jane@example.com"); user = { id: "u1", email: "jane@example.com", email_confirmed_at: null };
r = await call({ action: "claim_portal_invite", token: TOKEN }, "tok");
results.unconfirmedClaimRefused = r.status === 401;

reset("jane@example.com"); user = { id: "u1", email: "other@example.com", email_confirmed_at: "2026-01-01" };
r = await call({ action: "claim_portal_invite", token: TOKEN }, "tok");
results.otherEmailClaimRefused = r.status === 409 && customer.email === "jane@example.com";

reset("jane@example.com"); user = { id: "u1", email: "jane@example.com", email_confirmed_at: "2026-01-01" };
r = await call({ action: "claim_portal_invite", token: TOKEN }, "tok");
results.matchingClaimWorks = r.status === 200 && r.body.success === true;

fs.rmSync(out, { force: true });
console.log(JSON.stringify(results, null, 1));
const ok = Object.values(results).every(Boolean);
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
