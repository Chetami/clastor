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
