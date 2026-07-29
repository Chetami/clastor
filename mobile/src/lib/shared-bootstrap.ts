import {
  configureShared,
  useAuthStore,
} from "@examify-tms/shared";
import { createSecureStorage } from "./storage";

/**
 * The backend base URL. `EXPO_PUBLIC_API_URL` is baked in at build time.
 *
 * IMPORTANT for physical devices: `localhost` refers to the PHONE, not your
 * dev machine. When running on a device or simulator that can't reach the
 * host loopback, set this to your machine's LAN IP, e.g.
 *   EXPO_PUBLIC_API_URL=http://192.168.1.50:3001
 * (and start the backend with the same host binding).
 */
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

let initialised = false;

/**
 * Initialise the shared data layer for the mobile app. Must run once before
 * any component that touches the network mounts — i.e. at the top of the root
 * layout, before rendering. Safe to call multiple times (no-op after the
 * first), which keeps Fast Refresh from throwing.
 */
export function initShared(): void {
  if (initialised) return;
  configureShared({
    storage: createSecureStorage(),
    apiBaseUrl: API_BASE_URL,
    onSessionExpired: undefined,
  });
  // Read any persisted tokens into the auth store synchronously so the
  // auth gate knows the session state on the first render.
  useAuthStore.getState().hydrate();
  initialised = true;
}

export { API_BASE_URL };
