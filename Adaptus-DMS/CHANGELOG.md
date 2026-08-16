# FlashFender DMS changelog

Every shipped feature lands here with its docs update. No silent changes.

## 2026-08-08 — Tier 1 + Tier 2 shipped

Tier 1 (market table stakes) and Tier 2 (AI differentiators) from the feature-gap roadmap shipped against the live app. Config-gated surfaces are amber until secrets are set — nothing claims “Sent” or “live” that hasn’t actually gone out.

### Tier 1 — table stakes

- **SMS / texting** — Twilio-backed sender with CASL/TCPA consent at capture, quiet hours, and real-time opt-out (STOP). Sends only when `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` are configured; otherwise the UI stays amber “not configured” and nothing is sent.
- **Accounting export** — QuickBooks (IIF), Xero (journal CSV), and Sage 50 (CSV) journal export from `/settings/accounting` and `/api/accounting/export`.
- **E-signatures** — in-app signing for BOS, quotes, and we-owes under `/signatures/[documentType]/[documentId]`.
- **Built-in payments** — Stripe deposits + invoice payment with payment status on deals/invoices. Amber “Payments not configured” until `STRIPE_SECRET_KEY` / publishable key / `STRIPE_WEBHOOK_SECRET` are set.
- **PWA / mobile** — installable web app (`public/manifest.webmanifest`) with a mobile-first pass over the core screens.
- **Open API + webhooks + full export** — public API (`/api/external/v1/*`), webhook events (`/api/webhooks/*`), and one-click full dealership data export. Webhook delivery is gated on `WEBHOOK_SECRET`.
- **Audit trail + retention + compliance pack** — immutable dealership-scoped audit log (`/settings/audit`), 10-year retention export (`/settings/retention`), and the we-owe / buyer’s-guide / known-damage compliance document pack.
- **AI-shopper listings** — schema.org `Vehicle` JSON-LD on the public inventory embed and `/embed/vehicles/[id]` so AI shoppers can read your stock.

### Tier 2 — AI differentiators

- **Explainable lead scoring** — “why this lead” summaries on the existing score (`/api/ai/lead-explanation`).
- **After-hours 24/7 AI first response** — bot-disclosed first reply with human escalation and draft-first guardrails (`/api/leads/[id]/after-hours`).
- **AI governance console** — claims guardrails, consent tracking, quiet-hours enforcement, and correction log (`/settings/ai-governance`, `/api/ai/corrections`).
- **Credit app capture / prefill** — capture and prefill credit applications with partner-led screening — explicitly not a lender network (`/finance/credit/*`, `/api/crm/credit-applications*`).
- **Trade-in / equity triggers** — equity signals on aging inventory and CRM records (`/api/equity/triggers`).

Migrations for the above were applied (`src/app/supabase/migrations/`).

### Honesty

- Twilio, Stripe, and webhook surfaces are **not live** until the operator sets the required env vars — the app shows the amber “not configured” state and never fabricates a send, charge, or delivery.
- Tier 3 (dealer website/showroom, multi-location, service module, auction sourcing, review automation) remains in progress and will be listed here when it ships.
