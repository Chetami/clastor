import { Link } from "react-router-dom";
import {
  STUDENT_NOTIFY_COOLDOWN_MS,
  formatMsRemaining,
  formatLessonDate,
  formatLessonTime,
} from "@examify-tms/shared";
import {
  ArrowRight,
  Ban,
  CalendarClock,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Repeat,
  StickyNote,
  User,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmailGuard } from "@/components/email-guard";
import type { Badge } from "./helpers";

export interface PopoverBodyProps {
  subject: string | null | undefined;
  studentName: string;
  /** Student's contact email. When absent the Notify button is disabled. */
  studentEmail?: string | null;
  startIso: string;
  endIso: string;
  durationMinutes: number;
  location: string | null | undefined;
  lessonMeetLink?: string | null;
  notes: string | null | undefined;
  badge: Badge | null;
  seriesId: string | null;
  isCancelled: boolean;
  lessonFinished: boolean;
  notifiedAtIso: string | null | undefined;
  notifyPending: boolean;
  cancelPending: boolean;
  attendancePending: boolean;
  needsAttendance: boolean;
  createInvoiceHref: string | null;
  invoiceHref: string | null;
  actionError: string | null;
  detailHref: string;
  onNotify: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onGenerateMeet: () => void;
  onMarkAttendance: () => void;
  meetLoading: boolean;
}

/**
 * The presentational body of the calendar event popover: header, essential
 * details, and context-sensitive action rows (scheduling vs. follow-ups).
 * Purely presentational — all mutations flow back through the callbacks.
 */
export function PopoverBody({
  subject,
  studentName,
  studentEmail,
  startIso,
  endIso,
  durationMinutes,
  location,
  lessonMeetLink,
  notes,
  badge,
  seriesId,
  isCancelled,
  lessonFinished,
  notifiedAtIso,
  notifyPending,
  cancelPending,
  attendancePending,
  needsAttendance,
  createInvoiceHref,
  invoiceHref,
  actionError,
  detailHref,
  onNotify,
  onReschedule,
  onCancel,
  onGenerateMeet,
  onMarkAttendance,
  meetLoading,
}: PopoverBodyProps) {
  const meetLink = lessonMeetLink ?? null;
  const notifiedAt = notifiedAtIso ? new Date(notifiedAtIso) : null;
  const nextAllowedAt = notifiedAt
    ? new Date(notifiedAt.getTime() + STUDENT_NOTIFY_COOLDOWN_MS)
    : null;
  const cooldownActive = nextAllowedAt
    ? Date.now() < nextAllowedAt.getTime()
    : false;
  const cooldownRemaining =
    nextAllowedAt && cooldownActive
      ? formatMsRemaining(nextAllowedAt.getTime() - Date.now())
      : null;

  const showActions = !isCancelled;
  const showUpcomingActions = showActions && !lessonFinished;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="space-y-1.5 border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">
            {subject || "Lesson"}
          </h3>
          {badge && (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.tone}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">{studentName}</span>
          {seriesId && (
            <Link
              to={`/lessons/series/${seriesId}`}
              className="ml-1 inline-flex items-center gap-1 hover:text-foreground"
            >
              <Repeat className="h-3 w-3" />
              Series
            </Link>
          )}
        </div>
      </div>

      {/* Essential details */}
      <dl className="space-y-3 p-4 text-xs">
        <Detail icon={<Clock className="h-3.5 w-3.5" />} label="When">
          <div className="font-medium leading-tight">
            {formatLessonDate(startIso)}
          </div>
          <div className="mt-0.5 text-muted-foreground">
            {formatLessonTime(startIso)} – {formatLessonTime(endIso)} (
            {durationMinutes} min)
          </div>
        </Detail>

        <Detail
          icon={
            meetLink ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <MapPin className="h-3.5 w-3.5" />
            )
          }
          label={meetLink ? "Google Meet" : "Location"}
        >
          <div className="flex flex-wrap items-center gap-2">
            {meetLink ? (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Join meeting
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : location ? (
              <span className="font-medium">{location}</span>
            ) : (
              <span className="text-muted-foreground">Not specified</span>
            )}
            {!meetLink && (
              <Button
                size="sm"
                variant="secondary"
                className="h-7 gap-1 px-2 text-xs"
                onClick={onGenerateMeet}
                disabled={meetLoading}
              >
                {meetLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Video className="h-3 w-3" />
                )}
                Meet
              </Button>
            )}
          </div>
        </Detail>

        {notes && (
          <Detail icon={<StickyNote className="h-3.5 w-3.5" />} label="Notes">
            <p className="line-clamp-1 whitespace-pre-wrap font-medium">
              {notes}
            </p>
          </Detail>
        )}
      </dl>

      {actionError && (
        <p className="px-4 pb-2 text-xs text-destructive">{actionError}</p>
      )}

      {/* Actions — context-sensitive. */}
      {showActions && (
        <div className="space-y-2 border-t p-3">
          {showUpcomingActions ? (
            <>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  onClick={onReschedule}
                  title="Move this lesson to a new time"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Reschedule
                </Button>
                <EmailGuard hasEmail={!!studentEmail?.trim()}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 gap-1"
                    onClick={onNotify}
                    disabled={notifyPending || cooldownActive}
                    title="Send a reminder email to the student"
                  >
                    {notifyPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                    Notify
                  </Button>
                </EmailGuard>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-destructive hover:text-destructive"
                  onClick={onCancel}
                  disabled={cancelPending}
                  title="Cancel this occurrence"
                >
                  {cancelPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  Cancel
                </Button>
              </div>
              {cooldownRemaining && (
                <p className="text-[11px] text-muted-foreground">
                  Student notified — can resend in {cooldownRemaining}
                </p>
              )}
            </>
          ) : (
            <div className="flex gap-2">
              {needsAttendance && (
                <Button
                  size="sm"
                  className="flex-1 gap-1"
                  onClick={onMarkAttendance}
                  disabled={attendancePending}
                >
                  {attendancePending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ClipboardList className="h-3.5 w-3.5" />
                  )}
                  Mark attendance
                </Button>
              )}
              {createInvoiceHref && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  asChild
                >
                  <Link to={createInvoiceHref}>
                    <FileText className="h-3.5 w-3.5" />
                    Create invoice
                  </Link>
                </Button>
              )}
              {invoiceHref && (
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1"
                  asChild
                >
                  <Link to={invoiceHref}>
                    <FileText className="h-3.5 w-3.5" />
                    View invoice
                  </Link>
                </Button>
              )}
            </div>
          )}
          <Button size="sm" variant="secondary" className="w-full gap-1" asChild>
            <Link to={detailHref}>
              View details
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {isCancelled && (
        <div className="border-t p-3">
          <Button size="sm" variant="secondary" className="w-full gap-1" asChild>
            <Link to={detailHref}>
              View details
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

interface DetailProps {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}

function Detail({ icon, label, children }: DetailProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground">{label}</p>
        <div className="text-foreground">{children}</div>
      </div>
    </div>
  );
}
