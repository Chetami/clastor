import { Request, Response } from "express";
import { verifyFirebaseToken, getEmailVerified, sendEmailVerificationEmail, sendPasswordResetEmail } from "../services/authService";
import { getUserFromFirestore, findUserInFirestore, updateLastActive, createUserInFirestore, toUserInfo } from "../services/userService";
import { addToWaitlist } from "../services/waitlistService";
import { issueNewTokenPair, rotateRefreshToken, revokeRefreshToken } from "../services/tokenService";
import { LoginResponse, UserInfo, ApiError } from "@examify-tms/interfaces";
import { RegisterRequest, GoogleAuthRequest, RefreshTokenResponse, JoinWaitlistRequest, JoinWaitlistResponse, ForgotPasswordRequest, ForgotPasswordResponse } from "@examify-tms/interfaces";
import { AppError, UnauthorizedError } from "../utils/AppError";
import { respondToAuthError } from "../utils/authError";

/**
 * Login controller
 * Verifies Firebase token and returns custom JWT
 */
export async function login(req: Request, res: Response<LoginResponse | ApiError>) {
  try {
    // Get Firebase token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access Denied. No token provided." });
    }

    const firebaseToken = authHeader.substring(7);

    // Verify Firebase token
    const decodedFirebase = await verifyFirebaseToken(firebaseToken);

    // Get user from Firestore
    const user = await getUserFromFirestore(decodedFirebase.uid);

    // Generate access + refresh token pair
    const { jwtToken, refreshToken } = await issueNewTokenPair(user, decodedFirebase.auth_time);

    // Update last active timestamp
    await updateLastActive(user.id);

    const userInfo: UserInfo = toUserInfo(user, decodedFirebase.email_verified === true);

    return res.status(200).json({
      jwtToken,
      refreshToken,
      user: userInfo,
    });
  } catch (error) {
    respondToAuthError(res, error);
  }
}

/**
 * Verify token controller
 * Verifies JWT and returns user info
 */
export async function verifyToken(req: Request, res: Response<{ user: UserInfo } | ApiError>) {
  // If we reach here, the middleware has already verified the token
  // and attached user info to req.user
  if (!req.user) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const user = await getUserFromFirestore(req.user.uid);

    // Verification status lives in Firebase Auth, not Firestore — read it live
    // so the client sees the current state on every session bootstrap.
    const emailVerified = await getEmailVerified(req.user.uid, req.user.auth_time);

    const userInfo: UserInfo = toUserInfo(user, emailVerified);

    return res.status(200).json({
      user: userInfo,
    });
  } catch (error) {
    respondToAuthError(res, error);
  }
}

/**
 * Google authentication controller
 * Verifies a Firebase ID token obtained via Google sign-in.
 * If the user exists, logs them in; otherwise creates their Firestore
 * document using profile data from the decoded token, then issues a custom JWT.
 */
export async function googleAuth(
  req: Request<{}, {}, GoogleAuthRequest>,
  res: Response<LoginResponse | ApiError>
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Access Denied. No token provided.' });
      return;
    }

    const firebaseToken = authHeader.substring(7);
    const decodedFirebase = await verifyFirebaseToken(firebaseToken);

    if (decodedFirebase.firebase?.sign_in_provider !== "google.com") {
      throw new UnauthorizedError("A Google sign-in credential is required");
    }

    const existingUser = await findUserInFirestore(decodedFirebase.uid);

    let user;
    if (existingUser) {
      user = existingUser;
    } else {
      const name = decodedFirebase.name || decodedFirebase.email?.split('@')[0] || 'User';
      const email = decodedFirebase.email || '';
      const avatarUrl = decodedFirebase.picture || null;
      const tz =
        typeof req.body?.timezone === 'string' ? req.body.timezone : null;
      user = await createUserInFirestore(
        decodedFirebase.uid,
        email,
        name,
        'tutor',
        avatarUrl,
        undefined,
        tz,
        req.body?.signupSurvey ?? null,
      );
    }

    const { jwtToken, refreshToken } = await issueNewTokenPair(user, decodedFirebase.auth_time);
    await updateLastActive(user.id);

    const userInfo: UserInfo = toUserInfo(user, decodedFirebase.email_verified === true);

    res.status(200).json({
      jwtToken,
      refreshToken,
      user: userInfo,
      isNewUser: !existingUser,
    });
  } catch (error) {
    respondToAuthError(res, error);
  }
}

/**
 * Register controller
 * Creates Firestore document for Firebase-authenticated user and issues custom JWT
 */
export async function register(
  req: Request<{}, {}, RegisterRequest>,
  res: Response<LoginResponse | ApiError>
): Promise<void> {
  try {
    // 1. Extract and verify Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }

    const firebaseToken = authHeader.substring(7);
    const decodedToken = await verifyFirebaseToken(firebaseToken);

    // 2. Validate name field (structural validation lives in the route schema;
    //    trim here so the stored value is clean).
    const name = req.body.name?.trim();

    // 3. Check if user already exists in Firestore
    const existingUser = await findUserInFirestore(decodedToken.uid);

    // Provision once; a retry for this verified UID returns the existing account.
    const user = existingUser ?? await createUserInFirestore(
      decodedToken.uid,
      decodedToken.email || '',
      name,
      'tutor', // Default role for new users
      null,
      undefined,
      typeof req.body.timezone === 'string' ? req.body.timezone : null,
      req.body.signupSurvey ?? null,
    );

    // 4b. Best-effort: send the branded verification email now that the
    // account fully exists. Failure (SMTP down, rate limit) must not fail
    // sign-up — the in-app verify-email banner offers a resend.
    try {
      if (!existingUser && decodedToken.email && decodedToken.email_verified !== true) {
        await sendEmailVerificationEmail(decodedToken.uid, decodedToken.email);
      }
    } catch (verificationError) {
      console.warn('Could not send registration verification email');
    }

    // 5. Generate access + refresh token pair
    const { jwtToken, refreshToken } = await issueNewTokenPair(user, decodedToken.auth_time);

    // 6. Update last active timestamp (consistent with login endpoint)
    await updateLastActive(user.id);

    // 7. Return UserInfo (not full User, consistent with login endpoint)
    const userInfo: UserInfo = toUserInfo(user, decodedToken.email_verified === true);

    res.status(200).json({ jwtToken, refreshToken, user: userInfo });
  } catch (error) {
    respondToAuthError(res, error);
  }
}

/**
 * Refresh controller
 * Accepts a (rotating) refresh token, validates + rotates it, and returns a
 * fresh access token + refresh token pair. No Authorization header required —
 * the refresh token itself is the credential.
 */
export async function refresh(
  req: Request<{}, {}, { refreshToken?: string }>,
  res: Response<RefreshTokenResponse | ApiError>,
): Promise<void> {
  // Presence + non-empty are enforced by the route's body schema.
  const presentedToken = req.body!.refreshToken!;

  try {
    const result = await rotateRefreshToken(presentedToken);
    res.status(200).json(result);
  } catch (error) {
    respondToAuthError(res, error);
  }
}

/**
 * Logout controller
 * Revokes the presented refresh token server-side. Best-effort and always
 * returns 200 so the client can complete its local sign-out regardless.
 */
export async function logout(
  req: Request<{}, {}, { refreshToken?: string }>,
  res: Response<{ message: string }>,
): Promise<void> {
  await revokeRefreshToken(req.body?.refreshToken);
  res.status(200).json({ message: "Logged out" });
}

/**
 * Join waitlist controller
 * Pre-signup endpoint for organisations (org features not live yet). Stores
 * the email + qualifier survey in a Firestore `waitlist` collection. Public
 * — no Firebase token required.
 */
export async function joinWaitlist(
  req: Request<{}, {}, JoinWaitlistRequest>,
  res: Response<JoinWaitlistResponse | ApiError>,
): Promise<void> {
  try {
    const email = req.body.email?.trim();
    if (!email) {
      res.status(400).json({ message: "A valid email is required" });
      return;
    }

    const joined = await addToWaitlist(email, req.body.signupSurvey ?? null);
    res.status(200).json({ joined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to join waitlist";
    res.status(400).json({ message });
  }
}

/**
 * Forgot-password controller
 * Sends a branded password-reset email via the Admin SDK + SMTP. Always
 * returns the same generic 200 whether or not the address is known, so the
 * endpoint can't be used to enumerate accounts. SMTP failures are logged and
 * also swallowed to the same 200 — the user experience of "check your inbox"
 * is preferable to revealing email configuration details.
 */
export async function forgotPassword(
  req: Request<{}, {}, ForgotPasswordRequest>,
  res: Response<ForgotPasswordResponse>,
): Promise<void> {
  const email = req.body.email?.trim();

  if (email) {
    try {
      await sendPasswordResetEmail(email);
    } catch (error) {
      console.error("Could not send password reset email");
    }
  }

  res.status(200).json({
    message: "If an account exists for that email, a reset link has been sent.",
  });
}

/**
 * Resend email verification controller
 * Generates a fresh Firebase verification link for the authenticated user and
 * emails it via SMTP. Works on any device (no live Firebase client session
 * needed, unlike the client SDK's sendEmailVerification). No-op success when
 * the user is already verified.
 */
export async function resendVerification(
  req: Request,
  res: Response<{ message: string; sent: boolean } | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Invalid token" });
    return;
  }

  try {
    const user = await getUserFromFirestore(req.user.uid);
    const sent = await sendEmailVerificationEmail(user.id, user.email);
    res.status(200).json({
      sent,
      message: sent
        ? "Verification email sent"
        : "Your email is already verified",
    });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error("Could not resend verification email");
    res.status(500).json({ message: "Failed to send verification email" });
  }
}
