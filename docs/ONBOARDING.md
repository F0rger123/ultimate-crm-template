# Onboarding a new CRM client

You're turning this starter into a CRM for a specific business. Onboarding is a **conversation**, not a form. Your job is to understand the business, help the owner think, and write everything down in `docs/client/` as you go.

**Don't write feature code during onboarding.** (Setup tasks — creating the client repo, renaming the project — are fine; see `START_NEW_CLIENT.md`.)

## How to run it

- **Small groups.** Ask 3–5 related questions at a time. Wait for answers. Never dump the whole list.
- **Listen, then reflect back.** Summarize what you heard in one or two lines before moving on, so mistakes get caught early.
- **Help them think.** When an answer reveals repetitive work, a gap, or a handoff that could break, point it out and offer an idea. Example:
  > Owner: "We text customers when we're driving over."
  > You: "That could be an automatic *On My Way* text when the tech taps *Start Driving* — want it to include a live ETA? Or keep it manual?"
  Approved → `REQ`. Maybe → `IDEA`. No → `IDEA` marked Rejected (so nobody suggests it again).
- **Owner decides.** Suggestions are ideas until the owner says yes.
- **Skip what you already know.** Check `BUSINESS_PROFILE.md` and `QUESTIONS.md` before asking. If the owner pasted a big brief up front, extract everything from it first and only ask about gaps.
- **Adapt.** Skip phases that don't apply (no team → skip most of Phase 6). Go deeper where the business is unusual.
- **Write as you go**, not at the end. After each phase, update the docs and briefly tell the owner what you recorded.
- **Use their words.** Put their terminology in `BUSINESS_PROFILE.md → Terminology` and use it in the UI later ("visits" vs "jobs", "estimates" vs "quotes", "crew" vs "techs").
- At the start, set `project-state.json → onboarding.status` to `"in_progress"` and record the current phase as you go.

## What the starter already has

Know this so you can map their needs to existing modules instead of proposing to rebuild them: customers & leads, pipeline, quotes/estimates & invoices (packages, deposits, e-signature), jobs/projects & work orders, calendar & recurring work, route optimization, checklists, photos/files, employee/field portal, client portal, live team view, time tracking & pay, hiring/onboarding/training/SOPs, payments (Manual/Stripe/Square), Twilio SMS inbox, Gmail, Google Calendar/Maps, campaigns & promotions, reviews & referrals, automations builder, inventory & equipment, expenses/budget/reports, AI assistant (in-app + SMS). Details: `README.md`.

For each module, the outcome of onboarding is one of: **keep as is**, **customize** (→ requirements), **hide/disable**, or **build new**.

---

## Phase 1 — Business

- What does the business do, in a sentence or two?
- Who are the customers (homeowners, property managers, commercial, government…)? Roughly how many active?
- What services/products do they sell? How is each priced (flat, hourly, per unit, per sqft, packages, subscriptions)?
- Where do they operate? One location or several? Service radius?
- Team: how many people, what roles?
- Recurring vs. one-time work — what's the mix?

→ `BUSINESS_PROFILE.md`

## Phase 2 — Current workflow

Walk the life of a typical job, start to finish:

- How do leads arrive (phone, form, referrals, ads, walk-ins)?
- How are quotes created and sent? Site visits? Approvals?
- Deposits? When are they collected?
- How is work scheduled and assigned? Who decides?
- What happens on the job (checklists, photos, signatures, materials)?
- How do they invoice, and when? How do customers pay?
- What happens after (review request, follow-up, warranty, next service)?
- What are the common exceptions (reschedules, cancellations, no-shows, change orders, disputes)?

→ `WORKFLOWS.md` (one `WF-###` per flow, including exceptions)

## Phase 3 — Problems

- What wastes the most time every week?
- What gets forgotten or falls through the cracks?
- What causes mistakes or unhappy customers?
- What software do they use now, and what do they dislike about it?
- If one thing could happen automatically, what would it be?

→ `BUSINESS_PROFILE.md → Pain points`; turn each pain point into a candidate `REQ` or `IDEA`.

## Phase 4 — CRM structure

Go through the modules: customers, leads, jobs/projects, team, calendar, quotes, invoices, portals, documents, inventory, reporting.

- Which do they need? Which are noise?
- What information must be stored that's specific to them (custom fields)? e.g. property details, equipment serial numbers, pet notes, gate codes.
- One customer → many properties/sites? Many contacts?
- What do they need to see at a glance each morning?

→ `MASTER_REQUIREMENTS.md` (Proposed), module decisions in `DECISIONS.md`.

## Phase 5 — Integrations

Ask about each, and what they use today: email (Gmail/Outlook), SMS, calendar, payments (Stripe/Square/other, existing merchant account?), accounting (QuickBooks/Xero), maps/routing, social media, review sites, AI, phone system, forms, anything else.

→ `INTEGRATIONS.md` (one `INT-###` each). Never ask for secrets in chat — just record which credentials will be needed and who owns them.

## Phase 6 — Team & permissions

For each role (owner, managers, office staff, field employees, subcontractors, customers):

- What should they see? What must they *not* see (pay, margins, other customers)?
- What can they do (create quotes, send invoices, take payments, edit schedule)?
- Mobile or desktop? In the field with gloves on?

→ `BUSINESS_PROFILE.md → Roles` + permission requirements.

## Phase 7 — Automations

Ask: **"What repetitive things do you currently do by hand?"** Then brainstorm triggers → actions with them:

- reminders (appointment, payment, renewal), follow-ups on quotes, review requests, on-my-way texts, assignment notices, recurring job creation, overdue invoice escalation, internal alerts.

For each: trigger, action, channel, timing, who it goes to, can the owner approve before it sends?

→ `WORKFLOWS.md` (automation section) + `REQ` or `IDEA`.

## Phase 8 — Branding & UX

- Logo (ask them to add the file to the repo or share a link), brand colors, fonts.
- Overall feel: bold / minimal / friendly / premium / rugged?
- Sites or apps they love the look of (links/screenshots)? Anything they hate?
- Where will they use it most — phone in the truck, tablet, office desktop? Dark or light?
- Customer-facing pieces (quotes, invoices, portal, emails): how should they look?

→ `BRANDING.md` (Likes / Dislikes / Approved / Undecided). Record their exact words.

## Phase 9 — Special features

Ask directly: **"What's something your business does that generic CRMs never seem to understand?"**

Follow up until you get concrete examples. This is usually where the most valuable custom requirements come from.

→ `MASTER_REQUIREMENTS.md`, `WORKFLOWS.md`.

## Phase 10 — Review & confirm

Before building anything, present one summary:

1. **Business** — what they do, customers, services, team.
2. **Workflows** — the main flows, in their words.
3. **Problems** — top pain points and how the CRM addresses each.
4. **Modules** — keep / customize / hide / build new.
5. **Integrations** — what, why, status.
6. **Special features.**
7. **Branding** — summary of approved and undecided items.
8. **Open questions** from `QUESTIONS.md`.
9. **Master requirements list** — every `REQ`, grouped by area, with priority.
10. **Proposed roadmap** — phases referencing REQ IDs (`ROADMAP.md`).

Ask the owner to confirm, correct, or reprioritize. Apply changes. When they approve:

- Mark approved requirements `Approved`/`Planned`.
- Set `BUSINESS_PROFILE.md → Onboarding complete: Yes` with the date.
- Set `project-state.json → onboarding.status` to `"complete"`, `current_phase` to the first roadmap phase.
- Write a `HANDOFF.md` entry summarizing onboarding.
- Commit and push.

Then start building, phase by phase, following `AGENTS.md`.
