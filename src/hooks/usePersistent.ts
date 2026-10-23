import { useState, useEffect, useRef } from "react";

type StorageValue = string | number | boolean | object | null;

/**
 * usePersistent — localStorage-backed state with async window.storage fallback.
 * Starts with initialValue synchronously, then hydrates from storage.
 */
export function usePersistent<T extends StorageValue>(
  key: string,
  initialValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  // Synchronous init from localStorage for instant render
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        try { return JSON.parse(raw) as T; } catch { return raw as unknown as T; }
      }
    } catch { /* localStorage blocked */ }
    return initialValue;
  });

  const hydrated = useRef(false);

  // Hydrate from window.storage (Claude artifact sandbox) if available
  useEffect(() => {
    if (hydrated.current) return;
    const load = async () => {
      try {
        if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).storage) {
          const storage = (window as unknown as { storage: { get: (k: string) => Promise<{ value: unknown } | null> } }).storage;
          const r = await storage.get(key);
          if (r && r.value !== undefined) {
            const parsed = typeof r.value === "string"
              ? (() => { try { return JSON.parse(r.value as string); } catch { return r.value; } })()
              : r.value;
            setValue(parsed as T);
          }
        }
      } catch { /* ignore */ }
      hydrated.current = true;
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage on every change
  useEffect(() => {
    if (!hydrated.current && value === initialValue) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded or blocked */ }
  }, [key, value]); // eslint-disable-line react-hooks/exhaustive-deps

  return [value, setValue];
}
