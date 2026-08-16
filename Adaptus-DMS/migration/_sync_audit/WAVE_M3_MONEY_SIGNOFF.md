# Wave M3 Signoff — Money & compliance

**Stamp:** 2026-08-04  
**Wave:** M3 — Invoice AR / commissions / CASL / notifications / billing honesty  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Deploy:** **Skipped** (per campaign — M0 owns CF deploy)  
**Stack:** Next.js + Supabase + Cloudflare Workers (unchanged)

---

## Floors

| Table | Floor | This wave |
|-------|------:|-----------|
| invoices | ≥71 | Untouched (no deletes / no fabricated rows) |
| vehicles | ≥158 | Untouched |
| sales_deals | ≥77 | Untouched |

No fake Stripe. No invented customers / Hillz rows. No API keys committed.

---

## Delivered

| Item | Status | Notes |
|------|--------|-------|
| Invoice PDF (print) | Shipped | `src/lib/invoice-pdf.ts` + InvoiceDetailsModal PDF action |
| Invoice email | Shipped | `POST /api/invoices/[id]/send` via Resend; 503 if secrets missing (no fake send) |
| Record payment / AR ledger | Shipped | `GET/POST /api/invoices/[id]/payments` → `financial_transactions` + `invoices.amount_paid` / status |
| Salesperson + commissions report | Shipped | `type=salesperson\|commissions` on `/api/reports` (dealership-scoped via M0 `applyDealershipScope`); Reports UI **Commissions** tab |
| CASL unsubscribe write + IP | Shipped | Token-gated `POST /api/unsubscribe` + `UnsubscribeClient`; stamps `marketing_consent=false`, `marketing_unsubscribed_at`, `marketing_consent_ip` |
| Real notifications feed | Shipped | `GET /api/notifications` (overdue invoices, due follow-ups, due tasks); TopHeader bell — unread dot only when count > 0 |
| Platform settings honesty | Shipped | Save no longer fakes success; subscription quick link → `/platform/subscriptions`; Audit Logs marked coming soon; Integrations link live |
| Billing Stripe stubs | Shipped | Add Card / payment method marked unavailable — Stripe not wired |
| Migration SQL | Shipped | `src/app/supabase/migrations/wave_m3_money.sql` (idempotent columns) |
| `tsc --noEmit` | **PASS (M3 files)** | Pre-existing errors in M1 surfaces: `deals/[id]/page.tsx`, `LeadDetailsModal.tsx` — out of M3 scope |

---

## Integration with M0

- Preserved M0 reports `dealership_id` scoping (`requireDealershipAccess` + `applyDealershipScope`).
- Preserved M0 invoice create fields (`tax_rate`, `package_name`, `amount_paid`, optional `line_items`).
- Extended reports with salesperson/commissions without overwriting scoping helpers.

---

## App surfaces

- Invoices drawer → **PDF** / **Email** / record payment form + ledger  
- Reports → **Commissions** tab  
- `/unsubscribe?email=&token=` → preference write  
- Header bell → live feed  
- `/settings/platform`, `/settings/billing` → honest UX  

### APIs

- `POST /api/invoices/[id]/send`  
- `GET/POST /api/invoices/[id]/payments`  
- `GET /api/notifications`  
- `POST /api/unsubscribe` (public, HMAC token)  
- `GET /api/reports?type=salesperson` (or `commissions`)  

### Migration

- `src/app/supabase/migrations/wave_m3_money.sql`  
- Apply via Supabase SQL editor / Management API when ready (not auto-applied this wave).

---

## Secrets (names only)

| Secret | Role |
|--------|------|
| `RESEND_API_KEY` / `EMAIL_FROM` | Invoice email send |
| `UNSUBSCRIBE_SECRET` (optional) | CASL token HMAC; falls back to Resend/service role |

---

## Explicitly not done

- Stripe Checkout / customer portal  
- Full GL / chart of accounts  
- CF Workers deploy (M0)  
- Fixing unrelated M1 `tsc` errors  

---

## Verdict

**Wave M3 money & compliance code complete** for PDF+AR, commissions report, CASL write+IP, real notifications, and honest billing/platform stubs. Deploy + migration apply remain operator follow-ups.
