/**
 * Query-param Zod schemas for GET endpoints whose query params benefit from
 * validation (enums / required date bounds). List endpoints with complex
 * optional filtering keep their defensive parsing in-controller; this file
 * covers the clear-cut cases.
 */
import { z } from "zod";

const dashboardPeriodSchema = z.enum(["week", "month", "six_months", "year"]);

/**
 * Dashboard / admin `?period=` query. Defaults to "week" when omitted or
 * invalid (preserving the prior tolerant behaviour) but normalises the value
 * so the controller receives a typed `DashboardPeriod`.
 */
export const periodQuerySchema = z.object({
  period: dashboardPeriodSchema.catch("week").default("week"),
});

/**
 * Calendar events window `?from=&to=` query — both bounds are required and
 * must parse as dates.
 */
const isoQueryDate = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Must be a valid ISO date");

export const calendarEventsQuerySchema = z.object({
  from: isoQueryDate,
  to: isoQueryDate,
});
