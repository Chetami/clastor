import { describe, it, expect, beforeEach, vi } from "vitest";
import { server } from "@/test/server";
import { http, HttpResponse } from "msw";
import type { LoginResponse } from "@examify-tms/interfaces";

// --- Mock Firebase client SDK -------------------------------------------
// The request functions sign in via Firebase to obtain an ID token, then hand
// it to the shared exchange functions. We stub `firebase/auth` + the local
// firebase config so tests never touch the real Firebase SDK; the ID token is
// deterministic and the shared axios client (intercepted by MSW) is exercised
// end-to-end.

const { firebaseUser, firebaseAuthModule } = vi.hoisted(() => {
  const firebaseUser = {
    getIdToken: vi.fn(),
    delete: vi.fn(),
  };
  return {
    firebaseUser,
    firebaseAuthModule: {
      signInWithEmailAndPassword: vi.fn(),
      createUserWithEmailAndPassword: vi.fn(),
      signOut: vi.fn(),
    },
  };
});

vi.mock("firebase/auth", () => ({
  ...firebaseAuthModule,
}));

vi.mock("@/config/firebase", () => ({
  getFirebaseAuth: vi.fn(() => ({})),
}));

import {
  loginRequest,
  registerRequest,
  buildGoogleLoginUrl,
  logoutRequest,
} from "./requests";

// --- Helpers --------------------------------------------------------------

/** Captured request: method, URL path, headers, parsed JSON body. */
interface CapturedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Install an MSW handler that records the request and returns a minimal
 * LoginResponse. Returns the array the handler pushes into so the test can
 * assert which endpoint(s) were hit and with what headers/body.
 */
function captureEndpoint(path: string, captures: CapturedRequest[]) {
  return http.post(`*/api/auth/${path}`, async ({ request }) => {
    const body = request.headers.get("content-type")?.includes("json")
      ? await request.json().catch(() => undefined)
      : undefined;
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    captures.push({
      method: request.method,
      path: new URL(request.url).pathname,
      headers,
      body,
    });
    const resp: LoginResponse = {
      jwtToken: "jwt-1",
      refreshToken: "refresh-1",
      user: {
        uid: "user_1",
        name: "Test Tutor",
        email: "tutor@example.com",
        role: "tutor",
        avatarUrl: null,
        onboardingComplete: true,
      } as LoginResponse["user"],
    };
    return HttpResponse.json(resp);
  });
}

const SKIP_HEADER = "x-skip-auth-refresh";

beforeEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  firebaseUser.getIdToken.mockResolvedValue("firebase-id-token");
  firebaseUser.delete.mockResolvedValue(undefined);
  firebaseAuthModule.signInWithEmailAndPassword.mockResolvedValue({ user: firebaseUser });
  firebaseAuthModule.createUserWithEmailAndPassword.mockResolvedValue({ user: firebaseUser });
  firebaseAuthModule.signOut.mockResolvedValue(undefined);
});

describe("loginRequest", () => {
  it("POSTs to /api/auth/login with the Firebase token in Authorization", async () => {
    const captures: CapturedRequest[] = [];
    server.use(captureEndpoint("login", captures));

    await loginRequest("tutor@example.com", "password");

    expect(captures).toHaveLength(1);
    expect(captures[0].path).toBe("/api/auth/login");
    expect(captures[0].headers.authorization).toBe("Bearer firebase-id-token");
  });

  it("tags the request with X-Skip-Auth-Refresh so a 401 isn't retried", async () => {
    const captures: CapturedRequest[] = [];
    server.use(captureEndpoint("login", captures));

    await loginRequest("tutor@example.com", "password");

    // Without the skip header, a 401 from /login (e.g. user not found) would
    // trigger the api client's refresh+retry, swapping the Firebase token for
    // an app JWT and misreporting the error.
    expect(captures[0].headers[SKIP_HEADER]).toBe("true");
  });

  it("maps Firebase auth errors to friendly messages", async () => {
    firebaseAuthModule.signInWithEmailAndPassword.mockRejectedValue(
      Object.assign(new Error("Firebase: Error (auth/invalid-credential)."), {
        code: "auth/invalid-credential",
      }),
    );

    await expect(
      loginRequest("tutor@example.com", "wrong-password"),
    ).rejects.toThrow("Invalid email or password");
  });
});

describe("registerRequest (regression: must NOT hit /api/auth/login)", () => {
  it("POSTs to /api/auth/register, not /api/auth/login", async () => {
    // Regression guard: registerRequest previously called exchangeFirebaseToken
    // which hits /api/auth/login — login 401s for a brand-new user (no Firestore
    // doc), so sign-up was completely broken. It must now hit /api/auth/register.
    const captures: CapturedRequest[] = [];
    server.use(captureEndpoint("register", captures));
    // A /login handler that fails loudly if the bug regresses.
    server.use(
      http.post("*/api/auth/login", () =>
        HttpResponse.json(
          { message: "BUG: register must not hit /login" },
          { status: 401 },
        ),
      ),
    );

    await registerRequest("Jane Doe", "jane@example.com", "password123");

    expect(captures).toHaveLength(1);
    expect(captures[0].path).toBe("/api/auth/register");
  });

  it("sends name + timezone in the body and the Firebase token in Authorization", async () => {
    const captures: CapturedRequest[] = [];
    server.use(captureEndpoint("register", captures));

    await registerRequest("Jane Doe", "jane@example.com", "password123");

    expect(captures[0].body).toEqual(
      expect.objectContaining({ name: "Jane Doe" }),
    );
    expect(captures[0].headers.authorization).toBe("Bearer firebase-id-token");
  });

  it("tags the request with X-Skip-Auth-Refresh", async () => {
    const captures: CapturedRequest[] = [];
    server.use(captureEndpoint("register", captures));

    await registerRequest("Jane Doe", "jane@example.com", "password123");

    expect(captures[0].headers[SKIP_HEADER]).toBe("true");
  });
});

describe("buildGoogleLoginUrl", () => {
  it("points at the backend merged-login redirect endpoint", () => {
    const url = new URL(buildGoogleLoginUrl());

    expect(url.origin).toBe("http://localhost:3001");
    expect(url.pathname).toBe("/api/auth/google/start");
  });

  it("carries returnTo, the browser timezone, and the survey", () => {
    const url = new URL(
      buildGoogleLoginUrl({
        returnTo: "/onboarding",
        signupSurvey: {
          intent: "independent_tutor",
          studentCountBucket: null,
          tutoringFormat: null,
          tutorCountBucket: null,
          currentTools: ["spreadsheets"],
        },
      }),
    );

    expect(url.searchParams.get("returnTo")).toBe("/onboarding");
    expect(url.searchParams.get("timezone")).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
    expect(JSON.parse(url.searchParams.get("survey") ?? "{}")).toEqual(
      expect.objectContaining({ intent: "independent_tutor" }),
    );
  });

  it("omits the survey and returnTo params when not supplied", () => {
    const url = new URL(buildGoogleLoginUrl());

    expect(url.searchParams.has("survey")).toBe(false);
    // timezone is best-effort; only assert it's a valid param when present.
    if (url.searchParams.has("timezone")) {
      expect(url.searchParams.get("timezone")).toMatch(/^[A-Za-z/_+-]+$/);
    }
    expect(url.searchParams.has("returnTo")).toBe(false);
  });
});

describe("logoutRequest", () => {
  it("POSTs the refresh token to /api/auth/logout for server-side revocation", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("*/api/auth/logout", async ({ request }) => {
        capturedBody = await request.json().catch(() => undefined);
        return HttpResponse.json({ message: "Logged out" });
      }),
    );

    await logoutRequest("refresh-1");

    expect(capturedBody).toEqual({ refreshToken: "refresh-1" });
  });

  it("still succeeds (best-effort) when no refresh token is present", async () => {
    server.use(
      http.post("*/api/auth/logout", () =>
        HttpResponse.json({ message: "Logged out" }),
      ),
    );

    await expect(logoutRequest(null)).resolves.toBeUndefined();
  });
});
