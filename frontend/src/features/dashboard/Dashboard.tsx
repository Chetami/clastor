import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useListLessons } from "@/features/schedule/api";
import { useListStudents } from "@/features/students/api";
import { useSubjects } from "@/lib/subjects";
import { toast } from "sonner";
import type {
  DashboardPeriod,
  AttendanceStatus,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import { useDashboardSummary, useUpdateLessonDetails } from "./api";
import { useInvoiceLesson } from "@/features/payments/api";
import type { InvoiceLessonEdits } from "@/features/payments/api";
import { PeriodSelector } from "./components/period-selector";
import { StatCards } from "./components/stat-cards";
import { HoursChart } from "./components/hours-chart";
import { IncomeChart } from "./components/income-chart";
import { NextLesson } from "./components/next-lesson";
import { CurrentLesson } from "./components/current-lesson";
import { ThingsToDo } from "./components/things-to-do";
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
  lessonChecklistTodos,
} from "./lib";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState<DashboardPeriod>("week");

  const { data: summary, isLoading: summaryLoading } =
    useDashboardSummary(period);
  const { data: lessons = [], isLoading: lessonsLoading } = useListLessons();
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();
  const invoiceLesson = useInvoiceLesson();
  const updateLessonDetails = useUpdateLessonDetails();

  const studentNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  // Per-student list of allowed subject names (from the tutor's catalogue),
  // used to constrain the subject selector in the attendance dialog.
  const studentSubjectOptions = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const s of students) {
      map[s.id] = (s.subjectIds ?? [])
        .map((id) => subjects.find((sub) => sub.id === id)?.name)
        .filter((n): n is string => !!n);
    }
    return map;
  }, [students, subjects]);

  const studentMap = useMemo(() => {
    const map: Record<string, (typeof students)[number]> = {};
    for (const s of students) map[s.id] = s;
    return map;
  }, [students]);

  const currentLesson = useMemo(() => findCurrentLesson(lessons), [lessons]);
  const todos = useMemo(() => todoLessons(lessons), [lessons]);
  const checklist = useMemo(() => lessonChecklistTodos(lessons), [lessons]);
  const upcoming = useMemo(() => nextLesson(lessons), [lessons]);
  const expectedIncome = useMemo(
    () => expectedIncomeFromLessons(lessons, studentMap, period),
    [lessons, studentMap, period],
  );
  const plannedCount = useMemo(
    () => plannedLessons(lessons, period).length,
    [lessons, period],
  );

  const handleTodoConfirm = async (
    lessonId: string,
    _attendanceStatus: AttendanceStatus,
    shouldInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    // Apply any lesson tweaks first — this happens whether or not an invoice
    // is sent, since the lesson itself should reflect what was actually done.
    let effective = lesson;
    const hasEdits =
      edits &&
      (edits.subject !== undefined ||
        edits.durationMinutes !== undefined);
    if (hasEdits) {
      const data: UpdateLessonRequest = {};
      if (edits!.subject !== undefined) data.subject = edits!.subject;
      if (edits!.durationMinutes !== undefined) {
        data.durationMinutes = edits!.durationMinutes;
      }
      effective = await updateLessonDetails.mutateAsync({ id: lessonId, data });
    }

    if (!shouldInvoice) return;

    const student = studentMap[effective.studentId];
    if (!student) return;
    const name = studentNames[effective.studentId] ?? "Student";

    const createdInvoice = await invoiceLesson.mutateAsync({
      lesson: effective,
      rateType: student.rateType,
      expectedAmount: student.expectedAmount,
    });

    toast.success(`Invoice sent to ${name}`);
    navigate(`/payments/${createdInvoice.id}`);
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
            <ThingsToDo
              attendanceLessons={todos}
              checklistItems={checklist}
              studentNames={studentNames}
              studentSubjectOptions={studentSubjectOptions}
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
