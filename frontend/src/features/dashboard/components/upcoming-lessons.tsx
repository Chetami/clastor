import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import type { LessonResponse } from "@examify-tms/interfaces";
import { upcomingLessons, lessonTimeRange, relativeDayLabel } from "../lib";

type Props = {
  lessons: LessonResponse[];
  studentNames: Record<string, string>;
  /** Grow to fill the parent column's remaining height. */
  fill?: boolean;
};

export function UpcomingLessons({ lessons, studentNames, fill }: Props) {
  const items = upcomingLessons(lessons, 10);

  return (
    <Card className={cn("flex flex-col", fill && "min-h-0 flex-1")}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Upcoming lessons</CardTitle>
      </CardHeader>
      <CardContent className={cn("flex-1", fill && "flex min-h-0 flex-col")}>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No upcoming lessons scheduled.
          </p>
        ) : (
          <ScrollArea
            className={cn("pr-3", fill ? "min-h-0 flex-1" : "h-[260px]")}
          >
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
                    {l.acceptanceStatus === "pending" && (
                      <Badge variant="warning" className="shrink-0">
                        Pending
                      </Badge>
                    )}
                    {l.acceptanceStatus === "declined" && (
                      <Badge variant="danger" className="shrink-0">
                        Declined
                      </Badge>
                    )}
                    {l.acceptanceStatus === "accepted" && (
                      <Badge variant="success" className="shrink-0">
                        Accepted
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
