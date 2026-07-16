import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import {
  configureShared,
  useAuthStore,
  TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  type StorageAdapter,
} from "@examify-tms/shared";
import { router } from "expo-router";

/**
 * Synchronous in-memory cache backed by AsyncStorage.
 *
 * The shared axios interceptor and Zustand store need synchronous token reads
 * (matching the web app's localStorage behaviour). AsyncStorage is async-only,
 * so we mirror it into a Map that's hydrated once at bootstrap and written
 * through on every mutation.
 *
 * On the web, localStorage is the adapter. In a native dev build, this could
 * be swapped for expo-secure-store's synchronous JSI accessors — but
 * AsyncStorage is used here for Expo Go compatibility.
 */
const cache = new Map<string, string>();

const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => cache.get(key) ?? null,
  setItem: (key, value) => {
    cache.set(key, value);
    void AsyncStorage.setItem(key, value);
  },
  removeItem: (key) => {
    cache.delete(key);
    void AsyncStorage.removeItem(key);
  },
};

/**
 * Load persisted tokens from AsyncStorage into the synchronous cache, then
 * hydrate the auth store. Must complete before the first render so the auth
 * gate knows whether the user has a session.
 *
 * Returns true when ready to render.
 */
export async function bootstrapShared(): Promise<void> {
  const apiBaseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
    "http://localhost:3001";

  configureShared({
    storage: asyncStorageAdapter,
    apiBaseUrl,
    onSessionExpired: () => {
      if (router.canGoBack()) router.dismissAll();
      router.replace("/login");
    },
  });

  const [token, refreshToken] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEY),
    AsyncStorage.getItem(REFRESH_TOKEN_KEY),
  ]);
  if (token) cache.set(TOKEN_KEY, token);
  if (refreshToken) cache.set(REFRESH_TOKEN_KEY, refreshToken);

  useAuthStore.getState().hydrate();
}
