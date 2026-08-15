import type { LessonResponse } from "@examify-tms/interfaces";
import { lessonStatusBadge as canonicalLessonStatusBadge } from "@/features/lessons/lesson-display";

export interface Badge {
  label: string;
  tone: string;
}

/**
 * App-wide status badge for a lesson — canonical implementation lives in
 * `@/features/lessons/lesson-display` so every surface (list, series rows,
 * popover) derives badges the same way. Re-exported here for convenience.
 */
export function lessonStatusBadge(lesson: LessonResponse): Badge | null {
  return canonicalLessonStatusBadge(lesson);
}
