import { describe, it, expect } from "vitest";
import type { LessonResponse } from "@examify-tms/interfaces";
import { lessonBadge } from "./lesson-display";

const PAST = "2020-01-01T12:00:00.000Z";
const FUTURE = "2099-01-01T12:00:00.000Z";

/** Minimal lesson cast — lessonBadge only reads attendance, isCancelled, start. */
function lesson(overrides: Partial<LessonResponse> = {}): LessonResponse {
  return {
    id: "lesson_1",
    startDateTime: PAST,
    durationMinutes: 60,
    attendanceStatus: "unrecorded",
    isCancelled: false,
    ...overrides,
  } as unknown as LessonResponse;
}

describe("lessonBadge", () => {
  describe("cancelled (forward flag or tutor-cancelled outcome)", () => {
    it("reads as Cancelled with a rose tone when the forward flag is set", () => {
      const badge = lessonBadge(
        lesson({ isCancelled: true, attendanceStatus: "present" }),
      );
      expect(badge.label).toBe("Cancelled");
      expect(badge.tone).toContain("rose");
    });

    it("reads as Cancelled for a tutor-cancelled attendance outcome", () => {
      // deriveLessonStatus collapses tutor_cancelled → cancelled, so the
      // badge surfaces "Cancelled" (the dedicated branch is unreachable).
      const badge = lessonBadge(
        lesson({ attendanceStatus: "tutor_cancelled" }),
      );
      expect(badge.label).toBe("Cancelled");
      expect(badge.tone).toContain("rose");
    });
  });

  it("reads as Upcoming with a sky tone for a future lesson", () => {
    const badge = lessonBadge(
      lesson({ startDateTime: FUTURE, attendanceStatus: "unrecorded" }),
    );
    expect(badge.label).toBe("Upcoming");
    expect(badge.tone).toContain("sky");
  });

  describe("past lessons by attendance outcome", () => {
    it("unrecorded → Not recorded (amber)", () => {
      const badge = lessonBadge(lesson({ attendanceStatus: "unrecorded" }));
      expect(badge.label).toBe("Not recorded");
      expect(badge.tone).toContain("amber");
    });

    it("present → Present (emerald)", () => {
      const badge = lessonBadge(lesson({ attendanceStatus: "present" }));
      expect(badge.label).toBe("Present");
      expect(badge.tone).toContain("emerald");
    });

    it("present_late → Late (amber)", () => {
      const badge = lessonBadge(lesson({ attendanceStatus: "present_late" }));
      expect(badge.label).toBe("Late");
      expect(badge.tone).toContain("amber");
    });

    it("absent_no_makeup → Absent (rose)", () => {
      const badge = lessonBadge(
        lesson({ attendanceStatus: "absent_no_makeup" }),
      );
      expect(badge.label).toBe("Absent");
      expect(badge.tone).toContain("rose");
    });

    it("absent_makeup_issued → Absent — credited (amber)", () => {
      const badge = lessonBadge(
        lesson({ attendanceStatus: "absent_makeup_issued" }),
      );
      expect(badge.label).toBe("Absent — credited");
      expect(badge.tone).toContain("amber");
    });

    it("absent_warning → Absent — warned (rose)", () => {
      const badge = lessonBadge(
        lesson({ attendanceStatus: "absent_warning" }),
      );
      expect(badge.label).toBe("Absent — warned");
      expect(badge.tone).toContain("rose");
    });
  });
});
