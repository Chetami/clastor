import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { ApiError } from "@examify-tms/interfaces";
import {
  authenticateJWT,
  requireRole,
  requireSystemAdmin,
  requireTutor,
} from "../src/middleware/auth";
import { generateToken } from "../src/utils/jwt";

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response<ApiError> & {
    statusCode: number;
    body: unknown;
  };
}

function reqWithAuth(authorization?: string) {
  return { headers: { authorization } } as unknown as Request;
}

describe("authenticateJWT middleware", () => {
  it("attaches the decoded user and calls next() for a valid token", () => {
    const token = generateToken("uid-1", "a@b.com", "tutor");
    const req = reqWithAuth(`Bearer ${token}`);
    const res = mockRes();
    const next = vi.fn();

    authenticateJWT(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeDefined();
    expect(req.user!.uid).toBe("uid-1");
    expect(req.user!.role).toBe("tutor");
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 when no authorization header is present", () => {
    const req = reqWithAuth(undefined);
    const res = mockRes();
    const next = vi.fn();

    authenticateJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect((res.body as ApiError).message).toMatch(/authorization header/i);
  });

  it("returns 401 for a malformed header (no Bearer prefix)", () => {
    const req = reqWithAuth("abc.def.ghi");
    const res = mockRes();
    const next = vi.fn();

    authenticateJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect((res.body as ApiError).message).toMatch(/format/i);
  });

  it("returns 401 for an invalid signature", () => {
    const req = reqWithAuth("Bearer not.a.real.token");
    const res = mockRes();
    const next = vi.fn();

    authenticateJWT(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect((res.body as ApiError).message).toMatch(/token/i);
  });
});

describe("requireRole middleware factory", () => {
  it("calls next() when the user's role is allowed", () => {
    const req = { user: { uid: "u", role: "tutor" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requireRole("tutor", "system_admin")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  it("returns 403 when the role is not allowed", () => {
    const req = { user: { uid: "u", role: "tutor" } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requireRole("system_admin")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect((res.body as ApiError).message).toMatch(/permission/i);
  });

  it("returns 401 when there is no user on the request", () => {
    const req = {} as Request;
    const res = mockRes();
    const next = vi.fn();

    requireRole("tutor")(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect((res.body as ApiError).message).toMatch(/token/i);
  });

  it("requireSystemAdmin admits an admin and rejects a tutor", () => {
    const adminReq = { user: { role: "system_admin" } } as unknown as Request;
    const tutorReq = { user: { role: "tutor" } } as unknown as Request;
    const res = mockRes();
    const nextAdmin = vi.fn();
    const nextTutor = vi.fn();

    requireSystemAdmin(adminReq, res, nextAdmin);
    requireTutor(tutorReq, res, nextTutor);

    expect(nextAdmin).toHaveBeenCalledTimes(1);
    expect(nextTutor).toHaveBeenCalledTimes(1);

    const res2 = mockRes();
    requireSystemAdmin(tutorReq, res2, vi.fn());
    expect(res2.statusCode).toBe(403);

    const res3 = mockRes();
    requireTutor(adminReq, res3, vi.fn());
    expect(res3.statusCode).toBe(403);
  });
});
