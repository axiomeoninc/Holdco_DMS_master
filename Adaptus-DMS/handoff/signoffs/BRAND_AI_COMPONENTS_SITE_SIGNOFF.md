# Brand + AI components + site — smoke / dual-deploy signoff

**Stamp:** 2026-08-04T08:05:00-07:00  
**Plan todo:** `smoke-deploy` (`brand_ai_components_website_b28b0904.plan.md`)  
**App:** `Adaptus-DMS/Adaptus-DMS` → https://app.flashfender.com  
**Site:** `websites/flashfender.com` → https://flashfender.com  
**CF account:** `9269f304c042e14181e08bf8ee7aa4f9`  
**Command:** `npx tsc --noEmit` (clean) → `npm run deploy:cf` (app) → `npm run deploy` (site)

## Tip IDs

| Worker | Version ID (tip) | Notes |
|--------|------------------|-------|
| **flashfender-dms** | `058bbc76-ccbc-4156-bc23-fc59009836ed` | Brand + gold components + MiniMax AI |
| **flashfender-web** | `3cbf03d1-be45-44ec-8bb1-ac6bdf69edf0` | Awwwards rebuild + `/features/ai-desk` |
| Prior DMS tip | `c38819f8-36f2-46ba-813f-aefbabcc9b27` | Wave MX redeploy |
| **BUILD_ID** | `yY5S3QX1SYWGhPDRESrN8` | Live `/BUILD_ID` + manifests **200** |

## Floors (Nova)

| Resource | Floor | Live |
|----------|-------|------|
| vehicles | ≥158 | **158** |
| deals / sales | ≥77 | **78** |
| invoices | ≥71 | **72** |
| dashboard stats | — | **158 / 78 / 72** vehicles/sales/invoices |

## Smoke

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **PASS** (0 errors) |
| `GET /login` | **200** |
| `POST /api/auth/login` (F02) | **200** |
| Brand logo path `/brand/flashfender-mark.png` | **200**; login + dashboard HTML reference `/brand/` |
| TipTap / cmdk surfaces (`/inventory/new`, `/inventory`, `/dashboard`, `/quotations`, `/follow-ups`) | **200**; Ask Flash AI in shell; TipTap/cmdk in shipped chunks |
| `GET /api/ai/status` (authed) | **200** `{ configured: true, model: MiniMax-M2.7 }` |
| `MINIMAX_API_KEY` on worker | Present (`wrangler secret list`) |
| Site `GET /` | **200** |
| Site `GET /features/ai-desk` (follow redirect) | **200** |
| Site logo `/brand/flashfender-logo.png` | **200** |

## Git

- **Remote:** `production` → https://github.com/dchatpar/DMSPRODUCTION.git (origin ManishKumar unchanged)
- **Commit:** `f1c32b08cb71f3a7651339db01a1dc2e38eba629`
- **No `.env*`** committed
- Probe: `migration/_sync_audit/_brand_ai_smoke.py`

## Verdict

**PASS** — dual deploy live; tips above; floors **158 / 78 / 72**; AI configured; marketing homepage + AI Desk **200**.
