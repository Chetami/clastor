import { Request, Response } from "express";
import sharp from "sharp";
import { UserInfo, ApiError } from "@examify-tms/interfaces";
import { updateUserAvatar } from "../services/userService";

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

    const userInfo: UserInfo = {
      uid: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };

    res.status(200).json(userInfo);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upload avatar";
    console.error("uploadAvatar error:", error);
    res.status(500).json({ message });
  }
}
