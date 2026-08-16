# DEEPEST QA L08 — Deals desk

**Stamp:** 2026-08-04  
**Lane:** 08 — Deals desk (kanban drag, `/deals/[id]`, `/deals/new` steps 2–5)  
**Plan:** `deepest_qa_20_swarm_d1b2b148.plan.md`  
**App:** Adaptus-DMS / FlashFender DMS  
**Live:** https://app.flashfender.com · worker `flashfender-dms`  
**Deploy this lane:** **Skipped** (integrator owns CF redeploy)  
**Local tip:** code fixed in tree; live tip unchanged until integrator deploy

**Mirror:** `Adaptus-DMS/Adaptus-DMS/migration/_sync_audit/DEEPEST_QA_L08_deals_SIGNOFF.md`

---

## Verdict

**PASS (fixed locally)** — Desk surfaces exist and work after P0/P1 fixes. Nova floors untouched. No CF deploy from this lane.

---

## Floors (read-only assert)

| Table | Floor | Live (service-role HEAD) | OK |
|-------|------:|-------------------------:|:--:|
| vehicles | ≥158 | 158 | yes |
| sales_deals | ≥77 | 78 | yes |
| invoices | ≥71 | 72 | yes |

No invent / no destroy.

---

## Scope exercised

| Surface | Static | Runtime | Result |
|---------|--------|---------|--------|
| `/deals` table + kanban | Yes | Unauth **307** → login | PASS |
| Kanban HTML5 drag → `PATCH deal_status` | Yes | Status map verified vs DB | PASS (fixed) |
| `/deals/[id]` | Yes | Sample deal id present in Nova | PASS (fixed) |
| `/deals/new` steps 1–5 | Yes | Unauth **307**; wizard fields reviewed | PASS (fixed) |
| `GET/PATCH/POST /api/deals` | Yes | Service-role status distribution | PASS |
| `PUT /api/deals/[id]` cash customer | Yes | — | PASS (fixed) |

**Auth note:** Interactive cookie login not available in this lane (credentials not stored in repo). Static + service-role DB + unauth redirects used. Integrator should re-smoke authenticated drag + create after deploy.

---

## P0 finding (fixed)

**Kanban hid 77/78 Nova deals.** Live distribution: `Closed` ×77, `Negotiation` ×1. Kanban columns only matched exact pipeline labels, so nearly the entire desk appeared empty.

**Fix:** `kanbanColumnForStatus()` maps `Closed`→Paid Off, `Open`/`Pending`→Negotiation, `Lost`→Cancelled; cards show legacy label when aliased.

---

## Bugs found + fixed

| Bug | Sev | Fix |
|-----|-----|-----|
| Closed / Open / Pending / Lost invisible on kanban | **P0** | Status→column mapping in `DealsKanban.tsx` + KPI grouping on list |
| Kanban fetched only page size 20 | **P1** | `viewMode === "kanban"` → `limit=500&offset=0` |
| Drop then card click navigated away | **P1** | Suppress click after `dragend` |
| Mojibake (`â€”`, `Â·`, `â€¦`) on deals list | **P2** | UTF-8 em dash / middot / ellipsis |
| Detail page had no status chips | **P1** | Clickable status chips → PATCH |
| `PUT` required `customer_id` (cash breaks) | **P1** | Required only `vehicle_id` + `sale_price` |
| Edit modal: no Closed / cash / trade-in; Sold vehicle missing from dropdown | **P1** | `DealFormModal` deepened |
| Lead convert from wizard dropped `converted_deal_id` | **P2** | Wizard PATCH + allowlist on leads API |
| List `canWrite` ignored platform admin / `*` | **P2** | Align with `/api/me` effective perms |
| Attempted `customers.avatar` on deal GET | — | Reverted (column does not exist) |

---

## Files touched

- `src/components/DealsKanban.tsx`
- `src/app/(dashboard)/deals/page.tsx`
- `src/app/(dashboard)/deals/[id]/page.tsx`
- `src/app/(dashboard)/deals/new/page.tsx`
- `src/app/api/deals/[id]/route.ts`
- `src/components/DealFormModal.tsx`
- `src/app/api/leads/[id]/route.ts` (`converted_deal_id` allowlist only)

---

## Deferred / honest gaps

| Item | Reason |
|------|--------|
| CF redeploy | Lane instruction: no CF deploy; integrator |
| Authenticated browser drag E2E | No QA password in tree; needs integrator smoke |
| Mobile kanban DnD | Mobile remains tap-to-open list (by design) |
| Normalizing all Closed → Paid Off in DB | Data migrate out of lane; UI maps Closed into Paid Off column |

---

## Checks

- `npx tsc --noEmit` — **PASS** (exit 0)
- Unauth live: `/deals`, `/deals/new` → **307**; `/login` → **200**
- Floors: 158 / 78 / 72

---

## Integrator notes

1. Redeploy CF to ship kanban Closed mapping (otherwise live desk still looks empty).
2. Post-deploy: login → `/deals` kanban → confirm ~77 cards under Paid Off; drag Negotiation card; open `/deals/[id]`; smoke `/deals/new` through step 5 without inventing Hillz rows (or create+delete a disposable cash deal).
3. Do not lower floors.
