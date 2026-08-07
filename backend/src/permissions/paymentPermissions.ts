import { Request } from "express";
import { canAccessOwned } from "./permissions";
import { Invoice } from "@examify-tms/interfaces";

/**
 * Invoice Permissions
 *
 * - System admins can access any invoice
 * - Tutors can only access their own invoices (invoice.tutorId === tutor's user ID)
 */

export const canViewInvoice = (invoice: Invoice, req?: Request): boolean =>
  canAccessOwned(invoice, req);

export const canEditInvoice = (invoice: Invoice, req?: Request): boolean =>
  canAccessOwned(invoice, req);

export const canDeleteInvoice = (invoice: Invoice, req?: Request): boolean =>
  canAccessOwned(invoice, req);
