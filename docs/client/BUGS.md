# Bugs

> Every reported problem and **every fix attempt, including the ones that failed** — the next agent needs to know what was already tried.
> Owner says it's still broken → set `Reopened`, add a dated attempt/history line. Don't open a duplicate.
>
> **Statuses:** Reported · Reproduced · Investigating · Fix Attempted · Partially Fixed · Needs Retest · Resolved · Verified · Cannot Reproduce · Reopened
> **Severity:** Critical (blocks work / data loss / money) · High · Medium · Low
> **Evidence:** CODE WRITTEN · LOCAL TEST PASSED · INTEGRATION TEST PASSED · USER TESTED · PRODUCTION VERIFIED

## Open & recent

| ID | Title | Severity | Status | Evidence | Last update |
|---|---|---|---|---|---|

## Details

<!--
### BUG-000 — Invoice "Send" button does nothing
- **Severity:** High
- **Status:** Fix Attempted
- **Reported:** 2026-02-03 by owner — "I click send on the invoice and nothing happens."
- **Expected:** Invoice emailed to the customer, toast confirms.
- **Actual:** No toast, no email.
- **Reproduction:** 1. Invoices → open any invoice 2. Click Send …
- **Environment:** Production, iPhone Safari / local dev, Chrome
- **Relevant files:** src/components/pages/InvoicesPage.tsx, src/lib/messaging.ts
- **Suspected cause:** …
- **Related:** REQ-___

**Fix attempts** (newest last — never delete)
| # | Date | Agent | Change (commit) | Result |
|---|---|---|---|---|
| 1 | 2026-02-03 | Codex | Added timeout to Gmail send (abc1234) | ❌ Still nothing — owner retested |
| 2 | 2026-02-04 | Claude Code | Fixed missing await on token refresh (def5678) | ✅ Local test passed; awaiting owner |

**Verification**
- Evidence: LOCAL TEST PASSED
- Notes: …

**History**
- 2026-02-03 — Reported.
- 2026-02-05 — Reopened: owner says still failing on mobile.
-->
