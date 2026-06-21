import { useMutation } from "@tanstack/react-query";
import { voidInvoiceRequest } from "./requests";
import type { InvoiceResponse } from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useVoidInvoice() {
  return useMutation<InvoiceResponse, Error, string>({
    mutationFn: (id) => voidInvoiceRequest(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["student-invoices", response.studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-debt", response.studentId] });
    },
  });
}
