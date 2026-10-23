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
import { twilioSend, sendEmail } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { Glass } from "./Glass";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";
import { Modal } from "./Modal";
import { Badge } from "./Badge";
import { Stat } from "./Stat";
import { PBar } from "./PBar";
import { PageFade } from "./PageFade";
import { TimeframeSelector } from "./TimeframeSelector";

export function ReviewPreview({ review: r, onClose, customer: c, onUpdate, onSubmit, apiKey, companyName = "CRM Starter", googleReviewLink, googlePlaceId, toast = (..._args: any[]) => {} }) {
  // AUDIT FIX (mobile round 10) — this used to hardcode a search-query link
  // for one specific business ("your business") regardless of
  // which deployment/owner was using the app, ignoring the configurable
  // Google Maps Review Link in Settings that CustomerReviewPage.tsx and
  // ReviewLandingPage.tsx already both correctly read. Same fallback order
  // as those two: direct review link, else Place-ID-constructed URL, else
  // no Google link to offer.
  const googleUrl = googleReviewLink || (googlePlaceId ? `https://search.google.com/local/writereview?placeid=${googlePlaceId}` : "");
  const [lr, setLr] = useState(0);
  const [lf, setLf] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { if (r) { setLr(r.rating || 0); setLf(r.feedback || ""); setAiDraft(""); } }, [r]);

  if (!r || !c) return null;

  const hr = n => { setLr(n); onUpdate({ rating: n }); };
  const isHappy = lr >= 4;
  const isUnhappy = lr > 0 && lr <= 3;
  const hasFeedback = (r.feedback || "").trim().length > 0 && r.status === "completed";

  const generateDraft = async () => {
    setAiLoading(true);
    try {
      const tone = r.rating >= 4 ? "warm, grateful, professional" : "sincere, apologetic, solution-focused, and professional — acknowledge the issue and offer to make it right";
      const prompt = "Draft a short reply (under 80 words) to this customer review for " + companyName + ". Tone: " + tone + ". Sign off from the owner. Review rating: " + r.rating + "/5. Customer: " + c.firstName + ". Their feedback: \"" + (r.feedback || "(no text)") + "\"\n\nReturn only the reply text, no preamble.";
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-5-5",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      const reply = (data?.content?.find(c => c.type === "text")?.text) || data?.content?.[0]?.text || "Could not generate draft.";
      setAiDraft(reply.trim());
    } catch (err) {
      setAiDraft("Error: " + (err.message || "Connection failed"));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Modal open={!!r} onClose={onClose} title="Review" maxW="max-w-xl">
      <div className="space-y-5">
        <div className="text-center">
          <h2 className="text-xl font-bold">How did we do?</h2>
          <p className="text-sm text-white/60 mt-1">Hi {c.firstName}!</p>
        </div>
        <div className="text-center">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => hr(n)} className="transition-transform hover:scale-125"><Star size={36} className={n <= lr ? "text-yellow-400 fill-yellow-400" : "text-white/20"} /></button>)}
          </div>
        </div>

        {isHappy && googleUrl && (
          <Glass className="p-4 !bg-green-950/30 !border-green-700/50 text-center">
            <div className="text-sm font-semibold text-green-300 mb-1">🎉 Share on Google?</div>
            <div className="text-xs text-white/60 mb-3">Your review helps other homeowners.</div>
            <GBtn onClick={() => window.open(googleUrl, "_blank")} className="w-full"><ExternalLink size={12} className="inline mr-1.5" />Google Review</GBtn>
          </Glass>
        )}
        {isHappy && !googleUrl && (
          <Glass className="p-4 !bg-green-950/30 !border-green-700/50 text-center">
            <div className="text-sm font-semibold text-green-300 mb-1">🎉 Thank you!</div>
            <div className="text-xs text-white/60">Set a Google Maps Review Link in Settings → Company to offer a one-tap Google review here.</div>
          </Glass>
        )}

        {isUnhappy && (
          <Glass className="p-4 !bg-yellow-950/30 !border-yellow-700/50">
            <div className="text-sm font-semibold text-yellow-300 mb-1">😕 We want to make it right</div>
            <div className="text-xs text-white/60">Your feedback is private. An owner will reach out within 24 hrs.</div>
          </Glass>
        )}

        <div>
          <label className="text-xs text-white/60 mb-1.5 block">{isUnhappy ? "What went wrong?" : "Tell us more (optional)"}</label>
          <GTxt rows={4} value={lf} onChange={e => { setLf(e.target.value); onUpdate({ feedback: e.target.value }); }} />
        </div>

        {/* AI Response Drafter — owner-facing, only shown for completed reviews with text */}
        {hasFeedback && <Glass className="p-4 !bg-purple-950/20 !border-purple-700/40">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Bot size={14} className="text-purple-400" /><div className="text-sm font-semibold text-purple-300">Draft a response</div></div>
            <button onClick={generateDraft} disabled={aiLoading} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50">
              <Zap size={11} />{aiLoading ? "Writing..." : aiDraft ? "Regenerate" : "Generate with AI"}
            </button>
          </div>
          <div className="text-[10px] text-white/50 mb-2">Gemini drafts a reply you can post to Google / send by email. Owner-only view.</div>
          {aiDraft && <div className="space-y-2">
            <GTxt rows={5} value={aiDraft} onChange={e => setAiDraft(e.target.value)} className="!text-xs" />
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={() => { navigator.clipboard?.writeText(aiDraft); toast("Response copied"); }} className="flex-1 !text-xs"><Copy size={11} className="inline mr-1" />Copy</GBtn>
              <GBtn onClick={() => { window.open("mailto:" + c.email + "?subject=Re: Your review&body=" + encodeURIComponent(aiDraft), "_blank"); }} className="flex-1 !text-xs"><Mail size={11} className="inline mr-1" />Email</GBtn>
            </div>
          </div>}
          {!aiDraft && !aiLoading && <div className="text-[10px] text-white/50 mt-1">Click "Generate with AI" to draft a response with Claude.</div>}
        </Glass>}

        <GBtn onClick={() => { if (lr === 0) return; onSubmit(lr); }} disabled={lr === 0} className="w-full">{r.status === "completed" ? "Update" : "Submit"}</GBtn>
      </div>
    </Modal>
  );
}

// ===== AUTOMATIONS =====
// ===== AUTOMATION TEMPLATES (n8n-style workflows) =====
// Each template is a multi-step workflow: trigger → conditions → actions
const AUTOMATION_TEMPLATES = [
  {
    id: "tpl_lead_nurture",
    name: "Lead Nurture Sequence",
    category: "estimates",
    icon: "📥",
    description: "Welcome new leads, follow up if they don't respond, then escalate.",
    steps: [
      { id: uid(), type: "trigger", label: "New customer added", icon: "👤" },
      { id: uid(), type: "delay", label: "Wait 5 minutes", duration: 5, unit: "min" },
      { id: uid(), type: "action", label: "Send welcome email", channel: "email", template: "welcome" },
      { id: uid(), type: "delay", label: "Wait 2 days", duration: 2, unit: "day" },
      { id: uid(), type: "condition", label: "If no estimate accepted", check: "no_estimate_accepted" },
      { id: uid(), type: "action", label: "Send follow-up SMS", channel: "sms", template: "followup1" },
      { id: uid(), type: "delay", label: "Wait 5 days", duration: 5, unit: "day" },
      { id: uid(), type: "action", label: "Notify owner — call this lead", channel: "internal", target: "owner" }
    ]
  },
  {
    id: "tpl_quote_followup",
    name: "Stale Quote Recovery",
    category: "estimates",
    icon: "💰",
    description: "Auto-recover quotes that aren't responded to within 7 days.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate sent", icon: "📤" },
      { id: uid(), type: "delay", label: "Wait 3 days", duration: 3, unit: "day" },
      { id: uid(), type: "condition", label: "If quote not viewed", check: "quote_not_viewed" },
      { id: uid(), type: "action", label: "Send reminder email", channel: "email", template: "quote_reminder" },
      { id: uid(), type: "delay", label: "Wait 4 days", duration: 4, unit: "day" },
      { id: uid(), type: "condition", label: "If still pending", check: "estimate_pending" },
      { id: uid(), type: "action", label: "Send 5% off incentive", channel: "email", template: "discount_offer" },
      { id: uid(), type: "action", label: "Add task: Personal call", channel: "task", target: "owner" }
    ]
  },
  {
    id: "tpl_job_lifecycle",
    name: "Complete Job Lifecycle",
    category: "jobs",
    icon: "🚚",
    description: "Confirm → On-the-way → Complete → Review request → Re-engagement.",
    steps: [
      { id: uid(), type: "trigger", label: "Job scheduled", icon: "📅" },
      { id: uid(), type: "delay", label: "24h before job", duration: -24, unit: "hour" },
      { id: uid(), type: "action", label: "Send confirmation SMS", channel: "sms", template: "confirm" },
      { id: uid(), type: "trigger", label: "On crew arrival", icon: "📍" },
      { id: uid(), type: "action", label: "Send 'on the way' text", channel: "sms", template: "otw" },
      { id: uid(), type: "trigger", label: "Job complete", icon: "✅" },
      { id: uid(), type: "delay", label: "Wait 2 hours", duration: 2, unit: "hour" },
      { id: uid(), type: "action", label: "Send invoice + review request", channel: "email", template: "review" },
      { id: uid(), type: "delay", label: "Wait 6 months", duration: 6, unit: "month" },
      { id: uid(), type: "action", label: "Send seasonal re-engagement", channel: "email", template: "reengage" }
    ]
  },
  {
    id: "tpl_collections",
    name: "Smart Collections",
    category: "payments",
    icon: "🧾",
    description: "Polite → firm → escalate ladder for unpaid invoices.",
    steps: [
      { id: uid(), type: "trigger", label: "Invoice unpaid 3 days", icon: "💸" },
      { id: uid(), type: "action", label: "Send polite reminder email", channel: "email", template: "reminder1" },
      { id: uid(), type: "delay", label: "Wait 4 days", duration: 4, unit: "day" },
      { id: uid(), type: "condition", label: "Still unpaid", check: "invoice_unpaid" },
      { id: uid(), type: "action", label: "Send firm follow-up SMS", channel: "sms", template: "reminder2" },
      { id: uid(), type: "delay", label: "Wait 7 days", duration: 7, unit: "day" },
      { id: uid(), type: "condition", label: "Still unpaid (14+ days)", check: "invoice_unpaid" },
      { id: uid(), type: "action", label: "Add 1.5% late fee", channel: "internal", target: "billing" },
      { id: uid(), type: "action", label: "Escalate to owner", channel: "internal", target: "owner" }
    ]
  },
  {
    id: "tpl_review_engine",
    name: "Review Engine",
    category: "reviews",
    icon: "⭐",
    description: "Get more 5-star reviews; intercept bad ones before they go public.",
    steps: [
      { id: uid(), type: "trigger", label: "Job complete + 2 hours", icon: "🎉" },
      { id: uid(), type: "action", label: "Send rating SMS (1-5 stars)", channel: "sms", template: "rate" },
      { id: uid(), type: "branch", label: "Branch on rating", branches: ["4-5 stars", "1-3 stars"] },
      { id: uid(), type: "action", label: "→ Send Google review link", channel: "email", template: "google_review", branch: 0 },
      { id: uid(), type: "action", label: "→ Notify owner privately", channel: "internal", target: "owner", branch: 1 }
    ]
  },
  {
    id: "tpl_referral_engine",
    name: "Referral Engine",
    category: "referrals",
    icon: "🎁",
    description: "Activate happy customers as referral sources after 30 days.",
    steps: [
      { id: uid(), type: "trigger", label: "30 days after first job", icon: "🗓️" },
      { id: uid(), type: "condition", label: "Customer rated 5 stars", check: "rated_5" },
      { id: uid(), type: "action", label: "Send referral code email", channel: "email", template: "referral_invite" },
      { id: uid(), type: "delay", label: "Wait 14 days", duration: 14, unit: "day" },
      { id: uid(), type: "condition", label: "If no referrals yet", check: "zero_referrals" },
      { id: uid(), type: "action", label: "Send reminder + sweetener", channel: "email", template: "referral_boost" }
    ]
  },
  {
    id: "tpl_seasonal_blast",
    name: "Seasonal Campaign Blast",
    category: "lifecycle",
    icon: "🌸",
    description: "Annual reminders timed to spring/fall seasons.",
    steps: [
      { id: uid(), type: "trigger", label: "March 1st annually", icon: "🌷" },
      { id: uid(), type: "condition", label: "Last service > 6 months", check: "stale_customer" },
      { id: uid(), type: "action", label: "Send spring offer", channel: "email", template: "spring" },
      { id: uid(), type: "delay", label: "Wait 14 days", duration: 14, unit: "day" },
      { id: uid(), type: "condition", label: "If no booking", check: "no_booking" },
      { id: uid(), type: "action", label: "Resend with $50 off", channel: "email", template: "spring_discount" }
    ]
  },
  {
    id: "tpl_birthday",
    name: "Customer Birthday / Anniversary",
    category: "lifecycle",
    icon: "🎂",
    description: "Automated birthday greetings with a discount offer. Customers love this.",
    steps: [
      { id: uid(), type: "trigger", label: "Customer birthday (annual)", icon: "🎂" },
      { id: uid(), type: "action", label: "Send birthday SMS", channel: "sms", template: "birthday" },
      { id: uid(), type: "delay", label: "Wait 2 days", duration: 2, unit: "day" },
      { id: uid(), type: "condition", label: "If no booking in 30 days", check: "no_recent_job" },
      { id: uid(), type: "action", label: "Send birthday discount offer", channel: "sms", template: "birthday_offer" }
    ]
  },
  {
    id: "tpl_maintenance_30",
    name: "30/60/90-Day Maintenance Reminder",
    category: "lifecycle",
    icon: "🔧",
    description: "Proactively remind customers to book recurring maintenance.",
    steps: [
      { id: uid(), type: "trigger", label: "Job completed", icon: "✅" },
      { id: uid(), type: "delay", label: "Wait 30 days", duration: 30, unit: "day" },
      { id: uid(), type: "action", label: "30-day check-in SMS", channel: "sms", template: "maint_30" },
      { id: uid(), type: "delay", label: "Wait 30 more days", duration: 30, unit: "day" },
      { id: uid(), type: "condition", label: "If not rebooked", check: "no_new_job" },
      { id: uid(), type: "action", label: "60-day reminder SMS + offer", channel: "sms", template: "maint_60" },
      { id: uid(), type: "delay", label: "Wait 30 more days", duration: 30, unit: "day" },
      { id: uid(), type: "condition", label: "If still not rebooked", check: "no_new_job" },
      { id: uid(), type: "action", label: "90-day final nudge", channel: "sms", template: "maint_90" }
    ]
  },
  {
    id: "tpl_abandoned_estimate",
    name: "Abandoned Estimate Nurture",
    category: "estimates",
    icon: "💤",
    description: "Win back estimates that went quiet. 3-touch sequence over 2 weeks.",
    steps: [
      { id: uid(), type: "trigger", label: "Estimate sent", icon: "📤" },
      { id: uid(), type: "delay", label: "Wait 3 days", duration: 3, unit: "day" },
      { id: uid(), type: "condition", label: "If not signed yet", check: "estimate_unsigned" },
      { id: uid(), type: "action", label: "Friendly check-in SMS", channel: "sms", template: "est_followup1" },
      { id: uid(), type: "delay", label: "Wait 5 days", duration: 5, unit: "day" },
      { id: uid(), type: "condition", label: "If still not signed", check: "estimate_unsigned" },
      { id: uid(), type: "action", label: "Limited-time offer email", channel: "email", template: "est_offer" },
      { id: uid(), type: "delay", label: "Wait 7 days", duration: 7, unit: "day" },
      { id: uid(), type: "condition", label: "If still not signed", check: "estimate_unsigned" },
      { id: uid(), type: "action", label: "Final call + expire estimate", channel: "sms", template: "est_final" }
    ]
  },
  {
    id: "tpl_blank",
    name: "Blank Workflow",
    category: "other",
    icon: "📋",
    description: "Start from scratch with a single trigger.",
    steps: [
      { id: uid(), type: "trigger", label: "Click to configure", icon: "▶️" }
    ]
  }
];

const STEP_TYPES = {
  trigger: { label: "Trigger", color: "from-blue-500 to-blue-700", icon: "▶️", desc: "When this happens" },
  condition: { label: "Condition", color: "from-yellow-500 to-amber-700", icon: "🔀", desc: "Only if true" },
  delay: { label: "Wait", color: "from-purple-500 to-violet-700", icon: "⏳", desc: "Pause workflow" },
  action: { label: "Action", color: "from-green-500 to-emerald-700", icon: "⚡", desc: "Do something" },
  branch: { label: "Branch", color: "from-brand-500 to-brand-700", icon: "🌿", desc: "Split paths" }
};

// ===== AUTOMATION EXECUTION ENGINE =====
// Checks whether a trigger condition is met for a given context object.
// Broad trigger matching — handles both programmatic types AND natural language labels
const checkTrigger = (triggerLabel, ctx) => {
  const t = (triggerLabel || "").toLowerCase();
  const { type } = ctx;

  // Always fire for manual test runs
  if (type === "manual" || t.includes("manual")) return true;

  // Job events
  if (type === "job_complete") {
    return t.includes("job complete") || t.includes("complete") || t.includes("after job") || t.includes("post-job") || t.includes("post job");
  }
  if (type === "job_scheduled") {
    return t.includes("job scheduled") || t.includes("scheduled job") || t.includes("new job") || t.includes("booking");
  }
  if (type === "job_started" || type === "job_in_progress") {
    return t.includes("job start") || t.includes("crew start") || t.includes("in progress") || t.includes("on the way") || t.includes("crew arrive");
  }
  if (type === "job_reminder") {
    return t.includes("before") || t.includes("reminder") || t.includes("24h") || t.includes("upcoming");
  }

  // Estimate events
  if (type === "estimate_sent") {
    return t.includes("estimate sent") || t.includes("quote sent") || t.includes("inquiry") || t.includes("new lead");
  }
  if (type === "estimate_accepted" || type === "estimate_approved") {
    return t.includes("estimate accept") || t.includes("quote accept") || t.includes("approved");
  }
  if (type === "estimate_expired") {
    return t.includes("expire") || t.includes("expires in");
  }
  if (type === "estimate_unviewed") {
    return t.includes("unviewed") || t.includes("no open") || t.includes("not viewed") || t.includes("abandoned");
  }

  // Payment events
  if (type === "invoice_unpaid") {
    if (!t.includes("unpaid") && !t.includes("invoice") && !t.includes("overdue") && !t.includes("payment")) return false;
    const days = t.match(/(\d+)\s*days?/)?.[1] ? parseInt(t.match(/(\d+)\s*days?/)[1]) : 3;
    return (ctx.daysSinceInvoiced || 0) >= days;
  }
  if (type === "invoice_paid") {
    return t.includes("invoice paid") || t.includes("payment received");
  }

  // Customer events
  if (type === "customer_added") {
    return t.includes("new customer") || t.includes("new inquiry") || t.includes("new lead");
  }

  // Review events
  if (type === "review_submitted") {
    return t.includes("review") && !t.includes("negative");
  }
  if (type === "negative_review") {
    return (t.includes("negative") || t.includes("low rating") || t.includes("bad review")) && !!ctx.isNegative;
  }

  // Lifecycle / date-based
  if (type === "anniversary") {
    return t.includes("anniversary") || t.includes("1 year") || t.includes("year since");
  }
  if (type === "stale_customer") {
    return t.includes("since last") || t.includes("months since") || t.includes("re-engage") || t.includes("wash again");
  }
  if (type === "birthday") {
    return t.includes("birthday");
  }
  if (type === "referral_booked") {
    return t.includes("referral") || t.includes("referred");
  }
  if (type === "seasonal") {
    return t.includes("march") || t.includes("october") || t.includes("annual") || t.includes("seasonal");
  }

  // Fallback: if labels share significant words, consider it a match
  const ctxWords = type.replace(/_/g, " ").split(" ");
  return ctxWords.some(w => w.length > 3 && t.includes(w));
};

// Check a condition step
const checkCondition = (conditionCheck, ctx) => {
  const { job, customer, estimate } = ctx;
  switch (conditionCheck) {
    case "estimate_pending": return estimate?.status === "pending";
    case "estimate_accepted": return estimate?.status === "approved";
    case "invoice_unpaid": return estimate?.invoiced && !estimate?.paidAt;
    case "invoice_paid": return !!estimate?.paidAt;
    case "quote_not_viewed": return !estimate?.viewed;
    case "no_estimate_accepted": return true; // simplified
    case "rated_5": return ctx.rating >= 5;
    case "rated_low": return ctx.rating <= 3;
    case "stale_customer": return ctx.daysSinceLast > 180;
    case "has_dog": return customer?.hasDog;
    case "no_booking": return true; // simplified
    case "zero_referrals": return !ctx.referralCount;
    case "no_response_24h": return ctx.hoursSinceSent >= 24;
    default: return true;
  }
};

// Execute a single action step, returns a log entry
const executeAction = async (step, ctx, toast, settings) => {
  const ch = step.channel || "sms";
  const target = ctx.customer?.firstName || "Customer";
  const phone = ctx.customer?.phone;
  const email = ctx.customer?.email;

  // Merge template variables
  const merge = (text) => (text || "")
    .replace(/{{first_name}}/gi, ctx.customer?.firstName || "there")
    .replace(/{{last_name}}/gi, ctx.customer?.lastName || "")
    .replace(/{{amount}}/gi, ctx.job?.amount ? fmt(ctx.job.amount) : "")
    .replace(/{{date}}/gi, ctx.job?.scheduledDate || today())
    .replace(/{{address}}/gi, ctx.job?.address || ctx.customer?.address || "")
    .replace(/{{review_link}}/gi, "crm.com/r/[token]")
    .replace(/{{portal_link}}/gi, "crm.com/portal/[id]")
    .replace(/{{company_phone}}/gi, settings?.companyPhone || "(555) 555-0100");

  // Use messageBody if set, otherwise fall back to label
  const rawBody = step.messageBody || step.label || "Notification from CRM Starter";
  const body = merge(rawBody);
  const subject = merge(step.subject || step.label || "Message from CRM Starter");

  // Send real messages when credentials available
  let sent = false;
  if (ch === "sms" && phone && settings?.twilioSid) {
    try { await twilioSend(settings, phone, body); sent = true; }
    catch { /* log but don't block */ }
  } else if (ch === "email" && email && settings?.googleConnected) {
    try { await sendEmail(settings, { to: email, subject, body }); sent = true; }
    catch { /* log but don't block */ }
  } else if (ch === "webhook" && step.url) {
    try {
      await fetch(step.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "automation_fired", customer: ctx.customer?.firstName + " " + ctx.customer?.lastName, step: step.label, timestamp: new Date().toISOString() })
      });
      sent = true;
    } catch { /* silent */ }
  }

  const icons = { email: "📧", sms: "💬", call: "📞", task: "✅", webhook: "🔗", calendar: "📅", internal: "🔔" };
  const msg = (icons[ch] || "⚡") + " [" + ch.toUpperCase() + "] → " + (ch === "sms" || ch === "email" ? (phone || email || target) + ": " : "") + body.slice(0, 80) + (body.length > 80 ? "…" : "");
  if (toast) toast(msg.slice(0, 60) + (msg.length > 60 ? "…" : ""), "success");
  return { ts: Date.now(), step: step.label, channel: ch, target, message: msg, status: sent ? "sent" : "queued", body };
};

// Run an entire workflow given a context — returns { triggered, log }
// NOTE: executeAction is async, so callers must await or use the async variant
const runWorkflow = async (workflow, ctx, toast, settings) => {
  if (!workflow.active) return { triggered: false, log: [], reason: "paused" };

  const normalized = normalizeAutomation(workflow);
  const steps: any[] = normalized.steps || [];
  if (steps.length === 0) return { triggered: false, log: [], reason: "no steps" };

  // Check the first trigger step
  const trigger = steps[0];
  if (!trigger) return { triggered: false, log: [], reason: "no trigger step" };

  // For non-workflow (simple) automations: use the stored trigger string
  const triggerLabel = trigger.type === "trigger" ? trigger.label : (workflow.trigger || trigger.label || "");
  if (!checkTrigger(triggerLabel, ctx)) {
    return { triggered: false, log: [], reason: "trigger condition not met for: " + triggerLabel };
  }

  const log = [];
  let i = (trigger.type === "trigger") ? 1 : 0; // skip trigger step if present
  let skipNext = false;

  while (i < steps.length) {
    const step = steps[i];
    if (!step) { i++; continue; }

    if (skipNext && step.type === "action") {
      skipNext = false; // condition failed — skip this action
      i++;
      continue;
    }

    if (step.type === "condition") {
      const pass = checkCondition(step.check, ctx);
      if (!pass) skipNext = true; // mark next action to skip
    } else if (step.type === "action") {
      skipNext = false;
      const entry = await executeAction(step, ctx, null, settings); // no toast per-action during batch
      log.push(entry);
    } else if (step.type === "delay") {
      log.push({ ts: Date.now(), step: step.label, channel: "delay", status: "queued", message: `⏳ Queued: ${step.label}` });
    } else if (step.type === "branch") {
      log.push({ ts: Date.now(), step: step.label, channel: "branch", status: "branched", message: `🌿 Branch: ${step.label}` });
    }
    i++;
  }

  // Simple automations (no steps array originally): use the stored action string as a single action
  if (!workflow.steps || workflow.steps.length === 0) {
    const ch = (workflow.action || "").toLowerCase().includes("text") || (workflow.action || "").toLowerCase().includes("sms") ? "sms" : "email";
    const entry = await executeAction({ type: "action", label: workflow.action || "Notification", channel: ch }, ctx, null, settings);
    log.push(entry);
  }

  if (log.length === 0) {
    log.push({ ts: Date.now(), step: "completed", channel: "internal", status: "sent", message: "✓ Workflow ran (no action steps configured)" });
  }

  return { triggered: true, log };
};

// Hook to run automations on CRM state changes
const useAutomationEngine = (automations, setAutomations, jobs, customers, estimates, toast, settings) => {
  const [execLog, setExecLog] = useState([]);
  const prevJobStatuses = useRef({});
  const prevEstimateStatuses = useRef({});
  const prevCustomerCount = useRef(0);
  const isRunning = useRef(false);

  const statusKey = jobs.map(j => j.id + ":" + j.status).join("|") + "|est:" + estimates.map(e => e.id + ":" + e.status).join("|") + "|cust:" + customers.length;

  useEffect(() => {
    if (!automations || automations.length === 0) return;
    if (isRunning.current) return;
    isRunning.current = true;

    const run = async () => {
      const newLogs = [];
      const updates = {};

      const fire = async (auto, ctx) => {
        try {
          const result = await runWorkflow(auto, ctx, null, settings);
          if (result.triggered && result.log.length > 0) {
            const entries = result.log.map(l => ({ ...l, workflowId: auto.id, workflowName: auto.name }));
            newLogs.push(...entries);
            updates[auto.id] = { count: (auto.count || 0) + 1, lastTriggered: today() };
          }
        } catch { /* silent */ }
      };

      // ── Detect job status changes ──
      for (const j of jobs) {
        const prev = prevJobStatuses.current[j.id];
        const c = customers.find(x => x.id === j.customerId);
        if (!c) continue;

        if (prev !== undefined && prev !== j.status) {
          const base = { job: j, customer: c, estimate: null, daysSinceLast: 0, hoursSinceSent: 0, rating: 0, isNegative: false, referralCount: 0 };
          if (j.status === "completed") {
            for (const auto of automations.filter(a => a.active)) await fire(auto, { ...base, type: "job_complete" });
          }
          if (j.status === "in_progress") {
            for (const auto of automations.filter(a => a.active)) await fire(auto, { ...base, type: "job_started" });
          }
          if (j.status === "scheduled") {
            for (const auto of automations.filter(a => a.active)) await fire(auto, { ...base, type: "job_scheduled" });
          }
        }
      }

      // ── Detect estimate status changes ──
      for (const e of estimates) {
        const prev = prevEstimateStatuses.current[e.id];
        const c = customers.find(x => x.id === e.customerId);
        if (!c) continue;
        if (prev !== undefined && prev !== e.status) {
          const base = { estimate: e, customer: c, job: null, daysSinceLast: 0, hoursSinceSent: daysSince(e.createdAt) * 24, rating: 0, isNegative: false, referralCount: 0 };
          if (e.status === "pending") {
            for (const auto of automations.filter(a => a.active)) await fire(auto, { ...base, type: "estimate_sent" });
          }
          if (e.status === "approved") {
            for (const auto of automations.filter(a => a.active)) await fire(auto, { ...base, type: "estimate_accepted" });
          }
        }
      }

      // ── Detect new customers ──
      const prevCount = prevCustomerCount.current;
      if (prevCount > 0 && customers.length > prevCount) {
        const newCustomers = customers.slice(prevCount);
        for (const c of newCustomers) {
          const base = { customer: c, job: null, estimate: null, daysSinceLast: 0, hoursSinceSent: 0, rating: 0, isNegative: false, referralCount: 0 };
          for (const auto of automations.filter(a => a.active)) await fire(auto, { ...base, type: "customer_added" });
        }
      }

      // ── Overdue invoice checks (runs every time statuses change) ──
      for (const est of estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt)) {
        const daysOverdue = daysSince(est.invoicedAt);
        if (daysOverdue < 3) continue;
        const c = customers.find(x => x.id === est.customerId);
        if (!c) continue;
        const base = { estimate: est, customer: c, job: null, daysSinceInvoiced: daysOverdue, daysSinceLast: 0, hoursSinceSent: 0, rating: 0 };
        for (const auto of automations.filter(a => a.active)) await fire(auto, { ...base, type: "invoice_unpaid" });
      }

      // Save prev state
      jobs.forEach(j => { prevJobStatuses.current[j.id] = j.status; });
      estimates.forEach(e => { prevEstimateStatuses.current[e.id] = e.status; });
      prevCustomerCount.current = customers.length;

      if (newLogs.length > 0) {
        setExecLog(prev => [...newLogs, ...prev].slice(0, 200));
        setAutomations(prev => prev.map(a => updates[a.id]
          ? { ...a, count: updates[a.id].count, lastTriggered: updates[a.id].lastTriggered, runLog: [...(a.runLog || []), ...newLogs.filter(l => l.workflowId === a.id)].slice(0, 50) }
          : a));
        toast(`⚡ ${newLogs.length} automation action${newLogs.length !== 1 ? "s" : ""} fired`);
      }
      isRunning.current = false;
    };

    run().catch(() => { isRunning.current = false; });
  }, [statusKey]);

  return execLog;
};

