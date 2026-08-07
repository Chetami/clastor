import { useState } from "react";
import type { EventApi } from "@fullcalendar/core";
import { toast } from "sonner";
import { useRescheduleLesson } from "./api";

export type DropScope = "this" | "this_and_future";

interface DropPending {
  lessonId: string;
  startDateTime: string;
  durationMinutes: number;
  label: string;
  seriesId: string | null;
  revert: () => void;
}

export interface ComposeDrop {
  lessonId: string;
  startDateTime: string;
  durationMinutes: number;
  scope: DropScope;
  isSeries: boolean;
}

/**
 * Owns the drag/resize-to-reschedule flow on the schedule calendar: capturing
 * the proposed slot (+ a revert callback so the event snaps back on
 * cancel/failure), the optional scope (this vs. this & future) and notify
 * flag, and the actual reschedule mutation. When the tutor opts to notify the
 * student, the caller shows an email-review step before this runs the save.
 */
export function useDropReschedule() {
  const [dropPending, setDropPending] = useState<DropPending | null>(null);
  const [dropNotify, setDropNotify] = useState(true);
  const [dropScope, setDropScope] = useState<DropScope>("this");
  const [composeDrop, setComposeDrop] = useState<ComposeDrop | null>(null);
  const reschedule = useRescheduleLesson(dropPending?.lessonId ?? "");

  function openDropConfirm(event: EventApi, revert: () => void) {
    const start = event.start;
    const end = event.end;
    if (!start || !end) {
      revert();
      return;
    }
    const durationMinutes = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 60000),
    );
    const studentName = event.extendedProps.studentName as string | undefined;
    const seriesId = (event.extendedProps.seriesId as string | null) ?? null;
    setDropNotify(true);
    setDropScope("this");
    setDropPending({
      lessonId: event.id,
      startDateTime: start.toISOString(),
      durationMinutes,
      seriesId,
      label: `${start.toLocaleString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })} · ${durationMinutes} min${
        studentName ? ` · ${studentName}` : ""
      }`,
      revert,
    });
  }

  function cancelDrop() {
    dropPending?.revert();
    setDropPending(null);
  }

  async function confirmDrop() {
    if (!dropPending) return;
    // When notifying, hand control to the email-review step first (no save yet).
    if (dropNotify) {
      setComposeDrop({
        lessonId: dropPending.lessonId,
        startDateTime: dropPending.startDateTime,
        durationMinutes: dropPending.durationMinutes,
        scope: dropScope,
        isSeries: !!dropPending.seriesId,
      });
      return;
    }
    await runDropReschedule(null);
  }

  async function runDropReschedule(message: string | null) {
    if (!dropPending) return;
    try {
      await reschedule.mutateAsync({
        startDateTime: dropPending.startDateTime,
        durationMinutes: dropPending.durationMinutes,
        notifyStudent: dropNotify,
        message,
        ...(dropPending.seriesId ? { scope: dropScope } : {}),
      });
      toast.success(
        dropNotify
          ? dropScope === "this_and_future"
            ? "Series rescheduled — student notified."
            : "Lesson rescheduled — student notified."
          : dropScope === "this_and_future"
            ? "Series rescheduled."
            : "Lesson rescheduled.",
      );
      setDropPending(null);
      setComposeDrop(null);
    } catch (err) {
      dropPending.revert();
      toast.error(
        err instanceof Error ? err.message : "Failed to reschedule lesson",
      );
      setDropPending(null);
      setComposeDrop(null);
      throw err;
    }
  }

  function clearComposeDrop() {
    setComposeDrop(null);
  }

  return {
    dropPending,
    dropNotify,
    setDropNotify,
    dropScope,
    setDropScope,
    composeDrop,
    reschedulePending: reschedule.isPending,
    openDropConfirm,
    cancelDrop,
    confirmDrop,
    runDropReschedule,
    clearComposeDrop,
  };
}
