# Integrations

> Every external service the client wants or uses. **Never put secrets here** — only which credentials are needed, who owns them, and where they're stored (e.g. "Cloudflare secret `STRIPE_SECRET_KEY`", "Settings → Integrations → Twilio").
>
> **Statuses:** Idea · Requested · Planned · Configured (credentials entered) · Implemented (code works locally) · Connected (talking to the real service) · Tested (end-to-end test passed) · Production Verified · Not needed · Rejected
> The starter already supports: Gmail, Google Calendar, Google Maps/Places, Twilio SMS, Stripe, Square, Web Push, AI providers (Claude/OpenAI/Gemini/OpenRouter/…), Facebook/Instagram publishing. See `README.md`.

## Summary

| ID | Integration | Provider | Purpose | Status | Last tested | Related |
|---|---|---|---|---|---|---|

## Details

<!--
### INT-000 — Payments
- **Provider:** Stripe (decision: DEC-___)
- **Purpose:** Deposits and invoice payments from the client portal
- **Status:** Requested
- **Credentials needed:** Stripe account (owner has an existing merchant account). Stored: Settings → Integrations → Stripe; platform Connect vars as Cloudflare secrets.
- **Owner of the account:** Business owner
- **Webhooks:** https://<app>/api/stripe-webhook — events: … — configured: No
- **Sandbox/test setup:** test keys, test card 4242…
- **Known limitations:** …
- **Test log:**
  - _date_ — _what was tested, result, evidence level_
-->
