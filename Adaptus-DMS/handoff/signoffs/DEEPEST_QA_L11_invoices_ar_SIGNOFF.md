# DEEPEST QA — Lane 11 Signoff — Invoices / AR

**Stamp:** 2026-08-04 (Pacific)  
**Lane:** 11 — Invoices / AR (tax/package create, PDF, send 503, payments)  
**Plan:** `deepest_qa_20_swarm_d1b2b148.plan.md`  
**App:** Adaptus-DMS (`Adaptus-DMS/Adaptus-DMS`)  
**Live:** https://app.flashfender.com · worker `flashfender-dms`  
**Dealership (Nova):** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**CF deploy this lane:** **No** (per brief — local fixes for integrator)  
**Auth:** QA Admin `f02_test_adaptus@adaptusgroup.ca` (password not recorded)

---

## Verdict

**PASS with local fixes pending deploy** — List/detail/PDF/tax-package create and honest Resend **503** verified live. **AR payment POST is broken on live tip** (500) due to a bad PostgREST embed; **fixed in local tree**. Floors held at **invoices ≥ 71** (live count **72** after disposable create/delete).

---

## Scope exercised

| Area | Method | Result |
|------|--------|--------|
| `/invoices` page | Auth GET | **200**, no error boundary |
| `GET /api/invoices` | Auth | **200**, count **72**, KPI totals present |
| `GET /api/invoices/[id]` | Auth | **200**, customer join, tax fields |
| Tax + package create | `POST` disposable | **201**; subtotal 1000 / 13% → tax 130 / total 1130; `package_name` persisted; Nova `dealership_id` |
| PDF print helper | Static | `src/lib/invoice-pdf.ts` browser print HTML (CF-safe); UI **PDF** button wires `openInvoicePrintWindow` |
| Email send | `POST …/send` | Live **503** + clear Resend message (no fake success). Unauth **401** |
| Integrations Resend | `GET /api/settings/integrations` | `configured: false`, missing `RESEND_API_KEY` + `EMAIL_FROM` |
| AR ledger GET | `GET …/payments` | **200** |
| AR payment POST | Live | **500** (bug) → **fixed locally** (see below) |
| Disposable cleanup | DELETE invoice + service-role orphan txn scrub | Invoices floor back to **72**; 3 QA orphan ledger rows removed |

---

## Bugs found + fixed (local; need CF for live)

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | **P0** | `POST /api/invoices/[id]/payments` inserts `financial_transactions` then fails updating invoice: select embed requested `customers.avatar` which **does not exist** on live → 500 + orphan ledger rows (`amount_paid` stuck at 0) | Drop `avatar` from returning select; compensating delete of txn if invoice update fails; clearer PostgREST error message |
| 2 | Medium | Create invoice did not verify customer belongs to dealership; platform admin could insert null `dealership_id` | Customer scoped lookup; `dealership_id` from user or customer |
| 3 | Medium | Invoice write/delete/payment routes lacked `canCreate` / `canEdit` / `canDelete` gates | Aligned with `permission-middleware` |
| 4 | Low | Manager blocked in UI from record-payment/edit (Admin-only check) | Treat Manager (+ `*`) like middleware |
| 5 | Low | Email send 503 double-toast + no `missingConfig` on early return | `missingConfig: true`; `silent5xx` + titled toast |
| 6 | Low | Excel export missing AR columns; form label said “Payment Amount” for subtotal | Export Amount Paid / Balance Due; label **Subtotal** |

**Files touched**

- `src/app/api/invoices/route.ts`
- `src/app/api/invoices/[id]/route.ts`
- `src/app/api/invoices/[id]/payments/route.ts`
- `src/app/api/invoices/[id]/send/route.ts`
- `src/components/InvoiceDetailsModal.tsx`
- `src/components/InvoiceFormModal.tsx`
- `src/app/(dashboard)/invoices/page.tsx`

`npx tsc --noEmit` — clean for these paths.

---

## Honest Resend / 503

- Live worker secrets: Resend **not** configured (integrations API + send probe).
- `POST /api/invoices/[id]/send` returns **503** with operator message to set `RESEND_API_KEY` / `EMAIL_FROM` — **no invented success**.
- Local early-return now also sets `missingConfig: true` (parity with other Resend routes); live tip may still omit that flag until deploy.

---

## Floors

| Table | Floor | Observed | OK |
|-------|------:|---------:|:--:|
| invoices (Nova) | ≥71 | **72** | yes |

No Hillz/Nova production rows invented beyond disposable `QA-L11-*` invoices (created and deleted). Orphan QA payment txns scrubbed via service role.

---

## Deferred / known data notes

| Item | Note |
|------|------|
| Historical tax_rate vs tax_amount | Many Nova Hillz invoices have `tax_rate=13` but tax/total not equal to 13% of subtotal; **create path math is correct**. Editing those rows will recalculate tax from rate. |
| Payment POST on live | Broken until integrator CF deploy of avatar/select fix |
| Full GL browser UI | Out of lane |
| CF deploy | Explicitly skipped this lane |

---

## Integrator handoff

1. Include Lane 11 local diffs in next `flashfender-dms` deploy.  
2. Re-smoke: create → pay (expect **201**, `amount_paid` updates) → send (**503** until Resend secrets) → delete.  
3. Confirm no new orphan `financial_transactions` for invoices.  
4. Do **not** invent Resend keys in-agent.

**Lane signoff:** ready for merge into `DEEPEST_QA_20_SWARM_SIGNOFF.md`.
