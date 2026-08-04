import type { Student, StudentResponse, Subject } from "@examify-tms/interfaces";
import type { StudentFormData } from "./student-schema";
import { formatCompactCurrency } from "../payments/invoice-utils";

export const rateTypeLabel: Record<Student["rateType"], string> = {
  hourly: "Hourly",
  per_lesson: "Per Lesson",
};

export const statusLabel: Record<Student["status"], string> = {
  active: "Active",
  past: "Past",
};

export function formatRate(
  amount: number,
  rateType: Student["rateType"],
  currency: string = "AUD",
): string {
  const compact = formatCompactCurrency(amount, currency);
  return rateType === "hourly" ? `${compact}/hr` : `${compact}/lesson`;
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

/**
 * Resolve the effective billing email for a student: an explicit override
 * wins, then the parent email, then the student's own email. Mirrors the
 * backend's read-time resolution so the UI can preview what "auto" will
 * produce.
 */
export function resolveBillingEmail(
  explicit: string | null | undefined,
  parentEmail: string | null | undefined,
  email: string,
): string {
  if (explicit && explicit.trim().length > 0) return explicit;
  if (parentEmail && parentEmail.trim().length > 0) return parentEmail;
  return email;
}

export type BillingEmailSource = "explicit" | "parent" | "student";

/**
 * Resolve the provenance of a student's billing email. Mirrors the backend's
 * read-time resolution.
 */
export function resolveBillingEmailSource(
  explicit: string | null | undefined,
  parentEmail: string | null | undefined,
): BillingEmailSource {
  if (explicit && explicit.trim().length > 0) return "explicit";
  if (parentEmail && parentEmail.trim().length > 0) return "parent";
  return "student";
}

/**
 * Infer the billing email provenance for legacy records that predate the
 * `billingEmailSource` field. A non-null billing email that matches the
 * parent email was historically treated as "use parent email as billing",
 * so it maps to 'parent'; any other non-null value is an explicit override.
 */
function inferBillingEmailSource(
  billingEmail: string | null | undefined,
  parentEmail: string | null | undefined,
): BillingEmailSource {
  const parent = parentEmail?.trim().toLowerCase();
  const billing = billingEmail?.trim().toLowerCase();
  if (parent && billing === parent) return "parent";
  if (billing) return "explicit";
  return "student";
}

export function studentToFormValues(
  student: StudentResponse,
): Partial<StudentFormData> {
  const parentEmail = student.parentEmail ?? "";
  const source =
    student.billingEmailSource ??
    inferBillingEmailSource(student.billingEmail, parentEmail);
  const billingEmailMode = source === "explicit" ? "custom" : "auto";
  return {
    name: student.name,
    email: student.email,
    phone: student.phone ?? "",
    parentEmail,
    billingEmailMode,
    billingEmail: billingEmailMode === "custom" ? student.billingEmail ?? "" : "",
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

// ---------------------------------------------------------------------------
// CSV import / export helpers
//
// Column order is shared by export, the downloadable template and (implicitly)
// the backend parser (which is header-driven, so order is flexible). The
// `subjects` column uses `;`-separated display names so the file stays
// human-readable and round-trips through the backend name→id resolver.
//
// NOTE: the browser download trigger (`downloadCsv`) is intentionally NOT here
// — it touches the DOM, so it stays in the web client.
// ---------------------------------------------------------------------------

export const STUDENT_CSV_COLUMNS = [
  "name",
  "email",
  "phone",
  "parentEmail",
  "subjects",
  "expectedAmount",
  "rateType",
  "frequencyPerWeek",
  "status",
  "timezone",
  "notes",
] as const;

/** Quote a CSV field when it contains commas, quotes, semicolons or newlines. */
export function escapeCsvField(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Map a student's subject ids to `;`-joined display names for export. */
function studentSubjectsToNames(
  subjectIds: string[] | undefined,
  subjects: Subject[],
): string {
  const byId = new Map(subjects.map((s) => [s.id, s.name]));
  return (subjectIds ?? [])
    .map((id) => byId.get(id))
    .filter((n): n is string => !!n)
    .join("; ");
}

/** Serialize a list of students to CSV text (including the header row). */
export function studentsToCsv(
  students: StudentResponse[],
  subjects: Subject[],
): string {
  const header = STUDENT_CSV_COLUMNS.map(escapeCsvField).join(",");
  const rows = students.map((s) =>
    [
      s.name,
      s.email,
      s.phone ?? "",
      s.parentEmail ?? "",
      studentSubjectsToNames(s.subjectIds, subjects),
      String(s.expectedAmount),
      s.rateType,
      String(s.frequencyPerWeek),
      s.status,
      s.timezone ?? "",
      s.notes ?? "",
    ]
      .map(escapeCsvField)
      .join(","),
  );
  return [header, ...rows].join("\n");
}

/** A CSV with only the header + one example row, to seed first-time imports. */
export const STUDENT_CSV_TEMPLATE = [
  STUDENT_CSV_COLUMNS.join(","),
  [
    "Jane Doe",
    "jane.doe@example.com",
    "+1 555 0100",
    "parent.doe@example.com",
    "Mathematics; Physics",
    "45",
    "hourly",
    "2",
    "active",
    "America/New_York",
    "Prefers morning sessions",
  ]
    .map(escapeCsvField)
    .join(","),
].join("\n");

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
    billingEmailSource: "parent",
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
    billingEmailSource: "student",
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
    billingEmailSource: "student",
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
    billingEmailSource: "parent",
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
