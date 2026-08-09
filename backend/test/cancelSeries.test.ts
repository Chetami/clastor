import { describe, expect, it, beforeEach, vi } from "vitest";

// --- Hoisted mock values (available to vi.mock factories) ----------------
const { mockTimestamp } = vi.hoisted(() => {
  const mockTimestamp = {
    now: () => ({ toDate: () => new Date(0) }),
    fromDate: (d: Date) => ({ toDate: () => d }),
  };
  return { mockTimestamp };
});

vi.mock("firebase-admin", () => ({
  default: { firestore: { Timestamp: mockTimestamp } },
}));

const { mockFirestoreHolder } = vi.hoisted(() => ({
  mockFirestoreHolder: { current: null as unknown },
}));
vi.mock("../src/config/firebase", () => ({
  getFirebaseFirestore: () => mockFirestoreHolder.current,
}));

import { deleteSeriesAndFuture } from "../src/services/lessonSeriesService";
import { listLessonsBySeriesFromFirestore } from "../src/services/lessonService";

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
              return {
                docs,
                forEach: (cb: (doc: MockDoc) => void) => docs.forEach(cb),
              };
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

let _stores: ReturnType<typeof createMockFirestore>;

// --- Tests: deleteSeriesAndFuture ----------------------------------------

describe("deleteSeriesAndFuture", () => {
  beforeEach(() => {
    _stores = createMockFirestore(
      { series_test: makeSeriesDoc() },
      {
        lesson_jan5: makeLessonDoc(JAN5),
        lesson_jan12: makeLessonDoc(JAN12),
        lesson_jan19: makeLessonDoc(JAN19),
        lesson_jan26: makeLessonDoc(JAN26),
      },
    );
    mockFirestoreHolder.current = _stores.firestore;
  });

  it("only deletes lessons from the given occurrence onwards", async () => {
    // Cancel "this and future" starting from Jan 19.
    const removed = await deleteSeriesAndFuture("series_test", JAN19);

    const removedStarts = removed
      .map((l) => (l.startDateTime as Date).toISOString())
      .sort();
    expect(removedStarts).toEqual([
      "2026-01-19T09:00:00.000Z",
      "2026-01-26T09:00:00.000Z",
    ]);

    // Jan 5 and Jan 12 must still exist.
    expect(_stores.lessonStore.has("lesson_jan5")).toBe(true);
    expect(_stores.lessonStore.has("lesson_jan12")).toBe(true);
    // Jan 19 and Jan 26 should be deleted.
    expect(_stores.lessonStore.has("lesson_jan19")).toBe(false);
    expect(_stores.lessonStore.has("lesson_jan26")).toBe(false);
  });

  it("preserves earlier lessons even when all are in the future", async () => {
    // All four lessons are in the future (we use a fixed fromDate, not
    // Date.now()). Cancelling from Jan 19 should keep Jan 5 and Jan 12.
    const removed = await deleteSeriesAndFuture("series_test", JAN19);

    expect(removed).toHaveLength(2);
    const remaining = Array.from(_stores.lessonStore.values());
    const remainingStarts = remaining
      .map((d) => (d.startDateTime as { toDate: () => Date }).toDate().toISOString())
      .sort();
    expect(remainingStarts).toContain("2026-01-05T09:00:00.000Z");
    expect(remainingStarts).toContain("2026-01-12T09:00:00.000Z");
  });

  it("deletes all future lessons when fromDate is the first occurrence", async () => {
    const removed = await deleteSeriesAndFuture("series_test", JAN5);

    expect(removed).toHaveLength(4);
    expect(_stores.lessonStore.size).toBe(0);
  });

  it("deletes the series document", async () => {
    await deleteSeriesAndFuture("series_test", JAN19);

    expect(_stores.seriesStore.has("series_test")).toBe(false);
  });

  it("falls back to Date.now() when fromDate is omitted", async () => {
    // Use future-dated lessons so Date.now() cutoff includes them.
    const future1 = new Date("2099-01-05T09:00:00.000Z");
    const future2 = new Date("2099-01-12T09:00:00.000Z");
    _stores.lessonStore.set("lesson_future1", makeLessonDoc(future1));
    _stores.lessonStore.set("lesson_future2", makeLessonDoc(future2));

    const removed = await deleteSeriesAndFuture("series_test");

    // The two future lessons should be deleted; the Jan 2026 ones are past.
    const removedIds = removed.map((l) => l.id).sort();
    expect(removedIds).toEqual(["lesson_future1", "lesson_future2"]);
  });
});

// --- Tests: listLessonsBySeriesFromFirestore ------------------------------

describe("listLessonsBySeriesFromFirestore", () => {
  beforeEach(() => {
    _stores = createMockFirestore(
      { series_test: makeSeriesDoc() },
      {
        lesson_jan5: makeLessonDoc(JAN5),
        lesson_jan12: makeLessonDoc(JAN12),
        lesson_jan19: makeLessonDoc(JAN19),
        lesson_jan26: makeLessonDoc(JAN26),
      },
    );
    mockFirestoreHolder.current = _stores.firestore;
  });

  it("returns only lessons from fromDate onwards when futureOnly + fromDate", async () => {
    const lessons = await listLessonsBySeriesFromFirestore("series_test", {
      futureOnly: true,
      fromDate: JAN19,
    });

    const starts = lessons
      .map((l) => (l.startDateTime as Date).toISOString())
      .sort();
    expect(starts).toEqual([
      "2026-01-19T09:00:00.000Z",
      "2026-01-26T09:00:00.000Z",
    ]);
  });

  it("returns all lessons from fromDate when it is the first occurrence", async () => {
    const lessons = await listLessonsBySeriesFromFirestore("series_test", {
      futureOnly: true,
      fromDate: JAN5,
    });

    expect(lessons).toHaveLength(4);
  });

  it("returns all future lessons when fromDate is omitted", async () => {
    // Use future-dated lessons so Date.now() cutoff includes them.
    const future1 = new Date("2099-01-05T09:00:00.000Z");
    const future2 = new Date("2099-01-12T09:00:00.000Z");
    _stores.lessonStore.set("lesson_future1", makeLessonDoc(future1));
    _stores.lessonStore.set("lesson_future2", makeLessonDoc(future2));

    const lessons = await listLessonsBySeriesFromFirestore("series_test", {
      futureOnly: true,
    });

    // Only the two future lessons should be returned (Jan 2026 ones are past).
    expect(lessons.length).toBe(2);
  });

  it("excludes cancelled lessons even when they fall after fromDate", async () => {
    _stores.lessonStore.set(
      "lesson_cancelled",
      makeLessonDoc(JAN26, { isCancelled: true }),
    );

    const lessons = await listLessonsBySeriesFromFirestore("series_test", {
      futureOnly: true,
      fromDate: JAN19,
    });

    expect(lessons.find((l) => l.id === "lesson_cancelled")).toBeUndefined();
    // Should still get the non-cancelled Jan 19 and Jan 26.
    expect(lessons).toHaveLength(2);
  });

  it("returns all lessons (including past) when futureOnly is not set", async () => {
    const lessons = await listLessonsBySeriesFromFirestore("series_test");

    expect(lessons).toHaveLength(4);
  });
});
