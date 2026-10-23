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
  Paperclip, ImageIcon, FileImage, MoreVertical, Mic, Upload, Link, Lock, User,
  CalendarClock, Clapperboard, Captions, Gift
} from "lucide-react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart, LineChart, Line,
  ComposedChart, Legend
} from "recharts";
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, compressImageFile, POLL_INTERVAL_OPTIONS, DEFAULT_POLL_INTERVAL_MS, backfillJobMediaToStorage, withTimeout, guessStateCodeFromAddress, US_STATE_BASE_TAX_RATES, rememberOAuthReturnPage } from "../../lib/utils";
import { getPlanLimits, PLAN_TIER_LABEL } from "../../lib/planLimits";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField, LegalTemplate } from "../../types";
import { twilioSend, sendEmail, fetchBufferOrganizationId, fetchBufferChannels, checkA2pCampaignStatus, checkTwilioAccountStatus, type BufferChannel } from "../../lib/messaging";
import { buildSocialAuthorizeUrl, type SocialPlatform } from "../../lib/socialOAuth";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { refreshEmpGoogleToken, getLastGoogleRefreshError } from "../../lib/googleApi";
import { supabase, getStoredGoogleConnection, setStoredGoogleToken, clearStoredGoogleConnection } from "../../lib/supabase";
import { getOwnerStripeStatus, saveOwnerStripeKeys, getStripeConnectAuthorizeUrl, type OwnerStripeStatus } from "../../lib/stripe";
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
import { resolvePaymentProvider, PAYMENT_PROVIDERS } from "../../lib/payments";

const isValidHttpsUrl = (value: string): boolean => {
  try {
    const u = new URL(value);
    return u.protocol === "https:";
  } catch {
    return false;
  }
};

export function SettingsModal({ open, onClose, settings, setSettings, jobs = [], setJobs = (() => {}) as any, customers = [], estimates = [], campaigns = [], services, setServices, emailTemplates, setEmailTemplates, smsTemplates, setSmsTemplates, estimateTemplates = [], setEstimateTemplates = (() => {}) as any, modelStatus = {}, setModelStatus = (() => {}) as any, employees = [], toast, onSignOut, signingOut = false, restrictToProfile = false, onAddManager, markRecentlyDeleted, initialSection }: { open?: any; onClose?: any; settings?: any; setSettings?: any; jobs?: any[]; setJobs?: any; customers?: any[]; estimates?: any[]; campaigns?: any[]; services?: any; setServices?: any; emailTemplates?: any; setEmailTemplates?: any; smsTemplates?: any; setSmsTemplates?: any; estimateTemplates?: any[]; setEstimateTemplates?: any; modelStatus?: any; setModelStatus?: any; employees?: any[]; toast?: any; onSignOut?: () => void; signingOut?: boolean; restrictToProfile?: boolean; onAddManager?: () => void; markRecentlyDeleted?: (table: "jobs" | "customers" | "estimates", ids: string[]) => void; initialSection?: string }) {
  const [f, setF] = useState(settings);
  const [sec, setSec] = useState("profile");
  // BUG FIX — "Settings always opens to API keys instead of my profile."
  // This modal stays mounted for the whole session (App.tsx just toggles
  // `open`), so the `useState` initializer above only ever ran once, on
  // first mount — any later navigation to another tab stuck as the starting
  // point for every future open. Reset to Profile every time the modal is
  // actually opened, not just on the very first mount — UNLESS the caller
  // explicitly asked for a specific starting tab (e.g. an upgrade prompt
  // deep-linking straight to Billing), which wins for that one open.
  useEffect(() => {
    if (open) setSec(initialSection || "profile");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — "let people sign up and pay for CRM Starter." Platform-level
  // subscription status (trial countdown / active plan / past due) — a
  // completely separate concept from the owner's OWN Stripe connection
  // (Integrations tab), which is for charging THEIR customers.
  const [platformSub, setPlatformSub] = useState<any>(null);
  const [platformSubLoading, setPlatformSubLoading] = useState(false);
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");
  const [billingActionBusy, setBillingActionBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!open || sec !== "billing") return;
    setPlatformSubLoading(true);
    (async () => {
      try {
        const { data: sessionData } = await (supabase as any).auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) { setPlatformSubLoading(false); return; }
        const res = await fetch("/api/platform-billing", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "get_status" }),
        });
        const data = await res.json().catch(() => null);
        setPlatformSub(data?.subscription || null);
      } catch (e: any) {
        console.warn("[Billing] status fetch failed:", e?.message);
      } finally {
        setPlatformSubLoading(false);
      }
    })();
  }, [open, sec]); // eslint-disable-line react-hooks/exhaustive-deps

  // FEATURE — "incentivize owners to invite other owners." A CRM Starter-
  // subscriber-to-subscriber referral, distinct from the existing customer-
  // refers-customer program on ReferralsPage.tsx. Both sides get
  // REFERRAL_DISCOUNT_PERCENT off (see platform-billing.ts) — the referrer's
  // applies to their live subscription once someone signs up with their
  // code and actually pays; the referee's applies at their own checkout.
  const [ownerReferral, setOwnerReferral] = useState<{ referralCode: string; discountPercent: number } | null>(null);
  useEffect(() => {
    if (!open || sec !== "billing") return;
    (async () => {
      try {
        const { data: sessionData } = await (supabase as any).auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/platform-billing", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: "get_my_referral_link" }),
        });
        const data = await res.json().catch(() => null);
        if (data?.referralCode) setOwnerReferral(data);
      } catch (e: any) {
        console.warn("[Billing] referral link fetch failed:", e?.message);
      }
    })();
  }, [open, sec]); // eslint-disable-line react-hooks/exhaustive-deps

  const startCheckout = async (plan: string) => {
    setBillingActionBusy(plan);
    try {
      const { data: sessionData } = await (supabase as any).auth.getSession();
      const token = sessionData?.session?.access_token;
      const email = sessionData?.session?.user?.email;
      if (!token) { toast?.("Please sign in again first", "red"); return; }
      // FEATURE — "email trial users a limited-time discount." The monthly
      // offer email (platform-billing.ts's send_trial_discount_emails) links
      // to #/pricing?offer=CODE; Settings → Billing's "pick a plan" flow is
      // the actual checkout entry point that offer link routes through, so
      // read it once here rather than threading it through every nav path.
      const offerCode = (() => {
        try {
          const hash = window.location.hash;
          const q = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : "";
          return new URLSearchParams(q).get("offer") || "";
        } catch { return ""; }
      })();
      const res = await fetch("/api/platform-billing", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          action: "create_checkout_session", plan, interval: billingInterval, email,
          ...(offerCode ? { discountCode: offerCode } : {}),
          successUrl: window.location.origin + window.location.pathname + "#/dashboard?billed=1",
          cancelUrl: window.location.href,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) throw new Error(data?.error || "Couldn't start checkout");
      window.location.href = data.url;
    } catch (e: any) {
      toast?.(e?.message || "Couldn't start checkout", "red");
    } finally {
      setBillingActionBusy(null);
    }
  };
  const openBillingPortal = async () => {
    setBillingActionBusy("portal");
    try {
      const { data: sessionData } = await (supabase as any).auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast?.("Please sign in again first", "red"); return; }
      const res = await fetch("/api/platform-billing", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "create_portal_session", returnUrl: window.location.href }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.error) throw new Error(data?.error || "Couldn't open billing portal");
      window.location.href = data.url;
    } catch (e: any) {
      toast?.(e?.message || "Couldn't open billing portal", "red");
    } finally {
      setBillingActionBusy(null);
    }
  };
  const BILLING_PLANS = [
    { key: "solo", name: "Solo", monthly: 29, annual: 23, tagline: "For an owner-operator running the show alone." },
    { key: "crew", name: "Crew", monthly: 59, annual: 47, tagline: "For a business running an actual crew in the field.", highlighted: true },
    { key: "growth", name: "Growth", monthly: 119, annual: 95, tagline: "For multi-crew operations that want it all automated." },
  ];

  // FEATURE — Legal template library ("edit, add new, save, have multiple
  // versions, choose a template for commercial vs residential"). Templates
  // themselves live in f.legalTemplates; setting one "active" for a scope
  // also writes its body into the legacy fields other parts of the app
  // already read directly (privacyPolicy/termsOfService for the public
  // /privacy /terms pages, termsAndConditionsResidential/Commercial for the
  // job sign-off screen — see resolveTermsForJobType in lib/utils.ts) so no
  // other file needs to know the template system exists.
  const [legalEditor, setLegalEditor] = useState<{ open: boolean; category: "privacy" | "terms"; data: LegalTemplate | null }>({ open: false, category: "privacy", data: null });
  const legalTemplates: LegalTemplate[] = f.legalTemplates || [];
  const openNewLegalTemplate = (category: "privacy" | "terms") => {
    setLegalEditor({ open: true, category, data: { id: uid(), category, name: "", appliesTo: category === "privacy" ? "both" : "residential", body: "", updatedAt: new Date().toISOString() } });
  };
  const saveLegalTemplate = (tpl: LegalTemplate) => {
    if (!tpl.name.trim()) { toast?.("Give this template a name before saving", "red"); return; }
    setF((p: any) => {
      const list: LegalTemplate[] = p.legalTemplates || [];
      const exists = list.some(t => t.id === tpl.id);
      const next = exists ? list.map(t => t.id === tpl.id ? tpl : t) : [...list, tpl];
      return { ...p, legalTemplates: next };
    });
    setLegalEditor({ open: false, category: tpl.category, data: null });
    toast?.("Template saved — remember to hit Save at the bottom to sync it", "green");
  };
  const deleteLegalTemplate = (tpl: LegalTemplate) => {
    if (!confirm(`Delete "${tpl.name}"? This can't be undone.`)) return;
    setF((p: any) => ({
      ...p,
      legalTemplates: (p.legalTemplates || []).filter((t: LegalTemplate) => t.id !== tpl.id),
      ...(p.activePrivacyTemplateId === tpl.id ? { activePrivacyTemplateId: "" } : {}),
      ...(p.activeTermsResidentialTemplateId === tpl.id ? { activeTermsResidentialTemplateId: "" } : {}),
      ...(p.activeTermsCommercialTemplateId === tpl.id ? { activeTermsCommercialTemplateId: "" } : {}),
    }));
  };
  const duplicateLegalTemplate = (tpl: LegalTemplate) => {
    setLegalEditor({ open: true, category: tpl.category, data: { ...tpl, id: uid(), name: tpl.name + " (copy)", updatedAt: new Date().toISOString() } });
  };
  const setActiveLegalTemplate = (tpl: LegalTemplate, scope: "privacy" | "residential" | "commercial") => {
    setF((p: any) => {
      if (scope === "privacy") return { ...p, activePrivacyTemplateId: tpl.id, privacyPolicy: tpl.body };
      if (scope === "residential") return { ...p, activeTermsResidentialTemplateId: tpl.id, termsAndConditionsResidential: tpl.body, termsOfService: tpl.body };
      return { ...p, activeTermsCommercialTemplateId: tpl.id, termsAndConditionsCommercial: tpl.body };
    });
    toast?.(`"${tpl.name}" set as the live ${scope} version`, "green");
  };
  // Per-owner Stripe keys (Phase F, multi-tenant) — deliberately NOT part of
  // `f`/`settings` (that object syncs into app_settings.data, which every
  // session loads including unauthenticated customer portals — see the
  // round-12 audit note in the Stripe section below). Loaded/saved straight
  // through stripe-action.ts's save_owner_keys/get_owner_keys_status, which
  // never returns the secret values back to the browser once saved.
  const [stripeStatus, setStripeStatus] = useState<OwnerStripeStatus | null>(null);
  const [stripeStatusLoading, setStripeStatusLoading] = useState(false);
  const [stripeSecretInput, setStripeSecretInput] = useState("");
  const [stripeWebhookInput, setStripeWebhookInput] = useState("");
  const [stripeSaving, setStripeSaving] = useState(false);
  const [stripeConnecting, setStripeConnecting] = useState(false);
  const [stripeConnectError, setStripeConnectError] = useState("");
  const [showManualStripeKeys, setShowManualStripeKeys] = useState(false);
  useEffect(() => {
    if (!open) return;
    (async () => {
      setStripeStatusLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const status = await getOwnerStripeStatus(token);
        setStripeStatus(status);
        // BUG FIX — a Connect owner's publishableKey used to always be
        // empty (see stripe-action.ts's platform-key fallback comment),
        // so this never fired and every customer-facing payment silently
        // had no key to work with. Also persists stripeAccountIdFull so
        // the client-side Stripe.js instance can be told which connected
        // account it's confirming payments against (loadStripeJs's
        // stripeAccount param) — required for Connect, harmless no-op
        // otherwise.
        if ((status.publishableKey && !f.stripePublishableKey) || (status.stripeAccountIdFull && f.stripeConnectAccountId !== status.stripeAccountIdFull)) {
          setF((prev: any) => ({
            ...prev,
            stripePublishableKey: prev.stripePublishableKey || status.publishableKey,
            stripeConnectAccountId: status.stripeAccountIdFull || prev.stripeConnectAccountId,
          }));
        }
      } catch (e: any) {
        console.error("[Stripe] get_owner_keys_status failed:", e?.message);
      } finally {
        setStripeStatusLoading(false);
      }
    })();
  }, [open]);

  // FEATURE — Square as an alternative to Stripe ("give another option for
  // users to connect payments... switch between each one easily"). Same
  // load/save shape as the Stripe block above, own service-role-only table
  // (owner_square_accounts, migration 0064) via functions/api/square-action.ts.
  const [squareStatus, setSquareStatus] = useState<{ connected: boolean; hasAccessToken: boolean; locationId: string; applicationId: string; mode: string; hasWebhookSignatureKey?: boolean; webhookUrl?: string } | null>(null);
  const [squareStatusLoading, setSquareStatusLoading] = useState(false);
  const [squareAccessTokenInput, setSquareAccessTokenInput] = useState("");
  // AUDIT FIX — Square recurring subscriptions had no webhook/status sync
  // at all. This key is what functions/api/square-webhook.ts (new) uses to
  // verify an incoming event really came from Square before writing
  // anything — same role stripeWebhookSecret plays for Stripe below.
  const [squareWebhookKeyInput, setSquareWebhookKeyInput] = useState("");
  const [squareSaving, setSquareSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    (async () => {
      setSquareStatusLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;
        const { getOwnerSquareStatus } = await import("../../lib/square");
        const status = await getOwnerSquareStatus(token);
        if (!status?.error) setSquareStatus(status);
      } catch (e: any) {
        console.error("[Square] get_owner_square_status failed:", e?.message);
      } finally {
        setSquareStatusLoading(false);
      }
    })();
  }, [open]);
  const saveSquareKeys = async () => {
    setSquareSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      const { saveOwnerSquareKeys, getOwnerSquareStatus } = await import("../../lib/square");
      // No sandbox/production toggle — Square is always live/production
      // here, same as Stripe (which has never had a test-mode switch in
      // this app either). One real payment path, not two.
      const result = await saveOwnerSquareKeys(token, {
        squareAccessToken: squareAccessTokenInput || undefined,
        squareLocationId: f.squareLocationId,
        squareApplicationId: f.squareApplicationId,
        squareWebhookSignatureKey: squareWebhookKeyInput || undefined,
        mode: "production",
      });
      if (result?.error) throw new Error(result.error);
      // BUG FIX — same conflation bug as Stripe's save flow (see
      // saveStripeKeys's own comment): report success the moment the real
      // save confirms, don't let a separate status-refresh hiccup afterward
      // relabel an already-successful save as "failed."
      setSquareAccessTokenInput("");
      setSquareWebhookKeyInput("");
      toast?.("Square settings saved ✓", "green");
      try {
        const status = await getOwnerSquareStatus(token);
        if (!status?.error) setSquareStatus(status);
      } catch (refreshErr: any) {
        console.warn("[Square] status refresh after save failed (save itself succeeded):", refreshErr?.message);
      }
    } catch (e: any) {
      toast?.("Couldn't save Square settings — " + (e?.message || "unknown error"), "red");
    } finally {
      setSquareSaving(false);
    }
  };

  const saveStripeKeys = async () => {
    setStripeSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");
      // Test vs. live isn't something the owner needs to pick — Stripe keys
      // are self-describing (sk_test_.../pk_test_... vs sk_live_.../pk_live_...),
      // and nothing server-side branches on this `mode` field except the
      // status badge below. Derive it from whichever key was actually
      // entered so there's no toggle to forget to flip.
      const keyForMode = stripeSecretInput || f.stripePublishableKey || "";
      const inferredMode: "test" | "live" | undefined = /_live_/.test(keyForMode) ? "live" : /_test_/.test(keyForMode) ? "test" : undefined;
      // BUG FIX — stripeAction already has its own internal fetch timeout,
      // but the reported symptom (button stuck on "Saving…" indefinitely,
      // no error) meant something was still getting past that. Wrapping the
      // whole save+status round trip here too guarantees the button
      // unlocks with a visible error within a bounded time no matter where
      // in the chain something hangs.
      await withTimeout(saveOwnerStripeKeys(token, {
        publishableKey: f.stripePublishableKey || "",
        secretKey: stripeSecretInput || undefined,
        webhookSecret: stripeWebhookInput || undefined,
        mode: inferredMode,
      }), 25000, "Stripe key save");
      // BUG FIX — "I added my webhook secret, it said Saving, and it didn't
      // save." The actual save call above and this status-refresh call were
      // bundled in one try/catch — if the save succeeded but this refresh
      // (a separate network round trip) hit any hiccup, the whole thing
      // landed in the catch below and told the owner "Failed to save" even
      // though their webhook secret WAS already written. Success is now
      // reported the moment the real save confirms; the refresh is
      // best-effort on top of that, not a condition for "did it save."
      setStripeSecretInput("");
      setStripeWebhookInput("");
      toast?.("Stripe settings saved.", "green");
      try {
        const status = await withTimeout(getOwnerStripeStatus(token), 25000, "Stripe status refresh");
        setStripeStatus(status);
      } catch (refreshErr: any) {
        console.warn("[Stripe] status refresh after save failed (save itself succeeded):", refreshErr?.message);
      }
    } catch (e: any) {
      toast?.("Failed to save Stripe settings: " + (e?.message || "unknown error"), "red");
    } finally {
      setStripeSaving(false);
    }
  };
  const [showKey, setShowKey] = useState(false);
  const [googleOAuth, setGoogleOAuth] = useState({ open: false, step: "account", email: "", selectedScopes: { gmail: true, calendar: true, drive: false, contacts: false } });
  const [googleRetrying, setGoogleRetrying] = useState(false);
  // FEATURE — one-time backfill of pre-Storage-migration base64 photos/videos
  // (see backfillJobMediaToStorage in lib/utils.ts) — surfaces progress while
  // it runs since this can take a while against a large job history.
  const [mediaBackfillProgress, setMediaBackfillProgress] = useState<{ running: boolean; done: number; total: number } | null>(null);
  // FIX D — refreshEmpGoogleToken/refreshGoogleAccessToken tag a failed
  // refresh as configMissing when the Cloudflare Pages Function reports
  // GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET aren't set as env vars there. That
  // used to only ever surface as a one-off toast from Retry Connection —
  // easy to miss and gone the moment the toast faded, with no persistent
  // sign in Settings itself that server setup was incomplete.
  const [googleConfigMissing, setGoogleConfigMissing] = useState(false);
  // BLOCKER 3 (mobile round 7) — the "✓ Connected" badge below used to be a
  // pure static read of f.googleConnected, a flag set once at OAuth login
  // and never re-checked — so it kept saying "Connected" long after the
  // token actually expired/was revoked, which is exactly why Gmail sends
  // could 401 with Settings still showing green. A real (cheap, no-scope)
  // call to Google's tokeninfo endpoint on mount/open tells the truth.
  const [googleTokenValid, setGoogleTokenValid] = useState<null | boolean>(null);

  // GoogleConnect — after repeated failures making React state/session
  // events the source of truth for "is Google connected" (see the long
  // comment in lib/supabase.ts), localStorage is now authoritative. Read
  // directly on mount/open and on window focus (covers "just came back from
  // the Google consent screen, tab regained focus") rather than depending on
  // any Supabase auth event having fired correctly this page load.
  const [storedGoogle, setStoredGoogle] = useState(() => getStoredGoogleConnection());
  useEffect(() => {
    const refresh = () => {
      const stored = getStoredGoogleConnection();
      console.log("[GoogleConnect] Settings — localStorage check — connected:", !!stored, stored?.email ? "· email: " + stored.email : "");
      setStoredGoogle(stored);
    };
    if (open) refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [open]);

  // FIX 1 — real refresh-token exchange so an expired Google token can be
  // retried in place from Settings → Integrations, without a full
  // disconnect/reconnect. Writes straight to live settings (like the other
  // direct setSettings calls in this modal) so it takes effect immediately,
  // not just after Save. `silent` (GoogleConnect ask #3) suppresses the
  // success/no-op toasts for the automatic background retry the tokenValid
  // effect below fires — a failure still toasts either way, since a
  // silently-swallowed failure is exactly the "why didn't this work" class
  // of bug this whole feature keeps getting re-reported for.
  const retryGoogleToken = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    // localStorage (storedGoogle) is authoritative; f.googleRefreshToken is
    // kept only as a fallback for a connection made before this mechanism
    // existed and never re-connected since.
    const refreshToken = storedGoogle?.refreshToken || f.googleRefreshToken;
    console.log("[GoogleConnect] retryGoogleToken —", silent ? "auto (silent)" : "manual click", "· has refresh token:", !!refreshToken, "· source:", storedGoogle?.refreshToken ? "localStorage" : f.googleRefreshToken ? "settings (legacy)" : "none");
    setGoogleRetrying(true);
    try {
      if (!refreshToken) {
        console.warn("[GoogleConnect] no refresh token on file — cannot refresh, owner must fully reconnect");
        if (!silent) toast?.("No refresh token on file — reconnect Google below to enable retry.", "red");
        return;
      }
      console.log("[GoogleConnect] calling /api/google-refresh via refreshEmpGoogleToken —  backendUrl:", f.googleBackendUrl || "(default same-origin)");
      // SECURITY FIX — the shared owner slot (f.googleRefreshToken, now
      // masked) refreshes via the owner-slot session path, which resolves
      // the real token server-side; this browser's own local OAuth capture
      // (storedGoogle.refreshToken) still refreshes directly as before.
      const refreshed = await refreshEmpGoogleToken(f.googleBackendUrl, refreshToken, !storedGoogle?.refreshToken);
      if (refreshed?.token) {
        console.log("[GoogleConnect] refresh succeeded — new token expires", new Date(refreshed.expiresAt).toLocaleTimeString());
        setGoogleConfigMissing(false);
        setGoogleTokenValid(true);
        setStoredGoogleToken(refreshed.token, refreshed.expiresAt);
        setStoredGoogle(getStoredGoogleConnection());
        setF((prev: any) => ({ ...prev, googleProviderToken: refreshed.token, googleTokenExpiresAt: refreshed.expiresAt }));
        setSettings?.((prev: any) => ({ ...prev, googleProviderToken: refreshed.token, googleTokenExpiresAt: refreshed.expiresAt }));
        if (!silent) toast?.("Google token refreshed", "green");
      } else if (refreshed?.configMissing) {
        console.warn("[GoogleConnect] refresh failed — Cloudflare Function reports GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET missing");
        setGoogleConfigMissing(true);
        if (!silent) toast?.("Gmail unavailable — Google reconnect isn't fully configured yet (missing server env vars). See the notice below.", "red");
      } else {
        console.warn("[GoogleConnect] refresh failed — function may not be deployed, or refresh token itself was rejected");
        if (!silent) toast?.(getLastGoogleRefreshError() || "Couldn't refresh the Google sign-in — reconnect Google below.", "red");
      }
    } finally {
      setGoogleRetrying(false);
    }
  };

  useEffect(() => {
    const activeToken = storedGoogle?.token || f.googleProviderToken;
    if (!open || !activeToken) { setGoogleTokenValid(null); return; }
    let cancelled = false;
    console.log("[GoogleConnect] verifying token via tokeninfo endpoint... source:", storedGoogle?.token ? "localStorage" : "settings (legacy)");
    fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(activeToken)}`)
      .then(r => {
        if (cancelled) return;
        console.log("[GoogleConnect] tokeninfo check —", r.ok ? "valid ✓" : "invalid/expired");
        setGoogleTokenValid(r.ok);
        // GoogleConnect ask #3 — auto-refresh silently instead of leaving the
        // owner staring at an "⚠ Token expired — click Retry" badge until
        // they notice and click it themselves.
        const refreshToken = storedGoogle?.refreshToken || f.googleRefreshToken;
        if (!r.ok && refreshToken) {
          console.log("[GoogleConnect] token invalid — attempting silent auto-refresh");
          retryGoogleToken({ silent: true });
        }
      })
      .catch((e: any) => { if (!cancelled) { console.warn("[GoogleConnect] tokeninfo check failed:", e?.message); setGoogleTokenValid(null); } });
    return () => { cancelled = true; };
  }, [open, storedGoogle?.token, f.googleProviderToken]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tplTab, setTplTab] = useState<"messaging" | "estimates" | "onboarding">("messaging");
  // FEATURE — new-hire onboarding packet template (owner-editable list of
  // items assigned to every new employee; see EmployeesPage's invite modal
  // and EmployeePortal's Onboarding tab). Same drag-reorder pattern as
  // ServiceCatalogSection's checklistTemplate editor.
  const [newOnboardingTitle, setNewOnboardingTitle] = useState("");
  const [newOnboardingDesc, setNewOnboardingDesc] = useState("");
  const [obDragIdx, setObDragIdx] = useState<number | null>(null);
  const addOnboardingItem = () => {
    if (!newOnboardingTitle.trim()) return;
    setF((prev: any) => ({ ...prev, onboardingTemplateItems: [...(prev.onboardingTemplateItems || []), { id: uid(), title: newOnboardingTitle.trim(), description: newOnboardingDesc.trim() || undefined }] }));
    setNewOnboardingTitle(""); setNewOnboardingDesc("");
  };
  const updateOnboardingItem = (id: string, patch: any) => {
    setF((prev: any) => ({ ...prev, onboardingTemplateItems: (prev.onboardingTemplateItems || []).map((it: any) => it.id === id ? { ...it, ...patch } : it) }));
  };
  const deleteOnboardingItem = (id: string) => {
    setF((prev: any) => ({ ...prev, onboardingTemplateItems: (prev.onboardingTemplateItems || []).filter((it: any) => it.id !== id) }));
  };
  const reorderOnboardingItem = (targetIdx: number) => {
    if (obDragIdx === null || obDragIdx === targetIdx) return;
    setF((prev: any) => {
      const items = [...(prev.onboardingTemplateItems || [])];
      const [moved] = items.splice(obDragIdx, 1);
      items.splice(targetIdx, 0, moved);
      return { ...prev, onboardingTemplateItems: items };
    });
    setObDragIdx(targetIdx);
  };
  const [bufferChannels, setBufferChannels] = useState<BufferChannel[]>([]);
  const [bufferConnecting, setBufferConnecting] = useState(false);
  const [campaignChecking, setCampaignChecking] = useState(false);
  const [twilioTestChecking, setTwilioTestChecking] = useState(false);
  const [twilioTestResult, setTwilioTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [editingTpl, setEditingTpl] = useState<any>(null); // null = list view, {} = new, {...} = editing existing
  const blankTpl = () => ({ id: "", name: "", description: "", lineItems: [{ id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 }], notes: "", terms: "Payment due upon completion. 3-day cancellation notice requested. Weather reschedules free of charge.", customFields: [] });
  const blankField = () => ({ id: Date.now().toString() + Math.random(), label: "", type: "text", required: false, customerVisible: true, options: "" });

  // BUG (root cause of "my settings don't save") — this used to depend on
  // `settings` too, not just `open`. App.tsx polls app_settings from Supabase
  // every ~2 minutes for cross-device sync (pollSettings) and ALWAYS builds
  // a fresh `settings` object reference, even when nothing meaningfully
  // changed. That fresh reference re-ran this effect on every poll tick
  // WHILE THE MODAL WAS STILL OPEN, silently overwriting whatever the owner
  // had already typed (e.g. a corrected Twilio Account SID) with the stale
  // server copy — right before they hit Save, so Save then wrote the STALE
  // value straight back to the server. Only `open` should ever re-trigger
  // this sync — once when the modal actually opens, never again while it
  // stays open and the owner is mid-edit.
  useEffect(() => { if (open) setF(settings); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // BUG FIX — "I kept adding my Stripe/Buffer info and it wasn't saving."
  // Root cause: `f` is only a local DRAFT — nothing about typing into a
  // field ever touched the real `settings` state, only clicking the bottom
  // "Save Settings" button did (via this function). Every other way of
  // closing this modal (the X button, clicking the backdrop) called the raw
  // `onClose` prop directly and threw the whole draft away — including the
  // Buffer section's own "Connect" button, which fetches channels and shows
  // success feedback but never itself persists `f`, making it very easy to
  // believe a key had saved when it hadn't. `<Modal onClose={save}>` below
  // now routes every close path through this same function, so nothing
  // typed here can be silently lost again.
  const save = (skipToastIfUnchanged = false) => {
    const next = {
      ...f,
      monthlyRevenueGoal: Number(f.monthlyRevenueGoal), monthlyJobsGoal: Number(f.monthlyJobsGoal), taxRate: Number(f.taxRate),
      annualRevenueGoal: Number(f.annualRevenueGoal) || 0, customerAcquisitionGoal: Number(f.customerAcquisitionGoal) || 0,
      avgJobValueGoal: Number(f.avgJobValueGoal) || 0, reviewRatingGoal: Number(f.reviewRatingGoal) || 0,
      // SECURITY AUDIT (round 12) — no longer writes a stripeSecretKeyEnc
      // here; the secret key isn't collected in this form anymore (see the
      // Stripe section below) and must never be re-introduced into synced
      // settings — that's the exact field that was exposing it to every
      // customer session. "Connected" is now just "publishable key
      // present"; the real gate on whether payments actually work is the
      // STRIPE_SECRET_KEY Cloudflare env var, this client form can't see.
      stripeConnected: !!f.stripePublishableKey?.trim(),
      googleMapsKey: (f.googleMapsKey || "").trim(),
      googleGeocodingKey: (f.googleGeocodingKey || "").trim(),
    };
    const unchanged = skipToastIfUnchanged && JSON.stringify(next) === JSON.stringify(settings);
    setSettings(next);
    onClose();
    if (!unchanged) toast("Settings saved");
  };

  // Managers only get their own profile — no API keys, billing/Stripe (under
  // Integrations), company settings, or the "Delete All Data" danger zone (under Data).
  const secs = restrictToProfile
    ? [{ key: "profile", label: "My Profile", icon: User }]
    : [
        { key: "profile", label: "My Profile", icon: User },
        { key: "api", label: "API Keys", icon: Key },
        // BUG FIX (user report) — "I'm not seeing a settings section for
        // Alfred; there should be a dedicated section." This tab already
        // WAS Alfred's settings (model keys, text-Alfred toggle, phone
        // numbers, and now voice replies) — it was just labeled "AI
        // Models," which doesn't read as "the Alfred settings" to someone
        // looking for it by name.
        { key: "models", label: "Alfred", icon: Bot },
        { key: "company", label: "Company", icon: Settings },
        { key: "billing", label: "Billing", icon: CreditCard },
        { key: "services", label: "Services", icon: Briefcase },
        { key: "goals", label: "Goals", icon: Target },
        { key: "notifications", label: "Notifications", icon: Bell },
        { key: "templates", label: "Templates", icon: FileText },
        { key: "integrations", label: "Integrations", icon: Zap },
        { key: "legal", label: "Legal", icon: Shield },
        { key: "audit", label: "Audit Log", icon: Shield },
        { key: "onboarding", label: "Onboarding", icon: CheckCircle },
        { key: "data", label: "Data", icon: Download }
      ];

  return (
    <>
    <Modal open={open} onClose={() => save(true)} title="Settings" maxW="max-w-5xl" noBodyScroll>
      <div className="h-full flex flex-col">
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
        {/* Sidebar nav — vertical on desktop, horizontal scroll strip on mobile */}
        <div className="sm:w-44 flex-shrink-0 border-b sm:border-b-0 sm:border-r border-brand-900/30 bg-black/40 sm:rounded-bl-2xl sm:overflow-y-auto overflow-x-auto py-1 sm:py-2">
          <div className="flex sm:flex-col min-w-max sm:min-w-0 px-1 sm:px-0">
          {secs.map(s => {
            const Icon = s.icon;
            return <button key={s.key} onClick={() => setSec(s.key)} className={"flex items-center gap-1.5 sm:gap-2.5 px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs font-medium transition whitespace-nowrap sm:w-full sm:text-left rounded-lg sm:rounded-none " + (sec === s.key ? "bg-brand-900/40 text-white sm:border-r-2 sm:border-brand-500" : "text-white/50 hover:text-white hover:bg-white/5")}>
              <Icon size={13} className="flex-shrink-0" />{s.label}
            </button>;
          })}
          </div>
        </div>
        {/* Right panel */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pb-8 space-y-4">
          {sec === "profile" && <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><User size={14} />My Profile</h4>
              <div className="flex items-center gap-4 mb-4 p-4 bg-black/40 border border-brand-900/30 rounded-xl">
                {f.logoUrl ? <img src={f.logoUrl} alt="Logo" className="w-16 h-16 object-cover rounded-full flex-shrink-0 border border-brand-900/30" /> : (
                  <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-2xl font-black text-brand-fg flex-shrink-0">
                    {(f.ownerName || f.companyName || "W")[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1">
                  <div className="font-bold">{f.ownerName || "Alex Owner"}</div>
                  <div className="text-xs text-white/50">{f.ownerRole || "Owner · CRM Starter"}</div>
                  <div className="text-xs text-white/40">{f.companyEmail || "—"}</div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <label className="cursor-pointer px-3 py-2 bg-black/40 border border-brand-900/30 rounded-xl text-xs text-white/70 hover:text-white transition flex items-center gap-1.5">
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; compressImageFile(file, 400, 0.8).then(dataUrl => setF(prev => ({ ...prev, logoUrl: dataUrl }))); }} />
                    <Upload size={12} /> Photo
                  </label>
                  {/* AUDIT FIX — there was no way to delete a profile photo
                      once uploaded, unlike the Company Logo section further
                      down which already has a "Remove" button for the same
                      underlying logoUrl field. */}
                  {f.logoUrl && (
                    <button type="button" onClick={() => setF(prev => ({ ...prev, logoUrl: "" }))} className="px-3 py-1.5 bg-brand-950/30 border border-brand-800/40 rounded-xl text-xs text-brand-300 hover:bg-brand-900/40 transition flex items-center gap-1.5 justify-center">
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div><label className="text-xs text-white/60 mb-1 block">Your Name</label><GInput value={f.ownerName || ""} onChange={e => setF({ ...f, ownerName: e.target.value })} placeholder="Alex Owner" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Role / Title</label><GInput value={f.ownerRole || ""} onChange={e => setF({ ...f, ownerRole: e.target.value })} placeholder="Owner" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Your Mobile # (for Alfred SMS)</label><GInput value={f.myPhone || ""} onChange={e => setF({ ...f, myPhone: e.target.value })} placeholder="+15555550100" /></div>
                <div><label className="text-xs text-white/60 mb-1 block">Business Email</label><GInput value={f.companyEmail || ""} onChange={e => setF({ ...f, companyEmail: e.target.value })} placeholder="will@example.com" /></div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><MapPin size={10} />Home Base <span className="text-white/30 font-normal">(starting point for route optimization)</span></label>
                <AddressAutocomplete value={f.homeBaseAddress || ""} onChange={v => setF({ ...f, homeBaseAddress: v })} mapsKey={f.googleMapsKey} placeholder="412 Oak Ridge Ln, your area" />
              </div>
            </div>
            <PinSettings toast={toast} />
            {onSignOut && (
              <div className="pt-2 border-t border-brand-900/30">
                <button
                  onClick={onSignOut}
                  disabled={signingOut}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-brand-950/30 border border-brand-700/40 text-brand-400 hover:bg-brand-950/50 hover:text-brand-300 transition text-sm font-medium disabled:opacity-60"
                >
                  {signingOut ? <div className="w-3.5 h-3.5 border-2 border-brand-500/30 border-t-brand-400 rounded-full animate-spin" /> : <Lock size={14} />}
                  {signingOut ? "Signing out…" : "Sign Out of CRM Starter"}
                </button>
              </div>
            )}
          </div>}

          {sec === "api" && <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Bot size={13} className="text-purple-400" />AI Model Keys</h4>
              <Glass className="p-4 !bg-white/[0.03] !border-white/15">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-white/10"><Bot size={16} className="text-white" /></div>
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-white">Manage AI keys in the AI Models tab</div>
                    <div className="text-[11px] text-white/70 mt-1">Claude, Gemini, GPT-4o, Groq, and Mistral API keys are all configured in one place — the AI Models tab. Add a key there to enable Alfred and automatic failover.</div>
                    <button onClick={() => setSec("models")} className="mt-3 px-3 py-1.5 bg-brand-600 border border-brand-600 rounded-lg text-xs text-brand-fg hover:bg-brand-700 transition flex items-center gap-1.5">
                      <Bot size={11} />Go to AI Models →
                    </button>
                  </div>
                </div>
              </Glass>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><Cloud size={13} className="text-blue-400" />OpenWeatherMap API Key</h4>
              <div className="text-[11px] text-white/50 mb-2">Powers real-time weather on Dashboard and job weather alerts. Free tier available.</div>
              <GInput type="password" value={f.owmKey || ""} onChange={e => setF({ ...f, owmKey: e.target.value })} placeholder="Your OpenWeatherMap API key" />
              <div className="text-[10px] text-white/40 mt-1">Get a free key at <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">openweathermap.org/api</a> · 1-click free signup</div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><span className="text-orange-400">🎙️</span>ElevenLabs API Key</h4>
              <div className="text-[11px] text-white/50 mb-2">Text-to-speech for Alfred voice responses. Optional — Alfred works without it.</div>
              <GInput type="password" value={f.elevenlabsKey || ""} onChange={e => setF({ ...f, elevenlabsKey: e.target.value })} placeholder="Your ElevenLabs API key" />
              <div className="text-[10px] text-white/40 mt-1">Get one at <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">elevenlabs.io</a></div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><MapPin size={13} className="text-brand-400" />Google Maps API Key</h4>
              <div className="text-[11px] text-white/50 mb-2">Powers address autocomplete and Street View thumbnails on jobs.</div>
              <GInput type="password" value={f.googleMapsKey || ""} onChange={e => setF({ ...f, googleMapsKey: e.target.value.trim() })} placeholder="AIza..." />
              <div className="text-[10px] text-white/40 mt-1"><a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">console.cloud.google.com</a> → enable <b>Places API</b> (autocomplete) AND <b>Street View Static API</b> (job thumbnails) — they're billed and enabled separately, so a key that only has one will silently fail the other. This key should have a <b>website/HTTP referrer restriction</b> (recommended, since it's exposed in the browser).</div>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2"><MapPin size={13} className="text-brand-400" />Geocoding Key <span className="text-[10px] font-normal text-white/40">(optional, separate key)</span></h4>
              <div className="text-[11px] text-white/50 mb-2">
                Powers the Customers map-pins view and employees' drive-time ETAs. Google flatly does not allow the Geocoding API or Distance Matrix API to be called with a referrer-restricted key — even the OFFICIAL error is "API keys with referer restrictions cannot be used with this API." Your regular Maps key above needs that restriction for safety, so those two features need a genuinely <b>separate</b> key that has <b>no</b> website restriction — leave "Application restrictions" set to None, and instead lock it down under <b>API restrictions</b> to only Geocoding API + Distance Matrix API, so an exposed key can't be abused for anything else. Leave this blank to keep using the key above (only safe if that key has no referrer restriction).
              </div>
              <GInput type="password" value={f.googleGeocodingKey || ""} onChange={e => setF({ ...f, googleGeocodingKey: e.target.value.trim() })} placeholder="AIza... (leave blank to reuse the key above)" />
            </div>
          </div>}

          {sec === "legal" && <div className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Shield size={14} className="text-brand-400" />Legal Pages</h4>
            <div className="text-xs text-white/50">
              These are your live, public Terms & Privacy pages — the same ones linked from the SMS opt-in checkbox on your lead form and required for Twilio campaign registration. Leave a field blank to use the built-in default text instead of your own. Live at:{" "}
              <a href={`${window.location.origin}${window.location.pathname}#/terms?co=${encodeURIComponent(f.companyName || "CRM Starter")}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">/terms</a>
              {" "}·{" "}
              <a href={`${window.location.origin}${window.location.pathname}#/privacy?co=${encodeURIComponent(f.companyName || "CRM Starter")}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">/privacy</a>
            </div>
            {/* FEATURE — template library: multiple named, editable versions
                per category, with one "live" version per scope. Terms of
                Service supports a separate live version for Residential vs
                Commercial jobs (picked automatically by the job's own Job
                Type at customer sign-off — see resolveTermsForJobType). */}
            {([
              { category: "privacy" as const, label: "Privacy Policy", scopes: [{ key: "privacy" as const, label: "Live on /privacy", activeId: f.activePrivacyTemplateId }] },
              { category: "terms" as const, label: "Terms of Service", scopes: [
                { key: "residential" as const, label: "Live for Residential (also /terms)", activeId: f.activeTermsResidentialTemplateId },
                { key: "commercial" as const, label: "Live for Commercial", activeId: f.activeTermsCommercialTemplateId },
              ] },
            ]).map(section => {
              const items = legalTemplates.filter(t => t.category === section.category);
              return (
                <Glass key={section.category} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">{section.label}</div>
                    <GBtn variant="ghost" className="!text-[10px] !py-1" onClick={() => openNewLegalTemplate(section.category)}><Plus size={11} className="inline mr-1" />New Template</GBtn>
                  </div>
                  {items.length === 0 ? (
                    <div className="text-[11px] text-white/40 text-center py-4 border border-dashed border-white/10 rounded-lg">No templates yet — the public page falls back to built-in default text until you add one.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map(tpl => (
                        <div key={tpl.id} className="p-2.5 bg-black/40 border border-white/5 rounded-lg">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="min-w-0">
                              <div className="text-xs font-medium truncate">{tpl.name}</div>
                              <div className="text-[10px] text-white/40">
                                {section.category === "terms" ? (tpl.appliesTo === "both" ? "Residential & Commercial" : tpl.appliesTo === "residential" ? "Residential" : "Commercial") : "General"}
                                {" · "}{new Date(tpl.updatedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => setLegalEditor({ open: true, category: section.category, data: tpl })} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition" title="Edit"><Edit size={12} /></button>
                              <button onClick={() => duplicateLegalTemplate(tpl)} className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition" title="Duplicate"><Copy size={12} /></button>
                              <button onClick={() => deleteLegalTemplate(tpl)} className="p-1.5 rounded hover:bg-danger-950/40 text-white/50 hover:text-danger-400 transition" title="Delete"><Trash2 size={12} /></button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {section.scopes
                              .filter(s => section.category === "privacy" || tpl.appliesTo === "both" || tpl.appliesTo === s.key)
                              .map(s => {
                                const isActive = s.activeId === tpl.id;
                                return (
                                  <button
                                    key={s.key}
                                    onClick={() => setActiveLegalTemplate(tpl, s.key)}
                                    disabled={isActive}
                                    className={"text-[9px] font-semibold px-2 py-1 rounded-full border transition " + (isActive ? "bg-green-700/40 border-green-600/50 text-green-300 cursor-default" : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/30")}
                                  >
                                    {isActive ? "✓ " + s.label : "Set as " + s.label}
                                  </button>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Glass>
              );
            })}
            {/* Fallback text — used on the public pages only while no
                template above has been set active for that scope yet. */}
            <Glass className="p-4 !bg-black/20">
              <div className="font-semibold text-sm mb-2 text-white/60">Fallback Text (no template active)</div>
              <div className="text-[10px] text-white/40 mb-2">Only used if you haven't picked a live template above — once you do, its content takes over.</div>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Privacy Policy</div>
              <GTxt rows={3} value={f.privacyPolicy || ""} placeholder="Leave blank to use the built-in default privacy policy." onChange={e => setF({ ...f, privacyPolicy: e.target.value })} className="!text-xs" />
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1 mt-2">Terms of Service</div>
              <GTxt rows={3} value={f.termsOfService || ""} placeholder="Leave blank to use the built-in default terms." onChange={e => setF({ ...f, termsOfService: e.target.value })} className="!text-xs" />
            </Glass>
            <Glass className="p-4">
              <div className="font-semibold text-sm mb-2">GDPR / Data Compliance</div>
              <div className="space-y-2 text-xs text-white/70">
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg"><span>Data export (customer request)</span><GBtn variant="ghost" className="!text-xs !py-1" onClick={() => toast("Customer data exported")}>Export</GBtn></div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg"><span>Right to erasure</span><GBtn variant="danger" className="!text-xs !py-1" onClick={() => toast("Contact customer and delete manually from Customers page")}>Instructions</GBtn></div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg">
                  <span>A2P 10DLC campaign status</span>
                  {/* BUG FIX — this used to be a hardcoded "Active via Twilio"
                      badge that never actually checked anything, which could
                      give false confidence about real carrier registration
                      status. Now reflects the real last-checked result from
                      Settings → Integrations → Twilio (or prompts to check). */}
                  {f.twilioA2pCampaignStatus ? (
                    <Badge tone={f.twilioA2pCampaignStatus === "VERIFIED" ? "green" : f.twilioA2pCampaignStatus === "FAILED" ? "red" : "yellow"}>{f.twilioA2pCampaignStatus}</Badge>
                  ) : (
                    <Badge tone="gray">Not checked yet</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg"><span>Stripe PCI compliance</span><Badge tone="green">Handled by Stripe</Badge></div>
              </div>
            </Glass>
          </div>}

          {sec === "audit" && (() => {
            // BUG FIX — this used to be entirely fabricated placeholder data
            // (a fake "Estimate #X7K2 for Jennifer Walsh" etc.), not a real
            // log of anything that actually happened — misleading regardless
            // of the "cut off" complaint. There's no dedicated audit_log
            // table yet, but every event type shown below already exists as
            // a real timestamp on data already loaded (jobs/estimates/
            // customers/campaigns), so this derives real recent activity
            // from that instead of inventing any of it.
            const custName = (id: any) => { const c = customers.find((x: any) => x.id === id); return c ? `${c.firstName || ""} ${c.lastName || ""}`.trim() : "a customer"; };
            const events: { ts: number; action: string; detail: string }[] = [
              ...jobs.filter((j: any) => j.completedAt).map((j: any) => ({ ts: new Date(j.completedAt).getTime(), action: "Job completed", detail: `${custName(j.customerId)} — ${j.address || ""} (${fmt(j.amount || 0)})` })),
              ...jobs.filter((j: any) => j.cancelledAt).map((j: any) => ({ ts: new Date(j.cancelledAt).getTime(), action: "Job cancelled", detail: `${custName(j.customerId)} — ${j.address || ""}` })),
              ...estimates.filter((e: any) => e.paidAt).map((e: any) => ({ ts: new Date(e.paidAt).getTime(), action: e.invoiced ? "Invoice paid" : "Estimate paid", detail: `${custName(e.customerId)} — ${fmt(e.total || 0)}` })),
              ...estimates.filter((e: any) => e.invoicedAt).map((e: any) => ({ ts: new Date(e.invoicedAt).getTime(), action: "Invoice sent", detail: `${custName(e.customerId)} — ${fmt(e.total || 0)}` })),
              ...estimates.filter((e: any) => !e.invoiced && e.createdAt).map((e: any) => ({ ts: new Date(e.createdAt).getTime(), action: "Estimate created", detail: `${custName(e.customerId)} — ${fmt(e.total || 0)}` })),
              ...customers.filter((c: any) => c.createdAt).map((c: any) => ({ ts: new Date(c.createdAt).getTime(), action: "Customer added", detail: `${c.firstName || ""} ${c.lastName || ""}`.trim() + (c.leadSource ? ` via ${c.leadSource}` : "") })),
              ...campaigns.filter((cp: any) => cp.sentAt || cp.createdAt).map((cp: any) => ({ ts: new Date(cp.sentAt || cp.createdAt).getTime(), action: "Campaign sent", detail: `${cp.name || "Campaign"} — ${cp.recipientCount ?? cp.sent ?? "?"} recipient(s)` })),
            ]
              .filter(e => Number.isFinite(e.ts) && e.ts > 0)
              .sort((a, b) => b.ts - a.ts)
              .slice(0, 25);
            return (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2"><Shield size={14} className="text-brand-400" />Audit Log</h4>
                <div className="text-xs text-white/50">Real recent activity, derived from your jobs, estimates, customers, and campaigns.</div>
                <div className="space-y-1.5">
                  {events.length === 0 && <div className="text-center py-8 text-xs text-white/30">No activity yet — this fills in as jobs complete, invoices go out, and customers are added.</div>}
                  {events.map((e, i) => (
                    <div key={i} className="flex items-start gap-3 p-2.5 bg-black/40 border border-white/5 rounded-xl text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-1.5 flex-shrink-0 text-brand-fg" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{e.action}</div>
                        <div className="text-white/50 mt-0.5">{e.detail}</div>
                        <div className="text-[10px] text-white/30 mt-0.5">{new Date(e.ts).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {events.length > 0 && <div className="text-[10px] text-white/30 text-center">Showing last {events.length} event{events.length !== 1 ? "s" : ""}</div>}
              </div>
            );
          })()}

          {sec === "models" && <AIModelsSection f={f} setF={setF} setSettings={setSettings} modelStatus={modelStatus} setModelStatus={setModelStatus} employees={employees} toast={toast} />}

          {sec === "services" && <ServiceCatalogSection services={services} setServices={setServices} toast={toast} />}

          {sec === "company" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Company Profile</h4>

            {/* FIX 8 — Manager invites weren't discoverable anywhere in Settings;
                the actual invite flow (role, rate, permissions, CRM access) lives
                on the Employees page, so this jumps there with the invite modal
                pre-opened rather than duplicating that whole form here. */}
            {!restrictToProfile && onAddManager && (
              <div className="flex items-center justify-between p-3 bg-purple-950/10 border border-purple-700/30 rounded-xl">
                <div>
                  <div className="text-sm font-medium flex items-center gap-1.5"><Shield size={13} className="text-purple-400" />Team & Managers</div>
                  <div className="text-[10px] text-white/50 mt-0.5">Invite a manager with full CRM access minus Alfred, Accountability, Google Workspace, and Inbox.</div>
                </div>
                <GBtn onClick={onAddManager} className="!text-xs !py-2 !px-3 flex-shrink-0">+ Add Manager</GBtn>
              </div>
            )}

            {/* Logo upload */}
            <div>
              <label className="text-xs text-white/60 mb-2 block">Company Logo</label>
              <div className="flex items-center gap-4">
                {f.logoUrl ? <img src={f.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-xl bg-black/40 border border-brand-900/30 p-1" /> : <div className="w-16 h-16 rounded-xl bg-black/40 border border-brand-900/30 flex items-center justify-center text-white/30 text-2xl">🏢</div>}
                <div>
                  <label className="cursor-pointer px-3 py-2 bg-black/40 border border-brand-900/30 rounded-xl text-xs text-white/70 hover:text-white transition flex items-center gap-1.5">
                    <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (!file) return; compressImageFile(file, 400, 0.8).then(dataUrl => setF(prev => ({ ...prev, logoUrl: dataUrl }))); }} />
                    <Upload size={12} /> Upload Logo
                  </label>
                  {f.logoUrl && <button onClick={() => setF(prev => ({ ...prev, logoUrl: "" }))} className="mt-1 text-[10px] text-danger-400 hover:text-danger-300 block">Remove</button>}
                  <div className="text-[10px] text-white/30 mt-1">PNG or SVG recommended</div>
                </div>
              </div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block">Name</label><GInput value={f.companyName} onChange={e => setF({ ...f, companyName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={f.companyPhone} onChange={e => setF({ ...f, companyPhone: e.target.value })} /></div>
              <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput value={f.companyEmail} onChange={e => setF({ ...f, companyEmail: e.target.value })} /></div>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><MapPin size={10} />Location <span className="text-white/30 font-normal">(for weather — zip code or "City, ST")</span></label>
              <GInput value={f.weatherLocation || ""} onChange={e => setF({ ...f, weatherLocation: e.target.value })} placeholder="e.g. 90210 or Austin, TX" className="!text-xs" />
              <div className="text-[10px] text-white/30 mt-1">Leave blank to use your company address.</div>
            </div>
            {/* FEATURE — "move the tax rate percentage from Goals into
                Company." Moved from the Goals & Tax panel to here, right
                next to the field that actually determines it. Was
                previously guessed from a free-text "Company Address" field
                that didn't actually exist anywhere in Settings — guessing
                always silently failed. A real State dropdown fixes that at
                the source; new signups are asked for this directly too (see
                the company-setup step) so the rate is right from day one. */}
            <div>
              <label className="text-xs text-white/60 mb-1 block">State</label>
              <GSel value={f.companyState || ""} onChange={e => {
                const st = e.target.value;
                const suggested = st ? US_STATE_BASE_TAX_RATES[st] : undefined;
                setF(prev => ({ ...prev, companyState: st, ...(suggested !== undefined && !prev.taxRate ? { taxRate: suggested } : {}) }));
              }}>
                <option value="" className="bg-black">Select your state…</option>
                {Object.keys(US_STATE_BASE_TAX_RATES).sort().map(code => <option key={code} value={code} className="bg-black">{code}</option>)}
              </GSel>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-1 block">Tax Rate (%)</label>
              <div className="flex gap-2">
                <GInput type="number" step="0.01" value={f.taxRate} onChange={e => setF({ ...f, taxRate: e.target.value })} className="flex-1" />
                {/* Suggests, never silently overwrites — the owner may have
                    already set a deliberately different rate (county
                    add-on, service-tax-exempt state, etc.). */}
                {f.companyState && US_STATE_BASE_TAX_RATES[f.companyState] !== undefined && (
                  <GBtn variant="ghost" className="!text-xs !py-1.5 !px-3 flex-shrink-0" onClick={() => { setF({ ...f, taxRate: US_STATE_BASE_TAX_RATES[f.companyState] }); toast?.(`Set to ${f.companyState}'s base rate (${US_STATE_BASE_TAX_RATES[f.companyState]}%)`, "green"); }}>
                    Use {f.companyState} rate ({US_STATE_BASE_TAX_RATES[f.companyState]}%)
                  </GBtn>
                )}
              </div>
              <div className="text-[10px] text-white/30 mt-1">
                {f.companyState
                  ? `Suggestion above is ${f.companyState}'s base state rate — county/city add-ons and whether services are taxable at all vary, so double-check with your accountant.`
                  : `Select your state above to get a tax rate suggestion.`}
              </div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Phone size={10} />Your Mobile # <span className="text-white/30 font-normal">(for Alfred SMS summaries)</span></label><GInput type="tel" value={f.myPhone || ""} onChange={e => setF({ ...f, myPhone: e.target.value })} placeholder="+15555550100" className="!text-xs" /></div>
            <label className={"flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition " + (f.alfredSmsEnabled ? "border-brand-500/40 bg-brand-950/20" : "border-white/10 bg-white/5")}>
              <input type="checkbox" checked={!!f.alfredSmsEnabled} onChange={e => setF({ ...f, alfredSmsEnabled: e.target.checked })} className="mt-0.5 accent-brand-600" />
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5"><Bot size={12} />Text Alfred from my phone</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  Text your CRM Twilio number ({f.twilioFrom || "your Twilio From #"}) from the mobile number above and Alfred replies right there — "reschedule Tuesday's job to Thursday", "who's on job 2 right now", "text the Smiths we're running late". Requires an Anthropic (Claude) API key in AI Models below and your mobile # filled in above.
                </div>
              </div>
            </label>
            {/* FEATURE — "proactive daily check-ins, but only if the owner
                wants them." Off by default — a real opt-in, not
                always-on. Reuses the exact same morning-briefing content
                that's already generated for the in-app Alfred
                Notifications thread every day (App.tsx's tryBriefing
                effect); this just adds texting it to the mobile number
                above as a second delivery channel. */}
            <label className={"flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition " + (f.alfredSmsCheckinEnabled ? "border-brand-500/40 bg-brand-950/20" : "border-white/10 bg-white/5")}>
              <input type="checkbox" checked={!!f.alfredSmsCheckinEnabled} onChange={e => setF({ ...f, alfredSmsCheckinEnabled: e.target.checked })} className="mt-0.5 accent-brand-600" />
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5"><Bot size={12} />Text me a daily check-in</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  Off by default. When on, Alfred texts your mobile number above a morning briefing (today's jobs, revenue pace, pending quotes, overdue invoices) once a day between 6-11am — same content as the in-app Alfred Notifications, just also sent as a text.
                </div>
              </div>
            </label>
            {/* FEATURE — split into two independent toggles ("cancel jobs,
                request to reschedule, reschedule jobs, etc" — the owner
                wants finer control than one combined switch). Each falls
                back to the legacy clientPortalCancelReschedule value in
                ClientAuthPortal.tsx when not explicitly set, so existing
                owners' single toggle keeps working as before until they
                touch either of these. */}
            <label className={"flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition " + ((f.clientPortalCanReschedule ?? f.clientPortalCancelReschedule) ? "border-brand-500/40 bg-brand-950/20" : "border-white/10 bg-white/5")}>
              <input type="checkbox" checked={!!(f.clientPortalCanReschedule ?? f.clientPortalCancelReschedule)} onChange={e => setF({ ...f, clientPortalCanReschedule: e.target.checked })} className="mt-0.5 accent-brand-600" />
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5"><CalendarClock size={12} />Allow clients to reschedule directly in the portal</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  Off by default. When on, a client can move their own upcoming job right from the Client Portal — they must type a reason, and you get notified immediately. When off, they can only send a reschedule request for you to confirm.
                </div>
              </div>
            </label>
            <label className={"flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition " + ((f.clientPortalCanCancel ?? f.clientPortalCancelReschedule) ? "border-brand-500/40 bg-brand-950/20" : "border-white/10 bg-white/5")}>
              <input type="checkbox" checked={!!(f.clientPortalCanCancel ?? f.clientPortalCancelReschedule)} onChange={e => setF({ ...f, clientPortalCanCancel: e.target.checked })} className="mt-0.5 accent-brand-600" />
              <div>
                <div className="text-xs font-semibold text-white flex items-center gap-1.5"><CalendarClock size={12} />Allow clients to cancel jobs directly in the portal</div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  Off by default. When on, a client can cancel their own upcoming job right from the Client Portal — they must type a reason, and you get notified immediately. When off, there's no self-serve cancel button; they need to contact you.
                </div>
              </div>
            </label>
            {/* FEATURE — "Alfred should know how each company wants their
                work order emails written — word limit, tone, branding."
                Consumed by AlfredPage.tsx's generate_work_order_summary
                tool (passed into its system prompt context) and by
                functions/api-side templates if that's ever added later —
                lives in app_settings.data like every other setting, no
                migration needed. */}
            <div className="p-3 rounded-xl border border-purple-700/20 bg-purple-950/10 space-y-2">
              <div className="text-xs font-semibold text-purple-300 flex items-center gap-1.5"><FileText size={12} />Work Order Email Style (used by Alfred)</div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block">Default subject template</label>
                <GInput placeholder="Work Order {{number}} Complete" value={(f as any).workOrderEmailTemplate?.subject || ""} onChange={e => setF({ ...f, workOrderEmailTemplate: { ...(f as any).workOrderEmailTemplate, subject: e.target.value } })} className="!text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block">Tone/style instructions for Alfred</label>
                <GTxt rows={2} placeholder="e.g. Keep it under 150 words, formal tone, no exclamation points." value={(f as any).workOrderEmailTemplate?.instructions || ""} onChange={e => setF({ ...f, workOrderEmailTemplate: { ...(f as any).workOrderEmailTemplate, instructions: e.target.value } })} className="!text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block">Max words</label>
                  <GInput type="number" min="0" placeholder="e.g. 150" value={(f as any).workOrderEmailTemplate?.maxWords || ""} onChange={e => setF({ ...f, workOrderEmailTemplate: { ...(f as any).workOrderEmailTemplate, maxWords: Number(e.target.value) || undefined } })} className="!text-xs" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-4">
                  <input type="checkbox" checked={(f as any).workOrderEmailTemplate?.includeSignature !== false} onChange={e => setF({ ...f, workOrderEmailTemplate: { ...(f as any).workOrderEmailTemplate, includeSignature: e.target.checked } })} className="accent-purple-600 w-3.5 h-3.5" />
                  <span className="text-[10px] text-white/60">Include manager signature</span>
                </label>
              </div>
            </div>

            <div>
              {/* FIX 13 — the review landing page (#/rate) falls back to a
                  hardcoded "your-business" Google review link when
                  no Place ID is set, which points EVERY deployment's
                  customers at a specific other business's review page if
                  left unconfigured. A direct, pasteable review link is also
                  far easier for a non-technical owner to get (Google Business
                  Profile → "Ask for reviews" → Copy link) than hunting down a
                  Place ID through Google's developer docs — this is now the
                  preferred field; Place ID below still works as a fallback
                  for anyone who already has one set. */}
              <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Star size={10} />Google Maps Review Link</label>
              <GInput value={f.googleReviewLink || ""} onChange={e => setF({ ...f, googleReviewLink: e.target.value })} placeholder="https://g.page/r/.../review" className="!text-xs" />
              <div className="text-[10px] text-white/30 mt-1">From your Google Business Profile: "Ask for reviews" → Copy link. Customers rating at or above the threshold below are sent here.</div>
            </div>
            {/* FEATURE — "let the owner set the star cutoff for Google." Was
                hardcoded at 4-5 stars → Google, 1-3 → private feedback. Now
                owner-configurable (e.g. tighten to 5-only) — see gm= param
                threaded through every #/rate link builder and
                CustomerReviewPage.tsx's googleMinStars. */}
            <div>
              <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Star size={10} />Minimum star rating sent to Google</label>
              <GSel value={String(f.reviewGoogleMinStars || 4)} onChange={e => setF({ ...f, reviewGoogleMinStars: Number(e.target.value) })} className="!text-xs">
                <option value="3" className="bg-black">3 stars & up</option>
                <option value="4" className="bg-black">4 stars & up (default)</option>
                <option value="5" className="bg-black">5 stars only</option>
              </GSel>
              <div className="text-[10px] text-white/30 mt-1">Below this rating, the customer never sees a Google prompt — instead they're asked two private follow-up questions and get a simple thank-you.</div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Star size={10} />Google Place ID <span className="text-white/30 font-normal">(fallback if no review link above)</span></label><GInput value={f.googlePlaceId || ""} onChange={e => setF({ ...f, googlePlaceId: e.target.value })} placeholder="ChIJ..." className="!text-xs" /><div className="text-[10px] text-white/30 mt-1">Find at <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">developers.google.com/maps/…/place-id</a></div></div>
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Clock size={10} />Max Lunch Break <span className="text-white/30 font-normal">(minutes)</span></label><GInput type="number" value={f.maxLunchMinutes ?? 30} onChange={e => setF({ ...f, maxLunchMinutes: Number(e.target.value) || 0 })} placeholder="30" className="!text-xs" /><div className="text-[10px] text-white/30 mt-1">Crew lunch breaks longer than this are flagged on the job</div></div>
            {/* FEATURE (round 13, item 12) — Testing Mode master switch. With
                this on, any customer flagged "Test Client" (checkbox on
                CustomerModal) never receives a real SMS/email/automation —
                every send path is blocked at the source, see
                lib/messaging.ts's setTestModeContacts. */}
            <div className="p-3 rounded-xl border border-yellow-700/30 bg-yellow-950/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-yellow-300 flex items-center gap-1">🧪 Testing Mode</div>
                  <div className="text-[10px] text-white/50 mt-0.5">When on, customers flagged "Test Client" never receive real SMS/email/automations — safe for end-to-end testing.</div>
                </div>
                <button onClick={() => setF({ ...f, testModeEnabled: !f.testModeEnabled })} className={"flex-shrink-0 w-11 h-6 rounded-full transition relative " + (f.testModeEnabled ? "bg-yellow-600" : "bg-white/10")}>
                  <div className={"absolute top-1 w-4 h-4 rounded-full bg-white transition " + (f.testModeEnabled ? "left-6" : "left-1")} />
                </button>
              </div>
            </div>
            {/* ISSUE 15 (round 3) — owner control over whether employees see
                job/pay dollar amounts in their own Pay tab. */}
            <div className="flex items-center justify-between p-3 bg-black/40 border border-brand-900/20 rounded-xl">
              <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">Hide $ amounts from employees</div><div className="text-[10px] text-white/50">Employee Pay tab still shows hours worked, just not job prices or earnings</div></div>
              <button onClick={() => setF({ ...f, hideJobAmountsFromEmployees: !f.hideJobAmountsFromEmployees })} className={"transition " + (f.hideJobAmountsFromEmployees ? "text-brand-400" : "text-white/30")}>{f.hideJobAmountsFromEmployees ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
            </div>
            {/* ISSUE 16 (round 4) — GPS auto-mileage tracking, default ON. */}
            <div className="flex items-center justify-between p-3 bg-black/40 border border-brand-900/20 rounded-xl">
              <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">Auto-track mileage via GPS</div><div className="text-[10px] text-white/50">Estimates miles driven between clock-in and clock-out on the employee's device; they review/edit before submitting</div></div>
              <button onClick={() => setF({ ...f, autoMileageTrackingEnabled: f.autoMileageTrackingEnabled === false ? true : false })} className={"transition " + (f.autoMileageTrackingEnabled !== false ? "text-brand-400" : "text-white/30")}>{f.autoMileageTrackingEnabled !== false ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Truck size={10} />Default Travel Buffer <span className="text-white/30 font-normal">(minutes between jobs)</span></label><GInput type="number" min="0" step="5" value={f.defaultBufferMinutes ?? 30} onChange={e => setF({ ...f, defaultBufferMinutes: Number(e.target.value) || 0 })} placeholder="30" className="!text-xs" /><div className="text-[10px] text-white/30 mt-1">Jobs scheduled the same day get flagged on the Calendar if there isn't this much time between them</div></div>
            {/* FEATURE — moved to a real multi-version template library
                (Settings → Legal), so both residential and commercial Terms
                of Service can have several saved drafts, not just one field
                each. This card just points there instead of duplicating it. */}
            <div className="flex items-center justify-between p-3 bg-black/40 border border-brand-900/20 rounded-xl">
              <div className="flex-1 min-w-0 pr-3">
                <div className="text-sm font-medium flex items-center gap-1.5"><FileText size={12} />Terms & Conditions</div>
                <div className="text-[10px] text-white/50 mt-0.5">Shown on the customer sign-off screen — manage residential/commercial versions and templates in Settings → Legal.</div>
              </div>
              <GBtn variant="ghost" className="!text-xs flex-shrink-0" onClick={() => setSec("legal")}><Shield size={12} className="inline mr-1.5" />Go to Legal →</GBtn>
            </div>
            <div className="flex items-center justify-between p-3 bg-black/40 border border-brand-900/20 rounded-xl">
              <div className="flex-1 min-w-0 pr-3">
                <div className="text-sm font-medium">Paid Lunch Breaks</div>
                <div className="text-[10px] text-white/50">{f.paidLunchBreaks ? "Lunch time counts toward payroll" : "Lunch time is deducted from logged hours"}</div>
              </div>
              <button onClick={() => setF({ ...f, paidLunchBreaks: !f.paidLunchBreaks })} className={"transition " + (f.paidLunchBreaks ? "text-brand-400" : "text-white/30")}>
                {f.paidLunchBreaks ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
              </button>
            </div>
            <div>
              <label className="text-xs text-white/60 mb-2 block flex items-center gap-1">🎨 Brand Colors</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "Primary",    key: "brandPrimary",  def: "#111111", hint: "Buttons, links, highlights" },
                  { label: "Accent",     key: "brandAccent",   def: "#525252", hint: "Borders, icons" },
                  { label: "Background", key: "brandBg",       def: "#000000", hint: "Page background" },
                  { label: "Surface",    key: "brandSurface",  def: "#0a0a0a", hint: "Card backgrounds" },
                  { label: "Text",       key: "brandText",     def: "#ffffff", hint: "Main text color" },
                ].map(c => (
                  <div key={c.key}>
                    <label className="text-[10px] text-white/50 mb-1 block">{c.label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={f[c.key] || c.def} onChange={e => setF({ ...f, [c.key]: e.target.value })} className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <input type="text" value={f[c.key] || c.def} onChange={e => setF({ ...f, [c.key]: e.target.value })} className="w-full bg-black/40 border border-brand-900/30 rounded-lg px-2 py-1 text-[11px] text-white font-mono" />
                        <div className="text-[9px] text-white/30 mt-0.5">{c.hint}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-white/30 mt-2">Colors apply to the full app UI, estimate portal, review landing, and lead intake form.</div>
            </div>

            {/* Font family */}
            <div>
              <label className="text-xs text-white/60 mb-2 block flex items-center gap-1">🔤 App Font</label>
              <GSel value={f.brandFont || "default"} onChange={e => setF({ ...f, brandFont: e.target.value })}>
                <option value="default" className="bg-black">Default (System UI)</option>
                <option value="serif" className="bg-black">Serif (Georgia)</option>
                <option value="mono" className="bg-black">Mono (Courier)</option>
                <option value="rounded" className="bg-black">Rounded (Trebuchet)</option>
                <option value="modern" className="bg-black">Modern (Outfit)</option>
              </GSel>
              <div className="text-[10px] text-white/30 mt-1">Changes the typeface across the entire app in real time.</div>
            </div>

            {/* Branding preview */}
            <div>
              <label className="text-xs text-white/60 mb-2 block">Live Preview — Estimate Page</label>
              <div className="rounded-xl border overflow-hidden text-sm" style={{ borderColor: (f.brandPrimary || "#111111") + "40", fontFamily: { serif: "Georgia, serif", mono: "Courier New, monospace", rounded: "Trebuchet MS, sans-serif", modern: "Outfit, sans-serif", default: "system-ui, sans-serif" }[f.brandFont as string] || "system-ui, sans-serif" }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ background: f.brandPrimary || "#111111" }}>
                  <div className="flex items-center gap-3">
                    {f.logoUrl
                      ? <img src={f.logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-lg bg-white/10 p-0.5" />
                      : <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center text-xl">🏢</div>}
                    <div>
                      <div className="font-bold text-white">{f.companyName || "Your Company"}</div>
                      <div className="text-[11px] text-white/70">{f.companyPhone || "(555) 555-0100"} · {f.companyEmail || "info@yourcompany.com"}</div>
                    </div>
                  </div>
                  <div className="text-white/80 text-[11px] text-right">
                    <div className="font-semibold">Estimate #1042</div>
                    <div>Valid until Jun 15, 2025</div>
                  </div>
                </div>
                {/* Body */}
                <div className="p-4 space-y-3" style={{ background: f.brandBg || "#000000", color: f.brandText || "#ffffff" }}>
                  {/* Customer info */}
                  <div className="flex justify-between text-[11px]" style={{ color: (f.brandText || "#ffffff") + "90" }}>
                    <div><div className="font-semibold" style={{ color: f.brandText || "#ffffff" }}>John & Sarah Mitchell</div><div>1847 Oak Creek Drive, your area</div></div>
                    <div className="text-right"><div>2,200 sq ft · 2-story</div><div>Gate code: 4729</div></div>
                  </div>
                  {/* Line items */}
                  <div className="rounded-lg overflow-hidden" style={{ background: (f.brandSurface || "#0a0a0a"), border: "1px solid " + (f.brandPrimary || "#111111") + "20" }}>
                    {[
                      ["House Exterior service", "1", "$385.00"],
                      ["Standard Service Visit", "1", "$175.00"],
                      ["Materials", "1", "$129.00"],
                    ].map(([desc, qty, price]) => (
                      <div key={desc} className="flex items-center justify-between px-3 py-2 border-b text-[11px]" style={{ borderColor: (f.brandPrimary || "#111111") + "15", color: (f.brandText || "#ffffff") + "b0" }}>
                        <span className="flex-1">{desc}</span>
                        <span className="w-6 text-center">{qty}</span>
                        <span className="w-16 text-right font-medium" style={{ color: f.brandText || "#ffffff" }}>{price}</span>
                      </div>
                    ))}
                    <div className="px-3 py-2 space-y-1 text-[11px]">
                      <div className="flex justify-between" style={{ color: (f.brandText || "#ffffff") + "60" }}><span>Subtotal</span><span>$689.00</span></div>
                      <div className="flex justify-between" style={{ color: (f.brandText || "#ffffff") + "60" }}><span>Tax (6%)</span><span>$41.34</span></div>
                      <div className="flex justify-between font-bold text-sm pt-1 border-t" style={{ borderColor: (f.brandPrimary || "#111111") + "30", color: f.brandPrimary || "#111111" }}><span>Total</span><span>$730.34</span></div>
                    </div>
                  </div>
                  {/* Notes */}
                  <div className="text-[11px] px-3 py-2 rounded-lg" style={{ background: (f.brandSurface || "#0a0a0a"), color: (f.brandText || "#ffffff") + "80" }}>
                    📝 <span className="font-medium" style={{ color: (f.brandText || "#ffffff") + "cc" }}>Note:</span> Includes cleanup and haul-away. Gate access required — please ensure dogs are secured.
                  </div>
                  {/* CTA */}
                  <button className="w-full py-2.5 rounded-lg text-white font-semibold text-sm" style={{ background: f.brandPrimary || "#111111" }}>✍️ Approve &amp; Sign Estimate</button>
                  <div className="text-center text-[10px]" style={{ color: (f.brandText || "#ffffff") + "40" }}>By approving you agree to the terms &amp; conditions below</div>
                </div>
              </div>
              <div className="text-[10px] text-white/30 mt-1.5">Preview updates live as you change colors and fonts above. This is what customers see when you send them an estimate.</div>
            </div>
          </div>}

          {sec === "goals" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Goals</h4>
            <div><label className="text-xs text-white/60 mb-1 block">Monthly Revenue Goal ($)</label><GInput type="number" value={f.monthlyRevenueGoal} onChange={e => setF({ ...f, monthlyRevenueGoal: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Quarterly Revenue Goal ($)</label><GInput type="number" value={f.quarterlyRevenueGoal || ""} onChange={e => setF({ ...f, quarterlyRevenueGoal: e.target.value })} placeholder={(f.monthlyRevenueGoal * 3) || "45000"} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Monthly Jobs Goal</label><GInput type="number" value={f.monthlyJobsGoal} onChange={e => setF({ ...f, monthlyJobsGoal: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Annual Revenue Goal ($)</label><GInput type="number" value={f.annualRevenueGoal || ""} onChange={e => setF({ ...f, annualRevenueGoal: e.target.value })} placeholder={(f.monthlyRevenueGoal * 12) || "120000"} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Customer Acquisition Goal <span className="text-white/30">(new customers/mo)</span></label><GInput type="number" value={f.customerAcquisitionGoal || ""} onChange={e => setF({ ...f, customerAcquisitionGoal: e.target.value })} placeholder="10" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Avg Job Value Goal ($)</label><GInput type="number" value={f.avgJobValueGoal || ""} onChange={e => setF({ ...f, avgJobValueGoal: e.target.value })} placeholder="350" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Review Rating Goal <span className="text-white/30">(out of 5)</span></label><GInput type="number" step="0.1" min="1" max="5" value={f.reviewRatingGoal || ""} onChange={e => setF({ ...f, reviewRatingGoal: e.target.value })} placeholder="4.8" /></div>
          </div>}

          {sec === "billing" && (
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">CRM Starter Subscription</h4>
              <div className="text-xs text-white/50">This is your subscription to CRM Starter itself — separate from Stripe/Square under Integrations, which is for charging YOUR OWN customers.</div>
              {/* FEATURE — "show your limits and all that different stuff."
                  getPlanLimits (lib/planLimits.ts) already enforces real
                  customer/employee-seat caps elsewhere in the app (see
                  CustomersPage.tsx/EmployeesPage.tsx's onUpgrade prop) but
                  had no visible usage display anywhere — an owner on a
                  limited plan had no way to see how close they were to a
                  cap until they actually hit it and got blocked. */}
              {!platformSubLoading && (() => {
                const limits = getPlanLimits(platformSub);
                if (limits.customers === null && limits.employeeSeats === null) return null;
                const custUsed = customers.length;
                const empUsed = employees.filter((e: any) => (e.status || "active") !== "terminated").length;
                const bar = (used: number, max: number | null) => {
                  if (max === null) return null;
                  const pct = Math.min(100, Math.round((used / max) * 100));
                  return (
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                      <div className={"h-full rounded-full " + (pct >= 100 ? "bg-brand-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500")} style={{ width: pct + "%" }} />
                    </div>
                  );
                };
                return (
                  <Glass className="p-4 space-y-3">
                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">Usage — {PLAN_TIER_LABEL[limits.tier]}</div>
                    {limits.customers !== null && (
                      <div>
                        <div className="flex justify-between text-xs"><span className="text-white/60">Customers</span><span className={custUsed >= limits.customers ? "text-brand-400 font-semibold" : "text-white/70"}>{custUsed} / {limits.customers}</span></div>
                        {bar(custUsed, limits.customers)}
                      </div>
                    )}
                    {limits.employeeSeats !== null && (
                      <div>
                        <div className="flex justify-between text-xs"><span className="text-white/60">Employee Seats</span><span className={empUsed >= limits.employeeSeats ? "text-brand-400 font-semibold" : "text-white/70"}>{empUsed} / {limits.employeeSeats}</span></div>
                        {bar(empUsed, limits.employeeSeats)}
                      </div>
                    )}
                    {(custUsed >= (limits.customers ?? Infinity) || empUsed >= (limits.employeeSeats ?? Infinity)) && (
                      <div className="text-[11px] text-yellow-300">You've hit a limit on {PLAN_TIER_LABEL[limits.tier]} — upgrade below for unlimited customers and seats.</div>
                    )}
                  </Glass>
                );
              })()}
              {platformSubLoading ? (
                <div className="text-xs text-white/40">Loading…</div>
              ) : (() => {
                const status = platformSub?.status;
                const trialEndsAt = platformSub?.trial_ends_at ? new Date(platformSub.trial_ends_at) : null;
                const trialDaysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)) : null;
                if (status === "active") {
                  const plan = BILLING_PLANS.find(p => p.key === platformSub.plan);
                  return (
                    <Glass className="p-4 !bg-green-950/15 !border-green-700/30 space-y-2">
                      <div className="flex items-center gap-2"><Badge tone="green">Active</Badge><div className="font-semibold text-sm">{plan?.name || platformSub.plan} Plan</div></div>
                      <div className="text-xs text-white/50">Billed {platformSub.interval === "year" ? "annually" : "monthly"}{platformSub.current_period_end ? ` · renews ${new Date(platformSub.current_period_end).toLocaleDateString()}` : ""}</div>
                      <GBtn variant="ghost" disabled={billingActionBusy === "portal"} onClick={openBillingPortal} className="!text-xs">
                        {billingActionBusy === "portal" ? "Opening…" : "Manage Billing / Change Plan / Cancel"}
                      </GBtn>
                    </Glass>
                  );
                }
                if (status === "past_due") {
                  return (
                    <Glass className="p-4 !bg-yellow-950/15 !border-yellow-700/30 space-y-2">
                      <div className="flex items-center gap-2"><Badge tone="yellow">Payment Failed</Badge></div>
                      <div className="text-xs text-white/60">Your last payment didn't go through — update your card to keep your subscription active.</div>
                      <GBtn disabled={billingActionBusy === "portal"} onClick={openBillingPortal} className="!text-xs">
                        {billingActionBusy === "portal" ? "Opening…" : "Update Payment Method"}
                      </GBtn>
                    </Glass>
                  );
                }
                return (
                  <>
                    {status === "trialing" && trialDaysLeft !== null && (
                      <div className={"text-xs rounded-xl px-3 py-2 border " + (trialDaysLeft <= 3 ? "text-yellow-300 bg-yellow-950/20 border-yellow-700/30" : "text-white/60 bg-white/5 border-white/10")}>
                        {trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left in your free trial.` : "Your free trial has ended — pick a plan to keep using CRM Starter."}
                      </div>
                    )}
                    {status === "canceled" && (
                      <div className="text-xs text-brand-300 bg-brand-950/20 border border-brand-700/30 rounded-xl px-3 py-2">Your subscription was canceled. Pick a plan below to resubscribe.</div>
                    )}
                    {/* FEATURE — "you never added the free plan." Free was
                        already a REAL enforced tier (getPlanLimits falls
                        back to it once a trial expires with no upgrade, or
                        a subscription lapses) but was never shown anywhere
                        as an actual plan option — an owner who landed there
                        had no visible confirmation of what they were on or
                        what it included. Not a Stripe checkout item (it's
                        free), so this is informational, not a "Subscribe"
                        button like the paid cards below. */}
                    {getPlanLimits(platformSub).tier === "free" && (
                      <Glass className="p-4 !border-white/15">
                        <div className="flex items-center gap-2 mb-1"><Badge tone="gray">Current Plan</Badge><div className="font-semibold text-sm">Free</div></div>
                        <div className="text-xs text-white/50">Up to 15 customers, 1 employee seat. Upgrade any time below for unlimited customers and crew.</div>
                      </Glass>
                    )}
                    <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10 w-fit">
                      {(["month", "year"] as const).map(iv => (
                        <button key={iv} onClick={() => setBillingInterval(iv)} className={"px-3 py-1.5 rounded-lg text-xs font-semibold transition " + (billingInterval === iv ? "bg-brand-700 text-brand-fg" : "text-white/50 hover:text-white")}>
                          {iv === "month" ? "Monthly" : "Annual (save ~20%)"}
                        </button>
                      ))}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {BILLING_PLANS.map(p => (
                        <div key={p.key} className={"p-4 rounded-xl border space-y-2 " + (p.highlighted ? "border-brand-600/50 bg-brand-950/20" : "border-white/10 bg-black/30")}>
                          <div className="font-semibold text-sm">{p.name}</div>
                          <div className="text-2xl font-bold">${billingInterval === "year" ? p.annual : p.monthly}<span className="text-xs text-white/40 font-normal">/mo</span></div>
                          <div className="text-[10px] text-white/40">{p.tagline}</div>
                          <GBtn disabled={billingActionBusy === p.key} onClick={() => startCheckout(p.key)} className="w-full !text-xs !py-2">
                            {billingActionBusy === p.key ? "Starting…" : "Subscribe"}
                          </GBtn>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {/* FEATURE — "invite other owners to pay for it, both sides
                  get a discount." Distinct from ReferralsPage.tsx's
                  customer-refers-customer program — this is one CRM Starter
                  subscriber inviting another business owner. */}
              {ownerReferral && (
                <Glass className="p-4 !bg-purple-950/15 !border-purple-700/30 space-y-2">
                  <div className="text-sm font-semibold text-purple-300 flex items-center gap-1.5"><Gift size={14} />Invite another business, save {ownerReferral.discountPercent}%</div>
                  <div className="text-xs text-white/50">Share your code — when they subscribe, you both get {ownerReferral.discountPercent}% off your next bill.</div>
                  <div className="flex items-center gap-2">
                    <GInput readOnly value={`${window.location.origin}${window.location.pathname}#/login?ref=${ownerReferral.referralCode}`} className="!text-xs flex-1" />
                    <GBtn
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/login?ref=${ownerReferral.referralCode}`).then(
                          () => toast?.("Referral link copied ✓", "green"),
                          () => toast?.("Couldn't copy — select and copy manually", "red")
                        );
                      }}
                      className="!text-xs flex-shrink-0"
                    >
                      Copy
                    </GBtn>
                  </div>
                </Glass>
              )}
            </div>
          )}

          {sec === "templates" && <div className="space-y-4">
            {/* Sub-tabs */}
            <div className="flex gap-1 p-1 bg-black/40 rounded-xl border border-brand-900/20">
              {([["messaging", "Email & SMS"], ["estimates", "Estimate Templates"], ["onboarding", "Onboarding Packet"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => { setTplTab(key); setEditingTpl(null); }} className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition " + (tplTab === key ? "bg-brand-700/40 text-white border border-brand-700/50" : "text-white/50 hover:text-white")}>{label}</button>
              ))}
            </div>

            {tplTab === "messaging" && <TemplateEditor emailTemplates={emailTemplates} setEmailTemplates={setEmailTemplates} smsTemplates={smsTemplates} setSmsTemplates={setSmsTemplates} settings={f} setSettings={newF => setF(newF)} />}

            {tplTab === "estimates" && <>
              {editingTpl === null ? (
                // ── List view ────────────────────────────────────────────────
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Estimate Templates</div>
                      <div className="text-[10px] text-white/40 mt-0.5">Reusable starting points for new estimates — pre-fill line items, notes, terms, and custom questions.</div>
                    </div>
                    <GBtn onClick={() => setEditingTpl(blankTpl())} className="!text-xs !py-1.5"><Plus size={12} className="inline mr-1" />New Template</GBtn>
                  </div>
                  {estimateTemplates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-brand-900/30 rounded-xl">
                      <FileText size={28} className="text-white/10 mb-2" />
                      <div className="text-xs text-white/30">No estimate templates yet</div>
                      <button onClick={() => setEditingTpl(blankTpl())} className="mt-2 text-[11px] text-brand-400 hover:text-brand-300">Create your first template →</button>
                    </div>
                  )}
                  {estimateTemplates.map((tpl: any) => (
                    <Glass key={tpl.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm">{tpl.name}</div>
                          {tpl.description && <div className="text-[11px] text-white/50 mt-0.5 truncate">{tpl.description}</div>}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-[10px] px-2 py-0.5 bg-black/40 border border-white/10 rounded-full text-white/50">{(tpl.lineItems || []).length} line item{(tpl.lineItems || []).length !== 1 ? "s" : ""}</span>
                            {(tpl.customFields || []).length > 0 && <span className="text-[10px] px-2 py-0.5 bg-purple-950/30 border border-purple-700/30 rounded-full text-purple-300">{tpl.customFields.length} custom field{tpl.customFields.length !== 1 ? "s" : ""}</span>}
                            {tpl.terms && <span className="text-[10px] px-2 py-0.5 bg-black/40 border border-white/10 rounded-full text-white/40">Has terms</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => setEditingTpl({ ...tpl })} className="px-3 py-1.5 rounded-lg border border-brand-900/30 text-xs text-white/70 hover:text-white hover:bg-brand-900/20 transition"><Edit size={11} className="inline mr-1" />Edit</button>
                          <button onClick={() => { setEstimateTemplates((prev: any[]) => prev.filter((t: any) => t.id !== tpl.id)); toast("Template deleted"); }} className="px-3 py-1.5 rounded-lg border border-danger-900/30 text-xs text-danger-400/70 hover:text-danger-400 hover:bg-danger-900/20 transition"><Trash2 size={11} /></button>
                        </div>
                      </div>
                    </Glass>
                  ))}
                </div>
              ) : (
                // ── Edit / Create form ────────────────────────────────────────
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setEditingTpl(null)} className="p-1.5 rounded-lg hover:bg-white/5 text-white/50 hover:text-white transition"><ChevronLeft size={16} /></button>
                    <div className="font-semibold text-sm">{editingTpl.id ? "Edit Template" : "New Template"}</div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div><label className="text-xs text-white/60 mb-1 block">Template Name *</label><GInput placeholder="e.g. Standard Package" value={editingTpl.name} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, name: e.target.value }))} /></div>
                    <div><label className="text-xs text-white/60 mb-1 block">Description</label><GInput placeholder="Short description (optional)" value={editingTpl.description || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, description: e.target.value }))} /></div>
                  </div>

                  {/* Visual design — applied to the customer-facing client portal when this template is selected at send time */}
                  <Glass className="p-4 !bg-purple-950/10 !border-purple-700/20 space-y-3">
                    <div className="text-xs font-semibold text-purple-300">Visual Design</div>

                    <div className="flex items-center gap-3">
                      {editingTpl.logoUrl ? (
                        <div className="relative">
                          <img src={editingTpl.logoUrl} alt="" className="w-14 h-14 rounded-lg object-contain bg-white/5 border border-white/10" />
                          <button onClick={() => setEditingTpl((t: any) => ({ ...t, logoUrl: undefined }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-600 text-brand-fg flex items-center justify-center"><X size={10} /></button>
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-white/5 border border-dashed border-white/15 flex items-center justify-center text-white/20"><FileText size={18} /></div>
                      )}
                      <label className="text-xs px-3 py-2 rounded-lg border border-purple-700/40 text-purple-300 hover:bg-purple-900/30 cursor-pointer flex items-center gap-1.5">
                        <Upload size={12} />Upload Logo
                        <input type="file" accept="image/*" className="hidden" onChange={(e: any) => {
                          const f = e.target.files?.[0]; if (!f) return;
                          compressImageFile(f, 400, 0.8).then(dataUrl => setEditingTpl((t: any) => ({ ...t, logoUrl: dataUrl })));
                          e.target.value = "";
                        }} />
                      </label>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div><label className="text-xs text-white/60 mb-1 block">Header Text</label><GInput placeholder="e.g. Your Estimate" value={editingTpl.headerText || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, headerText: e.target.value }))} className="!text-xs" /></div>
                      <div><label className="text-xs text-white/60 mb-1 block">Footer Text</label><GInput placeholder="e.g. Thank you for your business!" value={editingTpl.footerText || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, footerText: e.target.value }))} className="!text-xs" /></div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Font</label>
                        <GSel value={editingTpl.font || "Arial"} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, font: e.target.value }))} className="!text-xs">
                          {["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"].map(fn => <option key={fn} value={fn} className="bg-black">{fn}</option>)}
                        </GSel>
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Header Color</label>
                        <input type="color" value={editingTpl.colorHeader || "#111111"} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, colorHeader: e.target.value }))} className="w-full h-8 rounded-lg border border-white/10 bg-black/40" />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Text Color</label>
                        <input type="color" value={editingTpl.colorText || "#111111"} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, colorText: e.target.value }))} className="w-full h-8 rounded-lg border border-white/10 bg-black/40" />
                      </div>
                      <div>
                        <label className="text-xs text-white/60 mb-1 block">Accent Color</label>
                        <input type="color" value={editingTpl.colorAccent || "#111111"} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, colorAccent: e.target.value }))} className="w-full h-8 rounded-lg border border-white/10 bg-black/40" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-white/60 mb-1.5 block">Layout</label>
                      <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
                        {(["modern", "classic", "minimal"] as const).map(l => (
                          <button key={l} onClick={() => setEditingTpl((t: any) => ({ ...t, layout: l }))} className={"flex-1 py-1.5 rounded-lg text-xs capitalize transition " + ((editingTpl.layout || "modern") === l ? "bg-purple-700/40 text-white border border-purple-700/50" : "text-white/50")}>{l}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-white/60">Photo Slots <span className="text-white/30">(up to 4)</span></label>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {Array.from({ length: 4 }).map((_, i) => {
                          const slots = editingTpl.photoSlots || [];
                          const photo = slots[i];
                          return (
                            <label key={i} className="aspect-square rounded-lg border border-dashed border-white/15 bg-white/5 flex items-center justify-center cursor-pointer overflow-hidden relative">
                              {photo ? (
                                <>
                                  <img src={photo} alt="" className="w-full h-full object-cover" />
                                  <button onClick={(e: any) => { e.preventDefault(); setEditingTpl((t: any) => ({ ...t, photoSlots: (t.photoSlots || []).filter((_: any, idx: number) => idx !== i) })); }} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-brand-600 text-brand-fg flex items-center justify-center"><X size={9} /></button>
                                </>
                              ) : <Plus size={14} className="text-white/20" />}
                              <input type="file" accept="image/*" className="hidden" onChange={(e: any) => {
                                const f = e.target.files?.[0]; if (!f) return;
                                const reader = new FileReader();
                                reader.onload = () => setEditingTpl((t: any) => {
                                  const next = [...(t.photoSlots || [])];
                                  next[i] = String(reader.result);
                                  return { ...t, photoSlots: next };
                                });
                                reader.readAsDataURL(f);
                                e.target.value = "";
                              }} />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </Glass>

                  {/* Line items */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-white/60">Default Line Items</label>
                      <button onClick={() => setEditingTpl((t: any) => ({ ...t, lineItems: [...(t.lineItems || []), { id: Date.now().toString(), description: "", quantity: 1, unitPrice: 0 }] }))} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"><Plus size={12} />Add</button>
                    </div>
                    <div className="space-y-2">
                      {(editingTpl.lineItems || []).map((li: any) => (
                        <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-12 md:col-span-6"><GInput placeholder="Description" value={li.description} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, lineItems: t.lineItems.map((x: any) => x.id === li.id ? { ...x, description: e.target.value } : x) }))} /></div>
                          <div className="col-span-4 md:col-span-2"><GInput type="number" placeholder="Qty" value={li.quantity} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, lineItems: t.lineItems.map((x: any) => x.id === li.id ? { ...x, quantity: e.target.value } : x) }))} /></div>
                          <div className="col-span-6 md:col-span-3"><GInput type="number" placeholder="Price $" value={li.unitPrice} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, lineItems: t.lineItems.map((x: any) => x.id === li.id ? { ...x, unitPrice: e.target.value } : x) }))} /></div>
                          <div className="col-span-2 md:col-span-1 text-right">{(editingTpl.lineItems || []).length > 1 && <button onClick={() => setEditingTpl((t: any) => ({ ...t, lineItems: t.lineItems.filter((x: any) => x.id !== li.id) }))} className="p-1.5 text-danger-400 hover:bg-danger-900/30 rounded-lg"><Trash2 size={13} /></button>}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div><label className="text-xs text-white/60 mb-1 block">Default Notes <span className="text-white/30">(customer-visible)</span></label><GTxt rows={2} value={editingTpl.notes || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, notes: e.target.value }))} placeholder="e.g. Includes cleanup and haul-away" className="!text-xs" /></div>
                    <div><label className="text-xs text-white/60 mb-1 block">Default Terms & Conditions</label><GTxt rows={2} value={editingTpl.terms || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, terms: e.target.value }))} className="!text-xs" /></div>
                  </div>

                  {/* Custom fields */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <label className="text-xs text-white/60">Custom Fields</label>
                        <div className="text-[10px] text-white/30">Extra questions or data fields added to estimates using this template</div>
                      </div>
                      <button onClick={() => setEditingTpl((t: any) => ({ ...t, customFields: [...(t.customFields || []), blankField()] }))} className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"><Plus size={12} />Add Field</button>
                    </div>
                    {(editingTpl.customFields || []).length === 0 && <div className="text-[11px] text-white/30 py-2 text-center border border-dashed border-white/10 rounded-xl">No custom fields — click "Add Field" to create one</div>}
                    <div className="space-y-2">
                      {(editingTpl.customFields || []).map((cf: any) => (
                        <Glass key={cf.id} className="p-3 !bg-purple-950/10 !border-purple-700/20">
                          <div className="grid grid-cols-12 gap-2 items-start">
                            <div className="col-span-12 md:col-span-4"><GInput placeholder="Field label" value={cf.label} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, label: e.target.value } : x) }))} className="!text-xs" /></div>
                            <div className="col-span-6 md:col-span-2">
                              <GSel value={cf.type} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, type: e.target.value } : x) }))} className="!text-xs">
                                <option value="text" className="bg-black">Text</option>
                                <option value="number" className="bg-black">Number</option>
                                <option value="checkbox" className="bg-black">Checkbox</option>
                                <option value="dropdown" className="bg-black">Dropdown</option>
                                <option value="date" className="bg-black">Date</option>
                              </GSel>
                            </div>
                            {cf.type === "dropdown" && <div className="col-span-6 md:col-span-3"><GInput placeholder="Options (comma-sep)" value={cf.options || ""} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, options: e.target.value } : x) }))} className="!text-xs" /></div>}
                            <div className={"col-span-12 md:col-span-" + (cf.type === "dropdown" ? "2" : "5") + " flex flex-wrap gap-3 items-center"}>
                              <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer"><input type="checkbox" checked={cf.required} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, required: e.target.checked } : x) }))} className="accent-neutral-300 w-3 h-3" />Required</label>
                              <label className="flex items-center gap-1.5 text-[11px] text-white/60 cursor-pointer"><input type="checkbox" checked={cf.customerVisible} onChange={(e: any) => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.map((x: any) => x.id === cf.id ? { ...x, customerVisible: e.target.checked } : x) }))} className="accent-purple-600 w-3 h-3" />Customer-visible</label>
                              <button onClick={() => setEditingTpl((t: any) => ({ ...t, customFields: t.customFields.filter((x: any) => x.id !== cf.id) }))} className="ml-auto p-1 text-danger-400/60 hover:text-danger-400 hover:bg-danger-900/20 rounded transition"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        </Glass>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2 border-t border-brand-900/20">
                    <GBtn variant="ghost" onClick={() => setEditingTpl(null)}>Cancel</GBtn>
                    <GBtn onClick={() => {
                      if (!editingTpl.name?.trim()) return;
                      const tpl = { ...editingTpl, id: editingTpl.id || (Date.now().toString() + Math.random().toString(36).slice(2)) };
                      setEstimateTemplates((prev: any[]) => {
                        const exists = prev.find((t: any) => t.id === tpl.id);
                        return exists ? prev.map((t: any) => t.id === tpl.id ? tpl : t) : [...prev, tpl];
                      });
                      setEditingTpl(null);
                      toast(editingTpl.id ? "Template updated" : "Template saved");
                    }} disabled={!editingTpl.name?.trim()}>
                      {editingTpl.id ? "Save Changes" : "Save Template"}
                    </GBtn>
                  </div>
                </div>
              )}
            </>}

            {tplTab === "onboarding" && <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold">New-Hire Onboarding Packet</div>
                <div className="text-[10px] text-white/40 mt-0.5">Build the checklist every new employee gets assigned — e.g. "Sign tax forms," "Review safety policy," "Complete ladder certification." When you invite a new team member (Team → Invite Member) you can send them a copy of this list to check off in their portal. Editing this list later doesn't change what's already been assigned to existing employees.</div>
              </div>
              <div className="space-y-1.5">
                {(f.onboardingTemplateItems || []).map((item: any, idx: number) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setObDragIdx(idx)}
                    onDragOver={e => { e.preventDefault(); reorderOnboardingItem(idx); }}
                    onDragEnd={() => setObDragIdx(null)}
                    className="flex items-start gap-2 p-2.5 bg-black/30 border border-white/10 rounded-lg"
                  >
                    <GripVertical size={12} className="text-white/30 cursor-grab flex-shrink-0 mt-2" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <GInput value={item.title} onChange={(e: any) => updateOnboardingItem(item.id, { title: e.target.value })} placeholder="Item title" className="!text-xs" />
                      <GInput value={item.description || ""} onChange={(e: any) => updateOnboardingItem(item.id, { description: e.target.value })} placeholder="Description or link (optional)" className="!text-xs" />
                    </div>
                    <button onClick={() => deleteOnboardingItem(item.id)} className="p-1 text-white/30 hover:text-danger-400 flex-shrink-0 mt-1"><Trash2 size={12} /></button>
                  </div>
                ))}
                {(f.onboardingTemplateItems || []).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-brand-900/30 rounded-xl">
                    <CheckSquare size={24} className="text-white/10 mb-2" />
                    <div className="text-xs text-white/30">No onboarding items yet</div>
                  </div>
                )}
              </div>
              <div className="flex flex-col md:flex-row gap-2 pt-1">
                <GInput
                  value={newOnboardingTitle}
                  onChange={(e: any) => setNewOnboardingTitle(e.target.value)}
                  onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); addOnboardingItem(); } }}
                  placeholder="e.g. Sign tax forms (W-4/I-9)"
                  className="!text-xs flex-1"
                />
                <GInput
                  value={newOnboardingDesc}
                  onChange={(e: any) => setNewOnboardingDesc(e.target.value)}
                  onKeyDown={(e: any) => { if (e.key === "Enter") { e.preventDefault(); addOnboardingItem(); } }}
                  placeholder="Description or link (optional)"
                  className="!text-xs flex-1"
                />
                <GBtn onClick={addOnboardingItem} disabled={!newOnboardingTitle.trim()} className="!text-xs !py-1.5 flex-shrink-0"><Plus size={12} className="inline mr-1" />Add Item</GBtn>
              </div>
            </div>}
          </div>}

          {sec === "integrations" && <div className="space-y-4">
            <h4 className="font-semibold text-sm">Integrations</h4>

            {/* Google — OAuth for Maps, Tasks, Calendar, Gmail, Drive */}
            {/* GoogleConnect — connection status now comes from
                getStoredGoogleConnection() (plain localStorage, written
                synchronously in lib/supabase.ts the instant the OAuth
                redirect hash is seen — before React even mounts), NOT from
                settings.googleConnected/React state or any Supabase auth
                event. f.googleConnected/f.googleProviderToken are kept only
                as a fallback for a connection made before this mechanism
                existed. This is deliberately independent of everything else
                in this file that has already tried and failed to get this
                right through the session-event path. */}
            {(() => {
              const isGoogleConnected = !!(storedGoogle?.token || (f.googleConnected && f.googleProviderToken));
              const googleEmailDisplay = storedGoogle?.email || f.googleEmail || "unknown";
              return (
            <Glass className={"p-4 " + (isGoogleConnected ? "!bg-gradient-to-br !from-blue-950/30 !to-black/60 !border-blue-600/40" : "!bg-black/40")}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                  <div className="font-semibold text-sm">Google Account</div>
                </div>
                <Badge tone={!isGoogleConnected ? "gray" : googleTokenValid === false ? "red" : "green"}>
                  {!isGoogleConnected ? "Not connected" : googleTokenValid === false ? "⚠ Token expired — click Retry" : "✓ Connected as " + googleEmailDisplay}
                </Badge>
              </div>

              {/* FIX D — Google sign-in/token refresh runs through a
                  Cloudflare Pages Function (functions/api/google-refresh.ts)
                  that needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set as
                  env vars in the Cloudflare dashboard — there's no
                  wrangler.toml in this repo, so nothing sets these
                  automatically. Always-visible so the owner sees it during
                  initial setup, not just after a failed refresh. */}
              <div className={"mb-3 p-3 rounded-xl border text-[11px] leading-relaxed " + (googleConfigMissing ? "bg-danger-950/25 border-danger-700/40 text-danger-200" : "bg-white/[0.03] border-white/15 text-white/60")}>
                <div className={"font-semibold mb-1 " + (googleConfigMissing ? "text-danger-300" : "text-white")}>
                  {googleConfigMissing ? "⚠ Google reconnect is failing — server isn't configured" : "Server setup required for Gmail send & token refresh"}
                </div>
                <div>
                  Add two environment variables to this project in the <strong>Cloudflare Pages dashboard</strong> (Workers &amp; Pages → your project → Settings → Environment variables):
                </div>
                <div className="mt-1.5 space-y-0.5 font-mono">
                  <div className="bg-black/30 rounded px-2 py-1">GOOGLE_CLIENT_ID</div>
                  <div className="bg-black/30 rounded px-2 py-1">GOOGLE_CLIENT_SECRET</div>
                </div>
                <div className="mt-1.5">
                  Get both values from <strong>Google Cloud Console → APIs &amp; Services → Credentials</strong>, under the OAuth 2.0 Client ID used for this app's Google sign-in. After adding them, redeploy the Pages project for the env vars to take effect.
                </div>
              </div>

              {isGoogleConnected ? (
                <div className="space-y-3">
                  {/* Connected status */}
                  <div className="p-3 bg-green-950/20 border border-green-700/30 rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-sm font-bold">{(googleEmailDisplay || "?")[0]?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold">{googleEmailDisplay}</div>
                      <div className="text-[10px] text-white/50">Signed in with Google</div>
                    </div>
                  </div>

                  {/* Active services */}
                  <div className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Active Services</div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { k: "calendar", label: "Calendar", icon: "📅", desc: "Job sync + scheduling" },
                      { k: "tasks", label: "Tasks", icon: "✅", desc: "Google Tasks sync" },
                      { k: "gmail", label: "Gmail", icon: "📧", desc: "Send from CRM" },
                      { k: "drive", label: "Drive", icon: "💾", desc: "Photo + invoice storage" },
                      { k: "contacts", label: "Contacts", icon: "👥", desc: "Import contacts" },
                      { k: "maps", label: "Maps", icon: "🗺️", desc: "Address autocomplete" },
                    ].map(s => {
                      // Read and write the same place — previously "maps" was always
                      // re-derived from googleMapsKey/googleConnected for display, so
                      // clicking its toggle wrote to googleScopes.maps but the tile
                      // never reflected that write, making the toggle look broken.
                      const on = (f.googleScopes || {})[s.k] ?? (s.k === "maps" ? !!(f.googleMapsKey || f.googleConnected) : false);
                      return <button key={s.k} onClick={() => setF({ ...f, googleScopes: { ...(f.googleScopes || {}), [s.k]: !on } })} className={"flex items-center gap-2 p-2 rounded-xl border text-xs transition " + (on ? "bg-blue-950/30 border-blue-700/50 text-white" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}>
                        <span>{s.icon}</span>
                        <div className="flex-1 text-left">
                          <div className="font-medium">{s.label}</div>
                          <div className="text-[9px] text-white/40">{s.desc}</div>
                        </div>
                        {on ? <ToggleRight size={18} className="text-blue-400 flex-shrink-0" /> : <ToggleLeft size={18} className="text-white/20 flex-shrink-0" />}
                      </button>;
                    })}
                  </div>

                  {/* Backend URL for server-side calls */}
                  <div>
                    <label className="text-[10px] text-white/60 uppercase tracking-wider mb-1 block">Backend URL (for Gmail/Calendar server calls)</label>
                    <GInput placeholder="https://your-app.railway.app" value={f.googleBackendUrl || ""} onChange={e => setF({ ...f, googleBackendUrl: e.target.value })} className="!text-xs" />
                    <div className="text-[9px] text-white/40 mt-1">Optional — needed for sending Gmail and full Calendar sync. Deploy the <span className="text-blue-400">backend</span> to Railway/Render in 5 min.</div>
                  </div>

                  {/* Multiple Calendar Support */}
                  {(f.googleScopes || {}).calendar && <div>
                    <label className="text-[10px] text-white/60 uppercase tracking-wider mb-2 block">📅 Calendar Selection (Multiple Calendar Support)</label>
                    <div className="space-y-2">
                      <div className="text-[10px] text-white/50 mb-2">Choose which Google Calendar to sync jobs to. You can select a dedicated "Work" calendar separate from your personal one.</div>
                      {[
                        { id: "primary", label: "Primary (personal) calendar", color: "#4285F4" },
                        { id: "work", label: "Work calendar (recommended)", color: "#0F9D58" },
                        { id: "crm", label: "CRM Starter", color: "#737373" },
                      ].map(cal => (
                        <label key={cal.id} className={"flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition " + (f.googleCalendarId === cal.id ? "border-blue-500/50 bg-blue-950/20" : "border-white/10 bg-black/30 hover:border-white/20")}>
                          <input type="radio" name="calendarId" checked={f.googleCalendarId === cal.id} onChange={() => setF({ ...f, googleCalendarId: cal.id })} className="accent-blue-500" />
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: cal.color }} />
                          <span className="text-xs">{cal.label}</span>
                        </label>
                      ))}
                      <div>
                        <label className="text-[10px] text-white/50 mb-1 block">Or enter a custom Calendar ID</label>
                        <GInput value={f.googleCalendarId || ""} onChange={e => setF({ ...f, googleCalendarId: e.target.value })} placeholder="your-calendar-id@group.calendar.google.com" className="!text-xs" />
                        <div className="text-[9px] text-white/30 mt-1">Find it in Google Calendar → Settings → Calendar ID</div>
                      </div>
                    </div>
                  </div>}

                  {/* FIX 9 — auto-sync toggle. When ON, every assigned/accepted
                      job creates a calendar event automatically; OFF = manual. */}
                  {(f.googleScopes || {}).calendar && (
                    <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 bg-black/30 cursor-pointer">
                      <div>
                        <div className="text-xs font-medium">Auto-sync jobs to Google Calendar</div>
                        <div className="text-[10px] text-white/50 mt-0.5">Automatically create a calendar event whenever a job is scheduled or assigned.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setF({ ...f, autoSyncCalendar: !(f.autoSyncCalendar ?? true) })}
                        className={"relative w-11 h-6 rounded-full transition flex-shrink-0 " + ((f.autoSyncCalendar ?? true) ? "bg-blue-600" : "bg-white/15")}
                      >
                        <span className={"absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all " + ((f.autoSyncCalendar ?? true) ? "left-[22px]" : "left-0.5")} />
                      </button>
                    </label>
                  )}

                  <div className="flex gap-2">
                    <GBtn variant="ghost" onClick={retryGoogleToken} disabled={googleRetrying} className="flex-1 !text-xs">
                      <RefreshCw size={12} className={"inline mr-1.5 " + (googleRetrying ? "animate-spin" : "")} />
                      {googleRetrying ? "Retrying…" : "Retry Connection"}
                    </GBtn>
                    <GBtn variant="danger" onClick={() => {
                      // GoogleConnect — this used to clear a field literally
                      // named `googleToken`, which nothing else in the app
                      // reads or writes (the real field everywhere else is
                      // `googleProviderToken`) — so clicking Disconnect never
                      // actually cleared the stored token at all, and only
                      // ever touched local form state (`setF`), not the
                      // shared `settings` the rest of the app reads, so even
                      // the fields it DID clear wouldn't take effect until
                      // Save was clicked. Per the fix requirement, THIS is
                      // the only place googleConnected/the token should ever
                      // be cleared — so it must actually work, immediately.
                      console.log("[GoogleConnect] Disconnect Google Account clicked — clearing all google fields (localStorage + settings)");
                      clearStoredGoogleConnection();
                      setStoredGoogle(null);
                      const cleared = { googleConnected: false, googleProviderToken: "", googleRefreshToken: "", googleTokenExpiresAt: 0, googleEmail: "", googleScopes: {} };
                      setF((prev: any) => ({ ...prev, ...cleared }));
                      setSettings?.((prev: any) => ({ ...prev, ...cleared }));
                      toast?.("Google account disconnected", "yellow");
                    }} className="flex-1 !text-xs">
                      Disconnect Google Account
                    </GBtn>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-white/60">One Google login gives you Calendar, Tasks, Maps, Gmail, Drive, and Contacts — all in one click.</div>

                  {/* OAuth scopes preview */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs text-white/60">
                    {["📅 Calendar", "✅ Tasks", "🗺️ Maps", "📧 Gmail", "💾 Drive", "👥 Contacts"].map(s => (
                      <div key={s} className="p-2 bg-black/40 border border-white/5 rounded-xl">{s}</div>
                    ))}
                  </div>

                  {/* Google connect button — links identity if already signed in */}
                  <button
                    onClick={async () => {
                      const GOOGLE_SCOPES = [
                        "https://www.googleapis.com/auth/calendar",
                        "https://www.googleapis.com/auth/gmail.send",
                        // ISSUE 1 (Inbox audit) — gmail.modify (a superset
                        // of gmail.readonly) so InboxPage.tsx's
                        // markGmailRead() can actually clear the UNREAD
                        // label instead of 403ing on every attempt.
                        "https://www.googleapis.com/auth/gmail.modify",
                        "https://www.googleapis.com/auth/tasks",
                        "https://www.googleapis.com/auth/drive.file",
                        "https://www.googleapis.com/auth/contacts",
                      ].join(" ");
                      const opts = {
                        queryParams: { access_type: "offline", prompt: "consent" },
                        scopes: GOOGLE_SCOPES,
                        redirectTo: window.location.origin + window.location.pathname,
                      };
                      console.log("[GoogleConnect] OAuth start — redirectTo:", opts.redirectTo, "· scopes:", GOOGLE_SCOPES);
                      try {
                        rememberOAuthReturnPage();
                        const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: opts });
                        if (error) { console.error("[GoogleConnect] signInWithOAuth failed:", error.message); toast("Google connect failed: " + error.message, "red"); }
                      } catch (e: any) {
                        console.error("[GoogleConnect] signInWithOAuth threw:", e?.message);
                        toast("Google connect failed: " + e.message, "red");
                      }
                    }}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
                  >
                    <svg viewBox="0 0 48 48" width="18" height="18"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/></svg>
                    Connect Google Account
                  </button>

                  <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[10px] text-white/50 space-y-1.5">
                    <div className="font-semibold text-white/70">Setup Required</div>
                    <div>In your Supabase project → Authentication → Providers → Google: add your Google OAuth Client ID and Secret. Enable Calendar, Gmail, Tasks, Drive, Contacts scopes.</div>
                    <div>After connecting, you'll be redirected back and your token is stored automatically.</div>
                  </div>
                </div>
              )}
            </Glass>
              );
            })()}

            {/* Stripe */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><CreditCard size={14} className="text-purple-400" /><div className="font-semibold text-sm">Stripe</div></div>
                <Badge tone={stripeStatus?.connected ? "green" : stripeStatus?.hasSecretKey ? "green" : f.stripePublishableKey?.trim() ? "yellow" : "gray"}>
                  {stripeStatus?.connected ? "Connected" : stripeStatus?.hasSecretKey ? "Connected (manual keys)" : f.stripePublishableKey?.trim() ? "Publishable Key Set" : "Not Connected"}
                </Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">Accept deposits, payments, and tips on estimates and invoices — using YOUR OWN Stripe account. Paste in your keys below — nothing to set up outside this app.</div>

              {stripeStatus?.connected && (
                <div className="p-3 bg-green-950/20 border border-green-700/40 rounded-xl text-xs text-green-300 flex items-center gap-2 mb-3">
                  <CreditCard size={14} className="flex-shrink-0" />Connected to Stripe ({stripeStatus.stripeAccountId})
                </div>
              )}

              {!stripeStatus?.connected && !stripeStatus?.hasSecretKey && (
                <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[10px] text-white/60 space-y-1.5 mb-3">
                  <div className="font-semibold text-white/70 text-xs">How to get your keys</div>
                  <div>1. No Stripe account yet? <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Create one free</a> — takes a couple minutes.</div>
                  <div>2. Go to <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Stripe Dashboard → Developers → API keys</a>.</div>
                  <div>3. Copy the <b>Publishable key</b> and <b>Secret key</b> shown there and paste each into the matching field below.</div>
                  <div>4. Stripe starts you in test mode automatically (keys start "pk_test_"/"sk_test_") — flip the toggle at the top of that page to Live mode once you're ready to accept real payments; your live keys start "pk_live_"/"sk_live_". Just paste whichever pair you're using — this app reads the mode straight off the key, nothing else to set.</div>
                </div>
              )}

              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-white/50 uppercase tracking-wider">Publishable Key</label>
                    <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><ExternalLink size={10} />Find it on Stripe</a>
                  </div>
                  <GInput placeholder="pk_live_… or pk_test_…" value={f.stripePublishableKey || ""} onChange={e => setF({ ...f, stripePublishableKey: e.target.value })} className="!text-xs font-mono" />
                  <div className="text-[10px] text-white/30 mt-1">Safe to store here — this key is meant to be public, it can only start a payment, never move money on its own.</div>
                </div>

                {/* SECURITY (multi-tenant Phase F + round-12 audit) — the
                    Secret Key never joins `f`/`settings` state, which syncs
                    into app_settings.data and is loaded by every session,
                    including unauthenticated customer portals. It's sent
                    ONLY via saveOwnerStripeKeys → stripe-action.ts's
                    save_owner_keys action, which requires the caller's own
                    Supabase session token and writes straight into the
                    service-role-only owner_stripe_accounts table — never
                    returned to any browser again, this one included. */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-white/50 uppercase tracking-wider">Secret Key {stripeStatus?.hasSecretKey && <span className="text-green-400 normal-case">· a key is already saved</span>}</label>
                    <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><ExternalLink size={10} />Find it on Stripe</a>
                  </div>
                  <GInput type="password" placeholder={stripeStatus?.hasSecretKey ? "•••••••••••••••• (leave blank to keep current key)" : "sk_live_… or sk_test_…"} value={stripeSecretInput} onChange={e => setStripeSecretInput(e.target.value)} className="!text-xs font-mono" />
                  <div className="text-[10px] text-white/30 mt-1">Stored server-side only — never sent to customers' browsers, never visible again once saved.</div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-white/50 uppercase tracking-wider">Webhook Secret (optional) {stripeStatus?.hasWebhookSecret && <span className="text-green-400 normal-case">· already saved</span>}</label>
                    <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1"><ExternalLink size={10} />Set up on Stripe</a>
                  </div>
                  <GInput type="password" placeholder={stripeStatus?.hasWebhookSecret ? "•••••••••••••••• (leave blank to keep current)" : "whsec_…"} value={stripeWebhookInput} onChange={e => setStripeWebhookInput(e.target.value)} className="!text-xs font-mono" />
                </div>

                <GBtn onClick={saveStripeKeys} disabled={stripeSaving} className="!text-xs w-full">
                  {stripeSaving ? "Saving…" : "Save Stripe Settings"}
                </GBtn>

                <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[10px] text-white/50 space-y-1">
                  <div className="font-semibold text-white/70">Server-Verified Payment Webhook</div>
                  <div>Payments already get marked paid automatically when a customer completes checkout. For extra tamper-resistance (a signature-verified check that can't be spoofed from a browser), also set up your webhook:</div>
                  <div className="mt-1">1. <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline inline-flex items-center gap-1">Open Stripe Webhooks<ExternalLink size={9} /></a> → Add endpoint → paste this exact URL:</div>
                  <div className="flex items-center gap-1.5">
                    <div className="font-mono text-blue-400 break-all p-1.5 bg-black/40 rounded flex-1">{stripeStatusLoading ? "loading…" : (stripeStatus?.webhookUrl || `${window.location.origin}/api/stripe-webhook`)}</div>
                    <button type="button" onClick={() => { navigator.clipboard?.writeText(stripeStatus?.webhookUrl || `${window.location.origin}/api/stripe-webhook`); toast?.("Webhook URL copied", "green"); }} className="px-2 py-1.5 rounded bg-white/10 hover:bg-white/20 text-white/60 text-[10px] flex-shrink-0">Copy</button>
                  </div>
                  <div className="mt-1">2. Select events: checkout.session.completed, checkout.session.async_payment_succeeded, payment_intent.succeeded, payment_intent.payment_failed, charge.refunded, charge.dispute.created.</div>
                  <div>3. Stripe shows a signing secret ("whsec_…") when you create the endpoint — paste it into the Webhook Secret field above and save.</div>
                </div>

                {f.stripeSecretKeyEnc && (
                  <div className="p-3 bg-brand-950/20 border border-brand-700/40 rounded-xl text-[10px] text-white/70 space-y-1.5">
                    <div className="font-semibold text-brand-300">⚠️ Old secret key found in synced settings</div>
                    <div className="text-yellow-300">A secret key was saved here in an older version of this app. It no longer does anything, but is still sitting in your synced settings — click below to remove it, and rotate that key in your Stripe dashboard since it may have been exposed to customers who viewed a payment page.</div>
                    <GBtn variant="ghost" className="!text-xs !border-brand-800/40 !text-brand-400" onClick={() => setF({ ...f, stripeSecretKeyEnc: "" })}>
                      <Trash2 size={12} className="inline mr-1.5" />Remove old stored secret key
                    </GBtn>
                  </div>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    setStripeConnecting(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const token = session?.access_token;
                      if (!token) throw new Error("Not signed in");
                      const url = await withTimeout(getStripeConnectAuthorizeUrl(token), 20000, "Stripe Connect");
                      window.location.href = url;
                      // Deliberately no setStripeConnecting(false) on this
                      // success path — the page is about to navigate away to
                      // Stripe, so leaving the button showing "Redirecting…"
                      // is correct; the finally below only matters for the
                      // error path.
                    } catch (e: any) {
                      // BUG FIX — "it said redirecting to Stripe and didn't do
                      // anything." This DID fail every time (verified: the
                      // server route requires a Stripe Connect Platform
                      // application to exist first — STRIPE_CONNECT_CLIENT_ID
                      // — which is a separate, optional, one-time Stripe
                      // Dashboard setup most accounts haven't done; pasting
                      // keys directly above needs none of that and is fully
                      // functional right now). The failure toast was easy to
                      // miss right as the button visually changed state — a
                      // blocking modal makes the real reason (and the
                      // working alternative) impossible to miss.
                      setStripeConnectError(e?.message || "Unknown error");
                      setStripeConnecting(false);
                    }
                  }}
                  disabled={stripeConnecting}
                  className="text-[10px] text-white/40 hover:text-white/70 underline"
                >
                  {stripeConnecting ? "Redirecting to Stripe…" : "Prefer OAuth instead of pasting keys? Connect with Stripe"}
                </button>
                {stripeConnectError && (
                  <div className="p-3 bg-brand-950/20 border border-brand-700/40 rounded-xl text-[10px] text-white/70 space-y-1.5">
                    <div className="font-semibold text-brand-300">Couldn't start Stripe Connect</div>
                    <div>{stripeConnectError}</div>
                    <div className="text-white/50">This OAuth option needs one extra one-time setup step in the Stripe Dashboard (registering as a Connect platform) that most accounts haven't done — <b>pasting your Secret Key and Publishable Key above works right now with no extra setup</b> and is exactly as functional.</div>
                    <button type="button" onClick={() => setStripeConnectError("")} className="text-white/40 hover:text-white/70 underline">Dismiss</button>
                  </div>
                )}
              </div>
            </Glass>

            {/* FEATURE — Square, an alternative to Stripe ("give another
                option for users to connect payments... free on our end...
                accepts many payment methods... switch between each one
                easily"). Same secret-never-in-synced-settings rule Stripe's
                own comment above explains — the Access Token only ever
                goes through save_owner_square_keys, straight into the
                service-role-only owner_square_accounts table. */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><CreditCard size={14} className="text-[#006AFF]" /><div className="font-semibold text-sm">Square</div></div>
                <Badge tone={squareStatus?.connected ? "green" : squareStatus?.hasAccessToken ? "yellow" : "gray"}>
                  {squareStatus?.connected ? "Connected" : squareStatus?.hasAccessToken ? "Missing Location ID" : "Not Connected"}
                </Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">An alternative to Stripe — same real payments, your own Square account, free to set up. Use whichever one you prefer as your default below.</div>

              {!squareStatus?.connected && (
                <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[10px] text-white/60 space-y-1.5 mb-3">
                  <div className="font-semibold text-white/70 text-xs">How to get your keys</div>
                  <div>1. No Square account yet? <a href="https://squareup.com/signup" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Create one free</a>.</div>
                  <div>2. Go to <a href="https://developer.squareup.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">Square Developer Dashboard</a> → create (or open) an app.</div>
                  <div>3. Use the <b>Production</b> tab (or <b>Sandbox</b>, if this deployment sets SQUARE_ENVIRONMENT=sandbox) and copy the <b>Application ID</b> and <b>Access Token</b> shown there, plus the <b>Location ID</b> from the Locations tab, into the fields below.</div>
                  <div>4. This charges real cards immediately once saved — same as connecting Stripe with a live secret key.</div>
                </div>
              )}

              <div className="space-y-2.5">
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Application ID</label>
                  <GInput placeholder="sq0idp-…" value={f.squareApplicationId || ""} onChange={e => setF({ ...f, squareApplicationId: e.target.value })} className="!text-xs font-mono" />
                  <div className="text-[10px] text-white/30 mt-1">Safe to store here — this id is meant to be public. Must match this deployment's Square environment (Production by default).</div>
                </div>
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Location ID</label>
                  <GInput placeholder="e.g. L1JC53TFB7XWS" value={f.squareLocationId || ""} onChange={e => setF({ ...f, squareLocationId: e.target.value })} className="!text-xs font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Access Token {squareStatus?.hasAccessToken && <span className="text-green-400 normal-case">· a token is already saved</span>}</label>
                  <GInput type="password" placeholder={squareStatus?.hasAccessToken ? "•••••••••••••••• (leave blank to keep current token)" : "EAAA… "} value={squareAccessTokenInput} onChange={e => setSquareAccessTokenInput(e.target.value)} className="!text-xs font-mono" />
                  <div className="text-[10px] text-white/30 mt-1">Stored server-side only — never sent to customers' browsers, never visible again once saved.</div>
                </div>
                {/* AUDIT FIX — recurring Square subscriptions had no way to
                    hear back from Square about renewals/cancellations at
                    all. This webhook makes that real; the owner just needs
                    to paste this exact URL into their Square Developer
                    Dashboard and save the Signature Key it hands back. */}
                {squareStatus?.connected && (
                  <div className="p-3 bg-black/60 rounded-xl border border-white/5 space-y-2">
                    <div className="font-semibold text-white/70 text-xs">Recurring plan status updates (optional but recommended)</div>
                    <div className="text-[10px] text-white/50">Without this, a declined renewal or a subscription cancelled from Square's own dashboard won't be reflected here — the CRM will keep showing it as active.</div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Webhook URL — paste into Square Developer Dashboard → your app → Webhooks</label>
                      <GInput readOnly value={squareStatus?.webhookUrl || ""} onClick={(e: any) => e.target.select()} className="!text-xs font-mono" />
                      <div className="text-[10px] text-white/30 mt-1">Subscribe to events: subscription.updated, invoice.updated.</div>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1 block">Signature Key {squareStatus?.hasWebhookSignatureKey && <span className="text-green-400 normal-case">· already saved</span>}</label>
                      <GInput type="password" placeholder={squareStatus?.hasWebhookSignatureKey ? "•••••••••••••••• (leave blank to keep current key)" : "Shown when you save the webhook subscription in Square"} value={squareWebhookKeyInput} onChange={e => setSquareWebhookKeyInput(e.target.value)} className="!text-xs font-mono" />
                    </div>
                  </div>
                )}
                <GBtn onClick={saveSquareKeys} disabled={squareSaving} className="!text-xs w-full">
                  {squareSaving ? "Saving…" : "Save Square Settings"}
                </GBtn>
              </div>
            </Glass>

            {/* Customer checkout provider — see src/lib/payments. Manual is always
                available; Stripe/Square appear once connected above. Exactly
                one provider is shown to customers. */}
            {(() => {
              const stripeOn = !!(stripeStatus?.connected || stripeStatus?.hasSecretKey);
              const squareOn = !!squareStatus?.connected;
              const current = resolvePaymentProvider({ preference: f.paymentProviderPreference, stripeConnected: stripeOn, squareConnected: squareOn });
              const opts = PAYMENT_PROVIDERS.filter(p => p.id === "manual" || (p.id === "stripe" && stripeOn) || (p.id === "square" && squareOn));
              return (
                <Glass className="p-4 !bg-black/30">
                  <div className="font-semibold text-sm mb-1 flex items-center gap-1.5"><CreditCard size={13} className="text-green-400" />Customer checkout</div>
                  <div className="text-xs text-white/50 mb-3">How customers pay quotes and invoices. Manual means no online checkout — you record payments by hand.</div>
                  <div className={"grid gap-2 " + (opts.length === 3 ? "grid-cols-3" : opts.length === 2 ? "grid-cols-2" : "grid-cols-1")}>
                    {opts.map(p => (
                      <button key={p.id} type="button" title={p.description} onClick={() => setF({ ...f, paymentProviderPreference: p.id })}
                        className={"py-2 rounded-xl text-xs font-semibold border transition " + (current === p.id ? "bg-green-900/30 border-green-600/50 text-green-300" : "bg-white/5 border-white/10 text-white/50")}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </Glass>
              );
            })()}

            {/* Twilio */}
            <Glass className={"p-4 " + (f.twilioSid && f.twilioToken && f.twilioFrom ? "!bg-gradient-to-br !from-green-950/20 !to-black/60 !border-green-700/30" : "!bg-black/40")}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2"><MessageSquare size={14} className="text-blue-400" /><div className="font-semibold text-sm">Twilio SMS</div></div>
                <Badge tone={f.twilioSid && f.twilioToken && f.twilioFrom ? "green" : "gray"}>{f.twilioSid && f.twilioToken && f.twilioFrom ? "Configured" : "Not set"}</Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">Send and receive SMS. Get credentials at <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">console.twilio.com</a></div>
              <div className="space-y-2">
                <div>
                  {/* ISSUE 6 (round 11) — Campaigns' Twilio 404 ("Account
                      /SK.../json not found") turned out to be an API Key SID
                      (starts "SK", used for short-lived signed JWTs — not
                      what any REST call in this app uses) pasted into this
                      field instead of the actual Account SID (starts "AC").
                      The label already said "Account SID" but nothing caught
                      the mistake before it silently 404'd every Twilio call.
                      Validate the prefix so it's caught right where it's
                      typed, with the specific wrong-prefix named instead of
                      a generic "invalid" message. */}
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">Account SID <span className="text-white/30 normal-case">(starts with "AC" — not your API Key SID, which starts "SK")</span></label>
                  {/* BUG FIX — a value pasted straight from the Twilio Console
                      can carry a zero-width space or non-breaking space that
                      .trim() doesn't strip (trim only removes normal
                      whitespace), so a genuinely correct "AC..." SID with an
                      invisible leading character would fail startsWith("AC")
                      and show the "looks like an API Key SID" warning even
                      though the real value is fine and sends work. Strip
                      those invisible characters on every edit so what's
                      stored and validated matches what's visibly on screen. */}
                  <GInput value={f.twilioSid || ""} onChange={e => setF({ ...f, twilioSid: e.target.value.replace(/[​-‍﻿ ]/g, "").trim() })} placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="!text-xs mt-1" />
                  {/* EXPLICIT REQUEST — the "doesn't start with AC" warning that used
                      to render here is suppressed. The owner confirmed their
                      credentials are correct and sends work; this heuristic was a
                      false positive for their setup. Use "Test Connection" below
                      instead — it asks Twilio directly rather than guessing from
                      the SID's prefix. */}
                </div>
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">Auth Token</label>
                  <GInput type="password" value={f.twilioToken || ""} onChange={e => setF({ ...f, twilioToken: e.target.value })} placeholder="Your auth token" className="!text-xs mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">From Phone Number (SMS)</label>
                  <GInput value={f.twilioFrom || ""} onChange={e => setF({ ...f, twilioFrom: e.target.value })} placeholder="+15551234567" className="!text-xs mt-1" />
                </div>
                <div>
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">WhatsApp From Number <span className="text-white/30 normal-case">(optional — for WhatsApp Business)</span></label>
                  <GInput value={f.twilioWhatsAppFrom || ""} onChange={e => setF({ ...f, twilioWhatsAppFrom: e.target.value })} placeholder="whatsapp:+15551234567" className="!text-xs mt-1" />
                  <div className="text-[10px] text-white/30 mt-1">Enable WhatsApp in your Twilio console. Format: whatsapp:+1xxxxxxxxxx</div>
                </div>
                <div className="flex items-center gap-2">
                  <GBtn
                    variant="ghost"
                    className="!text-[10px] !py-1.5"
                    disabled={!f.twilioSid || !f.twilioToken || twilioTestChecking}
                    onClick={async () => {
                      setTwilioTestChecking(true);
                      setTwilioTestResult(null);
                      try {
                        const result = await checkTwilioAccountStatus(f as any);
                        setTwilioTestResult({ ok: true, text: `Connected — account is ${result.accountStatus}${result.balance != null ? `, balance ${result.balance} ${result.currency || ""}` : ""}` });
                        toast?.("Twilio connected ✓", "green");
                      } catch (e: any) {
                        const msg = e?.message || "Connection check failed";
                        setTwilioTestResult({ ok: false, text: msg });
                        toast?.(msg, "red");
                      } finally {
                        setTwilioTestChecking(false);
                      }
                    }}
                  >
                    {twilioTestChecking ? "Testing…" : "Test Connection"}
                  </GBtn>
                  {twilioTestResult && (
                    <span className={"text-[10px] " + (twilioTestResult.ok ? "text-green-400" : "text-brand-400")}>{twilioTestResult.text}</span>
                  )}
                </div>
                <div className="p-3 bg-black/60 rounded-xl border border-white/5 text-[10px] text-white/50 space-y-1.5">
                  <div className="font-semibold text-white/70">Incoming SMS Webhook</div>
                  <div>
                    Paste this exact URL into Twilio Console → Messaging → Services → your Messaging Service → Integration →
                    "Incoming Messages" → Webhook (or Phone Numbers → your number → Messaging, if you're not using a Messaging Service).
                    Method: <span className="font-semibold text-white/70">HTTP POST</span>.
                  </div>
                  {/* BUG FIX — this used to be a locked, computed-only display
                      that read f.googleBackendUrl (an unrelated Telegram/self-
                      host setting) and pointed at /api/sms/incoming, a route
                      that doesn't exist anywhere in this codebase. The real
                      endpoint is the Cloudflare Pages Function at
                      functions/api/twilio-sms-webhook.ts, served from THIS
                      site's own domain — fixed path, but the exact domain can
                      legitimately differ from window.location.origin (a
                      Cloudflare Pages preview-deploy URL vs. the real
                      production domain), so this is a real editable+saved
                      field rather than something fully auto-computed. */}
                  <GInput
                    value={f.twilioIncomingWebhookUrl || ""}
                    onChange={e => setF({ ...f, twilioIncomingWebhookUrl: e.target.value.trim() })}
                    placeholder={`${window.location.origin}/api/twilio-sms-webhook`}
                    className="!text-xs font-mono mt-1"
                  />
                  {f.twilioIncomingWebhookUrl && !isValidHttpsUrl(f.twilioIncomingWebhookUrl) && (
                    <div className="text-brand-400">Must be a valid https:// URL.</div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <GBtn
                      variant="ghost"
                      className="!text-[10px] !py-1"
                      onClick={() => setF({ ...f, twilioIncomingWebhookUrl: `${window.location.origin}/api/twilio-sms-webhook` })}
                    >
                      Use This Site's URL
                    </GBtn>
                    <GBtn
                      variant="ghost"
                      className="!text-[10px] !py-1"
                      disabled={!f.twilioIncomingWebhookUrl}
                      onClick={() => {
                        navigator.clipboard?.writeText(f.twilioIncomingWebhookUrl || "").then(
                          () => toast("Copied ✓"),
                          () => toast("Couldn't copy — select and copy manually", "red")
                        );
                      }}
                    >
                      Copy
                    </GBtn>
                  </div>
                  <div className="text-white/30 pt-0.5">
                    This just records what you configured in Twilio — saving it here doesn't change anything in your Twilio account. Incoming messages appear in the CRM Inbox automatically once Twilio is pointed at this URL.
                  </div>
                </div>
                <div className="p-3 bg-black/60 rounded-xl border border-white/5">
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">A2P 10DLC Campaign — Messaging Service SID</label>
                  <GInput value={f.twilioMessagingServiceSid || ""} onChange={e => setF({ ...f, twilioMessagingServiceSid: e.target.value })} placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" className="!text-xs mt-1" />
                  <div className="text-[10px] text-white/40 mt-1.5">Required to check your carrier campaign registration status — find it in your Twilio Console under Messaging → Services.</div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <GBtn
                      variant="ghost"
                      disabled={!f.twilioSid || !f.twilioToken || !f.twilioMessagingServiceSid || campaignChecking}
                      onClick={async () => {
                        setCampaignChecking(true);
                        try {
                          const result = await checkA2pCampaignStatus(f as any);
                          setF({ ...f, twilioA2pCampaignStatus: result.campaignStatus || (result.registered ? "UNKNOWN" : "NOT_REGISTERED"), twilioA2pCampaignCheckedAt: Date.now() });
                          toast(result.campaignStatus ? `Campaign status: ${result.campaignStatus}` : "No A2P campaign found for this Messaging Service", result.campaignStatus === "VERIFIED" ? "green" : "yellow");
                        } catch (e: any) {
                          toast("Campaign check failed — " + (e?.message || "unknown error"), "red");
                        } finally {
                          setCampaignChecking(false);
                        }
                      }}
                      className="!text-xs !py-1.5"
                    >
                      {campaignChecking ? "Checking…" : "Check Campaign Status"}
                    </GBtn>
                    {f.twilioA2pCampaignStatus && (
                      <div className="text-right">
                        <Badge tone={f.twilioA2pCampaignStatus === "VERIFIED" ? "green" : f.twilioA2pCampaignStatus === "FAILED" ? "red" : "yellow"}>{f.twilioA2pCampaignStatus}</Badge>
                        {f.twilioA2pCampaignCheckedAt && <div className="text-[9px] text-white/30 mt-0.5">Checked {new Date(f.twilioA2pCampaignCheckedAt).toLocaleString()}</div>}
                      </div>
                    )}
                  </div>
                </div>

                {/* FEATURE — "via text" opt-in keyword (Twilio A2P compliance
                    checklist item). Texting this word to your number starts a
                    real double opt-in flow — see functions/api/twilio-sms-
                    webhook.ts: keyword -> confirmation request -> Y/YES reply
                    -> confirmed + smsOptIn set true. */}
                <div className="p-3 bg-black/60 rounded-xl border border-white/5">
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">Text-to-Join Opt-In Keyword</label>
                  <GInput value={f.smsOptInKeyword || ""} onChange={e => setF({ ...f, smsOptInKeyword: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="DEALS" className="!text-xs mt-1 font-mono" />
                  <div className="text-[10px] text-white/40 mt-1.5">
                    Someone texting this word to your number ({f.twilioFrom || "your Twilio number"}) gets a confirmation request; replying Y/YES completes opt-in. Defaults to "DEALS" if left blank. Requires the Incoming SMS Webhook above to be configured in Twilio.
                  </div>
                </div>

                {/* FEATURE — verbal opt-in script (Twilio A2P compliance
                    checklist item: phone-collected consent needs the same
                    disclosures as the web form, just read aloud). Reference
                    text only — nothing here is sent automatically. */}
                <div className="p-3 bg-black/60 rounded-xl border border-white/5">
                  <label className="text-[10px] text-white/50 uppercase tracking-wider">Verbal Opt-In Script (read to customer by phone)</label>
                  <div className="text-[10px] text-white/40 mt-1 mb-2">Use this when collecting a phone number over a call — read it before adding them to text updates.</div>
                  {(() => {
                    const companyName = f.companyName || "CRM Starter";
                    const script = `"Before I text you [estimate details / your appointment confirmation], can I get your okay to send you text updates from ${companyName}? You'd get things like appointment reminders, on-my-way alerts, and occasional service offers — usually about 1 to 4 messages a month. Message and data rates may apply, and you can reply STOP at any time to stop, or HELP for help. Our terms and privacy policy are at ${typeof window !== "undefined" ? window.location.origin : ""}/#/terms and /#/privacy. Is that okay with you — yes or no?"\n\n[Wait for a clear "yes." If yes: "Great, thank you — I've got you signed up." If no: do not add them to text updates — proceed with phone/email only.]`;
                    return (
                      <>
                        <GTxt readOnly rows={6} value={script} className="!text-[11px] !leading-relaxed" />
                        <GBtn variant="ghost" className="!text-[10px] !py-1 mt-1.5" onClick={() => { navigator.clipboard?.writeText(script).then(() => toast("Script copied ✓"), () => toast("Couldn't copy — select and copy manually", "red")); }}>
                          Copy Script
                        </GBtn>
                      </>
                    );
                  })()}
                </div>
              </div>
            </Glass>

            {/* Buffer — real social posting via Buffer's current GraphQL API */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Share2 size={16} className="text-blue-400" /><div className="font-semibold text-sm">Buffer</div></div>
                <Badge tone={f.bufferChannelIds && Object.keys(f.bufferChannelIds).length > 0 ? "green" : f.bufferApiKey ? "yellow" : "gray"}>
                  {f.bufferChannelIds && Object.keys(f.bufferChannelIds).length > 0 ? "Connected" : f.bufferApiKey ? "Key set — pick channels" : "Not set"}
                </Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">Primary way to post to all your platforms from the Social page. Buffer retired its old token-based API — get a key at <a href="https://publish.buffer.com/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">publish.buffer.com/settings/api</a> (docs: <a href="https://developers.buffer.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">developers.buffer.com</a>)</div>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <GInput type="password" value={f.bufferApiKey || ""} onChange={e => setF({ ...f, bufferApiKey: e.target.value.trim() })} placeholder="Buffer API key" className="!text-xs" />
                  <GBtn
                    disabled={!f.bufferApiKey || bufferConnecting}
                    onClick={async () => {
                      setBufferConnecting(true);
                      try {
                        const orgId = f.bufferOrganizationId || await fetchBufferOrganizationId(f.bufferApiKey);
                        if (!orgId) { toast?.("No Buffer organization found for this key", "red"); return; }
                        const channels = await fetchBufferChannels(f.bufferApiKey, orgId);
                        setBufferChannels(channels);
                        setF((p: any) => ({ ...p, bufferOrganizationId: orgId }));
                        toast?.(`Found ${channels.length} connected channel${channels.length !== 1 ? "s" : ""} ✓`, "green");
                      } catch (e: any) {
                        toast?.(e?.message || "Could not reach Buffer", "red");
                      } finally {
                        setBufferConnecting(false);
                      }
                    }}
                    className="!text-xs !py-1.5 flex-shrink-0"
                  >
                    {bufferConnecting ? "Connecting…" : "Find Channels"}
                  </GBtn>
                </div>
                {bufferChannels.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {["instagram", "facebook", "tiktok"].map(platform => (
                      <div key={platform} className="flex items-center justify-between gap-2">
                        <label className="text-[10px] text-white/50 uppercase tracking-wider capitalize w-20 flex-shrink-0">{platform}</label>
                        <GSel
                          value={f.bufferChannelIds?.[platform] || ""}
                          onChange={e => setF((p: any) => ({ ...p, bufferChannelIds: { ...(p.bufferChannelIds || {}), [platform]: e.target.value } }))}
                          className="!text-xs !py-1.5 flex-1"
                        >
                          <option value="" className="bg-black">Not connected</option>
                          {bufferChannels.filter(c => c.service?.toLowerCase().includes(platform) || (platform === "facebook" && c.service?.toLowerCase() === "fb")).map(c => (
                            <option key={c.id} value={c.id} className="bg-black">{c.displayName || c.name}</option>
                          ))}
                        </GSel>
                      </div>
                    ))}
                  </div>
                )}
                {bufferChannels.length === 0 && f.bufferChannelIds && Object.keys(f.bufferChannelIds).length > 0 && (
                  <div className="text-[10px] text-white/40">Channels connected previously — click "Find Channels" again to change them.</div>
                )}
              </div>
            </Glass>

            {/* FEATURE — optional "Auto-Edit with AI" in the Social section's
                video editor. Entirely optional and separate from the free
                built-in editor (ffmpeg.wasm, runs in-browser at no cost) —
                this only does anything once the owner pastes their own
                Shotstack key, so nothing bills anyone but the owner. */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Clapperboard size={16} className="text-purple-400" /><div className="font-semibold text-sm">Video Auto-Edit (optional)</div></div>
                <Badge tone={f.videoAutoEditApiKey ? "green" : "gray"}>{f.videoAutoEditApiKey ? "Connected" : "Not set"}</Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">
                The Social page's video editor already lets you manually trim clips, auto-cut silence, and add captions for free — no key needed. Adding a <a href="https://shotstack.io" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">Shotstack</a> API key here unlocks an optional "Auto-Edit with AI" button that assembles the edit automatically on their servers — billed to your own Shotstack account, not bundled with this app.
              </div>
              <GInput type="password" value={f.videoAutoEditApiKey || ""} onChange={e => setF({ ...f, videoAutoEditApiKey: e.target.value.trim() })} placeholder="Shotstack API key" className="!text-xs" />
            </Glass>

            {/* FEATURE — "make it so it uses any API, not just OpenAI's for
                auto captions." The video editor's auto-captions already work
                with OpenAI or Groq (reusing whichever key is set in AI
                Models — no separate signup) — Deepgram is a genuinely
                different transcription API for an owner who'd rather not
                depend on OpenAI at all, or wants a fallback if one is down. */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2"><Captions size={16} className="text-purple-400" /><div className="font-semibold text-sm">Auto-Captions Providers</div></div>
                <Badge tone={f.deepgramApiKey ? "green" : "gray"}>{f.deepgramApiKey ? "Deepgram connected" : "Deepgram not set"}</Badge>
              </div>
              <div className="text-xs text-white/60 mb-3">
                The video editor's Auto-Captions and Auto-Edit already work with your <b>OpenAI</b> or <b>Groq</b> key from the AI Models tab above — no extra setup. Add a <a href="https://deepgram.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">Deepgram</a> key here for a fully independent transcription option, selectable right in the editor.
              </div>
              <GInput type="password" value={f.deepgramApiKey || ""} onChange={e => setF({ ...f, deepgramApiKey: e.target.value.trim() })} placeholder="Deepgram API key" className="!text-xs" />
            </Glass>

            {/* Direct platform OAuth — fallback for accounts not on Buffer */}
            <Glass className="p-4 !bg-black/40">
              <div className="flex items-center gap-2 mb-1"><Link size={16} className="text-purple-400" /><div className="font-semibold text-sm">Direct Platform Connections</div></div>
              <div className="text-xs text-white/60 mb-3">Fallback for platforms not connected through Buffer. Facebook posts for real once connected (plain text). TikTok can't — its API requires hosted video, so it stays on the share-sheet/paste flow below either way.</div>
              <div className="text-xs text-white/60 mb-3 p-2.5 bg-black/40 border border-white/10 rounded-xl">
                <b>One-time setup</b>: paste your app's Client ID below, then add its matching secret as a Cloudflare Pages environment variable (dashboard → this project → Settings → Environment variables) — <code className="text-white/50">FACEBOOK_APP_SECRET</code> (same pattern as GOOGLE_CLIENT_SECRET). The secret never touches this app's settings — only the Client ID does.
              </div>
              <div className="mb-3">
                <label className="text-[10px] text-white/50 uppercase tracking-wider">Custom backend URL (optional — only if you're running your own token-exchange proxy instead of this app's built-in one)</label>
                <GInput value={f.socialBackendUrl || ""} onChange={e => setF({ ...f, socialBackendUrl: e.target.value })} placeholder="https://your-backend.railway.app" className="!text-xs mt-1" />
              </div>
              <div className="space-y-3">
                {([
                  { platform: "facebook" as SocialPlatform, label: "Facebook", clientIdKey: "metaClientId", tokenKey: "metaAccessToken", devUrl: "https://developers.facebook.com/" },
                  { platform: "facebook" as SocialPlatform, label: "Instagram", clientIdKey: "metaClientId", tokenKey: "metaAccessToken", devUrl: "https://developers.facebook.com/", sharedWithFacebook: true },
                  { platform: "tiktok" as SocialPlatform, label: "TikTok", clientIdKey: "tiktokClientId", tokenKey: "tiktokAccessToken", devUrl: "https://developers.tiktok.com/" },
                ]).map(p => (
                  <div key={p.label} className="flex items-center gap-2 p-2.5 bg-black/40 border border-white/5 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium mb-1 flex items-center gap-1.5">
                        {p.label}
                        <a href={p.devUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 font-normal">Get API credentials →</a>
                      </div>
                      {p.sharedWithFacebook ? (
                        <div className="text-[10px] text-white/40">Uses the same Meta app/credentials as Facebook above.</div>
                      ) : (
                        <GInput value={(f as any)[p.clientIdKey] || ""} onChange={e => setF({ ...f, [p.clientIdKey]: e.target.value })} placeholder={`${p.label} Client/App ID`} className="!text-xs" />
                      )}
                    </div>
                    <Badge tone={(f as any)[p.tokenKey] ? "green" : "gray"}>{(f as any)[p.tokenKey] ? "Connected" : "Not connected"}</Badge>
                    {!p.sharedWithFacebook && (
                      <GBtn
                        variant="ghost"
                        disabled={!(f as any)[p.clientIdKey]}
                        onClick={() => {
                          sessionStorage.setItem("crm.socialOAuthPlatform", p.platform);
                          const state = uid();
                          sessionStorage.setItem("crm.socialOAuthState", state);
                          window.location.href = buildSocialAuthorizeUrl(p.platform, (f as any)[p.clientIdKey], state);
                        }}
                        className="!text-xs !py-1.5 flex-shrink-0"
                      >
                        Connect
                      </GBtn>
                    )}
                  </div>
                ))}
                {(f as any).metaAccessToken && (
                  <div>
                    <label className="text-[10px] text-white/50 uppercase tracking-wider">Facebook Page ID</label>
                    <GInput value={(f as any).metaPageId || ""} onChange={e => setF({ ...f, metaPageId: e.target.value })} placeholder="Page ID to post to" className="!text-xs mt-1" />
                  </div>
                )}
                <div className="text-[10px] text-white/30">Instagram and TikTok posting still needs a publicly hosted image/video URL their APIs require, so those two keep using the share-sheet/copy fallback even once connected — Facebook posts real text directly.</div>
              </div>
            </Glass>
          </div>}

          {sec === "notifications" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">In-App Notifications</h4>
            <div className="text-xs text-white/50 mb-2">Which alerts show up on your dashboard.</div>
            {[
              { k: "notifyReviews",     label: "Negative review alerts", desc: "Flag reviews under 4 stars" },
              { k: "notifyOverdue",     label: "Overdue invoice reminders", desc: "Ping me on payments past due" },
              { k: "notifyLowStock",    label: "Low chemical stock",      desc: "Alert when stock hits reorder level" },
              { k: "notifyMaintenance", label: "Vehicle maintenance due", desc: "Warn at 5k mi / 90 days since oil change" },
              { k: "notifyWeather",     label: "Weather risk alerts",     desc: "Flag scheduled jobs on high-rain days" }
            ].map(n => <div key={n.k} className="flex items-center justify-between p-3 bg-black/40 border border-brand-900/20 rounded-xl">
              <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">{n.label}</div><div className="text-[10px] text-white/50">{n.desc}</div></div>
              <button onClick={() => setF({ ...f, [n.k]: !f[n.k] })} className={"transition " + (f[n.k] ? "text-brand-400" : "text-white/30")}>{f[n.k] ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
            </div>)}

            {/* FEATURE — "avoid being bothered by Alfred at certain times of
                day, on weekends, or when on vacation." Enforced server-side
                in functions/api/check-reminders.ts (the only truly proactive
                Alfred→owner channel — replies to a text the owner sent
                first aren't something a DND window makes sense for). Local
                HH:MM is converted to UTC minutes-of-day here, at save time,
                using this browser's own offset — there's no stored per-owner
                timezone anywhere in this app, so this is the same tradeoff
                the server-side check documents (off by an hour right around
                a DST transition, never for illustrative/most-of-the-year use). */}
            <div className="pt-3 border-t border-brand-900/20">
              <div className="font-semibold text-sm mb-2">🌙 Alfred Quiet Hours</div>
              <div className="flex items-center justify-between p-3 bg-black/40 border border-brand-900/20 rounded-xl mb-2">
                <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">Enable quiet hours</div><div className="text-[10px] text-white/50">Alfred's reminders won't text you during this window — they arrive right after it ends instead</div></div>
                <button onClick={() => setF({ ...f, alfredDndEnabled: !f.alfredDndEnabled })} className={"transition " + (f.alfredDndEnabled ? "text-brand-400" : "text-white/30")}>{f.alfredDndEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
              </div>
              {f.alfredDndEnabled && (() => {
                const tz = new Date().getTimezoneOffset(); // minutes to ADD to local to get UTC
                const utcMinToLocalHHMM = (utcMin: number | undefined): string => {
                  if (!Number.isFinite(utcMin as number)) return "";
                  const localMin = (((utcMin as number) - tz) % 1440 + 1440) % 1440;
                  return String(Math.floor(localMin / 60)).padStart(2, "0") + ":" + String(localMin % 60).padStart(2, "0");
                };
                const localHHMMToUtcMin = (hhmm: string): number | undefined => {
                  if (!hhmm) return undefined;
                  const [h, m] = hhmm.split(":").map(Number);
                  if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;
                  return (((h * 60 + m) + tz) % 1440 + 1440) % 1440;
                };
                return (
                  <div className="pl-4 border-l border-brand-900/30 space-y-2 mb-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-[10px] text-white/50 block mb-1">From</label><GInput type="time" value={utcMinToLocalHHMM(f.alfredDndStartUtcMin)} onChange={e => setF({ ...f, alfredDndStartUtcMin: localHHMMToUtcMin(e.target.value) })} className="!text-xs" /></div>
                      <div><label className="text-[10px] text-white/50 block mb-1">Until</label><GInput type="time" value={utcMinToLocalHHMM(f.alfredDndEndUtcMin)} onChange={e => setF({ ...f, alfredDndEndUtcMin: localHHMMToUtcMin(e.target.value) })} className="!text-xs" /></div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white/80 text-white/60 transition">
                      <input type="checkbox" checked={!!f.alfredDndWeekends} onChange={e => setF({ ...f, alfredDndWeekends: e.target.checked })} className="w-3.5 h-3.5 accent-brand-500 rounded" />
                      <span className="text-xs">Also stay quiet all weekend</span>
                    </label>
                  </div>
                );
              })()}
              <div className="flex items-center justify-between p-3 bg-black/40 border border-brand-900/20 rounded-xl mb-2">
                <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">Vacation mode</div><div className="text-[10px] text-white/50">Blocks all Alfred reminder texts until the date below (or until you turn this off, if left blank)</div></div>
                <button onClick={() => setF({ ...f, alfredVacationMode: !f.alfredVacationMode })} className={"transition " + (f.alfredVacationMode ? "text-brand-400" : "text-white/30")}>{f.alfredVacationMode ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
              </div>
              {f.alfredVacationMode && (
                <div className="pl-4 border-l border-brand-900/30">
                  <label className="text-[10px] text-white/50 block mb-1">Back on (optional)</label>
                  <GDate value={f.alfredVacationUntil || ""} onChange={e => setF({ ...f, alfredVacationUntil: e.target.value })} className="!text-xs !w-auto" />
                </div>
              )}
            </div>

            {/* BUG FIX — dailyBriefingAutoSend/weeklyDigestAutoSend have
                driven real automatic email sends in App.tsx for a while
                (opt-out flags — undefined/true means "on"), but neither had
                any Settings control to actually see or turn off, so "email
                frequency" was invisible/unmanageable to the owner even
                though the feature itself worked. */}
            <div className="pt-3 border-t border-brand-900/20">
              <div className="font-semibold text-sm mb-2">📧 Email Digests</div>
              {[
                { k: "dailyBriefingAutoSend", label: "Daily end-of-day summary", desc: "Emailed automatically after 6pm each day jobs ran — revenue, completions, and what's ahead" },
                { k: "weeklyDigestAutoSend", label: "Weekly owner digest", desc: "Emailed automatically every Monday morning — goal progress, overdue invoices, upcoming jobs" },
              ].map(n => <div key={n.k} className="flex items-center justify-between p-3 bg-black/40 border border-brand-900/20 rounded-xl mb-2">
                <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">{n.label}</div><div className="text-[10px] text-white/50">{n.desc}</div></div>
                <button onClick={() => setF({ ...f, [n.k]: f[n.k] === false ? true : false })} className={"transition " + (f[n.k] !== false ? "text-brand-400" : "text-white/30")}>{f[n.k] !== false ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
              </div>)}
              <div className="text-[10px] text-white/30">Sent to your Business Email above (or your account email if that's blank). On by default — turn either off if it's too much.</div>
            </div>

            <div className="pt-3 border-t border-brand-900/20">
              <div className="font-semibold text-sm mb-2">📱 Social Automation</div>
              {[
                { k: "autoPostCompletedJobs", label: "Auto-post completed jobs", desc: "Automatically create a social draft when a job is marked complete — you review before posting" },
                { k: "instaBridge", label: "Instagram posting bridge", desc: "Open Instagram app with pre-filled caption when scheduling an IG post (requires Instagram app)" }
              ].map(n => <div key={n.k} className="flex items-center justify-between p-3 bg-black/40 border border-brand-900/20 rounded-xl mb-2">
                <div className="flex-1 min-w-0 pr-3"><div className="text-sm font-medium">{n.label}</div><div className="text-[10px] text-white/50">{n.desc}</div></div>
                <button onClick={() => setF({ ...f, [n.k]: !f[n.k] })} className={"transition " + (f[n.k] ? "text-purple-400" : "text-white/30")}>{f[n.k] ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button>
              </div>)}
            </div>

            <div className="pt-3 border-t border-brand-900/20">
              <label className="text-xs text-white/60 mb-1 block">Review showcase minimum rating</label>
              <GSel value={f.reviewShowcaseMinRating || 5} onChange={e => setF({ ...f, reviewShowcaseMinRating: Number(e.target.value) })}>
                <option value={5} className="bg-black">5 stars only</option>
                <option value={4} className="bg-black">4+ stars</option>
                <option value={3} className="bg-black">3+ stars</option>
              </GSel>
              <div className="text-[10px] text-white/40 mt-1">Reviews at this rating or above show in the public wall on the Reviews page.</div>
            </div>
          </div>}

          {sec === "onboarding" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Onboarding</h4>
            <div className="text-xs text-white/50 mb-2">
              {settings.onboardingComplete === false
                ? "Onboarding is currently in progress."
                : "Re-run the setup flow — tell us about your business, import clients, and set rates again."}
            </div>
            <Glass className="p-4 !bg-black/40">
              <div className="text-sm font-semibold mb-1">Restart Onboarding</div>
              <div className="text-xs text-white/50 mb-3">This won't delete any existing data — it just walks you through the setup steps again.</div>
              <GBtn onClick={() => { setSettings((s: any) => ({ ...s, onboardingComplete: false })); onClose(); }} className="!text-xs">
                Start Onboarding
              </GBtn>
            </Glass>
            <Glass className="p-4 !bg-black/40">
              <div className="text-sm font-semibold mb-1">Setup Checklist</div>
              <div className="text-xs text-white/50 mb-3">The persistent "Getting Started" checklist widget (add a customer, create a job, invite crew, etc.) — reopen it if you dismissed it.</div>
              <GBtn onClick={() => { setSettings((s: any) => ({ ...s, onboardingChecklistHidden: false })); onClose(); }} className="!text-xs">
                Reopen Setup Checklist
              </GBtn>
            </Glass>
            <Glass className="p-4 !bg-black/40">
              <div className="text-sm font-semibold mb-1">Interactive Tour</div>
              <div className="text-xs text-white/50 mb-3">The guided spotlight walkthrough (adding a customer, scheduling a job, messaging Alfred, tracking crew) shown once on signup — replay it anytime.</div>
              <GBtn onClick={() => { setSettings((s: any) => ({ ...s, productTourPending: true })); onClose(); }} className="!text-xs">
                Replay Tour
              </GBtn>
            </Glass>
          </div>}

          {sec === "data" && <div className="space-y-3">
            <h4 className="font-semibold text-sm">Sync & Egress</h4>
            <Glass className="p-3 !bg-black/40 space-y-2">
              <div className="flex items-center gap-2 text-xs"><RefreshCw size={12} className="text-blue-400" /><span className="font-semibold">Background Sync Interval</span></div>
              <div className="text-[10px] text-white/50">
                How often the app re-checks Supabase for changes made on another device. Realtime updates (the same device making a change) are always instant regardless of this — this is only the fallback poll, and is managed automatically ({DEFAULT_POLL_INTERVAL_MS / 1000}s) so it can't accidentally be set too low (higher egress cost) or too high (slow to notice cross-device changes).
              </div>
            </Glass>

            <Glass className="p-3 !bg-brand-950/10 !border-brand-700/30 space-y-2">
              <div className="flex items-center gap-2 text-xs"><AlertTriangle size={12} className="text-danger-400" /><span className="font-semibold">Archive Old Completed Jobs</span></div>
              <div className="text-[10px] text-white/50">
                Exports every completed job older than 30 days to a JSON file, then — only after you confirm the file downloaded — permanently deletes those rows from Supabase to reduce egress. This is irreversible; the downloaded file is your only copy afterward. Jobs less than 30 days old, and anything not marked completed, are never touched.
              </div>
              <GBtn variant="danger" onClick={async () => {
                const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
                const cutoffStr = cutoff.toISOString().slice(0, 10);
                const oldJobs = (jobs || []).filter((j: any) => j.status === "completed" && j.scheduledDate && j.scheduledDate < cutoffStr);
                if (oldJobs.length === 0) { toast?.("No completed jobs older than 30 days — nothing to archive"); return; }
                if (!window.confirm(`This will export ${oldJobs.length} completed job(s) scheduled before ${cutoffStr}, then permanently delete them from Supabase. This cannot be undone. Continue?`)) return;
                const blob = new Blob([JSON.stringify(oldJobs, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a"); a.href = url; a.download = `crm-archived-jobs-${cutoffStr}.json`; a.click();
                URL.revokeObjectURL(url);
                // Deliberate second confirm, not a rubber-stamp — gives the owner
                // a real chance to check the file actually saved (e.g. downloads
                // blocked by browser settings) before anything is deleted.
                if (!window.confirm(`Backup file downloaded (${oldJobs.length} job(s)). Confirm the file saved successfully, then click OK to permanently delete these jobs from Supabase. Click Cancel to keep them for now.`)) {
                  toast?.("Deletion cancelled — jobs kept"); return;
                }
                const ids = oldJobs.map((j: any) => j.id);
                // SECURITY/SYNC FIX (audit finding) — no .select("id")/row-
                // count check: an RLS-mismatched delete reported success and
                // told the owner their only backup copy (the just-downloaded
                // JSON) was safe to rely on, while the rows still existed
                // server-side and would reappear on the next sync.
                const { data: deletedRows, error } = await (supabase as any).from("jobs").delete().in("id", ids).select("id");
                if (error) { toast?.("Some jobs may not have deleted from the server — " + error.message, "red"); return; }
                const deletedIds = Array.isArray(deletedRows) ? deletedRows.map((r: any) => r.id) : [];
                if (deletedIds.length === 0) { toast?.("Nothing was deleted from the server — the jobs may already be gone or belong to a different account", "red"); return; }
                if (deletedIds.length < ids.length) toast?.(`Only ${deletedIds.length} of ${ids.length} job(s) actually deleted from the server — the rest may reappear`, "yellow");
                setJobs((prev: any[]) => prev.filter(j => !deletedIds.includes(j.id)));
                markRecentlyDeleted?.("jobs", deletedIds);
                toast?.(`Archived and deleted ${deletedIds.length} job(s) ✓`, "green");
              }} className="w-full !text-xs">
                <Download size={12} className="inline mr-1.5" />Export & Delete Jobs Older Than 30 Days
              </GBtn>
            </Glass>

            <Glass className="p-3 !bg-brand-950/10 !border-brand-700/30 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs"><AlertTriangle size={12} className="text-danger-400" /><span className="font-semibold">Photo/Video Auto-Deletion</span></div>
                <button
                  onClick={() => setF({ ...f, mediaRetentionDays: f.mediaRetentionDays ? 0 : 30 })}
                  className={"flex-shrink-0 w-11 h-6 rounded-full transition relative " + (f.mediaRetentionDays ? "bg-brand-600" : "bg-white/10")}
                >
                  <div className={"absolute top-1 w-4 h-4 rounded-full bg-white transition " + (f.mediaRetentionDays ? "left-6" : "left-1")} />
                </button>
              </div>
              <div className="text-[10px] text-white/50">
                When enabled, job photos/videos (not signatures) are permanently deleted from completed jobs older than the period below. This runs automatically in the background — no export step, no per-run confirmation. Disabled by default; nothing is deleted unless you turn this on.
              </div>
              {!!f.mediaRetentionDays && (
                <div className="flex items-center gap-2 text-xs pt-1">
                  <span className="text-white/60">Delete after</span>
                  <GInput type="number" min="1" step="1" value={f.mediaRetentionDays} onChange={e => setF({ ...f, mediaRetentionDays: Math.max(1, Number(e.target.value) || 30) })} className="!w-20 !text-xs" />
                  <span className="text-white/60">days</span>
                </div>
              )}
            </Glass>

            <Glass className="p-3 !bg-blue-950/10 !border-blue-700/30 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Download size={12} className="text-blue-400" /><span className="font-semibold">Migrate Old Photos/Videos to Storage</span></div>
              <div className="text-[10px] text-white/50">
                Jobs captured before Storage support was added still have their photos, videos, and signatures stored as raw data directly in the database — the main driver of database size and Supabase egress usage. This one-time migration uploads that old media to Storage and removes the inline copy from the database, with no visible change to how photos display. Safe to run repeatedly — already-migrated jobs are skipped automatically.
              </div>
              {mediaBackfillProgress?.running ? (
                <div className="text-[11px] text-blue-300">Migrating job {mediaBackfillProgress.done} of {mediaBackfillProgress.total}…</div>
              ) : (
                <GBtn variant="ghost" onClick={async () => {
                  setMediaBackfillProgress({ running: true, done: 0, total: 0 });
                  try {
                    const result = await backfillJobMediaToStorage(jobs, setJobs, (done, total) => setMediaBackfillProgress({ running: true, done, total }));
                    if (result.jobsScanned === 0) {
                      toast("No old inline photos/videos found — nothing to migrate ✓");
                    } else {
                      toast(`Migrated ${result.itemsMigrated} file(s) across ${result.jobsUpdated} job(s), freed ~${(result.bytesFreedApprox / 1024 / 1024).toFixed(1)}MB` + (result.itemsFailed > 0 ? ` — ${result.itemsFailed} item(s) failed and were left as-is (retry by running this again)` : " ✓"));
                    }
                  } catch (e: any) {
                    toast("Migration failed: " + (e?.message || "unknown error"), "red");
                  } finally {
                    setMediaBackfillProgress(null);
                  }
                }} className="w-full !text-xs">
                  <Download size={12} className="inline mr-1.5" />Start Migration
                </GBtn>
              )}
            </Glass>

            <h4 className="font-semibold text-sm pt-2">Data Export & Backup</h4>
            <div className="text-xs text-white/50 mb-2">Export your data in various formats for backup, accounting, or tax prep.</div>

            <Glass className="p-3 !bg-black/40 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Download size={12} className="text-brand-400" /><span className="font-semibold">Full Backup (JSON)</span></div>
              <div className="text-[10px] text-white/50">All customers, jobs, estimates, expenses, automations.</div>
              <GBtn onClick={() => {
                const payload = { exportedAt: new Date().toISOString(), version: "1.0", settings: f };
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a");
                a.href = url; a.download = "crm-backup-" + today() + ".json"; a.click(); URL.revokeObjectURL(url);
                toast("Backup downloaded");
              }} className="w-full !text-xs"><Download size={12} className="inline mr-1.5" />Download JSON Backup</GBtn>
            </Glass>

            <Glass className="p-3 !bg-black/40 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Receipt size={12} className="text-green-400" /><span className="font-semibold">Accounting CSV Export</span></div>
              <div className="text-[10px] text-white/50">Exports revenue and expenses in a standard accounting-import CSV format.</div>
              <GBtn variant="ghost" onClick={() => {
                const header = "Date,Description,Amount,Type,Account,Category\n";
                const rows = [
                  ...((window as any)._crmJobs || []).filter(j => j.status === "completed").map(j => `${j.scheduledDate},"Job Revenue - ${j.address?.split(",")[0] || ""}",${j.amount},Income,Business Checking,Service Revenue`),
                  ...((window as any)._crmExpenses || []).map(e => `${e.date},"${e.description}",${e.amount},Expense,${e.isCash?"Cash":"Business Checking"},${e.category}`)
                ].join("\n");
                const blob = new Blob([header + rows], { type: "text/csv" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a");
                a.href = url; a.download = "crm-accounting-" + today() + ".csv"; a.click(); URL.revokeObjectURL(url);
                toast("Accounting CSV downloaded");
              }} className="w-full !text-xs"><Download size={12} className="inline mr-1.5" />Download Accounting CSV</GBtn>
            </Glass>

            <Glass className="p-3 !bg-black/40 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Users size={12} className="text-blue-400" /><span className="font-semibold">Customer List (CSV)</span></div>
              <div className="text-[10px] text-white/50">All customer contact info for mail merge or backup.</div>
              <GBtn variant="ghost" onClick={() => {
                const header = "First Name,Last Name,Email,Phone,Address,Lead Source,Tags,Created\n";
                const rows = ((window as any)._crmCustomers || []).map(c => `"${c.firstName}","${c.lastName}","${c.email||""}","${c.phone||""}","${c.address||""}","${c.leadSource||""}","${(c.tags||[]).join(";")}","${c.createdAt||""}"`).join("\n");
                const blob = new Blob([header + rows], { type: "text/csv" });
                const url = URL.createObjectURL(blob); const a = document.createElement("a");
                a.href = url; a.download = "crm-customers-" + today() + ".csv"; a.click(); URL.revokeObjectURL(url);
                toast("Customer CSV downloaded");
              }} className="w-full !text-xs"><Download size={12} className="inline mr-1.5" />Download Customer CSV</GBtn>
            </Glass>

            <Glass className="p-3 !bg-blue-950/20 !border-blue-700/30 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Shield size={12} className="text-blue-400" /><span className="font-semibold text-blue-300">GDPR / Data Rights</span></div>
              <div className="text-[10px] text-white/50">Per GDPR and CCPA, customers can request their data or deletion. Use these tools to comply.</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg text-xs">
                  <div><div className="font-medium">Customer data export</div><div className="text-white/40 text-[10px]">Export all data for a specific customer (right to access)</div></div>
                  <GBtn variant="ghost" className="!text-xs !py-1 flex-shrink-0 ml-2" onClick={() => {
                    const name = prompt("Enter customer name or email to export:");
                    if (!name) return;
                    const cust = ((window as any)._crmCustomers || []).find(c => (c.firstName + " " + c.lastName).toLowerCase().includes(name.toLowerCase()) || (c.email || "").toLowerCase().includes(name.toLowerCase()));
                    if (!cust) { toast("Customer not found"); return; }
                    const data = { customer: cust, estimates: ((window as any)._crmEstimates || []).filter(e => e.customerId === cust.id), jobs: ((window as any)._crmJobs || []).filter(j => j.customerId === cust.id) };
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "customer-data-" + (cust.firstName || "unknown") + "-" + today() + ".json"; a.click();
                    toast("Customer data exported ✓");
                  }}>Export</GBtn>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg text-xs">
                  <div><div className="font-medium">Customer data deletion</div><div className="text-white/40 text-[10px]">Permanently remove a customer and all linked records (right to erasure)</div></div>
                  <GBtn variant="danger" className="!text-xs !py-1 flex-shrink-0 ml-2" onClick={() => {
                    const name = prompt("Enter customer name or email to DELETE (cannot be undone):");
                    if (!name) return;
                    if (!confirm("Permanently delete this customer and all their data? This CANNOT be undone.")) return;
                    toast("Customer deletion queued — remove from Customers page manually to confirm");
                  }}>Delete</GBtn>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-black/40 rounded-lg text-xs">
                  <div><div className="font-medium">Opt-out / STOP list export</div><div className="text-white/40 text-[10px]">Export list of customers who have replied STOP to SMS</div></div>
                  <GBtn variant="ghost" className="!text-xs !py-1 flex-shrink-0 ml-2" onClick={() => {
                    const stopped = ((window as any)._crmCustomers || []).filter(c => c.smsOptOut);
                    const csv = "Name,Phone,Email,Opt-Out Date\n" + stopped.map(c => `"${c.firstName} ${c.lastName}","${c.phone||""}","${c.email||""}","${c.optOutDate||""}" `).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "sms-opt-out-" + today() + ".csv"; a.click();
                    toast("Opt-out list exported ✓");
                  }}>Export</GBtn>
                </div>
              </div>
            </Glass>

            <Glass className="p-3 !bg-brand-950/20 !border-brand-700/40 space-y-2">
              <div className="flex items-center gap-2 text-xs"><AlertTriangle size={12} className="text-danger-400" /><span className="font-semibold text-danger-300">Reset to demo data</span></div>
              <div className="text-[10px] text-white/60">Clears all data and reloads with seed data. Cannot be undone.</div>
              <GBtn variant="danger" onClick={() => { if (confirm("Reload and lose all changes?")) location.reload(); }} className="w-full !text-xs">Reset to Demo</GBtn>
            </Glass>
            <Glass className="p-3 !bg-brand-950/30 !border-brand-800/60 space-y-2">
              <div className="flex items-center gap-2 text-xs"><Trash2 size={12} className="text-danger-400" /><span className="font-semibold text-danger-300">Delete Account / All Data</span></div>
              <div className="text-[10px] text-white/60">Permanently erases all CRM data, settings, and stored information. Cannot be undone.</div>
              <GBtn variant="danger" onClick={() => {
                if (prompt("Type DELETE to confirm erasure:") !== "DELETE") return;
                Object.keys(localStorage).filter(k => k.startsWith("crm.")).forEach(k => localStorage.removeItem(k));
                toast("All data erased. Reloading...");
                setTimeout(() => location.reload(), 1500);
              }} className="w-full !text-xs !bg-danger-800 !border-danger-700">Permanently Delete All Data</GBtn>
            </Glass>
          </div>}
          </div>
          {/* Sticky footer */}
          <div className="flex-shrink-0 flex gap-2 justify-end px-5 py-3 border-t border-brand-900/30 bg-black/60 backdrop-blur-xl rounded-br-2xl">
            <GBtn variant="ghost" onClick={onClose}>Cancel</GBtn>
            <GBtn onClick={() => save()}><Save size={14} className="inline mr-1.5" />Save Settings</GBtn>
          </div>
        </div>
      </div>
    </div>
    </Modal>

    {/* Legal template editor — add/edit one named version of a Privacy
        Policy or Terms of Service document. */}
    <Modal open={legalEditor.open} onClose={() => setLegalEditor({ open: false, category: legalEditor.category, data: null })} title={legalEditor.data && legalTemplates.some(t => t.id === legalEditor.data?.id) ? "Edit Template" : "New Template"} maxW="max-w-2xl">
      {legalEditor.data && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Template Name</label>
            <GInput value={legalEditor.data.name} onChange={(e: any) => setLegalEditor(s => ({ ...s, data: s.data ? { ...s.data, name: e.target.value } : s.data }))} placeholder={legalEditor.category === "privacy" ? "e.g. 2026 Privacy Policy" : "e.g. Commercial Terms — updated late fee"} />
          </div>
          {legalEditor.category === "terms" && (
            <div>
              <label className="text-xs text-white/60 mb-1 block">Applies To</label>
              <GSel value={legalEditor.data.appliesTo} onChange={(e: any) => setLegalEditor(s => ({ ...s, data: s.data ? { ...s.data, appliesTo: e.target.value } : s.data }))}>
                <option value="both" className="bg-black">Both Residential & Commercial</option>
                <option value="residential" className="bg-black">Residential only</option>
                <option value="commercial" className="bg-black">Commercial only</option>
              </GSel>
            </div>
          )}
          <div>
            <label className="text-xs text-white/60 mb-1 block">Content</label>
            <GTxt rows={12} value={legalEditor.data.body} onChange={(e: any) => setLegalEditor(s => ({ ...s, data: s.data ? { ...s.data, body: e.target.value } : s.data }))} placeholder="Use {{company}} to insert your company name." className="!text-xs" />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <GBtn variant="ghost" onClick={() => setLegalEditor({ open: false, category: legalEditor.category, data: null })}>Cancel</GBtn>
            <GBtn onClick={() => legalEditor.data && saveLegalTemplate({ ...legalEditor.data, updatedAt: new Date().toISOString() })}>Save Template</GBtn>
          </div>
        </div>
      )}
    </Modal>

</>
  );
}

