import { Check } from "lucide-react";
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
} from "@/components/ui";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "../invoice-utils";
import type { CreateInvoiceFormData } from "../invoice-schema";

interface InvoiceDetailsSidebarProps {
  billingEmail: string;
  dueDate: string;
  paymentMethod: CreateInvoiceFormData["paymentMethod"];
  notes: string;
  resolvedBillingEmail: string;
  subtotal: number;
  currency: string;
  createPending: boolean;
  sendPending: boolean;
  hasLineItems: boolean;
  hasStudent: boolean;
  onBillingEmailChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onPaymentMethodChange: (
    value: CreateInvoiceFormData["paymentMethod"],
  ) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (status: "draft" | "open", sendEmail: boolean) => void;
}

/**
 * Sidebar: invoice details form (billing email, due date, payment method,
 * notes), a recipient/total summary, and the create / create-and-send / draft
 * action buttons.
 */
export function InvoiceDetailsSidebar({
  billingEmail,
  dueDate,
  paymentMethod,
  notes,
  resolvedBillingEmail,
  subtotal,
  currency,
  createPending,
  sendPending,
  hasLineItems,
  hasStudent,
  onBillingEmailChange,
  onDueDateChange,
  onPaymentMethodChange,
  onNotesChange,
  onSubmit,
}: InvoiceDetailsSidebarProps) {
  const disabled =
    createPending || sendPending || !hasLineItems || !hasStudent;

  return (
    <>
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
              placeholder={resolvedBillingEmail}
              value={billingEmail}
              onChange={(e) => onBillingEmailChange(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Defaults to the student's billing email. Leave blank to use{" "}
              {resolvedBillingEmail || "—"}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) =>
                onPaymentMethodChange(v as CreateInvoiceFormData["paymentMethod"])
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
            <Textarea
              id="notes"
              rows={3}
              placeholder="Payment instructions, thank-you note..."
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
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
            <Button onClick={() => onSubmit("open", true)} disabled={disabled}>
              <Check className="h-4 w-4" />
              {sendPending
                ? "Sending..."
                : createPending
                  ? "Creating..."
                  : "Create & Send"}
            </Button>
            <Button
              variant="outline"
              onClick={() => onSubmit("open", false)}
              disabled={disabled}
            >
              {createPending ? "Creating..." : "Create"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => onSubmit("draft", false)}
              disabled={disabled}
            >
              Save as Draft
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
