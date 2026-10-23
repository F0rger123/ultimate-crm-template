import React, { useEffect, useRef, useState } from "react";

// FEATURE — "when customers view quotes and select options for the options
// package, all numbers should have animations and good-looking UI
// transitions." Tweens from the previous rendered value to the new one over
// a short duration (eased, not linear) whenever `value` changes — used for
// per-item prices, running totals, and the Subtotal/Discount/Tax/Total
// breakdown on the customer quote page so toggling a checkbox or switching
// packages visibly counts up/down instead of jump-cutting.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function AnimatedNumber({ value, format, duration = 450, className }: { value: number; format: (n: number) => string; duration?: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reducedMotion) { setDisplay(value); fromRef.current = value; return; }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutCubic(t);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{format(display)}</span>;
}
