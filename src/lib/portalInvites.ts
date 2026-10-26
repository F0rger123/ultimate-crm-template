// Customer-portal invites from the owner's side: make (or reuse) each
// customer's personal invite link, then text or email it to them. The link
// opens #/client?invite=TOKEN with their details pre-filled — they only
// choose a password (see portal_signup_with_invite in public-data.ts).
import { supabase } from "./supabase";
import { twilioSend, logOutboundSmsToInbox, sendOwnerGmailOnly, emailShell, emailButton } from "./messaging";

export type PortalInvite = { customerId: string; token: string; claimed: boolean; sentAt: string | null; firstName: string; lastName: string; email: string; phone: string };
export const portalInviteLink = (token: string) => `${window.location.origin}/#/client?invite=${encodeURIComponent(token)}`;

const call = async (action: string, payload: Record<string, unknown>) => {
  const { data } = await (supabase as any).auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sign in again first");
  const res = await fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, ...payload }) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || out?.error) throw new Error(out?.error || `Request failed (${res.status})`);
  return out;
};

export async function getPortalInvites(customerIds: string[]): Promise<PortalInvite[]> {
  const all: PortalInvite[] = [];
  for (let i = 0; i < customerIds.length; i += 500) all.push(...((await call("create_portal_invites", { customerIds: customerIds.slice(i, i + 500) })).invites || []));
  return all;
}

// Sends each invite by text when there's a phone and Twilio is set up,
// otherwise by email through the owner's Gmail. Reports what happened.
export async function sendPortalInvites(settings: any, invites: PortalInvite[], onProgress?: (done: number, total: number) => void): Promise<{ sent: number; skipped: number; failed: number; errors: string[] }> {
  const company = settings?.companyName || "us";
  const ownerEmail = settings?.myEmail || settings?.companyEmail || settings?.googleEmail || "";
  let sent = 0, skipped = 0, failed = 0;
  const errors: string[] = [];
  const sentTokens: string[] = [];
  for (let i = 0; i < invites.length; i++) {
    const inv = invites[i];
    onProgress?.(i, invites.length);
    if (inv.claimed) { skipped++; continue; }
    const link = portalInviteLink(inv.token);
    const name = `${inv.firstName} ${inv.lastName}`.trim();
    const text = `Hi ${inv.firstName || "there"}, ${company} set up your customer portal — see your jobs, invoices and coupons, and pay online. Your info is filled in; just pick a password: ${link}`;
    try {
      if (inv.phone && settings?.twilioSid) {
        await twilioSend(settings, inv.phone, text);
        logOutboundSmsToInbox({ contactName: name || inv.phone, contactPhone: inv.phone, customerId: inv.customerId, body: text }).catch(() => {});
      } else if (inv.email && (settings?.googleConnected || settings?.googleProviderToken)) {
        const html = emailShell(settings, "Your customer portal", `<p>Hi ${inv.firstName || "there"},</p><p>${company} set up your customer portal. You can see your upcoming and past jobs, invoices and coupons, and pay online.</p><p>Your details are already filled in — just choose a password.</p>` + emailButton("Open my portal", link));
        await sendOwnerGmailOnly(settings, inv.email, `${company} — your customer portal`, html);
      } else { skipped++; continue; }
      sent++; sentTokens.push(inv.token);
    } catch (e: any) {
      failed++; if (errors.length < 5) errors.push(`${name || inv.phone || inv.email}: ${e?.message || "failed"}`);
    }
    if (invites.length > 5) await new Promise(r => setTimeout(r, 120));
  }
  onProgress?.(invites.length, invites.length);
  if (sentTokens.length) await call("mark_portal_invites_sent", { tokens: sentTokens }).catch(() => {});
  return { sent, skipped, failed, errors };
}
