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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, withTimeout } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, emailShell, logOutboundSmsToInbox } from "../../lib/messaging";
import { sendPushNotification } from "../../lib/push";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { useConfirm } from "../ui/ConfirmModal";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { supabase } from "../../lib/supabase";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";
import { InvoicePreviewModal } from "../ui/InvoicePreviewModal";
import { StripePaymentModal } from "../ui/StripePaymentModal";
import { createCheckoutSession, retrieveCheckoutSession, refundPaymentIntent } from "../../lib/stripe";
import { refundSquarePayment } from "../../lib/square";
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

export function InvoicesPage({ estimates = [], setEstimates, customers = [], settings = {} as AppSettings, toast, jobs = [], setJobs = (() => {}) as any, ownerId = "", highlightId = null, pushUndo = (_desc: string, _fn: () => void, _redoFn?: () => void) => {}, markRecentlyDeleted = (_table: "jobs" | "customers" | "estimates", _ids: string[]) => {}, unmarkRecentlyDeleted = (_table: "jobs" | "customers" | "estimates", _ids: string[]) => {} }: { estimates?: any[]; setEstimates?: any; customers?: any[]; settings?: AppSettings; toast?: any; jobs?: any[]; setJobs?: any; ownerId?: string; highlightId?: string | null; pushUndo?: (desc: string, fn: () => void, redoFn?: () => void) => void; markRecentlyDeleted?: (table: "jobs" | "customers" | "estimates", ids: string[]) => void; unmarkRecentlyDeleted?: (table: "jobs" | "customers" | "estimates", ids: string[]) => void }) {
  // FEATURE — "Alfred spotlight": briefly glows + scrolls to the invoice
  // Alfred just sent, driven by App.tsx's spotlight queue.
  useEffect(() => {
    if (!highlightId) return;
    document.querySelector(`[data-invoice-id="${highlightId}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);
  // ITEM 30 — same fake "crm.com" domain bug fixed in EstimatesPage.tsx
  // last round existed here too (Copy Link / Text Link on an invoice),
  // pointing every invoice link at a domain that resolves nowhere for any
  // deployment. Same real, origin-based helper.
  const portalUrlFor = (estId: string) => `${window.location.origin}${window.location.pathname}#/estimate/${estId}`;
  // FEATURE — "the popup should be in the CRM with the CRM's UI" — replaces
  // window.confirm() for delete actions with a real branded modal.
  const { confirmAsync, ConfirmDialog } = useConfirm();
  const [sendingJobInvoiceId, setSendingJobInvoiceId] = useState<string | null>(null);
  const [showSentJobs, setShowSentJobs] = useState(false);
  const needsInvoiceJobs = jobs.filter((j: any) => j.status === "completed" && j.paymentStatus !== "Paid" && !j.invoiceSentAt);
  const sentJobs = jobs.filter((j: any) => j.status === "completed" && !!j.invoiceSentAt).sort((a: any, b: any) => (b.invoiceSentAt || "").localeCompare(a.invoiceSentAt || ""));
  // For invoices sent outside the CRM (texted, handed over on paper, etc.) —
  // marks the job as invoiced without creating an estimate or sending any
  // email/SMS, so it drops out of "Needs Invoice" without a duplicate send.
  const markInvoiceSentManually = (job: any) => {
    // BUG FIX — this only ever updated local React state, never Supabase —
    // a reload wiped it out immediately. Same silent-local-only mutation bug
    // this file's own sendInvoiceForJob comment already called out for a
    // different spot.
    const patch = { invoiceSentAt: today(), paymentType: job.paymentType || "Invoice" };
    setJobs((prev: any[]) => prev.map(j => j.id === job.id ? { ...j, ...patch } : j));
    // BUG FIX (audit finding) — no .select("id")/empty-result check meant
    // an RLS-scoped 0-row silent failure here still showed the green
    // "Marked as sent" toast.
    (supabase as any).from("jobs").update(patch).eq("id", job.id).select("id")
      .then((r: any) => {
        if (r?.error) { console.error("[MarkSent] job patch failed:", r.error.message); toast?.("Marked locally, but failed to sync — " + r.error.message, "red"); }
        else if (!r?.data || r.data.length === 0) { console.error("[MarkSent] job patch matched 0 rows"); toast?.("Marked locally, but the server rejected the change", "red"); }
        else { toast?.("Marked as sent (outside the CRM)", "green"); }
      })
      .catch((e: any) => { console.error("[MarkSent] job patch threw:", e?.message); toast?.("Marked locally, but failed to sync — " + (e?.message || "unknown error"), "red"); });
  };

  const [previewInvoiceJob, setPreviewInvoiceJob] = useState<any>(null);
  const sendInvoiceForJob = async (job: any, subject: string, bodyHtml: string) => {
    console.log("[SendInvoice] sendInvoiceForJob called — job:", job.id, "customer:", job.customerId);
    const cust = customers.find(c => c.id === job.customerId);
    if (!cust?.email) { console.warn("[SendInvoice] aborting — no email on file for customer", job.customerId); toast?.("Customer has no email on file", "red"); return; }
    setSendingJobInvoiceId(job.id);
    try {
      const newInv = {
        id: uid(), customerId: job.customerId, jobId: job.id,
        lineItems: [{ id: uid(), description: job.notes || job.address || "Service", quantity: 1, unitPrice: Number(job.amount) || 0 }],
        subtotal: Number(job.amount) || 0, discount: 0, depositRequired: 0, tax: 0, total: Number(job.amount) || 0,
        status: "approved" as const, createdAt: today(), validUntil: daysFromNow(30), invoiced: true, invoicedAt: today(),
        // BUG FIX — missing owner_id violated the owner_id-scoped RLS policy
        // added by the multi-tenant migration (WITH CHECK owner_id =
        // current_owner_id()), so this insert was silently rejected — the
        // exact "Send Invoice doesn't persist, gone after reload" symptom.
        owner_id: ownerId,
      };
      // [SendInvoice] this used to only call setEstimates (local React state)
      // with no Supabase write at all — the payLink texted/emailed to the
      // customer points at #/estimate/{newInv.id}; if that row never reaches
      // Supabase the link 404s and the invoice never shows up anywhere else
      // in the CRM. Insert BEFORE sending, and wrap in withTimeout so a hung
      // Supabase call can't leave the button stuck on "Sending…" forever.
      console.log("[SendInvoice] inserting new invoice", newInv.id, "amount", newInv.total);
      const insertResult = await withTimeout<any>((supabase as any).from("estimates").insert(newInv), 10000, "Invoice save");
      if (insertResult?.error) {
        console.error("[SendInvoice] estimate insert failed:", insertResult.error.message);
        throw new Error("Couldn't save invoice — " + insertResult.error.message);
      }
      console.log("[SendInvoice] invoice saved to Supabase ✓");
      setEstimates((prev: any[]) => [...prev, newInv]);
      // FIX 17 — #/portal/ID is the employee portal's route, not a customer
      // invoice view; #/estimate/ID is the public no-login pay/sign portal.
      const payLink = `${window.location.origin}${window.location.pathname}#/estimate/${newInv.id}`;
      const html = bodyHtml + `<div style="text-align:center;margin:22px 0 4px"><a href="${payLink}" style="display:inline-block;background:#111111;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 30px;border-radius:10px">View & Pay Invoice</a></div>`;
      console.log("[SendInvoice] sending via Gmail to", cust.email);
      await withTimeout(sendEmail(settings as any, { to: cust.email, subject, body: html }), 10000, "Invoice email");
      console.log("[SendInvoice] Gmail send resolved ✓");
      const jobPatch = { invoiceSentAt: today(), paymentType: "Invoice", paymentStatus: job.paymentStatus === "Paid" ? job.paymentStatus : "Pending" };
      setJobs((prev: any[]) => prev.map(j => j.id === job.id ? { ...j, ...jobPatch } : j));
      (supabase as any).from("jobs").update(jobPatch).eq("id", job.id).select("id")
        .then((r: any) => {
          if (r?.error) console.error("[SendInvoice] job patch (invoiceSentAt) failed:", r.error.message);
          else if (!r?.data || r.data.length === 0) console.error("[SendInvoice] job patch (invoiceSentAt) matched 0 rows");
        })
        .catch((e: any) => console.error("[SendInvoice] job patch (invoiceSentAt) threw:", e?.message));
      toast?.(`Invoice sent to ${cust.firstName} ✓`, "green");
      setPreviewInvoiceJob(null);
    } catch (e: any) {
      console.error("[SendInvoice] sendInvoiceForJob — error:", e?.message || e);
      toast?.(e?.message || "Failed to send invoice", "red");
    } finally {
      setSendingJobInvoiceId(null);
      console.log("[SendInvoice] sendInvoiceForJob finished, sendingJobInvoiceId reset");
    }
  };
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState(null);
  // FEATURE 7 — standalone invoice creation (not tied to a job)
  const [newInvOpen, setNewInvOpen] = useState(false);
  const [newInvForm, setNewInvForm] = useState<{ customerId: string; title: string; items: { id: string; description: string; quantity: number; unitPrice: number }[] }>({ customerId: "", title: "", items: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }] });
  const newInvTotal = newInvForm.items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  // BUG FIX — "overdue invoices keep coming back / not staying deleted."
  // Root cause found via a live query: this was never a delete-persistence
  // bug at all — the SAME demo customer had 8-10 GENUINELY DUPLICATE
  // invoices, identical customer/amount/date but different ids. This button
  // had no disabled-while-submitting guard at all, so a double-click/
  // double-tap (very easy to trigger on mobile, and the exact device this
  // was being tested from) fired createStandaloneInvoice() more than once
  // before the modal closed, each call minting a fresh uid() and inserting
  // a full duplicate row. Deleting ONE of ten near-identical invoices reads
  // exactly like "I deleted it and it's still there" even though the
  // delete itself worked fine every time — there were just nine more.
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  // A ref, not just the state above — state updates aren't synchronous/
  // aren't visible to a second click handled in the same tick, so a truly
  // fast double-click could still see creatingInvoice as still false for
  // both calls. The ref flips immediately, closing that exact gap; the
  // state is only there to visually disable the button.
  const creatingInvoiceRef = useRef(false);
  const createStandaloneInvoice = () => {
    if (creatingInvoiceRef.current) return;
    if (!newInvForm.customerId) { toast?.("Pick a customer first", "yellow"); return; }
    if (newInvTotal <= 0) { toast?.("Add at least one line item with an amount", "yellow"); return; }
    creatingInvoiceRef.current = true;
    setCreatingInvoice(true);
    const inv: any = {
      id: uid(), customerId: newInvForm.customerId,
      title: newInvForm.title.trim() || "Invoice",
      lineItems: newInvForm.items.filter(it => it.description.trim() || (Number(it.unitPrice) || 0) > 0).map(it => ({ id: it.id, description: it.description || "Service", quantity: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) || 0 })),
      subtotal: newInvTotal, discount: 0, depositRequired: 0, tax: 0, total: newInvTotal,
      status: "approved" as const, createdAt: today(), validUntil: daysFromNow(30),
      invoiced: true, invoicedAt: today(), standalone: true,
      // BUG FIX — missing owner_id violated the owner_id-scoped RLS policy
      // (WITH CHECK owner_id = current_owner_id()) added by the multi-tenant
      // migration, so this insert was silently rejected — the fire-and-forget
      // .catch below only ever logged it to the console, and the success
      // toast fired unconditionally regardless of whether the save actually
      // worked, so there was no visible sign anything had gone wrong.
      owner_id: ownerId,
    };
    setEstimates((prev: any[]) => [...prev, inv]);
    (supabase as any).from("estimates").insert(inv)
      .then((r: any) => {
        if (r?.error) { console.error("[NewInvoice] save failed:", r.error.message); toast?.("Created locally, but failed to sync — " + r.error.message, "red"); }
        else toast?.("Invoice created ✓ — open it to send or take payment", "green");
      })
      .catch((e: any) => { console.error("[NewInvoice] save threw:", e?.message); toast?.("Created locally, but failed to sync — " + (e?.message || "unknown error"), "red"); })
      .finally(() => { creatingInvoiceRef.current = false; setCreatingInvoice(false); });
    setNewInvOpen(false);
    setNewInvForm({ customerId: "", title: "", items: [{ id: uid(), description: "", quantity: 1, unitPrice: 0 }] });
  };
  // FEATURE 3 — prefill the New Invoice form from a completed job that hasn't
  // been invoiced yet, so the owner can turn a finished job into an invoice in
  // one tap instead of retyping the customer + amount.
  const prefillFromJob = (j: any) => {
    const cust = customers.find((c: any) => c.id === j.customerId);
    setNewInvForm({
      customerId: j.customerId || "",
      title: j.title || j.notes || (cust ? `Service at ${j.address}` : "Service"),
      items: [{ id: uid(), description: j.notes || j.address || "Service", quantity: 1, unitPrice: Number(j.amount) || 0 }],
    });
  };
  const [selected, setSelected] = useState([]);
  const [stripePayInvoice, setStripePayInvoice] = useState<any>(null);
  const [checkoutLoadingId, setCheckoutLoadingId] = useState<string | null>(null);
  const [refundingInvoice, setRefundingInvoice] = useState<string | null>(null);
  // FEATURE — "give the owner the option to give refunds and partial
  // refunds." Previously "Refund" only ever refunded the FULL charge with
  // no confirmation of amount. This opens a small modal instead: full or a
  // specific partial dollar amount, capped at what's actually left
  // un-refunded so far (refundedAmount tracks running total across
  // multiple partial refunds on the same invoice).
  const [refundModal, setRefundModal] = useState<{ invoice: any } | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [refundMode, setRefundMode] = useState<"full" | "partial">("full");
  // ROUND 12 — the secret key check (stripeSecretKeyEnc) no longer lives
  // client-side at all (see lib/stripe.ts); readiness is just "publishable
  // key is set." If STRIPE_SECRET_KEY isn't configured server-side, the
  // actual charge attempt fails with a clear error from stripe-action.ts.
  const stripeReady = !!settings?.stripePublishableKey;

  const sendStripeReceipt = (inv: any) => {
    const cust = customers.find(c => c.id === inv.customerId);
    if (!cust?.email) return;
    sendEmail(settings as any, cust.email, `Receipt — ${settings?.companyName || "CRM Starter"}`,
      emailShell(settings as any, "Payment Receipt", `<p>Hi ${cust.firstName},</p><p>Thanks for your payment of <strong>${fmt(inv.amount)}</strong> for ${inv.address || "your service"}.</p><p>This receipt confirms your invoice is paid in full.</p>`)
    ).catch(() => {});
  };

  const markPaidViaStripe = (invId: string, paymentIntentId: string) => {
    syncJobPaymentStatus((estimates.find(e => e.id === invId) as any)?.jobId, "Paid");
    setEstimates(estimates.map(e => e.id === invId ? { ...e, paidAt: today(), status: "approved", stripePaymentIntentId: paymentIntentId, stripePaymentStatus: "paid" as const } : e));
    setStripePayInvoice(null);
    toast?.("Payment received ✓");
    const inv = estimates.find(e => e.id === invId);
    if (inv) sendStripeReceipt(inv);
  };

  // Hosted Stripe Checkout — redirects the browser to Stripe's own payment page
  // instead of the embedded Payment Element (StripePaymentModal). Stripe redirects
  // back here afterward with ?stripe_checkout=success|cancel&invoice=&session_id=.
  const payWithStripeCheckout = async (inv: any) => {
    if (!settings?.stripePublishableKey) {
      toast?.("Set up Stripe in Settings → Integrations first", "yellow");
      return;
    }
    setCheckoutLoadingId(inv.id);
    try {
      const cust = customers.find(c => c.id === inv.customerId);
      const base = window.location.origin + window.location.pathname + window.location.hash.split("?")[0];
      const session = await createCheckoutSession({
        amountCents: Math.round(Number(inv.amount || 0) * 100),
        currency: "usd",
        description: `Invoice — ${inv.address || inv.id}`,
        successUrl: `${base}?stripe_checkout=success&invoice=${inv.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}?stripe_checkout=cancel&invoice=${inv.id}`,
        customerEmail: cust?.email,
        invoiceId: inv.id,
      });
      window.location.href = session.url;
    } catch (e: any) {
      toast?.(e.message || "Failed to start Stripe Checkout", "red");
      setCheckoutLoadingId(null);
    }
  };

  // On return from Stripe Checkout, verify the session and mark the invoice paid.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.split("?")[1] || "");
    const checkoutState = params.get("stripe_checkout");
    const invId = params.get("invoice");
    const sessionId = params.get("session_id");
    if (!checkoutState || !invId) return;
    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("stripe_checkout"); url.searchParams.delete("invoice"); url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
    };
    if (checkoutState === "cancel") {
      toast?.("Payment cancelled", "yellow");
      cleanUrl();
      return;
    }
    if (checkoutState === "success" && sessionId) {
      (async () => {
        // FIX 1 (mobile round 8) — functions/api/stripe-webhook.ts is now the
        // AUTHORITATIVE writer of paidAt (signature-verified server-side).
        // It should have already fired by the time Stripe redirects the
        // browser back here, so check Supabase directly first — a few short
        // retries cover the small delivery delay — before falling back to
        // the client-side Stripe session check (which trusts the browser's
        // own read of Stripe, the weaker path this fix is meant to reduce
        // reliance on). This is the "double-check" half of the fix; the
        // webhook itself is what actually closes the security gap.
        let confirmedViaWebhook = false;
        for (let attempt = 0; attempt < 5 && !confirmedViaWebhook; attempt++) {
          try {
            const { data } = await (supabase as any).from("estimates").select("paidAt,stripePaymentIntentId").eq("id", invId).maybeSingle();
            if (data?.paidAt) {
              confirmedViaWebhook = true;
              setEstimates(prev => prev.map(e => e.id === invId ? { ...e, paidAt: data.paidAt, status: "approved", stripePaymentStatus: "paid" as const, stripePaymentIntentId: data.stripePaymentIntentId || e.stripePaymentIntentId } : e));
              // BUG FIX — this webhook-confirmed branch is the authoritative,
              // primary path per the comment above, but it only ever updated
              // `estimates`, never the linked job's paymentStatus — only the
              // client-side fallback below (markPaidViaStripe) did that. So a
              // job's payment status silently never flipped to "Paid" for
              // the normal/expected payment flow.
              const invNow = estimates.find(e => e.id === invId);
              syncJobPaymentStatus((invNow as any)?.jobId, "Paid");
              toast?.("Payment received ✓ (confirmed by server)");
              if (invNow) sendStripeReceipt({ ...invNow, paidAt: data.paidAt });
            }
          } catch { /* fall through to retry / fallback below */ }
          if (!confirmedViaWebhook && attempt < 4) await new Promise(r => setTimeout(r, 1500));
        }
        if (!confirmedViaWebhook) {
          console.warn("[Stripe] webhook hasn't confirmed payment yet — falling back to client-side session check. If this keeps happening, verify STRIPE_WEBHOOK_SECRET is set in Cloudflare Pages and the webhook endpoint is registered in Stripe.");
          try {
            const session = await retrieveCheckoutSession(sessionId);
            if (session.payment_status === "paid") {
              markPaidViaStripe(invId, session.payment_intent || session.id);
            } else {
              toast?.("Payment not completed", "yellow");
            }
          } catch (e: any) {
            toast?.(e.message || "Couldn't verify Stripe payment", "red");
          }
        }
        cleanUrl();
      })();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Only approved+invoiced estimates are invoices
  const invoices = estimates.filter(e => e.invoiced);

  const bucket = inv => {
    if (inv.paidAt) return "paid";
    const age = inv.invoicedAt ? daysSince(inv.invoicedAt) : 0;
    if (age > 60) return "overdue60";
    if (age > 30) return "overdue30";
    if (age > 14) return "overdue";
    return "open";
  };

  const filtered = invoices
    .filter(inv => filter === "all" || bucket(inv) === filter || (filter === "unpaid" && !inv.paidAt))
    .filter(inv => {
      if (!search.trim()) return true;
      const c = customers.find(x => x.id === inv.customerId);
      const q = search.toLowerCase();
      return inv.id.toLowerCase().includes(q) || (c?.firstName + " " + c?.lastName).toLowerCase().includes(q);
    })
    .sort((a, b) => (b.invoicedAt || "").localeCompare(a.invoicedAt || ""));

  // Stats
  const totalOutstanding = invoices.filter(i => !i.paidAt).reduce((s, i) => s + i.total, 0);
  const totalPaid = invoices.filter(i => i.paidAt).reduce((s, i) => s + i.total, 0);
  const overdueTotal = invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) > 14).reduce((s, i) => s + i.total, 0);
  const avgDaysToPay = (() => {
    const paid = invoices.filter(i => i.paidAt && i.invoicedAt);
    if (paid.length === 0) return "—";
    // BUG FIX — a job paid up-front (e.g. a deposit collected at time of
    // service, invoiced afterward) has paidAt BEFORE invoicedAt, which made
    // this go negative and drag the whole average down to something that
    // looked obviously wrong ("-4d" etc). Floor each sample at 0 — you can't
    // take negative days to pay something you were paid for before it was
    // even invoiced.
    const avg = paid.reduce((s, i) => s + Math.max(0, daysSince(i.invoicedAt) - daysSince(i.paidAt)), 0) / paid.length;
    return Math.round(avg) + "d";
  })();

  // Aging buckets
  const aging = {
    current: invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) <= 14).reduce((s, i) => s + i.total, 0),
    days15_30: invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) > 14 && daysSince(i.invoicedAt) <= 30).reduce((s, i) => s + i.total, 0),
    days31_60: invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) > 30 && daysSince(i.invoicedAt) <= 60).reduce((s, i) => s + i.total, 0),
    days60plus: invoices.filter(i => !i.paidAt && i.invoicedAt && daysSince(i.invoicedAt) > 60).reduce((s, i) => s + i.total, 0)
  };
  const totalAging = aging.current + aging.days15_30 + aging.days31_60 + aging.days60plus;

  // BLOCKER 14 (mobile round 10) — these only ever called setEstimates
  // (local React state) with no Supabase write at all, and toasted "Marked
  // paid" unconditionally regardless of whether anything actually persisted.
  // App.tsx's own refetchData() polls the estimates table every 10s and
  // merges the server row straight over local state — so within seconds the
  // still-unpaid server row silently overwrote the local paidAt, snapping
  // the invoice back to unpaid. That's exactly "Mark as Paid doesn't work."
  // ITEM 16 — also flip the linked job's paymentStatus (both local state and
  // Supabase) so the employee/field portal, which reads job.paymentStatus
  // rather than the estimates table, reflects a payment the owner marks here
  // immediately instead of showing "Unpaid" until something else syncs it.
  const syncJobPaymentStatus = (jobId: string | undefined, paymentStatus: "Paid" | "Pending") => {
    if (!jobId) return;
    setJobs((prev: any[]) => prev.map(j => j.id === jobId ? { ...j, paymentStatus } : j));
    (supabase as any).from("jobs").update({ paymentStatus }).eq("id", jobId).select("id")
      .then((r: any) => {
        if (r?.error) console.error("[MarkPaid] job paymentStatus sync failed:", r.error.message);
        else if (!r?.data || r.data.length === 0) console.error("[MarkPaid] job paymentStatus sync matched 0 rows");
      })
      .catch((e: any) => console.error("[MarkPaid] job paymentStatus sync threw:", e?.message));
  };
  const markPaid = id => {
    const paidAt = today();
    const inv = estimates.find(e => e.id === id);
    setEstimates(estimates.map(e => e.id === id ? { ...e, paidAt, status: "approved" } : e));
    syncJobPaymentStatus((inv as any)?.jobId, "Paid");
    // FEATURE — "employees should receive notifications for... payments."
    // Lets crew know a job they worked got paid, without needing to check
    // the CRM.
    if (ownerId && (inv as any)?.jobId) {
      const job = jobs.find((j: any) => j.id === (inv as any).jobId);
      for (const empId of (Array.isArray(job?.crew) ? job.crew : [])) {
        if (String(empId).startsWith("owner_")) continue;
        sendPushNotification({ ownerId, employeeId: empId, title: "Payment received", body: `${job?.customerName || job?.address || "A job"} was marked paid — ${fmt(inv?.total || 0)}`, url: "/#/portal", tag: "payment-" + id });
      }
    }
    // AUDIT FIX — this only checked `.error`, missing the documented
    // RLS 0-row-silent-success case (docs/ARCHITECTURE.md): an owner_id mismatch/stale
    // row returns HTTP success with zero rows updated, no error at all, so
    // without .select("id") this always toasted "Marked paid" even on a
    // write that never actually landed server-side.
    (supabase as any).from("estimates").update({ paidAt, status: "approved" }).eq("id", id).select("id")
      .then((r: any) => {
        if (r?.error) { console.error("[MarkPaid] failed:", r.error.message); toast("Saved locally, but failed to sync — " + r.error.message, "red"); }
        else if (!Array.isArray(r?.data) || r.data.length === 0) { console.error("[MarkPaid] update matched 0 rows for", id); toast("Saved locally, but the server didn't confirm — it may revert. Try again or refresh to check.", "red"); }
        else toast("Marked paid ✓", "green");
      })
      .catch((e: any) => { console.error("[MarkPaid] threw:", e?.message); toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red"); });
  };
  const markUnpaid = id => {
    const inv = estimates.find(e => e.id === id);
    setEstimates(estimates.map(e => e.id === id ? { ...e, paidAt: null } : e));
    syncJobPaymentStatus((inv as any)?.jobId, "Pending");
    (supabase as any).from("estimates").update({ paidAt: null }).eq("id", id).select("id")
      .then((r: any) => {
        if (r?.error) { console.error("[MarkPaid] unpaid failed:", r.error.message); toast("Saved locally, but failed to sync — " + r.error.message, "red"); }
        else if (!Array.isArray(r?.data) || r.data.length === 0) { console.error("[MarkPaid] unpaid matched 0 rows for", id); toast("Saved locally, but the server didn't confirm — it may revert. Try again or refresh to check.", "red"); }
        else toast("Marked unpaid", "green");
      })
      .catch((e: any) => { console.error("[MarkPaid] unpaid threw:", e?.message); toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red"); });
  };
  // FIX 7 — invoices are stored as estimates with invoiced:true, so deleting
  // one removes it from the shared `estimates` table (both locally and
  // server-side, else the next cross-device poll just re-fetches it).
  const deleteInvoice = async (inv: any) => {
    if (!(await confirmAsync({ message: `Permanently delete invoice #${(inv.id || "").toUpperCase()}? This can't be undone.`, confirmLabel: "Delete Invoice" }))) return;
    setEstimates(estimates.filter(e => e.id !== inv.id));
    // BUG FIX — "delete invoice, it comes back": refetchData()'s merge in
    // App.tsx is additive-only, so a cross-device poll/realtime refresh that
    // was already in flight when this delete fired could resurrect the row
    // from its stale response. markRecentlyDeleted tells that merge to
    // ignore this id for a couple minutes no matter what a stale fetch says.
    markRecentlyDeleted("estimates", [inv.id]);
    setViewing(null);
    pushUndo(`Deleted invoice #${(inv.id || "").toUpperCase()}`, () => {
      unmarkRecentlyDeleted("estimates", [inv.id]);
      setEstimates((prev: any[]) => [inv, ...prev]);
      (supabase as any).from("estimates").insert(inv).then((r: any) => {
        if (r?.error) toast("Restored locally, but failed to restore on server — " + r.error.message, "red");
      }).catch(() => {});
    }, () => {
      setEstimates((prev: any[]) => prev.filter((e: any) => e.id !== inv.id));
      markRecentlyDeleted("estimates", [inv.id]);
      withTimeout((supabase as any).from("estimates").delete().eq("id", inv.id).select("id"), 10000, "Invoice delete").then((r: any) => {
        if (r?.error) toast("Removed locally, but failed to remove on server — " + r.error.message, "red");
        else if (!Array.isArray(r?.data) || r.data.length === 0) toast("Removed locally, but the server didn't confirm — it may reappear", "red");
      }).catch(() => {});
    });
    // BUG FIX — this delete had no timeout, so a hung request (dropped
    // connection, slow network) left the optimistic local removal with no
    // error toast either — the next 3s poll then silently restored the row
    // from the server since the delete never actually landed, reading to
    // the owner as "I deleted it, but on reload it's back."
    // BUG FIX — "deleted locally, but failed to sync." Without .select(),
    // Supabase's delete() reports SUCCESS (no error) even when RLS/a stale
    // owner_id silently matched ZERO rows server-side — the classic
    // 0-row-silent-RLS-block pattern (docs/ARCHITECTURE.md). That read as a real,
    // reported sync failure with no useful reason, and the row would then
    // reappear on the next cross-device refresh. .select("id") lets a 0-row
    // response be caught and reported as the real failure it is.
    withTimeout((supabase as any).from("estimates").delete().eq("id", inv.id).select("id"), 10000, "Invoice delete")
      .then((result: any) => {
        if (result?.error) { toast("Deleted locally, but failed to delete from server — " + result.error.message, "red"); return; }
        if (!Array.isArray(result?.data) || result.data.length === 0) { toast("Deleted locally, but the server didn't confirm the delete — it may reappear. Try again or refresh to check.", "red"); return; }
        toast("Invoice deleted");
      })
      .catch((e: any) => toast("Deleted locally, but failed to delete from server — " + (e?.message || ""), "red"));
  };
  const sendReminder = async inv => {
    const c = customers.find(x => x.id === inv.customerId);
    if (!c) return;
    const age = inv.invoicedAt ? daysSince(inv.invoicedAt) : 0;
    const msg = `Hi ${c.firstName}, this is a friendly reminder that your invoice of ${fmt(inv.total)} from CRM Starter is ${age > 0 ? age + " days " : ""}past due. Pay online or call (555) 555-0100. Thank you!`;
    if (settings?.twilioSid && c.phone) {
      try {
        await twilioSend(settings, c.phone, msg);
        logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
        toast("Reminder sent to " + c.firstName + " via SMS ✓");
      } catch (e) {
        toast("SMS failed: " + e.message, "error");
      }
    } else {
      toast("Reminder queued for " + c.firstName + " — connect Twilio to send SMS");
    }
  };
  const sendBulkReminders = async () => {
    const toSend = selected.length > 0
      ? estimates.filter(e => selected.includes(e.id) && e.invoiced && !e.paidAt)
      : estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 7);
    let sent = 0, failed = 0;
    for (const inv of toSend) {
      const c = customers.find(x => x.id === inv.customerId);
      if (!c) continue;
      const age = inv.invoicedAt ? daysSince(inv.invoicedAt) : 0;
      const msg = "Hi " + c.firstName + ", friendly reminder that your invoice of " + fmt(inv.total) + " from CRM Starter is " + (age > 0 ? age + " days " : "") + "past due. Please pay at your convenience. Call (555) 555-0100 with questions. Thank you!";
      try {
        if (settings?.twilioSid && c.phone) { await twilioSend(settings, c.phone, msg); logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {}); sent++; }
        else if (c.phone) { window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg); sent++; break; }
      } catch { failed++; }
    }
    setSelected([]);
    toast("Reminders sent: " + sent + (failed > 0 ? " · " + failed + " failed" : ""));
  };

  const toggleSel = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const toggleSelAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map(i => i.id));

  // FEATURE 5 (mobile round 7) — bulk delete + CSV export of selected invoices.
  const downloadSelectedCsv = () => {
    const rows = selected.map(id => {
      const inv = estimates.find(e => e.id === id);
      if (!inv) return null;
      const c = customers.find(x => x.id === inv.customerId);
      return [inv.id, c ? `${c.firstName} ${c.lastName}` : "", inv.invoicedAt || "", inv.total, inv.paidAt ? "Paid" : "Unpaid"]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    }).filter(Boolean);
    const csv = "Invoice ID,Customer,Invoiced Date,Amount,Status\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "invoices-" + today() + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast?.(`Downloaded ${selected.length} invoice${selected.length !== 1 ? "s" : ""}`);
  };
  const deleteSelectedInvoices = async () => {
    if (selected.length === 0) return;
    if (!(await confirmAsync({ message: `Permanently delete ${selected.length} invoice${selected.length !== 1 ? "s" : ""}? This can't be undone.`, confirmLabel: "Delete" }))) return;
    const ids = [...selected];
    setEstimates(estimates.filter(e => !ids.includes(e.id)));
    markRecentlyDeleted("estimates", ids);
    setSelected([]);
    withTimeout((supabase as any).from("estimates").delete().in("id", ids).select("id"), 10000, "Invoice bulk delete")
      .then((r: any) => {
        if (r?.error) { toast?.("Deleted locally, but failed to delete from server — " + r.error.message, "red"); return; }
        const deletedCount = Array.isArray(r?.data) ? r.data.length : 0;
        if (deletedCount < ids.length) { toast?.(`Deleted locally, but only ${deletedCount}/${ids.length} confirmed on the server — some may reappear. Try again or refresh to check.`, "red"); return; }
        toast?.(ids.length + " invoice(s) deleted");
      })
      .catch((e: any) => toast?.("Deleted locally, but failed to delete from server — " + (e?.message || ""), "red"));
  };

  const statusBadge = inv => {
    const b = bucket(inv);
    if (b === "paid") return <Badge tone="green">Paid</Badge>;
    if (b === "overdue60") return <Badge tone="red">60+ days</Badge>;
    if (b === "overdue30") return <Badge tone="red">30+ days</Badge>;
    if (b === "overdue") return <Badge tone="yellow">Overdue</Badge>;
    if (inv.viewed) return <Badge tone="blue">Viewed</Badge>;
    return <Badge tone="blue">Sent</Badge>;
  };

  const filterTabs = [
    { k: "all", l: "All", n: invoices.length },
    { k: "unpaid", l: "Unpaid", n: invoices.filter(i => !i.paidAt).length },
    { k: "open", l: "Open", n: invoices.filter(i => bucket(i) === "open").length },
    { k: "overdue", l: "Overdue", n: invoices.filter(i => ["overdue", "overdue30", "overdue60"].includes(bucket(i))).length },
    { k: "paid", l: "Paid", n: invoices.filter(i => i.paidAt).length }
  ];

  return (
    <div className="space-y-4">
      {ConfirmDialog}
      {/* Header + New Invoice (FEATURE 7) */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Invoices</h2>
        <GBtn onClick={() => setNewInvOpen(true)} className="!py-2"><Plus size={14} className="inline mr-1" />New Invoice</GBtn>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={DollarSign} label="Outstanding" value={fmt(totalOutstanding)} />
        <Stat icon={AlertTriangle} label="Overdue" value={fmt(overdueTotal)} />
        <Stat icon={CheckCircle} label="Paid YTD" value={fmt(totalPaid)} />
        <Stat icon={Clock} label="Avg Days to Pay" value={avgDaysToPay} />
      </div>

      {/* Completed jobs that haven't been invoiced or marked paid yet */}
      {(needsInvoiceJobs.length > 0 || sentJobs.length > 0) && (
        <Glass className="p-4 !bg-yellow-950/15 !border-yellow-700/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-yellow-400" />
            <h3 className="font-semibold text-sm flex-1">Completed — Needs Invoice</h3>
            <Badge tone="yellow">{needsInvoiceJobs.length}</Badge>
            {sentJobs.length > 0 && (
              <button onClick={() => setShowSentJobs(v => !v)} className="text-[10px] px-2 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/70 transition flex items-center gap-1">
                {showSentJobs ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                {showSentJobs ? `Showing ${sentJobs.length} sent` : `Show ${sentJobs.length} sent`}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {needsInvoiceJobs.map((j: any) => {
              const cust = customers.find(c => c.id === j.customerId);
              return (
                <div key={j.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{cust ? `${cust.firstName} ${cust.lastName}` : j.address}</div>
                    <div className="text-xs text-white/40">{j.address} · {fmt(j.amount)} · completed {j.completedAt ? new Date(j.completedAt).toLocaleDateString() : j.scheduledDate}</div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => markInvoiceSentManually(j)} title="Already sent this invoice outside the CRM (text, paper, etc.)" className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-white/50 hover:text-white text-xs transition">
                      Mark as Sent
                    </button>
                    <GBtn onClick={() => setPreviewInvoiceJob(j)} disabled={sendingJobInvoiceId === j.id} className="!text-xs !py-1.5">
                      {sendingJobInvoiceId === j.id ? "Sending…" : <><Send size={11} className="inline mr-1" />Send Invoice</>}
                    </GBtn>
                  </div>
                </div>
              );
            })}
            {showSentJobs && sentJobs.map((j: any) => {
              const cust = customers.find(c => c.id === j.customerId);
              return (
                <div key={j.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/15 border border-white/5">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate text-white/70">{cust ? `${cust.firstName} ${cust.lastName}` : j.address}</div>
                    <div className="text-xs text-white/30">{j.address} · {fmt(j.amount)}</div>
                  </div>
                  <span className="text-[10px] px-2 py-1 rounded-lg bg-green-950/30 border border-green-700/30 text-green-400 flex-shrink-0">✓ Sent {j.invoiceSentAt}</span>
                </div>
              );
            })}
          </div>
        </Glass>
      )}

      {/* Aging breakdown */}
      {totalAging > 0 && <Glass className="p-5">
        <div className="flex items-center gap-2 mb-4"><Activity size={14} className="text-brand-400" /><h3 className="font-semibold text-sm">Accounts Receivable Aging</h3></div>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { k: "current", l: "Current (0-14d)", v: aging.current, tone: "bg-green-600" },
            { k: "days15_30", l: "15-30 days", v: aging.days15_30, tone: "bg-yellow-500" },
            { k: "days31_60", l: "31-60 days", v: aging.days31_60, tone: "bg-orange-500" },
            { k: "days60plus", l: "60+ days", v: aging.days60plus, tone: "bg-brand-600" }
          ].map(b => {
            const pct = totalAging ? (b.v / totalAging) * 100 : 0;
            return <div key={b.k} className="space-y-1">
              <div className="text-[10px] text-white/50 uppercase tracking-wider">{b.l}</div>
              <div className="text-lg font-bold">{fmt(b.v)}</div>
              <div className="h-1.5 bg-black/40 rounded-full overflow-hidden"><div className={"h-full " + b.tone} style={{ width: pct + "%" }} /></div>
            </div>;
          })}
        </div>
        <div className="text-[10px] text-white/40 pt-3 border-t border-brand-900/20">Total receivable: <span className="text-brand-400 font-semibold">{fmt(totalAging)}</span></div>
      </Glass>}

      {/* Filter + search + actions */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {filterTabs.map(t => (
            <button key={t.k} onClick={() => setFilter(t.k)} className={"px-3 py-1.5 rounded-xl text-xs font-medium transition border " + (filter === t.k ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>{t.l} ({t.n})</button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} className="bg-black/40 border border-brand-900/30 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-brand-500/60 w-44" />
          </div>
          {selected.length > 0 && <>
            <GBtn onClick={sendBulkReminders} className="!text-xs"><Send size={12} className="inline mr-1" />Remind ({selected.length})</GBtn>
            <GBtn variant="ghost" onClick={downloadSelectedCsv} className="!text-xs"><Download size={12} className="inline mr-1" />Download ({selected.length})</GBtn>
            <GBtn variant="danger" onClick={deleteSelectedInvoices} className="!text-xs"><Trash2 size={12} className="inline mr-1" />Delete ({selected.length})</GBtn>
          </>}
        </div>
      </div>

      {/* Invoice table */}
      <Glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/30 bg-black/40">
              <th className="px-3 py-3 w-10"><input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={toggleSelAll} className="w-4 h-4 rounded accent-brand-600" /></th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60">Invoice</th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60">Customer</th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60 hidden md:table-cell">Invoiced</th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60 hidden lg:table-cell">Age</th>
              <th className="text-left px-3 py-3 text-xs uppercase tracking-wider text-white/60">Status</th>
              <th className="text-right px-3 py-3 text-xs uppercase tracking-wider text-white/60">Amount</th>
              <th className="text-right px-3 py-3 text-xs uppercase tracking-wider text-white/60">Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(inv => {
                const c = customers.find(x => x.id === inv.customerId);
                const age = inv.invoicedAt ? daysSince(inv.invoicedAt) : 0;
                const isSel = selected.includes(inv.id);
                return (
                  <tr key={inv.id} data-invoice-id={inv.id} className={"border-b border-brand-900/10 transition " + (isSel ? "bg-brand-950/20" : "hover:bg-white/5") + (highlightId === inv.id ? " ring-2 ring-inset ring-brand-500 shadow-[0_0_25px_rgba(255,255,255,0.5)]" : "")}>
                    <td className="px-3 py-3"><input type="checkbox" checked={isSel} onChange={() => toggleSel(inv.id)} className="w-4 h-4 rounded accent-brand-600" /></td>
                    <td className="px-3 py-3"><span className="font-mono text-xs text-brand-400">#{inv.id.toUpperCase()}</span></td>
                    <td className="px-3 py-3"><div className="font-medium">{c?.firstName} {c?.lastName}</div><div className="text-[10px] text-white/50 md:hidden">{inv.invoicedAt}</div></td>
                    <td className="px-3 py-3 text-white/70 hidden md:table-cell">{inv.invoicedAt || "—"}</td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      {inv.paidAt ? (
                        <span className="text-green-400 text-xs">
                          {inv.stripePaymentStatus === "refunded" ? "Refunded" : inv.stripePaymentIntentId ? "Paid via Stripe" : "Paid"}
                        </span>
                      ) : (
                        <span className={"text-xs " + (age > 30 ? "text-brand-400" : age > 14 ? "text-yellow-400" : "text-white/60")}>{age}d</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{statusBadge(inv)}</td>
                    <td className="px-3 py-3 text-right font-bold text-brand-400">{fmt(inv.total)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setViewing(inv)} title="View" className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"><Eye size={12} /></button>
                        {!inv.paidAt && stripeReady && (
                          <button onClick={() => setStripePayInvoice(inv)} title="Pay Now (in-app)" className="p-1.5 rounded-lg hover:bg-purple-900/30 text-white/60 hover:text-purple-400"><CreditCard size={12} /></button>
                        )}
                        {!inv.paidAt && stripeReady && (
                          <button onClick={() => payWithStripeCheckout(inv)} disabled={checkoutLoadingId === inv.id} title="Pay with Stripe Checkout" className="p-1.5 rounded-lg hover:bg-purple-900/30 text-white/60 hover:text-purple-400 disabled:opacity-40"><ExternalLink size={12} /></button>
                        )}
                        <button onClick={() => {
                          const c = customers.find(x => x.id === inv.customerId);
                          const html = `<!DOCTYPE html><html><head><title>Invoice</title><style>body{font-family:Arial;padding:32px;color:#111;max-width:700px;margin:auto}h1{color:#111111}.hdr{display:flex;justify-content:space-between;border-bottom:2px solid #111111;padding-bottom:16px;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;padding:8px;border-bottom:1px solid #ccc;font-size:10px;text-transform:uppercase}td{padding:8px;border-bottom:1px solid #eee}.r{text-align:right}.total{font-weight:bold;font-size:16px;color:#111111}.paid{background:#dcfce7;border:1px solid #16a34a;padding:12px;text-align:center;margin-top:16px;border-radius:8px;font-weight:bold}</style></head><body>
                          <div class="hdr"><div><h1>CRM Starter</h1><div style="font-size:12px;color:#666">your area · (555) 555-0100</div></div><div style="text-align:right"><strong>INVOICE #${inv.id.slice(-8).toUpperCase()}</strong><br><span style="font-size:12px;color:#666">${inv.invoicedAt || today()}</span></div></div>
                          <div style="margin-bottom:16px"><strong>Bill To:</strong><br>${c ? c.firstName + " " + c.lastName : ""}<br>${c?.address || ""}</div>
                          <table><thead><tr><th>Service</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Amount</th></tr></thead><tbody>
                          ${(inv.lineItems || []).map(li => `<tr><td>${li.description}</td><td class="r">${li.quantity}</td><td class="r">$${Number(li.unitPrice).toFixed(2)}</td><td class="r">$${(li.quantity*li.unitPrice).toFixed(2)}</td></tr>`).join("")}
                          </tbody></table>
                          <div style="text-align:right;margin-top:8px"><div class="total">Total: $${Number(inv.total).toFixed(2)}</div></div>
                          ${inv.paidAt ? `<div class="paid">✓ PAID on ${inv.paidAt}</div>` : ""}
                          <script>window.onload=()=>setTimeout(window.print,300)<\/script></body></html>`;
                          const w = window.open("","_blank"); if(w){w.document.write(html);w.document.close();}
                        }} title="Download PDF" className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"><Download size={12} /></button>
                        {!inv.paidAt && <>
                          <button onClick={() => sendReminder(inv)} title="Send reminder" className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/60 hover:text-yellow-400"><Send size={12} /></button>
                          <button onClick={() => markPaid(inv.id)} title="Mark paid" className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400"><CheckCircle size={12} /></button>
                        </>}
                        {inv.paidAt && <button onClick={() => markUnpaid(inv.id)} title="Mark unpaid" className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/60 hover:text-yellow-400"><Undo2 size={12} /></button>}
                        <button onClick={() => deleteInvoice(inv)} title="Delete invoice" className="p-1.5 rounded-lg hover:bg-danger-950/30 text-white/60 hover:text-danger-400"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-white/40">
                <Receipt size={32} className="mx-auto mb-2 opacity-30" />
                <div className="text-sm">No invoices yet</div>
                <div className="text-[10px] mt-1">Approve an estimate and convert it to an invoice to see it here.</div>
              </td></tr>}
            </tbody>
          </table>
        </div>
      </Glass>

      {/* Invoice detail modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing ? "Invoice #" + viewing.id.toUpperCase() : ""} maxW="max-w-2xl">
        {viewing && (() => {
          const c = customers.find(x => x.id === viewing.customerId);
          const age = viewing.invoicedAt ? daysSince(viewing.invoicedAt) : 0;
          return <div className="space-y-4">
            <div className="bg-white text-black rounded-xl p-6">
              <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-brand-600">
                <div><div className="text-2xl font-bold text-brand-700">CRM Starter</div><div className="text-xs text-gray-600 mt-1">Professional Exterior Cleaning</div></div>
                <div className="text-right text-sm"><div className="font-bold text-gray-800">INVOICE</div><div className="text-xs text-gray-600">#{viewing.id.toUpperCase()}</div><div className="text-xs text-gray-600">Invoiced {viewing.invoicedAt}</div></div>
              </div>
              <div className="mb-5 text-sm"><div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Bill to</div><div className="font-semibold">{c?.firstName} {c?.lastName}</div><div className="text-gray-600 text-xs">{c?.address}</div></div>
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-gray-300 text-xs uppercase tracking-wider text-gray-500"><th className="text-left py-2">Description</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Unit</th><th className="text-right py-2">Amount</th></tr></thead>
                <tbody>{viewing.lineItems.map(li => <tr key={li.id} className="border-b border-gray-100"><td className="py-2">{li.description}</td><td className="text-right py-2">{li.quantity}</td><td className="text-right py-2">{fmt(li.unitPrice)}</td><td className="text-right py-2 font-medium">{fmt(li.quantity * li.unitPrice)}</td></tr>)}</tbody>
              </table>
              <div className="ml-auto w-56 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>{fmt(viewing.subtotal)}</span></div>
                {viewing.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>− {fmt(viewing.discount)}</span></div>}
                <div className="flex justify-between"><span className="text-gray-600">Tax</span><span>{fmt(viewing.tax)}</span></div>
                <div className="flex justify-between font-bold text-base border-t-2 border-brand-600 pt-1 text-brand-700"><span>Total Due</span><span>{fmt(viewing.total)}</span></div>
              </div>
              {viewing.paidAt && <div className="mt-5 p-3 bg-green-50 border border-green-300 rounded-lg text-center text-green-900"><CheckCircle size={18} className="inline mb-0.5 mr-1.5" />Paid on {viewing.paidAt}</div>}
              {!viewing.paidAt && age > 14 && <div className="mt-5 p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-900 text-sm"><AlertTriangle size={14} className="inline mr-1.5 mb-0.5" />{age} days past due</div>}
            </div>
            {/* AUDIT (round 12) — full payment history (paid/failed/refunded/
                disputed), written by functions/api/stripe-webhook.ts and this
                page's own Refund button — previously there was nowhere to
                see this at all, only the single most-recent paidAt/
                refundedAt field. */}
            {Array.isArray((viewing as any).paymentLog) && (viewing as any).paymentLog.length > 0 && (
              <Glass className="p-4 !bg-black/40">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Payment History</div>
                <div className="space-y-1.5">
                  {[...(viewing as any).paymentLog].reverse().map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs bg-black/30 rounded-lg px-2.5 py-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={"text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 " + (
                          p.type === "paid" ? "bg-green-900/40 text-green-300" :
                          p.type === "failed" ? "bg-danger-900/40 text-danger-300" :
                          p.type === "refunded" ? "bg-orange-900/40 text-orange-300" :
                          "bg-brand-900/60 text-brand-200"
                        )}>{p.type.toUpperCase()}</span>
                        <span className="text-white/50 truncate">{p.note || "—"}</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {typeof p.amount === "number" && <span className="text-white/70 font-semibold mr-2">{fmt(p.amount)}</span>}
                        <span className="text-white/30">{new Date(p.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Glass>
            )}
            <div className="flex gap-2 justify-end flex-wrap">
              <GBtn variant="ghost" onClick={() => {
                const payLink = "https://crm.com/pay/" + viewing.id;
                navigator.clipboard?.writeText(payLink).catch(() => {});
                toast("Payment link copied ✓");
              }} className="!text-xs"><Link size={11} className="inline mr-1" />Regen Link</GBtn>
              <GBtn variant="ghost" onClick={() => {
                const html = '<!DOCTYPE html><html><head><title>Invoice ' + viewing.id + '</title><style>body{font-family:Arial,sans-serif;padding:40px;max-width:700px;margin:auto;color:#111}h1{color:#111111;margin:0}.hdr{display:flex;justify-content:space-between;align-items:start;border-bottom:2px solid #111111;padding-bottom:16px;margin-bottom:24px}.sub{color:#666;font-size:12px;margin-top:4px}.meta{text-align:right;font-size:13px}.meta strong{color:#222}.bill{margin-bottom:24px}.bill-lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;margin-bottom:4px}.bill-name{font-weight:bold;font-size:15px}.bill-addr{color:#555;font-size:12px}table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px}th{text-align:left;padding:8px;text-transform:uppercase;font-size:10px;letter-spacing:1px;color:#999;border-bottom:1px solid #ccc}td{padding:10px 8px;border-bottom:1px solid #eee}.r{text-align:right}.totals{margin-left:auto;width:280px;font-size:13px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.totals .total{font-weight:bold;font-size:17px;color:#111111;border-top:2px solid #111111;padding-top:8px;margin-top:8px}.paid{background:#dcfce7;border:1px solid #16a34a;color:#14532d;padding:12px;text-align:center;border-radius:8px;margin-top:24px;font-weight:bold}.due{background:#fef9c3;border:1px solid #ca8a04;color:#713f12;padding:12px;text-align:center;border-radius:8px;margin-top:24px}@media print{body{padding:20px}}</style></head><body>' +
                  '<div class="hdr"><div><h1>' + (settings?.companyName || 'CRM Starter') + '</h1><div class="sub">Professional Exterior Cleaning · your area</div></div><div class="meta"><strong>INVOICE</strong><br>#' + viewing.id.toUpperCase() + '<br><span style="color:#666">Invoiced ' + (viewing.invoicedAt || '—') + '</span></div></div>' +
                  '<div class="bill"><div class="bill-lbl">Bill To</div><div class="bill-name">' + (c?.firstName || '') + ' ' + (c?.lastName || '') + '</div><div class="bill-addr">' + (c?.address || '') + '</div></div>' +
                  '<table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Amount</th></tr></thead><tbody>' +
                  viewing.lineItems.map(li => '<tr><td>' + li.description + '</td><td class="r">' + li.quantity + '</td><td class="r">' + fmt(li.unitPrice) + '</td><td class="r"><strong>' + fmt(li.quantity * li.unitPrice) + '</strong></td></tr>').join('') +
                  '</tbody></table>' +
                  '<div class="totals"><div><span>Subtotal</span><span>' + fmt(viewing.subtotal) + '</span></div>' +
                  (viewing.discount > 0 ? '<div style="color:#16a34a"><span>Discount</span><span>− ' + fmt(viewing.discount) + '</span></div>' : '') +
                  '<div><span>Tax</span><span>' + fmt(viewing.tax) + '</span></div><div class="total"><span>Total Due</span><span>' + fmt(viewing.total) + '</span></div></div>' +
                  (viewing.paidAt ? '<div class="paid">✓ PAID on ' + viewing.paidAt + '</div>' : (age > 14 ? '<div class="due">⚠ ' + age + ' days past due — please remit payment.</div>' : '')) +
                  '<div style="margin-top:40px;font-size:11px;color:#888;text-align:center">Thank you for your business. Questions? Call (555) 555-0100</div>' +
                  '<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>';
                const w = window.open("", "_blank");
                if (w) { w.document.write(html); w.document.close(); }
                toast("Opening print dialog — Save as PDF");
              }}><Download size={12} className="inline mr-1.5" />PDF</GBtn>
              {!viewing.paidAt && <>
                <GBtn variant="ghost" className="!text-xs" onClick={() => {
                  navigator.clipboard?.writeText(portalUrlFor(viewing.id)).catch(() => {});
                  toast("Payment link copied ✓");
                }}><Link size={11} className="inline mr-1" />Copy Link</GBtn>
                <GBtn variant="ghost" onClick={() => {
                  const cv = customers.find(x => x.id === viewing?.customerId);
                  if (!cv?.phone) { toast("No phone for this customer"); return; }
                  const msg2 = "Hi " + cv.firstName + "! Your invoice for " + fmt(viewing.total) + " from CRM Starter is ready: " + portalUrlFor(viewing.id);
                  if (settings?.twilioSid) twilioSend(settings, cv.phone, msg2).then(() => { logOutboundSmsToInbox({ contactName: `${cv.firstName} ${cv.lastName}`, contactPhone: cv.phone, customerId: cv.id, body: msg2 }).catch(() => {}); toast("Link sent ✓"); }).catch(e => toast(e.message, "error"));
                  else window.location.href = "sms:" + cv.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg2);
                }} className="!text-xs"><Send size={11} className="inline mr-1" />Text Link</GBtn>
                <GBtn variant="ghost" onClick={() => {
                  const amt = prompt("Partial payment amount ($):", "");
                  if (!amt || isNaN(Number(amt))) return;
                  const partial = Number(amt);
                  const newBalance = Math.max(0, viewing.total - partial);
                  const newPartialPaid = (viewing.partialPaid || 0) + partial;
                  const newPaidAt = newBalance === 0 ? today() : null;
                  // BLOCKER 14 (mobile round 10) — same missing-Supabase-write
                  // bug as markPaid/markUnpaid: local state only, so the next
                  // 10s poll overwrote it with the still-unpaid server row.
                  setEstimates(estimates.map(e => e.id === viewing.id ? { ...e, partialPaid: newPartialPaid, paidAt: newPaidAt } : e));
                  setViewing({ ...viewing, partialPaid: newPartialPaid, paidAt: newPaidAt });
                  (supabase as any).from("estimates").update({ partialPaid: newPartialPaid, paidAt: newPaidAt }).eq("id", viewing.id).select("id")
                    .then((r: any) => {
                      if (r?.error) { console.error("[MarkPaid] partial payment failed:", r.error.message); toast("Saved locally, but failed to sync — " + r.error.message, "red"); }
                      else if (!Array.isArray(r?.data) || r.data.length === 0) { console.error("[MarkPaid] partial payment matched 0 rows for", viewing.id); toast("Saved locally, but the server didn't confirm — it may revert. Try again or refresh to check.", "red"); }
                      else toast("Partial payment of " + fmt(partial) + " recorded · Balance: " + fmt(newBalance), "green");
                    })
                    .catch((e: any) => { console.error("[MarkPaid] partial payment threw:", e?.message); toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red"); });
                }} className="!text-xs"><CreditCard size={11} className="inline mr-1" />Partial Pay</GBtn>
                <GBtn variant="ghost" onClick={() => sendReminder(viewing)}><Send size={12} className="inline mr-1.5" />Remind</GBtn>
                {stripeReady && <GBtn onClick={() => setStripePayInvoice(viewing)} className="!bg-gradient-to-r !from-[#635BFF] !to-[#4F46E5] !border-[#635BFF]/50"><CreditCard size={12} className="inline mr-1.5" />Pay Now</GBtn>}
                {stripeReady && !viewing?.paidAt && (
                  <GBtn variant="ghost" disabled={checkoutLoadingId === viewing?.id} onClick={() => payWithStripeCheckout(viewing)} className="!text-xs">
                    <ExternalLink size={11} className="inline mr-1" />{checkoutLoadingId === viewing?.id ? "Redirecting…" : "Pay with Stripe Checkout"}
                  </GBtn>
                )}
                <GBtn variant="ghost" onClick={() => { markPaid(viewing.id); setViewing({ ...viewing, paidAt: today() }); }}><CheckCircle size={12} className="inline mr-1.5" />Mark Paid</GBtn>
              </>}
              {viewing.paidAt && <>
                {/* SECURITY/CORRECTNESS AUDIT (round 12) — this button used to
                    ONLY flip local paidAt/refundedAt fields — it never called
                    a real refund API at all. Now opens a real full-or-partial
                    refund flow (see refundModal below) that issues the actual
                    Stripe/Square refund first and only updates local state
                    once the processor confirms it; a manually-paid (cash/
                    check) invoice has nothing to refund through either
                    processor, so it still just unmarks locally. */}
                <GBtn
                  variant="ghost"
                  className="!text-xs !border-brand-800/40 !text-brand-400"
                  onClick={() => { setRefundModal({ invoice: viewing }); setRefundMode("full"); setRefundAmountInput(""); }}
                ><Undo2 size={11} className="inline mr-1" />Refund</GBtn>
                <GBtn variant="ghost" onClick={() => { markUnpaid(viewing.id); setViewing({ ...viewing, paidAt: null }); }}><Undo2 size={12} className="inline mr-1.5" />Unpaid</GBtn>
              </>}
              <GBtn variant="danger" onClick={() => deleteInvoice(viewing)}><Trash2 size={12} className="inline mr-1.5" />Delete</GBtn>
            </div>
          </div>;
        })()}
      </Modal>

      {/* FEATURE — "give the owner the option to give refunds and partial
          refunds." Routes to whichever processor actually took the payment
          (paymentProvider, with the id-field-presence fallback for invoices
          paid before that field existed) and always resolves the real
          remaining refundable amount server-side before submitting —
          amount input here is just what the owner wants to refund, capped
          client-side too so the button can't even be pressed with an
          invalid amount. */}
      {refundModal && (() => {
        const inv = refundModal.invoice;
        const isSquare = inv.paymentProvider === "square" || (!inv.paymentProvider && !!inv.squarePaymentId);
        const hasRealCharge = isSquare ? !!inv.squarePaymentId : !!inv.stripePaymentIntentId;
        const paidTotal = Number(inv.totalPaid ?? inv.total ?? 0);
        const alreadyRefunded = Number(inv.refundedAmount || 0);
        const remaining = Math.max(0, paidTotal - alreadyRefunded);
        const partialAmt = Number(refundAmountInput) || 0;
        const validPartial = refundMode === "partial" && partialAmt > 0 && partialAmt <= remaining;
        const canSubmit = hasRealCharge ? (refundMode === "full" || validPartial) : true;
        return (
          <Modal open={true} onClose={() => setRefundModal(null)} title="Issue Refund" maxW="max-w-sm">
            <div className="space-y-4">
              <div className="text-xs text-white/60">
                {hasRealCharge
                  ? `Paid via ${isSquare ? "Square" : "Stripe"} — ${fmt(remaining)} available to refund${alreadyRefunded > 0 ? ` (${fmt(alreadyRefunded)} already refunded)` : ""}.`
                  : "No card charge on file to reverse (paid another way) — this just marks the invoice refunded/unpaid."}
              </div>
              {hasRealCharge && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRefundMode("full")} className={"py-2.5 rounded-xl text-sm font-semibold border transition " + (refundMode === "full" ? "bg-danger-900/30 border-danger-600/50 text-danger-300" : "bg-white/5 border-white/10 text-white/50")}>Full refund</button>
                    <button type="button" onClick={() => setRefundMode("partial")} className={"py-2.5 rounded-xl text-sm font-semibold border transition " + (refundMode === "partial" ? "bg-danger-900/30 border-danger-600/50 text-danger-300" : "bg-white/5 border-white/10 text-white/50")}>Partial refund</button>
                  </div>
                  {refundMode === "full" && <div className="text-sm">Refunding <b>{fmt(remaining)}</b> — the full remaining amount.</div>}
                  {refundMode === "partial" && (
                    <div>
                      <label className="text-xs text-white/60 mb-1 block">Amount to refund (up to {fmt(remaining)})</label>
                      <GInput type="number" min={0.01} max={remaining} step={0.01} value={refundAmountInput} onChange={(e: any) => setRefundAmountInput(e.target.value)} placeholder="0.00" className="!text-sm" />
                      {refundAmountInput !== "" && !validPartial && <div className="text-[10px] text-danger-400 mt-1">Enter an amount between $0.01 and {fmt(remaining)}.</div>}
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2 pt-2">
                <GBtn variant="ghost" onClick={() => setRefundModal(null)} className="flex-1">Cancel</GBtn>
                <GBtn
                  disabled={!canSubmit || refundingInvoice === inv.id}
                  className="flex-1 !bg-brand-700/80 hover:!bg-brand-700 !border-brand-600/50"
                  onClick={async () => {
                    setRefundingInvoice(inv.id);
                    try {
                      const amountCents = refundMode === "partial" ? Math.round(partialAmt * 100) : undefined;
                      let refundedTotal = alreadyRefunded;
                      if (hasRealCharge) {
                        const result = isSquare
                          ? await refundSquarePayment(inv.squarePaymentId, amountCents, inv.id)
                          : await refundPaymentIntent(inv.stripePaymentIntentId, amountCents);
                        refundedTotal = alreadyRefunded + (result.amount / 100);
                      } else {
                        refundedTotal = paidTotal;
                      }
                      const fullyRefunded = refundedTotal >= paidTotal - 0.005;
                      const refundedAt = today();
                      const newStatus = fullyRefunded ? ("refunded" as const) : ("partially_refunded" as const);
                      if (fullyRefunded) markUnpaid(inv.id);
                      setEstimates(prev => prev.map(e => e.id === inv.id ? { ...e, refundedAt, refundedAmount: refundedTotal, stripePaymentStatus: newStatus, ...(fullyRefunded ? { paidAt: null } : {}) } : e));
                      if (viewing?.id === inv.id) setViewing({ ...viewing, refundedAt, refundedAmount: refundedTotal, stripePaymentStatus: newStatus, ...(fullyRefunded ? { paidAt: null } : {}) } as any);
                      // AUDIT FIX — this is the ONLY place a Square refund
                      // ever gets recorded (Square has no webhook — Stripe
                      // refunds also land via stripe-webhook.ts's
                      // charge.refunded handler as a backstop, Square
                      // doesn't). Money has already actually left the
                      // processor by this point (refundSquarePayment/
                      // refundPaymentIntent above already succeeded) — a
                      // silent 0-row RLS mismatch here means the charge was
                      // genuinely refunded but the CRM permanently shows the
                      // invoice still paid, with no way to notice short of
                      // reconciling against the Stripe/Square dashboard by
                      // hand. Must check, not just log-and-move-on.
                      (supabase as any).from("estimates").update({ refundedAt, refundedAmount: refundedTotal, stripePaymentStatus: newStatus, ...(fullyRefunded ? { paidAt: null } : {}) }).eq("id", inv.id).select("id").then(
                        (r: any) => {
                          if (!Array.isArray(r?.data) || r.data.length === 0) toast?.(`Refunded via ${isSquare ? "Square" : "Stripe"}, but the CRM couldn't confirm the invoice update — check Invoices for this customer and fix it manually if it still shows paid.`, "red");
                        },
                        (e: any) => { console.warn("[Refund] sync failed:", e?.message); toast?.(`Refunded via ${isSquare ? "Square" : "Stripe"}, but the CRM couldn't save the refund on this invoice — check Invoices for this customer and fix it manually if it still shows paid. (${e?.message || "sync failed"})`, "red"); }
                      );
                      toast?.(hasRealCharge ? `${fullyRefunded ? "Fully" : "Partially"} refunded via ${isSquare ? "Square" : "Stripe"} ✓` : "Marked refunded", "green");
                      setRefundModal(null);
                    } catch (e: any) {
                      toast?.("Refund failed — " + (e?.message || "unknown error") + ". The invoice was NOT changed.", "red");
                    } finally {
                      setRefundingInvoice(null);
                    }
                  }}
                >{refundingInvoice === inv.id ? "Refunding…" : "Issue Refund"}</GBtn>
              </div>
            </div>
          </Modal>
        );
      })()}

      <StripePaymentModal
        open={!!stripePayInvoice}
        onClose={() => setStripePayInvoice(null)}
        publishableKey={settings?.stripePublishableKey || ""}
        stripeAccountId={(settings as any)?.stripeConnectAccountId}
        amount={stripePayInvoice?.total || 0}
        description={`Invoice #${stripePayInvoice?.id?.slice(-8).toUpperCase() || ""}`}
        onSuccess={(paymentIntentId) => stripePayInvoice && markPaidViaStripe(stripePayInvoice.id, paymentIntentId)}
        invoiceId={stripePayInvoice?.id}
        disableLink
      />

      <InvoicePreviewModal
        open={!!previewInvoiceJob}
        onClose={() => setPreviewInvoiceJob(null)}
        sending={!!previewInvoiceJob && sendingJobInvoiceId === previewInvoiceJob.id}
        onConfirm={(subject, bodyHtml) => sendInvoiceForJob(previewInvoiceJob, subject, bodyHtml)}
        data={previewInvoiceJob ? (() => {
          const cust = customers.find((c: any) => c.id === previewInvoiceJob.customerId);
          return { customerName: cust?.firstName || "Customer", address: previewInvoiceJob.address || "", amount: Number(previewInvoiceJob.amount) || 0, companyName: settings?.companyName || "CRM Starter", payLink: "" };
        })() : null}
      />

      {/* New standalone invoice (FEATURE 7) */}
      <Modal open={newInvOpen} onClose={() => setNewInvOpen(false)} title="New Invoice" maxW="max-w-lg">
        <div className="space-y-4">
          {/* FEATURE 3 — pick a completed job that still needs an invoice */}
          {needsInvoiceJobs.length > 0 && (
            <div className="rounded-xl border border-yellow-700/30 bg-yellow-950/15 p-3">
              <div className="text-xs text-yellow-300/90 font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} />Completed jobs needing an invoice ({needsInvoiceJobs.length})
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {needsInvoiceJobs.map((j: any) => {
                  const cust = customers.find((c: any) => c.id === j.customerId);
                  return (
                    <button key={j.id} onClick={() => prefillFromJob(j)}
                      className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-2 rounded-lg bg-black/30 border border-white/10 hover:border-yellow-600/50 hover:bg-yellow-950/20 transition">
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{cust ? `${cust.firstName} ${cust.lastName}` : j.address}</div>
                        <div className="text-[10px] text-white/40 truncate">{j.address} · {j.scheduledDate}</div>
                      </div>
                      <span className="text-xs font-bold text-green-400 flex-shrink-0">{fmt(j.amount)}</span>
                    </button>
                  );
                })}
              </div>
              <div className="text-[10px] text-white/30 mt-2 text-center">Tap a job to prefill below, or fill it in manually for a standalone invoice.</div>
            </div>
          )}
          <div>
            <label className="text-xs text-white/60 mb-1 block">Customer *</label>
            <GSel value={newInvForm.customerId} onChange={(e: any) => setNewInvForm(f => ({ ...f, customerId: e.target.value }))}>
              <option value="" className="bg-black">Select a customer…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id} className="bg-black">{c.firstName} {c.lastName}</option>)}
            </GSel>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Title / description</label>
            <GInput value={newInvForm.title} onChange={(e: any) => setNewInvForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Service visit + materials" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Line items</label>
            <div className="space-y-2">
              {newInvForm.items.map((it, idx) => (
                <div key={it.id} className="flex gap-2 items-center">
                  <GInput value={it.description} onChange={(e: any) => setNewInvForm(f => ({ ...f, items: f.items.map(x => x.id === it.id ? { ...x, description: e.target.value } : x) }))} placeholder="Description" className="!flex-1" />
                  <GInput type="number" value={it.quantity} onChange={(e: any) => setNewInvForm(f => ({ ...f, items: f.items.map(x => x.id === it.id ? { ...x, quantity: Number(e.target.value) } : x) }))} placeholder="Qty" className="!w-16" />
                  <GInput type="number" value={it.unitPrice} onChange={(e: any) => setNewInvForm(f => ({ ...f, items: f.items.map(x => x.id === it.id ? { ...x, unitPrice: Number(e.target.value) } : x) }))} placeholder="$" className="!w-24" />
                  {newInvForm.items.length > 1 && (
                    <button onClick={() => setNewInvForm(f => ({ ...f, items: f.items.filter(x => x.id !== it.id) }))} className="p-1.5 text-white/40 hover:text-brand-400"><X size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setNewInvForm(f => ({ ...f, items: [...f.items, { id: uid(), description: "", quantity: 1, unitPrice: 0 }] }))} className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={12} />Add line item</button>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <span className="text-sm text-white/60">Total</span>
            <span className="text-xl font-black text-green-400">{fmt(newInvTotal)}</span>
          </div>
          <GBtn onClick={createStandaloneInvoice} disabled={creatingInvoice} className="w-full !justify-center !py-3">{creatingInvoice ? "Creating…" : "Create Invoice"}</GBtn>
          <div className="text-[10px] text-white/30 text-center">After creating, open the invoice to send it (Gmail / SMS) or take payment. It appears in the list and the customer can pay via the client portal.</div>
        </div>
      </Modal>
    </div>
  );
}

// ===== CLIENT PORTAL =====
// ===== CUSTOMER PORTAL LOGIN =====
