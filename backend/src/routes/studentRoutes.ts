import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { createStudent, listStudents, getStudentById, updateStudent, importStudents } from "../controllers/studentController";
import { authenticateJWT, requireRole } from "../middleware/auth";
import type { ApiError } from "@examify-tms/interfaces";

const router = Router();

// CSV uploads are kept in memory and parsed by the controller. Accept the
// common CSV mime types plus text/plain (some browsers send plain for .csv).
const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/csv" ||
      file.mimetype === "text/plain" ||
      /\.csv$/i.test(file.originalname);
    if (ok) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
});

/**
 * Wrap the CSV multer middleware so rejection errors (wrong type, too large)
 * are returned as a clean 400 instead of falling through to the 500 handler.
 */
function uploadCsvFile(req: Request, res: Response<ApiError>, next: NextFunction) {
  csvUpload.single("file")(req, res, (err) => {
    if (err) {
      res.status(400).json({
        message: err instanceof Error ? err.message : "Invalid file upload",
      });
      return;
    }
    next();
  });
}

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
 * POST /api/students/import
 * Import students from a CSV file - bulk-creates valid student records
 * Both tutors and system_admins can import students
 */
router.post(
  "/import",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  uploadCsvFile,
  importStudents
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

/**
 * PUT /api/students/:id
 * Update student endpoint - updates an existing student
 * Both tutors and system_admins can update students they have permission for
 */
router.put(
  "/:id",
  authenticateJWT,
  requireRole("tutor", "system_admin"),
  updateStudent
);

export default router;
