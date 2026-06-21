import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays } from "lucide-react";
import type { LessonResponse } from "@examify-tms/interfaces";
import { todaysLessons, lessonTimeRange } from "../lib";

type Props = {
  lessons: LessonResponse[];
  studentNames: Record<string, string>;
};

export function TodayAgenda({ lessons, studentNames }: Props) {
  const items = todaysLessons(lessons);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Today's agenda</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing scheduled today.
          </p>
        ) : (
          <ScrollArea className="h-[220px] pr-3">
            <ul className="space-y-1">
              {items.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                    {lessonTimeRange(l).split(" – ")[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/lessons/${l.id}`}
                      className="block truncate text-sm font-medium hover:underline"
                    >
                      {studentNames[l.studentId] ?? "Unknown student"}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.subject}
                      {l.location ? ` · ${l.location}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
