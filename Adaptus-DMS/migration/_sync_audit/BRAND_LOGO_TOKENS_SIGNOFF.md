# Brand logo + tokens signoff

**Date:** 2026-08-04  
**Scope:** `brand-logo-tokens` only (no CF deploy, no full smoke, no MiniMax/TipTap)

## Done

1. **Assets** — Logo copied to `public/brand/flashfender-logo.png`; mark crop `flashfender-mark.png`; favicon 16/32 + `apple-touch-icon` under `public/brand/` and root; Next `app/icon.png` + `app/apple-icon.png`.
2. **Tokens** — `globals.css` primary replaced from `#2563EB` → electric blue `#00AEEF` / `#0EA5E9`; charcoal foreground `#1F2937`; FLASH accent `--flash-from`/`--flash-to` + `.bg-flash-gradient` / `.text-flash-gradient` / `.text-charcoal`.
3. **Chrome** — `BrandLogo` wired in Sidebar (desktop + mobile), TopHeader, login, register, forgot-password, verify-email, TrialExpiredLock. Auth layout remains passthrough (pages own lockups).
4. **Skipped (per plan)** — CF deploy, full smoke, MiniMax, TipTap / gold-components wave.

## Stack

Next.js + Supabase + Cloudflare OpenNext — unchanged.
