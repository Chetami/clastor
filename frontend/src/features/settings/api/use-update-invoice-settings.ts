import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { InvoiceSettings, UserInfo } from "@examify-tms/interfaces";
import { useAuthStore } from "@/store/auth-store";
import { updateInvoiceSettingsRequest } from "./requests";

/**
 * Save the tutor's invoice customisation (ABN + bank details). Pushes the
 * updated user into the auth store and invalidates the invoice template
 * preview so the PDF re-renders with the new details if it's on screen.
 */
export function useUpdateInvoiceSettings() {
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  return useMutation<UserInfo, Error, InvoiceSettings>({
    mutationFn: (invoiceSettings) =>
      updateInvoiceSettingsRequest(invoiceSettings),
    onSuccess: (user) => {
      setUser(user);
      // The invoice template preview PDF is generated server-side from the
      // saved settings, so force a refetch to reflect the change.
      queryClient.invalidateQueries({
        queryKey: ["templates", "invoice", "preview"],
      });
    },
  });
}
