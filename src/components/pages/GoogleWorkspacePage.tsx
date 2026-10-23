import React, { useState, useEffect, useCallback } from "react";
import {
  Mail, Calendar, CheckSquare, Users, Cloud, Globe,
  Loader, RefreshCw, Plus, Send, X, AlertCircle,
  ExternalLink, Activity, UserPlus, CheckCircle, Reply,
  Trash2,
} from "lucide-react";
import type { AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { supabase, getStoredGoogleConnection, setStoredGoogleToken, clearStoredGoogleConnection } from "../../lib/supabase";
import { uid, withTimeout, rememberOAuthReturnPage } from "../../lib/utils";
import { rowToCustomer, mergeImportedCustomers, saveCustomersTolerant } from "../../lib/customerImport";
import { CUSTOMER_LIMIT } from "../../lib/planLimits";
import {
  fetchGmailMessages, sendGmailMessage, markGmailRead,
  fetchCalendarEvents, fetchGTasks, createGTask, patchGTask, deleteGTask,
  fetchGContacts, fetchGDriveFiles,
  setGoogleTokenRefresher, refreshEmpGoogleToken, onGoogleAuthFailure,
  type GmailMessage, type GCalEvent, type GTask, type GContact, type GDriveFile, getLastGoogleRefreshError } from "../../lib/googleApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const fmtTime = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

// ─── Shared sub-components ────────────────────────────────────────────────────
const Spinner = () => (
  <div className="flex justify-center py-10">
    <Loader size={20} className="text-blue-400 animate-spin" />
  </div>
);

const ApiError = ({ msg, onRetry, apiName }: { msg: string; onRetry?: () => void; apiName?: string }) => {
  const is403 = msg.includes("403");
  const is401 = msg.includes("401");

  const apiLinks: Record<string, string> = {
    "People API": "https://console.developers.google.com/apis/api/people.googleapis.com",
    "Drive API": "https://console.developers.google.com/apis/api/drive.googleapis.com",
    "Calendar API": "https://console.developers.google.com/apis/api/calendar-json.googleapis.com",
    "Gmail API": "https://console.developers.google.com/apis/api/gmail.googleapis.com",
    "Tasks API": "https://console.developers.google.com/apis/api/tasks.googleapis.com",
  };

  return (
    <Glass className={"p-4 " + (is403 ? "!bg-yellow-950/20 !border-yellow-700/30" : "!bg-brand-950/20 !border-brand-700/30")}>
      <div className="flex items-start gap-3">
        <AlertCircle size={15} className={is403 ? "text-yellow-400 flex-shrink-0 mt-0.5" : "text-danger-400 flex-shrink-0 mt-0.5"} />
        <div className="flex-1 min-w-0">
          <div className={"text-sm " + (is403 ? "text-yellow-300" : "text-brand-300")}>{msg}</div>
          {is403 && apiName && (
            <div className="text-xs text-white/60 mt-1.5 space-y-1">
              <div>{apiName} is not enabled in your Google Cloud project.</div>
              <a
                href={apiLinks[apiName]}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 transition"
              >
                <ExternalLink size={11} />Enable {apiName} in Google Cloud Console
              </a>
              <div className="text-white/40">After enabling, click Retry below.</div>
            </div>
          )}
          {is401 && (
            <div className="text-xs text-white/50 mt-1">
              Your Google token has expired. Disconnect Google then reconnect to get a fresh token.
            </div>
          )}
        </div>
        {onRetry && (
          <button onClick={onRetry} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 flex-shrink-0 transition">
            <RefreshCw size={11} />Retry
          </button>
        )}
      </div>
    </Glass>
  );
};

// ─── Gmail tab ────────────────────────────────────────────────────────────────
function GmailTab({
  token,
  googleEmail,
  toast,
  customers,
  setCustomers,
}: {
  token: string;
  googleEmail?: string;
  toast?: any;
  customers?: any[];
  setCustomers?: any;
}) {
  const [messages, setMessages] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setMessages(await fetchGmailMessages(token)); }
    catch (e: any) { setError(e.message || "Failed to load Gmail"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!to || !subject || !body) return;
    setSending(true);
    try {
      await sendGmailMessage(token, to, subject, body, googleEmail);
      toast?.("Email sent!", "green");
      setComposing(false); setTo(""); setSubject(""); setBody("");
    } catch (e: any) { toast?.(e.message || "Send failed", "red"); }
    finally { setSending(false); }
  };

  const toggle = async (m: GmailMessage) => {
    setExpanded(expanded === m.id ? null : m.id);
    if (!m.read) {
      await markGmailRead(token, m.id).catch(() => {});
      setMessages(prev => prev.map(x => x.id === m.id ? { ...x, read: true } : x));
    }
  };

  const convertToLead = (m: GmailMessage) => {
    setConverting(m.id);
    try {
      // Parse name and email from the From header (e.g. "John Doe <john@example.com>")
      const fromRaw = m.from.trim();
      const emailMatch = fromRaw.match(/<([^>]+)>/);
      const email = emailMatch ? emailMatch[1] : (fromRaw.includes("@") ? fromRaw : "");
      const namePart = emailMatch ? fromRaw.replace(/<[^>]+>/, "").trim().replace(/^"|"$/g, "") : "";
      const nameParts = namePart.split(" ").filter(Boolean);
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Check for existing customer by email
      const existing = email ? (customers || []).find((c: any) => c.email === email) : null;

      if (!existing) {
        const newCustomer = {
          id: uid(),
          firstName,
          lastName,
          email,
          phone: "",
          address: "",
          tags: [],
          totalSpent: 0,
          notes: `Lead from email: "${m.subject}"`,
          leadSource: "Email",
          source: "gmail",
          createdAt: new Date().toISOString().slice(0, 10),
        };
        setCustomers?.((prev: any[]) => [...prev, newCustomer]);
        toast?.(`Lead created: ${firstName} ${lastName}`, "green");
      } else {
        toast?.(`Customer already exists — ${existing.firstName} ${existing.lastName}`, "green");
      }
    } catch {
      toast?.("Failed to create lead", "red");
    } finally {
      setConverting(null);
    }
  };

  const inputCls = "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <span className="text-xs text-white/30">{messages.length} messages</span>
        <div className="flex-1" />
        <button
          onClick={() => setComposing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 rounded-xl text-xs font-medium text-white transition"
        >
          <Plus size={12} />Compose
        </button>
      </div>

      {error && <ApiError msg={error} onRetry={load} apiName="Gmail API" />}
      {loading ? <Spinner /> : messages.length === 0 ? (
        <Glass className="p-8 text-center text-sm text-white/40">Inbox is empty</Glass>
      ) : (
        <div className="space-y-1">
          {messages.map(m => (
            <div key={m.id} className={"w-full text-left p-3 rounded-xl border transition " +
              (expanded === m.id
                ? "bg-blue-950/30 border-blue-700/30"
                : "bg-black/40 border-white/5 hover:border-white/10")}>
              <button
                className="w-full text-left"
                onClick={() => toggle(m)}
              >
                <div className="flex items-start gap-3">
                  <div className={"w-2 h-2 rounded-full mt-1.5 flex-shrink-0 " + (m.read ? "bg-white/15" : "bg-blue-400")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={"text-sm truncate " + (m.read ? "text-white/60" : "text-white font-medium")}>
                        {m.from.replace(/<[^>]+>/, "").trim() || m.from}
                      </span>
                      <span className="text-[11px] text-white/30 flex-shrink-0 ml-auto">{fmtDate(m.date)}</span>
                    </div>
                    <div className={"text-xs truncate " + (m.read ? "text-white/40" : "text-white/70")}>{m.subject}</div>
                    {expanded !== m.id && (
                      <div className="text-xs text-white/25 truncate">{m.snippet}</div>
                    )}
                  </div>
                </div>
              </button>
              {expanded === m.id && (
                <div className="mt-2 space-y-2 pl-5">
                  <div className="text-xs text-white/60 bg-black/40 rounded-lg p-3 leading-relaxed">
                    {m.snippet}
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => { setComposing(true); setTo(m.from); setSubject("Re: " + m.subject); }}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                    >
                      <Reply size={11} />Reply
                    </button>
                    <a
                      href={`https://mail.google.com/mail/#inbox/${m.threadId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-white/30 hover:text-white flex items-center gap-1 transition"
                    >
                      <ExternalLink size={11} />Open in Gmail
                    </a>
                    <button
                      onClick={() => convertToLead(m)}
                      disabled={converting === m.id}
                      className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 transition disabled:opacity-50"
                    >
                      {converting === m.id
                        ? <Loader size={11} className="animate-spin" />
                        : <UserPlus size={11} />}
                      Convert to Lead
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Compose modal */}
      {composing && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setComposing(false)} />
          <Glass className="relative w-full max-w-md p-4 space-y-3 z-10 !border-blue-700/30">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">New Message</div>
              <button onClick={() => setComposing(false)} className="text-white/40 hover:text-white transition">
                <X size={15} />
              </button>
            </div>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="To" className={inputCls} />
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject" className={inputCls} />
            <textarea
              value={body} onChange={e => setBody(e.target.value)}
              placeholder="Message…" rows={6}
              className={inputCls + " resize-none"}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setComposing(false)} className="px-3 py-1.5 text-xs text-white/50 hover:text-white transition">
                Cancel
              </button>
              <button
                onClick={send}
                disabled={sending || !to || !subject || !body}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl text-xs font-medium text-white transition"
              >
                {sending ? <Loader size={11} className="animate-spin" /> : <Send size={11} />}
                Send
              </button>
            </div>
          </Glass>
        </div>
      )}
    </div>
  );
}

// ─── Calendar tab ─────────────────────────────────────────────────────────────
function GCalTab({ token }: { token: string }) {
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await fetchCalendarEvents(token);
      setEvents(result);
    } catch (e: any) {
      console.error("[GoogleCalendar] fetch error:", e);
      setError(e.message || "Failed to load calendar");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <div className="flex-1" />
        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
        >
          <ExternalLink size={11} />Open Google Calendar
        </a>
      </div>
      {error && <ApiError msg={error} onRetry={load} apiName="Calendar API" />}
      {loading ? <Spinner /> : error ? null : events.length === 0 ? (
        <Glass className="p-8 text-center text-sm text-white/40">No upcoming events in the next 60 days</Glass>
      ) : (
        <div className="space-y-2">
          {events.map(ev => (
            <Glass key={ev.id} className="p-3 !bg-blue-950/20 !border-blue-700/20">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{ev.title}</div>
                  <div className="text-xs text-blue-300/70 mt-0.5">
                    {fmtDate(ev.start)} · {fmtTime(ev.start)}{ev.end ? " – " + fmtTime(ev.end) : ""}
                  </div>
                  {ev.location && (
                    <div className="text-xs text-white/40 mt-0.5 truncate">📍 {ev.location}</div>
                  )}
                  {ev.description && (
                    <div className="text-xs text-white/30 mt-0.5 truncate">{ev.description}</div>
                  )}
                </div>
                {ev.htmlLink && (
                  <a
                    href={ev.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/20 hover:text-blue-400 flex-shrink-0 transition"
                  >
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </Glass>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tasks tab ────────────────────────────────────────────────────────────────
function GTasksTab({ token, toast }: { token: string; toast?: any }) {
  const [tasks, setTasks] = useState<GTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setTasks(await fetchGTasks(token)); }
    catch (e: any) { setError(e.message || "Failed to load tasks"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const addTask = async () => {
    const listId = tasks.find(t => t.listId)?.listId;
    if (!newTitle.trim() || !listId) { toast?.("No task list found", "red"); return; }
    try {
      const t = await createGTask(token, listId, { title: newTitle, due: newDue || undefined });
      setTasks(prev => [t, ...prev]);
      setNewTitle(""); setNewDue(""); setAdding(false);
      toast?.("Task created", "green");
    } catch (e: any) { toast?.(e.message, "red"); }
  };

  const toggle = async (t: GTask) => {
    const next = t.status === "completed" ? "needsAction" : "completed";
    try {
      await patchGTask(token, t.listId, t.id, { status: next });
      setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: next } : x));
    } catch (e: any) { toast?.(e.message, "red"); }
  };

  const removeTask = async (t: GTask) => {
    setDeleting(t.id);
    try {
      await deleteGTask(token, t.listId, t.id);
      setTasks(prev => prev.filter(x => x.id !== t.id));
      toast?.("Task deleted", "green");
    } catch (e: any) {
      toast?.(e.message || "Delete failed", "red");
    } finally {
      setDeleting(null);
    }
  };

  const pending = tasks.filter(t => t.status === "needsAction");
  const done = tasks.filter(t => t.status === "completed");
  const inputCls = "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <span className="text-xs text-white/30">{pending.length} pending</span>
        <div className="flex-1" />
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 rounded-xl text-xs font-medium text-white transition"
        >
          <Plus size={12} />New Task
        </button>
      </div>

      {adding && (
        <Glass className="p-3 space-y-2 !border-blue-700/30">
          <input
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            placeholder="Task title…" autoFocus className={inputCls}
          />
          <div className="flex gap-2">
            <input
              type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
              className={inputCls + " flex-1"}
            />
            <button
              onClick={addTask}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs text-white transition"
            >
              Add
            </button>
            <button
              onClick={() => { setAdding(false); setNewTitle(""); setNewDue(""); }}
              className="px-3 py-1.5 text-xs text-white/40 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </Glass>
      )}

      {error && <ApiError msg={error} onRetry={load} apiName="Tasks API" />}
      {loading ? <Spinner /> : (
        <div className="space-y-1">
          {pending.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 bg-black/40 border border-white/5 hover:border-white/10 rounded-xl transition group"
            >
              <button onClick={() => toggle(t)} className="w-4 h-4 rounded-full border-2 border-blue-500/50 group-hover:border-blue-400 flex-shrink-0 transition" />
              <div className="min-w-0 flex-1 text-left" onClick={() => toggle(t)} style={{ cursor: "pointer" }}>
                <div className="text-sm text-white">{t.title}</div>
                {t.due && <div className="text-xs text-white/40">{fmtDate(t.due)}</div>}
              </div>
              {t.listTitle && (
                <span className="text-[10px] text-blue-400/60 bg-blue-950/30 px-2 py-0.5 rounded-full flex-shrink-0">
                  {t.listTitle}
                </span>
              )}
              <button
                onClick={() => removeTask(t)}
                disabled={deleting === t.id}
                className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-brand-400 flex-shrink-0 transition"
                title="Delete task"
              >
                {deleting === t.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
              </button>
            </div>
          ))}

          {done.length > 0 && (
            <>
              <div className="text-[10px] text-white/25 uppercase tracking-wider pt-2 pb-1 px-1">Completed</div>
              {done.slice(0, 5).map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 p-3 bg-black/20 border border-white/5 rounded-xl opacity-40 hover:opacity-60 transition group"
                >
                  <button onClick={() => toggle(t)} className="w-4 h-4 rounded-full bg-blue-500/40 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                  </button>
                  <div className="text-sm text-white line-through flex-1 min-w-0">{t.title}</div>
                  <button
                    onClick={() => removeTask(t)}
                    disabled={deleting === t.id}
                    className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-brand-400 flex-shrink-0 transition"
                  >
                    {deleting === t.id ? <Loader size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  </button>
                </div>
              ))}
            </>
          )}

          {tasks.length === 0 && (
            <Glass className="p-8 text-center text-sm text-white/40">No tasks found</Glass>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Contacts tab ─────────────────────────────────────────────────────────────
function GContactsTab({
  token, customers, setCustomers, toast,
}: {
  token: string; customers: any[]; setCustomers: any; toast?: any;
}) {
  const [contacts, setContacts] = useState<GContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [imported, setImported] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setContacts(await fetchGContacts(token)); }
    catch (e: any) { setError(e.message || "Failed to load contacts"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const importContact = (c: GContact) => {
    // Same customer builder and duplicate check as the CSV import: company is
    // kept, the source is recorded as the lead source, and a contact that
    // matches an existing customer fills in that customer instead of
    // creating a duplicate. (The old version also wrote a "source" field and
    // empty city/state/zip, columns the database doesn't have, which failed
    // the save.)
    const cust = rowToCustomer({ fullName: c.name || "", email: c.email || "", phone: c.phone || "", company: c.company || "", leadSource: "Google Contacts" });
    if (!cust) { toast?.("That contact has no name, email or phone to import", "red"); return; }
    let res: any = null;
    setCustomers?.((prev: any[]) => { res = mergeImportedCustomers(prev, [cust], CUSTOMER_LIMIT); return res.next; });
    setTimeout(() => {
      if (!res) return;
      const changed = [...res.added, ...res.updated];
      if (res.skippedOverLimit) { toast?.(`Customer limit reached (${CUSTOMER_LIMIT.toLocaleString()})`, "red"); return; }
      saveCustomersTolerant(changed).then(r => {
        if (r.failed) toast?.("Imported locally, but failed to sync — " + r.error, "red");
        else toast?.(res.updated.length ? `Updated ${c.name} with this contact's details` : `Imported ${c.name}`, "green");
      });
      setImported(prev => new Set([...prev, c.id]));
    }, 0);
  };

  const q = search.toLowerCase();
  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(q) ||
    (c.email || "").toLowerCase().includes(q) ||
    (c.phone || "").includes(search)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search contacts…"
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
        />
      </div>
      {error && <ApiError msg={error} onRetry={load} apiName="People API" />}
      {loading ? <Spinner /> : (
        <div className="space-y-1">
          {filtered.slice(0, 60).map(c => {
            const inCrm = imported.has(c.id) ||
              (!!c.email && customers.some(cu => cu.email === c.email));
            return (
              <Glass key={c.id} className="p-3 flex items-center gap-3 !bg-black/40">
                <div className="w-8 h-8 rounded-full bg-blue-950/50 border border-blue-700/30 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-white/40 truncate">
                    {[c.email, c.phone, c.company].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {inCrm ? (
                  <span className="text-[11px] text-green-400/70 flex items-center gap-1 flex-shrink-0">
                    <CheckCircle size={11} />In CRM
                  </span>
                ) : (
                  <button
                    onClick={() => importContact(c)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 flex-shrink-0 transition"
                  >
                    <UserPlus size={11} />Import
                  </button>
                )}
              </Glass>
            );
          })}
          {filtered.length === 0 && (
            <Glass className="p-8 text-center text-sm text-white/40">No contacts found</Glass>
          )}
          {filtered.length > 60 && (
            <div className="text-xs text-center text-white/30 py-2">
              Showing 60 of {filtered.length} — use search to narrow results
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Drive tab ────────────────────────────────────────────────────────────────
function GDriveTab({ token }: { token: string }) {
  const [files, setFiles] = useState<GDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setFiles(await fetchGDriveFiles(token)); }
    catch (e: any) { setError(e.message || "Failed to load Drive"); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const fileIcon = (mime: string) => {
    if (mime.includes("folder")) return "📁";
    if (mime.includes("pdf")) return "📄";
    if (mime.includes("spreadsheet") || mime.includes("excel")) return "📊";
    if (mime.includes("document") || mime.includes("word")) return "📝";
    if (mime.includes("presentation") || mime.includes("powerpoint")) return "📑";
    if (mime.includes("image")) return "🖼️";
    if (mime.includes("video")) return "🎬";
    return "📎";
  };

  const fmtSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes > 1_048_576) return (bytes / 1_048_576).toFixed(1) + " MB";
    if (bytes > 1_024) return Math.round(bytes / 1_024) + " KB";
    return bytes + " B";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={load} className="p-1.5 text-white/30 hover:text-white transition" title="Refresh">
          <RefreshCw size={13} />
        </button>
        <span className="text-xs text-white/30">{files.length} files</span>
        <div className="flex-1" />
        <a
          href="https://drive.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
        >
          <ExternalLink size={11} />Open Drive
        </a>
      </div>
      {error && <ApiError msg={error} onRetry={load} apiName="Drive API" />}
      {loading ? <Spinner /> : files.length === 0 ? (
        <Glass className="p-6 text-center space-y-2 !bg-black/40">
          <div className="text-sm text-white/40">No files found</div>
          <div className="text-xs text-white/25">
            Drive shows files shared with or created by this app.{" "}
            If you see this unexpectedly, ensure the Drive API is enabled and re-authorize Google.
          </div>
        </Glass>
      ) : (
        <div className="space-y-1">
          {files.map(f => (
            <Glass key={f.id} className="p-3 flex items-center gap-3 !bg-black/40">
              <span className="text-lg flex-shrink-0">{fileIcon(f.mimeType)}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">{f.name}</div>
                <div className="text-xs text-white/30">
                  {[fmtSize(f.size), f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : ""].filter(Boolean).join(" · ")}
                </div>
              </div>
              {f.webViewLink && f.webViewLink !== "#" && (
                <a
                  href={f.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/20 hover:text-blue-400 flex-shrink-0 transition"
                >
                  <ExternalLink size={13} />
                </a>
              )}
            </Glass>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Connect prompt ───────────────────────────────────────────────────────────
const GoogleLogo = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 48 48" width={size} height={size}>
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
);

// ─── Main component ───────────────────────────────────────────────────────────
export function GoogleWorkspacePage({
  settings = {} as AppSettings,
  setSettings,
  googleData = {},
  setGoogleData,
  customers = [],
  setCustomers,
  jobs = [],
  toast,
  onNav,
}: {
  settings?: AppSettings;
  setSettings?: any;
  googleData?: any;
  setGoogleData?: any;
  customers?: any[];
  setCustomers?: any;
  jobs?: any[];
  toast?: any;
  onNav?: any;
}) {
  const [tab, setTab] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const autoRefreshTried = React.useRef(false);

  const s = settings as any;
  // GoogleConnect — this page had its OWN parallel copy of "is Google
  // connected," reading settings.googleConnected/googleProviderToken
  // straight from React state/props. That's exactly the path several
  // rounds of fixes on Settings → Integrations moved AWAY from in favor of
  // getStoredGoogleConnection() (localStorage, written synchronously the
  // instant the OAuth hash is seen — see lib/supabase.ts) — Settings and
  // this page were reading two different sources of truth, so Settings
  // could correctly show "Connected" while this page still showed "Not
  // connected". `settings`-derived fields are kept only as a fallback for a
  // connection made before this mechanism existed.
  const [storedGoogle, setStoredGoogle] = useState(() => getStoredGoogleConnection());
  useEffect(() => {
    const refresh = () => {
      const stored = getStoredGoogleConnection();
      console.log("[GoogleConnect] GoogleWorkspacePage — localStorage check — connected:", !!stored, stored?.email ? "· email: " + stored.email : "");
      setStoredGoogle(stored);
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  const isConnected = !!(storedGoogle?.token || (s.googleConnected && s.googleProviderToken));
  const googleEmail: string = storedGoogle?.email || s.googleEmail || "";
  const token: string = storedGoogle?.token || s.googleProviderToken || "";
  const hasToken = !!token;
  // GoogleConnect ask #6 (audit) — one clear, single-source log for "which
  // account is Workspace actually showing right now," since every tab below
  // (Gmail/Calendar/Tasks/Contacts/Drive) reads this same `token`/`googleEmail`
  // pair. If this ever logs an employee's email, the leak is upstream of this
  // page (the owner's stored connection or settings.googleProviderToken
  // itself got overwritten) — see the BUG FIX comments in App.tsx's
  // TOKEN_REFRESHED handler and this file's getRefreshedGoogleToken.
  useEffect(() => {
    console.log("[GoogleConnect] Owner Workspace page — account in use:", googleEmail || "(none)", "· connected:", isConnected, "· token source:", storedGoogle?.token ? "localStorage (this browser's own OAuth)" : s.googleProviderToken ? "settings.googleProviderToken (cross-device/cloud)" : "none");
  }, [googleEmail, isConnected, storedGoogle?.token, s.googleProviderToken]);

  // BLOCKER 3 (mobile round 7) — core refresh logic shared by the manual
  // "Refresh" button, the once-per-load auto-refresh, AND the module-level
  // refresher gFetch calls on a live 401. Tries the real Google refresh_token
  // exchange first (functions/api/google-refresh.ts) and only falls back to
  // Supabase's session refresh — which its own comments elsewhere note is
  // unreliable (it re-fetches the Supabase JWT, not a fresh Google token) —
  // when no refresh_token is on file. Previously the registered
  // setGoogleTokenRefresher (used by every in-session Calendar/Drive/Gmail
  // 401) used ONLY the weak Supabase path, so "Settings shows Connected but
  // Gmail returns 401" never actually got fixed by anything running mid-session.
  const getRefreshedGoogleToken = useCallback(async (): Promise<string | null> => {
    const refreshToken = storedGoogle?.refreshToken || s.googleRefreshToken;
    if (refreshToken) {
      // SECURITY FIX — storedGoogle.refreshToken (this browser's own local
      // OAuth capture) still refreshes directly as before; s.googleRefreshToken
      // (the shared, now-masked owner slot) refreshes via the owner-slot
      // session path instead, which resolves the real token server-side.
      const refreshed = await refreshEmpGoogleToken(s.googleBackendUrl, refreshToken, !storedGoogle?.refreshToken);
      if (refreshed?.token) {
        console.log("[GoogleConnect] GoogleWorkspacePage — OWNER token refreshed via refresh_token exchange, saving to localStorage");
        setStoredGoogleToken(refreshed.token, refreshed.expiresAt);
        setStoredGoogle(getStoredGoogleConnection());
        setSettings?.((prev: any) => ({ ...prev, googleProviderToken: refreshed.token, googleTokenExpiresAt: refreshed.expiresAt }));
        return refreshed.token;
      }
    }
    // BUG FIX (Google accounts mixed up, round 2) — this used to fall back to
    // supabase.auth.refreshSession()'s ambient session.provider_token, which
    // reflects whichever Supabase Auth session is CURRENTLY ACTIVE in this
    // browser tab — not necessarily the owner's, if the same browser/device
    // was ever used to sign into the employee portal without signing out
    // first. This page must only ever show/refresh the OWNER's own Google
    // connection, so the refresh_token exchange above (tied to this specific
    // stored connection) is now the only path — no ambient-session fallback.
    console.warn("[GoogleConnect] GoogleWorkspacePage — no refresh_token on file for the owner's connection, and no ambient-session fallback (see BUG FIX comment) — reconnect required");
    return null;
  }, [storedGoogle?.refreshToken, s.googleRefreshToken, s.googleBackendUrl, setSettings]);

  // Register a token refresher with the googleApi module so any 401 auto-retries.
  useEffect(() => {
    if (!hasToken) { setGoogleTokenRefresher(null); return; }
    setGoogleTokenRefresher(async () => {
      const newToken = await getRefreshedGoogleToken();
      if (!newToken) throw new Error("Refresh failed");
      return newToken;
    });
    return () => setGoogleTokenRefresher(null);
  }, [hasToken, getRefreshedGoogleToken]);

  // BUG FIX — "Settings still shows Connected even after Gmail/Calendar
  // actually broke." isConnected above only ever checked a cached token's
  // presence/expiry — nothing flipped it back to false when a real API call
  // proved the connection dead. gFetch now calls every onGoogleAuthFailure
  // subscriber the moment a 401 survives a refresh attempt; when that
  // happens here, actually clear the stored connection so the UI drops into
  // the real "Connect Google Account" state instead of a stale green badge.
  useEffect(() => {
    return onGoogleAuthFailure(() => {
      clearStoredGoogleConnection();
      setStoredGoogle(getStoredGoogleConnection());
      setSettings?.((prev: any) => ({ ...prev, googleConnected: false, googleProviderToken: "" }));
      toast?.("Your Google connection expired — reconnect in Settings → Google Workspace to resume sync.", "red");
    });
  }, [setSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 1 — real refresh-token exchange (via functions/api/google-refresh.ts,
  // same helper the employee portal uses), with a graceful message if that
  // Cloudflare Function isn't deployed/configured rather than a dead end.
  // Returns true on success so callers (manual button + auto-refresh below)
  // can share the same toast/state logic.
  const doRefreshToken = useCallback(async (silent = false): Promise<boolean> => {
    setRefreshing(true);
    try {
      // BLOCKER 3/20 (mobile round 9) — getRefreshedGoogleToken can call
      // supabase.auth.refreshSession(), which has no built-in timeout and can
      // hang indefinitely on a stalled network/navigator-lock. Without this,
      // a hang here left the "Refresh" button stuck on "Refreshing…" forever
      // since neither the try's success path nor the catch/finally below
      // ever ran.
      const newToken = await withTimeout(getRefreshedGoogleToken(), 10000, "GoogleRefresh");
      if (newToken) {
        setRefreshFailed(false);
        if (!silent) toast?.("Google token refreshed", "green");
        return true;
      }
      setRefreshFailed(true);
      console.warn("[GoogleToken] doRefreshToken — all refresh attempts failed");
      if (!silent) {
        toast?.(
          s.googleRefreshToken
            ? (getLastGoogleRefreshError() || "Couldn't refresh the Google sign-in — reconnect Google below.")
            : "No refresh token on file for this account — reconnect Google below to enable auto-refresh.",
          "red"
        );
      }
      return false;
    } catch (e: any) {
      setRefreshFailed(true);
      console.warn("[GoogleToken] doRefreshToken threw:", e?.message);
      if (!silent) toast?.("Couldn't refresh Google token — reconnect below.", "red");
      return false;
    } finally {
      setRefreshing(false);
    }
  }, [getRefreshedGoogleToken, s.googleRefreshToken, toast]);

  // FIX 1 — attempt a silent auto-refresh once per page load whenever the
  // stored token is missing or already past (or near) expiry, instead of
  // making the owner notice the failure mid-send and hunt for Settings.
  useEffect(() => {
    if (!isConnected || autoRefreshTried.current) return;
    const expiresAt = Number(s.googleTokenExpiresAt) || 0;
    const needsRefresh = !hasToken || (expiresAt && Date.now() > expiresAt - 2 * 60 * 1000);
    if (!needsRefresh) return;
    autoRefreshTried.current = true;
    doRefreshToken(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, hasToken]);

  // FIX 4 (mobile round 8) — the header below used to show "✓ Connected"
  // purely because googleConnected/googleProviderToken existed in settings,
  // with no actual proof the token still works. This makes a real, live API
  // call on page load (Google's tokeninfo endpoint — cheap, no scopes
  // needed) instead of trusting stored expiry metadata alone: if it 401s,
  // try a real refresh, re-verify with the refreshed token, and only THEN
  // report success. `tokenVerified` (null = still checking) drives the badge.
  const [tokenVerified, setTokenVerified] = useState<boolean | null>(null);
  const verifyGoogleToken = useCallback(async (tok: string): Promise<boolean> => {
    try {
      const res = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(tok)}`);
      return res.ok;
    } catch {
      return false;
    }
  }, []);
  useEffect(() => {
    if (!isConnected || !hasToken) { setTokenVerified(isConnected ? false : null); return; }
    let cancelled = false;
    (async () => {
      setTokenVerified(null); // "verifying…" while this runs
      // BLOCKER 3/20 (mobile round 9) — root cause of "verifying connection"
      // hanging forever after disconnect/reconnect: this chain's network
      // calls (tokeninfo fetch, then getRefreshedGoogleToken's Google-refresh
      // Cloudflare Function call or its supabase.auth.refreshSession()
      // fallback) had no timeout and nothing here was wrapped in try/catch —
      // a single stuck request left tokenVerified at null (== "Verifying
      // connection…") with no way to reach setTokenVerified below short of a
      // hard reload. Every step is now time-boxed and any failure — timeout
      // or thrown error — resolves to a definite verified/not-verified state.
      try {
        let ok = await withTimeout(verifyGoogleToken(token), 8000, "GoogleVerify");
        if (!ok) {
          const refreshed = await withTimeout(getRefreshedGoogleToken(), 10000, "GoogleRefresh");
          if (refreshed) ok = await withTimeout(verifyGoogleToken(refreshed), 8000, "GoogleVerify");
        }
        if (cancelled) return;
        setTokenVerified(ok);
        if (!ok) setRefreshFailed(true);
      } catch (e: any) {
        if (cancelled) return;
        console.warn("[GoogleToken] verification chain failed or timed out:", e?.message);
        setTokenVerified(false);
        setRefreshFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, [isConnected, hasToken, token, verifyGoogleToken, getRefreshedGoogleToken]);

  const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.send",
    // ISSUE 1 (Inbox audit) — gmail.modify (implies read access, so this
    // replaces gmail.readonly rather than adding to it) — InboxPage.tsx's
    // markGmailRead() needs the .../modify endpoint to clear the UNREAD
    // label; gmail.readonly alone let messages LIST/GET but 403'd on every
    // "mark as read," repeatedly, burning quota for a permission that was
    // never actually granted.
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/contacts.readonly",
  ].join(" ");

  // Always use signInWithOAuth — avoids "Manual linking is disabled" error that
  // occurs when the identity is already linked and linkIdentity is called again.
  // A fresh OAuth flow always returns a new provider_token regardless of prior state.
  const doConnect = async () => {
    const opts = {
      queryParams: { access_type: "offline", prompt: "consent" },
      scopes: GOOGLE_SCOPES,
      redirectTo: window.location.origin + window.location.pathname,
    };
    try {
      rememberOAuthReturnPage("google");
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: opts });
      if (error) toast?.("Google connect failed: " + error.message, "red");
    } catch (e: any) {
      toast?.("Google connect failed: " + e.message, "red");
    }
  };

  const doDisconnect = async () => {
    // Attempt to revoke the token on Google's side
    if (token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" })
        .catch(() => {});
    }
    console.log("[GoogleConnect] GoogleWorkspacePage — disconnect clicked, clearing localStorage + settings");
    clearStoredGoogleConnection();
    setStoredGoogle(null);
    setSettings?.((prev: any) => ({
      ...prev,
      googleConnected: false,
      googleEmail: "",
      googleProviderToken: "",
      googleRefreshToken: "",
      googleScopes: {},
    }));
    toast?.("Google disconnected", "green");
  };

  const tabs = [
    { k: "overview",  l: "Overview",  icon: Globe },
    { k: "gmail",     l: "Gmail",     icon: Mail },
    { k: "calendar",  l: "Calendar",  icon: Calendar },
    { k: "tasks",     l: "Tasks",     icon: CheckSquare },
    { k: "contacts",  l: "Contacts",  icon: Users },
    { k: "drive",     l: "Drive",     icon: Cloud },
  ];

  if (!isConnected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-brand-500/20 border border-white/10">
            <GoogleLogo />
          </div>
          <div>
            <div className="font-bold">Google Workspace</div>
            <div className="text-[11px] text-brand-400">Not connected</div>
          </div>
        </div>
        <Glass className="p-8 text-center space-y-4 !border-blue-700/30 !bg-blue-950/10">
          <div className="flex justify-center"><GoogleLogo size={40} /></div>
          <div>
            <div className="font-semibold text-white">Connect Google Account</div>
            <div className="text-sm text-white/50 mt-1">
              Link Gmail, Calendar, Tasks, Drive, and Contacts directly in the CRM.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-white/50">
            {["📅 Calendar", "✅ Tasks", "📧 Gmail", "💾 Drive", "👥 Contacts", "🔒 Secure OAuth"].map(s => (
              <div key={s} className="p-2 bg-black/40 border border-white/5 rounded-xl">{s}</div>
            ))}
          </div>
          <button
            onClick={doConnect}
            className="w-full flex items-center justify-center gap-3 py-3 bg-white text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
          >
            <GoogleLogo size={18} />Sign in with Google
          </button>
        </Glass>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-green-500/20 border border-white/10">
            <GoogleLogo />
          </div>
          <div>
            <div className="font-bold">Google Workspace</div>
            {/* FIX 4 (mobile round 8) — only ever say "Connected" once
                tokenVerified is actually true; null = still checking,
                false = a live API call (and a refresh attempt) both failed. */}
            <div className={"text-[11px] " + (tokenVerified === false ? "text-brand-400" : tokenVerified === true ? "text-green-400" : "text-white/40")}>
              {tokenVerified === false ? "⚠ Token expired — Reconnect" : tokenVerified === true ? `✓ Connected as ${googleEmail}` : "Verifying connection…"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => doRefreshToken(false)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-xs text-white transition"
            title="Retry refreshing the Google token without a full reconnect"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing…" : "Retry"}
          </button>
          <button
            onClick={doDisconnect}
            className="px-3 py-1.5 text-xs text-brand-400 hover:text-brand-300 border border-brand-900/30 rounded-xl transition"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Token status */}
      {isConnected && !hasToken && (
        <Glass className="p-3 !bg-yellow-950/20 !border-yellow-700/20 flex items-center gap-3">
          <AlertCircle size={14} className="text-yellow-400 flex-shrink-0" />
          <div className="text-xs text-yellow-300/80">
            Google token not available in this session. Click <strong>Retry</strong> to refresh it, or re-authorize below.
          </div>
        </Glass>
      )}
      {isConnected && hasToken && refreshFailed && (
        <Glass className="p-3 !bg-yellow-950/20 !border-yellow-700/20 flex items-center gap-3">
          <AlertCircle size={14} className="text-yellow-400 flex-shrink-0" />
          <div className="text-xs text-yellow-300/80">
            Automatic token refresh failed{!s.googleRefreshToken ? " — no refresh token is on file for this account" : ""}. Emails/sync may fail until you click <strong>Retry</strong> again or reconnect Google.
          </div>
        </Glass>
      )}

      {/* Scopes */}
      <Glass className="p-3 !bg-black/40">
        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Authorized scopes</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "📅 Calendar", k: "calendar" },
            { label: "📧 Gmail",    k: "gmail"    },
            { label: "✅ Tasks",    k: "tasks"    },
            { label: "💾 Drive",    k: "drive"    },
            { label: "👥 Contacts", k: "contacts" },
          ].map(sc => (
            <span key={sc.k} className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-green-950/30 border border-green-700/30 text-green-300">
              {sc.label}
            </span>
          ))}
        </div>
      </Glass>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={"flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition whitespace-nowrap " +
                (tab === t.k
                  ? "bg-blue-900/40 border-blue-500/50 text-white"
                  : "bg-black/40 border-white/10 text-white/60 hover:text-white")}
            >
              <Icon size={12} />{t.l}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { icon: Mail,        label: "Gmail",     desc: hasToken ? "Live inbox" : "Token needed", active: hasToken },
            { icon: Calendar,    label: "Calendar",  desc: hasToken ? "Live events" : "Token needed", active: hasToken },
            { icon: CheckSquare, label: "Tasks",     desc: hasToken ? "Live tasks" : "Token needed",  active: hasToken },
            { icon: Users,       label: "Contacts",  desc: hasToken ? "Live contacts" : "Token needed", active: hasToken },
            { icon: Cloud,       label: "Drive",     desc: hasToken ? "Live files" : "Token needed",  active: hasToken },
            { icon: Activity,    label: "Status",    desc: "Identity verified ✓", active: true },
          ].map(sc => (
            <Glass key={sc.label} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <sc.icon size={14} className={sc.active ? "text-green-400" : "text-yellow-400"} />
                <span className="text-[10px] text-white/50 uppercase tracking-wider">{sc.label}</span>
              </div>
              <div className="text-sm font-medium text-white/70">{sc.desc}</div>
            </Glass>
          ))}
        </div>
      )}

      {/* Tabs that need a token */}
      {tab !== "overview" && !hasToken && (
        <Glass className="p-6 text-center space-y-3 !bg-yellow-950/10 !border-yellow-700/20">
          <AlertCircle size={20} className="text-yellow-400 mx-auto" />
          <div className="text-sm text-white/70">
            A Google OAuth token is required to load live data. It's captured only during the OAuth redirect.
          </div>
          <button
            onClick={doConnect}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium text-white transition"
          >
            <GoogleLogo size={16} />Re-authorize Google
          </button>
        </Glass>
      )}

      {tab === "gmail"    && hasToken && <GmailTab    token={token} googleEmail={googleEmail} toast={toast} customers={customers} setCustomers={setCustomers} />}
      {tab === "calendar" && hasToken && <GCalTab     token={token} />}
      {tab === "tasks"    && hasToken && <GTasksTab   token={token} toast={toast} />}
      {tab === "contacts" && hasToken && <GContactsTab token={token} customers={customers} setCustomers={setCustomers} toast={toast} />}
      {tab === "drive"    && hasToken && <GDriveTab   token={token} />}
    </div>
  );
}
