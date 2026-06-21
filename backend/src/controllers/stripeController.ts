import { Request, Response } from "express";
import {
  StripeConnectStatusResponse,
  CreateAccountLinkResponse,
  DashboardLinkResponse,
  ApiError,
} from "@examify-tms/interfaces";
import { isStripeConfigured, getStripe, getStripeWebhookSecret } from "../config/stripe";
import { getUserFromFirestore } from "../services/userService";
import {
  getConnectStatus,
  createOnboardingLink,
  createDashboardLoginLink,
  getOrCreateConnectAccount,
  syncAccountStatusByStripeId,
} from "../services/stripeConnectService";
import {
  buildCheckoutUrlForInvoice,
  handleCheckoutCompleted,
} from "../services/stripeCheckoutService";

/**
 * Stripe Connect controllers
 *
 * Authenticated (JWT) routes let a tutor connect to and manage their Stripe
 * account. The pay-redirect endpoint and webhook handler are intentionally
 * public — the invoice recipient has no account, and webhooks arrive from
 * Stripe directly.
 */

function notConfigured(res: Response<ApiError>): boolean {
  if (!isStripeConfigured()) {
    res.status(503).json({
      message: "Online payments are not configured on this server.",
    });
    return true;
  }
  return false;
}

/**
 * GET /api/stripe/account — current connect status for the authenticated tutor.
 */
export async function getAccountStatus(
  req: Request,
  res: Response<StripeConnectStatusResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const status = await getConnectStatus(req.user.uid);
    res.status(200).json(status);
  } catch (error) {
    console.error("Get Stripe status failed:", error);
    const message = error instanceof Error ? error.message : "Failed to get Stripe status";
    const status = message.includes("not configured") ? 503 : 500;
    res.status(status).json({ message });
  }
}

/**
 * POST /api/stripe/connect — create/reuse the Express account and return a
 * single-use onboarding URL the client should redirect to.
 */
export async function connect(
  req: Request,
  res: Response<CreateAccountLinkResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (notConfigured(res)) return;

    // Pre-seed the Stripe account email from the user record when available.
    let email: string | undefined;
    try {
      const user = await getUserFromFirestore(req.user.uid);
      email = user?.email ?? undefined;
    } catch {
      // Non-fatal — Stripe onboarding will collect an email itself.
    }

    await getOrCreateConnectAccount(req.user.uid, email);
    const link = await createOnboardingLink(req.user.uid);

    res.status(200).json(link);
  } catch (error) {
    console.error("Stripe connect failed:", error);
    const message = error instanceof Error ? error.message : "Failed to start Stripe onboarding";
    res.status(500).json({ message });
  }
}

/**
 * POST /api/stripe/dashboard-link — a single-use Stripe dashboard login URL so
 * the tutor can manage payouts/balance.
 */
export async function dashboardLink(
  req: Request,
  res: Response<DashboardLinkResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (notConfigured(res)) return;

    const url = await createDashboardLoginLink(req.user.uid);
    res.status(200).json({ url });
  } catch (error) {
    console.error("Stripe dashboard link failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to open Stripe dashboard";
    const status = message.includes("No Stripe account") ? 404 : 500;
    res.status(status).json({ message });
  }
}

/**
 * GET /api/stripe/pay/:invoiceId — PUBLIC. Builds a fresh Checkout Session for
 * the invoice and 302 redirects to Stripe's hosted checkout. The invoice
 * recipient follows this link from the email. Guarded by invoice status and
 * the tutor's charges-enabled flag; never returns invoice data.
 */
export async function payRedirect(req: Request, res: Response): Promise<void> {
  try {
    if (!isStripeConfigured()) {
      res.status(503).send("Online payments are not available.");
      return;
    }
    const result = await buildCheckoutUrlForInvoice(req.params.invoiceId);
    if ("url" in result) {
      res.redirect(302, result.url);
      return;
    }
    // No session to build — render a plain message for the recipient.
    const message =
      result.reason === "already_paid"
        ? "This invoice has already been paid. Thank you!"
        : result.reason === "not_found"
        ? "This invoice could not be found."
        : "This invoice is no longer available for online payment.";
    res.status(200).type("text/html").send(
      `<div style="font-family:Arial,Helvetica,sans-serif;padding:40px;text-align:center;color:#111827"><p>${message}</p></div>`
    );
  } catch (error) {
    console.error("Stripe pay redirect failed:", error);
    res
      .status(500)
      .send("We couldn't start the payment. Please try again later.");
  }
}

/**
 * POST /api/stripe/webhook — PUBLIC. Verifies the Stripe signature on the raw
 * body and dispatches events. Must be registered with express.raw() (not the
 * global JSON parser) so signature verification works. Always responds 200
 * quickly.
 */
export async function webhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers["stripe-signature"];
  const secret = getStripeWebhookSecret();

  if (!secret || typeof signature !== "string") {
    res.status(400).send("Missing webhook signature or secret.");
    return;
  }

  const stripe = getStripe();
  let event;
  try {
    // req.body is a raw Buffer thanks to the express.raw() middleware on this route.
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      signature,
      secret
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    return;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          metadata?: { invoiceId?: string };
          payment_intent?: string | null;
        };
        const invoiceId = session.metadata?.invoiceId;
        const paymentIntent =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null;
        if (invoiceId) {
          await handleCheckoutCompleted(invoiceId, paymentIntent);
        } else {
          console.warn("Stripe checkout.session.completed without invoiceId metadata");
        }
        break;
      }
      case "account.updated": {
        const account = event.data.object as { id: string };
        if (account.id) {
          await syncAccountStatusByStripeId(account.id);
        }
        break;
      }
      default:
        // Unhandled event types are acknowledged but ignored.
        break;
    }
  } catch (error) {
    // Log but still 200 so Stripe doesn't retry a handler bug indefinitely.
    console.error(`Stripe webhook handler error for ${event.type}:`, error);
  }

  res.status(200).json({ received: true });
}
