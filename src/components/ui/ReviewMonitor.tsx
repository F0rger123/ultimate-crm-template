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

export function ReviewMonitor({ settings = {} as any, toast }) {
  const [newR, setNewR] = useState({ reviewer: "", rating: 5, text: "", date: today(), source: "Google" });
  const [loggedReviews, setLoggedReviews] = usePersistent("crm.googleReviews", []);

  const avg = loggedReviews.length ? loggedReviews.reduce((s,r) => s + r.rating, 0) / loggedReviews.length : 0;

  return (
    <div className="space-y-4">
      <Glass className="p-5 !bg-gradient-to-br !from-blue-950/20 !to-black/60 !border-blue-700/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="text-xl">🔍</span><h3 className="font-semibold">Google Review Monitoring</h3></div>
          {loggedReviews.length > 0 && <div className="text-yellow-400 font-bold text-sm">★ {avg.toFixed(1)} avg · {loggedReviews.length} logged</div>}
        </div>
        <div className="text-xs text-white/60 mt-1">Manually log reviews from Google to track trends. Add your Place ID in Settings → Company for direct links.</div>
      </Glass>

      <div className="grid md:grid-cols-2 gap-4">
        <Glass className="p-4 space-y-3">
          <div className="font-semibold text-sm">Quick Links</div>
          {settings.googlePlaceId ? <>
            <a href={"https://search.google.com/local/reviews?placeid=" + settings.googlePlaceId} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 py-2.5 bg-blue-950/30 border border-blue-700/40 text-blue-300 rounded-xl hover:bg-blue-900/40 transition text-xs font-medium px-3"><ExternalLink size={12} />Open Google Reviews</a>
            {/* FIX 22 — this was hardcoded to "your+business"
                regardless of the actual owner's company name, so on any
                deployment for a business that ISN'T literally Your Company, this
                link searched Google Maps for the wrong business entirely
                (query_place_id would still resolve the correct pin, but the
                query text shown/used in the search itself was wrong). Uses
                the configured company name instead. */}
            <a href={"https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(settings.companyName || "our business") + "&query_place_id=" + settings.googlePlaceId} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-2 py-2.5 bg-black/40 border border-white/10 text-white/60 rounded-xl hover:text-white transition text-xs px-3"><ExternalLink size={12} />View on Google Maps</a>
            <button onClick={() => { navigator.clipboard?.writeText("https://search.google.com/local/reviews?placeid=" + settings.googlePlaceId); toast("Review link copied ✓"); }} className="w-full flex items-center gap-2 py-2 bg-black/40 border border-white/10 text-white/50 rounded-xl hover:text-white transition text-xs px-3"><Link size={12} />Copy review request link</button>
          </> : <div className="text-xs text-yellow-400 p-3 bg-yellow-950/20 border border-yellow-700/30 rounded-xl">Add your Google Place ID in Settings → Company → Google Place ID to enable monitoring links.</div>}
          <div className="text-[10px] text-white/30 pt-2 border-t border-white/5">Best practice: respond to every Google review within 24 hours for maximum ranking signals.</div>
        </Glass>

        <Glass className="p-4 space-y-3">
          <div className="font-semibold text-sm">Log a Google Review</div>
          <div className="text-[10px] text-white/50">Found a new review? Log it here to track your rating trends over time.</div>
          <GInput value={newR.reviewer} onChange={e => setNewR(p => ({ ...p, reviewer: e.target.value }))} placeholder="Reviewer name" className="!text-xs" />
          <div className="flex items-center gap-3">
            <label className="text-[10px] text-white/50">Rating:</label>
            <div className="flex gap-0.5">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setNewR(p => ({ ...p, rating: n }))} className={"text-xl transition " + (newR.rating >= n ? "text-yellow-400" : "text-white/20")}>★</button>)}</div>
          </div>
          <GTxt rows={2} value={newR.text} onChange={e => setNewR(p => ({ ...p, text: e.target.value }))} placeholder="Review text (optional)..." className="!text-xs" />
          <GDate value={newR.date} onChange={e => setNewR(p => ({ ...p, date: e.target.value }))} className="!text-xs !py-1.5" />
          <GBtn onClick={() => {
            if (!newR.reviewer.trim()) return;
            setLoggedReviews(prev => [{ ...newR, id: uid() }, ...prev]);
            setNewR({ reviewer: "", rating: 5, text: "", date: today(), source: "Google" });
            toast("Review logged ✓");
          }} disabled={!newR.reviewer.trim()} className="w-full !text-xs">Log Review</GBtn>
        </Glass>
      </div>

      {loggedReviews.length > 0 && <Glass className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-sm">Review Log ({loggedReviews.length})</div>
          <div className="flex gap-3 text-xs text-white/50">
            <span className="text-green-400">{loggedReviews.filter(r => r.rating >= 4).length} positive</span>
            <span className="text-danger-400">{loggedReviews.filter(r => r.rating <= 3).length} negative</span>
          </div>
        </div>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {loggedReviews.map(r => (
            <div key={r.id} className={"p-3 border rounded-xl text-xs " + (r.rating >= 4 ? "bg-green-950/10 border-green-900/30" : "bg-brand-950/10 border-brand-900/30")}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{r.reviewer}</span>
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400">{"★".repeat(r.rating)}{"☆".repeat(5-r.rating)}</span>
                  <span className="text-white/40">{r.date}</span>
                  <button onClick={() => setLoggedReviews(prev => prev.filter(x => x.id !== r.id))} className="text-white/20 hover:text-brand-400"><X size={10} /></button>
                </div>
              </div>
              {r.text && <div className="text-white/60 italic">"{r.text}"</div>}
            </div>
          ))}
        </div>
      </Glass>}
    </div>
  );
}

