// Searchable customer picker — type part of a name, phone, email or address
// and pick from the matches. Replaces a dropdown that drew every customer at
// once (slow with a few thousand, and no way to search).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

const label = (c: any) => `${c?.firstName || ""} ${c?.lastName || ""}`.trim() || c?.company || c?.phone || c?.email || "(no name)";
const norm = (s: any) => String(s || "").toLowerCase();

export function CustomerPicker({ customers = [], value, onChange, placeholder = "Search customers…" }: { customers?: any[]; value: string; onChange: (id: string) => void; placeholder?: string }) {
  const selected = useMemo(() => customers.find((c: any) => c.id === value) || null, [customers, value]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    const digits = q.replace(/\D/g, "");
    const list = !words.length ? customers : customers.filter((c: any) => {
      const hay = norm([label(c), c.email, c.address, c.company].join(" "));
      return words.every(w => hay.includes(w)) || (digits.length >= 3 && String(c.phone || "").replace(/\D/g, "").includes(digits));
    });
    return list.slice(0, 50);
  }, [customers, q]);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (c: any) => { onChange(c.id); setQ(""); setOpen(false); };

  return (
    <div ref={boxRef} className="relative" data-customer-picker>
      {selected && !open ? (
        <button type="button" onClick={() => setOpen(true)} className="w-full bg-surface/40 border border-edge/30 rounded-xl px-4 py-2.5 text-left flex items-center justify-between gap-2 hover:border-brand-500/40 transition">
          <span className="min-w-0">
            <span className="block truncate text-ink">{label(selected)}</span>
            {(selected.phone || selected.address) && <span className="block truncate text-[11px] text-white/40">{[selected.phone, selected.address].filter(Boolean).join(" · ")}</span>}
          </span>
          <span className="text-[11px] text-white/40 flex-shrink-0">Change</span>
        </button>
      ) : (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            autoFocus={open}
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => {
              if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(matches.length - 1, h + 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(0, h - 1)); }
              else if (e.key === "Enter" && matches[hi]) { e.preventDefault(); choose(matches[hi]); }
              else if (e.key === "Escape") { setOpen(false); }
            }}
            placeholder={placeholder}
            className="w-full bg-surface/40 border border-edge/30 rounded-xl pl-9 pr-9 py-2.5 text-ink placeholder-ink-soft/40 focus:outline-none focus:border-brand-500/60"
          />
          {selected && <button type="button" onClick={() => { setOpen(false); setQ(""); }} title="Keep current" className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"><X size={14} /></button>}
        </div>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto bg-neutral-950 border border-brand-900/40 rounded-xl shadow-2xl py-1">
          {matches.map((c: any, i: number) => (
            <div key={c.id} data-option onMouseEnter={() => setHi(i)} onMouseDown={e => { e.preventDefault(); choose(c); }}
              className={"px-4 py-2 cursor-pointer " + (i === hi ? "bg-brand-900/40" : "") + (c.id === value ? " font-semibold" : "")}>
              <div className="text-sm text-white truncate">{label(c)}</div>
              {(c.phone || c.address) && <div className="text-[11px] text-white/40 truncate">{[c.phone, c.address].filter(Boolean).join(" · ")}</div>}
            </div>
          ))}
          {matches.length === 0 && <div className="px-4 py-2 text-sm text-white/40">No customer matches "{q}"</div>}
          {customers.length > 50 && matches.length === 50 && <div className="px-4 py-1.5 text-[11px] text-white/30">Showing 50 — type more to narrow it down</div>}
        </div>
      )}
    </div>
  );
}
