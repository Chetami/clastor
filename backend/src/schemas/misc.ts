/**
 * Request-body Zod schemas for auth + feedback + meeting endpoints.
 * Mirrors the corresponding interfaces request YAML files.
 */
import { z } from "zod";
import { feedbackTypeSchema, schemaUtils } from "./common";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  timezone: z.string().optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const googleAuthSchema = z.object({
  timezone: z.string().optional(),
});

export const createFeedbackSchema = z.object({
  type: feedbackTypeSchema,
  message: z.string().trim().min(1, "Message is required"),
  pageUrl: z.string().nullish(),
});

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(["open", "resolved"]),
});

export const generateMeetLinkSchema = z.object({
  lessonId: z.string().optional(),
  startDateTime: schemaUtils.isoDateTime.optional(),
  durationMinutes: z.number().int().min(1).optional(),
});
