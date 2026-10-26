// Pop-up for an Alfred error (see lib/alfredErrors.ts) — shown instead of
// posting the error into the conversation.
import React, { useState } from "react";
import { AlertTriangle, RefreshCw, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import type { AlfredError } from "../../lib/alfredErrors";

export function AlfredErrorPopup({ error, onClose, onRetry, onOpenSettings }: { error: AlfredError | null; onClose: () => void; onRetry?: (text: string) => void; onOpenSettings?: () => void }) {
  const [showDetails, setShowDetails] = useState(false);
  if (!error) return null;
  const settingsHelps = error.kind === "credit" || error.kind === "limit" || error.kind === "key" || error.kind === "no_ai" || error.kind === "timeout" || error.kind === "other";
  return (
    <Modal open={!!error} onClose={() => { setShowDetails(false); onClose(); }} title={error.title} maxW="max-w-md">
      <div className="space-y-4" data-alfred-error={error.kind}>
        <div className="flex gap-3">
          <AlertTriangle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-white/80 leading-relaxed">{error.message}</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {settingsHelps && onOpenSettings && (
            <GBtn variant="ghost" onClick={() => { setShowDetails(false); onClose(); onOpenSettings(); }}><Settings size={14} className="inline mr-1.5" />AI settings</GBtn>
          )}
          {error.retryText && onRetry && (
            <GBtn onClick={() => { const t = error.retryText!; setShowDetails(false); onClose(); onRetry(t); }}><RefreshCw size={14} className="inline mr-1.5" />Try again</GBtn>
          )}
          {!error.retryText && <GBtn onClick={() => { setShowDetails(false); onClose(); }}>OK</GBtn>}
        </div>
        <button type="button" onClick={() => setShowDetails(v => !v)} className="text-[11px] text-white/40 hover:text-white/70 flex items-center gap-1">
          {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}Details
        </button>
        {showDetails && <pre className="text-[11px] text-white/50 bg-black/40 border border-white/10 rounded-lg p-2 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{error.details}</pre>}
      </div>
    </Modal>
  );
}
