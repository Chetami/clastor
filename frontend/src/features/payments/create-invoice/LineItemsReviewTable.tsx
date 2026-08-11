import { DollarSign } from "lucide-react";
import {
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatCurrency } from "../invoice-utils";

export interface LineItemDraft {
  lessonId: string;
  description: string;
  durationMinutes: number;
  rateType: "hourly" | "per_lesson";
  unitAmount: number;
  quantity: number;
}

interface LineItemsReviewTableProps {
  lineItems: LineItemDraft[];
  lineItemAmounts: Record<string, number>;
  lineItemQuantities: Record<string, number>;
  subtotal: number;
  currency: string;
  onUpdateAmount: (lessonId: string, value: string) => void;
  onUpdateQuantity: (lessonId: string, value: string) => void;
}

/**
 * Step 3: editable review of the invoice line items (quantity + rate per row)
 * plus the subtotal/total summary. Purely presentational.
 */
export function LineItemsReviewTable({
  lineItems,
  lineItemAmounts,
  lineItemQuantities,
  subtotal,
  currency,
  onUpdateAmount,
  onUpdateQuantity,
}: LineItemsReviewTableProps) {
  return (
    <>
      <div className="overflow-x-auto rounded-md border">
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
                <TableCell className="text-sm">{li.description}</TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={lineItemQuantities[li.lessonId] ?? li.quantity}
                    onChange={(e) => onUpdateQuantity(li.lessonId, e.target.value)}
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
                      value={lineItemAmounts[li.lessonId] ?? li.unitAmount}
                      onChange={(e) => onUpdateAmount(li.lessonId, e.target.value)}
                      className="h-8 w-24 text-right"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm font-medium">
                  {formatCurrency(
                    (lineItemAmounts[li.lessonId] ?? li.unitAmount) * li.quantity,
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
  );
}
