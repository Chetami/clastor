import { Request } from "express";
import { canAccessOwned } from "./permissions";
import { Lesson } from "@examify-tms/interfaces";

/**
 * Lesson Permissions
 *
 * - System admins can access any lesson
 * - Tutors can only access their own lessons (where lesson.tutorId === tutor's user ID)
 */

export const canViewLesson = (lesson: Lesson, req?: Request): boolean =>
  canAccessOwned(lesson, req);

export const canEditLesson = (lesson: Lesson, req?: Request): boolean =>
  canAccessOwned(lesson, req);
