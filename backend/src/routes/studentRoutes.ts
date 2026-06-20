import { Router } from "express";
import { createStudent, listStudents, getStudentById } from "../controllers/studentController";
import { authenticateJWT, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/students
 * List students endpoint - returns all students accessible to the authenticated user
 * Tutors see only their own students, system admins see all students
 */
router.get(
  "/",
  authenticateJWT,
  listStudents
);

/**
 * GET /api/students/id/:id
 * Get student by ID endpoint - returns a specific student if the user has permission
 * System admins can view any student, tutors can only view their own students
 */
router.get(
  "/id/:id",
  authenticateJWT,
  getStudentById
);

/**
 * POST /api/students
 * Create student endpoint - creates a new student linked to authenticated tutor
 * Both tutors and system_admins can create students
 */
router.post(
  "/",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  createStudent
);

export default router;
