import type {
  ExternalCalendarEvent,
  LessonResponse,
} from "@examify-tms/interfaces";
import { isRangeOverlap, lessonEndDate } from "../lessons/lesson-utils";

/**
 * What a lesson conflicts with: either another lesson (the tutor is
 * double-booked) or an external Google Calendar event.
 */
export type ConflictPeer =
  | { kind: "lesson"; lesson: LessonResponse }
  | { kind: "external"; event: ExternalCalendarEvent };

/**
 * One overlap the tutor needs to resolve. The row anchors on `lesson` — the
 * earlier-starting lesson of a lesson-vs-lesson pair, or the lesson itself
 * when the conflict is with a Google Calendar event.
 */
export type ScheduleConflict = {
  /** Stable key for lists, e.g. "lesson:a|lesson:b" (earlier lesson first). */
  id: string;
  /** The lesson the conflict is anchored on. */
  lesson: LessonResponse;
  /** The event that overlaps it. */
  peer: ConflictPeer;
};

export type FindScheduleConflictsOptions = {
  /** Clock for "now" — injectable for tests. Defaults to the real time. */
  now?: Date;
  /** How many days ahead to scan. Defaults to 14. */
  horizonDays?: number;
};

/** Lesson end time in ms — always derived from start + duration. */
function lessonEndMs(lesson: LessonResponse): number {
  return lessonEndDate(lesson).getTime();
}

/**
 * Lessons that can still conflict: not cancelled, not declined by the
 * student, attendance not yet recorded, still running or upcoming, and
 * starting within the horizon window. Sorted ascending by start (ties by
 * id) so the pair sweep can stop early.
 */
function conflictCandidates(
  lessons: LessonResponse[],
  nowMs: number,
  horizonMs: number,
): LessonResponse[] {
  return lessons
    .filter((lesson) => {
      if (lesson.isCancelled) return false;
      if (lesson.acceptanceStatus === "declined") return false;
      if (lesson.attendanceStatus !== "unrecorded") return false;
      const startMs = new Date(lesson.startDateTime).getTime();
      if (startMs >= horizonMs) return false;
      return lessonEndMs(lesson) > nowMs;
    })
    .sort((a, b) => {
      const diff =
        new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
      if (diff !== 0) return diff;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/**
 * Find schedule conflicts over the next `horizonDays` days:
 * - lesson vs lesson (the tutor is double-booked), and
 * - lesson vs external Google Calendar event (when passed).
 *
 * A lesson-vs-lesson pair yields ONE conflict anchored on the
 * earlier-starting lesson. Touching edges (one event ends exactly when the
 * other starts) do not conflict. Cancelled, declined, already-taught and
 * fully-past lessons are ignored — only overlaps the tutor can still fix
 * are reported. Results are sorted by the anchored lesson's start time.
 */
export function findScheduleConflicts(
  lessons: LessonResponse[],
  externalEvents: ExternalCalendarEvent[] = [],
  options: FindScheduleConflictsOptions = {},
): ScheduleConflict[] {
  const now = options.now ?? new Date();
  const horizonDays = options.horizonDays ?? 14;
  const nowMs = now.getTime();
  const horizonMs = nowMs + horizonDays * 86_400_000;

  const candidates = conflictCandidates(lessons, nowMs, horizonMs);
  const conflicts: ScheduleConflict[] = [];

  // Lesson vs lesson. Candidates are sorted by start, so for each lesson
  // only later-starting lessons beginning before its end can overlap —
  // once one starts at/after the end, the rest can't overlap either.
  for (let i = 0; i < candidates.length; i++) {
    const first = candidates[i];
    const firstEnd = lessonEndMs(first);
    for (let j = i + 1; j < candidates.length; j++) {
      const second = candidates[j];
      if (new Date(second.startDateTime).getTime() >= firstEnd) break;
      conflicts.push({
        id: `lesson:${first.id}|lesson:${second.id}`,
        lesson: first,
        peer: { kind: "lesson", lesson: second },
      });
    }
  }

  // Lesson vs external Google Calendar event. Lessons created by the app
  // are already excluded from the external list by the backend.
  for (const event of externalEvents) {
    const eventStart = new Date(event.startDateTime);
    const eventEndMs = new Date(event.endDateTime).getTime();
    for (const lesson of candidates) {
      // Candidates are sorted by start, so once one starts at/after the
      // event ends, no later candidate overlaps this event either.
      if (new Date(lesson.startDateTime).getTime() >= eventEndMs) break;
      if (!isRangeOverlap(lesson.startDateTime, lessonEndDate(lesson), eventStart, event.endDateTime))
        continue;
      conflicts.push({
        id: `lesson:${lesson.id}|external:${event.id}`,
        lesson,
        peer: { kind: "external", event },
      });
    }
  }

  return conflicts.sort((a, b) => {
    const diff =
      new Date(a.lesson.startDateTime).getTime() -
      new Date(b.lesson.startDateTime).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });
}