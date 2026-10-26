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
import { supabase } from "../../lib/supabase";
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

export function AccountabilityPage({ entries = [], setEntries, goals = [], setGoals, wins = [], setWins, toast, settings = {} as AppSettings, ownerId = "", onNav = (_p: string) => {} }: { entries?: any[]; setEntries?: any; goals?: any[]; setGoals?: any; wins?: any[]; setWins?: any; toast?: any; settings?: AppSettings; ownerId?: string; onNav?: (page: string) => void }) {
  const [tab, setTab] = useState("today");
  // FEATURE — office-hours clock, separate from per-job clocking
  // (JobDetailModal/EmployeePortal): tracks admin/office time (invoicing,
  // calls, planning) that never happens "on" a job. Local-only, same
  // pattern as the rest of this page's usePersistent state.
  const [officeLog, setOfficeLog] = usePersistent<any[]>("crm.officeHoursLog", []);
  const [officeClockInAt, setOfficeClockInAt] = usePersistent<number | null>("crm.officeClockInAt", null);
  const clockInOffice = () => { setOfficeClockInAt(Date.now()); toast?.("🏢 Office hours started"); };
  const clockOutOffice = () => {
    if (!officeClockInAt) return;
    const minutes = Math.round((Date.now() - officeClockInAt) / 60000);
    setOfficeLog(prev => [...prev, { id: uid(), date: today(), minutes, startedAt: officeClockInAt, endedAt: Date.now() }]);
    setOfficeClockInAt(null);
    toast?.(`🏢 Logged ${minutes}m of office hours`);
  };
  const todayOfficeMinutes = officeLog.filter((l: any) => l.date === today()).reduce((s: number, l: any) => s + (Number(l.minutes) || 0), 0)
    + (officeClockInAt ? Math.round((Date.now() - officeClockInAt) / 60000) : 0);

  // FEATURE — "Alfred-focused" reminders: instead of a purely local
  // checklist the owner has to remember to check, this creates a REAL
  // scheduled text via the same alfred_reminders mechanism text-Alfred's
  // set_reminder tool uses (functions/api/check-reminders.ts) — Alfred
  // actually texts the owner at the chosen (or randomized) time. Requires
  // the same one-time external cron pinger set_reminder already needs
  // (Settings -> AI Models explains it).
  const [alfredReminderText, setAlfredReminderText] = useState("");
  const [alfredReminderTime, setAlfredReminderTime] = useState("09:00");
  const [alfredReminderMode, setAlfredReminderMode] = useState<"fixed" | "random">("fixed");
  const [alfredReminderFreq, setAlfredReminderFreq] = useState<"once" | "daily">("daily");
  const createAlfredReminder = async () => {
    const text = alfredReminderText.trim();
    if (!text) return;
    const phone = (settings as any)?.myPhone;
    if (!phone) { toast?.("Set your mobile number in Settings → Company first", "red"); return; }
    let [hh, mm] = alfredReminderTime.split(":").map(Number);
    if (alfredReminderMode === "random") {
      // Random time somewhere in the owner's business hours (8am-6pm) so a
      // "surprise me" reminder doesn't land at 2am.
      hh = 8 + Math.floor(Math.random() * 10);
      mm = Math.floor(Math.random() * 60);
    }
    const due = new Date();
    due.setHours(hh, mm, 0, 0);
    if (due.getTime() <= Date.now()) due.setDate(due.getDate() + 1);
    try {
      const { error } = await (supabase as any).from("alfred_reminders").insert({
        id: uid(), owner_id: ownerId, phone, message: text, due_at: due.toISOString(), sent: false,
        recurring: alfredReminderFreq === "daily" ? "daily" : null,
      });
      if (error) throw error;
      toast?.(`📲 Alfred will text you${alfredReminderFreq === "daily" ? " every day" : ""} ${alfredReminderMode === "random" ? "at a random time" : "at " + alfredReminderTime}${alfredReminderMode === "random" ? "" : ""} ✓`);
      setAlfredReminderText("");
    } catch (e: any) {
      toast?.("Couldn't schedule — " + (e?.message || "unknown error"), "red");
    }
  };
  // Meditation was removed from check-ins (owner request) — it isn't asked
  // for or shown, and an old entry drops it the next time it's saved.
  const [f, setF] = useState<{ sleep: any; water: any; gymMinutes: any; steps: any; mood: any; notes: string; personalNotes?: string }>({ sleep: 7, water: 0, gymMinutes: 0, steps: 0, mood: 3, notes: "" });
  const [gText, setGText] = useState("");
  const [wText, setWText] = useState("");

  const tKey = today();
  const todayEntry = entries.find(e => e.date === tKey);
  const hour = new Date().getHours();

  useEffect(() => {
    if (todayEntry) setF({ sleep: todayEntry.sleep, water: todayEntry.water, gymMinutes: todayEntry.gymMinutes || (todayEntry.gym ? 60 : 0), steps: todayEntry.steps, mood: todayEntry.mood, notes: todayEntry.notes || "", personalNotes: todayEntry.personalNotes || "" });
  }, [todayEntry]);

  const save = () => {
    const { meditationMinutes: _drop, ...rest } = (todayEntry || {}) as any;
    const payload = { ...rest, id: todayEntry?.id || uid(), date: tKey, ...f, sleep: Number(f.sleep), water: Number(f.water), gymMinutes: Number(f.gymMinutes), steps: Number(f.steps), mood: Number(f.mood) };
    if (todayEntry) setEntries(entries.map(e => e.id === todayEntry.id ? payload : e));
    else setEntries([...entries, payload]);
    toast("Check-in saved ✓");
  };

  const addWin = () => {
    if (!wText.trim()) return;
    setWins([...wins, { id: uid(), text: wText.trim(), date: tKey, category: "general" }]);
    setWText("");
    toast("Win logged! 🏆");
  };

  const [reminders, setReminders] = usePersistent("crm.reminders", []);
  const [personalTxns] = usePersistent("crm.personal.transactions", []);
  const recentLargeExp = personalTxns.filter(t => t.type === "expense" && Number(t.amount) > 200 && daysSince(t.date) <= 3);

  // Reminders Alfred will text — read straight from alfred_reminders so the
  // list matches what's really scheduled (including ones set by text).
  const [alfredReminders, setAlfredReminders] = useState<any[] | null>(null);
  const loadAlfredReminders = useCallback(async () => {
    if (!ownerId) return;
    const { data, error } = await (supabase as any).from("alfred_reminders").select("id,message,due_at,recurring").eq("owner_id", ownerId).eq("sent", false).order("due_at", { ascending: true }).limit(50);
    setAlfredReminders(error ? [] : (data || []));
  }, [ownerId]);
  useEffect(() => { if (tab === "reminders") loadAlfredReminders(); }, [tab, loadAlfredReminders]);
  const cancelAlfredReminder = async (id: string) => {
    const { data, error } = await (supabase as any).from("alfred_reminders").delete().eq("id", id).select("id");
    if (error || !data?.length) { toast("Couldn't cancel — " + (error?.message || "the server didn't delete it"), "red"); return; }
    setAlfredReminders(prev => (prev || []).filter(r => r.id !== id));
    toast("Reminder cancelled ✓");
  };

  // ── Streaks / trends ──
  const byDate = new Map(entries.map((e: any) => [e.date, e]));
  const last7 = Array.from({ length: 7 }, (_, i) => daysFromNow(-6 + i));
  const streak = (() => { let n = 0; for (let i = 0; i < 365; i++) { if (byDate.has(daysFromNow(-i))) n++; else if (i > 0) break; } return n; })();
  const week = last7.map(d => byDate.get(d) as any).filter(Boolean);
  const avg = (k: string) => week.length ? week.reduce((s, e) => s + (Number(e[k]) || 0), 0) / week.length : 0;
  const gymDays = week.filter(e => (Number(e.gymMinutes) || 0) > 0 || e.gym).length;

  // One short list of what matters right now, instead of a wall of alerts.
  const nudges: { icon: string; text: string; action?: { label: string; run: () => void } }[] = [];
  if (!todayEntry && hour >= 17) nudges.push({ icon: "📝", text: "You haven't checked in today." });
  if (todayEntry && Number(todayEntry.water) < 48 && hour >= 15) nudges.push({ icon: "💧", text: `Only ${Number(todayEntry.water) || 0}oz of water so far.` });
  if (todayEntry && Number(todayEntry.steps) < 2000 && hour >= 14 && hour < 19) nudges.push({ icon: "🦵", text: "Under 2,000 steps — take a quick walk." });
  if (week.length >= 3 && gymDays === 0) nudges.push({ icon: "🏋️", text: "No workout logged this week." });
  if (hour >= 13 && hour < 14 && !todayEntry?.lunchTaken) nudges.push({ icon: "🥗", text: "Lunch break — step away and eat.", action: { label: "Done", run: () => setEntries(prev => prev.map(e => e.date === tKey ? { ...e, lunchTaken: true } : e)) } });
  reminders.filter((r: any) => !r.lastDone || daysSince(r.lastDone) >= (r.frequency === "daily" ? 1 : 7)).slice(0, 2).forEach((r: any) => nudges.push({ icon: r.emoji || "📌", text: r.text, action: { label: "Done", run: () => setReminders(prev => prev.map(x => x.id === r.id ? { ...x, lastDone: today() } : x)) } }));
  if (recentLargeExp.length) nudges.push({ icon: "💸", text: `${recentLargeExp[0].description || "Large purchase"} — ${fmt(Number(recentLargeExp[0].amount))} in the last 3 days.` });
  if (hour >= 23 || hour < 1) nudges.push({ icon: "🌙", text: "It's late — sleep is your biggest performance lever." });

  const bump = (k: "water" | "steps" | "gymMinutes" | "sleep", by: number, max: number) => setF(p => ({ ...p, [k]: Math.max(0, Math.min(max, (Number(p[k]) || 0) + by)) }));
  const Bar7 = ({ k, max, color }: { k: string; max: number; color: string }) => (
    <div className="flex items-end gap-1 h-10">
      {last7.map(d => { const e: any = byDate.get(d); const v = e ? Number(e[k]) || 0 : 0; return <div key={d} title={`${d}: ${v}`} className="flex-1 rounded-sm bg-white/5 relative overflow-hidden" style={{ height: "100%" }}><div className={"absolute bottom-0 left-0 right-0 " + color} style={{ height: `${Math.min(100, (v / max) * 100)}%` }} /></div>; })}
    </div>
  );

  const TABS: [string, string][] = [["today", "Today"], ["reminders", "Reminders"], ["wins", "Wins"], ["history", "History"], ["office", "Office hours"], ["reflect", "Reflect"]];

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Glass className="p-4 !bg-gradient-to-br !from-brand-950/25 !to-black/60">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-900/40"><Flame size={18} className="text-orange-400" /></div>
            <div>
              <div className="text-lg font-bold">{streak} day{streak !== 1 ? "s" : ""} streak</div>
              <div className="text-[11px] text-white/50">{todayEntry ? "Checked in today ✓" : "Not checked in yet today"} · {wins.filter((w: any) => daysSince(w.date) <= 7).length} wins this week</div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center text-xs">
            <div><div className="text-white/40">Sleep</div><div className="font-bold">{avg("sleep").toFixed(1)}h</div></div>
            <div><div className="text-white/40">Water</div><div className="font-bold">{Math.round(avg("water"))}oz</div></div>
            <div><div className="text-white/40">Workouts</div><div className="font-bold">{gymDays}/7</div></div>
            <div><div className="text-white/40">Mood</div><div className="font-bold">{week.length ? avg("mood").toFixed(1) : "—"}</div></div>
          </div>
        </div>
        {nudges.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
            {nudges.slice(0, 4).map((n, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span>{n.icon}</span><span className="flex-1 text-white/75">{n.text}</span>
                {n.action && <button onClick={n.action.run} className="px-2 py-0.5 rounded-md bg-white/10 text-white/70 hover:text-white">{n.action.label}</button>}
              </div>
            ))}
          </div>
        )}
      </Glass>

      <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl overflow-x-auto">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={"flex-1 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition " + (tab === k ? "bg-brand-700/40 text-white border border-brand-700/50" : "text-white/55 hover:text-white")}>{l}</button>)}
      </div>

      {tab === "today" && (
        <Glass className="p-5">
          <div className="flex items-center gap-2 mb-4"><Heart size={16} className="text-danger-400" /><h3 className="font-semibold">Daily check-in</h3><span className="text-xs text-white/40">{tKey}</span>{todayEntry && <Badge tone="green">Saved</Badge>}</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {([
              ["sleep", "Sleep", <Moon size={13} />, "h", 0.5, 14, "bg-indigo-500/70"],
              ["water", "Water", <Droplet size={13} />, "oz", 8, 200, "bg-blue-500/70"],
              ["steps", "Steps", <Activity size={13} />, "", 1000, 50000, "bg-green-500/70"],
              ["gymMinutes", "Workout", <Dumbbell size={13} />, "min", 15, 300, "bg-brand-500/70"],
            ] as const).map(([k, l, icon, unit, step, max, color]) => (
              <div key={k} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between text-xs text-white/60 mb-2"><span className="flex items-center gap-1.5">{icon}{l}</span><span className="text-[10px] text-white/35">last 7 days</span></div>
                <div className="flex items-center gap-2 mb-2">
                  <button onClick={() => bump(k, -step, max)} className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 text-white/70 hover:text-white">−</button>
                  <input type="number" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} className="flex-1 min-w-0 bg-black/50 border border-white/15 rounded-lg px-2 py-1.5 text-center text-sm font-bold text-white focus:outline-none focus:border-brand-500/50" />
                  <button onClick={() => bump(k, step, max)} className="w-8 h-8 rounded-lg bg-black/40 border border-white/10 text-white/70 hover:text-white">+</button>
                  <span className="text-[11px] text-white/40 w-7">{unit}</span>
                </div>
                <Bar7 k={k} max={k === "sleep" ? 10 : k === "water" ? 128 : k === "steps" ? 12000 : 90} color={color} />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="text-xs text-white/60 mb-1.5 flex items-center gap-1"><Smile size={12} />Mood</div>
            <div className="flex gap-2">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setF({ ...f, mood: n })} className={"flex-1 py-2 rounded-lg text-xl transition " + (Number(f.mood) === n ? "bg-brand-900/40 border border-brand-500/50" : "bg-white/5 border border-white/10")}>{["😞", "😕", "😐", "🙂", "🔥"][n - 1]}</button>)}</div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <div><label className="text-xs text-white/60 mb-1 block">How did today go?</label><GTxt rows={2} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} placeholder="Business or personal — Alfred reads this at check-ins" className="!text-xs" /></div>
            <div><label className="text-xs text-white/60 mb-1 block">Personal notes (private)</label><GTxt rows={2} value={f.personalNotes || ""} onChange={e => setF({ ...f, personalNotes: e.target.value })} placeholder="Thoughts, things to remember…" className="!text-xs" /></div>
          </div>
          <GBtn onClick={save} className="w-full mt-3"><Save size={14} className="inline mr-1.5" />{todayEntry ? "Update" : "Save"} check-in</GBtn>
        </Glass>
      )}

      {tab === "reminders" && <div className="space-y-3">
        <Glass className="p-4 !bg-gradient-to-br !from-purple-950/20 !to-black/60 !border-purple-700/30">
          <div className="font-semibold text-sm flex items-center gap-2 mb-1"><Bot size={14} />Alfred texts you</div>
          <div className="text-xs text-white/55 mb-3">A real text at that time. You can also just tell Alfred ("remind me to call Mom Sunday at 6", "every weekday at 7 remind me to stretch"). Needs your cell number in Settings and the reminders scheduler (Settings → AI Models → health check shows if it's running).</div>
          <div className="space-y-2">
            <GInput placeholder="What should Alfred remind you about?" value={alfredReminderText} onChange={e => setAlfredReminderText(e.target.value)} />
            <div className="grid grid-cols-3 gap-2">
              <GSel value={alfredReminderFreq} onChange={e => setAlfredReminderFreq(e.target.value as any)}>
                <option value="daily" className="bg-black">Every day</option>
                <option value="once" className="bg-black">One time</option>
              </GSel>
              <GSel value={alfredReminderMode} onChange={e => setAlfredReminderMode(e.target.value as any)}>
                <option value="fixed" className="bg-black">At a set time</option>
                <option value="random" className="bg-black">Random (8am–6pm)</option>
              </GSel>
              {alfredReminderMode === "fixed"
                ? <input type="time" value={alfredReminderTime} onChange={e => setAlfredReminderTime(e.target.value)} className="bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50" />
                : <div className="flex items-center text-xs text-white/40 italic px-2">Alfred picks</div>}
            </div>
            <GBtn onClick={async () => { await createAlfredReminder(); loadAlfredReminders(); }} className="w-full"><Bot size={14} className="inline mr-1.5" />Schedule</GBtn>
          </div>
          <div className="mt-3 space-y-1.5">
            {alfredReminders === null ? <div className="text-[11px] text-white/35">Loading…</div>
              : alfredReminders.length === 0 ? <div className="text-[11px] text-white/35">Nothing scheduled.</div>
              : alfredReminders.map(r => (
                <div key={r.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-black/30 border border-white/10">
                  <Clock size={12} className="text-purple-300 flex-shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{r.message}</span>
                  <span className="text-[10px] text-white/45 whitespace-nowrap">{new Date(r.due_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}{r.recurring ? ` · ${r.recurring}` : ""}</span>
                  <button onClick={() => cancelAlfredReminder(r.id)} className="text-white/30 hover:text-danger-400"><X size={12} /></button>
                </div>
              ))}
          </div>
        </Glass>
        <Glass className="p-4">
          <div className="font-semibold text-sm mb-1">Personal checklist</div>
          <div className="text-xs text-white/55 mb-3">Things to keep up with (no text) — they show in the summary above when they're due.</div>
          <div className="space-y-2 mb-3">
            {reminders.length === 0 && <div className="text-[11px] text-white/35">Nothing here yet.</div>}
            {reminders.map((r: any) => {
              const overdue = r.lastDone ? (r.frequency === "daily" ? daysSince(r.lastDone) >= 1 : daysSince(r.lastDone) >= 7) : true;
              return <div key={r.id} className={"flex items-center gap-3 p-2.5 rounded-xl border transition " + (overdue ? "bg-brand-950/20 border-brand-700/30" : "bg-black/40 border-white/10")}>
                <span className="text-lg">{r.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{r.text}</div>
                  <div className="text-[10px] text-white/50">{r.frequency} · {r.lastDone ? "last done " + r.lastDone : "never done"}</div>
                </div>
                <button onClick={() => setReminders(prev => prev.map(x => x.id === r.id ? { ...x, frequency: x.frequency === "daily" ? "weekly" : "daily" } : x))} className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-white/50 hover:text-white">{r.frequency === "daily" ? "Daily" : "Weekly"}</button>
                <button onClick={() => setReminders(prev => prev.map(x => x.id === r.id ? { ...x, lastDone: today() } : x))} className="px-2.5 py-1 bg-green-900/40 border border-green-700/40 text-green-300 rounded-lg text-xs hover:bg-green-900/60">Done</button>
                <button onClick={() => setReminders(prev => prev.filter(x => x.id !== r.id))} className="p-1 text-white/30 hover:text-danger-400"><X size={12} /></button>
              </div>;
            })}
          </div>
          <div className="flex gap-2">
            <GInput placeholder="e.g. Call Mom, Gym, Pay credit card" value={gText} onChange={e => setGText(e.target.value)} className="flex-1" onKeyDown={e => { if (e.key === "Enter" && gText.trim()) { setReminders(prev => [...prev, { id: uid(), text: gText.trim(), frequency: "weekly", emoji: "📌", lastDone: null }]); setGText(""); toast("Added"); } }} />
            <GBtn onClick={() => { if (!gText.trim()) return; setReminders(prev => [...prev, { id: uid(), text: gText.trim(), frequency: "weekly", emoji: "📌", lastDone: null }]); setGText(""); toast("Added"); }}>Add</GBtn>
          </div>
        </Glass>
      </div>}

      {tab === "office" && <div className="space-y-3">
        <Glass className={"p-5 " + (officeClockInAt ? "!bg-green-950/20 !border-green-600/40" : "!bg-black/40")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={"p-2.5 rounded-xl " + (officeClockInAt ? "bg-green-900/40" : "bg-white/5")}><Clock size={18} className={officeClockInAt ? "text-green-400" : "text-white/60"} /></div>
              <div>
                <div className="text-xs text-white/60 uppercase tracking-wider">Office hours</div>
                <div className="text-sm">{officeClockInAt ? <span className="text-green-400 font-bold">Clocked in</span> : <span className="text-white/50">Not clocked in</span>}</div>
                <div className="text-[10px] text-white/40 mt-0.5">{todayOfficeMinutes}m today</div>
              </div>
            </div>
            {officeClockInAt ? <GBtn variant="danger" onClick={clockOutOffice}>Clock out</GBtn> : <GBtn onClick={clockInOffice}><Play size={12} className="inline mr-1" />Clock in</GBtn>}
          </div>
          <div className="text-xs text-white/40 mt-3">Admin time — invoicing, planning, calls. Field time is your day clock on the Jobs page.</div>
        </Glass>
        {officeLog.length > 0 && <Glass className="p-4">
          <div className="text-xs text-white/60 uppercase tracking-wider mb-2">Recent sessions</div>
          <div className="space-y-1.5">
            {[...officeLog].reverse().slice(0, 15).map((l: any) => (
              <div key={l.id} className="flex items-center justify-between text-xs p-2 bg-white/5 rounded-lg"><span className="text-white/70">{l.date}</span><span className="font-semibold">{l.minutes}m</span></div>
            ))}
          </div>
        </Glass>}
      </div>}

      {tab === "history" && (
        <Glass className="p-5">
          <h3 className="font-semibold mb-4">Check-in history</h3>
          <div className="space-y-2">
            {entries.slice().sort((a, b) => b.date.localeCompare(a.date)).map(e => (
              <div key={e.id} className="p-3 bg-white/5 border border-white/5 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-sm">{e.date}</div>
                  <div className="text-lg">{["😞", "😕", "😐", "🙂", "🔥"][(Number(e.mood) || 3) - 1]}</div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center"><div className="text-white/50">Sleep</div><div className="font-bold">{e.sleep}h</div></div>
                  <div className="text-center"><div className="text-white/50">Water</div><div className="font-bold">{e.water}oz</div></div>
                  <div className="text-center"><div className="text-white/50">Steps</div><div className="font-bold">{Number(e.steps || 0).toLocaleString()}</div></div>
                  <div className="text-center"><div className="text-white/50">Workout</div><div className={"font-bold " + ((e.gymMinutes || 0) > 0 ? "text-danger-400" : "text-white/30")}>{(e.gymMinutes || 0) > 0 ? (e.gymMinutes || 0) + "m" : "—"}</div></div>
                </div>
                {e.notes && <div className="text-[11px] text-white/50 mt-2">📝 {e.notes}</div>}
              </div>
            ))}
            {entries.length === 0 && <div className="text-center py-8 text-white/40 text-sm">No check-ins yet — start today</div>}
          </div>
        </Glass>
      )}

      {tab === "wins" && (
        <Glass className="p-5">
          <div className="flex gap-2 mb-4"><GInput placeholder="Log a win…" value={wText} onChange={e => setWText(e.target.value)} onKeyDown={e => e.key === "Enter" && addWin()} /><GBtn onClick={addWin}><Plus size={14} /></GBtn></div>
          <div className="space-y-2">
            {wins.slice().sort((a: any, b: any) => (b.date || "").localeCompare(a.date || "")).map(w => <div key={w.id} className="flex items-start gap-3 p-3 bg-gradient-to-br from-yellow-950/20 to-black/40 border border-yellow-800/30 rounded-xl">
              <Trophy size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0"><div className="text-sm">{w.text}</div><div className="text-[10px] text-white/40">{w.date}</div></div>
              <button onClick={() => setWins(wins.filter(x => x.id !== w.id))} className="p-1 text-white/40 hover:text-danger-400"><Trash2 size={12} /></button>
            </div>)}
            {wins.length === 0 && <div className="text-center py-8 text-white/40 text-sm">Log your first win</div>}
          </div>
          <div className="mt-4 text-center"><button onClick={() => onNav("goals")} className="text-xs text-white/50 hover:text-white">Goals live under Growth → Goals <ArrowRight size={11} className="inline" /></button></div>
        </Glass>
      )}
      {tab === "reflect" && <WeeklyReflectionTab entries={entries} goals={goals} wins={wins} toast={toast} settings={settings} />}
    </div>
  );
}

