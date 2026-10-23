// FEATURE — "when you go to delete a customer, invoice, quote, etc. the
// popup should be in the CRM with the CRM's UI." Replaces the browser's
// native window.confirm() — a plain OS dialog with no branding, no way to
// style it, and (on iOS Safari in particular) an ugly, easy-to-misjudge
// popup — with a real in-app modal matching everything else in this app.
// useConfirm() returns a promise-based confirmAsync() with the same
// call-site ergonomics as confirm() (`if (!(await confirmAsync("..."))) return;`)
// so existing delete handlers only need their one confirm() line swapped,
// plus rendering the returned ConfirmDialog once near the component's root.
import React, { useCallback, useRef, useState } from "react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { AlertTriangle } from "lucide-react";

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // false = a neutral confirmation (no red warning icon/button) for a
  // non-destructive "are you sure" prompt; defaults to true (destructive).
  danger?: boolean;
};

export function useConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirmAsync = useCallback((input: ConfirmOptions | string): Promise<boolean> => {
    const normalized: ConfirmOptions = typeof input === "string" ? { message: input } : input;
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
      setOpts(normalized);
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpts(null);
  };

  const ConfirmDialog = opts ? (
    <Modal open onClose={() => close(false)} title={opts.title || (opts.danger === false ? "Please confirm" : "Are you sure?")} maxW="max-w-sm">
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          {opts.danger !== false && <AlertTriangle size={20} className="text-danger-500 flex-shrink-0 mt-0.5" />}
          <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{opts.message}</div>
        </div>
        <div className="flex gap-2 justify-end">
          <GBtn variant="ghost" onClick={() => close(false)}>{opts.cancelLabel || "Cancel"}</GBtn>
          <GBtn variant={opts.danger !== false ? "danger" : "primary"} onClick={() => close(true)}>{opts.confirmLabel || (opts.danger !== false ? "Delete" : "Confirm")}</GBtn>
        </div>
      </div>
    </Modal>
  ) : null;

  return { confirmAsync, ConfirmDialog };
}
