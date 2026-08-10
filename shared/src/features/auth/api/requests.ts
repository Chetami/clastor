import { api, SKIP_AUTH_REFRESH } from "../../../lib/api";
import type {
  JoinWaitlistResponse,
  LoginResponse,
  RefreshTokenResponse,
  SignupSurvey,
  UserInfo,
} from "@examify-tms/interfaces";

/**
 * Auth request functions that are platform-agnostic (no Firebase SDK).
 * The Firebase sign-in calls that produce the initial ID token live in each
 * app (web: `firebase/auth`, mobile: `@react-native-firebase/auth`) and then
 * hand the token to {@link exchangeFirebaseToken}.
 *
 * Every exchange below is tagged with {@link SKIP_AUTH_REFRESH}: these
 * requests carry a Firebase ID token in Authorization, not an app JWT, so a
 * 401 is a genuine auth failure (invalid Firebase token / user not found) and
 * must NOT trigger the api client's transparent refresh+retry (which would
 * replace the Firebase token with an app JWT and misreport the error).
 */

/** Shared header config for Firebase-token exchange requests. */
function firebaseExchangeHeaders(firebaseToken: string) {
  return {
    Authorization: `Bearer ${firebaseToken}`,
    [SKIP_AUTH_REFRESH]: "true",
  };
}

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
      headers: firebaseExchangeHeaders(firebaseToken),
    },
  );
  return response.data;
}

/**
 * Exchange a Firebase ID token (obtained via Google sign-in) for the app's
 * own JWT + refresh token pair. Unlike {@link exchangeFirebaseToken} this hits
 * `/api/auth/google`, which creates the Firestore document on first sign-in
 * using the Google profile, so it works for brand-new users.
 */
export async function exchangeGoogleFirebaseToken(
  firebaseToken: string,
  body?: Record<string, unknown>,
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(
    "/api/auth/google",
    body,
    {
      headers: firebaseExchangeHeaders(firebaseToken),
    },
  );
  return response.data;
}

/**
 * Exchange a Firebase ID token for the app's own JWT + refresh token pair via
 * the register endpoint. Unlike {@link exchangeFirebaseToken} (which hits
 * `/api/auth/login` and requires the Firestore user doc to already exist),
 * this hits `/api/auth/register`, which CREATES the Firestore document from
 * the provided name/timezone and the decoded Firebase profile. Used by the
 * sign-up flow for brand-new email/password accounts.
 */
export async function registerFirebaseToken(
  firebaseToken: string,
  body?: Record<string, unknown>,
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(
    "/api/auth/register",
    body,
    {
      headers: firebaseExchangeHeaders(firebaseToken),
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
    { headers: { [SKIP_AUTH_REFRESH]: "true" } },
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
    { headers: { [SKIP_AUTH_REFRESH]: "true" } },
  );
}

/**
 * Join the organisation waitlist (pre-signup, public — no Firebase token).
 * Stores the email + qualifier survey in a Firestore `waitlist` collection
 * for launch outreach. Returns `{ joined: boolean }` — `joined` is false when
 * the email was already on the list (the existing entry is updated).
 */
export async function joinWaitlistRequest(
  email: string,
  signupSurvey?: SignupSurvey,
): Promise<JoinWaitlistResponse> {
  const response = await api.post<JoinWaitlistResponse>(
    "/api/auth/waitlist",
    { email, signupSurvey: signupSurvey ?? null },
    { headers: { [SKIP_AUTH_REFRESH]: "true" } },
  );
  return response.data;
}
