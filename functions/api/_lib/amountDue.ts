// Server-side amount for a customer paying an estimate/invoice. Shared by
// stripe-action.ts (create_payment_intent / confirm_invoice_payment) and
// square-action.ts (create_payment / confirm_invoice_payment).
//
// BUG FIX — both used to charge the estimate's full `total` no matter what
// the customer picked on the payment screen: a customer choosing "Pay 25%
// deposit" was charged 100%, a customer coming back to pay the balance after
// a deposit was charged the full total again (double-charging the deposit),
// and a valid promo/referral discount shown on screen was never applied.
// Every number here is recomputed from the database — nothing the browser
// claims about prices is trusted, only which option it picked.

import { SUPABASE_URL } from "./env";

export type PayType = "full" | "deposit" | "remaining";

export type AmountDue = {
  baseCents: number;        // what is due before any tip
  payType: PayType;         // the option actually applied
  discountCents: number;    // promo/referral discount already subtracted
};

const sbGet = async (path: string, serviceRoleKey: string): Promise<any[]> => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } });
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
};

const toCents = (n: number) => Math.round(n * 100);

export async function computeAmountDue(opts: {
  invoiceId: string;
  serviceRoleKey: string;
  payType?: string;
  promoId?: string;
  referrerId?: string;
}): Promise<AmountDue> {
  const { invoiceId, serviceRoleKey } = opts;
  if (!serviceRoleKey) throw new Error("Server missing SUPABASE_SERVICE_ROLE_KEY env var — add it in the Cloudflare Pages dashboard, then redeploy.");
  const [est] = await sbGet(`estimates?id=eq.${encodeURIComponent(invoiceId)}&select=*`, serviceRoleKey);
  const total = Number(est?.total);
  if (!est || !total || total <= 0) throw new Error("Could not verify invoice amount — invoice not found or has no total.");

  const paidDeposit = Number(est.paidDeposit) || 0;
  const hasRemainingBalance = paidDeposit > 0 && !Number(est.paidFull) && total - paidDeposit > 0;
  if (est.paidAt && !hasRemainingBalance) throw new Error("This has already been paid in full — nothing is due.");

  let payType: PayType = opts.payType === "deposit" ? "deposit" : opts.payType === "remaining" ? "remaining" : "full";
  // A deposit already on record always means the balance is what's due.
  if (hasRemainingBalance) payType = "remaining";
  // An invoice is paid in full unless the owner put a deposit on it.
  if (payType === "deposit" && est.invoiced && !(Number(est.depositRequired) > 0)) payType = "full";
  if (payType === "remaining" && !hasRemainingBalance) payType = "full";

  let base: number;
  if (payType === "remaining") base = total - paidDeposit;
  else if (payType === "deposit") {
    // Same rule as computeDepositAmount (src/lib/utils.ts) + ClientPortal's
    // 25% fallback when the owner never configured a deposit.
    const req = Number(est.depositRequired) || 0;
    const dep = req ? (est.depositType === "percent" ? Math.round(total * (req / 100) * 100) / 100 : req) : 0;
    base = dep || Math.round(total * 25) / 100;
  } else base = total;
  base = Math.max(0, Math.min(base, total));

  let discount = 0;
  if (opts.promoId) {
    const [promo] = await sbGet(`promotions?id=eq.${encodeURIComponent(opts.promoId)}&select=*`, serviceRoleKey);
    const todayStr = new Date().toISOString().slice(0, 10);
    const valid = promo && promo.owner_id === est.owner_id && promo.status !== "ended"
      && (!promo.validTo || promo.validTo >= todayStr)
      && (!promo.usageLimit || (Number(promo.redeemedCount) || 0) < Number(promo.usageLimit));
    if (valid) discount = promo.discountType === "percent" ? Math.round(base * Number(promo.discountValue)) / 100 : Number(promo.discountValue) || 0;
  } else if (opts.referrerId) {
    const [referrer] = await sbGet(`customers?id=eq.${encodeURIComponent(opts.referrerId)}&select=id,owner_id`, serviceRoleKey);
    const custId = est.customerId || est.customer_id;
    if (referrer && referrer.owner_id === est.owner_id && referrer.id !== custId) {
      const [settingsRow] = await sbGet(`app_settings?owner_id=eq.${encodeURIComponent(est.owner_id)}&select=data`, serviceRoleKey);
      const rs = settingsRow?.data?.referralSettings || { refereeDiscount: 10, refereeDiscountType: "percent" };
      discount = rs.refereeDiscountType === "percent" ? Math.round(base * Number(rs.refereeDiscount)) / 100 : Number(rs.refereeDiscount) || 0;
    }
  }
  discount = Math.max(0, Math.min(discount, base));

  const baseCents = toCents(base - discount);
  if (baseCents <= 0) throw new Error("Nothing is due on this invoice.");
  return { baseCents, payType, discountCents: toCents(discount) };
}

// Fields to write once a payment for `payType` has really gone through.
export function paidPatch(est: any, payType: string, paidAmount: number): Record<string, any> {
  const patch: Record<string, any> = { paidAt: new Date().toISOString().slice(0, 10) };
  if (payType === "deposit") patch.paidDeposit = paidAmount;
  else if (payType === "remaining") patch.paidFull = (Number(est?.paidDeposit) || 0) + paidAmount;
  else patch.paidFull = paidAmount;
  return patch;
}
