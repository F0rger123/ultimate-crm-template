import React from "react";

// Brand mark. Kept as a single shared component (used across App.tsx's
// login/sidebar badges, EmployeePortal's login screen and header,
// ClientAuthPortal's login screen, and MarketingShared's nav/footer)
// instead of duplicating the same SVG in six places, since public/favicon.svg
// is a separate static asset (can't reference a React component) but should
// stay visually identical.
//
// BUG FIX — "the logo on the landing page still isn't right." Root cause,
// confirmed by reading every call site (App.tsx's login screen,
// ClientAuthPortal, EmployeePortal, MarketingShared's nav AND footer):
// this component is ALWAYS rendered inside a `bg-gradient-to-br from-
// red-600 to-brand-900` badge — every single usage, no exceptions. The "B"
// glyph below was filled #ffffff (Tailwind red-600) — nearly the exact
// same red as the badge it sits on. Against a red background, a red
// letter is camouflaged: the mark visually read as a lone white "C" (or a
// smudge) everywhere it appeared, which is exactly "not right" without
// being an obvious crash or layout bug. Both letters are white now — full
// contrast against every real usage. (favicon.svg is a separate static
// file with its own black background, where the red B was already fine —
// left as-is.)
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      <text x="32" y="68" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontWeight={800} fontSize={48} fill="currentColor" textAnchor="middle">C</text>
      <text x="68" y="68" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" fontWeight={800} fontSize={48} fill="currentColor" textAnchor="middle">S</text>
    </svg>
  );
}
