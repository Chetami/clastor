import { Request } from "express";
import { canAccessOwned } from "./permissions";
import { Student } from "@examify-tms/interfaces";

/**
 * Student Permissions
 *
 * - System admins can access any student
 * - Tutors can only access their own students (where student.tutorId === tutor's user ID)
 */

export const canViewStudent = (student: Student, req?: Request): boolean =>
  canAccessOwned(student, req);

export const canEditStudent = (student: Student, req?: Request): boolean =>
  canAccessOwned(student, req);

export const canDeleteStudent = (student: Student, req?: Request): boolean =>
  canAccessOwned(student, req);
