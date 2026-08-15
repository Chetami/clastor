import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiError, RefreshTokenResponse } from "@examify-tms/interfaces";
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from "../config/tokens";
import { getStorage, getApiBaseUrl, notifySessionExpired } from "../runtime";
import { useAuthStore } from "../store/auth-store";

/**
 * Shared axios instance. The base URL is resolved lazily inside the request
 * interceptor (from the runtime config) rather than at construction, so this
 * module is safe to import before `configureShared()` has run.
 */
export const api = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

// Marks a request so the 401-response interceptor won't try to refresh on it.
// Used by the /refresh call itself (to avoid an infinite refresh loop) AND by
// the Firebase-token exchange calls (/login, /google, /register): those carry
// a Firebase ID token in Authorization, NOT an app JWT, so a 401 from them is a
// real auth failure — refreshing + retrying would swap the Firebase token for
// an app JWT and produce misleading errors. Tagging them skips that path and
// surfaces the backend's actual 401 message to the caller.
export const SKIP_AUTH_REFRESH = "X-Skip-Auth-Refresh";

/**
 * Error thrown for failed API requests, carrying the HTTP status so callers
 * can distinguish definitive failures (401/403/404…) from transient ones
 * (network errors, 5xx) without string-matching messages.
 */
export class ApiRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

api.interceptors.request.use((config) => {
  if (!config.baseURL) {
    config.baseURL = getApiBaseUrl();
  }
  if (config.headers.has("Authorization")) {
    return config;
  }

  const token = getStorage().getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

type RetryableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// Singleton in-flight refresh promise so N concurrent 401s share a single
// /refresh call instead of racing each other.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getStorage().getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new Error("No refresh token");

    // Use a raw axios call (not `api`) so the request interceptor doesn't
    // attach the expired access token and we sidestep any recursion.
    const res = await axios.post<RefreshTokenResponse>(
      `${getApiBaseUrl()}/api/auth/refresh`,
      { refreshToken },
      { headers: { "Content-Type": "application/json", [SKIP_AUTH_REFRESH]: "true" } },
    );

    const { jwtToken, refreshToken: newRefreshToken, user } = res.data;
    // Keep the in-memory identity in sync with the server's view of the user
    // (role/onboarding/profile can change between refreshes; without this the
    // client would keep a stale UserInfo until the next /verify).
    if (user) useAuthStore.getState().setUser(user);
    useAuthStore.getState().setTokens(jwtToken, newRefreshToken);
    return jwtToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config as RetryableConfig | undefined;
    const status = error?.response?.status;
    const skipRefresh = original?.headers?.get?.(SKIP_AUTH_REFRESH);

    // On a 401, transparently refresh once and retry the original request —
    // unless it's the refresh call itself, or we've already retried it.
    if (
      error instanceof AxiosError &&
      status === 401 &&
      original &&
      !original._retried &&
      !skipRefresh
    ) {
      try {
        const newToken = await refreshAccessToken();
        original._retried = true;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        // Refresh failed (expired/revoked refresh token) — force re-login.
        useAuthStore.getState().clearAuth();
        notifySessionExpired();
        // Tagged as a 401 so boot logic can tell definitive auth failures
        // apart from transient network/backend errors.
        return Promise.reject(
          new ApiRequestError("Session expired. Please log in again.", 401),
        );
      }
    }

    if (axios.isAxiosError(error)) {
      const apiError: ApiError = error.response?.data ?? {
        message: "An unexpected error occurred",
      };
      return Promise.reject(
        new ApiRequestError(apiError.message, error.response?.status),
      );
    }
    return Promise.reject(error);
  },
);
