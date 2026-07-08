import { api } from "@/lib/api";
import type {
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
} from "@examify-tms/interfaces";

/** Response from creating an org: the org + a re-issued access token + user. */
export interface CreateOrganisationApiResult {
  organisation: Organisation;
  user: UserInfo;
  token: string;
}

/** Response from switching active org via PATCH /users/me { currentOrgId }. */
export interface SwitchOrgApiResult {
  user: UserInfo;
  token: string;
}

/** Response from joining an org by code. */
export interface JoinOrganisationApiResult {
  organisation: Organisation;
  created: boolean;
}

export async function createOrganisationRequest(
  data: CreateOrganisationRequest,
): Promise<CreateOrganisationApiResult> {
  const res = await api.post<CreateOrganisationApiResult>(
    "/api/organisations",
    data,
  );
  return res.data;
}

export async function listOrganisationsRequest(): Promise<Organisation[]> {
  const res = await api.get<OrganisationListResponse>("/api/organisations");
  return res.data.organisations;
}

export async function getOrganisationRequest(
  orgId: string,
): Promise<Organisation> {
  const res = await api.get<OrganisationResponse>(`/api/organisations/${orgId}`);
  return res.data.organisation;
}

export async function updateOrganisationRequest(
  orgId: string,
  data: UpdateOrganisationRequest,
): Promise<Organisation> {
  const res = await api.patch<OrganisationResponse>(
    `/api/organisations/${orgId}`,
    data,
  );
  return res.data.organisation;
}

export async function deleteOrganisationRequest(orgId: string): Promise<void> {
  await api.delete(`/api/organisations/${orgId}`);
}

export async function regenerateJoinCodeRequest(
  orgId: string,
): Promise<string> {
  const res = await api.post<{ joinCode: string }>(
    `/api/organisations/${orgId}/regenerate-code`,
  );
  return res.data.joinCode;
}

export async function listMembersRequest(
  orgId: string,
): Promise<OrganisationMemberListResponse["members"]> {
  const res = await api.get<OrganisationMemberListResponse>(
    `/api/organisations/${orgId}/members`,
  );
  return res.data.members;
}

export async function updateMemberRoleRequest(
  orgId: string,
  userId: string,
  role: OrgMemberRole,
): Promise<void> {
  await api.patch(`/api/organisations/${orgId}/members/${userId}`, { role });
}

export async function removeMemberRequest(
  orgId: string,
  userId: string,
): Promise<void> {
  await api.delete(`/api/organisations/${orgId}/members/${userId}`);
}

export async function joinOrganisationRequest(
  data: JoinOrganisationRequest,
): Promise<JoinOrganisationApiResult> {
  const res = await api.post<JoinOrganisationApiResult>(
    "/api/organisations/join",
    data,
  );
  return res.data;
}

/**
 * Switch the caller's active organisation (null = personal mode). Returns a
 * re-issued access JWT with the new currentOrgId baked in + the updated user.
 * The refresh token is unchanged.
 */
export async function switchActiveOrgRequest(
  organisationId: string | null,
): Promise<SwitchOrgApiResult> {
  const res = await api.patch<SwitchOrgApiResult>("/api/users/me", {
    currentOrgId: organisationId,
  });
  return res.data;
}

export type { UpdateMemberRoleRequest };
