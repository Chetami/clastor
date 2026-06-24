import { getFirebaseFirestore } from "../config/firebase";
import { CreateStudentRequest, UpdateStudentRequest, Student } from "@examify-tms/interfaces";
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
 * Coerce a raw subjectIds value into a clean string[]. Handles docs created
 * before the field existed (missing) or malformed values.
 */
function coalesceSubjectIds(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((id): id is string => typeof id === "string")
    : [];
}

/**
 * List student documents from Firestore
 * @param userId - ID of the authenticated user
 * @param role - Role of the authenticated user ('tutor' or 'system_admin')
 * @param subjectId - Optional subject id to filter by (array-contains)
 * @returns Array of Student objects
 */
export async function listStudentsFromFirestore(
  userId: string,
  role: string,
  subjectId?: string
): Promise<Student[]> {
  try {
    const firestore = getFirebaseFirestore();
    let snapshot: admin.firestore.QuerySnapshot;

    // Tutors can only see their own students
    if (role === "tutor") {
      let q: admin.firestore.Query = firestore
        .collection("students")
        .where("tutorId", "==", userId);
      if (subjectId) {
        q = q.where("subjectIds", "array-contains", subjectId);
      }
      snapshot = await q.get();
    }
    // System admins can see all students
    else if (role === "system_admin") {
      let q: admin.firestore.Query = firestore.collection("students");
      if (subjectId) {
        q = q.where("subjectIds", "array-contains", subjectId);
      }
      snapshot = await q.get();
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
        subjectIds: coalesceSubjectIds(data.subjectIds),
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
      subjectIds: coalesceSubjectIds(data.subjectIds),
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
      subjectIds: coalesceSubjectIds(data.subjectIds),
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
      subjectIds: coalesceSubjectIds(data.subjectIds),
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

/**
 * Update student document in Firestore
 * @param studentId - ID of the student to update
 * @param data - Student update request data
 * @returns Updated student object
 */
export async function updateStudentInFirestore(
  studentId: string,
  data: UpdateStudentRequest
): Promise<Student> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();

    const docRef = firestore.collection("students").doc(studentId);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new Error("Student not found");
    }

    const existingData = doc.data();
    if (!existingData) {
      throw new Error("Student data not found");
    }

    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.parentEmail !== undefined) updateData.parentEmail = data.parentEmail;
    if (data.billingEmail !== undefined) updateData.billingEmail = data.billingEmail;
    if (data.subjectIds !== undefined) updateData.subjectIds = coalesceSubjectIds(data.subjectIds);
    if (data.expectedAmount !== undefined) updateData.expectedAmount = data.expectedAmount;
    if (data.rateType !== undefined) updateData.rateType = data.rateType;
    if (data.frequencyPerWeek !== undefined) updateData.frequencyPerWeek = data.frequencyPerWeek;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.notes !== undefined) updateData.notes = data.notes;

    updateData.updatedAt = now;

    await docRef.update(updateData);

    const updatedDoc = await docRef.get();
    const updatedData = updatedDoc.data();
    if (!updatedData) {
      throw new Error("Failed to retrieve updated student");
    }

    const parentEmail = updatedData.parentEmail || null;
    return {
      id: studentId,
      tutorId: updatedData.tutorId,
      name: updatedData.name,
      email: updatedData.email,
      phone: updatedData.phone || null,
      parentEmail,
      billingEmail: resolveBillingEmail(
        updatedData.billingEmail,
        parentEmail,
        updatedData.email
      ),
      subjectIds: coalesceSubjectIds(updatedData.subjectIds),
      expectedAmount: updatedData.expectedAmount,
      rateType: updatedData.rateType,
      frequencyPerWeek: updatedData.frequencyPerWeek,
      status: updatedData.status,
      timezone: updatedData.timezone || null,
      notes: updatedData.notes || null,
      amountOwed: updatedData.amountOwed,
      createdAt: updatedData.createdAt ? updatedData.createdAt.toDate() : (null as any),
      updatedAt: now.toDate() as any,
    };
  } catch (error) {
    console.error("Failed to update student in Firestore:", error);
    throw new Error("Failed to update student");
  }
}
