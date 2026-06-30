import admin from "firebase-admin";
import { getFirebaseFirestore } from "../config/firebase";
import type {
  Organisation,
  CreateOrganisationRequest,
  UpdateOrganisationRequest,
} from "@examify-tms/interfaces";
import { generateJoinCode } from "../utils/joinCode";
import { NotFoundError, ValidationError } from "../utils/httpError";
import * as orgMemberService from "./orgMemberService";

/**
 * Organisation service.
 *
 * Owns the `organisations` collection: CRUD, join-code generation, and
 * soft-delete. Membership lives in {@link orgMemberService}; this service
 * orchestrates it where org + membership change together (create → first admin,
 * join by code → add member).
 *
 * Soft-delete: `deletedAt != null` means archived. All reads here exclude
 * archived orgs unless `includeDeleted` is passed (system-admin restore, later).
 */

const COLLECTION = "organisations";
const MAX_NAME_LENGTH = 100;
const JOIN_CODE_MAX_ATTEMPTS = 10;

/** Options controlling join-code disclosure and deleted-org visibility. */
interface MapOptions {
  /** Reveal the joinCode (only for org_admin viewers). */
  revealJoinCode?: boolean;
  /** Include soft-deleted orgs (system-admin only). */
  includeDeleted?: boolean;
}

/** Map a Firestore doc to an Organisation, honouring reveal/visibility flags. */
function toOrganisation(
  doc: admin.firestore.DocumentSnapshot,
  opts: MapOptions = {},
): Organisation | null {
  if (!doc.exists) return null;
  const d = doc.data()!;
  return {
    id: doc.id,
    name: d.name,
    logoUrl: typeof d.logoUrl === "string" ? d.logoUrl : null,
    joinCode: opts.revealJoinCode && typeof d.joinCode === "string" ? d.joinCode : null,
    createdBy: d.createdBy,
    deletedAt: d.deletedAt?.toDate?.()?.toISOString?.() ?? null,
    createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? new Date(0).toISOString(),
    updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() ?? new Date(0).toISOString(),
  };
}

/** Get a single org by id (excluding archived unless flagged). */
export async function getOrganisationById(
  orgId: string,
  opts: MapOptions = {},
): Promise<Organisation | null> {
  const firestore = getFirebaseFirestore();
  const doc = await firestore.collection(COLLECTION).doc(orgId).get();
  const org = toOrganisation(doc, opts);
  if (!org) return null;
  if (org.deletedAt && !opts.includeDeleted) return null;
  return org;
}

/**
 * Get an active org or throw NotFoundError. `revealJoinCode` is honoured so
 * org_admin-facing reads can surface the code.
 */
export async function getActiveOrganisation(
  orgId: string,
  opts: MapOptions = {},
): Promise<Organisation> {
  const org = await getOrganisationById(orgId, opts);
  if (!org) throw new NotFoundError("Organisation not found");
  return org;
}

/** Validate + trim an organisation name. */
function normaliseName(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ValidationError("Organisation name is required");
  }
  const name = raw.trim();
  if (!name) throw new ValidationError("Organisation name cannot be empty");
  if (name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(
      `Organisation name must be ${MAX_NAME_LENGTH} characters or fewer`,
    );
  }
  return name;
}

/** Normalise an optional logo URL (null when absent/blank/non-string). */
function normaliseLogoUrl(raw: unknown): string | null {
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Generate a join code that is not currently in use. Retries on collision.
 * Throws if no unique code can be minted within the attempt budget (astronomically unlikely).
 */
async function generateUniqueJoinCode(): Promise<string> {
  const firestore = getFirebaseFirestore();
  for (let attempt = 0; attempt < JOIN_CODE_MAX_ATTEMPTS; attempt++) {
    const code = generateJoinCode();
    const clash = await firestore
      .collection(COLLECTION)
      .where("joinCode", "==", code)
      .limit(1)
      .get();
    if (clash.empty) return code;
  }
  throw new Error("Failed to generate a unique join code");
}

/**
 * Create an organisation. The creator becomes its first org_admin (delegated to
 * orgMemberService). The caller's currentOrgId is NOT changed here — the
 * controller does that + re-issues the JWT. Returns the org with the joinCode
 * revealed (the creator is an admin).
 */
export async function createOrganisation(
  creatorUid: string,
  input: CreateOrganisationRequest,
): Promise<Organisation> {
  const name = normaliseName(input.name);
  const logoUrl = normaliseLogoUrl(input.logoUrl);
  const joinCode = await generateUniqueJoinCode();

  const firestore = getFirebaseFirestore();
  const now = admin.firestore.Timestamp.now();
  const ref = await firestore.collection(COLLECTION).add({
    name,
    logoUrl,
    joinCode,
    createdBy: creatorUid,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  await orgMemberService.addMember(ref.id, creatorUid, "org_admin");

  const created = await getActiveOrganisation(ref.id, { revealJoinCode: true });
  return created;
}

/**
 * List the active organisations the user belongs to (switcher source). The
 * joinCode is never revealed here — members aren't necessarily admins.
 */
export async function listOrganisationsForUser(
  userId: string,
): Promise<Organisation[]> {
  const memberships = await orgMemberService.listMembershipsForUser(userId);
  if (memberships.length === 0) return [];

  const firestore = getFirebaseFirestore();
  const orgRefs = memberships.map((m) =>
    firestore.collection(COLLECTION).doc(m.orgId),
  );
  const docs = await firestore.getAll(...orgRefs);

  const orgs: Organisation[] = [];
  docs.forEach((doc) => {
    const org = toOrganisation(doc);
    if (org && !org.deletedAt) orgs.push(org);
  });
  return orgs;
}

/** Update editable org fields (name, logoUrl). Admin-gating is the controller's job. */
export async function updateOrganisation(
  orgId: string,
  input: UpdateOrganisationRequest,
): Promise<Organisation> {
  const updates: Record<string, unknown> = {
    updatedAt: admin.firestore.Timestamp.now(),
  };
  if (input.name !== undefined) updates.name = normaliseName(input.name);
  if (input.logoUrl !== undefined) updates.logoUrl = normaliseLogoUrl(input.logoUrl);

  const firestore = getFirebaseFirestore();
  await firestore.collection(COLLECTION).doc(orgId).update(updates);
  return getActiveOrganisation(orgId);
}

/** Mint a new join code for the org, invalidating the previous one. */
export async function regenerateJoinCode(orgId: string): Promise<string> {
  const joinCode = await generateUniqueJoinCode();
  const firestore = getFirebaseFirestore();
  await firestore.collection(COLLECTION).doc(orgId).update({
    joinCode,
    updatedAt: admin.firestore.Timestamp.now(),
  });
  return joinCode;
}

/**
 * Soft-delete an org (set deletedAt). Members keep their rows but lose access
 * via the read filters; joins are blocked. Admin-gating is the controller's job.
 * Does NOT cascade to students/lessons/invoices in this milestone.
 */
export async function softDeleteOrganisation(orgId: string): Promise<void> {
  const firestore = getFirebaseFirestore();
  await firestore.collection(COLLECTION).doc(orgId).update({
    deletedAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now(),
  });
}

/** Case-insensitive lookup of an active org by join code. */
export async function findActiveOrgByJoinCode(
  joinCode: string,
): Promise<Organisation | null> {
  if (typeof joinCode !== "string" || !joinCode.trim()) return null;
  const firestore = getFirebaseFirestore();
  const snap = await firestore
    .collection(COLLECTION)
    .where("joinCode", "==", joinCode.trim().toUpperCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  const org = toOrganisation(snap.docs[0]);
  if (!org || org.deletedAt) return null;
  return org;
}

/**
 * Join an org by its code. Idempotent: re-joining an org already a member of
 * returns the existing membership without error. Throws NotFoundError on an
 * unknown / archived-org code. The caller is always added as `member`.
 */
export async function joinOrganisationByCode(
  joinCode: string,
  userId: string,
): Promise<{ organisation: Organisation; created: boolean }> {
  const org = await findActiveOrgByJoinCode(joinCode);
  if (!org) throw new NotFoundError("Invalid or expired join code");

  const { created } = await orgMemberService.joinAsMember(org.id, userId);
  return { organisation: org, created };
}
