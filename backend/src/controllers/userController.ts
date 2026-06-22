import { Request, Response } from "express";
import sharp from "sharp";
import { UserInfo, ApiError, User } from "@examify-tms/interfaces";
import {
  updateUserAvatar,
  updateUserCurrency,
  markOnboardingComplete,
  toUserInfo,
} from "../services/userService";
import { syncTutorProfileCurrency } from "../services/tutorProfileService";

/** Max upload size enforced by multer (5 MB) before processing. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
/** Square avatar output dimension. */
const AVATAR_SIZE = 256;

/**
 * POST /api/users/me/avatar
 * Accepts a single image upload (multipart field "avatar"), resizes it to a
 * square avatar, encodes it as a base64 data URL, stores it on the user's
 * document, and returns the updated UserInfo.
 */
export async function uploadAvatar(
  req: Request,
  res: Response<UserInfo | ApiError>
): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No image file provided" });
      return;
    }

    if (!req.file.mimetype.startsWith("image/")) {
      res.status(400).json({ message: "Uploaded file must be an image" });
      return;
    }

    if (req.file.size > MAX_UPLOAD_BYTES) {
      res.status(400).json({ message: "Image must be 5 MB or smaller" });
      return;
    }

    // Resize and compress to a predictable, small JPEG so the stored base64
    // stays well under Firestore's 1 MB document limit.
    const processed = await sharp(req.file.buffer)
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .jpeg({ quality: 80 })
      .toBuffer();

    const dataUrl = `data:image/jpeg;base64,${processed.toString("base64")}`;

    const user = await updateUserAvatar(req.user!.uid, dataUrl);

    res.status(200).json(toUserInfo(user));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload avatar";
    console.error("uploadAvatar error:", error);
    res.status(500).json({ message });
  }
}

/**
 * PATCH /api/users/me
 * Updates editable fields on the authenticated user's profile. Supports
 * `currency` (also kept in sync on the public tutor profile) and
 * `onboardingComplete`. Only provided fields are applied. Returns the updated
 * UserInfo.
 */
export async function updateMe(
  req: Request,
  res: Response<UserInfo | ApiError>,
): Promise<void> {
  try {
    const uid = req.user!.uid;
    const { currency, onboardingComplete } = req.body ?? {};
    let updated: User | null = null;

    if (typeof currency === "string") {
      updated = await updateUserCurrency(uid, currency);
      // Keep the public tutor profile's currency mirroring the user's. Safe
      // to fire-and-forget: if the tutor has no profile yet, it's a no-op.
      void syncTutorProfileCurrency(uid, updated.currency).catch((err) =>
        console.error("Failed to sync tutor profile currency:", err),
      );
    }

    if (typeof onboardingComplete === "boolean" && onboardingComplete) {
      updated = await markOnboardingComplete(uid);
    }

    if (!updated) {
      res.status(400).json({ message: "No supported fields provided" });
      return;
    }

    res.status(200).json(toUserInfo(updated));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update user";
    console.error("updateMe error:", error);
    res.status(500).json({ message });
  }
}
