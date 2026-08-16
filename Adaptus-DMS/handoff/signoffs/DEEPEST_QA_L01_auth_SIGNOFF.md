# DEEPEST QA — Lane 01 Auth / Trial SIGNOFF

**Lane:** 01 — Auth / trial (login, register, forgot/reset/verify, soft-lock, OTP honesty)  
**App:** `Adaptus-DMS/Adaptus-DMS` · Live: https://app.flashfender.com  
**Nova dealership:** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Date:** 2026-08-04  
**CF deploy:** Skipped (integrator owns redeploy)

## Floors (live dashboard, Nova Admin)

| Metric | Live | Floor |
|--------|------|-------|
| Vehicles | **158** | ≥158 |
| Sales / deals | **78** | ≥77 |
| Invoices | **72** | ≥71 |

**PASS** — floors intact; no Hillz/Nova data invented or destroyed.

## Live API matrix (pre-redeploy tip)

| Path | Result |
|------|--------|
| `POST /api/auth/login` bad creds | **401** `Invalid email or password` |
| `POST /api/auth/login` Nova Admin | **200** session cookie + role Admin |
| `GET /api/me` | Nova `dealership_id`, `subscription.status=active`, `soft_locked=false` |
| `POST /api/auth/logout` | **200** then `/api/me` **401** |
| `POST /api/auth/forgot-password` | **200** + `warning` Email provider not configured (RESEND) — no fake “sent” without hint |
| `POST /api/auth/otp/send` | **503** `missing_config:true` — honest (no fake code-sent) |
| `POST /api/auth/otp/verify` bad code | **400** Invalid or expired code |
| `POST /api/auth/reset-password` weak / bogus | **400** strength / invalid link |
| `POST /api/auth/register-dealership` validation | **400** name / password / terms |
| Auth pages `/login` `/register` `/forgot-password` `/reset-password` `/verify-email` | **200** |

Secrets: **did not invent** Resend/Meta. Live Worker still lacks `RESEND_API_KEY` / `EMAIL_FROM` — honesty paths asserted.

## Soft-lock / trial

| Check | Result |
|-------|--------|
| Nova subscription | `active` — not soft-locked (grandfathered) |
| Middleware mutating API gate | Returns **402** `TRIAL_EXPIRED` when dealership expired |
| `requireDealershipAccess` | Soft-locks writes only; GET/HEAD/OPTIONS allowed |
| UI | `TrialBanner` (trialing) + `TrialExpiredLock` overlay when `soft_locked` |
| Register copy | Documents 7-day trial + soft lock + OTP-before-login |

## Bugs fixed (local tree — needs CF redeploy)

1. **Login `EMAIL_NOT_VERIFIED`** — 403 now redirects to `/verify-email?email=…&purpose=signup` instead of dead-end error only.
2. **False “Permission denied” on unverified login** — `apiFetch` `silent` now suppresses 4xx bridge dispatch; bridge skips `EMAIL_NOT_VERIFIED`.
3. **Register OTP honesty** — when `otp_sent=false`, amber `toast.warning` (Resend not configured) instead of success claiming mail sent.
4. **OTP resend honesty** — `silent`/`silent5xx` + explicit missing-config message; no success toast on 503.
5. **402 soft-lock toast** — `ApiErrorBridge` surfaces “Trial ended” for `402` / `TRIAL_EXPIRED`.
6. **`apiFetch` silent contract** — `silent` honors 4xx (was documented but not applied to bridge).
7. **Register terms** — client-side accept_terms check before POST.

## Remaining / integrator

- Redeploy Worker so L01 UI/bridge fixes hit `app.flashfender.com`.
- Set `RESEND_API_KEY` + `EMAIL_FROM` via wrangler when ready (blocks live OTP/reset mail; honesty already correct).
- Did not create live trial dealerships (would orphan without email). Soft-lock **402** verified in code + middleware; Nova is active so write-402 not exercised on Nova.

## Verdict

**Lane 01 PASS** for live auth/OTP/forgot honesty + Nova login/floors. Local fixes ready for integrator deploy.
