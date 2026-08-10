import { describe, expect, it, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { ApiError } from "@examify-tms/interfaces";
import { validateRequest } from "../src/middleware/validateRequest";
import {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  isAppError,
} from "../src/utils/AppError";
import {
  createLessonSchema,
  createRecurringLessonSchema,
  createStudentSchema,
  createInvoiceSchema,
  recordAttendanceSchema,
  updateUserSchema,
  registerSchema,
  createFeedbackSchema,
  periodQuerySchema,
} from "../src/schemas";

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

function runMiddleware(
  schema: Parameters<typeof validateRequest>[0],
  req: Partial<Request>,
) {
  const res = mockRes();
  const next = vi.fn();
  validateRequest(schema)(req as Request, res, next as NextFunction);
  return { res, next };
}

describe("AppError hierarchy", () => {
  it.each([
    [new BadRequestError("bad"), 400],
    [new UnauthorizedError("nope"), 401],
    [new ForbiddenError("no"), 403],
    [new NotFoundError("missing"), 404],
    [new ConflictError("clash"), 409],
    [new ServiceUnavailableError("down"), 503],
    [new AppError("hmm", 418), 418],
  ])("%s maps to statusCode %i", (err, status) => {
    expect(err.statusCode).toBe(status);
    expect(err.message).toBeTruthy();
    expect(isAppError(err)).toBe(true);
  });

  it("isAppError returns false for plain errors", () => {
    expect(isAppError(new Error("plain"))).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("validateRequest middleware", () => {
  it("passes through and rewrites req.body when valid", () => {
    const req = {
      body: {
        studentId: "stu_1",
        startDateTime: "2026-06-20T09:00:00.000Z",
        durationMinutes: 60,
      },
    };
    const { res, next } = runMiddleware(
      { body: createLessonSchema },
      req,
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    // default applied
    expect((req.body as any).remindersEnabled).toBe(true);
  });

  it("rejects an invalid body with a structured 400 and does not call next", () => {
    const req = {
      body: { studentId: "stu_1", startDateTime: "not-a-date" },
    };
    const { res, next } = runMiddleware({ body: createLessonSchema }, req);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    const body = res.body as ApiError & { errors?: unknown[] };
    expect(body.message).toBe("Validation failed");
    expect(Array.isArray(body.errors)).toBe(true);
    expect((body.errors as unknown[]).length).toBeGreaterThan(0);
  });

  it("strips unknown keys (guards against mass-assignment)", () => {
    const req = {
      body: {
        attendanceStatus: "present",
        // a client attempting to set a server-only field
        tutorId: "attacker_uid",
      },
    };
    const { next } = runMiddleware({ body: recordAttendanceSchema }, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req.body as any).tutorId).toBeUndefined();
    expect((req.body as any).attendanceStatus).toBe("present");
  });

  it("validates query params and rewrites req.query", () => {
    const req = { query: { period: "month" } };
    const { next } = runMiddleware({ query: periodQuerySchema }, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req.query as any).period).toBe("month");
  });

  it("defaults an invalid/missing query value via catch+default", () => {
    const req = { query: { period: "bogus" } };
    const { next } = runMiddleware({ query: periodQuerySchema }, req);
    expect(next).toHaveBeenCalledTimes(1);
    expect((req.query as any).period).toBe("week");
  });
});

describe("domain request schemas", () => {
  describe("createStudentSchema", () => {
    it("accepts a valid student", () => {
      const out = createStudentSchema.parse({
        name: "Alice",
        email: "alice@example.com",
        subjectIds: ["s1"],
        expectedAmount: 45,
        rateType: "hourly",
        frequencyPerWeek: 2,
      });
      expect(out.status).toBe("active"); // default
      expect(out.subjectIds).toEqual(["s1"]);
    });

    it("rejects an invalid email", () => {
      const r = createStudentSchema.safeParse({
        name: "Alice",
        email: "not-an-email",
        subjectIds: [],
        expectedAmount: 0,
        rateType: "hourly",
        frequencyPerWeek: 0,
      });
      expect(r.success).toBe(false);
    });

    it("rejects an unknown rateType", () => {
      const r = createStudentSchema.safeParse({
        name: "Alice",
        email: "a@b.com",
        subjectIds: [],
        expectedAmount: 0,
        rateType: "daily",
        frequencyPerWeek: 0,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("createRecurringLessonSchema", () => {
    const base = {
      studentId: "stu_1",
      durationMinutes: 60,
      intervalWeeks: 1,
      slots: [{ dayOfWeek: "monday", timeOfDay: "16:00" }],
      timezone: "Australia/Sydney",
      startDate: "2026-06-23",
    };

    it("accepts exactly one of until/count (until)", () => {
      expect(
        createRecurringLessonSchema.safeParse({ ...base, until: "2026-08-29" })
          .success,
      ).toBe(true);
    });

    it("accepts exactly one of until/count (count)", () => {
      expect(createRecurringLessonSchema.safeParse({ ...base, count: 12 }).success).toBe(true);
    });

    it("rejects when neither until nor count is provided", () => {
      expect(createRecurringLessonSchema.safeParse(base).success).toBe(false);
    });

    it("rejects when both until and count are provided", () => {
      expect(
        createRecurringLessonSchema.safeParse({
          ...base,
          until: "2026-08-29",
          count: 12,
        }).success,
      ).toBe(false);
    });

    it("rejects an empty slots array", () => {
      expect(
        createRecurringLessonSchema.safeParse({ ...base, until: "2026-08-29", slots: [] })
          .success,
      ).toBe(false);
    });

    it("rejects a malformed timeOfDay", () => {
      expect(
        createRecurringLessonSchema.safeParse({
          ...base,
          until: "2026-08-29",
          slots: [{ dayOfWeek: "monday", timeOfDay: "9" }],
        }).success,
      ).toBe(false);
    });
  });

  describe("createInvoiceSchema", () => {
    const base = {
      studentId: "stu_1",
      lineItems: [
        {
          lessonId: "les_1",
          description: "Maths — 60 min",
          durationMinutes: 60,
          rateType: "hourly",
          unitAmount: 45,
          quantity: 1,
        },
      ],
      dueDate: "2026-07-20T00:00:00.000Z",
      paymentMethod: "bank_transfer",
    };

    it("accepts a valid invoice", () => {
      expect(createInvoiceSchema.safeParse(base).success).toBe(true);
    });

    it("rejects an empty lineItems array", () => {
      expect(createInvoiceSchema.safeParse({ ...base, lineItems: [] }).success).toBe(false);
    });

    it("rejects an unknown paymentMethod", () => {
      expect(
        createInvoiceSchema.safeParse({ ...base, paymentMethod: "crypto" }).success,
      ).toBe(false);
    });
  });

  describe("updateUserSchema", () => {
    it("accepts a partial update", () => {
      expect(updateUserSchema.safeParse({ name: "New Name" }).success).toBe(true);
    });

    it("accepts null to clear working hours", () => {
      expect(updateUserSchema.safeParse({ workingHours: null }).success).toBe(true);
    });

    it("accepts a full working-hours object", () => {
      expect(
        updateUserSchema.safeParse({
          workingHours: {
            monday: { start: "09:00", end: "17:00" },
            tuesday: null,
          },
        }).success,
      ).toBe(true);
    });

    it("accepts { reviewEnabled: false } for emailReviewSettings", () => {
      expect(
        updateUserSchema.safeParse({
          emailReviewSettings: { reviewEnabled: false },
        }).success,
      ).toBe(true);
    });

    it("accepts null to clear emailReviewSettings", () => {
      expect(
        updateUserSchema.safeParse({ emailReviewSettings: null }).success,
      ).toBe(true);
    });

    it("accepts an empty object for emailReviewSettings", () => {
      expect(
        updateUserSchema.safeParse({ emailReviewSettings: {} }).success,
      ).toBe(true);
    });

    it("rejects a non-boolean reviewEnabled", () => {
      expect(
        updateUserSchema.safeParse({
          emailReviewSettings: { reviewEnabled: "yes" },
        }).success,
      ).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("trims and requires a non-empty name", () => {
      const out = registerSchema.parse({ name: "  Jane  " });
      expect(out.name).toBe("Jane");
    });

    it("rejects an empty name", () => {
      expect(registerSchema.safeParse({ name: "   " }).success).toBe(false);
    });

    it("rejects a name over 100 chars", () => {
      expect(registerSchema.safeParse({ name: "x".repeat(101) }).success).toBe(false);
    });
  });

  describe("createFeedbackSchema", () => {
    it("accepts a valid submission", () => {
      expect(
        createFeedbackSchema.safeParse({ type: "bug", message: "it broke" }).success,
      ).toBe(true);
    });

    it("rejects an unknown feedback type", () => {
      expect(
        createFeedbackSchema.safeParse({ type: "complaint", message: "x" }).success,
      ).toBe(false);
    });

    it("rejects an empty message", () => {
      expect(createFeedbackSchema.safeParse({ type: "bug", message: "" }).success).toBe(false);
    });
  });
});
