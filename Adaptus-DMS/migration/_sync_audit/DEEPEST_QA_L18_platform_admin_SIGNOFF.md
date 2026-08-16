# DEEPEST QA L18 — Platform admin (dealerships / flags / audit / subscription links)

**Stamp:** 2026-08-04 (Pacific)  
**Lane:** 18 / 20 — `deepest_qa_20_swarm`  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com  
**Method:** Static review of platform + dealership APIs/pages + authenticated HTTP smoke (read-only). Fix-on-the-fly in local tree. **No CF deploy** (integrator owns tip).  
**Auth:** Platform QA `f02_test_adaptus@adaptusgroup.ca`; salesperson `f02_qa_salesperson@adaptusgroup.ca` (passwords not recorded).  
**Artifact:** `migration/_sync_audit/l18_platform_smoke.json` (workspace root)

---

## Verdict

**PASS (local fixes; live still pre-fix tip)** — Platform surfaces respond; salesperson/unauth isolation holds; floors intact. List filters + dealer subscription access were broken and are fixed locally pending redeploy.

---

## Scope exercised

| Surface | Result |
|---------|--------|
| `/dealerships` + `/api/dealerships` | Live **200** (4 tenants); filters/subscription join **broken on live**, **fixed locally** |
| `/dealerships/[id]/users` + users by `dealership_id` | **200** (Nova users 6) |
| `/platform/feature-flags` + API | **200** (10 flags); toggle path code-reviewed |
| `/platform/audit-logs` + API | **200** (count 4); free-text search was dead UI — **fixed locally** |
| `/platform/subscriptions` + API | **200** (1 row); sidebar + platform settings quick link → `/platform/subscriptions` |
| `/settings/subscription` | Dealer nav link; was **403** for non-platform via dealership GET — **fixed locally** |
| `/settings/platform` | **200**; Subscriptions quick link correct |
| `/platform/analytics`, login-history | **200** |
| Salesperson platform APIs | All **403** |
| Unauth platform/dealerships APIs | **401** |

---

## Floors (read-only)

| Table | Floor | Live count | OK |
|-------|------:|-----------:|:--:|
| vehicles | ≥158 | 158 | yes |
| sales_deals | ≥77 | 78 | yes |
| invoices | ≥71 | 72 | yes |

---

## Bugs found + fixed (local)

| Bug | Severity | Fix |
|-----|----------|-----|
| `GET /api/dealerships` ignored `status` / `q` (UI filters no-ops); no `subscription` on list rows (Plan column always “No Plan”) | High | Apply status + sanitized `ilike` search; join page subscriptions + scoped user counts |
| `GET /api/dealerships/[id]` platform-admin-only → `/settings/subscription` **403** for dealers | High | Allow own-`dealership_id` read; billing_information still platform-admin-only |
| `GET …/subscription` same 403 for own tenant | Medium | Same own-tenant gate; PATCH remains platform admin |
| Dealership edit modal showed plan only on add; edit never PATCH’d subscription | Medium | Plan select on edit + `PATCH /api/dealerships/[id]/subscription` |
| Audit logs search box never sent to API | Low | Wire free-text into `action` query (alongside action filter) |
| Platform-admin with no home dealership got opaque error on `/settings/subscription` | Low | Honest message + link to `/platform/subscriptions` |
| Dead imports (`apiFetch` / unused icons) on platform pages / modal | Nit | Removed |

**CF redeploy needed:** yes (integrator) — live still ignores list filters and blocks dealer subscription detail.

---

## Subscription link matrix

| From | Href | Status |
|------|------|--------|
| Platform sidebar | `/platform/subscriptions` | Correct |
| Dealer settings sidebar | `/settings/subscription` | Correct route; API access fixed locally |
| Platform settings quick link | `/platform/subscriptions` | Correct (prior Wave MX wrong-link regression already addressed) |
| Billing page | `/settings/subscription` | Correct |

---

## Auth / isolation

- Platform admin QA: `is_platform_admin=true`; all L18 APIs **200**.
- Salesperson: dealerships + feature-flags + audit + subscriptions + analytics **403**.
- Unauthenticated: **401**.
- Cross-tenant: salesperson cannot list dealerships; own Nova dealership detail allowed only after local fix (live still 403).

---

## Deferred

| Item | Reason |
|------|--------|
| Live tip still without L18 fixes | Explicit **No CF deploy** for this lane |
| Impersonate / reset-password deep mutate | Out of read-only smoke; gated platform-admin pages **200**, not exercised destructively |
| B-QA dealerships without subscription rows | Data (3 of 4); list join will show empty plan until rows exist — not a crash |
| Feature-flag create UI | API POST exists; page is toggle-only — acceptable |

---

## Files touched

- `src/app/api/dealerships/route.ts`
- `src/app/api/dealerships/[id]/route.ts`
- `src/app/api/dealerships/[id]/subscription/route.ts`
- `src/components/DealershipModal.tsx`
- `src/app/(dashboard)/platform/audit-logs/page.tsx`
- `src/app/(dashboard)/platform/feature-flags/page.tsx`
- `src/app/(dashboard)/platform/subscriptions/page.tsx`
- `src/app/(dashboard)/settings/subscription/page.tsx`

---

## Signoff

Lane 18 complete. Integrator: merge, `tsc`, CF redeploy, then re-smoke dealerships `?status=` / `?q=` and salesperson `GET /api/dealerships/{nova}`.
