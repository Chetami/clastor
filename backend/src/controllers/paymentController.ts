import { Request, Response } from "express";
import {
  listInvoicesFromFirestore,
  getInvoiceByIdFromFirestore,
  createInvoiceInFirestore,
  updateInvoiceInFirestore,
  markInvoicePaidInFirestore,
  voidInvoiceInFirestore,
  deleteInvoiceFromFirestore,
} from "../services/paymentService";
import {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  MarkPaidRequest,
  Invoice,
  InvoiceResponse,
  InvoiceListResponse,
  InvoiceStatus,
  ApiError,
} from "@examify-tms/interfaces";
import { canViewInvoice, canEditInvoice, canDeleteInvoice } from "../permissions/paymentPermissions";

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
    notes: invoice.notes,
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

    const invoices = await listInvoicesFromFirestore(req.user.uid, req.user.role);

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

    const response: InvoiceListResponse = {
      data: filtered.map(toInvoiceResponse),
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
