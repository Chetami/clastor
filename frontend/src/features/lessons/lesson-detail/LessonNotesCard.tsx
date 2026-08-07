import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import type { LessonResponse, UpdateLessonRequest } from "@examify-tms/interfaces";
import { useLessonNotes } from "./use-lesson-notes";
import { NotesStatus } from "./ui";

type UpdateLessonMutation = UseMutationResult<
  LessonResponse,
  Error,
  UpdateLessonRequest
>;

interface LessonNotesCardProps {
  eventId: string | undefined;
  lesson: LessonResponse;
  updateLesson: UpdateLessonMutation;
}

/**
 * Lesson notes with auto-save-on-blur (⌘/Ctrl+Enter to save, Esc to revert).
 * Self-contained: owns its draft state via {@link useLessonNotes}.
 */
export function LessonNotesCard({
  eventId,
  lesson,
  updateLesson,
}: LessonNotesCardProps) {
  const {
    notesDraft,
    setNotesDraft,
    notesDirty,
    notesSaving,
    handleNotesBlur,
    handleNotesKeyDown,
  } = useLessonNotes(eventId, lesson, updateLesson);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Notes
          </span>
          <NotesStatus dirty={notesDirty} saving={notesSaving} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Textarea
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={handleNotesBlur}
          onKeyDown={handleNotesKeyDown}
          rows={6}
          placeholder="Prep notes, topics to cover, follow-ups…"
          className="resize-none"
        />
        {!notesDraft && (
          <p className="mt-2 text-xs text-muted-foreground">
            Saved automatically as you type.{" "}
            <span className="hidden sm:inline">
              Press <kbd className="rounded border px-1">⌘</kbd>+
              <kbd className="rounded border px-1">Enter</kbd> to save,{" "}
              <kbd className="rounded border px-1">Esc</kbd> to revert.
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
