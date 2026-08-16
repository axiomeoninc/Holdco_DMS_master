# Hillz → Adaptus DMS Data Audit (deep analysis, 2026-08-01)

Source of truth for "what Hillz had vs what's in Supabase". Read before any
image/spec/data work so you don't re-hunt or mis-claim gaps.

## Hillz source captures (migration/raw/)

- `vehicles_complete.json` — 81 active vehicles, listing-level only
  (vin/year/make/model/trim/stock_no/odometer/price). `cover_url`/`thumb_url`
  present for ~70.
- `vehicle_galleries.json` — 81 vins keyed by VIN: `gallery_urls[]`, `hero_url`,
  `thumb_urls[]`, `source` ("master_image_urls_fix" = real multi-image capture,
  "fallback_thumb" = single cover from list page).
- `vehicle_*_gallery.json` (13 files) — per-vehicle detail captures. Two shapes:
  `{vin, image_urls[]}` or `{vin, gallery_urls[], cover_urls[], source_page}`.
- `hillz_live_inventory_parsed.json` — 81 rows, listing-only.
- `vehicles_master_index_complete.json` — summary + 81 vehicles, listing-only.
- `download_log_v4/new4` — download audit, not new data.

## Merged image state (all sources, deduped)

- 14 vins with >1 image in Hillz captures (9–14 each), 67 vins with exactly 1,
  0 vins with zero in the captures.
- **77 Sold vehicles have ZERO images in any Hillz source** (storage/orphans/
  captures all empty) — ruled unrecoverable, do not chase.

## Supabase DB state (vehicles table, 158 rows)

- 259 gallery URLs total; **all 259 are clean supabase storage links** — zero
  truncated/`...`/foreign-host artifacts.
- 81 Active: all have ≥1 gallery entry. 20 have multi-image (4–18 entries).
  Max: `2HKRS4H55RH102922` (18), `3MW5R7J00N8C63179` (14).
- 77 Sold: 0 gallery entries (matches Hillz — unrecoverable).
- Only 1 URL quirk: `SALGV2SE7NA461503` (Range Rover) gallery URL contains a
  literal space (`Range Rover-2022`). Browsers encode it → renders fine, but
  scripts must `%20`-encode it. Fix-in-place acceptable.
- `images` column is legacy; `image_gallery` (text[] of JSON strings) is truth.

## Specs / description (the REAL gap)

| field | non-null | notes |
|---|---|---|
| condition | 158/158 | complete |
| engine / transmission / drivetrain / fuel_type / body_style | 4 each | deep-scraped only |
| exterior_color / interior_color | 5 each | |
| features | 0 | absent in Hillz captures |
| description | 1 | only F-150 (`1FTEW1E57JKC11443`, 1208 chars) |
| carfax_report_url | 0 | |

**Deep-scraped vehicles (full specs in DB):** `3MW5P9J00N8C73244` (BMW 330e),
`SALGV2SE7NA461503` (Range Rover), `5TFWA5ECXSX103685` (Tundra),
`2HGFC2F53LH014380` (Civic). F-150 has description only.

**Conclusion:** spec/features/description for the other ~153 vehicles DO NOT
EXIST in the Hillz source captures — only listing-level fields. Cannot backfill
what the source lacks. Hillz live site may have them but harvesting is blocked
(reCAPTCHA / CDP dead) → needs browser takeover.

## "Only 1 image per car" — root cause

For 61 of 81 Active vehicles, Hillz truly has only ONE image in our captures —
the list-page cover. The multi-image ones (20) DO render a full gallery in
`/inventory/[vin]` (thumbs, prev/next, lightbox, role filters). The user-facing
"only 1 image" is mostly a real data limitation + the list cards showing only
the cover, NOT a rendering bug.

## Two polluted galleries found by verifier — FIXED (2026-08-02)

Independent verifier agent (`audit/swarm/qa/C-image-data-verification.md`)
found 2 VINs where Hillz's detail gallery held **wrong-make photos** while the
true VIN cover existed on the CDN but was never attached:

| VIN | DB vehicle | Hillz detail gallery (wrong) | True cover (now attached) |
|---|---|---|---|
| `1VWBA7A36NC008937` | 2022 VW Passat | 9× "2024 Dodge Durango" | `2022-Volkswagen-Passat-7792939183497809.jpg` |
| `1C6SRFHTXNN170996` | 2022 Ram 1500 | 9× "2022 Dodge Charger" | `2022-Ram-1500-3745006761092382.jpg` |

Both true covers were already downloaded during migration (`download_log.json`,
`kind: "cover"`) and are live on the CDN. **Fix:** uploaded each to Supabase
storage as `001_<name>.jpg`, replaced the polluted gallery with the single true
cover (is_cover=true). Verified 200 image/png on storage. The old wrong-make
URLs remain in `vehicle_galleries.json`/`vehicle_5468xx_gallery.json` if ever
needed. Verdict after fix: **0 data gaps vs captures** (the 2 "gaps" were
Hillz source-data pollution, not migration defects).


## Buttons audit status (2026-08-01)

- Share button on `/inventory/[vin]` = known-broken UX: it writes to
  `navigator.clipboard` and mutates `data-label` (invisible) → no visible
  feedback. Fix: real button-state change + toast + navigator.share fallback.
- Full module-by-module button audit: IN PROGRESS (see audit/swarm/qa/).
