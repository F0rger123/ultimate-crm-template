import React, { useEffect, useRef, useState } from "react";
import { Mic, Play, Pause, Send, Trash2, Square } from "lucide-react";
import { browserRecognizerUsable, markBrowserRecognizerBroken, RECOGNIZER_FATAL, recordVoice, transcribeAudio, canRecordAudio } from "../../lib/voiceCapture";

// Records and transcribes voice input — Whisper API when an OpenAI key is
// configured (more accurate, works on any browser), otherwise the browser's
// built-in SpeechRecognition (no key needed, Chromium-based browsers only).
//
// Two modes:
// - "dictate" (STT): continuous listening with live interim transcription
//   shown as the user speaks. Keeps listening (auto-restarting if the
//   browser's recognizer times out on silence) until the user presses the
//   button again — never stops on its own. On stop, the full text is pushed
//   into the input box via onTranscript(text, false) for the user to edit
//   and send themselves.
// - "note": records audio. On stop it's transcribed on the server right away;
//   the user can play it back, read/fix the transcript, and press Send (or
//   Discard). Send calls onTranscript(text, true).
export function VoiceMicButton({ onTranscript, apiKey, mode = "dictate", holdToRecord = false, dense = false, label, autoStart = false, onDone }: { onTranscript?: (text: string, autoSend: boolean) => void; apiKey?: any; mode?: "dictate" | "note"; holdToRecord?: boolean; dense?: boolean; label?: string; autoStart?: boolean; onDone?: () => void }) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pendingAudioUrl, setPendingAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [liveText, setLiveText] = useState("");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef("");
  const finalTextRef = useRef("");
  const keepListeningRef = useRef(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // FEATURE 10 (mobile round 7) — the "waveform" was 4 static CSS-pulsing
  // bars with no relationship to the actual mic input; SpeechRecognition
  // itself doesn't expose audio levels, so a real waveform needs its own
  // getUserMedia stream feeding a Web Audio AnalyserNode, sampled on an
  // animation frame. Falls back to a flat/idle bar set if the mic can't be
  // opened a second time for any reason — recognition itself is unaffected.
  const waveStreamRef = useRef<MediaStream | null>(null);
  const waveCtxRef = useRef<AudioContext | null>(null);
  const waveRafRef = useRef<number | null>(null);
  const [waveLevels, setWaveLevels] = useState<number[]>([4, 4, 4, 4, 4]);

  const SpeechRecognitionCtor = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

  const transcribeWhisper = async (blob: Blob): Promise<string> => {
    const fd = new FormData();
    fd.append("file", blob, "voice.webm");
    fd.append("model", "whisper-1");
    fd.append("language", "en");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey },
      body: fd,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Transcription failed");
    return (data.text || "").trim();
  };

  const stopTimer = () => { clearInterval(timerRef.current); timerRef.current = null; };

  const startWaveVisualizer = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      waveStreamRef.current = stream;
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      waveCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const bars = 5;
      const chunk = Math.max(1, Math.floor(data.length / bars));
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const levels = Array.from({ length: bars }, (_, i) => {
          const slice = data.slice(i * chunk, (i + 1) * chunk);
          const avg = slice.reduce((s, v) => s + v, 0) / (slice.length || 1);
          return Math.max(4, Math.min(24, Math.round((avg / 255) * 24)));
        });
        setWaveLevels(levels);
        waveRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch { /* second mic grab failed — dictation still works, bars stay idle */ }
  };
  const stopWaveVisualizer = () => {
    if (waveRafRef.current) cancelAnimationFrame(waveRafRef.current);
    waveRafRef.current = null;
    waveStreamRef.current?.getTracks().forEach(t => t.stop());
    waveStreamRef.current = null;
    try { waveCtxRef.current?.close(); } catch { /* already closed */ }
    waveCtxRef.current = null;
    setWaveLevels([4, 4, 4, 4, 4]);
  };

  // Dictation without the browser's recognizer (see lib/voiceCapture.ts):
  // record, and when the owner presses stop, the server turns it into text,
  // which lands in the text box like normal dictation.
  const serverDictRef = useRef<ReturnType<typeof recordVoice> | null>(null);
  const dictPrefixRef = useRef("");
  const startServerDictation = (keepText = "") => {
    if (!canRecordAudio()) { alert("This browser can't use the microphone. Update it, or use your keyboard's mic button."); setRecording(false); onDone?.(); return; }
    dictPrefixRef.current = keepText;
    setLiveText(keepText ? keepText + " …" : "");
    const h = recordVoice({ maxMs: 300000, onLevel: lv => setWaveLevels(Array.from({ length: 5 }, (_, i) => Math.max(4, Math.min(24, Math.round(lv * 24 * (0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 120 + i)))))))) });
    serverDictRef.current = h;
    setRecording(true);
    h.result.catch((e: any) => { serverDictRef.current = null; setRecording(false); alert(e?.message || "Couldn't use the microphone"); onDone?.(); });
  };
  const finishServerDictation = async () => {
    const h = serverDictRef.current;
    serverDictRef.current = null;
    if (!h) return;
    h.stop();
    setRecording(false);
    setProcessing(true);
    try {
      const blob = await h.result.catch(() => null);
      const heard = blob ? await transcribeAudio(blob) : "";
      const text = [dictPrefixRef.current, heard].filter(Boolean).join(" ").trim();
      if (text) onTranscript?.(text, false);
      else if (!dictPrefixRef.current) alert("Didn't catch anything — try again a little closer to the microphone.");
    } catch (e: any) {
      if (dictPrefixRef.current) onTranscript?.(dictPrefixRef.current, false);
      alert(e?.message || "Couldn't turn that into text.");
    } finally {
      setProcessing(false); setLiveText(""); dictPrefixRef.current = ""; onDone?.();
    }
  };

  const startDictateRecognition = () => {
    if (!browserRecognizerUsable()) { startServerDictation(); return; }
    finalTextRef.current = "";
    setLiveText("");
    keepListeningRef.current = true;
    const startOne = () => {
      const rec = new SpeechRecognitionCtor();
      rec.lang = "en-US";
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalTextRef.current += t + " ";
          else interim += t;
        }
        setLiveText((finalTextRef.current + interim).trim());
      };
      rec.onerror = (e: any) => {
        if (e.error === "not-allowed") { keepListeningRef.current = false; alert("Microphone access denied"); return; }
        // The browser's recognizer can't work here (no connection to its
        // speech service, etc.) — it used to restart forever and hear
        // nothing. Keep what it already heard and record the rest instead.
        if (RECOGNIZER_FATAL.has(e.error)) {
          markBrowserRecognizerBroken(e.error);
          keepListeningRef.current = false;
          try { rec.abort(); } catch { /* stopped */ }
          stopWaveVisualizer();
          startServerDictation(finalTextRef.current.trim());
        }
      };
      // BLOCKER 6 (mobile round 9) — root cause of "dictation cuts off the
      // message": the browser recognizer times out after a few seconds of
      // silence even in continuous mode, and this restart-on-end WAS the
      // fix for that — but calling rec.start() again here can throw
      // InvalidStateError if the previous instance hasn't fully torn down
      // yet. That throw was completely unhandled, so it silently killed
      // listening entirely: keepListeningRef stayed true and the UI kept
      // showing "Listening…", but nothing was actually being captured
      // anymore — the user kept talking into a dead recognizer. Retry once
      // after a short delay instead of letting the exception vanish.
      rec.onend = () => {
        if (!keepListeningRef.current) return;
        try {
          startOne();
        } catch (e: any) {
          console.warn("[VoiceMic] restart failed, retrying in 300ms:", e?.message || e);
          setTimeout(() => { if (keepListeningRef.current) startOne(); }, 300);
        }
      };
      recognitionRef.current = rec;
      try {
        rec.start();
      } catch (e: any) {
        console.warn("[VoiceMic] start failed, retrying in 300ms:", e?.message || e);
        setTimeout(() => { if (keepListeningRef.current) startOne(); }, 300);
      }
    };
    startOne();
    setRecording(true);
    startWaveVisualizer();
  };

  // ── Voice note ───────────────────────────────────────────────────────────
  // BUG FIX — "I record, press stop, and it does nothing." Four problems:
  //   1. It forced audio/webm, which iPhone Safari can't record — now uses
  //      whatever the browser supports (webm, mp4/aac on iPhone).
  //   2. It ran the browser's speech recognition at the same time as the
  //      recorder; on an iPhone they fight over the microphone. Removed —
  //      the recording is transcribed on the server (/api/alfred-transcribe:
  //      free Cloudflare Whisper, then the owner's OpenAI/Groq key).
  //   3. Pressing stop while the microphone was still opening did nothing;
  //      the stop is now remembered and applied as soon as it opens.
  //   4. Without an OpenAI key in the browser there was never a transcript,
  //      so Send silently had nothing to send.
  // After stop: play it back, see the transcript as soon as it's ready,
  // fix it if needed, Send (or Discard). Errors are shown, never swallowed.
  const pickMime = () => {
    const MR: any = (window as any).MediaRecorder;
    if (!MR?.isTypeSupported) return "";
    return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac", "audio/ogg;codecs=opus"].find(t => MR.isTypeSupported(t)) || "";
  };
  const stopRequestedRef = useRef(false);
  const startingRef = useRef(false);
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "transcribing" | "ready" | "error">("idle");
  const [noteError, setNoteError] = useState("");
  const blobRef = useRef<Blob | null>(null);

  const transcribeOnServer = async (blob: Blob): Promise<string> => {
    const text = await transcribeAudio(blob);
    if (!text) throw new Error("Didn't catch any words in that — try again a little closer to the microphone.");
    return text;
  };
  const transcribeNote = async (blob: Blob) => {
    setNoteStatus("transcribing"); setNoteError("");
    try {
      let text = "";
      try { text = await transcribeOnServer(blob); }
      catch (serverErr: any) {
        if (!apiKey) throw serverErr;
        text = await transcribeWhisper(blob); // owner's OpenAI key typed into this browser
      }
      setNoteText(text.trim());
      setNoteStatus("ready");
    } catch (e: any) {
      setNoteError(e?.message || "Couldn't transcribe that.");
      setNoteStatus("error");
    }
  };

  const startNoteRecording = async () => {
    if (startingRef.current || mediaRef.current?.state === "recording") return;
    if (!navigator.mediaDevices?.getUserMedia || !(window as any).MediaRecorder) { alert("This browser can't record audio. Update iOS/Safari, or use Chrome."); onDone?.(); return; }
    startingRef.current = true; stopRequestedRef.current = false;
    setRecording(true); setElapsed(0); setNoteText(""); setNoteStatus("idle"); setNoteError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } as any });
      streamRef.current = stream;
      const mime = pickMime();
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || mime || "audio/webm" });
        blobRef.current = blob;
        if (blob.size < 800) { setNoteError("Nothing was recorded — check that the microphone is allowed for this site."); setNoteStatus("error"); setPendingAudioUrl(URL.createObjectURL(blob)); return; }
        setPendingAudioUrl(URL.createObjectURL(blob));
        transcribeNote(blob);
      };
      mediaRef.current = mr;
      mr.start(500);
      timerRef.current = setInterval(() => setElapsed(s => { if (s + 1 >= 600) stopRecording(); return s + 1; }), 1000);
      startWaveVisualizer();
      if (stopRequestedRef.current) stopRecording();
    } catch (e: any) {
      setRecording(false);
      alert(e?.name === "NotAllowedError" ? "Microphone access is blocked — allow it for this site in your browser settings." : "Couldn't start recording — " + (e?.message || "unknown error"));
      onDone?.();
    } finally { startingRef.current = false; }
  };

  const stopRecording = () => {
    if (mode === "note") {
      if (startingRef.current) { stopRequestedRef.current = true; return; } // mic still opening — stop as soon as it does
      stopTimer();
      stopWaveVisualizer();
      try { if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop(); } catch { /* already stopped */ }
      setRecording(false);
    } else {
      if (serverDictRef.current) { finishServerDictation(); return; }
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      setRecording(false);
      stopWaveVisualizer();
      const text = finalTextRef.current.trim() || liveText.trim();
      if (text) onTranscript?.(text, false);
      setLiveText("");
      onDone?.();
    }
  };

  const toggleRecording = () => {
    if (recording) { stopRecording(); return; }
    if (mode === "note") startNoteRecording();
    else startDictateRecognition();
  };

  // Started from a menu (AlfredPage): begin right away.
  const autoStarted = useRef(false);
  useEffect(() => { if (autoStart && !autoStarted.current) { autoStarted.current = true; toggleRecording(); } }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { try { if (mediaRef.current?.state === "recording") mediaRef.current.stop(); } catch { } streamRef.current?.getTracks().forEach(t => t.stop()); stopTimer(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Stop a dictation recording only when this button really goes away — a
  // quick remount (React dev mode, a parent re-render) must not end it.
  const mountedRef = useRef(false);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; setTimeout(() => { if (!mountedRef.current) serverDictRef.current?.cancel(); }, 0); }; }, []);

  // Press-and-hold (only where holdToRecord is set): press starts, release stops.
  const holdStartedRef = useRef(false);
  const onHoldStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (recording || holdStartedRef.current) return;
    holdStartedRef.current = true;
    if (mode === "note") startNoteRecording();
    else startDictateRecognition();
  };
  const onHoldEnd = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!holdStartedRef.current) return;
    holdStartedRef.current = false;
    stopRecording();
  };

  const discardNote = () => {
    if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl);
    setPendingAudioUrl(null);
    setPlaying(false);
    chunksRef.current = [];
    blobRef.current = null;
    setNoteText(""); setNoteStatus("idle"); setNoteError("");
    onDone?.();
  };

  const sendNote = () => {
    const text = noteText.trim();
    if (!text) return;
    onTranscript?.(text, true);
    discardNote();
  };

  const togglePlayback = () => {
    if (!audioElRef.current) return;
    if (playing) { audioElRef.current.pause(); } else { audioElRef.current.play().catch(() => {}); }
  };

  useEffect(() => () => { if (pendingAudioUrl) URL.revokeObjectURL(pendingAudioUrl); }, [pendingAudioUrl]);
  useEffect(() => () => stopWaveVisualizer(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (processing) return <div className="p-2 text-white/40"><div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" /></div>;

  // Recorded note — playback, transcript (editable), Send / Discard.
  if (pendingAudioUrl) {
    return (
      <div className="flex flex-col gap-1.5 bg-[#1b0d2a] border border-purple-700/60 rounded-xl px-2.5 py-2 w-[min(22rem,calc(100vw-7rem))] shadow-2xl" data-voice-note="ready">
        <audio ref={audioElRef} src={pendingAudioUrl} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} className="hidden" />
        <div className="flex items-center gap-1.5">
          <button onClick={togglePlayback} title={playing ? "Pause" : "Play it back"} className="p-1.5 rounded-lg text-purple-200 hover:bg-purple-900/40">{playing ? <Pause size={14} /> : <Play size={14} />}</button>
          <span className="text-[11px] text-purple-200 flex-1">{elapsed}s voice note</span>
          <button onClick={discardNote} title="Discard" className="p-1.5 rounded-lg text-white/50 hover:text-danger-400 hover:bg-brand-900/20"><Trash2 size={13} /></button>
          <button onClick={sendNote} disabled={noteStatus !== "ready" || !noteText.trim()} title="Send to Alfred" className="px-2.5 py-1.5 rounded-lg text-white bg-purple-700/70 hover:bg-purple-600 disabled:opacity-40 flex items-center gap-1 text-[11px] font-semibold"><Send size={12} />Send</button>
        </div>
        {noteStatus === "transcribing" && <div className="text-[11px] text-purple-200/70 flex items-center gap-1.5"><span className="w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />Turning it into text…</div>}
        {noteStatus === "ready" && <textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={Math.min(5, Math.max(2, Math.ceil(noteText.length / 45)))} className="w-full bg-black/40 border border-purple-700/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 resize-none" />}
        {noteStatus === "error" && (
          <div className="text-[11px] text-danger-300">
            {noteError}
            {blobRef.current && blobRef.current.size >= 800 && <button onClick={() => transcribeNote(blobRef.current!)} className="ml-2 underline text-purple-200">Try again</button>}
          </div>
        )}
      </div>
    );
  }

  if (recording && mode === "note") {
    return (
      <div className="flex items-center gap-2 bg-[#2a0d0d] border border-brand-700/60 rounded-xl px-2.5 py-1.5 shadow-2xl whitespace-nowrap" data-voice-note="recording">
        <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse flex-shrink-0" />
        <div className="flex items-center gap-0.5 h-6">{waveLevels.map((h, i) => <div key={i} className="w-0.5 bg-brand-400 rounded-full transition-[height] duration-75" style={{ height: h }} />)}</div>
        <span className="text-[11px] font-mono text-danger-100">{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>
        <button onClick={stopRecording} title="Stop" className="px-2.5 py-1 rounded-lg bg-brand-600 text-white text-[11px] font-semibold flex items-center gap-1"><Square size={11} />Stop</button>
      </div>
    );
  }

  if (recording && mode === "dictate") {
    return (
      <div className="flex items-center gap-2 bg-brand-950/30 border border-brand-700/40 rounded-xl px-2.5 py-1.5 max-w-xs">
        <div className="flex items-center gap-0.5 flex-shrink-0 h-6">
          {waveLevels.map((h, i) => (
            <div key={i} className="w-0.5 bg-brand-400 rounded-full transition-[height] duration-75 text-brand-fg" style={{ height: h }} />
          ))}
        </div>
        <span className="text-[11px] text-brand-100/80 truncate flex-1">{liveText || (serverDictRef.current ? "Listening… (text appears when you stop)" : "Listening…")}</span>
        <button onClick={toggleRecording} title="Stop listening" className="p-1 rounded-lg text-danger-300 hover:bg-danger-900/40 flex-shrink-0"><Square size={12} /></button>
      </div>
    );
  }

  const idleTitle = holdToRecord
    ? (mode === "note" ? "Hold to record a voice note — listen back before sending" : "Hold to dictate — transcript lands in the text box to review before sending")
    : (mode === "note" ? "Record a voice note — listen back before sending" : "Dictate — transcript lands in the text box to review before sending");

  if (dense) {
    // Compact row form factor for use inside a dropdown/menu (see the
    // unified mic button in AlfredPage.tsx's composer) — same underlying
    // recording logic, just rendered as a full-width labeled row instead
    // of an icon-only circular button.
    return (
      <button
        {...(holdToRecord ? { onPointerDown: onHoldStart, onPointerUp: onHoldEnd, onPointerLeave: onHoldEnd, onPointerCancel: onHoldEnd } : { onClick: toggleRecording })}
        title={idleTitle}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/80 hover:bg-brand-950/40 transition text-left select-none touch-none"
      >
        <Mic size={14} className="text-brand-400 flex-shrink-0" />
        <span className="flex-1">{label || (mode === "note" ? "Voice Note" : "Dictate")}</span>
        {holdToRecord && <span className="text-[9px] text-white/30 flex-shrink-0">HOLD</span>}
      </button>
    );
  }

  return (
    <button
      {...(holdToRecord ? { onPointerDown: onHoldStart, onPointerUp: onHoldEnd, onPointerLeave: onHoldEnd, onPointerCancel: onHoldEnd } : { onClick: toggleRecording })}
      title={idleTitle}
      className={"p-2 rounded-xl transition flex-shrink-0 select-none touch-none " + (recording ? "bg-danger-600/40 text-danger-300 animate-pulse" : "text-white/40 hover:text-white/70 hover:bg-white/5")}
    >
      <Mic size={16} />
    </button>
  );
}
