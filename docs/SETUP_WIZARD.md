# Setup wizard — for AI agents

Use this when someone says anything like *"this is an open-source CRM repo, help me set it up"* or *"turn this into a CRM for my business."* You are the setup wizard: interview the owner, write down what they say, get the app running, then build their version.

Work in this order. Don't skip ahead to code.

1. Interview (below) → write answers into `docs/client/`.
2. Technical setup (below) → app running locally, then deployed.
3. Build plan → owner approves → implement → test.

Rules that apply throughout are in `AGENTS.md`. The full question bank for the interview is `docs/ONBOARDING.md`. This file is the short path through both.

---

## Step 1 — Interview

Ask in small groups (3–5 questions), wait for answers, reflect back in one or two lines, and write to the doc named after each group before moving on. If the owner pastes a brief, pull everything you can from it first and only ask about gaps.

Set `docs/client/project-state.json → onboarding.status` to `"in_progress"` when you start.

**A. Blueprint — what is this business?** → `BUSINESS_PROFILE.md`
- What does the business do, in a sentence? Who are the customers?
- What do they sell, and how is each thing priced (flat, hourly, per unit, packages, subscriptions)?
- How many people, in what roles? One location or several?
- What words do they use ("jobs" or "visits", "quotes" or "estimates", "crew" or "techs")?

**B. Current progress — what exists today?** → `BUSINESS_PROFILE.md`, `INTEGRATIONS.md`
- What do they use now (spreadsheets, another CRM, paper, texts)? Anything to import?
- Which accounts already exist: domain, Google Workspace/Gmail, Stripe or Square, Twilio, Supabase, Cloudflare?
- Is anything from this repo already set up or customized?

**C. Current problems** → `MASTER_REQUIREMENTS.md`, `BUGS.md`
- What wastes the most time each week? What falls through the cracks?
- What causes unhappy customers or lost money?

**D. Goals** → `MASTER_REQUIREMENTS.md`, `ROADMAP.md`
- What must work on day one? What can wait?
- What does success look like in three months (fewer missed follow-ups, faster payment, less admin)?

**E. Ideas** → `IDEAS.md`
- Anything they've wished a CRM did? Anything they've seen elsewhere and liked?
- Offer your own ideas based on their answers, recorded as ideas until they say yes.

**F. Design aesthetics and personal preferences** → `BRANDING.md`
- Logo (file or description), brand colors, fonts. The starter is black/white/grayscale; colors live in one place (`src/index.css` → THEME TOKENS, see `docs/ARCHITECTURE.md` → Theming).
- Light or dark? Dense and data-heavy, or roomy and simple?
- Sites or apps whose look they like, and what they like about them.
- Mostly used on a phone in the field, or at a desk?
- Anything they dislike (record their exact words).

**G. Modules** → `MASTER_REQUIREMENTS.md`
Walk the module list in `docs/ONBOARDING.md` → "What the starter already has". For each: keep, customize, hide, or build new.

Finish with a summary the owner confirms. Then set `onboarding.status` to `"complete"`.

---

## Step 2 — Technical setup

Ask before each step whether they already have the account, and record what exists in `INTEGRATIONS.md` (never the secret values). Check each step works before moving on.

| # | Step | Where the details are | How to check it worked |
|---|---|---|---|
| 1 | Node 20+, `npm ci` | `README.md` → Quick start | `npm run check` passes |
| 2 | Supabase project, run `supabase/schema.sql` | `README.md` → Supabase setup | Sign up in the app; an owner row appears in `employees` |
| 3 | `.env` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | `.env.example` | `npm run dev`, sign in works |
| 4 | Cloudflare Pages from GitHub, env vars + secrets | `README.md` → Cloudflare Pages deployment | Live URL loads; `/api/*` calls don't 404 |
| 5 | Supabase auth URLs (Site URL + Redirect URLs = live URL and localhost) | `README.md` → Supabase setup | Password reset email link opens the app |
| 6 | Google sign-in, Gmail, Calendar (optional) | below | Settings → Integrations shows Google connected; it stays connected after 8+ days |
| 7 | Payments: Manual, Stripe or Square (optional) | `README.md` → Payments | Pay a test invoice with a test card |
| 8 | Twilio SMS (optional) | Settings → Integrations; webhook in `README.md` | Text the number; it shows in Inbox |
| 9 | AI assistant keys (optional) | Settings → Alfred / API Keys | Ask Alfred a question in the app |
| 10 | Push notifications (optional) | `npm run gen:vapid`, VAPID vars | Enable alerts; test notification arrives |
| 11 | Scheduled jobs (reminders, automations) | `README.md` → Webhooks and schedules | Endpoint returns 200 with the key |
| 12 | Lead form on their website | Lead Intake → Get Embed Code | Submit the embedded form; the lead appears in Lead Intake |

### Google — avoid the 7-day disconnect

1. Google Cloud Console → create an OAuth client (Web), add the Supabase callback URL from Supabase → Authentication → Providers → Google.
2. Put the client ID and secret in Supabase (Google provider) **and** in Cloudflare as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (used to refresh tokens).
3. **OAuth consent screen → Publish app (In production).** While the app is in *Testing*, Google expires every saved sign-in after 7 days and the CRM shows "Google ended the saved sign-in". Gmail send/Calendar scopes may show an "unverified app" warning until Google verifies the app; the owner can click through it.
4. Connect once from Settings → Integrations so the server saves a refresh token.

---

## Step 3 — Build plan, then build

1. From the interview, write a numbered plan in `MASTER_REQUIREMENTS.md`: what to rename, hide, customize, and add, in the order you'll do it. Branding (terminology, logo, colors) usually goes first because it touches everything.
2. Show the owner the plan and get a yes. Items stay `Proposed` until then.
3. Implement in small steps. After each: `npm run check`, try it in the browser (phone width too), update statuses (`Needs Testing` until the owner confirms).
4. End every session per `AGENTS.md` §1 rule 13 (ACTIVE, HANDOFF, CHANGELOG, commit).

There is no in-app setup wizard yet; this document is the wizard. If the owner wants one in the app later, record it in `IDEAS.md`.
