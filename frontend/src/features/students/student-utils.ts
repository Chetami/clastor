// Pure student helpers live in @examify-tms/shared. Re-exported here under the
// historical names so existing imports keep working. Only `downloadCsv`
// (which touches the DOM) stays in the web client.
export type { Student, StudentResponse, Subject } from "@examify-tms/interfaces";

export {
  rateTypeLabel,
  statusLabel,
  formatRate,
  rateUnit,
  formatFrequency,
  studentToFormValues,
  STUDENT_CSV_COLUMNS,
  escapeCsvField,
  studentsToCsv,
  STUDENT_CSV_TEMPLATE,
  generateId,
  SAMPLE_STUDENTS,
} from "@examify-tms/shared";

// Currency formatters come from the shared payments module; `compactCurrency`
// is exposed under its legacy name for existing consumers.
export { formatCurrency } from "@examify-tms/shared";
export { formatCompactCurrency as compactCurrency } from "@examify-tms/shared";
export { getInitials } from "@examify-tms/shared";

/** Trigger a browser download of the given CSV text. (Web-only — uses DOM.) */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
