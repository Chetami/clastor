import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { createFeedback, listFeedback, updateFeedbackStatus } from "../controllers/feedbackController";
import { authenticateJWT, requireSystemAdmin } from "../middleware/auth";
import type { ApiError } from "@examify-tms/interfaces";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

function uploadFeedbackImages(
  req: Request,
  res: Response<ApiError>,
  next: NextFunction,
) {
  upload.array("images", 2)(req, res, (err) => {
    if (err) {
      res.status(400).json({
        message: err instanceof Error ? err.message : "Invalid file upload",
      });
      return;
    }
    next();
  });
}

router.post(
  "/",
  authenticateJWT,
  uploadFeedbackImages,
  createFeedback,
);

router.get("/", authenticateJWT, requireSystemAdmin, listFeedback);

router.patch(
  "/:id/status",
  authenticateJWT,
  requireSystemAdmin,
  updateFeedbackStatus,
);

export default router;
