import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiError, RefreshTokenResponse } from "@examify-tms/interfaces";
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from "../config/tokens";
import { getStorage, getApiBaseUrl, notifySessionExpired } from "../runtime";
import { useAuthStore } from "../store/auth-store";
import { queryClient } from "./query-client";

export const api = axios.create({ headers: { "Content-Type": "application/json" } });
// Firebase-token exchange and public auth endpoints must never retry with an app JWT.
export const SKIP_AUTH_REFRESH = "X-Skip-Auth-Refresh";

export class ApiRequestError extends Error {
  constructor(message: string, readonly status?: number, readonly code?: string) {
    super(message);
    this.name = "ApiRequestError";
  }
}
class SessionChangedError extends ApiRequestError {
  constructor() { super("The active session changed. Please try again.", 409); }
}
type AuthConfig = InternalAxiosRequestConfig & {
  _retried?: boolean;
  _sessionVersion?: number;
};

function requestError(error: unknown): Error {
  if (!axios.isAxiosError(error)) return error instanceof Error ? error : new Error("Request failed");
  const body = error.response?.data as ApiError | undefined;
  return new ApiRequestError(
    typeof body?.message === "string" ? body.message : "Could not reach the server. Please try again.",
    error.response?.status, body?.code,
  );
}

api.interceptors.request.use((config: AuthConfig) => {
  if (!config.baseURL) config.baseURL = getApiBaseUrl();
  if (config._sessionVersion !== undefined &&
      config._sessionVersion !== useAuthStore.getState().sessionVersion) throw new SessionChangedError();
  if (!config.headers.get(SKIP_AUTH_REFRESH) && config._sessionVersion === undefined) {
    config._sessionVersion = useAuthStore.getState().sessionVersion;
  }
  if (config.headers.has("Authorization")) return config;
  const token = getStorage().getItem(TOKEN_KEY);
  if (token && !config.headers.get(SKIP_AUTH_REFRESH)) {
    config.headers.Authorization = `Bearer ${token}`;
    config._sessionVersion = useAuthStore.getState().sessionVersion;
  }
  return config;
});

let refreshFlight: {
  token: string;
  version: number;
  promise: Promise<string>;
} | null = null;

async function refreshAccessToken(): Promise<string> {
  const token = getStorage().getItem(REFRESH_TOKEN_KEY);
  const version = useAuthStore.getState().sessionVersion;
  if (!token) throw new ApiRequestError("Session expired. Please log in again.", 401);
  if (refreshFlight?.token === token && refreshFlight.version === version) return refreshFlight.promise;

  const flight = { token, version, promise: null as unknown as Promise<string> };
  flight.promise = (async () => {
    try {
      const response = await axios.post<RefreshTokenResponse>(
        `${getApiBaseUrl()}/api/auth/refresh`, { refreshToken: token },
        { headers: { "Content-Type": "application/json" }, timeout: 15_000 },
      );
      if (version !== useAuthStore.getState().sessionVersion ||
          getStorage().getItem(REFRESH_TOKEN_KEY) !== token) throw new SessionChangedError();
      const { jwtToken, refreshToken, user } = response.data;
      useAuthStore.getState().setTokens(jwtToken, refreshToken);
      useAuthStore.getState().setUser(user);
      return jwtToken;
    } catch (error) {
      if (version !== useAuthStore.getState().sessionVersion ||
          getStorage().getItem(REFRESH_TOKEN_KEY) !== token) throw new SessionChangedError();
      throw requestError(error);
    } finally {
      if (refreshFlight === flight) refreshFlight = null;
    }
  })();
  refreshFlight = flight;
  return flight.promise;
}

api.interceptors.response.use(
  (response) => {
    const config = response.config as AuthConfig;
    if (config._sessionVersion !== undefined &&
        config._sessionVersion !== useAuthStore.getState().sessionVersion) throw new SessionChangedError();
    return response;
  },
  async (error) => {
    const original = error?.config as AuthConfig | undefined;
    if (original?._sessionVersion !== undefined &&
        original._sessionVersion !== useAuthStore.getState().sessionVersion) throw new SessionChangedError();
    if (error instanceof AxiosError && error.response?.status === 401 && original &&
        !original._retried && !original.headers.get(SKIP_AUTH_REFRESH)) {
      const version = useAuthStore.getState().sessionVersion;
      try {
        // A late 401 may belong to the token another request already refreshed.
        const current = getStorage().getItem(TOKEN_KEY);
        const accessToken = current && original.headers.get("Authorization") !== `Bearer ${current}`
          ? current : await refreshAccessToken();
        original._retried = true;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshError) {
        if (refreshError instanceof ApiRequestError && refreshError.status === 401 &&
            version === useAuthStore.getState().sessionVersion) {
          useAuthStore.getState().clearAuth();
          queryClient.clear();
          notifySessionExpired();
        }
        // Offline, 429 and 5xx leave the credential intact for an explicit retry.
        throw refreshError;
      }
    }
    throw requestError(error);
  },
);
