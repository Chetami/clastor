# Clastor — Tutor Management System

Clastor is an open-source platform for running a tutoring business: schedule
lessons, sync with Google Calendar, send automated reminders, take payments
through Stripe, and manage students — all in one place.

A monorepo with a React web app, an Expo (React Native) mobile app, a Node.js
backend, and a marketing website, using Firebase Authentication with a custom
JWT-based auth layer.

## Features

- **Scheduling** — lessons, recurring lesson series, and a calendar that
  two-way syncs with Google Calendar; Google Meet links generated automatically
- **Students** — student profiles, subjects, and notes/progress tracking
- **Payments** — Stripe checkout, invoices (PDF), payment tracking, and
  Stripe Connect for multi-tutor practices
- **Email** — transactional email via SMTP with editable templates and
  automated lesson reminders
- **Auth** — email/password (Firebase) and Google OAuth, with short-lived
  access JWTs + refresh tokens
- **Roles** — `system_admin` and `tutor` with per-domain permissions, plus an
  admin dashboard
- **Extras** — iCal feed export, tutor profiles, feedback collection,
  waitlist/public booking pages, analytics (PostHog)

## Project Structure

```
clastor/
├── interfaces/               # Shared TypeScript types (YAML source)
│   └── src/
│       ├── schemas/          # OpenAPI schemas by domain (auth, users, …)
│       ├── openapi.yaml      # Main entry point with schema $refs
│       └── dist/             # Generated type declarations (not committed)
├── shared/                   # Shared runtime logic (domain utils, API client, hooks) — frontend + mobile only
│   └── src/
│       ├── features/         # Per-feature utils + API/hooks (lessons, payments, students, …)
│       ├── lib/              # axios client, queryClient, formatters
│       ├── store/            # Zustand auth store
│       └── runtime.ts        # configureShared() platform abstraction
├── frontend/                 # React SPA (Vite + React Router + shadcn/ui)
│   └── src/
│       ├── features/         # Feature modules (auth, schedule, payments, …)
│       ├── components/ui/    # shadcn/ui components
│       ├── services/         # API clients, Firebase config
│       ├── hooks/            # Custom hooks (useAuth)
│       └── contexts/         # AuthContext for global auth state
├── backend/                  # Node.js + Express API
│   └── src/
│       ├── controllers/      # Route handlers
│       ├── middleware/       # Auth, validation, rate limiting
│       ├── services/         # Business logic
│       ├── routes/           # Express routers
│       ├── schemas/          # Zod request-validation schemas
│       └── config/           # Firebase Admin, Stripe, email, OAuth setup
├── mobile/                   # Expo / React Native app
├── website/                  # Marketing site
└── package.json              # Root monorepo package
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Shared types | `@examify-tms/interfaces` — YAML-based TypeScript types (auto-generated); consumed by every package |
| Shared logic | `@examify-tms/shared` — runtime domain utils, API client, React Query hooks; consumed by frontend + mobile only |
| Frontend | React 19, Vite, React Router, shadcn/ui, TypeScript |
| Mobile | Expo (React Native), Expo Router |
| Backend | Node.js, Express, TypeScript, Firebase Admin SDK |
| Auth | Firebase Authentication (email/password + Google), JWT with refresh tokens |
| Database | Google Firestore |
| Payments | Stripe (Checkout + Connect + webhooks) |
| Email | Nodemailer (SMTP), Google OAuth for Calendar/Meet |
| UI | shadcn/ui (Radix UI + Tailwind CSS) |

## Prerequisites

- Node.js 18+
- npm 9+
- A Firebase project with:
  - Authentication enabled (Email/Password and optionally Google providers)
  - Firestore database
  - Service account credentials
- Optional, per feature: Stripe account (payments), SMTP credentials
  (transactional email), Google OAuth client (Calendar/Meet sync), PostHog
  project (analytics)

## Getting Started

### 1. Install Dependencies

From the root directory:

```bash
npm install
```

This will install dependencies for all packages (interfaces, shared, backend, frontend, mobile, website).

> **Two shared packages:** `@examify-tms/interfaces` holds **types only**
> (generated from OpenAPI YAML, used by every package), while
> `@examify-tms/shared` holds **runtime logic** (domain utils, the axios API
> client, Zustand store, React Query hooks — used by the frontend and mobile
> clients only). Don't confuse the two; the backend does not depend on `shared`.

### 2. Configure Environment Variables

Copy the example env files and fill in your credentials — see
`backend/.env.example` and `frontend/.env.example` for the full list with
comments:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

**Backend (minimum):**
- `JWT_SECRET`, `REFRESH_TOKEN_SECRET` — token signing secrets
- `FIREBASE_SERVICE_ACCOUNT_KEY_PATH` — path to your service account JSON
- `PORT` — backend port (default: 3001)

**Optional integrations:** `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`
(payments), `SMTP_*` / `EMAIL_FROM` (email), `GOOGLE_OAUTH_*`
(Calendar/Meet), `DISCORD_CONTACT_WEBHOOK_URL` (contact notifications).

**Frontend:** `VITE_API_URL` plus your Firebase web-app config values
(`VITE_FIREBASE_*`).

### 3. Create Your First Admin User

1. Create a user in Firebase Console > Authentication
2. Create a matching document in Firestore `users` collection:

```javascript
{
  name: "Admin User",
  email: "admin@example.com",
  role: "system_admin",
  createdAt: new Date(),
  updatedAt: new Date()
}
```

Document ID should match the Firebase Auth UID.

### 4. Run the Application

**Backend:**
```bash
npm run dev:backend
```
Server runs on http://localhost:3001
- API Docs: http://localhost:3001/api/docs (Swagger UI)
- Health check: http://localhost:3001/health

**Frontend:**
```bash
npm run dev:frontend
```
App runs on http://localhost:5173

**Mobile / website:** `npm run dev:mobile`, `npm run dev:website`.

### 5. Build for Production

```bash
npm run build:all
```

## Authentication Flow

1. User signs in with email/password (Firebase) or Google OAuth
2. Frontend exchanges the Firebase/Google credential for app tokens via
   `POST /api/auth/login` or the Google OAuth callback
3. Backend verifies the credential, loads the user from Firestore, and issues
   a short-lived access JWT plus a 30-day refresh token
4. Frontend stores the tokens and uses the access JWT for API calls,
   refreshing it via `/api/auth/refresh` as needed
5. Protected routes use the `authenticateJWT` middleware (plus per-route
   role/permission checks)

## API Documentation

The backend serves interactive API documentation:

- **Swagger UI**: `http://localhost:3001/api/docs`
- **OpenAPI Spec (JSON)**: `http://localhost:3001/api/docs.json`

The API specification is defined in OpenAPI 3.0 format; TypeScript types are
generated from the YAML schemas in the interfaces package.

### API Areas

| Prefix | Description |
|--------|-------------|
| `/api/auth` | Login, verify, refresh, Google OAuth |
| `/api/students` | Student CRUD |
| `/api/lessons` | Lessons and lesson series |
| `/api/payments` | Payments and invoices |
| `/api/meetings` | Google Meet integration |
| `/api/users` | User management |
| `/api/tutor-profiles` | Public tutor profiles |
| `/api/dashboard` | Dashboard data |
| `/api/calendar` | Calendar sync + iCal feed |
| `/api/feedback` | Feedback collection |
| `/api/templates` | Email templates |
| `/api/sent-emails` | Sent-email log |
| `/api/contact` | Public contact form |
| `/api/stripe` | Stripe checkout + webhooks |
| `/api/admin` | Admin-only endpoints (`system_admin`) |
| `/health` | Health check |

## Development

- Root scripts manage all workspaces:
  - `npm run dev:backend` — start backend dev server
  - `npm run dev:frontend` — start frontend dev server
  - `npm run build:all` — build all packages

See [AGENTS.md](AGENTS.md) for detailed architecture notes and conventions,
and [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.

## Deployment

Deployment scripts and environment definitions are kept in a private
infrastructure repository — see [deploy/README.md](deploy/README.md) for
guidance on self-hosting.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, conventions, and the PR
process. Please note our [code of conduct](CODE_OF_CONDUCT.md).

Found a security issue? Follow the responsible-disclosure process in
[SECURITY.md](SECURITY.md).

## License

This project is licensed under the **GNU Affero General Public License v3.0**
([LICENSE](LICENSE)).

In short: you are free to use, modify, and distribute this software —
including commercially — but any modifications must be made available under
the same license. Because Clastor is a web application, network/server use
counts as distribution: if you run a modified version as a hosted service,
you must offer its source code to its users.
