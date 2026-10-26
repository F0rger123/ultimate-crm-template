// FEATURE — "I should be able to copy and paste a whole bunch of
// information: client names, dates, orders, addresses, dollar amounts,
// special instructions, customer phone numbers, and then automatically
// assign an employee." Paste a raw blob of text (from an email, a text
// thread, a spreadsheet — any format), let the AI model extract structured
// job entries, review/edit them, then create real customers + jobs in one
// batch with employees auto-assigned by current workload.
import React, { useState } from "react";
import { Sparkles, Trash2, Loader2, UserPlus, Check } from "lucide-react";
import { uid, today, pickLeastLoadedEmployee } from "../../lib/utils";
import { MODELS } from "../../lib/api";
import { readAsTable, recordsFromTable, extractRecordsWithAI, parseFrequency, parseWeekday, matchEmployee, insertJobsTolerant } from "../../lib/bulkImport";
import { parseDateLoose } from "../../lib/customerImport";
import { supabase } from "../../lib/supabase";
import { Modal } from "./Modal";
import { GBtn } from "./GBtn";
import { GInput } from "./GInput";
import { GDate } from "./GDate";
import { GSel } from "./GSel";
import { GTxt } from "./GTxt";

interface ParsedJobRow {
  _key: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  scheduledDate: string;
  amount: string;
  notes: string;
  scheduledTime: string;
  frequency: string | null;
  weekday: number | null;
  cans: number;
  matchedCustomerId: string | null;
  assignedEmployeeId: string;
  skip: boolean;
}

const normalizePhone = (p: string) => (p || "").replace(/\D/g, "").replace(/^1(\d{10})$/, "$1");

export function BulkJobImportModal({
  open, onClose, customers = [], setCustomers, jobs = [], setJobs, employees = [], settings = {} as any, toast, ownerId = "",
}: {
  open: boolean; onClose: () => void; customers?: any[]; setCustomers?: any; jobs?: any[]; setJobs?: any;
  employees?: any[]; settings?: any; toast?: any; ownerId?: string;
}) {
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<ParsedJobRow[] | null>(null);
  const [creating, setCreating] = useState(false);

  const findMatch = (name: string, phone: string): string | null => {
    const np = normalizePhone(phone);
    if (np) {
      const byPhone = customers.find((c: any) => c.phone && normalizePhone(c.phone) === np);
      if (byPhone) return byPhone.id;
    }
    const nn = (name || "").trim().toLowerCase();
    if (nn) {
      const byName = customers.find((c: any) => `${c.firstName || ""} ${c.lastName || ""}`.trim().toLowerCase() === nn);
      if (byName) return byName.id;
    }
    return null;
  };

  const reset = () => { setRawText(""); setRows(null); };

  const parse = async () => {
    if (!rawText.trim()) { toast?.("Paste some job info first", "red"); return; }
    setParsing(true);
    try {
      // BUG FIX — a long list used to go to the AI in one request with a
      // 4,000-token answer: it timed out or came back cut off (invalid JSON,
      // nothing imported). A table is now read without AI; free text is read
      // in pieces (lib/bulkImport.ts), with failover across the models that
      // have keys. Schedules, times, cans and workers are read too.
      const table = readAsTable(rawText);
      let parsed: any[];
      if (table) parsed = recordsFromTable(table.headers, table.data);
      else {
        const priority: string[] = settings?.modelPriority || Object.keys(MODELS);
        const chain = Array.from(new Set([settings?.activeModel, ...priority, ...Object.keys(MODELS)].filter(Boolean)))
          .filter((mid: any) => { const m: any = (MODELS as any)[mid]; return m && (!m.needsKey || !!settings?.modelKeys?.[mid]); }) as string[];
        const out = await extractRecordsWithAI(rawText, chain, { onProgress: (d, t) => { if (t > 1) toast?.(`Reading the list: ${d}/${t} pieces`); } });
        parsed = out.records;
        if (out.failedPieces) toast?.(`${out.failedPieces} of ${out.pieces} pieces couldn't be read — check the list below for missing customers`, "yellow");
      }
      if (!Array.isArray(parsed) || parsed.length === 0) { toast?.("Couldn't find any jobs in that text — try adding more detail (a name, address, or date per entry)", "red"); setParsing(false); return; }
      const defaultDate = today();
      // Simulates each row's assignment against a running copy of jobs so
      // load-balancing actually spreads THIS batch across employees too,
      // not just against jobs that already existed before pasting.
      const simulatedJobs = [...jobs];
      const newRows: ParsedJobRow[] = parsed.map((p: any) => {
        const name = String(p.customerName || p.fullName || [p.firstName, p.lastName].filter(Boolean).join(" ") || p.company || "").trim();
        const phone = String(p.phone || "").trim();
        const wd = parseWeekday(p.weekday);
        const parsedDate = p.scheduledDate ? parseDateLoose(String(p.scheduledDate)) : "";
        const date = /^\d{4}-\d{2}-\d{2}$/.test(parsedDate) ? parsedDate : wd != null ? (() => { const d = new Date(); d.setDate(d.getDate() + ((wd - d.getDay() + 7) % 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })() : defaultDate;
        const named = matchEmployee(p.worker, employees);
        const empId = named?.id || pickLeastLoadedEmployee(simulatedJobs, employees, date) || "";
        if (empId) simulatedJobs.push({ scheduledDate: date, crew: [empId], status: "scheduled" });
        return {
          _key: uid(), customerName: name, phone, email: String(p.email || "").trim(),
          address: [p.address, p.city, [p.state, p.zip].filter(Boolean).join(" ")].map((x: any) => String(x || "").trim()).filter(Boolean).join(", "), scheduledDate: date,
          amount: String(p.amount || "").replace(/[^0-9.]/g, ""), notes: [p.service ? `Service: ${p.service}` : "", String(p.notes || "").trim()].filter(Boolean).join("\n"),
          scheduledTime: /^\d{1,2}:\d{2}$/.test(String(p.scheduledTime || "")) ? String(p.scheduledTime).padStart(5, "0") : "",
          frequency: parseFrequency(p.frequency), weekday: wd, cans: Math.max(0, Math.round(Number(String(p.cans || "").replace(/[^0-9.]/g, "")) || 0)),
          matchedCustomerId: findMatch(name, phone), assignedEmployeeId: empId, skip: false,
        };
      });
      setRows(newRows);
      toast?.(`Parsed ${newRows.length} job${newRows.length !== 1 ? "s" : ""} — review before creating`, "green");
    } catch (e: any) {
      console.error("[BulkJobImport] parse failed:", e?.message);
      toast?.("Couldn't parse that text — " + (e?.message || "unknown error"), "red");
    } finally {
      setParsing(false);
    }
  };

  const patchRow = (key: string, patch: Partial<ParsedJobRow>) => {
    setRows(prev => prev ? prev.map(r => r._key === key ? { ...r, ...patch } : r) : prev);
  };

  const createAll = async () => {
    if (!rows || rows.length === 0) return;
    const active = rows.filter(r => !r.skip);
    if (active.length === 0) { toast?.("Everything's marked to skip — nothing to create", "red"); return; }
    setCreating(true);
    const newCustomers: any[] = [];
    const newJobs: any[] = [];
    let createdJobs = 0, createdCustomers = 0, failed = 0;
    for (const row of active) {
      try {
        let customerId = row.matchedCustomerId;
        if (!customerId) {
          const parts = row.customerName.trim().split(/\s+/);
          const firstName = parts[0] || row.customerName || "Customer";
          const lastName = parts.slice(1).join(" ");
          const custRecord = {
            id: uid(), firstName, lastName, email: row.email || "", phone: row.phone || "", address: row.address || "",
            tags: [], totalSpent: 0, createdAt: today(), owner_id: ownerId,
          };
          const { data, error } = await (supabase as any).from("customers").insert(custRecord).select().single();
          if (error || !data) throw new Error(error?.message || "Customer save failed");
          newCustomers.push(data);
          customerId = data.id;
          createdCustomers++;
        }
        const empId = row.assignedEmployeeId || undefined;
        const jobRecord: any = {
          id: uid(), customerId, address: row.address || "", amount: parseFloat(row.amount) || 0,
          status: "scheduled", scheduledDate: row.scheduledDate || today(), scheduledTime: row.scheduledTime || "",
          ...(row.frequency && row.frequency !== "one_time"
            ? (row.weekday != null && row.frequency === "weekly"
              ? { isRecurring: true, recurringMode: "weekdays", recurringFreq: "weekly", recurringWeekdays: [row.weekday], recurringInterval: 1 }
              : { isRecurring: true, recurringMode: "preset", recurringFreq: row.frequency })
            : {}),
          priority: "normal", crew: empId ? [empId] : [],
          ...(empId ? { crewAssignedAt: { [empId]: Date.now() } } : {}),
          checklist: [], photos: [], commLog: [], chemicalsUsed: [], equipment: [], tags: [],
          loggedHours: 0, createdAt: today(), notes: row.notes || "", owner_id: ownerId,
        };
        const saved = await insertJobsTolerant([jobRecord]);
        if (!saved.saved) throw new Error(saved.errors[0] || "Job save failed");
        newJobs.push(jobRecord);
        createdJobs++;
      } catch (e: any) {
        failed++;
        console.error("[BulkJobImport] row failed —", row.customerName, "—", e?.message);
      }
    }
    if (newCustomers.length > 0) setCustomers?.((prev: any[]) => [...prev, ...newCustomers]);
    if (newJobs.length > 0) setJobs?.((prev: any[]) => [...prev, ...newJobs]);
    setCreating(false);
    if (failed > 0) toast?.(`Created ${createdJobs} job${createdJobs !== 1 ? "s" : ""}, ${failed} failed — check the console for details`, "yellow");
    else toast?.(`Created ${createdJobs} job${createdJobs !== 1 ? "s" : ""} (${createdCustomers} new customer${createdCustomers !== 1 ? "s" : ""}) ✓`, "green");
    if (createdJobs > 0) { reset(); onClose(); }
  };

  const assignableEmployees = employees.filter((e: any) => e.status === "active" && e.role !== "owner");

  return (
    <Modal open={open} onClose={() => { if (!creating) { reset(); onClose(); } }} title="Bulk Job Import" maxW="max-w-4xl">
      <div className="space-y-4">
        {!rows ? (
          <>
            <GTxt
              rows={12}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={"Paste anything — client names, phone numbers, addresses, dates, dollar amounts, special instructions. Any format, any order.\n\nExample:\nJohn Smith, 555-555-0123, 42 Elm St, 9/26, $45, cans are behind the fence\nMary Jones 555-555-0199 18 Oak Ave next tuesday $60 gate code 1234"}
              className="!text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] text-white/40">Parsed by AI — always reviewed and editable before anything saves.</div>
              <GBtn onClick={parse} disabled={parsing || !rawText.trim()}>
                {parsing ? <><Loader2 size={14} className="animate-spin inline mr-1.5" />Parsing…</> : <><Sparkles size={14} className="inline mr-1.5" />Parse</>}
              </GBtn>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">{rows.filter(r => !r.skip).length} of {rows.length} job{rows.length !== 1 ? "s" : ""} will be created</div>
              <button onClick={() => setRows(null)} className="text-xs text-white/40 hover:text-white/70 transition">← Back to paste</button>
            </div>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
              {rows.map(row => (
                <div key={row._key} className={"p-3 rounded-xl border space-y-2 " + (row.skip ? "opacity-40 border-white/5 bg-white/[0.02]" : "border-white/10 bg-white/5")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {row.matchedCustomerId ? (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-green-950/40 border border-green-700/40 text-green-300 flex items-center gap-1"><Check size={9} />Matched existing customer</span>
                      ) : (
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-950/40 border border-blue-700/40 text-blue-300 flex items-center gap-1"><UserPlus size={9} />New customer</span>
                      )}
                    </div>
                    <button onClick={() => patchRow(row._key, { skip: !row.skip })} className="p-1.5 rounded-lg text-white/40 hover:text-brand-400 hover:bg-brand-950/30 transition" title={row.skip ? "Include this job" : "Skip this job"}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <GInput placeholder="Customer name" value={row.customerName} onChange={e => patchRow(row._key, { customerName: e.target.value, matchedCustomerId: findMatch(e.target.value, row.phone) })} className="!text-xs !py-1.5" />
                    <GInput placeholder="Phone" value={row.phone} onChange={e => patchRow(row._key, { phone: e.target.value, matchedCustomerId: findMatch(row.customerName, e.target.value) })} className="!text-xs !py-1.5" />
                    <GInput placeholder="Address" value={row.address} onChange={e => patchRow(row._key, { address: e.target.value })} className="!text-xs !py-1.5 md:col-span-2" />
                    <GDate value={row.scheduledDate} onChange={e => patchRow(row._key, { scheduledDate: e.target.value })} className="!text-xs !py-1.5" />
                    <GInput placeholder="$ amount" type="number" value={row.amount} onChange={e => patchRow(row._key, { amount: e.target.value })} className="!text-xs !py-1.5" />
                    <GSel value={row.assignedEmployeeId} onChange={e => patchRow(row._key, { assignedEmployeeId: e.target.value })} className="!text-xs !py-1.5">
                      <option value="" className="bg-black">Unassigned</option>
                      {assignableEmployees.map((e: any) => <option key={e.id} value={e.id} className="bg-black">{e.firstName} {e.lastName}</option>)}
                    </GSel>
                    <GInput placeholder="Special instructions" value={row.notes} onChange={e => patchRow(row._key, { notes: e.target.value })} className="!text-xs !py-1.5 md:col-span-2" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <GBtn variant="ghost" onClick={() => { if (!creating) { reset(); onClose(); } }}>Cancel</GBtn>
              <GBtn onClick={createAll} disabled={creating}>
                {creating ? <><Loader2 size={14} className="animate-spin inline mr-1.5" />Creating…</> : `Create ${rows.filter(r => !r.skip).length} Job${rows.filter(r => !r.skip).length !== 1 ? "s" : ""}`}
              </GBtn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
