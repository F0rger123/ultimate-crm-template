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

// FEATURE — "give more options when editing or adding vehicles, such as
// notes, tracking problems and issues." Beyond year/make/model/plate/mileage:
// VIN, color, fuel, assigned driver, purchase, insurance and registration
// expiry (flagged on the Fleet page when close), notes, and a problem log.
const BLANK_VEHICLE = { name: "", year: 2026, make: "", model: "", licensePlate: "", mileage: 0, status: "active", vin: "", color: "", fuelType: "gas", assignedTo: "", purchaseDate: "", purchasePrice: "", insuranceProvider: "", insuranceExpires: "", registrationExpires: "", notes: "", issues: [] as any[] };

export function VehicleModal({ open, onClose, data, onSave, employees = [] as any[] }) {
  const [f, setF] = useState<any>(BLANK_VEHICLE);
  const [newIssue, setNewIssue] = useState({ title: "", severity: "medium", details: "" });
  useEffect(() => { if (open) { setF({ ...BLANK_VEHICLE, ...(data || {}), issues: Array.isArray(data?.issues) ? data.issues : [] }); setNewIssue({ title: "", severity: "medium", details: "" }); } }, [open, data]);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const addIssue = () => {
    if (!newIssue.title.trim()) return;
    set("issues", [{ id: uid(), title: newIssue.title.trim(), details: newIssue.details.trim(), severity: newIssue.severity, status: "open", reportedAt: today() }, ...(f.issues || [])]);
    setNewIssue({ title: "", severity: "medium", details: "" });
  };
  const updIssue = (id: string, patch: any) => set("issues", (f.issues || []).map((i: any) => i.id === id ? { ...i, ...patch } : i));
  const label = "text-xs text-white/60 mb-1 block";
  return <Modal open={open} onClose={onClose} title={data ? "Edit Vehicle" : "New Vehicle"} maxW="max-w-xl">
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Nickname *</label><GInput value={f.name} onChange={e => set("name", e.target.value)} placeholder="Truck 1" /></div>
        <div><label className={label}>Status</label><GSel value={f.status} onChange={e => set("status", e.target.value)}><option value="active" className="bg-black">Active</option><option value="maintenance" className="bg-black">In maintenance</option><option value="retired" className="bg-black">Retired</option></GSel></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={label}>Year</label><GInput type="number" value={f.year} onChange={e => set("year", e.target.value)} /></div>
        <div><label className={label}>Make *</label><GInput value={f.make} onChange={e => set("make", e.target.value)} /></div>
        <div><label className={label}>Model</label><GInput value={f.model} onChange={e => set("model", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={label}>Plate</label><GInput value={f.licensePlate} onChange={e => set("licensePlate", e.target.value)} /></div>
        <div><label className={label}>Mileage</label><GInput type="number" value={f.mileage} onChange={e => set("mileage", e.target.value)} /></div>
        <div><label className={label}>Color</label><GInput value={f.color} onChange={e => set("color", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2"><label className={label}>VIN</label><GInput value={f.vin} onChange={e => set("vin", e.target.value.toUpperCase())} className="font-mono" /></div>
        <div><label className={label}>Fuel</label><GSel value={f.fuelType} onChange={e => set("fuelType", e.target.value)}>{["gas", "diesel", "hybrid", "electric"].map(x => <option key={x} value={x} className="bg-black">{x[0].toUpperCase() + x.slice(1)}</option>)}</GSel></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Usually driven by</label><GSel value={f.assignedTo} onChange={e => set("assignedTo", e.target.value)}><option value="" className="bg-black">— Anyone —</option>{employees.filter((e: any) => e.status !== "inactive").map((e: any) => <option key={e.id} value={e.id} className="bg-black">{e.firstName} {e.lastName}</option>)}</GSel></div>
        <div><label className={label}>Insurance company</label><GInput value={f.insuranceProvider} onChange={e => set("insuranceProvider", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Insurance expires</label><GInput type="date" value={f.insuranceExpires} onChange={e => set("insuranceExpires", e.target.value)} /></div>
        <div><label className={label}>Registration expires</label><GInput type="date" value={f.registrationExpires} onChange={e => set("registrationExpires", e.target.value)} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>Purchased</label><GInput type="date" value={f.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} /></div>
        <div><label className={label}>Purchase price</label><GInput type="number" value={f.purchasePrice} onChange={e => set("purchasePrice", e.target.value)} /></div>
      </div>
      <div><label className={label}>Notes</label><GTxt rows={2} value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Tire sizes, quirks, where the spare key is…" /></div>

      <div className="rounded-xl border border-white/10 p-3 space-y-2">
        <div className="text-xs font-semibold flex items-center justify-between">Problems & issues <span className="text-white/40 font-normal">{(f.issues || []).filter((i: any) => i.status === "open").length} open</span></div>
        <div className="flex gap-2 flex-wrap">
          <GInput value={newIssue.title} onChange={e => setNewIssue({ ...newIssue, title: e.target.value })} placeholder="e.g. Check engine light, AC not blowing cold" className="!text-xs flex-1 min-w-[160px]" onKeyDown={(e: any) => { if (e.key === "Enter") addIssue(); }} />
          <GSel value={newIssue.severity} onChange={e => setNewIssue({ ...newIssue, severity: e.target.value })} className="!text-xs !w-auto">{["low", "medium", "high"].map(x => <option key={x} value={x} className="bg-black">{x}</option>)}</GSel>
          <GBtn variant="ghost" onClick={addIssue} className="!text-xs !py-1.5">Add</GBtn>
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {(f.issues || []).length === 0 && <div className="text-[11px] text-white/35">No problems logged.</div>}
          {(f.issues || []).map((i: any) => (
            <div key={i.id} className={"rounded-lg border px-2 py-1.5 text-xs " + (i.status === "open" ? (i.severity === "high" ? "border-brand-700/50 bg-brand-950/20" : "border-yellow-700/40 bg-yellow-950/10") : "border-white/10 opacity-60")}>
              <div className="flex items-center gap-2">
                <span className={"flex-1 " + (i.status === "fixed" ? "line-through" : "")}>{i.title}</span>
                <span className="text-[10px] text-white/40">{i.severity} · {i.reportedAt}</span>
                {i.status === "open"
                  ? <button onClick={() => updIssue(i.id, { status: "fixed", fixedAt: today() })} className="text-[10px] px-1.5 py-0.5 rounded bg-green-900/40 text-green-300">Mark fixed</button>
                  : <button onClick={() => updIssue(i.id, { status: "open", fixedAt: null })} className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">Reopen</button>}
                <button onClick={() => set("issues", (f.issues || []).filter((x: any) => x.id !== i.id))} className="text-white/30 hover:text-danger-400"><X size={11} /></button>
              </div>
              <GInput value={i.details || ""} onChange={e => updIssue(i.id, { details: e.target.value })} placeholder="Details / what was done / cost" className="!text-[11px] !py-1 mt-1" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1"><GBtn variant="ghost" onClick={onClose}>Cancel</GBtn><GBtn onClick={() => { if (!f.name || !f.make) return; const out = { ...f, year: Number(f.year), mileage: Number(f.mileage), purchasePrice: f.purchasePrice === "" ? "" : Number(f.purchasePrice) }; onSave(data ? { ...data, ...out } : out); }}>{data ? "Save" : "Add"}</GBtn></div>
    </div>
  </Modal>;
}
