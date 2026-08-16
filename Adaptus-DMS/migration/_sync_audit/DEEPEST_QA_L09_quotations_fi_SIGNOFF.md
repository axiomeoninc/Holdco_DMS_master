# DEEPEST QA L09 — Quotations + F&I worksheet honesty

**Stamp:** 2026-08-04  
**Lane:** 09 / 20 — `deepest_qa_20_swarm`  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com (worker `flashfender-dms`)  
**CF deploy:** **Not performed** (lane instruction)  
**Floors:** No Hillz destroy / invent — vehicles ≥158 · deals ≥77 · invoices ≥71 untouched

---

## Scope

| Path | Focus |
|------|--------|
| `/quotations` + `/api/quotations*` | CRUD, convert, send honesty |
| `/finance` + `/api/finance-calculations` | Worksheet estimate honesty, save scoping |

---

## Verdict

**PASS (local fixes; live tip unchanged until integrator CF redeploy)**

Unauth smoke against live: pages **307** → login; APIs **401**. Code review + fix-on-fly for honesty/UX bugs. New send route and UI changes are **local only** until Phase B deploy.

---

## Findings + fixes

| # | Severity | Issue | Fix |
|---|----------|--------|-----|
| 1 | **P0** | Row click / Enter on any quote auto-ran **Convert** (no confirm) — accidental deals | Removed row convert; convert only via action button + `confirm()`; post-convert navigates to `/deals/[id]` |
| 2 | **P1** | “Mark sent” looked like email; no Resend path; risk of fake-send UX | Amber honesty banner; Mark as Sent toast says **status only**; added `POST /api/quotations/[id]/send` with **503** when Resend missing (does not flip status on failure) |
| 3 | **P2** | WAVE_C expected Copy share; missing | Copy quote summary via `buildQuotationShareText` |
| 4 | **P2** | Quote monthly estimate duplicated local math vs F&I | Reuses `computePayment` from `finance-calc` |
| 5 | **P2** | `/finance` disclaimer only in print text | On-page amber estimate disclaimer; Back to deal uses `deal_id` |
| 6 | **P2** | `finance-calculations` POST allowed null dealership; `any` types | Require `dealership_id`; whitelist + payment_type validation; GET scopes platform admin with home dealership |
| 7 | **P2** | Quotation POST could insert with null `dealership_id` for platform admin without store | Require dealership context on create |

---

## Honesty matrix

| Action | Behavior |
|--------|----------|
| Email quote | Calls Resend; **503** + clear message if `RESEND_API_KEY` / `EMAIL_FROM` missing; status unchanged on failure |
| Mark as Sent | PATCH status only; UI/title/toast state no email was sent |
| Copy | Clipboard estimate text; includes “not a binding offer” + Resend note |
| Convert | Confirm → creates `sales_deals` + marks Converted; blocked without customer/vehicle |
| F&I worksheet | Client-side estimate; print/CSV/copy include lender/disclosure caveat; Save writes `finance_calculations` for current dealership |

---

## Verification

- Static review of quotations APIs, convert, new send route, finance page, finance-calculations
- `npx tsc --noEmit` — **no errors in L09 files** (pre-existing unrelated error in `customers/[id]/related/route.ts`)
- Live unauth: `/quotations` `/finance` **307**; `/api/quotations` `/api/finance-calculations` **401**
- Authenticated write smoke: **skipped** (no CF deploy; avoid inventing Nova quote/deal rows)

---

## Files touched

- `src/lib/quotation-share.ts` (**new**)
- `src/app/api/quotations/[id]/send/route.ts` (**new**)
- `src/app/api/quotations/route.ts`
- `src/app/(dashboard)/quotations/page.tsx`
- `src/app/(dashboard)/finance/page.tsx`
- `src/app/api/finance-calculations/route.ts`
- `migration/_sync_audit/DEEPEST_QA_L09_quotations_fi_SIGNOFF.md` (this file)

---

## Remaining / integrator notes

- **CF redeploy required** for send route + UI honesty to appear on `app.flashfender.com`
- Resend still operator-owned (`SECRETS_OPS_STATUS.md`) — do not invent keys
- Empty Nova quotations table is OK (empty ≠ fail)
- Does not claim lender network / e-contract / full Ontario disclosure suite

**Lane L09: PASS for local honesty + convert safety. Awaiting integrator merge + optional CF tip update.**
