import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import type { LessonResponse } from "@examify-tms/interfaces";
import { upcomingLessons, lessonTimeRange, relativeDayLabel } from "../lib";

type Props = {
  lessons: LessonResponse[];
  studentNames: Record<string, string>;
};

export function UpcomingLessons({ lessons, studentNames }: Props) {
  const items = upcomingLessons(lessons, 10);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Upcoming lessons</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No upcoming lessons scheduled.
          </p>
        ) : (
          <ScrollArea className="h-[260px] pr-3">
            <ul className="space-y-1">
              {items.map((l) => (
                <li key={l.id}>
                  <Link
                    to={`/lessons/${l.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="truncate text-sm font-medium">
                        {studentNames[l.studentId] ?? "Unknown student"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.subject} · {relativeDayLabel(l.startDateTime)} ·{" "}
                        {lessonTimeRange(l)}
                      </p>
                    </div>
                    {!l.isPaid && (
                      <Badge variant="secondary" className="shrink-0">
                        Unpaid
                      </Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
