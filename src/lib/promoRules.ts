// When a coupon (promotions row) can be used — one rule for the customer
// portal, checkout pricing (functions/api/_lib/amountDue.ts) and the
// portal's "your coupons" list. functions/ imports this file directly.
//
// BUG FIX — coupons were only checked against their end date and usage
// count: one that hadn't started yet worked, and a coupon made for ONE
// customer (a birthday coupon) worked for anyone who had the code.

export type PromoLike = {
  id?: string; owner_id?: string; code?: string; status?: string;
  validFrom?: string | null; validTo?: string | null;
  usageLimit?: number | string | null; redeemedCount?: number | string | null;
  audience?: string; audienceCustomerIds?: string[] | null;
  discountType?: string; discountValue?: number | string;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function promoProblem(p: PromoLike | null | undefined, opts: { customerId?: string | null; ownerId?: string | null; today?: string } = {}): string | null {
  if (!p) return "Code not recognized";
  const today = opts.today || todayISO();
  if (opts.ownerId && p.owner_id && p.owner_id !== opts.ownerId) return "Code not recognized";
  if (p.status === "ended") return "This coupon has ended";
  if (p.validFrom && String(p.validFrom).slice(0, 10) > today) return `This coupon starts ${String(p.validFrom).slice(0, 10)}`;
  if (p.validTo && String(p.validTo).slice(0, 10) < today) return `This coupon expired ${String(p.validTo).slice(0, 10)}`;
  const limit = Number(p.usageLimit) || 0;
  if (limit && (Number(p.redeemedCount) || 0) >= limit) return limit === 1 ? "This coupon has already been used" : "This coupon has been used up";
  if (p.audience === "individual") {
    const ids = Array.isArray(p.audienceCustomerIds) ? p.audienceCustomerIds : [];
    if (!opts.customerId || !ids.includes(opts.customerId)) return "This coupon is for a different customer";
  }
  return null;
}

export const promoUsable = (p: PromoLike | null | undefined, opts: { customerId?: string | null; ownerId?: string | null; today?: string } = {}) => !promoProblem(p, opts);

export const promoDiscount = (p: PromoLike, base: number) =>
  Math.max(0, Math.min(base, p.discountType === "percent" ? Math.round(base * (Number(p.discountValue) || 0)) / 100 : Number(p.discountValue) || 0));
