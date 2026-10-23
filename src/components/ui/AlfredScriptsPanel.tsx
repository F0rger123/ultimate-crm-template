// Alfred content-script generator panel — wired into AlfredPage as a slide-
// over panel (same open/close pattern as its existing Memory panel). Covers:
// generate scripts/viral ideas by category, swipe/button accept-decline,
// a saved-scripts library (Supabase-backed, owner-scoped), a "remind me to
// record" button reusing the existing alfred_reminders mechanism, and a
// before/after photo picker off completed jobs that hands a caption + photo
// off to SocialPage's New Post flow.
import React, { useEffect, useState } from "react";
import { X, Sparkles, Bot, Trash2, Bell, Image as ImageIcon, Send, Loader2, Edit } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { uid, withTimeout } from "../../lib/utils";
import { SCRIPT_CATEGORIES, categoryMeta, generateVideoScript, type GeneratedScript } from "../../lib/alfredScripts";
import type { AppSettings, Job } from "../../types";
import { GBtn } from "./GBtn";
import { ScriptSwiper } from "./ScriptSwiper";

interface SavedScript {
  id: string;
  category: string;
  title: string;
  script_content: string;
  status: string;
  source: string;
  photo_url?: string | null;
  job_id?: string | null;
  created_at: string;
}

export function AlfredScriptsPanel({
  open = true,
  onClose,
  settings,
  jobs = [],
  ownerId = "",
  toast,
  onNav,
  embedded = false,
  onSendToSocial,
}: {
  open?: boolean;
  onClose?: () => void;
  settings: AppSettings;
  jobs?: Job[];
  ownerId?: string;
  toast?: (msg: string, tone?: string) => void;
  onNav?: (page: string) => void;
  // Relocated from Alfred's chat slide-over into a Social page tab — embedded
  // renders the same generate/library/reminders/photos UI inline (no fixed
  // backdrop/drawer, no close button) since SocialPage's own tab bar is now
  // what shows/hides it.
  embedded?: boolean;
  // When mounted inside SocialPage itself, the old localStorage-handoff +
  // onNav("social") round trip is a no-op (already on the page, and its
  // prefill effect only runs on mount) — this lets the host page fill its
  // own New Post form directly instead.
  onSendToSocial?: (caption: string, photoUrl: string | null) => void;
}) {
  const [tab, setTab] = useState<"generate" | "library" | "record" | "photos">("generate");
  const [category, setCategory] = useState("informational");
  const [queue, setQueue] = useState<GeneratedScript[]>([]);
  const [generating, setGenerating] = useState(false);
  const [library, setLibrary] = useState<SavedScript[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [swiping, setSwiping] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; jobId: string } | null>(null);

  // Recording reminder state — mirrors AccountabilityPage's Alfred reminder
  // pattern exactly (same alfred_reminders table + check-reminders.ts cron).
  const [reminderTime, setReminderTime] = useState("10:00");
  const [reminderFreq, setReminderFreq] = useState<"once" | "daily" | "weekly">("weekly");
  const [schedulingReminder, setSchedulingReminder] = useState(false);

  useEffect(() => {
    if (!open || !ownerId || libraryLoaded) return;
    (async () => {
      try {
        const res: any = await withTimeout(
          (supabase as any).from("alfred_scripts").select("*").eq("owner_id", ownerId).eq("status", "saved").order("created_at", { ascending: false }),
          10000,
          "Load saved scripts"
        );
        if (res.error) throw res.error;
        setLibrary(res.data || []);
        setLibraryLoaded(true);
      } catch (e: any) {
        console.warn("[Alfred Scripts] load failed:", e?.message);
        toast?.("Couldn't load saved scripts — " + (e?.message || "unknown error"), "red");
      }
    })();
  }, [open, ownerId, libraryLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (n = 1) => {
    setGenerating(true);
    try {
      const results: GeneratedScript[] = [];
      for (let i = 0; i < n; i++) {
        const r = await withTimeout(generateVideoScript({ category, settings, jobs }), 30000, "Script generation");
        results.push(r);
      }
      setQueue(prev => [...prev, ...results]);
      toast?.(`${n > 1 ? n + " scripts" : "Script"} generated ✓`);
    } catch (e: any) {
      toast?.("Couldn't generate script — " + (e?.message || "unknown error"), "red");
    } finally {
      setGenerating(false);
    }
  };

  const persistDecision = async (item: GeneratedScript, status: "saved" | "declined") => {
    if (!ownerId) { toast?.("No owner id — can't save to your account", "red"); return; }
    const row = {
      id: uid(),
      owner_id: ownerId,
      category: item.category,
      title: item.title,
      script_content: item.script,
      status,
      source: "ai_generated",
    };
    try {
      const res: any = await withTimeout((supabase as any).from("alfred_scripts").insert(row), 10000, status === "saved" ? "Save script" : "Log pass");
      if (res.error) throw res.error;
      if (status === "saved") {
        setLibrary(prev => [{ ...row, photo_url: null, job_id: null, created_at: new Date().toISOString() }, ...prev]);
        toast?.("Saved to your library — see the Saved tab ✓");
      } else {
        // FEATURE — swipe left previously gave zero feedback (no toast at
        // all), which on mobile read as "nothing happened" even though it
        // was correctly logging the pass — a swipe that seems to do nothing
        // is indistinguishable from a swipe gesture that didn't register.
        toast?.("Passed");
      }
    } catch (e: any) {
      toast?.((status === "saved" ? "Save failed — " : "Couldn't log pass — ") + (e?.message || "unknown error"), "red");
    }
  };

  const onAccept = (item: GeneratedScript) => {
    setSwiping(true);
    persistDecision(item, "saved").finally(() => {
      setQueue(prev => prev.slice(1));
      setSwiping(false);
    });
  };
  const onDecline = (item: GeneratedScript) => {
    setSwiping(true);
    persistDecision(item, "declined").finally(() => {
      setQueue(prev => prev.slice(1));
      setSwiping(false);
    });
  };

  // FEATURE — "add the ability to add, import, save, edit, and delete their
  // own ideas." Generate/save/delete already existed; this adds a manual
  // entry point (type or paste your own script/idea — "import" in the
  // sense of bringing in something written elsewhere) and editing a saved
  // one in place, both writing to the exact same alfred_scripts table/RLS
  // as the AI-generated path so they show up side by side in Saved.
  const [manualDraft, setManualDraft] = useState<{ id: string; title: string; category: string; script_content: string } | null>(null);
  const saveManual = async () => {
    if (!manualDraft || !manualDraft.title.trim() || !manualDraft.script_content.trim()) { toast?.("Give it a title and some content first", "yellow"); return; }
    if (!ownerId) { toast?.("No owner id — can't save to your account", "red"); return; }
    const isNew = !library.some(s => s.id === manualDraft.id);
    const row = { id: manualDraft.id, owner_id: ownerId, category: manualDraft.category, title: manualDraft.title.trim(), script_content: manualDraft.script_content.trim(), status: "saved", source: isNew ? "manual" : undefined };
    try {
      const res: any = isNew
        ? await withTimeout((supabase as any).from("alfred_scripts").insert(row), 10000, "Save script")
        : await withTimeout((supabase as any).from("alfred_scripts").update({ title: row.title, category: row.category, script_content: row.script_content }).eq("id", row.id).eq("owner_id", ownerId), 10000, "Update script");
      if (res.error) throw res.error;
      setLibrary(prev => isNew ? [{ ...row, source: "manual", photo_url: null, job_id: null, created_at: new Date().toISOString() } as SavedScript, ...prev] : prev.map(s => s.id === row.id ? { ...s, title: row.title, category: row.category, script_content: row.script_content } : s));
      toast?.(isNew ? "Idea added ✓" : "Idea updated ✓");
      setManualDraft(null);
    } catch (e: any) {
      toast?.("Save failed — " + (e?.message || "unknown error"), "red");
    }
  };

  const deleteSaved = async (id: string) => {
    const prevLib = library;
    setLibrary(prev => prev.filter(s => s.id !== id));
    try {
      const res: any = await withTimeout((supabase as any).from("alfred_scripts").delete().eq("id", id).eq("owner_id", ownerId), 10000, "Delete script");
      if (res.error) throw res.error;
      toast?.("Deleted ✓");
    } catch (e: any) {
      setLibrary(prevLib);
      toast?.("Delete failed — " + (e?.message || "unknown error"), "red");
    }
  };

  const scheduleRecordingReminder = async () => {
    const phone = (settings as any)?.myPhone;
    if (!phone) { toast?.("Set your mobile number in Settings → Company first", "red"); return; }
    if (!ownerId) { toast?.("No owner id — can't schedule", "red"); return; }
    setSchedulingReminder(true);
    try {
      let [hh, mm] = reminderTime.split(":").map(Number);
      const due = new Date();
      due.setHours(hh, mm, 0, 0);
      if (due.getTime() <= Date.now()) due.setDate(due.getDate() + 1);
      const res: any = await withTimeout(
        (supabase as any).from("alfred_reminders").insert({
          id: uid(),
          owner_id: ownerId,
          phone,
          message: "🎥 Record content! Grab a before/after clip or a quick tip video for socials — open Alfred → Scripts for an idea.",
          due_at: due.toISOString(),
          sent: false,
          recurring: reminderFreq === "once" ? null : reminderFreq,
        }),
        10000,
        "Schedule recording reminder"
      );
      if (res.error) throw res.error;
      toast?.(`📲 Alfred will text you to record content ${reminderFreq === "once" ? "at " + reminderTime : reminderFreq === "daily" ? "every day at " + reminderTime : "every week at " + reminderTime} ✓`);
    } catch (e: any) {
      toast?.("Couldn't schedule reminder — " + (e?.message || "unknown error"), "red");
    } finally {
      setSchedulingReminder(false);
    }
  };

  const jobsWithBeforeAfter = (jobs || []).filter(
    (j: any) => j.status === "completed" && (j.photos || []).some((p: any) => p.type === "before" || p.type === "after")
  );

  const sendToSocial = (caption: string) => {
    try {
      if (onSendToSocial) {
        onSendToSocial(caption, selectedPhoto?.url || null);
        toast?.("Loaded into New Post — review and schedule ✓");
        return;
      }
      localStorage.setItem("crm.socialPrefill", JSON.stringify({
        caption,
        photoUrl: selectedPhoto?.url || null,
        createdAt: Date.now(),
      }));
      toast?.("Sent to Social — opening New Post ✓");
      onNav?.("social");
      onClose?.();
    } catch (e: any) {
      toast?.("Couldn't hand off to Social — " + (e?.message || "unknown error"), "red");
    }
  };

  if (!open) return null;

  const body = (
    <>
        {!embedded && (
          <div className="p-4 border-b border-brand-900/30 flex items-center gap-3 flex-shrink-0">
            <div className="p-2 rounded-lg bg-orange-900/30"><Sparkles size={14} className="text-orange-400" /></div>
            <div className="flex-1">
              <div className="font-semibold text-sm">Content Scripts</div>
              <div className="text-[10px] text-white/50">Viral ideas, scripts, and post-ready before/afters</div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5"><X size={14} /></button>
          </div>
        )}

        <div className="flex gap-1 p-2 border-b border-brand-900/20 flex-shrink-0 flex-wrap">
          {[
            { k: "generate", l: "Generate", icon: Sparkles },
            { k: "library", l: `Saved (${library.length})`, icon: Bot },
            { k: "record", l: "Reminders", icon: Bell },
            { k: "photos", l: "Photos", icon: ImageIcon },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.k} onClick={() => setTab(t.k as any)} className={"flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition " + (tab === t.k ? "bg-brand-900/40 text-white border border-brand-500/50" : "bg-white/5 text-white/50 border border-transparent hover:text-white")}>
                <Icon size={10} />{t.l}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === "generate" && (
            <>
              <div className="grid grid-cols-1 gap-1.5">
                {SCRIPT_CATEGORIES.map(c => (
                  <button key={c.key} onClick={() => setCategory(c.key)} className={"text-left px-3 py-2 rounded-xl border text-xs transition " + (category === c.key ? "bg-orange-900/30 border-orange-600/50 text-white" : "bg-white/5 border-white/10 text-white/60 hover:text-white")}>
                    <div className="font-semibold">{c.emoji} {c.label}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{c.desc}</div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <GBtn onClick={() => generate(1)} disabled={generating} className="flex-1 !text-xs">
                  {generating ? <><Loader2 size={12} className="inline mr-1.5 animate-spin" />Generating…</> : <><Sparkles size={12} className="inline mr-1.5" />Generate</>}
                </GBtn>
                <GBtn variant="ghost" onClick={() => generate(3)} disabled={generating} className="!text-xs">+3 ideas</GBtn>
              </div>

              {queue.length > 0 ? (
                <div className="pt-2">
                  <div className="text-[10px] text-white/40 mb-2">{queue.length} to review</div>
                  <ScriptSwiper
                    key={queue.length + ":" + queue[0].title}
                    title={queue[0].title}
                    category={queue[0].category}
                    categoryLabel={categoryMeta(queue[0].category).emoji + " " + categoryMeta(queue[0].category).label}
                    script={queue[0].script}
                    busy={swiping}
                    onAccept={() => onAccept(queue[0])}
                    onDecline={() => onDecline(queue[0])}
                  />
                </div>
              ) : (
                <div className="text-center py-10 text-xs text-white/40">
                  <Sparkles size={26} className="mx-auto mb-2 opacity-30" />
                  Pick a category and generate to get your first script.
                </div>
              )}
            </>
          )}

          {tab === "library" && (
            <div className="space-y-2">
              {manualDraft ? (
                <div className="p-3 bg-white/5 border border-orange-700/40 rounded-xl space-y-2">
                  <input value={manualDraft.title} onChange={e => setManualDraft(d => d ? { ...d, title: e.target.value } : d)} placeholder="Title" className="w-full bg-black/40 border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white placeholder-white/30" />
                  <select value={manualDraft.category} onChange={e => setManualDraft(d => d ? { ...d, category: e.target.value } : d)} className="w-full bg-black/40 border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white">
                    {SCRIPT_CATEGORIES.map(c => <option key={c.key} value={c.key} className="bg-black">{c.emoji} {c.label}</option>)}
                  </select>
                  <textarea value={manualDraft.script_content} onChange={e => setManualDraft(d => d ? { ...d, script_content: e.target.value } : d)} rows={6} placeholder="Write or paste your idea/script here…" className="w-full bg-black/40 border border-white/15 rounded-lg px-2.5 py-2 text-xs text-white placeholder-white/30 resize-none font-mono" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setManualDraft(null)} className="px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white transition">Cancel</button>
                    <GBtn onClick={saveManual} className="!text-xs">Save</GBtn>
                  </div>
                </div>
              ) : (
                <button onClick={() => setManualDraft({ id: uid(), title: "", category: "informational", script_content: "" })} className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-xs text-white/50 hover:text-white hover:border-white/30 transition">+ Add Your Own Idea</button>
              )}
              {library.length === 0 && (
                <div className="text-center py-10 text-xs text-white/40">
                  <Bot size={26} className="mx-auto mb-2 opacity-30" />
                  No saved scripts yet — swipe right (or hit Save) on one you like, or add your own above.
                </div>
              )}
              {library.map(s => (
                <div key={s.id} className="group p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[9px] uppercase tracking-wider text-orange-400/70">{categoryMeta(s.category).label}</div>
                      <div className="text-xs font-semibold mt-0.5">{s.title}</div>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                      <button onClick={() => setManualDraft({ id: s.id, title: s.title, category: s.category, script_content: s.script_content })} className="p-1 text-white/40 hover:text-white"><Edit size={11} /></button>
                      <button onClick={() => deleteSaved(s.id)} className="p-1 text-white/40 hover:text-danger-400"><Trash2 size={11} /></button>
                    </div>
                  </div>
                  <div className="text-[11px] text-white/60 whitespace-pre-wrap leading-relaxed mt-2 line-clamp-6">{s.script_content}</div>
                  <button onClick={() => sendToSocial(s.script_content)} className="mt-2 flex items-center gap-1 text-[10px] text-orange-300 hover:text-orange-200"><Send size={10} />Send to Social as caption</button>
                </div>
              ))}
            </div>
          )}

          {tab === "record" && (
            <div className="space-y-3">
              <p className="text-xs text-white/60">Alfred will text you a reminder to record content — same mechanism as text-Alfred's "remind me" (needs your mobile number in Settings → Company).</p>
              <div className="flex gap-2 items-center">
                <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)} className="bg-black/40 border border-brand-900/30 rounded-lg px-2.5 py-2 text-xs text-white flex-1" />
                <select value={reminderFreq} onChange={e => setReminderFreq(e.target.value as any)} className="bg-black/40 border border-brand-900/30 rounded-lg px-2.5 py-2 text-xs text-white">
                  <option value="once" className="bg-black">Once</option>
                  <option value="daily" className="bg-black">Daily</option>
                  <option value="weekly" className="bg-black">Weekly</option>
                </select>
              </div>
              <GBtn onClick={scheduleRecordingReminder} disabled={schedulingReminder} className="w-full !text-xs">
                {schedulingReminder ? <><Loader2 size={12} className="inline mr-1.5 animate-spin" />Scheduling…</> : <><Bell size={12} className="inline mr-1.5" />Remind me to record</>}
              </GBtn>
            </div>
          )}

          {tab === "photos" && (
            <div className="space-y-3">
              <p className="text-xs text-white/60">Pick a before/after from a completed job to pair with a script before sending it to Social.</p>
              {jobsWithBeforeAfter.length === 0 && (
                <div className="text-center py-10 text-xs text-white/40">
                  <ImageIcon size={26} className="mx-auto mb-2 opacity-30" />
                  No completed jobs with before/after photos yet.
                </div>
              )}
              {jobsWithBeforeAfter.map((j: any) => (
                <div key={j.id} className="p-2.5 bg-white/5 border border-white/5 rounded-xl">
                  <div className="text-[10px] text-white/50 mb-1.5 truncate">{j.address}</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(j.photos || []).filter((p: any) => p.type === "before" || p.type === "after").slice(0, 8).map((p: any) => {
                      const src = p.url || p.dataUrl;
                      const isSelected = selectedPhoto?.url === src;
                      return (
                        <button key={p.id} onClick={() => setSelectedPhoto({ url: src, jobId: j.id })} className={"relative rounded-lg overflow-hidden border-2 aspect-square " + (isSelected ? "border-orange-500" : "border-transparent")}>
                          {src ? <img src={src} alt={p.type} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-white/10" />}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[7px] text-white text-center py-0.5 uppercase">{p.type}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {selectedPhoto && (
                <div className="p-2.5 bg-orange-950/20 border border-orange-800/40 rounded-xl flex items-center gap-2">
                  <img src={selectedPhoto.url} alt="selected" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  <div className="text-[10px] text-orange-300 flex-1">Photo selected — pick a script from Saved and hit "Send to Social" to pair them.</div>
                  <button onClick={() => setSelectedPhoto(null)} className="text-white/40 hover:text-white"><X size={12} /></button>
                </div>
              )}
            </div>
          )}
        </div>
    </>
  );

  if (embedded) {
    return <div className="w-full flex flex-col">{body}</div>;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-black/95 border-l border-brand-900/40 z-50 flex flex-col backdrop-blur-xl">
        {body}
      </div>
    </>
  );
}
