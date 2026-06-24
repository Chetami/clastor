import { Request, Response } from "express";
import sharp from "sharp";
import {
  FeedbackType,
  FeedbackResponse,
  ApiError,
} from "@examify-tms/interfaces";
import { createFeedbackInFirestore } from "../services/feedbackService";

const MAX_IMAGES = 2;
const IMAGE_MAX_WIDTH = 1200;
const JPEG_QUALITY = 70;

async function processImage(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(IMAGE_MAX_WIDTH, null, {
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

export async function createFeedback(
  req: Request,
  res: Response<FeedbackResponse | ApiError>,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const type = req.body.type as FeedbackType;
    const message = req.body.message as string;

    if (!type || !["bug", "feedback", "feature_request"].includes(type)) {
      res.status(400).json({ message: "Invalid feedback type" });
      return;
    }

    if (!message || !message.trim()) {
      res.status(400).json({ message: "Message is required" });
      return;
    }

    const files = req.files as Express.Multer.File[] | undefined;
    if (files && files.length > MAX_IMAGES) {
      res
        .status(400)
        .json({ message: `Maximum ${MAX_IMAGES} images allowed` });
      return;
    }

    const images: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const dataUrl = await processImage(file.buffer);
        images.push(dataUrl);
      }
    }

    const pageUrl = (req.body.pageUrl as string) || null;
    const userAgent = req.headers["user-agent"] || null;

    const feedback = await createFeedbackInFirestore(
      {
        type,
        message: message.trim(),
        images,
        pageUrl,
        userAgent,
      },
      req.user.uid,
    );

    res.status(201).json({
      id: feedback.id,
      type: feedback.type,
      message: feedback.message,
      images: feedback.images,
      pageUrl: feedback.pageUrl,
      userAgent: feedback.userAgent,
      status: feedback.status,
      createdAt: feedback.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Create feedback failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to submit feedback";
    res.status(500).json({ message });
  }
}
