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

export function MaintenanceModal({ vid, vehicle, onClose, maintenance = [], setMaintenance, toast }) {
  const [f, setF] = useState({ date: today(), type: "Oil Change", cost: 0, mileageAt: 0, notes: "" });
  useEffect(() => { if (vehicle) setF({ date: today(), type: "Oil Change", cost: 0, mileageAt: vehicle.mileage || 0, notes: "" }); }, [vid, vehicle]);
  if (!vid || !vehicle) return null;
  const mArr = Array.isArray(maintenance) ? maintenance : [];
  const logs = mArr.filter(m => m.vehicleId === vid).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const total = logs.reduce((s, l) => s + Number(l.cost), 0);
  const types = ["Oil Change", "Tire Rotation", "Brake Service", "Inspection", "Transmission", "Coolant", "Air Filter", "Wiper Blades", "Other"];
  const add = () => {
    const e = { id: uid(), vehicleId: vid, ...f, cost: Number(f.cost), mileageAt: Number(f.mileageAt) };
    setMaintenance(prev => [...(Array.isArray(prev) ? prev : []), e]);
    setF({ date: today(), type: "Oil Change", cost: 0, mileageAt: vehicle.mileage, notes: "" });
    toast("Service logged ✓");
  };
  const rem = id => setMaintenance(prev => (Array.isArray(prev) ? prev : []).filter(m => m.id !== id));
  return <Modal open={!!vid} onClose={onClose} title={vehicle.name + " — Maintenance"} maxW="max-w-2xl">
    <div className="space-y-4">
      <Glass className="p-3 !bg-black/40 grid grid-cols-3 gap-3 text-center">
        <div><div className="text-xs text-white/50 uppercase">Logs</div><div className="text-xl font-bold">{logs.length}</div></div>
        <div><div className="text-xs text-white/50 uppercase">Spent</div><div className="text-xl font-bold text-brand-400">{fmt(total)}</div></div>
        <div><div className="text-xs text-white/50 uppercase">Mileage</div><div className="text-xl font-bold">{Number(vehicle.mileage).toLocaleString()}</div></div>
      </Glass>
      <Glass className="p-3 !bg-black/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
          <GDate value={f.date} onChange={e => setF({ ...f, date: e.target.value })} className="!py-1.5 !text-xs" />
          <GSel value={f.type} onChange={e => setF({ ...f, type: e.target.value })} className="!py-1.5 !text-xs">{types.map(t => <option key={t} value={t} className="bg-black">{t}</option>)}</GSel>
          <GInput type="number" placeholder="Cost" value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} className="!py-1.5 !text-xs" />
          <GInput type="number" placeholder="Mileage at service" value={f.mileageAt} onChange={e => setF({ ...f, mileageAt: e.target.value })} className="!py-1.5 !text-xs" />
        </div>
        <div className="flex gap-2">
          <GInput placeholder="Notes" value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} className="!py-1.5 !text-xs" />
          <GBtn onClick={add} className="!py-1.5"><Plus size={14} /></GBtn>
        </div>
      </Glass>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {logs.length ? logs.map(l => <div key={l.id} className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl">
          <div className="p-2 rounded-lg bg-brand-900/30"><Settings size={12} className="text-brand-400" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{l.type}</div>
            <div className="text-xs text-white/50">{l.date} · {Number(l.mileageAt || l.mileage || 0).toLocaleString()} mi{l.notes ? " · " + l.notes : ""}</div>
          </div>
          <div className="font-semibold text-brand-400">{fmt(l.cost)}</div>
          <button onClick={() => rem(l.id)} className="p-1 text-white/40 hover:text-danger-400"><Trash2 size={12} /></button>
        </div>) : <div className="text-center py-6 text-white/40 text-sm">No maintenance logged</div>}
      </div>
    </div>
  </Modal>;
}

// ===== SOCIAL =====
// ===== LEAD INTAKE PAGE =====
// Simulates what a "form from your website" looks like in the CRM
// Leads submitted here auto-create a customer + pipeline entry
