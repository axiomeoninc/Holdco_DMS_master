# Gold Standard QA Report — FlashFender desk

**Verdict: READY WITH CONDITIONS**

Date: 2026-08-15  
App: Adaptus-DMS at https://app.flashfender.com (Worker `flashfender-dms`)  
Repo: `/home/dave/Documents/DMS/Adaptus-DMS`  
Branch: `qa/gold-standard-2026-08-15`  
Baseline SHA: `edfcef39dff6bde9329f1f418abf84366f32062c` (no git tag; dirty tree)  
Deploy performed: **none**

## Architecture (15-liner)

Next.js 16 App Router + Cloudflare OpenNext. Database is Supabase project `zwfeitodxikdwymkieai` (not DMSFINAL, not Convex). Dealers authenticate with cookies/JWT; `pickSupabaseClient` uses the request JWT so RLS applies. Platform admins use the service-role client and **must** bind a rooftop via `src/lib/platform-rooftop.ts` (cookie / `X-Dealership-Id` / `?dealership_id=`). Unbound platform CRM lists go through `src/lib/tenant-scope.ts` (`applyTenantScope` / empty sentinel UUID) so mixed rooftops never dump. CORS in `src/lib/cors.ts` allowlists Expo origins only — not `*` with credentials.

## Why this verdict

No open SEV-1/2 in the **branch**. SEV-1 leftover list dumps (bill of sale, OCR, finance calculations) are fixed and unit-tested here but **not deployed**, so production Worker may still mix tenants on those three GETs for a platform admin with no Act-as rooftop.

Live critical e2e against production (platform QA user) passed: login/logout, CRM lists, inventory (including vehicles fail-closed without rooftop), deals, help, invoices/payments. Typecheck and lint errors found in Phase 0 are fixed. Vitest 142 passed.

Live Drip JWT vs Nova resource IDs on the Worker was not completed (Cloudflare 403 on non-browser Bearer; magic-link `redirect_to` is localhost:3000). Isolation for that pair is covered by unit tests, not a production HTTP 404 capture.

## Conditions (must before READY)

1. Deploy this branch’s tenant-scope GET fixes (`deploy:cf`) after a normal review — FF-003 is isolation on leftover lists.
2. Optional: run Drip dealer Playwright (browser cookie session) vs Nova IDs expecting 404, once dealer password or Site URL redirect is available. Don’t invent `IMPERSONATE_STASH_SECRET`.

## Findings summary

| ID | SEV | Status | Title |
| --- | --- | --- | --- |
| FF-001 | 3 | FIXED | `resolveVehicleId` union missing `needsActAs` (typecheck) |
| FF-002 | 3 | FIXED | lint `prefer-const` on invoices + roles GETs |
| FF-003 | 1 | FIXED (branch) | Platform-unscoped GET lists: BOS, OCR, finance calculations |
| FF-004 | 3 | OPEN | Stripe checkout has no idempotency key (read-only; not changed) |

**OPEN:** 0 SEV-1, 0 SEV-2, 1 SEV-3  
**FIXED:** 1 SEV-1, 0 SEV-2, 2 SEV-3

## Phase 0 evidence

- typecheck: OOM at default heap; pass at 8GB after FF-001.
- vitest: 136 → 142.
- lint: 2 errors → 0 on those rules; ~180 warnings remain (not treated as SEV-1/2).
- Playwright desktop 25/25 passed (~1.2 min).
- `audit:routes`: 72 pages, 153 APIs.
- `check:tenant-vin`: ok.

## NOT AUDITED (honest)

- Full screenshot grid (375–1920 × light/dark)
- VoiceOver / NVDA three-flow
- Restore-from-backup
- 10× production volume (`npm run test:perf` / k6)
- Every webhook provider timeout
- Lighthouse / CWV
- Sentry/uptime dashboards (no Sentry SDK in repo)
- Live Drip JWT IDOR against Worker (see above)
- Stripe test-mode charge / idempotency write
- Additive RLS SQL (migrations exist in tree; not applied this session)

## Out of scope

flashfender-mobile, Play/App Store, DMSFINAL `rvngtfidrjrnytvpdeqr`, schema redesign, Convex, credential rotation, deleting vehicles/users.

## Sign-off gate

Binding rule: no open SEV-1/2 unless ACCEPTED-RISK. Branch satisfies that locally. Production Worker does not until FF-003 is deployed → **READY WITH CONDITIONS**.
