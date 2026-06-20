import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { useListStudents } from "@/features/students/api";
import { useCreateLesson, useCreateRecurringLesson } from "./api";
import {
  DAYS,
  DAY_LABELS,
  eventFormSchema,
  toCreateLessonRequest,
  toCreateRecurringLessonRequest,
  type EventFormData,
} from "./event-schema";
import type { DayOfWeek } from "@examify-tms/interfaces";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  start: Date | null;
  end: Date | null;
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

type FieldErrors = Partial<Record<keyof EventFormData, string>>;

export function CreateEventDialog({
  open,
  onOpenChange,
  start,
  end,
}: CreateEventDialogProps) {
  const { data: students = [] } = useListStudents();
  const createLesson = useCreateLesson();
  const createRecurring = useCreateRecurringLesson();
  const [values, setValues] = useState<EventFormData>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});

  const isRecurring = values.repeat !== "none";
  const pending = createLesson.isPending || createRecurring.isPending;
  const submitError = createLesson.error?.message ?? createRecurring.error?.message;

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setValues({
      ...emptyValues(),
      date: start ? toDateStr(start) : "",
      startTime: start ? toTimeStr(start) : "",
      endTime: end ? toTimeStr(end) : "",
    });
  }, [open, start, end]);

  function update<K extends keyof EventFormData>(key: K, value: EventFormData[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleStudentChange(id: string) {
    const student = students.find((s) => s.id === id);
    if (!student) {
      update("studentId", id);
      return;
    }
    setValues((prev) => ({
      ...prev,
      studentId: student.id,
      studentName: student.name,
      subject: prev.subject || student.subject,
    }));
    setErrors((prev) => ({ ...prev, studentId: undefined }));
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
    setErrors((prev) => ({ ...prev, repeat: undefined, selectedDays: undefined }));
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
    setErrors((prev) => ({ ...prev, selectedDays: undefined, slotTimes: undefined }));
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
        await createLesson.mutateAsync(toCreateLessonRequest(result.data));
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

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
            <select
              id="student"
              value={values.studentId}
              onChange={(e) => handleStudentChange(e.target.value)}
              className={selectClass}
              aria-invalid={!!errors.studentId}
              disabled={students.length === 0}
            >
              <option value="" disabled>
                {students.length === 0
                  ? "Add a student first"
                  : "Select a student"}
              </option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.studentId && (
              <p className="text-xs text-destructive">{errors.studentId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              placeholder="Mathematics"
              aria-invalid={!!errors.subject}
              value={values.subject}
              onChange={(e) => update("subject", e.target.value)}
            />
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

          <div className="space-y-2">
            <Label htmlFor="repeat">Repeat</Label>
            <select
              id="repeat"
              value={values.repeat}
              onChange={(e) =>
                handleRepeatChange(e.target.value as EventFormData["repeat"])
              }
              className={selectClass}
            >
              <option value="none">Does not repeat</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every 2 weeks</option>
            </select>
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
                  <p className="text-xs text-destructive">{errors.selectedDays}</p>
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
                              slotTimes: { ...prev.slotTimes, [day]: e.target.value },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  {errors.slotTimes && (
                    <p className="text-xs text-destructive">{errors.slotTimes}</p>
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
            <Label htmlFor="location">
              Location{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="location"
              placeholder="Online — Zoom"
              value={values.location}
              onChange={(e) => update("location", e.target.value)}
            />
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
              {pending
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
