import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Mail,
  Printer,
  Edit,
  Send,
  Ban,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useGetInvoice,
  useMarkInvoicePaid,
  useVoidInvoice,
  useUpdateInvoice,
  useSendInvoice,
  getInvoicePdfRequest,
} from "./api";
import {
  STATUS_META,
  PAYMENT_METHOD_LABELS,
  formatCurrency,
  formatDate,
} from "./invoice-utils";

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data: invoice, isLoading, error } = useGetInvoice(invoiceId ?? "");
  const markPaid = useMarkInvoicePaid();
  const voidInvoice = useVoidInvoice();
  const updateInvoice = useUpdateInvoice();
  const sendInvoice = useSendInvoice();
  const [actionError, setActionError] = useState<string | null>(null);

  async function handlePrint() {
    if (!invoice) return;
    setActionError(null);
    try {
      const blob = await getInvoicePdfRequest(invoice.id);
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      // If the browser blocks the new tab, fall back to a download link.
      if (!win) {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${invoice.invoiceNumber}.pdf`;
        a.click();
      }
      // Revoke shortly after to let the viewer/print load.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to generate invoice PDF"
      );
    }
  }

  async function handleSend() {
    if (!invoice) return;
    setActionError(null);
    try {
      await sendInvoice.mutateAsync({ id: invoice.id });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to send invoice"
      );
    }
  }

  async function handleMarkPaid() {
    if (!invoice) return;
    await markPaid.mutateAsync({ id: invoice.id });
  }

  async function handleVoid() {
    if (!invoice) return;
    await voidInvoice.mutateAsync(invoice.id);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-muted-foreground">Loading invoice...</div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12">
        <p className="text-sm text-destructive">Failed to load invoice.</p>
        <Button variant="ghost" onClick={() => navigate("/payments")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to invoices
        </Button>
      </div>
    );
  }

  const meta = STATUS_META[invoice.status];
  const isDraft = invoice.status === "draft";
  const canSend = invoice.status !== "paid" && invoice.status !== "void";
  const canMarkPaid = invoice.status === "open" || invoice.status === "overdue";
  const canVoid = invoice.status !== "paid" && invoice.status !== "void";
  const canEdit = isDraft;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
              {invoice.invoiceNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              Invoice details for{" "}
              <button
                type="button"
                className="text-primary hover:underline font-medium"
                onClick={() => navigate(`/students/${invoice.studentId}`)}
              >
                {invoice.customerName}
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              disabled={updateInvoice.isPending}
              onClick={() => navigate(`/payments/${invoice.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canMarkPaid && (
            <Button
              size="sm"
              disabled={markPaid.isPending}
              onClick={handleMarkPaid}
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Mark as paid
            </Button>
          )}
          {canVoid && (
            <Button
              variant="destructive"
              size="sm"
              disabled={voidInvoice.isPending}
              onClick={handleVoid}
            >
              <Ban className="h-4 w-4 mr-2" />
              Void
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <p className="text-sm font-medium text-destructive">{actionError}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Invoice Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Invoice number
                  </div>
                  <div className="font-medium">{invoice.invoiceNumber}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Issue date
                  </div>
                  <div className="font-medium">
                    {formatDate(invoice.issueDate)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Due date
                  </div>
                  <div className="font-medium">
                    {formatDate(invoice.dueDate)}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Status
                  </div>
                  <div className="font-medium">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                </div>
              </div>

              {invoice.paidAt && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Paid on
                  </div>
                  <div className="font-medium">
                    {formatDate(invoice.paidAt)}
                  </div>
                </div>
              )}

              {invoice.paymentMethod && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    Payment method
                  </div>
                  <div className="font-medium">
                    {PAYMENT_METHOD_LABELS[invoice.paymentMethod]}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Invoice items</h2>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Rate Type</TableHead>
                      <TableHead className="text-right">Hours/Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.lineItems.map((li, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-sm">
                          {li.description}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {li.rateType === "hourly" ? "Hourly" : "Per lesson"}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {li.quantity}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatCurrency(li.unitAmount)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatCurrency(li.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 flex justify-end">
                <div className="w-full max-w-xs space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 text-base font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(invoice.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Bill To</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Name</div>
                <button
                  type="button"
                  className="font-medium text-primary hover:underline text-left"
                  onClick={() => navigate(`/students/${invoice.studentId}`)}
                >
                  {invoice.customerName}
                </button>
              </div>
              {invoice.billingEmail && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    Email
                  </div>
                  <div className="font-medium text-sm">
                    {invoice.billingEmail}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {invoice.notes && (
            <Card>
              <CardHeader>
                <h2 className="text-base font-semibold">Notes</h2>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {invoice.notes}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">Totals</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total)}</span>
                </div>
              </div>
              {canSend && (
                <Button
                  className="w-full"
                  disabled={sendInvoice.isPending}
                  onClick={handleSend}
                >
                  {sendInvoice.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {isDraft ? "Send invoice" : "Resend invoice"}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
