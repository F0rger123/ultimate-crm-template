// Tells the owner about a payment event the moment it happens, from the
// server: an email through the owner's connected Gmail plus a phone push.
//
// BUG FIX — "I got a bunch of invoice-paid emails at once, super delayed."
// These emails used to be sent by the owner's own browser, from a diff of
// invoice data it noticed changing — so nothing went out until the owner
// opened the CRM, then every payment since the last visit went out at once,
// and every open tab/device could send its own copy. Now the code that
// records the payment (stripe-webhook, confirm_invoice_payment) sends one
// notice per payment, right away; the browser only shows the toast/bell.
import { SUPABASE_URL } from "./env";
import { getOwnerSecrets } from "./ownerSecrets";
import { sendWebPush } from "./webPush";



export type InvoiceEventType = "paid" | "refunded" | "disputed" | "failed";

const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const money = (n: number) => "$" + (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, "");

export async function notifyOwnerInvoiceEvent(env: Record<string, string>, origin: string, invoiceId: string, type: InvoiceEventType, amount?: number): Promise<void> {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !invoiceId) return;
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const get = async (path: string) => { const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: h }); const d = await r.json().catch(() => []); return Array.isArray(d) ? d : []; };
  try {
    const [est] = await get(`estimates?id=eq.${encodeURIComponent(invoiceId)}&select=owner_id,customerId,total,invoiced`);
    if (!est?.owner_id) return;
    const [cust] = est.customerId ? await get(`customers?id=eq.${encodeURIComponent(est.customerId)}&select=firstName,lastName`) : [];
    const [settingsRow] = await get(`app_settings?owner_id=eq.${encodeURIComponent(est.owner_id)}&select=data`);
    const s = settingsRow?.data || {};
    const who = cust ? `${cust.firstName || ""} ${cust.lastName || ""}`.trim() || "A customer" : "A customer";
    const amt = money(amount ?? (Number(est.total) || 0));
    const doc = est.invoiced ? "invoice" : "quote";
    const line = type === "paid" ? `${who} paid ${amt} on their ${doc}.`
      : type === "refunded" ? `${amt} was refunded to ${who}.`
      : type === "disputed" ? `${who} opened a payment dispute on ${amt}. Disputes have a short response window — check your Stripe dashboard.`
      : `${who}'s payment of ${amt} failed.`;
    const subject = (type === "paid" ? "💰 Payment received" : type === "refunded" ? "↩️ Refund issued" : type === "disputed" ? "🚨 Payment dispute opened" : "⚠️ Payment failed") + ` — ${who}`;
    const link = `${origin}/#/${est.invoiced ? "invoices" : "estimates"}?open=${encodeURIComponent(invoiceId)}`;

    // Phone push (owner's own subscriptions only).
    const VAPID_PUBLIC_KEY = env.VAPID_PUBLIC_KEY || env.VITE_VAPID_PUBLIC_KEY || "";
    if (env.VAPID_PRIVATE_KEY && VAPID_PUBLIC_KEY) {
      const subs = await get(`push_subscriptions?owner_id=eq.${encodeURIComponent(est.owner_id)}&employee_id=is.null&select=endpoint,p256dh,auth`);
      for (const sub of subs) {
        await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth }, { title: subject, body: line, url: `/#/${est.invoiced ? "invoices" : "estimates"}?open=${encodeURIComponent(invoiceId)}`, tag: `pay-${invoiceId}-${type}` }, VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT || "mailto:notifications@example.com").catch(() => null);
      }
    }

    // Email through the owner's connected Gmail (never a third-party sender).
    // A saved Google sign-in (refresh token) is enough on its own — the
    // short-lived access token in settings is often expired or missing.
    const to = s.myEmail || s.companyEmail || s.googleEmail;
    const secrets = await getOwnerSecrets(est.owner_id, key).catch(() => null);
    if (!to || (!s.googleProviderToken && !secrets?.googleRefreshToken)) return;
    let token = s.googleProviderToken;
    if (secrets?.googleRefreshToken && (!token || !s.googleTokenExpiresAt || Date.now() > Number(s.googleTokenExpiresAt) - 60000)) {
      const rr = await fetch(`${origin}/api/google-refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: secrets.googleRefreshToken }) }).catch(() => null);
      const rd: any = rr ? await rr.json().catch(() => null) : null;
      if (rr?.ok && rd?.access_token) token = rd.access_token;
    }
    const company = s.companyName || "your business";
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111">
<p style="font-size:16px;margin:0 0 16px">${esc(line)}</p>
<p style="margin:0 0 20px"><a href="${esc(link)}" style="display:inline-block;padding:12px 22px;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">View ${doc}</a></p>
<p style="font-size:12px;color:#777;margin:0">${esc(company)} · sent by your CRM</p></div>`;
    const mime = [`To: ${to}`, `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`, "MIME-Version: 1.0", "Content-Type: text/html; charset=utf-8", "", html].join("\r\n");
    const raw = btoa(unescape(encodeURIComponent(mime))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const res = await fetch("https://www.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw }),
    });
    if (!res.ok) console.warn("[ownerNotify] Gmail send failed:", res.status, (await res.text().catch(() => "")).slice(0, 200));
  } catch (e: any) {
    console.warn("[ownerNotify] failed:", e?.message);
  }
}
