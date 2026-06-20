import { Request, Response } from "express";
import {
  createLessonInFirestore,
  listLessonsFromFirestore,
  getLessonByIdFromFirestore,
  updateLessonInFirestore,
  recordAttendanceInFirestore,
  cancelLessonInFirestore,
  LessonFilters,
} from "../services/lessonService";
import {
  CreateLessonRequest,
  UpdateLessonRequest,
  RecordAttendanceRequest,
  Lesson,
  LessonResponse,
  LessonListResponse,
  ApiError,
} from "@examify-tms/interfaces";
import { canViewLesson, canEditLesson } from "../permissions/lessonPermissions";

/**
 * Convert a Lesson (Date-typed) to a LessonResponse (ISO string-typed),
 * excluding tutorId.
 */
function toLessonResponse(lesson: Lesson): LessonResponse {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v;
  return {
    id: lesson.id,
    studentId: lesson.studentId,
    subject: lesson.subject,
    startDateTime: toIso(lesson.startDateTime),
    durationMinutes: lesson.durationMinutes,
    location: lesson.location ?? null,
    notes: lesson.notes ?? null,
    acceptanceStatus: lesson.acceptanceStatus,
    attendanceStatus: lesson.attendanceStatus,
    seriesId: lesson.seriesId ?? null,
    isCancelled: lesson.isCancelled ?? false,
    isException: lesson.isException ?? false,
    remindersEnabled: lesson.remindersEnabled,
    isPaid: lesson.isPaid ?? false,
    createdAt: toIso(lesson.createdAt),
    updatedAt: toIso(lesson.updatedAt),
  };
}

/**
 * Create lesson controller
 */
export async function createLesson(
  req: Request<{}, {}, CreateLessonRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await createLessonInFirestore(req.body, req.user.uid);
    res.status(201).json(toLessonResponse(lesson));
  } catch (error) {
    console.error("Create lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create lesson";
    res.status(500).json({ message });
  }
}

/**
 * List lessons controller
 * Supports from/to (calendar window), studentId, acceptanceStatus,
 * attendanceStatus query filters.
 */
export async function listLessons(
  req: Request,
  res: Response<LessonListResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const filters: LessonFilters = {};
    if (typeof req.query.from === "string") {
      filters.from = new Date(req.query.from);
    }
    if (typeof req.query.to === "string") {
      filters.to = new Date(req.query.to);
    }
    if (typeof req.query.studentId === "string") {
      filters.studentId = req.query.studentId;
    }
    if (typeof req.query.acceptanceStatus === "string") {
      filters.acceptanceStatus = req.query.acceptanceStatus;
    }
    if (typeof req.query.attendanceStatus === "string") {
      filters.attendanceStatus = req.query.attendanceStatus;
    }

    const lessons = await listLessonsFromFirestore(
      req.user.uid,
      req.user.role,
      filters
    );

    const response: LessonListResponse = {
      data: lessons.map(toLessonResponse),
      total: lessons.length,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("List lessons failed:", error);
    const message = error instanceof Error ? error.message : "Failed to list lessons";
    res.status(500).json({ message });
  }
}

/**
 * Get lesson by ID controller
 */
export async function getLessonById(
  req: Request<{ id: string }>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canViewLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to view this lesson" });
      return;
    }

    res.status(200).json(toLessonResponse(lesson));
  } catch (error) {
    console.error("Get lesson by ID failed:", error);
    const message = error instanceof Error ? error.message : "Failed to get lesson";
    res.status(500).json({ message });
  }
}

/**
 * Update lesson controller
 */
export async function updateLesson(
  req: Request<{ id: string }, {}, UpdateLessonRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to edit this lesson" });
      return;
    }

    await updateLessonInFirestore(req.params.id, req.body);

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    res.status(200).json(toLessonResponse(updated));
  } catch (error) {
    console.error("Update lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update lesson";
    res.status(500).json({ message });
  }
}

/**
 * Record attendance controller
 */
export async function recordAttendance(
  req: Request<{ id: string }, {}, RecordAttendanceRequest>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to edit this lesson" });
      return;
    }

    await recordAttendanceInFirestore(req.params.id, req.body.attendanceStatus);

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    res.status(200).json(toLessonResponse(updated));
  } catch (error) {
    console.error("Record attendance failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to record attendance";
    res.status(500).json({ message });
  }
}

/**
 * Cancel a single lesson occurrence (soft cancel).
 */
export async function cancelLesson(
  req: Request<{ id: string }>,
  res: Response<LessonResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const lesson = await getLessonByIdFromFirestore(req.params.id);

    if (!lesson) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    if (!canEditLesson(lesson, req)) {
      res
        .status(403)
        .json({ message: "Forbidden: You do not have permission to cancel this lesson" });
      return;
    }

    await cancelLessonInFirestore(req.params.id);

    const updated = await getLessonByIdFromFirestore(req.params.id);
    if (!updated) {
      res.status(404).json({ message: "Lesson not found" });
      return;
    }

    res.status(200).json(toLessonResponse(updated));
  } catch (error) {
    console.error("Cancel lesson failed:", error);
    const message = error instanceof Error ? error.message : "Failed to cancel lesson";
    res.status(500).json({ message });
  }
}
