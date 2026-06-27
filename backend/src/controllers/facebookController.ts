import { Request, Response } from "express";
import { ApiError, PublishFacebookPostResponse } from "@examify-tms/interfaces";
import { getFacebookConnection } from "../services/userService";
import { publishPost } from "../services/facebookService";

/**
 * POST /api/facebook/posts
 * Publish a post (text + optional image URL(s)) to the tutor's connected
 * Facebook Page. Requires the tutor to have connected a Page first.
 */
export async function publishFacebookPost(
  req: Request,
  res: Response<PublishFacebookPostResponse | ApiError>,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const imageUrl: string | string[] | undefined = req.body?.imageUrl;
  const hasImages =
    (typeof imageUrl === "string" && imageUrl.length > 0) ||
    (Array.isArray(imageUrl) && imageUrl.some((u) => typeof u === "string" && u.length > 0));

  if (!message && !hasImages) {
    res.status(400).json({ message: "A post needs a message or an image." });
    return;
  }

  const connection = await getFacebookConnection(req.user.uid);
  if (!connection) {
    res.status(409).json({
      message: "Facebook is not connected. Connect a Page first.",
    });
    return;
  }

  try {
    const result = await publishPost(
      connection.pageId,
      connection.pageAccessToken,
      message,
      imageUrl,
    );
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to publish post";
    res.status(502).json({ message });
  }
}
