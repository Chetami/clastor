import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@examify-tms/shared";
import type {
  CreateInvoiceRequest,
  InvoiceResponse,
  LessonResponse,
  RateType,
} from "@examify-tms/interfaces";
import { createInvoiceRequest, sendInvoiceRequest } from "./requests";
import { buildLessonLineItem } from "../invoice-utils";

export interface InvoiceLessonInput {
  lesson: LessonResponse;
  rateType: RateType;
  expectedAmount: number;
}

/** Optional lesson fields a caller may tweak before/while invoicing. */
export interface InvoiceLessonEdits {
  subject?: string | null;
  durationMinutes?: number;
}

const DEFAULT_DUE_DAYS = 14;

/**
 * The single canonical "invoice one lesson" flow. Every invoicing entry point
 * goes through here so the description, amounts, and create+send behaviour
 * can never drift from the Create Invoice page.
 *
 * Builds the line item from the given lesson + student rate, creates the
 * invoice as finalised ("open") and emails it. Callers that need to tweak
 * the lesson first should patch it (e.g. via useUpdateLessonDetails) and pass
 * the updated lesson here.
 */
export function useInvoiceLesson() {
  return useMutation<InvoiceResponse, Error, InvoiceLessonInput>({
    mutationFn: async ({ lesson, rateType, expectedAmount }) => {
      const lineItem = buildLessonLineItem(lesson, rateType, expectedAmount);

      const payload: CreateInvoiceRequest = {
        studentId: lesson.studentId,
        lineItems: [lineItem],
        dueDate: new Date(
          Date.now() + DEFAULT_DUE_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString(),
        paymentMethod: "bank_transfer",
        status: "open",
      };

      const created = await createInvoiceRequest(payload);
      await sendInvoiceRequest(created.id);
      return created;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", response.id] });
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
