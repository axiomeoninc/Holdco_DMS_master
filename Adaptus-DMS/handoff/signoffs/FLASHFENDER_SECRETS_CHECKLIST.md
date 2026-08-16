# FlashFender Secrets Checklist — `flashfender-dms`

**Account:** `9269f304c042e14181e08bf8ee7aa4f9`  
**Worker:** `flashfender-dms`  
**Live:** https://app.flashfender.com  
**Last verified:** 2026-08-04 (E2E complete pass)

---

## Present on worker (names only)

| Name | Status |
|------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Present** |

## Missing — do not invent

| Name | Where operator gets value | Put command |
|------|---------------------------|-------------|
| `RESEND_API_KEY` | [Resend](https://resend.com/api-keys) → API Keys | `npx wrangler secret put RESEND_API_KEY --name flashfender-dms` |
| `EMAIL_FROM` | Verified domain sender, e.g. `FlashFender <noreply@flashfender.com>` | `npx wrangler secret put EMAIL_FROM --name flashfender-dms` |
| `FACEBOOK_APP_ID` | [Meta Developer Console](https://developers.facebook.com/) → App → Settings | `npx wrangler secret put FACEBOOK_APP_ID --name flashfender-dms` |
| `FACEBOOK_APP_SECRET` | Same Meta app → App Secret | `npx wrangler secret put FACEBOOK_APP_SECRET --name flashfender-dms` |
| `SOCIAL_CRON_SECRET` | Generate strong random string (operator); used by social cron + CRM send-due fallback | `npx wrangler secret put SOCIAL_CRON_SECRET --name flashfender-dms` |
| `CRM_CRON_SECRET` | Optional; falls back to `SOCIAL_CRON_SECRET` for `/api/email-sequences/send-due` | `npx wrangler secret put CRM_CRON_SECRET --name flashfender-dms` |

## Auth for puts

```powershell
cd Adaptus-DMS/Adaptus-DMS
$env:CLOUDFLARE_ACCOUNT_ID = "9269f304c042e14181e08bf8ee7aa4f9"
# Prefer API token with Workers Scripts:Edit on 9269f304… (OAuth adaptusclient is wrong account)
# $env:CLOUDFLARE_API_TOKEN = "<token>"
npx wrangler secret list --name flashfender-dms
```

## Local search result (this E2E)

- `.env.local`: Supabase URL/anon/service + `SUPABASE_ACCESS_TOKEN` only — **no** Resend/Meta/cron values.
- Marketing `.env`: `PUBLIC_APP_ORIGIN` only.
- Docs/checklists: command templates only — **no** key material to put.
