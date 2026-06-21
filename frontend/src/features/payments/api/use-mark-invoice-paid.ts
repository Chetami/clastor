import { useMutation } from "@tanstack/react-query";
import { markInvoicePaidRequest } from "./requests";
import type { MarkPaidRequest, InvoiceResponse } from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useMarkInvoicePaid() {
  return useMutation<
    InvoiceResponse,
    Error,
    { id: string; data?: MarkPaidRequest }
  >({
    mutationFn: ({ id, data }) => markInvoicePaidRequest(id, data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-invoices", response.studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-debt", response.studentId] });
    },
  });
}
