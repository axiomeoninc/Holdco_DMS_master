# DEEPEST QA L13 — Reports Signoff

**Stamp:** 2026-08-04T06:55:00-07:00  
**Lane:** 13 — Reports (all types + dealership scoping + commissions)  
**Plan:** `deepest_qa_20_swarm_d1b2b148.plan.md`  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com · worker `flashfender-dms`  
**Nova:** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**CF deploy this lane:** **NO** (per swarm instruction — integrator owns redeploy)  
**Artifact:** `migration/_sync_audit/l13_reports_probe.json`

---

## Verdict

**CODE PASS / LIVE PARTIAL (pre-fix tip)**

All report types respond on live with Nova dealership floors intact. Code fixes for Salesperson commission/role isolation and null `deal_date` inclusion are in the local tree; **not on live tip until integrator CF deploy**.

---

## Floors (live smoke)

| Table | Floor | Observed | OK |
|-------|------:|---------:|:--:|
| vehicles (inventory report) | ≥158 | 158 | yes |
| sales_deals (API count) | ≥77 | 78 (77 Closed + 1 Negotiation) | yes |
| invoices | ≥71 | not mutated | yes |

No deletes / no invented Hillz data.

---

## Report types matrix (live Admin, Nova)

| `type` | Status | Shape | Notes |
|--------|:------:|-------|-------|
| `summary` | 200 | sales / inventory / leads / profit / expenses | Inventory 158/81/77 |
| `sales` | 200 | summary + salesByDate + topSalespeople | Wide range 2020–2026 → **69** deals / $2.20M (8 null `deal_date` excluded **on live**) |
| `inventory` | 200 | agingBuckets + byStatus + byMake | Floor 158; aging all in 0–30 |
| `financial` | 200 | revenue / expenses / outstanding | Summary tab uses this (not `summary`) |
| `leads` | 200 | bySource / byStatus | 140 total |
| `expenses` | 200 | byCategory / byStatus | Count 0 (empty table); date filter to 2099 → 0 |
| `salesperson` | 200 | bySalesperson + commission note | Alias of commissions |
| `commissions` | 200 | same as salesperson | UI tab label **Commissions** |

Unauth `GET /api/reports` → **401**.  
`/reports` page → **200** (Commissions tab present).

---

## Tenant isolation (critical)

| Probe | Result |
|-------|--------|
| Admin inventory scoped to Nova | **PASS** — 158 vehicles |
| Salesperson inventory | **PASS** — 158 (Nova), not cross-tenant inflation |
| `?dealership_id=` foreign UUID | **PASS** — ignored; still Nova 158 (no widen/switch) |
| Salesperson commissions (live tip) | **FAIL (pre-fix)** — saw **full dealership** 69 deals / ~$383k estimated commission |
| Salesperson commissions (local code) | **FIXED** — `shouldScopeToAssigned` → `.eq("salesperson_id", user.id)` on sales / commissions / financial sales; leads → `assigned_to`; expenses/AR hidden for assigned roles |

Dealership `.eq("dealership_id", …)` present on all report queries when profile has a dealership (defense-in-depth + RLS).

---

## Bugs found + fixed (local; CF not deployed)

| Bug | Severity | Fix |
|-----|----------|-----|
| Salesperson/Staff commissions & sales reports leaked **all** dealership deals (unlike `/api/deals` assigned scope) | **P0** isolation | `applySalespersonScope` + assigned lead filters; expenses/AR omitted for assigned roles |
| Dated sales/financial/commissions used only `deal_date`, dropping **8** Closed rows with `deal_date=null` | **P1** accuracy | `applyDealDateRange` OR: `deal_date` in window **or** (`deal_date` null and `created_at` in window) |
| Expenses tab for Salesperson would show management totals after data exists | **P2** | Restricted empty payload + UI note when `data.restricted` |

**Files:**
- `src/app/api/reports/route.ts`
- `src/app/(dashboard)/reports/page.tsx` (restricted expenses note)

---

## Deferred / known

| Item | Reason |
|------|--------|
| Live tip still shows SP full commissions | No CF deploy this lane |
| `potentialProfit` = 0 on inventory | purchase≈retail on Active stock (data) |
| 77 Closed vs 69 dated deals on **live** tip | null `deal_date` until redeploy includes OR filter |
| Most deals `salesperson_id` null | Hillz import; commissions land in **Unassigned** for Admin — expected |
| Default UI “This Month” zeros when no recent `deal_date` | Date filter honesty, not a crash |

---

## Smoke commands (re-run post-deploy)

```powershell
python Adaptus-DMS/Adaptus-DMS/migration/_sync_audit/l13_reports_probe.py
# Then confirm SP wide-range commissions deals == 0 (QA SP has no assigned Closed deals)
```

---

## Integrator notes

1. Redeploy CF when merging lanes so L13 isolation + null `deal_date` OR land on `flashfender-dms`.
2. Re-probe Salesperson `type=commissions&start_date=2020-01-01&end_date=2026-12-31` → must **not** return Unassigned dealership totals.
3. Admin wide-range sales deal count should rise from 69 toward Closed-with-null-date inclusion (~77 less Negotiation).
