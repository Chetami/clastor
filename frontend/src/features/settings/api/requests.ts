import { api } from "@/lib/api";
import type { GoogleConnectionStatus, UserInfo } from "@examify-tms/interfaces";

/**
 * Upload a profile picture for the authenticated user.
 * The backend resizes/compresses the image and returns the updated UserInfo.
 */
export async function uploadAvatarRequest(file: File): Promise<UserInfo> {
  const form = new FormData();
  form.append("avatar", file);
  // Override the client's default "application/json" so the browser sets the
  // multipart/form-data Content-Type with the correct boundary. Without this,
  // multer never sees a multipart body and req.file is undefined.
  const response = await api.post<UserInfo>("/api/users/me/avatar", form, {
    headers: { "Content-Type": undefined },
  });
  return response.data;
}

/**
 * Update the authenticated user's currency (the currency they charge in).
 * The backend keeps the tutor profile's denormalized currency in sync and
 * returns the updated UserInfo.
 */
export async function updateUserCurrencyRequest(
  currency: string,
): Promise<UserInfo> {
  const response = await api.patch<UserInfo>("/api/users/me", { currency });
  return response.data;
}

/**
 * Whether the authenticated tutor has connected a Google account (for Meet /
 * Google Calendar). The refresh token itself is never exposed.
 */
export async function getGoogleConnectionStatusRequest(): Promise<GoogleConnectionStatus> {
  const response = await api.get<GoogleConnectionStatus>(
    "/api/auth/google/status",
  );
  return response.data;
}

/**
 * Start a Google OAuth consent flow bound to the authenticated user. Returns a
 * single-use consent URL the browser should be redirected to. Pass `returnTo`
 * (a same-origin path) to control where the browser lands after consent; it
 * defaults to /settings on the backend.
 */
export async function connectGoogleRequest(
  returnTo?: string,
): Promise<{ authUrl: string }> {
  const response = await api.get<{ authUrl: string }>("/api/auth/google/url", {
    params: returnTo ? { returnTo } : undefined,
  });
  return response.data;
}

/**
 * Disconnect the authenticated tutor's Google account (clears stored tokens).
 */
export async function disconnectGoogleRequest(): Promise<void> {
  await api.delete("/api/auth/google");
}
