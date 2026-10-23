// Payment provider layer. Three providers:
//   manual — no processor; invoices are marked paid by hand (cash/check/
//            transfer). Always available, needs no setup.
//   stripe — src/lib/stripe.ts + functions/api/stripe-*.ts
//   square — src/lib/square.ts + functions/api/square-*.ts
// Stripe and Square are optional adapters: each only activates once its
// credentials are connected in Settings → Integrations. Exactly one provider
// is shown to customers at checkout, picked by resolvePaymentProvider().
export * as stripe from "../stripe";
export * as square from "../square";

export type PaymentProviderId = "manual" | "stripe" | "square";

export const PAYMENT_PROVIDERS: { id: PaymentProviderId; label: string; description: string }[] = [
  { id: "manual", label: "Manual", description: "No online checkout — record cash, check, or transfer payments by hand." },
  { id: "stripe", label: "Stripe", description: "Cards, saved cards, recurring billing, refunds (Stripe Connect or API keys)." },
  { id: "square", label: "Square", description: "Cards, recurring plans, refunds via the owner's Square account (OAuth)." },
];

/**
 * Which provider customers check out with. An explicit preference wins when
 * that provider is connected; otherwise Stripe, then Square, then manual.
 */
export const resolvePaymentProvider = (opts: { preference?: string | null; stripeConnected: boolean; squareConnected: boolean }): PaymentProviderId => {
  const { preference, stripeConnected, squareConnected } = opts;
  if (preference === "manual") return "manual";
  if (preference === "stripe" && stripeConnected) return "stripe";
  if (preference === "square" && squareConnected) return "square";
  if (stripeConnected) return "stripe";
  if (squareConnected) return "square";
  return "manual";
};
