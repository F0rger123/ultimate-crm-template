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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, computeDepositAmount, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail } from "../../lib/messaging";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
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

export function EstimatePreview({ estimate: e, customers = [], settings = {} as any, onClose, onApprove, onConvert, onSchedule = null, onMarkDepositPaid = null, toast = (..._args: any[]) => {} }) {
  if (!e) return null;
  const c = customers.find(x => x.id === e.customerId);
  const companyName = settings?.companyName || "CRM Starter";
  // FEATURE 6 — resolves depositRequired whether it's a flat $ or a % of total.
  const depositAmt = computeDepositAmount(e, e.total);
  const depositBalanceAmt = Math.max(0, e.total - depositAmt);

  return (
    <Modal open={!!e} onClose={onClose} title={"Quote #" + e.id.toUpperCase()} maxW="max-w-2xl">
      {/* Always-visible floating close button — guarantees a tap target on
          mobile even if the Modal's own header X scrolls out of view. */}
      <button
        onClick={onClose}
        aria-label="Close preview"
        className="fixed top-3 right-3 z-[400] w-11 h-11 rounded-full bg-brand-600 hover:bg-brand-500 text-brand-fg shadow-lg flex items-center justify-center md:hidden"
      >
        <X size={22} />
      </button>
      <div className="bg-white text-black rounded-2xl overflow-hidden shadow-xl">
        {/* Branded header band */}
        <div className="bg-brand-600 px-7 py-6 flex justify-between items-start text-brand-fg">
          <div>
            <div className="text-2xl font-extrabold text-brand-fg tracking-tight">{companyName}</div>
            <div className="text-xs text-brand-fg/70 mt-1">Professional Exterior Cleaning</div>
          </div>
          <div className="text-right">
            <div className="font-bold text-white text-sm bg-white/15 px-3 py-1 rounded-full inline-block">{e.invoiced ? "INVOICE" : "ESTIMATE"}</div>
            <div className="text-xs text-brand-fg/60 mt-1.5">#{e.id.toUpperCase()} · {e.createdAt}</div>
          </div>
        </div>

        <div className="p-7">
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold mb-1.5">Bill to</div>
              <div className="font-semibold text-gray-900">{c?.firstName} {c?.lastName}</div>
              <div className="text-gray-500 text-xs mt-0.5">{c?.address}</div>
              {c?.email && <div className="text-gray-500 text-xs">{c.email}</div>}
            </div>
            <div className="text-right">
              <div className="text-gray-400 text-[10px] uppercase tracking-wider font-semibold mb-1.5">{e.invoiced ? "Invoice" : "Valid Until"}</div>
              <div className="text-gray-700 text-sm">{e.invoiced ? `#${e.id.toUpperCase()}` : e.validUntil}</div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden mb-5">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500"><th className="text-left py-2.5 px-4">Description</th><th className="text-right py-2.5 px-3">Qty</th><th className="text-right py-2.5 px-3">Unit</th><th className="text-right py-2.5 px-4">Amount</th></tr></thead>
              <tbody>{(e.lineItems || []).map((li, i) => <tr key={li.id} className={i % 2 ? "bg-gray-50/60" : ""}><td className="py-2.5 px-4 text-gray-800">{li.description}</td><td className="text-right py-2.5 px-3 text-gray-500">{li.quantity}</td><td className="text-right py-2.5 px-3 text-gray-500">{fmt(li.unitPrice)}</td><td className="text-right py-2.5 px-4 font-medium text-gray-900">{fmt(li.quantity * li.unitPrice)}</td></tr>)}</tbody>
            </table>
          </div>

          <div className="ml-auto w-64 text-sm space-y-1.5 bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="text-gray-800">{fmt(e.subtotal)}</span></div>
            {/* FEATURE 7 — every stacked discount, each with its own label */}
            {(e.discounts || []).map((d: any) => Number(d.value) > 0 && (
              <div key={d.id} className="flex justify-between text-green-700"><span>{d.label || "Discount"}{d.type === "percent" ? ` (${d.value}%)` : ""}</span><span>− {fmt(d.type === "percent" ? e.subtotal * (Number(d.value) / 100) : Number(d.value))}</span></div>
            ))}
            {e.discount > 0 && <div className="flex justify-between text-green-700"><span>Discount</span><span>− {fmt(e.discount)}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="text-gray-800">{fmt(e.tax)}</span></div>
            <div className="flex justify-between font-bold text-lg border-t-2 border-brand-600 pt-2 mt-1 text-brand-700"><span>Total</span><span>{fmt(e.total)}</span></div>
            {/* FEATURE 6 — deposit shown as its resolved dollar figure
                regardless of whether the owner configured $ or %, plus the
                remaining balance. */}
            {e.depositRequired > 0 && (
              <>
                <div className="flex justify-between text-yellow-700 pt-1"><span>Deposit due now{e.depositType === "percent" ? ` (${e.depositRequired}%)` : ""}</span><span>{fmt(depositAmt)}</span></div>
                <div className="flex justify-between text-gray-500 text-xs"><span>Balance due after service</span><span>{fmt(depositBalanceAmt)}</span></div>
              </>
            )}
          </div>

          {e.notes && <div className="mt-6 pt-4 border-t border-gray-200"><div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Notes</div><div className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">{e.notes}</div></div>}
          {e.customerNotes && <div className="mt-3 pt-3 border-t border-gray-100"><div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Message from {companyName.split(" ")[0]}</div><div className="text-sm text-gray-800 bg-blue-50 border border-blue-200 rounded-xl p-3.5">{e.customerNotes}</div></div>}
          {e.terms && <div className="mt-4 text-[10px] text-gray-500 whitespace-pre-wrap leading-relaxed border-t border-gray-100 pt-3"><div className="uppercase tracking-wider mb-1.5 font-semibold text-gray-400">Terms</div>{e.terms}</div>}

          <div className="mt-7 pt-5 border-t border-gray-200 grid grid-cols-2 gap-8 text-xs">
            <div><div className="text-gray-400 uppercase tracking-wider mb-4 text-[10px] font-semibold">Customer signature</div><div className="border-b border-gray-300 h-8">{e.signedAt && <div className="italic text-brand-700 text-sm font-medium">{c?.firstName} {c?.lastName}</div>}</div>{e.signedAt && <div className="text-[10px] text-gray-400 mt-1.5">Signed {e.signedAt}</div>}</div>
            <div><div className="text-gray-400 uppercase tracking-wider mb-4 text-[10px] font-semibold">Date</div><div className="border-b border-gray-300 h-8">{e.signedAt && <div className="text-sm text-gray-700">{e.signedAt}</div>}</div></div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex gap-2 flex-wrap">
        {e.status === "pending" && <GBtn onClick={() => onApprove(e.id)} className="flex-1"><CheckCircle size={14} className="inline mr-1.5" />Approve Quote</GBtn>}
        {/* FEATURE 6 — owner can manually mark a deposit paid (cash/check
            collected outside the CRM), separate from the client actually
            paying online via Stripe in ClientPortal. */}
        {e.depositRequired > 0 && !e.paidDeposit && !e.paidFull && onMarkDepositPaid && (
          <GBtn variant="ghost" onClick={() => onMarkDepositPaid(e.id, depositAmt)} className="flex-1 !border-yellow-700/40 !text-yellow-300"><DollarSign size={14} className="inline mr-1.5" />Mark Deposit Paid ({fmt(depositAmt)})</GBtn>
        )}
        {e.paidDeposit > 0 && !e.paidFull && <div className="flex-1 text-center py-2.5 rounded-xl bg-green-950/30 border border-green-700/40 text-green-300 text-sm flex items-center justify-center gap-1.5"><CheckCircle size={14} />Deposit Paid ({fmt(e.paidDeposit)})</div>}
        {e.status === "approved" && !e.invoiced && onConvert && <GBtn onClick={() => onConvert(e.id)} className="flex-1"><Receipt size={14} className="inline mr-1.5" />Convert to Invoice</GBtn>}
        {e.status === "approved" && onSchedule && <GBtn variant="ghost" onClick={() => onSchedule(e)} className="flex-1"><Briefcase size={14} className="inline mr-1.5" />Schedule Job</GBtn>}
        {e.invoiced && !e.paidAt && <GBtn variant="ghost" onClick={() => {
          const link = "crm.com/portal/" + e.id + "?t=" + Date.now();
          navigator.clipboard?.writeText(link).catch(() => {});
          toast("Payment link copied: " + link);
        }} className="flex-1 !text-xs !border-yellow-700/40 !text-yellow-300"><RefreshCw size={12} className="inline mr-1" />Regen Pay Link</GBtn>}
        {e.invoiced && e.paidAt && <div className="flex-1 text-center py-2.5 rounded-xl bg-green-950/30 border border-green-700/40 text-green-300 text-sm flex items-center justify-center gap-1.5"><CheckCircle size={14} />Paid {e.paidAt}</div>}
        {e.invoiced && !e.paidAt && <div className="flex-1 text-center py-2.5 rounded-xl bg-yellow-950/30 border border-yellow-700/40 text-yellow-300 text-sm flex items-center justify-center gap-1.5"><Clock size={14} />Invoiced — awaiting payment</div>}
      </div>
      {/* Explicit close — always visible full-width so mobile users have an
          obvious way out even if the header X is easy to miss. */}
      <button onClick={onClose} className="mt-3 w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-semibold flex items-center justify-center gap-1.5 transition">
        <X size={15} />Close Preview
      </button>
    </Modal>
  );
}

// ===== JOBS =====
// ===== BEFORE/AFTER SLIDER =====
