# Inventory UIUX Deploy — Adaptus (Phase D)

| Field | Value |
|-------|-------|
| **Worker** | `adaptus-nova-motors` |
| **Version ID** | `9f949042-f67e-4af0-81d3-ea2009444301` |
| **Deployed at** | `2026-08-02T04:25:00-07:00` |
| **Command** | `npm run deploy:cf` |
| **Workers URL** | https://adaptus-nova-motors.adaptusclient.workers.dev |
| **Custom domain** | https://dms.adaptusgroup.ca |

## Scope

Inventory + vehicle detail/form UIUX overhaul only (no Hillz harvest, no parity signoff).

### Files

- `src/app/(dashboard)/inventory/page.tsx`
- `src/app/(dashboard)/inventory/[vin]/page.tsx`
- `src/components/VehicleFormModal.tsx`

## What improved

- **List:** denser table (20/page), sticky filter + sticky thead, Active/Sold chip tabs, thumbnails, EmptyState for empty/error, toast instead of `alert()`
- **Detail:** hierarchy gallery → identity → pricing → always-on specs → features → description → Carfax; tighter spacing; charcoal/semantic tokens (no purple gradients)
- **Form:** same field order as detail; validation via toast

## Smoke check

| Check | Result |
|-------|--------|
| `GET https://dms.adaptusgroup.ca/login` | **200** (zone proxy OK) |

## Notes

- Phase E (FULL_HILLZ_PARITY_SIGNOFF) deferred.
- Zone proxy / custom domain left unchanged.
