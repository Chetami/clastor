import { useQuery } from "@tanstack/react-query";
import { listMembersRequest } from "./requests";
import type { OrganisationMember } from "@examify-tms/interfaces";

export function useListMembers(orgId: string | undefined) {
  return useQuery<OrganisationMember[]>({
    queryKey: ["organisations", orgId, "members"],
    queryFn: () => listMembersRequest(orgId!),
    enabled: !!orgId,
  });
}
