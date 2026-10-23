// Shared CSV file / Google Sheets / pasted-text import, used for customers,
// expenses and personal transactions. Parsing and column detection live in
// lib/customerImport.ts.
//
// Every source lands on a review step before anything is saved:
//   1. "Columns" — every column in the file and what it was matched to.
//      Anything can be re-pointed, kept as a custom field, or skipped.
//   2. A preview of the rows as they'll be imported; rows can be unchecked,
//      removed, or edited.
// Nothing is imported until the owner confirms.
import React, { useState, useRef, useMemo } from "react";
import { Upload, Link as LinkIcon, ClipboardPaste, Trash2, CheckCircle } from "lucide-react";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { parseDelimited, splitHeader, autoMapColumns, applyMapping, CUSTOM, SKIP, type ImportFieldMap, type ColumnTarget } from "../../lib/customerImport";

export type { ImportFieldMap };

// Kept for older callers: maps a raw row (lowercased header → value) with a
// field map. New code goes through applyMapping.
export const mapRow = (raw: Record<string, string>, fieldMap: ImportFieldMap): Record<string, string> => {
  const headers = Object.keys(raw);
  const mapping = autoMapColumns(headers, fieldMap);
  return applyMapping(headers, [headers.map(h => raw[h])], mapping)[0] || {};
};

// Pasted text that isn't a table (no header row — copied from a PDF, an email
// signature, a phone contact list): one entry per line, pulling out an email
// and phone wherever they appear and treating the rest as name / address.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const PHONE_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const smartParseFreeform = (text: string): { headers: string[]; data: string[][] } => {
  const headers = ["First Name", "Last Name", "Email", "Phone", "Address", "Description", "Amount"];
  const data = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
    const emailM = line.match(EMAIL_RE);
    const phoneM = line.match(PHONE_RE);
    let rest = line;
    if (emailM) rest = rest.replace(emailM[0], "");
    if (phoneM) rest = rest.replace(phoneM[0], "");
    rest = rest.replace(/[|;\t]/g, ",").replace(/\s+/g, " ").trim();
    const parts = rest.split(/\s{2,}|,\s*/).map(p => p.trim()).filter(Boolean);
    const nameWords = (parts[0] || "").split(" ").filter(Boolean);
    const amount = (line.match(/\$?\s*-?\d+(\.\d{2})?/) || [""])[0].replace(/[$\s]/g, "");
    return [nameWords[0] || "", nameWords.slice(1).join(" "), emailM?.[0] || "", phoneM?.[0] || "", parts.slice(1).join(", "), rest, amount];
  }).filter(r => r[0] || r[2] || r[3] || r[6]);
  return { headers, data };
};

// Turns a normal Google Sheets share URL into its CSV export endpoint.
// Requires the sheet be shared as "Anyone with the link can view".
const sheetsUrlToCsvExport = (url: string): string | null => {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!m) return null;
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gidMatch ? gidMatch[1] : "0"}`;
};

const DEFAULT_LABELS: Record<string, string> = {
  firstName: "First Name", lastName: "Last Name", email: "Email", phone: "Phone",
  address: "Address", notes: "Notes", leadSource: "Lead Source", tags: "Tags",
  totalSpent: "Total Spent", sqFootage: "Sq Footage", gateCode: "Gate Code",
  date: "Date", description: "Description", amount: "Amount", category: "Category", vendor: "Vendor",
};
const PREVIEW_ROWS = 100;

export function ImportDataModal({ open, onClose, title = "Import Data", fieldMap, fieldLabels, fieldExclude, onImport, toast = (() => {}) as any, initialTab = "file", note }: {
  open: boolean; onClose: () => void; title?: string; fieldMap: ImportFieldMap;
  fieldLabels?: Record<string, string>; fieldExclude?: Record<string, RegExp>;
  // Rows are keyed by field key; columns kept as custom fields arrive as
  // "__custom__:<Header>". Return a summary string to show instead of the
  // default "Imported N rows" toast (or throw to show an error).
  onImport: (rows: Record<string, string>[]) => void | string | Promise<void | string>;
  toast?: (msg: string, tone?: any) => void; initialTab?: "file" | "sheets" | "paste"; note?: string;
}) {
  const [tab, setTab] = useState<"file" | "sheets" | "paste">(initialTab);
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const labels = { ...DEFAULT_LABELS, ...(fieldLabels || {}) };
  // Display order: the labels' order when given (natural reading order),
  // otherwise the field map's (which is ordered for matching, not reading).
  const fieldKeys = fieldLabels ? [...Object.keys(fieldLabels).filter(k => k in fieldMap), ...Object.keys(fieldMap).filter(k => !(k in fieldLabels))] : Object.keys(fieldMap);

  // Parsed source + chosen column mapping; then per-row edits / exclusions.
  const [src, setSrc] = useState<{ headers: string[]; data: string[][]; fileName?: string } | null>(null);
  const [mapping, setMapping] = useState<ColumnTarget[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [edits, setEdits] = useState<Record<number, Record<string, string>>>({});

  React.useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  const reset = () => { setSrc(null); setMapping([]); setExcluded(new Set()); setEdits({}); setPasteText(""); setSheetsUrl(""); };
  const close = () => { if (busy) return; reset(); onClose(); };

  const startReview = (text: string, fileName?: string) => {
    let parsed = splitHeader(parseDelimited(text));
    let map = parsed ? autoMapColumns(parsed.headers, fieldMap, fieldExclude) : [];
    // Nothing recognizable as a table → line-by-line detection instead.
    if (!parsed || parsed.data.length === 0 || map.every(t => t === CUSTOM || t === SKIP)) {
      const free = smartParseFreeform(text);
      if (free.data.length > 0) { parsed = free; map = autoMapColumns(free.headers, fieldMap, fieldExclude); }
    }
    if (!parsed || parsed.data.length === 0) { toast("Couldn't find any rows to import in that data", "red"); return; }
    setSrc({ ...parsed, fileName });
    setMapping(map);
    setExcluded(new Set());
    setEdits({});
  };

  const handleFile = (e: any) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const r = new FileReader();
    r.onload = () => startReview(String(r.result || ""), file.name);
    r.onerror = () => toast("Couldn't read that file", "red");
    r.readAsText(file);
  };

  const handleSheetsImport = async () => {
    const csvUrl = sheetsUrlToCsvExport(sheetsUrl.trim());
    if (!csvUrl) { toast("That doesn't look like a Google Sheets link", "red"); return; }
    setBusy(true);
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("Sheet isn't shared publicly (\"Anyone with the link can view\") or the link is wrong");
      startReview(await res.text());
    } catch (e: any) {
      toast(e?.message || "Failed to fetch that sheet", "red");
    } finally {
      setBusy(false);
    }
  };

  const rows = useMemo(() => {
    if (!src) return [] as Record<string, string>[];
    // One mapped record per data row (empty rows become {} so indexes line up).
    return src.data.map(cells => applyMapping(src.headers, [cells], mapping)[0] || {});
  }, [src, mapping]);
  const finalRow = (i: number) => ({ ...rows[i], ...(edits[i] || {}) });
  const includedCount = rows.filter((r, i) => !excluded.has(i) && Object.keys(r).length > 0).length;
  const usedKeys = fieldKeys.filter(k => mapping.includes(k));
  const customCount = mapping.filter(t => t === CUSTOM).length;

  const confirmImport = async () => {
    const out = rows.map((_, i) => i).filter(i => !excluded.has(i) && Object.keys(rows[i]).length > 0).map(finalRow);
    if (out.length === 0) { toast("No rows selected to import", "red"); return; }
    setBusy(true);
    try {
      const summary = await onImport(out);
      toast(typeof summary === "string" ? summary : `Imported ${out.length} row(s) ✓`, "green");
      setBusy(false);
      reset(); onClose();
    } catch (e: any) {
      setBusy(false);
      toast("Import failed — " + (e?.message || "unknown error"), "red");
    }
  };

  return (
    <Modal open={open} onClose={close} title={src ? `Review Import — ${title}` : title} maxW={src ? "max-w-4xl" : undefined}>
      {!src ? (
        <div className="space-y-4">
          <div className="flex gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
            {([["file", "CSV File", Upload], ["sheets", "Google Sheets", LinkIcon], ["paste", "Paste Text", ClipboardPaste]] as const).map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTab(k)} className={"flex-1 py-1.5 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 " + (tab === k ? "bg-red-700/40 text-white border border-red-700/50" : "text-white/50")}>
                <Icon size={12} />{l}
              </button>
            ))}
          </div>
          {note && <div className="text-xs text-white/50">{note}</div>}

          {tab === "file" && (
            <div className="space-y-2">
              <div className="text-xs text-white/50">Any CSV works — exports from Excel, Google Sheets, Google Contacts, Jobber, QuickBooks and other CRMs. Columns are matched automatically and you'll see how before anything is imported.</div>
              <button onClick={() => fileRef.current?.click()} className="w-full py-8 rounded-xl border-2 border-dashed border-white/15 hover:border-red-600/40 text-white/50 hover:text-white/80 transition text-sm">
                <Upload size={20} className="mx-auto mb-2" />Click to choose a .csv file
              </button>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" onChange={handleFile} className="hidden" />
            </div>
          )}

          {tab === "sheets" && (
            <div className="space-y-2">
              <div className="text-xs text-white/50">Paste a Google Sheets link. The sheet must be shared as "Anyone with the link can view" (Share → General access).</div>
              <GInput value={sheetsUrl} onChange={(e: any) => setSheetsUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." />
              <GBtn onClick={handleSheetsImport} disabled={busy || !sheetsUrl.trim()} className="w-full">{busy ? "Reading…" : "Read Sheet"}</GBtn>
            </div>
          )}

          {tab === "paste" && (
            <div className="space-y-2">
              <div className="text-xs text-white/50">Paste a table with a header row (copied from Excel or Sheets works), OR plain text — one entry per line with a name, phone and/or email anywhere on the line.</div>
              <textarea value={pasteText} onChange={(e: any) => setPasteText(e.target.value)} rows={8} placeholder={"First Name,Last Name,Email,Phone\nJane,Doe,jane@example.com,555-1234\n\n— or —\n\nJane Doe (717) 555-1234 jane@example.com"} className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 font-mono resize-none" />
              <GBtn onClick={() => startReview(pasteText)} disabled={!pasteText.trim()} className="w-full">Review Pasted Data</GBtn>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div className="text-sm font-semibold">Columns{src.fileName ? <span className="text-white/40 font-normal"> · {src.fileName}</span> : null}</div>
              <div className="text-[11px] text-white/40">{usedKeys.length} matched{customCount ? ` · ${customCount} kept as custom fields` : ""}</div>
            </div>
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-[26vh] overflow-auto pr-1">
              {src.headers.map((h, i) => {
                const sample = src.data.find(r => (r[i] || "").trim())?.[i] || "";
                return (
                  <div key={i} className={"flex items-center gap-2 rounded-lg border px-2 py-1.5 " + (mapping[i] === SKIP ? "border-white/5 opacity-50" : mapping[i] === CUSTOM ? "border-white/10" : "border-green-700/40 bg-green-950/10")}>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{h}</div>
                      <div className="text-[10px] text-white/40 truncate">{sample || "—"}</div>
                    </div>
                    <select value={mapping[i]} onChange={e => setMapping(m => m.map((t, j) => j === i ? e.target.value : t))} className="bg-black/60 border border-white/15 rounded-md text-[11px] px-1.5 py-1 text-white max-w-[45%]">
                      {fieldKeys.map(k => <option key={k} value={k}>{labels[k] || k}</option>)}
                      <option value={CUSTOM}>Keep as custom field</option>
                      <option value={SKIP}>Don't import</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-xs text-white/50 mb-1.5">
              {includedCount} of {rows.length} row(s) will be imported.{rows.length > PREVIEW_ROWS ? ` Showing the first ${PREVIEW_ROWS}.` : ""} Fix anything misread, or uncheck rows you don't want.
            </div>
            <div className="max-h-[36vh] overflow-auto rounded-xl border border-white/10">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-black z-10">
                  <tr>
                    <th className="p-2 text-left w-8"></th>
                    {usedKeys.map(k => <th key={k} className="p-2 text-left text-white/50 font-medium whitespace-nowrap">{labels[k] || k}</th>)}
                    {customCount > 0 && <th className="p-2 text-left text-white/50 font-medium whitespace-nowrap">Custom fields</th>}
                    <th className="p-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, PREVIEW_ROWS).map((_, idx) => {
                    const row = finalRow(idx);
                    if (Object.keys(rows[idx]).length === 0) return null;
                    const off = excluded.has(idx);
                    const customs = Object.keys(row).filter(k => k.startsWith("__custom__:"));
                    return (
                      <tr key={idx} className={"border-t border-white/5 " + (off ? "opacity-40" : "")}>
                        <td className="p-2"><input type="checkbox" checked={!off} onChange={() => setExcluded(s => { const n = new Set(s); n.has(idx) ? n.delete(idx) : n.add(idx); return n; })} className="accent-green-500 cursor-pointer" /></td>
                        {usedKeys.map(k => (
                          <td key={k} className="p-1">
                            <input value={row[k] || ""} disabled={off} onChange={e => setEdits(p => ({ ...p, [idx]: { ...(p[idx] || {}), [k]: e.target.value } }))}
                              className="w-full min-w-[90px] bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-red-500/50 disabled:opacity-50" />
                          </td>
                        ))}
                        {customCount > 0 && <td className="p-2 text-[10px] text-white/50 max-w-[220px] truncate" title={customs.map(k => `${k.slice(11)}: ${row[k]}`).join("\n")}>{customs.map(k => `${k.slice(11)}: ${row[k]}`).join(" · ") || "—"}</td>}
                        <td className="p-2"><button onClick={() => setExcluded(s => new Set(s).add(idx))} className="text-white/30 hover:text-red-400 transition"><Trash2 size={12} /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <GBtn variant="ghost" onClick={() => setSrc(null)} disabled={busy}>Back</GBtn>
            <GBtn onClick={confirmImport} disabled={busy || includedCount === 0}><CheckCircle size={14} className="inline mr-1.5" />{busy ? "Importing…" : `Confirm Import (${includedCount})`}</GBtn>
          </div>
        </div>
      )}
    </Modal>
  );
}
