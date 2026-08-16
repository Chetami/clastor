import { useMemo, useState } from "react";
import {
  Ban,
  CalendarClock,
  ChevronsUpDown,
  FileText,
  Mail,
  Search,
} from "lucide-react";
import type {
  SentEmailResponse,
  SentEmailType,
} from "@examify-tms/interfaces";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SortIndicator } from "@/components/ui/sort-indicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useListSentEmails } from "./api";
import { EmailViewerDialog } from "./EmailViewerDialog";
import { SkeletonTabGroup, SkeletonTable } from "@/components/skeletons";
import { useListStudents } from "@/features/students/api";
import { useListAdminTutors } from "@/features/admin-tutors/api";
import { useAuth } from "@/hooks/use-auth";
import { formatDateTime } from "@/features/payments/invoice-utils";

/**
 * Higher-level type grouping for the filter tabs. Lesson reminders and
 * cancellations both belong to the "lesson" family; invoices are separate.
 */
type TypeGroup = "all" | "lesson" | "invoice";
type StudentFilter = "all" | string;
type TutorFilter = "all" | string;
type SortField = "sentAt" | "subject" | "to";
type SortOrder = "asc" | "desc";

const TYPE_TABS: { value: TypeGroup; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lesson", label: "Lessons" },
  { value: "invoice", label: "Invoices" },
];

const TYPE_BADGE: Record<
  SentEmailType,
  { label: string; variant: "default" | "secondary" | "danger" }
> = {
  lesson_notify: { label: "Reminder", variant: "default" },
  lesson_cancel: { label: "Cancellation", variant: "danger" },
  invoice: { label: "Invoice", variant: "secondary" },
};

function groupOf(type: SentEmailType): "lesson" | "invoice" {
  return type === "invoice" ? "invoice" : "lesson";
}

/**
 * Sortable column header. Hoisted to module scope (not declared inside the
 * page component) so React doesn't remount the header buttons on every
 * render — e.g. every keystroke in the search box.
 */
function SortHeader({
  field,
  label,
  active,
  ascending,
  onToggle,
}: {
  field: SortField;
  label: string;
  active: boolean;
  ascending: boolean;
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
      <SortIndicator active={active} ascending={ascending} />
    </button>
  );
}

export default function SentEmails() {
  const { user } = useAuth();
  const isAdmin = user?.role === "system_admin";

  const [typeFilter, setTypeFilter] = useState<TypeGroup>("all");
  const [studentFilter, setStudentFilter] = useState<StudentFilter>("all");
  const [tutorFilter, setTutorFilter] = useState<TutorFilter>("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("sentAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selected, setSelected] = useState<SentEmailResponse | null>(null);

  // Admins drill into a single tutor server-side (?tutorId=…); tutors are
  // auto-scoped to their own emails by the backend.
  const { data, isLoading, error } = useListSentEmails(
    isAdmin && tutorFilter !== "all" ? { tutorId: tutorFilter } : {},
  );
  const { data: students = [] } = useListStudents();
  const { data: tutors = [] } = useListAdminTutors({ enabled: isAdmin });

  // Memoize so the downstream useMemo deps stay referentially stable (the
  // `?? []` fallback would otherwise mint a fresh array each render).
  const emails = useMemo(() => data?.data ?? [], [data]);

  // studentId -> name, for display + the student filter dropdown.
  const studentNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students) m.set(s.id, s.name);
    return m;
  }, [students]);

  // Which students actually have sent emails, so the dropdown only lists
  // relevant names (avoids a long, mostly-empty list).
  const studentsWithEmails = useMemo(() => {
    const ids = new Set(
      emails.map((e) => e.studentId).filter((id): id is string => !!id),
    );
    return students.filter((s) => ids.has(s.id));
  }, [students, emails]);

  const counts = useMemo(() => {
    const c: Record<TypeGroup, number> = { all: emails.length, lesson: 0, invoice: 0 };
    for (const e of emails) c[groupOf(e.type)] += 1;
    return c;
  }, [emails]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = emails.filter((e) => {
      const matchesType =
        typeFilter === "all" || groupOf(e.type) === typeFilter;
      const matchesStudent =
        studentFilter === "all" || e.studentId === studentFilter;
      const matchesSearch =
        query.length === 0 ||
        e.subject.toLowerCase().includes(query) ||
        e.to.some((r) => r.toLowerCase().includes(query));
      return matchesType && matchesStudent && matchesSearch;
    });

    const accessor = (e: SentEmailResponse): string | number => {
      switch (sortField) {
        case "subject":
          return e.subject.toLowerCase();
        case "to":
          return e.to.join(", ").toLowerCase();
        case "sentAt":
          return new Date(e.sentAt).getTime();
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
  }, [emails, typeFilter, studentFilter, search, sortField, sortOrder]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "sentAt" ? "desc" : "asc");
    }
  }

  return (
    <div className="space-y-6">
      {isLoading && (
        <Card aria-busy="true">
          <CardContent className="space-y-4 p-4">
            <SkeletonTabGroup widths={["w-14", "w-18", "w-18"]} />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-full max-w-xs" />
              <Skeleton className="h-9 w-44" />
            </div>
            <SkeletonTable
              columns={[
                { w: "w-[34%]", cell: "pl-4 w-[40%]" },
                { w: "w-16", cell: "w-28" },
                { w: "w-24", cell: "w-[18%]" },
                ...(isAdmin
                  ? [{ w: "w-20", cell: "hidden xl:table-cell xl:w-36" }]
                  : []),
                { w: "w-32", cell: "hidden md:table-cell md:w-[22%]" },
                { w: "w-16", cell: "w-24" },
                { w: "w-24", cell: "hidden lg:table-cell lg:w-40" },
              ]}
              rows={8}
            />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      )}

      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-destructive">
            Failed to load emails. Please try again.
          </p>
        </div>
      )}

      {!isLoading && !error && (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
              {TYPE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setTypeFilter(tab.value)}
                  aria-pressed={typeFilter === tab.value}
                  className={
                    typeFilter === tab.value
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search subject or recipient..."
                  className="pl-8"
                />
              </div>

              <Select
                value={studentFilter}
                onValueChange={(v) => setStudentFilter(v)}
              >
                <SelectTrigger aria-label="Filter by student" className="w-full sm:w-52">
                  <SelectValue placeholder="All students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All students</SelectItem>
                  {studentsWithEmails.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {isAdmin && (
                <Select
                  value={tutorFilter}
                  onValueChange={(v) => setTutorFilter(v)}
                >
                  <SelectTrigger aria-label="Filter by tutor" className="w-full sm:w-52">
                    <SelectValue placeholder="All tutors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All tutors</SelectItem>
                    {tutors.map((t) => (
                      <SelectItem key={t.tutorId} value={t.tutorId}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <ChevronsUpDown className="h-3 w-3" />
              Click column headers to sort. Click a row to view the email.
            </div>

            {visible.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <Mail className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {search.trim() ||
                    studentFilter !== "all" ||
                    typeFilter !== "all" ||
                    (isAdmin && tutorFilter !== "all")
                    ? "No emails match your filters."
                    : "No emails sent yet. Emails you send (lesson reminders, cancellations, invoices) will appear here."}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="pl-4 w-[40%]">
                        <SortHeader
                          field="subject"
                          label="Subject"
                          active={sortField === "subject"}
                          ascending={sortOrder === "asc"}
                          onToggle={toggleSort}
                        />
                      </TableHead>
                      <TableHead className="w-28">Type</TableHead>
                      <TableHead className="w-[18%]">Student</TableHead>
                      {isAdmin && (
                        <TableHead className="hidden xl:table-cell xl:w-36">
                          Tutor
                        </TableHead>
                      )}
                      <TableHead className="hidden md:table-cell md:w-[22%]">
                        <SortHeader
                          field="to"
                          label="Recipient"
                          active={sortField === "to"}
                          ascending={sortOrder === "asc"}
                          onToggle={toggleSort}
                        />
                      </TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="hidden lg:table-cell lg:w-40">
                        <SortHeader
                          field="sentAt"
                          label="Sent"
                          active={sortField === "sentAt"}
                          ascending={sortOrder === "asc"}
                          onToggle={toggleSort}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((email) => {
                      const meta = TYPE_BADGE[email.type];
                      const failed = email.status === "failed";
                      const studentName = email.studentId
                        ? studentNameById.get(email.studentId)
                        : undefined;
                      const TypeIcon =
                        email.type === "lesson_cancel"
                          ? Ban
                          : email.type === "lesson_notify"
                            ? CalendarClock
                            : FileText;
                      return (
                        <TableRow
                          key={email.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(email)}
                        >
                          <TableCell className="pl-4 overflow-hidden">
                            <div className="flex items-start gap-2">
                              <TypeIcon
                                className={`mt-0.5 h-4 w-4 shrink-0 ${
                                  failed
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                }`}
                              />
                              <div className="min-w-0">
                                <p className="truncate font-medium">
                                  {email.subject || "(no subject)"}
                                </p>
                                {failed && email.errorMessage ? (
                                  <p className="truncate text-xs text-destructive">
                                    {email.errorMessage}
                                  </p>
                                ) : (
                                  <p className="truncate text-xs text-muted-foreground lg:hidden">
                                    {formatDateTime(email.sentAt)}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={meta.variant}
                              className="pointer-events-none font-normal"
                            >
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="overflow-hidden text-muted-foreground">
                            <span className="block truncate">
                              {studentName ?? "—"}
                            </span>
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="hidden overflow-hidden text-muted-foreground xl:table-cell">
                              <span className="block truncate">
                                {email.tutorName ?? "—"}
                              </span>
                            </TableCell>
                          )}
                          <TableCell className="hidden overflow-hidden text-muted-foreground md:table-cell">
                            <span className="block truncate">
                              {email.to.join(", ")}
                            </span>
                          </TableCell>
                          <TableCell>
                            {failed ? (
                              <Badge variant="danger">Failed</Badge>
                            ) : (
                              <Badge variant="success">Delivered</Badge>
                            )}
                          </TableCell>
                          <TableCell className="hidden text-muted-foreground lg:table-cell">
                            {formatDateTime(email.sentAt)}
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
                {visible.length} {visible.length === 1 ? "email" : "emails"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <EmailViewerDialog
        email={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
