# Wave A+B Cloudflare Deploy Signoff

**Date:** 2026-08-04 (UTC)  
**Git tip:** `000e4014373149e0333619695da1a5d6d66f3d3a` (`000e401` — "updated code")  
**Command:** `npm run deploy:cf` (OpenNext build already complete; final push via `opennextjs-cloudflare deploy`)

## Cloudflare account / worker

- **Account ID:** `9269f304c042e14181e08bf8ee7aa4f9` (Dchatpar@gmail.com's Account)
- **Worker:** `flashfender-dms`
- **Route:** `app.flashfender.com/*` (zone: `flashfender.com`)
- **Current Version ID:** `48c8b8dd-3f7a-4cfb-b32b-f767b5254d48`
- **Next BUILD_ID (live):** `N3tpf1xPIv8CR4jNYQShq`
- **Cron:** `0 * * * *` (publish-scheduled)

## URLs

| URL | Role |
|-----|------|
| https://app.flashfender.com | Production (custom domain) |
| https://app.flashfender.com/login | Auth entry |
| https://app.flashfender.com/settings/business | Settings (auth-gated) |

## Smoke results

| Check | Result |
|-------|--------|
| `GET https://app.flashfender.com/login` | **200 OK** (not 5xx) |
| `GET https://app.flashfender.com/settings/business` | **307** → `/login?next=%2Fsettings%2Fbusiness` (expected unauthenticated redirect; not 5xx) |

## Dual / Adaptus worker

- `wrangler.toml` names only `flashfender-dms` with `APP_URL=https://app.flashfender.com`.
- `package.json` has a single CF path: `deploy:cf` → OpenNext deploy to that worker.
- No documented dual-deploy script for a separate Adaptus worker in this repo; **Adaptus dual deploy not performed**.

## Secrets / blockers (signoff only — values not set or rotated)

Worker secret list (names only) after deploy:

- Present: `SUPABASE_SERVICE_ROLE_KEY`
- **Not present on worker (do not invent):** `RESEND_API_KEY`, `EMAIL_FROM`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `SOCIAL_CRON_SECRET`, `OPENAI_API_KEY`

**Impact:** Live OTP / forgot-password email and Meta/social publish features that require those secrets will fail until secrets are set via `wrangler secret put` on account `9269f304…`. Non-secret vars (`NEXT_PUBLIC_SUPABASE_*`, `APP_URL`, `NEXTJS_ENV`) are in `wrangler.toml`.

## Notes / incidents during deploy

1. First attempt used OAuth login for `adaptusclient@gmail.com` (account `c2cd6b6b…`). Worker script uploaded there, but **route attach failed** (`Could not find zone for flashfender.com`).
2. Redeploy with API token + `CLOUDFLARE_ACCOUNT_ID=9269f304c042e14181e08bf8ee7aa4f9` succeeded; version `48c8b8dd-3f7a-4cfb-b32b-f767b5254d48` is live on `app.flashfender.com`.
3. Secrets were not rotated or committed. Token used only in shell env for deploy.

## Verdict

**PASS** — Waves A+B build deployed to Cloudflare Workers on `flashfender-dms` / `app.flashfender.com`. Smoke: login 200, settings/business 307 redirect. Blockers limited to optional/missing Resend + Meta secrets (not invented).
