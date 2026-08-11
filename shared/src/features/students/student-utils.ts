import type {
  BillingEmailSource,
  Student,
  StudentResponse,
  Subject,
} from "@examify-tms/interfaces";
import type { StudentFormData } from "./student-schema";
import { formatCompactCurrency } from "../payments/invoice-utils";

// Re-export so existing consumers importing from this module keep working;
// the canonical definition lives in @examify-tms/interfaces.
export type { BillingEmailSource };

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
 * produce. Returns null when none of these are set.
 */
export function resolveBillingEmail(
  explicit: string | null | undefined,
  parentEmail: string | null | undefined,
  email: string | null | undefined,
): string | null {
  if (explicit && explicit.trim().length > 0) return explicit;
  if (parentEmail && parentEmail.trim().length > 0) return parentEmail;
  if (email && email.trim().length > 0) return email;
  return null;
}

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
    email: student.email ?? "",
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
      s.email ?? "",
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
