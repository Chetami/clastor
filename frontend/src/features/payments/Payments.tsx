import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
  ChevronsUpDown,
} from "lucide-react";
import type { InvoiceResponse, InvoiceStatus } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useListInvoices,
  useMarkInvoicePaid,
  useVoidInvoice,
} from "./api";
import {
  STATUS_META,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
} from "./invoice-utils";

type StatusFilter = InvoiceStatus | "all";
type SortField =
  | "invoiceNumber"
  | "total"
  | "customerName"
  | "dueDate"
  | "createdAt";
type SortOrder = "asc" | "desc";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

export default function Payments() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const { data: invoices = [], isLoading, error } = useListInvoices();
  const markPaid = useMarkInvoicePaid();
  const voidInvoice = useVoidInvoice();

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: invoices.length,
      draft: 0,
      open: 0,
      overdue: 0,
      paid: 0,
      void: 0,
    };
    for (const inv of invoices) c[inv.status] = (c[inv.status] ?? 0) + 1;
    return c;
  }, [invoices]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = invoices.filter((inv) => {
      const matchesStatus =
        statusFilter === "all" || inv.status === statusFilter;
      const matchesSearch =
        query.length === 0 ||
        inv.invoiceNumber.toLowerCase().includes(query) ||
        inv.customerName.toLowerCase().includes(query) ||
        inv.billingEmail.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });

    const accessor = (inv: InvoiceResponse): string | number => {
      switch (sortField) {
        case "invoiceNumber":
          return inv.invoiceNumber;
        case "total":
          return inv.total;
        case "customerName":
          return inv.customerName.toLowerCase();
        case "dueDate":
          return new Date(inv.dueDate).getTime();
        case "createdAt":
          return new Date(inv.createdAt).getTime();
      }
    };

    return [...filtered].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortOrder === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }
      return sortOrder === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [invoices, statusFilter, search, sortField, sortOrder]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "customerName" || field === "invoiceNumber" ? "asc" : "desc");
    }
  }

  function SortHeader({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) {
    const active = sortField === field;
    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={`group inline-flex items-center gap-1 transition-colors hover:text-foreground ${
          active ? "text-foreground" : ""
        }`}
      >
        {label}
        {active ? (
          sortOrder === "asc" ? (
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Track invoices and record payments.
          </p>
        </div>
        <Button onClick={() => navigate("/payments/new")}>
          <Plus className="h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading invoices...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-destructive">
            Failed to load invoices. Please try again.
          </p>
        </div>
      )}

      {!isLoading && !error && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  aria-pressed={statusFilter === tab.value}
                  className={
                    statusFilter === tab.value
                      ? "inline-flex h-7 items-center gap-1.5 rounded px-3 text-sm font-medium text-foreground shadow-sm transition-colors"
                      : "inline-flex h-7 items-center gap-1.5 rounded px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  }
                >
                  {tab.label}
                  <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">
                    {counts[tab.value] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search invoices, customers..."
                  className="pl-8"
                />
              </div>
              <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
                <ChevronsUpDown className="h-3 w-3" />
                Click column headers to sort
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {search.trim()
                    ? "No invoices match your search."
                    : `No ${statusFilter === "all" ? "" : statusFilter} invoices yet. Click "Create Invoice" to get started.`}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4">
                        <SortHeader field="invoiceNumber" label="Invoice" />
                      </TableHead>
                      <TableHead>
                        <SortHeader field="total" label="Amount" />
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>
                        <SortHeader field="customerName" label="Customer" />
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Billing Email
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        <SortHeader field="dueDate" label="Due" />
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        <SortHeader field="createdAt" label="Created" />
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((inv) => {
                      const meta = STATUS_META[inv.status];
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="pl-4 font-medium">
                            {inv.invoiceNumber}
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCompactCurrency(inv.total)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{inv.customerName}</span>
                              <span className="text-xs text-muted-foreground md:hidden">
                                {inv.billingEmail}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground md:table-cell">
                            {inv.billingEmail}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {formatDate(inv.dueDate)}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">
                            {formatDate(inv.createdAt)}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Open menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {inv.status !== "paid" &&
                                  inv.status !== "void" && (
                                    <DropdownMenuItem
                                      disabled={markPaid.isPending}
                                      onSelect={() =>
                                        markPaid.mutate({ id: inv.id })
                                      }
                                    >
                                      Mark as paid
                                    </DropdownMenuItem>
                                  )}
                                {inv.status !== "void" &&
                                  inv.status !== "paid" && (
                                    <DropdownMenuItem
                                      disabled={voidInvoice.isPending}
                                      onSelect={() =>
                                        voidInvoice.mutate(inv.id)
                                      }
                                    >
                                      Void
                                    </DropdownMenuItem>
                                  )}
                                <DropdownMenuItem
                                  onSelect={() =>
                                    navigate(`/payments/${inv.id}`)
                                  }
                                >
                                  View details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {visible.length} {visible.length === 1 ? "invoice" : "invoices"}
              </span>
              {visible.length > 0 && (
                <span>
                  Total: {formatCurrency(visible.reduce((s, i) => s + i.total, 0))}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
