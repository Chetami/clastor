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
import { cn } from "@/lib/utils";
import {
  useRescheduleLesson,
  previewRescheduleEmailRequest,
} from "./api";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import type { LessonResponse, RescheduleLessonRequest } from "@examify-tms/interfaces";

const pad = (n: number) => String(n).padStart(2, "0");
const toDateStr = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

type Scope = "this" | "this_and_future";

interface RescheduleDialogProps {
  lesson: LessonResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Move a single lesson to a new date/time. Optionally notifies the student
 * (which resets their RSVP to pending and sends an updated calendar invite).
 * Prefilled from the lesson's current slot whenever it opens. When the lesson
 * belongs to a series, offers a Google Calendar-style scope choice: just this
 * occurrence or this and all future lessons.
 *
 * When "notify student" is on, clicking Reschedule opens an email review step
 * (EmailComposeDialog) showing exactly what will be sent — rendered against
 * the proposed new time — so the tutor can edit the subject/message before the
 * reschedule + email go out together. The reschedule only happens on send.
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
  const [scope, setScope] = useState<Scope>("this");
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  // The computed reschedule payload, captured when the tutor clicks
  // "Reschedule" so the compose step can preview/send the same change.
  const [pendingPayload, setPendingPayload] =
    useState<{ startIso: string; durationMinutes: number } | null>(null);

  const isSeries = !!lesson.seriesId;

  // Prefill whenever the dialog opens so it reflects the current slot.
  useEffect(() => {
    if (!open) return;
    const s = new Date(lesson.startDateTime);
    const e = new Date(s.getTime() + lesson.durationMinutes * 60_000);
    setDate(toDateStr(s));
    setStartTime(toTimeStr(s));
    setEndTime(toTimeStr(e));
    setNotifyStudent(true);
    setScope("this");
    setError(null);
    setComposeOpen(false);
    setPendingPayload(null);
  }, [open, lesson.startDateTime, lesson.durationMinutes]);

  function buildPayload(): {
    startIso: string;
    durationMinutes: number;
    error?: string;
  } {
    const startMs = new Date(`${date}T${startTime}:00`).getTime();
    const endMs = new Date(`${date}T${endTime}:00`).getTime();
    if (
      !date ||
      !startTime ||
      !endTime ||
      Number.isNaN(startMs) ||
      Number.isNaN(endMs)
    ) {
      return { startIso: "", durationMinutes: 0, error: "Please choose a valid date and time." };
    }
    if (endMs <= startMs) {
      return { startIso: "", durationMinutes: 0, error: "End time must be after the start time." };
    }
    return {
      startIso: new Date(startMs).toISOString(),
      durationMinutes: Math.max(1, Math.round((endMs - startMs) / 60000)),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { startIso, durationMinutes, error: vError } = buildPayload();
    if (vError) {
      setError(vError);
      return;
    }

    // When notifying, show the email review step first (no reschedule yet).
    if (notifyStudent) {
      setPendingPayload({ startIso, durationMinutes });
      setComposeOpen(true);
      return;
    }

    await runReschedule(startIso, durationMinutes, null);
  }

  async function runReschedule(
    startIso: string,
    durationMinutes: number,
    message: string | null,
  ) {
    const payload: RescheduleLessonRequest = {
      startDateTime: startIso,
      durationMinutes,
      notifyStudent,
      message,
    };
    if (isSeries) payload.scope = scope;

    try {
      await reschedule.mutateAsync(payload);
      toast.success(
        notifyStudent
          ? scope === "this_and_future"
            ? "Series rescheduled — student notified."
            : "Lesson rescheduled — student notified."
          : scope === "this_and_future"
            ? "Series rescheduled."
            : "Lesson rescheduled.",
      );
      setComposeOpen(false);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule lesson");
      // Re-throw so the compose dialog surfaces the error instead of
      // reporting a false success.
      throw err;
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule lesson</DialogTitle>
            <DialogDescription>
              {scope === "this_and_future"
                ? "Move this lesson and update the schedule for all future lessons."
                : "Move this lesson to a new time."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {isSeries && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope("this")}
                  className={cn(
                    "rounded-md border p-3 text-left text-sm transition-colors",
                    scope === "this"
                      ? "border-primary ring-1 ring-primary bg-primary/5"
                      : "border-muted hover:bg-muted/50",
                  )}
                >
                  <span className="font-medium block">Just this lesson</span>
                  <span className="text-xs text-muted-foreground">
                    Only this occurrence
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope("this_and_future")}
                  className={cn(
                    "rounded-md border p-3 text-left text-sm transition-colors",
                    scope === "this_and_future"
                      ? "border-primary ring-1 ring-primary bg-primary/5"
                      : "border-muted hover:bg-muted/50",
                  )}
                >
                  <span className="font-medium block">This &amp; future</span>
                  <span className="text-xs text-muted-foreground">
                    Update all future lessons
                  </span>
                </button>
              </div>
            )}

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
                  onCheckedChange={(checked) => setNotifyStudent(checked === true)}
                  className="mt-0.5"
                />
                <div className="space-y-1">
                  <span className="text-sm font-medium leading-none">
                    Notify student about the new time
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {scope === "this_and_future"
                      ? "Sends one summary email with the new schedule."
                      : "Sends an updated calendar invite and resets their RSVP to pending."}
                    {notifyStudent
                      ? " You’ll review the email before it’s sent."
                      : ""}
                  </p>
                </div>
              </label>
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
                {reschedule.isPending
                  ? "Saving…"
                  : notifyStudent
                    ? "Review email"
                    : "Reschedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {pendingPayload && (
        <EmailComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          title="Review reschedule email"
          description={
            scope === "this_and_future"
              ? "A summary of the new schedule will be emailed."
              : "An updated calendar invite will be emailed."
          }
          fetchPreview={(message) =>
            previewRescheduleEmailRequest(lesson.id, {
              startDateTime: pendingPayload.startIso,
              durationMinutes: pendingPayload.durationMinutes,
              scope: isSeries ? scope : undefined,
              message,
            })
          }
          onSend={(message) =>
            runReschedule(
              pendingPayload.startIso,
              pendingPayload.durationMinutes,
              message || null,
            )
          }
        />
      )}
    </>
  );
}
