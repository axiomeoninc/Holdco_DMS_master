# Wave MX QA Swarm Signoff — Platform / UX + visual smoke

**Stamp:** 2026-08-04  
**App:** `Adaptus-DMS/Adaptus-DMS`  
**Live:** https://app.flashfender.com  
**Plan:** `master_guide_micro_gaps_ef669d4b.plan.md`  
**Agent:** e2e-runner (platform/UX deep QA + fix-on-the-fly)

---

## Deploy gap (live vs local)

| Check | Result |
|-------|--------|
| Live `BUILD_ID` | `2bPbqy95hSkwpyipUZyXU` — matches **Wave C tip** (`WAVE_C_CF_DEPLOY_SIGNOFF.md`) |
| Live `/login`, `/unsubscribe` | **200** |
| Phase 2 A/B/C + Waves M0–M3 code | **Local / in-repo** — **not** on live tip yet |
| `/deals/[id]` | **Missing** locally (M1 not shipped as route) |

**Verdict:** Live is still Wave C. All platform honesty / CASL / notifications fixes below are **local-only until CF redeploy**.

---

## Fixes applied (local)

### Notifications
- Removed permanent fake unread dot.
- Bell loads `/api/notifications` (invoices overdue, follow-ups due, tasks due).
- Badge only when `data.length > 0`.

### CASL unsubscribe + consent IP
- `/unsubscribe` client writes via `POST /api/unsubscribe`.
- Token from email footer preferred (`buildUnsubscribeUrl` in CRM email send path); email-only allowed with IP rate limit.
- Stamps `marketing_consent=false` + IP / unsubscribe columns when present; degrades if `wave_m3_money.sql` not applied yet.
- Customer create/update stamps consent IP via `applyConsentTimestamps(..., { ip })`.
- Migration: `src/app/supabase/migrations/wave_m3_money.sql` (+ `sms_consent_ip`).

### Billing / platform settings honesty
- Platform settings save no longer fakes success.
- Quick link `/settings/subscription` → `/platform/subscriptions`; dead Security buttons → real routes / honesty note.
- Billing save no longer fakes success; Add Card / Add Payment Method disabled or mailto support.
- Dealership Subscription page: Contact Support is honest + mailto.

### Nav (M1/M2/M3 cross-check)
| Route | Sidebar |
|-------|---------|
| `/email-sequences` | Present (Sales) |
| `/inventory/purchases` | Present (Inventory) |
| `/settings/subscription` | **Added** (Settings) |
| `/deals/new` | Exists; create flow from Deals (no dedicated nav item — OK) |
| `/deals/[id]` | **Not present** — M1 gap |

---

## Signoff consistency

| Doc | Status |
|-----|--------|
| `MASTER_GUIDE_MICRO_GAP_SIGNOFF.md` | Still says M0–M3 **not executed** at consolidation time; marketing honesty still listed notifications/billing as stubs — **update after deploy** |
| `WAVE_C_CF_DEPLOY_SIGNOFF.md` | Live tip still this build — consistent |
| This file (`WAVE_MX_QA_SWARM_SIGNOFF.md`) | Platform QA + local fixes for M3 stubs |

---

## Smoke (local `npm run dev`)

| Route | Result |
|-------|--------|
| `/login` | 200 |
| `/unsubscribe` | 200 |
| `POST /api/unsubscribe` (email-only) | Preference write path (rate-limited) |
| Auth-gated `/deals`, `/email-sequences`, `/inventory/purchases`, `/settings/subscription` | 307 → login (expected) |

No agent-browser install in environment; HTTP smoke used. Authenticated visual pass needs dealer session against local or post-deploy live.

---

## Remaining / ops

1. Apply `wave_m3_money.sql` on Supabase (consent IP + unsubscribe stamp columns).
2. `npx opennextjs-cloudflare deploy` (Wave C tip → include M3 platform fixes). Set `UNSUBSCRIBE_SECRET` (or rely on existing secret chain) in Worker env for stable tokens.
3. Update `MASTER_GUIDE_MICRO_GAP_SIGNOFF.md` marketing honesty rows for notifications/billing once live.

---

## Verdict

**PASS (local platform/UX)** — fake unread, fake saves, wrong platform subscription link, and CASL write stub addressed.  
**LIVE = Wave C tip only** — do not claim M3 platform fixes on production until redeploy.
