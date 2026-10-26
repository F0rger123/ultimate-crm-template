// Reads a Google Sheet's rows through /api/sheet-fetch (see its comment for
// why the browser can't fetch the sheet itself).
import { supabase } from "./supabase";
import { parseDelimited } from "./customerImport";

export const GOOGLE_SHEET_URL = /https?:\/\/docs\.google\.com\/spreadsheets\/d\/[^\s)>"']+/i;

export async function fetchGoogleSheetCsv(url: string): Promise<string> {
  const { data } = await (supabase as any).auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sign in again to import a sheet.");
  const res = await fetch("/api/sheet-fetch", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ url }) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body?.csv !== "string") throw new Error(body?.error || `Couldn't read that sheet (${res.status})`);
  if (!body.csv.trim()) throw new Error("That sheet (tab) is empty.");
  return body.csv;
}

export async function fetchGoogleSheetRows(url: string): Promise<string[][]> {
  return parseDelimited(await fetchGoogleSheetCsv(url));
}
