# Vehicle UI Deploy — Adaptus

| Field | Value |
|-------|-------|
| **Worker** | `adaptus-nova-motors` |
| **Version ID** | `59e92b6a-a776-4b34-8b18-cc9b54a895fe` |
| **Deployed at** | `2026-08-02T04:17:12-07:00` |
| **Command** | `npm run deploy:cf` |
| **Workers URL** | https://adaptus-nova-motors.adaptusclient.workers.dev |
| **Custom domain** | https://dms.adaptusgroup.ca |

## Scope

Vehicle UI parity changes already in codebase:

- `src/app/(dashboard)/inventory/[vin]/page.tsx`
- `src/components/VehicleFormModal.tsx`
- `src/app/api/vehicles/[id]/route.ts`

## Smoke check

| Check | Result |
|-------|--------|
| `GET https://dms.adaptusgroup.ca/login` | **200** (zone proxy OK) |

## Notes

- Harvest blocked elsewhere — deploy-only.
- OpenNext Cloudflare build/deploy completed successfully.
