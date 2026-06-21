import { useQuery } from "@tanstack/react-query";
import { getMyProfileRequest } from "./requests";

export function useGetTutorProfile() {
  return useQuery({
    queryKey: ["tutor-profile", "me"],
    queryFn: () => getMyProfileRequest(),
  });
}
