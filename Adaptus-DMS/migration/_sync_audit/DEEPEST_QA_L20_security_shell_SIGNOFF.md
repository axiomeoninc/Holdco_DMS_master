# DEEPEST QA L20 — Security / shell SIGNOFF

**Stamp:** 2026-08-04 (Pacific)  
**Lane:** 20 / 20 — Security / shell (middleware, permissions, tenant leak probes, nav/mobile)  
**Plan:** `deepest_qa_20_swarm_d1b2b148.plan.md`  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com · worker `flashfender-dms`  
**CF deploy this lane:** **No** (integrator owns redeploy)  
**Auth:** Platform QA `f02_test_adaptus@adaptusgroup.ca` · Salesperson `f02_qa_salesperson@adaptusgroup.ca` (passwords not recorded)  
**Probe artifact:** `migration/_sync_audit/deepest_qa_l20_security_probe.json` (+ `deepest_qa_l20_security_probe.py`)  
**Mirror:** `migration/_sync_audit/DEEPEST_QA_L20_security_shell_SIGNOFF.md`

---

## Verdict

**PASS (local fixes; live tip still pre-shell-gate)** — No cross-tenant data leaks on live list/IDOR probes. Middleware unauth redirects + API 401s hold. Shell permission holes (salesperson could open `/users`, `/dealerships`, `/platform/*` HTML) fixed in local tree. Floors intact.

---

## Floors (read-only)

| Table | Floor | Live count | OK |
|-------|------:|-----------:|:--:|
| vehicles | ≥158 | **158** | yes |
| sales_deals | ≥77 | **78** | yes |
| invoices | ≥71 | **72** | yes |

No deletes / wipes / invented Hillz rows.

---

## Tenant leak probes (critical) — live

Foreign dealership used: `9d2e9b07-83a8-4a55-b9a2-70812e18704e` (B-QA). Nova: `dd404bb6-3e64-43ae-9eb7-98095033c6cb`.

| Probe | Result |
|-------|--------|
| Admin list APIs (vehicles, customers, leads, deals, invoices, expenses, vendors, tasks, tickets, follow-ups, test-drives, quotations, purchases, social) | **PASS** — only Nova `dealership_id` in rows |
| `?dealership_id=<foreign>` on vehicles (admin + salesperson) | **PASS** — ignored; still Nova-scoped (app uses profile) |
| Salesperson purchases/social/duplicates with foreign param | **PASS** — non-platform ignores param; Nova-only / empty |
| Salesperson platform + dealerships + users APIs | **PASS** — all **403** |
| Salesperson IDOR random UUIDs (customers/deals/leads) | **PASS** — 404/403, no foreign payload |
| Salesperson Nova vehicle/customer by id | **PASS** — same-tenant 200 (expected) |
| `tenant_leak_summary` in probe JSON | **empty** — no leaked_other |

---

## Middleware / auth matrix (live)

| Check | Result |
|-------|--------|
| Unauth pages `/dashboard` `/inventory` `/users` `/dealerships` `/platform/analytics` `/settings/business` | **307** → `/login?next=…` |
| Unauth APIs `/api/me` `/api/vehicles` `/api/customers` `/api/deals` `/api/reports` | **401** |
| Public `/login` `/register` `/forgot-password` `/unsubscribe` | **200** |
| Cron `POST /api/email-sequences/send-due` (no secret) | **503** `CRON_NOT_CONFIGURED` (honest) |
| Cron `POST /api/social/publish-scheduled` (no secret) | **503** secret not configured (honest) |
| Live `/api/health` | **404** (route missing on tip) — **added locally** |

---

## Permissions / shell (live vs local)

| Issue | Severity | Live | Local fix |
|-------|----------|------|-----------|
| Salesperson HTML **200** on `/users`, `/dealerships`, `/platform/*` (API 403 only) | **High** (shell leak) | Still open on tip | Middleware redirects non-platform away from platform/dealerships shell; non-Admin away from `/users` |
| Sidebar **Users** visible to Salesperson/Manager | Medium | Tip | `roles: ["Admin"]` + `anyOf` on Users nav |
| `/dealerships` 403 bounced salesperson to **`/login`** | Medium | Tip | Redirect **`/dashboard`** on 403; login only on 401 |
| `/users` page no client gate | Medium | Tip | Non-Admin → `/dashboard` |
| Mobile bottom nav on platform-admin sessions | Low | Tip | Hide when `is_platform_admin` |
| Inventory bottom-nav active on purchases/gallery | Low | Tip | Match Sidebar sibling exclusion |
| Missing `/api/health` despite middleware allowlist | Low | Tip | Added `GET /api/health` |

---

## Role notes (not tenant leaks)

- Salesperson **vehicles = 158** (full Nova inventory) — expected.
- Salesperson **invoices = 72** (full Nova AR list) — dealership-scoped, not assigned-scoped; document for product/role review (not cross-tenant).
- Salesperson leads/deals/customers lists often **0** — assigned scoping.
- Live `GET /api/dealerships/{nova}` still **403** for salesperson with old “platform admin required” copy — L18 already fixed own-tenant read in tree; awaiting integrator deploy.

---

## Files touched (local)

- `src/middleware.ts` — platform + users shell redirects; soft-lock unchanged
- `src/components/Sidebar.tsx` — Users Admin-only nav gate (`roles`)
- `src/components/MobileBottomNav.tsx` — platform hide + inventory active
- `src/app/(dashboard)/dealerships/page.tsx` — 403 → dashboard
- `src/app/(dashboard)/users/page.tsx` — non-Admin redirect
- `src/app/api/health/route.ts` — public liveness

---

## Deferred / integrator

| Item | Reason |
|------|--------|
| CF redeploy | Explicit **No CF deploy** for this lane |
| Live tip still serves pre-gate shell HTML | Redeploy required for middleware/nav/health |
| Invoice assigned-scoping for Salesperson | Product decision; out of tenant-isolation P0 |
| Middleware fail-open if Supabase env missing | Pre-existing; document only |

---

## Success criteria (lane)

- [x] Middleware unauth + soft-lock path reviewed
- [x] Tenant leak probes run; **no leaks**
- [x] Permissions/nav/mobile gaps fixed locally
- [x] Floors preserved
- [x] Signoff written; no CF deploy

**Lane 20: PASS** — awaiting integrator merge + CF redeploy for shell gates on tip.
