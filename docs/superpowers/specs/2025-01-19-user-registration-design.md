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
| `backend/src/services/userService.ts` | Add createUserInFirestore(uid, email, name, role) |
| `backend/src/controllers/authController.ts` | Add register(req, res) handler |
| `backend/src/routes/authRoutes.ts` | Add POST /api/auth/register route |
| `frontend/src/services/authService.ts` | Add register(name, email, password) function |
| `frontend/src/features/auth/SignUpPage.tsx` | Call authService.register() instead of mock |

### Backend Implementation Details

**`backend/src/services/userService.ts` - New function:**

```typescript
export async function createUserInFirestore(
  uid: string,
  email: string,
  name: string,
  role: Role = 'tutor'
): Promise<User> {
  const now = new Date();
  const user: User = {
    uid,
    email,
    name,
    role,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    lastActive: now,
  };

  await firestore.collection('users').doc(uid).set(user);
  return user;
}
```

**`backend/src/controllers/authController.ts` - New handler:**

```typescript
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

    // 2. Check if user already exists in Firestore
    const existingUser = await getUserFromFirestore(decodedToken.uid);
    if (existingUser) {
      res.status(409).json({ message: 'User already exists' });
      return;
    }

    // 3. Create Firestore document
    const user = await createUserInFirestore(
      decodedToken.uid,
      decodedToken.email || '',
      req.body.name,
      'tutor' // Default role for new users
    );

    // 4. Generate custom JWT
    const jwtToken = generateJWTForUser(user);

    // 5. Return response
    res.json({ jwtToken, user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
}
```

**`backend/src/routes/authRoutes.ts` - New route:**

```typescript
router.post(
  '/register',
  authenticateJWT,
  registerController
);
```

### Frontend Implementation Details

**`frontend/src/services/authService.ts` - New function:**

```typescript
export async function register(
  name: string,
  email: string,
  password: string
): Promise<LoginResponse> {
  try {
    // 1. Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    // 2. Get Firebase ID token
    const firebaseToken = await userCredential.user.getIdToken();

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
    // Map Firebase errors
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('Email already registered');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password must be at least 6 characters');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address');
    }
    throw error;
  }
}
```

**`frontend/src/features/auth/SignUpPage.tsx` - Replace mock:**

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (password !== confirmPassword) {
    setError('Passwords do not match');
    return;
  }

  try {
    setError(null);
    const { jwtToken, user } = await register(name, email, password);
    login(user, jwtToken); // Update AuthContext
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
- `auth/network-request-failed` - "Network error, try again"

### Backend Errors
- `401 Unauthorized` - Invalid/expired Firebase token
- `409 Conflict` - Firestore document already exists (race condition)
- `500 Internal Server Error` - Firestore/Firebase error

## Testing Considerations

1. **Happy path:** User registers successfully and is logged in
2. **Email already exists:** Firebase returns error before backend call
3. **Weak password:** Firebase returns error (less than 6 chars)
4. **Race condition:** If two requests create same Firebase user, backend handles 409
5. **Network failure:** Frontend shows appropriate error message

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
- Name is only user-provided field (safe to store as-is)
