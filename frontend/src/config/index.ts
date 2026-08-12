import { z } from "zod";

const envSchema = z.object({
  VITE_API_URL: z
    .string()
    .optional()
    .default("http://localhost:3001"),
  VITE_FIREBASE_API_KEY: z.string().optional().default(""),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().optional().default(""),
  VITE_FIREBASE_PROJECT_ID: z.string().optional().default(""),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().optional().default(""),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().optional().default(""),
  VITE_FIREBASE_APP_ID: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables. Check your .env file.");
}

export const env = parsed.data;

export const API_URL = env.VITE_API_URL;

export const TOKEN_KEY = "jwtToken";
export const REFRESH_TOKEN_KEY = "refreshToken";

export const LEGAL_URLS = {
  terms: "https://clastor.xamify.com.au/terms",
  privacy: "https://clastor.xamify.com.au/privacy",
} as const;
