# DEEPEST QA L12 — Expenses / Vendors SIGNOFF

**Lane:** 12 — Expenses / vendors (CRUD, expense date filters vs reports)  
**Plan:** `deepest_qa_20_swarm`  
**Stamp:** 2026-08-04 (Pacific)  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com · worker `flashfender-dms` · `BUILD_ID`=`abL7f5uKnFhhGb8AErTxD`  
**Dealership (Nova):** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Deploy:** **Skipped** (lane instruction — no CF deploy; integrator owns redeploy)

---

## Verdict

**PASS (local fixes; live tip unchanged)** — Expenses/vendors CRUD paths, date filters, and report parity reviewed and remediated in the local tree. Live unauth APIs return **401**. Nova floors intact. Empty expenses table is data emptiness, not a route failure.

---

## Floors (service-role, Nova)

| Table | Floor | Observed | OK |
|-------|------:|---------:|:--:|
| vehicles | ≥158 | 158 | yes |
| sales_deals | ≥77 | 78 | yes |
| invoices | ≥71 | 72 | yes |
| expenses | n/a | **0** | empty |
| vendors | n/a | **1** (`vendor_name`=`---`, type=`AUCTION`) | ok |

No deletes, truncates, or invented Hillz rows.

---

## Scope exercised

| Surface | Result | Notes |
|---------|--------|-------|
| `GET/POST /api/expenses` | **PASS** (code) | Auth, dealership scope, `expense_date_from`/`to`, category/status/q, KPI totals |
| `GET/PATCH/DELETE /api/expenses/[id]` | **PASS** (code) | Ownership via `assertOwnershipOrDeny`; whitelist fields |
| `/expenses` UI | **PASS** (code) | Date filter panel → API params; CRUD modals; permissions |
| `GET/POST /api/vendors` | **PASS** (code) | Auth, scope; **vendor_type** filter wired; created_at day bounds |
| `GET/PATCH/DELETE /api/vendors/[id]` | **PASS** (code) | Ownership; partial PATCH no longer forces name/type |
| `/vendors` UI | **PASS** (code) | Type + created-at filters; KPI totals from filtered set |
| `GET /api/reports?type=expenses` | **PASS** (code) | `expense_date` range + dealership scope; tax-inclusive totals |
| Live unauth `GET /api/expenses\|vendors` | **PASS** | **401** |
| Live pages (auth browser) | **Deferred** | No QA session cookies in lane env; HTTP smoke + static/API review |

---

## Bugs found + fixed (local)

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | **High** | Expenses list/details showed `vendor.name` but API returns `vendor_name` → vendor always blank | Use `vendor_name` in `expenses/page.tsx` + `ExpenseDetailsModal.tsx` |
| 2 | **High** | Vendors UI sent `vendor_type` but GET API ignored it → type filter dead | Apply `ilike("vendor_type", …)` (Hillz casing e.g. `AUCTION`) |
| 3 | **Medium** | Vendor `created_at_to` as bare `YYYY-MM-DD` excluded most of that day (timestamptz) | Inclusive `T00:00:00.000Z` / `T23:59:59.999Z` bounds |
| 4 | **Medium** | Vendor KPIs (Dealers/Finance/With Phone) counted **current page only** | API `totals` over filtered set; page consumes them |
| 5 | **Medium** | Expenses export ignored active filters (exported all) | Export URL passes category/status/q/date filters |
| 6 | **Medium** | Reports expenses/financial paid expenses omitted `tax_amount` while list KPIs include tax | Include tax in report aggregates for parity |
| 7 | **Medium** | Platform admin with null `dealership_id` could POST expense/vendor with null tenant | Require dealership context on create (**400**) |
| 8 | **Medium** | Expense POST accepted foreign `vendor_id` / `vehicle_id` | Validate same-dealership before insert |
| 9 | **Low** | Vendor PATCH required `vendor_name` and always forced `vendor_type` | Validate only when provided; no forced type on partial update |
| 10 | **Low** | Empty-state “Record First Expense” ignored write permission | Gate behind `canWrite("expenses")` |
| 11 | **Low** | Bogus `"date"` in expense PATCH allowlist | Removed |

---

## Date filters vs reports

- **Expenses list:** `expense_date_from` / `expense_date_to` → `.gte/.lte("expense_date", …)` on list + KPI totals + export.
- **Reports `type=expenses`:** `start_date` / `end_date` → `dateOnly` then same `expense_date` range + `applyDealershipScope`.
- **Financial report paid expenses:** same date column + tax-inclusive line totals (aligned with list).
- **Vendors:** `created_at_from` / `created_at_to` (created stamp, not expense date) — intentional; documented.

---

## Deferred / known

| Item | Reason |
|------|--------|
| CF redeploy | Explicit lane non-goal; live tip still `abL7f5uKnFhhGb8AErTxD` until integrator deploys |
| Authenticated browser CRUD | No QA password in lane env; destructive create/delete avoided on Nova |
| Expenses table empty (0) | Empty data, not a failure; CRUD paths code-reviewed |
| Vendor display name `---` | Source/import data, not UI bug |
| Vendor type casing in DB (`AUCTION`) | Filter/KPI now case-insensitive; no mass rewrite of Hillz rows |

---

## Files touched

- `src/app/(dashboard)/expenses/page.tsx`
- `src/app/(dashboard)/vendors/page.tsx`
- `src/components/ExpenseDetailsModal.tsx`
- `src/app/api/expenses/route.ts`
- `src/app/api/expenses/[id]/route.ts`
- `src/app/api/vendors/route.ts`
- `src/app/api/vendors/[id]/route.ts`
- `src/app/api/reports/route.ts`

---

## Redeploy needed?

**Yes (integrator)** — local fixes are not on live tip. Lane did **not** run `npm run deploy:cf`.

---

## Secrets / safety

- No passwords or service-role keys in this file.
- Floors re-checked via service-role HEAD/GET counts only.
- No Nova inventory/deal/invoice mutations.
