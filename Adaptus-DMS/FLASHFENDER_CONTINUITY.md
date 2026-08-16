# FlashFender Continuity Handoff

**Primary location:** `Adaptus-DMS/Adaptus-DMS/handoff/`  
**Discoverability copy:** app root `FLASHFENDER_CONTINUITY.md` (same public content)  
**Secrets companion (gitignored):** `handoff/FLASHFENDER_CONTINUITY.SECRETS.md` — values only there  
**Stamp:** 2026-08-08  
**Audience:** Transferring agent / operator continuing FlashFender DMS without guessing

---

## 1. Purpose / transfer instructions

This file is the **exhaustive public micro-handoff** for FlashFender (product, ops, campaign history, IDs, floors, APIs). It is safe to commit.

1. Read **this file first**.
2. Read **`FLASHFENDER_CONTINUITY.SECRETS.md`** locally (never commit / never push).
3. Skim **`handoff/signoffs/`** for wave-level evidence; full audit also lives under `migration/_sync_audit/`.
4. Deploy only to Cloudflare account **`9269f304c042e14181e08bf8ee7aa4f9`** with workers **`flashfender-dms`** / **`flashfender-web`**. Do **not** use OAuth account `c2cd6b6b…` (adaptusclient) for production zone `flashfender.com`.
5. Never invent Hillz/Nova rows. Never hard-delete Nova inventory. Never put live passwords or API keys in committed markdown or chat.
6. Push product code to remote **`production`** (`dchatpar/DMSPRODUCTION`). Leave **`origin`** (`ManishKumar1307/Adaptus-DMS`) unchanged unless the operator says otherwise.

---

## 2. Live URLs, Cloudflare, Supabase, Nova, tips

| Surface | URL / ID |
|---------|----------|
| DMS app | https://app.flashfender.com |
| Marketing site | https://flashfender.com · www |
| Login | https://app.flashfender.com/login |
| CF account | `9269f304c042e14181e08bf8ee7aa4f9` (Dchatpar@gmail.com’s Account) |
| DMS worker | `flashfender-dms` · route `app.flashfender.com/*` · zone `flashfender.com` |
| Web worker | `flashfender-web` · routes `flashfender.com/*`, `www.flashfender.com/*` |
| Wrong CF account (do not deploy prod here) | `c2cd6b6b0b6d4b3e74c942bca56f1e1e` (adaptusclient OAuth) |
| Supabase project | `zwfeitodxikdwymkieai` · `https://zwfeitodxikdwymkieai.supabase.co` |
| Nova dealership UUID | `dd404bb6-3e64-43ae-9eb7-98095033c6cb` |
| Cron (DMS) | `0 * * * *` (social publish-scheduled / email due hooks) |
| App `APP_URL` | `https://app.flashfender.com` |
| Site `PUBLIC_APP_ORIGIN` | `https://app.flashfender.com` |

### Latest known production tips (supersede earlier waves)

| Worker | Tip (version ID) | BUILD_ID / notes | Signoff |
|--------|------------------|------------------|---------|
| **flashfender-dms** (latest product) | `ebd20f13-3d1a-4288-9042-7dc39b7105bd` | Deep 404 Swarm — `/platform` hub + audit 0 orphans + `/signup`→`/register` — **DEPLOYED** 2026-08-08 · BUILD_ID `PgmdkXt0QXmGmA5RDZ8ue` · prod `/platform` hub **200** | `DEEP_404_SWARM_SIGNOFF.md` |
| **flashfender-dms** (platform impersonate smoke) | `4e3fec8d-50a6-4dfb-b99e-9d9895c90413` | Platform impersonate session swap + exit + gold UX admin lift — **DEPLOYED** 2026-08-08 · BUILD_ID `kSJZ3bE_SHVHZgs49xo6M` · floors 158/78/72 · prod impersonate **PASS** | `PLATFORM_IMPERSONATE_ADMIN_SMOKE_SIGNOFF.md` |
| **flashfender-dms** (Resend email wave) | `1f855a5f-cf6c-4995-b537-cd995833f1c2` | Resend + branded templates — **DEPLOYED** 2026-08-08 · BUILD_ID `eTGs3vBQiz7806Qwnv-fz` · Resend **LIVE** | `RESEND_EMAIL_WAVE_SIGNOFF.md` |
| **flashfender-dms** (invoice PDF engine wave) | `88c85297-e940-4b1f-b70e-f1b88c45f4f2` | **DEPLOYED** 2026-08-06 · BUILD_ID `5tXQC6ZtnU5F_tlIa5nmz` · floors 158/78/72; OpenNext CF via API token | `INVOICE_PDF_ENGINE_WAVE_SIGNOFF.md` |
| **flashfender-web** (docs + Pro Max SaaS) | `382a7f9a-a56b-4e91-bdf0-333c87a164da` | Starlight `/docs` + Pro Max marketing | `WEBSITE_DOCS_PROMAX_SAAS_SIGNOFF.md` |
| Prior web (logo-true redesign) | `37e4de13-a298-4800-91b1-4364a8523661` | Bolt cyan + FLASH wordmark; no plates | `WEBSITE_LOGO_TRUE_REDESIGN_SIGNOFF.md` |
| Prior web (Awwwards glass polish) | `1c1784d2-e59f-43e3-a31f-ec83629f1f4f` | Hero split + mobile nav + logo plate | `WEBSITE_AWWARDS_GLASS_POLISH_SIGNOFF.md` |
| Prior web (logo layout fix) | `1dd897db-4f93-4214-b98d-ee4a17301b62` | Transparent lockup attempt | `WEBSITE_LOGO_LAYOUT_FIX_SIGNOFF.md` |
| Prior web (Wave C glass restore) | `fb6154f9-c747-4d37-93af-27298d09df4d` | Dark glass marketing restored | `WEBSITE_WAVE_C_GLASS_RESTORE_SIGNOFF.md` |
| Prior web (think-strip / awwwards) | `18f9cefd…` / `3cbf03d1…` | Superseded by glass restore | — |
| Wave C glass tip (rollback target) | `10d1680a-d999-46e3-8b06-9adba194009c` | Pre-awwwards | `MARKETING_PARITY_WAVE_C_SIGNOFF.md` |
| Prior brand+AI dual deploy | DMS `058bbc76-ccbc-4156-bc23-fc59009836ed` · web `3cbf03d1-be45-44ec-8bb1-ac6bdf69edf0` · BUILD_ID `yY5S3QX1SYWGhPDRESrN8` | Brand + gold + MiniMax | `BRAND_AI_COMPONENTS_SITE_SIGNOFF.md` |
| Wave MX redeploy | `c38819f8-36f2-46ba-813f-aefbabcc9b27` · BUILD_ID `80dV2uBx2OU2e4jNJKdkw` | Post–Deepest QA | `WAVE_MX_REDEPLOY_SIGNOFF.md` |
| Deepest QA 20 tip | `a2a4fd4d-490c-42e9-b2c9-e72a36029466` · BUILD_ID `vWEb13642-Ekpt_B2eACz` | 20/20 lanes · 10 P0s | `DEEPEST_QA_20_SWARM_SIGNOFF.md` |
| Wave C (pre-M0) | `ac488c82-adbb-4a44-88e9-e1611293809a` · BUILD_ID `2bPbqy95hSkwpyipUZyXU` | Compete features | `WAVE_C_CF_DEPLOY_SIGNOFF.md` |
| Wave A+B first FF deploy | `48c8b8dd-3f7a-4cfb-b32b-f767b5254d48` · BUILD_ID `N3tpf1xPIv8CR4jNYQShq` | Initial app.flashfender.com | `WAVE_AB_CF_DEPLOY_SIGNOFF.md` |

**Verify live tip:** `wrangler deployments list` / dashboard on account `9269f304…`, or smoke `GET /BUILD_ID` on the app after deploy.

**Local git HEAD at handoff write:** `17b60444eb364a4d70bc4a8bf063299076bb4832` (working tree includes Deep 404 Swarm + platform hub; tip `ebd20f13-3d1a-4288-9042-7dc39b7105bd` · BUILD_ID `PgmdkXt0QXmGmA5RDZ8ue` · **DEPLOYED** 2026-08-08).

---

## 3. Stack lock

**Keep:** Next.js (16.x) + React 19 + TypeScript + Supabase JS/SSR + Cloudflare Workers via **OpenNext** (`opennextjs-cloudflare`) + Wrangler 4.

**Do not migrate as a prerequisite:** Prisma 5, NextAuth v5, Redis, Ubuntu/systemd rewrite, alternate DMS backends.

| Layer | Choice |
|-------|--------|
| App framework | Next.js App Router · `src/app` |
| DB / auth | Supabase (`zwfeitodxikdwymkieai`) · cookie sessions via app auth routes |
| Host | Cloudflare Workers · worker name `flashfender-dms` |
| Marketing | Astro 7 · `websites/flashfender.com` · worker `flashfender-web` |
| Deploy app | `npm run deploy:cf` (build + `opennextjs-cloudflare deploy`) |
| Deploy site | `npm run deploy` from marketing package |
| Env for prod deploy | `CLOUDFLARE_ACCOUNT_ID=9269f304c042e14181e08bf8ee7aa4f9` + `CLOUDFLARE_API_TOKEN` (Workers edit) |

---

## 4. Brand + Flash AI naming

### Brand tokens (`src/app/globals.css`)

- **Primary electric blue:** `#00AEEF` / `#0EA5E9` → `--primary` / `--primary-500` (replaced Calm Ops `#2563EB`)
- **Charcoal text:** `#1F2937` → `--charcoal` / `--foreground`
- **FLASH accent gradient:** `#E11D2E` → `#F97316` (`--flash-from` / `--flash-to`; `.bg-flash-gradient` / `.text-flash-gradient`)
- **Canvas:** cool light HSL backgrounds; hairline borders; quieter radii; Geist UI + tabular nums; Geist Mono for VIN/IDs
- **Assets:** `public/brand/flashfender-logo.png`, `flashfender-mark.png`, favicons; wired via `BrandLogo` in shell + auth

### Flash AI (product name only in UI)

- User-facing name: **Flash AI** / **Ask Flash AI** / Desk Copilot
- Status API: `provider: "flash_ai"`, public model label `flash-ai`
- Upstream vendor / model host must **never** appear in UI, Integrations copy, or marketing AI Desk pages
- Server secret env name remains `MINIMAX_API_KEY` (server-only; Integrations may expose boolean “configured”, not the key)
- Thinking tags stripped (`src/lib/ai/sanitize.ts` + `llm.ts`); empty drafts → 502; drafts never auto-send
- Missing key → amber “Flash AI not configured” / HTTP 503 — no fake success

---

## 5. Floors + Hillz rules

| Entity | Floor (protected) | Typical live Nova counts (post Deepest QA / brand) |
|--------|------------------:|----------------------------------------------------|
| vehicles | **≥158** | 158 |
| deals / sales_deals | **≥77** | 78 |
| invoices | **≥71** | 72 |

**Rules**

- Do **not** invent Hillz/source blank fields or seed fake customer rows to “fill” gaps.
- Do **not** hard-delete Nova dealership or wipe production inventory.
- Soft-delete tenants with vehicles/deals/invoices (platform admin).
- AI tools omit purchase/floor/cost prices from model context.
- Public inventory API requires `dealership_id` | `slug` | `token` (scoped).

---

## 6. Full campaign timeline + signoff index

Chronology is approximate by campaign order (2026-08). Artifacts under `handoff/signoffs/` and `migration/_sync_audit/`.

### Pre–FlashFender / AdaptUs era (workspace audit)

Hillz parity, Calm Ops, platform embed, login fixes, final QA — see workspace `migration/_sync_audit/` (`FULL_HILLZ_PARITY_*`, `CALM_OPS_*`, `PLATFORM_EMBED_*`, `FINAL_*`). Legacy live was often `dms.adaptusgroup.ca`; **production product domain is now FlashFender**.

### Waves A–B — integrity + first CF on flashfender.com

| Artifact | What |
|----------|------|
| `WAVE_AB_INTEGRITY_CLOSE_SALE_SIGNOFF.md` | Close-sale / integrity; Resend+Meta called out as blockers |
| `WAVE_AB_CF_DEPLOY_SIGNOFF.md` | First `flashfender-dms` on `9269f304…`; tip `48c8b8dd…`; secret present: `SUPABASE_SERVICE_ROLE_KEY` only |

### Wave C — compete (Carfax, Kijiji packs, syndication)

| Artifact | What |
|----------|------|
| `WAVE_C_COMPETE_SIGNOFF.md` | Carfax panel, Kijiji listing pack, syndication APIs |
| `WAVE_C_CF_DEPLOY_SIGNOFF.md` | Tip `ac488c82…` · BUILD_ID `2bPbqy95hSkwpyipUZyXU` |
| `MARKETING_PARITY_WAVE_C_SIGNOFF.md` | Marketing parity; web tip `10d1680a…` noted historically |
| `WEBSITE_WAVE_C_GLASS_RESTORE_SIGNOFF.md` | Dark glass restore; tip `fb6154f9…` |
| `WEBSITE_LOGO_LAYOUT_FIX_SIGNOFF.md` | Transparent lockup + header/hero layout; tip `1dd897db…` |
| `WEBSITE_AWWARDS_GLASS_POLISH_SIGNOFF.md` | Hero split + mobile nav + logo plate; tip `1c1784d2…` |
| `WEBSITE_LOGO_TRUE_REDESIGN_SIGNOFF.md` | Logo-true bolt/FLASH tokens; tip `37e4de13…` |
| `WEBSITE_DOCS_PROMAX_SAAS_SIGNOFF.md` | Starlight `/docs` + Pro Max SaaS marketing; tip `382a7f9a…` |

### Phase 2 — CA parity swarm (lanes A/B/C)

| Artifact | What |
|----------|------|
| `PHASE2_LANE_A_SYNDICATION_SIGNOFF.md` | AutoTrader.ca feed / syndication |
| `PHASE2_LANE_B_ONTARIO_SIGNOFF.md` | Ontario / MVDA / UCDA BOS harden |
| `PHASE2_LANE_C_CRM_EMAIL_SIGNOFF.md` | CRM email sequences UI+API; Resend degrade honest |

### Master Guide micro-gaps → Waves M0–M3 + MX

| Artifact | What |
|----------|------|
| `MASTER_GUIDE_MICRO_GAP_SIGNOFF.md` | Gap matrix; suggests M0–M3; **M4+ defer** |
| `WAVE_M0_INTEGRITY_SIGNOFF.md` | Reports tenant scope; invoice tax/package; deploy often blocked on wrong CF OAuth |
| `WAVE_M0_FINANCE_INTEGRITY_SIGNOFF.md` | Finance integrity slice |
| `WAVE_M1_DESK_SIGNOFF.md` | Deal kanban drag, `/deals/[id]`, lead convert/log-call, score filters |
| `WAVE_M2_INVENTORY_SIGNOFF.md` | Bulk bar, filters, cost, print sticker, purchases CRUD, VDP photos |
| `WAVE_M3_MONEY_SIGNOFF.md` / `WAVE_M3_MONEY_FINANCE_SIGNOFF.md` | Invoice PDF/email, AR payments, commissions report light |
| `WAVE_MX_DEPLOY_SIGNOFF.md` | M0–M3 tip live e.g. `6bb49eb3…` |
| `WAVE_MX_QA_SWARM_SIGNOFF.md` | QA vs tip honesty |
| `WAVE_MX_E2E_COMPLETE_SIGNOFF.md` | Logged-in E2E + marketing tip check |
| `WAVE_MX_PLACEHOLDERS_LIVE_SIGNOFF.md` | Placeholder UI honesty |
| `WAVE_MX_REDEPLOY_SIGNOFF.md` | Tip `c38819f8…` · floors 158/78/72 |

### Deepest QA — 20 lanes

| Artifact | What |
|----------|------|
| `DEEPEST_QA_20_SWARM_SIGNOFF.md` | **20/20 PASS**; 10 P0s fixed live; tip `a2a4fd4d…` |
| `DEEPEST_QA_L01_*` … `L20_*` | Per-lane probes (auth → security shell) |

Notable P0 themes: dashboard revenue tenant scope; syndication gallery parse; Closed→kanban mapping; quote convert confirm; BOS `dealership_id`; invoice payment avatar; commissions salesperson scope; test-drive IDOR (`user_id`).

### Brand / gold / Flash AI / think-strip

| Artifact | What |
|----------|------|
| `BRAND_LOGO_TOKENS_SIGNOFF.md` | Logo + electric-blue tokens |
| `GOLD_COMPONENTS_SIGNOFF.md` | TipTap, cmdk, day-picker, virtual list, RHF/zod, Vaul, charts, toaster |
| `MINIMAX_AI_SIGNOFF.md` | Desk AI routes + `MINIMAX_API_KEY` on worker; **rotate if pasted in chat** |
| `BRAND_AI_COMPONENTS_SITE_SIGNOFF.md` | Dual deploy tips `058bbc76…` / `3cbf03d1…` |
| `AI_THINK_STRIP_SMOKE_SIGNOFF.md` | Strip thinking tags; Flash AI branding only; tip `2192b7ec…`; 17/17 smoke |
| `INVOICE_PDF_ENGINE_WAVE_SIGNOFF.md` | pdf-lib invoice + quotation PDF/Excel + sibling P1s; floors 158/78/72; `tsc` PASS; **deploy BLOCKED** (no CF API token) |
| `RESEND_EMAIL_WAVE_SIGNOFF.md` | Resend LIVE + branded templates; tip `1f855a5f-cf6c-4995-b537-cd995833f1c2`; BUILD_ID `eTGs3vBQiz7806Qwnv-fz` |
| `DEEP_404_SWARM_SIGNOFF.md` | Platform hub + route audit 0 orphans; `/signup`→`/register`; tip `ebd20f13-…`; BUILD_ID `PgmdkXt0QXmGmA5RDZ8ue` |
| `PLATFORM_IMPERSONATE_ADMIN_SMOKE_SIGNOFF.md` | Real impersonate swap+exit; L18 honesty supersede; gold UX; tip `4e3fec8d-…`; BUILD_ID `kSJZ3bE_SHVHZgs49xo6M`; floors 158/78/72 |

### QA stack v1 (tooling — no CF deploy)

| Artifact | What |
|----------|------|
| `QA_STACK_V1_SIGNOFF.md` | Playwright+axe · Storybook/Chromatic · LHCI · Bruno · Vitest (22) · k6 · ZAP · AI UX critic · GHA matrix; SKIP Testcontainers/Keploy/shadcn init/kits/Percy/Cypress |
| `QA_STACK_README.md` | Local runbook + workflow/secret matrix (names only) |
| `QA_SECRETS_CHECKLIST.md` | GHA secret **names** for E2E / Chromatic / staging / Bruno / critic |
| `GOLD_UX_PATTERN_PORTS.md` | Inspiration-only polish ports into gold tokens (no kit deps) |

**Hermes:** primary functional/a11y gate = **Playwright**; visual components = Storybook/Chromatic; critic = optional PR feedback. Green CI for Chromatic/LH/k6/ZAP needs operator secrets (`CHROMATIC_PROJECT_TOKEN`, `STAGING_BASE_URL`, …) — never invent tokens.

### Git / secrets ops

| Artifact | What |
|----------|------|
| `DMSPRODUCTION_GIT_PUSH_SIGNOFF.md` | Push to `production` remote; origin untouched |
| `SECRETS_OPS_STATUS.md` / `FLASHFENDER_SECRETS_CHECKLIST.md` | Resend/Meta/Carfax secret **names**; operator puts |

### Signoff pack in this handoff

Copies of the above (and related) live in **`handoff/signoffs/`** (~50 files). Canonical working copies also under `Adaptus-DMS/Adaptus-DMS/migration/_sync_audit/` (and some mirrored at workspace `DMSDATA/migration/_sync_audit/`).

---

## 7. Flash AI API map (`/api/ai/*`)

All require auth (dealership-scoped). No vendor string in responses. Drafts are review-before-send.

| Method | Path | Role |
|--------|------|------|
| GET | `/api/ai/status` | `{ configured, provider: "flash_ai", model: "flash-ai", … }` |
| POST | `/api/ai/copilot` | Streaming Desk Copilot + tool loop (`text/plain` stream) |
| POST | `/api/ai/description` | Listing description draft |
| POST | `/api/ai/follow-up` | CASL-aware follow-up draft (`sent: false`) |
| POST | `/api/ai/price-narrative` | Price/aging narrative (no floors) |
| POST | `/api/ai/inventory-search` | NL → filter JSON |
| POST | `/api/ai/disclosure` | Ontario MVDA helper (human confirm) |
| POST | `/api/ai/quote-coach` | Quote objection coach |
| GET | `/api/ai/desk-brief` | Daily desk brief |

**Libs:** `src/lib/ai/llm.ts`, `sanitize.ts`, `guard.ts`, `tools.ts`  
**UI:** `FlashAiPanel`, `AiActionButton`, `DeskBriefWidget`, `AiNotConfiguredBanner`, cmdk + TopHeader “Ask Flash AI”

---

## 8. Gold components

Packages: TipTap, cmdk, react-day-picker, date-fns, `@tanstack/react-virtual`, react-hook-form, `@hookform/resolvers`, zod, Vaul; Recharts + Sonner; `@dnd-kit/*`.

Thin wrappers under `src/components/ui/`:

- `rich-text-editor.tsx` · `chart.tsx` · `toaster.tsx` · `command.tsx`
- `date-picker.tsx` · `virtual-list.tsx` · `form.tsx` · `drawer.tsx`

Wired into intake TipTap, inventory virtual grid, mobile filters drawer, FU/TD/reports dates, customer RHF+zod, shell toaster, dashboard charts.

---

## 9. Git remotes

| Remote | URL | Role |
|--------|-----|------|
| **production** | `https://github.com/dchatpar/DMSPRODUCTION.git` | **Ship here** (was public — never commit secrets) |
| **origin** | `https://github.com/ManishKumar1307/Adaptus-DMS.git` | Upstream fork — leave unchanged unless directed |

Branch typically tracked: `master` ↔ `production/master`.

---

## 10. Secrets inventory (names only)

**Values:** see `handoff/FLASHFENDER_CONTINUITY.SECRETS.md` (gitignored).

### Local `.env.local` / `.env*` (dev)

| Name | Unlocks |
|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/anon client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server privileged Supabase |
| `SUPABASE_ACCESS_TOKEN` | Supabase Management API (DDL); do not commit |
| `MINIMAX_API_KEY` | Flash AI upstream (server-only) |

### Wrangler vars (non-secret, in `wrangler.toml`)

| Name | Notes |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon |
| `APP_URL` | `https://app.flashfender.com` |
| `NEXTJS_ENV` | If set |

### Wrangler secrets (`wrangler secret put` on `flashfender-dms`)

| Name | Purpose | Last known |
|------|---------|------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Server DB | Present (A+B+) |
| `MINIMAX_API_KEY` | Flash AI | Present (brand/AI wave+) |
| `RESEND_API_KEY` | OTP / trial / transactional | **LIVE** on Worker (2026-08-08) — value only in SECRETS companion |
| `EMAIL_FROM` | Verified From | **LIVE** — `FlashFender <noreply@flashfender.com>` (name only; no key) |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Meta OAuth / publish | Often **missing** |
| `FACEBOOK_REDIRECT_URI` | Optional callback override | Optional |
| `SOCIAL_CRON_SECRET` | Protect scheduled publish | Optional |
| `CARFAX_PARTNER_ID` / `CARFAX_API_KEY` / `CARFAX_API_URL` | Partner VHR | Optional |
| `OPENAI_API_KEY` | Not required for Flash AI path | Usually absent |
| `UNSUBSCRIBE_SECRET` | CASL token stability (if used) | Check list |

### Deploy session env (never commit)

| Name | Purpose |
|------|---------|
| `CLOUDFLARE_ACCOUNT_ID` | Must be `9269f304c042e14181e08bf8ee7aa4f9` |
| `CLOUDFLARE_API_TOKEN` | Workers Scripts:Edit on that account |

### GitHub Actions QA (names only — see `QA_SECRETS_CHECKLIST.md`)

| Name | Unlocks |
|------|---------|
| `CHROMATIC_PROJECT_TOKEN` | Chromatic Storybook publish (`chromatic.yml` hard-requires) |
| `STAGING_BASE_URL` | LHCI / k6 / ZAP / Bruno staging target (non-prod) |
| `E2E_EMAIL` / `E2E_PASSWORD` | Playwright authenticated journeys |
| `BRUNO_EMAIL` / `BRUNO_PASSWORD` | Bruno staging runs |
| `AI_UX_CRITIC_MODEL_URL` / `AI_UX_CRITIC_API_KEY` / `AI_UX_CRITIC_MODEL` | Optional LLM critic |
| `LHCI_GITHUB_APP_TOKEN` | Optional LHCI GitHub status |

### App logins (usernames only here)

| Identity | Role | Password |
|----------|------|----------|
| `ashish@novamotor.ca` | Nova Admin (interactive) | **see SECRETS / operator** — not found in local env |
| `f02_test_adaptus@adaptusgroup.ca` | Platform/QA Admin used in smokes | **see operator** — not recorded in signoffs |
| `f02_qa_salesperson@adaptusgroup.ca` | Salesperson QA | **see operator** |

---

## 11. How to continue / deferred M4

### Immediate operator / agent checklist

1. Confirm Wrangler auth for **`9269f304…`** (API token preferred over adaptusclient OAuth).
2. `npx wrangler secret list --name flashfender-dms` — confirm names; Resend already **LIVE**; put Meta if social must go live.
3. **Rotate `MINIMAX_API_KEY`** if it was ever pasted in chat; re-`secret put` + update local `.env.local`.
4. Smoke: login → floors ≥158/77/71 → `/api/ai/status` → Integrations (Flash AI + Resend configured; Meta honest if unset) → marketing `/features/ai-desk`.
5. Ship code via `production` remote only after `tsc` + deploy tip verify; never commit `.env*` / `*.SECRETS.md`.
6. QA stack v1: run `npm test` + `npm run audit:routes`; Hermes E2E via Playwright (`npm run test:e2e`). Operator must add GHA secrets before Chromatic/staging jobs go green — see `handoff/QA_STACK_README.md`.

### Deferred M4+ (from Master Guide)

After M1–M3 and paying demand only:

- Campaigns
- SMS (currently 501 / do not claim)
- E-sign
- Full GL / full `financial_transactions` browsing UI

**Explicitly not suggested:** Prisma/Redis/NextAuth/Ubuntu rewrite; OEM service/parts; full BHPH servicing; Chrome marketplace bots; Kijiji auto-list overclaim without partner API.

### Known honesty gaps still operator-owned

- Resend **LIVE** on Worker (API smoke PASS; Integrations configured once authenticated). Meta / Carfax may still be unset → amber "not configured" (correct)
- Notifications bell historically stubby; billing/subscription simulated in older matrices
- Ashish interactive password may need operator reset

---

## 12. Key paths

| Path | Role |
|------|------|
| `Adaptus-DMS/Adaptus-DMS/` | App root |
| `handoff/` | **This pack** (continuity + secrets + signoffs) |
| `handoff/QA_STACK_README.md` | QA stack local + CI glue |
| `handoff/signoffs/QA_STACK_V1_SIGNOFF.md` | QA stack v1 campaign signoff |
| `handoff/signoffs/` | Copied campaign SIGNOFF.md set |
| `e2e/` | Playwright primary journeys |
| `.github/workflows/` | ci · e2e · api · chromatic · lighthouse · perf · security · ai-ux-critic |
| `migration/_sync_audit/` | Live audit probes + signoffs (app tree) |
| `DMSDATA/migration/_sync_audit/` | Workspace mirror of many signoffs |
| `wrangler.toml` | `flashfender-dms` + vars + routes |
| `src/app/globals.css` | Brand tokens |
| `src/lib/ai/*` | Flash AI server |
| `src/app/api/ai/*` | Flash AI routes |
| `src/components/ui/*` | Gold wrappers |
| `public/brand/*` | Logos / favicons |
| `websites/flashfender.com/` | Marketing Astro + `flashfender-web` |
| `.env.local` | Local secrets (gitignored) |
| `FLASHFENDER_CONTINUITY.SECRETS.md` | Transfer secrets companion (gitignored) |

---

## Deploy cheat sheet

```powershell
cd Adaptus-DMS/Adaptus-DMS
$env:CLOUDFLARE_ACCOUNT_ID = "9269f304c042e14181e08bf8ee7aa4f9"
# $env:CLOUDFLARE_API_TOKEN = "<from operator / SECRETS>"
npx tsc --noEmit
npm run deploy:cf

cd ..\..\websites\flashfender.com   # adjust relative path from workspace
$env:CLOUDFLARE_ACCOUNT_ID = "9269f304c042e14181e08bf8ee7aa4f9"
npm run deploy
```

---

*End of public continuity. Secrets → `FLASHFENDER_CONTINUITY.SECRETS.md`.*
