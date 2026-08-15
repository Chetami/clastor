import { describe, expect, it } from "vitest";
import {
  EMPTY_STUDENT_FORM,
  formToCreateRequest,
  formToUpdateRequest,
  studentFormSchema,
} from "./student-schema";

/** Valid, complete form — override per test. */
function form(overrides: Partial<typeof EMPTY_STUDENT_FORM> = {}) {
  return {
    ...EMPTY_STUDENT_FORM,
    subjectIds: ["subj_1"],
    ...overrides,
  };
}

describe("studentFormSchema", () => {
  it("rejects a whitespace-only name", () => {
    // Regression: `min(1).trim()` let " " pass and submitted an empty name.
    const result = studentFormSchema.safeParse(form({ name: "   " }));
    expect(result.success).toBe(false);
  });

  it("trims a valid name", () => {
    const result = studentFormSchema.safeParse(form({ name: "  Ada  " }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Ada");
  });

  it("requires a subject", () => {
    const result = studentFormSchema.safeParse(
      form({ subjectIds: [] as string[] }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts a fully valid form", () => {
    const result = studentFormSchema.safeParse(
      form({ name: "Ada", email: "ada@example.com" }),
    );
    expect(result.success).toBe(true);
  });
});

describe("formToCreateRequest", () => {
  it("maps empty optional fields to null (create schema is nullish)", () => {
    const req = formToCreateRequest(
      form({ name: "Ada", subjectIds: ["s1"], expectedAmount: 50 }),
    );
    expect(req.name).toBe("Ada");
    expect(req.email).toBeNull();
    expect(req.phone).toBeNull();
    expect(req.parentEmail).toBeNull();
    expect(req.billingEmail).toBeNull();
    expect(req.timezone).toBeNull();
    expect(req.notes).toBeNull();
  });

  it("keeps an explicit custom billing email and timezone", () => {
    const req = formToCreateRequest(
      form({
        billingEmailMode: "custom",
        billingEmail: "billing@example.com",
        timezoneEnabled: true,
        timezone: "Australia/Sydney",
      }),
    );
    expect(req.billingEmail).toBe("billing@example.com");
    expect(req.timezone).toBe("Australia/Sydney");
  });
});

describe("formToUpdateRequest", () => {
  it("maps auto billing mode to null (clears the override)", () => {
    const req = formToUpdateRequest(form({ billingEmailMode: "auto" }));
    expect(req.billingEmail).toBeNull();
  });

  it("clears the timezone when the checkbox is off", () => {
    const req = formToUpdateRequest(
      form({ timezoneEnabled: false, timezone: "Australia/Sydney" }),
    );
    expect(req.timezone).toBeNull();
  });
});
