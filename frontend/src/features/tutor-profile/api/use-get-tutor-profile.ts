import { useQuery } from "@tanstack/react-query";
import { getMyProfileRequest } from "./requests";

export function useGetTutorProfile(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["tutor-profile", "me"],
    queryFn: () => getMyProfileRequest(),
    enabled: options?.enabled ?? true,
  });
}
