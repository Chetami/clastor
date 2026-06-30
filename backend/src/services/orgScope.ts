import type { OrgMemberRole } from "@examify-tms/interfaces";
import { getMembershipRole } from "./orgMemberService";
import { getOrganisationById } from "./organisationService";

/**
 * Read scope resolution for organisation-aware data (students/lessons/invoices).
 *
 * Driven by the authenticated user's `currentOrgId` (baked into the JWT) plus
 * their per-org membership role:
 * - personal   — no active org; sees only their own legacy/personal data.
 * - org-admin  — active org where they are an org_admin; sees ALL org data.
 * - org-member — active org where they are a plain member; sees only their own
 *                data within the org.
 *
 * `system_admin` callers bypass this entirely — read services still branch on
 * the global role first (admins see everything). This resolver is for tutor
 * callers only.
 *
 * Defensive fallback: if the JWT's currentOrgId points at an org the user is no
 * longer a member of (or that was soft-deleted), the scope degrades to
 * `personal` rather than leaking data.
 */
export type OrgScope =
  | { mode: "personal" }
  | { mode: "org-admin"; orgId: string; role: OrgMemberRole }
  | { mode: "org-member"; orgId: string; role: OrgMemberRole; userId: string };

export interface ScopedUser {
  uid: string;
  currentOrgId?: string | null;
}

export async function resolveScope(user: ScopedUser): Promise<OrgScope> {
  const orgId = user.currentOrgId;
  if (!orgId) return { mode: "personal" };

  // Guard against stale JWTs pointing at archived orgs.
  const org = await getOrganisationById(orgId);
  if (!org) return { mode: "personal" };

  const role = await getMembershipRole(user.uid, orgId);
  if (!role) return { mode: "personal" };

  if (role === "org_admin") {
    return { mode: "org-admin", orgId, role };
  }
  return { mode: "org-member", orgId, role, userId: user.uid };
}
