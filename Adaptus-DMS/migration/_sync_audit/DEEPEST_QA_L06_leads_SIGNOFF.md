# DEEPEST QA L06 — Leads (kanban / score / convert / log-call / email panel)

**Stamp:** 2026-08-04 (Pacific)  
**Lane:** 06 — Leads  
**Plan:** `deepest_qa_20_swarm`  
**App:** Adaptus-DMS → live https://app.flashfender.com (`flashfender-dms`)  
**Dealership (Nova):** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Method:** Static review of leads routes/UI + authenticated HTTP smoke (Admin QA). No CF deploy. No fake Resend sends.  
**Probe artifact:** `migration/_sync_audit/deepest_qa_l06_probe.json` (password not recorded)

---

## Verdict

**PASS (local fixes; CF redeploy needed for API filter enrichment)** — Kanban PATCH, convert honesty, log-call auth, and email-panel Resend 503 all behave correctly. Fixed Manager UI permission gap, score/filter consistency, and temperature filter for null legacy scores in local tree.

---

## Floors (post-smoke)

| Table | Floor | Live count | OK |
|---|---:|---:|:---:|
| vehicles | ≥158 | 158 | yes |
| sales_deals | ≥77 | 78 | yes |
| invoices | ≥71 | 72 | yes |

Leads count: **140**. No inventory/deal/invoice destroys.

---

## Matrix

| Area | Result | Notes |
|---|---|---|
| `/leads` page | **PASS** | HTML 200; table + kanban toggle |
| Kanban columns / drag PATCH | **PASS** | Status whitelist `Not Started` → `In Progress` → revert; re-scores on PATCH |
| Score display | **PASS** (fixed) | `resolveLeadScore()` prefers persisted `score`/`temperature`; matches filters |
| Temperature filters | **PASS** (fixed locally) | Live still DB-eq only (Warm/Cold empty while most rows `temperature=null`); local GET resolves via `scoreLead` then `.in(id)` |
| Convert to deal | **PASS** | Dry POST → **400** `NEEDS_VEHICLE` + wizard `redirect` (no invented deal) |
| Log call | **PASS** | Route re-scores + appends notes; unauth → **401**; UI gated by `canEdit(leads)` |
| Email sequence panel | **PASS** | Enrollments GET `meta.resend_configured: false`; Send next → **503** `NOT_CONFIGURED` (no fake send) |
| Tenant / auth | **PASS** | Convert/log-call require dealership access; ownership assert |

---

## Bugs found + fixed (local)

| Bug | Severity | Fix |
|---|---|---|
| Manager (and `canEdit`/`canCreate` roles) blocked from Add/Edit/Log call/Convert/Kanban write in UI while APIs allow Manager | **High** | Leads page + `LeadDetailsModal` use `canEdit` / `canCreate` / `canDelete` from `permission-middleware` |
| Table/kanban always recomputed `scoreLead()` while filters used DB `temperature` → mismatch; legacy nulls invisible to Warm/Cold | **High** | Added `resolveLeadScore()`; GET enriches response; temperature filter resolves IDs via scoring (not only `.eq("temperature")`) |
| `statusBoost` ignored pipeline status `Not Started` | **Low** | Map `not started` → +10 (same as new/open) |
| Convert error path did not reliably use `ApiError.data.redirect` | **Medium** | Catch `instanceof ApiError` for wizard redirect |
| Empty-state `hasFilters` omitted temperature + assignee | **Low** | Include both in `hasFilters` |
| Enroll toast unclear when Resend missing | **Low** | Explicit “Resend not configured” copy; Send next stays blocked |

**CF deploy:** skipped per lane instructions — integrator should redeploy for temperature-filter + enrichment + Manager UI.

---

## Bugs deferred

| Item | Reason |
|---|---|
| Persist score backfill for all 140 Nova rows | Writes every lead; filter fix covers read-path without mass mutate |
| One-click convert when no interest vehicle / price | By design → wizard redirect (`NEEDS_VEHICLE` / `NEEDS_PRICE`) |
| Invent Resend keys / live send | Forbidden; honest 503 + amber Integrations copy |

---

## Smoke checklist (executed)

- [x] Login Admin QA → `/api/me` 200  
- [x] `GET /api/leads?limit=20` → 140 total  
- [x] `GET /api/leads?temperature=Hot|Warm|Cold` (live: Hot=1, Warm/Cold=0 until redeploy)  
- [x] `GET /leads` 200  
- [x] Convert dry-run 400 + redirect  
- [x] Enrollments meta `resend_configured: false`  
- [x] Send next 503 `NOT_CONFIGURED`  
- [x] Kanban PATCH round-trip + revert  
- [x] Unauth log-call 401  
- [x] Floors 158 / 78 / 72  
- [x] `tsc --noEmit` clean after fixes  

---

## Files touched

- `src/lib/business/lead-score.ts` — `Not Started` boost + `resolveLeadScore`  
- `src/app/api/leads/route.ts` — temperature resolve + response enrichment  
- `src/app/(dashboard)/leads/page.tsx` — Manager perms, resolve score, hasFilters  
- `src/components/LeadsKanban.tsx` — resolve score + score fields on type  
- `src/components/LeadDetailsModal.tsx` — Manager perms, ApiError convert redirect  
- `src/components/LeadEmailSequencePanel.tsx` — honest missing-config toast  

---

## Secrets / safety

- No passwords or API keys in this file.  
- No fake Resend sends.  
- No CF deploy from this lane.  
- Kanban PATCH reverted to `Not Started` after score check.
