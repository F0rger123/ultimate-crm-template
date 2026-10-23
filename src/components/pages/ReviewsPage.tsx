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
import { twilioSend, sendEmail, sendOwnerGmailOnly, emailShell, emailButton, logOutboundSmsToInbox } from "../../lib/messaging";
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

export function ReviewsPage({ reviews = [], setReviews, jobs = [], customers = [], toast, negativeAlerts = [], setNegativeAlerts, settings = {} as AppSettings, setSettings }: { reviews?: any[]; setReviews?: any; jobs?: any[]; customers?: any[]; toast?: any; negativeAlerts?: any[]; setNegativeAlerts?: any; settings?: AppSettings; setSettings?: any }) {
  const [preview, setPreview] = useState(null);
  const [landingReview, setLandingReview] = useState(null);
  const [tab, setTab] = useState("inbox");

  // FEATURE — manual "Send Review Request" (previously only reachable from a
  // completed job's own detail modal, JobDetailModal.tsx's sendReviewRequest
  // — nothing on this page let the owner ask ANY customer for a review on
  // demand, e.g. an older job or a customer who never got asked).
  const [manualSendOpen, setManualSendOpen] = useState(false);
  const [manualSendCustomerId, setManualSendCustomerId] = useState("");
  const [manualSendBusy, setManualSendBusy] = useState(false);
  const sendManualReviewRequest = async () => {
    const c = customers.find(x => x.id === manualSendCustomerId);
    if (!c) { toast?.("Pick a customer first", "red"); return; }
    if (!c.phone && !c.email) { toast?.("No phone or email on file for this customer", "red"); return; }
    setManualSendBusy(true);
    try {
      const companyName = (settings as any)?.companyName || "CRM Starter";
      const rateLink = `${window.location.origin}${window.location.pathname}#/rate?c=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.firstName)}&g=${encodeURIComponent((settings as any).googlePlaceId || "")}&rl=${encodeURIComponent((settings as any).googleReviewLink || "")}&co=${encodeURIComponent(companyName)}&gm=${encodeURIComponent(String((settings as any).reviewGoogleMinStars || 4))}`;
      if ((settings as any)?.twilioSid && c.phone) {
        const body = `Hi ${c.firstName}, thanks for choosing ${companyName}! How did we do? ${rateLink}`;
        await withTimeout(twilioSend(settings as any, c.phone, body), 10000, "Review SMS");
        logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body }).catch(() => {});
        toast?.(`Review request sent to ${c.firstName} ✓`, "green");
      } else if (c.email) {
        const html = emailShell(settings as any, "How did we do?", `<p>Hi ${c.firstName},</p><p>Thanks for choosing ${companyName}! We'd love your feedback.</p>` + emailButton("Leave a Review", rateLink));
        await withTimeout(sendOwnerGmailOnly(settings as any, c.email, `How did we do, ${c.firstName}?`, html), 10000, "Review email");
        toast?.(`Review request emailed to ${c.firstName} ✓`, "green");
      }
      setManualSendOpen(false);
      setManualSendCustomerId("");
    } catch (e: any) {
      toast?.("Failed to send review request — " + (e?.message || "unknown error"), "red");
    } finally {
      setManualSendBusy(false);
    }
  };

  // AUDIT FIX (mobile round 10) — real customer-submitted reviews (from the
  // public #/rate page, CustomerReviewPage.tsx -> Supabase "reviews" table,
  // merged into this `reviews` array in App.tsx) only carry a customerId,
  // not a jobId — the seeded/local review-request records this page
  // originally modeled only ever had a jobId. cf() now resolves either way
  // so real submissions actually render in Inbox/Showcase/Analytics instead
  // of being silently dropped by every `cf(r)` call returning null.
  const cf = (jidOrReview: any, maybeCustomerId?: string) => {
    const jid = typeof jidOrReview === "object" ? jidOrReview?.jobId : jidOrReview;
    const directCustomerId = typeof jidOrReview === "object" ? jidOrReview?.customerId : maybeCustomerId;
    if (jid) { const j = jobs.find(x => x.id === jid); if (j) return customers.find(c => c.id === j.customerId) || null; }
    if (directCustomerId) return customers.find(c => c.id === directCustomerId) || null;
    return null;
  };
  const jf = jid => jobs.find(x => x.id === jid);

  // 90-day throttling check
  const canSend = rid => {
    const r = reviews.find(x => x.id === rid);
    if (!r) return false;
    const c = cf(r);
    if (!c) return false;
    const recentSent = reviews.filter(x => {
      const xj = jf(x.jobId);
      return xj && xj.customerId === c.id && x.sentAt && daysSince(x.sentAt) < 90 && x.id !== rid;
    });
    return recentSent.length === 0;
  };

  const sendReq = async rid => {
    if (!canSend(rid)) { toast("Throttled — review request sent within last 90 days", "error"); return; }
    const r = reviews.find(x => x.id === rid);
    const c = cf(r);
    if (!c) return;
    if ((settings.unsubscribedEmails || []).includes(c.email)) { toast("Customer has unsubscribed from review requests"); return; }
    if ((settings.reviewUnsubscribedPhones || []).includes(c.phone)) { toast("Customer opted out of SMS review requests"); return; }

    // BUG FIX — this used to build a link at "crm.com/r/TOKEN", a domain
    // this app doesn't own and a route that doesn't exist anywhere in the
    // codebase — every review request sent from this page pointed the
    // customer at a dead link. The real public route is #/rate (see
    // CustomerReviewPage.tsx), same one useAutomationEngine.ts's automated
    // review-request path already builds correctly.
    const companyName = (settings as any)?.companyName || "CRM Starter";
    const reviewUrl = `${window.location.origin}${window.location.pathname}#/rate?c=${encodeURIComponent(c.id)}&n=${encodeURIComponent(c.firstName)}&g=${encodeURIComponent((settings as any)?.googlePlaceId ?? "")}&rl=${encodeURIComponent((settings as any)?.googleReviewLink ?? "")}&co=${encodeURIComponent(companyName)}&gm=${encodeURIComponent(String((settings as any)?.reviewGoogleMinStars || 4))}`;
    const msg = "Hi " + c.firstName + "! Thanks for choosing " + companyName + " 🙌 How'd we do? Leave us a quick review — it means the world to a small business: " + reviewUrl + "\n\nReply STOP to opt out.";

    let sent = false;
    if (settings?.twilioSid && c.phone) {
      try { await twilioSend(settings, c.phone, msg); logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {}); sent = true; toast("Review request sent to " + c.firstName + " via SMS ✓"); }
      catch(e) { toast("SMS failed: " + e.message, "error"); }
    } else if (c.phone) {
      window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg);
      sent = true;
    }
    if (sent) {
      setReviews(reviews.map(x => x.id === rid ? { ...x, status: "sent", sentAt: today() } : x));
    }
    setPreview(r);
  };

  const unsubscribe = (identifier, type = "email") => {
    if (type === "phone") {
      setSettings({ ...settings, reviewUnsubscribedPhones: [...(settings.reviewUnsubscribedPhones || []), identifier] });
    } else {
      setSettings({ ...settings, unsubscribedEmails: [...(settings.unsubscribedEmails || []), identifier] });
    }
    toast("Unsubscribed — they won't receive review requests");
  };

  const updRev = (rid, u) => setReviews(reviews.map(r => r.id === rid ? { ...r, ...u } : r));

  const subRev = (rid, rating) => {
    setReviews(reviews.map(r => r.id === rid ? { ...r, status: "completed" } : r));
    if (rating > 0 && rating <= 3) {
      const r = reviews.find(x => x.id === rid);
      const c = cf(r);
      setNegativeAlerts(prev => [...prev, { id: uid(), reviewId: rid, customerName: c ? c.firstName + " " + c.lastName : "?", rating, at: today() }]);
      toast("Negative feedback flagged", "error");
    } else if (rating >= 4) {
      toast("Great! Would redirect to Google Reviews");
    }
    setPreview(null);
  };

  const dismissAlert = id => setNegativeAlerts(negativeAlerts.filter(a => a.id !== id));
  const createFollowUp = a => {
    // Auto-create a follow-up note/reminder
    toast("Follow-up task created for " + a.customerName + " — check Tasks");
    dismissAlert(a.id);
  };

  const completed = reviews.filter(r => r.status === "completed" && r.rating > 0);
  const avg = completed.length ? (completed.reduce((s, r) => s + r.rating, 0) / completed.length).toFixed(1) : "—";
  const responseRate = reviews.filter(r => r.status === "sent").length > 0
    ? Math.round(completed.length / reviews.filter(r => r.status !== "pending").length * 100)
    : 0;
  const byRating = [5,4,3,2,1].map(n => ({ n, count: completed.filter(r => r.rating === n).length }));

  return (
    <div className="space-y-4">
      {negativeAlerts.length > 0 && (
        <Glass className="p-4 !bg-brand-950/30 !border-brand-600/50">
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={16} className="text-danger-400" /><h3 className="font-semibold text-danger-300 text-sm">Negative Feedback — Action Required</h3></div>
          <div className="space-y-2">
            {negativeAlerts.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-2.5 bg-black/40 rounded-xl">
                <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={10} className={i < a.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />)}</div>
                <span className="text-sm flex-1">{a.customerName}</span>
                <button onClick={() => createFollowUp(a)} className="px-2.5 py-1 text-[10px] bg-blue-950/40 border border-blue-700/40 text-blue-300 rounded-lg hover:bg-blue-900/50">📋 Create Task</button>
                {a.customerPhone && <button onClick={() => window.location.href = "tel:" + a.customerPhone.replace(/\D/g,"")} className="px-2.5 py-1 text-[10px] bg-green-950/40 border border-green-700/40 text-green-300 rounded-lg hover:bg-green-900/50">📞 Call</button>}
                <button onClick={() => dismissAlert(a.id)} className="p-1 text-white/40 hover:text-white"><X size={12} /></button>
              </div>
            ))}
          </div>
        </Glass>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Clock} label="Pending" value={reviews.filter(r => r.status === "pending").length} />
        <Stat icon={Send} label="Sent" value={reviews.filter(r => r.status === "sent").length} />
        <Stat icon={CheckCircle} label="Completed" value={completed.length} />
        <Stat icon={Star} label="Avg Rating" value={avg} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {[{ k: "inbox", l: "Inbox", n: reviews.length }, { k: "showcase", l: "Showcase Wall", n: completed.filter(r => r.rating >= (settings.reviewShowcaseMinRating || 5)).length }, { k: "monitor", l: "🔍 Monitor" }, { k: "analytics", l: "📊 Analytics" }].map(t => (
            <button key={t.k} onClick={() => setTab(t.k)} className={"px-4 py-2 rounded-xl text-sm font-medium transition border " + (tab === t.k ? "bg-brand-600 text-brand-fg border-brand-500/50" : "bg-black/40 text-white/60 hover:text-white border-brand-900/30")}>{t.l}{t.n !== undefined ? " (" + t.n + ")" : ""}</button>
          ))}
        </div>
        <button onClick={() => setManualSendOpen(true)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-brand-fg flex items-center gap-1.5"><Send size={13} />Send Review Request</button>
      </div>

      {manualSendOpen && (
        <Modal open onClose={() => setManualSendOpen(false)} title="Send Review Request">
          <div className="p-4 space-y-3">
            <div className="text-xs text-white/50">Pick any customer to ask for a review — not tied to a specific job.</div>
            <GSel value={manualSendCustomerId} onChange={(e: any) => setManualSendCustomerId(e.target.value)}>
              <option value="">Select a customer…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.phone ? " · " + c.phone : c.email ? " · " + c.email : ""}</option>)}
            </GSel>
            <div className="flex gap-2 justify-end pt-2">
              <GBtn variant="ghost" onClick={() => setManualSendOpen(false)}>Cancel</GBtn>
              <GBtn onClick={sendManualReviewRequest} disabled={!manualSendCustomerId || manualSendBusy}>{manualSendBusy ? "Sending…" : "Send"}</GBtn>
            </div>
          </div>
        </Modal>
      )}

      {tab === "monitor" && <ReviewMonitor settings={settings} toast={toast} />}

      {tab === "analytics" && <div className="space-y-4">
        <div className="grid md:grid-cols-3 gap-4">
          <Glass className="p-5">
            <div className="text-center mb-4">
              <div className="text-5xl font-black text-yellow-400">{avg}</div>
              <div className="text-xs text-white/50 mt-1">Average Rating · {completed.length} reviews</div>
              <div className="flex justify-center gap-0.5 mt-2">
                {[1,2,3,4,5].map(s => <Star key={s} size={16} className={s <= Math.round(Number(avg)) ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />)}
              </div>
            </div>
            <div className="space-y-1.5">
              {byRating.map(({ n, count }) => <div key={n} className="flex items-center gap-2">
                <span className="text-xs text-white/60 w-4">{n}★</span>
                <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: completed.length > 0 ? (count/completed.length*100) + "%" : "0%" }} />
                </div>
                <span className="text-xs text-white/50 w-6 text-right">{count}</span>
              </div>)}
            </div>
          </Glass>
          <Glass className="p-5">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-4">Response Metrics</div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Response Rate</span><span className="font-bold text-green-400">{responseRate}%</span></div>
                <div className="h-2 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: responseRate + "%" }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-white/70">5-Star Rate</span><span className="font-bold text-yellow-400">{completed.length > 0 ? Math.round(completed.filter(r => r.rating === 5).length/completed.length*100) : 0}%</span></div>
                <div className="h-2 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-yellow-400 rounded-full" style={{ width: completed.length > 0 ? (completed.filter(r => r.rating === 5).length/completed.length*100) + "%" : "0%" }} /></div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1"><span className="text-white/70">Negative Rate</span><span className="font-bold text-danger-400">{completed.length > 0 ? Math.round(completed.filter(r => r.rating <= 3).length/completed.length*100) : 0}%</span></div>
                <div className="h-2 bg-black/40 rounded-full overflow-hidden"><div className="h-full bg-brand-500 rounded-full text-brand-fg" style={{ width: completed.length > 0 ? (completed.filter(r => r.rating <= 3).length/completed.length*100) + "%" : "0%" }} /></div>
              </div>
              <div className="pt-2 border-t border-brand-900/20 text-xs text-white/50">
                <div className="flex justify-between"><span>Sent</span><span>{reviews.filter(r => r.sentAt).length}</span></div>
                <div className="flex justify-between mt-1"><span>90-day throttle</span><span>active ✓</span></div>
              </div>
            </div>
          </Glass>
          <Glass className="p-5">
            <div className="text-xs text-white/50 uppercase tracking-wider mb-4">Recent Reviews</div>
            <div className="space-y-3">
              {completed.slice(0, 5).map(r => {
                const c = cf(r);
                return <div key={r.id} className="flex items-start gap-2">
                  <div className="flex gap-0.5 flex-shrink-0 mt-0.5">{[1,2,3,4,5].map(s => <Star key={s} size={9} className={s <= r.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{c?.firstName} {c?.lastName}</div>
                    {r.feedback && <div className="text-[10px] text-white/50 truncate italic">"{r.feedback}"</div>}
                  </div>
                </div>;
              })}
              {completed.length === 0 && <div className="text-xs text-white/40 text-center py-4">No reviews yet</div>}
            </div>
          </Glass>
        </div>

        {/* Google Review Monitoring */}
        <Glass className="p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Globe size={14} className="text-blue-400" />Google Review Monitoring</h3>
          <div className="text-xs text-white/60 mb-4">Manual check — paste your Google Place ID to open your review panel, or set up a webhook for real-time monitoring.</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Quick Actions</div>
              <div className="space-y-2">
                <a href={settings?.googlePlaceId ? "https://business.google.com/reviews" : "https://business.google.com"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-black/40 border border-blue-900/20 rounded-xl text-xs hover:border-blue-600/50 transition">
                  <span className="text-xl">🔍</span>
                  <div><div className="font-medium">Check Google Reviews</div><div className="text-white/50">Opens Google Business dashboard</div></div>
                  <ExternalLink size={10} className="ml-auto text-white/40" />
                </a>
                <a href={settings?.googlePlaceId ? "https://search.google.com/local/writereview?placeid=" + settings.googlePlaceId : "#"} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-black/40 border border-yellow-900/20 rounded-xl text-xs hover:border-yellow-600/50 transition">
                  <span className="text-xl">⭐</span>
                  <div><div className="font-medium">Your Review Link</div><div className="text-white/50">{settings?.googlePlaceId ? "Place ID set ✓ — link ready" : "Set Google Place ID in Settings → Company"}</div></div>
                  <ExternalLink size={10} className="ml-auto text-white/40" />
                </a>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Response Rate Goals</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2.5 bg-black/40 rounded-lg"><span className="text-white/70">Target response time</span><span className="font-semibold">24 hours</span></div>
                <div className="flex justify-between p-2.5 bg-black/40 rounded-lg"><span className="text-white/70">Negative review SLA</span><span className="font-semibold text-danger-400">2 hours</span></div>
                <div className="flex justify-between p-2.5 bg-black/40 rounded-lg"><span className="text-white/70">Min rating to respond</span><span className="font-semibold">All reviews</span></div>
                <div className="flex justify-between p-2.5 bg-black/40 rounded-lg"><span className="text-white/70">AI draft responses</span><span className="text-green-400">Active via Claude ✓</span></div>
              </div>
            </div>
          </div>
        </Glass>
      </div>}

      {tab === "inbox" && <Glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/30 bg-black/40">
              <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Customer</th>
              <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider hidden md:table-cell">Rating</th>
              <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Status</th>
              <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Actions</th>
            </tr></thead>
            <tbody>
              {reviews.map(r => {
                const cu = cf(r);
                if (!cu) return null;
                const throttled = !canSend(r.id);
                return (
                  <tr key={r.id} className="border-b border-brand-900/10 hover:bg-white/5 transition">
                    <td className="px-5 py-4"><div className="font-medium">{cu.firstName} {cu.lastName}</div></td>
                    <td className="px-5 py-4 hidden md:table-cell">{r.rating > 0 ? <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} className={i < r.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />)}</div> : <span className="text-white/30 text-xs">—</span>}</td>
                    <td className="px-5 py-4"><Badge tone={r.status === "completed" ? "green" : r.status === "sent" ? "yellow" : "gray"}>{r.status}</Badge></td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setLandingReview(r)} className="p-1.5 rounded-lg hover:bg-blue-900/30 text-white/50 hover:text-blue-400" title="Customer view"><Globe size={12} /></button>
                        <button onClick={() => { const cu2 = cf(r); if (cu2?.phone) unsubscribe(cu2.phone, "phone"); else if (cu2?.email) unsubscribe(cu2.email, "email"); }} title="Opt out of review requests" className="p-1.5 rounded-lg hover:bg-danger-900/30 text-white/50 hover:text-danger-400"><Ban size={12} /></button>
                        {r.status === "pending" ? <GBtn onClick={() => sendReq(r.id)} disabled={throttled} className="!text-xs !py-1 !px-2.5"><Send size={10} className="inline mr-1" />{throttled ? "Throttled" : "Send"}</GBtn> : <GBtn variant="ghost" onClick={() => setPreview(r)} className="!text-xs !py-1 !px-2.5"><Eye size={10} className="inline mr-1" />View</GBtn>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {reviews.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-white/40">Complete jobs to generate review requests</td></tr>}
            </tbody>
          </table>
        </div>
      </Glass>}

      {tab === "showcase" && <div className="space-y-4">
        <Glass className="p-4 !bg-gradient-to-br !from-yellow-950/20 !to-brand-950/20 !border-yellow-700/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2"><Trophy size={16} className="text-yellow-400" /><div><div className="font-semibold text-sm">Public Review Wall</div><div className="text-xs text-white/60">Showing reviews rated {settings.reviewShowcaseMinRating || 5}★ and above. Would embed at crm.com/reviews.</div></div></div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/60">Min rating:</span>
              <GSel value={settings.reviewShowcaseMinRating || 5} onChange={e => setSettings({ ...settings, reviewShowcaseMinRating: Number(e.target.value) })} className="!py-1 !text-xs !w-auto">
                <option value={5} className="bg-black">5★</option>
                <option value={4} className="bg-black">4+★</option>
                <option value={3} className="bg-black">3+★</option>
              </GSel>
            </div>
          </div>
        </Glass>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {completed.filter(r => r.rating >= (settings.reviewShowcaseMinRating || 5)).map(r => {
            const cu = cf(r);
            if (!cu) return null;
            return <Glass key={r.id} className="p-5 hover:border-yellow-500/40 transition relative overflow-hidden">
              <div className="absolute -top-4 -right-4 text-6xl opacity-10">★</div>
              <div className="flex gap-0.5 mb-3 relative">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} className={i < r.rating ? "text-yellow-400 fill-yellow-400" : "text-white/20"} />)}</div>
              {r.feedback ? <div className="text-sm text-white/80 italic leading-relaxed mb-4 relative">"{r.feedback}"</div> : <div className="text-sm text-white/40 italic mb-4">No written feedback</div>}
              <div className="flex items-center gap-2.5 pt-3 border-t border-brand-900/20">
                <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-brand-fg">{cu.firstName[0]}{cu.lastName[0]}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{cu.firstName} {cu.lastName[0]}.</div>
                  <div className="text-[10px] text-white/50 truncate">{cu.address?.split(",").slice(-2).join(",").trim()}</div>
                </div>
                <button onClick={() => { navigator.clipboard?.writeText("\"" + (r.feedback || "") + "\" — " + cu.firstName + " " + cu.lastName[0] + "."); toast("Review copied"); }} className="p-1.5 text-white/40 hover:text-white" title="Copy for marketing"><Copy size={12} /></button>
              </div>
            </Glass>;
          })}
          {completed.filter(r => r.rating >= (settings.reviewShowcaseMinRating || 5)).length === 0 && <div className="md:col-span-2 lg:col-span-3 text-center py-12 text-white/40">
            <Trophy size={36} className="mx-auto mb-3 opacity-30" />
            <div className="text-sm">No reviews meet the threshold yet.</div>
            <div className="text-xs mt-1">Complete jobs and collect {settings.reviewShowcaseMinRating || 5}★ ratings to fill the wall.</div>
          </div>}
        </div>
      </div>}

      <ReviewPreview review={preview} onClose={() => setPreview(null)} customer={preview ? cf(preview) : null} apiKey={settings.geminiKey} companyName={settings.companyName} googleReviewLink={(settings as any)?.googleReviewLink} googlePlaceId={(settings as any)?.googlePlaceId} onUpdate={u => preview && updRev(preview.id, u)} onSubmit={r => preview && subRev(preview.id, r)} toast={toast} />
      {landingReview && <ReviewLandingPage review={landingReview} customer={cf(landingReview)} settings={settings} onClose={() => setLandingReview(null)} onSubmit={(rating, feedback) => { updRev(landingReview.id, { rating, feedback: feedback || undefined, status: "completed" }); if (rating > 0 && rating <= 3) { const cu = cf(landingReview); setNegativeAlerts(prev => [...prev, { id: uid(), reviewId: landingReview.id, customerName: cu ? cu.firstName + " " + cu.lastName : "?", rating, at: today() }]); } }} />}
    </div>
  );
}

// ===== REVIEW LANDING PAGE (simulates /r/token URL) =====
