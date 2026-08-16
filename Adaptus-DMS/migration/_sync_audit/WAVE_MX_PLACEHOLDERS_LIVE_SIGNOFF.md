# Wave MX — Placeholders Live Signoff

**Stamp:** 2026-08-04T06:33:00-07:00  
**Scope:** Ship honest “not configured” placeholders (no invented secrets); redeploy app  
**App:** https://app.flashfender.com · worker `flashfender-dms` · CF `9269f304c042e14181e08bf8ee7aa4f9`  
**Marketing:** https://flashfender.com · worker `flashfender-web` — **no redeploy** (claim copy unchanged)  
**Supabase:** `zwfeitodxikdwymkieai` · Nova: `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Git tip (local):** `000e4014373149e0333619695da1a5d6d66f3d3a` (+ uncommitted placeholder UI polish)

---

## Tips

| Surface | Tip / Version ID | Notes |
|---------|------------------|-------|
| **App** `flashfender-dms` | `7b667362-1e91-4261-8b40-3831ee804a2d` | `npm run deploy:cf` this pass; live `BUILD_ID`=`abL7f5uKnFhhGb8AErTxD` |
| **Marketing** `flashfender-web` | `10d1680a-d999-46e3-8b06-9adba194009c` | Unchanged |

**Prior app tip:** `6bb49eb3-0fa9-493e-b34f-4b22fe64d979`  
**Secrets put:** **None** — only `SUPABASE_SERVICE_ROLE_KEY` on worker; Resend/Meta/cron still absent by design.

---

## Floors (intact)

| Table | Floor | Live (dashboard API) |
|-------|------:|---------------------:|
| vehicles | ≥158 | **158** |
| sales_deals | ≥77 | **78** (`totalSales`) |
| invoices | ≥71 | **72** |

---

## What changed (UI / API honesty)

| Surface | Placeholder users see |
|---------|------------------------|
| **Settings → Integrations** | Amber banner: **“Not configured — add via wrangler when ready”**. Resend + Meta badges **Not configured** (amber); Kijiji/AutoTrader **Ready (no API key)**; Carfax URL-only. Missing env listed with wrangler hint. No green Connected without keys. |
| **Email sequences** | Amber: **“Not configured — add via wrangler when ready”** — enroll OK, no fake Sent. |
| **Lead → Email sequence panel** | Amber: enroll works; **Send next** disabled / blocked without Resend. |
| **Social** | Connect button **Not configured**; copy says add FACEBOOK_APP_ID/SECRET via wrangler; drafts still work. |
| **Forgot password** | Warning path: toast **Email not configured** (no fake “link was sent” success when Resend missing). |
| **Verify email** | Amber note that Resend code fails honestly until secrets set. |
| **Billing / Stripe** | Unchanged honest placeholders. |
| **send-due / send-next APIs** | **503** `CRON_NOT_CONFIGURED` / `NOT_CONFIGURED` — never marks sent. |

---

## Smoke (live tip)

| # | Check | Result |
|---|-------|--------|
| 1 | `GET /login` | **200** |
| 2 | Live tip = `7b667362…` + BUILD_ID match | **PASS** |
| 3 | Integrations JS contains “Not configured” / “wrangler when ready” | **PASS** |
| 4 | `GET/POST /api/email-sequences/send-due` | **503** cron not configured |
| 5 | Login → `/api/settings/integrations` | Resend + Meta `missing_env`; secrets_present all false for Resend/Meta |
| 6 | Ensure default sequence + enroll lead | **201** enroll |
| 7 | `POST …/enrollments/{id}/send-next` | **503** `NOT_CONFIGURED` / missingConfig |
| 8 | Marketing redeploy | **Skipped** (no copy change) |

---

## Operator next (when real keys exist)

```powershell
cd Adaptus-DMS/Adaptus-DMS
$env:CLOUDFLARE_ACCOUNT_ID = "9269f304c042e14181e08bf8ee7aa4f9"
# $env:CLOUDFLARE_API_TOKEN = "<Workers Scripts:Edit on 9269f304…>"
npx wrangler secret put RESEND_API_KEY --name flashfender-dms
npx wrangler secret put EMAIL_FROM --name flashfender-dms
npx wrangler secret put FACEBOOK_APP_ID --name flashfender-dms
npx wrangler secret put FACEBOOK_APP_SECRET --name flashfender-dms
npx wrangler secret put SOCIAL_CRON_SECRET --name flashfender-dms
```

Do **not** put dummy keys.

---

## Verdict

**PASS** — Placeholders live on tip `7b667362-1e91-4261-8b40-3831ee804a2d`.  
**Secrets:** still **BLOCKED** / operator-gated (honest UI + 503s until real wrangler puts).

| ID | Value |
|----|-------|
| App tip | `7b667362-1e91-4261-8b40-3831ee804a2d` |
| Marketing tip | `10d1680a-d999-46e3-8b06-9adba194009c` (unchanged) |
| BUILD_ID | `abL7f5uKnFhhGb8AErTxD` |
