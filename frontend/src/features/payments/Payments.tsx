import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { InvoiceStatus } from "@examify-tms/interfaces";
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
  useMarkInvoicePaid,
  useVoidInvoice,
  useSendInvoice,
  previewSendInvoiceRequest,
  listInvoicesRequest,
} from "./api";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import {
  STATUS_META,
  formatCompactCurrency,
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

const PAGE_SIZE = 20;

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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Cursor-stack pagination (browsing mode — server-side Firestore pagination)
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(0);

  // Client-side page index for full-fetch results (search / custom sort)
  const [clientPage, setClientPage] = useState(0);

  // Debounce search so we don't fire on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const isSearching = debouncedSearch.length > 0;
  const isCustomSort = sortField !== "createdAt" || sortOrder !== "desc";
  const usePagination = !isSearching && !isCustomSort;
  const currentCursor = cursors[page];

  // Reset pagination when status, sort, or search changes.
  useEffect(() => {
    setCursors([undefined]);
    setPage(0);
    setClientPage(0);
  }, [statusFilter, sortField, sortOrder]);

  useEffect(() => {
    setClientPage(0);
  }, [debouncedSearch]);

  // ── Browsing query: cursor-paginated, reads only ~PAGE_SIZE docs ──
  // Only used with the default sort (createdAt desc) and no search.
  const pageQuery = useQuery({
    queryKey: ["invoices", "page", statusFilter, currentCursor],
    queryFn: () =>
      listInvoicesRequest({
        status: statusFilter,
        limit: PAGE_SIZE,
        cursor: currentCursor,
      }),
    enabled: usePagination,
  });

  // ── Full-fetch query: search and/or custom sort ──
  // Firestore can't do full-text search or arbitrary sorting with cursor
  // pagination, so we fall back to the full (status-filtered) fetch and
  // sort/paginate client-side.
  const fullFetchQuery = useQuery({
    queryKey: [
      "invoices",
      "list",
      statusFilter,
      debouncedSearch,
      sortField,
      sortOrder,
    ],
    queryFn: async () => {
      const res = await listInvoicesRequest({
        status: statusFilter,
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(isCustomSort && { sort: sortField, order: sortOrder }),
      });
      return res.data;
    },
    enabled: !usePagination,
  });

  const pageData = pageQuery.data?.data ?? [];
  const fullFetchResults = useMemo(
    () => fullFetchQuery.data ?? [],
    [fullFetchQuery.data],
  );
  const fullFetchPageData = useMemo(
    () =>
      fullFetchResults.slice(
        clientPage * PAGE_SIZE,
        (clientPage + 1) * PAGE_SIZE,
      ),
    [fullFetchResults, clientPage],
  );

  const displayData = usePagination ? pageData : fullFetchPageData;
  const isLoading = usePagination
    ? pageQuery.isLoading
    : fullFetchQuery.isLoading;
  const isFetching = usePagination
    ? pageQuery.isFetching
    : fullFetchQuery.isFetching;
  const error = usePagination ? pageQuery.error : fullFetchQuery.error;

  const activePage = usePagination ? page : clientPage;
  const totalCount = usePagination
    ? (pageQuery.data?.total ?? 0)
    : fullFetchResults.length;

  const hasNext = usePagination
    ? (pageQuery.data?.hasMore ?? false)
    : (clientPage + 1) * PAGE_SIZE < fullFetchResults.length;
  const hasPrev = activePage > 0;

  function handleNext() {
    if (usePagination) {
      if (pageQuery.data?.nextCursor) {
        setCursors((prev) => [
          ...prev,
          pageQuery.data!.nextCursor ?? undefined,
        ]);
        setPage((p) => p + 1);
      }
    } else {
      setClientPage((p) => p + 1);
    }
  }

  function handlePrev() {
    if (usePagination) {
      setPage((p) => Math.max(0, p - 1));
    } else {
      setClientPage((p) => Math.max(0, p - 1));
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(
        field === "customerName" || field === "invoiceNumber" ? "asc" : "desc",
      );
    }
  }

  function SortHeader({ field, label }: { field: SortField; label: string }) {
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

  const markPaid = useMarkInvoicePaid();
  const voidInvoice = useVoidInvoice();
  const sendInvoice = useSendInvoice();
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.value);
                  setSearch("");
                }}
                aria-pressed={statusFilter === tab.value}
                className={
                  statusFilter === tab.value
                    ? "inline-flex h-7 items-center gap-1.5 rounded px-3 text-sm font-medium text-foreground shadow-sm transition-colors"
                    : "inline-flex h-7 items-center gap-1.5 rounded px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {tab.label}
              </button>
            ))}
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => navigate("/payments/new")}
              data-tour="create-invoice"
            >
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
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
          </div>

          {/* Content area */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-muted-foreground">
                Loading invoices...
              </p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <p className="text-sm text-destructive">
                Failed to load invoices. Please try again.
              </p>
            </div>
          ) : displayData.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearch
                  ? "No invoices match your search."
                  : `No ${statusFilter === "all" ? "" : statusFilter} invoices yet. Click "Create Invoice" to get started.`}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table containerClassName="max-h-[calc(100vh-21rem)]">
                <TableHeader>
                  <TableRow className="sticky top-0 z-10 bg-muted shadow-sm hover:bg-muted">
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
                  {displayData.map((inv) => {
                    const meta = STATUS_META[inv.status];
                    return (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/payments/${inv.id}`)}
                      >
                        <TableCell className="pl-4 font-medium">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCompactCurrency(inv.total, inv.currency)}
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
                        <TableCell onClick={(e) => e.stopPropagation()}>
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
                              {inv.status === "draft" ? (
                                <>
                                  <DropdownMenuItem
                                    disabled={sendInvoice.isPending}
                                    onSelect={() => setSendInvoiceId(inv.id)}
                                  >
                                    Send invoice
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      navigate(`/payments/${inv.id}/edit`)
                                    }
                                  >
                                    Edit
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <>
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
                                </>
                              )}
                              {inv.status !== "void" &&
                                inv.status !== "paid" && (
                                  <DropdownMenuItem
                                    disabled={voidInvoice.isPending}
                                    onSelect={() => voidInvoice.mutate(inv.id)}
                                  >
                                    Void
                                  </DropdownMenuItem>
                                )}
                              <DropdownMenuItem
                                onSelect={() => navigate(`/payments/${inv.id}`)}
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

          {/* Footer: always visible (Stripe-style) */}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-xs text-muted-foreground">
              {isFetching
                ? "Updating..."
                : isLoading || error
                ? null
                : displayData.length > 0
                ? (() => {
                    const start = activePage * PAGE_SIZE + 1;
                    const end = start + displayData.length - 1;
                    return `Showing ${start}–${end} of ${totalCount} ${totalCount === 1 ? "invoice" : "invoices"}`;
                  })()
                : totalCount > 0
                ? `${totalCount} ${totalCount === 1 ? "invoice" : "invoices"}`
                : null}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={!hasPrev || isFetching || isLoading || !!error}
                onClick={handlePrev}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                disabled={!hasNext || isFetching || isLoading || !!error}
                onClick={handleNext}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {sendInvoiceId && (
        <EmailComposeDialog
          open
          onOpenChange={(o) => !o && setSendInvoiceId(null)}
          title="Send invoice"
          description="Review and edit the email before sending. The invoice PDF is attached automatically."
          fetchPreview={(message) =>
            previewSendInvoiceRequest(sendInvoiceId, message)
          }
          onSend={async (message) => {
            await sendInvoice.mutateAsync({
              id: sendInvoiceId,
              message: message || undefined,
            });
            toast.success("Invoice sent.");
            setSendInvoiceId(null);
          }}
        />
      )}
    </div>
  );
}
