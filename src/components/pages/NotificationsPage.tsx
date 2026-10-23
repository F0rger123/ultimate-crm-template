import React, { useState } from "react";
import { Bell, Receipt, Users2, AlertTriangle, Trash2, CheckCheck, X } from "lucide-react";
import type { AppNotification } from "../../types";

// FEATURE — Notification Center. Previously the only notification surface
// was the header bell dropdown: capped at 20 in-memory entries, no way to
// delete one, no filter/sort, nothing persisted across a reload. This is the
// full, dedicated view — the bell dropdown (App.tsx) now just shows a short
// recent/unread preview of the SAME persisted `notifications` store and
// links here for everything else.
export function NotificationsPage({
  notifications = [] as AppNotification[],
  onDelete,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onNav,
  onGoTo,
}: {
  notifications?: AppNotification[];
  onDelete: (id: string) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onNav?: (page: string) => void;
  // BUG FIX (user report) — "pressing go there just takes me to a blank
  // page" (the referral-nudge notification, page:"settings" — not a real
  // routed page, it's a modal) / "just took me to my employees page" (a
  // crew-photo notification with openType/openId meant to highlight the
  // SPECIFIC employee, not just land on the list). The header bell
  // dropdown (App.tsx) already handles both cases correctly — this page's
  // own "Go there" button was a separate, simpler `onNav(n.page)` call
  // that never got the same fix. onGoTo, when passed, is the SAME routing
  // function the bell dropdown uses — falls back to plain onNav if a
  // caller doesn't pass it.
  onGoTo?: (n: AppNotification) => void;
}) {
  const [filter, setFilter] = useState<"all" | "unread" | "invoice" | "crew" | "issue">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = notifications
    .filter(n => filter === "all" ? true : filter === "unread" ? !n.read : n.category === filter)
    .sort((a, b) => sort === "newest" ? b.at - a.at : a.at - b.at);

  const unreadCount = notifications.filter(n => !n.read).length;

  const iconFor = (n: AppNotification) =>
    n.category === "issue" ? <AlertTriangle size={14} /> : n.category === "crew" ? <Users2 size={14} /> : <Receipt size={14} />;
  const colorFor = (n: AppNotification) =>
    n.category === "issue" ? "bg-brand-950/30 text-brand-400" : n.category === "crew" ? "bg-blue-950/30 text-blue-400" : "bg-green-950/30 text-green-400";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-brand-400" />
          <h2 className="text-lg font-bold">Notifications</h2>
          {unreadCount > 0 && <span className="px-2 py-0.5 rounded-full bg-brand-600 text-brand-fg text-xs font-bold">{unreadCount} unread</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onMarkAllRead} disabled={unreadCount === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-xs text-white/60 hover:text-white disabled:opacity-40 transition">
            <CheckCheck size={12} />Mark all read
          </button>
          <button
            onClick={() => { if (notifications.length > 0 && confirm(`Delete all ${notifications.length} notification(s)? This can't be undone.`)) onClearAll(); }}
            disabled={notifications.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-950/30 border border-brand-800/40 text-xs text-brand-300 hover:bg-brand-900/40 disabled:opacity-40 transition"
          >
            <Trash2 size={12} />Clear all
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {([
            { id: "all", label: "All" },
            { id: "unread", label: "Unread" },
            { id: "invoice", label: "Invoices" },
            { id: "crew", label: "Crew" },
            { id: "issue", label: "Issues" },
          ] as const).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={"px-3 py-1.5 rounded-lg text-xs font-medium transition " + (filter === f.id ? "bg-brand-700 text-brand-fg" : "bg-black/40 border border-white/10 text-white/50 hover:text-white")}>
              {f.label}
            </button>
          ))}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as any)} className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      <div className="space-y-1.5">
        {filtered.length === 0 && (
          <div className="p-10 text-center text-sm text-white/40 bg-black/20 rounded-xl border border-white/5">
            {notifications.length === 0 ? "No notifications yet — you'll see crew activity, invoice events, and reported issues here." : "Nothing matches this filter."}
          </div>
        )}
        {filtered.map(n => {
          const expanded = expandedId === n.id;
          return (
            <div key={n.id + n.at} className={"rounded-xl border overflow-hidden transition " + (n.read ? "bg-black/20 border-white/5" : "bg-white/5 border-white/10")}>
              <div className="flex items-center gap-3 p-3">
                <div className={"p-2 rounded-lg flex-shrink-0 " + colorFor(n)}>{iconFor(n)}</div>
                <button onClick={() => { setExpandedId(expanded ? null : n.id); if (!n.read) onMarkRead(n.id); }} className="flex-1 min-w-0 text-left">
                  <div className={"text-sm " + (n.read ? "text-white/60" : "font-semibold text-white")}>{n.text}</div>
                  <div className="text-[11px] text-white/40">{new Date(n.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                </button>
                {!n.read && <span className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0 text-brand-fg" />}
                <button onClick={() => onDelete(n.id)} className="p-1.5 text-white/30 hover:text-danger-400 flex-shrink-0" title="Delete"><X size={14} /></button>
              </div>
              {expanded && (
                <div className="px-3 pb-3 pt-1 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="text-[11px] text-white/40">
                    {n.category ? n.category[0].toUpperCase() + n.category.slice(1) : "System"} · {new Date(n.at).toLocaleString()}
                    {n.detail ? <div className="mt-1 text-white/60">{n.detail}</div> : null}
                  </div>
                  {n.page && (onGoTo || onNav) && (
                    <button onClick={() => onGoTo ? onGoTo(n) : onNav!(n.page!)} className="px-2.5 py-1 rounded-lg bg-brand-900/30 border border-brand-700/40 text-brand-300 text-[11px] font-semibold hover:bg-brand-800/40 transition flex-shrink-0">
                      Go there →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
