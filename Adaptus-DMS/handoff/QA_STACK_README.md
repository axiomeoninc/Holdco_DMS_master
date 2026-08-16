# FlashFender QA stack — local + CI glue

**Signoff:** [`signoffs/QA_STACK_V1_SIGNOFF.md`](./signoffs/QA_STACK_V1_SIGNOFF.md)  
**Secret names (no values):** [`QA_SECRETS_CHECKLIST.md`](./QA_SECRETS_CHECKLIST.md)  
**App:** https://app.flashfender.com · worker `flashfender-dms`

Hermes / agents: treat **Playwright** as the primary functional + a11y gate. Storybook/Chromatic = component visual. AI UX critic = hierarchy/spacing feedback only (not a substitute for axe).

---

## Workflow matrix (`.github/workflows/`)

| Workflow | Trigger | What it runs | Secrets / vars required for green |
|----------|---------|--------------|-----------------------------------|
| `ci.yml` | PR + push `main`/`master` | ESLint, `tsc`, Vitest, `audit:routes` | None |
| `e2e.yml` | PR + `workflow_dispatch` + `workflow_call` | Playwright + axe (desktop) | Soft: `E2E_EMAIL`, `E2E_PASSWORD` (auth journeys skip if unset). Optional var `PLAYWRIGHT_BASE_URL` |
| `api.yml` | PR + push + dispatch | Bruno collection | Soft-skip unless `STAGING_BASE_URL`, `BRUNO_EMAIL`, `BRUNO_PASSWORD` |
| `chromatic.yml` | PR + push | Storybook → Chromatic | **Hard fail** without `CHROMATIC_PROJECT_TOKEN` |
| `lighthouse.yml` | Mon 08:00 UTC cron + dispatch | LHCI vs staging | **Hard fail** without `STAGING_BASE_URL` (non-prod). Optional `LHCI_GITHUB_APP_TOKEN` |
| `perf-staging.yml` | Mon 07:30 UTC cron + dispatch | k6 low-VU smoke | **Hard fail** without `STAGING_BASE_URL`; refuses prod hosts |
| `security-staging.yml` | Mon 08:00 UTC cron + dispatch | ZAP baseline | **Hard fail** without `STAGING_BASE_URL`; refuses prod hosts |
| `ai-ux-critic.yml` | PR (UI/story paths) | Gold UX critic PR comment | Optional `AI_UX_CRITIC_MODEL_URL`, `AI_UX_CRITIC_API_KEY`, `AI_UX_CRITIC_MODEL` (heuristic fallback if unset) |

Plan Phase 8 matrix is complete; `ai-ux-critic.yml` is the Phase 4 add-on.

---

## Local commands

```bash
# Unit (no secrets)
npm test

# Route orphan audit (writes handoff/signoffs/ROUTE_404_AUDIT_MATRIX.md)
npm run audit:routes

# Storybook
npm run storybook                 # http://localhost:6006
npm run test:storybook            # static build

# Playwright (default base URL = https://app.flashfender.com)
# Set E2E_EMAIL / E2E_PASSWORD for authenticated journeys
npm run test:e2e

# Bruno (needs Bruno CLI: npm i -g @usebruno/cli)
npm run test:api                  # env: local
npm run test:api:staging          # env: staging — needs staging URL + creds in Bruno env

# Chromatic (needs CHROMATIC_PROJECT_TOKEN in env)
npm run chromatic

# Lighthouse CI (needs STAGING_BASE_URL; see lighthouserc.json)
npm run lhci

# k6 staging smoke (needs k6 installed + BASE_URL staging only)
npm run test:perf

# AI UX critic (optional LLM secrets)
npm run ai-ux-critic
```

---

## Required GitHub secrets (names only — do not invent tokens)

Configure in the repo that runs Actions (typically `production` / DMSPRODUCTION). **Never commit values.**

| Name | Needed by |
|------|-----------|
| `CHROMATIC_PROJECT_TOKEN` | `chromatic.yml` (blocks until set) |
| `STAGING_BASE_URL` | LHCI, k6, ZAP, Bruno (staging origin only — not `app.flashfender.com`) |
| `E2E_EMAIL` / `E2E_PASSWORD` | Full Playwright auth coverage |
| `BRUNO_EMAIL` / `BRUNO_PASSWORD` | Bruno against staging |
| `AI_UX_CRITIC_*` | Optional richer critic comments |
| `LHCI_GITHUB_APP_TOKEN` | Optional LHCI GitHub status |

See also `QA_SECRETS_CHECKLIST.md`.

---

## Safety

- k6 / ZAP / LHCI default to **staging** and refuse known prod hosts in workflow guards.
- Playwright may target prod app URL for intentional smoke with dedicated E2E users — do not point soak tools at prod.
- No Cloudflare deploy is part of this QA stack campaign.
