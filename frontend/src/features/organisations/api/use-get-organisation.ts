import { useQuery } from "@tanstack/react-query";
import { getOrganisationRequest } from "./requests";
import type { Organisation } from "@examify-tms/interfaces";

/** A single organisation the user is a member of (joinCode only if admin). */
export function useGetOrganisation(orgId: string | undefined) {
  return useQuery<Organisation>({
    queryKey: ["organisations", orgId],
    queryFn: () => getOrganisationRequest(orgId!),
    enabled: !!orgId,
  });
}
