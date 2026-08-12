import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, ListTodo, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import type { LessonResponse, AttendanceStatus } from "@examify-tms/interfaces";
import { useMarkLessonDone } from "../api";
import {
  lessonTimeRange,
  relativeDayLabel,
  type LessonChecklistItem,
} from "../lib";
import { MarkAttendanceDialog } from "@/components/mark-attendance-dialog";
import type { InvoiceLessonEdits } from "@/features/payments/api";
import { ATTENDANCE_LABELS } from "@/features/schedule/lesson-utils";

type Props = {
  attendanceLessons: LessonResponse[];
  checklistItems: LessonChecklistItem[];
  studentNames: Record<string, string>;
  studentSubjectOptions: Record<string, string[]>;
  onConfirm: (
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    sendInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) => Promise<void>;
};

export function ThingsToDo({
  attendanceLessons,
  checklistItems,
  studentNames,
  studentSubjectOptions,
  onConfirm,
}: Props) {
  const markDone = useMarkLessonDone();
  const [openDialogLessonId, setOpenDialogLessonId] = useState<string | null>(
    null,
  );

  const attendanceCount = attendanceLessons.length;
  const checklistCount = checklistItems.length;
  const hasAny = attendanceCount > 0 || checklistCount > 0;
  const defaultTab = attendanceCount > 0 ? "attendance" : "lesson-todos";

  const handleConfirm = async (
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    sendInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ) => {
    const lesson = attendanceLessons.find((l) => l.id === lessonId);
    if (!lesson) return;
    const name = studentNames[lesson.studentId] ?? "Unknown student";
    try {
      await markDone.mutateAsync({ id: lessonId, attendanceStatus });
      toast.success(
        `Marked ${name}'s lesson as ${ATTENDANCE_LABELS[attendanceStatus]}`,
      );
      await onConfirm(lessonId, attendanceStatus, sendInvoice, edits);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark lesson");
      throw err;
    }
  };

  const openDialogLesson = openDialogLessonId
    ? attendanceLessons.find((l) => l.id === openDialogLessonId)
    : undefined;
  const openDialogStudentName = openDialogLesson
    ? (studentNames[openDialogLesson.studentId] ?? "Unknown student")
    : undefined;

  return (
    <>
      <Card data-tour="things-to-do" className="flex flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Things to do</CardTitle>
          </div>
          {hasAny && (
            <Badge variant="secondary">
              {attendanceCount + checklistCount}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          {!hasAny ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm text-muted-foreground">All caught up!</p>
            </div>
          ) : (
            <Tabs defaultValue={defaultTab}>
              <TabsList className="w-full">
                <TabsTrigger value="attendance">
                  Attendance
                  {attendanceCount > 0 && (
                    <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular-nums">
                      {attendanceCount}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="lesson-todos">
                  Lesson todos
                  {checklistCount > 0 && (
                    <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular-nums">
                      {checklistCount}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="attendance" className="mt-2">
                <AttendanceList
                  lessons={attendanceLessons}
                  studentNames={studentNames}
                  onMark={setOpenDialogLessonId}
                  markDonePending={markDone.isPending}
                  markDoneId={markDone.variables?.id}
                />
              </TabsContent>

              <TabsContent value="lesson-todos" className="mt-2">
                <ChecklistList
                  items={checklistItems}
                  studentNames={studentNames}
                />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {openDialogLesson && openDialogStudentName && (
        <MarkAttendanceDialog
          open={!!openDialogLesson}
          onOpenChange={(open) =>
            setOpenDialogLessonId(open ? openDialogLessonId : null)
          }
          lesson={openDialogLesson}
          studentName={openDialogStudentName}
          subjectOptions={
            studentSubjectOptions[openDialogLesson.studentId] ?? []
          }
          onConfirm={handleConfirm}
          isPending={markDone.isPending}
        />
      )}
    </>
  );
}

function AttendanceList({
  lessons,
  studentNames,
  onMark,
  markDonePending,
  markDoneId,
}: {
  lessons: LessonResponse[];
  studentNames: Record<string, string>;
  onMark: (lessonId: string) => void;
  markDonePending: boolean;
  markDoneId?: string;
}) {
  if (lessons.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No lessons awaiting attendance.
      </p>
    );
  }
  return (
    <ScrollArea className="h-[220px] pr-3">
      <ul className="space-y-2">
        {lessons.map((l) => {
          const name = studentNames[l.studentId] ?? "Unknown student";
          return (
            <li
              key={l.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 space-y-0.5">
                <Link
                  to={`/lessons/${l.id}`}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {l.subject} · {relativeDayLabel(l.startDateTime)} ·{" "}
                  {lessonTimeRange(l)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={markDonePending}
                onClick={() => onMark(l.id)}
              >
                {markDonePending && markDoneId === l.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-3" />
                )}
                Attendance
              </Button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}

function ChecklistList({
  items,
  studentNames,
}: {
  items: LessonChecklistItem[];
  studentNames: Record<string, string>;
}) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No pending lesson todos.
      </p>
    );
  }
  return (
    <ScrollArea className="h-[220px] pr-3">
      <ul className="space-y-2">
        {items.map(({ lesson, todo }) => {
          const name = studentNames[lesson.studentId] ?? "Unknown student";
          return (
            <li key={`${lesson.id}-${todo.id}`}>
              <Link
                to={`/lessons/${lesson.id}`}
                className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
              >
                <Square className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="line-clamp-2 break-words text-sm font-medium">
                    {todo.text}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {name}
                    {lesson.subject ? ` · ${lesson.subject}` : ""} ·{" "}
                    {relativeDayLabel(lesson.startDateTime)} ·{" "}
                    {lessonTimeRange(lesson)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
