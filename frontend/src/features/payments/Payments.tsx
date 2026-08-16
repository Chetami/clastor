import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody } from "@/components/ui/table";
import { useMarkInvoicePaid, useVoidInvoice, listInvoicesRequest } from "./api";
import { SendInvoiceDialog } from "@/components/send-invoice-dialog";
import { SkeletonTable } from "@/components/skeletons";
import {
  PAGE_SIZE,
  STATUS_TABS,
  type SortField,
  type SortOrder,
  type StatusFilter,
} from "./list/constants";
import { InvoicesTableHeader, InvoiceRow } from "./list/components";

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

  // ── Browsing query: cursor-paginated (default sort, no search) ──
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

  // ── Full-fetch query: search and/or custom sort (sort/paginate client-side) ──
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
  const refetch = usePagination
    ? pageQuery.refetch
    : fullFetchQuery.refetch;

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

  const markPaid = useMarkInvoicePaid();
  const voidInvoice = useVoidInvoice();
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <Card className="h-full">
        <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1">
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
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoices, customers..."
                className="pl-8"
              />
            </div>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => navigate("/payments/new")}
              data-tour="create-invoice"
            >
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
          {/* Content area */}
          {isLoading ? (
            <div className="min-h-0 min-w-0 flex-1" aria-busy="true">
              <SkeletonTable
                className="h-full"
                columns={[
                  { w: "w-16", cell: "w-[5.5rem]" },
                  "w-14",
                  "w-16",
                  "w-24",
                  { w: "w-32", cell: "hidden md:table-cell md:w-[12rem]" },
                  { w: "w-16", cell: "hidden lg:table-cell lg:w-[6rem]" },
                  { w: "w-16", cell: "hidden lg:table-cell lg:w-[6rem]" },
                  "w-6",
                ]}
                rows={8}
              />
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
              <p className="text-sm text-destructive">
                Failed to load invoices. Please try again.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : displayData.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearch
                  ? "No invoices match your search."
                  : `No ${statusFilter === "all" ? "" : statusFilter} invoices yet. Click "Create Invoice" to get started.`}
              </p>
            </div>
          ) : (
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-md border">
              <Table
                containerClassName="h-full overflow-auto"
                className="table-fixed"
              >
                <InvoicesTableHeader
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onToggleSort={toggleSort}
                />
                <TableBody>
                  {displayData.map((inv) => (
                    <InvoiceRow
                      key={inv.id}
                      inv={inv}
                      onNavigate={(id) => navigate(`/payments/${id}`)}
                      onSend={(id) => setSendInvoiceId(id)}
                      onEdit={(id) => navigate(`/payments/${id}/edit`)}
                      onMarkPaid={(id) =>
                        markPaid.mutate(
                          { id },
                          {
                            onError: (err) =>
                              toast.error(
                                err instanceof Error && err.message
                                  ? err.message
                                  : "Failed to mark invoice as paid",
                              ),
                          },
                        )
                      }
                      onVoid={(id) =>
                        voidInvoice.mutate(id, {
                          onError: (err) =>
                            toast.error(
                              err instanceof Error && err.message
                                ? err.message
                                : "Failed to void invoice",
                            ),
                        })
                      }
                      sendDisabled={false}
                      markPaidDisabled={
                        markPaid.isPending &&
                        markPaid.variables?.id === inv.id
                      }
                      voidDisabled={
                        voidInvoice.isPending &&
                        voidInvoice.variables === inv.id
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Footer: always visible (Stripe-style) */}
          <div className="mt-auto flex shrink-0 items-center justify-between border-t pt-3">
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

      <SendInvoiceDialog
        invoiceId={sendInvoiceId}
        onClose={() => setSendInvoiceId(null)}
      />
    </div>
  );
}
