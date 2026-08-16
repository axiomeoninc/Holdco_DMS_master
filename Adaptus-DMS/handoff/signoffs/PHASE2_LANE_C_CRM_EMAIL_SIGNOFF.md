# Phase 2 Lane C Signoff — CRM email sequences (Resend)

**Stamp:** 2026-08-04  
**Lane:** C — Resend CRM sequences  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Marketing:** `websites/flashfender.com`  
**Deploy:** **Skipped** (per campaign — no CF deploy this lane)  
**SMS:** Out of scope  
**Syndication / Ontario BOS:** Out of scope (other lanes)

---

## Floors

| Table | Floor | This lane |
|-------|------:|-----------|
| vehicles | ≥158 | Untouched |
| sales_deals | ≥77 | Untouched |
| invoices | ≥71 | Untouched |

No invented customers / Hillz rows. No API keys invented or committed.

---

## Delivered

| Item | Status | Notes |
|------|--------|-------|
| Schema | Applied | `email_sequences`, `email_sequence_steps`, `email_sequence_enrollments`, `email_sequence_sends` + RLS |
| Default template | Shipped | “Lead nurture (3-step)” — day 0 / 2 / 5; ensure via POST `/api/email-sequences` |
| Enroll / stop | Shipped | From Lead drawer + `/email-sequences`; unique active enrollment per sequence+lead |
| Send first / Send next | Shipped | Manual Send next for later steps; audit log in `email_sequence_sends` |
| Resend gate | Shipped | Missing `RESEND_API_KEY` / `EMAIL_FROM` → no fake sent; Integrations amber + UI banner |
| Soft-lock | Honored | Mutations go through `requireDealershipAccess` (402 when trial expired) |
| Marketing consent | Honored | Skips send if `customers.marketing_consent` is false |
| Marketing copy | Synced | Leads feature + product + changelog: “email follow-ups when configured”; no SMS claim |
| `tsc --noEmit` | **PASS** | |

---

## App surfaces

- `/email-sequences` — templates + recent enrollments + Resend amber banner  
- Lead Center → lead drawer → **Email sequence** panel (enroll / send next / stop)  
- `/settings/integrations` — Resend row links to Email sequences; notes cover CRM  
- Sidebar: Sales → Email sequences  

### APIs

- `GET/POST /api/email-sequences`  
- `GET /api/email-sequences/[id]`  
- `GET/POST /api/email-sequences/enrollments`  
- `POST /api/email-sequences/enrollments/[id]/send-next`  
- `POST /api/email-sequences/enrollments/[id]/stop`  

### Migration

- SQL: `src/app/supabase/migrations/phase2_crm_email_sequences.sql`  
- Apply script: `migration/scripts/apply-phase2-crm-email-sequences.mjs`  
- Applied to project `zwfeitodxikdwymkieai` via Management API (201)

---

## Secrets (names only)

| Secret | Role |
|--------|------|
| `RESEND_API_KEY` | Required for live CRM (and OTP/reset) sends |
| `EMAIL_FROM` | Verified from-address |

Set via `wrangler secret put` on `flashfender-dms`. Integrations never returns secret values.

---

## Marketing parity (claimed vs live)

| Claim | Live |
|-------|------|
| Email follow-ups / nurture when Resend configured | Yes — enroll + send path gated on env |
| Without secrets: blocked / amber, no fake sent | Yes — Integrations + sequences UI + API 503 |
| SMS sequences | **Not claimed** (out of scope) |

---

## Dual smoke (manual — app not redeployed this lane)

| Check | Expected |
|-------|----------|
| `/settings/integrations` Resend | `missing_env` or `live` matching Worker secrets |
| `/email-sequences` | Loads; amber if Resend missing |
| Lead with email + marketing consent | Enroll → first send if secrets live; else enrolled + clear error |
| Send next | Sends step 2+ or fails with Integrations message |
| Stop | Status `stopped`; no further sends |

Marketing smoke: `flashfender.com` product / changelog / leads feature copy after site deploy (not done in this lane).

---

## Out of scope (reconfirmed)

- SMS / Twilio  
- Full campaign builder / blast suite  
- Meta ads manager  
- Auto cron drip (manual Send next is acceptance-complete; `next_send_at` recorded for UX)  
- CF Worker deploy  
- Syndication (Lane A) / Ontario BOS (Lane B)

---

## Signoff

**PASS** for Lane C implementation + marketing honesty + migration apply + `tsc`.  
**Deploy deferred** until operator approves CF deploy and/or confirms Resend secrets on Worker.
