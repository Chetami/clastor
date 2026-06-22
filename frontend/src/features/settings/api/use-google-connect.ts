import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import {
  getGoogleConnectionStatusRequest,
  connectGoogleRequest,
  disconnectGoogleRequest,
} from "./requests";

/**
 * Google Calendar connection status for the authenticated tutor. Refreshed
 * whenever the user returns from the Google consent screen (via the `google`
 * query param handled in the card).
 */
export function useGoogleConnectionStatus() {
  return useQuery({
    queryKey: ["google-connection-status"],
    queryFn: getGoogleConnectionStatusRequest,
  });
}

/**
 * Start the Google OAuth flow. On success the browser is redirected to
 * Google's consent screen; Google then redirects back to the backend callback,
 * which lands on /settings?google=connected.
 */
export function useConnectGoogle() {
  return useMutation({
    mutationFn: connectGoogleRequest,
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
  });
}

/**
 * Disconnect the tutor's Google account (clears stored tokens).
 */
export function useDisconnectGoogle() {
  return useMutation({
    mutationFn: disconnectGoogleRequest,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["google-connection-status"] });
    },
  });
}
