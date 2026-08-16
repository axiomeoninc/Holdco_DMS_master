# DEEPEST QA L19 — Comms compliance signoff

**Stamp:** 2026-08-04T06:41:00-07:00  
**Lane:** 19 — Notifications bell · Unsubscribe write · SMS 501 honesty  
**Plan:** `deepest_qa_20_swarm`  
**App:** Adaptus-DMS · live https://app.flashfender.com · worker `flashfender-dms`  
**Supabase:** `zwfeitodxikdwymkieai` · Nova: `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**CF deploy this lane:** **NONE** (per lane brief — local fixes only; integrator redeploys if needed)  
**Local git tip:** `e1909a893ce8a096419f9535a932b0d07a058020` (uncommitted L19 fixes in working tree)

---

## Verdict

**PASS (local fixes applied; live tip still prior Wave MX until integrator deploy)**

Bell feed, CASL unsubscribe write, and SMS stub are honest and scoped. Cross-tenant bell leak for platform-admins-without-dealership closed in local tree. SMS ownership gate + clearer 501 payload. List-Unsubscribe headers wired for when Resend is configured.

---

## Live smoke (public / unauth)

| Probe | Result |
|-------|--------|
| `GET /unsubscribe` | **200** · page copy includes Unsubscribe + CASL |
| `GET /unsubscribe?token=invalid-smoke-token` | **200** (form; no false success) |
| `POST /api/unsubscribe` email-only (`qa-l19-smoke@example.com`) | **200** · `success:true`, `updated:0`, honest “If this email is on file…” |
| `POST /api/unsubscribe` + bad token | **403** · `Invalid unsubscribe token. Use the link from your marketing email.` |
| `GET /api/notifications` unauth | **401** |
| `POST /api/sms/send` unauth | **401** |

Authenticated Nova bell (`unread` with real due items) previously **PASS** on Wave MX tip `6bb49eb3-…` — not re-auth’d this lane (no credential invent / no CF redeploy).

---

## Static matrix

| Area | Result | Notes |
|------|--------|-------|
| Notifications API | **PASS** (fixed) | Dealership-scoped invoices + follow-ups + tasks; empty when no `dealership_id` (no all-tenant platform-admin scan) |
| TopHeader bell | **PASS** (fixed) | Real `/api/notifications` feed; empty = “No due items”; subtitle lists follow-ups, tasks, overdue invoices |
| Unsubscribe page + API | **PASS** | Public middleware paths; HMAC token preferred; email-only rate-limited; clears `marketing_consent` + `sms_consent` (+ stamp cols when migrated) |
| Email footer / List-Unsubscribe | **PASS** (fixed) | Sequence HTML footer + `List-Unsubscribe` / `List-Unsubscribe-Post` when Resend sends |
| SMS send stub | **PASS** (fixed) | Auth → ownership → CASL consent → **501** `SMS_NOT_CONFIGURED` / `sent:false` — never fakes a send |
| Customer SMS consent UI | **PASS** (fixed) | Explicit “SMS transport is not configured yet (send API returns 501)” |
| No SMS UI send button | **PASS** | No client caller of `/api/sms/send` |

---

## Bugs found + fixed (local)

| Bug | Severity | Fix | Deployed |
|-----|----------|-----|----------|
| Platform admin notifications scanned all dealerships when `dealership_id` null | High (tenant isolation) | Always require `profile.dealership_id`; else `{ data:[], unread:0 }` | **no** — awaiting integrator CF |
| SMS stub lacked `assertOwnership` | Medium | Ownership check before consent / 501 | no |
| SMS 501 payload ambiguous | Low | Clarify “no message was sent”; `sent:false` | no |
| Consent UI implied SMS send exists | Low | Honest 501 copy on CustomerFormModal | no |
| Bell subtitle omitted invoices | Low | Subtitle updated | no |
| Unsubscribe success omitted SMS preference + transport honesty | Low | Message + page copy updated | no |
| Marketing emails lacked `List-Unsubscribe` headers | Medium (CASL) | `resend.ts` + email-sequences pass URL | no |

---

## Honesty posture (locked)

| Claim | Posture |
|-------|---------|
| Notifications | Activity feed of due FU / tasks / overdue invoices — not a fake unread stub |
| Unsubscribe | Preference **write** works; transactional may continue; SMS marketing consent cleared even though SMS transport is off |
| SMS | **Do not claim** delivery — API **501** `SMS_NOT_CONFIGURED` after consent gate |
| Resend | Still blocked until secrets; List-Unsubscribe ready when configured |

---

## Files touched

- `src/app/api/notifications/route.ts`
- `src/app/api/sms/send/route.ts`
- `src/app/api/unsubscribe/route.ts`
- `src/app/unsubscribe/UnsubscribeClient.tsx`
- `src/components/TopHeader.tsx`
- `src/components/CustomerFormModal.tsx`
- `src/lib/resend.ts`
- `src/lib/crm/email-sequences.ts`

---

## Integrator notes

1. **Redeploy CF** required for L19 fixes to hit live tip (lane did **not** deploy).  
2. Floors untouched (read-only probes; no customer writes with real Nova emails).  
3. Contested files: `TopHeader.tsx`, `resend.ts`, `email-sequences.ts` — re-read before merge if other lanes edited same.
