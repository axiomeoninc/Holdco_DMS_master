# DEEPEST QA L10 SIGNOFF — BOS / Ontario / MVDA / mark-sold

**Stamp:** 2026-08-04  
**Lane:** 10 only — BOS PDF, MVDA known-damage, Mark as Sold  
**Plan:** `deepest_qa_20_swarm`  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com (read-only + validation probes; **no CF deploy**)  
**Dealership:** Nova `dd404bb6-3e64-43ae-9eb7-98095033c6cb`

---

## Verdict

**PASS (with local fixes pending CF deploy)** — MVDA Active+damage without notes is enforced live (400, no persist). BOS PDF fixture proofs Ontario Dealership / licence / HST / disclosure blocks. Mark-as-Sold path closes deal → vehicle `Sold`. Critical BOS create RLS bug fixed locally (not yet on live tip).

---

## Floors (protected)

| Table | Floor | Live count | OK |
|-------|------:|-----------:|:--:|
| vehicles | ≥158 | 158 | yes |
| sales_deals | ≥77 | 78 | yes |
| invoices | ≥71 | 72 | yes |

No deletes, no invented Hillz/Nova customers/VINs, no BOS row invent on live.

---

## Acceptance matrix

| Criterion | Status | Evidence |
|-----------|--------|----------|
| MVDA: Active + known_damage blocked without disclosure | **Pass (live)** | PATCH Active vehicle `{known_damage:true, disclosure:""}` → **400** with MVDA message; re-GET `known_damage` unchanged |
| MVDA: PUT/PATCH merge + intake wizard | **Pass (code)** | `mvda-damage.ts` + `/api/vehicles` + `/api/vehicles/[id]` + `VehicleIntakeWizard` |
| VDP disclosure UI case-insensitive Active | **Pass (local fix)** | Uses `isActiveInventoryStatus` |
| BOS PDF Dealership / licence / HST when configured | **Pass (fixture)** | `bos-pdf.ts` + fixture regen; live Nova has business name but **licence/HST unset** (PDF omits those lines honestly) |
| BOS create sets `dealership_id` (RLS) | **Pass (local fix)** | Was missing → RLS insert fail; explains live BOS **count 0** |
| BOS payment inserts carry `dealership_id` | **Pass (local fix)** | POST + PATCH payment rewrite |
| Mark as Sold → BOS status + deal Paid Off + vehicle Sold | **Pass (code)** | `BillOfSaleModal` → PATCH deal `close_deal` → `/api/deals/[id]` sets vehicle `Sold` |
| Modal save uses cookie credentials (`apiFetch`) | **Pass (local fix)** | Replaces raw `fetch` without consistent credentials |
| BOS unauth blocked | **Pass (live)** | GET `/api/bill-of-sale` → **401** |
| CF deploy | **Skipped** | Per lane instructions — integrator redeploys |

---

## Bugs found + fixed (local tree)

| Bug | Severity | Fix |
|-----|----------|-----|
| `POST /api/bill-of-sale` omitted `dealership_id` (RLS WITH CHECK fails) | **P0** | Resolve user dealership; stamp on insert; reject platform-admin without dealership context |
| BOS payment inserts omitted `dealership_id` | **P1** | Stamp on POST create + PATCH payment replace |
| `BillOfSaleModal` save/mark-sold used raw `fetch`; unused `apiFetch` import | **P2** | Save + deal close via `apiFetch`; enrich vin/year/make/model from vehicle |
| VDP disclosure guard used case-sensitive `"Active"` | **P2** | `isActiveInventoryStatus()` |

**Redeploy needed:** yes (integrator) — live tip still has BOS create without dealership stamp.

---

## Deferred

| Item | Reason |
|------|--------|
| Nova `dealer_license` / `hst_number` empty | Settings data — PDF correctly omits; not a code defect |
| Full browser E2E Mark as Sold on live Nova deal | Would mutate deals/vehicles; code path reviewed; floors protected |
| Ontario single HST 13% default vs GST 5%+PST 7% UI | Modal already labels GST/HST; Nova address is BC-oriented; tax profile is settings/product choice |
| Financing schedule detail on PDF | Known partial from UCDA matrix — totals/print oriented |
| Certified UCDA / e-sign / OMVIC | Out of scope |

---

## Verification commands

```bash
cd Adaptus-DMS/Adaptus-DMS
node scripts/generate-bos-ontario-fixture.mjs   # Proof checks OK
node scripts/_l10_mvda_unit.mjs                 # 7/7 pass
python migration/_sync_audit/_l10_bos_smoke.py  # floors + MVDA 400 + BOS 401
```

Artifacts:

- `migration/_sync_audit/fixtures/bos_ontario_sample.html`
- `migration/_sync_audit/_l10_bos_smoke.json`
- Prior Lane B context: `PHASE2_LANE_B_ONTARIO_SIGNOFF.md`, `UCDA_BOS_FIELD_MATRIX.md`

---

## Files touched

- `src/app/api/bill-of-sale/route.ts`
- `src/app/api/bill-of-sale/[id]/route.ts`
- `src/components/BillOfSaleModal.tsx`
- `src/app/(dashboard)/inventory/[vin]/page.tsx`
- `scripts/_l10_mvda_unit.mjs`
- `migration/_sync_audit/_l10_bos_smoke.py`
- `migration/_sync_audit/DEEPEST_QA_L10_bos_ontario_SIGNOFF.md` (this file)

---

## Secrets / safety

- No passwords or service-role keys in this file.
- No CF deploy from this lane.
- Floors re-checked after probes; MVDA reject left inventory unchanged.
