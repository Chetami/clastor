name: backend-endpoint
description: Implement a new backend endpoint following the Examify TMS pattern. Use when creating new API endpoints for students, users, or any domain. Includes: checking interfaces, creating service/controller/routes layers, updating server.ts, and building interfaces.

## Pattern Overview

Examify TMS backend follows a consistent 3-layer architecture:

1. **Service Layer** (`backend/src/services/`) - Business logic, Firestore operations, ID generation
2. **Controller Layer** (`backend/src/controllers/`) - Request/response handling, validation, role checks
3. **Routes Layer** (`backend/src/routes/`) - Route definitions, middleware composition

## Implementation Checklist

### 1. Check Existing Interfaces

Before writing code, verify what types already exist in `interfaces/src/schemas/`:

```bash
# Check if request/response types exist
ls interfaces/src/schemas/{domain}/req/
ls interfaces/src/schemas/{domain}/res/
```

**If types exist:** Import and use them directly.
**If types missing:** Create new YAML schema files in `interfaces/src/schemas/{domain}/`.

### 2. Create/Update Interfaces (if needed)

When creating new schemas:

1. Create YAML file in `interfaces/src/schemas/{domain}/{name}.yaml`
2. Add `$ref` to `interfaces/src/openapi.yaml` under `components.schemas`
3. Rebuild interfaces:
   ```bash
   npm run build:interfaces
   ```
4. Update `interfaces/scripts/add-reexports.js` to include new types
5. Rebuild again to generate top-level exports

### 3. Implement Service Layer

Create `backend/src/services/{domain}Service.ts`:

```typescript
import { getFirebaseFirestore } from "../config/firebase";
import { RequestType, ResponseType } from "@examify-tms/interfaces";
import admin from "firebase-admin";
import crypto from "crypto";

// ID generation function (if needed)
function generateId(): string {
  const randomBytes = crypto.randomBytes(12).toString("hex");
  return `{prefix}_${randomBytes}`;
}

export async function create{Entity}InFirestore(
  data: RequestType,
  userId: string  // or other context
): Promise<ResponseType> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();
    const id = generateId();

    const docData = {
      // ... map fields from data
      createdAt: now,
      updatedAt: now,
    };

    await firestore.collection("{collection}").doc(id).set(docData);

    // Return response object with Date objects
    return {
      id,
      // ... map fields
      createdAt: now.toDate() as any,
      updatedAt: now.toDate() as any,
    };
  } catch (error) {
    console.error("Failed to create {entity}:", error);
    throw new Error("Failed to create {entity}");
  }
}
```

**Key patterns:**
- Use `admin.firestore.Timestamp.now()` for timestamps
- Return `Date` objects via `.toDate()` for API responses
- Use `as any` for type compatibility with generated interfaces
- Generate IDs with `{prefix}_{randomHex}` pattern
- Include `createdAt` and `updatedAt` on all documents

### 4. Implement Controller Layer

Create `backend/src/controllers/{domain}Controller.ts`:

```typescript
import { Request, Response } from "express";
import { {action}InFirestore } from "../services/{domain}Service";
import { RequestType, ResponseType, ApiError } from "@examify-tms/interfaces";

export async function {action}(
  req: Request<{}, {}, RequestType>,
  res: Response<ResponseType | ApiError>
): Promise<void> {
  try {
    // Get authenticated user from middleware
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Call service layer
    const result = await {action}InFirestore(req.body, req.user.uid);

    // Map to response type
    const response: ResponseType = {
      // ... map fields
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("{action} failed:", error);
    const message = error instanceof Error ? error.message : "Failed to {action}";
    res.status(500).json({ message });
  }
}
```

**Key patterns:**
- Check `req.user` for authenticated context
- Use typed Request/Response interfaces
- Return `ApiError` type for errors
- Use appropriate HTTP status codes (201 for creation, 200 for updates)
- Always catch and log errors

### 5. Implement Routes Layer

Create `backend/src/routes/{domain}Routes.ts`:

```typescript
import { Router } from "express";
import { {action} } from "../controllers/{domain}Controller";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

// Route with authentication and role check
router.{method}(
  "/{path}",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  {action}
);

export default router;
```

**Role patterns:**
- `authenticateJWT` - Required for all protected routes
- `requireRole("tutor", "system_admin")` - Both tutors and admins
- `requireRole("system_admin")` - Admins only
- No middleware - Public endpoint (rare)

### 6. Mount Routes in server.ts

Update `backend/src/server.ts`:

```typescript
// Add import
import {domain}Routes from "./routes/{domain}Routes";

// Mount route
app.use("/api/{route}", {domain}Routes);
```

### 7. Verify Implementation

```bash
# Check TypeScript compilation
cd backend && npx tsc --noEmit

# Start dev server to test
npm run dev:backend

# Test endpoint at http://localhost:3001/api/docs
```

## Common Patterns

### Firestore Collection Access

```typescript
const firestore = getFirebaseFirestore();
const collection = firestore.collection("{collectionName}");

// Get document
const doc = await collection.doc(id).get();

// Create document
await collection.doc(id).set(data);

// Update document
await collection.doc(id).update(data);

// List/query documents
const snapshot = await collection
  .where("field", "==", value)
  .get();
```

### Middleware Chain Composition

```typescript
// Multiple middleware
router.post(
  "/path",
  authenticateJWT,           // 1. Verify JWT
  requireRole("admin"),      // 2. Check role
  validateRequest,            // 3. Custom validation
  controllerHandler           // 4. Execute controller
);
```

### Default Values

For nullable fields with defaults:
```typescript
const docData = {
  field: data.field || null,
  optionalField: data.optionalField ?? defaultValue,
};
```

## Error Handling

Always use try-catch and return `ApiError` type:
```typescript
catch (error) {
  console.error("Operation failed:", error);
  const message = error instanceof Error ? error.message : "Default error message";
  res.status(errorStatus).json({ message });
}
```

## Testing Endpoints

Use Swagger UI at `http://localhost:3001/api/docs` to test endpoints interactively.

**Testing authenticated endpoints:**
1. First call `/api/auth/login` to get JWT
2. Copy JWT token
3. In Swagger UI, click "Authorize" button
4. Enter: `Bearer YOUR_JWT_TOKEN`
5. Test protected endpoints
