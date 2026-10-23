// FEATURE — "build a video editor that works without an API key,
// automatically editing and adding captions." Every existing caption
// provider (OpenAI/Groq/Deepgram — see CAPTION_PROVIDERS in videoEditor.ts)
// needs the owner's own paid API key, so Auto-Edit's caption step silently
// skipped itself ("Auto-Edit will still cut dead space, just without
// captions") for anyone without one configured. This runs real speech
// recognition (OpenAI's Whisper model, via transformers.js/onnxruntime-web)
// ENTIRELY in the browser — no server call, no account, no API key, no
// per-use cost, ever. Same pattern this app already uses for ffmpeg.wasm
// (lib/videoEditor.ts's loadFfmpeg): the model weights are fetched from a
// public CDN at runtime on first use (~40-80MB, browser-cached after that
// via transformers.js's own IndexedDB cache) rather than bundled into the
// Vite build.
//
// BUG FIX (build audit) — a plain top-level `import ... from
// "@xenova/transformers"` pulled the whole library (plus onnxruntime-web,
// several MB even minified) into the MAIN app bundle, since this file is
// reachable via a static import chain from VideoEditorModal.tsx →
// SocialPage.tsx. That meant every visitor — including someone who never
// opens the video editor — downloaded onnxruntime-web on first load of the
// whole CRM. Loading it via a dynamic import() inside the function that
// actually needs it (below) makes Rollup split it into its own chunk,
// fetched only the first time Auto-Edit/Auto-Captions actually runs with
// the local provider selected — same lazy-loading shape as ffmpeg.wasm's
// own core files already use.
type TransformersModule = typeof import("@xenova/transformers");
let transformersModule: TransformersModule | null = null;
const loadTransformersModule = async (): Promise<TransformersModule> => {
  if (transformersModule) return transformersModule;
  transformersModule = await import("@xenova/transformers");
  // Force the Hub/CDN path — this only ever runs in a browser tab, so
  // there's no local filesystem model directory to look for.
  transformersModule.env.allowLocalModels = false;
  return transformersModule;
};

// whisper-base.en — English-only (this app's target market), a solid
// accuracy/speed/size balance for on-device transcription of a short
// promo-video clip. Multilingual owners can still fall back to a paid
// provider (Groq/OpenAI/Deepgram) from the same dropdown if they need it.
//
// PERF FEATURE (audit finding) — whisper-tiny.en is ~half the parameter
// count of base.en, commonly ~2-3x faster to transcribe the same audio on
// CPU-bound WASM, at a real, honest cost: a meaningfully higher word-error
// rate, worse still on noisy job-site audio (power tools, engines) —
// exactly the audio this app's clips are shot in. Surfaced as an explicit
// opt-in ("local-fast" in CAPTION_PROVIDERS, videoEditor.ts) rather than
// silently swapped in for everyone, so an owner trades accuracy for speed
// only when they actually want to.
export type LocalModelSpeed = "balanced" | "fast";
const MODEL_IDS: Record<LocalModelSpeed, string> = {
  balanced: "Xenova/whisper-base.en",
  fast: "Xenova/whisper-tiny.en",
};

type Transcriber = (audio: Float32Array, options?: Record<string, any>) => Promise<any>;

// Keyed by model id (not a single singleton) — an owner can switch between
// "balanced"/"fast" mid-session; each gets its own cached instance instead
// of the second choice evicting the first.
const transcriberInstances = new Map<string, Transcriber>();
const loadingPromises = new Map<string, Promise<Transcriber>>();

export const isLocalTranscriptionSupported = (): boolean =>
  typeof WebAssembly !== "undefined" && typeof AudioContext !== "undefined";

// Same double-checked-locking singleton pattern as loadFfmpeg — each
// distinct model only ever needs to be loaded once per tab, and concurrent
// callers (e.g. transcribing several clips back to back during Auto-Edit)
// should all await the same in-flight load rather than each starting their
// own.
export const loadLocalTranscriber = async (onProgress?: (msg: string) => void, speed: LocalModelSpeed = "balanced"): Promise<Transcriber> => {
  const modelId = MODEL_IDS[speed];
  const cached = transcriberInstances.get(modelId);
  if (cached) return cached;
  const inFlight = loadingPromises.get(modelId);
  if (inFlight) return inFlight;
  const loadingPromise = (async () => {
    onProgress?.("Loading free speech-to-text engine (first time only)...");
    const { pipeline } = await loadTransformersModule();
    onProgress?.(`Loading free speech-to-text model (first time only, ~${speed === "fast" ? "40" : "75"}MB)...`);
    const lastPctByFile: Record<string, number> = {};
    const transcriber = await pipeline("automatic-speech-recognition", modelId, {
      progress_callback: (p: any) => {
        if (p?.status === "progress" && typeof p.progress === "number") {
          const pct = Math.round(p.progress);
          const key = p.file || "model";
          // Only report every ~10% per file — this callback fires very
          // frequently (once per chunk downloaded) and there's no reason to
          // re-render the phase label that often.
          if (pct - (lastPctByFile[key] || 0) >= 10 || pct >= 100) {
            lastPctByFile[key] = pct;
            onProgress?.(`Downloading speech model — ${key || "core"} (${pct}%)`);
          }
        }
      },
    }) as unknown as Transcriber;
    transcriberInstances.set(modelId, transcriber);
    return transcriber;
  })();
  loadingPromises.set(modelId, loadingPromise);
  return loadingPromise;
};

// Decodes any audio Blob (mp3/wav/whatever the browser's own decoder
// supports — the same audio ffmpeg.wasm already extracted via
// extractAudioForTranscription) into mono Float32Array PCM at 16kHz, the
// exact input shape Whisper's feature extractor requires. Browsers don't
// reliably honor a custom sampleRate on decodeAudioData, so this resamples
// manually via linear interpolation rather than assuming the decode already
// came out at 16kHz.
const decodeToMono16k = async (blob: Blob): Promise<Float32Array> => {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
      ctx.decodeAudioData(arrayBuffer, resolve, reject);
    });
    const { numberOfChannels, length, sampleRate } = audioBuffer;
    const mono = new Float32Array(length);
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const data = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) mono[i] += data[i] / numberOfChannels;
    }
    const TARGET_SR = 16000;
    if (Math.round(sampleRate) === TARGET_SR) return mono;
    const ratio = sampleRate / TARGET_SR;
    const newLength = Math.max(1, Math.round(length / ratio));
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const i0 = Math.floor(srcIndex);
      const i1 = Math.min(i0 + 1, length - 1);
      const frac = srcIndex - i0;
      resampled[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
    }
    return resampled;
  } finally {
    ctx.close().catch(() => {});
  }
};

// Same return shape as requestTranscription in videoEditor.ts ({text,
// start, end}[]) so VideoEditorModal.tsx's caller code doesn't need to
// branch on which provider it used.
export const transcribeAudioLocally = async (
  audioBlob: Blob,
  onProgress?: (msg: string) => void,
  speed: LocalModelSpeed = "balanced"
): Promise<{ text: string; start: number; end: number }[]> => {
  const transcriber = await loadLocalTranscriber(onProgress, speed);
  onProgress?.("Transcribing audio locally (no data leaves your device)...");
  const audio = await decodeToMono16k(audioBlob);
  // FEATURE — "really good-looking, timed auto captions." WORD-level
  // timestamps (not just per-sentence) — lets videoEditor.ts's
  // groupWordsIntoCaptionLines rebuild them into short, fast-paced 3-4-word
  // caption lines instead of one long sentence sitting on screen.
  const output: any = await transcriber(audio, {
    return_timestamps: "word",
    chunk_length_s: 30,
    stride_length_s: 5,
  });
  const chunks: Array<{ text: string; timestamp: [number, number | null] }> = output?.chunks || [];
  if (chunks.length === 0 && output?.text) {
    // Some short clips come back as one chunk with no per-segment
    // timestamps at all — fall back to spanning the whole clip so the
    // caption still gets created instead of silently dropped.
    const durSec = audio.length / 16000;
    return [{ text: String(output.text).trim(), start: 0, end: durSec }];
  }
  return chunks
    .map(c => ({
      text: (c.text || "").trim(),
      start: c.timestamp?.[0] ?? 0,
      // A trailing chunk can have a null end timestamp when Whisper never
      // closes it out — fall back to start+2s rather than producing a caption
      // with no visible duration at all.
      end: c.timestamp?.[1] ?? (c.timestamp?.[0] ?? 0) + 2,
    }))
    .filter(c => c.text.length > 0);
};
