import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bug,
  Check,
  ChevronRight,
  Lightbulb,
  Loader2,
  MessageSquare,
  MessageSquareText,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FeedbackResponse,
  FeedbackType,
  UpdateFeedbackStatusRequest,
} from "@examify-tms/interfaces";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useListFeedback, useUpdateFeedbackStatus } from "./api";

type StatusFilter = "all" | "open" | "resolved";
type TypeFilter = "all" | FeedbackType;
type SortField = "createdAt" | "type" | "tutorName";
type SortOrder = "asc" | "desc";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "bug", label: "Bugs" },
  { value: "feedback", label: "Feedback" },
  { value: "feature_request", label: "Ideas" },
];

const TYPE_META: Record<
  FeedbackType,
  { label: string; variant: "danger" | "secondary" | "warning"; icon: typeof Bug }
> = {
  bug: { label: "Bug", variant: "danger", icon: Bug },
  feedback: { label: "Feedback", variant: "secondary", icon: MessageSquare },
  feature_request: {
    label: "Feature Idea",
    variant: "warning",
    icon: Lightbulb,
  },
};

const STATUS_META: Record<
  FeedbackResponse["status"],
  { label: string; variant: "warning" | "success" }
> = {
  open: { label: "Open", variant: "warning" },
  resolved: { label: "Resolved", variant: "success" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

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
    const c: Record<StatusFilter, number> = { all: feedback.length, open: 0, resolved: 0 };
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

  function toggleStatus(
    item: FeedbackResponse,
    e?: React.MouseEvent,
  ): void {
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
          toast.success(
            next === "resolved" ? "Marked as resolved" : "Reopened",
          );
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

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading feedback…</p>
        </div>
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
                        <SortHeader field="type" label="Type" />
                      </TableHead>
                      <TableHead className="max-w-md">Message</TableHead>
                      <TableHead className="hidden md:table-cell">
                        <SortHeader field="tutorName" label="Submitted by" />
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden lg:table-cell">
                        <SortHeader field="createdAt" label="Created" />
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
        onToggleStatus={toggleStatus}
        isToggling={
          !!selected &&
          updateStatus.isPending &&
          updateStatus.variables?.id === selected.id
        }
      />
    </div>
  );
}

function FeedbackDetailDialog({
  feedback,
  onOpenChange,
  onToggleStatus,
  isToggling,
}: {
  feedback: FeedbackResponse | null;
  onOpenChange: (open: boolean) => void;
  onToggleStatus: (feedback: FeedbackResponse) => void;
  isToggling: boolean;
}) {
  return (
    <Dialog open={!!feedback} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {feedback && (
          <FeedbackDetailBody
            feedback={feedback}
            onToggleStatus={onToggleStatus}
            isToggling={isToggling}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FeedbackDetailBody({
  feedback,
  onToggleStatus,
  isToggling,
}: {
  feedback: FeedbackResponse;
  onToggleStatus: (feedback: FeedbackResponse) => void;
  isToggling: boolean;
}) {
  const typeMeta = TYPE_META[feedback.type];
  const statusMeta = STATUS_META[feedback.status];
  const TypeIcon = typeMeta.icon;
  const isOpen = feedback.status === "open";

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Badge variant={typeMeta.variant}>
            <TypeIcon className="mr-1 h-3 w-3" />
            {typeMeta.label}
          </Badge>
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        </div>
        <DialogTitle className="sr-only">Feedback details</DialogTitle>
        <DialogDescription className="sr-only">
          Full details for feedback submitted on {formatDateTime(feedback.createdAt)}.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <p className="whitespace-pre-wrap break-words text-sm">
            {feedback.message}
          </p>
        </div>

        {feedback.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {feedback.images.map((src, i) => (
              <a
                key={i}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-24 w-24 overflow-hidden rounded-md border"
              >
                <img
                  src={src}
                  alt={`Attachment ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">From</dt>
          <dd>
            <div className="flex flex-col">
              <span>{feedback.tutorName ?? "Unknown"}</span>
              {feedback.tutorEmail && (
                <span className="text-xs text-muted-foreground">
                  {feedback.tutorEmail}
                </span>
              )}
            </div>
          </dd>
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>{formatDateTime(feedback.createdAt)}</dd>
          {feedback.pageUrl && (
            <>
              <dt className="text-muted-foreground">Page</dt>
              <dd className="truncate font-mono text-xs">{feedback.pageUrl}</dd>
            </>
          )}
          {feedback.userAgent && (
            <>
              <dt className="text-muted-foreground align-top">Device</dt>
              <dd className="text-xs text-muted-foreground">
                {feedback.userAgent}
              </dd>
            </>
          )}
        </dl>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant={isOpen ? "default" : "outline"}
          disabled={isToggling}
          onClick={() => onToggleStatus(feedback)}
        >
          {isToggling ? (
            <Loader2 className="animate-spin" />
          ) : isOpen ? (
            <Check />
          ) : (
            <RotateCcw />
          )}
          {isOpen ? "Resolve" : "Reopen"}
        </Button>
      </DialogFooter>
    </>
  );
}
