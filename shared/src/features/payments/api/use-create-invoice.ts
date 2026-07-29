import { useMutation } from "@tanstack/react-query";
import { createInvoiceRequest } from "./requests";
import type {
  CreateInvoiceRequest,
  InvoiceResponse,
} from "@examify-tms/interfaces";
import { queryClient } from "../../../lib/query-client";

export function useCreateInvoice() {
  return useMutation<InvoiceResponse, Error, CreateInvoiceRequest>({
    mutationFn: (data) => createInvoiceRequest(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["lessons"] });
      queryClient.invalidateQueries({ queryKey: ["student-invoices", response.studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-debt", response.studentId] });
    },
  });
}
