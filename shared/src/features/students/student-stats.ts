import type { LessonResponse } from "@examify-tms/interfaces";

/**
 * Window lengths for student lesson stats. Anchored to UTC calendar
 * boundaries, mirroring the dashboard's period math:
 * - month: current calendar month
 * - six_months: the last 6 calendar months including the current one
 * - year: current calendar year
 */
export type StudentStatsPeriod = "month" | "six_months" | "year";

/** Per-student lesson outcome rollup over a stats window. */
export type StudentStats = {
  studentId: string;
  /** Every lesson scheduled in the window, in any state. */
  total: number;
  /** Present + present_late. */
  attended: number;
  /** Of which arrived late (subset of attended). */
  late: number;
  /** Absent without makeup, absent with makeup issued, or absent warning. */
  noShows: number;
  /** Cancelled by the tutor (isCancelled or tutor_cancelled* attendance). */
  tutorCancels: number;
  /** Invites the student declined (acceptanceStatus "declined"). */
  declined: number;
  /** Still to happen (unrecorded and not cancelled/declined). */
  upcoming: number;
  /** noShows + tutorCancels + declined — every disruption in the window. */
  disruptions: number;
  /** attended / (attended + noShows), or null when none resolved yet. */
  attendedRate: number | null;
  /** noShows / (attended + noShows), or null when none resolved yet. */
  noShowRate: number | null;
  /** disruptions / total, or null when there were no lessons. */
  disruptionRate: number | null;
  /**
   * True when the student missed more than 20% of resolved lessons
   * (attended + no-shows) over at least 3 — flags unreliable students.
   */
  warning: boolean;
};

/** The [start, end) ms window (UTC calendar boundaries) for a stats period. */
export function studentStatsWindow(
  period: StudentStatsPeriod,
  now: Date = new Date(),
): { start: number; end: number } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  if (period === "month") {
    return {
      start: Date.UTC(year, month, 1),
      end: Date.UTC(year, month + 1, 1),
    };
  }
  if (period === "six_months") {
    return {
      start: Date.UTC(year, month - 5, 1),
      end: Date.UTC(year, month + 1, 1),
    };
  }
  return { start: Date.UTC(year, 0, 1), end: Date.UTC(year + 1, 0, 1) };
}

/** A zeroed stats record — for students with no lessons in the window. */
export function emptyStudentStats(studentId: string): StudentStats {
  return {
    studentId,
    total: 0,
    attended: 0,
    late: 0,
    noShows: 0,
    tutorCancels: 0,
    declined: 0,
    upcoming: 0,
    disruptions: 0,
    attendedRate: null,
    noShowRate: null,
    disruptionRate: null,
    warning: false,
  };
}

/** The five mutually-exclusive lesson outcome buckets. */
type LessonOutcome =
  | "attended"
  | "noShows"
  | "tutorCancels"
  | "declined"
  | "upcoming";

/** Classify a lesson into exactly one outcome bucket, in priority order. */
function lessonOutcome(lesson: LessonResponse): LessonOutcome {
  if (
    lesson.isCancelled ||
    lesson.attendanceStatus === "tutor_cancelled" ||
    lesson.attendanceStatus === "tutor_cancelled_makeup_issued"
  ) {
    return "tutorCancels";
  }
  if (
    lesson.attendanceStatus === "absent_no_makeup" ||
    lesson.attendanceStatus === "absent_makeup_issued" ||
    lesson.attendanceStatus === "absent_warning"
  ) {
    return "noShows";
  }
  if (lesson.acceptanceStatus === "declined") {
    return "declined";
  }
  if (
    lesson.attendanceStatus === "present" ||
    lesson.attendanceStatus === "present_late"
  ) {
    return "attended";
  }
  return "upcoming";
}

/**
 * Roll lessons up into per-student stats over the period's window, keyed by
 * studentId. Every lesson counts into exactly one bucket: tutorCancels >
 * noShows > declined > attended > upcoming (a late arrival also bumps
 * `late`). Students with no lessons in the window have no entry — use
 * {@link emptyStudentStats} when rendering.
 */
export function computeStudentStats(
  lessons: LessonResponse[],
  period: StudentStatsPeriod,
  now: Date = new Date(),
): Record<string, StudentStats> {
  const { start, end } = studentStatsWindow(period, now);
  const byStudent: Record<string, StudentStats> = {};

  for (const lesson of lessons) {
    const startMs = new Date(lesson.startDateTime).getTime();
    if (startMs < start || startMs >= end) continue;

    let stats = byStudent[lesson.studentId];
    if (!stats) {
      stats = byStudent[lesson.studentId] = emptyStudentStats(
        lesson.studentId,
      );
    }
    stats.total += 1;
    const outcome = lessonOutcome(lesson);
    stats[outcome] += 1;
    if (
      outcome === "attended" &&
      lesson.attendanceStatus === "present_late"
    ) {
      stats.late += 1;
    }
  }

  for (const stats of Object.values(byStudent)) {
    stats.disruptions = stats.noShows + stats.tutorCancels + stats.declined;
    const resolved = stats.attended + stats.noShows;
    stats.attendedRate = resolved ? stats.attended / resolved : null;
    stats.noShowRate = resolved ? stats.noShows / resolved : null;
    stats.disruptionRate = stats.total ? stats.disruptions / stats.total : null;
    stats.warning =
      stats.noShowRate !== null &&
      stats.noShowRate > 0.2 &&
      resolved >= 3;
  }

  return byStudent;
}