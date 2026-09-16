import { describe, it, expect } from "vitest";
import type {
  ExternalCalendarEvent,
  LessonResponse,
} from "@examify-tms/interfaces";
import { findScheduleConflicts } from "./lib";

// Fixed clock so the tests are deterministic. Wednesday noon.
const NOW = new Date("2026-09-08T12:00:00.000Z");

let seq = 0;

function makeLesson(
  overrides: Partial<LessonResponse> = {},
): LessonResponse {
  return {
    id: `lesson_${++seq}`,
    studentId: "student_1",
    subject: "Mathematics",
    startDateTime: "2026-09-10T15:00:00.000Z",
    durationMinutes: 60,
    acceptanceStatus: "accepted",
    attendanceStatus: "unrecorded",
    isCancelled: false,
    remindersEnabled: true,
    isPaid: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as LessonResponse;
}

function makeEvent(
  overrides: Partial<ExternalCalendarEvent> = {},
): ExternalCalendarEvent {
  return {
    id: `ext_${++seq}`,
    title: "Google event",
    startDateTime: "2026-09-10T15:30:00.000Z",
    endDateTime: "2026-09-10T16:30:00.000Z",
    location: null,
    isAllDay: false,
    ...overrides,
  } as ExternalCalendarEvent;
}

describe("findScheduleConflicts — lesson vs lesson", () => {
  it("returns empty when there are no lessons", () => {
    expect(findScheduleConflicts([], [], { now: NOW })).toEqual([]);
  });

  it("returns empty when lessons do not overlap", () => {
    const lessons = [
      makeLesson({ startDateTime: "2026-09-10T09:00:00.000Z" }),
      makeLesson({ startDateTime: "2026-09-10T11:00:00.000Z" }),
    ];
    expect(findScheduleConflicts(lessons, [], { now: NOW })).toEqual([]);
  });

  it("reports one conflict per overlapping pair, anchored on the earlier lesson", () => {
    const first = makeLesson({
      id: "lesson_first",
      startDateTime: "2026-09-10T15:00:00.000Z",
      durationMinutes: 60,
    });
    const second = makeLesson({
      id: "lesson_second",
      startDateTime: "2026-09-10T15:30:00.000Z",
      durationMinutes: 60,
    });

    // Input order must not matter — the earlier lesson is always the anchor.
    const result = findScheduleConflicts([second, first], [], { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("lesson:lesson_first|lesson:lesson_second");
    expect(result[0].lesson.id).toBe("lesson_first");
    expect(result[0].peer).toEqual({ kind: "lesson", lesson: second });
  });

  it("does not treat touching edges as a conflict", () => {
    const lessons = [
      makeLesson({ startDateTime: "2026-09-10T15:00:00.000Z", durationMinutes: 60 }),
      makeLesson({ startDateTime: "2026-09-10T16:00:00.000Z", durationMinutes: 60 }),
    ];
    expect(findScheduleConflicts(lessons, [], { now: NOW })).toEqual([]);
  });

  it("reports a conflict that is happening right now", () => {
    // One lesson started before NOW and is still running; the other starts
    // inside it.
    const lessons = [
      makeLesson({
        startDateTime: "2026-09-08T11:30:00.000Z",
        durationMinutes: 90, // ends 13:00, so still live at NOW (12:00)
      }),
      makeLesson({ startDateTime: "2026-09-08T12:30:00.000Z", durationMinutes: 60 }),
    ];
    const result = findScheduleConflicts(lessons, [], { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].lesson.startDateTime).toBe("2026-09-08T11:30:00.000Z");
  });

  it("anchors deterministically on id when two lessons start together", () => {
    const lessons = [
      makeLesson({ id: "lesson_z", startDateTime: "2026-09-10T15:00:00.000Z" }),
      makeLesson({ id: "lesson_a", startDateTime: "2026-09-10T15:00:00.000Z" }),
    ];
    const result = findScheduleConflicts(lessons, [], { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].lesson.id).toBe("lesson_a");
    expect(result[0].id).toBe("lesson:lesson_a|lesson:lesson_z");
  });
});

describe("findScheduleConflicts — lesson exclusions", () => {
  const slot = { startDateTime: "2026-09-10T15:00:00.000Z", durationMinutes: 60 };

  it("ignores cancelled lessons", () => {
    const lessons = [
      makeLesson({ ...slot, id: "lesson_a", isCancelled: true }),
      makeLesson({ ...slot, id: "lesson_b" }),
    ];
    expect(findScheduleConflicts(lessons, [], { now: NOW })).toEqual([]);
  });

  it("ignores lessons the student declined", () => {
    const lessons = [
      makeLesson({ ...slot, id: "lesson_a", acceptanceStatus: "declined" }),
      makeLesson({ ...slot, id: "lesson_b" }),
    ];
    expect(findScheduleConflicts(lessons, [], { now: NOW })).toEqual([]);
  });

  it("ignores lessons with recorded attendance", () => {
    const lessons = [
      makeLesson({ ...slot, id: "lesson_a", attendanceStatus: "present" }),
      makeLesson({ ...slot, id: "lesson_b" }),
    ];
    expect(findScheduleConflicts(lessons, [], { now: NOW })).toEqual([]);
  });

  it("ignores lessons that fully ended before now", () => {
    // An overlap entirely in the past is unfixable — no point reporting it.
    const lessons = [
      makeLesson({ startDateTime: "2026-09-08T09:00:00.000Z", durationMinutes: 60 }),
      makeLesson({ startDateTime: "2026-09-08T09:30:00.000Z", durationMinutes: 60 }),
    ];
    expect(findScheduleConflicts(lessons, [], { now: NOW })).toEqual([]);
  });

  it("keeps pending lessons — they still block the slot", () => {
    const lessons = [
      makeLesson({ ...slot, acceptanceStatus: "pending" }),
      makeLesson({ ...slot }),
    ];
    expect(findScheduleConflicts(lessons, [], { now: NOW })).toHaveLength(1);
  });
});

describe("findScheduleConflicts — horizon", () => {
  it("ignores pairs starting beyond the default 14-day horizon", () => {
    // NOW + 15 days — outside the default horizon.
    const lessons = [
      makeLesson({ startDateTime: "2026-09-23T15:00:00.000Z", durationMinutes: 60 }),
      makeLesson({ startDateTime: "2026-09-23T15:30:00.000Z", durationMinutes: 60 }),
    ];
    expect(findScheduleConflicts(lessons, [], { now: NOW })).toEqual([]);
  });

  it("includes pairs starting within the default horizon", () => {
    // NOW is Sep 8 12:00Z, so the horizon is Sep 22 12:00Z — Sep 21 is inside.
    const lessons = [
      makeLesson({ startDateTime: "2026-09-21T15:00:00.000Z", durationMinutes: 60 }),
      makeLesson({ startDateTime: "2026-09-21T15:30:00.000Z", durationMinutes: 60 }),
    ];
    expect(findScheduleConflicts(lessons, [], { now: NOW })).toHaveLength(1);
  });

  it("honours a custom horizonDays", () => {
    const lessons = [
      makeLesson({ startDateTime: "2026-09-23T15:00:00.000Z", durationMinutes: 60 }),
      makeLesson({ startDateTime: "2026-09-23T15:30:00.000Z", durationMinutes: 60 }),
    ];
    expect(
      findScheduleConflicts(lessons, [], { now: NOW, horizonDays: 20 }),
    ).toHaveLength(1);
  });
});

describe("findScheduleConflicts — lesson vs Google Calendar event", () => {
  it("reports an overlapping external event as the peer", () => {
    const lesson = makeLesson({
      id: "lesson_a",
      startDateTime: "2026-09-10T15:00:00.000Z",
      durationMinutes: 60,
    });
    const event = makeEvent({
      id: "ext_1",
      startDateTime: "2026-09-10T15:30:00.000Z",
      endDateTime: "2026-09-10T16:30:00.000Z",
    });

    const result = findScheduleConflicts([lesson], [event], { now: NOW });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("lesson:lesson_a|external:ext_1");
    expect(result[0].lesson.id).toBe("lesson_a");
    expect(result[0].peer).toEqual({ kind: "external", event });
  });

  it("does not treat touching edges as a conflict", () => {
    const lesson = makeLesson({
      startDateTime: "2026-09-10T15:00:00.000Z",
      durationMinutes: 60,
    });
    const event = makeEvent({
      startDateTime: "2026-09-10T16:00:00.000Z",
      endDateTime: "2026-09-10T17:00:00.000Z",
    });
    expect(findScheduleConflicts([lesson], [event], { now: NOW })).toEqual([]);
  });

  it("reports one conflict per external event a lesson overlaps", () => {
    const lesson = makeLesson({
      id: "lesson_a",
      startDateTime: "2026-09-10T15:00:00.000Z",
      durationMinutes: 120,
    });
    const events = [
      makeEvent({
        id: "ext_1",
        startDateTime: "2026-09-10T15:30:00.000Z",
        endDateTime: "2026-09-10T16:00:00.000Z",
      }),
      makeEvent({
        id: "ext_2",
        startDateTime: "2026-09-10T16:10:00.000Z",
        endDateTime: "2026-09-10T16:40:00.000Z",
      }),
    ];
    const result = findScheduleConflicts([lesson], events, { now: NOW });
    expect(result.map((c) => c.id)).toEqual([
      "lesson:lesson_a|external:ext_1",
      "lesson:lesson_a|external:ext_2",
    ]);
  });

  it("reports an event that overlapped a lesson still in progress", () => {
    // NOW = 12:00. The lesson 11:30–13:00 is running; the event 11:00–11:45
    // already ended but overlapped the lesson's start — still worth flagging.
    const lesson = makeLesson({
      startDateTime: "2026-09-08T11:30:00.000Z",
      durationMinutes: 90,
    });
    const event = makeEvent({
      startDateTime: "2026-09-08T11:00:00.000Z",
      endDateTime: "2026-09-08T11:45:00.000Z",
    });
    expect(findScheduleConflicts([lesson], [event], { now: NOW })).toHaveLength(
      1,
    );
  });

  it("defaults external events to none", () => {
    const lessons = [
      makeLesson({ startDateTime: "2026-09-10T15:00:00.000Z", durationMinutes: 60 }),
      makeLesson({ startDateTime: "2026-09-10T15:30:00.000Z", durationMinutes: 60 }),
    ];
    expect(findScheduleConflicts(lessons, undefined, { now: NOW })).toHaveLength(
      1,
    );
  });
});

describe("findScheduleConflicts — ordering", () => {
  it("sorts conflicts by the anchored lesson's start time", () => {
    const late = makeLesson({
      id: "lesson_late",
      startDateTime: "2026-09-11T15:00:00.000Z",
      durationMinutes: 60,
    });
    const latePeer = makeLesson({
      id: "lesson_late_peer",
      startDateTime: "2026-09-11T15:30:00.000Z",
      durationMinutes: 60,
    });
    const early = makeLesson({
      id: "lesson_early",
      startDateTime: "2026-09-09T15:00:00.000Z",
      durationMinutes: 60,
    });
    const earlyEvent = makeEvent({
      id: "ext_early",
      startDateTime: "2026-09-09T15:30:00.000Z",
      endDateTime: "2026-09-09T16:30:00.000Z",
    });

    const result = findScheduleConflicts(
      [late, latePeer, early],
      [earlyEvent],
      { now: NOW },
    );
    expect(result.map((c) => c.lesson.id)).toEqual([
      "lesson_early",
      "lesson_late",
    ]);
    expect(result[0].peer.kind).toBe("external");
    expect(result[1].peer.kind).toBe("lesson");
  });
});