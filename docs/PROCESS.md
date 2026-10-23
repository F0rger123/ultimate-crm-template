# Project process — statuses, evidence, and memory rules

`AGENTS.md` has the short version. This is the reference.

## Requirement statuses

| Status | Meaning | Who can set it |
|---|---|---|
| Idea | Lives in `IDEAS.md`, not a requirement yet | anyone |
| Needs Clarification | Owner wants it, but something essential is unknown (linked `Q-###`) | agent |
| Proposed | Agent drafted it from owner input; owner hasn't approved the wording/scope | agent |
| Approved | Owner said yes to this scope | **owner** (agent records it) |
| Planned | Approved and placed in a roadmap phase | agent |
| In Progress | Someone is actively working on it (see `ACTIVE.md`) | agent |
| Partially Implemented | Some acceptance criteria done, others not — list which | agent |
| Implemented | All acceptance criteria have code; evidence ≥ `CODE WRITTEN` | agent |
| Needs Testing | Implemented but not exercised yet | agent |
| Blocked | Can't proceed — say on what (question, credential, decision, other REQ) | agent |
| Resolved | Tested by the agent: evidence ≥ `LOCAL TEST PASSED` for every criterion | agent |
| Verified | Owner confirmed it works, or `PRODUCTION VERIFIED` evidence exists | **owner/production** |
| Rejected | Owner said no. Keep it, with the reason | owner |
| Deferred | Approved in principle, intentionally postponed | owner |
| Superseded | Replaced by another item — link it (`Superseded by REQ-045`) | agent |

Normal path: `Proposed → Approved → Planned → In Progress → Implemented → Needs Testing → Resolved → Verified`.

## Bug statuses

| Status | Meaning |
|---|---|
| Reported | Owner/agent described it; not yet reproduced |
| Reproduced | Seen happening, with steps |
| Investigating | Looking for the cause |
| Fix Attempted | A change was made; not yet confirmed to fix it |
| Partially Fixed | Some symptoms gone, others remain |
| Needs Retest | Fix deployed/built, waiting on someone to re-test |
| Resolved | Agent re-ran the reproduction and it no longer happens |
| Verified | Owner confirmed, or production evidence |
| Cannot Reproduce | Tried and couldn't — record what was tried |
| Reopened | Previously Resolved/Verified, came back |

## Evidence levels

Record the highest one **actually reached**, per item:

1. `CODE WRITTEN` — change exists, maybe compiles.
2. `LOCAL TEST PASSED` — `npm run check` passes **and** the specific behavior was exercised locally (dev server, preview, script, or unit test).
3. `INTEGRATION TEST PASSED` — exercised against real external services (Supabase, Stripe test mode, Twilio, Google…).
4. `USER TESTED` — the owner tried it and said it works.
5. `PRODUCTION VERIFIED` — confirmed working on the live deployment.

A typecheck is not a test of behavior. "It builds" = `CODE WRITTEN`.

## Reopening

When the owner says something still doesn't work:

1. Search `BUGS.md` and `MASTER_REQUIREMENTS.md` by keyword/area for the existing item.
2. If found: set status `Reopened` (bug) or back to `In Progress`/`Partially Implemented` (requirement). Add a dated history line quoting the owner. Keep every previous attempt.
3. Only create a new ID if it's genuinely a different problem — and link the related item.
4. A Resolved/Verified item that regresses is reopened, not recreated.

When the owner says "perfect, that's fixed": move to `Verified` only if the implementation history supports it (there's an actual fix for that exact behavior). If the history is unclear, mark `Verified` with a note of what the owner confirmed, or ask.

## Ideas → requirements

1. Any idea (owner's "maybe later", or an agent suggestion) → `IDEAS.md` as `IDEA-###`, status `Open`.
2. Agent asks the owner. Owner says yes → create `REQ-###` (status `Approved`), set the idea to `Promoted → REQ-###`.
3. Owner says no → idea `Rejected` with reason. Not now → `Parked`.
4. Agents never self-approve. "It seemed obviously useful" is not approval.

## Superseding & conflicts

- Requirements change: don't rewrite history. Edit the item's **Request/Acceptance** section *and* add a dated **History** line describing what changed. For a large change, mark the old item `Superseded by REQ-xxx` and create the new one.
- Conflicts (two requirements, a requirement vs. `BRANDING.md`, a request vs. a `DEC-###`): add a `Q-###`, mark affected items `Needs Clarification`, ask the owner. Record the answer, then update both items.

## The memory rule

> If the owner communicates a durable project fact, update the corresponding document **before the session ends**.

Durable = still true or still wanted next week. Examples:

| Owner says | Action |
|---|---|
| "I hate rounded cards." | `BRANDING.md` → Dislikes |
| "QuickBooks would be useful later." | `IDEAS.md` + `INTEGRATIONS.md` (status Requested/Idea) |
| "The customer has two locations." | `BUSINESS_PROFILE.md` |
| "The invoice button still doesn't work." | `BUGS.md` — reopen existing bug |
| "The calendar issue is completely fixed." | Check history, then `Verified` |
| "Maybe later we should add inventory." | `IDEAS.md` |
| "I definitely want inventory." | `MASTER_REQUIREMENTS.md` (Approved) + `ROADMAP.md` |
| "Use Stripe, not Square." | `DECISIONS.md` + `INTEGRATIONS.md` |

Write the owner's own words in the item's **Source** field when the wording matters.

## End-of-session checklist

- [ ] Every durable fact from this session is in `docs/client/`.
- [ ] Statuses + evidence levels updated for everything touched.
- [ ] Failed attempts recorded in `BUGS.md`.
- [ ] `ACTIVE.md` reflects what's in progress right now (or "nothing active").
- [ ] New `HANDOFF.md` entry at the top.
- [ ] `CHANGELOG.md` for user-visible changes.
- [ ] `project-state.json` updated (active IDs, open bugs, phase, last handoff commit).
- [ ] `npm run docs:check` passes; `npm run check` passes if code changed.
- [ ] Committed and pushed.
