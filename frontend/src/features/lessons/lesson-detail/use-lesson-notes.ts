import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { UseMutationResult } from "@tanstack/react-query";
import type { LessonResponse, UpdateLessonRequest } from "@examify-tms/interfaces";

type UpdateLessonMutation = UseMutationResult<
  LessonResponse,
  Error,
  UpdateLessonRequest
>;

/**
 * Owns the lesson notes draft + auto-save-on-blur behaviour.
 *
 * Keeps a ref mirror of the draft so the blur handler always saves the freshest
 * value (avoids stale-closure saves), and re-syncs from the server whenever the
 * active lesson changes (same route, different param — component stays mounted
 * between lessons, so we must reset the draft by id).
 */
export function useLessonNotes(
  eventId: string | undefined,
  lesson: LessonResponse | undefined,
  updateLesson: UpdateLessonMutation,
) {
  const [notesDraft, setNotesDraft] = useState("");
  const notesRef = useRef("");
  const lastSyncedId = useRef<string | null>(null);

  const serverNotes = lesson?.notes ?? "";

  useEffect(() => {
    if (!lesson) return;
    if (lastSyncedId.current === lesson.id) return;
    lastSyncedId.current = lesson.id;
    setNotesDraft(lesson.notes ?? "");
  }, [lesson]);

  useEffect(() => {
    notesRef.current = notesDraft;
  }, [notesDraft]);

  const saveNotes = useCallback(
    async (notes: string) => {
      if (!eventId) return;
      if (notes === serverNotes) return;
      try {
        await updateLesson.mutateAsync({ notes: notes || null });
      } catch {
        toast.error("Failed to save notes");
      }
    },
    [eventId, serverNotes, updateLesson],
  );

  const notesDirty = notesDraft !== serverNotes;
  const notesSaving = notesDirty && updateLesson.isPending;

  function handleNotesBlur() {
    if (notesDirty && !updateLesson.isPending) saveNotes(notesRef.current);
  }

  function handleNotesKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLTextAreaElement).blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setNotesDraft(serverNotes);
      (e.target as HTMLTextAreaElement).blur();
    }
  }

  return {
    notesDraft,
    setNotesDraft,
    notesDirty,
    notesSaving,
    handleNotesBlur,
    handleNotesKeyDown,
  };
}
