import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import { useSendInvoice, previewSendInvoiceRequest } from "@/features/payments/api";

interface SendInvoiceDialogProps {
  /** The invoice to send, or null when closed. */
  invoiceId: string | null;
  /** Called when the dialog should close (cancel, backdrop, or after send). */
  onClose: () => void;
  /** Called after a successful send, with the invoice id, before close. */
  onSent?: (invoiceId: string) => void;
}

/**
 * Single source of truth for the "review + send an invoice email" flow used
 * across the app (lesson rows, dashboard, payments, actionable lessons). Owns
 * the send mutation + toast; the caller just controls open state and optional
 * post-send navigation via {@link onSent}.
 */
export function SendInvoiceDialog({
  invoiceId,
  onClose,
  onSent,
}: SendInvoiceDialogProps) {
  const sendInvoice = useSendInvoice();

  if (!invoiceId) return null;

  return (
    <EmailComposeDialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Send invoice"
      description="Review and edit the email before sending. The invoice PDF is attached automatically."
      fetchPreview={(message) =>
        previewSendInvoiceRequest(invoiceId, message)
      }
      onSend={async (message) => {
        await sendInvoice.mutateAsync({
          id: invoiceId,
          message: message || undefined,
        });
        track("invoice_sent");
        toast.success("Invoice sent.");
        onSent?.(invoiceId);
        onClose();
      }}
    />
  );
}
