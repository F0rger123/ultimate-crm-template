// sheet-fetch.ts — reads a Google Sheet as CSV for imports (Customers →
// Import → Google Sheets, and Alfred's read_google_sheet).
//
// BUG FIX (user report — "the import of Google Sheets is broken"). The
// browser used to fetch the sheet's CSV export itself. That only worked for
// a sheet shared "Anyone with the link", and even then the browser often
// blocked the cross-site redirect Google answers with, so the import failed
// with a bare "Failed to fetch". Now the server fetches it: first the public
// export, then — for a private sheet — the owner's connected Google account
// (the CRM's Google sign-in includes read-only Drive access).
// POST { url } with the signed-in user's Supabase token as Bearer.
import { resolveCallerOwnerId } from "./_lib/ownerSecrets";
import { fetchSheetCsv } from "./_lib/sheetCsv";

const json = (b: any, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });

export const onRequestPost = async (context: { request: Request; env: Record<string, string> }) => {
  try {
    const token = (context.request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const ownerId = await resolveCallerOwnerId(token).catch(() => null);
    if (!ownerId) return json({ error: "Sign in again to import a sheet." }, 401);
    const { url } = await context.request.json().catch(() => ({})) as { url?: string };
    const r = await fetchSheetCsv(context.env, ownerId, String(url || ""));
    return "error" in r ? json({ error: r.error }, r.status) : json(r);
  } catch (e: any) {
    return json({ error: e?.message || "Couldn't read that sheet" }, 500);
  }
};
