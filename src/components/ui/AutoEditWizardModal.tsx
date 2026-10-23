// FEATURE — "on the social section, add a button for auto edit... a quick
// wizard that asks you questions: what style, how long, upload your clips
// and audio, and describe in text how you want it." Step-by-step, one
// question per screen (BUG FIX — "not just a big huge pop-up where I ask
// all the questions at once") — each Next commits that answer and moves
// on, same as a real conversational wizard. Collects everything, then
// hands the result to VideoEditorModal's own `initialAutoEdit` prop, which
// loads the clips in and runs the SAME real Auto-Edit pipeline (dead-
// space/filler cutting, real captions, transitions, color grade, camera
// flicker, target-length fit) already used everywhere else in the editor
// — this wizard is a fast on-ramp into that, not a second, separate,
// lower-quality implementation.
import React, { useState, useRef } from "react";
import { Sparkles, Upload, Music, X, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { AUTO_EDIT_TEMPLATES } from "../../lib/videoEditor";

export type AutoEditWizardResult = {
  files: File[];
  musicFile?: File | null;
  stylePrompt?: string;
  templateId?: string | null;
  targetDurationSec?: number | null;
  emailOnDone?: boolean;
};

const LENGTH_OPTIONS: { v: number | null; l: string }[] = [
  { v: 5, l: "5 sec" },
  { v: 10, l: "10 sec" },
  { v: 15, l: "15 sec" },
  { v: 30, l: "30 sec" },
  { v: 60, l: "60 sec" },
  { v: null, l: "No limit" },
];

const STEPS = ["Style", "Length", "Clips", "Music", "Describe"] as const;

export function AutoEditWizardModal({ open, onClose, onComplete, toast }: {
  open: boolean;
  onClose: () => void;
  onComplete: (result: AutoEditWizardResult) => void;
  toast?: (msg: string, tone?: any) => void;
}) {
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState<string | null>(null);
  // BUG FIX — "auto edit is broken... finishes way too fast and doesn't
  // even do it right." Root cause: this defaulted to 30s, and
  // fitClipsToDuration (videoEditor.ts) hard-trims everything past 2x the
  // target off the END of the timeline once speed-up alone can't fit it —
  // for any footage over ~60s (an easy amount to upload without noticing
  // this question), the vast majority of it was silently discarded, sped
  // up 2x, and the rest thrown away. Defaulting to "No limit" (matches
  // the manual editor panel's own default) means duration is never
  // touched unless the owner deliberately picks a length.
  const [targetDurationSec, setTargetDurationSec] = useState<number | null>(null);
  // FEATURE — "press Custom and type the number of seconds." isCustomLength
  // tracks whether the Custom button itself is the active selection
  // (separate from targetDurationSec, since typing "30" into Custom must
  // stay visually distinct from picking the 30 sec preset button).
  const [isCustomLength, setIsCustomLength] = useState(false);
  const [customLengthInput, setCustomLengthInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [stylePrompt, setStylePrompt] = useState("");
  // FEATURE — "send an email when it's done, depending on how long it
  // is." Explicit opt-in here; VideoEditorModal also auto-emails
  // regardless of this if a run ends up taking 60s+, so a long run still
  // reaches the owner even if they didn't think to check this first.
  const [emailOnDone, setEmailOnDone] = useState(false);
  const clipsInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(0); setTemplateId(null); setTargetDurationSec(null); setIsCustomLength(false);
    setCustomLengthInput(""); setFiles([]); setMusicFile(null); setStylePrompt(""); setEmailOnDone(false);
  };

  const handleClipFiles = (list: FileList | null) => {
    if (!list) return;
    const valid = Array.from(list).filter(f => f.type.startsWith("video/"));
    if (valid.length < list.length) toast?.("Some files weren't videos — skipped", "yellow");
    setFiles(prev => [...prev, ...valid]);
  };

  const submit = () => {
    if (files.length === 0) { toast?.("Upload at least one video clip first", "red"); setStep(2); return; }
    let finalTarget = targetDurationSec;
    if (isCustomLength) {
      const n = parseInt(customLengthInput, 10);
      if (!Number.isFinite(n) || n <= 0) { toast?.("Enter a valid number of seconds for the custom length", "red"); setStep(1); return; }
      finalTarget = n;
    }
    onComplete({ files, musicFile, stylePrompt: stylePrompt.trim() || undefined, templateId, targetDurationSec: finalTarget, emailOnDone });
    reset();
    onClose();
  };

  const goNext = () => {
    if (step === 1 && isCustomLength) {
      const n = parseInt(customLengthInput, 10);
      if (!Number.isFinite(n) || n <= 0) { toast?.("Enter a valid number of seconds first", "red"); return; }
    }
    if (step === 2 && files.length === 0) { toast?.("Upload at least one video clip to continue", "red"); return; }
    if (step === STEPS.length - 1) { submit(); return; }
    setStep(s => s + 1);
  };
  const goBack = () => { if (step === 0) { onClose(); return; } setStep(s => s - 1); };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Auto Edit" maxW="max-w-lg">
      <div className="space-y-5">
        {/* Step progress — dots, not a percentage, since this is only 5
            short questions and dots make "which question am I on" legible
            at a glance. */}
        <div className="flex items-center justify-center gap-1.5 -mt-1">
          {STEPS.map((s, i) => (
            <div key={s} className={"h-1.5 rounded-full transition-all " + (i === step ? "w-6 bg-brand-500 text-brand-fg" : i < step ? "w-1.5 bg-brand-700 text-brand-fg" : "w-1.5 bg-white/15")} />
          ))}
        </div>
        <div className="text-[10px] text-white/35 text-center -mt-3">Question {step + 1} of {STEPS.length}</div>

        {/* 1 — style */}
        {step === 0 && (
          <div>
            <div className="text-sm font-semibold text-white/85 mb-3 flex items-center gap-1.5"><Sparkles size={13} className="text-brand-400" />What style?</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setTemplateId(null)} className={"text-left p-2.5 rounded-xl border transition " + (templateId === null ? "bg-brand-950/40 border-brand-600/60" : "bg-black/30 border-white/10 hover:border-white/25")}>
                <div className="text-xs font-medium text-white/85">No template</div>
                <div className="text-[10px] text-white/45 mt-0.5">Just describe it later, or use the defaults.</div>
              </button>
              {AUTO_EDIT_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplateId(t.id)} className={"text-left p-2.5 rounded-xl border transition " + (templateId === t.id ? "bg-brand-950/40 border-brand-600/60" : "bg-black/30 border-white/10 hover:border-white/25")}>
                  <div className="text-xs font-medium text-white/85">{t.name}</div>
                  <div className="text-[10px] text-white/45 mt-0.5 line-clamp-2">{t.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 2 — length */}
        {step === 1 && (
          <div>
            <div className="text-sm font-semibold text-white/85 mb-3 flex items-center gap-1.5"><Clock size={13} className="text-brand-400" />How long?</div>
            <div className="grid grid-cols-4 gap-1.5">
              {LENGTH_OPTIONS.map(opt => (
                <button key={opt.l} onClick={() => { setIsCustomLength(false); setTargetDurationSec(opt.v); }} className={"py-2 rounded-lg text-[11px] font-semibold border transition " + (!isCustomLength && targetDurationSec === opt.v ? "bg-brand-900/50 border-brand-600/60 text-brand-200" : "bg-black/30 border-white/10 text-white/50 hover:border-white/25")}>
                  {opt.l}
                </button>
              ))}
              <button onClick={() => setIsCustomLength(true)} className={"py-2 rounded-lg text-[11px] font-semibold border transition " + (isCustomLength ? "bg-brand-900/50 border-brand-600/60 text-brand-200" : "bg-black/30 border-white/10 text-white/50 hover:border-white/25")}>
                Custom
              </button>
            </div>
            {isCustomLength && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="number"
                  min={1}
                  value={customLengthInput}
                  onChange={e => setCustomLengthInput(e.target.value)}
                  placeholder="Seconds"
                  className="w-28 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/25"
                  autoFocus
                />
                <span className="text-[11px] text-white/40">seconds</span>
              </div>
            )}
            <div className="text-[10px] text-white/35 mt-3">Auto-Edit speeds up and trims to hit this if your footage runs long — never pads a shorter result out.</div>
          </div>
        )}

        {/* 3 — clips */}
        {step === 2 && (
          <div>
            <div className="text-sm font-semibold text-white/85 mb-3 flex items-center gap-1.5"><Upload size={13} className="text-brand-400" />Upload your clips</div>
            <input ref={clipsInputRef} type="file" accept="video/*" multiple className="hidden" onChange={e => { handleClipFiles(e.target.files); e.target.value = ""; }} />
            <button onClick={() => clipsInputRef.current?.click()} className="w-full py-8 rounded-xl border-2 border-dashed border-brand-700/40 bg-brand-950/10 hover:bg-brand-950/20 transition flex flex-col items-center gap-1.5 text-brand-300">
              <Upload size={22} />
              <span className="text-xs font-medium">{files.length > 0 ? `${files.length} clip${files.length > 1 ? "s" : ""} added — tap to add more` : "Tap to select video clips"}</span>
            </button>
            {files.length > 0 && (
              <div className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <div key={f.name + i} className="flex items-center justify-between text-[11px] bg-black/30 border border-white/10 rounded-lg px-2 py-1.5">
                    <span className="truncate text-white/70">{f.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, x) => x !== i))} className="text-white/40 hover:text-brand-400 flex-shrink-0 ml-2"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4 — audio */}
        {step === 3 && (
          <div>
            <div className="text-sm font-semibold text-white/85 mb-3 flex items-center gap-1.5"><Music size={13} className="text-brand-400" />Background music</div>
            <input ref={musicInputRef} type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) setMusicFile(f); e.target.value = ""; }} />
            {musicFile ? (
              <div className="flex items-center justify-between text-[11px] bg-black/30 border border-white/10 rounded-lg px-2.5 py-2">
                <span className="truncate text-white/70">{musicFile.name}</span>
                <button onClick={() => setMusicFile(null)} className="text-white/40 hover:text-brand-400 flex-shrink-0 ml-2"><X size={12} /></button>
              </div>
            ) : (
              <button onClick={() => musicInputRef.current?.click()} className="w-full py-8 rounded-xl border-2 border-dashed border-brand-700/40 bg-brand-950/10 hover:bg-brand-950/20 transition flex flex-col items-center gap-1.5 text-brand-300">
                <Music size={22} />
                <span className="text-xs font-medium">Tap to add a music track</span>
              </button>
            )}
            <div className="text-[10px] text-white/35 mt-3">Optional — press Next to skip.</div>
          </div>
        )}

        {/* 5 — describe */}
        {step === 4 && (
          <div>
            <div className="text-sm font-semibold text-white/85 mb-3">Describe how you want it</div>
            <textarea
              value={stylePrompt}
              onChange={e => setStylePrompt(e.target.value)}
              placeholder='e.g. "fast cuts, cinematic filter, muffled sound effect on the intro clip"'
              rows={3}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white placeholder-white/25 resize-none"
              autoFocus
            />
            <div className="text-[10px] text-white/35 mt-1.5">Real keyword matching, no API key — covers pacing, captions, color grade, camera flicker, slow-mo/speed-up, and sound effects. Overrides the style you picked wherever it's more specific. Optional — leave blank to skip.</div>

            {/* FEATURE — "make it so you don't have to stay inside that
                page... notify you... send an email when it's done." No need
                to wait here — progress shows on the Social page while it
                runs, and a long run emails you automatically either way. */}
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input type="checkbox" checked={emailOnDone} onChange={e => setEmailOnDone(e.target.checked)} className="w-4 h-4 accent-brand-600 flex-shrink-0" />
              <span className="text-xs text-white/60">Email me when it's ready — you can close this and do other stuff while it runs</span>
            </label>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <GBtn variant="ghost" onClick={goBack} className="!px-4"><ChevronLeft size={14} className="inline" />{step === 0 ? "Cancel" : "Back"}</GBtn>
          <GBtn onClick={goNext} className="flex-1 !py-3 !text-sm">
            {step === STEPS.length - 1 ? <><Sparkles size={14} className="inline mr-1.5" />Create My Video</> : <>Next<ChevronRight size={14} className="inline ml-1" /></>}
          </GBtn>
        </div>
      </div>
    </Modal>
  );
}
