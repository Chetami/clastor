import { getUserFromFirestore } from "../services/userService";

/**
 * Best-effort lookup of a user's display name for audit/sent-email records.
 * Never throws — returns null if the user can't be resolved so callers can
 * continue the primary operation.
 */
export async function safeGetActorName(
  uid: string | undefined,
): Promise<string | null> {
  if (!uid) return null;
  try {
    const user = await getUserFromFirestore(uid);
    return user?.name ?? null;
  } catch {
    return null;
  }
}

/**
 * Shape returned by every "preview email" endpoint (lesson notify, lesson
 * reschedule/cancel, invoice send). Lets the client render an accurate
 * preview before the tutor commits to sending.
 */
export interface EmailPreviewResponse {
  to: string[];
  subject: string;
  text: string;
  html: string;
  defaultSubject: string;
  defaultMessage: string;
}

