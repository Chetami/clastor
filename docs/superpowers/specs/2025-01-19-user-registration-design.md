# User Registration Design

**Date:** 2025-01-19
**Status:** Draft
**Author:** Claude

## Overview

Implement complete user registration flow for Examify TMS. Users can sign up with email/password, automatically receive `tutor` role, and are immediately logged in with a custom JWT token.

## Current State

- **Sign-in:** Fully implemented (Firebase Auth → custom JWT exchange)
- **Sign-up:** Frontend UI exists as mock only; backend has no registration endpoint
- **Types:** Login types exist in OpenAPI; registration types missing

## Requirements

1. Sign-up must actually register users in Firebase Auth and Firestore
2. All models and requests must use OpenAPI interface types from `@examify-tms/interfaces`
3. Auto-assign `tutor` role to new users
4. Auto-login after registration (smooth UX)
5. No email verification required
6. Password minimum 6 characters (Firebase default)

## Architecture

### Registration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SignUpPage.tsx                    authService.ts                          │
│  ┌─────────────────┐               ┌─────────────────────────────────┐     │
│  │  User submits   │               │  1. createUserWithEmailAndPassword()  │     │
│  │  name, email,   │───────────────▶│     (Firebase Client SDK)       │     │
│  │  password       │               │  2. getIdToken()                │     │
│  └─────────────────┘               │  3. POST /api/auth/register     │     │
│                                    │     (Headers: Firebase token)    │     │
│                                    │     (Body: { name })             │     │
│                                    └─────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Backend (Express)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  POST /api/auth/register                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. Extract Firebase token from Authorization header               │   │
│  │  2. Verify Firebase token (ensure user was just created)           │   │
│  │  3. Create Firestore document:                                     │   │
│  │       - uid: (from Firebase token)                                 │   │
│  │       - email: (from Firebase token)                                │   │
│  │       - name: (from request body)                                   │   │
│  │       - role: 'tutor' (default)                                     │   │
│  │       - createdAt, updatedAt: Timestamp.now()                       │   │
│  │  4. Generate custom JWT for user                                    │   │
│  │  5. Return { jwtToken, user }                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Frontend (React)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AuthContext stores JWT in localStorage, updates user state,               │
│  navigates to /dashboard                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Firebase creates the user** - Frontend calls `createUserWithEmailAndPassword()` directly, leveraging Firebase's built-in password validation and error handling
2. **Backend adds business data** - Firestore stores role, name, timestamps; Firebase Auth handles credentials
3. **Single endpoint** - `/api/auth/register` both creates the Firestore document AND issues the custom JWT (auto-login)
4. **Name from request body** - Email and UID come from verified Firebase token; name comes from request body

## Type Definitions

### OpenAPI Schema Additions

**Add to `interfaces/src/openapi.yaml`:**

```yaml
# New schema
RegisterRequest:
  type: object
  required:
    - name
  properties:
    name:
      type: string
      description: User's display name

# New path
paths:
  /api/auth/register:
    post:
      summary: Register a new user
      description: Creates a Firestore document for a Firebase-authenticated user and issues a custom JWT
      tags:
        - auth
      security:
        - BearerAuth: []  # Firebase ID token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/RegisterRequest'
      responses:
        '200':
          description: Registration successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/LoginResponse'
        '401':
          description: Invalid Firebase token
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiError'
        '409':
          description: User already exists
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiError'
        '500':
          description: Server error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiError'
```

**Note:** Email and password aren't in `RegisterRequest` because Firebase Auth handles those on the frontend. The backend receives the already-created Firebase user via the verified token, and only needs the additional `name` field.

**Response:** Reuses existing `LoginResponse` since registration results in an authenticated user with a JWT.

## Component Changes

### Files to Create/Modify

| File | Change |
|------|--------|
| `interfaces/src/openapi.yaml` | Add RegisterRequest schema + /register endpoint |
| `backend/src/services/userService.ts` | Add createUserInFirestore(id, email, name, role) |
| `backend/src/controllers/authController.ts` | Add register(req, res) handler |
| `backend/src/routes/authRoutes.ts` | Add POST /api/auth/register route |
| `frontend/src/contexts/AuthContext.tsx` | Add setAuthState(user, token) method |
| `frontend/src/services/authService.ts` | Add register(name, email, password) function |
| `frontend/src/features/auth/SignUpPage.tsx` | Call authService.register() instead of mock |

### Backend Implementation Details

**`backend/src/services/userService.ts` - New function:**

```typescript
import { User, Role } from "@examify-tms/interfaces";
import { getFirebaseFirestore } from "../config/firebase";
import admin from "firebase-admin";

/**
 * Create user document in Firestore
 * @param id - User ID (Firebase Auth UID)
 * @param email - User email
 * @param name - User display name
 * @param role - User role (defaults to 'tutor')
 * @returns Created user object
 */
export async function createUserInFirestore(
  id: string,
  email: string,
  name: string,
  role: Role = 'tutor'
): Promise<User> {
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();

  const userData = {
    name,
    email,
    role,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    lastActive: now,
  };

  await firestore.collection('users').doc(id).set(userData);

  // Return User object with Date objects (matching getUserFromFirestore pattern)
  return {
    id,
    name,
    email,
    role,
    avatarUrl: null,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
    lastActive: now.toDate(),
  };
}
```

**`backend/src/controllers/authController.ts` - New handler:**

```typescript
import { Request, Response } from "express";
import { RegisterRequest, LoginResponse, ApiError, UserInfo } from "@examify-tms/interfaces";
import { verifyFirebaseToken } from "../services/authService";
import { createUserInFirestore, generateJWTForUser, getUserFromFirestore } from "../services/userService";

/**
 * Register controller
 * Creates Firestore document for Firebase-authenticated user and issues custom JWT
 */
export async function register(
  req: Request<{}, {}, RegisterRequest>,
  res: Response<LoginResponse | ApiError>
): Promise<void> {
  try {
    // 1. Extract and verify Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const firebaseToken = authHeader.substring(7);
    const decodedToken = await verifyFirebaseToken(firebaseToken);

    // 2. Validate name field
    const name = req.body.name?.trim();
    if (!name) {
      res.status(400).json({ message: 'Name is required' });
      return;
    }
    if (name.length > 100) {
      res.status(400).json({ message: 'Name must be 100 characters or less' });
      return;
    }

    // 3. Check if user already exists in Firestore
    const existingUser = await getUserFromFirestore(decodedToken.uid).catch(() => null);
    if (existingUser) {
      res.status(409).json({ message: 'User already exists' });
      return;
    }

    // 4. Create Firestore document
    const user = await createUserInFirestore(
      decodedToken.uid,
      decodedToken.email || '',
      name,
      'tutor' // Default role for new users
    );

    // 5. Generate custom JWT
    const jwtToken = generateJWTForUser(user);

    // 6. Return UserInfo (not full User, consistent with login endpoint)
    const userInfo: UserInfo = {
      uid: user.id,
      email: user.email,
      role: user.role,
    };

    res.status(200).json({ jwtToken, user: userInfo });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
}
```

**`backend/src/routes/authRoutes.ts` - New route:**

```typescript
import { register } from "../controllers/authController";

/**
 * POST /api/auth/register
 * Register endpoint - creates Firestore document for Firebase user, returns custom JWT
 * Note: Does NOT use authenticateJWT middleware because it receives a Firebase ID token
 */
router.post('/register', register);
```

### Frontend Implementation Details

**`frontend/src/services/authService.ts` - New function:**

```typescript
import { createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "../config/firebase";
import { LoginResponse, ApiError } from "@examify-tms/interfaces";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Register a new user
 * Creates Firebase Auth user, then calls backend to create Firestore document
 * @param name - User's display name
 * @param email - User's email
 * @param password - User's password (min 6 characters)
 * @returns LoginResponse with JWT token and user info
 * @throws Error with user-friendly message on failure
 */
export async function register(
  name: string,
  email: string,
  password: string
): Promise<LoginResponse> {
  let firebaseUser: ReturnType<typeof createUserWithEmailAndPassword> | null = null;

  try {
    // 1. Create user in Firebase Auth
    firebaseUser = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    // 2. Get Firebase ID token
    const firebaseToken = await firebaseUser.user.getIdToken();

    // 3. Call backend to create Firestore document and get custom JWT
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firebaseToken}`,
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.message);
    }

    return await response.json();
  } catch (error: any) {
    // Map Firebase Auth errors
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Email already registered');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your connection and try again.');
    }

    // Handle backend errors - rollback Firebase user creation
    if (firebaseUser && error.message !== 'Email already registered') {
      try {
        await firebaseUser.user.delete();
      } catch (deleteError) {
        console.error('Failed to rollback Firebase user:', deleteError);
      }
    }

    throw error;
  }
}
```

**AuthContext Modification - Add method to set user state:**

**`frontend/src/contexts/AuthContext.tsx` - Add to interface and provider:**

```typescript
interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuthState: (user: UserInfo, token: string) => void; // NEW
  isAuthenticated: boolean;
}

// In AuthProvider component:
const setAuthState = (user: UserInfo, token: string) => {
  setUser(user);
  localStorage.setItem('jwtToken', token);
};

// In context value:
<AuthContext.Provider
  value={{
    user,
    loading,
    login: handleLogin,
    logout: handleLogout,
    setAuthState, // NEW
    isAuthenticated: !!user,
  }}
>
```

**`frontend/src/features/auth/SignUpPage.tsx` - Replace mock:**

```typescript
const { setAuthState } = useAuth(); // Add this to hook calls

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (password !== confirmPassword) {
    setError('Passwords do not match');
    return;
  }

  try {
    setError(null);
    const { jwtToken, user } = await register(name, email, password);
    setAuthState(user, jwtToken); // Update AuthContext with new user
    navigate('/dashboard');
  } catch (err: any) {
    setError(err.message);
  }
};
```

## Error Handling

### Frontend Errors (from Firebase Client SDK)
- `auth/email-already-in-use` - "Email already registered"
- `auth/weak-password` - "Password must be at least 6 characters"
- `auth/invalid-email` - "Invalid email address"
- `auth/network-request-failed` - "Network error. Please check your connection and try again."

### Backend Errors
- `400 Bad Request` - Invalid name (empty or too long)
- `401 Unauthorized` - Invalid/expired Firebase token
- `409 Conflict` - User already exists in Firestore
- `500 Internal Server Error` - Firestore/Firebase error

### Rollback Strategy
If backend registration fails after successful Firebase user creation (e.g., network error, 500 error), the frontend deletes the Firebase Auth user to prevent leaving orphaned accounts. This keeps the system in a consistent state.

## Testing Considerations

1. **Happy path:** User registers successfully, JWT is stored in localStorage, AuthContext state is updated, user is redirected to dashboard
2. **Email already exists:** Firebase returns error before backend call, shows "Email already registered"
3. **Weak password:** Firebase returns error (less than 6 chars), shows appropriate message
4. **Invalid name:** Backend validates name is not empty and not too long
5. **Race condition:** If two requests create same Firebase user, backend handles 409 gracefully
6. **Network failure:** Frontend shows appropriate error message
7. **Rollback on backend error:** Firebase user is deleted if backend registration fails after successful Firebase user creation
8. **Auto-login:** User is immediately logged in (JWT stored, AuthContext updated, redirected to dashboard)

## Implementation Order

1. Add OpenAPI types and rebuild interfaces package
2. Implement backend service (createUserInFirestore)
3. Implement backend controller (register)
4. Add backend route
5. Implement frontend service (register)
6. Update frontend component (SignUpPage)
7. Test end-to-end

## Security Notes

- Firebase token is verified on backend via Firebase Admin SDK
- User email comes from verified token, not request body (prevents spoofing)
- UID comes from verified token (prevents privilege escalation)
- Name is only user-provided field (validated for length, safe to store)
- **Rate limiting consideration:** The `/api/auth/register` endpoint should have rate limiting applied (e.g., express-rate-limit middleware) to prevent automated account creation attacks. This can be added in a future iteration.
