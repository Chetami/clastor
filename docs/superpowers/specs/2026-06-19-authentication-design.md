# Authentication System Design

**Project:** Examify TMS - Tutor Management System
**Date:** 2026-06-19
**Status:** Approved

## Overview

A monorepo with React SPA (Vite + React Router + shadcn) frontend and Node.js backend, using Firebase Authentication and a custom JWT-based auth system following the examify pattern.

## Project Structure

```
examify-tms/
├── interfaces/               # Shared TypeScript types/interfaces
│   └── src/
│       ├── user.ts          # User, Role types
│       ├── auth.ts          # Auth-related types (JWT payload, etc.)
│       └── index.ts         # Barrel export
│
├── frontend/                 # React SPA (Vite + React Router + shadcn)
│   ├── src/
│   │   ├── features/
│   │   │   └── auth/        # Login page, auth services
│   │   ├── components/       # Shared components (shadcn)
│   │   ├── services/         # API clients, Firebase config
│   │   ├── hooks/            # Custom hooks (useAuth)
│   │   ├── types/            # Frontend-specific types
│   │   └── config/           # Routes, constants
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                  # Node.js + Express
│   ├── src/
│   │   ├── controllers/     # authController
│   │   ├── middleware/       # auth middleware (JWT verify)
│   │   ├── services/         # authService, userService
│   │   ├── routes/          # authRoutes
│   │   ├── config/          # Firebase Admin setup
│   │   └── utils/           # JWT utilities
│   ├── package.json
│   └── tsconfig.json
│
├── package.json              # Root monorepo package
└── README.md
```

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              LOGIN FLOW                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. User enters email/password                                          │
│     ┌──────────────────┐                                                │
│     │  Login Page (shadcn form)                                          │
│     └──────────────────┘                                                │
│            ↓                                                            │
│  2. Firebase Client Auth (signInWithEmailAndPassword)                     │
│     ┌──────────────────┐                                                │
│     │  Firebase Auth    │→ Returns Firebase ID Token                    │
│     └──────────────────┘                                                │
│            ↓                                                            │
│  3. POST /api/auth/login with Firebase token                            │
│     ┌───────────────────────────────────────┐                          │
│     │  Backend: authController.login()       │                          │
│     │  - Verify Firebase token               │                          │
│     │  - Get user from Firestore             │                          │
│     │  - Generate custom JWT (1h expiry)     │                          │
│     └───────────────────────────────────────┘                          │
│            ↓                                                            │
│  4. Receive JWT, store in memory/context                                 │
│     ┌──────────────────┐                                                │
│     │  Auth Context     │→ useAuth hook provides user & token           │
│     └──────────────────┘                                                │
│            ↓                                                            │
│  5. Subsequent API calls include: Authorization: Bearer <JWT>           │
│            ↓                                                            │
│  6. Protected routes use authenticateJWT middleware                      │
│     ┌───────────────────────────────────────┐                          │
│     │  Middleware attaches req.user           │                          │
│     │  - uid, email, role, subjectIds        │                          │
│     └───────────────────────────────────────┘                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Data Model

**Shared Types (`interfaces/src/`):**

```typescript
// user.ts
export type Role = "system_admin" | "tutor";

export interface User {
  id: string;              // Firebase Auth UID
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActive?: Timestamp;
}

// auth.ts
export interface JWTPayload {
  uid: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;  // 1 hour from issuance
}
```

**Firestore Collection: `users`**
- Follows the `User` interface above
- Document ID = Firebase Auth UID

**JWT Payload:**
- Follows the `JWTPayload` interface above

## Backend Components

| Component | File | Purpose |
|-----------|------|---------|
| authController | `backend/src/controllers/authController.ts` | Login endpoint, token verification, user lookup |
| authService | `backend/src/services/authService.ts` | Firebase token verification |
| userService | `backend/src/services/userService.ts` | User CRUD, JWT generation |
| auth middleware | `backend/src/middleware/auth.ts` | JWT verification, role authorization |
| authRoutes | `backend/src/routes/authRoutes.ts` | POST /api/auth/login |

**Note:** User and Role types are imported from the shared `interfaces/` package.

## Interfaces Package

The `interfaces/` directory is a shared TypeScript package containing types used by both frontend and backend:

| File | Purpose |
|------|---------|
| `interfaces/src/user.ts` | User interface, Role type |
| `interfaces/src/auth.ts` | JWTPayload interface |
| `interfaces/src/index.ts` | Barrel export for all types |

**Usage:**
- Backend: `import { User, Role } from '@examify-tms/interfaces';`
- Frontend: `import { User, Role } from '@examify-tms/interfaces';`

This ensures type consistency across the monorepo and reduces duplication.

## Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| LoginPage | `frontend/src/features/auth/LoginPage.tsx` | Email/password form (shadcn) |
| useAuth hook | `frontend/src/hooks/useAuth.ts` | Auth state, login/logout actions |
| auth service | `frontend/src/services/authService.ts` | API calls to /api/auth/login |
| AuthContext | `frontend/src/contexts/AuthContext.tsx` | Global auth state management |
| ProtectedRoute | `frontend/src/components/ProtectedRoute.tsx` | Route wrapper for auth-required pages |

## Role Management

| Role | Permissions |
|------|-------------|
| `system_admin` | Full access, can create tutors |
| `tutor` | Basic access (to be defined later) |

**Initial Setup:**
- First `system_admin` created manually in Firebase Console Firestore
- Subsequent users created by admin (future feature)

## API Endpoints

### POST /api/auth/login
**Request:**
```http
POST /api/auth/login
Authorization: Bearer <firebase-id-token>
```

**Response (200):**
```json
{
  "jwtToken": "string"
}
```

**Response (401):**
```json
{
  "message": "Invalid Firebase token"
}
```

## Environment Variables

**Backend (.env):**
```
JWT_SECRET=<your-secret>
FIREBASE_PROJECT_ID=<project-id>
FIREBASE_CLIENT_EMAIL=<service-account-email>
FIREBASE_PRIVATE_KEY=<private-key>
FIREBASE_DATABASE_URL=<database-url>
PORT=3001
```

**Frontend (.env):**
```
VITE_API_URL=http://localhost:3001
VITE_FIREBASE_API_KEY=<firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_STORAGE_BUCKET=<bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
VITE_FIREBASE_APP_ID=<app-id>
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Shared | TypeScript interfaces package (monorepo workspace) |
| Frontend | React 18, Vite, React Router, shadcn/ui, TypeScript |
| Backend | Node.js, Express, TypeScript, Firebase Admin SDK |
| Auth | Firebase Authentication, JWT (jsonwebtoken) |
| Database | Firestore (users collection only) |
| UI | shadcn/ui (Radix UI + Tailwind CSS) |

## Error Handling

| Error | Scenario | Response |
|-------|----------|----------|
| No token | Missing Authorization header | 401 "Access Denied. No token provided." |
| Invalid Firebase token | Firebase verification fails | 401 "Invalid Firebase token" |
| User not found | No Firestore document for email | 401 "User not found" |
| Invalid JWT | JWT verification fails | 401 "Invalid token" |
| Insufficient permissions | Role-based check fails | 403 "You do not have sufficient permissions" |

## Security Considerations

1. **JWT Secret**: Must be set via environment variable, never hardcoded
2. **Token Expiry**: JWT expires after 1 hour, client must re-login
3. **HTTPS**: Required in production for all API calls
4. **Firebase Rules**: Firestore rules should restrict users collection access to admin SDK only
5. **CORS**: Backend CORS configured to allow frontend origin only

## OpenAPI Documentation

The backend will include OpenAPI/Swagger documentation for the auth endpoints:
- `/api/docs` - Swagger UI
- `/api/docs.json` - OpenAPI JSON spec

## Future Considerations

- Refresh token mechanism for longer sessions
- Password reset flow via Firebase
- Multi-factor authentication
- Session management / logout from all devices
- Rate limiting on login endpoint
- Audit logging for auth events
