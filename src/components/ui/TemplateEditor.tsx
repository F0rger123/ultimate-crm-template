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

export function TemplateEditor({ emailTemplates, setEmailTemplates, smsTemplates, setSmsTemplates, settings, setSettings }) {
  const [tab, setTab] = useState("email");
  const [editing, setEditing] = useState(null);
  const [f, setF] = useState({ name: "", subject: "", body: "" });
  const [termsText, setTermsText] = useState(settings?.terms || "Payment due upon completion. 48-hour re-service guarantee for streaking or missed spots. No refunds after service completion. Customer is responsible for removing vehicles, furniture, and pets from work area before service. CRM Starter is not liable for pre-existing damage.");

  const templates = tab === "email" ? emailTemplates : smsTemplates;
  const setTemplates = tab === "email" ? setEmailTemplates : setSmsTemplates;

  const startEdit = t => { setEditing(t.id); setF({ name: t.name, subject: t.subject || "", body: t.body }); };
  const startNew = () => { setEditing("new"); setF({ name: "", subject: "", body: "" }); };
  const cancel = () => { setEditing(null); setF({ name: "", subject: "", body: "" }); };
  const save = () => {
    if (!f.name.trim()) return;
    if (editing === "new") {
      setTemplates([...templates, { id: uid(), ...f }]);
    } else {
      setTemplates(templates.map(t => t.id === editing ? { ...t, ...f } : t));
    }
    cancel();
  };
  const remove = id => setTemplates(templates.filter(t => t.id !== id));

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2">
          {["email", "sms", "terms"].map(t => <button key={t} onClick={() => { setTab(t); cancel(); }} className={"px-3 py-1 rounded-lg text-xs transition border " + (tab === t ? "bg-brand-900/40 border-brand-500/50" : "bg-white/5 border-white/10")}>{t === "terms" ? "📋 T&C" : t.toUpperCase()}</button>)}
        </div>
        {tab !== "terms" && <GBtn onClick={startNew} className="!text-xs !py-1"><Plus size={12} className="inline mr-1" />New</GBtn>}
      </div>

      {tab === "terms" && (
        <div className="space-y-3">
          <div className="text-xs text-white/60">These terms appear on all estimates and the client portal. Customers see and agree to these before signing.</div>
          <GTxt rows={8} value={termsText} onChange={e => setTermsText(e.target.value)} className="!text-xs font-mono" placeholder="Enter your terms and conditions..." />
          <div className="flex gap-2">
            <GBtn onClick={() => { setSettings(s => ({ ...s, terms: termsText })); }} className="flex-1 !text-xs">Save Terms</GBtn>
            <GBtn variant="ghost" onClick={() => setTermsText("Payment due upon completion. 48-hour re-service guarantee for streaking or missed spots. No refunds after service completion. Customer is responsible for removing vehicles, furniture, and pets from work area before service. CRM Starter is not liable for pre-existing damage.")} className="!text-xs">Reset Default</GBtn>
          </div>
          <div className="p-3 bg-black/40 border border-white/5 rounded-xl">
            <div className="text-[10px] text-white/40 mb-2 uppercase tracking-wider">Preview (as customers see it)</div>
            <div className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed">{termsText}</div>
          </div>
        </div>
      )}

      {editing && (
        <Glass className="p-3 !bg-black/40 space-y-2">
          <GInput placeholder="Template name" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} className="!text-xs" />
          {tab === "email" && <GInput placeholder="Subject line" value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} className="!text-xs" />}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] text-white/50">Available variables:</div>
              <div className="flex gap-1 flex-wrap">
                {["{{first_name}}", "{{last_name}}", "{{address}}", "{{amount}}", "{{review_link}}", "{{date}}"].map(v =>
                  <button key={v} onClick={() => setF({ ...f, body: f.body + v })} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white">{v}</button>
                )}
              </div>
            </div>
            <GTxt rows={5} placeholder="Body — use {{first_name}}, {{address}}, etc." value={f.body} onChange={e => setF({ ...f, body: e.target.value })} className="!text-xs" />
            {f.body.includes("{{") && <div className="text-[9px] text-white/40 mt-1 p-2 bg-black/40 rounded font-mono">{f.body.replace(/\{\{first_name\}\}/g, "Jennifer").replace(/\{\{last_name\}\}/g, "Walsh").replace(/\{\{address\}\}/g, "412 Oak Ridge Ln").replace(/\{\{amount\}\}/g, "$742").replace(/\{\{review_link\}\}/g, "crm.com/r/abc123").replace(/\{\{date\}\}/g, today())}</div>}
          </div>
          <div className="text-[10px] text-white/40">{f.body.length} chars{tab === "sms" ? " · " + Math.ceil(f.body.length / 160) + " SMS segment" + (Math.ceil(f.body.length / 160) !== 1 ? "s" : "") : ""}</div>
          <div className="flex gap-2 justify-end">
            <GBtn variant="ghost" onClick={cancel} className="!text-xs !py-1">Cancel</GBtn>
            <GBtn onClick={save} disabled={!f.name.trim()} className="!text-xs !py-1">Save Template</GBtn>
          </div>
        </Glass>
      )}

      <div className="space-y-2">
        {templates.map(t => <div key={t.id} className="flex items-center gap-2 p-3 bg-white/5 border border-white/5 rounded-xl">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{t.name}</div>
            {t.subject && <div className="text-xs text-white/50">{t.subject}</div>}
            <div className="text-xs text-white/50 truncate">{t.body.slice(0, 60)}...</div>
          </div>
          <button onClick={() => startEdit(t)} className="p-1.5 text-white/60 hover:text-white"><Edit size={12} /></button>
          <button onClick={() => remove(t.id)} className="p-1.5 text-white/60 hover:text-danger-400"><Trash2 size={12} /></button>
        </div>)}
      </div>
    </div>
  );
}

// ===== CAMPAIGNS =====
// ===== INBOX PAGE — Unified SMS + Email =====
