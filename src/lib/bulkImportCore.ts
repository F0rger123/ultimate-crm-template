// Browser-free half of bulkImport.ts (reading lists, planning an import).
// Also used by Cloudflare Functions for imports sent by text, so nothing
// here may import the Supabase client or the browser AI helper.
import { parseDelimited, splitHeader, autoMapColumns, applyMapping, rowToCustomer, mergeImportedCustomers, CUSTOMER_FIELD_MAP, CUSTOMER_FIELD_EXCLUDE, parseDateLoose, normalizeHeader } from "./importCore";
// Local copies (utils.ts pulls in the browser Supabase client).
const uid = (): string => (typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const today = (): string => new Date().toISOString().slice(0, 10);
const recurringFreqs = [{ key: "weekly" }, { key: "biweekly" }, { key: "monthly" }, { key: "quarterly" }, { key: "biannual" }, { key: "annual" }];

// One imported line: a customer, and (when it has any schedule/price) a job.
export type ImportRecord = {
  fullName?: string; firstName?: string; lastName?: string; company?: string;
  phone?: string; email?: string; address?: string; city?: string; state?: string; zip?: string;
  notes?: string; gateCode?: string;
  amount?: string; frequency?: string; weekday?: string; scheduledDate?: string; scheduledTime?: string;
  cans?: string; worker?: string; service?: string;
};

// Job / schedule columns, on top of the customer columns customerImport.ts knows.
const JOB_FIELD_MAP: Record<string, string[]> = {
  amount: ["price", "amount", "rate", "cost", "fee", "charge", "monthly price", "monthly rate", "price per month", "what they pay", "pays", "payment", "dollar amount", "$", "total", "invoice amount", "job price"],
  frequency: ["frequency", "freq", "how often", "schedule", "service frequency", "plan", "recurrence", "interval", "cleaning frequency"],
  weekday: ["day", "service day", "pickup day", "trash day", "weekday", "day of week", "route day", "cleaning day", "collection day"],
  scheduledDate: ["date", "next date", "next service", "next service date", "service date", "start date", "first service", "scheduled", "scheduled date", "next cleaning", "appointment", "appointment date"],
  scheduledTime: ["time", "start time", "service time", "appointment time", "scheduled time", "arrival time"],
  cans: ["cans", "can count", "number of cans", "# cans", "bins", "number of bins", "trash cans", "qty", "quantity"],
  worker: ["worker", "employee", "tech", "technician", "crew", "assigned to", "assigned", "cleaner", "who", "staff", "team member", "rep"],
  service: ["service", "service type", "job type", "work type", "services"],
};
const JOB_FIELD_KEYS = Object.keys(JOB_FIELD_MAP);

// ── Reading the list ─────────────────────────────────────────────────────

// A paste counts as a table when most lines split into the same number of
// columns (2+) and there's a header row that names known fields.
export function readAsTable(text: string): { headers: string[]; data: string[][] } | null {
  const rows = parseDelimited(text).filter(r => r.some(c => c.trim()));
  if (rows.length < 2) return null;
  const width = rows[0].length;
  if (width < 2) return null;
  const sameWidth = rows.filter(r => Math.abs(r.length - width) <= 1).length;
  if (sameWidth / rows.length < 0.8) return null;
  const split = splitHeader(rows);
  if (!split) return null;
  const known = mapColumns(split.headers).filter(t => !t.startsWith("__")).length;
  return known >= 2 ? split : null;
}

const mapColumns = (headers: string[]): string[] => {
  const cust = autoMapColumns(headers, CUSTOMER_FIELD_MAP as any, CUSTOMER_FIELD_EXCLUDE);
  const job = autoMapColumns(headers, JOB_FIELD_MAP as any, {});
  // A job column beats the generic customer guess ("notes", "tags", custom);
  // a specific customer field (phone, address…) keeps its customer meaning.
  const generic = new Set(["__custom__", "__skip__", "tags", "notes", "status", "totalSpent", "createdAt"]);
  return headers.map((h, i) => {
    const nh = normalizeHeader(h);
    if (job[i] && !job[i].startsWith("__") && (generic.has(cust[i]) || (job[i] === "scheduledDate" && cust[i] === "createdAt") || (job[i] === "amount" && cust[i] === "totalSpent"))) return job[i];
    if (nh === "day") return "weekday";
    return cust[i];
  });
};

// Header → the field it's read as (for the summary shown to the owner).
export const describeColumns = (headers: string[], overrides: Record<string, string> = {}): Record<string, string> =>
  Object.fromEntries(mapColumns(headers).map((t, i) => [headers[i], overrides[headers[i]] || (t.startsWith("__custom__") ? "notes (kept as extra info)" : t === "__skip__" ? "skipped" : t)]));

export function recordsFromTable(headers: string[], data: string[][], overrides: Record<string, string> = {}): ImportRecord[] {
  const mapping = mapColumns(headers).map((t, i) => overrides[headers[i]] || t);
  return applyMapping(headers, data, mapping as any).map(r => {
    const rec: any = {};
    const extra: string[] = [];
    for (const [k, v] of Object.entries(r)) {
      if (k.startsWith("__custom__:")) extra.push(`${k.slice(11)}: ${v}`);
      else rec[k] = v;
    }
    if (extra.length) rec.notes = [rec.notes, ...extra].filter(Boolean).join("\n");
    return rec as ImportRecord;
  });
}

// Keeps every complete {...} object from a JSON array answer, even when the
// answer was cut off before the closing ].
export function salvageJsonObjects(text: string): any[] {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  try { const v = JSON.parse(clean); if (Array.isArray(v)) return v; if (Array.isArray(v?.records)) return v.records; } catch { /* fall through */ }
  const out: any[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && start >= 0) { try { out.push(JSON.parse(clean.slice(start, i + 1))); } catch { /* skip */ } start = -1; } }
  }
  return out;
}

// Splits free text into pieces of about `size` characters on line breaks
// (blank lines preferred), never cutting a record's line in half.
export function chunkText(text: string, size = 3500): string[] {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  const pieces: string[] = [];
  let cur = "";
  const push = () => { if (cur.trim()) pieces.push(cur.trim()); cur = ""; };
  for (const b of blocks) {
    if (b.length > size) {
      push();
      let part = "";
      for (const line of b.split("\n")) {
        if (part.length + line.length + 1 > size && part) { pieces.push(part.trim()); part = ""; }
        part += line + "\n";
      }
      if (part.trim()) pieces.push(part.trim());
      continue;
    }
    if (cur.length + b.length + 2 > size) push();
    cur += b + "\n\n";
  }
  push();
  return pieces;
}

export const EXTRACT_PROMPT = (piece: string) => `Extract every customer/client record from the text below. The text is one piece of a longer list from a service business: names, phone numbers, emails, addresses, service schedules, dates, times, prices, quantities, who does the job, notes. Any format.

Today's date is ${today()} (YYYY-MM-DD). Resolve relative or partial dates against it.

Return ONLY a JSON array, no other text and no markdown fences. One object per customer, these keys only, "" for anything not given (never invent a value):
[{"fullName":"","company":"","phone":"","email":"","address":"street, city, state zip","notes":"special instructions, gate codes, anything else about them","amount":"price per visit, digits and . only","frequency":"weekly|biweekly|monthly|quarterly|one_time or what the text says","weekday":"Monday..Sunday if a regular service day is given","scheduledDate":"YYYY-MM-DD of the next/first service if given","scheduledTime":"HH:MM 24h if given","cans":"number of units (bins, items…) if given","worker":"name of the person who does this job if given","service":"what service, if given"}]

Text:
${piece}`;

// ── Planning ─────────────────────────────────────────────────────────────

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
export const parseWeekday = (s?: string): number | null => {
  const v = String(s || "").trim().toLowerCase();
  if (!v) return null;
  const i = WEEKDAYS.findIndex(d => v.startsWith(d.slice(0, 3)));
  return i >= 0 ? i : null;
};
const nextWeekdayDate = (wd: number, from = new Date()) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const add = (wd - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + add);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const parseFrequency = (s?: string): string | null => {
  const v = String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ");
  if (!v.trim()) return null;
  if (/one ?time|once|single|one off/.test(v)) return "one_time";
  if (/bi ?weekly|every (other|2|two) weeks?|fortnight/.test(v)) return "biweekly";
  if (/semi ?monthly|twice a month|2x month/.test(v)) return "biweekly";
  if (/weekly|every week|each week|per week|1x week/.test(v)) return "weekly";
  if (/quarter|every 3 months|every three months/.test(v)) return "quarterly";
  if (/bi ?annual|semi ?annual|twice a year|every 6 months|every six months/.test(v)) return "biannual";
  if (/annual|yearly|every year|once a year/.test(v)) return "annual";
  if (/monthly|every month|per month|each month|1x month|a month/.test(v)) return "monthly";
  return recurringFreqs.some(f => f.key === v.trim()) ? v.trim() : null;
};
const parseTime = (s?: string): string => {
  const v = String(s || "").trim().toLowerCase();
  const m = v.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/);
  if (!m) return "";
  let h = Number(m[1]); const min = m[2] || "00";
  if (m[3]?.startsWith("p") && h < 12) h += 12;
  if (m[3]?.startsWith("a") && h === 12) h = 0;
  return h < 24 ? `${String(h).padStart(2, "0")}:${min}` : "";
};
const money = (s?: string) => { const n = Number(String(s || "").replace(/[^0-9.]/g, "")); return Number.isFinite(n) ? n : 0; };

const nameOf = (e: any) => `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.name || "";
export function matchEmployee(name: string | undefined, employees: any[]): any | null {
  const v = String(name || "").trim().toLowerCase();
  if (!v) return null;
  const people = employees.filter((e: any) => e.status !== "inactive" && e.status !== "removed");
  return people.find((e: any) => nameOf(e).toLowerCase() === v)
    || people.find((e: any) => (e.firstName || "").toLowerCase() === v)
    || people.find((e: any) => nameOf(e).toLowerCase().startsWith(v) || v.startsWith(nameOf(e).toLowerCase()))
    || people.find((e: any) => v.split(/\s+/)[0] === (e.firstName || "").toLowerCase())
    || null;
}

export type ImportPlan = {
  id: string; createdAt: number; serviceCategory: string;
  customers: { next: any[]; added: any[]; updated: any[] };
  jobs: any[];
  warnings: string[];
  unmatchedWorkers: string[];
  totalRecords: number;
};

export function buildImportPlan(records: ImportRecord[], ctx: { customers: any[]; employees: any[]; serviceCategory?: string; costPerCan?: number; createJobs?: boolean; limit?: number | null }): ImportPlan {
  const serviceCategory = ctx.serviceCategory || "general";
  const asCustomers: any[] = [];
  const jobSpecs: { cust: any; rec: ImportRecord }[] = [];
  let noName = 0;
  for (const rec of records) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) if (v != null && String(v).trim()) flat[k] = String(v).trim();
    const c = rowToCustomer(flat);
    if (!c) { noName++; continue; }
    if (serviceCategory === "trash_can") c.tags = Array.from(new Set([...(c.tags || []), "Trash Cans"]));
    asCustomers.push(c);
    const hasJob = !!(flat.amount || flat.frequency || flat.weekday || flat.scheduledDate || flat.scheduledTime || flat.cans || flat.worker || flat.service);
    if (ctx.createJobs !== false && (hasJob || serviceCategory === "trash_can")) jobSpecs.push({ cust: c, rec });
  }
  const merged = mergeImportedCustomers(ctx.customers, asCustomers, ctx.limit ?? null);
  // Imported row → the customer it ended up as (new, or the existing match).
  const finalFor = (c: any) => {
    const d = (p?: string) => String(p || "").replace(/\D/g, "").slice(-10);
    const nk = (x: any) => `${x.firstName || ""} ${x.lastName || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
    return merged.next.find((x: any) => x.id === c.id)
      || (c.email && merged.next.find((x: any) => (x.email || "").toLowerCase() === c.email))
      || (d(c.phone).length === 10 && merged.next.find((x: any) => d(x.phone) === d(c.phone)))
      || merged.next.find((x: any) => nk(x) && nk(x) === nk(c))
      || null;
  };
  const unmatched = new Set<string>();
  const jobs: any[] = [];
  for (const { cust, rec } of jobSpecs) {
    const target = finalFor(cust);
    if (!target) continue;
    const freq = parseFrequency(rec.frequency) || (serviceCategory === "trash_can" && !rec.scheduledDate ? "weekly" : null);
    const wd = parseWeekday(rec.weekday);
    let date = rec.scheduledDate ? parseDateLoose(rec.scheduledDate) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = wd != null ? nextWeekdayDate(wd) : today();
    const emp = matchEmployee(rec.worker, ctx.employees);
    if (rec.worker && !emp) unmatched.add(String(rec.worker).trim());
    const cans = Math.max(0, Math.round(money(rec.cans)));
    const amount = money(rec.amount) || (serviceCategory === "trash_can" && cans && ctx.costPerCan ? cans * ctx.costPerCan : 0);
    const job: any = {
      id: uid(), customerId: target.id, address: target.address || cust.address || "", amount,
      status: "scheduled", scheduledDate: date, scheduledTime: parseTime(rec.scheduledTime), priority: "normal",
      ...(serviceCategory !== "general" ? { serviceCategory } : {}), crew: emp ? [emp.id] : [], ...(emp ? { crewAssignedAt: { [emp.id]: Date.now() } } : {}),
      checklist: [], photos: [], commLog: [], chemicalsUsed: [], equipment: [], tags: [],
      loggedHours: 0, createdAt: today(), notes: [rec.service ? `Service: ${rec.service}` : "", rec.notes || ""].filter(Boolean).join("\n"),
      ...(serviceCategory === "trash_can" ? { cansCount: Math.max(1, cans || 1) } : {}),
    };
    if (freq && freq !== "one_time") {
      Object.assign(job, wd != null
        ? { isRecurring: true, recurringMode: freq === "weekly" ? "weekdays" : "preset", recurringFreq: freq, ...(freq === "weekly" ? { recurringWeekdays: [wd], recurringInterval: 1 } : {}) }
        : { isRecurring: true, recurringMode: "preset", recurringFreq: freq });
    }
    jobs.push(job);
  }
  const warnings: string[] = [];
  if (noName) warnings.push(`${noName} line(s) had no name, phone or email and were skipped.`);
  const noAddr = merged.added.filter((c: any) => !c.address).length;
  if (noAddr) warnings.push(`${noAddr} new customer(s) have no address.`);
  if (merged.skippedOverLimit) warnings.push(`${merged.skippedOverLimit} customer(s) are over the plan's customer limit and won't be added.`);
  if (unmatched.size) warnings.push(`No employee matches: ${Array.from(unmatched).slice(0, 8).join(", ")}${unmatched.size > 8 ? "…" : ""} — those jobs are left unassigned.`);
  return { id: "IMP-" + uid().slice(0, 8), createdAt: Date.now(), serviceCategory, customers: merged, jobs, warnings, unmatchedWorkers: Array.from(unmatched), totalRecords: records.length };
}

export const planSummary = (p: ImportPlan) => ({
  planId: p.id,
  recordsRead: p.totalRecords,
  newCustomers: p.customers.added.length,
  existingCustomersUpdated: p.customers.updated.length,
  jobsToCreate: p.jobs.length,
  recurringJobs: p.jobs.filter(j => j.isRecurring).length,
  jobsWithWorker: p.jobs.filter(j => j.crew?.length).length,
  totalValuePerVisit: Math.round(p.jobs.reduce((s, j) => s + (Number(j.amount) || 0), 0) * 100) / 100,
  warnings: p.warnings,
  sample: p.customers.added.slice(0, 5).map((c: any) => {
    const j = p.jobs.find(x => x.customerId === c.id);
    return { name: `${c.firstName} ${c.lastName}`.trim(), phone: c.phone, address: c.address, job: j ? { date: j.scheduledDate, time: j.scheduledTime || undefined, price: j.amount, repeats: j.recurringFreq || "no", worker: j.crew?.length ? "assigned" : "none" } : null };
  }),
});
