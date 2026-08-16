# Marketing Parity — Wave C Signoff

**Stamp:** 2026-08-04  
**Scope:** Phase 1 marketing parity only (`websites/flashfender.com`)  
**App truth sources (read-only):**
- `Adaptus-DMS/Adaptus-DMS/migration/_sync_audit/WAVE_C_COMPETE_SIGNOFF.md`
- `Adaptus-DMS/Adaptus-DMS/migration/_sync_audit/WAVE_AB_INTEGRITY_CLOSE_SALE_SIGNOFF.md`  
**App code:** not modified

---

## Claimed vs live

| Marketing claim | Live capability | Honest caveat |
|-----------------|-----------------|---------------|
| Inventory + Kijiji listing pack | VDP copy text / JSON / CSV via syndication API | **Not** Kijiji marketplace auto-post / partner API |
| Carfax upload/attach | PDF upload + attach; VDP CarfaxPanel | Partner VHR/API fetch needs `CARFAX_*` secrets |
| F&I worksheet | `/finance` tax/term/rate; print/copy/CSV; deal Desk F&I prefill | Not a lender network / eContract suite |
| Quotations convert | Create, share text, mailto stub, convert-to-deal | Resend transactional mail still secret-gated |
| Website embed | Embed token + same-SoT inventory | Builder site still out of scope |
| Reports | Same SoT as desk | Unchanged |
| Social + Meta | Drafts + Integrations status | Live publish needs `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` |
| Paid billing | Pricing: “Billing soon” | **Not** marketed as live Stripe |

---

## Files updated (marketing site)

- `src/content/features/inventory.md`
- `src/content/features/deals.md`
- `src/content/features/leads.md`
- `src/content/features/social.md`
- `src/content/features/reports.md`
- `src/pages/product.astro`
- `src/pages/demo.astro`
- `src/pages/changelog.astro` — Wave C / competitive tools entry
- Pricing content left as-is (trial + soft-lock honesty; paid = coming soon)

---

## Deploy

```bash
cd websites/flashfender.com
npm run deploy   # astro build && wrangler deploy → flashfender-web
```

| Step | Result |
|------|--------|
| `astro build` | **Pass** (2026-08-04) |
| `wrangler deploy` → `flashfender-web` | **Blocked** — OAuth account `c2cd6b6b…` (adaptusclient@gmail.com) ≠ `wrangler.jsonc` `account_id` `9269f304…` (API 10000) |
| Live smoke | Site responds; **Wave C copy not live** until deploy on the account that owns the Worker |

**Unblock:** `npx wrangler login` (or API token) for Cloudflare account `9269f304c042e14181e08bf8ee7aa4f9`, then re-run `npm run deploy`. Do **not** change `account_id` to the wrong account — zone routes for flashfender.com live on `9269f304…`.

**Smoke after successful deploy:** https://flashfender.com/product/ , `/demo/`, `/changelog/`, `/pricing/` (and www).

---

## Explicit non-claims (must remain true)

- No full marketplace syndication API
- No live Meta publish without connect/secrets
- No paid billing as live
- No Adaptus-DMS app edits in this phase

---

## Deploy result (Wave C live) — 2026-08-04

| Field | Value |
|-------|--------|
| Worker | `flashfender-web` |
| Account | `9269f304c042e14181e08bf8ee7aa4f9` |
| Method | `npm run deploy` with `CLOUDFLARE_ACCOUNT_ID` + API token (session env; not OAuth Adaptus account) |
| Version tip | `10d1680a-d999-46e3-8b06-9adba194009c` |
| workers.dev | https://flashfender-web.cadev.workers.dev |
| Routes | `flashfender.com/*`, `www.flashfender.com/*` |

### Smoke

| URL | Status | Notes |
|-----|--------|-------|
| https://flashfender.com/ | **200** | Title FlashFender |
| https://www.flashfender.com/ | **200** | Same worker |
| https://flashfender.com/changelog/ | **200** | Wave C entry visible: Kijiji listing pack, F&I worksheet, Carfax |
| https://flashfender.com/product/ | **200** | Kijiji / F&I / Carfax mentions present |

**Verdict:** Wave C marketing parity copy is live on apex/www.
