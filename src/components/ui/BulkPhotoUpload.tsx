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

export function BulkPhotoUpload({ toast, posts = [], setPosts }) {
  const [photos, setPhotos] = useState([]);
  const [captionMode, setCaptionMode] = useState("auto");
  const [platform, setPlatform] = useState("instagram");
  const [generating, setGenerating] = useState(false);

  const handleFiles = e => {
    const files = Array.from(e.target.files || []);
    files.forEach(f => {
      const file = f as File;
      const r = new FileReader();
      r.onload = ev => setPhotos(prev => [...prev, { id: uid(), name: file.name, dataUrl: ev.target.result, type: file.name.toLowerCase().includes("before") ? "before" : file.name.toLowerCase().includes("after") ? "after" : "photo", caption: "", platform }]);
      r.readAsDataURL(file);
    });
    e.target.value = "";
    toast(files.length + " photo" + (files.length !== 1 ? "s" : "") + " added");
  };

  const genCaptions = async () => {
    setGenerating(true);
    try {
      // BUG FIX (audit) — this called api.anthropic.com directly from the
      // browser with no api-key header at all, so it never actually worked
      // — every real attempt failed and just showed the generic error
      // toast below, making "AI captions" a silently dead feature. Routed
      // through the same callModel proxy every other AI feature uses —
      // resolves the owner's own Claude key server-side (owner_secrets).
      const result = await callModel({
        modelId: MODELS.claude.id,
        messages: [{ role: "user", content: `Generate ${photos.length} unique short social media captions for a service business (CRM Starter, your area). Each caption should be different. Return only a JSON array of strings, no other text. Number of captions: ${photos.length}` }],
        maxTokens: 500,
      });
      const clean = (result.text || "[]").replace(/```json|```/g, "").trim();
      const captions = JSON.parse(clean);
      setPhotos(prev => prev.map((p, i) => ({ ...p, caption: captions[i] || p.caption })));
      toast("AI captions generated ✓");
    } catch (e: any) { toast("Caption generation failed — " + (e?.message || "unknown error"), "error"); }
    setGenerating(false);
  };

  const scheduleAll = () => {
    const newPosts = photos.filter(p => p.caption).map(p => ({ id: uid(), platform: p.platform || platform, type: "before_after", caption: p.caption, hashtags: "#smallbusiness #localservice #yourcity", scheduledFor: daysFromNow(Math.floor(Math.random() * 7) + 1), status: "scheduled", imagePreview: p.dataUrl, createdAt: today() }));
    setPosts(prev => [...prev, ...newPosts]);
    setPhotos([]);
    toast(newPosts.length + " post" + (newPosts.length !== 1 ? "s" : "") + " scheduled ✓");
  };

  return (
    <div className="space-y-4">
      <Glass className="p-5 !bg-gradient-to-br !from-purple-950/20 !to-black/60 !border-purple-700/30">
        <div className="font-semibold flex items-center gap-2 mb-1">📸 Bulk Photo Upload</div>
        <div className="text-xs text-white/60">Upload multiple before/after photos at once. AI auto-generates captions. Schedule all with one click.</div>
      </Glass>

      <label className="flex flex-col items-center justify-center w-full py-10 border-2 border-dashed border-purple-700/40 rounded-2xl bg-purple-950/10 hover:bg-purple-950/20 cursor-pointer transition">
        <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        <Upload size={36} className="text-purple-400 mb-3 anim-float" />
        <div className="text-sm font-medium text-purple-300">Drop photos here or tap to select</div>
        <div className="text-[10px] text-white/40 mt-1">Select multiple — name files "before_xxx" or "after_xxx" for auto-tagging</div>
      </label>

      {photos.length > 0 && <>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm font-medium">{photos.length} photos ready</div>
          <div className="flex gap-2">
            <GBtn variant="ghost" onClick={genCaptions} disabled={generating} className="!text-xs">{generating ? "Generating…" : <><Zap size={11} className="inline mr-1" />AI Captions</>}</GBtn>
            <GBtn onClick={scheduleAll} disabled={photos.every(p => !p.caption)} className="!text-xs">Schedule All</GBtn>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {photos.map(p => (
            <div key={p.id} className="bg-black/40 border border-brand-900/20 rounded-xl overflow-hidden">
              <div className="relative aspect-video">
                <img src={p.dataUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                <div className={"absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase " + (p.type === "before" ? "bg-blue-600" : p.type === "after" ? "bg-green-600" : "bg-black/70")}>{p.type}</div>
                <button onClick={() => setPhotos(prev => prev.filter(x => x.id !== p.id))} className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded hover:bg-brand-900/60"><X size={10} /></button>
              </div>
              <div className="p-2">
                <GTxt rows={2} value={p.caption} onChange={e => setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, caption: e.target.value } : x))} placeholder="Write caption or generate with AI…" className="!text-xs !py-1" />
              </div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

