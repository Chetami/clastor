import { useEffect, useRef } from "react";
import { CalendarDays } from "lucide-react";
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
 * On first load, it auto-scrolls to the next upcoming lesson.
 */
export function LessonSeriesCalendar({ lessons }: LessonSeriesCalendarProps) {
  const monthGroups = groupLessonsByMonth(lessons);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (hasScrolledRef.current || lessons.length === 0) return;
    const now = Date.now();
    const target = [...lessons]
      .filter(
        (l) => !l.isCancelled && new Date(l.startDateTime).getTime() >= now,
      )
      .sort(
        (a, b) =>
          new Date(a.startDateTime).getTime() -
          new Date(b.startDateTime).getTime(),
      )[0];
    if (!target) return;

    const id = requestAnimationFrame(() => {
      const el = scrollRef.current?.querySelector(
        `[data-lesson-id="${target.id}"]`,
      );
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: "start", behavior: "auto" });
        hasScrolledRef.current = true;
      }
    });
    return () => cancelAnimationFrame(id);
  }, [lessons]);

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-3.5">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            {lessons.length} {lessons.length === 1 ? "lesson" : "lessons"}
          </span>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {monthGroups.length} {monthGroups.length === 1 ? "month" : "months"}
        </span>
      </div>
      <CardContent ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-0">
        {monthGroups.map((group) => (
          <section key={group.key}>
            <div className="sticky top-0 z-10 bg-card px-4 py-2">
              <div className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
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
