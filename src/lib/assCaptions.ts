import { getCaptionStyle, type CaptionStyle } from "./captionStyles";

// FEATURE — "improve auto captions ten times... genuinely good-looking,
// timed auto captions with good animations." The previous caption pipeline
// burned one static drawtext filter per caption line — a whole phrase
// fading/popping in as one block, no distinction between the word actually
// being spoken and the ones around it. Real short-form caption tools
// (CapCut, Opus Clip, Submagic) all use word-by-word KARAOKE highlighting —
// the exact effect ASS/SSA subtitles (Advanced SubStation Alpha) were
// designed for via the `\kf` karaoke-fill tag, and ffmpeg.wasm's core
// ships with libass compiled in, so this is a real, native `ass` filter
// burn — not an emulation. This file builds that .ass document; videoEditor.
// ts's renderFinalVideo writes it to ffmpeg's virtual filesystem and runs
// `-vf ass=captions.ass:fontsdir=/fonts`, falling back to the old per-line
// drawtext burn (still in videoEditor.ts) if the ass filter ever throws —
// belt-and-suspenders since this can't be visually test-rendered here.
export type AssWord = { text: string; start: number; end: number };
export type AssCaptionInput = {
  text: string; startSec: number; endSec: number; styleId: string;
  xPct?: number; yPct?: number; fontScale?: number;
  words?: AssWord[];
};

// BUG FIX (audit finding — "captions didn't even fit the screen; they were
// completely wrong"). Root cause: font size was computed from targetH ONLY
// (Math.round(targetH * 0.055)) with zero reference to targetW, the actual
// horizontal room text has to fit in. On the app's own default aspect
// ratio, 9:16 (720x1280 — the narrowest width / tallest height of all 5
// presets), that produced a ~70px font in a 720px-wide frame — a 24-
// character caption line at that size runs roughly 850-1000px wide,
// wider than the frame itself, and WrapStyle:2 (below) told libass NOT to
// auto-wrap, so it rendered as one line running off both edges.
// Exported so BOTH the export path (below) and the live in-editor preview
// (VideoEditorModal.tsx) compute the identical number — the previous bug
// was invisible in the editor specifically because the preview used an
// unrelated CSS `vw` unit that could never reproduce an overflow, so
// "looks right in the editor" was structurally guaranteed regardless of
// what the export actually did.
export const resolveBaseFontSize = (targetW: number, targetH: number): number =>
  Math.max(8, Math.round(Math.min(targetW * 0.09, targetH * 0.055)));

// Average rendered glyph width for these bold/condensed caption fonts, as
// a fraction of font size — a real measurement would need an actual font
// metrics lookup (not available in ffmpeg.wasm's filtergraph context or
// cheaply in a browser without rendering to a canvas per style), so this
// is a deliberately conservative estimate (real bold sans-serif caption
// fonts commonly run 0.5-0.6x) tuned toward UNDER-filling the line rather
// than over-filling it — a caption a little short of the available width
// is a minor cosmetic non-issue; one that overflows the frame is the bug
// this whole fix exists to prevent.
const AVG_GLYPH_WIDTH_RATIO = 0.56;
// Exported so groupWordsIntoCaptionLines (videoEditor.ts) can size caption
// LINES to the actual export resolution instead of a flat, aspect-ratio-
// blind character count — the second half of the same root cause: even
// with a correctly-sized font, a line built for a 24-character budget can
// still overflow a narrow 9:16 frame's available width.
export const estimateMaxCharsPerLine = (targetW: number, targetH: number, fontScale = 1): number => {
  const fontSizePx = resolveBaseFontSize(targetW, targetH) * fontScale;
  return Math.max(6, Math.floor((targetW * 0.92) / (fontSizePx * AVG_GLYPH_WIDTH_RATIO)));
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// ASS timestamps: H:MM:SS.CC (centiseconds, always 2 digits, no leading
// zero on the hour component).
const formatAssTime = (sec: number): string => {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  const cs = Math.min(99, Math.round((s - Math.floor(s)) * 100));
  return `${h}:${pad2(m)}:${pad2(ss)}.${pad2(cs)}`;
};

// ASS colors are &HAABBGGRR& — alpha+BGR, reversed from CSS's RRGGBB, and
// alpha is INVERTED (00 = fully opaque, FF = fully transparent).
const hexToAssColor = (hex: string, alphaHex = "00"): string => {
  const h = (hex || "#ffffff").replace("#", "");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return `&H${alphaHex}FFFFFF&`;
  const r = h.slice(0, 2), g = h.slice(2, 4), b = h.slice(4, 6);
  return `&H${alphaHex}${b}${g}${r}&`.toUpperCase();
};
const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHexByte = (v: number) => clampByte(v).toString(16).padStart(2, "0").toUpperCase();

// Parses the CSS background strings captionStyles.ts actually uses
// ("rgba(r,g,b,a)" or a plain "#rrggbb") into an ASS BackColour + whether
// this style should render as an opaque box (BorderStyle 3) or a plain
// outlined glyph with no box (BorderStyle 1).
const parseBackground = (bg: string | null): { backColorAss: string; borderStyle: 1 | 3 } => {
  if (!bg) return { backColorAss: "&HFF000000&", borderStyle: 1 };
  const m = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  if (m) {
    const [, r, g, b, a] = m;
    const alpha = a !== undefined ? parseFloat(a) : 1;
    const alphaHex = toHexByte((1 - alpha) * 255);
    return { backColorAss: `&H${alphaHex}${toHexByte(Number(b))}${toHexByte(Number(g))}${toHexByte(Number(r))}&`, borderStyle: 3 };
  }
  if (bg.startsWith("#")) return { backColorAss: hexToAssColor(bg, "00"), borderStyle: 3 };
  return { backColorAss: "&HFF000000&", borderStyle: 1 };
};

// Escapes text for safe embedding in an ASS Dialogue line — braces open/
// close override blocks, so literal ones in real text would corrupt the
// line; backslash needs escaping for the same reason karaoke/transform tags
// use it as their own prefix.
const escapeAss = (s: string): string =>
  s.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\r?\n/g, "\\N");

// Per-animation ASS override tags, applied once at the START of a line
// (before the first word's karaoke tag) — real interpolated `\t` transform
// keyframes, not a per-frame expression hack, so these render as smooth,
// genuine motion. Timings are RELATIVE to the line's own start (ASS `\t`
// default), so the same tag string works regardless of where in the video
// this line actually falls.
const animTag = (animation: string): string => {
  switch (animation) {
    case "fade": return "\\fad(220,180)";
    case "pop": return "\\fscx60\\fscy60\\t(0,180,\\fscx112\\fscy112)\\t(180,280,\\fscx100\\fscy100)\\fad(30,60)";
    case "bounce": return "\\fscy45\\t(0,160,\\fscy118)\\t(160,290,\\fscy100)\\fad(30,60)";
    case "punch": return "\\fscx70\\fscy70\\t(0,120,\\fscx120\\fscy120)\\t(120,280,\\fscx100\\fscy100)\\fad(20,60)";
    case "shake": return "\\t(0,60,\\frz3)\\t(60,120,\\frz-3)\\t(120,180,\\frz2)\\t(180,240,\\frz0)\\fad(30,60)";
    case "flicker": return "\\alpha&HFF&\\t(0,40,\\alpha&H00&)\\t(40,80,\\alpha&HFF&)\\t(80,130,\\alpha&H00&)";
    case "typewriter": return "\\fad(90,90)";
    default: return "\\fad(120,120)";
  }
};

// Words come from real per-word transcription timing when available
// (groupWordsIntoCaptionLines); a hand-typed caption or a phrase-level
// paid-provider segment has none, so it's estimated here by splitting on
// whitespace and distributing the line's own duration proportionally by
// character length — every caption gets the karaoke effect either way,
// just with real timing when it exists and a close estimate when it doesn't.
const wordsForLine = (cap: AssCaptionInput): AssWord[] => {
  if (cap.words && cap.words.length > 0) return cap.words;
  const raw = cap.text.trim().split(/\s+/).filter(Boolean);
  if (raw.length === 0) return [];
  const totalChars = raw.reduce((s, w) => s + w.length, 0) || 1;
  const dur = Math.max(0.05, cap.endSec - cap.startSec);
  let cursor = cap.startSec;
  return raw.map(w => {
    const wDur = dur * (w.length / totalChars);
    const start = cursor, end = cursor + wDur;
    cursor = end;
    return { text: w, start, end };
  });
};

// Builds the `{\kf..}Word {\kf..}Word` karaoke run for one line — `\kf`
// (fill karaoke) sweeps the highlight color across each word's own glyphs
// over its duration, the classic lyric-video look, timed to real speech
// when real word timestamps are known. Duration for word i is measured
// from the END of word i-1 (not its own start) so the cumulative total
// always exactly matches the line's own on-screen duration even when
// there are small natural gaps between words — a gap just means the
// highlight visually holds a beat longer heading into the next word
// instead of a skipped/negative timing.
const karaokeRun = (cap: AssCaptionInput, uppercase: boolean): string => {
  const words = wordsForLine(cap);
  if (words.length === 0) return escapeAss(uppercase ? cap.text.toUpperCase() : cap.text);
  let cursor = cap.startSec;
  return words.map(w => {
    const wEnd = Math.max(cursor, w.end);
    const centis = Math.max(1, Math.round((wEnd - cursor) * 100));
    cursor = wEnd;
    const text = uppercase ? w.text.toUpperCase() : w.text;
    return `{\\kf${centis}}${escapeAss(text)} `;
  }).join("").trimEnd();
};

// Same top/center/bottom + drag-to-reposition logic the old drawtext path
// used, just resolved to an explicit pixel point up front — every line
// gets an `\an5\pos(x,y)` (or `\move` for slide-up) rather than relying on
// ASS's own alignment/margin system, so positioning behaves identically
// whether or not the owner ever dragged a caption in the preview.
const resolveAnchor = (cap: AssCaptionInput, style: CaptionStyle, targetW: number, targetH: number, fontSizePx: number) => {
  const x = cap.xPct !== undefined ? cap.xPct * targetW : targetW / 2;
  const y = cap.yPct !== undefined
    ? cap.yPct * targetH
    : style.position === "top" ? targetH * 0.12 + fontSizePx * 0.6
    : style.position === "center" ? targetH * 0.5
    : targetH * 0.82 - fontSizePx * 0.1;
  return { x: Math.round(x), y: Math.round(y) };
};

export type AssBuildResult = { content: string; fontFamilies: string[] };

// Builds one complete .ass document for every caption in the timeline —
// burned in a SINGLE ffmpeg filter pass (one `ass` filter, not N chained
// drawtext filters), which is also meaningfully faster to encode.
export const buildAssDocument = (
  captions: AssCaptionInput[],
  targetW: number,
  targetH: number
): AssBuildResult => {
  const usedStyleIds = Array.from(new Set(captions.map(c => c.styleId)));
  const styles = usedStyleIds.map(id => getCaptionStyle(id));
  const fontFamilies = Array.from(new Set(styles.map(s => s.cssFamily)));

  const styleLines = styles.map(style => {
    const baseFontSize = resolveBaseFontSize(targetW, targetH);
    const { backColorAss, borderStyle } = parseBackground(style.background);
    const primary = hexToAssColor(style.color, "00");
    // Karaoke's "not yet sung" color — a bright, high-contrast accent so
    // the currently-spoken word visibly pops against the rest of the line,
    // distinct from the style's own resting text color.
    const secondary = style.color.toLowerCase() === "#ffe600" ? "&H0000A5FF&" : "&H0000E6FF&";
    const outline = hexToAssColor(style.strokeColor === "transparent" ? "#000000" : style.strokeColor, "00");
    const bold = style.fontWeight >= 700 ? -1 : 0;
    const outlineW = borderStyle === 3 ? 6 : Math.max(1, style.strokeWidth);
    const shadow = borderStyle === 3 ? 0 : 1;
    return `Style: ${style.id},${style.cssFamily},${baseFontSize},${primary},${secondary},${outline},${backColorAss},${bold},0,0,0,100,100,${(parseFloat(style.letterSpacing) || 0) * baseFontSize},0,${borderStyle},${outlineW},${shadow},5,10,10,${Math.round(targetH * 0.06)},1`;
  }).join("\n");

  const events = captions.map(cap => {
    const style = getCaptionStyle(cap.styleId);
    const baseFontSize = resolveBaseFontSize(targetW, targetH);
    const fontScale = cap.fontScale && cap.fontScale > 0 ? cap.fontScale : 1;
    // BUG FIX (audit finding #4) — no defensive check anywhere previously
    // measured a caption against the frame it was about to be burned
    // into, so an overflowing line produced no trace until someone
    // actually watched the exported video. This can't catch everything
    // (glyph width is an estimate, not a real font metrics lookup) but
    // catches the common case — a caption manually stretched via
    // fontScale, or a style change that raises the per-caption budget —
    // and gives future debugging a console trail instead of silence.
    const maxChars = estimateMaxCharsPerLine(targetW, targetH, fontScale);
    if (cap.text.length > maxChars * 1.15) {
      console.warn(`[VideoEditor] caption may overflow frame: "${cap.text.slice(0, 40)}${cap.text.length > 40 ? "…" : ""}" is ${cap.text.length} chars, estimated budget ~${maxChars} at this size/resolution (${targetW}x${targetH}) — WrapStyle 0 will auto-wrap it, but check it still reads well.`);
    }
    const { x, y } = resolveAnchor(cap, style, targetW, targetH, baseFontSize * fontScale);
    const scaleTag = fontScale !== 1 ? `\\fscx${Math.round(fontScale * 100)}\\fscy${Math.round(fontScale * 100)}` : "";
    const posTag = style.animation === "slide-up"
      ? `\\an5\\move(${x},${y + 46},${x},${y},0,240)`
      : `\\an5\\pos(${x},${y})`;
    const text = `{${posTag}${scaleTag}${animTag(style.animation)}}${karaokeRun(cap, style.uppercase)}`;
    return `Dialogue: 0,${formatAssTime(cap.startSec)},${formatAssTime(cap.endSec)},${style.id},,0,0,0,,${text}`;
  }).join("\n");

  // BUG FIX (audit finding) — WrapStyle 2 = no automatic wrapping at all
  // (only an explicit \N breaks a line), which is exactly why an over-
  // length caption rendered as one line running off both edges of the
  // frame instead of wrapping. groupWordsIntoCaptionLines now sizes lines
  // to the real export width (see estimateMaxCharsPerLine above), so this
  // should rarely even trigger — WrapStyle 0 (libass's normal smart
  // wrapping, evenly split against PlayResX) is a safety net for whatever
  // that estimate doesn't catch (a single very long word, a manually
  // enlarged fontScale), not the primary fix.
  const content = `[Script Info]
ScriptType: v4.00+
PlayResX: ${targetW}
PlayResY: ${targetH}
ScaledBorderAndShadow: yes
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleLines}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events}
`;
  return { content, fontFamilies };
};
