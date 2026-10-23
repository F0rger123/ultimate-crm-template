import React, { useEffect, useRef, useState } from "react";
import { CreditCard, X, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { loadSquareJs, createSquarePayment } from "../../lib/square";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";

// Square counterpart to StripePaymentModal.tsx — same shape, same security
// model (amount verified server-side from the invoice when invoiceId is
// given, tip added on top, card details tokenized client-side by Square's
// own SDK and never touch this app's servers). Square's Web Payments SDK
// mounts a card form into a container div and returns a one-time `sourceId`
// on tokenize(), which functions/api/square-action.ts exchanges for a real
// charge using the owner's Square access token (server-side only).
export function SquarePaymentModal({
  open, onClose, applicationId, locationId, amount, description = "",
  invoiceId, tipCents = 0, ownerId, onSuccess, payment: paymentChoice,
}: {
  open: boolean; onClose: () => void;
  applicationId: string;
  locationId: string;
  amount: number; description?: string;
  invoiceId?: string;
  tipCents?: number;
  payment?: { payType?: string; promoId?: string; referrerId?: string };
  ownerId?: string;
  onSuccess: (paymentId: string) => void;
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

  const pay = async () => {
    if (!cardRef.current) return;
    setStatus("processing");
    setError("");
    try {
      const result = await cardRef.current.tokenize();
      if (result.status !== "OK") {
        throw new Error(result.errors?.[0]?.message || "Card details couldn't be verified");
      }
      const payment = await createSquarePayment({
        sourceId: result.token,
        invoiceId,
        amountCents: invoiceId ? undefined : Math.round(amount * 100),
        tipCents: Math.round(tipCents),
        description,
        ownerId,
        ...(paymentChoice || {}),
      });
      setStatus("success");
      onSuccess(payment.id);
    } catch (e: any) {
      setError(e?.message || "Payment failed");
      setStatus("error");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm"><CreditCard size={16} className="text-[#006AFF]" />Pay with Square</div>
          <button onClick={onClose} className="p-1 text-white/40 hover:text-white"><X size={16} /></button>
        </div>
        {description && <div className="text-xs text-white/50">{description}</div>}
        <div className="text-2xl font-bold">${(amount + tipCents / 100).toFixed(2)}</div>

        {status === "error" && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-brand-950/30 border border-brand-700/40 text-brand-300 text-xs">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />{error}
          </div>
        )}
        {status === "success" ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-950/30 border border-green-700/40 text-green-300 text-sm">
            <CheckCircle size={16} />Payment successful
          </div>
        ) : (
          <>
            <div ref={mountRef} className="min-h-[90px] p-2 rounded-xl bg-white" />
            <GBtn onClick={pay} disabled={status !== "ready" && status !== "error"} className="w-full">
              {(status === "loading" || status === "processing") && <Loader2 size={16} className="inline animate-spin mr-1.5 -mt-0.5" />}{status === "loading" ? "Loading…" : status === "processing" ? "Processing payment…" : `Pay $${(amount + tipCents / 100).toFixed(2)}`}
            </GBtn>
          </>
        )}
        <div className="text-center text-[10px] text-white/30">🔒 Secured by Square · card details never touch our servers</div>
      </div>
    </Modal>
  );
}
