// FEATURE — public product feedback/roadmap board. Any signed-in CRM Starter
// user (owner or employee, any business) can submit a bug/feature request
// and upvote/downvote others' — cross-tenant by design, this is feedback
// about the PRODUCT, not any one business's data. Only the platform admin
// (VITE_PLATFORM_ADMIN_EMAIL) can move an item's status — that change
// is what makes it show up on the public roadmap (see RoadmapPage.tsx,
// the logged-out landing-page equivalent that only shows planned/
// in_progress/done items, no submit/vote).
import React, { useEffect, useRef, useState } from "react";
import { Bug, Lightbulb, ChevronUp, ChevronDown, Plus, Trash2, Clock, CheckCircle, Rocket, LayoutGrid, List, Edit, X, Check } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uid, withTimeout } from "../../lib/utils";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GTxt } from "../ui/GTxt";
import { GSel } from "../ui/GSel";
import { Badge } from "../ui/Badge";
import { useConfirm } from "../ui/ConfirmModal";

type FeedbackItem = {
  id: string; title: string; description: string; type: "bug" | "feature";
  status: "submitted" | "planned" | "in_progress" | "done" | "declined";
  submitted_by_email: string; submitted_by_name: string; submitted_by_uid?: string; admin_note: string;
  created_at: string; updated_at: string; edited_at?: string | null;
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  submitted: { label: "New", color: "text-white/50", icon: Clock },
  planned: { label: "Planned", color: "text-blue-400", icon: Clock },
  in_progress: { label: "In Progress", color: "text-yellow-400", icon: Rocket },
  done: { label: "Done", color: "text-green-400", icon: CheckCircle },
  declined: { label: "Not Planned", color: "text-white/30", icon: Clock },
};

export function FeedbackPage({ userEmail, userName, isAdmin, toast, publicMode = false }: {
  userEmail?: string; userName?: string; isAdmin?: boolean; toast?: (msg: string, tone?: any) => void;
  // Read-only public roadmap mode (logged-out landing-page visitors) — no
  // submit form, no voting, only shows items the admin has actually
  // scheduled/shipped (planned/in_progress/done), never raw unfiltered
  // submissions.
  publicMode?: boolean;
}) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [votes, setVotes] = useState<Record<string, { total: number; mine: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"bug" | "feature">("feature");
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [myUid, setMyUid] = useState<string | null>(null);
  // FEATURE (user report) — "people should be able to delete or edit their
  // feedback, and it should show that it was edited."
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const { confirmAsync, ConfirmDialog } = useConfirm();
  // FEATURE — "have the kanban style board to see what you're doing." Admin
  // (you) gets a real drag-between-columns board; everyone else still gets
  // the simple upvote/downvote list — they can't change status anyway, so
  // columns would just be read-only clutter for them.
  const [view, setView] = useState<"list" | "kanban">("kanban");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // BUG FIX — "the feedback and roadmap sections just say Loading." No
  // timeout existed here at all — a hung/slow request (flaky connection,
  // cold Supabase connection on the public landing page) left `loading`
  // stuck true forever with no way out, exactly like every other "stuck
  // on X forever" bug already fixed elsewhere in this app with a real
  // withTimeout wrapper (see docs/ARCHITECTURE.md). 12s matches the timeout other
  // public-facing reads in this app use.
  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await withTimeout<any>((supabase as any).auth.getUser(), 12000, "Feedback auth check");
      setMyUid(user?.id || null);
      const [itemsRes, votesRes] = await withTimeout(Promise.all([
        (supabase as any).from("feedback_items").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("feedback_votes").select("feedback_id,voter_id,value"),
      ]), 12000, "Feedback load");
      if (itemsRes.error) console.warn("[Feedback] items fetch error:", itemsRes.error.message);
      if (votesRes.error) console.warn("[Feedback] votes fetch error:", votesRes.error.message);
      setItems(itemsRes.data || []);
      const tally: Record<string, { total: number; mine: number }> = {};
      (votesRes.data || []).forEach((v: any) => {
        if (!tally[v.feedback_id]) tally[v.feedback_id] = { total: 0, mine: 0 };
        tally[v.feedback_id].total += v.value;
        if (v.voter_id === user?.id) tally[v.feedback_id].mine = v.value;
      });
      setVotes(tally);
    } catch (e: any) {
      console.warn("[Feedback] load failed:", e?.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!newTitle.trim()) { toast?.("Give it a title first", "red"); return; }
    setSubmitting(true);
    try {
      const row = { id: uid(), title: newTitle.trim(), description: newDesc.trim(), type: newType, status: "submitted", submitted_by_email: userEmail || "", submitted_by_name: userName || "", submitted_by_uid: myUid || null };
      // BUG FIX (user report — "added feedback, it didn't save") — this had
      // no withTimeout, unlike every other critical write in this app (see
      // docs/ARCHITECTURE.md) — supabase-js refreshing a stale session internally
      // before this insert can hang under the same real-world flaky-
      // connection conditions documented elsewhere in this codebase
      // (AlfredPage's ITEM 23, lib/messaging.ts's twilioSend). Without a
      // timeout, that hang left `submitting` stuck true forever with the
      // button just silently "Submitting…" — no error, nothing saved,
      // nothing to explain why.
      const { error } = await withTimeout<any>((supabase as any).from("feedback_items").insert(row), 15000, "Submit feedback");
      if (error) throw new Error(error.message);
      toast?.("Submitted ✓", "green");
      setNewTitle(""); setNewDesc(""); setShowNew(false);
      await load();
    } catch (e: any) {
      toast?.("Couldn't submit — " + (e?.message || "unknown error"), "red");
    } finally {
      setSubmitting(false);
    }
  };

  const vote = async (itemId: string, value: 1 | -1) => {
    if (!myUid) { toast?.("Sign in to vote", "red"); return; }
    const current = votes[itemId]?.mine || 0;
    const next = current === value ? 0 : value;
    // Optimistic
    setVotes(prev => ({ ...prev, [itemId]: { total: (prev[itemId]?.total || 0) - current + next, mine: next } }));
    try {
      // BUG FIX — "voting doesn't work." Neither branch ever checked the
      // write's own {error} — a failed delete/upsert (RLS rejection, a
      // dropped connection that resolves rather than throws) left the
      // optimistic UI update in place looking like the vote landed, while
      // nothing was actually saved server-side. Silent until the next load
      // reverted it with no explanation, which is exactly what "doesn't
      // work" looks like from the outside.
      const result = next === 0
        ? await (supabase as any).from("feedback_votes").delete().eq("feedback_id", itemId).eq("voter_id", myUid).select("feedback_id")
        : await (supabase as any).from("feedback_votes").upsert({ feedback_id: itemId, voter_id: myUid, value: next }, { onConflict: "feedback_id,voter_id" }).select("feedback_id");
      if (result?.error) throw new Error(result.error.message);
    } catch (e: any) {
      toast?.("Vote failed to save — " + (e?.message || "unknown error"), "red");
      load();
    }
  };

  const setStatus = async (itemId: string, status: string) => {
    const { error, data } = await (supabase as any).from("feedback_items").update({ status, updated_at: new Date().toISOString() }).eq("id", itemId).select("id");
    if (error) { toast?.("Couldn't update status — " + error.message, "red"); return; }
    // BUG FIX (audit) — RLS silently succeeds with 0 rows affected on a
    // write that doesn't match, same pattern as everywhere else in this
    // app (see docs/ARCHITECTURE.md) — this update only ever checked `error`, so a
    // blocked write showed "moved ✓" with nothing actually persisted.
    if (!Array.isArray(data) || data.length === 0) { toast?.("Status didn't save — the server didn't confirm the change", "red"); return; }
    toast?.("Status updated ✓", "green");
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, status: status as any } : it));
  };
  const deleteItem = async (itemId: string) => {
    if (!(await confirmAsync({ message: "Delete this feedback item? This can't be undone.", confirmLabel: "Delete" }))) return;
    const { error } = await (supabase as any).from("feedback_items").delete().eq("id", itemId);
    if (error) { toast?.("Couldn't delete — " + error.message, "red"); return; }
    setItems(prev => prev.filter(it => it.id !== itemId));
  };

  // FEATURE (user report) — "people should be able to delete or edit their
  // feedback, and it should show that it was edited." Only the original
  // submitter (submitted_by_uid — see migration 0098) or the admin can
  // actually save this; RLS enforces that server-side too, not just this
  // client-side gate on the button itself.
  const startEdit = (it: FeedbackItem) => { setEditingId(it.id); setEditTitle(it.title); setEditDesc(it.description || ""); };
  const cancelEdit = () => { setEditingId(null); setEditTitle(""); setEditDesc(""); };
  const saveEdit = async (itemId: string) => {
    if (!editTitle.trim()) { toast?.("Give it a title first", "red"); return; }
    setSavingEdit(true);
    try {
      const patch = { title: editTitle.trim(), description: editDesc.trim(), edited_at: new Date().toISOString() };
      const { error, data } = await withTimeout<any>(
        (supabase as any).from("feedback_items").update(patch).eq("id", itemId).select("id"),
        15000, "Save feedback edit"
      );
      if (error) throw new Error(error.message);
      // BUG FIX pattern (see docs/ARCHITECTURE.md) — RLS silently accepts a 0-row
      // write that doesn't match instead of erroring; check the row count,
      // not just `error`, before claiming this actually saved.
      if (!Array.isArray(data) || data.length === 0) throw new Error("The server didn't confirm the change");
      setItems(prev => prev.map(it => it.id === itemId ? { ...it, ...patch } : it));
      toast?.("Updated ✓", "green");
      cancelEdit();
    } catch (e: any) {
      toast?.("Couldn't save — " + (e?.message || "unknown error"), "red");
    } finally {
      setSavingEdit(false);
    }
  };

  // FEATURE — kanban drag-to-change-status. Pointer events work uniformly
  // for touch and mouse (same technique as the video editor's timeline
  // drag) — press a card, drag it over a column, release to commit.
  const handleCardPointerDown = (e: React.PointerEvent, id: string) => {
    if (!isAdmin || view !== "kanban") return;
    setDraggingId(id);
  };
  useEffect(() => {
    if (!draggingId) return;
    let hoverColumn: string | null = null;
    const onMove = (e: PointerEvent) => {
      const board = boardRef.current;
      if (!board) return;
      const cols = Array.from(board.querySelectorAll<HTMLElement>("[data-kanban-col]"));
      const under = cols.find(col => {
        const r = col.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      hoverColumn = under?.dataset.kanbanCol || null;
      cols.forEach(col => col.classList.toggle("kanban-col-hover", col === under));
    };
    const onUp = () => {
      boardRef.current?.querySelectorAll("[data-kanban-col]").forEach(col => col.classList.remove("kanban-col-hover"));
      if (hoverColumn) {
        const item = items.find(it => it.id === draggingId);
        if (item && item.status !== hoverColumn) setStatus(draggingId, hoverColumn);
      }
      setDraggingId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [draggingId, items]);

  // FEATURE — "I want a page where users can request new features, upvote
  // ideas, downvote them... a leaderboard ranked by votes... report bugs."
  // publicMode used to mean "always read-only, curated to planned/in_progress/
  // done only" — correct for a truly anonymous visitor, but wrong once
  // they're actually logged in (any CRM Starter owner/employee, cross-tenant
  // by design, per the header comment). Read-only-ness now follows whether
  // we've actually resolved a real signed-in user (myUid), not the static
  // publicMode flag — an anonymous visitor still gets the curated
  // read-only view, but a logged-in one gets the full submit/vote board
  // right on the landing page, matching the "Log in to submit/vote" CTA
  // already shown above this component.
  const canInteract = !!myUid;
  const filtered = items
    .filter(it => (publicMode && !canInteract) ? ["planned", "in_progress", "done"].includes(it.status) : (statusFilter === "all" || it.status === statusFilter || publicMode))
    .filter(it => publicMode ? it.status !== "declined" : true)
    .sort((a, b) => (votes[b.id]?.total || 0) - (votes[a.id]?.total || 0));

  const showKanban = isAdmin && !publicMode && view === "kanban";

  return (
    <div className={showKanban ? "p-4 space-y-4" : "max-w-3xl mx-auto p-4 space-y-4"}>
      {ConfirmDialog}
      <style>{`.kanban-col-hover { background: rgba(255,255,255,0.08) !important; border-color: rgba(255,255,255,0.4) !important; }`}</style>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">{publicMode ? "Roadmap & Feedback" : "Feedback & Roadmap"}</h2>
          <div className="text-xs text-white/50">{publicMode ? (canInteract ? "Vote on what matters most, or submit a feature request or bug report." : "What's planned, in progress, and shipped — log in to submit or vote.") : isAdmin ? "Report bugs, request features, vote — and drag cards between columns to update status." : "Report bugs, request features, and vote on what matters most."}</div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && !publicMode && (
            <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
              <button onClick={() => setView("kanban")} title="Kanban board" className={"p-1.5 rounded-md transition " + (view === "kanban" ? "bg-brand-900/40 text-brand-300" : "text-white/40 hover:text-white")}><LayoutGrid size={14} /></button>
              <button onClick={() => setView("list")} title="List" className={"p-1.5 rounded-md transition " + (view === "list" ? "bg-brand-900/40 text-brand-300" : "text-white/40 hover:text-white")}><List size={14} /></button>
            </div>
          )}
          {(!publicMode || canInteract) && <GBtn onClick={() => setShowNew(s => !s)} className="!text-xs"><Plus size={12} className="inline mr-1" />New</GBtn>}
        </div>
      </div>

      {(!publicMode || canInteract) && showNew && (
        <Glass className="p-4 space-y-2.5">
          <div className="flex gap-2">
            <button onClick={() => setNewType("feature")} className={"flex-1 py-2 rounded-lg text-xs font-semibold border transition " + (newType === "feature" ? "border-yellow-500/50 bg-yellow-950/30 text-yellow-300" : "border-white/10 text-white/50")}><Lightbulb size={12} className="inline mr-1" />Feature Request</button>
            <button onClick={() => setNewType("bug")} className={"flex-1 py-2 rounded-lg text-xs font-semibold border transition " + (newType === "bug" ? "border-brand-500/50 bg-brand-950/30 text-brand-300" : "border-white/10 text-white/50")}><Bug size={12} className="inline mr-1" />Bug Report</button>
          </div>
          <GInput value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} placeholder="Short title" className="!text-sm" />
          <GTxt value={newDesc} onChange={(e: any) => setNewDesc(e.target.value)} rows={3} placeholder="Details (optional)" className="!text-sm" />
          <GBtn onClick={submit} disabled={submitting} className="w-full">{submitting ? "Submitting…" : "Submit"}</GBtn>
        </Glass>
      )}

      {!publicMode && !showKanban && (
        <div className="flex gap-1.5 flex-wrap">
          {["all", "submitted", "planned", "in_progress", "done"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={"px-2.5 py-1 rounded-full text-[11px] font-medium border transition " + (statusFilter === s ? "border-brand-500/50 bg-brand-950/30 text-brand-300" : "border-white/10 text-white/50 hover:text-white")}>
              {s === "all" ? "All" : STATUS_META[s].label}
            </button>
          ))}
        </div>
      )}

      {showKanban ? (
        loading ? (
          <div className="text-center py-10 text-white/30 text-sm">Loading…</div>
        ) : (
          <div ref={boardRef} className="flex gap-3 overflow-x-auto pb-2">
            {Object.entries(STATUS_META).map(([statusKey, meta]) => {
              const colItems = items.filter(it => it.status === statusKey).sort((a, b) => (votes[b.id]?.total || 0) - (votes[a.id]?.total || 0));
              return (
                <div key={statusKey} data-kanban-col={statusKey} className="flex-shrink-0 w-72 rounded-xl border border-white/10 bg-black/20 transition-colors">
                  <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black/40 backdrop-blur rounded-t-xl">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5"><meta.icon size={12} className={meta.color} />{meta.label}</div>
                    <div className="text-[10px] text-white/40 font-mono">{colItems.length}</div>
                  </div>
                  <div className="p-2 space-y-2 min-h-[80px]">
                    {colItems.length === 0 && <div className="text-center py-4 text-white/20 text-[11px]">Empty</div>}
                    {colItems.map(it => {
                      const v = votes[it.id] || { total: 0, mine: 0 };
                      const TypeIcon = it.type === "bug" ? Bug : Lightbulb;
                      return (
                        <div
                          key={it.id}
                          onPointerDown={e => handleCardPointerDown(e, it.id)}
                          className={"p-2.5 rounded-lg bg-white/5 border border-white/10 cursor-grab active:cursor-grabbing select-none " + (draggingId === it.id ? "opacity-40" : "")}
                          style={{ touchAction: "none" }}
                        >
                          <div className="flex items-center gap-1.5">
                            <TypeIcon size={11} className={it.type === "bug" ? "text-brand-400 flex-shrink-0" : "text-yellow-400 flex-shrink-0"} />
                            <div className="text-xs font-semibold text-white leading-snug">{it.title}</div>
                          </div>
                          {it.description && <div className="text-[10px] text-white/40 mt-1 line-clamp-3">{it.description}</div>}
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                            <div className="text-[10px] text-white/30 truncate">{it.submitted_by_name || it.submitted_by_email || "Anonymous"}</div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] text-white/40 font-mono">{v.total > 0 ? `+${v.total}` : v.total}</span>
                              <button onPointerDown={e => e.stopPropagation()} onClick={() => deleteItem(it.id)} className="text-danger-400/50 hover:text-danger-400"><Trash2 size={11} /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : loading ? (
        <div className="text-center py-10 text-white/30 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-white/30 text-sm">Nothing here yet — be the first to submit something.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(it => {
            const meta = STATUS_META[it.status];
            const v = votes[it.id] || { total: 0, mine: 0 };
            const TypeIcon = it.type === "bug" ? Bug : Lightbulb;
            const isMine = !!myUid && !!it.submitted_by_uid && it.submitted_by_uid === myUid;
            const isEditing = editingId === it.id;
            return (
              <Glass key={it.id} className="p-3 flex gap-3">
                {(!publicMode || canInteract) ? (
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5">
                    <button onClick={() => vote(it.id, 1)} className={"w-7 h-7 flex items-center justify-center rounded-lg " + (v.mine === 1 ? "text-green-400 bg-green-950/30" : "text-white/30 hover:text-white/60")}><ChevronUp size={16} /></button>
                    <div className="text-xs font-bold text-white">{v.total}</div>
                    <button onClick={() => vote(it.id, -1)} className={"w-7 h-7 flex items-center justify-center rounded-lg " + (v.mine === -1 ? "text-brand-400 bg-brand-950/30" : "text-white/30 hover:text-white/60")}><ChevronDown size={16} /></button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-0.5 w-7">
                    <div className="text-xs font-bold text-white/60">{v.total}</div>
                    <div className="text-[8px] text-white/30 uppercase tracking-wider">votes</div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    // FEATURE (user report) — "people should be able to
                    // delete or edit their feedback." Same title/description
                    // inputs as the New Feedback form, inline in place of
                    // the static title/description while editing.
                    <div className="space-y-2">
                      <GInput value={editTitle} onChange={(e: any) => setEditTitle(e.target.value)} placeholder="Short title" className="!text-sm" />
                      <GTxt value={editDesc} onChange={(e: any) => setEditDesc(e.target.value)} rows={3} placeholder="Details (optional)" className="!text-sm" />
                      <div className="flex gap-2">
                        <GBtn onClick={() => saveEdit(it.id)} disabled={savingEdit} className="!text-xs"><Check size={12} className="inline mr-1" />{savingEdit ? "Saving…" : "Save"}</GBtn>
                        <GBtn variant="ghost" onClick={cancelEdit} disabled={savingEdit} className="!text-xs"><X size={12} className="inline mr-1" />Cancel</GBtn>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <TypeIcon size={12} className={it.type === "bug" ? "text-brand-400" : "text-yellow-400"} />
                        <div className="text-sm font-semibold text-white">{it.title}</div>
                        <Badge tone={it.status === "done" ? "green" : it.status === "in_progress" ? "yellow" : it.status === "planned" ? "blue" : "gray"}>{meta.label}</Badge>
                      </div>
                      {it.description && <div className="text-xs text-white/50 mt-1 whitespace-pre-wrap">{it.description}</div>}
                      <div className="text-[10px] text-white/30 mt-1">
                        {it.submitted_by_name || it.submitted_by_email || "Anonymous"} · {new Date(it.created_at).toLocaleDateString()}
                        {/* BUG FIX (user report) — "it should show that it
                            was edited." edited_at is only ever set by
                            saveEdit below, so this never shows for an
                            item that's only had its status changed. */}
                        {it.edited_at && <span title={new Date(it.edited_at).toLocaleString()}> · edited</span>}
                      </div>
                    </>
                  )}
                  {!isEditing && (isAdmin || isMine) && (
                    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/10">
                      {isAdmin && (
                        <GSel value={it.status} onChange={(e: any) => setStatus(it.id, e.target.value)} className="!text-[11px] !py-1">
                          {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k} className="bg-black">{m.label}</option>)}
                        </GSel>
                      )}
                      {/* Own item (or admin) can edit; admin could always
                          delete anything, now the original submitter can
                          delete their own too (see migration 0098). */}
                      <button onClick={() => startEdit(it)} title="Edit" className="text-white/40 hover:text-white p-1"><Edit size={13} /></button>
                      <button onClick={() => deleteItem(it.id)} title="Delete" className="text-danger-400/60 hover:text-danger-400 p-1"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              </Glass>
            );
          })}
        </div>
      )}
    </div>
  );
}
