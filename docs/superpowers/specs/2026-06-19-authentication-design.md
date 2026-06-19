# Authentication System Design

**Project:** Examify TMS - Tutor Management System
**Date:** 2026-06-19
**Status:** Approved

## Overview

A monorepo with React SPA (Vite + React Router + shadcn) frontend and Node.js backend, using Firebase Authentication and a custom JWT-based auth system following the examify pattern.

## Project Structure

```
examify-tms/
├── frontend/                 # React SPA (Vite + React Router + shadcn)
│   ├── src/
│   │   ├── features/
│   │   │   └── auth/        # Login page, auth services
│   │   ├── components/       # Shared components (shadcn)
│   │   ├── services/         # API clients, Firebase config
│   │   ├── hooks/            # Custom hooks (useAuth)
│   │   ├── types/            # TypeScript types
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
│   │   ├── models/          # User types
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

**Firestore Collection: `users`**

```typescript
{
  id: string              // Firebase Auth UID
  name: string
  email: string
  role: "system_admin" | "tutor"
  avatarUrl?: string
  createdAt: Timestamp
  updatedAt: Timestamp
  lastActive?: Timestamp
}
```

**JWT Payload:**
```typescript
{
  uid: string
  email: string
  role: "system_admin" | "tutor"
  iat: number
  exp: number  // 1 hour from issuance
}
```

## Backend Components

| Component | File | Purpose |
|-----------|------|---------|
| authController | `backend/src/controllers/authController.ts` | Login endpoint, token verification, user lookup |
| authService | `backend/src/services/authService.ts` | Firebase token verification |
| userService | `backend/src/services/userService.ts` | User CRUD, JWT generation |
| auth middleware | `backend/src/middleware/auth.ts` | JWT verification, role authorization |
| authRoutes | `backend/src/routes/authRoutes.ts` | POST /api/auth/login |
| User model | `backend/src/models/server/user.ts` | TypeScript types for User, Role |

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

## Testing Approach

### Unit Tests
- authService: Firebase token verification
- userService: JWT generation, user CRUD
- auth middleware: JWT validation, role checks

### Integration Tests
- POST /api/auth/login: Successful login flow
- POST /api/auth/login: Invalid Firebase token
- POST /api/auth/login: Non-existent user
- Protected routes: JWT verification

### Manual Testing
1. Create test user in Firestore manually
2. Login with email/password via Firebase Auth
3. Verify JWT is returned and stored
4. Make authenticated API request
5. Verify middleware attaches user to request

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
