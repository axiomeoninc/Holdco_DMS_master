# Wave C CF Deploy Signoff

**Stamp:** 2026-08-04T05:36:02-07:00  
**Worker:** `flashfender-dms`  
**Live URL:** https://app.flashfender.com  
**Cloudflare account:** `9269f304c042e14181e08bf8ee7aa4f9` (Dchatpar@gmail.com)  
**Command:** `npx opennextjs-cloudflare deploy` (after `npm run deploy:cf` build; first attempt hit wrong OAuth account)

## Version / build

| Field | Value |
|-------|-------|
| **Tip Version ID** | `ac488c82-adbb-4a44-88e9-e1611293809a` |
| **BUILD_ID** | `2bPbqy95hSkwpyipUZyXU` |
| **Git tip** | `000e4014373149e0333619695da1a5d6d66f3d3a` (`000e401` - updated code) |
| **Route** | `app.flashfender.com/*` (zone `flashfender.com`) |
| **Cron** | `0 * * * *` |

## Wave C artifacts confirmed pre-deploy

- `src/components/CarfaxPanel.tsx`
- `src/lib/carfax.ts` / `src/app/api/carfax`
- `src/components/KijijiListingPack.tsx`
- `src/lib/syndication/kijiji.ts`
- `src/app/api/vehicles/[id]/syndication`
- Compete signoff: `migration/_sync_audit/WAVE_C_COMPETE_SIGNOFF.md`

## Smoke (live)

| Check | Result |
|-------|--------|
| `GET https://app.flashfender.com/login` | **200** |
| `GET https://app.flashfender.com/BUILD_ID` | `2bPbqy95hSkwpyipUZyXU` (matches local `.open-next/assets/BUILD_ID`) |
| `GET https://app.flashfender.com/` | **307** `/login?next=%2F` |
| `GET https://app.flashfender.com/inventory` | **307** `/login?next=%2Finventory` |

## Notes

- Default `wrangler whoami` OAuth (`adaptusclient@gmail.com` / `c2cd6b6b…`) cannot attach zone `flashfender.com`. Deploy requires `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID=9269f304c042e14181e08bf8ee7aa4f9` in shell env (token not committed).
- Accidental upload to Adaptus account worker name collision does **not** serve `app.flashfender.com`; live tip is on `9269f304…` only.
- No new secrets invented or written to the repo. Marketing site not touched.
- Wave C product secrets (CARFAX / Meta / Resend) remain optional per `WAVE_C_COMPETE_SIGNOFF.md`; not part of this deploy step.

## Verdict

**PASS** — Wave C build is live on `flashfender-dms` tip `ac488c82-adbb-4a44-88e9-e1611293809a`.
