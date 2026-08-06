# AGENTS.md

This file provides guidance to AI coding agents working in this repository.

## Project Overview

Clastor is a monorepo Tutor Management System with a React web client, an Expo (React Native) mobile app, and a Node.js backend, using Firebase Authentication with a custom JWT-based auth layer. The project uses npm workspaces with six packages: `interfaces` (shared types), `shared` (shared runtime logic), `backend`, `frontend`, `mobile`, and `website`.

### Key Design Pattern: YAML-Based Type Generation

The `interfaces` package uses OpenAPI 3.0 specs to define all shared types. Schemas are organized across multiple YAML files under `src/schemas/`, with a main `src/openapi.yaml` that references them using `$ref` imports. The build process:

1. `npm run build:types` - Runs `openapi-typescript` to generate `dist/index.d.ts` with types nested under `components['schemas']['TypeName']`
2. `npm run build:reexports` - Post-process script adds top-level re-exports for backward compatibility (`export type TypeName = components['schemas']['TypeName']`)
3. Other packages import from `@examify-tms/interfaces`

**Schema organization:**
- `interfaces/src/openapi.yaml` - Main entry point with schema references
- `interfaces/src/schemas/common/` - Shared types (ApiError, Role)
- `interfaces/src/schemas/auth/` - Authentication types (LoginRequest, LoginResponse, JwtPayload, UserInfo)
- `interfaces/src/schemas/users/` - User domain types (User)

**When adding new types:**
1. Create a new YAML file in the appropriate `schemas/` subdirectory
2. Add a `$ref` entry in `src/openapi.yaml` under `components.schemas`
3. Run `npm run build:interfaces` from the root
4. The generated types will be available as both `components['schemas']['TypeName']` and `TypeName`

## Two Shared Packages — `interfaces` vs `shared`

The repo has **two** shared packages. They are easy to confuse but serve
different purposes — read this before adding shared code.

### `@examify-tms/interfaces` — types only
OpenAPI 3.0 YAML under `interfaces/src/schemas/` generates **all** shared
TypeScript types (see "YAML-Based Type Generation" above). It ships essentially
zero runtime code (the only exception is `featureFlags.ts`). Consumed by
**every** package. Import as `@examify-tms/interfaces`.

### `@examify-tms/shared` — runtime domain logic & data layer
Platform-agnostic runtime code shared by the web and mobile clients:
- **Pure helpers** — date/lesson/invoice utils, label maps, currency/date
  formatters, zod schemas (e.g. `features/lessons/lesson-utils.ts`,
  `features/payments/invoice-utils.ts`).
- **Data layer** — the axios API client, Zustand auth store, TanStack Query
  client, and every feature's request modules + hooks (`features/*/api`).

Consumed by **`frontend` and `mobile` only**. It is intentionally **not** a
dependency of `backend` — `shared` pulls in client-only deps (axios, zustand,
@tanstack/react-query, zod, date-fns). Web and mobile each call
`configureShared()` once at bootstrap, before any network hook runs.

> ⚠️ Do **not** add `import ... from "@examify-tms/shared"` to the backend.
> Pure helpers the backend also needs are currently re-implemented backend-side
> (`backend/src/services/*`). If you consolidate them, keep the shared helpers
> free of client deps, or keep them backend-local.

### Where to put new shared code

| You're adding… | Put it in… |
|----------------|------------|
| API request/response/domain **types** | `interfaces/src/schemas/*.yaml`, then rebuild types |
| **Pure domain logic**, formatters, constants, zod schemas | `shared/src/features/**`, re-export from `shared/src/index.ts` |
| API client calls / React Query hooks | `shared/src/features/<feature>/api` (re-export from the barrel) |
| Backend-only business logic | `backend/src/services` |

### Frontend barrels re-export `shared`
Each frontend feature has a thin barrel that re-exports from `shared` so imports
stay local (e.g. `frontend/src/features/schedule/lesson-utils.ts` re-exports
`shared`'s lesson utils, `frontend/src/features/payments/invoice-utils.ts`
re-exports the invoice utils). Prefer these barrels in the frontend unless you
need something only `shared` exposes directly.

## Common Commands

### Development
```bash
# Install all dependencies (runs interfaces build via postinstall)
npm install

# Start backend dev server (tsx watch, port 3001)
npm run dev:backend

# Start frontend dev server (Vite, port 5173)
npm run dev:frontend

# Build all packages
npm run build:all
```

### Backend Only
```bash
cd backend
npm run dev          # Start with tsx watch
npm run build        # TypeScript compile to dist/
npm start            # Run compiled dist/server.js
npm test             # Run unit tests once (Vitest)
npm run test:watch   # Vitest in watch mode
```

Tests live in `backend/test/**/*.test.ts` (outside `src/` so `tsc` doesn't
emit them into `dist/`). Vitest config is `backend/vitest.config.ts`.

### Frontend Only
```bash
cd frontend
npm run dev          # Vite dev server
npm run build        # tsc + vite build
npm run preview      # Preview production build
npm run lint         # ESLint
```

### Interfaces Only
```bash
cd interfaces
npm run build        # Generate TypeScript types from openapi.yaml
npm run clean        # Remove dist/
```

### Shared Only
```bash
cd shared
npm run build        # TypeScript compile to dist/ (consumers import the built dist)
npm run dev          # tsc --watch
npm run clean        # Remove dist/
```

> `frontend` and `mobile` import `@examify-tms/shared` from its **built**
> `dist/`, so after editing `shared` source you must rebuild it (`npm run build`
> in `shared/`, or `npm run build:shared` from the root) before typecheck/tests
> in the consumers pick up the change.

## Code Organization

### Backend (`backend/src/`)
- `server.ts` - Express app setup, middleware, route mounting
- `middleware/auth.ts` - `authenticateJWT`, `requireRole()` factory for role-based authorization
- `routes/authRoutes.ts` - Auth endpoints (POST /login, GET /verify)
- `routes/docsRoutes.ts` - Swagger UI at `/api/docs`
- `controllers/authController.ts` - Login/verify handlers
- `services/authService.ts`, `services/userService.ts` - Business logic
- `config/firebase.ts` - Firebase Admin SDK initialization
- `utils/jwt.ts` - JWT generation, verification, token extraction

### Frontend (`frontend/src/`)
- `main.tsx` - Entry point, wraps app in `AuthProvider`
- `contexts/AuthContext.tsx` - Global auth state (user, loading, login/logout), JWT persistence in localStorage
- `services/authService.ts` - API calls for login/logout/verify
- `config/firebase.ts` - Firebase Client SDK initialization
- `features/auth/` - Login page components
- `components/ui/` - shadcn/ui components (Radix UI + Tailwind)

### Shared (`shared/src/`)
- `index.ts` - Package barrel; everything `shared` exports is listed here
- `runtime.ts` - `configureShared()` platform abstraction (storage + API base URL), called once at bootstrap
- `lib/` - Low-level utilities (axios `api` client, `queryClient`, `cn`, timezones, currency)
- `store/auth-store.ts` - Zustand auth store
- `features/<domain>/` - Per-feature folders, each with `api/` (request modules + React Query hooks) and pure `*-utils.ts` / `*-schema.ts` helpers
  - e.g. `features/lessons/lesson-utils.ts`, `features/payments/invoice-utils.ts`

### Type Safety

All API request/response types and domain models are defined in the OpenAPI specs under `interfaces/src/schemas/` and imported from `@examify-tms/interfaces`. Never duplicate these definitions—add to the appropriate schema YAML file instead.

**File structure:**
```
interfaces/src/
├── openapi.yaml              # Main entry point with $refs
└── schemas/
    ├── common/               # Shared types
    ├── auth/                 # Authentication types
    └── users/                # User domain types
```

## Firestore Schema

**Collection:** `users`

Document ID = Firebase Auth UID

```typescript
{
  name: string,
  email: string,
  role: 'system_admin' | 'tutor',
  avatarUrl?: string | null,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastActive?: Timestamp | null
}
```

## Testing the API

Backend serves Swagger UI at `http://localhost:3001/api/docs` for interactive API documentation and testing.

Health check: `http://localhost:3001/health`
