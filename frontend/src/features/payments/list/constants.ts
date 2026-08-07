import type { InvoiceStatus } from "@examify-tms/interfaces";

export type StatusFilter = InvoiceStatus | "all";
export type SortField =
  | "invoiceNumber"
  | "total"
  | "customerName"
  | "dueDate"
  | "createdAt";
export type SortOrder = "asc" | "desc";

export const PAGE_SIZE = 20;

export const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];
