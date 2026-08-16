# QA secrets checklist (FlashFender)

Never commit real values. Store in GitHub Actions secrets / local `.env` (gitignored).

| Secret / env | Used by | Notes |
|---|---|---|
| `E2E_EMAIL` | Playwright | Staging/prod-safe test user email |
| `E2E_PASSWORD` | Playwright | Matching password |
| `E2E_*` | Playwright | Any additional E2E_* vars (tenant id, MFA, etc.) as journeys need them |
| `PLAYWRIGHT_BASE_URL` | Playwright | Optional override (Actions **var** or env); default `https://app.flashfender.com` |
| `STAGING_BASE_URL` | Lighthouse CI, k6, ZAP, Bruno | Staging origin only — do not soak prod |
| `BRUNO_EMAIL` | Bruno (`api.yml`) | Staging API user |
| `BRUNO_PASSWORD` | Bruno (`api.yml`) | Matching password |
| `CHROMATIC_PROJECT_TOKEN` | Chromatic | Project token from chromatic.com (operator-provided; never invent) |
| `AI_UX_CRITIC_MODEL_URL` | `ai-ux-critic.yml` | Optional OpenAI-compatible chat completions URL |
| `AI_UX_CRITIC_API_KEY` | `ai-ux-critic.yml` | Optional bearer for critic LLM |
| `AI_UX_CRITIC_MODEL` | `ai-ux-critic.yml` | Optional model id (default gpt-4o-mini) |
| `LHCI_GITHUB_APP_TOKEN` | Lighthouse CI | Optional LHCI GitHub status uploads |

## Local smoke

```bash
# Unit + routes (no secrets)
npm test
npm run audit:routes

# E2E (uses PLAYWRIGHT_BASE_URL or app.flashfender.com)
E2E_EMAIL=... E2E_PASSWORD=... npm run test:e2e
```

Full matrix + Hermes notes: [`QA_STACK_README.md`](./QA_STACK_README.md).

## CI reminders

- Chromatic / LHCI / k6 / ZAP workflows need the table above; `ci.yml` unit/lint path does not.
- Prefer staging URLs for perf/security/LH; keep Playwright default prod-app URL only for intentional smoke with dedicated E2E credentials.
- `api.yml` soft-skips without `STAGING_BASE_URL` + Bruno creds; `chromatic.yml` / staging schedules hard-fail until secrets exist.
