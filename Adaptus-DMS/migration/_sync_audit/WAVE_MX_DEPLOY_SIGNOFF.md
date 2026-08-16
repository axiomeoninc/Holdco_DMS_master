# Wave MX Deploy Signoff (Phase 2 + M0â€“M3)

**Stamp:** 2026-08-04T06:13:18-07:00  
**Worker:** `flashfender-dms`  
**Live URL:** https://app.flashfender.com  
**Cloudflare account:** `9269f304c042e14181e08bf8ee7aa4f9` (Dchatpar@gmail.com)  
**Supabase:** `zwfeitodxikdwymkieai`  
**Command:** `npm run deploy:cf` with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID=9269f304c042e14181e08bf8ee7aa4f9`

## Version / build

| Field | Value |
|-------|-------|
| **Tip Version ID** | `6bb49eb3-0fa9-493e-b34f-4b22fe64d979` |
| **BUILD_ID** | `nxkdLBchdq76-nLOcrawt` |
| **Git tip** | `000e4014373149e0333619695da1a5d6d66f3d3a` (`000e401` â€” updated code) |
| **Route** | `app.flashfender.com/*` (zone `flashfender.com`) |
| **Cron** | `0 * * * *` |

## Migrations (Supabase Management API)

Project `zwfeitodxikdwymkieai` via `POST /v1/projects/.../database/query` (token from `.env.local` `SUPABASE_ACCESS_TOKEN`).

| File | Result | Notes |
|------|--------|-------|
| `src/app/supabase/migrations/wave_m1_desk_pipeline.sql` | **APPLIED** (201) | Leads score/temperature/converted_deal_id; deal F&I / commission columns |
| `src/app/supabase/migrations/wave_m1_desk_crm.sql` | **APPLIED** (201) | Companion: temperature check + compound indexes |
| `src/app/supabase/migrations/wave_m3_money.sql` | **APPLIED** (201) | First attempt failed (UTF-8 BOM); BOM stripped; re-applied OK. Invoice AR + CASL IP / unsubscribe columns |
| `phase2_crm_email_sequences.sql` | Already applied (prior Lane C) | Not re-run this session |

### Floors (post-migrate; no Hillz destroy/invent)

| Table | Floor | Actual |
|-------|------:|-------:|
| vehicles | >=158 | **158** |
| sales_deals | >=77 | **78** |
| invoices | >=71 | **72** |

Column presence verified for M1 leads/deals fields and M3 invoices/customers fields.

## Secrets

**BLOCKED** â€” no Resend / Meta / CRM cron key material in env or checklist values this session. Live `wrangler secret list` on production (names only):

- Present: `SUPABASE_SERVICE_ROLE_KEY`
- Missing (do not invent): `RESEND_API_KEY`, `EMAIL_FROM`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `SOCIAL_CRON_SECRET` (CRM/social cron)

### Operator puts (after auth to `9269f304.`)

```powershell
cd Adaptus-DMS/Adaptus-DMS
$env:CLOUDFLARE_ACCOUNT_ID = "9269f304c042e14181e08bf8ee7aa4f9"
# Prefer API token for this account (OAuth adaptusclient is wrong account c2cd6b6b.)
# $env:CLOUDFLARE_API_TOKEN = "<token with Workers Scripts:Edit>"

npx wrangler secret put RESEND_API_KEY --name flashfender-dms
npx wrangler secret put EMAIL_FROM --name flashfender-dms
npx wrangler secret put FACEBOOK_APP_ID --name flashfender-dms
npx wrangler secret put FACEBOOK_APP_SECRET --name flashfender-dms
npx wrangler secret put SOCIAL_CRON_SECRET --name flashfender-dms
npx wrangler secret list --name flashfender-dms
```

## Smoke (live, unauthenticated)

| Check | Result |
|-------|--------|
| `GET https://app.flashfender.com/login` | **200** |
| `GET https://app.flashfender.com/BUILD_ID` | `nxkdLBchdq76-nLOcrawt` (matches local `.open-next/assets/BUILD_ID`) |
| `GET https://app.flashfender.com/inventory` | **307** â†’ `/login?next=%2Finventory` (not 5xx) |
| `GET https://app.flashfender.com/deals` | **307** â†’ `/login?next=%2Fdeals` (not 5xx) |

## Marketing

`websites/flashfender.com` **not redeployed** this step (no Phase2/M copy change required for this ship).

## Notes

- OAuth `adaptusclient@gmail.com` / account `c2cd6b6b.` cannot manage production; deploy used `CLOUDFLARE_API_TOKEN` for `9269f304.`.
- BOM removed from `wave_m3_money.sql` so future applies do not fail on `\ufeff`.
- Email / Meta / scheduled CRM features remain gated until secrets are put.

## Verdict

**PASS (code + migrations)** â€” tip `6bb49eb3-0fa9-493e-b34f-4b22fe64d979` live; M1/M3 SQL applied; floors intact.  
**PARTIAL (secrets)** â€” Resend / Meta / `SOCIAL_CRON_SECRET` still operator-blocked.
