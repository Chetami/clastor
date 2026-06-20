import { Request } from "express";
import * as permissions from "./permissions";
import { Student } from "@examify-tms/interfaces";

/**
 * Student Permissions
 *
 * - System admins can access any student
 * - Tutors can only access their own students (where student.tutorId === tutor's user ID)
 */

/**
 * Check if user can view a specific student
 * @param student - Student object containing tutorId
 * @param req - Express request with authenticated user
 * @returns true if user is system_admin or is the student's tutor
 */
export const canViewStudent = (student: Student, req?: Request): boolean => {
  // System admins can view any student
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }

  // Tutors can only view their own students
  return permissions.isSameUser(student.tutorId, req?.user?.uid);
};

/**
 * Check if user can edit a specific student
 * @param student - Student object containing tutorId
 * @param req - Express request with authenticated user
 * @returns true if user is system_admin or is the student's tutor
 */
export const canEditStudent = (student: Student, req?: Request): boolean => {
  // System admins can edit any student
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }

  // Tutors can only edit their own students
  return permissions.isSameUser(student.tutorId, req?.user?.uid);
};

/**
 * Check if user can delete a specific student
 * @param student - Student object containing tutorId
 * @param req - Express request with authenticated user
 * @returns true if user is system_admin or is the student's tutor
 */
export const canDeleteStudent = (student: Student, req?: Request): boolean => {
  // System admins can delete any student
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }

  // Tutors can only delete their own students
  return permissions.isSameUser(student.tutorId, req?.user?.uid);
};
