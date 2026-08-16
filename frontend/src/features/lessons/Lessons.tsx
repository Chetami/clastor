import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  ChevronRight,
  Clock,
  Loader2,
  Repeat,
  Video,
} from "lucide-react";
import type { LessonResponse } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonAvatarList } from "@/components/skeletons";
import { useListLessonsInfinite } from "@/features/schedule/api";
import { useStudentLookups } from "@/lib/use-student-lookups";
import {
  getInitials,
  formatLessonDate,
  formatLessonTime,
  lessonStatusBadge,
} from "@/features/lessons/lesson-display";

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
  const { names: studentNames } = useStudentLookups();
  const [filter, setFilter] = useState<FilterTab>("upcoming");

  // Cursor-paginated list: each page reads only ~PAGE_SIZE lessons on the
  // backend; pages accumulate here as the user loads more.
  const infinite = useListLessonsInfinite({ status: filter }, PAGE_SIZE);
  const lessons = useMemo(
    () => infinite.data?.pages.flatMap((p) => p.data) ?? [],
    [infinite.data],
  );
  const isLoading = infinite.isLoading;
  const isFetchingNextPage = infinite.isFetchingNextPage;
  const hasNextPage = infinite.hasNextPage;
  const error = infinite.error;

  const go = (lesson: LessonResponse) =>
    navigate(
      lesson.seriesId
        ? `/lessons/series/${lesson.seriesId}`
        : `/lessons/${lesson.id}`,
    );

  return (
    <div className="space-y-6">
      <h1 className="sr-only">Lessons</h1>

      {/*
        The card frame and filter tabs stay mounted across load / error / data
        states so switching filters never yanks the tab bar out from under the
        user (only the content area swaps). Same pattern as Payments.tsx.
      */}
      <Card>
        <CardHeader>
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
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div aria-busy="true">
              <SkeletonAvatarList rows={8} trailingWidth="w-28" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <p className="text-sm text-destructive">
                Failed to load lessons. Please try again.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => infinite.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <CalendarClock className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No lessons here yet. Schedule one from the calendar.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/schedule">Open calendar</Link>
              </Button>
            </div>
          ) : (
            <>
              <ul className="-mx-6 divide-y">
                {lessons.map((lesson) => {
                  const name =
                     studentNames[lesson.studentId] ?? "Unknown student";
                   // Same canonical badge mapping as the series rows and the
                   // calendar popover (Pending/Declined for unconfirmed
                   // upcoming lessons instead of a generic "Upcoming").
                   const badge = lessonStatusBadge(lesson);
                  const meet = lesson.meetLink;
                  const subject = lesson.subject ?? "Lesson";
                  return (
                    <li
                      key={lesson.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${name}${lesson.subject ? ` — ${lesson.subject}` : ""}. ${formatLessonDate(lesson.startDateTime)} at ${formatLessonTime(lesson.startDateTime)}. Open lesson.`}
                      className="group flex cursor-pointer items-center justify-between gap-4 rounded-sm px-6 py-3 outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      onClick={() => go(lesson)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          go(lesson);
                        }
                      }}
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
                            {subject}
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
                        {badge && (
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.tone}`}
                          >
                            {badge.label}
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          tabIndex={-1}
                          aria-hidden
                          className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {hasNextPage && (
                <div className="-mx-6 mt-4 flex justify-center border-t px-6 pt-4">
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
