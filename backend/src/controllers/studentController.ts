import { Request, Response } from "express";
import { createStudentInFirestore, listStudentsFromFirestore, getStudentByIdFromFirestore } from "../services/studentService";
import { CreateStudentRequest, StudentResponse, StudentListResponse, ApiError } from "@examify-tms/interfaces";
import { canViewStudent } from "../permissions/studentPermissions";

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
      subject: student.subject,
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

    // List students based on user role
    const students = await listStudentsFromFirestore(req.user.uid, req.user.role);

    // Return StudentListResponse
    const response: StudentListResponse = {
      data: students,
      total: students.length,
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
      subject: student.subject,
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
