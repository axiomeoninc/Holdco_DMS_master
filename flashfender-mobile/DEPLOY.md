# FlashFender mobile deployment

Internal production only: preview APK for sideload, production AAB for Play later. Store listing, screenshots, and `eas submit` are **out of scope**.

API is always `https://app.flashfender.com` (baked on EAS `preview` and `production` in `eas.json`). Do not point binaries at DMSFINAL or a local URL.

## Prerequisites

- Logged into EAS as `flashfenders-team`
- Use **local** CLI: `npx eas-cli@22.0.0` or `npm run eas:apk` (devDependency `eas-cli@22.0.0`). Avoid a corrupted global npx cache.
- Typecheck first: `npm run typecheck`

## Android preview APK (sideload)

From this directory:

```bash
npm run typecheck
npm run eas:apk
```

Same as `eas build --profile preview --platform android`. APK is internal distribution on Expo.

Open the Expo build URL, download the APK, install on a device. Sign in with a **dealer** account (not platform Act-as; that stays web-only).

## Android production AAB

```bash
npm run eas:aab
```

Same as `eas build --profile production --platform android`. Auto-increments version via EAS `appVersionSource: remote`.

Do **not** run `eas submit` unless Play Console is ready. `submit.production` is empty on purpose.

## What must be in the binary

These native modules require a new EAS build (Expo Go will not pick them up):

- `react-native-gesture-handler`
- `react-native-keyboard-controller` (autolinked; do not add it as an `app.json` plugin — Expo loads the JS entry and fails)
- `@shopify/flash-list`
- `@gorhom/bottom-sheet`
- `sonner-native` / `react-native-svg`
- `expo-haptics`, `expo-image`
- Notification icon + Android `softwareKeyboardLayoutMode: resize`

## Keyboard

Android uses `softwareKeyboardLayoutMode: "resize"` plus `KeyboardProvider` and `KeyboardAwareScrollView` on login and all create sheets. After installing a new APK, confirm email/password fields stay above the IME.

## Push

Expo push token posts to `POST /api/auth/mobile/push-token`. No `googleServicesFile` is committed (FCM file is not in repo). Expo notification credentials on the EAS project cover preview devices. Tap payload keys: `path`, or `type` + `id` (`lead`, `invoice`, `ticket`, `vehicle`, `test_drive`, `deal`, `customer`, `follow_up`, `task`).

## iOS

No production iOS profile in this pass. Do not start an App Store submit.

## Rollback

Keep the previous Expo build URL. Install that APK. Worker/desk deploy is independent (`npx convex deploy` is not used).
