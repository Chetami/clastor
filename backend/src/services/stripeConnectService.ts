import admin from "firebase-admin";
import { getFirebaseFirestore } from "../config/firebase";
import { getStripe, getAppUrl } from "../config/stripe";
import type { StripeConnectStatusResponse } from "@examify-tms/interfaces";
/**
 * Stripe Connect service
 *
 * Each tutor has at most one Stripe Express connected account. The link to
 * the tutor is held in the `stripeAccounts` Firestore collection, keyed by the
 * tutor's uid. All money flows through the tutor's own Stripe account; the
 * platform never holds funds (no application fee is ever charged).
 */

/** Firestore shape for a stripeAccounts document. */
export interface StripeAccountRecord {
  tutorId: string;
  stripeAccountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function docToRecord(
  data: admin.firestore.DocumentData
): StripeAccountRecord {
  return {
    tutorId: data.tutorId,
    stripeAccountId: data.stripeAccountId,
    detailsSubmitted: Boolean(data.detailsSubmitted),
    chargesEnabled: Boolean(data.chargesEnabled),
    payoutsEnabled: Boolean(data.payoutsEnabled),
    createdAt: data.createdAt?.toDate() ?? new Date(0),
    updatedAt: data.updatedAt?.toDate() ?? new Date(0),
  };
}

/**
 * Read the local connect record for a tutor, or null if none exists.
 */
export async function getStripeAccountRecord(
  tutorId: string
): Promise<StripeAccountRecord | null> {
  const firestore = getFirebaseFirestore();
  const snap = await firestore.collection("stripeAccounts").doc(tutorId).get();
  if (!snap.exists || !snap.data()) return null;
  return docToRecord(snap.data()!);
}

/**
 * Persist the local connect record (create or overwrite).
 */
async function saveStripeAccountRecord(
  record: StripeAccountRecord
): Promise<void> {
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();
  const payload = {
    tutorId: record.tutorId,
    stripeAccountId: record.stripeAccountId,
    detailsSubmitted: record.detailsSubmitted,
    chargesEnabled: record.chargesEnabled,
    payoutsEnabled: record.payoutsEnabled,
    createdAt: admin.firestore.Timestamp.fromDate(record.createdAt),
    updatedAt: now,
  };
  await firestore.collection("stripeAccounts").doc(record.tutorId).set(payload);
}

/**
 * Create a new Stripe Express connected account for a tutor (only if one does
 * not already exist) and persist the link. Returns the local record.
 */
export async function getOrCreateConnectAccount(
  tutorId: string,
  email?: string
): Promise<StripeAccountRecord> {
  const existing = await getStripeAccountRecord(tutorId);
  if (existing) return existing;

  const stripe = getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { tutorId },
    ...(email ? { email } : {}),
  });

  const record: StripeAccountRecord = {
    tutorId,
    stripeAccountId: account.id,
    detailsSubmitted: account.details_submitted ?? false,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await saveStripeAccountRecord(record);
  return record;
}

/**
 * Pull the latest account status from Stripe and sync it into Firestore.
 * Safe to call frequently; called lazily on status reads and from the
 * account.updated webhook.
 */
export async function syncAccountStatus(
  tutorId: string
): Promise<StripeAccountRecord | null> {
  const record = await getStripeAccountRecord(tutorId);
  if (!record) return null;

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(record.stripeAccountId);

  const updated: StripeAccountRecord = {
    ...record,
    detailsSubmitted: account.details_submitted ?? record.detailsSubmitted,
    chargesEnabled: account.charges_enabled ?? record.chargesEnabled,
    payoutsEnabled: account.payouts_enabled ?? record.payoutsEnabled,
    updatedAt: new Date(),
  };
  await saveStripeAccountRecord(updated);
  return updated;
}

/**
 * Sync status by Stripe account id (used by the account.updated webhook, which
 * only knows the Stripe account id). No-op if we have no local record for it.
 */
export async function syncAccountStatusByStripeId(
  stripeAccountId: string
): Promise<StripeAccountRecord | null> {
  const firestore = getFirebaseFirestore();
  const snap = await firestore
    .collection("stripeAccounts")
    .where("stripeAccountId", "==", stripeAccountId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const tutorId = snap.docs[0].data().tutorId as string;
  return syncAccountStatus(tutorId);
}

/**
 * Build a single-use Stripe-hosted onboarding URL for the tutor. Stripe sends
 * the tutor's browser to return_url when onboarding completes and to
 * refresh_url if the link expires mid-flow; both point back into the frontend,
 * which re-mints a fresh link via the authenticated /connect endpoint.
 */
export async function createOnboardingLink(
  tutorId: string
): Promise<{ url: string; type: "account_onboarding" }> {
  const record = await getOrCreateConnectAccount(tutorId);
  const stripe = getStripe();
  const appUrl = getAppUrl();
  const link = await stripe.accountLinks.create({
    account: record.stripeAccountId,
    type: "account_onboarding",
    return_url: `${appUrl}/settings/payments?stripe=return`,
    refresh_url: `${appUrl}/settings/payments?stripe=refresh`,
  });
  return { url: link.url, type: "account_onboarding" };
}

/**
 * Build a single-use Stripe Express dashboard login link so the tutor can view
 * their balance, payouts and bank details. Requires an existing account.
 */
export async function createDashboardLoginLink(
  tutorId: string
): Promise<string> {
  const record = await getStripeAccountRecord(tutorId);
  if (!record) {
    throw new Error("No Stripe account is connected for this tutor");
  }
  const stripe = getStripe();
  const link = await stripe.accounts.createLoginLink(record.stripeAccountId);
  return link.url;
}

/**
 * Return the connect status for the authenticated tutor, refreshing the
 * charges/payouts flags from Stripe first (cheap retrieve) when a record
 * exists. Never throws for "not connected" — returns a not-connected status.
 */
export async function getConnectStatus(
  tutorId: string
): Promise<StripeConnectStatusResponse> {
  const record = await getStripeAccountRecord(tutorId);
  if (!record) {
    return {
      connected: false,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      stripeAccountId: null,
      createdAt: null,
    };
  }

  // Best-effort refresh; if Stripe is unreachable we fall back to stored flags.
  let current = record;
  try {
    const refreshed = await syncAccountStatus(tutorId);
    if (refreshed) current = refreshed;
  } catch (error) {
    console.error("Stripe account status refresh failed:", error);
  }

  return {
    connected: true,
    detailsSubmitted: current.detailsSubmitted,
    chargesEnabled: current.chargesEnabled,
    payoutsEnabled: current.payoutsEnabled,
    stripeAccountId: current.stripeAccountId,
    createdAt: current.createdAt.toISOString(),
  };
}
