import type { Student } from "@examify-tms/interfaces";
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

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function compactCurrency(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function formatRate(
  amount: number,
  rateType: Student["rateType"],
): string {
  return rateType === "hourly"
    ? `${compactCurrency(amount)}/hr`
    : `${compactCurrency(amount)}/lesson`;
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
  student: Student,
): Partial<StudentFormData> {
  return {
    name: student.name,
    email: student.email,
    phone: student.phone ?? "",
    parentEmail: student.parentEmail ?? "",
    subject: student.subject,
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
    name: "Alice Johnson",
    email: "alice.johnson@example.com",
    phone: null,
    parentEmail: "parent.johnson@example.com",
    subject: "Mathematics",
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
    name: "Marcus Chen",
    email: "marcus.chen@example.com",
    phone: "+1 555 0142",
    parentEmail: null,
    subject: "Physics",
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
    name: "Priya Patel",
    email: "priya.patel@example.com",
    phone: null,
    parentEmail: null,
    subject: "Chemistry",
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
    name: "Liam O'Brien",
    email: "liam.obrien@example.com",
    phone: "+1 555 0199",
    parentEmail: "obrien.family@example.com",
    subject: "English Literature",
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
