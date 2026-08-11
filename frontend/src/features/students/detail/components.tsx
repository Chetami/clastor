import { useState } from "react";
import { FileText, Pencil, StickyNote } from "lucide-react";
import type { Invoice } from "@examify-tms/interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/features/payments/invoice-utils";

function invoiceStatusVariant(
  status: Invoice["status"],
): "default" | "destructive" | "secondary" | "outline" {
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

interface DetailRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
}

/** Labeled icon + value row used across the student detail cards. */
export function DetailRow({ icon, label, value, muted }: DetailRowProps) {
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

interface StudentInvoicesCardProps {
  invoices: Invoice[];
}

/** Card listing a student's open/overdue invoices with totals + due dates. */
export function StudentInvoicesCard({ invoices }: StudentInvoicesCardProps) {
  if (invoices.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          Open Invoices ({invoices.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{invoice.invoiceNumber}</span>
                    <Badge variant={invoiceStatusVariant(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {invoice.lineItems.length} lesson
                    {invoice.lineItems.length !== 1 ? "s" : ""} · Due{" "}
                    {invoice.dueDate
                      ? formatDate(invoice.dueDate)
                      : "No due date"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold">
                  {formatCurrency(invoice.total, invoice.currency)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {invoice.issueDate ? formatDate(invoice.issueDate) : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface StudentNotesCardProps {
  notes: string | null | undefined;
  isSaving: boolean;
  onSave: (notes: string | null) => Promise<void>;
}

/**
 * Student notes editor. Owns its edit/draft state; the parent is only notified
 * via {@link onSave} when the tutor saves (passing the trimmed text or null).
 */
export function StudentNotesCard({
  notes,
  isSaving,
  onSave,
}: StudentNotesCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEdit() {
    setDraft(notes ?? "");
    setEditing(true);
  }

  async function save() {
    await onSave(draft.trim() || null);
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="h-4 w-4" />
          Notes
        </CardTitle>
        {!editing && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={startEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            {notes ? "Edit" : "Add note"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <Textarea
              autoFocus
              rows={5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add notes about this student..."
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={save} disabled={isSaving}>
                Save
              </Button>
            </div>
          </div>
        ) : notes ? (
          <p className="whitespace-pre-wrap text-sm">{notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
