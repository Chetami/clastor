import { Request, Response } from "express";
import { createStudentInFirestore, listStudentsFromFirestore } from "../services/studentService";
import { CreateStudentRequest, StudentResponse, StudentListResponse, ApiError } from "@examify-tms/interfaces";

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
