# FlashFender app domain deploy

**Date:** 2026-08-02  
**Live URL:** https://app.flashfender.com  
**Git tip:** `000e4014373149e0333619695da1a5d6d66f3d3a` (`000e401` — "updated code")  
**Next BUILD_ID:** `eKe7ysfPKoEMI-xVGj_Yv`

## Cloudflare account / worker

- **Account ID:** `9269f304c042e14181e08bf8ee7aa4f9` (Dchatpar@gmail.com's Account)
- **Zone:** `flashfender.com` (`e0bd25b7d3b9fea0b79482ad95c1bbf9`) — present in this account
- **Worker name:** `flashfender-dms` (new; not overwriting `adaptus-nova-motors` which remains on `dms.adaptusgroup.ca/*`)
- **Deploy version (build upload):** `9160e717-e817-4669-8e06-f722fc8cdb30`
- **Current version (after secret put):** `24be36ec-2925-48a0-9b9b-ec4250b3821e`
- **workers.dev:** enabled → `https://flashfender-dms.cadev.workers.dev`

## What was done

1. Confirmed zone `flashfender.com` is on account `9269f304…`.
2. Removed prior Workers route `app.flashfender.com/*` from unrelated worker `flashfender-app`.
3. Pointed `wrangler.toml` at this deploy: `name = "flashfender-dms"`, `APP_URL = "https://app.flashfender.com"`, route `app.flashfender.com/*` / zone `flashfender.com`.
4. Ran `npm run deploy:cf` with `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in shell env only (token not written to tracked files).
5. Set worker secret `SUPABASE_SERVICE_ROLE_KEY` from local `.env.local` via `wrangler secret put` (same Supabase project as Nova — no DB wipe).
6. DNS fix: deleted dead proxied **A** `app` → `45.137.194.145` (caused HTTP **521**). Created proxied **CNAME** `app` → `flashfender-dms.cadev.workers.dev`.
7. Smoke: `GET /` → **307** `/login?next=%2F`; `GET /login` → **200**; HTML title/description = Flash Fender DMS (OpenNext/`x-opennext`).

## DNS leftover / notes

- **Current DNS:** `app.flashfender.com` CNAME → `flashfender-dms.cadev.workers.dev` (proxied). Zone is in-account; no registrar change required.
- Workers Custom Domains API returned auth-scheme error for this token; route + CNAME-to-workers.dev is the working attachment.
- Old worker `flashfender-app` still exists but no longer owns `app.flashfender.com/*`.
- `adaptus-nova-motors` / `dms.adaptusgroup.ca` left intact. Nova floors / Supabase untouched beyond shared service-role secret on the new worker.
- Local `wrangler.toml` now targets FlashFender (`flashfender-dms` + `app.flashfender.com`); re-point before redeploying Adaptus-only if needed.
