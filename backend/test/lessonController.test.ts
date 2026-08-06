import { describe, expect, it } from "vitest";
import type { Lesson } from "@examify-tms/interfaces";
import { toLessonResponse } from "../src/controllers/lessonController";

/**
 * Guard the lesson → API response mapping. This specifically locks down the
 * bug where `invoiceId` was stamped on the Firestore doc but stripped from the
 * HTTP response, so the client could never see that a lesson had been invoiced.
 */
function lesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "lesson_1",
    tutorId: "tutor-1",
    studentId: "stu-1",
    subject: "Mathematics",
    startDateTime: new Date("2026-06-15T09:00:00.000Z"),
    durationMinutes: 60,
    location: "Online",
    meetLink: null,
    notes: null,
    todos: [],
    acceptanceStatus: "accepted",
    attendanceStatus: "present",
    seriesId: null,
    isCancelled: false,
    isException: false,
    remindersEnabled: true,
    lastStudentNotifiedAt: null,
    studentNotifiedCount: 0,
    isPaid: false,
    invoiceId: null,
    googleCalendarEventId: null,
    googleCalendarSyncedAt: null,
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides,
  } as Lesson;
}

describe("toLessonResponse", () => {
  it("includes invoiceId when the lesson has been invoiced", () => {
    const res = toLessonResponse(lesson({ invoiceId: "inv_abc", isPaid: false }));
    expect(res.invoiceId).toBe("inv_abc");
    expect(res.isPaid).toBe(false);
  });

  it("returns null invoiceId when the lesson has not been invoiced", () => {
    const res = toLessonResponse(lesson());
    expect(res.invoiceId).toBeNull();
  });

  it("serialises dates to ISO strings", () => {
    const res = toLessonResponse(lesson());
    expect(res.startDateTime).toBe("2026-06-15T09:00:00.000Z");
    expect(res.createdAt).toBe("2026-06-01T00:00:00.000Z");
  });
});
