# FlashFender Mobile

Dealer client for [app.flashfender.com](https://app.flashfender.com). Native Expo shell — not a WebView wrap of the website.

## Run (local / Expo Go)

```bash
cd flashfender-mobile
cp .env.example .env   # optional; defaults to https://app.flashfender.com
npm start              # Expo Go (`expo start --go`); disables broken Linux chrome-sandbox if needed
```

Then open in Expo Go (scan QR), an emulator, or press `w` for web.

On Linux, React Native DevTools may ship a misconfigured `chrome-sandbox` under `~/.cache/dotslash/` that fatally aborts Metro. `npm start` renames that binary when present so Metro stays up (DevTools UI may be unavailable).

Typecheck: `npm run typecheck`

## Config

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | API origin (no trailing slash). Default `https://app.flashfender.com`. Set in `.env` for local, or as an EAS env / build secret for cloud builds. |

Do not put secrets in the client. Platform admin / impersonate is web-only.

## EAS builds (binaries, not store submit)

App Store / Play upload is **not** set up here — these profiles produce installable builds only (`preview` / `development` for internal testing; `production` builds a store-ready binary without submitting).

Use the **project-local** `eas-cli` (devDependency). Do **not** use bare `npx eas-cli` — the npx cache has been corrupting `@expo/eas-json`’s nested `semver` (`Cannot find module './internal/re'`).

```bash
cd flashfender-mobile
npm install                 # installs local eas-cli
npm run eas:login           # interactive Expo account login
npm run eas:configure       # first time: links project; fills extra.eas.projectId
# optional: export EXPO_PUBLIC_API_URL=https://app.flashfender.com
npm run eas:apk             # preview profile → downloadable Android APK
```

| Profile | Use |
|---|---|
| `development` | Dev client (`expo-dev-client`) for local JS + native modules |
| `preview` | Internal APK (`android.buildType: apk`) for sideload testing |
| `production` | Release binary (does **not** submit to stores by itself) |

### Push notifications

`expo-notifications` needs a real EAS `projectId` for Expo push tokens. `app.json` → `extra.eas.projectId` is left empty on purpose — run `npm run eas:configure` (or `eas init`) and paste the ID Expo gives you. Do not invent a fake ID. Until it is set, push registration no-ops / fails honestly.

### Biometrics

Face ID / device biometrics only work on a **physical device** with hardware enrolled. Simulators and web skip the gate.

### Bundle IDs

- iOS: `com.flashfender.dms`
- Android: `com.flashfender.dms`
- URL scheme: `flashfender`

## Auth

Login: `POST /api/auth/mobile/login` with `{ email, password }`.
Expects `{ data: { access_token, expires_in, user } }`.

Access token is stored in SecureStore (localStorage on web) and sent as `Authorization: Bearer <token>`. Requests use `credentials: 'include'` so the HttpOnly refresh cookie can round-trip. A 404 on mobile login is shown honestly — there is no cookie-web fallback.

## M5 foundations

- **Biometric unlock** — After login, a session flag is stored. On cold start with a token and biometrics enabled/available, Face ID / biometrics gate the tabs. Fallback: password re-login. Skipped on web / no hardware.
- **Offline reads** — Last successful stock / leads / customers / home KPI payloads are cached in AsyncStorage. Network failures show “Offline — showing last sync” when cache hits. Mutations are never inventively queued as success.
- **Push token** — After auth, requests notification permission and `POST /api/auth/mobile/push-token` when possible. Expo Go / web / denial → silent no-op; More shows notification status honestly.
