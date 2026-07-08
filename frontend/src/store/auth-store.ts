import { create } from "zustand";
import type { UserInfo } from "@examify-tms/interfaces";
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from "@/config";

type AuthState = {
  user: UserInfo | null;
  token: string | null;
  refreshToken: string | null;
  setAuth: (user: UserInfo, token: string, refreshToken: string) => void;
  setUser: (user: UserInfo) => void;
  setTokens: (token: string, refreshToken: string) => void;
  /** Swap the access token + user after an org switch (keeps the refresh token,
   *  which is uid-bound and unchanged). Used by PATCH /users/me { currentOrgId }. */
  switchSession: (user: UserInfo, token: string) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
  setAuth: (user, token, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ user, token, refreshToken });
  },
  setUser: (user) => set({ user }),
  switchSession: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ user, token });
  },
  setTokens: (token, refreshToken) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    set({ token, refreshToken });
  },
  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    set({ user: null, token: null, refreshToken: null });
  },
}));
