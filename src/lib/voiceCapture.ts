// Voice input that works on every browser.
//
// BUG FIX (user report — "voice notes, voice chat and speech-to-text with
// Alfred are broken"). Dictation and Voice Mode only used the browser's
// built-in speech recognizer. That recognizer is missing in Firefox and in
// an iPhone home-screen app, and in Chrome-based browsers it fails with
// "network" whenever Google's speech service can't be reached (Brave, many
// work networks, flaky phone data). On those errors both features restarted
// the recognizer forever: the screen said "Listening…" and nothing was ever
// captured. Now:
//   - browserRecognizerUsable() says whether the built-in recognizer can be
//     trusted on this device (it's marked broken for the session the first
//     time it fails with one of those errors), and
//   - when it can't, the microphone is recorded here and turned into text on
//     the server (/api/alfred-transcribe), with the recording stopping by
//     itself once the speaker goes quiet (for Voice Mode turns).
import { supabase } from "./supabase";

const BROKEN_KEY = "crm.browserSpeechBroken";
export const RECOGNIZER_FATAL = new Set(["network", "service-not-allowed", "audio-capture", "language-not-supported", "bad-grammar"]);

export const speechRecognitionCtor = (): any =>
  typeof window === "undefined" ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);

const isIosStandalone = () => {
  if (typeof window === "undefined") return false;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  const standalone = (navigator as any).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  return ios && standalone;
};

export function browserRecognizerUsable(): boolean {
  if (!speechRecognitionCtor()) return false;
  if (isIosStandalone()) return false; // exists there, but never hears anything
  try { if (sessionStorage.getItem(BROKEN_KEY)) return false; } catch { /* storage blocked */ }
  return true;
}
export function markBrowserRecognizerBroken(reason: string) {
  console.warn("[voice] browser speech recognizer failed (" + reason + ") — using server transcription for this session");
  try { sessionStorage.setItem(BROKEN_KEY, reason || "1"); } catch { /* storage blocked */ }
}

export const canRecordAudio = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && !!(window as any).MediaRecorder;

export const pickAudioMime = (): string => {
  const MR: any = typeof window !== "undefined" ? (window as any).MediaRecorder : null;
  if (!MR?.isTypeSupported) return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"].find(t => MR.isTypeSupported(t)) || "";
};

export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  const { data } = await (supabase as any).auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sign in again to use voice.");
  const fd = new FormData();
  fd.append("audio", blob, "voice." + ((blob.type.split("/")[1] || "webm").split(";")[0]));
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  signal?.addEventListener("abort", () => ctl.abort());
  try {
    const res = await fetch("/api/alfred-transcribe", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd, signal: ctl.signal });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.error || `Transcription failed (${res.status})`);
    return String(body?.text || "").trim();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error(signal?.aborted ? "Stopped" : "Turning speech into text took too long — try again.");
    throw e;
  } finally { clearTimeout(timer); }
}

// Records from the microphone. With stopOnSilence, it ends by itself once
// the speaker has said something and then been quiet for silenceMs (or
// returns null if nobody speaks within waitForSpeechMs). onLevel gets 0..1
// for a level meter. stop() ends it early and keeps what was recorded.
export function recordVoice(opts: { stopOnSilence?: boolean; silenceMs?: number; waitForSpeechMs?: number; maxMs?: number; onLevel?: (level: number) => void; onSpeechStart?: () => void } = {}) {
  const { stopOnSilence = false, silenceMs = 1400, waitForSpeechMs = 15000, maxMs = 120000, onLevel, onSpeechStart } = opts;
  let stopFn: () => void = () => {};
  let cancelled = false;
  const result = new Promise<Blob | null>(async (resolve, reject) => {
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } as any });
    } catch (e: any) {
      reject(new Error(e?.name === "NotAllowedError" ? "Microphone access is blocked — allow it for this site in your browser settings." : "Couldn't open the microphone — " + (e?.message || "unknown error")));
      return;
    }
    const mime = pickAudioMime();
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks: Blob[] = [];
    let spoke = false;
    const started = Date.now();
    let lastLoud = Date.now();
    const cleanup = () => {
      if (raf) cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t => t.stop());
      try { ctx?.close(); } catch { /* closed */ }
    };
    mr.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    mr.onstop = () => {
      cleanup();
      if (cancelled || (stopOnSilence && !spoke)) { resolve(null); return; }
      const blob = new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" });
      resolve(blob.size < 800 ? null : blob);
    };
    stopFn = () => { try { if (mr.state !== "inactive") mr.stop(); } catch { /* stopped */ } };
    mr.start(250);
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      ctx = new Ctx();
      const src = ctx!.createMediaStreamSource(stream);
      const analyser = ctx!.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.fftSize);
      // Noise floor learned from the first half second, so a noisy room
      // doesn't count as "talking" and a quiet one isn't cut off.
      let floor = 0.02, samples = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / buf.length);
        const now = Date.now();
        if (now - started < 500) { floor = (floor * samples + rms) / (samples + 1); samples++; }
        const loud = rms > Math.max(0.02, floor * 2.5);
        onLevel?.(Math.min(1, rms * 6));
        if (loud) { lastLoud = now; if (!spoke) { spoke = true; onSpeechStart?.(); } }
        if (stopOnSilence) {
          if (spoke && now - lastLoud > silenceMs) { stopFn(); return; }
          if (!spoke && now - started > waitForSpeechMs) { stopFn(); return; }
        }
        if (now - started > maxMs) { stopFn(); return; }
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // No Web Audio — can't detect silence, so fall back to a fixed length.
      spoke = true;
      if (stopOnSilence) setTimeout(stopFn, 8000);
    }
  });
  return { result, stop: () => stopFn(), cancel: () => { cancelled = true; stopFn(); } };
}
