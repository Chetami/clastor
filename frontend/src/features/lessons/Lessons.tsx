import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  ChevronRight,
  Clock,
  Repeat,
  Search,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListLessons } from "@/features/schedule/api";
import { useListStudents } from "@/features/students/api";
import { deriveLessonStatus } from "@/features/schedule/lesson-utils";
import {
  getInitials,
  formatLessonDate,
  formatLessonTime,
  lessonBadge,
  meetUrl,
} from "@/features/lessons/lesson-display";
import { ImportantLessons } from "@/features/lessons/ImportantLessons";

type FilterTab = "upcoming" | "past" | "cancelled" | "all";
type SortKey =
  | "upcoming"
  | "date-desc"
  | "student-az"
  | "student-za"
  | "updated";

const COLLAPSED_LIMIT = 8;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "upcoming", label: "Upcoming first" },
  { value: "date-desc", label: "Date (newest first)" },
  { value: "student-az", label: "Student (A–Z)" },
  { value: "student-za", label: "Student (Z–A)" },
  { value: "updated", label: "Recently updated" },
];

export default function Lessons() {
  const navigate = useNavigate();
  const { data: lessons = [], isLoading, error } = useListLessons();
  const { data: students = [] } = useListStudents();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("upcoming");
  const [expanded, setExpanded] = useState(false);

  const studentMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const counts = useMemo(() => {
    const now = Date.now();
    let upcoming = 0,
      past = 0,
      cancelled = 0;
    for (const l of lessons) {
      const status = deriveLessonStatus(l.attendanceStatus, l.isCancelled);
      const start = new Date(l.startDateTime).getTime();
      if (status === "cancelled") cancelled++;
      else if (start >= now) upcoming++;
      else past++;
    }
    return { upcoming, past, cancelled, all: lessons.length };
  }, [lessons]);

  const visibleLessons = useMemo(() => {
    const now = Date.now();
    const query = search.trim().toLowerCase();

    const enriched = lessons.map((l) => ({
      lesson: l,
      name: studentMap[l.studentId] ?? "Unknown student",
      start: new Date(l.startDateTime).getTime(),
    }));

    const filtered = enriched.filter(({ lesson, name, start }) => {
      const status = deriveLessonStatus(
        lesson.attendanceStatus,
        lesson.isCancelled,
      );
      const matchesFilter =
        filter === "all" ||
        (filter === "upcoming" && status !== "cancelled" && start >= now) ||
        (filter === "past" && status !== "cancelled" && start < now) ||
        (filter === "cancelled" && status === "cancelled");
      const matchesSearch =
        query.length === 0 ||
        name.toLowerCase().includes(query) ||
        (lesson.subject?.toLowerCase() ?? "").includes(query);
      return matchesFilter && matchesSearch;
    });

    filtered.sort((a, b) => {
      switch (sortKey) {
        case "date-desc":
          return b.start - a.start;
        case "student-az":
          return a.name.localeCompare(b.name);
        case "student-za":
          return b.name.localeCompare(a.name);
        case "updated":
          return (
            new Date(b.lesson.updatedAt).getTime() -
            new Date(a.lesson.updatedAt).getTime()
          );
        case "upcoming":
        default: {
          const aFuture = a.start >= now;
          const bFuture = b.start >= now;
          if (aFuture && !bFuture) return -1;
          if (!aFuture && bFuture) return 1;
          if (aFuture) return a.start - b.start;
          return b.start - a.start;
        }
      }
    });

    return filtered.map((e) => e.lesson);
  }, [lessons, studentMap, filter, search, sortKey]);

  useEffect(() => {
    setExpanded(false);
  }, [filter, search, sortKey]);

  const displayedLessons = expanded
    ? visibleLessons
    : visibleLessons.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = visibleLessons.length - displayedLessons.length;

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

      {!isLoading &&
        !error &&
        filter === "all" &&
        search.trim().length === 0 && (
          <ImportantLessons lessons={lessons} studentMap={studentMap} />
        )}

      {!isLoading && !error && (
        <Card>
          <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
              <FilterOption
                checked={filter === "all"}
                label="All"
                count={counts.all}
                onSelect={() => setFilter("all")}
              />
              <FilterOption
                checked={filter === "upcoming"}
                label="Upcoming"
                count={counts.upcoming}
                onSelect={() => setFilter("upcoming")}
              />
              <FilterOption
                checked={filter === "past"}
                label="Past"
                count={counts.past}
                onSelect={() => setFilter("past")}
              />
              <FilterOption
                checked={filter === "cancelled"}
                label="Cancelled"
                count={counts.cancelled}
                onSelect={() => setFilter("cancelled")}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search lessons…"
                  className="w-full pl-8 sm:w-56"
                />
              </div>
              <Select
                value={sortKey}
                onValueChange={(v) => setSortKey(v as SortKey)}
              >
                <SelectTrigger aria-label="Sort lessons" className="sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {visibleLessons.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <CalendarClock className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {search.trim()
                    ? "No lessons match your search."
                    : "No lessons here yet. Schedule one from the calendar."}
                </p>
              </div>
            ) : (
              <ul className="-mx-6 divide-y">
                {displayedLessons.map((lesson) => {
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
            {!expanded && hiddenCount > 0 && (
              <div className="mt-4 flex justify-center border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(true)}
                >
                  View {hiddenCount} more
                </Button>
              </div>
            )}
            {expanded && visibleLessons.length > COLLAPSED_LIMIT && (
              <div className="mt-4 flex justify-center border-t pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(false)}
                >
                  Show less
                </Button>
              </div>
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
  count: number;
  onSelect: () => void;
}

function FilterOption({ checked, label, count, onSelect }: FilterOptionProps) {
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
      <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
        {count}
      </span>
    </button>
  );
}
