import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { uploadAvatar } from "../controllers/userController";
import { authenticateJWT } from "../middleware/auth";
import type { ApiError } from "@examify-tms/interfaces";

const router = Router();

// Accept files in memory only — processing happens with sharp in the controller.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/**
 * Wrap multer middleware so rejection errors (bad type, too large) come back as
 * a clean 400 instead of falling through to the global 500 handler.
 */
function uploadAvatarFile(req: Request, res: Response<ApiError>, next: NextFunction) {
  upload.single("avatar")(req, res, (err) => {
    if (err) {
      res.status(400).json({
        message: err instanceof Error ? err.message : "Invalid file upload",
      });
      return;
    }
    next();
  });
}

/**
 * POST /api/users/me/avatar
 * Upload/update the authenticated user's profile picture (multipart "avatar").
 */
router.post("/me/avatar", authenticateJWT, uploadAvatarFile, uploadAvatar);

export default router;
