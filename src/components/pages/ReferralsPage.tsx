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
import { twilioSend, sendEmail, logOutboundSmsToInbox } from "../../lib/messaging";
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

export function ReferralsPage({ customers = [], setCustomers = (() => {}) as any, jobs = [], toast, settings = {} as AppSettings, setSettings = (() => {}) as any }: { customers?: any[]; setCustomers?: any; jobs?: any[]; toast?: any; settings?: AppSettings; setSettings?: any }) {
  const [copied, setCopied] = useState(null);
  const [sending, setSending] = useState(null);
  const [tab, setTab] = useState("customers"); // customers | leaderboard | settings
  // Lives on settings (not a separate persisted store) so the credit amount
  // awarded automatically when a referred customer's first job completes
  // (in JobsPage.tsx) always matches what's configured here.
  const rewardSettings = (settings as any).referralSettings || { referrerCredit: 25, refereeDiscount: 10, refereeDiscountType: "percent", autoSendRequest: true, requestDelay: 7 };
  const setRewardSettings = (updater: any) => setSettings((s: any) => ({ ...s, referralSettings: typeof updater === "function" ? updater(rewardSettings) : updater }));

  // Real referral data — who each customer actually referred (referredBy on
  // the referee), and how much revenue those referred customers generated.
  // Ensures every customer has a stable code instead of deriving one on the
  // fly (new customers get one set at creation in CustomersPage.tsx; backfill
  // here for any older records that predate that).
  const codeFor = (c: any) => c.referralCode || (c.firstName?.slice(0, 3) || "REF").toUpperCase() + c.id.slice(-4).toUpperCase();
  const withM = customers.map(c => {
    const referred = customers.filter((x: any) => x.referredBy === c.id);
    const revenue = referred.reduce((s: number, r: any) => s + jobs.filter((j: any) => j.customerId === r.id && j.status === "completed").reduce((s2: number, j: any) => s2 + (Number(j.amount) || 0), 0), 0);
    return { ...c, m: { code: codeFor(c), count: referred.length, revenue } };
  }).sort((a, b) => b.m.count - a.m.count);
  const totRefs = withM.reduce((s, c) => s + c.m.count, 0);
  const totRev = withM.reduce((s, c) => s + c.m.revenue, 0);
  const top = withM.find(c => c.m.count > 0);
  const totalCreditOwed = customers.reduce((s: number, c: any) => s + (Number(c.referralCreditOwed) || 0), 0);

  const applyCredit = (c: any) => {
    const owed = Number(c.referralCreditOwed) || 0;
    if (owed <= 0) return;
    const newApplied = (Number(c.referralCreditApplied) || 0) + owed;
    setCustomers((prev: any[]) => prev.map(x => x.id === c.id ? { ...x, referralCreditOwed: 0, referralCreditApplied: newApplied } : x));
    // BUG FIX — "make sure referrals actually work." This only ever
    // touched local React state — never Supabase — so applying a credit
    // looked like it worked, then silently reverted on the next sync from
    // the server (which still had the old referralCreditOwed).
    (supabase as any).from("customers").update({ referralCreditOwed: 0, referralCreditApplied: newApplied }).eq("id", c.id).select("id")
      .then((r: any) => { if (r?.error || !r?.data?.length) toast?.("Applied locally, but failed to sync — " + (r?.error?.message || "try again"), "red"); })
      .catch((e: any) => toast?.("Applied locally, but failed to sync — " + (e?.message || ""), "red"));
    toast?.(`$${owed} referral credit applied for ${c.firstName} — deduct it on their next invoice`, "green");
  };

  const copy = (code, channel = "link") => {
    const url = `${window.location.origin}${window.location.pathname}#/referral?ref=${code}`;
    const msg = "I use CRM Starter for my home — they're great! Use my code " + code + " and get 10% off: " + url;
    if (channel === "link") {
      navigator.clipboard?.writeText(url).catch(() => {});
      toast("Referral link copied ✓");
    } else if (channel === "sms") {
      window.location.href = "sms:?body=" + encodeURIComponent(msg);
    } else if (channel === "whatsapp") {
      window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
    }
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const sendReferralRequest = async c => {
    setSending(c.id);
    // BUG FIX — "crm.com/refer/CODE" isn't a real domain/route this app
    // owns; the actual referral landing page is #/r/CODE (ReferralLanding.tsx,
    // wired in App.tsx). Every referral text sent from here pointed at a
    // dead link.
    const companyName = (settings as any)?.companyName || "CRM Starter";
    const referUrl = `${window.location.origin}${window.location.pathname}#/r/${c.m.code}`;
    const msg = "Hi " + c.firstName + "! Thanks for being a loyal " + companyName + " customer 🙏 Know anyone who needs exterior cleaning? Share your unique link and earn $" + rewardSettings.referrerCredit + " credit: " + referUrl + " — They save " + rewardSettings.refereeDiscount + (rewardSettings.refereeDiscountType === "percent" ? "%" : "$") + " off their first service. Thanks!";
    if (settings?.twilioSid && c.phone) {
      try {
        await twilioSend(settings, c.phone, msg);
        logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: msg }).catch(() => {});
        toast("Referral request sent to " + c.firstName + " ✓");
      } catch(e) { toast(e.message, "error"); }
    } else if (c.phone) {
      window.location.href = "sms:" + c.phone.replace(/\D/g,"") + "?body=" + encodeURIComponent(msg);
    } else {
      toast("No phone number for " + c.firstName, "error");
    }
    setSending(null);
  };

  const tierFor = count => {
    const sorted = [...seedRewardTiers].sort((a, b) => b.refs - a.refs);
    return sorted.find(t => count >= t.refs) || null;
  };
  const nextTier = count => [...seedRewardTiers].sort((a, b) => a.refs - b.refs).find(t => t.refs > count) || null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <Stat icon={Award} label="Total Referrals" value={totRefs} />
        <Stat icon={DollarSign} label="Referral Revenue" value={fmt(totRev)} />
        <Stat icon={Star} label="Top Referrer" value={top ? top.firstName + " " + top.lastName[0] + "." : "—"} />
        <Stat icon={CreditCard} label="Credit Owed" value={fmt(totalCreditOwed)} />
      </div>

      {/* Reward tiers */}
      <Glass className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Trophy size={14} className="text-yellow-400" /><h3 className="font-semibold text-sm">Reward Tiers</h3></div>
          <div className="text-[10px] text-white/40">Referrer earns ${rewardSettings.referrerCredit} · Referee gets {rewardSettings.refereeDiscount}{rewardSettings.refereeDiscountType === "percent" ? "%" : "$"} off</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {seedRewardTiers.map((t, i) => {
            const atTier = withM.filter(c => c.m.count >= t.refs).length;
            return <div key={i} className="p-3 bg-black/40 border border-brand-900/30 rounded-xl relative overflow-hidden">
              <div className="absolute top-2 right-2 text-2xl">{t.icon}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider">Tier {i + 1}</div>
              <div className="text-lg font-bold mt-1">{t.refs}+ refs</div>
              <div className="text-[11px] text-white/70 mt-1 leading-tight">{t.reward}</div>
              <div className="mt-2 pt-2 border-t border-brand-900/30 text-[10px] text-brand-400">{atTier} qualify</div>
            </div>;
          })}
        </div>
      </Glass>

      {/* Tab bar */}
      <div className="flex gap-2">
        {[["customers","👥 Customers"],["leaderboard","🏆 Leaderboard"],["program","⚙️ Program"]].map(([k,l]) =>
          <button key={k} onClick={() => setTab(k)} className={"px-4 py-2 rounded-xl text-xs font-semibold border transition " + (tab === k ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-white/10 text-white/60 hover:text-white")}>{l}</button>
        )}
      </div>

      {tab === "customers" && <Glass className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-brand-900/30 bg-black/40">
              <th className="text-left px-4 py-3 text-xs uppercase text-white/60">Customer</th>
              <th className="text-left px-4 py-3 text-xs uppercase text-white/60 hidden md:table-cell">Code</th>
              <th className="text-center px-4 py-3 text-xs uppercase text-white/60">Refs</th>
              <th className="text-right px-4 py-3 text-xs uppercase text-white/60 hidden lg:table-cell">Revenue</th>
              <th className="text-right px-4 py-3 text-xs uppercase text-white/60">Share & Send</th>
            </tr></thead>
            <tbody>
              {withM.map(c => {
                const cur = tierFor(c.m.count);
                const nxt = nextTier(c.m.count);
                const prog = nxt ? Math.round((c.m.count / nxt.refs) * 100) : 100;
                return <tr key={c.id} className="border-b border-brand-900/10 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-brand-fg">{c.firstName[0]}</div>
                      <div>
                        <div className="font-medium text-sm">{c.firstName} {c.lastName}</div>
                        {nxt && <div className="text-[9px] text-white/40">{c.m.count}/{nxt.refs} to {nxt.icon}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell"><span className="font-mono text-xs text-brand-400 bg-brand-950/30 px-2 py-1 rounded">{c.m.code}</span></td>
                  <td className="px-4 py-3 text-center">
                    {cur ? <span className="text-lg" title={cur.reward}>{cur.icon}</span> : null}
                    <span className="font-bold text-sm ml-1">{c.m.count}</span>
                  </td>
                  <td className="px-4 py-3 text-right hidden lg:table-cell"><span className={c.m.revenue > 0 ? "text-brand-400 font-bold" : "text-white/30"}>{fmt(c.m.revenue)}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {Number(c.referralCreditOwed) > 0 && (
                        <GBtn onClick={() => applyCredit(c)} className="!text-[10px] !py-1 !px-2 !bg-green-700 hover:!bg-green-600">
                          ${c.referralCreditOwed} owed — Apply
                        </GBtn>
                      )}
                      <button onClick={() => copy(c.m.code, "link")} title="Copy link" className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition"><Link size={11} /></button>
                      <button onClick={() => copy(c.m.code, "sms")} title="Share via SMS" className="p-1.5 rounded-lg bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border border-blue-800/40 transition"><MessageSquare size={11} /></button>
                      <button onClick={() => copy(c.m.code, "whatsapp")} title="Share via WhatsApp" className="p-1.5 rounded-lg bg-green-950/40 hover:bg-green-900/50 text-green-300 border border-green-800/40 transition"><Share2 size={11} /></button>
                      <GBtn onClick={() => sendReferralRequest(c)} disabled={sending === c.id} className="!text-[10px] !py-1 !px-2">
                        {sending === c.id ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <><Send size={9} className="inline mr-0.5" />Ask</>}
                      </GBtn>
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </Glass>}

      {tab === "leaderboard" && <Glass className="p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Trophy size={14} className="text-yellow-400" />Referral Leaderboard</h3>
        <div className="space-y-3">
          {withM.filter(c => c.m.count > 0).slice(0, 10).map((c, i) => (
            <div key={c.id} className={"flex items-center gap-4 p-3 rounded-xl border " + (i === 0 ? "bg-yellow-950/20 border-yellow-700/40" : i === 1 ? "bg-gray-800/30 border-gray-600/40" : i === 2 ? "bg-orange-950/20 border-orange-800/40" : "bg-black/40 border-white/5")}>
              <div className={"w-10 h-10 rounded-full flex items-center justify-center text-lg font-black " + (i === 0 ? "bg-yellow-500 text-black" : i === 1 ? "bg-gray-400 text-black" : i === 2 ? "bg-orange-500 text-black" : "bg-white/10 text-white/60")}>
                {i < 3 ? ["🥇","🥈","🥉"][i] : "#" + (i + 1)}
              </div>
              <div className="flex-1">
                <div className="font-bold">{c.firstName} {c.lastName}</div>
                <div className="text-xs text-white/50">{fmt(c.m.revenue)} referred revenue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black text-brand-400">{c.m.count}</div>
                <div className="text-[10px] text-white/40">referrals</div>
              </div>
              {(() => { const t = tierFor(c.m.count); return t ? <span className="text-2xl" title={t.reward}>{t.icon}</span> : null; })()}
            </div>
          ))}
          {withM.filter(c => c.m.count > 0).length === 0 && <div className="text-center py-10 text-white/40">No referrals yet. Send referral requests to your best customers.</div>}
        </div>
      </Glass>}

      {tab === "program" && <div className="space-y-4">
        <Glass className="p-5">
          <h3 className="font-semibold mb-4">Program Settings</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="text-xs text-white/60 mb-1 block">Referrer credit ($)</label><GInput type="number" value={rewardSettings.referrerCredit} onChange={e => setRewardSettings(p => ({ ...p, referrerCredit: Number(e.target.value) }))} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Referee discount</label>
              <div className="flex gap-2">
                <GInput type="number" value={rewardSettings.refereeDiscount} onChange={e => setRewardSettings(p => ({ ...p, refereeDiscount: Number(e.target.value) }))} className="flex-1" />
                <GSel value={rewardSettings.refereeDiscountType} onChange={e => setRewardSettings(p => ({ ...p, refereeDiscountType: e.target.value }))} className="w-24">
                  <option value="percent" className="bg-black">%</option>
                  <option value="flat" className="bg-black">$</option>
                </GSel>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-black/40 border border-brand-900/20 rounded-xl text-xs text-white/60">
            <strong className="text-white/80">Current program:</strong> Customers share their unique link. New customers get {rewardSettings.refereeDiscount}{rewardSettings.refereeDiscountType === "percent" ? "%" : "$"} off their first booking. Referrer earns ${rewardSettings.referrerCredit} credit automatically when the referred customer completes their first job.
          </div>
        </Glass>
        <Glass className="p-5">
          <h3 className="font-semibold mb-3">Send to All Customers</h3>
          <div className="text-xs text-white/60 mb-3">Blast a referral request to all customers at once via SMS.</div>
          <GBtn onClick={async () => {
            let sent = 0;
            const eligible = withM.filter(c => c.phone && c.m.count === 0); // only those who haven't referred yet
            for (const c of eligible.slice(0, 20)) { // limit 20 at a time
              await sendReferralRequest(c);
              sent++;
            }
            toast("Referral requests sent to " + sent + " customers");
          }} className="!text-xs">
            <Send size={12} className="inline mr-1.5" />Send to {withM.filter(c => c.phone && c.m.count === 0).length} customers (no refs yet)
          </GBtn>
        </Glass>
      </div>}
    </div>
  );
}


