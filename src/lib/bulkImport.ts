// Bulk import of customers + their jobs/schedules from a big list — used by
// Alfred (prepare_import / run_import) and the "Bulk Job Import" paste box.
//
// BUG FIX (a huge client list with schedules,
// calendar entries, addresses, notes, dollar amounts and who works each job
// was too much for Alfred). The whole list used to go to the AI in one request and come
// back as one JSON answer capped at 4,000 tokens: a long list was cut off
// mid-answer (invalid JSON → nothing imported) or the request timed out,
// and schedules / workers / times were never even asked for. Now:
//   - A list that is already a table (CSV, spreadsheet, tab- or comma-
//     separated paste) is read here, column by column, with no AI at all.
//   - Free-form text goes to the AI in small pieces (a few dozen lines at a
//     time), each retried on the next model if one fails, and a cut-off
//     answer keeps every record that did come back complete.
//   - Workers are matched to employees by name, existing customers by
//     phone / email / name (so re-importing doesn't duplicate anyone), and
//     everything is saved in batches.
import { callModel } from "./api";
import { supabase } from "./supabase";
import { saveCustomersTolerant } from "./customerImport";
import { chunkText, salvageJsonObjects, EXTRACT_PROMPT, type ImportRecord, type ImportPlan } from "./bulkImportCore";
// Reading and planning live in bulkImportCore.ts (no browser imports there).
export * from "./bulkImportCore";

// Free text → records, a piece at a time. `modelIds` is the failover chain.
export async function extractRecordsWithAI(text: string, modelIds: string[], opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {}): Promise<{ records: ImportRecord[]; failedPieces: number; pieces: number }> {
  if (!modelIds.length) throw new Error("No AI model is set up to read free-form text — add one in Settings → AI Models, or paste/attach the list as a spreadsheet (CSV/Excel) so it can be read without AI.");
  const pieces = chunkText(text);
  const results: ImportRecord[][] = new Array(pieces.length);
  let failed = 0, done = 0, next = 0;
  // A model that fails once (down, timing out, out of credit) is skipped for
  // the rest of this list instead of costing a full timeout on every piece.
  const dead = new Set<string>();
  const worker = async () => {
    while (next < pieces.length) {
      const i = next++;
      let got: any[] | null = null;
      for (const modelId of modelIds) {
        if (opts.signal?.aborted) throw new Error("Stopped");
        if (dead.has(modelId) && modelIds.some(m => !dead.has(m))) continue;
        try {
          const res = await callModel({ modelId, messages: [{ role: "user", content: EXTRACT_PROMPT(pieces[i]) }], maxTokens: 8000, signal: opts.signal });
          const arr = salvageJsonObjects(res.text || "");
          if (arr.length || !/\S/.test(pieces[i])) { got = arr; break; }
        } catch (e: any) {
          if (opts.signal?.aborted) throw e;
          console.warn("[bulkImport] piece", i + 1, "failed on", modelId, "—", e?.message);
          dead.add(modelId);
        }
      }
      if (!got) failed++;
      results[i] = (got || []) as ImportRecord[];
      opts.onProgress?.(++done, pieces.length);
    }
  };
  await Promise.all([worker(), worker()]);
  return { records: results.flat(), failedPieces: failed, pieces: pieces.length };
}

// ── Saving ───────────────────────────────────────────────────────────────

// Inserts jobs 100 at a time. A column this database doesn't have (e.g.
// serviceCategory / cansCount on some databases) is dropped and the batch
// retried, like saveCustomersTolerant; any other failure retries that batch
// one job at a time so one bad row doesn't sink the other 99.
export async function insertJobsTolerant(rows: any[], onProgress?: (done: number, total: number) => void): Promise<{ saved: number; failed: number; errors: string[]; droppedColumns: string[] }> {
  const dropped = new Set<string>();
  const errors: string[] = [];
  let saved = 0, failed = 0;
  const strip = (r: any) => { const x = { ...r }; dropped.forEach(d => delete x[d]); return x; };
  const missingColumn = (msg: string) => (msg.match(/Could not find the '([^']+)' column/) || msg.match(/column "?([A-Za-z_]+)"? of relation "jobs" does not exist/) || [])[1];
  for (let i = 0; i < rows.length; i += 100) {
    let chunk = rows.slice(i, i + 100);
    let done = false;
    for (let attempt = 0; attempt < 12 && !done; attempt++) {
      chunk = chunk.map(strip);
      const { data, error } = await (supabase as any).from("jobs").insert(chunk).select("id");
      if (!error) { saved += data?.length || 0; done = true; break; }
      const col = missingColumn(String(error.message || ""));
      if (col && !dropped.has(col)) { dropped.add(col); continue; }
      for (const one of chunk) {
        const r = await (supabase as any).from("jobs").insert(strip(one)).select("id");
        if (r.error || !r.data?.length) { failed++; if (errors.length < 5) errors.push("Job: " + (r.error?.message || "not saved")); }
        else saved++;
      }
      done = true;
    }
    onProgress?.(Math.min(i + 100, rows.length), rows.length);
  }
  return { saved, failed, errors, droppedColumns: Array.from(dropped) };
}

export async function runImportPlan(p: ImportPlan, opts: { ownerId: string; onProgress?: (label: string, done: number, total: number) => void }): Promise<{ customersSaved: number; customersFailed: number; jobsSaved: number; jobsFailed: number; errors: string[] }> {
  const errors: string[] = [];
  const toSave = [...p.customers.added, ...p.customers.updated];
  const c = await saveCustomersTolerant(toSave, opts.ownerId, (d, t) => opts.onProgress?.("customers", d, t));
  if (c.error) errors.push("Customers: " + c.error);
  let jobsSaved = 0, jobsFailed = 0;
  // If some customers didn't save, only make jobs for customers that already
  // existed — never a job pointing at a customer that isn't there.
  const newIds = new Set(p.customers.added.map((x: any) => x.id));
  const jobs = c.failed === 0 ? p.jobs : p.jobs.filter(j => !newIds.has(j.customerId));
  if (jobs.length < p.jobs.length) errors.push(`${p.jobs.length - jobs.length} job(s) not created because their new customer didn't save — run the import again after fixing the error above (existing customers aren't duplicated).`);
  const j = await insertJobsTolerant(jobs.map(x => ({ ...x, owner_id: opts.ownerId })), (d, t) => opts.onProgress?.("jobs", d, t));
  jobsSaved = j.saved; jobsFailed = j.failed; errors.push(...j.errors);
  return { customersSaved: c.saved, customersFailed: c.failed, jobsSaved, jobsFailed, errors };
}
