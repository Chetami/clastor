import { Request, Response } from "express";
import {
  SentEmailResponse,
  SentEmailListResponse,
  ApiError,
} from "@examify-tms/interfaces";
import {
  listSentEmailsFromFirestore,
  getSentEmailByIdFromFirestore,
  toSentEmailResponse,
  SentEmailFilter,
} from "../services/sentEmailService";
import { getLessonByIdFromFirestore } from "../services/lessonService";
import { getInvoiceByIdFromFirestore } from "../services/paymentService";
import { getStudentByIdFromFirestore } from "../services/studentService";
import { canViewLesson } from "../permissions/lessonPermissions";
import { canViewInvoice } from "../permissions/paymentPermissions";
import { canViewStudent } from "../permissions/studentPermissions";
import { isUserSysAdmin } from "../permissions/permissions";
import { resolveTutorNames } from "../services/tutorResolver";

/**
 * Sent-email log controller.
 *
 * Exposes the outbound email history recorded by the email dispatch paths.
 * Visibility is scoped to the authenticated tutor's own data: a tutor only
 * sees emails for lessons / invoices / students they own. System admins see
 * everything, and may drill into a single tutor via ?tutorId=….
 */

/**
 * GET /api/sent-emails?lessonId=|invoiceId=|studentId=|tutorId=
 *
 * List sent-email records scoped to one entity, newest-first. Tutors can only
 * query entities they own; system admins may query without a filter (returns
 * the most recent sends globally) or drill into one tutor via ?tutorId=….
 */
export async function listSentEmails(
  req: Request,
  res: Response<SentEmailListResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lessonId = (req.query.lessonId as string | undefined)?.trim() || undefined;
    const invoiceId = (req.query.invoiceId as string | undefined)?.trim() || undefined;
    const studentId = (req.query.studentId as string | undefined)?.trim() || undefined;
    const tutorId = (req.query.tutorId as string | undefined)?.trim() || undefined;

    const isAdmin = isUserSysAdmin(req.user.role);

    // The tutorId filter is admin-only. Tutors are always scoped to their own
    // uid, so passing anyone else's id is an attempt to probe other data.
    if (tutorId && !isAdmin && tutorId !== req.user.uid) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    // Resolve the filtered entity + enforce ownership. Each branch sets the
    // Firestore filter to use and short-circuits with 404/403 as appropriate.
    const filter: SentEmailFilter = {};
    if (lessonId) {
      const lesson = await getLessonByIdFromFirestore(lessonId);
      if (!lesson) {
        res.status(404).json({ message: "Lesson not found" });
        return;
      }
      if (!canViewLesson(lesson, req)) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      filter.lessonId = lessonId;
    } else if (invoiceId) {
      const invoice = await getInvoiceByIdFromFirestore(invoiceId);
      if (!invoice) {
        res.status(404).json({ message: "Invoice not found" });
        return;
      }
      if (!canViewInvoice(invoice, req)) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      filter.invoiceId = invoiceId;
    } else if (studentId) {
      const student = await getStudentByIdFromFirestore(studentId);
      if (!student) {
        res.status(404).json({ message: "Student not found" });
        return;
      }
      if (!canViewStudent(student, req)) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
      filter.studentId = studentId;
    } else if (isAdmin) {
      // Unfiltered admin request → global list, unless drilling into a tutor.
      if (tutorId) filter.tutorId = tutorId;
    } else {
      // Unfiltered tutor request → scope to this tutor's own emails only.
      filter.tutorId = req.user.uid;
    }

    const emails = await listSentEmailsFromFirestore(filter);
    const data = emails.map(toSentEmailResponse);

    // Enrich with tutor names so admin views can render a "Tutor" column.
    if (isAdmin) {
      const tutorNames = await resolveTutorNames(
        data.map((e) => e.tutorId),
      );
      for (const e of data) {
        e.tutorName = tutorNames.get(e.tutorId)?.name ?? null;
      }
    }

    res.status(200).json({ data, total: data.length });
  } catch (error) {
    console.error("List sent emails failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list sent emails";
    res.status(500).json({ message });
  }
}

/**
 * GET /api/sent-emails/:id
 *
 * Fetch a single sent-email record (including the full rendered HTML body).
 * Visibility: system admins can read any record; tutors can only read emails
 * scoped to their own tutorId.
 */
export async function getSentEmail(
  req: Request<{ id: string }>,
  res: Response<SentEmailResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const email = await getSentEmailByIdFromFirestore(req.params.id);
    if (!email) {
      res.status(404).json({ message: "Sent email not found" });
      return;
    }

    if (!isUserSysAdmin(req.user.role) && email.tutorId !== req.user.uid) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.status(200).json(toSentEmailResponse(email));
  } catch (error) {
    console.error("Get sent email failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get sent email";
    res.status(500).json({ message });
  }
}
