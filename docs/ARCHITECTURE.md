# Architecture & code conventions

Technical conventions for this codebase that aren't obvious from the code — read before modifying it. Process rules (requirements, bugs, handoffs) are in `AGENTS.md`; setup and deployment in `README.md`.

## Stack

- React 18 + TypeScript + Vite + Tailwind. `tsconfig.app.json` has `strict: false` — the codebase leans on `any`; `tsc -b` only fails on real type errors.
- Supabase (auth, Postgres, storage). No separate backend server.
- Cloudflare Pages Functions in `functions/api/` for anything needing a secret (service-role DB access, payments, Twilio, AI calls, webhooks). `functions/api/_middleware.ts` loads env per request into `functions/api/_lib/env.ts` (live bindings — import `SUPABASE_URL` etc. from there, never hardcode).
- Verify before shipping: `npm run check` (typecheck + bundle every function + build).

## Database

- Baseline schema: `supabase/schema.sql`. New changes: numbered files in `supabase/migrations/`. The anon key can't run DDL — the owner runs SQL in the Supabase SQL Editor.
- **Double-quote camelCase column names** in SQL. Postgres folds unquoted identifiers to lowercase; several `normalize*` helpers read every casing variant defensively.
- `estimates` holds both quotes and invoices (`invoiced: true` = invoice).
- IDs are UUID v4 from `uid()` (`src/lib/utils.ts`). Non-UUID ids silently fail against uuid columns.
- **RLS is owner-scoped**: each business table has `<table>_owner_scoped` with `owner_id = current_owner_id()`. An UPDATE/DELETE that RLS filters out returns success with 0 rows — always append `.select("id")` and treat an empty result as a failure.
- **Safe-column retry**: PostgREST rejects a whole write if any column is unknown. Job update helpers (`updateJob` in `JobsPage.tsx` / `EmployeePortal.tsx`) retry with a whitelist of core columns — add new job fields to that whitelist.
- Secrets live in `owner_secrets`, `owner_stripe_accounts`, `owner_square_accounts` (service-role only). Never put secrets in `app_settings` — every employee session can read it.

## Rules

- Every user-facing action shows a success toast and a failure toast with the reason. No silent failures.
- Async button handlers wrap network calls in `withTimeout(promise, ms, label)` so a hung request can't leave a button stuck.
- Customer-facing sends from the field portal (on-my-way, running late, invoice) use `sendOwnerGmailOnly` (owner's Gmail), not the generic `sendEmail` fallback.
- SMS sent anywhere is logged to `inbox_threads` via `logOutboundSmsToInbox`.
- `crewAssignedAt` on `jobs` is JSONB `{ [employeeId]: timestampMs }`.
- Google Places uses `AutocompleteSuggestion.fetchAutocompleteSuggestions` (the legacy `AutocompleteService` is blocked for new Cloud projects).
- Don't define components inside other components' bodies (causes remount/flicker).
- Payments go through `src/lib/payments` — `resolvePaymentProvider()` decides Manual / Stripe / Square; customers only ever see one.
- **Payment amounts are computed server-side** in `functions/api/_lib/amountDue.ts` (`payType` full / deposit / remaining, verified promo or referral) for Stripe and Square. Never trust the amount the browser sends.
- **Never await Supabase calls inside `supabase.auth.onAuthStateChange`.** The callback runs while supabase-js holds its auth lock; a query inside it deadlocks sign-in/sign-out after a token refresh. `App.tsx` defers the handler with `setTimeout(…, 0)`.
- **Hooks before early returns in `App.tsx`.** Public pages (quote/invoice links, client portal, lead form, legal) return early; those returns must sit below every hook or switching pages crashes (React #310). Public customer routes are listed in `isPublicCustomerHash()` (`src/lib/supabase.ts`) so a signed-in employee/owner on the same device is never redirected away from a customer link.
- **Sign-out** calls `clearLocalAuthSession()` so the session is gone even if the logout request fails.
- **Money**: `fmt()` shows cents when present ($0.50, $1.06); deposits use `computeDepositAmount` (`depositType` "percent" | "amount") and are capped at the total.
- **Website lead form** (`#/lead-form?oid=<owner id>`) → `submit_lead_form` in `functions/api/public-data.ts`, which checks the business id is a real account and builds the lead row server-side from a fixed field list, so each business's leads land only in its own list.

## Theming (colors)

The starter ships **black / white / grayscale**. All UI colors come from one place: the `THEME TOKENS` block at the top of `src/index.css`. To rebrand a client project, edit the values there; don't add color classes or hex values in components.

| Token(s) | What it controls |
|---|---|
| `--brand-50` … `--brand-950` | Primary/accent scale used by every `brand-*` Tailwind class. Shade numbers are roles, not lightness: 300–500 light accent text, 500–800 solid fills (buttons, active tabs, avatars), 900–950 low-opacity tints and borders. |
| `--brand-fg` | Text/icons on a solid brand fill (`text-brand-fg`). Black by default because the default primary is white. If you switch to a dark primary, set this to white. |
| `--danger-50` … `--danger-950` | Semantic danger scale (`danger-*` classes): delete, errors, overdue, declined/failed. Red by default. |
| `--surface-rgb`, `--surface-2-rgb`, `--ink-rgb`, `--ink-soft-rgb`, `--edge-rgb`, `--app-bg` | Background, card surface, text, muted text, borders, page background (`surface`, `ink`, `edge` classes). |
| `--chart-1/2/3`, `--chart-grid` | Chart series and gridlines. Read in TS with `themeColor("--chart-1")` (`src/lib/theme.ts`) for Recharts/SVG/canvas, where Tailwind classes can't reach. |
| `--glow` | Glows, focus rings, scrollbar, highlight effects. |
| `--brand`, `--brand-accent` | Hex brand colors for inline styles. Overridden at runtime from Settings → Company (`brandPrimary`/`brandColor`, `brandAccent`) in `App.tsx`. |

- `tailwind.config.js` maps each token to a Tailwind color as `rgb(var(--token) / <alpha-value>)`, so opacity modifiers (`bg-brand-600/40`) work. Restart the dev server after changing `tailwind.config.js`.
- Text on a solid `bg-brand-500…800` fill must use `text-brand-fg`, never `text-white` (white-on-white with the default theme).
- Status colors are the only non-gray colors meant to remain: `danger-*` (destructive/error/overdue), green (success/active/paid), yellow/amber (warning/pending). Keep them low-opacity tints with light text, not big saturated blocks.
- Customer-facing documents and emails (quote/invoice HTML, email templates) are rendered outside the app's CSS, so they use literal hex values — `#111111` for brand elements by default. Search for `#111111` when rebranding those.

## Key files

- `src/App.tsx` — hash routing, auth/roles (`resolveUserRole`), Supabase sync + polling, settings sync.
- `src/components/pages/EmployeePortal.tsx` — field portal (`#/portal`).
- `src/components/pages/AlfredPage.tsx` — AI assistant (tools, system prompt).
- `src/components/pages/ClientPortal.tsx` / `ClientAuthPortal.tsx` — customer quote/invoice pages and customer login portal (`#/client`).
- `src/lib/messaging.ts` — Twilio, Gmail, email templates. `src/lib/api.ts` — model calls (proxied via `functions/api/call-model.ts`).
- `functions/api/twilio-sms-webhook.ts` + `_lib/alfred*Agent.ts` — text-message Alfred.

## Auth

- Owners: email/password or Google OAuth. Employees: invite link (`#/portal?invite=CODE`), email/password. Customers: separate client portal session.
- `resolveUserRole()` in `App.tsx` is the single source of truth for which UI a session sees.
