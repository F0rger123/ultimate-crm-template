// Imports a client / job list that was TEXTED to Alfred (a CSV, a photo or
// PDF of a list, a Google Sheets link) — the texting version of the chat's
// prepare_import / run_import (src/lib/bulkImport.ts), sharing its reading
// and planning code (bulkImportCore.ts, attachmentReader.ts).
//
// BUG FIX (user report — files and PDF sheets texted to Alfred should be
// recognized and acted on). By text, Alfred could only read money documents
// (import_financial_document) and file things into a customer's documents —
// a texted client list did nothing useful. Now prepare_import_from_file
// reads the whole list, matches existing customers and workers, and saves a
// draft (owner_records kind "import_draft"); run_import saves it only after
// the owner replies yes.
import { SUPABASE_URL } from "./env";
import { recGet, recPut } from "./ownerRecords";
import { readAsTable, recordsFromTable, buildImportPlan, planSummary, chunkText, salvageJsonObjects, EXTRACT_PROMPT, type ImportPlan } from "../../../src/lib/bulkImportCore";
import { readAttachmentFully, LIST_KINDS, KIND_LABEL } from "../../../src/lib/attachmentReader";
import { fetchSheetCsv } from "./sheetCsv";

type Ctx = { authHeaders: Record<string, string>; ownerId: string | null; modelKeys?: Record<string, string>; turnStartedAt?: number; env?: Record<string, string> };

const toB64 = (buf: Uint8Array) => { let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return btoa(bin); };

// Sends a file (or nothing) plus a prompt to the first model that answers.
async function ask(keys: Record<string, string>, prompt: string, file?: { b64: string; mime: string }): Promise<string> {
  const isPdf = file?.mime === "application/pdf";
  const errors: string[] = [];
  if (keys.claude) {
    try {
      const content: any[] = file ? [isPdf ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.b64 } } : { type: "image", source: { type: "base64", media_type: file.mime, data: file.b64 } }, { type: "text", text: prompt }] : [{ type: "text", text: prompt }];
      const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": keys.claude, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 8000, messages: [{ role: "user", content }] }) });
      if (r.ok) { const d: any = await r.json(); return d.content?.find((b: any) => b.type === "text")?.text || ""; }
      errors.push("Claude " + r.status);
    } catch (e: any) { errors.push("Claude " + (e?.message || "failed")); }
  }
  if (keys.gemini) {
    try {
      const parts: any[] = file ? [{ inline_data: { mime_type: file.mime, data: file.b64 } }, { text: prompt }] : [{ text: prompt }];
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(keys.gemini)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { maxOutputTokens: 8000, thinkingConfig: { thinkingBudget: 0 } } }) });
      if (r.ok) { const d: any = await r.json(); return d.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || ""; }
      errors.push("Gemini " + r.status);
    } catch (e: any) { errors.push("Gemini " + (e?.message || "failed")); }
  }
  if (keys.openai && !isPdf) {
    try {
      const content: any[] = file ? [{ type: "image_url", image_url: { url: `data:${file.mime};base64,${file.b64}` } }, { type: "text", text: prompt }] : [{ type: "text", text: prompt }];
      const r = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${keys.openai}` }, body: JSON.stringify({ model: "gpt-4o", max_tokens: 8000, messages: [{ role: "user", content }] }) });
      if (r.ok) { const d: any = await r.json(); return d.choices?.[0]?.message?.content || ""; }
      errors.push("OpenAI " + r.status);
    } catch (e: any) { errors.push("OpenAI " + (e?.message || "failed")); }
  }
  throw new Error(errors.length ? "No model could read it (" + errors.join(", ") + ")" : `Reading ${file ? (isPdf ? "a PDF" : "a photo") : "a free-form list"} by text needs a Claude${isPdf ? "" : ", GPT-4o"} or Gemini key in Settings → AI Models.`);
}

const sb = async (ctx: Ctx, path: string, init: RequestInit = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...ctx.authHeaders, "Content-Type": "application/json", ...(init.headers || {}) } });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body };
};
const getAll = async (ctx: Ctx, path: string) => {
  const out: any[] = [];
  for (let from = 0; from < 50000; from += 1000) {
    const r = await sb(ctx, `${path}&offset=${from}&limit=1000`);
    if (!r.ok || !Array.isArray(r.body)) break;
    out.push(...r.body);
    if (r.body.length < 1000) break;
  }
  return out;
};

// Inserts/upserts rows 100–500 at a time, dropping columns the table doesn't
// have (same idea as saveCustomersTolerant / insertJobsTolerant).
async function writeTolerant(ctx: Ctx, table: string, rows: any[], mode: "upsert" | "insert"): Promise<{ saved: number; failed: number; error?: string }> {
  const dropped = new Set<string>();
  const size = mode === "upsert" ? 500 : 100;
  let saved = 0, failed = 0, error = "";
  for (let i = 0; i < rows.length; i += size) {
    let chunk = rows.slice(i, i + size);
    for (let attempt = 0; attempt < 12; attempt++) {
      chunk = chunk.map(r => { const x = { ...r }; dropped.forEach(d => delete x[d]); return x; });
      const r = await sb(ctx, `${table}${mode === "upsert" ? "?on_conflict=id" : ""}`, { method: "POST", headers: { Prefer: (mode === "upsert" ? "resolution=merge-duplicates," : "") + "return=minimal" }, body: JSON.stringify(chunk) });
      if (r.ok) { saved += chunk.length; break; }
      const msg = String(r.body?.message || "");
      const col = (msg.match(/Could not find the '([^']+)' column/) || msg.match(/column "?([A-Za-z_]+)"? of relation/) || [])[1];
      if (col && !dropped.has(col)) { dropped.add(col); continue; }
      failed += chunk.length; error = msg || `HTTP ${r.status}`; break;
    }
  }
  return { saved, failed, error: error || undefined };
}

export async function prepareImportFromFile(ctx: Ctx, input: { fileUrl?: string; fileType?: string; sheetUrl?: string; text?: string; serviceCategory?: string; createJobs?: boolean }): Promise<any> {
  if (!ctx.ownerId) return { error: "Can't tell which business this is." };
  const keys = ctx.modelKeys || {};
  let records: any[] = [];
  let how = "";
  if (input.sheetUrl) {
    const sheet = await fetchSheetCsv(ctx.env || {}, ctx.ownerId, input.sheetUrl);
    if ("error" in sheet) return { error: sheet.error };
    input = { ...input, text: sheet.csv };
  }
  if (input.fileUrl) {
    if (!/^https:\/\//.test(input.fileUrl)) return { error: "fileUrl must be the https url from the attached-file line." };
    const res = await fetch(input.fileUrl).catch(() => null);
    if (!res?.ok) return { error: "Couldn't download that file." };
    const mime = (input.fileType || res.headers.get("content-type") || "").split(";")[0].toLowerCase();
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return { error: "That file is over 15 MB — send it in parts, or import it in the CRM's Alfred chat." };
    if (/csv|tab-separated|text\/plain|vcard/.test(mime) || /\.(csv|tsv|txt)(\?|$)/i.test(input.fileUrl)) {
      input = { ...input, text: new TextDecoder().decode(buf) };
    } else if (/spreadsheetml|excel/.test(mime)) {
      return { error: "Excel files can't be read by text yet — save it as CSV and text that, share it as a Google Sheets link, or attach it in the CRM's Alfred chat." };
    } else if (mime.startsWith("image/") || mime === "application/pdf") {
      const file = { b64: toB64(buf), mime: mime || "image/jpeg" };
      const read = await readAttachmentFully(p => ask(keys, p, file), "service");
      if (!LIST_KINDS.includes(read.header.kind)) return { notAList: true, kind: read.header.kind, what: KIND_LABEL[read.header.kind], content: read.body.slice(0, 6000), next: read.header.kind === "receipt" || read.header.kind === "bill_or_statement" ? "This is a money document — use import_financial_document." : "This isn't a client/job list — handle it some other way (attach_file_to_customer, answer about it, or ask the owner)." };
      const table = readAsTable(read.body);
      if (!table) return { error: "Read the list but couldn't line up its columns — ask the owner to send it as a spreadsheet/CSV or a Google Sheets link." };
      records = recordsFromTable(table.headers, table.data);
      how = `read from the ${mime === "application/pdf" ? "PDF" : "photo"} (${records.length} rows${read.complete ? "" : ", the file was very long — some rows at the end may be missing"})`;
    } else return { error: `Can't import a ${mime || "file of that type"}.` };
  }
  if (!records.length && input.text) {
    const table = readAsTable(input.text);
    if (table) { records = recordsFromTable(table.headers, table.data); how = `read as a table (${records.length} rows)`; }
    else {
      for (const piece of chunkText(input.text)) records.push(...salvageJsonObjects(await ask(keys, EXTRACT_PROMPT(piece))));
      how = `read with AI (${records.length} records)`;
    }
  }
  if (!records.length) return { error: "Couldn't find any customers in that." };
  const [customers, employees] = await Promise.all([
    getAll(ctx, `customers?select=*&owner_id=eq.${encodeURIComponent(ctx.ownerId)}`),
    getAll(ctx, `employees?select=id,firstName,lastName,status&owner_id=eq.${encodeURIComponent(ctx.ownerId)}`),
  ]);
  const plan = buildImportPlan(records, { customers, employees, serviceCategory: input.serviceCategory === "trash_can" ? "trash_can" : "general", createJobs: input.createJobs !== false });
  // The full customer list isn't needed to save — keep the draft small.
  const draft = { id: plan.id, createdAt: plan.createdAt, serviceCategory: plan.serviceCategory, added: plan.customers.added, updated: plan.customers.updated, jobs: plan.jobs, warnings: plan.warnings, totalRecords: plan.totalRecords, status: "draft" };
  const saved = await recPut(ctx.authHeaders, ctx.ownerId, "import_draft", draft);
  if (!saved.ok) return { error: "Couldn't save the import draft — " + (saved.error || "unknown error") };
  return { success: true, how, ...planSummary(plan), next: "NOTHING is saved yet. Text the owner the counts, warnings and 2-3 sample names, and ask them to reply YES to import. Call run_import with this planId only after they reply." };
}

export async function runTextImport(ctx: Ctx, planId?: string): Promise<any> {
  if (!ctx.ownerId) return { error: "Can't tell which business this is." };
  let draft: any = planId ? await recGet(ctx.authHeaders, ctx.ownerId, "import_draft", planId) : null;
  if (!draft) {
    // The model often doesn't carry the id across texts — use the latest draft.
    const r = await sb(ctx, `owner_records?owner_id=eq.${encodeURIComponent(ctx.ownerId)}&kind=eq.import_draft&deleted_at=is.null&select=id,data&order=updated_at.desc&limit=1`);
    draft = Array.isArray(r.body) && r.body[0] ? { ...r.body[0].data, id: r.body[0].id } : null;
  }
  if (!draft || draft.status !== "draft") return { error: "There's no import waiting — send the list again." };
  if (Number(draft.createdAt) >= (ctx.turnStartedAt || 0)) return { error: "Refused: the owner hasn't seen this summary yet. Text it and wait for their YES." };
  const ownerId = ctx.ownerId;
  const custRows = [...(draft.added || []), ...(draft.updated || [])].map((c: any) => ({ ...c, owner_id: ownerId }));
  const c = await writeTolerant(ctx, "customers", custRows, "upsert");
  const newIds = new Set((draft.added || []).map((x: any) => x.id));
  const jobs = (c.failed ? (draft.jobs || []).filter((j: any) => !newIds.has(j.customerId)) : (draft.jobs || [])).map((j: any) => ({ ...j, owner_id: ownerId }));
  const j = await writeTolerant(ctx, "jobs", jobs, "insert");
  await recPut(ctx.authHeaders, ownerId, "import_draft", { ...draft, status: "done", result: { customers: c.saved, jobs: j.saved }, finishedAt: new Date().toISOString() }, true);
  return { success: !c.failed && !j.failed, customersSaved: c.saved, customersFailed: c.failed, jobsSaved: j.saved, jobsFailed: j.failed, errors: [c.error, j.error].filter(Boolean) };
}

export type { ImportPlan };
