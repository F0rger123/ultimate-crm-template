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

export function AutomationEditor({ open, data, onClose, onSave }) {
  const triggerPresets = [
    "New inquiry submitted", "Estimate sent, 24h no open", "Estimate expires in 3 days", "Quote unviewed 5 days",
    "24h before scheduled job", "Crew starts job", "Job complete plus 2h",
    "Invoice unpaid 3 days", "Invoice unpaid 7 days", "Invoice unpaid 14 days",
    "1 year since first service", "Customer birthday", "March 1 annual", "October 1 annual", "6 months since last wash",
    "Referred customer books"
  ];
  const actionPresets = [
    "Send welcome text within 5 min", "Send follow-up email", "Send reminder text", "Send SMS confirmation",
    "Send on-the-way text", "Send review request", "Send polite reminder", "Send firm follow-up", "Escalate to owner",
    "Send 5% off incentive email", "Send thank-you + 20% off", "Send greeting plus 10% off",
    "Send spring campaign", "Send fall campaign", "Send time-to-rebook email",
    "Credit referrer + notify"
  ];
  const [f, setF] = useState({ name: "", trigger: triggerPresets[0], action: actionPresets[0] });
  useEffect(() => { if (open) setF(data || { name: "", trigger: triggerPresets[0], action: actionPresets[0] }); }, [open, data]);

  return <Modal open={open} onClose={onClose} title={data ? "Edit Workflow" : "New Workflow"} maxW="max-w-xl">
    <div className="space-y-4">
      <div><label className="text-xs text-white/60 mb-1 block">Workflow name</label><GInput placeholder="e.g. Spring seasonal reminder" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>

      <div>
        <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Clock size={10} className="text-blue-400" />When this happens</label>
        <GSel value={triggerPresets.includes(f.trigger) ? f.trigger : "__custom"} onChange={e => { if (e.target.value !== "__custom") setF({ ...f, trigger: e.target.value }); else setF({ ...f, trigger: "" }); }}>
          {triggerPresets.map(t => <option key={t} value={t} className="bg-black">{t}</option>)}
          <option value="__custom" className="bg-black">— Custom trigger —</option>
        </GSel>
        {!triggerPresets.includes(f.trigger) && <GInput className="mt-2" placeholder="Custom trigger description..." value={f.trigger} onChange={e => setF({ ...f, trigger: e.target.value })} />}
      </div>

      <div className="flex justify-center"><ChevronRight size={18} className="text-white/30 rotate-90" /></div>

      <div>
        <label className="text-xs text-white/60 mb-1 block flex items-center gap-1"><Zap size={10} className="text-green-400" />Do this</label>
        <GSel value={actionPresets.includes(f.action) ? f.action : "__custom"} onChange={e => { if (e.target.value !== "__custom") setF({ ...f, action: e.target.value }); else setF({ ...f, action: "" }); }}>
          {actionPresets.map(t => <option key={t} value={t} className="bg-black">{t}</option>)}
          <option value="__custom" className="bg-black">— Custom action —</option>
        </GSel>
        {!actionPresets.includes(f.action) && <GInput className="mt-2" placeholder="Custom action description..." value={f.action} onChange={e => setF({ ...f, action: e.target.value })} />}
      </div>

      {/* Preview card */}
      <Glass className="p-3 !bg-black/60">
        <div className="text-[10px] text-white/50 uppercase tracking-wider mb-2">Preview</div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-950/30 border border-blue-800/40 text-blue-300"><Clock size={10} />{f.trigger || "(no trigger)"}</div>
          <ChevronRight size={12} className="text-white/30" />
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-950/30 border border-green-800/40 text-green-300"><Zap size={10} />{f.action || "(no action)"}</div>
        </div>
      </Glass>

      <div className="flex gap-2 justify-end">
        <GBtn variant="ghost" onClick={onClose}>Cancel</GBtn>
        <GBtn onClick={() => { if (!f.name.trim() || !f.trigger.trim() || !f.action.trim()) return; onSave(data ? { ...data, ...f } : f); }} disabled={!f.name.trim() || !f.trigger.trim() || !f.action.trim()}>{data ? "Save" : "Create"}</GBtn>
      </div>
    </div>
  </Modal>;
}

// ===== ACCOUNTABILITY =====
