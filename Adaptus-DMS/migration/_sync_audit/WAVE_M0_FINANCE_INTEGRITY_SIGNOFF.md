# Wave M0 — Finance Integrity Signoff

**Stamp:** 2026-08-04  
**Scope:** Master Guide micro-gap Wave M0 finance P0 (reports scoping, expense dates, invoice tax/package persistence).  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Plan:** `master_guide_micro_gaps_ef669d4b.plan.md`  
**Floors:** Do not invent Hillz / production rows (vehicles ≥158 · sales_deals ≥77 · invoices ≥71).

---

## Delivered

| Item | Status | Notes |
|------|--------|-------|
| Reports `dealership_id` scoping | **Fixed** | `requireDealershipAccess` + `pickSupabaseClient`; every report query scoped via `.eq("dealership_id", …)` when profile has a dealership |
| Expenses report date filters | **Fixed** | `expense_date` `gte`/`lte` applied (was computing dates but querying all rows) |
| Invoice POST `tax_rate` / `package_name` | **Fixed** | Persist on create; `line_items` when provided; `amount_paid: 0` |
| Schema columns | **Documented** | Idempotent `ALTER TABLE … IF NOT EXISTS` for `tax_rate`, `package_name`, `line_items`, `amount_paid`, deal `commission_*` |
| Phase 2 CF deploy | **Skipped** | Out of scope for this QA pass (deploy non-trivial) |
| Operator secrets (Resend/Meta) | **Unchanged** | See `SECRETS_OPS_STATUS.md` — not invented here |

---

## Bugs found / fixed

1. **Reports API had no explicit dealership scope** — relied only on RLS; platform-admin client path could leak. Fixed with auth + `.eq("dealership_id")`.
2. **Expenses report ignored `start_date` / `end_date`** — period echoed in JSON but query returned all expenses. Fixed.
3. **Invoice create dropped `tax_rate` / `package_name`** — UI sent them; insert omitted (sibling also patched; verified present + hardened with dealership gate + `amount_paid`).
4. **Invoice PATCH recalc defaulted tax to 13%** when only `payment_amount` changed — now uses existing `tax_rate` from DB.

---

## Verification

- Static review of `api/reports/route.ts`, `api/invoices/route.ts`, `api/invoices/[id]/route.ts`
- `npx tsc --noEmit` — no errors in finance files touched (one unrelated TS error in `deals/[id]/page.tsx` outside scope)
- Live curl against local server: **not run** (no local server / secrets)

---

## Remaining risks

- Live Supabase may still need the `ALTER TABLE` columns applied if not already present (`amount_paid` especially for AR).
- RLS already scopes dealers; explicit filters are defense-in-depth. Platform admin **without** `dealership_id` remains unscoped by design when using admin client.
- CF production deploy of this wave still pending.

---

## Files touched (M0)

- `src/app/api/reports/route.ts`
- `src/app/api/invoices/route.ts`
- `src/app/api/invoices/[id]/route.ts`
- `src/app/supabase/schema.sql`
- `migration/_sync_audit/WAVE_M0_FINANCE_INTEGRITY_SIGNOFF.md` (this file)

**Verdict:** Wave M0 finance integrity P0 **shipped locally**. Ready for QA / CF deploy when operator schedules it.
