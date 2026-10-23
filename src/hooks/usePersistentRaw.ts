import { useState, useEffect } from "react";

/**
 * usePersistentRaw — stores raw string (no JSON.parse).
 * Used for PIN storage, short string values.
 */
export function usePersistentRaw(
  key: string,
  initial: string
): [string, (v: string) => void] {
  const [val, setVal] = useState<string>(() => {
    try { return localStorage.getItem(key) ?? initial; } catch { return initial; }
  });

  const setStored = (v: string) => {
    setVal(v);
    try {
      if (v) localStorage.setItem(key, v);
      else localStorage.removeItem(key);
    } catch { /* ignore */ }
  };

  return [val, setStored];
}
