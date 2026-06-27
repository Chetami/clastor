import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import {
  getFacebookStatusRequest,
  connectFacebookRequest,
  disconnectFacebookRequest,
  listFacebookPagesRequest,
  selectFacebookPageRequest,
} from "./requests";

export const FACEBOOK_STATUS_KEY = ["facebook-connection-status"] as const;

/**
 * Facebook connection status for the authenticated tutor. Refreshed whenever
 * the user returns from the Facebook consent screen (via the `fb` query param
 * handled in the card).
 */
export function useFacebookConnectionStatus() {
  return useQuery({
    queryKey: FACEBOOK_STATUS_KEY,
    queryFn: getFacebookStatusRequest,
  });
}

/**
 * Start the Facebook OAuth flow. On success the browser is redirected to
 * Facebook's consent screen; Facebook then redirects back to the backend
 * callback, which lands on `returnTo` (default /marketing) with an `fb` query
 * param.
 */
export function useConnectFacebook(returnTo?: string) {
  return useMutation({
    mutationFn: () => connectFacebookRequest(returnTo),
    onSuccess: (data) => {
      window.location.href = data.authUrl;
    },
  });
}

/**
 * Disconnect the tutor's Facebook account (clears stored tokens).
 */
export function useDisconnectFacebook() {
  return useMutation({
    mutationFn: disconnectFacebookRequest,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: FACEBOOK_STATUS_KEY });
    },
  });
}

/**
 * Pages available to select (multi-Page picker). Only meaningful after a
 * consent flow that yielded several Pages.
 */
export function useFacebookPages() {
  return useQuery({
    queryKey: ["facebook-pages"],
    queryFn: listFacebookPagesRequest,
  });
}

/**
 * Finalize a multi-Page connection by selecting a Page.
 */
export function useSelectFacebookPage() {
  return useMutation({
    mutationFn: (pageId: string) => selectFacebookPageRequest(pageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FACEBOOK_STATUS_KEY });
    },
  });
}
