// Reads a Google Sheet as CSV on the server: the public export first, then
// the owner's connected Google account for a private sheet (the CRM's Google
// sign-in includes read-only Drive access). Used by /api/sheet-fetch (CRM
// imports) and texted imports (_lib/textImport.ts).
import { getOwnerSecrets } from "./ownerSecrets";

export const parseSheetUrl = (url: string): { kind: "doc" | "published"; id: string; gid: string | null } | null => {
  const gid = (url.match(/[?&#]gid=(\d+)/) || [])[1] || null;
  const pub = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/);
  if (pub) return { kind: "published", id: pub[1], gid };
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? { kind: "doc", id: m[1], gid } : null;
};

const looksLikeCsv = (res: Response, text: string) =>
  res.ok && !/text\/html/i.test(res.headers.get("content-type") || "") && !/^\s*<(!doctype|html)/i.test(text);

const PRIVATE_HELP = "This sheet is private. Either share it as \"Anyone with the link can view\" (Share → General access), or connect Google in Settings → Integrations with the account that owns the sheet.";

export async function fetchSheetCsv(env: Record<string, string>, ownerId: string, url: string): Promise<{ csv: string; via: string } | { error: string; status: number }> {
  const sheet = parseSheetUrl(String(url || ""));
  if (!sheet) return { error: "That doesn't look like a Google Sheets link — copy it from the browser's address bar while the sheet is open.", status: 400 };
  const exportUrl = sheet.kind === "published"
    ? `https://docs.google.com/spreadsheets/d/e/${sheet.id}/pub?output=csv${sheet.gid ? `&gid=${sheet.gid}` : ""}`
    : `https://docs.google.com/spreadsheets/d/${sheet.id}/export?format=csv${sheet.gid ? `&gid=${sheet.gid}` : ""}`;

  // 1. Shared "Anyone with the link" (or published): no sign-in needed.
  const pubRes = await fetch(exportUrl, { redirect: "follow" }).catch(() => null);
  if (pubRes) {
    const text = await pubRes.text().catch(() => "");
    if (looksLikeCsv(pubRes, text)) return { csv: text, via: "public link" };
  }
  if (sheet.kind === "published") return { error: "Couldn't open that published sheet — check the link.", status: 400 };

  // 2. Private: the owner's Google account.
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const secrets = serviceRoleKey ? await getOwnerSecrets(ownerId, serviceRoleKey).catch(() => null) : null;
  const refresh = secrets?.googleRefreshToken;
  if (!refresh || !env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return { error: PRIVATE_HELP, status: 403 };
  const tok: any = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refresh, grant_type: "refresh_token" }).toString(),
  }).then(r => r.json()).catch(() => null);
  if (!tok?.access_token) return { error: "Your Google connection has expired — reconnect Google in Settings → Integrations, then try again. " + PRIVATE_HELP, status: 403 };
  const authed = await fetch(exportUrl, { headers: { Authorization: `Bearer ${tok.access_token}` }, redirect: "follow" }).catch(() => null);
  if (authed) {
    const text = await authed.text().catch(() => "");
    if (looksLikeCsv(authed, text)) return { csv: text, via: "your Google account" };
    if (authed.status === 404) return { error: "Google says that sheet doesn't exist — check the link.", status: 404 };
  }
  // Drive export (first tab only) as a last resort.
  const drive = await fetch(`https://www.googleapis.com/drive/v3/files/${sheet.id}/export?mimeType=text/csv`, { headers: { Authorization: `Bearer ${tok.access_token}` } }).catch(() => null);
  if (drive?.ok) return { csv: await drive.text(), via: "your Google account (first tab)" };
  return { error: "Your connected Google account can't open that sheet. " + PRIVATE_HELP, status: 403 };
}
