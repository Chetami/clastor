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
import { cn } from "@/lib/utils";
import { useCancelLesson } from "./api";
import type { LessonResponse, CancelLessonRequest } from "@examify-tms/interfaces";

type Scope = "this" | "this_and_future";

interface CancelLessonDialogProps {
  lesson: LessonResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cancel a lesson, offering to notify the student (a cancellation email, plus
 * a calendar removal when they were previously invited). When the lesson
 * belongs to a series, offers a Google Calendar-style scope choice: just this
 * occurrence or this and all future lessons (which removes the series).
 */
export function CancelLessonDialog({
  lesson,
  open,
  onOpenChange,
}: CancelLessonDialogProps) {
  const cancelLesson = useCancelLesson(lesson.id);
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState<Scope>("this");
  const [error, setError] = useState<string | null>(null);

  const isSeries = !!lesson.seriesId;

  useEffect(() => {
    if (!open) return;
    setNotifyStudent(true);
    setMessage("");
    setScope("this");
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload: CancelLessonRequest = {
      notifyStudent,
      message: message.trim() ? message : null,
    };
    if (isSeries) payload.scope = scope;

    try {
      await cancelLesson.mutateAsync(payload);
      toast.success(
        notifyStudent
          ? scope === "this_and_future"
            ? "Series cancelled — student notified."
            : "Lesson cancelled — student notified."
          : scope === "this_and_future"
            ? "Series cancelled."
            : "Lesson cancelled.",
      );
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel lesson");
    }
  }

  const when = new Date(lesson.startDateTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {scope === "this_and_future" ? "Cancel series?" : "Cancel this lesson?"}
          </DialogTitle>
          <DialogDescription>
            {lesson.subject ? `${lesson.subject} · ` : ""}
            {when}
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
                  Remove all future lessons
                </span>
              </button>
            </div>
          )}

          <div className="space-y-3 rounded-md border p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={notifyStudent}
                onChange={(e) => setNotifyStudent(e.target.checked)}
                className="mt-0.5"
              />
              <div className="space-y-1">
                <span className="text-sm font-medium leading-none">
                  Notify student about the cancellation
                </span>
                <p className="text-xs text-muted-foreground">
                  {scope === "this_and_future"
                    ? "Sends one summary email listing the cancelled lessons."
                    : "Sends a cancellation email and removes the event from their calendar."}
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
              disabled={cancelLesson.isPending}
            >
              Keep lesson
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={cancelLesson.isPending}
            >
              {cancelLesson.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {cancelLesson.isPending
                ? "Cancelling…"
                : scope === "this_and_future"
                  ? "Cancel series"
                  : "Cancel lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
