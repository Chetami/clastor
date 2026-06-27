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
import { useCancelLesson } from "./api";
import type { LessonResponse } from "@examify-tms/interfaces";

interface CancelLessonDialogProps {
  lesson: LessonResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Cancel a lesson, offering to notify the student (a cancellation email, plus
 * a calendar removal when they were previously invited). Intended for lessons
 * the student had already accepted.
 */
export function CancelLessonDialog({
  lesson,
  open,
  onOpenChange,
}: CancelLessonDialogProps) {
  const cancelLesson = useCancelLesson(lesson.id);
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNotifyStudent(true);
    setMessage("");
    setError(null);
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await cancelLesson.mutateAsync({
        notifyStudent,
        message: message.trim() ? message : null,
      });
      toast.success(
        notifyStudent
          ? "Lesson cancelled — student notified."
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
          <DialogTitle>Cancel this lesson?</DialogTitle>
          <DialogDescription>
            {lesson.subject ? `${lesson.subject} · ` : ""}
            {when}
            {lesson.seriesId
              ? " · This cancels only this occurrence."
              : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                  Sends a cancellation email and removes the event from their
                  calendar.
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
              {cancelLesson.isPending ? "Cancelling…" : "Cancel lesson"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
