import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
} from "lucide-react";
import type { InvoiceResponse } from "@examify-tms/interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { STATUS_META, formatCompactCurrency, formatDate } from "../invoice-utils";
import type { SortField, SortOrder } from "./constants";

/** Sortable column header. Hoisted out of the parent so it isn't redefined per render. */
export function SortHeader({
  field,
  label,
  active,
  order,
  onToggle,
}: {
  field: SortField;
  label: string;
  active: boolean;
  order: SortOrder;
  onToggle: (field: SortField) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      className={`group inline-flex items-center gap-1 transition-colors hover:text-foreground ${
        active ? "text-foreground" : ""
      }`}
    >
      {label}
      {active ? (
        order === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowDown className="h-3 w-3" />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-50" />
      )}
    </button>
  );
}

/** The table header row for the invoices table. */
export function InvoicesTableHeader({
  sortField,
  sortOrder,
  onToggleSort,
}: {
  sortField: SortField;
  sortOrder: SortOrder;
  onToggleSort: (field: SortField) => void;
}) {
  const head = (field: SortField, label: string) => (
    <SortHeader
      field={field}
      label={label}
      active={sortField === field}
      order={sortOrder}
      onToggle={onToggleSort}
    />
  );
  return (
    <TableHeader>
      <TableRow className="sticky top-0 z-10 bg-muted shadow-sm hover:bg-muted">
        <TableHead className="w-[5.5rem] pl-4">
          {head("invoiceNumber", "Invoice")}
        </TableHead>
        <TableHead className="w-[4.5rem]">{head("total", "Amount")}</TableHead>
        <TableHead className="w-[5rem]">Status</TableHead>
        <TableHead className="w-[8rem]">{head("customerName", "Customer")}</TableHead>
        <TableHead className="hidden md:table-cell md:w-[12rem]">
          Billing Email
        </TableHead>
        <TableHead className="hidden lg:table-cell lg:w-[6rem]">
          {head("dueDate", "Due")}
        </TableHead>
        <TableHead className="hidden lg:table-cell lg:w-[6rem]">
          {head("createdAt", "Created")}
        </TableHead>
        <TableHead className="w-12 shrink-0" />
      </TableRow>
    </TableHeader>
  );
}

interface InvoiceRowProps {
  inv: InvoiceResponse;
  onNavigate: (id: string) => void;
  onSend: (id: string) => void;
  onEdit: (id: string) => void;
  onMarkPaid: (id: string) => void;
  onVoid: (id: string) => void;
  sendDisabled: boolean;
  markPaidDisabled: boolean;
  voidDisabled: boolean;
}

/** A single invoice row with a status-aware action dropdown. */
export function InvoiceRow({
  inv,
  onNavigate,
  onSend,
  onEdit,
  onMarkPaid,
  onVoid,
  sendDisabled,
  markPaidDisabled,
  voidDisabled,
}: InvoiceRowProps) {
  const meta = STATUS_META[inv.status];
  return (
    <TableRow
      key={inv.id}
      className="cursor-pointer"
      onClick={() => onNavigate(inv.id)}
    >
      <TableCell className="overflow-hidden pl-4 font-medium">
        <span className="block truncate" title={inv.invoiceNumber}>
          {inv.invoiceNumber}
        </span>
      </TableCell>
      <TableCell className="font-medium">
        {formatCompactCurrency(inv.total, inv.currency)}
      </TableCell>
      <TableCell>
        <Badge variant={meta.variant}>{meta.label}</Badge>
      </TableCell>
      <TableCell className="overflow-hidden">
        <div className="flex flex-col">
          <span className="block truncate" title={inv.customerName}>
            {inv.customerName}
          </span>
          <span className="block truncate text-xs text-muted-foreground md:hidden">
            {inv.billingEmail}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden overflow-hidden md:table-cell">
        <span
          className="block truncate text-muted-foreground"
          title={inv.billingEmail}
        >
          {inv.billingEmail}
        </span>
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground">
        {formatDate(inv.dueDate)}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-muted-foreground">
        {formatDate(inv.createdAt)}
      </TableCell>
      <TableCell
        className="w-12 shrink-0 pr-4"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {inv.status === "draft" ? (
              <>
                <DropdownMenuItem
                  disabled={sendDisabled}
                  onSelect={() => onSend(inv.id)}
                >
                  Send invoice
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(inv.id)}>
                  Edit
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {inv.status !== "paid" && inv.status !== "void" && (
                  <DropdownMenuItem
                    disabled={markPaidDisabled}
                    onSelect={() => onMarkPaid(inv.id)}
                  >
                    Mark as paid
                  </DropdownMenuItem>
                )}
              </>
            )}
            {inv.status !== "void" && inv.status !== "paid" && (
              <DropdownMenuItem
                disabled={voidDisabled}
                onSelect={() => onVoid(inv.id)}
              >
                Void
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => onNavigate(inv.id)}>
              View details
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
