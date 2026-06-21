import { useMutation } from "@tanstack/react-query";
import { updateInvoiceRequest } from "./requests";
import type {
  UpdateInvoiceRequest,
  InvoiceResponse,
} from "@examify-tms/interfaces";
import { queryClient } from "@/lib/query-client";

export function useUpdateInvoice() {
  return useMutation<
    InvoiceResponse,
    Error,
    { id: string; data: UpdateInvoiceRequest }
  >({
    mutationFn: ({ id, data }) => updateInvoiceRequest(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}