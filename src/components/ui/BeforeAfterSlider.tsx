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

export function BeforeAfterSlider({ before, after }) {
  const [pos, setPos] = useState(50); // 0-100 percent
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const updatePos = (clientX) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  };

  const onMouseDown = e => { dragging.current = true; updatePos(e.clientX); };
  const onMouseMove = e => { if (dragging.current) updatePos(e.clientX); };
  const onMouseUp = () => { dragging.current = false; };
  const onTouchStart = e => { dragging.current = true; updatePos(e.touches[0].clientX); };
  const onTouchMove = e => { if (dragging.current) { e.preventDefault(); updatePos(e.touches[0].clientX); } };

  useEffect(() => {
    window.addEventListener("mouseup", onMouseUp);
    return () => window.removeEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full aspect-video rounded-xl overflow-hidden cursor-ew-resize select-none border border-brand-900/30 mb-2" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}>
      {/* After (full width background) */}
      <img src={after} alt="After" className="absolute inset-0 w-full h-full object-cover" />
      {/* Before (clipped) */}
      <div className="absolute inset-0 overflow-hidden" style={{ width: pos + "%" }}>
        <img src={before} alt="Before" className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: (100 / pos * 100) + "%", maxWidth: "none" }} />
      </div>
      {/* Divider */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: pos + "%", transform: "translateX(-50%)" }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-xl flex items-center justify-center" style={{ left: "50%" }}>
          <span className="text-gray-800 text-xs font-bold select-none">⇔</span>
        </div>
      </div>
      {/* Labels */}
      <div className="absolute top-2 left-2 text-[10px] bg-blue-600/90 text-white px-2 py-0.5 rounded font-bold uppercase">Before</div>
      <div className="absolute top-2 right-2 text-[10px] bg-green-600/90 text-white px-2 py-0.5 rounded font-bold uppercase">After</div>
    </div>
  );
}

