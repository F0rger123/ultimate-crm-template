// auto-extracted from CRM Starter monolith
import { promoUsable, promoProblem } from "../../lib/promoRules";
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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, computeDepositAmount, computeDiscountsTotal, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
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
import { StripePaymentModal } from "../ui/StripePaymentModal";
import { SquarePaymentModal } from "../ui/SquarePaymentModal";
import { getPublicSquareConfig, confirmSquareInvoicePayment } from "../../lib/square";
import { confirmInvoicePayment, preloadStripeJs } from "../../lib/stripe";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { PBar } from "../ui/PBar";
import { PageFade } from "../ui/PageFade";
import { TimeframeSelector } from "../ui/TimeframeSelector";
import { AddressAutocomplete } from "../ui/AddressAutocomplete";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { AnimatedNumber } from "../ui/AnimatedNumber";
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
import { resolvePaymentProvider } from "../../lib/payments";

// Preset options shown to the customer when they decline a quote, so the
// owner gets a quick, structured signal (Dashboard/Estimates badge) instead
// of having to read free text on every decline to find a pattern.
const DECLINE_REASONS = [
  { value: "price", label: "Too expensive" },
  { value: "went_elsewhere", label: "Went with someone else" },
  { value: "changed_mind", label: "Changed my mind / no longer needed" },
  { value: "other", label: "Other" },
];

export function ClientPortal({ estimate: e, customer: c, jobs = [], invoices = [], settings = {} as AppSettings, estimateTemplates = [], promotions = [], customers = [], setCustomers, onClose, onApprove, onDecline, onView = (_id: string) => {} }: { estimate?: any; customer?: any; jobs?: any[]; invoices?: any[]; settings?: AppSettings; estimateTemplates?: any[]; promotions?: any[]; customers?: any[]; setCustomers?: any; onClose?: any; onApprove?: any; onDecline?: any; onView?: (id: string) => void }) {
  const tpl = estimateTemplates.find((t: any) => t.id === e?.templateId);
  const headerColor = tpl?.colorHeader || "";
  const textColor = tpl?.colorText || "";
  const accentColor = tpl?.colorAccent || "";
  const fontFamily = tpl?.font;
  const [showAccount, setShowAccount] = useState(false);
  const [payType, setPayType] = useState("full");
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [showSquareModal, setShowSquareModal] = useState(false);
  const [lockingInSelection, setLockingInSelection] = useState(false);
  // FEATURE — "switch between Stripe and Square easily." Fetches Square's
  // public config (application/location id — safe to expose, same trust
  // level as Stripe's publishable key) directly by owner id so this works
  // both from the public #/estimate/:id route and the owner's in-app
  // preview, regardless of whether `settings` already carries it.
  const [squareConfig, setSquareConfig] = useState<{ connected: boolean; applicationId?: string; locationId?: string; mode?: "sandbox" | "production" } | null>(null);
  useEffect(() => {
    // FEATURE — "owners can use both Square and Stripe." Previously only
    // fetched Square's public config when paymentProvider === "square",
    // which made the two providers mutually exclusive by construction — an
    // owner with BOTH connected could never actually let a customer pay with
    // either. Always check Square's status; the payment button block below
    // now offers whichever provider(s) are actually connected, not just one.
    const ownerId = (e as any)?.owner_id || (e as any)?.ownerId;
    if (!ownerId) return;
    getPublicSquareConfig(ownerId).then(setSquareConfig).catch(() => setSquareConfig(null));
  }, [(e as any)?.owner_id, (e as any)?.ownerId]); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState("view"); // view | sign | payment | done | declined
  const [declining, setDeclining] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declineCategory, setDeclineCategory] = useState<string>("");
  const [sigData, setSigData] = useState(null);
  const [tip, setTip] = useState(0);
  const [customTip, setCustomTip] = useState("");
  // FEATURE — legal disclaimer/T&Cs checkbox at the payment step (previously
  // absent entirely; the only agreement language in the flow was on the
  // signature step, about the estimate total, not payment terms).
  const [agreedToPaymentTerms, setAgreedToPaymentTerms] = useState(false);
  const [payLaterBusy, setPayLaterBusy] = useState(false);
  const [confirmWarn, setConfirmWarn] = useState("");
  // Start downloading Stripe.js as soon as the page opens so "Pay" doesn't
  // wait on it.
  useEffect(() => { if ((settings as any)?.stripePublishableKey) preloadStripeJs(); }, [(settings as any)?.stripePublishableKey]);
  // What the customer actually did, so the Done screen does not claim a
  // payment was processed when they chose "pay after service".
  const [paidAmountNow, setPaidAmountNow] = useState(0);
  // FIX 14 — promo code (business coupon, Settings → Promotions) or a referral
  // code (another customer's referralCode) entered at checkout. Only one of
  // "promotion" | "referral" applies at a time — whichever the code matches.
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ kind: "promotion"; promo: any } | { kind: "referral"; referrer: any } | null>(null);
  const [promoError, setPromoError] = useState("");
  // Options type — toggleable items
  const [enabledItems, setEnabledItems] = useState<Record<string, boolean>>({});
  // Package type — selected package
  const [selectedPkgId, setSelectedPkgId] = useState<string>("");
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  // Default to whichever payment option actually applies — once a deposit is
  // on record, "remaining balance" is the only sensible default.
  useEffect(() => {
    if (!e) return;
    const paid = Number(e.paidDeposit) || 0;
    if (paid > 0 && !e.paidFull) setPayType("remaining");
  }, [e?.id]);

  // BUG FIX — the `onView` prop existed but was never actually called from
  // here, so "quote/invoice viewed" tracking silently never fired for this
  // component — the anonymous #/estimate/:id link path most customers
  // actually use to view a quote (ClientAuthPortal.tsx, the separate
  // logged-in customer portal, was the only place that really marked a view).
  // Guarded on `clientViewedAt` already being set so re-renders/re-visits
  // don't keep re-firing.
  useEffect(() => {
    if (!e?.id || e.clientViewedAt) return;
    onView(e.id);
  }, [e?.id, e?.clientViewedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize options/package state when estimate is available
  useEffect(() => {
    if (!e) return;
    if (e.estimateType === "options") {
      const init: Record<string, boolean> = {};
      (e.lineItems || []).forEach((li: any) => { init[li.id] = !li.optional; });
      setEnabledItems(init);
    }
    if (e.estimateType === "package" && e.packages?.length) {
      setSelectedPkgId(e.packages[0].id);
    }
  }, [e?.id]);

  // Compute effective total based on type
  const effectiveLineItems = e?.estimateType === "options"
    ? (e.lineItems || []).filter((li: any) => enabledItems[li.id] !== false)
    : (e.lineItems || []);
  const effectivePkg = e?.estimateType === "package"
    ? (e.packages || []).find((p: any) => p.id === selectedPkgId)
    : null;
  // AUDIT E (mobile round 4) — this used to charge the raw options/package
  // subtotal straight through with no discount or tax applied at all, unlike
  // the "standard" branch which reuses e.total (already discount+tax'd at
  // save time). Any discount configured on an Options or Package estimate
  // was silently dropped from the amount actually charged via Stripe
  // (payAmt/totalWithTip below) and from the SMS/email confirmations quoting
  // this figure. Apply the same discount+tax math EstimateBuilder uses for
  // the standard type, driven off the live selection (chosen package /
  // toggled-on options) rather than a stale saved total.
  const effectiveSubtotal = e?.estimateType === "package"
    ? (effectivePkg?.subtotal || 0)
    : e?.estimateType === "options"
    ? effectiveLineItems.reduce((s: number, li: any) => s + Number(li.quantity) * Number(li.unitPrice), 0)
    : (e?.subtotal ?? e?.total ?? 0);
  // BUG FIX — "it doesn't show why the price goes up — needs to show
  // that's because of taxes." Package/Options estimates baked tax straight
  // into effectiveTotal with zero visible breakdown — the customer saw a
  // running total that silently included tax with no line explaining it,
  // unlike the Standard type's own totals box further down. Exposing the
  // discount/tax amounts here (not just the final number) lets the totals
  // display below show the same Subtotal/Discount/Tax/Total breakdown for
  // every estimate type, not just Standard.
  const effectiveTaxRate = Number((settings as any)?.taxRate) || 0;
  const effectiveDiscountsTotal = e?.estimateType === "package" || e?.estimateType === "options"
    ? computeDiscountsTotal(e?.discounts, effectiveSubtotal) + Number(e?.discount || 0)
    : Number(e?.discount || 0);
  const effectiveAfterDiscount = Math.max(0, effectiveSubtotal - effectiveDiscountsTotal);
  const effectiveTax = e?.estimateType === "package" || e?.estimateType === "options"
    ? Math.round(effectiveAfterDiscount * (effectiveTaxRate / 100) * 100) / 100
    : Number(e?.tax || 0);
  const effectiveTotal = e?.estimateType === "package" || e?.estimateType === "options"
    ? Math.round((effectiveAfterDiscount + effectiveTax) * 100) / 100
    : (e?.total || 0);
  useEffect(() => {
    if (!e?.id) return;
    if (Number(e.discount) > 0 || (e.discounts || []).length > 0) console.log("[Verify] manual discounts on estimates — working — effectiveTotal:", effectiveTotal);
  }, [e?.id, e?.estimateType, effectiveTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE 6 — depositRequired can now be a flat $ or a % of the total;
  // computeDepositAmount resolves either. Falls back to the pre-existing 25%
  // default when the owner never configured a deposit at all.
  const depositAmt = e ? Math.min(effectiveTotal, computeDepositAmount(e, effectiveTotal) || Math.round(effectiveTotal * 25) / 100) : 0;
  const depositBalanceAmt = Math.max(0, effectiveTotal - depositAmt);
  useEffect(() => {
    if (!e?.id || !e?.depositRequired) return;
    console.log("[Verify] deposits on estimates — working — depositAmt:", depositAmt, "balanceAmt:", depositBalanceAmt);
  }, [e?.id, depositAmt, depositBalanceAmt]); // eslint-disable-line react-hooks/exhaustive-deps
  // A deposit already on record (paidDeposit > 0, nothing paid in full yet)
  // means the customer is back to settle up — offer the actual remainder
  // instead of making them pay the deposit or full total a second time.
  const alreadyPaid = Number(e?.paidDeposit) || 0;
  const remainingAmt = Math.max(0, effectiveTotal - alreadyPaid);
  const hasRemainingBalance = alreadyPaid > 0 && !e?.paidFull && remainingAmt > 0;
  // FEATURE (round 13, item 4) — mandatory deposit only applies before the
  // job exists/is invoiced and before any partial payment is already on record.
  // An invoice only offers a deposit when the owner set one on it on
  // purpose (e.g. Alfred "send an invoice with a 50% deposit"); otherwise an
  // invoice is for completed work and is paid in full (FIX 21 below).
  const invoiceDeposit = !!e?.invoiced && Number(e?.depositRequired) > 0 && !hasRemainingBalance;
  const isDepositMandatory = !!e?.depositMandatory && Number(e?.depositRequired) > 0 && (!e?.invoiced || invoiceDeposit) && !hasRemainingBalance;
  // BUG FIX — "View & Pay Invoice" links always opened on "Review & Sign",
  // even for an invoice that was already signed or already paid in full, so a
  // customer could re-sign and get charged a second time. An invoice (or an
  // estimate that's already signed) goes straight to payment; a fully paid
  // one shows a Paid confirmation with no payment button at all.
  const alreadySigned = !!(e?.signedAt || e?.sigData || e?.invoiced);
  const fullyPaid = !!e?.paidAt && !hasRemainingBalance;
  useEffect(() => {
    if (isDepositMandatory) setPayType("deposit");
  }, [isDepositMandatory, e?.id]);
  const payAmt = payType === "deposit" ? depositAmt : payType === "remaining" ? remainingAmt : effectiveTotal;

  // FIX 14 — promo/referral code discount, applied to the payment amount
  // before tip. Referral codes reuse the existing referral program's
  // referee-discount settings (Settings → Referrals) rather than inventing a
  // second discount config.
  const referralSettings = (settings as any)?.referralSettings || { referrerCredit: 25, refereeDiscount: 10, refereeDiscountType: "percent" };
  const promoDiscount = !appliedPromo ? 0
    : appliedPromo.kind === "promotion"
    ? Math.min(payAmt, appliedPromo.promo.discountType === "percent" ? Math.round(payAmt * appliedPromo.promo.discountValue) / 100 : Number(appliedPromo.promo.discountValue) || 0)
    : Math.min(payAmt, referralSettings.refereeDiscountType === "percent" ? Math.round(payAmt * referralSettings.refereeDiscount) / 100 : Number(referralSettings.refereeDiscount) || 0);
  const totalWithTip = Math.max(0, payAmt - promoDiscount) + tip;

  const applyPromoCode = () => {
    const code = promoCode.trim().toUpperCase();
    setPromoError("");
    if (!code) return;
    // Same rule checkout uses (lib/promoRules.ts) — start/end dates, usage
    // limit, and coupons made for one customer only work for that customer.
    const matches = (promotions || []).filter((p: any) => (p.code || "").toUpperCase() === code);
    const promo = matches.find((p: any) => promoUsable(p, { customerId: c?.id }));
    if (promo) { setAppliedPromo({ kind: "promotion", promo }); return; }
    if (matches.length) { setAppliedPromo(null); setPromoError(promoProblem(matches[0], { customerId: c?.id }) || "Code not recognized or expired"); return; }
    const referrer = (customers || []).find((cust: any) => cust.id !== c?.id && (cust.referralCode || "").toUpperCase() === code);
    if (referrer) { setAppliedPromo({ kind: "referral", referrer }); return; }
    setAppliedPromo(null);
    setPromoError("Code not recognized or expired");
  };

  // Notify Will when estimate is first viewed
  useEffect(() => {
    if (!e?.id) return;
    const key = "crm.estimateViewed." + e.id;
    if (sessionStorage.getItem(key)) return; // only fire once per session
    sessionStorage.setItem(key, "1");
    // ISSUE 11 (round 11) — this said "ESTIMATE VIEWED" unconditionally, even
    // when the row being viewed is actually an invoice (invoiced: true — an
    // invoice is just an estimate row with that flag set, per how this app
    // models the two, see docs/ARCHITECTURE.md). A customer opening their invoice after
    // the job was done got the same "estimate" wording as a fresh quote,
    // which is confusing/wrong once money is actually being requested.
    const isInvoice = !!(e as any).invoiced;
    const kind = isInvoice ? "INVOICE" : "QUOTE";
    if (settings?.twilioSid && settings?.myPhone && c) {
      const msg = `👀 ${kind} VIEWED\n\n` + c.firstName + " " + c.lastName + ` just opened their ${isInvoice ? "invoice" : "quote"} for ` + fmt(e.total) + `.\n\nNow's a great time to follow up if they don't ${isInvoice ? "pay" : "sign"} in 30 min. — Alfred`;
      twilioSend(settings, settings.myPhone, msg).catch(() => {});
    }
    // ISSUE 21 (round 4) — this page is unauthenticated (a customer, not the
    // owner), so it can't write into the owner's synced Alfred conversations
    // directly. Routes through a Cloudflare Function (functions/api/
    // alfred-notify.ts) that resolves the one owner_id this single-tenant
    // deployment has and appends into one persistent "Alfred Notifications"
    // thread server-side, instead of the SMS ping above being the only trace
    // of this event and every view spawning its own throwaway chat.
    if (c) {
      fetch("/api/alfred-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Alfred Notifications",
          message: `👀 ${kind} VIEWED\n\n` + c.firstName + " " + c.lastName + ` just opened their ${isInvoice ? "invoice" : "quote"} for ` + fmt(e.total) + `.\n\nNow's a great time to follow up if they don't ${isInvoice ? "pay" : "sign"} in 30 min.`,
          estimateId: e.id,
        }),
      }).catch(() => {});
    }
    onView?.(e.id);
  }, [e?.id]); // eslint-disable-line

  if (!e || !c) return null;

  // Signature canvas setup
  useEffect(() => {
    if (step !== "sign") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [step]);

  // BUG FIX (mobile audit) — canvas renders at CSS width "w-full" but has a
  // fixed intrinsic resolution, so raw client coords drift from the actual
  // touch point on any phone narrower than the canvas's real pixel width —
  // this is the customer-facing e-sign flow, worth getting right.
  const getPos = (canvas, e) => {
    const r = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
  };

  const startDraw = e => {
    drawing.current = true;
    lastPos.current = getPos(canvasRef.current, e);
  };

  const draw = e => {
    if (!drawing.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => {
    drawing.current = false;
    setSigData(canvasRef.current.toDataURL());
  };

  const clearSig = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSigData(null);
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      if (onDecline) await onDecline(e.id, { reason: declineReason.trim() || undefined, category: declineCategory || undefined });
      setStep("declined");
      if (settings?.twilioSid && settings?.myPhone) {
        const categoryLabel = DECLINE_REASONS.find(r => r.value === declineCategory)?.label;
        twilioSend(settings, settings.myPhone, "❌ ESTIMATE DECLINED: " + c.firstName + " " + c.lastName + " declined " + fmt(effectiveTotal) + (categoryLabel ? " — " + categoryLabel : "") + (declineReason.trim() ? " (\"" + declineReason.trim() + "\")" : "")).catch(() => {});
      }
    } finally {
      setDeclining(false);
    }
  };

  const handleApprove = async (paymentIntentId?: string, payChoice: "now" | "later" | "deposit" = "now", provider: "stripe" | "square" = "stripe") => {
    // FIX 14 — redeem the applied promo/referral code once the customer
    // actually approves. A promotion bumps its redeemedCount; a referral
    // credits the REFERRER (not this customer) per Settings → Referrals.
    // SECURITY/SYNC FIX (audit finding) — this anonymous customer session has
    // no owner_id-scoped RLS session, so the old direct client-side writes
    // below silently matched 0 rows every time (docs/ARCHITECTURE.md's documented
    // 0-row-silent-success gotcha): promo usageLimit was never actually
    // enforced end-to-end, and referrers never actually got credited. Routes
    // through /api/public-data's service-role actions instead, same pattern
    // as this component's other anonymous writes (mark_estimate_viewed, etc).
    if (appliedPromo?.kind === "promotion") {
      const promoId = appliedPromo.promo.id;
      fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "redeem_promotion", promoId, estimateId: e.id }) })
        .catch((err: any) => console.warn("[ClientPortal] redeem_promotion failed:", err?.message));
    } else if (appliedPromo?.kind === "referral") {
      const referrer = appliedPromo.referrer;
      const nextCredit = (Number(referrer.referralCreditOwed) || 0) + (Number(referralSettings.referrerCredit) || 0);
      setCustomers?.((prev: any[]) => prev.map(cust => cust.id === referrer.id ? { ...cust, referralCreditOwed: nextCredit } : cust));
      fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "credit_referral", referrerId: referrer.id, estimateId: e.id }) })
        .catch((err: any) => console.warn("[ClientPortal] credit_referral failed:", err?.message));
    }
    if (onApprove) onApprove(e.id, {
      sigData, payType, tip, totalPaid: paymentIntentId ? totalWithTip : 0, signedAt: new Date().toISOString(), payChoice,
      ...(paymentIntentId ? {
        paymentProvider: provider,
        ...(provider === "square" ? { squarePaymentId: paymentIntentId } : { stripePaymentIntentId: paymentIntentId }),
        stripePaymentStatus: "paid" as const,
      } : {}),
    });
    // BUG FIX — an invoice / already-signed estimate is past approve_estimate
    // (the server ignores a second approval), so record the payment itself
    // through the server-verified confirm action — same one the customer
    // login portal uses. Without this, a Square payment from an invoice link
    // was charged but never marked paid (Stripe also has its webhook).
    // approve_estimate no longer records payments (it can't verify them), so
    // every payment from this page — first approval included — is confirmed
    // here.
    if (paymentIntentId && e?.id) {
      const confirm = provider === "square" ? confirmSquareInvoicePayment(e.id, paymentIntentId) : confirmInvoicePayment(e.id, paymentIntentId);
      Promise.resolve(confirm).catch((err: any) => {
        console.error("[ClientPortal] confirm invoice payment failed:", err?.message);
        setConfirmWarn("Payment received, but confirming it with the business is taking longer than usual — it may take a minute to show as paid.");
      });
    }
    setPaidAmountNow(paymentIntentId ? totalWithTip : 0);
    setStep("done");

    if (!paymentIntentId) {
      if (settings?.twilioSid && settings?.myPhone) {
        twilioSend(settings, settings.myPhone, "✍️ ESTIMATE SIGNED (pay later): " + c.firstName + " " + c.lastName + " approved " + fmt(effectiveTotal) + " — will arrange payment after service.").catch(() => {});
      }
      return;
    }

    // Payment confirmation SMS to customer
    if (settings?.twilioSid && c.phone) {
      const confirmMsg = "Hi " + c.firstName + "! Your payment of $" + totalWithTip.toFixed(2) + " to " + (settings?.companyName || "CRM Starter") + " has been received ✅ We'll be in touch to confirm your service date. Thank you! — " + (settings?.companyName || "CRM Starter");
      twilioSend(settings, c.phone, confirmMsg)
        .then(() => fetch("/api/public-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "log_outbound_sms", customerId: c.id, contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, smsBody: confirmMsg }) }).catch(() => {}))
        .catch(() => {});
    }

    // Payment confirmation email to customer
    if (c.email && settings?.googleConnected) {
      const subject = "Payment Receipt — " + (settings?.companyName || "CRM Starter");
      const receiptRows = (e.lineItems || []).map(li => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08)"><span>${li.description}</span></div>`).join("");
      const body = emailShell(settings as any, "Payment Receipt", `<p>Hi ${c.firstName},</p><p>Thank you for your payment!</p>${receiptRows}<div style="display:flex;justify-content:space-between;padding:10px 0;margin-top:6px;border-top:1px solid rgba(255,255,255,0.15)"><span>Amount</span><strong>$${totalWithTip.toFixed(2)}</strong></div><p style="margin-top:16px">We'll contact you soon to confirm your service date.</p>`);
      sendEmail(settings, { to: c.email, subject, body }).catch(() => {});
    }

    // Notify Will via SMS about the new payment
    if (settings?.twilioSid && settings?.myPhone) {
      const ownerMsg = "💰 PAYMENT RECEIVED: " + c.firstName + " " + c.lastName + " paid $" + totalWithTip.toFixed(2) + (tip > 0 ? " (incl. $" + tip.toFixed(2) + " tip)" : "") + " — " + (e.lineItems?.[0]?.description || "service");
      twilioSend(settings, settings.myPhone, ownerMsg).catch(() => {});
    }
  };

  const companyName = settings?.companyName || "CRM Starter";
  const companyPhone = settings?.companyPhone || "(555) 555-0100";

  // BUG FIX — "the quote demo just sits there, no button responds." The JSX
  // below dereferences c.firstName/e.notes/etc directly (no optional
  // chaining) — Modal's own `open={!!e}` prop doesn't stop React from still
  // EVALUATING these children on every render (JSX children are built by the
  // caller before the child component ever sees them), so a customer with no
  // matching record (a stale/orphaned estimate.customerId, or a demo picker
  // that resolved `e` but not `c`) crashed the render entirely — the app's
  // root ErrorBoundary then unmounts everything, which just looks like a
  // frozen, unresponsive screen rather than a helpful error. Bail out to a
  // real, visible message instead of a silent crash.
  if (e && !c) {
    return (
      <Modal open onClose={onClose} title="Can't load this quote">
        <div className="text-sm text-white/70 py-4 text-center">This quote's customer record couldn't be found — it may have been deleted. Close this and try a different one.</div>
      </Modal>
    );
  }

  return (
    <Modal open={!!e} onClose={onClose} title="" maxW="max-w-2xl" noBodyScroll>
      <div className="h-full flex flex-col overflow-hidden" style={fontFamily ? { fontFamily } : undefined}>
        {/* Portal header — BUG FIX (2nd report — still overlapping): this
            used to be `position: sticky` inside a PADDED scroll container,
            with a negative margin pulling it up to cancel that padding —
            a known CSS trap (sticky's "top: 0" is measured from the
            scrollport's padding edge, but the element's rest position sits
            above that edge because of the negative margin), which visibly
            overlapped whatever came right after it by about the padding
            amount. Switched the whole layout to noBodyScroll: header and
            step indicator are now plain flex-column siblings OUTSIDE any
            scroll container (so they can never overlap anything), and only
            the actual estimate content below scrolls, in its own
            unpadded/unmargined flex-1 region. */}
        {/* BUG FIX — "the red banner partially covers the progress bar
            (1/2/3/4)." A long company name + phone/address on one side and
            "My Account"/invoice # on the other had no truncation or wrap
            safety — on a narrow (mobile) viewport this could grow the
            header taller than expected between renders, so its `sticky`
            box ended up overlapping the very next element (the step
            indicator) instead of sitting cleanly above it. min-w-0/truncate
            keeps the header a single predictable height regardless of how
            long the company name is; flex-shrink-0 keeps the right side
            from ever being squeezed into wrapping either. */}
        <div className={"pl-4 sm:pl-6 pr-14 sm:pr-16 py-3 sm:py-4 flex-shrink-0 " + (headerColor ? "text-white" : "bg-brand-600 text-brand-fg")} style={headerColor ? { background: headerColor } : undefined}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              {tpl?.logoUrl && <img src={tpl.logoUrl} alt="" className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-contain bg-white/90 p-1 flex-shrink-0" />}
              <div className="min-w-0">
                <div className="font-bold text-base sm:text-lg truncate">{tpl?.headerText || companyName}</div>
                <div className="opacity-60 text-[11px] sm:text-xs truncate">{companyPhone} · your area</div>
              </div>
            </div>
            <div className="text-right opacity-80 text-xs flex-shrink-0">
              {showAccount ? (
                <button onClick={() => setShowAccount(false)} className="font-bold text-sm flex items-center gap-1 ml-auto"><ChevronLeft size={12} />Back</button>
              ) : (
                <button onClick={() => setShowAccount(true)} className="font-bold text-sm flex items-center gap-1 ml-auto hover:opacity-100"><User size={12} />My Account</button>
              )}
              <div>#{e.id.toUpperCase()}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
        {showAccount ? (
          <div className="p-6 space-y-4">
            <div className="text-lg font-bold">Hi {c.firstName} 👋</div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">Past Jobs</div>
              {jobs.filter((j: any) => j.customerId === c.id).length === 0 ? (
                <div className="text-sm text-white/40 py-4 text-center">No job history yet</div>
              ) : (
                <div className="space-y-2">
                  {jobs.filter((j: any) => j.customerId === c.id).sort((a: any, b: any) => (b.scheduledDate || "").localeCompare(a.scheduledDate || "")).map((j: any) => (
                    <Glass key={j.id} className="p-3 !bg-black/40 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{j.address}</div>
                        <div className="text-xs text-white/40">{j.scheduledDate}</div>
                      </div>
                      <Badge tone={j.status === "completed" ? "green" : j.status === "cancelled" ? "red" : "blue"}>{j.status}</Badge>
                    </Glass>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">Invoices</div>
              {invoices.filter((inv: any) => inv.customerId === c.id).length === 0 ? (
                <div className="text-sm text-white/40 py-4 text-center">No invoices yet</div>
              ) : (
                <div className="space-y-2">
                  {invoices.filter((inv: any) => inv.customerId === c.id).map((inv: any) => (
                    <Glass key={inv.id} className="p-3 !bg-black/40 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{fmt(inv.total)}</div>
                        <div className="text-xs text-white/40">{inv.invoicedAt}</div>
                      </div>
                      <Badge tone={inv.paidAt ? "green" : "yellow"}>{inv.paidAt ? "Paid" : "Unpaid"}</Badge>
                    </Glass>
                  ))}
                </div>
              )}
            </div>
            <GBtn variant="ghost" onClick={() => setShowAccount(false)} className="w-full">← Back to Quote</GBtn>
          </div>
        ) : (
        <>
        {/* Step indicator */}
        <div className="flex items-center px-4 sm:px-6 py-3 bg-black/20 border-b border-brand-900/20 gap-1.5 sm:gap-2 overflow-x-auto">
          {["view","sign","payment","done"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={"w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all " + (step === s ? "bg-brand-600 text-brand-fg" : ["done","payment","sign","view"].indexOf(step) < ["done","payment","sign","view"].indexOf(s) ? "bg-white/10 text-white/40" : "bg-green-600/40 text-green-300")}>
                {i + 1}
              </div>
              <span className={"text-[10px] capitalize hidden sm:block " + (step === s ? "text-white font-medium" : "text-white/40")}>{s === "view" ? "Review" : s === "sign" ? "Sign" : s === "payment" ? "Payment" : "Done"}</span>
              {i < 3 && <ChevronRight size={12} className="text-white/20" />}
            </div>
          ))}
        </div>

        <div className="p-6">
          {/* STEP 1: Review */}
          {step === "view" && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-1">Bill To</div>
                <div className="font-semibold text-lg">Hi {c.firstName} 👋</div>
                <div className="text-white/60 text-sm">{c.address}</div>
              </div>
              <div className="p-4 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-white/50 uppercase tracking-wider">{fullyPaid ? "Paid in full" : hasRemainingBalance ? "Balance due" : e.invoiced ? "Amount due" : "Quote total"}</div>
                  {(Number(e.tax) > 0 || effectiveTax > 0) && <div className="text-[11px] text-white/40 mt-0.5">Includes {fmt(effectiveTax)} tax</div>}
                  {!fullyPaid && !hasRemainingBalance && (!e.invoiced || invoiceDeposit) && Number(e.depositRequired) > 0 && <div className="text-[11px] text-yellow-300/90 mt-0.5">Deposit due now {fmt(depositAmt)} · balance after service {fmt(Math.max(0, effectiveTotal - depositAmt))}</div>}
                </div>
                <div className="text-2xl font-black tabular-nums">{fmt(hasRemainingBalance ? remainingAmt : effectiveTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-white/50 uppercase tracking-wider mb-2">
                  {e.estimateType === "package" ? "Choose Your Package" : e.estimateType === "options" ? "Services — Select What You Need" : "Services"}
                </div>

                {/* PACKAGE type — radio buttons per package */}
                {e.estimateType === "package" && (e.packages || []).map((pkg: any) => (
                  <div key={pkg.id} onClick={() => setSelectedPkgId(pkg.id)} className={"mb-2 p-3 rounded-xl border-2 cursor-pointer transition-all duration-300 " + (selectedPkgId === pkg.id ? "border-brand-500 bg-brand-950/20 scale-[1.01]" : "border-white/10 bg-black/40 hover:border-white/20")}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={"w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors " + (selectedPkgId === pkg.id ? "border-brand-500" : "border-white/30")}>
                          {selectedPkgId === pkg.id && <div className="w-2 h-2 rounded-full bg-brand-500 text-brand-fg" />}
                        </div>
                        <div className="font-semibold text-sm">{pkg.name}</div>
                      </div>
                      <AnimatedNumber value={pkg.subtotal || 0} format={fmt} className="font-bold text-brand-400 text-sm tabular-nums" />
                    </div>
                    {pkg.description && <div className="text-xs text-white/50 ml-6 mb-1">{pkg.description}</div>}
                    <div className="ml-6 space-y-0.5">
                      {(pkg.lineItems || []).map((li: any) => <div key={li.id} className="text-xs text-white/60 flex justify-between"><span>· {li.description}</span><span>{fmt(li.quantity * li.unitPrice)}</span></div>)}
                    </div>
                  </div>
                ))}

                {/* OPTIONS type — checkboxes.
                    BUG FIX — "you made some checkmarks uncheckable — it
                    doesn't allow you to select or deselect one of the
                    option service offers, which doesn't make sense." Root
                    cause: toggling required li.optional === true on EVERY
                    individual line item, on top of the estimate already
                    being type "options" — a real quote easily has items
                    the owner never explicitly flagged (it's a separate,
                    easy-to-forget checkbox in EstimateBuilder), and those
                    silently rendered as a bare, unclickable placeholder box
                    with no toggle at all. If the owner chose "Options" as
                    the estimate type, every item in it should be
                    selectable by default — that's what "Options" means.
                    li.optional === false is now the rare explicit opt-OUT
                    for a genuinely mandatory line (e.g. a required base
                    service), not the default gate on everything else. */}
                {e.estimateType === "options" && (
                  <div className="space-y-2">
                    {(e.lineItems || []).map((li: any) => {
                      const locked = li.optional === false;
                      const enabled = locked || enabledItems[li.id] !== false;
                      return (
                        <div key={li.id} onClick={() => !locked && setEnabledItems(p => ({ ...p, [li.id]: !enabled }))} className={"p-3 rounded-xl border transition-all duration-300 " + (locked ? "" : "cursor-pointer ") + (enabled ? "bg-black/40 border-brand-900/20 scale-[1.005]" : "bg-black/20 border-white/5 opacity-60")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {!locked ? (
                                <div className={"w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors duration-200 " + (enabled ? "border-brand-500 bg-brand-500 text-brand-fg" : "border-white/30")}>
                                  {enabled && <CheckCircle size={10} className="text-brand-fg" />}
                                </div>
                              ) : <div className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm">{li.description}</div>
                                {!locked ? <div className="text-[10px] text-blue-400/70 mt-0.5">Optional — tap to toggle</div> : <div className="text-[10px] text-white/30 mt-0.5">Required</div>}
                                {li.notes && !li.notesInternal && <div className="text-xs text-white/60 mt-1 italic">{li.notes}</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {li.photo && <img src={li.photo} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10" />}
                              <AnimatedNumber value={li.quantity * li.unitPrice} format={fmt} className={"font-bold text-sm tabular-nums transition-colors duration-300 " + (enabled ? "text-brand-400" : "text-white/30")} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-xs text-white/40 text-right">Running total (incl. tax): <AnimatedNumber value={effectiveTotal} format={fmt} className="text-white font-semibold tabular-nums" /></div>
                  </div>
                )}

                {/* STANDARD type — original display */}
                {(!e.estimateType || e.estimateType === "standard") && (
                  <div className="space-y-2">
                    {(e.lineItems || []).map((li: any) => (
                      <div key={li.id} className="p-3 bg-black/40 border border-brand-900/20 rounded-xl">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{li.description}</div>
                            {li.quantity > 1 && <div className="text-xs text-white/50">× {li.quantity}</div>}
                            {li.notes && !li.notesInternal && <div className="text-xs text-white/60 mt-1 italic">{li.notes}</div>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {li.photo && <img src={li.photo} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10" />}
                            <AnimatedNumber value={li.quantity * li.unitPrice} format={fmt} className="font-bold text-brand-400 tabular-nums" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Glass className="p-4 !bg-black/60">
                <div className="space-y-1 text-sm">
                  {/* BUG FIX — every estimate type now shows the real
                      Subtotal → Discount → Tax → Total breakdown, not just
                      Standard — so a Package/Options total that's higher
                      than the visible line items is always explained by a
                      real tax line, never a silent jump. */}
                  <div className="flex justify-between text-white/70"><span>Subtotal</span><AnimatedNumber value={effectiveSubtotal} format={fmt} className="tabular-nums" /></div>
                  {effectiveDiscountsTotal > 0 && <div className="flex justify-between text-green-400"><span>Discount</span><AnimatedNumber value={effectiveDiscountsTotal} format={(n) => `− ${fmt(n)}`} className="tabular-nums" /></div>}
                  <div className="flex justify-between text-white/70"><span>Tax{effectiveTaxRate > 0 ? ` (${effectiveTaxRate}%)` : ""}</span><AnimatedNumber value={effectiveTax} format={fmt} className="tabular-nums" /></div>
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-brand-900/30"><span>Total</span><AnimatedNumber value={effectiveTotal} format={fmt} className="text-brand-400 text-xl tabular-nums" /></div>
                </div>
              </Glass>
              {e.notes && <Glass className="p-3 !bg-blue-950/20 !border-blue-700/30"><div className="text-xs text-white/60 mb-1">Notes</div><div className="text-sm">{e.notes}</div></Glass>}
              {(tpl?.photoSlots || []).filter(Boolean).length > 0 && (
                <div className="flex gap-2">
                  {tpl.photoSlots.filter(Boolean).map((p: string, i: number) => <img key={i} src={p} alt="" className="w-16 h-16 rounded-lg object-cover border border-white/10" />)}
                </div>
              )}
              {e.terms && <div className="text-[10px] text-white/40 leading-relaxed">{e.terms}</div>}
              {tpl?.footerText && <div className="text-[10px] text-white/30 text-center italic">{tpl.footerText}</div>}
              {fullyPaid ? (
                <Glass className="p-4 !bg-green-950/20 !border-green-700/40 text-center space-y-1">
                  <div className="text-green-300 font-bold">✓ Paid in full</div>
                  <div className="text-xs text-white/50">Thank you! Nothing is due on this {e.invoiced ? "invoice" : "quote"}.</div>
                </Glass>
              ) : (
                <GBtn onClick={() => setStep(alreadySigned ? "payment" : "sign")} className="w-full !py-3 text-base font-bold" style={accentColor ? { background: accentColor } : undefined}>
                  {alreadySigned ? (invoiceDeposit ? (isDepositMandatory ? "Pay " + fmt(depositAmt) + " deposit →" : "Pay deposit or in full →") : "Pay " + fmt(hasRemainingBalance ? remainingAmt : effectiveTotal) + " →") : "Review & Sign →"}
                </GBtn>
              )}
              {(!e.status || e.status === "pending") && !e.invoiced && !fullyPaid && (
                declining ? (
                  <Glass className="p-4 !bg-black/40 space-y-3">
                    <div className="text-sm font-medium">Decline this quote?</div>
                    <div className="text-xs text-white/50">Mind telling us why? It helps us follow up correctly.</div>
                    <div className="grid grid-cols-2 gap-2">
                      {DECLINE_REASONS.map(r => (
                        <button
                          key={r.value}
                          onClick={() => setDeclineCategory(r.value)}
                          className={"py-2 px-2 rounded-xl border text-xs font-medium transition " + (declineCategory === r.value ? "border-danger-500/60 bg-danger-950/40 text-danger-300" : "border-white/10 bg-white/5 text-white/60 hover:text-white")}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={declineReason}
                      onChange={(ev: any) => setDeclineReason(ev.target.value)}
                      rows={2}
                      placeholder="Anything else you'd like to add? (optional)"
                      className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-brand-500/50"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={handleDecline} className="py-2.5 rounded-xl border border-danger-700/40 bg-danger-950/30 text-danger-300 font-semibold hover:bg-danger-900/40 transition">
                        Confirm Decline
                      </button>
                      <button onClick={() => { setDeclining(false); setDeclineReason(""); setDeclineCategory(""); }} className="py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white transition">
                        Never mind
                      </button>
                    </div>
                  </Glass>
                ) : (
                  <button onClick={() => setDeclining(true)} className="w-full py-2.5 text-sm text-white/40 hover:text-danger-400 transition">
                    Decline this quote
                  </button>
                )
              )}
            </div>
          )}

          {/* STEP: Declined confirmation.
              BUG FIX — "it should not just dead-end — let them look at it
              again." This used to be a static screen with no way back —
              a customer who declined by mistake, or changed their mind,
              had no path except contacting the company directly. */}
          {step === "declined" && (
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 rounded-full bg-brand-950/40 border border-brand-700/50 flex items-center justify-center mx-auto">
                <span className="text-2xl">✕</span>
              </div>
              <div className="text-lg font-bold text-white">Quote declined</div>
              <div className="text-sm text-white/50 max-w-xs mx-auto">We've let {settings?.companyName || "the company"} know. Changed your mind?</div>
              <button onClick={() => setStep("view")} className="text-sm text-brand-400 hover:text-brand-300 font-semibold underline underline-offset-4">
                ← Look at it again
              </button>
            </div>
          )}

          {/* STEP 2: Signature */}
          {step === "sign" && (
            <ESignatureStep
              e={e} c={c} companyName={companyName} sigData={sigData} setSigData={setSigData}
              canvasRef={canvasRef} startDraw={startDraw} draw={draw} stopDraw={stopDraw} clearSig={clearSig}
              onBack={() => setStep("view")} onNext={() => setStep("payment")}
            />
          )}

          {/* STEP 3: Payment */}
          {step === "payment" && (
            <div className="space-y-4">
              <div className="font-semibold">Payment Options</div>
              {/* FIX 21 — a deposit secures a FUTURE job; once e.invoiced is
                  true the job is already done and the customer owes the full
                  (or remaining) amount for completed work, not a deposit
                  toward it. Offering "Pay Deposit" here read as "why is it
                  letting me pay only part of a bill for work that's already
                  finished?" — only estimates (not-yet-invoiced, job still
                  ahead of them) should ever offer the deposit choice. */}
              {/* FEATURE (round 13, item 4) — a mandatory deposit removes the
                  "pay in full" / "pay later" choices entirely, so the
                  customer can't skip the deposit the owner requires to book. */}
              {isDepositMandatory && (
                <div className="text-xs text-yellow-300 bg-yellow-950/20 border border-yellow-700/30 rounded-xl px-3 py-2">
                  A deposit is required to book this job.
                </div>
              )}
              <div className={"grid gap-3 " + (hasRemainingBalance || (e?.invoiced && !invoiceDeposit) || isDepositMandatory ? "grid-cols-1" : "grid-cols-2")}>
                {(hasRemainingBalance
                  ? [{ k: "remaining", l: "Pay Remaining Balance", sub: fmt(remainingAmt) + " due — " + fmt(alreadyPaid) + " already paid" }]
                  : e?.invoiced && !invoiceDeposit
                  ? [{ k: "full", l: "Pay in Full", sub: fmt(e.total) + " due for completed service" }]
                  : isDepositMandatory
                  ? [{ k: "deposit", l: "Pay a Deposit Now", sub: "Deposit Due Now: " + fmt(depositAmt) + " · Balance Due After Service: " + fmt(depositBalanceAmt) + " · required to book" }]
                  : [
                      // FEATURE 6 — explicit "Deposit Due Now" / "Balance Due
                      // After Service" wording so both figures are visible
                      // before the client picks an option, not just the deposit.
                      // WORDING FIX (round 13, item 3) — "Pay Deposit" vs "Pay
                      // in Full" was ambiguous about WHEN each charge happens;
                      // both labels below now say explicitly whether money
                      // moves today or later.
                      { k: "deposit", l: "Pay a Deposit Now", sub: "Deposit Due Now: " + fmt(depositAmt) + " · Balance Due After Service: " + fmt(depositBalanceAmt) },
                      { k: "full", l: "Pay in Full Now", sub: fmt(e.total) + " charged today — nothing due after service" }
                    ]
                ).map(o => (
                  <button key={o.k} onClick={() => setPayType(o.k)} className={"p-4 rounded-xl border-2 text-left transition-all " + (payType === o.k ? "border-brand-500 bg-brand-950/30" : "border-white/10 bg-black/40 hover:border-white/20")}>
                    <div className="font-semibold text-sm">{o.l}</div>
                    <div className="text-[10px] text-white/60 mt-1">{o.sub}</div>
                    {payType === o.k && <CheckCircle size={14} className="text-brand-400 mt-2" />}
                  </button>
                ))}
              </div>

              {/* FIX 14 — promo or referral code */}
              <div>
                <div className="text-xs text-white/60 mb-2">Promo or referral code (optional)</div>
                {appliedPromo ? (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-green-950/20 border border-green-700/30">
                    <div className="text-sm text-green-300">
                      {appliedPromo.kind === "promotion" ? `"${promoCode.toUpperCase()}" applied — ${fmt(promoDiscount)} off` : `Referral code applied — ${fmt(promoDiscount)} off`}
                    </div>
                    <button onClick={() => { setAppliedPromo(null); setPromoCode(""); }} className="text-xs text-white/40 hover:text-danger-400 transition">Remove</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <GInput value={promoCode} onChange={(ev: any) => setPromoCode(ev.target.value)} onKeyDown={(ev: any) => ev.key === "Enter" && applyPromoCode()} placeholder="Enter code" className="!text-sm flex-1" />
                    <GBtn variant="ghost" onClick={applyPromoCode} disabled={!promoCode.trim()} className="!px-4">Apply</GBtn>
                  </div>
                )}
                {promoError && <div className="text-xs text-danger-400 mt-1.5">{promoError}</div>}
              </div>

              {/* Tip — FIX (round 13, item 5): only offered once the job is
                  actually done (this estimate has become an invoice) or the
                  customer is settling a remaining balance after service —
                  never on a pre-service quote/estimate, where there's
                  nothing yet to tip for. */}
              {(e?.invoiced || hasRemainingBalance) && <div>
                <div className="text-xs text-white/60 mb-2">Add a tip? (optional)</div>
                <div className="flex gap-2">
                  {[0, 0.10, 0.15, 0.20].map(pct => (
                    <button key={pct} onClick={() => { setTip(pct > 0 ? Math.round(payAmt * pct * 100) / 100 : 0); setCustomTip(""); }} className={"flex-1 py-2 rounded-xl text-xs border transition " + (tip === Math.round(payAmt * pct * 100) / 100 && (pct > 0 || customTip === "") ? "bg-green-900/40 border-green-500/50 text-green-200" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>
                      {pct === 0 ? "No tip" : (pct * 100).toFixed(0) + "% (" + fmt(Math.round(payAmt * pct * 100) / 100) + ")"}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <GInput type="number" step="1" min="0" placeholder="Custom tip amount" value={customTip} onChange={e => { setCustomTip(e.target.value); setTip(Number(e.target.value) || 0); }} className="!text-sm flex-1" />
                </div>
              </div>}

              <Glass className="p-4 !bg-black/60">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-white/70">Payment amount</span><span>{fmt(payAmt)}</span></div>
                  {promoDiscount > 0 && <div className="flex justify-between text-green-400"><span>Promo discount</span><span>− {fmt(promoDiscount)}</span></div>}
                  {tip > 0 && <div className="flex justify-between text-green-400"><span>Tip 🙏</span><span>+ {fmt(tip)}</span></div>}
                  <div className="flex justify-between font-bold text-base pt-2 border-t border-brand-900/30"><span>Total charged today</span><span className="text-brand-400">{fmt(totalWithTip)}</span></div>
                </div>
              </Glass>

              {/* Legal disclaimer / T&Cs — gates EVERY way of accepting
                  this estimate below (pay-now buttons AND the pay-later
                  button). BUG FIX — "customers should have to accept
                  terms and conditions for quotes" — this used to only
                  gate the pay-now buttons; the "sign now, pay later"
                  button further down had no such gate at all, so a
                  customer could accept the estimate without ever agreeing
                  to anything. Wording now covers both cases instead of
                  only making sense for an immediate charge. */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToPaymentTerms}
                  onChange={ev => setAgreedToPaymentTerms(ev.target.checked)}
                  className="mt-0.5 flex-shrink-0"
                />
                <span className="text-[13px] text-white/70 leading-relaxed">
                  {(!hasRemainingBalance && !e?.invoiced && !isDepositMandatory)
                    ? <>I accept this quote for {fmt(effectiveTotal)}{payType === "deposit" || payType === "full" ? ` and, if I choose to pay now, authorize ${companyName} to charge my payment method today` : ""}. </>
                    : <>I authorize {companyName} to charge {fmt(totalWithTip)} to my payment method today{payType === "deposit" ? `, with the remaining balance of ${fmt(depositBalanceAmt)} due after service is completed` : ""}. </>}
                  I understand any charge is non-refundable once service has been rendered, and that {companyName} may retain job photos/videos as service records for up to {(settings as any)?.mediaRetentionDays || 30} days. If I provided a phone number, I may receive text updates about this service (message/data rates may apply — reply STOP at any time to opt out, HELP for help; see {companyName}'s{" "}
                  <a href={"#/terms?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="underline text-brand-300">Terms</a> and{" "}
                  <a href={"#/privacy?co=" + encodeURIComponent(companyName)} target="_blank" rel="noopener noreferrer" className="underline text-brand-300">Privacy Policy</a>)
                  {e?.terms ? <> — see full terms below.</> : "."}
                  {e?.terms && <div className="mt-1.5 text-white/40 whitespace-pre-wrap">{e.terms}</div>}
                </span>
              </label>

              {/* FEATURE — "owners can use both Square and Stripe... both
                  should work for all that we want." Both providers are
                  fully independent and both real (no mock/sandbox-only
                  path) — an owner can connect either or both. When both are
                  connected, the customer picks which one to pay with; when
                  only one is connected, that one shows as the single Pay
                  button, same as before. Both share the exact same
                  lock-in-selection + invoiceId/tipCents server-side amount
                  verification (see lockAndOpenPayment below) regardless of
                  which processor is chosen. */}
              {(() => {
                // FEATURE — "if I have Stripe and Square connected, I can
                // select which one to use." BUG FIX — "Show Both" was
                // removed from Settings (a customer choosing between two
                // checkout buttons was the actual complaint) — exactly one
                // processor is always shown now. A raw "both" preference
                // saved from before this fix, or no preference at all,
                // resolves to Stripe when it's connected, else Square —
                // never both buttons at once.
                const provider = resolvePaymentProvider({
                  preference: (settings as any)?.paymentProviderPreference,
                  stripeConnected: !!settings?.stripePublishableKey,
                  squareConnected: !!squareConfig?.connected,
                });
                const stripeConfigured = provider === "stripe";
                const squareConfigured = provider === "square";
                const lockAndOpenPayment = async (provider: "stripe" | "square") => {
                  if (String(e.id).startsWith("demo-")) { window.alert("This is a preview — no real payment is processed here."); return; }
                  // BUG FIX — "payment security in general, not just
                  // packages." Every charge is now verified server-side
                  // against the estimate's own stored total — for
                  // Package/Options that only matches reality once this
                  // selection is locked in server-side first (recomputed
                  // from the estimate's OWN real line items, never a
                  // client-claimed price).
                  if (e.estimateType === "package" || e.estimateType === "options") {
                    setLockingInSelection(true);
                    try {
                      const res = await fetch("/api/public-data", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "lock_in_estimate_selection", id: e.id, selectedPackageId: selectedPkgId, enabledItemIds: effectiveLineItems.map((li: any) => li.id) }),
                      });
                      const data = await res.json().catch(() => null);
                      if (!res.ok || data?.error) throw new Error(data?.error || "Couldn't verify your selection");
                    } catch (err: any) {
                      setLockingInSelection(false);
                      window.alert("Couldn't confirm your selection before payment — " + (err?.message || "please try again") + ".");
                      return;
                    }
                    setLockingInSelection(false);
                  }
                  if (provider === "square") setShowSquareModal(true); else setShowStripeModal(true);
                };
                if (!stripeConfigured && !squareConfigured) {
                  return (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center space-y-2">
                      <CreditCard size={20} className="mx-auto text-white/30" />
                      <div className="text-sm text-white/60">Online payments aren't set up yet.</div>
                      <div className="text-xs text-white/40">{companyName} hasn't connected a payment processor — contact us directly to arrange payment.</div>
                    </div>
                  );
                }
                const payBtn = (provider: "stripe" | "square") => (
                  <button
                    key={provider}
                    onClick={() => lockAndOpenPayment(provider)}
                    disabled={!agreedToPaymentTerms || lockingInSelection}
                    className={"w-full py-4 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed " + (provider === "square" ? "bg-gradient-to-r from-[#006AFF] to-[#0052CC] hover:from-[#1a7bff] hover:to-[#0060e6]" : "bg-gradient-to-r from-[#635BFF] to-[#4F46E5] hover:from-[#7C74FF] hover:to-[#6056F5]")}
                  >
                    <CreditCard size={18} />
                    {lockingInSelection ? "Verifying…" : `Pay ${fmt(totalWithTip)} · Powered by ${provider === "square" ? "Square" : "Stripe"}`}
                  </button>
                );
                return (
                  <div className="space-y-2">
                    {stripeConfigured && payBtn("stripe")}
                    {squareConfigured && payBtn("square")}
                    {!agreedToPaymentTerms && <div className="text-center text-[10px] text-yellow-400/80">Check the box above to enable payment</div>}
                    <div className="text-center text-[10px] text-white/30">🔒 Your payment is secured by {stripeConfigured && squareConfigured ? "Stripe/Square" : squareConfigured ? "Square" : "Stripe"} · 256-bit SSL</div>
                  </div>
                );
              })()}
              {/* WORDING FIX (round 13, item 3) — relabeled to match the
                  "Pay a Deposit Now" / "Pay in Full Now" pair above: this is
                  the true third option, zero dollars today, full amount
                  once the job is actually done. BUG FIX (item 6) — this
                  already called handleApprove(undefined, "later"), which
                  signs the estimate and does persist the choice (payChoice:
                  "later") via onApprove; the button wasn't actually dead —
                  but disabled={busy} guards against a double-tap leaving it
                  looking unresponsive on a slow connection, which wasn't
                  handled before. */}
              {!hasRemainingBalance && !alreadySigned && !isDepositMandatory && (
                <>
                  <button onClick={() => { if (!payLaterBusy) { setPayLaterBusy(true); Promise.resolve(handleApprove(undefined, "later")).finally(() => setPayLaterBusy(false)); } }} disabled={payLaterBusy || !agreedToPaymentTerms} className="w-full py-3 rounded-xl border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                    {payLaterBusy ? "Signing…" : "Pay in Full After Service — just sign for now"}
                  </button>
                  {!agreedToPaymentTerms && <div className="text-center text-[10px] text-yellow-400/80">Check the box above to accept</div>}
                </>
              )}
              <GBtn variant="ghost" onClick={() => setStep(alreadySigned ? "view" : "sign")} className="w-full">{alreadySigned ? "← Back" : "← Back to signature"}</GBtn>

              {/* BUG FIX (round following "payment security in general, not
                  just packages") — this used to pass NO invoiceId at all,
                  so the server trusted totalWithTip directly for every
                  estimate type, not just Package/Options — the one payment
                  path in this whole app that still fully trusted a client-
                  computed amount. Now always passes invoiceId (the server
                  verifies the base charge against the estimate's own
                  stored total — locked in fresh for Package/Options right
                  before this modal opens, see the Pay button's onClick
                  above) and sends the tip as a separate, additive amount
                  so it can't be used to strip the base price down. */}
              <StripePaymentModal
                open={showStripeModal}
                onClose={() => setShowStripeModal(false)}
                publishableKey={settings?.stripePublishableKey || ""}
                stripeAccountId={(settings as any)?.stripeAccountId}
                amount={totalWithTip}
                invoiceId={e?.id}
                tipCents={Math.round((Number(tip) || 0) * 100)}
                payment={{ payType, promoId: appliedPromo?.kind === "promotion" ? appliedPromo.promo?.id : undefined, referrerId: appliedPromo?.kind === "referral" ? appliedPromo.referrer?.id : undefined }}
                description={`${companyName} — ${e?.lineItems?.[0]?.description || "Quote"} #${e?.id || ""}`}
                onSuccess={(paymentIntentId) => { setShowStripeModal(false); handleApprove(paymentIntentId, "now", "stripe"); }}
              />
              <SquarePaymentModal
                open={showSquareModal}
                onClose={() => setShowSquareModal(false)}
                applicationId={squareConfig?.applicationId || ""}
                locationId={squareConfig?.locationId || ""}
                amount={totalWithTip}
                invoiceId={e?.id}
                tipCents={Math.round((Number(tip) || 0) * 100)}
                payment={{ payType, promoId: appliedPromo?.kind === "promotion" ? appliedPromo.promo?.id : undefined, referrerId: appliedPromo?.kind === "referral" ? appliedPromo.referrer?.id : undefined }}
                description={`${companyName} — ${e?.lineItems?.[0]?.description || "Quote"} #${e?.id || ""}`}
                onSuccess={(paymentId) => { setShowSquareModal(false); handleApprove(paymentId, "now", "square"); }}
              />
            </div>
          )}

          {/* STEP 4: Done */}
          {step === "done" && (
            <div className="text-center py-6 space-y-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center mx-auto">
                <CheckCircle size={40} className="text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">You're all set, {c.firstName}!</div>
                <div className="text-white/60 text-sm mt-2">{alreadySigned ? "Your payment went through. Thank you!" : "Your quote has been approved and signed."}</div>
                {confirmWarn && <div className="text-yellow-300 text-xs mt-2">{confirmWarn}</div>}
              </div>
              <Glass className="p-4 !bg-green-950/20 !border-green-700/30 text-left">
                <div className="text-xs text-white/60 mb-1">What happens next?</div>
                <div className="text-sm space-y-1.5">
                  <div>{paidAmountNow > 0 ? <>✅ Payment of {fmt(paidAmountNow)} processed</> : <>✅ Signed — payment due after service</>}</div>
                  <div>📱 You'll receive a confirmation text shortly</div>
                  <div>📅 We'll contact you to confirm your service date</div>
                  <div>⭐ After service, we'll ask for a quick review</div>
                </div>
              </Glass>
              {/* Download signed PDF */}
              <button onClick={() => {
                const companyName = settings?.companyName || "CRM Starter";
                const html = `<!DOCTYPE html><html><head><title>Signed Quote</title><style>
                  body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:auto;color:#111}
                  h1{color:#111111;margin-bottom:4px}
                  .header{display:flex;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #111111}
                  .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}
                  .total{font-size:16px;font-weight:bold;color:#111111}
                  .sig-box{margin-top:24px;padding:16px;border:1px solid #ccc;border-radius:8px;background:#f9f9f9}
                  .badge{display:inline-block;background:#dcfce7;color:#166534;padding:4px 10px;border-radius:999px;font-size:11px;font-weight:bold}
                  table{width:100%;border-collapse:collapse;margin:16px 0}
                  th{background:#f5f5f5;text-align:left;padding:8px;font-size:11px;text-transform:uppercase}
                  td{padding:8px;border-bottom:1px solid #eee;font-size:13px}
                </style></head><body>
                <div class="header">
                  <div><h1>${companyName}</h1><div style="font-size:12px;color:#666">your area · ${settings?.companyPhone || "(555) 555-0100"}</div></div>
                  <div style="text-align:right"><div style="font-weight:bold">SIGNED ESTIMATE</div><div style="font-size:12px;color:#666">#${e.id.slice(-8).toUpperCase()}</div><div style="font-size:12px;color:#666">${new Date().toLocaleDateString()}</div></div>
                </div>
                <div style="margin-bottom:16px"><strong>Customer:</strong> ${c.firstName} ${c.lastName}<br><span style="font-size:12px;color:#666">${c.address || ""} · ${c.email || ""} · ${c.phone || ""}</span></div>
                <table><thead><tr><th>Service</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>
                ${(e.lineItems || []).map(li => `<tr><td>${li.description}</td><td>${li.quantity}</td><td>$${Number(li.unitPrice).toFixed(2)}</td><td>$${(li.quantity * li.unitPrice).toFixed(2)}</td></tr>`).join("")}
                </tbody></table>
                ${e.discount > 0 ? `<div class="row"><span>Discount</span><span>-$${Number(e.discount).toFixed(2)}</span></div>` : ""}
                <div class="row"><span>Tax (${settings?.taxRate || 0}%)</span><span>$${Number(e.tax || 0).toFixed(2)}</span></div>
                <div class="row total"><span>TOTAL</span><span>$${Number(e.total).toFixed(2)}</span></div>
                ${totalWithTip > e.total ? `<div class="row" style="color:green"><span>Tip</span><span>+$${tip.toFixed(2)}</span></div><div class="row total"><span>AMOUNT PAID</span><span>$${totalWithTip.toFixed(2)}</span></div>` : ""}
                ${e.terms ? `<div style="margin-top:16px;padding:12px;background:#f9f9f9;border-radius:6px;font-size:11px;color:#555"><strong>Terms & Conditions:</strong><br>${e.terms}</div>` : ""}
                <div class="sig-box">
                  <div style="font-size:12px;color:#666;margin-bottom:8px">Electronic Signature</div>
                  ${sigData ? `<img src="${sigData}" style="max-height:80px;border-bottom:1px solid #ccc;display:block" />` : "<div style='height:60px;border-bottom:1px solid #ccc'></div>"}
                  <div style="margin-top:8px;font-size:11px;color:#666">Signed by: ${c.firstName} ${c.lastName} · ${new Date().toLocaleString()} · <span class="badge">✓ SIGNED</span></div>
                </div>
                <div style="margin-top:24px;font-size:10px;color:#999;text-align:center">This is a legally binding electronic document. ${companyName} · your area</div>
                <script>window.onload=()=>setTimeout(window.print,300)</script>
                </body></html>`;
                const w = window.open("", "_blank");
                if (w) { w.document.write(html); w.document.close(); }
              }} className="w-full flex items-center justify-center gap-2 py-3 bg-green-900/30 border border-green-700/40 text-green-300 rounded-xl hover:bg-green-900/50 transition text-sm font-medium">
                <Download size={16} /> Download Signed Quote PDF
              </button>
              {/* Receipt PDF */}
              <button onClick={() => {
                const companyName = settings?.companyName || "CRM Starter";
                const receiptHtml = `<!DOCTYPE html><html><head><title>Receipt</title><style>body{font-family:Arial;padding:40px;max-width:500px;margin:auto;color:#111}.logo{font-size:22px;font-weight:bold;color:#111111}.receipt-box{border:2px solid #111111;border-radius:8px;padding:24px;margin:20px 0}.line{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}.total{font-size:18px;font-weight:bold;color:#111111;margin-top:8px}.stamp{background:#dcfce7;border:2px solid #16a34a;color:#14532d;padding:10px;text-align:center;border-radius:8px;font-weight:bold;margin-top:16px;font-size:15px}@media print{body{padding:20px}}</style></head><body>
                <div class="logo">${companyName}</div><div style="font-size:11px;color:#666">your area · (555) 555-0100</div>
                <div class="receipt-box">
                  <div style="text-align:center;margin-bottom:16px"><div style="font-size:14px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#666">Payment Receipt</div><div style="font-size:11px;color:#999">${new Date().toLocaleString()}</div></div>
                  <div class="line"><span>Customer</span><span>${c.firstName} ${c.lastName}</span></div>
                  ${e.lineItems.map(li => `<div class="line"><span>${li.description}</span><span>$${(li.quantity * li.unitPrice).toFixed(2)}</span></div>`).join("")}
                  ${e.discount > 0 ? `<div class="line"><span>Discount</span><span>-$${Number(e.discount).toFixed(2)}</span></div>` : ""}
                  <div class="line"><span>Tax</span><span>$${Number(e.tax || 0).toFixed(2)}</span></div>
                  <div class="line total"><span>AMOUNT PAID</span><span>$${totalWithTip.toFixed(2)}</span></div>
                  ${tip > 0 ? `<div class="line"><span style="font-size:11px;color:#999">Includes tip</span><span style="font-size:11px;color:#999">$${tip.toFixed(2)}</span></div>` : ""}
                  <div class="stamp">✓ PAYMENT RECEIVED</div>
                  <div style="margin-top:12px;font-size:10px;color:#888;text-align:center">Thank you for your business! · ${companyName}</div>
                </div>
                <script>window.onload=()=>setTimeout(window.print,300)<\/script></body></html>`;
                const w = window.open("", "_blank");
                if (w) { w.document.write(receiptHtml); w.document.close(); }
              }} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-900/30 border border-blue-700/40 text-blue-300 rounded-xl hover:bg-blue-900/50 transition text-sm font-medium">
                <Receipt size={16} /> Download Receipt PDF
              </button>
              <GBtn onClick={onClose} className="w-full">Close</GBtn>
            </div>
          )}
        </div>
        </>
        )}
        </div>
      </div>
    </Modal>
  );
}
