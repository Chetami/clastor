import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useListLessons } from "@/features/schedule/api";
import { toast } from "sonner";
import type {
  DashboardPeriod,
  AttendanceStatus,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import { useDashboardSummary, useUpdateLessonDetails } from "./api";
import { useInvoiceLesson } from "@/features/payments/api";
import type { InvoiceLessonEdits } from "@/features/payments/api";
import { SendInvoiceDialog } from "@/components/send-invoice-dialog";
import { useStudentLookups } from "@/lib/use-student-lookups";
import { EMAIL_SEND_CONTEXTS, shouldSkipReview } from "@examify-tms/shared";
import { PeriodSelector } from "./components/period-selector";
import { StatCards } from "./components/stat-cards";
import { HoursChart } from "./components/hours-chart";
import { IncomeChart } from "./components/income-chart";
import { NextLesson } from "./components/next-lesson";
import { CurrentLesson } from "./components/current-lesson";
import { ThingsToDo } from "./components/things-to-do";
// import { QuickActions } from "./components/quick-actions";
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
  const {
    names: studentNames,
    byId: studentMap,
    subjectOptions: studentSubjectOptions,
  } = useStudentLookups();
  const invoiceLesson = useInvoiceLesson();
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);
  const updateLessonDetails = useUpdateLessonDetails();

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
      (edits.subject !== undefined || edits.durationMinutes !== undefined);
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

    // Decide whether to review the email before sending or fire it off in the
    // background. The attendance-marking surface is registered as a
    // background-send exception, and the user can also disable review globally
    // via Settings → Review emails before sending.
    if (
      shouldSkipReview(
        EMAIL_SEND_CONTEXTS.ATTENDANCE_MARKING.key,
        user?.emailReviewSettings ?? null,
      )
    ) {
      // Background: create + send immediately without blocking the UI or
      // showing a review dialog. Toasts communicate the outcome.
      toast.info(`Creating and sending invoice to ${name}…`);
      invoiceLesson.mutate(
        {
          lesson: effective,
          rateType: student.rateType,
          expectedAmount: student.expectedAmount,
          skipSend: false,
        },
        {
          onSuccess: () =>
            toast.success(`Invoice created and sent to ${name}.`),
          onError: (err) =>
            toast.error(
              err instanceof Error
                ? `Couldn't send invoice to ${name}: ${err.message}`
                : `Couldn't send invoice to ${name}.`,
            ),
        },
      );
      return;
    }

    // Review: create the invoice (unsent) and open the compose dialog so the
    // tutor can edit/preview the email before sending.
    const createdInvoice = await invoiceLesson.mutateAsync({
      lesson: effective,
      rateType: student.rateType,
      expectedAmount: student.expectedAmount,
      skipSend: true,
    });

    toast.success(`Invoice created for ${name} — review before sending.`);
    setSendInvoiceId(createdInvoice.id);
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
          {/* dont need this anymore  */}
          {/* <QuickActions /> */}

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

      <SendInvoiceDialog
        invoiceId={sendInvoiceId}
        onClose={() => setSendInvoiceId(null)}
        onSent={(id) => navigate(`/payments/${id}`)}
      />
    </div>
  );
}
