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
import { fmt, uid, today, daysFromNow, daysSince, filterByTimeframe, TIMEFRAMES, pipelineStages, priorityLevels, cancelReasons, recurringFreqs, equipmentList, jobTagOptions, expenseCats, personalities, normalizeAutomation, IRS_RATE, formatPhoneInput } from "../../lib/utils";
import type { Customer, Estimate, Job, Employee, Vehicle, MaintenanceRecord, Expense, Chemical, Service, Campaign, Automation, Review, SocialPost, AccountabilityEntry, Goal, Win, Reminder, RewardTier, Referral, MileageLog, PersonalTransaction, AppSettings, InboxThread, InboxMessage, AlfredConversation, AlfredMemory, AlfredMessage, Timeline, TimelineEntry, ModelStatus, LineItem, ChecklistItem, Photo, ChemicalUsed, CommLogEntry, AutomationStep, CustomField, CustomerAddress } from "../../types";
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
import { AddressAutocomplete } from "./AddressAutocomplete";

export function CustomerModal({ open, onClose, data, onSave, mapsKey = "", customers = [] }: { open?: any; onClose?: any; data?: any; onSave?: any; mapsKey?: string; customers?: any[] }) {
  const blank = { firstName: "", lastName: "", email: "", phone: "", address: "", notes: "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "", leadSource: "", tags: [], folder: "", sqFootage: "", propertyNotes: "", customFields: [], addresses: [] as CustomerAddress[] };
  const [addAddr, setAddAddr] = useState(false);
  const [addrForm, setAddrForm] = useState<CustomerAddress>({ id: "", label: "", street: "", city: "", state: "", zip: "", propertyType: "residential", sqFootage: undefined, notes: "" });
  const [f, setF] = useState(blank);
  const [customLeadSrc, setCustomLeadSrc] = useState("");

  const leadSources = ["Google", "Facebook", "Referral", "Nextdoor", "Website", "Instagram", "Yard Sign", "Angi", "Thumbtack", "Direct", "Other"];

  useEffect(() => {
    if (open) {
      const norm = data ? { ...blank, ...data } : blank;
      if (data?.leadSource && !leadSources.includes(data.leadSource)) {
        setF({ ...norm, leadSource: "Other" });
        setCustomLeadSrc(data.leadSource);
      } else {
        setF(norm);
        setCustomLeadSrc("");
      }
      setAddAddr(false);
      setAddrForm({ id: "", label: "", street: "", city: "", state: "", zip: "", propertyType: "residential", sqFootage: undefined, notes: "" });
    }
  }, [open, data]);
  const availTags = ["VIP", "Commercial", "Residential", "HOA", "Repeat", "Seasonal", "Warranty"];

  return (
    <Modal open={open} onClose={onClose} title={data ? "Edit Customer" : "New Customer"} maxW="max-w-xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-white/60 mb-1 block">First *</label><GInput value={f.firstName} onChange={e => setF({ ...f, firstName: e.target.value })} /></div>
          <div><label className="text-xs text-white/60 mb-1 block">Last *</label><GInput value={f.lastName} onChange={e => setF({ ...f, lastName: e.target.value })} /></div>
        </div>
        <div><label className="text-xs text-white/60 mb-1 block">Email</label><GInput type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Phone</label><GInput value={f.phone} onChange={e => setF({ ...f, phone: formatPhoneInput(e.target.value) })} placeholder="(555) 555-0100" /></div>
        <div><label className="text-xs text-white/60 mb-1 block">Address</label><AddressAutocomplete value={f.address || ""} onChange={v => setF({ ...f, address: v || "" })} onPlaceSelect={place => setF(p => ({ ...p, address: place.street || "", city: place.city || "", state: place.state || "", zip: place.zip || "" }))} mapsKey={mapsKey} placeholder="412 Oak Ridge Ln, your area" knownAddresses={customers.map((c: any) => c.address).filter(Boolean)} /></div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Lead Source</label>
            <GSel value={f.leadSource} onChange={e => { setF({ ...f, leadSource: e.target.value }); if (e.target.value !== "Other") setCustomLeadSrc(""); }} className="!text-xs">
              <option value="" className="bg-black">— Unknown —</option>
              {leadSources.map(s => <option key={s} value={s} className="bg-black">{s === "Other" && customLeadSrc ? `Other (${customLeadSrc})` : s}</option>)}
            </GSel>
            {f.leadSource === "Other" && (
              <GInput value={customLeadSrc} onChange={e => setCustomLeadSrc(e.target.value)} placeholder="Specify source (e.g. Door hanger, Craigslist…)" className="!text-xs mt-1.5" autoFocus />
            )}
            {f.leadSource === "Referral" && customers.length > 0 && (
              <GSel value={(f as any).referredBy || ""} onChange={e => setF({ ...(f as any), referredBy: e.target.value } as any)} className="!text-xs mt-1.5">
                <option value="" className="bg-black">Referred by…</option>
                {customers.filter((c: any) => c.id !== (f as any).id).map((c: any) => <option key={c.id} value={c.id} className="bg-black">{c.firstName} {c.lastName}</option>)}
              </GSel>
            )}
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Tags</label>
            <div className="flex gap-1 flex-wrap">
              {availTags.map(t => <button key={t} type="button" onClick={() => setF({ ...f, tags: (f.tags || []).includes(t) ? f.tags.filter(x => x !== t) : [...(f.tags || []), t] })} className={"text-[9px] px-1.5 py-0.5 rounded-full border transition " + ((f.tags || []).includes(t) ? "bg-brand-600/30 border-brand-500/50 text-brand-200" : "bg-white/5 border-white/10 text-white/50 hover:text-white")}>{t}</button>)}
            </div>
            {/* FEATURE (round 13, item 12) — see Settings → Testing Mode. */}
            <label className="flex items-center gap-1.5 mt-2 text-[10px] text-yellow-300/80 cursor-pointer">
              <input type="checkbox" checked={!!(f as any).isTestClient} onChange={e => setF({ ...(f as any), isTestClient: e.target.checked } as any)} className="accent-yellow-500" />
              🧪 Test Client — blocked from real sends when Testing Mode is on
            </label>
            {/* FEATURE — photo/video release opt-out, see LegalPages.tsx
                TermsPage's "Photos & Video" clause. Data flag only for now. */}
            <label className="flex items-center gap-1.5 mt-2 text-[10px] text-white/60 cursor-pointer">
              <input type="checkbox" checked={!!(f as any).mediaOptOut} onChange={e => setF({ ...(f as any), mediaOptOut: e.target.checked } as any)} className="accent-brand-600" />
              📵 Opt out of photo/video use for marketing
            </label>
            {/* FEATURE — per-customer Alfred auto-response, off by default.
                Only meaningful once text-Alfred is set up at all (Settings →
                AI Models); the label spells out exactly what it allows so
                it's never an accidental blanket "let AI text my customers"
                toggle — routine Q&A only, reschedule requests still come to
                the owner for a yes/no. */}
            <label className="flex items-center gap-1.5 mt-2 text-[10px] text-purple-300/80 cursor-pointer">
              <input type="checkbox" checked={!!(f as any).alfredAutoRespond} onChange={e => setF({ ...(f as any), alfredAutoRespond: e.target.checked } as any)} className="accent-purple-500" />
              🤖 Let Alfred answer this customer's texts (pricing/appointment questions directly; reschedule requests still ask you first)
            </label>
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Folder</label>
            <GInput
              value={(f as any).folder || ""}
              onChange={e => setF({ ...(f as any), folder: e.target.value } as any)}
              placeholder="e.g. VIP, Commercial, Referral Partners…"
              list="customer-folder-options"
              className="!text-xs"
            />
            <datalist id="customer-folder-options">
              {Array.from(new Set(customers.map((c: any) => c.folder).filter(Boolean))).map((folder: any) => <option key={folder} value={folder} />)}
            </datalist>
          </div>
        </div>

        <div className="pt-3 border-t border-brand-900/20">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2 flex items-center gap-1">🏠 Property Notes</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-white/60 mb-1 block">Gate Code</label><GInput value={f.gateCode} onChange={e => setF({ ...f, gateCode: e.target.value })} placeholder="1234" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Sq Footage (est.)</label><GInput type="number" value={f.sqFootage || ""} onChange={e => setF({ ...f, sqFootage: e.target.value })} placeholder="2400" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label className="text-xs text-white/60 mb-1 block">Dog on property?</label>
              <div className="flex gap-2">
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={f.hasDog} onChange={e => setF({ ...f, hasDog: e.target.checked })} className="w-4 h-4 accent-brand-600" />Yes</label>
                {f.hasDog && <GInput value={f.dogName} onChange={e => setF({ ...f, dogName: e.target.value })} placeholder="Dog name" className="!py-1.5 !text-sm flex-1" />}
              </div>
            </div>
            <div><label className="text-xs text-white/60 mb-1 block">Sensitive plants</label><GInput value={f.sensitivePlants} onChange={e => setF({ ...f, sensitivePlants: e.target.value })} placeholder="Hydrangeas front porch..." /></div>
          </div>
          <div className="mt-3"><label className="text-xs text-white/60 mb-1 block">Property notes</label><GTxt rows={2} value={f.propertyNotes || ""} onChange={e => setF({ ...f, propertyNotes: e.target.value })} placeholder="Parking, access notes, special instructions..." /></div>
        </div>

        {/* Additional Addresses */}
        <div className="pt-3 border-t border-brand-900/20">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-white/60 uppercase tracking-wider flex items-center gap-1">📍 Additional Addresses ({(f.addresses || []).length})</div>
            <button type="button" onClick={() => { setAddAddr(!addAddr); setAddrForm({ id: uid(), label: "", street: "", city: "", state: "", zip: "", propertyType: "residential", sqFootage: undefined, notes: "" }); }} className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 transition">
              <Plus size={12} />{addAddr ? "Cancel" : "Add Address"}
            </button>
          </div>
          {(f.addresses || []).map((addr: CustomerAddress) => (
            <div key={addr.id} className="flex items-start justify-between p-2.5 mb-1.5 bg-black/30 border border-white/10 rounded-xl text-xs">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white/80">{addr.label || addr.street}</div>
                <div className="text-white/50 truncate">{[addr.city, addr.state, addr.zip].filter(Boolean).join(", ")}</div>
                {addr.propertyType && <div className="text-white/30 mt-0.5 capitalize">{addr.propertyType}{addr.sqFootage ? ` · ${addr.sqFootage.toLocaleString()} sqft` : ""}</div>}
              </div>
              <button type="button" onClick={() => setF(p => ({ ...p, addresses: (p.addresses || []).filter((a: CustomerAddress) => a.id !== addr.id) }))} className="p-1 text-white/30 hover:text-brand-400 flex-shrink-0 ml-2"><X size={11} /></button>
            </div>
          ))}
          {addAddr && (
            <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-white/50 mb-0.5 block">Label (e.g. "Shop")</label><GInput value={addrForm.label || ""} onChange={e => setAddrForm(p => ({ ...p, label: e.target.value }))} placeholder="Optional label" className="!text-xs" /></div>
                <div><label className="text-[10px] text-white/50 mb-0.5 block">Property Type</label>
                  <GSel value={addrForm.propertyType || "residential"} onChange={e => setAddrForm(p => ({ ...p, propertyType: e.target.value as any }))} className="!text-xs">
                    <option value="residential" className="bg-black">Residential</option>
                    <option value="commercial" className="bg-black">Commercial</option>
                  </GSel>
                </div>
              </div>
              <div><label className="text-[10px] text-white/50 mb-0.5 block">Street *</label><AddressAutocomplete value={addrForm.street || ""} onChange={v => setAddrForm(p => ({ ...p, street: v || "" }))} onPlaceSelect={place => setAddrForm(p => ({ ...p, street: place.street || "", city: place.city || "", state: place.state || "", zip: place.zip || "" }))} mapsKey={mapsKey} placeholder="456 Pine St" knownAddresses={customers.map((c: any) => c.address).filter(Boolean)} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[10px] text-white/50 mb-0.5 block">City</label><GInput value={addrForm.city || ""} onChange={e => setAddrForm(p => ({ ...p, city: e.target.value }))} className="!text-xs" /></div>
                <div><label className="text-[10px] text-white/50 mb-0.5 block">State</label><GInput value={addrForm.state || ""} onChange={e => setAddrForm(p => ({ ...p, state: e.target.value }))} className="!text-xs" /></div>
                <div><label className="text-[10px] text-white/50 mb-0.5 block">Zip</label><GInput value={addrForm.zip || ""} onChange={e => setAddrForm(p => ({ ...p, zip: e.target.value }))} className="!text-xs" /></div>
              </div>
              <div><label className="text-[10px] text-white/50 mb-0.5 block">Sq Footage</label><GInput type="number" value={addrForm.sqFootage || ""} onChange={e => setAddrForm(p => ({ ...p, sqFootage: e.target.value ? Number(e.target.value) : undefined }))} placeholder="2400" className="!text-xs" /></div>
              <div><label className="text-[10px] text-white/50 mb-0.5 block">Notes</label><GInput value={addrForm.notes || ""} onChange={e => setAddrForm(p => ({ ...p, notes: e.target.value }))} placeholder="Gate code, access notes…" className="!text-xs" /></div>
              <GBtn disabled={!(addrForm.street || "").trim()} onClick={() => { setF(p => ({ ...p, addresses: [...(p.addresses || []), { ...addrForm, id: addrForm.id || uid() }] })); setAddAddr(false); }} className="!text-xs !py-1.5 w-full">Save Address</GBtn>
            </div>
          )}
        </div>

        <div><label className="text-xs text-white/60 mb-1 block">Notes</label><GTxt rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></div>

        {/* Custom Fields */}
        {(f.customFields || []).length > 0 && <div className="space-y-2">
          <div className="text-xs text-white/50 uppercase tracking-wider">Custom Fields</div>
          {(f.customFields || []).map((cf, i) => (
            <div key={i} className="flex gap-2 items-center">
              <GInput value={cf.key} onChange={e => setF(p => ({ ...p, customFields: p.customFields.map((x, j) => j === i ? { ...x, key: e.target.value } : x) }))} placeholder="Field name" className="w-36 !text-xs" />
              <GInput value={cf.value} onChange={e => setF(p => ({ ...p, customFields: p.customFields.map((x, j) => j === i ? { ...x, value: e.target.value } : x) }))} placeholder="Value" className="flex-1 !text-xs" />
              <button onClick={() => setF(p => ({ ...p, customFields: p.customFields.filter((_, j) => j !== i) }))} className="p-1.5 text-white/40 hover:text-brand-400"><X size={12} /></button>
            </div>
          ))}
        </div>}
        <button onClick={() => setF(p => ({ ...p, customFields: [...(p.customFields || []), { key: "", value: "" }] }))} className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 transition">
          <Plus size={12} /> Add custom field
        </button>

        <div className="flex gap-2 justify-end pt-3">
          <GBtn variant="ghost" onClick={onClose}>Cancel</GBtn>
          <GBtn onClick={() => {
            if (!f.firstName || !f.lastName) return;
            const leadSrc = f.leadSource === "Other" ? (customLeadSrc.trim() || "Other") : f.leadSource;
            onSave(data ? { ...data, ...f, leadSource: leadSrc } : { ...f, leadSource: leadSrc });
          }}>{data ? "Save" : "Create"}</GBtn>
        </div>
      </div>
    </Modal>
  );
}

// ===== DOCUMENT VAULT =====
