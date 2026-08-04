import { describe, expect, it } from "vitest";
import type { Subject } from "@examify-tms/interfaces";
import {
  resolveSubjectIdsByName,
  resolveBillingEmail,
  resolveBillingEmailSource,
  coalesceSubjectIds,
} from "../src/services/studentService";

const CATALOG: Subject[] = [
  { id: "subj_math", name: "Mathematics", color: null },
  { id: "subj_phys", name: "Physics", color: "#2563eb" },
  { id: "subj_chem", name: "  Chemistry  ", color: null }, // padded name
];

describe("resolveSubjectIdsByName", () => {
  it("resolves a single exact name", () => {
    const r = resolveSubjectIdsByName("Mathematics", CATALOG);
    expect(r.ids).toEqual(["subj_math"]);
    expect(r.unresolved).toEqual([]);
  });

  it("is case-insensitive and trims whitespace", () => {
    const r = resolveSubjectIdsByName("  mathematics  ", CATALOG);
    expect(r.ids).toEqual(["subj_math"]);
  });

  it("matches a catalogue name that is itself padded", () => {
    const r = resolveSubjectIdsByName("Chemistry", CATALOG);
    expect(r.ids).toEqual(["subj_chem"]);
  });

  it("resolves multiple ;-separated names and reports unresolved", () => {
    const r = resolveSubjectIdsByName("Mathematics;Biology;Physics", CATALOG);
    expect(r.ids).toEqual(["subj_math", "subj_phys"]);
    expect(r.unresolved).toEqual(["Biology"]);
  });

  it("deduplicates repeated subjects", () => {
    const r = resolveSubjectIdsByName("Mathematics;Mathematics;mathematics", CATALOG);
    expect(r.ids).toEqual(["subj_math"]);
  });

  it("ignores empty / whitespace-only segments", () => {
    const r = resolveSubjectIdsByName("Mathematics;;  ;Physics", CATALOG);
    expect(r.ids).toEqual(["subj_math", "subj_phys"]);
    expect(r.unresolved).toEqual([]);
  });

  it("returns empty ids for an empty raw string", () => {
    const r = resolveSubjectIdsByName("", CATALOG);
    expect(r.ids).toEqual([]);
    expect(r.unresolved).toEqual([]);
  });

  it("reports everything unresolved when nothing matches", () => {
    const r = resolveSubjectIdsByName("French;German", CATALOG);
    expect(r.ids).toEqual([]);
    expect(r.unresolved).toEqual(["French", "German"]);
  });

  it("works against an empty catalogue", () => {
    const r = resolveSubjectIdsByName("Mathematics", []);
    expect(r.ids).toEqual([]);
    expect(r.unresolved).toEqual(["Mathematics"]);
  });
});

describe("resolveBillingEmail", () => {
  const EMAIL = "student@example.com";

  it("prefers an explicit override", () => {
    expect(
      resolveBillingEmail("billing@example.com", "parent@example.com", EMAIL),
    ).toBe("billing@example.com");
  });

  it("falls back to the parent email when no explicit override", () => {
    expect(resolveBillingEmail(null, "parent@example.com", EMAIL)).toBe(
      "parent@example.com",
    );
  });

  it("falls back to the student email when nothing else is set", () => {
    expect(resolveBillingEmail(null, null, EMAIL)).toBe(EMAIL);
    expect(resolveBillingEmail(undefined, undefined, EMAIL)).toBe(EMAIL);
  });

  it("treats a whitespace-only explicit override as unset", () => {
    expect(resolveBillingEmail("   ", "parent@example.com", EMAIL)).toBe(
      "parent@example.com",
    );
  });

  it("treats a whitespace-only parent email as unset", () => {
    expect(resolveBillingEmail(null, "   ", EMAIL)).toBe(EMAIL);
  });
});

describe("resolveBillingEmailSource", () => {
  it("reports explicit when an override is set", () => {
    expect(resolveBillingEmailSource("billing@example.com", "parent@example.com")).toBe(
      "explicit",
    );
  });

  it("reports parent when no override but a parent email exists", () => {
    expect(resolveBillingEmailSource(null, "parent@example.com")).toBe("parent");
  });

  it("reports student when neither override nor parent email is set", () => {
    expect(resolveBillingEmailSource(null, null)).toBe("student");
    expect(resolveBillingEmailSource(undefined, undefined)).toBe("student");
  });

  it("treats whitespace-only values as unset", () => {
    expect(resolveBillingEmailSource("   ", "parent@example.com")).toBe("parent");
    expect(resolveBillingEmailSource(null, "   ")).toBe("student");
  });
});

describe("coalesceSubjectIds", () => {
  it("passes through a clean string array", () => {
    expect(coalesceSubjectIds(["a", "b"])).toEqual(["a", "b"]);
  });

  it("filters non-string entries out of an array", () => {
    expect(
      coalesceSubjectIds(["a", 42, null, "b", undefined, true, "c"]),
    ).toEqual(["a", "b", "c"]);
  });

  it("returns [] for undefined / null", () => {
    expect(coalesceSubjectIds(undefined)).toEqual([]);
    expect(coalesceSubjectIds(null)).toEqual([]);
  });

  it("returns [] for non-array input", () => {
    expect(coalesceSubjectIds("subj_a")).toEqual([]);
    expect(coalesceSubjectIds(42)).toEqual([]);
    expect(coalesceSubjectIds({ id: "subj_a" })).toEqual([]);
  });

  it("returns [] for an empty array", () => {
    expect(coalesceSubjectIds([])).toEqual([]);
  });
});
