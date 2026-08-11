import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  DollarSign,
  Globe,
  Mail,
  Pencil,
  Phone,
  Users,
} from "lucide-react";
import { formatPhoneNumberIntl } from "react-phone-number-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StudentForm } from "./StudentForm";
import { useGetStudent, useUpdateStudent } from "./api";
import { useStudentInvoices, useStudentDebt } from "./invoices-api";
import { formToUpdateRequest, type StudentFormData } from "./student-schema";
import { SubjectChips } from "@/components/subjects/SubjectChips";
import { useSubjectMap, resolveSubjectNames } from "@/lib/subjects";
import {
  formatCurrency,
  getInitials,
  rateTypeLabel,
  studentToFormValues,
} from "./student-utils";
import type { Invoice } from "@examify-tms/interfaces";
import { useUserCurrency } from "@/lib/use-currency";
import { EmailHistory } from "@/features/emails/EmailHistory";
import { formatDate } from "@/features/payments/invoice-utils";
import {
  DetailRow,
  StudentInvoicesCard,
  StudentNotesCard,
} from "./detail/components";

const billingEmailSourceLabel: Record<
  "explicit" | "parent" | "student",
  string
> = {
  explicit: "Custom",
  parent: "Parent email",
  student: "Student email",
};

export default function StudentDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const currency = useUserCurrency();
  const { data: student, isLoading, error } = useGetStudent(studentId);
  const { data: invoices = [] } = useStudentInvoices(studentId);
  const { data: totalDebt = 0 } = useStudentDebt(studentId);
  const updateStudent = useUpdateStudent();
  const subjectMap = useSubjectMap();
  const [editing, setEditing] = useState(false);

  async function handleEdit(values: StudentFormData) {
    if (!student) return;
    await updateStudent.mutateAsync({
      id: student.id,
      data: formToUpdateRequest(values),
    });
    setEditing(false);
  }

  async function handleSaveNotes(notes: string | null) {
    if (!student) return;
    await updateStudent.mutateAsync({
      id: student.id,
      data: { notes },
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading students...</p>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <Users className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="font-medium">Student not found</p>
          <p className="text-sm text-muted-foreground">
            This student may have been removed.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/students">
            <ArrowLeft className="h-4 w-4" />
            Back to Students
          </Link>
        </Button>
      </div>
    );
  }

  const frequencyUnit =
    student.rateType === "hourly" ? "hours / week" : "lessons / week";

  const openInvoices = invoices.filter(
    (inv: Invoice) => inv.status === "open" || inv.status === "overdue",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 text-muted-foreground"
          onClick={() => navigate("/students")}
        >
          <ArrowLeft className="h-4 w-4" />
          Students
        </Button>
        <Button size="sm" onClick={() => setEditing(true)}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-medium text-primary">
              {getInitials(student.name)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {student.name}
                </h1>
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
              {student.subjectIds?.length ? (
                <SubjectChips subjectIds={student.subjectIds} />
              ) : (
                <p className="text-sm text-muted-foreground">No subjects</p>
              )}
            </div>
          </div>
          {totalDebt > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Outstanding Balance
              </p>
              <p className="text-2xl font-bold text-destructive">
                {formatCurrency(totalDebt, currency)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={student.email}
            />
            <DetailRow
              icon={<BookOpen className="h-4 w-4" />}
              label="Subjects"
              value={
                student.subjectIds?.length
                  ? resolveSubjectNames(
                      student.subjectIds,
                      Array.from(subjectMap.values()),
                    )
                  : "\u2014"
              }
              muted={!student.subjectIds?.length}
            />
            <DetailRow
              icon={<Phone className="h-4 w-4" />}
              label="Phone"
              value={
                student.phone ? formatPhoneNumberIntl(student.phone) : "\u2014"
              }
              muted={!student.phone}
            />
            <DetailRow
              icon={<Users className="h-4 w-4" />}
              label="Parent Email"
              value={student.parentEmail ?? "—"}
              muted={!student.parentEmail}
            />
            <DetailRow
              icon={<Clock className="h-4 w-4" />}
              label="Frequency"
              value={`${student.frequencyPerWeek} ${frequencyUnit}`}
            />
            <DetailRow
              icon={<Globe className="h-4 w-4" />}
              label="Timezone"
              value={student.timezone ?? "Not specified"}
              muted={!student.timezone}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                Billing Email
              </span>
              <div className="text-right">
                <p className="max-w-[200px] truncate font-medium">
                  {student.billingEmail}
                </p>
                <p className="text-xs text-muted-foreground">
                  {billingEmailSourceLabel[student.billingEmailSource]}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Rate
              </span>
              <span className="font-medium">
                {formatCurrency(student.expectedAmount, currency)}{" "}
                <span className="text-muted-foreground">
                  ({rateTypeLabel[student.rateType]})
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Expected / week
              </span>
              <span className="font-medium">
                {formatCurrency(
                  student.expectedAmount * student.frequencyPerWeek,
                  currency,
                )}
              </span>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm font-medium text-muted-foreground">
                Owed
              </span>
              <span
                className={
                  totalDebt > 0
                    ? "font-bold text-destructive"
                    : "font-medium text-emerald-600 dark:text-emerald-400"
                }
              >
                {totalDebt > 0
                  ? formatCurrency(totalDebt, currency)
                  : "Nothing due"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <StudentInvoicesCard invoices={openInvoices} />

      <StudentNotesCard
        notes={student.notes}
        isSaving={updateStudent.isPending}
        onSave={handleSaveNotes}
      />

      <EmailHistory studentId={student.id} />

      <p className="text-xs text-muted-foreground">
        Added {formatDate(student.createdAt)} · Updated{" "}
        {formatDate(student.updatedAt)}
      </p>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update the student's details below.
            </DialogDescription>
          </DialogHeader>
          <StudentForm
            key={student.id}
            defaultValues={studentToFormValues(student)}
            submitLabel="Save Changes"
            onCancel={() => setEditing(false)}
            onSubmit={handleEdit}
            disabled={updateStudent.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
