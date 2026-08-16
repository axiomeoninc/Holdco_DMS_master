# Website logo layout fix — signoff

**Stamp:** 2026-08-06  
**Scope:** Marketing only (`websites/flashfender.com` → worker `flashfender-web`)  
**App:** untouched

## Problem

Wave C dark glass was live, but branding layout was wrong: light-plate lockup on ink, header lockup + CSS `logo-word` twin, oversized hero mark (`min(72vw, 28rem)`).

## Actions

1. **Transparent lockup** — Pillow one-shot `scripts/make-logo-on-dark.py`: near-white plate → alpha; dark brand ink lightened for dark UI; crop; bak at `public/brand/flashfender-logo.bak.png`; replace `flashfender-logo.png` (433×206 RGBA).
2. **Header** — lockup only; removed `logo-word` twin + CSS leftovers; nav mark ~2.4rem; `align-items: center`.
3. **Hero / footer** — hero max `min(18rem, 70vw)`; drop heavy blue drop-shadow; footer mark ~2.6rem.
4. **Deploy** `flashfender-web` on account `9269f304c042e14181e08bf8ee7aa4f9`.

## Tip

| Step | Version ID |
|------|------------|
| Logo layout fix (live now) | `1dd897db-4f93-4214-b98d-ee4a17301b62` |
| Prior Wave C glass restore | `fb6154f9-c747-4d37-93af-27298d09df4d` |

## Smoke (2026-08-06)

| URL | Result |
|-----|--------|
| `GET /` | **200** — H1 Wave C copy; no `logo-word`; header = BrandMark only; hero `brand-mark--hero` |
| `GET /brand/flashfender-logo.png` | **200** — RGBA, transparent corners, ~75KB |
| `GET /product/` | **200** |
| `GET /pricing/` | **200** |

## Verdict

**PASS** — Transparent lockup on dark glass; no double wordmark; controlled hero scale; tip `1dd897db…`.
