import { api } from "../../../lib/api";
import type {
  StripeConnectStatusResponse,
  CreateAccountLinkResponse,
  DashboardLinkResponse,
} from "@examify-tms/interfaces";

/**
 * Current Stripe Connect status for the authenticated tutor.
 */
export async function getStripeStatusRequest(): Promise<StripeConnectStatusResponse> {
  const response = await api.get<StripeConnectStatusResponse>(
    "/api/stripe/account",
  );
  return response.data;
}

/**
 * Start (or resume) Stripe onboarding. Returns a single-use URL the caller
 * should redirect the browser to.
 */
export async function connectStripeRequest(): Promise<CreateAccountLinkResponse> {
  const response = await api.post<CreateAccountLinkResponse>(
    "/api/stripe/connect",
  );
  return response.data;
}

/**
 * Open the Stripe Express dashboard (manage payouts/balance).
 */
export async function openStripeDashboardRequest(): Promise<DashboardLinkResponse> {
  const response = await api.post<DashboardLinkResponse>(
    "/api/stripe/dashboard-link",
  );
  return response.data;
}
