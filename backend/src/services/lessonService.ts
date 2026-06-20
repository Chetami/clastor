import { getFirebaseFirestore } from "../config/firebase";
import {
  CreateLessonRequest,
  UpdateLessonRequest,
  AttendanceStatus,
  Lesson,
  ListLessonsQuery,
} from "@examify-tms/interfaces";
import admin from "firebase-admin";
import crypto from "crypto";

/**
 * Generate a unique lesson ID with prefix
 * @returns Lesson ID (e.g., lesson_a1b2c3d4e5f6)
 */
function generateLessonId(): string {
  const randomBytes = crypto.randomBytes(12).toString("hex");
  return `lesson_${randomBytes}`;
}

/**
 * Map a Firestore lesson document to a Lesson object
 */
function mapLesson(id: string, data: admin.firestore.DocumentData): Lesson {
  return {
    id,
    tutorId: data.tutorId,
    studentId: data.studentId,
    subject: data.subject,
    startDateTime: data.startDateTime ? data.startDateTime.toDate() : (null as any),
    durationMinutes: data.durationMinutes,
    location: data.location ?? null,
    notes: data.notes ?? null,
    acceptanceStatus: data.acceptanceStatus,
    attendanceStatus: data.attendanceStatus,
    seriesId: data.seriesId ?? null,
    isCancelled: data.isCancelled ?? false,
    isException: data.isException ?? false,
    remindersEnabled: data.remindersEnabled,
    isPaid: data.isPaid ?? false,
    createdAt: data.createdAt ? data.createdAt.toDate() : (null as any),
    updatedAt: data.updatedAt ? data.updatedAt.toDate() : (null as any),
  };
}

export interface LessonFilters {
  from?: Date;
  to?: Date;
  studentId?: string;
  acceptanceStatus?: string;
  attendanceStatus?: string;
}

/**
 * List lesson documents from Firestore, scoped to the authenticated user.
 * Filters (date window, student, status) are applied in memory to avoid
 * composite-index requirements; a tutor's lesson volume is small enough
 * that fetching by owner then filtering is practical.
 */
export async function listLessonsFromFirestore(
  userId: string,
  role: string,
  filters: LessonFilters = {}
): Promise<Lesson[]> {
  try {
    const firestore = getFirebaseFirestore();
    let snapshot: admin.firestore.QuerySnapshot;

    if (role === "tutor") {
      snapshot = await firestore
        .collection("lessons")
        .where("tutorId", "==", userId)
        .get();
    } else if (role === "system_admin") {
      snapshot = await firestore.collection("lessons").get();
    } else {
      throw new Error("Invalid role");
    }

    const lessons: Lesson[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const lesson = mapLesson(doc.id, data);

      // Apply in-memory filters
      if (filters.from) {
        const start = new Date(lesson.startDateTime as any);
        if (start < filters.from) return;
      }
      if (filters.to) {
        const start = new Date(lesson.startDateTime as any);
        if (start >= filters.to) return;
      }
      if (filters.studentId && lesson.studentId !== filters.studentId) return;
      if (
        filters.acceptanceStatus &&
        lesson.acceptanceStatus !== filters.acceptanceStatus
      )
        return;
      if (
        filters.attendanceStatus &&
        lesson.attendanceStatus !== filters.attendanceStatus
      )
        return;

      lessons.push(lesson);
    });

    // Sort ascending by start time
    lessons.sort(
      (a, b) =>
        new Date(a.startDateTime as any).getTime() -
        new Date(b.startDateTime as any).getTime()
    );

    return lessons;
  } catch (error) {
    console.error("Failed to list lessons from Firestore:", error);
    throw new Error("Failed to list lessons");
  }
}

/**
 * Get a specific lesson by ID from Firestore
 */
export async function getLessonByIdFromFirestore(
  lessonId: string
): Promise<Lesson | null> {
  try {
    const firestore = getFirebaseFirestore();
    const doc = await firestore.collection("lessons").doc(lessonId).get();

    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    return mapLesson(doc.id, data);
  } catch (error) {
    console.error("Failed to get lesson from Firestore:", error);
    throw new Error("Failed to get lesson");
  }
}

/**
 * Create lesson document in Firestore
 */
export async function createLessonInFirestore(
  data: CreateLessonRequest,
  tutorId: string
): Promise<Lesson> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();
    const lessonId = generateLessonId();

    const startDateTime = admin.firestore.Timestamp.fromDate(
      new Date(data.startDateTime)
    );

    const lessonData = {
      tutorId,
      studentId: data.studentId,
      subject: data.subject,
      startDateTime,
      durationMinutes: data.durationMinutes,
      location: data.location ?? null,
      notes: data.notes ?? null,
      acceptanceStatus: "pending",
      attendanceStatus: "unrecorded",
      seriesId: null,
      isCancelled: false,
      isException: false,
      remindersEnabled: data.remindersEnabled ?? true,
      isPaid: false,
      createdAt: now,
      updatedAt: now,
    };

    await firestore.collection("lessons").doc(lessonId).set(lessonData);

    return {
      id: lessonId,
      tutorId,
      studentId: data.studentId,
      subject: data.subject,
      startDateTime: startDateTime.toDate() as any,
      durationMinutes: data.durationMinutes,
      location: data.location ?? null,
      notes: data.notes ?? null,
      acceptanceStatus: "pending",
      attendanceStatus: "unrecorded",
      seriesId: null,
      isCancelled: false,
      isException: false,
      remindersEnabled: data.remindersEnabled ?? true,
      isPaid: false,
      createdAt: now.toDate() as any,
      updatedAt: now.toDate() as any,
    };
  } catch (error) {
    console.error("Failed to create lesson in Firestore:", error);
    throw new Error("Failed to create lesson");
  }
}

/**
 * Update a lesson document in Firestore
 */
export async function updateLessonInFirestore(
  lessonId: string,
  data: UpdateLessonRequest
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    // A direct update marks this occurrence as an exception so later
    // series-level bulk edits skip it.
    const updateData: Record<string, unknown> = { updatedAt: now, isException: true };
    if (data.studentId !== undefined) updateData.studentId = data.studentId;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.startDateTime !== undefined && data.startDateTime !== null) {
      updateData.startDateTime = admin.firestore.Timestamp.fromDate(
        new Date(data.startDateTime)
      );
    }
    if (data.durationMinutes !== undefined)
      updateData.durationMinutes = data.durationMinutes;
    if (data.location !== undefined) updateData.location = data.location;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.acceptanceStatus !== undefined)
      updateData.acceptanceStatus = data.acceptanceStatus;
    if (data.remindersEnabled !== undefined)
      updateData.remindersEnabled = data.remindersEnabled;
    if (data.isPaid !== undefined) updateData.isPaid = data.isPaid;

    await firestore.collection("lessons").doc(lessonId).update(updateData);
  } catch (error) {
    console.error("Failed to update lesson in Firestore:", error);
    throw new Error("Failed to update lesson");
  }
}

/**
 * Record the attendance/outcome for a lesson
 */
export async function recordAttendanceInFirestore(
  lessonId: string,
  attendanceStatus: AttendanceStatus
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    await firestore
      .collection("lessons")
      .doc(lessonId)
      .update({
        attendanceStatus,
        updatedAt: now,
      });
  } catch (error) {
    console.error("Failed to record attendance in Firestore:", error);
    throw new Error("Failed to record attendance");
  }
}

/**
 * Soft-cancel a single lesson occurrence (forward-looking cancellation).
 * The document is kept for history/audit; derived status treats it as cancelled.
 */
export async function cancelLessonInFirestore(
  lessonId: string
): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    await firestore
      .collection("lessons")
      .doc(lessonId)
      .update({
        isCancelled: true,
        updatedAt: now,
      });
  } catch (error) {
    console.error("Failed to cancel lesson in Firestore:", error);
    throw new Error("Failed to cancel lesson");
  }
}
