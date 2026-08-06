import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Mail, MoreVertical, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCancelLessonSeries,
  resyncLessonRequest,
  notifyLessonSeriesRequest,
  previewNotifyLessonSeriesRequest,
} from "@/features/schedule/api";
import { EmailComposeDialog } from "@/components/email-compose-dialog";
import { STUDENT_NOTIFY_COOLDOWN_MS } from "@examify-tms/shared";
import { queryClient } from "@/lib/query-client";
import type { LessonResponse } from "@examify-tms/interfaces";

interface SeriesActionsMenuProps {
  seriesId: string;
  /** Upcoming, non-cancelled occurrences in the series. */
  upcoming: LessonResponse[];
}

type ConfirmType = "cancel";

/**
 * The "⋯" overflow menu for series-level actions on the series detail page:
 *   - Resync every upcoming occurrence to Google Calendar (best-effort)
 *   - Notify the student with a single summary email covering all upcoming
 *     lessons (one email, not one per occurrence)
 *   - Cancel the entire series (soft-cancels future occurrences)
 *
 * Resync runs immediately (side-effect only, no emails); Notify and Cancel
 * confirm first because they send email / are destructive.
 */
export function SeriesActionsMenu({ seriesId, upcoming }: SeriesActionsMenuProps) {
  const navigate = useNavigate();
  const cancelSeries = useCancelLessonSeries();
  const [confirm, setConfirm] = useState<ConfirmType | null>(null);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleResyncAll() {
    if (upcoming.length === 0) {
      toast.info("No upcoming lessons to resync.");
      return;
    }
    setBusy(true);
    try {
      const results = await Promise.allSettled(
        upcoming.map((l) => resyncLessonRequest(l.id)),
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      const done = results.length - failed;
      if (failed === 0) {
        toast.success(`Resynced ${done} lesson${done === 1 ? "" : "s"} to Google Calendar.`);
      } else {
        toast.error(`Resynced ${done}, ${failed} failed. Try again or resync individually.`);
      }
    } finally {
      setBusy(false);
      await queryClient.invalidateQueries({ queryKey: ["lessons"] });
      await queryClient.invalidateQueries({ queryKey: ["external-events"] });
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setBusy(true);
    try {
      await cancelSeries.mutateAsync(seriesId);
      toast.success("Series cancelled.");
      navigate("/lessons");
      return;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  async function handleNotify(message: string) {
    const { notified } = await notifyLessonSeriesRequest(
      seriesId,
      message || undefined,
    );
    toast.success(
      notified === 1
        ? "Sent 1 summary email covering the upcoming lesson."
        : `Sent 1 summary email covering ${notified} upcoming lessons.`,
    );
    await queryClient.invalidateQueries({ queryKey: ["lessons"] });
    await queryClient.invalidateQueries({ queryKey: ["sent-emails"] });
  }

  const upcomingCount = upcoming.length;

  // Mirrors the series-level cooldown enforced server-side: blocked when ANY
  // upcoming lesson was notified within the cooldown window. nextAllowedAt is
  // the latest of each lesson's next-eligible time.
  const nextAllowedAt = upcoming.reduce<Date | null>((next, l) => {
    if (!l.lastStudentNotifiedAt) return next;
    const candidate = new Date(
      new Date(l.lastStudentNotifiedAt).getTime() + STUDENT_NOTIFY_COOLDOWN_MS,
    );
    return !next || candidate > next ? candidate : next;
  }, null);
  const notifyOnCooldown = nextAllowedAt
    ? Date.now() < nextAllowedAt.getTime()
    : false;
  const notifyDisabled = upcomingCount === 0 || notifyOnCooldown;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={busy}
            aria-label="Series actions"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MoreVertical className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={handleResyncAll}
            disabled={upcomingCount === 0}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Resync to Calendar
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setNotifyOpen(true)}
            disabled={notifyDisabled}
            title={
              notifyOnCooldown && nextAllowedAt
                ? `Already notified — can resend after ${nextAllowedAt.toLocaleString(
                    "en-US",
                    { dateStyle: "medium", timeStyle: "short" },
                  )}`
                : upcomingCount === 0
                  ? "No upcoming lessons to notify about"
                  : undefined
            }
          >
            <Mail className="mr-2 h-4 w-4" />
            Notify student ({upcomingCount}{" "}
            {upcomingCount === 1 ? "lesson" : "lessons"})
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirm("cancel")}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Cancel series
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this series?</DialogTitle>
            <DialogDescription>
              {`This soft-cancels all ${upcomingCount} upcoming lesson${
                upcomingCount === 1 ? "" : "s"
              }. Past lessons are kept for history. This can't be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirm(null)}
              disabled={busy}
            >
              Keep series
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={busy}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel series
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmailComposeDialog
        open={notifyOpen}
        onOpenChange={setNotifyOpen}
        title="Notify the student"
        description={`Sends one summary email covering all ${upcomingCount} upcoming lesson${
          upcomingCount === 1 ? "" : "s"
        } with their dates and times.`}
        fetchPreview={(message) =>
          previewNotifyLessonSeriesRequest(seriesId, message)
        }
        onSend={handleNotify}
      />
    </>
  );
}
