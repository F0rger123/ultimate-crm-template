// Birthday offers — once a day, every customer whose birthday (customers
// ."birthday", YYYY-MM-DD or --MM-DD) is today gets a text with their own
// coupon code (a real row in `promotions`, so it can be redeemed and
// tracked). Turned on by text-Alfred's set_birthday_offer; the setting is the
// owner_records row kind "birthday_offer", id "default". Run by the
// /api/check-reminders cron.
import { SUPABASE_URL } from "./env";
import { recListAllOwners, recPut } from "./ownerRecords";
import { stripMarkdownForSms } from "./textFormat";



export type BirthdayOffer = {
  id: "default"; active: boolean; discountPercent: number; validDays: number; message?: string;
  lastRunDate?: string; sent?: Record<string, string>; // customerId → year sent
};
export const DEFAULT_BIRTHDAY_MESSAGE = "Happy birthday {{first_name}}! 🎉 From all of us at {{company}}, here's {{percent}}% off your next service — use code {{code}} by {{expires}}.";

// US business owners: "today" in US Eastern-ish time, so a birthday text
// doesn't go out the evening before.
const usToday = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);

export async function runBirthdayOffers(authHeaders: Record<string, string>, getTwilio: (ownerId: string) => Promise<{ sid: string; token: string; from: string } | null>, getCompany: (ownerId: string) => Promise<string>): Promise<{ sent: number; errors: string[] }> {
  const day = usToday();
  const mmdd = day.slice(5);
  const year = day.slice(0, 4);
  // Don't text before 9am Eastern.
  if (new Date(Date.now() - 5 * 3600000).getUTCHours() < 9) return { sent: 0, errors: [] };
  const configs = (await recListAllOwners(authHeaders, "birthday_offer")).filter(c => c.data?.active && c.data.lastRunDate !== day);
  let sent = 0;
  const errors: string[] = [];
  for (const { ownerId, data } of configs) {
    const cfg = data as BirthdayOffer;
    const tw = await getTwilio(ownerId);
    if (!tw) { errors.push(`${ownerId}: Twilio not set up`); continue; }
    const company = await getCompany(ownerId);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/customers?owner_id=eq.${encodeURIComponent(ownerId)}&birthday=like.*-${mmdd}&select=id,firstName,lastName,phone,smsOptOut,isTestClient&limit=500`, { headers: authHeaders }).catch(() => null);
    const rows = res ? await res.json().catch(() => []) : [];
    if (!Array.isArray(rows)) { errors.push(`${ownerId}: couldn't read birthdays (${(rows as any)?.message || "error"})`); continue; }
    cfg.sent = cfg.sent || {};
    const auth = `Basic ${btoa(`${tw.sid}:${tw.token}`)}`;
    const expires = new Date(Date.now() + (Number(cfg.validDays) || 30) * 86400000).toISOString().slice(0, 10);
    const expiresLabel = new Date(expires + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric" });
    for (const c of rows) {
      if (!c.phone || c.smsOptOut || cfg.sent[c.id] === year) continue;
      const code = "BDAY" + Math.random().toString(36).slice(2, 7).toUpperCase();
      const promo = await fetch(`${SUPABASE_URL}/rest/v1/promotions`, {
        method: "POST", headers: { ...authHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        // One use, only this customer, expires after validDays — and one per
        // customer per year (cfg.sent). Column names match the promotions table.
        body: JSON.stringify([{ id: crypto.randomUUID(), owner_id: ownerId, name: `Birthday — ${`${c.firstName || ""} ${c.lastName || ""}`.trim()}`, description: "Birthday coupon", code, discountType: "percent", discountValue: Number(cfg.discountPercent) || 10, validFrom: day, validTo: expires, usageLimit: 1, redeemedCount: 0, audience: "individual", audienceCustomerIds: [c.id], channel: "sms", status: "active", createdAt: day }]),
      }).catch(() => null);
      if (!promo?.ok) { errors.push(`${c.id}: couldn't create coupon`); continue; }
      const body = stripMarkdownForSms((cfg.message || DEFAULT_BIRTHDAY_MESSAGE)
        .replace(/{{first_name}}/g, c.firstName || "there").replace(/{{code}}/g, code)
        .replace(/{{percent}}/g, String(Number(cfg.discountPercent) || 10)).replace(/{{expires}}/g, expiresLabel).replace(/{{company}}/g, company));
      const sms = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${tw.sid}/Messages.json`, {
        method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: c.phone, From: tw.from, Body: body }).toString(),
      }).catch(() => null);
      if (!sms?.ok) { errors.push(`${c.id}: text failed`); continue; }
      cfg.sent[c.id] = year;
      sent++;
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/find_or_create_inbox_thread`, {
        method: "POST", headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ p_owner_id: ownerId, p_channel: "sms", p_contact_phone: c.phone, p_contact_name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.phone, p_customer_id: c.id, p_message: { id: crypto.randomUUID(), dir: "out", body, ts: Date.now(), via: "alfred" }, p_unread: false }),
      }).catch(() => {});
    }
    cfg.lastRunDate = day;
    await recPut(authHeaders, ownerId, "birthday_offer", cfg);
  }
  return { sent, errors };
}
