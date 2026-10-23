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

const checkCondition = (check: string, ctx: any) => true;

export function VisualWorkflowBuilder({ open, data, onClose, onSave, settings }: { open: boolean; data: any; onClose: () => void; onSave: (d: any) => void; settings?: any }) {
  const [w, setW] = useState({ id: "", name: "", category: "other", icon: "📋", description: "", steps: [] });
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [showNodePicker, setShowNodePicker] = useState(null);
  const [testRunning, setTestRunning] = useState(false);
  const [testLog, setTestLog] = useState([]);
  const [aiDrafting, setAiDrafting] = useState(false);

  useEffect(() => {
    if (open && data) {
      setW({ id: data.id, name: data.name || "Untitled Workflow", category: data.category || "other", icon: data.icon || "📋", description: data.description || "", steps: data.steps?.length ? data.steps : [{ id: uid(), type: "trigger", label: "Choose a trigger…" }] });
      setSelectedIdx(0);
      setShowNodePicker(null);
      setTestLog([]);
    }
  }, [open, data]);

  const updateStep = (idx, patch) => setW(prev => ({ ...prev, steps: prev.steps.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  const insertStep = (afterIdx, type) => {
    const defaults = {
      trigger: { label: "Choose a trigger…" },
      condition: { label: "Check condition", check: "estimate_pending" },
      delay: { label: "Wait 1 day", duration: 1, unit: "day" },
      action: { label: "Send message", channel: "sms", messageBody: "Hi {{first_name}}, " },
      branch: { label: "If 5 stars → Google, else → feedback", branches: ["5 stars", "≤4 stars"] }
    };
    const newStep = { id: uid(), type, ...defaults[type] };
    const next = [...w.steps];
    next.splice(afterIdx + 1, 0, newStep);
    setW(prev => ({ ...prev, steps: next }));
    setSelectedIdx(afterIdx + 1);
    setShowNodePicker(null);
  };
  const deleteStep = idx => {
    if (w.steps.length <= 1) return;
    setW(prev => ({ ...prev, steps: prev.steps.filter((_, i) => i !== idx) }));
    setSelectedIdx(Math.max(0, idx - 1));
  };
  const moveStep = (idx, dir) => {
    const ni = idx + dir;
    if (ni < 0 || ni >= w.steps.length) return;
    const next = [...w.steps];
    [next[idx], next[ni]] = [next[ni], next[idx]];
    setW(prev => ({ ...prev, steps: next }));
    setSelectedIdx(ni);
  };
  const duplicateStep = idx => {
    const copy = { ...w.steps[idx], id: uid() };
    const next = [...w.steps];
    next.splice(idx + 1, 0, copy);
    setW(prev => ({ ...prev, steps: next }));
    setSelectedIdx(idx + 1);
  };

  // AI draft message for action step.
  // BUG FIX (audit) — this used to fetch api.anthropic.com DIRECTLY from the
  // browser with NO x-api-key header at all and no key sourced from
  // anywhere — every call 401'd, silently caught, and fell back to the
  // generic templated message every single time for every owner. The
  // button looked and felt like a working "AI Draft" feature but never
  // actually drafted anything. Routed through the app's own callModel
  // (lib/api.ts) — the same unified caller Alfred uses — with the owner's
  // configured model/key from Settings → AI Models, so it uses whichever
  // provider they've actually set up (Claude, Gemini, OpenRouter, etc.),
  // not a hardcoded Anthropic-only call. Same generic-template fallback on
  // any failure (no key configured, network error, etc.) as before.
  const draftMessage = async (idx, step) => {
    setAiDrafting(true);
    const channel = step.channel || "sms";
    const triggerStep = w.steps[0];
    const context = triggerStep?.label || "job completed";
    const companyName = settings?.companyName || "CRM Starter";
    const ownerName = settings?.ownerName || settings?.myEmail || "the owner";
    try {
      const modelId = settings?.activeModel || "claude";
      const apiKey = settings?.modelKeys?.[modelId] || "";
      const result = await callModel({
        modelId, apiKey,
        messages: [{ role: "user", content: `Write a short, professional ${channel === "sms" ? "SMS text message" : "email"} for a service business (${companyName}, owner ${ownerName}). Context: "${context}". Action: "${step.label}". Use {{first_name}} for customer name. ${channel === "sms" ? "Keep under 160 chars." : "Keep under 3 sentences."} No quotes around the whole message. Start with "Hi {{first_name}},"` }],
        maxTokens: 200,
      });
      const msg = result.text?.trim();
      if (msg) updateStep(idx, { messageBody: msg });
      else throw new Error("Model returned no text");
    } catch { updateStep(idx, { messageBody: "Hi {{first_name}}, " + (step.label || "following up from " + companyName) + ". — " + ownerName + " @ " + companyName }); }
    setAiDrafting(false);
  };

  // Test run the workflow with sample data
  const runTest = async () => {
    setTestRunning(true);
    setTestLog([{ ts: Date.now(), message: "🚀 Starting test run…", status: "running" }]);
    const sampleCtx = { type: "manual", job: { id: "test", amount: 742, scheduledDate: today(), status: "completed", address: "412 Oak Ridge Ln, your area" }, customer: { id: "test", firstName: "Jennifer", lastName: "Walsh", email: "jennifer@example.com", phone: "+15555550201" }, estimate: { total: 742, status: "pending" }, daysSinceInvoiced: 8, daysSinceLast: 200, rating: 5, isNegative: false };
    const logs = [];
    for (const step of w.steps) {
      await new Promise(r => setTimeout(r, 300));
      if (step.type === "trigger") {
        logs.push({ ts: Date.now(), message: "▶ TRIGGER: " + step.label, status: "ok" });
      } else if (step.type === "delay") {
        logs.push({ ts: Date.now(), message: "⏳ DELAY: " + step.label + " (skipped in test)", status: "skipped" });
      } else if (step.type === "condition") {
        const pass = checkCondition(step.check, sampleCtx);
        logs.push({ ts: Date.now(), message: (pass ? "✅" : "⛔") + " CONDITION: " + step.label + " → " + (pass ? "PASS" : "FAIL"), status: pass ? "ok" : "skipped" });
      } else if (step.type === "action") {
        const ch = step.channel || "sms";
        const body = (step.messageBody || step.label || "").replace(/{{first_name}}/g, "Jennifer").replace(/{{amount}}/g, "$742").replace(/{{date}}/g, today()).replace(/{{address}}/g, "412 Oak Ridge Ln");
        const icon = { sms: "💬", email: "📧", task: "✅", webhook: "🔗", calendar: "📅", internal: "🔔" }[ch] || "⚡";
        logs.push({ ts: Date.now(), message: icon + " ACTION [" + ch.toUpperCase() + "]: " + body.slice(0, 80) + (body.length > 80 ? "…" : ""), status: "sent" });
      }
      setTestLog([...logs]);
    }
    logs.push({ ts: Date.now(), message: "✅ Test complete — " + w.steps.length + " steps executed", status: "done" });
    setTestLog([...logs]);
    setTestRunning(false);
  };

  const MERGE_TAGS = ["{{first_name}}", "{{last_name}}", "{{amount}}", "{{date}}", "{{address}}", "{{review_link}}", "{{payment_link}}", "{{referral_link}}", "{{company_phone}}", "{{customer_name}}", "{{job_address}}", "{{total_spent}}"];

  const NODE_STYLES = {
    trigger:   { bg: "bg-blue-600",    border: "border-blue-500",    glow: "rgba(59,130,246,0.4)",  icon: "▶",  label: "TRIGGER",   ring: "ring-blue-500" },
    condition: { bg: "bg-amber-600",   border: "border-amber-500",   glow: "rgba(245,158,11,0.4)",  icon: "⬡",  label: "IF",        ring: "ring-amber-500" },
    delay:     { bg: "bg-violet-600",  border: "border-violet-500",  glow: "rgba(139,92,246,0.4)",  icon: "⏳", label: "WAIT",      ring: "ring-violet-500" },
    action:    { bg: "bg-emerald-600", border: "border-emerald-500", glow: "rgba(16,185,129,0.4)",  icon: "⚡", label: "ACTION",    ring: "ring-emerald-500" },
    branch:    { bg: "bg-brand-600",    border: "border-brand-500",    glow: "rgba(244,63,94,0.4)",   icon: "⑂",  label: "BRANCH",    ring: "ring-brand-500" },
  };

  // Every item below is exact-matched against useAutomationEngine.ts's
  // classifyTrigger() regexes and backed by a non-empty getCandidates() spec
  // there — the 🤝 Referrals and 📊 Owner/Team Reports groups are new
  // additions that plug engine categories (referral_ask/referral_reward/
  // referral_booked/owner_periodic_summary/employee_performance_report) which
  // already fire correctly but had no way to be picked when building a
  // workflow from scratch (they were only reachable via the template
  // gallery). owner_daily_summary/employee_shift_summary are deliberately
  // NOT offered here — both intentionally return zero candidates in the
  // engine because App.tsx/EmployeePortal.tsx already send that exact recap
  // directly, so exposing them as pickable triggers would look like a
  // working automation that in fact can never fire.
  const TRIGGER_PRESETS = [
    { group: "🔨 Jobs", items: ["Job scheduled", "24h before scheduled job", "Job day morning", "Crew starts job", "Job complete", "Job complete + 2h", "Job complete + 48h", "Job cancelled", "Recurring service due"] },
    { group: "📋 Estimates", items: ["Estimate sent", "Estimate viewed", "Estimate accepted", "Quote unviewed 24h", "Quote unviewed 5 days", "Estimate expires in 3 days", "Estimate signed", "Estimate declined", "Estimate expired"] },
    { group: "💸 Payments", items: ["Payment received", "Invoice unpaid 3 days", "Invoice unpaid 7 days", "Invoice unpaid 14 days", "Invoice overdue"] },
    { group: "👤 Customers", items: ["New customer added", "New inquiry submitted", "6 months since last wash", "Customer birthday", "1 year anniversary", "Re-engagement (inactive 90d)", "First job completed", "VIP customer milestone"] },
    { group: "⭐ Reviews", items: ["Post-job review request", "Review submitted (5 star)", "Negative review (≤3 stars)"] },
    { group: "🤝 Referrals", items: ["3rd job complete", "Referral reward earned", "Referral booked"] },
    { group: "📊 Owner/Team Reports", items: ["Quarterly business summary", "Weekly performance report", "Reschedule requested", "Unassigned job tomorrow"] },
    { group: "📅 Scheduled", items: ["March 1st annually", "October 1st annually", "Manual trigger", "Every Monday 8am"] },
  ];

  const ACTION_CONFIGS = {
    sms: {
      presets: ["Thank you for choosing CRM Starter!", "Reminder: service tomorrow at {{date}}", "We're on our way! ETA 15 min", "Review request: {{review_link}}", "Invoice due: {{portal_link}}", "Promo: 15% off this month"],
      subject: false
    },
    email: {
      presets: ["Welcome to CRM Starter — here's what to expect", "Your estimate is ready", "Service complete — how'd we do?", "Invoice ready for review", "Seasonal maintenance reminder", "Thank you for your business"],
      subject: true
    },
    task: {
      presets: ["Call customer to follow up", "Leave door hanger at property", "Send handwritten thank-you", "Schedule follow-up estimate", "Review negative feedback", "Flag for VIP upgrade"],
      subject: false
    },
    internal: {
      presets: ["Log contact to timeline", "Add note to customer record", "Notify the office", "Create CRM task", "Flag as high priority"],
      subject: false
    },
    webhook: { presets: [], subject: false },
    calendar: { presets: ["Create reminder event", "Block follow-up time", "Add to content calendar"], subject: false }
  };

  const CONDITION_OPTIONS = [
    { k: "estimate_pending", l: "Estimate is still pending" },
    { k: "estimate_accepted", l: "Estimate was accepted" },
    { k: "estimate_unsigned", l: "Estimate not yet signed" },
    { k: "invoice_unpaid", l: "Invoice is unpaid" },
    { k: "invoice_paid", l: "Invoice has been paid" },
    { k: "job_completed", l: "Job has been completed" },
    { k: "quote_not_viewed", l: "Quote hasn't been opened" },
    { k: "rated_5", l: "Customer rated 5 stars" },
    { k: "rated_low", l: "Customer rated ≤3 stars" },
    { k: "stale_customer", l: "No service in 180+ days" },
    { k: "no_response_24h", l: "No response in 24 hours" },
    { k: "no_new_job", l: "No new job booked" },
    { k: "no_recent_job", l: "No job in 30 days" },
    { k: "zero_referrals", l: "Customer has 0 referrals" },
    { k: "has_dog", l: "Property has dog on file" },
    { k: "customer_is_vip", l: "Customer is a VIP (lifetime spend)" },
    { k: "customer_opted_in_sms", l: "Customer hasn't opted out of texts" },
    { k: "job_cancelled", l: "Job was cancelled" },
  ];

  const selected = selectedIdx !== null ? w.steps[selectedIdx] : null;
  const ns = selected ? (NODE_STYLES[selected.type] || NODE_STYLES.action) : null;

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="" maxW="max-w-[96vw]">
      <div className="-mx-5 -mt-5 -mb-5 flex flex-col" style={{ height: "min(90vh, 880px)" }}>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-900/30 bg-black/80 backdrop-blur flex-shrink-0">
          <button onClick={() => { const icons = ["⚡","🔔","📬","🤖","🔨","💰","⭐","🎯","🌸","❄️"]; setW(p => ({ ...p, icon: icons[Math.floor(Math.random()*icons.length)] })); }} className="text-2xl hover:scale-110 transition cursor-pointer" title="Click to change">{w.icon}</button>
          <input value={w.name} onChange={e => setW({ ...w, name: e.target.value })} placeholder="Workflow name…" className="flex-1 bg-transparent font-bold text-base focus:outline-none border-b border-transparent focus:border-brand-500/50 pb-0.5 transition-colors" />
          <div className="hidden md:flex items-center gap-2 text-[10px] text-white/40">
            <span className="px-2 py-1 bg-white/5 rounded">{w.steps.length} steps</span>
            <span className="px-2 py-1 bg-white/5 rounded capitalize">{w.category}</span>
          </div>
          <GBtn variant="ghost" onClick={runTest} disabled={testRunning} className="!text-xs !py-1.5 !border-green-700/40 !text-green-300 hover:!bg-green-900/20">
            {testRunning ? <><div className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin inline-block mr-1.5" />Testing…</> : <><Play size={11} className="inline mr-1" />Test Run</>}
          </GBtn>
          <GBtn variant="ghost" onClick={onClose} className="!py-1.5 !text-xs">Cancel</GBtn>
          <GBtn onClick={() => { if (!w.name.trim()) return; onSave(w); }} disabled={!w.name.trim()} className="!py-1.5 !text-sm"><Save size={13} className="inline mr-1.5" />Save</GBtn>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* ── Canvas ── */}
          <div className="flex-1 overflow-auto bg-[#080808] relative" style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
            <div className="flex flex-col items-center py-8 px-4 gap-0 min-w-[320px]">
              {/* START */}
              <div className="flex flex-col items-center">
                <div className="px-5 py-2 rounded-full bg-black border border-white/10 text-[10px] text-white/30 font-mono uppercase tracking-widest">WORKFLOW START</div>
                <div className="w-px h-5 bg-gradient-to-b from-white/20 to-white/5" />
              </div>

              {w.steps.map((step, idx) => {
                const style = NODE_STYLES[step.type] || NODE_STYLES.action;
                const isSel = selectedIdx === idx;
                const isFirst = idx === 0;
                const isLast = idx === w.steps.length - 1;
                const showPicker = showNodePicker === idx;
                const hasMsg = step.messageBody?.length > 0;

                return (
                  <div key={step.id} className="flex flex-col items-center w-full max-w-[380px]">
                    {/* Node card */}
                    <div
                      onClick={() => setSelectedIdx(isSel ? null : idx)}
                      className={"w-full rounded-2xl border-2 cursor-pointer transition-all duration-200 shadow-lg " + (isSel ? style.border + " ring-2 " + style.ring + "/30" : "border-white/10 hover:border-white/25")}
                      style={isSel ? { boxShadow: "0 0 30px " + style.glow + ", 0 4px 20px rgba(0,0,0,0.6)" } : { boxShadow: "0 2px 12px rgba(0,0,0,0.5)" }}
                    >
                      {/* Header bar */}
                      <div className={"px-4 py-2.5 flex items-center gap-2.5 rounded-t-xl " + style.bg}>
                        <span className="text-base leading-none font-bold">{style.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-white/90 flex-1">{style.label}</span>
                        <span className="text-[9px] text-white/50 bg-black/20 rounded px-1.5 py-0.5">#{idx + 1}</span>
                        <div className="flex items-center gap-0.5">
                          {!isFirst && <button onClick={e => { e.stopPropagation(); moveStep(idx, -1); }} className="p-1 rounded hover:bg-white/20 text-white/70 text-xs w-5 h-5 flex items-center justify-center">↑</button>}
                          {!isLast && <button onClick={e => { e.stopPropagation(); moveStep(idx, 1); }} className="p-1 rounded hover:bg-white/20 text-white/70 text-xs w-5 h-5 flex items-center justify-center">↓</button>}
                          <button onClick={e => { e.stopPropagation(); duplicateStep(idx); }} className="p-1 rounded hover:bg-white/20 text-white/70 text-xs w-5 h-5 flex items-center justify-center" title="Duplicate">⧉</button>
                          <button onClick={e => { e.stopPropagation(); deleteStep(idx); }} disabled={w.steps.length <= 1} className="p-1 rounded hover:bg-danger-500/50 text-white/70 text-xs w-5 h-5 flex items-center justify-center disabled:opacity-20">✕</button>
                        </div>
                      </div>
                      {/* Body */}
                      <div className="px-4 py-3 bg-[#101010] rounded-b-xl">
                        <div className={"font-semibold text-sm leading-snug " + (step.label?.startsWith("Choose") || step.label?.startsWith("Click") ? "text-white/25 italic" : "text-white")}>{step.label || "Configure in panel →"}</div>
                        {hasMsg && <div className="mt-1.5 text-[11px] text-white/50 italic truncate">"{step.messageBody}"</div>}
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          {step.type === "delay" && step.duration && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-900/40 border border-violet-700/40 text-violet-300 font-mono">⏳ {step.duration}{step.unit?.charAt(0)}</span>}
                          {step.channel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 border border-white/10 text-white/60">{{ email:"📧", sms:"💬", task:"✅", webhook:"🔗", calendar:"📅", internal:"🔔" }[step.channel] || step.channel}</span>}
                          {step.check && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 border border-amber-700/30 text-amber-300">{CONDITION_OPTIONS.find(c=>c.k===step.check)?.l || step.check}</span>}
                          {step.subject && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-900/30 border border-blue-700/30 text-blue-300 truncate max-w-[140px]">Subj: {step.subject}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Connector + add button */}
                    <div className="flex flex-col items-center">
                      <div className="w-px h-4 bg-gradient-to-b from-white/15 to-white/5" />
                      {showPicker ? (
                        <div className="bg-[#0e0e0e] border border-white/15 rounded-2xl p-3 shadow-2xl z-10 w-64 backdrop-blur">
                          <div className="text-[9px] text-white/30 uppercase tracking-wider mb-2 text-center">Insert step after #{idx+1}</div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {Object.entries(NODE_STYLES).filter(([k]) => k !== "trigger" || w.steps.length === 0).map(([k, s]) => (
                              <button key={k} onClick={() => insertStep(idx, k)} title={k} className={"flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all hover:scale-110 active:scale-95 " + s.bg + " border-white/20"}>
                                <span className="text-lg leading-none">{s.icon}</span>
                                <span className="text-[8px] text-white/80 font-bold uppercase leading-none">{s.label}</span>
                              </button>
                            ))}
                          </div>
                          <button onClick={() => setShowNodePicker(null)} className="mt-2 w-full text-[10px] text-white/30 hover:text-white/60 text-center py-1">✕ Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setShowNodePicker(showNodePicker === idx ? null : idx)} className="w-6 h-6 rounded-full border border-dashed border-white/20 hover:border-white/50 hover:bg-white/5 flex items-center justify-center text-white/30 hover:text-white transition-all text-sm leading-none">+</button>
                      )}
                      {!isLast && <div className="w-px h-4 bg-gradient-to-b from-white/5 to-white/15" />}
                    </div>
                  </div>
                );
              })}

              {/* END */}
              <div className="flex flex-col items-center mt-1">
                <div className="w-px h-4 bg-gradient-to-b from-white/15 to-transparent" />
                <div className="px-5 py-2 rounded-full bg-black border border-white/8 text-[10px] text-white/20 font-mono uppercase tracking-widest">WORKFLOW END</div>
              </div>
            </div>
          </div>

          {/* ── Config Panel ── */}
          <div className="w-80 flex-shrink-0 border-l border-brand-900/25 bg-[#0c0c0c] flex flex-col overflow-hidden">
            {selected ? (
              <div className="flex-1 overflow-y-auto">
                {/* Panel header */}
                <div className={"px-4 py-3 flex items-center gap-2 flex-shrink-0 " + ns.bg}>
                  <span className="text-lg">{ns.icon}</span>
                  <span className="text-xs font-black uppercase tracking-widest flex-1">{ns.label} · Step {(selectedIdx||0)+1}</span>
                  <button onClick={() => deleteStep(selectedIdx)} className="text-white/60 hover:text-white p-1 rounded hover:bg-black/20"><Trash2 size={12} /></button>
                </div>

                <div className="p-4 space-y-4">

                  {/* ── TRIGGER panel ── */}
                  {selected.type === "trigger" && <>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-2 block">When this happens…</label>
                      <GInput value={selected.label} onChange={e => updateStep(selectedIdx, { label: e.target.value })} placeholder="Custom trigger description" className="!text-xs mb-3" />
                      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                        {TRIGGER_PRESETS.map(group => (
                          <div key={group.group}>
                            <div className="text-[9px] text-blue-400 uppercase tracking-widest mb-1.5 font-black">{group.group}</div>
                            <div className="space-y-0.5">
                              {group.items.map(item => (
                                <button key={item} onClick={() => updateStep(selectedIdx, { label: item })} className={"w-full text-left text-[11px] px-2.5 py-2 rounded-lg transition " + (selected.label === item ? "bg-blue-600/25 border border-blue-500/40 text-blue-200" : "hover:bg-white/5 text-white/55 hover:text-white border border-transparent")}>
                                  {selected.label === item ? "✓ " : ""}{item}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>}

                  {/* ── ACTION panel ── */}
                  {selected.type === "action" && <>
                    {/* Channel selector */}
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-2 block">Send via</label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[{v:"sms",l:"💬 SMS",t:"Text the customer"},{v:"email",l:"📧 Email",t:"Email the customer"},{v:"task",l:"✅ Task",t:"Emails the task to your own inbox — the customer never sees it"},{v:"webhook",l:"🔗 Webhook",t:"POSTs JSON to a URL you provide (Zapier, Make, n8n…)"},{v:"calendar",l:"📅 Calendar",t:"Emails a calendar reminder to your own inbox"},{v:"internal",l:"🔔 Internal",t:"Emails an internal note to your own inbox"}].map(o => (
                          <button key={o.v} title={o.t} onClick={() => updateStep(selectedIdx, { channel: o.v })} className={"text-[10px] py-2 rounded-xl border transition text-center font-medium " + (selected.channel === o.v ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-200 shadow-sm" : "bg-black/40 border-white/8 text-white/45 hover:text-white hover:border-white/20")}>{o.l}</button>
                        ))}
                      </div>
                      {["task", "internal", "calendar"].includes(selected.channel) && (
                        <div className="text-[10px] text-white/40 mt-2 bg-blue-950/20 border border-blue-900/30 rounded-xl p-2.5">🔔 This goes to <strong>your own inbox</strong>, not the customer's — use it for reminders to yourself or the crew.</div>
                      )}
                    </div>

                    {/* Action name / description */}
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">Action name</label>
                      <GInput value={selected.label || ""} onChange={e => updateStep(selectedIdx, { label: e.target.value })} placeholder="e.g. Send job confirmation SMS" className="!text-xs" />
                    </div>

                    {/* Message body — for SMS, email, internal */}
                    {["sms", "email", "internal", "task"].includes(selected.channel || "sms") && <>
                      {selected.channel === "email" && <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">Email Subject</label>
                        <GInput value={selected.subject || ""} onChange={e => updateStep(selectedIdx, { subject: e.target.value })} placeholder="Your service confirmation from CRM Starter" className="!text-xs" />
                      </div>}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] text-white/50 uppercase tracking-wider">Message Body</label>
                          <button onClick={() => draftMessage(selectedIdx, selected)} disabled={aiDrafting} className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-900/20 border border-purple-700/30 hover:bg-purple-900/40 transition">
                            {aiDrafting ? <><div className="w-2.5 h-2.5 border border-purple-400 border-t-transparent rounded-full animate-spin" />Drafting…</> : <><Zap size={9} />AI Draft</>}
                          </button>
                        </div>
                        <GTxt rows={5} value={selected.messageBody || ""} onChange={e => updateStep(selectedIdx, { messageBody: e.target.value })} placeholder={"Hi {{first_name}}, " + (selected.channel === "sms" ? "your service is confirmed for {{date}}. — CRM Starter" : "thank you for choosing CRM Starter…")} className="!text-xs font-mono" />
                        {selected.channel === "sms" && selected.messageBody && <div className={"text-[10px] mt-1 " + (selected.messageBody.length > 160 ? "text-yellow-400" : "text-white/30")}>{selected.messageBody.length}/160 chars{selected.messageBody.length > 160 ? " · " + Math.ceil(selected.messageBody.length/160) + " segments" : ""}</div>}
                        {/* Merge tag buttons */}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {MERGE_TAGS.map(tag => <button key={tag} onClick={() => updateStep(selectedIdx, { messageBody: (selected.messageBody || "") + tag })} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition font-mono">{tag}</button>)}
                        </div>
                        {/* Preset messages */}
                        {ACTION_CONFIGS[selected.channel || "sms"]?.presets.length > 0 && <div className="mt-3">
                          <div className="text-[9px] text-white/30 uppercase tracking-wider mb-1.5">Quick presets</div>
                          <div className="space-y-0.5 max-h-32 overflow-y-auto">
                            {ACTION_CONFIGS[selected.channel || "sms"].presets.map(p => <button key={p} onClick={() => updateStep(selectedIdx, { label: p, messageBody: "Hi {{first_name}}, " + p + " — CRM Starter" })} className="w-full text-left text-[10px] px-2 py-1.5 rounded-lg hover:bg-white/5 text-white/45 hover:text-white transition">{p}</button>)}
                          </div>
                        </div>}
                      </div>
                    </>}

                    {/* Webhook URL */}
                    {selected.channel === "webhook" && <>
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">Webhook URL</label>
                        <GInput value={selected.url || ""} onChange={e => updateStep(selectedIdx, { url: e.target.value })} placeholder="https://hooks.zapier.com/…" className="!text-xs font-mono" />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">Payload (JSON)</label>
                        <GTxt rows={4} value={selected.payload || '{\n  "event": "{{trigger}}",\n  "customer": "{{first_name}} {{last_name}}",\n  "amount": "{{amount}}"\n}'} onChange={e => updateStep(selectedIdx, { payload: e.target.value })} className="!text-xs font-mono" />
                      </div>
                    </>}
                  </>}

                  {/* ── DELAY panel ── */}
                  {selected.type === "delay" && <>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-2 block">Wait duration</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-white/40 mb-1 block">Amount</label>
                          <GInput type="number" min="1" max="365" value={selected.duration || 1} onChange={e => { const v = Number(e.target.value); updateStep(selectedIdx, { duration: v, label: "Wait " + v + " " + (selected.unit||"day") + (v !== 1 ? "s" : "") }); }} className="!text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-white/40 mb-1 block">Unit</label>
                          <GSel value={selected.unit || "day"} onChange={e => updateStep(selectedIdx, { unit: e.target.value, label: "Wait " + (selected.duration||1) + " " + e.target.value + ((selected.duration||1) !== 1 ? "s" : "") })} className="!text-xs">
                            {["minute","hour","day","week","month"].map(u => <option key={u} value={u} className="bg-black">{u}</option>)}
                          </GSel>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-2 block">Quick picks</label>
                      <div className="grid grid-cols-3 gap-1">
                        {[["1h","1 hour",1,"hour"],["24h","24h",24,"hour"],["2d","2 days",2,"day"],["7d","1 week",7,"day"],["30d","30 days",30,"day"],["90d","90 days",90,"day"]].map(([label, full, dur, unit]) => (
                          <button key={label} onClick={() => updateStep(selectedIdx, { duration: dur, unit, label: "Wait " + full })} className={"text-[10px] py-1.5 rounded-lg border transition " + (selected.duration === dur && selected.unit === unit ? "bg-violet-600/30 border-violet-500/50 text-violet-200" : "bg-black/40 border-white/8 text-white/45 hover:text-white hover:border-white/20")}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </>}

                  {/* ── CONDITION panel ── */}
                  {selected.type === "condition" && <>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">Only continue if…</label>
                      <div className="space-y-0.5 max-h-60 overflow-y-auto">
                        {CONDITION_OPTIONS.map(({ k, l }) => (
                          <button key={k} onClick={() => updateStep(selectedIdx, { check: k, label: l })} className={"w-full text-left text-[11px] px-2.5 py-2 rounded-xl transition " + (selected.check === k ? "bg-amber-600/25 border border-amber-500/40 text-amber-200" : "hover:bg-white/5 text-white/55 hover:text-white border border-transparent")}>
                            {selected.check === k ? "✓ " : ""}{l}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-white/30 bg-amber-950/20 border border-amber-900/30 rounded-xl p-3">⚠️ If this condition fails, the next action step is skipped. Execution continues after.</div>
                  </>}

                  {/* ── BRANCH panel ── */}
                  {selected.type === "branch" && <>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">Branch label</label>
                      <GInput value={selected.label || ""} onChange={e => updateStep(selectedIdx, { label: e.target.value })} className="!text-xs" />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/50 uppercase tracking-wider mb-1.5 block">Branch paths (one per line)</label>
                      <GTxt rows={4} value={(selected.branches || ["5 stars", "≤4 stars"]).join("\n")} onChange={e => updateStep(selectedIdx, { branches: e.target.value.split("\n").filter(Boolean) })} className="!text-xs" />
                      <div className="text-[10px] text-white/30 mt-1">Each path executes independently. Use conditions after each branch.</div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      {[["Star rating", "5 stars\n≤4 stars"],["Payment", "Paid\nUnpaid"],["Engagement", "Opened\nIgnored"],["Review", "Positive\nNegative"]].map(([name, val]) => (
                        <button key={name} onClick={() => updateStep(selectedIdx, { branches: val.split("\n"), label: name + " branch" })} className="py-2 px-2 rounded-lg bg-brand-950/20 border border-brand-800/30 text-brand-300 hover:bg-brand-900/30 transition text-center">{name}</button>
                      ))}
                    </div>
                  </>}

                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-white/30">
                <div className="text-5xl mb-4 anim-float">⚡</div>
                <div className="text-sm font-semibold text-white/50">Click any node</div>
                <div className="text-xs mt-1">to configure it in this panel</div>
                <div className="mt-6 text-[10px] text-white/20">Click + between nodes to add steps</div>
              </div>
            )}

            {/* ── Test log ── */}
            {testLog.length > 0 && (
              <div className="border-t border-green-900/30 bg-black/80 flex-shrink-0 max-h-48 overflow-y-auto">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-green-900/20">
                  <div className="w-2 h-2 rounded-full bg-green-400 anim-pulse" />
                  <span className="text-[10px] text-green-400 font-semibold">Test Run Log</span>
                  <button onClick={() => setTestLog([])} className="ml-auto text-white/30 hover:text-white/60"><X size={10} /></button>
                </div>
                {testLog.map((l, i) => (
                  <div key={i} className={"flex items-start gap-2 px-3 py-1.5 border-b border-white/5 text-[10px] " + (l.status === "ok" || l.status === "sent" || l.status === "done" ? "text-green-300" : l.status === "skipped" ? "text-yellow-300/60" : "text-white/60")}>
                    <span className="mt-0.5 flex-shrink-0">{l.status === "running" ? "⏳" : l.status === "skipped" ? "⏭" : l.status === "done" ? "✅" : "→"}</span>
                    <span className="leading-tight">{l.message}</span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Workflow meta ── */}
            <div className="border-t border-brand-900/20 p-3 space-y-2 flex-shrink-0 bg-black/60">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-white/35 uppercase tracking-wider block mb-1">Category</label>
                  <GSel value={w.category} onChange={e => setW({ ...w, category: e.target.value })} className="!text-xs !py-1">
                    {["estimates","jobs","payments","reviews","lifecycle","referrals","other"].map(c => <option key={c} value={c} className="bg-black capitalize">{c}</option>)}
                  </GSel>
                </div>
                <div>
                  <label className="text-[9px] text-white/35 uppercase tracking-wider block mb-1">Description</label>
                  <GInput value={w.description || ""} onChange={e => setW({ ...w, description: e.target.value })} placeholder="What does this do?" className="!text-xs !py-1" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}



