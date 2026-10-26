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
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GDate } from "../ui/GDate";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";
import { Badge } from "../ui/Badge";
import { Stat } from "../ui/Stat";
import { PBar } from "../ui/PBar";
import { PageFade } from "../ui/PageFade";
import { TimeframeSelector } from "../ui/TimeframeSelector";
import { AddressAutocomplete } from "../ui/AddressAutocomplete";
import { BeforeAfterSlider } from "../ui/BeforeAfterSlider";
import { CustomerModal } from "../ui/CustomerModal";
import { CustomerDetail } from "../ui/CustomerDetail";
import { CustomerAnalytics } from "../ui/CustomerAnalytics";
import { EstimateBuilder } from "../ui/EstimateBuilder";
import { EstimatePreview } from "../ui/EstimatePreview";
import { JobDetailModal } from "../ui/JobDetailModal";
import { PipelineScrollContainer } from "../ui/PipelineScrollContainer";
import { SwipeableCard } from "../ui/SwipeableCard";
import { ReviewMonitor } from "../ui/ReviewMonitor";
import { ReviewLandingPage } from "../ui/ReviewLandingPage";
import { ReviewPreview } from "../ui/ReviewPreview";
import { VisualWorkflowBuilder } from "../ui/VisualWorkflowBuilder";
import { AutomationEditor } from "../ui/AutomationEditor";
import { VoiceMicButton } from "../ui/VoiceMicButton";
import { DocumentVault } from "../ui/DocumentVault";
import { ESignatureStep } from "../ui/ESignatureStep";
import { CACCalculator } from "../ui/CACCalculator";
import { MileageUpdateModal } from "../ui/MileageUpdateModal";
import { VehicleModal } from "../ui/VehicleModal";
import { MaintenanceModal } from "../ui/MaintenanceModal";
import { SocialCalendar } from "../ui/SocialCalendar";
import { BulkPhotoUpload } from "../ui/BulkPhotoUpload";
import { ReviewToGraphic } from "../ui/ReviewToGraphic";
import { ABTestPanel } from "../ui/ABTestPanel";
import { CampaignScheduler } from "../ui/CampaignScheduler";
import { PinSettings } from "../ui/PinSettings";
import { ServiceCatalogSection } from "../ui/ServiceCatalogSection";
import { TemplateEditor } from "../ui/TemplateEditor";
import { AIModelsSection } from "../ui/AIModelsSection";
import { WeeklyBusinessReview } from "../ui/WeeklyBusinessReview";
import { WeeklyReflectionTab } from "../ui/WeeklyReflectionTab";

export function FleetPage({ vehicles = [], setVehicles, maintenance = [], setMaintenance, toast, employees = [] as any[] }) {
  const [modal, setModal] = useState({ open: false, data: null });
  const [maintId, setMaintId] = useState(null);
  const [logMiles, setLogMiles] = useState(null); // vehicle id for quick mileage log
  // FEATURE — editing already worked for every vehicle regardless of status
  // (the Edit button below was never gated), but a retired/past vehicle had
  // no way to be found other than scrolling a mixed list, which read as "I
  // can't get back to old vehicles to edit them." A status filter makes
  // past vehicles a one-click destination instead of a scroll hunt.
  const [statusFilter, setStatusFilter] = useState("all");

  const save = d => {
    if (d.id) setVehicles(vehicles.map(v => v.id === d.id ? d : v));
    else setVehicles([...vehicles, { ...d, id: uid() }]);
    setModal({ open: false, data: null });
    toast("Vehicle saved");
  };
  // Vehicles sync through owner_records (useCloudCollection), so removing it
  // here removes it everywhere.
  const removeVehicle = (v: any) => {
    if (!window.confirm(`Delete ${v.name || "this vehicle"}? Its service history is deleted too.`)) return;
    setVehicles(vehicles.filter(x => x.id !== v.id));
    setMaintenance(maintenance.filter(m => m.vehicleId !== v.id));
    toast("Vehicle deleted");
  };
  // Days until a YYYY-MM-DD date (negative once it's passed).
  const daysUntil = (d?: string) => d ? Math.ceil((Date.parse(d + "T23:59:59") - Date.now()) / 86400000) : Infinity;
  const soon = (d?: string) => !!d && daysUntil(d) <= 30; // expires within 30 days, or already has

  // Check maintenance due — last oil change > 3000 miles ago or > 90 days
  const maintDue = vehicles.filter(v => {
    const lastOil = maintenance.filter(m => m.vehicleId === v.id && m.type?.toLowerCase().includes("oil")).sort((a,b) => b.date?.localeCompare(a.date))[0];
    if (!lastOil) return true; // never done
    return daysSince(lastOil.date) > 90 || (Number(v.mileage) - Number(lastOil.mileageAt || 0)) > 3000;
  });

  const totalMiles = vehicles.reduce((s, v) => s + Number(v.mileage || 0), 0);
  const totalMaintCost = maintenance.reduce((s, m) => s + Number(m.cost || 0), 0);
  const irsDeduction = (totalMiles * 0.67).toFixed(0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Truck} label="Fleet Size" value={vehicles.length} />
        <Stat icon={CheckCircle} label="Active" value={vehicles.filter(v => v.status === "active").length} />
        <Stat icon={AlertTriangle} label="Service Due" value={maintDue.length} change={maintDue.length > 0 ? "⚠️" : "✅"} />
        <Stat icon={DollarSign} label="IRS Deduction" value={"$" + Number(irsDeduction).toLocaleString()} />
      </div>

      {/* Maintenance due alerts */}
      {maintDue.length > 0 && <Glass className="p-4 !bg-yellow-950/20 !border-yellow-700/40">
        <div className="flex items-center gap-2 mb-3"><AlertTriangle size={14} className="text-yellow-400" /><span className="font-semibold text-yellow-300 text-sm">Service Due</span></div>
        <div className="space-y-2">
          {maintDue.map(v => {
            const lastOil = maintenance.filter(m => m.vehicleId === v.id && m.type?.toLowerCase().includes("oil")).sort((a,b) => b.date?.localeCompare(a.date))[0];
            return <div key={v.id} className="flex items-center justify-between text-xs p-2 bg-black/40 rounded-xl">
              <div><span className="font-semibold">{v.name}</span> <span className="text-white/50">— Oil change {lastOil ? daysSince(lastOil.date) + " days ago" : "never logged"}</span></div>
              <button onClick={() => setMaintId(v.id)} className="px-2.5 py-1.5 rounded-lg bg-yellow-900/40 border border-yellow-700/40 text-yellow-300 hover:bg-yellow-900/60 transition">Log Service</button>
            </div>;
          })}
        </div>
      </Glass>}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-white/50">{totalMiles.toLocaleString()} total fleet miles · ${(totalMaintCost).toFixed(0)} maintenance YTD</div>
        <div className="flex gap-2">
          <GBtn variant="ghost" className="!text-xs" onClick={() => {
            const irsRate = 0.67;
            const html = `<!DOCTYPE html><html><head><title>Mileage Log</title><style>body{font-family:Arial;padding:32px;max-width:800px;margin:auto;color:#111}h1{color:#111111}table{width:100%;border-collapse:collapse;margin:16px 0;font-size:12px}th{background:#f5f5f5;padding:8px;text-align:left;border-bottom:2px solid #ccc;font-size:10px;text-transform:uppercase}td{padding:7px;border-bottom:1px solid #eee}.r{text-align:right}.total{font-weight:bold;background:#fff8f0}</style></head><body>
            <h1>CRM Starter — Mileage & Fleet Log</h1><p style="color:#666">IRS Rate: $${irsRate}/mile · Generated ${today()}</p>
            <table><thead><tr><th>Vehicle</th><th>Year/Make/Model</th><th>License</th><th class="r">Odometer</th><th class="r">Est. Deduction</th></tr></thead><tbody>
            ${vehicles.map(v => `<tr><td>${v.name}</td><td>${v.year||""} ${v.make||""} ${v.model||""}</td><td>${v.licensePlate||""}</td><td class="r">${Number(v.mileage||0).toLocaleString()} mi</td><td class="r">$${(Number(v.mileage || 0) * irsRate).toFixed(2)}</td></tr>`).join("")}
            <tr class="total"><td colspan="3"><strong>Total Fleet</strong></td><td class="r"><strong>${totalMiles.toLocaleString()} mi</strong></td><td class="r"><strong>$${(totalMiles*irsRate).toFixed(2)}</strong></td></tr>
            </tbody></table>
            ${maintenance.length > 0 ? `<h2>Maintenance Records</h2><table><thead><tr><th>Date</th><th>Vehicle</th><th>Type</th><th class="r">Cost</th><th>Mileage</th><th>Notes</th></tr></thead><tbody>${maintenance.slice(0,100).map(m=>{const v=vehicles.find(x=>x.id===m.vehicleId);return`<tr><td>${m.date}</td><td>${v?.name||"?"}</td><td>${m.type}</td><td class="r">$${Number(m.cost||0).toFixed(2)}</td><td class="r">${m.mileageAt||"—"}</td><td>${m.notes||""}</td></tr>`;}).join("")}</tbody></table>` : ""}
            <p style="font-size:10px;color:#888;margin-top:24px">Total maintenance cost: $${totalMaintCost.toFixed(2)} · IRS mileage deduction: $${(totalMiles*irsRate).toFixed(2)}</p>
            <script>window.onload=()=>setTimeout(window.print,300)<\/script></body></html>`;
            const w = window.open("","_blank"); if(w){w.document.write(html);w.document.close();}
          }}><Download size={12} className="inline mr-1" />Fleet PDF</GBtn>
          <GBtn onClick={() => setModal({ open: true, data: null })}><Plus size={14} className="inline mr-1.5" />Add Vehicle</GBtn>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[["all", "All"], ["active", "Active"], ["maintenance", "In Maintenance"], ["retired", "Retired / Past"]].map(([k, l]) => (
          <button key={k} onClick={() => setStatusFilter(k)} className={"px-3 py-1.5 rounded-xl text-xs font-medium transition border " + (statusFilter === k ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>
            {l} ({k === "all" ? vehicles.length : vehicles.filter(v => v.status === k).length})
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.filter(v => statusFilter === "all" || v.status === statusFilter).map(v => {
          const vMaint = maintenance.filter(m => m.vehicleId === v.id).sort((a,b) => b.date?.localeCompare(a.date));
          const lastService = vMaint[0];
          const isDue = maintDue.find(x => x.id === v.id);
          return <Glass key={v.id} className={"p-5 transition " + (isDue ? "!border-yellow-600/40 !bg-yellow-950/10 hover:!border-yellow-500/60" : "hover:border-brand-600/50")}>
            <div className="flex items-start justify-between mb-3">
              <div className={"p-2.5 rounded-xl bg-gradient-to-br " + (isDue ? "from-yellow-600 to-yellow-900" : "from-brand-600 to-brand-900")}><Truck size={20} /></div>
              <Badge tone={v.status === "active" ? "green" : v.status === "maintenance" ? "yellow" : "gray"}>{v.status}</Badge>
            </div>
            <div className="font-bold text-lg mb-1">{v.name}</div>
            <div className="text-xs text-white/60 mb-1">{v.year} {v.make} {v.model}{v.color ? ` · ${v.color}` : ""}</div>
            {(() => {
              const open = (v.issues || []).filter((i: any) => i.status === "open");
              const driver = employees.find((e: any) => e.id === v.assignedTo);
              return (
                <div className="flex flex-wrap gap-1 mb-2">
                  {open.length > 0 && <button onClick={() => setModal({ open: true, data: v })} className={"text-[10px] px-2 py-0.5 rounded-full border " + (open.some((i: any) => i.severity === "high") ? "bg-brand-950/40 border-brand-700/50 text-danger-300" : "bg-yellow-950/30 border-yellow-700/40 text-yellow-300")}>{open.length} open problem{open.length > 1 ? "s" : ""}: {open[0].title}{open.length > 1 ? "…" : ""}</button>}
                  {soon(v.insuranceExpires) && <span className="text-[10px] px-2 py-0.5 rounded-full border bg-orange-950/30 border-orange-700/40 text-orange-300">Insurance {daysUntil(v.insuranceExpires) < 0 ? "expired" : "expires"} {v.insuranceExpires}</span>}
                  {soon(v.registrationExpires) && <span className="text-[10px] px-2 py-0.5 rounded-full border bg-orange-950/30 border-orange-700/40 text-orange-300">Registration {daysUntil(v.registrationExpires) < 0 ? "expired" : "expires"} {v.registrationExpires}</span>}
                  {driver && <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/50">Driver: {driver.firstName}</span>}
                </div>
              );
            })()}
            {v.notes && <div className="text-[11px] text-white/45 italic mb-2 line-clamp-2">{v.notes}</div>}
            <div className="space-y-1.5 text-xs text-white/70 py-3 border-t border-brand-900/30">
              <div className="flex justify-between"><span>Plate</span><span className="font-mono text-white">{v.licensePlate}</span></div>
              <div className="flex justify-between"><span>Mileage</span>
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-brand-400">{Number(v.mileage||0).toLocaleString()} mi</span>
                  <button onClick={() => setLogMiles(v.id)} className="text-[9px] text-white/30 hover:text-white/60 underline">update</button>
                </div>
              </div>
              <div className="flex justify-between"><span>IRS est.</span><span className="text-green-400">{fmt(Number(v.mileage||0)*0.67)} deduction</span></div>
              {lastService && <div className="flex justify-between"><span>Last service</span><span className="text-white/50">{lastService.type} · {lastService.date}</span></div>}
              {isDue && <div className="text-yellow-400 text-[10px] flex items-center gap-1"><AlertTriangle size={9} />Service overdue</div>}
            </div>
            <div className="flex gap-1 pt-3 border-t border-brand-900/30">
              <button onClick={() => setMaintId(v.id)} className="flex-1 p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-xs flex items-center justify-center gap-1"><Settings size={12} />Service</button>
              <button onClick={() => setModal({ open: true, data: v })} className="flex-1 p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white text-xs flex items-center justify-center gap-1"><Edit size={12} />Edit</button>
              <button onClick={() => removeVehicle(v)} title="Delete vehicle" className="p-2 rounded-lg hover:bg-brand-900/30 text-white/40 hover:text-danger-400 text-xs"><Trash2 size={12} /></button>
            </div>
          </Glass>;
        })}
      </div>

      {/* Mileage quick-update modal */}
      <MileageUpdateModal logMiles={logMiles} vehicles={vehicles} setVehicles={setVehicles} toast={toast} onClose={() => setLogMiles(null)} />

      <VehicleModal open={modal.open} onClose={() => setModal({ open: false, data: null })} data={modal.data} onSave={save} employees={employees} />
      <MaintenanceModal vid={maintId} vehicle={vehicles.find(v => v.id === maintId)} onClose={() => setMaintId(null)} maintenance={maintenance} setMaintenance={setMaintenance} toast={toast} />
    </div>
  );
}
