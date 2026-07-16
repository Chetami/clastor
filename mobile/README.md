# Examify TMS — Mobile App

React Native (Expo) mobile app for tutors, sharing the entire data layer with the web frontend via `@examify-tms/shared`.

## Architecture

- **Expo Router** — file-based navigation (`app/` directory)
- **NativeWind v4** — Tailwind CSS styling for React Native
- **TanStack Query + Zustand** — from `@examify-tms/shared` (same hooks/stores as web)
- **Firebase JS SDK** — email/password auth (exchanged for backend JWT)
- **expo-secure-store** — secure token storage (wired into shared's `StorageAdapter`)

All API request modules, TanStack Query hooks, the auth store, the axios client, and utilities come from `@examify-tms/shared` — the mobile app only provides UI screens and platform-specific Firebase auth.

## Prerequisites

1. A running backend (`npm run dev:backend` from the repo root)
2. A Firebase project with Email/Password auth enabled

## Setup

### 1. Configure environment variables

```bash
cp .env.example .env
```

Edit `mobile/.env` and fill in:
- `EXPO_PUBLIC_API_URL` — your backend URL (use your machine's LAN IP for device testing)
- `EXPO_PUBLIC_FIREBASE_*` — your Firebase web config (Firebase console → Project settings → Your apps → SDK setup)

These are the same public Firebase values used by the web frontend (`VITE_FIREBASE_*`).

### 2. Build shared package

```bash
# From repo root
npm run build:shared
```

Re-run this whenever you change code in `shared/src/`. For live rebuilding during development:

```bash
npm run dev:shared
```

### 3. Start the dev server

```bash
# From repo root
cd mobile
npm start          # Expo dev server (scan QR for Expo Go)
npm run ios        # iOS simulator
npm run android    # Android emulator
```

> **Note:** Firebase auth (email/password) works in Expo Go. Google Sign-In and push notifications require a development build (`npx expo run:ios` / `npx expo run:android`).

## Project Structure

```
mobile/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout (providers, auth gate)
│   ├── setup.tsx           # Firebase config instructions
│   ├── login.tsx           # Login / register screen
│   ├── (app)/              # Authenticated tab navigator
│   │   ├── _layout.tsx     # Tab bar config
│   │   ├── index.tsx       # Dashboard
│   │   ├── schedule.tsx    # Lesson schedule
│   │   ├── students.tsx    # Student list
│   │   ├── payments.tsx    # Invoice list
│   │   └── settings.tsx    # Profile + sign out
│   ├── student/[id].tsx    # Student detail
│   └── +not-found.tsx
├── src/
│   ├── components/         # UI primitives (Button, Card, Text, Screen)
│   ├── config/firebase.ts  # Firebase init
│   ├── features/auth/      # Mobile-specific Firebase auth
│   ├── lib/
│   │   ├── shared-bootstrap.ts  # SecureStore adapter + configureShared()
│   │   └── polyfills.ts         # crypto.getRandomValues
│   └── types/              # NativeWind + asset type declarations
├── metro.config.js         # Monorepo + NativeWind config
├── tailwind.config.js
└── global.css
```

## How the shared layer works

The mobile app calls `initShared()` at bootstrap (`app/_layout.tsx`), which:
1. Creates a `SecureStore`-backed `StorageAdapter`
2. Calls `configureShared({ storage, apiBaseUrl })` — the shared runtime
3. Calls `useAuthStore.getState().hydrate()` — loads persisted tokens

After that, every shared hook (`useDashboardSummary`, `useListStudents`, etc.) works identically to the web app. The axios client reads/writes tokens via SecureStore transparently.

## Building for release

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure (first time only)
eas build:configure

# Build for iOS / Android
eas build --platform ios
eas build --platform android
```

Set `expo.extra.eas.projectId` in `app.json` after running `eas build:configure`.
