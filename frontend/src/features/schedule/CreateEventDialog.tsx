import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video, TriangleAlert, MapPin, Globe, Plus, X, Repeat, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useListStudents } from "@/features/students/api";
import { useSubjects } from "@/lib/subjects";
import { useCreateLesson, useCreateRecurringLesson } from "./api";
import { pollSeriesMeetLink } from "./api";
import { generateMeetLinkRequest, updateLessonRequest } from "./api/requests";
import {
  DAYS,
  DAY_FULL_LABELS,
  DURATION_PRESETS,
  describeRecurrence,
  describeOneOff,
  eventFormSchema,
  toCreateLessonRequest,
  toCreateRecurringLessonRequest,
  timePlusMinutes,
  type EventFormData,
} from "./event-schema";
import { isRangeOverlap } from "./lesson-utils";
import { isSlotOutsideWorkingHours } from "./working-hours-utils";
import { useAuthStore } from "@/store/auth-store";
import { queryClient } from "@examify-tms/shared";
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
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

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

function endOfYearDateStr(dateStr: string): string {
  const year = /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? Number(dateStr.slice(0, 4))
    : new Date().getFullYear();
  return `${year}-12-31`;
}

function emptyValues(): EventFormData {
  return {
    studentId: "",
    studentName: "",
    subject: "",
    date: "",
    startTime: "",
    location: "",
    notes: "",
    repeat: "none",
    slots: [],
    durationMinutes: 60,
    endsMode: "until",
    endDate: "",
    occurrenceCount: undefined,
  };
}

type LocationMode = "zoom" | "meet" | "inperson" | "other" | "";
type FieldErrors = Partial<Record<keyof EventFormData, string>>;

/**
 * Shared duration control for one-off and recurring lessons: quick-pick chips
 * plus an "Other" toggle that reveals a custom number input.
 */
function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  const [other, setOther] = useState(false);
  const isPreset = (DURATION_PRESETS as readonly number[]).includes(value);
  const showCustom = other || !isPreset;
  return (
    <>
      <ToggleGroup
        type="single"
        variant="outline"
        value={showCustom ? "other" : String(value)}
        onValueChange={(v) => {
          if (!v) return;
          if (v === "other") {
            setOther(true);
          } else {
            setOther(false);
            onChange(Number(v));
          }
        }}
        className="flex flex-wrap justify-start gap-2"
      >
        {DURATION_PRESETS.map((d) => (
          <ToggleGroupItem key={d} value={String(d)}>
            {d} min
          </ToggleGroupItem>
        ))}
        <ToggleGroupItem value="other">Other</ToggleGroupItem>
      </ToggleGroup>
      {showCustom && (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={5}
            step={5}
            className="h-9 w-24"
            value={value || ""}
            placeholder="e.g. 50"
            onChange={(e) =>
              onChange(Math.max(1, e.target.valueAsNumber || 0))
            }
          />
          <span className="text-xs text-muted-foreground">min</span>
        </div>
      )}
    </>
  );
}

export function CreateEventDialog({
  open,
  onOpenChange,
  start,
  end,
  externalEvents = [],
}: CreateEventDialogProps) {
  const navigate = useNavigate();
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();
  const user = useAuthStore((s) => s.user);
  const createLesson = useCreateLesson();
  const createRecurring = useCreateRecurringLesson();
  const [values, setValues] = useState<EventFormData>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [locationMode, setLocationMode] = useState<LocationMode>("");
  const isRecurring = values.repeat !== "none";
  const pending = createLesson.isPending || createRecurring.isPending;
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
    if (!values.date || !values.startTime || !TIME_RE.test(values.startTime)) {
      return [];
    }
    if (!values.durationMinutes || values.durationMinutes < 1) return [];
    const startMs = new Date(`${values.date}T${values.startTime}:00`).getTime();
    if (Number.isNaN(startMs)) return [];
    const endMs = startMs + values.durationMinutes * 60000;
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
    values.durationMinutes,
    externalEvents,
  ]);

  // Warn (non-blocking) if the chosen one-off slot is outside the tutor's
  // configured working hours (day off, or before/after the daily window).
  const outsideHours = useMemo(() => {
    if (isRecurring) return false;
    if (!values.date || !values.startTime || !TIME_RE.test(values.startTime)) {
      return false;
    }
    if (!values.durationMinutes || values.durationMinutes < 1) return false;
    return isSlotOutsideWorkingHours(
      values.date,
      values.startTime,
      timePlusMinutes(values.startTime, values.durationMinutes),
      user?.workingHours,
    );
  }, [
    isRecurring,
    values.date,
    values.startTime,
    values.durationMinutes,
    user?.workingHours,
  ]);

  // Plain-English restatement of what will be created, shown live so the user
  // can verify before submitting (one-off or recurring).
  const summary = useMemo(
    () => (isRecurring ? describeRecurrence(values) : describeOneOff(values)),
    [isRecurring, values],
  );

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setLocationMode("");
    const seededDuration =
      start && end
        ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
        : 60;
    setValues({
      ...emptyValues(),
      date: start ? toDateStr(start) : "",
      startTime: start ? toTimeStr(start) : "",
      durationMinutes: seededDuration,
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
    // Seed a first slot from the chosen start date + time, and default the end
    // date to the end of that year, so the user rarely has to think about
    // bounding or timing the series. Duration is already the shared source of
    // truth from the one-off side.
    setValues((prev) => {
      const base = {
        ...prev,
        repeat: next,
        endDate: prev.endDate || endOfYearDateStr(prev.date),
        durationMinutes:
          prev.durationMinutes && prev.durationMinutes > 0
            ? prev.durationMinutes
            : 60,
      };
      if (prev.slots.length > 0) return base;
      const day = weekdayOf(prev.date) ?? "monday";
      const time =
        prev.startTime && TIME_RE.test(prev.startTime) ? prev.startTime : "09:00";
      return { ...base, slots: [{ dayOfWeek: day, timeOfDay: time }] };
    });
    setErrors((prev) => ({
      ...prev,
      repeat: undefined,
      slots: undefined,
      endDate: undefined,
    }));
  }

  function handleTabChange(tab: "single" | "recurring") {
    if (tab === "single") {
      handleRepeatChange("none");
      return;
    }
    handleRepeatChange(values.repeat === "none" ? "weekly" : values.repeat);
  }

  function addSlot() {
    setValues((prev) => {
      if (prev.slots.length >= 7) return prev;
      const usedDays = new Set(prev.slots.map((s) => s.dayOfWeek));
      const nextDay = (DAYS.find((d) => !usedDays.has(d)) ?? "monday") as DayOfWeek;
      const lastTime =
        prev.slots[prev.slots.length - 1]?.timeOfDay ??
        (prev.startTime && TIME_RE.test(prev.startTime) ? prev.startTime : "09:00");
      return { ...prev, slots: [...prev.slots, { dayOfWeek: nextDay, timeOfDay: lastTime }] };
    });
  }

  function updateSlot(index: number, patch: Partial<{ dayOfWeek: DayOfWeek; timeOfDay: string }>) {
    setValues((prev) => ({
      ...prev,
      slots: prev.slots.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
    setErrors((prev) => ({ ...prev, slots: undefined }));
  }

  function removeSlot(index: number) {
    setValues((prev) => ({
      ...prev,
      slots: prev.slots.filter((_, i) => i !== index),
    }));
  }

  /**
   * Provision + attach a Google Meet link to an already-created lesson. Runs in
   * the background after the dialog closes; resolves to the link or null.
   */
  async function attachMeetLink(
    lessonId: string,
    data: EventFormData,
  ): Promise<string | null> {
    try {
      const startDateTime = new Date(
        `${data.date}T${data.startTime}:00`,
      ).toISOString();
      const { meetingLink } = await generateMeetLinkRequest({
        lessonId,
        startDateTime,
        durationMinutes: data.durationMinutes,
      });
      await updateLessonRequest(lessonId, {
        location: "Google Meet",
        meetLink: meetingLink,
      });
      return meetingLink;
    } catch {
      // best-effort — lesson was created, Meet link just didn't attach
      return null;
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
        onOpenChange(false);

        toast.success("Lesson created", {
          description: describeOneOff(result.data) || undefined,
          action: {
            label: "View lesson",
            onClick: () => navigate(`/lessons/${lesson.id}`),
          },
        });

        // Meet provisioning is slow; run it silently in the background and
        // refresh the lessons query once the link is attached.
        if (locationMode === "meet") {
          void attachMeetLink(lesson.id, result.data).then((link) => {
            if (link) queryClient.invalidateQueries({ queryKey: ["lessons"] });
          });
        }
      } else {
        const student = students.find((s) => s.id === result.data.studentId);
        const timezone = student?.timezone || browserTimezone();
        // The backend returns fast (after the Firestore write); Google Calendar
        // sync + Meet provisioning continue in the background.
        const created = await createRecurring.mutateAsync(
          toCreateRecurringLessonRequest(result.data, timezone),
        );
        onOpenChange(false);

        const plural = created.count === 1 ? "" : "s";
        toast.success("Series created", {
          description: `${created.count} lesson${plural} added.`,
          action: {
            label: "View series",
            onClick: () => navigate(`/lessons/series/${created.seriesId}`),
          },
        });

        // The Meet link is provisioned in the background; poll silently and
        // refresh the lessons query once it lands.
        if (locationMode === "meet") {
          void pollSeriesMeetLink(created.seriesId).then((link) => {
            if (link) queryClient.invalidateQueries({ queryKey: ["lessons"] });
          });
        } else {
          toast.info("Syncing to Google Calendar…", {
            id: "series-cal",
            description: "Happens in the background.",
          });
        }
      }
    } catch {
      // error surfaced below; keep dialog open
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New lesson</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Tabs
            value={isRecurring ? "recurring" : "single"}
            onValueChange={(v) => handleTabChange(v as "single" | "recurring")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">One time</TabsTrigger>
              <TabsTrigger value="recurring">Recurring series</TabsTrigger>
            </TabsList>
          </Tabs>
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

          {/* One-off lessons need a start time + duration. A recurring series
              derives its start from per-slot times, so these are hidden there. */}
          {!isRecurring && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start time</Label>
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
                <Label>Duration</Label>
                <DurationPicker
                  value={values.durationMinutes}
                  onChange={(n) => update("durationMinutes", n)}
                />
                {errors.durationMinutes && (
                  <p className="text-xs text-destructive">
                    {errors.durationMinutes}
                  </p>
                )}
              </div>
            </div>
          )}

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

          {isRecurring && (
            <div className="space-y-5 rounded-lg border bg-muted/30 p-4">
              <div className="space-y-2">
                <Label>How often?</Label>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={values.repeat}
                  onValueChange={(v) =>
                    v && handleRepeatChange(v as EventFormData["repeat"])
                  }
                  className="flex flex-wrap justify-start gap-2"
                >
                  <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
                  <ToggleGroupItem value="biweekly">
                    Every 2 weeks
                  </ToggleGroupItem>
                  <ToggleGroupItem value="monthly">
                    Every 4 weeks
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="space-y-2">
                <Label>Weekly lesson times</Label>
                <div className="space-y-2">
                  {values.slots.map((slot, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Select
                        value={slot.dayOfWeek}
                        onValueChange={(d) =>
                          updateSlot(index, { dayOfWeek: d as DayOfWeek })
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS.map((day) => (
                            <SelectItem key={day} value={day}>
                              {DAY_FULL_LABELS[day]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="time"
                        className="h-9 flex-1"
                        value={slot.timeOfDay}
                        onChange={(e) =>
                          updateSlot(index, { timeOfDay: e.target.value })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground"
                        onClick={() => removeSlot(index)}
                        disabled={values.slots.length <= 1}
                        aria-label="Remove this lesson time"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {values.slots.length < 7 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSlot}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add a lesson time
                  </Button>
                )}
                {errors.slots && (
                  <p className="text-xs text-destructive">{errors.slots}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Lesson duration</Label>
                <DurationPicker
                  value={values.durationMinutes}
                  onChange={(n) => update("durationMinutes", n)}
                />
                {errors.durationMinutes && (
                  <p className="text-xs text-destructive">
                    {errors.durationMinutes}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Ends</Label>
                <div
                  className={
                    "flex items-center gap-3 rounded-md border p-2 transition-colors " +
                    (values.endsMode === "until"
                      ? "border-primary bg-primary/5"
                      : "border-input")
                  }
                  onClick={() => update("endsMode", "until")}
                >
                  <span
                    className={
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
                      (values.endsMode === "until"
                        ? "border-primary"
                        : "border-muted-foreground/40")
                    }
                  >
                    {values.endsMode === "until" && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="text-sm font-medium">On</span>
                  <Input
                    type="date"
                    className="h-8"
                    value={values.endDate}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      update("endsMode", "until");
                      update("endDate", e.target.value);
                    }}
                  />
                </div>
                <div
                  className={
                    "flex items-center gap-3 rounded-md border p-2 transition-colors " +
                    (values.endsMode === "count"
                      ? "border-primary bg-primary/5"
                      : "border-input")
                  }
                  onClick={() => update("endsMode", "count")}
                >
                  <span
                    className={
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border " +
                      (values.endsMode === "count"
                        ? "border-primary"
                        : "border-muted-foreground/40")
                    }
                  >
                    {values.endsMode === "count" && (
                      <span className="h-2 w-2 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="text-sm font-medium">After</span>
                  <Input
                    type="number"
                    min={1}
                    className="h-8 w-20"
                    placeholder="12"
                    value={values.occurrenceCount ?? ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      update("endsMode", "count");
                      update(
                        "occurrenceCount",
                        e.target.valueAsNumber || undefined,
                      );
                    }}
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

          {summary && (
            <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              {isRecurring ? (
                <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              ) : (
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              )}
              <p className="text-foreground">{summary}</p>
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
