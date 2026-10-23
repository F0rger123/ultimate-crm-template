# Starter Changelog

Changes to the **generic starter itself** (`F0rger123/ultimate-crm-template`). Client projects record their own changes in `docs/client/CHANGELOG.md` and should leave this file alone. When pulling starter updates into a client repo (`git merge starter/main`), read this to see what changed.

## 2026-10-03 — monochrome branding
- Default theme is now black / white / grayscale. The red brand accent is gone; primary buttons, active tabs and badges are white with black text.
- All UI colors are centralized as CSS variables in the `THEME TOKENS` block of `src/index.css`, mapped into Tailwind (`brand-*`, `brand-fg`, `danger-*`, `surface`, `ink`, `edge`) in `tailwind.config.js`. Charts read tokens through `themeColor()` in `src/lib/theme.ts`. See "Theming" in `docs/ARCHITECTURE.md`.
- Red is kept only as the semantic `danger-*` scale (delete, errors, overdue, declined/failed). Green (success) and yellow/amber (warning) status colors are unchanged.
- Customer-facing quote/invoice/email HTML uses `#111111` instead of red.
- Fixed white-on-white: the logo mark (`BrandMark`) and text/icons on solid brand headers now use `currentColor` / `text-brand-fg`.
- Automations: hub badge reads gray "PAUSED" (was red); workflow node and category colors are grayscale.

## 2026-10-03 — preview audit fixes
- Fixed a crash ("Rendered fewer hooks than expected") when moving in the same tab between a signed-in CRM page and a public route (client portal, quote link, lead form, legal pages): public-route early returns now sit below every hook in `App.tsx`.
- Removed leftover CrewBoss wordmarks/monogram ("Crew**Boss**", "CB" icon, "like a boss" tagline); regenerated PWA icons as "CS".
- Push notifications: opt-in pop-up no longer appears when VAPID keys aren't configured; clearer "not set up" message.
- Weather: no hardcoded default city; forecast stays off until a location/company address is set.
- Alfred: removed a badge that always claimed "Claude AI connected" even with no AI key.

## 2026-10-03
- Added the agent process and project-memory system: `AGENTS.md`, `docs/PROCESS.md`, `docs/ONBOARDING.md`, `docs/START_NEW_CLIENT.md`, `docs/RESUME_PROJECT.md`, blank `docs/client/` docs with pristine copies in `docs/templates/`, `docs/client/project-state.json` index.
- Moved code conventions from `CLAUDE.md` to `docs/ARCHITECTURE.md`; `CLAUDE.md` and `GEMINI.md` now point to `AGENTS.md`.
- Added `npm run docs:check` (duplicate IDs, summary/detail sync, status values, template hygiene).

## 2026-10-03 — initial
- Industry-neutral CRM extracted and generalized from a production field-service CRM. Payments layer (Manual/Stripe/Square), env-based config, consolidated `supabase/schema.sql`.
