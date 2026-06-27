import { getFirebaseFirestore } from "../config/firebase";

export interface TutorNameInfo {
  name: string | null;
  email: string | null;
}

/**
 * Resolve a set of tutor UIDs to { name, email } via a batched Firestore read.
 * Used by admin list views (Students/Lessons/Payments) to render a "Tutor"
 * column. Tutors are looked up by their UID in the `users` collection.
 */
export async function resolveTutorNames(
  tutorIds: string[],
): Promise<Map<string, TutorNameInfo>> {
  const map = new Map<string, TutorNameInfo>();
  const ids = [...new Set(tutorIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return map;

  const firestore = getFirebaseFirestore();
  const docs = await firestore.getAll(
    ...ids.map((id) => firestore.collection("users").doc(id)),
  );
  docs.forEach((d) => {
    if (d.exists) {
      const data = d.data()!;
      map.set(d.id, {
        name: typeof data.name === "string" ? data.name : null,
        email: typeof data.email === "string" ? data.email : null,
      });
    }
  });
  return map;
}
