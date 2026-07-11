import { getFirebaseFirestore } from "../config/firebase";
import admin from "firebase-admin";
import {
  SentEmail,
  SentEmailResponse,
  SentEmailType,
  SentEmailStatus,
} from "@examify-tms/interfaces";

/**
 * Sent-email log service.
 *
 * Every outbound email attempt is written to a top-level `sent_emails`
 * collection so the history can be queried uniformly across lessons,
 * invoices, and students. Recording is best-effort: a failure to write a log
 * entry must never break the parent operation that triggered the send, so
 * callers use {@link recordSentEmailSafe}.
 *
 * Storage cost note: each document stores the full rendered HTML body so the
 * history view can reproduce what the recipient saw. At ~5–20KB per doc this
 * stays well under Firestore's 1MB document limit.
 */

/** What gets recorded for each outbound email attempt. */
export interface SentEmailRecord {
  type: SentEmailType;
  to: string | string[];
  subject: string;
  status: SentEmailStatus;
  /** Rendered HTML body, exactly as handed to SMTP. */
  bodyHtml: string;
  /** Underlying error message when status === "failed". */
  errorMessage?: string | null;
  tutorId: string;
  lessonId?: string | null;
  invoiceId?: string | null;
  studentId?: string | null;
  sentBy: string;
  sentByName?: string | null;
}

function mapSentEmail(
  id: string,
  data: admin.firestore.DocumentData
): SentEmail {
  return {
    id,
    type: data.type as SentEmailType,
    to: data.to ?? [],
    subject: data.subject ?? "",
    status: data.status as SentEmailStatus,
    errorMessage: data.errorMessage ?? null,
    bodyHtml: data.bodyHtml ?? "",
    tutorId: data.tutorId,
    lessonId: data.lessonId ?? null,
    invoiceId: data.invoiceId ?? null,
    studentId: data.studentId ?? null,
    sentBy: data.sentBy,
    sentByName: data.sentByName ?? null,
    sentAt: data.sentAt ? data.sentAt.toDate() : (null as any),
  };
}

/** Convert internal Date-typed record to ISO-string response shape. */
export function toSentEmailResponse(email: SentEmail): SentEmailResponse {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v;
  return {
    id: email.id,
    type: email.type,
    to: email.to,
    subject: email.subject,
    status: email.status,
    errorMessage: email.errorMessage ?? null,
    bodyHtml: email.bodyHtml,
    tutorId: email.tutorId,
    lessonId: email.lessonId ?? null,
    invoiceId: email.invoiceId ?? null,
    studentId: email.studentId ?? null,
    sentBy: email.sentBy,
    sentByName: email.sentByName ?? null,
    sentAt: toIso(email.sentAt),
  };
}

/**
 * Persist a sent-email record. Throws on Firestore errors so the caller can
 * decide whether to swallow them (use {@link recordSentEmailSafe} for the
 * fire-and-forget case).
 */
export async function recordSentEmail(
  record: SentEmailRecord
): Promise<SentEmail> {
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();
  const payload: admin.firestore.DocumentData = {
    type: record.type,
    to: Array.isArray(record.to) ? record.to : [record.to],
    subject: record.subject,
    status: record.status,
    errorMessage: record.errorMessage ?? null,
    bodyHtml: record.bodyHtml,
    tutorId: record.tutorId,
    lessonId: record.lessonId ?? null,
    invoiceId: record.invoiceId ?? null,
    studentId: record.studentId ?? null,
    sentBy: record.sentBy,
    sentByName: record.sentByName ?? null,
    sentAt: now,
  };

  const ref = await firestore.collection("sent_emails").add(payload);
  return mapSentEmail(ref.id, payload);
}

/**
 * Best-effort recording. Use this from email action handlers so a Firestore
 * hiccup while writing the log never fails the user-facing send operation.
 */
export async function recordSentEmailSafe(
  record: SentEmailRecord
): Promise<void> {
  try {
    await recordSentEmail(record);
  } catch (error) {
    console.error(
      `Failed to record sent email (${record.type} → ${JSON.stringify(
        record.to
      )}):`,
      error
    );
  }
}

export interface SentEmailFilter {
  lessonId?: string;
  invoiceId?: string;
  studentId?: string;
  tutorId?: string;
  /** Cap on the number of records returned. Defaults to 100. */
  limit?: number;
}

/**
 * List sent-email records matching one of the entity filters, newest-first.
 * Exactly one filter is expected from the caller; passing none returns the
 * most recent records globally (intended for admin use only).
 */
export async function listSentEmailsFromFirestore(
  filter: SentEmailFilter = {}
): Promise<SentEmail[]> {
  try {
    const firestore = getFirebaseFirestore();
    let q: admin.firestore.Query = firestore.collection("sent_emails");

    // Firestore requires the orderBy field to match the equality filter when
    // both are used together only for range ops; equality + orderBy on a
    // different field is fine. We always sort newest-first by sentAt.
    if (filter.lessonId) {
      q = q.where("lessonId", "==", filter.lessonId);
    } else if (filter.invoiceId) {
      q = q.where("invoiceId", "==", filter.invoiceId);
    } else if (filter.studentId) {
      q = q.where("studentId", "==", filter.studentId);
    } else if (filter.tutorId) {
      q = q.where("tutorId", "==", filter.tutorId);
    }

    q = q.orderBy("sentAt", "desc").limit(Math.min(filter.limit ?? 100, 500));

    const snapshot = await q.get();
    const emails: SentEmail[] = [];
    snapshot.forEach((doc) => {
      emails.push(mapSentEmail(doc.id, doc.data()));
    });
    return emails;
  } catch (error) {
    console.error("Failed to list sent emails from Firestore:", error);
    throw new Error("Failed to list sent emails");
  }
}

/**
 * Fetch a single sent-email record by id. Returns null when missing.
 */
export async function getSentEmailByIdFromFirestore(
  id: string
): Promise<SentEmail | null> {
  try {
    const firestore = getFirebaseFirestore();
    const doc = await firestore.collection("sent_emails").doc(id).get();
    if (!doc.exists) return null;
    return mapSentEmail(doc.id, doc.data()!);
  } catch (error) {
    console.error("Failed to get sent email from Firestore:", error);
    throw new Error("Failed to get sent email");
  }
}
