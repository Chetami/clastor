import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Download,
  FileSpreadsheet,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { StudentImportSummary, StudentResponse } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StudentForm } from "./StudentForm";
import type { StudentFormData } from "./student-schema";
import {
  useCreateStudent,
  useImportStudents,
  useListStudents,
  useUpdateStudent,
} from "./api";
import { useSubjectMap, useSubjects } from "@/lib/subjects";
import {
  compactCurrency,
  downloadCsv,
  formatCurrency,
  formatFrequency,
  getInitials,
  rateUnit,
  STUDENT_CSV_TEMPLATE,
  studentsToCsv,
  studentToFormValues,
} from "./student-utils";
import { useStudentsDebts } from "./invoices-api";
import { useUserCurrency } from "@/lib/use-currency";

type StatusFilter = StudentResponse["status"] | "all";
type SortKey =
  | "name-asc"
  | "name-desc"
  | "amount-high"
  | "amount-low"
  | "debt-high"
  | "debt-low"
  | "updated";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "amount-high", label: "Rate (High–Low)" },
  { value: "amount-low", label: "Rate (Low–High)" },
  { value: "debt-high", label: "Debt (High–Low)" },
  { value: "debt-low", label: "Debt (Low–High)" },
  { value: "updated", label: "Recently Updated" },
];

export default function Students() {
  const navigate = useNavigate();
  const currency = useUserCurrency();
  const { data: students = [], isLoading, error } = useListStudents();
  const subjectMap = useSubjectMap();
  const subjects = useSubjects();
  const studentIds = students.map((s) => s.id);
  const debtQueries = useStudentsDebts(studentIds);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name-asc");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<StudentResponse | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] =
    useState<StudentImportSummary | null>(null);

  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();
  const importStudents = useImportStudents();

  const activeCount = students.filter((s) => s.status === "active").length;
  const pastCount = students.filter((s) => s.status === "past").length;

  const studentDebts = useMemo(() => {
    const debts: Record<string, number> = {};
    studentIds.forEach((studentId, index) => {
      const query = debtQueries[index];
      if (query.data !== undefined) {
        debts[studentId] = query.data;
      }
    });
    return debts;
  }, [debtQueries, studentIds]);

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = students.filter((s) => {
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const matchesSearch =
        query.length === 0 ||
        s.name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        (s.subjectIds ?? []).some((id) =>
          subjectMap.get(id)?.name.toLowerCase().includes(query),
        );
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
        case "debt-high":
          return (studentDebts[b.id] || 0) - (studentDebts[a.id] || 0);
        case "debt-low":
          return (studentDebts[a.id] || 0) - (studentDebts[b.id] || 0);
        case "updated":
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        default:
          return 0;
      }
    });
    return sorted;
  }, [students, statusFilter, search, sortKey, studentDebts, subjectMap]);

  async function handleAdd(values: StudentFormData) {
    try {
      const billingEmail = values.useParentEmailAsBilling
        ? values.parentEmail?.trim() || undefined
        : values.billingEmail?.trim() || undefined;

      await createStudent.mutateAsync({
        name: values.name,
        email: values.email,
        phone: values.phone?.trim() || undefined,
        parentEmail: values.parentEmail?.trim() || undefined,
        billingEmail,
        subjectIds: values.subjectIds,
        expectedAmount: values.expectedAmount,
        rateType: values.rateType,
        frequencyPerWeek: values.frequencyPerWeek,
        status: values.status,
        timezone: values.timezoneEnabled
          ? (values.timezone ?? undefined)
          : undefined,
        notes: values.notes?.trim() || undefined,
      });

      setAddOpen(false);
    } catch (error) {
      console.error("Failed to create student:", error);
      // Error will be handled by react-query automatically
    }
  }

  async function handleEdit(values: StudentFormData) {
    if (!editing) return;
    try {
      const billingEmail = values.useParentEmailAsBilling
        ? values.parentEmail?.trim() || null
        : values.billingEmail?.trim() || null;

      await updateStudent.mutateAsync({
        id: editing.id,
        data: {
          name: values.name,
          email: values.email,
          phone: values.phone?.trim() || null,
          parentEmail: values.parentEmail?.trim() || null,
          billingEmail,
          subjectIds: values.subjectIds,
          expectedAmount: values.expectedAmount,
          rateType: values.rateType,
          frequencyPerWeek: values.frequencyPerWeek,
          status: values.status,
          timezone: values.timezoneEnabled
            ? (values.timezone ?? null)
            : null,
          notes: values.notes?.trim() || null,
        },
      });

      setEditing(null);
    } catch (error) {
      console.error("Failed to update student:", error);
      // Error will be handled by react-query automatically
    }
  }

  function handleExport() {
    if (students.length === 0) {
      toast.error("There are no students to export.");
      return;
    }
    const csv = studentsToCsv(students, subjects);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`students-${date}.csv`, csv);
    toast.success(`Exported ${students.length} student${students.length === 1 ? "" : "s"}.`);
  }

  function handleDownloadTemplate() {
    downloadCsv("students-template.csv", STUDENT_CSV_TEMPLATE);
  }

  function openImport() {
    setImportFile(null);
    setImportResult(null);
    setImportOpen(true);
  }

  async function handleImport() {
    if (!importFile) return;
    try {
      const summary = await importStudents.mutateAsync(importFile);
      setImportResult(summary);
      if (summary.created > 0) {
        toast.success(
          `Imported ${summary.created} student${summary.created === 1 ? "" : "s"}.`,
        );
      }
    } catch (error) {
      console.error("Failed to import students:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to import students.",
      );
    }
  }

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Loading students...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-destructive">
            Failed to load students. Please try again.
          </p>
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
              <Select
                value={sortKey}
                onValueChange={(v) => setSortKey(v as SortKey)}
              >
                <SelectTrigger aria-label="Sort students" className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-tour="csv-actions">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={openImport}>
                    <Upload className="h-4 w-4" />
                    Import from CSV…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExport}>
                    <Download className="h-4 w-4" />
                    Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleDownloadTemplate}>
                    <FileSpreadsheet className="h-4 w-4" />
                    Download template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={createStudent.isPending}
                    data-tour="add-student"
                  >
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
                    submitLabel={
                      createStudent.isPending ? "Creating..." : "Save Student"
                    }
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
                {visibleStudents.map((student) => {
                  const debt = studentDebts[student.id] ?? 0;
                  const hasDebt = debt > 0;
                  const debtQueryIndex = studentIds.indexOf(student.id);
                  const isLoadingDebt =
                    debtQueryIndex >= 0 &&
                    (debtQueries[debtQueryIndex]?.isLoading ?? false);

                  return (
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
                            <p className="truncate font-medium">
                              {student.name}
                            </p>
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
                            {formatFrequency(
                              student.frequencyPerWeek,
                              student.rateType,
                            )}
                          </p>
                          {hasDebt && (
                            <p className="text-xs font-medium text-destructive">
                              {isLoadingDebt ? (
                                <span className="text-muted-foreground">
                                  Loading...
                                </span>
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
                  );
                })}
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
              submitLabel={
                updateStudent.isPending ? "Saving..." : "Save Changes"
              }
              onCancel={() => setEditing(null)}
              onSubmit={handleEdit}
              disabled={updateStudent.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setImportFile(null);
            setImportResult(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import students from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with a header row. Subject names must match your
              subject catalogue and are separated by semicolons (e.g.
              <span className="font-medium"> Mathematics; Physics</span>).
              Existing emails are skipped.
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-md border p-3">
                  <p className="text-2xl font-semibold">
                    {importResult.total}
                  </p>
                  <p className="text-xs text-muted-foreground">Rows</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                    {importResult.created}
                  </p>
                  <p className="text-xs text-muted-foreground">Created</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-2xl font-semibold text-destructive">
                    {importResult.skipped}
                  </p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  <ul className="divide-y text-sm">
                    {importResult.errors.map((e, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 px-3 py-2"
                      >
                        <span className="shrink-0 rounded bg-muted px-1.5 text-xs text-muted-foreground">
                          row {e.row}
                        </span>
                        <span className="text-muted-foreground">
                          {e.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <Input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={(e) =>
                    setImportFile(e.target.files?.[0] ?? null)
                  }
                />
                {importFile && (
                  <p className="text-xs text-muted-foreground">
                    Selected: {importFile.name}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs text-primary underline-offset-2 hover:underline"
              >
                Download a CSV template
              </button>
            </div>
          )}

          <DialogFooter>
            {importResult ? (
              <Button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setImportFile(null);
                  setImportResult(null);
                }}
              >
                Done
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setImportOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!importFile || importStudents.isPending}
                  onClick={handleImport}
                >
                  {importStudents.isPending ? "Importing…" : "Import"}
                </Button>
              </>
            )}
          </DialogFooter>
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
