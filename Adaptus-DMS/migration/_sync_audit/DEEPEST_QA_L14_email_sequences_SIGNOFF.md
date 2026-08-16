# DEEPEST QA L14 — Email sequences (enroll / send-due / placeholders)

**Stamp:** 2026-08-04 (Pacific)  
**Lane:** 14 — Email sequences  
**Plan:** `deepest_qa_20_swarm`  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com · worker `flashfender-dms`  
**Supabase:** `zwfeitodxikdwymkieai` · Nova `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**CF deploy:** **Skipped** (lane instruction)  
**Secrets:** None invented; Resend / cron remain unset by design  

---

## Verdict

**PASS** — Enroll works; send-next / send-due honest **503** without Resend/cron; **zero** Nova `email_sequence_sends` rows (no fake Sent). Local fixes ready for integrator deploy.

---

## Floors (untouched)

| Table | Floor | Live (service-role count) |
|-------|------:|--------------------------:|
| vehicles | ≥158 | **158** |
| sales_deals | ≥77 | **78** |
| invoices | ≥71 | **72** |

---

## Smoke matrix

| # | Check | Result |
|---|-------|--------|
| 1 | `GET/POST /api/email-sequences/send-due` (no secret) | **503** `CRON_NOT_CONFIGURED` |
| 2 | `POST /api/email-sequences/process-due` | **503** same (alias) |
| 3 | `GET /api/email-sequences/process-due` (live tip) | **405** — fixed locally (export GET); pending CF |
| 4 | `GET /api/email-sequences` (auth Admin) | **200**, `meta.resend_configured: false`, 1 sequence |
| 5 | `GET /api/email-sequences/enrollments` | **200**, enrollments list |
| 6 | `POST …/enrollments` `send_first:true` | **201** active step **0**; `first_send` `NOT_CONFIGURED` |
| 7 | `POST …/enrollments/{id}/send-next` | **503** `NOT_CONFIGURED` / `missingConfig` |
| 8 | `POST …/enrollments/{id}/stop` | **200** |
| 9 | Nova `email_sequence_sends` after enroll+send-next | **0 rows** |
| 10 | Global `status=sent` + `resend_id IS NULL` | **[]** |
| 11 | Default sequence + 3 steps | Present (`Lead nurture (3-step)`) |
| 12 | UI amber copy (`/email-sequences`, lead panel) | Placeholders + Send next disabled without Resend |
| 13 | Unauth `GET /api/email-sequences` | **401**; page **307** → login |

Auth smoke used short-lived magic-link session for `f02_test_adaptus@adaptusgroup.ca` (not recorded).

---

## Bugs found + fixed (local; pending CF)

| Bug | Severity | Fix |
|-----|----------|-----|
| `GET /api/email-sequences/process-due` → **405** (POST-only alias) | Medium | Export `GET` → same handler as `send-due` |
| No-email / no-consent left enrollment **active** → cron would re-insert `skipped` every hour | Medium | Stop enrollment (`no_email` / `marketing_consent_false`) after one skipped log; add `NO_CONSENT` code |
| Amber “Not configured” banner flashed during page load even before meta known | Low | Gate banner on `!loading && !resendConfigured` |

**Files touched:**

- `src/app/api/email-sequences/process-due/route.ts`
- `src/lib/crm/email-sequences.ts`
- `src/app/api/email-sequences/enrollments/[id]/send-next/route.ts`
- `src/app/(dashboard)/email-sequences/page.tsx`

---

## Honesty gates (confirmed)

| Gate | Behavior |
|------|----------|
| Missing Resend | No `sent` rows; enroll OK; `first_send` / send-next **503** `NOT_CONFIGURED` |
| Missing cron secret | send-due **503** `CRON_NOT_CONFIGURED`; due stay queued |
| Marketing consent | Honored; now stops enrollment (no cron skip spam) |
| Soft-lock / dealership | Mutations via `requireDealershipAccess`; queries scoped by `dealership_id` |
| Worker cron | `worker.ts` hits send-due when `CRM_CRON_SECRET` or `SOCIAL_CRON_SECRET` set; skipped when unset |

---

## Surfaces covered

- `/email-sequences` — templates, enrollments, amber placeholder  
- Lead drawer → `LeadEmailSequencePanel` — enroll / send next (disabled) / stop  
- APIs: sequences CRUD ensure-default, enrollments, send-next, stop, send-due, process-due  
- Integrations link + sidebar Sales → Email sequences  

---

## Deferred / integrator

| Item | Note |
|------|------|
| CF redeploy | Required for process-due GET + consent-stop + banner gate to go live |
| Real Resend + cron secrets | Operator `wrangler secret put` when ready — do **not** put dummy keys |
| Live tip | Unchanged this lane (no deploy) |

---

## Signoff

**Lane 14 PASS** for deepest QA of email sequence enroll / send-due / placeholders.  
No fake sends. Floors intact. Fixes local only — **no CF deploy** this lane.
