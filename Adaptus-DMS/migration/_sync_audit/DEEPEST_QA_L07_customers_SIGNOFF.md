# DEEPEST QA L07 — Customers (360 / merge / consent / duplicates)

**Stamp:** 2026-08-04T06:50:00-07:00  
**App:** Adaptus-DMS → live https://app.flashfender.com (worker `flashfender-dms`)  
**Plan:** `deepest_qa_20_swarm` Lane 07 ONLY  
**Dealership (Nova):** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Auth smoke:** QA Admin `f02_test_adaptus@adaptusgroup.ca` (password not recorded)  
**CF deploy:** **None** (integrator owns redeploy)  
**Floors:** untouched (read-only smoke; no merge POST / no delete)

---

## Verdict

**PASS (local fixes pending CF tip)** — Live customers list/detail/duplicates APIs healthy. Local tree fixed 360 gaps, CASL consent hardening, merge FK/consent completeness, and delete safety. Redeploy required before `/api/customers/[id]/related` and UI changes are live.

---

## Scope exercised

| Surface | Result | Notes |
|---|---|---|
| `GET /api/customers?limit=3` | **PASS** live | count **191**; sample Active; consent flags present |
| `GET /api/customers/:id` | **PASS** live | consent `false/false`, status Active |
| `GET /api/customers/duplicates` | **PASS** live | **4** groups; first reason `same phone` |
| `GET /customers` page | **PASS** live | 200 |
| `GET /customers/:id` page | **PASS** live | 200 (thin live UI; enriched locally) |
| `GET /api/customers/:id/related` | **N/A live** | 404 on current tip — **added locally** |
| Merge POST | **Code review only** | Not exercised (would mutate CRM) |
| Consent PATCH forge timestamps | **Fixed locally** | timestamps no longer client-writable |

---

## Bugs found + fixed (local)

| # | Severity | Bug | Fix |
|---|---|---|---|
| 1 | High | Customer “360” was contact-only (no consent, status/source, or related deals/leads/invoices/TD/FU) | Detail page + drawer show profile, CASL badges, related activity; new `GET /api/customers/[id]/related` |
| 2 | High | Client could send `marketing_consent_at` / `sms_consent_at` on create/update (forge CASL stamp) | Removed from create/update field whitelist; server stamps via `applyConsentTimestamps` only |
| 3 | High | Merge dropped true consent when keep lacked it; missed BOS + email enrollments FKs | Merge ORs consent (earliest `*_at`); reassigns `bill_of_sale` + `email_sequence_enrollments` |
| 4 | Medium | Hard DELETE only blocked on `sales_deals` — invoices/leads/etc. could orphan or fail | DELETE blocks when deals, invoices, leads, quotations, test drives, follow-ups, or BOS exist |
| 5 | Medium | Platform-admin duplicate scan without `dealership_id` used null target | Returns **400** with clear message |
| 6 | Low | Drawer lacked full-profile link; form hid recorded consent times; export omitted consent | Full 360 CTA; form shows last-recorded stamps; Excel export includes consent columns |

**Redeploy needed:** yes (integrator).

---

## Deferred

| Item | Reason |
|---|---|
| Live merge POST | Would soft-delete CRM rows; code-reviewed + unit of logic fixed only |
| Consent IP columns on all envs | Already degrades if `wave_m3_money.sql` columns missing |
| `company` customer column | Not in schema; left out of merge fill / 360 profile |

---

## Files touched

- `src/app/api/customers/[id]/related/route.ts` *(new)*
- `src/app/api/customers/[id]/route.ts`
- `src/app/api/customers/route.ts`
- `src/app/api/customers/merge/route.ts`
- `src/app/api/customers/duplicates/route.ts`
- `src/app/(dashboard)/customers/[id]/page.tsx`
- `src/app/(dashboard)/customers/page.tsx`
- `src/components/CustomerDetailsModal.tsx`
- `src/components/CustomerFormModal.tsx`

---

## Signoff

Lane 07 complete. No CF deploy performed. Integrator should include these fixes in the swarm tip before master signoff.
