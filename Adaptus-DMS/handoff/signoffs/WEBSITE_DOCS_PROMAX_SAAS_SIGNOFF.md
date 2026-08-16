# Website docs + Pro Max SaaS — signoff

**Stamp:** 2026-08-06  
**Scope:** Marketing (`websites/flashfender.com` → `flashfender-web`)  
**Theme:** Starlight `/docs` + logo-true Pro Max SaaS marketing polish

## Changes

- Astro Starlight at `/docs` with logo-true dark theme (bolt `#00AEEF`, charcoal ink, Satoshi / IBM Plex Mono)
- Complete public docs IA: getting started, trial/soft lock, modules, Flash AI, integrations, billing, security, changelog, operators
- Header + footer **Docs** links; `/documentation` → `/docs`
- Homepage Pro Max overhaul: denser header glass, bento feature grid, hero grid + Docs CTA, sharper bolt frost tokens
- No secrets published; Flash AI naming only (no vendor names)

## Tip

| Field | Value |
|-------|--------|
| Worker | `flashfender-web` |
| Account | `9269f304c042e14181e08bf8ee7aa4f9` |
| Version | `382a7f9a-a56b-4e91-bdf0-333c87a164da` |

## Smoke

| Check | Result |
|-------|--------|
| `GET /` | **200** — Docs nav, Flash AI, bento, mobile nav toggle, brand icon |
| `GET /docs` | **200** — Starlight welcome |
| `GET /docs/getting-started` | **200** |
| `GET /docs/ai-desk` | **200** — Flash AI only |
| `GET /product` | **200** — Docs in chrome |
| `GET /pricing` | **200** |
| `GET /brand/flashfender-icon.png` | **200** (42412 bytes) |
| `HEAD www…/docs` | **200** |
| `GET /documentation` | **301** → `/docs` |
| Vendor names on home | **None** |

## Verdict

**PASS** — Docs + Pro Max SaaS marketing live; tip `382a7f9a…`.
