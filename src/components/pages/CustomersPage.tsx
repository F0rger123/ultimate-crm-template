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
import { twilioSend, sendEmail, logOutboundSmsToInbox } from "../../lib/messaging";
import { supabase } from "../../lib/supabase";
import { seedWeather } from "../../lib/weather";
import { seedCustomers, seedEstimates, seedJobs, seedEmployees, seedVehicles, seedExpenses, seedChemicals, seedServices, seedAutomations, seedEmailTemplates, seedSmsTemplates, seedRewardTiers, seedReferrals, seedMaintenance, campaignTemplates, seedSocialPosts, seedTimeline, seedGoals, seedReminders, seedAccountabilityEntries, seedMileage, seedLeadSrc, STEP_TYPES, AUTOMATION_TEMPLATES } from "../../lib/seed";
import { callModel, MODELS } from "../../lib/api";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, fetchDriveFiles, MOCK_GOOGLE_DATA, fmtSize, fmtDate, fileIcon } from "../../lib/google";
import { usePersistent } from "../../hooks/usePersistent";
import { usePersistentRaw } from "../../hooks/usePersistentRaw";
import { Glass } from "../ui/Glass";
import { ImportDataModal } from "../ui/ImportDataModal";
import { deleteByIds } from "../../lib/dbBulk";
import { CUSTOMER_FIELD_MAP, CUSTOMER_FIELD_LABELS, CUSTOMER_FIELD_EXCLUDE, rowToCustomer, mergeImportedCustomers, saveCustomersTolerant } from "../../lib/customerImport";
import { ImportStripeCustomersModal } from "../ui/ImportStripeCustomersModal";
import { PortalInvitesModal } from "../ui/PortalInvitesModal";
import { getPortalInvites, sendPortalInvites } from "../../lib/portalInvites";
import { GBtn } from "../ui/GBtn";
import { useConfirm } from "../ui/ConfirmModal";
import { UpgradePrompt } from "../ui/UpgradePrompt";
import { PLAN_TIER_LABEL, type PlanLimits } from "../../lib/planLimits";
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
import { CustomerMapView } from "../ui/CustomerMapView";
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

export function CustomersPage({ customers = [], setCustomers, estimates = [], jobs = [], employees = [], toast, timeline = {}, setTimeline = () => {}, settings = {} as AppSettings, setSettings = (() => {}) as any, autoOpenNew = false, onAutoOpenNewConsumed, highlightId = null, pushUndo = (_desc: string, _fn: () => void, _redoFn?: () => void) => {}, markRecentlyDeleted = (_table: "jobs" | "customers" | "estimates", _ids: string[]) => {}, unmarkRecentlyDeleted = (_table: "jobs" | "customers" | "estimates", _ids: string[]) => {}, onSpotlight = (_step: { page: string; type?: string; id?: string; label?: string }) => {}, planLimits, onUpgrade = () => {} }: { customers?: any[]; setCustomers?: any; estimates?: any[]; jobs?: any[]; employees?: any[]; toast?: any; timeline?: any; setTimeline?: any; settings?: AppSettings; setSettings?: any; autoOpenNew?: boolean; onAutoOpenNewConsumed?: () => void; highlightId?: string | null; pushUndo?: (desc: string, fn: () => void, redoFn?: () => void) => void; markRecentlyDeleted?: (table: "jobs" | "customers" | "estimates", ids: string[]) => void; unmarkRecentlyDeleted?: (table: "jobs" | "customers" | "estimates", ids: string[]) => void; onSpotlight?: (step: { page: string; type?: string; id?: string; label?: string }) => void; planLimits?: PlanLimits; onUpgrade?: () => void }) {
  const [search, setSearch] = useState("");
  // FEATURE — "the popup should be in the CRM with the CRM's UI" — replaces
  // window.confirm() for delete actions with a real branded modal.
  const { confirmAsync, ConfirmDialog } = useConfirm();
  // FEATURE — "Alfred spotlight": briefly glows + scrolls to the row Alfred
  // just created/touched, driven by App.tsx's spotlight queue.
  useEffect(() => {
    if (!highlightId) return;
    // Two card renderings exist (mobile-stacked + desktop-table); only one
    // is actually visible at a given viewport width — scroll to whichever
    // one has layout (offsetParent is null for display:none elements).
    const els = document.querySelectorAll<HTMLElement>(`[data-customer-id="${highlightId}"]`);
    Array.from(els).find(el => el.offsetParent !== null)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId]);
  const spotlightCls = (id: string) => highlightId === id ? " ring-2 ring-brand-500 shadow-[0_0_25px_rgba(255,255,255,0.65)]" : "";
  // FEATURE — filter/sort controls for the customer list (previously just a
  // plain text search with no way to sort or filter by tag).
  const [sortBy, setSortBy] = useState<"name" | "dateAdded" | "lastJob" | "totalSpent">("name");
  const [tagFilter, setTagFilter] = useState("");
  // FEATURE — customer folders, simplified to a single flat folder name per
  // customer with a filter dropdown (not nested subfolders/drag-and-drop —
  // see CustomerModal's folder field for how a customer gets assigned one).
  const [folderFilter, setFolderFilter] = useState("");
  // AUDIT FIX — folder management (add/rename/delete/nest/drag-drop). Nesting
  // is a "Parent/Child" naming convention on the same flat string field
  // (no schema change) — a customer's folder is still just one string, but
  // the UI splits on "/" to render and manage it as a tree. Empty folders
  // (no customers yet) need to exist SOMEWHERE independent of any customer
  // row, hence settings.customerFolders as the master list.
  const [folderManagerOpen, setFolderManagerOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParent, setNewFolderParent] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggedCustomerId, setDraggedCustomerId] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [modal, setModal] = useState({ open: false, data: null });
  // FEATURE — "whenever they hit their plan limit... it prompts them to
  // upgrade." Every path that opens the Add-customer modal funnels through
  // this one check instead of calling setModal directly.
  const [upgradePromptOpen, setUpgradePromptOpen] = useState(false);
  const atCustomerLimit = !!planLimits && planLimits.customers !== null && customers.length >= planLimits.customers;
  const openAddCustomer = () => {
    if (atCustomerLimit) { setUpgradePromptOpen(true); return; }
    setModal({ open: true, data: null });
  };
  // ISSUE 21 — the FAB's "New Customer" action used to just navigate here
  // and leave the owner to find/click Add themselves. Opens the Add modal
  // automatically once, then tells the parent to clear the flag so it
  // doesn't reopen on every re-render or the next time this page is visited.
  useEffect(() => {
    if (!autoOpenNew) return;
    openAddCustomer();
    onAutoOpenNewConsumed?.();
  }, [autoOpenNew]); // eslint-disable-line react-hooks/exhaustive-deps
  const [detail, setDetail] = useState(null);
  const [pageTab, setPageTab] = useState("list"); // list | analytics | duplicates | map
  const [dupPairs, setDupPairs] = useState(null); // null = not scanned, [] = no dupes
  const [mergeModal, setMergeModal] = useState(null); // { a, b }
  const [mergeChoices, setMergeChoices] = useState({}); // field → "a" | "b"
  const [mergeMode, setMergeMode] = useState(false);
  const [mergePair, setMergePair] = useState([]);
  const fileRef = useRef(null);
  // FEATURE 5 (mobile round 7) — bulk select mode, separate from mergeMode
  // (which is capped at exactly 2 rows for a different purpose).
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<string[]>([]);
  const toggleBulk = (id: string) => setBulkSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  // FEATURE — Bulk SMS to a filtered/selected segment. Reuses the existing
  // bulk-select checkboxes (which already only offer customers from `filtered`,
  // so "Select all" is naturally scoped to whatever search/tag/folder filter
  // is currently applied — e.g. filter to a tag/folder, Select,
  // Select all, Bulk SMS). Same {{first_name}} etc. token convention as
  // CampaignsPage's `merge()`, same sequential-with-100ms-delay send loop as
  // CampaignsPage's `launch()` (avoids hammering the Twilio rate limit), same
  // settings?.twilioSid && c.phone guard as InvoicesPage/JobsPage bulk sends.
  const [bulkSmsOpen, setBulkSmsOpen] = useState(false);
  const [bulkSmsBody, setBulkSmsBody] = useState("");
  const [bulkSmsSending, setBulkSmsSending] = useState(false);
  const [bulkSmsProgress, setBulkSmsProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);

  const bulkSmsMerge = (template: string, c: any) => template
    .replace(/{{first_name}}/g, c.firstName || "there")
    .replace(/{{last_name}}/g, c.lastName || "")
    .replace(/{{address}}/g, c.address || "")
    .replace(/{{company_name}}/g, (settings as any)?.companyName || "CRM Starter")
    .replace(/{{company_phone}}/g, (settings as any)?.companyPhone || "(555) 555-0100");

  const bulkSmsSelectedCustomers = customers.filter((c: any) => bulkSelected.includes(c.id));
  const bulkSmsEligible = bulkSmsSelectedCustomers.filter((c: any) => c.phone && !c.smsOptOut);
  const bulkSmsExcludedCount = bulkSmsSelectedCustomers.length - bulkSmsEligible.length;

  const sendBulkSms = async () => {
    if (!bulkSmsBody.trim() || bulkSmsEligible.length === 0) return;
    if (!settings?.twilioSid) { toast("Connect Twilio in Settings → Integrations to send bulk SMS", "red"); return; }
    setBulkSmsSending(true);
    setBulkSmsProgress({ sent: 0, failed: 0, total: bulkSmsEligible.length });
    let sent = 0, failed = 0;
    const failureSamples: string[] = [];
    for (const c of bulkSmsEligible) {
      const personalized = bulkSmsMerge(bulkSmsBody, c);
      try {
        await twilioSend(settings, c.phone, personalized);
        logOutboundSmsToInbox({ contactName: `${c.firstName} ${c.lastName}`, contactPhone: c.phone, customerId: c.id, body: personalized }).catch((e: any) => console.warn("[CustomersPage] bulk SMS failed to sync to inbox:", e?.message));
        sent++;
      } catch (e: any) {
        failed++;
        const reason = e?.message || "Unknown error";
        if (failureSamples.length < 5) failureSamples.push(`${c.firstName || c.phone}: ${reason}`);
        console.error("[CustomersPage] bulk SMS failed for", c.id, "—", reason);
      }
      setBulkSmsProgress({ sent, failed, total: bulkSmsEligible.length });
      // Small delay to avoid overwhelming Twilio rate limits — same pattern
      // as CampaignsPage's bulk send loop.
      await new Promise(r => setTimeout(r, 100));
    }
    setBulkSmsSending(false);
    setBulkSmsProgress(null);
    setBulkSmsOpen(false);
    setBulkSmsBody("");
    setBulkSelected([]);
    setBulkMode(false);
    if (failed > 0) {
      toast(`Bulk SMS sent — ${sent} delivered, ${failed} failed. First failure: ${failureSamples[0] || "unknown error"}`, sent > 0 ? "yellow" : "red");
    } else {
      toast(`Bulk SMS sent to ${sent} customer${sent !== 1 ? "s" : ""} ✓`, "green");
    }
  };

  const toggleMerge = id => setMergePair(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 2 ? [...prev, id] : prev);

  const doSimpleMerge = () => {
    if (mergePair.length !== 2) return;
    const [aId, bId] = mergePair;
    const a = customers.find(c => c.id === aId);
    const b = customers.find(c => c.id === bId);
    if (!a || !b) return;
    const merged = { ...a, ...b, id: a.id, totalSpent: (a.totalSpent || 0) + (b.totalSpent || 0), notes: [a.notes, b.notes].filter(Boolean).join(" | ") };
    setCustomers(customers.filter(c => c.id !== bId).map(c => c.id === aId ? merged : c));
    setMergeMode(false);
    setMergePair([]);
    toast("Customers merged ✓");
  };

  const allCustomerTags = Array.from(new Set(customers.flatMap((c: any) => c.tags || []))).sort();
  const allCustomerFolders = Array.from(new Set(customers.map((c: any) => c.folder).filter(Boolean))).sort();
  // Union of folders that actually have a customer in them AND folders that
  // exist only because the owner explicitly created them (still empty).
  const masterFolders = Array.from(new Set([...(settings.customerFolders || []), ...allCustomerFolders])).sort();
  // Every folder AND every ancestor path implied by "/"-nested names, so
  // "Commercial/Restaurants" also surfaces a "Commercial" node in the tree
  // even if no customer/created-folder is filed directly under "Commercial"
  // itself.
  const allFolderPaths = Array.from(new Set(masterFolders.flatMap(f => {
    const parts = f.split("/");
    return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
  }))).sort();
  const folderDepth = (path: string) => path.split("/").length - 1;
  const folderLabel = (path: string) => path.split("/").pop() || path;
  const folderCustomerCount = (path: string) => customers.filter((c: any) => c.folder === path || (c.folder || "").startsWith(path + "/")).length;

  const renameFolder = (oldPath: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === folderLabel(oldPath)) { setRenamingFolder(null); return; }
    const parent = oldPath.includes("/") ? oldPath.slice(0, oldPath.lastIndexOf("/")) : "";
    const newPath = parent ? `${parent}/${trimmed}` : trimmed;
    if (allFolderPaths.includes(newPath)) { toast?.("A folder with that name already exists here", "red"); return; }
    // Re-point this folder AND every descendant ("oldPath/...") to the new path.
    setCustomers((prev: any[]) => prev.map((c: any) => {
      if (c.folder === oldPath) return { ...c, folder: newPath };
      if ((c.folder || "").startsWith(oldPath + "/")) return { ...c, folder: newPath + c.folder.slice(oldPath.length) };
      return c;
    }));
    setSettings((s: any) => ({
      ...s,
      customerFolders: (s.customerFolders || []).map((f: string) =>
        f === oldPath ? newPath : f.startsWith(oldPath + "/") ? newPath + f.slice(oldPath.length) : f
      ),
    }));
    setRenamingFolder(null);
    if (folderFilter === oldPath) setFolderFilter(newPath);
    toast?.("Folder renamed ✓");
  };

  const deleteFolder = async (path: string) => {
    const count = folderCustomerCount(path);
    if (!(await confirmAsync({ message: count > 0 ? `Delete "${folderLabel(path)}"? ${count} customer(s) will become unfiled (not deleted).` : `Delete empty folder "${folderLabel(path)}"?`, confirmLabel: "Delete Folder" }))) return;
    setCustomers((prev: any[]) => prev.map((c: any) => (c.folder === path || (c.folder || "").startsWith(path + "/")) ? { ...c, folder: "" } : c));
    setSettings((s: any) => ({ ...s, customerFolders: (s.customerFolders || []).filter((f: string) => f !== path && !f.startsWith(path + "/")) }));
    if (folderFilter === path) setFolderFilter("");
    toast?.("Folder deleted ✓");
  };

  const createFolder = () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;
    const path = newFolderParent ? `${newFolderParent}/${trimmed}` : trimmed;
    if (allFolderPaths.includes(path)) { toast?.("That folder already exists", "red"); return; }
    setSettings((s: any) => ({ ...s, customerFolders: [...(s.customerFolders || []), path] }));
    setNewFolderName("");
    toast?.("Folder created ✓");
  };

  const moveCustomerToFolder = (customerId: string, folderPath: string) => {
    setCustomers((prev: any[]) => prev.map((c: any) => c.id === customerId ? { ...c, folder: folderPath } : c));
    const cust = customers.find((c: any) => c.id === customerId);
    toast?.(`${cust?.firstName || "Customer"} moved to ${folderPath || "Unfiled"} ✓`);
  };
  // Last-job-scheduled date per customer, used for the "Last Job" sort — not
  // stored on the customer record itself, so derived from jobs here.
  const lastJobDateByCustomer = (() => {
    const m: Record<string, string> = {};
    for (const j of jobs as any[]) {
      if (!j.customerId || !j.scheduledDate) continue;
      if (!m[j.customerId] || j.scheduledDate > m[j.customerId]) m[j.customerId] = j.scheduledDate;
    }
    return m;
  })();
  const filtered = customers
    .filter(c => (c.firstName + " " + c.lastName + " " + c.email + " " + c.phone).toLowerCase().includes(search.toLowerCase()))
    .filter(c => !tagFilter || (c.tags || []).includes(tagFilter))
    .filter(c => !folderFilter || (folderFilter === "__unfiled__" ? !c.folder : c.folder === folderFilter))
    .slice()
    .sort((a: any, b: any) => {
      if (sortBy === "name") return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
      if (sortBy === "dateAdded") return (b.createdAt || "").localeCompare(a.createdAt || "");
      if (sortBy === "totalSpent") return (Number(b.totalSpent) || 0) - (Number(a.totalSpent) || 0);
      if (sortBy === "lastJob") return (lastJobDateByCustomer[b.id] || "").localeCompare(lastJobDateByCustomer[a.id] || "");
      return 0;
    });
  const toggleBulkAll = () => setBulkSelected(bulkSelected.length === filtered.length ? [] : filtered.map(c => c.id));

  const downloadSelectedCsv = () => {
    const rows = [["firstName", "lastName", "email", "phone", "address", "totalSpent", "createdAt"]];
    customers.filter(c => bulkSelected.includes(c.id)).forEach(c => rows.push([c.firstName, c.lastName, c.email, c.phone, c.address, c.totalSpent, c.createdAt]));
    const csv = rows.map(r => r.map(v => '"' + String(v ?? "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "customers-selected-" + today() + ".csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast(`Downloaded ${bulkSelected.length} customer${bulkSelected.length !== 1 ? "s" : ""}`);
  };
  const deleteSelectedCustomers = async () => {
    if (bulkSelected.length === 0) return;
    if (!(await confirmAsync({ message: `Permanently delete ${bulkSelected.length} customer${bulkSelected.length !== 1 ? "s" : ""}? This can't be undone.`, confirmLabel: "Delete" }))) return;
    const ids = [...bulkSelected];
    setCustomers(customers.filter(c => !ids.includes(c.id)));
    markRecentlyDeleted("customers", ids);
    setBulkSelected([]);
    // In batches of 100 — one request with every id (a thousand customers)
    // was too long for the server, failed, and they all came back.
    if (ids.length > 200) toast(`Deleting ${ids.length} customers…`);
    deleteByIds("customers", ids)
      .then(r => {
        if (r.failed) { toast(`Deleted ${r.deleted.length} of ${ids.length} on the server${r.error ? " — " + r.error : ""}. The rest may reappear — try deleting them again.`, "red"); return; }
        toast(ids.length + " customer(s) deleted");
      })
      .catch((e: any) => toast("Deleted locally, but failed to delete from server — " + (e?.message || ""), "red"));
  };

  // BLOCKER — this only ever called setCustomers (local state), same gap
  // App.tsx's own 30s bulk customer autosave was added to paper over ("no
  // write path to Supabase at all... only looked true on the single device
  // that created the record"). But that bulk save is up to 30s delayed and
  // has no per-edit success/failure feedback — editing a customer and
  // checking another device (or this same one, right after) within that
  // window shows the OLD data, reading as "editing doesn't work" even
  // though it eventually syncs. Writing immediately here, with its own
  // toast, closes that gap the same way jobs/crew writes already were.
  const save = (d: any) => {
    const isNew = !d.id;
    let record = d;
    if (isNew) {
      const id = uid();
      // A stable, real referral code generated once at creation — not derived
      // on the fly from the id, so it survives independently and reads cleanly.
      const referralCode = (d.firstName?.slice(0, 3) || "REF").toUpperCase() + id.slice(-4).toUpperCase();
      record = { ...d, id, totalSpent: 0, createdAt: today(), referralCode };
    }
    setCustomers(isNew ? [...customers, record] : customers.map(c => c.id === record.id ? record : c));
    setModal({ open: false, data: null });
    // A column the database doesn't have yet (city/state/zip from the address
    // autocomplete, folder, …) used to reject the whole save — drop just that
    // column and save the rest.
    saveCustomersTolerant([record])
      .then(r => {
        if (r.failed) { console.error("[CustomersPage] save failed:", r.error); toast("Saved locally, but failed to sync — " + r.error, "red"); return; }
        toast("Customer saved ✓", "green");
        // New customer → send their customer-portal link (Customers →
        // Portal invites turns this off). Only for customers added one at a
        // time here, never imports or leads.
        if (isNew && (settings as any)?.autoPortalInvite !== false && record.pipelineStage !== "lead" && (record.phone || record.email)) {
          getPortalInvites([record.id])
            .then(inv => sendPortalInvites(settings, inv))
            .then(res => { if (res.sent) toast(`Portal invite sent to ${record.firstName || "the customer"} ✓`, "green"); else if (res.failed) toast("Couldn't send the portal invite — " + (res.errors[0] || "unknown error"), "red"); })
            .catch((e: any) => toast("Couldn't create the portal invite — " + (e?.message || "unknown error"), "red"));
        }
      })
      .catch((e: any) => { console.error("[CustomersPage] save threw:", e?.message); toast("Saved locally, but failed to sync — " + (e?.message || "unknown error"), "red"); });
  };

  const deleteCustomer = (c: any) => {
    setCustomers(customers.filter(x => x.id !== c.id));
    markRecentlyDeleted("customers", [c.id]);
    setDetail(null);
    pushUndo(`Deleted customer ${c.firstName || ""} ${c.lastName || ""}`.trim(), () => {
      unmarkRecentlyDeleted("customers", [c.id]);
      setCustomers((prev: any[]) => [c, ...prev]);
      (supabase as any).from("customers").insert(c).then((r: any) => {
        if (r?.error) toast("Restored locally, but failed to restore on server — " + r.error.message, "red");
      }).catch(() => {});
    }, () => {
      setCustomers((prev: any[]) => prev.filter((x: any) => x.id !== c.id));
      markRecentlyDeleted("customers", [c.id]);
      // BUG FIX (audit) — the "redo delete" path (undo the undo) checked
      // only a thrown error, unlike the primary delete a few lines below,
      // which also checks .select("id")'s row count — a 0-row RLS mismatch
      // here silently believed the redo succeeded.
      (supabase as any).from("customers").delete().eq("id", c.id).select("id").then((r: any) => {
        if (r?.error) { toast("Removed locally, but failed to remove on server — " + r.error.message, "red"); return; }
        if (!Array.isArray(r?.data) || r.data.length === 0) toast("Removed locally, but the server didn't confirm — it may reappear.", "red");
      }).catch((e: any) => toast("Removed locally, but failed to remove on server — " + (e?.message || ""), "red"));
    });
    (supabase as any).from("customers").delete().eq("id", c.id).select("id")
      .then((result: any) => {
        if (result?.error) { toast("Deleted locally, but failed to delete from server — " + result.error.message, "red"); return; }
        if (!Array.isArray(result?.data) || result.data.length === 0) { toast("Deleted locally, but the server didn't confirm — it may reappear. Try again or refresh to check.", "red"); return; }
        toast("Customer deleted");
      })
      .catch((e: any) => toast("Deleted locally, but failed to delete from server — " + (e?.message || ""), "red"));
  };

  // Scan for duplicates by name similarity, phone, or email
  const scanDuplicates = () => {
    const pairs = [];
    const seen = new Set();
    for (let i = 0; i < customers.length; i++) {
      for (let j = i + 1; j < customers.length; j++) {
        const a = customers[i], b = customers[j];
        const key = [a.id, b.id].sort().join("-");
        if (seen.has(key)) continue;
        const nameA = (a.firstName + " " + a.lastName).toLowerCase().trim();
        const nameB = (b.firstName + " " + b.lastName).toLowerCase().trim();
        const samePhone = a.phone && b.phone && a.phone.replace(/\D/g,"") === b.phone.replace(/\D/g,"");
        const sameEmail = a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase();
        const sameName = nameA === nameB || (nameA.length > 3 && nameB.startsWith(nameA.slice(0,4)));
        if (samePhone || sameEmail || sameName) {
          const reason = samePhone ? "Same phone" : sameEmail ? "Same email" : "Similar name";
          pairs.push({ a, b, reason });
          seen.add(key);
        }
      }
    }
    setDupPairs(pairs);
    setPageTab("duplicates");
    toast(pairs.length > 0 ? "Found " + pairs.length + " potential duplicate" + (pairs.length !== 1 ? "s" : "") : "No duplicates found ✓");
  };

  // Smart merge — user picks which field wins
  const openMerge = (a, b) => {
    const choices = {};
    const fields = ["firstName","lastName","phone","email","address","notes","leadSource","sqFootage","gateCode"];
    fields.forEach(f => { choices[f] = a[f] ? "a" : "b"; });
    setMergeChoices(choices);
    setMergeModal({ a, b });
  };

  const doMerge = () => {
    const { a, b } = mergeModal;
    const merged = { ...a };
    Object.entries(mergeChoices).forEach(([field, choice]) => { merged[field] = choice === "a" ? a[field] : b[field]; });
    merged.totalSpent = (a.totalSpent || 0) + (b.totalSpent || 0);
    merged.tags = [...new Set([...(a.tags||[]), ...(b.tags||[])])];
    setCustomers(customers.filter(c => c.id !== b.id).map(c => c.id === a.id ? merged : c));
    setDupPairs(prev => prev?.filter(p => !(p.a.id === a.id && p.b.id === b.id)));
    setMergeModal(null);
    toast("Merged: " + merged.firstName + " " + merged.lastName + " ✓");
  };

  const exportCSV = () => {
    const rows = [["firstName", "lastName", "email", "phone", "address", "totalSpent", "createdAt", "gateCode", "hasDog", "dogName", "sensitivePlants", "notes"]];
    customers.forEach(c => rows.push([c.firstName, c.lastName, c.email, c.phone, c.address, c.totalSpent, c.createdAt, c.gateCode || "", c.hasDog ? "yes" : "", c.dogName || "", c.sensitivePlants || "", c.notes || ""]));
    const csv = rows.map(r => r.map(v => '"' + String(v || "").replace(/"/g, '""') + '"').join(",")).join("\n");
    const b = new Blob([csv], { type: "text/csv" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(u);
    toast("Exported " + customers.length + " customers");
  };

  // Customer import (CSV file, Google Sheets, pasted text) — one path, see
  // ImportDataModal + lib/customerImport.ts. Rows matching an existing
  // customer (same email, phone, or name) fill in that customer's blanks
  // instead of creating a duplicate, and new customers stop at the plan's
  // customer limit.
  const [importOpen, setImportOpen] = useState<false | "file" | "sheets">(false);
  const [stripeImportOpen, setStripeImportOpen] = useState(false);
  const [portalInvitesOpen, setPortalInvitesOpen] = useState(false);
  // Imports land as customers unless the owner picks otherwise on the review
  // screen — see rowToCustomer's comment for the bug this prevents.
  const [importAs, setImportAs] = useState<"customers" | "leads" | "status">("customers");
  const handleCustomerImport = async (rows: Record<string, string>[]) => {
    const incoming = rows.map(r => rowToCustomer(r, { leadsFromStatus: importAs === "status" })).filter(Boolean) as any[];
    if (incoming.length === 0) throw new Error("no rows had a name, company, email or phone");
    if (importAs === "leads") incoming.forEach(c => { c.pipelineStage = "lead"; });
    const limit = planLimits?.customers ?? null;
    const { next, added, updated, skippedOverLimit } = mergeImportedCustomers(customers, incoming, limit);
    setCustomers(next);
    const result = await saveCustomersTolerant([...added, ...updated]);
    if (result.droppedColumns.length) console.warn("[Import] saved without columns the database doesn't have yet:", result.droppedColumns.join(", "));
    if (result.failed) throw new Error(`${result.failed} customer(s) didn't save to the server — ${result.error}`);
    const leadCount = added.filter(c => c.pipelineStage === "lead").length;
    setImportAs("customers");
    return `Imported ${added.length} new ${importAs === "leads" ? "lead" : "customer"}${added.length !== 1 ? "s" : ""}` +
      (importAs === "status" && leadCount ? ` (${leadCount} as leads)` : "") +
      (updated.length ? ` · updated ${updated.length} existing` : "") +
      (skippedOverLimit ? ` · ${skippedOverLimit} skipped (${limit} customer limit)` : "") + " ✓";
  };

  const quickAction = (kind, c) => {
    if (kind === "call" && c.phone) { window.location.href = "tel:" + c.phone.replace(/\D/g, ""); return; }
    if (kind === "text" && c.phone) { window.location.href = "sms:" + c.phone.replace(/\D/g, ""); return; }
    if (kind === "email" && c.email) { window.location.href = "mailto:" + c.email; return; }
    toast("No contact info for " + kind);
  };

  return (
    <div className="space-y-4">
      {ConfirmDialog}
      {planLimits && (
        <UpgradePrompt
          open={upgradePromptOpen}
          onClose={() => setUpgradePromptOpen(false)}
          onUpgrade={() => { setUpgradePromptOpen(false); onUpgrade(); }}
          tier={planLimits.tier}
          resource="customers"
          limit={planLimits.customers || 0}
        />
      )}
      {planLimits?.customers != null && planLimits && (planLimits.tier === "free" || customers.length >= planLimits.customers * 0.9) && (
        <div className={"flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs " + (atCustomerLimit ? "bg-brand-950/20 border-brand-700/40 text-brand-300" : "bg-white/5 border-white/10 text-white/50")}>
          <span>{customers.length.toLocaleString()} / {planLimits.customers.toLocaleString()} customers used on {PLAN_TIER_LABEL[planLimits.tier]}</span>
          {planLimits.tier === "free" && <button onClick={onUpgrade} className="text-brand-400 hover:text-brand-300 font-semibold flex-shrink-0">Upgrade →</button>}
        </div>
      )}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2 items-center flex-wrap">
          {["list", "map", "analytics", "duplicates"].map(t => <button key={t} onClick={() => { setPageTab(t); if (t === "duplicates" && dupPairs === null) scanDuplicates(); }} className={"px-3 py-1.5 rounded-lg text-xs font-medium capitalize border transition " + (pageTab === t ? "bg-brand-900/40 border-brand-500/50 text-white" : "bg-black/40 border-brand-900/30 text-white/60 hover:text-white")}>{t === "analytics" ? "📊 LTV Analytics" : t === "duplicates" ? "🔍 Find Duplicates" + (dupPairs?.length > 0 ? " (" + dupPairs.length + ")" : "") : t === "map" ? "🗺️ Map" : "👥 Customers"}</button>)}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex gap-2 items-center flex-wrap">
            {pageTab === "list" && <div className="relative w-full sm:w-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <GInput placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="!pl-9 !py-1.5 !text-xs w-full sm:w-auto" />
            </div>}
            {pageTab === "list" && (
              <GSel value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="!py-1.5 !text-xs w-full sm:!w-auto">
                <option value="name">Sort: Name</option>
                <option value="dateAdded">Sort: Date Added</option>
                <option value="lastJob">Sort: Last Job</option>
                <option value="totalSpent">Sort: Total Spent</option>
              </GSel>
            )}
            {pageTab === "list" && allCustomerTags.length > 0 && (
              <GSel value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="!py-1.5 !text-xs w-full sm:!w-auto">
                <option value="">All Tags</option>
                {allCustomerTags.map((t: string) => <option key={t} value={t}>{t}</option>)}
              </GSel>
            )}
            {pageTab === "list" && (
              <GSel value={folderFilter} onChange={e => setFolderFilter(e.target.value)} className="!py-1.5 !text-xs w-full sm:!w-auto">
                <option value="">📁 All Folders</option>
                <option value="__unfiled__">Unfiled</option>
                {allFolderPaths.map((f: string) => <option key={f} value={f}>{"—".repeat(folderDepth(f))} 📁 {folderLabel(f)}</option>)}
              </GSel>
            )}
            {pageTab === "list" && (
              <GBtn variant="ghost" onClick={() => setFolderManagerOpen(true)} className="!py-1.5 !text-xs"><Filter size={12} className="inline mr-1.5" />Manage Folders</GBtn>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* FEATURE — bulk-import entry points also respect the plan
                limit now — blocked once already at the cap, same as the
                single Add button. (Importing a batch that would only PARTLY
                exceed the limit still goes through uncapped — mid-import
                truncation isn't built yet, this only blocks starting a new
                import once you're already at the ceiling.) */}
            <GBtn variant="ghost" onClick={() => atCustomerLimit ? setUpgradePromptOpen(true) : setImportOpen("file")}><Download size={14} className="inline mr-1.5 rotate-180" />Import CSV</GBtn>
            <GBtn variant="ghost" onClick={() => atCustomerLimit ? setUpgradePromptOpen(true) : setImportOpen("sheets")}><Download size={14} className="inline mr-1.5 rotate-180" />Sheets / Paste</GBtn>
            <GBtn variant="ghost" onClick={() => atCustomerLimit ? setUpgradePromptOpen(true) : setStripeImportOpen(true)}><CreditCard size={14} className="inline mr-1.5" />Import from Stripe</GBtn>
            <GBtn variant="ghost" onClick={exportCSV}><Download size={14} className="inline mr-1.5" />Export</GBtn>
            <GBtn variant="ghost" onClick={() => setPortalInvitesOpen(true)}><Send size={14} className="inline mr-1.5" />Portal invites</GBtn>
            <GBtn variant={mergeMode ? "danger" : "ghost"} onClick={() => { setMergeMode(!mergeMode); setMergePair([]); }}><UserCheck size={14} className="inline mr-1.5" />{mergeMode ? "Cancel Merge" : "Merge"}</GBtn>
            <GBtn variant={bulkMode ? "danger" : "ghost"} onClick={() => { setBulkMode(!bulkMode); setBulkSelected([]); }}><CheckSquare size={14} className="inline mr-1.5" />{bulkMode ? "Cancel Select" : "Select"}</GBtn>
            <GBtn onClick={openAddCustomer} data-tour="new-customer-btn"><Plus size={14} className="inline mr-1.5" />Add</GBtn>
          </div>
        </div>
      </div>

      {/* AUDIT FIX — drag-and-drop folder assignment. Drag a customer row
          from the list below onto one of these chips to move them into that
          folder; native HTML5 drag/drop, no library. Only shown when at
          least one folder exists so it doesn't clutter a fresh install. */}
      {pageTab === "list" && allFolderPaths.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-1">
          <span className="text-[10px] text-white/30 uppercase tracking-wider mr-1">Drag to file:</span>
          <div
            onDragOver={e => { e.preventDefault(); setDragOverFolder("__unfiled__"); }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={e => { e.preventDefault(); if (draggedCustomerId) moveCustomerToFolder(draggedCustomerId, ""); setDraggedCustomerId(null); setDragOverFolder(null); }}
            className={"text-[10px] px-2 py-1 rounded-full border transition " + (dragOverFolder === "__unfiled__" ? "bg-white/20 border-white/40" : "bg-white/5 border-white/10 text-white/40")}
          >
            Unfiled
          </div>
          {allFolderPaths.map(f => (
            <div
              key={f}
              onDragOver={e => { e.preventDefault(); setDragOverFolder(f); }}
              onDragLeave={() => setDragOverFolder(null)}
              onDrop={e => { e.preventDefault(); if (draggedCustomerId) moveCustomerToFolder(draggedCustomerId, f); setDraggedCustomerId(null); setDragOverFolder(null); }}
              className={"text-[10px] px-2 py-1 rounded-full border transition " + (dragOverFolder === f ? "bg-blue-900/50 border-blue-500/60 text-blue-200" : "bg-blue-950/20 border-blue-700/30 text-blue-300/70")}
              style={{ marginLeft: folderDepth(f) * 8 }}
            >
              📁 {folderLabel(f)}
            </div>
          ))}
        </div>
      )}

      {bulkMode && pageTab === "list" && (
        <Glass className="p-3 !bg-brand-950/15 !border-brand-700/30 flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
            <input type="checkbox" checked={filtered.length > 0 && bulkSelected.length === filtered.length} onChange={toggleBulkAll} className="w-4 h-4 rounded accent-brand-600" />
            Select all ({bulkSelected.length}/{filtered.length})
          </label>
          {bulkSelected.length > 0 && (
            <div className="flex gap-2">
              <GBtn variant="ghost" onClick={() => setBulkSmsOpen(true)} className="!text-xs"><MessageSquare size={12} className="inline mr-1" />Bulk SMS ({bulkSelected.length})</GBtn>
              <GBtn variant="ghost" onClick={downloadSelectedCsv} className="!text-xs"><Download size={12} className="inline mr-1" />Download ({bulkSelected.length})</GBtn>
              <GBtn variant="danger" onClick={deleteSelectedCustomers} className="!text-xs"><Trash2 size={12} className="inline mr-1" />Delete ({bulkSelected.length})</GBtn>
            </div>
          )}
        </Glass>
      )}

      {/* LTV Analytics tab */}
      {pageTab === "analytics" && <CustomerAnalytics customers={customers} jobs={jobs} estimates={estimates} />}

      {pageTab === "map" && <CustomerMapView customers={customers} apiKey={settings.googleMapsKey || (settings as any).mapsKey || ""} geocodingKey={(settings as any).googleGeocodingKey || ""} onViewCustomer={(id: string) => { const c = customers.find((x: any) => x.id === id); if (c) setDetail(c); }} />}

      {/* Duplicates tab */}
      {pageTab === "duplicates" && <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm text-white/60">{dupPairs === null ? "Click Scan to find duplicates" : dupPairs.length === 0 ? "✅ No duplicates found" : dupPairs.length + " potential duplicate" + (dupPairs.length !== 1 ? "s" : "") + " found"}</div>
          <GBtn onClick={scanDuplicates} className="!text-xs"><Search size={12} className="inline mr-1" />Rescan</GBtn>
        </div>
        {dupPairs?.length > 0 && <div className="space-y-3">
          {dupPairs.map((pair, i) => (
            <Glass key={i} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge tone="yellow">{pair.reason}</Badge>
                <div className="flex gap-2">
                  <GBtn onClick={() => openMerge(pair.a, pair.b)} className="!text-xs !py-1">Merge</GBtn>
                  <GBtn variant="ghost" onClick={() => setDupPairs(prev => prev.filter((_, j) => j !== i))} className="!text-xs !py-1">Not a dup</GBtn>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {[pair.a, pair.b].map((c, ci) => (
                  <div key={c.id} className={"p-3 rounded-xl border " + (ci === 0 ? "border-blue-700/40 bg-blue-950/20" : "border-purple-700/40 bg-purple-950/20")}>
                    <div className="font-bold">{c.firstName} {c.lastName}</div>
                    <div className="text-white/60 mt-1 space-y-0.5">
                      {c.phone && <div>📞 {c.phone}</div>}
                      {c.email && <div>📧 {c.email}</div>}
                      {c.address && <div>📍 {c.address.split(",")[0]}</div>}
                      <div className="text-white/40">LTV: {fmt(c.totalSpent || 0)} · Added {c.createdAt}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Glass>
          ))}
        </div>}
      </div>}

      {/* Merge modal */}
      {mergeModal && <Modal open={!!mergeModal} onClose={() => setMergeModal(null)} title="Merge Customers — Choose which info to keep" maxW="max-w-2xl">
        <div className="space-y-3">
          <div className="text-xs text-white/60 mb-2">Click each field to choose which version to keep. Combined LTV and tags are kept from both.</div>
          {[
            { key: "firstName", label: "First Name" }, { key: "lastName", label: "Last Name" },
            { key: "phone", label: "Phone" }, { key: "email", label: "Email" },
            { key: "address", label: "Address" }, { key: "leadSource", label: "Lead Source" },
            { key: "sqFootage", label: "Sq Footage" }, { key: "gateCode", label: "Gate Code" },
            { key: "notes", label: "Notes" }
          ].filter(f => mergeModal.a[f.key] || mergeModal.b[f.key]).map(f => (
            <div key={f.key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:items-center">
              <div className="text-[10px] text-white/50 uppercase tracking-wider">{f.label}</div>
              <div className="grid grid-cols-2 gap-2 sm:contents">
                {["a","b"].map(side => {
                  const c = mergeModal[side];
                  const val = c[f.key];
                  const active = mergeChoices[f.key] === side;
                  return <button key={side} onClick={() => setMergeChoices(prev => ({ ...prev, [f.key]: side }))} className={"p-2.5 rounded-xl border text-left text-xs transition " + (active ? "border-green-500/60 bg-green-950/30 text-green-300" : "border-white/10 bg-black/40 text-white/50 hover:text-white hover:border-white/20") + (!val ? " opacity-30" : "")}>
                    {active && <span className="text-green-400 mr-1">✓</span>}{val || <span className="italic text-white/30">empty</span>}
                  </button>;
                })}
              </div>
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-3 border-t border-brand-900/20">
            <GBtn variant="ghost" onClick={() => setMergeModal(null)}>Cancel</GBtn>
            <GBtn onClick={doMerge}>Merge → Keep Selected Fields</GBtn>
          </div>
        </div>
      </Modal>}

      {/* FEATURE — Bulk SMS confirmation modal. Shows eligible vs excluded
          (opted-out/no-phone) counts up front so the owner isn't surprised
          when the send-result toast reports fewer than the selected count. */}
      {bulkSmsOpen && (
        <Modal open={bulkSmsOpen} onClose={() => { if (!bulkSmsSending) { setBulkSmsOpen(false); setBulkSmsBody(""); } }} title="Bulk SMS" maxW="max-w-lg">
          <div className="space-y-3">
            <div className={"text-xs rounded-lg p-2.5 border " + (bulkSmsExcludedCount > 0 ? "bg-yellow-950/20 border-yellow-700/30 text-yellow-200" : "bg-green-950/20 border-green-700/30 text-green-200")}>
              {bulkSmsEligible.length} of {bulkSmsSelectedCustomers.length} will receive this
              {bulkSmsExcludedCount > 0 && ` — ${bulkSmsExcludedCount} excluded: opted out or no phone`}
            </div>
            <div>
              <textarea
                value={bulkSmsBody}
                onChange={e => setBulkSmsBody(e.target.value)}
                placeholder="Hi {{first_name}}, ..."
                rows={5}
                disabled={bulkSmsSending}
                className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50 resize-none"
              />
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {["first_name", "last_name", "address", "company_name", "company_phone"].map(v => (
                  <button key={v} type="button" disabled={bulkSmsSending} onClick={() => setBulkSmsBody(b => b + " {{" + v + "}}")} className="text-[9px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white">{"{{" + v + "}}"}</button>
                ))}
              </div>
            </div>
            {bulkSmsProgress && (
              <div className="space-y-1">
                <div className="h-2 bg-black/40 rounded-full overflow-hidden">
                  <div className="h-full bg-white/70 transition-all" style={{ width: ((bulkSmsProgress.sent + bulkSmsProgress.failed) / Math.max(bulkSmsProgress.total, 1) * 100) + "%" }} />
                </div>
                <div className="text-[10px] text-white/40 text-right">{bulkSmsProgress.sent + bulkSmsProgress.failed} / {bulkSmsProgress.total} sent{bulkSmsProgress.failed > 0 ? " · " + bulkSmsProgress.failed + " failed" : ""}</div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2 border-t border-brand-900/20">
              <GBtn variant="ghost" disabled={bulkSmsSending} onClick={() => { setBulkSmsOpen(false); setBulkSmsBody(""); }}>Cancel</GBtn>
              <GBtn onClick={sendBulkSms} disabled={bulkSmsSending || !bulkSmsBody.trim() || bulkSmsEligible.length === 0}>
                <Send size={14} className="inline mr-1.5" />{bulkSmsSending ? "Sending…" : `Send to ${bulkSmsEligible.length}`}
              </GBtn>
            </div>
          </div>
        </Modal>
      )}

      {/* AUDIT FIX — full folder management: create, rename, delete, and
          nested ("Parent/Child") organization. Drag-and-drop reassignment
          lives on the list view itself (chips above the table); this modal
          is for structural changes to the folders themselves. */}
      {folderManagerOpen && (
        <Modal open={folderManagerOpen} onClose={() => { setFolderManagerOpen(false); setRenamingFolder(null); }} title="Manage Folders">
          <div className="space-y-4 w-full">
            <div className="flex flex-col sm:flex-row gap-2">
              <GSel value={newFolderParent} onChange={e => setNewFolderParent(e.target.value)} className="!text-xs sm:!w-36 flex-shrink-0">
                <option value="">Top level</option>
                {allFolderPaths.map(f => <option key={f} value={f}>{"—".repeat(folderDepth(f))} {folderLabel(f)}</option>)}
              </GSel>
              <input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createFolder()}
                placeholder="New folder name"
                className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-brand-500/50"
              />
              <GBtn onClick={createFolder} disabled={!newFolderName.trim()} className="!text-xs flex-shrink-0"><Plus size={12} className="inline mr-1" />Add</GBtn>
            </div>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {allFolderPaths.length === 0 && <div className="text-center text-xs text-white/40 py-6">No folders yet — add one above.</div>}
              {allFolderPaths.map(f => (
                <div key={f} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/5" style={{ marginLeft: folderDepth(f) * 16 }}>
                  {renamingFolder === f ? (
                    <>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") renameFolder(f, renameValue); if (e.key === "Escape") setRenamingFolder(null); }}
                        className="flex-1 bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                      />
                      <button onClick={() => renameFolder(f, renameValue)} className="text-[10px] px-2 py-1 rounded-lg bg-green-900/40 text-green-300 hover:bg-green-800/50">Save</button>
                      <button onClick={() => setRenamingFolder(null)} className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-white/50 hover:text-white">Cancel</button>
                    </>
                  ) : (
                    <>
                      <span className="text-xs flex-1 min-w-0 truncate">📁 {folderLabel(f)} <span className="text-white/30">({folderCustomerCount(f)})</span></span>
                      <button onClick={() => { setRenamingFolder(f); setRenameValue(folderLabel(f)); }} className="p-1.5 text-white/40 hover:text-white flex-shrink-0" title="Rename"><Edit size={12} /></button>
                      <button onClick={() => deleteFolder(f)} className="p-1.5 text-white/40 hover:text-danger-400 flex-shrink-0" title="Delete"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="text-[10px] text-white/30 pt-2 border-t border-white/10">Tip: pick a parent above to nest a folder inside another (e.g. "Commercial" → "Restaurants"). Deleting a folder unfiles its customers — it never deletes them.</div>
          </div>
        </Modal>
      )}

      {pageTab === "list" && <>
      {mergeMode && <Glass className="p-3 !bg-yellow-950/20 !border-yellow-700/40">
        <div className="flex items-center justify-between">
          <div className="text-sm text-yellow-300">Select 2 customers to merge ({mergePair.length}/2)</div>
          {mergePair.length === 2 && <GBtn onClick={doSimpleMerge} className="!py-1 !text-xs"><UserCheck size={12} className="inline mr-1" />Merge Now</GBtn>}
        </div>
      </Glass>}

      {/* Mobile: stacked cards (no horizontal scroll needed to reach actions) */}
      <div className="sm:hidden space-y-2">
        {filtered.map(c => {
          const sel = mergePair.includes(c.id);
          return (
            <Glass key={c.id} data-customer-id={c.id} className={"p-3 transition-shadow " + (sel ? "!bg-yellow-950/20" : "") + (draggedCustomerId === c.id ? " opacity-40" : "") + spotlightCls(c.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  {mergeMode && <input type="checkbox" checked={sel} onChange={() => toggleMerge(c.id)} className="w-4 h-4 mt-1 accent-brand-600 shrink-0" />}
                  {bulkMode && <input type="checkbox" checked={bulkSelected.includes(c.id)} onChange={() => toggleBulk(c.id)} className="w-4 h-4 mt-1 rounded accent-brand-600 shrink-0" />}
                  <div className="min-w-0 cursor-pointer" onClick={() => !mergeMode && !bulkMode && setDetail(c)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium truncate">{c.firstName} {c.lastName}</div>
                      {c.hasDog && <span title={"Dog: " + c.dogName} className="text-[10px]">🐕</span>}
                      {c.gateCode && <span title={"Gate: " + c.gateCode} className="text-[10px]">🔒</span>}
                      {c.folder && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-950/40 border border-blue-700/40 text-blue-300">📁 {c.folder}</span>}
                    </div>
                    <div className="text-xs text-white/50 truncate">{c.email}</div>
                    {c.phone && <div className="text-xs text-white/50 truncate">{c.phone}</div>}
                  </div>
                </div>
                <div className="font-semibold text-brand-400 text-right shrink-0 cursor-pointer" onClick={() => !mergeMode && !bulkMode && setDetail(c)}>{fmt(c.totalSpent)}</div>
              </div>
              <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-white/10">
                <button onClick={() => quickAction("call", c)} className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400 transition"><Phone size={14} /></button>
                <button onClick={() => quickAction("text", c)} className="p-1.5 rounded-lg hover:bg-blue-900/30 text-white/60 hover:text-blue-400 transition"><MessageSquare size={14} /></button>
                <button onClick={() => window.open("https://maps.google.com/?q=" + encodeURIComponent(c.address || ""), "_blank")} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition" title="Directions"><MapPin size={14} /></button>
                <button onClick={() => { const lastJob = jobs.filter(j => j.customerId === c.id && j.status === "completed").slice(-1)[0]; if (lastJob) { toast("Review request queued for " + c.firstName); } else { toast("No completed jobs for " + c.firstName, "error"); }}} className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/60 hover:text-yellow-400 transition" title="Send review request"><Star size={14} /></button>
                <button onClick={() => setModal({ open: true, data: c })} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"><Edit size={14} /></button>
              </div>
            </Glass>
          );
        })}
      </div>

      {/* Desktop/tablet: table */}
      <Glass className="overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-900/30 bg-black/40">
                {mergeMode && <th className="px-4 py-3"></th>}
                {bulkMode && <th className="px-4 py-3"></th>}
                <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Name</th>
                <th className="text-left px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider hidden lg:table-cell">Phone</th>
                <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Spent</th>
                <th className="text-right px-5 py-3 font-medium text-white/60 text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const sel = mergePair.includes(c.id);
                return (
                  <tr key={c.id}
                    data-customer-id={c.id}
                    draggable={!mergeMode && !bulkMode}
                    onDragStart={() => setDraggedCustomerId(c.id)}
                    onDragEnd={() => setDraggedCustomerId(null)}
                    className={"border-b border-brand-900/10 hover:bg-white/5 transition " + (sel ? "bg-yellow-950/20" : "") + (draggedCustomerId === c.id ? " opacity-40" : "") + (highlightId === c.id ? " ring-2 ring-inset ring-brand-500 shadow-[0_0_25px_rgba(255,255,255,0.5)]" : "")}>
                    {mergeMode && <td className="px-4 py-4"><input type="checkbox" checked={sel} onChange={() => toggleMerge(c.id)} className="w-4 h-4 accent-brand-600" /></td>}
                    {bulkMode && <td className="px-4 py-4"><input type="checkbox" checked={bulkSelected.includes(c.id)} onChange={() => toggleBulk(c.id)} className="w-4 h-4 rounded accent-brand-600" /></td>}
                    <td className="px-5 py-4 cursor-pointer" onClick={() => !mergeMode && !bulkMode && setDetail(c)}>
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{c.firstName} {c.lastName}</div>
                        {c.hasDog && <span title={"Dog: " + c.dogName} className="text-[10px]">🐕</span>}
                        {c.gateCode && <span title={"Gate: " + c.gateCode} className="text-[10px]">🔒</span>}
                        {c.folder && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-950/40 border border-blue-700/40 text-blue-300">📁 {c.folder}</span>}
                      </div>
                      <div className="text-xs text-white/50">{c.email}</div>
                    </td>
                    <td className="px-5 py-4 text-white/70 hidden lg:table-cell cursor-pointer" onClick={() => !mergeMode && !bulkMode && setDetail(c)}>{c.phone}</td>
                    <td className="px-5 py-4 text-right font-semibold text-brand-400 cursor-pointer" onClick={() => !mergeMode && !bulkMode && setDetail(c)}>{fmt(c.totalSpent)}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => quickAction("call", c)} className="p-1.5 rounded-lg hover:bg-green-900/30 text-white/60 hover:text-green-400 transition"><Phone size={14} /></button>
                        <button onClick={() => quickAction("text", c)} className="p-1.5 rounded-lg hover:bg-blue-900/30 text-white/60 hover:text-blue-400 transition"><MessageSquare size={14} /></button>
                        <button onClick={() => window.open("https://maps.google.com/?q=" + encodeURIComponent(c.address || ""), "_blank")} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition" title="Directions"><MapPin size={14} /></button>
                        <button onClick={() => { const lastJob = jobs.filter(j => j.customerId === c.id && j.status === "completed").slice(-1)[0]; if (lastJob) { toast("Review request queued for " + c.firstName); } else { toast("No completed jobs for " + c.firstName, "error"); }}} className="p-1.5 rounded-lg hover:bg-yellow-900/30 text-white/60 hover:text-yellow-400 transition" title="Send review request"><Star size={14} /></button>
                        <button onClick={() => setModal({ open: true, data: c })} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition"><Edit size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Glass>

      <CustomerModal open={modal.open} onClose={() => setModal({ open: false, data: null })} data={modal.data} onSave={save} mapsKey={settings.googleMapsKey || (settings as any).mapsKey || ""} customers={customers} />
      <ImportDataModal open={!!importOpen} initialTab={importOpen || "file"} onClose={() => setImportOpen(false)} title="Import Customers" fieldMap={CUSTOMER_FIELD_MAP} fieldLabels={CUSTOMER_FIELD_LABELS} fieldExclude={CUSTOMER_FIELD_EXCLUDE} onImport={handleCustomerImport} toast={toast}
        reviewExtras={(rows) => {
          const statusLeads = rows.filter(r => rowToCustomer(r, { leadsFromStatus: true })?.pipelineStage === "lead").length;
          return (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="text-xs font-semibold">Import these as</div>
              <div className="flex flex-wrap gap-1.5">
                {([["customers", "Customers"], ["leads", "Leads (Lead Intake)"], ["status", "Use the Status column"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setImportAs(k)} className={"px-3 py-1.5 rounded-lg text-xs border transition " + (importAs === k ? "bg-brand-700/40 border-brand-600/60 text-white" : "border-white/10 text-white/60 hover:text-white")}>{l}</button>
                ))}
              </div>
              <div className="text-[11px] text-white/45">
                {importAs === "customers" ? "Everyone goes into Customers. Nobody is put in Lead Intake."
                  : importAs === "leads" ? "Everyone new goes into Lead Intake. Existing customers that match stay customers."
                  : `${statusLeads} row(s) have a Status of Lead / Prospect and go to Lead Intake; the rest are customers.`}
              </div>
            </div>
          );
        }}
        note={"Matching customers (same email, phone, or name) get their missing details filled in instead of being duplicated." + (planLimits?.customers != null ? ` Limit: ${planLimits.customers.toLocaleString()} customers (you have ${customers.length.toLocaleString()}).` : "")} />
      <PortalInvitesModal open={portalInvitesOpen} onClose={() => setPortalInvitesOpen(false)} customers={customers} settings={settings} setSettings={setSettings} toast={toast} />
      <ImportStripeCustomersModal open={stripeImportOpen} onClose={() => setStripeImportOpen(false)} customers={customers} setCustomers={setCustomers} toast={toast} />
      <CustomerDetail customer={detail} onClose={() => setDetail(null)} onDelete={deleteCustomer} onEdit={(cust: any) => { setDetail(null); setModal({ open: true, data: cust }); }} estimates={estimates} jobs={jobs} employees={employees} timeline={timeline} setTimeline={setTimeline} settings={settings} toast={toast} setCustomers={setCustomers} onOpenEstimate={(estId: string, label?: string) => {
        setDetail(null);
        const est = estimates.find((e: any) => e.id === estId);
        onSpotlight(est?.invoiced ? { page: "invoices", type: "invoice", id: estId, label } : { page: "estimates", type: "estimate", id: estId, label });
      }} />
      </>}
    </div>
  );
}

// ===== CUSTOMER LTV ANALYTICS =====
