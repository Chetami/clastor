import { beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/server";
import { api, useAuthStore, REFRESH_TOKEN_KEY } from "@examify-tms/shared";
import type { UserInfo } from "@examify-tms/interfaces";
const user = { uid: "session-one", email: "one@example.com", role: "tutor" } as UserInfo;
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function protectedEndpoint() {
  return http.get("*/api/test/recovery", ({ request }) => request.headers.get("authorization") === "Bearer fresh"
    ? HttpResponse.json({ ok: true }) : HttpResponse.json({ message: "expired" }, { status: 401 }));
}
const pair = { jwtToken: "fresh", refreshToken: "next-refresh", user };
beforeEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearAuth();
  useAuthStore.getState().setAuth(user, "expired", "original-refresh");
});
describe("session recovery", () => {
  it.each([429, 500, 503])("retains credentials on refresh HTTP %i", async (status) => {
    server.use(protectedEndpoint(), http.post("*/api/auth/refresh", () => HttpResponse.json({ message: "Try again" }, { status })));
    await expect(api.get("/api/test/recovery")).rejects.toMatchObject({ status });
    expect(useAuthStore.getState().refreshToken).toBe("original-refresh");
    expect(useAuthStore.getState().user).toEqual(user);
  });
  it("retains credentials when the refresh network request fails", async () => {
    server.use(protectedEndpoint(), http.post("*/api/auth/refresh", () => HttpResponse.error()));
    await expect(api.get("/api/test/recovery")).rejects.toThrow();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("original-refresh");
  });
  it("coordinates concurrent 401 responses into one refresh", async () => {
    let calls = 0;
    const ready = deferred(), release = deferred();
    server.use(protectedEndpoint(), http.post("*/api/auth/refresh", async () => {
      calls++; ready.resolve(); await release.promise; return HttpResponse.json(pair);
    }));
    const first = api.get("/api/test/recovery");
    const second = api.get("/api/test/recovery");
    await ready.promise;
    release.resolve();
    await Promise.all([first, second]);
    expect(calls).toBe(1);
    expect(useAuthStore.getState().refreshToken).toBe("next-refresh");
  });
  it.each([200, 401])("ignores late refresh HTTP %i after switching accounts", async (status) => {
    const ready = deferred(), release = deferred();
    server.use(protectedEndpoint(), http.post("*/api/auth/refresh", async () => {
      ready.resolve(); await release.promise;
      return HttpResponse.json(status === 200 ? pair : { message: "revoked" }, { status });
    }));
    const pending = api.get("/api/test/recovery");
    await ready.promise;
    const other = { ...user, uid: "session-two" };
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setAuth(other, "other-access", "other-refresh");
    const assertion = expect(pending).rejects.toMatchObject({ status: 409 });
    release.resolve(); await assertion;
    expect(useAuthStore.getState().user?.uid).toBe("session-two");
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe("other-refresh");
  });
  it("never recreates a session after logout during refresh", async () => {
    const ready = deferred(), release = deferred();
    server.use(protectedEndpoint(), http.post("*/api/auth/refresh", async () => {
      ready.resolve(); await release.promise; return HttpResponse.json(pair);
    }));
    const pending = api.get("/api/test/recovery");
    await ready.promise; useAuthStore.getState().clearAuth();
    const assertion = expect(pending).rejects.toMatchObject({ status: 409 });
    release.resolve(); await assertion;
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });
  it("keeps a permission denial separate from session expiry", async () => {
    server.use(http.get("*/api/test/recovery", () => HttpResponse.json({ message: "Verify your email", code: "EMAIL_NOT_VERIFIED" }, { status: 403 })));
    await expect(api.get("/api/test/recovery")).rejects.toMatchObject({ status: 403, code: "EMAIL_NOT_VERIFIED" });
    expect(useAuthStore.getState().user).toEqual(user);
  });
  it("retries a protected request at most once", async () => {
    let refreshes = 0;
    server.use(http.get("*/api/test/recovery", () => HttpResponse.json({ message: "denied" }, { status: 401 })),
      http.post("*/api/auth/refresh", () => { refreshes++; return HttpResponse.json(pair); }));
    await expect(api.get("/api/test/recovery")).rejects.toMatchObject({ status: 401 });
    expect(refreshes).toBe(1);
  });
});
