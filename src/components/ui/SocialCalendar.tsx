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

export function SocialCalendar({ posts = [], setPosts, toast, platformMeta = {} }) {
  const [dragPostId, setDragPostId] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const today_ = new Date();
  const todayStr = today();
  const startOfGrid = new Date(today_);
  startOfGrid.setDate(today_.getDate() - today_.getDay()); // Start from Sunday

  const weeks = [];
  for (let w = 0; w < 5; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startOfGrid);
      date.setDate(startOfGrid.getDate() + w * 7 + d);
      const ds = date.toISOString().slice(0, 10);
      days.push({
        date, ds,
        scheduled: posts.filter(p => p.scheduledFor === ds && p.status === "scheduled"),
        published: posts.filter(p => p.publishedAt === ds && p.status === "published"),
        isToday: ds === todayStr,
        isPast: ds < todayStr
      });
    }
    weeks.push(days);
  }

  const handleDrop = ds => {
    if (!dragPostId || ds < todayStr) return;
    setPosts(prev => prev.map(p => p.id === dragPostId ? { ...p, scheduledFor: ds } : p));
    toast("Post rescheduled to " + ds + " ✓");
    setDragPostId(null);
    setDragOver(null);
  };

  const scheduledCount = posts.filter(p => p.status === "scheduled").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>{scheduledCount} post{scheduledCount !== 1 ? "s" : ""} scheduled · drag to reschedule</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-600/50 border border-purple-500/50 inline-block" />Scheduled</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-600/50 border border-green-500/50 inline-block" />Published</span>
        </span>
      </div>
      {/* Day of week headers */}
      <div className="grid grid-cols-7 gap-1">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
          <div key={d} className="text-center text-[10px] text-white/35 font-bold uppercase tracking-wider py-1">{d}</div>
        ))}
      </div>
      {/* Calendar weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-1">
          {week.map(({ date, ds, scheduled, published, isToday, isPast }) => {
            const isDragTarget = dragOver === ds && !isPast;
            return (
              <div
                key={ds}
                className={"min-h-[76px] rounded-xl border p-1.5 transition-all duration-150 " + (
                  isToday ? "border-purple-500/70 bg-purple-950/25 ring-1 ring-purple-500/30" :
                  isDragTarget ? "border-green-500/70 bg-green-950/25 scale-[1.03] shadow-lg shadow-green-900/30" :
                  isPast ? "border-white/5 bg-black/15 opacity-40" :
                  "border-white/8 bg-black/25 hover:border-white/20"
                )}
                onDragOver={e => { e.preventDefault(); setDragOver(ds); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
                onDrop={() => handleDrop(ds)}
              >
                <div className={"text-[10px] font-bold mb-1 " + (isToday ? "text-purple-300" : isPast ? "text-white/20" : "text-white/45")}>
                  {date.getDate()}
                  {isToday && <span className="ml-1 text-[8px] text-purple-400 font-black">TODAY</span>}
                </div>
                <div className="space-y-0.5">
                  {scheduled.map(p => {
                    const meta = (platformMeta || {})[p.platform] || { icon: "📸" };
                    const isDragging = dragPostId === p.id;
                    return (
                      <div
                        key={p.id}
                        draggable
                        onDragStart={() => setDragPostId(p.id)}
                        onDragEnd={() => { setDragPostId(null); setDragOver(null); }}
                        title={p.caption || p.type}
                        className={"text-[9px] rounded-lg px-1.5 py-1 border truncate cursor-grab active:cursor-grabbing select-none transition-all " + (isDragging ? "opacity-30 scale-90 border-purple-400/60 bg-purple-900/20" : "bg-purple-900/45 border-purple-700/50 text-purple-100 hover:bg-purple-800/50")}
                      >
                        {meta.icon} {(p.caption || p.type || "Post").slice(0, 14)}{(p.caption || "").length > 14 ? "…" : ""}
                      </div>
                    );
                  })}
                  {published.map(p => {
                    const meta = (platformMeta || {})[p.platform] || { icon: "📸" };
                    return (
                      <div key={p.id} className="text-[9px] rounded-lg px-1.5 py-1 bg-green-900/35 border border-green-700/40 text-green-200 truncate">
                        {meta.icon} {p.likes > 0 ? p.likes + "❤" : "Published"}
                      </div>
                    );
                  })}
                  {isDragTarget && (
                    <div className="text-[9px] text-green-300 text-center py-1.5 border border-dashed border-green-500/60 rounded-lg animate-pulse">
                      + Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
      <div className="text-[10px] text-white/25 text-center pt-1">Drag any post to a future date to reschedule · Past dates are locked</div>
    </div>
  );
}

