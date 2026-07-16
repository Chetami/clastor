import { configureShared, useAuthStore, type StorageAdapter } from "@examify-tms/shared";

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
}
