import { useQuery } from "@tanstack/react-query";
import { listInvoicesRequest, type ListInvoicesParams } from "./requests";
import type { InvoiceResponse } from "@examify-tms/interfaces";

export function useListInvoices(params?: ListInvoicesParams) {
  return useQuery<InvoiceResponse[]>({
    queryKey: ["invoices", params],
    queryFn: async () => {
      const response = await listInvoicesRequest(params);
      return response.data;
    },
  });
}
