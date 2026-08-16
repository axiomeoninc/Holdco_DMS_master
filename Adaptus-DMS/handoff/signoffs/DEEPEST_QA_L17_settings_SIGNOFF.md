# DEEPEST QA L17 — Settings (business / integrations / website / billing honesty)

**Stamp:** 2026-08-04T06:45:00-07:00 (Pacific)  
**Lane:** 17 — Settings  
**Plan:** `deepest_qa_20_swarm`  
**App:** Adaptus-DMS → live https://app.flashfender.com · worker `flashfender-dms`  
**Nova:** `dd404bb6-3e64-43ae-9eb7-98095033c6cb`  
**Method:** Static review of settings routes + authenticated HTTP smoke (Admin + Salesperson). Fix-on-fly in local tree. **No CF deploy** (per lane brief).  
**Artifact:** `migration/_sync_audit/deepest_qa_l17_probe.json`  
**Auth:** QA Admin `f02_test_adaptus@adaptusgroup.ca` + Salesperson `f02_qa_salesperson@adaptusgroup.ca` (passwords not recorded).

---

## Verdict

**PASS (local fixes pending redeploy)** — Live surfaces respond; integration status is honest (Resend/Meta missing_env); website embed + public inventory scoping OK; billing/subscription honesty bugs fixed locally. Salesperson business-settings 404 fixed in tree (needs tip update). Floors intact.

---

## Floors (read-only)

| Table | Floor | Live count | OK |
|-------|------:|-----------:|:--:|
| vehicles | ≥158 | **158** | yes |
| sales_deals | ≥77 | **78** | yes |
| invoices | ≥71 | **72** | yes |

---

## Matrix

| Area | Live | Local after fix | Notes |
|------|------|-----------------|-------|
| `/settings/business` + `/api/settings/business` | Admin **200** / `can_edit: true` | Salesperson read via `supabaseAdmin` scoped to own `dealership_id` | Live Salesperson still **404** until redeploy (RLS blocked JWT read of `dealerships`) |
| `/settings/integrations` + API | **200** · 5 rows | AutoTrader copy → Business settings UI | Resend + Meta `missing_env`; CARFAX/Kijiji/AT `url_only`/`partial` — no fake “Connected” |
| `/settings/website` + `/api/embed/settings` | Admin **200** · token + snippet | Manager allowed; nav gated | Salesperson live **403** (correct). Public API unscoped **400**; bogus token **401**; Nova id scope **200** count **81** Active |
| `/embed/inventory.js` | **200** | — | Present |
| `/settings/billing` | **200** | Honesty rewrite | Removed fake edit/save + dead Contact Billing; amber “billing soon / not live Stripe” |
| `/settings/subscription` | **200** | Amber honesty banner | Self-serve plan change still disabled; mailto support |
| Unauth settings pages | Redirect → `/login?next=…` | — | All five paths |

### Integration honesty (live secrets_present)

All false: `RESEND_API_KEY`, `EMAIL_FROM`, `FACEBOOK_APP_ID/SECRET`, `SOCIAL_CRON_SECRET`, CARFAX partner keys. Matches Wave MX secrets checklist — **do not invent keys**.

---

## Bugs found + fixed (local; CF redeploy required)

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | **High** | Salesperson `/api/settings/business` → **404** (RLS hides own dealership row) while UI allows view | `business/route.ts`: `supabaseAdmin` read/write scoped to profile `dealership_id`; Salesperson still `can_edit: false` |
| 2 | **Medium** | Billing: fake Add/Edit form then failed “save”; dead Contact Billing; Edit/Trash on cards | `/settings/billing`: view-only + amber honesty + mailto CTAs only |
| 3 | **Medium** | Subscription overpromised self-serve | Amber “billing soon / operator-managed” banner |
| 4 | **Low** | Website embed nav visible to all roles; API Admin-only → Manager mismatch | Sidebar `anyOf` + Billing nav; embed API allows **Manager** |
| 5 | **Low** | AutoTrader integration notes said “settings JSON” | Point to Settings → Business; href to Business when Company ID missing |
| 6 | **Low** | Website page understated token lock | Document `embed_token_required` (operator, not self-serve) |

**CF deploy:** skipped this lane. Integrator should redeploy before claiming live Salesperson business read + Manager embed + billing UI honesty.

---

## Deferred

| Item | Reason |
|------|--------|
| Self-serve Stripe checkout / customer portal | Intentionally not live; honesty copy only |
| UI toggle for `embed_token_required` | Operator JSON flag; optional follow-up |
| Salesperson empty `effective_permissions` | Outside lane; role shortcuts cover Admin/Manager nav |
| Billing address persistence API | Not wired — contact support is the product path |

---

## Files touched

- `src/app/(dashboard)/settings/billing/page.tsx`
- `src/app/(dashboard)/settings/subscription/page.tsx`
- `src/app/(dashboard)/settings/website/page.tsx`
- `src/app/api/settings/business/route.ts`
- `src/app/api/settings/integrations/route.ts`
- `src/app/api/embed/settings/route.ts`
- `src/components/Sidebar.tsx`

---

## Signoff

**Lane 17: PASS with redeploy note** — no P0 tenant leak in public embed; billing honesty corrected; salesperson business read fixed in tree awaiting tip.

*No passwords or service-role keys in this file.*
