# Wave C Signoff — Competitive Core

**Stamp:** 2026-08-04 (local implementation)  
**Dealership floor:** vehicles ≥158, deals ≥77, invoices ≥71 — no deletes in this wave  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Stack:** Next.js + Supabase + Cloudflare OpenNext (`flashfender-dms`)  
**Brand accent:** Calm Ops Blue `#2563EB`

---

## Floors

| Table | Floor | This wave |
|-------|------:|-----------|
| vehicles | ≥158 | Carfax attach / syndication pack only; no purge |
| sales_deals | ≥77 | F&I desk link only; no deal deletes |
| invoices | ≥71 | Untouched |

No invented customers / Hillz rows.

---

## Delivered

| Item | Status | What works without secrets | Needs env |
|------|--------|----------------------------|-----------|
| **CARFAX deepen** | Shipped | PDF upload + attach; VDP `CarfaxPanel`; intake hint | `CARFAX_PARTNER_ID` → VHR link attach; `CARFAX_API_KEY` + `CARFAX_API_URL` → partner API fetch |
| **Quotations polish** | Shipped | Create, empty-state CTA, copy share text, mailto stub, convert-to-deal (explicit action) | Resend still separate for transactional mail; mailto works offline |
| **F&I desking** | Shipped | `/finance` tax/term/rate worksheet; print / copy / CSV; deal row → Desk F&I with prefill | None |
| **Social Meta readiness** | Wired | Drafts + Integrations status (oauth / page connected) | `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`; optional `FACEBOOK_REDIRECT_URI`, `SOCIAL_CRON_SECRET` for scheduled cron |
| **Kijiji listing pack** | Shipped | VDP copy text / JSON / CSV via `/api/vehicles/[id]/syndication` | None (honest MVP — no Kijiji API) |

---

## Required secrets (document for ops)

Set on Worker via `wrangler secret put` (never commit):

| Secret | Used by |
|--------|---------|
| `FACEBOOK_APP_ID` | Meta OAuth start |
| `FACEBOOK_APP_SECRET` | OAuth + state HMAC |
| `FACEBOOK_REDIRECT_URI` | Optional override (default `{origin}/api/social/facebook/callback`) |
| `SOCIAL_CRON_SECRET` | `/api/social/publish-scheduled` cron auth |
| `CARFAX_PARTNER_ID` | Canada VHR deep-link attach |
| `CARFAX_API_KEY` | Partner API Authorization bearer |
| `CARFAX_API_URL` | Partner report endpoint (must return `report_url` / `url` / `vhr_url`) |
| `RESEND_API_KEY` / `EMAIL_FROM` | (Wave B) email — still required for live Resend |

Integrations UI: `/settings/integrations` — status only, no secret values.

---

## Deploy note

**Not deployed in this session** (sibling may deploy A+B). When ready:

```bash
cd Adaptus-DMS/Adaptus-DMS
npm run deploy:cf
```

---

## Files changed (Wave C)

**New**

- `src/lib/carfax.ts`
- `src/lib/finance-calc.ts`
- `src/lib/syndication/kijiji.ts`
- `src/components/CarfaxPanel.tsx`
- `src/components/KijijiListingPack.tsx`
- `src/app/api/vehicles/[id]/syndication/route.ts`
- `migration/_sync_audit/WAVE_C_COMPETE_SIGNOFF.md` (this file)

**Updated**

- `src/app/api/carfax/route.ts` — fetch/attach + env status
- `src/app/api/settings/integrations/route.ts` — Carfax + Meta connection + Kijiji row
- `src/app/(dashboard)/settings/integrations/page.tsx` — richer status + module links
- `src/app/(dashboard)/inventory/[vin]/page.tsx` — CarfaxPanel + Kijiji pack
- `src/app/(dashboard)/quotations/page.tsx` — empty state, share/email, convert UX
- `src/app/(dashboard)/finance/page.tsx` — printable worksheet, export, deal prefill
- `src/app/(dashboard)/deals/page.tsx` — Desk F&I action
- `src/components/VehicleIntakeWizard.tsx` — Carfax env hint

---

## Verification

- `npx tsc --noEmit` — run in this session (see agent log)
- Manual smoke after deploy:
  1. VDP → upload CARFAX PDF; without secrets, Fetch shows amber banner
  2. VDP → Kijiji → Copy text / JSON / CSV
  3. `/quotations` empty → New Quote → Copy → Convert
  4. Deal row Calculator → `/finance?...` prints worksheet
  5. `/settings/integrations` reflects Meta/Carfax/Kijiji status
  6. `/social` still drafts without Meta; connect only when APP_ID/SECRET set

---

## Out of scope (confirmed)

Service RO, full GL, e-sign, SMS campaigns, Chrome bots, Prisma rewrite, full Kijiji marketplace API.
