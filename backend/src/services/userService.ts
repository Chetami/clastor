import { getFirebaseFirestore } from "../config/firebase";
import {
  User,
  Role,
  UserInfo,
  Subject,
  ReminderLeadTime,
  WorkingHours,
} from "@examify-tms/interfaces";
import { generateToken } from "../utils/jwt";
import { getMembershipRole } from "./orgMemberService";
import { parse, isValid } from "date-fns";
import admin from "firebase-admin";
import crypto from "crypto";
import { getOrganisationById } from "./organisationService";
import { isMember } from "./orgMemberService";
import { ValidationError, NotFoundError } from "../utils/httpError";

/** The seven weekday keys stored on WorkingHours, Monday-first. */
const WORKING_DAYS: (keyof WorkingHours)[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

// Arbitrary reference date; only hour/minute components are read, and both
// ends of a window share it, so the actual day is irrelevant.
const TIME_REFERENCE = new Date(2000, 0, 1);

/** Minutes since midnight for an "HH:mm" string (NaN if malformed). */
function toMinutes(hhmm: string): number {
  // Require the canonical "HH:mm" shape; date-fns validates the ranges.
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return Number.NaN;
  const parsed = parse(hhmm, "HH:mm", TIME_REFERENCE);
  if (!isValid(parsed)) return Number.NaN;
  return parsed.getHours() * 60 + parsed.getMinutes();
}

/**
 * Validate + normalize a raw working-hours payload into a clean WorkingHours
 * object (or null when absent/unset). Each weekday is coerced to a valid
 * {start,end} window (start strictly before end) or null (day off). Garbage
 * values become null rather than throwing.
 */
export function normalizeWorkingHours(raw: unknown): WorkingHours | null {
  if (raw == null || typeof raw !== "object") return null;
  const result = {} as WorkingHours;
  let hasAny = false;
  for (const day of WORKING_DAYS) {
    const entry = (raw as Record<string, unknown>)[day as string];
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as Record<string, unknown>).start === "string" &&
      typeof (entry as Record<string, unknown>).end === "string"
    ) {
      const start = (entry as { start: string }).start;
      const end = (entry as { end: string }).end;
      const s = toMinutes(start);
      const e = toMinutes(end);
      if (!Number.isNaN(s) && !Number.isNaN(e) && s < e) {
        result[day] = { start, end };
        hasAny = true;
        continue;
      }
    }
    result[day] = null;
  }
  return hasAny ? result : null;
}

/**
 * Map a full User to the trimmed UserInfo returned to clients.
 * Centralized here so auth + user controllers stay in sync.
 *
 * `currentOrgRole` is left null here (it requires an orgMembers lookup). Call
 * {@link toUserInfoResolved} to populate it for responses that need to gate
 * org-admin UI on the client.
 */
export function toUserInfo(user: User): UserInfo {
  return {
    uid: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    currentOrgId: user.currentOrgId ?? null,
    currentOrgRole: null,
    avatarUrl: user.avatarUrl,
    currency: user.currency,
    reminderLeadTime: user.reminderLeadTime ?? null,
    workingHours: user.workingHours ?? null,
    subjects: user.subjects ?? [],
    onboardingComplete: user.onboardingComplete === true,
    tourSeen: user.tourSeen === true,
  };
}

/**
 * Build a UserInfo with the per-org `currentOrgRole` resolved from orgMembers.
 * When the user has no active org (personal mode) the role stays null. Use this
 * for any response the client uses to gate org-admin UI (login, refresh,
 * org switch). Falls back to {@link toUserInfo} if the role lookup fails.
 */
export async function toUserInfoResolved(user: User): Promise<UserInfo> {
  const info = toUserInfo(user);
  if (!info.currentOrgId) return info;
  info.currentOrgRole = await getMembershipRole(user.id, info.currentOrgId);
  return info;
}

/** Default currency for users who never set one (and for legacy docs). */
export const DEFAULT_CURRENCY = "AUD";

/**
 * Currencies a tutor may charge in. ISO 4217 codes, uppercase.
 * The frontend mirrors this list for its currency selector.
 */
export const SUPPORTED_CURRENCIES = [
  "AUD",
  "USD",
  "EUR",
  "GBP",
  "NZD",
  "CAD",
  "SGD",
  "HKD",
  "INR",
  "ZAR",
  "AED",
] as const;

/** Normalize + validate a raw currency code, falling back to AUD. */
export function normalizeCurrency(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_CURRENCY;
  const code = raw.trim().toUpperCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code)
    ? code
    : DEFAULT_CURRENCY;
}

/**
 * Valid reminder lead-time preferences. The frontend mirrors this for its
 * selector. `null` means automatic reminders are disabled.
 */
export const SUPPORTED_REMINDER_LEAD_TIMES = [
  "1_hour_before",
  "24_hours_before",
  "morning_of",
] as const;

/**
 * Coerce a raw reminder lead time into a valid value. `null` (or anything not
 * in the supported list) disables reminders. The backend only persists this
 * preference — it does not yet schedule or send reminders.
 */
export function normalizeReminderLeadTime(raw: unknown): ReminderLeadTime {
  if (
    typeof raw === "string" &&
    (SUPPORTED_REMINDER_LEAD_TIMES as readonly string[]).includes(raw)
  ) {
    return raw as ReminderLeadTime;
  }
  return null;
}

/**
 * Coerce a raw subjects payload into a clean Subject[]. Drops entries with
 * missing/empty names, trims names, strips non-string colors, and ensures
 * stable unique ids (generating one for any entry missing an id). Caps the
 * catalogue length to keep user documents bounded.
 */
const MAX_SUBJECTS = 100;

export function normalizeSubjects(raw: unknown): Subject[] {
  if (!Array.isArray(raw)) return [];
  const result: Subject[] = [];
  const seenIds = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const name =
      typeof e.name === "string" ? e.name.trim() : "";
    if (!name) continue;
    let id = typeof e.id === "string" && e.id.trim() ? e.id.trim() : "";
    if (!id || seenIds.has(id)) {
      id = generateSubjectId();
    }
    seenIds.add(id);
    const color =
      typeof e.color === "string" && e.color.trim() ? e.color.trim() : null;
    result.push({ id, name, color });
    if (result.length >= MAX_SUBJECTS) break;
  }
  return result;
}

/** Generate a subject id (used when normalizing id-less entries). */
function generateSubjectId(): string {
  return `subj_${crypto.randomBytes(8).toString("hex")}`;
}

/**
 * Get user document from Firestore
 * @param uid - User UID
 * @returns User object from Firestore
 */
export async function getUserFromFirestore(uid: string): Promise<User> {
  try {
    const firestore = getFirebaseFirestore();
    const userDoc = await firestore.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      throw new Error("User not found in Firestore");
    }

    const userData = userDoc.data();

    return {
      id: uid,
      name: userData!.name,
      email: userData!.email,
      role: userData!.role,
      currentOrgId: typeof userData!.currentOrgId === "string" ? userData!.currentOrgId : null,
      avatarUrl: userData!.avatarUrl,
      currency: normalizeCurrency(userData!.currency),
      reminderLeadTime: normalizeReminderLeadTime(userData!.reminderLeadTime),
      workingHours: normalizeWorkingHours(userData!.workingHours),
      subjects: normalizeSubjects(userData!.subjects),
      // Legacy docs created before onboarding existed lack this field; treat
      // anything missing/non-true as incomplete so existing users get prompted.
      onboardingComplete: userData!.onboardingComplete === true,
      tourSeen: userData!.tourSeen === true,
      createdAt: userData!.createdAt.toDate(),
      updatedAt: userData!.updatedAt.toDate(),
      lastActive: userData!.lastActive?.toDate(),
    };
  } catch (error) {
    console.error("Failed to get user from Firestore:", error);
    throw new Error("User not found");
  }
}

/**
 * Update user's last active timestamp
 * @param uid - User UID
 */
export async function updateLastActive(uid: string): Promise<void> {
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      lastActive: new Date(),
    });
  } catch (error) {
    console.error("Failed to update last active:", error);
    // Don't throw - this is a non-critical update
  }
}

export interface TutorRecord {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
  lastActive: Date | null;
  googleConnected: boolean;
  googleEmail: string | null;
}

/**
 * List all tutor accounts. Used by admin surfaces (dashboard overview +
 * tutors management page). System-admin accounts are excluded.
 */
export async function listTutorsFromFirestore(): Promise<TutorRecord[]> {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore
    .collection("users")
    .where("role", "==", "tutor")
    .get();

  const tutors: TutorRecord[] = [];
  snapshot.forEach((doc) => {
    const d = doc.data();
    const conn = d.googleConnection;
    const hasRefresh =
      !!conn && typeof conn.refreshToken === "string" && conn.refreshToken.length > 0;
    tutors.push({
      id: doc.id,
      name: d.name ?? "Unknown",
      email: d.email ?? "",
      avatarUrl: typeof d.avatarUrl === "string" ? d.avatarUrl : null,
      createdAt: d.createdAt?.toDate() ?? new Date(0),
      lastActive: d.lastActive?.toDate() ?? null,
      googleConnected: hasRefresh,
      googleEmail:
        hasRefresh && typeof conn.googleEmail === "string" ? conn.googleEmail : null,
    });
  });
  return tutors;
}

/**
 * Update a user's avatar URL and bump updatedAt.
 * @param uid - User UID
 * @param avatarUrl - New avatar URL (data URL or remote URL), or null to clear
 * @returns Updated User object
 */
export async function updateUserAvatar(
  uid: string,
  avatarUrl: string | null
): Promise<User> {
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      avatarUrl,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return getUserFromFirestore(uid);
  } catch (error) {
    console.error("Failed to update user avatar:", error);
    throw new Error("Failed to update avatar");
  }
}

/**
 * Update a user's display name and bump updatedAt. Trims/validates input.
 * @param uid - User UID
 * @param name - New display name
 * @returns Updated User object
 */
export async function updateUserName(
  uid: string,
  name: string,
): Promise<User> {
  const trimmed = name?.trim();
  if (!trimmed) {
    throw new Error("Name cannot be empty");
  }

  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      name: trimmed,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return getUserFromFirestore(uid);
  } catch (error) {
    console.error("Failed to update user name:", error);
    throw new Error("Failed to update name");
  }
}

/**
 * Update the currency a tutor charges in. The currency is validated against
 * the supported list; invalid values throw.
 * @param uid - User UID
 * @param currency - ISO 4217 code (e.g. "AUD", "USD")
 * @returns Updated User object
 */
export async function updateUserCurrency(
  uid: string,
  currency: string,
): Promise<User> {
  const code = currency?.trim().toUpperCase();
  if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(code)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }

  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      currency: code,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return getUserFromFirestore(uid);
  } catch (error) {
    console.error("Failed to update user currency:", error);
    throw new Error("Failed to update currency");
  }
}

/**
 * Update the tutor's automatic reminder lead-time preference. The backend only
 * stores this value — it does not yet schedule or send reminders. Passing null
 * (or an unsupported value) disables reminders.
 * @param uid - User UID
 * @param leadTime - Valid ReminderLeadTime value, or null to disable
 * @returns Updated User object
 */
export async function updateUserReminderLeadTime(
  uid: string,
  leadTime: ReminderLeadTime,
): Promise<User> {
  const normalized = normalizeReminderLeadTime(leadTime);
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      reminderLeadTime: normalized,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return getUserFromFirestore(uid);
  } catch (error) {
    console.error("Failed to update reminder lead time:", error);
    throw new Error("Failed to update reminder lead time");
  }
}

/**
 * Update the tutor's weekly working-hours preference. Stored only — drives
 * the Schedule's shaded bands and the out-of-hours booking warning on the
 * client. Passing null clears it.
 * @param uid - User UID
 * @param workingHours - Normalized WorkingHours, or null to clear
 * @returns Updated User object
 */
export async function updateUserWorkingHours(
  uid: string,
  workingHours: WorkingHours | null,
): Promise<User> {
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      workingHours: workingHours ?? admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return getUserFromFirestore(uid);
  } catch (error) {
    console.error("Failed to update working hours:", error);
    throw new Error("Failed to update working hours");
  }
}

/**
 * Replace the tutor's subject catalogue. Detects subjects that were removed
 * and cascades: any student of this tutor still tagged with a removed subject
 * id has that id stripped from their `subjectIds` so no dangling references
 * remain.
 * @param uid - User UID
 * @param subjects - Raw subjects payload (normalized server-side)
 * @returns Updated User object
 */
export async function updateUserSubjects(
  uid: string,
  subjects: unknown,
): Promise<User> {
  try {
    const firestore = getFirebaseFirestore();
    const normalized = normalizeSubjects(subjects);

    const userDoc = await firestore.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new Error("User not found");
    }
    const prev = normalizeSubjects(userDoc.data()?.subjects);
    const removedIds = prev
      .map((s) => s.id)
      .filter((id) => !normalized.some((s) => s.id === id));

    await firestore.collection("users").doc(uid).update({
      subjects: normalized,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    // Cascade: strip removed subject ids from the tutor's students.
    for (const removedId of removedIds) {
      const affected = await firestore
        .collection("students")
        .where("tutorId", "==", uid)
        .where("subjectIds", "array-contains", removedId)
        .get();
      if (affected.empty) continue;
      const batch = firestore.batch();
      affected.forEach((doc) => {
        batch.update(doc.ref, {
          subjectIds: admin.firestore.FieldValue.arrayRemove(removedId),
        });
      });
      await batch.commit();
    }

    return getUserFromFirestore(uid);
  } catch (error) {
    console.error("Failed to update user subjects:", error);
    throw new Error("Failed to update subjects");
  }
}

/**
 * Set the user's currently active organisation (org switcher). `orgId` null
 * returns them to personal mode. A non-null orgId must reference an active org
 * the user is a member of, else NotFoundError/ValidationError. Returns the
 * refreshed User; the caller re-issues the access JWT to bake in currentOrgId.
 */
export async function updateUserCurrentOrg(
  uid: string,
  orgId: string | null,
): Promise<User> {
  if (orgId !== null) {
    if (typeof orgId !== "string" || !orgId.trim()) {
      throw new ValidationError("Invalid organisation id");
    }
    const org = await getOrganisationById(orgId);
    if (!org) throw new NotFoundError("Organisation not found");
    const member = await isMember(uid, orgId);
    if (!member) {
      throw new NotFoundError("Organisation not found");
    }
  }

  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      currentOrgId: orgId,
      updatedAt: admin.firestore.Timestamp.now(),
    });
    return getUserFromFirestore(uid);
  } catch (error) {
    console.error("Failed to update current organisation:", error);
    throw new Error("Failed to update current organisation");
  }
}

/**
 * Mark the user's onboarding as finished (they completed or dismissed it).
 * Sets `onboardingComplete: true` and bumps `updatedAt`.
 * @param uid - User UID
 * @returns Updated User object
 */
export async function markOnboardingComplete(uid: string): Promise<User> {
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      onboardingComplete: true,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return getUserFromFirestore(uid);
  } catch (error) {
    console.error("Failed to mark onboarding complete:", error);
    throw new Error("Failed to complete onboarding");
  }
}

/**
 * Mark the in-app product tour as seen (completed or skipped). Sets
 * `tourSeen: true` and bumps `updatedAt`.
 * @param uid - User UID
 * @returns Updated User object
 */
export async function markTourSeen(uid: string): Promise<User> {
  try {
    const firestore = getFirebaseFirestore();
    await firestore.collection("users").doc(uid).update({
      tourSeen: true,
      updatedAt: admin.firestore.Timestamp.now(),
    });

    return getUserFromFirestore(uid);
  } catch (error) {
    console.error("Failed to mark tour seen:", error);
    throw new Error("Failed to mark tour as seen");
  }
}

/**
 * Create user document in Firestore
 * @param id - User ID (Firebase Auth UID)
 * @param email - User email
 * @param name - User display name
 * @param role - User role (defaults to 'tutor')
 * @returns Created user object
 */
export async function createUserInFirestore(
  id: string,
  email: string,
  name: string,
  role: Role = 'tutor',
  avatarUrl: string | null = null,
  currency: string = DEFAULT_CURRENCY,
): Promise<User> {
  try {
    const firestore = getFirebaseFirestore();
    const now = admin.firestore.Timestamp.now();
    const normalizedCurrency = normalizeCurrency(currency);

    const userData = {
      name,
      email,
      role,
      currentOrgId: null,
      avatarUrl,
      currency: normalizedCurrency,
      reminderLeadTime: null,
      subjects: [] as Subject[],
      onboardingComplete: false,
      tourSeen: false,
      createdAt: now,
      updatedAt: now,
      lastActive: now,
    };

    await firestore.collection('users').doc(id).set(userData);

    // Return User object with Date objects (matching getUserFromFirestore pattern)
    return {
      id,
      name,
      email,
      role,
      currentOrgId: null,
      avatarUrl,
      currency: normalizedCurrency,
      reminderLeadTime: null,
      subjects: [],
      onboardingComplete: false,
      tourSeen: false,
      createdAt: now.toDate() as any,
      updatedAt: now.toDate() as any,
      lastActive: now.toDate() as any,
    };
  } catch (error) {
    console.error("Failed to create user in Firestore:", error);
    throw new Error("Failed to create user in Firestore");
  }
}

/**
 * Generate JWT token for user
 * @param user - User object
 * @returns JWT token string
 */
export function generateJWTForUser(user: User): string {
  return generateToken(user.id, user.email, user.role, user.currentOrgId ?? null);
}

export interface GoogleConnection {
  refreshToken: string;
  googleEmail: string | null;
  connectedAt: Date;
}

/**
 * Persist a tutor's Google OAuth connection (refresh token + account email)
 * onto their user document.
 */
export async function setGoogleConnection(
  uid: string,
  data: { refreshToken: string; googleEmail: string },
): Promise<void> {
  const firestore = getFirebaseFirestore();
  await firestore.collection("users").doc(uid).set(
    {
      googleConnection: {
        refreshToken: data.refreshToken,
        googleEmail: data.googleEmail,
        connectedAt: admin.firestore.Timestamp.now(),
      },
      updatedAt: admin.firestore.Timestamp.now(),
    },
    { merge: true },
  );
}

/**
 * Read a tutor's Google OAuth connection, or null if they haven't connected.
 * (Never exposes this to the client — used server-side only for Meet generation.)
 */
export async function getGoogleConnection(
  uid: string,
): Promise<GoogleConnection | null> {
  const firestore = getFirebaseFirestore();
  const snap = await firestore.collection("users").doc(uid).get();
  const conn = snap.data()?.googleConnection;
  if (!conn?.refreshToken) {
    return null;
  }
  return {
    refreshToken: conn.refreshToken,
    googleEmail: conn.googleEmail ?? null,
    connectedAt: conn.connectedAt?.toDate?.() ?? new Date(0),
  };
}

/**
 * Remove a tutor's Google OAuth connection (disconnect).
 */
export async function clearGoogleConnection(uid: string): Promise<void> {
  const firestore = getFirebaseFirestore();
  await firestore
    .collection("users")
    .doc(uid)
    .set(
      { googleConnection: admin.firestore.FieldValue.delete() },
      { merge: true },
    );
}
