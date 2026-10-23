// FEATURE — CapCut-style video editor inside the Social section: upload
// clips, trim/reorder/crop/color-grade them on a real visual timeline,
// auto-detect+strip silence, add styled captions with a live preview, and
// export a real rendered MP4 — all via ffmpeg.wasm in the browser
// (src/lib/videoEditor.ts), genuinely free with no per-render cost.
// FEATURE — "works without an API key, automatically editing and adding
// captions." Auto-Edit's caption step defaults to the "local" provider
// (src/lib/localTranscription.ts) — real speech-to-text running entirely
// on-device via transformers.js, no account/key/server call required. An
// owner who already has a paid transcription key (OpenAI/Groq/Deepgram) can
// still pick it from the same dropdown for faster/more accurate results,
// and a fully separate, opt-in "Auto-Edit with AI" button appears only when
// the owner has configured their own video-editing API key in Settings (see
// functions/api/video-autoedit.ts) — kept fully separate from the free path
// so nothing here silently starts costing money without the owner
// explicitly opting in with their own account.
//
// FEATURE — "make the editor full screen, not just a pop-up... based off
// of CapCut." Portals straight to document.body as its own fixed
// full-viewport layer (same portal technique as Modal.tsx, just without
// Modal's centered-card chrome) instead of living inside a Modal card —
// a real editor needs the whole screen, not a dialog box. Top bar (close +
// export), a real horizontal timeline strip with draggable thumbnail clips
// (CapCut's signature layout), and a preview that fills the rest.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GBtn } from "./GBtn";
import { X, Plus, Trash2, Wand2, Scissors, Type, Upload, Sparkles, RotateCw, FlipHorizontal, Captions, Crop as CropIcon, Sliders, Maximize2, Minimize2, Layers, Music as MusicIcon, ImagePlus, Volume2, VolumeX, Play, Pause, Download as DownloadIcon, ChevronUp, ChevronDown } from "lucide-react";
import { uid, uploadJobMedia, requestDesktopNotifPermission, notifyDesktop } from "../../lib/utils";
import { sendOwnerGmailOnly, emailShell, emailButton } from "../../lib/messaging";
import { sendPushNotification } from "../../lib/push";
import { startAutoEditJob, updateAutoEditJob, finishAutoEditJob, failAutoEditJob, createProgressEstimator, getAutoEditJobState, clearAutoEditJob } from "../../lib/autoEditJobStore";
import { CAPTION_STYLES, CAPTION_GOOGLE_FONTS_HREF, captionStyleToCss, getCaptionStyle, TRANSITION_EFFECTS } from "../../lib/captionStyles";
import { readVideoMeta, readImageMeta, detectSilence, renderFinalVideo, extractAudioForTranscription, cleanupFsCache, autoCutClipDeadSpace, stripFillerWordsFromClip, isFillerWord, requestTranscription, groupWordsIntoCaptionLines, fitClipsToDuration, isLocalCaptionProvider, CAPTION_PROVIDERS, ASPECT_RATIOS, ASPECT_DIMENSIONS, SOUND_EFFECTS, COLOR_LOOKS, getColorLook, AUTO_EDIT_TEMPLATES, getAutoEditTemplate, interpretStylePrompt, type AspectRatio, type CaptionProvider, type CropRect, type EditorClip, type EditorCaption, type EditorOverlay, type MusicTrack } from "../../lib/videoEditor";
import { resolveBaseFontSize, estimateMaxCharsPerLine } from "../../lib/assCaptions";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

type ToolTab = "clips" | "adjust" | "captions" | "overlays" | "music" | "auto";

// FEATURE — "allow users to add their own branding — import their logo,
// phone number, and other media into a folder inside the video's social
// section." A real persistent asset library, not a one-off-per-session
// upload — stored on settings.brandAssets (small images only, as data
// URLs) so it syncs cross-device the same way every other setting already
// does via app_settings.data, and survives closing/reopening the editor.
export type BrandAsset = { id: string; name: string; dataUrl: string; addedAt: number };
const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export function VideoEditorModal({ open, onClose, onExported, toast, settings, setSettings, ownerId, initialAutoEdit, onInitialAutoEditConsumed }: {
  open: boolean;
  onClose: () => void;
  // Hands back the finished video as a Blob + a suggested filename — the
  // caller (SocialPage.tsx) owns uploading it to Storage and wiring it
  // into the post form, same as any other media attach path there.
  // draftOnly — "save without posting" (see saveAsDraftOnly below): the
  // caller should just stash the rendered video, not open the post composer.
  onExported: (blob: Blob, draftOnly?: boolean) => void;
  toast?: (msg: string, tone?: any) => void;
  settings?: any;
  setSettings?: any;
  // Needed for the completion push notification (sendPushNotification
  // resolves the caller's own owner_id server-side, but still needs it
  // client-side to address the row it writes/reads).
  ownerId?: string;
  // FEATURE — Social page's "Auto Edit" quick-wizard button: collects
  // clips/music/style/length/description up front, THEN opens this same
  // editor pre-loaded and auto-runs the exact same Auto-Edit pipeline
  // (reused as-is, not a separate parallel one) so the result is exactly
  // as functional as manually clicking through the Auto-Edit tab — the
  // wizard is a fast on-ramp into this, not a competing implementation.
  initialAutoEdit?: {
    files: File[];
    musicFile?: File | null;
    stylePrompt?: string;
    templateId?: string | null;
    targetDurationSec?: number | null;
    emailOnDone?: boolean;
  } | null;
  onInitialAutoEditConsumed?: () => void;
}) {
  const [clips, setClips] = useState<EditorClip[]>([]);
  const [captions, setCaptions] = useState<EditorCaption[]>([]);
  // FEATURE — "CapCut-style multi-track editor with overlays... separate
  // layers." A real second visual track (images/branding, independently
  // timed and positioned) and a real audio track (music), on top of the
  // main clips track — see EditorOverlay/MusicTrack in videoEditor.ts.
  const [overlays, setOverlays] = useState<EditorOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [music, setMusic] = useState<MusicTrack | null>(null);
  const brandAssets: BrandAsset[] = (settings as any)?.brandAssets || [];
  const assetInputRef = useRef<HTMLInputElement>(null);
  const overlayAssetInputRef = useRef<HTMLInputElement>(null);
  const pipVideoInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);
  // FEATURE — "when you press play on the preview, it should play all the
  // clips... show the full video." Previously the preview only ever played
  // whichever ONE clip was selected on the timeline and stopped at its end
  // — there was no way to watch the assembled sequence. playingAll drives
  // continuous playback: each clip auto-plays from its own trim-in point,
  // stops at its trim-out point, and hands off to the next clip, closing
  // the loop at the last one. Also makes single-clip preview respect trim
  // (stops at End instead of playing past it into untrimmed footage) even
  // when playingAll is off, since a trim that doesn't affect the preview
  // reads as "trim doesn't work."
  const [playingAll, setPlayingAll] = useState(false);
  const imageAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderPhase, setRenderPhase] = useState("");
  const [renderPct, setRenderPct] = useState(0);
  const [detectingSilence, setDetectingSilence] = useState(false);
  const [silenceRanges, setSilenceRanges] = useState<{ clipId: string; start: number; end: number }[]>([]);
  const [autoEditing, setAutoEditing] = useState(false);
  const [tab, setTab] = useState<ToolTab>("clips");
  // FEATURE — "change the frame size, like 9:16, etc."
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  // FEATURE — "allow full-screen video editing within the editor, with an
  // X to return to editing." Real native Fullscreen API on the preview
  // box itself (not just this already-full-viewport component) — an
  // immersive, distraction-free preview with just the video + captions,
  // an explicit X overlay to back out of (Escape/swipe-down also exits
  // browser fullscreen natively, this is the always-visible explicit path).
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  useEffect(() => {
    const onFsChange = () => setIsFullscreenPreview(!!document.fullscreenElement && document.fullscreenElement === previewBoxRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const toggleFullscreenPreview = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await previewBoxRef.current?.requestFullscreen();
    } catch (e: any) {
      toast?.("Fullscreen isn't supported here — " + (e?.message || "try a different browser"), "yellow");
    }
  };
  // FEATURE — "can it automatically create captions?" / "use any API, not
  // just OpenAI's." Defaults to whichever provider the owner already has a
  // key for (OpenAI, then Groq, then Deepgram), but is fully switchable.
  const [transcribing, setTranscribing] = useState(false);
  // FEATURE — "works without an API key." CAPTION_PROVIDERS lists "local"
  // (on-device, always available) first, so both this initial state and the
  // effect below default to it — captions work with zero setup. An owner
  // who already has a paid transcription key configured still gets that one
  // pre-selected instead (see the effect), since it's genuinely faster.
  const [captionProvider, setCaptionProvider] = useState<CaptionProvider>("local");
  useEffect(() => {
    if (!open) return;
    const withKey = CAPTION_PROVIDERS.find(p => !!p.keyFrom(settings) && !isLocalCaptionProvider(p.id));
    if (withKey) setCaptionProvider(withKey.id);
  }, [open]);
  const getCaptionApiKey = (provider: CaptionProvider): string | undefined => CAPTION_PROVIDERS.find(p => p.id === provider)?.keyFrom(settings);
  // FEATURE — Social page's "Auto Edit" quick-wizard button hands this
  // modal a pending payload (clips/music/style/length/description) instead
  // of the owner clicking through Add Clips -> Auto-Edit tab -> fill in
  // the same fields by hand. Loads it in, THEN triggers the real run below
  // once React has actually committed the settings it just set (a second
  // effect, gated on pendingWizardClips — see its own comment for why this
  // needs two effects instead of one).
  const [pendingWizardClips, setPendingWizardClips] = useState<EditorClip[] | null>(null);
  // FEATURE — "there should be a section for already-edited videos, they
  // shouldn't disappear... should appear in the drafts section." A
  // wizard-driven run is fire-and-forget by design (the owner may not be
  // watching, may have navigated away) — so unlike the manual editor's
  // own "Run Auto-Edit" button (which correctly stops at a reviewable,
  // still-editable state), a wizard run automatically renders the final
  // video and saves it as a real draft when it finishes. Set true only
  // here (wizard path) and explicitly false in startAutoEditFlow (the
  // manual button's own click handler) so the two entry points can share
  // the rest of this pipeline without one silently taking on the other's
  // behavior.
  const autoRenderOnCompleteRef = useRef(false);
  useEffect(() => {
    if (!open || !initialAutoEdit) return;
    autoRenderOnCompleteRef.current = true;
    (async () => {
      const newClips: EditorClip[] = [];
      for (const file of initialAutoEdit.files) {
        if (!file.type.startsWith("video/")) { toast?.(`${file.name} isn't a video — skipped`, "yellow"); continue; }
        const meta = await readVideoMeta(file);
        newClips.push({ id: uid(), file, startSec: 0, endSec: meta.duration, durationSec: meta.duration, width: meta.width, height: meta.height });
      }
      if (newClips.length === 0) {
        toast?.("No valid video clips to auto-edit", "red");
        onInitialAutoEditConsumed?.();
        return;
      }
      setClips(prev => [...prev, ...newClips]);
      setActiveClipId(newClips[0].id);
      if (initialAutoEdit.musicFile) await addMusic(initialAutoEdit.musicFile);
      if (initialAutoEdit.templateId) applyTemplate(initialAutoEdit.templateId);
      if (initialAutoEdit.stylePrompt) setAutoEditPrompt(initialAutoEdit.stylePrompt);
      setAutoEditTargetDurationSec(initialAutoEdit.targetDurationSec ?? null);
      setAutoEditEmailOnDone(!!initialAutoEdit.emailOnDone);
      onInitialAutoEditConsumed?.();
      // Signals effect below to actually run, once this batch of state
      // updates has committed — NOT called inline here, since
      // resolveEffectiveAutoEditSettings() would otherwise read the STALE
      // (pre-update) autoEditPrompt/autoEditTargetDurationSec from this
      // same closure rather than what was just set above.
      setPendingWizardClips(newClips);
    })();
  }, [open, initialAutoEdit]);
  useEffect(() => {
    if (!pendingWizardClips) return;
    const clipsToRun = pendingWizardClips;
    setPendingWizardClips(null);
    // Same "confirm clip order" step manually running Auto-Edit gets for
    // more than one clip — the wizard collected the clips but didn't ask
    // the order, so still worth a quick review before it actually runs.
    if (clipsToRun.length > 1) { setOrderDraft(clipsToRun); setOrderConfirmOpen(true); }
    else runAutoEdit(clipsToRun);
  }, [pendingWizardClips]);
  // FEATURE — "show the auto editing status... while you're doing other
  // stuff." If an Auto-Edit run finished while this modal (or the whole
  // Social page) wasn't mounted to receive it, the result is sitting in
  // the shared job store (autoEditJobStore.ts) instead of being lost —
  // pick it up the next time this modal opens onto an otherwise-empty
  // session, rather than the owner having to redo the whole run.
  useEffect(() => {
    if (!open || initialAutoEdit) return;
    const job = getAutoEditJobState();
    if (job.result && clips.length === 0) {
      setClips(job.result.clips);
      setCaptions(job.result.captions);
      setAspectRatio(job.result.aspectRatio);
      setActiveClipId(job.result.clips[0]?.id || null);
      setTab("clips");
      toast?.("Loaded your finished Auto-Edit — " + job.result.summary, "green");
      clearAutoEditJob();
    }
  }, [open]);
  // FEATURE — "make it so you can auto edit... choose caption templates,
  // review it, can manually edit it, save, etc." Style applied to every
  // caption the Auto-Edit pipeline generates — picked once up front.
  // Defaults to the word-pop style built for the fast, grouped auto-caption
  // rhythm (see groupWordsIntoCaptionLines) instead of a generic first-in-
  // list preset — still fully changeable from the dropdown below.
  const [autoEditCaptionStyle, setAutoEditCaptionStyle] = useState("hook-punch");
  // FEATURE — "auto editing... adding transitions, effects, camera
  // flickers." Auto-Edit doesn't just cut/caption anymore — it also
  // assigns real transitions between the resulting clips, grades them with
  // a color look, and (optionally) adds flash-cut camera flicker at hard
  // cuts, all in the same one-click pass. Each is independently toggleable
  // so a re-run can keep/drop any of them; cameraFlickerEnabled also
  // applies to a plain manual Export/Download, not just Auto-Edit.
  const [autoEditAddTransitions, setAutoEditAddTransitions] = useState(true);
  const [autoEditColorLook, setAutoEditColorLook] = useState("cinematic-teal-orange");
  const [cameraFlickerEnabled, setCameraFlickerEnabled] = useState(true);
  // FEATURE — "add templates." One-click named recipes (AUTO_EDIT_TEMPLATES)
  // that set caption style + color look + transition set + flicker together.
  const [autoEditTemplateId, setAutoEditTemplateId] = useState<string | null>(null);
  const [autoEditTransitionCycle, setAutoEditTransitionCycle] = useState<string[] | null>(null);
  // FEATURE — "describe in text what I want... without an API key you can
  // discern and edit the video." Keyword-matched against
  // interpretStylePrompt (videoEditor.ts) — real, zero-cost, zero-API-key;
  // see that function's own comment for exactly what it does and doesn't do.
  const [autoEditPrompt, setAutoEditPrompt] = useState("");
  const [autoEditPromptMatches, setAutoEditPromptMatches] = useState<string[]>([]);
  // FEATURE — "add more options for everything... describe muffled sound
  // effects." Manual override for the same audioEffect interpretStylePrompt
  // can now also pick up from free text (see videoEditor.ts) — either way
  // applies to every clip Auto-Edit produces, same pattern as color look.
  const [autoEditAudioEffect, setAutoEditAudioEffect] = useState("none");
  // FEATURE — Social page's Auto-Edit wizard asks "how long" up front.
  // null = no target (today's behavior, unchanged). See
  // fitClipsToDuration in videoEditor.ts for what actually happens with it.
  const [autoEditTargetDurationSec, setAutoEditTargetDurationSec] = useState<number | null>(null);
  // FEATURE — "send an email when it's done, depending on how long it
  // is." Explicit owner opt-in (checkbox in the wizard and the manual
  // panel) OR'd with an automatic threshold at completion time (see
  // runAutoEdit) for a run that ends up taking a while regardless of
  // whether this was checked — "depending on how long it is" taken
  // literally rather than purely a manual toggle.
  const [autoEditEmailOnDone, setAutoEditEmailOnDone] = useState(false);
  // FEATURE — "ping the owner and ask what order you want the clips in."
  // A real confirm-before-running step: Run Auto-Edit opens this instead of
  // firing immediately whenever there's more than one clip.
  const [orderConfirmOpen, setOrderConfirmOpen] = useState(false);
  const [orderDraft, setOrderDraft] = useState<EditorClip[]>([]);
  const [autoEditRunning, setAutoEditRunning] = useState(false);
  const [autoEditPhase, setAutoEditPhase] = useState("");
  // FEATURE — "move the text around." Which caption (if any) is currently
  // being repositioned by tapping/clicking the preview.
  const [positioningCaptionId, setPositioningCaptionId] = useState<string | null>(null);
  // FEATURE — "make it so you can edit videos, but save them and not post
  // them." Whether the export button should hand the result to the post
  // composer (default) or just save it aside as a draft.
  const [saveAsDraftOnly, setSaveAsDraftOnly] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const activeClip = clips.find(c => c.id === activeClipId) || clips[0] || null;
  const hasApiKey = !!(settings?.videoAutoEditApiKey);
  // BUG FIX — "auto captions does nothing, added captions don't appear."
  // Captions are stored in GLOBAL assembled-timeline seconds (offset by
  // every earlier clip's own duration — the only coordinate system that's
  // correct for the real export, see renderFinalVideo/runAutoCaptions),
  // but the preview compared them against `previewTime`, which is just
  // the ACTIVE <video> element's own local currentTime (0..that one
  // clip's duration). For any clip after the first, a caption's global
  // startSec/endSec could never fall inside that local range, so it
  // existed in state (the "Added N captions" toast was truthful) but
  // could never actually satisfy the preview's active-caption check. One
  // shared offset, used everywhere previewTime needs to be compared
  // against caption timing.
  const activeClipIndex = clips.findIndex(c => c.id === activeClip?.id);
  const activeClipGlobalOffset = activeClipIndex >= 0
    ? clips.slice(0, activeClipIndex).reduce((s, c) => s + Math.max(0, c.endSec - c.startSec), 0)
    : 0;
  const globalPreviewTime = activeClipGlobalOffset + Math.max(0, previewTime - (activeClip?.startSec || 0));

  // Lock body scroll while the full-screen editor is open — same pattern
  // as Modal.tsx.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // BUG FIX — "when I try to slice or trim a clip it doesn't let me play
  // it, it's rough." URL.createObjectURL(activeClip.file) was called
  // INLINE in the video's src prop — every re-render (typing in a trim
  // number field, editing a caption, anything) created a BRAND NEW blob
  // URL, and React swapping the <video>'s src to a new (even though
  // functionally identical) URL forces the browser to reload the video
  // from scratch, killing playback position/state every time. One stable
  // URL per clip, created once and reused across re-renders, and revoked
  // when that clip is actually removed (not on every render) — fixes both
  // the playback reset and a real blob-URL memory leak.
  const clipUrlCacheRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    const cache = clipUrlCacheRef.current;
    const liveIds = new Set(clips.map(c => c.id));
    for (const [id, url] of cache) {
      if (!liveIds.has(id)) { URL.revokeObjectURL(url); cache.delete(id); }
    }
    for (const c of clips) {
      if (!cache.has(c.id)) cache.set(c.id, URL.createObjectURL(c.file));
    }
  }, [clips]);
  useEffect(() => () => { clipUrlCacheRef.current.forEach(url => URL.revokeObjectURL(url)); }, []);
  const activeClipUrl = activeClip ? clipUrlCacheRef.current.get(activeClip.id) : undefined;

  // FEATURE — "show a timeline, the different clips like CapCut shows."
  // One small poster-frame thumbnail per clip, generated once (cached by
  // clip id) via a hidden <video> + <canvas> grab — cheap, no ffmpeg
  // needed for this, just enough for the timeline strip to read as a real
  // filmstrip instead of blank tiles.
  const [clipThumbs, setClipThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    clips.forEach(c => {
      if (clipThumbs[c.id]) return;
      const url = clipUrlCacheRef.current.get(c.id);
      if (!url) return;
      const v = document.createElement("video");
      v.muted = true; v.playsInline = true; v.preload = "metadata"; v.src = url;
      v.addEventListener("loadedmetadata", () => { try { v.currentTime = Math.min(0.3, (v.duration || 1) / 2); } catch { /* ignore */ } }, { once: true });
      v.addEventListener("seeked", () => {
        try {
          const AR = 9 / 16;
          const canvas = document.createElement("canvas");
          canvas.width = 90; canvas.height = Math.round(90 / AR);
          const ctx = canvas.getContext("2d");
          if (ctx && v.videoWidth) {
            const srcRatio = v.videoWidth / v.videoHeight;
            let sw = v.videoWidth, sh = v.videoHeight, sx = 0, sy = 0;
            if (srcRatio > AR) { sw = v.videoHeight * AR; sx = (v.videoWidth - sw) / 2; }
            else { sh = v.videoWidth / AR; sy = (v.videoHeight - sh) / 2; }
            ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
            setClipThumbs(prev => ({ ...prev, [c.id]: canvas.toDataURL("image/jpeg", 0.6) }));
          }
        } catch { /* not fatal — timeline block just stays blank */ }
      }, { once: true });
    });
  }, [clips]);

  useEffect(() => {
    if (!activeClipId && clips.length > 0) setActiveClipId(clips[0].id);
  }, [clips, activeClipId]);

  // Called when the active clip reaches its trim-out point (video) or its
  // on-screen duration elapses (photo). During playingAll, moves to the
  // next clip (starting IT from its own trim-in point below); at the last
  // clip, or when not in playingAll at all, just stops.
  const advancePastClipEnd = () => {
    if (!playingAll) { videoRef.current?.pause(); return; }
    const idx = clips.findIndex(c => c.id === activeClipId);
    const next = clips[idx + 1];
    if (next) setActiveClipId(next.id);
    else setPlayingAll(false);
  };
  // Photo clips have no native play/timeupdate events — a plain timer
  // stands in for "play until trim-out, then advance," matching the video
  // path's behavior via advancePastClipEnd.
  useEffect(() => {
    if (imageAdvanceTimerRef.current) { clearTimeout(imageAdvanceTimerRef.current); imageAdvanceTimerRef.current = null; }
    if (!playingAll || !activeClip?.isImage) return;
    setPreviewTime(activeClip.startSec);
    const durationMs = Math.max(0, activeClip.endSec - activeClip.startSec) * 1000;
    imageAdvanceTimerRef.current = setTimeout(advancePastClipEnd, durationMs);
    return () => { if (imageAdvanceTimerRef.current) clearTimeout(imageAdvanceTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingAll, activeClipId]);

  // Reset state whenever the editor is freshly opened, not left over from a
  // previous editing session (the component instance is reused, not remounted).
  useEffect(() => {
    if (open) { setClips([]); setCaptions([]); setOverlays([]); setMusic(null); setSelectedOverlayId(null); setActiveClipId(null); setSilenceRanges([]); setRendering(false); setClipThumbs({}); setTab("clips"); setCropEditingId(null); setPlayingAll(false); }
  }, [open]);

  const addFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newClips: EditorClip[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("video/")) { toast?.(`${file.name} isn't a video — skipped`, "yellow"); continue; }
      const meta = await readVideoMeta(file);
      newClips.push({ id: uid(), file, startSec: 0, endSec: meta.duration, durationSec: meta.duration, width: meta.width, height: meta.height });
    }
    if (newClips.length > 0) {
      setClips(prev => [...prev, ...newClips]);
      toast?.(`Added ${newClips.length} clip${newClips.length > 1 ? "s" : ""} ✓`);
    }
  };

  // FEATURE — "more video and photo editing options." A still photo added
  // straight to the main timeline as its own clip (fixed on-screen
  // duration, adjustable afterward) — goes through the exact same crop/
  // rotate/color/reframe controls every video clip already has, see
  // EditorClip.isImage in videoEditor.ts.
  const PHOTO_CLIP_DEFAULT_SEC = 3;
  const addPhotoClips = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newClips: EditorClip[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) { toast?.(`${file.name} isn't a photo — skipped`, "yellow"); continue; }
      const meta = await readImageMeta(file);
      // durationSec is set well above the actual default on-screen time —
      // for a video clip it's the real probed media length (a hard trim
      // ceiling), but a photo has no such ceiling at all; this just gives
      // the existing Start/End trim sliders (which cap at durationSec)
      // enough room to actually stretch a photo's on-screen time out
      // longer than the 3s default, not just shorter.
      const PHOTO_CLIP_MAX_SEC = 30;
      newClips.push({ id: uid(), file, startSec: 0, endSec: PHOTO_CLIP_DEFAULT_SEC, durationSec: PHOTO_CLIP_MAX_SEC, width: meta.width, height: meta.height, isImage: true });
    }
    if (newClips.length > 0) {
      setClips(prev => [...prev, ...newClips]);
      toast?.(`Added ${newClips.length} photo clip${newClips.length > 1 ? "s" : ""} ✓ — adjust how long each shows on the Clips tab`);
    }
  };

  const removeClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
    setSilenceRanges(prev => prev.filter(r => r.clipId !== id));
    if (cropEditingId === id) setCropEditingId(null);
  };

  const updateClip = (id: string, patch: Partial<EditorClip>) => setClips(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));

  // FEATURE — "split a clip at the playhead," a core CapCut editing move
  // that was entirely missing — trimming Start/End only shortens from the
  // ends, with no way to cut a clip into two independently-trimmable
  // pieces (e.g. to insert a transition or a caption gap partway through).
  // Pure metadata split (two EditorClips sharing the same source file,
  // startSec/endSec adjusted) — no render-pipeline change needed since
  // renderFinalVideo already trims each clip independently by those fields.
  const splitClipAtPlayhead = () => {
    if (!activeClip) return;
    const splitAt = previewTime;
    if (splitAt <= activeClip.startSec + 0.15 || splitAt >= activeClip.endSec - 0.15) {
      toast?.("Move the playhead further into the clip to split it there", "yellow");
      return;
    }
    const firstId = uid(), secondId = uid();
    const first: EditorClip = { ...activeClip, id: firstId, endSec: splitAt, transitionToNext: "none" };
    const second: EditorClip = { ...activeClip, id: secondId, startSec: splitAt };
    setClips(prev => {
      const idx = prev.findIndex(c => c.id === activeClip.id);
      if (idx === -1) return prev;
      const next = [...prev];
      next.splice(idx, 1, first, second);
      return next;
    });
    // Captions/overlays are already in GLOBAL timeline seconds, unaffected
    // by a split (total assembled duration doesn't change).
    setActiveClipId(secondId);
    toast?.("Clip split ✓ — now two clips, each trimmable on its own", "green");
  };

  // FEATURE — "give me a full visual editor where you can move stuff, drag
  // and drop." Reordering clips is now a real drag on the timeline strip
  // itself (pointer events — works with touch AND mouse identically)
  // instead of only up/down arrow buttons.
  const [draggingClipId, setDraggingClipId] = useState<string | null>(null);
  const handleTimelinePointerDown = (e: React.PointerEvent, id: string) => {
    if (cropEditingId || positioningCaptionId) return;
    setDraggingClipId(id);
  };
  useEffect(() => {
    if (!draggingClipId) return;
    const onMove = (e: PointerEvent) => {
      const container = timelineRef.current;
      if (!container) return;
      const blocks = Array.from(container.querySelectorAll<HTMLElement>("[data-clip-id]"));
      let targetIndex = blocks.length - 1;
      for (let i = 0; i < blocks.length; i++) {
        const rect = blocks[i].getBoundingClientRect();
        if (e.clientX < rect.left + rect.width / 2) { targetIndex = i; break; }
      }
      setClips(prev => {
        const curIndex = prev.findIndex(c => c.id === draggingClipId);
        if (curIndex === -1 || curIndex === targetIndex) return prev;
        const next = [...prev];
        const [moved] = next.splice(curIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    };
    const onUp = () => setDraggingClipId(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [draggingClipId]);

  // FEATURE — "you should be able to crop stuff, resize it." A draggable
  // crop rectangle drawn over the preview, mapped from the video's real
  // rendered ("object-fit: contain") box back to fractions of the source's
  // own pixel dimensions — see CropRect in videoEditor.ts and the crop
  // pixel math in renderFinalVideo.
  const [cropEditingId, setCropEditingId] = useState<string | null>(null);
  const [containRect, setContainRect] = useState({ renderW: 0, renderH: 0, offsetX: 0, offsetY: 0 });
  // Measured whenever the preview box exists — used by BOTH the crop tool
  // and the caption drag/resize handles below (captions need it to convert
  // a pointer drag delta into the same xPct/yPct fraction space the crop
  // tool already uses), not just while cropEditingId is set.
  useEffect(() => {
    if (!activeClip || !previewBoxRef.current) return;
    const measure = () => {
      const box = previewBoxRef.current;
      if (!box) return;
      const containerW = box.clientWidth, containerH = box.clientHeight;
      const srcW = activeClip.width || containerW, srcH = activeClip.height || containerH;
      const containerRatio = containerW / containerH;
      const srcRatio = srcW / srcH;
      let renderW: number, renderH: number;
      if (srcRatio > containerRatio) { renderW = containerW; renderH = containerW / srcRatio; }
      else { renderH = containerH; renderW = containerH * srcRatio; }
      setContainRect({ renderW, renderH, offsetX: (containerW - renderW) / 2, offsetY: (containerH - renderH) / 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [cropEditingId, activeClip?.id, activeClip?.width, activeClip?.height, aspectRatio]);
  const cropDragRef = useRef<{ mode: "move" | "tl" | "tr" | "bl" | "br"; startX: number; startY: number; startCrop: CropRect } | null>(null);
  const [cropDragging, setCropDragging] = useState(false);
  const startCropDrag = (e: React.PointerEvent, mode: "move" | "tl" | "tr" | "bl" | "br") => {
    e.preventDefault();
    if (!activeClip) return;
    cropDragRef.current = { mode, startX: e.clientX, startY: e.clientY, startCrop: activeClip.crop || { x: 0, y: 0, w: 1, h: 1 } };
    setCropDragging(true);
  };
  useEffect(() => {
    if (!cropDragging) return;
    const onMove = (e: PointerEvent) => {
      const st = cropDragRef.current;
      if (!st || !activeClip || containRect.renderW === 0) return;
      const dxFrac = (e.clientX - st.startX) / containRect.renderW;
      const dyFrac = (e.clientY - st.startY) / containRect.renderH;
      const MIN = 0.15;
      let { x, y, w, h } = st.startCrop;
      if (st.mode === "move") {
        x = clamp(st.startCrop.x + dxFrac, 0, 1 - w);
        y = clamp(st.startCrop.y + dyFrac, 0, 1 - h);
      } else {
        if (st.mode.includes("l")) { const nx = clamp(st.startCrop.x + dxFrac, 0, st.startCrop.x + st.startCrop.w - MIN); w = st.startCrop.w - (nx - st.startCrop.x); x = nx; }
        if (st.mode.includes("r")) { w = clamp(st.startCrop.w + dxFrac, MIN, 1 - st.startCrop.x); }
        if (st.mode.includes("t")) { const ny = clamp(st.startCrop.y + dyFrac, 0, st.startCrop.y + st.startCrop.h - MIN); h = st.startCrop.h - (ny - st.startCrop.y); y = ny; }
        if (st.mode.includes("b")) { h = clamp(st.startCrop.h + dyFrac, MIN, 1 - st.startCrop.y); }
      }
      updateClip(activeClip.id, { crop: { x, y, w, h } });
    };
    const onUp = () => { setCropDragging(false); cropDragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [cropDragging, activeClip?.id, containRect]);

  // FEATURE — "I can't click the video preview or a caption to resize,
  // adjust, or move it like in CapCut." Tapping a caption directly on the
  // canvas selects it (selectedCaptionId) instead of needing the separate
  // "Position" button first; once selected it can be dragged to move
  // (same fraction-of-rendered-box math as the crop tool) and a corner
  // handle drags to resize its font size (fontScale). Selecting also makes
  // the template gallery below apply to THIS caption on tap.
  const [selectedCaptionId, setSelectedCaptionId] = useState<string | null>(null);
  const captionDragRef = useRef<{ mode: "move" | "resize"; startX: number; startY: number; startXPct: number; startYPct: number; startScale: number } | null>(null);
  const [captionDragging, setCaptionDragging] = useState(false);
  // FEATURE — "captions should automatically snap to the center line,
  // similar to CapCut's snapping guides." Shows a real guide line the
  // instant a dragged caption's center crosses within SNAP_THRESHOLD of
  // the canvas's horizontal/vertical midline, and locks the value to
  // exactly 0.5 while within range — released the moment the drag moves
  // back out, so it's a magnet, not a permanent lock.
  const SNAP_THRESHOLD = 0.025;
  const [captionSnap, setCaptionSnap] = useState<{ x: boolean; y: boolean }>({ x: false, y: false });
  const startCaptionDrag = (e: React.PointerEvent, cap: EditorCaption, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedCaptionId(cap.id);
    captionDragRef.current = {
      mode, startX: e.clientX, startY: e.clientY,
      startXPct: cap.xPct !== undefined ? cap.xPct : 0.5,
      startYPct: cap.yPct !== undefined ? cap.yPct : 0.82,
      startScale: cap.fontScale || 1,
    };
    setCaptionDragging(true);
  };
  useEffect(() => {
    if (!captionDragging) return;
    const onMove = (e: PointerEvent) => {
      const st = captionDragRef.current;
      if (!st || !selectedCaptionId || containRect.renderW === 0) return;
      if (st.mode === "move") {
        const dxFrac = (e.clientX - st.startX) / containRect.renderW;
        const dyFrac = (e.clientY - st.startY) / containRect.renderH;
        let nextX = clamp(st.startXPct + dxFrac, 0, 1);
        let nextY = clamp(st.startYPct + dyFrac, 0, 1);
        const snapX = Math.abs(nextX - 0.5) < SNAP_THRESHOLD;
        const snapY = Math.abs(nextY - 0.5) < SNAP_THRESHOLD;
        if (snapX) nextX = 0.5;
        if (snapY) nextY = 0.5;
        setCaptionSnap({ x: snapX, y: snapY });
        updateCaption(selectedCaptionId, { xPct: nextX, yPct: nextY });
      } else {
        // Resize — drag distance from the caption's own position scales
        // font size; scaling by renderW keeps the feel consistent across
        // different preview sizes/aspect ratios.
        const dxFrac = (e.clientX - st.startX) / containRect.renderW;
        const nextScale = clamp(st.startScale + dxFrac * 2.5, 0.4, 3);
        updateCaption(selectedCaptionId, { fontScale: nextScale });
      }
    };
    const onUp = () => { setCaptionDragging(false); captionDragRef.current = null; setCaptionSnap({ x: false, y: false }); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [captionDragging, selectedCaptionId, containRect]);

  // ── Brand asset library ("a folder inside the video's social section") ──
  const MAX_ASSET_DIM = 500; // downscaled on upload — these are logos/small graphics, not photos; keeps settings.brandAssets light
  const addBrandAsset = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast?.(`${file.name} isn't an image`, "yellow"); return; }
    setUploadingAsset(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const scale = Math.min(1, MAX_ASSET_DIM / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas not supported")); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to read image")); };
        img.src = url;
      });
      const asset: BrandAsset = { id: uid(), name: file.name.replace(/\.[^.]+$/, ""), dataUrl, addedAt: Date.now() };
      setSettings?.((prev: any) => ({ ...prev, brandAssets: [...((prev as any)?.brandAssets || []), asset] }));
      toast?.(`"${asset.name}" added to your brand assets ✓`, "green");
    } catch (e: any) {
      toast?.("Couldn't add that image — " + (e?.message || "unknown error"), "red");
    } finally {
      setUploadingAsset(false);
    }
  };
  const deleteBrandAsset = (id: string) => {
    setSettings?.((prev: any) => ({ ...prev, brandAssets: ((prev as any)?.brandAssets || []).filter((a: BrandAsset) => a.id !== id) }));
  };

  // ── Overlays (image layer — logo/branding/anything, own time + position) ──
  const addOverlay = (src: string, name: string) => {
    if (!activeClip) { toast?.("Add a clip first", "red"); return; }
    const start = Math.max(0, globalPreviewTime);
    const ov: EditorOverlay = { id: uid(), name, src, startSec: start, endSec: start + 4, xPct: 0.5, yPct: 0.5, widthPct: 0.28, opacity: 1 };
    setOverlays(prev => [...prev, ov]);
    setSelectedOverlayId(ov.id);
    setTab("overlays");
    toast?.(`"${name}" added — drag it on the preview to position it`, "green");
  };
  const addOverlayFromUpload = async (file: File) => {
    if (file.type.startsWith("video/")) { addPipVideo(file); return; }
    if (!file.type.startsWith("image/")) { toast?.(`${file.name} isn't an image or video`, "yellow"); return; }
    const dataUrl = await readFileAsDataUrl(file);
    addOverlay(dataUrl, file.name.replace(/\.[^.]+$/, ""));
  };
  // FEATURE — "picture-in-picture video." Same overlay object as an image,
  // just kind:"video" with a real `file` for ffmpeg to read from on export
  // (see renderFinalVideo) — the object URL in `src` is preview-only, never
  // persisted (no base64 round-trip through settings for a video file).
  // Defaults to a fixed 6s window and muted (see EditorOverlay's comment).
  const addPipVideo = (file: File) => {
    if (!activeClip) { toast?.("Add a clip first", "red"); return; }
    const start = Math.max(0, globalPreviewTime);
    const ov: EditorOverlay = { id: uid(), name: file.name.replace(/\.[^.]+$/, ""), kind: "video", file, muted: true, src: URL.createObjectURL(file), startSec: start, endSec: start + 6, xPct: 0.72, yPct: 0.72, widthPct: 0.34, opacity: 1 };
    setOverlays(prev => [...prev, ov]);
    setSelectedOverlayId(ov.id);
    setTab("overlays");
    toast?.(`"${ov.name}" added as picture-in-picture — drag it on the preview to position it`, "green");
  };
  const updateOverlay = (id: string, patch: Partial<EditorOverlay>) => setOverlays(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  const removeOverlay = (id: string) => { setOverlays(prev => prev.filter(o => o.id !== id)); if (selectedOverlayId === id) setSelectedOverlayId(null); };
  const activeOverlays = overlays.filter(o => o.startSec <= globalPreviewTime && globalPreviewTime <= o.endSec);

  // Drag-to-move / drag-corner-to-resize on the canvas — same fraction-of-
  // rendered-box math as the caption/crop drag tools above, generalized to
  // an image overlay's position (xPct/yPct) and width (widthPct).
  const overlayDragRef = useRef<{ mode: "move" | "resize"; startX: number; startY: number; startXPct: number; startYPct: number; startWidthPct: number } | null>(null);
  const [overlayDragging, setOverlayDragging] = useState(false);
  const startOverlayDrag = (e: React.PointerEvent, ov: EditorOverlay, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedOverlayId(ov.id);
    overlayDragRef.current = { mode, startX: e.clientX, startY: e.clientY, startXPct: ov.xPct, startYPct: ov.yPct, startWidthPct: ov.widthPct };
    setOverlayDragging(true);
  };
  useEffect(() => {
    if (!overlayDragging) return;
    const onMove = (e: PointerEvent) => {
      const st = overlayDragRef.current;
      if (!st || !selectedOverlayId || containRect.renderW === 0) return;
      const dxFrac = (e.clientX - st.startX) / containRect.renderW;
      const dyFrac = (e.clientY - st.startY) / containRect.renderH;
      if (st.mode === "move") {
        updateOverlay(selectedOverlayId, { xPct: clamp(st.startXPct + dxFrac, 0, 1), yPct: clamp(st.startYPct + dyFrac, 0, 1) });
      } else {
        updateOverlay(selectedOverlayId, { widthPct: clamp(st.startWidthPct + dxFrac, 0.06, 0.9) });
      }
    };
    const onUp = () => { setOverlayDragging(false); overlayDragRef.current = null; };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [overlayDragging, selectedOverlayId, containRect]);

  // ── Music track ──────────────────────────────────────────────────────────
  const addMusic = async (file: File) => {
    if (!file.type.startsWith("audio/")) { toast?.(`${file.name} isn't an audio file`, "yellow"); return; }
    const duration: number = await new Promise(resolve => {
      const a = new Audio();
      const url = URL.createObjectURL(file);
      a.preload = "metadata";
      a.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(a.duration) ? a.duration : 0); };
      a.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
      a.src = url;
    });
    setMusic({ id: uid(), file, name: file.name, durationSec: duration, startSec: 0, trimStart: 0, trimEnd: duration, volume: 0.6 });
    setTab("music");
    toast?.(`"${file.name}" added to the music track ✓`, "green");
  };
  const totalTimelineSec = clips.reduce((s, c) => s + Math.max(0, c.endSec - c.startSec), 0);

  const runAutoCut = async () => {
    if (!activeClip) { toast?.("Add a clip first", "red"); return; }
    setDetectingSilence(true);
    try {
      // PERF FIX (audit finding) — scope to the clip's current trim
      // window instead of always decoding the whole uploaded file.
      const ranges = await detectSilence(activeClip.file, undefined, undefined, activeClip.isImage ? undefined : { startSec: activeClip.startSec, endSec: activeClip.endSec });
      if (ranges.length === 0) { toast?.("No significant silence found in this clip", "yellow"); return; }
      setSilenceRanges(prev => [...prev.filter(r => r.clipId !== activeClip.id), ...ranges.map(r => ({ clipId: activeClip.id, ...r }))]);
      toast?.(`Found ${ranges.length} quiet stretch${ranges.length > 1 ? "es" : ""} — review below and trim if you want`, "green");
    } catch (e: any) {
      toast?.("Auto-cut failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setDetectingSilence(false);
    }
  };

  const addCaption = () => {
    if (!activeClip) { toast?.("Add a clip first", "red"); return; }
    // Stored in GLOBAL timeline seconds (see activeClipGlobalOffset's
    // comment above) — previewTime alone would put this caption at the
    // wrong spot on any clip after the first.
    const start = Math.max(0, globalPreviewTime);
    setCaptions(prev => [...prev, { id: uid(), text: "New caption", startSec: start, endSec: start + 2.5, styleId: CAPTION_STYLES[0].id }]);
  };

  // FEATURE — "can it automatically create captions?" Transcribes the
  // active clip's trimmed audio (via whichever provider is picked — see
  // CAPTION_PROVIDERS) and turns each returned segment into a real,
  // editable caption with real timing — offset by however much timeline
  // the clips BEFORE this one already take up, so the timing lines up with
  // the assembled final video, not just this one clip in isolation.
  const runAutoCaptions = async () => {
    if (!activeClip) { toast?.("Add a clip first", "red"); return; }
    const apiKey = getCaptionApiKey(captionProvider);
    if (!apiKey) { toast?.(`Add a ${CAPTION_PROVIDERS.find(p => p.id === captionProvider)?.label} key to use auto-captions (or just type captions manually below — free, no key needed)`, "yellow"); return; }
    setTranscribing(true);
    setAutoEditPhase("Transcribing…");
    try {
      const audioBlob = await extractAudioForTranscription(activeClip);
      const rawSegments = await requestTranscription(audioBlob, captionProvider, apiKey, msg => setAutoEditPhase(msg));
      if (rawSegments.length === 0) { toast?.("No speech detected in this clip", "yellow"); return; }
      // FEATURE — "really good-looking, timed auto captions." The local
      // provider returns word-level timestamps — regroup into short,
      // fast-paced lines instead of one caption per single word. Paid
      // providers already return sentence/phrase-level segments, used as-is.
      const clipIndex = clips.findIndex(c => c.id === activeClip.id);
      const offsetSec = clips.slice(0, clipIndex).reduce((s, c) => s + Math.max(0, c.endSec - c.startSec), 0);
      // FEATURE — "really good-looking, timed auto captions." The local
      // provider returns word-level timestamps — regroup into short,
      // fast-paced lines AND keep each group's real per-word timing (see
      // assCaptions.ts) for a genuine karaoke word-highlight burn, instead
      // of one caption per single word. Paid providers already return
      // sentence/phrase-level segments with no word boundaries — used as-is.
      // BUG FIX (audit finding — "captions didn't even fit the screen").
      // Line length must be sized to the actual export resolution, not a
      // flat aspect-ratio-blind constant — see estimateMaxCharsPerLine's
      // own comment in assCaptions.ts for the full root cause.
      const { w: capTargetW, h: capTargetH } = ASPECT_DIMENSIONS[aspectRatio];
      const newCaptions: EditorCaption[] = isLocalCaptionProvider(captionProvider)
        ? groupWordsIntoCaptionLines(rawSegments, { maxChars: estimateMaxCharsPerLine(capTargetW, capTargetH) }).map(g => ({
            id: uid(), text: g.text, startSec: offsetSec + g.start, endSec: offsetSec + g.end, styleId: autoEditCaptionStyle,
            words: g.words.map(w => ({ text: w.text, start: offsetSec + w.start, end: offsetSec + w.end })),
          }))
        : rawSegments.map(seg => ({
            id: uid(), text: seg.text, startSec: offsetSec + seg.start, endSec: offsetSec + seg.end, styleId: autoEditCaptionStyle,
          }));
      setCaptions(prev => [...prev, ...newCaptions]);
      toast?.(`Added ${newCaptions.length} caption${newCaptions.length > 1 ? "s" : ""} from the transcript ✓ — edit any that need fixing`, "green");
    } catch (e: any) {
      toast?.("Auto-captions failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setTranscribing(false);
      setAutoEditPhase("");
    }
  };

  // FEATURE — "make it so you can auto edit, it auto cuts the dead spaces,
  // pieces the clips together, adds captions, you choose captions
  // templates, review it, can manually edit it, save, etc." One button
  // that: (1) splits every clip at its internal silences, replacing the
  // clip list with just the "keep" pieces — the existing render pipeline
  // already concatenates clips in array order, so that alone is "piecing
  // them together"; (2) transcribes every resulting piece and adds
  // captions in the style picked below; then leaves the owner right back
  // in this same editor with everything populated — "review it, manually
  // edit it, save" is just the editor's own existing clip/caption controls
  // and Render button, not a separate screen.
  // FEATURE — "auto editing... adding transitions, effects, camera
  // flickers." Cycled rather than randomized — predictable, repeatable
  // output for the same clip count, still real variety across a run.
  // Deliberately excludes the more novelty/gimmick transitions (pixelize/
  // glitch, circle-open) from the AUTO set — those stay available to pick
  // by hand on the Clips tab, just not what a one-click pass reaches for.
  const DEFAULT_TRANSITION_CYCLE = ["crossfade", "zoom-punch", "slide-left", "slide-right", "smooth-slide", "radial-wipe", "dissolve"];
  // FEATURE — "describe in text what I want... discern and edit the video."
  // Resolves the ACTUAL settings a run should use: base state (or a picked
  // template) as the default, with any keyword the free-text prompt
  // actually matched taking precedence — never the other way around, so a
  // template pick isn't silently discarded just because the prompt field
  // has old text sitting in it from a previous run.
  const resolveEffectiveAutoEditSettings = () => {
    const promptResult = autoEditPrompt.trim() ? interpretStylePrompt(autoEditPrompt) : null;
    return {
      captionStyleId: promptResult?.captionStyleId || autoEditCaptionStyle,
      colorLook: promptResult?.colorLook || autoEditColorLook,
      transitionCycle: promptResult?.transitionCycle || autoEditTransitionCycle || DEFAULT_TRANSITION_CYCLE,
      cameraFlicker: promptResult?.cameraFlicker !== undefined ? promptResult.cameraFlicker : cameraFlickerEnabled,
      speed: promptResult?.speed,
      skipCaptions: !!promptResult?.skipCaptions,
      audioEffect: promptResult?.audioEffect || autoEditAudioEffect,
    };
  };
  // BUG FIX (audit finding — this is why Auto-Edit's output looked bad).
  // Auto-cutting dead space/filler words can split ONE original clip into
  // many small pieces (see splitClipAtRanges) — this used to stamp a
  // stylized transition from the cycle onto EVERY resulting boundary,
  // including the internal ones between two pieces of what was a single
  // continuous take. A real edit ended up with a crossfade/zoom/wipe
  // firing every time a silence or "um" got cut, sometimes dozens of
  // times per clip, instead of only between the clips the owner actually
  // dragged in. `internalCutOnly` (set by splitClipAtRanges) marks exactly
  // those invisible-edit boundaries — skip them here, always hard-cut,
  // regardless of whether transitions are enabled.
  // NOTE — speed is deliberately NOT set here anymore: it has to be
  // finalized BEFORE caption generation (see runAutoEdit — captions are
  // timed against whatever speed a piece renders at), so this only
  // touches things that don't affect timing.
  const applyAutoStyling = (clipList: EditorClip[], settings: ReturnType<typeof resolveEffectiveAutoEditSettings>): EditorClip[] => clipList.map((c, i) => ({
    ...c,
    transitionToNext: (autoEditAddTransitions && i < clipList.length - 1 && !c.internalCutOnly) ? settings.transitionCycle[i % settings.transitionCycle.length] : "none",
    colorLook: settings.colorLook !== "none" ? settings.colorLook : c.colorLook,
    audioEffect: settings.audioEffect !== "none" ? settings.audioEffect : c.audioEffect,
  }));

  // FEATURE — "add templates." One click sets caption style + color look +
  // transition set + camera flicker together — still just setting the same
  // state the manual controls below use, so any of it can be tweaked
  // afterward same as always.
  const applyTemplate = (id: string) => {
    const t = getAutoEditTemplate(id);
    if (!t) return;
    setAutoEditTemplateId(id);
    setAutoEditCaptionStyle(t.captionStyleId);
    setAutoEditColorLook(t.colorLook);
    setAutoEditTransitionCycle(t.transitionCycle);
    setAutoEditAddTransitions(true);
    setCameraFlickerEnabled(t.cameraFlicker);
  };

  // FEATURE — "ping the owner and ask what order you want the clips in."
  // clipsOverride lets the order-confirmation modal hand in its (possibly
  // just-reordered) draft directly — setClips() is async/batched, so
  // reading the `clips` state closure right after calling it would still
  // see the OLD order.
  // FEATURE — "you don't have to stay inside that page while it's auto
  // editing... notify you... send an email when it's done." Fires once,
  // at completion, regardless of whether this component is still mounted
  // to see it happen — the ACTUAL work (ffmpeg/Whisper) already ran via
  // module-level singletons independent of any component (see
  // autoEditJobStore.ts's own header comment), so this only needs to be
  // called from the one place that knows the run is really done.
  const notifyAutoEditDone = async (summary: string, durationMs: number) => {
    requestDesktopNotifPermission().then(granted => {
      if (granted) notifyDesktop("Auto-Edit ready", summary);
    }).catch(() => {});
    if (ownerId) {
      sendPushNotification({ ownerId, title: "Auto-Edit ready", body: summary, url: "#/social", tag: "auto-edit-done" }).catch(() => {});
    }
    // "depending on how long it is" — an explicit opt-in (checkbox) OR a
    // run that actually took a while (60s+) gets an email either way, so
    // a long unattended run still reaches the owner even if they didn't
    // think to check the box beforehand.
    const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
    if (ownerEmail && (autoEditEmailOnDone || durationMs > 60_000)) {
      const minutes = Math.round(durationMs / 6000) / 10;
      // BUG FIX — "it should also have a clickable button showing where
      // you can view it." Was plain text with no link at all before.
      const viewUrl = typeof window !== "undefined" ? `${window.location.origin}/#/social` : "";
      const html = emailShell(settings, "Your video is ready", `<p>Auto-Edit finished${minutes >= 1 ? ` in about ${minutes} minute${minutes === 1 ? "" : "s"}` : ""}.</p><p>${summary}</p>` + (viewUrl ? emailButton("View in CRM Starter", viewUrl) : `<p>Open CRM Starter and go to Social to review it.</p>`));
      sendOwnerGmailOnly(settings, ownerEmail, "Your video is ready", html).catch((e: any) => console.warn("[Auto-Edit] completion email failed:", e?.message));
    }
  };

  // FEATURE — "there should be a section for already-edited videos, they
  // shouldn't disappear... should appear in the drafts section." Only
  // called for a wizard-driven run (autoRenderOnCompleteRef — see its own
  // comment) — renders the finished cut/caption/style result the SAME way
  // the manual "Export" button does (renderFinalVideo), then hands it to
  // onExported(blob, true) — true = draftOnly, the exact same path the
  // manual editor's own "save as draft" checkbox already uses, so it
  // lands in Social → Drafts as a real, findable, still-postable video
  // instead of only ever existing as ephemeral in-editor state.
  const runAutoRenderAndSaveDraft = async (finalClips: EditorClip[], finalCaptions: EditorCaption[], runStartedMs: number) => {
    updateAutoEditJob({ phaseLabel: "Rendering final video…", pct: 0, etaSec: null });
    try {
      const blob = await renderFinalVideo(finalClips, finalCaptions, (phase, pct) => updateAutoEditJob({ phaseLabel: phase, pct }), aspectRatio, overlays, music, cameraFlickerEnabled);
      onExported(blob, true);
      const summary = `Your auto-edited video was rendered and saved as a draft — ${finalClips.length} clip${finalClips.length === 1 ? "" : "s"}, ${finalCaptions.length} caption${finalCaptions.length === 1 ? "" : "s"}. Find it in Social → Drafts.`;
      toast?.(summary, "green");
      finishAutoEditJob({ clips: finalClips, captions: finalCaptions, aspectRatio, summary });
      notifyAutoEditDone(summary, Date.now() - runStartedMs);
    } catch (e: any) {
      const msg = "Auto-edit cut/captioned successfully, but rendering the final video failed — " + (e?.message || "unknown error") + ". The edit is still open below — press Export to try again.";
      toast?.(msg, "red");
      failAutoEditJob(msg);
    }
  };

  const runAutoEdit = async (clipsOverride?: EditorClip[]) => {
    const sourceClips = clipsOverride || clips;
    if (sourceClips.length === 0) { toast?.("Add at least one clip first", "red"); return; }
    const effective = resolveEffectiveAutoEditSettings();
    setAutoEditPromptMatches(autoEditPrompt.trim() ? interpretStylePrompt(autoEditPrompt).matched : []);
    if (cameraFlickerEnabled !== effective.cameraFlicker) setCameraFlickerEnabled(effective.cameraFlicker);
    setAutoEditRunning(true);
    const runStartedMs = Date.now();
    startAutoEditJob();
    // Asking right as the owner starts a run they might want to walk away
    // from is the one moment this is actually contextual, rather than a
    // random permission popup on page load.
    requestDesktopNotifPermission().catch(() => {});
    const progress = createProgressEstimator(sourceClips.length, pct => `Auto-editing your video… ${pct}%`);
    try {
      setAutoEditPhase("Cutting dead space…");
      let cutClips: EditorClip[] = [];
      for (let i = 0; i < sourceClips.length; i++) {
        setAutoEditPhase(`Cutting dead space (clip ${i + 1}/${sourceClips.length})…`);
        const pieces = await autoCutClipDeadSpace(sourceClips[i]);
        cutClips.push(...pieces);
        progress.onPhase1Step();
      }

      // BUG FIX — speed must be finalized BEFORE the caption/filler loop
      // below, not after (applyAutoStyling used to be the only place speed
      // got set, but that ran AFTER captions were already timed against the
      // un-sped timeline — a caption's absolute seconds only match the
      // rendered video if the loop divides by whatever speed that piece
      // will actually render at). Prompt/manual speed applies first...
      if (effective.speed) cutClips = cutClips.map(c => c.isImage ? c : ({ ...c, speed: effective.speed }));
      // ...then the wizard's target-length fit (if any) tightens further —
      // same reason it has to happen before captions, not as a post-pass.
      let durationFitNote = "";
      if (autoEditTargetDurationSec) {
        const fit = fitClipsToDuration(cutClips, autoEditTargetDurationSec);
        cutClips = fit.clips;
        durationFitNote = fit.note;
      }

      const apiKey = getCaptionApiKey(captionProvider);
      const styleNote = [autoEditAddTransitions ? "transitions" : "", effective.colorLook !== "none" ? "color grade" : "", effective.cameraFlicker ? "camera flicker" : "", effective.speed && effective.speed !== 1 ? `${effective.speed}x speed` : "", autoEditAudioEffect !== "none" ? "audio effect" : ""].filter(Boolean).join(", ");
      const promptNote = autoEditPromptMatches.length > 0 ? ` (picked up from your description: ${autoEditPromptMatches.join(", ")})` : "";
      const fitNote = durationFitNote ? ` — ${durationFitNote}` : "";
      if (apiKey && !effective.skipCaptions) {
        setAutoEditPhase("Generating captions…");
        const newCaptions: EditorCaption[] = [];
        // FEATURE — "improve auto-editing ten times." The local provider's
        // word-level transcript also identifies filler words ("um," "uh,"
        // "like," etc. — see FILLER_WORDS in videoEditor.ts) and cuts THOSE
        // spans out of the actual video, same as the silence pass above did
        // — not just skipping them in the caption text. finalClips replaces
        // cutClips as the real timeline once this runs.
        const finalClips: EditorClip[] = [];
        let offset = 0;
        let fillerWordsCut = 0;
        // PERF FIX (audit finding) — dead-space cutting can split one
        // original upload into many pieces that all share the same
        // clip.file; without this, each piece's extractAudioForTranscription
        // call independently re-wrote the ENTIRE source file's bytes into
        // ffmpeg's virtual FS. Keyed by File (not piece id) so the source
        // is written once and every piece just re-reads it with its own
        // -ss/-t window. Cleaned up once the whole loop finishes below.
        const fsCache = new Map<File, string>();
        progress.onPhase2Start(cutClips.length);
        try {
        for (let i = 0; i < cutClips.length; i++) {
          const c = cutClips[i];
          const pieceSpeed = c.isImage ? 1 : Math.max(0.5, Math.min(2, c.speed || 1));
          setAutoEditPhase(`Transcribing (${i + 1}/${cutClips.length})…`);
          try {
            const audioBlob = await extractAudioForTranscription(c, fsCache);
            const rawSegments = await requestTranscription(audioBlob, captionProvider, apiKey, msg => setAutoEditPhase(msg));
            if (isLocalCaptionProvider(captionProvider)) {
              fillerWordsCut += rawSegments.filter(w => isFillerWord(w.text)).length;
              const { clips: piecesAfterFillerStrip, words: survivorWords } = stripFillerWordsFromClip(c, rawSegments);
              finalClips.push(...piecesAfterFillerStrip);
              // BUG FIX (audit finding — "captions didn't even fit the
              // screen"). Same fix as the manual Auto-Captions button: size
              // lines to the real export resolution, not a flat constant.
              const { w: autoEditTargetW, h: autoEditTargetH } = ASPECT_DIMENSIONS[aspectRatio];
              const groups = groupWordsIntoCaptionLines(survivorWords, { maxChars: estimateMaxCharsPerLine(autoEditTargetW, autoEditTargetH) });
              for (const g of groups) {
                // BUG FIX — g.start/g.end/word timestamps come from the
                // TRANSCRIPT (real source seconds within this piece,
                // unaffected by the speed field), but the RENDERED timeline
                // runs at pieceSpeed — divide so the caption lands where the
                // words actually end up after setpts/atempo speed the video
                // up or down.
                newCaptions.push({
                  id: uid(), text: g.text, startSec: offset + g.start / pieceSpeed, endSec: offset + g.end / pieceSpeed, styleId: effective.captionStyleId,
                  words: g.words.map(w => ({ text: w.text, start: offset + w.start / pieceSpeed, end: offset + w.end / pieceSpeed })),
                });
              }
              offset += piecesAfterFillerStrip.reduce((s, p) => s + Math.max(0, p.endSec - p.startSec) / (p.isImage ? 1 : Math.max(0.5, Math.min(2, p.speed || 1))), 0);
            } else {
              finalClips.push(c);
              for (const seg of rawSegments) newCaptions.push({ id: uid(), text: seg.text, startSec: offset + seg.start / pieceSpeed, endSec: offset + seg.end / pieceSpeed, styleId: effective.captionStyleId });
              offset += Math.max(0, c.endSec - c.startSec) / pieceSpeed;
            }
          } catch (e: any) {
            console.warn("[Auto-Edit] transcription failed for a clip, continuing:", e?.message);
            finalClips.push(c);
            offset += Math.max(0, c.endSec - c.startSec) / pieceSpeed;
          }
          progress.onPhase2Step();
        }
        } finally {
          await cleanupFsCache(fsCache);
        }
        const styledFinalClips = applyAutoStyling(finalClips, effective);
        setClips(styledFinalClips);
        setActiveClipId(styledFinalClips[0]?.id || null);
        setCaptions(prev => [...prev, ...newCaptions]);
        const fillerNote = fillerWordsCut > 0 ? `, cut ${fillerWordsCut} filler word${fillerWordsCut === 1 ? "" : "s"}` : "";
        // FEATURE — "can you review this before I finish it?" Auto-Edit
        // never renders/exports on its own — it only populates the
        // timeline/captions state below, landing the owner back in the
        // SAME editor with everything still fully editable (nothing here
        // ever calls doExport). Switching to the Clips tab puts the actual
        // result in front of them immediately instead of leaving them
        // looking at the Auto-Edit panel they just clicked from.
        setTab("clips");
        const finalCaptionsAll = [...captions, ...newCaptions];
        if (autoRenderOnCompleteRef.current) {
          toast?.(`Auto-edit cut and captioned — rendering the final video now (this can take a bit) ✓`, "green");
          await runAutoRenderAndSaveDraft(styledFinalClips, finalCaptionsAll, runStartedMs);
        } else {
          const doneSummary = `Auto-edit done — cut down to ${styledFinalClips.length} clip${styledFinalClips.length > 1 ? "s" : ""}${fillerNote}, added ${newCaptions.length} caption${newCaptions.length === 1 ? "" : "s"}${styleNote ? ` + ${styleNote}` : ""}${promptNote}${fitNote}. Review below, edit anything, then render ✓`;
          toast?.(doneSummary, "green");
          finishAutoEditJob({ clips: styledFinalClips, captions: finalCaptionsAll, aspectRatio, summary: doneSummary });
          notifyAutoEditDone(doneSummary, Date.now() - runStartedMs);
        }
      } else {
        const styledCutClips = applyAutoStyling(cutClips, effective);
        setClips(styledCutClips);
        setActiveClipId(styledCutClips[0]?.id || null);
        setTab("clips");
        if (autoRenderOnCompleteRef.current) {
          toast?.(`Auto-edit cut successfully — rendering the final video now (this can take a bit) ✓`, "green");
          await runAutoRenderAndSaveDraft(styledCutClips, captions, runStartedMs);
        } else {
          const captionCaveat = effective.skipCaptions ? "(skipped captions, per your description)" : "Add a captions API key to also auto-generate captions, or add them manually below";
          const doneSummary = `Auto-edit done — cut down to ${styledCutClips.length} clip${styledCutClips.length > 1 ? "s" : ""}${styleNote ? ` + ${styleNote}` : ""}${promptNote}${fitNote}. ${captionCaveat} ✓`;
          toast?.(doneSummary, "green");
          finishAutoEditJob({ clips: styledCutClips, captions, aspectRatio, summary: doneSummary });
          notifyAutoEditDone(doneSummary, Date.now() - runStartedMs);
        }
      }
    } catch (e: any) {
      toast?.("Auto-edit failed — " + (e?.message || "unknown error"), "red");
      failAutoEditJob(e?.message || "unknown error");
    } finally {
      setAutoEditRunning(false);
      setAutoEditPhase("");
    }
  };

  // FEATURE — "ping the owner and ask what order you want the clips in."
  // With more than one clip, Run Auto-Edit opens a real confirm-the-order
  // step first instead of firing immediately — up/down reorder on a draft
  // copy, only applied to the real timeline once confirmed.
  const startAutoEditFlow = () => {
    if (clips.length === 0) { toast?.("Add at least one clip first", "red"); return; }
    // Manual button click, inside the full editor — stop at a reviewable
    // state as before, never auto-render (see autoRenderOnCompleteRef's
    // own comment for why the wizard path differs).
    autoRenderOnCompleteRef.current = false;
    if (clips.length > 1) {
      setOrderDraft(clips.slice());
      setOrderConfirmOpen(true);
    } else {
      runAutoEdit();
    }
  };
  const moveOrderDraft = (index: number, dir: -1 | 1) => {
    setOrderDraft(prev => {
      const next = prev.slice();
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const confirmOrderAndRunAutoEdit = () => {
    setClips(orderDraft);
    setOrderConfirmOpen(false);
    runAutoEdit(orderDraft);
  };

  const updateCaption = (id: string, patch: Partial<EditorCaption>) => setCaptions(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  const removeCaption = (id: string) => setCaptions(prev => prev.filter(c => c.id !== id));

  const activeCaption = captions.find(c => c.startSec <= globalPreviewTime && globalPreviewTime <= c.endSec);
  const activeCaptionStyle = activeCaption ? getCaptionStyle(activeCaption.styleId) : null;

  const doExport = async () => {
    if (clips.length === 0) { toast?.("Add at least one clip first", "red"); return; }
    setRendering(true);
    setRenderPhase("Starting…");
    setRenderPct(0);
    try {
      const blob = await renderFinalVideo(clips, captions, (phase, pct) => { setRenderPhase(phase); setRenderPct(pct); }, aspectRatio, overlays, music, cameraFlickerEnabled);
      onExported(blob, saveAsDraftOnly);
      toast?.(saveAsDraftOnly ? "Video saved as a draft ✓" : "Video rendered ✓", "green");
      onClose();
    } catch (e: any) {
      console.error("[VideoEditor] export failed:", e);
      toast?.("Export failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setRendering(false);
    }
  };

  // FEATURE — "enable downloading videos directly from the editor, not
  // just exporting." Renders the same way as doExport, but saves straight
  // to the device instead of handing the blob to SocialPage's post
  // composer/draft flow — for "I just want the file," no posting involved.
  const doDownload = async () => {
    if (clips.length === 0) { toast?.("Add at least one clip first", "red"); return; }
    setRendering(true);
    setRenderPhase("Starting…");
    setRenderPct(0);
    try {
      const blob = await renderFinalVideo(clips, captions, (phase, pct) => { setRenderPhase(phase); setRenderPct(pct); }, aspectRatio, overlays, music, cameraFlickerEnabled);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `crm-starter-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast?.("Video downloaded ✓", "green");
    } catch (e: any) {
      console.error("[VideoEditor] download failed:", e);
      toast?.("Download failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setRendering(false);
    }
  };

  // Calls the owner's own configured video-editing API (functions/api/
  // video-autoedit.ts, currently wired for Shotstack) — entirely separate
  // code path from the free ffmpeg.wasm export above, only reachable when
  // a key exists. Shotstack renders from public URLs, not local files, so
  // this uploads each clip to Storage first (same uploadJobMedia path as
  // every other media attach in this app) before submitting the render.
  const doAutoEditWithApi = async () => {
    if (!hasApiKey) return;
    if (clips.length === 0) { toast?.("Add at least one clip first", "red"); return; }
    setAutoEditing(true);
    try {
      toast?.("Uploading clips…");
      const uploaded: { url: string; startSec: number; endSec: number }[] = [];
      for (const c of clips) {
        const url = await uploadJobMedia(c.file, `social/autoedit-${uid()}.mp4`, c.file.type || "video/mp4");
        if (!url) throw new Error(`Failed to upload ${c.file.name}`);
        uploaded.push({ url, startSec: c.startSec, endSec: c.endSec });
      }
      const resp = await fetch("/api/video-autoedit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: settings.videoAutoEditApiKey,
          clips: uploaded,
          captions: captions.map(c => ({ text: c.text, startSec: c.startSec, endSec: c.endSec })),
        }),
      });
      const data = await resp.json();
      if (!resp.ok && resp.status !== 202) throw new Error(data.error || `HTTP ${resp.status}`);
      if (data.pending) { toast?.(data.message || "Still rendering — check your Shotstack dashboard shortly", "yellow"); return; }
      if (data.url) {
        const videoRes = await fetch(data.url);
        const blob = await videoRes.blob();
        onExported(blob);
        toast?.("AI auto-edit rendered ✓", "green");
        onClose();
      }
    } catch (e: any) {
      toast?.("Auto-edit failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setAutoEditing(false);
    }
  };

  if (!open) return null;

  const busy = rendering || autoEditRunning || transcribing;
  // FEATURE — "video effects, video filters, good-looking LUTs." The
  // chosen look's CSS approximation (getColorLook(...).previewCss) is
  // appended after the plain brightness/contrast/saturation sliders — same
  // "correct, then grade" order renderFinalVideo applies for the real export.
  const activeLookCss = activeClip ? getColorLook(activeClip.colorLook).previewCss : "none";
  const previewFilterCss = activeClip
    ? `brightness(${1 + (activeClip.brightness || 0) / 100}) contrast(${1 + (activeClip.contrast || 0) / 100}) saturate(${Math.max(0, 1 + (activeClip.saturation || 0) / 100)})${activeLookCss !== "none" ? " " + activeLookCss : ""}`
    : undefined;

  const editor = (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 400, height: "100dvh" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={CAPTION_GOOGLE_FONTS_HREF} rel="stylesheet" />
      {/* FEATURE — "make the video editor mobile-friendly, not just PC."
          Every <input>/<select> below gets font-size:16px specifically —
          anything smaller triggers iOS Safari's auto-zoom-on-focus, which
          on a screen this dense means everything jumps and reflows every
          time a field is tapped. Buttons get a minimum 40px tap target
          (Apple/Google's own accessibility minimum). */}
      <style>{`
        .ve-input, .ve-select { font-size: 16px !important; }
        .ve-tap { min-width: 40px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; }
        @keyframes ve-anim-pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes ve-anim-bounce { 0% { transform: translateY(24px); opacity: 0; } 60% { transform: translateY(-6px); opacity: 1; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes ve-anim-slide-up { 0% { transform: translateY(40px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        @keyframes ve-anim-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes ve-anim-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
        @keyframes ve-anim-typewriter { 0% { clip-path: inset(0 100% 0 0); } 100% { clip-path: inset(0 0 0 0); } }
        @keyframes ve-anim-flicker { 0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; } 20%, 22%, 24%, 55% { opacity: 0.3; } }
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-white/10 flex-shrink-0">
        <button onClick={(busy || orderConfirmOpen) ? undefined : onClose} disabled={busy || orderConfirmOpen} className="ve-tap text-white/60 hover:text-white disabled:opacity-30"><X size={20} /></button>
        <div className="text-sm font-semibold text-white">Video Editor</div>
        {!busy && !orderConfirmOpen && clips.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <button onClick={doDownload} title="Download to your device" className="ve-tap px-2.5 py-1.5 rounded-lg border border-white/15 text-white/70 hover:text-white text-xs font-semibold flex items-center gap-1"><DownloadIcon size={13} /></button>
            <button onClick={doExport} className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-brand-fg text-xs font-bold">Export</button>
          </div>
        ) : <div className="w-16" />}
      </div>

      {orderConfirmOpen ? (
        // FEATURE — "ping the owner and ask what order you want the clips
        // in." A real step, not just a note — Run Auto-Edit stops here
        // first whenever there's more than one clip.
        <div className="flex-1 min-h-0 flex flex-col p-4 gap-3 overflow-y-auto">
          <div className="text-lg font-bold text-white">Confirm clip order</div>
          <div className="text-xs text-white/50 -mt-2">Auto-Edit stitches clips together in this order — move any of them before running.</div>
          <div className="space-y-2">
            {orderDraft.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
                <div className="w-6 h-6 rounded-full bg-purple-900/40 border border-purple-600/40 flex items-center justify-center text-[11px] font-bold text-purple-200 flex-shrink-0">{i + 1}</div>
                <div className="flex-1 min-w-0 text-xs text-white/70 truncate">{c.isImage ? "Photo" : "Clip"} {i + 1}{c.file?.name ? ` — ${c.file.name}` : ""}</div>
                <button onClick={() => moveOrderDraft(i, -1)} disabled={i === 0} className="ve-tap text-white/50 hover:text-white disabled:opacity-20"><ChevronUp size={16} /></button>
                <button onClick={() => moveOrderDraft(i, 1)} disabled={i === orderDraft.length - 1} className="ve-tap text-white/50 hover:text-white disabled:opacity-20"><ChevronDown size={16} /></button>
              </div>
            ))}
          </div>
          <div className="flex-1" />
          <div className="flex gap-2 pb-2">
            <button onClick={() => setOrderConfirmOpen(false)} className="flex-1 py-3 rounded-xl border border-white/15 text-white/60 hover:text-white text-sm font-semibold transition">Cancel</button>
            <button onClick={confirmOrderAndRunAutoEdit} className="flex-1 py-3 rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-600/50 text-purple-200 text-sm font-semibold transition flex items-center justify-center gap-1.5">
              <Sparkles size={14} />Confirm &amp; Run Auto-Edit
            </button>
          </div>
        </div>
      ) : busy ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="py-16 text-center space-y-4 px-6">
            <div className={"w-14 h-14 mx-auto rounded-full border-4 animate-spin " + (rendering ? "border-brand-600/20 border-t-brand-600" : "border-purple-600/20 border-t-purple-500")} />
            <div className="text-sm font-semibold text-white">{rendering ? renderPhase : autoEditPhase}</div>
            {rendering && (
              <div className="max-w-xs mx-auto h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-brand-600 transition-all text-brand-fg" style={{ width: `${renderPct}%` }} />
              </div>
            )}
            <div className="text-[11px] text-white/40">{rendering ? "Rendering happens on this device — don't close the tab." : "Auto-editing happens on this device — don't close the tab."}</div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Preview */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 gap-1.5">
            <div className="flex items-center justify-center gap-1.5">
              {ASPECT_RATIOS.map(ar => (
                <button key={ar} onClick={() => setAspectRatio(ar)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold border transition " + (aspectRatio === ar ? "border-brand-500/50 bg-brand-950/30 text-brand-300" : "border-white/10 text-white/50 hover:text-white")}>
                  {ar}
                </button>
              ))}
              {activeClip && (
                <button onClick={toggleFullscreenPreview} title="Fullscreen preview" className="ve-tap px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-white/10 text-white/50 hover:text-white flex items-center gap-1">
                  <Maximize2 size={13} />
                </button>
              )}
            </div>
            <div
              ref={previewBoxRef}
              onClick={e => {
                if (!positioningCaptionId || !previewBoxRef.current) return;
                const rect = previewBoxRef.current.getBoundingClientRect();
                const xPct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                const yPct = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
                updateCaption(positioningCaptionId, { xPct, yPct });
              }}
              className={"relative rounded-xl overflow-hidden bg-black mx-auto max-h-full " + (positioningCaptionId ? "cursor-crosshair ring-2 ring-brand-500" : "") + " " + (aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "1:1" ? "aspect-square" : "aspect-video")}
              // BUG FIX (audit finding — "captions didn't even fit the
              // screen; they were completely wrong"). containerType lets
              // the caption span below size itself in `cqw` (% of THIS
              // box's own rendered width) instead of the old `vw` (% of
              // the whole browser viewport) — vw had no relationship to
              // this box's actual on-screen size (further shrunk by
              // maxWidth for 9:16) OR to the export's real resolution, so
              // the preview could never have shown an overflow the real
              // export was about to have.
              style={{ maxWidth: aspectRatio === "9:16" ? "min(100%, 60vh)" : "100%", containerType: "inline-size" }}
            >
              {isFullscreenPreview && (
                <button
                  onClick={toggleFullscreenPreview}
                  className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white hover:bg-black/80"
                  title="Exit fullscreen"
                >
                  <X size={18} />
                </button>
              )}
              {activeClip && activeClip.isImage ? (
                // BUG FIX — "display the video frame in the editor preview."
                // A photo clip's `activeClipUrl` points at an image file — a
                // <video> element can't decode a JPEG/PNG at all, so this
                // showed nothing but a black box the whole time a photo
                // clip was active. Plain <img>, same transform/filter/crop
                // treatment the video path uses, driven by a manual
                // rAF-independent progress bar below since there's no real
                // playback position to read off an <img>.
                <img
                  key={activeClip.id}
                  src={activeClipUrl}
                  className="w-full h-full object-contain"
                  style={{ transform: `${activeClip.rotation ? `rotate(${activeClip.rotation}deg)` : ""} ${activeClip.flipH ? "scaleX(-1)" : ""}`.trim() || undefined, filter: previewFilterCss }}
                  alt=""
                />
              ) : activeClip ? (
                <video
                  ref={videoRef}
                  key={activeClip.id}
                  src={activeClipUrl}
                  controls={!positioningCaptionId && !cropEditingId && !playingAll}
                  className="w-full h-full object-contain"
                  style={{ transform: `${activeClip.rotation ? `rotate(${activeClip.rotation}deg)` : ""} ${activeClip.flipH ? "scaleX(-1)" : ""}`.trim() || undefined, filter: previewFilterCss }}
                  // BUG FIX — "trim doesn't do anything in the preview,
                  // press play and it plays the full untrimmed clip." Seeks
                  // to the trim-IN point as soon as the (freshly-mounted,
                  // per-clip key=) element has a duration to seek within,
                  // and auto-plays it when this clip was reached via
                  // continuous "Play All" rather than a manual click.
                  onLoadedMetadata={e => {
                    const v = e.target as HTMLVideoElement;
                    v.currentTime = activeClip.startSec;
                    if (playingAll) v.play().catch(() => {});
                  }}
                  onTimeUpdate={e => {
                    const v = e.target as HTMLVideoElement;
                    setPreviewTime(v.currentTime);
                    if (v.currentTime >= activeClip.endSec) advancePastClipEnd();
                  }}
                  onEnded={advancePastClipEnd}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white/30 text-sm gap-3">
                  <div>Add a clip to preview</div>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-900/40 border border-brand-700/40 text-brand-300 text-xs font-semibold"><Upload size={13} />Add clips</button>
                </div>
              )}
              {activeCaption && activeCaptionStyle && (() => {
                const isSelected = selectedCaptionId === activeCaption.id;
                const canInteract = !positioningCaptionId && !cropEditingId;
                // BUG FIX (audit finding) — same resolveBaseFontSize formula
                // the real export uses (assCaptions.ts), expressed as a
                // fraction of THIS aspect ratio's target width, then
                // rendered in `cqw` (see containerType above) so the
                // preview and the export agree numerically regardless of
                // how big the preview box happens to be on screen.
                const { w: previewTargetW, h: previewTargetH } = ASPECT_DIMENSIONS[aspectRatio];
                const previewFontCqw = (resolveBaseFontSize(previewTargetW, previewTargetH) / previewTargetW) * 100;
                return (
                  <div
                    className={"absolute left-0 right-0 flex justify-center px-4 text-center " + (canInteract ? "pointer-events-auto" : "pointer-events-none")}
                    style={
                      activeCaption.xPct !== undefined && activeCaption.yPct !== undefined
                        ? { left: `${activeCaption.xPct * 100}%`, top: `${activeCaption.yPct * 100}%`, right: "auto", transform: "translate(-50%, -50%)", width: "90%" }
                        : {
                            top: activeCaptionStyle.position === "top" ? "10%" : activeCaptionStyle.position === "center" ? "45%" : undefined,
                            bottom: activeCaptionStyle.position === "bottom" ? "8%" : undefined,
                          }
                    }
                  >
                    <span
                      key={activeCaption.id}
                      onPointerDown={canInteract ? e => startCaptionDrag(e, activeCaption, "move") : undefined}
                      // FEATURE — "double-tap them (on mobile) to edit."
                      // Jumps straight to the Captions tab with this
                      // caption selected, so the text field is right there
                      // to edit — same "double-tap opens editing" gesture
                      // CapCut uses, without building a separate inline
                      // on-canvas text editor.
                      onDoubleClick={canInteract ? () => { setSelectedCaptionId(activeCaption.id); setTab("captions"); } : undefined}
                      style={{
                        ...captionStyleToCss(activeCaptionStyle),
                        fontSize: `${previewFontCqw * (activeCaption.fontScale || 1)}cqw`, lineHeight: 1.2, display: "inline-block",
                        animation: activeCaptionStyle.animation !== "none" ? `ve-anim-${activeCaptionStyle.animation} 0.4s ease-out` : undefined,
                        cursor: canInteract ? "grab" : undefined,
                        outline: isSelected ? "2px dashed #ffffff" : undefined,
                        outlineOffset: isSelected ? "4px" : undefined,
                        touchAction: "none",
                        position: "relative",
                      }}
                    >
                      {activeCaption.text}
                      {isSelected && canInteract && (
                        <span
                          onPointerDown={e => startCaptionDrag(e, activeCaption, "resize")}
                          className="absolute -bottom-3 -right-3 w-7 h-7 bg-brand-500 rounded-full border-2 border-white flex items-center justify-center cursor-nwse-resize text-brand-fg"
                          style={{ touchAction: "none" }}
                        >
                          <Maximize2 size={11} className="text-white" />
                        </span>
                      )}
                    </span>
                  </div>
                );
              })()}
              {positioningCaptionId && (
                <div className="absolute inset-x-0 bottom-2 text-center text-[10px] text-white bg-black/70 py-1 pointer-events-none">Tap anywhere to place this caption</div>
              )}
              {/* Center-snap guide lines — CapCut-style, shown only while
                  actively dragging a caption within snap range. */}
              {captionDragging && captionSnap.x && (
                <div className="absolute inset-y-0 left-1/2 w-px bg-brand-500 pointer-events-none text-brand-fg" style={{ boxShadow: "0 0 4px rgba(255,255,255,0.8)" }} />
              )}
              {captionDragging && captionSnap.y && (
                <div className="absolute inset-x-0 top-1/2 h-px bg-brand-500 pointer-events-none text-brand-fg" style={{ boxShadow: "0 0 4px rgba(255,255,255,0.8)" }} />
              )}
              {/* FEATURE — "drag and drop those assets into the editor...
                  separate layers." Every overlay active at the current
                  preview time, drawn as a real absolutely-positioned image
                  the owner can drag to move or drag the corner handle to
                  resize — same interaction pattern as captions/crop above,
                  generalized to an image layer. */}
              {!cropEditingId && !positioningCaptionId && activeOverlays.map(ov => {
                const isSelected = selectedOverlayId === ov.id;
                return (
                  <div
                    key={ov.id}
                    onPointerDown={e => startOverlayDrag(e, ov, "move")}
                    onClick={e => { e.stopPropagation(); setSelectedOverlayId(ov.id); }}
                    className="absolute cursor-grab active:cursor-grabbing"
                    style={{
                      touchAction: "none",
                      left: `${ov.xPct * 100}%`, top: `${ov.yPct * 100}%`,
                      width: `${ov.widthPct * 100}%`,
                      transform: "translate(-50%, -50%)",
                      opacity: ov.opacity,
                      outline: isSelected ? "2px dashed #ffffff" : undefined,
                      outlineOffset: isSelected ? "3px" : undefined,
                    }}
                  >
                    {ov.kind === "video" ? (
                      <video src={ov.src} muted autoPlay loop playsInline className="w-full h-auto pointer-events-none select-none rounded" />
                    ) : (
                      <img src={ov.src} className="w-full h-auto pointer-events-none select-none" alt={ov.name} draggable={false} />
                    )}
                    {isSelected && (
                      <span
                        onPointerDown={e => startOverlayDrag(e, ov, "resize")}
                        className="absolute -bottom-3 -right-3 w-7 h-7 bg-brand-500 rounded-full border-2 border-white flex items-center justify-center cursor-nwse-resize text-brand-fg"
                        style={{ touchAction: "none" }}
                      >
                        <Maximize2 size={11} className="text-white" />
                      </span>
                    )}
                  </div>
                );
              })}
              {/* FEATURE — "crop stuff, resize it." Draggable crop rect —
                  move the whole box, or drag a corner to resize. Mapped
                  from the video's real rendered box (see containRect
                  measurement above) back to fractions of the source's own
                  pixel dimensions. */}
              {cropEditingId && activeClip && cropEditingId === activeClip.id && containRect.renderW > 0 && (() => {
                const crop = activeClip.crop || { x: 0, y: 0, w: 1, h: 1 };
                return (
                  <div
                    onPointerDown={e => startCropDrag(e, "move")}
                    className="absolute border-2 border-brand-500 cursor-move"
                    style={{
                      touchAction: "none",
                      left: containRect.offsetX + crop.x * containRect.renderW,
                      top: containRect.offsetY + crop.y * containRect.renderH,
                      width: crop.w * containRect.renderW,
                      height: crop.h * containRect.renderH,
                      boxShadow: "0 0 0 2000px rgba(0,0,0,0.55)",
                    }}
                  >
                    {(["tl", "tr", "bl", "br"] as const).map(corner => (
                      <div
                        key={corner}
                        onPointerDown={e => { e.stopPropagation(); startCropDrag(e, corner); }}
                        className="absolute w-7 h-7 bg-brand-500 rounded-full border-2 border-white text-brand-fg"
                        style={{
                          touchAction: "none",
                          left: corner.includes("l") ? -14 : undefined, right: corner.includes("r") ? -14 : undefined,
                          top: corner.includes("t") ? -14 : undefined, bottom: corner.includes("b") ? -14 : undefined,
                        }}
                      />
                    ))}
                  </div>
                );
              })()}
              {/* FEATURE — "when you press play on the preview, it should
                  play all the clips... show the full video." A single,
                  always-visible play/pause control that plays the WHOLE
                  assembled sequence (current clip onward through the rest
                  of the timeline), not just whichever one clip happens to
                  be selected — native per-clip <video controls> stays
                  available too, for scrubbing within a clip. */}
              {activeClip && !positioningCaptionId && !cropEditingId && (
                <button
                  onClick={() => {
                    if (playingAll) { setPlayingAll(false); videoRef.current?.pause(); }
                    else { setPlayingAll(true); if (!activeClip.isImage) videoRef.current?.play().catch(() => {}); }
                  }}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 w-11 h-11 rounded-full bg-black/70 border border-white/25 flex items-center justify-center text-white hover:bg-black/85 transition"
                  title={playingAll ? "Pause" : "Play all clips"}
                >
                  {playingAll ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                </button>
              )}
            </div>
            {positioningCaptionId && (
              <button onClick={() => setPositioningCaptionId(null)} className="text-center text-xs text-brand-400 hover:text-brand-300 font-semibold">Done positioning</button>
            )}
            {cropEditingId && (
              <button onClick={() => setCropEditingId(null)} className="text-center text-xs text-brand-400 hover:text-brand-300 font-semibold">Done cropping</button>
            )}
          </div>

          {/* FEATURE — "show a timeline, the different clips like CapCut
              shows... move stuff drag and drop." Horizontal filmstrip of
              proportionally-sized, thumbnailed clip blocks — drag one to
              reorder (see handleTimelinePointerDown), tap to select. */}
          <div className="flex-shrink-0 border-t border-white/10 px-2 pt-2 pb-1">
            <div ref={timelineRef} className="flex items-stretch gap-1 overflow-x-auto pb-1">
              {clips.map((c, i) => {
                const widthPx = Math.max(48, Math.min(160, (c.endSec - c.startSec) * 18));
                const hasTransition = !!(c.transitionToNext && c.transitionToNext !== "none");
                return (
                  <React.Fragment key={c.id}>
                    <div
                      data-clip-id={c.id}
                      onPointerDown={e => handleTimelinePointerDown(e, c.id)}
                      onClick={() => { setActiveClipId(c.id); setTab("clips"); }}
                      className={"relative flex-shrink-0 h-16 rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing " + (activeClipId === c.id ? "border-brand-500" : "border-white/10") + (draggingClipId === c.id ? " opacity-60" : "")}
                      style={{ width: widthPx, touchAction: "none" }}
                    >
                      {clipThumbs[c.id] ? <img src={clipThumbs[c.id]} className="w-full h-full object-cover" draggable={false} alt="" /> : <div className="w-full h-full bg-white/5" />}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] text-white text-center py-0.5">{i + 1}</div>
                    </div>
                    {/* FEATURE — "add a small plus button between each video
                        to insert transitions — fading, blur, and other
                        CapCut-style transitions." A native <select> gives
                        every TRANSITION_EFFECTS option in one tap without
                        building a custom popover — sized/positioned to
                        read as a small round + button, not an obvious
                        dropdown, matching the CapCut affordance while
                        staying keyboard/touch accessible for free. Already
                        wired to the same activeClip.transitionToNext field
                        the Clips-tab dropdown uses, so both stay in sync. */}
                    {i < clips.length - 1 && (
                      <div className="relative flex-shrink-0 w-5 self-center" title="Transition to next clip">
                        <select
                          value={c.transitionToNext || "none"}
                          onChange={e => updateClip(c.id, { transitionToNext: e.target.value })}
                          className="absolute inset-0 w-5 h-5 opacity-0 cursor-pointer"
                        >
                          {TRANSITION_EFFECTS.map(t => <option key={t.id} value={t.id} className="bg-black">{t.name}</option>)}
                        </select>
                        <div className={"w-5 h-5 rounded-full flex items-center justify-center pointer-events-none border transition " + (hasTransition ? "bg-brand-600 border-brand-400 text-brand-fg" : "bg-white/10 border-white/20 text-white/50")}>
                          <Plus size={11} />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
              <button onClick={() => fileInputRef.current?.click()} title="Add video clip" className="flex-shrink-0 w-12 h-16 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 hover:text-white">
                <Plus size={18} />
              </button>
              <button onClick={() => photoInputRef.current?.click()} title="Add photo clip" className="flex-shrink-0 w-12 h-16 rounded-lg border-2 border-dashed border-white/20 flex items-center justify-center text-white/40 hover:text-white">
                <ImagePlus size={16} />
              </button>
              <input ref={fileInputRef} type="file" accept="video/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
              <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addPhotoClips(e.target.files)} />
            </div>
          </div>

          {/* Tool tabs — scrollable, not a fixed grid, so adding tracks
              (Overlays/Music) doesn't squeeze every tab unreadably thin on
              a phone. */}
          <div className="flex-shrink-0 flex overflow-x-auto border-t border-white/10">
            {([
              { id: "clips" as const, label: "Clips", icon: Scissors },
              { id: "adjust" as const, label: "Adjust", icon: Sliders },
              { id: "captions" as const, label: "Captions", icon: Type },
              { id: "overlays" as const, label: "Overlays", icon: Layers },
              { id: "music" as const, label: "Music", icon: MusicIcon },
              { id: "auto" as const, label: "Auto-Edit", icon: Sparkles },
            ]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={"flex-1 min-w-[68px] flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition " + (tab === t.id ? "text-brand-400 bg-brand-950/20" : "text-white/40 hover:text-white/70")}>
                <t.icon size={16} />{t.label}
              </button>
            ))}
          </div>

          {/* Tool panel */}
          {/* BUG FIX — "the preview is not very big." This panel was
              permanently reserved at 38vh regardless of tab content,
              leaving the preview only ~25-30% of a typical phone screen.
              Capped lower so the preview (flex-1, above) actually gets
              most of the vertical space back. */}
          <div className="flex-shrink-0 max-h-[26vh] overflow-y-auto px-3 py-3 border-t border-white/5">
            {tab === "clips" && (
              <div className="space-y-2">
                {clips.length === 0 ? (
                  <div className="text-center py-8 text-white/30 text-xs border border-dashed border-white/10 rounded-xl">No clips yet — tap the + on the timeline above to add videos</div>
                ) : !activeClip ? null : (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 text-xs font-medium text-white truncate py-2">{activeClip.file.name}</div>
                      <button onClick={() => updateClip(activeClip.id, { rotation: (((activeClip.rotation || 0) + 90) % 360) as any })} title="Rotate 90°" className={"ve-tap " + ((activeClip.rotation || 0) !== 0 ? "text-brand-400" : "text-white/40 hover:text-white")}><RotateCw size={16} /></button>
                      <button onClick={() => updateClip(activeClip.id, { flipH: !activeClip.flipH })} title="Flip horizontal" className={"ve-tap " + (activeClip.flipH ? "text-brand-400" : "text-white/40 hover:text-white")}><FlipHorizontal size={16} /></button>
                      <button onClick={() => setCropEditingId(cropEditingId === activeClip.id ? null : activeClip.id)} title="Crop" className={"ve-tap " + (cropEditingId === activeClip.id ? "text-brand-400" : activeClip.crop ? "text-brand-300" : "text-white/40 hover:text-white")}><CropIcon size={16} /></button>
                      <button onClick={splitClipAtPlayhead} title="Split at playhead" className="ve-tap text-white/40 hover:text-white"><Scissors size={16} /></button>
                      <button onClick={() => removeClip(activeClip.id)} className="ve-tap text-danger-400/60 hover:text-danger-400"><Trash2 size={16} /></button>
                    </div>
                    {activeClip.crop && (
                      <button onClick={() => updateClip(activeClip.id, { crop: undefined })} className="text-[10px] text-white/40 hover:text-white/70">Reset crop</button>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8 flex-shrink-0">Start</span>
                        <input type="range" min={0} max={activeClip.durationSec} step={0.1} value={activeClip.startSec}
                          onChange={e => updateClip(activeClip.id, { startSec: Math.min(Number(e.target.value), activeClip.endSec - 0.1) })}
                          className="flex-1 accent-brand-600" style={{ height: 24 }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40 w-8 flex-shrink-0">End</span>
                        <input type="range" min={0} max={activeClip.durationSec} step={0.1} value={activeClip.endSec}
                          onChange={e => updateClip(activeClip.id, { endSec: Math.max(Number(e.target.value), activeClip.startSec + 0.1) })}
                          className="flex-1 accent-brand-600" style={{ height: 24 }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-white/50">
                      <span>Trim:</span>
                      <input type="number" min={0} max={activeClip.durationSec} step={0.1} value={activeClip.startSec.toFixed(1)}
                        onChange={e => updateClip(activeClip.id, { startSec: Math.min(Number(e.target.value) || 0, activeClip.endSec - 0.1) })}
                        className="ve-input w-16 bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white" />
                      <span>to</span>
                      <input type="number" min={0} max={activeClip.durationSec} step={0.1} value={activeClip.endSec.toFixed(1)}
                        onChange={e => updateClip(activeClip.id, { endSec: Math.max(Number(e.target.value) || 0, activeClip.startSec + 0.1) })}
                        className="ve-input w-16 bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white" />
                      <span>of {activeClip.durationSec.toFixed(1)}s</span>
                    </div>
                    {clips.findIndex(c => c.id === activeClip.id) < clips.length - 1 && (
                      <div className="flex items-center gap-2 text-[11px] text-white/50">
                        <span className="flex-shrink-0">Transition to next →</span>
                        <select value={activeClip.transitionToNext || "none"} onChange={e => updateClip(activeClip.id, { transitionToNext: e.target.value })}
                          className="ve-select flex-1 bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white">
                          {TRANSITION_EFFECTS.map(t => <option key={t.id} value={t.id} className="bg-black" title={t.description}>{t.name}</option>)}
                        </select>
                      </div>
                    )}
                    {silenceRanges.filter(r => r.clipId === activeClip.id).length > 0 && (
                      <div className="space-y-1">
                        {silenceRanges.filter(r => r.clipId === activeClip.id).map((r, si) => (
                          <div key={si} className="flex items-center justify-between text-[10px] bg-yellow-950/20 border border-yellow-700/30 rounded-lg px-2 py-1 text-yellow-200/80">
                            <span>Quiet: {r.start.toFixed(1)}s–{r.end.toFixed(1)}s</span>
                            <button
                              onClick={() => {
                                if (r.start <= activeClip.startSec + 0.3) updateClip(activeClip.id, { startSec: r.end });
                                else updateClip(activeClip.id, { endSec: r.start });
                                setSilenceRanges(prev => prev.filter(x => x !== r));
                              }}
                              className="text-yellow-300 hover:text-yellow-100 font-semibold"
                            >Trim it</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button onClick={runAutoCut} disabled={detectingSilence}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold transition disabled:opacity-40">
                        <Wand2 size={12} />{detectingSilence ? "Analyzing…" : "Auto-Cut Silence"}
                      </button>
                      <button onClick={runAutoCaptions} disabled={transcribing}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-xs font-semibold transition disabled:opacity-40">
                        <Captions size={12} />{transcribing ? "Transcribing…" : "Auto-Captions"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "adjust" && (
              !activeClip ? <div className="text-center py-8 text-white/30 text-xs">Add a clip first</div> : (
                <div className="space-y-3">
                  <div className="text-[10px] text-white/40">Adjustments apply to this clip only — pick another clip on the timeline to adjust it separately.</div>
                  {(["brightness", "contrast", "saturation"] as const).map(key => (
                    <div key={key}>
                      <div className="text-[11px] text-white/60 mb-1 capitalize flex justify-between"><span>{key}</span><span className="text-white/40">{(activeClip as any)[key] || 0}</span></div>
                      <input type="range" min={-100} max={100} value={(activeClip as any)[key] || 0}
                        onChange={e => updateClip(activeClip.id, { [key]: Number(e.target.value) } as any)}
                        className="w-full accent-brand-600" style={{ height: 24 }} />
                    </div>
                  ))}
                  <button onClick={() => updateClip(activeClip.id, { brightness: 0, contrast: 0, saturation: 0 })} className="text-[10px] text-white/40 hover:text-white/70">Reset adjustments</button>

                  {/* FEATURE — "add more options for everything." Real
                      slow-motion/speed-up, not just a cosmetic slider —
                      ffmpeg actually re-times the clip (setpts) and its
                      audio (atempo) on export. Skipped entirely for a still
                      image (isImage), which has no native timeline to
                      speed up. */}
                  {!activeClip.isImage && (
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-[11px] text-white/60 mb-1 flex justify-between"><span>Speed</span><span className="text-white/40">{(activeClip.speed || 1).toFixed(2)}×</span></div>
                      <input type="range" min={0.5} max={2} step={0.1} value={activeClip.speed || 1}
                        onChange={e => updateClip(activeClip.id, { speed: Number(e.target.value) })}
                        className="w-full accent-brand-600" style={{ height: 24 }} />
                      <div className="flex justify-between text-[9px] text-white/30 -mt-1">
                        <span>0.5× slow-mo</span><span>1× normal</span><span>2× fast</span>
                      </div>
                      {activeClip.speed && activeClip.speed !== 1 && (
                        <div className="text-[10px] text-yellow-400/70 mt-1.5">Changing speed after adding captions can throw their timing off this clip — re-time or re-add captions after, if needed.</div>
                      )}
                    </div>
                  )}

                  {/* FEATURE — "video effects, video filters, good-looking
                      LUTs." Real ffmpeg color-grade presets (COLOR_LOOKS),
                      not just a slider — applied on top of the brightness/
                      contrast/saturation correction above. */}
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] text-white/60 mb-2">Color look (LUT-style grade)</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {COLOR_LOOKS.map(look => {
                        const selected = (activeClip.colorLook || "none") === look.id;
                        return (
                          <button
                            key={look.id}
                            onClick={() => updateClip(activeClip.id, { colorLook: look.id === "none" ? undefined : look.id })}
                            title={look.description}
                            className={"rounded-lg overflow-hidden border text-left transition " + (selected ? "border-brand-500 ring-1 ring-brand-500/50" : "border-white/10 hover:border-white/30")}
                          >
                            <div className="h-8 w-full" style={{ background: "linear-gradient(135deg,#7a5230,#2a3a52,#903030)", filter: look.previewCss }} />
                            <div className="px-1.5 py-1 bg-black/40 text-[9px] leading-tight text-white/70 truncate">{look.name}</div>
                          </button>
                        );
                      })}
                    </div>
                    {activeClip.colorLook && activeClip.colorLook !== "none" && (
                      <div className="text-[10px] text-white/40 mt-1.5">{getColorLook(activeClip.colorLook).description}</div>
                    )}
                  </div>
                  {/* FEATURE — per-clip mute, e.g. wind/traffic noise on
                      one clip without silencing the whole video. */}
                  <label className="flex items-center gap-2 pt-2 border-t border-white/10 cursor-pointer">
                    <input type="checkbox" checked={!!activeClip.muted} onChange={e => updateClip(activeClip.id, { muted: e.target.checked })} className="accent-brand-600 w-3.5 h-3.5" />
                    <span className="text-xs text-white/70 flex items-center gap-1">{activeClip.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}Mute this clip's audio</span>
                  </label>
                  {/* FEATURE — "applying various sound effects such as
                      muffled or underwater sounds." Real ffmpeg audio
                      filters, applied to this clip's own audio only. */}
                  <div className="pt-2 border-t border-white/10">
                    <div className="text-[11px] text-white/60 mb-1">Sound effect (this clip's audio)</div>
                    <select value={activeClip.audioEffect || "none"} onChange={e => updateClip(activeClip.id, { audioEffect: e.target.value })} className="ve-select w-full bg-black/30 border border-white/10 rounded-lg px-1.5 py-2 text-white">
                      {SOUND_EFFECTS.map(fx => <option key={fx.id} value={fx.id} className="bg-black" title={fx.description}>{fx.name}</option>)}
                    </select>
                    {activeClip.audioEffect && activeClip.audioEffect !== "none" && (
                      <div className="text-[10px] text-white/40 mt-1">{SOUND_EFFECTS.find(fx => fx.id === activeClip.audioEffect)?.description}</div>
                    )}
                  </div>
                </div>
              )
            )}

            {tab === "captions" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">Captions ({captions.length})</div>
                  <button onClick={addCaption} className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 py-2 px-1"><Plus size={11} />Add at {previewTime.toFixed(1)}s</button>
                </div>
                {captions.length === 0 ? (
                  <div className="text-center py-6 text-white/30 text-xs border border-dashed border-white/10 rounded-xl">No captions yet — type your own, or use Auto-Captions in the Clips tab</div>
                ) : (
                  <div className="space-y-2">
                    {captions.map(cap => {
                      const isSelected = selectedCaptionId === cap.id;
                      return (
                      <div
                        key={cap.id}
                        onClick={() => { setSelectedCaptionId(cap.id); setActiveClipId(activeClipId); setPreviewTime(Math.max(0, cap.startSec - activeClipGlobalOffset)); }}
                        className={"p-2.5 rounded-xl border space-y-1.5 cursor-pointer transition " + (isSelected ? "bg-brand-950/20 border-brand-600/50" : "bg-white/5 border-white/10")}
                      >
                        <div className="flex items-center gap-1.5">
                          <input value={cap.text} onChange={e => updateCaption(cap.id, { text: e.target.value })}
                            className="ve-input flex-1 bg-black/30 border border-white/10 rounded px-2 py-2 text-white" placeholder="Caption text" />
                          <button onClick={e => { e.stopPropagation(); removeCaption(cap.id); }} className="ve-tap text-danger-400/60 hover:text-danger-400 flex-shrink-0"><Trash2 size={15} /></button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-white/50">
                          <span>From</span>
                          <input type="number" min={0} step={0.1} value={cap.startSec.toFixed(1)} onChange={e => updateCaption(cap.id, { startSec: Number(e.target.value) || 0 })} className="ve-input w-16 bg-black/30 border border-white/10 rounded px-1 py-1.5 text-white" onClick={e => e.stopPropagation()} />
                          <span>to</span>
                          <input type="number" min={0} step={0.1} value={cap.endSec.toFixed(1)} onChange={e => updateCaption(cap.id, { endSec: Number(e.target.value) || 0 })} className="ve-input w-16 bg-black/30 border border-white/10 rounded px-1 py-1.5 text-white" onClick={e => e.stopPropagation()} />
                          <span>s</span>
                        </div>
                        <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <select value={cap.styleId} onChange={e => updateCaption(cap.id, { styleId: e.target.value })} className="ve-select flex-1 bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white">
                            {CAPTION_STYLES.map(s => <option key={s.id} value={s.id} className="bg-black">{s.name}</option>)}
                          </select>
                          <button onClick={() => { setSelectedCaptionId(cap.id); setPreviewTime(Math.max(0, cap.startSec - activeClipGlobalOffset)); setPositioningCaptionId(cap.id); }}
                            className={"text-[11px] font-semibold px-2 py-1.5 rounded-lg border flex-shrink-0 " + (cap.xPct !== undefined ? "border-brand-500/50 bg-brand-950/30 text-brand-300" : "border-white/10 text-white/50 hover:text-white")}>
                            Position
                          </button>
                          {cap.xPct !== undefined && (
                            <button onClick={() => updateCaption(cap.id, { xPct: undefined, yPct: undefined })} className="text-[10px] text-white/30 hover:text-white/60 flex-shrink-0">Reset</button>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
                {/* FEATURE — "I can't select caption templates or switch
                    templates after clicking a caption." This gallery used
                    to be purely decorative (no onClick at all) — tap a
                    caption above (or on the canvas) to select it, then tap
                    a tile here to apply that template to it. */}
                <div className="text-[10px] text-white/40 -mb-1">{selectedCaptionId ? "Tap a template to apply it to the selected caption" : "Select a caption above (or tap it on the preview) to change its template"}</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto p-0.5">
                  {CAPTION_STYLES.map(s => {
                    const selectedCap = captions.find(c => c.id === selectedCaptionId);
                    const isActive = selectedCap?.styleId === s.id;
                    return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!selectedCaptionId}
                      onClick={() => selectedCaptionId && updateCaption(selectedCaptionId, { styleId: s.id })}
                      className={"rounded-lg bg-black border py-3 px-1.5 flex items-center justify-center text-center transition disabled:opacity-40 " + (isActive ? "border-brand-500 ring-2 ring-brand-500/50" : "border-white/10 hover:border-white/30")}
                      title={s.description}
                    >
                      <span style={{ ...captionStyleToCss(s), fontSize: 11 }}>{s.name}</span>
                    </button>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === "overlays" && (
              <div className="space-y-3">
                {/* FEATURE — "import their logo, phone number, and other
                    media into a folder inside the video's social section
                    and drag and drop those assets into the editor." Real,
                    persistent brand asset library (settings.brandAssets) —
                    upload once, reuse on every future video. */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wide flex items-center gap-1.5"><Layers size={12} />Brand Assets</div>
                    <button onClick={() => assetInputRef.current?.click()} disabled={uploadingAsset} className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 py-1.5 px-1 disabled:opacity-50">
                      <Plus size={11} />{uploadingAsset ? "Adding…" : "Upload Logo/Asset"}
                    </button>
                    <input ref={assetInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) addBrandAsset(f); e.target.value = ""; }} />
                  </div>
                  {brandAssets.length === 0 ? (
                    <div className="text-center py-4 text-white/30 text-[11px] border border-dashed border-white/10 rounded-xl">No brand assets yet — upload your logo, a phone-number graphic, or any image you reuse across videos</div>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {brandAssets.map(a => (
                        <div key={a.id} className="flex-shrink-0 w-16 group relative">
                          <button onClick={() => addOverlay(a.dataUrl, a.name)} className="w-16 h-16 rounded-lg bg-white/10 border border-white/10 hover:border-brand-500/50 overflow-hidden flex items-center justify-center transition">
                            <img src={a.dataUrl} className="max-w-full max-h-full object-contain" alt={a.name} />
                          </button>
                          <div className="text-[9px] text-white/40 truncate text-center mt-0.5">{a.name}</div>
                          <button onClick={() => deleteBrandAsset(a.id)} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-black/80 border border-white/20 text-danger-400 hidden group-hover:flex items-center justify-center"><X size={9} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 flex-wrap gap-1">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">Overlay Layer ({overlays.length})</div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => overlayAssetInputRef.current?.click()} className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 py-1.5 px-1">
                      <ImagePlus size={11} />One-off image
                    </button>
                    {/* FEATURE — "picture-in-picture video." A second clip
                        composited over the main one, own position/size/time
                        window — same overlay layer as an image, just kind:"video". */}
                    <button onClick={() => pipVideoInputRef.current?.click()} className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 py-1.5 px-1">
                      <Layers size={11} />PiP video
                    </button>
                  </div>
                  <input ref={overlayAssetInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) addOverlayFromUpload(f); e.target.value = ""; }} />
                  <input ref={pipVideoInputRef} type="file" accept="video/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) addPipVideo(f); e.target.value = ""; }} />
                </div>
                {overlays.length === 0 ? (
                  <div className="text-center py-6 text-white/30 text-xs border border-dashed border-white/10 rounded-xl">Tap a brand asset above, upload a one-off image, or add a PiP video to layer it on the preview</div>
                ) : (
                  <div className="space-y-2">
                    {overlays.map(ov => {
                      const isSelected = selectedOverlayId === ov.id;
                      return (
                        <div key={ov.id} onClick={() => { setSelectedOverlayId(ov.id); setPreviewTime(Math.max(0, ov.startSec - activeClipGlobalOffset)); }}
                          className={"p-2.5 rounded-xl border space-y-1.5 cursor-pointer transition flex gap-2.5 " + (isSelected ? "bg-brand-950/20 border-brand-600/50" : "bg-white/5 border-white/10")}>
                          {ov.kind === "video" ? (
                            <video src={ov.src} muted className="w-10 h-10 rounded-lg object-cover bg-black/40 flex-shrink-0" />
                          ) : (
                            <img src={ov.src} className="w-10 h-10 rounded-lg object-contain bg-black/40 flex-shrink-0" alt={ov.name} />
                          )}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 text-xs text-white truncate">{ov.name}{ov.kind === "video" && <span className="ml-1.5 text-[9px] text-brand-400/70 uppercase">PiP</span>}</div>
                              <button onClick={e => { e.stopPropagation(); removeOverlay(ov.id); }} className="ve-tap text-danger-400/60 hover:text-danger-400 flex-shrink-0"><Trash2 size={14} /></button>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-white/50" onClick={e => e.stopPropagation()}>
                              <span>From</span>
                              <input type="number" min={0} step={0.1} value={ov.startSec.toFixed(1)} onChange={e => updateOverlay(ov.id, { startSec: Number(e.target.value) || 0 })} className="ve-input w-14 bg-black/30 border border-white/10 rounded px-1 py-1.5 text-white" />
                              <span>to</span>
                              <input type="number" min={0} step={0.1} value={ov.endSec.toFixed(1)} onChange={e => updateOverlay(ov.id, { endSec: Number(e.target.value) || 0 })} className="ve-input w-14 bg-black/30 border border-white/10 rounded px-1 py-1.5 text-white" />
                              <span>s</span>
                            </div>
                            <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                              <span className="text-[10px] text-white/40 w-10 flex-shrink-0">Opacity</span>
                              <input type="range" min={0.1} max={1} step={0.05} value={ov.opacity} onChange={e => updateOverlay(ov.id, { opacity: Number(e.target.value) })} className="flex-1 accent-brand-600" style={{ height: 20 }} />
                            </div>
                            {ov.kind === "video" && (
                              <label className="flex items-center gap-1.5 text-[10px] text-white/50" onClick={e => e.stopPropagation()}>
                                <input type="checkbox" checked={ov.muted !== false} onChange={e => updateOverlay(ov.id, { muted: e.target.checked })} className="accent-brand-600" />
                                Mute this clip's audio
                              </label>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {overlays.length > 0 && (
                  <div className="text-[10px] text-white/40 text-center pt-1">Click an overlay on the preview above to select it, drag it to move, or drag its corner handle to resize.</div>
                )}
              </div>
            )}

            {tab === "music" && (
              <div className="space-y-3">
                {/* FEATURE — "enable adding music, moving music tracks." */}
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wide flex items-center gap-1.5"><MusicIcon size={12} />Music Track</div>
                  {!music && (
                    <button onClick={() => musicInputRef.current?.click()} className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 py-1.5 px-1"><Plus size={11} />Add Music</button>
                  )}
                  <input ref={musicInputRef} type="file" accept="audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) addMusic(f); e.target.value = ""; }} />
                </div>
                {!music ? (
                  <div className="text-center py-6 text-white/30 text-xs border border-dashed border-white/10 rounded-xl">No music yet — add a track to play under your clips' own audio</div>
                ) : (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 text-xs text-white truncate">{music.name}</div>
                      <button onClick={() => setMusic(null)} className="ve-tap text-danger-400/60 hover:text-danger-400 flex-shrink-0"><Trash2 size={15} /></button>
                    </div>
                    <div>
                      {/* FEATURE — "moving music tracks." A real timeline
                          slider for where the music starts playing relative
                          to the whole assembled video — drag it, same idea
                          as every other timeline control here. */}
                      <div className="flex justify-between text-[10px] text-white/40 mb-1"><span>Starts at {music.startSec.toFixed(1)}s</span><span>Video is {totalTimelineSec.toFixed(1)}s</span></div>
                      <input type="range" min={0} max={Math.max(0.1, totalTimelineSec)} step={0.1} value={music.startSec}
                        onChange={e => setMusic(m => m && { ...m, startSec: Number(e.target.value) })}
                        className="w-full accent-brand-600" style={{ height: 24 }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] text-white/40 mb-1">Trim start</div>
                        <input type="number" min={0} max={music.durationSec} step={0.1} value={music.trimStart.toFixed(1)}
                          onChange={e => setMusic(m => m && { ...m, trimStart: Math.min(Number(e.target.value) || 0, m.trimEnd - 0.1) })}
                          className="ve-input w-full bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white" />
                      </div>
                      <div>
                        <div className="text-[10px] text-white/40 mb-1">Trim end</div>
                        <input type="number" min={0} max={music.durationSec} step={0.1} value={music.trimEnd.toFixed(1)}
                          onChange={e => setMusic(m => m && { ...m, trimEnd: Math.max(Number(e.target.value) || 0, m.trimStart + 0.1) })}
                          className="ve-input w-full bg-black/30 border border-white/10 rounded px-1.5 py-1.5 text-white" />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] text-white/40 mb-1">{music.volume === 0 ? <VolumeX size={11} /> : <Volume2 size={11} />}<span>Volume — {Math.round(music.volume * 100)}%</span></div>
                      <input type="range" min={0} max={1.5} step={0.05} value={music.volume} onChange={e => setMusic(m => m && { ...m, volume: Number(e.target.value) })} className="w-full accent-brand-600" style={{ height: 24 }} />
                    </div>
                    <div className="text-[10px] text-white/40">Clips' own audio still plays too — this mixes under it, doesn't replace it.</div>
                  </div>
                )}
              </div>
            )}

            {tab === "auto" && (
              <div className="space-y-3">
                {/* FEATURE — "make it so you can auto edit." One button
                    that chains auto-cut-dead-space + auto-captions across
                    every clip in the timeline (not just the active one). */}
                <div className="p-3 rounded-xl bg-purple-950/15 border border-purple-700/30 space-y-2.5">
                  <div className="text-xs font-semibold text-purple-300 flex items-center gap-1.5"><Sparkles size={13} />Auto-Edit</div>
                  <div className="text-[10px] text-white/40">Cuts dead air and filler words out, stitches what's left together, captions it, adds transitions, a color grade, and camera-flicker cuts — free, runs on this device, no API key needed. You still get to review and tweak everything after.</div>

                  {/* FEATURE — "add templates." One-click named recipes —
                      each one just sets the same options below together. */}
                  <div>
                    <label className="text-[9px] text-white/40 block mb-1">Template</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {AUTO_EDIT_TEMPLATES.map(t => (
                        <button
                          key={t.id}
                          onClick={() => applyTemplate(t.id)}
                          title={t.description}
                          className={"px-2 py-2 rounded-lg text-[10px] font-semibold border text-left transition " + (autoEditTemplateId === t.id ? "border-purple-500 bg-purple-900/40 text-purple-200" : "border-white/10 text-white/50 hover:text-white/80 hover:border-white/25")}
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* FEATURE — "describe in text what I want... discern and
                      edit the video... without an API key." Real, but
                      keyword-matched, not an LLM — matched phrases show up
                      in the completion toast so it's never a black box. */}
                  <div>
                    <label className="text-[9px] text-white/40 block mb-1">Describe the vibe (optional — matched to presets, no API key)</label>
                    <textarea
                      value={autoEditPrompt}
                      onChange={e => setAutoEditPrompt(e.target.value)}
                      placeholder='e.g. "fast, energetic, MrBeast captions" or "calm cinematic reveal, no flicker"'
                      rows={2}
                      className="ve-input w-full bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-white placeholder-white/25 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[9px] text-white/40 block mb-1">Captions from</label>
                      <select value={captionProvider} onChange={e => setCaptionProvider(e.target.value as CaptionProvider)} className="ve-select w-full bg-black/30 border border-white/10 rounded-lg px-1.5 py-1.5 text-white">
                        {CAPTION_PROVIDERS.map(p => <option key={p.id} value={p.id} className="bg-black">{p.label}{!p.keyFrom(settings) ? " (no key)" : ""}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-white/40 block mb-1">Caption template</label>
                      <select value={autoEditCaptionStyle} onChange={e => setAutoEditCaptionStyle(e.target.value)} className="ve-select w-full bg-black/30 border border-white/10 rounded-lg px-1.5 py-1.5 text-white">
                        {CAPTION_STYLES.map(s => <option key={s.id} value={s.id} className="bg-black">{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  {!getCaptionApiKey(captionProvider) && (
                    <div className="text-[10px] text-yellow-400/80">No key for this provider yet — Auto-Edit will still cut dead space, just without captions.</div>
                  )}
                  {/* FEATURE — "auto editing... adding transitions, effects,
                      camera flickers." These three apply automatically every
                      time Run Auto-Edit fires below — not separate manual
                      steps the owner has to do per-clip afterward. */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <div className="grid grid-cols-2 gap-1.5 items-end">
                      <label className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer py-1.5">
                        <input type="checkbox" checked={autoEditAddTransitions} onChange={e => setAutoEditAddTransitions(e.target.checked)} className="accent-purple-600 w-3.5 h-3.5 flex-shrink-0" />
                        Auto-add transitions
                      </label>
                      <label className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer py-1.5">
                        <input type="checkbox" checked={cameraFlickerEnabled} onChange={e => setCameraFlickerEnabled(e.target.checked)} className="accent-purple-600 w-3.5 h-3.5 flex-shrink-0" />
                        Camera flicker at cuts
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-[9px] text-white/40 block mb-1">Color grade (applied to every clip)</label>
                        <select value={autoEditColorLook} onChange={e => setAutoEditColorLook(e.target.value)} className="ve-select w-full bg-black/30 border border-white/10 rounded-lg px-1.5 py-1.5 text-white">
                          {COLOR_LOOKS.map(l => <option key={l.id} value={l.id} className="bg-black">{l.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] text-white/40 block mb-1">Audio effect (applied to every clip)</label>
                        <select value={autoEditAudioEffect} onChange={e => setAutoEditAudioEffect(e.target.value)} className="ve-select w-full bg-black/30 border border-white/10 rounded-lg px-1.5 py-1.5 text-white">
                          {SOUND_EFFECTS.map(s => <option key={s.id} value={s.id} className="bg-black">{s.name}</option>)}
                        </select>
                      </div>
                    </div>
                    {/* FEATURE — "asks you... how long" (Social page's Auto-
                        Edit wizard). See fitClipsToDuration in videoEditor.ts
                        — speeds up (real ffmpeg setpts/atempo) to fit, and
                        trims from the end only if speed alone can't get
                        there. "No limit" (default) never touches length. */}
                    <div>
                      <label className="text-[9px] text-white/40 block mb-1">Target length</label>
                      <div className="grid grid-cols-4 gap-1">
                        {[{ v: null, l: "No limit" }, { v: 15, l: "15s" }, { v: 30, l: "30s" }, { v: 60, l: "60s" }].map(opt => (
                          <button key={opt.l} onClick={() => setAutoEditTargetDurationSec(opt.v)} className={"py-1.5 rounded-lg text-[10px] font-semibold border transition " + (autoEditTargetDurationSec === opt.v ? "bg-purple-900/50 border-purple-600/60 text-purple-200" : "bg-black/30 border-white/10 text-white/50 hover:border-white/25")}>
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* FEATURE — "you don't have to stay inside that
                        page... notify you... send an email." Progress
                        shows on the Social page while this runs (see
                        autoEditJobStore.ts) whether or not this modal
                        stays open — this just adds an email on top for a
                        run that takes a while. */}
                    <label className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer">
                      <input type="checkbox" checked={autoEditEmailOnDone} onChange={e => setAutoEditEmailOnDone(e.target.checked)} className="accent-purple-600 w-3.5 h-3.5 flex-shrink-0" />
                      Email me when it's ready
                    </label>
                  </div>
                  <button onClick={startAutoEditFlow} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-purple-900/40 hover:bg-purple-900/60 border border-purple-600/50 text-purple-200 text-xs font-semibold transition">
                    <Sparkles size={13} />Run Auto-Edit
                  </button>
                </div>
                {hasApiKey && (
                  <button onClick={doAutoEditWithApi} disabled={autoEditing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-950/30 hover:bg-purple-900/40 border border-purple-700/40 text-purple-300 text-xs font-semibold transition disabled:opacity-40">
                    <Sparkles size={13} />{autoEditing ? "Submitting…" : "Auto-Edit with AI (uses your configured video API)"}
                  </button>
                )}
                {!hasApiKey && (
                  <div className="text-[10px] text-white/30 text-center">
                    Want fully automated AI editing? Add a video-editing API key in Settings → Integrations to unlock "Auto-Edit with AI" — optional, uses your own account.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export row */}
          <div className="flex-shrink-0 px-3 py-2.5 border-t border-white/10 space-y-2">
            <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer justify-center">
              <input type="checkbox" checked={saveAsDraftOnly} onChange={e => setSaveAsDraftOnly(e.target.checked)} className="accent-brand-600" />
              Save as a draft — don't open the post composer
            </label>
            <GBtn onClick={doExport} disabled={clips.length === 0} className="w-full !justify-center !py-3">
              {saveAsDraftOnly ? "Render & Save Draft" : "Render & Use This Video"}
            </GBtn>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(editor, document.body);
}
