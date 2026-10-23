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

const EMPTY_SERVICE_FORM = { name: "", description: "", customerDescription: "", internalNotes: "", price: "", minPrice: "", maxPrice: "", unit: "flat", category: "Washing", taxable: true, checklistTemplate: [] as { id: string; label: string; required?: boolean; photoRequired?: boolean }[], depositRequired: "", depositType: "amount" as "amount" | "percent", depositMandatory: false };

export function ServiceCatalogSection({ services = [], setServices, toast }) {
  const [f, setF] = useState(EMPTY_SERVICE_FORM);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  // FEATURE 4 — checklist template item being added, and native HTML5
  // drag-and-drop reorder state (this codebase has no DnD library installed;
  // CalendarPage.tsx's month-grid drag/drop uses the same plain draggable +
  // onDragOver/onDrop pattern).
  const [newChecklistLabel, setNewChecklistLabel] = useState("");
  const [ckDragIdx, setCkDragIdx] = useState<number | null>(null);

  const categories = ["General", "Installation", "Repair", "Maintenance", "Commercial", "Recurring", "Add-on", "Other"];

  const save = () => {
    if (!f.name.trim() || !f.price) return;
    const depositFields = { depositRequired: f.depositRequired ? Number(f.depositRequired) : undefined, depositType: f.depositType, depositMandatory: f.depositMandatory };
    if (editId) {
      setServices(prev => prev.map(s => s.id === editId ? { ...s, ...f, ...depositFields, price: Number(f.price), basePrice: Number(f.price), minPrice: f.minPrice ? Number(f.minPrice) : undefined, maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined } : s));
      toast("Service updated");
    } else {
      setServices(prev => [...prev, { id: uid(), ...f, ...depositFields, price: Number(f.price), basePrice: Number(f.price), minPrice: f.minPrice ? Number(f.minPrice) : undefined, maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined }]);
      toast("Service added");
    }
    setF(EMPTY_SERVICE_FORM);
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = s => { setF({ name: s.name, description: s.description || "", customerDescription: s.customerDescription || "", internalNotes: s.internalNotes || "", price: String(s.basePrice || s.price || ""), minPrice: String(s.minPrice || ""), maxPrice: String(s.maxPrice || ""), unit: s.unit || "flat", category: s.category || "Washing", taxable: s.taxable !== false, checklistTemplate: s.checklistTemplate || [], depositRequired: s.depositRequired ? String(s.depositRequired) : "", depositType: s.depositType || "amount", depositMandatory: !!s.depositMandatory }); setEditId(s.id); setShowForm(true); };
  const del = id => { if (confirm("Remove service?")) setServices(prev => prev.filter(s => s.id !== id)); };

  // FEATURE 4 — checklist template item helpers, scoped to the form's draft
  // (f.checklistTemplate) until Save is clicked, same as every other field here.
  const addChecklistItem = () => {
    if (!newChecklistLabel.trim()) return;
    setF(prev => ({ ...prev, checklistTemplate: [...(prev.checklistTemplate || []), { id: uid(), label: newChecklistLabel.trim(), required: false, photoRequired: false }] }));
    setNewChecklistLabel("");
  };
  const updateChecklistItem = (id: string, patch: any) => {
    setF(prev => ({ ...prev, checklistTemplate: (prev.checklistTemplate || []).map(it => it.id === id ? { ...it, ...patch } : it) }));
  };
  const deleteChecklistItem = (id: string) => {
    setF(prev => ({ ...prev, checklistTemplate: (prev.checklistTemplate || []).filter(it => it.id !== id) }));
  };
  const reorderChecklistItem = (targetIdx: number) => {
    if (ckDragIdx === null || ckDragIdx === targetIdx) return;
    setF(prev => {
      const items = [...(prev.checklistTemplate || [])];
      const [moved] = items.splice(ckDragIdx, 1);
      items.splice(targetIdx, 0, moved);
      return { ...prev, checklistTemplate: items };
    });
    setCkDragIdx(targetIdx);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Service Catalog</h4>
        <GBtn onClick={() => { setF(EMPTY_SERVICE_FORM); setEditId(null); setShowForm(!showForm); }} className="!text-xs !py-1.5"><Plus size={11} className="inline mr-1" />{showForm ? "Cancel" : "Add Service"}</GBtn>
      </div>

      {showForm && <Glass className="p-4 !bg-black/60">
        <div className="text-xs font-semibold text-white/70 mb-3">{editId ? "Edit Service" : "New Service"}</div>
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-[10px] text-white/50 mb-1 block">Service name *</label><GInput value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="standard service" className="!text-xs" /></div>
            <div><label className="text-[10px] text-white/50 mb-1 block">Category</label><GSel value={f.category} onChange={e => setF({ ...f, category: e.target.value })} className="!text-xs">{categories.map(c => <option key={c} value={c} className="bg-black">{c}</option>)}</GSel></div>
          </div>
          <div><label className="text-[10px] text-white/50 mb-1 block">Internal description</label><GInput value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Internal notes about this service" className="!text-xs" /></div>
          <div><label className="text-[10px] text-white/50 mb-1 block flex items-center gap-1"><Eye size={9} />Customer-facing description <span className="text-white/30">(appears on estimates)</span></label><GTxt rows={2} value={f.customerDescription} onChange={e => setF({ ...f, customerDescription: e.target.value })} placeholder="What the customer gets, in plain language" className="!text-xs" /></div>
          <div><label className="text-[10px] text-white/50 mb-1 block flex items-center gap-1"><Lock size={9} className="text-yellow-400" />Internal crew notes <span className="text-white/30">(not shown to customer)</span></label><GTxt rows={2} value={f.internalNotes} onChange={e => setF({ ...f, internalNotes: e.target.value })} placeholder="Use SH at 3% mix, rinse from top down, watch for painted wood trim…" className="!text-xs" /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-[10px] text-white/50 mb-1 block">Default Price ($) *</label><GInput type="number" step="5" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} placeholder="450" className="!text-xs" /></div>
            <div><label className="text-[10px] text-white/50 mb-1 block">Min Price ($)</label><GInput type="number" step="5" value={f.minPrice} onChange={e => setF({ ...f, minPrice: e.target.value })} placeholder="300" className="!text-xs" /></div>
            <div><label className="text-[10px] text-white/50 mb-1 block">Max Price ($)</label><GInput type="number" step="5" value={f.maxPrice} onChange={e => setF({ ...f, maxPrice: e.target.value })} placeholder="700" className="!text-xs" /></div>
          </div>
          <div><label className="text-[10px] text-white/50 mb-1 block">Pricing Unit</label><GSel value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} className="!text-xs">
            <option value="flat" className="bg-black">Flat rate</option>
            <option value="sqft" className="bg-black">Per sq ft</option>
            <option value="linear_ft" className="bg-black">Per linear ft</option>
            <option value="hour" className="bg-black">Per hour</option>
          </GSel></div>
          <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={f.taxable} onChange={e => setF({ ...f, taxable: e.target.checked })} className="w-3.5 h-3.5" />Taxable service</label>

          {/* Per-service deposit — applied automatically to a new estimate's
              deposit fields the first time this service is added
              (EstimateBuilder.tsx's addSvc), so the owner doesn't have to
              remember to set it manually every time, e.g. "always require a
              deposit on Sealing jobs." */}
          <div className="pt-2 border-t border-white/10">
            <div className="text-[10px] text-white/50 mb-1.5 flex items-center gap-1"><DollarSign size={9} />Default deposit for this service <span className="text-white/30">(optional — auto-fills the estimate)</span></div>
            <div className="grid grid-cols-2 gap-2 mb-1.5">
              <GInput type="number" step="5" value={f.depositRequired} onChange={e => setF({ ...f, depositRequired: e.target.value })} placeholder="e.g. 25" className="!text-xs" />
              <GSel value={f.depositType} onChange={e => setF({ ...f, depositType: e.target.value as any })} className="!text-xs">
                <option value="amount" className="bg-black">$ flat</option>
                <option value="percent" className="bg-black">% of total</option>
              </GSel>
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={f.depositMandatory} onChange={e => setF({ ...f, depositMandatory: e.target.checked })} className="w-3.5 h-3.5" />Mandatory (customer must pay it to book)</label>
          </div>

          {/* FEATURE 4 — checklist template. Drag the grip handle to reorder;
              each item can be flagged required and/or photo-required. Copied
              into a job's checklist at creation (combined with any other
              linked services' templates) via buildChecklistFromServices. */}
          <div className="pt-2 border-t border-white/10">
            <label className="text-[10px] text-white/50 mb-1.5 block flex items-center gap-1"><CheckSquare size={9} />Checklist Template <span className="text-white/30">(copied onto jobs using this service)</span></label>
            <div className="space-y-1.5">
              {(f.checklistTemplate || []).map((item, idx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => setCkDragIdx(idx)}
                  onDragOver={e => { e.preventDefault(); reorderChecklistItem(idx); }}
                  onDragEnd={() => setCkDragIdx(null)}
                  className="flex items-center gap-2 p-2 bg-black/30 border border-white/10 rounded-lg"
                >
                  <GripVertical size={12} className="text-white/30 cursor-grab flex-shrink-0" />
                  <GInput value={item.label} onChange={e => updateChecklistItem(item.id, { label: e.target.value })} className="!text-xs flex-1" />
                  <label className="flex items-center gap-1 text-[9px] text-white/50 cursor-pointer flex-shrink-0">
                    <input type="checkbox" checked={!!item.required} onChange={e => updateChecklistItem(item.id, { required: e.target.checked })} className="w-3 h-3 accent-neutral-300" />Required
                  </label>
                  <label className="flex items-center gap-1 text-[9px] text-white/50 cursor-pointer flex-shrink-0">
                    <input type="checkbox" checked={!!item.photoRequired} onChange={e => updateChecklistItem(item.id, { photoRequired: e.target.checked })} className="w-3 h-3 accent-blue-600" />Photo
                  </label>
                  <button onClick={() => deleteChecklistItem(item.id)} className="p-1 text-white/30 hover:text-danger-400 flex-shrink-0"><Trash2 size={11} /></button>
                </div>
              ))}
              {(f.checklistTemplate || []).length === 0 && <div className="text-[10px] text-white/30 py-1">No checklist items yet</div>}
            </div>
            <div className="flex gap-2 mt-1.5">
              <GInput
                value={newChecklistLabel}
                onChange={e => setNewChecklistLabel(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
                placeholder="e.g. Confirm water access"
                className="!text-xs flex-1"
              />
              <GBtn variant="ghost" onClick={addChecklistItem} disabled={!newChecklistLabel.trim()} className="!text-xs !py-1.5"><Plus size={11} className="inline mr-1" />Add</GBtn>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <GBtn variant="ghost" onClick={() => { setShowForm(false); setEditId(null); setF(EMPTY_SERVICE_FORM); }} className="!text-xs !py-1.5">Cancel</GBtn>
            <GBtn onClick={save} disabled={!f.name.trim() || !f.price} className="!text-xs !py-1.5">Save</GBtn>
          </div>
        </div>
      </Glass>}

      <div className="space-y-1.5">
        {services.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-3 bg-black/40 border border-brand-900/20 rounded-xl group hover:border-brand-700/40 transition">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{s.name}</span>
                {s.category && <Badge tone="blue">{s.category}</Badge>}
                {s.taxable !== false && <span className="text-[9px] text-white/40">taxable</span>}
                {(s.checklistTemplate || []).length > 0 && <span className="inline-flex items-center gap-0.5 text-[9px] text-blue-400"><CheckSquare size={9} />{s.checklistTemplate.length} checklist item{s.checklistTemplate.length !== 1 ? "s" : ""}</span>}
              </div>
              {s.customerDescription && <div className="text-xs text-blue-300/60 mt-0.5 truncate">📋 {s.customerDescription}</div>}
              {!s.customerDescription && s.description && <div className="text-xs text-white/50 mt-0.5">{s.description}</div>}
              {s.internalNotes && <div className="text-xs text-yellow-400/50 mt-0.5 truncate">🔒 {s.internalNotes}</div>}
              {(s.minPrice || s.maxPrice) && <div className="text-[10px] text-white/30 mt-0.5">Range: {s.minPrice ? fmt(s.minPrice) : "?"} – {s.maxPrice ? fmt(s.maxPrice) : "?"}</div>}
            </div>
            <div className="text-brand-400 font-bold text-sm flex-shrink-0">{fmt(s.basePrice || s.price)}{s.unit && s.unit !== "flat" ? "/" + s.unit.replace("_", " ") : ""}</div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
              <button onClick={() => startEdit(s)} className="p-1.5 rounded hover:bg-white/10 text-white/50"><Edit size={12} /></button>
              <button onClick={() => del(s.id)} className="p-1.5 rounded hover:bg-danger-900/30 text-white/50 hover:text-danger-400"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
        {services.length === 0 && <div className="text-center py-6 text-xs text-white/40">No services yet — add your first one above</div>}
      </div>
    </div>
  );
}

