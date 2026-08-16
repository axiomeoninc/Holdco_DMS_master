# Gold Standard QA Findings — FlashFender desk

- **App:** Adaptus-DMS (desk) at https://app.flashfender.com
- **Branch:** `qa/gold-standard-2026-08-15`
- **Baseline SHA:** `edfcef39dff6bde9329f1f418abf84366f32062c`
- **Tag:** not applied — working tree was dirty (staged + unstaged in-flight work). SHA-only baseline.
- **Date:** 2026-08-15
- **Supabase:** `zwfeitodxikdwymkieai` only
- **Tenants:** Drip `efe720c0-477e-45bf-a0a7-f6ebc1d984bd` vs Nova test `dd404bb6-3e64-43ae-9eb7-98095033c6cb`
- **Deploy:** none (`npm run deploy:cf` not run)

Finding IDs start at `FF-001`. Never commit `handoff/*.SECRETS.md` or `.env`.

---

## Phase 0 — Health

| Check | Result |
| --- | --- |
| `tsc --noEmit` (8GB heap) | FAIL then FIXED — `needsActAs` not in `resolveVehicleId` union ([FF-001](#ff-001)) |
| `npm test` (vitest) | 136 passed at baseline; **142 passed** after isolation additions |
| `npm run lint` | 2 errors (prefer-const) then FIXED ([FF-002](#ff-002)); 180 warnings remain |
| Playwright desktop | **25 passed** — auth, crm-smoke, inventory, deals, help, invoices-payments vs `https://app.flashfender.com` |
| `npm run audit:routes` | 72 pages, 153 APIs; orphan pages `/embed`, `/object/public/vehicles`, `/review`, `/showroom`; orphan API `/api/showroom` |
| `npm run check:tenant-vin` | ok |

Architecture: dealers use JWT/`pickSupabaseClient`; rooftop filters go through `src/lib/tenant-scope.ts` (`applyTenantScope` / empty sentinel); Act-as is `src/lib/platform-rooftop.ts`. Not Convex.

---

### FF-001

- **Severity:** SEV-3
- **Status:** FIXED
- **Surface:** `src/app/api/vehicles/[id]/route.ts` `resolveVehicleId`
- **Repro:** `NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck`
- **Evidence:** `TS2353: 'needsActAs' does not exist in type 'ResolvedVehicle | { error } | { conflict: true }'`
- **Fix:** include `{ needsActAs: true }` in the return union (Green).
- **Verify:** typecheck exit 0.

### FF-002

- **Severity:** SEV-3
- **Status:** FIXED
- **Surface:** `src/app/api/invoices/route.ts`, `src/app/api/roles/route.ts`
- **Repro:** `npm run lint` → 2 `prefer-const` errors, exit 1
- **Fix:** `let` → `const` on `customerLookup` and `query` (Green).
- **Verify:** those two errors gone.

### FF-003

- **Severity:** SEV-1
- **Status:** FIXED in branch (not deployed)
- **Surface:** GET `/api/bill-of-sale`, `/api/ocr-documents`, `/api/finance-calculations`
- **Repro:** platform admin with no Act-as rooftop; unit tests now expect `data: []`. Before fix they returned mixed dealer A+B rows (service-role, no `.eq`).
- **Evidence:** `tenant-isolation-lists.test.ts` failed then passed (27). Dealer lists were already scoped; platform skip of `.eq` was the dump.
- **Fix:** `applyTenantScope` + `tenantScopeFromRequest` (Green leftover tenant scope).
- **Rollback:** revert the three GET handlers; lists would again skip tenant filter for platform.
- **Verify:** `npx vitest run tests/unit/tenant-isolation-lists.test.ts` 27 passed.
- **Note:** Worker not updated. Production may still dump those three lists for platform until `npm run deploy:cf`.

### FF-004

- **Severity:** SEV-3
- **Status:** OPEN
- **Surface:** `src/app/api/payments/checkout/route.ts`
- **Repro:** read-only grep — no Stripe `Idempotency-Key`.
- **Fix:** not applied (Amber; no Stripe test-mode charge in this session).
- **Verify:** N/A.

---

## Isolation / IDOR

- Unit: Drip vs Nova vehicle VIN/id 404 (`tenant-vin-isolation.test.ts`, 12 passed).
- Unit: CRM lists + leftover BOS/OCR/finance ([FF-003](#ff-003)).
- Live Playwright as platform QA: `GET /api/vehicles` without rooftop cookie **fail-closed** (`e2e/inventory.spec.ts`).
- Live Drip JWT vs Nova IDs on the Worker: **not completed**. Raw `Authorization: Bearer` from this host is Cloudflare 403 (`cloudflare_error`). Magic link `redirect_to` is `http://localhost:3000` (connection refused). Did not dump mixed-tenant CRM. Fixture lookup confirmed Drip user exists and is not platform admin.

---

## Counts (this file)

| Status | SEV-1 | SEV-2 | SEV-3 |
| --- | --- | --- | --- |
| OPEN | 0 | 0 | 1 (FF-004) |
| FIXED | 1 (FF-003) | 0 | 2 (FF-001, FF-002) |
