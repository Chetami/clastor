import { describe, expect, it, beforeEach, vi } from "vitest";

// --- Hoisted mock values (available to vi.mock factories) ----------------
const { mockTimestamp } = vi.hoisted(() => {
  const mockTimestamp = {
    now: () => ({ toDate: () => new Date(0) }),
    fromDate: (d: Date) => ({ toDate: () => d }),
  };
  return { mockTimestamp };
});

// --- Mock firebase-admin -------------------------------------------------
vi.mock("firebase-admin", () => ({
  default: { firestore: { Timestamp: mockTimestamp } },
}));

// --- Mock ../config/firebase --------------------------------------------
// We swap in an in-memory Firestore per test so we can inspect exactly which
// lessons were deleted / created.
const { mockFirestoreHolder } = vi.hoisted(() => ({
  mockFirestoreHolder: { current: null as unknown },
}));
vi.mock("../src/config/firebase", () => ({
  getFirebaseFirestore: () => mockFirestoreHolder.current,
}));

// Import after mocks are registered.
import { rescheduleSeriesFromOccurrence } from "../src/services/lessonSeriesService";

// --- In-memory Firestore mock -------------------------------------------
interface MockDoc {
  id: string;
  data: () => Record<string, unknown>;
  ref: { _collection: string; _id: string };
}

function createMockFirestore(
  seriesData: Record<string, Record<string, unknown>>,
  lessonData: Record<string, Record<string, unknown>>,
) {
  const seriesStore = new Map(Object.entries(seriesData));
  const lessonStore = new Map(Object.entries(lessonData));

  function makeRef(collectionName: string, docId: string) {
    return {
      _collection: collectionName,
      _id: docId,
      get: async () => {
        const store = collectionName === "lessonSeries" ? seriesStore : lessonStore;
        return {
          exists: store.has(docId),
          data: () => store.get(docId),
          id: docId,
        };
      },
      set: async (data: Record<string, unknown>) => {
        const store = collectionName === "lessonSeries" ? seriesStore : lessonStore;
        store.set(docId, { ...data });
      },
      update: async (data: Record<string, unknown>) => {
        const store = collectionName === "lessonSeries" ? seriesStore : lessonStore;
        store.set(docId, { ...store.get(docId), ...data });
      },
      delete: async () => {
        const store = collectionName === "lessonSeries" ? seriesStore : lessonStore;
        store.delete(docId);
      },
    };
  }

  const firestore = {
    collection(name: string) {
      return {
        doc(id: string) {
          return makeRef(name, id);
        },
        where(field: string, _op: string, value: unknown) {
          return {
            get: async () => {
              const store = name === "lessonSeries" ? seriesStore : lessonStore;
              const docs: MockDoc[] = [];
              for (const [id, data] of store.entries()) {
                if (data[field] === value) {
                  docs.push({
                    id,
                    data: () => data,
                    ref: makeRef(name, id),
                  });
                }
              }
              return { docs };
            },
          };
        },
      };
    },
    batch() {
      const ops: Array<{
        type: "set" | "delete" | "update";
        ref: { _collection: string; _id: string };
        data?: Record<string, unknown>;
      }> = [];
      return {
        set(ref: { _collection: string; _id: string }, data: Record<string, unknown>) {
          ops.push({ type: "set", ref, data });
        },
        delete(ref: { _collection: string; _id: string }) {
          ops.push({ type: "delete", ref });
        },
        update(ref: { _collection: string; _id: string }, data: Record<string, unknown>) {
          ops.push({ type: "update", ref, data });
        },
        async commit() {
          for (const op of ops) {
            const store =
              op.ref._collection === "lessonSeries" ? seriesStore : lessonStore;
            if (op.type === "set") {
              store.set(op.ref._id, { ...op.data! });
            } else if (op.type === "delete") {
              store.delete(op.ref._id);
            } else if (op.type === "update") {
              store.set(op.ref._id, { ...store.get(op.ref._id), ...op.data });
            }
          }
          ops.length = 0;
        },
      };
    },
  };

  return { firestore, seriesStore, lessonStore };
}

// --- Helpers --------------------------------------------------------------

function ts(date: Date) {
  return { toDate: () => date };
}

function iso(d: Date) {
  return d.toISOString();
}

function makeSeriesDoc(overrides: Record<string, unknown> = {}) {
  return {
    tutorId: "tutor-1",
    studentId: "stu-1",
    subject: "Mathematics",
    durationMinutes: 60,
    location: null,
    meetLink: null,
    notes: null,
    intervalWeeks: 1,
    slots: [{ dayOfWeek: "monday", timeOfDay: "09:00" }],
    timezone: "UTC",
    startDate: "2026-01-05",
    until: "2026-01-31",
    count: null,
    acceptanceStatus: "accepted",
    remindersEnabled: true,
    createdAt: ts(new Date("2026-01-01T00:00:00Z")),
    updatedAt: ts(new Date("2026-01-01T00:00:00Z")),
    ...overrides,
  };
}

function makeLessonDoc(
  start: Date,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    tutorId: "tutor-1",
    studentId: "stu-1",
    subject: "Mathematics",
    startDateTime: ts(start),
    durationMinutes: 60,
    location: null,
    meetLink: null,
    notes: null,
    todos: [],
    acceptanceStatus: "accepted",
    attendanceStatus: "unrecorded",
    seriesId: "series_test",
    isCancelled: false,
    isException: false,
    remindersEnabled: true,
    lastStudentNotifiedAt: null,
    studentNotifiedCount: 0,
    isPaid: false,
    invoiceId: null,
    googleCalendarEventId: null,
    googleCalendarSyncedAt: null,
    icsUid: null,
    rsvpTokenVersion: 0,
    createdAt: ts(new Date("2026-01-01T00:00:00Z")),
    updatedAt: ts(new Date("2026-01-01T00:00:00Z")),
    ...overrides,
  };
}

const JAN5 = new Date("2026-01-05T09:00:00.000Z"); // Monday
const JAN12 = new Date("2026-01-12T09:00:00.000Z"); // Monday
const JAN19 = new Date("2026-01-19T09:00:00.000Z"); // Monday
const JAN26 = new Date("2026-01-26T09:00:00.000Z"); // Monday

// Holds the in-memory stores for the current test.
let _stores: ReturnType<typeof createMockFirestore>;

// --- Tests ----------------------------------------------------------------

describe("rescheduleSeriesFromOccurrence", () => {
  beforeEach(() => {
    // Set up a fresh Firestore with a weekly Monday 09:00 UTC series.
    // Lessons: Jan 5, 12, 19, 26.
    const fs = createMockFirestore(
      { series_test: makeSeriesDoc() },
      {
        lesson_jan5: makeLessonDoc(JAN5),
        lesson_jan12: makeLessonDoc(JAN12),
        lesson_jan19: makeLessonDoc(JAN19),
        lesson_jan26: makeLessonDoc(JAN26),
      },
    );
    mockFirestoreHolder.current = fs.firestore;
    _stores = fs;
  });

  it("only removes lessons from the rescheduled occurrence onwards", async () => {
    // Reschedule the Jan 19 lesson (3rd of 4).
    const oldStart = JAN19;
    const newStart = new Date("2026-01-19T14:00:00.000Z"); // same day, 14:00

    const { removed } = await rescheduleSeriesFromOccurrence(
      "series_test",
      oldStart,
      newStart,
    );

    // Removed should be Jan 19 and Jan 26 — NOT Jan 5 or Jan 12.
    const removedStarts = removed
      .map((l) => (l.startDateTime as Date).toISOString())
      .sort();
    expect(removedStarts).toEqual([
      "2026-01-19T09:00:00.000Z",
      "2026-01-26T09:00:00.000Z",
    ]);

    // Jan 5 and Jan 12 must still exist in the store.
    const remaining = Array.from(_stores.lessonStore.values());
    const remainingStarts = remaining
      .map((d) => (d.startDateTime as { toDate: () => Date }).toDate().toISOString())
      .sort();
    // The two preserved originals + the regenerated ones.
    expect(remainingStarts).toContain("2026-01-05T09:00:00.000Z");
    expect(remainingStarts).toContain("2026-01-12T09:00:00.000Z");
  });

  it("regenerates occurrences starting from the rescheduled lesson's date, not today", async () => {
    // Reschedule the Jan 19 lesson to a new time (14:00 same day).
    const oldStart = JAN19;
    const newStart = new Date("2026-01-19T14:00:00.000Z");

    const { created } = await rescheduleSeriesFromOccurrence(
      "series_test",
      oldStart,
      newStart,
    );

    // Created lessons should start from Jan 19 — no lessons before oldStart.
    const createdStarts = created
      .map((l) => (l.startDateTime as Date).toISOString())
      .sort();
    expect(createdStarts).toEqual([
      "2026-01-19T14:00:00.000Z",
      "2026-01-26T14:00:00.000Z",
    ]);

    // No created lesson should be before the oldStart.
    for (const lesson of created) {
      expect((lesson.startDateTime as Date).getTime()).toBeGreaterThanOrEqual(
        oldStart.getTime(),
      );
    }
  });

  it("does not touch lessons before the rescheduled occurrence", async () => {
    // Reschedule the Jan 26 lesson (last one).
    const oldStart = JAN26;
    const newStart = new Date("2026-01-26T14:00:00.000Z");

    await rescheduleSeriesFromOccurrence("series_test", oldStart, newStart);

    // Jan 5, 12, 19 must still be in the store with their original times.
    const remaining = Array.from(_stores.lessonStore.values());
    const remainingStarts = remaining
      .map((d) => (d.startDateTime as { toDate: () => Date }).toDate().toISOString())
      .sort();

    expect(remainingStarts).toContain("2026-01-05T09:00:00.000Z");
    expect(remainingStarts).toContain("2026-01-12T09:00:00.000Z");
    expect(remainingStarts).toContain("2026-01-19T09:00:00.000Z");
    // The old Jan 26 09:00 should be gone.
    expect(remainingStarts).not.toContain("2026-01-26T09:00:00.000Z");
    // The new Jan 26 14:00 should exist.
    expect(remainingStarts).toContain("2026-01-26T14:00:00.000Z");
  });

  it("updates the series slot to the new day and time", async () => {
    // Reschedule Jan 19 (Monday) to Wednesday Jan 21 at 10:00.
    const oldStart = JAN19;
    const newStart = new Date("2026-01-21T10:00:00.000Z"); // Wednesday

    await rescheduleSeriesFromOccurrence("series_test", oldStart, newStart);

    const series = _stores.seriesStore.get("series_test")!;
    expect(series.slots).toEqual([
      { dayOfWeek: "wednesday", timeOfDay: "10:00" },
    ]);
  });

  it("reschedules to a different day of week and regenerates from oldStart", async () => {
    // Move the Monday Jan 19 slot to Wednesday 10:00 UTC.
    const oldStart = JAN19;
    const newStart = new Date("2026-01-21T10:00:00.000Z"); // Wednesday

    const { removed, created } = await rescheduleSeriesFromOccurrence(
      "series_test",
      oldStart,
      newStart,
    );

    // Jan 19 (Monday) and Jan 26 (Monday) are removed.
    expect(removed).toHaveLength(2);

    // Regenerated from Jan 19's date with the new Wednesday slot.
    // The Wednesday of the week starting Jan 19 is Jan 21.
    const createdStarts = created
      .map((l) => (l.startDateTime as Date).toISOString())
      .sort();
    expect(createdStarts).toEqual([
      "2026-01-21T10:00:00.000Z",
      "2026-01-28T10:00:00.000Z",
    ]);

    // Jan 5 and Jan 12 (before oldStart) are preserved with the original time.
    const remaining = Array.from(_stores.lessonStore.values());
    const remainingStarts = remaining
      .map((d) => (d.startDateTime as { toDate: () => Date }).toDate().toISOString())
      .sort();
    expect(remainingStarts).toContain("2026-01-05T09:00:00.000Z");
    expect(remainingStarts).toContain("2026-01-12T09:00:00.000Z");
  });

  it("applies a duration override to regenerated lessons", async () => {
    const oldStart = JAN19;
    const newStart = new Date("2026-01-19T14:00:00.000Z");

    const { created } = await rescheduleSeriesFromOccurrence(
      "series_test",
      oldStart,
      newStart,
      90,
    );

    expect(created.every((l) => l.durationMinutes === 90)).toBe(true);

    // Series doc should also reflect the new duration.
    const series = _stores.seriesStore.get("series_test")!;
    expect(series.durationMinutes).toBe(90);
  });

  it("preserves exception lessons even if they fall after oldStart", async () => {
    // Add an exception lesson on Jan 26.
    _stores.lessonStore.set(
      "lesson_exception",
      makeLessonDoc(JAN26, { isException: true }),
    );

    const oldStart = JAN19;
    const newStart = new Date("2026-01-19T14:00:00.000Z");

    const { removed } = await rescheduleSeriesFromOccurrence(
      "series_test",
      oldStart,
      newStart,
    );

    // The exception should NOT be in removed.
    expect(removed.find((l) => l.id === "lesson_exception")).toBeUndefined();

    // The exception should still be in the store.
    expect(_stores.lessonStore.has("lesson_exception")).toBe(true);
  });

  it("preserves cancelled lessons (does not remove or regenerate them)", async () => {
    // Add a cancelled lesson on Jan 26.
    _stores.lessonStore.set(
      "lesson_cancelled",
      makeLessonDoc(JAN26, { isCancelled: true }),
    );

    const oldStart = JAN19;
    const newStart = new Date("2026-01-19T14:00:00.000Z");

    const { removed } = await rescheduleSeriesFromOccurrence(
      "series_test",
      oldStart,
      newStart,
    );

    expect(removed.find((l) => l.id === "lesson_cancelled")).toBeUndefined();
    expect(_stores.lessonStore.has("lesson_cancelled")).toBe(true);
  });
});

describe("rescheduleSeriesFromOccurrence — non-weekly series", () => {
  const JAN7 = new Date("2026-01-07T19:00:00.000Z"); // Wednesday
  const JAN21 = new Date("2026-01-21T19:00:00.000Z"); // Wednesday
  const FEB4 = new Date("2026-02-04T19:00:00.000Z"); // Wednesday
  const FEB18 = new Date("2026-02-18T19:00:00.000Z"); // Wednesday

  function setupBiweekly(overrides: Record<string, unknown> = {}) {
    const fs = createMockFirestore(
      {
        series_test: makeSeriesDoc({
          intervalWeeks: 2,
          slots: [{ dayOfWeek: "wednesday", timeOfDay: "19:00" }],
          startDate: "2026-01-07",
          until: "2026-03-01",
          ...overrides,
        }),
      },
      {
        lesson_jan7: makeLessonDoc(JAN7),
        lesson_jan21: makeLessonDoc(JAN21),
        lesson_feb4: makeLessonDoc(FEB4),
        lesson_feb18: makeLessonDoc(FEB18),
      },
    );
    mockFirestoreHolder.current = fs.firestore;
    _stores = fs;
  }

  it("regenerates from the dropped week when moved to an off-cadence week", async () => {
    setupBiweekly();
    // Move the Jan 21 occurrence to Wed Jan 28 — a week that is OFF the
    // original biweekly grid (on-weeks were Jan 7, Jan 21, Feb 4, ...).
    const newStart = new Date("2026-01-28T19:00:00.000Z");

    const { removed, created } = await rescheduleSeriesFromOccurrence(
      "series_test",
      JAN21,
      newStart,
    );

    const removedStarts = removed
      .map((l) => (l.startDateTime as Date).toISOString())
      .sort();
    expect(removedStarts).toEqual([
      "2026-01-21T19:00:00.000Z",
      "2026-02-04T19:00:00.000Z",
      "2026-02-18T19:00:00.000Z",
    ]);

    // The series must follow the user's drop: first occurrence Jan 28, then
    // every 2 weeks from THAT week (not the original on-week grid).
    const createdStarts = created
      .map((l) => (l.startDateTime as Date).toISOString())
      .sort();
    expect(createdStarts).toEqual([
      "2026-01-28T19:00:00.000Z",
      "2026-02-11T19:00:00.000Z",
      "2026-02-25T19:00:00.000Z",
    ]);

    // Jan 7 (before oldStart) untouched.
    expect(_stores.lessonStore.has("lesson_jan7")).toBe(true);

    // The persisted rule is re-anchored at the dropped week.
    const series = _stores.seriesStore.get("series_test")!;
    expect(series.startDate).toBe("2026-01-28");
  });

  it("does not skip a cycle when moved to an earlier day in the same week", async () => {
    setupBiweekly();
    // Move Wed Jan 21 back to Tue Jan 20 — earlier day within the same week.
    const newStart = new Date("2026-01-20T18:00:00.000Z");

    const { created } = await rescheduleSeriesFromOccurrence(
      "series_test",
      JAN21,
      newStart,
    );

    // First occurrence must be the dropped slot itself, not a full interval
    // later (the old anchor-at-oldStart logic skipped the anchor week).
    const createdStarts = created
      .map((l) => (l.startDateTime as Date).toISOString())
      .sort();
    expect(createdStarts).toEqual([
      "2026-01-20T18:00:00.000Z",
      "2026-02-03T18:00:00.000Z",
      "2026-02-17T18:00:00.000Z",
    ]);
  });
});

describe("rescheduleSeriesFromOccurrence — count-bounded series", () => {
  it("regenerates only the remaining occurrences, not the full count", async () => {
    const fs = createMockFirestore(
      {
        series_test: makeSeriesDoc({
          startDate: "2026-01-05",
          until: null,
          count: 4,
        }),
      },
      {
        lesson_jan5: makeLessonDoc(JAN5),
        lesson_jan12: makeLessonDoc(JAN12),
        lesson_jan19: makeLessonDoc(JAN19),
        lesson_jan26: makeLessonDoc(JAN26),
      },
    );
    mockFirestoreHolder.current = fs.firestore;
    _stores = fs;

    // Reschedule the 3rd of 4 occurrences: 2 are preserved, so only 2 remain.
    const { created } = await rescheduleSeriesFromOccurrence(
      "series_test",
      JAN19,
      new Date("2026-01-19T14:00:00.000Z"),
    );

    const createdStarts = created
      .map((l) => (l.startDateTime as Date).toISOString())
      .sort();
    expect(createdStarts).toEqual([
      "2026-01-19T14:00:00.000Z",
      "2026-01-26T14:00:00.000Z",
    ]);
  });
});
