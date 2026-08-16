# Phase 2 Lane B Signoff — Ontario compliance pack

**Stamp:** 2026-08-04  
**Lane:** B only (Ontario / MVDA / UCDA-aligned BOS) — **not** Lane A syndication or Lane C CRM  
**Dealership floor context:** Nova / FlashFender (`dd404bb6-3e64-43ae-9eb7-98095033c6cb`)  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Marketing:** `websites/flashfender.com` (disclosure / Ontario honesty only)  
**Brief:** `migration/_sync_audit/PHASE2_CA_PARITY_SWARM_BRIEF.md` (Lane B)

---

## Floors check (protected)

| Table | Floor | This lane |
|-------|------:|-----------|
| vehicles | ≥158 | No deletes; no invented VINs/customers |
| sales_deals | ≥77 | Untouched |
| invoices | ≥71 | Untouched |

Fixture BOS uses **synthetic SAMPLE** dealer/purchaser/VIN only (`SAMPLEVIN…`, `example.invalid`). No production table inserts.

---

## Acceptance (Lane B)

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Active + known_damage blocked without disclosure notes | **Pass** | `mvda-damage` (case-insensitive Active); PUT/PATCH `/api/vehicles/[id]` via `mergeDamageDisclosureState`; intake + VDP |
| BOS PDF includes business_* / licence / HST when configured | **Pass** | `bos-pdf.ts` Dealership block; `BillOfSaleModal` reads `/api/me` settings (`dealer_license`, `hst_number`) |
| UCDA / Ontario field matrix documented | **Pass** | `migration/_sync_audit/UCDA_BOS_FIELD_MATRIX.md` (summary below) |
| Fixture / sample BOS path (no invent customers) | **Pass** | `migration/_sync_audit/fixtures/bos_ontario_sample.html` (+ payload JSON); regen `node scripts/generate-bos-ontario-fixture.mjs` |
| Marketing Ontario / disclosure claims honest | **Pass** | `security.astro`, `features/deals.md`, `changelog.astro` — no “certified UCDA / OMVIC” claim |
| CF deploy | **Skipped** | Per lane instructions |

---

## Field matrix (summary)

Full table: [`UCDA_BOS_FIELD_MATRIX.md`](./UCDA_BOS_FIELD_MATRIX.md)

| Block | Status |
|-------|--------|
| Dealer name/address/phone/email | Present |
| Dealer licence | Present (settings → PDF) |
| HST # | Present (Lane B) |
| Buyer / vehicle / price / tax / fees / trade-in | Present |
| Trade-in + general disclosure on PDF | Present |
| Financing schedule on PDF | Partial (modal fields; print is totals-oriented) |
| E-sign / certified UCDA form / OMVIC | Missing / deferred |

---

## Marketing parity: claimed vs live

| Claim (flashfender.com) | Live app |
|-------------------------|----------|
| Known-damage disclosure guards on Active inventory | Server + UI enforce notes when `known_damage` + Active |
| BOS print with business / licence / HST when configured | PDF Dealership block; empty if Settings blank |
| Not certified UCDA / not counsel / not OMVIC garage register | Explicit on Security + Deals feature copy |
| No “auto Ontario compliance certificate” | Changelog states organizer-only |

---

## Secrets touched

**None** (names only checklist: Resend/Meta unchanged — Lane C/A).

---

## Files changed (summary)

**App**

- `src/lib/mvda-damage.ts` — harden status normalize, merge helper, draft warning
- `src/lib/bos-pdf.ts` — Dealership block + HST + trade-in disclosure section
- `src/lib/bos-ontario-fixture.ts` — synthetic sample payload
- `src/components/BillOfSaleModal.tsx` — pass HST + trade-in disclosure to PDF
- `src/app/api/vehicles/[id]/route.ts` — merge patch state for MVDA assert
- `src/app/(dashboard)/inventory/[vin]/page.tsx` — shared MVDA warning strings
- `scripts/generate-bos-ontario-fixture.mjs`
- `migration/_sync_audit/UCDA_BOS_FIELD_MATRIX.md`
- `migration/_sync_audit/fixtures/bos_ontario_sample.html`
- `migration/_sync_audit/fixtures/bos_ontario_sample_payload.json`
- `migration/_sync_audit/PHASE2_LANE_B_ONTARIO_SIGNOFF.md` (this file)

**Marketing**

- `websites/flashfender.com/src/pages/security.astro`
- `websites/flashfender.com/src/content/features/deals.md`
- `websites/flashfender.com/src/pages/changelog.astro`

---

## Verification

- `node scripts/generate-bos-ontario-fixture.mjs` — proof checks OK (Dealership, HST #, Dealer licence, disclosures, SAMPLE banner)
- `npx tsc --noEmit` — **pass** (Lane B changes; also fixed unrelated Supabase relation casts in `src/lib/crm/email-sequences.ts` so tsc is green — no CRM sequences feature work)
- Dual smoke (manual after deploy; **not deployed this lane**):
  1. Settings → Business: set licence + HST → open BOS PDF → Dealership block shows both
  2. Active vehicle + known_damage → clear disclosure → save/PATCH rejected
  3. flashfender.com Security / Deals / Changelog copy matches above table

---

## Out of scope (reconfirmed)

- Lane A syndication feed / AutoTrader CSV  
- Lane C Resend CRM sequences  
- OMVIC garage register, e-sign, multi-province packs  
- CF Worker deploy (`deploy:cf`)  
- Invented Hillz/Nova customer or VIN rows  
