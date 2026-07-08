import { useQuery } from "@tanstack/react-query";
import { listOrganisationsRequest } from "./requests";
import type { Organisation } from "@examify-tms/interfaces";

/** Organisations the current user belongs to (drives the org switcher). */
export function useListOrganisations() {
  return useQuery<Organisation[]>({
    queryKey: ["organisations"],
    queryFn: listOrganisationsRequest,
  });
}
