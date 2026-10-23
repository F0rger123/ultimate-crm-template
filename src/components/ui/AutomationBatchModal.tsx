// AutomationBatchModal.tsx — owner review gate for automation sends.
// Every automation batch (useAutomationEngine.ts) stops here instead of
// sending straight out; nothing goes to a customer until "Send All" is
// clicked. Guards against exactly the spam incident this app has already
// been through once.
import React, { useState } from "react";
import { Send, X, Pause, Users } from "lucide-react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import type { PendingAutomationBatch } from "../../hooks/useAutomationEngine";

const CATEGORY_LABELS: Record<string, string> = {
  payment_overdue: "Payment overdue",
  estimate_followup: "Estimate follow-up",
  abandoned_estimate: "Abandoned estimate",
  review_request: "Review request",
  job_reminder: "Job reminder",
  job_reminder_morning: "Job reminder (morning of)",
  maintenance: "Maintenance reminder",
  reengage: "Re-engagement",
};

export function AutomationBatchModal({ batch, onSendAll, onSkip, onPause }: {
  batch: PendingAutomationBatch;
  onSendAll: () => Promise<void>;
  onSkip: () => void;
  onPause: () => void;
}) {
  const [sending, setSending] = useState(false);
  const preview = batch.items.slice(0, 5);
  const remaining = batch.items.length - preview.length;

  const handleSendAll = async () => {
    setSending(true);
    try { await onSendAll(); } finally { setSending(false); }
  };

  return (
    // BUG FIX — onClose was a hardcoded no-op, so the Modal's own X/close
    // button (and backdrop click) visibly did nothing, which read as "the
    // X button is broken." Wired to the same skip path as "Skip This
    // Batch" — closing this modal any way other than Send All should mean
    // the same thing: skip it, don't just hide it and re-show it later.
    <Modal open={true} onClose={sending ? () => {} : onSkip} title="Review Before Sending" maxW="max-w-md">
      <div className="space-y-4">
        {batch.items.length > 0 && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-950/20 border border-yellow-700/30">
            <Users size={20} className="text-yellow-400 flex-shrink-0" />
            <div className="text-sm text-yellow-200">
              <span className="font-bold">{batch.items.length}</span> {batch.items.length === 1 ? "message is" : "messages are"} about to go out. Nothing sends until you approve.
            </div>
          </div>
        )}

        {batch.heldBackCount > 0 && (
          <div className="p-3 rounded-xl bg-brand-950/20 border border-brand-700/30 text-xs text-brand-200">
            <span className="font-bold">{batch.heldBackCount}</span> more {batch.heldBackCount === 1 ? "send was" : "sends were"} held back — you've hit today's Max Automation Sends Per Day limit. Raise it in Settings → Automations if this was a planned mass send.
          </div>
        )}

        {batch.campaignWarning && (
          <div className="p-3 rounded-xl bg-orange-950/20 border border-orange-700/30 text-xs text-orange-200">
            ⚠️ {batch.campaignWarning}
          </div>
        )}

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {preview.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/5 text-xs">
              <div className="min-w-0">
                <div className="font-medium text-white/80 truncate">{item.customerName}</div>
                <div className="text-white/40 truncate">{CATEGORY_LABELS[item.category] || item.autoName} · {item.channel === "email" ? "📧" : "📱"}</div>
              </div>
              <div className="text-[10px] text-white/30 flex-shrink-0">{item.autoName}</div>
            </div>
          ))}
          {remaining > 0 && (
            <div className="text-center text-xs text-white/40 py-1.5">+ {remaining} more</div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {batch.items.length > 0 && (
            <GBtn onClick={handleSendAll} disabled={sending} className="w-full !justify-center">
              <Send size={14} className="inline mr-1.5" />{sending ? "Sending…" : `Send All (${batch.items.length})`}
            </GBtn>
          )}
          <button onClick={onSkip} disabled={sending}
            className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            <X size={14} />Skip This Batch
          </button>
          <button onClick={onPause} disabled={sending}
            className="w-full py-2.5 rounded-xl bg-brand-950/30 hover:bg-brand-900/40 border border-brand-700/30 text-brand-300 hover:text-brand-200 text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-1.5">
            <Pause size={14} />Pause Automations
          </button>
        </div>
      </div>
    </Modal>
  );
}
