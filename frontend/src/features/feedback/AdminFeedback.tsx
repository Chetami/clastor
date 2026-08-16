import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronRight,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FeedbackResponse,
  UpdateFeedbackStatusRequest,
} from "@examify-tms/interfaces";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTabGroup, SkeletonTable } from "@/components/skeletons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useListFeedback, useUpdateFeedbackStatus } from "./api";
import { formatDate } from "@/features/payments/invoice-utils";
import {
  STATUS_META,
  STATUS_TABS,
  TYPE_META,
  TYPE_TABS,
  type StatusFilter,
  type TypeFilter,
} from "./admin/constants";
import { FeedbackDetailDialog } from "./admin/FeedbackDetailDialog";

type SortField = "createdAt" | "type" | "tutorName";
type SortOrder = "asc" | "desc";

export default function AdminFeedback() {
  const { data: feedback = [], isLoading, error } = useListFeedback();
  const updateStatus = useUpdateFeedbackStatus();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selected, setSelected] = useState<FeedbackResponse | null>(null);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: feedback.length,
      open: 0,
      resolved: 0,
    };
    for (const f of feedback) c[f.status] = (c[f.status] ?? 0) + 1;
    return c;
  }, [feedback]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = feedback.filter((f) => {
      const matchesStatus = statusFilter === "all" || f.status === statusFilter;
      const matchesType = typeFilter === "all" || f.type === typeFilter;
      const matchesSearch =
        query.length === 0 ||
        f.message.toLowerCase().includes(query) ||
        (f.tutorName?.toLowerCase().includes(query) ?? false) ||
        (f.tutorEmail?.toLowerCase().includes(query) ?? false) ||
        f.type.toLowerCase().includes(query);
      return matchesStatus && matchesType && matchesSearch;
    });

    const accessor = (f: FeedbackResponse): string | number => {
      switch (sortField) {
        case "createdAt":
          return new Date(f.createdAt).getTime();
        case "type":
          return f.type;
        case "tutorName":
          return (f.tutorName ?? f.tutorEmail ?? "").toLowerCase();
      }
    };

    return [...filtered].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (typeof av === "string" && typeof bv === "string") {
        return sortOrder === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortOrder === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [feedback, statusFilter, typeFilter, search, sortField, sortOrder]);

  function toggleStatus(item: FeedbackResponse, e?: React.MouseEvent): void {
    e?.stopPropagation();
    const next: UpdateFeedbackStatusRequest["status"] =
      item.status === "open" ? "resolved" : "open";
    updateStatus.mutate(
      { id: item.id, status: next },
      {
        onSuccess: (updated) => {
          setSelected((prev) =>
            prev && prev.id === updated.id ? updated : prev,
          );
          toast.success(next === "resolved" ? "Marked as resolved" : "Reopened");
        },
        onError: () => {
          toast.error("Failed to update status. Please try again.");
        },
      },
    );
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "createdAt" ? "desc" : "asc");
    }
  }

  return (
    <div className="space-y-6">
      {isLoading && (
        <Card aria-busy="true">
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <SkeletonTabGroup widths={["w-14", "w-16", "w-18"]} />
              <SkeletonTabGroup widths={["w-16", "w-14", "w-14"]} />
            </div>
            <Skeleton className="h-9 w-full max-w-xs" />
            <SkeletonTable
              columns={[
                "w-20",
                "w-[38%]",
                { w: "w-32", cell: "hidden md:table-cell" },
                "w-20",
                { w: "w-24", cell: "hidden lg:table-cell" },
                "w-4",
              ]}
              rows={6}
            />
            <Skeleton className="h-3 w-14" />
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-destructive">
            Failed to load feedback. Please try again.
          </p>
        </div>
      )}

      {!isLoading && !error && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-3">
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
              <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
                {TYPE_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setTypeFilter(tab.value)}
                    aria-pressed={typeFilter === tab.value}
                    className={
                      typeFilter === tab.value
                        ? "inline-flex h-7 items-center rounded px-3 text-sm font-medium text-foreground shadow-sm transition-colors"
                        : "inline-flex h-7 items-center rounded px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                    }
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search message, submitter…"
                className="pl-8"
              />
            </div>

            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <MessageSquareText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {search.trim()
                    ? "No feedback matches your search."
                    : "No feedback has been submitted yet."}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4">
                        <SortHeader
                          field="type"
                          label="Type"
                          active={sortField === "type"}
                          order={sortOrder}
                          onToggle={toggleSort}
                        />
                      </TableHead>
                      <TableHead className="max-w-md">Message</TableHead>
                      <TableHead className="hidden md:table-cell">
                        <SortHeader
                          field="tutorName"
                          label="Submitted by"
                          active={sortField === "tutorName"}
                          order={sortOrder}
                          onToggle={toggleSort}
                        />
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        <SortHeader
                          field="createdAt"
                          label="Created"
                          active={sortField === "createdAt"}
                          order={sortOrder}
                          onToggle={toggleSort}
                        />
                      </TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((f) => {
                      const typeMeta = TYPE_META[f.type];
                      const statusMeta = STATUS_META[f.status];
                      const TypeIcon = typeMeta.icon;
                      return (
                        <TableRow
                          key={f.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(f)}
                        >
                          <TableCell className="pl-4">
                            <Badge variant={typeMeta.variant}>
                              <TypeIcon className="mr-1 h-3 w-3" />
                              {typeMeta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <span className="line-clamp-2 text-sm text-muted-foreground">
                              {f.message}
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {f.tutorName ?? "Unknown"}
                              </span>
                              {f.tutorEmail && (
                                <span className="text-xs text-muted-foreground">
                                  {f.tutorEmail}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              title={
                                f.status === "open"
                                  ? "Mark as resolved"
                                  : "Reopen"
                              }
                              disabled={
                                updateStatus.isPending &&
                                updateStatus.variables?.id === f.id
                              }
                              onClick={(e) => toggleStatus(f, e)}
                              className="inline-flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
                            >
                              <Badge variant={statusMeta.variant}>
                                {updateStatus.isPending &&
                                  updateStatus.variables?.id === f.id && (
                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  )}
                                {statusMeta.label}
                              </Badge>
                              {f.status === "open" ? (
                                <Check className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {formatDate(f.createdAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <ChevronRight className="h-4 w-4" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex items-center text-xs text-muted-foreground">
              <span>
                {visible.length} {visible.length === 1 ? "item" : "items"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <FeedbackDetailDialog
        feedback={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onToggleStatus={(f) => toggleStatus(f)}
        isToggling={
          !!selected &&
          updateStatus.isPending &&
          updateStatus.variables?.id === selected.id
        }
      />
    </div>
  );
}

/** Sortable table header. Hoisted out of the parent so it isn't redefined per render. */
function SortHeader({
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
