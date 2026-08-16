import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  DollarSign,
  Edit,
  Mail,
  Printer,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useGetInvoice,
  useMarkInvoicePaid,
  useVoidInvoice,
  getInvoicePdfRequest,
} from "./api";
import { InvoiceTimeline } from "./InvoiceTimeline";
import { EmailHistory } from "@/features/emails/EmailHistory";
import { SendInvoiceDialog } from "@/components/send-invoice-dialog";
import { EmailGuard } from "@/components/email-guard";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonCard,
  SkeletonPageHeader,
  SkeletonTable,
  SkeletonTimeline,
} from "@/components/skeletons";
import { formatCurrency } from "./invoice-utils";
import { InvoiceDetailsCard, InvoiceLineItemsTable } from "./detail/components";

export default function InvoiceDetail() {
  const navigate = useNavigate();
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data: invoice, isLoading, error } = useGetInvoice(invoiceId ?? "");
  const markPaid = useMarkInvoicePaid();
  const voidInvoice = useVoidInvoice();
  const [actionError, setActionError] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);

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
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to generate invoice PDF",
      );
    }
  }

  async function handleMarkPaid() {
    if (!invoice) return;
    try {
      await markPaid.mutateAsync({ id: invoice.id });
      toast.success("Invoice marked as paid");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Failed to mark invoice as paid",
      );
    }
  }

  async function handleVoid() {
    if (!invoice) return;
    try {
      await voidInvoice.mutateAsync(invoice.id);
      toast.success("Invoice voided");
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Failed to void invoice",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <SkeletonPageHeader />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <SkeletonTable
                  columns={["w-[42%]", "w-[14%]", "w-[14%]", "w-[16%]"]}
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <SkeletonCard titleWidth="w-16" lines={2} />
            <SkeletonCard titleWidth="w-14" lines={2} />
            <div className="space-y-3">
              <Skeleton className="h-3.5 w-16" />
              <SkeletonTimeline rows={3} />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-3.5 w-24" />
              <SkeletonTimeline rows={2} />
            </div>
          </div>
        </div>
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

  const isDraft = invoice.status === "draft";
  const hasBeenSent = invoice.sentAt !== null && invoice.sentAt !== undefined;
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
              onClick={() => navigate(`/payments/${invoice.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {canMarkPaid && (
            <Button size="sm" disabled={markPaid.isPending} onClick={handleMarkPaid}>
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
          <InvoiceDetailsCard invoice={invoice} />
          <InvoiceLineItemsTable invoice={invoice} />
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
                  <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(invoice.total, invoice.currency)}</span>
                </div>
              </div>
              {canSend && (
                <EmailGuard hasEmail={!!invoice.billingEmail?.trim()}>
                  <Button className="w-full" onClick={() => setSendOpen(true)}>
                    <Send className="h-4 w-4 mr-2" />
                    {hasBeenSent ? "Resend invoice" : "Send invoice"}
                  </Button>
                </EmailGuard>
              )}
            </CardContent>
          </Card>

          <InvoiceTimeline invoiceId={invoice.id} />

          <EmailHistory invoiceId={invoice.id} variant="bare" />
        </div>
      </div>

      <SendInvoiceDialog
        invoiceId={sendOpen && invoice ? invoice.id : null}
        onClose={() => setSendOpen(false)}
      />
    </div>
  );
}
