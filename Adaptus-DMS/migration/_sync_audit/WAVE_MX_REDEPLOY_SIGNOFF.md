# Wave MX Redeploy Signoff

**Stamp:** 2026-08-04T07:25:41-07:00  
**Worker:** `flashfender-dms`  
**Live URL:** https://app.flashfender.com  
**Cloudflare account:** `9269f304c042e14181e08bf8ee7aa4f9` (Dchatpar@gmail.com)  
**Command:** `opennextjs-cloudflare deploy` (build via `npm run deploy:cf` / OpenNext) with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID=9269f304…`

## Version / build

| Field | Value |
|-------|-------|
| Prior tip (Deepest QA) | `a2a4fd4d-490c-42e9-b2c9-e72a36029466` (`BUILD_ID`=`vWEb13642-Ekpt_B2eACz`) |
| **New tip Version ID** | `c38819f8-36f2-46ba-813f-aefbabcc9b27` |
| **BUILD_ID** | `80dV2uBx2OU2e4jNJKdkw` |
| Git tip | `1743d58a0d4003f3e550d982979b575e863c9e3c` |
| Route | `app.flashfender.com/*` (zone `flashfender.com`) |

## Smoke

| Check | Result |
|-------|--------|
| `GET /login` | **200** |
| `POST /api/auth/login` (F02 test) | **200** |
| `GET /BUILD_ID` | `80dV2uBx2OU2e4jNJKdkw` |
| `/_next/static/80dV2uBx2OU2e4jNJKdkw/_buildManifest.js` | **200** |
| `/_next/static/80dV2uBx2OU2e4jNJKdkw/_ssgManifest.js` | **200** |
| vehicles (`?limit=500`) | **158** (≥158) |
| deals (`?limit=500`) | **78** (≥77) |
| invoices (`?limit=500`) | **72** (≥71) |
| dashboard stats | **158 / 78 / 72** vehicles/sales/invoices |

## Notes

- OAuth `adaptusclient` (account `c2cd6b6b…`) cannot attach `flashfender.com` routes; production deploy requires API token for `9269f304…`.
- First prod upload (tip `50c091c2…`) needed a follow-up wrangler/OpenNext deploy to settle assets → tip `c38819f8-36f2-46ba-813f-aefbabcc9b27`.
- Uncommitted local delta was audit probes only; app code at `1743d58a0d4003f3e550d982979b575e863c9e3c`.

## Verdict

**PASS** — tip `c38819f8-36f2-46ba-813f-aefbabcc9b27` live; `BUILD_ID`=`80dV2uBx2OU2e4jNJKdkw`; floors **158 / 78 / 72**.
