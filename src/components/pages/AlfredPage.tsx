// auto-extracted from CRM Starter monolith
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  LayoutDashboard, Users, FileText, Briefcase, Bot, BarChart3,
  Settings, Bell, Menu, X, Plus, Search, Edit, Trash2, Send,
  DollarSign, TrendingUp, CheckCircle, Clock, MapPin, Phone, Mail,
  Calendar, AlertTriangle, Truck, Receipt, FlaskConical, MessageSquare,
  Sun, Moon, Download, Undo2, Redo2, Volume2, Play, Cloud, Star,
  Award, Target, Shield, Key, Eye, EyeOff, Save, ChevronRight,
  ChevronLeft, GripVertical, Tag, Copy, Ban, RefreshCw, Percent,
  CreditCard, Repeat, XCircle, Activity, Zap, UserCheck, AlertCircle,
  Clipboard, Heart, Dumbbell, Droplet, Smile, Flame, Wind, Snowflake,
  Globe, Share2, Trophy, ExternalLink, Workflow, ToggleLeft, ToggleRight,
  Navigation, TrendingDown, PieChart as PieIcon, Package, Wrench,
  CheckSquare, Route, Users2, Layers, ArrowRight, BarChart2, Filter,
  Paperclip, ImageIcon, FileImage, MoreVertical, Mic, Upload, Link, Lock, User, Sparkles, PhoneOff, Pause, MicOff, ChevronDown, Maximize2, Square
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line,
  ComposedChart, Legend
} from "recharts";
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, withTimeout, withTimeoutRetry, reconcileCrewAfterAssign, getPollIntervalMs, buildJobCalendarDescription, mediaSrc, computeDiscountsTotal } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell, emailButton, logOutboundSmsToInbox, getFreshOwnerGoogleToken } from "../../lib/messaging";
import { fetchCalendarEvents, createGCalEvent, updateGCalEvent, deleteGCalEvent } from "../../lib/googleApi";
import { seedWeather } from "../../lib/weather";
import { sendPushNotification } from "../../lib/push";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES, automationFromTemplate } from "../../lib/seed";
import { callModel, MODELS, parseRateLimitError } from "../../lib/api";
import { readImportFile } from "../../lib/spreadsheetFile";
import { readAttachmentFully, LIST_KINDS, KIND_LABEL } from "../../lib/attachmentReader";
import { fetchGoogleSheetRows, GOOGLE_SHEET_URL } from "../../lib/googleSheet";
import { browserRecognizerUsable, markBrowserRecognizerBroken, RECOGNIZER_FATAL, recordVoice, transcribeAudio, canRecordAudio } from "../../lib/voiceCapture";
import { readAsTable, recordsFromTable, describeColumns, extractRecordsWithAI, buildImportPlan, planSummary, runImportPlan, type ImportPlan } from "../../lib/bulkImport";
import { supabase, getStoredGoogleConnection } from "../../lib/supabase";
import { runAlfredHealthCheck } from "../ui/AlfredHealthPanel";
import { searchCustomers as auditSearch, findDuplicateCustomers, customersMissingInfo, filterCustomers } from "../../lib/customerAudit";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { useIsMobile } from "../../hooks/useIsMobile";
import { usePollGate } from "../../hooks/usePollGate";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";
import { AlfredErrorPopup } from "../ui/AlfredErrorPopup";
import { classifyAlfredError, type AlfredError } from "../../lib/alfredErrors";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { PBar } from "../ui/PBar";
import { PageFade } from "../ui/PageFade";
import { TimeframeSelector } from "../ui/TimeframeSelector";
import { AddressAutocomplete } from "../ui/AddressAutocomplete";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { CustomerModal } from "../ui/CustomerModal";
import { CustomerDetail } from "../ui/CustomerDetail";
import { CustomerAnalytics } from "../ui/CustomerAnalytics";
import { EstimateBuilder } from "../ui/EstimateBuilder";
import { EstimatePreview } from "../ui/EstimatePreview";
import { JobDetailModal } from "../ui/JobDetailModal";
import { PipelineScrollContainer } from "../ui/PipelineScrollContainer";
import { SwipeableCard } from "../ui/SwipeableCard";
import { ReviewMonitor } from "../ui/ReviewMonitor";
import { ReviewLandingPage } from "../ui/ReviewLandingPage";
import { ReviewPreview } from "../ui/ReviewPreview";
import { VisualWorkflowBuilder } from "../ui/VisualWorkflowBuilder";
import { AutomationEditor } from "../ui/AutomationEditor";
import { VoiceMicButton } from "../ui/VoiceMicButton";
import { DocumentVault } from "../ui/DocumentVault";
import { ESignatureStep } from "../ui/ESignatureStep";
import { CACCalculator } from "../ui/CACCalculator";
import { MileageUpdateModal } from "../ui/MileageUpdateModal";
import { VehicleModal } from "../ui/VehicleModal";
import { MaintenanceModal } from "../ui/MaintenanceModal";
import { SocialCalendar } from "../ui/SocialCalendar";
import { BulkPhotoUpload } from "../ui/BulkPhotoUpload";
import { ReviewToGraphic } from "../ui/ReviewToGraphic";
import { ABTestPanel } from "../ui/ABTestPanel";
import { CampaignScheduler } from "../ui/CampaignScheduler";
import { PinSettings } from "../ui/PinSettings";
import { ServiceCatalogSection } from "../ui/ServiceCatalogSection";
import { TemplateEditor } from "../ui/TemplateEditor";
import { AIModelsSection } from "../ui/AIModelsSection";
import { WeeklyBusinessReview } from "../ui/WeeklyBusinessReview";
import { WeeklyReflectionTab } from "../ui/WeeklyReflectionTab";

// FIX 6 — `personalities` (lib/utils.ts) is an ARRAY keyed by each entry's
// `id` field ("drillsergeant"/"butler"/"quietpro"/"savage"), not by array
// position. This file used to look personalities up with plain index syntax
// ((personalities as any)[personality]) and build the switcher itself via
// Object.entries(personalities) — on an array, Object.entries yields numeric-
// string keys ("0","1","2","3"), not each entry's real id. personality state
// defaults to "drillsergeant" (App.tsx), so even the DEFAULT personality
// never matched anything looked up this way, and clicking the switcher only
// ever set personality to "0".."3", which matched even less. The single
// visible symptom was that Alfred's system prompt silently became
// "undefined" + (shared context) regardless of which personality was
// selected — the personality never actually reached the model at all.
const getPersonality = (id: string) => personalities.find(p => p.id === id) || personalities[0];

// FEATURE — "I don't want to use ElevenLabs, I want something actually
// free... I think Google has a free one." The browser's own SpeechSynthesis
// API (window.speechSynthesis) IS that — genuinely free, no API key, no
// signup, built into every Chromium/Edge/Safari browser. On many systems
// (ChromeOS, Android, and some Windows/Chrome installs) it surfaces actual
// Google-branded network voices (e.g. "Google UK English Male") for free;
// on others it surfaces the OS's own built-in voices (Windows ships decent
// "Microsoft Ryan"/"Microsoft Hazel" UK voices on Windows 10/11). Either
// way, a real en-GB voice for a "British butler" feel, at zero cost,
// requires querying whatever's ACTUALLY installed at runtime rather than
// hardcoding one voice name — availability genuinely varies by OS/browser,
// confirmed via research rather than assumed.
let cachedVoicesPromise: Promise<SpeechSynthesisVoice[]> | null = null;
const loadSpeechVoices = (): Promise<SpeechSynthesisVoice[]> => {
  if (typeof window === "undefined" || !window.speechSynthesis) return Promise.resolve([]);
  if (cachedVoicesPromise) return cachedVoicesPromise;
  cachedVoicesPromise = new Promise(resolve => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) { resolve(existing); return; }
    // Chrome loads the voice list asynchronously — getVoices() can come back
    // empty on the very first call even though voices exist.
    window.speechSynthesis.onvoiceschanged = () => resolve(window.speechSynthesis.getVoices());
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1200); // fallback if the event never fires
  });
  return cachedVoicesPromise;
};
// BUG FIX — "it's a female British voice, I want a male British voice."
// Two real bugs: (1) /google/i was checked BEFORE any gender check, so
// whichever Google voice happened to exist won regardless of gender — on
// a system whose only Google en-GB voice is "Google UK English Female,"
// that's exactly what got picked. (2) /male/i.test("Google UK English
// Female") is ALSO true — "male" is literally a substring of "female" —
// so even the gender check itself could misfire on a female voice name.
// Fixed by checking "female" first (real exclusion) and only then
// matching "male"/known-male voice names, with a preference for a
// voice whose name suggests higher quality ("natural"/"neural" — some
// Windows 11 OneCore voices are explicitly labeled this way) since that
// also helps with "make it sound less robotic."
const selectBritishVoice = async (): Promise<SpeechSynthesisVoice | null> => {
  const voices = await loadSpeechVoices();
  const enGB = voices.filter(v => v.lang?.toLowerCase().startsWith("en-gb"));
  if (enGB.length === 0) return null;
  const isFemale = (name: string) => /female/i.test(name);
  const isMale = (name: string) => !isFemale(name) && /\bmale\b|ryan|george|daniel|arthur|oliver|thomas/i.test(name);
  const isNatural = (name: string) => /natural|neural/i.test(name);
  const isGoogle = (name: string) => /google/i.test(name);
  return enGB.find(v => isMale(v.name) && isNatural(v.name))
    || enGB.find(v => isMale(v.name) && isGoogle(v.name))
    || enGB.find(v => isMale(v.name))
    || enGB.find(v => isGoogle(v.name) && !isFemale(v.name))
    || enGB.find(v => !isFemale(v.name))
    || enGB[0];
};

// Refactored out of the old inline block so it can be reused for both a
// normal chat reply (ttsEnabled toggle) and Voice Mode's hands-free loop —
// returns a Promise that resolves once speech genuinely finishes, so a
// caller (Voice Mode) can reliably resume listening only after Alfred is
// actually done talking, not immediately after firing .speak().
const speakAloud = (text: string, elevenlabsKey?: string): Promise<void> => new Promise(async (resolve) => {
  const ttsText = text.replace(/\*\*?([^*]+)\*\*?/g, "$1").replace(/\n+/g, " ").slice(0, 500);
  if (elevenlabsKey) {
    try {
      const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice
      const ttsRes = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + voiceId, {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": elevenlabsKey },
        body: JSON.stringify({ text: ttsText, model_id: "eleven_flash_v2_5", voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
      });
      if (ttsRes.ok) {
        const blob = await ttsRes.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
        return;
      }
    } catch { /* fall through to the free browser voice below */ }
  }
  if (typeof window === "undefined" || !window.speechSynthesis) { resolve(); return; }
  const utterance = new SpeechSynthesisUtterance(ttsText);
  const britishVoice = await selectBritishVoice();
  if (britishVoice) utterance.voice = britishVoice;
  // Rate history: 0.94 (slower, "butler" cadence) -> 1.15 (owner wanted
  // faster) -> 1.08 (owner said 1.15 was a little too fast — split the
  // difference, still noticeably quicker than the original 0.94). pitch
  // stays slightly lowered for the personality. Real, honest limit: this
  // is still the browser's built-in engine, not a neural TTS model —
  // these are the actual knobs it exposes.
  utterance.rate = 1.08;
  utterance.pitch = 0.92;
  utterance.onend = () => resolve();
  utterance.onerror = () => resolve();
  window.speechSynthesis.speak(utterance);
});

// Deposit fields for an estimate/invoice Alfred creates (same shape the
// estimate builder saves). The owner must decide whether the customer may
// also pay in full — never guess; the model relays the question.
const alfredDepositFields = (inputs: any, total: number): { depositRequired: number; depositType: string; depositMandatory: boolean } | { error: string } => {
  const pct = Number(inputs?.depositPercent) || 0, amt = Number(inputs?.depositAmount) || 0;
  if (!pct && !amt) return { depositRequired: 0, depositType: "amount", depositMandatory: false };
  if (pct && amt) return { error: "Use depositPercent OR depositAmount, not both." };
  if (pct < 0 || pct > 100) return { error: "depositPercent must be between 0 and 100." };
  if (amt < 0 || amt > total) return { error: "The deposit can't be more than the total." };
  if (typeof inputs?.depositMandatory !== "boolean") return { error: "NEEDS_CLARIFICATION — nothing was created yet. Ask the user: \"Should they only be able to pay the deposit now, or choose between paying the deposit now or paying in full?\" Then call again with depositMandatory true (deposit only) or false (their choice)." };
  return pct ? { depositRequired: pct, depositType: "percent", depositMandatory: inputs.depositMandatory } : { depositRequired: amt, depositType: "amount", depositMandatory: inputs.depositMandatory };
};

export function AlfredPage({ conversations, setConversations, activeConvId, setActiveConvId, memory = [], setMemory, personality, setPersonality, apiKey, openSettings, toast, jobs = [], setJobs, estimates = [], setEstimates, customers = [], setCustomers, employees = [], automations = [], setAutomations = () => {}, stats, setWins, goals = [], setGoals, setSettings, settings = {} as AppSettings, modelStatus = {}, setModelStatus = () => {}, onNav, onSpotlight, expenses = [], setExpenses, entries = [], wins = [], chemicals = [], ownerId = "", reviews = [], setReviews = () => {}, vehicles = [], setVehicles = () => {}, maintenance = [], setMaintenance = () => {}, trainingModules = [], services = [], onNotify, isActivePage = true, currentPageName = "alfred", cursorContext = "", onResolveScreenHighlight }: { conversations?: any; setConversations?: any; activeConvId?: any; setActiveConvId?: any; memory?: any; setMemory?: any; personality?: any; setPersonality?: any; apiKey?: any; openSettings?: any; toast?: any; jobs?: any; setJobs?: any; estimates?: any; setEstimates?: any; customers?: any; setCustomers?: any; employees?: any; automations?: any; setAutomations?: any; stats?: any; setWins?: any; goals?: any; setGoals?: any; setSettings?: any; settings?: AppSettings; modelStatus?: any; setModelStatus?: any; onNav?: any; onSpotlight?: (step: { page: string; type?: string; id?: string; label?: string }) => void; expenses?: any[]; setExpenses?: any; entries?: any[]; wins?: any[]; chemicals?: any[]; ownerId?: string; reviews?: any[]; setReviews?: any; vehicles?: any[]; setVehicles?: any; maintenance?: any[]; setMaintenance?: any; trainingModules?: any[]; services?: any[];
  // FEATURE — "keep talking to it while looking through the CRM... Alfred
  // should have the context of the screen you're on." isActivePage drives
  // BOTH the poll-gating (see shouldPollAlfred usages below — this file's
  // conversation/memory sync used to rely entirely on unmounting when the
  // owner left this page to stop polling; now that App.tsx keeps this
  // component mounted so Voice Mode can survive navigation, that same
  // egress-conscious behavior has to be an explicit check instead) AND
  // whether the normal chat UI portals into #alfred-mount-point at all.
  onNotify?: (n: { text: string; detail?: string }) => void;
  isActivePage?: boolean;
  currentPageName?: string;
  cursorContext?: string;
  // FEATURE — "highlight it in a glowing red... 'you mean this?'" App.tsx
  // owns the real DOM reference the cursor is currently over (see its own
  // cursorTargetElRef) — this lets confirm_screen_reference (below) ask it
  // to draw a highlight around whatever that is RIGHT NOW and hand back a
  // fresh description, sampled at call time so re-asking after the owner
  // moves the mouse ("no, this") naturally resolves to the new target.
  onResolveScreenHighlight?: () => { ok: boolean; description: string };
}) {
  const [input, setInput] = useState("");
  const [voiceMode, setVoiceMode] = useState<"dictate" | "note">("dictate");
  const [loading, setLoading] = useState(false);
  // FIX 1 — mobile layout. Sidebar defaults OPEN on desktop (typical chat-app
  // layout) but CLOSED on mobile (< 768px) so it doesn't eat the whole screen;
  // toggled by the hamburger button in the chat header either way.
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [convSearch, setConvSearch] = useState("");
  const [editingTitle, setEditingTitle] = useState(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [, forceTick] = useState(0);
  // Tick every second when any model is locked out so UI countdowns stay fresh
  useEffect(() => {
    if (!modelStatus || Object.values(modelStatus).every((s: any) => !s?.lockedUntil || s.lockedUntil < Date.now())) return;
    const h = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(h);
  }, [modelStatus]);

  // AUDIT FIX — the morning-briefing trigger (fires once per day 6-11am) has
  // been MOVED to App.tsx, for the exact same reason the general check-in
  // system was already relocated (see the FIX 14 comment below): this
  // component only mounts when page === "alfred", so a "proactive 6-11am
  // briefing" that lived here could only ever fire while the owner already
  // had Alfred open — never actually proactive. See App.tsx's own effect
  // (alfredBriefingDate gating, same shape as alfredCheckinDate) for the
  // real implementation; the conversation it creates lands in
  // alfredConversations and is picked up by this page's own Supabase sync
  // the next time Alfred is opened, same as check-ins.

  // Proactive afternoon check-in — fires at 2pm if no jobs completed today
  useEffect(() => {
    const key = "crm.alfredAfternoonDate";
    const lastDate = localStorage.getItem(key);
    const todayStr = today();
    const hour = new Date().getHours();
    if (lastDate === todayStr) return;
    if (hour < 14 || hour > 16) return;
    const completedToday = jobs.filter(j => j.scheduledDate === todayStr && j.status === "completed");
    const scheduledToday = jobs.filter(j => j.scheduledDate === todayStr && j.status === "scheduled");
    if (completedToday.length > 0 || scheduledToday.length === 0) return; // no nudge needed
    localStorage.setItem(key, todayStr);
    setTimeout(() => {
      const msg = "⏰ AFTERNOON CHECK-IN\n\nYou have " + scheduledToday.length + " job" + (scheduledToday.length !== 1 ? "s" : "") + " scheduled today but none completed yet.\n\n" + scheduledToday.map(j => { const c = customers.find(x => x.id === j.customerId); return "• " + (c ? c.firstName : "?") + " — " + (j.address || "").split(",")[0]; }).join("\n") + "\n\nEverything ok? Update job status or text /status. Alfred watching.";
      const newConv = { id: uid(), title: "Afternoon Check-in", personality: "drill", messages: [{ id: uid(), role: "alfred", content: msg, timestamp: Date.now() }], createdAt: Date.now(), updatedAt: Date.now() };
      setConversations(prev => [newConv, ...prev]);
    }, 1000);
  }, []); // eslint-disable-line

  // FIX 14 — the general proactive check-in system (originally added here as
  // FIX 7) has been MOVED to App.tsx. This component only mounts when
  // page === "alfred", so a check-in effect that lived here could only ever
  // fire while the owner was already looking at Alfred — never actually
  // "proactive." App.tsx is mounted for the whole session regardless of
  // page, so it can genuinely check in unprompted; see the effect there
  // (keyed off crmUserId, same alfredCheckinDate/alfredCheckinsToday/
  // alfredLastCheckinAt gating in settings) for the real implementation.
  const [showSlash, setShowSlash] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCat, setNewMemoryCat] = useState("general");
  const [memFilter, setMemFilter] = useState("all");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  // FEATURE — "text/upload a photo or PDF to Alfred (in the CRM chat too)
  // and say 'upload this to this client.'" Remembers the most recently
  // uploaded file's real Storage URL so a later "attach that to the
  // Millers" doesn't need the owner (or the model) to know/repeat a raw
  // URL — attach_file_to_customer below just reads this directly.
  const lastAttachedFileRef = useRef<{ url: string; fileName: string } | null>(null);

  // FEATURE — "upload a PDF, tell Alfred to summarize it, then schedule it
  // and assign employees" / "improve tool reasoning with PDF files, photos,
  // etc." The single-file analyzer below extracts a file's full content
  // once, right when it's attached — but the owner's actual instruction for
  // what to DO with it (summarize / schedule / just save) usually comes in
  // a SEPARATE follow-up message, after the intent-guessing auto-analysis
  // already ran. This holds that extracted content in memory (never in
  // `conversations` state, so it never syncs to Supabase — see the backend-
  // storage comment on upsertConversation) so send()'s system prompt can
  // hand it to the model for a few turns after attach, then it expires —
  // same "don't let it pile up in the backend or even in memory" principle
  // as the screenshot preview purge below, just for extracted text instead
  // of image bytes.
  const recentFileContextRef = useRef<{ fileName: string; extractedText: string; attachedAt: number; turnsUsed: number } | null>(null);

  // BUG FIX (user report) — "it says I need an Anthropic API key for
  // screenshots. We don't need that — any API key you use, specifically
  // OpenRouter, should work too." The screenshot/receipt/PDF analyzer used
  // to hardcode modelId:"claude" and refuse to run without that exact key,
  // even when the owner had a different provider configured and working
  // fine for everything else. functions/api/call-model.ts now actually
  // translates the image content block per-provider instead of silently
  // dropping it (see that file's own comment), so any of these can
  // genuinely see the image — this just picks whichever one the owner
  // actually has a key for, in the order most likely to handle vision
  // well (Groq/Mistral/NVIDIA's configured free models here are text-only,
  // so left out of this list on purpose).
  const VISION_MODEL_PRIORITY = ["claude", "openai", "gemini", "openrouter"];
  const getVisionModelChain = (opts?: { pdf?: boolean }): Array<{ modelId: string; apiKey: string }> => {
    const keys = (settings.modelKeys || {}) as Record<string, string>;
    // PDFs are only actually parsed by Claude/Gemini server-side (see
    // call-model.ts) — try those first for a PDF, but still fall back to
    // whatever else is configured rather than hard-failing (it'll just get
    // the "can't read PDFs directly" text stub, same as before).
    const order = opts?.pdf ? ["claude", "gemini", "openai", "openrouter"] : VISION_MODEL_PRIORITY;
    return order.filter(id => keys[id]).map(id => ({ modelId: id, apiKey: keys[id] }));
  };
  // BUG FIX (user report) — "Couldn't analyze those screenshots. HTTP 503.
  // This model is currently experiencing high demand." A single hardcoded
  // vision call had no fallback at all — a transient overload on whichever
  // provider happened to be first in the chain (usually Claude) dead-ended
  // the whole attachment even when the owner had a second/third vision-
  // capable key configured. Try every configured vision-capable provider,
  // in priority order, before actually giving up.
  const isRetryableVisionError = (err: any): boolean => {
    const status = err?.status;
    const msg = String(err?.message || "");
    // BUG FIX (user report) — "Couldn't analyze those screenshots —
    // Screenshot analysis timed out." A timeout wasn't treated as
    // retryable, so with only one vision-capable key configured (no other
    // provider to fall back to) a single slow response — analyzing 3
    // photos with a thorough per-job extraction prompt genuinely can take
    // a while — was an instant, final failure with zero retry.
    return status === 503 || status === 529 || status === 429 || /overloaded|high demand|try again later|rate.?limit|timed out/i.test(msg);
  };
  const callVisionModel = async (payload: any, timeoutMs: number, label: string, opts?: { pdf?: boolean; externalSignal?: AbortSignal }): Promise<any> => {
    // BUG FIX (user report) — "it's not working... it's something wrong on
    // our end." withTimeout is a plain Promise.race: when the timer wins,
    // it makes THIS function move on, but it never actually cancels the
    // underlying fetch inside callModel — that request keeps running in
    // the background, still holding a real browser connection. Splitting
    // screenshot analysis into one call per image (a recent fix for a
    // different timeout issue) meant MULTIPLE of these could be in flight
    // at once after a timeout — a same-provider retry on top of that could
    // leave 3-4 abandoned-but-still-running requests stacked up, eating
    // into the browser's small per-origin connection limit and starving
    // every request AFTER them (including the final send() call) — which
    // reads exactly like "never responds" even though each individual
    // timeout fired exactly on schedule. A real AbortController now
    // actually kills the request when its timeout hits, freeing the
    // connection immediately instead of leaving it to rot in the background.
    const chain = getVisionModelChain(opts);
    let lastErr: any = new Error("No vision-capable model configured.");
    for (const cand of chain) {
      // One same-provider retry on a transient overload/rate-limit before
      // moving on to the next configured provider — covers the common case
      // of only one vision-capable key being set, where there's nothing
      // else to fail over to. BUG FIX (user report — "sent 2 screenshots,
      // he said 'analyzing screenshot 1 of 2' and just sat there") —
      // OpenRouter doesn't need this client-side retry at all: call-
      // model.ts now already tries up to 3 different free vision models
      // server-side on ANY failure before giving up (see its own comment),
      // so retrying the whole thing again from here just doubles an
      // already-bounded wait for no benefit. Only retry client-side for
      // providers with no server-side fallback of their own.
      const maxAttempts = cand.modelId === "openrouter" ? 1 : 2;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // BUG FIX (user report) — "the stop button still does not work."
        // Screenshot/file analysis (this function) is the single slowest
        // part of any attach turn, and pressing Stop during it did nothing:
        // this AbortController was only ever wired to the timeout timer, not
        // to the owner's Stop button. externalSignal is that button's real
        // signal (see sendWithAttachments) — check it up front, and mirror
        // any abort onto this attempt's own controller so an in-flight fetch
        // is actually cancelled immediately, not just abandoned to run out
        // the clock.
        if (opts?.externalSignal?.aborted) throw Object.assign(new Error("Stopped."), { name: "AbortError" });
        const controller = new AbortController();
        const onExternalAbort = () => controller.abort();
        opts?.externalSignal?.addEventListener("abort", onExternalAbort);
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const result = await (callModel as any)({ ...payload, modelId: cand.modelId, apiKey: cand.apiKey, signal: controller.signal });
          clearTimeout(timer);
          return result;
        } catch (err: any) {
          clearTimeout(timer);
          if (opts?.externalSignal?.aborted) throw Object.assign(new Error("Stopped."), { name: "AbortError" });
          const normalizedErr = (err?.name === "AbortError" || controller.signal.aborted) ? new Error(label + " timed out") : err;
          lastErr = normalizedErr;
          if (attempt < maxAttempts - 1 && isRetryableVisionError(normalizedErr)) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          break;
        } finally {
          opts?.externalSignal?.removeEventListener("abort", onExternalAbort);
        }
      }
    }
    throw lastErr;
  };

  // FEATURE — mobile attach menu (Photo/Video vs Document), see the
  // composer's paperclip button below for the full reasoning.
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const mainAttachInputRef = useRef<HTMLInputElement>(null);
  // FEATURE — "only one button for the whole note STT, sending that note,
  // or voice mode." Replaces the old three separate controls (a text
  // label toggle, the mic record button, and a big standalone Voice Mode
  // button) that were cramping the composer — see the composer's mic
  // button below for the full reasoning.
  const [voiceMenuOpen, setVoiceMenuOpen] = useState(false);
  // Which recorder is open in the composer (picked from the mic menu). It
  // lives outside the menu so tapping elsewhere can't cut a recording off.
  const [voiceTool, setVoiceTool] = useState<null | "note" | "dictate">(null);
  // BUG FIX (user report) — "the second I attach [screenshots] it doesn't
  // let me send the message." The attach handlers used to reuse the same
  // `loading` state as a real model reply — the second that flipped true,
  // the composer's Send button swapped to Stop and the whole send() path
  // refused new messages (see send()'s `if (loading)` guard), locking the
  // owner out of typing/sending anything until the vision call finished
  // (up to 30-45s). Attachment analysis gets its own flag now — the typing
  // indicator still shows for it, but the real Send button stays live.
  const [attachAnalyzing, setAttachAnalyzing] = useState(false);
  // BUG FIX (user report) — "kept just showing and never responded." A
  // multi-screenshot analysis genuinely CAN take a while (per-image calls,
  // each with its own retry, especially on a slower/free provider like
  // OpenRouter) — but the typing indicator never changed, so a real,
  // bounded wait LOOKED indistinguishable from a true hang. Real progress
  // text now updates as each attachment is actually being worked on.
  const [attachProgressLabel, setAttachProgressLabel] = useState("");
  // FEATURE (user request) — "make it so he says different messages and it
  // changes every 5 seconds or so." A plain reply (loading, no attachment
  // involved) showed nothing but static bouncing dots the whole time — no
  // sense of activity at all. Rotates a random playful status word next to
  // the dots for the general "thinking" case; attachAnalyzing keeps its own
  // specific progress text (e.g. "Analyzing screenshot 1 of 2…") when one is
  // set, since that's more useful than a random word.
  const THINKING_WORDS = ["Dabbling", "Splunkering", "Noodling", "Percolating", "Rummaging", "Marinating", "Sifting", "Untangling", "Sketching", "Puzzling", "Wrangling", "Deciphering", "Sleuthing", "Contemplating", "Assembling", "Pondering", "Scheming", "Tinkering", "Calibrating", "Investigating", "Doodling", "Conjuring", "Mulling", "Brewing", "Wrestling"];
  const [thinkingWord, setThinkingWord] = useState(THINKING_WORDS[0]);
  useEffect(() => {
    if (!loading && !attachAnalyzing) return;
    setThinkingWord(w => { let next = w; while (next === w) next = THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)]; return next; });
    const id = setInterval(() => {
      setThinkingWord(w => { let next = w; while (next === w) next = THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)]; return next; });
    }, 5000);
    return () => clearInterval(id);
  }, [loading, attachAnalyzing]); // eslint-disable-line react-hooks/exhaustive-deps
  // BUG FIX (user report) — "it still sends the file... before I send the
  // message... should never send until you actually press send." Attaching
  // used to fire a real vision call and post messages to Alfred the instant
  // a file was picked. Now the attach handler only stages a local preview
  // here — the actual analysis + send only happens from sendMessage() once
  // the owner presses Send, and each attachment gets a remove (X) button.
  const [pendingAttachments, setPendingAttachments] = useState<Array<{ id: string; file: File; dataUrl: string; base64: string; mediaType: string; isPdf: boolean }>>([]);
  // Shared by the normal composer's attach input AND Voice Mode's own attach
  // button (see the voice-mode panel below) — both just stage into the same
  // pendingAttachments, no model call here at all.
  const stageFiles = async (filesList: File[]) => {
    if (filesList.length === 0) return;
    const room = 10 - pendingAttachments.length;
    if (room <= 0) { toast("Up to 10 attachments per message.", "yellow"); return; }
    const toRead = filesList.slice(0, room);
    if (filesList.length > toRead.length) toast(`Only ${toRead.length} more attachment${toRead.length !== 1 ? "s" : ""} fit — up to 10 per message.`, "yellow");
    const readOne = (file: File) => new Promise<{ id: string; file: File; dataUrl: string; base64: string; mediaType: string; isPdf: boolean }>((resolve, reject) => {
      const rr = new FileReader();
      rr.onload = ev => {
        const dataUrl = ev.target!.result as string;
        resolve({ id: uid(), file, dataUrl, base64: dataUrl.split(",")[1], mediaType: file.type || (/\.(csv|tsv|txt|xlsx|xlsm|vcf|vcard|json)$/i.test(file.name) ? "application/octet-stream" : "image/jpeg"), isPdf: file.type === "application/pdf" });
      };
      rr.onerror = reject;
      rr.readAsDataURL(file);
    });
    try {
      const loaded = await Promise.all(toRead.map(readOne));
      setPendingAttachments(prev => [...prev, ...loaded]);
    } catch {
      toast("Couldn't read that file — try again.", "red");
    }
  };

  // FEATURE (user report) — "if I attach files/photos and haven't sent it
  // yet and it sits there for a while... keep it in local storage... so it
  // doesn't time out too fast or Alfred can still access it." An unsent
  // draft (typed text and/or staged attachments) used to vanish on a
  // reload or fully closing the app — now persisted to localStorage.
  // File objects themselves can't be serialized, so only the already-read
  // dataUrl/base64 travels through storage; dataUrlToFile rebuilds a real
  // File from that on load (still needed for the attach_file_to_customer
  // upload path). Best-effort — several large photos can exceed a
  // browser's localStorage quota, in which case this just silently
  // doesn't persist, same fallback usePersistent's own localStorage calls
  // already rely on elsewhere in this app.
  const ALFRED_DRAFT_KEY = "crm.alfredDraft";
  const dataUrlToFile = (dataUrl: string, filename: string, mediaType: string): File => {
    const base64 = dataUrl.split(",")[1] || "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mediaType });
  };
  const [draftReady, setDraftReady] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ALFRED_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft?.text) setInput(draft.text);
        if (Array.isArray(draft?.attachments) && draft.attachments.length > 0) {
          setPendingAttachments(draft.attachments.map((a: any) => ({
            id: a.id, dataUrl: a.dataUrl, base64: a.base64, mediaType: a.mediaType, isPdf: a.isPdf,
            file: dataUrlToFile(a.dataUrl, a.fileName, a.mediaType),
          })));
        }
      }
    } catch { /* corrupt/blocked storage — just start with an empty draft */ }
    setDraftReady(true); // gates the save-effect below so it never fires with the pre-load empty state and wipes what we just read
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!draftReady) return;
    try {
      if (!input.trim() && pendingAttachments.length === 0) { localStorage.removeItem(ALFRED_DRAFT_KEY); return; }
      localStorage.setItem(ALFRED_DRAFT_KEY, JSON.stringify({
        text: input,
        attachments: pendingAttachments.map(a => ({ id: a.id, dataUrl: a.dataUrl, base64: a.base64, mediaType: a.mediaType, isPdf: a.isPdf, fileName: a.file.name })),
      }));
    } catch { /* quota exceeded or storage blocked — draft just won't persist this time */ }
  }, [input, pendingAttachments, draftReady]);

  // FEATURE — "no button to stop Alfred from responding mid-chat." One
  // AbortController per send() call, aborted by the Stop button — see
  // send()'s own use of this for how a stop is detected and reported
  // without falling over to the next model in the failover chain (that
  // would defeat the whole point of stopping).
  const currentAbortControllerRef = useRef<AbortController | null>(null);
  const stopGenerating = () => { currentAbortControllerRef.current?.abort(); };

  // FIX 2 — Alfred conversations sync with Supabase. Previously lived in
  // App.tsx keyed off the owner's session resolving, which meant it ran (or
  // didn't) regardless of whether this page was ever opened, and was hard to
  // verify from here. Moved to this component's own mount so opening Alfred
  // is what actually triggers the fetch (and the 5s poll stops the moment
  // the user navigates away instead of running for the whole app session).
  const [alfredConvsLoaded, setAlfredConvsLoaded] = useState(false);
  const alfredConvsSaveTimerRef = useRef<any>(null);
  // BUG FIX — the "⚡ Failed over to X" footer had no once-per-conversation
  // gate, so if the top-priority model keeps failing for a non-rate-limit
  // reason (never gets locked out, so every message re-attempts it from
  // scratch), the footer re-appended to EVERY reply in the conversation —
  // reads as broken even though the actual failover logic works correctly
  // each time. Show it once per conversation id, not once per message.
  const failoverNoticeShownRef = useRef<Set<string>>(new Set());
  // FEATURE — "a real continuous hands-free conversation loop... like
  // ChatGPT's voice mode." voiceModeOpen drives the full-screen overlay;
  // voiceModeOpenRef mirrors it for use inside send()'s TTS block and
  // other async closures that shouldn't rely on a possibly-stale render
  // closure. voiceModeState drives the orb's listening/thinking/speaking
  // animation. ttsEndCallbackRef is how send()'s TTS completion hands
  // control back to the listen-loop below — set right before each call to
  // send(), cleared/replaced each turn.
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const voiceModeOpenRef = useRef(false);
  const [voiceModeState, setVoiceModeState] = useState<"listening" | "thinking" | "speaking" | "paused">("listening");
  const [voiceModeTranscript, setVoiceModeTranscript] = useState("");
  const voiceModeTranscriptRef = useRef("");
  const voiceModeKeepGoingRef = useRef(false);
  const voiceModeRecognitionRef = useRef<any>(null);
  const ttsEndCallbackRef = useRef<(() => void) | null>(null);
  // BUG FIX — "said 'can you hear me' and it never responded" + "the
  // conversation ended up in Notifications, not the voice chat." Root
  // cause: processVoiceTurn (below) calls send(text) directly, but send is
  // a plain closure recreated every render, closing over THAT render's
  // activeId/appendMessage/active. The listening turn's SpeechRecognition
  // handlers are attached inside startVoiceListeningTurn — itself captured
  // by whichever render was active the moment it was called (openVoiceMode
  // calls it synchronously, in the SAME tick as setActiveConvId(sandboxId)
  // — before that state update has actually committed). So the very FIRST
  // utterance of a call invoked a STALE send() still bound to whatever
  // conversation was active before Voice Mode opened (here, the
  // "Alfred Notifications" system thread) — the reply really was
  // generated, just appended to the wrong, invisible conversation, and
  // something about acting on that unexpected thread's shape kept it from
  // ever reaching the TTS block, hence the ~45s hang. sendRef always holds
  // the send from the MOST RECENT render (synced every render, no deps) —
  // processVoiceTurn calls through it instead of the closed-over send, so
  // it's never more than one render stale regardless of when the actual
  // callback fires.
  const sendRef = useRef<(overrideText?: string) => void>(() => {});
  // FEATURE (user report) — "while I'm on voice chat with Alfred, let me
  // manually send messages, photos, or files to give context." Same
  // stale-closure reasoning as sendRef above — processVoiceTurn calls
  // through this instead of a closed-over sendMessage so an attach made
  // moments before a voice turn fires is always the current one.
  const sendMessageRef = useRef<(overrideText?: string) => void>(() => {});
  // FEATURE — "interrupt Alfred's sentence, tell it to resume what it was
  // saying, hold up, or have a mute button." voiceTurnIdRef is a
  // cancellation token: every genuinely NEW turn (a normal reply, or a
  // barge-in that abandons the current one) increments it, and any
  // in-flight async completion (speakAloud resolving, a safety timeout)
  // checks its captured id against the current one before acting — a
  // stale completion from an abandoned turn is simply ignored instead of
  // needing every browser TTS event (onend/onerror on cancel/pause are
  // inconsistent across browsers) to fire in a predictable order.
  const voiceTurnIdRef = useRef(0);
  // BUG FIX — "shows an old conversation instead of a new one." Voice Mode
  // used to just reuse whatever TEXT conversation happened to be active, so
  // opening it mid-way through an old chat dumped that chat's whole history
  // into the transcript panel. Every voice call now switches into one
  // persistent "Alfred Voice" sandbox conversation instead (see
  // openVoiceMode — deliberately NOT a new conversation per call, so it
  // keeps growing turn over turn across calls the way real memory should).
  // This ref just remembers which TEXT conversation was active right
  // before the call started, purely so closeVoiceMode can switch back to
  // it once the call ends — it no longer scopes what context send() sees
  // (see crossConversationContext, which looks at ALL recently-touched
  // text conversations, not just this one).
  const voicePrevConvIdRef = useRef<string | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const voiceMutedRef = useRef(false);
  const interruptRecognitionRef = useRef<any>(null);
  // FEATURE — "very smooth animation where it pops up" + "minimizable so
  // you can keep talking to it while looking through the CRM." mounted
  // drives the entrance/exit transition (same pattern Modal.tsx uses —
  // mount first, THEN flip visible a tick later so the transition
  // actually animates instead of snapping straight to its end state).
  // voiceModeMinimized collapses the full overlay to a small bubble while
  // the conversation keeps running underneath — scoped to this page for
  // now (see the minimize button's own comment for what's deliberately
  // NOT built yet: dragging it around, and it following you to other
  // CRM pages).
  const [voiceModeMounted, setVoiceModeMounted] = useState(false);
  const [voiceModeMinimized, setVoiceModeMinimized] = useState(false);
  // FEATURE (user report) — "while I'm on voice chat with Alfred, let me
  // manually send messages, photos, or files to give context." Voice Mode
  // portals independently of the normal composer (it has to survive
  // navigating to other CRM pages — see mountEl's own comment), so it needs
  // its own attach input/menu and a small text field, both feeding the SAME
  // pendingAttachments/sendMessage pipeline the normal composer uses.
  const [voiceAttachMenuOpen, setVoiceAttachMenuOpen] = useState(false);
  const [voiceTextOpen, setVoiceTextOpen] = useState(false);
  const [voiceManualText, setVoiceManualText] = useState("");
  const voiceModeMinimizedRef = useRef(false);
  useEffect(() => { voiceModeMinimizedRef.current = voiceModeMinimized; }, [voiceModeMinimized]);
  // FEATURE — "drag it, hold it in, almost like a FAB button, and move it
  // to the bottom middle of the screen and let go, which ends the voice
  // conversation... right-click to end it." Pointer events (not separate
  // mouse/touch handlers) so the same drag works with a mouse on PC and a
  // finger on mobile alike. bubblePos is null until the owner actually
  // drags it once — null means "use the default bottom-right corner,"
  // not "dragged to (0,0)."
  const BUBBLE_SIZE = 64;
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number } | null>(null);
  const [bubbleDragging, setBubbleDragging] = useState(false);
  const [overDropZone, setOverDropZone] = useState(false);
  // FEATURE — "right-click it, press mute or unmute, and use other quick
  // actions." Right-click used to end the call outright with no way back;
  // now it opens a small glass quick-actions menu instead (reopen, mute
  // toggle, pause/resume, end call) — a real click on the bubble itself
  // (no menu) still reopens the full overlay directly, unchanged.
  const [bubbleMenu, setBubbleMenu] = useState<{ x: number; y: number } | null>(null);
  const bubbleDragStateRef = useRef<{ startClientX: number; startClientY: number; startLeft: number; startTop: number; moved: boolean } | null>(null);
  const isInBubbleDropZone = (cx: number, cy: number): boolean => {
    if (typeof window === "undefined") return false;
    const zoneWidth = 208, zoneHeight = 96; // matches the w-52 h-24 drop-zone indicator below
    const zoneLeft = window.innerWidth / 2 - zoneWidth / 2;
    const zoneTop = window.innerHeight - zoneHeight - 24;
    return cx >= zoneLeft && cx <= zoneLeft + zoneWidth && cy >= zoneTop;
  };
  const onBubblePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    bubbleDragStateRef.current = { startClientX: e.clientX, startClientY: e.clientY, startLeft: rect.left, startTop: rect.top, moved: false };
    setBubbleDragging(true);
  };
  const onBubblePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = bubbleDragStateRef.current;
    if (!ds) return;
    const dx = e.clientX - ds.startClientX;
    const dy = e.clientY - ds.startClientY;
    // A few px of jitter shouldn't count as a drag — otherwise every
    // ordinary click would also register as "moved" and skip the
    // click-to-reopen behavior below.
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) ds.moved = true;
    const maxLeft = Math.max(0, window.innerWidth - BUBBLE_SIZE);
    const maxTop = Math.max(0, window.innerHeight - BUBBLE_SIZE);
    setBubblePos({ x: Math.min(Math.max(0, ds.startLeft + dx), maxLeft), y: Math.min(Math.max(0, ds.startTop + dy), maxTop) });
    setOverDropZone(isInBubbleDropZone(e.clientX, e.clientY));
  };
  const onBubblePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = bubbleDragStateRef.current;
    bubbleDragStateRef.current = null;
    setBubbleDragging(false);
    setOverDropZone(false);
    if (!ds) return;
    if (!ds.moved) { setVoiceModeMinimized(false); autoMinimizedForSpotlightRef.current = false; clearTimeout(spotlightRestoreTimerRef.current); return; } // a real click, not a drag — reopen
    if (isInBubbleDropZone(e.clientX, e.clientY)) closeVoiceMode();
    // else: leave it wherever it was dropped (bubblePos already holds that).
  };
  // Safety net — stop the mic/speech if this whole page unmounts (owner
  // navigates to a different CRM page) while Voice Mode is still open,
  // rather than leaving a live microphone/recognizer running unseen.
  useEffect(() => () => {
    voiceModeKeepGoingRef.current = false;
    try { voiceModeRecognitionRef.current?.stop(); } catch { /* already stopped */ }
    try { interruptRecognitionRef.current?.stop(); } catch { /* already stopped */ }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
  }, []);
  // FIX 2 (mobile round 3) — tracks which conversation ids we've already sent
  // at least one upsert for, so the save-effect below can tell "brand new
  // conversation" apart from "edited an existing one" and save the new one
  // immediately instead of waiting out the debounce.
  const knownConvIdsRef = useRef<Set<string>>(new Set());
  // BUG FIX — "schedule_job (and other tool calls) sometimes take forever
  // or time out with no request even reaching Supabase." Root cause: the
  // debounced save effect below used to re-upsert EVERY conversation in the
  // list on every fire, not just the one that changed — with several saved
  // conversations, and this effect re-running on every tool-call round
  // during a multi-step Alfred request (conversations state updates each
  // round), that's a burst of a dozen+ concurrent full-message-history
  // writes to alfred_conversations firing at the exact moment a real,
  // time-sensitive write (like scheduling a job) also needs a connection —
  // confirmed via Supabase's own logs: the job insert never even reached
  // the edge, and the console showed a wall of "conversation saved"
  // entries for conversations that hadn't actually changed. Track a cheap
  // fingerprint per conversation and only save the ones that differ from
  // what was last actually saved.
  const lastSavedConvFingerprintRef = useRef<Map<string, string>>(new Map());
  const convFingerprint = (c: any) => `${c.messages?.length || 0}:${c.updatedAt || ""}:${c.title || ""}`;
  // Tracks conversations the user deleted locally so the poll merge doesn't
  // bring them back if the Supabase DELETE is still in-flight or slow.
  const deletedConvIdsRef = useRef<Set<string>>(new Set());
  // FIX 4 (mobile round 5) — once we've run the mismatch check/re-key for a
  // given ownerId, don't repeat the extra round-trips on every 5s poll —
  // once is enough; re-arm if ownerId changes (e.g. a different session).
  const mismatchCheckedRef = useRef<string | null>(null);
  // Guards the 7-day-inactivity auto-delete (below) so it only issues a
  // DELETE once per session instead of re-checking on every 5s poll.
  const staleCleanupDoneRef = useRef(false);
  const shouldPollAlfred = usePollGate();
  // BUG FIX — this file's conversation/memory poll used to be safe to run
  // unconditionally because the WHOLE component only ever mounted while
  // the owner was looking at this page (see App.tsx's own comment on
  // where AlfredPage renders now) — unmounting was the only guard against
  // polling "forever in the background" (a deliberate, documented egress
  // decision). Now that this component stays mounted so Voice Mode can
  // survive navigating away, that guard is gone unless replaced with an
  // explicit check — isActivePageRef (kept fresh below) is that check.
  const isActivePageRef = useRef(isActivePage);
  useEffect(() => { isActivePageRef.current = isActivePage; }, [isActivePage]);
  // Portal target for the normal chat UI — see the return statement's own
  // comment for why this can't just be a direct document.getElementById()
  // call in the render body.
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setMountEl(document.getElementById("alfred-mount-point"));
  }, [isActivePage]);
  useEffect(() => {
    if (!ownerId) { console.warn("[Alfred Sync] no ownerId yet — skipping conversation fetch"); return; }
    const loadConversations = async () => {
      try {
        const res: any = await (supabase as any).from("alfred_conversations").select("*").eq("owner_id", ownerId).order("updated_at", { ascending: false });
        if (res.error) {
          console.warn("[Alfred Sync] fetch failed:", res.error.message, "— if this says the relation doesn't exist, run supabase/migrations/0011_owner_settings_and_alfred_schema_fixes.sql in the Supabase SQL editor");
          return;
        }
        let data: any[] = Array.isArray(res.data) ? res.data : [];

        // FIX 4 (mobile round 5) — "the auth user ID is a UUID, but the
        // conversations might be saved with a different ID format": this app
        // is single-tenant (docs/ARCHITECTURE.md — one owner per deployment), so if the
        // filtered query above found nothing but rows DO exist under some
        // OTHER owner_id value, they can only belong to this same owner
        // (saved under a stale scheme from an earlier build). Re-key them to
        // the current owner_id — used for the query AND every future
        // upsert — instead of just reporting the mismatch.
        if (data.length === 0 && mismatchCheckedRef.current !== ownerId) {
          mismatchCheckedRef.current = ownerId;
          try {
            const allRes: any = await (supabase as any).from("alfred_conversations").select("owner_id").limit(1000);
            const otherOwnerIds = Array.from(new Set((allRes?.data || []).map((r: any) => r.owner_id))).filter((v: any) => v != null && v !== ownerId) as string[];
            console.warn("[Alfred Sync] owner_id mismatch check — query used owner_id=" + JSON.stringify(ownerId) + " — distinct owner_id value(s) actually in the table:", otherOwnerIds.length ? otherOwnerIds : "(table is empty)");
            if (otherOwnerIds.length > 0) {
              const migrateRes: any = await (supabase as any).from("alfred_conversations").update({ owner_id: ownerId }).in("owner_id", otherOwnerIds);
              if (migrateRes?.error) {
                console.warn("[Alfred Sync] re-key to current owner_id failed:", migrateRes.error.message);
              } else {
                const retryRes: any = await (supabase as any).from("alfred_conversations").select("*").eq("owner_id", ownerId).order("updated_at", { ascending: false });
                if (Array.isArray(retryRes?.data)) data = retryRes.data;
                console.warn("[Alfred Sync] re-keyed", otherOwnerIds.length, "old owner_id value(s) to", JSON.stringify(ownerId), "— now showing", data.length, "conversation(s)");
              }
            }
          } catch (diagErr: any) {
            console.warn("[Alfred Sync] mismatch check threw:", diagErr?.message);
          }
        }
        if (data.length > 0) console.log("[Verify] Alfred conversations cross-device sync — working —", data.length, "conversation(s) loaded for owner_id=" + ownerId);
        let fromServer: AlfredConversation[] = data.map((r: any) => ({
          id: r.id, title: r.title || "Conversation", messages: Array.isArray(r.messages) ? r.messages : [],
          createdAt: r.created_at || r.createdAt || new Date().toISOString(), updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
        }));
        // FEATURE — auto-delete conversations inactive 7+ days, so the
        // alfred_conversations table (and this owner's cross-device sync
        // payload) doesn't grow unbounded. Only runs the delete once per
        // session (staleCleanupDoneRef), not on every 5s poll — the rows are
        // gone from Supabase after the first pass, so later polls simply
        // won't see them again. Filter them out of THIS pass's result too so
        // they don't flash on screen before the delete lands.
        const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const staleIds = fromServer.filter(c => Date.now() - new Date(c.updatedAt as any).getTime() > ONE_WEEK_MS).map(c => c.id);
        if (staleIds.length > 0) {
          fromServer = fromServer.filter(c => !staleIds.includes(c.id));
          if (!staleCleanupDoneRef.current) {
            staleCleanupDoneRef.current = true;
            (supabase as any).from("alfred_conversations").delete().eq("owner_id", ownerId).in("id", staleIds)
              .then((r: any) => {
                if (r?.error) console.warn("[Alfred Cleanup] failed to delete stale conversations:", r.error.message);
                else console.log("[Alfred Cleanup] deleted", staleIds.length, "conversation(s) inactive 7+ days");
              })
              .catch((e: any) => console.warn("[Alfred Cleanup] threw:", e?.message));
          }
        }
        // Anything the server already has is "known" — only conversations
        // created locally after this point should trigger an immediate save.
        fromServer.forEach(c => knownConvIdsRef.current.add(c.id));
        // Filter out any IDs the user deleted locally — the Supabase DELETE
        // may not have landed yet, but we never want them to reappear.
        fromServer = fromServer.filter(c => !deletedConvIdsRef.current.has(c.id));
        setConversations((prev: any[]) => {
          const byId = new Map(fromServer.map(c => [c.id, c]));
          // Keep any local conversation not yet confirmed server-side (just
          // created/edited, upsert still in flight) so it doesn't flicker away.
          const localOnly = (prev || []).filter((c: any) => !byId.has(c.id) && !deletedConvIdsRef.current.has(c.id));
          // fromServer always sets updatedAt as an ISO STRING, but local
          // conversations get created/updated with `updatedAt: Date.now()` —
          // a NUMBER. Normalize both shapes to a comparable timestamp instead
          // of assuming either one specifically (mixing them crashed
          // .localeCompare on a number before this fix existed).
          const ts = (v: unknown): number => {
            if (typeof v === "number") return v;
            if (typeof v === "string" && v) { const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; }
            return 0;
          };
          // BUG FIX (user report) — "messages are getting deleted, I'm
          // pretty sure it's ones I send with photos." Root cause: this
          // fetch runs on a 5s(ish) poll, but a new message only gets
          // upserted to Supabase after a 1200ms debounce — and a
          // screenshot/photo turn (vision analysis, tool calls) easily
          // takes longer than that between the user's message landing
          // locally and the debounced save actually completing. If the
          // poll's SELECT lands in that window, the server row is real
          // (not empty) but simply hasn't caught up yet — the old check
          // only guarded against an EMPTY server `messages`, so a
          // server copy that was merely behind by a few messages still
          // won overwrote the local copy outright, silently erasing
          // whatever was appended since the last successful save. Keep
          // the local messages whenever local has MORE of them than the
          // server does — that's the signal a save is still in flight,
          // not that another device legitimately has less history.
          const merged = fromServer.map(serverConv => {
            const localConv = (prev || []).find((c: any) => c.id === serverConv.id);
            const localLen = localConv?.messages?.length || 0;
            const serverLen = serverConv.messages?.length || 0;
            if (localConv && localLen > serverLen) {
              return { ...serverConv, messages: localConv.messages, updatedAt: localConv.updatedAt };
            }
            return serverConv;
          });
          return [...merged, ...localOnly].sort((a, b) => ts((b as any).updatedAt) - ts((a as any).updatedAt));
        });
        setAlfredConvsLoaded(true);
      } catch (e: any) { console.warn("[Alfred Sync] fetch threw:", e?.message); }
    };
    loadConversations();
    // EGRESS — was a hardcoded 5s regardless of the owner's configured
    // fallback-poll interval (Settings, default 120s) — alfred_conversations
    // rows can carry a full chat history each, so polling that every 5s
    // while Alfred is open was a real contributor to the egress overage.
    const interval = setInterval(() => { if (shouldPollAlfred() && isActivePageRef.current) loadConversations(); }, getPollIntervalMs(settings));
    return () => clearInterval(interval);
  }, [ownerId, (settings as any)?.pollIntervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE 2 (mobile round 7) — Alfred's remember_fact tool used to only
  // write to local usePersistent state, so anything the owner told Alfred to
  // remember never left the device it was said on. Mirrors the
  // alfred_conversations sync immediately above: fetch + 5s poll + upsert,
  // keyed by the same ownerId.
  const [alfredMemoryLoaded, setAlfredMemoryLoaded] = useState(false);
  const knownMemIdsRef = useRef<Set<string>>(new Set());
  // BUG FIX — "memories don't stay deleted." removeMemory's DB delete is a
  // real network round-trip; if the 60-120s poll's SELECT below happens to
  // land WHILE that delete is still in flight, it still sees the
  // (not-yet-deleted) row and the merge below put it right back into local
  // state — the real delete then succeeds a moment later against Supabase,
  // but nothing corrected the local re-add until the NEXT poll cycle, so a
  // just-deleted memory could sit "back" for up to a whole poll interval.
  // Same fix as deletedConvIdsRef above, applied to memory.
  const deletedMemIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!ownerId) return;
    const loadMemory = async () => {
      try {
        const res: any = await (supabase as any).from("alfred_memory").select("*").eq("owner_id", ownerId).order("created_at", { ascending: true });
        if (res.error) {
          console.warn("[Alfred Memory Sync] fetch failed:", res.error.message, "— run supabase/migrations/0014_alfred_memory_table.sql in the Supabase SQL editor");
          return;
        }
        const data: any[] = Array.isArray(res.data) ? res.data : [];
        data.forEach(m => knownMemIdsRef.current.add(m.id));
        let fromServer = data.map(m => ({ id: m.id, text: m.text, category: m.category || "general", createdAt: m.created_at || today() }));
        fromServer = fromServer.filter((m: any) => !deletedMemIdsRef.current.has(m.id));
        setMemory((prev: any[]) => {
          const byId = new Map(fromServer.map(m => [m.id, m]));
          const localOnly = (prev || []).filter((m: any) => !byId.has(m.id) && !deletedMemIdsRef.current.has(m.id));
          return [...fromServer, ...localOnly];
        });
        setAlfredMemoryLoaded(true);
        if (data.length > 0) console.log("[Verify] Alfred memory cross-device sync — working —", data.length, "fact(s) loaded for owner_id=" + ownerId);
      } catch (e: any) { console.warn("[Alfred Memory Sync] fetch threw:", e?.message); }
    };
    loadMemory();
    const interval = setInterval(() => { if (shouldPollAlfred() && isActivePageRef.current) loadMemory(); }, getPollIntervalMs(settings));
    return () => clearInterval(interval);
  }, [ownerId, (settings as any)?.pollIntervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ownerId || !alfredMemoryLoaded) return;
    (memory || []).forEach((m: any) => {
      if (!knownMemIdsRef.current.has(m.id)) {
        knownMemIdsRef.current.add(m.id);
        (supabase as any).from("alfred_memory").upsert({
          id: m.id, owner_id: ownerId, text: m.text, category: m.category || "general", created_at: m.createdAt || new Date().toISOString(),
        }, { onConflict: "id" }).then((r: any) => { if (r?.error) console.warn("[Alfred Memory Sync] save failed:", r.error.message); });
      }
    });
  }, [memory, ownerId, alfredMemoryLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG FIX — conversations get created/updated in several places (morning
  // briefing, afternoon check-in, new-chat, send()) and those sites disagree
  // on whether createdAt/updatedAt is a `Date.now()` NUMBER or a `today()`
  // "YYYY-MM-DD" STRING. Sending that straight through as created_at/
  // updated_at meant Supabase sometimes received a raw epoch-ms integer for
  // a timestamp column — the actual cause of the "date/time field value out
  // of range" console errors, not a schema problem. Normalize both to a
  // real ISO string right here, at the one place that actually talks to
  // Postgres, so it doesn't matter what shape the in-memory value is.
  const toIsoTimestamp = (v: any): string => {
    if (typeof v === "number") return new Date(v).toISOString();
    if (typeof v === "string" && v) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return d.toISOString();
    }
    return new Date().toISOString();
  };
  // BUG FIX — "find a way so it doesn't take too much storage in our
  // backend." imagePreview/imagePreviews hold raw base64 image bytes (up to
  // 10 screenshots per bulk-import message) purely so THIS browser tab can
  // show thumbnails — they were being upserted verbatim into this table's
  // JSONB `messages` column on every save, permanently, growing unbounded
  // with every photo/screenshot ever sent. Strip them before every write —
  // the backend only ever stores the text description ("📎 5 screenshots"),
  // never the image bytes themselves, regardless of how long the
  // conversation history gets.
  const stripImageBytes = (messages: any[]): any[] =>
    (messages || []).map((m: any) => {
      if (!m.imagePreview && !m.imagePreviews) return m;
      const { imagePreview, imagePreviews, ...rest } = m;
      return rest;
    });
  const upsertConversation = (c: any) => {
    const fingerprint = convFingerprint(c);
    (supabase as any).from("alfred_conversations").upsert({
      id: c.id, owner_id: ownerId, title: c.title, messages: stripImageBytes(c.messages),
      created_at: toIsoTimestamp(c.createdAt), updated_at: toIsoTimestamp(c.updatedAt),
    }, { onConflict: "id" })
      .then((r: any) => {
        if (r?.error) console.warn("[Alfred Sync] save failed for", c.id, ":", r.error.message);
        // AUDIT FIX — the fetch side already logs "[Verify] ... working" on
        // success (see loadConversations above); the write side only ever
        // logged failures. To verify cross-device sync end-to-end: open the
        // console on device A, send a message (watch for this log), then
        // open Alfred on device B within ~2min (or wait for its poll) and
        // confirm the SAME conversation id shows up in its "[Verify] ...
        // loaded" log. SQL to check directly in Supabase SQL Editor:
        //   select id, owner_id, title, updated_at from alfred_conversations
        //   where owner_id = '<ownerId>' order by updated_at desc;
        else {
          lastSavedConvFingerprintRef.current.set(c.id, fingerprint);
          console.log("[Verify] Alfred conversation saved to Supabase — id:", c.id, "· owner_id:", ownerId, "· title:", c.title);
        }
      })
      .catch((e: any) => console.warn("[Alfred Sync] save threw for", c.id, ":", e?.message));
  };

  useEffect(() => {
    if (!ownerId || !alfredConvsLoaded) return;
    // FIX 2 — save brand-new conversations immediately instead of waiting for
    // the debounce below, so a chat created right before switching devices
    // doesn't get lost to the 1.2s window never elapsing (tab closed, etc).
    (conversations || []).forEach((c: any) => {
      if (!knownConvIdsRef.current.has(c.id)) {
        knownConvIdsRef.current.add(c.id);
        upsertConversation(c);
      }
    });
    clearTimeout(alfredConvsSaveTimerRef.current);
    alfredConvsSaveTimerRef.current = setTimeout(() => {
      (conversations || []).forEach((c: any) => {
        if (lastSavedConvFingerprintRef.current.get(c.id) !== convFingerprint(c)) upsertConversation(c);
      });
    }, 1200);
    return () => clearTimeout(alfredConvsSaveTimerRef.current);
  }, [conversations, ownerId, alfredConvsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = conversations.find(c => c.id === activeConvId) || conversations[0];
  const chats = active?.messages || [];
  // Alfred's own attachment-analysis prompt (fed to the model as a "user"
  // turn). Builds before Sept 26 saved it into history as a visible user
  // bubble — those rows are still in old conversations. Never render them.
  const isInternalAttachPrompt = (m: any) => m?.role === "user" && typeof m.content === "string" &&
    (/^Here's what I found in (what I just attached|the \d+ screenshots I just sent you)/.test(m.content) || m.content.includes("(The above is what I just found in the file I attached.)"));

  // BUG FIX — "after a couple of messages the screenshots get deleted from
  // our backend, or they just get stored in the user's local storage."
  // upsertConversation (above) already keeps image bytes out of Supabase
  // permanently; this bounds how long they even sit in THIS tab's memory —
  // once 3 newer messages have come in after an image-carrying one, its
  // imagePreview/imagePreviews are dropped (the text stays, so the chat
  // transcript itself is untouched). Screenshots were only ever meant to be
  // glanced at right after sending, not held onto indefinitely.
  const IMAGE_PREVIEW_KEEP_RECENT = 3;
  useEffect(() => {
    const curId = active?.id;
    if (!curId || chats.length <= IMAGE_PREVIEW_KEEP_RECENT) return;
    const cutoffIndex = chats.length - IMAGE_PREVIEW_KEEP_RECENT;
    const hasOldPreview = chats.slice(0, cutoffIndex).some((m: any) => m.imagePreview || m.imagePreviews);
    if (!hasOldPreview) return;
    setConversations((prev: any[]) => prev.map((c: any) => {
      if (c.id !== curId) return c;
      return {
        ...c, messages: c.messages.map((m: any, i: number) => {
          if (i >= cutoffIndex || (!m.imagePreview && !m.imagePreviews)) return m;
          const { imagePreview, imagePreviews, ...rest } = m;
          return rest;
        }),
      };
    }));
  }, [chats.length, active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // See the BUG FIX comment in send() — when send() had to create a brand
  // new conversation from scratch, it couldn't also append the user's text
  // in the same render (state hadn't committed yet), so it queues that text
  // here and this effect fires the real send() once `active` reflects the
  // just-created conversation, instead of the message silently vanishing.
  // BUG FIX (user report) — "Alfred sends one message as if I sent it to
  // him, and the other message as if he sent it to me." When send() has to
  // create a brand new conversation from scratch it queues the text here
  // and replays it once `active` exists — but that replay used to always
  // call plain send(queued), dropping the skipVisibleMessage flag if the
  // ORIGINAL call was an internal one (e.g. sendWithAttachments feeding
  // Alfred's own screenshot-extraction text into the model, never meant to
  // be shown as a real "sent by you" bubble). If that internal call
  // happened to land on this exact "no active conversation yet" edge —
  // most likely right when a conversation is still finishing its initial
  // load/sync — the replay rendered Alfred's own generated text as a
  // role:"user" message. Queuing the flag alongside the text fixes that.
  const pendingFirstSendRef = useRef<{ text: string; skipVisibleMessage?: boolean } | null>(null);
  useEffect(() => {
    if (active && pendingFirstSendRef.current) {
      const queued = pendingFirstSendRef.current;
      pendingFirstSendRef.current = null;
      send(queued.text, { skipVisibleMessage: queued.skipVisibleMessage });
    }
  }); // deliberately no deps — runs after every render, guarded by the ref itself

  // Auto-initialize: if no conversations exist, create one so appendMessage always has a target
  // BLOCKER 5 (mobile round 7) — this ran on mount with empty deps, BEFORE
  // the Supabase fetch above (async, keyed on ownerId) had any chance to
  // land. On a fresh browser/device with no local conversations yet (e.g.
  // opening Alfred on a phone for the first time), this fired first, created
  // a brand-new blank "New chat", and set IT active — so even once the real
  // PC conversations synced in moments later, the phone kept showing the new
  // empty chat instead of them. Looked exactly like "sync isn't working"
  // even though the synced data really was there in the (unselected) list.
  // Waiting for alfredConvsLoaded before deciding "there's really nothing
  // here" fixes that, while still working immediately if there's no owner
  // session at all (fetch will never run).
  useEffect(() => {
    if (ownerId && !alfredConvsLoaded) return;
    if (!conversations || conversations.length === 0) {
      const cid = uid();
      const greeting = getPersonality(personality)?.greeting || "Hey. What do we need to handle today? Alfred out.";
      const newConv = { id: cid, title: "New chat", personality, createdAt: today(), updatedAt: Date.now(), messages: [{ id: uid(), role: "alfred", content: greeting, timestamp: Date.now() }] };
      setConversations([newConv]);
      setActiveConvId(cid);
    }
  }, [alfredConvsLoaded, ownerId]); // eslint-disable-line

  // FIX 5 — reverses BLOCKER 19 (mobile round 9), which deliberately
  // suppressed auto-scroll when switching conversations. The explicit ask now
  // is to scroll to bottom on mount AND on every conversation switch, not
  // just for new messages arriving in the already-active thread — a stale
  // "arrived at the top" was reported for the initial open specifically, and
  // `behavior: "smooth"` animated scrolls could visibly get cut short/reset
  // by a re-render landing mid-animation (e.g. a poll-driven prop update),
  // which reads exactly like "scrolls from the top and stays there." Setting
  // scrollTop = scrollHeight directly is instant — nothing to interrupt.
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    // BUG FIX (user report — "clicking an Alfred chat should open to the
    // bottom automatically") — the instant assignment above runs the
    // moment this effect fires, but a conversation carrying image
    // previews (screenshots, receipts — see imagePreview/imagePreviews on
    // messages) still has those <img> tags loading asynchronously at that
    // exact point; each one finishing growing the container's real
    // scrollHeight a beat later, leaving the view short of the true
    // bottom with no further correction. Two follow-up passes — one after
    // the next paint, one after a short delay for slower image loads —
    // catch that without fighting a smooth-scroll animation (there isn't
    // one here; this is instant scrollTop assignment, same as above).
    const raf = requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; });
    const t = setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 250);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
    // BUG FIX (user report) — "whenever I open up an Alfred conversation...
    // it always needs to open to the bottom, I don't care if I go to a
    // different part of the CRM and come back." This component stays
    // mounted while on another CRM page (see mountEl's own comment — it's
    // only PORTALED away, so Voice Mode survives navigation), but the
    // portal target (#alfred-mount-point) itself gets torn down and
    // recreated by App.tsx's page switch, which hands scrollRef a BRAND
    // NEW DOM node — starting at scrollTop 0 — every time the owner
    // navigates back. chats.length/active?.id don't change on a same-
    // conversation return, so this effect never re-ran to correct it.
    // isActivePage flipping back to true now re-triggers the same
    // scroll-to-bottom logic above.
    // BUG FIX (user report — "on mobile it doesn't open to the bottom")
    // — the chat UI itself only renders once mountEl (the portal target,
    // looked up in its own effect after mount) is non-null; see the
    // `{mountEl && createPortal(...)}` guard below. On a fresh load,
    // THIS effect's first run fires before that portal exists, so
    // scrollRef.current is still null and the early-return above skips
    // it — nothing re-triggers it once the DOM node actually shows up,
    // since none of the other deps change on that second render. Mobile
    // hit this far more than desktop simply because the extra render
    // tick is more likely to land after this effect already ran. Adding
    // mountEl re-fires this effect the moment the real node exists.
  }, [chats.length, loading, active?.id, isActivePage, mountEl]);

  // Slash command suggestions
  const slashCmds = [
    { cmd: "/rollcall", desc: "Morning briefing" },
    { cmd: "/debrief", desc: "End of day" },
    { cmd: "/status", desc: "Quick stats" },
    { cmd: "/route", desc: "Today's route" },
    { cmd: "/followup", desc: "Stale quotes" },
    { cmd: "/top", desc: "Top customers" },
    { cmd: "/daily", desc: "Today's debrief + MTD stats" },
    { cmd: "/weather", desc: "Forecast check" },
    { cmd: "/quote", desc: "Mock estimate" },
    { cmd: "/motivate", desc: "Drill quote" },
    { cmd: "/savagemode", desc: "Roast metrics" },
    { cmd: "/accountability", desc: "Check-in prompt" },
    { cmd: "/proud [win]", desc: "Log a win" },
    { cmd: "/compete", desc: "Month over month" },
    { cmd: "/goal [text/number]", desc: "Set goal/revenue" },
    { cmd: "/weekly", desc: "7-day business summary" },
    { cmd: "/monthly", desc: "30-day monthly review" },
    { cmd: "/post [desc]", desc: "Generate 3 social captions" },
    { cmd: "/review send [name]", desc: "Queue review request" },
    { cmd: "/reschedule [job]", desc: "Text customer to reschedule" },
    { cmd: "/reflect", desc: "Open weekly reflection" },
    { cmd: "/override", desc: "Weather override for today" },
    { cmd: "/automations", desc: "List workflows" },
    { cmd: "/help", desc: "All commands" }
  ];
  const slashFiltered = showSlash ? slashCmds.filter(s => s.cmd.toLowerCase().startsWith(input.trim().toLowerCase())) : [];

  // Suggested prompts for empty chat
  const suggestions = [
    { icon: Activity, title: "Morning briefing", prompt: "/rollcall" },
    { icon: Target, title: "Who should I call?", prompt: "/followup" },
    { icon: Workflow, title: "Build an automation", prompt: "Build me a workflow: when a job is marked complete, wait 2 hours, then send the customer a review request by SMS, then 3 days later if they haven't rated us, send a follow-up email with a 10% off coupon." },
    { icon: BarChart2, title: "Weekly summary", prompt: "/weekly" },
    { icon: Zap, title: "Show my workflows", prompt: "/automations" },
    { icon: Route, title: "Optimize my route", prompt: "/route" },
  ];

  const activeId = active?.id ?? activeConvId;
  const updateActive = patch => setConversations(prev => prev.map(c => c.id === activeId ? { ...c, ...patch, updatedAt: Date.now() } : c));
  const appendMessage = msg => setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: [...c.messages, msg], updatedAt: Date.now() } : c));
  const replaceMessages = msgs => setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: msgs, updatedAt: Date.now() } : c));
  // FEATURE — "start showing text while it's talking, as if it's actually
  // responding, not like it just copy-pasted the response." Patches ONE
  // already-appended message's content in place — used by the voice-mode
  // progressive reveal below to grow a reply sentence-by-sentence in sync
  // with speech, instead of the whole thing appearing the instant the
  // (still non-streaming) model call returns.
  const updateMessageContent = (msgId: string, content: string) => setConversations(prev => prev.map(c => c.id === activeId ? { ...c, messages: c.messages.map((m: any) => m.id === msgId ? { ...m, content } : m) } : c));

  // BUG FIX — "duplicate conversations" turned out to be reproducible: a
  // fast double-click/double-tap on "New Chat" (no touch feedback delay to
  // suggest the first click already registered) fired newConversation()
  // twice before the first click's setConversations had a chance to update
  // anything the second click could see, so both created a distinct
  // "New chat" row and both got saved to Supabase as genuinely separate
  // conversations. This ref makes a second call within 500ms a no-op.
  const newConversationGuardRef = useRef(0);
  const newConversation = () => {
    const now = Date.now();
    if (now - newConversationGuardRef.current < 500) return;
    newConversationGuardRef.current = now;
    const cid = uid();
    const newConv = {
      id: cid,
      title: "New chat",
      personality,
      createdAt: today(),
      updatedAt: Date.now(),
      messages: [{ id: uid(), role: "alfred", content: getPersonality(personality)?.greeting || "Hello! How can I help?", timestamp: Date.now() }]
    };
    setConversations([newConv, ...conversations]);
    setActiveConvId(cid);
    setSidebarOpen(false);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // FEATURE 2 — a locally-removed conversation must also be deleted from
  // alfred_conversations, or App.tsx's 5s cross-device sync poll treats the
  // still-present server row as authoritative and merges it right back into
  // local state (and it never disappears on any OTHER device either, since
  // no device ever told Supabase it was deleted).
  const deleteConversation = cid => {
    deletedConvIdsRef.current.add(cid);
    const remaining = conversations.filter(c => c.id !== cid);
    setConversations(remaining);
    if (cid === activeConvId) setActiveConvId(remaining[0]?.id || null);
    if (remaining.length === 0) {
      // auto-create fresh
      setTimeout(newConversation, 0);
    }
    setConfirmDelete(null);
    toast("Conversation deleted");
    if (ownerId) {
      (supabase as any).from("alfred_conversations").delete().eq("id", cid).eq("owner_id", ownerId)
        .then((r: any) => {
          if (r?.error) { console.warn("[Alfred Sync] delete failed:", r.error.message); toast?.("Deleted locally, but failed to sync deletion — " + r.error.message, "red"); }
        })
        .catch((e: any) => { console.warn("[Alfred Sync] delete threw:", e?.message); toast?.("Deleted locally, but failed to sync deletion", "red"); });
    }
  };

  const deleteAllConversations = () => {
    const ids = conversations.map(c => c.id);
    ids.forEach(id => deletedConvIdsRef.current.add(id));
    setConversations([]);
    setActiveConvId(null);
    setTimeout(newConversation, 0);
    toast("All conversations cleared");
    if (ownerId && ids.length > 0) {
      (supabase as any).from("alfred_conversations").delete().eq("owner_id", ownerId).in("id", ids)
        .then((r: any) => { if (r?.error) { console.warn("[Alfred Sync] bulk delete failed:", r.error.message); toast?.("Cleared locally, but failed to sync deletion — " + r.error.message, "red"); } })
        .catch((e: any) => { console.warn("[Alfred Sync] bulk delete threw:", e?.message); toast?.("Cleared locally, but failed to sync deletion", "red"); });
    }
  };

  // FEATURE — "merge duplicate conversations." Genuine content duplicates
  // are rare (each real chat has its own message history); the actual thing
  // cluttering the list is stub conversations — same title, one message
  // (just the greeting), never actually chatted in — created by the
  // double-click race fixed above, or by "delete all" / "delete last one"
  // auto-recreating a fresh one. Groups by exact title, and within any
  // group where two or more are stubs (≤1 message), keeps only the single
  // newest stub and removes the rest — never touches a conversation with
  // real back-and-forth in it.
  const cleanupDuplicateConversations = () => {
    const byTitle = new Map<string, any[]>();
    conversations.forEach(c => { const key = (c.title || "").trim(); if (!byTitle.has(key)) byTitle.set(key, []); byTitle.get(key)!.push(c); });
    const toRemove: string[] = [];
    byTitle.forEach(group => {
      const stubs = group.filter(c => (c.messages || []).length <= 1);
      if (stubs.length > 1) {
        const sorted = [...stubs].sort((a, b) => {
          const ts = (v: any) => typeof v === "number" ? v : (new Date(v).getTime() || 0);
          return ts(b.updatedAt) - ts(a.updatedAt);
        });
        sorted.slice(1).forEach(c => toRemove.push(c.id));
      }
    });
    if (toRemove.length === 0) { toast?.("No duplicate conversations found", "green"); return; }
    toRemove.forEach(id => deletedConvIdsRef.current.add(id));
    setConversations(conversations.filter(c => !toRemove.includes(c.id)));
    if (toRemove.includes(activeConvId)) setActiveConvId(conversations.find(c => !toRemove.includes(c.id))?.id || null);
    toast?.(`Merged/removed ${toRemove.length} duplicate conversation${toRemove.length !== 1 ? "s" : ""}`, "green");
    if (ownerId) {
      (supabase as any).from("alfred_conversations").delete().eq("owner_id", ownerId).in("id", toRemove)
        .then((r: any) => { if (r?.error) { console.warn("[Alfred Sync] cleanup delete failed:", r.error.message); toast?.("Cleaned up locally, but failed to sync — " + r.error.message, "red"); } })
        .catch((e: any) => console.warn("[Alfred Sync] cleanup delete threw:", e?.message));
    }
  };

  const startRename = c => { setEditingTitle(c.id); setTitleDraft(c.title); };
  const commitRename = () => {
    if (editingTitle && titleDraft.trim()) {
      setConversations(conversations.map(c => c.id === editingTitle ? { ...c, title: titleDraft.trim() } : c));
    }
    setEditingTitle(null);
  };

  const clearChat = () => {
    if (!active) return;
    replaceMessages([{ id: uid(), role: "alfred", content: getPersonality(active.personality || personality)?.greeting || "Hello! How can I help?", timestamp: Date.now() }]);
    setMenuOpen(false);
    toast("Chat cleared");
  };

  const addMemory = () => {
    if (!newMemoryText.trim()) return;
    setMemory([...memory, { id: uid(), text: newMemoryText.trim(), category: newMemoryCat, createdAt: today() }]);
    setNewMemoryText("");
  };
  // FEATURE 2 (mobile round 7) — these only removed memories from local
  // state, so a deleted fact silently reappeared on the next 5s sync poll
  // (or on another device) since the row was still sitting in alfred_memory.
  // BUG FIX (audit finding — critical) — these deletes had no owner_id
  // filter and no .select() to check row count, so an RLS-filtered 0-row
  // delete (the "0-row silent success" class documented in docs/ARCHITECTURE.md —
  // stale/mismatched owner_id on that row, the exact drift this file's own
  // re-key logic above exists to correct) returned success with nothing
  // actually removed. The optimistic local removal then got silently
  // overwritten back in by the next 5s memory poll — Alfred says "forgot
  // it," the fact comes right back. Now scoped to owner_id, verified via
  // .select("id"), and reverted + surfaced to the user on a real 0-row miss.
  const removeMemory = id => {
    const prev = memory;
    deletedMemIdsRef.current.add(id);
    setMemory(memory.filter(m => m.id !== id));
    (supabase as any).from("alfred_memory").delete().eq("id", id).eq("owner_id", ownerId).select("id")
      .then((r: any) => {
        if (r?.error) { console.warn("[Alfred Memory Sync] delete failed:", r.error.message); deletedMemIdsRef.current.delete(id); setMemory(prev); toast("Couldn't delete memory — " + r.error.message, "error"); return; }
        if (!Array.isArray(r?.data) || r.data.length === 0) { console.warn("[Alfred Memory Sync] delete matched 0 rows"); deletedMemIdsRef.current.delete(id); setMemory(prev); toast("Couldn't delete memory — try again", "error"); }
      });
  };
  const clearMemory = () => {
    if (!confirm("Wipe all Alfred memory?")) return;
    const prev = memory;
    const ids = memory.map((m: any) => m.id);
    ids.forEach(id => deletedMemIdsRef.current.add(id));
    setMemory([]);
    if (ids.length > 0) {
      (supabase as any).from("alfred_memory").delete().in("id", ids).eq("owner_id", ownerId).select("id")
        .then((r: any) => {
          if (r?.error) { console.warn("[Alfred Memory Sync] bulk delete failed:", r.error.message); ids.forEach(id => deletedMemIdsRef.current.delete(id)); setMemory(prev); toast("Couldn't clear memory — " + r.error.message, "error"); return; }
          if (!Array.isArray(r?.data) || r.data.length !== ids.length) console.warn("[Alfred Memory Sync] bulk delete matched", r?.data?.length ?? 0, "of", ids.length, "rows");
          toast("Memory cleared");
        });
    } else {
      toast("Memory cleared");
    }
  };

  const runSlash = async text => {
    const [cmd, ...rest] = text.trim().split(/\s+/);
    const args = rest.join(" ");
    const t = today();

    switch (cmd.toLowerCase()) {
      case "/rollcall": {
        const todayJobs = jobs.filter(j => j.scheduledDate === t);
        const urgent = jobs.filter(j => j.priority === "urgent" && j.status !== "completed" && j.status !== "cancelled");
        const msg = "☀️ MORNING BRIEFING\n\n" + t + "\nActive jobs: " + stats.activeJobs + "\nToday: " + todayJobs.length + " scheduled\nPending quotes: " + stats.pendingEst + "\nRevenue MTD: " + fmt(stats.totalRev) + (urgent.length ? "\n\n🚨 " + urgent.length + " URGENT job(s)" : "") + "\n\nMOVE. Alfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/debrief": {
        const todayCompleted = jobs.filter(j => j.scheduledDate === t && j.status === "completed");
        const todayRev = todayCompleted.reduce((s, j) => s + j.amount, 0);
        const cashToday = todayCompleted.filter(j => j.isCash).reduce((s, j) => s + j.amount, 0);
        const todayPending = estimates.filter(e => e.status === "pending" && e.createdAt === t);
        const stale = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 7);
        const overdue = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14);
        const msg = "🌙 END OF DAY DEBRIEF — " + t + "\n\n" +
          "💰 Today's Revenue: " + fmt(todayRev) + (cashToday > 0 ? " (" + fmt(cashToday) + " cash)" : "") + "\n" +
          "🔨 Jobs Completed: " + todayCompleted.length + "\n" +
          (todayPending.length > 0 ? "📋 New Quotes Today: " + todayPending.length + "\n" : "") +
          (stale.length > 0 ? "⚠️ Stale Quotes: " + stale.length + " over 7 days — follow up tomorrow\n" : "") +
          (overdue.length > 0 ? "💸 Overdue Invoices: " + overdue.length + " — collect ASAP\n" : "") +
          "\n" + (todayRev >= 1000 ? "💪 Solid day. Rest up." : todayRev > 0 ? "Not bad. Push harder tomorrow." : "No revenue today — what happened? Fix it tomorrow.") +
          "\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/status": {
        const msg = "📊 STATUS\n\nRevenue: " + fmt(stats.totalRev) + "\nActive: " + stats.activeJobs + " jobs\nQuotes: " + stats.pendingEst + " pending\nClose rate: " + stats.closeRate + "%\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/quote": {
        if (!args) return "USAGE: /quote [customer name] [service] [amount]\n\nExample: /quote Jennifer Walsh standard service 450\nExample: /quote Sarah Miller repair 250\n\nAlfred will create the estimate and open it. Alfred out.";
        const parts = args.match(/^(.+?)\s+(.+?)\s+(\d+(?:\.\d+)?)$/);
        if (!parts) {
          // Try to find customer and give pricing suggestions
          const matchQ = customers.find(c => args.toLowerCase().includes(c.firstName.toLowerCase()) || args.toLowerCase().includes(c.lastName.toLowerCase()));
          return "📋 QUOTE BUILDER\n\n" + (matchQ ? "Customer: " + matchQ.firstName + " " + matchQ.lastName + "\nAddress: " + (matchQ.address || "not on file") + "\n\n" : "") + "Pick a service from your catalog and an amount, e.g. /quote " + (matchQ ? matchQ.firstName + " " + matchQ.lastName : "Jennifer Walsh") + " standard service 150\n\nAlfred out.";
        }
        const [, customerName, service, amountStr] = parts;
        const amount = parseFloat(amountStr);
        const cMatch = customers.find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(customerName.toLowerCase()));
        if (!cMatch) return "❌ Customer \"" + customerName + "\" not found. Add them to Customers first, or create with: /quote and then create estimate manually. Alfred out.";
        const tax = amount * ((Number(settings.taxRate) || 0) / 100);
        const newEst = { id: uid(), customerId: cMatch.id, lineItems: [{ id: uid(), description: service, quantity: 1, unitPrice: amount }], subtotal: amount, discount: 0, depositRequired: 0, tax, total: amount + tax, status: "pending", createdAt: today(), validUntil: daysFromNow(30), viewed: false, notes: "Created by Alfred", terms: settings.terms || "Payment due upon completion." };
        setEstimates(prev => [...prev, newEst]);
        toast("Alfred created quote for " + cMatch.firstName + " — " + fmt(amount + tax));
        onNav("estimates");
        return "✅ ESTIMATE CREATED\n\nCustomer: " + cMatch.firstName + " " + cMatch.lastName + "\nService: " + service + "\nAmount: " + fmt(amount) + " + tax = " + fmt(amount + tax) + "\n\nOpening Estimates now. Send it from there. Alfred out.";
      }
      case "/nearby": {
        if (!args) return "USAGE: /nearby [what]\n\nExamples:\n• /nearby gas station\n• /nearby hardware store\n• /nearby customer [name] — find best slot near their address\n\nAlfred opens Google Maps search near your location. Alfred out.";

        // Check if asking about scheduling near a customer
        const lowerArgs = args.toLowerCase();
        const isScheduleRequest = lowerArgs.startsWith("customer") || lowerArgs.startsWith("estimate") || lowerArgs.includes("schedule") || lowerArgs.includes("slot");
        if (isScheduleRequest) {
          const searchTerm = args.replace(/customer|estimate|schedule|slot|for|near/gi, "").trim();
          const matchedCust = customers.find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(searchTerm.toLowerCase()) || (c.address || "").toLowerCase().includes(searchTerm.toLowerCase()));
          if (matchedCust) {
            // Find jobs near this customer's area (same city/zip)
            const area = (matchedCust.address || "").split(",")[1]?.trim() || "York";
            const nearbyJobs = jobs.filter(j => j.status === "scheduled" && (j.address || "").includes(area));
            const slots = [];
            for (let i = 1; i <= 14 && slots.length < 3; i++) {
              const d = new Date(); d.setDate(d.getDate() + i);
              if (d.getDay() === 0 || d.getDay() === 6) continue;
              const ds = d.toISOString().slice(0,10);
              const dayJobs = nearbyJobs.filter(j => j.scheduledDate === ds);
              const dayLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
              slots.push({ date: ds, day: dayLabel, nearbyJobs: dayJobs.length });
            }
            const slotText = slots.map((s,i) => (i+1) + ". " + s.day + (s.nearbyJobs > 0 ? " ✅ " + s.nearbyJobs + " nearby job" + (s.nearbyJobs !== 1 ? "s" : "") + " already in the area" : " (no nearby jobs yet)")).join("\n");
            return "📍 SMART SCHEDULE\n\nCustomer: " + matchedCust.firstName + " " + matchedCust.lastName + "\nAddress: " + (matchedCust.address || "not on file") + "\nArea: " + area + "\n\nBest slots (grouped by nearby jobs to reduce drive time):\n" + slotText + "\n\nTip: pick a day you're already in " + area + " to batch your route. Alfred out.";
          }
          return "❌ No customer found matching \"" + searchTerm + "\". Alfred out.";
        }

        // Regular nearby search
        const openMaps = (lat = 39.9626, lng = -76.7277) => {
          const mapsUrl = "https://www.google.com/maps/search/" + encodeURIComponent(args) + "/@" + lat + "," + lng + ",13z";
          window.open(mapsUrl, "_blank");
          return "📍 NEARBY: " + args.toUpperCase() + "\n\nOpened Google Maps" + (lat !== 39.9626 ? " at your current location" : " near your area") + ".\n\nTop results will show in the Maps app. Alfred out.";
        };
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            pos => { openMaps(pos.coords.latitude, pos.coords.longitude); },
            () => { openMaps(); }
          );
          return "📍 NEARBY: " + args + "\n\nGetting your location... Maps opening now. Alfred out.";
        }
        return openMaps();
      }
      case "/route": {
        const today_scheduled = jobs.filter(j => j.scheduledDate === t && j.status === "scheduled");
        if (today_scheduled.length === 0) return "🗺️ ROUTE\n\nNothing on the books for today. Alfred out.";

        // Build Google Maps multi-stop URL
        const addresses = today_scheduled.map(j => encodeURIComponent(j.address || "your area")).join("/");
        const mapsUrl = "https://www.google.com/maps/dir/" + addresses;
        window.open(mapsUrl, "_blank");

        // If Google Maps key available, use Distance Matrix API for optimized order
        if (settings.googleMapsKey && today_scheduled.length > 2) {
          try {
            const origins = today_scheduled.map(j => encodeURIComponent(j.address || "your area")).join("|");
            const destinations = today_scheduled.map(j => encodeURIComponent(j.address || "your area")).join("|");
            const dmUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&key=${settings.googleMapsKey}`;
            // Note: real Distance Matrix needs a backend proxy due to CORS
            // For now open optimized Maps URL and show the stops
          } catch { /* silent */ }
        }

        const stopList = today_scheduled.map((j, i) => {
          const c = customers.find(x => x.id === j.customerId);
          return (i + 1) + ". " + (c ? c.firstName + " " + c.lastName : "?") + "\n   📍 " + (j.address || "?").split(",")[0] + "\n   💰 " + fmt(j.amount);
        }).join("\n\n");

        return "🗺️ ROUTE — " + today_scheduled.length + " stops\n\n" + stopList + "\n\n✅ Opened in Google Maps. Alfred out.";
      }
      case "/schedule": {
        if (!args) return "USAGE: /schedule [customer name or address]\n\nExample: /schedule Jennifer Walsh\nExample: /schedule 412 Oak Ridge Ln\n\nAlfred finds open slots and texts the customer options. Alfred out.";

        // Try to find customer by name or address
        const searchLower = args.toLowerCase();
        const matchedCustomer = customers.find(c =>
          (c.firstName + " " + c.lastName).toLowerCase().includes(searchLower) ||
          (c.address || "").toLowerCase().includes(searchLower)
        );

        // Find open slots
        const slots = [];
        for (let i = 1; i <= 21 && slots.length < 3; i++) {
          const d = new Date(); d.setDate(d.getDate() + i);
          if (d.getDay() === 0 || d.getDay() === 6) continue;
          const ds = d.toISOString().slice(0, 10);
          const dayJobs = jobs.filter(j => j.scheduledDate === ds && j.status === "scheduled");
          if (dayJobs.length < 4) slots.push({ date: ds, existing: dayJobs.length, day: d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }) });
        }

        const slotsText = slots.map((s, i) => (i + 1) + ". " + s.day + (s.existing > 0 ? " (" + s.existing + " jobs that day)" : " (open day ✅)")).join("\n");

        if (matchedCustomer?.phone) {
          // BUG FIX (Alfred customer-texting audit) — same smsOptOut gap as
          // every other individual-customer SMS path in this file; this
          // slash command had no check at all.
          if (matchedCustomer.smsOptOut) {
            return "📅 Scheduling: " + matchedCustomer.firstName + " " + matchedCustomer.lastName + "\n\n" + matchedCustomer.firstName + " has opted out of text messages — can't send slot options by SMS. Reach out by email or phone call instead.\n\n" + slotsText + "\n\nAlfred out.";
          }
          const offerMsg = "Hi " + matchedCustomer.firstName + "! This is CRM Starter. I have a few openings coming up — which works for you?\n\n" + slotsText + "\n\nReply 1, 2, or 3 to confirm. Thanks!";
          if (settings?.twilioSid) {
            try {
              await twilioSend(settings, matchedCustomer.phone, offerMsg);
              logOutboundSmsToInbox({ contactName: `${matchedCustomer.firstName} ${matchedCustomer.lastName}`, contactPhone: matchedCustomer.phone, customerId: matchedCustomer.id, body: offerMsg }).catch(() => {});
              return "📅 Scheduling: " + matchedCustomer.firstName + " " + matchedCustomer.lastName + "\n\nSent slot options to " + matchedCustomer.phone + ":\n\n" + slotsText + "\n\nWaiting for their reply. When they pick, use /schedule confirm [date] to book. Alfred out.";
            } catch (e) {
              return "Found customer but SMS failed: " + e.message + "\n\nSlot options:\n" + slotsText + "\n\nManually text: " + matchedCustomer.phone;
            }
          } else {
            window.location.href = "sms:" + matchedCustomer.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent("Hi " + matchedCustomer.firstName + "! Openings:\n" + slotsText + "\nReply 1/2/3 — " + ((settings as any)?.companyName || "CRM Starter"));
            return "📅 Scheduling for " + matchedCustomer.firstName + "\n\nOpened SMS with slot options. Connect Twilio in Settings for automatic sending. Alfred out.";
          }
        }

        return "📅 SCHEDULING" + (args ? ": " + args : "") + "\n\n" + (matchedCustomer ? "Found: " + matchedCustomer.firstName + " " + matchedCustomer.lastName + " (no phone on file)\n\n" : "No customer match — creating new estimate?\n\n") + "Best available slots:\n\n" + slotsText + "\n\nReply '/schedule confirm [date]' to book. Alfred out.";
      }
      case "/motivate":
        const quotes = ["Pain is weakness leaving the power tool. Alfred out.", "Excuses don't finish jobs. Alfred out.", "You fall to your systems. Build better ones. Alfred out."];
        return quotes[Math.floor(Math.random() * quotes.length)];
      case "/savagemode":
        const stale = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) > 7).length;
        return "🔥 SAVAGE MODE\n\n" + stats.pendingEst + " quotes rotting.\n" + stale + " quotes over 7 days old.\nClose rate: " + stats.closeRate + "%. Do better.\n\nAlfred out.";
      case "/accountability":
        return "💪 ACCOUNTABILITY\n\nOpen the Accountability tab.\nLog sleep, water, gym, steps, mood.\n\nNo excuses. Alfred out.";
      case "/proud":
        if (!args) return "USAGE: /proud [your win]. Alfred out.";
        setWins(prev => [{ id: uid(), text: args, date: t }, ...prev]);
        return "🏆 WIN LOGGED: \"" + args + "\"\n\nAdded to your Accountability board. Alfred out.";
      case "/compete":
        const lastMonthRev = Math.round(stats.totalRev * 0.82);
        const growth = stats.totalRev > 0 ? Math.round(((stats.totalRev - lastMonthRev) / lastMonthRev) * 100) : 0;
        return "📊 COMPETITION\n\nThis month: " + fmt(stats.totalRev) + "\nLast month (est): " + fmt(lastMonthRev) + "\nGrowth: " + (growth >= 0 ? "+" : "") + growth + "%\n\n" + (growth > 0 ? "Keep pushing." : "Step it up.") + " Alfred out.";
      case "/daily": {
        const todayJobs = jobs.filter(j => j.scheduledDate === t);
        const doneToday = todayJobs.filter(j => j.status === "completed");
        const pendingToday = todayJobs.filter(j => j.status === "scheduled" || j.status === "in_progress");
        const todayRev = doneToday.reduce((s, j) => s + j.amount, 0);
        const todayTips = doneToday.reduce((s, j) => s + (Number(j.tip) || 0), 0);
        const pendingEst = estimates.filter(e => e.status === "pending");
        const overdueInv = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 7);
        const expToday = expenses.filter(e => e.date === t);
        const expTodayAmt = expToday.reduce((s, e) => s + Number(e.amount), 0);
        const monthStart = t.slice(0, 7);
        const mtdRev = jobs.filter(j => j.status === "completed" && j.scheduledDate?.startsWith(monthStart)).reduce((s, j) => s + j.amount, 0);
        const mtdGoal = settings.monthlyRevenueGoal || 0;
        const paceMsg = mtdGoal > 0
          ? (mtdRev >= mtdGoal ? "🔥 Monthly goal HIT." : "📈 " + fmt(mtdGoal - mtdRev) + " left to hit monthly goal.")
          : "";
        const msg = "📅 DAILY DEBRIEF — " + t + "\n\n" +
          "✅ Done: " + doneToday.length + " job" + (doneToday.length !== 1 ? "s" : "") + " · " + fmt(todayRev) + (todayTips > 0 ? " + " + fmt(todayTips) + " tips" : "") + "\n" +
          (pendingToday.length > 0 ? "🔨 Remaining: " + pendingToday.length + " job" + (pendingToday.length !== 1 ? "s" : "") + " today\n" : "") +
          (expTodayAmt > 0 ? "💸 Expenses today: " + fmt(expTodayAmt) + "\n" : "") +
          "📋 Pending quotes: " + pendingEst.length + "\n" +
          (overdueInv.length > 0 ? "⚠️ Overdue invoices: " + overdueInv.length + " (" + fmt(overdueInv.reduce((s, e) => s + e.total, 0)) + ")\n" : "") +
          "\n📊 MTD: " + fmt(mtdRev) + (mtdGoal > 0 ? " / " + fmt(mtdGoal) : "") + "\n" +
          paceMsg + "\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }

      case "/weekly": {
        const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
        const wkStr = weekStart.toISOString().slice(0,10);
        const wkJobs = jobs.filter(j => j.status === "completed" && j.scheduledDate >= wkStr);
        const wkRev = wkJobs.reduce((s, j) => s + j.amount, 0);
        const wkTips = wkJobs.reduce((s, j) => s + (Number(j.tip) || 0), 0);
        const wkCash = wkJobs.filter(j => j.isCash).reduce((s, j) => s + j.amount, 0);
        const wkAvg = wkJobs.length ? wkRev / wkJobs.length : 0;
        const wkPending = estimates.filter(e => e.status === "pending");
        const wkNewCust = customers.filter(c => c.createdAt >= wkStr).length;
        const profitTip = wkRev < 2000 ? "💡 TIP: Follow up on " + wkPending.length + " pending quotes. One close = another $" + Math.round(wkAvg) + "." :
          wkAvg < 400 ? "💡 TIP: Avg job value is low. Bundle services — offer an add-on with every job." :
          "💡 TIP: Strong week. Ask every customer for a referral.";
        const msg = "📊 WEEKLY REPORT — Last 7 Days\n\n" +
          "💰 Revenue: " + fmt(wkRev) + "\n" +
          "💵 Cash: " + fmt(wkCash) + " · Tips: " + fmt(wkTips) + "\n" +
          "🔨 Jobs: " + wkJobs.length + " · Avg: " + fmt(wkAvg) + "\n" +
          "📋 Pending quotes: " + wkPending.length + " ($" + Math.round(wkPending.reduce((s,e) => s+e.total, 0)) + " pipeline)\n" +
          "👥 New customers: " + wkNewCust + "\n\n" +
          profitTip + "\n\n" +
          (wkRev >= 3000 ? "🔥 Strong week. Keep pushing." : wkRev >= 1500 ? "👍 Decent week. More quotes = more cash." : "⚡ Light week. Get those estimates out NOW.") +
          "\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/monthly": {
        const monthStart = new Date(); monthStart.setDate(monthStart.getDate() - 30);
        const moStr = monthStart.toISOString().slice(0,10);
        const moJobs = jobs.filter(j => j.status === "completed" && j.scheduledDate >= moStr);
        const moRev = moJobs.reduce((s, j) => s + j.amount, 0);
        const moTips = moJobs.reduce((s, j) => s + (Number(j.tip) || 0), 0);
        const moCash = moJobs.filter(j => j.isCash).reduce((s, j) => s + j.amount, 0);
        const moChemCost = moJobs.reduce((s, j) => s + (j.chemicalsUsed || []).reduce((cs, ch) => cs + Number(ch.cost || 0), 0), 0);
        const moApproved = estimates.filter(e => e.status === "approved" && e.createdAt >= moStr);
        const moSent = estimates.filter(e => e.createdAt >= moStr);
        const moCR = moSent.length ? Math.round(moApproved.length / moSent.length * 100) : 0;
        const moGoal = settings.monthlyRevenueGoal || 0;
        const moOverdue = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14).reduce((s, e) => s + e.total, 0);
        const profit = moRev - moChemCost;
        const margin = moRev > 0 ? Math.round(profit / moRev * 100) : 0;

        // Spending advice
        const spendTips = [];
        if (moChemCost / moRev > 0.15) spendTips.push("Material costs are high (" + Math.round(moChemCost/moRev*100) + "%). Buy materials in bulk to cut costs.");
        if (moCR < 50) spendTips.push("Close rate " + moCR + "% is weak. Follow up on quotes within 2h of sending.");
        if (moOverdue > 500) spendTips.push("$" + Math.round(moOverdue) + " overdue A/R — text those customers TODAY.");
        if (moTips < moRev * 0.05) spendTips.push("Tip rate is low. Add a tip option to your client portal.");
        if (spendTips.length === 0) spendTips.push("Numbers look solid. Focus on referrals to grow without extra ad spend.");

        const msg = "📅 MONTHLY REVIEW — Last 30 Days\n\n" +
          "💰 Revenue: " + fmt(moRev) + (moGoal > 0 ? " / " + fmt(moGoal) + " (" + Math.round(moRev/moGoal*100) + "%)" : "") + "\n" +
          "💵 Cash: " + fmt(moCash) + " · Tips: " + fmt(moTips) + "\n" +
          "🔨 Jobs: " + moJobs.length + " · Avg: " + fmt(moJobs.length ? moRev/moJobs.length : 0) + "\n" +
          "📦 Material cost: " + fmt(moChemCost) + " · Margin: " + margin + "%\n" +
          "📋 Close rate: " + moCR + "% · Profit: " + fmt(profit) + "\n" +
          (moOverdue > 0 ? "⚠️ Overdue A/R: " + fmt(moOverdue) + "\n" : "") +
          "\n💡 Plans to improve profit:\n" + spendTips.map((t, i) => (i+1) + ". " + t).join("\n") +
          "\n\n" + (moRev >= (moGoal || 10000) ? "🔥 Goal hit. Raise it." : "⚡ " + fmt(Math.max(0, (moGoal || 10000) - moRev)) + " short. Close faster.") +
          "\n\nAlfred out.";
        if (settings.twilioSid && settings.myPhone) twilioSend(settings, settings.myPhone, msg).catch(() => {});
        return msg;
      }
      case "/goal":
        if (!args) return "USAGE: /goal [text or number]. Alfred out.";
        const num = Number(args.replace(/[^0-9]/g, ""));
        if (num > 0) {
          setSettings({ ...settings, monthlyRevenueGoal: num });
          return "🎯 REVENUE GOAL SET: " + fmt(num) + "\n\nDashboard updated. Alfred out.";
        }
        setGoals([...goals, { id: uid(), text: args, createdAt: t, done: false }]);
        return "🎯 GOAL LOGGED: \"" + args + "\"\n\nAdded to Accountability. Alfred out.";
      case "/post":
        if (!args) return "USAGE: /post [describe the job or 'before after']\n\nExample: /post before after recent project your area\n\nAlfred will generate 3 caption options. Alfred out.";
        return "📸 SOCIAL CAPTION OPTIONS for: \"" + args + "\"\n\n" +
          "Option 1 (Professional):\nAnother job done right ✅ " + args + ". DM us for a free estimate! #smallbusiness #localservice\n\n" +
          "Option 2 (Casual/CTA):\nCan you spot the difference? 👀 " + args + ". Want results like this? Call us for a free quote. #beforeandafter\n\n" +
          "Option 3 (Fun):\nWe love a good before-and-after 😄 " + args + ". 10/10 would do again. #yourbusiness #yourcity #satisfying\n\nAlfred out.";
      case "/review": {
        if (!args || !args.includes("send")) return "USAGE: /review send [customer name]\nExample: /review send Jennifer Walsh\n\nAlfred out.";
        const name = args.replace("send ", "").trim();
        const rc = customers.find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(name.toLowerCase()));
        if (!rc) return "Customer \"" + name + "\" not found. Check spelling. Alfred out.";
        const lastJob = jobs.filter(j => j.customerId === rc.id && j.status === "completed").slice(-1)[0];
        if (!lastJob) return rc.firstName + " has no completed jobs. Can't send review request yet. Alfred out.";
        return "📨 REVIEW REQUEST QUEUED\n\nCustomer: " + rc.firstName + " " + rc.lastName + "\nPhone: " + (rc.phone || "none on file") + "\nLast job: " + (lastJob.scheduledDate || "unknown") + "\n\nText will go: \"Hi " + rc.firstName + ", thanks for choosing CRM Starter! Got 30 seconds? Leave us a review: [link]. We appreciate it!\"\n\nGo to Reviews page to send. Alfred out.";
      }
      case "/reflect": {
        const last7 = entries.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0, 7);
        if (last7.length === 0) return "✨ REFLECT\n\nNo check-ins logged yet. Start logging daily in Accountability and I'll give you a real coaching reflection. Alfred out.";
        const avgSleep = (last7.reduce((s,e) => s + Number(e.sleep||0), 0) / last7.length).toFixed(1);
        const avgWater = Math.round(last7.reduce((s,e) => s + Number(e.water||0), 0) / last7.length);
        const avgSteps = Math.round(last7.reduce((s,e) => s + Number(e.steps||0), 0) / last7.length);
        const gymDays = last7.filter(e => (e.gymMinutes||0) > 0).length;
        const avgMood = (last7.reduce((s,e) => s + Number(e.mood||3), 0) / last7.length).toFixed(1);
        const weekRev = jobs.filter(j => j.status === "completed" && daysSince(j.scheduledDate) <= 7).reduce((s,j) => s+j.amount, 0);
        const prompt = `You are Alfred, the owner's no-BS AI business and accountability coach. Will runs CRM Starter in your area. Here's his last 7 days:\n\nBusiness: ${weekRev > 0 ? '$' + weekRev.toFixed(0) + ' revenue' : 'no completed jobs'} this week\nHealth: ${avgSleep}h sleep avg, ${avgWater}oz water avg, ${Math.round(avgSteps/1000*10)/10}k steps avg, ${gymDays}/7 gym days\nMood: ${avgMood}/5 avg\n\nWrite a SHORT (150 words max), honest, direct weekly reflection. Alfred's personality: like a drill sergeant crossed with a mentor — no fluff, real talk. Point out what's good, what needs work. End with one specific action for next week.`;
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] })
          });
          const d = await res.json();
          const text = d.content?.[0]?.text;
          if (text) return "✨ WEEKLY REFLECT\n\n" + text + "\n\nAlfred out.";
        } catch {}
        // Fallback if API fails
        return `✨ WEEKLY REFLECT\n\nSleep: ${avgSleep}h avg · Water: ${avgWater}oz · Steps: ${avgSteps.toLocaleString()} · Gym: ${gymDays}/7 days · Mood: ${avgMood}/5\nRevenue: ${fmt(weekRev)}\n\n${gymDays < 3 ? "Gym attendance is weak — fix that." : "Good gym consistency."} ${Number(avgSleep) < 7 ? "You're undersleeping. That's affecting everything." : "Sleep is solid."} ${weekRev < 1000 ? "Revenue needs attention — close something this week." : "Good week on the revenue side."}\n\nAlfred out.`;
      }
      case "/reschedule": {
        if (!args) return "USAGE: /reschedule [customer name or address]\n\nAlfred texts the customer asking to reschedule. If they decline or don't respond, Alfred texts you back. Alfred out.";
        // Match by name or address
        const searchR = args.toLowerCase();
        const rcust = customers.find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(searchR));
        const rjob = rcust
          ? jobs.find(j => j.status === "scheduled" && j.customerId === rcust.id)
          : jobs.find(j => j.status === "scheduled" && (j.address || "").toLowerCase().includes(searchR));
        const rc = rjob ? (rcust || customers.find(c => c.id === rjob.customerId)) : rcust;
        if (!rjob || !rc) return "No scheduled job found matching \"" + args + "\". Check the name or address. Alfred out.";
        // BUG FIX (Alfred customer-texting audit) — same smsOptOut gap as
        // every other individual-customer SMS path in this file.
        if (rc.smsOptOut) {
          return "📱 " + rc.firstName + " " + rc.lastName + " has opted out of text messages — can't send the reschedule request by SMS. Job: " + rjob.scheduledDate + " — " + rjob.address + ". Reach out by email or phone call instead. Alfred out.";
        }
        const clientMsg = "Hi " + rc.firstName + "! This is CRM Starter. Unfortunately we need to reschedule your " + (rjob.scheduledDate || "upcoming") + " appointment. What day works best for you? Just reply with a date and we'll confirm. Sorry for any inconvenience!";
        const willFollowUp = settings.twilioSid && settings.myPhone
          ? "\n\nI'll text you at " + settings.myPhone + " if they don't confirm within 24h or if they say a day doesn't work."
          : "\n\nConnect Twilio and set your mobile # in Settings → Company for automatic follow-up.";
        if (settings.twilioSid && rc.phone) {
          try {
            await twilioSend(settings, rc.phone, clientMsg);
            logOutboundSmsToInbox({ contactName: `${rc.firstName} ${rc.lastName}`, contactPhone: rc.phone, customerId: rc.id, body: clientMsg }).catch(() => {});
            // Schedule a follow-up note (conceptual - in production would set a delayed webhook)
            const followUpMsg = "⚠️ RESCHEDULE PENDING: " + rc.firstName + " " + rc.lastName + " was texted about rescheduling their " + (rjob.scheduledDate || "") + " job. Follow up if no response in 24h. Address: " + rjob.address;
            if (settings.myPhone) setTimeout(() => twilioSend(settings, settings.myPhone, followUpMsg).catch(() => {}), 24 * 60 * 60 * 1000); // reminder after 24h
            return "📱 RESCHEDULE SENT\n\nTexted: " + rc.firstName + " " + rc.lastName + " (" + rc.phone + ")\n\n\"" + clientMsg.slice(0, 100) + "...\"\n\nJob: " + rjob.scheduledDate + " — " + rjob.address + willFollowUp + "\n\nWatch Inbox for their reply. Alfred out.";
          } catch (e) {
            return "SMS failed: " + e.message + "\n\nManual draft:\nTo: " + rc.phone + "\n" + clientMsg + "\n\nAlfred out.";
          }
        }
        // No Twilio — open SMS app
        window.location.href = "sms:" + (rc.phone || "").replace(/\D/g,"") + "?body=" + encodeURIComponent(clientMsg);
        return "📱 SMS app opened with reschedule message for " + rc.firstName + ". Connect Twilio in Settings for automatic sending. Alfred out.";
      }
      case "/override": {
        const todayJobs = jobs.filter(j => j.scheduledDate === t && j.status === "scheduled");
        if (todayJobs.length === 0) return "No scheduled jobs today to override. Alfred out.";
        return "⚠️ WEATHER OVERRIDE\n\nToday's jobs (" + todayJobs.length + "):\n" + todayJobs.map(j => "• " + j.address?.split(",")[0]).join("\n") + "\n\nWeather risk overridden. Proceeding with scheduled jobs. Flag individual jobs as 'weather override' in job detail if needed.\n\nAlfred out.";
      }
      case "/slack":
        if (!args) return "USAGE: /slack [metric]. Example: /slack revenue Alfred out.";
        return "🔥 TARGETED ROAST — " + args.toUpperCase() + "\n\n" + args + " isn't going to improve by itself. What's the plan? Set a goal with /goal or close a quote with /followup. Alfred out.";
      case "/followup":
        const stale2 = estimates.filter(e => e.status === "pending" && daysSince(e.createdAt) >= 3).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        if (stale2.length === 0) return "✅ No stale quotes. All current. Alfred out.";
        return "📞 FOLLOW-UP HITLIST\n\n" + stale2.slice(0, 5).map(e => {
          const c = customers.find(x => x.id === e.customerId);
          return "• " + (c?.firstName || "?") + " " + (c?.lastName || "") + " — " + fmt(e.total) + " (" + daysSince(e.createdAt) + "d old)";
        }).join("\n") + "\n\nCall them. Alfred out.";
      case "/weather":
        return "🌤️ WEATHER\n\nCheck Dashboard for the 7-day forecast. High rain chance = call ahead and reschedule before customers do. Alfred out.";
      case "/top":
        const top = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);
        return "🏆 TOP CUSTOMERS\n\n" + top.map((c, i) => (i + 1) + ". " + c.firstName + " " + c.lastName + " — " + fmt(c.totalSpent)).join("\n") + "\n\nTreat them like gold. Alfred out.";
      case "/remember":
        if (!args) return "USAGE: /remember [fact]. Alfred out.";
        setMemory(m => [...m, { id: uid(), text: args, createdAt: t }]);
        return "🧠 NOTED: \"" + args + "\"\n\nSaved to memory. Alfred out.";
      case "/forget":
        if (!args) return "USAGE: /forget [keyword]. Alfred out.";
        const removed = memory.filter(m => m.text.toLowerCase().includes(args.toLowerCase())).length;
        setMemory(m => m.filter(mem => !mem.text.toLowerCase().includes(args.toLowerCase())));
        return removed ? "🧹 FORGOT " + removed + " item(s) matching \"" + args + "\". Alfred out." : "Nothing matched. Alfred out.";
      case "/automations":
        const autoList = automations.slice(0, 8).map((a, i) => `${i + 1}. ${a.icon || "⚡"} ${a.name} — ${a.active ? "ON" : "OFF"} · ran ${a.count || 0}x`).join("\n");
        return `⚡ AUTOMATIONS\n\n${automations.length} workflows (${automations.filter(a => a.active).length} active)\n\n${autoList || "No automations yet."}\n\nTell me to build one. Alfred out.`;
      case "/help":
        return "🛠️ COMMANDS\n\n/rollcall  /debrief  /status\n/quote [name] [service] [$]  → create estimate\n/route  /schedule [name]  /reschedule [name]\n/nearby [what]  → Google Maps search\n/followup  /top  /weather\n/compete  /motivate  /savagemode\n/accountability  /proud [win]\n/goal [text|$]  /reflect\n/weekly  /monthly\n/remember [fact]  /forget [keyword]\n/post [caption]  /review send [name]\n/automations  → list workflows\n/help  → this list\n\nOr just talk to me naturally. Alfred out.";
      default:
        return null;
    }
  };

  // When a name lookup misses an exact match, surface the closest candidates
  // (substring match either direction, or shared first name) instead of a
  // bare "not found" — that's what lets Alfred ask "Do you mean X?" with
  // real suggestions instead of a generic follow-up question.
  const suggestNames = (query: string, list: any[], nameFn: (t: any) => string, limit = 3): string[] => {
    const q = (query || "").toLowerCase().trim();
    if (!q) return [];
    const scored = list
      .map(item => {
        const name = nameFn(item).toLowerCase();
        let score = 0;
        if (name.includes(q) || q.includes(name)) score = 3;
        else if (name.split(" ").some(part => part && (part.startsWith(q) || q.startsWith(part)))) score = 2;
        else if (name.split(" ").some(part => q.split(" ").some(qp => qp && part.startsWith(qp.slice(0, 3))))) score = 1;
        return { name: nameFn(item), score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(x => x.name);
  };

  // ===== ALFRED TOOL DEFINITIONS =====
  // Tools Alfred can invoke to read/modify the CRM. Each returns a JSON-serializable result.
  // CRITICAL — every single call funnels through this one wrapper (not
  // scattered per-case logging) so "[AlfredTool] logs for EVERY tool call"
  // is actually guaranteed rather than depending on each of the 25+ cases
  // remembering to log itself. Logs name + inputs before dispatch, then the
  // real outcome (the tool's actual return value, which for write tools IS
  // the Supabase response or an error derived from it) after.
  // FEATURE — "let owners checkmark what access and capabilities Alfred
  // has — full access or select specific permissions." settings.
  // alfredCapabilities gates the WRITE-ish/outbound tool groups (a read-only
  // question like "what's on the calendar" or "remember this" always still
  // works even with everything off — only actions that create/send/change
  // something are gated). Defaults to true for every category so an
  // existing owner's Alfred keeps behaving exactly as it always has until
  // they explicitly turn something off in Settings → Alfred → Capabilities.
  // FEATURE — "there aren't many options for giving capabilities; there
  // should be more specific and individualized ones." The original 6 broad
  // buckets (customers/jobs/estimates/messaging/automations/calendar) forced
  // an all-or-nothing choice within each — an owner who wanted Alfred to
  // message individual customers but never blast the whole customer list
  // (notify_all_customers) had no way to allow one without the other. Split
  // into 16 specific tool groups instead. Every tool this granular map
  // doesn't mention (read-only lookups, reminders, memory) stays ungated,
  // same as before.
  const ALFRED_TOOL_CAPABILITY: Record<string, string> = {
    create_customer: "add_customers", attach_file_to_customer: "add_customers", update_customer: "add_customers",
    schedule_job: "schedule_jobs",
    reschedule_job: "modify_jobs", cancel_job: "modify_jobs", update_job_priority: "modify_jobs", add_checklist_item: "modify_jobs", attach_file_to_job: "modify_jobs",
    assign_employee: "manage_crew", request_employee: "manage_crew", respond_to_job_request: "manage_crew",
    approve_customer_request: "manage_crew", decline_customer_request: "manage_crew", move_candidate_phase: "manage_crew",
    create_estimate: "create_quotes", create_invoice: "create_quotes", mark_invoice_paid: "create_quotes",
    send_estimate: "send_quotes",
    send_reminder: "message_customers", text_phone_number: "message_customers",
    notify_all_customers: "mass_messaging", send_bulk_text: "mass_messaging", set_birthday_offer: "mass_messaging", create_campaign: "automations",
    text_supplier: "message_suppliers", email_supplier: "message_suppliers", contact_general_supplier: "message_suppliers",
    send_email_via_gmail: "send_email",
    text_me_document: "send_files", send_me_files: "send_files",
    create_automation: "automations", toggle_automation: "automations", enable_review_request_automation: "automations", respond_to_review: "automations",
    create_sop: "sops",
    set_vacation_mode: "vacation_mode",
    create_calendar_event: "calendar", update_calendar_event: "calendar", delete_calendar_event: "calendar",
    create_google_task: "drive_tasks", upload_to_drive: "drive_tasks",
  };
  // Legacy -> granular migration: an owner who previously turned OFF one of
  // the 6 old broad categories should have every new key that used to live
  // under it stay off too, until they explicitly touch it in the (now more
  // granular) Settings UI — never silently re-enable something they'd
  // already restricted just because the setting's key name changed.
  const ALFRED_LEGACY_GROUP: Record<string, string> = {
    add_customers: "customers",
    schedule_jobs: "jobs", modify_jobs: "jobs", manage_crew: "jobs",
    create_quotes: "estimates", send_quotes: "estimates",
    message_customers: "messaging", mass_messaging: "messaging", message_suppliers: "messaging", send_email: "messaging", send_files: "messaging",
    automations: "automations", sops: "automations", vacation_mode: "automations",
    calendar: "calendar", drive_tasks: "calendar",
  };
  const alfredCapabilities = (() => {
    const raw = (settings as any)?.alfredCapabilities || {};
    const out: Record<string, boolean> = {};
    for (const key of Object.keys(ALFRED_LEGACY_GROUP)) {
      if (raw[key] !== undefined) { out[key] = raw[key]; continue; }
      const legacy = ALFRED_LEGACY_GROUP[key];
      out[key] = raw[legacy] !== undefined ? raw[legacy] : true;
    }
    return out;
  })();

  // FEATURE — "build that autonomy level thing... make sure it works the
  // same for vacation mode and normal Alfred in general... every owner
  // sets their own personalized permissions." Same logic, same tool
  // taxonomy, and same enforcement mechanism as functions/api/_lib/
  // alfredSmsAgent.ts's mirror of this — see that file's matching comment
  // for the full reasoning (duplicated rather than shared since this file
  // is a browser bundle and that one's a separate Cloudflare Function
  // runtime, no common import path between them).
  // Resolution order: an ACTIVE vacation-mode window's own autonomyLevel
  // is a temporary override (same active+date-range check used everywhere
  // else vacation mode is checked); otherwise the owner's standing
  // (non-vacation) alfredAutonomyLevel applies. A MISSING value resolves
  // to "manage_everything" (today's real behavior), not "ask_first" —
  // every account that existed before this setting did must never start
  // getting its actions silently queued just because it's unset.
  const resolveEffectiveAutonomy = (): "manage_everything" | "ask_first" | "hold_everything" => {
    const vac = (settings as any)?.vacationMode;
    if (vac?.active && vac.autonomyLevel) {
      const t = today();
      const inWindow = !vac.startDate || !vac.endDate || (t >= vac.startDate && t <= vac.endDate);
      if (inWindow) return vac.autonomyLevel;
    }
    return (settings as any)?.alfredAutonomyLevel || "manage_everything";
  };
  // Never autonomy-gated — gating these would deadlock the owner out of
  // changing their own mind (hold_everything blocking the tool that turns
  // it off) or out of clearing their own approval queue.
  const AUTONOMY_EXEMPT_TOOLS = new Set([
    "set_vacation_mode", "set_autonomy_level",
    "list_pending_approvals", "approve_pending_action", "decline_pending_action",
    "list_pending_customer_requests", "approve_customer_request", "decline_customer_request",
  ]);
  const describeActionForOwner = (name: string, inputs: Record<string, any>): string => {
    switch (name) {
      case "text_phone_number": return `text "${String(inputs.message || "").slice(0, 80)}" to ${inputs.phone || "a number"}`;
      case "notify_all_customers": return `text every customer: "${String(inputs.message || "").slice(0, 80)}"`;
      case "send_reminder": return `send a ${inputs.channel || "message"} to ${inputs.customerName || inputs.customerId || "a customer"}: "${String(inputs.message || "").slice(0, 80)}"`;
      case "send_estimate": return `send estimate ${inputs.estimateId || ""} to the customer`;
      case "reschedule_job": return `reschedule job ${inputs.jobId || ""} to ${inputs.newDate || ""}`;
      case "cancel_job": return `cancel job ${inputs.jobId || ""}`;
      case "assign_employee": return `assign an employee to job ${inputs.jobId || ""}`;
      case "request_employee": return `request an employee for job ${inputs.jobId || ""}`;
      case "apply_discount_to_estimate": return `apply a discount to estimate ${inputs.estimateId || ""}`;
      case "update_job_price": return `change the price on job ${inputs.jobId || ""}`;
      case "mark_invoice_paid": return `mark invoice ${inputs.invoiceId || ""} as paid`;
      case "respond_to_review": return `post a reply to a review`;
      case "text_supplier": case "email_supplier": case "contact_general_supplier": return `contact a supplier: "${String(inputs.message || "").slice(0, 80)}"`;
      case "send_email_via_gmail": return `send an email: "${inputs.subject || ""}"`;
      case "delete_calendar_event": return `delete a calendar event`;
      case "create_automation": return `create an automation${inputs.name ? ": " + inputs.name : ""}`;
      case "toggle_automation": return `turn ${inputs.enabled === false ? "off" : "on"} an automation`;
      default: return `run "${name}"`;
    }
  };

  // BUG FIX — "assign employee to the job I just scheduled" (in the SAME
  // Alfred turn) failed with "Job not found" even though schedule_job had
  // just verified the row exists in Supabase. Root cause: schedule_job's
  // setJobs(prev => [...prev, newJ]) only SCHEDULES a React state update —
  // it doesn't take effect until the next render, but every case handler in
  // this same executeTool closure keeps reading the `jobs` variable
  // captured at THIS render, which is still the array from before the new
  // job existed. Every later round in the same multi-tool-call turn (a
  // fresh microtask, same render) sees the identical stale `jobs`. A direct
  // Supabase fallback closes this for good — it's also correct for the
  // more general case (a job created moments ago on another device/tab
  // whose poll hasn't landed yet), not just the same-turn case.
  const findJobFresh = async (opts: { jobId?: string; customerName?: string }): Promise<any> => {
    if (opts.jobId) {
      const local = jobs.find((x: any) => x.id === opts.jobId);
      if (local) return local;
      try {
        const { data } = await withTimeout<any>(
          (supabase as any).from("jobs").select("*").eq("id", opts.jobId).maybeSingle(),
          8000, "Fresh job lookup"
        );
        if (data) return data;
      } catch { /* fall through to customerName below, or the caller's not-found handling */ }
    }
    if (opts.customerName) {
      const cust = customers.find((x: any) => (x.firstName + " " + x.lastName).trim().toLowerCase() === opts.customerName!.trim().toLowerCase());
      if (!cust) return null;
      const localMatch = jobs.filter((x: any) => x.customerId === cust.id && x.status !== "cancelled")
        .sort((a: any, b: any) => (b.scheduledDate || "").localeCompare(a.scheduledDate || ""))[0];
      if (localMatch) return localMatch;
      try {
        const { data } = await withTimeout<any>(
          (supabase as any).from("jobs").select("*").eq("customerId", cust.id).neq("status", "cancelled").order("createdAt", { ascending: false }).limit(1).maybeSingle(),
          8000, "Fresh job lookup"
        );
        if (data) return data;
      } catch { /* nothing found either way */ }
    }
    return null;
  };

  // BUG FIX (user report) — "the system is reporting customer not found...
  // Mission abort." Root cause: create_customer deliberately never calls
  // setCustomers() (it relies on the ~3s cross-device Supabase poll — see
  // that case's own comment), so a same-turn "create these customers, then
  // schedule jobs for them" chain had schedule_job/create_estimate/
  // create_invoice looking the brand-new customer up in the STALE local
  // `customers` array, which genuinely doesn't have it yet — exact same
  // staleness findJobFresh above already exists to fix for jobs, just never
  // applied to customer lookups. Falls back to a direct Supabase read (by
  // id, or by name if no id) when the local array comes up empty.
  const findCustomerFresh = async (opts: { customerId?: string; customerName?: string }): Promise<any> => {
    if (opts.customerId) {
      const local = customers.find((x: any) => x.id === opts.customerId);
      if (local) return local;
      try {
        const { data } = await withTimeout<any>(
          (supabase as any).from("customers").select("*").eq("id", opts.customerId).maybeSingle(),
          8000, "Fresh customer lookup"
        );
        if (data) return data;
      } catch { /* fall through to customerName below, or the caller's not-found handling */ }
    }
    if (opts.customerName) {
      const wanted = opts.customerName.trim().toLowerCase();
      const localMatch = customers.find((x: any) => (x.firstName + " " + x.lastName).trim().toLowerCase() === wanted);
      if (localMatch) return localMatch;
      try {
        // No case-insensitive "firstName+lastName" match server-side without
        // a computed column — pull the most recently created customers and
        // match client-side, which is exactly the set a same-turn-created
        // customer would be in.
        const { data } = await withTimeout<any>(
          (supabase as any).from("customers").select("*").order("createdAt", { ascending: false }).limit(50),
          8000, "Fresh customer lookup"
        );
        const match = (data || []).find((x: any) => (x.firstName + " " + x.lastName).trim().toLowerCase() === wanted);
        if (match) return match;
      } catch { /* nothing found either way */ }
    }
    return null;
  };

  // FEATURE (user report) — "Alfred should remember what it did last... a
  // day later — or even five minutes later — 'undo that' / 'what did you
  // do' / 'delete those' / 'change them,' it should know what I'm
  // referring to." UNDO_HANDLERS is payload-driven (not closure-driven) so
  // an action can be reconstructed and reversed from a plain JSON payload
  // — either the in-memory lastActionsRef (this session) or a row read
  // back from alfred_actions_log (migration 0099, any session, any day)
  // once this one is gone. Deliberately scoped to what's cleanly reversible
  // — a sent SMS/email can't be unsent, so those tools are never listed.
  const lastActionsRef = useRef<Array<{ id: string; label: string; toolName: string; payload: any }>>([]);
  // BUG FIX (user report) — "if it's a bunch of jobs, I'm getting doubled
  // [up] emails... instead of sending a bunch of individual emails it
  // should just show them all in it." schedule_job's inline employeeName
  // assignment and the standalone assign_employee tool each used to email
  // the crew member the instant THEY ran — a bulk import assigning one
  // employee to 11 jobs in one turn meant 11 separate "You've Been
  // Assigned" emails. Both now push into this ref instead of sending
  // immediately; flushAssignmentEmails (called once, after the whole turn's
  // tool-calling is done — see its call site in send()) sends ONE email per
  // employee summarizing every job from this turn.
  const pendingAssignmentEmailsRef = useRef<Record<string, { employeeFirstName: string; jobId: string; date: string; time: string; address: string; customerName: string; duration?: number }[]>>({});
  const subtractMinutes = (time: string, mins: number): string => {
    const [h, m] = time.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return time;
    const total = ((h * 60 + m - mins) % 1440 + 1440) % 1440;
    return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
  };
  const flushAssignmentEmails = async () => {
    const byEmail = pendingAssignmentEmailsRef.current;
    pendingAssignmentEmailsRef.current = {};
    const portalLink = `${window.location.origin}${window.location.pathname}#/portal`;
    for (const empEmail of Object.keys(byEmail)) {
      const entries = byEmail[empEmail];
      if (!entries || entries.length === 0) continue;
      const empFirstName = entries[0].employeeFirstName;
      const sorted = [...entries].sort((a, b) => (a.date + (a.time || "23:59")).localeCompare(b.date + (b.time || "23:59")));
      try {
        if (sorted.length === 1) {
          const j = sorted[0];
          const html = emailShell(settings, "Job Assignment", `<p>Hi ${empFirstName},</p><p>You've been assigned to a job:</p><ul><li><b>Date:</b> ${j.date}${j.time ? " at " + j.time : ""}</li><li><b>Address:</b> ${j.address}</li>${j.customerName ? `<li><b>Customer:</b> ${j.customerName}</li>` : ""}</ul>` + emailButton("Open Crew Portal", portalLink));
          await sendEmail(settings, { to: empEmail, subject: `You've Been Assigned — ${j.date}`, body: html });
        } else {
          const first = sorted[0];
          const totalHours = sorted.reduce((s, j) => s + (Number(j.duration) || 2), 0);
          const leaveTime = first.time ? subtractMinutes(first.time, 30) : null;
          const rows = sorted.map(j => `<li>${j.time ? j.time + " — " : ""}${j.customerName || "Customer"} (${j.address})</li>`).join("");
          const summary = `<p>Hi ${empFirstName},</p><p>You've been assigned ${sorted.length} new jobs for ${first.date}:</p><ul>${rows}</ul><p>Estimated total work time: ~${totalHours} hour${totalHours !== 1 ? "s" : ""}.${first.time ? ` First job at ${first.time}${leaveTime ? ` — plan to leave by about ${leaveTime} to be on time` : ""}.` : ""}</p>`;
          const html = emailShell(settings, "New Jobs Assigned", summary);
          await sendEmail(settings, { to: empEmail, subject: `${sorted.length} New Jobs Assigned — ${first.date}`, body: html });
        }
      } catch (e: any) {
        console.warn("[Alfred] assignment-summary email failed for", empEmail, ":", e?.message);
      }
    }
  };
  const UNDO_HANDLERS: Record<string, {
    label: (result: any) => string;
    before?: (inputs: any) => any;
    payload: (result: any, inputs: any, before: any) => Record<string, any>;
    undo: (payload: Record<string, any>) => Promise<{ success: boolean; message: string }>;
  }> = {
    create_customer: {
      label: (result) => `creating the customer ${result?.customer?.firstName || ""} ${result?.customer?.lastName || ""}`.trim(),
      payload: (result) => ({ customerId: result?.customer?.id, reused: !!result?.note, firstName: result?.customer?.firstName, lastName: result?.customer?.lastName }),
      undo: async (p) => {
        if (!p.customerId || p.reused) return { success: false, message: "That customer already existed before this — nothing to delete." };
        const { data, error } = await (supabase as any).from("customers").delete().eq("id", p.customerId).select("id");
        if (error || !Array.isArray(data) || data.length === 0) return { success: false, message: "Couldn't delete the customer — " + (error?.message || "no matching row, likely already deleted") };
        setCustomers((prev: any[]) => prev.filter((x: any) => x.id !== p.customerId));
        return { success: true, message: `Deleted customer ${p.firstName} ${p.lastName}.` };
      },
    },
    schedule_job: {
      label: (result) => `scheduling the job for ${result?.customer || "that customer"}${result?.date ? " on " + result.date : ""}`,
      payload: (result) => ({ jobId: result?.jobId }),
      undo: async (p) => {
        if (!p.jobId) return { success: false, message: "No job id was recorded for that action." };
        const { data, error } = await (supabase as any).from("jobs").delete().eq("id", p.jobId).select("id");
        if (error || !Array.isArray(data) || data.length === 0) return { success: false, message: "Couldn't delete the job — " + (error?.message || "no matching row, likely already deleted") };
        setJobs((prev: any[]) => prev.filter((x: any) => x.id !== p.jobId));
        return { success: true, message: "Deleted that job." };
      },
    },
    create_estimate: {
      label: (result) => `creating the estimate for ${result?.customer || "that customer"}`,
      payload: (result) => ({ estimateId: result?.estimateId }),
      undo: async (p) => {
        if (!p.estimateId) return { success: false, message: "No estimate id was recorded for that action." };
        const { data, error } = await (supabase as any).from("estimates").delete().eq("id", p.estimateId).select("id");
        if (error || !Array.isArray(data) || data.length === 0) return { success: false, message: "Couldn't delete the estimate — " + (error?.message || "no matching row, likely already deleted") };
        setEstimates((prev: any[]) => prev.filter((x: any) => x.id !== p.estimateId));
        return { success: true, message: "Deleted that estimate." };
      },
    },
    create_invoice: {
      label: (result) => `creating the invoice for ${result?.customer || "that customer"}`,
      payload: (result) => ({ invoiceId: result?.invoiceId }),
      undo: async (p) => {
        if (!p.invoiceId) return { success: false, message: "No invoice id was recorded for that action." };
        const { data, error } = await (supabase as any).from("estimates").delete().eq("id", p.invoiceId).select("id");
        if (error || !Array.isArray(data) || data.length === 0) return { success: false, message: "Couldn't delete the invoice — " + (error?.message || "no matching row, likely already deleted") };
        setEstimates((prev: any[]) => prev.filter((x: any) => x.id !== p.invoiceId));
        return { success: true, message: "Deleted that invoice." };
      },
    },
    assign_employee: {
      label: (result) => `assigning ${result?.employee || "that employee"} to the job`,
      payload: (result) => ({ jobId: result?.jobId, employeeId: result?.employeeId, employee: result?.employee }),
      undo: async (p) => {
        if (!p.jobId || !p.employeeId) return { success: false, message: "No job/employee id was recorded for that action." };
        const j = await findJobFresh({ jobId: p.jobId });
        if (!j) return { success: false, message: "Couldn't find that job anymore." };
        const newCrew = (j.crew || []).filter((id: string) => id !== p.employeeId);
        const newCrewAssignedAt = { ...(j.crewAssignedAt || {}) };
        delete newCrewAssignedAt[p.employeeId];
        const { error } = await (supabase as any).from("jobs").update({ crew: newCrew, crewAssignedAt: newCrewAssignedAt }).eq("id", p.jobId).select("id");
        if (error) return { success: false, message: "Couldn't revert the assignment — " + error.message };
        setJobs((prev: any[]) => prev.map((x: any) => x.id === p.jobId ? { ...x, crew: newCrew, crewAssignedAt: newCrewAssignedAt } : x));
        return { success: true, message: `Removed ${p.employee || "that employee"} from the job.` };
      },
    },
    reschedule_job: {
      label: (result) => `rescheduling the job to ${result?.newDate || "that date"}`,
      before: (inputs) => { const j = jobs.find((x: any) => x.id === inputs.jobId); return j ? { scheduledDate: j.scheduledDate, scheduledTime: j.scheduledTime } : null; },
      payload: (result, _inputs, before) => ({ jobId: result?.jobId, before }),
      undo: async (p) => {
        if (!p.before || !p.jobId) return { success: false, message: "The previous date wasn't captured, so this can't be safely reverted." };
        const { error } = await (supabase as any).from("jobs").update(p.before).eq("id", p.jobId).select("id");
        if (error) return { success: false, message: "Couldn't revert the reschedule — " + error.message };
        setJobs((prev: any[]) => prev.map((x: any) => x.id === p.jobId ? { ...x, ...p.before } : x));
        return { success: true, message: `Moved the job back to ${p.before.scheduledDate}${p.before.scheduledTime ? " at " + p.before.scheduledTime : ""}.` };
      },
    },
    cancel_job: {
      label: () => `cancelling that job`,
      before: (inputs) => { const j = jobs.find((x: any) => x.id === inputs.jobId); return j ? { status: j.status } : null; },
      payload: (result, _inputs, before) => ({ jobId: result?.jobId, before }),
      undo: async (p) => {
        if (!p.before || !p.jobId) return { success: false, message: "The previous status wasn't captured, so this can't be safely reverted." };
        const { error } = await (supabase as any).from("jobs").update({ status: p.before.status }).eq("id", p.jobId).select("id");
        if (error) return { success: false, message: "Couldn't un-cancel the job — " + error.message };
        setJobs((prev: any[]) => prev.map((x: any) => x.id === p.jobId ? { ...x, status: p.before.status } : x));
        return { success: true, message: "Un-cancelled that job." };
      },
    },
  };

  // Bulk texts are drafted first and only sent after the owner answers (see
  // notify_all_customers / send_bulk_text) — same rule as text-Alfred.
  // turnStartRef marks when the owner's current message started being
  // handled, so a draft made during it can't be sent until they reply.
  const bulkDraftsRef = useRef<Map<string, { id: string; message: string; recipients: any[]; createdAt: number; watchReplies?: any; campaignName?: string }>>(new Map());
  const turnStartRef = useRef(0);
  // Big lists for import (attached spreadsheets, long pastes) are kept here
  // instead of being sent to the model whole — see prepare_import below.
  const importBatchesRef = useRef<Map<string, { id: string; kind: "table" | "text"; name: string; headers?: string[]; data?: string[][]; text?: string; createdAt: number }>>(new Map());
  const importPlansRef = useRef<Map<string, ImportPlan>>(new Map());
  const directSendsRef = useRef(0);
  const executeTool = async (name, inputs) => {
    const __t0 = Date.now();
    console.log("[AlfredTool] → call:", name, "input:", inputs);
    // Undo — snapshot whatever "before" state a reversible tool needs
    // BEFORE it runs (e.g. a job's date/status prior to reschedule/cancel).
    // Must happen before executeToolCore, not after — by then the row's
    // already changed and there's nothing left to snapshot.
    const __undoHandler = UNDO_HANDLERS[name];
    const __before = __undoHandler?.before ? __undoHandler.before(inputs) : undefined;
    let __result;
    try {
      const cap = ALFRED_TOOL_CAPABILITY[name];
      if (cap && alfredCapabilities[cap] === false) {
        __result = { error: `The owner has turned off Alfred's "${cap}" capability in Settings → Alfred → Capabilities — this action can't be performed until they turn it back on.` };
      } else if (cap && !AUTONOMY_EXEMPT_TOOLS.has(name) && resolveEffectiveAutonomy() !== "manage_everything") {
        const autonomy = resolveEffectiveAutonomy();
        const summary = describeActionForOwner(name, inputs);
        if (autonomy === "hold_everything") {
          __result = { error: `Your autonomy level is set to "hold everything," so Alfred won't ${summary} on its own right now. Say "set autonomy to ask first" or "manage everything" if you want Alfred to act again.` };
        } else {
          // ask_first — queue instead of running it now (same
          // alfred_pending_actions table/flow the customer-reschedule
          // proposal cases above use, generalized via
          // kind:"action_confirmation" — see migration 0096).
          const id = uid();
          const insertRes = await (supabase as any).from("alfred_pending_actions").insert({ id, owner_id: ownerId, kind: "action_confirmation", proposed: { toolName: name, input: inputs, summary }, status: "pending", created_at: new Date().toISOString() });
          if (insertRes?.error) {
            __result = { error: "Couldn't queue this for your approval — " + insertRes.error.message };
          } else {
            __result = { success: true, awaitingApproval: true, actionId: id, summary, message: `Queued for your approval — I'll ${summary} once you approve it.` };
          }
        }
      } else {
        __result = await executeToolCore(name, inputs);
      }
    } catch (err: any) {
      __result = { error: err?.message || String(err) };
    }
    // Undo — a successful reversible action is recorded so a later
    // confirmed "undo that" (see undo_last_action) can reverse it. Kept
    // in-memory for a fast same-session undo AND persisted to
    // alfred_actions_log (migration 0099) so "undo that" / "what did you
    // do" still works after a reload, a new tab, or the next day.
    if (__undoHandler && __result && !__result.error && __result.success) {
      const __payload = __undoHandler.payload(__result, inputs, __before);
      const __label = __undoHandler.label(__result);
      const __actionId = uid();
      lastActionsRef.current.push({ id: __actionId, label: __label, toolName: name, payload: __payload });
      if (lastActionsRef.current.length > 20) lastActionsRef.current.shift();
      (supabase as any).from("alfred_actions_log").insert({
        id: __actionId, owner_id: ownerId, tool_name: name, label: __label, undo_kind: name, undo_payload: __payload, created_at: new Date().toISOString(),
      }).then((r: any) => { if (r?.error) console.warn("[AlfredTool] action-log insert failed (undo will still work this session):", r.error.message); })
        .catch((e: any) => console.warn("[AlfredTool] action-log insert threw:", e?.message));
    }
    const __ms = Date.now() - __t0;
    if (__result && __result.error) {
      console.error("[AlfredTool] ✗ FAILED:", name, "(" + __ms + "ms) — error:", __result.error, "· full result:", __result);
    } else {
      console.log("[AlfredTool] ✓ OK:", name, "(" + __ms + "ms) — result:", __result);
    }
    return __result;
  };

  const executeToolCore = async (name, inputs) => {
    try {
      switch (name) {
        // Whole-CRM search (lib/customerAudit.ts): every word against name
        // (typos, nicknames, sound-alikes), phone, email, address, company,
        // tags, notes. Falls back to the old exact-fragment match.
        case "search_customers": {
          const fuzzy = auditSearch(customers as any[], String(inputs.query || ""), 25);
          if (fuzzy.total) {
            const byId = new Map((customers as any[]).map((c: any) => [c.id, c]));
            return { count: fuzzy.total, showing: fuzzy.results.length, customers: fuzzy.results.map(r => { const c: any = byId.get(r.id) || {}; return { ...r, totalSpent: c.totalSpent, notes: c.notes, tags: c.tags, smsOptOut: !!c.smsOptOut }; }) };
          }
          const q = (inputs.query || "").toLowerCase();
          const results = customers.filter(c => (c.firstName + " " + c.lastName + " " + (c.email || "") + " " + (c.address || "")).toLowerCase().includes(q)).slice(0, 10).map(c => ({
            id: c.id, name: c.firstName + " " + c.lastName, email: c.email, phone: c.phone, address: c.address, totalSpent: c.totalSpent, notes: c.notes,
            // BUG FIX (Alfred customer-texting audit) — smsOptOut wasn't
            // surfaced here, only in get_customer_details' full-object
            // return, so a search-first lookup couldn't tell a texting tool
            // wasn't going to work before actually trying it.
            smsOptOut: !!(c as any).smsOptOut,
          }));
          return { count: results.length, customers: results };
        }
        case "find_duplicate_customers": {
          const r = findDuplicateCustomers(customers as any[], { includePossible: inputs.includePossible !== false });
          return { success: true, customersChecked: r.customersChecked, groupsFound: r.groups.length, groups: r.groups.slice(0, 60), note: r.groups.length > 60 ? `${r.groups.length - 60} more groups not shown.` : undefined };
        }
        case "customers_missing_info": {
          return { success: true, ...customersMissingInfo(customers as any[], Array.isArray(inputs.fields) ? inputs.fields : undefined, 60) };
        }
        case "filter_customers": {
          const { ...f } = inputs || {};
          return { success: true, ...filterCustomers(customers as any[], jobs as any[], f, 60) };
        }
        case "get_customer_details": {
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.name });
          if (!c) {
            const suggestions = suggestNames(inputs.name || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          const cJobs = jobs.filter(j => j.customerId === c.id);
          const cEsts = estimates.filter(e => e.customerId === c.id);
          return {
            customer: c,
            jobCount: cJobs.length,
            totalSpent: c.totalSpent,
            recentJobs: cJobs.slice(-3).map(j => ({ date: j.scheduledDate, amount: j.amount, status: j.status })),
            estimates: cEsts.map(e => ({ id: e.id, total: e.total, status: e.status, createdAt: e.createdAt }))
          };
        }
        case "attach_file_to_customer": {
          const pending = lastAttachedFileRef.current;
          if (!pending) return { error: "No file has been uploaded in this conversation yet — use the paperclip button to attach one first." };
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.name });
          if (!c) {
            const suggestions = suggestNames(inputs.name || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          const newDoc = { id: uid(), name: pending.fileName, url: pending.url, category: inputs.category || "Document", uploadedAt: today() };
          const docs = [...(Array.isArray((c as any).documents) ? (c as any).documents : []), newDoc];
          setCustomers((prev: Customer[]) => prev.map(x => x.id === c.id ? { ...x, documents: docs } as any : x));
          const res = await (supabase as any).from("customers").update({ documents: docs }).eq("id", c.id).select("id");
          if (res?.error) return { error: res.error.message };
          if (!Array.isArray(res?.data) || res.data.length === 0) return { error: "Save didn't match this customer's record." };
          lastAttachedFileRef.current = null;
          toast(`Saved "${pending.fileName}" to ${c.firstName} ${c.lastName}'s file ✓`);
          return { success: true, savedTo: `${c.firstName} ${c.lastName}`, fileName: pending.fileName };
        }
        case "get_customer_documents": {
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.name });
          if (!c) {
            const suggestions = suggestNames(inputs.name || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          const docs = Array.isArray((c as any).documents) ? (c as any).documents : [];
          if (docs.length === 0) return { success: true, name: `${c.firstName} ${c.lastName}`, documents: [], note: "No documents on file for this customer." };
          return { success: true, name: `${c.firstName} ${c.lastName}`, documents: docs.map((d: any) => ({ name: d.name, category: d.category, uploadedAt: d.uploadedAt, textable: !!d.url })) };
        }
        case "text_me_document": {
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.name });
          if (!c) {
            const suggestions = suggestNames(inputs.name || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          const docs = Array.isArray((c as any).documents) ? (c as any).documents : [];
          const q = String(inputs.documentName || "").toLowerCase().trim();
          const doc = docs.find((d: any) => (d.name || "").toLowerCase() === q) || docs.find((d: any) => (d.name || "").toLowerCase().includes(q));
          if (!doc) return { error: `No document matching "${inputs.documentName}" found for ${c.firstName}. On file: ${docs.map((d: any) => d.name).join(", ") || "none"}.` };
          if (!doc.url) return { error: `"${doc.name}" only exists on the device that uploaded it (not cloud-synced) — can't text it. Re-upload it in the customer's Document Vault to fix this.` };
          const myPhone = (settings as any)?.myPhone;
          if (!myPhone) return { error: "No phone number saved for you yet — add one in Settings → Company first." };
          if (!settings?.twilioSid) return { error: "Twilio isn't configured — add credentials in Settings → API Keys." };
          try {
            await withTimeout(twilioSend(settings as any, myPhone, `${doc.name} — ${c.firstName} ${c.lastName}: ${doc.url}`), 15000, "Document text");
          } catch (e: any) { return { error: "SMS failed: " + (e?.message || String(e)) }; }
          toast(`Alfred texted you "${doc.name}" ✓`);
          return { success: true, sent: doc.name };
        }
        // FEATURE — "do you remember this client? send me the PDFs/photos
        // for this job" / "send me anything we have in the vault for them."
        // Pulls from BOTH customer.documents (the Vault) AND job.photos/
        // job.videos (optionally scoped to one job), and can deliver either
        // as a text (a plain SMS with the links, same pattern text_me_document
        // already used) or an email (branded, one button per file/job).
        // Never invents a file — only ever lists/sends what's actually on
        // that customer's real records.
        case "send_me_files": {
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.name });
          if (!c) {
            const suggestions = suggestNames(inputs.name || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          const docs = Array.isArray((c as any).documents) ? (c as any).documents : [];
          const custJobs = jobs.filter((j: any) => j.customerId === c.id && (!inputs.jobId || j.id === inputs.jobId));
          const q = String(inputs.fileQuery || "").toLowerCase().trim();
          const matchedDocs = docs.filter((d: any) => d.url && (!q || (d.name || "").toLowerCase().includes(q)));
          const jobPhotos = custJobs.flatMap((j: any) => (j.photos || []).filter((p: any) => p?.url).map((p: any) => ({ name: `Photo — ${j.address || "job"}`, url: p.url })));
          const jobVideos = custJobs.flatMap((j: any) => (j.videos || []).filter((v: any) => v?.url).map((v: any) => ({ name: `Video — ${j.address || "job"}`, url: v.url })));
          const files = [...matchedDocs.map((d: any) => ({ name: d.name, url: d.url })), ...jobPhotos, ...jobVideos];
          if (files.length === 0) return { error: `No files with a cloud-synced URL found for ${c.firstName}${inputs.jobId ? " on that job" : ""}${q ? ` matching "${inputs.fileQuery}"` : ""}. On file (docs): ${docs.map((d: any) => d.name).join(", ") || "none"}.` };
          const via = inputs.via === "email" ? "email" : "text";
          if (via === "email") {
            const myEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
            if (!myEmail) return { error: "No owner email saved yet — add one in Settings → Company first." };
            const html = emailShell(settings as any, `Files for ${c.firstName} ${c.lastName}`, `<p>Here's everything on file:</p>` + files.map((f: any) => emailButton(f.name || "View file", f.url)).join(""));
            try { await withTimeout(sendEmail(settings as any, { to: myEmail, subject: `Files — ${c.firstName} ${c.lastName}`, body: html }), 15000, "Files email"); }
            catch (e: any) { return { error: "Email failed: " + (e?.message || String(e)) }; }
            toast(`Alfred emailed you ${files.length} file(s) for ${c.firstName} ✓`);
          } else {
            const myPhone = (settings as any)?.myPhone;
            if (!myPhone) return { error: "No phone number saved for you yet — add one in Settings → Company first." };
            if (!settings?.twilioSid) return { error: "Twilio isn't configured — add credentials in Settings → API Keys." };
            const body = `Files for ${c.firstName} ${c.lastName}:\n` + files.map((f: any) => `${f.name}: ${f.url}`).join("\n");
            try { await withTimeout(twilioSend(settings as any, myPhone, body), 15000, "Files text"); }
            catch (e: any) { return { error: "SMS failed: " + (e?.message || String(e)) }; }
            toast(`Alfred texted you ${files.length} file(s) for ${c.firstName} ✓`);
          }
          return { success: true, sentCount: files.length, via };
        }
        case "get_customer_card_info": {
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.name });
          if (!c) {
            const suggestions = suggestNames(inputs.name || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          if (!(c as any).stripeCustomerId) return { success: true, name: `${c.firstName} ${c.lastName}`, hasCardOnFile: false };
          return {
            success: true, name: `${c.firstName} ${c.lastName}`, hasCardOnFile: true,
            cardOnFile: (c as any).savedPaymentMethodLabel || "A card is on file, but no brand/last-4 label was saved — check Payment Methods on their profile for the exact card.",
            note: "This is the brand/last-4 only — the full card number is never stored anywhere and can't be retrieved by anyone, including you.",
          };
        }
        case "list_capabilities": {
          return {
            success: true,
            categories: {
              "Talk to customers": "Text an existing customer any custom message, text ANY phone number directly (leads, applicants, personal contacts), mass-text everyone or a tagged group, text a supplier, send email via your connected Gmail, look up a customer's saved card (brand/last4 only — never the full number)",
              "Run the business": "Create/reschedule/cancel jobs, reassign or request crew, create customers and estimates/invoices then send them, add checklist items, check who's clocked in",
              "Look things up": "Business stats and revenue, calendar summary, overdue invoices, full job or customer detail, a customer's documents on file, estimate list by status",
              "Remember and follow up": "Save facts/notes for later, schedule one-time or recurring follow-up reminders",
              "Admin": "Build/list/toggle full multi-step automations, turn on auto review-request texting, navigate your screen to any page, switch which AI model I'm running on, manage your Google Calendar/Drive/Tasks",
            },
            note: "Ask for anything in plain English — you don't need to name a tool.",
          };
        }
        case "confirm_screen_reference": {
          if (!onResolveScreenHighlight) return { error: "Screen highlighting isn't available right now." };
          const result = onResolveScreenHighlight();
          if (!result.ok) return { error: "Nothing recognizable is under the owner's cursor right now — ask them to point at what they mean, or ask which one." };
          return { success: true, highlighted: true, description: result.description, instruction: "Ask the owner \"You mean this — [describe it briefly]?\" and wait for an explicit yes before acting. If they say no or redirect you, call confirm_screen_reference again — it always re-samples wherever their cursor is right now." };
        }
        case "list_jobs": {
          const filter = inputs.status || "all";
          const list = jobs.filter(j => filter === "all" || j.status === filter).slice(0, 15).map(j => {
            const c = customers.find(x => x.id === j.customerId);
            return { id: j.id, customer: c ? c.firstName + " " + c.lastName : "Unknown", date: j.scheduledDate, amount: j.amount, status: j.status, priority: j.priority, address: j.address };
          });
          return { count: list.length, jobs: list };
        }
        case "list_overdue_invoices": {
          const overdue = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14).map(e => {
            const c = customers.find(x => x.id === e.customerId);
            return { id: e.id, customer: c ? c.firstName + " " + c.lastName : "Unknown", amount: e.total, daysOverdue: daysSince(e.invoicedAt), invoicedAt: e.invoicedAt };
          });
          return { count: overdue.length, overdue };
        }
        // FEATURE — "Hey Alfred, create goals for me." Two shapes, matching
        // the existing /goal slash command's own split: a NUMERIC target
        // (revenue/job-count style, tracked on Dashboard) sets
        // settings.monthlyRevenueGoal directly; anything else is logged as a
        // plain checklist-style goal in Accountability. Supports creating
        // several goals in one request — the model can call this multiple
        // times in the same turn.
        case "create_goal": {
          if (!inputs.text?.trim()) return { error: "text is required — what is the goal?" };
          if (inputs.type === "revenue" && Number(inputs.targetAmount) > 0) {
            setSettings((s: any) => ({ ...s, monthlyRevenueGoal: Number(inputs.targetAmount) }));
            return { success: true, kind: "revenue", target: Number(inputs.targetAmount) };
          }
          const newGoal = { id: uid(), text: inputs.text.trim(), createdAt: today(), done: false };
          setGoals([...(goals || []), newGoal]);
          return { success: true, kind: "checklist", goal: newGoal };
        }
        case "create_customer": {
          if (!inputs.firstName || !inputs.lastName) return { error: "firstName and lastName required" };
          // A retried/second "create this customer" request (e.g. the model
          // re-asking after a truncated earlier run) used to silently create
          // a second duplicate row for the same person every time, matched
          // only on exact-name in every OTHER tool's lookup — so a stray
          // duplicate would sit invisibly until it caused a wrong-record bug
          // elsewhere. Phone number is the most reliable match; fall back to
          // exact name if no phone was given.
          const dupPhone = (inputs.phone || "").replace(/\D/g, "");
          const existingCust = customers.find(x =>
            (dupPhone && (x.phone || "").replace(/\D/g, "") === dupPhone) ||
            (!dupPhone && (x.firstName + " " + x.lastName).trim().toLowerCase() === `${inputs.firstName} ${inputs.lastName}`.trim().toLowerCase())
          );
          if (existingCust) {
            toast("Alfred found an existing customer: " + existingCust.firstName + " " + existingCust.lastName);
            return { success: true, customer: existingCust, note: "This customer already existed — reused the existing record instead of creating a duplicate." };
          }
          const newC = { id: uid(), firstName: inputs.firstName, lastName: inputs.lastName, email: inputs.email || "", phone: inputs.phone || "", address: inputs.address || "", totalSpent: 0, createdAt: today(), notes: inputs.notes || "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "", owner_id: ownerId };
          // Alfred must never claim a customer was created unless the Supabase
          // write actually succeeded — local setState always "succeeds" (it's
          // just a React render), so that alone was the literal cause of
          // Alfred reporting success for customers that never existed.
          let saved: any = null;
          let saveError: any = null;
          try {
            // BLOCKER 6 (mobile round 9) — was an 8s timeout with no retry;
            // this exact wording ("save customer operation timed out") is
            // what the owner saw the tool report. 15s + one retry.
            const { data, error } = await withTimeoutRetry<any>(
              () => (supabase as any).from("customers").insert(newC).select().single(),
              15000, "Save customer"
            );
            saved = data;
            saveError = error;
          } catch (e: any) {
            saveError = e;
          }
          if (saveError || !saved) {
            return { error: "Failed to create customer — " + (saveError?.message || "Supabase write did not return a row") };
          }
          // No local setCustomers call — Supabase is the only source of truth.
          // The existing 3s cross-device sync poll (App.tsx) picks this row up
          // and merges it into local state on its own; Alfred never mutates
          // local state directly, so there's no path where the UI shows a
          // customer that doesn't actually exist in the database.
          toast("Alfred created customer: " + saved.firstName + " " + saved.lastName);
          // FEATURE — "demonstrate the action": queue a visible spotlight
          // (navigate to Customers, glow the new row, then return to this
          // chat) instead of just navigating away and staying there with no
          // visible confirmation of which row Alfred actually touched.
          if (onSpotlight) triggerSpotlight({ page: "customers", type: "customer", id: saved.id }); else setTimeout(() => onNav("customers"), 1200);
          return { success: true, customer: saved };
        }
        case "create_estimate": {
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.customerName });
          if (!c) {
            const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found. Create customer first or provide valid customerId." };
          }
          const items = (inputs.lineItems || []).map(li => ({ id: uid(), description: li.description, quantity: li.quantity || 1, unitPrice: li.unitPrice || 0 }));
          const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
          const tax = Math.round(subtotal * ((Number(settings.taxRate) || 0) / 100) * 100) / 100;
          const total = Math.round((subtotal + tax) * 100) / 100;
          const depE = alfredDepositFields(inputs, total);
          if ("error" in depE) return depE;
          const newE = { id: uid(), customerId: c.id, lineItems: items, subtotal, discount: 0, depositRequired: 0, tax, total, ...depE, status: "pending", createdAt: today(), validUntil: daysFromNow(30), viewed: false, viewedAt: null, terms: "Payment due upon completion.", notes: inputs.notes || "", owner_id: ownerId };
          let savedE: any = null;
          let saveErrorE: any = null;
          try {
            const { data, error } = await withTimeoutRetry<any>(
              () => (supabase as any).from("estimates").insert(newE).select().single(),
              15000, "Save estimate"
            );
            savedE = data;
            saveErrorE = error;
          } catch (e: any) {
            saveErrorE = e;
          }
          if (saveErrorE || !savedE) {
            return { error: "Failed to create estimate — " + (saveErrorE?.message || "Supabase write did not return a row") };
          }
          // No local setEstimates call — see create_customer above.
          toast("Alfred created quote #" + savedE.id.toUpperCase() + " · " + fmt(total));
          if (onSpotlight) triggerSpotlight({ page: "estimates", type: "estimate", id: savedE.id }); else setTimeout(() => onNav("estimates"), 1200);
          return { success: true, estimateId: savedE.id, total, customer: c.firstName + " " + c.lastName };
        }
        case "send_estimate": {
          let est: any = inputs.estimateId ? estimates.find(x => x.id === inputs.estimateId) : null;
          let sc: any = est ? customers.find(x => x.id === est.customerId) : null;
          // create_estimate (above) never mutates local `estimates` state —
          // it relies on the next Supabase poll — so a same-turn chain of
          // create_estimate -> send_estimate won't find the new row in the
          // local array yet. Fetch it directly by id as a fallback.
          if (!est && inputs.estimateId) {
            try {
              const { data } = await (supabase as any).from("estimates").select("*").eq("id", inputs.estimateId).maybeSingle();
              if (data) { est = data; sc = customers.find(x => x.id === data.customerId); }
            } catch { /* fall through to not-found below */ }
          }
          if (!est) {
            const byName = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.customerName });
            if (byName) {
              sc = byName;
              est = estimates.filter(x => x.customerId === byName.id && x.status === "pending").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0] || null;
            }
          }
          if (!est) return { error: "No matching pending estimate found — create one first with create_estimate." };
          if (!sc) sc = customers.find(x => x.id === est.customerId);
          if (!sc) return { error: "Customer not found for this estimate." };
          const channel = inputs.channel || "both";
          const link = `${window.location.origin}${window.location.pathname}#/estimate/${est.id}`;
          let sentEmail = false, sentSms = false;
          const errs: string[] = [];
          if ((channel === "email" || channel === "both") && sc.email) {
            try {
              await sendEmail(settings, { to: sc.email, subject: "Your CRM Starter estimate", body: emailShell(settings,"Your Estimate", `<p>Hi ${sc.firstName}, here's your estimate for ${fmt(est.total)}.</p>` + emailButton("View & Sign Estimate", link)) });
              sentEmail = true;
            } catch (e: any) { errs.push("email: " + e.message); }
          }
          // BUG FIX (Alfred customer-texting audit) — same smsOptOut gap as
          // the other individual-customer SMS tools in this file.
          if ((channel === "sms" || channel === "both") && sc.smsOptOut) {
            errs.push("sms: " + sc.firstName + " has opted out of texts");
          } else if ((channel === "sms" || channel === "both") && sc.phone) {
            try {
              const smsBody = `Hi ${sc.firstName}! Your CRM Starter estimate for ${fmt(est.total)} is ready: ${link}`;
              await twilioSend(settings, sc.phone, smsBody);
              sentSms = true;
              // Every other outbound-SMS tool in this file (text_customer,
              // reschedule notify, etc.) logs to inbox_threads so the owner
              // sees it in the Inbox from any device — this one didn't, so a
              // quote/invoice Alfred texted out never showed up anywhere.
              logOutboundSmsToInbox({ contactName: `${sc.firstName} ${sc.lastName}`, contactPhone: sc.phone, customerId: sc.id, body: smsBody }).catch(() => {});
            } catch (e: any) { errs.push("sms: " + e.message); }
          }
          if (!sentEmail && !sentSms) return { error: "Failed to send — " + (errs.join("; ") || "no email/phone on file for this customer") };
          const sentAt = today();
          // SECURITY/SYNC FIX (audit finding) — silently swallowed both
          // success and failure (EstimatesPage.tsx's equivalent write was
          // already fixed to check this; Alfred's own tool wasn't).
          (supabase as any).from("estimates").update({ sentAt, sendChannel: channel }).eq("id", est.id).select("id")
            .then((r: any) => { if (r?.error || !Array.isArray(r?.data) || r.data.length === 0) console.warn("[AlfredTool send_estimate] sentAt write failed:", r?.error?.message || "matched 0 rows"); })
            .catch((e: any) => console.warn("[AlfredTool send_estimate] sentAt write threw:", e?.message));
          setEstimates((prev: any[]) => prev.map(x => x.id === est.id ? { ...x, sentAt, sendChannel: channel } : x));
          toast("Alfred sent the quote to " + sc.firstName + (errs.length ? " (partial)" : ""));
          return { success: true, estimateId: est.id, customer: sc.firstName + " " + sc.lastName, sentEmail, sentSms, warnings: errs.length ? errs : undefined };
        }
        case "schedule_job": {
          console.log("[AlfredTool schedule_job] inputs from model — customerId:", inputs?.customerId, "date:", inputs?.date);
          // Trim before comparing — a customer with no lastName (a business/
          // HOA-style entry: firstName="Springfield HOA", lastName="") builds
          // a trailing-space string ("springfield hoa ") that a strict `===`
          // against the model's ("springfield hoa") would never match. This
          // silently fell through to "Customer not found" for exactly this
          // kind of customer name.
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.customerName });
          console.log("[AlfredTool schedule_job] customer lookup — searched for:", inputs.customerName || inputs.customerId, "→ found:", c ? c.id + " (" + c.firstName + " " + c.lastName + ")" : "NONE");
          if (!c) {
            const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
            console.warn("[AlfredTool schedule_job] ABORTING — no customer match. Suggestions:", suggestions);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          // The model is responsible for resolving "tomorrow"/"2pm" into
          // real YYYY-MM-DD / HH:MM values before calling this tool. If it
          // ever sends the words through literally, a `date`-typed Postgres
          // column would reject the insert (caught below) — but if
          // scheduledDate is a looser text-like column, garbage like the
          // literal string "tomorrow" would insert with NO Supabase error at
          // all, and the job would silently never show up on any real
          // calendar date. Reject obviously-invalid input up front instead
          // of trusting Supabase to catch it.
          if (inputs.date && !/^\d{4}-\d{2}-\d{2}$/.test(inputs.date)) {
            console.error("[AlfredTool schedule_job] ABORTING — date is not YYYY-MM-DD:", JSON.stringify(inputs.date));
            return { error: "Invalid date format: \"" + inputs.date + "\" — must resolve relative dates like 'tomorrow' to an actual YYYY-MM-DD value before calling this tool, then retry." };
          }
          if (inputs.time && !/^\d{1,2}:\d{2}$/.test(inputs.time)) {
            console.error("[AlfredTool schedule_job] ABORTING — time is not HH:MM:", JSON.stringify(inputs.time));
            return { error: "Invalid time format: \"" + inputs.time + "\" — must be 24h HH:MM (e.g. '14:00' for 2pm), then retry." };
          }
          // CRITICAL (per owner report) — the manual "Schedule Job" form
          // (JobsPage.tsx, its onClick submit handler) is the proven-working
          // reference. This payload is the same shape — same fields, same
          // literal defaults — including `jobType` (Alfred's payload was
          // missing it entirely; the manual form always sends it) and
          // `checklist` (manual form always sends a bare `[]`, never a
          // populated default item). Do not reintroduce any field the
          // manual form doesn't send — see docs/ARCHITECTURE.md's "safe column" note on
          // this exact table.
          // FEATURE — "allow me to create a custom checklist and add
          // specific instructions... Alfred can also schedule recurring
          // jobs, commercial jobs, and tags." duringChecklist is the SAME
          // field the field-portal checklist system already reads/writes
          // everywhere else (JobDetailModal, EmployeePortal) — a plain
          // string list from Alfred becomes real, checkable items, not
          // just text buried in notes. isRecurring/recurringFreq mirror
          // exactly what the manual "Recurring" toggle in the New Job form
          // writes (recurringMode "preset" + one of recurringFreqs' keys).
          const customChecklist = Array.isArray(inputs.checklist) && inputs.checklist.length > 0
            ? inputs.checklist.map((label: string) => ({ id: uid(), label, done: false }))
            : undefined;
          const newJ: any = {
            id: uid(), customerId: c.id,
            address: inputs.address || c.address || "",
            amount: parseFloat(inputs.amount) || 0,
            status: "scheduled" as const,
            scheduledDate: inputs.date || daysFromNow(3),
            scheduledTime: inputs.time || "",
            priority: inputs.priority || "normal",
            jobType: inputs.jobType || "residential",
            notes: inputs.notes || "",
            duration: inputs.duration ? Number(inputs.duration) : undefined,
            crew: [] as any[], checklist: [] as any[], photos: [], commLog: [], chemicalsUsed: [], equipment: [],
            tags: Array.isArray(inputs.tags) ? inputs.tags : [],
            loggedHours: 0, createdAt: today(), owner_id: ownerId,
            ...(inputs.internalNotes ? { internalNotes: inputs.internalNotes } : {}),
            ...(customChecklist ? { duringChecklist: customChecklist } : {}),
            ...(inputs.isRecurring ? { isRecurring: true, recurringMode: "preset", recurringFreq: inputs.recurringFreq } : {}),
            // FEATURE — "Alfred can read a work order (email/text) and
            // create it for the owner, with a checklist and photo/video
            // requirements." Still the same jobs-table insert as every other
            // schedule_job call — a work order is an ordinary Job row with
            // extra fields (migration 0094), never a separate entity. The
            // model is expected to have already extracted these from
            // whatever text the owner pasted/forwarded (see this tool's own
            // input_schema description below) — never invented if absent.
            ...(inputs.isWorkOrder ? {
              isWorkOrder: true,
              workOrderNumber: inputs.workOrderNumber || "",
              workOrderClient: inputs.workOrderClient || "",
              requiresManagerSignoff: !!inputs.requiresManagerSignoff,
              jobType: "commercial",
              photoRequirements: Array.isArray(inputs.photoRequirements)
                ? inputs.photoRequirements.map((r: any) => ({ id: uid(), label: String(r.label || ""), kind: r.kind === "video" ? "video" : "photo", minCount: Math.max(1, Number(r.minCount) || 1), instructions: r.instructions || "" })).filter((r: any) => r.label)
                : [],
            } : {}),
            // REVERTED — organizationId was added here on the strength of a
            // one-off console log that turned out not to hold up: live
            // testing now shows the App.tsx 30s bulk jobs autosave (which
            // upserts the FULL in-memory job object, not just this insert)
            // rejecting every save afterward with "Could not find the
            // organizationId column of jobs in the schema cache" — the
            // column genuinely doesn't exist on this deployment. Once it's on
            // a job object in React state it poisons every future autosave
            // of that job, not just this insert, which the autosave's own
            // safe-column retry doesn't know to strip. Do not re-add without
            // confirming the column actually exists (see docs/ARCHITECTURE.md's Database
            // section on organizations/profiles being aspirational scaffolding).
          };
          console.log("[AlfredTool schedule_job] payload — customerId:", (newJ as any)?.customerId, "id:", (newJ as any)?.id);
          // The manual form itself does setJobs() + toast IMMEDIATELY, then
          // inserts in a detached, un-awaited async IIFE — correct for a UI
          // button (nothing downstream needs its return value), but wrong
          // for a tool call: this return value IS what tells Alfred (and
          // through it, the user) whether the job was actually saved.
          // Awaiting the SAME insert call — not a different one — doesn't
          // change what Supabase does or doesn't accept, only when the code
          // notices the result, which is required so Alfred can never again
          // report success before Supabase confirmed it. Same table
          // ("jobs"), same columns, same bare (non-`.select()`) insert
          // method as the manual form.
          // ITEM 23 — "Save job timed out" persisted even after the
          // navigator-lock passthrough fix (lib/supabase.ts) for some owners,
          // which points at plain slow-network/cold-connection cases too, not
          // only the lock deadlock. A single insert with no retry meant one
          // slow round-trip failed the whole tool call outright; bumped the
          // budget 15s → 25s and added one retry attempt with a further 20s
          // of headroom before actually giving up, same as the existing
          // safe-column retry a few lines down already does for column errors.
          let insertResp: any;
          try {
            insertResp = await withTimeout<any>((supabase as any).from("jobs").insert(newJ), 25000, "Save job");
          } catch (timeoutErr: any) {
            console.warn("[AlfredTool schedule_job] first insert attempt timed out — retrying once:", timeoutErr?.message);
            insertResp = await withTimeout<any>((supabase as any).from("jobs").insert(newJ), 20000, "Save job (retry)");
          }
          // Log the ENTIRE raw response object, not just .error — status/
          // statusText/count reveal e.g. a silent 0-row write that reports
          // no `error` but also didn't actually insert anything.
          console.log("[AlfredTool schedule_job] EXACT Supabase response:", JSON.stringify({
            error: insertResp?.error ? { message: insertResp.error.message, details: insertResp.error.details, hint: insertResp.error.hint, code: insertResp.error.code } : null,
            status: insertResp?.status, statusText: insertResp?.statusText, count: insertResp?.count,
          }, null, 2));
          const jobErr = insertResp?.error;
          if (jobErr) {
            console.error("[AlfredTool schedule_job] ✗ INSERT FAILED:", jobErr.message, "code:", jobErr.code, "— retrying with core columns only");
            // Same fallback the manual form uses for this exact table: if
            // any column in the patch is unrecognized, PostgREST rejects the
            // WHOLE row — retry with a minimal, known-safe column set before
            // giving up entirely.
            const coreJob = {
              id: newJ.id, customerId: newJ.customerId, address: newJ.address, amount: newJ.amount,
              status: newJ.status, scheduledDate: newJ.scheduledDate, scheduledTime: newJ.scheduledTime,
              priority: newJ.priority, notes: newJ.notes, crew: newJ.crew, checklist: newJ.checklist,
              photos: newJ.photos, commLog: newJ.commLog, createdAt: newJ.createdAt, owner_id: newJ.owner_id,
              // Per docs/ARCHITECTURE.md's "safe column" note — a new field written by
              // this insert has to be whitelisted here too, or a retry (any
              // OTHER column being unrecognized) would silently drop it.
            };
            console.log("[AlfredTool schedule_job] core-column retry payload:", JSON.stringify(coreJob, null, 2));
            const retry: any = await (supabase as any).from("jobs").insert(coreJob);
            console.log("[AlfredTool schedule_job] core-column retry EXACT response:", JSON.stringify({
              error: retry?.error ? { message: retry.error.message, details: retry.error.details, hint: retry.error.hint, code: retry.error.code } : null,
              status: retry?.status,
            }, null, 2));
            if (retry?.error) {
              console.error("[AlfredTool schedule_job] ✗ RETRY ALSO FAILED — job was NOT saved.");
              return { error: "Failed to schedule job — " + (retry.error.message || jobErr.message) };
            }
            console.log("[AlfredTool schedule_job] ✓ retry succeeded — job saved with core columns only");
          } else {
            console.log("[AlfredTool schedule_job] ✓ INSERT SUCCEEDED — no error returned from Supabase.");
          }
          // Verify the row is actually readable back — closes the gap where
          // an insert reports no error (e.g. RLS silently accepting a write
          // path but a mismatched WITH CHECK, or a trigger rewriting/
          // dropping the row) yet nothing is really there to find.
          // BUG FIX — this SELECT was the one Supabase call in the whole
          // schedule_job flow with NO withTimeout wrapper. Every insert
          // around it already had one (see ITEM 23 above) precisely because
          // a hung request here can't be told apart from a real hang — but
          // this specific await had no escape hatch, so if it (not the
          // insert) was the thing hanging, the ENTIRE tool call — and with
          // it, the whole Alfred round-trip, regardless of which AI model
          // was in use — blocked forever with no timeout, no error, no
          // failover. This is almost certainly what "all models timed out"
          // scheduling a job actually was: not a model problem at all.
          const { data: verifyRow, error: verifyErr } = await withTimeout<any>(
            (supabase as any).from("jobs").select("id, scheduledDate").eq("id", newJ.id).maybeSingle(),
            10000, "Verify job save"
          ).catch((e: any) => ({ data: null, error: e }));
          console.log("[AlfredTool schedule_job] post-insert verification SELECT — row found:", !!verifyRow, "data:", verifyRow, "error:", verifyErr?.message);
          if (!verifyRow) {
            console.error("[AlfredTool schedule_job] ✗ Insert reported no error, but the row can't be read back — something is silently dropping it (RLS, a trigger, or a check constraint).");
            return { error: "Supabase accepted the insert with no error, but the job isn't actually readable afterward — this points at an RLS or trigger issue on the jobs table, not a code bug. The job was NOT actually saved." };
          }
          setJobs(prev => [...prev, newJ as any]);
          toast("Alfred scheduled job for " + c.firstName + " on " + newJ.scheduledDate);
          if (onSpotlight) triggerSpotlight({ page: "jobs", type: "job", id: (newJ as any).id }); else setTimeout(() => onNav("jobs"), 1200);

          // Optional same-call crew assignment — the job itself is already
          // saved at this point, so a failure here must never be reported as
          // the whole tool call failing; it's a warning attached to an
          // otherwise-successful result. Uses the exact same fields the
          // manual form and assign_employee tool write (crew/crewAssignedAt —
          // see docs/ARCHITECTURE.md and assign_employee above), not anything invented.
          let assignedEmployee: string | undefined;
          let assignWarning: string | undefined;
          let assignSuggestions: string[] | undefined;
          if (inputs.employeeName) {
            const wantedEmpName = String(inputs.employeeName).trim().toLowerCase();
            const emp = employees.find((e: any) => (e.firstName + " " + e.lastName).trim().toLowerCase() === wantedEmpName);
            console.log("[AlfredTool schedule_job] employee lookup for assignment — searched for:", inputs.employeeName, "→ found:", emp ? emp.id + " (" + emp.firstName + " " + emp.lastName + ")" : "NONE");
            if (!emp) {
              assignSuggestions = suggestNames(inputs.employeeName, employees, (e: any) => `${e.firstName} ${e.lastName}`);
              assignWarning = "No employee matching \"" + inputs.employeeName + "\" was found to assign.";
              console.warn("[AlfredTool schedule_job] " + assignWarning, "suggestions:", assignSuggestions);
            } else {
              const crewAssignedAt = { [emp.id]: Date.now() };
              const { error: assignErr } = await withTimeoutRetry<any>(
                () => (supabase as any).from("jobs").update({ crew: [emp.id], crewAssignedAt }).eq("id", newJ.id),
                15000, "Assign crew"
              ).catch((e: any) => ({ error: e }));
              console.log("[AlfredTool schedule_job] crew assignment Supabase response — error:", assignErr);
              if (assignErr) {
                assignWarning = "Assigning " + emp.firstName + " failed — " + (assignErr.message || String(assignErr));
                console.error("[AlfredTool schedule_job] " + assignWarning);
              } else {
                setJobs((prev: any[]) => prev.map((x: any) => x.id === newJ.id ? { ...x, crew: [emp.id], crewAssignedAt } : x));
                assignedEmployee = emp.firstName + " " + emp.lastName;
                toast("Alfred assigned " + emp.firstName + " to the " + newJ.scheduledDate + " job");
                // Same employee-calendar push the standalone assign_employee
                // tool already does — this inline assignment path (crew
                // named directly in the schedule_job call) was skipping it.
                // SECURITY FIX (audit finding) — employee-calendar-sync.ts
                // now requires a real session and derives ownerId from it
                // server-side, never from the request body.
                supabase.auth.getSession().then(({ data: { session: syncSession } }) => fetch("/api/employee-calendar-sync", {
                  method: "POST", headers: { "Content-Type": "application/json", ...(syncSession?.access_token ? { Authorization: `Bearer ${syncSession.access_token}` } : {}) },
                  body: JSON.stringify({
                    employeeId: emp.id, jobId: newJ.id, action: "upsert",
                    title: c.firstName + " " + c.lastName + " — Service",
                    date: newJ.scheduledDate, time: newJ.scheduledTime, durationMinutes: (Number(newJ.duration) || 2) * 60,
                    location: newJ.address,
                    // BUG FIX — "should include a clickable link and URL to
                    // view the job in the employee portal, as well as the
                    // client name and other details." This just sent the
                    // job's own free-text notes as the description before —
                    // no link, no client info.
                    notes: buildJobCalendarDescription(newJ, c, `${window.location.origin}${window.location.pathname}#/portal?job=${encodeURIComponent(newJ.id)}`, "View job in Crew Portal"),
                  }),
                })).catch(() => {});
                // BUG FIX — this inline assignment path (crew named directly
                // in the schedule_job call) never sent the "You've Been
                // Assigned" email the standalone assign_employee tool
                // already sends — same reason the calendar push was missing
                // above. Queued (see pendingAssignmentEmailsRef) rather than
                // sent immediately, so a whole batch of jobs for the same
                // employee in one turn becomes ONE summary email, not one
                // per job.
                if (emp.email) {
                  (pendingAssignmentEmailsRef.current[emp.email] ||= []).push({
                    employeeFirstName: emp.firstName, jobId: newJ.id, date: newJ.scheduledDate, time: newJ.scheduledTime || "", address: newJ.address, customerName: c.firstName + " " + c.lastName, duration: newJ.duration,
                  });
                }
              }
            }
          }

          // FEATURE — jobs Alfred scheduled never synced to Google Calendar
          // at all; only the manual "New Job" form (JobsPage.tsx) had this.
          // Mirrors that exact logic (same autoSyncCalendar/googleConnected
          // gate, same crew-aware description/link) so a job exists on the
          // owner's calendar the same way regardless of which path created
          // it. Fire-and-forget after the tool's own success response is
          // built — calendar sync failing must never make Alfred report the
          // job itself as not scheduled, since it verifiably was.
          if (((settings as any)?.autoSyncCalendar ?? true) && settings?.googleConnected && newJ.scheduledDate) {
            const startDt = new Date(newJ.scheduledDate + "T" + (newJ.scheduledTime || "09:00") + ":00");
            const endDt = new Date(startDt.getTime() + (Number(newJ.duration) || 2) * 60 * 60 * 1000);
            const hasEmployeeCrew = !!assignedEmployee && employees.find((e: any) => (e.firstName + " " + e.lastName) === assignedEmployee)?.role !== "owner";
            const calDescription = hasEmployeeCrew
              ? buildJobCalendarDescription(newJ, c, `${window.location.origin}${window.location.pathname}#/portal?job=${encodeURIComponent(newJ.id)}`, "View job in Crew Portal")
              : buildJobCalendarDescription(newJ, c, `${window.location.origin}${window.location.pathname}#/jobs?open=${encodeURIComponent(newJ.id)}`);
            getFreshOwnerGoogleToken(settings as any).then((token: string | null) => {
              if (!token) return null;
              return createGCalEvent(token, {
                title: c.firstName + " " + c.lastName + " — Service",
                start: startDt.toISOString(), end: endDt.toISOString(),
                location: newJ.address || "", description: calDescription,
              });
            }).then((eventId: string | null) => {
              if (eventId) {
                setJobs((prev: any[]) => prev.map((x: any) => x.id === newJ.id ? { ...x, googleEventId: eventId } : x));
                (supabase as any).from("jobs").update({ googleEventId: eventId }).eq("id", newJ.id).then(() => {});
              } else {
                console.warn("[AlfredTool schedule_job] Calendar sync produced no event id — token refresh or the create call likely failed silently upstream");
              }
            }).catch((e: any) => console.error("[AlfredTool schedule_job] Calendar sync failed:", e?.message || e));
          }

          // success stays true — the job itself was confirmed saved above,
          // and a failed/ambiguous ASSIGNMENT must never be reported as the
          // whole schedule_job call failing (the job really does exist).
          // assignmentSuggestions/instruction follow the exact same shape
          // the customer/employee "not found" lookups use elsewhere so the
          // model's existing NAME MATCHING rule (ask "Do you mean X?") kicks
          // in the same way here too.
          return {
            success: true, jobId: newJ.id, date: newJ.scheduledDate, customer: c.firstName + " " + c.lastName,
            ...(assignedEmployee ? { assignedEmployee } : {}),
            ...(assignWarning ? {
              assignmentWarning: assignWarning,
              ...(assignSuggestions?.length ? {
                assignmentSuggestions: assignSuggestions,
                instruction: "The job itself was scheduled successfully. Tell the user that, then separately ask 'Do you mean " + assignSuggestions.join(", or ") + "?' to assign crew — do not ask a generic follow-up question.",
              } : {}),
            } : {}),
          };
        }
        // FEATURE — "owners have to send summaries/responses back after a
        // night job or commercial job — Alfred should turn the job info into
        // a nice branded response with photos attached." The MODEL writes
        // the prose itself (summaryText) — following the owner's own
        // settings.workOrderEmailTemplate instructions/word-limit already in
        // its system prompt context (see buildSystemPrompt's businessContext) —
        // this tool just wraps it in the branded email shell, attaches up to
        // 6 job photos, optionally includes the manager signature, and sends/
        // stamps the job so the owner can see it went out.
        case "generate_work_order_summary": {
          const j = await findJobFresh({ jobId: inputs.jobId, customerName: inputs.customerName });
          if (!j) return { error: "Job not found." };
          if (!inputs.summaryText || !inputs.recipientEmail) return { error: "summaryText and recipientEmail are required." };
          const tmpl = (settings as any)?.workOrderEmailTemplate || {};
          const photos = (j.photos || []).slice(0, 6).filter((p: any) => p.url || p.dataUrl);
          const photoHtml = photos.length
            ? `<div style="margin-top:12px">${photos.map((p: any) => `<img src="${mediaSrc(p.url, p.dataUrl)}" alt="${p.type || "photo"}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;margin:0 6px 6px 0" />`).join("")}</div>`
            : "";
          const sigHtml = (tmpl.includeSignature !== false && j.managerSignatureDataUrl)
            ? `<p style="margin-top:12px"><b>Signed off by:</b> ${j.managerSignedBy || "Manager"}<br/><img src="${j.managerSignatureDataUrl}" alt="signature" style="max-width:220px;background:#fff;border-radius:6px;padding:6px;margin-top:4px" /></p>`
            : "";
          const bodyHtml = `<p>${String(inputs.summaryText).replace(/\n/g, "<br/>")}</p>${photoHtml}${sigHtml}`;
          const subject = inputs.subject || tmpl.subject || `Work Order ${j.workOrderNumber ? "#" + j.workOrderNumber + " " : ""}Complete — ${j.address || ""}`;
          try {
            await withTimeout(sendEmail(settings as any, { to: inputs.recipientEmail, subject, body: emailShell(settings as any, "Work Order Complete", bodyHtml) }), 15000, "Work order summary email");
          } catch (e: any) {
            return { error: "Couldn't send the summary email — " + (e?.message || "unknown error") };
          }
          const patch = { workOrderSummary: inputs.summaryText, workOrderSummarySentAt: new Date().toISOString() };
          const result = await (supabase as any).from("jobs").update(patch).eq("id", j.id).select("id");
          if (result?.error || !Array.isArray(result?.data) || result.data.length === 0) {
            console.warn("[AlfredTool generate_work_order_summary] stamp write failed:", result?.error?.message || "matched 0 rows");
          } else {
            setJobs((prev: any[]) => prev.map((x: any) => x.id === j.id ? { ...x, ...patch } : x));
          }
          toast("Alfred sent the work order summary to " + inputs.recipientEmail);
          return { success: true, sentTo: inputs.recipientEmail };
        }
        case "update_job_priority": {
          const j = await findJobFresh({ jobId: inputs.jobId, customerName: inputs.customerName });
          if (!j) return { error: "Job not found" };
          const { error: prioErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update({ priority: inputs.priority }).eq("id", inputs.jobId),
            15000, "Save priority"
          ).catch((e: any) => ({ error: e }));
          console.log("[AlfredTool update_job_priority] Supabase response — error:", prioErr);
          if (prioErr) return { error: "Could not update priority — " + (prioErr.message || String(prioErr)) };
          setJobs(prev => prev.map(x => x.id === inputs.jobId ? { ...x, priority: inputs.priority } : x));
          toast("Alfred set priority to " + inputs.priority);
          if (onSpotlight) triggerSpotlight({ page: "jobs", type: "job", id: inputs.jobId });
          return { success: true, jobId: inputs.jobId, newPriority: inputs.priority };
        }
        case "reschedule_job": {
          const j = await findJobFresh({ jobId: inputs.jobId, customerName: inputs.customerName });
          if (!j) return { error: "Job not found" };
          if (!inputs.date) return { error: "date is required" };
          // CRITICAL (Alfred functionality audit) — this ONLY called
          // setJobs() (local React state) and reported success unconditionally
          // — the exact same silent no-op bug this whole audit exists to root
          // out. Nothing was ever written to Supabase, so the owner's OTHER
          // devices, and the assigned employee's own portal (which reads jobs
          // straight from Supabase), never saw the move at all. Same fix
          // pattern as assign_employee: await the real write, only report
          // success once Supabase confirms it.
          const patch: any = { scheduledDate: inputs.date, ...(inputs.time ? { scheduledTime: inputs.time } : {}) };
          const { error: reschedErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update(patch).eq("id", inputs.jobId),
            15000, "Reschedule job"
          ).catch((e: any) => ({ error: e }));
          console.log("[AlfredTool reschedule_job] Supabase response — error:", reschedErr);
          if (reschedErr) return { error: "Could not reschedule — " + (reschedErr.message || String(reschedErr)) };
          setJobs(prev => prev.map(x => x.id === inputs.jobId ? { ...x, ...patch } : x));
          toast("Alfred rescheduled job to " + inputs.date + (inputs.time ? " at " + inputs.time : ""));
          if (onSpotlight) triggerSpotlight({ page: "jobs", type: "job", id: inputs.jobId }); else setTimeout(() => onNav("jobs"), 1200);
          // FEATURE — keep an already-synced Google Calendar event in sync
          // when the job moves, same as schedule_job now creates one.
          if ((j as any).googleEventId && settings?.googleConnected) {
            const newStartDt = new Date(inputs.date + "T" + (inputs.time || j.scheduledTime || "09:00") + ":00");
            const newEndDt = new Date(newStartDt.getTime() + (Number((j as any).duration) || 2) * 60 * 60 * 1000);
            getFreshOwnerGoogleToken(settings as any).then((token: string | null) => {
              if (!token) return;
              return updateGCalEvent(token, (j as any).googleEventId, { start: newStartDt.toISOString(), end: newEndDt.toISOString() });
            }).catch((e: any) => console.error("[AlfredTool reschedule_job] Calendar update failed:", e?.message || e));
          }
          // FEATURE — "reschedule this job and text/email the customer" used
          // to require the model to independently chain reschedule_job then
          // send_reminder across two rounds, which worked only if the model
          // reliably composed that itself (never guaranteed). A built-in
          // notify option makes this one deterministic tool call instead of
          // relying on model judgment for a very common compound request —
          // the job move itself still succeeds even if the notify leg fails.
          let notifyWarning: string | undefined;
          if (inputs.notify && inputs.notify !== "none") {
            const c = customers.find(x => x.id === j.customerId);
            const msg = `Hi ${c?.firstName || ""}, your ${settings?.companyName || "service"} appointment has been moved to ${inputs.date}${inputs.time ? " at " + inputs.time : ""}. Let us know if that doesn't work!`;
            try {
              // BUG FIX (Alfred customer-texting audit) — see send_reminder's
              // matching comment: smsOptOut was never checked here either.
              if ((inputs.notify === "sms" || inputs.notify === "both") && c?.smsOptOut) {
                notifyWarning = "Job rescheduled, but " + (c?.firstName || "the customer") + " has opted out of texts — couldn't send the SMS.";
              } else if ((inputs.notify === "sms" || inputs.notify === "both") && c?.phone && settings?.twilioSid) {
                await twilioSend(settings, c.phone, msg);
                logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
              } else if (inputs.notify === "sms" || inputs.notify === "both") {
                notifyWarning = "Job rescheduled, but couldn't text the customer — no phone on file or Twilio not configured.";
              }
              if ((inputs.notify === "email" || inputs.notify === "both") && c?.email) {
                await sendEmail(settings, { to: c.email, subject: "Your appointment has been rescheduled", body: emailShell(settings, "Rescheduled", `<p>${msg}</p>`) });
              } else if (inputs.notify === "email" || inputs.notify === "both") {
                notifyWarning = (notifyWarning ? notifyWarning + " " : "") + "Couldn't email the customer — no email on file.";
              }
            } catch (e: any) {
              notifyWarning = "Job rescheduled, but notifying the customer failed: " + (e?.message || String(e));
            }
          }
          return { success: true, jobId: inputs.jobId, newDate: inputs.date, newTime: inputs.time || j.scheduledTime, ...(notifyWarning ? { notifyWarning } : {}) };
        }
        case "cancel_job": {
          const j = await findJobFresh({ jobId: inputs.jobId, customerName: inputs.customerName });
          if (!j) return { error: "Job not found" };
          // CRITICAL (Alfred functionality audit) — same bug as
          // reschedule_job above: local-only setJobs(), no Supabase write,
          // unconditional "success". Fixed the same way.
          const patch = { status: "cancelled" as const, cancelReason: inputs.reason || "" };
          const { error: cancelErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update(patch).eq("id", inputs.jobId),
            15000, "Cancel job"
          ).catch((e: any) => ({ error: e }));
          console.log("[AlfredTool cancel_job] Supabase response — error:", cancelErr);
          if (cancelErr) return { error: "Could not cancel job — " + (cancelErr.message || String(cancelErr)) };
          setJobs(prev => prev.map(x => x.id === inputs.jobId ? { ...x, ...patch } : x));
          toast("Alfred cancelled the " + (j.scheduledDate || "") + " job");
          if (onSpotlight) triggerSpotlight({ page: "jobs", type: "job", id: inputs.jobId }); else setTimeout(() => onNav("jobs"), 1200);
          // FEATURE — remove the Google Calendar event when the job is
          // cancelled, same as schedule_job now creates one.
          if ((j as any).googleEventId && settings?.googleConnected) {
            getFreshOwnerGoogleToken(settings as any).then((token: string | null) => {
              if (!token) return;
              return deleteGCalEvent(token, (j as any).googleEventId);
            }).catch((e: any) => console.error("[AlfredTool cancel_job] Calendar delete failed:", e?.message || e));
          }
          let cancelNotifyWarning: string | undefined;
          if (inputs.notify && inputs.notify !== "none") {
            const c = customers.find(x => x.id === j.customerId);
            const msg = `Hi ${c?.firstName || ""}, your ${settings?.companyName || "service"} appointment on ${j.scheduledDate || "the scheduled date"} has been cancelled.${inputs.reason ? ` (${inputs.reason})` : ""} Reach out any time to reschedule.`;
            try {
              // BUG FIX (Alfred customer-texting audit) — same smsOptOut gap
              // as reschedule_job/send_reminder above.
              if ((inputs.notify === "sms" || inputs.notify === "both") && c?.smsOptOut) {
                cancelNotifyWarning = "Job cancelled, but " + (c?.firstName || "the customer") + " has opted out of texts — couldn't send the SMS.";
              } else if ((inputs.notify === "sms" || inputs.notify === "both") && c?.phone && settings?.twilioSid) {
                await twilioSend(settings, c.phone, msg);
                logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
              } else if (inputs.notify === "sms" || inputs.notify === "both") {
                cancelNotifyWarning = "Job cancelled, but couldn't text the customer — no phone on file or Twilio not configured.";
              }
              if ((inputs.notify === "email" || inputs.notify === "both") && c?.email) {
                await sendEmail(settings, { to: c.email, subject: "Your appointment has been cancelled", body: emailShell(settings, "Cancelled", `<p>${msg}</p>`) });
              } else if (inputs.notify === "email" || inputs.notify === "both") {
                cancelNotifyWarning = (cancelNotifyWarning ? cancelNotifyWarning + " " : "") + "Couldn't email the customer — no email on file.";
              }
            } catch (e: any) {
              cancelNotifyWarning = "Job cancelled, but notifying the customer failed: " + (e?.message || String(e));
            }
          }
          return { success: true, jobId: inputs.jobId, status: "cancelled", ...(cancelNotifyWarning ? { notifyWarning: cancelNotifyWarning } : {}) };
        }
        // NEW (Alfred functionality audit) — "Show me the details for
        // [customer]'s job" had no dedicated tool; get_customer_details only
        // surfaces a thin recentJobs summary (date/amount/status), not
        // enough to actually answer a "what's going on with this job"
        // question (address, crew, checklist progress, photos, payment).
        case "get_job_details": {
          let matchedCustomer: any = null;
          if (inputs.customerName) {
            matchedCustomer = customers.find(x => (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.customerName || "").trim().toLowerCase());
            if (!matchedCustomer) {
              const suggestions = suggestNames(inputs.customerName, customers, x => `${x.firstName} ${x.lastName}`);
              return suggestions.length
                ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
                : { error: "Customer not found" };
            }
          }
          const j: any = await findJobFresh({ jobId: inputs.jobId, customerName: inputs.customerName });
          if (!j) return { error: "Job not found — provide jobId, or a customerName with a job on file." };
          const jc = matchedCustomer || customers.find(x => x.id === j.customerId);
          const crewNames = (j.crew || []).map((id: string) => { const e = employees.find((x: any) => x.id === id); return e ? e.firstName + " " + e.lastName : id; });
          const allCk = [...(j.preChecklist || []), ...(j.duringChecklist || []), ...(j.postChecklist || []), ...(j.checklist || [])];
          return {
            jobId: j.id, customer: jc ? jc.firstName + " " + jc.lastName : "Unknown", address: j.address,
            date: j.scheduledDate, time: j.scheduledTime, status: j.status, amount: j.amount,
            priority: j.priority, notes: j.notes, crew: crewNames,
            checklist: { totalItems: allCk.length, completed: allCk.filter((i: any) => i.done).length },
            photoCount: (j.photos || []).length,
            paymentStatus: j.paymentStatus || (j.invoiced ? (j.paidAt ? "Paid" : "Invoiced, unpaid") : "Not invoiced"),
          };
        }
        // NEW (Alfred functionality audit) — "Add [item] to the checklist
        // for [job]" had no tool at all. Writes to preChecklist/
        // duringChecklist/postChecklist — the arrays the field portal
        // actually renders and lets employees check off (see
        // EmployeePortal.tsx) — NOT the legacy top-level `checklist` field,
        // which is only ever read for historical record-keeping, never shown
        // as an interactive list to employees.
        case "add_checklist_item": {
          const j = await findJobFresh({ jobId: inputs.jobId, customerName: inputs.customerName });
          if (!j) return { error: "Job not found" };
          if (!inputs.item) return { error: "item text required" };
          const phase = inputs.phase === "during" ? "duringChecklist" : inputs.phase === "post" ? "postChecklist" : "preChecklist";
          const updatedList = [...((j as any)[phase] || []), { id: uid(), label: inputs.item, done: false }];
          const { error: ckErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update({ [phase]: updatedList }).eq("id", j.id),
            15000, "Save checklist item"
          ).catch((e: any) => ({ error: e }));
          console.log("[AlfredTool add_checklist_item] Supabase response — error:", ckErr);
          if (ckErr) return { error: "Could not save checklist item — " + (ckErr.message || String(ckErr)) };
          setJobs(prev => prev.map(x => x.id === j.id ? { ...x, [phase]: updatedList } : x));
          toast("Alfred added \"" + inputs.item + "\" to the checklist");
          if (onSpotlight) triggerSpotlight({ page: "jobs", type: "job", id: j.id });
          return { success: true, jobId: j.id, phase, item: inputs.item, checklistLength: updatedList.length };
        }
        // NEW (Alfred functionality audit) — "Send an invoice to [customer]
        // for $[amount]" had no tool. Per docs/ARCHITECTURE.md, an invoice IS an
        // estimate row with invoiced:true — reuses the exact same table and
        // the existing send_estimate tool (which doesn't care whether a row
        // is a quote or an invoice) handles actually delivering it, so
        // "create_invoice then send_estimate" mirrors "create_estimate then
        // send_estimate" exactly.
        case "create_invoice": {
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.customerName });
          if (!c) {
            const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found. Create customer first or provide valid customerId." };
          }
          if (!inputs.amount && !(inputs.lineItems && inputs.lineItems.length)) return { error: "amount or lineItems required" };
          const items = (inputs.lineItems && inputs.lineItems.length)
            ? inputs.lineItems.map((li: any) => ({ id: uid(), description: li.description, quantity: li.quantity || 1, unitPrice: li.unitPrice || 0 }))
            : [{ id: uid(), description: inputs.description || "Service", quantity: 1, unitPrice: Number(inputs.amount) || 0 }];
          const subtotal = items.reduce((s: number, i: any) => s + i.quantity * i.unitPrice, 0);
          const tax = Math.round(subtotal * ((Number(settings.taxRate) || 0) / 100) * 100) / 100;
          const total = Math.round((subtotal + tax) * 100) / 100;
          const depInv = alfredDepositFields(inputs, total);
          if ("error" in depInv) return depInv;
          const newInv = {
            id: uid(), customerId: c.id, lineItems: items, subtotal, discount: 0, depositRequired: 0, tax, total, ...depInv,
            status: "approved", createdAt: today(), validUntil: daysFromNow(30), viewed: false, viewedAt: null,
            terms: "Payment due upon receipt.", notes: inputs.notes || "", invoiced: true, invoicedAt: today(), owner_id: ownerId,
          };
          const { data: savedInv, error: invErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("estimates").insert(newInv).select().single(),
            15000, "Save invoice"
          ).catch((e: any) => ({ data: null, error: e }));
          console.log("[AlfredTool create_invoice] Supabase response — data:", savedInv, "error:", invErr);
          if (invErr || !savedInv) return { error: "Failed to create invoice — " + (invErr?.message || "Supabase write did not return a row") };
          toast("Alfred created invoice for " + c.firstName + " · " + fmt(total));
          if (onSpotlight) triggerSpotlight({ page: "invoices", type: "invoice", id: savedInv.id }); else setTimeout(() => onNav("invoices"), 1200);
          return { success: true, invoiceId: savedInv.id, total, customer: c.firstName + " " + c.lastName };
        }
        // FEATURE — "mark the Jones invoice as paid, they paid me cash."
        // Same write shape as InvoicesPage.tsx's own markPaid (paidAt +
        // status "approved" on the estimate, paymentStatus "Paid" mirrored
        // onto the linked job if there is one) — a genuinely common
        // request Alfred had no tool for at all until now.
        // FEATURE — "if I bill a customer for 5 different items, I can ask
        // Alfred what's the breakdown on that quote." No tool returned the
        // actual line items before — list_estimates only ever returned
        // totals. Resolves the most recent matching estimate/invoice by
        // customer if no id is given.
        case "get_estimate_breakdown": {
          let est: any = inputs.estimateId ? estimates.find(e => e.id === inputs.estimateId) : null;
          if (!est && inputs.customerName) {
            const c = customers.find(x => (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.customerName || "").trim().toLowerCase());
            if (!c) {
              const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
              return suggestions.length
                ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
                : { error: "Customer not found." };
            }
            const candidates = estimates.filter(e => e.customerId === c.id).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
            est = candidates[0];
            if (!est) return { error: `${inputs.customerName} has no quotes or invoices on file.` };
          }
          if (!est) return { error: "Need either estimateId or customerName." };
          const discountTotal = computeDiscountsTotal((est as any).discounts, est.subtotal) + (Number(est.discount) || 0);
          return {
            success: true,
            isInvoice: !!(est as any).invoiced,
            status: est.status,
            lineItems: (est.lineItems || []).map((li: any) => ({ description: li.description, quantity: li.quantity, unitPrice: li.unitPrice, lineTotal: (Number(li.quantity) || 1) * (Number(li.unitPrice) || 0) })),
            subtotal: est.subtotal,
            discountTotal,
            tax: est.tax,
            total: est.total,
            paid: !!est.paidAt,
          };
        }
        // FEATURE — "Alfred should be able to change the price for
        // invoices, quotes, and jobs" / "can you give a discount on this
        // quote." Adds a real, itemized Discount entry (never mutates
        // lineItems/subtotal directly — keeps the original pricing visible,
        // matching JobDetailModal's own stackable-discounts UI) and
        // recomputes the real total the same way computeDiscountsTotal
        // does everywhere else in the app.
        case "apply_discount_to_estimate": {
          let est: any = inputs.estimateId ? estimates.find(e => e.id === inputs.estimateId) : null;
          if (!est && inputs.customerName) {
            const c = customers.find(x => (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.customerName || "").trim().toLowerCase());
            if (!c) return { error: "Customer not found." };
            const candidates = estimates.filter(e => e.customerId === c.id && e.status !== "rejected").sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
            est = candidates[0];
            if (!est) return { error: `${inputs.customerName} has no quotes or invoices on file.` };
          }
          if (!est) return { error: "Need either estimateId or customerName." };
          if (est.paidAt) return { error: "That invoice is already paid — can't discount it after the fact. Issue a refund instead if needed." };
          if (!inputs.discountType || inputs.discountValue == null) return { error: "discountType and discountValue required." };
          const newDiscount = { id: uid(), label: inputs.label || "Discount", type: inputs.discountType === "percent" ? "percent" as const : "amount" as const, value: Number(inputs.discountValue) };
          const nextDiscounts = [...((est as any).discounts || []), newDiscount];
          const discountTotal = computeDiscountsTotal(nextDiscounts, est.subtotal) + (Number(est.discount) || 0);
          const nextTotal = Math.max(0, est.subtotal - discountTotal + (Number(est.tax) || 0));
          const patch = { discounts: nextDiscounts, total: nextTotal };
          setEstimates((prev: any[]) => prev.map(e => e.id === est.id ? { ...e, ...patch } : e));
          const { data, error } = await (supabase as any).from("estimates").update(patch).eq("id", est.id).select("id");
          if (error) return { error: "Failed to apply discount — " + error.message };
          if (!Array.isArray(data) || data.length === 0) return { error: "Couldn't save the discount (permissions or it no longer exists)." };
          if (inputs.notifyCustomer && inputs.customerMessage) {
            const c = customers.find(x => x.id === est.customerId);
            // BUG FIX (Alfred customer-texting audit) — same smsOptOut gap
            // as the other individual-customer SMS tools in this file.
            if (c?.smsOptOut) {
              return { success: true, newTotal: nextTotal, notifyWarning: c.firstName + " has opted out of texts — couldn't send the SMS." };
            }
            if (c?.phone && settings?.twilioSid) {
              try {
                await twilioSend(settings, c.phone, inputs.customerMessage);
                logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: inputs.customerMessage }).catch(() => {});
              } catch (e: any) {
                return { success: true, newTotal: nextTotal, notifyWarning: "Discount applied, but couldn't text the customer — " + (e?.message || String(e)) };
              }
            }
          }
          toast(`Alfred applied a discount — new total ${fmt(nextTotal)}`);
          if (onSpotlight) triggerSpotlight({ page: "estimates", type: "estimate", id: est.id });
          return { success: true, estimateId: est.id, newTotal: nextTotal, discountTotal };
        }
        // FEATURE — same price-modification ability, for a scheduled JOB's
        // own amount (distinct from an estimate/invoice's line items).
        case "update_job_price": {
          const j = await findJobFresh({ jobId: inputs.jobId, customerName: inputs.customerName });
          if (!j) return { error: "Job not found." };
          if (inputs.newAmount == null) return { error: "newAmount required." };
          const newAmount = Math.max(0, Number(inputs.newAmount));
          const result = await (supabase as any).from("jobs").update({ amount: newAmount }).eq("id", j.id).select("id");
          if (result?.error || !Array.isArray(result?.data) || result.data.length === 0) return { error: "Failed to update the job's price — " + (result?.error?.message || "it may belong to a different account") };
          setJobs((prev: any[]) => prev.map((x: any) => x.id === j.id ? { ...x, amount: newAmount } : x));
          toast(`Alfred updated the job's price to ${fmt(newAmount)}`);
          if (onSpotlight) triggerSpotlight({ page: "jobs", type: "job", id: j.id });
          return { success: true, jobId: j.id, newAmount };
        }
        case "mark_invoice_paid": {
          let inv: any = inputs.invoiceId ? estimates.find(e => e.id === inputs.invoiceId) : null;
          if (!inv && inputs.customerName) {
            const c = customers.find(x => (x.firstName + " " + x.lastName).trim().toLowerCase() === (inputs.customerName || "").trim().toLowerCase());
            if (!c) {
              const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
              return suggestions.length
                ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
                : { error: "Customer not found." };
            }
            const unpaid = estimates.filter(e => e.customerId === c.id && (e as any).invoiced && !e.paidAt).sort((a, b) => ((b as any).invoicedAt || "").localeCompare((a as any).invoicedAt || ""));
            inv = unpaid[0];
            if (!inv) return { error: `${inputs.customerName} has no unpaid invoice on file.` };
          }
          if (!inv) return { error: "Need either invoiceId or customerName." };
          if (inv.paidAt) return { success: true, note: "That invoice was already marked paid." };
          const paidAt = today();
          setEstimates((prev: any[]) => prev.map(e => e.id === inv.id ? { ...e, paidAt, status: "approved" } : e));
          const { data, error } = await (supabase as any).from("estimates").update({ paidAt, status: "approved" }).eq("id", inv.id).select("id");
          if (error) return { error: "Failed to mark paid — " + error.message };
          if (!Array.isArray(data) || data.length === 0) return { error: "Couldn't mark that invoice paid (permissions or it no longer exists)." };
          if ((inv as any).jobId) {
            setJobs((prev: any[]) => prev.map(j => j.id === (inv as any).jobId ? { ...j, paymentStatus: "Paid" } : j));
            // SECURITY/SYNC FIX (audit finding) — completely silent before,
            // no error log, no 0-row check; could leave estimates.paidAt set
            // but jobs.paymentStatus still "Pending" with no trace of why.
            (supabase as any).from("jobs").update({ paymentStatus: "Paid" }).eq("id", (inv as any).jobId).select("id")
              .then((r: any) => { if (r?.error || !Array.isArray(r?.data) || r.data.length === 0) console.warn("[AlfredTool mark_invoice_paid] jobs.paymentStatus write failed:", r?.error?.message || "matched 0 rows"); })
              .catch((e: any) => console.warn("[AlfredTool mark_invoice_paid] jobs.paymentStatus write threw:", e?.message));
          }
          toast("Alfred marked invoice paid ✓ · " + fmt(inv.total));
          if (onSpotlight) triggerSpotlight({ page: "invoices", type: "invoice", id: inv.id });
          return { success: true, invoiceId: inv.id, amount: inv.total, paidAt };
        }
        // FEATURE — Alfred capability gap fill: editing an existing
        // customer's contact info (create_customer only ever handled
        // brand-new customers).
        case "update_customer": {
          const c = customers.find((x: any) => (x.firstName + " " + x.lastName).trim().toLowerCase().includes((inputs.customerName || "").trim().toLowerCase()));
          if (!c) return { error: `No customer found matching "${inputs.customerName}".` };
          const patch: Record<string, unknown> = {};
          for (const f of ["phone", "email", "address", "notes"]) if (inputs[f] !== undefined) patch[f] = inputs[f];
          if (Object.keys(patch).length === 0) return { error: "Nothing to update — provide at least one of phone/email/address/notes." };
          setCustomers((prev: any[]) => prev.map(x => x.id === c.id ? { ...x, ...patch } : x));
          const { data, error } = await (supabase as any).from("customers").update(patch).eq("id", c.id).select("id");
          if (error) return { error: "Failed to update — " + error.message };
          if (!Array.isArray(data) || data.length === 0) return { error: "Couldn't update that customer (permissions or it no longer exists)." };
          toast("Alfred updated " + c.firstName + " " + c.lastName);
          if (onSpotlight) triggerSpotlight({ page: "customers", type: "customer", id: c.id });
          return { success: true, customer: `${c.firstName} ${c.lastName}`.trim(), updated: Object.keys(patch) };
        }
        // FEATURE — Alfred capability gap fill: replying to a customer
        // review on the owner's behalf.
        case "respond_to_review": {
          const q = (inputs.customerName || "").toLowerCase().trim();
          const review = reviews.find((r: any) => (r.customerName || "").toLowerCase().includes(q) && !r.response)
            || reviews.find((r: any) => (r.customerName || "").toLowerCase().includes(q));
          if (!review) return { error: `No review found for "${inputs.customerName}".` };
          if (!inputs.response?.trim()) return { error: "response text required." };
          setReviews((prev: any[]) => prev.map((r: any) => r.id === review.id ? { ...r, response: inputs.response, status: "responded" } : r));
          const { data, error } = await (supabase as any).from("reviews").update({ response: inputs.response, status: "responded" }).eq("id", review.id).select("id");
          if (error) return { error: "Failed to post reply — " + error.message };
          if (!Array.isArray(data) || data.length === 0) return { error: "Couldn't post that reply (permissions or the review no longer exists)." };
          toast("Alfred replied to " + review.customerName + "'s review ✓");
          return { success: true, customer: review.customerName, rating: review.rating };
        }
        // FEATURE — Alfred capability gap fill: who's outstanding on
        // required training (the new employee training system).
        case "get_employee_training_status": {
          const requiredModules = (trainingModules || []).filter((m: any) => m?.required);
          if (requiredModules.length === 0) return { success: true, note: "No required training modules set up." };
          const { data: completions } = await (supabase as any).from("training_completions").select("module_id,employee_id,passed").eq("owner_id", ownerId);
          const passedSet = new Set((completions || []).filter((c: any) => c.passed).map((c: any) => `${c.module_id}:${c.employee_id}`));
          const activeEmployees = employees.filter((e: any) => e.status === "active" && e.role !== "owner");
          const outstanding: Array<{ employee: string; missing: string[] }> = [];
          for (const emp of activeEmployees) {
            const missing = requiredModules.filter((m: any) => !passedSet.has(`${m.id}:${emp.id}`)).map((m: any) => m.title);
            if (missing.length > 0) outstanding.push({ employee: `${emp.firstName || ""} ${emp.lastName || ""}`.trim(), missing });
          }
          if (outstanding.length === 0) return { success: true, summary: "Every active employee is fully trained on all required modules." };
          return { success: true, outstanding };
        }
        // FEATURE — Alfred capability gap fill: attaching a file to a
        // JOB's work-order attachments (attach_file_to_customer only ever
        // wrote to the customer's document vault).
        case "attach_file_to_job": {
          if (!inputs.fileUrl) return { error: "fileUrl required" };
          let job: any = inputs.jobId ? jobs.find((j: any) => j.id === inputs.jobId) : null;
          if (!job && inputs.customerName) {
            const c = customers.find((x: any) => (x.firstName + " " + x.lastName).trim().toLowerCase().includes((inputs.customerName || "").trim().toLowerCase()));
            if (!c) return { error: `No customer found matching "${inputs.customerName}".` };
            job = jobs.filter((j: any) => j.customerId === c.id && j.status !== "cancelled" && j.status !== "completed").sort((a: any, b: any) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""))[0];
          }
          if (!job) return { error: "Couldn't find that job." };
          const newAtt = { id: uid(), name: inputs.fileName || inputs.fileUrl.split("/").pop() || "file", type: (inputs.fileName || inputs.fileUrl).toLowerCase().endsWith(".pdf") ? "pdf" : "other", url: inputs.fileUrl, uploadedAt: Date.now() };
          const attachments = [...(job.attachments || []), newAtt];
          setJobs((prev: any[]) => prev.map(j => j.id === job.id ? { ...j, attachments } : j));
          const { data, error } = await (supabase as any).from("jobs").update({ attachments }).eq("id", job.id).select("id");
          if (error) return { error: "Failed to attach — " + error.message };
          if (!Array.isArray(data) || data.length === 0) return { error: "Couldn't attach that file (permissions or the job no longer exists)." };
          toast("Alfred attached " + newAtt.name + " to the job ✓");
          return { success: true, attachedTo: job.customerName || job.id, fileName: newAtt.name };
        }
        // FEATURE — Alfred capability gap fill: hiring-pipeline visibility.
        // candidates isn't part of App.tsx's shared state (HiringPage.tsx
        // fetches its own), so this reads fresh from Supabase directly.
        case "list_candidates": {
          const { data, error } = await (supabase as any).from("candidates").select('"firstName","lastName",phase,phone,email').eq("owner_id", ownerId);
          if (error) return { error: "Failed to list candidates — " + error.message };
          return { success: true, count: (data || []).length, candidates: (data || []).map((c: any) => ({ name: `${c.firstName || ""} ${c.lastName || ""}`.trim(), phase: c.phase, phone: c.phone, email: c.email })) };
        }
        case "move_candidate_phase": {
          if (!inputs.candidateName?.trim() || !inputs.phase?.trim()) return { error: "candidateName and phase are required." };
          const { data: rows, error: findErr } = await (supabase as any).from("candidates").select('id,"firstName","lastName",phase').eq("owner_id", ownerId);
          if (findErr) return { error: "Failed to look up candidates — " + findErr.message };
          const q = inputs.candidateName.toLowerCase().trim();
          const cand = (rows || []).find((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().includes(q));
          if (!cand) return { error: `No candidate found matching "${inputs.candidateName}".` };
          const { data, error } = await (supabase as any).from("candidates").update({ phase: inputs.phase }).eq("id", cand.id).select("id");
          if (error) return { error: "Failed to move candidate — " + error.message };
          if (!Array.isArray(data) || data.length === 0) return { error: "Couldn't move that candidate (permissions or they no longer exist)." };
          toast(`Alfred moved ${cand.firstName} ${cand.lastName} to ${inputs.phase} ✓`);
          return { success: true, candidate: `${cand.firstName} ${cand.lastName}`.trim(), from: cand.phase, to: inputs.phase };
        }
        // FEATURE — Alfred capability gap fill: fleet maintenance logging.
        // vehicles/maintenance are localStorage-only (not Supabase-synced),
        // so this ONLY works in-app — the SMS agent has no way to reach
        // this data server-side, same known limitation class as
        // expenses/chemicals noted elsewhere in this file.
        case "log_vehicle_maintenance": {
          const v = vehicles.find((x: any) => `${x.year} ${x.make} ${x.model}`.toLowerCase().includes((inputs.vehicle || "").toLowerCase()) || (x.plate || "").toLowerCase() === (inputs.vehicle || "").toLowerCase());
          if (!v) return { error: `No vehicle found matching "${inputs.vehicle}".` };
          const rec = { id: uid(), vehicleId: v.id, type: inputs.type || "Service", date: today(), mileage: Number(inputs.mileage) || v.mileage || 0, cost: Number(inputs.cost) || 0, notes: inputs.notes || "" };
          setMaintenance((prev: any[]) => [rec, ...prev]);
          if (rec.mileage > (v.mileage || 0)) setVehicles((prev: any[]) => prev.map((x: any) => x.id === v.id ? { ...x, mileage: rec.mileage } : x));
          toast("Alfred logged maintenance for " + v.year + " " + v.make + " " + v.model);
          return { success: true, vehicle: `${v.year} ${v.make} ${v.model}`, type: rec.type, cost: rec.cost };
        }
        case "get_vehicle_status": {
          if (vehicles.length === 0) return { success: true, note: "No vehicles in the fleet yet." };
          return { success: true, vehicles: vehicles.map((v: any) => ({ label: `${v.year} ${v.make} ${v.model}`, plate: v.plate, mileage: v.mileage, status: v.status || "active", lastOilChangeMileage: v.lastOilChange, lastOilChangeDate: v.lastOilChangeDate })) };
        }
        case "get_calendar_summary": {
          const from = inputs.from || today();
          const to = inputs.to || daysFromNow(7);
          const crmJobs = jobs.filter(j => j.scheduledDate >= from && j.scheduledDate <= to && j.status !== "cancelled").map(j => {
            const c = customers.find(x => x.id === j.customerId);
            return { jobId: j.id, date: j.scheduledDate, time: j.scheduledTime, customer: c ? c.firstName + " " + c.lastName : "Unknown", address: j.address, status: j.status, amount: j.amount, googleEventId: (j as any).googleEventId || null };
          }).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

          // FEATURE — "what's my availability/agenda this week" needs BOTH
          // sources cross-checked, not just CRM jobs: a job the owner never
          // synced to Google (or that sync silently failing, as it did for
          // months — see getFreshOwnerGoogleToken fix) shouldn't be invisible
          // to "what's on my calendar", and a personal/non-job Google event
          // (dentist, another business's meeting) should still show up as a
          // real time commitment even though it has no CRM job behind it.
          let googleEvents: any[] = [];
          let googleConnected = false;
          try {
            const token = await getFreshOwnerGoogleToken(settings as any);
            if (token) {
              googleConnected = true;
              const events = await fetchCalendarEvents(token);
              googleEvents = events.filter(ev => {
                const d = (ev.start || "").slice(0, 10);
                return d >= from && d <= to;
              });
            }
          } catch (e: any) { console.warn("[AlfredTool get_calendar_summary] Google Calendar fetch failed:", e?.message); }

          const jobEventIds = new Set(crmJobs.map(j => j.googleEventId).filter(Boolean));
          // A CRM job that never made it to Google (no googleEventId, or the
          // id it has doesn't actually exist in the fetched range anymore —
          // e.g. deleted directly in Google).
          const fetchedIds = new Set(googleEvents.map(ev => ev.id));
          const jobsMissingFromGoogle = crmJobs.filter(j => !j.googleEventId || !fetchedIds.has(j.googleEventId));
          // A Google event with no CRM job behind it at all — could be a real
          // personal commitment, or a job whose Calendar event was created
          // but the CRM side never got the id (e.g. the same historical sync
          // bug from the other direction).
          const googleOnlyEvents = googleEvents.filter(ev => !jobEventIds.has(ev.id)).map(ev => ({ title: ev.title, start: ev.start, end: ev.end, location: ev.location }));

          return {
            from, to, googleCalendarConnected: googleConnected,
            crmJobs, crmJobCount: crmJobs.length,
            googleOnlyEvents, googleOnlyEventCount: googleOnlyEvents.length,
            jobsNotOnGoogleCalendar: jobsMissingFromGoogle.map(j => ({ date: j.date, time: j.time, customer: j.customer })),
            note: googleConnected
              ? (googleOnlyEvents.length || jobsMissingFromGoogle.length
                  ? "There are discrepancies between the CRM and Google Calendar — report both lists to the owner by name/date, don't just give a job count."
                  : "CRM jobs and Google Calendar agree for this range.")
              : "Google Calendar isn't connected, so this is CRM jobs only — mention that if the owner asked about their real calendar.",
          };
        }
        case "delete_calendar_event": {
          const token = await getFreshOwnerGoogleToken(settings as any);
          if (!token) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
          let eventId = inputs.eventId;
          // Let the owner refer to it by title/date instead of an id they'd
          // never know — look it up in the same window get_calendar_summary
          // already searches.
          if (!eventId && inputs.title) {
            const events = await fetchCalendarEvents(token);
            const q = String(inputs.title).toLowerCase();
            const match = events.find(ev => (ev.title || "").toLowerCase().includes(q) && (!inputs.date || (ev.start || "").slice(0, 10) === inputs.date));
            if (!match) return { error: `No Google Calendar event found matching "${inputs.title}"${inputs.date ? " on " + inputs.date : ""} — call get_calendar_summary first to see what's actually there.` };
            eventId = match.id;
          }
          if (!eventId) return { error: "Need either eventId or a title to find it by." };
          try {
            await deleteGCalEvent(token, eventId);
          } catch (e: any) {
            return { error: "Google Calendar error: " + (e?.message || "delete failed") };
          }
          // If a CRM job was pointing at this event, clear the stale link.
          const linkedJob = jobs.find(j => (j as any).googleEventId === eventId);
          if (linkedJob) setJobs((prev: any[]) => prev.map(j => j.id === linkedJob.id ? { ...j, googleEventId: null } : j));
          return { success: true, deleted: true };
        }
        case "get_employee_status": {
          // FIX — this only recognized a job as "active" via the OWNER's own
          // per-job clock (job.clockInAt), which a field employee never sets
          // — they use "I'm Here" (arrivedAt) or the job simply flips to
          // status "in_progress". So a technician who had arrived and was
          // actively on a job still reported as "not on a job" here, exactly
          // like the Live Team View bug fixed earlier in Dashboard.tsx —
          // same broadened match applied here for consistency.
          const list = employees.filter((e: any) => e.status === "active").map((e: any) => {
            const activeJob = jobs.find((j: any) =>
              (j.crew || []).includes(e.id) &&
              j.status !== "completed" && j.status !== "cancelled" &&
              (j.status === "in_progress" || !!j.clockInAt || !!j.arrivedAt)
            );
            const sinceMs = activeJob ? (activeJob.clockInAt || activeJob.arrivedAt) : null;
            return {
              name: e.firstName + " " + e.lastName,
              clockedInForDay: !!e.dayClockInAt,
              onJob: activeJob ? { address: activeJob.address, elapsedMinutes: sinceMs ? Math.round((Date.now() - sinceMs) / 60000) : null } : null,
            };
          });
          return { count: list.length, employees: list };
        }
        case "assign_employee": {
          const j = await findJobFresh({ jobId: inputs.jobId, customerName: inputs.customerName });
          if (!j) return { error: "Job not found" };
          const emp = employees.find(e => e.id === inputs.employeeId || (e.firstName + " " + e.lastName).trim().toLowerCase() === (inputs.employeeName || "").trim().toLowerCase());
          if (!emp) {
            const suggestions = suggestNames(inputs.employeeName || "", employees, e => `${e.firstName} ${e.lastName}`);
            return suggestions.length
              ? { error: "Employee not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Employee not found" };
          }
          const crew = j.crew || [];
          if (crew.includes(emp.id)) {
            return { success: true, jobId: j.id, employeeId: emp.id, employee: emp.firstName + " " + emp.lastName, note: "Already assigned" };
          }
          const newCrew = [...crew, emp.id];
          const crewAssignedAt = { ...(j.crewAssignedAt || {}), [emp.id]: Date.now() };
          // CRITICAL: persist to Supabase so the employee's portal (which polls
          // Supabase directly every 3s) actually sees the assignment. The old
          // code only did setJobs() locally, so Alfred's assignment never left
          // the owner's browser — the whole "Alfred can't assign crew" bug.
          const { error: assignErr } = await withTimeoutRetry<any>(
            () => (supabase as any).from("jobs").update({ crew: newCrew, crewAssignedAt }).eq("id", j.id),
            15000, "Assign crew"
          ).catch((e: any) => ({ error: e }));
          if (assignErr) {
            console.error("[Alfred assign_employee] — error:", assignErr.message || assignErr);
            return { error: "Could not save the assignment — " + (assignErr.message || String(assignErr)) };
          }
          // reconcileCrewAfterAssign — `newCrew` was computed from Alfred's
          // own possibly-stale `jobs` state. If the owner directly assigned
          // someone else on the CRM (or an employee accepted a pending
          // request) for this same job moments ago, this write would
          // otherwise silently overwrite that addition instead of adding
          // alongside it.
          reconcileCrewAfterAssign(j.id, newCrew, crewAssignedAt, p =>
            (supabase as any).from("jobs").update(p).eq("id", j.id)
          ).catch(() => {});
          // Local echo so the owner UI reflects it before the next poll.
          setJobs(prev => prev.map(x => x.id === j.id ? { ...x, crew: newCrew, crewAssignedAt } : x));
          // Push onto the employee's own Google Calendar if connected — see
          // functions/api/employee-calendar-sync.ts. Fire-and-forget.
          // SECURITY FIX (audit finding) — that endpoint now requires a real
          // session and derives ownerId from it server-side, never the body.
          supabase.auth.getSession().then(({ data: { session: syncSession } }) => fetch("/api/employee-calendar-sync", {
            method: "POST", headers: { "Content-Type": "application/json", ...(syncSession?.access_token ? { Authorization: `Bearer ${syncSession.access_token}` } : {}) },
            body: JSON.stringify({
              employeeId: emp.id, jobId: j.id, action: "upsert",
              title: (() => { const c = customers.find(x => x.id === j.customerId); return (c ? c.firstName + " " + c.lastName + " — " : "") + "Service"; })(),
              date: j.scheduledDate, time: j.scheduledTime, durationMinutes: (Number(j.duration) || 2) * 60,
              location: j.address,
              notes: buildJobCalendarDescription(j, customers.find(x => x.id === j.customerId), `${window.location.origin}${window.location.pathname}#/portal?job=${encodeURIComponent(j.id)}`, "View job in Crew Portal"),
            }),
          })).catch(() => {});
          if (emp.email) {
            const c = customers.find(x => x.id === j.customerId);
            // Queued (see pendingAssignmentEmailsRef) instead of sent
            // immediately — assigning the same employee to several jobs in
            // one turn now sends ONE summary email, not one per job.
            (pendingAssignmentEmailsRef.current[emp.email] ||= []).push({
              employeeFirstName: emp.firstName, jobId: j.id, date: j.scheduledDate, time: j.scheduledTime || "", address: j.address, customerName: c ? c.firstName + " " + c.lastName : "", duration: (j as any).duration,
            });
          }
          toast("Alfred assigned " + emp.firstName + " to the " + j.scheduledDate + " job");
          if (onSpotlight) triggerSpotlight({ page: "jobs", type: "job", id: j.id });
          return { success: true, jobId: j.id, employeeId: emp.id, employee: emp.firstName + " " + emp.lastName };
        }
        case "request_employee": {
          const j = await findJobFresh({ jobId: inputs.jobId, customerName: inputs.customerName });
          if (!j) return { error: "Job not found" };
          const emp = employees.find(e => e.id === inputs.employeeId || (e.firstName + " " + e.lastName).trim().toLowerCase() === (inputs.employeeName || "").trim().toLowerCase());
          if (!emp) {
            const suggestions = suggestNames(inputs.employeeName || "", employees, e => `${e.firstName} ${e.lastName}`);
            return suggestions.length
              ? { error: "Employee not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Employee not found" };
          }
          try {
            if (!ownerId) return { error: "Still finishing sign-in — try again in a moment" };
            const { data, error } = await withTimeoutRetry<any>(
              () => (supabase as any).from("job_requests").insert({
                job_id: j.id, employee_id: emp.id, owner_id: ownerId, status: "pending", message: inputs.message || null,
              }).select("id").single(),
              15000, "Save request"
            );
            if (error || !data) return { error: "Could not save request — " + (error?.message || "run the job_requests SQL in Supabase first") };
            if (emp.email) {
              const c = customers.find(x => x.id === j.customerId);
              const reqUrl = `${window.location.origin}${window.location.pathname}#/portal?request=${data.id}`;
              const html = emailShell(settings,"Job Request", `<p>Hi ${emp.firstName},</p><p>${inputs.message || "You have a new job request:"}</p><ul><li><b>Date:</b> ${j.scheduledDate}${j.scheduledTime ? " at " + j.scheduledTime : ""}</li><li><b>Address:</b> ${j.address}</li>${c ? `<li><b>Customer:</b> ${c.firstName} ${c.lastName}</li>` : ""}</ul><div style="text-align:center;margin:22px 0 4px"><a href="${reqUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px;margin-right:8px">✓ Accept Job</a><a href="${reqUrl}&action=deny" style="display:inline-block;background:#b91c1c;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 24px;border-radius:10px">✗ Decline</a></div>`);
              withTimeout(sendEmail(settings, { to: emp.email, subject: `Job Request — ${j.scheduledDate}`, body: html }), 8000, "Email send").catch((e: any) => console.warn("Alfred job request email failed — request still saved:", e?.message));
            }
            toast("Alfred sent a job request to " + emp.firstName);
            if (onSpotlight) triggerSpotlight({ page: "jobs", type: "job", id: j.id });
            return { success: true, jobId: j.id, employeeId: emp.id, requestId: data.id, employee: emp.firstName + " " + emp.lastName };
          } catch (e: any) {
            return { error: "Request failed: " + (e?.message || String(e)) };
          }
        }
        // FEATURE — parity pass with text-Alfred (alfredSmsAgent.ts), which
        // already had these 5 job-request/customer-request tools; the
        // in-app chat had no way to see or act on pending requests at all,
        // only to CREATE new ones via request_employee.
        case "list_job_requests": {
          const { data: rows } = await (supabase as any).from("job_requests").select("id,employee_id,job_id,message,status").eq("owner_id", ownerId).eq("status", "pending").limit(50);
          if (!rows || rows.length === 0) return { success: true, requests: [], summary: "No pending job requests." };
          return {
            success: true,
            requests: rows.map((r: any) => {
              const emp = employees.find((e: any) => e.id === r.employee_id);
              const job = jobs.find((j: any) => j.id === r.job_id);
              const c = job ? customers.find((x: any) => x.id === job.customerId) : null;
              return { id: r.id, employee: emp ? `${emp.firstName} ${emp.lastName}` : r.employee_id, job: job ? `${c ? c.firstName + " " + c.lastName : "?"} (${job.scheduledDate})` : r.job_id, message: r.message };
            }),
          };
        }
        case "respond_to_job_request": {
          if (!inputs.requestId || inputs.approve === undefined) return { error: "requestId and approve required" };
          const patch: any = { status: inputs.approve ? "approved" : "denied", responded_at: new Date().toISOString() };
          if (!inputs.approve && inputs.reason) patch.denial_reason = inputs.reason;
          // SECURITY/SYNC FIX (audit finding) — neither write here checked
          // for the RLS 0-row-silent-success case (docs/ARCHITECTURE.md): Alfred could
          // tell the owner "approved" while job_requests/jobs.crew never
          // actually changed.
          const respRes = await (supabase as any).from("job_requests").update(patch).eq("id", inputs.requestId).select("id");
          if (respRes?.error) return { error: "Couldn't update the request — " + respRes.error.message };
          if (!Array.isArray(respRes?.data) || respRes.data.length === 0) return { error: "The request couldn't be updated — it may not exist or belong to a different account." };
          if (inputs.approve) {
            const { data: reqRow } = await (supabase as any).from("job_requests").select("employee_id,job_id").eq("id", inputs.requestId).maybeSingle();
            if (reqRow?.job_id && reqRow?.employee_id) {
              const j = jobs.find((x: any) => x.id === reqRow.job_id);
              const crew = Array.from(new Set([...(j?.crew || []), reqRow.employee_id]));
              const crewRes = await (supabase as any).from("jobs").update({ crew }).eq("id", reqRow.job_id).select("id");
              if (crewRes?.error || !Array.isArray(crewRes?.data) || crewRes.data.length === 0) return { error: "Request approved, but the crew assignment didn't save — " + (crewRes?.error?.message || "the job may belong to a different account") };
              setJobs((prev: any[]) => prev.map((x: any) => x.id === reqRow.job_id ? { ...x, crew } : x));
            }
          }
          toast("Job request " + (inputs.approve ? "approved" : "denied"));
          return { success: true, status: inputs.approve ? "approved" : "denied" };
        }
        case "list_pending_customer_requests": {
          const { data: rows } = await (supabase as any).from("alfred_pending_actions").select("id,customer_id,job_id,kind,proposed,created_at").eq("owner_id", ownerId).eq("status", "pending").order("created_at", { ascending: false }).limit(25);
          if (!rows || rows.length === 0) return { success: true, requests: [], summary: "Nothing pending." };
          return {
            success: true,
            requests: rows.map((r: any) => {
              const c = customers.find((x: any) => x.id === r.customer_id);
              return { requestId: r.id, customer: c ? `${c.firstName} ${c.lastName}`.trim() : "Unknown", kind: r.kind, proposed: r.proposed, createdAt: r.created_at };
            }),
          };
        }
        case "approve_customer_request": {
          if (!inputs.requestId) return { error: "requestId required" };
          const { data: row } = await (supabase as any).from("alfred_pending_actions").select("id,customer_id,job_id,kind,proposed,customer_phone,status").eq("id", inputs.requestId).maybeSingle();
          if (!row) return { error: "Request not found." };
          if (row.status !== "pending") return { error: `That request was already ${row.status}.` };
          if (row.kind === "reschedule") {
            const patch: any = { scheduledDate: row.proposed.toDate };
            if (row.proposed.toTime) patch.scheduledTime = row.proposed.toTime;
            // SECURITY/SYNC FIX (audit finding) — same 0-row check needed here.
            const moveRes = await (supabase as any).from("jobs").update(patch).eq("id", row.job_id).select("id");
            if (moveRes?.error) return { error: "Couldn't move the job — " + moveRes.error.message };
            if (!Array.isArray(moveRes?.data) || moveRes.data.length === 0) return { error: "The job couldn't be moved — it may not exist or belong to a different account." };
            setJobs((prev: any[]) => prev.map((x: any) => x.id === row.job_id ? { ...x, ...patch } : x));
          }
          {
            const resolveRes = await (supabase as any).from("alfred_pending_actions").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", row.id).select("id");
            if (resolveRes?.error || !Array.isArray(resolveRes?.data) || resolveRes.data.length === 0) return { error: "Couldn't mark the request resolved — " + (resolveRes?.error?.message || "it may belong to a different account") };
          }
          const custRow = customers.find((x: any) => x.id === row.customer_id);
          const confirmMsg = `Hi ${custRow?.firstName || ""}, you're all set — we've moved your appointment to ${row.proposed.toDate}${row.proposed.toTime ? " at " + row.proposed.toTime : ""}. See you then!`;
          let notifyWarning: string | undefined;
          try {
            await twilioSend(settings, row.customer_phone, confirmMsg);
            logOutboundSmsToInbox({ contactName: `${custRow?.firstName || ""} ${custRow?.lastName || ""}`.trim(), contactPhone: row.customer_phone, customerId: row.customer_id, body: confirmMsg }).catch(() => {});
          } catch (e: any) { notifyWarning = "Approved, but couldn't text the customer — " + (e?.message || String(e)); }
          toast("Customer request approved");
          return { success: true, ...(notifyWarning ? { notifyWarning } : {}) };
        }
        case "decline_customer_request": {
          if (!inputs.requestId) return { error: "requestId required" };
          const { data: row } = await (supabase as any).from("alfred_pending_actions").select("id,customer_id,customer_phone,status").eq("id", inputs.requestId).maybeSingle();
          if (!row) return { error: "Request not found." };
          if (row.status !== "pending") return { error: `That request was already ${row.status}.` };
          await (supabase as any).from("alfred_pending_actions").update({ status: "declined", resolved_at: new Date().toISOString() }).eq("id", row.id);
          const custRow = customers.find((x: any) => x.id === row.customer_id);
          const declineMsg = `Hi ${custRow?.firstName || ""}, unfortunately that time doesn't work${inputs.reason ? ` (${inputs.reason})` : ""} — give us a call/text and we'll find something that does.`;
          let notifyWarning: string | undefined;
          try {
            await twilioSend(settings, row.customer_phone, declineMsg);
            logOutboundSmsToInbox({ contactName: `${custRow?.firstName || ""} ${custRow?.lastName || ""}`.trim(), contactPhone: row.customer_phone, customerId: row.customer_id, body: declineMsg }).catch(() => {});
          } catch (e: any) { notifyWarning = "Declined, but couldn't text the customer — " + (e?.message || String(e)); }
          toast("Customer request declined");
          return { success: true, ...(notifyWarning ? { notifyWarning } : {}) };
        }
        case "list_pending_approvals": {
          const { data: rows } = await (supabase as any).from("alfred_pending_actions").select("id,proposed,created_at").eq("owner_id", ownerId).eq("status", "pending").eq("kind", "action_confirmation").order("created_at", { ascending: false }).limit(25);
          if (!rows || rows.length === 0) return { success: true, actions: [], summary: "Nothing waiting on your approval." };
          return { success: true, actions: rows.map((r: any) => ({ actionId: r.id, summary: r.proposed?.summary || describeActionForOwner(r.proposed?.toolName, r.proposed?.input || {}), createdAt: r.created_at })) };
        }
        case "approve_pending_action": {
          if (!inputs.actionId) return { error: "actionId required" };
          const { data: row } = await (supabase as any).from("alfred_pending_actions").select("id,proposed,status").eq("id", inputs.actionId).eq("kind", "action_confirmation").maybeSingle();
          if (!row) return { error: "Queued action not found." };
          if (row.status !== "pending") return { error: `That action was already ${row.status}.` };
          // executeToolCore, not executeTool — deliberately bypasses the
          // autonomy gate here (it already ran once when this was queued;
          // running it again would just re-queue it forever instead of
          // actually performing it).
          const result = await executeToolCore(row.proposed.toolName, row.proposed.input || {});
          const resolveRes = await (supabase as any).from("alfred_pending_actions").update({ status: "approved", resolved_at: new Date().toISOString() }).eq("id", row.id).select("id");
          if (resolveRes?.error || !Array.isArray(resolveRes?.data) || resolveRes.data.length === 0) console.warn("[Alfred Autonomy] couldn't mark action approved:", resolveRes?.error?.message);
          toast("Action approved");
          return { success: true, approved: true, result };
        }
        case "decline_pending_action": {
          if (!inputs.actionId) return { error: "actionId required" };
          const { data: row } = await (supabase as any).from("alfred_pending_actions").select("id,status").eq("id", inputs.actionId).eq("kind", "action_confirmation").maybeSingle();
          if (!row) return { error: "Queued action not found." };
          if (row.status !== "pending") return { error: `That action was already ${row.status}.` };
          const resolveRes = await (supabase as any).from("alfred_pending_actions").update({ status: "declined", resolved_at: new Date().toISOString() }).eq("id", row.id).select("id");
          if (resolveRes?.error || !Array.isArray(resolveRes?.data) || resolveRes.data.length === 0) return { error: "Couldn't decline it — " + (resolveRes?.error?.message || "it may belong to a different account") };
          toast("Action declined");
          return { success: true, declined: true };
        }
        case "set_autonomy_level": {
          if (!inputs.level) return { error: "level required (manage_everything, ask_first, or hold_everything)" };
          const patch = { ...(settings as any), alfredAutonomyLevel: inputs.level };
          const res = await (supabase as any).from("app_settings").update({ data: patch }).eq("owner_id", ownerId).select("owner_id");
          if (res?.error || !Array.isArray(res?.data) || res.data.length === 0) return { error: "Couldn't save — " + (res?.error?.message || "settings row didn't match") };
          setSettings((prev: any) => ({ ...prev, alfredAutonomyLevel: inputs.level }));
          toast("Alfred's autonomy level set to " + inputs.level.replace(/_/g, " "));
          return { success: true, level: inputs.level };
        }
        case "send_reminder": {
          if ((directSendsRef.current += 1) > 3) return { error: "Refused: more than 3 separate texts in one go. Use notify_all_customers so the owner can approve the list first." };
          // CRITICAL (Alfred functionality audit) — this used to look up
          // ONLY by customerId (no name fallback, unlike every other tool
          // here), and its schema didn't even declare `message`/`customerName`
          // as accepted params — so "Text John and tell him X" had no real
          // way to reach this tool correctly. Worse: if the chosen channel
          // had no matching contact info (e.g. channel="sms" but the
          // customer has no phone), the whole if/else block was silently
          // skipped and it STILL reported {success:true} and toasted
          // "sent" — a genuine claims-to-but-doesn't bug, not just a missing
          // feature.
          const c = await findCustomerFresh({ customerId: inputs.customerId, customerName: inputs.customerName });
          if (!c) {
            const suggestions = suggestNames(inputs.customerName || "", customers, x => `${x.firstName} ${x.lastName}`);
            return suggestions.length
              ? { error: "Customer not found", suggestions, instruction: "Ask the user 'Do you mean " + suggestions.join(", or ") + "?' — do not ask a generic follow-up question." }
              : { error: "Customer not found" };
          }
          const msg = inputs.message || ("Hi " + c.firstName + ", a quick reminder from CRM Starter. Reply or call (555) 555-0100.");
          // BUG FIX (Alfred customer-texting audit) — smsOptOut is a real,
          // owner-set-per-customer field (CustomerDetail.tsx's opt-in/out
          // badge) that notify_all_customers already respects, but every
          // OTHER individual-customer SMS tool in this file — this one
          // included — never checked it at all, meaning an opted-out
          // customer could still get texted by name through Alfred even
          // though the CRM itself shows them as opted out. Enforced here as
          // a real backstop (not just something the model has to remember
          // to check), with a clear reason back instead of a silent skip.
          if (inputs.channel === "sms" && c.smsOptOut) return { error: c.firstName + " has opted out of text messages — send channel: email instead, or ask them to opt back in first." };
          const channel = inputs.channel || (c.phone && !c.smsOptOut ? "sms" : "email");
          if (channel === "sms") {
            if (c.smsOptOut) return { error: c.firstName + " has opted out of text messages — use channel: email instead." };
            if (!c.phone) return { error: "No phone on file for " + c.firstName + " — use channel: email, or add a phone number first." };
            if (!settings?.twilioSid) return { error: "Twilio isn't configured — add credentials in Settings → API Keys to send real SMS." };
            try {
              await twilioSend(settings, c.phone, msg);
              logOutboundSmsToInbox({ contactName: c.firstName + " " + c.lastName, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
            } catch (e: any) { return { error: "SMS failed: " + (e?.message || String(e)) }; }
          } else {
            if (!c.email) return { error: "No email on file for " + c.firstName + " — use channel: sms, or add an email first." };
            try {
              await sendEmail(settings, { to: c.email, subject: inputs.subject || "Message from " + (settings?.companyName || "CRM Starter"), body: emailShell(settings,"Message", `<p>${msg}</p>`) });
            } catch (e: any) { return { error: "Email failed: " + (e?.message || String(e)) }; }
          }
          toast("Alfred sent a message to " + c.firstName + " via " + channel + " ✓");
          return { success: true, sentTo: c.firstName + " " + c.lastName, channel, message: msg };
        }
        case "remember_fact": {
          if (!inputs.fact) return { error: "fact required" };
          // BUG FIX (memory-system audit) — no duplicate check meant asking
          // Alfred to remember the same thing twice (a common way people
          // actually talk — restating something for emphasis, or across
          // separate conversations) created two identical rows, both
          // injected into every future prompt.
          if (memory.some((m: any) => m.text.toLowerCase() === String(inputs.fact).toLowerCase())) {
            return { success: true, note: "Already remembered — didn't duplicate it." };
          }
          const newMem = { id: uid(), text: inputs.fact, category: inputs.category || "general", createdAt: today() };
          setMemory(prev => [...prev, newMem]);
          toast("Alfred remembered something");
          return { success: true, remembered: inputs.fact };
        }
        // FEATURE (memory-system audit) — symmetry with remember_fact: the
        // owner could only remove a bad/outdated memory through the manual
        // Memory management UI before; "Alfred, forget that" now works too.
        case "forget_fact": {
          if (!inputs.fact) return { error: "fact required — the exact or approximate text to forget" };
          const q = String(inputs.fact).toLowerCase();
          const match = memory.find((m: any) => m.text.toLowerCase() === q || m.text.toLowerCase().includes(q));
          if (!match) return { error: "Couldn't find a memory matching that — try recall_facts first to see the exact wording." };
          setMemory((prev: any[]) => prev.filter((m: any) => m.id !== match.id));
          // BUG FIX (audit finding — critical) — see removeMemory's comment:
          // scoped to owner_id + verified via .select("id") so a 0-row RLS
          // miss doesn't silently leave the fact intact while Alfred claims
          // it forgot it.
          (supabase as any).from("alfred_memory").delete().eq("id", match.id).eq("owner_id", ownerId).select("id").then((r: any) => {
            if (r?.error) { console.warn("[Alfred Memory] forget_fact delete failed:", r.error.message); setMemory((prev: any[]) => prev.some(m => m.id === match.id) ? prev : [...prev, match]); return; }
            if (!Array.isArray(r?.data) || r.data.length === 0) { console.warn("[Alfred Memory] forget_fact matched 0 rows"); setMemory((prev: any[]) => prev.some(m => m.id === match.id) ? prev : [...prev, match]); }
          });
          toast("Alfred forgot: " + match.text.slice(0, 60));
          return { success: true, forgot: match.text };
        }
        case "recall_facts": {
          const q = (inputs.search || "").toLowerCase().trim();
          const filtered = q ? memory.filter((m: any) => m.text.toLowerCase().includes(q) || (m.category || "").toLowerCase().includes(q)) : memory;
          if (filtered.length === 0) return { success: true, memories: [], summary: q ? `Nothing saved matching "${inputs.search}".` : "Nothing saved yet." };
          return { success: true, count: filtered.length, memories: filtered.slice(0, 30).map((m: any) => ({ text: m.text, category: m.category })) };
        }
        // BUG FIX (user report) — "Alfred should remember what it did last.
        // If a day later — or even five minutes later — I say 'undo that'
        // or 'delete those,' it should know what I'm referring to." Was
        // in-memory only (lastActionsRef), so a reload/new tab/next day
        // lost the stack entirely. Now falls back to alfred_actions_log
        // (migration 0099) when the in-memory list is empty — a genuinely
        // durable "what did you do" that survives across sessions.
        case "undo_last_action": {
          const count = Math.max(1, Math.min(10, Number(inputs.count) || 1));
          let entries: Array<{ id: string; label: string; toolName: string; payload: any }> = lastActionsRef.current.slice(-count).reverse();
          let fromMemory = entries.length > 0;
          if (entries.length < count) {
            try {
              const { data } = await withTimeout<any>(
                (supabase as any).from("alfred_actions_log").select("*").eq("owner_id", ownerId).is("undone_at", null).order("created_at", { ascending: false }).limit(count - entries.length),
                8000, "Recent actions lookup"
              );
              const fetched = (data || []).map((row: any) => ({ id: row.id, label: row.label, toolName: row.undo_kind, payload: row.undo_payload || {} }));
              // Skip any row already represented in-memory (same id) to
              // avoid double-processing it.
              const memIds = new Set(entries.map(e => e.id));
              entries = [...entries, ...fetched.filter((e: any) => !memIds.has(e.id))];
            } catch { /* fall through with whatever we already have from memory */ }
          }
          if (entries.length === 0) return { error: "Nothing to undo — no reversible action found for this business, in this conversation or recent history." };
          // Remove from the in-memory stack before running — if an undo
          // throws, don't leave it sitting there for a confused second
          // attempt against whatever partial state the failure left.
          const entryIds = new Set(entries.map(e => e.id));
          lastActionsRef.current = lastActionsRef.current.filter(e => !entryIds.has(e.id));
          const results: Array<{ label: string; success: boolean; message: string }> = [];
          for (const entry of entries) {
            const handler = UNDO_HANDLERS[entry.toolName];
            const r = handler ? await handler.undo(entry.payload) : { success: false, message: `No undo handler for "${entry.toolName}" (may be from an old app version).` };
            results.push({ label: entry.label, success: r.success, message: r.message });
            // Mark it done in the durable log either way — a failed undo
            // (e.g. already deleted) shouldn't keep surfacing as "undoable"
            // on the next attempt.
            (supabase as any).from("alfred_actions_log").update({ undone_at: new Date().toISOString() }).eq("id", entry.id).then(() => {}).catch(() => {});
          }
          const succeeded = results.filter(r => r.success);
          const failed = results.filter(r => !r.success);
          if (succeeded.length) toast(succeeded.length === 1 ? succeeded[0].message : `Undid ${succeeded.length} action(s).`);
          if (succeeded.length === 0) return { error: "Couldn't undo: " + failed.map(f => f.message).join("; ") };
          return {
            success: true,
            undoneCount: succeeded.length,
            undone: succeeded.map(r => r.label),
            ...(failed.length ? { partialFailures: failed.map(f => `${f.label}: ${f.message}`) } : {}),
            note: fromMemory ? undefined : "This was recovered from action history (not the current conversation) — double-check with the owner that this is really what they meant if it's at all ambiguous.",
          };
        }
        // FEATURE (user report) — "if I message it a day later and say
        // 'what did you do,' it should know what I'm referring to." Reads
        // the same durable alfred_actions_log undo_last_action uses, so the
        // model can answer "what did you do" honestly instead of guessing
        // from conversation memory alone (which resets across sessions).
        case "list_recent_actions": {
          const limit = Math.max(1, Math.min(30, Number(inputs.limit) || 15));
          try {
            const { data, error } = await withTimeout<any>(
              (supabase as any).from("alfred_actions_log").select("label,created_at,undone_at").eq("owner_id", ownerId).order("created_at", { ascending: false }).limit(limit),
              8000, "Recent actions list"
            );
            // BUG FIX (user report) — "the response is confusing... Action-
            // history lookup failed: Could not find the table
            // 'public.alfred_actions_log' in the schema cache." The owner
            // hadn't run migration 0099 yet, and this raw Postgres/PostgREST
            // error got handed straight to the model as this tool's result
            // — which then quoted it verbatim in an otherwise unrelated
            // "schedule these jobs" reply. A missing table here means the
            // memory feature just isn't set up yet, not a real failure this
            // unrelated request needs to explain — degrade quietly instead
            // of surfacing raw database internals.
            if (error && /schema cache|does not exist|relation .* does not exist/i.test(error.message || "")) {
              return { success: true, actions: [], note: "Action history isn't set up on this database yet (a pending migration hasn't been run) — nothing to look back on. Don't mention this technical detail to the owner unless they specifically ask why undo/history isn't working." };
            }
            if (error) return { error: "Couldn't read action history — " + error.message };
            if (!data || data.length === 0) return { success: true, actions: [], note: "No reversible actions recorded yet." };
            return { success: true, actions: data.map((r: any) => ({ label: r.label, at: r.created_at, alreadyUndone: !!r.undone_at })) };
          } catch (e: any) {
            return { error: "Couldn't read action history — " + (e?.message || "unknown error") };
          }
        }
        case "set_vacation_mode": {
          if (inputs.active === false) {
            setSettings((prev: any) => ({ ...prev, vacationMode: { ...(prev?.vacationMode || {}), active: false } }));
            toast("Vacation mode turned off — welcome back!");
            return { success: true, active: false };
          }
          if (!inputs.startDate || !inputs.endDate) return { error: "startDate and endDate are required to turn vacation mode on — ask the owner for their exact dates before calling this." };
          if (!inputs.autonomyLevel) return { error: "autonomyLevel is required — ask the owner how they want Alfred to handle things while they're out (fully manage it, ask first before anything goes out, or just hold everything until they're back)." };
          if (!inputs.checkInFrequency) return { error: "checkInFrequency is required — ask the owner how often, if at all, they want a status update text while they're out." };
          const vac = {
            active: true,
            startDate: inputs.startDate,
            endDate: inputs.endDate,
            autonomyLevel: inputs.autonomyLevel,
            checkInFrequency: inputs.checkInFrequency,
            notes: inputs.notes || "",
            setAt: new Date().toISOString(),
          };
          setSettings((prev: any) => ({ ...prev, vacationMode: vac }));
          toast(`Vacation mode set: ${vac.startDate} → ${vac.endDate}`);
          return { success: true, ...vac };
        }
        case "get_vacation_status": {
          const vac = (settings as any)?.vacationMode;
          if (!vac?.active) return { success: true, active: false };
          const todayStr = today();
          const isCurrentlyOut = todayStr >= vac.startDate && todayStr <= vac.endDate;
          return { success: true, active: true, isCurrentlyOut, ...vac };
        }
        case "set_followup_reminder": {
          if (!inputs.message || !inputs.dueAtIso) return { error: "message and dueAtIso required" };
          if (!(settings as any)?.myPhone) return { error: "No mobile number on file — set it in Settings → Company first." };
          const dueAt = new Date(inputs.dueAtIso);
          if (isNaN(dueAt.getTime())) return { error: "Couldn't parse dueAtIso — must be a valid ISO datetime." };
          const row = { id: uid(), owner_id: ownerId, phone: (settings as any).myPhone, message: inputs.message, due_at: dueAt.toISOString(), sent: false, created_at: new Date().toISOString() };
          const { error: remErr } = await (supabase as any).from("alfred_reminders").insert(row);
          if (remErr) return { error: "Could not save the reminder — " + remErr.message };
          toast("Alfred will text you at " + dueAt.toLocaleString());
          return { success: true, reminderId: row.id, dueAt: row.due_at };
        }
        case "list_followup_reminders": {
          const { data: remRows, error: remListErr } = await (supabase as any).from("alfred_reminders").select("id,message,due_at").eq("owner_id", ownerId).eq("sent", false).order("due_at", { ascending: true });
          if (remListErr) return { error: remListErr.message };
          if (!remRows?.length) return { success: true, reminders: [], summary: "No pending follow-ups." };
          return { success: true, reminders: remRows.map((r: any) => ({ id: r.id, message: r.message, dueAt: r.due_at })) };
        }
        case "cancel_followup_reminder": {
          if (!inputs.reminderId) return { error: "reminderId required" };
          // SECURITY/SYNC FIX (audit finding) — no 0-row check: a "cancelled"
          // reminder that didn't actually match a row would still fire later.
          const { data: remCancelData, error: remCancelErr } = await (supabase as any).from("alfred_reminders").delete().eq("id", inputs.reminderId).eq("owner_id", ownerId).select("id");
          if (remCancelErr) return { error: remCancelErr.message };
          if (!Array.isArray(remCancelData) || remCancelData.length === 0) return { error: "That reminder couldn't be cancelled — it may not exist or already ran." };
          return { success: true, cancelled: inputs.reminderId };
        }
        case "get_business_stats": {
          return {
            revenue_mtd: stats.totalRev,
            active_jobs: stats.activeJobs,
            pending_quotes: stats.pendingEst,
            close_rate_pct: stats.closeRate,
            jobs_completed_this_month: stats.doneMonth,
            total_customers: customers.length,
            total_employees: employees.length
          };
        }
        // FEATURE — "Alfred should literally know virtually everything
        // about the company it's working for." Real service/pricing
        // catalog and core company facts.
        case "list_services": {
          if (!services || services.length === 0) return { success: true, count: 0, services: [], note: "No services set up yet (Settings → Services)." };
          return { success: true, count: services.length, services: services.map((s: any) => ({ name: s.name, price: s.basePrice ?? s.price, category: s.category, taxable: s.taxable !== false })) };
        }
        case "get_company_info": {
          return {
            success: true,
            companyName: (settings as any)?.companyName || null,
            address: (settings as any)?.companyAddress || null,
            phone: (settings as any)?.companyPhone || null,
            taxRate: (settings as any)?.taxRate != null ? `${(settings as any).taxRate}%` : null,
            state: (settings as any)?.companyState || null,
            totalCustomers: customers.length,
            activeEmployees: employees.filter((e: any) => e.status === "active").length,
            fleetSize: (vehicles || []).length,
          };
        }
        case "list_estimates": {
          const wantStatus = (inputs.status || "pending").toLowerCase();
          const matches = (e: any) => {
            if (wantStatus === "all") return true;
            if (wantStatus === "invoiced") return !!e.invoiced;
            if (wantStatus === "pending") return e.status === "pending" && !e.invoiced;
            if (wantStatus === "approved") return e.status === "approved" && !e.invoiced;
            if (wantStatus === "rejected") return e.status === "rejected";
            return true;
          };
          const rows = (estimates || []).filter(matches).sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          return {
            status: wantStatus,
            count: rows.length,
            estimates: rows.slice(0, 25).map((e: any) => {
              const c = customers.find((x: any) => x.id === e.customerId);
              return { id: e.id, customer: c ? `${c.firstName} ${c.lastName}`.trim() : "Unknown customer", total: e.total, status: e.status, invoiced: !!e.invoiced, paid: !!e.paidAt, createdAt: e.createdAt };
            }),
          };
        }
        case "text_supplier": {
          // FEATURE — scoped, sandboxed supplier outreach. Deliberately
          // text-only: this app has no vendor-payment infrastructure (no
          // stored vendor payment methods, no "pay a supplier" flow
          // anywhere), so there is nothing safe to automate beyond sending
          // a message a real person on the other end has to act on. The
          // tool description above already tells the model never to use
          // this for placing an order/authorizing payment, and to always
          // get explicit confirmation of the exact text first — this is the
          // last line of defense if that's skipped somehow.
          const item = (chemicals || []).find((c: any) => (c.name || "").toLowerCase().trim() === String(inputs.itemName || "").toLowerCase().trim())
            || (chemicals || []).find((c: any) => (c.name || "").toLowerCase().includes(String(inputs.itemName || "").toLowerCase().trim()));
          if (!item) return { error: `No inventory item found named "${inputs.itemName}". Check Inventory & Equipment for the exact name.` };
          const suppliers = (item.suppliers || []).filter((s: any) => s.phone);
          if (suppliers.length === 0) return { error: `"${item.name}" has no supplier phone number on file — add one in Inventory & Equipment first.` };
          const supplier = inputs.supplierName
            ? suppliers.find((s: any) => (s.name || "").toLowerCase().includes(String(inputs.supplierName).toLowerCase()))
            : suppliers[0];
          if (!supplier) return { error: `No supplier named "${inputs.supplierName}" on "${item.name}". Suppliers on file: ${suppliers.map((s: any) => s.name).join(", ")}` };
          if (!inputs.message?.trim()) return { error: "message is required — the exact text to send." };
          try {
            await withTimeout(twilioSend(settings as any, supplier.phone, inputs.message), 15000, "Supplier SMS");
          } catch (e: any) {
            return { error: "Failed to send — " + (e?.message || "unknown error") };
          }
          logOutboundSmsToInbox({ contactName: supplier.name || "Supplier", contactPhone: supplier.phone, body: inputs.message }).catch(() => {});
          toast("Alfred texted " + (supplier.name || "supplier") + " re: " + item.name);
          return { success: true, supplier: supplier.name, phone: supplier.phone, sent: inputs.message };
        }
        case "email_supplier": {
          // Same sandboxing reasoning as text_supplier — no vendor-payment
          // infrastructure exists anywhere in this app, so this can only
          // ever send a message a real person on the other end acts on.
          const item = (chemicals || []).find((c: any) => (c.name || "").toLowerCase().trim() === String(inputs.itemName || "").toLowerCase().trim())
            || (chemicals || []).find((c: any) => (c.name || "").toLowerCase().includes(String(inputs.itemName || "").toLowerCase().trim()));
          if (!item) return { error: `No inventory item found named "${inputs.itemName}". Check Inventory & Equipment for the exact name.` };
          const suppliers = ((item as any).suppliers || []).filter((s: any) => s.email);
          if (suppliers.length === 0) return { error: `"${item.name}" has no supplier email on file — add one in Inventory & Equipment first.` };
          const supplier = inputs.supplierName
            ? suppliers.find((s: any) => (s.name || "").toLowerCase().includes(String(inputs.supplierName).toLowerCase()))
            : suppliers[0];
          if (!supplier) return { error: `No supplier named "${inputs.supplierName}" on "${item.name}" with an email on file. Suppliers: ${suppliers.map((s: any) => s.name).join(", ")}` };
          if (!inputs.subject?.trim() || !inputs.message?.trim()) return { error: "subject and message are required — the exact email to send." };
          try {
            await withTimeout(sendEmail(settings as any, { to: supplier.email, subject: inputs.subject, body: emailShell(settings, inputs.subject, `<p>${String(inputs.message).replace(/\n/g, "<br/>")}</p>`) }), 15000, "Supplier email");
          } catch (e: any) {
            return { error: "Failed to send — " + (e?.message || "unknown error") };
          }
          toast("Alfred emailed " + (supplier.name || "supplier") + " re: " + item.name);
          return { success: true, supplier: supplier.name, email: supplier.email, sent: inputs.message };
        }
        // FEATURE — "add general suppliers — a mechanic, main shop — and
        // Alfred should be able to access that info." Distinct from
        // text_supplier/email_supplier above (which need a chemical/
        // equipment item name): looks up the standalone general_suppliers
        // table (migration 0068, ChemicalsPage.tsx's own new section) by
        // name instead. Fetched live rather than via a prop since this
        // table isn't part of the app's normal in-memory state.
        case "contact_general_supplier": {
          const res = await (supabase as any).from("general_suppliers").select("*").eq("owner_id", ownerId || "");
          const suppliers = Array.isArray(res?.data) ? res.data : [];
          if (!inputs.supplierName?.trim()) {
            return { success: true, suppliers: suppliers.map((s: any) => ({ name: s.name, category: s.category, phone: s.phone, email: s.email, address: s.address })) };
          }
          const q = String(inputs.supplierName || "").toLowerCase().trim();
          const supplier = suppliers.find((s: any) => (s.name || "").toLowerCase().trim() === q)
            || suppliers.find((s: any) => (s.name || "").toLowerCase().includes(q));
          if (!supplier) return { error: `No general supplier found matching "${inputs.supplierName}". On file: ${suppliers.map((s: any) => s.name).join(", ") || "none yet"}.` };
          if (!inputs.channel) {
            return { success: true, name: supplier.name, category: supplier.category, phone: supplier.phone, email: supplier.email, address: supplier.address, website: supplier.website, notes: supplier.notes };
          }
          if (inputs.channel === "text") {
            if (!supplier.phone) return { error: `${supplier.name} has no phone number on file.` };
            if (!inputs.message?.trim()) return { error: "message is required — the exact SMS text to send." };
            try { await withTimeout(twilioSend(settings as any, supplier.phone, inputs.message), 15000, "Supplier SMS"); }
            catch (e: any) { return { error: "Failed to send — " + (e?.message || "unknown error") }; }
            logOutboundSmsToInbox({ contactName: supplier.name || "Supplier", contactPhone: supplier.phone, body: inputs.message }).catch(() => {});
            toast("Alfred texted " + supplier.name);
            return { success: true, supplier: supplier.name, phone: supplier.phone, sent: inputs.message };
          }
          if (inputs.channel === "email") {
            if (!supplier.email) return { error: `${supplier.name} has no email on file.` };
            if (!inputs.subject?.trim() || !inputs.message?.trim()) return { error: "subject and message are required." };
            try { await withTimeout(sendEmail(settings as any, { to: supplier.email, subject: inputs.subject, body: emailShell(settings, inputs.subject, `<p>${String(inputs.message).replace(/\n/g, "<br/>")}</p>`) }), 15000, "Supplier email"); }
            catch (e: any) { return { error: "Failed to send — " + (e?.message || "unknown error") }; }
            toast("Alfred emailed " + supplier.name);
            return { success: true, supplier: supplier.name, email: supplier.email, sent: inputs.message };
          }
          return { error: "channel must be 'text' or 'email'" };
        }
        // FEATURE — "check stock, suggest reorder" (read-only — never places
        // an order on its own; ordering still only ever happens via
        // text_supplier/email_supplier, which require the owner to have
        // asked for that exact message to go out, same sandboxing as those).
        case "check_stock": {
          const q = String(inputs.itemName || "").toLowerCase().trim();
          const pool = q ? (chemicals || []).filter((c: any) => (c.name || "").toLowerCase().includes(q)) : (chemicals || []);
          if (pool.length === 0) return { error: q ? `No item found matching "${inputs.itemName}".` : "No inventory items on file yet." };
          const low = pool.filter((c: any) => Number(c.stock) <= Number(c.reorderLevel));
          return {
            success: true,
            items: pool.map((c: any) => ({ name: c.name, stock: c.stock, unit: c.unit, reorderLevel: c.reorderLevel, needsReorder: Number(c.stock) <= Number(c.reorderLevel), suppliers: (c.suppliers || []).map((s: any) => s.name) })),
            lowStockCount: low.length,
            note: low.length > 0 ? `${low.length} item(s) at or below reorder level: ${low.map((c: any) => c.name).join(", ")}. Ask before texting/emailing a supplier — never contact one without the owner's explicit go-ahead on the exact message.` : "Everything is above its reorder level.",
          };
        }
        // FEATURE — Alfred previously had zero tools for expenses,
        // status, SOPs, campaigns, or social — real gaps against "manage
        // everything from chat." Kept read + one basic write per domain,
        // querying Supabase directly (owner-scoped) rather than needing
        // every one of these arrays threaded through as new props.
        // Campaigns / birthday offer / income — stored in owner_records
        // (migration 0003), which the CRM syncs every few seconds, so these
        // show up on every device and text-Alfred sees them too.
        // The owner's own check-ins (Accountability page) — for check-ins,
        // briefings and when they ask, not to sprinkle into business work.
        case "get_accountability_summary": {
          const days = Math.max(1, Math.min(60, Number(inputs.days) || 7));
          const since = daysFromNow(-days + 1);
          const recent = (entries || []).filter((e: any) => (e.date || "") >= since).sort((a: any, b: any) => (a.date || "").localeCompare(b.date || ""));
          const avg = (k: string) => recent.length ? Math.round((recent.reduce((s2: number, e: any) => s2 + (Number(e[k]) || 0), 0) / recent.length) * 10) / 10 : null;
          let streak = 0; const dates = new Set((entries || []).map((e: any) => e.date));
          for (let i = 0; i < 365; i++) { if (dates.has(daysFromNow(-i))) streak++; else if (i > 0) break; }
          let personal: any[] = [];
          try { personal = JSON.parse(localStorage.getItem("crm.reminders") || "[]"); } catch {}
          return {
            success: true, days, checkInsLogged: recent.length, streakDays: streak, checkedInToday: dates.has(today()),
            averages: { sleepHours: avg("sleep"), waterOz: avg("water"), steps: avg("steps"), workoutMinutes: avg("gymMinutes"), mood: avg("mood") },
            workoutDays: recent.filter((e: any) => (Number(e.gymMinutes) || 0) > 0 || e.gym).length,
            notes: recent.filter((e: any) => e.notes).slice(-5).map((e: any) => `${e.date}: ${e.notes}`),
            winsThisPeriod: (wins || []).filter((w: any) => (w.date || "") >= since).map((w: any) => w.text),
            personalChecklistDue: personal.filter((r: any) => !r.lastDone || daysSince(r.lastDone) >= (r.frequency === "daily" ? 1 : 7)).map((r: any) => r.text),
          };
        }
        case "check_connections": {
          try {
            const r = await runAlfredHealthCheck();
            return { success: true, summary: r.summary, problems: r.checks.filter(c => !c.ok).map(c => `${c.area} — ${c.name}: ${c.detail}${c.fix ? " Fix: " + c.fix : ""}`), working: r.checks.filter(c => c.ok).map(c => `${c.name}: ${c.detail}`) };
          } catch (e: any) { return { error: e?.message || "Health check failed" }; }
        }
        case "create_campaign": {
          if (!ownerId) return { error: "Not signed in as the owner." };
          if (!inputs.name || !inputs.message) return { error: "name and message required" };
          const sendAt = inputs.sendAt ? new Date(inputs.sendAt) : null;
          if (sendAt && isNaN(sendAt.getTime())) return { error: "sendAt isn't a valid date/time." };
          const camp = { id: uid(), name: inputs.name, ch: inputs.channel === "email" ? "email" : "sms", subject: inputs.subject || "", body: inputs.message, status: sendAt ? "scheduled" : "draft", sendAt: sendAt ? sendAt.toISOString() : undefined, createdAt: new Date().toISOString(), segment: Array.isArray(inputs.tags) && inputs.tags.length ? { tags: inputs.tags } : undefined, createdBy: "alfred" };
          const r = await (supabase as any).from("owner_records").upsert({ owner_id: ownerId, kind: "campaigns", id: camp.id, data: camp, deleted_at: null }, { onConflict: "owner_id,kind,id" }).select("id");
          if (r?.error || !r?.data?.length) return { error: "Couldn't save the campaign — " + (r?.error?.message || "the server didn't save it") + ". If it says owner_records doesn't exist, run supabase/migrations/0003_owner_records_and_budget_entries.sql." };
          toast("Alfred created campaign: " + camp.name);
          return { success: true, campaignId: camp.id, status: camp.status, note: "It's in Campaigns (shows up within a few seconds)." };
        }
        case "set_birthday_offer": {
          if (!ownerId) return { error: "Not signed in as the owner." };
          const cur = await (supabase as any).from("owner_records").select("data").eq("owner_id", ownerId).eq("kind", "birthday_offer").eq("id", "default").maybeSingle();
          if (cur?.error) return { error: "Couldn't read the setting — " + cur.error.message + ". Run supabase/migrations/0003_owner_records_and_budget_entries.sql if owner_records doesn't exist." };
          const prev = cur?.data?.data || {};
          const cfg = { ...prev, id: "default", active: !!inputs.active, discountPercent: Number(inputs.discountPercent ?? prev.discountPercent ?? 10), validDays: Number(inputs.validDays ?? prev.validDays ?? 30), message: inputs.message ?? prev.message };
          const r = await (supabase as any).from("owner_records").upsert({ owner_id: ownerId, kind: "birthday_offer", id: "default", data: cfg, deleted_at: null }, { onConflict: "owner_id,kind,id" }).select("id");
          if (r?.error || !r?.data?.length) return { error: "Couldn't save — " + (r?.error?.message || "the server didn't save it") };
          const withBday = customers.filter((c: any) => c.birthday).length;
          return { success: true, ...cfg, customersWithBirthdayOnFile: withBday, note: "Runs every morning from the reminders scheduler." };
        }
        case "log_income": {
          if (!ownerId) return { error: "Not signed in as the owner." };
          const list: any[] = Array.isArray(inputs.entries) ? inputs.entries : [];
          if (!list.length) return { error: "entries required" };
          const rows = list.filter(e => Number(e.amount)).map(e => ({ id: uid(), owner_id: ownerId, kind: "income", category: e.category || "revenue", label: e.description || "Income", amount: Math.abs(Number(e.amount)), date: e.date || today() }));
          const r = await (supabase as any).from("manual_budget_entries").insert(rows).select("id");
          if (r?.error) return { error: "Couldn't save — " + r.error.message };
          toast(`Logged ${rows.length} income entr${rows.length === 1 ? "y" : "ies"}`);
          return { success: true, saved: r?.data?.length || 0, total: rows.reduce((s2, e) => s2 + e.amount, 0) };
        }
        case "log_expense": {
          if (!inputs.amount || !inputs.description) return { error: "amount and description are required." };
          const exp = { id: uid(), date: inputs.date || today(), description: inputs.description, amount: Number(inputs.amount), category: inputs.category || "Other", vendor: inputs.vendor || "", isBusiness: true };
          setExpenses((prev: any[]) => [...(prev || []), exp]);
          toast(`Logged expense: ${inputs.description} — ${fmt(exp.amount)}`);
          return { success: true, expense: exp };
        }
        case "list_expenses": {
          const days = Number(inputs.days) || 30;
          const cutoff = daysFromNow(-days);
          const recent = (expenses || []).filter((e: any) => (e.date || "") >= cutoff);
          return { success: true, count: recent.length, total: recent.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0), expenses: recent.map((e: any) => ({ date: e.date, description: e.description, amount: e.amount, category: e.category })) };
        }
        case "list_sops": {
          try {
            const { data } = await (supabase as any).from("sop_documents").select("id,title,frequency,kind").eq("owner_id", ownerId);
            return { success: true, count: (data || []).length, sops: (data || []).map((s: any) => ({ id: s.id, title: s.title, frequency: s.frequency, kind: s.kind })) };
          } catch (e: any) { return { error: e?.message || "Failed to load SOPs" }; }
        }
        case "create_sop": {
          if (!inputs.title?.trim() || !inputs.content?.trim()) return { error: "title and content are required." };
          try {
            const row = { id: uid(), owner_id: ownerId, title: inputs.title, kind: "markdown", content: inputs.content, frequency: inputs.frequency || "general", assignedEmployeeIds: [], checklist: [] };
            const res = await (supabase as any).from("sop_documents").insert(row);
            if (res?.error) return { error: res.error.message };
            toast(`SOP created: ${inputs.title}`);
            return { success: true, id: row.id, title: row.title };
          } catch (e: any) { return { error: e?.message || "Failed to create SOP" }; }
        }
        case "list_campaigns": {
          try {
            const { data } = await (supabase as any).from("campaigns").select("id,name,status,channel").eq("owner_id", ownerId);
            return { success: true, count: (data || []).length, campaigns: (data || []).map((c: any) => ({ id: c.id, name: c.name, status: c.status, channel: c.channel })) };
          } catch (e: any) { return { error: e?.message || "Failed to load campaigns" }; }
        }
        case "list_social_posts": {
          try {
            const { data } = await (supabase as any).from("social_posts").select("id,caption,status,scheduledAt").eq("owner_id", ownerId).order("scheduledAt", { ascending: false }).limit(20);
            return { success: true, count: (data || []).length, posts: (data || []).map((p: any) => ({ id: p.id, caption: (p.caption || "").slice(0, 80), status: p.status, scheduledAt: p.scheduledAt })) };
          } catch (e: any) { return { error: "Social posts aren't cloud-synced on this deployment yet, or the table doesn't exist — check the Social page directly." }; }
        }
        case "text_phone_number": {
          if ((directSendsRef.current += 1) > 3) return { error: "Refused: more than 3 separate texts in one go. Use notify_all_customers so the owner can approve the list first." };
          if (!inputs.phone?.trim()) return { error: "phone required" };
          if (!inputs.message?.trim()) return { error: "message required" };
          if (!settings?.twilioSid) return { error: "Twilio isn't configured — add credentials in Settings → API Keys to send real SMS." };
          try {
            await twilioSend(settings, inputs.phone, inputs.message);
          } catch (e: any) { return { error: "SMS failed: " + (e?.message || String(e)) }; }
          // BUG FIX — "it sent the text and added the customer, but didn't
          // combine the information." This never passed customerId, so
          // find_or_create_inbox_thread (migration 0090/0091) still groups
          // the thread correctly by phone number, but inbox_threads.
          // customer_id stayed null forever — the text never linked to the
          // customer's own record/profile, which is exactly what "combine
          // the information" was describing: the SMS and the new customer
          // existed as two disconnected things instead of one.
          logOutboundSmsToInbox({ contactName: inputs.label || inputs.phone, contactPhone: inputs.phone, customerId: inputs.customerId || null, body: inputs.message }).catch(() => {});
          toast("Alfred texted " + (inputs.label || inputs.phone) + " ✓");
          return { success: true, sentTo: inputs.label || inputs.phone, phone: inputs.phone, message: inputs.message };
        }
        // FEATURE — "have it check with me which customers to send to … it
        // should only send after I give the okay." Drafts the list; nothing
        // is sent until send_bulk_text in a later message.
        case "prepare_import": {
          const batch = inputs.batchId ? importBatchesRef.current.get(String(inputs.batchId)) : null;
          if (inputs.batchId && !batch) return { error: "That import batch isn't here anymore (they last until the page is reloaded) — ask the owner to attach or paste the list again." };
          const text = batch?.kind === "text" ? batch.text || "" : String(inputs.text || "");
          if (!batch && !text.trim()) return { error: "Give a batchId or the text to import." };
          const category = inputs.serviceCategory === "trash_can" ? "trash_can" : "general";
          let records: any[] = [];
          let how = "";
          let columns: Record<string, string> | undefined;
          let failedPieces = 0;
          const table = batch?.kind === "table" ? { headers: batch.headers || [], data: batch.data || [] } : readAsTable(text);
          if (table) {
            records = recordsFromTable(table.headers, table.data, inputs.columnOverrides || {});
            how = `read as a table (${table.data.length} rows) without AI`;
            columns = describeColumns(table.headers, inputs.columnOverrides || {});
          } else {
            const priority: string[] = (settings as any).modelPriority || Object.keys(MODELS);
            const all = Array.from(new Set([...priority, ...Object.keys(MODELS)]));
            const chain = all.filter(mid => { const m: any = (MODELS as any)[mid]; if (!m) return false; if (m.needsKey && !(settings.modelKeys || {})[mid]) return false; const st: any = (modelStatus as any)[mid]; return !(st?.lockedUntil > Date.now()); });
            toast(`Reading the list in pieces…`);
            const out = await extractRecordsWithAI(text, chain, { onProgress: (d, t) => { if (t > 1) toast(`Reading the list: ${d}/${t} pieces`); } });
            records = out.records; failedPieces = out.failedPieces;
            how = `read with AI in ${out.pieces} piece(s)` + (failedPieces ? ` — ${failedPieces} piece(s) couldn't be read` : "");
          }
          if (!records.length) return { error: "Couldn't find any customers in that list.", how };
          const plan = buildImportPlan(records, { customers, employees, serviceCategory: category, createJobs: inputs.createJobs !== false, costPerCan: Number((settings as any)?.trashCanCostPerCan) || 5 });
          importPlansRef.current.set(plan.id, plan);
          return {
            success: true, ...planSummary(plan), how, columns,
            ...(failedPieces ? { warningPieces: `${failedPieces} piece(s) of the text couldn't be read — those customers are missing; tell the owner.` } : {}),
            next: "NOTHING is saved yet. Show the owner these numbers, the warnings and the sample, and ask them to confirm. Call run_import with this planId only after they say yes.",
          };
        }
        case "run_import": {
          // Earlier tool results aren't in the chat history the model sees on
          // the next message, so it often doesn't have the planId when the
          // owner says "yes" — then the latest prepared plan is the one.
          const plans = Array.from(importPlansRef.current.values()).sort((a, b) => b.createdAt - a.createdAt);
          const plan = importPlansRef.current.get(String(inputs.planId || "")) || plans[0];
          if (!plan) return { error: "There's no prepared import (plans last until the page is reloaded) — run prepare_import again." };
          if (plan.createdAt >= turnStartRef.current) return { error: "Refused: the owner hasn't seen this summary yet. Show it and wait for their yes." };
          if (!ownerId) return { error: "Not signed in as the owner." };
          importPlansRef.current.delete(plan.id);
          const r = await runImportPlan(plan, { ownerId, onProgress: (label, d, t) => { if (t > 100) toast(`Saving ${label}: ${d}/${t}`); } });
          const savedCustomers = [...plan.customers.added, ...plan.customers.updated];
          if (r.customersSaved) setCustomers?.((prev: any[]) => {
            const byId = new Map(savedCustomers.map((c: any) => [c.id, c]));
            const kept = prev.map((c: any) => byId.get(c.id) || c);
            const have = new Set(prev.map((c: any) => c.id));
            return [...kept, ...plan.customers.added.filter((c: any) => !have.has(c.id))];
          });
          if (r.jobsSaved) {
            const newJobIds = new Set(plan.jobs.map(j => j.id));
            setJobs?.((prev: any[]) => [...prev.filter((j: any) => !newJobIds.has(j.id)), ...plan.jobs.map(j => ({ ...j, owner_id: ownerId }))]);
          }
          toast(`Imported ${r.customersSaved} customer${r.customersSaved !== 1 ? "s" : ""} and ${r.jobsSaved} job${r.jobsSaved !== 1 ? "s" : ""}` + (r.customersFailed || r.jobsFailed ? ` (${r.customersFailed + r.jobsFailed} failed)` : ""), r.customersFailed || r.jobsFailed ? "yellow" : "green");
          return { success: r.customersFailed === 0 && r.jobsFailed === 0, ...r };
        }
        case "read_google_sheet": {
          if (!GOOGLE_SHEET_URL.test(String(inputs.url || ""))) return { error: "That isn't a Google Sheets link." };
          const note = await stashGoogleSheet(String(inputs.url));
          return /couldn't be opened/.test(note) ? { error: note.replace(/^\[|\]$/g, "") } : { success: true, note };
        }
        case "read_pasted_text": {
          const batch = importBatchesRef.current.get(String(inputs.batchId || ""));
          if (!batch) return { error: "That paste isn't here anymore — ask the owner to paste it again." };
          const full = batch.kind === "text" ? batch.text || "" : [batch.headers || [], ...(batch.data || [])].map(r => r.join("\t")).join("\n");
          const pages = Math.max(1, Math.ceil(full.length / 8000));
          const page = Math.min(pages, Math.max(1, Number(inputs.page) || 1));
          return { page, pages, text: full.slice((page - 1) * 8000, page * 8000) };
        }
        case "notify_all_customers": {
          if (!inputs.message?.trim()) return { error: "message required" };
          let eligible = customers.filter((c: any) => c.phone && !c.smsOptOut && !((settings as any)?.testModeEnabled && c.isTestClient));
          if (inputs.tag) { const t = String(inputs.tag).toLowerCase(); eligible = eligible.filter((c: any) => Array.isArray(c.tags) && c.tags.some((x: string) => String(x).toLowerCase() === t)); }
          if (Array.isArray(inputs.customerNames) && inputs.customerNames.length) {
            const names = inputs.customerNames.map((n: string) => String(n).toLowerCase().trim());
            eligible = eligible.filter((c: any) => names.some((n: string) => `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase().includes(n)));
          }
          if (inputs.onlyMissing) eligible = eligible.filter((c: any) => !String(c[inputs.onlyMissing] || "").trim());
          if (eligible.length === 0) return { error: "No eligible customers matched (check they have a phone on file, haven't opted out, and fit the filter)." };
          const recipients = eligible.map((c: any, i: number) => ({ n: i + 1, customerId: c.id, name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.phone, firstName: c.firstName || "", phone: c.phone }));
          const draftId = uid();
          bulkDraftsRef.current.set(draftId, { id: draftId, message: inputs.message, recipients, createdAt: Date.now(), watchReplies: inputs.watchReplies, campaignName: inputs.campaignName });
          return {
            success: true, draftId, notSentYet: true, recipientCount: recipients.length,
            list: recipients.slice(0, 60).map((r: any) => `${r.n}. ${r.name}`), more: Math.max(0, recipients.length - 60),
            sample: String(inputs.message).replace(/\{\{first_name\}\}/g, recipients[0].firstName || "there"),
            next: "Nothing has been sent. Show the owner this numbered list and the sample, ask which to send to ('all', 'not 3 and 7', 'only 1, 2, 5'), and stop. Call send_bulk_text only after they answer.",
          };
        }
        case "send_bulk_text": {
          const draft = bulkDraftsRef.current.get(String(inputs.draftId || ""));
          if (!draft) return { error: "That draft wasn't found (drafts last until the page is reloaded) — draft it again with notify_all_customers." };
          if (draft.createdAt >= turnStartRef.current) return { error: "Refused: the owner hasn't seen this list yet. Show them the numbered list and wait for their reply before sending." };
          if (!settings?.twilioSid) return { error: "Twilio isn't configured — add credentials in Settings → API Keys to send real SMS." };
          const only = new Set<number>((Array.isArray(inputs.only) ? inputs.only : []).map(Number));
          const exclude = new Set<number>((Array.isArray(inputs.exclude) ? inputs.exclude : []).map(Number));
          const chosen = draft.recipients.filter((r: any) => only.size ? only.has(r.n) : !exclude.has(r.n));
          if (!chosen.length) return { error: "With those choices nobody is left to send to." };
          bulkDraftsRef.current.delete(draft.id);
          let watchId: string | null = null;
          if (draft.watchReplies?.question && ownerId) {
            watchId = uid();
            const days = Math.max(1, Math.min(120, Number(draft.watchReplies.days) || 30));
            const watch = { id: watchId, question: draft.watchReplies.question, saveField: draft.watchReplies.saveField || undefined, thankYouMessage: draft.watchReplies.thankYouMessage || undefined, customers: Object.fromEntries(chosen.map((r: any) => [r.customerId, { name: r.name, status: "waiting" }])), createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + days * 86400000).toISOString() };
            const w = await (supabase as any).from("owner_records").upsert({ owner_id: ownerId, kind: "reply_watch", id: watchId, data: watch, deleted_at: null }, { onConflict: "owner_id,kind,id" }).select("id");
            if (w?.error || !w?.data?.length) { console.warn("[Alfred] reply watch not saved:", w?.error?.message); watchId = null; }
          }
          let sent = 0, failed = 0;
          for (const r of chosen) {
            const personalized = String(draft.message).replace(/\{\{first_name\}\}/g, r.firstName || "there");
            try {
              await twilioSend(settings, r.phone, personalized);
              logOutboundSmsToInbox({ contactName: r.name, contactPhone: r.phone, customerId: r.customerId, body: personalized }).catch(() => {});
              sent++;
            } catch { failed++; }
            await new Promise(res => setTimeout(res, 100));
          }
          if (ownerId) {
            const campId = uid();
            (supabase as any).from("owner_records").upsert({ owner_id: ownerId, kind: "campaigns", id: campId, data: { id: campId, name: draft.campaignName || String(draft.message).slice(0, 40), ch: "sms", body: draft.message, status: "sent", createdAt: new Date(draft.createdAt).toISOString(), sentAt: new Date().toISOString(), recipientCount: chosen.length, sentCount: sent, failedCount: failed, deliveryRate: chosen.length ? Math.round((sent / chosen.length) * 100) : 0, matches: chosen.map((r: any) => r.customerId), createdBy: "alfred" }, deleted_at: null }, { onConflict: "owner_id,kind,id" }).then(() => {}, () => {});
          }
          toast(`Alfred texted ${sent} customer${sent !== 1 ? "s" : ""}` + (failed ? ` (${failed} failed)` : "") + " ✓");
          return { success: true, sent, failed, skipped: draft.recipients.length - chosen.length, watchingReplies: !!watchId };
        }
        case "switch_ai_model": {
          const wanted = String(inputs.provider || "").toLowerCase().trim();
          const entry = Object.values(MODELS).find((m: any) =>
            m.id === wanted || m.name.toLowerCase() === wanted || m.name.toLowerCase().includes(wanted) || wanted.includes(m.name.toLowerCase())
          ) as any;
          if (!entry) return { error: `Don't recognize "${inputs.provider}" — available providers: ${Object.values(MODELS).map((m: any) => m.name).join(", ")}.` };
          if (entry.needsKey && !(settings.modelKeys || {})[entry.id]) return { error: `${entry.name} isn't set up yet — no API key saved for it. Add one in Settings → AI Models first.` };
          const currentPriority: string[] = Array.isArray((settings as any).modelPriority) ? (settings as any).modelPriority : Object.keys(MODELS);
          const nextPriority = [entry.id, ...currentPriority.filter((k: string) => k !== entry.id)];
          setSettings((prev: any) => ({ ...prev, activeModel: entry.id, modelPriority: nextPriority }));
          toast("🔀 Switched to " + entry.name);
          return { success: true, switchedTo: entry.name };
        }
        case "navigate_to": {
          if (!inputs.page) return { error: "page required" };
          onNav(inputs.page);
          return { success: true, navigatedTo: inputs.page };
        }
        case "create_automation": {
          if (!inputs.name || !inputs.steps || inputs.steps.length === 0) return { error: "name and steps required" };
          const steps = inputs.steps.map(s => ({ ...s, id: s.id || uid() }));
          const firstTrigger = steps.find(s => s.type === "trigger");
          const firstAction = steps.find(s => s.type === "action");
          const newAuto = {
            id: uid(),
            name: inputs.name,
            description: inputs.description || "",
            icon: inputs.icon || "⚡",
            category: inputs.category || "other",
            trigger: firstTrigger?.label || "Manual",
            action: firstAction?.label || "Multi-step",
            steps,
            isWorkflow: true,
            active: true,
            count: 0,
            lastTriggered: null,
            runLog: [],
            createdByAlfred: true
          };
          setAutomations(prev => [...prev, newAuto]);
          onNav("automations");
          toast("Alfred created workflow: " + newAuto.name);
          return { success: true, automationId: newAuto.id, name: newAuto.name, stepCount: steps.length };
        }
        case "enable_review_request_automation": {
          const existing = automations.find((a: any) => a.id === "tpl_review_request");
          if (existing?.active) return { success: true, note: "Already on." };
          if (existing) {
            setAutomations(prev => prev.map((a: any) => a.id === "tpl_review_request" ? { ...a, active: true } : a));
          } else {
            const tpl = (AUTOMATION_TEMPLATES as any[]).find(t => t.id === "tpl_review_request");
            if (!tpl) return { error: "Template not found." };
            setAutomations(prev => [...prev, automationFromTemplate(tpl)]);
          }
          toast("📮 Turned on automatic review requests after job completion ✓");
          return { success: true };
        }
        case "list_automations": {
          return {
            count: automations.length,
            active: automations.filter(a => a.active).length,
            automations: automations.map(a => ({ id: a.id, name: a.name, active: a.active, trigger: a.trigger, count: a.count || 0, lastTriggered: a.lastTriggered, steps: (a.steps || []).length }))
          };
        }
        case "toggle_automation": {
          if (!inputs.automationId) return { error: "automationId required" };
          const a = automations.find(x => x.id === inputs.automationId);
          if (!a) return { error: "Automation not found" };
          setAutomations(prev => prev.map(x => x.id === inputs.automationId ? { ...x, active: inputs.active } : x));
          toast((inputs.active ? "Enabled" : "Disabled") + ": " + a.name);
          return { success: true, automationId: inputs.automationId, active: inputs.active };
        }
        case "send_email_via_gmail": {
          if (!inputs.to || !inputs.subject || !inputs.body) return { error: "to, subject, body required" };
          // BUG FIX — this used to (a) gate on settings.googleConnected, a
          // React-state flag that can lag behind the actual connection state
          // GoogleWorkspacePage/Settings show (getStoredGoogleConnection(),
          // written synchronously to localStorage the moment OAuth
          // completes), which is exactly why Alfred could say "not
          // connected" while Settings showed Connected; and (b) require a
          // `settings.googleBackendUrl` that this app has never had — there
          // is no separate backend server (see docs/ARCHITECTURE.md), so this tool
          // could never actually send for anyone, always falling into the
          // "staged" no-op branch. Route through the same sendEmail() helper
          // every other real send in this app uses (direct-from-browser
          // Gmail API call, no backend needed) and let its own connection
          // check be the single source of truth.
          try {
            await sendEmail(settings as any, { to: inputs.to, subject: inputs.subject, body: inputs.body, cc: inputs.cc });
            toast("Email sent to " + inputs.to + " ✓");
            return { success: true, sent: true, via: "gmail", to: inputs.to, subject: inputs.subject };
          } catch (e: any) {
            return { error: e?.message || "Gmail send failed" };
          }
        }
        case "create_calendar_event": {
          if (!inputs.title || !inputs.date) return { error: "title and date required" };
          // BUG FIX — this required settings.googleBackendUrl, a field this
          // app has never had (no separate backend server — see docs/ARCHITECTURE.md),
          // so it always fell into the "queued" no-op branch and never
          // created a real event, identical to the Gmail-send bug fixed
          // earlier. Route through the same direct-fetch Calendar API
          // (googleApi.ts) every other real Calendar call in this app uses.
          const token = await getFreshOwnerGoogleToken(settings as any);
          if (!token) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
          const startDt = inputs.date + "T" + (inputs.time || "09:00") + ":00";
          const endMin = (inputs.duration_minutes || 60);
          const endIso = new Date(new Date(startDt).getTime() + endMin * 60000).toISOString();
          try {
            const eventId = await createGCalEvent(token, {
              title: inputs.title,
              start: new Date(startDt).toISOString(),
              end: endIso,
              description: inputs.notes || "",
              location: inputs.location || "",
            });
            toast("📅 Event created in Google Calendar: " + inputs.title);
            return { success: true, eventId, title: inputs.title, start: startDt, end: endIso };
          } catch (e: any) {
            return { error: "Calendar event failed: " + (e?.message || "unknown error") };
          }
        }
        case "update_calendar_event": {
          const token = await getFreshOwnerGoogleToken(settings as any);
          if (!token) return { error: "Google Calendar isn't connected — connect it in Settings → Integrations first." };
          let eventId = inputs.eventId;
          if (!eventId && inputs.title) {
            const events = await fetchCalendarEvents(token);
            const q = String(inputs.title).toLowerCase();
            const match = events.find(ev => (ev.title || "").toLowerCase().includes(q));
            if (!match) return { error: `No Google Calendar event found matching "${inputs.title}" — call get_calendar_summary first to see what's actually there.` };
            eventId = match.id;
          }
          if (!eventId) return { error: "Need either eventId or a title to find it by." };
          const patch: any = {};
          if (inputs.title) patch.title = inputs.title;
          if (inputs.location !== undefined) patch.location = inputs.location;
          if (inputs.notes !== undefined) patch.description = inputs.notes;
          if (inputs.date) {
            const startDt = inputs.date + "T" + (inputs.time || "09:00") + ":00";
            patch.start = new Date(startDt).toISOString();
            patch.end = new Date(new Date(startDt).getTime() + (inputs.duration_minutes || 60) * 60000).toISOString();
          }
          try {
            await updateGCalEvent(token, eventId, patch);
            toast("📅 Google Calendar event updated");
            return { success: true, eventId };
          } catch (e: any) {
            return { error: "Calendar event failed: " + (e?.message || "unknown error") };
          }
        }
        case "upload_to_drive": {
          if (!settings.googleConnected || !(settings.googleScopes || {}).drive) return { error: "Drive not connected. Ask user to go to Settings → Integrations → Google and enable Drive." };
          if (!inputs.filename) return { error: "filename required" };
          const url = settings.googleBackendUrl;
          // AUDIT G — was settings.googleToken (never populated); see the
          // create_calendar_event case above for why.
          const token = settings.googleProviderToken;
          if (url && token) {
            try {
              const uploadToDrive = async (u: string, t: string, opts: any) => { const r = await fetch(u + "/drive/upload", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(opts) }); return r.json(); };
              const result = await uploadToDrive(url, token, { filename: inputs.filename, content: inputs.content || "", mimeType: inputs.mimeType || "text/plain", folderId: inputs.folder });
              toast("Uploaded to Drive: " + inputs.filename + " ✓");
              return { success: true, fileId: result.id || uid(), filename: inputs.filename, webViewLink: result.webViewLink };
            } catch (e) {
              return { error: "Drive upload failed: " + e.message };
            }
          } else {
            toast("File queued: " + inputs.filename + " (add backend URL in Settings to upload to Drive)");
            return { success: true, queued: true, filename: inputs.filename, note: "Backend URL not configured." };
          }
        }
        case "create_google_task": {
          if (!settings.googleConnected || !(settings.googleScopes || {}).tasks) return { error: "Google Tasks not connected. Enable Tasks scope in Settings → Integrations → Google." };
          if (!inputs.title) return { error: "title required" };
          const url = settings.googleBackendUrl;
          // AUDIT G — was settings.googleToken (never populated); see the
          // create_calendar_event case above for why.
          const token = settings.googleProviderToken;
          if (url && token) {
            try {
              const createTask = async (u: string, t: string, opts: any) => { const r = await fetch(u + "/tasks", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` }, body: JSON.stringify(opts) }); return r.json(); };
              const result = await createTask(url, token, { title: inputs.title, notes: inputs.notes, due: inputs.due });
              toast("Task created in Google Tasks: " + inputs.title);
              return { success: true, taskId: result.id, title: inputs.title };
            } catch (e) {
              return { error: "Task creation failed: " + e.message };
            }
          } else {
            toast("Task queued: " + inputs.title + " (add backend URL to sync to Google Tasks)");
            return { success: true, queued: true, title: inputs.title };
          }
        }
        default:
          return { error: "Unknown tool: " + name };
      }
    } catch (err) {
      return { error: err.message || String(err) };
    }
  };

  const toolDefinitions = [
    {
      name: "search_customers",
      description: "Search the WHOLE customer list for a person — handles partial/misspelled names, nicknames, sound-alikes, part of a phone number or email, street, city, company, tags, notes ('a Jon on Oak St', 'someone with a 0199 number'). Use it to find a customer, or answer 'do I have anyone like this'.",
      input_schema: { type: "object", properties: { query: { type: "string", description: "Anything you know about them" } }, required: ["query"] }
    },
    {
      name: "find_duplicate_customers",
      description: "Scan the ENTIRE customer list for duplicates — same phone, same email, same name, nicknames (Bill/William), similar spellings (Smith/Smyth, Katherine/Catherine), same address. No names needed. Use for 'check my client base for duplicates'.",
      input_schema: { type: "object", properties: { includePossible: { type: "boolean", description: "Also list weaker matches (similar spelling / same address). Default true." } } }
    },
    {
      name: "customers_missing_info",
      description: "Scan the ENTIRE customer list for missing details — which customers have no phone, email, address, last name, birthday or lead source. Use for 'who am I missing info for'.",
      input_schema: { type: "object", properties: { fields: { type: "array", items: { type: "string", enum: ["phone", "email", "address", "lastName", "birthday", "leadSource"] }, description: "Default phone, email, address" } } }
    },
    {
      name: "filter_customers",
      description: "Find every customer matching a description across the whole CRM — 'customers in Hanover', 'VIPs who spent over $1,000', 'people I haven't serviced in a year', 'leads from Facebook', 'birthdays this month', 'anyone with pool in their notes'. Returns the count and the list.",
      input_schema: { type: "object", properties: {
        city: { type: "string" }, tag: { type: "string" }, leadSource: { type: "string" }, minSpent: { type: "number" }, maxSpent: { type: "number" },
        noServiceInDays: { type: "number" }, servicedWithinDays: { type: "number" }, hasJobs: { type: "boolean" }, isLead: { type: "boolean" },
        createdAfter: { type: "string" }, createdBefore: { type: "string" }, textContains: { type: "string" }, hasBirthdayThisMonth: { type: "boolean" }, optedOutOfTexts: { type: "boolean" },
      } }
    },
    {
      name: "get_customer_documents",
      description: "List the files/documents on file for a customer (insurance, contracts, waivers, HOA forms, etc.) — use whenever the owner asks 'do we have the file for X' or wants to know what's on file.",
      input_schema: { type: "object", properties: { name: { type: "string" }, customerId: { type: "string" } } }
    },
    {
      name: "text_me_document",
      description: "Send a document already on file for a customer to the OWNER's own phone as a real MMS attachment. Use get_customer_documents first if the exact file name isn't already known.",
      input_schema: { type: "object", properties: { name: { type: "string" }, customerId: { type: "string" }, documentName: { type: "string" } }, required: ["documentName"] }
    },
    {
      name: "send_me_files",
      description: "Send yourself (the owner) files on file for a customer — Document Vault items AND job photos/videos, optionally scoped to one job — as a text or an email. Use for 'do you remember this client, send me the PDFs for this job', 'email me anything we have in the vault for them', 'text me their before/after photos'.",
      input_schema: { type: "object", properties: { name: { type: "string" }, customerId: { type: "string" }, jobId: { type: "string", description: "Optional — scope job photos/videos to one specific job" }, fileQuery: { type: "string", description: "Optional partial name match against Vault documents" }, via: { type: "string", enum: ["text", "email"], description: "Defaults to text" } }, required: ["name"] }
    },
    {
      name: "get_customer_card_info",
      description: "Check whether a customer has a payment card on file. Only ever returns brand + last 4 digits — the full card number is never stored anywhere in this app and can never be retrieved by anyone, including you.",
      input_schema: { type: "object", properties: { name: { type: "string" }, customerId: { type: "string" } } }
    },
    {
      name: "attach_file_to_customer",
      description: "Save the most recently uploaded photo/PDF (via the paperclip button) into a customer's Document Vault — use whenever the owner says to upload/save/attach a file they just sent to a client. Do not call this if no file was uploaded in this conversation yet.",
      input_schema: { type: "object", properties: { name: { type: "string" }, customerId: { type: "string" }, category: { type: "string", enum: ["Insurance", "Contract", "Waiver", "HOA", "Photo", "Document"] } } }
    },
    {
      name: "list_capabilities",
      description: "Returns a real, current list of everything you can do — use whenever the owner asks 'what can you do', 'what are your capabilities', or similar. Always call this instead of describing your abilities from memory.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "confirm_screen_reference",
      description: "Call this BEFORE acting on anything the owner refers to ambiguously by pointing/looking rather than naming — \"this\", \"that\", \"these\", \"the one I'm on\". Highlights whatever is CURRENTLY under their mouse cursor in glowing red on their actual screen and tells you what it resolved to (a real id, not a guess). Ask them \"You mean this — <what it is>?\" and WAIT for an explicit yes before taking any action. If they say no, or point somewhere else and say \"this\" again, call this tool again — it always re-samples their live cursor position, so it naturally resolves to whatever they're pointing at now. Once they confirm yes, you have FULL access to every normal tool against that confirmed id — schedule, message, edit, cancel, reassign, delete, anything the owner would ask for by name, not just answering questions about it.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "get_customer_details",
      description: "Get full details for one customer including their job history, spending, and estimates.",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, name: { type: "string", description: "Full name like 'Mike Harrison' as alternative to id" } } }
    },
    {
      name: "list_jobs",
      description: "List jobs, optionally filtered by status (scheduled, in_progress, completed, cancelled, or 'all').",
      input_schema: { type: "object", properties: { status: { type: "string", enum: ["all", "scheduled", "in_progress", "completed", "cancelled"] } } }
    },
    {
      name: "list_overdue_invoices",
      description: "List invoices that are more than 14 days past due.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "create_goal",
      description: "Create a goal for the owner. Use type: \"revenue\" with targetAmount for a monthly revenue/dollar target (shown on Dashboard progress) — otherwise it's logged as a plain checklist-style goal in Accountability. If the owner just says \"create goals for me\" with no specifics, ask what they want to hit before inventing numbers, unless they've stated clear targets already in this conversation.",
      input_schema: { type: "object", properties: { text: { type: "string", description: "The goal itself, in plain words" }, type: { type: "string", enum: ["checklist", "revenue"] }, targetAmount: { type: "number", description: "Required when type is revenue" } }, required: ["text"] }
    },
    {
      name: "create_customer",
      description: "Add a new customer to the CRM. Use ONLY the exact name/phone/email the user actually gave you in this conversation — never substitute, invent, or default to a different name or contact info for any reason. This tool does NOT text anyone by itself. If the user's request also asked to schedule a job and/or text this customer (e.g. 'this is a new customer, schedule a job for them, and text them'), do the customer first, then schedule_job, THEN a single text_phone_number call with customerId set to this customer's returned id and ONE message covering everything relevant (welcome + appointment date/time if a job was scheduled) — never send a separate generic 'you're added' text and then a separate job text for the same request.",
      input_schema: { type: "object", properties: { firstName: { type: "string" }, lastName: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, address: { type: "string" }, notes: { type: "string" } }, required: ["firstName", "lastName"] }
    },
    {
      name: "create_estimate",
      description: "Create a new estimate for a customer. Provide line items with description, quantity, unitPrice. Tax is added automatically.",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, customerName: { type: "string" }, lineItems: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unitPrice: { type: "number" } }, required: ["description", "unitPrice"] } }, notes: { type: "string" }, depositPercent: { type: "number", description: "Require a deposit of this % of the total (e.g. 50). Use this OR depositAmount." }, depositAmount: { type: "number", description: "Require a flat dollar deposit. Use this OR depositPercent." }, depositMandatory: { type: "boolean", description: "REQUIRED whenever a deposit is set. true = the customer can only pay the deposit now; false = they choose between the deposit now or paying in full. If the user didn't say, ask them first." } }, required: ["lineItems"] }
    },
    {
      name: "send_estimate",
      description: "Send an existing estimate/quote to its customer via email and/or SMS with a link to view and sign it. Use right after create_estimate if the user asked to 'send' or 'quote' the customer, or when asked to send an already-existing pending estimate.",
      input_schema: { type: "object", properties: { estimateId: { type: "string", description: "Optional — if omitted, sends the customer's most recent pending estimate" }, customerId: { type: "string" }, customerName: { type: "string" }, channel: { type: "string", enum: ["email", "sms", "both"] } } }
    },
    {
      name: "schedule_job",
      description: "Schedule a new job for a customer on a specific date (YYYY-MM-DD) and time (HH:MM 24h). Optionally assign one crew member in the same call via employeeName — this writes the same crew/crewAssignedAt fields assign_employee does, so a separate assign_employee call afterward is unnecessary (and would just no-op with 'Already assigned'). Can also set up a real custom checklist, separate crew-facing vs. internal-only notes, tags, and a recurring schedule — everything the manual New Job form can do. This tool does NOT text the customer itself — if the user also wants them texted (e.g. after also just creating them as a new customer in this same request), call text_phone_number ONCE afterward, with customerId set, and one message combining everything (new-customer welcome + this appointment's date/time) rather than sending it separately from a customer-creation text. Also handles commercial WORK ORDERS (e.g. a Home Depot/Lowe's work order the owner pastes/forwards as an email or text): set isWorkOrder true and extract workOrderNumber/workOrderClient/photoRequirements directly from that text — never invent a work order number or photo counts that weren't actually in what the owner gave you; leave them blank/omitted if genuinely not stated and ask instead of guessing.",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, customerName: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h, e.g. '14:00' for 2pm" }, amount: { type: "number" }, address: { type: "string", description: "Defaults to the customer's address on file if omitted" }, duration: { type: "number", description: "Estimated hours" }, jobType: { type: "string", enum: ["residential", "commercial"], description: "Drives crew pay-rate overrides; defaults to residential" }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] }, notes: { type: "string", description: "General job notes/instructions, visible to the crew in the field portal" }, internalNotes: { type: "string", description: "Internal/office-only notes — NOT shown to the crew (site warnings, billing quirks, etc.)" }, checklist: { type: "array", items: { type: "string" }, description: "Custom checklist/instructions specific to this job — becomes real checkable items the crew sees during the job" }, tags: { type: "array", items: { type: "string" }, description: "Free-form tags, e.g. 'VIP', 'gated community'" }, isRecurring: { type: "boolean", description: "true to also set up a recurring schedule from this date forward" }, recurringFreq: { type: "string", enum: ["weekly", "biweekly", "monthly", "quarterly", "biannual", "annual"], description: "Required when isRecurring is true" }, employeeName: { type: "string", description: "Full name like 'Luke Smith' — if provided, assigns this employee to the job immediately after it's created" }, isWorkOrder: { type: "boolean", description: "true if this came from a commercial work order (email/text from a client like Home Depot/Lowe's) rather than a normal residential booking" }, workOrderNumber: { type: "string", description: "The work order number exactly as given — never invented" }, workOrderClient: { type: "string", description: "e.g. 'Home Depot #4521'" }, requiresManagerSignoff: { type: "boolean", description: "true if the work order text says a manager/supervisor needs to sign off on completion" }, photoRequirements: { type: "array", items: { type: "object", properties: { label: { type: "string", description: "Which section/area, e.g. 'loading dock'" }, kind: { type: "string", enum: ["photo", "video"] }, minCount: { type: "number" }, instructions: { type: "string" } }, required: ["label"] }, description: "Only include entries the work order text actually specifies a count/area for — do not pad this out with guessed sections" } } }
    },
    {
      name: "generate_work_order_summary",
      description: "Send a branded work-order completion summary email — used after a commercial/night job is done and the owner needs to respond to the client (Home Depot, Lowe's, etc). Write summaryText yourself as natural, professional prose describing what was done, drawing on the job's checklist/notes/address you already have — follow the owner's own workOrderEmailTemplate settings (word limit, tone) if given in your context. Do not fabricate details not actually in the job's notes/checklist.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, customerName: { type: "string" }, recipientEmail: { type: "string", description: "Who at the client company receives this" }, subject: { type: "string" }, summaryText: { type: "string", description: "The written summary — plain text, newlines allowed" } }, required: ["recipientEmail", "summaryText"] }
    },
    {
      name: "get_estimate_breakdown",
      description: "Get the full itemized breakdown of a quote or invoice — every line item, subtotal, discounts, tax, and total. Use for 'what's the breakdown on that quote', 'what did I quote them for', or similar. Resolves the customer's most recent quote/invoice if no estimateId is given.",
      input_schema: { type: "object", properties: { estimateId: { type: "string" }, customerName: { type: "string" } } }
    },
    {
      name: "apply_discount_to_estimate",
      description: "Apply a discount to an existing quote or invoice — use for 'give them a discount', 'knock 10% off that quote', 'take $50 off'. Adds a real discount line (doesn't touch the original line items) and recomputes the total. Can also text the customer about it in the same call — write the message yourself if the owner wants them notified.",
      input_schema: { type: "object", properties: { estimateId: { type: "string" }, customerName: { type: "string" }, discountType: { type: "string", enum: ["percent", "amount"] }, discountValue: { type: "number" }, label: { type: "string", description: "e.g. 'Loyalty discount' — shown on the quote/invoice" }, notifyCustomer: { type: "boolean" }, customerMessage: { type: "string", description: "Required if notifyCustomer is true" } }, required: ["discountType", "discountValue"] }
    },
    {
      name: "update_job_price",
      description: "Change the price (amount) of an already-scheduled job directly — distinct from apply_discount_to_estimate, which is for quotes/invoices. Use for 'change the price on that job to $X'.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, customerName: { type: "string" }, newAmount: { type: "number" } }, required: ["newAmount"] }
    },
    {
      name: "update_job_priority",
      description: "Change the priority of an existing job.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, priority: { type: "string", enum: ["low", "normal", "high", "urgent"] } }, required: ["jobId", "priority"] }
    },
    {
      name: "reschedule_job",
      description: "Move an existing job to a new date and/or time. Can optionally notify the customer in the same call — use this instead of a separate send_reminder call whenever the user asks to reschedule AND notify in one request.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM, optional" }, notify: { type: "string", enum: ["none", "sms", "email", "both"], description: "Whether to notify the customer of the new date/time. Defaults to none." } }, required: ["jobId", "date"] }
    },
    {
      name: "cancel_job",
      description: "Cancel an existing job. Can optionally notify the customer in the same call.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, reason: { type: "string" }, notify: { type: "string", enum: ["none", "sms", "email", "both"], description: "Whether to notify the customer of the cancellation. Defaults to none." } }, required: ["jobId"] }
    },
    {
      name: "get_job_details",
      description: "Get full details for one job — address, date/time, status, amount, assigned crew, checklist progress, photo count, payment status. Use for 'show me the details for [customer]'s job' style questions. If jobId isn't known yet, provide customerName and it resolves their most recent non-cancelled job.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, customerName: { type: "string", description: "Full name like 'Mike Harrison' as alternative to jobId" } } }
    },
    {
      name: "add_checklist_item",
      description: "Add an item to a job's checklist. `phase` selects which checklist: 'pre' (before starting, default), 'during' (while working), or 'post' (before leaving).",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, item: { type: "string", description: "The checklist item text" }, phase: { type: "string", enum: ["pre", "during", "post"] } }, required: ["jobId", "item"] }
    },
    {
      name: "create_invoice",
      description: "Create and save an invoice for a customer for a flat amount or itemized line items, optionally with a deposit (depositPercent / depositAmount) — a bill due now (unlike create_estimate, which is a pending quote awaiting approval). After creating it, call send_estimate — pass the returned invoiceId AS send_estimate's estimateId param — to actually deliver it to the customer. Creating alone does not notify the customer.",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, customerName: { type: "string" }, amount: { type: "number", description: "Flat total if not using itemized lineItems" }, description: { type: "string", description: "Line description when using a flat amount, e.g. 'Standard service'" }, lineItems: { type: "array", items: { type: "object", properties: { description: { type: "string" }, quantity: { type: "number" }, unitPrice: { type: "number" } }, required: ["description", "unitPrice"] } }, notes: { type: "string" }, depositPercent: { type: "number", description: "Require a deposit of this % of the total (e.g. 50). Use this OR depositAmount." }, depositAmount: { type: "number", description: "Require a flat dollar deposit. Use this OR depositPercent." }, depositMandatory: { type: "boolean", description: "REQUIRED whenever a deposit is set. true = the customer can only pay the deposit now; false = they choose between the deposit now or paying in full. If the user didn't say, ask them first." } } }
    },
    {
      name: "mark_invoice_paid",
      description: "Mark an existing invoice as paid — use for 'mark the Jones invoice paid, they paid cash/check/venmo' or similar. Does not process a card charge — direct the owner to the in-app Charge/Pay Now button for that.",
      input_schema: { type: "object", properties: { invoiceId: { type: "string" }, customerName: { type: "string", description: "Alternative to invoiceId — marks that customer's most recent unpaid invoice" } } }
    },
    {
      name: "update_customer",
      description: "Edit an existing customer's contact info — phone, email, address, or notes. Does not create a new customer.",
      input_schema: { type: "object", properties: { customerName: { type: "string" }, phone: { type: "string" }, email: { type: "string" }, address: { type: "string" }, notes: { type: "string" } }, required: ["customerName"] }
    },
    {
      name: "respond_to_review",
      description: "Post a reply to a customer's review, e.g. 'thank the Millers for their 5-star review'.",
      input_schema: { type: "object", properties: { customerName: { type: "string" }, response: { type: "string" } }, required: ["customerName", "response"] }
    },
    {
      name: "get_employee_training_status",
      description: "Check which active employees still have outstanding required training modules.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "attach_file_to_job",
      description: "Attach a file to a JOB's work-order attachments (not a customer's document vault — use attach_file_to_customer for that). Needs a real fileUrl already uploaded/known in this session.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, customerName: { type: "string", description: "Alternative to jobId — attaches to that customer's next upcoming job" }, fileUrl: { type: "string" }, fileName: { type: "string" } }, required: ["fileUrl"] }
    },
    {
      name: "list_candidates",
      description: "List job applicants/candidates in the hiring pipeline, with their current phase.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "move_candidate_phase",
      description: "Move a hiring candidate to a different pipeline phase, e.g. 'move John to Interview' or 'mark Sarah as Hired'.",
      input_schema: { type: "object", properties: { candidateName: { type: "string" }, phase: { type: "string" } }, required: ["candidateName", "phase"] }
    },
    {
      name: "log_vehicle_maintenance",
      description: "Log a maintenance record for a fleet vehicle — e.g. 'log an oil change on the Ford Transit at 45000 miles, cost $60'.",
      input_schema: { type: "object", properties: { vehicle: { type: "string", description: "Match by year/make/model or plate" }, type: { type: "string" }, mileage: { type: "number" }, cost: { type: "number" }, notes: { type: "string" } }, required: ["vehicle"] }
    },
    {
      name: "get_vehicle_status",
      description: "List the fleet's vehicles with mileage, status, and last oil change.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "get_calendar_summary",
      description: "Get what's scheduled for a date range — use for 'what's on the calendar/my agenda/my availability today/this week' questions. Cross-checks the CRM's own job list against the REAL connected Google Calendar and reports discrepancies both directions (a job never synced to Google, or a Google event — personal or otherwise — with no matching CRM job) — always mention discrepancies if there are any, don't just report the CRM job count.",
      input_schema: { type: "object", properties: { from: { type: "string", description: "YYYY-MM-DD, defaults to today" }, to: { type: "string", description: "YYYY-MM-DD, defaults to 7 days from 'from'" } } }
    },
    {
      name: "delete_calendar_event",
      description: "Delete an event from the user's Google Calendar — use for 'delete/remove this from my calendar'. Identify it by eventId (from get_calendar_summary) or by title (+ optionally date) and this will look it up.",
      input_schema: { type: "object", properties: { eventId: { type: "string" }, title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD, narrows the title search" } } }
    },
    {
      name: "update_calendar_event",
      description: "Move or edit an existing Google Calendar event — use for 'move this to Friday' / 'change the time on X'. Identify it by eventId or by title, then pass only the fields that changed.",
      input_schema: { type: "object", properties: { eventId: { type: "string" }, title: { type: "string", description: "used to find the event if no eventId, or the new title if eventId is given" }, date: { type: "string", description: "YYYY-MM-DD, new date if moving it" }, time: { type: "string", description: "HH:MM 24h, new time" }, duration_minutes: { type: "number" }, location: { type: "string" }, notes: { type: "string" } } }
    },
    {
      name: "get_employee_status",
      description: "See which employees are currently clocked in, what job they're on, and elapsed time — use for 'who's working' / 'who's clocked in' questions.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "assign_employee",
      description: "Assign an employee to a job's crew directly — they're added immediately and emailed, no acceptance needed.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, employeeId: { type: "string" }, employeeName: { type: "string", description: "Full name like 'Jake Smith' as alternative to employeeId" } }, required: ["jobId"] }
    },
    {
      name: "request_employee",
      description: "Send a job request to an employee — they must accept or decline before being added to the crew.",
      input_schema: { type: "object", properties: { jobId: { type: "string" }, employeeId: { type: "string" }, employeeName: { type: "string", description: "Full name like 'Jake Smith' as alternative to employeeId" }, message: { type: "string" } }, required: ["jobId"] }
    },
    {
      name: "list_job_requests",
      description: "List pending job requests from employees (an employee asked to be assigned/take on a job and is waiting on approval).",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "respond_to_job_request",
      description: "Approve or deny a pending employee job request. Use list_job_requests first to find its id.",
      input_schema: { type: "object", properties: { requestId: { type: "string" }, approve: { type: "boolean" }, reason: { type: "string", description: "optional, mainly useful when denying" } }, required: ["requestId", "approve"] }
    },
    {
      name: "list_pending_customer_requests",
      description: "List customer requests awaiting your yes/no (e.g. reschedule proposals Alfred set up after a customer texted in about it).",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "approve_customer_request",
      description: "Approve a pending customer request — actually performs the action (e.g. moves the job) and texts the customer to confirm. Use list_pending_customer_requests first if you don't already have the requestId.",
      input_schema: { type: "object", properties: { requestId: { type: "string" } }, required: ["requestId"] }
    },
    {
      name: "decline_customer_request",
      description: "Decline a pending customer request and text the customer that it doesn't work, optionally with a reason.",
      input_schema: { type: "object", properties: { requestId: { type: "string" }, reason: { type: "string" } }, required: ["requestId"] }
    },
    // FEATURE — "build that autonomy level thing... every owner sets their
    // own personalized permissions." When alfredAutonomyLevel (or a
    // vacation-mode override) is "ask_first", a capability-gated tool call
    // doesn't run — it's queued in alfred_pending_actions instead (same
    // table the customer-reschedule flow above already uses, generalized
    // via kind:"action_confirmation" — see migration 0096). These three
    // let the owner review/approve/decline those from the SAME chat.
    {
      name: "list_pending_approvals",
      description: "List Alfred's own queued actions awaiting your approval — things Alfred wanted to do (send a text, apply a discount, reschedule a job, etc.) but held because your autonomy level is set to 'ask first'. Use when the owner asks 'what's waiting on me' or replies 'yes'/'approve' after Alfred said something was queued.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "approve_pending_action",
      description: "Approve one of Alfred's own queued actions (from list_pending_approvals) — actually performs it now. Use list_pending_approvals first if you don't already have the actionId.",
      input_schema: { type: "object", properties: { actionId: { type: "string" } }, required: ["actionId"] }
    },
    {
      name: "decline_pending_action",
      description: "Decline one of Alfred's own queued actions (from list_pending_approvals) — it will never be performed.",
      input_schema: { type: "object", properties: { actionId: { type: "string" } }, required: ["actionId"] }
    },
    {
      name: "send_reminder",
      description: "Send a real, custom text or email message to a customer via SMS or email (requires Twilio/Gmail configured in Settings). Use this for 'text/email [customer] and tell them [anything]' as well as payment/appointment reminders — pass the exact wording as `message`.",
      input_schema: { type: "object", properties: { customerId: { type: "string" }, customerName: { type: "string", description: "Full name like 'Mike Harrison' as alternative to customerId" }, message: { type: "string", description: "The exact message body to send. If omitted, a generic reminder is sent." }, subject: { type: "string", description: "Email subject line, only used when channel is email" }, channel: { type: "string", enum: ["email", "sms"], description: "Defaults to sms if the customer has a phone on file, otherwise email" } } }
    },
    {
      name: "remember_fact",
      description: "Save an important fact to long-term memory — a real standing preference, recurring business rule, or fact worth knowing in every future conversation (e.g. 'always give repeat customers 10% off', 'my slow season is January-February'). Every saved memory gets shown to you at the start of every future conversation, so ONLY save things that should genuinely apply going forward — never a one-off request, a passing remark, or something that's only true for right now ('I don't have time today' is not a fact to remember; 'I'm always slammed on Mondays, don't schedule big jobs then' is).",
      input_schema: { type: "object", properties: { fact: { type: "string" }, category: { type: "string", enum: ["preferences", "business", "facts", "goals", "general"] } }, required: ["fact"] }
    },
    {
      name: "forget_fact",
      description: "Remove a previously saved memory — use when the user says something like 'forget that' or a remembered fact is wrong/outdated.",
      input_schema: { type: "object", properties: { fact: { type: "string", description: "The exact or approximate text of the memory to remove" } }, required: ["fact"] }
    },
    {
      name: "recall_facts",
      description: "List saved memories, optionally filtered by a search term — use for 'what do you remember about X' or 'what have I told you to remember'.",
      input_schema: { type: "object", properties: { search: { type: "string" } } }
    },
    {
      name: "set_vacation_mode",
      description: "Turn on (or update/turn off) vacation/out-of-office mode. Use whenever the owner says they're going on vacation, taking time off, or will be unreachable. NEVER guess the details — ask the owner conversationally, one or two questions at a time, until you have: how long they'll be out (startDate/endDate), how they want Alfred to handle incoming work while they're gone (autonomyLevel), and how often — if at all — they want Alfred to message them during that window (checkInFrequency). Once you have those, confirm the plan back to them in plain English, then call this tool. To turn vacation mode off early, call with active: false.",
      input_schema: {
        type: "object",
        properties: {
          active: { type: "boolean", description: "true to turn vacation mode on, false to end it early" },
          startDate: { type: "string", description: "YYYY-MM-DD, first day out" },
          endDate: { type: "string", description: "YYYY-MM-DD, last day out (day they're back)" },
          autonomyLevel: { type: "string", enum: ["manage_everything", "ask_first", "hold_everything"], description: "manage_everything = Alfred can handle scheduling/messaging/automations on its own while the owner is out; ask_first = Alfred queues things up but waits for approval before anything goes out; hold_everything = Alfred does nothing proactive, just takes messages, until the owner is back" },
          checkInFrequency: { type: "string", enum: ["none", "daily", "every_few_days", "urgent_only"], description: "How often Alfred should text/message the owner a status update while they're out. urgent_only = only for things that truly can't wait." },
          notes: { type: "string", description: "Freeform notes on what the owner wants handled or avoided while they're out, in their own words — e.g. 'don't book anything past Friday the 14th' or 'my brother Dave is covering emergency calls, his number is...'" }
        },
        required: ["active"]
      }
    },
    {
      name: "get_vacation_status",
      description: "Check whether vacation/out-of-office mode is currently active and what its settings are. Use before answering 'am I on vacation mode' or before deciding how autonomously to act.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "set_autonomy_level",
      description: "Sets the owner's STANDING (non-vacation) autonomy level — how much Alfred can do on its own day-to-day, not just while on vacation. Use when the owner says things like 'always ask me before texting customers', 'you can handle things on your own from now on', or 'don't do anything without me'. Separate from vacation mode (set_vacation_mode) — vacation mode temporarily overrides this while active, then this standing level takes over again once vacation ends.",
      input_schema: {
        type: "object",
        properties: {
          level: { type: "string", enum: ["manage_everything", "ask_first", "hold_everything"], description: "manage_everything = act immediately, no confirmation needed; ask_first = queue anything that sends a message, spends money, or changes a schedule/crew commitment for a quick yes/no first; hold_everything = never take those actions on your own, just answer questions and take messages" }
        },
        required: ["level"]
      }
    },
    // FEATURE — capability parity with text-Alfred's set_reminder/
    // list_reminders/cancel_reminder: a REAL scheduled text sent to the
    // owner's own phone later, not just an in-app note. Same alfred_reminders
    // table and same check-reminders.ts cron delivers it either way — set it
    // here in a normal chat, get texted the follow-up later, from your phone
    // wherever you actually are.
    {
      name: "set_followup_reminder",
      description: "Text the owner (yourself) a follow-up/reminder at a specific future time — a REAL scheduled SMS, delivered even if this chat isn't open. Use whenever the user asks to be followed up with, nudged, checked on, or reminded about something later (e.g. 'remind me at 3 to call Mike', 'text me tonight if that job isn't done', 'follow up with me in an hour'). Resolve any relative time ('in 20 min', 'tomorrow at 9am', 'tonight') into an exact ISO datetime yourself using the current date/time before calling this. Requires the owner's mobile number set in Settings → Company.",
      input_schema: { type: "object", properties: { message: { type: "string", description: "What to text back at that time" }, dueAtIso: { type: "string", description: "Exact ISO 8601 datetime to send it" } }, required: ["message", "dueAtIso"] }
    },
    {
      name: "list_followup_reminders",
      description: "List the owner's own pending (not-yet-sent) follow-up reminders.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "cancel_followup_reminder",
      description: "Cancel a pending follow-up reminder by its id (from list_followup_reminders).",
      input_schema: { type: "object", properties: { reminderId: { type: "string" } }, required: ["reminderId"] }
    },
    {
      name: "get_business_stats",
      description: "Get current live business KPIs.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "list_services",
      description: "The business's real service/pricing catalog — name, price, category, whether it's taxable. Use before quoting a price or answering 'what do we charge for X' instead of guessing.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "get_company_info",
      description: "Core facts about the business itself — company name, address, phone, tax rate/state, and how many active customers/employees/vehicles it has.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "list_estimates",
      description: "List actual quotes/estimates with customer names, amounts, and status — use whenever the owner asks what's pending, approved, declined, or invoiced, or asks about a specific customer's quote. get_business_stats only gives a total count, not which ones or who they're for; this gives the real list.",
      input_schema: { type: "object", properties: { status: { type: "string", enum: ["pending", "approved", "rejected", "invoiced", "all"], description: "default 'pending'" } } }
    },
    {
      name: "text_supplier",
      description: "Send a real SMS to a inventory supplier's phone number (from Inventory & Equipment → that item's Suppliers list). Use this ONLY for outreach — asking about stock, pricing, or availability, or requesting a callback — NEVER to place an order or authorize any purchase/payment; this app has no way to actually complete a purchase or move money to a vendor. ALWAYS show the user the exact message text and get an explicit 'yes, send it' before calling this tool — never send unconfirmed.",
      input_schema: { type: "object", properties: { itemName: { type: "string", description: "The inventory item name, e.g. 'Shop Supplies'" }, supplierName: { type: "string", description: "Optional — which supplier on that item to text, if it has more than one" }, message: { type: "string", description: "The exact SMS text to send" } }, required: ["itemName", "message"] }
    },
    {
      name: "email_supplier",
      description: "Send a real email to a inventory supplier's email address (from Inventory & Equipment → that item's Suppliers list). Same rules as text_supplier: outreach only (stock/pricing/availability/callback), never to place an order or authorize payment, always confirm the exact subject+message with the user first.",
      input_schema: { type: "object", properties: { itemName: { type: "string" }, supplierName: { type: "string", description: "Optional — which supplier on that item to email, if it has more than one" }, subject: { type: "string" }, message: { type: "string", description: "The exact email body to send" } }, required: ["itemName", "subject", "message"] }
    },
    {
      name: "check_stock",
      description: "Check current stock levels against reorder thresholds for inventory items — use whenever the owner asks what's running low or needs reordering. Read-only; never places an order on its own.",
      input_schema: { type: "object", properties: { itemName: { type: "string", description: "Optional — check one specific item; omit to check everything" } } }
    },
    {
      name: "contact_general_supplier",
      description: "List, look up, text, or email GENERAL suppliers — mechanics, main shops, or vendors not tied to any specific inventory item (see the General Suppliers list in Inventory & Equipment). Omit supplierName to list everyone on file (use for 'who are our suppliers?'). Omit channel to just look up one supplier's contact info. Outreach only — never places an order or moves money.",
      input_schema: { type: "object", properties: { supplierName: { type: "string", description: "Omit to list all suppliers" }, channel: { type: "string", enum: ["text", "email"], description: "Omit to just look up contact info" }, subject: { type: "string" }, message: { type: "string" } } }
    },
    {
      name: "log_expense",
      description: "Log a business expense — use whenever the owner says they spent money on something ('log $40 for gas', 'I bought a new drill bit for $15').",
      input_schema: { type: "object", properties: { amount: { type: "number" }, description: { type: "string" }, category: { type: "string" }, vendor: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD, defaults to today" } }, required: ["amount", "description"] }
    },
    {
      name: "list_expenses",
      description: "List recent expenses and their total — use when the owner asks what they've spent recently.",
      input_schema: { type: "object", properties: { days: { type: "number", description: "Defaults to 30" } } }
    },
    {
      name: "list_sops",
      description: "List the SOP/instruction documents on file.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "create_sop",
      description: "Create a new SOP/instruction document, visible to all employees in the portal.",
      input_schema: { type: "object", properties: { title: { type: "string" }, content: { type: "string", description: "Markdown body" }, frequency: { type: "string", enum: ["daily", "monthly", "general"] } }, required: ["title", "content"] }
    },
    {
      name: "list_campaigns",
      description: "List marketing campaigns and their status.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "list_social_posts",
      description: "List recent/scheduled social media posts.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "navigate_to",
      description: "Navigate the user's screen to a CRM page. Valid pages: dashboard, customers, estimates, invoices, jobs, pipeline, calendar, campaigns, referrals, reviews, automations, social, accountability, employees, fleet, expenses, chemicals, reports.",
      input_schema: { type: "object", properties: { page: { type: "string" } }, required: ["page"] }
    },
    // FIX (Alfred capability audit) — "never object to sending a message."
    // send_reminder already handles any custom text to an EXISTING customer,
    // but has no fallback when the name given isn't a customer match at all
    // (a lead, an applicant, a personal contact, anyone not yet in the CRM)
    // — that's the actual gap behind "Alfred said it can't send that
    // message." This is the fallback: any phone number, no customer lookup
    // required. See the toolHint system-prompt addition below for when to
    // reach for this instead of just reporting "customer not found."
    {
      name: "text_phone_number",
      description: "Send a real SMS to ANY phone number directly — use this whenever the owner wants to text someone who ISN'T an existing customer (a lead, a job applicant, a personal contact, a vendor not in Inventory & Equipment, or anyone send_reminder/text_supplier couldn't find a record for), or whenever they just give you a phone number directly. Also use this to text a customer you just created with create_customer in this same turn (schedule_job/create_customer don't send texts themselves) — ALWAYS pass customerId in that case so the message links to their record instead of sitting as an orphaned Inbox thread. The owner has full authority to send any message to anyone through their own business number — never refuse or say you can't send a message; if you're missing the phone number, ask for it, then send.",
      input_schema: { type: "object", properties: { phone: { type: "string", description: "The recipient's phone number, any format" }, message: { type: "string", description: "The exact SMS text to send" }, label: { type: "string", description: "Optional — a name/label for this contact, for the Inbox log" }, customerId: { type: "string", description: "Pass this whenever the recipient is a known/just-created CRM customer, so the Inbox thread links to their profile instead of being orphaned" } }, required: ["phone", "message"] }
    },
    {
      name: "prepare_import",
      description: "Read a big list of customers (and their jobs/schedules) for import — an attached spreadsheet/CSV or a long pasted list (both arrive as an import batch id), or text you pass directly. Handles hundreds or thousands of rows: tables are read column by column, free text is read in pieces. Matches existing customers (no duplicates) and workers to employees, works out each job's date, time, price, repeat schedule and number of cans. Saves NOTHING — returns a summary to show the owner. Use this instead of create_customer/schedule_job for more than a few records.",
      input_schema: { type: "object", properties: {
        batchId: { type: "string", description: "The import batch id from the attachment/paste note" },
        text: { type: "string", description: "Only when there's no batch id: the list itself" },
        serviceCategory: { type: "string", enum: ["trash_can", "general"], description: "Use general unless the business has a trash_can service line" },
        createJobs: { type: "boolean", description: "Create jobs from the schedule/price info (default true). false = customers only" },
        columnOverrides: { type: "object", description: "Only for tables, only if the summary shows a column read wrong: { \"Column header\": \"field\" } — fields: fullName firstName lastName phone email address city state zip notes gateCode company amount frequency weekday scheduledDate scheduledTime cans worker service __skip__" },
      } }
    },
    {
      name: "run_import",
      description: "Save an import prepared with prepare_import — only after the owner has seen that summary and said yes in a later message. Creates/updates the customers and creates their jobs in batches.",
      input_schema: { type: "object", properties: { planId: { type: "string", description: "From prepare_import; leave out to use the latest prepared import" } } }
    },
    {
      name: "read_google_sheet",
      description: "Open a Google Sheets link and keep its rows as an import batch (then prepare_import imports it). Works for sheets shared by link and for private sheets of the connected Google account. A link in the owner's message is usually opened already — look for the [Google Sheet …] note first.",
      input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] }
    },
    {
      name: "read_pasted_text",
      description: "Read a long pasted message in full, a page at a time (for a paste that ISN'T an import, e.g. an email to summarize).",
      input_schema: { type: "object", properties: { batchId: { type: "string" }, page: { type: "number", description: "1-based, 8,000 characters per page" } }, required: ["batchId"] }
    },
    {
      name: "notify_all_customers",
      description: "Step 1 of texting more than 2 customers (an announcement, a promo, a question to your list): DRAFTS it and returns the numbered recipient list — nothing is sent. Show the owner the list and ask which to send to, then wait for their reply and call send_bulk_text. Skips opted-out customers. Supports {{first_name}}. If the text asks customers something (birthday, email, address), pass watchReplies so their answers are saved to their files as they come in.",
      input_schema: { type: "object", properties: {
        message: { type: "string", description: "Use {{first_name}} to personalize" },
        tag: { type: "string", description: "Only customers with this tag — omit to mean everyone" },
        customerNames: { type: "array", items: { type: "string" }, description: "Only these customers" },
        onlyMissing: { type: "string", enum: ["birthday", "email", "address"], description: "Only customers whose file doesn't have this yet" },
        campaignName: { type: "string" },
        watchReplies: { type: "object", properties: { question: { type: "string" }, saveField: { type: "string", enum: ["birthday", "email", "address", "notes", "company"] }, thankYouMessage: { type: "string" }, days: { type: "number" } } },
      }, required: ["message"] }
    },
    {
      name: "get_accountability_summary",
      description: "The owner's personal accountability data from the Accountability page — daily check-ins (sleep, water, steps, workouts, mood, notes), streak, wins and personal checklist items that are due. Use for check-ins, the morning briefing, a weekly reflection, or when the owner asks how they're doing. Don't bring it up while they're working through business tasks.",
      input_schema: { type: "object", properties: { days: { type: "number", description: "How many days back (default 7)" } } }
    },
    {
      name: "check_connections",
      description: "Health check of everything Alfred depends on — every AI model key, Twilio and its incoming-text webhook, Google, database tables, the reminders scheduler. Use for 'is everything connected', 'why aren't my texts working', 'check your API connections'. Report problems with their fixes.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "create_campaign",
      description: "Create a campaign in the Campaigns page (draft, or scheduled with sendAt) without texting anyone now. To actually text people, use notify_all_customers (draft → owner approves → send_bulk_text).",
      input_schema: { type: "object", properties: { name: { type: "string" }, channel: { type: "string", enum: ["sms", "email"] }, message: { type: "string" }, subject: { type: "string" }, tags: { type: "array", items: { type: "string" } }, sendAt: { type: "string", description: "ISO date/time" } }, required: ["name", "message"] }
    },
    {
      name: "set_birthday_offer",
      description: "Turn on/change/turn off the automatic birthday text: on each customer's birthday (from their file) they get their own coupon code for X% off, good for N days. Runs every morning on its own.",
      input_schema: { type: "object", properties: { active: { type: "boolean" }, discountPercent: { type: "number" }, validDays: { type: "number" }, message: { type: "string", description: "Optional. {{first_name}}, {{code}}, {{percent}}, {{expires}} are filled in." } }, required: ["active"] }
    },
    {
      name: "log_income",
      description: "Add income (sales, deposits, payouts, cash jobs not in the CRM) to the Budget page — one or many entries, e.g. from a revenue report or bank statement the owner sent.",
      input_schema: { type: "object", properties: { entries: { type: "array", items: { type: "object", properties: { date: { type: "string" }, description: { type: "string" }, amount: { type: "number" }, category: { type: "string" } }, required: ["amount"] } } }, required: ["entries"] }
    },
    {
      name: "send_bulk_text",
      description: "Step 2: send a notify_all_customers draft AFTER the owner replied to approve it — exclude = list numbers they said no to, only = the ones they said yes to. Refused if called in the same reply as the draft.",
      input_schema: { type: "object", properties: { draftId: { type: "string" }, exclude: { type: "array", items: { type: "number" } }, only: { type: "array", items: { type: "number" } } }, required: ["draftId"] }
    },
    {
      name: "switch_ai_model",
      description: "Switch which AI provider Alfred uses (here and over text), e.g. 'switch to Claude' / 'use Gemini instead'. Only works for a provider that already has an API key saved in Settings → AI Models.",
      input_schema: { type: "object", properties: { provider: { type: "string", description: "e.g. 'claude', 'gpt-4o', 'gemini', 'groq', 'mistral', 'kimi'" } }, required: ["provider"] }
    },
    {
      name: "enable_review_request_automation",
      description: "Turn on automatically texting customers a review-request link a couple days after their job is marked complete — a real rule-based automation (no AI/API usage on the actual sends), not something you have to remember to do yourself. Use for 'automatically ask for reviews after jobs' / 'send review requests after we finish'.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "create_automation",
      description: "Create a new multi-step workflow automation in the CRM. Build an n8n-style workflow from a description. Each step must have: id (generate unique string), type (trigger|condition|delay|action|branch), label (human-readable description). Action steps also need channel (email|sms|task|webhook|calendar|internal). Delay steps need duration (number) and unit (min|hour|day|week|month). Condition steps need check (from list). Set trigger step first always.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Descriptive name for the workflow" },
          description: { type: "string" },
          category: { type: "string", enum: ["estimates", "jobs", "payments", "reviews", "lifecycle", "referrals", "other"] },
          icon: { type: "string", description: "Single emoji" },
          steps: {
            type: "array",
            description: "Ordered steps. First must be type=trigger.",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string", enum: ["trigger", "condition", "delay", "action", "branch"] },
                label: { type: "string" },
                channel: { type: "string", enum: ["email", "sms", "task", "webhook", "calendar", "internal"] },
                check: { type: "string" },
                duration: { type: "number" },
                unit: { type: "string", enum: ["min", "hour", "day", "week", "month"] },
                template: { type: "string" },
                url: { type: "string" },
                target: { type: "string" }
              },
              required: ["type", "label"]
            }
          }
        },
        required: ["name", "steps"]
      }
    },
    {
      name: "list_automations",
      description: "Get all existing workflow automations with their status and run counts.",
      input_schema: { type: "object", properties: {} }
    },
    {
      name: "toggle_automation",
      description: "Enable or disable an automation workflow by ID.",
      input_schema: { type: "object", properties: { automationId: { type: "string" }, active: { type: "boolean" } }, required: ["automationId", "active"] }
    },
    {
      name: "create_google_task",
      description: "Create a task in Google Tasks. Only works if Google Tasks scope is enabled.",
      input_schema: { type: "object", properties: { title: { type: "string" }, notes: { type: "string" }, due: { type: "string", description: "YYYY-MM-DD" } }, required: ["title"] }
    },
    {
      name: "send_email_via_gmail",
      description: "Send an email via the user's connected Gmail account. Only works if Google is connected in Settings with Gmail scope enabled.",
      input_schema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, cc: { type: "string" } }, required: ["to", "subject", "body"] }
    },
    {
      name: "create_calendar_event",
      description: "Create an event on the user's Google Calendar. Only works if Google Calendar is connected.",
      input_schema: { type: "object", properties: { title: { type: "string" }, date: { type: "string", description: "YYYY-MM-DD" }, time: { type: "string", description: "HH:MM 24h" }, duration_minutes: { type: "number" }, location: { type: "string" }, attendees: { type: "array", items: { type: "string" } }, notes: { type: "string" } }, required: ["title", "date"] }
    },
    {
      name: "upload_to_drive",
      description: "Upload a file to the user's Google Drive. Only works if Google Drive is connected.",
      input_schema: { type: "object", properties: { filename: { type: "string" }, folder: { type: "string" }, content: { type: "string" } }, required: ["filename"] }
    },
    {
      name: "undo_last_action",
      description: "Reverses the most recent reversible action(s) YOU (Alfred) took — creating a customer, scheduling a job, creating an estimate/invoice, assigning crew, rescheduling, or cancelling a job. Works across sessions too — even if it was 5 minutes or a day ago, in this conversation or a different one, as long as it hasn't been undone already. Pass count > 1 to undo a whole batch (e.g. 'undo those 5 jobs you just created' -> count: 5) — use list_recent_actions first if you're not sure how many that is. ALWAYS confirm first: restate exactly what you're about to undo in plain English ('Wait — you want me to undo scheduling the service job for Sarah Miller on 2026-09-30?', or for a batch, name the count and what they are) and wait for a clear yes before calling this. If there's nothing undoable, it returns an error saying so — tell the user plainly rather than pretending something was undone.",
      input_schema: { type: "object", properties: { count: { type: "number", description: "How many of the most recent reversible actions to undo, most recent first. Defaults to 1." } } }
    },
    {
      name: "list_recent_actions",
      description: "Lists the most recent reversible actions Alfred has taken (creating customers/jobs/estimates/invoices, assigning crew, rescheduling, cancelling), each with when it happened and whether it's already been undone. Use this when the owner asks 'what did you do' / 'what did you just do' / 'what have you done recently', or when they say 'undo those'/'delete those' and you need to figure out exactly how many/which ones before confirming with them.",
      input_schema: { type: "object", properties: { limit: { type: "number", description: "Max number of recent actions to return. Defaults to 15." } } }
    }
  ];

  // BUG FIX (user report) — "when I messaged Alfred, it literally responded
  // as if it was me messaging it... shows messages incoming from Alfred as
  // if they're outgoing and in red." The color logic was already correct
  // (isUser -> red/right) — the REAL bug: sendWithAttachments used to feed
  // Alfred's own full screenshot-extraction breakdown into a plain
  // send(longText) call, which appends whatever it's given as a role:"user"
  // message. That huge, asterisk-laden breakdown was never something the
  // owner typed — it just got MIS-ATTRIBUTED as their own outgoing message
  // (hence the red bubble, hence "it responded as if it was me"). opts.
  // skipVisibleMessage lets a caller feed real content to the MODEL for
  // this turn (it's still what the tool-calling loop reasons over) without
  // ever rendering it as a fake user bubble — the owner's actual short
  // caption (already appended separately by the caller) stays the only
  // thing shown as "sent by them."
  // FEATURE (user report) — errors never go into the conversation: a pop-up
  // (while the chat is open) plus a bell notification and a toast (so whoever
  // sent it hears about it even if they've moved to another page).
  const [alfredError, setAlfredError] = useState<AlfredError | null>(null);
  const reportAlfredError = (err: unknown, opts: { retryText?: string; file?: boolean } = {}) => {
    const e = classifyAlfredError(err, opts);
    console.warn("[Alfred] error:", e.details);
    setAlfredError(e);
    toast(e.title, "red");
    onNotify?.({ text: "Alfred: " + e.title, detail: e.message });
  };
  const send = async (overrideText?: string, opts?: { skipVisibleMessage?: boolean }) => {
    const text = (overrideText ?? input).trim();
    if (!text) return;
    if (!loading) { turnStartRef.current = Date.now(); directSendsRef.current = 0; }
    // BUG FIX (user report — "Alfred just sat there spinning and never
    // responded, no error") — this used to silently no-op while `loading`
    // was already true (e.g. a screenshot attachment's own vision-analysis
    // call still in flight) — the owner's typed message just vanished with
    // zero feedback, textarea included, looking exactly like a hang. Now it
    // says so instead of pretending nothing happened.
    if (loading) { toast("Alfred's still working on your last message — one sec.", "yellow"); return; }

    // BUG FIX — "creates a new chat but says nothing": this used to create an
    // empty-messages conversation, switch to it, then return without ever
    // appending the text the user just typed — appendMessage/updateActive
    // below both operate on `active`, which is derived from conversations/
    // activeConvId state that hasn't committed yet on this same render, so
    // the message was silently dropped (only a console warning, no
    // user-visible sign anything went wrong; the user had to notice and
    // retype it). Rather than duplicating this function's ~200-line model-
    // calling/tool-use pipeline below for a "conversation already exists"
    // case, queue the text and let the effect just below re-invoke send()
    // itself (via overrideText) the moment `active` actually exists.
    if (!active) {
      const cid = uid();
      setConversations([{ id: cid, title: text.slice(0, 42) + (text.length > 42 ? "…" : ""), personality, createdAt: today(), updatedAt: Date.now(), messages: [] }]);
      setActiveConvId(cid);
      setInput("");
      setShowSlash(false);
      pendingFirstSendRef.current = { text, skipVisibleMessage: opts?.skipVisibleMessage };
      return;
    }

    const userMsg = { id: uid(), role: "user", content: text, timestamp: Date.now() };
    if (!opts?.skipVisibleMessage) {
      appendMessage(userMsg);

      // Auto-title from first user message
      if (active && (active.title === "New chat" || !active.title)) {
        const title = text.length > 42 ? text.slice(0, 42) + "…" : text;
        updateActive({ title });
      }
    }

    setInput("");
    setShowSlash(false);

    if (!opts?.skipVisibleMessage && text.startsWith("/")) {
      const r = await runSlash(text);
      if (r !== null) {
        appendMessage({ id: uid(), role: "alfred", content: r, timestamp: Date.now() });
        return;
      }
      // Unknown slash command — let AI handle it naturally
      // Don't dead-end, just pass through to Claude with the text
    }

    setLoading(true);

    try {
      const activePersonality = active?.personality || personality;
      console.log("[Personality] active personality for this send:", activePersonality);
      const memByCat: Record<string, string[]> = memory.reduce((acc: Record<string, string[]>, m: any) => { const k = m.category || "general"; (acc[k] = acc[k] || []).push(m.text); return acc; }, {});
      // BUG FIX — jobs kept getting scheduled a full year off (e.g. the
      // owner said "August 26" meaning 2026, Alfred resolved it to
      // "2025-08-26" — already in the past). Root cause: nothing anywhere
      // in this system prompt ever told the model what today's real date
      // is, so it fell back on its own training-data sense of "now" — an
      // AI model has no other way to know the actual current year. Every
      // relative/partial date the owner gives ("tomorrow," "next Friday,"
      // "August 26") needs a real anchor date to resolve against.
      const dateContext = `\n\nToday's real date is ${today()} (YYYY-MM-DD) — trust this over any assumption you'd otherwise make about the current date/year. Resolve every relative or partial date the user gives ("tomorrow", "next Friday", "August 26") against this real date, not your training data.`;
      // BUG FIX (customer-texting/standing-instructions audit) — "the
      // preferences a user gives should actually be followed" is hard to
      // guarantee when the injected memory reads as passive background
      // info ("what you remember about the user") rather than something
      // to actually act on. The [preferences] category specifically is
      // where set_autonomy_level-adjacent standing rules and per-customer
      // communication notes land (see the STANDING INSTRUCTIONS / CUSTOMER
      // TEXTING sections of toolHint below) — reframed as binding rules to
      // check against, not just recall.
      const memoryContext = memory.length > 0 ? "\n\nWhat you remember about the user (organized by category — [preferences] and [business] are standing rules to actually follow on every relevant action below, not just background facts to recall):\n" + Object.entries(memByCat).map(([k, list]) => "  [" + k + "]: " + list.join("; ")).join("\n") : "";
      // FEATURE — "the web chat and SMS should share memory." alfred_memory
      // (above) was already shared — both channels read/write the exact
      // same owner_id-scoped table. This adds awareness of the raw SMS
      // conversation itself: a short digest of the most recently active
      // text thread (if touched in the last 48h), so this web chat isn't
      // blind to what was just discussed over text a few minutes ago.
      // BUG FIX — "respond quicker if possible." This was a blocking
      // network round-trip on EVERY single message before the model call
      // even started — the one clearly avoidable latency source in this
      // whole pipeline (everything else between here and the model call
      // is synchronous). Voice Mode already gets cross-channel awareness
      // from crossConversationContext/voiceSandboxContext below (no
      // network round-trip, just reading already-loaded conversations) —
      // skip this SMS fetch specifically during a live voice call, where
      // shaving a network round trip off every turn's latency matters
      // most. Text chat keeps it (latency isn't felt the same way there).
      let crossChannelContext = "";
      if (!voiceModeOpenRef.current) {
        try {
          const smsRes: any = await (supabase as any).from("alfred_sms_threads").select("phone,messages,updated_at").eq("owner_id", ownerId).order("updated_at", { ascending: false }).limit(1);
          const thread = smsRes?.data?.[0];
          if (thread?.updated_at && Date.now() - new Date(thread.updated_at).getTime() < 48 * 3600000 && Array.isArray(thread.messages) && thread.messages.length > 0) {
            const tail = thread.messages.slice(-6).map((m: any) => `${m.role === "assistant" ? "Alfred" : "Owner"}: ${String(m.content || "").slice(0, 200)}`).join("\n");
            crossChannelContext = `\n\nRECENT ACTIVITY OVER TEXT (SMS, not this web chat — phone ${thread.phone}, updated ${new Date(thread.updated_at).toLocaleString()}):\n${tail}\nThis is a DIFFERENT conversation channel than this web chat — treat it as background context on what the owner's been doing/asking about recently, not as literal history of THIS conversation.`;
          }
        } catch { /* non-fatal — proceed without cross-channel context */ }
      }
      // FEATURE — "upload a PDF, summarize it, then schedule it and assign
      // employees." recentFileContextRef (set when a non-receipt PDF/photo
      // was just analyzed — see the paperclip handler above) is handed to
      // the model for a few turns so a follow-up instruction has real
      // content to act on, then expires — 4 turns or 20 minutes, whichever
      // comes first, same ephemeral treatment (never synced to Supabase,
      // never kept indefinitely) as the screenshot preview purge below.
      let fileContext = "";
      {
        const fc = recentFileContextRef.current;
        if (fc) {
          const ageMs = Date.now() - fc.attachedAt;
          if (fc.turnsUsed >= 4 || ageMs > 20 * 60000) {
            recentFileContextRef.current = null;
          } else {
            fc.turnsUsed++;
            fileContext = `\n\nRECENTLY ATTACHED FILE ("${fc.fileName}", analyzed a moment ago — use this content if the owner's message asks you to summarize, schedule work from, or otherwise act on it; ignore it if their message is unrelated):\n${fc.extractedText}`;
          }
        }
      }
      const ownerName = (settings as any)?.ownerName || (settings as any)?.companyName;
      const businessContext = (ownerName ? `\n\nThe owner's name is ${ownerName} — use it naturally when greeting them or in casual conversation, not on every single reply.` : "") + "\n\nCurrent business snapshot:\n- Active jobs: " + stats.activeJobs + "\n- Pending quotes: " + stats.pendingEst + "\n- Revenue MTD: " + fmt(stats.totalRev) + "\n- Close rate: " + stats.closeRate + "%\n- Jobs completed this month: " + stats.doneMonth + "\n- Total customers: " + customers.length;
      // FEATURE — "a real continuous hands-free conversation... like
      // ChatGPT's voice mode... Alfred would give me a summary of the
      // business, greet me, and ask what I want to start doing today."
      // Text meant to be READ (markdown, bullet lists, headers) sounds
      // broken read aloud by TTS — this is the one thing that has to
      // differ about how Alfred replies in Voice Mode, not what it knows
      // or can do (same tools, same memory, same personality either way).
      // FEATURE — "Alfred should have the context of the screen you're
      // on... what customer is my cursor over." currentPageName is 100%
      // reliable (it's just the router's own state, passed down from
      // App.tsx). cursorContext is a real but best-effort heuristic — see
      // App.tsx's own comment on exactly how it's resolved (text under the
      // cursor, fuzzy-matched against loaded customers/jobs/employees) —
      // it can legitimately be blank (cursor over empty space, a chart, a
      // page this heuristic can't read), which the model is told to treat
      // as "ask which one" rather than guessing, matching the exact "which
      // ones?" behavior asked for.
      const screenContext = voiceModeOpenRef.current
        ? `\n\nSCREEN AWARENESS: the owner is currently on the "${currentPageName}" page of the CRM (this is real, not a guess).${cursorContext ? ` Their cursor is currently over: ${cursorContext} — a real but best-effort read of what's on screen, not guaranteed for every kind of content (charts/graphs won't resolve).` : ` Nothing recognizable is resolved under their cursor right now.`} If they reference something on screen ambiguously — "this", "that", "these", "the one I'm on" — without clearly naming it, do NOT just assume and act. Call confirm_screen_reference first: it highlights whatever's under their cursor in glowing red on their actual screen and tells you exactly what it is. Ask "You mean this — [briefly describe it]?" and wait for an explicit yes. If they say no, or point elsewhere and say "this" again, call confirm_screen_reference again — it re-samples their cursor live, so it naturally follows wherever they're now pointing. Only once they say yes should you act — and at that point you have FULL, normal access to every tool against that confirmed id, not a limited subset: schedule it, message about it, edit it, cancel it, reassign it, delete it, whatever they ask, exactly as if they'd named it outright.`
        : "";
      // FEATURE — "it knows conversations you had in text... if I message
      // Alfred and later ask on a voice call what I messaged earlier today,
      // it knows." Voice Mode is its own persistent "Alfred Voice"
      // conversation (see openVoiceMode) — it doesn't literally contain the
      // text chats, so this hands the model a digest of whatever OTHER
      // conversations were actually touched recently (last 24h), same
      // non-literal-history treatment as crossChannelContext's SMS digest
      // above. Not limited to "the one conversation open right before this
      // call" — that missed a text chat from earlier the same day if the
      // owner had since switched to a different one (or none) before
      // opening Voice Mode.
      let crossConversationContext = "";
      if (voiceModeOpenRef.current) {
        const sandboxId = (settings as any)?.voiceSandboxConversationId;
        const convTs = (c: any): number => { const v = c?.updatedAt; if (typeof v === "number") return v; const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; };
        const recentTextConvs = conversations
          .filter(c => c.id !== sandboxId && c.id !== activeId && Array.isArray(c.messages) && c.messages.length > 0 && Date.now() - convTs(c) < 24 * 3600000)
          .sort((a, b) => convTs(b) - convTs(a))
          .slice(0, 2);
        if (recentTextConvs.length > 0) {
          const digest = recentTextConvs.map(c => c.messages.slice(-6).map((m: any) => `${m.role === "user" ? "Owner" : "Alfred"}: ${String(m.content || "").slice(0, 200)}`).join("\n")).join("\n---\n");
          crossConversationContext = `\n\nRECENT TEXT CHAT (separate conversation(s) from this voice call, same owner, touched in the last 24h — background only, not literal history of THIS call):\n${digest}`;
        }
      }
      // FEATURE — reverse direction: "say through text, ask me a question
      // ... later I go on a voice call and it can ask again, 'you never
      // answered that'" — and the mirror case, a question Alfred asked
      // during a voice call going unanswered in text. Applies whenever
      // text chat is NOT itself the voice sandbox conversation, regardless
      // of whether Voice Mode is currently open.
      let voiceSandboxContext = "";
      {
        const sandboxId = (settings as any)?.voiceSandboxConversationId;
        if (sandboxId && activeId !== sandboxId) {
          const sandboxConv = conversations.find(c => c.id === sandboxId);
          if (sandboxConv?.messages?.length) {
            const tail = sandboxConv.messages.slice(-6).map((m: any) => `${m.role === "user" ? "Owner" : "Alfred"}: ${String(m.content || "").slice(0, 200)}`).join("\n");
            voiceSandboxContext = `\n\nRECENT VOICE CALL (Alfred's separate hands-free voice conversation with this same owner — background only; if something there — especially a question Alfred asked — never got a reply and this message looks related, you can naturally follow up on it):\n${tail}`;
          }
        }
      }
      const voiceModeContext = voiceModeOpenRef.current
        ? "\n\nVOICE MODE: this message arrived through a live, hands-free SPOKEN conversation (speech-to-text in, text-to-speech out) — not the text chat. Reply in natural, flowing spoken sentences only: no markdown, no bullet points, no asterisks, no headers, nothing that only makes sense written down. Keep it conversational and reasonably brief, like a real phone call, unless the owner clearly wants more detail. If this message is a casual opener (\"hey\", \"how's it going\", \"what's up\", or similar small talk) rather than a specific request, warmly greet the owner (by name if you know it), give a brief natural-sounding rundown of today's business from the snapshot below, and ask what they'd like to do — don't wait to be asked for a summary." + screenContext + crossConversationContext
        : "";
      // FEATURE — "each company should have their own work-order email
      // identity — Alfred learns it from Settings, not a generic default."
      const woTmpl = (settings as any)?.workOrderEmailTemplate;
      const workOrderStyleContext = woTmpl
        ? "\n\nWork order email style for this business (use when calling generate_work_order_summary): " +
          [woTmpl.subject ? `default subject template "${woTmpl.subject}"` : "", woTmpl.instructions ? `instructions: ${woTmpl.instructions}` : "", woTmpl.maxWords ? `keep it under ${woTmpl.maxWords} words` : ""].filter(Boolean).join("; ")
        : "";
      const vacInfo = (settings as any)?.vacationMode;
      const vacIsOut = vacInfo?.active && today() >= vacInfo.startDate && today() <= vacInfo.endDate;
      const vacationContext = vacInfo?.active
        ? `\n\nVACATION MODE: ${vacIsOut ? "CURRENTLY ACTIVE" : "scheduled"} — owner is out ${vacInfo.startDate} to ${vacInfo.endDate}. Autonomy level: ${vacInfo.autonomyLevel} (manage_everything = act on the owner's behalf without asking; ask_first = prepare/draft things but don't send/commit without the owner's OK; hold_everything = do nothing proactive, just take messages). Check-in frequency the owner wants: ${vacInfo.checkInFrequency}.${vacInfo.notes ? " Owner's notes: " + vacInfo.notes : ""} Let this shape how you act while vacation mode is active, and mention it if relevant.`
        // FEATURE — "when users sign up, ask how much permission to give the
        // AI assistant." Signup wizard sets settings.alfredAutonomyLevel as
        // a general, always-on default (same three-tier scale vacation
        // mode's own autonomyLevel already uses) — this is what governs
        // Alfred's baseline behavior the rest of the time, since vacation
        // mode's own autonomyLevel only applies while it's actually active.
        : `\n\nGENERAL AUTONOMY LEVEL (owner's standing preference, set at signup, changeable in Settings): ${(settings as any)?.alfredAutonomyLevel || "ask_first"} (manage_everything = act on the owner's behalf without asking first; ask_first = prepare/draft things — estimates, messages, schedule changes — but confirm with the owner before sending/committing anything customer-facing or irreversible; hold_everything = don't take proactive action, just answer questions and take messages). VACATION MODE: not set. If the owner mentions going on vacation, being out, or unreachable, walk them through set_vacation_mode conversationally (see tool description) rather than guessing any of its fields.`;
      // BUG FIX — this used to check only settings.googleConnected, a
      // React-state flag that can lag behind the real connection state (see
      // getStoredGoogleConnection() in lib/supabase.ts), which is why Alfred
      // could tell the user "not connected" while Settings/Workspace showed
      // Connected. send_email_via_gmail now sends directly via the same
      // browser-side Gmail API call every other real send in this app uses
      // (see its case above) — no backend URL is needed or exists.
      const storedGoogle = getStoredGoogleConnection();
      const googleActuallyConnected = !!(storedGoogle?.token || (settings.googleConnected && settings.googleProviderToken));
      const googleStatus = googleActuallyConnected
        ? `\n\nGoogle Workspace: CONNECTED as ${storedGoogle?.email || settings.googleEmail}. You CAN use send_email_via_gmail to send real email right now. create_calendar_event/create_google_task/upload_to_drive still require a configured backend URL and will stage for later if one isn't set.`
        : `\n\nGoogle Workspace: NOT CONNECTED. If the user asks to send email, create calendar events, or manage tasks, tell them to go to Settings → Integrations → Google and connect.`;
      const toolHint = `\n\nFORMATTING: never use markdown — no asterisks for bold/italic (**text** or *text*), no # headers, no markdown bullet/numbered lists. This chat renders plain text only, so markdown symbols show up as literal stray characters like stray asterisks. Write in plain sentences; if you need to list things, use plain lines like "1) ..." or a line break between items, never *, **, -, or #.\n\nCASUAL CONVERSATION: the user can talk to you like a person, not just issue commands — small talk, a joke, venting, a random off-topic question. Actually engage with it in your own personality's voice; never refuse or deflect with something like "I'm not programmed for that" — you're not limited to business tasks, tools are just what you reach for when a request actually needs one. The RESPONSE STYLE/TASK RESULT REPORTING rules below govern how you report a TOOL ACTION's outcome specifically — they don't apply to ordinary conversation, and nothing about them means refusing to chat.\n\nYou have tools available to READ and MODIFY the CRM. USE THEM AGGRESSIVELY — don't just describe what you would do, actually do it.\n\nASK WHEN INFO IS MISSING: using tools aggressively does NOT mean guessing or silently defaulting a value the user never gave you. If a request is missing something a tool actually needs to act correctly — which customer, which date, which employee to assign — ask one short, direct clarifying question instead of calling the tool with a made-up or silently-defaulted value (e.g. schedule_job will default an unspecified date to a few days out — do not let that fire silently; ask "what date?" first if the user didn't give one). Only skip asking when the missing piece has an obviously safe default (e.g. a walkthrough with no stated time) or a tool's own fuzzy-match/suggestions can resolve it on its own (e.g. a slightly misspelled customer name).\n\nRESPONSE STYLE: Do not narrate your reasoning, your plan, or which tool you're about to call ("Let me check...", "I'll create that now...", "First I need to..."). Just call the tool(s) silently and then give the user the final result in 1-3 short sentences. No step-by-step thinking out loud.\n\nVERIFY BEFORE CONFIRMING: every action tool returns either {"success": true, ...} or {"error": "..."}. NEVER say "Done" or "All set" without checking which one came back. If you see an "error" field, tell the user exactly what went wrong and what they could try instead — do not pretend it worked, and do not retry silently. Only confirm success when the tool result actually contains "success": true. NEVER quote a raw database/technical error verbatim (e.g. "could not find the table 'public.x' in the schema cache", a stack trace, a SQL error code) — that means nothing to a business owner. Translate it into one plain sentence about what's actually affected, or if it's from a side check unrelated to what they actually asked (e.g. a background history lookup during a scheduling request), just skip mentioning it and proceed with the real task — don't let it derail or clutter an otherwise-unrelated answer.\n\nTASK RESULT REPORTING — NO PERSONALITY FLAIR: your personality (drill sergeant / butler / quiet pro / savage) shapes how you TALK, not whether a task result is reported straight. The moment you report the outcome of an action tool (schedule_job, create_customer, create_estimate, send_estimate, assign/request crew, etc.), drop the persona voice entirely and state the plain fact: "Job scheduled successfully" / "Failed — [exact error text]" / "Estimate sent to [name] successfully" / "Failed — [exact error text]". No jokes, no military barking, no "sir", no sarcasm on the result line itself — save the personality for ordinary conversation, small talk, and check-ins, never for whether something actually saved.\n\nKEY TOOL RULES:\n- Customer queries → USE search_customers or get_customer_details FIRST\n- Stats requests → USE get_business_stats\n- "What's on the calendar" → USE get_calendar_summary\n- "Who's clocked in / who's working" → USE get_employee_status\n- "Remember/note/don't forget" → USE remember_fact\n- Create estimates, customers, jobs → USE create_estimate/create_customer/schedule_job
- MULTI-STEP CHAINS (e.g. "create a customer, schedule them a job, and assign Mike"): call tools ONE AT A TIME across separate turns when a later step needs an id/result a real tool call hasn't returned yet (e.g. schedule_job needs the customerId create_customer just returned). Do NOT guess or fabricate an id and call multiple dependent tools in the same turn — wait for each real tool_result before issuing the next dependent call. If a step's result is an "error", STOP the chain right there, tell the user exactly which step failed and why, and do not attempt the remaining steps with made-up data.
- "Send a quote/estimate to X" → USE create_estimate (if it doesn't exist yet) THEN send_estimate in the same turn — do not just create it and stop, and do not tell the user it was "sent" unless send_estimate actually returned success\n- "Send an invoice to X for $Y" → USE create_invoice THEN send_estimate (pass the returned invoiceId as send_estimate's estimateId) — same two-step pattern as quotes. create_invoice alone does NOT notify the customer.\n- Move or cancel a job → USE reschedule_job/cancel_job\n- "Reschedule X and text/email/let them know" → USE reschedule_job's own \`notify\` param (sms/email/both) in the SAME call — do not call send_reminder separately for this, reschedule_job already handles notifying the customer of their new date.\n- "Add [item] to the checklist" → USE add_checklist_item\n- "Show me the details for X's job" → USE get_job_details\n- "Text/email X and tell them [anything]" → USE send_reminder with the exact wording as the message param — this is not just for payment reminders, use it for any custom message the user dictates\n- NEVER REFUSE TO SEND A MESSAGE: if send_reminder/text_supplier come back "Customer not found" (or similar) because the person isn't in the CRM — a lead, an applicant, a personal contact, anyone — do NOT just report that as a dead end. Ask for their phone number if you don't have it, then USE text_phone_number to send it directly; that tool works for ANY phone number with no customer record required. The owner has full authority to send any message to anyone through their own business number. The only time it's correct to not send something is if you're missing the actual phone number or the exact wording — ask for whichever is missing, then send.\n- After the owner attaches a photo/PDF via the paperclip button and then says to upload/save/attach it to a client → USE attach_file_to_customer (no URL needed, it already knows which file).\n- "Do we have the file/paperwork for X" → USE get_customer_documents. "Text me the [file] for X" → USE text_me_document (real MMS attachment to the owner's own phone, not a description). "What's the card info for X" → USE get_customer_card_info — this only ever returns brand + last 4 digits, never the full number, which is never stored anywhere in this app.\n- "What can you do" / capabilities question → USE list_capabilities and answer from that, don't describe yourself from memory.\n- "Text/message everyone" / "let all my customers know" / any text to more than 2 customers → USE notify_all_customers, which only DRAFTS it: show the owner the numbered list and the sample, ask which to send to, and STOP. After they answer ("all", "not 3", "only 1 and 4"), USE send_bulk_text with their choices. Never send several separate texts to get around this. If the text asks customers a question (birthday, email…), pass watchReplies so answers are saved to their files automatically. Confirm the exact wording first if the owner was vague.\n- WHOLE-CRM QUESTIONS: you can always scan every customer at once — never tell the owner you can only check names they give you. Duplicates → find_duplicate_customers. "Do I have anyone like…" / a vague description → search_customers. "Who's missing info" → customers_missing_info. "Customers who / in / with …" → filter_customers. Report counts first, then the names.
- PERSONAL VS. BUSINESS: when the owner is working through business tasks (jobs, customers, quotes, scheduling), stay on them — don't bring up sleep, workouts, mood or personal reminders. Accountability (get_accountability_summary) is for check-ins, the morning briefing, weekly reflections, or when they ask. Personal reminders ("remind me to call Mom Sunday at 6", "every weekday at 7 remind me to stretch") → USE set_followup_reminder like any other reminder.
- Photos, screenshots or PDFs of receipts, bills, bank/card statements, revenue reports or tax paperwork → once you've read them, USE log_expense for each expense (one per receipt, one per statement line), log_income for money coming in, and remember_fact for tax figures (form, year, totals). Say what you imported with counts and totals.
- "Create a campaign" → USE create_campaign (or notify_all_customers when they want it sent). "Every customer gets a coupon on their birthday" → USE set_birthday_offer; to collect birthdays first, notify_all_customers with onlyMissing "birthday" and watchReplies saveField "birthday".
- Navigate somewhere → USE navigate_to (the app already auto-navigates after schedule_job/create_customer/create_estimate, but call navigate_to yourself for anything else the user asks to see)\n- A simple fact shared in passing ("my slow season is January," "I use Rain-X on windows") → USE remember_fact automatically, no need to confirm first. A STANDING INSTRUCTION about how you should behave going forward is different — see STANDING INSTRUCTIONS below, confirm those before saving.\n- "Remind/nudge/follow up/text me [later/at X time/in X minutes]" → USE set_followup_reminder — this is a REAL scheduled text sent to the owner's own phone, not just a note; resolve the relative time into an exact ISO datetime yourself first. USE list_followup_reminders/cancel_followup_reminder to manage existing ones.\n- RESOLVING "that job" / "the job we just scheduled" / references to something from an earlier message: a tool result's exact jobId/customerId is only visible to you within the SAME turn it was returned — your own past replies (in the chat history) are plain text, not structured data, so they do NOT reliably carry the real id forward. Before calling assign_employee/request_employee/reschedule_job/cancel_job/add_checklist_item on something referenced from an earlier turn, first call list_jobs or get_calendar_summary (or get_job_details with the customer's name) to look up the real current jobId — never guess, reuse an id from your own prior wording, or fabricate one.\n\nAUTOMATION TOOLS (VERY IMPORTANT):\n- When user describes ANY workflow, drip sequence, reminder, or "when X do Y" scenario → USE create_automation IMMEDIATELY. Build a proper n8n-style multi-step workflow with real step types: trigger (first), then delays, conditions, actions. NEVER just describe what you'd build — actually build it with create_automation.\n- "Send review request after job complete" → trigger: Job complete, delay: 2h, action: SMS review request\n- "Follow up on unpaid invoices" → trigger: Invoice unpaid 7 days, action: polite reminder email, delay: 4 days, condition: still unpaid, action: firm SMS\n- To check existing workflows → USE list_automations\n- To enable/disable a workflow → USE toggle_automation\n\nCurrent automations: ${automations.length} total, ${automations.filter(a => a.active).length} active\n\nBULK JOB IMPORT (screenshots or a big pasted block of job/customer data): the owner may hand you several jobs at once — a block of pasted text, or screenshots (these reach you already read: a numbered list of what was found, sent to you as a normal message). Treat every distinct job/order in it as its own create_customer + schedule_job pair — schedule_job's own employeeName param assigns the crew in the SAME call, so you don't need a separate assign_employee call per job. If the batch is trash/garbage can cleaning specifically (the owner says "trash cans", or the screenshots show a can-cleaning route), pass isTrashCan: true on every schedule_job call in the batch — otherwise these jobs won't show up in the owner's dedicated Trash Can Cleaning section, only as generic jobs. create_customer already reuses an existing customer by phone/name match instead of duplicating, so don't worry about exact duplicates. BEFORE calling any of these tools, scan the WHOLE batch for: (a) the same employee named on two or more jobs at the same or overlapping date/time, or (b) any job whose date, time, employee, or order details are genuinely unclear or contradictory. If either is true, create NOTHING yet — ask the owner ONE direct question naming exactly what's ambiguous (e.g. "Mike's on both the Oak St and Elm St jobs at 10am today — Oak first then Elm, or should one go to someone else?") and wait for their reply. BUG FIX (user report — "the response is confusing") — a confirmation question is its own self-contained message, not a continuation of an earlier one the owner has to scroll up to decode: never reference "the repeated Kyle and Josh entries" or "Steve's guessed 10:45 entry" without also saying, right there, WHO/WHAT that is and WHY it's being treated as a duplicate (e.g. "Kyle Hoffman and Josh Willits each appear twice with identical details — I'm treating the second copy of each as a duplicate, not a separate job" — one plain sentence per judgment call, not a dense jargon-packed clause). If you also checked something else first (e.g. whether jobs already exist on that date), report that as its own separate, complete sentence before the confirmation question — don't run the two together as if they're the same thought. Their next message is the answer — treat "go ahead"/"looks good"/"yes" as full confirmation to proceed exactly as extracted, and anything else (a name, a time, an order) as a correction to apply before re-checking for remaining conflicts. If the owner sends something UNRELATED while a batch confirmation is still pending (e.g. "also add this other customer for tomorrow"), answer that new request on its own — do not re-paste the entire pending batch/conflict summary again as if starting over; one short reminder line that it's still waiting ("still holding on the trash-can batch — need the info above to move on it") is enough. Repeating the full confirmation verbatim across several messages just because something else came up in between is confusing, not thorough. Once everything is confirmed, create every customer and job in the batch; when the owner confirms an order for one employee's day but didn't give exact times, space that employee's jobs by a sensible gap (e.g. 45-60 min, or the job's own duration if known) so their schedule/route in the field portal reflects the right order. Report back with ONE summary line — how many customers and jobs were created — not a play-by-play of each tool call.\n\nSTANDING INSTRUCTIONS ("from now on...", "always...", "never...", "don't ever...", "stop doing X", "ask me first before X", "you can handle X on your own now"): the owner can change how you behave going forward, not just ask for a one-off action. Recognize this phrasing and handle it in two steps — never save or change anything on the first message alone:
1. Figure out what it actually maps to. A broad statement about how much you can do without checking in first ("always ask before you do anything," "just handle things yourself from now on," "don't text customers without asking me") is the STANDING AUTONOMY LEVEL → use set_autonomy_level (manage_everything/ask_first/hold_everything). A narrower, specific standing rule that isn't about your overall autonomy ("always give repeat customers 10% off," "never schedule jobs on Sundays," "don't offer the trash-can add-on unless they ask") → use remember_fact with category "preferences", worded as a rule you'll follow, not a diary entry. If they're describing a temporary absence ("I'm out next week"), that's set_vacation_mode instead, not a standing instruction.
2. CONFIRM before committing — restate the rule in plain English as a direct yes/no question ("So from now on, you want me to always ask before texting a customer about a price change — is that right?") and wait for their reply. Treat "yes"/"correct"/"that's right"/a simple confirmation as the go-ahead to call the tool; treat anything else as a correction — fold it in and confirm again before saving. This applies even at high autonomy levels — a standing behavioral change is exactly the kind of thing worth one confirmation, autonomy level governs day-to-day ACTIONS, not rewriting your own standing rules.
Once saved, a remembered preference or the current autonomy level is a BINDING constraint on every future turn, not background flavor text — actually check it before acting, especially before texting/emailing a customer, applying a discount, or scheduling something the rule speaks to. If a saved rule and the owner's current message conflict, the current message wins for this one action, but don't silently update the standing rule to match — ask if they want the rule itself changed too.

CUSTOMER TEXTING — PER-CUSTOMER SETTINGS ARE REAL, NOT ADVISORY: a customer's smsOptOut flag (visible on search_customers/get_customer_details results) is enforced by every texting tool now — attempting to SMS an opted-out customer returns an error/warning instead of sending, so you will never silently succeed at texting someone who opted out. Still check it yourself before calling a texting tool when you already have the customer's record in context this turn: don't make the owner discover the opt-out from a tool error you could have already told them about. If a customer's "notes" field mentions a communication preference ("prefers email," "call, don't text," "spouse handles texts") treat that the same as a standing instruction for that one customer — follow it even if the owner didn't restate it in this conversation, and mention it if it changes what you're about to do (e.g. "Sarah's notes say she prefers email, so I sent it that way instead of texting — let me know if you want it texted anyway").

NAME MATCHING: if a tool result comes back with "error": "Customer not found" or "Employee not found" and includes a "suggestions" array, ask the user "Do you mean [name], or [name]?" using those exact suggested names — never ask a generic clarifying question like "who do you mean?" when real candidate names are available.

UNDO REQUESTS: if the owner says "undo that", "undo it", "delete those", "change them back", "what did you do", "what did you just do", or similar — this works across sessions, not just the current conversation: an action from 5 minutes ago or from yesterday is still undoable as long as nothing since has already reversed it. "What did you do" / "what have you done recently" → USE list_recent_actions and answer from its real results, don't guess from memory of this conversation alone (a new session has no memory of an earlier one, but the action history does). "Undo that" for a single recent thing, or "undo those"/"delete those" for a batch (e.g. several jobs just created from screenshots) — if you're not sure exactly what "those" refers to or how many, call list_recent_actions first to see what's actually there. Either way, do NOT call undo_last_action immediately: first confirm exactly what you're about to reverse in plain English ("Wait — you want me to undo scheduling that job for Sarah on 2026-09-30?", or for a batch, name the count and what they are — "Wait — you want me to undo all 5 jobs you just had me create from those screenshots?"). Only once they confirm, call undo_last_action (pass count for a batch). If they say no, or clarify they meant something else, don't call it.`;
      const baseSystemPrompt = getPersonality(activePersonality).systemPrompt + dateContext + memoryContext + crossChannelContext + voiceSandboxContext + businessContext + workOrderStyleContext + vacationContext + googleStatus + voiceModeContext + fileContext;
      const systemPrompt = baseSystemPrompt + toolHint;
      // BUG FIX (root cause, not another pattern-match) — a non-tool-capable
      // model (OpenRouter's free tier) was STILL being handed the full
      // toolHint, which aggressively instructs "USE THEM AGGRESSIVELY —
      // don't just describe what you would do, actually do it" and lists
      // every tool by name — even though that model has no `tools` param at
      // all and physically cannot call anything. It kept inventing new fake
      // -call syntaxes to comply ("name(args)", "name → arg: ...", etc.),
      // and each new phrasing needed its own detection patch. Instead: a
      // model with no tool support just never gets told tools exist. It
      // gets a plain instruction to answer honestly and say so if the
      // request needs a real action — which is what the owner actually
      // asked for ("even if it can't do something, it should respond in
      // plain English").
      const noToolsPrompt = baseSystemPrompt + `\n\nNOTE: you do NOT have the ability to call any tools/functions on this turn — there is no tool-calling mechanism available to you right now. Never write out what a tool call would look like (no "search_customers(...)", no "search_customers → query: ...", no pseudo-code of any kind) — that text does nothing and just wastes the owner's time. If the request needs a real action (searching records, scheduling a job, sending a message, creating an estimate, etc.), plainly tell the owner you can't perform that action with the AI model currently in use, and suggest picking a different one in Settings → AI Models. For anything that's just conversation or a question you can actually answer from what you already know, respond normally and honestly in plain English.`;
      console.log("[Personality] systemPrompt personality clause:", getPersonality(activePersonality).systemPrompt.slice(0, 80) + "…");

      // Build initial message list — allow multi-turn tool calls up to 5 rounds
      let convMessages = [...chats, userMsg].slice(-12).map(m => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      let rounds = 0;
      let finalText = "";
      const toolTraces = [];
      let modelUsed = settings.activeModel || "claude";
      const failoverChain = [];

      // FIX 20 — this used to try settings.activeModel FIRST, no matter what
      // order the owner configured in Settings → AI Models, and only fall
      // back to `priority` for everything after that — so setting Gemini
      // first in the priority list did nothing as long as activeModel was
      // still "claude" (its default). The failover chain must be the EXACT
      // order from settings.modelPriority; activeModel no longer jumps the
      // queue. Locked (rate-limited) models are excluded from the initial
      // list but will be detected mid-chain.
      const priority = settings.modelPriority || ["claude", "openai", "gemini", "groq", "mistral"];
      const now = Date.now();
      const MODELS_MAP: any = MODELS;
      // Also include any model with a valid key not in the priority list (e.g. OpenRouter, NVIDIA models)
      const extraModels = Object.keys(MODELS_MAP).filter(mid => {
        if (priority.includes(mid)) return false;
        const m = MODELS_MAP[mid];
        return m && m.needsKey && !!(settings.modelKeys || {})[mid];
      });
      const tryOrder = [...priority, ...extraModels];
      const viableModelsAll = tryOrder.filter(mid => {
        const m = MODELS_MAP[mid];
        if (!m) return false;
        if (m.needsKey && !(settings.modelKeys || {})[mid]) return false; // no key
        const status: any = modelStatus[mid];
        if (status && status.lockedUntil && status.lockedUntil > now) return false; // locked out
        return true;
      });
      // BUG FIX — "search_customers {...}" showed up as Alfred's literal
      // TEXT reply instead of actually running. Root cause: failover landed
      // on a model marked supportsTools:false (e.g. OpenRouter's free
      // Llama), which gets called with no `tools` param at all — but the
      // system prompt still describes every tool and instructs Alfred to
      // use them, so a model with no real function-calling capability just
      // echoes back what LOOKS like a tool call as plain text, then stops,
      // silently failing the entire request. Alfred's whole point is
      // taking real actions — a model that can't call tools should only
      // ever be a last resort, not a normal failover step. Prefer
      // tool-capable models — BUT deprioritize, don't DROP, non-tool ones.
      // The original version filtered viableModelsAll down to toolCapable
      // ONLY whenever any tool-capable model had a key — which silently
      // removed the owner's explicitly-chosen model (e.g. OpenRouter,
      // reordered to the front via the model picker or "switch to
      // OpenRouter") from the chain entirely as long as Gemini/NVIDIA also
      // had keys, even though those kept failing (rate limit/CORS) every
      // single message. Keep every viable model in the chain; just sort
      // tool-capable ones first, non-tool ones after — and always respect
      // the owner's explicit #1 pick as the actual first attempt.
      const toolCapable = viableModelsAll.filter(mid => MODELS_MAP[mid]?.supportsTools);
      const nonToolCapable = viableModelsAll.filter(mid => !MODELS_MAP[mid]?.supportsTools);
      let viableModels = [...toolCapable, ...nonToolCapable];
      const explicitFirst = priority[0];
      // BUG FIX — a non-tool-capable explicit pick (e.g. OpenRouter's free
      // tier) jumping the queue "worked" a little TOO well: with the
      // no-tools system prompt fix, it now honestly replies "I can't do
      // that with this model, try switching" instead of faking success —
      // which is a clean, valid response, so the chain stopped right there
      // and never even tried Gemini/NVIDIA, which actually could have done
      // it. The owner's explicit pick should still lead when it's
      // tool-capable, or when it's genuinely the only option — but when
      // real tool-capable models are also available, they get first crack
      // at ACTUALLY doing the task; the explicit non-tool pick becomes the
      // fallback (still tried, just not blocking a real attempt first).
      const explicitIsToolCapable = !!MODELS_MAP[explicitFirst]?.supportsTools;
      if (explicitFirst && viableModelsAll.includes(explicitFirst) && viableModels[0] !== explicitFirst && (explicitIsToolCapable || toolCapable.length === 0)) {
        viableModels = [explicitFirst, ...viableModels.filter(mid => mid !== explicitFirst)];
      }
      if (viableModels.length === 0) {
        const lockedWithKey = tryOrder.filter(mid => {
          const m = MODELS_MAP[mid];
          if (!m || (m.needsKey && !(settings.modelKeys || {})[mid])) return false;
          const status: any = modelStatus[mid];
          return status?.lockedUntil > now;
        });
        if (lockedWithKey.length > 0) {
          const soonest = lockedWithKey.map(mid => (modelStatus[mid] as any)?.lockedUntil).sort()[0];
          const wait = Math.ceil((soonest - now) / 60000);
          const lines = lockedWithKey.map(mid => {
            const rem = Math.ceil(((modelStatus[mid] as any)?.lockedUntil - now) / 60000);
            return `• ${MODELS_MAP[mid]?.name || mid}: rate-limited, resets in ~${rem}m`;
          });
          throw new Error("All models are rate-limited:\n" + lines.join("\n") + `\n\nSoonest reset: ~${wait} min. You can unlock manually in Settings → AI Models.`);
        }
        throw new Error("No AI models available. Go to Settings → AI Models and add at least one API key (Claude, Gemini, OpenAI, Groq, or Mistral).");
      }
      // Always try all viable models in order — failoverEnabled controls whether non-rate-limit errors cascade
      const chain = viableModels;

      const abortController = new AbortController();
      currentAbortControllerRef.current = abortController;
      let stopped = false;
      let success = false;
      for (const mid of chain) {
        try {
          modelUsed = mid;
          rounds = 0;
          // Reset convo for this attempt
          let localConv = [...convMessages];
          let localFinal = "";
          const localTraces = [];
          // 12 rounds / 8k tokens / 60s: a message with 50 customers and
          // their own instructions is dozens of tool calls (5 rounds × 1,500
          // tokens used to stop partway through).
          while (rounds < 12) {
            rounds++;
            // BUG FIX (user report) — "you literally still can't stop
            // Alfred from responding mid-conversation." abortController
            // was only ever checked inside the catch block below, i.e.
            // only while a model fetch was actually the thing in flight.
            // Most of a tool-calling turn's time is spent EXECUTING tools
            // (real Supabase calls, not abortable) or between rounds —
            // pressing Stop during any of that silently did nothing, the
            // loop kept going, and the real reply still showed up. Re-check
            // at the top of every round too.
            if (abortController.signal.aborted) { stopped = true; break; }
            const toolsForModel = MODELS_MAP[mid]?.supportsTools ? toolDefinitions : undefined;
            // BUG FIX — callModel had NO timeout at all. If a provider's API
            // just hangs (no response, no error — happens for real on flaky
            // connections or an overloaded endpoint that never actually
            // 503s), the whole request sat frozen forever with no failover
            // to the next model in the chain and no error shown — this is
            // almost certainly what "most of the time it says the request
            // timed out" actually was: not Alfred reporting a clean timeout,
            // but the UI eventually giving up after a very long hang.
            // Wrapping it in withTimeout means a hung provider now correctly
            // fails over to the next model within 25s, same as every other
            // async action in this app already does per docs/ARCHITECTURE.md.
            // Same budget as functions/api/call-model.ts: 45s for a normal
            // message, more for a big one (a pasted client list), plus time
            // for its NVIDIA/OpenRouter fallbacks — a flat 60s here cut off
            // big imports the server was still waiting on.
            const reqSystem = toolsForModel ? systemPrompt : noToolsPrompt;
            const reqSize = reqSystem.length + JSON.stringify(localConv).length + JSON.stringify(toolsForModel || []).length;
            const serverFirstMs = Math.min(110000, 45000 + Math.floor(reqSize / 1000) * 1000);
            const provider = MODELS_MAP[mid]?.provider;
            const clientTimeoutMs = serverFirstMs + (provider === "nvidia" ? 90000 : provider === "openrouter" ? 60000 : 15000);
            const result: any = await withTimeout<any>((callModel as any)({
              modelId: mid,
              apiKey: (settings.modelKeys || {})[mid],
              systemPrompt: reqSystem,
              messages: localConv,
              tools: toolsForModel,
              maxTokens: Math.min(8192, MODELS_MAP[mid]?.maxTokens || 4096),
              signal: abortController.signal,
            }), clientTimeoutMs, MODELS_MAP[mid]?.name || mid);
            console.log("[AlfredModel] round", rounds, "model:", mid, "stopReason:", result.stopReason, "toolUses:", (result.toolUses || []).map((tu: any) => tu.name), "textPreview:", (result.text || "").slice(0, 120));
            // BUG FIX — a non-tool-capable model (e.g. OpenRouter's free
            // tier) has no `tools` param sent, but the system prompt still
            // describes every tool by name — so instead of a real function
            // call it just prints text that LOOKS like one, e.g.
            // `search_customers(query="...")`, with a clean end_turn. That
            // used to be accepted as a legit final answer, silently failing
            // the actual request (nothing gets scheduled/searched) while
            // looking successful. Detect the fake-call shape and fail this
            // model over to the next one instead of returning it to the
            // owner as if Alfred actually did something.
            // BUG FIX (cont'd) — the fixed-syntax regex above only caught
            // `name(args)`. The same model also fakes calls as
            // `search_customers → query: "..."`, `Calling search_customers...`,
            // etc. — there's no fixed shape a model like this settles on. The
            // most reliable signal: ANY short response that starts with one
            // of Alfred's actual tool names is it narrating a fake call,
            // never a real final answer to the owner. Not gated to
            // `!toolsForModel` — a model marked supportsTools:true whose
            // provider integration turns out not to actually honor tool
            // calls (a bad flag, a schema mismatch, a provider-side quirk)
            // would otherwise hit this exact failure silently too. This is
            // a safety net for every provider, not just known non-tool ones.
            const trimmedResultText = (result.text || "").trim();
            const fakesToolCall = trimmedResultText.length > 0 && trimmedResultText.length < 300 &&
              toolDefinitions.some((td: any) => new RegExp(`(^|[\\s\`*"'([]) ?${td.name}\\b`, "i").test(trimmedResultText));
            if (fakesToolCall) {
              throw new Error(`${MODELS_MAP[mid]?.name || mid} tried to fake a tool call as text instead of actually acting.`);
            }
            // BUG FIX — a completely empty response (no text, no tool call,
            // just a clean end_turn) also got accepted as "success," and the
            // UI's `if (!finalText) finalText = "Done."` fallback then showed
            // the owner a cheerful "Done." even though nothing happened at
            // all. An empty non-answer is never a valid final response —
            // fail it over to the next model instead of pretending it is one.
            if (result.stopReason !== "tool_use" && result.toolUses.length === 0 && !(result.text || "").trim()) {
              throw new Error(`${MODELS_MAP[mid]?.name || mid} returned an empty response.`);
            }
            if (result.text) localFinal = result.text;
            if (result.toolUses.length > 0 && result.stopReason === "tool_use" && toolsForModel) {
              localConv.push({ role: "assistant", content: result.raw });
              // BUG FIX — general safety net alongside the specific
              // schedule_job fix above: any one of the ~30 tools having its
              // own unguarded await (a Supabase call with no withTimeout)
              // would hang this entire round with no way out, no matter
              // which AI model triggered it. Cap each tool call individually
              // so a single bad one reports a clear timeout error back to
              // the model (which can then tell the user plainly) instead of
              // freezing the whole conversation.
              const toolResults = await Promise.all(result.toolUses.map(async tu => {
                const r = await withTimeout<any>(executeTool(tu.name, tu.input || {}), 30000, tu.name)
                  .catch((e: any) => ({ error: (e?.message || String(e)) + " — the action may or may not have actually completed; check the relevant page before retrying." }));
                localTraces.push({ tool: tu.name, input: tu.input, result: r });
                return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(r) };
              }));
              localConv.push({ role: "user", content: toolResults });
              // Re-check right after tool execution too — the tools
              // themselves can take real time (Supabase writes), and a
              // Stop pressed during that window needs to actually land
              // before the next model round fires.
              if (abortController.signal.aborted) { stopped = true; break; }
              continue;
            }
            break;
          }
          if (stopped) break;
          // Success: commit
          finalText = localFinal;
          toolTraces.push(...localTraces);
          success = true;
          // Clear any stale lockout for this model since it just worked
          if (modelStatus[mid]) setModelStatus(s => { const n = { ...s }; delete n[mid]; return n; });
          break;
        } catch (err) {
          // FEATURE — "no button to stop Alfred mid-chat." A user-triggered
          // abort must never look like a model failure — no failover to the
          // next model in the chain (defeats the point of stopping), no
          // "X failed, trying next" toast, no lockout/cooldown recorded.
          if (abortController.signal.aborted || (err as any)?.name === "AbortError") {
            stopped = true;
            break;
          }
          failoverChain.push({ model: mid, error: err.message });
          const rateLimit = (parseRateLimitError as any)(err, mid);
          const isLast = chain.indexOf(mid) === chain.length - 1;
          if (rateLimit) {
            setModelStatus(s => ({ ...s, [mid]: { lockedUntil: rateLimit.lockedUntil, lastError: err.message, since: Date.now() } }));
            toast((MODELS_MAP[mid]?.name || mid) + " rate-limited" + (!isLast ? " — trying next" : ""), "error");
          } else if (isLast) {
            // last in chain and not rate-limit — bubble up so outer catch shows a red error bubble
            throw err;
          } else {
            const overloaded = (err as any)?.status === 503 || /overloaded|503/i.test(err.message || "");
            // BUG FIX — a persistent non-rate-limit failure (a browser CORS
            // block on a provider that doesn't support direct browser calls
            // — e.g. NVIDIA's NIM API — an invalid/expired key, a
            // deprecated model) previously got no lockout at all, only
            // rate-limit errors did (above). That meant the same broken
            // model was retried from scratch on EVERY message, failing and
            // re-toasting every time — which is what made "priority order
            // ignored" and "failed over to X repeatedly" both look broken,
            // when the real issue was one specific model in the chain never
            // backing off. Give any failure a short cooldown so a broken
            // model steps aside for the rest of the chain, while still
            // retrying periodically in case it was transient.
            setModelStatus(s => ({ ...s, [mid]: { lockedUntil: Date.now() + 5 * 60000, lastError: err.message, since: Date.now() } }));
            toast((MODELS_MAP[mid]?.name || mid) + (overloaded ? " overloaded — auto-switching to next model" : " failed — trying next"), "error");
          }
          // continue to next model
        }
      }

      // FEATURE — "no button to stop Alfred mid-chat." Report a stop
      // plainly and stop here — no failover error message, no TTS, no
      // push-notification-while-away (all further down this same try
      // block), since the owner deliberately interrupted this turn.
      if (stopped) {
        currentAbortControllerRef.current = null;
        appendMessage({ id: uid(), role: "alfred", content: "Stopped.", timestamp: Date.now() });
        return;
      }

      if (!success) {
        // Build a clear, actionable error message
        const lockedModels = Object.entries(modelStatus).filter(([_, s]) => (s as any)?.lockedUntil > Date.now());
        const allCorsBlocked = failoverChain.length > 0 && failoverChain.every(f => /failed to fetch|cors|network/i.test(f.error));

        const geminiLocked = lockedModels.some(([mid]) => mid === "gemini");
        let errorMsg;
        if (allCorsBlocked) {
          errorMsg = "All third-party AI providers blocked your browser request (CORS).\n\n💡 Fix: Use Claude (the only built-in model) — it works without a backend.\n\nThe other providers (OpenAI, Gemini, Groq, Mistral, MiniMax) need a backend proxy to work in a browser. Their API keys are stored, but the calls fail at the network layer.";
        } else if (lockedModels.length === priority.length) {
          const soonest = lockedModels.map(([_, s]) => (s as any).lockedUntil).sort()[0];
          const wait = Math.ceil((soonest - Date.now()) / 60000);
          if (geminiLocked && lockedModels.length === 1) {
            errorMsg = "Gemini's daily quota is exhausted.\n\n⏱ Resets in ~" + wait + " min (Google resets at midnight Pacific)\n\n💡 Options:\n• Wait for the quota to reset\n• Add a Claude API key (console.anthropic.com) — no quota issues\n• Add an OpenRouter key (openrouter.ai/keys) — free, tool-capable, and not tied to Gemini's quota\n• Use slash commands (/status, /route, /rollcall) — they work without any AI key";
          } else {
            errorMsg = "All models are rate-limited.\n\n⏱ Soonest reset: ~" + wait + " min\n\n💡 Options:\n• Wait for quota to reset\n• Add a Claude API key in Settings → AI Models\n• Use slash commands (/status, /route, /rollcall) — they work without any AI key\n• Unlock a model manually in Settings → AI Models → Reset now";
          }
        } else {
          errorMsg = "Tried " + failoverChain.length + " model(s):\n" + failoverChain.map(f => "• " + (MODELS_MAP[f.model]?.name || f.model) + ": " + f.error).join("\n");
          if (geminiLocked) errorMsg += "\n\n💡 Gemini's daily quota is exhausted. Add a Claude or OpenRouter key in Settings → AI Models, or wait for Gemini to reset (midnight Pacific).";
          if (!Object.values(MODELS_MAP).some((m: any) => m.needsKey && !!(settings.modelKeys || {})[m.id])) {
            errorMsg += "\n\n💡 No API keys set. Add a Claude, Gemini, or OpenRouter key in Settings → AI Models.";
          }
        }
        throw new Error(errorMsg);
      }

      // Fire once per turn, after every tool call this turn has already
      // run — this is what actually consolidates N per-job assignment
      // emails into one summary (see pendingAssignmentEmailsRef's comment).
      if (Object.keys(pendingAssignmentEmailsRef.current).length > 0) flushAssignmentEmails().catch(() => {});

      if (!finalText) finalText = "Done.";
      // Only show the final answer — no self-identifying model footer (it was
      // showing up redundantly) and no tool-trace text appended to the visible
      // message. modelUsed/toolTraces/failoverChain are still stored as
      // metadata on the message in case something else needs them later; they
      // just aren't concatenated into the displayed text anymore. A failover
      // is the one thing still worth surfacing, since it explains why the
      // response might read differently than usual.
      // BUG FIX (user report) — "Alfred still responds with asterisks."
      // Paired-marker stripping (**bold**/*italic*) missed markdown bullet
      // lists ("* Point one\n* Point two...") — an ODD number of single
      // asterisks in the text left one unpaired and un-stripped, which is
      // exactly the inconsistent "sometimes still has one" symptom. The
      // owner's ask is literal — never any asterisk — so after unwrapping
      // real bold/italic text, blanket-remove every asterisk left over.
      let displayText = finalText.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\*/g, "");
      if (modelUsed !== (settings.activeModel || "claude") && !failoverNoticeShownRef.current.has(activeId)) {
        failoverNoticeShownRef.current.add(activeId);
        toast("Your first AI choice didn't answer — used " + (MODELS_MAP[modelUsed]?.name || modelUsed) + " instead", "yellow");
      }
      const alfredMsgId = uid();
      appendMessage({ id: alfredMsgId, role: "alfred", content: displayText, timestamp: Date.now(), toolTraces, modelUsed, failoverChain });

      // FEATURE — "if I message Alfred and go out of the app, and Alfred
      // responds while I'm not in it, it should give a notification... if I
      // click on it it takes me to the chat." isActivePage (already passed
      // in — true only while the owner is actually looking at THIS page,
      // not just this browser tab) plus document.hidden (tab backgrounded/
      // minimized/screen off) together cover both ways of "not in it."
      // Never fires during a live voice call — the owner is right there.
      if (!voiceModeOpenRef.current && ownerId && (!isActivePage || document.hidden)) {
        sendPushNotification({
          ownerId,
          title: "Alfred replied",
          body: displayText.replace(/\n+/g, " ").slice(0, 140),
          url: "/#/alfred",
          tag: "alfred-reply",
        }).catch(() => {});
      }

      // TTS — read Alfred's response aloud when enabled, or always in Voice
      // Mode (a hands-free conversation with no toggle to check). Refactored
      // into the shared speakAloud() helper (free browser voice, picks a
      // real British one when the OS has one installed — see its own
      // comment) so Voice Mode's listen-loop can await the SAME completion
      // signal a plain chat reply's speech uses, instead of duplicating this.
      if (settings.ttsEnabled || voiceModeOpenRef.current) {
        // turnId captured NOW (before speaking starts) — if a barge-in
        // abandons this reply while it's talking, voiceTurnIdRef will have
        // moved on by the time this promise resolves, and this completion
        // correctly no-ops instead of firing the wrong (or a duplicate)
        // resume. See voiceTurnIdRef's own comment for the full reasoning.
        const speakingTurnId = voiceTurnIdRef.current;
        if (voiceModeOpenRef.current) {
          setVoiceModeState("speaking");
          startInterruptListener(finalText);
          // Progressive reveal — see speakProgressively's own comment.
          // Starts the transcript bubble empty and grows it sentence by
          // sentence exactly as each one starts playing; guarantees the
          // FULL text is what's actually stored once done (or abandoned),
          // regardless of how far the reveal got.
          updateMessageContent(alfredMsgId, "");
          speakProgressively(finalText, alfredMsgId, speakingTurnId, settings.elevenlabsKey).then(() => {
            updateMessageContent(alfredMsgId, displayText);
            if (voiceModeOpenRef.current && voiceTurnIdRef.current === speakingTurnId) ttsEndCallbackRef.current?.();
          });
        } else {
          speakAloud(finalText, settings.elevenlabsKey);
        }
      }

      // Explicit, user-signaled memory shortcut — the ONLY text-pattern
      // auto-save left. The user must deliberately start a message with
      // "remember"/"note that"/"don't forget", so this can't misfire on
      // ordinary conversation the way the removed heuristic below did.
      if (/^(remember (that |this:? ?)?|note that |don'?t forget )/i.test(text)) {
        const fact = text.replace(/^(remember (that |this:? ?)?|note that |don'?t forget )/i, "").trim();
        if (fact && !memory.some(m => m.text.toLowerCase() === fact.toLowerCase())) {
          setMemory(m => [...m, { id: uid(), text: fact, category: "general", createdAt: today() }]);
          toast("Saved to memory");
        }
      }
      // REMOVED — "the memory system randomly adds random stuff." This
      // block auto-saved ANY message matching broad patterns like
      // /i (never|don'?t|can'?t) (.+)/ or /i (prefer|like|want|need) (.+)/
      // as a permanent memory — which matches enormous swaths of completely
      // ordinary conversation ("I don't know", "I can't find that
      // customer", "I want to schedule a job Tuesday") with no way to tell
      // a genuine standing preference apart from a one-off sentence. Every
      // stored memory (see memoryContext below) gets injected verbatim into
      // EVERY future conversation's system prompt, so this was silently
      // polluting Alfred's context on every single message going forward —
      // exactly "random stuff" appearing in memory. Replaced with real
      // remember/recall/set_standing_preference TOOLS (see executeTool and
      // the tool definitions below) — the model decides, using actual
      // judgment about what the owner actually wants remembered, the same
      // pattern alfredSmsAgent.ts (the SMS channel) already used correctly.
      // A one-time cleanup effect (below, on mount) removes the bad
      // `autoLearned: true` rows this block already created.
    } catch (err) {
      reportAlfredError(err, { retryText: opts?.skipVisibleMessage ? undefined : text });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { sendRef.current = send; }); // no deps — always the latest send, see sendRef's comment

  // BUG FIX (user report) — "it still sends the file before I press send...
  // should never send until you actually press send." This is the deferred
  // version of what used to run the instant a file was picked (same
  // prompts, same receipt detection, same bulk-job-import handoff into
  // send()) — now triggered from sendMessage() below on a real Send press,
  // reading from the staged pendingAttachments instead of a live FileList,
  // and threading the owner's typed caption into the single-attachment
  // path too (it never had anywhere to type one before this).
  const sendWithAttachments = async (caption: string, attachments: typeof pendingAttachments) => {
    if (getVisionModelChain().length === 0) {
      appendMessage({ id: uid(), role: "user", content: caption || (attachments.length === 1 ? "📎 " + attachments[0].file.name : `📎 ${attachments.length} attachments`), imagePreviews: attachments.filter(a => !a.isPdf).map(a => a.dataUrl), timestamp: Date.now() } as any);
      reportAlfredError(new Error("Reading files needs an API key — add one in Settings → AI Models."));
      return;
    }
    const msgId = uid();
    appendMessage({
      id: msgId, role: "user",
      content: caption || (attachments.length === 1 ? "📎 " + attachments[0].file.name : `📎 ${attachments.length} attachments`),
      imagePreviews: attachments.filter(a => !a.isPdf).map(a => a.dataUrl),
      timestamp: Date.now(),
    } as any);
    setAttachAnalyzing(true);
    // The composer's Stop button aborts this too (it's the slowest part).
    const attachAbort = new AbortController();
    currentAbortControllerRef.current = attachAbort;
    // Every file is also saved, so "attach this to <client>" can file it.
    for (const a of attachments) {
      (async () => {
        try {
          const path = `_alfred-inbound/${ownerId}/${uid()}-${a.file.name}`;
          const { error: upErr } = await (supabase as any).storage.from("customer-docs").upload(path, a.file, { contentType: a.file.type || "application/octet-stream", upsert: true });
          if (upErr) { console.warn("[Alfred] file upload for attach-to-customer failed:", upErr.message); return; }
          const { data: pub } = (supabase as any).storage.from("customer-docs").getPublicUrl(path);
          if (pub?.publicUrl) lastAttachedFileRef.current = { url: pub.publicUrl, fileName: a.file.name };
        } catch (e: any) { console.warn("[Alfred] file upload threw:", e?.message); }
      })();
    }
    try {
      // BUG FIX (user report — files and PDF sheets sent to Alfred should be
      // recognized and acted on). Each file is read in full and classified
      // (lib/attachmentReader.ts), then routed: lists go to the import
      // tools, receipts become a ready-to-log expense, and everything else
      // reaches Alfred with a plain instruction to act on it.
      const notes: string[] = [];
      const receipts: any[] = [];
      let stopped = false;
      for (let i = 0; i < attachments.length; i++) {
        if (attachAbort.signal.aborted) { stopped = true; break; }
        const a = attachments[i];
        const label = attachments.length > 1 ? ` (${i + 1} of ${attachments.length})` : "";
        setAttachProgressLabel(`Reading ${a.file.name}${label}…`);
        const block = a.isPdf
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 } }
          : { type: "image", source: { type: "base64", media_type: a.mediaType, data: a.base64 } };
        const ask = async (prompt: string) => {
          const r: any = await callVisionModel({ messages: [{ role: "user", content: [block, { type: "text", text: prompt }] }], maxTokens: 8000 }, 120000, `Reading ${a.file.name}`, { pdf: a.isPdf, externalSignal: attachAbort.signal });
          return String(r?.text || "");
        };
        try {
          const read = await readAttachmentFully(ask, "service", { onRound: n => setAttachProgressLabel(`Reading ${a.file.name}${label} — part ${n}…`) });
          const { header, body } = read;
          const r = header.receipt;
          if (header.kind === "receipt" && r && Number(r.total)) {
            receipts.push({ vendor: String(r.vendor || "").trim() || a.file.name, date: String(r.date || "").trim(), amount: Number(r.total), category: String(r.category || "other").toLowerCase(), receiptDataUrl: a.isPdf ? undefined : a.dataUrl });
            notes.push(`"${a.file.name}" is a receipt: ${r.vendor || "?"}, $${r.total}, ${r.date || "no date"} — shown to the owner with a Log expense button.`);
            continue;
          }
          if (LIST_KINDS.includes(header.kind) && body.trim()) {
            const id = "B-" + uid().slice(0, 8);
            importBatchesRef.current.set(id, { id, kind: "text", name: a.file.name, text: body, createdAt: Date.now() });
            const rows = Math.max(0, body.split("\n").filter(l => l.trim()).length - 1);
            notes.push(`"${a.file.name}" is ${KIND_LABEL[header.kind]}${header.title ? ` (${header.title})` : ""} — ${rows} rows read${read.complete ? "" : " (the file was very long; some rows at the end may be missing — say so)"}. Saved as import batch ${id}: call prepare_import with batchId "${id}"${header.kind === "client_list" ? "" : " (it has schedule/job info)"}.`);
            continue;
          }
          recentFileContextRef.current = { fileName: a.file.name, extractedText: body, attachedAt: Date.now(), turnsUsed: 0 };
          notes.push(`"${a.file.name}" is ${KIND_LABEL[header.kind] || "a document"}${header.title ? ` (${header.title})` : ""}. Its content:\n${body.length > 12000 ? body.slice(0, 12000) + "\n…(cut — ask the owner if you need the rest)" : body}`);
        } catch (e: any) {
          if (attachAbort.signal.aborted) { stopped = true; break; }
          notes.push(`Couldn't read "${a.file.name}" — ${e?.message || "unknown error"}.`);
        }
      }
      if (stopped) { appendMessage({ id: uid(), role: "alfred", content: "Stopped.", timestamp: Date.now() }); return; }
      for (const pe of receipts) {
        appendMessage({ id: uid(), role: "alfred", content: `📋 Receipt detected: ${pe.vendor} · $${pe.amount} · ${pe.category}${pe.date ? " · " + pe.date : ""}`, timestamp: Date.now(), pendingExpense: pe } as any);
      }
      // Only receipts and nothing asked: the Log expense card is the answer.
      if (receipts.length === attachments.length && !caption) return;
      setAttachProgressLabel("Working out what to do with it…");
      const what = caption
        ? `I also said: "${caption}" — do that.`
        : "I didn't say what I want — work out the most likely thing and do it: a client or job list → prepare_import (then show me the summary); a bill or statement → log each expense; an invoice or quote → match it to the customer and record it; a photo of a property or job → say what you see and ask which customer/job it belongs to. Ask one short question only if it's genuinely unclear.";
      await send(`I attached ${attachments.length === 1 ? "a file" : attachments.length + " files"}.\n\n${notes.join("\n\n")}\n\n${what}`, { skipVisibleMessage: true });
    } catch (err: any) {
      if (attachAbort.signal.aborted) {
        appendMessage({ id: uid(), role: "alfred", content: "Stopped.", timestamp: Date.now() });
      } else {
        reportAlfredError(err, { file: true });
      }
    } finally {
      if (currentAbortControllerRef.current === attachAbort) currentAbortControllerRef.current = null;
      setAttachAnalyzing(false);
      setAttachProgressLabel("");
    }
  };

  // Composer's real entry point — routes to the attachment pipeline above
  // when something's staged, otherwise the plain text send(). Used by the
  // Send button, Enter key, suggested-prompt chips, and voice auto-send.
  // BUG FIX (user report — a huge trash-can client list "Alfred couldn't
  // handle"). Spreadsheets/CSVs and long pasted lists are kept in
  // importBatchesRef and the model gets a short note with a preview and the
  // batch id, instead of the whole list (which timed out the model and was
  // too long for it to copy back out). prepare_import reads the full batch.
  const LONG_PASTE_CHARS = 4000;
  const stashLongPaste = (text: string): string => {
    const lines = text.split(/\r?\n/).filter(l => l.trim()).length;
    if (text.length < LONG_PASTE_CHARS || lines < 10) return text;
    const id = "B-" + uid().slice(0, 8);
    importBatchesRef.current.set(id, { id, kind: "text", name: "pasted text", text, createdAt: Date.now() });
    return `${text.slice(0, 1500)}\n…\n\n[Pasted text: ${lines} lines, ${text.length.toLocaleString()} characters — only the start is shown above. Saved as import batch ${id}. If it's customers/jobs to import, call prepare_import with batchId "${id}". To read all of it for anything else, call read_pasted_text.]`;
  };
  const isTableFile = (f: File) => /\.(csv|tsv|txt|xlsx|xlsm|vcf|vcard|json)$/i.test(f.name) || /csv|spreadsheet|excel|vcard|json|text\/plain/i.test(f.type);
  const stashTableFiles = async (files: File[]): Promise<string[]> => {
    const notes: string[] = [];
    for (const f of files) {
      try {
        const rows = await readImportFile(f);
        const head = rows[0] || [];
        const id = "B-" + uid().slice(0, 8);
        importBatchesRef.current.set(id, { id, kind: "table", name: f.name, headers: head.map((h, i) => h || `Column ${i + 1}`), data: rows.slice(1), createdAt: Date.now() });
        notes.push(`[Attached file "${f.name}": ${Math.max(0, rows.length - 1)} rows. Columns: ${head.join(" | ")}. First rows: ${rows.slice(1, 3).map(r => r.join(" | ")).join(" // ")}. Saved as import batch ${id} — call prepare_import with batchId "${id}" to import it.]`);
      } catch (e: any) {
        notes.push(`[Attached file "${f.name}" couldn't be read: ${e?.message || "unknown error"}]`);
      }
    }
    return notes;
  };
  const stashGoogleSheet = async (url: string): Promise<string> => {
    try {
      const rows = await fetchGoogleSheetRows(url);
      const head = rows[0] || [];
      const id = "B-" + uid().slice(0, 8);
      importBatchesRef.current.set(id, { id, kind: "table", name: "Google Sheet", headers: head.map((h, i) => h || `Column ${i + 1}`), data: rows.slice(1), createdAt: Date.now() });
      return `[Google Sheet ${url}: ${Math.max(0, rows.length - 1)} rows. Columns: ${head.join(" | ")}. First rows: ${rows.slice(1, 3).map(r => r.join(" | ")).join(" // ")}. Saved as import batch ${id} — call prepare_import with batchId "${id}" to import it, or read_pasted_text to read it.]`;
    } catch (e: any) {
      return `[Google Sheet ${url} couldn't be opened: ${e?.message || "unknown error"} — tell the owner exactly that.]`;
    }
  };
  const withSheetNotes = async (text: string): Promise<string> => {
    const urls = Array.from(new Set((text.match(new RegExp(GOOGLE_SHEET_URL.source, "gi")) || []))).slice(0, 3);
    if (!urls.length) return text;
    setAttachProgressLabel("Opening the Google Sheet…");
    try { return [text, ...(await Promise.all(urls.map(stashGoogleSheet)))].join("\n\n"); } finally { setAttachProgressLabel(""); }
  };
  const sendMessage = async (overrideText?: string) => {
    const raw = (overrideText ?? input);
    if (pendingAttachments.length > 0) {
      const attachments = pendingAttachments;
      const tables = attachments.filter(a => isTableFile(a.file));
      const media = attachments.filter(a => !isTableFile(a.file));
      setPendingAttachments([]);
      setInput("");
      setShowSlash(false);
      const notes = tables.length ? await stashTableFiles(tables.map(a => a.file)) : [];
      const caption = [await withSheetNotes(stashLongPaste(raw.trim())), ...notes].filter(Boolean).join("\n\n");
      if (media.length) await sendWithAttachments(caption, media);
      else await send(caption || "Import this list.");
    } else {
      const text = await withSheetNotes(stashLongPaste(raw));
      await send(text === raw ? overrideText : text);
    }
  };
  useEffect(() => { sendMessageRef.current = sendMessage; }); // no deps — always the latest, see sendMessageRef's comment

  // FEATURE — "a real continuous hands-free conversation loop." Each turn
  // is its own SpeechRecognition instance with continuous:false — the
  // browser's own endpointing (it waits for a natural pause) decides when
  // the owner is done talking and fires ONE complete result, unlike
  // VoiceMicButton's dictation mode (continuous:true, manually stopped),
  // which is built for "keep typing until I press stop," not turn-taking.
  // On each turn: listen -> send(transcript) (the exact same pipeline text
  // chat uses — same memory, same tools, same personality) -> speak the
  // reply (see the TTS block in send() above) -> resume listening once
  // speech actually finishes (ttsEndCallbackRef).
  const VoiceRecognitionCtor = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  // Shared by both a normal listening turn and a barge-in that abandons
  // Alfred's current reply for a new one — see voiceTurnIdRef's own
  // comment for why every completion here is guarded by a turn id instead
  // of trusting speechSynthesis's event ordering.
  const processVoiceTurn = (text: string) => {
    voiceTurnIdRef.current++;
    const turnId = voiceTurnIdRef.current;
    const thisTurnCallback = () => { if (voiceModeKeepGoingRef.current && voiceTurnIdRef.current === turnId) startVoiceListeningTurn(); };
    ttsEndCallbackRef.current = thisTurnCallback;
    setVoiceModeState("thinking");
    // BUG FIX (user report) — "while I'm on voice chat, let me manually
    // send messages, photos, or files to give context." Routes through
    // sendMessageRef (not sendRef) so a photo/file attached from the Voice
    // Mode panel (see the attach button below) is picked up automatically
    // on the NEXT turn — spoken ("also look at these screenshots") or
    // manually sent — exactly like the normal text composer already does.
    sendMessageRef.current(text);
    // Safety net — if send() ever returns without reaching its TTS block
    // (a thrown/caught error, a recognized slash command's early return,
    // any future code path that skips it) ttsEndCallbackRef would never
    // fire and Voice Mode would silently hang on "Thinking…" forever.
    setTimeout(() => {
      if (ttsEndCallbackRef.current === thisTurnCallback) { ttsEndCallbackRef.current = null; thisTurnCallback(); }
    }, 45000);
  };
  // A manual text/attachment send while the recognizer is still actively
  // listening for speech would otherwise let it fire its own onend a moment
  // later (empty transcript) and re-arm "listening" mid-way through the
  // manual turn's own thinking/speaking state — stop it first so only the
  // manual turn is driving the state machine.
  const sendVoiceManualText = () => {
    try { voiceModeRecognitionRef.current?.stop(); } catch { /* already stopped */ }
    processVoiceTurn(voiceManualText.trim());
    setVoiceManualText("");
    setVoiceTextOpen(false);
  };
  // Voice Mode without the browser's recognizer (lib/voiceCapture.ts): the
  // mic is recorded until the owner stops talking, the server turns it into
  // text, and that's the turn. Same state machine as the recognizer path.
  const serverVoiceFailsRef = useRef(0);
  const startServerListeningTurn = () => {
    setVoiceModeState("listening");
    setVoiceModeTranscript("");
    voiceModeTranscriptRef.current = "";
    let dropped = false;
    const h = recordVoice({ stopOnSilence: true, silenceMs: 1300, waitForSpeechMs: 20000, maxMs: 90000, onSpeechStart: () => setVoiceModeTranscript("…") });
    voiceModeRecognitionRef.current = { stop: () => { dropped = true; h.cancel(); } };
    h.result.then(async blob => {
      if (dropped || !voiceModeKeepGoingRef.current || voiceMutedRef.current) return;
      if (!blob) { startVoiceListeningTurn(); return; } // nobody spoke — keep listening
      setVoiceModeTranscript("Turning that into text…");
      try {
        const text = await transcribeAudio(blob);
        if (dropped || !voiceModeKeepGoingRef.current) return;
        serverVoiceFailsRef.current = 0;
        if (!text) { startVoiceListeningTurn(); return; }
        voiceModeTranscriptRef.current = text;
        setVoiceModeTranscript(text);
        processVoiceTurn(text);
      } catch (e: any) {
        serverVoiceFailsRef.current++;
        if (serverVoiceFailsRef.current >= 3) { toast("Voice isn't working: " + (e?.message || "transcription failed") + " — check Settings → AI Models → Check connections.", "red"); closeVoiceMode(); return; }
        toast("Didn't catch that — " + (e?.message || "try again"), "yellow");
        setTimeout(() => { if (voiceModeKeepGoingRef.current) startVoiceListeningTurn(); }, 1200);
      }
    }).catch((e: any) => { toast(e?.message || "Couldn't use the microphone", "red"); closeVoiceMode(); });
  };
  const startVoiceListeningTurn = () => {
    if (!voiceModeKeepGoingRef.current || voiceMutedRef.current) return;
    if (!browserRecognizerUsable()) { if (canRecordAudio()) startServerListeningTurn(); return; }
    setVoiceModeState("listening");
    setVoiceModeTranscript("");
    voiceModeTranscriptRef.current = "";
    const rec = new VoiceRecognitionCtor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      voiceModeTranscriptRef.current = text;
      setVoiceModeTranscript(text);
    };
    rec.onerror = (e: any) => {
      if (e.error === "no-speech") return; // onend fires right after — handled there
      if (e.error === "not-allowed") {
        toast("Microphone access denied — Voice Mode needs it to listen.", "red");
        closeVoiceMode();
        return;
      }
      // The browser's recognizer can't work here — it used to restart forever
      // hearing nothing. onend (right after this) restarts the turn, which now
      // records and transcribes on the server instead.
      if (RECOGNIZER_FATAL.has(e.error)) markBrowserRecognizerBroken(e.error);
      // Other transient errors (network/aborted): onend still fires below and restarts the turn.
    };
    rec.onend = () => {
      if (!voiceModeKeepGoingRef.current) return;
      const finalText = voiceModeTranscriptRef.current.trim();
      if (!finalText) { startVoiceListeningTurn(); return; } // nothing said — just keep listening
      processVoiceTurn(finalText);
    };
    voiceModeRecognitionRef.current = rec;
    try { rec.start(); } catch { setTimeout(() => { if (voiceModeKeepGoingRef.current) startVoiceListeningTurn(); }, 300); }
  };
  // FEATURE — "interrupt Alfred's sentence, tell it to resume what it was
  // saying, hold up." Starts the moment Alfred begins speaking (see
  // send()'s TTS block) — a SEPARATE recognizer from the turn-taking one
  // above (that one only runs during "listening", this one only runs
  // during "speaking"/"paused", so they never actually overlap). The
  // instant it detects the owner has started talking (onspeechstart —
  // fires on speech ONSET, before any transcript is ready, same as a
  // human stopping mid-sentence the moment someone talks over them) it
  // pauses Alfred (speechSynthesis.pause() — a real pause, not a cancel;
  // resumable) and switches to "paused". Once the owner finishes their
  // own sentence, what they actually said decides what happens next:
  // a resume cue ("keep going"/"continue"/etc.) resumes the SAME
  // paused reply where it left off; a hold cue ("hold on"/"wait"/etc. with
  // nothing else) just stays paused, waiting; anything else is treated as
  // a real new instruction — the paused reply is abandoned and the new
  // words are processed as the next turn. Best-effort by nature (a single
  // mic can't perfectly separate the owner's voice from Alfred's own
  // speaker output without dedicated echo-cancelling hardware — a
  // headset makes this far more reliable than open speakers).
  const RESUME_CUE = /^(resume|continue|keep going|go on|go ahead|carry on|please continue|yes continue)\.?!?$/i;
  const HOLD_CUE = /^(hold on|hold up|wait|pause|one sec|one second|give me a sec|just a sec|hang on|stop)\.?!?$/i;
  // BUG FIX — "make sure it doesn't mistake its own response... if I have
  // Alfred on my speakers and it's loud, my microphone might pick that up
  // ... make sure it doesn't interrupt itself." This WAS the actual bug:
  // onspeechstart paused Alfred the INSTANT the mic heard ANY audio onset —
  // on open speakers that's Alfred's own voice, every single time, so a
  // reply could get paused mid-sentence by itself, then whatever garbled
  // fragment of Alfred's own words the recognizer half-caught got tested
  // against RESUME_CUE/HOLD_CUE and, matching neither, got treated as "a
  // real new instruction" — cancelling the actual reply outright. There's
  // no way to get true hardware echo cancellation through the Web Speech
  // API (it manages its own mic stream internally, no exposed
  // getUserMedia constraints), so this can't be fixed perfectly without a
  // headset — but comparing what the mic heard against what Alfred is
  // ACTUALLY SAYING catches the common case: if most of the recognized
  // words are just words from Alfred's own current reply, it's an echo,
  // not an interruption.
  const normalizeWords = (s: string): string[] => (s || "").toLowerCase().replace(/[^a-z0-9\s']/g, "").split(/\s+/).filter(w => w.length > 1);
  // FEATURE — "start showing text while it's talking, not like it copy-
  // pasted the response." The model call itself still isn't streamed
  // (that would need every provider's proxy in functions/api/call-model.ts
  // rebuilt around SSE, a much larger change) — but once the full reply
  // text comes back, it's split into sentences and played/revealed ONE AT
  // A TIME instead of as one long monotone utterance with the whole
  // paragraph dumped into the transcript instantly. Reads far closer to
  // an actual live response.
  const splitIntoSentences = (text: string): string[] => {
    const parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/).map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [text];
  };
  const speakProgressively = async (fullText: string, messageId: string, turnId: number, elevenKey?: string) => {
    const sentences = splitIntoSentences(fullText);
    let shown = "";
    for (const sentence of sentences) {
      if (voiceTurnIdRef.current !== turnId) return; // abandoned mid-reply (barge-in, call ended) — stop talking
      shown = shown ? shown + " " + sentence : sentence;
      updateMessageContent(messageId, shown);
      await speakAloud(sentence, elevenKey);
      if (voiceTurnIdRef.current !== turnId) return;
    }
  };
  const startInterruptListener = (speakingText: string) => {
    if (!VoiceRecognitionCtor || !browserRecognizerUsable() || voiceMutedRef.current) return;
    const listenerTurnId = voiceTurnIdRef.current;
    const spokenWords = new Set(normalizeWords(speakingText));
    const looksLikeEcho = (said: string): boolean => {
      const words = normalizeWords(said);
      if (words.length === 0) return false;
      const matches = words.filter(w => spokenWords.has(w)).length;
      // BUG FIX — "it doesn't let me interrupt." 0.6 was catching genuine
      // short interruptions that happened to share a couple of common
      // words with whatever Alfred was mid-sentence saying — biased
      // toward NOT missing a real interruption (a little self-echo
      // slipping through and getting (mis)treated as a real interruption
      // is a far smaller annoyance than Alfred routinely refusing to stop
      // talking).
      return matches / words.length >= 0.8;
    };
    let heardSpeech = false;
    let heardText = "";
    let pausedForThisTurn = false;
    const rec = new VoiceRecognitionCtor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onspeechstart = () => {
      if (voiceTurnIdRef.current !== listenerTurnId) return; // this reply was already abandoned/finished
      heardSpeech = true;
      // Deliberately does NOT pause here anymore — see the bug-fix note
      // above. Pausing now waits for onresult to actually confirm the
      // words aren't just Alfred's own voice bleeding into the mic.
    };
    rec.onresult = (e: any) => {
      if (voiceTurnIdRef.current !== listenerTurnId) return;
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + " ";
      heardText = text.trim();
      setVoiceModeTranscript(heardText);
      // BUG FIX — "it doesn't let me interrupt." The >=2-word requirement
      // was meant to stop a single stray echoed word from pausing Alfred,
      // but it also silently blocked every ONE-WORD hold cue ("wait",
      // "stop", "pause", "hold on" all match HOLD_CUE at 1-2 words) from
      // ever registering at all — those never even got a chance to pause
      // and be evaluated at onend. A recognized cue always pauses
      // immediately regardless of length; only genuinely free-form speech
      // still needs the 2-word/non-echo bar.
      const trimmedSoFar = heardText.trim();
      const isKnownCue = RESUME_CUE.test(trimmedSoFar) || HOLD_CUE.test(trimmedSoFar);
      if (!pausedForThisTurn && (isKnownCue || (trimmedSoFar.split(/\s+/).filter(Boolean).length >= 2 && !looksLikeEcho(trimmedSoFar)))) {
        pausedForThisTurn = true;
        if (typeof window !== "undefined" && window.speechSynthesis?.speaking) {
          try { window.speechSynthesis.pause(); } catch { /* some browsers throw pausing an already-finishing utterance */ }
        }
        setVoiceModeState("paused");
      }
    };
    rec.onend = () => {
      if (voiceTurnIdRef.current !== listenerTurnId) return; // stale — a new turn already started elsewhere
      if (!heardSpeech) return; // Alfred just finished naturally, nothing was said over it
      if (!pausedForThisTurn) {
        // Heard audio, but it never became confirmed real speech (silence,
        // one stray word, or it all looked like Alfred's own echo) —
        // Alfred was never actually paused, so there's nothing to resume
        // or cancel. Just keep watching for a genuine interruption.
        startInterruptListener(speakingText);
        return;
      }
      const said = heardText.trim();
      if (RESUME_CUE.test(said) || (said && looksLikeEcho(said))) {
        try { window.speechSynthesis?.resume(); } catch { /* nothing to resume */ }
        setVoiceModeState("speaking");
        startInterruptListener(speakingText); // keep watching in case they interrupt again
      } else if (!said || HOLD_CUE.test(said)) {
        // Stay paused — listen again for either a resume cue or a real instruction.
        startInterruptListener(speakingText);
      } else {
        // A real new instruction — abandon the paused reply for good.
        if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
        processVoiceTurn(said);
      }
    };
    rec.onerror = () => { /* best-effort listener — a transient error here just means no interrupt was caught this round */ };
    interruptRecognitionRef.current = rec;
    try { rec.start(); } catch { /* best-effort — speaking still completes normally without barge-in this once */ }
  };
  const toggleVoiceMute = () => {
    const next = !voiceMuted;
    voiceMutedRef.current = next;
    setVoiceMuted(next);
    if (next) {
      // Muting stops the mic outright — including a barge-in listener
      // mid-speech, since "mute" means the owner's mic is off, full stop.
      try { voiceModeRecognitionRef.current?.stop(); } catch { /* already stopped */ }
      try { interruptRecognitionRef.current?.stop(); } catch { /* already stopped */ }
    } else if (voiceModeState !== "thinking" && voiceModeState !== "speaking" && voiceModeState !== "paused") {
      startVoiceListeningTurn();
    }
  };
  // Manual equivalent of the verbal "hold up"/"resume" — a reliable
  // button press for when barge-in detection doesn't catch a soft-spoken
  // interruption (open speakers, background noise, no headset).
  const toggleVoicePause = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (voiceModeState === "speaking") {
      try { window.speechSynthesis.pause(); } catch { /* nothing playing */ }
      setVoiceModeState("paused");
    } else if (voiceModeState === "paused") {
      try { window.speechSynthesis.resume(); } catch { /* nothing paused */ }
      setVoiceModeState("speaking");
    }
  };
  // FEATURE — "I say 'hey can you do this,' it shows me it's doing it,
  // moves into... minimized... shows me what it's doing. Once it
  // finishes, it goes back into full-screen mode." The fullscreen voice
  // overlay is z-[400] — it covers the ENTIRE screen, so App.tsx's
  // navigate+highlight spotlight (queueAlfredSpotlight/onSpotlight) had
  // nothing to actually show during a voice call; the row it glows lives
  // underneath a solid overlay the owner can't see through. Auto-minimize
  // to the bubble for the highlight's duration so it's actually visible,
  // then restore fullscreen — but only when WE minimized it for this;
  // never override a minimize the owner chose themselves.
  const spotlightRestoreTimerRef = useRef<any>(null);
  const autoMinimizedForSpotlightRef = useRef(false);
  const triggerSpotlight = (step: { page: string; type?: string; id?: string; label?: string }) => {
    if (voiceModeOpenRef.current) {
      if (!voiceModeMinimizedRef.current) {
        autoMinimizedForSpotlightRef.current = true;
        setVoiceModeMinimized(true);
      }
      if (autoMinimizedForSpotlightRef.current) {
        clearTimeout(spotlightRestoreTimerRef.current);
        spotlightRestoreTimerRef.current = setTimeout(() => {
          setVoiceModeMinimized(false);
          autoMinimizedForSpotlightRef.current = false;
        }, 3000); // matches App.tsx's per-step highlight duration (500ms settle + 400ms scroll-settle + 1800ms glow + buffer)
      }
    }
    onSpotlight?.(step);
  };
  const openVoiceMode = () => {
    if (!browserRecognizerUsable() && !canRecordAudio()) { toast("This browser can't use the microphone — update it, or try Chrome, Edge or Safari.", "red"); return; }
    // BUG FIX — "don't make it a new conversation each call. It should be
    // one sandbox conversation inside the call, so it slowly grows, learns,
    // and gets more memory." Every voice call now switches into the SAME
    // persistent "Alfred Voice" conversation instead of creating a new one
    // per call — its id is remembered cross-device in settings (JSONB, no
    // schema change needed) so every device converges on the same thread.
    // send() still layers in a digest of recent TEXT conversations as
    // background (see crossConversationContext) so this isn't the only
    // context Alfred has, and the reverse (text seeing this voice thread)
    // is handled unconditionally by voiceSandboxContext below.
    voicePrevConvIdRef.current = activeConvId;
    let sandboxId = (settings as any)?.voiceSandboxConversationId as string | undefined;
    // Only recreate if we're SURE it's gone (conversations have actually
    // loaded and it's really not there) — never second-guess just because
    // it hasn't synced down to this device/tab yet, or every device would
    // race to spin up its own separate sandbox.
    const sandboxConfirmedMissing = !!sandboxId && alfredConvsLoaded && !conversations.some(c => c.id === sandboxId);
    if (!sandboxId || sandboxConfirmedMissing) {
      sandboxId = uid();
      setSettings?.((prev: any) => ({ ...(prev || {}), voiceSandboxConversationId: sandboxId }));
      setConversations(prev => [{ id: sandboxId, title: "Alfred Voice", personality, createdAt: today(), updatedAt: Date.now(), messages: [] }, ...prev]);
    }
    setActiveConvId(sandboxId);
    setVoiceModeOpen(true);
    voiceModeOpenRef.current = true;
    voiceModeKeepGoingRef.current = true;
    setVoiceMuted(false);
    voiceMutedRef.current = false;
    setVoiceModeMinimized(false);
    setBubblePos(null); // reset to the default bottom-right corner each new call
    // Entrance transition — mount first (0 opacity/scale via
    // voiceModeMounted starting false), then flip visible a tick later so
    // the browser actually animates the change instead of snapping
    // straight to it (same two-step pattern Modal.tsx uses).
    setVoiceModeMounted(false);
    setTimeout(() => setVoiceModeMounted(true), 20);
    selectBritishVoice().then(v => {
      if (!v) toast("No British voice found on this device — Alfred will still talk, just in your system's default voice.", "yellow");
    });
    startVoiceListeningTurn();
  };
  const closeVoiceMode = () => {
    voiceModeKeepGoingRef.current = false;
    voiceModeOpenRef.current = false;
    voiceTurnIdRef.current++; // invalidate any in-flight turn/interrupt listener
    ttsEndCallbackRef.current = null;
    try { voiceModeRecognitionRef.current?.stop(); } catch { /* already stopped */ }
    try { interruptRecognitionRef.current?.stop(); } catch { /* already stopped */ }
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setVoiceModeMounted(false);
    setVoiceModeMinimized(false);
    setBubbleMenu(null);
    const prevConvId = voicePrevConvIdRef.current;
    voicePrevConvIdRef.current = null;
    setTimeout(() => {
      setVoiceModeOpen(false); // let the exit transition finish before unmounting
      if (prevConvId) setActiveConvId(prevConvId); // back to whatever text chat was open before the call
    }, 250);
  };

  const onInputChange = e => {
    const v = e.target.value;
    setInput(v);
    setShowSlash(v.startsWith("/") && !v.includes(" "));
  };

  const pickSlash = s => {
    const cmd = s.cmd.split(" ")[0];
    setInput(cmd + (s.cmd.includes("[") ? " " : ""));
    setShowSlash(false);
    inputRef.current?.focus();
  };

  const cur: any = getPersonality(active?.personality || personality) || { name: "Alfred", color: "from-brand-600 to-brand-900", icon: Bot };
  const CurIcon = cur.icon || Bot;

  // CRASH FIX (companion to App.tsx's alfred_conversations sync) — updatedAt
  // is a number for conversations created locally (Date.now(), see
  // updateActive/appendMessage/etc. below) but a STRING for anything loaded
  // back from Supabase (App.tsx normalizes it to an ISO string). Subtracting
  // a string from a number here wouldn't crash, just silently produce NaN —
  // every comparison returns false-equal and the "recent" sort/grouping
  // quietly stops working the moment a conversation round-trips through
  // Supabase. Normalize both shapes before comparing.
  const convTs = (v: unknown): number => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v) { const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t; }
    return 0;
  };
  const filteredConvs = conversations
    .filter(c => !convSearch.trim() || c.title.toLowerCase().includes(convSearch.toLowerCase()) || c.messages.some(m => m.content.toLowerCase().includes(convSearch.toLowerCase())))
    .sort((a, b) => convTs(b.updatedAt) - convTs(a.updatedAt));

  // Group conversations by recency
  const groupConvs = list => {
    const now = Date.now();
    const today_ = [], week = [], older = [];
    list.forEach(c => {
      const age = (now - convTs(c.updatedAt)) / 86400000;
      if (age < 1) today_.push(c);
      else if (age < 7) week.push(c);
      else older.push(c);
    });
    return [["Today", today_], ["Previous 7 days", week], ["Older", older]].filter(([, g]) => g.length > 0);
  };
  const convGroups = groupConvs(filteredConvs);

  const relTime = ts => {
    const diff = (Date.now() - convTs(ts)) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m";
    if (diff < 86400) return Math.floor(diff / 3600) + "h";
    return Math.floor(diff / 86400) + "d";
  };

  // BLOCKER 19 (mobile round 9) — FIX 1's full-viewport portal (see git
  // history) solved a real mobile-overflow bug (the messages list scrolling
  // App.tsx's own <main> instead of itself) but did it by covering the
  // ENTIRE screen, including the main sidebar and header — "clicking Alfred
  // hides the main sidebar" was that tradeoff, not a separate bug. Rendering
  // in place (no portal) and sizing height off the viewport instead of the
  // parent's auto-sized content keeps the main chrome visible while still
  // giving this container a definite height for its own internal
  // aside/messages panes to scroll within, independent of App.tsx's <main>.
  // FIX 19 — was a hardcoded h-[calc(100dvh-150px)]/[...-160px)] guess at
  // "everything else on screen," which doesn't match App.tsx's actual
  // header/padding/mobile-bottom-nav chrome — sometimes shorter than the
  // real remaining space (dead space below), sometimes taller (forcing the
  // outer page to ALSO scroll, on top of this component's own internal
  // message-list scroll). App.tsx now gives this component's actual parent
  // chain (main → wrapper div → PageFade) a real flex height for the alfred
  // page specifically, so flex-1 here fills it exactly with no guesswork.
  // FEATURE — "keep talking to it while looking through the CRM." The
  // normal chat UI below only makes sense rendered where App.tsx's own
  // page layout expects it (#alfred-mount-point, only present while
  // page==="alfred") — portaled there instead of rendered directly, since
  // this component itself is now mounted at a stable, always-present spot
  // in App.tsx specifically so it survives navigating away (see that
  // file's own comment). mountEl is looked up in an effect (below,
  // near the other voice-mode refs) rather than read directly here,
  // because a plain document.getElementById() call during render would
  // see last frame's DOM, not the placeholder React is committing THIS
  // pass — createPortal needs the target to already exist.
  return (
    <>
    <AlfredErrorPopup error={isActivePage === false ? null : alfredError} onClose={() => setAlfredError(null)} onRetry={t => { setModelStatus?.((st: any) => Object.fromEntries(Object.entries(st || {}).map(([k, v]: any) => [k, { ...v, lockedUntil: 0 }]))); setTimeout(() => sendMessageRef.current(t), 80); }} onOpenSettings={openSettings} />
    {mountEl && createPortal(
    <div className="relative w-full flex-1 min-h-0 flex bg-black border border-brand-900/30 rounded-2xl overflow-hidden">
      {/* Conversation sidebar — BUG FIX (user report) — "the animation isn't
          smooth, the text looks glitchy." The width transition used to run
          directly on THIS element, which also holds the conversation list
          text — animating an element's own width forces the browser to
          re-wrap/re-flow its text content at every intermediate width
          during the whole 300ms, which is exactly what reads as glitchy
          text. Split into an outer wrapper that owns the animated width
          (0 → 280px, clipped via overflow-hidden) and an inner element
          that always renders at a CONSTANT 280px — its text never needs to
          re-wrap mid-animation, only the outer clipping window's size
          changes, so it reads as a clean slide/reveal instead. */}
      <div className={"transition-all duration-300 overflow-hidden flex-shrink-0 " + (sidebarOpen ? "w-[280px]" : "w-0") + " absolute md:relative h-full z-20"}>
      <aside className="w-[280px] h-full bg-black/80 backdrop-blur-xl border-r border-brand-900/30 flex flex-col">
        <div className="p-3 border-b border-brand-900/30 flex items-center gap-2">
          <button onClick={newConversation} className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border border-brand-600/40 bg-brand-950/30 hover:bg-brand-900/40 text-sm font-medium transition">
            <Plus size={14} />New chat
          </button>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 rounded-lg hover:bg-white/5 text-white/50"><X size={14} /></button>
        </div>

        <div className="p-3 border-b border-brand-900/20 space-y-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input value={convSearch} onChange={e => setConvSearch(e.target.value)} placeholder="Search chats..." className="w-full bg-black/40 border border-brand-900/20 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand-600/40" />
          </div>
          <button onClick={cleanupDuplicateConversations} className="w-full text-[10px] text-white/40 hover:text-white/70 transition text-left px-0.5">Merge duplicate conversations</button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {convGroups.map(([label, group]: [string, any[]]) => (
            <div key={label} className="mb-3">
              <div className="text-[10px] uppercase tracking-wider text-white/40 px-2 mb-1">{label}</div>
              {group.map(c => {
                const isActive = c.id === activeConvId;
                const isEditing = editingTitle === c.id;
                return (
                  <div key={c.id} className={"group relative rounded-lg mb-0.5 transition " + (isActive ? "bg-brand-900/30 border border-brand-600/40" : "hover:bg-white/5 border border-transparent")}>
                    {isEditing ? (
                      <input autoFocus value={titleDraft} onChange={e => setTitleDraft(e.target.value)} onBlur={commitRename} onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setEditingTitle(null); }} className="w-full bg-black/60 border border-brand-600/40 rounded-lg px-2.5 py-2 text-xs focus:outline-none" />
                    ) : (
                      <button onClick={() => { setActiveConvId(c.id); if (window.innerWidth < 768) setSidebarOpen(false); }} className="w-full text-left px-2.5 py-2 pr-16">
                        <div className="text-xs font-medium truncate">{c.title || "Untitled"}</div>
                        <div className="text-[10px] text-white/40 flex items-center gap-1.5 mt-0.5">
                          <MessageSquare size={8} />{c.messages.filter(m => m.role === "user").length} · {relTime(c.updatedAt)}
                        </div>
                      </button>
                    )}
                    {!isEditing && (
                      <div className={"absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 " + (isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100") + " transition"}>
                        <button onClick={e => { e.stopPropagation(); startRename(c); }} className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white" title="Rename"><Edit size={10} /></button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDelete(c.id); }} className="p-1 rounded hover:bg-danger-900/40 text-white/60 hover:text-danger-400" title="Delete"><Trash2 size={10} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {filteredConvs.length === 0 && <div className="text-center py-8 text-xs text-white/30">No chats found</div>}
        </div>

        {/* Bottom: personality switcher + memory toggle */}
        <div className="border-t border-brand-900/30 p-2 space-y-1">
          <button onClick={() => setMemoryOpen(true)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/5 text-xs text-white/70 hover:text-white transition">
            <div className="p-1.5 rounded bg-purple-900/30"><Bot size={11} className="text-purple-400" /></div>
            <span className="flex-1 text-left">Memory</span>
            <span className="text-[10px] text-white/40">{memory.length}</span>
          </button>
          {/* BUG FIX — "I don't know why [Voice Mode] is on that sidebar,
              it shouldn't be there." Moved to a real red mic button right
              in the message input row (next to Send) — a whole hands-free
              conversation belongs where you'd normally start talking to
              Alfred, not tucked in this small utility list. */}
          {/* FEATURE — "you need a toggle for whether Alfred talks back."
              Reads Alfred's reply aloud via ElevenLabs (if a key's set in
              Settings → AI Models) or the browser's free built-in voice
              otherwise — either way this is the one place that turns it on. */}
          <button onClick={() => setSettings((prev: any) => ({ ...prev, ttsEnabled: !prev.ttsEnabled }))} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-white/5 text-xs text-white/70 hover:text-white transition">
            <div className={"p-1.5 rounded " + ((settings as any)?.ttsEnabled ? "bg-green-900/30" : "bg-white/5")}><Volume2 size={11} className={(settings as any)?.ttsEnabled ? "text-green-400" : "text-white/40"} /></div>
            <span className="flex-1 text-left">Voice Replies</span>
            <span className={"text-[10px] font-semibold " + ((settings as any)?.ttsEnabled ? "text-green-400" : "text-white/30")}>{(settings as any)?.ttsEnabled ? "ON" : "OFF"}</span>
          </button>
          <div className="px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Personality</div>
            <div className="grid grid-cols-2 gap-1">
              {personalities.map((p: any) => {
                const k = p.id;
                const Icon = p.icon;
                const a = (active?.personality || personality) === k;
                return <button key={k} onClick={() => { console.log("[Personality] switched to", k); setPersonality(k); if (active) updateActive({ personality: k }); }} className={"flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] transition border " + (a ? "bg-gradient-to-r " + p.color + " border-brand-500/50" : "bg-white/5 hover:bg-white/10 border-transparent text-white/60")}>{Icon && <Icon size={10} />}{p.name}</button>;
              })}
            </div>
          </div>
          {settings.elevenlabsKey && (
            <button onClick={() => setSettings({ ...settings, ttsEnabled: !settings.ttsEnabled })} className={"w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition border " + (settings.ttsEnabled ? "bg-orange-900/30 border-orange-700/40 text-orange-300" : "bg-white/5 border-transparent text-white/50 hover:text-white")}>
              <span>{settings.ttsEnabled ? "🔊" : "🔇"}</span>
              <span className="flex-1 text-left">Voice {settings.ttsEnabled ? "On" : "Off"}</span>
              <span className="text-[9px] text-white/30">ElevenLabs</span>
            </button>
          )}
        </div>
      </aside>
      </div>

      {sidebarOpen && <div className="md:hidden fixed inset-0 bg-black/60 z-10" onClick={() => setSidebarOpen(false)} />}

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-black to-neutral-950">
        {/* Chat header — sticky (belt-and-suspenders on top of the flex
            layout, which already pins it since it's a sibling of the
            scrollable messages div, not an ancestor of it) */}
        <div className="sticky top-0 z-10 flex-shrink-0 flex items-center gap-1.5 md:gap-2 px-2 py-2 md:p-3 border-b border-brand-900/30 bg-black/40 backdrop-blur">
          <button onClick={() => onNav && onNav("dashboard")} className="p-2 rounded-lg hover:bg-white/5 text-white/70 flex-shrink-0" title="Back to Dashboard">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-white/5 text-white/70 flex-shrink-0" title="Toggle sidebar">
            <Menu size={16} />
          </button>
          <div className={"p-1.5 rounded-lg bg-gradient-to-br flex-shrink-0 " + cur.color}><CurIcon size={12} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{active?.title || "New chat"}</div>
            <div className="text-[10px] text-white/50 truncate">Alfred · {cur.name}</div>
          </div>

          {/* Model switcher */}
          {(() => {
            const activeModel = settings.activeModel || "claude";
            const activeM = (MODELS as any)[activeModel];
            const activeLocked = (modelStatus[activeModel] as any)?.lockedUntil > Date.now();
            const remaining = activeLocked ? (modelStatus[activeModel] as any).lockedUntil - Date.now() : 0;
            const fmtShort = ms => {
              const s = Math.floor(ms / 1000);
              if (s < 60) return s + "s";
              const m = Math.floor(s / 60);
              if (m < 60) return m + "m";
              return Math.floor(m / 60) + "h " + (m % 60) + "m";
            };
            return <div className="relative">
              <button onClick={() => setModelPickerOpen(!modelPickerOpen)} className={"flex items-center gap-1.5 px-2 py-1.5 md:px-2.5 rounded-lg border text-xs transition flex-shrink-0 " + (activeLocked ? "bg-yellow-950/30 border-yellow-700/50 text-yellow-300" : "bg-black/40 border-brand-900/30 hover:border-brand-600/50 text-white/80")}>
                <div className={"w-2 h-2 rounded-full bg-gradient-to-br " + (activeM?.color || "from-gray-500 to-gray-700")} />
                <span className="hidden md:inline">{activeM?.name || "Model"}</span>
                {activeLocked && <span className="font-mono text-[10px] text-yellow-300">⏱{fmtShort(remaining)}</span>}
                {settings.failoverEnabled && <Zap size={10} className="text-purple-400" />}
                <ChevronRight size={10} className="rotate-90 opacity-60" />
              </button>
              {modelPickerOpen && <>
                <div className="fixed inset-0 z-10" onClick={() => setModelPickerOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-64 bg-black/95 border border-brand-900/40 rounded-xl shadow-2xl z-20 backdrop-blur overflow-hidden">
                  <div className="p-2 border-b border-brand-900/30 flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wider text-white/50">AI Model</div>
                    <label className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer">
                      <input type="checkbox" checked={!!settings.failoverEnabled} onChange={() => setSettings(s => ({ ...s, failoverEnabled: !s.failoverEnabled }))} className="w-3 h-3 accent-purple-500" />
                      <Zap size={9} className="text-purple-400" />Failover
                    </label>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {Object.values(MODELS as any).map((m: any) => {
                      const hasKey = !m.needsKey || !!(settings.modelKeys || {})[m.id];
                      const isActive = activeModel === m.id;
                      const locked = (modelStatus[m.id] as any)?.lockedUntil > Date.now();
                      const rem = locked ? (modelStatus[m.id] as any).lockedUntil - Date.now() : 0;
                      return <button key={m.id} onClick={() => {
                        if (hasKey) {
                          setSettings((s: any) => {
                            const currentPriority: string[] = Array.isArray(s.modelPriority) ? s.modelPriority : Object.keys(MODELS);
                            const nextPriority = [m.id, ...currentPriority.filter((k: string) => k !== m.id)];
                            return { ...s, activeModel: m.id, modelPriority: nextPriority };
                          });
                          setModelPickerOpen(false);
                        } else { openSettings(); setModelPickerOpen(false); }
                      }} className={"w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-white/5 border-b border-brand-900/20 last:border-b-0 text-left " + (isActive ? "bg-brand-950/30" : "")}>
                        <div className={"w-2.5 h-2.5 rounded-full flex-shrink-0 bg-gradient-to-br " + m.color} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{m.name}</span>
                            {isActive && <CheckCircle size={10} className="text-green-400" />}
                            {locked && <Clock size={10} className="text-yellow-400" />}
                          </div>
                          <div className="text-[9px] text-white/50 truncate">{m.label}</div>
                        </div>
                        {!hasKey && <span className="text-[9px] text-yellow-400">Set up</span>}
                        {locked && <span className="text-[9px] font-mono text-yellow-300">{fmtShort(rem)}</span>}
                      </button>;
                    })}
                  </div>
                  <button onClick={() => { openSettings(); setModelPickerOpen(false); }} className="w-full p-2 border-t border-brand-900/30 text-[10px] text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center gap-1"><Settings size={10} />Manage API keys</button>
                </div>
              </>}
            </div>;
          })()}

          <div className="relative flex-shrink-0">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-lg hover:bg-white/5 text-white/70" title="Menu">
              <GripVertical size={16} />
            </button>
            {menuOpen && <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-black/95 border border-brand-900/40 rounded-xl shadow-2xl z-20 py-1 backdrop-blur">
                <button onClick={() => { setMemoryOpen(true); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2"><Bot size={11} className="text-purple-400" />Manage memory</button>
                <button onClick={() => { startRename(active); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2"><Edit size={11} />Rename chat</button>
                <button onClick={clearChat} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2"><RefreshCw size={11} />Clear messages</button>
                <div className="border-t border-brand-900/30 my-1" />
                <button onClick={() => { setConfirmDelete(active?.id); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-danger-900/30 text-danger-400 flex items-center gap-2"><Trash2 size={11} />Delete chat</button>
                <button onClick={() => { if (confirm("Delete ALL conversations?")) deleteAllConversations(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-danger-900/30 text-danger-400 flex items-center gap-2"><X size={11} />Delete all chats</button>
              </div>
            </>}
          </div>
        </div>

        {/* Messages — the ONLY scrollable area. min-h-0 is required here: a
            flex child's default min-height is "auto" (= its content size),
            which overrides flex-1 and lets it grow past the parent's bounded
            height instead of actually scrolling internally — the classic
            cause of "the whole page scrolls" in a flex chat layout. */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          {chats.length <= 1 && (
            <div className="min-h-full flex flex-col items-center justify-center p-6 max-w-2xl mx-auto">
              <div className={"p-4 rounded-2xl bg-gradient-to-br mb-5 " + cur.color}><CurIcon size={28} /></div>
              <h2 className="text-2xl font-bold mb-2">{cur.name}</h2>
              <p className="text-sm text-white/60 text-center mb-6 max-w-md">{cur.greeting}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full max-w-2xl">
                {suggestions.map((s, i) => {
                  const Icon = s.icon;
                  return <button key={i} onClick={() => sendMessage(s.prompt)} className="p-3 bg-black/40 hover:bg-brand-950/20 border border-brand-900/30 hover:border-brand-600/40 rounded-xl text-left transition group">
                    <Icon size={14} className="text-brand-400 mb-1.5 group-hover:scale-110 transition" />
                    <div className="text-xs font-medium">{s.title}</div>
                    <div className="text-[10px] text-white/40 font-mono mt-0.5">{s.prompt}</div>
                  </button>;
                })}
              </div>
            </div>
          )}
          {chats.length > 1 && (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
              {chats.filter(m => !isInternalAttachPrompt(m)).map(m => {
                const isUser = m.role === "user";
                const isError = !isUser && typeof m.content === "string" && m.content.startsWith("⚠️");
                return (
                  <div key={m.id} className={"flex gap-3 " + (isUser ? "justify-end" : "justify-start")}>
                    {!isUser && <div className={"flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br " + (isError ? "from-danger-900 to-danger-950" : cur.color)}><CurIcon size={13} /></div>}
                    <div className={"flex-1 min-w-0 " + (isUser ? "max-w-[85%] md:max-w-[75%]" : "max-w-full")}>
                      {/* BUG FIX — imagePreview was set on the message object
                          when a receipt/photo was attached, but nothing ever
                          rendered it — the attachment silently vanished from
                          the chat transcript entirely. */}
                      {(m as any).imagePreview && (
                        <img src={(m as any).imagePreview} alt="Attachment" className={"max-w-[220px] rounded-xl border border-white/10 mb-1.5 " + (isUser ? "ml-auto float-right block" : "")} />
                      )}
                      {/* FEATURE — bulk screenshot import shows every attached
                          screenshot as a thumbnail strip, not just one. */}
                      {Array.isArray((m as any).imagePreviews) && (m as any).imagePreviews.length > 0 && (
                        <div className={"flex flex-wrap gap-1.5 mb-1.5 " + (isUser ? "justify-end clear-both" : "")}>
                          {(m as any).imagePreviews.map((src: string, i: number) => (
                            <img key={i} src={src} alt={`Screenshot ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-white/10" />
                          ))}
                        </div>
                      )}
                      <div className={"px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed inline-block " + (isUser ? "bg-brand-600 text-brand-fg rounded-br-sm float-right" : isError ? "bg-danger-950/60 border border-danger-700/50 rounded-bl-sm text-danger-200" : "bg-black/50 border border-white/10 rounded-bl-sm text-white/90")}>
                        {isUser ? m.content : String(m.content || "").split("\n").filter(l => l.trim() !== "---").join("\n").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\*/g, "").replace(/^#{1,6} /gm, "").trim()}
                      </div>
                      {/* FEATURE — receipt → expense. A clickable button
                          instead of the old "say 'yes log it'" magic phrase,
                          which nothing in the send pipeline ever actually
                          recognized — that dead end never created a real
                          expense no matter what the owner typed back. */}
                      {(m as any).pendingExpense && (
                        <div className="clear-both pt-1">
                          <button
                            onClick={() => {
                              const pe = (m as any).pendingExpense;
                              setExpenses?.((prev: any[]) => [{ id: uid(), date: pe.date || today(), description: pe.vendor || "Receipt", amount: pe.amount, category: pe.category || "other", vendor: pe.vendor, receiptDataUrl: pe.receiptDataUrl, isBusiness: true, isDeductible: true }, ...(prev || [])]);
                              toast?.(`Logged $${pe.amount} — ${pe.vendor} ✓`, "green");
                              setConversations((prev: any[]) => prev.map((c: any) => c.id === activeId ? { ...c, messages: [...c.messages.map((cm: any) => cm.id === m.id ? { ...cm, pendingExpense: null } : cm), { id: uid(), role: "alfred", content: `✓ Logged to Expenses: ${pe.vendor} · $${pe.amount} · ${pe.category}`, timestamp: Date.now() }] } : c));
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300 hover:bg-green-900/50 transition flex items-center gap-1.5"
                          >
                            <Receipt size={12} />Log ${(m as any).pendingExpense.amount} to Expenses
                          </button>
                        </div>
                      )}
                      {!isUser && (
                        <div className="flex items-center gap-1 mt-1 opacity-0 hover:opacity-100 transition">
                          <button onClick={() => { navigator.clipboard?.writeText(m.content); toast("Copied"); }} className="p-1 text-white/40 hover:text-white text-[10px]"><Copy size={10} /></button>
                        </div>
                      )}
                    </div>
                    {isUser && <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-xs font-bold text-brand-fg">SM</div>}
                  </div>
                );
              })}
              {/* BUG FIX (user report) — "kept just showing and never
                  responded." Multi-screenshot analysis is a real, bounded
                  wait (each image gets its own call, plus a retry — slower
                  providers like OpenRouter can genuinely take a while), but
                  a static, unchanging dots animation for that whole stretch
                  is indistinguishable from an actual hang. Real progress
                  text now updates as each attachment is actually worked on. */}
              {(loading || attachAnalyzing) && <div className="flex gap-3">
                <div className={"flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br " + cur.color}><CurIcon size={13} /></div>
                <div className="px-4 py-3 rounded-2xl bg-black/50 border border-brand-900/30 flex items-center gap-2.5">
                  {/* BUG FIX (user request) — "make the animation... a lot
                      faster." Tailwind's default animate-bounce cycle is 1s;
                      0.5s reads as noticeably livelier without looking
                      frantic. */}
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce text-brand-fg" style={{ animationDuration: "0.5s" }} />
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce text-brand-fg" style={{ animationDuration: "0.5s", animationDelay: "100ms" }} />
                    <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce text-brand-fg" style={{ animationDuration: "0.5s", animationDelay: "200ms" }} />
                  </div>
                  <span className="text-xs text-white/50">{attachAnalyzing && attachProgressLabel ? attachProgressLabel : `${thinkingWord}…`}</span>
                </div>
              </div>}
            </div>
          )}
        </div>

        {/* No-key warning banner — only when no model is usable */}
        {!(settings.modelPriority || ["claude", "openai", "gemini", "groq", "mistral"]).some(mid => {
          const m = (MODELS as any)[mid];
          if (!m) return false;
          if (m.needsKey && !(settings.modelKeys || {})[mid]) return false;
          const ms: any = (modelStatus || {})[mid];
          if (ms?.lockedUntil > Date.now()) return false;
          return true;
        }) && (
          <div className="border-t border-yellow-900/30 bg-yellow-950/20 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="text-xs text-yellow-300 flex items-center gap-2 min-w-0">
              <AlertTriangle size={13} className="flex-shrink-0" />
              <span className="truncate">No AI model available — add an API key in Settings → AI Models to enable Alfred (slash commands still work)</span>
            </div>
            <button onClick={openSettings} className="flex-shrink-0 text-xs text-yellow-200 bg-yellow-900/40 border border-yellow-700/40 px-3 py-1 rounded-lg hover:bg-yellow-900/60 transition whitespace-nowrap">
              Add key
            </button>
          </div>
        )}

        {/* Composer — sticky bottom, same belt-and-suspenders reasoning as the header above */}
        <div className="sticky bottom-0 z-10 flex-shrink-0 border-t border-brand-900/30 bg-black/40 backdrop-blur p-3 md:p-4">
          <div className="max-w-3xl mx-auto relative">
            {/* Slash command autocomplete */}
            {showSlash && slashFiltered.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 right-0 bg-black/95 border border-brand-900/40 rounded-xl shadow-2xl max-h-64 overflow-y-auto backdrop-blur">
                {slashFiltered.map(s => (
                  <button key={s.cmd} onClick={() => pickSlash(s)} className="w-full text-left px-3 py-2 hover:bg-brand-950/40 flex items-center gap-3 border-b border-brand-900/20 last:border-0">
                    <span className="font-mono text-xs text-brand-400">{s.cmd}</span>
                    <span className="text-[10px] text-white/50">{s.desc}</span>
                  </button>
                ))}
              </div>
            )}
            {/* BUG FIX (user report) — "attach it, see that there's an
                attachment, press X to unattach... never send until you
                press send." Staged locally by the paperclip's file input
                (pendingAttachments) — nothing is sent to Alfred until
                sendMessage() actually runs on a real Send press. */}
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 px-0.5">
                {pendingAttachments.map(a => (
                  <div key={a.id} className="relative flex-shrink-0">
                    {a.isPdf || !a.mediaType.startsWith("image/") ? (
                      <div className="w-14 h-14 rounded-lg border border-brand-900/40 bg-black/60 flex flex-col items-center justify-center gap-0.5 px-1 overflow-hidden">
                        <FileText size={16} className="text-brand-400 flex-shrink-0" />
                        <span className="text-[8px] text-white/50 truncate w-full text-center">{a.file.name}</span>
                      </div>
                    ) : (
                      <img src={a.dataUrl} alt={a.file.name} className="w-14 h-14 object-cover rounded-lg border border-brand-900/40" />
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingAttachments(prev => prev.filter(p => p.id !== a.id))}
                      title="Remove attachment"
                      className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-brand-700 hover:bg-brand-600 text-brand-fg flex items-center justify-center border border-black/70"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* BUG FIX (user report) — "move the buttons... too cramped."
                Down from 3 voice controls to 1 (see the unified mic button
                below) plus a tighter gap reclaims real width for the
                textarea, which is the thing that actually needs the room. */}
            <div className="flex items-end gap-1.5 bg-black/60 border border-brand-900/40 rounded-2xl p-2 focus-within:border-brand-500/60 transition">
              {/* BUG FIX (user report) — "on mobile it should also give the
                  option for photos, not just camera and files." The single
                  file input below (accept="image/*,application/pdf") mixes
                  image and non-image types, which on several real Android
                  builds drops the dedicated "Photos" gallery shortcut from
                  the native picker down to just Camera + generic Files.
                  Splitting into two menu items — one accept="image/*,
                  video/*" alone (gets the real Photos picker), one
                  accept="application/pdf" alone — fixes that on every
                  platform, without touching the existing, just-fixed attach
                  handler at all: the photo/video input forwards its
                  FileList into the SAME original hidden input via a
                  DataTransfer (the standard vanilla-JS way to hand a
                  FileList to another real <input>) and fires its change
                  event, so all the actual logic below runs completely
                  unchanged regardless of which menu item was used. */}
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setAttachMenuOpen(o => !o)}
                  title="Attach a photo, video, receipt, or PDF"
                  className="p-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 transition"
                >
                  <Paperclip size={16} />
                </button>
                {attachMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAttachMenuOpen(false)} />
                    <div className="absolute bottom-full mb-2 left-0 w-52 bg-black/95 border border-brand-900/40 rounded-xl shadow-2xl overflow-hidden z-20 backdrop-blur">
                      <label className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/80 hover:bg-brand-950/40 cursor-pointer border-b border-brand-900/20">
                        <ImageIcon size={14} className="text-brand-400" />
                        Photo or video
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          className="hidden"
                          onChange={e => {
                            setAttachMenuOpen(false);
                            const files = e.target.files;
                            const target = mainAttachInputRef.current;
                            if (files && files.length > 0 && target) {
                              const dt = new DataTransfer();
                              Array.from(files).forEach(f => dt.items.add(f));
                              target.files = dt.files;
                              target.dispatchEvent(new Event("change", { bubbles: true }));
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>
                      <label className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/80 hover:bg-brand-950/40 cursor-pointer border-b border-white/10">
                        <FileText size={14} className="text-brand-400" />
                        Spreadsheet or list (import)
                        <input
                          type="file"
                          accept=".csv,.tsv,.txt,.xlsx,.xlsm,.vcf,.json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                          multiple
                          className="hidden"
                          onChange={async e => {
                            setAttachMenuOpen(false);
                            const files = Array.from(e.target.files || []);
                            e.target.value = "";
                            await stageFiles(files);
                          }}
                        />
                      </label>
                      <label className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/80 hover:bg-brand-950/40 cursor-pointer">
                        <FileText size={14} className="text-brand-400" />
                        Document (PDF)
                        <input
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          onChange={e => {
                            setAttachMenuOpen(false);
                            const files = e.target.files;
                            const target = mainAttachInputRef.current;
                            if (files && files.length > 0 && target) {
                              const dt = new DataTransfer();
                              Array.from(files).forEach(f => dt.items.add(f));
                              target.files = dt.files;
                              target.dispatchEvent(new Event("change", { bubbles: true }));
                            }
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </>
                )}
                <input ref={mainAttachInputRef} type="file" accept="image/*,application/pdf,.csv,.tsv,.txt,.xlsx,.xlsm,.vcf,.json" multiple className="hidden" onChange={async e => {
                  const filesList = Array.from(e.target.files || []);
                  e.target.value = "";
                  // BUG FIX (user report) — "it still sends the file...
                  // before I send the message... should never send until
                  // you actually press send." Attaching now ONLY stages a
                  // local preview (see stageFiles) — no model call, no
                  // appendMessage, nothing goes to Alfred until
                  // sendMessage() actually runs, on a real Send press.
                  await stageFiles(filesList);
                }} />
              </div>
              {/* FEATURE (user report) — "only one button for the whole note
                  STT, sending that note, or voice mode... show a mic icon,
                  have a cool animation, and present options... If you
                  choose STT or notes, the button should work when held or
                  pressed." Replaces the three separate controls that used
                  to crowd this corner (a text label mode-toggle, the mic
                  record button, and a big standalone Voice Mode button).
                  Tap opens a small menu; Voice Mode is a normal click,
                  Dictate/Voice Note are dense VoiceMicButton rows wired for
                  press-and-hold (holdToRecord) instead of click-to-toggle. */}
              <div className="relative flex-shrink-0">
                {voiceTool ? (
                  <div className={voiceTool === "note" ? "absolute bottom-full mb-2 left-0 z-30" : ""}>
                    <VoiceMicButton
                      key={voiceTool}
                      mode={voiceTool}
                      autoStart
                      onDone={() => setVoiceTool(null)}
                      onTranscript={(text, autoSend) => { if (autoSend) sendMessage(text); else setInput(prev => prev + (prev ? " " : "") + text); }}
                      apiKey={settings?.openAiKey || settings?.openaiKey || ""}
                    />
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => setVoiceMenuOpen(o => !o)}
                  title="Voice options"
                  className={"relative flex-shrink-0 p-2.5 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-white hover:scale-105 transition flex items-center justify-center " + (voiceTool === "dictate" ? "hidden" : "")}
                >
                  <Mic size={16} />
                </button>
                {voiceMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setVoiceMenuOpen(false)} />
                    <div className="absolute bottom-full mb-2 left-0 w-52 bg-black/95 border border-brand-900/40 rounded-xl shadow-2xl overflow-hidden z-20 backdrop-blur">
                      <button
                        onClick={() => { setVoiceMenuOpen(false); openVoiceMode(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/80 hover:bg-brand-950/40 transition text-left border-b border-brand-900/20"
                      >
                        <Mic size={14} className="text-brand-400 flex-shrink-0" />
                        <span className="flex-1">Voice Mode</span>
                        <span className="text-[9px] text-white/30 flex-shrink-0">HANDS-FREE</span>
                      </button>
                      <button onClick={() => { setVoiceMenuOpen(false); setVoiceTool("note"); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/80 hover:bg-brand-950/40 transition text-left border-b border-brand-900/20">
                        <Mic size={14} className="text-danger-400 flex-shrink-0" /><span className="flex-1">Voice Note</span><span className="text-[9px] text-white/30 flex-shrink-0">TAP TO STOP</span>
                      </button>
                      <button onClick={() => { setVoiceMenuOpen(false); setVoiceTool("dictate"); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/80 hover:bg-brand-950/40 transition text-left">
                        <Mic size={14} className="text-danger-400 flex-shrink-0" /><span className="flex-1">Dictate (type by voice)</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              {/* BUG FIX (user report) — "it makes the chat bigger... don't
                  have it." The box used to grow taller (up to 320px) as you
                  typed a longer message. Fixed height now (rows=3, no more
                  onInput resize) — a longer message just scrolls inside the
                  box instead of pushing the composer/chat around. */}
              <textarea
                ref={inputRef}
                rows={3}
                placeholder="Message Alfred..."
                value={input}
                onChange={onInputChange}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none resize-none overflow-y-auto"
              />
              {/* BUG FIX (user report) — "no button to stop Alfred from
                  responding mid-chat." Send swaps to a real Stop button
                  while a reply is in flight — aborts the actual model
                  fetch (see stopGenerating/currentAbortControllerRef), not
                  just a UI no-op that lets the response keep coming in. */}
              {loading ? (
                <button onClick={stopGenerating} title="Stop" className="p-2.5 rounded-xl bg-danger-950/60 border border-danger-700/50 text-danger-300 hover:bg-danger-900/60 transition">
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <>
                  {/* BUG FIX (user report) — "the stop button still does not
                      work." Screenshot/file analysis (attachAnalyzing) is
                      NOT `loading` — that's deliberate, so Send stays usable
                      for a new message while attachments are still being
                      read (see attachAnalyzing's own comment) — but that
                      also meant there was never any way to cancel a stuck
                      analysis itself. Add a real Stop alongside Send instead
                      of replacing it. */}
                  {attachAnalyzing && (
                    <button onClick={stopGenerating} title="Stop analyzing" className="p-2.5 rounded-xl bg-danger-950/60 border border-danger-700/50 text-danger-300 hover:bg-danger-900/60 transition">
                      <Square size={14} fill="currentColor" />
                    </button>
                  )}
                  <button onClick={() => sendMessage()} disabled={!input.trim() && pendingAttachments.length === 0} className={"p-2.5 rounded-xl transition " + (!input.trim() && pendingAttachments.length === 0 ? "bg-white/5 text-white/30" : "bg-brand-600 text-brand-fg hover:scale-105")}>
                    <Send size={14} />
                  </button>
                </>
              )}
            </div>
            <div className="text-[10px] text-white/30 text-center mt-2">Alfred can make mistakes. Verify critical info.</div>
          </div>
        </div>
      </div>

      {/* Memory drawer */}
      {memoryOpen && (() => {
        const memCats = [
          { k: "preferences", l: "Preferences", icon: "💭", color: "bg-blue-950/30 text-blue-300 border-blue-800/40" },
          { k: "business", l: "Business", icon: "💼", color: "bg-green-950/30 text-green-300 border-green-800/40" },
          { k: "facts", l: "Facts", icon: "📌", color: "bg-yellow-950/30 text-yellow-300 border-yellow-800/40" },
          { k: "goals", l: "Goals", icon: "🎯", color: "bg-brand-950/30 text-brand-300 border-brand-800/40" },
          { k: "general", l: "General", icon: "🧠", color: "bg-white/5 text-white/60 border-white/10" }
        ];
        const catMeta = c => memCats.find(x => x.k === (c || "general")) || memCats[4];
        const filteredMem = memFilter === "all" ? memory : memory.filter(m => (m.category || "general") === memFilter);
        return <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity duration-300" onClick={() => setMemoryOpen(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white/[0.04] backdrop-blur-2xl border-l border-white/10 shadow-2xl shadow-black/60 z-50 flex flex-col animate-slide-right">
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <div className="relative w-9 h-9 flex-shrink-0">
                <div className="absolute inset-0 rounded-xl bg-brand-600 shadow-lg shadow-brand-950/50 text-brand-fg" />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/25 to-transparent" />
                <div className="relative w-full h-full flex items-center justify-center"><Bot size={16} className="text-white" /></div>
              </div>
              <div className="flex-1">
                <div className="font-semibold text-sm">Alfred Memory</div>
                <div className="text-[10px] text-white/50">{memory.length} facts · Alfred references these in every conversation</div>
              </div>
              <button onClick={() => setMemoryOpen(false)} className="p-2 rounded-lg hover:bg-white/10 transition"><X size={14} /></button>
            </div>

            <div className="p-4 border-b border-white/10 space-y-2">
              <div className="flex gap-2">
                <GInput placeholder="Add a fact..." value={newMemoryText} onChange={e => setNewMemoryText(e.target.value)} onKeyDown={e => e.key === "Enter" && addMemory()} className="!text-xs !py-2" />
                <GSel value={newMemoryCat} onChange={e => setNewMemoryCat(e.target.value)} className="!text-xs !py-2 !w-32">
                  {memCats.map(c => <option key={c.k} value={c.k} className="bg-black">{c.icon} {c.l}</option>)}
                </GSel>
                <GBtn onClick={addMemory} disabled={!newMemoryText.trim()} className="!py-2"><Plus size={12} /></GBtn>
              </div>
              <div className="text-[10px] text-white/40">💡 Say "remember that..." in chat OR Alfred learns preference patterns automatically.</div>
            </div>

            {/* Category filter pills */}
            <div className="px-4 py-2.5 border-b border-white/10 flex gap-1.5 flex-wrap">
              <button onClick={() => setMemFilter("all")} className={"text-[10px] px-2.5 py-1 rounded-full border font-medium transition " + (memFilter === "all" ? "bg-brand-600 border-brand-500/50 text-brand-fg" : "bg-white/[0.04] border-white/10 text-white/50 hover:text-white/80")}>All ({memory.length})</button>
              {memCats.map(c => {
                const n = memory.filter(m => (m.category || "general") === c.k).length;
                if (n === 0) return null;
                return <button key={c.k} onClick={() => setMemFilter(c.k)} className={"text-[10px] px-2.5 py-1 rounded-full border font-medium transition " + (memFilter === c.k ? "bg-brand-600 border-brand-500/50 text-brand-fg" : "bg-white/[0.04] border-white/10 text-white/50 hover:text-white/80")}>{c.icon} {c.l} ({n})</button>;
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredMem.length === 0 && <div className="text-center py-10 text-xs text-white/40">
                <Bot size={28} className="mx-auto mb-3 opacity-30" />
                {memFilter === "all" ? "No memories yet. Alfred learns as you chat." : "Nothing in this category yet."}
              </div>}
              {filteredMem.map(m => {
                const meta = catMeta(m.category);
                return <div key={m.id} className="group flex items-start gap-2.5 p-3 bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-white/15 rounded-xl transition">
                  <div className={"flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm border " + meta.color}>{meta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs leading-relaxed text-white/85">{m.text}</div>
                    <div className="text-[9px] text-white/40 mt-1.5 flex items-center gap-1.5">
                      <span>{m.createdAt}</span>
                      <span>·</span>
                      <span>{meta.l.toLowerCase()}</span>
                      {m.autoLearned && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-brand-950/40 border border-brand-800/40 text-brand-300 text-[8px]"><Zap size={6} />auto-learned</span>}
                    </div>
                  </div>
                  <button onClick={() => removeMemory(m.id)} title="Delete this memory" className="flex-shrink-0 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg flex items-center justify-center text-white/40 hover:text-danger-300 hover:bg-danger-950/40 transition"><Trash2 size={11} /></button>
                </div>;
              })}
            </div>
            {memory.length > 0 && <div className="p-4 border-t border-white/10"><GBtn variant="danger" onClick={clearMemory} className="w-full !text-xs"><Trash2 size={12} className="inline mr-1.5" />Clear all memory</GBtn></div>}
          </div>
        </>;
      })()}

      {/* Delete confirmation */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete conversation?">
        <div className="space-y-3">
          <p className="text-sm text-white/70">This conversation will be permanently deleted. This can't be undone.</p>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setConfirmDelete(null)}>Cancel</GBtn>
            <GBtn variant="danger" onClick={() => deleteConversation(confirmDelete)}>Delete</GBtn>
          </div>
        </div>
      </Modal>
    </div>,
    mountEl
    )}
    {/* FEATURE — "keep talking to it while looking through the CRM."
        Voice Mode's overlay/bubble portal straight to document.body,
        completely independent of #alfred-mount-point/mountEl above — this
        is what actually keeps them visible and interactive on every other
        CRM page, not just while page==="alfred". */}
    {typeof document !== "undefined" && createPortal(
      <>
      {/* FEATURE — "a real continuous hands-free conversation loop... like
          ChatGPT's voice mode." Full-screen, not a small widget — this is
          meant to be used instead of looking at the screen, same reasoning
          a phone call UI is full-screen. Orb color/motion communicates
          state (listening/thinking/speaking) since there's often nothing
          else to look at while using this hands-free.
          BUG FIX — "the pop-up is slightly clear, so I can't see the full
          thing." The old backdrop was a gradient with a 30%-opacity
          middle stop (via-purple-950/30) directly AS the background —
          that's a genuinely see-through band the CRM page behind could
          bleed through. Backdrop is now fully opaque (bg-black); the
          purple tint is a separate decorative glow layered ON TOP instead
          of being part of the opacity-bearing background itself. */}
      {voiceModeOpen && !voiceModeMinimized && (() => {
        const stateColor: Record<string, string> = {
          listening: "rgba(255,255,255,0.55)", thinking: "rgba(245,158,11,0.5)",
          paused: "rgba(249,115,22,0.5)", speaking: "rgba(52,211,153,0.55)",
        };
        return (
        <div
          className={"fixed inset-0 z-[400] flex flex-col items-center justify-center px-6 py-8 overflow-y-auto transition-opacity duration-500 bg-[#050507] " + (voiceModeMounted ? "opacity-100" : "opacity-0")}
          style={{ "--orb-glow": stateColor[voiceModeState] } as React.CSSProperties}
        >
          {/* Ambient mesh backdrop — slow-drifting blurred color fields
              instead of a static blob, so the call feels alive even before
              anyone speaks. */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-32 -right-16 w-[30rem] h-[30rem] rounded-full bg-brand-600/20 blur-[110px] animate-voice-float-a" />
            <div className="absolute -bottom-40 -left-20 w-[26rem] h-[26rem] rounded-full bg-orange-500/10 blur-[110px] animate-voice-float-b" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[22rem] h-[22rem] rounded-full bg-brand-900/10 blur-[100px]" />
          </div>

          {/* Glass panel */}
          <div className={"relative w-full max-w-md rounded-[2rem] bg-white/[0.045] backdrop-blur-2xl border border-white/10 shadow-[0_8px_60px_-10px_rgba(0,0,0,0.7)] px-6 pt-7 pb-5 flex flex-col items-center transition-all duration-700 ease-out my-auto " + (voiceModeMounted ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-[0.97]")}>
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            <div className="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-white/5 pointer-events-none" />

            <div className="text-center mb-6">
              {/* FEATURE — "the logo... looks basic and bad." Slow spinning
                  conic-gradient ring behind the glass badge, like a living
                  status indicator rather than a static icon. */}
              <div className="relative w-16 h-16 mx-auto mb-3">
                <div className="absolute inset-0 rounded-full animate-spin-slow" style={{ background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.7), transparent 40%)" }} />
                <div className="absolute inset-[3px] rounded-full bg-[#0a0a0c]" />
                <div className="absolute inset-[5px] rounded-2xl bg-brand-600 shadow-lg shadow-brand-950/60 text-brand-fg" />
                <div className="absolute inset-[5px] rounded-2xl bg-gradient-to-b from-white/25 to-transparent" />
                <div className="absolute inset-[5px] rounded-2xl border border-white/20" />
                <div className="relative w-full h-full flex items-center justify-center">
                  <Bot size={26} className="text-white drop-shadow" />
                </div>
              </div>
              <div className="text-xs font-semibold text-white/60 uppercase tracking-widest">Alfred — Voice Mode</div>
              <div className="text-[10px] text-white/35 mt-1">{getPersonality(active?.personality || personality).name} · free browser voice{voiceMuted ? " · muted" : ""}</div>
            </div>

            {/* Mic orb — breathing glow keyed off the live state color, a
                thin rotating accent ring while active, and a crossfading
                icon instead of a hard swap. */}
            <div className={"relative flex items-center justify-center mb-6 transition-all duration-500 " + (voiceModeMounted ? "opacity-100 scale-100" : "opacity-0 scale-75")}>
              {(voiceModeState === "listening" || voiceModeState === "speaking") && (
                <div className="absolute w-40 h-40 md:w-44 md:h-44 rounded-full animate-spin-slow" style={{ background: `conic-gradient(from 0deg, transparent, ${stateColor[voiceModeState]}, transparent 30%)`, WebkitMaskImage: "radial-gradient(circle, transparent 68%, black 70%)", maskImage: "radial-gradient(circle, transparent 68%, black 70%)" }} />
              )}
              <div
                className={
                  "w-36 h-36 md:w-40 md:h-40 rounded-full border transition-all duration-500 " +
                  (voiceModeState === "listening" ? "border-brand-500/25 bg-brand-600/10" :
                   voiceModeState === "thinking" ? "border-amber-500/20 bg-amber-500/10" :
                   voiceModeState === "paused" ? "border-orange-500/20 bg-orange-500/10" :
                   "border-emerald-500/20 bg-emerald-500/10")
                }
              />
              <div className="absolute w-28 h-28 md:w-32 md:h-32 rounded-full backdrop-blur-md bg-white/[0.06] border border-white/15" />
              <div
                className="absolute rounded-full flex items-center justify-center transition-all duration-500 animate-voice-orb-glow"
                style={{ width: "6rem", height: "6rem" }}
              >
                <div
                  className={
                    "absolute inset-0 rounded-full transition-all duration-500 " +
                    (voiceModeState === "listening" ? "bg-brand-600 scale-100 text-brand-fg" :
                     voiceModeState === "thinking" ? "bg-gradient-to-br from-amber-400 to-amber-600 scale-90" :
                     voiceModeState === "paused" ? "bg-gradient-to-br from-orange-400 to-orange-600 scale-95" :
                     "bg-gradient-to-br from-emerald-400 to-emerald-600 scale-105")
                  }
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent" />
                <div key={voiceModeState} className="relative animate-fade-in">
                  {voiceModeState === "thinking" ? (
                    <div className="w-7 h-7 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
                  ) : voiceModeState === "paused" ? (
                    <Pause size={26} className="text-white" />
                  ) : voiceModeState === "speaking" ? (
                    // FEATURE — "add an animation when Alfred is talking." A
                    // decorative staggered bar bounce, not literally synced
                    // to the speech audio's amplitude (speechSynthesis
                    // doesn't expose that) — same honest limit as most
                    // voice-assistant "talking" indicators.
                    <div className="flex items-end gap-1 h-7">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="w-1.5 bg-white rounded-full animate-speaking-bar" style={{ height: "100%", animationDelay: `${i * 0.12}s` }} />
                      ))}
                    </div>
                  ) : (
                    <Mic size={26} className="text-white" />
                  )}
                </div>
              </div>
            </div>

            <div key={voiceMuted ? "muted" : voiceModeState} className="text-sm font-semibold text-white/80 mb-4 animate-fade-in text-center">
              {voiceMuted ? "Muted" : voiceModeState === "listening" ? "Listening…" : voiceModeState === "thinking" ? "Thinking…" : voiceModeState === "paused" ? "Paused — say \"resume\" or a new request" : "Speaking…"}
            </div>

            {/* FEATURE — "you can see both the text you say and the text it
                says." This is the persistent "Alfred Voice" sandbox
                conversation (see openVoiceMode) — it keeps growing across
                calls rather than resetting each time. */}
            <div className="w-full flex-1 min-h-0 max-h-[32vh] overflow-y-auto space-y-2 px-1 py-2">
              {(active?.messages || []).length === 0 && voiceModeState === "listening" && !voiceModeTranscript && (
                <div className="text-center text-[11px] text-white/30 py-4">Say something to get started…</div>
              )}
              {(active?.messages || []).slice(-8).map((m: any) => (
                <div key={m.id} className={"text-xs rounded-2xl px-3.5 py-2.5 max-w-[85%] backdrop-blur-sm animate-fade-in leading-relaxed " + (m.role === "user" ? "ml-auto bg-brand-600/20 border border-brand-500/20 text-brand-100" : "mr-auto bg-white/[0.06] border border-white/10 text-white/70")}>
                  {m.content}
                </div>
              ))}
              {(voiceModeState === "listening" || voiceModeState === "paused") && voiceModeTranscript && (
                <div className="ml-auto text-xs rounded-2xl px-3.5 py-2.5 max-w-[85%] bg-brand-600/10 border border-brand-500/10 text-brand-100/60 italic">{voiceModeTranscript}…</div>
              )}
            </div>

            {/* BUG FIX (user report) — "let me manually send messages,
                photos, or files while talking to it to give context." Staged
                attachments show right here, same X-to-remove as the normal
                composer — the NEXT turn (spoken or typed) picks them up
                automatically (see processVoiceTurn). */}
            {pendingAttachments.length > 0 && (
              <div className="w-full flex flex-wrap gap-2 mb-2 px-1">
                {pendingAttachments.map(a => (
                  <div key={a.id} className="relative flex-shrink-0">
                    {a.isPdf ? (
                      <div className="w-12 h-12 rounded-lg border border-white/15 bg-black/60 flex flex-col items-center justify-center gap-0.5 px-1 overflow-hidden">
                        <FileText size={13} className="text-brand-400 flex-shrink-0" />
                        <span className="text-[7px] text-white/50 truncate w-full text-center">{a.file.name}</span>
                      </div>
                    ) : (
                      <img src={a.dataUrl} alt={a.file.name} className="w-12 h-12 object-cover rounded-lg border border-white/15" />
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingAttachments(prev => prev.filter(p => p.id !== a.id))}
                      title="Remove attachment"
                      className="absolute -top-1.5 -right-1.5 w-[16px] h-[16px] rounded-full bg-brand-700 hover:bg-brand-600 text-brand-fg flex items-center justify-center border border-black/70"
                    >
                      <X size={9} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Manual text entry — for typing instead of speaking (a quiet
                room, a precise instruction, or just alongside an attachment
                with nothing to say out loud). Reuses processVoiceTurn so it
                fully participates in the same thinking/speaking state
                machine a spoken turn does. */}
            {voiceTextOpen && (
              <div className="w-full flex items-center gap-1.5 mb-2">
                <input
                  autoFocus
                  value={voiceManualText}
                  onChange={e => setVoiceManualText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (voiceManualText.trim() || pendingAttachments.length > 0)) {
                      e.preventDefault();
                      sendVoiceManualText();
                    }
                  }}
                  placeholder="Type instead of talking…"
                  className="flex-1 bg-white/[0.06] border border-white/15 rounded-full px-3.5 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50"
                />
                <button
                  onClick={sendVoiceManualText}
                  disabled={!voiceManualText.trim() && pendingAttachments.length === 0}
                  className={"w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center transition " + (!voiceManualText.trim() && pendingAttachments.length === 0 ? "bg-white/5 text-white/30" : "bg-brand-600 text-brand-fg")}
                >
                  <Send size={14} />
                </button>
              </div>
            )}

            {/* Controls — one unified glass dock instead of loose floating
                buttons, End Call as the visually distinct centerpiece. */}
            <div className="flex items-center gap-1 mt-5 p-1.5 rounded-full bg-black/30 border border-white/10 backdrop-blur-md flex-wrap justify-center">
              <button
                onClick={toggleVoiceMute}
                title={voiceMuted ? "Unmute microphone" : "Mute microphone"}
                className={"w-10 h-10 rounded-full flex items-center justify-center transition " + (voiceMuted ? "bg-brand-600/25 text-brand-300" : "text-white/60 hover:text-white hover:bg-white/10")}
              >
                {voiceMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              {(voiceModeState === "speaking" || voiceModeState === "paused") && (
                <button
                  onClick={toggleVoicePause}
                  title={voiceModeState === "paused" ? "Resume" : "Pause (hold up)"}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
                >
                  {voiceModeState === "paused" ? <Play size={16} /> : <Pause size={16} />}
                </button>
              )}
              {/* FEATURE (user report) — "let me manually send messages,
                  photos, or files while talking to it." Same Photo/Video vs
                  PDF split the normal composer uses (see its own comment on
                  why — the mobile native picker), staged via the shared
                  stageFiles() helper. */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setVoiceAttachMenuOpen(o => !o)}
                  title="Attach a photo, screenshot, or file"
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
                >
                  <Paperclip size={16} />
                </button>
                {voiceAttachMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setVoiceAttachMenuOpen(false)} />
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-black/95 border border-white/15 rounded-xl shadow-2xl overflow-hidden z-20 backdrop-blur">
                      <label className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/80 hover:bg-white/10 cursor-pointer border-b border-white/10">
                        <ImageIcon size={13} className="text-brand-400" />
                        Photo or video
                        <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={async e => {
                          setVoiceAttachMenuOpen(false);
                          const filesList = Array.from(e.target.files || []);
                          e.target.value = "";
                          await stageFiles(filesList);
                        }} />
                      </label>
                      <label className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                        <FileText size={13} className="text-brand-400" />
                        Document (PDF)
                        <input type="file" accept="application/pdf" className="hidden" onChange={async e => {
                          setVoiceAttachMenuOpen(false);
                          const filesList = Array.from(e.target.files || []);
                          e.target.value = "";
                          await stageFiles(filesList);
                        }} />
                      </label>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => setVoiceTextOpen(o => !o)}
                title="Type a message instead of talking"
                className={"w-10 h-10 rounded-full flex items-center justify-center transition " + (voiceTextOpen ? "bg-brand-600/25 text-brand-300" : "text-white/60 hover:text-white hover:bg-white/10")}
              >
                <Edit size={15} />
              </button>
              <button
                onClick={closeVoiceMode}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-brand-600 hover:from-brand-400 hover:to-brand-600 text-brand-fg font-semibold text-sm shadow-lg shadow-brand-950/50 transition mx-1"
              >
                <PhoneOff size={15} />End
              </button>
              {/* FEATURE — "should be minimizable so you can keep talking to
                  it while looking through the CRM." Collapses to a small
                  bubble (see below) without ending the call — floats across
                  every CRM page, supports drag-to-end / right-click quick
                  actions. */}
              <button
                onClick={() => setVoiceModeMinimized(true)}
                title="Minimize — keep talking while you look around"
                className="w-10 h-10 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Minimized bubble — the conversation (listening/thinking/speaking,
          barge-in, everything) keeps running exactly as before; this is
          purely a visual collapse. Click (no real movement) reopens the
          full overlay; drag it anywhere (pointer events — works for mouse
          AND touch); drag it into the bottom-middle drop zone and release
          to end the call; right-click ends it directly without reopening.
          Now portals to document.body (see the return statement's own
          comment) so it keeps floating over WHATEVER CRM page is
          currently showing, not just this one. */}
      {voiceModeOpen && voiceModeMinimized && (
        <>
          {/* FEATURE — "drag it to the bottom middle of the screen and let
              go, which ends the voice conversation." Only shown while
              actively dragging — a static drop-zone would just be visual
              noise the rest of the time. */}
          {bubbleDragging && (
            <div
              className={"fixed z-[399] left-1/2 -translate-x-1/2 bottom-6 w-52 h-24 rounded-2xl border-2 border-dashed backdrop-blur-md flex items-center justify-center text-xs font-semibold transition-colors " + (overDropZone ? "bg-brand-600/40 border-brand-400 text-white scale-105" : "bg-black/40 border-white/20 text-white/50")}
            >
              <PhoneOff size={16} className="inline mr-1.5" />Drop to end call
            </div>
          )}
          <button
            onPointerDown={onBubblePointerDown}
            onPointerMove={onBubblePointerMove}
            onPointerUp={onBubblePointerUp}
            onPointerCancel={onBubblePointerUp}
            onContextMenu={e => { e.preventDefault(); setBubbleMenu({ x: e.clientX, y: e.clientY }); }}
            title="Drag to move · click to reopen · right-click for quick actions"
            className={"fixed z-[400] w-16 h-16 rounded-full backdrop-blur-md bg-gradient-to-br from-brand-500/90 to-brand-800/90 border border-white/20 shadow-2xl shadow-brand-950/60 flex items-center justify-center animate-fade-in touch-none select-none " + (bubbleDragging ? "cursor-grabbing scale-110" : "cursor-grab")}
            style={bubblePos ? { left: bubblePos.x, top: bubblePos.y, right: "auto", bottom: "auto" } : { right: "1.5rem", bottom: "1.5rem" }}
          >
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
            <div className={"absolute inset-0 rounded-full " + (voiceModeState === "listening" || voiceModeState === "speaking" ? "animate-pulse-ring" : "")} />
            {voiceModeState === "thinking"
              ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin relative" />
              : <Bot size={24} className="text-white relative" />}
            {/* Quick at-a-glance mute status — "press mute or unmute" is a
                menu action below, this is just the visible indicator. */}
            {voiceMuted && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-neutral-900 border border-white/20 flex items-center justify-center">
                <MicOff size={12} className="text-brand-400" />
              </div>
            )}
          </button>
        </>
      )}

      {/* FEATURE — "right-click it, press mute or unmute, and use other
          quick actions." Right-click used to end the call outright with no
          way back; now it opens a small glass menu instead — a plain click
          on the bubble (no menu) still reopens the full overlay directly. */}
      {bubbleMenu && (
        <>
          <div className="fixed inset-0 z-[449]" onClick={() => setBubbleMenu(null)} onContextMenu={e => { e.preventDefault(); setBubbleMenu(null); }} />
          <div
            className="fixed z-[450] w-52 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/15 shadow-2xl shadow-black/60 overflow-hidden py-1.5"
            style={{ left: Math.max(8, Math.min(bubbleMenu.x, window.innerWidth - 216)), top: Math.max(8, Math.min(bubbleMenu.y, window.innerHeight - 220)) }}
          >
            <button onClick={() => { setVoiceModeMinimized(false); setBubbleMenu(null); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/80 hover:bg-white/10 transition">
              <Maximize2 size={14} />Reopen full screen
            </button>
            <button onClick={() => { toggleVoiceMute(); setBubbleMenu(null); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/80 hover:bg-white/10 transition">
              {voiceMuted ? <><Mic size={14} />Unmute microphone</> : <><MicOff size={14} />Mute microphone</>}
            </button>
            {(voiceModeState === "speaking" || voiceModeState === "paused") && (
              <button onClick={() => { toggleVoicePause(); setBubbleMenu(null); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/80 hover:bg-white/10 transition">
                {voiceModeState === "paused" ? <><Play size={14} />Resume</> : <><Pause size={14} />Pause (hold up)</>}
              </button>
            )}
            <button onClick={() => { setBubbleMenu(null); closeVoiceMode(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-brand-300 hover:bg-brand-950/40 transition border-t border-white/10 mt-1">
              <PhoneOff size={14} />End call
            </button>
          </div>
        </>
      )}
      </>,
      document.body
    )}
    </>
  );
}

// ===== EMPLOYEES =====
