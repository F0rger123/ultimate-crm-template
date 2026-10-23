// Haptic feedback on tap — owner request: "when I'm on mobile and I click
// stuff, it should have actual haptic feedback."
//
// PLATFORM LIMITATION (real, not a bug to fix): the Vibration API
// (navigator.vibrate) this relies on is supported on Android in every
// Chromium-based browser, including an installed PWA — real haptic ticks on
// every tap there. iOS/Safari has NEVER implemented navigator.vibrate, in a
// browser tab OR an installed Home Screen app — Apple simply doesn't expose
// haptics to web content (the only narrow exception is the native
// `<input type="checkbox" switch>` toggle control in iOS 17.4+, which fires
// the system's own switch-flip haptic automatically and isn't something a
// generic "tap anything" hook can extend to every button/link). vibrate()
// below is a harmless, silent no-op on iOS — there's no web API this app
// can call instead to get a real haptic tick there.
export const haptic = (pattern: number | number[] = 10): void => {
  try { navigator.vibrate?.(pattern); } catch { /* no-op where unsupported */ }
};

// One document-level listener instead of instrumenting every individual
// onClick by hand across 40+ page files — fires a short tick on anything
// that reads as "interactive" (button/link/role, checkboxes/radios/range/
// select, or an explicit opt-in via data-haptic on a custom control).
//
// BUG FIX — "still no haptics on Android." This used to fire on
// `pointerdown` filtered to `pointerType === "touch"`. Per the Vibration
// API spec (and Chromium's actual enforcement of it), navigator.vibrate()
// is only honored during "sticky user activation" — some browser versions/
// configurations don't credit a raw pointerdown/touchstart as activation-
// worthy the way they credit a real `click`, so the vibrate() call could
// be silently dropped even though a real finger tap triggered it (no error,
// no console warning — it just does nothing, which reads exactly like
// "haptics don't work here"). `click` is the one event every browser
// reliably treats as a genuine user-activating gesture, so triggering here
// instead removes that whole class of silent failure. It also means this
// no longer needs the pointerType/touch filter at all — click doesn't
// reliably carry pointerType across browsers anyway, and calling
// navigator.vibrate() on a desktop click is still a harmless no-op with no
// vibration hardware to act on.
export const installGlobalHaptics = (): (() => void) => {
  const handler = (e: MouseEvent) => {
    const target = (e.target as HTMLElement)?.closest?.(
      'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], input[type="range"], select, [data-haptic]'
    ) as HTMLButtonElement | null;
    if (!target || target.disabled || target.getAttribute("aria-disabled") === "true") return;
    haptic(10);
  };
  document.addEventListener("click", handler, { passive: true, capture: true });
  return () => document.removeEventListener("click", handler, { capture: true } as EventListenerOptions);
};
