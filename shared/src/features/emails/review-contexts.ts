import type { EmailReviewSettings } from "@examify-tms/interfaces";

/**
 * Named contexts from which an outbound email can be triggered. Each declares
 * whether it should bypass the email-review/compose step and send immediately
 * in the background (`background: true` — an "exception"), or go through the
 * normal review dialog (`background: false`).
 *
 * The user's global `emailReviewSettings.reviewEnabled` flag is the master
 * switch: when off, EVERY context sends in the background regardless of its
 * declaration here (see {@link shouldSkipReview}).
 *
 * To opt a new surface out of the review step, add an entry here with
 * `background: true` and reference its `key` at the call site via
 * `shouldSkipReview(...)`.
 */
export const EMAIL_SEND_CONTEXTS = {
  /** Things-to-do: mark attendance + send invoice — fire and forget. */
  ATTENDANCE_MARKING: { key: "attendance-marking", background: true },
  /** Manual invoice creation flow — review before sending. */
  INVOICE_CREATE: { key: "invoice-create", background: false },
  /** Resend from invoice detail/list — review before sending. */
  INVOICE_RESEND: { key: "invoice-resend", background: false },
  /** Send from a lesson row — review before sending. */
  LESSON_ROW_SEND: { key: "lesson-row-send", background: false },
  /** Send from the calendar popover — review before sending. */
  CALENDAR_POPOVER_SEND: { key: "calendar-popover-send", background: false },
} as const;

export type EmailSendContextKey =
  (typeof EMAIL_SEND_CONTEXTS)[keyof typeof EMAIL_SEND_CONTEXTS]["key"];

/**
 * Decide whether an outbound email should skip the review/compose step and
 * send immediately in the background.
 *
 * Returns `true` when the email should be sent with no review dialog:
 * - If the user has disabled review globally (`reviewEnabled === false`),
 *   every send is a background send.
 * - Otherwise, only contexts registered with `background: true` skip review.
 *
 * @param contextKey  The named context the email is being sent from (see
 *                    {@link EMAIL_SEND_CONTEXTS}). Omit when the decision is
 *                    purely global.
 * @param settings    The user's email-review settings. `null`/`undefined`
 *                    means "not configured" — treated as review enabled.
 */
export function shouldSkipReview(
  contextKey: EmailSendContextKey | undefined,
  settings: EmailReviewSettings | null | undefined,
): boolean {
  if (settings?.reviewEnabled === false) return true;
  if (!contextKey) return false;
  const ctx = Object.values(EMAIL_SEND_CONTEXTS).find(
    (c) => c.key === contextKey,
  );
  return ctx?.background === true;
}
