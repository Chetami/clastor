# Student Detail API Integration Design

## Overview

Update the frontend `StudentDetail` component to fetch individual student data from the backend API instead of using mock sample data.

## Current State

The `StudentDetail.tsx` component currently uses `SAMPLE_STUDENTS` mock data instead of fetching from the real API. The backend already has a `GET /api/students/id/:id` endpoint that returns a `StudentResponse`, but there's no frontend API integration for individual student fetching.

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

```typescript
const { data: student, isLoading, error, refetch } = useGetStudent(studentId);
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

- **404 Not Found**: Display "Student not found" message with back button
- **403 Forbidden**: Display permission error with back button
- **Network Error**: Display error message with retry button
- **Loading State**: Display loading spinner or skeleton

### Loading States

- Show loading message: "Loading student details..."
- Maintain the existing loading state pattern from `Students.tsx`

### Edge Cases

- Invalid student ID format
- Student that doesn't exist
- Student the user doesn't have permission to view
- Network failures
- Student deleted while viewing details

## Files to Modify

1. `frontend/src/features/students/api/requests.ts` - Add `getStudentRequest`
2. `frontend/src/features/students/api/use-get-student.ts` - Create new file
3. `frontend/src/features/students/api/index.ts` - Export `useGetStudent`
4. `frontend/src/features/students/StudentDetail.tsx` - Replace mock data with API

## Testing Considerations

- Mock the API response in tests
- Test loading states
- Test error states (404, 403, network errors)
- Test caching behavior
- Test that invalid IDs are handled gracefully

## Dependencies

- Existing backend endpoint: `GET /api/students/id/:id`
- React Query (already in use)
- Existing API client configuration

