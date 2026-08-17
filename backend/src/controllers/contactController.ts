import { Request, Response } from "express";
import type { ApiError, CreateContactMessageResponse } from "@examify-tms/interfaces";
import { AppError } from "../utils/AppError";
import { sendContactMessageToDiscord } from "../services/contactService";

/**
 * POST /api/contact
 * Public website contact form. Validates via the route-level Zod schema and
 * forwards the submission to the team Discord channel.
 */
export async function createContactMessage(
  req: Request,
  res: Response<CreateContactMessageResponse | ApiError>,
): Promise<void> {
  try {
    await sendContactMessageToDiscord({
      name: req.body.name,
      email: req.body.email,
      topic: req.body.topic,
      message: req.body.message,
    });

    res.status(201).json({ delivered: true });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    console.error("Create contact message failed:", error);
    res.status(500).json({ message: "Failed to send message" });
  }
}
