import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DropScope } from "./useDropReschedule";

interface DropConfirmDialogProps {
  open: boolean;
  label: string | undefined;
  hasSeries: boolean;
  scope: DropScope;
  notify: boolean;
  pending: boolean;
  onScopeChange: (scope: DropScope) => void;
  onNotifyChange: (notify: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirmation dialog for a drag/resize reschedule. Offers the series scope
 * choice (just this / this & future) and a "notify student" toggle. The
 * confirm label reflects whether an email-review step follows.
 */
export function DropConfirmDialog({
  open,
  label,
  hasSeries,
  scope,
  notify,
  pending,
  onScopeChange,
  onNotifyChange,
  onCancel,
  onConfirm,
}: DropConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {scope === "this_and_future"
              ? "Reschedule series?"
              : "Reschedule lesson?"}
          </DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        {hasSeries && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onScopeChange("this")}
              className={cn(
                "rounded-md border p-2.5 text-left text-xs transition-colors",
                scope === "this"
                  ? "border-primary ring-1 ring-primary bg-primary/5"
                  : "border-muted hover:bg-muted/50",
              )}
            >
              <span className="font-medium block">Just this lesson</span>
            </button>
            <button
              type="button"
              onClick={() => onScopeChange("this_and_future")}
              className={cn(
                "rounded-md border p-2.5 text-left text-xs transition-colors",
                scope === "this_and_future"
                  ? "border-primary ring-1 ring-primary bg-primary/5"
                  : "border-muted hover:bg-muted/50",
              )}
            >
              <span className="font-medium block">This &amp; future</span>
            </button>
          </div>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={notify}
            onChange={(e) => onNotifyChange(e.target.checked)}
          />
          <span className="text-sm">Notify student about the new time</span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {notify ? "Review email" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
