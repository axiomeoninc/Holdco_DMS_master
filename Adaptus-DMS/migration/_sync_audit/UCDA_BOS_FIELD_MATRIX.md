# UCDA / Ontario BOS field matrix (FlashFender)

**Stamp:** 2026-08-04  
**Lane:** Phase 2 Lane B — Ontario compliance  
**Scope:** UCDA-aligned dealer Bill of Sale expectations vs FlashFender `BillOfSaleModal` + `bos-pdf` print.  
**Not legal advice.** Not a certified UCDA form replacement. Gaps are product TODOs, not invented data.

Status key: **Present** · **Partial** · **Missing** · **N/A (deferred)**

| UCDA / Ontario expected block | Expected fields (summary) | FlashFender status | Where |
|------------------------------|---------------------------|--------------------|-------|
| Dealer identity | Legal / trade name, address, phone, email | **Present** | `/settings/business` → `business_*`; BOS PDF Dealership block |
| Dealer licence | MVDA / dealer licence number | **Present** | `settings.dealer_license`; PDF when configured |
| Tax registration | HST / GST number | **Present** (Lane B) | `settings.hst_number`; PDF HST # when configured |
| Buyer | Name, address, phone, email, DL # | **Present** | BOS modal + `bill_of_sale` columns |
| Vehicle | Year/make/model/VIN/stock/odometer/description | **Present** | Deal + vehicle join + BOS fields |
| Sale type | Retail / wholesale / etc. | **Present** | `sale_type` |
| Price of vehicle | Selling price | **Present** | `price_vehicle` / legacy `sale_price` |
| Extra equipment / warranties / fees | Taxable add-ons, doc fees, VSA, discounts | **Present** | Ontario pricing section in modal |
| Trade-in | Allowance, vehicle ID, owing, disclosure | **Present** / trade disclosure **Present** | Section E + `trade_in_disclosure` on PDF |
| Tax | GST/HST, PST rates & amounts | **Present** | `gst_*` / `pst_*` (ON HST via GST fields) |
| Non-taxable fees | Licence, gasoline, finance, lien, etc. | **Present** | Section C |
| Deposit / down / balance | Deposit, totals, amount to finance | **Present** | Totals + PDF pricing table |
| Financing / cost of borrowing | Term, rate, lender, payment schedule | **Partial** | Modal Section D; PDF shows totals only (no full COB schedule on print) |
| Warranty period | Express warranty term | **Partial** | `warranty_period` field; not a separate PDF section |
| Known-damage / MVDA disclosure (inventory) | Notes when known damage on Active units | **Present** | `mvda-damage` server + VDP + intake |
| General notes / disclosure on BOS | Free-text disclosures | **Present** | `notes` → PDF Notes / disclosure |
| Purchaser / dealer signatures | Signature lines | **Partial** | Print signature lines only — **no e-sign** (deferred) |
| Certified UCDA paper form layout | Exact UCDA vendor form | **Missing** / **N/A** | Soft print template only — not UCDA-certified |
| OMVIC garage register | Separate OMVIC product | **N/A (deferred)** | Out of Lane B |
| Multi-province packs | QC/AB packs | **N/A (deferred)** | Ontario-first |

## PDF proof (fixture)

Synthetic sample (no Nova PII, no invented Hillz customers):

- Payload: `migration/_sync_audit/fixtures/bos_ontario_sample_payload.json`
- HTML: `migration/_sync_audit/fixtures/bos_ontario_sample.html`
- Regenerate: `node scripts/generate-bos-ontario-fixture.mjs`
- Source mirror: `src/lib/bos-ontario-fixture.ts` + `src/lib/bos-pdf.ts`

## Explicit TODOs (schema/product — not blocking Lane B)

1. Full cost-of-borrowing schedule on BOS PDF (modal already captures fields).
2. Dedicated warranty section on print (field exists).
3. Certified UCDA form vendor / e-sign — deferred Phase 2+.
