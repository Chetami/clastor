import { getFirebaseAuth } from "../config/firebase";
import type { DecodedIdToken } from "firebase-admin/auth";
import { UnauthorizedError, ServiceUnavailableError } from "../utils/AppError";
import {
  getEmailTransporter,
  getSenderAddress,
  getSenderDisplayName,
  isEmailConfigured,
} from "../config/email";
import { emailButtonHtml, wrapEmailHtml } from "./emailLayout";

/**
 * Verify Firebase ID token
 * @param token - Firebase ID token from client
 * @returns Decoded token with user info
 */
export async function verifyFirebaseToken(token: string): Promise<DecodedIdToken> {
  try {
    const firebaseAuth = getFirebaseAuth();
    const decodedToken = await firebaseAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error("Firebase token verification failed:", error);
    throw new UnauthorizedError("Invalid Firebase token");
  }
}

/**
 * Read the user's current email-verification status straight from Firebase
 * Auth. Firestore doesn't mirror this flag, so this is the only source of
 * truth. Throws UnauthorizedError when the Auth record is gone (user deleted
 * server-side) — callers should treat that as an invalid session.
 */
export async function getEmailVerified(uid: string): Promise<boolean> {
  try {
    const user = await getFirebaseAuth().getUser(uid);
    return user.emailVerified;
  } catch (error) {
    console.error("Firebase getUser failed:", error);
    throw new UnauthorizedError("User no longer exists");
  }
}

/**
 * Shared helper for the frontend-facing base URL used in email links.
 */
function getFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.CORS_ORIGIN ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}

/**
 * Generate a Firebase email-verification link for the given address and email
 * it to the user via the app's SMTP transport. Used by the resend-verification
 * endpoint and (best-effort) at registration — unlike the client SDK's
 * sendEmailVerification this works even when the requesting device has no live
 * Firebase session, and every email goes through the branded layout.
 *
 * No-op (returns false) when the address is already verified, so repeated
 * resends are harmless.
 *
 * @returns true if an email was sent, false if the user was already verified.
 */
export async function sendEmailVerificationEmail(
  uid: string,
  email: string,
): Promise<boolean> {
  const firebaseAuth = getFirebaseAuth();

  const authUser = await firebaseAuth.getUser(uid);
  if (authUser.emailVerified) return false;

  if (!isEmailConfigured()) {
    throw new ServiceUnavailableError(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send verification emails."
    );
  }

  // Firebase hosts the page that applies the oobCode; `url` controls where
  // the user ends up afterwards.
  const link = await firebaseAuth.generateEmailVerificationLink(email, {
    url: `${getFrontendUrl()}/login`,
  });

  const brand = getSenderDisplayName();
  const text =
    `Welcome to ${brand}! Please verify your email address by opening the link below:\n\n` +
    `${link}\n\n` +
    `If you didn't create an account, you can safely ignore this email.`;
  const html = wrapEmailHtml(
    `<p style="margin:0 0 12px 0">Welcome to ${brand}! Verify your email address to unlock sending emails to students and invoices.</p>` +
    `<p style="margin:0 0 20px 0">${emailButtonHtml(link, "Verify email")}</p>` +
    `<p style="margin:0 0 12px 0;font-size:13px;color:#6b7280">Or paste this link into your browser:<br>` +
    `<a href="${link}" style="color:#2563eb;word-break:break-all">${link}</a></p>` +
    `<p style="margin:0;color:#6b7280;font-size:13px">If you didn't create an account, you can safely ignore this email.</p>`
  );

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    from: `"${brand}" <${getSenderAddress()}>`,
    to: email,
    subject: "Verify your email",
    text,
    html,
  });

  return true;
}

/**
 * Generate a Firebase password-reset link for the given address and email it
 * via the app's SMTP transport. Used by the public forgot-password endpoint.
 *
 * Deliberately returns false (rather than throwing) for unknown addresses and
 * Google-only accounts so the endpoint can respond identically whether or not
 * the account exists — preventing account enumeration. Only SMTP failures
 * throw, which the controller maps to a generic 200 anyway.
 *
 * @returns true if an email was sent.
 */
export async function sendPasswordResetEmail(
  email: string,
): Promise<boolean> {
  const firebaseAuth = getFirebaseAuth();

  let authUser;
  try {
    authUser = await firebaseAuth.getUserByEmail(email);
  } catch {
    // No Firebase account for that address — silently no-op.
    return false;
  }

  // Google-only accounts have no password to reset; sending a reset link
  // would confusingly create a password credential. Skip them.
  const hasPasswordProvider = authUser.providerData.some(
    (p) => p.providerId === "password",
  );
  if (!hasPasswordProvider) return false;

  if (!isEmailConfigured()) {
    throw new ServiceUnavailableError(
      "Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS to send password resets."
    );
  }

  const link = await firebaseAuth.generatePasswordResetLink(email, {
    url: `${getFrontendUrl()}/login`,
  });

  const brand = getSenderDisplayName();
  const text =
    `A password reset was requested for your ${brand} account. Open the link below to choose a new password:\n\n` +
    `${link}\n\n` +
    `The link expires in 1 hour. If you didn't request this, you can safely ignore this email.`;
  const html = wrapEmailHtml(
    `<p style="margin:0 0 12px 0">A password reset was requested for your ${brand} account. Click the button below to choose a new password.</p>` +
    `<p style="margin:0 0 20px 0">${emailButtonHtml(link, "Reset password")}</p>` +
    `<p style="margin:0 0 12px 0;font-size:13px;color:#6b7280">This link expires in 1 hour.</p>` +
    `<p style="margin:0;color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email.</p>`
  );

  const transporter = getEmailTransporter();
  await transporter.sendMail({
    from: `"${brand}" <${getSenderAddress()}>`,
    to: email,
    subject: "Reset your password",
    text,
    html,
  });

  return true;
}
