import { Request } from "express";
import { canAccessOwned } from "./permissions";
import { LessonSeries } from "@examify-tms/interfaces";

/**
 * Lesson Series Permissions
 *
 * - System admins can access any series
 * - Tutors can only access their own series
 */

export const canViewSeries = (series: LessonSeries, req?: Request): boolean =>
  canAccessOwned(series, req);

export const canEditSeries = (series: LessonSeries, req?: Request): boolean =>
  canAccessOwned(series, req);
