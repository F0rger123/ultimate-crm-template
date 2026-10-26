// Bulk reads and deletes that work at any size.
//
// BUG FIX — "I deleted ~1,000 customers and they came back." Two limits:
//  1. A bulk delete sent every id in one request (`id=in.(…)`). A thousand
//     ids is a ~37 KB URL — far past what the server accepts — so the
//     delete failed outright; the rows only disappeared on this screen and
//     reappeared on the next refresh.
//  2. Supabase returns at most 1,000 rows per request, so with more than
//     1,000 customers/jobs/invoices the app only ever saw the first 1,000.
//     Rows past that looked "missing on the server", which confused the
//     sync logic in both directions.
import { supabase } from "./supabase";

const DELETE_CHUNK = 100;

// Deletes rows by id in small batches and reports how many the server
// actually removed (RLS can silently match zero rows — see CLAUDE.md).
export async function deleteByIds(table: string, ids: string[], extraEq?: Record<string, string>): Promise<{ deleted: string[]; failed: number; error?: string }> {
  const deleted: string[] = [];
  let error = "";
  for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
    const chunk = ids.slice(i, i + DELETE_CHUNK);
    let q = (supabase as any).from(table).delete().in("id", chunk);
    for (const [k, v] of Object.entries(extraEq || {})) q = q.eq(k, v);
    const { data, error: err } = await q.select("id");
    if (err) { error = err.message || String(err); continue; }
    (data || []).forEach((r: any) => deleted.push(r.id));
  }
  return { deleted, failed: ids.length - deleted.length, error: error || undefined };
}

// Reads every row for an owner, 1,000 at a time (the server's page cap).
export async function fetchAllRows(table: string, select: string, ownerId: string): Promise<{ data: any[] | null; error: any }> {
  const PAGE = 1000;
  const all: any[] = [];
  for (let from = 0; from < 200000; from += PAGE) {
    const { data, error } = await (supabase as any).from(table).select(select).eq("owner_id", ownerId).order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) return { data: null, error };
    const rows = Array.isArray(data) ? data : [];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return { data: all, error: null };
}
