import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Repeat } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { track } from "@/lib/analytics";
import { useCreateLesson, useCreateRecurringLesson } from "./api";
import { pollSeriesMeetLink } from "./api";
import { generateMeetLinkRequest, updateLessonRequest } from "./api/requests";
import {
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
import {
  TIME_RE,
  browserTimezone,
  emptyValues,
  endOfYearDateStr,
  toDateStr,
  toTimeStr,
  weekdayOf,
} from "./create-event/form-helpers";
import { DurationPicker } from "./create-event/DurationPicker";
import { RecurringSlotsEditor } from "./create-event/RecurringSlotsEditor";
import { EventWarnings } from "./create-event/EventWarnings";
import { LocationPicker, type LocationMode } from "./create-event/LocationPicker";

const DAYS_ARR: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// Radix Select treats value="" as the placeholder sentinel, so use a stable
// non-empty sentinel to represent "no subject".
const NO_SUBJECT = "__none__";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  start: Date | null;
  end: Date | null;
  externalEvents?: ExternalCalendarEvent[];
}

type FieldErrors = Partial<Record<keyof EventFormData, string>>;

/**
 * "New lesson" dialog supporting both one-off and recurring-series creation.
 * The form state + handlers (the controller) live here; the recurring config,
 * duration picker, warnings, and location selector are extracted into
 * `./create-event/` sub-components.
 */
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

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === values.studentId),
    [students, values.studentId],
  );

  const studentSubjects = useMemo(() => {
    if (!selectedStudent) return [];
    return subjects.filter((s) => selectedStudent.subjectIds?.includes(s.id));
  }, [selectedStudent, subjects]);

  // Warn (non-blocking) if the one-off slot overlaps an external Google event.
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

  // Warn (non-blocking) if the one-off slot is outside working hours.
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
    setLocationMode(mode);
    const label =
      mode === "zoom"
        ? "Zoom"
        : mode === "inperson"
          ? "In Person"
          : mode === "meet"
            ? "Google Meet"
            : "";
    update("location", label);
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
    // bounding or timing the series.
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
      const nextDay = (DAYS_ARR.find((d) => !usedDays.has(d)) ??
        "monday") as DayOfWeek;
      const lastTime =
        prev.slots[prev.slots.length - 1]?.timeOfDay ??
        (prev.startTime && TIME_RE.test(prev.startTime) ? prev.startTime : "09:00");
      return {
        ...prev,
        slots: [...prev.slots, { dayOfWeek: nextDay, timeOfDay: lastTime }],
      };
    });
  }

  function updateSlot(
    index: number,
    patch: Partial<{ dayOfWeek: DayOfWeek; timeOfDay: string }>,
  ) {
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

  /** Provision + attach a Google Meet link to an already-created lesson. */
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
        track("lesson_created", {
          recurring: false,
          location_mode: locationMode,
        });
        onOpenChange(false);

        toast.success("Lesson created", {
          description: describeOneOff(result.data) || undefined,
          action: {
            label: "View lesson",
            onClick: () => navigate(`/lessons/${lesson.id}`),
          },
        });

        if (locationMode === "meet") {
          void attachMeetLink(lesson.id, result.data).then((link) => {
            if (link) {
              queryClient.invalidateQueries({ queryKey: ["lessons"] });
            } else {
              toast.warning("Couldn't generate the Google Meet link", {
                description:
                  "The lesson was created — generate the link from the lesson page.",
              });
            }
          });
        }
      } else {
        const student = students.find((s) => s.id === result.data.studentId);
        const timezone = student?.timezone || browserTimezone();
        const created = await createRecurring.mutateAsync(
          toCreateRecurringLessonRequest(result.data, timezone),
        );
        track("lesson_created", {
          recurring: true,
          count: created.count,
          location_mode: locationMode,
        });
        onOpenChange(false);

        const plural = created.count === 1 ? "" : "s";
        toast.success("Series created", {
          description: `${created.count} lesson${plural} added.`,
          action: {
            label: "View series",
            onClick: () => navigate(`/lessons/series/${created.seriesId}`),
          },
        });

        if (locationMode === "meet") {
          void pollSeriesMeetLink(created.seriesId).then((link) => {
            if (link) {
              queryClient.invalidateQueries({ queryKey: ["lessons"] });
            } else {
              toast.warning("Couldn't generate the Google Meet links", {
                description:
                  "The series was created — generate links from the series page.",
              });
            }
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
          <div className="grid gap-4 sm:grid-cols-2">
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
                value={values.subject || NO_SUBJECT}
                onValueChange={(v) => update("subject", v === NO_SUBJECT ? "" : v)}
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
                  <SelectItem value={NO_SUBJECT}>No subject</SelectItem>
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
          </div>

          {/* One-off: date + start time share a row, duration sits below. */}
          {!isRecurring && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
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
                    <p className="text-xs text-destructive">
                      {errors.startTime}
                    </p>
                  )}
                </div>
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
            </>
          )}

          {/* A recurring series starts on a date; per-slot times live below. */}
          {isRecurring && (
            <div className="space-y-2">
              <Label htmlFor="date">Start date</Label>
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
          )}

          <EventWarnings overlaps={overlaps} outsideHours={outsideHours} />

          {isRecurring && (
            <RecurringSlotsEditor
              values={values}
              errors={errors}
              onRepeatChange={handleRepeatChange}
              onUpdate={update}
              onAddSlot={addSlot}
              onUpdateSlot={updateSlot}
              onRemoveSlot={removeSlot}
            />
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

          <LocationPicker
            locationMode={locationMode}
            locationValue={values.location ?? ""}
            onModeChange={handleLocationModeChange}
            onLocationChange={(v) => update("location", v)}
          />

          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="What to cover, prep notes, etc."
              value={values.notes}
              onChange={(e) => update("notes", e.target.value)}
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
