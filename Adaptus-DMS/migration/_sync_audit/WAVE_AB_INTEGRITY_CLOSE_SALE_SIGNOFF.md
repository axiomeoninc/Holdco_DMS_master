# Wave A + Wave B Signoff — Integrity & Close the Sale

**Stamp:** 2026-08-04 (local implementation)  
**Dealership:** `dd404bb6-3e64-43ae-9eb7-98095033c6cb` (Nova / FlashFender)  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Stack:** Next.js + Supabase + Cloudflare OpenNext (`flashfender-dms`)

---

## Floors check

| Table | Floor | This wave |
|-------|------:|-----------|
| vehicles | ≥158 | No deletes; no inventory purge |
| sales_deals | ≥77 | Link UI only patches `customer_id`; Cash/blank left null |
| invoices | ≥71 | Untouched |

**Live count verification:** not re-queried in this session (Supabase MCP unauthenticated). Code paths do not call delete under floors. Re-confirm in dashboard or SQL before production deploy.

---

## Wave A — Integrity (shipped)

| Item | Status | Notes |
|------|--------|-------|
| `/settings/business` | Shipped | Page + `/api/settings/business` GET/PATCH (own dealership). Fields: name, business_name/address/phone/email, HST + dealer license in `settings` JSON |
| `/settings/integrations` | Shipped | Status-only UI for Resend, Meta/Facebook, CARFAX. **No secret values returned** |
| Command palette → `/customers/[id]` | Shipped | New detail page; no 404 |
| Sidebar off-nav | Shipped | Vendors, Roles, Finance calculator, Tools, Inventory Gallery — permission-gated (`anyOf` + Admin/Manager) |
| Users & Roles | Shipped | Nav split: Users → `/users`, Roles → `/roles` |
| Deal-link UX | Shipped | `/deals?unlinked=true` opens queue; Named vs All filter; worksheet hints for 5 named leftovers; Create & link; Leave cash/blank (dismiss, keep `customer_id` null) |

### Named leftovers (guidance only — do not invent)

From `QA_DEAL_RELINK.json` / worksheet:

1. JENA-LEIGH DIANNA RIETZE — `WAUSGAFC2CN002204`
2. JAGMEET JATTANA — `3VWE57BUXKM038459`
3. charan — `JN1EV7BR9PM543560`
4. sukhjit — `1G1ZE5ST0PF183610`
5. manpreet250)891-2720 — `3MW89FF03R8E57646` (phone_garbage → suggest “Manpreet”)

Staff must create/link real customers; Cash/blank stays null.

---

## Wave B — Close the sale (shipped / blocked)

| Item | Status | Notes |
|------|--------|-------|
| BOS → Mark Sold | Fixed | Deal PATCH now marks vehicle Sold on Paid Off / Closed / `close_deal`; uses `existing.vehicle_id` (PUT bug fixed). Modal surfaces deal-close errors (`deals:close`) |
| BOS PDF dealer block | Fixed | `/api/me` now returns `dealership` (business_* + settings) for PDF header |
| Purchase cost / GP | Improved | Intake shows purchase_price helper; confirm if publishing Active at $0; `purchased_from` already on intake |
| Disclosure / MVDA | Improved | Inline editable disclosure on VDP; server guard still blocks Active + known_damage without notes; save re-validates |
| Resend | Wired (env-gated) | Code paths already use `src/lib/resend.ts`. Integrations page shows configured vs missing |

### Blockers (secrets / env — do not invent)

| Secret / env | Purpose | Status |
|--------------|---------|--------|
| `RESEND_API_KEY` | OTP, reset, trial email | **Blocked until set** via `wrangler secret put RESEND_API_KEY` |
| `EMAIL_FROM` | Verified from-address | **Blocked until set** (e.g. `FlashFender <noreply@flashfender.com>`) |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Meta live publish | **Blocked** — drafts still work; Wave C for go-live |
| Carfax API productize | Auto-attach | **Out of scope** (Wave C) — URL/PDF upload remains |

---

## Deploy

CF Worker is configured (`wrangler.toml` → `flashfender-dms`, `app.flashfender.com`).

**Not deployed in this session** (production safety). When ready:

```bash
cd Adaptus-DMS/Adaptus-DMS
npm run deploy:cf
# secrets if missing:
# npx wrangler secret put RESEND_API_KEY
# npx wrangler secret put EMAIL_FROM
```

---

## Files changed (summary)

**New**

- `src/app/(dashboard)/settings/business/page.tsx`
- `src/app/(dashboard)/settings/integrations/page.tsx`
- `src/app/api/settings/business/route.ts`
- `src/app/api/settings/integrations/route.ts`
- `src/app/(dashboard)/customers/[id]/page.tsx`
- `migration/_sync_audit/WAVE_AB_INTEGRITY_CLOSE_SALE_SIGNOFF.md` (this file)

**Updated**

- `src/components/Sidebar.tsx` — off-nav + permission filter
- `src/components/LinkCustomerQueue.tsx` — named leftovers + create-then-link
- `src/components/CustomerFormModal.tsx` — `defaultName` / `onSaved`
- `src/app/(dashboard)/deals/page.tsx` — `?unlinked=true` + Suspense
- `src/components/BillOfSaleModal.tsx` — sold-path error handling
- `src/app/api/deals/[id]/route.ts` — Sold on close / vehicle_id fix
- `src/app/api/me/route.ts` — dealership object for BOS PDF
- `src/components/VehicleIntakeWizard.tsx` — purchase_price confirm + helper
- `src/app/(dashboard)/inventory/[vin]/page.tsx` — editable disclosure
- `src/lib/mvda-damage.ts` — stronger docs / warning helper

---

## Verification performed

- `npx tsc --noEmit` — **pass** after fixes
- No automated E2E against live Nova (would require auth + risk of mutating Sold vehicles)
- Manual smoke recommended after deploy:
  1. Open `/settings/business` and `/settings/integrations`
  2. ⌘K → customer → lands on `/customers/{id}`
  3. `/deals?unlinked=true` → Named tab shows 5 VINs
  4. Open BOS on a **non-production test deal** if available; confirm PDF shows dealer block
  5. Edit disclosure on an Active vehicle with known_damage

---

## Out of scope (confirmed)

Wave C/D: Carfax API productize, syndication, service RO, GL, e-sign. Prisma/NextAuth rewrite. Inventing Hillz customers/gallery/specs.
