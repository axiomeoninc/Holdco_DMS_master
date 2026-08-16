# DEEPEST QA L05 — Intake / purchases / gallery

**Lane:** 05 — Intake wizard, drafts, purchases CRUD, gallery  
**Date:** 2026-08-04 (Pacific)  
**App:** Adaptus-DMS (`Adaptus-DMS/Adaptus-DMS`)  
**Live probed:** https://app.flashfender.com  
**Dealership (Nova):** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Auth:** QA Admin `f02_test_adaptus@adaptusgroup.ca` (password not recorded)  
**Deploy:** **No CF deploy** (lane instruction) — fixes are local; integrator redeploy  
**Floors:** vehicles **158** (live GET `/api/vehicles?limit=1` count) — no destroys / no invented Hillz units  

---

## Verdict

**PASS (with local fixes; CF redeploy needed for live)** — Routes/APIs healthy; purchases CRUD validation + tenant scoping sound; intake draft self-conflict and gallery missing-photo gaps fixed in local tree.

---

## Scope exercised

| Surface | Method | Result |
|---|---|---|
| `/inventory/new` | GET page | **200** HTML, no error boundary |
| `/inventory/add` | GET page | **200** (alias → same wizard) |
| `/inventory/[vin]/edit` | Code review | Wizard `mode="edit"` + VIN load |
| `/inventory/purchases` | GET page | **200** |
| `/inventory/gallery` | GET page | **200** |
| `GET /api/purchases` | Auth | **200**, count **0** (empty table OK) |
| `GET /api/purchases?q=` | Auth | **200** |
| `POST /api/purchases` validation | empty / bad price / bad VIN | **400** as expected |
| `PATCH /api/purchases` no id | Auth | **400** |
| `DELETE /api/purchases` no id | Auth | **400** |
| `GET /api/purchases/:id` fake UUID | Auth | **404** |
| `GET /api/vehicles` floor | Auth | count **158** |
| Gallery coverage | Auth sample | 158 fetched; **127** with image fields; **31** missing |

Static review: `VehicleIntakeWizard`, `intake-draft.ts`, purchases page + `/api/purchases` (+ `[id]`), gallery page, sidebar links.

---

## Bugs found + fixed (local)

| # | Severity | Bug | Fix |
|---|---|---|---|
| 1 | **High** | After add-mode draft save, duplicate-VIN check treated **own** draft as conflict → Continue on Basic blocked | Exclude `form.id` from duplicate hit; lock VIN once `draftSaved` |
| 2 | **High** | Resume local draft with server `id` left `draftSaved=false` → next save **POST** duplicate VIN | On Resume, `setDraftSaved(Boolean(restored.id))` |
| 3 | **Medium** | `persistGallery` ignored PATCH failures (silent photo order/cover loss) | Check `res.ok`, throw + toast on drag/cover/role |
| 4 | **Medium** | Gallery silently dropped 0-photo units → blank grid / inflated counts; no way to find missing photos | Photo filter: With / Missing / All; missing tiles link to edit; accurate counts |
| 5 | **Medium** | Purchase create VIN pre-check was **global** and leaked foreign vehicle `id` in 409 | Scope by `dealership_id`; generic message; map DB `23505` → 409 |
| 6 | **Low** | Purchase search `q` could inject PostgREST `.or()` metacharacters | Strip `%*,()` before ilike |
| 7 | **Low** | Create-form `purchase_date` frozen at module load; no client date required check | `todayISO()` on openCreate; require date on save |
| 8 | **Low** | Inter-step PATCH failures were swallowed | Toast on non-OK step persist |

---

## Deferred

| Item | Reason |
|---|---|
| Live CF tip still lacks L05 fixes | Explicit **No CF deploy**; integrator Phase B |
| Purchases table empty (count 0) | Empty data, not a failure — CRUD paths validated via API probes + UI review |
| End-to-end create→delete purchase on Nova | Avoided inventing inventory / mutating floors; validation + delete-without-vehicle-cascade reviewed |
| Global DB VIN unique across dealerships | If unique is DB-global, insert still 409 via `23505` handler — acceptable |

---

## Auth / tenant notes

- Purchases list/create scoped to `dealership_id` (platform admin may pass `dealership_id` on GET/POST).
- PATCH/DELETE load row then **403** if non-admin and foreign dealership.
- Delete purchase **does not** delete linked vehicle (floor-safe) — confirmed in `[id]` route + UI copy.
- Vehicles GET for gallery uses dealership-scoped `/api/vehicles?limit=200` (floor 158 fits).

---

## Redeploy needed?

**Yes** — local code changed (`VehicleIntakeWizard.tsx`, `gallery/page.tsx`, `purchases/page.tsx`, `api/purchases/route.ts`). Integrator should `tsc` + `npm run deploy:cf` after merge.

---

## Artifact

- Smoke capture: `migration/_sync_audit/_l05_smoke.json` (workspace root audit folder)
