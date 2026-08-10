import { getFirebaseFirestore } from "../config/firebase";
import admin from "firebase-admin";
import { normalizeSignupSurvey } from "./userService";
import type { SignupSurvey } from "@examify-tms/interfaces";

/**
 * Add (or update) a waitlist entry. Keyed by the normalised email so
 * duplicate joins are idempotent — the existing doc is merged with the latest
 * survey answers and `updatedAt` is bumped.
 *
 * @param email - Raw email, trimmed + lowercased before storage.
 * @param signupSurvey - Qualifier survey answers (may be null).
 * @returns `true` when a new doc was created, `false` when an existing one
 *          was updated.
 */
export async function addToWaitlist(
  email: string,
  signupSurvey: SignupSurvey,
): Promise<boolean> {
  const firestore = getFirebaseFirestore();
  const normalisedEmail = email.trim().toLowerCase();

  if (!normalisedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)) {
    throw new Error("A valid email is required");
  }

  const ref = firestore.collection("waitlist").doc(normalisedEmail);
  const snap = await ref.get();
  const existed = snap.exists;

  const normalizedSurvey = normalizeSignupSurvey(signupSurvey);

  await ref.set(
    {
      email: normalisedEmail,
      signupSurvey: normalizedSurvey ?? admin.firestore.FieldValue.delete(),
      createdAt: existed ? snap.data()!.createdAt : admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    },
    { merge: true },
  );

  return !existed;
}
