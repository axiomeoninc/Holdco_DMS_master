# Secrets Ops Status — flashfender-dms

**Stamp:** 2026-08-04 (E2E refresh)  
**Todo:** ops-secrets  
**Worker:** `flashfender-dms`  
**Production account:** `9269f304c042e14181e08bf8ee7aa4f9` (Dchatpar@gmail.com's Account)  
**Checklist:** `FLASHFENDER_SECRETS_CHECKLIST.md`

---

## Verdict: BLOCKED (Resend / Meta / cron)

Live `wrangler secret list --name flashfender-dms` on account `9269f304…` (names only):

```json
[
  { "name": "SUPABASE_SERVICE_ROLE_KEY", "type": "secret_text" }
]
```

No Resend / Meta / cron key material exists in local `.env*`, checklists, or ops notes. **Did not invent keys.**

---

## Present vs missing

### Present

| Name | Notes |
|------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Confirmed live |

### Missing — required (operator)

| Name | Purpose | Source |
|------|---------|--------|
| `RESEND_API_KEY` | OTP, reset, CRM sequences, invoice email | Resend dashboard API keys |
| `EMAIL_FROM` | Verified From header | Resend domain + chosen address |
| `FACEBOOK_APP_ID` | Meta OAuth / social publish | Meta Developer Console |
| `FACEBOOK_APP_SECRET` | Meta OAuth + state HMAC | Meta Developer Console |
| `SOCIAL_CRON_SECRET` | Social scheduled cron + CRM send-due fallback | Operator-generated secret |

### Optional

| Name | Purpose |
|------|---------|
| `CRM_CRON_SECRET` | Preferential cron auth for email send-due (else `SOCIAL_CRON_SECRET`) |
| `FACEBOOK_REDIRECT_URI` | Only if callback ≠ default |
| `CARFAX_*` | Partner VHR fetch (Carfax shows `url_only` without them) |

---

## Exact puts (after auth to `9269f304…`)

```powershell
cd Adaptus-DMS/Adaptus-DMS
$env:CLOUDFLARE_ACCOUNT_ID = "9269f304c042e14181e08bf8ee7aa4f9"
# $env:CLOUDFLARE_API_TOKEN = "<Workers Scripts:Edit on 9269f304…>"

npx wrangler secret put RESEND_API_KEY --name flashfender-dms
npx wrangler secret put EMAIL_FROM --name flashfender-dms
npx wrangler secret put FACEBOOK_APP_ID --name flashfender-dms
npx wrangler secret put FACEBOOK_APP_SECRET --name flashfender-dms
npx wrangler secret put SOCIAL_CRON_SECRET --name flashfender-dms
# optional:
# npx wrangler secret put CRM_CRON_SECRET --name flashfender-dms

npx wrangler secret list --name flashfender-dms
```

---

## Integrations honesty (authenticated 2026-08-04)

`GET /api/settings/integrations`:

| id | configured | status |
|----|------------|--------|
| resend | false | `missing_env` |
| meta_facebook | false | `missing_env` |
| carfax | true | `url_only` |
| kijiji_syndication | true | `url_only` |
| autotrader_syndication | true | `url_only` |

Matches worker secrets (Resend/Meta absent).

`GET|POST /api/email-sequences/send-due` → **503** with message that cron secret + Resend keys are required (honest; not fake-sent).

---

## Next operator actions

1. Obtain Resend API key + verified `EMAIL_FROM`.
2. Obtain Meta App ID + Secret (or defer Meta until publish is needed).
3. Generate `SOCIAL_CRON_SECRET` and put it.
4. Re-smoke `/settings/integrations` (Resend/Meta green) and a safe Resend path.
