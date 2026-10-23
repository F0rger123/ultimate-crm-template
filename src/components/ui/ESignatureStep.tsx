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

export function ESignatureStep({ e, c, sigData, setSigData, canvasRef, startDraw, draw, stopDraw, clearSig, onBack, onNext, companyName = "" }) {
  const [sigMode, setSigMode] = useState("draw");
  const [typedName, setTypedName] = useState("");

  const applyTypedSig = name => {
    setTypedName(name);
    if (!name.trim()) { setSigData(null); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1e3a8a";
    ctx.font = "italic 48px Georgia, serif";
    ctx.textBaseline = "middle";
    ctx.fillText(name, 24, canvas.height / 2);
    setSigData(canvas.toDataURL());
  };

  const switchMode = mode => {
    setSigMode(mode);
    setSigData(null);
    setTypedName("");
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, 580, 160);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="font-semibold mb-1">E-Signature</div>
        <div className="text-xs text-white/60 mb-3">By signing below, you agree to the estimate total of <span className="text-brand-400 font-bold">{fmt(e.total)}</span> and authorize {companyName || "the business"} to perform the listed services.</div>
      </div>
      <div className="flex gap-2">
        {[["draw","✍️ Draw"],["type","⌨️ Type Name"]].map(([m,l]) => (
          <button key={m} onClick={() => switchMode(m)} className={"flex-1 py-2 rounded-xl text-xs font-semibold border transition " + (sigMode === m ? "bg-blue-900/40 border-blue-500/60 text-blue-200" : "bg-black/30 border-white/10 text-white/50 hover:text-white")}>{l}</button>
        ))}
      </div>
      {sigMode === "draw" ? (
        <>
          <div className="bg-white rounded-xl overflow-hidden border-2 border-dashed border-gray-300">
            <canvas ref={canvasRef} width={580} height={160} className="w-full cursor-crosshair touch-none" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
          </div>
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>Sign above with your finger or mouse</span>
            <button onClick={clearSig} className="text-brand-400 hover:text-brand-300">Clear</button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <input type="text" value={typedName} onChange={ev => applyTypedSig(ev.target.value)} placeholder="Type your full name" className="w-full bg-white text-blue-900 rounded-xl px-5 py-4 text-2xl focus:outline-none border-2 border-dashed border-gray-300" style={{ fontFamily: "Georgia, serif", fontStyle: "italic" }} />
          <canvas ref={canvasRef} width={580} height={100} className="hidden" />
          <div className="text-xs text-white/40">Your typed name serves as your electronic signature</div>
        </div>
      )}
      <div className="text-[10px] text-white/40 bg-black/40 border border-white/5 rounded-lg p-2">
        🔒 Electronic signature captured · {new Date().toLocaleString()} · Legally binding
      </div>
      <div className="flex gap-2">
        <GBtn variant="ghost" onClick={onBack} className="flex-1">← Back</GBtn>
        <GBtn onClick={onNext} disabled={!sigData} className="flex-1 !py-3 font-bold">Continue to Payment →</GBtn>
      </div>
    </div>
  );
}

