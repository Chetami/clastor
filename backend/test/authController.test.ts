import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Request, Response } from "express";
import type { User, UserInfo } from "@examify-tms/interfaces";

// --- Mocks ----------------------------------------------------------------
// The controllers are thin orchestrators over authService, userService and
// tokenService. We swap all three for vi.fn()s so the tests assert the
// controller's routing/branching logic without touching Firebase or Firestore.

const { verifyFirebaseToken } = vi.hoisted(() => ({
  verifyFirebaseToken: vi.fn(),
}));

const userService = vi.hoisted(() => ({
  getUserFromFirestore: vi.fn(),
  createUserInFirestore: vi.fn(),
  updateLastActive: vi.fn(),
  toUserInfo: vi.fn(),
}));

const tokenService = vi.hoisted(() => ({
  issueNewTokenPair: vi.fn(),
  rotateRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
}));

vi.mock("../src/services/authService", () => ({ verifyFirebaseToken }));
vi.mock("../src/services/userService", () => userService);
vi.mock("../src/services/tokenService", () => tokenService);

// Import AFTER the mocks are registered.
import {
  login,
  register,
  googleAuth,
  refresh,
  logout,
} from "../src/controllers/authController";

// --- Fixtures -------------------------------------------------------------

const firebaseDecoded = {
  uid: "fb-uid-1",
  email: "tutor@example.com",
  name: "Google Name",
  picture: "https://example.com/me.png",
};

const dbUser: User = {
  id: "fb-uid-1",
  name: "Test Tutor",
  email: "tutor@example.com",
  role: "tutor",
  avatarUrl: null,
  currency: "AUD",
  timezone: null,
  reminderLeadTime: null,
  workingHours: null,
  subjects: [],
  onboardingComplete: false,
  tourSeen: false,
  invoiceSettings: null,
  emailReviewSettings: null,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  lastActive: null,
} as unknown as User;

const userInfo: UserInfo = {
  uid: "fb-uid-1",
  name: "Test Tutor",
  email: "tutor@example.com",
  role: "tutor",
  avatarUrl: null,
  currency: "AUD",
  timezone: null,
  reminderLeadTime: null,
  workingHours: null,
  subjects: [],
  onboardingComplete: false,
  tourSeen: false,
  invoiceSettings: null,
  emailReviewSettings: null,
} as unknown as UserInfo;

const tokenPair = { jwtToken: "jwt-1", refreshToken: "refresh-1" };

// --- Mock req/res helpers -------------------------------------------------

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: { authorization: "Bearer firebase-id-token" },
    body: {},
    ...overrides,
  } as Request;
}

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: unknown) {
      this.body = data;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

// --- Tests ----------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  userService.toUserInfo.mockReturnValue(userInfo);
  tokenService.issueNewTokenPair.mockResolvedValue(tokenPair);
  userService.updateLastActive.mockResolvedValue(undefined);
});

describe("login controller", () => {
  it("returns 200 + tokens for an existing user", async () => {
    verifyFirebaseToken.mockResolvedValue(firebaseDecoded);
    userService.getUserFromFirestore.mockResolvedValue(dbUser);

    const res = mockRes();
    await login(mockReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ jwtToken: "jwt-1", refreshToken: "refresh-1", user: userInfo });
    expect(verifyFirebaseToken).toHaveBeenCalledWith("firebase-id-token");
    expect(tokenService.issueNewTokenPair).toHaveBeenCalledWith(dbUser);
  });

  it("returns 401 when the Firestore document does not exist", async () => {
    // This is the regression that broke sign-up before the fix: the old
    // registerRequest routed here (/api/auth/login) instead of /api/auth/register,
    // and login throws for a brand-new user with no Firestore doc.
    verifyFirebaseToken.mockResolvedValue(firebaseDecoded);
    userService.getUserFromFirestore.mockRejectedValue(new Error("User not found in Firestore"));

    const res = mockRes();
    await login(mockReq(), res);

    expect(res.statusCode).toBe(401);
    expect((res.body as { message: string }).message).toMatch(/User not found/);
    expect(tokenService.issueNewTokenPair).not.toHaveBeenCalled();
  });

  it("returns 401 when no Authorization header is provided", async () => {
    const res = mockRes();
    await login(mockReq({ headers: {} }), res);

    expect(res.statusCode).toBe(401);
    expect((res.body as { message: string }).message).toMatch(/No token provided/);
  });

  it("returns 401 when Firebase token verification fails", async () => {
    verifyFirebaseToken.mockRejectedValue(new Error("Invalid Firebase token"));

    const res = mockRes();
    await login(mockReq(), res);

    expect(res.statusCode).toBe(401);
    expect((res.body as { message: string }).message).toBe("Invalid Firebase token");
  });
});

describe("register controller", () => {
  it("creates the Firestore document and returns 200 + tokens for a new user", async () => {
    // The fix: sign-up now routes here. The controller must CREATE the user
    // (login would throw "User not found" instead).
    verifyFirebaseToken.mockResolvedValue(firebaseDecoded);
    userService.getUserFromFirestore.mockResolvedValue(null); // no existing doc
    userService.createUserInFirestore.mockResolvedValue(dbUser);

    const res = mockRes();
    await register(
      mockReq({ body: { name: "Jane Doe", timezone: "Australia/Sydney" } }) as Request<
        {},
        {},
        { name: string; timezone?: string }
      >,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ jwtToken: "jwt-1", refreshToken: "refresh-1", user: userInfo });
    expect(userService.createUserInFirestore).toHaveBeenCalledWith(
      "fb-uid-1",
      "tutor@example.com",
      "Jane Doe",
      "tutor",
      null,
      undefined,
      "Australia/Sydney",
      null,
    );
    expect(tokenService.issueNewTokenPair).toHaveBeenCalledWith(dbUser);
  });

  it("returns 409 when the user already exists", async () => {
    verifyFirebaseToken.mockResolvedValue(firebaseDecoded);
    userService.getUserFromFirestore.mockResolvedValue(dbUser);

    const res = mockRes();
    await register(
      mockReq({ body: { name: "Jane Doe" } }) as Request,
      res,
    );

    expect(res.statusCode).toBe(409);
    expect((res.body as { message: string }).message).toMatch(/already exists/);
    expect(userService.createUserInFirestore).not.toHaveBeenCalled();
    expect(tokenService.issueNewTokenPair).not.toHaveBeenCalled();
  });

  it("returns 401 when no Authorization header is provided", async () => {
    const res = mockRes();
    await register(mockReq({ headers: {}, body: { name: "Jane" } }), res);

    expect(res.statusCode).toBe(401);
  });

  it("trims the name before storing", async () => {
    verifyFirebaseToken.mockResolvedValue(firebaseDecoded);
    userService.getUserFromFirestore.mockResolvedValue(null);
    userService.createUserInFirestore.mockResolvedValue(dbUser);

    const res = mockRes();
    await register(
      mockReq({ body: { name: "  Spaced  " } }) as Request,
      res,
    );

    // createUserInFirestore(id, email, name, role, avatarUrl, currency, timezone, signupSurvey)
    expect(userService.createUserInFirestore).toHaveBeenCalledWith(
      "fb-uid-1",
      "tutor@example.com",
      "Spaced",
      "tutor",
      null,
      undefined,
      null,
      null,
    );
  });
});

describe("googleAuth controller", () => {
  it("creates a new user from the Google profile on first sign-in", async () => {
    verifyFirebaseToken.mockResolvedValue(firebaseDecoded);
    userService.getUserFromFirestore.mockResolvedValue(null); // not found -> create
    userService.createUserInFirestore.mockResolvedValue(dbUser);

    const res = mockRes();
    await googleAuth(mockReq({ body: { timezone: "Australia/Sydney" } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      jwtToken: "jwt-1",
      refreshToken: "refresh-1",
      user: userInfo,
      isNewUser: true,
    });
    // name falls back to the decoded Google name; email + picture from the token.
    expect(userService.createUserInFirestore).toHaveBeenCalledWith(
      "fb-uid-1",
      "tutor@example.com",
      "Google Name",
      "tutor",
      "https://example.com/me.png",
      undefined,
      "Australia/Sydney",
      null,
    );
    expect(tokenService.issueNewTokenPair).toHaveBeenCalledWith(dbUser);
  });

  it("logs in an existing Google user without creating a doc", async () => {
    verifyFirebaseToken.mockResolvedValue(firebaseDecoded);
    userService.getUserFromFirestore.mockResolvedValue(dbUser);

    const res = mockRes();
    await googleAuth(mockReq({ body: {} }), res);

    expect(res.statusCode).toBe(200);
    expect(userService.createUserInFirestore).not.toHaveBeenCalled();
    expect(tokenService.issueNewTokenPair).toHaveBeenCalledWith(dbUser);
    // Not a first sign-in — clients must not run signup-time flows (e.g. the
    // calendar consent prompt).
    expect((res.body as { isNewUser?: boolean }).isNewUser).toBe(false);
  });

  it("falls back to the email local-part when the profile has no name", async () => {
    verifyFirebaseToken.mockResolvedValue({ ...firebaseDecoded, name: undefined });
    userService.getUserFromFirestore.mockResolvedValue(null);
    userService.createUserInFirestore.mockResolvedValue(dbUser);

    const res = mockRes();
    await googleAuth(mockReq({ body: {} }), res);

    // name falls back to "tutor" (email local-part); no timezone in body -> null.
    expect(userService.createUserInFirestore).toHaveBeenCalledWith(
      "fb-uid-1",
      "tutor@example.com",
      "tutor",
      "tutor",
      "https://example.com/me.png",
      undefined,
      null,
      null,
    );
  });

  it("returns 401 when no Authorization header is provided", async () => {
    const res = mockRes();
    await googleAuth(mockReq({ headers: {} }), res);

    expect(res.statusCode).toBe(401);
    expect((res.body as { message: string }).message).toMatch(/No token provided/);
  });
});

describe("refresh controller", () => {
  it("returns a fresh token pair on a valid refresh token", async () => {
    tokenService.rotateRefreshToken.mockResolvedValue({
      jwtToken: "jwt-2",
      refreshToken: "refresh-2",
      user: userInfo,
    });

    const res = mockRes();
    await refresh(
      mockReq({ body: { refreshToken: "refresh-1" } }) as Request,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ jwtToken: "jwt-2", refreshToken: "refresh-2", user: userInfo });
    expect(tokenService.rotateRefreshToken).toHaveBeenCalledWith("refresh-1");
  });

  it("returns 401 when rotation throws (invalid/expired/reused)", async () => {
    tokenService.rotateRefreshToken.mockRejectedValue(new Error("Refresh token reuse detected"));

    const res = mockRes();
    await refresh(
      mockReq({ body: { refreshToken: "stale" } }) as Request,
      res,
    );

    expect(res.statusCode).toBe(401);
    expect((res.body as { message: string }).message).toBe("Refresh token reuse detected");
  });
});

describe("logout controller", () => {
  it("revokes the refresh token and always returns 200", async () => {
    tokenService.revokeRefreshToken.mockResolvedValue(undefined);

    const res = mockRes();
    await logout(
      mockReq({ body: { refreshToken: "refresh-1" } }) as Request,
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith("refresh-1");
  });

  it("still returns 200 when no refresh token is provided", async () => {
    tokenService.revokeRefreshToken.mockResolvedValue(undefined);

    const res = mockRes();
    await logout(mockReq({ body: {} }), res);

    expect(res.statusCode).toBe(200);
    expect(tokenService.revokeRefreshToken).toHaveBeenCalledWith(undefined);
  });
});
