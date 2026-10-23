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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, withTimeout } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField } from "../../types";
import { twilioSend, sendEmail, sendOwnerGmailOnly, emailShell } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
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
import { ChemicalModal } from "../ui/ChemicalModal";
import { WeeklyBusinessReview } from "../ui/WeeklyBusinessReview";
import { WeeklyReflectionTab } from "../ui/WeeklyReflectionTab";

export function ChemicalsPage({ chemicals = [], setChemicals, toast = () => {}, settings = {} as AppSettings, ownerId = "", markRecentlyDeleted = (_table: "jobs" | "customers" | "estimates" | "chemicals", _ids: string[]) => {} }: { chemicals?: any[]; setChemicals?: any; toast?: any; settings?: AppSettings; ownerId?: string; markRecentlyDeleted?: (table: "jobs" | "customers" | "estimates" | "chemicals", ids: string[]) => void }) {
  const [modal, setModal] = useState({ open: false, data: null });
  // FEATURE — "Inventory & Equipment": itemType filter so tools/
  // surface cleaners aren't mixed into the chemical reorder math (a tool
  // has no meaningful "gallons remaining" concept) while still living in
  // one shared inventory list.
  const [typeFilter, setTypeFilter] = useState<"all" | "chemical" | "equipment">("all");
  const visible = chemicals.filter(c => typeFilter === "all" || (c.itemType || "chemical") === typeFilter);
  const low = visible.filter(c => (c.itemType || "chemical") === "chemical" && c.stock <= c.reorderLevel);
  const totVal = chemicals.reduce((s, c) => s + c.stock * c.unitCost, 0);
  const equipmentCount = chemicals.filter(c => c.itemType === "equipment").length;
  const save = d => {
    const record = d.id ? d : { ...d, id: uid() };
    if (d.id) setChemicals(chemicals.map(c => c.id === d.id ? record : c));
    else setChemicals([...chemicals, record]);
    setModal({ open: false, data: null });
    // Write immediately rather than waiting on the 30s bulk autosave — same
    // pattern every other page's save() uses so cross-device sync doesn't
    // lag, and so text-Alfred's stock/supplier tools see it right away.
    (supabase as any).from("chemicals").upsert({ ...record, owner_id: ownerId }, { onConflict: "id" }).then((r: any) => {
      if (r?.error) toast("Saved locally, but failed to sync — " + r.error.message, "red");
    }).catch((e: any) => toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red"));
    toast("Item saved");
  };
  const bump = (id, delta) => {
    const next = chemicals.map(c => c.id === id ? { ...c, stock: Math.max(0, c.stock + delta) } : c);
    setChemicals(next);
    const updated = next.find(c => c.id === id);
    if (updated) (supabase as any).from("chemicals").update({ stock: updated.stock }).eq("id", id).select("id").then((r: any) => {
      if (r?.error) { toast("Stock updated locally, but failed to sync — " + r.error.message, "red"); return; }
      if (!Array.isArray(r?.data) || r.data.length === 0) toast("Stock updated locally, but the server didn't confirm — it may revert.", "red");
    }).catch((e: any) => toast("Stock updated locally, but failed to sync — " + (e?.message || "unknown error"), "red"));
  };
  // FEATURE — "add general suppliers — a main mechanic or main shop — by
  // entering their phone, address, and other details, and Alfred should be
  // able to access that information." Distinct from the per-chemical
  // supplier list above: a general contact isn't tied to any one item, so
  // it lives in its own table (migration 0068) and its own section here —
  // no need to open/create a chemical just to record a shop's info.
  const [generalSuppliers, setGeneralSuppliers] = useState<any[]>([]);
  const [supplierModal, setSupplierModal] = useState<{ open: boolean; data: any | null }>({ open: false, data: null });
  const [supplierForm, setSupplierForm] = useState<any>({ name: "", category: "", phone: "", email: "", address: "", website: "", notes: "" });
  useEffect(() => {
    if (!ownerId) return;
    (supabase as any).from("general_suppliers").select("*").eq("owner_id", ownerId).order("name")
      .then((r: any) => { if (!r?.error && Array.isArray(r?.data)) setGeneralSuppliers(r.data); })
      .catch(() => {});
  }, [ownerId]);
  const openSupplierModal = (data: any | null) => {
    setSupplierForm(data ? { ...data } : { name: "", category: "", phone: "", email: "", address: "", website: "", notes: "" });
    setSupplierModal({ open: true, data });
  };
  const saveSupplier = async () => {
    if (!supplierForm.name?.trim()) { toast("Name is required", "red"); return; }
    const record = { ...supplierForm, id: supplierForm.id || uid(), owner_id: ownerId, updated_at: new Date().toISOString() };
    const res = await (supabase as any).from("general_suppliers").upsert(record, { onConflict: "id" });
    if (res?.error) { toast("Failed to save — " + res.error.message, "red"); return; }
    setGeneralSuppliers(prev => supplierForm.id ? prev.map(s => s.id === record.id ? record : s) : [...prev, record]);
    setSupplierModal({ open: false, data: null });
    toast("Supplier saved ✓", "green");
  };
  const deleteSupplier = async (id: string) => {
    if (!window.confirm("Remove this supplier?")) return;
    setGeneralSuppliers(prev => prev.filter(s => s.id !== id));
    const res = await (supabase as any).from("general_suppliers").delete().eq("id", id).select("id");
    if (res?.error) { toast("Removed locally, but failed to remove on server — " + res.error.message, "red"); return; }
    if (!Array.isArray(res?.data) || res.data.length === 0) toast("Removed locally, but the server didn't confirm — it may reappear. Try again or refresh to check.", "red");
  };

  const removeChemical = (id: string) => {
    setChemicals(chemicals.filter(c => c.id !== id));
    markRecentlyDeleted("chemicals", [id]);
    withTimeout((supabase as any).from("chemicals").delete().eq("id", id).select("id"), 10000, "Item delete").then((r: any) => {
      if (r?.error) { toast("Removed locally, but failed to remove on server — " + r.error.message, "red"); return; }
      if (!Array.isArray(r?.data) || r.data.length === 0) toast("Removed locally, but the server didn't confirm — it may reappear. Try again or refresh to check.", "red");
    }).catch((e: any) => toast("Removed locally, but failed to remove on server — " + (e?.message || ""), "red"));
  };

  // ISSUE 13 (round 11) — replaced SMS ("Text Me List") with email, per
  // explicit request; also used by the auto-reminder effect below so a
  // manual click and the automatic daily nudge send the exact same content.
  const reorderListHtml = () => `
    <p>Supplies at or below their reorder point:</p>
    <ul>${low.map(c => `<li><b>${c.name}</b> — ${c.stock} gal left (reorder at ${c.reorderLevel} gal, ${fmt(c.unitCost)}/gal)</li>`).join("")}</ul>
    <p>Total restock cost: <b>${fmt(low.reduce((s, c) => s + ((Math.max(c.reorderLevel * 2, 20) - c.stock) * c.unitCost), 0))}</b></p>`;
  const sendReorderEmail = () => {
    const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
    if (!ownerEmail) { toast("Add your email in Settings → My Profile to get reorder emails"); return; }
    sendOwnerGmailOnly(settings as any, ownerEmail, "📦 Supply reorder needed", emailShell(settings as any, "Supply Reorder List", reorderListHtml()))
      .then(() => toast("Reorder list emailed ✓"))
      .catch((e: any) => toast("Email failed — " + (e?.message || "check Google connection in Settings"), "red"));
  };

  // ISSUE 13 (round 11) — auto-reminder: previously reordering was
  // ENTIRELY manual (the owner had to notice low stock themselves and tap
  // the button). Once per calendar day, if anything is at/below its reorder
  // point, email the same list automatically — same dedupe pattern as the
  // daily briefing/summary auto-sends elsewhere in the app (a persisted
  // date-stamp key, so a reload/re-render can't re-fire it).
  const [lastAutoReorderDate, setLastAutoReorderDate] = usePersistent<string>("crm.chemReorderEmailDate", "");
  useEffect(() => {
    if (low.length === 0) return;
    const todayKey = today();
    if (lastAutoReorderDate === todayKey) return;
    const ownerEmail = (settings as any)?.myEmail || (settings as any)?.companyEmail;
    if (!ownerEmail) return;
    setLastAutoReorderDate(todayKey);
    sendOwnerGmailOnly(settings as any, ownerEmail, "📦 Supply reorder needed", emailShell(settings as any, "Supply Reorder List", reorderListHtml())).catch(() => {});
  }, [low.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* BUG FIX — "the top boxes are too smushed together on mobile." Fixed
          4-column grid regardless of screen width forced every Stat card
          to a tiny sliver on a phone — 2 columns below the sm breakpoint,
          same as the equivalent stat rows elsewhere in this app. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat icon={FlaskConical} label="SKUs" value={chemicals.length} />
        <Stat icon={Wrench} label="Equipment" value={equipmentCount} />
        <Stat icon={AlertTriangle} label="Low Stock" value={low.length} />
        <Stat icon={DollarSign} label="Inventory $" value={fmt(totVal)} />
      </div>
      <div className="flex gap-2">
        {[["all", "All"], ["chemical", "📦 Supplies"], ["equipment", "🔧 Equipment"]].map(([k, l]) => (
          <button key={k} onClick={() => setTypeFilter(k as any)} className={"px-3 py-1.5 rounded-xl text-xs font-medium transition border " + (typeFilter === k ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>
            {l} ({k === "all" ? chemicals.length : chemicals.filter(c => (c.itemType || "chemical") === k).length})
          </button>
        ))}
      </div>
      {low.length > 0 && <Glass className="p-4 !bg-brand-950/30 !border-brand-600/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-danger-400" /><span className="font-semibold text-danger-300">Reorder Suggestion</span></div>
          <button onClick={sendReorderEmail} className="text-[10px] px-2.5 py-1.5 bg-brand-900/40 border border-brand-700/40 text-brand-300 rounded-lg hover:bg-brand-800/50 transition flex items-center gap-1">📧 Email Me List</button>
        </div>
        <div className="space-y-2">
          {low.map(c => {
            const target = Math.max(c.reorderLevel * 2, 20);
            const needed = target - c.stock;
            const cost = needed * c.unitCost;
            return <div key={c.id} className="flex items-center justify-between p-2.5 bg-black/40 border border-brand-900/30 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                <div className="text-[10px] text-white/50">Stock {c.stock} · reorder at {c.reorderLevel} · suggest +{needed} ({fmt(cost)})</div>
              </div>
              <button onClick={() => { bump(c.id, needed); toast("Ordered " + needed + " " + c.name.split(" ")[0]); }} className="px-3 py-1.5 rounded-lg bg-brand-900/40 hover:bg-brand-800/50 border border-brand-600/40 text-brand-300 text-xs font-semibold whitespace-nowrap">Order</button>
            </div>;
          })}
          <div className="flex items-center justify-between pt-2 border-t border-brand-900/30 text-xs">
            <span className="text-white/60">Total restock cost</span>
            <span className="font-bold text-brand-400">{fmt(low.reduce((s, c) => s + ((Math.max(c.reorderLevel * 2, 20) - c.stock) * c.unitCost), 0))}</span>
          </div>
        </div>
      </Glass>}
      {/* FEATURE — general suppliers (mechanic, main shop) not tied to any
          one inventory item. Alfred can text/email these too — see
          the contact_general_supplier tool in alfredSmsAgent.ts. */}
      <Glass className="p-4 !bg-black/40">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-white/50 uppercase tracking-wider flex items-center gap-1.5"><Truck size={11} />General Suppliers</div>
          <GBtn onClick={() => openSupplierModal(null)} className="!py-1.5 !px-3 !text-xs"><Plus size={12} className="inline mr-1" />Add Supplier</GBtn>
        </div>
        {generalSuppliers.length === 0 ? (
          <div className="text-xs text-white/30 italic py-2 text-center">No general suppliers yet — a mechanic, main shop, or vendor not tied to a specific item.</div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {generalSuppliers.map(s => (
              <div key={s.id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-medium text-white truncate">{s.name}{s.category ? <span className="text-white/40 font-normal"> · {s.category}</span> : ""}</div>
                  {s.phone && <a href={"tel:" + s.phone.replace(/[^\d+]/g, "")} className="flex items-center gap-1 text-brand-400 hover:text-brand-300 mt-0.5"><Phone size={9} />{s.phone}</a>}
                  {s.email && <div className="flex items-center gap-1 text-white/50 mt-0.5"><Mail size={9} />{s.email}</div>}
                  {s.address && <div className="flex items-center gap-1 text-white/40 mt-0.5"><MapPin size={9} />{s.address}</div>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openSupplierModal(s)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition"><Edit size={12} /></button>
                  <button onClick={() => deleteSupplier(s.id)} className="p-1.5 rounded-lg hover:bg-danger-950/30 text-white/40 hover:text-danger-400 transition"><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Glass>
      <div className="flex justify-end"><GBtn onClick={() => setModal({ open: true, data: null })}><Plus size={14} className="inline mr-1.5" />Add</GBtn></div>
      <Glass className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-brand-900/30 bg-black/40">
            <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-white/60">Name</th>
            <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-white/60 hidden md:table-cell">Brand</th>
            <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-white/60 hidden lg:table-cell">Supplier</th>
            <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-white/60">On Hand</th>
            <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-white/60">Cost/Unit</th>
            <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-white/60">Actions</th>
          </tr></thead>
          <tbody>
            {visible.map(c => {
              const isEq = (c.itemType || "chemical") === "equipment";
              const lo = !isEq && c.stock <= c.reorderLevel;
              const suppliers: any[] = (c.suppliers && c.suppliers.length) ? c.suppliers : (c.supplier ? [{ id: "legacy", name: c.supplier, phone: "" }] : []);
              return <tr key={c.id} className={"border-b border-brand-900/10 " + (lo ? "bg-brand-950/20" : "hover:bg-white/5")}>
                <td className="px-5 py-4"><div className="flex items-center gap-2">{lo && <AlertTriangle size={14} className="text-danger-400" />}<div><div className="font-medium">{isEq ? "🔧 " : ""}{c.name}</div><div className="text-xs text-white/50 md:hidden">{c.brand}</div></div></div></td>
                <td className="px-5 py-4 text-white/70 hidden md:table-cell">{c.brand}</td>
                <td className="px-5 py-4 text-white/70 hidden lg:table-cell">
                  {suppliers.length === 0 && <span className="text-white/30">—</span>}
                  {suppliers.map(s => (
                    <div key={s.id} className="text-xs">
                      {s.name}
                      {s.phone && <a href={"tel:" + s.phone.replace(/[^\d+]/g, "")} className="ml-1.5 text-brand-400 hover:text-brand-300 inline-flex items-center gap-0.5"><Phone size={9} />{s.phone}</a>}
                    </div>
                  ))}
                </td>
                <td className={"px-5 py-4 text-right font-bold " + (lo ? "text-brand-400" : "")}>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => bump(c.id, -1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white/60">−</button>
                    <span className="w-14 text-center">{c.stock} {c.unit || "each"}</span>
                    <button onClick={() => bump(c.id, 1)} className="w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white/60">+</button>
                  </div>
                </td>
                <td className="px-5 py-4 text-right text-brand-400">{fmt(c.unitCost)}</td>
                <td className="px-5 py-4 text-right">
                  {lo && <a href={"https://www.amazon.com/s?k=" + encodeURIComponent((c.brand ? c.brand + " " : "") + c.name)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 text-[10px] bg-yellow-950/40 border border-yellow-700/40 text-yellow-300 rounded-lg hover:bg-yellow-900/50 mr-1.5" title="Order on Amazon">🛒 Order</a>}
                  <button onClick={() => setModal({ open: true, data: c })} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"><Edit size={14} /></button>
                  <button onClick={() => removeChemical(c.id)} className="p-1.5 rounded-lg hover:bg-danger-900/30 text-white/60 hover:text-danger-400 transition"><Trash2 size={14} /></button>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </Glass>
      <ChemicalModal open={modal.open} onClose={() => setModal({ open: false, data: null })} data={modal.data} onSave={save} />
      <Modal open={supplierModal.open} onClose={() => setSupplierModal({ open: false, data: null })} title={supplierModal.data ? "Edit Supplier" : "New Supplier"} maxW="max-w-md">
        <div className="space-y-3">
          <div><label className="text-xs text-white/60 mb-1 block">Name *</label><GInput value={supplierForm.name} onChange={(e: any) => setSupplierForm({ ...supplierForm, name: e.target.value })} placeholder="e.g. Joe's Auto Repair" /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Category</label><GInput value={supplierForm.category} onChange={(e: any) => setSupplierForm({ ...supplierForm, category: e.target.value })} placeholder="e.g. Mechanic, Main Shop, Parts" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput type="tel" value={supplierForm.phone} onChange={(e: any) => setSupplierForm({ ...supplierForm, phone: e.target.value })} /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput type="email" value={supplierForm.email} onChange={(e: any) => setSupplierForm({ ...supplierForm, email: e.target.value })} /></div>
          </div>
          <div><label className="text-xs text-white/60 mb-1 block">Address</label><GInput value={supplierForm.address} onChange={(e: any) => setSupplierForm({ ...supplierForm, address: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Website</label><GInput type="url" value={supplierForm.website} onChange={(e: any) => setSupplierForm({ ...supplierForm, website: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt rows={2} value={supplierForm.notes} onChange={(e: any) => setSupplierForm({ ...supplierForm, notes: e.target.value })} placeholder="Account #, hours, anything worth remembering" /></div>
          <div className="flex gap-2 justify-end pt-2"><GBtn variant="ghost" onClick={() => setSupplierModal({ open: false, data: null })}>Cancel</GBtn><GBtn onClick={saveSupplier}>Save</GBtn></div>
        </div>
      </Modal>
    </div>
  );
}
