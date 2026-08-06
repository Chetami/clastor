# Clastor - Tutor Management System

A monorepo application with React SPA frontend and Node.js backend, using Firebase Authentication and a custom JWT-based auth system.

## Project Structure

```
examify-tms/
├── interfaces/               # Shared TypeScript types (YAML source)
│   └── src/
│       ├── auth/            # Auth-related schemas (YAML)
│       ├── user/            # User-related schemas (YAML)
│       ├── openapi.yaml     # Generated complete spec (not committed)
│   └── dist/               # Generated type declarations (not committed)
├── shared/                   # Shared runtime logic (domain utils, API client, hooks) — frontend + mobile only
│   └── src/
│       ├── features/         # Per-feature utils + API/hooks (lessons, payments, students, …)
│       ├── lib/              # axios client, queryClient, formatters
│       ├── store/            # Zustand auth store
│       └── runtime.ts        # configureShared() platform abstraction
├── frontend/                 # React SPA (Vite + React Router + shadcn/ui)
│   └── src/
│       ├── features/auth/    # Login page, auth services
│       ├── components/ui/    # shadcn/ui components
│       ├── services/         # API clients, Firebase config
│       ├── hooks/            # Custom hooks (useAuth)
│       └── contexts/         # AuthContext for global auth state
├── backend/                  # Node.js + Express API
│   └── src/
│       ├── controllers/     # authController
│       ├── middleware/       # auth middleware (JWT verify)
│       ├── services/         # authService, userService
│       ├── routes/          # authRoutes, docsRoutes (Swagger UI)
│       └── config/          # Firebase Admin setup
└── package.json              # Root monorepo package
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Shared types | `@examify-tms/interfaces` — YAML-based TypeScript types (auto-generated); consumed by every package |
| Shared logic | `@examify-tms/shared` — runtime domain utils, API client, React Query hooks; consumed by frontend + mobile only |
| Frontend | React 18, Vite, React Router, shadcn/ui, TypeScript |
| Backend | Node.js, Express, TypeScript, Firebase Admin SDK |
| Auth | Firebase Authentication, JWT (jsonwebtoken) |
| Database | Firestore (users collection) |
| UI | shadcn/ui (Radix UI + Tailwind CSS) |

## Prerequisites

- Node.js 18+
- npm 9+
- Firebase project with:
  - Authentication enabled (Email/Password provider)
  - Firestore database
  - Service account credentials

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

Copy the example environment file and fill in your Firebase credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual Firebase configuration values.

**Backend `.env`:**
- `JWT_SECRET` - Your secret key for JWT signing
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Service account email
- `FIREBASE_PRIVATE_KEY` - Service account private key
- `PORT` - Backend port (default: 3001)

**Frontend `.env`:**
- `VITE_API_URL` - Backend API URL
- `VITE_FIREBASE_API_KEY` - Firebase web API key
- `VITE_FIREBASE_AUTH_DOMAIN` - Firebase auth domain
- `VITE_FIREBASE_PROJECT_ID` - Firebase project ID
- And other Firebase web app config values

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

### 5. Build for Production

```bash
npm run build:all
```

## Authentication Flow

1. User enters email/password in login form
2. Firebase Client Auth authenticates user → Returns Firebase ID token
3. Frontend POSTs to `/api/auth/login` with Firebase token
4. Backend verifies Firebase token, gets user from Firestore
5. Backend generates custom JWT (1 hour expiry)
6. Frontend stores JWT, uses it for subsequent API calls
7. Protected routes use `authenticateJWT` middleware

## API Documentation

The backend includes interactive API documentation powered by Swagger UI:

- **Swagger UI**: `http://localhost:3001/api/docs`
- **OpenAPI Spec (JSON)**: `http://localhost:3001/api/docs.json`

The API specification is defined in OpenAPI 3.0 format. Type definitions are generated from YAML schemas in the interfaces package using a custom build script that merges individual schema files and produces TypeScript declarations.
- All API endpoints and methods
- Request/response schemas
- Authentication requirements
- Error responses

### Available Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|----------------|
| POST | `/api/auth/login` | Exchange Firebase token for JWT | Firebase token |
| GET | `/api/auth/verify` | Verify JWT and get user info | JWT |
| GET | `/api/docs` | Swagger UI documentation | None |
| GET | `/api/docs.json` | OpenAPI spec (JSON) | None |
| GET | `/health` | Health check endpoint | None |

## Development

- Root scripts manage all workspaces:
  - `npm run dev:backend` - Start backend dev server
  - `npm run dev:frontend` - Start frontend dev server
  - `npm run build:all` - Build all packages

## License

MIT
