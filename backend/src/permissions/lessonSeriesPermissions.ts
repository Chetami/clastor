import { Request } from "express";
import * as permissions from "./permissions";
import { LessonSeries } from "@examify-tms/interfaces";

/**
 * Lesson Series Permissions
 *
 * - System admins can access any series
 * - Tutors can only access their own series
 */

export const canViewSeries = (series: LessonSeries, req?: Request): boolean => {
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }
  return permissions.isSameUser(series.tutorId, req?.user?.uid);
};

export const canEditSeries = (series: LessonSeries, req?: Request): boolean => {
  if (permissions.isUserSysAdmin(req?.user?.role)) {
    return true;
  }
  return permissions.isSameUser(series.tutorId, req?.user?.uid);
};
