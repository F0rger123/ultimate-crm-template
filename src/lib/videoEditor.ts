// FEATURE — "there's a video editor, CapCut style, inside the social
// section... auto-cutting and trimming... transitions, animations to the
// text, tech transition effects for in-between videos." Everything in this
// file runs entirely in the browser via ffmpeg.wasm (WebAssembly build of
// real FFmpeg) — no server, no per-render API cost, genuinely free
// regardless of usage. The core/wasm binaries are ~30MB, so they're loaded
// from a CDN at runtime (not bundled into the app's own build) and cached
// by the browser after first use, not shipped as part of the Vite bundle.
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";
import { getCaptionStyle, getTransition, type CaptionStyle } from "./captionStyles";
import { uid } from "./utils";
import { transcribeAudioLocally } from "./localTranscription";
import { buildAssDocument } from "./assCaptions";

const CORE_VERSION = "0.12.6";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;

export const isVideoEditorSupported = (): boolean =>
  typeof SharedArrayBuffer !== "undefined" || typeof WebAssembly !== "undefined";

export const loadFfmpeg = async (onProgress?: (msg: string) => void): Promise<FFmpeg> => {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    const ff = new FFmpeg();
    // BUG FIX — 500 lines was too small a cap even with -nostats added at
    // each call site (detectSilence) — a longer clip's silencedetect
    // output alone can exceed it. 4000 gives real headroom without
    // holding onto an unbounded amount of log text across the app's
    // lifetime.
    ff.on("log", ({ message }: any) => { lastLog.push(message); if (lastLog.length > 4000) lastLog.shift(); });
    onProgress?.("Loading video engine (first time only, ~30MB)...");
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    ]);
    await ff.load({ coreURL, wasmURL });
    ffmpegInstance = ff;
    return ff;
  })();
  return loadingPromise;
};

let lastLog: string[] = [];
const fontCache = new Map<string, Uint8Array>();

const ensureFont = async (ff: FFmpeg, style: CaptionStyle): Promise<string> => {
  const fileName = `font-${style.id}.ttf`;
  if (!fontCache.has(style.id)) {
    const data = await fetchFile(style.fontFileUrl);
    fontCache.set(style.id, data);
  }
  await ff.writeFile(fileName, fontCache.get(style.id)!);
  return fileName;
};

// Same cached font bytes as ensureFont above, written into a real /fonts
// DIRECTORY instead of a flat filename — libass's `ass` filter takes a
// `fontsdir` option and scans it, matching by each font FILE's own
// internal name table (fontconfig-style), not by filename. Tracked so a
// multi-clip Auto-Edit run (many renderFinalVideo-adjacent calls) never
// re-writes the same font twice in one session.
const fontsDirEnsured = new Set<FFmpeg>();
const fontsWrittenToDir = new Set<string>();
const ensureFontInDir = async (ff: FFmpeg, style: CaptionStyle): Promise<void> => {
  if (!fontsDirEnsured.has(ff)) {
    await ff.createDir("/fonts").catch(() => {});
    fontsDirEnsured.add(ff);
  }
  if (fontsWrittenToDir.has(style.id)) return;
  if (!fontCache.has(style.id)) {
    const data = await fetchFile(style.fontFileUrl);
    fontCache.set(style.id, data);
  }
  await ff.writeFile(`/fonts/${style.id}.ttf`, fontCache.get(style.id)!);
  fontsWrittenToDir.add(style.id);
};

// FEATURE — "you should be able to crop stuff, resize it." x/y/w/h are
// fractions (0-1) of the clip's OWN source pixel dimensions (clip.width/
// clip.height, probed by readVideoMeta below) — resolution-independent so
// the same crop rect means the same thing regardless of the source
// clip's actual resolution. Applied to the source BEFORE rotation/flip
// and before the aspect-ratio reframe.
export type CropRect = { x: number; y: number; w: number; h: number };

export type EditorClip = {
  id: string; file: File; startSec: number; endSec: number; durationSec: number;
  // Source pixel dimensions, probed once when the clip is added (see
  // readVideoMeta) — needed to turn a fractional crop rect into real pixel
  // coordinates for ffmpeg's crop filter.
  width?: number; height?: number;
  // Transition applied BETWEEN this clip and the next one (ignored on the
  // last clip) — an id from captionStyles.ts's TRANSITION_EFFECTS.
  transitionToNext?: string;
  // FEATURE — "flip videos at different degrees, it should snap at
  // certain angles." Snapped to 90° multiples (0/90/180/270) — a clean,
  // lossless-shape rotation via ffmpeg's transpose filter, the same
  // increments CapCut's own rotate control snaps to. flipH mirrors
  // horizontally (selfie/mirrored-camera footage).
  rotation?: 0 | 90 | 180 | 270;
  flipH?: boolean;
  crop?: CropRect;
  // FEATURE — "change saturation, contrast, brightness, etc." All three on
  // a -100..100 slider scale (0 = unchanged); mapped to ffmpeg's eq filter
  // ranges in renderFinalVideo, and to CSS filter() percentages for the
  // live preview so what's on screen while editing matches the export.
  brightness?: number; contrast?: number; saturation?: number;
  // FEATURE — "video effects, video filters, good-looking LUTs." A named
  // color-grade "look" (see COLOR_LOOKS below) applied on top of the plain
  // brightness/contrast/saturation sliders above — those correct exposure,
  // this applies a creative grade (teal & orange, moody blue, faded film,
  // etc.), the same two-step "correct then grade" order a real editor uses.
  colorLook?: string;
  // FEATURE — "add more options for everything." Real slow-motion/speed-up
  // per clip, 0.5x-2x — ffmpeg's setpts (video) + atempo (audio), the same
  // pair every editor uses for this. Clamped to 2x max because atempo only
  // supports 0.5-2.0 in a single pass (a real limit of the filter, not an
  // arbitrary UI choice — chaining atempo twice would be needed past 2x,
  // not worth the added complexity for a field-service promo clip). NOTE:
  // this changes the clip's own OUTPUT duration, so a caption already
  // placed against this clip's original timing will drift if speed is
  // changed afterward — the UI surfaces that as a warning rather than
  // silently rescaling captions (a rescale that's wrong is worse than an
  // honest warning here).
  speed?: number;
  // FEATURE — "more photo editing options." A still image can be added as
  // a clip too (uploaded alongside/instead of video) — rendered as a fixed-
  // duration segment via ffmpeg's `-loop 1` image-to-video path, then flows
  // through the exact same crop/rotate/color/reframe pipeline every video
  // clip already goes through. isImage is set once at add-time from the
  // file's MIME type; durationSec for an image clip is the OWNER-CHOSEN
  // on-screen time (default 3s), not a probed media duration.
  isImage?: boolean;
  // FEATURE — "applying various sound effects such as muffled or
  // underwater sounds." Applied to this clip's own audio only, during
  // normalization — an id from SOUND_EFFECTS above.
  audioEffect?: string;
  // FEATURE — per-clip mute (e.g. wind noise on one clip, but keep the
  // others' audio) — silences via volume=0 rather than dropping the audio
  // stream entirely, since concat/xfade require every segment to share the
  // same stream layout (see the "even if the source clip is silent"
  // comment on the normalization step below).
  muted?: boolean;
  // BUG FIX (audit finding) — set by splitClipAtRanges on every piece
  // EXCEPT the last one a single original clip gets split into (by
  // autoCutClipDeadSpace or stripFillerWordsFromClip). True means "this
  // boundary is an invisible cleanup edit inside what was one continuous
  // take, not a real cut the editor chose" — applyAutoStyling and
  // renderFinalVideo's camera-flicker pass both need this to tell "the
  // silence between two words" apart from "the join between two different
  // clips the owner dragged in." Without it, Auto-Edit was stamping a
  // stylized transition (crossfade/zoom/wipe/etc.) — or a flicker flash —
  // onto every single silence/filler cut, not just between real clips,
  // which is what actually made Auto-Edit's output look bad/busy.
  internalCutOnly?: boolean;
};
export type EditorCaption = {
  id: string; text: string; startSec: number; endSec: number; styleId: string;
  // FEATURE — "move the text around." Normalized 0-1 position overriding
  // the style's default top/center/bottom placement when set — null/
  // undefined keeps using the style's own position.
  xPct?: number; yPct?: number;
  // FEATURE — "click a caption to resize it, like in CapCut." Multiplier
  // on the style's base font size (1 = unchanged); applied identically in
  // the live CSS preview and the real ffmpeg drawtext fontsize= expression
  // in renderFinalVideo so what's dragged in the editor is what exports.
  fontScale?: number;
  // FEATURE — "really good-looking, timed auto captions with good
  // animations." Real per-WORD timestamps (absolute seconds, same clock as
  // startSec/endSec) when this caption came from word-level transcription
  // (see groupWordsIntoCaptionLines) — used by lib/assCaptions.ts to burn a
  // genuine karaoke-style word-by-word highlight sweep, timed to exactly
  // when each word was actually spoken. Missing on hand-typed captions or
  // phrase-level (paid-provider) transcripts — assCaptions.ts falls back to
  // an even, character-length-weighted estimate across cap.text's words so
  // every caption still gets the highlight effect, just without real timing.
  words?: { text: string; start: number; end: number }[];
};

// FEATURE — "multi-track editor with overlays... allow users to add their
// own branding — import their logo, phone number... drag and drop those
// assets into the editor." A real second (and third, etc.) visual layer on
// top of the main clip track — an image (logo, phone-number graphic, any
// branding asset) positioned and timed independently of the clips below
// it, rendered via ffmpeg's real `overlay` filter (see renderFinalVideo).
// FEATURE — "picture-in-picture video." An overlay can now be `kind:
// "video"` instead of just a static image — a second clip (own `file`,
// kept in memory only, never pushed through the base64-data-URL brand
// asset path) composited on top of the main timeline with the exact same
// position/size/drag-resize/time-window machinery images already use.
// `muted` defaults to true: mixing the PiP clip's own audio in under the
// main track's is supported (see renderFinalVideo) but most PiP use cases
// (a talking-head cam over B-roll, a logo sting) want it silent by
// default so it doesn't compete with the main clip's audio; the owner can
// un-mute it per-overlay if they actually want both audio tracks.
export type EditorOverlay = {
  id: string; name: string;
  kind?: "image" | "video"; // default "image" — unset means image, for back-compat with saved overlays
  src: string; // image: data URL (brand asset or one-off upload). video: object URL, preview only.
  file?: File; // video overlays only — the real file ffmpeg reads from for export.
  muted?: boolean; // video overlays only.
  // GLOBAL timeline seconds, same convention as EditorCaption.
  startSec: number; endSec: number;
  // Center position (0-1 of frame) and width as a fraction of frame width
  // (height follows the source image's own aspect ratio) — same
  // fraction-of-rendered-box math the caption drag/crop tools already use.
  xPct: number; yPct: number; widthPct: number; opacity: number;
};

// FEATURE — "enable adding music, moving music tracks." A single music
// track (CapCut supports many; one is the real, useful 90% case for a
// short-form business promo video) mixed into the final audio under
// whatever the clips' own audio already is. `startSec` is where in the
// GLOBAL timeline it begins playing — draggable on the music track row in
// the UI, same drag pattern as everything else here.
export type MusicTrack = {
  id: string; file: File; name: string; durationSec: number;
  startSec: number; trimStart: number; trimEnd: number; volume: number; // volume: 0-2, 1 = unchanged
};

// FEATURE — "applying various sound effects such as muffled or underwater
// sounds... a range of sound effects." Real ffmpeg audio filters, applied
// per-clip (see renderFinalVideo) — every filter here is a standard,
// well-supported ffmpeg audio filter (lowpass/highpass/tremolo/aecho), not
// an experimental one, so it behaves the same in ffmpeg.wasm as desktop
// ffmpeg.
export type SoundEffect = { id: string; name: string; description: string; filter: string };
export const SOUND_EFFECTS: SoundEffect[] = [
  { id: "none", name: "None", description: "Original audio, unaffected.", filter: "" },
  { id: "muffled", name: "Muffled", description: "Low, muted, far-away sound — like through a wall.", filter: "lowpass=f=500" },
  { id: "underwater", name: "Underwater", description: "Submerged, wavy, muted tone.", filter: "lowpass=f=350,tremolo=f=4.5:d=0.6" },
  { id: "telephone", name: "Telephone", description: "Thin, band-limited phone-call sound.", filter: "highpass=f=400,lowpass=f=2600,volume=1.6" },
  { id: "megaphone", name: "Megaphone", description: "Loud, distorted bullhorn/PA sound.", filter: "highpass=f=300,lowpass=f=3400,volume=2.2,alimiter=limit=0.8" },
  { id: "cave-echo", name: "Cave Echo", description: "Big, roomy echo — cavernous space.", filter: "aecho=0.8:0.85:900:0.35" },
  { id: "tinny", name: "Tinny Speaker", description: "Small, cheap-speaker sound — no bass at all.", filter: "highpass=f=900" },
  // FEATURE — "add more options for everything."
  { id: "chipmunk", name: "Chipmunk", description: "Fast, high-pitched, cartoonish voice.", filter: "asetrate=44100*1.5,aresample=44100" },
  { id: "deep-voice", name: "Deep Voice", description: "Slow, low, monster/movie-trailer voice.", filter: "asetrate=44100*0.78,aresample=44100" },
  { id: "concert-hall", name: "Concert Hall", description: "Wide, airy reverb — big open-room ambience.", filter: "aecho=0.6:0.7:400:0.25" },
  { id: "vinyl-lofi", name: "Vinyl Lo-Fi", description: "Warm, dulled, slightly wobbly old-recording sound.", filter: "lowpass=f=4000,highpass=f=120,vibrato=f=3.5:d=0.15" },
  { id: "radio-static", name: "Radio Static", description: "Crackly, band-limited AM-radio broadcast sound.", filter: "highpass=f=500,lowpass=f=3000,volume=1.4" },
];
export const getSoundEffect = (id?: string): SoundEffect => SOUND_EFFECTS.find(s => s.id === id) || SOUND_EFFECTS[0];

// FEATURE — "video effects, video filters, good-looking LUTs, overall
// editing." Real color-grade "looks," each a chain of ffmpeg's own native
// color filters (curves' built-in film-emulation presets, colorbalance for
// shadow/midtone/highlight tinting, eq, hue, vignette) — no external LUT
// (.cube) files needed, so there's nothing to source/license/ship, and
// these render identically in ffmpeg.wasm as they would in desktop ffmpeg.
// previewCss is a CSS filter() approximation used for the live preview only
// (see VideoEditorModal.tsx) — it can't reproduce curves/colorbalance
// exactly, but it's close enough to preview which look is which; the real
// export always uses the actual ffmpeg filterChain below.
export type ColorLook = { id: string; name: string; description: string; filterChain: string; previewCss: string };
export const COLOR_LOOKS: ColorLook[] = [
  { id: "none", name: "None", description: "Original color, unaffected.", filterChain: "", previewCss: "none" },
  { id: "cinematic-teal-orange", name: "Cinematic", description: "Teal shadows, warm skin tones — the classic blockbuster grade.", filterChain: "colorbalance=rs=-0.12:gs=0.02:bs=0.16:rm=0.04:bm=-0.05:rh=0.12:bh=-0.14,eq=saturation=1.15:contrast=1.08", previewCss: "contrast(1.1) saturate(1.2) hue-rotate(-4deg)" },
  { id: "moody-blue", name: "Moody Blue", description: "Cool, desaturated, cinematic drama.", filterChain: "colorbalance=rs=-0.15:bs=0.22:rm=-0.06:bm=0.12,eq=saturation=0.82:contrast=1.12:brightness=-0.02", previewCss: "saturate(0.75) contrast(1.15) hue-rotate(8deg) brightness(0.95)" },
  { id: "warm-vintage", name: "Warm Vintage", description: "Faded warm tones, gentle contrast — old film feel.", filterChain: "curves=preset=vintage,eq=saturation=0.9", previewCss: "sepia(0.25) saturate(0.85) contrast(0.95)" },
  { id: "faded-film", name: "Faded Film", description: "Lifted blacks, soft contrast, subtle vignette — a dreamy, faded look.", filterChain: "curves=preset=lighter,eq=saturation=0.75:contrast=0.9,vignette=PI/5", previewCss: "saturate(0.7) contrast(0.85) brightness(1.08)" },
  { id: "bw-cinematic", name: "B&W Cinematic", description: "Rich black-and-white with punchy contrast.", filterChain: "hue=s=0,eq=contrast=1.25:gamma=1.08", previewCss: "grayscale(1) contrast(1.25)" },
  { id: "vibrant-pop", name: "Vibrant Pop", description: "Punchy saturation and contrast — makes colors jump off the screen.", filterChain: "eq=saturation=1.45:contrast=1.12:brightness=0.02", previewCss: "saturate(1.5) contrast(1.15)" },
  { id: "golden-hour", name: "Golden Hour", description: "Warm amber highlights, soft glow — sunset/outdoor footage.", filterChain: "colorbalance=rh=0.16:gh=0.05:bh=-0.16:rm=0.08:bm=-0.04,eq=saturation=1.1", previewCss: "sepia(0.15) saturate(1.25) brightness(1.05)" },
  { id: "cross-process", name: "Cross Process", description: "Punchy, unconventional color shift — bold editorial look.", filterChain: "curves=preset=cross_process,eq=saturation=1.2", previewCss: "contrast(1.2) saturate(1.3) hue-rotate(-6deg)" },
  { id: "muted-earth", name: "Muted Earth", description: "Soft, desaturated, natural tones.", filterChain: "eq=saturation=0.72:contrast=1.05,colorbalance=rm=0.05:gm=0.02:bm=-0.05", previewCss: "saturate(0.7) sepia(0.1)" },
  { id: "cyberpunk-neon", name: "Cyberpunk", description: "Cool cyan/magenta push — neon night look.", filterChain: "colorbalance=rs=0.1:bs=0.22:rh=-0.06:bh=0.16,eq=saturation=1.3:contrast=1.15", previewCss: "saturate(1.4) contrast(1.2) hue-rotate(-10deg)" },
  // FEATURE — "add more options for everything."
  { id: "clean-bright", name: "Clean & Bright", description: "Light, airy, slightly cool — real-estate/exterior-shot clean look.", filterChain: "curves=preset=increase_contrast,eq=brightness=0.03:saturation=1.05", previewCss: "brightness(1.08) contrast(1.05) saturate(1.05)" },
  { id: "high-contrast-punch", name: "High Contrast", description: "Deep blacks, bright highlights — a punchy, graphic look.", filterChain: "curves=preset=strong_contrast,eq=saturation=1.1", previewCss: "contrast(1.35) saturate(1.1)" },
  { id: "matte-film", name: "Matte Film", description: "Flattened blacks, soft muted tones — modern \"matte\" look-book grade.", filterChain: "curves=preset=medium_contrast,eq=contrast=0.92:saturation=0.85,colorbalance=rs=0.04:gs=0.02:bs=-0.02", previewCss: "contrast(0.9) saturate(0.85) brightness(1.03)" },
  { id: "cool-steel", name: "Cool Steel", description: "Steel-blue shadows, desaturated — industrial/commercial equipment footage.", filterChain: "colorbalance=rs=-0.1:gs=0.02:bs=0.18:rm=-0.03:bm=0.06,eq=saturation=0.78:contrast=1.1", previewCss: "saturate(0.8) hue-rotate(10deg) contrast(1.1)" },
  { id: "sunbleached", name: "Sunbleached", description: "Washed-out, hazy highlights — bright midday exterior work.", filterChain: "curves=preset=lighter,eq=saturation=0.68:brightness=0.06,vignette=PI/6", previewCss: "brightness(1.12) saturate(0.7) contrast(0.85)" },
  { id: "deep-night", name: "Deep Night", description: "Crushed shadows, cool highlights — for dusk/night work footage.", filterChain: "eq=brightness=-0.06:contrast=1.2:saturation=0.85,colorbalance=rs=-0.08:bs=0.12", previewCss: "brightness(0.85) contrast(1.25) saturate(0.85) hue-rotate(6deg)" },
];
export const getColorLook = (id?: string): ColorLook => COLOR_LOOKS.find(l => l.id === id) || COLOR_LOOKS[0];

// FEATURE — "add templates." One-click bundles of a caption style + color
// look + transition set + camera-flicker choice — all settings Auto-Edit
// already applies individually, just pre-combined into a named "recipe" so
// the owner doesn't have to configure each one by hand for a common goal.
export type AutoEditTemplate = {
  id: string; name: string; description: string;
  captionStyleId: string; colorLook: string; transitionCycle: string[]; cameraFlicker: boolean;
};
export const AUTO_EDIT_TEMPLATES: AutoEditTemplate[] = [
  { id: "mrbeast-energy", name: "MrBeast Energy", description: "Big bold pop captions, punchy transitions, camera flicker on every cut — maximum energy.", captionStyleId: "mrbeast", colorLook: "vibrant-pop", transitionCycle: ["zoom-punch", "dissolve", "squeeze", "slide-left", "slide-right"], cameraFlicker: true },
  { id: "fast-punchy", name: "Fast & Punchy", description: "Quick cuts, high contrast, flash transitions — built for a short, scroll-stopping clip.", captionStyleId: "hook-punch", colorLook: "high-contrast-punch", transitionCycle: ["zoom-punch", "dissolve", "squeeze", "radial-wipe"], cameraFlicker: true },
  { id: "cinematic-reveal", name: "Cinematic Reveal", description: "Smooth crossfades, teal & orange grade, minimal captions — a polished before/after reveal.", captionStyleId: "minimal-clean", colorLook: "cinematic-teal-orange", transitionCycle: ["crossfade", "smooth-slide"], cameraFlicker: false },
  { id: "before-after", name: "Before/After Reveal", description: "Wipe transitions and a bold reveal tag — built for showing off the work.", captionStyleId: "before-after-tag", colorLook: "vibrant-pop", transitionCycle: ["wipe-left", "wipe-right", "slide-up"], cameraFlicker: false },
  { id: "clean-professional", name: "Clean Professional", description: "Simple crossfades, bright natural color, trade-style captions — trustworthy and understated.", captionStyleId: "trade-pro", colorLook: "clean-bright", transitionCycle: ["crossfade"], cameraFlicker: false },
  { id: "moody-dark", name: "Moody & Dark", description: "Cool desaturated grade, slow smooth transitions, quiet captions — dusk/night work footage.", captionStyleId: "podcast-caption", colorLook: "moody-blue", transitionCycle: ["crossfade", "fade-black"], cameraFlicker: false },
];
export const getAutoEditTemplate = (id?: string): AutoEditTemplate | undefined => AUTO_EDIT_TEMPLATES.find(t => t.id === id);

// FEATURE — "describe in text what I want, and without using an API key
// you can discern and edit the video." A real, honest, zero-cost
// implementation of this: keyword/phrase matching against the free-text
// description, mapped onto the exact same style options above — this is
// NOT an LLM and doesn't pretend to be one (no API key, no network call,
// runs instantly) — it recognizes a defined vocabulary of common editing
// language ("energetic," "cinematic," "slow motion," "mrbeast captions,"
// etc.) rather than truly understanding arbitrary prose. `matched` is
// returned so the UI can show the owner exactly what it picked up, rather
// than silently guessing — if nothing matches, every field stays
// undefined and the owner's own template/manual choices are left alone.
export type StylePromptResult = {
  captionStyleId?: string; colorLook?: string; transitionCycle?: string[];
  cameraFlicker?: boolean; speed?: number; skipCaptions?: boolean; audioEffect?: string; matched: string[];
};
export const interpretStylePrompt = (raw: string): StylePromptResult => {
  const text = ` ${(raw || "").toLowerCase()} `;
  const has = (...words: string[]) => words.some(w => text.includes(w));
  const result: StylePromptResult = { matched: [] };

  if (has("mrbeast", "mr beast")) { result.captionStyleId = "mrbeast"; result.matched.push("MrBeast-style captions"); }
  else if (has("no caption", "without caption", "skip caption")) { result.skipCaptions = true; result.matched.push("no captions"); }
  else if (has("minimal caption", "clean caption", "simple caption", "subtle caption")) { result.captionStyleId = "whisper-clean"; result.matched.push("minimal captions"); }
  else if (has("bold caption", "yellow caption", "big caption", "loud caption")) { result.captionStyleId = "hook-punch"; result.matched.push("bold captions"); }

  if (has("cinematic", "movie look", "film look", "blockbuster")) { result.colorLook = "cinematic-teal-orange"; result.matched.push("cinematic color grade"); }
  else if (has("moody", "dramatic", "dark mood")) { result.colorLook = "moody-blue"; result.matched.push("moody color grade"); }
  else if (has("vintage", "retro", "old film", "throwback")) { result.colorLook = "warm-vintage"; result.matched.push("vintage color grade"); }
  else if (has("black and white", "b&w", "b & w", "grayscale")) { result.colorLook = "bw-cinematic"; result.matched.push("black & white"); }
  else if (has("vibrant", "colorful", "punchy color", "poppy")) { result.colorLook = "vibrant-pop"; result.matched.push("vibrant color grade"); }
  else if (has("professional", "corporate", "trustworthy", "clean look")) { result.colorLook = "clean-bright"; result.matched.push("clean/professional color grade"); }
  else if (has("neon", "cyberpunk")) { result.colorLook = "cyberpunk-neon"; result.matched.push("neon color grade"); }
  else if (has("golden hour", "sunset", "warm glow")) { result.colorLook = "golden-hour"; result.matched.push("golden-hour color grade"); }

  if (has("energetic", "high energy", "hype", "fast paced", "fast-paced", "punchy", "exciting", "upbeat")) {
    result.transitionCycle = ["zoom-punch", "dissolve", "squeeze", "slide-left", "slide-right"];
    result.cameraFlicker = true;
    result.matched.push("energetic pacing + camera flicker");
  } else if (has("calm", "relaxed", "gentle", "smooth pace", "laid back")) {
    result.transitionCycle = ["crossfade", "smooth-slide"];
    result.cameraFlicker = false;
    result.matched.push("calm, smooth pacing");
  }
  if (has("no flash", "no flicker", "no strobe")) { result.cameraFlicker = false; result.matched.push("camera flicker off"); }
  else if (has("flash", "flicker", "strobe") && result.cameraFlicker === undefined) { result.cameraFlicker = true; result.matched.push("camera flicker on"); }

  if (has("slow motion", "slow-mo", "slowmo", "slow mo")) { result.speed = 0.6; result.matched.push("slow motion (0.6x)"); }
  else if (has("speed up", "sped up", "fast forward", "timelapse", "time-lapse", "time lapse")) { result.speed = 1.6; result.matched.push("sped up (1.6x)"); }

  // FEATURE — "describe in text... muffled sound effects." Maps free-text
  // audio descriptions onto the real per-clip SOUND_EFFECTS filters above
  // — this vocabulary was missing entirely before (the describe-prompt
  // only ever touched captions/color/pacing/speed, never audio), even
  // though the user's own example for this feature was explicitly an
  // audio effect.
  if (has("muffled", "through a wall", "muted sound", "far away sound")) { result.audioEffect = "muffled"; result.matched.push("muffled audio"); }
  else if (has("underwater", "submerged", "swimming pool sound")) { result.audioEffect = "underwater"; result.matched.push("underwater audio"); }
  else if (has("telephone", "phone call sound", "phone filter", "on the phone")) { result.audioEffect = "telephone"; result.matched.push("telephone audio"); }
  else if (has("megaphone", "bullhorn", "loudspeaker")) { result.audioEffect = "megaphone"; result.matched.push("megaphone audio"); }
  else if (has("cave echo", "cavernous", "echoey", "big echo")) { result.audioEffect = "cave-echo"; result.matched.push("cave echo audio"); }
  else if (has("tinny", "small speaker sound", "laptop speaker")) { result.audioEffect = "tinny"; result.matched.push("tinny audio"); }
  else if (has("chipmunk", "helium voice", "high pitched voice")) { result.audioEffect = "chipmunk"; result.matched.push("chipmunk audio"); }
  else if (has("deep voice", "monster voice", "movie trailer voice", "demon voice")) { result.audioEffect = "deep-voice"; result.matched.push("deep voice audio"); }
  else if (has("concert hall", "big reverb", "reverb")) { result.audioEffect = "concert-hall"; result.matched.push("concert hall audio"); }
  else if (has("vinyl", "lo-fi", "lofi", "old recording sound")) { result.audioEffect = "vinyl-lofi"; result.matched.push("vinyl lo-fi audio"); }
  else if (has("radio static", "am radio", "walkie talkie")) { result.audioEffect = "radio-static"; result.matched.push("radio static audio"); }

  return result;
};

// FEATURE — Social page's Auto-Edit wizard asks "how long" up front — a
// real target length, not just a vibe. Cutting dead space/fillers already
// shrinks the timeline; this closes the gap the rest of the way so the
// export actually lands near the requested length instead of just being
// "however long the surviving footage happens to be." Deliberately
// conservative: if the cut footage is ALREADY at or under target, nothing
// changes (never artificially pads/slows down just to hit a number) —
// short-form "make this 30 seconds" means "don't go over," not "pad to
// exactly 30." Speed-up alone (real ffmpeg setpts/atempo, same clamp
// renderFinalVideo already enforces) handles up to 2x overage; anything
// beyond that maxes out at 2x and trims the remainder off the END of the
// timeline, in order — a simple, honest, predictable rule stated plainly
// in the returned note rather than silently guessing which footage matters
// most (that would need real content understanding, out of scope for a
// zero-API-key, keyword-driven editor).
export const fitClipsToDuration = (clips: EditorClip[], targetSec: number): { clips: EditorClip[]; note: string } => {
  if (!targetSec || targetSec <= 0 || clips.length === 0) return { clips, note: "" };
  const effDur = (c: EditorClip) => c.isImage ? Math.max(0, c.endSec - c.startSec) : Math.max(0, c.endSec - c.startSec) / Math.max(0.5, Math.min(2, c.speed || 1));
  const total = clips.reduce((s, c) => s + effDur(c), 0);
  if (total <= targetSec + 0.5) return { clips, note: "" };
  const neededRatio = total / targetSec;
  if (neededRatio <= 2) {
    const sped = clips.map(c => c.isImage ? c : ({ ...c, speed: Math.min(2, Math.max(0.5, (c.speed || 1) * neededRatio)) }));
    return { clips: sped, note: `sped up ${neededRatio.toFixed(2)}x to fit your ${targetSec}s target` };
  }
  const spedClips = clips.map(c => c.isImage ? c : ({ ...c, speed: 2 }));
  let acc = 0;
  const kept: EditorClip[] = [];
  for (const c of spedClips) {
    if (acc >= targetSec) break;
    const d = effDur(c);
    if (acc + d <= targetSec) { kept.push(c); acc += d; continue; }
    const remainingSourceSec = (targetSec - acc) * (c.isImage ? 1 : Math.max(0.5, Math.min(2, c.speed || 1)));
    kept.push({ ...c, endSec: Math.min(c.endSec, c.startSec + Math.max(0.4, remainingSourceSec)) });
    acc = targetSec;
  }
  return { clips: kept.length > 0 ? kept : clips, note: `sped up 2x and trimmed from the end to fit your ${targetSec}s target (footage was ~${Math.round(total)}s after cuts)` };
};

// Escapes text for safe embedding inside an ffmpeg filtergraph string —
// drawtext's `text=` value is itself inside a filter string that's already
// colon/comma-delimited, so both those AND single quotes need escaping or
// a caption containing punctuation silently breaks the whole filter chain.
const escapeDrawtext = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019").replace(/%/g, "\\%");

// FEATURE — "make it so you can change the frame size, like 9:16, etc."
// Real output dimensions per aspect ratio, matching common short-form/
// square/landscape norms. scale+crop (not just scale) is the standard
// "reframe to fill" technique — scales up until the target box is fully
// covered, then crops the overflow, so a landscape source clip cut down to
// 9:16 doesn't end up letterboxed with black bars.
export type AspectRatio = "9:16" | "1:1" | "16:9" | "4:5" | "4:3";
export const ASPECT_DIMENSIONS: Record<AspectRatio, { w: number; h: number }> = {
  "9:16": { w: 720, h: 1280 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1280, h: 720 },
  // FEATURE — "add more options for everything." Instagram/Facebook feed
  // portrait (the tallest ratio the feed itself allows, taller posts get
  // cropped) and classic 4:3 for older/wider-compatibility placements.
  "4:5": { w: 1080, h: 1350 },
  "4:3": { w: 1280, h: 960 },
};
export const ASPECT_RATIOS: AspectRatio[] = ["9:16", "1:1", "4:5", "16:9", "4:3"];

// Detects silence in a clip's audio track (ffmpeg's silencedetect filter),
// used for the "Auto-Cut Silence" button. Returns ranges in seconds,
// ABSOLUTE within the original file (matching every other convention in
// this file — clip.startSec/endSec are always source-file-absolute).
// BUG FIX (audit finding — real perf win) — this used to always analyze
// the WHOLE uploaded file, even when the owner had already trimmed the
// clip down to a short window: splitClipAtRanges clamps/discards any
// detected range outside [startSec,endSec] anyway, so decoding the rest
// was pure waste — often the single biggest win in the whole pipeline for
// a common real workflow (upload a multi-minute raw take, trim to a
// 20-40s highlight, THEN run Auto-Edit). Also adds -vn: silencedetect
// only reads the audio stream, but without -vn ffmpeg was decoding the
// FULL video stream too just to discard it into `-f null -`.
export const detectSilence = async (file: File, noiseDb = -30, minDurationSec = 0.6, window?: { startSec: number; endSec: number }): Promise<{ start: number; end: number }[]> => {
  const ff = await loadFfmpeg();
  const inName = "silence-in-" + file.name.replace(/[^a-z0-9.]/gi, "_");
  await ff.writeFile(inName, await fetchFile(file));
  // BUG FIX — "auto-cut silence is analyzing, but doesn't show any
  // result." lastLog is a shared, capped 500-line ring buffer (see
  // loadFfmpeg's `ff.on("log", ...)` above) fed by EVERY log line this
  // exec call prints — including ffmpeg's own per-frame `-stats` progress
  // output, which for anything longer than a few seconds of footage blows
  // past 500 lines on its own and evicts the real silence_start/
  // silence_end pairs before this function ever reads them back out.
  // `-nostats` suppresses that per-frame progress spam (silencedetect's
  // own log lines are a separate, always-on log stream and are
  // unaffected), so the ring buffer only ever holds lines this function
  // actually cares about.
  lastLog = [];
  const windowArgs = window ? ["-ss", String(window.startSec), "-t", String(Math.max(0.1, window.endSec - window.startSec))] : [];
  await ff.exec([...windowArgs, "-i", inName, "-vn", "-nostats", "-af", `silencedetect=noise=${noiseDb}dB:d=${minDurationSec}`, "-f", "null", "-"]);
  await ff.deleteFile(inName).catch(() => {});
  // silencedetect's reported times are relative to whatever we fed it —
  // when a window was given, that's the TRIMMED input (starts at 0), so
  // offset back to source-file-absolute seconds to keep this function's
  // return contract identical either way.
  const offset = window?.startSec || 0;
  const ranges: { start: number; end: number }[] = [];
  let pendingStart: number | null = null;
  for (const line of lastLog) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) { pendingStart = parseFloat(startMatch[1]) + offset; continue; }
    const endMatch = line.match(/silence_end:\s*([\d.]+)/);
    if (endMatch && pendingStart !== null) {
      ranges.push({ start: pendingStart, end: parseFloat(endMatch[1]) + offset });
      pendingStart = null;
    }
  }
  return ranges;
};

// Reads a video file's duration by loading it into a detached <video> —
// far cheaper than asking ffmpeg to probe it, and doesn't need the engine
// loaded yet (so clip durations can show up before the editor finishes
// loading ffmpeg in the background).
export const readVideoDuration = (file: File): Promise<number> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { const d = v.duration; URL.revokeObjectURL(url); resolve(Number.isFinite(d) ? d : 0); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    v.src = url;
  });

// Same idea as readVideoDuration, but also grabs the source's real pixel
// dimensions — needed to turn a fractional crop rect (see CropRect) into
// real pixel coordinates for ffmpeg's crop filter.
export const readVideoMeta = (file: File): Promise<{ duration: number; width: number; height: number }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = v.duration, w = v.videoWidth, h = v.videoHeight;
      URL.revokeObjectURL(url);
      resolve({ duration: Number.isFinite(d) ? d : 0, width: w || 0, height: h || 0 });
    };
    v.onerror = () => { URL.revokeObjectURL(url); resolve({ duration: 0, width: 0, height: 0 }); };
    v.src = url;
  });

// Reads a still image's real pixel dimensions — the image-clip equivalent
// of readVideoMeta, used when a photo is added to the timeline (see
// EditorClip.isImage above).
export const readImageMeta = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { const w = img.naturalWidth, h = img.naturalHeight; URL.revokeObjectURL(url); resolve({ width: w || 0, height: h || 0 }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: 0, height: 0 }); };
    img.src = url;
  });

// Extracts a trimmed clip's audio as a small mp3 — used to send to
// transcribe-audio.ts for auto-captions. Kept separate from the main
// export pipeline (doesn't touch normalized-clip state) so it can run any
// time the owner presses "Auto-Captions," independent of rendering.
// BUG FIX (audit finding — real perf win). inName used to be keyed by
// clip.id — unique PER PIECE — so when dead-space cutting splits one
// original upload into N pieces, this wrote the SAME source file's bytes
// into ffmpeg's virtual FS (a real blob read + WASM-heap copy, often tens
// of MB) N separate times during the Auto-Edit caption loop, once per
// piece, even though every piece shares the identical clip.file. An
// optional per-run `fsCache` (keyed by the underlying File, not the
// piece's id) lets the caller write the source ONCE and reuse it for
// every piece's -ss/-t extraction — a direct N-to-1 reduction in
// redundant full-file writes for an N-piece clip. Callers that don't pass
// one (the single-clip manual "Auto-Captions" button, where there's only
// ever one call and no reuse to be had) get the exact previous behavior.
export const extractAudioForTranscription = async (clip: EditorClip, fsCache?: Map<File, string>): Promise<Blob> => {
  const ff = await loadFfmpeg();
  let inName = fsCache?.get(clip.file);
  if (!inName) {
    inName = "transcribe-in-" + clip.id.replace(/[^a-z0-9]/gi, "");
    await ff.writeFile(inName, await fetchFile(clip.file));
    fsCache?.set(clip.file, inName);
  }
  const outName = "transcribe-out-" + clip.id.replace(/[^a-z0-9]/gi, "") + ".mp3";
  const dur = Math.max(0.1, clip.endSec - clip.startSec);
  await ff.exec(["-ss", String(clip.startSec), "-i", inName, "-t", String(dur), "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1", "-b:a", "64k", outName]);
  const data = await ff.readFile(outName);
  // Only delete the shared input when nothing else will reuse it — the
  // caller (runAutoEdit) owns cleanup of everything in fsCache once its
  // whole per-run loop is done, since other pieces still need it until then.
  if (!fsCache) await ff.deleteFile(inName).catch(() => {});
  await ff.deleteFile(outName).catch(() => {});
  return new Blob([data as any], { type: "audio/mpeg" });
};

// Cleans up every shared input file a fsCache (see extractAudioForTranscription
// above) accumulated over one Auto-Edit run — call once after the whole
// per-piece caption loop finishes, not per-piece (other pieces still need
// their entry until then). Keeps ffmpeg's virtual filesystem from growing
// unbounded across multiple Auto-Edit runs in one long browser session.
export const cleanupFsCache = async (fsCache: Map<File, string>): Promise<void> => {
  if (fsCache.size === 0) return;
  const ff = await loadFfmpeg();
  for (const name of fsCache.values()) await ff.deleteFile(name).catch(() => {});
  fsCache.clear();
};

// FEATURE — "build a video editor that works without an API key,
// automatically editing and adding captions." "local" runs real speech
// recognition entirely in the browser (lib/localTranscription.ts, via
// transformers.js) — no account, no key, no server call, genuinely free
// regardless of usage, same "free, runs on-device" positioning as ffmpeg.wasm
// itself. Listed FIRST (and always reports a truthy keyFrom) so it's the
// provider Auto-Edit picks by default for an owner who hasn't configured any
// paid transcription key — captions now work out of the box with zero
// setup. openai/groq/deepgram remain available as opt-in upgrades (an owner
// who already has one of those keys may prefer its speed/accuracy) — see
// functions/api/transcribe-audio.ts for what actually calls each of those.
// PERF FEATURE (audit finding) — "local-fast" is the SAME zero-key
// on-device path as "local", just backed by whisper-tiny.en instead of
// base.en (see localTranscription.ts's MODEL_IDS) — real ~2-3x faster
// transcription, at a real, honest cost: a meaningfully higher word-error
// rate, worse on the noisy job-site audio this app's clips are actually
// shot in. An explicit opt-in the owner picks when they want, never a
// silent default swap.
export type CaptionProvider = "local" | "local-fast" | "openai" | "groq" | "deepgram";
export const CAPTION_PROVIDERS: { id: CaptionProvider; label: string; keyFrom: (settings: any) => string | undefined }[] = [
  { id: "local", label: "Built-in (free, no API key)", keyFrom: () => "local-whisper" },
  { id: "local-fast", label: "Built-in — Faster (free, lower accuracy)", keyFrom: () => "local-whisper" },
  { id: "openai", label: "OpenAI Whisper", keyFrom: (s: any) => s?.modelKeys?.openai },
  { id: "groq", label: "Groq Whisper (fast)", keyFrom: (s: any) => s?.modelKeys?.groq },
  { id: "deepgram", label: "Deepgram", keyFrom: (s: any) => s?.deepgramApiKey },
];
// Both "local" providers run on-device with real word-level timestamps —
// callers branch on this (not a literal "local" === check) so filler-word
// cutting/karaoke-caption grouping applies to "local-fast" too, not just
// to the exact string "local".
export const isLocalCaptionProvider = (provider: CaptionProvider): boolean => provider === "local" || provider === "local-fast";

// Thin fetcher shared by the per-clip "Auto-Captions" button and the
// full "Auto-Edit" pipeline below. The "local" provider transcribes
// on-device and never touches the network at all; every other provider
// proxies through /api/transcribe-audio with the owner's own key, same as
// before. onProgress is only ever used by the local path (model download/
// transcribe phase text) — the network providers are a single request with
// no meaningful sub-progress to report.
export const requestTranscription = async (
  audioBlob: Blob,
  provider: CaptionProvider,
  apiKey: string,
  onProgress?: (msg: string) => void
): Promise<{ text: string; start: number; end: number }[]> => {
  if (isLocalCaptionProvider(provider)) return transcribeAudioLocally(audioBlob, onProgress, provider === "local-fast" ? "fast" : "balanced");
  const form = new FormData();
  form.append("audio", audioBlob, "audio.mp3");
  form.append("apiKey", apiKey);
  form.append("provider", provider);
  const res = await fetch("/api/transcribe-audio", { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data.segments || [];
};

export type WordTiming = { text: string; start: number; end: number };
export type CaptionGroup = { text: string; start: number; end: number; words: WordTiming[] };

// FEATURE — "improve auto-editing." Word-level timestamps mean the actual
// transcript text is known, not just where speech is — so filler words
// ("um," "uh," "like," "you know") can be identified and cut out of the
// TIMELINE itself, not just muted, the same thing Descript/Opus Clip market
// as a headline auto-edit feature. Deliberately a short, high-confidence
// list (bare filler interjections only) — a real word like "like" used
// meaningfully ("I like this") can't be told apart from filler "like" by
// text alone, so this only strips the small set of words that are almost
// never meaningful on their own as a single-word utterance.
const FILLER_WORDS = new Set(["um", "umm", "uh", "uhh", "erm", "hm", "hmm", "ah"]);
export const isFillerWord = (text: string): boolean =>
  FILLER_WORDS.has(text.toLowerCase().replace(/[^a-z]/g, ""));

// Returns the silent RANGES a filler word occupies (plus a small pad) so
// the caller can feed them straight into the same "keep" complement math
// autoCutClipDeadSpace already uses for silence — filler removal and
// silence removal end up being the exact same operation, just seeded by
// text instead of decibels.
export const findFillerWordRanges = (words: WordTiming[], padSec = 0.05): { start: number; end: number }[] =>
  words.filter(w => isFillerWord(w.text)).map(w => ({ start: Math.max(0, w.start - padSec), end: w.end + padSec }));

// FEATURE — "really good-looking, timed auto captions." The local
// provider (lib/localTranscription.ts) returns WORD-level timestamps, not
// sentence-level — used raw, that's one drawtext caption per word, way too
// fast/flickery to read. Grouped into short 3-4-word lines instead, the
// same "a few words pop in, then the next few" rhythm every modern short-
// form auto-captioner (CapCut, Opus Clip, etc.) actually uses, instead of
// one long sentence sitting on screen for 4+ seconds. Breaks a group early
// on a natural speech pause too, so a caption line doesn't span across a
// breath/sentence boundary just because the word count hasn't hit yet. Each
// group keeps its own constituent `words` (real per-word start/end) so
// lib/assCaptions.ts can burn a real karaoke word-highlight sweep instead
// of just a static line.
export const groupWordsIntoCaptionLines = (
  words: WordTiming[],
  opts: { maxWords?: number; maxChars?: number; maxGroupDurationSec?: number; pauseBreakSec?: number; dropFillers?: boolean } = {}
): CaptionGroup[] => {
  const maxWords = opts.maxWords ?? 4;
  const maxChars = opts.maxChars ?? 24;
  const maxGroupDurationSec = opts.maxGroupDurationSec ?? 2.2;
  const pauseBreakSec = opts.pauseBreakSec ?? 0.6;
  const cleaned = opts.dropFillers === false ? words : words.filter(w => !isFillerWord(w.text));
  const groups: CaptionGroup[] = [];
  let current: WordTiming[] = [];
  const flush = () => {
    if (current.length === 0) return;
    groups.push({
      text: current.map(w => w.text.trim()).join(" ").replace(/\s+([,.!?;:])/g, "$1"),
      start: current[0].start,
      end: current[current.length - 1].end,
      words: current.slice(),
    });
    current = [];
  };
  for (const w of cleaned) {
    if (!w.text || !w.text.trim()) continue;
    const prev = current[current.length - 1];
    const gapTooBig = !!prev && (w.start - prev.end) > pauseBreakSec;
    const wouldBeTooLong = current.length > 0 && (current.map(x => x.text).join(" ").length + 1 + w.text.length) > maxChars;
    const durationTooLong = current.length > 0 && (w.end - current[0].start) > maxGroupDurationSec;
    if (gapTooBig || wouldBeTooLong || durationTooLong || current.length >= maxWords) flush();
    current.push(w);
  }
  flush();
  return groups;
};

// FEATURE — "make it so you can auto edit, it auto cuts the dead spaces,
// pieces the clips together." Trimming the clip's own start/end (the
// existing Auto-Cut Silence button) only ever handled silence at the very
// edges — a pause in the MIDDLE of a clip stayed in. This actually splits
// a clip at every silent stretch found inside its current trim bounds,
// returning one EditorClip per non-silent stretch — the render pipeline
// already concatenates clips in array order, so replacing one clip with
// its several "keep" pieces is all "piecing them back together" requires;
// nothing else about renderFinalVideo needs to change.
// Generalized "cut these ranges out, keep the rest" splitter — the shared
// math behind both silence-based auto-cut (below) and filler-word removal
// (runAutoEdit in VideoEditorModal.tsx): given a set of ranges to REMOVE
// (silence, or a filler word's span), returns the complementary "keep"
// pieces as real EditorClips. BUG FIX (this pass) — the previous inline
// version only copied id/file/startSec/endSec/durationSec/rotation/flipH/
// transitionToNext onto each split piece, silently dropping crop/color-
// look/brightness-contrast-saturation/audioEffect/muted on any clip that
// got auto-cut. Spreading `...clip` first now carries every property
// forward onto every piece, only overriding what actually changes.
export const splitClipAtRanges = (
  clip: EditorClip,
  cutRanges: { start: number; end: number }[],
  minKeepSec = 0.4
): EditorClip[] => {
  const trimStart = clip.startSec, trimEnd = clip.endSec;
  const clipped = cutRanges
    .map(r => ({ start: Math.max(r.start, trimStart), end: Math.min(r.end, trimEnd) }))
    .filter(r => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  if (clipped.length === 0) return [clip];

  // Complement of the cut ranges within the clip's own trim bounds — the
  // stretches that actually get kept.
  const keep: { start: number; end: number }[] = [];
  let cursor = trimStart;
  for (const r of clipped) {
    if (r.start > cursor) keep.push({ start: cursor, end: r.start });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < trimEnd) keep.push({ start: cursor, end: trimEnd });

  // Drop/merge slivers too short to be worth a separate re-encoded piece —
  // otherwise a normal mid-sentence breath (or a filler word right next to
  // real speech) can get stutter-cut into a dozen near-instant clips
  // instead of reading as one continuous take.
  const merged: { start: number; end: number }[] = [];
  for (const seg of keep) {
    if (seg.end - seg.start < minKeepSec && merged.length > 0) { merged[merged.length - 1].end = seg.end; continue; }
    merged.push({ ...seg });
  }
  const final = merged.filter(seg => seg.end - seg.start >= minKeepSec);
  if (final.length === 0) return [clip];
  if (final.length === 1 && Math.abs(final[0].start - trimStart) < 0.05 && Math.abs(final[0].end - trimEnd) < 0.05) return [clip];

  return final.map((seg, i) => ({
    ...clip,
    id: uid(),
    startSec: seg.start,
    endSec: seg.end,
    // Only the LAST piece of a split clip should carry the original
    // transition into whatever clip comes next — the pieces in between are
    // internal cuts within what was one continuous clip, always hard cuts.
    transitionToNext: i === final.length - 1 ? clip.transitionToNext : "none",
    // See EditorClip.internalCutOnly — marks every non-last piece as an
    // invisible cleanup edit, not a real editor-chosen cut.
    internalCutOnly: i === final.length - 1 ? clip.internalCutOnly : true,
  }));
};

export const autoCutClipDeadSpace = async (
  clip: EditorClip,
  noiseDb = -30,
  minSilenceSec = 0.6
): Promise<EditorClip[]> => {
  const ranges = await detectSilence(clip.file, noiseDb, minSilenceSec, clip.isImage ? undefined : { startSec: clip.startSec, endSec: clip.endSec });
  return splitClipAtRanges(clip, ranges, 0.4);
};

// FEATURE — "improve auto-editing ten times." Physically cuts filler-word
// spans (see FILLER_WORDS above) out of a clip — not just skipping them in
// the caption text — using the exact same splitClipAtRanges complement math
// silence-cutting already uses, just seeded from the transcript's own word
// boundaries instead of decibels. `words` must be CLIP-RELATIVE (0 =
// clip.startSec, the same convention extractAudioForTranscription's output
// already uses). Returns the resulting clip pieces AND the surviving
// (non-filler) words remapped onto the NEW post-cut timeline — still
// clip-relative to the FIRST returned piece — so the caller can build
// captions from them without re-deriving the offset math itself.
export const stripFillerWordsFromClip = (
  clip: EditorClip,
  words: WordTiming[]
): { clips: EditorClip[]; words: WordTiming[] } => {
  const fillerRangesRel = findFillerWordRanges(words);
  if (fillerRangesRel.length === 0) return { clips: [clip], words };
  const fillerRangesAbs = fillerRangesRel.map(r => ({ start: r.start + clip.startSec, end: r.end + clip.startSec }));
  const pieces = splitClipAtRanges(clip, fillerRangesAbs, 0.25);
  if (pieces.length === 1 && pieces[0].id === clip.id) return { clips: pieces, words };

  // Cumulative map: source-absolute time -> new clip-relative time (0 =
  // the first surviving piece's own start).
  let cursor = 0;
  const offsets = pieces.map(p => {
    const off = cursor;
    cursor += Math.max(0, p.endSec - p.startSec);
    return { start: p.startSec, end: p.endSec, newOffset: off };
  });
  const remapAbs = (tAbs: number): number | null => {
    for (const o of offsets) {
      if (tAbs >= o.start - 1e-6 && tAbs <= o.end + 1e-6) {
        return o.newOffset + (Math.min(Math.max(tAbs, o.start), o.end) - o.start);
      }
    }
    return null;
  };
  const survivors: WordTiming[] = [];
  for (const w of words) {
    if (isFillerWord(w.text)) continue;
    const absStart = w.start + clip.startSec, absEnd = w.end + clip.startSec;
    const newStart = remapAbs(absStart), newEnd = remapAbs(absEnd);
    // A word that fell inside a removed range (shouldn't happen for a
    // non-filler word, but a boundary rounding edge case is possible) is
    // dropped from captions rather than risk a corrupted/negative timing —
    // the video cut itself is unaffected either way.
    if (newStart === null || newEnd === null || newEnd <= newStart) continue;
    survivors.push({ text: w.text, start: newStart, end: newEnd });
  }
  return { clips: pieces, words: survivors };
};

export type RenderProgress = (phase: string, pct: number) => void;

// Builds the drawtext `enable`/alpha expression for a caption's entrance
// animation. Preview (VideoEditorModal.tsx) shows a real CSS keyframe
// equivalent for each of these ids — kept in sync by animation id so what
// the owner sees while editing matches what actually gets burned in.
const ANIM_FADE_SEC = 0.35;
const animatedAlphaExpr = (animation: string, startSec: number, endSec: number): string => {
  const s = startSec, e = endSec, f = ANIM_FADE_SEC;
  switch (animation) {
    case "fade":
    case "pop":
    case "bounce":
      // Fade the alpha in/out over ANIM_FADE_SEC at each edge — drawtext's
      // `alpha` expression is evaluated per-frame with `t` (seconds).
      return `if(lt(t,${s + f}),(t-${s})/${f},if(gt(t,${e - f}),(${e}-t)/${f},1))`;
    case "flicker":
      // Fast random-ish on/off using a high-frequency sine — reads as a
      // glitch/flicker rather than a smooth fade, matching the style's name.
      return `if(between(t,${s},${e}),0.6+0.4*sin(t*40),0)`;
    default:
      return `between(t,${s},${e})`;
  }
};
// Vertical offset expression for slide-up/shake animations — added on top
// of the style's own base Y position.
const animatedYOffset = (animation: string, startSec: number): string => {
  switch (animation) {
    case "slide-up": return `+max(0,(1-(t-${startSec})/${ANIM_FADE_SEC})*40)`;
    case "shake": return `+4*sin((t-${startSec})*30)`;
    case "bounce": return `+max(0,(1-(t-${startSec})/${ANIM_FADE_SEC})*(-14))`;
    default: return "";
  }
};

// The main export: trims each clip to its in/out points, normalizes them
// to a shared resolution/framerate/codec (uploaded clips routinely come
// from different phones at different resolutions — concat/xfade both
// require matching streams or they silently produce a broken/black
// output), joins them in order (hard concat when every transition is
// "none"/hard-cut — much faster, stream-copy only; a real xfade/acrossfade
// filter_complex chain when any transition is set), then burns every
// caption on top with its own style + entrance animation, positioned by
// time via drawtext's per-frame alpha/x/y expressions.
export const renderFinalVideo = async (
  clips: EditorClip[],
  captions: EditorCaption[],
  onProgress?: RenderProgress,
  aspectRatio: AspectRatio = "9:16",
  overlays: EditorOverlay[] = [],
  music: MusicTrack | null = null,
  // FEATURE — "camera flickers." A quick white flash-strobe at every HARD
  // cut (never at a clip already using a smooth xfade transition — the two
  // effects would visually fight at the same boundary), the punchy "flash
  // cut" look fast-paced montage/vlog edits use. Real per-frame ffmpeg eq
  // brightness expression (confirmed to support `t`), not a static filter.
  cameraFlicker = false
): Promise<Blob> => {
  if (clips.length === 0) throw new Error("Add at least one clip first");
  onProgress?.("Loading video engine", 5);
  const ff = await loadFfmpeg(msg => onProgress?.(msg, 5));
  const { w: targetW, h: targetH } = ASPECT_DIMENSIONS[aspectRatio];

  const normalizedNames: string[] = [];
  const normalizedDurations: number[] = [];
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    onProgress?.(`Trimming clip ${i + 1}/${clips.length}`, 10 + Math.round((i / clips.length) * 30));
    const isImage = !!c.isImage;
    const inName = `clip-in-${i}.${isImage ? "img" : "mp4"}`;
    const outName = `clip-norm-${i}.mp4`;
    await ff.writeFile(inName, await fetchFile(c.file));
    const dur = Math.max(0.1, c.endSec - c.startSec);
    // Reframe to fill the target box exactly (scale up to cover, then
    // crop the overflow) rather than a plain scale — a plain scale to a
    // different aspect ratio than the source either distorts or
    // letterboxes; this is the standard "reframe" technique CapCut and
    // every other short-form editor uses. A manual crop (if the owner drew
    // one) comes first — relative to the SOURCE's own pixels, before
    // rotation/flip touch the frame at all — then rotation/flip, then any
    // color adjustment, then the aspect-ratio reframe.
    const filters: string[] = [];
    if (c.crop && c.width && c.height) {
      const cw = Math.max(2, Math.round(c.crop.w * c.width / 2) * 2);
      const ch = Math.max(2, Math.round(c.crop.h * c.height / 2) * 2);
      const cx = Math.max(0, Math.round(c.crop.x * c.width));
      const cy = Math.max(0, Math.round(c.crop.y * c.height));
      filters.push(`crop=${cw}:${ch}:${cx}:${cy}`);
    }
    if (c.rotation === 90) filters.push("transpose=1");
    else if (c.rotation === 180) filters.push("transpose=1,transpose=1");
    else if (c.rotation === 270) filters.push("transpose=2");
    if (c.flipH) filters.push("hflip");
    // FEATURE — "add more options for everything" — real slow-motion/
    // speed-up. atempo only supports 0.5-2.0 in a single pass, hence the
    // clamp (a real ffmpeg filter limit, not an arbitrary UI cap).
    const speed = isImage ? 1 : Math.max(0.5, Math.min(2, c.speed || 1));
    if (speed !== 1) filters.push(`setpts=PTS/${speed.toFixed(3)}`);
    // FEATURE — "change saturation, contrast, brightness, etc." -100..100
    // sliders mapped onto ffmpeg eq's real ranges: brightness -1..1,
    // contrast 0..2, saturation 0..3 (clamped — the slider only reaches 2).
    const hasColorAdjust = !!(c.brightness || c.contrast || c.saturation);
    if (hasColorAdjust) {
      const b = ((c.brightness || 0) / 100).toFixed(3);
      const cst = (1 + (c.contrast || 0) / 100).toFixed(3);
      const s = Math.max(0, 1 + (c.saturation || 0) / 100).toFixed(3);
      filters.push(`eq=brightness=${b}:contrast=${cst}:saturation=${s}`);
    }
    // FEATURE — "video effects, video filters, good-looking LUTs." Applied
    // AFTER the manual correction sliders above (grade goes on top of
    // correction, same order a real colorist works in) and before the
    // aspect-ratio reframe, so the look is graded on the source's full
    // resolution rather than the downscaled export frame.
    const look = getColorLook(c.colorLook);
    if (look.filterChain) filters.push(look.filterChain);
    filters.push(`scale=${targetW}:${targetH}:force_original_aspect_ratio=increase`, `crop=${targetW}:${targetH}`, "fps=30");
    // FEATURE — "applying various sound effects such as muffled or
    // underwater sounds." Applied to this clip's own audio stream during
    // normalization, before concat/xfade ever sees it — the same standard
    // ffmpeg audio filter shown in the editor's live description.
    const fx = getSoundEffect(c.audioEffect);
    const combinedAudioFilter = [fx.filter, c.muted ? "volume=0" : null, speed !== 1 ? `atempo=${speed.toFixed(3)}` : null].filter(Boolean).join(",");
    const audioArgs = combinedAudioFilter ? ["-af", combinedAudioFilter] : [];
    if (isImage) {
      // FEATURE — "more photo editing options." A still image has no
      // native timeline to seek/trim — `-loop 1` turns it into a video
      // stream for exactly `dur` seconds, and a synthetic silent audio
      // track (anullsrc) keeps this clip's stream layout identical to
      // every real video clip's, which concat/xfade both require.
      await ff.exec([
        "-loop", "1", "-i", inName,
        "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-t", String(dur),
        "-vf", filters.join(","),
        ...audioArgs,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-shortest", "-movflags", "+faststart",
        outName,
      ]);
    } else {
      await ff.exec([
        "-ss", String(c.startSec), "-i", inName, "-t", String(dur),
        // Even dimensions (libx264 requires them — targetW/H above are
        // already even) and a real audio track even if the source clip is
        // silent (concat/xfade both need every segment to have the same
        // stream layout).
        "-vf", filters.join(","),
        ...audioArgs,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart",
        outName,
      ]);
    }
    await ff.deleteFile(inName).catch(() => {});
    normalizedNames.push(outName);
    // Speed changes this clip's own OUTPUT duration (a still image ignores
    // speed entirely — there's no source timeline to stretch) — every
    // downstream consumer (xfade transition offsets, camera-flicker flash
    // points) needs the REAL resulting duration, not the source trim length.
    normalizedDurations.push(isImage ? dur : dur / speed);
  }

  const hasRealTransitions = clips.slice(0, -1).some(c => c.transitionToNext && c.transitionToNext !== "none");
  onProgress?.("Joining clips", 45);
  let joinedName: string;
  if (!hasRealTransitions || clips.length === 1) {
    // Fast path — stream-copy concat, no re-encode of the join itself.
    const listContent = normalizedNames.map(n => `file '${n}'`).join("\n");
    await ff.writeFile("concat_list.txt", listContent);
    await ff.exec(["-f", "concat", "-safe", "0", "-i", "concat_list.txt", "-c", "copy", "joined.mp4"]);
    await ff.deleteFile("concat_list.txt").catch(() => {});
    joinedName = "joined.mp4";
  } else {
    // Real xfade/acrossfade transition chain — every pair of adjacent
    // clips is joined with clip[i].transitionToNext's real ffmpeg xfade
    // type (or a near-instant 0.05s fade standing in for "hard cut" pairs
    // within the same chain, so mixing hard cuts and real transitions in
    // one edit doesn't need two different pipelines).
    onProgress?.("Building transitions", 50);
    const inputArgs: string[] = [];
    normalizedNames.forEach(n => { inputArgs.push("-i", n); });
    let vLabel = "0:v";
    let aLabel = "0:a";
    let runningDur = normalizedDurations[0];
    const filterParts: string[] = [];
    for (let i = 1; i < normalizedNames.length; i++) {
      const t = getTransition(clips[i - 1].transitionToNext || "none");
      const d = t.xfadeType ? t.durationSec : 0.05;
      const xfadeType = t.xfadeType || "fade";
      const offset = Math.max(0, runningDur - d);
      const vOut = `v${i}`;
      const aOut = `a${i}`;
      filterParts.push(`[${vLabel}][${i}:v]xfade=transition=${xfadeType}:duration=${d}:offset=${offset.toFixed(3)}[${vOut}]`);
      filterParts.push(`[${aLabel}][${i}:a]acrossfade=d=${d}[${aOut}]`);
      vLabel = vOut; aLabel = aOut;
      runningDur = runningDur + normalizedDurations[i] - d;
    }
    await ff.exec([
      ...inputArgs,
      "-filter_complex", filterParts.join(";"),
      "-map", `[${vLabel}]`, "-map", `[${aLabel}]`,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-c:a", "aac", "-movflags", "+faststart",
      "joined.mp4",
    ]);
    joinedName = "joined.mp4";
  }
  for (const n of normalizedNames) await ff.deleteFile(n).catch(() => {});

  // FEATURE — "camera flickers." Flash points are every HARD-cut boundary
  // (a clip whose transitionToNext is "none"/unset) — a boundary already
  // using a real xfade transition is skipped, since a flash and a smooth
  // crossfade at the same instant would just look broken together, not
  // stacked. Positions use plain cumulative clip durations (ignoring the
  // ~0.05s a mixed xfade chain shrinks a hard-cut boundary by) — a flash
  // effect spans ~150ms, so that much drift is genuinely imperceptible and
  // not worth the extra complexity of replicating the xfade offset math
  // here. Wrapped in try/catch with a skip-on-failure fallback, same
  // defensive pattern as the ASS caption burn below — this can't be
  // visually test-rendered in this environment.
  // PERF FIX (audit finding) — flicker and captions used to be two
  // separate full-timeline x264 re-encodes back to back (every
  // AUTO_EDIT_TEMPLATES preset with cameraFlicker:true also burns
  // captions, so this combination is common, not an edge case). Both are
  // just `-vf` filter passes over the same input — compute the flicker
  // filter STRING here without executing it yet, then prepend it onto
  // whichever caption filter actually runs below (ass or the drawtext
  // fallback), merging them into ONE exec/one re-encode. Only falls back
  // to a standalone flicker-only exec when there are no captions to merge
  // it with.
  let flickerFilterPrefix = "";
  if (cameraFlicker && normalizedDurations.length > 1) {
    const flashPoints: number[] = [];
    let cum = 0;
    for (let i = 0; i < clips.length - 1; i++) {
      cum += normalizedDurations[i];
      const t = getTransition(clips[i].transitionToNext || "none");
      // BUG FIX (audit finding) — skip flash points at an internal
      // silence/filler-word cut (see EditorClip.internalCutOnly): those
      // are invisible cleanup edits, not a real cut the editor chose, and
      // flashing at every one of them (there can be dozens per clip) reads
      // as a strobing glitch rather than the intended punchy flash-cut look.
      if (!t.xfadeType && !clips[i].internalCutOnly) flashPoints.push(cum);
    }
    if (flashPoints.length > 0) {
      const brightnessExpr = flashPoints
        .map(t => `if(between(t,${t.toFixed(3)},${(t + 0.05).toFixed(3)}),0.55,if(between(t,${(t + 0.08).toFixed(3)},${(t + 0.12).toFixed(3)}),0.28,0))`)
        .join("+");
      flickerFilterPrefix = `eq=brightness='${brightnessExpr}',`;
    }
  }
  if (flickerFilterPrefix && captions.length === 0) {
    // Nothing to merge it with — apply standalone, same as before.
    onProgress?.("Adding camera flicker", 63);
    try {
      await ff.exec(["-i", joinedName, "-vf", flickerFilterPrefix.slice(0, -1), "-c:a", "copy", "flickered.mp4"]);
      await ff.deleteFile(joinedName).catch(() => {});
      joinedName = "flickered.mp4";
    } catch (e: any) {
      console.warn("[VideoEditor] camera-flicker pass failed, exporting without it:", e?.message);
    }
    flickerFilterPrefix = "";
  }

  let finalInput = joinedName;
  if (captions.length > 0) {
    onProgress?.(flickerFilterPrefix ? "Adding camera flicker + burning captions" : "Burning captions", 70);
    // FEATURE — "improve auto captions ten times... genuinely good-looking,
    // timed auto captions with good animations." Real word-by-word karaoke
    // highlighting via a genuine ASS/SSA subtitle burn (lib/assCaptions.ts)
    // — libass ships in ffmpeg.wasm's core, so this is a native `ass`
    // filter pass, not an emulation. One filter pass for every caption
    // (faster than N chained drawtext filters, too). Wrapped in a full
    // try/catch with the ORIGINAL per-line drawtext burn kept below as a
    // fallback — this can't be visually test-rendered in this environment,
    // so if the ass filter ever throws (a future core build without
    // libass, a malformed style edge case), captions still burn in via the
    // proven older path instead of silently exporting with none at all.
    let assSucceeded = false;
    try {
      const usedStyles = Array.from(new Set(captions.map(c => c.styleId))).map(id => getCaptionStyle(id));
      for (const style of usedStyles) await ensureFontInDir(ff, style);
      const { content } = buildAssDocument(captions, targetW, targetH);
      await ff.writeFile("captions.ass", new TextEncoder().encode(content));
      await ff.exec(["-i", finalInput, "-vf", `${flickerFilterPrefix}ass=captions.ass:fontsdir=/fonts`, "-c:a", "copy", "captioned-ass.mp4"]);
      await ff.deleteFile("captions.ass").catch(() => {});
      assSucceeded = true;
    } catch (e: any) {
      console.warn("[VideoEditor] ASS karaoke caption burn failed, falling back to plain captions:", e?.message);
    }
    if (assSucceeded) {
      await ff.deleteFile(finalInput).catch(() => {});
      finalInput = "captioned-ass.mp4";
    } else {
    const drawtextFilters: string[] = [];
    for (const cap of captions) {
      const style = getCaptionStyle(cap.styleId);
      const fontFile = await ensureFont(ff, style);
      const text = escapeDrawtext(style.uppercase ? cap.text.toUpperCase() : cap.text);
      // FEATURE — "move the text around." A caption with an explicit
      // xPct/yPct (dragged in the preview, see VideoEditorModal.tsx)
      // overrides the style's default top/center/bottom placement;
      // otherwise falls back to the style's own position exactly as before.
      const baseY = cap.yPct !== undefined ? `h*${cap.yPct.toFixed(4)}-text_h/2` : style.position === "top" ? "h*0.12" : style.position === "center" ? "(h-text_h)/2" : "h*0.82";
      const baseX = cap.xPct !== undefined ? `w*${cap.xPct.toFixed(4)}-text_w/2` : "(w-text_w)/2";
      const yOffset = animatedYOffset(style.animation, cap.startSec);
      const y = `${baseY}${yOffset}`;
      const boxParts = style.background
        ? `:box=1:boxcolor=black@0.55:boxborderw=14`
        : "";
      const strokeParts = style.strokeWidth > 0 ? `:borderw=${style.strokeWidth}:bordercolor=${style.strokeColor}` : "";
      const alphaExpr = animatedAlphaExpr(style.animation, cap.startSec, cap.endSec);
      // FEATURE — "click a caption to resize it." fontScale defaults to 1
      // (unchanged) — real pixel size in the actual export, not just a
      // preview-only CSS affectation.
      const fontScale = cap.fontScale && cap.fontScale > 0 ? cap.fontScale : 1;
      // BUG FIX (audit finding — same root cause as the ASS path in
      // assCaptions.ts's resolveBaseFontSize) — this drawtext fallback
      // (only used if the ass filter itself throws) sized text from
      // frame HEIGHT alone (h*0.055), with no reference to width — on a
      // narrow 9:16 frame that oversizes text well past what the frame
      // can fit. min(w*0.09,h*0.055) is the same two fractions
      // resolveBaseFontSize uses, expressed as a live ffmpeg expression
      // (w/h are the filtergraph's own runtime frame-size variables)
      // instead of a JS-computed constant, since drawtext's fontsize
      // already supports arbitrary math via ffmpeg's eval, same as the
      // "punch" animation's overshoot expression right below.
      const baseFontSize = `min(w*${(0.09 * fontScale).toFixed(4)},h*${(0.055 * fontScale).toFixed(4)})`;
      // FEATURE — "really good-looking, timed auto captions with good
      // animations." The "punch" animation (see captionStyles.ts's
      // hook-punch/karaoke-box presets, built for fast word-grouped auto-
      // captions) overshoots the font size ~40% right on entrance and
      // settles back to normal over ~0.28s — a real per-frame size pop,
      // not just a fade. drawtext's fontsize accepts a live expression the
      // same way alpha/x/y already do here; single-quoted so the commas
      // inside max()/abs()/min() aren't mistaken for filter-chain separators
      // (same reasoning as alpha='${alphaExpr}' below).
      const fontSizeExpr = style.animation === "punch"
        ? `${baseFontSize}*(1+0.4*max(0,1-abs(t-${cap.startSec}-0.1)/0.18))`
        : baseFontSize;
      drawtextFilters.push(
        `drawtext=fontfile=${fontFile}:text='${text}':fontcolor=${style.color}:fontsize='${fontSizeExpr}'` +
        `:x=${baseX}:y=${y}${strokeParts}${boxParts}` +
        `:enable='between(t,${cap.startSec},${cap.endSec})':alpha='${alphaExpr}'`
      );
    }
    // Flicker merged in here too (audit finding) — if the ass filter
    // throws, this fallback still needs to apply it, not silently drop it.
    await ff.exec(["-i", finalInput, "-vf", flickerFilterPrefix + drawtextFilters.join(","), "-c:a", "copy", "captioned.mp4"]);
    await ff.deleteFile(finalInput).catch(() => {});
    finalInput = "captioned.mp4";
    }
  }

  // FEATURE — "add a CapCut-style multi-track editor with overlays, drag
  // and drop... their own branding — logo, phone number." Each overlay is
  // scaled to its own widthPct of the frame and composited with ffmpeg's
  // real `overlay` filter, gated to only be visible during its own
  // startSec–endSec window — the exact same time-gating technique already
  // used for captions above, just for an image layer instead of drawtext.
  // Applied one at a time (simpler and more debuggable than one giant
  // filter_complex for an arbitrary number of overlays) — each overlay's
  // output becomes the next overlay's input.
  if (overlays.length > 0) {
    onProgress?.("Compositing overlays", 78);
    for (let i = 0; i < overlays.length; i++) {
      const ov = overlays[i];
      const outName = `overlaid-${i}.mp4`;
      const ovW = Math.max(2, Math.round(ov.widthPct * targetW / 2) * 2);
      const opacity = Math.max(0, Math.min(1, ov.opacity));
      if (ov.kind === "video" && ov.file) {
        // Picture-in-picture: the PiP clip's own frames are trimmed to the
        // overlay's own on-screen duration, then time-shifted (setpts +
        // startSec/TB) so they land at the right point on the GLOBAL
        // timeline before being composited — `overlay=...enable=between(...)`
        // still gates visibility to that exact window the same as an image.
        const pipName = `pip-${i}-` + ov.file.name.replace(/[^a-z0-9.]/gi, "_");
        await ff.writeFile(pipName, await fetchFile(ov.file));
        const dur = Math.max(0.1, ov.endSec - ov.startSec);
        const videoChain =
          `[1:v]scale=${ovW}:-1,trim=duration=${dur},setpts=PTS-STARTPTS+${ov.startSec}/TB[pipv${i}];` +
          (opacity < 1 ? `[pipv${i}]format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}[pipv${i}a];` : "") +
          `[0:v][pipv${i}${opacity < 1 ? "a" : ""}]overlay=x=${ov.xPct.toFixed(4)}*W-w/2:y=${ov.yPct.toFixed(4)}*H-h/2:enable='between(t,${ov.startSec},${ov.endSec})'[vout${i}]`;
        if (ov.muted === false) {
          // Mix the PiP clip's own audio in under the main track's, the same
          // trim/delay/amix technique the music stage below uses — delayed
          // by startSec so it lines up with when the PiP actually appears.
          const delayMs = Math.max(0, Math.round(ov.startSec * 1000));
          const audioChain = `[1:a]atrim=start=0:duration=${dur},asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs}[pipa${i}];[0:a][pipa${i}]amix=inputs=2:duration=first:dropout_transition=0[aout${i}]`;
          await ff.exec(["-i", finalInput, "-i", pipName, "-filter_complex", `${videoChain};${audioChain}`, "-map", `[vout${i}]`, "-map", `[aout${i}]`, "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", outName]);
        } else {
          await ff.exec(["-i", finalInput, "-i", pipName, "-filter_complex", videoChain, "-map", `[vout${i}]`, "-map", "0:a", "-c:a", "copy", outName]);
        }
        await ff.deleteFile(pipName).catch(() => {});
      } else {
        const imgName = `overlay-${i}.png`;
        const res = await fetch(ov.src);
        const buf = new Uint8Array(await res.arrayBuffer());
        await ff.writeFile(imgName, buf);
        const overlayFilter =
          `[1:v]scale=${ovW}:-1[ovl${i}];` +
          (opacity < 1 ? `[ovl${i}]format=rgba,colorchannelmixer=aa=${opacity.toFixed(3)}[ovl${i}a];` : "") +
          `[0:v][ovl${i}${opacity < 1 ? "a" : ""}]overlay=x=${(ov.xPct).toFixed(4)}*W-w/2:y=${(ov.yPct).toFixed(4)}*H-h/2:enable='between(t,${ov.startSec},${ov.endSec})'`;
        await ff.exec(["-i", finalInput, "-i", imgName, "-filter_complex", overlayFilter, "-c:a", "copy", outName]);
        await ff.deleteFile(imgName).catch(() => {});
      }
      await ff.deleteFile(finalInput).catch(() => {});
      finalInput = outName;
    }
  }

  // FEATURE — "enable adding music, moving music tracks." Trims the music
  // file to its own selected window, applies volume, delays it to start at
  // the right point in the GLOBAL timeline (adelay — ffmpeg's real per-
  // channel audio-offset filter), and mixes it under the video's existing
  // audio with amix (duration=first keeps the output length pinned to the
  // video, so a long music file can never extend the final export).
  if (music) {
    onProgress?.("Mixing music", 88);
    const musicIn = "music-in." + (music.file.name.split(".").pop() || "mp3");
    await ff.writeFile(musicIn, await fetchFile(music.file));
    const trimDur = Math.max(0.1, music.trimEnd - music.trimStart);
    const delayMs = Math.max(0, Math.round(music.startSec * 1000));
    const vol = Math.max(0, music.volume);
    const musicFilter = `[1:a]atrim=start=${music.trimStart}:duration=${trimDur},asetpts=PTS-STARTPTS,volume=${vol.toFixed(3)},adelay=${delayMs}|${delayMs}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=0[aout]`;
    await ff.exec(["-i", finalInput, "-i", musicIn, "-filter_complex", musicFilter, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "mixed.mp4"]);
    await ff.deleteFile(finalInput).catch(() => {});
    await ff.deleteFile(musicIn).catch(() => {});
    finalInput = "mixed.mp4";
  }

  onProgress?.("Finalizing", 92);
  const data = await ff.readFile(finalInput);
  await ff.deleteFile(finalInput).catch(() => {});
  onProgress?.("Done", 100);
  return new Blob([data as any], { type: "video/mp4" });
};
