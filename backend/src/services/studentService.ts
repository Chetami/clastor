import { getFirebaseFirestore } from "../config/firebase";
import { CreateStudentRequest, Student } from "@examify-tms/interfaces";
import admin from "firebase-admin";
import crypto from "crypto";

/**
 * Generate a unique student ID with prefix
 * @returns Student ID (e.g., student_a1b2c3d4e5f6)
 */
function generateStudentId(): string {
  const randomBytes = crypto.randomBytes(12).toString("hex");
  return `student_${randomBytes}`;
}

/**
 * Resolve the billing email for a student. Always returns a non-null value:
 * the tutor's explicit override if set, otherwise the parent email,
 * otherwise the student's own email (which is always required).
 */
function resolveBillingEmail(
  explicit: string | null | undefined,
  parentEmail: string | null | undefined,
  email: string
): string {
  if (explicit && explicit.trim().length > 0) return explicit;
  if (parentEmail && parentEmail.trim().length > 0) return parentEmail;
  return email;
}

/**
 * List student documents from Firestore
 * @param userId - ID of the authenticated user
 * @param role - Role of the authenticated user ('tutor' or 'system_admin')
 * @returns Array of Student objects
 */
export async function listStudentsFromFirestore(
  userId: string,
  role: string
): Promise<Student[]> {
  try {
    const firestore = getFirebaseFirestore();
    let snapshot: admin.firestore.QuerySnapshot;

    // Tutors can only see their own students
    if (role === "tutor") {
      snapshot = await firestore
        .collection("students")
        .where("tutorId", "==", userId)
        .get();
    }
    // System admins can see all students
    else if (role === "system_admin") {
      snapshot = await firestore.collection("students").get();
    } else {
      throw new Error("Invalid role");
    }

    // Map snapshot to Student array
    const students: Student[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const parentEmail = data.parentEmail || null;
      students.push({
        id: doc.id,
        tutorId: data.tutorId,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        parentEmail,
        billingEmail: resolveBillingEmail(
          data.billingEmail,
          parentEmail,
          data.email
        ),
        subject: data.subject,
        expectedAmount: data.expectedAmount,
        rateType: data.rateType,
        frequencyPerWeek: data.frequencyPerWeek,
        status: data.status,
        timezone: data.timezone || null,
        notes: data.notes || null,
        amountOwed: data.amountOwed,
        createdAt: data.createdAt ? data.createdAt.toDate() : (null as any),
        updatedAt: data.updatedAt ? data.updatedAt.toDate() : (null as any),
      });
    });

    return students;
  } catch (error) {
    console.error("Failed to list students from Firestore:", error);
    throw new Error("Failed to list students");
  }
}

/**
 * Get a specific student by ID from Firestore
 * @param studentId - ID of the student to retrieve
 * @returns Student object or null if not found
 */
export async function getStudentByIdFromFirestore(
  studentId: string
): Promise<Student | null> {
  try {
    const firestore = getFirebaseFirestore();
    const doc = await firestore.collection("students").doc(studentId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    const parentEmail = data.parentEmail || null;
    return {
      id: doc.id,
      tutorId: data.tutorId,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      parentEmail,
      billingEmail: resolveBillingEmail(
        data.billingEmail,
        parentEmail,
        data.email
      ),
      subject: data.subject,
      expectedAmount: data.expectedAmount,
      rateType: data.rateType,
      frequencyPerWeek: data.frequencyPerWeek,
      status: data.status,
      timezone: data.timezone || null,
      notes: data.notes || null,
      amountOwed: data.amountOwed,
      createdAt: data.createdAt ? data.createdAt.toDate() : (null as any),
      updatedAt: data.updatedAt ? data.updatedAt.toDate() : (null as any),
    };
  } catch (error) {
    console.error("Failed to get student from Firestore:", error);
    throw new Error("Failed to get student");
  }
}

/**
 * Create student document in Firestore
 * @param data - Student creation request data
 * @param tutorId - ID of the tutor creating this student
 * @returns Created student object
 */
export async function createStudentInFirestore(
  data: CreateStudentRequest,
  tutorId: string
): Promise<Student> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();
    const studentId = generateStudentId();

    const studentData = {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      parentEmail: data.parentEmail || null,
      billingEmail: data.billingEmail || null,
      subject: data.subject,
      expectedAmount: data.expectedAmount,
      rateType: data.rateType,
      frequencyPerWeek: data.frequencyPerWeek,
      status: data.status || "active",
      timezone: data.timezone || null,
      notes: data.notes || null,
      amountOwed: 0,
      tutorId,
      createdAt: now,
      updatedAt: now,
    };

    await firestore.collection("students").doc(studentId).set(studentData);

    // Return Student object with Date objects (matching getUserFromFirestore pattern)
    const parentEmail = data.parentEmail || null;
    return {
      id: studentId,
      tutorId,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      parentEmail,
      billingEmail: resolveBillingEmail(
        data.billingEmail || null,
        parentEmail,
        data.email
      ),
      subject: data.subject,
      expectedAmount: data.expectedAmount,
      rateType: data.rateType,
      frequencyPerWeek: data.frequencyPerWeek,
      status: data.status || "active",
      timezone: data.timezone || null,
      notes: data.notes || null,
      amountOwed: 0,
      createdAt: now.toDate() as any,
      updatedAt: now.toDate() as any,
    };
  } catch (error) {
    console.error("Failed to create student in Firestore:", error);
    throw new Error("Failed to create student");
  }
}
