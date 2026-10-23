import React, { useEffect, useState } from "react";
import { GraduationCap, Plus, X, Trash2, Upload, CheckCircle, AlertTriangle, RefreshCw, FlaskConical, Wrench, ScrollText, Info } from "lucide-react";
import { uid, uploadJobMedia, deleteJobMediaByUrl } from "../../lib/utils";
import type { TrainingModule, TrainingQuizQuestion, TrainingMedia, Employee } from "../../types";
import { supabase } from "../../lib/supabase";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GSel } from "../ui/GSel";
import { GTxt } from "../ui/GTxt";
import { Modal } from "../ui/Modal";

// FEATURE — "add a training process for employees, allowing owners to
// attach training rules, equipment instructions, chemical warnings,
// training videos and photos with descriptions, and training tests with
// multiple-choice questions that are graded." Owner-side module builder +
// completion tracking; the employee-facing "take the module/quiz" flow
// lives in EmployeePortal.tsx's Training tab.

const CATEGORY_META: Record<string, { label: string; icon: any; tone: string }> = {
  rule: { label: "Rule / Policy", icon: ScrollText, tone: "blue" },
  equipment: { label: "Equipment", icon: Wrench, tone: "purple" },
  chemical: { label: "Chemical Warning", icon: FlaskConical, tone: "yellow" },
  general: { label: "General", icon: Info, tone: "white" },
};

const blankQuestion = (): TrainingQuizQuestion => ({ id: uid(), question: "", options: ["", ""], correctIndex: 0 });

export function TrainingPage({ modules, setModules, employees = [], toast, ownerId }: {
  modules: TrainingModule[]; setModules: (fn: (m: TrainingModule[]) => TrainingModule[]) => void;
  employees?: Employee[]; toast: (msg: string, tone?: string) => void; ownerId?: string;
}) {
  const [editing, setEditing] = useState<TrainingModule | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [completions, setCompletions] = useState<any[]>([]);
  const [loadingCompletions, setLoadingCompletions] = useState(false);
  const [uploading, setUploading] = useState(false);

  const activeEmployees = employees.filter((e: any) => e.status === "active" && e.role !== "owner");

  const loadCompletions = async () => {
    if (!ownerId) return;
    setLoadingCompletions(true);
    try {
      const { data, error } = await (supabase as any).from("training_completions").select("*").eq("owner_id", ownerId);
      if (error) { toast("Couldn't load completion stats — " + error.message, "red"); return; }
      setCompletions(Array.isArray(data) ? data : []);
    } finally {
      setLoadingCompletions(false);
    }
  };
  useEffect(() => { loadCompletions(); }, [ownerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openNew = () => {
    setEditing({ id: uid(), title: "", category: "general", body: "", media: [], quiz: [], passingScore: 80, required: true, createdAt: new Date().toISOString() });
    setShowBuilder(true);
  };
  const openEdit = (m: TrainingModule) => { setEditing({ ...m }); setShowBuilder(true); };

  const save = () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast("Give this module a title", "red"); return; }
    for (const q of editing.quiz) {
      if (!q.question.trim() || q.options.some(o => !o.trim())) { toast("Every quiz question needs text and every option filled in", "red"); return; }
    }
    setModules(prev => {
      const exists = prev.some(m => m.id === editing.id);
      return exists ? prev.map(m => m.id === editing.id ? editing : m) : [...prev, editing];
    });
    toast(`"${editing.title}" saved ✓`, "green");
    setShowBuilder(false);
    setEditing(null);
  };

  const removeModule = (m: TrainingModule) => {
    if (!confirm(`Delete "${m.title}"? This can't be undone.`)) return;
    setModules(prev => prev.filter(x => x.id !== m.id));
    deleteJobMediaByUrl(m.media.map(md => md.url)).catch(() => {});
    toast("Module deleted", "green");
  };

  const handleMediaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editing) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) { toast(`${file.name} isn't a photo or video`, "yellow"); continue; }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `training/${editing.id}/${uid()}-${safeName}`;
        const url = await uploadJobMedia(file, path, file.type);
        if (!url) { toast(`Failed to upload ${file.name}`, "red"); continue; }
        const item: TrainingMedia = { id: uid(), url, type: file.type.startsWith("video/") ? "video" : "image" };
        setEditing(prev => prev ? { ...prev, media: [...prev.media, item] } : prev);
      }
    } finally {
      setUploading(false);
    }
  };

  const addQuestion = () => setEditing(prev => prev ? { ...prev, quiz: [...prev.quiz, blankQuestion()] } : prev);
  const updateQuestion = (id: string, patch: Partial<TrainingQuizQuestion>) =>
    setEditing(prev => prev ? { ...prev, quiz: prev.quiz.map(q => q.id === id ? { ...q, ...patch } : q) } : prev);
  const removeQuestion = (id: string) => setEditing(prev => prev ? { ...prev, quiz: prev.quiz.filter(q => q.id !== id) } : prev);

  const statsFor = (moduleId: string) => {
    const relevant = completions.filter(c => c.module_id === moduleId);
    const passedIds = new Set(relevant.filter(c => c.passed).map(c => c.employee_id));
    const outstanding = activeEmployees.filter((e: any) => !passedIds.has(e.id));
    return { passedCount: passedIds.size, total: activeEmployees.length, outstanding };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xl font-bold flex items-center gap-2"><GraduationCap size={20} className="text-brand-400" />Employee Training</div>
          <div className="text-sm text-white/50 mt-0.5">Rules, equipment instructions, chemical warnings, and graded quizzes your crew completes in the field portal.</div>
        </div>
        <div className="flex items-center gap-2">
          <GBtn variant="ghost" onClick={loadCompletions} disabled={loadingCompletions} className="!text-xs"><RefreshCw size={12} className={"inline mr-1 " + (loadingCompletions ? "animate-spin" : "")} />Refresh Stats</GBtn>
          <GBtn onClick={openNew} className="!text-xs"><Plus size={13} className="inline mr-1" />New Module</GBtn>
        </div>
      </div>

      {modules.length === 0 && (
        <Glass className="p-10 text-center text-white/40">
          <GraduationCap size={28} className="mx-auto mb-2 opacity-40" />
          No training modules yet. Create one to get your crew certified on equipment, chemicals, and rules.
        </Glass>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {modules.map(m => {
          const meta = CATEGORY_META[m.category] || CATEGORY_META.general;
          const Icon = meta.icon;
          const { passedCount, total, outstanding } = statsFor(m.id);
          return (
            <Glass key={m.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={"w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-" + meta.tone + "-950/30 border border-" + meta.tone + "-700/30"}><Icon size={14} /></div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{m.title || "Untitled"}</div>
                    <div className="text-[10px] text-white/40">{meta.label}{m.required ? " · Required" : ""}{m.quiz.length > 0 ? ` · ${m.quiz.length} question quiz` : ""}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(m)} className="p-1.5 text-white/40 hover:text-white text-xs">Edit</button>
                  <button onClick={() => removeModule(m)} className="p-1.5 text-white/40 hover:text-danger-400"><Trash2 size={13} /></button>
                </div>
              </div>
              {m.body && <div className="text-xs text-white/60 line-clamp-2">{m.body}</div>}
              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] text-white/50">{passedCount}/{total} crew passed</div>
                {outstanding.length > 0 && total > 0 && (
                  <div className="text-[10px] text-yellow-400 flex items-center gap-1"><AlertTriangle size={10} />{outstanding.length} outstanding</div>
                )}
                {total > 0 && outstanding.length === 0 && <div className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle size={10} />Everyone certified</div>}
              </div>
            </Glass>
          );
        })}
      </div>

      {editing && (
        <Modal open={showBuilder} onClose={() => { setShowBuilder(false); setEditing(null); }} title="" maxW="max-w-xl">
          <div className="space-y-4">
            <div className="text-lg font-bold flex items-center gap-2"><GraduationCap size={18} className="text-brand-400" />{modules.some(m => m.id === editing.id) ? "Edit" : "New"} Training Module</div>

            <div><label className="text-xs text-white/60 mb-1 block">Title</label><GInput value={editing.title} onChange={(e: any) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. service Chemical Safety" /></div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60 mb-1 block">Category</label>
                <GSel value={editing.category} onChange={(e: any) => setEditing({ ...editing, category: e.target.value })}>
                  {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k} className="bg-black">{v.label}</option>)}
                </GSel>
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Passing score (%)</label>
                <GInput type="number" min="0" max="100" value={editing.passingScore} onChange={(e: any) => setEditing({ ...editing, passingScore: Number(e.target.value) || 0 })} />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editing.required} onChange={e => setEditing({ ...editing, required: e.target.checked })} className="accent-neutral-300 w-3.5 h-3.5" />
              <span className="text-xs text-white/70">Required for all crew</span>
            </label>

            <div>
              <label className="text-xs text-white/60 mb-1 block">Rules / instructions / warnings</label>
              <GTxt rows={4} value={editing.body} onChange={(e: any) => setEditing({ ...editing, body: e.target.value })} placeholder="Write the instructions, safety rules, or chemical warnings here — this is what the employee reads before the quiz." />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-white/60">Photos / videos</label>
                <label className="cursor-pointer text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={e => handleMediaUpload(e.target.files)} />
                  {uploading ? <><div className="w-3 h-3 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />Uploading…</> : <><Upload size={11} />Add media</>}
                </label>
              </div>
              {editing.media.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {editing.media.map(md => (
                    <div key={md.id} className="relative group">
                      {md.type === "video"
                        ? <video src={md.url} className="w-full h-16 object-cover rounded-lg border border-white/10" muted />
                        : <img src={md.url} alt="" className="w-full h-16 object-cover rounded-lg border border-white/10" />}
                      <button onClick={() => setEditing({ ...editing, media: editing.media.filter(x => x.id !== md.id) })} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><X size={10} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/60">Quiz (multiple choice, graded)</label>
                <button onClick={addQuestion} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"><Plus size={11} />Add question</button>
              </div>
              {editing.quiz.length === 0 && <div className="text-[11px] text-white/30">No quiz — this module is instructions-only, marked complete on read.</div>}
              <div className="space-y-3">
                {editing.quiz.map((q, qi) => (
                  <Glass key={q.id} className="p-3 !bg-black/40 space-y-2">
                    <div className="flex items-center gap-2">
                      <GInput value={q.question} onChange={(e: any) => updateQuestion(q.id, { question: e.target.value })} placeholder={`Question ${qi + 1}`} className="flex-1 !text-xs" />
                      <button onClick={() => removeQuestion(q.id)} className="p-1 text-white/30 hover:text-danger-400 flex-shrink-0"><Trash2 size={12} /></button>
                    </div>
                    <div className="space-y-1.5 pl-1">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="radio" checked={q.correctIndex === oi} onChange={() => updateQuestion(q.id, { correctIndex: oi })} className="accent-green-600 flex-shrink-0" />
                          <GInput value={opt} onChange={(e: any) => updateQuestion(q.id, { options: q.options.map((o, i) => i === oi ? e.target.value : o) })} placeholder={`Option ${oi + 1}`} className="flex-1 !text-xs !py-1" />
                          {q.options.length > 2 && <button onClick={() => updateQuestion(q.id, { options: q.options.filter((_, i) => i !== oi) })} className="p-1 text-white/20 hover:text-brand-400 flex-shrink-0"><X size={11} /></button>}
                        </div>
                      ))}
                      {q.options.length < 6 && <button onClick={() => updateQuestion(q.id, { options: [...q.options, ""] })} className="text-[10px] text-white/40 hover:text-white/70 pl-6">+ Add option</button>}
                    </div>
                  </Glass>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <GBtn variant="ghost" onClick={() => { setShowBuilder(false); setEditing(null); }} className="flex-1">Cancel</GBtn>
              <GBtn onClick={save} className="flex-1">Save Module</GBtn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
