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

export function CampaignScheduler({ matches, body, subj, ch, canSend, sending, launch, setCampaigns }) {
  const [schedMode, setSchedMode] = useState("now");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("09:00");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button onClick={() => setSchedMode("now")} className={"flex-1 py-2 rounded-xl text-xs font-semibold border transition " + (schedMode === "now" ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}>⚡ Send Now</button>
        <button onClick={() => setSchedMode("later")} className={"flex-1 py-2 rounded-xl text-xs font-semibold border transition " + (schedMode === "later" ? "bg-blue-900/40 border-blue-500/50 text-white" : "bg-black/40 border-white/10 text-white/50 hover:text-white")}>🕐 Schedule</button>
      </div>
      {schedMode === "later" && <div className="flex gap-2">
        <GInput type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} className="flex-1 !text-xs" />
        <GInput type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} className="w-28 !text-xs" />
      </div>}
      <GBtn onClick={() => {
        if (schedMode === "later" && schedDate) {
          const scheduled = { id: uid(), name: "Campaign " + schedDate, ch, body, subj, matches: (matches || []).map(c => c.id), sendAt: schedDate + "T" + schedTime, status: "scheduled", createdAt: today() };
          setCampaigns(prev => [scheduled, ...prev]);
        } else {
          launch();
        }
      }} disabled={(matches || []).length === 0 || !body.trim() || (ch === "email" && !subj.trim()) || sending || (schedMode === "later" && !schedDate)} className="w-full">
        <Send size={14} className="inline mr-1.5" />
        {schedMode === "later" ? (schedDate ? "Schedule for " + schedDate : "Pick a date first") : (sending ? "Sending…" : canSend ? `Send Now to ${(matches||[]).length} ${ch === "sms" ? "📱" : "📧"}` : `Queue (${(matches||[]).length}) — connect ${ch === "sms" ? "Twilio" : "Gmail"} first`)}
      </GBtn>
    </div>
  );
}

