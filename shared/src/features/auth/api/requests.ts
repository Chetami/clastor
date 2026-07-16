import { api } from "../../../lib/api";
import type {
  LoginResponse,
  RefreshTokenResponse,
  UserInfo,
} from "@examify-tms/interfaces";

/**
 * Auth request functions that are platform-agnostic (no Firebase SDK).
 * The Firebase sign-in calls that produce the initial ID token live in each
 * app (web: `firebase/auth`, mobile: `@react-native-firebase/auth`) and then
 * hand the token to {@link exchangeFirebaseToken}.
 */

/**
 * Exchange a Firebase ID token for the app's own JWT + refresh token pair.
 * Used by every sign-in method (email/password, register, Google) after the
 * Firebase side has produced a credential.
 */
export async function exchangeFirebaseToken(
  firebaseToken: string,
  body?: Record<string, unknown>,
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(
    "/api/auth/login",
    body,
    {
      headers: { Authorization: `Bearer ${firebaseToken}` },
    },
  );
  return response.data;
}

/**
 * Validate the current session and return the user. Also used as the
 * bootstrap query that hydrates the auth store on app launch.
 */
export async function verifyRequest(): Promise<UserInfo> {
  const response = await api.get<LoginResponse>("/api/auth/verify");
  return response.data.user;
}

/**
 * Exchange a refresh token for a fresh access + refresh token pair. Tagged
 * with the skip header so the api.ts response interceptor never tries to
 * refresh it.
 */
export async function refreshRequest(
  refreshToken: string,
): Promise<RefreshTokenResponse> {
  const response = await api.post<RefreshTokenResponse>(
    "/api/auth/refresh",
    { refreshToken },
    { headers: { "X-Skip-Auth-Refresh": "true" } },
  );
  return response.data;
}

/**
 * Revoke a refresh token server-side. Best-effort — callers should not block
 * sign-out on this failing.
 */
export async function revokeRefreshToken(
  refreshToken: string,
): Promise<void> {
  await api.post(
    "/api/auth/logout",
    { refreshToken },
    { headers: { "X-Skip-Auth-Refresh": "true" } },
  );
}
