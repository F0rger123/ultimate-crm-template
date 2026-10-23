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

export function ReviewToGraphic({ toast, posts = [], setPosts }) {
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState("");
  const [name, setName] = useState("");
  const [service, setService] = useState("standard service");
  const [style, setStyle] = useState("dark"); // dark | light | branded
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef(null);

  const generateGraphic = () => {
    setGenerating(true);
    const canvas = canvasRef.current;
    if (!canvas) { setGenerating(false); return; }
    const ctx = canvas.getContext("2d");
    const W = 1080, H = 1080;
    canvas.width = W; canvas.height = H;

    // Background
    if (style === "dark") {
      const grd = ctx.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, "#0a0a0a"); grd.addColorStop(1, "#1a0000");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    } else if (style === "light") {
      ctx.fillStyle = "#f9f9f9"; ctx.fillRect(0, 0, W, H);
    } else {
      const grd = ctx.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, "#525252"); grd.addColorStop(1, "#ffffff");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    }

    const tc = style === "light" ? "#111" : "#fff";
    const sc = style === "light" ? "#555" : "rgba(255,255,255,0.7)";

    // Stars
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 56px Arial";
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    ctx.fillText(stars, 80, 160);

    // Quote
    ctx.fillStyle = tc;
    ctx.font = "italic bold 52px Georgia, serif";
    ctx.fillStyle = style === "light" ? "#222" : "#fff";
    const words = (quote || "Amazing service! Highly recommend.").split(" ");
    let line = "", y = 260;
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > 920 && line) {
        ctx.fillText("\"" + line.trim(), 80, y); line = word + " "; y += 72;
      } else { line = test; }
    }
    ctx.fillText(line.trim() + "\"", 80, y);

    // Attribution
    ctx.fillStyle = sc;
    ctx.font = "28px Arial";
    ctx.fillText("— " + (name || "Happy Customer") + "  ·  " + service, 80, y + 70);

    // Bottom bar
    ctx.fillStyle = style === "light" ? "#ffffff" : "rgba(255,255,255,0.15)";
    ctx.fillRect(0, H - 120, W, 120);
    ctx.fillStyle = style === "light" ? "#fff" : tc;
    ctx.font = "bold 32px Arial";
    ctx.fillText("CRM Starter", 80, H - 70);
    ctx.font = "24px Arial";
    ctx.fillStyle = style === "light" ? "rgba(255,255,255,0.8)" : sc;
    ctx.fillText("your area  ·  (555) 555-0100  ·  ★ 5-Star Rated", 80, H - 32);

    setGenerating(false);
    toast("Graphic ready — right-click to save or share");
  };

  const schedulePost = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const caption = "⭐".repeat(rating) + "\n\n\"" + quote + "\"\n\n— " + name + " · " + service + "\n\nCRM Starter · your area · (555) 555-0100\n\n#smallbusiness #review #localservice #yourcity";
    const newPost = { id: uid(), platform: "instagram", type: "testimonial", caption, scheduledFor: daysFromNow(1), hashtags: "#smallbusiness #review #yourcity", status: "scheduled", imagePreview: dataUrl, createdAt: today() };
    setPosts(prev => [newPost, ...prev]);
    toast("Review graphic scheduled to Instagram ✓");
  };

  return (
    <div className="space-y-4">
      <Glass className="p-5 !bg-gradient-to-br !from-yellow-950/20 !to-black/60 !border-yellow-700/30">
        <div className="font-semibold flex items-center gap-2 mb-1">⭐ Review → Social Graphic</div>
        <div className="text-xs text-white/60">Turn a 5-star review into a shareable graphic. Download or schedule directly to Instagram.</div>
      </Glass>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          <div><label className="text-xs text-white/60 mb-1 block">Rating</label>
            <div className="flex gap-2">{[1,2,3,4,5].map(n => <button key={n} onClick={() => setRating(n)} className={"flex-1 py-2.5 rounded-xl text-lg border transition " + (n <= rating ? "bg-yellow-900/40 border-yellow-500/50" : "bg-black/40 border-white/10 hover:border-yellow-500/30")}>⭐</button>)}</div>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Customer Quote</label><GTxt rows={3} value={quote} onChange={e => setQuote(e.target.value)} placeholder="Amazing service! Will definitely use again..." /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-white/60 mb-1 block">Customer Name</label><GInput value={name} onChange={e => setName(e.target.value)} placeholder="Jennifer W." /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Service</label><GInput value={service} onChange={e => setService(e.target.value)} placeholder="standard service" /></div>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Style</label>
            <div className="flex gap-2">{[["dark","🌑 Dark"],["light","☀️ Light"],["branded","🔴 Branded"]].map(([v,l]) => <button key={v} onClick={() => setStyle(v)} className={"flex-1 py-2 rounded-xl text-xs border transition " + (style === v ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-white/10 text-white/60")}>{l}</button>)}</div>
          </div>
          <div className="flex gap-2">
            <GBtn onClick={generateGraphic} disabled={generating} className="flex-1">{generating ? "Generating…" : "Generate Graphic"}</GBtn>
            {canvasRef.current?.toDataURL && <GBtn variant="ghost" onClick={schedulePost}>Schedule to IG</GBtn>}
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Download</label>
            <button onClick={() => { const a = document.createElement("a"); a.href = canvasRef.current?.toDataURL() || ""; a.download = "review-graphic.png"; a.click(); }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-black/40 border border-white/10 text-white/70 hover:text-white rounded-xl text-xs transition"><Download size={12} />Save PNG</button>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <canvas ref={canvasRef} className="w-full max-w-xs aspect-square rounded-xl border border-white/10 bg-black/60" style={{ imageRendering: "crisp-edges" }} />
          <div className="text-[10px] text-white/40 mt-2">1080×1080px · Instagram ready</div>
        </div>
      </div>
    </div>
  );
}

// ===== BULK PHOTO UPLOAD =====
