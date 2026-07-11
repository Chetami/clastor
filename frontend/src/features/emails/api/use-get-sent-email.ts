import { useQuery } from "@tanstack/react-query";
import { getSentEmailRequest } from "./requests";

export function useGetSentEmail(id: string | undefined) {
  return useQuery({
    queryKey: ["sent-email", id],
    queryFn: async () => {
      if (!id) throw new Error("Sent email id is required");
      return getSentEmailRequest(id);
    },
    enabled: !!id,
  });
}
