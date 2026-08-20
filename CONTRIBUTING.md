# Contributing to Clastor

Thanks for your interest in contributing! This document covers setup,
conventions, and the PR process.

## Prerequisites

- Node.js 18+
- npm 9+
- A Firebase project (Authentication + Firestore) for local development —
  see the [README](README.md) for the env-var setup.

## Getting Started

```bash
git clone https://github.com/Chetami/examify-tms.git
cd examify-tms
npm install          # installs all workspaces and builds `interfaces`
cp .env.example .env # fill in Firebase + JWT credentials
```

## Repository Layout

This is an npm-workspaces monorepo:

| Package | Purpose |
|---------|---------|
| `interfaces/` | Shared **types only**, generated from OpenAPI YAML |
| `shared/` | Shared **runtime logic** (utils, API client, hooks) — frontend/mobile only |
| `backend/` | Node.js + Express API |
| `frontend/` | React SPA (Vite + shadcn/ui) |
| `mobile/` | Expo / React Native app |
| `website/` | Marketing site |

See [AGENTS.md](AGENTS.md) for detailed architecture notes, including the
`interfaces` vs `shared` split and where new code should go.

## Development Commands

```bash
npm run dev:backend    # Express dev server (tsx watch, port 3001)
npm run dev:frontend   # Vite dev server (port 5173)

npm run build:interfaces  # regenerate types from YAML (after schema changes)
npm run build:shared      # rebuild shared/ dist (consumers import the build)
npm run build:all
```

> **Important:** `frontend` and `mobile` consume `@examify-tms/shared` from
> its built `dist/`. After editing anything in `shared/src`, run
> `npm run build:shared` before typechecking or testing consumers.

## Making Changes

### Adding or changing API types

Types live in OpenAPI YAML under `interfaces/src/schemas/` — never hand-edit
generated output. Add/edit the YAML, reference new schemas in
`interfaces/src/openapi.yaml`, then run `npm run build:interfaces`.

### Backend conventions

- Validate requests at the route boundary with a Zod schema in
  `backend/src/schemas/` + `validateRequest(...)` middleware.
- Throw typed `AppError` subclasses (`BadRequestError`, `NotFoundError`, …)
  from services — never rely on string-matching error messages.
- Do not import `@examify-tms/shared` in the backend (it has client-only
  dependencies); backend-local helpers live in `backend/src/services/`.

### Tests

```bash
cd backend && npm test    # Vitest, tests in backend/test/**/*.test.ts
cd frontend && npm test
```

CI (`.github/workflows/ci.yml`) runs lint, tests, and builds for every PR to
`main` — make sure these pass locally before opening one.

## Pull Requests

1. Fork the repo and create a branch from `main`.
2. Keep PRs focused; describe what changed and why.
3. Make sure CI passes (lint, tests, builds).
4. If you changed shared schemas, mention whether `build:interfaces` /
   `build:shared` outputs were regenerated.

## License

By contributing, you agree that your contributions will be licensed under the
[AGPL-3.0](LICENSE) license that covers this project.
