# Deepest QA — Lane 02 Dashboard Signoff

**Stamp:** 2026-08-04T06:50:00-07:00  
**Lane:** 02 — Dashboard (stats, deep links, widgets, empty/error states)  
**App:** https://app.flashfender.com · worker `flashfender-dms`  
**Supabase:** `zwfeitodxikdwymkieai` · Nova: `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Local tip:** `e1909a893ce8a096419f9535a932b0d07a058020`  
**CF redeploy this lane:** **No** (per lane brief — integrator owns deploy)

---

## Floors (no destroy)

| Table | Floor | Live (`GET /api/dashboard`, Nova Admin) |
|-------|------:|----------------------------------------:|
| vehicles | ≥158 | **158** |
| sales_deals | ≥77 | **78** |
| invoices | ≥71 | **72** |

Active inventory (status=`Active`): **81** — matches `/api/vehicles?status=Active` count.  
Pending invoices: **1**. Nova-scoped revenue sum: **$2,349,181.37** (78 deals; no non-Nova deals in DB today).

---

## Verdict: **PASS** (fixes pending deploy)

Lane audit + live smoke completed. P0 tenant-isolation fix is in local tree; live tip still runs pre-fix revenue query until integrator redeploys.

---

## Findings & fixes

| Sev | Issue | Fix |
|-----|-------|-----|
| **P0** | `GET /api/dashboard` summed `sale_price` via `supabaseAdmin` with **no** `dealership_id` filter (latent cross-tenant revenue leak; currently only Nova has deals) | Scope revenue query with `.eq("dealership_id", dealershipId)`; require dealership context unless platform admin |
| **P1** | `activeVehicles` used `.neq("status","Sold")` while StatCard/Today deep-link to `/inventory?status=Active` | Count `.eq("status","Active")` so KPI ↔ deep link match |
| **P1** | Recent sales / leads / follow-ups / top vehicles rows not clickable | Row `Link`s → `/deals/[id]`, `/leads`, `/follow-ups`, `/inventory/[vin]` |
| **P1** | Pending invoice KPI linked to `/invoices` (no status); invoices page ignored `?status=` | KPI/Today → `/invoices?status=Pending`; invoices page reads `status` query after mount |
| **P2** | Salesperson/Staff “My leads” StatCard hardcoded `0` | Fetch `/api/leads?limit=1` (API auto-scopes) and use `count` |

### Files touched (local only)

- `src/app/api/dashboard/route.ts`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/(dashboard)/invoices/page.tsx` (minimal URL status honor for deep link)

---

## Smoke matrix (live, pre-redeploy)

**Auth:** Nova Admin + Salesperson (credentials from prior operator chat — not stored here).

| # | Check | Result |
|---|-------|--------|
| 1 | `POST /api/auth/login` Admin | **PASS** |
| 2 | `GET /api/dashboard` floors + stats | **PASS** — 158 / 78 / 72; active 81; pending 1; revenue present |
| 3 | Active inventory API count vs dashboard | **PASS** — both 81 |
| 4 | Pending invoices API `?status=Pending` | **PASS** — count 1 |
| 5 | Recent sale deep link `GET /api/deals/{id}` | **PASS** — 200 |
| 6 | Unauth deep-link routes (`/dashboard`, `/inventory?status=Active`, …) | **PASS** — 307 → login (routes exist) |
| 7 | Salesperson `/api/me` + tasks/leads | **PASS** — role Salesperson; 0 tasks / 0 assigned leads (honest empty) |
| 8 | Loading / error / empty widgets (static) | **PASS** — skeletons, `EmptyState` error+retry, chart empty states present |
| 9 | Quick actions targets | **PASS** — `/inventory/new`, `/leads`, `/deals/new`, `/calendar`, `/reports` |

---

## Residual / out of lane

- Live tip **not** updated (no CF deploy this lane). Integrator must redeploy for P0 revenue scoping to go live.
- API returns `kpis` (completion rate, revenue growth, etc.) but Manager UI does not render them.
- Platform-admin `/dashboard` still shows “Platform analytics coming up” empty CTA (analytics live at `/platform/analytics`).
- Lead rows deep-link to `/leads` list (no `/leads/[id]` route).
- Other dealerships exist (B-QA*) with **0** vehicles/deals — P0 would matter once they have sales data.

---

## Success criteria checklist

- [x] Stats scoped / floors intact  
- [x] Deep links audited + fixed where broken  
- [x] Widgets empty/error states present  
- [x] Fix-on-fly in local tree  
- [x] Floors safe (read-only smoke)  
- [x] No CF deploy  
- [x] Signoff written  

**Lane 02: PASS — ready for integrator merge/redeploy.**
