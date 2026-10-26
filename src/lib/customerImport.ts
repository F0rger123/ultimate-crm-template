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
// Everything except saving lives in importCore.ts (no browser imports there).
export * from "./importCore";

// Upserts customers in chunks. PostgREST rejects a whole batch when one
// column doesn't exist in the database yet (e.g. city/state/zip/company
// before migration 0002) — drop just that column and retry, so everything
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
