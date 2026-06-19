# User Registration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement complete user registration flow with Firebase Auth + Firestore + custom JWT, enabling users to sign up and be immediately logged in.

**Architecture:** Frontend creates Firebase Auth user → Backend verifies token → Backend creates Firestore document → Backend issues custom JWT → Frontend stores token and updates auth state.

**Tech Stack:** React, TypeScript, Firebase Client SDK, Express.js, Firebase Admin SDK, Firestore, OpenAPI types

---

## File Structure

### Files to Create
- None (all modifications to existing files)

### Files to Modify
| File | Responsibility |
|------|----------------|
| `interfaces/src/openapi.yaml` | Add RegisterRequest schema and /api/auth/register endpoint definition |
| `backend/src/services/userService.ts` | Add createUserInFirestore function for Firestore user creation |
| `backend/src/controllers/authController.ts` | Add register controller handler |
| `backend/src/routes/authRoutes.ts` | Add POST /api/auth/register route |
| `frontend/src/contexts/AuthContext.tsx` | Add setAuthState method for post-registration auth state update |
| `frontend/src/services/authService.ts` | Add register function for Firebase Auth + backend registration |
| `frontend/src/features/auth/SignUpPage.tsx` | Replace mock signup with actual registration call |

---

## Chunk 1: OpenAPI Types and Interfaces Package

### Task 1: Add RegisterRequest Schema to OpenAPI

**Files:**
- Modify: `interfaces/src/openapi.yaml`

- [ ] **Step 1: Add RegisterRequest schema**

Add this schema after the `LoginRequest` schema (around line 68):

```yaml
    RegisterRequest:
      type: object
      required:
        - name
      properties:
        name:
          type: string
          description: User's display name
      description: |-
        Register Request interface
        Sent from frontend to backend /api/auth/register endpoint
        Only contains name since email/password are handled by Firebase Auth
```

- [ ] **Step 2: Verify the file is valid YAML**

Run: `cd interfaces && npx yaml-validator src/openapi.yaml 2>/dev/null || echo "No yaml-validator, checking syntax manually..."`

Expected: No YAML syntax errors

- [ ] **Step 3: Build interfaces to generate TypeScript types**

Run: `cd interfaces && npm run build`

Expected: Output shows types generated successfully, no errors

- [ ] **Step 4: Verify RegisterRequest type was generated**

Run: `cat interfaces/dist/index.d.ts | grep -A 5 "RegisterRequest"`

Expected: Shows exported RegisterRequest type with name property

- [ ] **Step 5: Commit**

```bash
git add interfaces/src/openapi.yaml interfaces/dist/
git commit -m "feat(interfaces): add RegisterRequest schema for user registration"
```

---

### Task 2: Add /api/auth/register Endpoint to OpenAPI

**Files:**
- Modify: `interfaces/src/openapi.yaml`

- [ ] **Step 1: Add paths section with /api/auth/register endpoint**

Add this at the end of the file (after components section):

```yaml
paths:
  /api/auth/register:
    post:
      summary: Register a new user
      description: Creates a Firestore document for a Firebase-authenticated user and issues a custom JWT
      tags:
        - auth
      security:
        - BearerAuth: []
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
        '400':
          description: Bad request (invalid name)
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ApiError'
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

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: Firebase ID Token
```

Note: We're adding the `paths` and `components.securitySchemes` sections to the OpenAPI file. These may not exist yet.

- [ ] **Step 2: Verify YAML syntax**

Run: `cd interfaces && npx yaml-validator src/openapi.yaml 2>/dev/null || cat src/openapi.yaml | head -100`

Expected: Valid YAML structure

- [ ] **Step 3: Rebuild interfaces package**

Run: `cd interfaces && npm run build`

Expected: Types regenerated successfully

- [ ] **Step 4: Commit**

```bash
git add interfaces/
git commit -m "feat(interfaces): add /api/auth/register endpoint to OpenAPI spec"
```

---

## Chunk 2: Backend Service Layer

### Task 3: Add createUserInFirestore Function

**Files:**
- Modify: `backend/src/services/userService.ts`

- [ ] **Step 1: Add imports for User, Role types and firebase-admin**

Add these imports at the top of the file (after existing imports):

```typescript
import { User, Role } from "@examify-tms/interfaces";
import admin from "firebase-admin";
```

- [ ] **Step 2: Add createUserInFirestore function**

Add this function after the `updateLastActive` function (around line 51):

```typescript
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

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd backend && npx tsc --noEmit`

Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/userService.ts
git commit -m "feat(backend): add createUserInFirestore function"
```

---

## Chunk 3: Backend Controller Layer

### Task 4: Add register Controller Handler

**Files:**
- Modify: `backend/src/controllers/authController.ts`

- [ ] **Step 1: Add imports for register handler types**

Add these imports at the top of the file:

```typescript
import { RegisterRequest } from "@examify-tms/interfaces";
import { createUserInFirestore, getUserFromFirestore } from "../services/userService";
```

- [ ] **Step 2: Add register handler function**

Add this function after the `verifyToken` function (at the end of the file):

```typescript
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

    // 6. Update last active timestamp (consistent with login endpoint)
    await updateLastActive(user.id);

    // 7. Return UserInfo (not full User, consistent with login endpoint)
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

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd backend && npx tsc --noEmit`

Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/authController.ts
git commit -m "feat(backend): add register controller handler"
```

---

## Chunk 4: Backend Routing

### Task 5: Add /api/auth/register Route

**Files:**
- Modify: `backend/src/routes/authRoutes.ts`

- [ ] **Step 1: Add register import**

Add this import at the top of the file (after existing imports):

```typescript
import { register } from "../controllers/authController";
```

- [ ] **Step 2: Add register route**

Add this route after the `/login` route (around line 11):

```typescript
/**
 * POST /api/auth/register
 * Register endpoint - creates Firestore document for Firebase user, returns custom JWT
 * Note: Does NOT use authenticateJWT middleware because it receives a Firebase ID token
 */
router.post('/register', register);
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd backend && npx tsc --noEmit`

Expected: No TypeScript errors

- [ ] **Step 4: Build backend to ensure no errors**

Run: `cd backend && npm run build`

Expected: Build succeeds, output in dist/

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/authRoutes.ts
git commit -m "feat(backend): add /api/auth/register route"
```

---

## Chunk 5: Frontend Service Layer

### Task 6: Add register Function to authService

**Files:**
- Modify: `frontend/src/services/authService.ts`

- [ ] **Step 1: Add imports for register function**

Add these imports at the top of the file (after existing imports):

```typescript
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ApiError } from "@examify-tms/interfaces";
```

- [ ] **Step 2: Add register function**

Add this function after the `login` function (around line 41):

```typescript
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
  let firebaseUserCredential: ReturnType<typeof createUserWithEmailAndPassword> | null = null;

  try {
    // 1. Create user in Firebase Auth
    const firebaseAuth = getFirebaseAuth();
    firebaseUserCredential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    // 2. Get Firebase ID token
    const firebaseToken = await firebaseUserCredential.user.getIdToken();

    // 3. Call backend to create Firestore document and get custom JWT
    const response = await axios.post<LoginResponse>(
      `${API_URL}/api/auth/register`,
      { name },
      {
        headers: {
          Authorization: `Bearer ${firebaseToken}`,
        },
      }
    );

    return response.data;
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
    // Only rollback if error is NOT from Firebase Auth (meaning Firebase user was created but backend call failed)
    if (firebaseUserCredential && !error.code?.startsWith('auth/')) {
      try {
        await firebaseUserCredential.user.delete();
        console.log('Rolled back Firebase user due to backend error');
      } catch (deleteError) {
        console.error('Failed to rollback Firebase user:', deleteError);
      }
    }

    // Handle axios errors from backend
    if (axios.isAxiosError(error)) {
      const apiError: ApiError = error.response?.data || { message: "Registration failed" };
      throw new Error(apiError.message);
    }

    throw error;
  }
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`

Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/authService.ts
git commit -m "feat(frontend): add register function to authService"
```

---

## Chunk 6: Frontend Auth Context

### Task 7: Add setAuthState Method to AuthContext

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Add setAuthState to AuthContextType interface**

Update the interface to include the new method (around line 5):

```typescript
interface AuthContextType {
  user: UserInfo | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAuthState: (user: UserInfo, token: string) => void; // NEW
  isAuthenticated: boolean;
}
```

- [ ] **Step 2: Add setAuthState implementation in AuthProvider**

Add this function after `handleLogout` (around line 49):

```typescript
const setAuthState = (user: UserInfo, token: string) => {
  setUser(user);
  localStorage.setItem('jwtToken', token);
};
```

- [ ] **Step 3: Add setAuthState to context value**

Update the context value to include the new method (around line 53):

```typescript
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

- [ ] **Step 4: Verify TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`

Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx
git commit -m "feat(frontend): add setAuthState method to AuthContext"
```

---

## Chunk 7: Frontend Sign Up Page

### Task 8: Wire Up register Function in SignUpPage

**Files:**
- Modify: `frontend/src/features/auth/SignUpPage.tsx`

- [ ] **Step 1: Add register import**

Add this import at the top of the file:

```typescript
import { register } from "../../services/authService";
```

- [ ] **Step 2: Add setAuthState to useAuth hook call**

Update the hook call to destructure setAuthState (around line 9):

```typescript
const { setAuthState } = useAuth();
```

Note: This should be added to the existing `const { login } = useAuth();` line, like: `const { login, setAuthState } = useAuth();`

- [ ] **Step 3: Replace mock signup handler with real registration**

Replace the entire `handleSubmit` function (around line 29) with:

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
    setAuthState(user, jwtToken); // Update AuthContext with new user
    navigate('/dashboard');
  } catch (err: any) {
    setError(err.message);
  }
};
```

- [ ] **Step 4: Verify TypeScript compilation**

Run: `cd frontend && npx tsc --noEmit`

Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/auth/SignUpPage.tsx
git commit -m "feat(frontend): wire up register function in SignUpPage"
```

---

## Chunk 8: End-to-End Testing

### Task 9: Test the Registration Flow

**Files:**
- No file modifications

- [ ] **Step 1: Start backend server**

Run: `cd backend && npm run dev`

Expected: Server starts on port 3001, shows "Server running on http://localhost:3001"

- [ ] **Step 2: Start frontend dev server**

Run (in new terminal): `cd frontend && npm run dev`

Expected: Vite dev server starts, shows available on http://localhost:5173

- [ ] **Step 3: Navigate to sign-up page**

Open browser to: `http://localhost:5173/signup`

Expected: Sign-up form loads with name, email, password, confirm password fields

- [ ] **Step 4: Test happy path - register new user**

1. Enter name: "Test Tutor"
2. Enter email: "test-tutor@example.com" (use a unique email)
3. Enter password: "test123"
4. Enter confirm password: "test123"
5. Click "Sign Up"

Expected: User is redirected to `/dashboard`, JWT stored in localStorage, user state shows logged in user with `tutor` role

- [ ] **Step 5: Test email already exists error**

1. Open incognito window or logout
2. Navigate to `/signup`
3. Enter same email as before
4. Enter different password
5. Click "Sign Up"

Expected: Error message "Email already registered" is displayed

- [ ] **Step 6: Test weak password error**

1. Navigate to `/signup`
2. Enter new email
3. Enter password: "12345" (less than 6 characters)
4. Click "Sign Up"

Expected: Error message "Password must be at least 6 characters" is displayed

- [ ] **Step 7: Test password mismatch error**

1. Navigate to `/signup`
2. Enter new email
3. Enter password: "test123"
4. Enter confirm password: "test124" (different)
5. Click "Sign Up"

Expected: Error message "Passwords do not match" is displayed

- [ ] **Step 8: Test name validation**

1. Navigate to `/signup`
2. Enter new email
3. Enter password with 6+ characters
4. Enter name as empty spaces only
5. Click "Sign Up"

Expected: Error message "Name is required" is displayed from backend

- [ ] **Step 9: Verify Firestore user document**

Run (check Firestore manually or use Firebase Console):

Expected: User document exists in `users` collection with:
- `id` = Firebase Auth UID
- `name` = "Test Tutor"
- `email` = test-tutor@example.com
- `role` = "tutor"
- `createdAt`, `updatedAt`, `lastActive` timestamps

- [ ] **Step 10: Test auto-login after registration**

After successful registration in step 4:
1. Check localStorage for `jwtToken`
2. Navigate to a protected route (if any)
3. Refresh the page

Expected: User stays logged in (JWT persisted in localStorage, verified on mount)

- [ ] **Step 11: Cleanup test data**

Delete the test user from Firebase Auth and Firestore

- [ ] **Step 12: Final verification - check Swagger UI**

Open browser to: `http://localhost:3001/api/docs`

Expected: `/api/auth/register` endpoint is documented with RegisterRequest schema

- [ ] **Step 13: Commit any fixes discovered during testing**

```bash
# If any bugs were found and fixed during testing:
git add -A
git commit -m "fix: address issues found during registration testing"
```

---

## Implementation Complete

### Summary

After completing all tasks, the user registration flow should be fully functional:

1. **OpenAPI Types**: `RegisterRequest` schema defined in `interfaces/src/openapi.yaml`
2. **Backend**: `createUserInFirestore` service, `register` controller, `/api/auth/register` route
3. **Frontend**: `register` service function, `setAuthState` in AuthContext, wired up in SignUpPage
4. **Testing**: All error cases and happy path verified

### Verification Checklist

- [ ] New user can register with email/password
- [ ] User receives `tutor` role automatically
- [ ] User is immediately logged in after registration
- [ ] JWT is stored in localStorage
- [ ] User document is created in Firestore
- [ ] Error handling works for:
  - Email already exists
  - Weak password
  - Password mismatch
  - Invalid name
  - Network errors
- [ ] Rollback works (Firebase user deleted on backend failure)

### Next Steps (Optional Enhancements)

These are NOT part of this plan but could be future improvements:

1. Add email verification flow
2. Add rate limiting to `/api/auth/register` endpoint
3. Add unit tests for backend controllers and services
4. Add integration tests for the registration flow
5. Add user role assignment by admin (instead of default `tutor`)
