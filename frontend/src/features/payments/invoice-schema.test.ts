import { describe, it, expect } from "vitest";
import {
  createInvoiceFormSchema,
  type CreateInvoiceFormData,
} from "@examify-tms/shared";

const validLineItem = {
  lessonId: "lesson_1",
  description: "Mathematics — 60 min on 20 Jun 2026",
  durationMinutes: 60,
  rateType: "hourly" as const,
  unitAmount: 60,
  quantity: 1,
};

/** A complete, valid form — tests spread + delete fields to break things. */
function validForm(): CreateInvoiceFormData {
  return {
    studentId: "stu_1",
    lineItems: [validLineItem],
    dueDate: "2026-07-04",
    paymentMethod: "bank_transfer",
  };
}

describe("createInvoiceFormSchema", () => {
  it("accepts a valid form and defaults status to draft", () => {
    const result = createInvoiceFormSchema.safeParse(validForm());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("draft");
    }
  });

  it("accepts an explicitly finalised status", () => {
    const result = createInvoiceFormSchema.safeParse({
      ...validForm(),
      status: "open",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe("open");
  });

  it("rejects a missing student", () => {
    const result = createInvoiceFormSchema.safeParse({
      ...validForm(),
      studentId: "",
    });
    expect(result.success).toBe(false);
    expect(
      result.success ? null : result.error.issues.some((i) =>
        i.message.includes("student"),
      ),
    ).toBe(true);
  });

  it("rejects an empty line-item list", () => {
    const result = createInvoiceFormSchema.safeParse({
      ...validForm(),
      lineItems: [],
    });
    expect(result.success).toBe(false);
    expect(
      result.success ? null : result.error.issues.some((i) =>
        i.message.includes("lesson"),
      ),
    ).toBe(true);
  });

  it("rejects a zero-amount line item", () => {
    const result = createInvoiceFormSchema.safeParse({
      ...validForm(),
      lineItems: [{ ...validLineItem, unitAmount: 0 }],
    });
    expect(result.success).toBe(false);
    expect(
      result.success ? null : result.error.issues.some((i) =>
        i.path.includes("unitAmount"),
      ),
    ).toBe(true);
  });

  it("rejects a malformed billing email override", () => {
    const result = createInvoiceFormSchema.safeParse({
      ...validForm(),
      billingEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
    expect(
      result.success ? null : result.error.issues.some((i) =>
        i.message.includes("email"),
      ),
    ).toBe(true);
  });

  it("allows an empty billing email (falls back server-side)", () => {
    const result = createInvoiceFormSchema.safeParse({
      ...validForm(),
      billingEmail: "",
    });
    expect(result.success).toBe(true);
  });
});
