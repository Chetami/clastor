import type { LessonResponse } from "@examify-tms/interfaces";
import { Card, CardContent } from "@/components/ui/card";
import { groupLessonsByMonth } from "./lesson-series-utils";
import { LessonRow } from "./LessonRow";

export interface LessonSeriesCalendarProps {
  lessons: LessonResponse[];
}

/**
 * Scrollable list of lessons grouped by month. Only the calendar scrolls;
 * each month header sticks to the top of the scroll area as the user scrolls.
 */
export function LessonSeriesCalendar({ lessons }: LessonSeriesCalendarProps) {
  const monthGroups = groupLessonsByMonth(lessons);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <span className="text-sm font-medium">
          {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
        </span>
        <span className="text-xs text-muted-foreground">
          {monthGroups.length} {monthGroups.length === 1 ? "month" : "months"}
        </span>
      </div>
      <CardContent className="min-h-0 flex-1 overflow-y-auto p-0">
        {monthGroups.map((group) => (
          <section key={group.key}>
            <div className="sticky top-0 z-10 bg-card px-4 py-2.5">
              <div className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </div>
            </div>
            <div className="divide-y divide-border/60">
              {group.lessons.map((lesson) => (
                <LessonRow key={lesson.id} lesson={lesson} />
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
