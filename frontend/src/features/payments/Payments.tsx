import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody } from "@/components/ui/table";
import {
  useMarkInvoicePaid,
  useVoidInvoice,
  useSendInvoice,
  previewSendInvoiceRequest,
  listInvoicesRequest,
} from "./api";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import {
  PAGE_SIZE,
  STATUS_TABS,
  type SortField,
  type SortOrder,
  type StatusFilter,
} from "./list/constants";
import {
  InvoicesTableHeader,
  InvoiceRow,
} from "./list/components";

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
                      onMarkPaid={(id) => markPaid.mutate({ id })}
                      onVoid={(id) => voidInvoice.mutate(id)}
                      sendDisabled={sendInvoice.isPending}
                      markPaidDisabled={markPaid.isPending}
                      voidDisabled={voidInvoice.isPending}
                    />
                  ))}
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
