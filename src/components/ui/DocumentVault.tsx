// auto-extracted from CRM Starter monolith
import React, { useState, useEffect, useRef } from "react";
import { FileText, Plus, Download, Trash2 } from "lucide-react";
import { uid, today, dataUrlToBlob, withTimeout } from "../../lib/utils";
import { supabase } from "../../lib/supabase";

// FEATURE — rebuilt to sync via Supabase Storage + customers.documents
// (migration 0025) instead of usePersistent/localStorage. The old version
// stored uploaded files (insurance certs, contracts, HOA approvals) only on
// the ONE device/browser that uploaded them — an owner checking a commercial
// customer's insurance cert from a different device saw nothing at all.
const DOCS_BUCKET = "customer-docs";

export function DocumentVault({ customerId }: { customerId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const migrationAttemptedRef = useRef(false);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await (supabase as any).from("customers").select("documents").eq("id", customerId).maybeSingle();
        let serverDocs: any[] = (!error && Array.isArray(data?.documents)) ? data.documents : [];
        // One-time migration of any documents uploaded on THIS device before
        // this component synced via Supabase — without this, they'd silently
        // vanish from view the moment this device also starts reading from
        // Supabase instead of its own localStorage.
        if (serverDocs.length === 0 && !migrationAttemptedRef.current) {
          migrationAttemptedRef.current = true;
          let local: any[] = [];
          try { local = JSON.parse(localStorage.getItem("crm.docvault." + customerId) || "[]"); } catch { /* ignore */ }
          if (Array.isArray(local) && local.length > 0) {
            console.log("[DocumentVault] migrating", local.length, "locally-stored document(s) to Supabase Storage for customer", customerId);
            const migrated: any[] = [];
            for (const d of local) {
              if (!d.dataUrl) continue;
              try {
                const blob = dataUrlToBlob(d.dataUrl);
                const path = `${customerId}/${d.id}-${d.name}`;
                const { error: upErr } = await (supabase as any).storage.from(DOCS_BUCKET).upload(path, blob, { contentType: d.type || blob.type, upsert: true });
                if (upErr) { console.warn("[DocumentVault] migration upload failed for", d.name, ":", upErr.message); continue; }
                const { data: pub } = (supabase as any).storage.from(DOCS_BUCKET).getPublicUrl(path);
                migrated.push({ ...d, url: pub?.publicUrl, dataUrl: undefined });
              } catch (e: any) {
                console.warn("[DocumentVault] migration failed for", d.name, ":", e?.message);
              }
            }
            if (migrated.length > 0) {
              serverDocs = migrated;
              await (supabase as any).from("customers").update({ documents: migrated }).eq("id", customerId);
              try { localStorage.removeItem("crm.docvault." + customerId); } catch { /* ignore */ }
            }
          }
        }
        setDocs(serverDocs);
      } catch (e: any) {
        console.warn("[DocumentVault] load failed:", e?.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  const persist = async (next: any[]) => {
    setDocs(next);
    // BUG FIX (audit) — checked only `error` before; a 0-row RLS mismatch
    // resolves with no error at all (docs/ARCHITECTURE.md's "0-row silent success"),
    // so a real failure here never even reached this console.warn.
    const { error, data } = await (supabase as any).from("customers").update({ documents: next }).eq("id", customerId).select("id");
    if (error || !Array.isArray(data) || data.length === 0) console.warn("[DocumentVault] save failed:", error?.message || "0 rows matched");
  };

  const handleUpload = (e: any) => {
    const files = Array.from(e.target.files || []) as File[];
    setUploading(true);
    (async () => {
      const newDocs: any[] = [];
      for (const file of files) {
        const id = uid();
        const path = `${customerId}/${id}-${file.name}`;
        try {
          const { error: upErr } = await withTimeout<any>(
            (supabase as any).storage.from(DOCS_BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: true }),
            20000, "Document upload"
          );
          const category = file.name.toLowerCase().includes("insurance") ? "Insurance" : file.name.toLowerCase().includes("contract") ? "Contract" : file.name.toLowerCase().includes("waiver") ? "Waiver" : file.name.toLowerCase().includes("hoa") ? "HOA" : "Document";
          if (upErr) {
            console.warn("[DocumentVault] upload failed for", file.name, "— falling back to inline storage:", upErr.message);
            // Fallback so a failed Storage upload never silently loses the
            // file — reads back exactly like before this rebuild, just
            // without cross-device sync for this one document.
            const dataUrl: string = await new Promise((resolve, reject) => {
              const r = new FileReader();
              r.onload = ev => resolve(ev.target!.result as string);
              r.onerror = reject;
              r.readAsDataURL(file);
            });
            newDocs.push({ id, name: file.name, type: file.type, size: file.size, dataUrl, uploadedAt: today(), category });
          } else {
            const { data: pub } = (supabase as any).storage.from(DOCS_BUCKET).getPublicUrl(path);
            newDocs.push({ id, name: file.name, type: file.type, size: file.size, url: pub?.publicUrl, uploadedAt: today(), category });
          }
        } catch (e: any) {
          console.warn("[DocumentVault] upload threw for", file.name, ":", e?.message);
        }
      }
      if (newDocs.length > 0) await persist([...docs, ...newDocs]);
      setUploading(false);
    })();
    e.target.value = "";
  };

  const download = (doc: any) => {
    const a = document.createElement("a");
    a.href = doc.url || doc.dataUrl;
    a.download = doc.name;
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-black/40 border-b border-white/5">
        <div className="text-xs font-semibold flex items-center gap-1.5"><FileText size={11} className="text-blue-400" />Document Vault</div>
        <label className="cursor-pointer px-2 py-1 bg-blue-900/30 border border-blue-700/40 text-blue-300 rounded-lg text-[10px] hover:bg-blue-900/50 flex items-center gap-1">
          <input type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
          <Plus size={10} /> {uploading ? "Uploading…" : "Upload"}
        </label>
      </div>
      {loading
        ? <div className="py-5 text-center text-[11px] text-white/40">Loading…</div>
        : docs.length === 0
        ? <div className="py-5 text-center text-[11px] text-white/40">No documents uploaded. Upload contracts, insurance certs, waivers, or HOA approvals.</div>
        : <div className="divide-y divide-white/5">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/5">
              <span className="text-base">{(doc.type || "").includes("pdf") ? "📄" : (doc.type || "").includes("image") ? "🖼️" : "📋"}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{doc.name}</div>
                <div className="text-[10px] text-white/40">{doc.category} · {doc.uploadedAt} · {(doc.size / 1024).toFixed(0)}KB{!doc.url && doc.dataUrl && <span className="text-yellow-400/70"> · this device only</span>}</div>
              </div>
              <button onClick={() => download(doc)} className="p-1 text-white/40 hover:text-blue-400"><Download size={11} /></button>
              <button onClick={() => persist(docs.filter(d => d.id !== doc.id))} className="p-1 text-white/40 hover:text-danger-400"><Trash2 size={11} /></button>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
