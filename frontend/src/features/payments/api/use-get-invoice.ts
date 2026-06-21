import { useQuery } from "@tanstack/react-query";
import { getInvoiceRequest } from "./requests";

export function useGetInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      if (!id) throw new Error("Invoice id is required");
      return getInvoiceRequest(id);
    },
    enabled: !!id,
  });
}
