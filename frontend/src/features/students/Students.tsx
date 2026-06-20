import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownUp,
  ChevronRight,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import type { StudentResponse } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { StudentForm } from "./StudentForm";
import type { StudentFormData } from "./student-schema";
import { useCreateStudent, useListStudents } from "./api";
import {
  compactCurrency,
  formatCurrency,
  formatFrequency,
  getInitials,
  rateUnit,
  studentToFormValues,
} from "./student-utils";

type StatusFilter = StudentResponse["status"] | "all";
type SortKey = "name-asc" | "name-desc" | "amount-high" | "amount-low" | "updated";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "amount-high", label: "Amount (High–Low)" },
  { value: "amount-low", label: "Amount (Low–High)" },
  { value: "updated", label: "Recently Updated" },
];

export default function Students() {
  const navigate = useNavigate();
  const { data: students = [], isLoading, error } = useListStudents();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name-asc");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<StudentResponse | null>(null);

  const createStudent = useCreateStudent();

  const activeCount = students.filter((s) => s.status === "active").length;
  const pastCount = students.filter((s) => s.status === "past").length;

  const activeStudents = students.filter((s) => s.status === "active");
  const outstanding = activeStudents.reduce(
    (sum, s) => sum + s.amountOwed,
    0,
  );
  const owingCount = activeStudents.filter((s) => s.amountOwed > 0).length;

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = students.filter((s) => {
      const matchesStatus =
        statusFilter === "all" || s.status === statusFilter;
      const matchesSearch =
        query.length === 0 ||
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.subject.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "amount-high":
          return b.expectedAmount - a.expectedAmount;
        case "amount-low":
          return a.expectedAmount - b.expectedAmount;
        case "updated":
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        default:
          return 0;
      }
    });
    return sorted;
  }, [students, statusFilter, search, sortKey]);

  async function handleAdd(values: StudentFormData) {
    try {
      await createStudent.mutateAsync({
        name: values.name,
        email: values.email,
        phone: values.phone?.trim() || undefined,
        parentEmail: values.parentEmail?.trim() || undefined,
        subject: values.subject,
        expectedAmount: values.expectedAmount,
        rateType: values.rateType,
        frequencyPerWeek: values.frequencyPerWeek,
        status: values.status,
        timezone: values.timezoneEnabled ? values.timezone ?? undefined : undefined,
        notes: values.notes?.trim() || undefined,
      });

      setAddOpen(false);
    } catch (error) {
      console.error("Failed to create student:", error);
      // Error will be handled by react-query automatically
    }
  }

  function handleEdit(_values: StudentFormData) {
    // TODO: Implement update endpoint
    // For now, just close the dialog
    setEditing(null);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
        <p className="text-sm text-muted-foreground">
          Manage your students and their billing details.
        </p>
      </div>

      {outstanding > 0 && (
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <Wallet className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            {formatCurrency(outstanding)}
          </span>
          <span className="text-muted-foreground">
            outstanding across {owingCount} active{" "}
            {owingCount === 1 ? "student" : "students"}
          </span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading students...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-destructive">Failed to load students. Please try again.</p>
        </div>
      )}

      {!isLoading && !error && (
        <Card>
          <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1">
              <FilterOption
                checked={statusFilter === "active"}
                label="Active"
                count={activeCount}
                onSelect={() => setStatusFilter("active")}
              />
              <FilterOption
                checked={statusFilter === "past"}
                label="Past"
                count={pastCount}
                onSelect={() => setStatusFilter("past")}
              />
              <FilterOption
                checked={statusFilter === "all"}
                label="All"
                count={activeCount + pastCount}
                onSelect={() => setStatusFilter("all")}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search students..."
                  className="w-full pl-8 sm:w-56"
                />
              </div>
              <div className="relative">
                <ArrowDownUp className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as SortKey)}
                  aria-label="Sort students"
                  className="h-9 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-44"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" disabled={createStudent.isPending}>
                    <Plus className="h-4 w-4" />
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Student</DialogTitle>
                    <DialogDescription>
                      Enter the student's details below. Click save when you're
                      done.
                    </DialogDescription>
                  </DialogHeader>
                  <StudentForm
                    submitLabel={createStudent.isPending ? "Creating..." : "Save Student"}
                    onCancel={() => setAddOpen(false)}
                    onSubmit={handleAdd}
                    disabled={createStudent.isPending}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {visibleStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {search.trim()
                    ? "No students match your search."
                    : `No ${statusFilter === "all" ? "" : statusFilter} students yet. Click "Add Student" to get started.`}
                </p>
              </div>
            ) : (
              <ul className="-mx-6 divide-y">
                {visibleStudents.map((student) => (
                  <li
                    key={student.id}
                    className="group flex cursor-pointer items-center justify-between gap-4 px-6 py-3 transition-colors hover:bg-accent/40"
                    onClick={() => navigate(`/students/${student.id}`)}
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
                          {compactCurrency(student.expectedAmount)}
                          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                            {rateUnit(student.rateType)}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFrequency(
                            student.frequencyPerWeek,
                            student.rateType,
                          )}
                        </p>
                      </div>
                      {student.amountOwed > 0 && (
                        <div className="hidden text-right lg:block">
                          <p className="font-medium text-destructive">
                            {formatCurrency(student.amountOwed)}
                          </p>
                          <p className="text-xs text-muted-foreground">owed</p>
                        </div>
                      )}
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
                          <DropdownMenuItem
                            onSelect={() => setEditing(student)}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() =>
                              navigate(`/students/${student.id}`)
                            }
                          >
                            <ChevronRight className="h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}


      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update the student's details below.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <StudentForm
              key={editing.id}
              defaultValues={studentToFormValues(editing)}
              submitLabel="Save Changes"
              onCancel={() => setEditing(null)}
              onSubmit={handleEdit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FilterOptionProps {
  checked: boolean;
  label: string;
  count: number;
  onSelect: () => void;
}

function FilterOption({ checked, label, count, onSelect }: FilterOptionProps) {
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
