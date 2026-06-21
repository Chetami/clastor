import { Request } from "express";
import * as permissions from "./permissions";
import { Invoice } from "@examify-tms/interfaces";

/**
 * Invoice Permissions
 *
 * - System admins can access any invoice
 * - Tutors can only access their own invoices (invoice.tutorId === tutor's user ID)
 */

export const canViewInvoice = (invoice: Invoice, req?: Request): boolean => {
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }
  return permissions.isSameUser(invoice.tutorId, req?.user?.uid);
};

export const canEditInvoice = (invoice: Invoice, req?: Request): boolean => {
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }
  return permissions.isSameUser(invoice.tutorId, req?.user?.uid);
};

export const canDeleteInvoice = (invoice: Invoice, req?: Request): boolean => {
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }
  return permissions.isSameUser(invoice.tutorId, req?.user?.uid);
};
