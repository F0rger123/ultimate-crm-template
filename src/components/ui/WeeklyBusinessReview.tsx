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

export function WeeklyBusinessReview({ jobs = [], customers = [], estimates = [], expenses = [] }) {
  const [review, setReview] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("weekly"); // weekly | monthly

  const days = mode === "monthly" ? 30 : 7;
  const label = mode === "monthly" ? "This Month" : "This Week";

  const periodJobs = jobs.filter(j => j.status === "completed" && daysSince(j.scheduledDate) <= days);
  const periodRev = periodJobs.reduce((s, j) => s + j.amount, 0);
  const periodExp = (expenses || []).filter(e => daysSince(e.date) <= days).reduce((s, e) => s + Number(e.amount), 0);
  const periodProfit = periodRev - periodExp;
  const periodCustomers = customers.filter(c => daysSince(c.createdAt) <= days).length;
  const pendingEst = estimates.filter(e => e.status === "pending").length;
  const overdueInv = estimates.filter(e => e.invoiced && !e.paidAt && e.invoicedAt && daysSince(e.invoicedAt) > 14).length;

  const generate = async () => {
    setLoading(true); setReview("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 500, messages: [{ role: "user", content: `Write a concise 3-paragraph ${mode} business review for this service business. Data for the last ${days} days: Revenue $${periodRev.toFixed(0)}, Jobs ${periodJobs.length}, New customers ${periodCustomers}, Expenses $${periodExp.toFixed(0)}, Profit $${periodProfit.toFixed(0)} (${periodRev > 0 ? Math.round(periodProfit/periodRev*100) : 0}% margin), Pending quotes ${pendingEst}, Overdue invoices ${overdueInv}. Para 1: wins. Para 2: what needs work. Para 3: top 3 action items for next ${mode === "monthly" ? "month" : "week"}. Direct, specific, under ${mode === "monthly" ? "250" : "200"} words. ${mode === "monthly" ? "For monthly review, also compare to typical seasonal benchmarks for a service business." : ""}` }] }) });
      const data = await res.json();
      setReview(data.content?.[0]?.text || "Unable to generate.");
    } catch { setReview("Could not generate — check connection."); }
    setLoading(false);
  };

  return (
    <Glass className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold flex items-center gap-2"><TrendingUp size={14} className="text-brand-400" />Business Review <Badge tone="purple">AI</Badge></h3>
          <div className="flex gap-1 bg-black/40 border border-brand-900/30 rounded-xl p-1">
            {["weekly","monthly"].map(m => <button key={m} onClick={() => { setMode(m); setReview(""); }} className={"px-2.5 py-1 rounded-lg text-[10px] font-semibold capitalize transition " + (mode === m ? "bg-brand-600/40 text-white" : "text-white/40 hover:text-white")}>{m}</button>)}
          </div>
        </div>
        <GBtn onClick={generate} disabled={loading} className="!text-xs !py-1.5">{loading ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block mr-1.5" />Generating…</> : <><Zap size={11} className="inline mr-1" />Generate {label} Review</>}</GBtn>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4 text-center text-xs">
        <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Revenue</div><div className="font-bold text-brand-400">{fmt(periodRev)}</div></div>
        <div className="p-2 bg-black/40 rounded-xl"><div className="text-white/50 mb-0.5">Jobs</div><div className="font-bold">{periodJobs.length}</div></div>
        <div className={"p-2 rounded-xl " + (periodProfit >= 0 ? "bg-green-950/20" : "bg-brand-950/20")}><div className="text-white/50 mb-0.5">Profit</div><div className={"font-bold " + (periodProfit >= 0 ? "text-green-400" : "text-brand-400")}>{fmt(periodProfit)}</div></div>
        <div className={"p-2 rounded-xl " + (overdueInv > 0 ? "bg-danger-950/20" : "bg-black/40")}><div className="text-white/50 mb-0.5">Overdue</div><div className={"font-bold " + (overdueInv > 0 ? "text-danger-400" : "")}>{overdueInv}</div></div>
      </div>
      {review ? <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap bg-black/40 border border-brand-900/20 rounded-xl p-4">{review}</div>
        : <div className="text-center py-8 text-white/40"><TrendingUp size={36} className="mx-auto mb-2 opacity-30 anim-float" /><div className="text-sm">Generate your AI {mode} business review</div></div>}
    </Glass>
  );
}
