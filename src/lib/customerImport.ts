// Shared spreadsheet import: parsing, column detection, and turning rows into
// customers. Used by ImportDataModal (CSV file / Google Sheets / pasted text,
// for customers, expenses and personal transactions) and by onboarding.
//
// BUG FIX — "I imported my client list and it only brought in their names."
// The old importers split the file on newlines before handling quotes (a note
// with a line break inside it shredded the rest of the file), never stripped
// the byte-order mark Excel puts in front of the first header, only accepted
// a header that exactly equalled one hard-coded spelling ("email" matched but
// "Email Address 1", "Mobile Phone", "Phone 1 - Value", "Customer Email" did
// not), had nowhere to put company / city / state / zip / status, and silently
// threw away every column it didn't recognize. Now: a real CSV parser, header
// matching that understands common spellings from Excel, Google Contacts,
// Jobber, Markate, QuickBooks etc., address parts combined into one address,
// and any column it can't place kept as a custom field instead of dropped.
import { supabase } from "./supabase";
import { uid, today } from "./utils";

export type ImportFieldMap = Record<string, string[]>;
// A source column maps to one of the field map's keys, to a custom field
// (kept under its own header name), or is skipped.
export type ColumnTarget = string; // field key | "__custom__" | "__skip__"
export const CUSTOM = "__custom__";
export const SKIP = "__skip__";
export const customKey = (header: string) => `__custom__:${header}`;

// ── Parsing ────────────────────────────────────────────────────────────────

// RFC 4180 parser: quoted fields, "" escapes, commas/newlines inside quotes,
// CRLF or LF, a leading byte-order mark, and comma / semicolon / tab / pipe
// delimiters (detected from the first line).
export function parseDelimited(textRaw: string): string[][] {
  const text = textRaw.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const count = (d: string) => { let n = 0, q = false; for (const ch of firstLine) { if (ch === '"') q = !q; else if (ch === d && !q) n++; } return n; };
  const delim = [",", ";", "\t", "|"].map(d => [d, count(d)] as const).sort((a, b) => b[1] - a[1])[0];
  const D = delim[1] > 0 ? delim[0] : ",";
  const rows: string[][] = [];
  let row: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"' && field.trim() === "") { inQ = true; field = ""; }
    else if (ch === D) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some(c => c.trim() !== "")) rows.push(row);
  return rows.map(r => r.map(c => c.trim()));
}

export const normalizeHeader = (h: string) =>
  String(h || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Finds the header row: the first of the first few rows that has at least two
// filled cells and reads like labels (no emails, no long digit runs, short).
// Lets a title line ("Client List — Oct 2026") sit above the real headers.
export function splitHeader(rows: string[][]): { headers: string[]; data: string[][] } | null {
  for (let i = 0; i < Math.min(rows.length - 1, 5); i++) {
    const cells = rows[i];
    const filled = cells.filter(c => c !== "");
    if (filled.length < 2 && rows[i + 1]?.filter(c => c !== "").length > 1) continue;
    const labelLike = filled.every(c => c.length <= 40 && !/@/.test(c) && !/\d{5,}/.test(c));
    if (labelLike && filled.length >= 1) {
      const headers = cells.map((c, j) => c || `Column ${j + 1}`);
      return { headers, data: rows.slice(i + 1) };
    }
  }
  return null;
}

// ── Column detection ───────────────────────────────────────────────────────

// Word-boundary "contains" on normalized text ("phone 1 value" contains "phone").
const containsPhrase = (header: string, alias: string) => (` ${header} `).includes(` ${alias} `);

// Words too generic to match inside a longer header ("Last Visit Date" is
// not a last name, "Customer ID" is not a name) — exact matches only.
const EXACT_ONLY = new Set(["first", "last", "name", "customer", "client", "contact", "st", "tel", "type", "source", "status", "stage", "group", "label", "unit", "location", "business", "date"]);
const canContain = (a: string) => a.length >= 3 && !EXACT_ONLY.has(a);

// Picks a target for each header. Exact alias matches win; otherwise the
// first field (in fieldMap order — put specific fields like zip/city before
// generic ones like address/name) with an alias contained in the header.
export function autoMapColumns(headers: string[], fieldMap: ImportFieldMap, exclude: Record<string, RegExp> = {}): ColumnTarget[] {
  const keys = Object.keys(fieldMap);
  const norm = (a: string) => normalizeHeader(a);
  return headers.map(h => {
    const nh = normalizeHeader(h);
    if (!nh) return SKIP;
    for (const k of keys) if (fieldMap[k].some(a => norm(a) === nh) && !(exclude[k]?.test(nh))) return k;
    for (const k of keys) if (fieldMap[k].some(a => canContain(norm(a)) && containsPhrase(nh, norm(a))) && !(exclude[k]?.test(nh))) return k;
    return CUSTOM;
  });
}

// Turns parsed rows into flat records keyed by field key, using a column
// mapping. Several columns can share a target: the first non-empty value
// wins and the rest are kept as custom fields (e.g. "Phone 2"); notes are
// joined; tags are joined with commas.
export function applyMapping(headers: string[], data: string[][], mapping: ColumnTarget[]): Record<string, string>[] {
  return data.map(cells => {
    const out: Record<string, string> = {};
    headers.forEach((h, i) => {
      const v = (cells[i] ?? "").trim();
      const t = mapping[i];
      if (!v || !t || t === SKIP) return;
      if (t === CUSTOM) { out[customKey(h)] = v; return; }
      if (t === "notes" && out.notes) { out.notes += "\n" + v; return; }
      if (t === "tags" && out.tags) { out.tags += ", " + v; return; }
      if (out[t]) { out[customKey(h)] = v; return; }
      out[t] = v;
    });
    return out;
  }).filter(r => Object.keys(r).length > 0);
}

// ── Customers ──────────────────────────────────────────────────────────────

// Order matters: specific fields before generic ones (see autoMapColumns).
export const CUSTOMER_FIELD_MAP: ImportFieldMap = {
  firstName: ["first name", "firstname", "fname", "given name", "first", "contact first name", "customer first name", "client first name"],
  lastName: ["last name", "lastname", "lname", "surname", "family name", "last", "contact last name", "customer last name", "client last name"],
  email: ["email", "e mail", "email address", "primary email", "customer email", "contact email", "emails", "email 1 value"],
  phone: ["phone", "phone number", "mobile", "mobile phone", "mobile number", "cell", "cell phone", "telephone", "tel", "primary phone", "home phone", "work phone", "main phone", "contact phone", "customer phone", "phones", "phone 1 value"],
  zip: ["zip", "zip code", "zipcode", "postal code", "postal", "postcode", "post code"],
  city: ["city", "town", "locality"],
  state: ["state", "province", "region", "st", "state province"],
  address2: ["address 2", "address line 2", "address2", "street 2", "street address 2", "apt", "apartment", "suite", "unit"],
  company: ["company", "company name", "business", "business name", "organization", "organisation", "organization name", "employer"],
  gateCode: ["gate code", "gatecode", "access code", "door code", "lockbox", "lock box"],
  sqFootage: ["sq footage", "sqfootage", "sqft", "sq ft", "square feet", "square footage", "home size"],
  totalSpent: ["total spent", "totalspent", "lifetime value", "ltv", "revenue", "total revenue", "total sales", "lifetime spend"],
  leadSource: ["lead source", "leadsource", "source", "how found", "how did you hear", "how did you hear about us", "referral source", "marketing source", "channel"],
  status: ["status", "customer status", "lead status", "client status", "stage", "pipeline stage"],
  tags: ["tags", "tag", "labels", "label", "customer type", "client type", "type", "category", "group", "groups"],
  createdAt: ["created", "created at", "created date", "date created", "date added", "customer since", "client since", "signup date"],
  notes: ["notes", "note", "comments", "comment", "description", "customer notes", "client notes", "internal notes", "memo", "details", "remarks", "additional info"],
  address: ["address", "street", "street address", "address 1", "address line 1", "address1", "street 1", "property address", "service address", "billing address", "mailing address", "home address", "job address", "site address", "location"],
  fullName: ["name", "full name", "customer", "customer name", "client", "client name", "contact", "contact name", "display name", "homeowner", "homeowner name", "account name"],
};
// Headers that contain a field's word but mean something else.
export const CUSTOMER_FIELD_EXCLUDE: Record<string, RegExp> = {
  email: /\b(opt|subscribe|unsubscribe|bounced|verified|type|label)\b/,
  phone: /\b(opt|ext|extension|type|label)\b/,
  fullName: /\b(company|business|file|user|id|number|no|since|type|status|notes?)\b/,
  firstName: /\b(visit|service|job|date|seen)\b/,
  lastName: /\b(visit|service|job|date|seen|contacted|updated|modified|payment|invoice)\b/,
  address: /\b(email|ip|web|type|label)\b/,
  totalSpent: /\b(per|avg|average)\b/,
};

export const CUSTOMER_FIELD_LABELS: Record<string, string> = {
  firstName: "First name", lastName: "Last name", fullName: "Full name (split)", email: "Email", phone: "Phone",
  company: "Company", address: "Street address", address2: "Address line 2", city: "City", state: "State", zip: "Zip",
  notes: "Notes", leadSource: "Lead source", status: "Status", tags: "Tags", totalSpent: "Total spent",
  sqFootage: "Sq footage", gateCode: "Gate code", createdAt: "Customer since",
};

const LEAD_STATUS = /\b(lead|prospect|potential|inquiry|enquiry|quote|quoted|new lead|follow up)\b/i;
const titleCase = (s: string) => s.replace(/\s+/g, " ").trim().replace(/\b\w/g, c => c.toUpperCase());

// One flat import row (field keys + "__custom__:Header" keys) → a customer.
// Returns null when the row has nothing to identify a person by.
export function rowToCustomer(r: Record<string, string>): any | null {
  let firstName = (r.firstName || "").trim();
  let lastName = (r.lastName || "").trim();
  if (!firstName && !lastName && r.fullName) {
    const full = r.fullName.trim();
    if (full.includes(",")) { const [l, ...f] = full.split(","); lastName = l.trim(); firstName = f.join(",").trim(); }
    else { const parts = full.split(/\s+/); firstName = parts[0] || ""; lastName = parts.slice(1).join(" "); }
  } else if (r.fullName && !firstName && lastName) firstName = r.fullName;
  const email = (r.email || "").trim().toLowerCase();
  const phone = (r.phone || "").trim();
  const company = (r.company || "").trim();
  if (!firstName && !lastName) {
    if (company) firstName = company;
    else if (email) firstName = email.split("@")[0];
    else if (!phone) return null;
  }

  const street = [r.address, r.address2].map(s => (s || "").trim()).filter(Boolean).join(" ");
  const city = (r.city || "").trim(), state = (r.state || "").trim(), zip = (r.zip || "").trim();
  const cityLine = [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const address = [street, cityLine].filter(Boolean).join(", ");

  const tags = new Set<string>();
  (r.tags || "").split(/[,;|]/).map(t => t.trim()).filter(Boolean).forEach(t => tags.add(t));
  const status = (r.status || "").trim();
  if (status) tags.add(titleCase(status));

  const customFields: { key: string; value: string }[] = [];
  if (company) customFields.push({ key: "Company", value: company });
  for (const [k, v] of Object.entries(r)) if (k.startsWith("__custom__:") && v) customFields.push({ key: k.slice(11), value: v });

  let createdAt = today();
  if (r.createdAt) { const t = Date.parse(r.createdAt); if (!isNaN(t)) createdAt = new Date(t).toISOString().slice(0, 10); }

  const sq = Number(String(r.sqFootage || "").replace(/[^0-9.]/g, ""));
  const c: any = {
    id: uid(), firstName, lastName, email, phone, address,
    notes: (r.notes || "").trim(), leadSource: (r.leadSource || "").trim(),
    tags: Array.from(tags), totalSpent: Number(String(r.totalSpent || "").replace(/[^0-9.]/g, "")) || 0,
    gateCode: (r.gateCode || "").trim(), createdAt, customFields,
  };
  if (sq) c.sqFootage = sq;
  if (city) c.city = city;
  if (state) c.state = state;
  if (zip) c.zip = zip;
  if (company) c.company = company;
  if (status && LEAD_STATUS.test(status)) c.pipelineStage = "lead";
  return c;
}

const digits = (p?: string) => String(p || "").replace(/\D/g, "").slice(-10);
const nameKey = (c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().replace(/\s+/g, " ").trim();

// Fills an existing customer's blanks from an imported one (never overwrites
// what's already there), joins new notes, unions tags and custom fields.
function mergeInto(base: any, inc: any): any {
  const out = { ...base };
  for (const k of ["firstName", "lastName", "email", "phone", "address", "city", "state", "zip", "company", "leadSource", "gateCode", "sqFootage"]) {
    if (!out[k] && inc[k]) out[k] = inc[k];
  }
  if (inc.notes && !(out.notes || "").includes(inc.notes)) out.notes = out.notes ? `${out.notes}\n\n${inc.notes}` : inc.notes;
  out.tags = Array.from(new Set([...(out.tags || []), ...(inc.tags || [])]));
  const have = new Set((out.customFields || []).map((f: any) => f.key.toLowerCase()));
  out.customFields = [...(out.customFields || []), ...(inc.customFields || []).filter((f: any) => !have.has(f.key.toLowerCase()))];
  if ((inc.totalSpent || 0) > (out.totalSpent || 0)) out.totalSpent = inc.totalSpent;
  if (!out.pipelineStage && inc.pipelineStage) out.pipelineStage = inc.pipelineStage;
  return out;
}

export type MergeResult = { next: any[]; added: any[]; updated: any[]; skippedOverLimit: number };

// Adds imported customers to the existing list. A row matching an existing
// customer (same email, same phone, or same full name) updates that customer
// instead of creating a duplicate — so re-importing a richer file over a
// name-only import fills the blanks in. New customers stop at `limit`.
export function mergeImportedCustomers(existing: any[], incoming: any[], limit: number | null): MergeResult {
  const next = existing.slice();
  const byEmail = new Map<string, number>(), byPhone = new Map<string, number>(), byName = new Map<string, number>();
  const index = (c: any, i: number) => {
    if (c.email) byEmail.set(String(c.email).toLowerCase(), i);
    if (digits(c.phone).length >= 7) byPhone.set(digits(c.phone), i);
    if (nameKey(c)) byName.set(nameKey(c), i);
  };
  next.forEach(index);
  const addedIds = new Set<string>(), updatedIds = new Set<string>();
  let skippedOverLimit = 0;
  for (const inc of incoming) {
    let i = inc.email ? byEmail.get(inc.email) : undefined;
    if (i === undefined && digits(inc.phone).length >= 7) i = byPhone.get(digits(inc.phone));
    if (i === undefined && nameKey(inc)) {
      const j = byName.get(nameKey(inc));
      // Same name only counts as the same person when the contact details
      // don't contradict each other.
      if (j !== undefined) {
        const ex = next[j];
        const clash = (ex.email && inc.email && ex.email.toLowerCase() !== inc.email) || (digits(ex.phone) && digits(inc.phone) && digits(ex.phone) !== digits(inc.phone));
        if (!clash) i = j;
      }
    }
    if (i !== undefined) {
      next[i] = mergeInto(next[i], inc);
      if (!addedIds.has(next[i].id)) updatedIds.add(next[i].id);
      index(next[i], i);
      continue;
    }
    if (limit !== null && next.length >= limit) { skippedOverLimit++; continue; }
    next.push(inc);
    addedIds.add(inc.id);
    index(inc, next.length - 1);
  }
  return {
    next,
    added: next.filter(c => addedIds.has(c.id)),
    updated: next.filter(c => updatedIds.has(c.id)),
    skippedOverLimit,
  };
}

// ── Saving ─────────────────────────────────────────────────────────────────

// Upserts customers in chunks. PostgREST rejects a whole batch when one
// column doesn't exist in the database yet (e.g. city/state/zip/company
// before migration 0102) — drop just that column and retry, so everything
// else still saves. Returns how many rows saved and which columns were left
// out.
export async function saveCustomersTolerant(list: any[], ownerId?: string, onProgress?: (done: number, total: number) => void): Promise<{ saved: number; failed: number; droppedColumns: string[]; error?: string }> {
  const dropped = new Set<string>();
  let saved = 0, failed = 0, lastError = "";
  for (let s = 0; s < list.length; s += 500) {
    let chunk = list.slice(s, s + 500).map(c => (ownerId ? { ...c, owner_id: ownerId } : { ...c }));
    for (let attempt = 0; attempt < 12; attempt++) {
      chunk = chunk.map(c => { const x = { ...c }; dropped.forEach(d => delete x[d]); return x; });
      const { error } = await (supabase as any).from("customers").upsert(chunk, { onConflict: "id" });
      if (!error) { saved += chunk.length; break; }
      const m = String(error.message || "").match(/Could not find the '([^']+)' column/) || String(error.message || "").match(/column "?([A-Za-z_]+)"? of relation "customers" does not exist/);
      if (m && !dropped.has(m[1])) { dropped.add(m[1]); continue; }
      failed += chunk.length; lastError = error.message || "unknown error"; break;
    }
    onProgress?.(Math.min(s + 500, list.length), list.length);
  }
  return { saved, failed, droppedColumns: Array.from(dropped), error: lastError || undefined };
}
