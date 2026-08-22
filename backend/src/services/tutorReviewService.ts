import { getFirebaseFirestore } from "../config/firebase";
import { setReviewAggregates } from "./tutorProfileService";
import { NotFoundError, ForbiddenError } from "../utils/AppError";
import type {
  CreateTutorReviewRequest,
  PublicTutorReview,
  TutorReview,
  TutorReviewStatus,
} from "@examify-tms/interfaces";
import admin from "firebase-admin";

/** Reviews are public-facing content — cap what we store and serve. */
const MAX_PUBLIC_REVIEWS = 50;
const MAX_TUTOR_REVIEWS = 200;

export interface TutorReviewData {
  id: string;
  tutorId: string;
  authorName: string;
  rating: number;
  comment: string | null;
  status: TutorReviewStatus;
  createdAt: Date;
  moderatedAt: Date | null;
}

function mapDocToReview(
  id: string,
  data: admin.firestore.DocumentData
): TutorReviewData {
  return {
    id,
    tutorId: data.tutorId,
    authorName: data.authorName,
    rating: typeof data.rating === "number" ? data.rating : 5,
    comment: data.comment ?? null,
    status: data.status ?? "pending",
    createdAt: data.createdAt?.toDate() ?? (null as any),
    moderatedAt: data.moderatedAt ? data.moderatedAt.toDate() : null,
  };
}

function toTutorReview(review: TutorReviewData): TutorReview {
  return {
    id: review.id,
    tutorId: review.tutorId,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    createdAt: review.createdAt.toISOString(),
    moderatedAt: review.moderatedAt ? review.moderatedAt.toISOString() : null,
  };
}

function toPublicReview(review: TutorReviewData): PublicTutorReview {
  return {
    id: review.id,
    authorName: review.authorName,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  };
}

/**
 * Submit a review from the public profile page. Reviews start `pending` —
 * they only appear publicly once the tutor approves them, which keeps spam
 * and abuse off published pages without extra auth infrastructure.
 */
export async function createReview(
  slug: string,
  data: CreateTutorReviewRequest
): Promise<TutorReview> {
  const firestore = getFirebaseFirestore();
  const profileSnap = await firestore
    .collection("tutorProfiles")
    .where("slug", "==", slug.trim().toLowerCase())
    .where("status", "==", "published")
    .limit(1)
    .get();

  if (profileSnap.empty) {
    throw new NotFoundError("Profile not found");
  }
  const tutorId = profileSnap.docs[0].id;

  const now = admin.firestore.Timestamp.now();
  const docRef = await firestore.collection("tutorReviews").add({
    tutorId,
    authorName: data.authorName.trim(),
    rating: data.rating,
    comment: data.comment?.trim() || null,
    status: "pending",
    createdAt: now,
    moderatedAt: null,
  });

  return toTutorReview({
    id: docRef.id,
    tutorId,
    authorName: data.authorName.trim(),
    rating: data.rating,
    comment: data.comment?.trim() || null,
    status: "pending",
    createdAt: now.toDate(),
    moderatedAt: null,
  });
}

/** Approved reviews for a published profile, newest first. Public-safe. */
export async function listPublicReviews(
  tutorId: string
): Promise<PublicTutorReview[]> {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection("tutorReviews")
    .where("tutorId", "==", tutorId)
    .where("status", "==", "approved")
    .orderBy("createdAt", "desc")
    .limit(MAX_PUBLIC_REVIEWS)
    .get();

  return snapshot.docs
    .map((doc) => mapDocToReview(doc.id, doc.data()))
    .map(toPublicReview);
}

/** Every review about the authenticated tutor (all statuses), newest first. */
export async function listTutorReviews(
  tutorId: string
): Promise<TutorReview[]> {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection("tutorReviews")
    .where("tutorId", "==", tutorId)
    .orderBy("createdAt", "desc")
    .limit(MAX_TUTOR_REVIEWS)
    .get();

  return snapshot.docs
    .map((doc) => mapDocToReview(doc.id, doc.data()))
    .map(toTutorReview);
}

/**
 * Approve or reject a review owned by the authenticated tutor, then
 * recompute the denormalized rating aggregates on their profile.
 */
export async function setReviewStatus(
  tutorId: string,
  reviewId: string,
  status: "approved" | "rejected"
): Promise<TutorReview> {
  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection("tutorReviews").doc(reviewId);
  const existing = await docRef.get();
  if (!existing.exists) {
    throw new NotFoundError("Review not found");
  }
  const review = mapDocToReview(reviewId, existing.data()!);
  if (review.tutorId !== tutorId) {
    throw new ForbiddenError("You can only moderate reviews about you");
  }

  await docRef.update({
    status,
    moderatedAt: admin.firestore.Timestamp.now(),
  });

  await recomputeAggregates(tutorId);

  return toTutorReview({
    ...review,
    status,
    moderatedAt: new Date(),
  });
}

/**
 * Recount + reaverage the tutor's approved reviews and push the aggregates
 * onto the profile doc so the public page and directory cards stay cheap.
 */
async function recomputeAggregates(tutorId: string): Promise<void> {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection("tutorReviews")
    .where("tutorId", "==", tutorId)
    .where("status", "==", "approved")
    .get();

  const ratings = snapshot.docs
    .map((doc) => doc.data().rating)
    .filter((r): r is number => typeof r === "number");

  const count = ratings.length;
  const avg =
    count > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 10) / 10
      : null;

  await setReviewAggregates(tutorId, avg, count);
}
