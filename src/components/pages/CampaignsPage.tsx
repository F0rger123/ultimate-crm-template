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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, checkTwilioAccountStatus, checkA2pCampaignStatus, logOutboundSmsToInbox, type TwilioAccountStatus } from "../../lib/messaging";
import { getStoredGoogleConnection } from "../../lib/supabase";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
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

// Re-engagement sequence definitions (Campaigns → Sequences tab). Each
// becomes a real Automation record when "Activate" is clicked (see
// useAutomationEngine.ts) — step delays are CUMULATIVE minutes-since-trigger,
// same convention extractDirectives() in that engine already uses for
// AUTOMATION_TEMPLATES' multi-touch drips (lib/seed.ts).
const SEQUENCE_DEFS = [
  {
    id: "seq_reengage_6mo", name: "6-Month Re-engagement", desc: "Customers not seen in 6+ months",
    triggerLabel: "No service 6 months",
    audienceCount: (customers: any[]) => customers.filter(c => daysSince(c.createdAt) > 180).length,
    display: [
      "Day 1: SMS — \"Hey {{first_name}}, it's been a while! Want to refresh your home?\"",
      "Day 4: Email — 15% off offer",
      "Day 10: Final SMS — offer expires soon",
    ],
    steps: [
      { id: uid(), type: "trigger", label: "No service 6 months", icon: "🔄" },
      { id: uid(), type: "action", label: "Day 1: SMS check-in", channel: "sms", messageBody: "Hi {{first_name}}, it's been a while! Want to refresh your home? Reply BOOK or call {{company_phone}}. — CRM Starter" },
      { id: uid(), type: "condition", label: "Wait 3 more days", delay: 3 * 1440 },
      { id: uid(), type: "action", label: "Day 4: Email — 15% off offer", channel: "email", messageBody: "Hi {{first_name}}, still thinking about a refresh? Here's 15% off your next service if you book this week. Reply BOOK or call {{company_phone}}. — CRM Starter" },
      { id: uid(), type: "condition", label: "Wait 6 more days", delay: 6 * 1440 },
      { id: uid(), type: "action", label: "Day 10: Final SMS — offer expires soon", channel: "sms", messageBody: "Hi {{first_name}}, your 15% off offer expires soon — reply BOOK to lock it in. — CRM Starter" },
    ],
  },
  {
    id: "seq_abandoned_estimate", name: "Abandoned Estimate", desc: "Quotes pending, no response",
    triggerLabel: "Estimate abandoned, no response",
    audienceCount: (_customers: any[], estimatesArg: any[] = []) => estimatesArg.filter(e => e.status === "pending" && e.sentAt).length,
    display: [
      "Day 3: SMS — \"Just checking in on your estimate\"",
      "Day 7: Email — FAQ + testimonial",
      "Day 14: SMS — last chance, offer expires in 48h",
    ],
    steps: [
      { id: uid(), type: "trigger", label: "Estimate abandoned, no response", icon: "⚡" },
      { id: uid(), type: "condition", label: "Wait 3 days", delay: 3 * 1440 },
      { id: uid(), type: "action", label: "Day 3: Soft check-in SMS", channel: "sms", messageBody: "Hi {{first_name}}, just checking in on your {{amount}} estimate. Any questions? Reply BOOK to schedule. — CRM Starter" },
      { id: uid(), type: "condition", label: "Wait 4 more days", delay: 4 * 1440 },
      { id: uid(), type: "action", label: "Day 7: Email — FAQ + testimonial", channel: "email", messageBody: "Hi {{first_name}}, still deciding? We'd love to earn your business — call {{company_phone}} with any questions about your {{amount}} estimate. — CRM Starter" },
      { id: uid(), type: "condition", label: "Wait 7 more days", delay: 7 * 1440 },
      { id: uid(), type: "action", label: "Day 14: Final SMS — offer expires in 48h", channel: "sms", messageBody: "Hi {{first_name}}, last check-in on your {{amount}} estimate — reply BOOK within 48h to lock in this price. — CRM Starter" },
    ],
  },
  {
    id: "seq_post_service_nurture", name: "Post-Service Nurture", desc: "After a completed job",
    triggerLabel: "Maintenance nurture — since service",
    audienceCount: (_customers: any[], _estimatesArg: any[], jobsArg: any[] = []) => jobsArg.filter(j => j.status === "completed").length,
    display: [
      "Day 2: Thank-you + review-ask SMS",
      "Day 30: Maintenance check-in email",
      "Day 90: Re-booking offer SMS",
    ],
    steps: [
      { id: uid(), type: "trigger", label: "Maintenance nurture — since service", icon: "🔁" },
      { id: uid(), type: "condition", label: "Wait 2 days", delay: 2 * 1440 },
      { id: uid(), type: "action", label: "Day 2: Thank-you SMS", channel: "sms", messageBody: "Hi {{first_name}}, thanks for choosing CRM Starter! We'd love a quick review if you have a moment. Questions? Call {{company_phone}}." },
      { id: uid(), type: "condition", label: "Wait 28 more days", delay: 28 * 1440 },
      { id: uid(), type: "action", label: "Day 30: Maintenance check-in email", channel: "email", messageBody: "Hi {{first_name}}, it's been about a month since your last service — everything still looking good? Reach out any time at {{company_phone}}. — CRM Starter" },
      { id: uid(), type: "condition", label: "Wait 60 more days", delay: 60 * 1440 },
      { id: uid(), type: "action", label: "Day 90: Re-booking offer SMS", channel: "sms", messageBody: "Hi {{first_name}}, it's been 90 days — ready for another wash? Reply BOOK or call {{company_phone}} for 10% off. — CRM Starter" },
    ],
  },
];

export function CampaignsPage({ campaigns = [], setCampaigns, customers = [], estimates = [], jobs = [], settings = {} as AppSettings, setSettings, inboxThreads = [], setInboxThreads, automations = [], setAutomations, toast }: { campaigns?: any[]; setCampaigns?: any; customers?: any[]; estimates?: any[]; jobs?: any[]; settings?: AppSettings; setSettings?: any; inboxThreads?: any[]; setInboxThreads?: any; automations?: any[]; setAutomations?: any; toast?: any }) {
  const [savedSegments, setSavedSegments] = usePersistent("crm.savedSegments", []);
  // ITEM 27 — owner-created campaign templates.
  const customTemplates = ((settings as any)?.customCampaignTemplates || []) as { id: string; name: string; subject?: string; body: string }[];
  const [tab, setTab] = useState("compose");
  const [ch, setCh] = useState("sms");
  const [subj, setSubj] = useState("");
  const [body, setBody] = useState("Hi {{first_name}}, spring special — 15% off any service this month. Reply BOOK or call " + ((settings as any)?.companyPhone || "(555) 555-0100") + ". — " + ((settings as any)?.companyName || "CRM Starter"));
  const [fCity, setFCity] = useState("");
  const [fLast, setFLast] = useState(""); // last service date (most recent completed job)
  const [fTag, setFTag] = useState("");
  // ISSUE 25/26/34 — customer folders (CustomersPage.tsx's c.folder field)
  // had no equivalent targeting filter here, only tags — the owner could
  // segment by tag but not by the folder structure they'd already organized
  // customers into.
  const [fFolder, setFFolder] = useState("");
  const [fService, setFService] = useState("");
  const [fMinSpent, setFMinSpent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(null); // { sent, failed, total }
  const [preview, setPreview] = useState(null);
  const [scheduleTime, setScheduleTime] = useState("");

  const twilioConfigured = !!(settings.twilioSid && settings.twilioToken && settings.twilioFrom);
  // ISSUE 34 (round 3) — "connected" used to mean only "credentials are
  // typed in," which reads as ready even while the Twilio account is
  // suspended for non-payment or the A2P campaign was never approved —
  // both of which make every real send fail despite the badge saying
  // "✓ ready." Live-checked once on mount (if creds are present) and again
  // on demand via the Refresh button below, same same-origin-proxy pattern
  // SettingsModal's existing "Check Campaign Status" button already uses
  // (Twilio's API has no browser CORS headers, so this can't be a direct
  // fetch from here).
  const [twilioLive, setTwilioLive] = useState<TwilioAccountStatus | null>(null);
  const [twilioCampaignStatus, setTwilioCampaignStatus] = useState<string | null>(null);
  const [twilioCheckError, setTwilioCheckError] = useState<string | null>(null);
  const [twilioChecking, setTwilioChecking] = useState(false);
  const [twilioCheckedAt, setTwilioCheckedAt] = useState<number | null>(null);

  const refreshTwilioStatus = useCallback(async () => {
    if (!twilioConfigured) return;
    setTwilioChecking(true);
    setTwilioCheckError(null);
    try {
      const acct = await checkTwilioAccountStatus(settings as any);
      setTwilioLive(acct);
      if ((settings as any).twilioMessagingServiceSid) {
        try {
          const camp = await checkA2pCampaignStatus(settings as any);
          setTwilioCampaignStatus(camp.campaignStatus || (camp.registered ? "UNKNOWN" : "NOT_REGISTERED"));
        } catch (e: any) {
          console.warn("[Campaigns] A2P campaign status check failed:", e?.message);
        }
      }
    } catch (e: any) {
      setTwilioCheckError(e?.message || "Status check failed");
      setTwilioLive(null);
    } finally {
      setTwilioChecking(false);
      setTwilioCheckedAt(Date.now());
    }
  }, [twilioConfigured, settings]);

  // BUG FIX / EXPLICIT REQUEST — this used to auto-run on every mount, so an
  // owner who KNOWS their Twilio credentials work (sends succeed) still got
  // an unprompted warning banner every time they opened this page whenever
  // Twilio's own status endpoint disagreed with the client-side SID check.
  // Per explicit owner request, this is now on-demand only (the "Check
  // Status" button below) — never runs, or shows anything, until asked.

  // ISSUE 11 (round 3) — no way to verify a campaign body/subject actually
  // sends before blasting the whole recipient list. Reuses the exact same
  // merge()+twilioSend/sendEmail path launch() uses below, just for one
  // ad-hoc recipient, with a fake customer object so {{first_name}} etc.
  // still resolve to something sensible.
  const [testRecipient, setTestRecipient] = useState("");
  const [testSending, setTestSending] = useState(false);
  const sendTestMessage = async () => {
    if (!testRecipient.trim() || !body.trim() || (ch === "email" && !subj.trim())) return;
    setTestSending(true);
    const fakeCustomer = { firstName: "Test", lastName: "Customer", address: "123 Test St", phone: testRecipient.trim() };
    try {
      if (ch === "sms") {
        await twilioSend(settings, testRecipient.trim(), "[TEST] " + merge(body, fakeCustomer));
      } else {
        await sendEmail(settings, { to: testRecipient.trim(), subject: "[TEST] " + merge(subj, fakeCustomer), body: merge(body, fakeCustomer) });
      }
      toast("Test " + (ch === "sms" ? "text" : "email") + " sent to " + testRecipient.trim() + " ✓", "green");
    } catch (e: any) {
      toast("Test send failed: " + (e?.message || "unknown error"), "red");
    } finally {
      setTestSending(false);
    }
  };

  // Hard-gate on account status (suspended/closed genuinely can't send);
  // treat a failed/not-yet-run check as "unknown, don't block" rather than
  // assuming the worst, since a transient network error shouldn't stop the
  // owner from sending a real campaign.
  const twilioSuspended = twilioLive?.accountStatus === "suspended" || twilioLive?.accountStatus === "closed";
  const twilioCampaignBlocked = twilioCampaignStatus === "FAILED";
  const twilioReady = twilioConfigured && !twilioSuspended && !twilioCampaignBlocked;
  const twilioBalanceNum = twilioLive?.balance != null ? Number(twilioLive.balance) : null;
  const twilioLowBalance = twilioBalanceNum != null && twilioBalanceNum <= 0;
  // ISSUE 13 — this read settings.googleScopes?.gmail, a display-only
  // toggle in Settings → Integrations that defaults to OFF and has no
  // bearing on whether Gmail send actually works (sendOwnerGmailOnly uses
  // the owner's OAuth token directly, not this toggle — see docs/ARCHITECTURE.md).
  // That made Campaigns report "email not connected" for an owner who was
  // genuinely connected, and never accounted for an actually-missing/empty
  // Twilio config reading as falsy-but-still-"ready" once fields existed.
  // Matches SettingsModal's own isGoogleConnected check so the two screens
  // can't disagree.
  const storedGoogle = getStoredGoogleConnection();
  const emailReady = !!(storedGoogle?.token || ((settings as any).googleConnected && (settings as any).googleProviderToken));
  const canSend = ch === "sms" ? twilioReady : emailReady;

  const cities = [...new Set(customers.map(c => { const a = c.address || ""; const m = a.match(/,\s*([A-Za-z ]+)\s+PA/); return m ? m[1].trim() : null; }).filter(Boolean))];
  const allTags = [...new Set(customers.flatMap(c => c.tags || []))];
  const allFolders = [...new Set(customers.map((c: any) => c.folder).filter(Boolean))].sort();

  const matches = customers.filter((c: any) => {
    if (fFolder && c.folder !== fFolder) return false;
    if (fCity && !(c.address || "").includes(fCity)) return false;
    if (fLast) {
      // Filter by LAST SERVICE DATE (most recent completed job) not join date
      const custJobs_ = (jobs || []).filter(j => j.customerId === c.id && j.status === "completed");
      const lastJobDate = custJobs_.length > 0 ? custJobs_.sort((a,b) => b.scheduledDate?.localeCompare(a.scheduledDate))[0]?.scheduledDate : null;
      if (!lastJobDate || lastJobDate > fLast) return false; // hasn't been serviced before fLast
    }
    if (fTag && !(c.tags || []).includes(fTag)) return false;
    if (fService) {
      // Customer must have had a job with this service in the description
      const custJobs = jobs?.filter(j => j.customerId === c.id) || [];
      const hasService = custJobs.some(j => (j.address || j.notes || "").toLowerCase().includes(fService.toLowerCase()) || (estimates || []).some(e => e.customerId === c.id && (e.lineItems || []).some(li => (li.description || "").toLowerCase().includes(fService.toLowerCase()))));
      if (!hasService) return false;
    }
    if (fMinSpent && Number(c.totalSpent || 0) < Number(fMinSpent)) return false;
    if (ch === "sms" && !c.phone) return false;
    if (ch === "email" && !c.email) return false;
    return true;
  });

  const merge = (template, customer) => template
    .replace(/{{first_name}}/g, customer.firstName || "there")
    .replace(/{{last_name}}/g, customer.lastName || "")
    .replace(/{{address}}/g, customer.address || "")
    .replace(/{{phone}}/g, customer.phone || "")
    .replace(/{{company_name}}/g, (settings as any)?.companyName || "CRM Starter")
    .replace(/{{company_phone}}/g, (settings as any)?.companyPhone || "(555) 555-0100");

  const launch = async () => {
    if (!body.trim() || (ch === "email" && !subj.trim()) || matches.length === 0) return;
    const campaignId = uid();
    const nc = { id: campaignId, name: ch === "email" ? subj : "Campaign " + today(), ch, subject: ch === "email" ? subj : "", body, recipientCount: matches.length, status: "sending", createdAt: today(), sentCount: 0, failedCount: 0, delivered: [] };
    setCampaigns(prev => [nc, ...prev]);
    setTab("scheduled");
    setSending(true);
    setSendProgress({ sent: 0, failed: 0, total: matches.length });

    let sent = 0, failed = 0;
    // AUDIT #6 (round 4) — per-recipient send failures were counted but the
    // actual Twilio/Gmail error (insufficient balance, invalid number, opted
    // out, etc.) was thrown away — the owner only ever saw "N failed" with
    // no way to know why or which recipients. Collect a capped sample of
    // real error messages to surface in the end-of-send toast.
    const failureSamples: string[] = [];
    for (const customer of matches) {
      const personalized = merge(body, customer);
      try {
        if (ch === "sms") {
          await twilioSend(settings, customer.phone, personalized);
          // Add to inbox as outgoing campaign message — local optimistic
          // update for this session's own UI...
          if (setInboxThreads) {
            setInboxThreads(prev => {
              const existing = prev.find(t => t.channel === "sms" && t.contactPhone?.replace(/\D/g, "") === customer.phone?.replace(/\D/g, ""));
              const outMsg = { id: uid(), dir: "out", body: personalized, ts: Date.now(), status: "sent", campaignId };
              if (existing) {
                return prev.map(t => t.id === existing.id ? { ...t, messages: [...t.messages, outMsg] } : t);
              } else {
                return [{ id: uid(), channel: "sms", contactName: customer.firstName + " " + customer.lastName, contactPhone: customer.phone, contactEmail: customer.email, customerId: customer.id, unread: false, messages: [outMsg] }, ...prev];
              }
            });
          }
          // ISSUE 7 — ...but that local update alone never reached
          // Supabase, unlike every other outbound-SMS path in the app
          // (owner Inbox replies, employee OTW/Running Late/invoice texts).
          // A campaign text was therefore invisible to any OTHER device/
          // session, and if the customer replied, InboxPage's own
          // phone-matching poll would create a thread with only their
          // reply in it — no record of the campaign message that prompted
          // it. logOutboundSmsToInbox does the same find-existing-thread-
          // by-phone-or-create merge every other send path already uses.
          logOutboundSmsToInbox({
            contactName: `${customer.firstName} ${customer.lastName}`,
            contactPhone: customer.phone,
            customerId: customer.id,
            body: personalized,
          }).catch((e: any) => console.warn("[Campaigns] failed to sync SMS to inbox:", e?.message));
        } else {
          await sendEmail(settings, { to: customer.email, subject: merge(subj, customer), body: personalized });
        }
        sent++;
      } catch (e: any) {
        failed++;
        const reason = e?.message || "Unknown error";
        if (failureSamples.length < 5) failureSamples.push(`${customer.firstName || customer.phone || customer.email}: ${reason}`);
        console.error("[Campaigns] send failed for", customer.id, "—", reason);
      }
      setSendProgress({ sent, failed, total: matches.length });
      setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, sentCount: sent, failedCount: failed, status: sent + failed < matches.length ? "sending" : "sent" } : c));
      // Small delay to avoid overwhelming Twilio rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    setSending(false);
    setSendProgress(null);
    // AUDIT (mobile round 10) — openRate/clickRate used to be
    // Math.random()-fabricated on every send with no basis in reality
    // ("Analytics inside campaigns don't work properly"). This app has no
    // email-open-pixel or link-click-tracking infrastructure, so rather than
    // keep faking those numbers, campaigns now only report what's actually
    // known: how many sends really succeeded vs failed (deliveryRate), plus
    // the existing real, manually-tracked conversions counter below.
    setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, status: "sent", sentCount: sent, failedCount: failed, failureSamples, deliveryRate: matches.length > 0 ? Math.round((sent / matches.length) * 100) : 0 } : c));
    if (failed > 0) {
      toast(`Campaign sent — ${sent} delivered, ${failed} failed. First failure: ${failureSamples[0] || "unknown error"}`, sent > 0 ? "yellow" : "error");
    } else {
      toast(`Campaign sent! ${sent} delivered`, "success");
    }
    setBody("Hi {{first_name}}, spring special — 15% off any service this month. Reply BOOK or call " + ((settings as any)?.companyPhone || "(555) 555-0100") + ". — " + ((settings as any)?.companyName || "CRM Starter"));
    setSubj("");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTab("compose")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "compose" ? "bg-brand-600 border-brand-500/50 text-brand-fg" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>Compose</button>
        <button onClick={() => setTab("scheduled")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "scheduled" ? "bg-brand-600 border-brand-500/50 text-brand-fg" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>Campaigns ({campaigns.length})</button>
        <button onClick={() => setTab("analytics")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "analytics" ? "bg-brand-600 border-brand-500/50 text-brand-fg" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>📊 Analytics</button>
        <button onClick={() => setTab("sequences")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "sequences" ? "bg-brand-600 border-brand-500/50 text-brand-fg" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>🔄 Sequences</button>
        <button onClick={() => setTab("ab")} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === "ab" ? "bg-brand-600 border-brand-500/50 text-brand-fg" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>🧪 A/B Test</button>
      </div>

      {tab === "analytics" && <div className="space-y-4">
        {/* Overall campaign stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(() => {
            const sent = campaigns.filter(c => c.status === "sent" || c.sentAt);
            const scheduled_ = campaigns.filter(c => c.status === "scheduled" && c.sendAt);
            const totalRecipients = campaigns.reduce((s, c) => s + (c.recipientCount || (c.matches || []).length || 0), 0);
            const totalConversions = campaigns.reduce((s, c) => s + (c.conversions || 0), 0);
            return [
              { label: "Total Campaigns", value: campaigns.length, color: "text-white" },
              { label: "Sent", value: sent.length, color: "text-green-400" },
              { label: "Scheduled", value: scheduled_.length, color: "text-yellow-400" },
              { label: "Total Recipients", value: totalRecipients.toLocaleString(), color: "text-blue-400" },
            ].map(s => <Glass key={s.label} className="p-4 text-center">
              <div className="text-[10px] text-white/40 uppercase mb-1">{s.label}</div>
              <div className={"text-2xl font-black " + s.color}>{s.value}</div>
            </Glass>);
          })()}
        </div>

        {/* Campaign list with performance */}
        <Glass className="overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-900/20 flex items-center justify-between">
            <div className="font-semibold text-sm">Campaign Performance</div>
            <div className="text-[10px] text-white/40">Delivery rate = actually confirmed sent by Twilio/Gmail. Conversions are tracked manually with the +1 button.</div>
          </div>
          {campaigns.length === 0 ? <div className="p-8 text-center text-white/40 text-sm">No campaigns yet — compose your first in the Compose tab</div>
          : <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/20 bg-black/20">
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Campaign</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Channel</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Recipients</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Status</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Delivery Rate</th>
              <th className="text-right px-4 py-2.5 text-[10px] uppercase tracking-wider text-white/40">Conversions</th>
            </tr></thead>
            <tbody>
              {campaigns.slice().sort((a,b) => (b.sentAt||b.sendAt||"").localeCompare(a.sentAt||a.sendAt||"")).map(camp => {
                const recipients = camp.recipientCount || (camp.matches || []).length || 0;
                const deliveryRate = camp.deliveryRate ?? (recipients > 0 ? Math.round(((camp.sentCount || 0) / recipients) * 100) : null);
                const isSent = camp.status === "sent" || camp.sentAt;
                const isScheduled = camp.status === "scheduled" && camp.sendAt;
                return <tr key={camp.id} className="border-b border-brand-900/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium">{camp.name || "Campaign"}</div>
                    <div className="text-[10px] text-white/40 truncate max-w-48">{camp.body?.slice(0,50)}…</div>
                  </td>
                  <td className="px-4 py-3 text-right"><Badge tone={camp.ch === "sms" ? "blue" : "purple"}>{camp.ch === "sms" ? "📱 SMS" : "📧 Email"}</Badge></td>
                  <td className="px-4 py-3 text-right font-semibold">{recipients}</td>
                  <td className="px-4 py-3 text-right"><Badge tone={isSent ? "green" : isScheduled ? "yellow" : "gray"}>{isSent ? "Sent" : isScheduled ? "Scheduled" : "Draft"}</Badge></td>
                  <td className="px-4 py-3 text-right">
                    {isSent && deliveryRate != null ? <span className={deliveryRate >= 90 ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>{deliveryRate}%</span> : <span className="text-white/30">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-semibold">{camp.conversions || 0}</span>
                      {isSent && <button onClick={() => setCampaigns(prev => prev.map(c => c.id === camp.id ? { ...c, conversions: (c.conversions || 0) + 1 } : c))} className="text-[9px] text-white/30 hover:text-green-400 border border-white/10 rounded px-1">+1</button>}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>}
        </Glass>

        {/* Channel performance breakdown */}
        <div className="grid md:grid-cols-2 gap-4">
          {["sms","email"].map(ch_ => {
            const chCampaigns = campaigns.filter(c => c.ch === ch_ && (c.status === "sent" || c.sentAt));
            const totalRecip = chCampaigns.reduce((s,c) => s + (c.recipientCount || (c.matches||[]).length || 0), 0);
            const totalSent = chCampaigns.reduce((s,c) => s + (c.sentCount || 0), 0);
            const totalConv = chCampaigns.reduce((s,c) => s + (c.conversions || 0), 0);
            return <Glass key={ch_} className="p-4">
              <div className="font-semibold text-sm mb-3">{ch_ === "sms" ? "📱 SMS Campaigns" : "📧 Email Campaigns"}</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white/60">Campaigns sent</span><span className="font-bold">{chCampaigns.length}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Total recipients</span><span className="font-bold">{totalRecip}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Delivery rate</span><span className="font-bold text-green-400">{totalRecip > 0 ? Math.round(totalSent / totalRecip * 100) : 0}%</span></div>
                <div className="flex justify-between"><span className="text-white/60">Conversions</span><span className="font-bold text-brand-400">{totalConv}</span></div>
                <div className="flex justify-between border-t border-white/5 pt-2"><span className="text-white/60">Conv. rate</span><span className="font-bold">{totalRecip > 0 ? (totalConv/totalRecip*100).toFixed(1) : 0}%</span></div>
              </div>
            </Glass>;
          })}
        </div>
      </div>}

      {/* Send progress overlay */}
      {sendProgress && <Glass className="p-4 !bg-gradient-to-r !from-brand-950/40 !to-black/60 !border-brand-500/40">
        <div className="flex items-center gap-3 mb-2">
          <div className="animate-spin w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full" />
          <div className="font-semibold text-sm">Sending campaign… {sendProgress.sent + sendProgress.failed}/{sendProgress.total}</div>
        </div>
        <div className="h-2 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-white/70 transition-all" style={{ width: ((sendProgress.sent + sendProgress.failed) / sendProgress.total * 100) + "%" }} /></div>
        <div className="flex justify-between text-[10px] text-white/60 mt-1"><span>✓ {sendProgress.sent} sent</span>{sendProgress.failed > 0 && <span className="text-danger-400">✗ {sendProgress.failed} failed</span>}</div>
      </Glass>}

      {tab === "compose" && <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-4">
          <Glass className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-white/50 uppercase tracking-wider">Channel</div>
              {twilioConfigured && (
                <button onClick={refreshTwilioStatus} disabled={twilioChecking} className="text-[10px] text-white/40 hover:text-white/70 transition flex items-center gap-1 disabled:opacity-40">
                  <RefreshCw size={10} className={twilioChecking ? "animate-spin" : ""} />
                  {twilioChecking ? "Checking…" : "Refresh status"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setCh("sms")} className={"p-3 rounded-xl border transition flex items-center justify-center gap-2 text-sm " + (ch === "sms" ? "bg-green-900/30 border-green-500/50 text-green-200" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
                <MessageSquare size={14} /> SMS
                {!twilioConfigured ? <span className="text-[9px] text-yellow-400">not configured</span>
                  : twilioChecking ? <span className="text-[9px] text-white/40">checking…</span>
                  : twilioSuspended ? <span className="text-[9px] text-brand-400">✗ suspended</span>
                  : twilioCampaignBlocked ? <span className="text-[9px] text-danger-400">✗ campaign rejected</span>
                  : twilioCheckError ? <span className="text-[9px] text-yellow-400" title={twilioCheckError}>status unknown</span>
                  : <span className="text-[9px] text-green-400">✓ ready</span>}
              </button>
              <button onClick={() => setCh("email")} className={"p-3 rounded-xl border transition flex items-center justify-center gap-2 text-sm " + (ch === "email" ? "bg-blue-900/30 border-blue-500/50 text-blue-200" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
                <Mail size={14} /> Email
                {emailReady ? <span className="text-[9px] text-green-400">✓ ready</span> : <span className="text-[9px] text-yellow-400">not connected</span>}
              </button>
            </div>
            {/* Live Twilio account detail — balance, account type, A2P campaign status */}
            {twilioConfigured && twilioLive && (
              <div className="mt-2 text-[10px] text-white/40 flex flex-wrap gap-x-3 gap-y-1">
                {twilioLive.accountStatus && <span>Account: <span className={twilioSuspended ? "text-brand-400" : "text-white/60"}>{twilioLive.accountStatus}</span></span>}
                {twilioLive.balance != null && <span>Balance: <span className={twilioLowBalance ? "text-yellow-400" : "text-white/60"}>{twilioLive.currency || "USD"} {twilioLive.balance}</span></span>}
                {twilioCampaignStatus && <span>A2P campaign: <span className={twilioCampaignBlocked ? "text-danger-400" : twilioCampaignStatus === "VERIFIED" ? "text-green-400" : "text-yellow-400"}>{twilioCampaignStatus}</span></span>}
              </div>
            )}
            {twilioConfigured && twilioCheckError && (
              <div className="mt-2 text-[10px] text-yellow-400/80">Couldn't verify live Twilio status — {twilioCheckError}. Send button still works off the last known config; this just couldn't confirm suspension/balance right now.</div>
            )}
            {!canSend && <div className="mt-2 text-[10px] text-yellow-400/80 bg-yellow-950/20 border border-yellow-800/30 rounded px-2.5 py-1.5">
              {ch === "sms"
                ? (!twilioConfigured ? "⚠ Add Twilio SID, Token, and From number in Settings to send real SMS blasts"
                  : twilioSuspended ? "⚠ This Twilio account is " + twilioLive?.accountStatus + " — add funds / resolve billing in the Twilio console, then Refresh status."
                  : twilioCampaignBlocked ? "⚠ Your A2P 10DLC campaign was rejected — re-register it in the Twilio console, then Refresh status."
                  : "⚠ Twilio isn't ready to send")
                : "⚠ Connect Gmail in Settings → Integrations → Google to send real email blasts"}
            </div>}
            {/* ISSUE 11 (round 3) — send a single test message using the current
                body/subject before committing to the full recipient list. */}
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
              <GInput
                placeholder={ch === "sms" ? "Test phone (+15551234567)" : "Test email address"}
                value={testRecipient}
                onChange={e => setTestRecipient(e.target.value)}
                className="!text-xs !py-1.5 flex-1"
              />
              <GBtn
                variant="ghost"
                disabled={testSending || !testRecipient.trim() || !body.trim() || (ch === "email" && !subj.trim()) || !canSend}
                onClick={sendTestMessage}
                className="!text-xs !py-1.5 flex-shrink-0"
              >
                {testSending ? "Sending…" : "Send Test"}
              </GBtn>
            </div>
          </Glass>
          <Glass className="p-4 space-y-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Template</label>
              {/* ITEM 27 — custom templates the owner creates/renames/deletes,
                  stored in settings.customCampaignTemplates (JSONB — no
                  migration needed), alongside the built-in seed list. */}
              <div className="flex gap-2">
                <GSel defaultValue="" className="flex-1" onChange={e => {
                  const val = e.target.value;
                  const built = campaignTemplates.find(x => x.id === val);
                  const custom = customTemplates.find((x: any) => x.id === val);
                  const t = built || custom;
                  if (t) { setSubj(t.subject); setBody(t.body); }
                }}>
                  <option value="" className="bg-black">Load template…</option>
                  {campaignTemplates.length > 0 && <optgroup label="Built-in">{campaignTemplates.map(t => <option key={t.id} value={t.id} className="bg-black">{t.name}</option>)}</optgroup>}
                  {customTemplates.length > 0 && <optgroup label="My Templates">{customTemplates.map((t: any) => <option key={t.id} value={t.id} className="bg-black">{t.name}</option>)}</optgroup>}
                </GSel>
                <GBtn variant="ghost" className="!text-xs flex-shrink-0" onClick={() => {
                  const name = prompt("Template name:");
                  if (!name?.trim()) return;
                  const newTpl = { id: uid(), name: name.trim(), subject: subj, body };
                  setSettings?.((s: any) => ({ ...s, customCampaignTemplates: [...(s.customCampaignTemplates || []), newTpl] }));
                  toast?.("Template saved ✓", "green");
                }}>Save As…</GBtn>
                {customTemplates.length > 0 && (
                  <GBtn variant="ghost" className="!text-xs flex-shrink-0" onClick={() => {
                    const name = prompt("Delete which template? Type its exact name:");
                    if (!name) return;
                    const match = customTemplates.find((t: any) => t.name === name.trim());
                    if (!match) { toast?.("No template found with that name", "yellow"); return; }
                    setSettings?.((s: any) => ({ ...s, customCampaignTemplates: (s.customCampaignTemplates || []).filter((t: any) => t.id !== match.id) }));
                    toast?.("Template deleted");
                  }}>Delete…</GBtn>
                )}
              </div>
            </div>
            {ch === "email" && <div><label className="text-xs text-white/60 mb-1 block">Subject</label><GInput value={subj} onChange={e => setSubj(e.target.value)} /></div>}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/60">{ch === "email" ? "Body" : "Message"}</label>
                <div className="flex gap-1">
                  {["first_name", "last_name", "address"].map(v => <button key={v} onClick={() => setBody(body + " {{" + v + "}}")} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white">{"{{" + v + "}}"}</button>)}
                </div>
              </div>
              <GTxt rows={ch === "email" ? 8 : 4} value={body} onChange={e => setBody(e.target.value)} />
              {ch === "sms" && <div className="flex items-center justify-between text-[10px] text-white/40 mt-1">
                <span>{body.length} chars · {Math.ceil(body.length / 160)} SMS segment{Math.ceil(body.length / 160) !== 1 ? "s" : ""}</span>
                <button onClick={() => setPreview(matches[0])} className="text-brand-400 hover:text-brand-300">Preview merge →</button>
              </div>}
            </div>
            {preview && <div className="p-3 bg-black/60 border border-brand-900/30 rounded-xl text-xs">
              <div className="text-[10px] text-white/50 mb-1">Preview for {preview.firstName}:</div>
              <div className="whitespace-pre-wrap">{merge(body, preview)}</div>
              <button onClick={() => setPreview(null)} className="text-[10px] text-white/40 mt-2">Close</button>
            </div>}
            {/* Campaign Scheduling */}
            <CampaignScheduler matches={matches} body={body} subj={subj} ch={ch} canSend={canSend} sending={sending} launch={launch} setCampaigns={setCampaigns} />
          </Glass>
        </div>
        <Glass className="p-4 space-y-3">
          <div className="flex items-center gap-2"><Target size={14} className="text-brand-400" /><h3 className="font-semibold text-sm">Audience</h3></div>
          <div><label className="text-xs text-white/60 mb-1 block">Folder</label><GSel value={fFolder} onChange={e => setFFolder(e.target.value)}><option value="" className="bg-black">Any folder</option>{allFolders.map((f: string) => <option key={f} value={f} className="bg-black">{f}</option>)}</GSel></div>
          <div><label className="text-xs text-white/60 mb-1 block">City</label><GSel value={fCity} onChange={e => setFCity(e.target.value)}><option value="" className="bg-black">Any city</option>{cities.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel></div>
          <div><label className="text-xs text-white/60 mb-1 block">Tag</label><GSel value={fTag} onChange={e => setFTag(e.target.value)}><option value="" className="bg-black">Any tag</option>{allTags.map(t => <option key={t} value={t} className="bg-black">{t}</option>)}</GSel></div>
          <div><label className="text-xs text-white/60 mb-1 block">Service type</label><GInput value={fService} onChange={e => setFService(e.target.value)} placeholder="e.g. Seasonal Tune-Up" className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Min total spent ($)</label><GInput type="number" value={fMinSpent} onChange={e => setFMinSpent(e.target.value)} placeholder="e.g. 500" className="!text-xs" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Last serviced before</label><GDate value={fLast} onChange={e => setFLast(e.target.value)} /></div>
          <div className="p-3 bg-gradient-to-br from-brand-950/40 to-black/60 border border-brand-600/40 rounded-xl text-center">
            <div className="text-3xl font-bold">{matches.length}</div>
            <div className="text-xs text-white/60 mt-1">recipients</div>
            <div className="text-[10px] text-white/40 mt-0.5">{ch === "sms" ? matches.filter(c => c.phone).length + " have phone" : matches.filter(c => c.email).length + " have email"}</div>
          </div>
          {/* Save segment */}
          <button onClick={() => {
            const name = prompt("Segment name:", (fFolder || fTag || fCity || "Custom") + " audience");
            if (!name) return;
            setSavedSegments(prev => [...prev, { id: uid(), name, fCity, fTag, fFolder, fLast, count: matches.length, savedAt: today() }]);
            toast("Segment saved: " + name);
          }} className="w-full text-xs text-blue-400 hover:text-blue-300 py-1.5 border border-blue-900/30 rounded-lg hover:bg-blue-950/20 transition">💾 Save this segment</button>
          {savedSegments.length > 0 && <div>
            <div className="text-[10px] text-white/40 mb-1">Saved segments</div>
            <div className="space-y-1">
              {savedSegments.map(s => <div key={s.id} className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/5 rounded-lg text-[10px]">
                <button onClick={() => { setFCity(s.fCity); setFTag(s.fTag); setFFolder(s.fFolder || ""); setFLast(s.fLast); toast("Segment loaded: " + s.name); }} className="flex-1 text-left text-white/70 hover:text-white">{s.name} <span className="text-white/40">({s.count})</span></button>
                <button onClick={() => setSavedSegments(prev => prev.filter(x => x.id !== s.id))} className="text-white/30 hover:text-brand-400"><X size={9} /></button>
              </div>)}
            </div>
          </div>}
          <button onClick={() => { setFCity(""); setFLast(""); setFTag(""); setFService(""); setFMinSpent(""); }} className="w-full text-xs text-brand-400 hover:text-brand-300">Clear all filters</button>
        </Glass>
      </div>}

      {tab === "scheduled" && <div className="space-y-3">
        {campaigns.length ? campaigns.map(c => <Glass key={c.id} className="p-4 hover:border-brand-600/50">
          <div className="flex items-start justify-between gap-4 mb-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1"><Badge tone={c.ch === "email" ? "gray" : "green"}>{c.ch}</Badge><Badge tone="yellow">{c.status}</Badge><span className="text-xs text-white/50">{c.createdAt}</span></div>
              {c.subject && <div className="font-semibold text-sm">{c.subject}</div>}
              <div className="text-xs text-white/60 line-clamp-2 mt-1">{c.body.slice(0, 120)}...</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-brand-400">{c.recipientCount}</div>
              <div className="text-xs text-white/50">recipients</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-brand-900/30 text-xs">
            <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50 mb-0.5">Sent</div><div className="font-bold text-green-400">{c.sentCount ?? 0}</div></div>
            <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50 mb-0.5">Failed</div><div className="font-bold text-danger-400">{c.failedCount ?? 0}</div></div>
            <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50 mb-0.5">Delivery rate</div><div className="font-bold text-yellow-400">{c.deliveryRate ?? 0}%</div></div>
            <div className="p-2 bg-black/40 rounded-lg"><div className="text-white/50 mb-0.5">Conversions</div><div className="font-bold text-purple-400">{c.conversions || 0}</div></div>
          </div>
          {/* AUDIT #6 (round 4) — surface WHY sends failed, not just a count. */}
          {(c.failedCount || 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-brand-900/20">
              <div className="text-[10px] text-danger-400 font-semibold mb-1">{c.failedCount} failed to send{Array.isArray(c.failureSamples) && c.failureSamples.length > 0 ? " — sample reasons:" : ""}</div>
              {Array.isArray(c.failureSamples) && c.failureSamples.map((s: string, i: number) => (
                <div key={i} className="text-[10px] text-white/40 truncate">• {s}</div>
              ))}
            </div>
          )}
        </Glass>) : <div className="text-center py-16 text-white/40">No campaigns yet</div>}
      </div>}

      {/* Re-engagement Sequences — AUDIT FIX (mobile round 10): these used to
          be a hardcoded local array whose "Activate" button just called
          toast(...) and touched no state at all — nothing was ever
          persisted or actually sent. Each sequence below now Activates into
          a REAL, running Automation record (the same engine that already
          powers Automation Hub: 15-min poll, owner batch-approval gate,
          per-customer cooldown/dedup, opt-out respect, daily/hourly/minute
          send caps — see useAutomationEngine.ts). The condition steps'
          `delay` values are CUMULATIVE minutes-since-trigger (matching how
          extractDirectives walks the step list), which is how a multi-touch
          drip like AUTOMATION_TEMPLATES' "Abandoned Estimate Nurture"
          already works — these are built the same way, just pre-filled with
          re-engagement-specific copy and surfaced here instead of only in
          the Automation Hub template gallery. Toggle them off any time from
          either this page or Automation Hub (same underlying record). */}
      {tab === "sequences" && <div className="space-y-4">
        <Glass className="p-4 !bg-blue-950/20 !border-blue-700/30">
          <div className="font-semibold mb-1 flex items-center gap-2"><RefreshCw size={14} className="text-blue-400" />Re-engagement Sequences</div>
          <div className="text-xs text-white/60">Multi-step automated campaigns for inactive customers, abandoned quotes, and post-job follow-up. Activating one creates a real workflow in Automation Hub — it fires automatically from then on (subject to your normal automation approval + send caps).</div>
        </Glass>
        {SEQUENCE_DEFS.map(seq => {
          const auto = automations.find((a: any) => a.id === seq.id);
          const isActive = !!auto?.active;
          return (
            <Glass key={seq.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <div className="font-semibold text-sm flex items-center gap-2">{seq.name} {isActive && <Badge tone="green">Active</Badge>}</div>
                  <div className="text-xs text-white/50 mt-0.5">{seq.desc}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge tone="blue">{seq.triggerLabel}</Badge>
                    <span className="text-[10px] text-white/40">{seq.audienceCount(customers, estimates, jobs)} roughly eligible now</span>
                  </div>
                </div>
                <GBtn
                  variant={isActive ? "ghost" : undefined}
                  className="!text-xs !py-1.5 flex-shrink-0"
                  onClick={() => {
                    if (isActive) {
                      setAutomations((prev: any[]) => prev.map(a => a.id === seq.id ? { ...a, active: false } : a));
                      toast(`"${seq.name}" paused`);
                      return;
                    }
                    const existing = automations.find((a: any) => a.id === seq.id);
                    const newAuto = {
                      id: seq.id, name: seq.name, category: "sequence", isWorkflow: true, icon: "🔄",
                      trigger: seq.steps[0]?.label, action: seq.steps.find((s: any) => s.type === "action")?.label || "",
                      steps: seq.steps, description: seq.desc,
                      count: existing?.count ?? 0, lastTriggered: existing?.lastTriggered ?? null,
                      active: true, sentLog: existing?.sentLog ?? {}, runLog: existing?.runLog ?? [],
                    };
                    setAutomations((prev: any[]) => existing ? prev.map(a => a.id === seq.id ? newAuto : a) : [...prev, newAuto]);
                    toast(`"${seq.name}" activated — it'll run automatically from Automation Hub`, "green");
                  }}
                >{isActive ? "Pause" : "Activate"}</GBtn>
              </div>
              <div className="space-y-1.5 pl-3 border-l-2 border-blue-600/30">
                {seq.display.map((step, i) => (
                  <div key={i} className="text-[11px] text-white/60 flex items-start gap-2">
                    <span className="text-blue-400 font-bold flex-shrink-0">{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </Glass>
          );
        })}

        {/* Holiday Greeting — calendar-anchored, not per-customer nurture, so
            it's modeled as three real one-time scheduled Campaign sends
            (same record CampaignScheduler.tsx already creates for "Schedule
            for later") rather than forced into the per-customer automation
            engine above. AUDIT FIX: scheduled campaigns previously saved a
            record but nothing ever fired it when sendAt arrived — fixed by
            useScheduledCampaigns.ts, wired globally in App.tsx, which polls
            for due scheduled campaigns and actually sends them. */}
        <Glass className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <div>
              <div className="font-semibold text-sm">Holiday Greeting</div>
              <div className="text-xs text-white/50 mt-0.5">Christmas, New Year, Spring reminder — scheduled sends to all customers</div>
              <div className="flex items-center gap-2 mt-1"><Badge tone="blue">Annual dates</Badge><span className="text-[10px] text-white/40">{customers.length} customers</span></div>
            </div>
            <GBtn className="!text-xs !py-1.5 flex-shrink-0" onClick={() => {
              const year = new Date().getFullYear();
              const dec20 = new Date(year, 11, 20); if (dec20.getTime() < Date.now()) dec20.setFullYear(year + 1);
              const jan2 = new Date(dec20.getFullYear() + (dec20.getMonth() === 11 ? 1 : 0), 0, 2); if (jan2.getTime() < Date.now()) jan2.setFullYear(jan2.getFullYear() + 1);
              const mar15 = new Date(jan2.getFullYear(), 2, 15); if (mar15.getTime() < Date.now()) mar15.setFullYear(mar15.getFullYear() + 1);
              const recipientIds = customers.filter((c: any) => c.phone).map((c: any) => c.id);
              const iso = (d: Date) => d.toISOString().slice(0, 16);
              const scheduled = [
                { id: uid(), name: "Holiday Greeting — Christmas", ch: "sms", body: "Hi {{first_name}}, wishing you a wonderful holiday season from {{company_name}}! Book early for spring — slots fill fast. Call {{company_phone}}.", matches: recipientIds, sendAt: iso(dec20), status: "scheduled", createdAt: today() },
                { id: uid(), name: "Holiday Greeting — New Year", ch: "sms", body: "Hi {{first_name}}, happy new year from {{company_name}}! 10% off any service booked this month. Reply NEWYEAR or call {{company_phone}}.", matches: recipientIds, sendAt: iso(jan2), status: "scheduled", createdAt: today() },
                { id: uid(), name: "Holiday Greeting — Spring Reminder", ch: "sms", body: "Hi {{first_name}}, spring is almost here! Book your wash now before the calendar fills up. Reply BOOK or call {{company_phone}}. — {{company_name}}", matches: recipientIds, sendAt: iso(mar15), status: "scheduled", createdAt: today() },
              ];
              setCampaigns((prev: any[]) => [...scheduled, ...prev]);
              toast(`Holiday Greeting scheduled — 3 sends queued for ${recipientIds.length} customers`, "green");
            }}>Activate</GBtn>
          </div>
          <div className="space-y-1.5 pl-3 border-l-2 border-blue-600/30 text-[11px] text-white/60">
            <div><span className="text-blue-400 font-bold">1.</span> Dec 20: Holiday SMS greeting</div>
            <div><span className="text-blue-400 font-bold">2.</span> Jan 2: New Year offer</div>
            <div><span className="text-blue-400 font-bold">3.</span> Mar 15: Spring wash reminder</div>
          </div>
        </Glass>
      </div>}

      {/* A/B Testing */}
      {tab === "ab" && <ABTestPanel matches={matches} toast={toast} settings={settings} setSettings={setSettings} inboxThreads={inboxThreads} />}
    </div>
  );
}

