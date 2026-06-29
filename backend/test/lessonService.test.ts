import { describe, expect, it } from "vitest";
import type { Lesson } from "@examify-tms/interfaces";
import { mapLesson, encodeCursor, decodeCursor } from "../src/services/lessonService";

/** Firestore Timestamp stand-in: the mapper calls `.toDate()` on date fields. */
function ts(iso: string) {
  return { toDate: () => new Date(iso) };
}

const START = "2026-06-15T09:00:00.000Z";

describe("mapLesson", () => {
  it("maps a fully-populated document", () => {
    const lesson = mapLesson("lesson_1", {
      tutorId: "tutor-1",
      studentId: "stu-1",
      subject: "Mathematics",
      startDateTime: ts(START),
      durationMinutes: 60,
      location: "Online",
      notes: "prep notes",
      todos: [{ id: "t1", text: "revise", done: true }],
      acceptanceStatus: "pending",
      attendanceStatus: "unrecorded",
      seriesId: "series-1",
      isCancelled: false,
      isException: true,
      remindersEnabled: true,
      lastStudentNotifiedAt: ts("2026-06-10T08:00:00.000Z"),
      studentNotifiedCount: 2,
      isPaid: true,
      invoiceId: "inv-1",
      googleCalendarEventId: "gcal-1",
      googleCalendarSyncedAt: ts("2026-06-09T08:00:00.000Z"),
      icsUid: "lesson_1@examify-tms",
      rsvpTokenVersion: 3,
      createdAt: ts("2026-06-01T00:00:00.000Z"),
      updatedAt: ts("2026-06-02T00:00:00.000Z"),
    });

    expect(lesson.id).toBe("lesson_1");
    expect(lesson.tutorId).toBe("tutor-1");
    expect(lesson.studentId).toBe("stu-1");
    expect(lesson.subject).toBe("Mathematics");
    expect(lesson.startDateTime).toEqual(new Date(START));
    expect(lesson.durationMinutes).toBe(60);
    expect(lesson.location).toBe("Online");
    expect(lesson.notes).toBe("prep notes");
    expect(lesson.todos).toEqual([{ id: "t1", text: "revise", done: true }]);
    expect(lesson.seriesId).toBe("series-1");
    expect(lesson.isException).toBe(true);
    expect(lesson.lastStudentNotifiedAt).toEqual(
      new Date("2026-06-10T08:00:00.000Z"),
    );
    expect(lesson.studentNotifiedCount).toBe(2);
    expect(lesson.isPaid).toBe(true);
    expect(lesson.invoiceId).toBe("inv-1");
    expect(lesson.googleCalendarEventId).toBe("gcal-1");
    expect(lesson.rsvpTokenVersion).toBe(3);
  });

  it("applies defaults for missing optional fields", () => {
    const lesson = mapLesson("lesson_2", {
      tutorId: "tutor-1",
      studentId: "stu-1",
      startDateTime: ts(START),
      durationMinutes: 30,
      acceptanceStatus: "pending",
      attendanceStatus: "unrecorded",
      remindersEnabled: false,
    });

    expect(lesson.location).toBeNull();
    expect(lesson.notes).toBeNull();
    expect(lesson.todos).toEqual([]);
    expect(lesson.seriesId).toBeNull();
    expect(lesson.isCancelled).toBe(false);
    expect(lesson.isException).toBe(false);
    expect(lesson.lastStudentNotifiedAt).toBeNull();
    expect(lesson.studentNotifiedCount).toBe(0);
    expect(lesson.isPaid).toBe(false);
    expect(lesson.invoiceId).toBeNull();
    expect(lesson.googleCalendarEventId).toBeNull();
    expect(lesson.googleCalendarSyncedAt).toBeNull();
    expect(lesson.icsUid).toBeNull();
    expect(lesson.rsvpTokenVersion).toBe(0);
    expect(lesson.createdAt).toBeNull();
    expect(lesson.updatedAt).toBeNull();
  });

  it("treats an explicitly null subject as null", () => {
    const lesson = mapLesson("lesson_3", {
      subject: null,
      tutorId: "tutor-1",
      studentId: "stu-1",
      startDateTime: ts(START),
      durationMinutes: 45,
      acceptanceStatus: "pending",
      attendanceStatus: "unrecorded",
      remindersEnabled: true,
    });
    expect(lesson.subject).toBeNull();
  });

  it("returns null for a missing startDateTime", () => {
    const lesson = mapLesson("lesson_4", {
      tutorId: "tutor-1",
      studentId: "stu-1",
      durationMinutes: 45,
      acceptanceStatus: "pending",
      attendanceStatus: "unrecorded",
      remindersEnabled: true,
    });
    expect(lesson.startDateTime).toBeNull();
  });
});

describe("pagination cursor (encodeCursor / decodeCursor)", () => {
  function lessonAt(id: string, iso: string): Lesson {
    return {
      id,
      startDateTime: new Date(iso) as any,
    } as Lesson;
  }

  it("round-trips a (startDateTime, id) pair", () => {
    const lesson = lessonAt("lesson_abc", START);
    const cursor = encodeCursor(lesson);
    const decoded = decodeCursor(cursor);
    expect(decoded.id).toBe("lesson_abc");
    expect(decoded.s).toBe(new Date(START).toISOString());
  });

  it("is deterministic for the same input", () => {
    const lesson = lessonAt("lesson_abc", START);
    expect(encodeCursor(lesson)).toBe(encodeCursor(lesson));
  });

  it("is an opaque base64url string (no padding)", () => {
    const cursor = encodeCursor(lessonAt("lesson_abc", START));
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(cursor).not.toContain("=");
  });

  it("throws 'Invalid cursor' for garbage", () => {
    expect(() => decodeCursor("not-a-real-cursor")).toThrow("Invalid cursor");
    expect(() => decodeCursor("")).toThrow("Invalid cursor");
  });

  it("throws when the decoded payload is valid JSON but the wrong shape", () => {
    const wrongShape = Buffer.from(
      JSON.stringify({ foo: "bar" }),
      "utf8",
    ).toString("base64url");
    expect(() => decodeCursor(wrongShape)).toThrow("Invalid cursor");
  });

  it("throws when the payload has the right keys but an invalid date", () => {
    const badDate = Buffer.from(
      JSON.stringify({ s: "not-a-date", id: "x" }),
      "utf8",
    ).toString("base64url");
    expect(() => decodeCursor(badDate)).toThrow("Invalid cursor");
  });
});
