import React, { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Modal } from "./Modal";
import { GInput } from "./GInput";
import { GTxt } from "./GTxt";
import { GBtn } from "./GBtn";
import { fmt } from "../../lib/utils";

export interface InvoicePreviewData {
  customerName: string;
  address: string;
  amount: number;
  companyName: string;
  payLink: string;
}

// Shown before any invoice email actually sends — lets the owner see the
// branded template and tweak the subject/body first, instead of an email
// going out the instant they click "Send Invoice".
export function InvoicePreviewModal({
  open, onClose, onConfirm, data, sending = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (subject: string, bodyHtml: string) => void;
  data: InvoicePreviewData | null;
  sending?: boolean;
}) {
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");

  useEffect(() => {
    if (open && data) {
      setSubject(`Invoice — ${data.companyName}`);
      setBodyText(
        `Hi ${data.customerName},\n\nThanks for choosing us! Your service at ${data.address} is complete.\n\nAmount due: ${fmt(data.amount)}\n\nYou can view and pay your invoice using the button below.`
      );
    }
  }, [open, data]);

  if (!data) return null;
  const bodyHtml = bodyText.split("\n").map(line => line.trim() ? `<p>${line}</p>` : "").join("");

  return (
    <Modal open={open} onClose={onClose} title="Preview Invoice" maxW="max-w-lg">
      <div className="space-y-4">
        <div>
          <label className="text-xs text-white/60 mb-1 block">Subject</label>
          <GInput value={subject} onChange={e => setSubject(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Message</label>
          <GTxt rows={6} value={bodyText} onChange={(e: any) => setBodyText(e.target.value)} />
        </div>

        {/* Branded preview — exactly what the customer will see, rendered live */}
        <div>
          <label className="text-xs text-white/60 mb-1 block">Preview</label>
          <div className="rounded-2xl overflow-hidden border border-brand-900/30 bg-black">
            <div className="bg-brand-600 px-5 py-4 text-center text-brand-fg">
              <div className="text-base font-extrabold text-brand-fg">{data.companyName}</div>
              <div className="text-[11px] text-brand-fg/70 mt-0.5">Invoice</div>
            </div>
            <div className="px-5 py-4 bg-neutral-950 text-sm text-white/85 space-y-2">
              {bodyText.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
              <div className="text-center pt-2">
                <span className="inline-block bg-brand-600 text-brand-fg text-xs font-bold px-6 py-2.5 rounded-lg">View & Pay Invoice</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <GBtn variant="ghost" onClick={onClose}>Cancel</GBtn>
          <GBtn onClick={() => onConfirm(subject, bodyHtml)} disabled={sending}>
            <Send size={13} className="inline mr-1.5" />{sending ? "Sending…" : "Send"}
          </GBtn>
        </div>
      </div>
    </Modal>
  );
}
