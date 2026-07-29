import { useMutation } from "@tanstack/react-query";
import { sendInvoiceRequest } from "./requests";
import type { InvoiceResponse } from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

export function useSendInvoice() {
  return useMutation<InvoiceResponse, Error, { id: string }>({
    mutationFn: ({ id }) => sendInvoiceRequest(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice", response.id] });
      queryClient.invalidateQueries({
        queryKey: ["student-invoices", response.studentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["student-debt", response.studentId],
      });
      // Refresh the sent-email history panels scoped to this invoice/student.
      queryClient.invalidateQueries({ queryKey: ["sent-emails"] });
    },
  });
}
