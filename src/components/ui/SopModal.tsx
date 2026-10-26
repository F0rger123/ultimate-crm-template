// SopModal.tsx — item 2: SOPs / instructions the owner uploads (Markdown
// text, or a PDF via a data: URL — no separate storage bucket needed, small
// enough documents for this to be fine), stored in the sop_documents table
// (migration 0032). One component, used two ways: owner side (editable=true,
// EmployeeSopPage.tsx) gets full CRUD; employee portal (editable=false) gets
// a read-only list — same data, same RLS-permissive table (single-owner app,
// see docs/ARCHITECTURE.md), so employees always see whatever the owner last saved with
// no separate sync path to keep correct.
import React, { useState, useEffect } from "react";
import { X, BookOpen, Plus, Trash2, Edit, FileText, Upload, Users, Copy, LayoutTemplate } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uid } from "../../lib/utils";

interface SopDoc {
  id: string;
  title: string;
  kind: "markdown" | "pdf";
  content?: string;
  file_url?: string;
  updated_at?: string;
  frequency?: "daily" | "monthly" | "general";
  assignedEmployeeIds?: string[];
  checklist?: { id: string; text: string; done?: boolean }[];
  is_template?: boolean;
}

export function SopModal({ open, onClose, editable = false, ownerId = "", employees = [], currentEmployeeId = "", toast = (() => {}) as any }: { open: boolean; onClose: () => void; editable?: boolean; ownerId?: string; employees?: { id: string; firstName?: string; lastName?: string }[]; currentEmployeeId?: string; toast?: any }) {
  const [docs, setDocs] = useState<SopDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SopDoc | null>(null);
  // Set only by the "For a Specific Employee" guided-start button — just
  // surfaces a hint pointing at the Assign-to picker below; the picker
  // itself is unchanged either way.
  const [justPickedForEmployee, setJustPickedForEmployee] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (supabase as any).from("sop_documents").select("*").order("updated_at", { ascending: false })
      .then((r: any) => {
        if (!r?.error && Array.isArray(r.data)) {
          // FEATURE — "automatically display a blank area with a Create SOP
          // button" on open, rather than auto-jumping into whichever SOP
          // happened to be updated most recently. Every other SOP is still
          // one click away in the list beside it.
          setDocs(r.data);
        } else if (r?.error) {
          console.warn("[SOP] load failed:", r.error.message);
        }
      })
      .catch((e: any) => console.warn("[SOP] load failed:", e?.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const active = docs.find(d => d.id === activeId);
  // Employees only see SOPs assigned to them specifically, or ones with no
  // assignment at all (empty assignedEmployeeIds = visible to everyone) —
  // the owner side (editable) always sees every SOP so nothing gets "lost".
  // Templates are owner-only scaffolding, never shown to employees at all.
  const visibleDocs = (!editable && currentEmployeeId)
    ? docs.filter(d => !d.is_template && (!d.assignedEmployeeIds?.length || d.assignedEmployeeIds.includes(currentEmployeeId)))
    : editable ? docs.filter(d => !d.is_template) : docs;
  const templates = editable ? docs.filter(d => d.is_template) : [];

  const toggleActiveChecklistItem = async (itemId: string) => {
    if (!active) return;
    const updated = (active.checklist || []).map(c => c.id === itemId ? { ...c, done: !c.done } : c);
    setDocs(prev => prev.map(d => d.id === active.id ? { ...d, checklist: updated } : d));
    const res = await (supabase as any).from("sop_documents").update({ checklist: updated }).eq("id", active.id);
    if (res?.error) console.error("[SOP] checklist update failed:", res.error.message);
  };

  const save = async () => {
    if (!editing || !editing.title.trim()) return;
    const isNew = !docs.some(d => d.id === editing.id);
    const nowIso = new Date().toISOString();
    const record = { ...editing, updated_at: nowIso };
    setDocs(prev => isNew ? [record, ...prev] : prev.map(d => d.id === record.id ? record : d));
    setActiveId(record.id);
    setEditing(null);
    // BUG FIX — "ensure SOPs are saved properly." This never checked for a
    // 0-row RLS match (sop_documents is now owner_id-scoped) and never told
    // the owner anything either way — a save could silently fail and the
    // owner would only find out on their next visit that it never stuck.
    // .select("id") + a real toast make both directions visible.
    const res = isNew
      ? await (supabase as any).from("sop_documents").insert({ ...record, owner_id: ownerId }).select("id")
      : await (supabase as any).from("sop_documents").update({ title: record.title, kind: record.kind, content: record.content, file_url: record.file_url, frequency: record.frequency, assignedEmployeeIds: record.assignedEmployeeIds, checklist: record.checklist, is_template: !!record.is_template, updated_at: nowIso }).eq("id", record.id).select("id");
    if (res?.error) { console.error("[SOP] save failed:", res.error.message); toast?.("Saved locally, but failed to sync — " + res.error.message, "red"); return; }
    if (!Array.isArray(res?.data) || res.data.length === 0) { toast?.("Saved locally, but the server didn't confirm the save — try again or refresh to check", "red"); return; }
    toast?.(record.is_template ? "Template saved ✓" : "SOP saved ✓", "green");
  };

  // FEATURE — "have SOP templates which you save and edit." Cloning a
  // template into a real, live (non-template) SOP the owner can then
  // assign to one or more employees — the template itself is untouched
  // and stays reusable for next time.
  const useTemplate = (tpl: SopDoc) => {
    setEditing({
      id: uid(), title: tpl.title, kind: tpl.kind, content: tpl.content, file_url: tpl.file_url,
      frequency: tpl.frequency, checklist: (tpl.checklist || []).map(c => ({ ...c, id: uid(), done: false })),
      assignedEmployeeIds: [], is_template: false,
    });
  };

  const addChecklistItem = () => setEditing(prev => prev ? { ...prev, checklist: [...(prev.checklist || []), { id: uid(), text: "", done: false }] } : prev);
  const updateChecklistItem = (id: string, text: string) => setEditing(prev => prev ? { ...prev, checklist: (prev.checklist || []).map(c => c.id === id ? { ...c, text } : c) } : prev);
  const removeChecklistItem = (id: string) => setEditing(prev => prev ? { ...prev, checklist: (prev.checklist || []).filter(c => c.id !== id) } : prev);
  const toggleAssignedEmployee = (empId: string) => setEditing(prev => {
    if (!prev) return prev;
    const cur = prev.assignedEmployeeIds || [];
    return { ...prev, assignedEmployeeIds: cur.includes(empId) ? cur.filter(id => id !== empId) : [...cur, empId] };
  });

  const remove = async (id: string) => {
    if (!window.confirm("Delete this SOP document?")) return;
    setDocs(prev => prev.filter(d => d.id !== id));
    if (activeId === id) setActiveId(null);
    const res = await (supabase as any).from("sop_documents").delete().eq("id", id).select("id");
    if (res?.error || !Array.isArray(res?.data) || res.data.length === 0) { console.error("[SOP] delete failed:", res?.error?.message || "0 rows"); toast?.("Deleted locally, but failed to delete from server — " + (res?.error?.message || "it may come back"), "red"); }
    else toast?.("SOP deleted", "green");
  };

  const handlePdfUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setEditing(prev => prev ? { ...prev, kind: "pdf", file_url: String(reader.result) } : prev);
    };
    reader.readAsDataURL(file);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center sm:p-4" onClick={onClose}>
      <div className="w-full h-full sm:h-auto sm:max-w-2xl sm:max-h-[85vh] bg-neutral-950 border border-white/10 sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5 flex-shrink-0">
          <div className="font-bold text-white flex items-center gap-2"><BookOpen size={16} />SOPs & Instructions</div>
          <div className="flex items-center gap-2">
            {editable && active && <button onClick={() => setEditing({ id: uid(), title: "", kind: "markdown", content: "" })} className="px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition flex items-center gap-1.5" title="Create SOP"><Plus size={14} />New</button>}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/15 text-white transition"><X size={18} /></button>
          </div>
        </div>

        {editing ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            <input value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder={"Title (e.g. \"Post-Job Cleanup Checklist\")"}
              className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50" />
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...editing, kind: "markdown" })} className={"flex-1 py-2.5 rounded-xl border text-xs font-semibold transition " + (editing.kind === "markdown" ? "border-brand-500/60 bg-brand-950/30 text-brand-300" : "border-white/10 bg-white/5 text-white/50")}>Text / Markdown</button>
              <button onClick={() => setEditing({ ...editing, kind: "pdf" })} className={"flex-1 py-2.5 rounded-xl border text-xs font-semibold transition " + (editing.kind === "pdf" ? "border-brand-500/60 bg-brand-950/30 text-brand-300" : "border-white/10 bg-white/5 text-white/50")}>PDF</button>
            </div>
            {editing.kind === "markdown" ? (
              <textarea value={editing.content || ""} onChange={e => setEditing({ ...editing, content: e.target.value })} rows={10} placeholder="Write the instructions here — plain text or Markdown (## headers, - lists, **bold**)."
                className="w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 resize-none focus:outline-none focus:border-brand-500/50 font-mono" />
            ) : (
              <div className="space-y-2">
                <label className="flex items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed border-white/15 cursor-pointer hover:border-white/30 transition text-white/50 text-sm">
                  <Upload size={16} />{editing.file_url ? "Replace PDF" : "Choose PDF file"}
                  <input type="file" accept="application/pdf" className="hidden" onChange={e => e.target.files?.[0] && handlePdfUpload(e.target.files[0])} />
                </label>
                {editing.file_url && <div className="text-xs text-green-400 flex items-center gap-1.5"><FileText size={12} />PDF attached ✓</div>}
              </div>
            )}

            <div>
              <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Frequency</label>
              <div className="flex gap-2">
                {(["daily", "monthly", "general"] as const).map(f => (
                  <button key={f} onClick={() => setEditing({ ...editing, frequency: f })} className={"flex-1 py-2 rounded-xl border text-xs font-semibold capitalize transition " + (((editing.frequency || "general") === f) ? "border-brand-500/60 bg-brand-950/30 text-brand-300" : "border-white/10 bg-white/5 text-white/50")}>{f}</button>
                ))}
              </div>
            </div>

            {employees.length > 0 && (
              <div className={justPickedForEmployee && !(editing.assignedEmployeeIds || []).length ? "p-2.5 -m-2.5 rounded-xl border border-brand-600/40 bg-brand-950/10" : ""}>
                <label className="text-[10px] text-white/40 uppercase tracking-wider mb-1 block">Assign to <span className="normal-case text-white/30">(none selected = everyone)</span></label>
                {justPickedForEmployee && !(editing.assignedEmployeeIds || []).length && (
                  <div className="text-[10px] text-brand-300 mb-1.5">Pick who this is for below ↓</div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {employees.map(emp => {
                    const on = (editing.assignedEmployeeIds || []).includes(emp.id);
                    return (
                      <button key={emp.id} onClick={() => { toggleAssignedEmployee(emp.id); setJustPickedForEmployee(false); }} className={"px-2.5 py-1.5 rounded-lg text-xs transition " + (on ? "bg-brand-700/40 text-white border border-brand-700/50" : "bg-white/5 text-white/50 border border-white/10")}>
                        {emp.firstName} {emp.lastName?.[0] || ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-white/40 uppercase tracking-wider">Checklist</label>
                <button onClick={addChecklistItem} className="text-[10px] text-brand-400 hover:text-brand-300">+ Add item</button>
              </div>
              <div className="space-y-1.5">
                {(editing.checklist || []).map(item => (
                  <div key={item.id} className="flex items-center gap-1.5">
                    <input value={item.text} onChange={e => updateChecklistItem(item.id, e.target.value)} placeholder="Checklist item…" className="flex-1 bg-white/5 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/25 focus:outline-none focus:border-brand-500/50" />
                    <button onClick={() => removeChecklistItem(item.id)} className="p-1.5 text-white/30 hover:text-danger-400 transition"><Trash2 size={12} /></button>
                  </div>
                ))}
                {(editing.checklist || []).length === 0 && <div className="text-[10px] text-white/30">No checklist items.</div>}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={!!editing.is_template} onChange={e => setEditing({ ...editing, is_template: e.target.checked })} className="accent-brand-600 w-3.5 h-3.5" />
              <span className="text-xs text-white/70 flex items-center gap-1"><LayoutTemplate size={12} />Save as a reusable template (not assigned/published — use "Use Template" later to create a real SOP from it)</span>
            </label>

            <div className="flex gap-2 justify-end pt-2 pb-1">
              <button onClick={() => { setEditing(null); setJustPickedForEmployee(false); }} className="px-4 py-2.5 rounded-xl text-sm text-white/60 hover:text-white transition">Cancel</button>
              <button onClick={() => { save(); setJustPickedForEmployee(false); }} disabled={!editing.title.trim()} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-brand-fg disabled:opacity-50">Save</button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
            <div className="w-full sm:w-44 flex-shrink-0 max-h-52 sm:max-h-none border-b sm:border-b-0 sm:border-r border-white/10 overflow-y-auto overflow-x-hidden">
              {loading && <div className="p-3 text-xs text-white/40">Loading…</div>}
              {!loading && visibleDocs.length === 0 && templates.length === 0 && <div className="p-3 text-xs text-white/40">No SOPs yet.</div>}
              {visibleDocs.length > 0 && (
                <>
                  {editable && templates.length > 0 && <div className="px-3 pt-2.5 pb-1 text-[9px] uppercase tracking-wider text-white/30">Active SOPs</div>}
                  {visibleDocs.map(d => (
                    <button key={d.id} onClick={() => setActiveId(d.id)} className={"w-full text-left px-3 py-3 sm:py-2.5 text-xs border-b border-white/5 transition " + (activeId === d.id ? "bg-brand-950/30 text-white" : "text-white/50 hover:text-white hover:bg-white/5")}>
                      {d.title}
                      {d.frequency && d.frequency !== "general" && <span className="ml-1.5 text-[9px] uppercase text-white/30">· {d.frequency}</span>}
                      {!!d.assignedEmployeeIds?.length && <span className="ml-1.5 text-[9px] text-blue-400/70">· {d.assignedEmployeeIds.length} employee{d.assignedEmployeeIds.length !== 1 ? "s" : ""}</span>}
                    </button>
                  ))}
                </>
              )}
              {editable && templates.length > 0 && (
                <>
                  <div className="px-3 pt-2.5 pb-1 text-[9px] uppercase tracking-wider text-white/30 flex items-center gap-1"><LayoutTemplate size={9} />Templates</div>
                  {templates.map(d => (
                    <button key={d.id} onClick={() => setActiveId(d.id)} className={"w-full text-left px-3 py-3 sm:py-2.5 text-xs border-b border-white/5 transition " + (activeId === d.id ? "bg-brand-950/30 text-white" : "text-white/50 hover:text-white hover:bg-white/5")}>
                      {d.title}
                    </button>
                  ))}
                </>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              {!active ? (
                // FEATURE — "it shouldn't open up the new SOP pop-up right
                // away... show the sections or employees and ask if you
                // want to create one for an employee, or just create one
                // in general." A blank, guided landing area with real
                // choices instead of one flat "Create SOP" button that
                // dumped straight into the editor with no context.
                <div className="text-center text-white/30 text-sm py-10 flex flex-col items-center gap-4 max-w-sm mx-auto">
                  <BookOpen size={32} className="text-white/15" />
                  <div>{visibleDocs.length === 0 && templates.length === 0 ? "No SOPs yet — how do you want to start?" : "Select a document from the list, or start something new."}</div>
                  {editable && (
                    <div className="grid grid-cols-1 gap-2 w-full">
                      <button onClick={() => { setEditing({ id: uid(), title: "", kind: "markdown", content: "", assignedEmployeeIds: [] }); setJustPickedForEmployee(false); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand-600 text-brand-fg flex items-center justify-center gap-1.5 hover:opacity-90 transition">
                        <Plus size={14} />General SOP — visible to everyone
                      </button>
                      {employees.length > 0 && (
                        <button onClick={() => { setEditing({ id: uid(), title: "", kind: "markdown", content: "", assignedEmployeeIds: [] }); setJustPickedForEmployee(true); }} className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/15 bg-white/5 text-white/80 flex items-center justify-center gap-1.5 hover:bg-white/10 transition">
                          <Users size={14} />For a Specific Employee
                        </button>
                      )}
                      {templates.length > 0 && (
                        <div className="text-[10px] text-white/30 pt-1">Or pick a template from the list on the left.</div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="font-semibold text-white text-sm">{active.title}</div>
                    {active.is_template && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-white/15 text-white/40 flex items-center gap-1"><LayoutTemplate size={9} />Template</span>}
                  </div>
                  {active.kind === "pdf" && active.file_url ? (
                    <iframe src={active.file_url} title={active.title} className="w-full h-full min-h-[400px] rounded-xl border border-white/10" />
                  ) : (
                    <div className="text-sm text-white/80 whitespace-pre-wrap leading-relaxed break-words">{active.content || "(empty)"}</div>
                  )}
                </>
              )}
              {active && (active.checklist || []).length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Checklist</div>
                  {(active.checklist || []).map(item => (
                    <label key={item.id} className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
                      <input type="checkbox" checked={!!item.done} onChange={() => toggleActiveChecklistItem(item.id)} className="accent-brand-600" />
                      <span className={item.done ? "line-through text-white/40" : ""}>{item.text}</span>
                    </label>
                  ))}
                </div>
              )}
              {editable && active && (
                <div className="flex gap-2 justify-end pt-3 mt-3 border-t border-white/10">
                  {active.is_template && (
                    <button onClick={() => useTemplate(active)} className="px-3 py-2 rounded-lg text-xs bg-brand-700/30 border border-brand-700/40 text-brand-200 hover:bg-brand-700/40 transition flex items-center gap-1"><Copy size={11} />Use Template</button>
                  )}
                  <button onClick={() => setEditing(active)} className="px-3 py-2 rounded-lg text-xs text-white/60 hover:text-white transition flex items-center gap-1"><Edit size={11} />Edit</button>
                  <button onClick={() => remove(active.id)} className="px-3 py-2 rounded-lg text-xs text-danger-400 hover:text-danger-300 transition flex items-center gap-1"><Trash2 size={11} />Delete</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
