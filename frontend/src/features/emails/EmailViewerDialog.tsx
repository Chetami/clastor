import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { SentEmailResponse } from "@examify-tms/interfaces";
import { formatDateTime } from "@/features/payments/invoice-utils";

interface EmailViewerDialogProps {
  email: SentEmailResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Read-only viewer for a previously-sent email. Renders the stored HTML body
 * inside a sandboxed iframe (via srcDoc) so the email's inline styles can't
 * leak into the app shell and any latent scripts in the body can't execute.
 */
export function EmailViewerDialog({
  email,
  open,
  onOpenChange,
}: EmailViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="pr-8">
            {email?.subject || "Sent email"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            View the rendered content of a previously-sent email.
          </DialogDescription>
        </DialogHeader>

        {email && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b pb-3 text-xs text-muted-foreground">
              <span>
                <span className="text-foreground/70">To: </span>
                {email.to.join(", ")}
              </span>
              <span>
                <span className="text-foreground/70">Sent: </span>
                {formatDateTime(email.sentAt)}
              </span>
              {email.sentByName && (
                <span>
                  <span className="text-foreground/70">By: </span>
                  {email.sentByName}
                </span>
              )}
              <Badge variant={email.status === "sent" ? "success" : "danger"}>
                {email.status === "sent" ? "Delivered" : "Failed"}
              </Badge>
            </div>

            {email.status === "failed" && email.errorMessage ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {email.errorMessage}
              </div>
            ) : (
              <iframe
                title="Email preview"
                srcDoc={email.bodyHtml}
                sandbox=""
                className="min-h-[50vh] w-full flex-1 rounded-md border bg-white"
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
