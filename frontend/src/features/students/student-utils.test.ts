import { describe, it, expect } from "vitest";
import type { StudentResponse, Subject } from "@examify-tms/interfaces";
import {
  getInitials,
  compactCurrency,
  formatRate,
  rateUnit,
  formatFrequency,
  escapeCsvField,
  studentsToCsv,
  studentToFormValues,
  resolveBillingEmail,
  resolveBillingEmailSource,
} from "./student-utils";

describe("getInitials", () => {
  it("takes the first letter of the first two words", () => {
    expect(getInitials("Ada Lovelace")).toBe("AL");
    expect(getInitials("chethin hale")).toBe("CH");
  });

  it("upper-cases and caps at two letters", () => {
    expect(getInitials("a b c d")).toBe("AB");
  });

  it("returns an empty string for blank input", () => {
    expect(getInitials("")).toBe("");
    expect(getInitials("   ")).toBe("");
  });
});

describe("rate helpers", () => {
  it("rateUnit distinguishes hourly vs per-lesson", () => {
    expect(rateUnit("hourly")).toBe("/hr");
    expect(rateUnit("per_lesson")).toBe("/lesson");
  });

  it("formatRate appends the right unit and strips trailing .00", () => {
    expect(formatRate(60, "hourly")).toBe("$60/hr");
    expect(formatRate(90, "per_lesson")).toBe("$90/lesson");
    expect(formatRate(45.5, "hourly")).toBe("$45.50/hr");
  });

  it("formatFrequency is unit-aware", () => {
    expect(formatFrequency(2, "hourly")).toBe("2 hrs/wk");
    expect(formatFrequency(1, "per_lesson")).toBe("1/wk");
  });
});

describe("compactCurrency", () => {
  it("drops cents for whole amounts", () => {
    expect(compactCurrency(45)).toBe("$45");
    expect(compactCurrency(0)).toBe("$0");
  });

  it("keeps cents for fractional amounts", () => {
    expect(compactCurrency(45.5)).toBe("$45.50");
  });
});

describe("escapeCsvField", () => {
  it("leaves simple values untouched", () => {
    expect(escapeCsvField("plain")).toBe("plain");
    expect(escapeCsvField("123")).toBe("123");
  });

  it.each([
    ["comma", "a,b", '"a,b"'],
    ["quote", 'say "hi"', '"say ""hi"""'],
    ["semicolon", "a;b", '"a;b"'],
    ["newline", "line1\nline2", '"line1\nline2"'],
  ])("quotes %s-containing values", (_label, input, expected) => {
    expect(escapeCsvField(input)).toBe(expected);
  });
});

describe("studentsToCsv", () => {
  const subjects = [
    { id: "s1", name: "Maths" },
    { id: "s2", name: "Physics" },
  ] as unknown as Subject[];

  const baseStudent = {
    tutorId: "user_1",
    phone: null,
    parentEmail: null,
    billingEmail: "ada@example.com",
    subjectIds: ["s1"],
    expectedAmount: 60,
    rateType: "hourly",
    frequencyPerWeek: 2,
    status: "active",
    timezone: null,
    notes: null,
    amountOwed: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  } as const;

  it("emits the canonical header plus one row per student", () => {
    const csv = studentsToCsv(
      [{ id: "stu_1", name: "Ada", email: "ada@example.com", ...baseStudent }] as unknown as StudentResponse[],
      subjects,
    );

    const [header, row] = csv.split("\n");
    expect(header).toBe(
      "name,email,phone,parentEmail,subjects,expectedAmount,rateType,frequencyPerWeek,status,timezone,notes",
    );
    // subjects column resolves ids → "; "-joined display names.
    expect(row).toBe("Ada,ada@example.com,,,Maths,60,hourly,2,active,,");
  });

  it("joins multiple subjects with '; '", () => {
    const csv = studentsToCsv(
      [
        {
          id: "stu_2",
          name: "Bo",
          email: "bo@example.com",
          ...baseStudent,
          subjectIds: ["s1", "s2"],
        },
      ] as unknown as StudentResponse[],
      subjects,
    );
    expect(csv.split("\n")[1]).toContain("Maths; Physics");
  });
});

describe("studentToFormValues", () => {
  const base = {
    id: "stu_1",
    tutorId: "user_1",
    name: "Ada",
    email: "ada@example.com",
    phone: null,
    subjectIds: [],
    expectedAmount: 60,
    rateType: "hourly",
    frequencyPerWeek: 2,
    status: "active",
    timezone: null,
    notes: null,
    amountOwed: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  } as const;

  it("maps a parent-derived billing email to auto mode", () => {
    const values = studentToFormValues({
      ...base,
      parentEmail: "p@example.com",
      billingEmail: "p@example.com",
      billingEmailSource: "parent",
    } as unknown as StudentResponse);
    expect(values.billingEmailMode).toBe("auto");
    expect(values.billingEmail).toBe("");
  });

  it("maps a student-derived billing email to auto mode", () => {
    const values = studentToFormValues({
      ...base,
      parentEmail: null,
      billingEmail: "ada@example.com",
      billingEmailSource: "student",
    } as unknown as StudentResponse);
    expect(values.billingEmailMode).toBe("auto");
    expect(values.billingEmail).toBe("");
  });

  it("keeps an explicit billing email in custom mode", () => {
    const values = studentToFormValues({
      ...base,
      parentEmail: "p@example.com",
      billingEmail: "billing@example.com",
      billingEmailSource: "explicit",
    } as unknown as StudentResponse);
    expect(values.billingEmailMode).toBe("custom");
    expect(values.billingEmail).toBe("billing@example.com");
  });

  it("treats a missing billingEmailSource as derived", () => {
    const values = studentToFormValues({
      ...base,
      parentEmail: "p@example.com",
      billingEmail: "p@example.com",
    } as unknown as StudentResponse);
    expect(values.billingEmailMode).toBe("auto");
  });
});

describe("resolveBillingEmail", () => {
  const EMAIL = "student@example.com";

  it("prefers an explicit override", () => {
    expect(
      resolveBillingEmail("billing@example.com", "parent@example.com", EMAIL),
    ).toBe("billing@example.com");
  });

  it("falls back to the parent email when no override", () => {
    expect(resolveBillingEmail(null, "parent@example.com", EMAIL)).toBe(
      "parent@example.com",
    );
  });

  it("falls back to the student email when nothing else is set", () => {
    expect(resolveBillingEmail(null, null, EMAIL)).toBe(EMAIL);
    expect(resolveBillingEmail(undefined, undefined, EMAIL)).toBe(EMAIL);
  });
});

describe("resolveBillingEmailSource", () => {
  it("reports explicit when an override is set", () => {
    expect(resolveBillingEmailSource("b@example.com", "p@example.com")).toBe(
      "explicit",
    );
  });

  it("reports parent when only a parent email exists", () => {
    expect(resolveBillingEmailSource(null, "p@example.com")).toBe("parent");
  });

  it("reports student when neither is set", () => {
    expect(resolveBillingEmailSource(null, null)).toBe("student");
  });
});
