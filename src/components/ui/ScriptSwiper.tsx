// Hand-rolled swipe card — no external swipe library in this app's deps
// (checked package.json), matching the existing SwipeableCard.tsx pattern
// (pointer/touch delta tracking) but adds drag-follow + rotation feedback
// and a real commit threshold, since this card needs a decisive accept/
// decline gesture rather than SwipeableCard's small direction hint.
import React, { useEffect, useRef, useState } from "react";
import { X, Heart } from "lucide-react";

const THRESHOLD = 100;

export function ScriptSwiper({
  title,
  category,
  categoryLabel,
  script,
  onAccept,
  onDecline,
  busy = false,
}: {
  title: string;
  category?: string;
  categoryLabel?: string;
  script: string;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  // Use refs (not state) for the values the native, non-passive touchmove
  // listener below reads — that listener is attached once and its closure
  // would otherwise see stale dragX/exiting/busy from whichever render was
  // active when the effect last ran.
  const dragXRef = useRef(0);
  const draggingRef = useRef(false);
  const busyRef = useRef(busy);
  const exitingRef = useRef(exiting);
  busyRef.current = busy;
  exitingRef.current = exiting;

  const setDragXBoth = (v: number) => { dragXRef.current = v; setDragX(v); };
  const reset = () => { startX.current = null; startY.current = null; draggingRef.current = false; setDragging(false); setDragXBoth(0); };

  const commit = (dir: "left" | "right") => {
    // touchend never flips `dragging` back off, so without this the CSS
    // transition stays disabled ("transition: none" while dragging) and the
    // card would teleport to translateX(±600) instead of flying off-screen.
    draggingRef.current = false;
    setDragging(false);
    setExiting(dir);
    setDragXBoth(dir === "right" ? 600 : -600);
    setTimeout(() => {
      if (dir === "right") onAccept(); else onDecline();
      // Card isn't remounted between queue items (same tree position, no
      // key), so leftover dragX/exiting state would otherwise carry over and
      // the *next* card would render already flung off-screen.
      setExiting(null);
      reset();
    }, 180);
  };

  // BUG FIX — "swipe isn't working on mobile." This card lives inside a
  // vertically-scrollable ancestor (AlfredScriptsPanel's tab body). React
  // attaches touch listeners as PASSIVE by default, which means a JSX
  // onTouchMove can never call preventDefault() — so once a real device's
  // gesture recognizer decided this touch might be a vertical page scroll
  // (any tiny diagonal jitter at the very start of a real finger swipe is
  // enough), the ancestor's native scroll took over the gesture and this
  // card's onTouchMove either stopped firing or never got to react in time,
  // even though touch-action: pan-y correctly told the browser JS should own
  // horizontal movement in principle. Attaching a NON-passive touchmove
  // listener directly via addEventListener lets us call preventDefault() the
  // moment horizontal intent is clear, which actually claims the gesture
  // instead of just hoping the ancestor doesn't take it first.
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      if (busyRef.current || exitingRef.current) return;
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      draggingRef.current = true;
      setDragging(true);
    };
    const onMove = (e: TouchEvent) => {
      if (startX.current === null || busyRef.current || exitingRef.current) return;
      const dx = e.touches[0].clientX - startX.current;
      const dy = Math.abs(e.touches[0].clientY - (startY.current ?? 0));
      if (dy > 90 && dy > Math.abs(dx)) return; // clear vertical scroll intent — don't fight it
      // Horizontal (or ambiguous-but-not-clearly-vertical) movement: this is
      // our gesture now — prevent the ancestor's vertical scroll from also
      // claiming it mid-drag.
      if (Math.abs(dx) > 8) e.preventDefault();
      setDragXBoth(dx);
    };
    const onEnd = () => {
      if (busyRef.current || exitingRef.current) return;
      if (dragXRef.current > THRESHOLD) commit("right");
      else if (dragXRef.current < -THRESHOLD) commit("left");
      else reset();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotation = dragX / 16;
  const acceptGlow = Math.min(1, Math.max(0, dragX / THRESHOLD));
  const declineGlow = Math.min(1, Math.max(0, -dragX / THRESHOLD));

  return (
    <div className="w-full select-none">
      <div
        ref={cardRef}
        style={{
          transform: `translateX(${dragX}px) rotate(${rotation}deg)`,
          transition: dragging ? "none" : "transform 0.22s cubic-bezier(0.16,1,0.3,1)",
          touchAction: "pan-y",
          opacity: exiting ? 0.3 : 1,
        }}
        className="relative bg-black/60 border border-brand-900/30 rounded-2xl p-5 min-h-[260px] max-h-[46vh] flex flex-col overflow-hidden"
      >
        {acceptGlow > 0 && (
          <div className="absolute inset-0 rounded-2xl border-2 border-green-400/70 pointer-events-none" style={{ opacity: acceptGlow, background: `rgba(34,197,94,${acceptGlow * 0.08})` }} />
        )}
        {declineGlow > 0 && (
          <div className="absolute inset-0 rounded-2xl border-2 border-danger-400/70 pointer-events-none" style={{ opacity: declineGlow, background: `rgba(255,255,255,${declineGlow * 0.08})` }} />
        )}
        {acceptGlow > 0.15 && (
          <div className="absolute top-4 right-4 text-green-400 border-2 border-green-400 rounded-lg px-2 py-1 text-xs font-bold rotate-6 pointer-events-none" style={{ opacity: acceptGlow }}>SAVE</div>
        )}
        {declineGlow > 0.15 && (
          <div className="absolute top-4 left-4 text-danger-400 border-2 border-danger-400 rounded-lg px-2 py-1 text-xs font-bold -rotate-6 pointer-events-none" style={{ opacity: declineGlow }}>PASS</div>
        )}

        {categoryLabel && <div className="text-[10px] uppercase tracking-wider text-brand-400/70 mb-1.5 flex-shrink-0">{categoryLabel}</div>}
        <div className="font-bold text-base mb-2 flex-shrink-0 pr-2">{title}</div>
        <div className="text-xs text-white/70 whitespace-pre-wrap leading-relaxed flex-1 overflow-y-auto pr-1">{script}</div>
      </div>

      {/* Explicit buttons — always available, not swipe-only (desktop has no touch events) */}
      <div className="flex gap-3 mt-4">
        <button
          disabled={busy}
          onClick={() => !busy && commit("left")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-brand-950/30 hover:border-brand-700/40 text-white/70 hover:text-brand-300 text-xs font-semibold transition disabled:opacity-40"
        >
          <X size={14} /> Pass
        </button>
        <button
          disabled={busy}
          onClick={() => !busy && commit("right")}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-green-700/40 bg-green-950/20 hover:bg-green-900/30 text-green-300 text-xs font-semibold transition disabled:opacity-40"
        >
          <Heart size={14} /> Save
        </button>
      </div>
      <div className="text-center text-[9px] text-white/30 mt-2 md:hidden">Swipe right to save · left to pass</div>
    </div>
  );
}
