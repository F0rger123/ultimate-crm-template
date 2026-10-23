import type { CSSProperties } from "react";

// Caption style presets for the Social section's video editor. Each preset
// is a real, renderable style — used both for the live CSS preview overlay
// (VideoEditorModal.tsx, via Google Fonts <link> + captionStyleToCss) and
// for the actual burned-in export via ffmpeg's drawtext filter
// (videoEditor.ts's buildDrawtextFilter). Keeping ONE source of truth per
// preset is what guarantees the preview actually matches the export
// instead of silently drifting apart.
//
// 30 presets, inspired by the genres of caption look that show up
// constantly across CapCut/TikTok/Reels edits (bold pop, karaoke-box,
// meme, glitch/cyber, retro VHS, handwritten, editorial, etc.) — these are
// ORIGINAL presets built from real font/color/stroke/animation choices,
// not copied from any specific paid template library. A screenshot of a
// look you want recreated can always be turned into a new preset here too.
//
// fontFileUrl points at a real static (non-variable) TTF via jsDelivr's
// mirror of the google/fonts GitHub repo (confirmed CORS-enabled, unlike
// raw.githubusercontent.com, and confirmed to 200 for each path below) —
// ffmpeg's drawtext needs an actual font FILE on its virtual filesystem,
// not a CSS @font-face reference, and FreeType (which drawtext uses) can't
// reliably pick a weight out of a variable font, so every style here uses
// a font that ships a real static file for the weight it wants.
export type CaptionAnimation = "none" | "pop" | "bounce" | "slide-up" | "fade" | "shake" | "typewriter" | "flicker" | "punch";

export type CaptionStyle = {
  id: string;
  name: string;
  category: string;
  description: string;
  cssFamily: string; // Google Fonts family name, exactly as it appears in the fonts.googleapis.com URL
  fontFileUrl: string; // static TTF for ffmpeg drawtext
  fontWeight: number;
  color: string;
  strokeColor: string;
  strokeWidth: number; // px in preview; mapped to drawtext borderw
  background: string | null; // CSS background for the preview pill/box; null = none
  uppercase: boolean;
  position: "top" | "center" | "bottom";
  letterSpacing: string;
  // Live-preview-only entrance animation (CSS keyframes, see
  // VideoEditorModal.tsx). Export-side equivalents (fade/slide via
  // drawtext's alpha/y expressions) are applied per-animation in
  // videoEditor.ts's buildDrawtextFilter — kept in sync by animation id.
  animation: CaptionAnimation;
};

const JSDELIVR_FONTS = "https://cdn.jsdelivr.net/gh/google/fonts@main/";
const F = {
  archivoBlack: JSDELIVR_FONTS + "ofl/archivoblack/ArchivoBlack-Regular.ttf",
  anton: JSDELIVR_FONTS + "ofl/anton/Anton-Regular.ttf",
  bebas: JSDELIVR_FONTS + "ofl/bebasneue/BebasNeue-Regular.ttf",
  latoBold: JSDELIVR_FONTS + "ofl/lato/Lato-Bold.ttf",
  latoReg: JSDELIVR_FONTS + "ofl/lato/Lato-Regular.ttf",
  poppinsSemi: JSDELIVR_FONTS + "ofl/poppins/Poppins-SemiBold.ttf",
  poppinsBold: JSDELIVR_FONTS + "ofl/poppins/Poppins-Bold.ttf",
  alfaSlab: JSDELIVR_FONTS + "ofl/alfaslabone/AlfaSlabOne-Regular.ttf",
  bungee: JSDELIVR_FONTS + "ofl/bungee/Bungee-Regular.ttf",
  righteous: JSDELIVR_FONTS + "ofl/righteous/Righteous-Regular.ttf",
  fjalla: JSDELIVR_FONTS + "ofl/fjallaone/FjallaOne-Regular.ttf",
  passionBold: JSDELIVR_FONTS + "ofl/passionone/PassionOne-Bold.ttf",
  kanitBold: JSDELIVR_FONTS + "ofl/kanit/Kanit-Bold.ttf",
  kanitExtra: JSDELIVR_FONTS + "ofl/kanit/Kanit-ExtraBold.ttf",
  orbitron: JSDELIVR_FONTS + "ofl/orbitron/Orbitron%5Bwght%5D.ttf",
  pressStart: JSDELIVR_FONTS + "ofl/pressstart2p/PressStart2P-Regular.ttf",
  caveat: JSDELIVR_FONTS + "ofl/caveat/Caveat%5Bwght%5D.ttf",
  bangers: JSDELIVR_FONTS + "ofl/bangers/Bangers-Regular.ttf",
  creepster: JSDELIVR_FONTS + "ofl/creepster/Creepster-Regular.ttf",
  monoton: JSDELIVR_FONTS + "ofl/monoton/Monoton-Regular.ttf",
  vt323: JSDELIVR_FONTS + "ofl/vt323/VT323-Regular.ttf",
  blackOps: JSDELIVR_FONTS + "ofl/blackopsone/BlackOpsOne-Regular.ttf",
  // FEATURE — "better, artistic fonts." Rounds out the set with real
  // script/brush, elegant-serif, graffiti, and art-deco display faces —
  // genres the original 21 fonts didn't cover at all.
  greatVibes: JSDELIVR_FONTS + "ofl/greatvibes/GreatVibes-Regular.ttf",
  pacifico: JSDELIVR_FONTS + "ofl/pacifico/Pacifico-Regular.ttf",
  playfairBold: JSDELIVR_FONTS + "ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf",
  cinzelBold: JSDELIVR_FONTS + "ofl/cinzel/Cinzel%5Bwght%5D.ttf",
  permanentMarker: JSDELIVR_FONTS + "ofl/permanentmarker/PermanentMarker-Regular.ttf",
  luckiestGuy: JSDELIVR_FONTS + "ofl/luckiestguy/LuckiestGuy-Regular.ttf",
  abrilFatface: JSDELIVR_FONTS + "ofl/abrilfatface/AbrilFatface-Regular.ttf",
  spaceMono: JSDELIVR_FONTS + "ofl/spacemono/SpaceMono-Bold.ttf",
};
const CSS_FAMILY: Record<string, string> = {
  [F.archivoBlack]: "Archivo Black", [F.anton]: "Anton", [F.bebas]: "Bebas Neue",
  [F.latoBold]: "Lato", [F.latoReg]: "Lato", [F.poppinsSemi]: "Poppins", [F.poppinsBold]: "Poppins",
  [F.alfaSlab]: "Alfa Slab One", [F.bungee]: "Bungee", [F.righteous]: "Righteous",
  [F.fjalla]: "Fjalla One", [F.passionBold]: "Passion One", [F.kanitBold]: "Kanit", [F.kanitExtra]: "Kanit",
  [F.orbitron]: "Orbitron", [F.pressStart]: "Press Start 2P", [F.caveat]: "Caveat",
  [F.bangers]: "Bangers", [F.creepster]: "Creepster", [F.monoton]: "Monoton", [F.vt323]: "VT323", [F.blackOps]: "Black Ops One",
  [F.greatVibes]: "Great Vibes", [F.pacifico]: "Pacifico", [F.playfairBold]: "Playfair Display", [F.cinzelBold]: "Cinzel",
  [F.permanentMarker]: "Permanent Marker", [F.luckiestGuy]: "Luckiest Guy", [F.abrilFatface]: "Abril Fatface", [F.spaceMono]: "Space Mono",
};

type PresetInput = Omit<CaptionStyle, "cssFamily"> & { fontFileUrl: string };
const p = (input: PresetInput): CaptionStyle => ({ ...input, cssFamily: CSS_FAMILY[input.fontFileUrl] });

export const CAPTION_STYLES: CaptionStyle[] = [
  // ── Bold / Impact ──────────────────────────────────────────────
  p({ id: "bold-white-outline", name: "Bold White", category: "Bold", description: "The classic — thick white text, black outline. Works on any background.", fontFileUrl: F.archivoBlack, fontWeight: 900, color: "#ffffff", strokeColor: "#000000", strokeWidth: 3, background: null, uppercase: true, position: "bottom", letterSpacing: "0.01em", animation: "pop" }),
  p({ id: "impact-yellow", name: "Impact Yellow", category: "Bold", description: "High-energy yellow-on-black — reads instantly on a phone screen.", fontFileUrl: F.anton, fontWeight: 400, color: "#ffe600", strokeColor: "#000000", strokeWidth: 3, background: null, uppercase: true, position: "center", letterSpacing: "0.01em", animation: "bounce" }),
  p({ id: "neon-pop", name: "Neon Pop", category: "Bold", description: "Bright red-orange condensed pop text with a heavy black outline — for hooks/CTAs.", fontFileUrl: F.bebas, fontWeight: 400, color: "#ff3d1f", strokeColor: "#000000", strokeWidth: 3, background: null, uppercase: true, position: "top", letterSpacing: "0.02em", animation: "shake" }),
  p({ id: "hot-pink-pop", name: "Hot Pink Pop", category: "Bold", description: "Loud pink-on-black, all caps — stops the scroll.", fontFileUrl: F.anton, fontWeight: 400, color: "#ff2d9e", strokeColor: "#0a0a0a", strokeWidth: 3, background: null, uppercase: true, position: "center", letterSpacing: "0.01em", animation: "pop" }),
  p({ id: "electric-blue", name: "Electric Blue", category: "Bold", description: "Cyan-blue bold text with black outline — high-contrast, energetic.", fontFileUrl: F.archivoBlack, fontWeight: 900, color: "#22d3ee", strokeColor: "#001019", strokeWidth: 3, background: null, uppercase: true, position: "top", letterSpacing: "0.01em", animation: "bounce" }),
  p({ id: "warning-red", name: "Alert Red", category: "Bold", description: "Stark red/white warning-style text — for urgency, deadlines, drama.", fontFileUrl: F.bebas, fontWeight: 400, color: "#ff1414", strokeColor: "#ffffff", strokeWidth: 2, background: "rgba(0,0,0,0.6)", uppercase: true, position: "center", letterSpacing: "0.03em", animation: "shake" }),
  // FEATURE — "add more options for everything."
  p({ id: "safety-orange", name: "Safety Orange", category: "Bold", description: "High-visibility orange-and-black — job-site/safety energy.", fontFileUrl: F.anton, fontWeight: 400, color: "#ff7a00", strokeColor: "#000000", strokeWidth: 3, background: null, uppercase: true, position: "center", letterSpacing: "0.01em", animation: "punch" }),
  // FEATURE — "MrBeast-style captions." Confirmed real spec: Anton font,
  // white fill, heavy black outline (6-10px), words spring in together
  // (scale-up from ~70% with an overshoot, exactly the "punch" animation
  // already built), big and centered. The per-word karaoke highlight sweep
  // every caption gets (see assCaptions.ts) defaults to a bright yellow on
  // a white base style — which is ALSO exactly the real look (each word
  // flashes yellow as it's spoken), so this needed no new rendering code,
  // just the right font/color/animation combination.
  p({ id: "mrbeast", name: "MrBeast Style", category: "Bold", description: "Big bold white caps, thick black outline, spring-pop on every word — the exact high-energy look from MrBeast's videos.", fontFileUrl: F.anton, fontWeight: 400, color: "#ffffff", strokeColor: "#000000", strokeWidth: 4, background: null, uppercase: true, position: "center", letterSpacing: "0.005em", animation: "punch" }),

  // ── Professional / Trade ─────────────────────────────────────────
  p({ id: "trade-pro", name: "Trade Pro", category: "Professional", description: "Clean navy-on-white bar — professional, trustworthy, local-business feel.", fontFileUrl: F.latoBold, fontWeight: 700, color: "#0f172a", strokeColor: "transparent", strokeWidth: 0, background: "rgba(255,255,255,0.95)", uppercase: false, position: "bottom", letterSpacing: "0", animation: "fade" }),
  p({ id: "before-after-tag", name: "Before/After Tag", category: "Professional", description: "Bold label style — built for before/after reveal captions.", fontFileUrl: F.kanitBold, fontWeight: 700, color: "#ffffff", strokeColor: "#000000", strokeWidth: 2, background: "rgba(15,23,42,0.85)", uppercase: true, position: "top", letterSpacing: "0.03em", animation: "slide-up" }),
  p({ id: "whisper-clean", name: "Whisper Clean", category: "Professional", description: "Ultra-minimal thin white text — quiet, understated moments.", fontFileUrl: F.latoReg, fontWeight: 400, color: "#ffffff", strokeColor: "transparent", strokeWidth: 0, background: null, uppercase: false, position: "bottom", letterSpacing: "0.02em", animation: "fade" }),

  // FEATURE — "really good-looking, timed auto captions with good
  // animations." Word-grouped auto-captions (see videoEditor.ts's
  // groupWordsIntoCaptionLines) show 3-4 words at a time, popping in fast —
  // this preset's "punch" animation (a brief size overshoot on entrance,
  // see the fontsize expression in renderFinalVideo) is built specifically
  // for that rapid-fire, word-by-word rhythm.
  p({ id: "hook-punch", name: "Hook Punch", category: "Bold", description: "Big bold caps that punch in with a size overshoot — built for fast, word-by-word auto-captions.", fontFileUrl: F.kanitExtra, fontWeight: 800, color: "#ffffff", strokeColor: "#000000", strokeWidth: 3, background: null, uppercase: true, position: "center", letterSpacing: "0.005em", animation: "punch" }),

  // ── Boxed / Subtitle ───────────────────────────────────────────
  p({ id: "boxed-subtitle", name: "Boxed Subtitle", category: "Boxed", description: "Clean white text on a solid dark pill — traditional, easy to read over busy footage.", fontFileUrl: F.latoBold, fontWeight: 700, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, background: "rgba(0,0,0,0.72)", uppercase: false, position: "bottom", letterSpacing: "0", animation: "fade" }),
  p({ id: "karaoke-box", name: "Karaoke Box", category: "Boxed", description: "Bold white-on-black box, TikTok caption-generator style.", fontFileUrl: F.poppinsBold, fontWeight: 700, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, background: "rgba(10,10,10,0.88)", uppercase: false, position: "center", letterSpacing: "0", animation: "punch" }),
  p({ id: "news-ticker", name: "News Ticker", category: "Boxed", description: "Red box, white bold caps — breaking-news style banner.", fontFileUrl: F.fjalla, fontWeight: 400, color: "#ffffff", strokeColor: "#000000", strokeWidth: 0, background: "#c0181f", uppercase: true, position: "bottom", letterSpacing: "0.02em", animation: "slide-up" }),
  p({ id: "quote-card", name: "Quote Card", category: "Boxed", description: "Soft cream box with dark serif-adjacent text — for testimonial quotes.", fontFileUrl: F.latoReg, fontWeight: 400, color: "#221b16", strokeColor: "transparent", strokeWidth: 0, background: "rgba(250,247,243,0.94)", uppercase: false, position: "center", letterSpacing: "0", animation: "fade" }),
  p({ id: "cta-button", name: "CTA Button", category: "Boxed", description: "Rounded solid-color button look — perfect for \"Book Now\"/\"Swipe Up\" text.", fontFileUrl: F.poppinsSemi, fontWeight: 600, color: "#ffffff", strokeColor: "transparent", strokeWidth: 0, background: "#c22a1f", uppercase: true, position: "bottom", letterSpacing: "0.02em", animation: "bounce" }),

  // ── Clean / Editorial ──────────────────────────────────────────
  p({ id: "minimal-clean", name: "Minimal Clean", category: "Editorial", description: "Understated white sans-serif, thin outline — for a more polished/premium feel.", fontFileUrl: F.latoReg, fontWeight: 400, color: "#ffffff", strokeColor: "#000000", strokeWidth: 1, background: null, uppercase: false, position: "bottom", letterSpacing: "0", animation: "fade" }),
  p({ id: "editorial-serif", name: "Editorial", category: "Editorial", description: "Understated, wide letter-spacing caption — magazine-style.", fontFileUrl: F.latoReg, fontWeight: 400, color: "#f3ece3", strokeColor: "#000000", strokeWidth: 1, background: null, uppercase: true, position: "bottom", letterSpacing: "0.12em", animation: "fade" }),
  p({ id: "podcast-caption", name: "Podcast Caption", category: "Editorial", description: "Simple centered white caption — talking-head/podcast-clip style.", fontFileUrl: F.poppinsSemi, fontWeight: 600, color: "#ffffff", strokeColor: "#000000", strokeWidth: 1, background: null, uppercase: false, position: "bottom", letterSpacing: "0", animation: "typewriter" }),
  p({ id: "glass-caption", name: "Glassmorphic", category: "Editorial", description: "Frosted translucent box, white text — modern/premium aesthetic.", fontFileUrl: F.poppinsSemi, fontWeight: 600, color: "#ffffff", strokeColor: "transparent", strokeWidth: 0, background: "rgba(255,255,255,0.14)", uppercase: false, position: "bottom", letterSpacing: "0.01em", animation: "fade" }),

  // ── Luxury / Warm ──────────────────────────────────────────────
  p({ id: "gold-premium", name: "Gold Premium", category: "Luxury", description: "Gold text on a soft dark box — for testimonial/before-after reveals.", fontFileUrl: F.poppinsSemi, fontWeight: 600, color: "#f2c14e", strokeColor: "#1a1200", strokeWidth: 1, background: "rgba(20,15,5,0.55)", uppercase: false, position: "bottom", letterSpacing: "0.01em", animation: "fade" }),
  p({ id: "luxury-gold-caps", name: "Luxury Caps", category: "Luxury", description: "All-caps gold serif-weight text, wide tracking — high-end brand feel.", fontFileUrl: F.fjalla, fontWeight: 400, color: "#e8c874", strokeColor: "#231705", strokeWidth: 1, background: null, uppercase: true, position: "center", letterSpacing: "0.15em", animation: "fade" }),
  p({ id: "sunset-warm", name: "Sunset Warm", category: "Luxury", description: "Warm coral/orange gradient-adjacent color — golden-hour footage.", fontFileUrl: F.righteous, fontWeight: 400, color: "#ff8a5c", strokeColor: "#2a0e00", strokeWidth: 2, background: null, uppercase: false, position: "bottom", letterSpacing: "0.01em", animation: "pop" }),
  p({ id: "pastel-cute", name: "Pastel Cute", category: "Luxury", description: "Soft pink/lavender rounded text — playful, gentle brand voice.", fontFileUrl: F.poppinsSemi, fontWeight: 600, color: "#ffd6ec", strokeColor: "#5c2a45", strokeWidth: 2, background: null, uppercase: false, position: "center", letterSpacing: "0", animation: "bounce" }),

  // ── Retro / Y2K ────────────────────────────────────────────────
  p({ id: "retro-vhs", name: "Retro VHS", category: "Retro", description: "Magenta/cyan chromatic-aberration-style caption — 80s VHS look.", fontFileUrl: F.vt323, fontWeight: 400, color: "#ff2d9e", strokeColor: "#00e5ff", strokeWidth: 1, background: null, uppercase: true, position: "top", letterSpacing: "0.05em", animation: "flicker" }),
  p({ id: "y2k-chrome", name: "Y2K Chrome", category: "Retro", description: "Bubbly rounded caps with a cool-blue outline — early-2000s web aesthetic.", fontFileUrl: F.bungee, fontWeight: 400, color: "#e8f4ff", strokeColor: "#1c6fd6", strokeWidth: 2, background: null, uppercase: true, position: "center", letterSpacing: "0.02em", animation: "bounce" }),
  p({ id: "retro-groovy", name: "Groovy 70s", category: "Retro", description: "Warm orange rounded display font — retro/groovy vibe.", fontFileUrl: F.righteous, fontWeight: 400, color: "#ffb238", strokeColor: "#4a2200", strokeWidth: 2, background: null, uppercase: false, position: "bottom", letterSpacing: "0.01em", animation: "fade" }),
  p({ id: "pixel-arcade", name: "Pixel Arcade", category: "Retro", description: "8-bit pixel font — retro video-game/arcade caption.", fontFileUrl: F.pressStart, fontWeight: 400, color: "#5cff5c", strokeColor: "#001a00", strokeWidth: 1, background: "rgba(0,0,0,0.6)", uppercase: true, position: "top", letterSpacing: "0", animation: "flicker" }),

  // ── Tech / Cyber ───────────────────────────────────────────────
  p({ id: "cyber-glitch", name: "Cyber Glitch", category: "Tech", description: "Futuristic wide-spaced tech font, cyan glow — sci-fi/tech-transition feel.", fontFileUrl: F.orbitron, fontWeight: 700, color: "#00f0ff", strokeColor: "#001417", strokeWidth: 1, background: null, uppercase: true, position: "center", letterSpacing: "0.08em", animation: "flicker" }),
  p({ id: "terminal-hacker", name: "Terminal", category: "Tech", description: "Green monospace terminal text — hacker/code aesthetic.", fontFileUrl: F.vt323, fontWeight: 400, color: "#3dff6e", strokeColor: "#001a05", strokeWidth: 1, background: "rgba(0,10,0,0.7)", uppercase: false, position: "top", letterSpacing: "0.02em", animation: "typewriter" }),
  p({ id: "holographic", name: "Holographic", category: "Tech", description: "Cool white-blue futuristic caps — clean tech-brand look.", fontFileUrl: F.kanitExtra, fontWeight: 800, color: "#c9f2ff", strokeColor: "#0a3a4a", strokeWidth: 2, background: null, uppercase: true, position: "bottom", letterSpacing: "0.03em", animation: "slide-up" }),

  // ── Fun / Meme ─────────────────────────────────────────────────
  p({ id: "meme-top-bottom", name: "Meme Classic", category: "Fun", description: "The internet's original meme caption — white Impact-style, thick black outline.", fontFileUrl: F.anton, fontWeight: 400, color: "#ffffff", strokeColor: "#000000", strokeWidth: 4, background: null, uppercase: true, position: "top", letterSpacing: "0", animation: "pop" }),
  p({ id: "comic-pop", name: "Comic Pop", category: "Fun", description: "Bold comic-book style burst text — for reactions/punchlines.", fontFileUrl: F.bangers, fontWeight: 400, color: "#ffe600", strokeColor: "#000000", strokeWidth: 3, background: null, uppercase: true, position: "center", letterSpacing: "0.01em", animation: "bounce" }),
  p({ id: "reaction-omg", name: "Reaction OMG", category: "Fun", description: "Big wobbly bold text for reaction/surprise moments.", fontFileUrl: F.bangers, fontWeight: 400, color: "#ff5c1f", strokeColor: "#3a0d00", strokeWidth: 3, background: null, uppercase: true, position: "top", letterSpacing: "0.01em", animation: "shake" }),
  p({ id: "horror-drip", name: "Horror", category: "Fun", description: "Creepy dripping-style display font — Halloween/spooky content.", fontFileUrl: F.creepster, fontWeight: 400, color: "#ff2020", strokeColor: "#000000", strokeWidth: 2, background: null, uppercase: false, position: "center", letterSpacing: "0.02em", animation: "flicker" }),
  p({ id: "confetti-pop", name: "Confetti Pop", category: "Fun", description: "Playful bright bubble text — celebratory, high-energy moments.", fontFileUrl: F.luckiestGuy, fontWeight: 400, color: "#4de3c1", strokeColor: "#0a2a24", strokeWidth: 3, background: null, uppercase: true, position: "center", letterSpacing: "0.01em", animation: "bounce" }),

  // ── Handwritten / Personal ─────────────────────────────────────
  p({ id: "handwritten-note", name: "Handwritten Note", category: "Personal", description: "Casual handwritten script — feels personal, unscripted.", fontFileUrl: F.caveat, fontWeight: 700, color: "#ffffff", strokeColor: "#000000", strokeWidth: 1, background: null, uppercase: false, position: "bottom", letterSpacing: "0", animation: "fade" }),
  p({ id: "sticky-note", name: "Sticky Note", category: "Personal", description: "Handwritten text on a soft yellow note background.", fontFileUrl: F.caveat, fontWeight: 700, color: "#3a2e00", strokeColor: "transparent", strokeWidth: 0, background: "rgba(255,241,150,0.95)", uppercase: false, position: "top", letterSpacing: "0", animation: "pop" }),

  // ── Sport / Bold Display ───────────────────────────────────────
  p({ id: "sports-esp", name: "Sports Broadcast", category: "Sport", description: "Bold italic-feel condensed caps — sports-highlight overlay style.", fontFileUrl: F.kanitBold, fontWeight: 700, color: "#ffffff", strokeColor: "#c0181f", strokeWidth: 2, background: "rgba(10,10,10,0.5)", uppercase: true, position: "bottom", letterSpacing: "0.02em", animation: "slide-up" }),
  p({ id: "countdown-bold", name: "Countdown", category: "Sport", description: "Chunky slab caps — great for day counters/challenge series.", fontFileUrl: F.alfaSlab, fontWeight: 400, color: "#ffffff", strokeColor: "#c22a1f", strokeWidth: 3, background: null, uppercase: true, position: "center", letterSpacing: "0.01em", animation: "pop" }),
  p({ id: "scoreboard", name: "Scoreboard", category: "Sport", description: "Bold slab caps on a dark bar — stat/counter callouts.", fontFileUrl: F.blackOps, fontWeight: 400, color: "#ffffff", strokeColor: "#000000", strokeWidth: 1, background: "rgba(0,0,0,0.75)", uppercase: true, position: "top", letterSpacing: "0.02em", animation: "pop" }),

  // ── Sale / Promo ───────────────────────────────────────────────
  p({ id: "sale-tag", name: "Sale Tag", category: "Promo", description: "High-contrast red/white promo-style caption — discounts, urgency.", fontFileUrl: F.blackOps, fontWeight: 400, color: "#ffffff", strokeColor: "#000000", strokeWidth: 2, background: "#c0181f", uppercase: true, position: "top", letterSpacing: "0.01em", animation: "bounce" }),
  p({ id: "starred-testimonial", name: "5-Star Review", category: "Promo", description: "Clean gold-accented caption for review/testimonial callouts.", fontFileUrl: F.poppinsBold, fontWeight: 700, color: "#ffffff", strokeColor: "transparent", strokeWidth: 0, background: "rgba(20,15,5,0.7)", uppercase: false, position: "bottom", letterSpacing: "0", animation: "fade" }),

  // ── Script / Elegant ───────────────────────────────────────────
  p({ id: "elegant-script", name: "Elegant Script", category: "Script", description: "Flowing calligraphy-style script — weddings, luxury, personal touches.", fontFileUrl: F.greatVibes, fontWeight: 400, color: "#ffffff", strokeColor: "#000000", strokeWidth: 1, background: null, uppercase: false, position: "center", letterSpacing: "0.01em", animation: "fade" }),
  p({ id: "friendly-brush", name: "Friendly Brush", category: "Script", description: "Rounded brush-pen script — warm, approachable, hand-made feel.", fontFileUrl: F.pacifico, fontWeight: 400, color: "#ffe9c7", strokeColor: "#4a2600", strokeWidth: 2, background: null, uppercase: false, position: "bottom", letterSpacing: "0", animation: "pop" }),
  p({ id: "editorial-playfair", name: "Editorial Serif", category: "Script", description: "High-fashion magazine-style serif display — premium editorial look.", fontFileUrl: F.playfairBold, fontWeight: 700, color: "#ffffff", strokeColor: "#000000", strokeWidth: 1, background: null, uppercase: false, position: "center", letterSpacing: "0.01em", animation: "fade" }),
  p({ id: "art-deco-caps", name: "Art Deco Caps", category: "Script", description: "Wide-tracked engraved-style caps — timeless, upscale brand feel.", fontFileUrl: F.cinzelBold, fontWeight: 700, color: "#f0e4c8", strokeColor: "#1a1400", strokeWidth: 1, background: null, uppercase: true, position: "bottom", letterSpacing: "0.18em", animation: "fade" }),

  // ── Marker / Street ────────────────────────────────────────────
  p({ id: "marker-note", name: "Marker Note", category: "Street", description: "Bold permanent-marker handwriting — punchy, DIY energy.", fontFileUrl: F.permanentMarker, fontWeight: 400, color: "#ffffff", strokeColor: "#000000", strokeWidth: 2, background: null, uppercase: false, position: "top", letterSpacing: "0", animation: "shake" }),
  p({ id: "playful-bubble", name: "Playful Bubble", category: "Street", description: "Big rounded bubble-letter caps — fun, youthful, high-energy hooks.", fontFileUrl: F.luckiestGuy, fontWeight: 400, color: "#ffcf3d", strokeColor: "#1a0f00", strokeWidth: 3, background: null, uppercase: true, position: "center", letterSpacing: "0.01em", animation: "bounce" }),
  p({ id: "high-fashion", name: "High Fashion", category: "Street", description: "Dramatic oversized serif display — bold statement openers.", fontFileUrl: F.abrilFatface, fontWeight: 400, color: "#ffffff", strokeColor: "#000000", strokeWidth: 2, background: null, uppercase: false, position: "top", letterSpacing: "0", animation: "pop" }),
  p({ id: "mono-code", name: "Mono Code", category: "Street", description: "Clean bold monospace — technical, precise, modern-brand feel.", fontFileUrl: F.spaceMono, fontWeight: 700, color: "#e8ffe8", strokeColor: "#001a00", strokeWidth: 1, background: "rgba(0,20,0,0.6)", uppercase: false, position: "bottom", letterSpacing: "0.02em", animation: "typewriter" }),
];

export const CAPTION_CATEGORIES = Array.from(new Set(CAPTION_STYLES.map(s => s.category)));

export const getCaptionStyle = (id: string): CaptionStyle => CAPTION_STYLES.find(s => s.id === id) || CAPTION_STYLES[0];

// CSS for the live-preview overlay (VideoEditorModal.tsx renders one of
// these divs positioned over the <video>, swapped per active caption).
export const captionStyleToCss = (s: CaptionStyle): CSSProperties => ({
  fontFamily: `'${s.cssFamily}', sans-serif`,
  fontWeight: s.fontWeight,
  color: s.color,
  textTransform: s.uppercase ? "uppercase" : "none",
  letterSpacing: s.letterSpacing,
  background: s.background || "transparent",
  padding: s.background ? "6px 14px" : 0,
  borderRadius: s.background ? 8 : 0,
  WebkitTextStroke: s.strokeWidth > 0 ? `${s.strokeWidth}px ${s.strokeColor}` : undefined,
  textShadow: s.strokeWidth > 0
    ? [1, -1].flatMap(x => [1, -1].map(y => `${x}px ${y}px 0 ${s.strokeColor}`)).join(", ")
    : undefined,
});

// Google Fonts stylesheet URL covering every family used above, for the
// live preview only (the export path fetches fontFileUrl's TTF directly).
export const CAPTION_GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Archivo+Black", "family=Anton", "family=Bebas+Neue",
    "family=Lato:wght@400;700", "family=Poppins:wght@600;700",
    "family=Alfa+Slab+One", "family=Bungee", "family=Righteous", "family=Fjalla+One",
    "family=Passion+One:wght@700", "family=Kanit:wght@700;800",
    "family=Orbitron:wght@700", "family=Press+Start+2P", "family=Caveat:wght@700",
    "family=Bangers", "family=Creepster", "family=Monoton", "family=VT323", "family=Black+Ops+One",
    "family=Great+Vibes", "family=Pacifico", "family=Playfair+Display:wght@700",
    "family=Cinzel:wght@700", "family=Permanent+Marker", "family=Luckiest+Guy",
    "family=Abril+Fatface", "family=Space+Mono:wght@700",
  ].join("&") + "&display=swap";

// Transition effects between clips (videoEditor.ts's buildTransitionFilter
// applies these via ffmpeg's xfade filter — real crossfade/wipe/slide
// transitions rendered into the export, not just a preview affectation).
export type TransitionEffect = { id: string; name: string; description: string; xfadeType: string; durationSec: number };
export const TRANSITION_EFFECTS: TransitionEffect[] = [
  { id: "none", name: "Hard Cut", description: "No transition — straight cut, the classic edit.", xfadeType: "", durationSec: 0 },
  { id: "crossfade", name: "Crossfade", description: "Smooth dissolve between clips.", xfadeType: "fade", durationSec: 0.4 },
  { id: "wipe-left", name: "Wipe Left", description: "Next clip wipes in from the right.", xfadeType: "wipeleft", durationSec: 0.35 },
  { id: "slide-up", name: "Slide Up", description: "Next clip slides up from the bottom — trendy vertical-video transition.", xfadeType: "slideup", durationSec: 0.35 },
  { id: "zoom-punch", name: "Zoom Punch", description: "Quick zoom-in punch into the next clip — high-energy edit style.", xfadeType: "zoomin", durationSec: 0.3 },
  { id: "glitch-tech", name: "Glitch/Tech", description: "Fast pixelized transition — techy, modern feel between clips.", xfadeType: "pixelize", durationSec: 0.25 },
  { id: "circle-open", name: "Circle Open", description: "Circular reveal transition — playful, clean.", xfadeType: "circleopen", durationSec: 0.4 },
  // FEATURE — "add more transitions." Real ffmpeg xfade types (no new
  // rendering code needed — the existing xfade/acrossfade chain in
  // renderFinalVideo already handles any xfadeType string ffmpeg supports).
  { id: "fade-black", name: "Fade to Black", description: "Dips to black, then into the next clip — classic scene-change feel.", xfadeType: "fadeblack", durationSec: 0.45 },
  { id: "fade-white", name: "Fade to White", description: "Flashes white, then into the next clip — bright, punchy scene change.", xfadeType: "fadewhite", durationSec: 0.35 },
  { id: "wipe-right", name: "Wipe Right", description: "Next clip wipes in from the left.", xfadeType: "wiperight", durationSec: 0.35 },
  { id: "wipe-up", name: "Wipe Up", description: "Next clip wipes in from the bottom.", xfadeType: "wipeup", durationSec: 0.35 },
  { id: "wipe-down", name: "Wipe Down", description: "Next clip wipes in from the top.", xfadeType: "wipedown", durationSec: 0.35 },
  { id: "slide-left", name: "Slide Left", description: "Next clip slides in from the right.", xfadeType: "slideleft", durationSec: 0.35 },
  { id: "slide-right", name: "Slide Right", description: "Next clip slides in from the left.", xfadeType: "slideright", durationSec: 0.35 },
  { id: "slide-down", name: "Slide Down", description: "Next clip slides down from the top.", xfadeType: "slidedown", durationSec: 0.35 },
  { id: "smooth-slide", name: "Smooth Slide", description: "A softer, eased slide — less snappy than Slide Left/Right.", xfadeType: "smoothleft", durationSec: 0.45 },
  { id: "radial-wipe", name: "Radial Wipe", description: "Sweeps around like a clock hand into the next clip.", xfadeType: "radial", durationSec: 0.4 },
  { id: "dissolve", name: "Dissolve", description: "Grainy pixel-by-pixel dissolve — a textured, filmic cut.", xfadeType: "dissolve", durationSec: 0.35 },
  { id: "squeeze", name: "Squeeze", description: "Current clip squeezes away to reveal the next — playful, snappy.", xfadeType: "squeezeh", durationSec: 0.3 },
  { id: "diagonal-wipe", name: "Diagonal Wipe", description: "Wipes in on a diagonal — modern, editorial feel.", xfadeType: "diagtl", durationSec: 0.35 },
  { id: "cover-up", name: "Cover Up", description: "Next clip slides up and over the current one.", xfadeType: "coverup", durationSec: 0.3 },
  { id: "reveal-left", name: "Reveal Left", description: "Current clip slides away to reveal the next underneath.", xfadeType: "revealleft", durationSec: 0.35 },
];
export const getTransition = (id: string): TransitionEffect => TRANSITION_EFFECTS.find(t => t.id === id) || TRANSITION_EFFECTS[0];
