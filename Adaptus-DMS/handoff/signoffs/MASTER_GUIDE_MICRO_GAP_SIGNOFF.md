# Master Guide Micro-Gap Signoff

**Stamp:** 2026-08-04  
**Scope:** Consolidate Master Build Guide vs live FlashFender/AdaptUs DMS micro-gap analysis only.  
**Waves M0–M3:** Documented below — **not executed** in this signoff pass.  
**Stack lock:** Keep Next.js + Supabase + Cloudflare Workers. Do **not** migrate to Prisma 5 / NextAuth v5 / Redis / Ubuntu systemd as a prerequisite.

**Plan:** `c:\Users\dchat\.cursor\plans\master_guide_micro_gaps_ef669d4b.plan.md`  
**Swarm (2026-08-04):** inventory, CRM, finance, platform agents + Phase 2 Lane B Ontario done.

**Prior signoffs cited:**
- [`ADAPTUS_MASTER_GUIDE_SIGNOFF.md`](../../../../migration/_sync_audit/ADAPTUS_MASTER_GUIDE_SIGNOFF.md) (workspace mirror) — P6 campaign; infra rewrite deferred
- [`PHASE2_LANE_A_SYNDICATION_SIGNOFF.md`](./PHASE2_LANE_A_SYNDICATION_SIGNOFF.md) — AutoTrader feed local; deploy skipped
- [`PHASE2_LANE_B_ONTARIO_SIGNOFF.md`](./PHASE2_LANE_B_ONTARIO_SIGNOFF.md) — MVDA/UCDA BOS harden local
- [`PHASE2_LANE_C_CRM_EMAIL_SIGNOFF.md`](./PHASE2_LANE_C_CRM_EMAIL_SIGNOFF.md) — email sequence UI+API local; deploy skipped
- [`SECRETS_OPS_STATUS.md`](./SECRETS_OPS_STATUS.md) — Resend/Meta operator secrets
- [`UCDA_BOS_FIELD_MATRIX.md`](./UCDA_BOS_FIELD_MATRIX.md)

**Floors (do not invent Hillz / production rows):** vehicles ≥158 · sales_deals ≥77 · invoices ≥71 (same protected floors as prior Phase 2 / Master Guide signoffs).

**Mirror:** Also at workspace `migration/_sync_audit/MASTER_GUIDE_MICRO_GAP_SIGNOFF.md`.

---

## Corrections vs early draft

| Topic | Corrected status |
|-------|------------------|
| Lead kanban + drag | **Present** (`LeadsKanban.tsx`) — deepen stages/score filters only |
| Deal kanban | **Display-only** — no drag; `/deals/[id]` Missing |
| CRM email sequences | **UI+API Present** (Phase 2 Lane C). Live drip needs Resend secrets; due-cron may still be thin |
| Inventory est. income | Present; **cost column** on list still Missing |
| Phase 2 A / B / C | Code **local** at start of M0 — **CF deploy still pending** |

---

## Guide vs live — matrix summary

| Guide area | Live | Notes |
|------------|------|-------|
| Shell Sales/Inventory/Customers/Financial/Marketing/Management/Settings | Present | Extra: Gallery, Vendors, Finance, Tools, Roles |
| Brand Blue / Calm Ops `#2563EB` + Inter | Present | Adopt Guide product depth on current libs |
| Inventory list + 5-step intake + VDP | Present / Partial | Bulk, advanced filters UI, cost col, print sticker Missing/Partial |
| Leads / customers / merge / TD / FU / deals / quotes | Present | Mostly modal CRUD vs full Guide pages |
| Lead kanban drag | **Present** | Correction |
| BOS + payments | Partial→Improved | Waves A/B + Ontario Lane B |
| Invoices / expenses / vendors / reports CSV | Present CRUD | P0: reports scoping, expense dates, invoice tax/package |
| `/finance` worksheet + Desk F&I | Present | Wave C |
| Social Meta drafts + Integrations | Partial | Secrets blocked |
| Website embed + SaaS trial soft-lock | Present | |
| Kijiji/AutoTrader export packs | Partial MVP | Phase 2 A may extend; deploy pending |
| `/settings/business` + integrations | Present | |
| `/customers/[id]` | Present | 360 tabs Partial |
| Notifications bell | Stub | Empty + fake unread |
| Unsubscribe preference write | Stub | CASL incomplete |
| Billing/subscription | Stub | Simulated save; orphaned from nav |
| SMS | Stub (501) | |
| Infra: Prisma / Redis / NextAuth v5 / Ubuntu | **Rejected** | Same as prior Master Guide signoff |

**Stronger than Guide assumed:** lead kanban drag, tasks/tickets kanban, unlinked deal queue, customer merge, BOS print + Ontario/MVDA, Kijiji/AutoTrader packs, F&I worksheet, VIN NHTSA decode, intake draft resume, photo roles in wizard.

---

## Swarm Top 20 dealer-day gaps

| # | Gap | Domain | Status |
|---|-----|--------|--------|
| 1 | Reports API missing `dealership_id` + expenses report ignores dates | Finance | Partial/Risk |
| 2 | Invoice POST drops `tax_rate` / `package_name` | Finance | Partial |
| 3 | Inventory bulk select (status/delete/syndicate) | Inventory | Missing |
| 4 | List advanced filters UI (API already has make/year/price) | Inventory | Partial |
| 5 | CRM email due-send automation / Resend secrets for live drip | CRM | Partial (UI shipped Lane C) |
| 6 | Lead score not persisted / not filterable | CRM | Partial |
| 7 | Customer 360 related deals/leads/FU/TD | CRM | Partial |
| 8 | Quote PDF/print/email | CRM | Missing |
| 9 | Deal `/deals/[id]` page + kanban drag | Deals | Missing/Partial |
| 10 | Lead → Deal one-click convert | CRM | Missing |
| 11 | Notifications bell stub | Platform | Stub |
| 12 | Unsubscribe no preference write | Platform | Stub |
| 13 | Billing/subscription simulated save | Platform | Stub |
| 14 | Window sticker / inventory print | Inventory | Missing |
| 15 | Reminder delivery (tasks/FU store only) | CRM | Partial |
| 16 | Invoice PDF + AR payment ledger | Finance | Missing |
| 17 | Commissions / salesperson performance report | Finance | Missing |
| 18 | SMS transport (501) | Platform | Stub |
| 19 | Purchases edit/search/delete | Inventory | Missing |
| 20 | Feature flags never consumed at runtime | Platform | Partial |

Full module micro-matrices: plan §§ Dashboard–Compliance.

---

## Suggested waves (product only — not started here)

### M0 — Integrity P0 (1–3 days)
1. Reports `dealership_id` scoping + expenses date filter  
2. Invoice create `tax_rate` / `package_name` (+ line_items if schema allows)  
3. Operator secrets (Resend/Meta) per `SECRETS_OPS_STATUS.md`  
4. **Deploy Phase 2 A/B/C** (still local vs Wave C tip at M0 start)

### M1 — Desk & pipeline
Deal kanban drag + `/deals/[id]`; deepen `/deals/new` Steps 2–5; persist lead score + filters; lead→deal convert; harden email due-cron + Resend for live drip.

### M2 — Inventory merch
Bulk select + advanced filter UI + cost column; export/aging/sort polish; VDP photo roles + print sticker; purchases search/edit/delete.

### M3 — Money & compliance
Invoice PDF + AR; salesperson/commissions light; CASL unsubscribe write + real notifications; fix dead billing / fake settings saves.

### M4+ (defer)
Campaigns / SMS / e-sign / full GL — only after M1–M3 and paying demand.

**Explicitly not suggested:** Prisma/Redis/NextAuth/Ubuntu rewrite; service/parts OEM; BHPH full servicing; Chrome marketplace bots; overclaiming Kijiji auto-list before partner API.

---

## Marketing honesty notes

| Claim area | Honest posture |
|------------|----------------|
| Email follow-ups | “When configured” (Resend) — Lane C UI shipped; **not** live drip until secrets + deploy |
| SMS | Do **not** claim — 501 / out of scope |
| Syndication | AutoTrader/Kijiji **export packs / feed artifacts** — not partner auto-list API |
| Ontario / MVDA | Disclosure + BOS fields when configured — Lane B local until CF deploy |
| Notifications | Bell stub on **live (Wave C)**; **local** activity feed (due FU/tasks/invoices) — pending CF redeploy |
| Billing / Stripe | Simulated on **live**; **local** honesty (no fake save / dead card buttons) — pending CF redeploy |
| Hillz / inventory counts | Use verified floors only; **no invented VINs, customers, or gallery rows** |

FlashFender marketing (`websites/flashfender.com`) should stay aligned with Phase 2 Lane C copy sync: email when configured; no SMS claim.

---

## Verdict

**Signoff complete** for micro-gap consolidation. Ready to execute **Wave M0** (finance integrity + Phase 2 deploy) unless desk (M1) is chosen first. This file does **not** claim M0–M3 shipped.
