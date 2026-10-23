// FEATURE — "make it so you don't have to stay inside that page while it's
// auto editing... show the auto editing status in the social section while
// you're doing other stuff, and it can notify you." Auto-Edit's own heavy
// work (ffmpeg.wasm + on-device Whisper, see videoEditor.ts) already runs
// via module-level singletons that don't care about React component
// lifecycles — the actual computation was NEVER tied to whether
// VideoEditorModal was open. What WAS missing: its progress and result
// were only ever written into that one component's local useState, so
// closing the modal (or navigating away, which unmounts it) meant the
// finished result had nowhere to land, and nothing outside the modal could
// show live progress. This store is the fix — the exact same "lift state
// up so it survives navigation" pattern this codebase already uses for
// toasts (App.tsx's root-level toasts/setToasts, which is why a toast
// still fires even after the page that triggered it is gone).
//
// A plain module-level pub-sub singleton (no external state-management
// library) — same shape as videoEditor.ts's own ffmpegInstance/
// loadingPromise singletons, just for job progress instead of the ffmpeg
// engine itself. useSyncExternalStore (React 18 built-in) is the correct,
// supported way to subscribe a component tree to state that lives outside
// React, so a status widget anywhere in the app can read this live.
import { useSyncExternalStore } from "react";
import type { EditorClip, EditorCaption, AspectRatio } from "./videoEditor";

export type AutoEditJobResult = {
  clips: EditorClip[];
  captions: EditorCaption[];
  aspectRatio: AspectRatio;
  summary: string;
};

export type AutoEditJobState = {
  running: boolean;
  phaseLabel: string;
  pct: number; // 0-100, best-effort — see estimateProgress below
  etaSec: number | null;
  startedAt: number | null;
  result: AutoEditJobResult | null;
  error: string | null;
};

const IDLE: AutoEditJobState = {
  running: false,
  phaseLabel: "",
  pct: 0,
  etaSec: null,
  startedAt: null,
  result: null,
  error: null,
};

let state: AutoEditJobState = { ...IDLE };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export const getAutoEditJobState = (): AutoEditJobState => state;
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const startAutoEditJob = (): void => {
  state = { ...IDLE, running: true, startedAt: Date.now(), phaseLabel: "Starting…" };
  notify();
};
export const updateAutoEditJob = (patch: Partial<Pick<AutoEditJobState, "phaseLabel" | "pct" | "etaSec">>): void => {
  if (!state.running) return;
  state = { ...state, ...patch };
  notify();
};
export const finishAutoEditJob = (result: AutoEditJobResult): void => {
  state = { ...state, running: false, phaseLabel: "Done", pct: 100, etaSec: 0, result };
  notify();
};
export const failAutoEditJob = (error: string): void => {
  state = { ...state, running: false, error };
  notify();
};
// Called once the finished/errored job's result has actually been picked
// up (applied into a live editor, or dismissed) — clears it so a stale
// "ready" badge doesn't linger forever.
export const clearAutoEditJob = (): void => {
  state = { ...IDLE };
  notify();
};

export const useAutoEditJob = (): AutoEditJobState =>
  useSyncExternalStore(subscribe, getAutoEditJobState, getAutoEditJobState);

// FEATURE — "show an estimated countdown timer... or the percentage."
// Adaptive, self-correcting estimate built from two known phases (cut N
// source clips, then transcribe M resulting pieces — M isn't known until
// phase 1 finishes, so it's estimated at first and corrected once real).
// Each phase is weighted by how much of this pipeline's real wall-clock
// time it typically takes (transcription usually dominates) — not a fake
// bar that just ticks up on a timer.
const PHASE1_WEIGHT = 0.3; // cutting dead space
const PHASE2_WEIGHT = 0.7; // transcribing + filler-cutting
const DEFAULT_SEC_PER_STEP = 3; // rough prior before any real timing exists this run

export type ProgressEstimator = {
  onPhase1Step: () => void;
  onPhase2Start: (estimatedPieceCount: number) => void;
  onPhase2Step: () => void;
};

// Returns a stateful estimator closed over this ONE run — call its
// onPhase1Step/onPhase2Start/onPhase2Step hooks as runAutoEdit progresses;
// each call updates the shared job store's pct/etaSec itself, so the
// caller just needs to call the right hook at the right point.
export const createProgressEstimator = (phase1Total: number, labelFor: (pct: number) => string): ProgressEstimator => {
  const runStart = Date.now();
  let phase1Done = 0;
  let phase2Total = Math.max(1, Math.round(phase1Total * 1.3)); // corrected once phase 2 actually starts
  let phase2Done = 0;
  let phase2Started = false;

  const publish = () => {
    const phase1Pct = phase1Total > 0 ? Math.min(1, phase1Done / phase1Total) : 1;
    const phase2Pct = phase2Started ? Math.min(1, phase2Done / phase2Total) : 0;
    const overallPct = Math.min(99, Math.round((phase1Pct * PHASE1_WEIGHT + phase2Pct * PHASE2_WEIGHT) * 100));

    const elapsedSec = (Date.now() - runStart) / 1000;
    const stepsDone = phase1Done + phase2Done;
    const secPerStep = stepsDone > 0 ? elapsedSec / stepsDone : DEFAULT_SEC_PER_STEP;
    const stepsRemaining = Math.max(0, (phase1Total - phase1Done)) + Math.max(0, (phase2Started ? phase2Total - phase2Done : phase2Total));
    const etaSec = Math.round(secPerStep * stepsRemaining);

    updateAutoEditJob({ phaseLabel: labelFor(overallPct), pct: overallPct, etaSec });
  };

  return {
    onPhase1Step: () => { phase1Done++; publish(); },
    onPhase2Start: (estimatedPieceCount: number) => { phase2Started = true; phase2Total = Math.max(1, estimatedPieceCount); publish(); },
    onPhase2Step: () => { phase2Done++; publish(); },
  };
};
