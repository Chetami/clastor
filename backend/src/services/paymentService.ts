import { getFirebaseFirestore } from "../config/firebase";
import {
  CreateInvoiceRequest,
  UpdateInvoiceRequest,
  Invoice,
  InvoiceStatus,
  MarkPaidRequest,
} from "@examify-tms/interfaces";
import { getStudentByIdFromFirestore } from "./studentService";
import { getUserFromFirestore } from "./userService";
import { updateLessonInFirestore, setLessonInvoiceIdInFirestore } from "./lessonService";
import { recordInvoiceEventSafe } from "./invoiceEventService";
import { AppError, BadRequestError, ConflictError, NotFoundError } from "../utils/AppError";
import admin from "firebase-admin";
import crypto from "crypto";

/**
 * Generate a unique invoice ID with prefix
 */
function generateInvoiceId(): string {
  const randomBytes = crypto.randomBytes(12).toString("hex");
  return `inv_${randomBytes}`;
}

/**
 * Map a Firestore invoice document to an Invoice object, deriving the
 * `overdue` status at read time (open + past due => overdue).
 */
function mapInvoice(
  id: string,
  data: admin.firestore.DocumentData
): Invoice {
  const now = Date.now();
  let status: InvoiceStatus = (data.status as InvoiceStatus) ?? "draft";
  if (status === "open" && data.dueDate) {
    const due = data.dueDate.toDate().getTime();
    if (due < now) status = "overdue";
  }

  return {
    id,
    invoiceNumber: data.invoiceNumber,
    tutorId: data.tutorId,
    studentId: data.studentId,
    customerName: data.customerName,
    billingEmail: data.billingEmail,
    status,
    currency: data.currency ?? "AUD",
    lineItems: data.lineItems ?? [],
    subtotal: data.subtotal ?? 0,
    total: data.total ?? 0,
    paymentMethod: data.paymentMethod,
    issueDate: data.issueDate ? data.issueDate.toDate() : (null as any),
    dueDate: data.dueDate ? data.dueDate.toDate() : (null as any),
    paidAt: data.paidAt ? data.paidAt.toDate() : null,
    sentAt: data.sentAt ? data.sentAt.toDate() : null,
    notes: data.notes ?? null,
    stripePaymentIntentId: data.stripePaymentIntentId ?? null,
    createdAt: data.createdAt ? data.createdAt.toDate() : (null as any),
    updatedAt: data.updatedAt ? data.updatedAt.toDate() : (null as any),
  };
}

/**
 * Allocate the next sequential invoice number for a tutor.
 * Uses a per-tutor counter document to keep numbering gap-free per tutor
 * (e.g. INV-0001, INV-0002...). Pad to 4 digits, growing as needed.
 */
async function allocateInvoiceNumber(
  firestore: admin.firestore.Firestore,
  tutorId: string
): Promise<string> {
  const counterRef = firestore.collection("invoiceCounters").doc(tutorId);
  const next = admin.firestore.FieldValue.increment(1);

  await counterRef.set({ count: next, tutorId }, { merge: true });

  const snapshot = await counterRef.get();
  const count = (snapshot.data()?.count as number) ?? 1;
  return `INV-${String(count).padStart(4, "0")}`;
}

/**
 * Compute line item amounts and roll up subtotal/total from raw line items
 * (which carry unitAmount + quantity but not amount).
 */
function computeTotals(
  lineItems: Array<{
    lessonId: string;
    description: string;
    durationMinutes: number;
    rateType: "hourly" | "per_lesson";
    unitAmount: number;
    quantity: number;
  }>
): { lineItems: Invoice["lineItems"]; subtotal: number; total: number } {
  const enriched = lineItems.map((li) => {
    const amount = Math.round(li.unitAmount * li.quantity * 100) / 100;
    return { ...li, amount };
  });
  const subtotal =
    Math.round(enriched.reduce((sum, li) => sum + li.amount, 0) * 100) / 100;
  return { lineItems: enriched, subtotal, total: subtotal };
}

/**
 * List invoices scoped to the authenticated user, with optional filters.
 * Full-fetch (no pagination) — used by dashboards, mobile, and search.
 */
export async function listInvoicesFromFirestore(
  userId: string,
  role: string
): Promise<Invoice[]> {
  try {
    const firestore = getFirebaseFirestore();
    let snapshot: admin.firestore.QuerySnapshot;

    if (role === "tutor") {
      snapshot = await firestore
        .collection("invoices")
        .where("tutorId", "==", userId)
        .get();
    } else if (role === "system_admin") {
      snapshot = await firestore.collection("invoices").get();
    } else {
      throw new Error("Invalid role");
    }

    const invoices: Invoice[] = [];
    snapshot.forEach((doc) => {
      invoices.push(mapInvoice(doc.id, doc.data()));
    });

    return invoices;
  } catch (error) {
    console.error("Failed to list invoices from Firestore:", error);
    throw new Error("Failed to list invoices");
  }
}

const DEFAULT_INVOICE_PAGE_SIZE = 10;

export interface InvoicePageQuery {
  status?: InvoiceStatus | "all";
  limit?: number;
  cursor?: string;
}

export interface InvoicePageResult {
  data: Invoice[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

interface InvoiceCursor {
  v: string;
  id: string;
}

const CURSOR_ENCODING = "base64url";

function encodeInvoiceCursor(
  invoice: Invoice,
  field: "createdAt" | "dueDate"
): string {
  const payload: InvoiceCursor = {
    v: new Date(invoice[field] as any).toISOString(),
    id: invoice.id,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString(CURSOR_ENCODING);
}

function decodeInvoiceCursor(cursor: string): InvoiceCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      Buffer.from(cursor, CURSOR_ENCODING).toString("utf8")
    );
  } catch {
    throw new BadRequestError("Invalid cursor");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as InvoiceCursor).v !== "string" ||
    typeof (parsed as InvoiceCursor).id !== "string"
  ) {
    throw new BadRequestError("Invalid cursor");
  }
  const decoded = parsed as InvoiceCursor;
  if (Number.isNaN(new Date(decoded.v).getTime())) {
    throw new BadRequestError("Invalid cursor");
  }
  return decoded;
}

/**
 * Cursor-paginated invoice listing for the payments page.
 *
 * Pushes status filtering + limit + orderBy to Firestore so only ~limit
 * documents are read per page (vs the full collection in
 * `listInvoicesFromFirestore`).
 *
 * Status mapping at the Firestore level:
 *   - "open"    → where("status","==","open") — naturally includes overdue
 *                 (overdue is derived from open + past dueDate at read time)
 *   - "overdue" → where("status","==","open").where("dueDate","<",now),
 *                 ordered by dueDate ascending (most overdue first)
 *   - draft/paid/void → exact status match
 *   - "all"     → no status filter
 *
 * Ordering:
 *   - overdue → dueDate asc + documentId asc
 *   - everything else → createdAt desc + documentId desc
 *
 * Requires composite indexes — see `firestore.indexes.json`.
 */
export async function listInvoicesPageFromFirestore(
  userId: string,
  role: string,
  query: InvoicePageQuery
): Promise<InvoicePageResult> {
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();
  const status = query.status ?? "all";
  const limit = Math.max(
    1,
    Math.min(100, Math.floor(query.limit ?? DEFAULT_INVOICE_PAGE_SIZE))
  );

  let q: admin.firestore.Query = firestore.collection("invoices");
  if (role === "tutor") {
    q = q.where("tutorId", "==", userId);
  } else if (role !== "system_admin") {
    throw new Error("Invalid role");
  }

  const isOverdue = status === "overdue";
  const sortField: "createdAt" | "dueDate" = isOverdue ? "dueDate" : "createdAt";
  const dir: "asc" | "desc" = isOverdue ? "asc" : "desc";

  if (
    status === "draft" ||
    status === "open" ||
    status === "paid" ||
    status === "void"
  ) {
    q = q.where("status", "==", status);
  } else if (isOverdue) {
    q = q
      .where("status", "==", "open")
      .where("dueDate", "<", now);
  }

  // Capture the base filtered query (tutorId + status) for the count
  // aggregation — Firestore Query objects are immutable, so this snapshot
  // won't be affected by the orderBy/startAfter/limit we add below.
  const countQuery = q;

  q = q
    .orderBy(sortField, dir)
    .orderBy(admin.firestore.FieldPath.documentId(), dir);

  if (query.cursor) {
    const cursor = decodeInvoiceCursor(query.cursor);
    q = q.startAfter(
      admin.firestore.Timestamp.fromDate(new Date(cursor.v)),
      cursor.id
    );
  }

  // Run the page fetch + total count in parallel. The count() aggregation
  // costs 1 read per 1000 matched docs (much cheaper than fetching them all).
  const [snapshot, countSnapshot] = await Promise.all([
    q.limit(limit + 1).get(),
    countQuery.count().get(),
  ]);
  const docs = snapshot.docs;
  const total = countSnapshot.data().count;

  const hasMore = docs.length > limit;
  const pageDocs = hasMore ? docs.slice(0, limit) : docs;
  const invoices = pageDocs.map((doc) => mapInvoice(doc.id, doc.data()));

  let nextCursor: string | null = null;
  if (hasMore && pageDocs.length > 0) {
    const last = pageDocs[pageDocs.length - 1];
    nextCursor = encodeInvoiceCursor(
      mapInvoice(last.id, last.data()),
      sortField
    );
  }

  return { data: invoices, nextCursor, hasMore, total };
}

/**
 * Get a specific invoice by ID.
 */
export async function getInvoiceByIdFromFirestore(
  invoiceId: string
): Promise<Invoice | null> {
  try {
    const firestore = getFirebaseFirestore();
    const doc = await firestore.collection("invoices").doc(invoiceId).get();

    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    return mapInvoice(doc.id, data);
  } catch (error) {
    console.error("Failed to get invoice from Firestore:", error);
    throw new Error("Failed to get invoice");
  }
}

/**
 * Create an invoice document in Firestore. Snapshots the student's name +
 * resolved billing email, allocates an invoice number, and computes totals.
 */
export async function createInvoiceInFirestore(
  data: CreateInvoiceRequest,
  tutorId: string
): Promise<Invoice> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    // Snapshot student details
    const student = await getStudentByIdFromFirestore(data.studentId);
    if (!student) {
      throw new BadRequestError("Student not found");
    }
    if (student.tutorId !== tutorId) {
      throw new BadRequestError("Student does not belong to this tutor");
    }

    const customerName = student.name;
    const billingEmail =
      data.billingEmail && data.billingEmail.trim().length > 0
        ? data.billingEmail
        : student.billingEmail;

    // Compute line amounts + totals
    const { lineItems, subtotal, total } = computeTotals(data.lineItems);

    // Stamp the invoice with the tutor's currency (single source of truth on
    // the user document). Falls back to AUD if the user record is missing.
    let currency = "AUD";
    try {
      const tutor = await getUserFromFirestore(tutorId);
      currency = tutor.currency;
    } catch {
      // Fall back to default.
    }

    const invoiceNumber = await allocateInvoiceNumber(firestore, tutorId);
    const invoiceId = generateInvoiceId();

    const issueDate = data.issueDate
      ? admin.firestore.Timestamp.fromDate(new Date(data.issueDate))
      : now;
    const dueDate = admin.firestore.Timestamp.fromDate(new Date(data.dueDate));

    const status: InvoiceStatus = data.status ?? "draft";

    const invoiceData = {
      invoiceNumber,
      tutorId,
      studentId: data.studentId,
      customerName,
      billingEmail,
      status,
      currency,
      lineItems,
      subtotal,
      total,
      paymentMethod: data.paymentMethod,
      issueDate,
      dueDate,
      paidAt: null,
      sentAt: null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await firestore.collection("invoices").doc(invoiceId).set(invoiceData);

    // Stamp each referenced lesson with the invoice ID so it can't be
    // double-invoiced while this invoice is active.
    await Promise.all(
      data.lineItems.map((li) =>
        setLessonInvoiceIdInFirestore(li.lessonId, invoiceId)
      )
    );

    return {
      id: invoiceId,
      invoiceNumber,
      tutorId,
      studentId: data.studentId,
      customerName,
      billingEmail,
      status,
      currency,
      lineItems,
      subtotal,
      total,
      paymentMethod: data.paymentMethod,
      issueDate: issueDate.toDate() as any,
      dueDate: dueDate.toDate() as any,
      paidAt: null,
      sentAt: null,
      notes: data.notes ?? null,
      createdAt: now.toDate() as any,
      updatedAt: now.toDate() as any,
    };
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    console.error("Failed to create invoice in Firestore:", error);
    throw new Error("Failed to create invoice");
  }
}

/**
 * Update an invoice. Line items can only be edited while draft.
 * Recomputes subtotal/total when lineItems are provided.
 */
export async function updateInvoiceInFirestore(
  invoiceId: string,
  data: UpdateInvoiceRequest
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    const existing = await firestore.collection("invoices").doc(invoiceId).get();
    if (!existing.exists) throw new NotFoundError("Invoice not found");
    const existingData = existing.data()!;

    const updateData: Record<string, unknown> = { updatedAt: now };

    if (data.dueDate !== undefined && data.dueDate !== null) {
      updateData.dueDate = admin.firestore.Timestamp.fromDate(
        new Date(data.dueDate)
      );
    }
    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.lineItems !== undefined && data.lineItems !== null) {
      if (existingData.status !== "draft") {
        throw new BadRequestError("Line items can only be edited on draft invoices");
      }
      const { lineItems, subtotal, total } = computeTotals(data.lineItems);
      updateData.lineItems = lineItems;
      updateData.subtotal = subtotal;
      updateData.total = total;
    }

    await firestore.collection("invoices").doc(invoiceId).update(updateData);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Failed to update invoice in Firestore:", error);
    throw new Error("Failed to update invoice");
  }
}

/**
 * Mark every lesson linked to an invoice as paid. Shared by the manual
 * mark-paid path and the Stripe webhook path.
 */
async function markLinkedLessonsPaid(
  lineItems: Array<{ lessonId?: string }> | undefined
): Promise<void> {
  if (!lineItems) return;
  await Promise.all(
    lineItems.map(
      (li) => li.lessonId && updateLessonInFirestore(li.lessonId, { isPaid: true })
    )
  );
}

/**
 * Mark an invoice as paid. Side effects:
 *  - flips isPaid=true on every linked lesson
 */
export async function markInvoicePaidInFirestore(
  invoiceId: string,
  data: MarkPaidRequest
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    const ref = firestore.collection("invoices").doc(invoiceId);
    const existing = await ref.get();
    if (!existing.exists) throw new NotFoundError("Invoice not found");
    const invoice = existing.data()!;

    if (invoice.status === "paid") {
      throw new ConflictError("Invoice is already paid");
    }
    if (invoice.status === "void") {
      throw new ConflictError("Cannot mark a voided invoice as paid");
    }

    const paidAt = data.paidAt
      ? admin.firestore.Timestamp.fromDate(new Date(data.paidAt))
      : now;

    const updateData: Record<string, unknown> = {
      status: "paid",
      paidAt,
      updatedAt: now,
    };
    if (data.paymentMethod !== undefined) {
      updateData.paymentMethod = data.paymentMethod;
    }

    await ref.update(updateData);

    // Side effect: mark linked lessons as paid
    await markLinkedLessonsPaid(invoice.lineItems);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Failed to mark invoice paid in Firestore:", error);
    throw new Error("Failed to mark invoice paid");
  }
}

/**
 * Record that an invoice was emailed to its billing contact. Stamps
 * `sentAt` with the current time (overwriting any prior value so resends
 * reflect the most recent delivery). Called by the send endpoint after a
 * successful delivery.
 */
export async function markInvoiceSentInFirestore(
  invoiceId: string
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();
    await firestore.collection("invoices").doc(invoiceId).update({
      sentAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error("Failed to mark invoice sent in Firestore:", error);
    throw new Error("Failed to mark invoice sent");
  }
}

/**
 * Idempotent mark-paid triggered by a Stripe webhook when an online payment
 * succeeds. Unlike markInvoicePaidInFirestore this never throws for
 * "already paid" — webhooks can fire multiple times and the handler must be
 * safe to retry. A voided invoice is left untouched. Records the Stripe
 * PaymentIntent id for reconciliation and stamps paymentMethod = "stripe".
 */
export async function markInvoicePaidFromStripe(
  invoiceId: string,
  stripePaymentIntentId: string | null
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    const ref = firestore.collection("invoices").doc(invoiceId);
    const existing = await ref.get();
    if (!existing.exists) {
      console.warn(`Stripe webhook: invoice ${invoiceId} not found`);
      return;
    }
    const invoice = existing.data()!;

    // Already paid (e.g. webhook replay or manual mark) — nothing to do.
    if (invoice.status === "paid") return;
    // Voided invoices must never flip to paid.
    if (invoice.status === "void") {
      console.warn(
        `Stripe webhook: ignoring payment for voided invoice ${invoiceId}`
      );
      return;
    }

    const updateData: Record<string, unknown> = {
      status: "paid",
      paidAt: now,
      paymentMethod: "stripe",
      updatedAt: now,
    };
    if (stripePaymentIntentId) {
      updateData.stripePaymentIntentId = stripePaymentIntentId;
    }

    await ref.update(updateData);
    await markLinkedLessonsPaid(invoice.lineItems);

    // Record on the timeline. No actor name — this is system-initiated.
    await recordInvoiceEventSafe(
      invoiceId,
      "paid_online",
      "Paid online via Stripe",
      null
    );
  } catch (error) {
    console.error("Failed to mark invoice paid from Stripe webhook:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to mark invoice paid"
    );
  }
}

/**
 * Void an invoice. Clears the invoiceId on all referenced lessons so they
 * become available for re-invoicing. Does NOT touch isPaid — if the
 * invoice was already paid, the lessons remain marked as paid.
 */
export async function voidInvoiceInFirestore(
  invoiceId: string
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    // Fetch line items to clear their invoice association
    const existing = await firestore.collection("invoices").doc(invoiceId).get();
    if (existing.exists) {
      const lineItems = existing.data()?.lineItems ?? [];
      await Promise.all(
        lineItems.map(
          (li: { lessonId: string }) =>
            li.lessonId && setLessonInvoiceIdInFirestore(li.lessonId, null)
        )
      );
    }

    await firestore.collection("invoices").doc(invoiceId).update({
      status: "void",
      updatedAt: now,
    });
  } catch (error) {
    console.error("Failed to void invoice in Firestore:", error);
    throw new Error("Failed to void invoice");
  }
}

/**
 * Delete an invoice document permanently. Clears the invoiceId on all
 * referenced lessons so they become available for re-invoicing.
 */
export async function deleteInvoiceFromFirestore(
  invoiceId: string
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();

    // Fetch line items to clear their invoice association before deleting
    const existing = await firestore.collection("invoices").doc(invoiceId).get();
    if (existing.exists) {
      const lineItems = existing.data()?.lineItems ?? [];
      await Promise.all(
        lineItems.map(
          (li: { lessonId: string }) =>
            li.lessonId && setLessonInvoiceIdInFirestore(li.lessonId, null)
        )
      );
    }

    await firestore.collection("invoices").doc(invoiceId).delete();
  } catch (error) {
    console.error("Failed to delete invoice from Firestore:", error);
    throw new Error("Failed to delete invoice");
  }
}

/**
 * Get all invoices for a specific student
 */
export async function getStudentInvoicesFromFirestore(
  studentId: string
): Promise<Invoice[]> {
  try {
    const firestore = getFirebaseFirestore();
    const snapshot = await firestore
      .collection("invoices")
      .where("studentId", "==", studentId)
      .get();

    const invoices: Invoice[] = [];
    snapshot.forEach((doc) => {
      invoices.push(mapInvoice(doc.id, doc.data()));
    });

    return invoices;
  } catch (error) {
    console.error("Failed to get student invoices from Firestore:", error);
    throw new Error("Failed to get student invoices");
  }
}

/**
 * Calculate total debt from open and overdue invoices
 */
export async function getStudentDebtFromFirestore(
  studentId: string
): Promise<number> {
  try {
    const invoices = await getStudentInvoicesFromFirestore(studentId);
    const debt = invoices
      .filter((invoice) => invoice.status === "open" || invoice.status === "overdue")
      .reduce((total, invoice) => total + invoice.total, 0);
    return Math.round(debt * 100) / 100;
  } catch (error) {
    console.error("Failed to calculate student debt from Firestore:", error);
    throw new Error("Failed to calculate student debt");
  }
}
