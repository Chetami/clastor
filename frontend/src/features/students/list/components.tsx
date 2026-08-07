import type { StudentResponse } from "@examify-tms/interfaces";
import {
  ChevronRight,
  Mail,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  compactCurrency,
  formatCurrency,
  formatFrequency,
  getInitials,
  rateUnit,
} from "../student-utils";

/** Segmented active/past/all filter pill with a count badge. */
export function FilterOption({
  checked,
  label,
  count,
  onSelect,
}: {
  checked: boolean;
  label: string;
  count: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={checked}
      className={
        checked
          ? "inline-flex h-7 items-center gap-1.5 rounded px-3 text-sm font-medium text-foreground shadow-sm transition-colors"
          : "inline-flex h-7 items-center gap-1.5 rounded px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {label}
      <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
        {count}
      </span>
    </button>
  );
}

interface StudentListItemProps {
  student: StudentResponse;
  debt: number;
  isLoadingDebt: boolean;
  currency: string;
  onNavigate: () => void;
  onEdit: () => void;
}

/** A single selectable student row in the list. */
export function StudentListItem({
  student,
  debt,
  isLoadingDebt,
  currency,
  onNavigate,
  onEdit,
}: StudentListItemProps) {
  const hasDebt = debt > 0;
  return (
    <li
      className="group flex cursor-pointer items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-accent/40"
      onClick={onNavigate}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          {getInitials(student.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{student.name}</p>
            <span
              className={
                student.status === "active"
                  ? "shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
                  : "shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              }
            >
              {student.status === "active" ? "Active" : "Past"}
            </span>
          </div>
          <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            {student.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="font-medium">
            {compactCurrency(student.expectedAmount, currency)}
            <span className="ml-0.5 text-xs font-normal text-muted-foreground">
              {rateUnit(student.rateType)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFrequency(student.frequencyPerWeek, student.rateType)}
          </p>
          {hasDebt && (
            <p className="text-xs font-medium text-destructive">
              {isLoadingDebt ? (
                <span className="text-muted-foreground">Loading...</span>
              ) : (
                `Owed: ${formatCurrency(debt, currency)}`
              )}
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onNavigate}>
              <ChevronRight className="h-4 w-4" />
              View Details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
