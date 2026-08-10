import { Request, Response } from "express";
import { verifyFirebaseToken } from "../services/authService";
import { getUserFromFirestore, updateLastActive, createUserInFirestore, toUserInfo } from "../services/userService";
import { addToWaitlist } from "../services/waitlistService";
import { issueNewTokenPair, rotateRefreshToken, revokeRefreshToken } from "../services/tokenService";
import { LoginResponse, UserInfo, ApiError } from "@examify-tms/interfaces";
import { RegisterRequest, RefreshTokenResponse, JoinWaitlistRequest, JoinWaitlistResponse } from "@examify-tms/interfaces";

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
    const { jwtToken, refreshToken } = await issueNewTokenPair(user);

    // Update last active timestamp
    await updateLastActive(user.id);

    const userInfo: UserInfo = toUserInfo(user);

    return res.status(200).json({
      jwtToken,
      refreshToken,
      user: userInfo,
    });
  } catch (error) {
    console.error("Login failed:", error);
    const message = error instanceof Error ? error.message : "Login failed";
    return res.status(401).json({ message });
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

    const userInfo: UserInfo = toUserInfo(user);

    return res.status(200).json({
      user: userInfo,
    });
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(404).json({ message: "User not found" });
  }
}

/**
 * Google authentication controller
 * Verifies a Firebase ID token obtained via Google sign-in.
 * If the user exists, logs them in; otherwise creates their Firestore
 * document using profile data from the decoded token, then issues a custom JWT.
 */
export async function googleAuth(
  req: Request,
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

    const existingUser = await getUserFromFirestore(decodedFirebase.uid).catch(() => null);

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

    const { jwtToken, refreshToken } = await issueNewTokenPair(user);
    await updateLastActive(user.id);

    const userInfo: UserInfo = toUserInfo(user);

    res.status(200).json({ jwtToken, refreshToken, user: userInfo });
  } catch (error) {
    console.error('Google authentication failed:', error);
    const message = error instanceof Error ? error.message : 'Google authentication failed';
    res.status(401).json({ message });
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
    const existingUser = await getUserFromFirestore(decodedToken.uid).catch(() => null);
    if (existingUser) {
      res.status(409).json({ message: 'User already exists' });
      return;
    }

    // 4. Create Firestore document
    const user = await createUserInFirestore(
      decodedToken.uid,
      decodedToken.email || '',
      name,
      'tutor', // Default role for new users
      null,
      undefined,
      typeof req.body.timezone === 'string' ? req.body.timezone : null,
      req.body.signupSurvey ?? null,
    );

    // 5. Generate access + refresh token pair
    const { jwtToken, refreshToken } = await issueNewTokenPair(user);

    // 6. Update last active timestamp (consistent with login endpoint)
    await updateLastActive(user.id);

    // 7. Return UserInfo (not full User, consistent with login endpoint)
    const userInfo: UserInfo = toUserInfo(user);

    res.status(200).json({ jwtToken, refreshToken, user: userInfo });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed' });
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
    // Invalid/expired/revoked/replayed — client must re-authenticate.
    res
      .status(401)
      .json({ message: error instanceof Error ? error.message : 'Invalid refresh token' });
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
