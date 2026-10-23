# AGENTS.md — rules for every AI coding agent

This repo is a CRM starter that gets customized per client. The **repository is the shared memory** between the owner and every agent (Claude Code, Codex, Gemini/Antigravity, others). Chat history is not memory. If it matters, it's written in `docs/client/`.

## 0. First thing every session

Asked to "set up" this repo or turn it into someone's CRM? Follow `docs/SETUP_WIZARD.md` (it links back here for the rules).

1. Read this file.
2. Open `docs/client/project-state.json`.
   - `onboarding.status` is `"not_started"` → **fresh client**. Follow `docs/ONBOARDING.md`. Don't write feature code yet.
   - Otherwise → **existing project**. Read, in order: `ACTIVE.md`, the top entry of `HANDOFF.md`, `BUSINESS_PROFILE.md`, `MASTER_REQUIREMENTS.md`, `BUGS.md`, `DECISIONS.md`, `BRANDING.md`. Skim the rest of `docs/client/` as needed.
3. Read `docs/ARCHITECTURE.md` before touching code (conventions that prevent known bugs).
4. Don't modify code until you understand the current requirements — unless the owner explicitly tells you to.

## 1. Rules

1. **Record every requirement.** Anything durable the owner says goes into the right doc *during the session* (routing table in §3).
2. **Never assume a feature is finished** because the code exists, a commit says so, or a previous agent said so. Check.
3. **Never silently drop an older requirement** because a newer request looks related. Update or supersede it explicitly (keep history).
4. **Conflicts → ask.** If two requirements, decisions, or branding rules conflict, flag it in `QUESTIONS.md` and ask the owner. Don't guess.
5. **Keep these separate**: requested → approved → implemented → tested → verified. See §2.
6. **Never mark something Resolved/Verified just because code was written.** Code that compiles but hasn't been tested is `Needs Testing`.
7. **Preserve partial work.** If you stop mid-task, mark it `Partially Implemented` / `In Progress` and say exactly what's left. Don't delete or hide it.
8. **Reopen, don't duplicate.** "That still isn't fixed" → reopen the existing bug/requirement, add a dated note. Search by keyword before creating a new ID.
9. **Keep failed attempts.** Every fix attempt (including ones that didn't work) goes in the bug's attempt history.
10. **Your own ideas are ideas.** Suggest freely, record them in `IDEAS.md`, but never promote them to approved requirements without the owner's explicit yes.
11. **Don't redesign** away from `BRANDING.md` / `DECISIONS.md` because you prefer something else. Propose changes as ideas.
12. **Ask focused questions** only when information is genuinely missing — and check `QUESTIONS.md`, `BUSINESS_PROFILE.md`, and `DECISIONS.md` first so you don't re-ask answered questions.
13. **End every meaningful session** by updating `ACTIVE.md`, adding a `HANDOFF.md` entry (newest first), updating statuses, and `CHANGELOG.md` for user-visible changes. Then commit.
14. **Never commit secrets.** `INTEGRATIONS.md` records which credentials exist and where they live — never their values.

## 2. Status model (short version — full definitions in `docs/PROCESS.md`)

Requirements: `Idea · Needs Clarification · Proposed · Approved · Planned · In Progress · Partially Implemented · Implemented · Needs Testing · Blocked · Resolved · Verified · Rejected · Deferred · Superseded`

Bugs: `Reported · Reproduced · Investigating · Fix Attempted · Partially Fixed · Needs Retest · Resolved · Verified · Cannot Reproduce · Reopened`

Evidence levels (record which one you actually reached):
`CODE WRITTEN` → `LOCAL TEST PASSED` → `INTEGRATION TEST PASSED` → `USER TESTED` → `PRODUCTION VERIFIED`

- Only the owner's confirmation (or production evidence) moves an item to **Verified**.
- "Resolved" needs at least `LOCAL TEST PASSED` *and* the specific reported behavior checked.

## 3. Where things go

| Owner says… | Write it to |
|---|---|
| A feature they want, a change request | `MASTER_REQUIREMENTS.md` (+ `ROADMAP.md` once approved) |
| "Maybe later…", a brainstorm, your suggestion | `IDEAS.md` |
| Something is broken / still broken | `BUGS.md` (reopen if it exists) |
| Colors, fonts, layout, likes/dislikes, "I hate X" | `BRANDING.md` |
| How the business works, steps, exceptions | `WORKFLOWS.md` |
| A tool/service to connect | `INTEGRATIONS.md` (+ requirement or idea) |
| Business facts, terminology, team, rules | `BUSINESS_PROFILE.md` |
| A choice between alternatives | `DECISIONS.md` |
| Something you need answered | `QUESTIONS.md` |
| "No, don't do that" | Mark `Rejected` with the reason (never delete) |

## 4. IDs

`REQ-###` requirements · `BUG-###` bugs · `IDEA-###` ideas · `DEC-###` decisions · `Q-###` questions · `INT-###` integrations · `WF-###` workflows. IDs are permanent — never renumber or reuse. Run `npm run docs:check` to catch duplicate IDs and a broken `project-state.json`.

## 5. Working on code

- Branch per piece of work when practical; reference IDs in commit messages (`REQ-012: add property list`).
- Verify with `npm run check` (typecheck + Cloudflare function bundle + build) before claiming anything compiles.
- UI changes: actually exercise the feature (dev server/preview) before claiming it works. If you can't, say so and leave the item at `Needs Testing`.
- Database changes: add a numbered file in `supabase/migrations/`, note it in the handoff, and tell the owner it must be run.

## 6. Client repos vs. the starter

`F0rger123/ultimate-crm-template` stays generic: blank `docs/client/` templates, no client data. A client project is a **separate repository** created from the starter (see `docs/START_NEW_CLIENT.md`). Never push client docs, branding, or data back to the starter. Pristine copies of the client docs live in `docs/templates/` — don't edit those inside a client project.
