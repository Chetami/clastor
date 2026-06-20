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
import { eventFormSchema, type EventFormData } from "./event-schema";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  start: Date | null;
  end: Date | null;
  onCreated: (values: EventFormData) => void;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

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
  };
}

type FieldErrors = Partial<Record<keyof EventFormData, string>>;

export function CreateEventDialog({
  open,
  onOpenChange,
  start,
  end,
  onCreated,
}: CreateEventDialogProps) {
  const { data: students = [] } = useListStudents();
  const [values, setValues] = useState<EventFormData>(emptyValues);
  const [errors, setErrors] = useState<FieldErrors>({});

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

  function handleSubmit(e: React.FormEvent) {
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
    onCreated(result.data);
    onOpenChange(false);
  }

  const selectClass =
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lesson</DialogTitle>
          <DialogDescription>
            Add a one-off lesson to your schedule.
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start</Label>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create lesson</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
