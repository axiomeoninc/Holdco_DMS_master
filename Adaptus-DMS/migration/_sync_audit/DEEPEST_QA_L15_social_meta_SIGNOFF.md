# DEEPEST QA L15 — Social / Meta SIGNOFF

**Stamp:** 2026-08-04T06:45:00-07:00  
**Plan:** `deepest_qa_20_swarm_d1b2b148.plan.md`  
**Lane:** 15 — Social / Meta (drafts/schedule, Connect placeholder, no fake publish)  
**App:** Adaptus-DMS · live https://app.flashfender.com · worker `flashfender-dms`  
**Nova:** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Local git tip (pre-commit):** `e1909a893ce8a096419f9535a932b0d07a058020`  
**CF deploy this lane:** **NONE** (integrator owns redeploy)  
**Verdict:** **PASS** (with on-fly honesty fixes; live tip unchanged)

---

## Scope

| Path | Role |
|------|------|
| `src/app/(dashboard)/social/page.tsx` | Calm Ops Social UI — drafts / schedule / Connect |
| `src/app/api/social/posts/route.ts` | List + create; Graph publish gate |
| `src/app/api/social/facebook/route.ts` | Status + OAuth start/disconnect (503 if env missing) |
| `src/app/api/social/publish-scheduled/route.ts` | Cron / manual due publish |
| `src/lib/social/facebook.ts` | Env probe + Graph helpers (no token leak) |

Out of lane: Settings Integrations Meta row (L17 owns); no Marketplace bots; no invented Meta secrets.

---

## Static audit

| Check | Result |
|-------|--------|
| Draft without Meta env | **PASS** — create works; status Draft |
| Schedule honesty | **PASS** — stores `scheduled_date`; notes mention cron/secret |
| Connect placeholder | **PASS** — UI amber “Not configured”; button disabled; API `oauth_ready:false` + 503 on oauth_start |
| Fake Published without Graph | **FIXED** — API ignored client `status=Published` without `publish_now`; now also requires `graph_post_id` or downgrades to Draft |
| Non-Facebook “publish” | **FIXED** — UI disables Publish chip; client blocks; API saves Draft with honesty message |
| Tokens to client | **PASS** — status omits `access_token` |
| Tenant scope | **PASS** — posts/facebook queries `dealership_id` |
| Marketplace / scrape claims | **PASS** — copy says Meta Graph only; gallery reuse only |

---

## Live probes (unauthenticated)

| Endpoint | Result |
|----------|--------|
| `GET /social` | **307** → login |
| `GET /api/social/facebook` | **401** Unauthorized |
| `GET /api/social/posts` | **401** Unauthorized |
| `GET/POST /api/social/publish-scheduled` | **503** `SOCIAL_CRON_SECRET not configured` + honest message |

Secrets remain **BLOCKED** (no FACEBOOK_* / SOCIAL_CRON_SECRET on worker) — Connect stays placeholder; drafts OK. Matches Wave MX secrets status.

---

## Fixes on the fly (local only — no CF deploy)

1. **`posts/route.ts`** — Refuse fake `Published`: strip client `status=Published` without `publish_now`; final guard requires `graph_post_id`; return `message` honesty string; `published` only when Graph succeeded.
2. **`social/page.tsx`** — Amber Connect strip when env missing; surface `fbMessage`; block publish client-side if not connected / non-Facebook; never send `status: Published` from client; reset mode when leaving Facebook; schedule copy notes live 503 until cron secret.

---

## Floors

No DB writes that destroy inventory/CRM. Floors unchanged: vehicles ≥158, deals ≥77, invoices ≥71.

---

## Redeploy needed?

**Yes (integrator)** — social UI + posts API honesty guards are local-only until CF tip updates. This lane did **not** run `wrangler deploy`.

---

## Residual / blocked

| Item | Status |
|------|--------|
| Meta App ID/Secret | Blocked — operator wrangler secrets |
| SOCIAL_CRON_SECRET + hourly trigger | Blocked — schedule stores only |
| Live OAuth Connect E2E | Blocked until secrets |
| Authenticated draft create smoke | Not run this lane (no session in agent); prior Wave MX Social v1 + static/API honesty covered |

---

## Signoff

**L15 Social / Meta: PASS** — Connect placeholder honest (amber + 503 cron); no fake publish path after fix; drafts/schedule remain usable without secrets.
