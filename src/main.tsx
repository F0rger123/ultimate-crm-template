import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { supabase } from "./lib/supabase";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { installGlobalHaptics } from "./lib/haptics";
import "./index.css";

// AUDIT 1 — the only ErrorBoundary in the app previously lived INSIDE App.tsx
// wrapping just the routed CRM page content (<SafePage>). Every other render
// path — the header/sidebar/notifications shell around it, plus the early
// `return <EmployeePortal/>` / <ClientAuthPortal/> / <ReferralLanding/> /
// <CustomerReviewPage/> / <ResetPassword/> branches in App.tsx that run
// BEFORE that boundary is ever reached — had nothing catching a thrown error.
// React unmounts the whole tree on an uncaught render error, and index.css
// sets the page background to near-black (#050505), so any one of those
// throwing produced exactly a silent black screen with only a console error.
// Wrapping the single root render call here is the one change that protects
// every path at once, including ones added in the future.
window.addEventListener("error", (e) => console.error("[Boot] window error:", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => console.error("[Boot] unhandled promise rejection:", e.reason));

// Mount immediately — React renders from cached (localStorage) state right
// away; auth resolves in the background via App.tsx's own onAuthStateChange
// listener and getSession() call. This used to `await` (with a 3s timeout
// fallback) supabase.auth.initialize() before the FIRST render() call, which
// meant an unstyled, un-mounted #root against the near-black body background
// (index.css `background: #050505`) for up to 3 seconds on every reload — a
// real, visible black-screen delay, not a perceived one. Firing it without
// awaiting removes that delay entirely; any failure is just logged, never
// blocks rendering.
supabase.auth.initialize().catch(err => console.error("[Boot] supabase.auth.initialize() failed:", err));

// PWA — registers the minimal shell-caching service worker (public/sw.js)
// so Chrome/Android offers the "Install App" / Add to Home Screen prompt.
// Registered after load, never blocking first paint. Safe no-op on
// browsers without SW support (Safari has partial support; this just
// silently skips there).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(err => console.warn("[PWA] service worker registration failed:", err?.message));
  });
}

// A phone PWA can sit open in the background for days, keeping the JS bundle
// it first loaded in memory — so already-shipped fixes never reach it (seen
// live: an old-build Alfred bug reappearing a day after its fix deployed).
// When the app comes back to the foreground, check whether a newer build is
// live and reload into it. Unsent Alfred drafts persist in localStorage.
const currentBundle = (document.querySelector('script[type="module"][src*="/assets/index-"]') as HTMLScriptElement | null)?.src.match(/\/assets\/index-[\w-]+\.js/)?.[0];
let hiddenAt = 0;
if (currentBundle) {
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    if (!hiddenAt || Date.now() - hiddenAt < 60_000) return;
    try {
      const html = await (await fetch("/", { cache: "no-store" })).text();
      const live = html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
      if (live && live !== currentBundle) location.reload();
    } catch { /* offline — keep running the current build */ }
  });
}

// Haptic feedback on every tap, app-wide — one listener here covers the
// owner CRM, employee portal, and client portal alike (all mount under this
// single root). Real ticks on Android; a harmless no-op on iOS (see
// lib/haptics.ts's comment — that's a WebKit platform limitation, not
// something fixable here).
installGlobalHaptics();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
