import { Request, Response } from "express";
import sharp from "sharp";
import { UserInfo, ApiError, User } from "@examify-tms/interfaces";
import {
  updateUserAvatar,
  updateUserCurrency,
  updateUserReminderLeadTime,
  updateUserWorkingHours,
  updateUserSubjects,
  updateUserName,
  markOnboardingComplete,
  markTourSeen,
  toUserInfo,
  toUserInfoResolved,
  normalizeWorkingHours,
  updateUserCurrentOrg,
  generateJWTForUser,
} from "../services/userService";
import { syncTutorProfileCurrency } from "../services/tutorProfileService";
import { HttpError } from "../utils/httpError";

/** Response for the org-switch branch of PATCH /users/me. */
interface SwitchOrgResponse {
  user: UserInfo;
  token: string;
}

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
 * `name` (display name), `currency` (also kept in sync on the public tutor
 * profile), `reminderLeadTime` (lesson reminder preference — stored only,
 * no scheduling), `onboardingComplete`, and `tourSeen`. Only provided fields
 * are applied. Returns the updated UserInfo.
 */
export async function updateMe(
  req: Request,
  res: Response<UserInfo | SwitchOrgResponse | ApiError>,
): Promise<void> {
  try {
    const uid = req.user!.uid;
    const {
      name,
      currency,
      reminderLeadTime,
      workingHours,
      subjects,
      onboardingComplete,
      tourSeen,
      currentOrgId,
    } = req.body ?? {};
    let updated: User | null = null;

    // Org switch is handled exclusively: if provided, switch active org and
    // re-issue the access JWT (currentOrgId is baked into it). Other profile
    // fields in the same request are ignored.
    if (currentOrgId !== undefined) {
      const user = await updateUserCurrentOrg(uid, currentOrgId);
      res.status(200).json({
        user: await toUserInfoResolved(user),
        token: generateJWTForUser(user),
      });
      return;
    }

    if (typeof name === "string") {
      updated = await updateUserName(uid, name);
    }

    if (typeof currency === "string") {
      updated = await updateUserCurrency(uid, currency);
      // Keep the public tutor profile's currency mirroring the user's. Safe
      // to fire-and-forget: if the tutor has no profile yet, it's a no-op.
      void syncTutorProfileCurrency(uid, updated.currency).catch((err) =>
        console.error("Failed to sync tutor profile currency:", err),
      );
    }

    // `reminderLeadTime` may be null (disable) or a supported value. Only
    // treat the key as provided when explicitly passed (undefined = skip).
    if (reminderLeadTime !== undefined) {
      updated = await updateUserReminderLeadTime(uid, reminderLeadTime);
    }

    // `workingHours` may be a full object or null (clear). Only treat the key
    // as provided when explicitly passed (undefined = skip).
    if (workingHours !== undefined) {
      updated = await updateUserWorkingHours(uid, normalizeWorkingHours(workingHours));
    }

    // `subjects` is the full replacement for the tutor's subject catalogue.
    // Removed subjects are cascaded off tagged students server-side.
    if (subjects !== undefined) {
      updated = await updateUserSubjects(uid, subjects);
    }

    if (typeof onboardingComplete === "boolean" && onboardingComplete) {
      updated = await markOnboardingComplete(uid);
    }

    if (typeof tourSeen === "boolean" && tourSeen) {
      updated = await markTourSeen(uid);
    }

    if (!updated) {
      res.status(400).json({ message: "No supported fields provided" });
      return;
    }

    res.status(200).json(toUserInfo(updated));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    const message =
      error instanceof Error ? error.message : "Failed to update user";
    console.error("updateMe error:", error);
    res.status(500).json({ message });
  }
}
