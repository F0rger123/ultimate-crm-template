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

export function GlobalSearch({ customers = [], jobs = [], estimates = [], onNav }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const results = q.length < 2 ? [] : (() => {
    const qL = q.toLowerCase();
    const res = [];
    customers.filter(c => (c.firstName + " " + c.lastName + " " + c.phone + " " + c.email + " " + c.address).toLowerCase().includes(qL)).slice(0, 5).forEach(c =>
      res.push({ type: "customer", icon: "👤", title: c.firstName + " " + c.lastName, sub: c.phone || c.email || "", page: "customers", id: c.id })
    );
    jobs.filter(j => (j.address + " " + j.status).toLowerCase().includes(qL)).slice(0, 4).forEach(j =>
      res.push({ type: "job", icon: "🔨", title: j.address?.split(",")[0] || "Job", sub: j.scheduledDate + " · " + fmt(j.amount), page: "jobs" })
    );
    estimates.filter(e => (e.lineItems?.map(l => l.description).join(" ") || "").toLowerCase().includes(qL)).slice(0, 3).forEach(e => {
      const c = customers.find(x => x.id === e.customerId);
      res.push({ type: "estimate", icon: "📋", title: (c ? c.firstName + " " + c.lastName : "Estimate") + " — " + fmt(e.total), sub: e.status + " · " + e.createdAt, page: "estimates" });
    });
    return res;
  })();

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = e => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); } if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 50); }} className="flex items-center gap-2 px-3 py-1.5 bg-black/40 border border-brand-900/30 rounded-xl text-xs text-white/50 hover:text-white hover:border-brand-600/50 transition">
        <Search size={13} />
        <span className="hidden md:block">Search</span>
        <span className="hidden md:block text-[10px] text-white/30 border border-white/10 rounded px-1">⌘K</span>
      </button>
      {open && <>
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
        <div className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-black/95 border border-brand-900/40 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur">
          <div className="p-3 border-b border-brand-900/30">
            <div className="flex items-center gap-2">
              <Search size={14} className="text-white/50 flex-shrink-0" />
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search customers, jobs, estimates…" className="flex-1 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none" autoFocus />
              {q && <button onClick={() => setQ("")} className="text-white/40 hover:text-white"><X size={12} /></button>}
            </div>
          </div>
          {q.length >= 2 && (results.length === 0
            ? <div className="p-6 text-center text-sm text-white/40">No results for "{q}"</div>
            : <div className="max-h-80 overflow-y-auto">
              {results.map((r, i) => (
                <button key={i} onClick={() => { onNav(r.page); setOpen(false); setQ(""); }} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left transition border-b border-brand-900/10 last:border-0">
                  <span className="text-lg flex-shrink-0">{r.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.title}</div>
                    <div className="text-[10px] text-white/40 truncate">{r.sub}</div>
                  </div>
                  <Badge tone="gray">{r.type}</Badge>
                </button>
              ))}
            </div>
          )}
          {q.length < 2 && <div className="p-4 text-xs text-white/40 space-y-1.5">
            <div>Type to search across all CRM data</div>
            <div className="flex gap-2 flex-wrap">
              {["Customers", "Jobs", "Estimates", "Invoices"].map(s => <button key={s} onClick={() => { onNav(s.toLowerCase()); setOpen(false); }} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition">{s}</button>)}
            </div>
          </div>}
        </div>
      </>}
    </div>
  );
}

// ===== ERROR BOUNDARY =====
class ErrorBoundary extends React.Component<{children?: React.ReactNode}, {error: any}> {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error("CRM Error:", err, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="text-6xl">⚠️</div>
            <h2 className="text-xl font-bold text-brand-400">Something crashed</h2>
            <p className="text-white/60 text-sm">{this.state.error?.message || "Unknown error"}</p>
            <button onClick={() => this.setState({ error: null })} className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-brand-fg rounded-xl text-sm font-semibold transition">
              Go Back
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ===== PAGE WRAPPER WITH ERROR BOUNDARY =====
