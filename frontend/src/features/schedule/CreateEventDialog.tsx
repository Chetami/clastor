import { useEffect, useMemo, useState } from "react";
import { Video, TriangleAlert, MapPin, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListStudents } from "@/features/students/api";
import { useSubjects } from "@/lib/subjects";
import { useCreateLesson, useCreateRecurringLesson } from "./api";
import { generateMeetLinkRequest, updateLessonRequest } from "./api/requests";
import {
  DAYS,
  DAY_LABELS,
  eventFormSchema,
  toCreateLessonRequest,
  toCreateRecurringLessonRequest,
  type EventFormData,
} from "./event-schema";
import { isRangeOverlap } from "./lesson-utils";
import { isSlotOutsideWorkingHours } from "./working-hours-utils";
import { useAuthStore } from "@/store/auth-store";
import type { DayOfWeek, ExternalCalendarEvent } from "@examify-tms/interfaces";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  start: Date | null;
  end: Date | null;
  externalEvents?: ExternalCalendarEvent[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const JS_DAY_NAMES: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function weekdayOf(dateStr: string): DayOfWeek | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return JS_DAY_NAMES[new Date(`${dateStr}T00:00:00`).getDay()];
}

function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function emptyValues(): EventFormData {
  return {
    studentId: "",
    studentName: "",
    subject: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
    repeat: "none",
    selectedDays: [],
    slotTimes: {},
    endsMode: "until",
    endDate: "",
    occurrenceCount: undefined,
  };
}

type LocationMode = "zoom" | "meet" | "inperson" | "other" | "";
type FieldErrors = Partial<Record<keyof EventFormData, string>>;

export function CreateEventDialog({
  open,
  onOpenChange,
  start,
  end,
  externalEvents = [],
}: CreateEventDialogProps) {
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();
  const user = useAuthStore((s) => s.user);
  const createLesson = useCreateLesson();
  const createRecurring = useCreateRecurringLesson();
  const [values, setValues] = useState<EventFormData>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [locationMode, setLocationMode] = useState<LocationMode>("");
  // null = unknown, true = connected, false = not connected
  const isRecurring = values.repeat !== "none";
  const [meetAttaching, setMeetAttaching] = useState(false);
  const pending =
    createLesson.isPending || createRecurring.isPending || meetAttaching;
  const submitError =
    createLesson.error?.message ?? createRecurring.error?.message;

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === values.studentId);
  }, [students, values.studentId]);

  const studentSubjects = useMemo(() => {
    if (!selectedStudent) return [];
    return subjects.filter((s) => selectedStudent.subjectIds?.includes(s.id));
  }, [selectedStudent, subjects]);

  // Warn (non-blocking) if the chosen one-off slot overlaps an external Google
  // Calendar event. Only computed for the single-lesson case where a concrete
  // date + time range is known.
  const overlaps = useMemo(() => {
    if (isRecurring) return [];
    if (!values.date || !values.startTime || !values.endTime) return [];
    const startMs = new Date(`${values.date}T${values.startTime}:00`).getTime();
    const endMs = new Date(`${values.date}T${values.endTime}:00`).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) {
      return [];
    }
    return externalEvents.filter((ev) =>
      isRangeOverlap(
        new Date(startMs),
        new Date(endMs),
        ev.startDateTime,
        ev.endDateTime,
      ),
    );
  }, [
    isRecurring,
    values.date,
    values.startTime,
    values.endTime,
    externalEvents,
  ]);

  // Warn (non-blocking) if the chosen one-off slot is outside the tutor's
  // configured working hours (day off, or before/after the daily window).
  const outsideHours = useMemo(() => {
    if (isRecurring) return false;
    if (!values.date || !values.startTime || !values.endTime) return false;
    return isSlotOutsideWorkingHours(
      values.date,
      values.startTime,
      values.endTime,
      user?.workingHours,
    );
  }, [
    isRecurring,
    values.date,
    values.startTime,
    values.endTime,
    user?.workingHours,
  ]);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setLocationMode("");
    setValues({
      ...emptyValues(),
      date: start ? toDateStr(start) : "",
      startTime: start ? toTimeStr(start) : "",
      endTime: end ? toTimeStr(end) : "",
    });
  }, [open, start, end]);

  function update<K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K],
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleLocationModeChange(mode: LocationMode) {
    if (mode === locationMode) {
      setLocationMode("");
      update("location", "");
      return;
    }
    if (mode === "zoom") {
      setLocationMode("zoom");
      update("location", "Zoom");
      return;
    }
    if (mode === "inperson") {
      setLocationMode("inperson");
      update("location", "In Person");
      return;
    }
    if (mode === "meet") {
      setLocationMode("meet");
      update("location", "Google Meet");
      return;
    }
    setLocationMode("other");
    update("location", "");
  }

  function handleStudentChange(id: string) {
    const student = students.find((s) => s.id === id);
    if (!student) {
      update("studentId", id);
      update("subject", "");
      return;
    }
    setValues((prev) => {
      const studentSubjectNames = student.subjectIds
        ?.map((sid) => subjects.find((s) => s.id === sid)?.name)
        .filter((n): n is string => !!n);
      const keepSubject =
        prev.subject && studentSubjectNames?.includes(prev.subject);
      return {
        ...prev,
        studentId: student.id,
        studentName: student.name,
        subject: keepSubject ? prev.subject : "",
      };
    });
    setErrors((prev) => ({
      ...prev,
      studentId: undefined,
      subject: undefined,
    }));
  }

  function handleRepeatChange(next: EventFormData["repeat"]) {
    if (next === "none") {
      update("repeat", "none");
      return;
    }
    // Seed the day picker with the weekday of the chosen date (if empty).
    setValues((prev) => {
      if (prev.selectedDays.length > 0) {
        return { ...prev, repeat: next };
      }
      const day = weekdayOf(prev.date);
      if (!day) return { ...prev, repeat: next };
      return {
        ...prev,
        repeat: next,
        selectedDays: [day],
        slotTimes: { ...prev.slotTimes, [day]: prev.startTime },
      };
    });
    setErrors((prev) => ({
      ...prev,
      repeat: undefined,
      selectedDays: undefined,
    }));
  }

  function toggleDay(day: DayOfWeek) {
    setValues((prev) => {
      const isSelected = prev.selectedDays.includes(day);
      const selectedDays = isSelected
        ? prev.selectedDays.filter((d) => d !== day)
        : [...prev.selectedDays, day];
      const slotTimes = { ...prev.slotTimes };
      if (!isSelected && !slotTimes[day]) {
        slotTimes[day] = prev.startTime;
      }
      return { ...prev, selectedDays, slotTimes };
    });
    setErrors((prev) => ({
      ...prev,
      selectedDays: undefined,
      slotTimes: undefined,
    }));
  }

  async function attachMeetLink(lessonId: string, data: EventFormData) {
    try {
      const startDateTime = new Date(
        `${data.date}T${data.startTime}:00`,
      ).toISOString();
      const durationMinutes = Math.max(
        1,
        Math.round(
          (new Date(`${data.date}T${data.endTime}:00`).getTime() -
            new Date(`${data.date}T${data.startTime}:00`).getTime()) /
            60000,
        ),
      );
      const { meetingLink } = await generateMeetLinkRequest({
        lessonId,
        startDateTime,
        durationMinutes,
      });
      await updateLessonRequest(lessonId, {
        location: "Google Meet",
        meetLink: meetingLink,
      });
    } catch {
      // best-effort — lesson was created, Meet link just didn't attach
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = eventFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof EventFormData;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    try {
      if (result.data.repeat === "none") {
        const lesson = await createLesson.mutateAsync(
          toCreateLessonRequest(result.data),
        );
        if (locationMode === "meet") {
          setMeetAttaching(true);
          await attachMeetLink(lesson.id, result.data);
          setMeetAttaching(false);
        }
      } else {
        const student = students.find((s) => s.id === result.data.studentId);
        const timezone = student?.timezone || browserTimezone();
        await createRecurring.mutateAsync(
          toCreateRecurringLessonRequest(result.data, timezone),
        );
      }
      onOpenChange(false);
    } catch {
      // error surfaced below; keep dialog open
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New lesson</DialogTitle>
          <DialogDescription>
            Add a one-off lesson, or set it to repeat weekly or bi-weekly.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="student">Student</Label>
            <Select
              value={values.studentId}
              onValueChange={handleStudentChange}
              disabled={students.length === 0}
            >
              <SelectTrigger id="student" aria-invalid={!!errors.studentId}>
                <SelectValue
                  placeholder={
                    students.length === 0
                      ? "Add a student first"
                      : "Select a student"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.studentId && (
              <p className="text-xs text-destructive">{errors.studentId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">
              Subject{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Select
              value={values.subject}
              onValueChange={(v) => update("subject", v)}
              disabled={!selectedStudent}
            >
              <SelectTrigger id="subject" aria-invalid={!!errors.subject}>
                <SelectValue
                  placeholder={
                    selectedStudent && studentSubjects.length > 0
                      ? "Select a subject"
                      : "No subjects assigned"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No subject</SelectItem>
                {studentSubjects.map((s) => (
                  <SelectItem key={s.id} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.subject && (
              <p className="text-xs text-destructive">{errors.subject}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">{isRecurring ? "Start date" : "Date"}</Label>
            <Input
              id="date"
              type="date"
              aria-invalid={!!errors.date}
              value={values.date}
              onChange={(e) => update("date", e.target.value)}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startTime">
                {isRecurring ? "Default time" : "Start"}
              </Label>
              <Input
                id="startTime"
                type="time"
                aria-invalid={!!errors.startTime}
                value={values.startTime}
                onChange={(e) => update("startTime", e.target.value)}
              />
              {errors.startTime && (
                <p className="text-xs text-destructive">{errors.startTime}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End</Label>
              <Input
                id="endTime"
                type="time"
                aria-invalid={!!errors.endTime}
                value={values.endTime}
                onChange={(e) => update("endTime", e.target.value)}
              />
              {errors.endTime && (
                <p className="text-xs text-destructive">{errors.endTime}</p>
              )}
            </div>
          </div>

          {overlaps.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-medium">
                  Overlaps with a Google Calendar event
                </p>
                <ul className="list-inside list-disc text-amber-600/90 dark:text-amber-400/90">
                  {overlaps.map((ev) => (
                    <li key={ev.id}>{ev.title}</li>
                  ))}
                </ul>
                <p className="text-amber-600/80 dark:text-amber-400/80">
                  You can still create this lesson.
                </p>
              </div>
            </div>
          )}

          {outsideHours && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-0.5">
                <p className="font-medium">Outside your working hours</p>
                <p className="text-amber-600/80 dark:text-amber-400/80">
                  This time is outside the working hours you set. You can still
                  create this lesson, or adjust your hours in Settings.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="repeat">Repeat</Label>
            <Select
              value={values.repeat}
              onValueChange={(v) =>
                handleRepeatChange(v as EventFormData["repeat"])
              }
            >
              <SelectTrigger id="repeat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Does not repeat</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Every 2 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isRecurring && (
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label>Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day) => {
                    const selected = values.selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleDay(day)}
                        className={
                          selected
                            ? "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-primary bg-primary/10 px-3 text-sm font-medium text-primary transition-colors"
                            : "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        }
                      >
                        {DAY_LABELS[day]}
                      </button>
                    );
                  })}
                </div>
                {errors.selectedDays && (
                  <p className="text-xs text-destructive">
                    {errors.selectedDays}
                  </p>
                )}
              </div>

              {values.selectedDays.length > 0 && (
                <div className="space-y-2">
                  <Label>Start time per day</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {values.selectedDays.map((day) => (
                      <div key={day} className="flex items-center gap-2">
                        <span className="w-10 text-sm text-muted-foreground">
                          {DAY_LABELS[day]}
                        </span>
                        <Input
                          type="time"
                          className="h-9"
                          value={values.slotTimes[day] ?? values.startTime}
                          onChange={(e) =>
                            setValues((prev) => ({
                              ...prev,
                              slotTimes: {
                                ...prev.slotTimes,
                                [day]: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  {errors.slotTimes && (
                    <p className="text-xs text-destructive">
                      {errors.slotTimes}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Ends</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={values.endsMode === "until"}
                    onClick={() => update("endsMode", "until")}
                    className={
                      values.endsMode === "until"
                        ? "inline-flex h-9 items-center justify-center rounded-md border border-primary bg-primary/10 px-3 text-sm font-medium text-primary"
                        : "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
                    }
                  >
                    On
                  </button>
                  <Input
                    type="date"
                    className="h-9"
                    disabled={values.endsMode !== "until"}
                    value={values.endDate}
                    onChange={(e) => update("endDate", e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={values.endsMode === "count"}
                    onClick={() => update("endsMode", "count")}
                    className={
                      values.endsMode === "count"
                        ? "inline-flex h-9 items-center justify-center rounded-md border border-primary bg-primary/10 px-3 text-sm font-medium text-primary"
                        : "inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-muted-foreground hover:bg-accent"
                    }
                  >
                    After
                  </button>
                  <Input
                    type="number"
                    min={1}
                    className="h-9"
                    disabled={values.endsMode !== "count"}
                    placeholder="12"
                    value={values.occurrenceCount ?? ""}
                    onChange={(e) =>
                      update(
                        "occurrenceCount",
                        e.target.valueAsNumber || undefined,
                      )
                    }
                  />
                  <span className="text-sm text-muted-foreground">lessons</span>
                </div>
                {errors.endDate && (
                  <p className="text-xs text-destructive">{errors.endDate}</p>
                )}
                {errors.occurrenceCount && (
                  <p className="text-xs text-destructive">
                    {errors.occurrenceCount}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Location{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={locationMode}
              onValueChange={(v) => handleLocationModeChange(v as LocationMode)}
              className="flex-wrap justify-start gap-2"
            >
              <ToggleGroupItem value="zoom" aria-label="Zoom">
                <Video className="mr-1.5 h-4 w-4" />
                Zoom
              </ToggleGroupItem>
              <ToggleGroupItem value="meet" aria-label="Google Meet">
                <Video className="mr-1.5 h-4 w-4" />
                Meet
              </ToggleGroupItem>
              <ToggleGroupItem value="inperson" aria-label="In Person">
                <MapPin className="mr-1.5 h-4 w-4" />
                In Person
              </ToggleGroupItem>
              <ToggleGroupItem value="other" aria-label="Other">
                <Globe className="mr-1.5 h-4 w-4" />
                Other
              </ToggleGroupItem>
            </ToggleGroup>
            {locationMode === "zoom" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="font-medium">
                  Zoom integration is not available yet.
                </p>
              </div>
            )}
            {locationMode === "other" && (
              <Input
                id="location"
                placeholder="e.g. Microsoft Teams, Skype…"
                value={values.location}
                onChange={(e) => update("location", e.target.value)}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <textarea
              id="notes"
              rows={3}
              placeholder="What to cover, prep notes, etc."
              value={values.notes}
              onChange={(e) => update("notes", e.target.value)}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {submitError && (
            <p className="text-xs text-destructive">
              {submitError ?? "Failed to create lesson"}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {meetAttaching
                ? "Generating link…"
                : pending
                  ? "Creating…"
                  : isRecurring
                    ? "Create series"
                    : "Create lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
