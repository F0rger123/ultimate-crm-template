import { SUPABASE_URL } from "./env";
// Counts a coupon as used once its payment really goes through — server
// side, from the payment (Stripe intent metadata / Square note), instead of
// trusting the customer's browser to report it. Once per quote/invoice: the
// same "promo:<estimateId>" key the portal's redeem_promotion uses
// (sms_dedupe), so the two can never count it twice.


export async function redeemPromoForInvoice(serviceRoleKey: string, promoId: string, estimateId: string): Promise<void> {
  if (!serviceRoleKey || !promoId || !estimateId) return;
  const h = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" };
  try {
    const ins = await fetch(`${SUPABASE_URL}/rest/v1/sms_dedupe`, { method: "POST", headers: { ...h, Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ sid: `promo:${estimateId}` }) });
    const rows = await ins.json().catch(() => null);
    if (ins.ok && Array.isArray(rows) && rows.length === 0) return; // already counted for this invoice
    const cur = await fetch(`${SUPABASE_URL}/rest/v1/promotions?id=eq.${encodeURIComponent(promoId)}&select=redeemedCount`, { headers: h }).then(r => r.json()).catch(() => []);
    if (!Array.isArray(cur) || !cur[0]) return;
    await fetch(`${SUPABASE_URL}/rest/v1/promotions?id=eq.${encodeURIComponent(promoId)}`, { method: "PATCH", headers: { ...h, Prefer: "return=minimal" }, body: JSON.stringify({ redeemedCount: (Number(cur[0].redeemedCount) || 0) + 1 }) });
  } catch (e: any) {
    console.warn("[promoRedeem] failed:", e?.message);
  }
}
