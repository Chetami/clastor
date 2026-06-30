import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { publishFacebookPost } from "../controllers/facebookController";
import { authenticateJWT, requireTutor } from "../middleware/auth";
import type { ApiError } from "@examify-tms/interfaces";

const router = Router();

// Hold uploaded images in memory only — the controller forwards the bytes
// straight to Facebook, so we never persist them to disk or storage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per image
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/**
 * Wrap multer so rejection errors (wrong type, too large) come back as a clean
 * 400 instead of falling through to the global 500 handler.
 */
function uploadImages(req: Request, res: Response<ApiError>, next: NextFunction) {
  upload.array("images", 10)(req, res, (err) => {
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
 * POST /api/facebook/posts
 * Publish a post to the tutor's connected Facebook Page. Accepts JSON
 * (`message`, optional `imageUrl`) or multipart form-data with `images` parts.
 */
router.post(
  "/posts",
  authenticateJWT,
  requireTutor,
  uploadImages,
  publishFacebookPost,
);

export default router;
