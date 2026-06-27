import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  Loader2,
  Users,
} from "lucide-react";
import type { CreateLessonRequest } from "@examify-tms/interfaces";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSubjects } from "@/lib/subjects";
import { useListStudents } from "@/features/students/api/use-list-students";
import { useCreateLesson } from "@/features/schedule/api/use-create-lesson";

const DURATIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

/** Default to tomorrow at 4pm. */
function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return format(d, "yyyy-MM-dd");
}

/**
 * The aha moment: schedule the first lesson. A lean one-off scheduler that
 * defaults to the most recently added student (e.g. the one from the previous
 * step) and tags it with a subject. Creates a real lesson immediately.
 * Skippable.
 */
export function ScheduleLessonStep() {
  const studentsQuery = useListStudents();
  const subjects = useSubjects();
  const createLesson = useCreateLesson();

  const students = useMemo(
    () =>
      [...(studentsQuery.data ?? [])].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [studentsQuery.data],
  );

  const [studentId, setStudentId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(defaultDate());
  const [startTime, setStartTime] = useState("16:00");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [created, setCreated] = useState<{
    at: string;
    student: string;
  } | null>(null);

  // Default-select the newest student once the list loads.
  useEffect(() => {
    if (!studentId && students.length > 0) {
      const newest = students[0];
      setStudentId(newest.id);
      if (newest.subjectIds[0]) setSubjectId(newest.subjectIds[0]);
    }
  }, [students, studentId]);

  const selectedStudent = students.find((s) => s.id === studentId);
  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? null;

  if (studentsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Users className="size-6 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Add a student first
          </h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            You need at least one student before you can schedule a lesson. Go
            back a step to add one — it only takes a moment.
          </p>
        </div>
      </div>
    );
  }

  if (created) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle2 className="size-12 text-emerald-500" />
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">
            Lesson booked!
          </h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Your first lesson is on the calendar! You're officially up and
            running. Head over to your Schedule anytime to see or manage
            it.{" "}
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2 rounded-lg border bg-muted/30 p-4 text-left text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Student</span>
            <span className="font-medium">{created.student}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">When</span>
            <span className="font-medium">
              {format(new Date(created.at), "EEE d MMM, h:mma")}
            </span>
          </div>
          {subjectName && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subject</span>
              <span className="font-medium">{subjectName}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    if (!selectedStudent) return;
    const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
    const payload: CreateLessonRequest = {
      studentId: selectedStudent.id,
      subject: subjectName,
      startDateTime,
      durationMinutes: duration,
      location: null,
      notes: notes.trim() || null,
      remindersEnabled: true,
    };
    try {
      await createLesson.mutateAsync(payload);
      setCreated({ at: startDateTime, student: selectedStudent.name });
    } catch {
      // surfaced via mutation state
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <CalendarPlus className="size-4" />
          Schedule your first lesson
        </h2>
        <p className="text-sm text-muted-foreground">
          This is the moment Clastor clicks — get a lesson on the calendar and
          watch your schedule come to life.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Student</Label>
          <Select
            value={studentId}
            onValueChange={(v) => {
              setStudentId(v);
              const s = students.find((x) => x.id === v);
              setSubjectId(s?.subjectIds[0] ?? "");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {subjects.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label>Subject (optional)</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="No subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ob-lesson-date">Date</Label>
            <Input
              id="ob-lesson-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ob-lesson-time">Start time</Label>
            <Input
              id="ob-lesson-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Duration</Label>
          <Select
            value={String(duration)}
            onValueChange={(v) => setDuration(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d.value} value={String(d.value)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    {d.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-lesson-notes">Notes (optional)</Label>
          <Input
            id="ob-lesson-notes"
            value={notes}
            placeholder="e.g. Bring textbook chapter 4"
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={createLesson.isPending || !studentId}
        >
          {createLesson.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarPlus className="size-4" />
          )}
          Book lesson
        </Button>
        {createLesson.isError && (
          <span className="text-xs text-destructive">
            {createLesson.error.message}
          </span>
        )}
      </div>
    </div>
  );
}
