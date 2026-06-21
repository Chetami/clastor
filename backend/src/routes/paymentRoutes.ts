import { Router } from "express";
import {
  listInvoices,
  getInvoiceById,
  getInvoicePdf,
  createInvoice,
  updateInvoice,
  markInvoicePaid,
  voidInvoice,
  deleteInvoice,
  sendInvoice,
  getStudentInvoices,
  getStudentDebt,
} from "../controllers/paymentController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/payments
 * List invoices — supports status, search, sort, order query filters.
 */
router.get("/", authenticateJWT, listInvoices);

/**
 * GET /api/payments/:id
 * Get a single invoice by ID.
 */
router.get("/:id", authenticateJWT, getInvoiceById);

/**
 * GET /api/payments/:id/pdf
 * Stream the invoice rendered as a PDF (generated on the fly, not stored).
 * Used for printing and downloading.
 */
router.get("/:id/pdf", authenticateJWT, getInvoicePdf);

/**
 * GET /api/payments/student/:studentId/invoices
 * Get all invoices for a specific student.
 */
router.get("/student/:studentId/invoices", authenticateJWT, getStudentInvoices);

/**
 * GET /api/payments/student/:studentId/debt
 * Get total debt for a specific student (from open and overdue invoices).
 */
router.get("/student/:studentId/debt", authenticateJWT, getStudentDebt);

/**
 * POST /api/payments
 * Create a new invoice from one or more unpaid lessons for a student.
 */
router.post(
  "/",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  createInvoice
);

/**
 * PATCH /api/payments/:id
 * Update an invoice (due date, notes, status, payment method, line items).
 * Line items only editable while draft.
 */
router.patch(
  "/:id",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  updateInvoice
);

/**
 * POST /api/payments/:id/mark-paid
 * Mark an invoice as paid. Flips isPaid on linked lessons and decrements
 * the student's amountOwed.
 */
router.post(
  "/:id/mark-paid",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  markInvoicePaid
);

/**
 * POST /api/payments/:id/void
 * Void an invoice.
 */
router.post(
  "/:id/void",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  voidInvoice
);

/**
 * POST /api/payments/:id/send
 * Email the invoice PDF to the billing contact and promote a draft to "open".
 */
router.post(
  "/:id/send",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  sendInvoice
);

/**
 * DELETE /api/payments/:id
 * Delete an invoice permanently.
 */
router.delete(
  "/:id",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  deleteInvoice
);

export default router;
