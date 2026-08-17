# Excluded Files — Never Committed to GitHub

These files were intentionally omitted from the Holdco main snapshot for security, size, or relevance reasons.

## Secret & Credential Files

- `.env.local` — Local Supabase, OpenAI, Stripe, Twilio, Resend credentials
- `.env*` — Any other local environment variable overrides (`.env.production`, `.env.staging`, etc.)
- `*.SECRETS.md` — All continuation/handoff secrets documents (e.g., `FLASHFENDER_CONTINUITY.SECRETS.md`)
- `handoff/**/*.SECRETS.md` — All secrets checklists in handoff directories
- `*.pem` — Certificate/private key files
- `*.p12`, `*.jks`, `*.p8`, `*.key` — Mobile push/keychain certificates

## Nested Git Repositories

- Nested `.git/` directories in `Adaptus-DMS/` and `flashfender-mobile/` — kept local only; they would become broken submodules and would not include uncommitted work correctly

## Build Artifacts & Node Dependencies

- `node_modules/` — NPM dependency trees (~763MB mobile alone)
- `.next/` — Next.js build output
- `.open-next/` — Cloudflare Worker bundle artifacts
- `.wrangler/` — Wrangler cloud build outputs
- `.wrangler-dry/` — Dry-run cloud builds
- `_worker.js.bak` — Old worker backups
- `dist/`, `web-build/` — Expo web build output
- `expo-env.d.ts` — Generated Expo TypeScript declarations
- `coverage/` — Code coverage reports
- `playwright-report/`, `test-results/`, `blob-report/` — E2E test artifacts
- `.storybook-static/` — Storybook static build
- `.tsbuildinfo` — TypeScript build info files

## Large Local Backups & Dumps

- `Adaptus-DMS.zip` (~1.1GB) — Local filesystem backup of Adaptus

## PII & Import Artifacts

- `_sync_audit/` — Local sync audit logs (PII)
- `scripts/hillz-drip-import/out/` — Hillz DRIP import export outputs (PII + large binaries)
- `qa-findings.json` — Automated QA findings data

## Editor & Workspace Config

- `.cursor/` — Cursor IDE workspace settings at project root
- `.claude/settings.json`, `.vscode/extensions.json`, `.vscode/settings.json` — Per-app editor config (tool-specific, not portable)

---

**Note:** Each app's own `.gitignore` also covers most of these paths. The root `.gitignore` additionally blocks the zip, `.cursor/`, nested `.git`, and build artifacts from sneaking into commits.
