import type { Student, StudentResponse } from "@examify-tms/interfaces";
import type { StudentFormData } from "./student-schema";

export const rateTypeLabel: Record<Student["rateType"], string> = {
  hourly: "Hourly",
  per_lesson: "Per Lesson",
};

export const statusLabel: Record<Student["status"], string> = {
  active: "Active",
  past: "Past",
};

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatCurrency(amount: number, currency: string = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function compactCurrency(
  amount: number,
  currency: string = "AUD",
): string {
  return amount % 1 === 0
    ? formatCurrency(amount, currency).replace(/\.00$/, "")
    : formatCurrency(amount, currency);
}

export function formatRate(
  amount: number,
  rateType: Student["rateType"],
  currency: string = "AUD",
): string {
  return rateType === "hourly"
    ? `${compactCurrency(amount, currency)}/hr`
    : `${compactCurrency(amount, currency)}/lesson`;
}

export function rateUnit(rateType: Student["rateType"]): string {
  return rateType === "hourly" ? "/hr" : "/lesson";
}

export function formatFrequency(
  frequency: number,
  rateType: Student["rateType"],
): string {
  return rateType === "hourly" ? `${frequency} hrs/wk` : `${frequency}/wk`;
}

export function studentToFormValues(
  student: StudentResponse,
): Partial<StudentFormData> {
  const parentEmail = student.parentEmail ?? "";
  const billingEmail = student.billingEmail ?? "";
  const useParentEmailAsBilling =
    parentEmail.length > 0 &&
    billingEmail.length > 0 &&
    billingEmail.toLowerCase() === parentEmail.toLowerCase();
  return {
    name: student.name,
    email: student.email,
    phone: student.phone ?? "",
    parentEmail,
    useParentEmailAsBilling,
    billingEmail: useParentEmailAsBilling ? "" : billingEmail,
    subjectIds: student.subjectIds ?? [],
    expectedAmount: student.expectedAmount,
    rateType: student.rateType,
    frequencyPerWeek: student.frequencyPerWeek,
    status: student.status,
    timezoneEnabled: student.timezone != null,
    timezone: student.timezone ?? "",
    notes: student.notes ?? "",
  };
}

let nextId = 100;
export function generateId(): string {
  nextId += 1;
  return `stu_${nextId}`;
}

export const SAMPLE_STUDENTS: Student[] = [
  {
    id: "1",
    tutorId: "tutor_1",
    name: "Alice Johnson",
    email: "alice.johnson@example.com",
    phone: null,
    parentEmail: "parent.johnson@example.com",
    billingEmail: "parent.johnson@example.com",
    subjectIds: [],
    expectedAmount: 45,
    rateType: "hourly",
    frequencyPerWeek: 4,
    status: "active",
    timezone: "America/New_York",
    notes: "Struggles with algebra, focus on quadratic equations.",
    amountOwed: 90,
    createdAt: "2025-01-15T10:00:00.000Z",
    updatedAt: "2025-06-01T10:00:00.000Z",
  },
  {
    id: "2",
    tutorId: "tutor_1",
    name: "Marcus Chen",
    email: "marcus.chen@example.com",
    phone: "+15551234567",
    parentEmail: null,
    billingEmail: "marcus.chen@example.com",
    subjectIds: [],
    expectedAmount: 120,
    rateType: "per_lesson",
    frequencyPerWeek: 2,
    status: "active",
    timezone: null,
    notes: null,
    amountOwed: 0,
    createdAt: "2025-02-03T10:00:00.000Z",
    updatedAt: "2025-05-28T10:00:00.000Z",
  },
  {
    id: "3",
    tutorId: "tutor_1",
    name: "Priya Patel",
    email: "priya.patel@example.com",
    phone: null,
    parentEmail: null,
    billingEmail: "priya.patel@example.com",
    subjectIds: [],
    expectedAmount: 50,
    rateType: "hourly",
    frequencyPerWeek: 3,
    status: "active",
    timezone: "Asia/Kolkata",
    notes: "Preparing for final exams in November.",
    amountOwed: 150,
    createdAt: "2025-03-10T10:00:00.000Z",
    updatedAt: "2025-06-10T10:00:00.000Z",
  },
  {
    id: "4",
    tutorId: "tutor_1",
    name: "Liam O'Brien",
    email: "liam.obrien@example.com",
    phone: "+15559876543",
    parentEmail: "obrien.family@example.com",
    billingEmail: "obrien.family@example.com",
    subjectIds: [],
    expectedAmount: 90,
    rateType: "per_lesson",
    frequencyPerWeek: 1,
    status: "past",
    timezone: null,
    notes: "Finished course. May return next semester.",
    amountOwed: 0,
    createdAt: "2024-09-01T10:00:00.000Z",
    updatedAt: "2025-04-20T10:00:00.000Z",
  },
];
