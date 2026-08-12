import { useState } from "react";
import { toast } from "sonner";
import type {
  AttendanceStatus,
  LessonResponse,
  UpdateLessonRequest,
} from "@examify-tms/interfaces";
import {
  useMarkLessonDone,
  useUpdateLessonDetails,
} from "@/features/dashboard/api";
import {
  useInvoiceLesson,
  type InvoiceLessonEdits,
} from "@/features/payments/api";
import { useStudentLookups } from "@/lib/use-student-lookups";
import { ATTENDANCE_LABELS } from "@/features/schedule/lesson-utils";

export interface AttendanceConfirmResult {
  /** The invoice id created when `shouldInvoice` was true (else undefined). */
  invoiceId?: string;
}

/**
 * The single canonical "mark attendance → apply edits → optionally create an
 * invoice to review+send" flow. Previously copy-pasted (near-verbatim) across
 * LessonRow and EventPopover.
 *
 * On a successful invoice it sets `sendInvoiceId` so the caller can render a
 * {@link SendInvoiceDialog}. Toasts mirror the original per-surface copy.
 */
export function useMarkAttendanceAndInvoice() {
  const { names, byId, subjectOptions } = useStudentLookups();
  const markDone = useMarkLessonDone();
  const updateLessonDetails = useUpdateLessonDetails();
  const invoiceLesson = useInvoiceLesson();
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);

  const attendancePending =
    markDone.isPending ||
    updateLessonDetails.isPending ||
    invoiceLesson.isPending;

  async function confirm(
    lesson: LessonResponse,
    attendanceStatus: AttendanceStatus,
    shouldInvoice: boolean,
    edits?: InvoiceLessonEdits,
  ): Promise<AttendanceConfirmResult> {
    const name = names[lesson.studentId] ?? "Unknown student";
    try {
      await markDone.mutateAsync({ id: lesson.id, attendanceStatus });

      // Apply any lesson tweaks first — happens whether or not an invoice is
      // sent, since the lesson should reflect what was done.
      let effective = lesson;
      const hasEdits =
        edits &&
        (edits.subject !== undefined || edits.durationMinutes !== undefined);
      if (hasEdits) {
        const data: UpdateLessonRequest = {};
        if (edits!.subject !== undefined) data.subject = edits!.subject;
        if (edits!.durationMinutes !== undefined) {
          data.durationMinutes = edits!.durationMinutes;
        }
        effective = await updateLessonDetails.mutateAsync({
          id: lesson.id,
          data,
        });
      }

      if (shouldInvoice) {
        const student = byId[lesson.studentId];
        if (student) {
          // Create the invoice but DON'T email yet — the caller shows a compose
          // dialog (via sendInvoiceId) so the email is reviewed first.
          const created = await invoiceLesson.mutateAsync({
            lesson: effective,
            rateType: student.rateType,
            expectedAmount: student.expectedAmount,
            skipSend: true,
          });
          toast.success(`Invoice created for ${name} — review before sending.`);
          setSendInvoiceId(created.id);
          return { invoiceId: created.id };
        }
      }

      toast.success(
        `Marked ${name}'s lesson as ${ATTENDANCE_LABELS[attendanceStatus]}`,
      );
      return {};
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark lesson");
      throw err;
    }
  }

  return {
    names,
    byId,
    subjectOptions,
    confirm,
    attendancePending,
    sendInvoiceId,
    setSendInvoiceId,
  };
}
