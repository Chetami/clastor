import { Request, Response } from "express";
import {
  TemplateSummary,
  EmailTemplatePreview,
  ApiError,
} from "@examify-tms/interfaces";
import {
  listTemplates,
  previewInvoicePdf,
  previewLessonReminder,
  previewMeetInvite,
  previewReschedule,
  previewCancellation,
  previewSeriesNotification,
  previewSeriesReschedule,
  previewSeriesCancellation,
  previewInvoiceEmail,
} from "../services/templateService";

/**
 * GET /api/templates
 * List the sendable templates available for preview.
 */
export function listAllTemplates(
  _req: Request,
  res: Response<TemplateSummary[] | ApiError>,
): void {
  res.status(200).json(listTemplates());
}

/**
 * GET /api/templates/invoice/preview
 * Render the invoice template against sample data and return the PDF.
 * Personalised with the requesting tutor's name, ABN, and bank details.
 */
export async function getInvoicePreview(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const pdf = await previewInvoicePdf(req.user?.uid);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="invoice-template-preview.pdf"',
    );
    res.status(200).send(pdf);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to render invoice preview";
    console.error("getInvoicePreview error:", error);
    res.status(500).json({ message });
  }
}

/**
 * GET /api/templates/lesson-reminder/preview
 * Render the lesson reminder email against sample data.
 */
export async function getLessonReminderPreview(
  req: Request,
  res: Response<EmailTemplatePreview | ApiError>,
): Promise<void> {
  try {
    res.status(200).json(await previewLessonReminder(req.user?.uid));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to render lesson reminder preview";
    console.error("getLessonReminderPreview error:", error);
    res.status(500).json({ message });
  }
}

/**
 * GET /api/templates/meet-invite/preview
 * Render the Google Meet invite email (with calendar attachment) against
 * sample data.
 */
export async function getMeetInvitePreview(
  req: Request,
  res: Response<EmailTemplatePreview | ApiError>,
): Promise<void> {
  try {
    res.status(200).json(await previewMeetInvite(req.user?.uid));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to render meet invite preview";
    console.error("getMeetInvitePreview error:", error);
    res.status(500).json({ message });
  }
}

/**
 * GET /api/templates/reschedule/preview
 * Render the reschedule notice email against sample data.
 */
export async function getReschedulePreview(
  req: Request,
  res: Response<EmailTemplatePreview | ApiError>,
): Promise<void> {
  try {
    res.status(200).json(await previewReschedule(req.user?.uid));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to render reschedule preview";
    console.error("getReschedulePreview error:", error);
    res.status(500).json({ message });
  }
}

/**
 * GET /api/templates/cancellation/preview
 * Render the cancellation notice email (with a calendar removal) against
 * sample data.
 */
export async function getCancellationPreview(
  req: Request,
  res: Response<EmailTemplatePreview | ApiError>,
): Promise<void> {
  try {
    res.status(200).json(await previewCancellation(req.user?.uid));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to render cancellation preview";
    console.error("getCancellationPreview error:", error);
    res.status(500).json({ message });
  }
}

/**
 * GET /api/templates/series-notification/preview
 * Render the upcoming-lessons summary email against sample data.
 */
export async function getSeriesNotificationPreview(
  req: Request,
  res: Response<EmailTemplatePreview | ApiError>,
): Promise<void> {
  try {
    res.status(200).json(await previewSeriesNotification(req.user?.uid));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to render upcoming lessons preview";
    console.error("getSeriesNotificationPreview error:", error);
    res.status(500).json({ message });
  }
}

/**
 * GET /api/templates/series-reschedule/preview
 * Render the series schedule-update email against sample data.
 */
export async function getSeriesReschedulePreview(
  req: Request,
  res: Response<EmailTemplatePreview | ApiError>,
): Promise<void> {
  try {
    res.status(200).json(await previewSeriesReschedule(req.user?.uid));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to render series schedule update preview";
    console.error("getSeriesReschedulePreview error:", error);
    res.status(500).json({ message });
  }
}

/**
 * GET /api/templates/series-cancellation/preview
 * Render the series cancellation email against sample data.
 */
export async function getSeriesCancellationPreview(
  req: Request,
  res: Response<EmailTemplatePreview | ApiError>,
): Promise<void> {
  try {
    res.status(200).json(await previewSeriesCancellation(req.user?.uid));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to render series cancellation preview";
    console.error("getSeriesCancellationPreview error:", error);
    res.status(500).json({ message });
  }
}

/**
 * GET /api/templates/invoice-email/preview
 * Render the invoice email (subject + body + pay button) against sample data.
 */
export async function getInvoiceEmailPreview(
  req: Request,
  res: Response<EmailTemplatePreview | ApiError>,
): Promise<void> {
  try {
    res.status(200).json(await previewInvoiceEmail(req.user?.uid));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to render invoice email preview";
    console.error("getInvoiceEmailPreview error:", error);
    res.status(500).json({ message });
  }
}
