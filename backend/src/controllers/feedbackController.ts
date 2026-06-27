import { Request, Response } from "express";
import sharp from "sharp";
import {
  FeedbackType,
  FeedbackResponse,
  FeedbackListResponse,
  ApiError,
} from "@examify-tms/interfaces";
import {
  createFeedbackInFirestore,
  listFeedbackFromFirestore,
  updateFeedbackStatusInFirestore,
  type FeedbackStatus,
} from "../services/feedbackService";

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
      tutorId: req.user.uid,
      tutorName: null,
      tutorEmail: null,
    });
  } catch (error) {
    console.error("Create feedback failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to submit feedback";
    res.status(500).json({ message });
  }
}

export async function listFeedback(
  _req: Request,
  res: Response<FeedbackListResponse | ApiError>,
): Promise<void> {
  try {
    const items = await listFeedbackFromFirestore();

    const data: FeedbackResponse[] = items.map((f) => ({
      id: f.id,
      type: f.type,
      message: f.message,
      images: f.images,
      pageUrl: f.pageUrl,
      userAgent: f.userAgent,
      status: f.status,
      createdAt: f.createdAt.toISOString(),
      tutorId: f.tutorId,
      tutorName: f.tutorName,
      tutorEmail: f.tutorEmail,
    }));

    res.status(200).json({ data, total: data.length });
  } catch (error) {
    console.error("List feedback failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load feedback";
    res.status(500).json({ message });
  }
}

export async function updateFeedbackStatus(
  req: Request,
  res: Response<FeedbackResponse | ApiError>,
): Promise<void> {
  try {
    const { id } = req.params;
    const status = req.body.status as FeedbackStatus;

    if (!id) {
      res.status(400).json({ message: "Feedback id is required" });
      return;
    }

    if (status !== "open" && status !== "resolved") {
      res.status(400).json({ message: "Invalid status" });
      return;
    }

    const updated = await updateFeedbackStatusInFirestore(id, status);
    if (!updated) {
      res.status(404).json({ message: "Feedback not found" });
      return;
    }

    res.status(200).json({
      id: updated.id,
      type: updated.type,
      message: updated.message,
      images: updated.images,
      pageUrl: updated.pageUrl,
      userAgent: updated.userAgent,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      tutorId: updated.tutorId,
      tutorName: updated.tutorName,
      tutorEmail: updated.tutorEmail,
    });
  } catch (error) {
    console.error("Update feedback status failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update feedback";
    res.status(500).json({ message });
  }
}
