import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Loader2,
  NotebookPen,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { LessonResponse } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateLesson } from "@/features/schedule/api";
import { CancelLessonDialog } from "@/features/schedule/CancelLessonDialog";
import { RescheduleDialog } from "@/features/schedule/RescheduleDialog";
import {
  formatLessonTime,
  lessonBadge,
} from "@/features/lessons/lesson-display";
import { lessonIssues } from "./lesson-series-utils";

export interface LessonRowProps {
  lesson: LessonResponse;
}

/** A single lesson row in the series list. */
export function LessonRow({ lesson }: LessonRowProps) {
  const start = new Date(lesson.startDateTime);
  const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);
  const { label, tone } = lessonBadge(lesson);
  const issues = lessonIssues(lesson);

  const dayOfMonth = start.getDate();
  const weekdayShort = start
    .toLocaleDateString("en-AU", { weekday: "short" })
    .toUpperCase();

  const [notesOpen, setNotesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(lesson.notes ?? "");
  const updateLesson = useUpdateLesson(lesson.id);

  useEffect(() => {
    if (notesOpen) setNotesDraft(lesson.notes ?? "");
  }, [notesOpen, lesson.notes]);

  async function handleSaveNotes() {
    try {
      await updateLesson.mutateAsync({ notes: notesDraft });
      toast.success("Notes saved");
      setNotesOpen(false);
    } catch {
      toast.error("Couldn't save notes");
    }
  }

  const cancelled = !!lesson.isCancelled;

  return (
    <div
      className={`group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/40 sm:gap-4 ${
        cancelled ? "opacity-55" : ""
      }`}
    >
      <Link
        to={`/lessons/${lesson.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4"
      >
        {/* Date indicator */}
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-muted/30">
          <span className="text-base font-bold leading-none text-foreground">
            {dayOfMonth}
          </span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {weekdayShort}
          </span>
        </div>

        {/* Event details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-foreground">
              {lesson.subject ?? "Lesson"}
            </span>
            {issues.length > 0 ? (
              <span className="inline-flex items-center rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                {issues.length} {issues.length === 1 ? "issue" : "issues"}
              </span>
            ) : (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}
              >
                {label}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {formatLessonTime(start)} – {formatLessonTime(end)}
            </span>
          </div>
        </div>
      </Link>

      {/* Action controls */}
      <div className="flex shrink-0 items-center gap-0.5">
        <Popover open={notesOpen} onOpenChange={setNotesOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              title="Notes"
            >
              <NotebookPen className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={5}
                placeholder="What to cover, prep notes, etc."
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                autoFocus
              />
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNotesOpen(false)}
                  disabled={updateLesson.isPending}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={updateLesson.isPending}
                >
                  {updateLesson.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          title="Reschedule"
          onClick={() => setEditOpen(true)}
          disabled={cancelled}
        >
          <Pencil className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title={cancelled ? "Already cancelled" : "Cancel lesson"}
          onClick={() => setCancelOpen(true)}
          disabled={cancelled}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <RescheduleDialog
        lesson={lesson}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <CancelLessonDialog
        lesson={lesson}
        open={cancelOpen}
        onOpenChange={setCancelOpen}
      />
    </div>
  );
}
