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

export function CACCalculator({ tfExpenses = [], customers = [], timeframe }) {
  const [manualAdSpend, setManualAdSpend] = useState(0);
  const expenseAdSpend = (tfExpenses || []).filter(e => (e.category || "").toLowerCase().includes("advert") || (e.category || "").toLowerCase().includes("marketing")).reduce((s, e) => s + Number(e.amount), 0);
  const adSpend = expenseAdSpend + Number(manualAdSpend);
  const newCustomers = (customers || []).filter(c => c.createdAt && new Date(c.createdAt).getTime() >= Date.now() - ((TIMEFRAMES.find(t => t.key === timeframe)?.days || 365) * 86400000)).length;
  const cac = newCustomers > 0 ? adSpend / newCustomers : 0;
  const ltv = customers.length > 0 ? customers.reduce((s, c) => s + (c.totalSpent || 0), 0) / customers.length : 0;
  const ltvCacRatio = cac > 0 ? (ltv / cac).toFixed(1) : null;
  const tfLabel = TIMEFRAMES.find(t => t.key === timeframe)?.label || "All time";
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-black/40 border border-brand-900/20 rounded-xl">
        <div className="flex-1">
          <div className="text-[10px] text-white/50 mb-1">Additional Ad Spend ({tfLabel})</div>
          <div className="text-[10px] text-white/30">From expenses: {fmt(expenseAdSpend)} · Add any not tracked below</div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-white/40 text-sm">$</span>
          <input type="number" min="0" value={manualAdSpend} onChange={e => setManualAdSpend(Number(e.target.value))} placeholder="0" className="w-24 bg-black/60 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white text-right focus:outline-none focus:border-brand-500/50" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 bg-black/40 border border-brand-900/20 rounded-xl">
          <div className="text-[10px] text-white/50 mb-1">Total Ad Spend</div>
          <div className="text-xl font-bold text-brand-400">{fmt(adSpend)}</div>
        </div>
        <div className="p-3 bg-black/40 border border-brand-900/20 rounded-xl">
          <div className="text-[10px] text-white/50 mb-1">New Customers</div>
          <div className="text-xl font-bold">{newCustomers}</div>
        </div>
        <div className={"p-3 border rounded-xl " + (cac < 50 ? "bg-green-950/20 border-green-700/30" : cac < 150 ? "bg-yellow-950/20 border-yellow-700/30" : "bg-brand-950/20 border-brand-700/30")}>
          <div className="text-[10px] text-white/50 mb-1">Cost per Customer</div>
          <div className="text-xl font-bold">{cac > 0 ? fmt(cac) : "—"}</div>
          {cac > 0 && <div className="text-[9px] text-white/30 mt-1">{cac < 50 ? "✅ Excellent" : cac < 150 ? "👍 Good" : "⚠️ High"}</div>}
        </div>
        <div className={"p-3 border rounded-xl " + (ltvCacRatio && Number(ltvCacRatio) >= 3 ? "bg-green-950/20 border-green-700/30" : "bg-black/40 border-brand-900/20")}>
          <div className="text-[10px] text-white/50 mb-1">LTV:CAC Ratio</div>
          <div className="text-xl font-bold">{ltvCacRatio ? ltvCacRatio + "x" : "—"}</div>
        </div>
      </div>
      <div className="text-[10px] text-white/40 text-center">{ltvCacRatio && Number(ltvCacRatio) >= 3 ? "✅ Healthy LTV:CAC (3x+ is ideal)" : ltvCacRatio ? "⚠️ Aim for 3x+ LTV:CAC ratio" : "Add ad spend above to calculate CAC"}</div>
    </div>
  );
}

