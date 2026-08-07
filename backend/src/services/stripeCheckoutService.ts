import type { Invoice } from "@examify-tms/interfaces";
import { getStripe, getAppUrl } from "../config/stripe";
import { getStripeAccountRecord } from "./stripeConnectService";
import {
  getInvoiceByIdFromFirestore,
  markInvoicePaidFromStripe,
} from "./paymentService";
import { BadRequestError, ConflictError, ForbiddenError } from "../utils/AppError";

/**
 * Stripe Checkout service
 *
 * Creates a direct-charge Checkout Session on the tutor's connected Stripe
 * account. The charge therefore lives on the tutor's account and Stripe pays
 * the funds out to their bank — the platform never holds or receives the
 * money (no application_fee_amount is set; 100% goes to the tutor).
 *
 * Checkout sessions expire 24h after creation, so rather than baking a session
 * URL into an invoice email, we expose a stable redirect endpoint
 * (see stripeRoutes `GET /pay/:invoiceId`) that mints a fresh session on each
 * visit and redirects to Stripe. This keeps the emailed link valid for the
 * full life of the invoice.
 */

const PAYABLE_STATUSES = new Set(["open", "overdue"]);

/**
 * Build the hosted Stripe Checkout session for an invoice and return its URL.
 * Throws with a clear message if the tutor cannot accept payments or the
 * invoice is not payable.
 */
export async function createInvoiceCheckoutUrl(
  invoice: Invoice,
  tutorId: string
): Promise<string> {
  if (invoice.tutorId !== tutorId) {
    throw new ForbiddenError("Invoice does not belong to this tutor");
  }
  if (!PAYABLE_STATUSES.has(invoice.status)) {
    throw new ConflictError(`This invoice cannot be paid (status: ${invoice.status})`);
  }

  const record = await getStripeAccountRecord(tutorId);
  if (!record) {
    throw new BadRequestError(
      "This tutor has not connected a Stripe account to accept payments"
    );
  }
  if (!record.chargesEnabled) {
    throw new BadRequestError(
      "Stripe account is not ready to accept payments yet. Complete onboarding first."
    );
  }

  const amountInCents = Math.round(invoice.total * 100);
  if (amountInCents < 50) {
    // Stripe's minimum per-transaction amount.
    throw new BadRequestError(
      "Invoice total is below the minimum amount Stripe can charge"
    );
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      // Single ad-hoc line item describing the invoice — avoids needing a
      // pre-created Price on the connected account.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: (invoice.currency || "aud").toLowerCase(),
            unit_amount: amountInCents,
            product_data: {
              name: `Invoice ${invoice.invoiceNumber}`,
              description: invoice.customerName
                ? `Billed to ${invoice.customerName}`
                : undefined,
            },
          },
        },
      ],
      // No application_fee_amount => the full amount goes to the tutor.
      metadata: {
        invoiceId: invoice.id,
        tutorId,
        invoiceNumber: invoice.invoiceNumber,
      },
      client_reference_id: invoice.id,
      success_url: `${appUrl}/pay/success?invoice=${invoice.id}`,
      cancel_url: `${appUrl}/pay/cancel?invoice=${invoice.id}`,
    },
    { stripeAccount: record.stripeAccountId }
  );

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return session.url;
}

/**
 * Public entry point used by the email redirect endpoint: load the invoice by
 * id, validate it's payable, and return a fresh hosted Checkout URL. Returns
 * null when the invoice can't be paid (already paid/voided) so the caller can
 * render an appropriate page instead of redirecting to Stripe.
 */
export async function buildCheckoutUrlForInvoice(
  invoiceId: string
): Promise<{ url: string } | { reason: string }> {
  const invoice = await getInvoiceByIdFromFirestore(invoiceId);
  if (!invoice) return { reason: "not_found" };
  if (!PAYABLE_STATUSES.has(invoice.status)) {
    return { reason: invoice.status === "paid" ? "already_paid" : "not_payable" };
  }
  const url = await createInvoiceCheckoutUrl(invoice, invoice.tutorId);
  return { url };
}

/**
 * Handle a successful Checkout Session from the webhook: mark the related
 * invoice paid via the shared, idempotent helper.
 */
export async function handleCheckoutCompleted(
  invoiceId: string,
  paymentIntentId: string | null
): Promise<void> {
  await markInvoicePaidFromStripe(invoiceId, paymentIntentId);
}
