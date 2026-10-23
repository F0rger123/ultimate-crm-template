import { useEffect, useRef, useCallback } from "react";

// EGRESS FIX — shared gate for every Supabase polling interval in the app
// (App.tsx's jobs/customers/estimates + Live Crew View, EmployeePortal.tsx's
// field-portal jobs poll, InboxPage.tsx's inbox poll). Before this, each of
// those ran its `select("*")` unconditionally every 3s all day regardless of
// whether the tab was even visible — the actual source of the high egress.
// Centralized here so all three agree on the same "should we even fetch right
// now" answer instead of three independent, possibly-diverging copies of the
// same visibility/idle tracking logic.
const IDLE_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;

export function usePollGate(onVisible?: () => void): () => boolean {
  const lastActivityRef = useRef(Date.now());
  const hiddenRef = useRef(typeof document !== "undefined" ? document.hidden : false);
  const onVisibleRef = useRef(onVisible);

  useEffect(() => { onVisibleRef.current = onVisible; }, [onVisible]);

  useEffect(() => {
    const bump = () => { lastActivityRef.current = Date.now(); };
    ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, bump, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, bump));
  }, []);

  useEffect(() => {
    const onChange = () => {
      const wasHidden = hiddenRef.current;
      hiddenRef.current = document.hidden;
      // Refresh immediately on returning to the tab rather than waiting up
      // to a full poll interval for data that may now be stale.
      if (wasHidden && !document.hidden) {
        lastActivityRef.current = Date.now();
        onVisibleRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const shouldPoll = useCallback((): boolean => {
    if (typeof document !== "undefined" && document.hidden) return false;
    if (Date.now() - lastActivityRef.current > IDLE_MS) return false;
    return true;
  }, []);

  return shouldPoll;
}
