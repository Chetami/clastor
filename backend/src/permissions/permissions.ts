import { Role } from "@examify-tms/interfaces";
import { Request } from "express";

export const isUserSysAdmin = (role?: Role): boolean => {
  return role === "system_admin";
};

export const isUserTutor = (role?: Role): boolean => {
  return role === "tutor";
};

export const isSameUser = (targetUserId: string, userId?: string): boolean => {
  return targetUserId === userId;
};

/**
 * Generic ownership check for any tutor-owned entity (lesson, student,
 * invoice, series…). System admins bypass the check; everyone else must be
 * the entity's owner. The per-entity `canView|canEdit|canDelete` helpers all
 * delegate here so the authorization rule lives in exactly one place.
 */
export const canAccessOwned = (
  entity: { tutorId: string },
  req?: Request,
): boolean => {
  if (isUserSysAdmin(req?.user?.role)) {
    return true;
  }
  return isSameUser(entity.tutorId, req?.user?.uid);
};
