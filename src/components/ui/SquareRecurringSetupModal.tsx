import React, { useEffect, useRef, useState } from "react";
import { CreditCard, X, AlertCircle, CheckCircle } from "lucide-react";
import { loadSquareJs, createSquareRecurringPlan } from "../../lib/square";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";

// Recurring-billing counterpart to SquarePaymentModal.tsx — same tokenize
// flow (card details never touch our servers, only a one-time sourceId
// does), but instead of a single charge this creates a Square Customer +
// saved Card + Catalog subscription plan + live Subscription
// (see create_square_recurring_plan in functions/api/square-action.ts).
// Square has no hosted checkout link for subscriptions, so this is meant to
// be opened while the owner has the customer's card in hand (in person).
export function SquareRecurringSetupModal({
  open, onClose, applicationId, locationId, crmCustomerId, amountCents, cadence, description, customerEmail, customerName, onSuccess,
}: {
  open: boolean; onClose: () => void;
  applicationId: string; locationId: string;
  crmCustomerId: string; amountCents: number; cadence: "WEEKLY" | "MONTHLY" | "ANNUAL"; description?: string;
  customerEmail?: string; customerName?: string;
  onSuccess: (subscriptionId: string) => void;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "success" | "error">("loading");
  const [error, setError] = useState("");
  const cardRef = useRef<any>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus("loading");
    setError("");
    (async () => {
      try {
        if (!applicationId || !locationId) throw new Error("Square isn't fully configured — add your Application ID and Location ID in Settings → Integrations → Square.");
        const Square = await loadSquareJs();
        if (cancelled) return;
        const payments = Square.payments(applicationId, locationId);
        const card = await payments.card();
        if (cancelled) return;
        if (mountRef.current) await card.attach(mountRef.current);
        cardRef.current = card;
        if (!cancelled) setStatus("ready");
      } catch (e: any) {
        if (!cancelled) { setError(e?.message || "Failed to load Square"); setStatus("error"); }
      }
    })();
    return () => {
      cancelled = true;
      cardRef.current?.destroy?.().catch(() => {});
      cardRef.current = null;
    };
  }, [open, applicationId, locationId]);

  const start = async () => {
    if (!cardRef.current) return;
    setStatus("processing");
    setError("");
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") throw new Error(result.errors?.[0]?.message || "Card details couldn't be verified");
      const plan = await createSquareRecurringPlan({
        sourceId: result.token, crmCustomerId, amountCents, cadence, description, customerEmail, customerName,
      });
      setStatus("success");
      onSuccess(plan.subscriptionId);
    } catch (e: any) {
      setError(e?.message || "Failed to set up recurring billing");
      setStatus("error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm"><CreditCard size={16} className="text-[#006AFF]" />Set Up Recurring Billing (Square)</div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white"><X size={16} /></button>
        </div>
        {description && <div className="text-xs text-white/50">{description}</div>}
        <div className="text-2xl font-bold">${(amountCents / 100).toFixed(2)} <span className="text-sm text-white/40 font-normal">/ {cadence === "ANNUAL" ? "year" : cadence === "WEEKLY" ? "week" : "month"}</span></div>

        {status === "error" && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-950/30 border border-brand-700/40 text-brand-300 text-xs">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}
        {status === "success" ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-950/30 border border-green-700/40 text-green-300 text-sm">
            <CheckCircle size={16} />Recurring plan started
          </div>
        ) : (
          <>
            <div className="text-[11px] text-white/40">Enter the customer's card now (in person, or over the phone with them reading it out) — Square will bill them automatically going forward.</div>
            <div ref={mountRef} className="min-h-[90px] p-2 rounded-xl bg-white" />
            <GBtn onClick={start} disabled={status !== "ready" && status !== "error"} className="w-full">
              {status === "loading" ? "Loading…" : status === "processing" ? "Starting…" : "Start Recurring Plan"}
            </GBtn>
          </>
        )}
        <div className="text-center text-[10px] text-white/30">🔒 Secured by Square · card details never touch our servers</div>
      </div>
    </Modal>
  );
}
