import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useRescheduleLesson } from "./api";
import type { LessonResponse } from "@examify-tms/interfaces";

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

interface RescheduleDialogProps {
  lesson: LessonResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Move a single lesson to a new date/time. Optionally notifies the student
 * (which resets their RSVP to pending and sends an updated calendar invite).
 * Prefilled from the lesson's current slot whenever it opens.
 */
export function RescheduleDialog({
  lesson,
  open,
  onOpenChange,
}: RescheduleDialogProps) {
  const reschedule = useRescheduleLesson(lesson.id);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Prefill whenever the dialog opens so it reflects the current slot.
  useEffect(() => {
    if (!open) return;
    const s = new Date(lesson.startDateTime);
    const e = new Date(s.getTime() + lesson.durationMinutes * 60_000);
    setDate(toDateStr(s));
    setStartTime(toTimeStr(s));
    setEndTime(toTimeStr(e));
    setNotifyStudent(true);
    setMessage("");
    setError(null);
  }, [open, lesson.startDateTime, lesson.durationMinutes]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startMs = new Date(`${date}T${startTime}:00`).getTime();
    const endMs = new Date(`${date}T${endTime}:00`).getTime();
    if (
      !date ||
      !startTime ||
      !endTime ||
      Number.isNaN(startMs) ||
      Number.isNaN(endMs)
    ) {
      setError("Please choose a valid date and time.");
      return;
    }
    if (endMs <= startMs) {
      setError("End time must be after the start time.");
      return;
    }
    const durationMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));

    try {
      await reschedule.mutateAsync({
        startDateTime: new Date(startMs).toISOString(),
        durationMinutes,
        notifyStudent,
        message: message.trim() ? message : null,
      });
      toast.success(
        notifyStudent
          ? "Lesson rescheduled — student notified."
          : "Lesson rescheduled.",
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule lesson");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule lesson</DialogTitle>
          <DialogDescription>
            Move this lesson to a new time.
            {lesson.seriesId
              ? " This changes only this occurrence."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="rs-date">Date</Label>
            <Input
              id="rs-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rs-start">Start</Label>
              <Input
                id="rs-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rs-end">End</Label>
              <Input
                id="rs-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={notifyStudent}
                onChange={(e) => setNotifyStudent(e.target.checked)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-medium leading-none">
                  Notify student about the new time
                </span>
                <p className="text-xs text-muted-foreground">
                  Sends an updated calendar invite and resets their RSVP to
                  pending.
                </p>
              </div>
            </label>
            {notifyStudent && (
              <Input
                placeholder="Optional message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="h-9"
              />
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={reschedule.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={reschedule.isPending}>
              {reschedule.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {reschedule.isPending ? "Saving…" : "Reschedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
