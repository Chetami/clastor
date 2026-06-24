import { getFirebaseFirestore } from "../config/firebase";
import type { FeedbackType } from "@examify-tms/interfaces";
import admin from "firebase-admin";
import crypto from "crypto";

function generateFeedbackId(): string {
  const randomBytes = crypto.randomBytes(12).toString("hex");
  return `feedback_${randomBytes}`;
}

export interface CreateFeedbackData {
  type: FeedbackType;
  message: string;
  images: string[];
  pageUrl: string | null;
  userAgent: string | null;
}

export async function createFeedbackInFirestore(
  data: CreateFeedbackData,
  tutorId: string,
) {
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();
  const feedbackId = generateFeedbackId();

  const doc = {
    tutorId,
    type: data.type,
    message: data.message,
    images: data.images,
    pageUrl: data.pageUrl,
    userAgent: data.userAgent,
    status: "open" as const,
    createdAt: now,
  };

  await firestore.collection("feedback").doc(feedbackId).set(doc);

  return {
    id: feedbackId,
    ...doc,
    createdAt: now.toDate(),
  };
}
