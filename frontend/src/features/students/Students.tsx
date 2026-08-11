import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  FileSpreadsheet,
  Plus,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { StudentResponse } from "@examify-tms/interfaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import type { StudentFormData } from "./student-schema";
import {
  useCreateStudent,
  useListStudents,
  useUpdateStudent,
} from "./api";
import { useSubjectMap, useSubjects } from "@/lib/subjects";
import {
  downloadCsv,
  STUDENT_CSV_TEMPLATE,
  studentsToCsv,
  studentToFormValues,
} from "./student-utils";
import { useStudentsDebts } from "./invoices-api";
import { useUserCurrency } from "@/lib/use-currency";
import { FilterOption, StudentListItem } from "./list/components";
import { StudentFormDialog } from "./list/StudentFormDialog";
import { ImportStudentsDialog } from "./list/ImportStudentsDialog";

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

  const createStudent = useCreateStudent();
  const updateStudent = useUpdateStudent();

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

    return [...filtered].sort((a, b) => {
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
  }, [students, statusFilter, search, sortKey, studentDebts, subjectMap]);

  async function handleAdd(values: StudentFormData) {
    try {
      const billingEmail =
        values.billingEmailMode === "auto"
          ? undefined
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
    }
  }

  async function handleEdit(values: StudentFormData) {
    if (!editing) return;
    try {
      const billingEmail =
        values.billingEmailMode === "auto"
          ? null
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
    toast.success(
      `Exported ${students.length} student${students.length === 1 ? "" : "s"}.`,
    );
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
                  <DropdownMenuItem onSelect={() => setImportOpen(true)}>
                    <Upload className="h-4 w-4" />
                    Import from CSV…
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleExport}>
                    <Download className="h-4 w-4" />
                    Export to CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() =>
                      downloadCsv("students-template.csv", STUDENT_CSV_TEMPLATE)
                    }
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Download template
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                disabled={createStudent.isPending}
                data-tour="add-student"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add Student
              </Button>
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
                  const debtQueryIndex = studentIds.indexOf(student.id);
                  return (
                    <StudentListItem
                      key={student.id}
                      student={student}
                      debt={studentDebts[student.id] ?? 0}
                      isLoadingDebt={
                        debtQueryIndex >= 0 &&
                        (debtQueries[debtQueryIndex]?.isLoading ?? false)
                      }
                      currency={currency}
                      onNavigate={() => navigate(`/students/${student.id}`)}
                      onEdit={() => setEditing(student)}
                    />
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <StudentFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Add Student"
        submitLabel={createStudent.isPending ? "Creating..." : "Save Student"}
        onSubmit={handleAdd}
        onCancel={() => setAddOpen(false)}
        disabled={createStudent.isPending}
      />

      <StudentFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title="Edit Student"
        description="Update the student's details below."
        submitLabel={updateStudent.isPending ? "Saving..." : "Save Changes"}
        onSubmit={handleEdit}
        onCancel={() => setEditing(null)}
        disabled={updateStudent.isPending}
        defaultValues={editing ? studentToFormValues(editing) : undefined}
        formKey={editing?.id}
      />

      <ImportStudentsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
