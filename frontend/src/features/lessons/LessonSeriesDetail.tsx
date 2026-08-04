import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CircleAlert,
  Clock,
  Loader2,
  Repeat,
  Video,
} from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import listPlugin from "@fullcalendar/list";
import type { EventContentArg, EventInput } from "@fullcalendar/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  useGetLessonSeries,
  useListLessons,
} from "@/features/schedule/api";
import { useListStudents } from "@/features/students/api";
import {
  ACCEPTANCE_LABELS,
  attendanceTone,
  deriveLessonStatus,
  formatLessonDate,
  formatLessonTime,
} from "@/features/schedule/lesson-utils";
import { getInitials } from "@/features/lessons/lesson-display";
import type {
  DayOfWeek,
  LessonResponse,
  LessonSlot,
} from "@examify-tms/interfaces";

const DAY_SHORT: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const ACCEPTANCE_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  accepted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  declined: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

/** A human label + tone for what happened with a lesson (status). */
function statusBadge(lesson: LessonResponse): { label: string; tone: string } {
  const status = deriveLessonStatus(lesson.attendanceStatus, lesson.isCancelled);
  if (status === "cancelled") {
    return {
      label: "Cancelled",
      tone: attendanceTone(lesson.attendanceStatus, lesson.isCancelled),
    };
  }
  const future = new Date(lesson.startDateTime).getTime() >= Date.now();
  if (future) {
    return { label: "Upcoming", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400" };
  }
  switch (lesson.attendanceStatus) {
    case "present":
      return { label: "Present", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" };
    case "present_late":
      return { label: "Late", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    case "absent_no_makeup":
      return { label: "Absent", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" };
    case "absent_makeup_issued":
      return { label: "Absent — credited", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    case "absent_warning":
      return { label: "Absent — warned", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" };
    case "tutor_cancelled":
      return { label: "Tutor cancelled", tone: "bg-rose-500/15 text-rose-600 dark:text-rose-400" };
    case "tutor_cancelled_makeup_issued":
      return { label: "Tutor cancelled — credited", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
    default:
      return { label: "Not recorded", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" };
  }
}

/** Issues that need the tutor's attention for a given lesson. */
function lessonIssues(lesson: LessonResponse): string[] {
  const issues: string[] = [];
  const future = new Date(lesson.startDateTime).getTime() >= Date.now();
  if (lesson.isCancelled || future) return issues;
  if (lesson.attendanceStatus === "unrecorded") {
    issues.push("Attendance not recorded");
  }
  if (!lesson.isPaid) {
    issues.push("Unpaid");
  }
  return issues;
}

function formatSlot(slot: LessonSlot): string {
  const [hh, mm] = slot.timeOfDay.split(":");
  const h24 = Number(hh);
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${DAY_SHORT[slot.dayOfWeek]} ${h12}:${mm} ${period}`;
}

function formatRange(startDate: string, until: string | null): string {
  try {
    const start = new Date(startDate + "T00:00:00");
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return until ? `${fmt(start)} – ${fmt(new Date(until + "T00:00:00"))}` : `from ${fmt(start)}`;
  } catch {
    return startDate;
  }
}

export default function LessonSeriesDetail() {
  const { seriesId = "" } = useParams();
  const navigate = useNavigate();

  const series = useGetLessonSeries(seriesId);
  const { data: students = [] } = useListStudents();
  const lessonsQuery = useListLessons({ seriesId });

  const studentName = useMemo(() => {
    if (!series.data) return undefined;
    return students.find((s) => s.id === series.data!.studentId)?.name;
  }, [series.data, students]);

  const lessons = useMemo(() => lessonsQuery.data ?? [], [lessonsQuery.data]);
  const isLoading = series.isLoading || lessonsQuery.isLoading;
  const issueCount = useMemo(
    () => lessons.reduce((n, l) => n + lessonIssues(l).length, 0),
    [lessons],
  );

  const events: EventInput[] = useMemo(
    () =>
      lessons.map((l) => ({
        id: l.id,
        start: l.startDateTime,
        extendedProps: { lesson: l },
      })),
    [lessons],
  );

  // Land on a sensible month: the current month, or the first lesson's month
  // when every occurrence is in the future/past.
  const initialDate = useMemo(() => {
    const now = new Date().toISOString();
    const hasThisMonth = lessons.some(
      (l) => new Date(l.startDateTime).getMonth() === new Date().getMonth(),
    );
    if (hasThisMonth) return now;
    return lessons[0]?.startDateTime ?? now;
  }, [lessons]);

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 text-muted-foreground"
        onClick={() => navigate("/lessons")}
      >
        <ArrowLeft className="h-4 w-4" />
        Lessons
      </Button>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (series.error || !series.data) && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Couldn't load this lesson series.
          </CardContent>
        </Card>
      )}

      {!isLoading && series.data && (
        <>
          <SeriesHeader
            subject={series.data.subject}
            studentName={studentName}
            studentId={series.data.studentId}
            acceptance={series.data.acceptanceStatus}
            intervalWeeks={series.data.intervalWeeks}
            slots={series.data.slots}
            durationMinutes={series.data.durationMinutes}
            timezone={series.data.timezone}
            startDate={series.data.startDate}
            until={series.data.until ?? null}
            count={series.data.count}
            issueCount={issueCount}
          />

          {lessonsQuery.error ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-destructive">
                Failed to load lessons. Please try again.
              </CardContent>
            </Card>
          ) : lessons.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No lessons in this series yet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-2">
                <div className="gi-calendar gi-series-calendar">
                  <FullCalendar
                    plugins={[listPlugin]}
                    initialView="listMonth"
                    initialDate={initialDate}
                    headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
                    noEventsContent="No lessons this month"
                    height="auto"
                    events={events}
                    eventContent={renderLessonRow}
                    eventClassNames={(arg) =>
                      (arg.event.extendedProps.lesson as LessonResponse)?.isCancelled
                        ? "gi-series-row--cancelled"
                        : ""
                    }
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

interface SeriesHeaderProps {
  subject: string;
  studentName?: string;
  studentId: string;
  acceptance: keyof typeof ACCEPTANCE_LABELS;
  intervalWeeks: number;
  slots: LessonSlot[];
  durationMinutes: number;
  timezone: string;
  startDate: string;
  until: string | null;
  count: number | null | undefined;
  issueCount: number;
}

function SeriesHeader({
  subject,
  studentName,
  studentId,
  acceptance,
  intervalWeeks,
  slots,
  durationMinutes,
  timezone,
  startDate,
  until,
  count,
  issueCount,
}: SeriesHeaderProps) {
  const cadence =
    intervalWeeks === 1 ? "Weekly" : intervalWeeks === 2 ? "Biweekly" : `Every ${intervalWeeks} weeks`;
  const slotLabel = slots.map(formatSlot).join(" · ");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {getInitials(studentName ?? studentId)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {subject || "Lesson series"}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <Repeat className="h-3 w-3" />
              Recurring
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCEPTANCE_TONE[acceptance] ?? "bg-muted text-muted-foreground"}`}
            >
              {ACCEPTANCE_LABELS[acceptance]}
            </span>
            {issueCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                <CircleAlert className="h-3 w-3" />
                {issueCount} {issueCount === 1 ? "issue" : "issues"}
              </span>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {studentName ? `${studentName} · ` : ""}
            {cadence} · {slotLabel} · {durationMinutes} min
          </p>
          <p className="truncate text-xs text-muted-foreground/80">
            {formatRange(startDate, until)}
            {count ? ` · ${count} sessions` : ""} · {timezone}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Custom FullCalendar list-row renderer. */
function renderLessonRow(arg: EventContentArg) {
  const lesson = arg.event.extendedProps.lesson as LessonResponse;
  const start = new Date(lesson.startDateTime);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);
  const { label, tone } = statusBadge(lesson);
  const issues = lessonIssues(lesson);
  const dayName = start.toLocaleDateString("en-US", { weekday: "short" });

  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-1.5">
      <div className="flex min-w-[8.5rem] items-center gap-2 text-sm">
        <span className="font-medium">{formatLessonDate(lesson.startDateTime)}</span>
        <span className="text-muted-foreground">{dayName}</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate font-medium">
          {lesson.subject ?? "Lesson"}
        </span>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
          <Clock className="h-3 w-3" />
          {formatLessonTime(lesson.startDateTime)} – {formatLessonTime(end.toISOString())}
        </span>
      </div>

      {issues.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {issues.map((msg) => (
            <span
              key={msg}
              className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400"
            >
              <CircleAlert className="h-3 w-3" />
              {msg}
            </span>
          ))}
        </div>
      ) : (
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
          {label}
        </span>
      )}

      <div className="flex items-center gap-1">
        {lesson.meetLink && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <a
              href={lesson.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Open Google Meet"
            >
              <Video className="h-4 w-4" />
            </a>
          </Button>
        )}
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="shrink-0 text-muted-foreground"
          title="Open lesson detail"
        >
          <Link to={`/lessons/${lesson.id}`}>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
