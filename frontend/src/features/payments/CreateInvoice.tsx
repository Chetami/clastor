import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { MorphChevron } from "@/components/ui/morph-chevron";
import { useListStudents } from "@/features/students/api";
import { useSubjects, resolveSubjectNames } from "@/lib/subjects";
import { useListLessons } from "@/features/schedule/api";
import { useCreateInvoice } from "./api";
import { SendInvoiceDialog } from "@/components/send-invoice-dialog";
import {
  createInvoiceFormSchema,
  type CreateInvoiceFormData,
} from "./invoice-schema";
import {
  buildLessonLineItem,
  defaultInvoiceDueDateInput,
  formatCurrency,
  partitionInvoiceableLessons,
} from "./invoice-utils";
import { useUserCurrency } from "@/lib/use-currency";
import {
  LockedPlaceholder,
  StepHeader,
  LessonsTable,
  UpcomingLessonsTable,
} from "./create-invoice/components";
import {
  LineItemsReviewTable,
  type LineItemDraft,
} from "./create-invoice/LineItemsReviewTable";
import { InvoiceDetailsSidebar } from "./create-invoice/InvoiceDetailsSidebar";

/**
 * "Create Invoice" page — a 3-step wizard (student → lessons → review) with a
 * details sidebar. State + submit logic live here; the lesson tables, line-item
 * review, and sidebar are extracted into `./create-invoice/` sub-components.
 */
export default function CreateInvoice() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currency = useUserCurrency();
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();

  // Deep-link preselection: `/payments/new?student=ID&lesson=ID`.
  const preselectStudentId = searchParams.get("student") ?? "";
  const preselectLessonId = searchParams.get("lesson") ?? "";

  const [studentId, setStudentId] = useState<string>(preselectStudentId);
  const [selectedLessonIds, setSelectedLessonIds] = useState<Set<string>>(
    new Set(),
  );
  const [lineItemAmounts, setLineItemAmounts] = useState<
    Record<string, number>
  >({});
  const [lineItemQuantities, setLineItemQuantities] = useState<
    Record<string, number>
  >({});
  const [billingEmail, setBillingEmail] = useState("");
  const [dueDate, setDueDate] = useState(() => defaultInvoiceDueDateInput());
  const [paymentMethod, setPaymentMethod] =
    useState<CreateInvoiceFormData["paymentMethod"]>("bank_transfer");
  const [notes, setNotes] = useState("");
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId],
  );

  const lessonsResult = useListLessons(
    studentId ? { studentId, unpaid: true } : undefined,
  );
  const unpaidLessons = useMemo(
    () => (studentId ? (lessonsResult.data ?? []) : []),
    [studentId, lessonsResult.data],
  );
  const lessonsLoading = studentId ? lessonsResult.isLoading : false;

  // Auto-check the lesson supplied via the `?lesson=` deep link.
  useEffect(() => {
    if (!preselectLessonId || unpaidLessons.length === 0) return;
    if (selectedLessonIds.has(preselectLessonId)) return;
    if (!unpaidLessons.some((l) => l.id === preselectLessonId)) return;
    setSelectedLessonIds((prev) => new Set(prev).add(preselectLessonId));
  }, [preselectLessonId, unpaidLessons, selectedLessonIds]);

  const createInvoice = useCreateInvoice();
  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);

  const { upcoming: upcomingLessons, completed: completedLessons } = useMemo(
    () => partitionInvoiceableLessons(unpaidLessons),
    [unpaidLessons],
  );

  const lineItems: LineItemDraft[] = useMemo(() => {
    if (!selectedStudent) return [];
    return unpaidLessons
      .filter((l) => selectedLessonIds.has(l.id))
      .map((lesson) => {
        const base = buildLessonLineItem(
          lesson,
          selectedStudent.rateType,
          selectedStudent.expectedAmount,
        );
        const quantityOverride = lineItemQuantities[lesson.id];
        const amountOverride = lineItemAmounts[lesson.id];
        return {
          ...base,
          quantity:
            quantityOverride !== undefined ? quantityOverride : base.quantity,
          unitAmount:
            amountOverride !== undefined ? amountOverride : base.unitAmount,
        };
      });
  }, [
    selectedStudent,
    unpaidLessons,
    selectedLessonIds,
    lineItemAmounts,
    lineItemQuantities,
  ]);

  const subtotal = useMemo(
    () =>
      Math.round(
        lineItems.reduce((sum, li) => sum + li.unitAmount * li.quantity, 0) *
          100,
      ) / 100,
    [lineItems],
  );

  const resolvedBillingEmail =
    billingEmail || selectedStudent?.billingEmail || "";

  function toggleLesson(lessonId: string) {
    setSelectedLessonIds((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  }

  function updateAmount(lessonId: string, value: string) {
    const num = Number(value);
    setLineItemAmounts((prev) => ({
      ...prev,
      [lessonId]: Number.isNaN(num) ? 0 : num,
    }));
  }

  function updateQuantity(lessonId: string, value: string) {
    const num = Number(value);
    setLineItemQuantities((prev) => ({
      ...prev,
      [lessonId]: Number.isNaN(num) ? 0 : num,
    }));
  }

  async function handleSubmit(status: "draft" | "open", sendEmail: boolean) {
    const values: CreateInvoiceFormData = {
      studentId,
      lineItems: lineItems.map((li) => ({
        lessonId: li.lessonId,
        description: li.description,
        durationMinutes: li.durationMinutes,
        rateType: li.rateType,
        unitAmount: li.unitAmount,
        quantity: li.quantity,
      })),
      billingEmail: billingEmail.trim() || undefined,
      dueDate: new Date(dueDate).toISOString(),
      paymentMethod,
      notes: notes.trim() || undefined,
      status,
    };

    const result = createInvoiceFormSchema.safeParse(values);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    try {
      const created = await createInvoice.mutateAsync({
        studentId: result.data.studentId,
        lineItems: result.data.lineItems,
        billingEmail: result.data.billingEmail ?? null,
        dueDate: result.data.dueDate,
        paymentMethod: result.data.paymentMethod,
        notes: result.data.notes ?? null,
        status: result.data.status,
      });

      if (sendEmail) {
        setSendInvoiceId(created.id);
        return;
      }
      navigate("/payments");
    } catch (error) {
      console.error("Failed to create invoice:", error);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/payments")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Create Invoice
            </h1>
            <p className="text-sm text-muted-foreground">
              Build an invoice from a student's unpaid lessons.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {/* Step 1: Choose student */}
            <Card>
              <CardHeader>
                <StepHeader step={1} title="Choose a student" />
              </CardHeader>
              <CardContent>
                <Select
                  value={studentId}
                  onValueChange={(v) => {
                    setStudentId(v);
                    setSelectedLessonIds(new Set());
                    setLineItemAmounts({});
                    setLineItemQuantities({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a student..." />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => {
                      const subjectsLabel = resolveSubjectNames(
                        s.subjectIds,
                        subjects,
                      );
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                          {subjectsLabel ? ` — ${subjectsLabel}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {errors.studentId && (
                  <p className="mt-2 text-xs text-destructive">
                    {errors.studentId}
                  </p>
                )}
                {selectedStudent && (
                  <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Rate:</span>{" "}
                        {formatCurrency(selectedStudent.expectedAmount, currency)}
                        {selectedStudent.rateType === "hourly"
                          ? "/hr"
                          : "/lesson"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Billing email:
                        </span>{" "}
                        {selectedStudent.billingEmail}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 2: Select lessons */}
            <Card>
              <CardHeader>
                <StepHeader
                  step={2}
                  title="Select lessons"
                  locked={!selectedStudent}
                />
              </CardHeader>
              <CardContent>
                {!selectedStudent ? (
                  <LockedPlaceholder text="Select a student to choose lessons" />
                ) : lessonsLoading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Loading unpaid lessons...
                  </p>
                ) : completedLessons.chargeable.length === 0 &&
                  completedLessons.unrecorded.length === 0 &&
                  upcomingLessons.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No unpaid lessons for this student.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Completed lessons
                      </p>
                      {completedLessons.chargeable.length === 0 &&
                      completedLessons.unrecorded.length === 0 ? (
                        <p className="py-3 text-center text-sm text-muted-foreground">
                          No completed unpaid lessons.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {completedLessons.chargeable.length > 0 && (
                            <div>
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                                Recorded · ready to invoice
                                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                                  {completedLessons.chargeable.length}
                                </span>
                              </p>
                              <LessonsTable
                                lessons={completedLessons.chargeable}
                                selectedLessonIds={selectedLessonIds}
                                onToggle={toggleLesson}
                              />
                            </div>
                          )}
                          {completedLessons.unrecorded.length > 0 && (
                            <div>
                              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                                Not recorded
                                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                                  {completedLessons.unrecorded.length}
                                </span>
                              </p>
                              <LessonsTable
                                lessons={completedLessons.unrecorded}
                                selectedLessonIds={selectedLessonIds}
                                onToggle={toggleLesson}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {upcomingLessons.length > 0 && (
                      <Collapsible
                        open={showUpcoming}
                        onOpenChange={setShowUpcoming}
                        className="rounded-lg border"
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
                          >
                            <span>
                              Prepay upcoming lessons
                              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                {upcomingLessons.length}
                              </span>
                            </span>
                            <MorphChevron open={showUpcoming} />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="p-4 pt-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
                          <div className="rounded-md border pt-4">
                            <UpcomingLessonsTable
                              lessons={upcomingLessons}
                              selectedLessonIds={selectedLessonIds}
                              onToggle={toggleLesson}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                )}
                {errors.lineItems && (
                  <p className="mt-2 text-xs text-destructive">
                    {errors.lineItems}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Step 3: Review line items */}
            <Card>
              <CardHeader>
                <StepHeader
                  step={3}
                  title="Review line items"
                  locked={lineItems.length === 0}
                />
              </CardHeader>
              <CardContent>
                {lineItems.length === 0 ? (
                  <LockedPlaceholder text="Select lessons to review line items" />
                ) : (
                  <LineItemsReviewTable
                    lineItems={lineItems}
                    lineItemAmounts={lineItemAmounts}
                    lineItemQuantities={lineItemQuantities}
                    subtotal={subtotal}
                    currency={currency}
                    onUpdateAmount={updateAmount}
                    onUpdateQuantity={updateQuantity}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0 space-y-6">
            <InvoiceDetailsSidebar
              billingEmail={billingEmail}
              dueDate={dueDate}
              paymentMethod={paymentMethod}
              notes={notes}
              resolvedBillingEmail={resolvedBillingEmail}
              subtotal={subtotal}
              currency={currency}
              createPending={createInvoice.isPending}
              sendPending={false}
              hasLineItems={lineItems.length > 0}
              hasStudent={!!studentId}
              onBillingEmailChange={setBillingEmail}
              onDueDateChange={setDueDate}
              onPaymentMethodChange={setPaymentMethod}
              onNotesChange={setNotes}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>

      <SendInvoiceDialog
        invoiceId={sendInvoiceId}
        onClose={() => setSendInvoiceId(null)}
        onSent={() => navigate("/payments")}
      />
    </>
  );
}
