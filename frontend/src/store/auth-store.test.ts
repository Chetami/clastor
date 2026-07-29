import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "@examify-tms/shared";
import { TOKEN_KEY, REFRESH_TOKEN_KEY } from "@examify-tms/shared";
import type { UserInfo } from "@examify-tms/interfaces";

const fakeUser = {
  uid: "user_1",
  email: "tutor@example.com",
  name: "Test Tutor",
  role: "tutor",
  avatarUrl: null,
  onboardingComplete: true,
} as unknown as UserInfo;

describe("auth store (shared)", () => {
  beforeEach(() => {
    // The store reads/writes through the configured storage adapter, which in
    // tests is jsdom's localStorage. Reset both layers between tests.
    localStorage.clear();
    useAuthStore.getState().clearAuth();
  });

  it("starts unauthenticated", () => {
    const { user, token, refreshToken } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(token).toBeNull();
    expect(refreshToken).toBeNull();
  });

  it("setAuth() populates state AND persists both tokens to storage", () => {
    useAuthStore.getState().setAuth(fakeUser, "jwt-1", "refresh-1");

    expect(useAuthStore.getState().user).toEqual(fakeUser);
    expect(useAuthStore.getState().token).toBe("jwt-1");
    expect(useAuthStore.getState().refreshToken).toBe("refresh-1");

    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-1");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-1");
  });

  it("setUser() updates only the user, leaving tokens untouched", () => {
    useAuthStore.getState().setAuth(fakeUser, "jwt-1", "refresh-1");
    useAuthStore.getState().setUser({ ...fakeUser, name: "Renamed" });

    expect(useAuthStore.getState().user?.name).toBe("Renamed");
    expect(useAuthStore.getState().token).toBe("jwt-1");
  });

  it("setTokens() rotates the tokens in state and storage", () => {
    useAuthStore.getState().setAuth(fakeUser, "jwt-1", "refresh-1");
    useAuthStore.getState().setTokens("jwt-2", "refresh-2");

    expect(useAuthStore.getState().token).toBe("jwt-2");
    expect(localStorage.getItem(TOKEN_KEY)).toBe("jwt-2");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("refresh-2");
  });

  it("clearAuth() wipes state and removes tokens from storage", () => {
    useAuthStore.getState().setAuth(fakeUser, "jwt-1", "refresh-1");
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it("hydrate() pulls persisted tokens back into the store", () => {
    localStorage.setItem(TOKEN_KEY, "persisted-jwt");
    localStorage.setItem(REFRESH_TOKEN_KEY, "persisted-refresh");

    useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().token).toBe("persisted-jwt");
    expect(useAuthStore.getState().refreshToken).toBe("persisted-refresh");
    // hydrate() intentionally does not restore the user object.
    expect(useAuthStore.getState().user).toBeNull();
  });
});
