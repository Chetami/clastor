import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import { API_URL, TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/config";
import { useAuthStore } from "@/store/auth-store";
import type { ApiError, RefreshTokenResponse } from "@examify-tms/interfaces";

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Marks a request so the 401-response interceptor won't try to refresh on it
// (used by the /refresh call itself, to avoid an infinite refresh loop).
const SKIP_AUTH_REFRESH = "X-Skip-Auth-Refresh";

api.interceptors.request.use((config) => {
  if (config.headers.has("Authorization")) {
    return config;
  }

  const token = localStorage.getItem(TOKEN_KEY);
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
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new Error("No refresh token");

    // Use a raw axios call (not `api`) so the request interceptor doesn't
    // attach the expired access token and we sidestep any recursion.
    const res = await axios.post<RefreshTokenResponse>(
      `${API_URL}/api/auth/refresh`,
      { refreshToken },
      { headers: { "Content-Type": "application/json", [SKIP_AUTH_REFRESH]: "true" } },
    );

    const { jwtToken, refreshToken: newRefreshToken } = res.data;
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
        return Promise.reject(new Error("Session expired. Please log in again."));
      }
    }

    if (axios.isAxiosError(error)) {
      const apiError: ApiError = error.response?.data ?? {
        message: "An unexpected error occurred",
      };
      return Promise.reject(new Error(apiError.message));
    }
    return Promise.reject(error);
  },
);
