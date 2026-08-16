# Wave M2 Signoff — Inventory merch polish

**Stamp:** 2026-08-04  
**Wave:** M2 — Inventory (bulk + filters + cost + print + VDP photos + purchases CRUD)  
**App root:** `Adaptus-DMS/Adaptus-DMS`  
**Honest claim:** Kijiji/AT.ca remain **export/feed only** — no auto-post.

---

## Scope checklist

| Item | Status | Notes |
|------|--------|-------|
| Bulk select bar (status / AT.ca feed / delete) | Shipped | Inventory list selection + bulk bar |
| Advanced filters UI wired to API | Shipped | Make / year / price / condition → `minYear` `maxYear` `minPrice` `maxPrice` `make` `condition` |
| Cost column | Shipped | Table + grid; sortable via `sortBy=cost` |
| Export respects filters | Fixed | Excel uses same query builder as list (status, search, adv, aging, sort) |
| Aging KPI drill-down | Shipped | Click Aging → `status=Active&minDays=45`; KPI count uses API `minDays` |
| Sort Days / Retail | Shipped | Column headers; API maps `days`→`created_at`, `retail`→`retail_price` |
| VDP photo role / reorder | Shipped | Inline manager + intake wizard; PATCH `image_gallery` |
| Print window sticker | Shipped | `printWindowSticker` (list + VDP); route `/inventory/[vin]/print` also available |
| Purchases search / edit / delete | Shipped | UI + `GET ?q=` / `PATCH` / `DELETE` on `/api/purchases` |

---

## Bugs found & fixed (this pass)

1. **Export ignored filters** — Excel fetched `/api/vehicles?limit=10000` with no status/search/adv params → now shares `buildVehicleQuery` with the list.
2. **Advanced filter API unused** — list UI only sent `status` + `q` while API already supported make/year/price → wired drawer + applied params.
3. **No Cost column / Days·Retail sort** — added Cost column; sortable Cost/Retail/Days headers.
4. **Aging KPI not drillable** — MetricStrip `onClick` + `minDays` API filter; KPI aging count no longer client-scans 10k rows.
5. **No bulk select** — checkboxes + status / AT.ca `ids=` / delete.
6. **Purchases create-only** — added authenticated PATCH/DELETE + search/edit/delete UI (dealership-scoped).
7. **Make filter exact-match only** — GET vehicles `make`/`model` now `ilike %…%` for partial matches.

---

## Residual risks

| Risk | Severity | Mitigation / note |
|------|----------|-------------------|
| Bulk status/delete is N parallel PATCHs/DELETEs | Med | Fine for page-sized selection; no single transaction |
| `minDays` aging uses `Date.now()` in API | Low | Correct for request-scoped filters (not a Convex query cache) |
| Make `ilike` may over-match short strings | Low | Acceptable for desk search |
| Purchase delete does not unlink/delete vehicle | Intentional | Copy warns; vehicle remains in inventory |
| Window sticker pop-up may be blocked | Low | Toast prompts allow pop-ups; `/print` route fallback exists |
| Pre-existing `tsc` error in `deals/[id]/page.tsx` | Unrelated | Not introduced by M2 |
| Gallery write ops on Image Library page | Out of scope | Plan: “gallery write ops later” |

---

## Verification

- [x] M2 inventory/purchases/vehicles files — no new `tsc` hits (repo still has unrelated deals error)
- Manual smoke:
  1. Inventory → Filters → Apply make/year/price → Export → row count matches list filters
  2. Click **Aging** KPI → Active ≥45d only
  3. Sort Days / Retail / Cost headers
  4. Select rows → Set status / AT.ca feed / Delete
  5. Row / VDP → Print sticker (allow pop-ups)
  6. VDP Manage Photos → role + reorder persists
  7. Purchases → search → edit → delete (vehicle left intact)

---

## Explicit non-claims

- No Kijiji or AutoTrader **auto-post**
- No full Guide 17-col table / FB bulk marketplace post
- No MVDA purchase agreement PDF in this wave
