import { describe, expect, it } from "vitest";
import type { Request } from "express";
import type {
  Lesson,
  Student,
  Invoice,
  LessonSeries,
} from "@examify-tms/interfaces";
import * as permissions from "../src/permissions/permissions";
import { canViewLesson, canEditLesson } from "../src/permissions/lessonPermissions";
import {
  canViewStudent,
  canEditStudent,
  canDeleteStudent,
} from "../src/permissions/studentPermissions";
import {
  canViewInvoice,
  canEditInvoice,
  canDeleteInvoice,
} from "../src/permissions/paymentPermissions";
import { canViewSeries, canEditSeries } from "../src/permissions/lessonSeriesPermissions";

function reqWithUser(uid?: string, role?: "tutor" | "system_admin") {
  return { user: uid || role ? { uid, role } : undefined } as Request;
}

function lesson(tutorId: string) {
  return { tutorId } as Lesson;
}
function student(tutorId: string) {
  return { tutorId } as Student;
}
function invoice(tutorId: string) {
  return { tutorId } as Invoice;
}
function series(tutorId: string) {
  return { tutorId } as LessonSeries;
}

describe("permissions primitives", () => {
  it("isUserSysAdmin matches only system_admin", () => {
    expect(permissions.isUserSysAdmin("system_admin")).toBe(true);
    expect(permissions.isUserSysAdmin("tutor")).toBe(false);
    expect(permissions.isUserSysAdmin(undefined)).toBe(false);
  });

  it("isUserTutor matches only tutor", () => {
    expect(permissions.isUserTutor("tutor")).toBe(true);
    expect(permissions.isUserTutor("system_admin")).toBe(false);
    expect(permissions.isUserTutor(undefined)).toBe(false);
  });

  it("isSameUser compares target vs uid", () => {
    expect(permissions.isSameUser("u1", "u1")).toBe(true);
    expect(permissions.isSameUser("u1", "u2")).toBe(false);
    expect(permissions.isSameUser("u1", undefined)).toBe(false);
  });
});

describe("lesson permissions", () => {
  it("system admins can view/edit any lesson", () => {
    const req = reqWithUser("admin-1", "system_admin");
    expect(canViewLesson(lesson("tutor-x"), req)).toBe(true);
    expect(canEditLesson(lesson("tutor-x"), req)).toBe(true);
  });

  it("a tutor can view/edit their own lesson", () => {
    const req = reqWithUser("tutor-1", "tutor");
    expect(canViewLesson(lesson("tutor-1"), req)).toBe(true);
    expect(canEditLesson(lesson("tutor-1"), req)).toBe(true);
  });

  it("a tutor cannot view/edit another tutor's lesson", () => {
    const req = reqWithUser("tutor-1", "tutor");
    expect(canViewLesson(lesson("tutor-2"), req)).toBe(false);
    expect(canEditLesson(lesson("tutor-2"), req)).toBe(false);
  });

  it("denies when there is no request/user", () => {
    expect(canViewLesson(lesson("tutor-1"))).toBe(false);
    expect(canEditLesson(lesson("tutor-1"), undefined)).toBe(false);
  });
});

describe("student permissions", () => {
  const cases = [
    ["view", canViewStudent] as const,
    ["edit", canEditStudent] as const,
    ["delete", canDeleteStudent] as const,
  ];

  for (const [label, fn] of cases) {
    it(`system admin can ${label} any student`, () => {
      expect(fn(student("tutor-x"), reqWithUser("a", "system_admin"))).toBe(true);
    });

    it(`owner tutor can ${label} their student`, () => {
      expect(fn(student("tutor-1"), reqWithUser("tutor-1", "tutor"))).toBe(true);
    });

    it(`non-owner tutor cannot ${label}`, () => {
      expect(fn(student("tutor-1"), reqWithUser("tutor-2", "tutor"))).toBe(false);
    });

    it(`denies ${label} without a user`, () => {
      expect(fn(student("tutor-1"))).toBe(false);
    });
  }
});

describe("invoice permissions", () => {
  const cases = [
    ["view", canViewInvoice] as const,
    ["edit", canEditInvoice] as const,
    ["delete", canDeleteInvoice] as const,
  ];

  for (const [label, fn] of cases) {
    it(`system admin can ${label} any invoice`, () => {
      expect(fn(invoice("tutor-x"), reqWithUser("a", "system_admin"))).toBe(true);
    });

    it(`owner tutor can ${label} their invoice`, () => {
      expect(fn(invoice("tutor-1"), reqWithUser("tutor-1", "tutor"))).toBe(true);
    });

    it(`non-owner tutor cannot ${label}`, () => {
      expect(fn(invoice("tutor-1"), reqWithUser("tutor-2", "tutor"))).toBe(false);
    });
  }
});

describe("lesson series permissions", () => {
  it("system admin can view/edit any series", () => {
    const req = reqWithUser("a", "system_admin");
    expect(canViewSeries(series("tutor-x"), req)).toBe(true);
    expect(canEditSeries(series("tutor-x"), req)).toBe(true);
  });

  it("owner tutor can view/edit their series", () => {
    const req = reqWithUser("tutor-1", "tutor");
    expect(canViewSeries(series("tutor-1"), req)).toBe(true);
    expect(canEditSeries(series("tutor-1"), req)).toBe(true);
  });

  it("non-owner tutor cannot view/edit", () => {
    const req = reqWithUser("tutor-1", "tutor");
    expect(canViewSeries(series("tutor-2"), req)).toBe(false);
    expect(canEditSeries(series("tutor-2"), req)).toBe(false);
  });
});
