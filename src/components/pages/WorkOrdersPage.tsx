// WorkOrdersPage.tsx — dedicated section for commercial/night job work
// orders (e.g. Home Depot, Lowe's). A work order is still an ordinary Job
// row (isWorkOrder: true, migration 0094) — same jobs table, same field-
// portal/checklist/photo machinery — this page is a filtered view + a
// creation flow, not a separate entity. See JobsPage.tsx's "This is a work
// order" section for the manual-entry fields this page's "New Work Order"
// button reuses (autoOpenNewWorkOrder), and EmployeePortal.tsx's Work Order
// Requirements card for how the field crew sees the photo/video
// requirements created here.
import React, { useState } from "react";
import { ClipboardCheck, Upload, X, Plus, CheckCircle, AlertTriangle, FileText, Camera, Trash2 } from "lucide-react";
import { fmt, uid, today, compressImageFile, dataUrlToBlob, uploadJobMedia } from "../../lib/utils";
import { callModel, MODELS } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import type { Job, Customer, AppSettings } from "../../types";
import { Glass } from "../ui/Glass";
import { GBtn } from "../ui/GBtn";
import { GInput } from "../ui/GInput";
import { GSel } from "../ui/GSel";
import { GDate } from "../ui/GDate";
import { GTxt } from "../ui/GTxt";
import { Badge } from "../ui/Badge";
import { Modal } from "../ui/Modal";

type Extracted = {
  workOrderNumber: string; workOrderClient: string; address: string; requestedDate: string;
  requiresManagerSignoff: boolean; notes: string;
  photoRequirements: { id: string; label: string; kind: "photo" | "video"; minCount: number; instructions: string }[];
  customerNameGuess: string;
};

const emptyExtracted = (): Extracted => ({
  workOrderNumber: "", workOrderClient: "", address: "", requestedDate: "", requiresManagerSignoff: false, notes: "",
  photoRequirements: [], customerNameGuess: "",
});

export function WorkOrdersPage({
  jobs = [], setJobs, customers = [], setCustomers, employees = [], settings = {} as AppSettings, toast = (() => {}) as any, ownerId = "",
  onOpenJob = (_id: string) => {}, onNewWorkOrder = () => {}, markRecentlyDeleted = (_t: "jobs", _ids: string[]) => {},
}: {
  jobs?: Job[]; setJobs?: any; customers?: Customer[]; setCustomers?: any; employees?: any[]; settings?: AppSettings; toast?: any; ownerId?: string;
  onOpenJob?: (id: string) => void; onNewWorkOrder?: () => void; markRecentlyDeleted?: (table: "jobs", ids: string[]) => void;
}) {
  // A work order is a job row — deleting it removes the job on the server
  // and marks it deleted so the sync / autosave can't bring it back.
  const deleteWorkOrder = async (j: any) => {
    if (!window.confirm(`Delete work order ${j.workOrderNumber ? "#" + j.workOrderNumber : ""} (${j.workOrderClient || j.address || "no client"})? This can't be undone.`)) return;
    setJobs?.((prev: any[]) => prev.filter((x: any) => x.id !== j.id));
    markRecentlyDeleted("jobs", [j.id]);
    try {
      const { data, error } = await (supabase as any).from("jobs").delete().eq("id", j.id).select("id");
      if (error) toast("Deleted here, but the server didn't delete it — " + error.message, "red");
      else if (!data?.length) toast("Deleted here, but the server didn't delete it (it may belong to another account)", "red");
      else toast("Work order deleted ✓", "green");
    } catch (e: any) {
      toast("Deleted here, but the server didn't delete it — " + (e?.message || "unknown error"), "red");
    }
  };
  const workOrders = (jobs as any[]).filter(j => j.isWorkOrder);
  const [tab, setTab] = useState<"active" | "needs_review" | "completed">("active");
  const active = workOrders.filter(j => j.status === "scheduled" || j.status === "in_progress");
  const needsReview = workOrders.filter(j => j.status === "completed" && j.requiresManagerSignoff && !j.managerSignedAt);
  const completed = workOrders.filter(j => j.status === "completed" && (!j.requiresManagerSignoff || j.managerSignedAt));
  const shown = tab === "active" ? active : tab === "needs_review" ? needsReview : completed;

  const reqProgress = (j: any) => {
    const reqs: any[] = j.photoRequirements || [];
    if (reqs.length === 0) return null;
    const tags = j.photoRequirementTags || {};
    const met = reqs.filter(r => {
      const count = r.kind === "video" ? (j.videos || []).filter((v: any) => tags[v.id] === r.id).length : (j.photos || []).filter((p: any) => tags[p.id] === r.id).length;
      return count >= r.minCount;
    }).length;
    return { met, total: reqs.length };
  };

  // ── OCR / vision digitization — "upload a photo of the paper work order,
  // digitize it automatically." Uses Claude (the only provider this app's
  // call-model.ts proxy forwards raw image content blocks for — see that
  // file's OpenAI branch, which currently strips non-text blocks) via the
  // owner's own Anthropic key in Settings → AI Models. Never auto-creates
  // the job from the model's guess — always lands in an editable review
  // step first, same "never trust blindly" rule Alfred's own tools follow.
  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedImage, setScannedImage] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [reviewCustomerId, setReviewCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [creating, setCreating] = useState(false);

  const resetScan = () => { setScanOpen(false); setScanning(false); setScannedImage(null); setExtracted(null); setReviewCustomerId(""); setNewCustomerName(""); };

  const runOcr = async (file: File) => {
    const anthropicKey = (settings as any)?.modelKeys?.claude;
    if (!anthropicKey) {
      toast("Add an Anthropic API key in Settings → AI Models to use photo scanning.", "red");
      return;
    }
    setScanning(true);
    try {
      const dataUrl = await compressImageFile(file, 2000, 0.85);
      setScannedImage(dataUrl);
      const base64 = dataUrl.split(",")[1] || "";
      const mediaType = /data:(.*?);base64/.exec(dataUrl)?.[1] || "image/jpeg";
      const res = await callModel({
        modelId: "claude",
        systemPrompt: "You read photographed paper work orders for a service/commercial-services business and extract structured data. Reply with ONLY compact JSON, no prose, no markdown fences, matching this exact shape: {\"workOrderNumber\":string,\"workOrderClient\":string,\"address\":string,\"requestedDate\":string (YYYY-MM-DD if a real date is legible, else empty),\"requiresManagerSignoff\":boolean,\"notes\":string,\"customerNameGuess\":string,\"photoRequirements\":[{\"label\":string,\"kind\":\"photo\"|\"video\",\"minCount\":number,\"instructions\":string}]}. Never invent a work order number, date, or requirement count that isn't actually legible in the image — leave those fields empty/omit them rather than guessing.",
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Extract this work order into the JSON shape described in your instructions." },
          ],
        }],
        maxTokens: 1500,
      });
      const raw = (res?.text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch { throw new Error("Couldn't read a valid response from the model — try a clearer photo."); }
      const ex: Extracted = {
        workOrderNumber: String(parsed.workOrderNumber || ""),
        workOrderClient: String(parsed.workOrderClient || ""),
        address: String(parsed.address || ""),
        requestedDate: /^\d{4}-\d{2}-\d{2}$/.test(parsed.requestedDate) ? parsed.requestedDate : "",
        requiresManagerSignoff: !!parsed.requiresManagerSignoff,
        notes: String(parsed.notes || ""),
        customerNameGuess: String(parsed.customerNameGuess || ""),
        photoRequirements: Array.isArray(parsed.photoRequirements)
          ? parsed.photoRequirements.map((r: any) => ({ id: uid(), label: String(r.label || ""), kind: r.kind === "video" ? "video" : "photo", minCount: Math.max(1, Number(r.minCount) || 1), instructions: String(r.instructions || "") })).filter((r: any) => r.label)
          : [],
      };
      setExtracted(ex);
      // Best-effort customer match by name — never auto-selected silently
      // without the owner seeing/confirming it in the review form below.
      if (ex.customerNameGuess) {
        const guess = ex.customerNameGuess.trim().toLowerCase();
        const match = customers.find(c => `${c.firstName} ${c.lastName}`.trim().toLowerCase() === guess);
        if (match) setReviewCustomerId(match.id); else setNewCustomerName(ex.customerNameGuess);
      }
      toast("Scanned — review the details below before creating the job.", "green");
    } catch (e: any) {
      toast("Scan failed — " + (e?.message || "unknown error"), "red");
    } finally {
      setScanning(false);
    }
  };

  const createFromScan = async () => {
    if (!extracted || creating) return;
    if (!reviewCustomerId && !newCustomerName.trim()) { toast("Pick or type a customer first", "red"); return; }
    setCreating(true);
    try {
      let customerId = reviewCustomerId;
      if (!customerId) {
        const parts = newCustomerName.trim().split(" ");
        const newCust = { id: uid(), firstName: parts[0] || newCustomerName.trim(), lastName: parts.slice(1).join(" ") || "", email: "", phone: "", address: extracted.address || "", totalSpent: 0, createdAt: today(), notes: "", gateCode: "", hasDog: false, dogName: "", sensitivePlants: "", owner_id: ownerId };
        const { data, error } = await (supabase as any).from("customers").insert(newCust).select().single();
        if (error || !data) throw new Error(error?.message || "Couldn't create customer");
        customerId = data.id;
        setCustomers?.((prev: any[]) => [...prev, data]);
      }
      const scanPhotoId = uid();
      let scanPhoto: any = null;
      if (scannedImage) {
        const jobIdForPath = uid();
        const url = await uploadJobMedia(dataUrlToBlob(scannedImage), `${jobIdForPath}/work-order-scan-${scanPhotoId}.jpg`, "image/jpeg");
        scanPhoto = url ? { id: scanPhotoId, type: "before", pairIndex: 0, caption: "Original work order scan", url, uploadedAt: today() } : { id: scanPhotoId, type: "before", pairIndex: 0, caption: "Original work order scan", dataUrl: scannedImage, uploadedAt: today() };
      }
      const newJob: any = {
        id: uid(), customerId,
        address: extracted.address || customers.find(c => c.id === customerId)?.address || "",
        amount: 0, status: "scheduled", scheduledDate: extracted.requestedDate || today(),
        scheduledTime: "", priority: "normal", jobType: "commercial",
        notes: extracted.notes || "",
        crew: [], checklist: [], photos: scanPhoto ? [scanPhoto] : [], commLog: [], chemicalsUsed: [], equipment: [], tags: [],
        loggedHours: 0, createdAt: today(), owner_id: ownerId,
        isWorkOrder: true, workOrderNumber: extracted.workOrderNumber, workOrderClient: extracted.workOrderClient,
        requiresManagerSignoff: extracted.requiresManagerSignoff, photoRequirements: extracted.photoRequirements,
      };
      const { data: saved, error: saveErr } = await (supabase as any).from("jobs").insert(newJob).select().single();
      if (saveErr || !saved) throw new Error(saveErr?.message || "Couldn't save the job");
      setJobs?.((prev: any[]) => [...prev, saved]);
      toast("Work order created from scan ✓", "green");
      resetScan();
      onOpenJob(saved.id);
    } catch (e: any) {
      toast("Couldn't create the job — " + (e?.message || "unknown error"), "red");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xl font-bold flex items-center gap-2"><ClipboardCheck size={20} className="text-purple-400" />Work Orders</div>
          <div className="text-xs text-white/40 mt-0.5">Commercial & night jobs — Home Depot, Lowe's, and similar clients.</div>
        </div>
        <div className="flex items-center gap-2">
          <GBtn variant="ghost" onClick={() => setScanOpen(true)} className="!text-xs"><Camera size={13} className="inline mr-1.5" />Scan Paper Work Order</GBtn>
          <GBtn onClick={onNewWorkOrder} className="!text-xs"><Plus size={13} className="inline mr-1.5" />New Work Order</GBtn>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Glass className="p-3 text-center"><div className="text-2xl font-black text-blue-400">{active.length}</div><div className="text-[10px] text-white/40 uppercase tracking-wider">Active</div></Glass>
        <Glass className="p-3 text-center"><div className="text-2xl font-black text-yellow-400">{needsReview.length}</div><div className="text-[10px] text-white/40 uppercase tracking-wider">Needs Sign-Off</div></Glass>
        <Glass className="p-3 text-center"><div className="text-2xl font-black text-green-400">{completed.length}</div><div className="text-[10px] text-white/40 uppercase tracking-wider">Completed</div></Glass>
      </div>

      <div className="flex gap-1 p-1 bg-white/5 border border-white/10 rounded-xl">
        {([["active", "Active"], ["needs_review", "Needs Sign-Off"], ["completed", "Completed"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} className={"flex-1 py-2 rounded-lg text-xs font-medium transition " + (tab === key ? "bg-purple-700/40 text-white border border-purple-700/50" : "text-white/50")}>{label}</button>
        ))}
      </div>

      <div className="space-y-2.5">
        {shown.length === 0 && <div className="text-center py-10 text-white/30 text-sm">No work orders here yet.</div>}
        {shown.map(j => {
          const c = customers.find(x => x.id === (j as any).customerId);
          const prog = reqProgress(j);
          return (
            <Glass key={j.id} className="p-4 cursor-pointer hover:border-purple-600/40 transition" onClick={() => onOpenJob(j.id)}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    {(j as any).workOrderClient || "Work Order"}
                    {(j as any).workOrderNumber && <span className="text-white/40 font-normal text-xs">#{(j as any).workOrderNumber}</span>}
                  </div>
                  <div className="text-xs text-white/50">{c ? `${c.firstName} ${c.lastName}` : "No customer linked"} · {j.address}</div>
                  <div className="text-[11px] text-white/40 mt-0.5">{j.scheduledDate}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {prog && (
                    <Badge tone={prog.met === prog.total ? "green" : "yellow"}>{prog.met}/{prog.total} reqs</Badge>
                  )}
                  {(j as any).requiresManagerSignoff && (
                    (j as any).managerSignedAt
                      ? <Badge tone="green"><CheckCircle size={10} className="inline mr-1" />Signed</Badge>
                      : <Badge tone="yellow"><AlertTriangle size={10} className="inline mr-1" />Needs Sign-Off</Badge>
                  )}
                  <Badge tone={j.status === "completed" ? "green" : j.status === "in_progress" ? "yellow" : "blue"}>{(j.status || "").replace("_", " ")}</Badge>
                  <button onClick={e => { e.stopPropagation(); deleteWorkOrder(j); }} title="Delete work order" className="p-1.5 rounded-lg text-white/40 hover:text-danger-400 hover:bg-brand-900/30 transition"><Trash2 size={14} /></button>
                </div>
              </div>
            </Glass>
          );
        })}
      </div>

      {/* ── Scan & Digitize modal ────────────────────────────────────────── */}
      <Modal open={scanOpen} onClose={resetScan} title="Scan Paper Work Order" maxW="max-w-lg">
        <div className="space-y-4">
          {!extracted && (
            <div>
              <label className="cursor-pointer block">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) runOcr(f); e.target.value = ""; }} />
                <div className="flex flex-col items-center justify-center gap-2 p-8 rounded-2xl border-2 border-dashed border-purple-700/40 bg-purple-950/10 hover:bg-purple-950/20 transition text-center">
                  <Upload size={28} className="text-purple-400" />
                  <div className="text-sm font-semibold text-white/80">{scanning ? "Reading the photo…" : "Upload or take a photo of the work order"}</div>
                  <div className="text-[11px] text-white/40">Claude reads it and extracts the details for you to review below.</div>
                </div>
              </label>
              {scanning && <div className="mt-3 flex justify-center"><div className="w-5 h-5 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" /></div>}
            </div>
          )}
          {extracted && (
            <div className="space-y-3">
              {scannedImage && <img src={scannedImage} alt="Scanned work order" className="w-full max-h-48 object-cover rounded-xl border border-white/10" />}
              <div className="text-[11px] text-yellow-300 bg-yellow-950/20 border border-yellow-700/30 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                <AlertTriangle size={11} className="flex-shrink-0" />Review everything below before creating — the scan can misread text.
              </div>
              <div>
                <label className="text-xs text-white/60 mb-1 block">Customer</label>
                {customers.length > 0 && (
                  <GSel value={reviewCustomerId} onChange={e => { setReviewCustomerId(e.target.value); if (e.target.value) setNewCustomerName(""); }} className="mb-1.5">
                    <option value="" className="bg-black">— Select existing —</option>
                    {customers.map(c => <option key={c.id} value={c.id} className="bg-black">{c.firstName} {c.lastName}</option>)}
                  </GSel>
                )}
                {!reviewCustomerId && (
                  <GInput placeholder="Or type a new customer/company name" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} />
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="text-[10px] text-white/50 mb-1 block">Work Order #</label><GInput value={extracted.workOrderNumber} onChange={e => setExtracted({ ...extracted, workOrderNumber: e.target.value })} /></div>
                <div><label className="text-[10px] text-white/50 mb-1 block">Client</label><GInput value={extracted.workOrderClient} onChange={e => setExtracted({ ...extracted, workOrderClient: e.target.value })} /></div>
              </div>
              <div><label className="text-[10px] text-white/50 mb-1 block">Address</label><GInput value={extracted.address} onChange={e => setExtracted({ ...extracted, address: e.target.value })} /></div>
              <div><label className="text-[10px] text-white/50 mb-1 block">Requested Date</label><GDate value={extracted.requestedDate} onChange={e => setExtracted({ ...extracted, requestedDate: e.target.value })} /></div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={extracted.requiresManagerSignoff} onChange={e => setExtracted({ ...extracted, requiresManagerSignoff: e.target.checked })} className="accent-purple-600 w-3.5 h-3.5" />
                <span className="text-xs text-white/70">Requires manager sign-off</span>
              </label>
              <div>
                <label className="text-[10px] text-white/50 mb-1 block">Notes</label>
                <GTxt rows={2} value={extracted.notes} onChange={e => setExtracted({ ...extracted, notes: e.target.value })} />
              </div>
              {extracted.photoRequirements.length > 0 && (
                <div>
                  <label className="text-[10px] text-white/50 mb-1 block">Detected Photo/Video Requirements</label>
                  <div className="space-y-1.5">
                    {extracted.photoRequirements.map((r, i) => (
                      <div key={r.id} className="flex items-center gap-1.5 bg-black/30 border border-white/10 rounded-lg p-1.5">
                        <GInput value={r.label} onChange={e => setExtracted({ ...extracted, photoRequirements: extracted.photoRequirements.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) })} className="!text-xs flex-1" />
                        <GInput type="number" min="1" value={r.minCount} onChange={e => setExtracted({ ...extracted, photoRequirements: extracted.photoRequirements.map((x, idx) => idx === i ? { ...x, minCount: Math.max(1, Number(e.target.value) || 1) } : x) })} className="!text-xs !w-14" />
                        <button onClick={() => setExtracted({ ...extracted, photoRequirements: extracted.photoRequirements.filter((_, idx) => idx !== i) })} className="text-brand-400/70 hover:text-brand-300 p-1"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <GBtn onClick={createFromScan} disabled={creating} className="flex-1 !justify-center">{creating ? "Creating…" : "Create Work Order"}</GBtn>
                <GBtn variant="ghost" onClick={resetScan} disabled={creating}>Cancel</GBtn>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
