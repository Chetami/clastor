import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { server } from "@/test/server";
import { http, HttpResponse } from "msw";
import { api, useAuthStore, TOKEN_KEY, REFRESH_TOKEN_KEY } from "@examify-tms/shared";
import type { UserInfo } from "@examify-tms/interfaces";

// Cross-tab sync is installed by initShared(); we import it lazily in the test
// that needs it so the module's top-level side effects don't interfere with the
// refresh-interceptor test (which must NOT have an extra storage listener
// running).
import { initShared } from "./shared-bootstrap";

const OLD_USER: UserInfo = {
  uid: "user_1",
  name: "Old Name",
  email: "tutor@example.com",
  role: "tutor",
  avatarUrl: null,
  onboardingComplete: false,
} as unknown as UserInfo;

const NEW_USER: UserInfo = {
  uid: "user_1",
  name: "New Name",
  email: "tutor@example.com",
  role: "tutor",
  avatarUrl: null,
  onboardingComplete: true,
} as unknown as UserInfo;

beforeEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearAuth();
});

describe("api client: transparent refresh on 401 (Fix C)", () => {
  it("applies the user returned by /api/auth/refresh to the auth store", async () => {
    // Seed a session with an expired access token + a valid refresh token.
    useAuthStore.getState().setAuth(OLD_USER, "expired-jwt", "valid-refresh");

    // The protected endpoint returns 401 for the expired token, 200 for the
    // fresh one — mirroring how the backend rejects an expired access token.
    server.use(
      http.get("*/api/test/protected", ({ request }) => {
        const auth = request.headers.get("authorization");
        if (auth === "Bearer expired-jwt") {
          return HttpResponse.json({ message: "Invalid or expired token" }, { status: 401 });
        }
        if (auth === "Bearer fresh-jwt") {
          return HttpResponse.json({ ok: true });
        }
        return HttpResponse.json({ message: "unexpected token" }, { status: 401 });
      }),

      // The refresh endpoint rotates the tokens AND returns an updated user
      // (e.g. onboarding just completed). Fix C: the interceptor must apply
      // this user, not just the tokens.
      http.post("*/api/auth/refresh", async ({ request }) => {
        const body = (await request.json()) as { refreshToken: string };
        expect(body.refreshToken).toBe("valid-refresh");
        return HttpResponse.json({
          jwtToken: "fresh-jwt",
          refreshToken: "fresh-refresh",
          user: NEW_USER,
        });
      }),
    );

    // The first call 401s; the interceptor refreshes + retries transparently.
    const res = await api.get("/api/test/protected");

    expect(res.status).toBe(200);
    // Tokens rotated in the store…
    expect(useAuthStore.getState().token).toBe("fresh-jwt");
    expect(useAuthStore.getState().refreshToken).toBe("fresh-refresh");
    // …and the user from the refresh response was applied (Fix C). Previously
    // the store kept the stale OLD_USER until the next /verify.
    expect(useAuthStore.getState().user).toEqual(NEW_USER);
  });

  it("clears the session and rejects when the refresh token is also invalid", async () => {
    useAuthStore.getState().setAuth(OLD_USER, "expired-jwt", "expired-refresh");

    server.use(
      http.get("*/api/test/protected", () =>
        HttpResponse.json({ message: "Invalid or expired token" }, { status: 401 }),
      ),
      http.post("*/api/auth/refresh", () =>
        HttpResponse.json({ message: "Invalid refresh token" }, { status: 401 }),
      ),
    );

    await expect(api.get("/api/test/protected")).rejects.toThrow(/Session expired/);

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });
});

describe("cross-tab token sync via the storage event (Fix D)", () => {
  // initShared() registers a `storage` event listener that syncs token changes
  // from other tabs into the in-memory store (using setState, NOT setTokens,
  // so it never echoes back to storage). We install it fresh here and clean up
  // the listener after.
  let removeListener: (() => void) | undefined;

  beforeEach(() => {
    // initShared() registers a `storage` event listener; capture it via a spy
    // so we can remove it after the test. jsdom dispatches `storage` events
    // via window.dispatchEvent, which the listener on `window` receives.
    const spy = vi.spyOn(window, "addEventListener");
    initShared();
    const storageCalls = spy.mock.calls.filter((c) => c[0] === "storage");
    if (storageCalls.length > 0) {
      const handler = storageCalls[storageCalls.length - 1][1] as (
        e: StorageEvent,
      ) => void;
      removeListener = () => window.removeEventListener("storage", handler);
    }
    spy.mockRestore();
    // initShared re-runs configureShared; clear the session for a clean slate.
    useAuthStore.getState().clearAuth();
  });

  afterEach(() => {
    removeListener?.();
  });

  function dispatchStorage(key: string | null, newValue: string | null) {
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue, storageArea: localStorage }),
    );
  }

  it("syncs refreshed tokens from another tab into the in-memory store", () => {
    localStorage.setItem(TOKEN_KEY, "tab-a-jwt");
    localStorage.setItem(REFRESH_TOKEN_KEY, "tab-a-refresh");

    dispatchStorage(TOKEN_KEY, "tab-a-jwt");

    // setState (not setTokens) was used, so the store updated without echoing
    // back to storage.
    expect(useAuthStore.getState().token).toBe("tab-a-jwt");
    expect(useAuthStore.getState().refreshToken).toBe("tab-a-refresh");
  });

  it("clears the local session when another tab signs out (tokens removed)", () => {
    useAuthStore.getState().setAuth(NEW_USER, "jwt", "refresh");
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);

    // key === null signals a full clear (e.g. another tab called clearAuth).
    dispatchStorage(null, null);

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it("ignores storage events for unrelated keys", () => {
    useAuthStore.getState().setAuth(NEW_USER, "jwt", "refresh");

    localStorage.setItem("unrelated-key", "whatever");
    dispatchStorage("unrelated-key", "whatever");

    expect(useAuthStore.getState().token).toBe("jwt");
    expect(useAuthStore.getState().user).toEqual(NEW_USER);
  });
});
