import {
  configureShared,
  useAuthStore,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  type StorageAdapter,
} from "@examify-tms/shared";

/**
 * localStorage-backed storage adapter for the web client. The tokens are
 * stored exactly where they always were (the same keys), so an existing web
 * session survives the move to the shared package.
 */
const webStorage: StorageAdapter = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

/**
 * Keep every open tab's in-memory auth store in sync with the shared
 * localStorage. The request interceptor already reads tokens from storage on
 * each call, but the Zustand `token`/`refreshToken` state (used by the verify
 * query gate, logout, and the UI) would otherwise stay stale in background
 * tabs. When a foreground tab refreshes or logs out, this listener updates
 * the others in place — and crucially, it does NOT write back to storage, so
 * there's no echo loop. This also shrinks the window for two tabs to both
 * POST /api/auth/refresh with the same (soon-to-be-rotated) token, which would
 * trip the backend's reuse detection and burn the whole session family.
 */
function installCrossTabSync(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("storage", (event) => {
    // `key === null` means another tab cleared localStorage (e.g. sign-out).
    if (event.key !== null && event.key !== TOKEN_KEY && event.key !== REFRESH_TOKEN_KEY) {
      return;
    }
    const token = localStorage.getItem(TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!token && !refreshToken) {
      // Another tab signed out — drop the local session too.
      useAuthStore.getState().clearAuth();
    } else {
      // setState (not setTokens) so we don't write back to storage and echo.
      useAuthStore.setState({ token, refreshToken });
    }
  });
}

/**
 * Initialise the shared data layer for the web app. Must run once before any
 * component that touches the network mounts — i.e. at the top of `main.tsx`,
 * before `ReactDOM.render`.
 *
 * `hydrate()` reads any persisted tokens out of localStorage into the store
 * synchronously, so the auth-gated routes know the session state on the very
 * first render (matching the pre-refactor behaviour).
 */
export function initShared(): void {
  configureShared({
    storage: webStorage,
    apiBaseUrl: import.meta.env.VITE_API_URL || "http://localhost:3001",
    // The shared layer clears auth + query cache before this fires; the web
    // app's route guard + AuthBoot already redirect to /login, so nothing
    // extra is needed here.
    onSessionExpired: undefined,
  });
  useAuthStore.getState().hydrate();
  installCrossTabSync();
}
