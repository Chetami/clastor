import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { StorageAdapter } from "@examify-tms/shared";
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from "@examify-tms/shared";

/**
 * Synchronous token storage for the mobile client.
 *
 * The shared data layer requires a SYNCHRONOUS adapter because the axios
 * request interceptor and the Zustand store read the token inline (mirroring
 * the web `localStorage` behaviour). `expo-secure-store` exposes synchronous
 * `getItem`/`setItem` (JSI-backed) but only an async `deleteItemAsync`, so we
 * keep an in-memory write-through cache as the synchronous source of truth and
 * persist through to the keychain as best-effort.
 *
 * Three runtime targets:
 *  - Native (iOS/Android): keychain-backed (write-through cache).
 *  - Web browser: `localStorage` (same keys as the web client).
 *  - Node SSR (web `output: "static"`): in-memory only — `SecureStore` and
 *    `localStorage` don't exist there, and tokens are irrelevant server-side.
 *    Without this guard the SSR render throws `localStorage is not defined`,
 *    which kills the Expo Go manifest and makes Expo Go fall back to the
 *    default `expo/AppEntry` bundle.
 */
const memory = new Map<string, string>();

function hydrateCache(): void {
  for (const key of [TOKEN_KEY, REFRESH_TOKEN_KEY]) {
    if (memory.has(key)) continue;
    const value = SecureStore.getItem(key);
    if (value != null) memory.set(key, value);
  }
}

const nativeStorage: StorageAdapter = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
    SecureStore.setItem(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
    // Best-effort keychain cleanup; cannot block (no sync delete in SDK 57).
    void SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

const memoryStorage: StorageAdapter = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => void memory.set(key, value),
  removeItem: (key) => void memory.delete(key),
};

const webStorage: StorageAdapter = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

// Resolve `localStorage` defensively so this module never throws in a Node SSR
// context (where the global is absent). Read once at module load.
const browserLocalStorage: Storage | null = globalThis.localStorage ?? null;

export function createSecureStorage(): StorageAdapter {
  if (Platform.OS === "web") {
    return browserLocalStorage ? webStorage : memoryStorage;
  }
  hydrateCache();
  return nativeStorage;
}
