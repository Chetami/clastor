import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "@examify-tms/interfaces";
import {
  generateToken,
  verifyToken,
  extractToken,
  generateJti,
  generateRefreshToken,
  verifyRefreshToken,
  signStateToken,
  verifyStateToken,
  signRsvpToken,
  verifyRsvpToken,
} from "../src/utils/jwt";

const UID = "user-abc";
const EMAIL = "tutor@example.com";

describe("jwt utils", () => {
  describe("access tokens (generateToken / verifyToken)", () => {
    it("round-trips uid, email and role", () => {
      const token = generateToken(UID, EMAIL, "tutor");
      const decoded = verifyToken(token) as JwtPayload;
      expect(decoded.uid).toBe(UID);
      expect(decoded.email).toBe(EMAIL);
      expect(decoded.role).toBe("tutor");
    });

    it("includes standard iat/exp claims", () => {
      const token = generateToken(UID, EMAIL, "system_admin");
      const decoded = verifyToken(token) as JwtPayload;
      expect(typeof decoded.iat).toBe("number");
      expect(typeof decoded.exp).toBe("number");
      expect(decoded.exp!).toBeGreaterThan(decoded.iat!);
    });

    it("works for the system_admin role", () => {
      const token = generateToken(UID, EMAIL, "system_admin");
      expect(verifyToken(token).role).toBe("system_admin");
    });

    it("rejects a garbage string", () => {
      expect(() => verifyToken("not-a-token")).toThrow();
      expect(() => verifyToken("")).toThrow();
    });

    it("rejects a token signed with the wrong secret", () => {
      const forged = jwt.sign({ uid: UID, email: EMAIL, role: "tutor" }, "wrong-secret");
      expect(() => verifyToken(forged)).toThrow("Invalid or expired token");
    });

    it("rejects an expired token", () => {
      const expired = jwt.sign(
        { uid: UID, email: EMAIL, role: "tutor", exp: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production",
      );
      expect(() => verifyToken(expired)).toThrow("Invalid or expired token");
    });
  });

  describe("extractToken", () => {
    it("pulls the token out of a Bearer header", () => {
      expect(extractToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    });

    it("throws when no header is provided", () => {
      expect(() => extractToken(undefined)).toThrow("No authorization header provided");
    });

    it("throws on a non-Bearer header", () => {
      expect(() => extractToken("Basic abc")).toThrow("Invalid authorization header format");
      expect(() => extractToken("abc.def.ghi")).toThrow("Invalid authorization header format");
    });
  });

  describe("generateJti", () => {
    it("returns a 48-char hex string (24 bytes)", () => {
      const jti = generateJti();
      expect(jti).toMatch(/^[0-9a-f]{48}$/);
    });

    it("produces unique values", () => {
      const a = generateJti();
      const b = generateJti();
      expect(a).not.toBe(b);
    });
  });

  describe("refresh tokens", () => {
    it("round-trips uid, familyId and jti", () => {
      const token = generateRefreshToken(UID, "fam-1", "jti-1");
      const decoded = verifyRefreshToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.uid).toBe(UID);
      expect(decoded!.familyId).toBe("fam-1");
      expect(decoded!.jti).toBe("jti-1");
    });

    it("returns null for a garbage token", () => {
      expect(verifyRefreshToken("nope")).toBeNull();
      expect(verifyRefreshToken("")).toBeNull();
    });

    it("returns null for a token signed with the access-token secret", () => {
      // Refresh and access tokens use different secrets: a refresh token must
      // not verify as an access token, and vice-versa.
      const access = generateToken(UID, EMAIL, "tutor");
      expect(() => verifyToken(access)).not.toThrow();
      // And an access token must not be accepted as a refresh token.
      expect(verifyRefreshToken(access)).toBeNull();
    });

    it("returns null when a required claim is missing", () => {
      // Signed with the refresh secret but missing familyId/jti.
      const refreshSecret =
        process.env.REFRESH_TOKEN_SECRET ||
        "your-super-secret-refresh-key-change-in-production";
      const bad = jwt.sign({ uid: UID }, refreshSecret);
      expect(verifyRefreshToken(bad)).toBeNull();
    });
  });

  describe("state tokens (Google OAuth redirect)", () => {
    it("round-trips the uid", () => {
      const token = signStateToken(UID);
      const decoded = verifyStateToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.uid).toBe(UID);
      expect(decoded!.returnTo).toBeNull();
    });

    it("carries an optional returnTo path", () => {
      const token = signStateToken(UID, "/onboarding/google");
      const decoded = verifyStateToken(token);
      expect(decoded!.returnTo).toBe("/onboarding/google");
    });

    it("returns null for undefined / garbage", () => {
      expect(verifyStateToken(undefined)).toBeNull();
      expect(verifyStateToken("garbage")).toBeNull();
    });
  });

  describe("RSVP tokens (lesson invite)", () => {
    it("round-trips lessonId and version", () => {
      const token = signRsvpToken("lesson_123", 3);
      const decoded = verifyRsvpToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.lessonId).toBe("lesson_123");
      expect(decoded!.version).toBe(3);
    });

    it("returns null for undefined / garbage", () => {
      expect(verifyRsvpToken(undefined)).toBeNull();
      expect(verifyRsvpToken("garbage")).toBeNull();
    });

    it("returns null when a claim has the wrong type", () => {
      // version present but as a string, not a number -> rejected.
      const secret = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
      const bad = jwt.sign({ lid: "lesson_1", v: "3" }, secret);
      expect(verifyRsvpToken(bad)).toBeNull();
    });
  });
});
