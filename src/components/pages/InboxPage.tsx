// auto-extracted from CRM Starter monolith
import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Paperclip, ImageIcon, FileImage, MoreVertical, Mic, Upload, Link, Lock, User
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line,
  ComposedChart, Legend
} from "recharts";
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, normalizePhoneDigits, rememberOAuthReturnPage } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, pollTwilioIncoming, getFreshOwnerGoogleToken } from "../../lib/messaging";
import { supabase, getStoredGoogleConnection, setStoredGoogleToken } from "../../lib/supabase";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { fetchGmailMessages, sendGmailMessage, markGmailRead } from "../../lib/googleApi";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { usePollGate } from "../../hooks/usePollGate";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { PBar } from "../ui/PBar";
import { PageFade } from "../ui/PageFade";
import { TimeframeSelector } from "../ui/TimeframeSelector";
import { AddressAutocomplete } from "../ui/AddressAutocomplete";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { CustomerModal } from "../ui/CustomerModal";
import { CustomerDetail } from "../ui/CustomerDetail";
import { saveCustomersTolerant } from "../../lib/customerImport";
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

export function InboxPage({ threads = [], setThreads, customers = [], setCustomers, setJobs, settings = {} as AppSettings, toast, ownerId = "", onNav, onViewCustomerInCrm, jobs = [], estimates = [], employees = [] }: { jobs?: any[]; estimates?: any[]; employees?: any[]; threads?: any[]; setThreads?: any; customers?: any[]; setCustomers?: any; setJobs?: any; settings?: AppSettings; toast?: any; ownerId?: string; onNav?: (page: string) => void; onViewCustomerInCrm?: (customerId: string) => void }) {
  const [active, setActive] = useState(threads[0]?.id || null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [newModal, setNewModal] = useState(false);
  const [newDraft, setNewDraft] = useState({ channel: "sms", to: "", phone: "", email: "", subject: "", body: "" });
  const [polling, setPolling] = useState(false);
  const [gmailThreads, setGmailThreads] = useState<any[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  // ISSUE 1 — Gmail 403s (missing gmail.modify scope — see the OAuth scope
  // fix in App.tsx/GoogleWorkspacePage.tsx/SettingsModal.tsx) used to retry
  // silently forever: fetchGmailMessages() re-ran on every gmailToken
  // reference change, and markGmailRead() fired on every single click into
  // a Gmail thread regardless of whether it had already failed — burning
  // API quota on a call that could never succeed until the owner
  // reconnects with the right permission. A 403 now sets this flag, which
  // (a) shows a real "reconnect" banner instead of silently doing nothing,
  // and (b) gates OFF further Gmail calls for the rest of this session so
  // a permanently-missing scope can't keep re-failing on every click/poll.
  const [gmailPermissionError, setGmailPermissionError] = useState(false);
  // ISSUE 1 (round 3) — reconnecting Google generates a brand new token, but
  // the 403 gate above never reset once tripped, so the banner (and the
  // Gmail-load effect it gates) stayed stuck forever even after a real
  // reconnect — "reconnect required" even after reconnecting. Track WHICH
  // token actually failed; only suppress retries against that same token,
  // and clear the flag the moment a different (freshly reconnected) token
  // shows up.
  const lastFailedGmailTokenRef = useRef<string>("");
  // GoogleConnect — this page used to read `settings.googleToken`, a field
  // NOTHING in the app ever writes (the real field everywhere else is
  // googleProviderToken) — so Gmail-in-Inbox was silently non-functional
  // regardless of connection state. Also switched to getStoredGoogleConnection()
  // (localStorage), the same authoritative source Settings and Google
  // Workspace now use, instead of trusting settings/React state alone.
  const [storedGoogle, setStoredGoogle] = useState(() => getStoredGoogleConnection());
  useEffect(() => {
    const refresh = () => setStoredGoogle(getStoredGoogleConnection());
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const gmailToken = storedGoogle?.token || (settings as any)?.googleProviderToken || "";
  const msgEndRef = useRef(null);
  const inputRef = useRef(null);
  // EGRESS FIX — skip the inbox_threads poll below while the tab is hidden
  // or the owner has been idle 5+ minutes; realtime (subscribed below)
  // already delivers new messages instantly, this is just the fallback.
  const shouldPollInbox = usePollGate();

  const activeThread = threads.find(t => t.id === active) || gmailThreads.find(t => t.id === active);

  // ISSUE 9/17 (round 3) — a real customer thread (+15555550101) was found
  // with the SAME automated message duplicated 8-10x, every duplicate
  // sharing the identical Twilio timestamp. Root cause: the Twilio poll
  // effect below only re-runs when settings.twilioSid/googleBackendUrl
  // change, so its `poll` closure captured `threads`/`customers` from the
  // moment it was created and never saw newer state — `since` was
  // recomputed from that frozen snapshot on every single interval tick
  // forever, so the same already-seen messages kept re-qualifying against
  // Twilio's DateSent> filter and got re-appended with a fresh uid() each
  // time. Refs give the poll closure a way to always read current state
  // without re-subscribing the effect.
  const threadsRef = useRef(threads);
  useEffect(() => { threadsRef.current = threads; }, [threads]);
  const customersRef = useRef(customers);
  useEffect(() => { customersRef.current = customers; }, [customers]);

  // ISSUE 4 (round 8) — ROOT CAUSE of repeated opt-in/opt-out notifications:
  // deriving "have we already told the owner about this STOP/START message"
  // purely from `threadsRef.current` (live React state) breaks the instant
  // that state gets rebuilt from a server refetch (loadInboxThreads below
  // runs on its own poll AND on every realtime change to inbox_threads —
  // not just changes to the thread involved). If a refetch lands before a
  // message's `sid` has been synced back to the server, the next Twilio
  // poll's `knownSids` set (built from the same live state) is missing it
  // and reprocesses it as brand new — re-toasting "re-subscribed" for a
  // message already handled. A localStorage-backed set of notified sids
  // survives any such state rebuild, so a given physical message can only
  // ever trigger the opt-in/opt-out toast once, full stop.
  const [notifiedSmsSids, setNotifiedSmsSids] = usePersistent<string[]>("crm.inboxNotifiedSids", []);
  const notifiedSidsRef = useRef<Set<string>>(new Set(notifiedSmsSids));
  useEffect(() => { notifiedSidsRef.current = new Set(notifiedSmsSids); }, [notifiedSmsSids]);
  const markSidNotified = (sid: string) => {
    if (!sid || notifiedSidsRef.current.has(sid)) return;
    notifiedSidsRef.current.add(sid);
    setNotifiedSmsSids((prev: string[]) => prev.includes(sid) ? prev : [...prev, sid].slice(-1000));
  };

  // Defensive de-dup: collapse messages that are the same physical message,
  // keeping the first. Applied wherever threads are normalized so any
  // already-corrupted server data self-heals on load instead of needing a
  // manual database fix.
  //
  // ISSUE 2 (round 6) — primary key is now Twilio's own message `sid` when
  // present (both the webhook and the client poll tag inbound messages with
  // it — see twilio-sms-webhook.ts and the poll effect below), which is the
  // one identifier both write paths actually agree on. Falls back to the
  // dir/body/ts composite for messages with no sid (manual sends, campaign
  // sends, Gmail messages) — this was the ONLY check before, which missed
  // duplicates whenever the two write paths recorded different timestamps
  // for the same real message.
  const dedupeMessages = (msgs: any[]) => {
    const seenSids = new Set<string>();
    const seenKeys = new Set<string>();
    const out: any[] = [];
    for (const m of msgs) {
      if (m?.sid) {
        if (seenSids.has(m.sid)) continue;
        seenSids.add(m.sid);
      } else {
        const key = (m?.dir || "") + "|" + (m?.ts || "") + "|" + (m?.body || "");
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
      }
      out.push(m);
    }
    return out;
  };

  // FIX — SMS Inbox sync. `inbox_threads` in Supabase is the shared source of
  // truth for SMS conversations (written by both this page and, critically, by
  // employees sending OTW/Running Late/invoice texts from their own devices in
  // the field portal — see logOutboundSmsToInbox in lib/messaging.ts). Poll +
  // realtime so a text sent from a tech's phone shows up here without a
  // manual refresh. Only the "sms" channel is server-synced; manually
  // composed email threads stay local-only, same as before.
  const normalizeInboxThread = (r: any) => ({
    id: r.id,
    channel: "sms" as const,
    contactName: r.contact_name || r.contactName || r.contact_phone || "Unknown",
    contactPhone: r.contact_phone || r.contactPhone || "",
    contactEmail: r.contact_email || r.contactEmail || "",
    customerId: r.customer_id || r.customerId || null,
    unread: !!r.unread,
    messages: dedupeMessages(Array.isArray(r.messages) ? r.messages : []),
  });
  // ONE-TIME CLEANUP — merges any pre-existing duplicate sms threads left
  // over from the phone-normalization mismatch fixed above (see
  // normalizePhoneDigits in lib/utils.ts). Threads created via the Twilio
  // webhook (11-digit contact_phone) vs. threads created/matched
  // client-side (10-digit, no leading "1") for the SAME real number never
  // compared equal, so the same conversation silently split into two rows —
  // one accumulating Alfred's replies (badged), one not. Runs once per
  // session load, combines every duplicate group's messages into a single
  // canonical row (deduped, sorted by ts), and deletes the rest.
  // BUG FIX — "two threads for the same number, one labeled Alfred, the
  // other not, still didn't merge." This used to run at most ONCE per tab
  // (a boolean ref flipped true on the first call, permanently blocking
  // every later call) — but loadInboxThreads below re-runs on every
  // realtime change AND poll, so if a SECOND duplicate got created (e.g. by
  // texting Alfred) any time after that first check, this never got a
  // chance to look again for the rest of the session, no matter how long
  // it stayed open. A short cooldown instead of a permanent one-shot lets
  // it keep periodically catching new duplicates without hammering the
  // database on every single poll tick.
  const dedupeRanRef = useRef(0);
  const DEDUPE_COOLDOWN_MS = 30000;
  const mergeDuplicateInboxThreads = async () => {
    if (Date.now() - dedupeRanRef.current < DEDUPE_COOLDOWN_MS) return;
    dedupeRanRef.current = Date.now();
    try {
      const { data, error } = await (supabase as any).from("inbox_threads").select("*").eq("channel", "sms");
      if (error || !Array.isArray(data) || data.length < 2) return;
      const groups = new Map<string, any[]>();
      for (const row of data) {
        const digits = normalizePhoneDigits(row.contact_phone);
        if (!digits) continue;
        if (!groups.has(digits)) groups.set(digits, []);
        groups.get(digits)!.push(row);
      }
      for (const rows of groups.values()) {
        if (rows.length < 2) continue;
        console.log("[Inbox] merging", rows.length, "duplicate threads for the same number:", rows.map(r => r.id));
        // "Alfred" is a placeholder too, same as a bare phone number — an
        // older thread created before that naming got fixed elsewhere
        // should never win as the canonical name once a real contact name
        // (or even just the raw number from the newer, correctly-named row)
        // is available to replace it with.
        const looksLikeRawNumber = (name: string, phone: string) => !name || normalizePhoneDigits(name) === normalizePhoneDigits(phone) || name.trim().toLowerCase() === "alfred";
        const canonical = rows.find(r => !looksLikeRawNumber(r.contact_name, r.contact_phone))
          || [...rows].sort((a, b) => (b.messages?.length || 0) - (a.messages?.length || 0))[0];
        const others = rows.filter(r => r.id !== canonical.id);
        const allMessages = dedupeMessages(rows.flatMap(r => Array.isArray(r.messages) ? r.messages : [])).sort((a: any, b: any) => (a.ts || 0) - (b.ts || 0));
        const bestName = rows.find(r => !looksLikeRawNumber(r.contact_name, r.contact_phone))?.contact_name || rows[0].contact_phone || canonical.contact_name;
        const bestCustomerId = rows.find(r => r.customer_id)?.customer_id || null;
        const anyUnread = rows.some(r => r.unread);
        await (supabase as any).from("inbox_threads").update({
          contact_name: bestName,
          customer_id: bestCustomerId,
          messages: allMessages,
          unread: anyUnread,
          last_message_at: allMessages[allMessages.length - 1]?.ts || canonical.last_message_at,
          updated_at: new Date().toISOString(),
        }).eq("id", canonical.id);
        // BUG FIX — "sometimes it looks like it deletes messages... the
        // Alfred response disappears." The `others` rows below get
        // permanently DELETED, but `allMessages` was computed from the
        // initial SELECT at the top of this function — if Twilio's inbound
        // webhook or the Alfred SMS agent wrote a NEW message into one of
        // these `others` rows in the gap between that SELECT and this
        // DELETE (a real, not-rare window: this merge is triggered by
        // texting Alfred, which is exactly when Alfred's own reply lands
        // moments later), that message was never in `allMessages` and this
        // deleted the only row that had it — gone, not just delayed. Re-fetch
        // each `other` row immediately before deleting it and fold in any
        // message it gained since the initial snapshot.
        for (const other of others) {
          const { data: freshOther } = await (supabase as any).from("inbox_threads").select("messages").eq("id", other.id).maybeSingle();
          const freshMsgs: any[] = Array.isArray(freshOther?.messages) ? freshOther.messages : [];
          const staleMsgs: any[] = Array.isArray(other.messages) ? other.messages : [];
          const newSinceSnapshot = freshMsgs.filter(m => !staleMsgs.some((s: any) => (m.id && s.id === m.id) || (m.sid && s.sid === m.sid)));
          if (newSinceSnapshot.length > 0) {
            const { data: canonNow } = await (supabase as any).from("inbox_threads").select("messages,last_message_at").eq("id", canonical.id).maybeSingle();
            const mergedAgain = dedupeMessages([...(Array.isArray(canonNow?.messages) ? canonNow.messages : allMessages), ...newSinceSnapshot]).sort((a: any, b: any) => (a.ts || 0) - (b.ts || 0));
            await (supabase as any).from("inbox_threads").update({
              messages: mergedAgain,
              last_message_at: mergedAgain[mergedAgain.length - 1]?.ts || canonNow?.last_message_at,
              updated_at: new Date().toISOString(),
            }).eq("id", canonical.id);
          }
          await (supabase as any).from("inbox_threads").delete().eq("id", other.id);
        }
      }
    } catch (e: any) {
      console.warn("[Inbox] duplicate-thread merge failed:", e?.message);
    }
  };
  useEffect(() => {
    let cancelled = false;
    const loadInboxThreads = async () => {
      try {
        await mergeDuplicateInboxThreads();
        const { data, error } = await (supabase as any).from("inbox_threads").select("*").eq("channel", "sms");
        if (error) { console.warn("[Inbox] inbox_threads fetch failed — run the inbox_threads SQL:", error.message); return; }
        if (cancelled || !Array.isArray(data)) return;
        const fromServer = data.map(normalizeInboxThread);
        setThreads((prev: any[]) => {
          const byId = new Map(fromServer.map(t => [t.id, t]));
          // ISSUE 1 (round 8) — this used to wholesale-replace an EXISTING
          // thread's messages with whatever the server had, even if a message
          // had just been optimistically added locally (e.g. a manual send —
          // see send() below) but hadn't finished its own upsert yet. This
          // effect re-runs on every realtime change to inbox_threads for the
          // WHOLE table (any row, any column, any other conversation), so it
          // could fire mid-send and silently wipe the just-composed message
          // from view before it ever synced — a message the owner just typed
          // vanishing (or a later poll re-adding it via a different path with
          // different metadata) is exactly the kind of thing that reads as
          // "my message showed up wrong." Merge in any locally-known message
          // the server fetch doesn't have yet, instead of dropping it.
          const merged = fromServer.map(t => {
            const local = prev.find(p => p.id === t.id);
            if (!local || !Array.isArray(local.messages) || local.messages.length === 0) return t;
            const serverIds = new Set(t.messages.map((m: any) => m.id));
            const pendingLocal = local.messages.filter((m: any) => !serverIds.has(m.id));
            if (pendingLocal.length === 0) return t;
            const combined = dedupeMessages([...t.messages, ...pendingLocal]).sort((a: any, b: any) => (a.ts || 0) - (b.ts || 0));
            return { ...t, messages: combined };
          });
          // Keep any local sms thread not yet confirmed server-side (e.g. a message
          // just sent, before its own upsert lands) so it doesn't flicker away.
          // BUG FIX — "still shows two conversations for the same number."
          // This used to keep a local-only thread FOREVER once loaded into
          // this tab's state, with no way to tell "still syncing" apart
          // from "no longer exists server-side" (e.g. merged/deleted by the
          // dedupe cleanup, or on another device). A tab that had the old
          // duplicate loaded before a merge ran would keep showing it
          // indefinitely — only a full reload (fresh, empty `prev`) ever
          // cleared it. Cap it to 5 minutes past its newest message; a real
          // pending send resolves within seconds, so anything older than
          // that and still missing from the server is stale, not pending.
          const FIVE_MIN = 5 * 60000;
          const localOnlySms = prev.filter(t => {
            if (t.channel !== "sms" || byId.has(t.id)) return false;
            const newestTs = Math.max(0, ...(Array.isArray(t.messages) ? t.messages.map((m: any) => m.ts || 0) : []));
            return Date.now() - newestTs < FIVE_MIN;
          });
          const nonSms = prev.filter(t => t.channel !== "sms");
          return [...merged, ...localOnlySms, ...nonSms];
        });
      } catch (e: any) {
        console.warn("[Inbox] inbox_threads fetch threw:", e?.message);
      }
    };
    loadInboxThreads();
    // EGRESS FIX — was an unconditional 3s poll; realtime below already
    // covers instant updates, this is now just the fallback.
    // ISSUE 7 (round 2) — widened 10s -> 20s. The realtime subscription
    // below is the actual instant-update path; this interval only exists to
    // recover from a missed realtime event, so it doesn't need to be tight.
    const interval = setInterval(() => { if (shouldPollInbox()) loadInboxThreads(); }, 20000);
    const channel = (supabase as any)
      .channel("inbox_threads_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_threads" }, () => { loadInboxThreads(); })
      .subscribe();
    return () => { cancelled = true; clearInterval(interval); (supabase as any).removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Upserts one sms thread's full row to Supabase — called after any local
  // mutation (send, incoming poll, mark read) so other devices/sessions see it.
  //
  // ISSUE 3/7 — this used to blindly overwrite the server's `messages`
  // array with whatever this session's local `t.messages` happened to be.
  // At least THREE independent writers can touch the same thread row
  // (this page's own send/poll, an employee's OTW/Running Late text via
  // logOutboundSmsToInbox in lib/messaging.ts, and Campaigns' bulk sends) —
  // if two writes raced, whichever landed second silently discarded any
  // message the other had just added, since each write only knew about
  // its OWN local snapshot. A message that got wiped this way would look
  // exactly like "a sent message is missing" or, once the array shifts,
  // like the whole conversation's dir/order looks wrong. Re-reads the
  // server's current messages right before writing and merges by message
  // id (local copy wins on conflict, since it reflects the freshest
  // status like "sent" vs "sending") instead of blind-overwriting.
  const syncThreadToSupabase = async (t: any) => {
    if (t.channel !== "sms") return;
    try {
      const { data: serverRow } = await (supabase as any).from("inbox_threads").select("messages").eq("id", t.id).maybeSingle();
      const serverMessages: any[] = Array.isArray(serverRow?.messages) ? serverRow.messages : [];
      const byId = new Map<string, any>();
      serverMessages.forEach(m => { if (m?.id) byId.set(m.id, m); });
      (t.messages || []).forEach((m: any) => { if (m?.id) byId.set(m.id, m); }); // local wins on conflict
      const merged = dedupeMessages(Array.from(byId.values()).sort((a, b) => (a.ts || 0) - (b.ts || 0)));
      const r: any = await (supabase as any).from("inbox_threads").upsert({
        id: t.id, channel: "sms", contact_name: t.contactName, contact_phone: t.contactPhone,
        customer_id: t.customerId || null, unread: !!t.unread, messages: merged,
        last_message_at: merged[merged.length - 1]?.ts || Date.now(), updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (r?.error) console.warn("[Inbox] thread sync failed:", r.error.message);
    } catch (e: any) {
      console.warn("[Inbox] thread sync threw:", e?.message);
    }
  };

  // ISSUE 6 (round 3) — opening a conversation used "smooth" scroll for the
  // very first render of a freshly-mounted, un-scrolled messages panel,
  // which animated from the top all the way down — reads as an ugly
  // instant "jump" rather than loading already at the right spot. Jump to
  // the correct position immediately when switching threads; only animate
  // for a new message arriving while a thread is already open.
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: "auto" }); }, [active]);
  useEffect(() => { if (active) msgEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeThread?.messages.length]);

  // Poll for incoming Twilio messages every 15s
  useEffect(() => {
    if (!settings.twilioSid && !settings.googleBackendUrl) return;
    const poll = async () => {
      setPolling(true);
      try {
        // BLOCKER — this used to max() over EVERY thread regardless of
        // channel. If Gmail activity (a separate channel merged into the
        // same `threads` array below) was more recent than the last real
        // SMS, `since` got pinned to that later email timestamp — any SMS
        // that arrived in the gap between the true last-SMS time and that
        // email time would never satisfy Twilio's DateSent> filter on any
        // future poll, permanently disappearing instead of just being late.
        const lastTs = Math.max(0, ...threadsRef.current.filter(t => t.channel === "sms").flatMap(t => t.messages.map((m: any) => m.ts)));
        const incoming = await pollTwilioIncoming(settings, new Date(lastTs).toISOString());
        if (incoming.length > 0) {
          // ISSUE 2/4 (round 6) — ROOT CAUSE of double-showing messages AND
          // duplicate opt-in/opt-out toasts: this used to generate a fresh
          // uid() for every message every poll and only checked for a
          // content match (dir/body/ts) against the CURRENT thread — but
          // functions/api/twilio-sms-webhook.ts (when configured) already
          // records the same inbound message the instant Twilio receives
          // it, using Date.now() as its ts, while this poll used Twilio's
          // own DateSent as ITS ts — two different clocks for the same
          // physical message, so the content-match check could never
          // reliably catch it as a duplicate, and the STOP/START handling
          // below ran a second time for a message the webhook had already
          // processed. Both sides now key on Twilio's own MessageSid, so a
          // message already present ANYWHERE in the current threads is
          // skipped entirely here — before the STOP/START side effects run,
          // not just before the final append.
          const knownSids = new Set<string>(
            threadsRef.current.flatMap(t => t.messages.map((m: any) => m.sid).filter(Boolean))
          );
          const touchedIds = new Set<string>();
          // ISSUE 2 (round 8) — ROOT CAUSE of the "N new messages" toast (and,
          // by extension, its accompanying opt-in/opt-out toast) firing
          // repeatedly with nothing actually new: this counted `incoming.length`
          // — Twilio's RAW fetch count for this poll — regardless of how many
          // of those messages the knownSids check below actually treated as
          // new. A poll that re-fetched 7 already-seen messages (e.g. because
          // `since` briefly regressed after a concurrent full-table refetch
          // reset threadsRef — see loadInboxThreads below) reported "7 new
          // messages" even though every single one was skipped. Track the
          // ACTUAL processed count instead.
          let newlyProcessedCount = 0;
          setThreads(prev => {
            let updated = [...prev];
            incoming.forEach(msg => {
              if (msg.sid && knownSids.has(msg.sid)) return; // already recorded (likely by the webhook) — skip entirely
              const phone = msg.from;
              const customer = customersRef.current.find(c => normalizePhoneDigits(c.phone) === normalizePhoneDigits(phone));
              const newMsg = { id: msg.sid || uid(), sid: msg.sid || null, dir: "in", body: msg.body, ts: msg.dateSent ? new Date(msg.dateSent).getTime() : Date.now() };

              // Handle STOP/UNSTOP opt-out keywords (Twilio compliance).
              // AUDIT FIX — this used to only toast; it never actually wrote
              // smsOptOut anywhere, so twilioSend's opt-out check (see
              // setOptedOutPhones in lib/messaging.ts) had nothing to block
              // on and a customer who replied STOP kept getting texted by
              // every automation/manual send in the app. This is a fallback
              // path only (fires while the owner's Inbox tab is open and
              // polling) — functions/api/twilio-sms-webhook.ts is the real,
              // always-on fix once configured as the Twilio Messaging
              // Service's inbound webhook URL.
              //
              // ISSUE 2 (round 8) — gated on notifiedSidsRef (localStorage-
              // backed, see above) rather than only on the knownSids check
              // above: knownSids is rebuilt from live thread state every poll
              // and can be briefly incomplete after a concurrent server
              // refetch, which previously let the SAME sid re-trigger this
              // toast on a later poll even though it had already fired once.
              const body = (msg.body || "").trim().toUpperCase();
              const alreadyNotified = !!(msg.sid && notifiedSidsRef.current.has(msg.sid));
              if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(body)) {
                if (customer?.id && setCustomers) {
                  setCustomers((prev: Customer[]) => prev.map(c => c.id === customer.id
                    ? { ...c, smsOptOut: true, optOutDate: today(), smsOptIn: false } as Customer
                    : c));
                  if (!alreadyNotified) toast("⛔ " + (customer.firstName || phone) + " replied STOP — unsubscribed");
                } else if (!alreadyNotified) {
                  toast("⛔ STOP received from unknown number " + phone + " — no matching customer to unsubscribe");
                }
                if (msg.sid) markSidNotified(msg.sid);
              } else if (["START", "UNSTOP", "YES"].includes(body)) {
                if (customer?.id && setCustomers) {
                  setCustomers((prev: Customer[]) => prev.map(c => c.id === customer.id
                    ? { ...c, smsOptOut: false, smsOptIn: true, smsOptInAt: new Date().toISOString() } as Customer
                    : c));
                }
                if (!alreadyNotified) toast("✅ " + (customer?.firstName || phone) + " re-subscribed");
                if (msg.sid) markSidNotified(msg.sid);
              }

              const existingThread = updated.find(t => t.channel === "sms" && normalizePhoneDigits(t.contactPhone) === normalizePhoneDigits(phone));
              if (existingThread) {
                // Belt-and-suspenders against the stale-closure duplicate bug
                // above: never append a message that's identical (dir/body/ts)
                // to one already in the thread.
                const isDup = existingThread.messages.some((m: any) => m.dir === newMsg.dir && m.body === newMsg.body && m.ts === newMsg.ts);
                if (!isDup) {
                  updated = updated.map(t => t.id === existingThread.id ? { ...t, unread: true, messages: [...t.messages, newMsg] } : t);
                  touchedIds.add(existingThread.id);
                  newlyProcessedCount++;
                }
              } else {
                const newThreadId = uid();
                updated = [{ id: newThreadId, channel: "sms", contactName: customer ? customer.firstName + " " + customer.lastName : phone, contactPhone: phone, contactEmail: "", customerId: customer?.id || null, unread: true, messages: [newMsg] }, ...updated];
                touchedIds.add(newThreadId);
                newlyProcessedCount++;
              }
            });
            touchedIds.forEach(id => { const t = updated.find(x => x.id === id); if (t) syncThreadToSupabase(t); });
            return updated;
          });
          if (newlyProcessedCount > 0) toast(newlyProcessedCount + " new message" + (newlyProcessedCount > 1 ? "s" : ""));
        }
      } catch { /* silent */ } finally { setPolling(false); }
    };
    poll();
    // ISSUE 7 (round 2) — widened 15s -> 30s. This hits Twilio's REST API
    // directly (real API usage, unlike the realtime-backed inbox_threads
    // poll above) and is now mostly a fallback: functions/api/
    // twilio-sms-webhook.ts persists inbound SMS straight to inbox_threads
    // the instant Twilio receives it (once configured as the Messaging
    // Service's inbound webhook — see that file's setup comment), which the
    // realtime subscription above already picks up instantly. This poll
    // only still matters for STOP/START detection on a deployment that
    // hasn't set up that webhook yet, or as a catch-up if it's briefly down.
    const h = setInterval(() => { if (shouldPollInbox()) poll(); }, 30000);
    return () => clearInterval(h);
  }, [settings.twilioSid, settings.googleBackendUrl]);

  // Load Gmail messages when Google is connected
  //
  // ROOT FIX (Inbox "keeps asking to reconnect Google") — this used to read
  // `gmailToken` directly (a raw access token, good for ~1hr) and treat a 401
  // from an ordinary, expected expiry EXACTLY like a real 403 permission
  // error: gate the token forever and show "reconnect required." Every other
  // Gmail-sending call site in this app (sendOwnerGmailOnly, Calendar sync)
  // goes through getFreshOwnerGoogleToken() first, which proactively
  // refreshes an expiring token using the stored refresh_token BEFORE it's
  // used — Inbox was the one place that skipped that step, so it hit an
  // expired token on essentially every session and asked the owner to fully
  // reconnect instead of silently refreshing like everywhere else. Now this
  // resolves a fresh token the same way, and persists any refresh back to
  // localStorage (setStoredGoogleToken) so gmailToken itself picks it up too.
  useEffect(() => {
    if (!gmailToken) {
      console.log("[GoogleConnect] Inbox — no gmail token available, skipping Gmail load");
      return;
    }
    // A new/different token (e.g. just reconnected) always gets a fresh
    // attempt, regardless of whether some OLDER token previously 403'd.
    if (gmailPermissionError && gmailToken === lastFailedGmailTokenRef.current) {
      console.log("[GoogleConnect] Inbox — skipping Gmail load, this token already failed with a permission error (reconnect required)");
      return;
    }
    if (gmailPermissionError && gmailToken !== lastFailedGmailTokenRef.current) {
      console.log("[GoogleConnect] Inbox — token changed since last failure, clearing permission-error gate and retrying");
      setGmailPermissionError(false);
      return; // the state flip above re-triggers this effect with a clean pass
    }
    let cancelled = false;
    setGmailLoading(true);
    (async () => {
      // Proactively refresh before using — mirrors sendOwnerGmailOnly/
      // getFreshOwnerGoogleToken's own pattern instead of waiting to hit a
      // 401 first.
      const freshToken = await getFreshOwnerGoogleToken(settings as any, (token, expiresAt) => {
        setStoredGoogleToken(token, expiresAt);
        // storedGoogle (React state) only otherwise refreshes on window
        // focus — without this, a refresh that happens mid-session leaves
        // `gmailToken` (and markRead's use of it below) pointing at the old,
        // now-replaced token until the tab loses and regains focus.
        setStoredGoogle(getStoredGoogleConnection());
      }) || gmailToken;
      if (cancelled) return;
      console.log("[GoogleConnect] Inbox — loading Gmail messages, token source:", freshToken === gmailToken ? (storedGoogle?.token ? "localStorage" : "settings (legacy)") : "proactively refreshed");
      return fetchGmailMessages(freshToken).then(msgs => ({ msgs, usedToken: freshToken }));
    })()
      .then((result) => {
        if (cancelled || !result) return;
        const { msgs } = result;
        // ISSUE 7 — this used to make ONE "thread" per individual Gmail
        // MESSAGE (id: "gmail-" + m.id), so a back-and-forth conversation
        // with several inbox messages from the same person showed up as
        // that many separate, disconnected conversations in the sidebar
        // instead of one thread — exactly "messages from the same
        // conversation appearing as separate incoming messages." Gmail's
        // API already tells us the real grouping via each message's
        // threadId; group by that instead.
        const byThread = new Map<string, typeof msgs>();
        msgs.forEach(m => { const arr = byThread.get(m.threadId) || []; arr.push(m); byThread.set(m.threadId, arr); });
        const gThreads = Array.from(byThread.entries()).map(([threadId, msgsInThread]) => {
          const sorted = [...msgsInThread].sort((a, b) => (new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0));
          const latest = sorted[sorted.length - 1];
          const nameMatch = latest.from.match(/^(.+?)\s*<(.+?)>$/);
          const contactName = nameMatch ? nameMatch[1].replace(/"/g, "").trim() : latest.from;
          const contactEmail = nameMatch ? nameMatch[2] : latest.from;
          return {
            id: "gmail-" + threadId,
            gmailThreadId: threadId,
            unreadGmailMessageIds: sorted.filter(m => !m.read).map(m => m.id),
            channel: "email" as const,
            contactName,
            contactEmail,
            contactPhone: "",
            customerId: null,
            unread: sorted.some(m => !m.read),
            messages: sorted.map(m => ({
              id: m.id,
              dir: "in",
              body: m.snippet,
              subject: m.subject,
              ts: new Date(m.date).getTime() || Date.now(),
            })),
          };
        });
        setGmailThreads(gThreads);
      })
      .catch((e: any) => {
        if (cancelled) return;
        // Reaching here now means a PROACTIVELY REFRESHED token (or a
        // refresh attempt that itself failed) still got a 401/403 — a real
        // permission/reconnect problem, not routine hourly expiry, which the
        // refresh step above already handles silently.
        if (e?.status === 403 || e?.status === 401) {
          console.error("[GoogleConnect] Inbox — Gmail " + e.status + " — disabling further Gmail calls for this token. Reconnect Google in Settings → Integrations.");
          lastFailedGmailTokenRef.current = gmailToken;
          setGmailPermissionError(true);
        } else {
          console.warn("[GoogleConnect] Inbox — Gmail load failed:", e?.message);
        }
      })
      .finally(() => { if (!cancelled) setGmailLoading(false); });
    return () => { cancelled = true; };
  }, [gmailToken, gmailPermissionError]);

  const markRead = id => {
    if (id.startsWith("gmail-")) {
      const gThread = gmailThreads.find(t => t.id === id);
      // Skip the API call entirely if there's nothing unread (repeat clicks
      // into an already-read thread used to keep re-firing markGmailRead
      // for no reason) or if Gmail has already told us this session lacks
      // permission for it.
      if (gThread?.unread && gmailToken && !gmailPermissionError) {
        const idsToMark: string[] = gThread.unreadGmailMessageIds?.length ? gThread.unreadGmailMessageIds : (gThread.gmailMessageId ? [gThread.gmailMessageId] : []);
        Promise.all(idsToMark.map((mid: string) => markGmailRead(gmailToken, mid))).catch((e: any) => {
          if (e?.status === 403 || e?.status === 401) {
            console.error("[GoogleConnect] Inbox — markGmailRead " + e.status + " — disabling further Gmail calls for this token. Reconnect Google in Settings → Integrations.");
            lastFailedGmailTokenRef.current = gmailToken;
            setGmailPermissionError(true);
          } else {
            console.warn("[GoogleConnect] Inbox — markGmailRead failed:", e?.message);
          }
        });
      }
      setGmailThreads(prev => prev.map(t => t.id === id ? { ...t, unread: false, unreadGmailMessageIds: [] } : t));
    } else {
      const next = threads.map(t => t.id === id ? { ...t, unread: false } : t);
      setThreads(next);
      const t = next.find(x => x.id === id);
      if (t) syncThreadToSupabase(t);
    }
  };

  const send = async () => {
    if (!input.trim() || !activeThread || sending) return;
    const msgText = input.trim();
    const outMsg = { id: uid(), dir: "out", body: msgText, ts: Date.now(), status: "sending" };
    const isGmail = !!(activeThread as any).gmailMessageId;
    // Optimistic add
    if (isGmail) {
      setGmailThreads(prev => prev.map(t => t.id === active ? { ...t, messages: [...t.messages, outMsg] } : t));
    } else {
      setThreads(prev => prev.map(t => t.id === active ? { ...t, messages: [...t.messages, outMsg] } : t));
      // ISSUE 1 (round 8) — sync this message to Supabase RIGHT NOW, not only
      // after twilioSend resolves. Previously the message sat in local-only
      // state for the whole duration of the outbound API call; if a realtime
      // refresh (any inbox_threads change, any conversation) landed during
      // that window, the old wholesale-replace in loadInboxThreads (fixed
      // above) could wipe it before it was ever written — after which
      // finishing the send couldn't re-attach "sent" status either, since the
      // message was gone from local state to match against. Persisting it
      // immediately, with dir "out" already set, closes that window: even if
      // a concurrent refetch runs a moment later, the merge fix above will
      // already find this message on the server and keep it correctly.
      syncThreadToSupabase({ ...activeThread, messages: [...activeThread.messages, outMsg] });
    }
    setInput("");
    setSending(true);
    const updateMsg = (status: string, extra: any = {}) => {
      if (isGmail) {
        setGmailThreads(prev => prev.map(t => t.id === active ? { ...t, messages: t.messages.map(m => m.id === outMsg.id ? { ...m, status, ...extra } : m) } : t));
      } else {
        setThreads(prev => {
          const next = prev.map(t => t.id === active ? { ...t, messages: t.messages.map(m => m.id === outMsg.id ? { ...m, status, ...extra } : m) } : t);
          const t = next.find(x => x.id === active);
          if (t) syncThreadToSupabase(t);
          return next;
        });
      }
    };
    try {
      if (activeThread.channel === "sms") {
        if (!activeThread.contactPhone) throw new Error("No phone number for this contact");
        await twilioSend(settings, activeThread.contactPhone, msgText);
        updateMsg("sent");
        toast("SMS sent ✓");
      } else {
        if (!activeThread.contactEmail) throw new Error("No email for this contact");
        const lastSubject = activeThread.messages.find(m => m.subject)?.subject || "";
        if (isGmail && gmailToken) {
          const gmailFromEmail = storedGoogle?.email || (settings as any)?.googleEmail || "";
          await sendGmailMessage(gmailToken, activeThread.contactEmail, "Re: " + lastSubject, msgText, gmailFromEmail);
        } else {
          await sendEmail(settings, { to: activeThread.contactEmail, subject: "Re: " + lastSubject, body: msgText });
        }
        updateMsg("sent");
        toast("Email sent ✓");
      }
    } catch (err) {
      updateMsg("failed", { error: err.message });
      toast("Send failed: " + err.message, "error");
    } finally { setSending(false); }
  };

  const startNew = async () => {
    if (!newDraft.to.trim() || !newDraft.body.trim()) return;
    const customer = customers.find(c => c.firstName + " " + c.lastName === newDraft.to.trim() || c.phone?.includes(newDraft.phone) || c.email === newDraft.email);
    if (newDraft.channel === "sms" && !newDraft.phone) { toast("Enter a phone number", "error"); return; }
    if (newDraft.channel === "email" && !newDraft.email) { toast("Enter an email", "error"); return; }
    const outMsg = { id: uid(), dir: "out", body: newDraft.body, ts: Date.now(), status: "sending", subject: newDraft.subject };
    // ISSUE 7 — this always created a brand-new thread, even when one
    // already existed for the same phone/email — "New Message" to someone
    // you already had a conversation with silently forked it into a second,
    // disconnected thread instead of continuing the real one.
    let existing = newDraft.channel === "sms"
      ? threads.find(t => t.channel === "sms" && t.contactPhone && newDraft.phone && normalizePhoneDigits(t.contactPhone) === normalizePhoneDigits(newDraft.phone))
      : threads.find(t => t.channel === "email" && t.contactEmail && newDraft.email && t.contactEmail.toLowerCase() === newDraft.email.toLowerCase());
    // ISSUE 1 (round 8) — the local `threads` state above only knows about
    // conversations already loaded into this session. If Twilio's inbound
    // webhook (functions/api/twilio-sms-webhook.ts) already created a server
    // row for this exact phone number — e.g. this contact texted the opt-in
    // keyword moments ago and this session's periodic/realtime refresh
    // hasn't caught up yet — composing "New Message" here used to mint a
    // SECOND, disconnected thread row for the same phone number instead of
    // reusing that one. That leaves the conversation split across two rows:
    // one holding only the webhook's inbound message, one holding only this
    // outbound reply — from inside the "wrong" half it looks exactly like
    // "my sent message never shows up with their replies." Check the server
    // directly by phone before deciding to create a new row.
    if (!existing && newDraft.channel === "sms" && newDraft.phone) {
      try {
        const digits = normalizePhoneDigits(newDraft.phone);
        const { data } = await (supabase as any).from("inbox_threads").select("*").eq("channel", "sms");
        const serverMatch = Array.isArray(data) ? data.find((r: any) => normalizePhoneDigits(r.contact_phone) === digits && digits) : null;
        if (serverMatch) existing = normalizeInboxThread(serverMatch);
      } catch (e: any) {
        console.warn("[Inbox] startNew server thread lookup failed, creating new thread:", e?.message);
      }
    }
    const threadId = existing?.id || uid();
    let composedThread: any;
    if (existing) {
      const alreadyLocal = threads.some(t => t.id === existing.id);
      composedThread = { ...existing, messages: [...existing.messages, outMsg] };
      if (alreadyLocal) {
        setThreads(prev => prev.map(t => t.id === threadId ? composedThread : t));
      } else {
        // Found server-side but this session's local `threads` doesn't have
        // it yet — hydrate it in now instead of waiting for the next poll.
        setThreads(prev => [composedThread, ...prev]);
      }
    } else {
      composedThread = { id: threadId, channel: newDraft.channel, contactName: newDraft.to, contactPhone: newDraft.phone, contactEmail: newDraft.email, customerId: customer?.id || null, unread: false, messages: [outMsg] };
      setThreads(prev => [composedThread, ...prev]);
    }
    if (newDraft.channel === "sms") syncThreadToSupabase(composedThread);
    setActive(threadId);
    setNewModal(false);
    const finalize = (status: "sent" | "failed", extra: any = {}) => {
      setThreads(prev => {
        const next = prev.map(t => t.id === threadId ? { ...t, messages: t.messages.map(m => m.id === outMsg.id ? { ...m, status, ...extra } : m) } : t);
        const t = next.find(x => x.id === threadId);
        if (t) syncThreadToSupabase(t);
        return next;
      });
    };
    try {
      if (newDraft.channel === "sms") {
        await twilioSend(settings, newDraft.phone, newDraft.body);
      } else {
        await sendEmail(settings, { to: newDraft.email, subject: newDraft.subject, body: newDraft.body });
      }
      finalize("sent");
      toast(existing ? "Sent ✓ (added to existing conversation)" : "Sent ✓");
    } catch (err) {
      finalize("failed", { error: err.message });
      toast("Send failed: " + err.message + (err.message.includes("Twilio not configured") ? " — add Twilio credentials in Settings" : ""), "error");
    }
    setNewDraft({ channel: "sms", to: "", phone: "", email: "", subject: "", body: "" });
  };

  const allThreads = [...threads, ...gmailThreads];
  // ISSUE 4 — no way to view just Email or just SMS, only a combined list
  // with no way to tell them apart besides a small colored dot.
  // ISSUE 12 (round 11) — this reset to "all" on every reload/navigation
  // away and back, even though the owner had deliberately switched to just
  // SMS or just Email. Persisted the same way as the other Inbox view
  // preferences (hiddenThreadIds, nicknameOverrides) below.
  const [channelView, setChannelView] = usePersistent<"all" | "sms" | "email">("crm.inboxChannelView", "all");
  // ISSUE 6 — no sort or unread-only filter existed at all, just substring
  // search.
  const [sortBy, setSortBy] = useState<"recent" | "sender" | "unread">("recent");
  const [unreadOnly, setUnreadOnly] = useState(false);
  // ISSUE 7 (round 3) — date-range filter, on top of the existing sort/unread controls.
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");
  // ISSUE 4 (round 3) — the three-dot menu did nothing; hide is a local-only
  // preference (doesn't touch other devices' view of the same server data),
  // delete removes the row from Supabase for sms threads (gmail/local-only
  // threads have no server row to delete).
  const [hiddenThreadIds, setHiddenThreadIds] = usePersistent<string[]>("crm.inboxHiddenThreadIds", []);
  const [showHidden, setShowHidden] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  // ISSUE 3 (round 6) — nickname/rename. "sms" threads are backed by a real
  // inbox_threads row with its own contact_name column, so renaming one
  // updates that column directly (synced cross-device, same as any other
  // field on the row). Gmail/local threads have no server row to update —
  // for those the override lives in localStorage only, applied at display
  // time via displayName() below.
  const [nicknameOverrides, setNicknameOverrides] = usePersistent<Record<string, string>>("crm.inboxNicknames", {});
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const displayName = (t: any) => nicknameOverrides[t.id] || t.contactName;
  const startRename = (t: any) => {
    setRenamingId(t.id);
    setRenameDraft(displayName(t));
    setMenuOpenId(null);
  };
  const saveRename = async (t: any) => {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (!name || name === displayName(t)) return;
    if (t.channel === "sms") {
      setThreads((prev: any[]) => prev.map(x => x.id === t.id ? { ...x, contactName: name } : x));
      // Also keep it as this device's nickname, so a refresh that brings
      // back the old name (server didn't take the change) can't undo it here.
      setNicknameOverrides((prev: Record<string, string>) => ({ ...prev, [t.id]: name }));
      try {
        const r: any = await (supabase as any).from("inbox_threads").update({ contact_name: name }).eq("id", t.id).select("id");
        if (r?.error) toast("Renamed locally, but failed to sync — " + r.error.message, "red");
        else if (!r?.data?.length) toast("Renamed on this device, but the server didn't save it", "red");
      } catch (e: any) {
        toast("Renamed locally, but failed to sync — " + (e?.message || "unknown error"), "error");
      }
    } else {
      setNicknameOverrides((prev: Record<string, string>) => ({ ...prev, [t.id]: name }));
    }
    toast("Renamed to " + name + " ✓");
  };
  const hideThread = (id: string) => {
    setHiddenThreadIds((prev: string[]) => prev.includes(id) ? prev : [...prev, id]);
    setMenuOpenId(null);
    toast("Conversation hidden");
  };
  const unhideThread = (id: string) => {
    setHiddenThreadIds((prev: string[]) => prev.filter(x => x !== id));
  };
  const deleteThread = async (t: any) => {
    setMenuOpenId(null);
    if (t.channel === "sms") {
      try {
        const r: any = await (supabase as any).from("inbox_threads").delete().eq("id", t.id).select("id");
        if (r?.error) { toast("Delete failed: " + r.error.message, "error"); return; }
        if (!Array.isArray(r?.data) || r.data.length === 0) { toast("Delete failed: the server didn't remove this conversation", "error"); return; }
      } catch (e: any) {
        toast("Delete failed: " + (e?.message || "unknown error"), "error");
        return;
      }
      setThreads((prev: any[]) => prev.filter(x => x.id !== t.id));
    } else {
      setGmailThreads(prev => prev.filter(x => x.id !== t.id));
    }
    if (active === t.id) setActive(null);
    toast("Conversation deleted");
  };
  // ISSUE 3 (round 9) — copy a single message's text to the clipboard. Bubble
  // text also has `select-text` (see render below) so manual drag-select +
  // Ctrl/Cmd-C works too; this is just a one-click shortcut for it.
  const copyMessage = async (body: string) => {
    try {
      await navigator.clipboard.writeText(body || "");
      toast("Copied ✓");
    } catch {
      toast("Couldn't copy automatically — select the text and copy manually", "error");
    }
  };
  // ISSUE 3 (round 9) — per-message delete. This removes the message from
  // the CRM's own record (inbox_threads / this session's Gmail view), not
  // from Twilio's or Gmail's own server-side history — Twilio does expose a
  // DELETE-message endpoint, but calling it would permanently erase the
  // carrier-side delivery record too (no undo, and it'd need a new backend
  // proxy + the account's Twilio credentials round-tripped again), which is
  // more than "let the owner clean up an accidental send" calls for. This is
  // the same fallback the owner already has for whole conversations
  // (deleteThread above) — hide/remove it from the CRM view.
  //
  // Deliberately does NOT reuse syncThreadToSupabase — that helper is
  // union/merge-based by design (never drops a message either side already
  // has, so concurrent writers can't stomp each other — see its own
  // comments), which would silently un-delete this message on the very next
  // sync. Deletion needs an explicit overwrite of the server's message list.
  const deleteMessage = async (t: any, messageId: string) => {
    const isGmailThread = !!(t as any).gmailMessageId || (t.id || "").startsWith("gmail-");
    if (isGmailThread) {
      // No Gmail delete/trash scope wired up here — remove from this CRM
      // view only; the real email is untouched in the owner's mailbox.
      setGmailThreads(prev => prev.map(x => x.id === t.id ? { ...x, messages: x.messages.filter((m: any) => m.id !== messageId) } : x));
      toast("Removed from CRM view (source email is unaffected)");
      return;
    }
    setThreads((prev: any[]) => prev.map(x => x.id === t.id ? { ...x, messages: x.messages.filter((m: any) => m.id !== messageId) } : x));
    if (t.channel !== "sms") { toast("Message deleted"); return; }
    try {
      const { data: serverRow } = await (supabase as any).from("inbox_threads").select("messages").eq("id", t.id).maybeSingle();
      const serverMessages: any[] = Array.isArray(serverRow?.messages) ? serverRow.messages : [];
      const filtered = serverMessages.filter((m: any) => m.id !== messageId);
      const r: any = await (supabase as any).from("inbox_threads").update({ messages: filtered, updated_at: new Date().toISOString() }).eq("id", t.id);
      if (r?.error) { toast("Deleted locally, but failed to sync — " + r.error.message, "error"); return; }
      toast("Message deleted");
    } catch (e: any) {
      toast("Deleted locally, but failed to sync — " + (e?.message || "unknown error"), "error");
    }
  };
  // ISSUE 5 (round 3) — convert a conversation's contact into a real customer
  // lead, same insert shape LeadFormPage.tsx uses (customers table, pipelineStage "lead").
  const convertToLead = async (t: any) => {
    setMenuOpenId(null);
    if (!setCustomers) { toast("Can't create customers from this view", "error"); return; }
    const existing = findCustomer(t);
    const name = nicknameOverrides[t.id] || t.contactName;
    if (existing) { toast((name || "This contact") + " is already a customer"); return; }
    const nameParts = (name || "").trim().split(/\s+/);
    const newCustomer: any = {
      id: uid(),
      firstName: nameParts[0] || name || "Unknown",
      lastName: nameParts.slice(1).join(" ") || "",
      phone: t.contactPhone || "",
      email: t.contactEmail || "",
      pipelineStage: "lead",
      createdAt: new Date().toISOString(),
      // BUG FIX — missing owner_id violated the owner_id-scoped RLS policy
      // added by the multi-tenant migration, silently rejecting every
      // "convert to lead" insert from the Inbox.
      owner_id: ownerId,
    };
    try {
      const r: any = await (supabase as any).from("customers").insert(newCustomer);
      if (r?.error) { toast("Failed to create lead: " + r.error.message, "error"); return; }
    } catch (e: any) {
      toast("Failed to create lead: " + (e?.message || "unknown error"), "error");
      return;
    }
    setCustomers((prev: Customer[]) => [newCustomer, ...prev]);
    toast("✅ Lead created for " + (t.contactName || "contact"));
  };
  // FEATURE — "convert to work order" button for an incoming email/text —
  // same idea as convertToLead above, but reads the thread's own message
  // text with an AI model (text-only extraction, so any configured provider
  // works, unlike WorkOrdersPage.tsx's photo-scan flow which needs Claude
  // specifically for vision) and creates a real commercial work-order Job
  // (migration 0094 fields) instead of a customer lead.
  const [convertingWorkOrderId, setConvertingWorkOrderId] = useState<string | null>(null);
  const convertToWorkOrder = async (t: any) => {
    setMenuOpenId(null);
    if (!setJobs) { toast("Can't create jobs from this view", "error"); return; }
    if (convertingWorkOrderId) return;
    const priority: string[] = (settings as any)?.modelPriority || ["claude", "openai", "gemini", "groq", "mistral"];
    const modelKeys = (settings as any)?.modelKeys || {};
    const modelId = priority.find((mid: string) => { const m = (MODELS as any)[mid]; return m && (!m.needsKey || !!modelKeys[mid]); });
    if (!modelId) { toast("Add an AI model key in Settings → AI Models first.", "red"); return; }
    setConvertingWorkOrderId(t.id);
    try {
      const text = (t.messages || []).map((m: any) => m.body).filter(Boolean).join("\n---\n").slice(0, 6000);
      if (!text.trim()) { toast("This conversation has no message text to read.", "red"); return; }
      const res = await callModel({
        modelId,
        systemPrompt: "You read a commercial-client email/text conversation for a service/commercial-services business and extract a work order. Reply with ONLY compact JSON, no prose, no markdown fences: {\"workOrderNumber\":string,\"workOrderClient\":string,\"address\":string,\"requestedDate\":string (YYYY-MM-DD if a real date is stated, else empty),\"requiresManagerSignoff\":boolean,\"notes\":string,\"photoRequirements\":[{\"label\":string,\"kind\":\"photo\"|\"video\",\"minCount\":number,\"instructions\":string}]}. Never invent a work order number, date, or requirement that isn't actually stated in the text — leave those fields empty/omit them rather than guessing.",
        messages: [{ role: "user", content: `Conversation:\n${text}` }],
        maxTokens: 1200,
      });
      const raw = (res?.text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch { throw new Error("Couldn't read a valid response from the model — try Convert to Work Order again, or create it manually in Work Orders."); }
      let existing = findCustomer(t);
      let customerId = existing?.id;
      if (!customerId) {
        const name = nicknameOverrides[t.id] || t.contactName || "Unknown";
        const nameParts = (name || "").trim().split(/\s+/);
        const newCustomer: any = { id: uid(), firstName: nameParts[0] || name, lastName: nameParts.slice(1).join(" ") || "", phone: t.contactPhone || "", email: t.contactEmail || "", createdAt: new Date().toISOString(), owner_id: ownerId };
        const { data, error } = await (supabase as any).from("customers").insert(newCustomer).select().single();
        if (error || !data) throw new Error(error?.message || "Couldn't create a customer for this contact");
        customerId = data.id;
        setCustomers?.((prev: Customer[]) => [data, ...prev]);
      }
      const photoRequirements = Array.isArray(parsed.photoRequirements)
        ? parsed.photoRequirements.map((r: any) => ({ id: uid(), label: String(r.label || ""), kind: r.kind === "video" ? "video" : "photo", minCount: Math.max(1, Number(r.minCount) || 1), instructions: String(r.instructions || "") })).filter((r: any) => r.label)
        : [];
      const newJob: any = {
        id: uid(), customerId,
        address: String(parsed.address || ""), amount: 0, status: "scheduled",
        scheduledDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.requestedDate) ? parsed.requestedDate : today(),
        scheduledTime: "", priority: "normal", jobType: "commercial", notes: String(parsed.notes || ""),
        crew: [], checklist: [], photos: [], commLog: [], chemicalsUsed: [], equipment: [], tags: [],
        loggedHours: 0, createdAt: today(), owner_id: ownerId,
        isWorkOrder: true, workOrderNumber: String(parsed.workOrderNumber || ""), workOrderClient: String(parsed.workOrderClient || ""),
        requiresManagerSignoff: !!parsed.requiresManagerSignoff, photoRequirements,
      };
      const { data: saved, error: saveErr } = await (supabase as any).from("jobs").insert(newJob).select().single();
      if (saveErr || !saved) throw new Error(saveErr?.message || "Couldn't save the job");
      setJobs((prev: any[]) => [...prev, saved]);
      toast("✅ Work order created — review it in Work Orders", "green");
      onNav?.("workorders");
    } catch (e: any) {
      toast("Couldn't create work order — " + (e?.message || "unknown error"), "red");
    } finally {
      setConvertingWorkOrderId(null);
    }
  };
  // ISSUE 5 — a thread only ever showed contactName; the matching customer
  // record's tags (set up in CustomersPage — see its folder/tag system)
  // never surfaced here, so there was no way to tell at a glance who's a
  // VIP/problem customer/etc. straight from the inbox. Threads created by
  // the incoming-SMS poll set customerId when a phone match is found;
  // gmail threads never do (no customer FK on a raw email), so also try a
  // live email match as a fallback.
  // FEATURE — tap the photo or name in a conversation to open that
  // customer's file right here (pop-up), with a working Edit.
  const [profileCustomerId, setProfileCustomerId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const profileCustomer = profileCustomerId ? customers.find((c: any) => c.id === profileCustomerId) || null : null;
  const openProfile = (t: any) => {
    const c = findCustomer(t);
    if (c) setProfileCustomerId(c.id);
    else toast("This number isn't a customer yet — use Convert to Lead to add them", "yellow");
  };
  const saveEditedCustomer = (d: any) => {
    const record = { ...(customers.find((c: any) => c.id === d.id) || {}), ...d };
    setCustomers((prev: any[]) => prev.map((c: any) => c.id === record.id ? record : c));
    setEditingCustomer(null);
    saveCustomersTolerant([record])
      .then(r => { if (r.failed) toast("Saved here, but failed to sync — " + r.error, "red"); else toast("Customer saved ✓", "green"); })
      .catch((e: any) => toast("Saved here, but failed to sync — " + (e?.message || "unknown error"), "red"));
  };
  const findCustomer = (t: any) => {
    if (t.customerId) return customers.find(c => c.id === t.customerId);
    if (t.contactEmail) return customers.find(c => c.email && c.email.toLowerCase() === t.contactEmail.toLowerCase());
    if (t.contactPhone) return customers.find(c => c.phone && normalizePhoneDigits(c.phone) === normalizePhoneDigits(t.contactPhone));
    return null;
  };
  const dateRangeCutoff = (() => {
    if (dateRange === "all") return 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (dateRange === "today") return d.getTime();
    if (dateRange === "week") return d.getTime() - 6 * 86400000;
    return d.getTime() - 29 * 86400000; // month
  })();
  const filteredThreads = allThreads
    .filter(t => showHidden ? hiddenThreadIds.includes(t.id) : !hiddenThreadIds.includes(t.id))
    .filter(t => channelView === "all" || t.channel === channelView)
    .filter(t => !unreadOnly || t.unread)
    .filter(t => dateRange === "all" || (t.messages[t.messages.length - 1]?.ts || 0) >= dateRangeCutoff)
    .filter(t => !search || (t.contactName || "").toLowerCase().includes(search.toLowerCase()) || t.messages.some(m => (m.body || "").toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => {
      if (sortBy === "sender") return (a.contactName || "").localeCompare(b.contactName || "");
      if (sortBy === "unread") return (b.unread ? 1 : 0) - (a.unread ? 1 : 0);
      const aLast = a.messages[a.messages.length - 1]?.ts || 0;
      const bLast = b.messages[b.messages.length - 1]?.ts || 0;
      return bLast - aLast;
    });
  const twilioReady = !!(settings.twilioSid && settings.twilioToken && settings.twilioFrom);
  const emailReady = !!gmailToken;
  const relTime = ts => { const s = Math.floor((Date.now() - ts) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s/60)+"m"; if (s < 86400) return Math.floor(s/3600)+"h"; return Math.floor(s/86400)+"d"; };

  return (
    // FIX (mobile) — was a fixed `height: calc(100vh - 57px)` guess plus a
    // negative-margin bleed against the old padded page wrapper. App.tsx now
    // gives the Inbox page the same no-padding flex-column treatment as
    // Alfred (see the FIX 19 comment there), so this just needs to fill that
    // real flex-1 space — no vh math, no bleed margins to fight it.
    <div className="flex flex-1 min-h-0 bg-black overflow-hidden rounded-xl border border-brand-900/30">
      {/* Thread list */}
      <div className="w-full md:w-80 border-r border-brand-900/30 flex flex-col min-h-0 flex-shrink-0" style={{ display: activeThread && window.innerWidth < 768 ? "none" : "flex" }}>
        <div className="p-3 border-b border-brand-900/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="font-semibold flex items-center gap-2"><MessageSquare size={14} className="text-white/70" />Inbox <span className="text-[10px] text-white/50">{allThreads.filter(t => t.unread).length > 0 ? allThreads.filter(t => t.unread).length + " unread" : "all read"}</span></div>
            <div className="flex items-center gap-1.5">
              {(polling || gmailLoading) && <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" title="Loading messages" />}
              <button onClick={() => setNewModal(true)} className="p-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-brand-fg" title="New message"><Plus size={14} /></button>
            </div>
          </div>
          <div className="relative"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="w-full bg-black/40 border border-brand-900/30 rounded-lg pl-7 pr-2 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-brand-500/60" /></div>
          {/* ISSUE 4 — Email / SMS / Combined channel switch */}
          <div className="flex gap-1 p-0.5 bg-black/40 border border-white/10 rounded-lg">
            {([["all", "All"], ["sms", "SMS"], ["email", "Email"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setChannelView(k)} className={"flex-1 text-[10px] py-1 rounded font-medium transition " + (channelView === k ? "bg-brand-700/60 text-brand-fg" : "text-white/40 hover:text-white/60")}>{l}</button>
            ))}
          </div>
          {/* ISSUE 6 — sort + unread-only filter */}
          <div className="flex items-center gap-1.5">
            <GSel value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="!text-[10px] !py-1.5 flex-1">
              <option value="recent">Sort: Most recent</option>
              <option value="sender">Sort: Sender A-Z</option>
              <option value="unread">Sort: Unread first</option>
            </GSel>
            <button onClick={() => setUnreadOnly(v => !v)} className={"flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition " + (unreadOnly ? "bg-brand-900/40 border-brand-600/50 text-white" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}>
              Unread only
            </button>
          </div>
          {/* ISSUE 7 (round 3) — date-range filter */}
          <div className="flex items-center gap-1.5">
            <GSel value={dateRange} onChange={e => setDateRange(e.target.value as any)} className="!text-[10px] !py-1.5 flex-1">
              <option value="all">Any date</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </GSel>
            <button onClick={() => setShowHidden(v => !v)} title="Show hidden conversations" className={"flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-medium border transition " + (showHidden ? "bg-brand-900/40 border-brand-600/50 text-white" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}>
              {showHidden ? <><Eye size={10} className="inline mr-1" />Hidden ({hiddenThreadIds.length})</> : <EyeOff size={10} className="inline mr-1" />}
              {!showHidden && "Hidden"}
            </button>
          </div>
          {(!twilioReady && !emailReady) && <div className="text-[9px] text-yellow-400/80 bg-yellow-950/20 border border-yellow-800/30 rounded px-2 py-1">⚠ Connect Twilio or Gmail in Settings to send/receive</div>}
          {/* ISSUE 8 — a text-only banner made "reconnect" a multi-page hunt
              (Settings → Integrations → find the button). Fire the same
              OAuth flow (with gmail.modify included) directly from here. */}
          {gmailPermissionError && (
            <div className="text-[9px] text-brand-400/90 bg-brand-950/20 border border-brand-800/30 rounded px-2 py-1.5 flex items-center justify-between gap-2">
              <span>⚠ Gmail needs to be reconnected to restore email in the inbox.</span>
              <button
                onClick={() => {
                  rememberOAuthReturnPage("inbox");
                  supabase.auth.signInWithOAuth({
                    provider: "google",
                    options: {
                      redirectTo: window.location.origin + window.location.pathname,
                      scopes: "email profile https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/drive.readonly",
                      queryParams: { access_type: "offline", prompt: "consent" },
                    },
                  });
                }}
                className="flex-shrink-0 px-2 py-0.5 rounded bg-brand-800/50 hover:bg-brand-700/60 text-brand-fg font-semibold"
              >
                Reconnect
              </button>
            </div>
          )}
        </div>
        {/* BUG FIX (user report) — "I can slide the messages to the right,
            moving the conversation off screen... locked so you can't move
            it left or right." On mobile Safari/Chrome a horizontal swipe
            over scrollable content is read as a "swipe back" page-navigation
            gesture, sliding the whole view off screen — touch-action:pan-y
            restricts touch scrolling here to vertical only, and
            overscroll-x-none stops any residual horizontal rubber-banding,
            so a swipe can never be mistaken for that gesture. Vertical
            scroll/tap-to-open are untouched. */}
        <div className="flex-1 overflow-y-auto overscroll-x-none [touch-action:pan-y]">
          {filteredThreads.length === 0 && <div className="text-center py-10 text-xs text-white/40">No conversations{search || unreadOnly || channelView !== "all" ? " match these filters" : " yet"}</div>}
          {filteredThreads.map(t => {
            const last = t.messages[t.messages.length - 1];
            const isActive = t.id === active;
            const cust = findCustomer(t);
            const tags: string[] = Array.isArray(cust?.tags) ? cust.tags : [];
            return <div key={t.id} className={"relative w-full flex items-start gap-3 p-3 border-b border-brand-900/20 hover:bg-white/5 transition " + (isActive ? "bg-brand-950/20" : "")}>
              <button onClick={() => { if (renamingId !== t.id) { setActive(t.id); markRead(t.id); } }} className="flex-1 min-w-0 flex items-start gap-3 text-left">
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-brand-fg">{displayName(t)[0]}</div>
                  <div className={"absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-black flex items-center justify-center " + (t.channel === "sms" ? "bg-green-500" : "bg-blue-500")}>
                    {t.channel === "sms" ? <MessageSquare size={6} /> : <Mail size={6} />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    {/* ISSUE 3 (round 6) — inline rename */}
                    {renamingId === t.id ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={e => setRenameDraft(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") saveRename(t); if (e.key === "Escape") setRenamingId(null); }}
                        onBlur={() => saveRename(t)}
                        className="text-xs font-semibold bg-black/60 border border-brand-500/50 rounded px-1.5 py-0.5 w-full text-white focus:outline-none"
                      />
                    ) : (
                      <div className={"text-xs font-semibold truncate " + (t.unread ? "text-white" : "text-white/70")}>{displayName(t)}</div>
                    )}
                    <div className="text-[9px] text-white/40 flex-shrink-0">{relTime(last?.ts || 0)}</div>
                  </div>
                  {/* ISSUE 5 — customer tags/labels, when a matching customer record has any */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {tags.slice(0, 3).map((tag: string) => (
                        <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full bg-blue-950/40 border border-blue-700/30 text-blue-300 leading-none">{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className={"text-[10px] truncate mt-0.5 " + (t.unread ? "text-white/80" : "text-white/40")}>{last?.dir === "out" ? (last?.via === "alfred" ? "Alfred: " : "You: ") : ""}{last?.body || "…"}</div>
                </div>
                {t.unread && <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5 text-brand-fg" />}
              </button>
              {/* ISSUE 4 (round 3) — three-dot menu: Hide/Unhide + Delete */}
              <div className="relative flex-shrink-0">
                <button onClick={e => { e.stopPropagation(); setMenuOpenId(menuOpenId === t.id ? null : t.id); }} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70">
                  <MoreVertical size={14} />
                </button>
                {menuOpenId === t.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                    <div className="absolute right-0 top-6 z-20 w-36 rounded-lg bg-black border border-brand-900/40 shadow-xl overflow-hidden">
                      {showHidden ? (
                        <button onClick={() => { unhideThread(t.id); setMenuOpenId(null); }} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 text-left"><Eye size={11} />Unhide</button>
                      ) : (
                        <button onClick={() => hideThread(t.id)} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 text-left"><EyeOff size={11} />Hide</button>
                      )}
                      <button onClick={() => startRename(t)} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 text-left"><Edit size={11} />Rename</button>
                      {!findCustomer(t) && (
                        <button onClick={() => convertToLead(t)} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 text-left"><UserCheck size={11} />Convert to lead</button>
                      )}
                      <button onClick={() => convertToWorkOrder(t)} disabled={convertingWorkOrderId === t.id} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-white/80 hover:bg-white/10 text-left disabled:opacity-40"><FileText size={11} />{convertingWorkOrderId === t.id ? "Reading conversation…" : "Convert to work order"}</button>
                      <button onClick={() => deleteThread(t)} className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-danger-400 hover:bg-danger-950/40 text-left"><Trash2 size={11} />Delete</button>
                    </div>
                  </>
                )}
              </div>
            </div>;
          })}
        </div>
      </div>

      {/* Conversation panel */}
      {activeThread ? (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overscroll-x-none [touch-action:pan-y]">
          {/* Header — BUG FIX (user report) — "formatting at the top bar...
              is weird" on mobile: the action buttons (View CRM/Convert to
              Lead, etc.) used to squeeze onto the same row as the
              avatar/name, wrapping mid-row and overlapping. flex-wrap on
              the header itself plus a full-width button row on mobile
              (w-full md:w-auto below) drops them cleanly onto their own
              line instead. */}
          <div className="flex flex-wrap items-center gap-3 p-3 border-b border-brand-900/30 bg-black/40">
            {/* BUG (mobile) — this button sits near enough to the left edge that
                its touches could fall inside App.tsx's sidebar edge-swipe zone
                (see EDGE_ZONE_PX there); stopPropagation on touchstart/touchmove
                is a belt-and-suspenders guard so a tap/drag here can never be
                misread as a sidebar-open swipe, on top of the zone itself now
                being narrowed to a true screen-edge width. */}
            <button
              onClick={() => setActive(null)}
              onTouchStart={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
              className="md:hidden p-1.5 rounded-lg hover:bg-white/5 text-white/60"
            ><ChevronLeft size={16} /></button>
            <button onClick={() => openProfile(activeThread)} title="Open customer file" className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-700 to-brand-950 flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden hover:ring-2 hover:ring-brand-500/60 transition">
              {findCustomer(activeThread)?.photoUrl ? <img src={findCustomer(activeThread).photoUrl} alt="" className="w-full h-full object-cover" /> : (displayName(activeThread) || "?")[0]}
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-1.5 flex-wrap">
                {/* ISSUE 3 (round 6) — rename from the open-conversation header too */}
                {renamingId === activeThread.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={e => setRenameDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveRename(activeThread); if (e.key === "Escape") setRenamingId(null); }}
                    onBlur={() => saveRename(activeThread)}
                    className="text-sm font-semibold bg-black/60 border border-brand-500/50 rounded px-1.5 py-0.5 text-white focus:outline-none"
                  />
                ) : (
                  <>
                    <button onClick={() => openProfile(activeThread)} title="Open customer file" className="hover:underline text-left">{displayName(activeThread)}</button>
                    <button onClick={() => startRename(activeThread)} title="Rename this conversation" className="text-white/30 hover:text-white/70 transition"><Edit size={11} /></button>
                  </>
                )}
                {/* ISSUE 5 — customer labels in the conversation header too */}
                {(() => {
                  const cust = findCustomer(activeThread);
                  const tags: string[] = Array.isArray(cust?.tags) ? cust.tags : [];
                  return tags.map((tag: string) => <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-950/40 border border-blue-700/30 text-blue-300 font-normal leading-none">{tag}</span>);
                })()}
              </div>
              <div className="text-[10px] text-white/50 flex items-center gap-2">
                <span className={"px-1.5 py-0.5 rounded text-[8px] uppercase font-bold " + (activeThread.channel === "sms" ? "bg-green-900/40 text-green-300" : "bg-blue-900/40 text-blue-300")}>{activeThread.channel}</span>
                {activeThread.contactPhone && <span>{activeThread.contactPhone}</span>}
                {activeThread.contactEmail && <span>{activeThread.contactEmail}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              {findCustomer(activeThread) ? (
                // BUG FIX (user report) — "pressing View CRM doesn't do
                // anything." Had no onClick at all — not mobile-specific,
                // just never wired up.
                <GBtn variant="ghost" onClick={() => openProfile(activeThread)} className="!text-xs !py-1"><Users size={11} className="inline mr-1" />Customer file</GBtn>
              ) : (
                <GBtn variant="ghost" onClick={() => convertToLead(activeThread)} className="!text-xs !py-1"><UserCheck size={11} className="inline mr-1" />Convert to Lead</GBtn>
              )}
              <GBtn variant="ghost" disabled={convertingWorkOrderId === activeThread?.id} onClick={() => convertToWorkOrder(activeThread)} className="!text-xs !py-1"><FileText size={11} className="inline mr-1" />{convertingWorkOrderId === activeThread?.id ? "Reading…" : "Convert to Work Order"}</GBtn>
            </div>
          </div>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto overscroll-x-none [touch-action:pan-y] p-4 space-y-3">
            {/* ISSUE 2 (round 6) — final safety net: dedupe at render time too,
                so even a row that somehow still has duplicate entries (e.g.
                loaded before this round's fix ran once to self-heal it via
                syncThreadToSupabase) never visibly shows them twice. */}
            {dedupeMessages(activeThread.messages).map(m => {
              const isOut = m.dir === "out";
              return <div key={m.id} className={"group flex items-center gap-1 " + (isOut ? "justify-end" : "justify-start")}>
                {/* ISSUE 3 (round 9) — per-message copy/delete. Placed on the
                    OUTER side of the bubble (left of an outgoing bubble,
                    right of an incoming one) so the toolbar never sits on
                    top of message text, and only shown on hover so the
                    thread doesn't look cluttered by default. */}
                {isOut && (
                  <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => copyMessage(m.body)} title="Copy" className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80"><Copy size={12} /></button>
                    <button onClick={() => deleteMessage(activeThread, m.id)} title="Delete" className="p-1 rounded hover:bg-danger-900/40 text-white/40 hover:text-danger-400"><Trash2 size={12} /></button>
                  </div>
                )}
                <div className={"max-w-[80%]"}>
                  {m.subject && <div className="text-[10px] text-white/50 mb-1 font-medium">Subject: {m.subject}</div>}
                  {/* Alfred sent this on the owner's behalf — badge it so it's
                      never confused with something the owner typed
                      themselves, in ANY thread (a customer thread included). */}
                  {isOut && m.via === "alfred" && (
                    <div className="text-[9px] font-bold text-purple-300 mb-1 text-right flex items-center justify-end gap-1">
                      <Bot size={10} />from Alfred
                    </div>
                  )}
                  <div className={"px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap select-text " + (isOut ? "bg-brand-600 text-brand-fg rounded-br-sm" : "bg-black/50 border border-brand-900/30 text-white/90 rounded-bl-sm")}>
                    {/* BUG FIX — a voice memo/photo/PDF sent to/from this
                        thread used to log with an empty body and no media
                        reference at all, showing as a blank bubble with
                        nothing to interact with. */}
                    {(m as any).mediaUrl && (m as any).mediaType?.startsWith("audio/") && (
                      <audio controls preload="none" src={(m as any).mediaUrl} className="max-w-full mb-1" style={{ height: 32 }} />
                    )}
                    {(m as any).mediaUrl && (m as any).mediaType?.startsWith("image/") && (
                      <a href={(m as any).mediaUrl} target="_blank" rel="noopener noreferrer">
                        <img src={(m as any).mediaUrl} alt="attachment" className="max-w-full rounded-lg mb-1" style={{ maxHeight: 220 }} />
                      </a>
                    )}
                    {(m as any).mediaUrl && !(m as any).mediaType?.startsWith("audio/") && !(m as any).mediaType?.startsWith("image/") && (
                      <a href={(m as any).mediaUrl} target="_blank" rel="noopener noreferrer" className="underline text-blue-300 block mb-1">📎 View attachment</a>
                    )}
                    {m.body}
                  </div>
                  <div className={"text-[9px] mt-1 flex items-center gap-1 " + (isOut ? "justify-end text-white/40" : "text-white/30")}>
                    {relTime(m.ts)}
                    {isOut && m.status === "sending" && " · sending…"}
                    {isOut && m.status === "sent" && " · ✓"}
                    {isOut && m.status === "failed" && <span className="text-danger-400"> · ✗ {m.error?.slice(0, 40)}</span>}
                  </div>
                </div>
                {!isOut && (
                  <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => copyMessage(m.body)} title="Copy" className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80"><Copy size={12} /></button>
                    <button onClick={() => deleteMessage(activeThread, m.id)} title="Delete" className="p-1 rounded hover:bg-danger-900/40 text-white/40 hover:text-danger-400"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>;
            })}
            <div ref={msgEndRef} />
          </div>
          {/* Composer */}
          <div className="border-t border-brand-900/30 p-3 bg-black/40">
            <div className="flex items-end gap-2 bg-black/60 border border-brand-900/40 rounded-2xl p-2 focus-within:border-brand-500/60 transition">
              <textarea ref={inputRef} rows={1} placeholder={"Message" + (activeThread.channel === "sms" ? " (SMS)" : " (Email)")} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} onInput={e => { (e.target as HTMLTextAreaElement).style.height = "auto"; (e.target as HTMLTextAreaElement).style.height = Math.min((e.target as HTMLTextAreaElement).scrollHeight, 120) + "px"; }} className="flex-1 bg-transparent px-2 py-1 text-sm text-white placeholder-white/30 focus:outline-none resize-none max-h-[120px]" />
              <button onClick={send} disabled={sending || !input.trim()} className={"p-2 rounded-xl transition " + (sending || !input.trim() ? "bg-white/5 text-white/30" : "bg-brand-600 text-brand-fg hover:scale-105")}>{sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}</button>
            </div>
            {activeThread.channel === "sms" && !twilioReady && <div className="text-[9px] text-yellow-400 mt-1 text-center">Add Twilio credentials in Settings to send real SMS</div>}
            {activeThread.channel === "email" && !emailReady && <div className="text-[9px] text-yellow-400 mt-1 text-center">Connect Gmail in Settings → Integrations to send real emails</div>}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-white/40 hidden md:flex">
          <div className="text-center"><MessageSquare size={40} className="mx-auto mb-3 opacity-30" /><div className="text-sm">Select a conversation</div></div>
        </div>
      )}

      {/* New message modal */}
      <Modal open={newModal} onClose={() => setNewModal(false)} title="New Message" maxW="max-w-lg">
        <div className="space-y-3">
          <div className="flex gap-2">
            {["sms", "email"].map(ch => <button key={ch} onClick={() => setNewDraft({ ...newDraft, channel: ch })} className={"flex-1 py-2 rounded-xl border text-xs font-medium uppercase transition " + (newDraft.channel === ch ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-white/10 text-white/60")}>{ch === "sms" ? "💬 SMS" : "📧 Email"}</button>)}
          </div>
          <GInput placeholder="Contact name" value={newDraft.to} onChange={e => { const c = customers.find(x => (x.firstName + " " + x.lastName).toLowerCase().startsWith(e.target.value.toLowerCase())); setNewDraft({ ...newDraft, to: e.target.value, phone: c?.phone || newDraft.phone, email: c?.email || newDraft.email }); }} list="contact-names" />
          <datalist id="contact-names">{customers.map(c => <option key={c.id} value={c.firstName + " " + c.lastName} />)}</datalist>
          {newDraft.channel === "sms" && <GInput placeholder="Phone (+15551234567)" value={newDraft.phone} onChange={e => setNewDraft({ ...newDraft, phone: e.target.value })} />}
          {newDraft.channel === "email" && <>
            <GInput placeholder="Email address" value={newDraft.email} onChange={e => setNewDraft({ ...newDraft, email: e.target.value })} />
            <GInput placeholder="Subject" value={newDraft.subject} onChange={e => setNewDraft({ ...newDraft, subject: e.target.value })} />
          </>}
          <GTxt rows={4} placeholder="Message..." value={newDraft.body} onChange={e => setNewDraft({ ...newDraft, body: e.target.value })} />
          {newDraft.channel === "sms" && <div className="text-[10px] text-white/40">{newDraft.body.length} chars · {Math.ceil(newDraft.body.length / 160)} SMS segment{Math.ceil(newDraft.body.length / 160) !== 1 ? "s" : ""}</div>}
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={() => setNewModal(false)}>Cancel</GBtn>
            <GBtn onClick={startNew} disabled={!newDraft.to || !newDraft.body || (newDraft.channel === "sms" ? !newDraft.phone : !newDraft.email)}><Send size={12} className="inline mr-1.5" />Send</GBtn>
          </div>
        </div>
      </Modal>
      <CustomerDetail customer={profileCustomer} onClose={() => setProfileCustomerId(null)} onDelete={undefined} onEdit={(c: any) => { setProfileCustomerId(null); setEditingCustomer(c); }}
        estimates={estimates} jobs={jobs} employees={employees} settings={settings} toast={toast} setCustomers={setCustomers}
        onOpenEstimate={() => { const id = profileCustomerId; setProfileCustomerId(null); if (id) onViewCustomerInCrm?.(id); }} />
      <CustomerModal open={!!editingCustomer} onClose={() => setEditingCustomer(null)} data={editingCustomer} onSave={saveEditedCustomer} mapsKey={(settings as any).googleMapsKey || (settings as any).mapsKey || ""} customers={customers} />
    </div>
  );
}

