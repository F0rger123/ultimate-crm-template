// Bulk import engine (src/lib/bulkImport.ts) with a fake AI and a fake
// database: a 2,000-row trash-can spreadsheet, a 300-client free-text list
// (one AI answer cut off, one model down), duplicates, worker matching and
// batched saving. Contacts nothing real.
//   node scripts/e2e/bulk-import.mjs
import { build } from "esbuild";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const repo = path.resolve(".");
const out = path.join(os.tmpdir(), "bulk-import-" + Date.now() + ".mjs");
const stubs = {
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /^\.\/(supabase|api)$/ }, a => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, a => ({
      contents: a.path === "./api" ? "export const callModel = (...x) => globalThis.__callModel(...x); export const MODELS = {};" : "export const supabase = globalThis.__supabase;",
      loader: "js",
    }));
  },
};
await build({ entryPoints: [path.join(repo, "src/lib/bulkImport.ts")], bundle: true, format: "esm", platform: "neutral", outfile: out, logLevel: "error", plugins: [stubs], define: { "import.meta.env": "{}" } });

const inserts = { customers: 0, jobs: 0, jobBatches: 0 };
globalThis.__supabase = {
  from(table) {
    return {
      upsert(rows) { inserts.customers += rows.length; return Promise.resolve({ error: null }); },
      insert(rows) {
        const arr = Array.isArray(rows) ? rows : [rows];
        if (table === "jobs" && globalThis.__noCansColumn && arr.some(x => "cansCount" in x)) return { select: () => Promise.resolve({ data: null, error: { message: "Could not find the 'cansCount' column of 'jobs' in the schema cache" } }) };
        inserts[table] += arr.length; if (table === "jobs") inserts.jobBatches++;
        return { select: () => Promise.resolve({ data: arr.map(r => ({ id: r.id })), error: null }) };
      },
    };
  },
};
const mod = await import(pathToFileURL(out).href);
const r = {};
const employees = [{ id: "e1", firstName: "Mike", lastName: "Jones", status: "active" }, { id: "e2", firstName: "Sara", lastName: "Lee", status: "active" }];
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// 1. Big spreadsheet-style paste, no AI.
const header = "Customer Name\tPhone\tAddress\tCity\tPickup Day\tMonthly Price\tCans\tWorker\tNotes\tFrequency";
const lines = Array.from({ length: 2000 }, (_, i) => [`Client ${i}`, `(717) 555-${String(i).padStart(4, "0")}`, `${i} Oak St`, "York", days[i % 5], (25 + (i % 3) * 5).toFixed(2), String(1 + (i % 3)), i % 2 ? "Mike" : "sara lee", i % 7 ? "" : "Gate code 1234", i % 4 ? "weekly" : "every other week"].join("\t"));
let aiCalls = 0;
globalThis.__callModel = async () => { aiCalls++; throw new Error("AI should not be called for a table"); };
const t0 = Date.now();
const table = mod.readAsTable([header, ...lines].join("\n"));
r.tableDetected = !!table && table.data.length === 2000;
const recs = mod.recordsFromTable(table.headers, table.data);
const existing = [{ id: "x1", firstName: "Client", lastName: "5", phone: "7175550005", address: "", tags: [] }];
const plan = mod.buildImportPlan(recs, { customers: existing, employees, serviceCategory: "trash_can", costPerCan: 5 });
r.fastEnough = Date.now() - t0 < 5000;
r.noAiForTable = aiCalls === 0;
r.allRead = plan.totalRecords === 2000;
r.duplicateUpdatedNotAdded = plan.customers.added.length === 1999 && plan.customers.updated.length === 1;
r.jobsForEveryone = plan.jobs.length === 2000;
const j0 = plan.jobs.find(j => j.customerId === plan.customers.added.find(c => c.firstName === "Client" && c.lastName === "1").id);
r.weekdayRecurring = j0.isRecurring && j0.recurringMode === "weekdays" && j0.recurringWeekdays[0] === 2 && new Date(j0.scheduledDate + "T12:00:00").getDay() === 2;
r.biweeklyRead = plan.jobs.filter(j => j.recurringFreq === "biweekly").length === 500;
r.priceAndCans = j0.amount === 30 && j0.cansCount === 2;
r.workersMatched = plan.jobs.every(j => j.crew.length === 1) && plan.unmatchedWorkers.length === 0;
r.notesKept = plan.customers.added.filter(c => /Gate code/.test(c.notes || "")).length > 0;
r.existingJobOnExisting = plan.jobs.some(j => j.customerId === "x1");
const saved = await mod.runImportPlan(plan, { ownerId: "own1" });
r.savedInBatches = saved.customersSaved === 2000 && saved.jobsSaved === 2000 && inserts.jobBatches === 20;

// 1b. A database without the cansCount column (template / cleaning CRM):
// the column is dropped and the jobs still save, in batches.
globalThis.__noCansColumn = true; inserts.jobs = 0; inserts.jobBatches = 0;
const plan1b = mod.buildImportPlan(recs.slice(0, 250), { customers: [], employees, serviceCategory: "trash_can" });
const saved1b = await mod.runImportPlan(plan1b, { ownerId: "own1" });
r.missingColumnDropped = saved1b.jobsSaved === 250 && saved1b.jobsFailed === 0 && inserts.jobs === 250;
globalThis.__noCansColumn = false;
const generalPlan = mod.buildImportPlan(recs.slice(0, 3), { customers: [], employees });
r.generalJobsHaveNoCategory = generalPlan.jobs.every(j => !("serviceCategory" in j));

// 2. Free text, 300 clients → pieces; one answer cut off; first model down.
const free = Array.from({ length: 300 }, (_, i) => `${i % 2 ? "Mrs." : ""} Person${i} Example lives at ${i} Pine Rd, York PA. ${days[i % 5]}s, ${1 + (i % 2)} cans, $${20 + i % 4}/mo. ${i % 3 ? "" : "Dog in yard."} Done by ${i % 2 ? "Mike" : "Unknown Guy"}.`).join("\n");
const pieces = mod.chunkText(free);
r.splitIntoPieces = pieces.length > 5 && pieces.join("\n").split("\n").filter(Boolean).length === 300;
let modelACalls = 0, cutOff = false;
globalThis.__callModel = async ({ modelId, messages }) => {
  if (modelId === "a") { modelACalls++; throw new Error("Request to integrate.api.nvidia.com timed out."); }
  const piece = messages[0].content.split("Text:\n")[1];
  const objs = piece.split("\n").filter(Boolean).map(l => {
    const m = l.match(/Person(\d+) Example lives at (.+?)\. (\w+)s, (\d) cans, \$(\d+)\/mo\.(.*?)Done by (.+)\./);
    return { fullName: `Person${m[1]} Example`, address: m[2], weekday: m[3], cans: m[4], amount: m[5], notes: m[6].trim(), worker: m[7], frequency: "weekly" };
  });
  let text = JSON.stringify(objs);
  if (!cutOff) { cutOff = true; text = text.slice(0, text.length - 40); } // answer cut off mid-record
  return { text };
};
const ext = await mod.extractRecordsWithAI(free, ["a", "b"]);
r.failoverUsed = modelACalls <= 2 && ext.failedPieces === 0; // dead model skipped after its first failure (2 pieces run at once)
r.cutOffSalvaged = ext.records.length === 299;
const plan2 = mod.buildImportPlan(ext.records, { customers: [], employees, serviceCategory: "trash_can" });
r.unmatchedWorkerReported = plan2.unmatchedWorkers.includes("Unknown Guy") && plan2.warnings.some(w => /Unknown Guy/.test(w));

fs.rmSync(out, { force: true });
console.log(JSON.stringify(r, null, 1));
const ok = Object.values(r).every(Boolean);
console.log(ok ? "PASS" : "FAIL");
process.exit(ok ? 0 : 1);
