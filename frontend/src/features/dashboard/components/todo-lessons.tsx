import { Link } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, ListTodo, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LessonResponse, AttendanceStatus } from "@examify-tms/interfaces";
import { useMarkLessonDone } from "../api";
import { lessonTimeRange, relativeDayLabel } from "../lib";
import { MarkAttendanceDialog } from "./mark-attendance-dialog";

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "present",
  present_late: "late",
  absent_no_makeup: "absent",
  absent_makeup_issued: "absent (makeup issued)",
  absent_warning: "absent (warning)",
  tutor_cancelled: "tutor cancelled",
  tutor_cancelled_makeup_issued: "tutor cancelled (makeup issued)",
  unrecorded: "unrecorded",
};

type Props = {
  lessons: LessonResponse[];
  studentNames: Record<string, string>;
  onConfirm: (
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    sendInvoice: boolean,
  ) => Promise<void>;
};

export function TodoLessons({ lessons, studentNames, onConfirm }: Props) {
  const markDone = useMarkLessonDone();
  const items = lessons;
  const [openDialogLessonId, setOpenDialogLessonId] = useState<string | null>(null);

  const handleConfirm = async (
    lessonId: string,
    attendanceStatus: AttendanceStatus,
    sendInvoice: boolean,
  ) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson) return;

    const name = studentNames[lesson.studentId] ?? "Unknown student";
    try {
      await markDone.mutateAsync({ id: lessonId, attendanceStatus });
      toast.success(`Marked ${name}'s lesson as ${ATTENDANCE_LABELS[attendanceStatus]}`);
      await onConfirm(lessonId, attendanceStatus, sendInvoice);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark lesson");
      throw err;
    }
  };

  const getOpenDialogLesson = (): LessonResponse | undefined => {
    if (!openDialogLessonId) return undefined;
    return lessons.find((l) => l.id === openDialogLessonId);
  };

  const openDialogLesson = getOpenDialogLesson();
  const openDialogStudentName = openDialogLesson
    ? studentNames[openDialogLesson.studentId] ?? "Unknown student"
    : undefined;

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <ListTodo className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Things to do</CardTitle>
          </div>
          {items.length > 0 && (
            <Badge variant="secondary">{items.length}</Badge>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="text-sm text-muted-foreground">All caught up!</p>
            </div>
          ) : (
            <ScrollArea className="h-[220px] pr-3">
              <ul className="space-y-2">
                {items.map((l) => {
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
                        className="shrink-0 gap-1.5"
                        disabled={markDone.isPending}
                        onClick={() => setOpenDialogLessonId(l.id)}
                      >
                        {markDone.isPending && markDone.variables?.id === l.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Mark Attendance
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {openDialogLesson && openDialogStudentName && (
        <MarkAttendanceDialog
          open={!!openDialogLesson}
          onOpenChange={(open) => setOpenDialogLessonId(open ? openDialogLessonId : null)}
          lesson={openDialogLesson}
          studentName={openDialogStudentName}
          onConfirm={handleConfirm}
          isPending={markDone.isPending}
        />
      )}
    </>
  );
}
