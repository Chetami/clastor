import { describe, expect, it, beforeEach, beforeAll, vi } from "vitest";
import type { Request, Response } from "express";
import type { User, UserInfo } from "@examify-tms/interfaces";

// --- Mocks ------------------------------------------------------------------
// The controller orchestrates the OAuth client, Firebase Admin, and the
// user/token/login-code services. All are swapped for vi.fn()s so the tests
// assert the controller's branching + redirect logic without network or
// Firebase. utils/jwt is deliberately NOT mocked: states are signed and
// verified for real (JWT_SECRET comes from test/setup-env.ts).

const oauthClient = vi.hoisted(() => ({
  generateAuthUrl: vi.fn(),
  getToken: vi.fn(),
  verifyIdToken: vi.fn(),
  revokeToken: vi.fn(),
}));

vi.mock("../src/config/googleOAuth", async (importOriginal) => {
  // Keep the REAL scope constants so the redirect tests assert the actual
  // production scope configuration, not a mock's echo.
  const actual =
    await importOriginal<typeof import("../src/config/googleOAuth")>();
  return { ...actual, getOAuth2Client: () => oauthClient };
});

const firebaseAuth = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
}));

vi.mock("../src/config/firebase", () => ({
  getFirebaseAuth: () => firebaseAuth,
}));

const userService = vi.hoisted(() => ({
  setGoogleConnection: vi.fn(),
  getGoogleConnection: vi.fn(),
  clearGoogleConnection: vi.fn(),
  createUserInFirestore: vi.fn(),
  getUserFromFirestore: vi.fn(),
  // Passthrough normalizers — shape validation has its own tests in
  // userService.test.ts; here we only care that values survive the state.
  normalizeSignupSurvey: vi.fn((s: unknown) => s ?? null),
  normalizeTimezone: vi.fn((tz: unknown) => (typeof tz === "string" ? tz : null)),
  toUserInfo: vi.fn(),
  updateLastActive: vi.fn(),
}));

vi.mock("../src/services/userService", () => userService);

const tokenService = vi.hoisted(() => ({
  issueNewTokenPair: vi.fn(),
}));

vi.mock("../src/services/tokenService", () => tokenService);

const loginCodes = vi.hoisted(() => ({
  createGoogleLoginCode: vi.fn(),
  consumeGoogleLoginCode: vi.fn(),
}));

vi.mock("../src/services/googleLoginCodeService", () => loginCodes);

const calendar = vi.hoisted(() => ({
  backfillUpcomingLessons: vi.fn(),
}));

vi.mock("../src/services/googleCalendarService", () => calendar);

// Import AFTER the mocks are registered.
import {
  startGoogleLogin,
  googleAuthCallback,
  exchangeGoogleLoginCode,
  disconnectGoogle,
} from "../src/controllers/googleAuthController";
import {
  GOOGLE_LOGIN_OAUTH_SCOPES,
  GOOGLE_OAUTH_SCOPES,
} from "../src/config/googleOAuth";
import {
  signStateToken,
  signLoginStateToken,
  verifyLoginStateToken,
} from "../src/utils/jwt";

// --- Fixtures ---------------------------------------------------------------

const FRONTEND = "http://localhost:5173";
const GOOGLE_ID_TOKEN_PAYLOAD = {
  email: "tutor@example.com",
  email_verified: true,
  name: "Google Name",
  picture: "https://example.com/me.png",
};

const dbUser: User = {
  id: "uid-1",
  name: "Test Tutor",
  email: "tutor@example.com",
  role: "tutor",
} as unknown as User;

const userInfo: UserInfo = {
  uid: "uid-1",
  name: "Test Tutor",
  email: "tutor@example.com",
  role: "tutor",
} as unknown as UserInfo;

// --- Mock req/res helpers ---------------------------------------------------

function mockReq(query: Record<string, unknown> = {}, body: unknown = {}): Request {
  return { query, body } as unknown as Request;
}

function mockRes(): Response & {
  statusCode: number;
  body: unknown;
  redirectedTo: string | undefined;
} {
  const res = {
    statusCode: 200,
    redirectedTo: undefined as string | undefined,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
    redirect(url: string) {
      this.redirectedTo = url;
      this.statusCode = 302;
      return this;
    },
  };
  return res as unknown as ReturnType<typeof mockRes>;
}

/** Render generateAuthUrl calls into a parseable URL, mirroring Google's. */
function fakeAuthUrl(opts: {
  scope: string[];
  access_type?: string;
  prompt?: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    scope: opts.scope.join(" "),
    state: opts.state,
  });
  if (opts.access_type) params.set("access_type", opts.access_type);
  if (opts.prompt) params.set("prompt", opts.prompt);
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

beforeAll(() => {
  process.env.FRONTEND_URL = FRONTEND;
});

beforeEach(() => {
  vi.clearAllMocks();
  oauthClient.generateAuthUrl.mockImplementation(fakeAuthUrl as never);
  tokenService.issueNewTokenPair.mockResolvedValue({
    jwtToken: "jwt-1",
    refreshToken: "refresh-1",
  });
  userService.toUserInfo.mockReturnValue(userInfo);
  userService.updateLastActive.mockResolvedValue(undefined);
  userService.getUserFromFirestore.mockResolvedValue(dbUser);
  userService.setGoogleConnection.mockResolvedValue(undefined);
  userService.createUserInFirestore.mockResolvedValue(dbUser);
  firebaseAuth.getUserByEmail.mockResolvedValue({ uid: "uid-1" });
  loginCodes.createGoogleLoginCode.mockResolvedValue("otc-1");
  calendar.backfillUpcomingLessons.mockResolvedValue(undefined);
  userService.getGoogleConnection.mockResolvedValue(null);
  userService.clearGoogleConnection.mockResolvedValue(undefined);
  oauthClient.revokeToken.mockResolvedValue({ data: "" });
});

// --- Scope configuration ----------------------------------------------------

describe("Google OAuth scope configuration", () => {
  it("the login flow requests Calendar write access", () => {
    // Calendar sync + event writes both run through calendar.events.
    expect(GOOGLE_LOGIN_OAUTH_SCOPES).toContain(
      "https://www.googleapis.com/auth/calendar.events",
    );
  });

  it("the login flow requests Calendar access for Google Meet too", () => {
    // Meet links are provisioned by attaching conferenceData with a
    // "hangoutsMeet" solution to a Calendar event (see meetService.ts /
    // googleCalendarService.ts) — there is no separate Meet OAuth scope, so
    // calendar.events IS the Meet grant. Signing in therefore confers both.
    expect(GOOGLE_LOGIN_OAUTH_SCOPES).toContain(
      "https://www.googleapis.com/auth/calendar.events",
    );
    expect(
      GOOGLE_LOGIN_OAUTH_SCOPES.filter((s) => s.includes("meet")),
    ).toEqual([]);
  });

  it("the login flow requests identity scopes for signup", () => {
    expect(GOOGLE_LOGIN_OAUTH_SCOPES).toContain("openid");
    expect(GOOGLE_LOGIN_OAUTH_SCOPES).toContain("email");
    expect(GOOGLE_LOGIN_OAUTH_SCOPES).toContain("profile");
  });

  it("the login flow is a superset of the connect flow's scopes", () => {
    for (const scope of GOOGLE_OAUTH_SCOPES) {
      expect(GOOGLE_LOGIN_OAUTH_SCOPES).toContain(scope);
    }
  });
});

// --- GET /api/auth/google/start ---------------------------------------------

describe("startGoogleLogin", () => {
  it("302-redirects the browser to Google's authorization endpoint", () => {
    const res = mockRes();
    startGoogleLogin(mockReq(), res);

    expect(res.statusCode).toBe(302);
    expect(res.redirectedTo).toMatch(/^https:\/\/accounts\.google\.com\//);
  });

  it("requests offline access WITHOUT forcing the consent interstitial", () => {
    const res = mockRes();
    startGoogleLogin(mockReq(), res);

    const url = new URL(res.redirectedTo!);
    // access_type=offline → Google issues a refresh token for Calendar sync.
    expect(url.searchParams.get("access_type")).toBe("offline");
    // select_account (not "consent") → returning users skip the full consent
    // page; this is what keeps the merged flow to a single Google screen.
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });

  it("requests the Calendar scope (Calendar + Meet access) in the URL", () => {
    const res = mockRes();
    startGoogleLogin(mockReq(), res);

    const scope = new URL(res.redirectedTo!).searchParams.get("scope")!;
    expect(scope.split(" ")).toContain(
      "https://www.googleapis.com/auth/calendar.events",
    );
  });

  it("carries returnTo, timezone and survey through the signed state", () => {
    const survey = { intent: "independent_tutor", currentTools: ["paper"] };
    const res = mockRes();
    startGoogleLogin(
      mockReq({
        returnTo: "/onboarding",
        timezone: "Australia/Sydney",
        survey: JSON.stringify(survey),
      }),
      res,
    );

    const state = new URL(res.redirectedTo!).searchParams.get("state")!;
    const decoded = verifyLoginStateToken(state);
    expect(decoded).not.toBeNull();
    expect(decoded!.returnTo).toBe("/onboarding");
    expect(decoded!.timezone).toBe("Australia/Sydney");
    expect(decoded!.survey).toEqual(survey);
  });

  it("degrades an open-redirect returnTo to a safe default", () => {
    const res = mockRes();
    startGoogleLogin(mockReq({ returnTo: "//evil.example.com" }), res);

    const state = new URL(res.redirectedTo!).searchParams.get("state")!;
    expect(verifyLoginStateToken(state)!.returnTo).toBe("/settings");
  });

  it("redirects to the frontend error page when OAuth isn't configured", () => {
    oauthClient.generateAuthUrl.mockImplementation(() => {
      throw new Error("Google OAuth is not configured.");
    });

    const res = mockRes();
    startGoogleLogin(mockReq(), res);

    expect(res.redirectedTo).toBe(
      `${FRONTEND}/auth/google/callback?error=server_error`,
    );
  });
});

// --- GET /api/auth/google/callback (login mode) ------------------------------

function loginStateQuery(overrides: Record<string, unknown> = {}) {
  return {
    code: "google-auth-code",
    state: signLoginStateToken({
      returnTo: "/dashboard",
      timezone: "Australia/Sydney",
      survey: { intent: "independent_tutor", currentTools: [] },
    }),
    ...overrides,
  };
}

function mockGoogleTokens(overrides: Record<string, unknown> = {}) {
  oauthClient.getToken.mockResolvedValue({
    tokens: {
      id_token: "google-id-token",
      refresh_token: "google-refresh-token",
      ...overrides,
    },
  });
  oauthClient.verifyIdToken.mockResolvedValue({
    getPayload: () => GOOGLE_ID_TOKEN_PAYLOAD,
  });
}

describe("googleAuthCallback (login mode)", () => {
  it("exchanges the code, connects Calendar, and redirects with a one-time code", async () => {
    mockGoogleTokens();

    const res = mockRes();
    await googleAuthCallback(mockReq(loginStateQuery()), res);

    // Tokens never travel in the URL — only the single-use code.
    expect(res.redirectedTo).toBe(
      `${FRONTEND}/auth/google/callback?code=otc-1&returnTo=%2Fdashboard`,
    );
    expect(res.redirectedTo).not.toContain("google-refresh-token");

    expect(oauthClient.getToken).toHaveBeenCalledWith("google-auth-code");
    // The Google ID token is verified against this OAuth client's audience.
    expect(oauthClient.verifyIdToken).toHaveBeenCalledWith({
      idToken: "google-id-token",
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID,
    });

    // The offline grant (Calendar + Meet) is persisted for the tutor.
    expect(userService.setGoogleConnection).toHaveBeenCalledWith("uid-1", {
      refreshToken: "google-refresh-token",
      googleEmail: "tutor@example.com",
    });
    expect(calendar.backfillUpcomingLessons).toHaveBeenCalledWith("uid-1");
    expect(loginCodes.createGoogleLoginCode).toHaveBeenCalledWith({
      uid: "uid-1",
      isNewUser: false,
    });
  });

  it("signs in an existing email/password user onto their SAME account", async () => {
    mockGoogleTokens();

    const res = mockRes();
    await googleAuthCallback(mockReq(loginStateQuery()), res);

    expect(firebaseAuth.getUserByEmail).toHaveBeenCalledWith(
      "tutor@example.com",
    );
    expect(firebaseAuth.createUser).not.toHaveBeenCalled();
    expect(userService.createUserInFirestore).not.toHaveBeenCalled();
  });

  it("creates the Firebase + Firestore user on first-ever sign-in", async () => {
    mockGoogleTokens();
    firebaseAuth.getUserByEmail.mockRejectedValue({
      code: "auth/user-not-found",
    });
    firebaseAuth.createUser.mockResolvedValue({ uid: "uid-new" });
    userService.getUserFromFirestore.mockRejectedValue(new Error("not found"));
    userService.createUserInFirestore.mockResolvedValue({
      ...dbUser,
      id: "uid-new",
    });

    const res = mockRes();
    await googleAuthCallback(mockReq(loginStateQuery()), res);

    expect(firebaseAuth.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "tutor@example.com",
        // Google already verified the address — no verification email loop.
        emailVerified: true,
        displayName: "Google Name",
        photoURL: "https://example.com/me.png",
      }),
    );
    expect(userService.createUserInFirestore).toHaveBeenCalledWith(
      "uid-new",
      "tutor@example.com",
      "Google Name",
      "tutor",
      "https://example.com/me.png",
      undefined,
      "Australia/Sydney",
      { intent: "independent_tutor", currentTools: [] },
    );
    expect(loginCodes.createGoogleLoginCode).toHaveBeenCalledWith({
      uid: "uid-new",
      isNewUser: true,
    });
  });

  it("resolves a createUser race onto the winner's account", async () => {
    mockGoogleTokens();
    firebaseAuth.getUserByEmail
      .mockRejectedValueOnce({ code: "auth/user-not-found" })
      .mockResolvedValueOnce({ uid: "uid-winner" });
    firebaseAuth.createUser.mockRejectedValue({
      code: "auth/email-already-exists",
    });
    userService.getUserFromFirestore.mockResolvedValue({
      ...dbUser,
      id: "uid-winner",
    });

    const res = mockRes();
    await googleAuthCallback(mockReq(loginStateQuery()), res);

    expect(loginCodes.createGoogleLoginCode).toHaveBeenCalledWith({
      uid: "uid-winner",
      isNewUser: false,
    });
  });

  it("still signs in when Google omits a refresh token (prior grant)", async () => {
    // A user who authorized this client before (e.g. via the old popup flow)
    // gets no refresh_token back — login must succeed, just without the
    // Calendar connection (they can force one from Settings).
    mockGoogleTokens({ refresh_token: undefined });

    const res = mockRes();
    await googleAuthCallback(mockReq(loginStateQuery()), res);

    expect(res.redirectedTo).toContain("code=otc-1");
    expect(userService.setGoogleConnection).not.toHaveBeenCalled();
    expect(calendar.backfillUpcomingLessons).not.toHaveBeenCalled();
  });

  it("redirects with error=denied when the user rejects consent", async () => {
    const res = mockRes();
    await googleAuthCallback(
      mockReq(loginStateQuery({ code: undefined, error: "access_denied" })),
      res,
    );

    expect(res.redirectedTo).toBe(
      `${FRONTEND}/auth/google/callback?error=denied`,
    );
    expect(oauthClient.getToken).not.toHaveBeenCalled();
  });

  it("refuses to federate an unverified Google email", async () => {
    mockGoogleTokens();
    oauthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        ...GOOGLE_ID_TOKEN_PAYLOAD,
        email_verified: false,
      }),
    });

    const res = mockRes();
    await googleAuthCallback(mockReq(loginStateQuery()), res);

    expect(res.redirectedTo).toBe(
      `${FRONTEND}/auth/google/callback?error=email_not_verified`,
    );
    expect(userService.setGoogleConnection).not.toHaveBeenCalled();
    expect(loginCodes.createGoogleLoginCode).not.toHaveBeenCalled();
  });

  it("redirects with error=server_error when the token exchange fails", async () => {
    oauthClient.getToken.mockRejectedValue(new Error("invalid_grant"));

    const res = mockRes();
    await googleAuthCallback(mockReq(loginStateQuery()), res);

    expect(res.redirectedTo).toBe(
      `${FRONTEND}/auth/google/callback?error=server_error`,
    );
  });
});

// --- GET /api/auth/google/callback (connect mode — Settings flow) ------------

describe("googleAuthCallback (connect mode)", () => {
  it("still serves the authenticated Settings connect flow unchanged", async () => {
    mockGoogleTokens();

    const res = mockRes();
    await googleAuthCallback(
      mockReq({
        code: "google-auth-code",
        state: signStateToken("uid-9", "/settings"),
      }),
      res,
    );

    expect(res.redirectedTo).toBe(`${FRONTEND}/settings?google=connected`);
    // Connect mode reads the email from the raw id_token payload; the fake
    // token in tests doesn't decode, so googleEmail degrades to "".
    expect(userService.setGoogleConnection).toHaveBeenCalledWith("uid-9", {
      refreshToken: "google-refresh-token",
      googleEmail: "",
    });
  });

  it("flags a missing refresh token for the connect flow", async () => {
    mockGoogleTokens({ refresh_token: undefined });

    const res = mockRes();
    await googleAuthCallback(
      mockReq({
        code: "google-auth-code",
        state: signStateToken("uid-9", "/settings"),
      }),
      res,
    );

    expect(res.redirectedTo).toBe(
      `${FRONTEND}/settings?google=no_refresh_token`,
    );
  });
});

// --- POST /api/auth/google/exchange -----------------------------------------

describe("exchangeGoogleLoginCode", () => {
  it("swaps a valid one-time code for the token pair + isNewUser", async () => {
    loginCodes.consumeGoogleLoginCode.mockResolvedValue({
      uid: "uid-1",
      isNewUser: true,
    });

    const res = mockRes();
    await exchangeGoogleLoginCode(mockReq({}, { code: "otc-1" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      jwtToken: "jwt-1",
      refreshToken: "refresh-1",
      user: userInfo,
      isNewUser: true,
    });
    expect(loginCodes.consumeGoogleLoginCode).toHaveBeenCalledWith("otc-1");
    expect(tokenService.issueNewTokenPair).toHaveBeenCalledWith(dbUser);
  });

  it("returns 401 for an unknown, used, or expired code", async () => {
    loginCodes.consumeGoogleLoginCode.mockResolvedValue(null);

    const res = mockRes();
    await exchangeGoogleLoginCode(mockReq({}, { code: "burned" }), res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      message: "Invalid or expired sign-in code. Please try again.",
    });
  });

  it("returns 401 when the body has no code", async () => {
    const res = mockRes();
    await exchangeGoogleLoginCode(mockReq({}, {}), res);

    expect(res.statusCode).toBe(401);
    expect(loginCodes.consumeGoogleLoginCode).not.toHaveBeenCalled();
  });
});

// --- Google token revocation (disconnect / reconnect) ------------------------

describe("Google token revocation", () => {
  describe("disconnectGoogle (DELETE /api/auth/google)", () => {
    it("clears the connection AND revokes the grant at Google", async () => {
      userService.getGoogleConnection.mockResolvedValue({
        refreshToken: "stored-rt",
        googleEmail: "tutor@example.com",
        connectedAt: new Date(),
      });

      const res = mockRes();
      await disconnectGoogle(
        { user: { uid: "uid-1" } } as unknown as Request,
        res,
      );

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ connected: false });
      expect(userService.clearGoogleConnection).toHaveBeenCalledWith("uid-1");
      expect(oauthClient.revokeToken).toHaveBeenCalledWith("stored-rt");
    });

    it("succeeds when there was no connection to begin with", async () => {
      userService.getGoogleConnection.mockResolvedValue(null);

      const res = mockRes();
      await disconnectGoogle(
        { user: { uid: "uid-1" } } as unknown as Request,
        res,
      );

      expect(res.statusCode).toBe(200);
      expect(userService.clearGoogleConnection).toHaveBeenCalledWith("uid-1");
      expect(oauthClient.revokeToken).not.toHaveBeenCalled();
    });

    it("succeeds even when Google's revoke endpoint is unreachable", async () => {
      // Best-effort: local state is the source of truth and is already
      // cleared, so a Google outage must not fail the disconnect.
      userService.getGoogleConnection.mockResolvedValue({
        refreshToken: "stored-rt",
        googleEmail: null,
        connectedAt: new Date(),
      });
      oauthClient.revokeToken.mockRejectedValue(new Error("network down"));

      const res = mockRes();
      await disconnectGoogle(
        { user: { uid: "uid-1" } } as unknown as Request,
        res,
      );

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ connected: false });
    });

    it("returns 401 without a user", async () => {
      const res = mockRes();
      await disconnectGoogle({} as Request, res);

      expect(res.statusCode).toBe(401);
      expect(userService.clearGoogleConnection).not.toHaveBeenCalled();
    });
  });

  describe("reconnect overwriting a previous grant (login mode)", () => {
    it("revokes the superseded refresh token after storing the new one", async () => {
      mockGoogleTokens();
      userService.getGoogleConnection.mockResolvedValue({
        refreshToken: "old-rt",
        googleEmail: "tutor@example.com",
        connectedAt: new Date(),
      });

      const res = mockRes();
      await googleAuthCallback(mockReq(loginStateQuery()), res);

      expect(res.redirectedTo).toContain("code=otc-1");
      expect(userService.setGoogleConnection).toHaveBeenCalledWith("uid-1", {
        refreshToken: "google-refresh-token",
        googleEmail: "tutor@example.com",
      });
      expect(oauthClient.revokeToken).toHaveBeenCalledWith("old-rt");
    });

    it("does NOT revoke when Google re-issued the same refresh token", async () => {
      // Google occasionally returns an identical refresh token for a
      // re-grant — revoking "old" would kill the connection just stored.
      mockGoogleTokens();
      userService.getGoogleConnection.mockResolvedValue({
        refreshToken: "google-refresh-token",
        googleEmail: "tutor@example.com",
        connectedAt: new Date(),
      });

      const res = mockRes();
      await googleAuthCallback(mockReq(loginStateQuery()), res);

      expect(res.redirectedTo).toContain("code=otc-1");
      expect(oauthClient.revokeToken).not.toHaveBeenCalled();
    });

    it("revokes the superseded token in the connect (Settings) flow too", async () => {
      mockGoogleTokens();
      userService.getGoogleConnection.mockResolvedValue({
        refreshToken: "old-rt",
        googleEmail: null,
        connectedAt: new Date(),
      });

      const res = mockRes();
      await googleAuthCallback(
        mockReq({
          code: "google-auth-code",
          state: signStateToken("uid-9", "/settings"),
        }),
        res,
      );

      expect(res.redirectedTo).toBe(`${FRONTEND}/settings?google=connected`);
      expect(oauthClient.revokeToken).toHaveBeenCalledWith("old-rt");
    });
  });
});
