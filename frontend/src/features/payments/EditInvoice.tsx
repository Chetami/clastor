import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  DollarSign,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
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
import { useGetInvoice } from "./api/use-get-invoice";
import { useUpdateInvoice } from "./api/use-update-invoice";
import { useListStudents } from "@/features/students/api";
import { formatCurrency } from "./invoice-utils";

interface LineItemDraft {
  lessonId: string;
  description: string;
  durationMinutes: number;
  rateType: "hourly" | "per_lesson";
  unitAmount: number;
  quantity: number;
}

export default function EditInvoice() {
  const navigate = useNavigate();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data: invoice, isLoading: isLoadingInvoice, error: invoiceError } = useGetInvoice(invoiceId ?? "");
  const { data: students = [] } = useListStudents();
  const updateInvoice = useUpdateInvoice();

  const [lineItemAmounts, setLineItemAmounts] = useState<Record<string, number>>({});
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<"cash" | "bank_transfer" | "card" | "stripe">("bank_transfer");
  const [notes, setNotes] = useState("");

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === invoice?.studentId) ?? null,
    [students, invoice?.studentId],
  );

  const lineItems: LineItemDraft[] = useMemo(() => {
    if (!invoice) return [];
    return invoice.lineItems.map((li) => ({
      lessonId: li.lessonId,
      description: li.description,
      durationMinutes: li.durationMinutes,
      rateType: li.rateType,
      unitAmount: lineItemAmounts[li.lessonId] ?? li.unitAmount,
      quantity: li.quantity,
    }));
  }, [invoice, lineItemAmounts]);

  const subtotal = useMemo(
    () =>
      Math.round(
        lineItems.reduce((sum, li) => sum + li.unitAmount * li.quantity, 0) *
          100,
      ) / 100,
    [lineItems],
  );

  useEffect(() => {
    if (invoice) {
      setDueDate(new Date(invoice.dueDate).toISOString().slice(0, 10));
      setPaymentMethod(invoice.paymentMethod ?? "bank_transfer");
      setNotes(invoice.notes ?? "");
      const amounts: Record<string, number> = {};
      invoice.lineItems.forEach((li) => {
        amounts[li.lessonId] = li.unitAmount;
      });
      setLineItemAmounts(amounts);
    }
  }, [invoice]);

  function updateAmount(lessonId: string, value: string) {
    const num = Number(value);
    setLineItemAmounts((prev) => ({
      ...prev,
      [lessonId]: Number.isNaN(num) ? 0 : num,
    }));
  }

  async function handleSubmit(status: "draft" | "open") {
    if (!invoice) return;

    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        data: {
          lineItems: lineItems.map((li) => ({
            lessonId: li.lessonId,
            description: li.description,
            durationMinutes: li.durationMinutes,
            rateType: li.rateType,
            unitAmount: li.unitAmount,
            quantity: li.quantity,
          })),
          dueDate: new Date(dueDate).toISOString(),
          paymentMethod,
          notes: notes.trim() || null,
          status,
        },
      });
      navigate("/payments");
    } catch (error) {
      console.error("Failed to update invoice:", error);
    }
  }

  if (isLoadingInvoice) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invoiceError || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <p className="text-sm text-destructive">Failed to load invoice.</p>
        <Button variant="ghost" onClick={() => navigate("/payments")}>
          Go back
        </Button>
      </div>
    );
  }

  if (invoice.status !== "draft") {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <p className="text-sm text-muted-foreground">
          Only draft invoices can be edited.
        </p>
        <Button variant="ghost" onClick={() => navigate("/payments")}>
          Go back
        </Button>
      </div>
    );
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
            Edit Invoice {invoice.invoiceNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Modify the invoice details before sending.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Customer</h2>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground">Name:</span>{" "}
                    {invoice.customerName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rate:</span>{" "}
                    {formatCurrency(selectedStudent?.expectedAmount ?? 0)}
                    {selectedStudent?.rateType === "hourly" ? "/hr" : "/lesson"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Line items</h2>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Hours/Qty</TableHead>
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
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {li.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={li.unitAmount}
                              onChange={(e) =>
                                updateAmount(li.lessonId, e.target.value)
                              }
                              className="h-8 w-24 text-right"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(li.unitAmount * li.quantity)}
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
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                  value={invoice.billingEmail ?? ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Billing email cannot be changed after invoice creation.
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
                    setPaymentMethod(v as "cash" | "bank_transfer" | "card" | "stripe")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
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
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">
                  {formatCurrency(subtotal)}
                </span>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => handleSubmit("open")}
                  disabled={
                    updateInvoice.isPending ||
                    lineItems.length === 0
                  }
                >
                  <Check className="h-4 w-4" />
                  {updateInvoice.isPending ? "Updating..." : "Update & Send"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSubmit("draft")}
                  disabled={
                    updateInvoice.isPending ||
                    lineItems.length === 0
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