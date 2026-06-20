import { Request } from "express";
import * as permissions from "./permissions";
import { Lesson } from "@examify-tms/interfaces";

/**
 * Lesson Permissions
 *
 * - System admins can access any lesson
 * - Tutors can only access their own lessons (where lesson.tutorId === tutor's user ID)
 */

/**
 * Check if user can view a specific lesson
 */
export const canViewLesson = (lesson: Lesson, req?: Request): boolean => {
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }
  return permissions.isSameUser(lesson.tutorId, req?.user?.uid);
};

/**
 * Check if user can edit a specific lesson
 */
export const canEditLesson = (lesson: Lesson, req?: Request): boolean => {
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }
  return permissions.isSameUser(lesson.tutorId, req?.user?.uid);
};
