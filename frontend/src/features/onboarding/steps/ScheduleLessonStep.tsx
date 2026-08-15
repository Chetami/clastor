import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { format } from "date-fns";
import { CalendarPlus, Loader2, Users } from "lucide-react";
import type { CreateLessonRequest } from "@examify-tms/interfaces";

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
import { DurationPicker } from "@/features/schedule/create-event/DurationPicker";
import { track } from "@/lib/analytics";
import { loadDrafts, saveDrafts, type LessonDraft } from "../draft-storage";

const AUTO_ADVANCE_MS = 1200;

/** Default to tomorrow at 4pm. */
function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return format(d, "yyyy-MM-dd");
}

export type ScheduleLessonStepHandle = {
  submit: () => Promise<void>;
};

type ScheduleLessonPhase = "form" | "success";

type ScheduleLessonStepState = {
  phase: ScheduleLessonPhase;
  autoAdvance: boolean;
  canSubmit: boolean;
  isPending: boolean;
  error: string | null;
};

type ScheduleLessonStepProps = {
  hasLessons: boolean;
  onAdvance: () => void;
  onStateChange: (state: ScheduleLessonStepState) => void;
};

/**
 * The aha moment: schedule the first lesson. A lean one-off scheduler that
 * defaults to the most recently added student (e.g. the one from the previous
 * step) and tags it with a subject. The footer "Book lesson" action drives an
 * imperative submit handle. After a successful create it plays a checkmark
 * animation and auto-advances; if revisited after a lesson already exists it
 * shows the confirmation statically so Continue can move on.
 */
export const ScheduleLessonStep = forwardRef<
  ScheduleLessonStepHandle,
  ScheduleLessonStepProps
>(function ScheduleLessonStep(
  { hasLessons, onAdvance, onStateChange },
  ref,
) {
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

  // "success" is only reached via a real create in this session. Returning to
  // the step after a lesson already exists starts in a static (non-auto-
  // advancing) success view.
  const [created, setCreated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Seed from the persisted draft once, in the state initializers (reading
  // sessionStorage in the render body would re-parse on every render).
  const [studentId, setStudentId] = useState(
    () => loadDrafts().lesson?.studentId ?? "",
  );
  const [subjectId, setSubjectId] = useState(
    () => loadDrafts().lesson?.subjectId ?? "",
  );
  const [date, setDate] = useState(
    () => loadDrafts().lesson?.date ?? defaultDate(),
  );
  const [startTime, setStartTime] = useState(
    () => loadDrafts().lesson?.startTime ?? "16:00",
  );
  const [duration, setDuration] = useState(
    () => loadDrafts().lesson?.duration ?? 60,
  );

  // Persist the draft so Back/forward doesn't lose it.
  useEffect(() => {
    const drafts = loadDrafts();
    const lesson: LessonDraft = {
      studentId,
      subjectId,
      date,
      startTime,
      duration,
    };
    saveDrafts({ ...drafts, lesson });
  }, [studentId, subjectId, date, startTime, duration]);

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

  // The student's own subjects (a subset of the tutor's catalogue).
  const studentSubjects = useMemo(
    () =>
      selectedStudent
        ? subjects.filter((s) => selectedStudent.subjectIds.includes(s.id))
        : [],
    [subjects, selectedStudent],
  );

  // If the student has exactly one subject, auto-select it so the inline
  // copy can reference it without showing a picker.
  useEffect(() => {
    if (
      selectedStudent &&
      studentSubjects.length === 1 &&
      subjectId !== studentSubjects[0].id
    ) {
      setSubjectId(studentSubjects[0].id);
    }
  }, [selectedStudent, studentSubjects, subjectId]);

  const showSuccess = created || hasLessons;
  const autoAdvance = created;
  const phase: ScheduleLessonPhase = showSuccess ? "success" : "form";

  useEffect(() => {
    onStateChange({
      phase,
      autoAdvance,
      canSubmit: !!studentId,
      isPending: createLesson.isPending,
      error: validationError ?? createLesson.error?.message ?? null,
    });
  }, [
    phase,
    autoAdvance,
    studentId,
    createLesson.isPending,
    createLesson.error,
    validationError,
    onStateChange,
  ]);

  // Auto-advance a beat after the success animation kicks in. The lessons
  // list refetch (triggered by the create) resolves well within this window.
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase === "success" && autoAdvance) {
      advanceTimer.current = setTimeout(onAdvance, AUTO_ADVANCE_MS);
    }
    return () => {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
    };
  }, [phase, autoAdvance, onAdvance]);

  useImperativeHandle(
    ref,
    () => ({
      async submit() {
        if (!selectedStudent) return;
        const startMs = new Date(`${date}T${startTime}:00`).getTime();
        if (Number.isNaN(startMs)) {
          setValidationError("Enter a valid date and time");
          return;
        }
        if (startMs <= Date.now()) {
          setValidationError("Pick a date and time in the future");
          return;
        }
        setValidationError(null);
        const startDateTime = new Date(
          `${date}T${startTime}:00`,
        ).toISOString();
        const payload: CreateLessonRequest = {
          studentId: selectedStudent.id,
          subject: subjectName,
          startDateTime,
          durationMinutes: duration,
          location: null,
          notes: null,
          remindersEnabled: true,
        };
        try {
          await createLesson.mutateAsync(payload);
          track("onboarding_lesson_booked", { duration });
          setCreated(true);
        } catch {
          // surfaced via mutation state
        }
      },
    }),
    [selectedStudent, subjectName, date, startTime, duration, createLesson],
  );

  // Keep the spinner up while the list is loading OR while it's empty but a
  // refetch is in flight (e.g. we just advanced here after adding a student
  // and the invalidation hasn't resolved yet). Otherwise we'd flash the "Add
  // a student first" empty state before the new student arrives.
  if (
    studentsQuery.isLoading ||
    (students.length === 0 && studentsQuery.isFetching)
  ) {
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

  if (showSuccess) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <svg
          viewBox="0 0 52 52"
          className="size-14 overflow-visible text-emerald-500"
          aria-hidden="true"
        >
          <circle
            cx="26"
            cy="26"
            r="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="ob-success-circle"
          />
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14 27 l8 8 l16 -16"
            className="ob-success-check"
          />
        </svg>
        <div className="ob-success-text flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Lesson booked!</h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {autoAdvance
              ? "Taking you to the next step\u2026"
              : "Continue to connect your calendar."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <CalendarPlus className="size-4" />
          Schedule your first lesson
        </h2>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <p className="text-lg font-medium tracking-tight">
            When are you seeing{" "}
            <span className="text-primary">
              {selectedStudent?.name ?? "your student"}
            </span>
            {studentSubjects.length === 1
              ? ` for their `
              : " "}
            {studentSubjects.length === 1 && (
              <span className="text-primary">
                {studentSubjects[0].name}
              </span>
            )}
            {studentSubjects.length === 1 ? ` lesson ` : ""}
            next?
          </p>
        </div>

        {studentSubjects.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <Label>What subject are you doing in this lesson?</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a subject" />
              </SelectTrigger>
              <SelectContent>
                {studentSubjects.map((s) => (
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

        <div className="flex flex-col gap-2">
          <Label>Duration</Label>
          <DurationPicker value={duration} onChange={setDuration} />
        </div>
      </div>
    </div>
  );
});
