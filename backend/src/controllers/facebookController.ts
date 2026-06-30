import { Request, Response } from "express";
import { ApiError, PublishFacebookPostResponse } from "@examify-tms/interfaces";
import { getFacebookConnection } from "../services/userService";
import { publishPost, type PhotoSource } from "../services/facebookService";

/**
 * Pull every attachment out of the request body, which may arrive as:
 *  - JSON: `{ imageUrl: string | string[] }` (no uploaded files), or
 *  - multipart form-data: repeated `imageUrl` text fields + `images` file parts.
 *
 * Returns a mixed list of URL and file sources the service can stage/publish.
 */
function collectSources(req: Request): PhotoSource[] {
  const sources: PhotoSource[] = [];

  const imageUrl = req.body?.imageUrl;
  const urlList = Array.isArray(imageUrl)
    ? imageUrl
    : typeof imageUrl === "string"
      ? [imageUrl]
      : [];
  for (const url of urlList) {
    if (typeof url === "string" && url.trim().length > 0) {
      sources.push({ kind: "url", url: url.trim() });
    }
  }

  const files = Array.isArray(req.files) ? req.files : [];
  for (const file of files) {
    if (!file.mimetype.startsWith("image/")) {
      throw new Error("Only image files can be attached to a post.");
    }
    sources.push({
      kind: "file",
      buffer: file.buffer,
      filename: file.originalname || "photo",
      mimetype: file.mimetype,
    });
  }

  return sources;
}

/**
 * POST /api/facebook/posts
 * Publish a post (text + optional images) to the tutor's connected Facebook
 * Page. Images can be supplied as public URLs (`imageUrl` field, one or more)
 * or as uploaded files (multipart `images` parts) — the bytes are forwarded
 * straight to Facebook, so nothing is stored on our side. Requires the tutor
 * to have connected a Page first.
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

  let sources: PhotoSource[];
  try {
    sources = collectSources(req);
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Invalid attachments.",
    });
    return;
  }

  if (!message && sources.length === 0) {
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
      sources,
    );
    res.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to publish post";
    res.status(502).json({ message });
  }
}
