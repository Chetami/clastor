import { Request, Response } from "express";
import {
  Organisation,
  OrganisationResponse,
  OrganisationListResponse,
  OrganisationMemberListResponse,
  CreateOrganisationRequest,
  UpdateOrganisationRequest,
  JoinOrganisationRequest,
  UpdateMemberRoleRequest,
  OrgMemberRole,
  UserInfo,
  ApiError,
} from "@examify-tms/interfaces";
import * as organisationService from "../services/organisationService";
import * as orgMemberService from "../services/orgMemberService";
import {
  updateUserCurrentOrg,
  generateJWTForUser,
  toUserInfoResolved,
} from "../services/userService";
import { HttpError } from "../utils/httpError";

/** Response for create + switch: the org plus a re-issued access token + user. */
interface CreateOrganisationResponse {
  organisation: Organisation;
  user: UserInfo;
  token: string;
}

/** Response for a join: the org plus whether a new membership was created. */
interface JoinOrganisationResponse {
  organisation: Organisation;
  created: boolean;
}

/** Response for regenerate-code: the new join code. */
interface JoinCodeResponse {
  joinCode: string;
}

/**
 * Map a thrown error to a response. HttpError subclasses carry their own status;
 * anything else is a 500. Returns true when handled.
 */
function sendError(
  res: Response<ApiError>,
  error: unknown,
  fallback: string,
): boolean {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message });
    return true;
  }
  console.error(fallback + ":", error);
  res.status(500).json({ message: fallback });
  return true;
}

/**
 * POST /api/organisations
 * Create an organisation. The caller becomes its first org_admin, is switched
 * into it (currentOrgId set), and receives a fresh access JWT with that org
 * baked in. joinCode is revealed (the creator is an admin).
 */
export async function createOrganisation(
  req: Request<{}, {}, CreateOrganisationRequest>,
  res: Response<CreateOrganisationResponse | ApiError>,
): Promise<void> {
  try {
    const uid = req.user!.uid;
    const organisation = await organisationService.createOrganisation(uid, req.body);

    // Auto-switch the creator into the new org + re-issue the access token.
    const user = await updateUserCurrentOrg(uid, organisation.id);
    const token = generateJWTForUser(user);

    res.status(201).json({
      organisation,
      user: await toUserInfoResolved(user),
      token,
    });
  } catch (error) {
    sendError(res, error, "Failed to create organisation");
  }
}

/**
 * GET /api/organisations
 * List the active organisations the caller belongs to (org switcher source).
 */
export async function listMyOrganisations(
  req: Request,
  res: Response<OrganisationListResponse | ApiError>,
): Promise<void> {
  try {
    const organisations = await organisationService.listOrganisationsForUser(
      req.user!.uid,
    );
    res.status(200).json({ organisations });
  } catch (error) {
    sendError(res, error, "Failed to list organisations");
  }
}

/**
 * GET /api/organisations/:orgId
 * Get an organisation the caller is a member of. joinCode is revealed only to
 * org_admins; non-members get a 404 (no existence leak).
 */
export async function getOrganisation(
  req: Request,
  res: Response<OrganisationResponse | ApiError>,
): Promise<void> {
  try {
    const { orgId } = req.params;
    const uid = req.user!.uid;

    const role = await orgMemberService.getMembershipRole(uid, orgId);
    if (!role) {
      res.status(404).json({ message: "Organisation not found" });
      return;
    }

    const organisation = await organisationService.getActiveOrganisation(orgId, {
      revealJoinCode: role === "org_admin",
    });
    res.status(200).json({ organisation });
  } catch (error) {
    sendError(res, error, "Failed to get organisation");
  }
}

/**
 * PATCH /api/organisations/:orgId
 * Edit name/logoUrl. org_admin only; joinCode revealed in the response.
 */
export async function updateOrganisation(
  req: Request<{ orgId: string }, {}, UpdateOrganisationRequest>,
  res: Response<OrganisationResponse | ApiError>,
): Promise<void> {
  try {
    const { orgId } = req.params;
    await orgMemberService.requireOrgAdmin(req.user!.uid, orgId);
    const organisation = await organisationService.updateOrganisation(orgId, req.body);
    res.status(200).json({ organisation });
  } catch (error) {
    sendError(res, error, "Failed to update organisation");
  }
}

/**
 * DELETE /api/organisations/:orgId
 * Soft-delete (archive) the org. org_admin only.
 */
export async function deleteOrganisation(
  req: Request,
  res: Response<ApiError>,
): Promise<void> {
  try {
    const { orgId } = req.params;
    await orgMemberService.requireOrgAdmin(req.user!.uid, orgId);
    await organisationService.softDeleteOrganisation(orgId);
    res.status(204).send();
  } catch (error) {
    sendError(res, error, "Failed to delete organisation");
  }
}

/**
 * POST /api/organisations/:orgId/regenerate-code
 * Mint a new join code (invalidates the old one). org_admin only.
 */
export async function regenerateJoinCode(
  req: Request,
  res: Response<JoinCodeResponse | ApiError>,
): Promise<void> {
  try {
    const { orgId } = req.params;
    await orgMemberService.requireOrgAdmin(req.user!.uid, orgId);
    const joinCode = await organisationService.regenerateJoinCode(orgId);
    res.status(200).json({ joinCode });
  } catch (error) {
    sendError(res, error, "Failed to regenerate join code");
  }
}

/**
 * GET /api/organisations/:orgId/members
 * List members of an org (with user summaries). Visible to any member; role
 * changes are org_admin-only.
 */
export async function listMembers(
  req: Request,
  res: Response<OrganisationMemberListResponse | ApiError>,
): Promise<void> {
  try {
    const { orgId } = req.params;
    const isMember = await orgMemberService.isMember(req.user!.uid, orgId);
    if (!isMember) {
      res.status(404).json({ message: "Organisation not found" });
      return;
    }
    const members = await orgMemberService.listMembers(orgId);
    res.status(200).json({ members });
  } catch (error) {
    sendError(res, error, "Failed to list members");
  }
}

/**
 * PATCH /api/organisations/:orgId/members/:userId
 * Change a member's per-org role. org_admin only; last-admin lockout is
 * enforced in the service.
 */
export async function updateMemberRole(
  req: Request<{ orgId: string; userId: string }, {}, UpdateMemberRoleRequest>,
  res: Response<ApiError>,
): Promise<void> {
  try {
    const { orgId, userId } = req.params;
    await orgMemberService.requireOrgAdmin(req.user!.uid, orgId);
    await orgMemberService.updateMemberRole(orgId, userId, req.body.role as OrgMemberRole);
    res.status(204).send();
  } catch (error) {
    sendError(res, error, "Failed to update member role");
  }
}

/**
 * DELETE /api/organisations/:orgId/members/:userId
 * Remove a member from the org. org_admin only; last-admin lockout enforced.
 * (Members cannot self-leave — only an admin can remove, including themselves.)
 */
export async function removeMember(
  req: Request<{ orgId: string; userId: string }>,
  res: Response<ApiError>,
): Promise<void> {
  try {
    const { orgId, userId } = req.params;
    await orgMemberService.requireOrgAdmin(req.user!.uid, orgId);
    await orgMemberService.removeMember(orgId, userId);
    res.status(204).send();
  } catch (error) {
    sendError(res, error, "Failed to remove member");
  }
}

/**
 * POST /api/organisations/join
 * Join an org by its code (added as `member`). Idempotent. Does NOT auto-switch
 * the caller's active org — they switch separately via PATCH /users/me.
 */
export async function joinOrganisation(
  req: Request<{}, {}, JoinOrganisationRequest>,
  res: Response<JoinOrganisationResponse | ApiError>,
): Promise<void> {
  try {
    const { organisation, created } = await organisationService.joinOrganisationByCode(
      req.body.joinCode,
      req.user!.uid,
    );
    res.status(created ? 201 : 200).json({ organisation, created });
  } catch (error) {
    sendError(res, error, "Failed to join organisation");
  }
}
