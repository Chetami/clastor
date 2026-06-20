# List Students Endpoint Design

**Date:** 2026-06-20
**Status:** Proposed

## Overview

Add a `GET /api/students` endpoint to retrieve student records. The endpoint respects role-based access control where tutors see only their own students and system admins see all students. Filtering, search, and sorting are handled client-side by the frontend.

## Requirements

### Functional Requirements
- Authenticated tutors can list only students they created (filtered by `tutorId`)
- Authenticated system admins can list all students
- Endpoint returns all matching students (no pagination)
- Response includes student array and total count

### Non-Functional Requirements
- Follow existing 3-layer architecture pattern (Service → Controller → Routes)
- Reuse existing types from `interfaces` package
- Maintain consistency with create student endpoint

## Architecture

### Backend Components

#### 1. Service Layer (`backend/src/services/studentService.ts`)

Add `listStudentsFromFirestore()` function:

```typescript
export async function listStudentsFromFirestore(
  userId: string,
  role: string
): Promise<Student[]> {
  // Query Firestore for students
  // If role is 'tutor', filter by tutorId === userId
  // If role is 'system_admin', no filtering
  // Return array of Student objects
}
```

**Key Implementation Details:**
- Uses `getFirebaseFirestore()` to get Firestore instance
- For tutors: `collection.where("tutorId", "==", userId).get()`
- For admins: `collection.get()`
- Converts Firestore timestamps to `Date` objects
- Returns empty array if no students found

#### 2. Controller Layer (`backend/src/controllers/studentController.ts`)

Add `listStudents()` controller:

```typescript
export async function listStudents(
  req: Request,
  res: Response<StudentListResponse | ApiError>
): Promise<void> {
  // Get user from req.user (set by authenticateJWT)
  // Call service layer
  // Return StudentListResponse with data and total
}
```

**Key Implementation Details:**
- Checks `req.user` exists (401 if not)
- Extracts `userId` and `role` from `req.user`
- Calls `listStudentsFromFirestore(userId, role)`
- Returns `{ data: students, total: students.length }`
- Returns 500 with `ApiError` on failure

#### 3. Routes Layer (`backend/src/routes/studentRoutes.ts`)

Add GET route:

```typescript
router.get("/", authenticateJWT, listStudents);
```

**Access Control:**
- `authenticateJWT` middleware required
- No `requireRole` check (both tutors and admins allowed)
- Role-based filtering happens in service layer

### Interface Updates

#### Response Schema (`interfaces/src/schemas/students/res/StudentListResponse.yaml`)

Simplify response structure:

```yaml
type: object
required:
  - data
  - total
properties:
  data:
    type: array
    items:
      $ref: './StudentResponse.yaml'
  total:
    type: integer
    minimum: 0
```

Remove `limit` and `offset` fields (pagination not implemented).

### Frontend Components

#### 1. API Hook (`frontend/src/features/students/api/index.ts`)

Add `useListStudents` hook:

```typescript
export function useListStudents() {
  return useQuery<Student[]>({
    queryKey: ["students"],
    queryFn: async () => {
      const response = await fetch("/api/students", {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch students");
      const data = await response.json();
      return data.data; // StudentListResponse.data
    },
  });
}
```

#### 2. Students Page (`frontend/src/features/students/Students.tsx`)

Replace mock data with API call:

```typescript
// Remove: const [students, setStudents] = useState<Student[]>(SAMPLE_STUDENTS);
// Add:
const { data: students = [], isLoading, error } = useListStudents();
```

Keep existing client-side filtering, search, and sorting logic unchanged.

## Data Flow

```
1. Frontend calls GET /api/students with JWT in Authorization header
2. authenticateJWT middleware verifies JWT and sets req.user
3. listStudents controller extracts userId and role from req.user
4. listStudentsFromFirestore service queries Firestore:
   - If tutor: WHERE tutorId == userId
   - If admin: no filter
5. Service returns Student[]
6. Controller returns StudentListResponse { data: [...], total }
7. Frontend receives data and applies client-side filtering/search/sorting
```

## Error Handling

- **401 Unauthorized:** Missing or invalid JWT
- **500 Internal Server Error:** Firestore query failure or unexpected error

All errors return `ApiError` format: `{ message: string }`

## Testing Strategy

### Backend Testing
1. Use Swagger UI at `http://localhost:3001/api/docs`
2. Test as tutor: verify only own students returned
3. Test as admin: verify all students returned
4. Test with no students: verify empty array returned

### Frontend Testing
1. Verify students load on page mount
2. Verify filtering, search, sorting still work with real data
3. Verify loading state displays during fetch
4. Verify error handling for failed requests

## Implementation Order

1. Update interfaces (simplify StudentListResponse)
2. Rebuild interfaces: `npm run build:interfaces`
3. Implement service layer function
4. Implement controller function
5. Add GET route
6. Test with Swagger UI
7. Create frontend API hook
8. Update Students page to use API
9. Test end-to-end

## Future Considerations

### Pagination (Not Implemented)
The `ListStudentsQuery` interface supports `limit` and `offset`, but these are not implemented in this design. Pagination can be added later if the dataset grows large.

### Server-Side Filtering (Not Implemented)
Search, status filtering, and subject filtering happen client-side. For large datasets, consider moving these to the backend with Firestore queries.

### Sorting (Not Implemented)
Sorting is client-side only. For large datasets, consider adding backend sorting with Firestore orderBy.

## Dependencies

- Existing auth middleware (`authenticateJWT`)
- Existing Firebase config (`getFirebaseFirestore`)
- Existing student types from `interfaces` package
- Existing StudentResponse schema
