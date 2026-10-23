# Resume an existing client project

## Copy-paste prompt

```text
You are continuing an existing custom CRM project:
[CLIENT REPO URL]

Before changing any code:
1. Read AGENTS.md, then docs/client/project-state.json, docs/client/ACTIVE.md, the latest
   docs/client/HANDOFF.md entry, and the rest of docs/client/ (BUSINESS_PROFILE,
   MASTER_REQUIREMENTS, BUGS, DECISIONS, BRANDING, WORKFLOWS, INTEGRATIONS, ROADMAP, QUESTIONS,
   IDEAS). Read docs/ARCHITECTURE.md before touching code.
2. Check the repo against the docs: git log since the last handoff commit, uncommitted
   changes, and whether anything the docs call "done" looks unfinished. Don't trust status
   labels blindly.
3. Give me a short briefing:
   - what this business does (2–3 lines)
   - current roadmap phase and what's left in it
   - what's active right now and what's blocked
   - open bugs, including ones with failed fix attempts
   - requirements that are Partially Implemented or Needs Testing
   - integrations not yet tested/verified
   - open questions waiting on me
   - the last handoff's recommended next step
   - anything in the code or git history that disagrees with the docs
4. Propose what to work on next and wait for my go-ahead (unless I've already told you what
   to do below).

Rules for this session: don't re-ask questions already answered in docs/client/; record every
new requirement, bug report, idea, branding preference, and decision I mention in the right
doc before the session ends; if I say something is still broken, reopen the existing item;
nothing is Verified until I confirm it or it's verified in production; finish with updated
ACTIVE.md, a new HANDOFF.md entry, updated statuses, and a commit + push.

Today I want to: [optional — task, bug, or feedback; leave blank to get the briefing first]
```

## Quick variant — bug report or feedback

```text
Continue the CRM project at [CLIENT REPO URL]. Follow AGENTS.md (read docs/client/ first).
Feedback: [what's broken / what to change].
Find any existing BUG/REQ for this and reopen/update it instead of creating a duplicate,
check its fix-attempt history before trying anything, and record every attempt. Tell me the
evidence level you actually reached when you're done.
```

## What the agent should do if things look wrong

- Docs say "Resolved" but the code doesn't contain a fix → set it back to the correct status, note it in History, mention it in the briefing.
- `ACTIVE.md` lists work from a previous session that was never finished → treat it as Partially Implemented; don't discard it.
- Docs and code disagree about a decision → `DECISIONS.md` wins until the owner says otherwise; ask.
- `docs/client/` is empty/blank → this isn't an onboarded project; switch to `docs/START_NEW_CLIENT.md`.
