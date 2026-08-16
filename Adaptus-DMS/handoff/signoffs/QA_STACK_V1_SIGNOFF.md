# QA Stack v1 signoff (FlashFender)

**Date:** 2026-08-08  
**Campaign:** FlashFender QA + UI/UX stack  
**Repo root:** `Adaptus-DMS/Adaptus-DMS`  
**Deploy:** none (tooling/CI only — no CF tip change)

## Verdict

**Shipped (code + workflows):** YES — full v1 matrix landed.  
**Green CI on remote:** BLOCKED until operator secrets are set (see Blockers).  
**Hermes primary gate:** Playwright (`e2e/` + `npm run test:e2e` / `e2e.yml`).

---

## What shipped

### Detect layer

| Piece | Location / evidence |
|-------|---------------------|
| Vitest + MSW unit | `tests/unit/*` — **22 tests PASS** (`npm test` 2026-08-08) |
| Route audit | `npm run audit:routes` — **0 orphan pages/APIs** (55 pages / 104 APIs) |
| Playwright journeys + axe | `e2e/auth`, `platform-hub`, `platform-impersonate`, `crm-smoke`, `money`, `routes-a11y` + fixtures |
| Storybook (gold) | `.storybook/` + 5 stories: Button, ConfirmDialog, ImpersonationBanner, DataTable, PlatformHub |
| Chromatic CI | `.github/workflows/chromatic.yml` |
| Lighthouse CI | `lighthouserc.json` + `lighthouse.yml` (staging) |
| AI UX critic | `scripts/ai-ux-critic.mjs` + `ai-ux-critic.yml` |
| Bruno API | `tests/api/bruno/` + `api.yml` |
| k6 smoke | `tests/perf/smoke.js` + `perf-staging.yml` |
| ZAP baseline | `tests/security/zap/` + `security-staging.yml` |
| GHA quality | `ci.yml` (lint · tsc · vitest · audit:routes) |
| GHA e2e | `e2e.yml` |

### Improve layer

| Piece | Evidence |
|-------|----------|
| Gold-first stories | No shadcn init; stories wrap existing `src/components/ui/*` |
| Pattern ports (docs) | `handoff/GOLD_UX_PATTERN_PORTS.md` — inspiration only, no kit npm deps |
| Glue README | `handoff/QA_STACK_README.md` |
| Secrets checklist (names) | `handoff/QA_SECRETS_CHECKLIST.md` |

### Workflow inventory (complete vs plan Phase 8)

1. `ci.yml`  
2. `e2e.yml`  
3. `api.yml`  
4. `chromatic.yml`  
5. `lighthouse.yml`  
6. `perf-staging.yml`  
7. `security-staging.yml`  
8. `ai-ux-critic.yml` (Phase 4 add-on)

---

## SKIP table (intentional)

| Tool / action | Why skipped |
|---------------|-------------|
| Testcontainers | Supabase is cloud-hosted; use staging floors / CLI pgTAP later if needed |
| Keploy | Poor fit vs Bruno + typed Next routes |
| `shadcn init` | Fights existing gold design system |
| Magic UI / Aceternity / React Bits / 21st.dev npm kits | Inspiration only; hand-port into gold tokens |
| Percy / Applitools | Overlap Chromatic; cost |
| Cypress / Selenium / Robot / Appium / WebdriverIO | Overlap Playwright |
| Pa11y | Duplicate axe-core via Playwright |
| Prod soak (k6/ZAP/LH) | Workflows refuse prod hosts; staging only |

---

## Blockers for green CI

| Workflow | Blocker |
|----------|---------|
| `chromatic.yml` | Missing GitHub secret `CHROMATIC_PROJECT_TOKEN` → job **fails** |
| `lighthouse.yml` | Missing `STAGING_BASE_URL` → job **fails** on schedule/dispatch |
| `perf-staging.yml` / `security-staging.yml` | Same `STAGING_BASE_URL` (must be non-prod) |
| `e2e.yml` | Runs without secrets but **auth journeys skip** until `E2E_EMAIL` / `E2E_PASSWORD` |
| `api.yml` | Soft-skips until `STAGING_BASE_URL` + `BRUNO_EMAIL` + `BRUNO_PASSWORD` |
| `ai-ux-critic.yml` | Runs without LLM secrets (heuristic); richer comments need `AI_UX_CRITIC_*` |
| `ci.yml` | No secret blockers (local smoke PASS) |

**Do not invent** Chromatic project tokens or staging URLs in docs/chat. Operator sets them in GitHub Actions secrets.

---

## How Hermes should use this stack

1. **Primary:** Playwright — auth, `/platform` hub, impersonate swap/exit, CRM smoke, money PDF entry, routes-a11y (axe). Prefer `PLAYWRIGHT_BASE_URL` override for preview; default prod app URL only with dedicated E2E users.  
2. **Visual components:** Storybook locally; Chromatic on PR once token exists.  
3. **Page budgets:** Lighthouse CI on **staging** only.  
4. **UX judgment:** `ai-ux-critic` on UI/story PRs — complement, not replace, axe/Chromatic.  
5. **API:** Bruno against local/staging envs.  
6. **Unit / routes:** `npm test` + `npm run audit:routes` on every PR via `ci.yml`.  
7. **Perf/security:** weekly schedule + manual dispatch — never default to prod soak.

---

## Local verification (this signoff)

```
npm test            → 22 passed
npm run audit:routes → 0 orphan pages, 0 orphan APIs
```

No CF deploy performed.

---

## Continuity

Public note added to `handoff/FLASHFENDER_CONTINUITY.md` (+ root discoverability copy). Secrets companion unchanged (names only in public docs).
