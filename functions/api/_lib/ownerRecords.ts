import { SUPABASE_URL } from "./env";
// Server-side access to `owner_records` (migration 0003) — the table the CRM
// syncs campaigns, goals, vehicles, expenses, accountability and wins through
// (src/hooks/useCloudCollection.ts). Anything Alfred writes here shows up in
// the CRM within ~15 seconds. Also holds Alfred's own working records:
// bulk-text drafts, reply watches and the birthday-offer setting.
//
// Service-role REST (bypasses RLS), so every call is scoped by owner_id.


type Headers = Record<string, string>;

export const OWNER_RECORDS_MISSING = "Alfred's records table isn't set up yet — run supabase/migrations/0003_owner_records_and_budget_entries.sql in the Supabase SQL Editor, then try again.";

export async function recList(authHeaders: Headers, ownerId: string, kind: string, opts: { includeDeleted?: boolean; limit?: number } = {}): Promise<{ ok: boolean; rows: any[]; error?: string }> {
  const q = `owner_records?owner_id=eq.${encodeURIComponent(ownerId)}&kind=eq.${encodeURIComponent(kind)}${opts.includeDeleted ? "" : "&deleted_at=is.null"}&select=id,data,updated_at,deleted_at&order=updated_at.desc&limit=${opts.limit || 1000}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: authHeaders });
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data)) return { ok: false, rows: [], error: (data as any)?.message || `HTTP ${res.status}` };
    return { ok: true, rows: data.map((r: any) => ({ ...(r.data || {}), id: r.id, _updatedAt: r.updated_at, _deletedAt: r.deleted_at })) };
  } catch (e: any) {
    return { ok: false, rows: [], error: e?.message || "network error" };
  }
}

export async function recGet(authHeaders: Headers, ownerId: string, kind: string, id: string): Promise<any | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/owner_records?owner_id=eq.${encodeURIComponent(ownerId)}&kind=eq.${encodeURIComponent(kind)}&id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=id,data,updated_at&limit=1`, { headers: authHeaders }).catch(() => null);
  const rows = res ? await res.json().catch(() => []) : [];
  return Array.isArray(rows) && rows[0] ? { ...(rows[0].data || {}), id: rows[0].id, _updatedAt: rows[0].updated_at } : null;
}

// Upserts one record. `data` must not contain the _-prefixed bookkeeping
// fields recList adds; they're stripped here to be safe.
export async function recPut(authHeaders: Headers, ownerId: string, kind: string, data: Record<string, any>, deleted = false): Promise<{ ok: boolean; error?: string }> {
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) if (!k.startsWith("_")) clean[k] = v;
  const id = String(clean.id || crypto.randomUUID());
  clean.id = id;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/owner_records?on_conflict=owner_id,kind,id`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify([{ owner_id: ownerId, kind, id, data: clean, deleted_at: deleted ? new Date().toISOString() : null }]),
    });
    const out = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(out) || out.length === 0) return { ok: false, error: (out as any)?.message || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "network error" };
  }
}

// Every owner's live records of one kind — for the cron jobs (birthday offers).
export async function recListAllOwners(authHeaders: Headers, kind: string): Promise<{ ownerId: string; data: any }[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/owner_records?kind=eq.${encodeURIComponent(kind)}&deleted_at=is.null&select=owner_id,id,data&limit=1000`, { headers: authHeaders }).catch(() => null);
  const rows = res ? await res.json().catch(() => []) : [];
  return Array.isArray(rows) ? rows.map((r: any) => ({ ownerId: r.owner_id, data: { ...(r.data || {}), id: r.id } })) : [];
}
