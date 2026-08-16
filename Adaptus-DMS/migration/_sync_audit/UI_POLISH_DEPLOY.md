# UI Polish Deploy — Adaptus (safe-ui-polish)

| Field | Value |
|-------|-------|
| **Worker** | `adaptus-nova-motors` |
| **Version ID** | `6e6689d9-c6d1-42c2-a971-59fb92beaff3` |
| **Deployed at** | `2026-08-02T06:48:00-07:00` |
| **Command** | `npm run deploy:cf` |
| **Workers URL** | https://adaptus-nova-motors.adaptusclient.workers.dev |
| **Custom domain** | https://dms.adaptusgroup.ca |

## Scope

Constrained look-and-feel only — no form field models, auth/cookie paths, or API contract changes.

### Shell
- `src/components/Sidebar.tsx` — charcoal brand lockup, denser nav active rail, dealership subtitle on mobile top bar
- `src/app/(dashboard)/layout.tsx` — softer aurora wash on main pane
- `src/app/(dashboard)/dashboard/page.tsx` — inventory-style header (no hero/gradient), neutral Today card, non-purple chart palette

### List density (match inventory)
- `src/app/(dashboard)/customers/page.tsx` — 20/page, sticky filters, sticky thead, compact rows
- `src/app/(dashboard)/leads/page.tsx` — same density patterns
- `src/app/(dashboard)/deals/page.tsx` — same density patterns + quieter loading/empty chrome

## Smoke check

| Step | Result |
|------|--------|
| `GET /login` | **200** |
| Login as ashish@novamotor.ca | **200** |
| `/dashboard` `/inventory` `/customers` `/leads` `/deals` `/finance` | **200** |
| Inventory VIN detail | **200** |
| Deals list + `/api/finance-calculations` | **200** |

## Notes

- Zone proxy / custom domain unchanged.
- Full 6-module QA owned by separate swarm — not duplicated here.
