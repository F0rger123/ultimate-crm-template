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

export function WeeklyReflectionTab({ entries = [], goals = [], wins = [], toast, settings = {} as AppSettings }) {
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = usePersistent("crm.weeklyReflections", []);

  useEffect(() => {
    if (!reflection && saved.length > 0) setReflection(saved[0].text);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const weekEntries = entries.filter(e => daysSince(e.date) <= 7);
  const avgSleep = weekEntries.length ? (weekEntries.reduce((s, e) => s + e.sleep, 0) / weekEntries.length).toFixed(1) : 0;
  const avgWater = weekEntries.length ? Math.round(weekEntries.reduce((s, e) => s + e.water, 0) / weekEntries.length) : 0;
  const avgMood = weekEntries.length ? (weekEntries.reduce((s, e) => s + e.mood, 0) / weekEntries.length).toFixed(1) : 0;
  const gymDays = weekEntries.filter(e => e.gym).length;
  const avgSteps = weekEntries.length ? Math.round(weekEntries.reduce((s, e) => s + e.steps, 0) / weekEntries.length) : 0;

  const generate = async () => {
    setLoading(true);
    setReflection("");
    const prompt = `You are a supportive personal coach. Generate a warm, honest weekly reflection summary for this person. Be specific, encouraging but direct. Keep it under 200 words.

Last 7 days data:
- Check-ins logged: ${weekEntries.length}/7 days
- Average sleep: ${avgSleep} hours (goal: 7-8h)
- Average water: ${avgWater}oz/day (goal: 100oz)
- Average mood: ${avgMood}/5
- Gym sessions: ${gymDays}/7 days
- Average steps: ${avgSteps.toLocaleString()}/day (goal: 10,000)
- Active goals: ${goals.filter(g => !g.done).length} open, ${goals.filter(g => g.done).length} completed this week
- Wins logged: ${wins.filter(w => daysSince(w.date) <= 7).length} this week

Write a 3-4 paragraph reflection covering: what went well, what to improve, and one specific recommendation for next week. Be real, not generic.`;

    try {
      const modelId = settings.activeModel || "claude";
      const apiKey = (settings.modelKeys || {})[modelId] || (modelId === "claude" ? settings.anthropicKey : undefined);
      const res = await callModel({
        modelId,
        apiKey,
        messages: [{ role: "user", content: prompt }],
        maxTokens: 500,
      });
      const text = res.text || "Unable to generate reflection.";
      setReflection(text);
      setSaved(prev => [{ id: uid(), date: today(), text }, ...prev.slice(0, 9)]);
      toast("Reflection generated ✓");
    } catch (e: any) {
      setReflection(e?.message || "Could not generate reflection — check your AI model settings.");
      toast("Generation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Week stats */}
      <Glass className="p-5">
        <div className="font-semibold mb-3 flex items-center gap-2"><Activity size={14} className="text-brand-400" />This Week at a Glance</div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-center">
          {[
            { label: "Check-ins", val: weekEntries.length + "/7", icon: "📋" },
            { label: "Avg Sleep", val: avgSleep + "h", icon: "😴", good: Number(avgSleep) >= 7 },
            { label: "Avg Water", val: avgWater + "oz", icon: "💧", good: avgWater >= 80 },
            { label: "Avg Mood", val: avgMood + "/5", icon: "😊", good: Number(avgMood) >= 3.5 },
            { label: "Gym Days", val: gymDays + "/7", icon: "🏋️", good: gymDays >= 3 },
            { label: "Avg Steps", val: avgSteps >= 1000 ? Math.round(avgSteps / 1000) + "k" : avgSteps, icon: "👟", good: avgSteps >= 8000 }
          ].map(s => (
            <div key={s.label} className={"p-3 rounded-xl border " + (s.good === true ? "bg-green-950/20 border-green-700/30" : s.good === false ? "bg-brand-950/20 border-brand-700/30" : "bg-black/40 border-white/10")}>
              <div className="text-lg">{s.icon}</div>
              <div className="font-bold text-sm mt-1">{s.val}</div>
              <div className="text-[10px] text-white/50">{s.label}</div>
            </div>
          ))}
        </div>
      </Glass>

      {/* AI Reflection */}
      <Glass className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold flex items-center gap-2">✨ Weekly Reflection <Badge tone="purple">AI</Badge></div>
          <GBtn onClick={generate} disabled={loading} className="!text-xs !py-1.5">
            {loading ? <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin inline-block mr-1.5" />Thinking…</> : <><Zap size={11} className="inline mr-1" />Generate</>}
          </GBtn>
        </div>
        {reflection ? (
          <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap bg-black/40 border border-brand-900/20 rounded-xl p-4">{reflection}</div>
        ) : (
          <div className="text-center py-8 text-white/40">
            <div className="text-4xl mb-2">🧠</div>
            <div className="text-sm">Click "Generate" to get your AI-powered weekly reflection</div>
            <div className="text-xs text-white/30 mt-1">Based on your check-in data for the past 7 days</div>
          </div>
        )}
      </Glass>

      {/* Saved reflections */}
      {saved.length > 1 && <Glass className="p-4">
        <div className="text-xs text-white/50 uppercase tracking-wider mb-2">Past Reflections</div>
        <div className="space-y-2">
          {saved.slice(1, 4).map(r => (
            <div key={r.id} className="p-3 bg-black/40 border border-white/5 rounded-xl">
              <div className="text-[10px] text-white/40 mb-1">{r.date}</div>
              <div className="text-xs text-white/60 line-clamp-2">{r.text}</div>
            </div>
          ))}
        </div>
      </Glass>}
    </div>
  );
}
// ===== VOICE MIC BUTTON (Whisper API) =====
