import { useMutation } from "@tanstack/react-query";
import type { EmailReviewSettings, UserInfo } from "@examify-tms/interfaces";
import { useAuthStore } from "../../../store/auth-store";
import { updateEmailReviewSettingsRequest } from "./requests";

/**
 * Save the tutor's email-review preference (whether outbound emails are
 * reviewed before sending). Pushes the updated user into the auth store so
 * every surface reading `user.emailReviewSettings` reflects the change
 * immediately.
 */
export function useUpdateEmailReviewSettings() {
  const setUser = useAuthStore((s) => s.setUser);

  return useMutation<UserInfo, Error, EmailReviewSettings>({
    mutationFn: (emailReviewSettings) =>
      updateEmailReviewSettingsRequest(emailReviewSettings),
    onSuccess: (user) => {
      setUser(user);
    },
  });
}
