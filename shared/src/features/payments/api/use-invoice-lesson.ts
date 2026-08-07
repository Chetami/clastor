import { useMutation } from "@tanstack/react-query";
import { queryClient } from "../../../lib/query-client";
import type {
  CreateInvoiceRequest,
  InvoiceResponse,
  LessonResponse,
  RateType,
} from "@examify-tms/interfaces";
import { createInvoiceRequest, sendInvoiceRequest } from "./requests";
import { buildLessonLineItem } from "../invoice-utils";
import { defaultInvoiceDueDate } from "../invoice-config";

export interface InvoiceLessonInput {
  lesson: LessonResponse;
  rateType: RateType;
  expectedAmount: number;
  /**
   * When true, the invoice is created but NOT emailed — the caller takes
   * responsibility for showing a compose/preview dialog and sending (via
   * useSendInvoice) so the tutor can review the email first. Defaults to
   * false (create + send immediately), preserving the legacy/mobile flow.
   */
  skipSend?: boolean;
}

/** Optional lesson fields a caller may tweak before/while invoicing. */
export interface InvoiceLessonEdits {
  subject?: string | null;
  durationMinutes?: number;
}

/**
 * The single canonical "invoice one lesson" flow. Every invoicing entry point
 * (web + mobile) goes through here so the description, amounts, due date, and
 * create+send behaviour can never drift from the Create Invoice page.
 *
 * Builds the line item from the given lesson + student rate, creates the
 * invoice as finalised ("open") and (unless `skipSend`) emails it. Callers
 * that need to tweak the lesson first should patch it (e.g. via
 * useUpdateLessonDetails) and pass the updated lesson here.
 */
export function useInvoiceLesson() {
  return useMutation<InvoiceResponse, Error, InvoiceLessonInput>({
    mutationFn: async ({ lesson, rateType, expectedAmount, skipSend }) => {
      const lineItem = buildLessonLineItem(lesson, rateType, expectedAmount);

      const payload: CreateInvoiceRequest = {
        studentId: lesson.studentId,
        lineItems: [lineItem],
        dueDate: defaultInvoiceDueDate(),
        paymentMethod: "bank_transfer",
        status: "open",
      };

      const created = await createInvoiceRequest(payload);
      if (!skipSend) {
        await sendInvoiceRequest(created.id);
      }
      return created;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoices", response.id] });
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({
        queryKey: ["student-invoices", response.studentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["student-debt", response.studentId],
      });
      queryClient.invalidateQueries({ queryKey: ["sent-emails"] });
    },
  });
}
