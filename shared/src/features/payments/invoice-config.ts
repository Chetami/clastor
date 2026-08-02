/**
 * Single source of truth for invoice defaults.
 *
 * The due-date lead time is the main knob here: it's currently a constant, but
 * the intention is to drive it from tutor preferences later. Keeping it in one
 * place means the create-invoice page, the quick-invoice flow, and any future
 * mobile client always agree.
 */
export const DEFAULT_INVOICE_DUE_DAYS = 14;

/** Default invoice due date as a full ISO timestamp (now + lead time). */
export function defaultInvoiceDueDate(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + DEFAULT_INVOICE_DUE_DAYS);
  return d.toISOString();
}

/** Default invoice due date as a `YYYY-MM-DD` string (for <input type="date">). */
export function defaultInvoiceDueDateInput(now: Date = new Date()): string {
  return defaultInvoiceDueDate(now).slice(0, 10);
}
