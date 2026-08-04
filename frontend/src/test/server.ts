import { setupServer } from "msw/node";
import { http, HttpResponse, delay } from "msw";

/**
 * MSW request handlers shared by every integration test. Each handler maps a
 * backend endpoint to deterministic fixture data so tests exercise the REAL
 * shared axios client + TanStack Query hooks end-to-end, with no module
 * mocking. Individual tests can override any of these via `server.use(...)`.
 */

// A small, self-contained tutor user matching the `UserInfo` contract.
export const mockUser = {
  uid: "user_1",
  email: "tutor@example.com",
  name: "Test Tutor",
  role: "tutor",
  avatarUrl: null,
  onboardingComplete: true,
} as const;

export const mockStudents = [
  {
    id: "stu_1",
    tutorId: "user_1",
    name: "Ada Lovelace",
    email: "ada@example.com",
    phone: null,
    parentEmail: null,
    billingEmail: "ada@example.com",
    billingEmailSource: "student",
    subjectIds: [],
    expectedAmount: 60,
    rateType: "hourly",
    frequencyPerWeek: 2,
    status: "active",
    timezone: null,
    notes: null,
    amountOwed: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "stu_2",
    tutorId: "user_1",
    name: "Alan Turing",
    email: "alan@example.com",
    phone: null,
    parentEmail: null,
    billingEmail: "alan@example.com",
    billingEmailSource: "student",
    subjectIds: [],
    expectedAmount: 90,
    rateType: "per_lesson",
    frequencyPerWeek: 1,
    status: "active",
    timezone: null,
    notes: null,
    amountOwed: 0,
    createdAt: "2025-01-02T00:00:00.000Z",
    updatedAt: "2025-01-02T00:00:00.000Z",
  },
] as const;

export const defaultHandlers = [
  // Auth bootstrap — `useVerifyToken` GETs this on app mount.
  http.get("*/api/auth/verify", () =>
    HttpResponse.json({
      jwtToken: "test-jwt",
      refreshToken: "test-refresh",
      user: mockUser,
    }),
  ),

  // Student list — backs `useListStudents`.
  http.get("*/api/students", () =>
    HttpResponse.json({ data: mockStudents }),
  ),

  // Single-student detail.
  http.get("*/api/students/id/:id", ({ params }) => {
    const student = mockStudents.find((s) => s.id === params.id);
    if (!student) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(student);
  }),

  // passthrough for anything we deliberately haven't stubbed yet — keeps the
  // `onUnhandledRequest: "error"` policy from blocking local dev assets.
  http.get("*/health", () => HttpResponse.json({ ok: true })),
];

/** A failing handler tests can opt into to exercise error states. */
export function studentsErrorHandlers(status = 500) {
  return [
    http.get("*/api/students", async () => {
      await delay(10);
      return HttpResponse.json(
        { message: "Something went wrong loading students." },
        { status },
      );
    }),
  ];
}

export const server = setupServer(...defaultHandlers);
