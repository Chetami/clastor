import type { LessonResponse } from "@examify-tms/interfaces";
import { lessonBadge } from "@/features/lessons/lesson-display";
import { ACCEPTANCE_TONE } from "@/features/lessons/lesson-series-utils";

export interface Badge {
  label: string;
  tone: string;
}

/**
 * App-wide status badge for a lesson. Matches the Lessons list / LessonRow:
 * upcoming lessons surface acceptance (Pending/Declined, or nothing when
 * accepted); past lessons show the attendance-driven label. Returns null when
 * there's nothing worth surfacing.
 */
export function lessonStatusBadge(lesson: LessonResponse): Badge | null {
  const base = lessonBadge(lesson);
  if (base.label === "Upcoming") {
    if (lesson.acceptanceStatus === "pending") {
      return { label: "Pending", tone: ACCEPTANCE_TONE.pending };
    }
    if (lesson.acceptanceStatus === "declined") {
      return { label: "Declined", tone: ACCEPTANCE_TONE.declined };
    }
    return null;
  }
  return base;
}
