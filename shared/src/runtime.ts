import type { StorageAdapter } from "./config/storage-adapter";

/**
 * Shape of the runtime configuration every app must supply before using any
 * shared module. Call {@link configureShared} once at bootstrap (web:
 * `main.tsx`, mobile: the app entry) so the API client, auth store and
 * interceptors know where to read/write tokens and which base URL to hit.
 */
export interface SharedConfig {
  /** Synchronous key/value store for the JWT + refresh token. */
  storage: StorageAdapter;
  /** Absolute base URL of the backend, e.g. "http://localhost:3001". */
  apiBaseUrl: string;
  /**
   * Invoked when a session is irrecoverably expired (refresh failed) so the
   * app can clear its navigation state and show the login screen. The shared
   * layer already clears the auth store + query cache before calling this.
   */
  onSessionExpired?: () => void;
}

let storage: StorageAdapter | null = null;
let apiBaseUrl = "";
let onSessionExpired: (() => void) | undefined;
let configured = false;

export function configureShared(config: SharedConfig): void {
  storage = config.storage;
  apiBaseUrl = config.apiBaseUrl.replace(/\/$/, "");
  onSessionExpired = config.onSessionExpired;
  configured = true;
}

export function isSharedConfigured(): boolean {
  return configured;
}

export function getStorage(): StorageAdapter {
  if (!storage) {
    throw new Error(
      "@examify-tms/shared: configureShared() must be called before use.",
    );
  }
  return storage;
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function notifySessionExpired(): void {
  onSessionExpired?.();
}
