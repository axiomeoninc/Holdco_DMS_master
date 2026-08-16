# DEEPEST QA L03 — Inventory list SIGNOFF

**Stamp:** 2026-08-04 (Pacific)  
**Lane:** 03 — Inventory list (filters, Cost, bulk, export, aging KPI, sort)  
**Plan:** `deepest_qa_20_swarm_d1b2b148.plan.md`  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com  
**CF deploy this lane:** **No** (integrator owns redeploy)

---

## Floors (read-only)

| Table | Floor | Live count | OK |
|-------|------:|-----------:|:--:|
| vehicles | ≥158 | **158** | yes |
| sales_deals | ≥77 | **78** | yes |
| invoices | ≥71 | **72** | yes |

No deletes / wipes / invented Hillz rows.

---

## Method

1. Static review: `inventory/page.tsx`, `GET/PATCH /api/vehicles`, `/api/vehicles/syndication`
2. Authenticated HTTP smoke vs live (Nova Admin `f02_test_adaptus@adaptusgroup.ca`)
3. Fix-on-the-fly in local tree; document CF redeploy need

---

## Probe matrix

| Check | Result | Notes |
|-------|--------|-------|
| `/inventory` HTML | **PASS** | 200, no error boundary |
| List count / Active / Sold | **PASS** | 158 / 81 / 77 |
| Adv filters make / year / price / condition | **PASS** | Toyota 9; year 2018–22 → 42; price 10k–40k → 48; Used 81 |
| Search `q` | **PASS** | `1FT` → 3 |
| Sort Cost asc/desc | **PASS** | order_ok on live |
| Sort Retail desc | **PASS** | |
| Sort Days asc/desc | **PASS** | maps to `created_at` invert |
| Excel-shaped export query | **PASS** | `limit=10000&status=Active` returns n=81 (= count) |
| Export respects filters | **PASS** (code + live) | shares `buildVehicleQuery` (status/q/adv/aging/sort) |
| Aging KPI `minDays=45` | **PASS** (logic) | count **0** — Active units ~4d old (Jul 31 import); drill-down still wires |
| Bulk UI (status / AT.ca / delete) | **PASS** (code) | page-scoped select; MVDA disclosure on PATCH Active |
| Cost column | **PASS** | table + grid; `sortBy=cost` → `purchase_price` |
| Tenant scope | **PASS** | `dealership_id` query param ignored; rows stay Nova |
| Bad `sortBy` (pre-fix) | **FAIL→fixed** | live 500 `column does not exist` |
| AT.ca batch feed (live tip) | **FAIL (deploy gap)** | 422 — rich JSON gallery strings not parsed on **live** tip; local `parseGallery` already correct; hardened further this lane |

---

## Bugs found + fixed (local)

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | `GET /api/vehicles?sortBy=not_a_column` → **500** | Med | Whitelist sort columns; unknown → `created_at` |
| 2 | Empty state treated default **Active** as a filter → no first-use CTA when `total=0` | Med | `isFirstUse` from `kpis.total`; clearer Active-empty copy |
| 3 | Excel export omitted Extra Costs / Est. Income | Low | Added columns (Cost lane completeness) |
| 4 | Table `colSpan={12}` vs 11 columns | Low | `colSpan = 11` |
| 5 | AT.ca batch used RLS token client (risk of incomplete gallery vs list admin path) | Med | `supabaseAdmin` + dealership scope (same as list GET) |
| 6 | AT.ca 422 error too generic | Low | Top error-field counts in message; UI toast appends skipped |
| 7 | `parseGallery` rejected JSON-stringified array payloads | Low | Accept stringified array before entry parse |

---

## Residual / deferred

| Item | Reason |
|------|--------|
| Live AT.ca feed still 422 until CF redeploy | Local gallery parse + admin client not on live tip; integrator deploy |
| Aging KPI = 0 | Data age &lt; 45d; filter math verified with `minDays=1` → 81 |
| AT.ca CompanyID / CategoryID warnings | Honest settings placeholders — not invented |
| Bulk ops = N parallel PATCH/DELETE | Known M2 residual; page-sized OK |
| Kijiji / Meta auto-post | Non-goal |

---

## Files touched

- `src/app/api/vehicles/route.ts`
- `src/app/api/vehicles/syndication/route.ts`
- `src/lib/vehicle-image.ts`
- `src/app/(dashboard)/inventory/page.tsx`

---

## Verdict

**PASS (local)** — Inventory list filters, Cost, bulk bar, Excel export, aging drill, and sorts verified; floors intact.  
**Live tip:** AT.ca batch + sort whitelist need **integrator CF redeploy** to match local. No CF deploy from this lane.
