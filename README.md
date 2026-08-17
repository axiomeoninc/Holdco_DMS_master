# Holdco DMS Master

Holdco repository for the FlashFender / Adaptus DMS platform.

## Repositories

### [Adaptus-DMS](Adaptus-DMS) — Desk web app (Cloudflare Worker)

Full dealer management system: CRM, inventory, deals, billing, SMS, email sequences, reporting. Deployed to Cloudflare Workers with OpenNext (next.config → worker).

**Deployment:** `npm run deploy:cf` (never Convex). Local dev: `npm run dev`.

**Key tools:** Next.js 16, Supabase, Drizzle ORM, Playwright E2E, Vitest unit tests.

**Secrets:** Environment variables are set in Wrangler or the Cloudflare dashboard (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.). No credentials in code.

### [flashfender-mobile](flashfender-mobile) — Expo React Native app

Mobile companion app for dealers: customer pipeline, stock, deals, tasks, credit applications.

**Setup:** `npm install && npx expo start`

## Branches

Development happens on feature branches; main holds stable releases. Use the normal fork/PR workflow for changes.

## Quick-start locally

```bash
cd Adaptus-DMS
cp .env.example .env.local   # fill in your Supabase creds
npm install
npm run dev                  # localhost:3000
```

```bash
cd flashfender-mobile
npm install
npx expo start               # Metro bundler
```
