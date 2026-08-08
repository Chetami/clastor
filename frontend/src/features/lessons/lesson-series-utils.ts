// Pure lesson-series domain logic (formatting, grouping, attendance/credit/
// invoice decisions) lives in @examify-tms/shared — re-exported here so
// existing imports from this module keep working. Only UI presentation that
// is unique to the web client (Tailwind classes) stays frontend-local.
export {
  DAY_SHORT,
  formatSlot,
  formatRange,
  isLessonCredited,
  lessonIssues,
  groupLessonsByMonth,
  type LessonIssue,
  type LessonMonthGroup,
} from "@examify-tms/shared";

/** Tailwind tone classes for a series' acceptance-status badge. */
export const ACCEPTANCE_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  accepted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  declined: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};
