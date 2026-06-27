import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlarmClock,
  ChevronRight,
  CircleCheck,
} from "lucide-react";
import type { LessonResponse } from "@examify-tms/interfaces";
import { deriveLessonStatus } from "@/features/schedule/lesson-utils";
import {
  formatLessonTime,
  getInitials,
  lessonBadge,
  meetUrl,
} from "@/features/lessons/lesson-display";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Video } from "lucide-react";

interface ImportantLessonsProps {
  lessons: LessonResponse[];
  studentMap: Record<string, string>;
}

interface Group {
  key: "upcoming-today" | "completed-today";
  title: string;
  icon: typeof AlarmClock;
  accent: string;
  lessons: LessonResponse[];
}

/**
 * Today's snapshot shown above the lessons list:
 *   1. Upcoming today  — today's lessons that haven't started yet
 *   2. Completed today — today's lessons that have already started
 *
 * Fed by a bounded "today" window fetch so it never reads the tutor's full
 * history. (The previous "awaiting payment" card was removed because it
 * required scanning all past lessons — incompatible with read-efficient
 * pagination. Unpaid lessons are still surfaced during invoice creation.)
 */
function buildGroups(
  lessons: LessonResponse[],
): Array<Omit<Group, "title" | "icon" | "accent">> {
  const now = Date.now();
  const upcomingToday: LessonResponse[] = [];
  const completedToday: LessonResponse[] = [];

  for (const l of lessons) {
    if (deriveLessonStatus(l.attendanceStatus, l.isCancelled) === "cancelled")
      continue;
    const start = new Date(l.startDateTime);
    if (start.getTime() >= now) {
      upcomingToday.push(l);
    } else {
      completedToday.push(l);
    }
  }

  upcomingToday.sort(
    (a, b) =>
      new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime(),
  );
  completedToday.sort(
    (a, b) =>
      new Date(b.startDateTime).getTime() - new Date(a.startDateTime).getTime(),
  );

  return [
    { key: "upcoming-today", lessons: upcomingToday },
    { key: "completed-today", lessons: completedToday },
  ];
}

export function ImportantLessons({
  lessons,
  studentMap,
}: ImportantLessonsProps) {
  const navigate = useNavigate();

  const groups = useMemo(() => {
    const built = buildGroups(lessons);
    const meta: Record<
      Group["key"],
      { title: string; icon: typeof AlarmClock; accent: string }
    > = {
      "upcoming-today": {
        title: "Upcoming today",
        icon: AlarmClock,
        accent: "text-sky-600 dark:text-sky-400",
      },
      "completed-today": {
        title: "Completed today",
        icon: CircleCheck,
        accent: "text-emerald-600 dark:text-emerald-400",
      },
    };
    return built.map((g) => ({ ...g, ...meta[g.key] }));
  }, [lessons]);

  const nonEmpty = groups.filter((g) => g.lessons.length > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {groups.map((group) => {
        const Icon = group.icon;
        const count = group.lessons.length;
        const isEmpty = count === 0;
        return (
          <Card key={group.key} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${group.accent}`} />
                <h3 className="text-sm font-semibold tracking-tight">
                  {group.title}
                </h3>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {count}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {isEmpty ? (
                <p className="px-6 py-6 text-center text-xs text-muted-foreground">
                  Nothing here right now.
                </p>
              ) : (
                <ul className="-mt-0 divide-y">
                  {group.lessons.map((lesson) => {
                    const name =
                      studentMap[lesson.studentId] ?? "Unknown student";
                    const badge = lessonBadge(lesson);
                    const meet = meetUrl(lesson.location);
                    return (
                      <li
                        key={lesson.id}
                        className="group flex cursor-pointer items-center justify-between gap-3 px-6 py-2.5 transition-colors hover:bg-accent/40"
                        onClick={() => navigate(`/lessons/${lesson.id}`)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium leading-tight">
                              {name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {formatLessonTime(lesson.startDateTime)}
                              <span className="mx-1 text-muted-foreground/50">
                                ·
                              </span>
                              {lesson.subject}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {meet && (
                            <a
                              href={meet}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Open Google Meet"
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              <Video className="h-4 w-4" />
                            </a>
                          )}
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.tone}`}
                          >
                            {badge.label}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
