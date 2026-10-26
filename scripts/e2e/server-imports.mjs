// Texted imports (functions/api/_lib/textImport.ts) and Google Sheets
// fetching (functions/api/_lib/sheetCsv.ts) against a fake Supabase, a fake
// AI and a fake Google — nothing real is contacted:
//   - a PDF client list read in two parts (the first answer ran out of
//     room) → every row planned, nothing saved until a later YES
//   - run_import refuses in the same turn, then saves customers and jobs
//   - a receipt photo is recognized as not-a-list
//   - a Google Sheets link: public CSV, then private via the Google account
//   node scripts/e2e/server-imports.mjs
import { build } from "esbuild";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const api = path.resolve("functions/api").split(path.sep).join("/");
const out = path.join(os.tmpdir(), "server-imports-" + Date.now() + ".mjs");
const envExport = fs.existsSync(`${api}/_lib/env.ts`) ? ` export * as envMod from "${api}/_lib/env.ts";` : "";
await build({ stdin: { contents: `export * from "${api}/_lib/textImport.ts"; export * from "${api}/_lib/sheetCsv.ts";${envExport}`, resolveDir: path.resolve("."), loader: "ts" }, bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "error" });

const db = { owner_records: [], customers: [{ id: "c-old", owner_id: "own1", firstName: "Ann", lastName: "Old", phone: "7175550001", tags: [] }], employees: [{ id: "e1", owner_id: "own1", firstName: "Mike", lastName: "Jones", status: "active" }], savedCustomers: 0, savedJobs: 0 };
const ROWS = Array.from({ length: 40 }, (_, i) => `Client ${i}\t717555${String(1000 + i)}\t${i} Oak St\tYork\tTuesday\t30\t2\t${i % 2 ? "Mike" : ""}`);
let claudeCalls = 0, sheetMode = "public", lastPrompt = "";
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url)); const m = (init.method || "GET").toUpperCase();
  const j = (b, s = 200, h = {}) => new Response(typeof b === "string" ? b : JSON.stringify(b), { status: s, headers: { "Content-Type": typeof b === "string" ? "text/csv" : "application/json", ...h } });
  if (u.hostname === "files.test") return new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { "Content-Type": u.pathname.endsWith(".pdf") ? "application/pdf" : "image/jpeg" } });
  if (u.hostname === "api.anthropic.com") {
    claudeCalls++;
    const body = JSON.parse(init.body); const prompt = body.messages[0].content.at(-1).text; lastPrompt = prompt;
    const isReceipt = body.messages[0].content[0].type === "image";
    let text;
    if (isReceipt) text = '{"kind":"receipt","title":"Fuel","receipt":{"vendor":"Sheetz","date":"2026-10-20","total":61.2,"category":"fuel"}}\nSheetz fuel $61.20\n<<END>>';
    else if (/ran out of room/.test(prompt)) text = ROWS.slice(25).join("\n") + "\n<<END>>";
    else text = '{"kind":"client_list","title":"Trash can clients","rowCount":40,"receipt":null}\nName\tPhone\tAddress\tCity\tDay\tPrice\tCans\tWorker\n' + ROWS.slice(0, 25).join("\n");
    return j({ content: [{ type: "text", text }] });
  }
  if (u.hostname === "docs.google.com") {
    if (sheetMode === "public") return j("Name,Phone,Address\nSheet Person,7175559999,1 Elm St\n");
    if (init.headers?.Authorization === "Bearer g-token") return j("Name,Phone\nPrivate Person,7175558888\n");
    return new Response("<html>sign in</html>", { status: 200, headers: { "Content-Type": "text/html" } });
  }
  if (u.hostname === "oauth2.googleapis.com") return j({ access_token: "g-token" });
  if (u.pathname.endsWith("/owner_secrets")) return j([{ google_refresh_token: "r1", model_keys: {} }]);
  const table = u.pathname.split("/").pop();
  if (table === "owner_records") {
    if (m === "GET") {
      const kind = (u.searchParams.get("kind") || "").replace("eq.", ""); const id = (u.searchParams.get("id") || "").replace("eq.", "");
      const rows = db.owner_records.filter(r => r.kind === kind && !r.deleted_at && (!id || r.id === id)).sort((a, b) => b.updated - a.updated);
      return j(rows.map(r => ({ id: r.id, data: r.data, updated_at: new Date(r.updated).toISOString() })));
    }
    const [row] = JSON.parse(init.body); const i = db.owner_records.findIndex(r => r.id === row.id && r.kind === row.kind);
    const rec = { ...row, updated: Date.now() }; if (i >= 0) db.owner_records[i] = rec; else db.owner_records.push(rec);
    return j([row], 201);
  }
  if (table === "customers" && m === "GET") return j(Number(u.searchParams.get("offset") || 0) ? [] : db.customers);
  if (table === "employees" && m === "GET") return j(db.employees);
  if (table === "customers" && m === "POST") { db.savedCustomers += JSON.parse(init.body).length; return j("", 201); }
  if (table === "jobs" && m === "POST") {
    const rows = JSON.parse(init.body);
    if (rows.some(r => "cansCount" in r) && process.env.NO_CANS) return j({ message: "Could not find the 'cansCount' column of 'jobs' in the schema cache" }, 400);
    db.savedJobs += rows.length; return j("", 201);
  }
  return j([]);
};
const mod = await import(pathToFileURL(out).href);
mod.envMod?.setEnv?.({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" });
const ctx = { authHeaders: { apikey: "svc", Authorization: "Bearer svc" }, ownerId: "own1", modelKeys: { claude: "sk-test" }, turnStartedAt: Date.now(), env: { SUPABASE_SERVICE_ROLE_KEY: "svc", GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsec", SUPABASE_URL: "https://x.supabase.co" } };
const r = {};

const prep = await mod.prepareImportFromFile(ctx, { fileUrl: "https://files.test/list.pdf", fileType: "application/pdf", serviceCategory: "trash_can" });
r.pdfReadInTwoParts = claudeCalls === 2 && prep.recordsRead === 40;
r.planned = prep.success && prep.newCustomers === 40 && prep.jobsToCreate === 40 && prep.jobsWithWorker === 20;
r.nothingSavedYet = db.savedCustomers === 0 && db.savedJobs === 0;
const refused = await mod.runTextImport(ctx);
r.refusedSameTurn = /Refused/.test(refused.error || "");
ctx.turnStartedAt = Date.now() + 1000; // the owner's later "yes"
const run = await mod.runTextImport(ctx);
r.savedAfterYes = run.success && run.customersSaved === 40 && run.jobsSaved === 40 && db.savedCustomers === 40 && db.savedJobs === 40;
const again = await mod.runTextImport(ctx);
r.notSavedTwice = !!again.error && db.savedCustomers === 40;

const receipt = await mod.prepareImportFromFile(ctx, { fileUrl: "https://files.test/receipt.jpg", fileType: "image/jpeg" });
r.receiptNotAList = receipt.notAList === true && receipt.kind === "receipt" && /import_financial_document/.test(receipt.next);

sheetMode = "public";
let s = await mod.fetchSheetCsv(ctx.env, "own1", "https://docs.google.com/spreadsheets/d/abc123/edit#gid=0");
r.publicSheet = s.csv?.includes("Sheet Person") && s.via === "public link";
sheetMode = "private";
s = await mod.fetchSheetCsv(ctx.env, "own1", "https://docs.google.com/spreadsheets/d/abc123/edit");
r.privateSheetViaGoogle = s.csv?.includes("Private Person") && /Google account/.test(s.via);
s = await mod.fetchSheetCsv({ SUPABASE_SERVICE_ROLE_KEY: "svc" }, "own1", "https://docs.google.com/spreadsheets/d/abc123/edit");
r.privateSheetClearError = s.status === 403 && /Anyone with the link/.test(s.error);
r.badLink = (await mod.fetchSheetCsv(ctx.env, "own1", "https://example.com/x")).status === 400;
sheetMode = "public";
const sheetPrep = await mod.prepareImportFromFile({ ...ctx, turnStartedAt: Date.now() }, { sheetUrl: "https://docs.google.com/spreadsheets/d/abc123/edit" });
r.sheetImportPlanned = sheetPrep.success && sheetPrep.newCustomers === 1;

fs.rmSync(out, { force: true });
console.log(JSON.stringify(r, null, 1));
const ok = Object.values(r).every(Boolean);
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
