/**
 * Request-body Zod schemas for auth + feedback + meeting endpoints.
 * Mirrors the corresponding interfaces request YAML files.
 */
import { z } from "zod";
import { feedbackTypeSchema, schemaUtils } from "./common";

export const signupSurveySchema = z
  .object({
    intent: z
      .enum(["independent_tutor", "small_business", "exploring"])
      .nullish(),
    studentCountBucket: z
      .enum([
        "1-5",
        "6-15",
        "16-30",
        "30+",
        "1-15",
        "16-50",
        "51-100",
        "101-250",
        "250-500",
        "500+",
      ])
      .nullish(),
    tutoringFormat: z
      .enum(["one_on_one", "group", "both"])
      .nullish(),
    tutorCountBucket: z
      .enum(["1-5", "6-10", "11-20", "21-50", "50+"])
      .nullish(),
    currentTools: z.array(z.string()).max(20).default([]),
  })
  .strict()
  .nullish();

export const joinWaitlistSchema = z.object({
  email: z.string().trim().email("A valid email is required").max(254),
  signupSurvey: signupSurveySchema,
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  timezone: z.string().optional(),
  signupSurvey: signupSurveySchema,
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("A valid email is required").max(254),
});

export const googleAuthSchema = z.object({
  timezone: z.string().optional(),
});

/**
 * Query validation for GET /api/auth/google/start (public merged-login
 * redirect). The survey arrives as a URL-encoded JSON string and is parsed +
 * normalized leniently in the controller — a malformed value should degrade
 * to "no survey", not block sign-in.
 */
export const googleLoginStartQuerySchema = z.object({
  returnTo: z.string().max(2048).optional(),
  timezone: z.string().max(64).optional(),
  survey: z.string().max(4096).optional(),
});

/** Body validation for POST /api/auth/google/exchange (one-time code swap). */
export const googleLoginExchangeSchema = z.object({
  code: z.string().min(1, "code is required").max(512),
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

/** Body validation for POST /api/contact (public website contact form). */
export const createContactMessageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  email: z.string().trim().email("A valid email is required").max(254),
  topic: z.enum([
    "General question",
    "Sales & plans",
    "Support / billing",
    "Partnerships & teams",
    "Press",
  ]),
  // Discord embed descriptions cap at 4096 chars — keep headroom for wrapping.
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(4000, "Message must be 4000 characters or less"),
});
