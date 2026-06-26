import {
  DashboardPeriod,
  AdminOverviewResponse,
  AdminTutorSummary,
  AttendanceStatus,
} from "@examify-tms/interfaces";
import { listLessonsFromFirestore } from "./lessonService";
import { listInvoicesFromFirestore } from "./paymentService";
import { listStudentsFromFirestore } from "./studentService";
import {
  listTutorsFromFirestore,
  type TutorRecord,
} from "./userService";
import { listFeedbackFromFirestore } from "./feedbackService";
import {
  getRange,
  getPreviousRange,
  PRESENT_STATUSES,
} from "./dashboardService";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Range {
  start: Date;
  end: Date;
}

function inRange(date: Date, range: Range): boolean {
  const ms = date.getTime();
  return ms >= range.start.getTime() && ms < range.end.getTime();
}

/**
 * Compute the admin platform overview for the selected period: tutor counts,
 * a top-tutors leaderboard (by income), recent signups, and a feedback
 * snapshot. Aggregation is done in memory from the existing list services
 * (which return all records for system_admin), matching the codebase pattern.
 */
export async function getAdminOverview(
  period: DashboardPeriod,
): Promise<AdminOverviewResponse> {
  const now = new Date();
  const range = getRange(period, now);
  const previous = getPreviousRange(period, range);

  const [lessons, invoices, students, tutors, feedback] = await Promise.all([
    listLessonsFromFirestore("", "system_admin"),
    listInvoicesFromFirestore("", "system_admin"),
    listStudentsFromFirestore("", "system_admin"),
    listTutorsFromFirestore(),
    listFeedbackFromFirestore(),
  ]);

  const tutorById = new Map<string, TutorRecord>();
  for (const t of tutors) tutorById.set(t.id, t);

  // ---- Active tutors (>=1 attended lesson in period) ----
  const activeTutorIds = new Set<string>();
  const previousActiveTutorIds = new Set<string>();
  for (const lesson of lessons) {
    if (lesson.isCancelled) continue;
    if (!PRESENT_STATUSES.includes(lesson.attendanceStatus)) continue;
    const start = new Date(lesson.startDateTime as unknown as string);
    if (inRange(start, range)) activeTutorIds.add(lesson.tutorId);
    else if (inRange(start, previous)) previousActiveTutorIds.add(lesson.tutorId);
  }

  // ---- New tutors this period ----
  const newTutorsThisPeriod = tutors.filter((t) =>
    inRange(t.createdAt, range),
  ).length;

  // ---- Top tutors by income (period) ----
  const perTutor = new Map<
    string,
    {
      income: number;
      minutes: number;
      lessonsTaught: number;
      studentIds: Set<string>;
    }
  >();
  for (const t of tutors) {
    perTutor.set(t.id, {
      income: 0,
      minutes: 0,
      lessonsTaught: 0,
      studentIds: new Set(),
    });
  }

  for (const lesson of lessons) {
    if (lesson.isCancelled) continue;
    if (!PRESENT_STATUSES.includes(lesson.attendanceStatus)) continue;
    const start = new Date(lesson.startDateTime as unknown as string);
    if (!inRange(start, range)) continue;
    const bucket = perTutor.get(lesson.tutorId);
    if (!bucket) continue;
    bucket.minutes += lesson.durationMinutes;
    bucket.lessonsTaught += 1;
    if (lesson.studentId) bucket.studentIds.add(lesson.studentId);
  }
  for (const invoice of invoices) {
    if (invoice.status !== "paid" || !invoice.paidAt) continue;
    const paid = new Date(invoice.paidAt as unknown as string);
    if (!inRange(paid, range)) continue;
    const bucket = perTutor.get(invoice.tutorId);
    if (!bucket) continue;
    bucket.income += invoice.total;
  }

  const topTutors = [...perTutor.entries()]
    .map(([tutorId, b]) => {
      const tutor = tutorById.get(tutorId);
      return {
        tutorId,
        name: tutor?.name ?? "Unknown",
        email: tutor?.email || null,
        avatarUrl: tutor?.avatarUrl ?? null,
        income: round2(b.income),
        hoursWorked: round2(b.minutes / 60),
        lessonsTaught: b.lessonsTaught,
        studentCount: b.studentIds.size,
      };
    })
    .filter((t) => t.income > 0 || t.lessonsTaught > 0)
    .sort((a, b) => b.income - a.income || b.lessonsTaught - a.lessonsTaught)
    .slice(0, 5);

  // ---- Recent tutors (newest signups) ----
  const recentTutors = [...tutors]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5)
    .map((t) => ({
      tutorId: t.id,
      name: t.name,
      email: t.email || null,
      avatarUrl: t.avatarUrl,
      createdAt: t.createdAt.toISOString(),
      lastActive: t.lastActive ? t.lastActive.toISOString() : null,
    }));

  // ---- Feedback snapshot ----
  const openCount = feedback.filter((f) => f.status === "open").length;
  const resolvedCount = feedback.filter((f) => f.status === "resolved").length;
  const recentFeedback = feedback.slice(0, 3).map((f) => ({
    id: f.id,
    type: f.type,
    message: f.message,
    images: f.images,
    pageUrl: f.pageUrl,
    userAgent: f.userAgent,
    status: f.status,
    createdAt: f.createdAt.toISOString(),
    tutorId: f.tutorId,
    tutorName: f.tutorName,
    tutorEmail: f.tutorEmail,
  }));

  const activeStudents = students.filter((s) => s.status === "active").length;

  return {
    period,
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
    totalTutors: tutors.length,
    activeTutors: activeTutorIds.size,
    previousActiveTutors: previousActiveTutorIds.size,
    newTutorsThisPeriod,
    activeStudents,
    topTutors,
    recentTutors,
    feedback: {
      openCount,
      resolvedCount,
      recent: recentFeedback,
    },
  };
}

/**
 * List all tutors with light per-tutor stats (student count, outstanding $).
 * Used by the admin Tutors management page. Search/sort is handled client-side
 * to match the pattern used by the other list pages (Payments/Students).
 */
export async function listTutorsWithStats(): Promise<AdminTutorSummary[]> {
  const [tutors, students, invoices] = await Promise.all([
    listTutorsFromFirestore(),
    listStudentsFromFirestore("", "system_admin"),
    listInvoicesFromFirestore("", "system_admin"),
  ]);

  const studentCountByTutor = new Map<string, number>();
  for (const s of students) {
    const tid = (s as { tutorId?: string }).tutorId;
    if (!tid) continue;
    studentCountByTutor.set(tid, (studentCountByTutor.get(tid) ?? 0) + 1);
  }

  const outstandingByTutor = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status === "open" || inv.status === "overdue") {
      outstandingByTutor.set(
        inv.tutorId,
        (outstandingByTutor.get(inv.tutorId) ?? 0) + inv.total,
      );
    }
  }

  return tutors
    .map((t) => ({
      tutorId: t.id,
      name: t.name,
      email: t.email || null,
      avatarUrl: t.avatarUrl,
      createdAt: t.createdAt.toISOString(),
      lastActive: t.lastActive ? t.lastActive.toISOString() : null,
      studentCount: studentCountByTutor.get(t.id) ?? 0,
      outstandingAmount: round2(outstandingByTutor.get(t.id) ?? 0),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
