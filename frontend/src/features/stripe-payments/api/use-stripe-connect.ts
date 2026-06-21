import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import {
  getStripeStatusRequest,
  connectStripeRequest,
  openStripeDashboardRequest,
} from "./requests";

/**
 * Stripe Connect status for the authenticated tutor. Refreshed whenever
 * the user returns from Stripe onboarding (via the `stripe` query param).
 */
export function useStripeConnectStatus() {
  return useQuery({
    queryKey: ["stripe-connect-status"],
    queryFn: getStripeStatusRequest,
  });
}

/**
 * Start / resume Stripe onboarding. On success the browser is redirected to
 * the returned Stripe-hosted URL.
 */
export function useConnectStripe() {
  return useMutation({
    mutationFn: connectStripeRequest,
    onSuccess: (data) => {
      // Single-use link — redirect immediately.
      window.location.href = data.url;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["stripe-connect-status"] });
    },
  });
}

/**
 * Open the Stripe Express dashboard (payouts / balance).
 */
export function useOpenStripeDashboard() {
  return useMutation({
    mutationFn: openStripeDashboardRequest,
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}
