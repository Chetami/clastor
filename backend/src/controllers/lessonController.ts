import { Request, Response } from "express";
import {
  createLessonInFirestore,
  listLessonsFromFirestore,
  getLessonByIdFromFirestore,
  updateLessonInFirestore,
  recordAttendanceInFirestore,
  cancelLessonInFirestore,
  markStudentNotifiedInFirestore,
  ensureLessonIcsUid,
  bumpRsvpTokenVersion,
  setLessonAcceptanceInFirestore,
  setLessonGoogleEventId,
  LessonFilters,
} from "../services/lessonService";
import { getStudentByIdFromFirestore } from "../services/studentService";
import { getUserFromFirestore } from "../services/userService";
import { sendLessonNotification } from "../services/emailService";
import { buildLessonInvite } from "../services/icalService";
import {
  syncLessonToCalendar,
  deleteLessonCalendarEvent,
  resyncLessonCalendar,
  GoogleNotConnectedError,
} from "../services/googleCalendarService";
import { signRsvpToken, verifyRsvpToken } from "../utils/jwt";
import { getNotifyCooldownMs, getPublicApiUrl } from "../config/email";
import {
  CreateLessonRequest,
  UpdateLessonRequest,
  RecordAttendanceRequest,
  NotifyStudentRequest,
  LessonAcceptance,
  Lesson,
  LessonResponse,
  LessonListResponse,
  ApiError,
} from "@examify-tms/interfaces";
import { canViewLesson, canEditLesson } from "../permissions/lessonPermissions";

/**
 * Convert a Lesson (Date-typed) to a LessonResponse (ISO string-typed),
 * excluding tutorId.
 */
function toLessonResponse(lesson: Lesson): LessonResponse {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v;
  return {
    id: lesson.id,
    studentId: lesson.studentId,
    subject: lesson.subject ?? null,
    startDateTime: toIso(lesson.startDateTime),
    durationMinutes: lesson.durationMinutes,
    location: lesson.location ?? null,
    notes: lesson.notes ?? null,
    todos: lesson.todos ?? [],
    acceptanceStatus: lesson.acceptanceStatus,
    attendanceStatus: lesson.attendanceStatus,
    seriesId: lesson.seriesId ?? null,
    isCancelled: lesson.isCancelled ?? false,
    isException: lesson.isException ?? false,
    remindersEnabled: lesson.remindersEnabled,
    lastStudentNotifiedAt: lesson.lastStudentNotifiedAt
      ? toIso(lesson.lastStudentNotifiedAt)
      : null,
    studentNotifiedCount: lesson.studentNotifiedCount ?? 0,
    isPaid: lesson.isPaid ?? false,
    googleCalendarEventId: lesson.googleCalendarEventId ?? null,
    googleCalendarSyncedAt: lesson.googleCalendarSyncedAt
      ? toIso(lesson.googleCalendarSyncedAt)
      : null,
    createdAt: toIso(lesson.createdAt),
    updatedAt: toIso(lesson.updatedAt),
  };
}

/**
 * Create lesson controller
 */
export async function createLesson(
  req: Request<{}, {}, CreateLessonRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await createLessonInFirestore(req.body, req.user.uid);

    // Best-effort push to Google Calendar. Never blocks the response; if it
    // succeeds the returned lesson carries a googleCalendarEventId.
    try {
      await syncLessonToCalendar(req.user.uid, lesson);
    } catch {
      /* syncLessonToCalendar logs internally; ignore here */
    }

    // Re-fetch so the response reflects any persisted googleCalendarEventId.
    const synced = await getLessonByIdFromFirestore(lesson.id);
    res.status(201).json(toLessonResponse(synced ?? lesson));
  } catch (error) {
    console.error("Create lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create lesson";
    res.status(500).json({ message });
  }
}

/**
 * List lessons controller
 * Supports from/to (calendar window), studentId, acceptanceStatus,
 * attendanceStatus query filters.
 */
export async function listLessons(
  req: Request,
  res: Response<LessonListResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const filters: LessonFilters = {};
    if (typeof req.query.from === "string") {
      filters.from = new Date(req.query.from);
    }
    if (typeof req.query.to === "string") {
      filters.to = new Date(req.query.to);
    }
    if (typeof req.query.studentId === "string") {
      filters.studentId = req.query.studentId;
    }
    if (typeof req.query.acceptanceStatus === "string") {
      filters.acceptanceStatus = req.query.acceptanceStatus;
    }
    if (typeof req.query.attendanceStatus === "string") {
      filters.attendanceStatus = req.query.attendanceStatus;
    }
    if (req.query.unpaid === "true" || req.query.unpaid === "1") {
      filters.unpaid = true;
    }

    const lessons = await listLessonsFromFirestore(
      req.user.uid,
      req.user.role,
      filters
    );

    const response: LessonListResponse = {
      data: lessons.map(toLessonResponse),
      total: lessons.length,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("List lessons failed:", error);
    const message = error instanceof Error ? error.message : "Failed to list lessons";
    res.status(500).json({ message });
  }
}

/**
 * Get lesson by ID controller
 */
export async function getLessonById(
  req: Request<{ id: string }>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canViewLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to view this lesson" });
      return;
    }

    res.status(200).json(toLessonResponse(lesson));
  } catch (error) {
    console.error("Get lesson by ID failed:", error);
    const message = error instanceof Error ? error.message : "Failed to get lesson";
    res.status(500).json({ message });
  }
}

/**
 * Update lesson controller
 */
export async function updateLesson(
  req: Request<{ id: string }, {}, UpdateLessonRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to edit this lesson" });
      return;
    }

    await updateLessonInFirestore(req.params.id, req.body);

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    // Best-effort re-sync to Google Calendar (creates the event if missing
    // while connected, otherwise patches the existing one).
    try {
      await syncLessonToCalendar(req.user.uid, updated);
    } catch {
      /* logged inside syncLessonToCalendar */
    }

    const resynced = (await getLessonByIdFromFirestore(req.params.id)) ?? updated;
    res.status(200).json(toLessonResponse(resynced));
  } catch (error) {
    console.error("Update lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update lesson";
    res.status(500).json({ message });
  }
}

/**
 * Resync a single lesson to Google Calendar. Recreates the backing Google
 * event if it was deleted over on Google's side. Intended for the per-lesson
 * "Resync" button. Returns the updated lesson + the action taken.
 */
export async function resyncLesson(
  req: Request<{ id: string }>,
  res: Response<
    { lesson: LessonResponse; action: "created" | "updated" | "recreated" } | ApiError
  >,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to resync this lesson" });
      return;
    }

    const { action } = await resyncLessonCalendar(req.user.uid, lesson);

    const updated = (await getLessonByIdFromFirestore(req.params.id)) ?? lesson;
    res.status(200).json({ lesson: toLessonResponse(updated), action });
  } catch (error) {
    if (error instanceof GoogleNotConnectedError) {
      res.status(400).json({ message: "Connect your Google account first." });
      return;
    }
    console.error("Resync lesson failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to resync lesson";
    res.status(500).json({ message });
  }
}

/**
 * Record attendance controller
 */
export async function recordAttendance(
  req: Request<{ id: string }, {}, RecordAttendanceRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to edit this lesson" });
      return;
    }

    await recordAttendanceInFirestore(req.params.id, req.body.attendanceStatus);

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    res.status(200).json(toLessonResponse(updated));
  } catch (error) {
    console.error("Record attendance failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to record attendance";
    res.status(500).json({ message });
  }
}

/**
 * Cancel a single lesson occurrence (soft cancel).
 */
export async function cancelLesson(
  req: Request<{ id: string }>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to cancel this lesson" });
      return;
    }

    // Prevent cancellation of finished lessons
    const now = new Date();
    const endTime = new Date(new Date(lesson.startDateTime as any).getTime() + lesson.durationMinutes * 60_000);
    const isFinished = lesson.attendanceStatus !== "unrecorded" || endTime < now;
    
    if (isFinished) {
      res.status(400).json({ 
        message: "Cannot cancel finished lessons. Only upcoming lessons with unrecorded attendance can be cancelled." 
      });
      return;
    }

    await cancelLessonInFirestore(req.params.id);

    // Best-effort delete the corresponding Google Calendar event.
    try {
      await deleteLessonCalendarEvent(req.user.uid, lesson.googleCalendarEventId);
      if (lesson.googleCalendarEventId) {
        await setLessonGoogleEventId(req.params.id, null);
      }
    } catch {
      /* logged inside deleteLessonCalendarEvent */
    }

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    res.status(200).json(toLessonResponse(updated));
  } catch (error) {
    console.error("Cancel lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to cancel lesson";
    res.status(500).json({ message });
  }
}

/**
 * Notify student controller
 *
 * Sends a reminder email to the student linked to the lesson. Enforces a
 * cooldown (default 24h) so the student can't be spammed or notified twice
 * by accident. The lesson document is stamped with the send timestamp only
 * after the email is confirmed delivered.
 */
export async function notifyStudent(
  req: Request<{ id: string }, {}, NotifyStudentRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);
    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to notify for this lesson" });
      return;
    }

    // Cooldown check — prevents spamming / accidental double-sends.
    if (lesson.lastStudentNotifiedAt) {
      const cooldownMs = getNotifyCooldownMs();
      const elapsed = Date.now() - new Date(lesson.lastStudentNotifiedAt as any).getTime();
      if (elapsed < cooldownMs) {
        const nextAllowedAt = new Date(
          new Date(lesson.lastStudentNotifiedAt as any).getTime() + cooldownMs
        ).toISOString();
        res.status(409).json({
          message: `This student was already notified. You can send another reminder after ${nextAllowedAt}.`,
        });
        return;
      }
    }

    const student = await getStudentByIdFromFirestore(lesson.studentId);
    if (!student || !student.email) {
      res.status(400).json({ message: "This student has no email address on file" });
      return;
    }

    const tutor = await getUserFromFirestore(lesson.tutorId);

    // Stamp a stable iCal UID (reused across resends so calendar clients see
    // updates, not duplicates) and bump the RSVP token version, which
    // invalidates the Accept/Decline links from every previously-sent email.
    const icsUid = await ensureLessonIcsUid(req.params.id);
    const sequence = await bumpRsvpTokenVersion(req.params.id);

    const start = new Date(lesson.startDateTime as any);
    const end = new Date(start.getTime() + lesson.durationMinutes * 60_000);

    const rsvpToken = signRsvpToken(req.params.id, sequence);
    const rsvpBase = `${getPublicApiUrl()}/api/lessons/rsvp`;
    const rsvpLinks = {
      accept: `${rsvpBase}?token=${encodeURIComponent(rsvpToken)}&status=accepted`,
      decline: `${rsvpBase}?token=${encodeURIComponent(rsvpToken)}&status=declined`,
    };

    const icsContent = buildLessonInvite({
      icsUid,
      // SEQUENCE mirrors the bumped RSVP version: each resend is an update.
      sequence,
      summary: `${lesson.subject ?? "Lesson"} with ${tutor.name}`,
      start,
      end,
      location: lesson.location,
      organizer: { name: tutor.name, email: tutor.email },
      attendee: { name: student.name, email: student.email },
    });

    await sendLessonNotification({
      to: student.email,
      studentName: student.name,
      tutorName: tutor.name,
      tutorEmail: tutor.email,
      subject: lesson.subject ?? null,
      startDateTime: start,
      durationMinutes: lesson.durationMinutes,
      location: lesson.location,
      message: req.body?.message,
      icsContent,
      rsvpLinks,
    });

    await markStudentNotifiedInFirestore(req.params.id);

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    res.status(200).json(toLessonResponse(updated));
  } catch (error) {
    console.error("Notify student failed:", error);
    const message = error instanceof Error ? error.message : "Failed to notify student";
    res.status(500).json({ message });
  }
}

/**
 * Public RSVP endpoint — reached when a student clicks Accept/Decline in the
 * invite email. No auth (students aren't users); the signed `token` carries
 * the lesson id + the RSVP version it was issued for. We reject if the token
 * is invalid, expired, or its version no longer matches the lesson (a resend
 * supersedes older links).
 *
 * Responds with a small confirmation HTML page rather than JSON, since the
 * link is opened in a browser from an email client.
 */
export async function rsvpLesson(
  req: Request,
  res: Response
): Promise<void> {
  const status = String(req.query.status ?? "").toLowerCase();
  const desired: LessonAcceptance | null =
    status === "accepted" ? "accepted" : status === "declined" ? "declined" : null;

  const payload = verifyRsvpToken(req.query.token as string | undefined);

  if (!payload || !desired) {
    res
      .status(400)
      .type("html")
      .send(renderRsvpPage("invalid", null));
    return;
  }

  try {
    const lesson = await getLessonByIdFromFirestore(payload.lessonId);
    if (!lesson) {
      res.status(404).type("html").send(renderRsvpPage("invalid", null));
      return;
    }

    // A resend bumps rsvpTokenVersion; older links must no longer work.
    if ((lesson.rsvpTokenVersion ?? 0) !== payload.version) {
      res.status(409).type("html").send(renderRsvpPage("superseded", null));
      return;
    }

    await setLessonAcceptanceInFirestore(payload.lessonId, desired);
    res.status(200).type("html").send(renderRsvpPage(desired, lesson));
  } catch (error) {
    console.error("RSVP failed:", error);
    res.status(500).type("html").send(renderRsvpPage("invalid", null));
  }
}

/**
 * Render the confirmation page returned after an RSVP click.
 * `outcome` is "accepted" | "declined" on success, or an error sentinel.
 */
function renderRsvpPage(
  outcome: "accepted" | "declined" | "invalid" | "superseded",
  lesson: Lesson | null
): string {
  const when = lesson
    ? new Date(lesson.startDateTime as any).toLocaleString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const copy: Record<typeof outcome, { title: string; body: string }> = {
    accepted: {
      title: "You're confirmed ✓",
      body: lesson
        ? `Thanks! We've let your tutor know you'll be at <strong>${escapeHtmlText(
            lesson.subject ?? "Lesson"
          )}</strong> on <strong>${escapeHtmlText(when!)}</strong>.`
        : "Thanks! Your tutor has been notified that you've accepted.",
    },
    declined: {
      title: "Marked as declined",
      body: lesson
        ? `We've let your tutor know you can't make <strong>${escapeHtmlText(
            lesson.subject ?? "Lesson"
          )}</strong> on <strong>${escapeHtmlText(when!)}</strong>.`
        : "We've let your tutor know you can't make this lesson.",
    },
    invalid: {
      title: "This link isn't valid",
      body: "The response link may have expired or already been used. Please contact your tutor to confirm.",
    },
    superseded: {
      title: "This link has been replaced",
      body: "A newer reminder was sent for this lesson — please use the Accept/Decline buttons in the most recent email.",
    },
  };

  const c = copy[outcome];
  const accent = outcome === "accepted" ? "#16a34a" : outcome === "declined" ? "#dc2626" : "#6b7280";

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.title}</title></head>
<body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#f9fafb;color:#111827">
  <div style="max-width:480px;margin:48px auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;text-align:center">
    <div style="font-size:40px;line-height:1;margin-bottom:12px">${outcome === "accepted" ? "✅" : outcome === "declined" ? "❌" : "⚠️"}</div>
    <h1 style="font-size:22px;margin:0 0 12px 0;color:${accent}">${c.title}</h1>
    <p style="font-size:15px;line-height:1.5;color:#374151;margin:0">${c.body}</p>
  </div>
</body></html>`;
}

function escapeHtmlText(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
