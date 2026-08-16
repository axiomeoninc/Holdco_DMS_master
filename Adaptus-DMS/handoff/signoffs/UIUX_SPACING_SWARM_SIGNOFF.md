# UI/UX Spacing Swarm — Signoff

**Deployed:** 2026-08-02  
**Worker:** `adaptus-nova-motors`  
**Tip Version ID:** `23cd42fd-935c-4eed-b7d9-5be732cf7e3e`  
**URLs:** https://dms.adaptusgroup.ca · https://adaptus-nova-motors.adaptusclient.workers.dev  
**Brand:** Calm Ops Brand Blue `#2563EB` preserved (no purple/glass redesign). Floors 158/77/71 untouched.

## What shipped

### Phase 0 — Tokens + shared shells
- Spacing tokens in `src/app/globals.css`: `--space-page-x/y`, `--space-section`, `--space-stack`, `--space-field`, `--space-tap`
- Loosened: `ListPageShell` (`space-y-3` → `space-y-5`), `PageHeader`, `MetricStrip`, `FilterChip`/`SegmentedControl`, `DataTable` cell pad, `RecordDrawer`, `ModalShell`
- Rubric: `migration/_sync_audit/UI_SPACING_RUBRIC.md`

### Phase 1 — Swarm audit + P0 fixes
- Shared `ListToolbar` (gap, tap ≥40px, no `-mx-1` bleed)
- Core routes: Inventory, Deals, Leads, Customers, VIN detail
- Forms/overlays: Lead/Customer modals, VehicleIntakeWizard, TaskDetails, CustomerMerge, BOS tap targets, purchases/social ModalShell sections

### Phase 2 — Playwright + axe
- `@playwright/test`, `@axe-core/playwright`
- `playwright.config.ts` (1280 desktop + 390 mobile)
- `e2e/ui-spacing.spec.ts` — list routes, Add Lead/Customer, inventory drawer, login smoke
- Scripts: `npm run test:e2e`, `npm run test:e2e:update`
- Baseline captured: login desktop (`e2e/ui-spacing.spec.ts-snapshots/login-desktop-win32.png`)
- Authenticated route baselines require `E2E_EMAIL` + `E2E_PASSWORD` (skipped without credentials)

## Residual P1 (not blocking tip)
- Users / dealership-users: move filter band into `toolbar` prop (structural)
- BOS pricing inputs still denser than payment row inputs in places
- Full authenticated screenshot matrix (inventory/deals/leads/customers) pending env credentials

## Verify
1. Hard-refresh https://dms.adaptusgroup.ca — list pages show clearer header → KPI → toolbar → table bands
2. Filter chips / primary CTAs feel ~40px tap
3. Open Add Lead / Customer / a RecordDrawer — consistent `px-6` header/body/footer
4. Optional: `E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e:update`
