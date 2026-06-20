# Student Detail API Integration Design

## Overview

Update the frontend `StudentDetail` component to fetch individual student data from the backend API instead of using mock sample data.

## Current State

The `StudentDetail.tsx` component currently uses `SAMPLE_STUDENTS` mock data instead of fetching from the real API. The backend already has a `GET /api/students/id/:id` endpoint that returns a `StudentResponse`, but there's no frontend API integration for individual student fetching.

**Existing Features in StudentDetail (out of scope for this change):**
- Notes editing functionality (lines 46-67) - uses local state, will continue to work locally
- Edit dialog with StudentForm - displays but won't persist to backend (update endpoint not yet implemented)
- These features rely on local state manipulation which will temporarily work with API data but won't persist

## Proposed Solution

### Components

#### 1. API Request Function (`api/requests.ts`)
Add a new function to fetch a single student by ID:

```typescript
export async function getStudentRequest(id: string): Promise<StudentResponse> {
  const response = await api.get<StudentResponse>(`/api/students/id/${id}`);
  return response.data;
}
```

#### 2. React Query Hook (`api/use-get-student.ts`)
Create a new hook following the existing pattern:

```typescript
export function useGetStudent(id: string | undefined) {
  return useQuery({
    queryKey: ["students", id],
    queryFn: () => getStudentRequest(id!),
    enabled: !!id,
  });
}
```

Returns: `{ data, isLoading, error, refetch }` with automatic caching and refetching.

#### 3. Update StudentDetail Component
Replace mock data with real API integration:

**Changes needed:**
1. Replace `Student` type import with `StudentResponse` type
2. Remove `students` state and `SAMPLE_STUDENTS` import
3. Add `useGetStudent` hook call
4. Update loading state check
5. Update error state check
6. Update student null check to handle undefined data
7. Remove `setStudents` calls from notes editing (keep local state UI only)

**Before:**
```typescript
import type { Student } from "@examify-tms/interfaces";
import { SAMPLE_STUDENTS } from "./student-utils";

const [students, setStudents] = useState<Student[]>(SAMPLE_STUDENTS);
const student = students.find((s) => s.id === studentId);
```

**After:**
```typescript
import type { StudentResponse } from "@examify-tms/interfaces";
import { useGetStudent } from "./api";

const { data: student, isLoading, error } = useGetStudent(studentId);
```

**Notes editing update:**
Remove `setStudents` call but keep the UI state management:
```typescript
function saveNotes() {
  if (!student) return;
  const trimmed = notesDraft.trim();
  // Remove setStudents call - notes editing is now local-only
  setNotesEditing(false);
}
```

### Data Flow

1. User navigates to `/students/:studentId`
2. `StudentDetail` component mounts with `studentId` from route params
3. `useGetStudent` hook fetches student data via `getStudentRequest`
4. React Query caches the result under `["students", studentId]`
5. Component displays loading state while fetching
6. Component displays error state if fetch fails
7. Component displays student data when available

### Error Handling

**Specific Error States:**
- **404 Not Found**: Display "Student not found" message with back button (existing UX pattern)
- **403 Forbidden**: Display "You don't have permission to view this student" with back button
- **Network Error**: Display generic error message matching `Students.tsx` pattern: "Failed to load student. Please try again."
- **Loading State**: Display loading message matching `Students.tsx` pattern: "Loading students..." (use consistent UX text)

**Error Display Pattern:**
Follow the existing `Students.tsx` pattern for consistency:
```typescript
{error && (
  <div className="flex items-center justify-center py-12">
    <p className="text-sm text-destructive">Failed to load student. Please try again.</p>
  </div>
)}
```

**Retry Behavior:**
- Rely on React Query's default retry behavior (3 retries for network errors)
- No manual retry button needed initially (can be added later if user feedback indicates need)

### Loading States

- Show loading message: "Loading student details..."
- Maintain the existing loading state pattern from `Students.tsx`

### Edge Cases

- Invalid student ID format
- Student that doesn't exist
- Student the user doesn't have permission to view
- Network failures
- Student deleted while viewing details

## Type Consistency

**Backend API Response:**
The backend endpoint returns `StudentResponse` which excludes the `tutorId` field (present in `Student` schema but not in API responses for security/privacy).

**Frontend Type Usage:**
- `StudentDetail.tsx` currently uses `Student` type from `@examify-tms/interfaces`
- The `tutorId` field is not displayed anywhere in the UI
- **Solution**: Update component to use `StudentResponse` type since:
  1. It accurately reflects the API response structure
  2. The `tutorId` field is not used in the component
  3. Maintains type safety with actual API contract

**Response Structure:**
```typescript
// Backend returns: StudentResponse
{
  id: string;
  name: string;
  email: string;
  phone: string | null;
  parentEmail: string | null;
  subject: string;
  expectedAmount: number;
  rateType: "hourly" | "per_lesson";
  frequencyPerWeek: number;
  status: "active" | "past";
  timezone: string | null;
  notes: string | null;
  amountOwed: number;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
```

## Query Strategy

**Cache Key Pattern:**
- **List query**: `["students"]` - used by `useListStudents`
- **Individual query**: `["students", id]` - compound key for specific student
- **Rationale**: Individual items use compound keys to avoid cache collisions and allow targeted invalidation

**Cache Invalidation:**
- Individual student fetches do NOT invalidate the list query
- List query has 5-minute stale time (default from `query-client.ts`)
- Individual student queries inherit same default (5 minutes)
- **Note**: This means if a user views the list, then immediately clicks a student, the detail view might be slightly stale
- **Future enhancement**: Consider shorter stale time (1-2 minutes) for detail views if freshness becomes an issue

**Refetch Behavior:**
- Rely on React Query defaults:
  - Refetch on window focus (enabled globally)
  - 5-minute stale time
  - No automatic interval refetching
- Manual refetch available via `refetch()` returned by hook (can be exposed later if needed)

## Implementation Notes

**Route Parameter Validation:**
- Hook uses `enabled: !!id` to prevent execution when `studentId` is undefined
- Component-level check: if no `studentId` param, show "Student not found" state
- No additional ID format validation needed - backend handles this

**React Query Configuration:**
- Uses default QueryClient config from `query-client.ts`
- Inherits global settings: retry behavior, stale time, cache size
- No custom configuration needed for this hook

**API Client Usage:**
- Uses existing `api` client from `@/lib/api`
- Automatically includes authentication headers
- Handles base URL configuration

**Local State Considerations:**
- Notes editing will continue to use local state (`notesDraft`, `notesEditing`)
- Changes to notes will reflect in UI but won't persist to backend (out of scope)
- Edit dialog will display current data but form submission won't persist (out of scope)
- **Future work**: Add update endpoint and form submission handler

## Files to Modify

1. `frontend/src/features/students/api/requests.ts` - Add `getStudentRequest`
2. `frontend/src/features/students/api/use-get-student.ts` - Create new file
3. `frontend/src/features/students/api/index.ts` - Export `useGetStudent`
4. `frontend/src/features/students/StudentDetail.tsx` - Replace mock data with API

## Testing Considerations

**Unit Tests:**
- Mock `getStudentRequest` to return `StudentResponse`
- Test loading state displays correctly
- Test error states (404, 403, network errors)
- Test that valid student data renders correctly
- Test that component handles undefined `studentId` gracefully

**Integration Tests:**
- Test React Query caching behavior
- Test that navigating between different students updates the view
- Test that stale data is refetched appropriately
- Test error recovery (retry mechanism)

**Manual Testing:**
- Navigate to student detail page from list view
- Test direct URL access with valid student ID
- Test direct URL access with invalid student ID (404)
- Test with student you don't have permission to view (403)
- Test with network disabled (offline/error handling)
- Test browser back/forward navigation
- Test that notes editing UI still works (local state)
- Test that edit dialog displays current data (but doesn't persist)

## Dependencies

- Existing backend endpoint: `GET /api/students/id/:id`
- React Query (already in use)
- Existing API client configuration

