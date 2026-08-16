# Website Wave C glass restore — signoff

**Stamp:** 2026-08-06  
**Scope:** Marketing only (`websites/flashfender.com` → worker `flashfender-web`)  
**App:** untouched (`flashfender-dms` not redeployed)

## Problem

Live `flashfender.com` was serving the Aug 2026 Awwwards/light-canvas rebuild (and intermittent Aug 6 version thrash). Operator asked for the original Wave C **dark glass** site.

## Actions

1. **Rollback** `flashfender-web` to Wave C tip `10d1680a-d999-46e3-8b06-9adba194009c` (account `9269f304c042e14181e08bf8ee7aa4f9`).
2. **Local source restore** to DESIGN_GLASS palette (`#0b1220` ink, `#2563EB` Brand Blue) + Wave C hero copy; remove bolt/flash light-theme overlays.
3. **Redeploy** from restored local so workspace and live stay aligned.

## Tips

| Step | Version ID |
|------|------------|
| Rollback target (Wave C) | `10d1680a-d999-46e3-8b06-9adba194009c` |
| Post-restore deploy (live now) | `fb6154f9-c747-4d37-93af-27298d09df4d` |
| Prior awwwards / think-strip | `3cbf03d1…` / `18f9cefd…` (superseded) |

## Smoke (2026-08-06)

| URL | Result |
|-----|--------|
| `GET /` | **200** — H1 `Dealership analytics that keep up with the lot.` · tokens `0b1220` / `2563eb` · no “bolt speed” |
| `GET /product/` | **200** |
| `GET /pricing/` | **200** |
| `GET /features/ai-desk/` | **200** |
| `GET /demo/` | **200** |
| `GET /brand/flashfender-logo.png` | **200** |

## Verdict

**PASS** — Wave C glass restored on `flashfender.com` / `www`; local source matches; new tip `fb6154f9…`.
