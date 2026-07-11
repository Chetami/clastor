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
  StickyNote,
  Users,
  FileText,
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
import { Badge } from "@/components/ui/badge";
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
  const [notesEditing, setNotesEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");

  async function handleEdit(values: StudentFormData) {
    if (!student) return;
    await updateStudent.mutateAsync({
      id: student.id,
      data: formToUpdateRequest(values),
    });
    setEditing(false);
  }

  function startEditNotes() {
    if (!student) return;
    setNotesDraft(student.notes ?? "");
    setNotesEditing(true);
  }

  function saveNotes() {
    if (!student) return;
    const trimmed = notesDraft.trim();
    console.log("Notes saved locally:", trimmed);
    setNotesEditing(false);
  }

  const openInvoices = invoices.filter(
    (inv: Invoice) => inv.status === "open" || inv.status === "overdue",
  );

  function getInvoiceStatusColor(status: Invoice["status"]) {
    switch (status) {
      case "paid":
        return "default";
      case "overdue":
        return "destructive";
      case "open":
        return "secondary";
      default:
        return "outline";
    }
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
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
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
                  student.rateType === "hourly"
                    ? student.expectedAmount * student.frequencyPerWeek
                    : student.expectedAmount * student.frequencyPerWeek,
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
                {totalDebt > 0 ? formatCurrency(totalDebt, currency) : "Nothing due"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {openInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Open Invoices ({openInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {openInvoices.map((invoice: Invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {invoice.invoiceNumber}
                        </span>
                        <Badge variant={getInvoiceStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.lineItems.length} lesson
                        {invoice.lineItems.length !== 1 ? "s" : ""} · Due{" "}
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString()
                          : "No due date"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(invoice.total, invoice.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.issueDate
                        ? new Date(invoice.issueDate).toLocaleDateString()
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <StickyNote className="h-4 w-4" />
            Notes
          </CardTitle>
          {!notesEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={startEditNotes}
            >
              <Pencil className="h-3.5 w-3.5" />
              {student.notes ? "Edit" : "Add note"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {notesEditing ? (
            <div className="space-y-3">
              <textarea
                autoFocus
                rows={5}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Add notes about this student..."
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNotesEditing(false)}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={saveNotes}>
                  Save
                </Button>
              </div>
            </div>
          ) : student.notes ? (
            <p className="whitespace-pre-wrap text-sm">{student.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          )}
        </CardContent>
      </Card>

      <EmailHistory studentId={student.id} />

      <p className="text-xs text-muted-foreground">
        Added {new Date(student.createdAt).toLocaleDateString()} · Updated{" "}
        {new Date(student.updatedAt).toLocaleDateString()}
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

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}

function DetailRow({ icon, label, value, muted }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={
            muted
              ? "truncate text-sm text-muted-foreground"
              : "truncate text-sm font-medium"
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}
