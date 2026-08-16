# Website logo-true redesign — signoff

**Stamp:** 2026-08-06  
**Scope:** Marketing (`websites/flashfender.com` → `flashfender-web`)  
**Theme:** Dark glass + **logo-true** bolt cyan / FLASH / charcoal

## Changes

- `BRAND.md` + `DESIGN_GLASS.md` palette from logo clusters
- Assets: `flashfender-icon.png`, `flashfender-lockup-light.png`, `favicon.png` via `scripts/export-brand-assets.py`
- `BrandMark`: icon + CSS FLASH/FENDER wordmark — **no** light plates on dark
- `tokens.css`: `--brand: #00AEEF`; real `--flash-*`; charcoal canvas
- Hero split + bolt aurora; dashboard/workflow accents updated

## Tip

| Field | Value |
|-------|--------|
| Worker | `flashfender-web` |
| Account | `9269f304c042e14181e08bf8ee7aa4f9` |
| Version | `37e4de13-a298-4800-91b1-4364a8523661` |

## Smoke

| Check | Result |
|-------|--------|
| `GET /` | **200** — icon + wordmark; hero-viz; mobile-nav; bolt `#00aeef`; no `brand-plate` |
| `GET /brand/flashfender-icon.png` | **200** (42412 bytes) |
| `GET /brand/flashfender-lockup-light.png` | **200** |
| `GET /product/` | **200** |
| `GET /pricing/` | **200** |
| workers.dev | Matches apex |

## Verdict

**PASS** — Logo-true redesign live; tip `37e4de13…`.
