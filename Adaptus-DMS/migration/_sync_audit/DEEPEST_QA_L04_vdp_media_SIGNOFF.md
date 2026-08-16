# DEEPEST QA L04 — VDP / media SIGNOFF

**Stamp:** 2026-08-04  
**Lane:** 04 — VDP / media (photo role/reorder, sticker, Carfax, syndication packs)  
**Plan:** `deepest_qa_20_swarm`  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com (integrator redeploy)  
**CF deploy this lane:** **No** (per mandate)

---

## Floors (untouched)

| Table | Floor | This lane |
|-------|------:|-----------|
| vehicles | ≥158 | Read / gallery meta only; **no deletes of inventory** |
| sales_deals | ≥77 | Untouched |
| invoices | ≥71 | Untouched |

No invented Hillz customers / gallery / specs.

---

## Scope checklist

| Item | Result | Notes |
|------|--------|-------|
| VDP photo roles | **PASS** (fixed) | Inline manager role `<select>` → PATCH `image_gallery` rich JSON |
| VDP reorder | **PASS** | Up/down buttons rewrite `sort_order` + cover = index 0 |
| Intake wizard roles/reorder | **PASS** (prior) | DnD + roles; uses PATCH (aware DELETE was weak) |
| Print window sticker (pop-up) | **PASS** (fixed) | `printWindowSticker` now maps `body_style` |
| Print route `/inventory/[vin]/print` | **PASS** | Letter sticker; uses `resolveGallery` / `body_style` |
| Carfax panel | **PASS** (fixed) | Upload PDF / attach / fetch; honest 503 without partner env |
| Kijiji listing pack | **PASS** (fixed) | Copy / JSON / CSV now resolve rich gallery URLs |
| AutoTrader feed / CSV / check | **PASS** (fixed) | `httpImages` parses rich `image_gallery` (was always empty) |
| Tenant isolation (Carfax) | **PASS** (fixed) | GET scoped by `dealership_id`; POST ownership check; upload auth |

---

## Bugs found & fixed (this pass)

| # | Severity | Bug | Fix |
|---|----------|-----|-----|
| 1 | **P0** | Syndication Kijiji/AT treated rich `image_gallery` JSON strings as URLs → **0 photos**, AT always 422 “MainPhoto required” for role-tagged galleries | `parseGallery` in `kijiji.ts` + `autotrader.ts` `httpImages` |
| 2 | **P0** | `DELETE /api/vehicles/:vin/images` compared raw text[] entry to URL → **false success, photo not removed** on rich galleries | Parse → filter by `url` → re-serialize; VDP fallback PATCH if `removed===0` |
| 3 | **P1** | Window sticker `body_type` never populated (schema is `body_style`) → Body always “—” | Accept `body_style` in `window-sticker.ts` |
| 4 | **P1** | `GET /api/carfax` had no dealership gate (cross-tenant leak risk) | `requireDealershipAccess` + `dealership_id` filter |
| 5 | **P1** | `POST /api/carfax` could mirror `carfax_report_url` onto any vehicle UUID | `assertOwnershipOrDeny` before update |
| 6 | **P1** | `POST /api/carfax/upload` never verified session (client created, unused) | `requireDealershipAccess`; path prefix by dealership |
| 7 | **P2** | Photo PATCH required `vehicles:photos` while VDP UI gated on `vehicles:write` only | API accepts `vehicles:write`; VDP `canEdit` includes Manager + `vehicles:photos` |
| 8 | **P3** | `isRichObject` required `is_cover: boolean` → dropped partial rich entries | Soften to require `url` only |

---

## Honest claims / non-claims

- Kijiji / AutoTrader = **export / feed download only** — not live auto-post / SFTP.
- Carfax auto-fetch needs `CARFAX_PARTNER_ID` and/or `CARFAX_API_KEY`+`CARFAX_API_URL`; without them UI shows amber banner and fetch returns **503** — PDF upload still intended when `carfax-reports` bucket exists.
- No CF Worker redeploy in this lane; live tip unchanged until integrator Phase B.

---

## Verification

- [x] Static review: VDP `InlineImageManager`, print helpers, Carfax panel/API, syndication packs/routes
- [x] Logic smoke: rich gallery → old URL filter count **0**, new `parseGallery` count **2**; DELETE-by-URL removes 1
- [x] `tsc --noEmit` — no new errors in Lane 04 paths (repo still has unrelated pre-existing failures)
- [ ] Live browser (post-integrator deploy): VDP Manage Photos role+reorder+remove; Sticker Body field; Marketplace Check fields / Pipe feed with photos; Carfax amber/503 honesty

### Manual smoke (after CF deploy)

1. Open Active VDP with gallery → Manage Photos → set role → reorder → remove → refresh persists  
2. Sticker button → Body shows `body_style` when set  
3. Marketplace → Check fields → should not fail MainPhoto solely due to rich JSON gallery  
4. Carfax with no partner secrets → amber + Fetch disabled / 503; Upload PDF still gated on auth + bucket  

---

## Residual risks

| Risk | Severity | Note |
|------|----------|------|
| Live still serves pre-fix Worker until integrator deploy | Med | Documented; no CF deploy this lane |
| `carfax-reports` bucket missing → upload 503 | Low | Honest message already |
| Image DELETE does not purge Storage object | Low | Gallery unlink only (prior design) |
| Print pop-up blockers | Low | `/inventory/[vin]/print` fallback |

---

## Files touched

- `src/app/api/vehicles/[id]/images/route.ts`
- `src/app/api/vehicles/[id]/route.ts`
- `src/app/api/carfax/route.ts`
- `src/app/api/carfax/upload/route.ts`
- `src/lib/syndication/autotrader.ts`
- `src/lib/syndication/kijiji.ts`
- `src/lib/window-sticker.ts`
- `src/lib/vehicle-image.ts`
- `src/app/(dashboard)/inventory/[vin]/page.tsx`

---

## Verdict

**PASS (with deploy pending)** — Lane 04 media paths audited; P0 syndication photo + gallery delete bugs fixed in local tree. Integrator must CF-redeploy before live claim.
