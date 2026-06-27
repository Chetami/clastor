import { Router } from "express";
import { publishFacebookPost } from "../controllers/facebookController";
import { authenticateJWT, requireTutor } from "../middleware/auth";

const router = Router();

/**
 * POST /api/facebook/posts
 * Publish a post to the tutor's connected Facebook Page.
 */
router.post("/posts", authenticateJWT, requireTutor, publishFacebookPost);

export default router;
