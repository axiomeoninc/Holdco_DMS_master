# Gold Standard QA Inventory — FlashFender desk

Date: 2026-08-15  
Source: `npm run audit:routes` + glob `src/app/**/page.tsx` + `src/app/api/**/route.ts` + `src/lib/tenant-scope.ts`.

## Counts

| Bucket | Count | Completeness |
| --- | --- | --- |
| App pages (`**/page.tsx`) | 72 | 100% enumerated |
| API routes (`**/route.ts`) | 153 | 100% enumerated |
| Tenant helper (`applyTenantScope` / `scopedTable`) | 38 files under `src/` | COVERED in unit lists for core CRM |
| Playwright desktop critical | 6 specs / 25 tests | COVERED |
| Visual grid 375–1920 × light/dark | — | NOT AUDITED — no screenshot sweep |
| VoiceOver / NVDA | — | NOT AUDITED |
| 10× k6 (`npm run test:perf`) | — | NOT AUDITED |
| Backup restore | — | NOT AUDITED |
| Webhook provider timeouts | — | NOT AUDITED |
| Lighthouse / CWV | — | NOT AUDITED — no CWV run |
| Sentry / uptime dashboards | — | NOT AUDITED — no Sentry SDK in repo |

## Role matrix

| Actor | Client | Rooftop | Expected list behaviour |
| --- | --- | --- | --- |
| Dealer (JWT) | `pickSupabaseClient` → request JWT (RLS) | `profile.dealership_id` required | Own rooftop only; missing rooftop 403 |
| Platform admin | service-role | Act-as cookie / `?dealership_id=` via `platform-rooftop.ts` | Bound rooftop; **empty sentinel** if unbound (not mixed dump) |
| Platform All Users | service-role | none | `/api/users` intentionally global |
| Public | none | slug/embed | Showroom / embed / review tokens only |

## Pages (72)

COVERED = Playwright or code+API isolation this session. SAMPLED = opened via CRM smoke / inventory / login, not every control. NOT AUDITED = enumerated only.

### Auth (SAMPLED via auth e2e)

`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`

### Critical dealer ops (COVERED)

`/dashboard`, `/inventory`, `/inventory/add`, `/inventory/new`, `/leads`, `/customers`, `/deals`, `/invoices`

### SAMPLED (CRM smoke / related specs / code)

`/inventory/[vin]`, `/inventory/[vin]/edit`, `/inventory/[vin]/print`, `/inventory/gallery`, `/inventory/purchases`, `/customers/[id]`, `/deals/new`, `/deals/[id]`, `/quotations`, `/tasks`, `/test-drives`, `/follow-ups`, `/profile`, `/help` (chrome via help spec)

### Platform (SAMPLED — Act-as fail-closed e2e; picker not fully exercised as Drip)

`/platform`, `/platform/impersonate`, `/platform/analytics`, `/platform/audit-logs`, `/platform/reset-password`, `/platform/subscriptions`, `/platform/feature-flags`, `/platform/login-history`, `/dealerships`, `/dealerships/[id]/users`

### Settings / tools (SAMPLED or NOT AUDITED)

SAMPLED: `/settings/business`, `/settings/billing`, `/settings/subscription`, `/users`, `/roles`  
NOT AUDITED — not opened this session: `/settings/integrations`, `/settings/locations`, `/settings/accounting`, `/settings/reviews`, `/settings/website`, `/settings/ai-governance`, `/settings/retention`, `/settings/audit`, `/settings/platform`, `/calendar`, `/tools`, `/reports`, `/expenses`, `/vendors`, `/tickets`, `/service`, `/social`, `/email-sequences`, `/sms-sequences`, `/sms-sequences/new`, `/sms-sequences/[id]`, `/finance`, `/finance/credit`, `/finance/credit/new`, `/finance/credit/[id]`, `/signatures/[documentType]/[documentId]`

### Public (SAMPLED embed JSON-LD)

`/`, `/showroom/[slug]`, `/review/[token]`, `/embed/vehicles/[id]`, `/unsubscribe`

## APIs (153)

Auth: JWT cookie/bearer for dashboard APIs; platform routes require `is_platform_admin`; public: auth, showroom, embed, unsubscribe, webhooks.

Tenant-scoped **Y** when `applyTenantScope` / `scopedTable` / `findVehicleByVinOrId` / explicit `dealership_id` eq / JWT RLS via `pickSupabaseClient`.

Leftover platform-unscoped **list** GETs found and fixed this session: bill-of-sale, ocr-documents, finance-calculations (see QA-FINDINGS FF-003).  

ID GET leftover (service-role fetch then `assertOwnershipOrDeny` → **404** for other rooftops): invoices/[id], leads/[id], tasks/[id], tickets/[id], vendors/[id] — SAMPLED in code, unit 404 on users/[id] + roles/[id] + vehicles. Live Drip JWT vs those IDs on Worker: NOT AUDITED (Cloudflare blocks non-browser Bearer).

Auth / register / OTP / password: tenant N/A. Platform analytics / login-history: platform-only. Users list: global for AdaptUs console by design.

## Forms (Appendix A)

| Form | Status |
| --- | --- |
| Login | COVERED (e2e auth) |
| Vehicle create entry | SAMPLED (inventory “Add vehicle” visible) — persist API not mutated this session |
| Lead / customer / deal sheets | SAMPLED via list e2e — validation NOT AUDITED every field |
| Other forms | NOT AUDITED |

## a11y / visual

Keyboard login + primary nav: SAMPLED (Playwright login uses labels). axe: wired (`@axe-core/playwright`); login/auth journey COVERED if spec calls `axeScan` — color-contrast disabled by fixture. Full viewport × theme grid: NOT AUDITED.
