# Decisions

> Major product and architecture decisions, so later agents don't reverse them by accident.
> To change a decision: add a new `DEC-###` that supersedes the old one (mark the old one `Superseded by DEC-###`). Only with the owner's agreement.

| ID | Decision | Date | Status |
|---|---|---|---|

<!-- Status: Active · Superseded by DEC-### · Revisit (date/condition) -->

<!--
### DEC-000 — Use Stripe instead of Square
- **Date:** 2026-01-15
- **Decided by:** Owner (agent recorded)
- **Status:** Active
- **Decision:** Customers pay through Stripe. Square stays disabled.
- **Reason:** Existing Stripe merchant account; needs recurring billing.
- **Alternatives considered:** Square (owner has no account), Manual only (too slow to collect).
- **Consequences:** Stripe credentials required before launch (INT-___). Square UI hidden (REQ-___).
-->
