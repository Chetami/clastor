import {
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Mail,
} from "lucide-react";
import type { InvoiceResponse } from "@examify-tms/interfaces";
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
  PAYMENT_METHOD_LABELS,
  STATUS_META,
  formatCurrency,
  formatDate,
} from "../invoice-utils";

interface InvoiceDetailsCardProps {
  invoice: InvoiceResponse;
}

/** The "Invoice Details" grid card: number, dates, status, email, payment. */
export function InvoiceDetailsCard({ invoice }: InvoiceDetailsCardProps) {
  const meta = STATUS_META[invoice.status];
  const hasBeenSent = invoice.sentAt !== null && invoice.sentAt !== undefined;
  return (
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
            <div className="font-medium">{formatDate(invoice.issueDate)}</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Due date
            </div>
            <div className="font-medium">{formatDate(invoice.dueDate)}</div>
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

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            Email
          </div>
          <div className="text-sm font-medium">
            {hasBeenSent ? (
              <span>
                Sent{" "}
                <span className="text-muted-foreground">
                  on {formatDate(invoice.sentAt as string)}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Not sent yet</span>
            )}
          </div>
        </div>

        {invoice.paidAt && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Paid on
            </div>
            <div className="font-medium">{formatDate(invoice.paidAt)}</div>
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
  );
}

interface InvoiceLineItemsTableProps {
  invoice: InvoiceResponse;
}

/** Read-only line-items table with a subtotal/total summary. */
export function InvoiceLineItemsTable({ invoice }: InvoiceLineItemsTableProps) {
  return (
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
                  <TableCell className="text-sm">{li.description}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {li.rateType === "hourly" ? "Hourly" : "Per lesson"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {li.quantity}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {formatCurrency(li.unitAmount, invoice.currency)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatCurrency(li.amount, invoice.currency)}
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
              <span>{formatCurrency(invoice.subtotal, invoice.currency)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 text-base font-semibold">
              <span>Total</span>
              <span>{formatCurrency(invoice.total, invoice.currency)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
