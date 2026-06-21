import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CalendarClock } from "lucide-react";
import type { LessonResponse } from "@examify-tms/interfaces";
import { lessonTimeRange, relativeDayLabel, timeUntil } from "../lib";

type Props = {
  lesson: LessonResponse | undefined;
  studentName: string;
};

export function NextLesson({ lesson, studentName }: Props) {
  // Re-render every 30s so the countdown stays fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4 pb-2">
        <CalendarClock className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">Next lesson</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {!lesson ? (
          <p className="py-2 text-sm text-muted-foreground">
            No upcoming lessons scheduled.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-xl font-semibold leading-tight tracking-tight text-primary">
              {timeUntil(lesson.startDateTime)}
            </p>
            <p className="text-xs text-muted-foreground">
              {relativeDayLabel(lesson.startDateTime)} ·{" "}
              {lessonTimeRange(lesson)}
            </p>
            <p className="pt-1.5 text-sm font-medium">
              {studentName} · {lesson.subject}
            </p>
            <Link
              to={`/lessons/${lesson.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View lesson <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
