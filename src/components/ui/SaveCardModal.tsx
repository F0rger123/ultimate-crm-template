import React, { useEffect, useRef, useState } from "react";
import { CreditCard, AlertCircle, CheckCircle } from "lucide-react";
import { loadStripeJs, createStripeCustomer, createSetupIntent } from "../../lib/stripe";
import { supabase } from "../../lib/supabase";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";

// Mirrors StripePaymentModal's flow but for SetupIntent (save card, no charge) —
// used by the client portal to attach a payment method for future/recurring use.
// See lib/stripe.ts's round-12 security comment — the secret key lives
// server-side only now, in functions/api/stripe-action.ts.
export function SaveCardModal({
  open, onClose, publishableKey, stripeAccountId, ownerId, useCallerSession = false, email, name, existingStripeCustomerId,
  onSaved, companyName = "the company", enteredByEmployee = false,
  isRecurringClient = false,
}: {
  open: boolean; onClose: () => void;
  publishableKey: string;
  // Both required for a Stripe Connect owner — see StripePaymentModal.tsx's
  // identical stripeAccountId comment, and lib/stripe.ts's createStripeCustomer/
  // createSetupIntent (ownerId lets the server resolve the right connected
  // account instead of silently falling back to the platform's).
  stripeAccountId?: string;
  ownerId?: string;
  // When true, fetches the CALLER's own Supabase session token and sends it
  // along so the server resolves the real owner identity itself (see
  // stripe-action.ts's resolveCallerOwnerId fallback) rather than trusting
  // `ownerId` above — set this for owner/employee-side callers (e.g.
  // CustomerDetail.tsx, the field portal's in-person card entry). Leave
  // false for the customer's OWN portal session (ClientAuthPortal.tsx),
  // which is a different Supabase Auth realm — its own session token would
  // resolve to nothing useful server-side, so it relies on the already-
  // resolved `ownerId` prop instead.
  useCallerSession?: boolean;
  email: string; name: string; existingStripeCustomerId?: string;
  // consentAt — ISO timestamp the consent checkbox was accepted, passed back
  // so callers can log it onto the customer record (Customer.cardConsentAt,
  // same convention as smsOptInAt) without this modal needing its own
  // Supabase write.
  onSaved: (stripeCustomerId: string, paymentMethodId: string, label: string, consentAt?: string) => void;
  companyName?: string;
  // FEATURE (round 13, item 10) — true when an EMPLOYEE is keying this card
  // in on the customer's behalf (in-person, field portal), not the customer
  // typing their own card into their own portal — the consent wording below
  // reads correctly for both cases.
  enteredByEmployee?: boolean;
  // FEATURE — recurring-service clients must keep a card on file (it can't
  // be removed while their recurring service is active — see the owner-side
  // card management UI in CustomerDetail.tsx), so the consent copy reads
  // differently for them: "required," not "you may ask us to remove it."
  isRecurringClient?: boolean;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "success" | "error">("loading");
  const [error, setError] = useState("");
  // FEATURE (round 13, item 11) — legal consent checkbox, gating Save, on
  // every card-on-file form in the app (this component is the single one
  // used by both the customer self-service flow and the new employee-entry
  // flow below) — protects the owner with an explicit authorization on
  // record before any card is stored for future/recurring charges.
  const [agreed, setAgreed] = useState(false);
  const stripeRef = useRef<any>(null);
  const elementsRef = useRef<any>(null);
  const customerIdRef = useRef<string>("");
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    setError("");
    setAgreed(false);
    // BUG FIX — "I press Add Card on File and it just says Loading forever."
    // createStripeCustomer/createSetupIntent already have their own 20s
    // timeout (stripeAction's AbortController), but loadStripeJs (the
    // <script src="https://js.stripe.com/v3/"> load) had NONE — if that
    // script gets silently blocked (a content blocker, restrictive wifi/
    // firewall, a slow connection) neither its onload nor onerror ever
    // fires, so that promise — and this whole effect — never resolved OR
    // rejected. status stayed "loading" forever with no way out short of
    // closing the modal. A hard 25s deadline around the ENTIRE chain
    // guarantees SOMETHING (success or a visible error) within a bounded
    // time regardless of which step actually hung.
    const withDeadline = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timed out loading the card form — check your connection and try again.")), ms))]);
    (async () => {
      try {
        if (!publishableKey) throw new Error("Stripe is not fully configured.");
        await withDeadline((async () => {
          const accessToken = useCallerSession ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
          const customerId = existingStripeCustomerId || (await createStripeCustomer(email, name, ownerId, accessToken)).id;
          if (cancelled) return;
          customerIdRef.current = customerId;
          const intent = await createSetupIntent(customerId, ownerId, accessToken);
          if (cancelled) return;
          const stripe = await loadStripeJs(publishableKey, stripeAccountId);
          if (cancelled) return;
          stripeRef.current = stripe;
          const elements = stripe.elements({ clientSecret: intent.client_secret });
          elementsRef.current = elements;
          // SECURITY FIX (owner report — CRITICAL) — "I pressed Add Card on
          // File as an employee and it showed my personal card." Stripe Link
          // autofills/one-click-fills whatever saved card the BROWSER's own
          // Link session belongs to, regardless of which merchant Customer
          // this card is being saved against — on a shared field-portal
          // device, that surfaces WHOEVER last used Link there (an owner
          // testing this, a different employee, a past customer) as a
          // selectable "Use this card" option for an unrelated person's
          // card-on-file entry. Restricting payment_method_types to "card"
          // server-side (create_setup_intent) does NOT stop this — Link
          // still redeems as a "card" payment method under the hood, so the
          // only real fix is disabling Link on the Element itself
          // (wallets.link: "never", confirmed via Stripe's own Payment
          // Element options reference). Only disabled for owner/employee
          // sessions (useCallerSession) — a customer entering their OWN card
          // on their OWN device keeps Link as the genuine convenience it's
          // meant to be.
          const el = elements.create("payment", useCallerSession ? { wallets: { link: "never" } } : undefined);
          if (mountRef.current) el.mount(mountRef.current);
          setStatus("ready");
        })(), 25000);
      } catch (e: any) {
        if (!cancelled) { setError(e.message || "Failed to start"); setStatus("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [open, publishableKey, stripeAccountId, ownerId, email, name, existingStripeCustomerId]);

  const confirm = async () => {
    if (!stripeRef.current || !elementsRef.current || !agreed) return;
    setStatus("processing");
    setError("");
    const { error: confirmError, setupIntent } = await stripeRef.current.confirmSetup({
      elements: elementsRef.current,
      redirect: "if_required",
    });
    if (confirmError) { setError(confirmError.message || "Failed to save card"); setStatus("ready"); return; }
    setStatus("success");
    onSaved(customerIdRef.current, setupIntent?.payment_method || "", "Card on file", new Date().toISOString());
  };

  return (
    <Modal open={open} onClose={onClose} title="Save Payment Method" maxW="max-w-md">
      <div className="space-y-4">
        {status === "loading" && <div className="text-center py-8 text-white/50 text-sm">Loading…</div>}
        {status === "error" && (
          <div className="p-3 rounded-xl bg-brand-950/30 border border-brand-700/40 text-brand-300 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" /><span>{error}</span>
          </div>
        )}
        {status === "success" ? (
          <div className="text-center py-8 space-y-3">
            <CheckCircle size={40} className="text-green-400 mx-auto" />
            <div className="font-semibold text-green-300">Card saved for future payments</div>
          </div>
        ) : (
          <>
            {(status === "ready" || status === "processing") && (
              /* FEATURE — legal consent block, shown ABOVE the card form and
                 required before it (and the Save button) becomes usable.
                 Recurring-service clients get "required, cannot be removed"
                 wording instead of the normal "you can ask us to remove it"
                 — matches the owner-side delete-card UI (CustomerDetail.tsx)
                 which withholds the plain delete option for these customers. */
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-0.5 flex-shrink-0" />
                <span className="text-[12px] text-white/70 leading-relaxed">
                  {isRecurringClient
                    ? `Recurring service requires a card on file — this cannot be removed while your recurring service is active. By adding a card, you agree ${companyName} may keep it on file and charge it for future services, invoices, tips, and any applicable fees.`
                    : enteredByEmployee
                      ? `I confirm the customer has authorized ${companyName} to keep this card on file. By adding a card, we may keep it on file for future charges (including invoices, tips, and any applicable fees) unless the customer asks us to remove it.`
                      : `By adding a card, you agree ${companyName} may keep it on file for future charges (including invoices, tips, and any applicable fees) unless you ask us to remove it.`}
                </span>
              </label>
            )}
            {/* Card form stays mounted (Stripe Elements needs its DOM node
                present) but is visually locked and non-interactive until the
                consent checkbox above is checked. */}
            <div
              ref={mountRef}
              className={
                (status === "loading" || status === "error" ? "hidden " : "") +
                (!agreed ? "opacity-30 pointer-events-none select-none transition-opacity" : "transition-opacity")
              }
            />
            {!agreed && (status === "ready" || status === "processing") && (
              <div className="text-[10px] text-white/40 text-center -mt-2">Agree to the terms above to enter your card</div>
            )}
            {(status === "ready" || status === "processing") && (
              <GBtn onClick={confirm} disabled={status === "processing" || !agreed} className="w-full !justify-center !py-3">
                <CreditCard size={16} />{status === "processing" ? "Saving…" : "Save Card"}
              </GBtn>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
