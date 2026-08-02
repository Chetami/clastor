import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, DollarSign, Lock } from "lucide-react";
import type { LessonResponse } from "@examify-tms/interfaces";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Checkbox,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { useListStudents } from "@/features/students/api";
import { useSubjects, resolveSubjectNames } from "@/lib/subjects";
import { useListLessons } from "@/features/schedule/api";
import { lessonBadge } from "@/features/lessons/lesson-display";
import { useCreateInvoice, useSendInvoice } from "./api";
import {
  createInvoiceFormSchema,
  type CreateInvoiceFormData,
} from "./invoice-schema";
import {
  buildLessonLineItem,
  defaultInvoiceDueDateInput,
  formatCurrency,
  formatDate,
} from "./invoice-utils";
import { useUserCurrency } from "@/lib/use-currency";

interface LineItemDraft {
  lessonId: string;
  description: string;
  durationMinutes: number;
  rateType: "hourly" | "per_lesson";
  unitAmount: number;
  quantity: number;
}

function isCancelledLesson(lesson: LessonResponse): boolean {
  return (
    lesson.isCancelled ||
    lesson.attendanceStatus === "tutor_cancelled" ||
    lesson.attendanceStatus === "tutor_cancelled_makeup_issued"
  );
}

function isPastLesson(lesson: LessonResponse): boolean {
  return new Date(lesson.startDateTime).getTime() < Date.now();
}

export default function CreateInvoice() {
  const navigate = useNavigate();
  const currency = useUserCurrency();
  const { data: students = [] } = useListStudents();
  const subjects = useSubjects();

  const [studentId, setStudentId] = useState<string>("");
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

  const createInvoice = useCreateInvoice();
  const sendInvoice = useSendInvoice();

  const completedLessons = useMemo(
    () =>
      unpaidLessons
        .filter((l) => !isCancelledLesson(l) && isPastLesson(l))
        .sort(
          (a, b) =>
            new Date(b.startDateTime).getTime() -
            new Date(a.startDateTime).getTime(),
        ),
    [unpaidLessons],
  );

  const upcomingLessons = useMemo(
    () =>
      unpaidLessons
        .filter((l) => !isCancelledLesson(l) && !isPastLesson(l))
        .sort(
          (a, b) =>
            new Date(a.startDateTime).getTime() -
            new Date(b.startDateTime).getTime(),
        ),
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
  }, [selectedStudent, unpaidLessons, selectedLessonIds, lineItemAmounts, lineItemQuantities]);

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

      // Only the "Create & Send" path emails the invoice. The create
      // endpoint just persists to Firestore; the email is sent by the
      // dedicated /send endpoint (same path Resend uses).
      if (sendEmail) {
        await sendInvoice.mutateAsync({ id: created.id });
      }

      navigate("/payments");
    } catch (error) {
      console.error("Failed to create invoice:", error);
    }
  }

  return (
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

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
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
              ) : completedLessons.length === 0 &&
                upcomingLessons.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No unpaid lessons for this student.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Completed lessons */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      Completed lessons
                    </p>
                    {completedLessons.length === 0 ? (
                      <p className="py-3 text-center text-sm text-muted-foreground">
                        No completed unpaid lessons.
                      </p>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30">
                              <TableHead className="w-10" />
                              <TableHead>Lesson</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">
                                Duration
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {completedLessons.map((lesson) => (
                              <LessonRow
                                key={lesson.id}
                                lesson={lesson}
                                checked={selectedLessonIds.has(lesson.id)}
                                onToggle={() => toggleLesson(lesson.id)}
                                badge={lessonBadge(lesson)}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Upcoming lessons (collapsible for prepayment) */}
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
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform duration-200",
                              showUpcoming && "rotate-180",
                            )}
                          />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="p-4 pt-0 data-[state=open]:animate-in data-[state=open]:fade-in-0">
                        <div className="rounded-md border pt-4">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableHead className="w-10" />
                                <TableHead>Lesson</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">
                                  Duration
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {upcomingLessons.map((lesson) => (
                                <LessonRow
                                  key={lesson.id}
                                  lesson={lesson}
                                  checked={selectedLessonIds.has(lesson.id)}
                                  onToggle={() => toggleLesson(lesson.id)}
                                />
                              ))}
                            </TableBody>
                          </Table>
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
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">
                            Hours/Qty
                          </TableHead>
                          <TableHead className="text-right">Rate</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineItems.map((li) => (
                          <TableRow key={li.lessonId}>
                            <TableCell className="text-sm">
                              {li.description}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  lineItemQuantities[li.lessonId] ??
                                  li.quantity
                                }
                                onChange={(e) =>
                                  updateQuantity(li.lessonId, e.target.value)
                                }
                                className="h-8 w-20 text-right"
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <DollarSign className="h-3 w-3 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    lineItemAmounts[li.lessonId] ??
                                    li.unitAmount
                                  }
                                  onChange={(e) =>
                                    updateAmount(li.lessonId, e.target.value)
                                  }
                                  className="h-8 w-24 text-right"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {formatCurrency(
                                (lineItemAmounts[li.lessonId] ??
                                  li.unitAmount) * li.quantity,
                                currency,
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <div className="w-full max-w-xs space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal, currency)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-1 text-base font-semibold">
                        <span>Total</span>
                        <span>{formatCurrency(subtotal, currency)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: invoice details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Invoice details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="billingEmail">Billing Email</Label>
                <Input
                  id="billingEmail"
                  type="email"
                  placeholder={selectedStudent?.billingEmail ?? ""}
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Defaults to the student's billing email. Leave blank to use{" "}
                  {selectedStudent?.billingEmail ?? "—"}.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) =>
                    setPaymentMethod(
                      v as CreateInvoiceFormData["paymentMethod"],
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="stripe" disabled>
                      Stripe (disabled in demo)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">
                  Notes{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <textarea
                  id="notes"
                  rows={3}
                  placeholder="Payment instructions, thank-you note..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Recipient</span>
                <span className="truncate text-right max-w-[180px]">
                  {resolvedBillingEmail || "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">
                  {formatCurrency(subtotal, currency)}
                </span>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => handleSubmit("open", true)}
                  disabled={
                    createInvoice.isPending ||
                    sendInvoice.isPending ||
                    lineItems.length === 0 ||
                    !studentId
                  }
                >
                  <Check className="h-4 w-4" />
                  {sendInvoice.isPending
                    ? "Sending..."
                    : createInvoice.isPending
                      ? "Creating..."
                      : "Create & Send"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit("open", false)}
                  disabled={
                    createInvoice.isPending ||
                    sendInvoice.isPending ||
                    lineItems.length === 0 ||
                    !studentId
                  }
                >
                  {createInvoice.isPending ? "Creating..." : "Create"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => handleSubmit("draft", false)}
                  disabled={
                    createInvoice.isPending ||
                    sendInvoice.isPending ||
                    lineItems.length === 0 ||
                    !studentId
                  }
                >
                  Save as Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StepHeader({
  step,
  title,
  locked = false,
}: {
  step: number;
  title: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          locked
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground",
        )}
      >
        {locked ? <Lock className="h-3 w-3" /> : step}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
    </div>
  );
}

function LockedPlaceholder({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
      <Lock className="h-4 w-4 shrink-0" />
      {text}
    </div>
  );
}

interface LessonRowProps {
  lesson: LessonResponse;
  checked: boolean;
  onToggle: () => void;
  badge?: { label: string; tone: string };
}

function LessonRow({ lesson, checked, onToggle, badge }: LessonRowProps) {
  return (
    <TableRow
      onClick={onToggle}
      className="cursor-pointer"
      data-state={checked ? "selected" : undefined}
    >
      <TableCell>
        <Checkbox checked={checked} onChange={(e) => e.stopPropagation()} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{lesson.subject}</span>
          {badge && (
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                badge.tone,
              )}
            >
              {badge.label}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(lesson.startDateTime)}
      </TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">
        {lesson.durationMinutes} min
      </TableCell>
    </TableRow>
  );
}
