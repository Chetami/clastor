import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ChevronRight,
  FileText,
} from "lucide-react";
import type { LessonResponse } from "@examify-tms/interfaces";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useListLessons } from "@/features/schedule/api";
import { useListStudents } from "@/features/students/api";
import { useListInvoices } from "@/features/payments/api";
import { formatCurrency, formatDate } from "@/features/payments/invoice-utils";
import {
  formatLessonDate,
  formatLessonTime,
  getInitials,
} from "@/features/lessons/lesson-display";

/** Cancelled lessons aren't billable, so never need an invoice. */
function isCancelledLesson(lesson: LessonResponse): boolean {
  return (
    lesson.isCancelled ||
    lesson.attendanceStatus === "tutor_cancelled" ||
    lesson.attendanceStatus === "tutor_cancelled_makeup_issued"
  );
}

function isPastLesson(lesson: LessonResponse): boolean {
  return new Date(lesson.startDateTime).getTime() < Date.now();
}

interface OverdueRow {
  key: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string;
}

/**
 * Two "needs attention" cards shown above the lessons browse list:
 *   1. Needs invoicing  — past lessons with no invoice attached yet
 *   2. Overdue          — lessons sitting on an unpaid, overdue invoice
 *
 * Each fetches its own data (deduped by React Query) and renders nothing
 * when empty, keeping the page quiet when the tutor is all caught up.
 */
export function ActionableLessons() {
  const navigate = useNavigate();
  const { data: students = [] } = useListStudents();

  // `unpaid: true` on the backend already excludes lessons that have an
  // invoiceId OR are marked paid, so this is exactly the uninvoiced set.
  const { data: unpaidLessons = [], isLoading: lessonsLoading } =
    useListLessons({ unpaid: true });
  const { data: overdueInvoices = [], isLoading: invoicesLoading } =
    useListInvoices({ status: "overdue" });

  const studentMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of students) map[s.id] = s.name;
    return map;
  }, [students]);

  const needsInvoicing = useMemo(
    () =>
      unpaidLessons
        .filter((l) => isPastLesson(l) && !isCancelledLesson(l))
        .sort(
          (a, b) =>
            new Date(b.startDateTime).getTime() -
            new Date(a.startDateTime).getTime(),
        ),
    [unpaidLessons],
  );

  const overdueRows = useMemo<OverdueRow[]>(() => {
    const rows: OverdueRow[] = [];
    for (const inv of overdueInvoices) {
      for (const li of inv.lineItems) {
        rows.push({
          key: `${inv.id}:${li.lessonId}`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName,
          description: li.description,
          amount: li.amount,
          currency: inv.currency,
          dueDate: inv.dueDate,
        });
      }
    }
    // Most overdue first.
    rows.sort(
      (a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
    return rows;
  }, [overdueInvoices]);

  const loading = lessonsLoading || invoicesLoading;
  const hasNeedsInvoicing = needsInvoicing.length > 0;
  const hasOverdue = overdueRows.length > 0;

  if (loading || (!hasNeedsInvoicing && !hasOverdue)) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Needs invoicing */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-sm font-semibold tracking-tight">
              Needs invoicing
            </h3>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {needsInvoicing.length}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="max-h-80 divide-y overflow-y-auto">
            {needsInvoicing.map((lesson) => {
              const name = studentMap[lesson.studentId] ?? "Unknown student";
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
                        {lesson.subject || "Lesson"}
                        <span className="mx-1 text-muted-foreground/50">·</span>
                        {formatLessonDate(lesson.startDateTime)}
                        <span className="mx-1 text-muted-foreground/50">·</span>
                        {formatLessonTime(lesson.startDateTime)}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Overdue */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <h3 className="text-sm font-semibold tracking-tight">
              Overdue
            </h3>
          </div>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {overdueRows.length}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="max-h-80 divide-y overflow-y-auto">
            {overdueRows.map((row) => (
              <li
                key={row.key}
                className="group flex cursor-pointer items-center justify-between gap-3 px-6 py-2.5 transition-colors hover:bg-accent/40"
                onClick={() => navigate(`/payments/${row.invoiceId}`)}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-xs font-medium text-rose-600 dark:text-rose-400">
                    {getInitials(row.customerName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium leading-tight">
                      {row.customerName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.description}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-sm font-medium">
                    {formatCurrency(row.amount, row.currency)}
                  </span>
                  <span className="text-[11px] text-rose-600 dark:text-rose-400">
                    Due {formatDate(row.dueDate)}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
