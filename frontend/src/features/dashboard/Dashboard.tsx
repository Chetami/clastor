import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useListLessons } from "@/features/schedule/api";
import { useListStudents } from "@/features/students/api";
import { toast } from "sonner";
import type {
  DashboardPeriod,
  AttendanceStatus,
} from "@examify-tms/interfaces";
import { useDashboardSummary } from "./api";
import { useCreateInvoice, useSendInvoice } from "@/features/payments/api";
import { PeriodSelector } from "./components/period-selector";
import { StatCards } from "./components/stat-cards";
import { HoursChart } from "./components/hours-chart";
import { IncomeChart } from "./components/income-chart";
import { NextLesson } from "./components/next-lesson";
import { CurrentLesson } from "./components/current-lesson";
import { TodoLessons } from "./components/todo-lessons";
import { QuickActions } from "./components/quick-actions";
import {
  StatCardsSkeleton,
  NextLessonSkeleton,
  ChartSkeleton,
  TodoLessonsSkeleton,
} from "./components/skeletons";
import {
  findCurrentLesson,
  todoLessons,
  nextLesson,
  expectedIncomeFromLessons,
  plannedLessons,
} from "./lib";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("week");

  const { data: summary, isLoading: summaryLoading } =
    useDashboardSummary(period);
  const { data: lessons = [], isLoading: lessonsLoading } = useListLessons();
  const { data: students = [] } = useListStudents();
  const createInvoice = useCreateInvoice();
  const sendInvoice = useSendInvoice();

  const studentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const studentMap = useMemo(() => {
    const map: Record<string, (typeof students)[number]> = {};
    for (const s of students) map[s.id] = s;
    return map;
  }, [students]);

  const currentLesson = useMemo(() => findCurrentLesson(lessons), [lessons]);
  const todos = useMemo(() => todoLessons(lessons), [lessons]);
  const upcoming = useMemo(() => nextLesson(lessons), [lessons]);
  const expectedIncome = useMemo(
    () => expectedIncomeFromLessons(lessons, studentMap, period),
    [lessons, studentMap, period],
  );
  const plannedCount = useMemo(
    () => plannedLessons(lessons, period).length,
    [lessons, period],
  );

  const handleCreateInvoice = async (lessonId: string, studentName: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    const student = studentMap[lesson.studentId];
    if (!student) return;

    const createdInvoice = await createInvoice.mutateAsync({
      studentId: lesson.studentId,
      lineItems: [
        {
          lessonId: lesson.id,
          description: `${lesson.subject || "Lesson"}`,
          durationMinutes: lesson.durationMinutes,
          rateType: student.rateType || "hourly",
          unitAmount: student.expectedAmount,
          quantity:
            student.rateType === "hourly" ? lesson.durationMinutes / 60 : 1,
        },
      ],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      paymentMethod: "bank_transfer" as const,
      status: "draft" as const,
    });

    await sendInvoice.mutateAsync({ id: createdInvoice.id });

    toast.success(`Invoice sent to ${studentName}`);

    navigate(`/payments/${createdInvoice.id}`);
  };

  const handleTodoConfirm = async (
    lessonId: string,
    _attendanceStatus: AttendanceStatus,
    shouldInvoice: boolean,
  ) => {
    if (!shouldInvoice) return;
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const name = studentNames[lesson.studentId] ?? "Student";
    await handleCreateInvoice(lessonId, name);
  };

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
        <StatCards
          summary={summary}
          period={period}
          expectedIncome={expectedIncome}
          plannedLessonCount={plannedCount}
        />
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
                upcoming ? (studentNames[upcoming.studentId] ?? "Student") : ""
              }
            />
          )}
          <QuickActions />

          {lessonsLoading ? (
            <TodoLessonsSkeleton />
          ) : (
            <TodoLessons
              lessons={todos}
              studentNames={studentNames}
              onConfirm={handleTodoConfirm}
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
        </div>
      </div>
    </div>
  );
}
