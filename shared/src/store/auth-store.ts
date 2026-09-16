import { create } from "zustand";
import type { UserInfo } from "@examify-tms/interfaces";
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from "../config/tokens";
import { getStorage } from "../runtime";

type AuthState = {
  /** Changes on login/logout/hydration, so old async requests cannot replace a session. */
  sessionVersion: number;
  user: UserInfo | null;
  token: string | null;
  refreshToken: string | null;
  /**
   * Load persisted tokens from the configured storage into the store.
   * Called once at bootstrap (after `configureShared`). Synchronous on both
   * web (localStorage) and mobile (expo-secure-store JSI accessors).
   */
  hydrate: () => void;
  setAuth: (user: UserInfo, token: string, refreshToken: string) => void;
  setUser: (user: UserInfo) => void;
  setTokens: (token: string, refreshToken: string) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  sessionVersion: 0,
  user: null,
  token: null,
  refreshToken: null,
  hydrate: () => {
    const storage = getStorage();
    set({
      sessionVersion: get().sessionVersion + 1,
      token: storage.getItem(TOKEN_KEY),
      refreshToken: storage.getItem(REFRESH_TOKEN_KEY),
    });
  },
  setAuth: (user, token, refreshToken) => {
    const storage = getStorage();
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ user, token, refreshToken, sessionVersion: get().sessionVersion + 1 });
  },
  setUser: (user) => set({ user }),
  setTokens: (token, refreshToken) => {
    const storage = getStorage();
    storage.setItem(TOKEN_KEY, token);
    storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ token, refreshToken });
  },
  clearAuth: () => {
    const storage = getStorage();
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
    set({ user: null, token: null, refreshToken: null, sessionVersion: get().sessionVersion + 1 });
  },
}));
