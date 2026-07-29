import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Subject, UserInfo } from "@examify-tms/interfaces";
import { useAuthStore } from "../../../store/auth-store";
import { updateSubjectsRequest } from "./requests";

/**
 * Replace the tutor's subject catalogue. Pushes the updated user into the auth
 * store so every student view resolves the new subjects instantly, and
 * invalidates the students query so cascade-removed tags refresh.
 */
export function useUpdateSubjects() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  return useMutation<UserInfo, Error, Subject[]>({
    mutationFn: (subjects) => updateSubjectsRequest(subjects),
    onSuccess: (user) => {
      setUser(user);
      // Subject removals cascade to students server-side; refresh the cache
      // so tagged students reflect the change.
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
}
