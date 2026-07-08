import { Request, Response } from "express";
import { createStudentInFirestore, listStudentsFromFirestore, getStudentByIdFromFirestore, updateStudentInFirestore, importStudentsFromCsv } from "../services/studentService";
import { CreateStudentRequest, UpdateStudentRequest, StudentResponse, StudentListResponse, StudentImportSummary, Student, ApiError } from "@examify-tms/interfaces";
import { canViewStudent, canEditStudent } from "../permissions/studentPermissions";
import { resolveTutorNames } from "../services/tutorResolver";
import { resolveScope } from "../services/orgScope";

/**
 * Create student controller
 * Creates a new student record linked to the authenticated tutor
 */
export async function createStudent(
  req: Request<{}, {}, CreateStudentRequest>,
  res: Response<StudentResponse | ApiError>
): Promise<void> {
  try {
    // Get authenticated user from middleware
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Create student with tutor ID from authenticated user
    const student = await createStudentInFirestore(req.body, req.user.uid);

    // Return StudentResponse
    const response: StudentResponse = {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      parentEmail: student.parentEmail,
      billingEmail: student.billingEmail,
      subjectIds: student.subjectIds,
      expectedAmount: student.expectedAmount,
      rateType: student.rateType,
      frequencyPerWeek: student.frequencyPerWeek,
      status: student.status,
      timezone: student.timezone,
      notes: student.notes,
      amountOwed: student.amountOwed,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Create student failed:", error);
    const message = error instanceof Error ? error.message : "Failed to create student";
    res.status(500).json({ message });
  }
}

/**
 * List students controller
 * Lists all students accessible to the authenticated user
 * Tutors see only their own students, system admins see all students
 */
export async function listStudents(
  req: Request,
  res: Response<StudentListResponse | ApiError>
): Promise<void> {
  try {
    // Get authenticated user from middleware
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    // Admins may drill into a single tutor via ?tutorId=…; otherwise they see
    // all students. Tutors are always scoped to their own uid.
    const subjectId =
      typeof req.query.subjectId === "string" ? req.query.subjectId : undefined;
    const drillTutorId =
      typeof req.query.tutorId === "string" ? req.query.tutorId : null;
    const scopeUid =
      req.user.role === "system_admin" && drillTutorId
        ? drillTutorId
        : req.user.uid;
    const scopeRole =
      req.user.role === "system_admin" && drillTutorId
        ? "tutor"
        : req.user.role;

    // Resolve the org read scope for tutors (org-admin sees all org students,
    // org-member sees their own within the org, personal = legacy own-students).
    // system_admin bypasses scoping entirely. Admin drill-down (scopeRole =
    // "tutor" as a system_admin) deliberately stays in personal scope.
    const orgScope =
      req.user.role === "tutor" && scopeRole === "tutor"
        ? await resolveScope({
            uid: req.user.uid,
            currentOrgId: req.user.currentOrgId ?? null,
          })
        : undefined;

    const students = await listStudentsFromFirestore(
      scopeUid,
      scopeRole,
      subjectId,
      orgScope,
    );

    // Resolve tutor names for the admin (system-wide) view so the client can
    // render a "Tutor" column. Skipped for the tutor's own (single-tutor) view.
    let data: Student[] = students;
    if (req.user.role === "system_admin") {
      const names = await resolveTutorNames(students.map((s) => s.tutorId));
      data = students.map((s) => {
        const info = names.get(s.tutorId);
        return {
          ...s,
          tutorName: info?.name ?? null,
          tutorEmail: info?.email ?? null,
        };
      });
    }

    // Return StudentListResponse
    const response: StudentListResponse = {
      data,
      total: data.length,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("List students failed:", error);
    const message = error instanceof Error ? error.message : "Failed to list students";
    res.status(500).json({ message });
  }
}

/**
 * Get student by ID controller
 * Returns a specific student if the user has permission
 * System admins can view any student, tutors can only view their own students
 */
export async function getStudentById(
  req: Request<{ id: string }>,
  res: Response<StudentResponse | ApiError>
): Promise<void> {
  try {
    // Get authenticated user from middleware
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const studentId = req.params.id;

    // Get student from Firestore
    const student = await getStudentByIdFromFirestore(studentId);

    if (!student) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    // Check if user has permission to view this student
    if (!canViewStudent(student, req)) {
      res.status(403).json({ message: "Forbidden: You do not have permission to view this student" });
      return;
    }

    // Return StudentResponse (convert Dates to ISO strings, assert enum types)
    const response: StudentResponse = {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      parentEmail: student.parentEmail,
      billingEmail: student.billingEmail,
      subjectIds: student.subjectIds,
      expectedAmount: student.expectedAmount,
      rateType: student.rateType as "hourly" | "per_lesson",
      frequencyPerWeek: student.frequencyPerWeek,
      status: student.status as "active" | "past",
      timezone: student.timezone,
      notes: student.notes,
      amountOwed: student.amountOwed,
      createdAt: (student.createdAt as any) instanceof Date ? (student.createdAt as any).toISOString() : student.createdAt,
      updatedAt: (student.updatedAt as any) instanceof Date ? (student.updatedAt as any).toISOString() : student.updatedAt,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Get student by ID failed:", error);
    const message = error instanceof Error ? error.message : "Failed to get student";
    res.status(500).json({ message });
  }
}

/**
 * Update student controller
 * Updates an existing student record
 */
export async function updateStudent(
  req: Request<{ id: string }, {}, UpdateStudentRequest>,
  res: Response<StudentResponse | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const studentId = req.params.id;

    const existingStudent = await getStudentByIdFromFirestore(studentId);

    if (!existingStudent) {
      res.status(404).json({ message: "Student not found" });
      return;
    }

    if (!canEditStudent(existingStudent, req)) {
      res.status(403).json({ message: "Forbidden: You do not have permission to update this student" });
      return;
    }

    const updatedStudent = await updateStudentInFirestore(studentId, req.body);

    const response: StudentResponse = {
      id: updatedStudent.id,
      name: updatedStudent.name,
      email: updatedStudent.email,
      phone: updatedStudent.phone,
      parentEmail: updatedStudent.parentEmail,
      billingEmail: updatedStudent.billingEmail,
      subjectIds: updatedStudent.subjectIds,
      expectedAmount: updatedStudent.expectedAmount,
      rateType: updatedStudent.rateType as "hourly" | "per_lesson",
      frequencyPerWeek: updatedStudent.frequencyPerWeek,
      status: updatedStudent.status as "active" | "past",
      timezone: updatedStudent.timezone,
      notes: updatedStudent.notes,
      amountOwed: updatedStudent.amountOwed,
      createdAt: (updatedStudent.createdAt as any) instanceof Date ? (updatedStudent.createdAt as any).toISOString() : updatedStudent.createdAt,
      updatedAt: (updatedStudent.updatedAt as any) instanceof Date ? (updatedStudent.updatedAt as any).toISOString() : updatedStudent.updatedAt,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Update student failed:", error);
    const message = error instanceof Error ? error.message : "Failed to update student";
    res.status(500).json({ message });
  }
}

/**
 * Import students controller
 * Parses an uploaded CSV and bulk-creates valid student records linked to the
 * authenticated tutor. Returns a summary of created / skipped rows.
 */
export async function importStudents(
  req: Request,
  res: Response<StudentImportSummary | ApiError>
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const file = (req as Request).file;
    if (!file) {
      res.status(400).json({ message: "No CSV file uploaded" });
      return;
    }

    const csvContent = file.buffer.toString("utf8");
    if (csvContent.trim().length === 0) {
      res.status(400).json({ message: "CSV file is empty" });
      return;
    }

    const summary = await importStudentsFromCsv(csvContent, req.user.uid);

    res.status(200).json(summary);
  } catch (error) {
    console.error("Import students failed:", error);
    const message = error instanceof Error ? error.message : "Failed to import students";
    res.status(500).json({ message });
  }
}
