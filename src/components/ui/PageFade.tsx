// PageFade.tsx — auto-extracted from monolith
import React, { useState, useRef, useEffect, useCallback } from "react";

// FIX 19 — className is optional and defaults to unset so every existing
// caller keeps its current (block, natural-height) layout; passed only for
// pages (Alfred) that need this wrapper to actually participate in a flex
// height chain instead of just sizing to its content.
export const PageFade = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const [show, setShow] = useState(false);
  // BUG FIX — "right-click a job on the calendar, the popup appears far to
  // the right instead of next to the job" (and, by the same mechanism, any
  // other position:fixed element anywhere in the app — this wrapper sits
  // around every single page's content). `transform: translateY(0)` at
  // rest is still a real transform value, not `none` — per the CSS spec,
  // ANY transform value other than `none` makes that element the
  // containing block for every `position: fixed` descendant, so those
  // descendants position themselves relative to THIS div instead of the
  // actual viewport. Kept "done" as a separate step so the enter animation
  // (10px slide-up) still plays exactly as before; once it's finished the
  // transform is cleared to the literal `none` so fixed-positioned
  // children (context menus, modals, etc.) go back to being viewport-
  // relative like they're supposed to be.
  const [animDone, setAnimDone] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setShow(true), 10);
    const t2 = setTimeout(() => setAnimDone(true), 320);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className={className} style={{ opacity: show ? 1 : 0, transform: animDone ? "none" : (show ? "translateY(0)" : "translateY(10px)"), transition: "opacity 0.3s ease, transform 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
      {children}
    </div>
  );
};

