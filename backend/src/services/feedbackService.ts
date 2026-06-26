import { getFirebaseFirestore } from "../config/firebase";
import type { FeedbackType } from "@examify-tms/interfaces";
import admin from "firebase-admin";
import crypto from "crypto";

export interface FeedbackRecord {
  id: string;
  tutorId: string;
  type: FeedbackType;
  message: string;
  images: string[];
  pageUrl: string | null;
  userAgent: string | null;
  status: "open" | "resolved";
  createdAt: Date;
  tutorName: string | null;
  tutorEmail: string | null;
}

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

export async function listFeedbackFromFirestore(): Promise<FeedbackRecord[]> {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection("feedback")
    .orderBy("createdAt", "desc")
    .get();

  const docs = snapshot.docs.map((doc) => ({
    id: doc.id,
    data: doc.data(),
  }));

  const tutorIds = [
    ...new Set(
      docs
        .map((d) => d.data.tutorId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  const submitterMap = new Map<string, { name: string | null; email: string | null }>();
  if (tutorIds.length > 0) {
    const userDocs = await firestore.getAll(
      ...tutorIds.map((id) => firestore.collection("users").doc(id)),
    );
    userDocs.forEach((userDoc) => {
      if (userDoc.exists) {
        const ud = userDoc.data()!;
        submitterMap.set(userDoc.id, {
          name: typeof ud.name === "string" ? ud.name : null,
          email: typeof ud.email === "string" ? ud.email : null,
        });
      }
    });
  }

  return docs.map(({ id, data }) => {
    const submitter = submitterMap.get(data.tutorId) ?? {
      name: null,
      email: null,
    };
    const createdAt = (data.createdAt as admin.firestore.Timestamp).toDate();
    return {
      id,
      tutorId: data.tutorId,
      type: data.type as FeedbackType,
      message: data.message,
      images: Array.isArray(data.images) ? (data.images as string[]) : [],
      pageUrl: typeof data.pageUrl === "string" ? data.pageUrl : null,
      userAgent: typeof data.userAgent === "string" ? data.userAgent : null,
      status: data.status === "resolved" ? "resolved" : "open",
      createdAt,
      tutorName: submitter.name,
      tutorEmail: submitter.email,
    };
  });
}

