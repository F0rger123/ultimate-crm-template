# Start a new client CRM

## Copy-paste prompt — guided onboarding

Fill in the two bracketed lines, paste into any AI coding agent:

```text
You are building a custom CRM for a new client, starting from this repository:
https://github.com/F0rger123/ultimate-crm-template

Client: [BUSINESS NAME] — [one-line description, e.g. "residential landscaping, 2 crews, central Ohio"]

Setup:
1. Read AGENTS.md, then follow docs/START_NEW_CLIENT.md → "Setup steps" to create a SEPARATE
   repository for this client. Never push client information to ultimate-crm-template.
2. Read docs/ONBOARDING.md.

Then run the guided onboarding:
- Do not write feature code yet.
- Ask me questions in small logical groups (3–5 at a time) and wait for my answers.
- Help me think: when my answers reveal repetitive work, gaps, or risky handoffs, suggest
  improvements (automations, better workflow, customer experience, reporting, integrations).
  Your suggestions are ideas until I approve them.
- Record everything in docs/client/ as we go — business facts, workflows, problems, approved
  requirements, ideas, branding preferences, integrations, decisions, open questions. Tell me
  briefly what you recorded after each group.
- Don't ask questions that are already answered in docs/client/.

When onboarding is done, show me: the business summary, workflows, top problems, the
keep/customize/hide/build decision for each module, integrations, special features, branding,
open questions, the complete MASTER_REQUIREMENTS list, and a phased ROADMAP. Wait for my
confirmation before starting major implementation. Commit and push the docs to the client
repo at each milestone.
```

## Copy-paste prompt — fast start (requirements already known)

Use when you'd rather dump everything at once:

```text
You are building a custom CRM for a new client, starting from this repository:
https://github.com/F0rger123/ultimate-crm-template

Client: [BUSINESS NAME] — [one-line description]

Read AGENTS.md, then follow docs/START_NEW_CLIENT.md → "Setup steps" to create a separate
repository for this client (never push client information to ultimate-crm-template). Then read
docs/ONBOARDING.md.

FAST START: below is everything I already know. Do not start coding.
1. Extract every fact, requirement, workflow, integration, branding preference, and problem
   into the right docs/client/ files (requirements as Proposed, with stable IDs).
2. Compare it against the onboarding phases in docs/ONBOARDING.md and list only the gaps.
   Ask me about those gaps in small groups — skip anything already answered below.
3. Point out conflicts or ambiguities instead of guessing. Suggest improvements as ideas.
4. Then show me the full MASTER_REQUIREMENTS list and phased ROADMAP and wait for my approval
   before building.

--- MY REQUIREMENTS ---
[paste everything here: business details, how they work today, what they want, integrations,
branding, screenshots/links, must-haves, nice-to-haves, things they hate]
```

---

## Setup steps (for the agent)

Do these before onboarding questions. Ask the owner for anything you can't determine.

1. **Never work on the starter repo directly.** Create a new repo for the client:
   - Name: `<client-slug>-crm` (confirm with the owner), **private**, under the owner's GitHub account.
   - `git clone https://github.com/F0rger123/ultimate-crm-template.git <client-slug>-crm`
   - `cd <client-slug>-crm`
   - `git remote rename origin starter` (keep it so starter fixes can be pulled later).
   - Create the new repo (e.g. `gh repo create <owner>/<client-slug>-crm --private --source . --remote origin --push`).
   - Confirm `git remote -v`: `origin` = client repo, `starter` = ultimate-crm-template (fetch only, never push).
2. **Initialize client memory.** `docs/client/` starts as blank copies of `docs/templates/`. If it's missing anything, copy from `docs/templates/`. Fill `project-state.json → project` (name, client, industry, repo). Set `onboarding.status` to `"in_progress"`.
3. Update `package.json → name` and the product name in `index.html` / `public/manifest.json` once the owner confirms the app's name (record it in `BRANDING.md`).
4. **Don't connect infrastructure yet** unless the owner asks: a fresh Supabase project and Cloudflare Pages project are created during roadmap phase "Foundation" (see `README.md`). Never reuse another client's Supabase project or credentials.
5. Commit: `chore: initialize <client> project from ultimate-crm-template` and push to the client repo.
6. Start `docs/ONBOARDING.md` Phase 1.

## Pulling later improvements from the starter

```bash
git fetch starter
git merge starter/main      # resolve conflicts; client docs/ always win
```
Note any starter update in `HANDOFF.md`.
