// TimeframeSelector.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Search, TrendingUp, DollarSign, Clock, CheckCircle, AlertTriangle, AlertCircle, Star, Target, BarChart3 } from "lucide-react";
import { TIMEFRAMES } from "../../lib/utils";

export const TimeframeSelector = ({ value, onChange, options = ["7d","30d","90d","6m","1y","all"], compact = false }) => {
  const show = TIMEFRAMES.filter(t => options.includes(t.key));
  return (
    <div className={"flex gap-1 bg-black/40 border border-brand-900/30 rounded-xl p-1 " + (compact ? "text-[10px]" : "text-xs")}>
      {show.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={"px-2.5 py-1 rounded-lg font-semibold transition-all " + (value === t.key ? "bg-brand-600 text-brand-fg shadow-sm" : "text-white/50 hover:text-white hover:bg-white/5")}
        >{t.label}</button>
      ))}
    </div>
  );
};

// Filter a list of items by a date field and timeframe key
const filterByTimeframe = (items, dateField, tfKey) => {
  if (tfKey === "all") return items;
  const days = TIMEFRAMES.find(t => t.key === tfKey)?.days || 30;
  const cutoff = Date.now() - days * 86400000;
  return items.filter(item => {
    const d = item[dateField];
    if (!d) return false;
    return new Date(d).getTime() >= cutoff;
  });
};

// usePersistentRaw - returns raw stored string (for PIN)
const usePersistentRaw = (key, initial) => {
  const [val, setVal] = useState(() => {
    try { return localStorage.getItem(key) || initial; } catch { return initial; }
  });
  const setStored = v => {
    setVal(v);
    try { if (v) localStorage.setItem(key, v); else localStorage.removeItem(key); } catch {}
  };
  return [val, setStored];
};

// ===== PERSISTENT STORAGE HOOK =====
// Uses window.storage (artifact storage API). Falls back to in-memory if unavailable.
const usePersistent = (key, initialValue) => {
  const [value, setValue] = useState(initialValue);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from storage on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (typeof window !== "undefined" && (window as any).storage) {
          const r = await (window as any).storage.get(key);
          if (!cancelled && r && r.value !== undefined) {
            try {
              const parsed = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
              setValue(parsed);
            } catch (e) {
              // corrupt data, use initial
            }
          }
        }
      } catch (e) {
        // key doesn't exist — that's fine, use initial
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [key]);

  // Save on change
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined" || !(window as any).storage) return;
    try {
      const serialized = JSON.stringify(value);
      if (serialized.length < 4_500_000) {
        (window as any).storage.set(key, serialized).catch(() => {});
      }
    } catch (e) {
      // ignore serialization errors
    }
  }, [key, value, hydrated]);

  return [value, setValue, hydrated];
};

// ===== MAIN APP =====
// ===== GLOBAL SEARCH =====
