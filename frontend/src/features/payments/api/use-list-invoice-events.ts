import { useQuery } from "@tanstack/react-query";
import { listInvoiceEventsRequest } from "./requests";

export function useListInvoiceEvents(id: string | undefined) {
  return useQuery({
    queryKey: ["invoices", id, "events"],
    queryFn: async () => {
      if (!id) throw new Error("Invoice id is required");
      return listInvoiceEventsRequest(id);
    },
    enabled: !!id,
  });
}
