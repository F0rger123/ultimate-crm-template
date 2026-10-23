import { useState, useEffect } from "react";
import { Plus, Bug, Lightbulb, HelpCircle, ArrowRight, ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uid } from "../../lib/utils";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GTxt } from "../ui/GTxt";
import { GSel } from "../ui/GSel";
import { Modal } from "../ui/Modal";

// Alfred Cockpit — a private, owner-only place to report bugs/ideas and
// track them kanban-style from a phone, without needing this terminal
// session open. Claude reads/updates this table the same way it reads
// anything else in this codebase (via Supabase). There is deliberately no
// "live usage limit" display here — Claude has no API exposing that data
// to read from, so it can't be shown honestly; everything else requested
// (kanban board, bug/idea/question types, notes, timestamps) is real.
type CockpitItem = {
  id: string; title: string; description: string; type: "bug" | "idea" | "question";
  status: "backlog" | "in_progress" | "done"; claude_notes: string; created_at: string; updated_at: string;
};

const TYPE_META: Record<string, { icon: any; color: string; label: string }> = {
  bug: { icon: Bug, color: "text-brand-400", label: "Bug" },
  idea: { icon: Lightbulb, color: "text-yellow-400", label: "Idea" },
  question: { icon: HelpCircle, color: "text-blue-400", label: "Question" },
};

const COLUMNS: { key: CockpitItem["status"]; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

export function CockpitPage({ ownerId, toast }: { ownerId: string; toast?: (msg: string, tone?: string) => void }) {
  const [items, setItems] = useState<CockpitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState<"bug" | "idea" | "question">("bug");
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<CockpitItem | null>(null);

  const load = async () => {
    try {
      const { data, error } = await (supabase as any).from("cockpit_items").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false });
      if (error) { console.warn("[Cockpit] load failed:", error.message); return; }
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); const h = setInterval(load, 15000); return () => clearInterval(h); }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = async () => {
    if (!newTitle.trim()) { toast?.("Give it a short title first", "red"); return; }
    setSaving(true);
    const row = { id: uid(), owner_id: ownerId, title: newTitle.trim(), description: newDesc.trim(), type: newType, status: "backlog" as const, claude_notes: "" };
    const { error } = await (supabase as any).from("cockpit_items").insert(row);
    setSaving(false);
    if (error) { toast?.("Couldn't save — " + error.message, "red"); return; }
    setItems(prev => [{ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any, ...prev]);
    setNewTitle(""); setNewDesc(""); setNewType("bug"); setAddOpen(false);
    toast?.("Added ✓");
  };

  const moveItem = async (item: CockpitItem, dir: 1 | -1) => {
    const idx = COLUMNS.findIndex(c => c.key === item.status);
    const next = COLUMNS[idx + dir];
    if (!next) return;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next.key } : i));
    const { error } = await (supabase as any).from("cockpit_items").update({ status: next.key, updated_at: new Date().toISOString() }).eq("id", item.id);
    if (error) toast?.("Failed to move — " + error.message, "red");
  };

  const deleteItem = async (item: CockpitItem) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setItems(prev => prev.filter(i => i.id !== item.id));
    setViewing(null);
    const { error } = await (supabase as any).from("cockpit_items").delete().eq("id", item.id);
    if (error) toast?.("Failed to delete — " + error.message, "red");
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Alfred Cockpit</h1>
          <p className="text-sm text-white/50 mt-1">Report a bug, drop an idea, or ask a question from anywhere — I read and update this board directly.</p>
        </div>
        <GBtn onClick={() => setAddOpen(true)}><Plus size={14} className="inline mr-1.5" />New Item</GBtn>
      </div>

      {/* FEATURE — "show my usage limits." There's no API surface exposing
          Claude's/Anthropic's own usage or rate limits to a web app — this
          is the honest placeholder for that request rather than faking a
          number. */}
      <Glass className="p-3 mb-5 !bg-yellow-950/10 !border-yellow-700/20 text-xs text-yellow-200/80">
        Usage limits aren't shown here — there's no API that exposes Claude's own usage/rate-limit data to an app like this one to read. Everything else you asked for (the board, bug/idea/question tracking, notes) is live below.
      </Glass>

      {loading ? (
        <div className="text-center py-16 text-white/40 text-sm">Loading…</div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          {COLUMNS.map(col => {
            const colItems = items.filter(i => i.status === col.key);
            return (
              <div key={col.key}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="text-xs uppercase tracking-wider font-semibold text-white/50">{col.label}</div>
                  <div className="text-xs text-white/30">{colItems.length}</div>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {colItems.map(item => {
                    const meta = TYPE_META[item.type] || TYPE_META.bug;
                    const Icon = meta.icon;
                    return (
                      <Glass key={item.id} className="p-3 cursor-pointer hover:border-brand-700/30 transition" onClick={() => setViewing(item)}>
                        <div className="flex items-start gap-2">
                          <Icon size={13} className={meta.color + " mt-0.5 flex-shrink-0"} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.title}</div>
                            {item.description && <div className="text-xs text-white/40 mt-0.5 line-clamp-2">{item.description}</div>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex gap-1">
                            {col.key !== "backlog" && (
                              <button onClick={e => { e.stopPropagation(); moveItem(item, -1); }} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white"><ArrowLeft size={11} /></button>
                            )}
                            {col.key !== "done" && (
                              <button onClick={e => { e.stopPropagation(); moveItem(item, 1); }} className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white"><ArrowRight size={11} /></button>
                            )}
                          </div>
                          <span className="text-[10px] text-white/25">{new Date(item.created_at).toLocaleDateString()}</span>
                        </div>
                      </Glass>
                    );
                  })}
                  {colItems.length === 0 && <div className="text-xs text-white/20 text-center py-6 border border-dashed border-white/10 rounded-xl">Nothing here</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="New Cockpit Item">
        <div className="space-y-3">
          <GSel label="Type" value={newType} onChange={(e: any) => setNewType(e.target.value)}>
            <option value="bug">Bug</option>
            <option value="idea">Idea</option>
            <option value="question">Question</option>
          </GSel>
          <GInput label="Title" value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} placeholder="Short summary…" autoFocus />
          <GTxt label="Details (optional)" value={newDesc} onChange={(e: any) => setNewDesc(e.target.value)} rows={4} placeholder="Whatever context helps — screenshots aren't uploadable here, but describe what you saw." />
          <GBtn onClick={addItem} disabled={saving} className="w-full">{saving ? "Saving…" : "Add to Backlog"}</GBtn>
        </div>
      </Modal>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title || ""}>
        {viewing && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span className="capitalize">{viewing.type}</span>·<span>{new Date(viewing.created_at).toLocaleString()}</span>
            </div>
            {viewing.description && <div className="text-sm text-white/70 whitespace-pre-wrap">{viewing.description}</div>}
            {viewing.claude_notes && (
              <div className="p-3 rounded-xl bg-black/40 border border-white/10">
                <div className="text-[10px] uppercase tracking-wider text-white/40 font-semibold mb-1">Notes</div>
                <div className="text-sm text-white/70 whitespace-pre-wrap">{viewing.claude_notes}</div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <GBtn variant="danger" onClick={() => deleteItem(viewing)} className="flex-1"><Trash2 size={13} className="inline mr-1.5" />Delete</GBtn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
