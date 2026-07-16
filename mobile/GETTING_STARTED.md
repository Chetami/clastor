# Getting Started — Mobile App

This guide walks you through running the Examify TMS mobile app from a
clean clone to a working iOS simulator.

---

## Prerequisites

| Requirement | Check |
|---|---|
| **Node.js** ≥ 18 | `node --version` |
| **Xcode** (latest) | `xcodebuild -version` |
| **Xcode license accepted** | `sudo xcodebuild -license accept` |
| **CocoaPods** | `pod --version` |
| **Backend running** | `curl http://localhost:3001/health` |

---

## Step 1 — Install dependencies (repo root)

```bash
cd examify-tms
npm install
```

This installs all workspace packages (`interfaces`, `shared`, `backend`,
`frontend`, `mobile`).

---

## Step 2 — Build the shared package

The mobile app consumes `@examify-tms/shared` as a compiled package. Build
it once, then again whenever you change shared code:

```bash
npm run build:shared
```

> **Tip:** During active development on shared code, run it in watch mode in
> a separate terminal:
> ```bash
> npm run dev:shared
> ```

---

## Step 3 — Configure environment variables

Your `mobile/.env` is already created with your Firebase values. Verify it:

```bash
cat mobile/.env
```

It should look like:
```
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=xamify-tms.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=xamify-tms
...
```

**Physical device?** Change `localhost` to your Mac's LAN IP:

```bash
# Find your IP
ipconfig getifaddr en0

# Edit mobile/.env
EXPO_PUBLIC_API_URL=http://192.168.1.105:3001
```

The iOS **simulator** can reach `localhost` directly — no change needed.

---

## Step 4 — Start the backend

In a separate terminal:

```bash
npm run dev:backend
```

Verify it's up:

```bash
curl http://localhost:3001/health
# → { "status": "ok" }
```

---

## Step 5 — Start the mobile app

```bash
cd mobile
npm run ios
```

This launches the Expo dev server + boots the iOS simulator automatically.

**First run** will take a few minutes (Metro bundling + pod install). You'll
see the Metro bundler URL in the terminal.

If it asks to install CocoaPods, press `y`.

---

## Step 6 — Log in

Use the same credentials you use on the web app. The mobile app shares the
same backend + Firebase Auth + JWT session, so any existing account works.

---

## Troubleshooting

### `xcrun is not configured correctly` / exit code 69

Accept the Xcode license:

```bash
sudo xcodebuild -license accept
```

### App shows "Setup needed" screen

Your `mobile/.env` is missing or has empty Firebase values. Expo inlines
`EXPO_PUBLIC_*` variables at bundle time — **restart the dev server** after
editing `.env`:

```bash
# Press Ctrl+C in the Expo terminal, then:
npm run ios
```

### "Network request failed" / blank screens

The backend isn't reachable from the device/simulator:

- **Simulator:** backend must be running on `localhost:3001`
- **Physical device:** set `EXPO_PUBLIC_API_URL` to your Mac's LAN IP, not
  `localhost`

### Metro cache issues

Clear everything and restart:

```bash
cd mobile
npx expo start --clear
```

### Shared package changes not reflected

The mobile app reads `shared/dist/`. Rebuild:

```bash
# Repo root
npm run build:shared

# Or keep it running:
npm run dev:shared
```

---

## Running on Android

```bash
cd mobile
npm run android
```

Requires Android Studio with an emulator running, or a physical device with
USB debugging enabled.

---

## What works in Expo Go vs. Dev Build

| Feature | Expo Go | Dev Build |
|---|---|---|
| Email/password login | ✅ | ✅ |
| Dashboard, Schedule, Students, Payments | ✅ | ✅ |
| Biometric lock (Face ID) | ❌ | ✅ |
| Push notifications | ❌ | ✅ |
| Google Sign-In | ❌ | ✅ (future) |

For a dev build (needed for biometrics + notifications):

```bash
npm install -g eas-cli
eas build --profile development --platform ios
```

---

## Daily workflow

You'll typically have three terminals running:

```bash
# Terminal 1 — Backend
npm run dev:backend

# Terminal 2 — Shared watch (only if editing shared code)
npm run dev:shared

# Terminal 3 — Mobile dev server
cd mobile && npm run ios
```

Press `r` in the Expo terminal to reload the app after code changes.
