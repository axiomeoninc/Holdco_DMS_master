# Wave M1 Desk Signoff — Deal pipeline + CRM desk

**Stamp:** 2026-08-04  
**Wave:** M1 — Desk & pipeline  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Stack:** Next.js + Supabase + Cloudflare Workers (locked)  
**Deploy:** **Skipped** (M0 owns CF deploy)  
**Marketing honesty:** No invented Hillz/customer rows; Resend drip never fakes sent

---

## Floors (untouched by this wave)

| Table | Floor | This wave |
|-------|------:|-----------|
| vehicles | ≥158 | Untouched |
| sales_deals | ≥77 | Read/write UX only — no seed invent |
| invoices | ≥71 | Untouched (M0/M3) |

---

## Delivered

| Item | Status | Notes |
|------|--------|-------|
| Deal kanban **drag** | Shipped | `DealsKanban.tsx` — native HTML5 DnD; PATCH `deal_status` |
| `/deals/[id]` detail | Shipped | Full page: status chips, pricing/F&I, BOS + F&I worksheet links |
| `/deals/new` Steps 2–5 | Shipped | Trade-in value, F&I product toggles, warranty, commission %, financed estimate |
| Lead score persist | Shipped | `score` + `temperature` on create/PATCH; migration SQL additive |
| Score + assignee filters | Shipped | Leads toolbar: Hot/Warm/Cold + assignee (Admin/Manager) |
| Lead → deal convert | Shipped | `POST /api/leads/[id]/convert` + drawer CTA; wizard fallback if no vehicle/price |
| Log call | Shipped | `POST /api/leads/[id]/log-call` — bumps engagement + re-scores |
| CRM email due-send | Shipped | `POST /api/email-sequences/send-due` + worker hourly cron hook |
| Resend degrade | Honored | Missing secrets → 503 / no fake sent (existing Lane C path + cron) |
| `tsc --noEmit` | **PASS** | |

---

## App surfaces

- `/deals` — kanban drag between Negotiation / Down Payment / Finance / Paid Off / Cancelled; card click → detail
- `/deals/[id]` — dedicated deal desk page
- `/deals/new` — deepened wizard; supports `?lead_id=&customer_id=&vehicle_id=`
- `/leads` — score + assignee filters; drawer: Convert / Log call / Email sequence (Lane C)

### APIs

- `PATCH /api/deals/[id]` — accepts `deal_status` (kanban) + F&I / commission fields
- `POST /api/deals` — cash customer optional; trade-in / F&I / commission
- `POST /api/leads/[id]/convert`
- `POST /api/leads/[id]/log-call`
- `POST|GET /api/email-sequences/send-due` — cron auth via `CRM_CRON_SECRET` or `SOCIAL_CRON_SECRET`

### Migration

- SQL: `src/app/supabase/migrations/wave_m1_desk_pipeline.sql`
- Columns: `leads.score`, `leads.temperature`, `leads.converted_deal_id`; deal commission + F&I IF NOT EXISTS
- Apply: **Applied** to project `zwfeitodxikdwymkieai` via Management API (201) on 2026-08-04

### Worker

- `src/worker.ts` scheduled: social publish-scheduled **and** CRM send-due
- `wrangler.toml` comments document `CRM_CRON_SECRET` (optional fallback to `SOCIAL_CRON_SECRET`)

---

## Secrets (names only)

| Secret | Role |
|--------|------|
| `RESEND_API_KEY` / `EMAIL_FROM` | Live sequence sends |
| `CRM_CRON_SECRET` or `SOCIAL_CRON_SECRET` | Authorize send-due + social cron |

Without Resend: send-due returns 503; enrollments stay queued; UI Send next stays honest.

---

## Explicitly not this wave

- CF production deploy (M0)
- Inventory bulk / VDP print (M2)
- Invoice PDF / AR / notifications (M3)
- SMS transport

---

## Files touched (primary)

- `src/components/DealsKanban.tsx` (new)
- `src/app/(dashboard)/deals/page.tsx`
- `src/app/(dashboard)/deals/[id]/page.tsx` (new)
- `src/app/(dashboard)/deals/new/page.tsx`
- `src/app/api/deals/route.ts`
- `src/app/api/deals/[id]/route.ts`
- `src/app/(dashboard)/leads/page.tsx`
- `src/components/LeadDetailsModal.tsx`
- `src/app/api/leads/[id]/convert/route.ts` (new)
- `src/app/api/leads/[id]/log-call/route.ts` (new)
- `src/app/api/email-sequences/send-due/route.ts` (new)
- `src/app/supabase/migrations/wave_m1_desk_pipeline.sql` (new)
- `src/worker.ts`
- `wrangler.toml`
- `migration/_sync_audit/WAVE_M1_DESK_SIGNOFF.md` (this file)

---

## Verification

```bash
npx tsc --noEmit   # PASS
```

CF deploy: deferred to M0.
