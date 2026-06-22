import { useMemo, useState } from "react";
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
import { NextLesson } from "./components/next-lesson";
import { CurrentLesson } from "./components/current-lesson";
import { TodoLessons } from "./components/todo-lessons";
import { QuickActions } from "./components/quick-actions";
import {
  StatCardsSkeleton,
  NextLessonSkeleton,
  ChartSkeleton,
  UpcomingLessonsSkeleton,
  TodoLessonsSkeleton,
} from "./components/skeletons";
import { findCurrentLesson, todoLessons, nextLesson } from "./lib";

export default function Dashboard() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("week");

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary(period);
  const { data: lessons = [], isLoading: lessonsLoading } = useListLessons();
  const { data: students = [] } = useListStudents();

  const studentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const currentLesson = useMemo(() => findCurrentLesson(lessons), [lessons]);
  const todos = useMemo(() => todoLessons(lessons), [lessons]);
  const upcoming = useMemo(() => nextLesson(lessons), [lessons]);

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

      {/* Stat tiles */}
      {summaryLoading || !summary ? (
        <StatCardsSkeleton />
      ) : (
        <StatCards summary={summary} period={period} />
      )}

      {/* Two independent columns (rows need not align).
          Left: compact panels with Upcoming filling remaining height.
          Right: charts + things to do. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col gap-4">
          {lessonsLoading ? (
            <NextLessonSkeleton />
          ) : (
            <NextLesson
              lesson={upcoming}
              studentName={
                upcoming ? studentNames[upcoming.studentId] ?? "Student" : ""
              }
            />
          )}
          <QuickActions />
          {lessonsLoading ? (
            <UpcomingLessonsSkeleton fill />
          ) : (
            <UpcomingLessons
              lessons={lessons}
              studentNames={studentNames}
              fill
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          {summaryLoading || !summary ? (
            <ChartSkeleton />
          ) : (
            <HoursChart summary={summary} />
          )}
          {summaryLoading || !summary ? (
            <ChartSkeleton />
          ) : (
            <IncomeChart summary={summary} />
          )}
          {lessonsLoading ? (
            <TodoLessonsSkeleton />
          ) : (
            <TodoLessons lessons={todos} studentNames={studentNames} />
          )}
        </div>
      </div>
    </div>
  );
}
