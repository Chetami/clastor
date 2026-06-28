import { getFirebaseFirestore } from "../config/firebase";
import admin from "firebase-admin";
import { InvoiceEvent, InvoiceEventType } from "@examify-tms/interfaces";

/**
 * Invoice event / timeline service.
 *
 * Events live in a subcollection `invoices/{invoiceId}/events` so they are
 * co-located with the invoice and cheap to query chronologically. Recording
 * is best-effort: a failure to write an event must never break the parent
 * invoice operation, so callers use `recordInvoiceEventSafe`.
 */

function mapEvent(
  id: string,
  invoiceId: string,
  data: admin.firestore.DocumentData
): InvoiceEvent {
  return {
    id,
    invoiceId,
    type: data.type as InvoiceEventType,
    summary: data.summary ?? "",
    actorName: data.actorName ?? null,
    timestamp: data.timestamp ? data.timestamp.toDate() : (null as any),
  };
}

/**
 * Append a timeline event to an invoice. Throws on Firestore errors so the
 * caller can decide whether to swallow them.
 */
export async function recordInvoiceEvent(
  invoiceId: string,
  type: InvoiceEventType,
  summary: string,
  actorName?: string | null
): Promise<void> {
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();
  await firestore
    .collection("invoices")
    .doc(invoiceId)
    .collection("events")
    .add({
      type,
      summary,
      actorName: actorName ?? null,
      timestamp: now,
    });
}

/**
 * Best-effort event recording. Use this from invoice action handlers so a
 * Firestore hiccup while writing the timeline never fails the user-facing
 * operation (create/send/mark-paid/etc.).
 */
export async function recordInvoiceEventSafe(
  invoiceId: string,
  type: InvoiceEventType,
  summary: string,
  actorName?: string | null
): Promise<void> {
  try {
    await recordInvoiceEvent(invoiceId, type, summary, actorName);
  } catch (error) {
    console.error(
      `Failed to record invoice event (${type}) for ${invoiceId}:`,
      error
    );
  }
}

/**
 * List an invoice's timeline events, oldest-first.
 */
export async function listInvoiceEventsFromFirestore(
  invoiceId: string
): Promise<InvoiceEvent[]> {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await firestore
      .collection("invoices")
      .doc(invoiceId)
      .collection("events")
      .orderBy("timestamp", "asc")
      .get();

    const events: InvoiceEvent[] = [];
    snapshot.forEach((doc) => {
      events.push(mapEvent(doc.id, invoiceId, doc.data()));
    });

    return events;
  } catch (error) {
    console.error("Failed to list invoice events from Firestore:", error);
    throw new Error("Failed to list invoice events");
  }
}
