// Sends an owner-approved bulk text (an owner_records "bulk_text_draft"
// Alfred prepared — see prepare_bulk_text / send_bulk_text in
// alfredSmsAgent.ts) in batches. A long list can't go out inside one text
// conversation's time limit, so whatever doesn't fit is picked up by the
// /api/check-reminders cron on its next run until everyone's been sent.
// Every send re-checks opt-outs, is logged to the owner's Inbox, and the
// matching campaign in the Campaigns page is kept up to date.
import { SUPABASE_URL } from "./env";
import { recGet, recPut, recListAllOwners } from "./ownerRecords";
import { stripMarkdownForSms } from "./textFormat";



export type BulkRecipient = { n: number; customerId: string; name: string; firstName: string; phone: string; status?: "pending" | "sent" | "failed" | "skipped"; error?: string };
export type BulkDraft = {
  id: string; campaignId?: string; message: string; recipients: BulkRecipient[];
  status: "draft" | "sending" | "sent" | "cancelled"; createdAt: string; approvedAt?: string; approval?: string;
  watchId?: string; sentCount?: number; failedCount?: number; finishedAt?: string;
};
type Twilio = { sid: string; token: string; from: string };

async function logToInbox(authHeaders: Record<string, string>, ownerId: string, to: string, name: string, customerId: string, body: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
    method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ p_owner_id: ownerId, p_channel: "sms", p_contact_phone: to, p_contact_name: name || to, p_customer_id: customerId || null, p_message: { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" }, p_unread: false }),
  }).catch(() => {});
}

// Sends pending recipients until `deadline` (epoch ms). Returns the draft as saved.
export async function runBulkSendBatch(authHeaders: Record<string, string>, ownerId: string, twilio: Twilio, draft: BulkDraft, deadline: number): Promise<BulkDraft> {
  if (draft.status !== "sending") return draft;
  const pending = draft.recipients.filter(r => r.status === "pending");
  // Opt-outs can change between approval and sending.
  const ids = pending.map(r => r.customerId).filter(Boolean);
  const optedOut = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id,smsOptOut&smsOptOut=eq.true&id=in.(${ids.slice(i, i + 100).map(encodeURIComponent).join(",")})`, { headers: authHeaders }).catch(() => null);
    const rows = res ? await res.json().catch(() => []) : [];
    if (Array.isArray(rows)) rows.forEach((r: any) => optedOut.add(r.id));
  }
  const auth = `Basic ${btoa(`${twilio.sid}:${twilio.token}`)}`;
  let since = 0;
  for (const r of pending) {
    if (Date.now() > deadline) break;
    if (optedOut.has(r.customerId)) { r.status = "skipped"; r.error = "opted out"; continue; }
    const body = stripMarkdownForSms(draft.message.replace(/{{first_name}}/g, r.firstName || "there"));
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilio.sid}/Messages.json`, {
      method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: r.phone, From: twilio.from, Body: body }).toString(),
    }).catch((e: any) => ({ ok: false, text: async () => String(e?.message || e) } as any));
    if (res.ok) { r.status = "sent"; await logToInbox(authHeaders, ownerId, r.phone, r.name, r.customerId, body); }
    else { r.status = "failed"; r.error = (await res.text().catch(() => "")).slice(0, 120); }
    if (++since % 20 === 0) await recPut(authHeaders, ownerId, "bulk_text_draft", draft); // progress survives a cut-off
    await new Promise(res2 => setTimeout(res2, 120)); // stay under Twilio's rate limit
  }
  draft.sentCount = draft.recipients.filter(r => r.status === "sent").length;
  draft.failedCount = draft.recipients.filter(r => r.status === "failed").length;
  if (!draft.recipients.some(r => r.status === "pending")) { draft.status = "sent"; draft.finishedAt = new Date().toISOString(); }
  await recPut(authHeaders, ownerId, "bulk_text_draft", draft);
  if (draft.campaignId) {
    const camp = await recGet(authHeaders, ownerId, "campaigns", draft.campaignId);
    if (camp) {
      const attempted = (draft.sentCount || 0) + (draft.failedCount || 0);
      await recPut(authHeaders, ownerId, "campaigns", {
        ...camp, status: draft.status === "sent" ? "sent" : "sending", sentAt: draft.finishedAt || camp.sentAt, sentCount: draft.sentCount, failedCount: draft.failedCount,
        recipientCount: draft.recipients.filter(r => r.status !== "skipped").length,
        deliveryRate: attempted ? Math.round(((draft.sentCount || 0) / attempted) * 100) : undefined,
        failureSamples: draft.recipients.filter(r => r.status === "failed").slice(0, 3).map(r => `${r.name}: ${r.error}`),
      });
    }
  }
  return draft;
}

// Cron side (check-reminders): finish every bulk send still in progress.
export async function continueBulkSends(authHeaders: Record<string, string>, getTwilio: (ownerId: string) => Promise<Twilio | null>, budgetMs = 20000): Promise<{ sent: number; owners: number }> {
  const all = await recListAllOwners(authHeaders, "bulk_text_draft");
  const sending = all.filter(r => r.data?.status === "sending");
  const deadline = Date.now() + budgetMs;
  let sent = 0;
  for (const { ownerId, data } of sending) {
    if (Date.now() > deadline) break;
    const tw = await getTwilio(ownerId);
    if (!tw) continue;
    const before = (data.recipients || []).filter((r: any) => r.status === "sent").length;
    const after = await runBulkSendBatch(authHeaders, ownerId, tw, data as BulkDraft, deadline);
    sent += (after.sentCount || 0) - before;
  }
  return { sent, owners: sending.length };
}
