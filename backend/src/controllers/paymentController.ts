import { Request, Response } from "express";
import { addMilliseconds, differenceInMilliseconds } from "date-fns";
import {
  listInvoicesFromFirestore,
  getInvoiceByIdFromFirestore,
  createInvoiceInFirestore,
  updateInvoiceInFirestore,
  markInvoicePaidInFirestore,
  markInvoiceSentInFirestore,
  voidInvoiceInFirestore,
  deleteInvoiceFromFirestore,
  getStudentInvoicesFromFirestore,
  getStudentDebtFromFirestore,
} from "../services/paymentService";
import {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  MarkPaidRequest,
  Invoice,
  InvoiceResponse,
  InvoiceListResponse,
  InvoiceStatus,
  InvoiceEvent,
  InvoiceEventResponse,
  InvoiceEventListResponse,
  ApiError,
} from "@examify-tms/interfaces";
import { canViewInvoice, canEditInvoice, canDeleteInvoice } from "../permissions/paymentPermissions";
import { generateInvoicePdf } from "../services/invoicePdfService";
import {
  sendInvoiceEmail,
  buildInvoiceEmailContent,
  defaultInvoiceMessage,
  defaultInvoiceSubject,
  invoiceFromName,
} from "../services/emailService";
import { getUserFromFirestore } from "../services/userService";
import { resolveTutorNames } from "../services/tutorResolver";
import { isStripeConfigured } from "../config/stripe";
import { getInvoiceResendCooldownMs, getPublicApiUrl } from "../config/email";
import { getStripeAccountRecord } from "../services/stripeConnectService";
import {
  recordInvoiceEventSafe,
  listInvoiceEventsFromFirestore,
} from "../services/invoiceEventService";
import {
  recordSentEmailSafe,
} from "../services/sentEmailService";

/**
 * Convert an Invoice (Date-typed) to an InvoiceResponse (ISO string-typed).
 */
function toInvoiceResponse(invoice: Invoice): InvoiceResponse {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v;
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    tutorId: invoice.tutorId,
    studentId: invoice.studentId,
    customerName: invoice.customerName,
    billingEmail: invoice.billingEmail,
    status: invoice.status as InvoiceStatus,
    currency: invoice.currency,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    total: invoice.total,
    paymentMethod: invoice.paymentMethod,
    issueDate: toIso(invoice.issueDate),
    dueDate: toIso(invoice.dueDate),
    paidAt: invoice.paidAt ? toIso(invoice.paidAt) : null,
    sentAt: invoice.sentAt ? toIso(invoice.sentAt) : null,
    notes: invoice.notes,
    stripePaymentIntentId: invoice.stripePaymentIntentId ?? null,
    createdAt: toIso(invoice.createdAt),
    updatedAt: toIso(invoice.updatedAt),
  };
}

/**
 * List invoices. Optional filters via query: status, search, sort, order.
 * Sorting/filtering is applied in memory since invoice volume per tutor is
 * modest; Firestore only filters by ownership.
 */
export async function listInvoices(
  req: Request,
  res: Response<InvoiceListResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Admins may drill into a single tutor via ?tutorId=…; otherwise they see
    // all invoices. Tutors are always scoped to their own uid.
    const drillTutorId =
      typeof req.query.tutorId === "string" ? req.query.tutorId : null;
    const scopeUid =
      req.user.role === "system_admin" && drillTutorId
        ? drillTutorId
        : req.user.uid;
    const scopeRole =
      req.user.role === "system_admin" && drillTutorId
        ? "tutor"
        : req.user.role;

    const invoices = await listInvoicesFromFirestore(scopeUid, scopeRole);

    const status = typeof req.query.status === "string" ? req.query.status : null;
    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim().toLowerCase()
        : "";
    const sort =
      typeof req.query.sort === "string" ? req.query.sort : "createdAt";
    const order = req.query.order === "asc" ? "asc" : "desc";

    let filtered = invoices;
    if (status && status !== "all") {
      filtered = filtered.filter((i) => i.status === status);
    }
    if (search.length > 0) {
      filtered = filtered.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(search) ||
          i.customerName.toLowerCase().includes(search)
      );
    }

    const sortField =
      sort === "total"
        ? (i: Invoice) => i.total
        : sort === "invoiceNumber"
        ? (i: Invoice) => i.invoiceNumber
        : sort === "customerName"
        ? (i: Invoice) => i.customerName.toLowerCase()
        : sort === "dueDate"
        ? (i: Invoice) => new Date(i.dueDate as any).getTime()
        : sort === "issueDate"
        ? (i: Invoice) => new Date(i.issueDate as any).getTime()
        : (i: Invoice) => new Date(i.createdAt as any).getTime();

    filtered = [...filtered].sort((a, b) => {
      const av = sortField(a);
      const bv = sortField(b);
      if (typeof av === "string" && typeof bv === "string") {
        return order === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return order === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });

    // Resolve tutor names for the admin (system-wide) view so the client can
    // render a "Tutor" column. Skipped for the tutor's own (single-tutor) view.
    let data = filtered.map(toInvoiceResponse);
    if (req.user.role === "system_admin") {
      const names = await resolveTutorNames(invoices.map((i) => i.tutorId));
      data = data.map((r, idx) => {
        const info = names.get(invoices[idx].tutorId);
        return {
          ...r,
          tutorName: info?.name ?? null,
          tutorEmail: info?.email ?? null,
        };
      });
    }

    const response: InvoiceListResponse = {
      data,
      total: filtered.length,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("List invoices failed:", error);
    const message = error instanceof Error ? error.message : "Failed to list invoices";
    res.status(500).json({ message });
  }
}

/**
 * Get a single invoice by ID.
 */
export async function getInvoiceById(
  req: Request<{ id: string }>,
  res: Response<InvoiceResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoice = await getInvoiceByIdFromFirestore(req.params.id);
    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    if (!canViewInvoice(invoice, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    res.status(200).json(toInvoiceResponse(invoice));
  } catch (error) {
    console.error("Get invoice failed:", error);
    const message = error instanceof Error ? error.message : "Failed to get invoice";
    res.status(500).json({ message });
  }
}

/**
 * Stream the invoice as an on-the-fly generated PDF. Used by the frontend
 * print / download view. The PDF is never persisted — it is regenerated from
 * the single shared template on each request.
 */
export async function getInvoicePdf(
  req: Request<{ id: string }>,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoice = await getInvoiceByIdFromFirestore(req.params.id);
    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    if (!canViewInvoice(invoice, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const tutor = await safeGetUser(invoice.tutorId);
    const pdfBuffer = await generateInvoicePdf(invoice, {
      tutorName: tutor?.name,
      tutorEmail: tutor?.email,
      abn: tutor?.invoiceSettings?.abn ?? null,
      bankDetails: tutor?.invoiceSettings?.bankDetails ?? null,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${invoice.invoiceNumber}.pdf"`
    );
    res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("Get invoice PDF failed:", error);
    const message = error instanceof Error ? error.message : "Failed to generate invoice PDF";
    res.status(500).json({ message });
  }
}

/**
 * Send an invoice to the billing contact. Generates the PDF on the fly,
 * emails it as an attachment, and — if the invoice is still a draft — flips
 * its status to "open". Open/overdue invoices can be resent. Paid/void
 * invoices cannot be sent.
 */
export async function sendInvoice(
  req: Request<{ id: string }, {}, { message?: string }>,
  res: Response<InvoiceResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoice = await getInvoiceByIdFromFirestore(req.params.id);
    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    if (!canEditInvoice(invoice, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    if (invoice.status === "paid" || invoice.status === "void") {
      res
        .status(409)
        .json({ message: `Cannot send a ${invoice.status} invoice` });
      return;
    }

    if (!invoice.billingEmail) {
      res
        .status(400)
        .json({ message: "This invoice has no billing email address on file" });
      return;
    }

    // Resend throttle: once an invoice has been emailed, don't allow another
    // send until the cooldown elapses. The first send (draft → open) has no
    // sentAt and is never blocked. Mirrors the notify-student cooldown so a
    // customer can't be spammed with repeated invoice/reminder emails.
    if (invoice.sentAt) {
      const cooldownMs = getInvoiceResendCooldownMs();
      const lastSentAt = new Date(invoice.sentAt as any);
      const elapsed = differenceInMilliseconds(Date.now(), lastSentAt);
      if (elapsed < cooldownMs) {
        const nextAllowedAt = addMilliseconds(lastSentAt, cooldownMs);
        res.status(429).json({
          message:
            "This invoice was already sent recently. You can send another reminder after " +
            nextAllowedAt.toLocaleString(),
        });
        return;
      }
    }

    const tutor = await safeGetUser(invoice.tutorId);
    const pdfBuffer = await generateInvoicePdf(invoice, {
      tutorName: tutor?.name,
      tutorEmail: tutor?.email,
      abn: tutor?.invoiceSettings?.abn ?? null,
      bankDetails: tutor?.invoiceSettings?.bankDetails ?? null,
    });

    // Embed a "Pay online" link when the tutor has connected a Stripe account
    // that is ready to accept charges (resolved via resolveInvoicePaymentUrl so
    // the preview and send paths stay identical).
    const paymentUrl = await resolveInvoicePaymentUrl(invoice);

    const actorName = await safeGetActorName(req.user.uid);

    try {
      const content = await sendInvoiceEmail({
        to: invoice.billingEmail,
        invoice,
        tutorName: tutor?.name,
        tutorEmail: tutor?.email,
        pdfBuffer,
        paymentUrl,
        message: req.body?.message,
      });

      await recordSentEmailSafe({
        type: "invoice",
        to: invoice.billingEmail,
        subject: content.subject,
        status: "sent",
        bodyHtml: content.html,
        tutorId: invoice.tutorId,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        sentBy: req.user.uid,
        sentByName: actorName,
      });
    } catch (sendError) {
      // Record the failed attempt so the history shows why nothing arrived,
      // then re-throw so the caller maps it to an HTTP status.
      await recordSentEmailSafe({
        type: "invoice",
        to: invoice.billingEmail,
        subject: "",
        status: "failed",
        errorMessage:
          sendError instanceof Error ? sendError.message : String(sendError),
        bodyHtml: "",
        tutorId: invoice.tutorId,
        invoiceId: invoice.id,
        studentId: invoice.studentId,
        sentBy: req.user.uid,
        sentByName: actorName,
      });
      throw sendError;
    }

    // Promote drafts to "open" once successfully delivered.
    if (invoice.status === "draft") {
      await updateInvoiceInFirestore(req.params.id, { status: "open" });
    }

    // Stamp the delivery timestamp so the UI can distinguish sent vs.
    // unsent invoices (e.g. those opened without sending).
    await markInvoiceSentInFirestore(req.params.id);

    const wasAlreadySent =
      invoice.sentAt !== null && invoice.sentAt !== undefined;
    await recordInvoiceEventSafe(
      req.params.id,
      wasAlreadySent ? "resent" : "sent",
      `${wasAlreadySent ? "Resent" : "Sent"} to ${invoice.billingEmail}`,
      actorName
    );

    const updated = await getInvoiceByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    res.status(200).json(toInvoiceResponse(updated));
  } catch (error) {
    console.error("Send invoice failed:", error);
    const message = error instanceof Error ? error.message : "Failed to send invoice";
    const status = message.includes("not configured") ? 503 : 500;
    res.status(status).json({ message });
  }
}

/**
 * Resolve the Stripe-hosted "Pay online" link for an invoice, if the tutor has
 * connected a Stripe account that is ready to accept charges. The link is a
 * stable redirect that mints a fresh Checkout session on each visit. Returns
 * undefined when Stripe isn't configured/ready (PDF-only email). Shared by the
 * send + preview paths so the email body never diverges between them.
 */
async function resolveInvoicePaymentUrl(invoice: Invoice): Promise<string | undefined> {
  if (!isStripeConfigured()) return undefined;
  try {
    const account = await getStripeAccountRecord(invoice.tutorId);
    if (account?.chargesEnabled) {
      return `${getPublicApiUrl()}/api/stripe/pay/${invoice.id}`;
    }
  } catch (error) {
    console.error("Failed to resolve Stripe pay link for invoice:", error);
  }
  return undefined;
}

/**
 * Shape returned by the invoice preview endpoint (mirrors the lesson preview
 * endpoints).
 */
interface EmailPreviewResponse {
  to: string[];
  subject: string;
  text: string;
  html: string;
  defaultSubject: string;
  defaultMessage: string;
}

/**
 * Preview the invoice email without sending (and without promoting a draft or
 * stamping sentAt). Renders the full email body — including the "Pay online"
 * button when Stripe is ready — so the compose dialog can show + let the tutor
 * edit the subject/message before sending. The PDF attachment is generated only
 * on the real send.
 */
export async function previewSendInvoice(
  req: Request<{ id: string }, {}, { message?: string }>,
  res: Response<EmailPreviewResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const invoice = await getInvoiceByIdFromFirestore(req.params.id);
    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }
    if (!canEditInvoice(invoice, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    if (!invoice.billingEmail) {
      res
        .status(400)
        .json({ message: "This invoice has no billing email address on file" });
      return;
    }

    const tutor = await safeGetUser(invoice.tutorId);
    const paymentUrl = await resolveInvoicePaymentUrl(invoice);

    const input = {
      to: invoice.billingEmail,
      invoice,
      tutorName: tutor?.name,
      tutorEmail: tutor?.email,
      paymentUrl,
      message: req.body?.message,
    };
    const content = buildInvoiceEmailContent(input);
    const fromName = invoiceFromName(input);

    res.status(200).json({
      to: [invoice.billingEmail],
      subject: content.subject,
      text: content.text,
      html: content.html,
      defaultSubject: defaultInvoiceSubject(invoice, fromName),
      defaultMessage: defaultInvoiceMessage(
        invoice.customerName,
        invoice,
        fromName,
        paymentUrl,
      ),
    });
  } catch (error) {
    console.error("Preview send invoice failed:", error);
    const message = error instanceof Error ? error.message : "Failed to preview email";
    res.status(500).json({ message });
  }
}

/**
 * Fetch the owning tutor's user record without throwing — missing tutors
 * shouldn't block PDF generation/email (we just omit their name).
 */
async function safeGetUser(uid: string) {
  try {
    return await getUserFromFirestore(uid);
  } catch {
    return null;
  }
}

/**
 * Resolve the display name of the authenticated user for timeline events.
 * Best-effort: returns null if the user record can't be loaded (the event
 * is still recorded, just without an actor attribution).
 */
async function safeGetActorName(uid: string | undefined): Promise<string | null> {
  if (!uid) return null;
  const user = await safeGetUser(uid);
  return user?.name ?? null;
}

/**
 * Build a short human-readable summary of which fields an update touched,
 * for the invoice timeline. Only mentions keys that were actually provided.
 */
function summarizeInvoiceUpdate(data: UpdateInvoiceRequest): string {
  const parts: string[] = [];
  if (data.lineItems !== undefined && data.lineItems !== null) {
    parts.push("line items");
  }
  if (data.dueDate !== undefined && data.dueDate !== null) {
    parts.push("due date");
  }
  if (data.paymentMethod !== undefined) {
    parts.push("payment method");
  }
  if (data.notes !== undefined) {
    parts.push("notes");
  }
  if (data.status !== undefined) {
    parts.push(`status to ${data.status}`);
  }
  if (parts.length === 0) return "Invoice updated";
  return `Updated ${parts.join(", ")}`;
}

/**
 * Convert an InvoiceEvent (Date-typed) to an InvoiceEventResponse
 * (ISO string-typed).
 */
function toInvoiceEventResponse(
  event: InvoiceEvent
): InvoiceEventResponse {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v;
  return {
    id: event.id,
    invoiceId: event.invoiceId,
    type: event.type,
    summary: event.summary,
    actorName: event.actorName ?? null,
    timestamp: toIso(event.timestamp),
  };
}

/**
 * Create a new invoice.
 */
export async function createInvoice(
  req: Request<{}, {}, CreateInvoiceRequest>,
  res: Response<InvoiceResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoice = await createInvoiceInFirestore(req.body, req.user.uid);

    await recordInvoiceEventSafe(
      invoice.id,
      "created",
      `Invoice created for ${invoice.customerName}`,
      await safeGetActorName(req.user.uid)
    );

    res.status(201).json(toInvoiceResponse(invoice));
  } catch (error) {
    console.error("Create invoice failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create invoice";
    const status = message.includes("not found") || message.includes("belong")
      ? 400
      : 500;
    res.status(status).json({ message });
  }
}

/**
 * Update an invoice.
 */
export async function updateInvoice(
  req: Request<{ id: string }, {}, UpdateInvoiceRequest>,
  res: Response<InvoiceResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoice = await getInvoiceByIdFromFirestore(req.params.id);
    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    if (!canEditInvoice(invoice, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    await updateInvoiceInFirestore(req.params.id, req.body);

    await recordInvoiceEventSafe(
      req.params.id,
      "updated",
      summarizeInvoiceUpdate(req.body),
      await safeGetActorName(req.user.uid)
    );

    const updated = await getInvoiceByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    res.status(200).json(toInvoiceResponse(updated));
  } catch (error) {
    console.error("Update invoice failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update invoice";
    const status = message.includes("draft") ? 400 : 500;
    res.status(status).json({ message });
  }
}

/**
 * Mark an invoice as paid. Triggers lesson isPaid + student amountOwed updates.
 */
  export async function markInvoicePaid(
  req: Request<{ id: string }, {}, MarkPaidRequest>,
  res: Response<InvoiceResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoice = await getInvoiceByIdFromFirestore(req.params.id);
    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    if (!canEditInvoice(invoice, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    if (invoice.status === "draft") {
      res.status(409).json({ message: "Cannot mark a draft invoice as paid. Send the invoice first." });
      return;
    }

    await markInvoicePaidInFirestore(req.params.id, req.body ?? {});

    await recordInvoiceEventSafe(
      req.params.id,
      "payment_received",
      `Marked as paid${
        req.body?.paymentMethod ? ` via ${req.body.paymentMethod}` : ""
      }`,
      await safeGetActorName(req.user.uid)
    );

    const updated = await getInvoiceByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    res.status(200).json(toInvoiceResponse(updated));
  } catch (error) {
    console.error("Mark invoice paid failed:", error);
    const message = error instanceof Error ? error.message : "Failed to mark invoice paid";
    const status =
      message.includes("already paid") || message.includes("void") ? 409 : 500;
    res.status(status).json({ message });
  }
}

/**
 * Void an invoice.
 */
export async function voidInvoice(
  req: Request<{ id: string }>,
  res: Response<InvoiceResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoice = await getInvoiceByIdFromFirestore(req.params.id);
    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    if (!canEditInvoice(invoice, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    await voidInvoiceInFirestore(req.params.id);

    await recordInvoiceEventSafe(
      req.params.id,
      "voided",
      "Invoice voided",
      await safeGetActorName(req.user.uid)
    );

    const updated = await getInvoiceByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    res.status(200).json(toInvoiceResponse(updated));
  } catch (error) {
    console.error("Void invoice failed:", error);
    const message = error instanceof Error ? error.message : "Failed to void invoice";
    res.status(500).json({ message });
  }
}

/**
 * Delete an invoice permanently.
 */
export async function deleteInvoice(
  req: Request<{ id: string }>,
  res: Response<{ message: string } | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoice = await getInvoiceByIdFromFirestore(req.params.id);
    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    if (!canDeleteInvoice(invoice, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    await deleteInvoiceFromFirestore(req.params.id);
    res.status(200).json({ message: "Invoice deleted" });
  } catch (error) {
    console.error("Delete invoice failed:", error);
    const message = error instanceof Error ? error.message : "Failed to delete invoice";
    res.status(500).json({ message });
  }
}

/**
 * Get all invoices for a specific student
 */
export async function getStudentInvoices(
  req: Request<{ studentId: string }>,
  res: Response<InvoiceListResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoices = await getStudentInvoicesFromFirestore(req.params.studentId);
    const response: InvoiceListResponse = {
      data: invoices.map(toInvoiceResponse),
      total: invoices.length,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Get student invoices failed:", error);
    const message = error instanceof Error ? error.message : "Failed to get student invoices";
    res.status(500).json({ message });
  }
}

/**
 * Get total debt for a specific student (from open and overdue invoices)
 */
export async function getStudentDebt(
  req: Request<{ studentId: string }>,
  res: Response<{ total: number } | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const total = await getStudentDebtFromFirestore(req.params.studentId);
    res.status(200).json({ total });
  } catch (error) {
    console.error("Get student debt failed:", error);
    const message = error instanceof Error ? error.message : "Failed to get student debt";
    res.status(500).json({ message });
  }
}

/**
 * Get the activity timeline for a single invoice (created, sent, paid, etc.),
 * oldest-first. Visibility follows the same invoice-view permission.
 */
export async function getInvoiceEvents(
  req: Request<{ id: string }>,
  res: Response<InvoiceEventListResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const invoice = await getInvoiceByIdFromFirestore(req.params.id);
    if (!invoice) {
      res.status(404).json({ message: "Invoice not found" });
      return;
    }

    if (!canViewInvoice(invoice, req)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const events = await listInvoiceEventsFromFirestore(req.params.id);
    const data = events.map(toInvoiceEventResponse);

    res.status(200).json({ data, total: data.length });
  } catch (error) {
    console.error("Get invoice events failed:", error);
    const message = error instanceof Error ? error.message : "Failed to get invoice events";
    res.status(500).json({ message });
  }
}
