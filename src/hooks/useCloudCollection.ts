// useCloudCollection — a list (campaigns, goals, vehicles, expenses, …) kept
// in localStorage for instant loads AND synced to Supabase `owner_records`
// (migration 0003), one row per item.
//
// BUG FIX — these lists used to be localStorage-only (usePersistent): added
// on the phone, missing on the laptop; deleted on one device, back from the
// other; and text-Alfred, which runs on the server, could "create a
// campaign" that never appeared in the CRM. Now:
//   - first load: the server copy wins; items only this device has (made
//     before sync existed) are uploaded, unless another device deleted them,
//   - every change is pushed (debounced), deletes as tombstones (deleted_at)
//     so they stick everywhere,
//   - changes from other devices / Alfred are pulled every 15s and when the
//     tab comes back into view.
// If the table doesn't exist yet the list keeps working locally, exactly as
// before, and logs once.
import { useEffect, useRef, useState, useCallback } from "react";
import { usePersistent } from "./usePersistent";
import { supabase } from "../lib/supabase";

type Item = { id: string; [k: string]: any };
const PAGE = 1000;
const CHUNK = 200;

// The demo items a brand-new account starts with (seed data). Never upload
// them, and drop them once the cloud copy loads, unless the owner edited one
// (then it's theirs). Dates are ignored when comparing: seeds use "N days
// from now", which changes daily.
const stripDates = (o: any) => JSON.stringify(o, (_k, v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? "" : v));
const isUntouchedSeed = (item: Item, seeds: Map<string, string>) => seeds.has(item.id) && seeds.get(item.id) === stripDates(item);

export type CloudStatus = "local" | "syncing" | "synced" | "unavailable";

export function useCloudCollection<T extends Item>(kind: string, localKey: string, initial: T[], ownerId: string | null | undefined): [T[], React.Dispatch<React.SetStateAction<T[]>>, CloudStatus] {
  const [items, setItems] = usePersistent<T[]>(localKey, initial as any);
  const [status, setStatus] = useState<CloudStatus>("local");
  const synced = useRef<Map<string, string>>(new Map()); // id → JSON the server has
  const tombstones = useRef<Set<string>>(new Set());
  const lastPull = useRef<string>("");
  const ready = useRef(false);
  const missing = useRef(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const seeds = useRef(new Map((initial || []).map(s => [s.id, stripDates(s)])));

  const upsertRows = useCallback(async (rows: any[]) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { data, error } = await (supabase as any).from("owner_records").upsert(rows.slice(i, i + CHUNK), { onConflict: "owner_id,kind,id" }).select("id");
      if (error) throw new Error(error.message);
      if (!Array.isArray(data) || data.length === 0) throw new Error("the server didn't save them (account mismatch)");
    }
  }, []);

  // Initial load.
  useEffect(() => {
    if (!ownerId || ready.current || missing.current) return;
    let cancelled = false;
    (async () => {
      setStatus("syncing");
      const rows: any[] = [];
      for (let from = 0; from < 100000; from += PAGE) {
        const { data, error } = await (supabase as any).from("owner_records").select("id,data,deleted_at,updated_at").eq("owner_id", ownerId).eq("kind", kind).order("id").range(from, from + PAGE - 1);
        if (error) {
          missing.current = true;
          setStatus("unavailable");
          console.warn(`[CloudSync:${kind}] owner_records unavailable — staying on this device only. Run supabase/migrations/0003_owner_records_and_budget_entries.sql. (${error.message})`);
          return;
        }
        rows.push(...(data || []));
        if (!data || data.length < PAGE) break;
      }
      if (cancelled) return;
      const live = new Map<string, T>();
      for (const r of rows) {
        if (r.updated_at > lastPull.current) lastPull.current = r.updated_at;
        if (r.deleted_at) tombstones.current.add(r.id);
        else live.set(r.id, { ...(r.data || {}), id: r.id });
      }
      live.forEach((v, id) => synced.current.set(id, JSON.stringify(v)));
      const localOnly = (itemsRef.current || []).filter(it => it && it.id && !live.has(it.id) && !tombstones.current.has(it.id) && !isUntouchedSeed(it, seeds.current));
      // Keep this device's order, then anything new from the server.
      const merged: T[] = [];
      const seen = new Set<string>();
      for (const it of itemsRef.current || []) {
        if (!it?.id || seen.has(it.id)) continue;
        if (live.has(it.id)) { merged.push(live.get(it.id)!); seen.add(it.id); }
        else if (localOnly.includes(it)) { merged.push(it); seen.add(it.id); }
      }
      live.forEach((v, id) => { if (!seen.has(id)) merged.push(v); });
      ready.current = true;
      setItems(merged);
      if (localOnly.length) {
        try {
          await upsertRows(localOnly.map(it => ({ owner_id: ownerId, kind, id: it.id, data: it, deleted_at: null })));
          localOnly.forEach(it => synced.current.set(it.id, JSON.stringify(it)));
        } catch (e: any) { console.warn(`[CloudSync:${kind}] uploading this device's items failed:`, e?.message); }
      }
      setStatus("synced");
    })();
    return () => { cancelled = true; };
  }, [ownerId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push local changes.
  useEffect(() => {
    if (!ownerId || !ready.current || missing.current) return;
    const t = setTimeout(async () => {
      const current = itemsRef.current || [];
      const ids = new Set(current.map(i => i.id));
      const changed = current.filter(i => i?.id && synced.current.get(i.id) !== JSON.stringify(i));
      const removed = Array.from(synced.current.keys()).filter(id => !ids.has(id));
      if (!changed.length && !removed.length) return;
      try {
        if (changed.length) {
          await upsertRows(changed.map(i => ({ owner_id: ownerId, kind, id: i.id, data: i, deleted_at: null })));
          changed.forEach(i => { synced.current.set(i.id, JSON.stringify(i)); tombstones.current.delete(i.id); });
        }
        if (removed.length) {
          const now = new Date().toISOString();
          await upsertRows(removed.map(id => ({ owner_id: ownerId, kind, id, data: JSON.parse(synced.current.get(id) || "{}"), deleted_at: now })));
          removed.forEach(id => { synced.current.delete(id); tombstones.current.add(id); });
        }
        setStatus("synced");
      } catch (e: any) {
        console.error(`[CloudSync:${kind}] save failed:`, e?.message);
        setStatus("syncing");
      }
    }, 900);
    return () => clearTimeout(t);
  }, [items, ownerId, kind, upsertRows]);

  // Pull changes made elsewhere (another device, text-Alfred).
  useEffect(() => {
    if (!ownerId) return;
    const pull = async () => {
      if (!ready.current || missing.current || document.visibilityState === "hidden") return;
      const { data, error } = await (supabase as any).from("owner_records").select("id,data,deleted_at,updated_at").eq("owner_id", ownerId).eq("kind", kind).gt("updated_at", lastPull.current || "1970-01-01").order("updated_at").limit(PAGE);
      if (error || !Array.isArray(data) || !data.length) return;
      const dirty = new Set((itemsRef.current || []).filter(i => synced.current.has(i.id) && synced.current.get(i.id) !== JSON.stringify(i)).map(i => i.id));
      let next = (itemsRef.current || []).slice();
      let touched = false;
      for (const r of data) {
        if (r.updated_at > lastPull.current) lastPull.current = r.updated_at;
        if (dirty.has(r.id)) continue; // this device has an unsaved edit — it wins, and is about to be pushed
        if (r.deleted_at) {
          tombstones.current.add(r.id);
          synced.current.delete(r.id);
          if (next.some(i => i.id === r.id)) { next = next.filter(i => i.id !== r.id); touched = true; }
        } else {
          const v = { ...(r.data || {}), id: r.id } as T;
          const json = JSON.stringify(v);
          synced.current.set(r.id, json);
          tombstones.current.delete(r.id);
          const idx = next.findIndex(i => i.id === r.id);
          if (idx < 0) { next.push(v); touched = true; }
          else if (JSON.stringify(next[idx]) !== json) { next[idx] = v; touched = true; }
        }
      }
      if (touched) setItems(next);
    };
    const iv = setInterval(pull, 15000);
    const onVis = () => { if (document.visibilityState === "visible") pull(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, [ownerId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  return [items, setItems, status];
}
