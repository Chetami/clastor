import { create } from "zustand";
import type { UserInfo } from "@examify-tms/interfaces";
import { TOKEN_KEY } from "@/config";

type AuthState = {
  user: UserInfo | null;
  token: string | null;
  setAuth: (user: UserInfo, token: string) => void;
  setUser: (user: UserInfo) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  setAuth: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({ user, token });
  },
  setUser: (user) => set({ user }),
  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ user: null, token: null });
  },
}));
