import admin from "firebase-admin";
import { getFirebaseFirestore } from "../config/firebase";
import type { OrgMemberRole, OrganisationMember } from "@examify-tms/interfaces";
import { ForbiddenError, NotFoundError, ConflictError } from "../utils/httpError";

/**
 * Organisation membership service.
 *
 * Owns the `orgMembers` collection (the user↔org join table). Per-org roles
 * (`org_admin` | `member`) live here — they are NOT global user roles. This
 * service intentionally queries the `users` collection directly for member
 * summaries (name/email/avatar) rather than importing userService, to avoid a
 * circular dependency (userService resolves the current org role through here).
 */

const COLLECTION = "orgMembers";

/** Raw membership document as stored in Firestore. */
export interface MembershipDoc {
  id: string;
  orgId: string;
  userId: string;
  role: OrgMemberRole;
  joinedAt: Date;
}

/** Membership role for a user within an org, or null if they aren't a member. */
export async function getMembershipRole(
  userId: string,
  orgId: string,
): Promise<OrgMemberRole | null> {
  const m = await getMembership(userId, orgId);
  return m?.role ?? null;
}

/** Fetch a user's membership in an org, or null if none. */
export async function getMembership(
  userId: string,
  orgId: string,
): Promise<MembershipDoc | null> {
  const firestore = getFirebaseFirestore();
  const snap = await firestore
    .collection(COLLECTION)
    .where("orgId", "==", orgId)
    .where("userId", "==", userId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return toMembership(snap.docs[0]);
}

function toMembership(
  doc: admin.firestore.QueryDocumentSnapshot | admin.firestore.DocumentSnapshot,
): MembershipDoc {
  const d = doc.data()!;
  return {
    id: doc.id,
    orgId: d.orgId,
    userId: d.userId,
    role: d.role === "org_admin" ? "org_admin" : "member",
    joinedAt: d.joinedAt?.toDate?.() ?? new Date(0),
  };
}

/** True if the user is any kind of member of the org. */
export async function isMember(
  userId: string,
  orgId: string,
): Promise<boolean> {
  return (await getMembership(userId, orgId)) !== null;
}

/**
 * Throw ForbiddenError unless the user is an org_admin of the org, or
 * NotFoundError if they aren't a member at all. Used to guard org-admin-only
 * endpoints (edit org, manage members, regenerate code, delete).
 */
export async function requireOrgAdmin(
  userId: string,
  orgId: string,
): Promise<void> {
  const role = await getMembershipRole(userId, orgId);
  if (role === null) {
    throw new NotFoundError("Organisation not found");
  }
  if (role !== "org_admin") {
    throw new ForbiddenError("Organisation admin privileges required");
  }
}

/** Number of org_admins in an org (used for last-admin lockout checks). */
export async function countOrgAdmins(orgId: string): Promise<number> {
  const firestore = getFirebaseFirestore();
  const snap = await firestore
    .collection(COLLECTION)
    .where("orgId", "==", orgId)
    .where("role", "==", "org_admin")
    .get();
  return snap.size;
}

/** Add a user to an org with the given role. Throws ConflictError if already a member. */
export async function addMember(
  orgId: string,
  userId: string,
  role: OrgMemberRole,
): Promise<MembershipDoc> {
  const existing = await getMembership(userId, orgId);
  if (existing) {
    throw new ConflictError("User is already a member of this organisation");
  }
  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();
  const ref = await firestore.collection(COLLECTION).add({
    orgId,
    userId,
    role,
    joinedAt: now,
  });
  return { id: ref.id, orgId, userId, role, joinedAt: now.toDate() };
}

/**
 * Idempotent join: add the user as `member` if not already a member, otherwise
 * return the existing membership. Returns `{ member, created }`.
 */
export async function joinAsMember(
  orgId: string,
  userId: string,
): Promise<{ member: MembershipDoc; created: boolean }> {
  const existing = await getMembership(userId, orgId);
  if (existing) return { member: existing, created: false };
  const member = await addMember(orgId, userId, "member");
  return { member, created: true };
}

/**
 * Change a member's per-org role. Forbids reducing the org's admin count below
 * 1 (demoting/removing the last org_admin would lock everyone out).
 */
export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: OrgMemberRole,
): Promise<void> {
  const current = await getMembership(userId, orgId);
  if (!current) {
    throw new NotFoundError("Member not found");
  }
  // Guard against locking the org out of admin access.
  if (current.role === "org_admin" && role !== "org_admin") {
    const adminCount = await countOrgAdmins(orgId);
    if (adminCount <= 1) {
      throw new ConflictError(
        "Cannot demote the last organisation admin; promote another member first",
      );
    }
  }

  const firestore = getFirebaseFirestore();
  await firestore
    .collection(COLLECTION)
    .doc(current.id)
    .update({ role });
}

/**
 * Remove a member from an org. Applies the same last-admin lockout guard:
 * removing the last org_admin is forbidden. (Members cannot self-leave per the
 * spec — but this service is role-agnostic; the controller enforces that the
 * caller is an org_admin.)
 */
export async function removeMember(
  orgId: string,
  userId: string,
): Promise<void> {
  const current = await getMembership(userId, orgId);
  if (!current) {
    throw new NotFoundError("Member not found");
  }
  if (current.role === "org_admin") {
    const adminCount = await countOrgAdmins(orgId);
    if (adminCount <= 1) {
      throw new ConflictError(
        "Cannot remove the last organisation admin; promote another member first",
      );
    }
  }

  const firestore = getFirebaseFirestore();
  await firestore.collection(COLLECTION).doc(current.id).delete();
}

/** Every membership the user holds (for the switcher + scope resolution). */
export async function listMembershipsForUser(
  userId: string,
): Promise<MembershipDoc[]> {
  const firestore = getFirebaseFirestore();
  const snap = await firestore
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .get();
  return snap.docs.map(toMembership);
}

/** All members of an org, with denormalised user summaries for list UIs. */
export async function listMembers(
  orgId: string,
): Promise<OrganisationMember[]> {
  const firestore = getFirebaseFirestore();
  const snap = await firestore
    .collection(COLLECTION)
    .where("orgId", "==", orgId)
    .get();

  const memberships = snap.docs.map(toMembership);
  if (memberships.length === 0) return [];

  // Batch-fetch the member user docs for name/email/avatar summaries.
  const userRefs = memberships.map((m) =>
    firestore.collection("users").doc(m.userId),
  );
  const userDocs = await firestore.getAll(...userRefs);
  const userById = new Map<string, { name: string; email: string; avatarUrl: string | null }>();
  userDocs.forEach((doc) => {
    if (!doc.exists) return;
    const d = doc.data()!;
    userById.set(doc.id, {
      name: typeof d.name === "string" ? d.name : "Unknown",
      email: typeof d.email === "string" ? d.email : "",
      avatarUrl: typeof d.avatarUrl === "string" ? d.avatarUrl : null,
    });
  });

  return memberships.map((m) => {
    const u = userById.get(m.userId);
    return {
      id: m.id,
      orgId: m.orgId,
      userId: m.userId,
      role: m.role,
      name: u?.name ?? "Unknown",
      email: u?.email ?? "",
      avatarUrl: u?.avatarUrl ?? null,
      joinedAt: m.joinedAt.toISOString(),
    };
  });
}
