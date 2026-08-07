import { Check, Loader2, RotateCcw } from "lucide-react";
import type { FeedbackResponse } from "@examify-tms/interfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/features/payments/invoice-utils";
import { STATUS_META, TYPE_META } from "./constants";

interface FeedbackDetailDialogProps {
  feedback: FeedbackResponse | null;
  onOpenChange: (open: boolean) => void;
  onToggleStatus: (feedback: FeedbackResponse) => void;
  isToggling: boolean;
}

/** Detail dialog wrapper that mounts the body only when a row is selected. */
export function FeedbackDetailDialog({
  feedback,
  onOpenChange,
  onToggleStatus,
  isToggling,
}: FeedbackDetailDialogProps) {
  return (
    <Dialog open={!!feedback} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {feedback && (
          <FeedbackDetailBody
            feedback={feedback}
            onToggleStatus={onToggleStatus}
            isToggling={isToggling}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FeedbackDetailBody({
  feedback,
  onToggleStatus,
  isToggling,
}: {
  feedback: FeedbackResponse;
  onToggleStatus: (feedback: FeedbackResponse) => void;
  isToggling: boolean;
}) {
  const typeMeta = TYPE_META[feedback.type];
  const statusMeta = STATUS_META[feedback.status];
  const TypeIcon = typeMeta.icon;
  const isOpen = feedback.status === "open";

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Badge variant={typeMeta.variant}>
            <TypeIcon className="mr-1 h-3 w-3" />
            {typeMeta.label}
          </Badge>
          <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        </div>
        <DialogTitle className="sr-only">Feedback details</DialogTitle>
        <DialogDescription className="sr-only">
          Full details for feedback submitted on{" "}
          {formatDateTime(feedback.createdAt)}.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <p className="whitespace-pre-wrap break-words text-sm">
            {feedback.message}
          </p>
        </div>

        {feedback.images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {feedback.images.map((src, i) => (
              <a
                key={i}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-24 w-24 overflow-hidden rounded-md border"
              >
                <img
                  src={src}
                  alt={`Attachment ${i + 1}`}
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">From</dt>
          <dd>
            <div className="flex flex-col">
              <span>{feedback.tutorName ?? "Unknown"}</span>
              {feedback.tutorEmail && (
                <span className="text-xs text-muted-foreground">
                  {feedback.tutorEmail}
                </span>
              )}
            </div>
          </dd>
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>{formatDateTime(feedback.createdAt)}</dd>
          {feedback.pageUrl && (
            <>
              <dt className="text-muted-foreground">Page</dt>
              <dd className="truncate font-mono text-xs">{feedback.pageUrl}</dd>
            </>
          )}
          {feedback.userAgent && (
            <>
              <dt className="text-muted-foreground align-top">Device</dt>
              <dd className="text-xs text-muted-foreground">
                {feedback.userAgent}
              </dd>
            </>
          )}
        </dl>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant={isOpen ? "default" : "outline"}
          disabled={isToggling}
          onClick={() => onToggleStatus(feedback)}
        >
          {isToggling ? (
            <Loader2 className="animate-spin" />
          ) : isOpen ? (
            <Check />
          ) : (
            <RotateCcw />
          )}
          {isOpen ? "Resolve" : "Reopen"}
        </Button>
      </DialogFooter>
    </>
  );
}
