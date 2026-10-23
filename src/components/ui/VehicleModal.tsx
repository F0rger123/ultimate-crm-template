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

export function VehicleModal({ open, onClose, data, onSave }) {
  const [f, setF] = useState({ name: "", year: 2026, make: "", model: "", licensePlate: "", mileage: 0, status: "active" });
  useEffect(() => { if (open) setF(data || { name: "", year: 2026, make: "", model: "", licensePlate: "", mileage: 0, status: "active" }); }, [open, data]);
  return <Modal open={open} onClose={onClose} title={data ? "Edit Vehicle" : "New Vehicle"}>
    <div className="space-y-3">
      <div><label className="text-xs text-white/60 mb-1 block">Nickname *</label><GInput value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-white/60 mb-1 block">Year</label><GInput type="number" value={f.year} onChange={e => setF({ ...f, year: e.target.value })} /></div>
        <div className="col-span-2"><label className="text-xs text-white/60 mb-1 block">Make *</label><GInput value={f.make} onChange={e => setF({ ...f, make: e.target.value })} /></div>
      </div>
      <div><label className="text-xs text-white/60 mb-1 block">Model</label><GInput value={f.model} onChange={e => setF({ ...f, model: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-white/60 mb-1 block">Plate</label><GInput value={f.licensePlate} onChange={e => setF({ ...f, licensePlate: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Mileage</label><GInput type="number" value={f.mileage} onChange={e => setF({ ...f, mileage: e.target.value })} /></div>
      </div>
      <div><label className="text-xs text-white/60 mb-1 block">Status</label><GSel value={f.status} onChange={e => setF({ ...f, status: e.target.value })}><option value="active" className="bg-black">Active</option><option value="maintenance" className="bg-black">Maintenance</option><option value="retired" className="bg-black">Retired</option></GSel></div>
      <div className="flex gap-2 justify-end pt-3"><GBtn variant="ghost" onClick={onClose}>Cancel</GBtn><GBtn onClick={() => { if (!f.name || !f.make) return; onSave(data ? { ...data, ...f, year: Number(f.year), mileage: Number(f.mileage) } : { ...f, year: Number(f.year), mileage: Number(f.mileage) }); }}>{data ? "Save" : "Add"}</GBtn></div>
    </div>
  </Modal>;
}
