import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Loader2,
  Repeat,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useListLessons, useListLessonsInfinite } from "@/features/schedule/api";
import { useListStudents } from "@/features/students/api";
import {
  getInitials,
  formatLessonDate,
  formatLessonTime,
  lessonBadge,
  meetUrl,
} from "@/features/lessons/lesson-display";
import { ImportantLessons } from "@/features/lessons/ImportantLessons";

type FilterTab = "upcoming" | "past" | "cancelled" | "all";

const PAGE_SIZE = 10;

const TABS: { value: FilterTab; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

export default function Lessons() {
  const navigate = useNavigate();
  const { data: students = [] } = useListStudents();
  const [filter, setFilter] = useState<FilterTab>("upcoming");
  const [unpaidOnly, setUnpaidOnly] = useState(false);

  // Cursor-paginated list: each page reads only ~PAGE_SIZE lessons on the
  // backend; pages accumulate here as the user loads more.
  const infinite = useListLessonsInfinite({ status: filter }, PAGE_SIZE);
  const lessons = useMemo(
    () => infinite.data?.pages.flatMap((p) => p.data) ?? [],
    [infinite.data],
  );
  const visibleLessons = useMemo(
    () => (unpaidOnly ? lessons.filter((l) => !l.isPaid) : lessons),
    [lessons, unpaidOnly],
  );
  const isLoading = infinite.isLoading;
  const isFetchingNextPage = infinite.isFetchingNextPage;
  const hasNextPage = infinite.hasNextPage;
  const error = infinite.error;

  const studentMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  // "Important" summary cards need today's lessons, which sit outside the
  // active tab's pagination. Fetch just today's window (bounded, cheap) and
  // only on the upcoming tab where the cards are shown.
  const showImportant = filter === "upcoming";
  const todayWindow = useMemo(() => {
    const n = new Date();
    const start = new Date(
      n.getFullYear(),
      n.getMonth(),
      n.getDate(),
    ).toISOString();
    const end = new Date(
      n.getFullYear(),
      n.getMonth(),
      n.getDate() + 1,
    ).toISOString();
    return { from: start, to: end };
  }, []);
  const { data: todaysLessons = [] } = useListLessons(todayWindow, {
    enabled: showImportant,
  });

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading lessons…</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-destructive">
            Failed to load lessons. Please try again.
          </p>
        </div>
      )}

      {!isLoading && !error && showImportant && (
        <ImportantLessons lessons={todaysLessons} studentMap={studentMap} />
      )}

      {!isLoading && !error && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
                {TABS.map((tab) => (
                  <FilterOption
                    key={tab.value}
                    checked={filter === tab.value}
                    label={tab.label}
                    onSelect={() => setFilter(tab.value)}
                  />
                ))}
              </div>
              <Button
                variant={unpaidOnly ? "default" : "outline"}
                size="sm"
                className="h-8 shrink-0"
                aria-pressed={unpaidOnly}
                onClick={() => setUnpaidOnly((v) => !v)}
              >
                <CircleDollarSign className="h-4 w-4" />
                Unpaid only
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <CalendarClock className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No lessons here yet. Schedule one from the calendar.
                </p>
              </div>
            ) : (
              <>
                {visibleLessons.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                    <CircleDollarSign className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {hasNextPage
                        ? "No unpaid lessons on the loaded pages — load more to keep looking."
                        : "No unpaid lessons in this view."}
                    </p>
                  </div>
                ) : (
                <ul className="-mx-6 divide-y">
                  {visibleLessons.map((lesson) => {
                    const name =
                      studentMap[lesson.studentId] ?? "Unknown student";
                    const badge = lessonBadge(lesson);
                    const meet = meetUrl(lesson.location);
                    return (
                      <li
                        key={lesson.id}
                        className="group flex cursor-pointer items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-accent/40"
                        onClick={() => navigate(`/lessons/${lesson.id}`)}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                            {getInitials(name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium">{name}</p>
                              {lesson.seriesId && (
                                <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              {lesson.subject}
                            </p>
                          </div>
                        </div>

                        <div className="hidden items-center gap-1.5 text-sm text-muted-foreground sm:flex">
                          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                          <span>{formatLessonDate(lesson.startDateTime)}</span>
                          <span className="text-muted-foreground/50">·</span>
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>{formatLessonTime(lesson.startDateTime)}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {meet && (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="shrink-0"
                            >
                              <a
                                href={meet}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Open Google Meet"
                              >
                                <Video className="h-4 w-4" />
                                <span className="hidden sm:inline">Meet</span>
                              </a>
                            </Button>
                          )}
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.tone}`}
                          >
                            {badge.label}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                            tabIndex={-1}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                )}

                {hasNextPage && (
                  <div className="mt-4 flex justify-center border-t pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isFetchingNextPage}
                      onClick={() => infinite.fetchNextPage()}
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading…
                        </>
                      ) : (
                        "Load more"
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface FilterOptionProps {
  checked: boolean;
  label: string;
  onSelect: () => void;
}

function FilterOption({ checked, label, onSelect }: FilterOptionProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={
        checked
          ? "inline-flex h-7 items-center gap-1.5 rounded px-3 text-sm font-medium text-foreground shadow-sm transition-colors"
          : "inline-flex h-7 items-center gap-1.5 rounded px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {label}
    </button>
  );
}
