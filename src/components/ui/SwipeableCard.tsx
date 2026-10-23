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

export function SwipeableCard({ job, stages = [], onMove, children, currentStage = null }) {
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const [swipeHint, setSwipeHint] = useState(null); // "left" | "right" | null

  // Prefer the column the card is actually rendered in (currentStage) over the
  // raw job.pipelineStage — auto-tracked jobs may have no explicit stage set,
  // which would otherwise leave currentIdx at -1 and break swipe.
  const currentIdx = stages.findIndex(s => s.key === (currentStage || job.pipelineStage));

  const onTouchStart = e => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setSwipeHint(null);
  };

  const onTouchMove = e => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (Math.abs(dx) > 20 && dy < 40) {
      setSwipeHint(dx > 0 ? "right" : "left");
    }
  };

  const onTouchEnd = e => {
    if (touchStartX.current === null) { setSwipeHint(null); return; }
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    touchStartX.current = null;
    touchStartY.current = null;
    setSwipeHint(null);

    // Only trigger stage move if horizontal swipe > 60px and not mostly vertical
    if (Math.abs(dx) < 60 || dy > 60) return;

    if (dx > 0 && currentIdx > 0) {
      // Swipe right → move to previous stage
      onMove(job.id, stages[currentIdx - 1].key);
    } else if (dx < 0 && currentIdx < stages.length - 1) {
      // Swipe left → move to next stage
      const nextStage = stages[currentIdx + 1];
      if (nextStage.key === "lost") return; // don't auto-move to lost via swipe
      onMove(job.id, nextStage.key);
    }
  };

  return (
    <div
      className="pipeline-card relative"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        transform: swipeHint === "left" ? "translateX(-6px)" : swipeHint === "right" ? "translateX(6px)" : "translateX(0)",
        transition: swipeHint ? "transform 0.1s ease" : "transform 0.2s ease",
      }}
    >
      {/* Swipe direction indicators */}
      {swipeHint === "right" && currentIdx > 0 && (
        <div className="absolute inset-0 rounded-xl bg-blue-500/15 border-2 border-blue-400/50 pointer-events-none z-10 flex items-center justify-start pl-2">
          <div className="text-[10px] text-blue-300 font-bold flex items-center gap-1 bg-blue-950/80 px-2 py-1 rounded-lg">
            <ChevronLeft size={12} />
            {stages[currentIdx - 1]?.label}
          </div>
        </div>
      )}
      {swipeHint === "left" && currentIdx < stages.length - 2 && (
        <div className="absolute inset-0 rounded-xl bg-green-500/15 border-2 border-green-400/50 pointer-events-none z-10 flex items-center justify-end pr-2">
          <div className="text-[10px] text-green-300 font-bold flex items-center gap-1 bg-green-950/80 px-2 py-1 rounded-lg">
            {stages[currentIdx + 1]?.label}
            <ChevronRight size={12} />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

