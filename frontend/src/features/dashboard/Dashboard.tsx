import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useListLessons } from "@/features/schedule/api";
import { useListStudents } from "@/features/students/api";
import type { DashboardPeriod } from "@examify-tms/interfaces";
import { useDashboardSummary } from "./api";
import { PeriodSelector } from "./components/period-selector";
import { StatCards } from "./components/stat-cards";
import { HoursChart } from "./components/hours-chart";
import { IncomeChart } from "./components/income-chart";
import { UpcomingLessons } from "./components/upcoming-lessons";
import { TodayAgenda } from "./components/today-agenda";
import { CurrentLesson } from "./components/current-lesson";
import { TodoLessons } from "./components/todo-lessons";
import { QuickActions } from "./components/quick-actions";
import { findCurrentLesson, todoLessons } from "./lib";

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("week");

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(period);
  const { data: lessons = [] } = useListLessons();
  const { data: students = [] } = useListStudents();

  const studentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const currentLesson = useMemo(() => findCurrentLesson(lessons), [lessons]);
  const todos = useMemo(() => todoLessons(lessons), [lessons]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
          </h1>
          <p className="text-sm text-muted-foreground">
            Here's what's happening with your tutoring.
          </p>
        </div>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Live lesson banner */}
      {currentLesson && (
        <CurrentLesson
          lesson={currentLesson}
          studentName={studentNames[currentLesson.studentId] ?? "Student"}
        />
      )}

      {/* Stat cards */}
      {summaryLoading || !summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[120px] rounded-xl" />
          <Skeleton className="h-[120px] rounded-xl" />
        </div>
      ) : (
        <StatCards summary={summary} />
      )}

      {/* Charts */}
      {summary && (
        <div className="grid gap-4 lg:grid-cols-2">
          <HoursChart summary={summary} />
          <IncomeChart summary={summary} />
        </div>
      )}

      {/* Agenda + todos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TodayAgenda lessons={lessons} studentNames={studentNames} />
        <TodoLessons lessons={todos} studentNames={studentNames} />
      </div>

      {/* Upcoming + quick actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <UpcomingLessons lessons={lessons} studentNames={studentNames} />
        <QuickActions />
      </div>
    </div>
  );
}
