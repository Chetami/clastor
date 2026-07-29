/**
 * @examify-tms/shared
 *
 * Platform-agnostic data layer shared by the web (Vite/React) and mobile
 * (Expo/React Native) clients. Contains the axios API client, Zustand auth
 * store, TanStack Query client, every feature's request modules + hooks, and
 * assorted utils — everything except UI and platform-specific auth (Firebase).
 *
 * An app must call `configureShared()` once at bootstrap before importing any
 * hook that touches the network.
 */

// ---- Platform abstraction ----
export { configureShared, isSharedConfigured, getStorage, getApiBaseUrl } from "./runtime";
export type { SharedConfig } from "./runtime";
export type { StorageAdapter } from "./config/storage-adapter";
export { TOKEN_KEY, REFRESH_TOKEN_KEY } from "./config/tokens";

// ---- API client & query client ----
export { api } from "./lib/api";
export { queryClient } from "./lib/query-client";

// ---- Lib utils ----
export { cn } from "./lib/utils";
export { useUserCurrency, getCurrencySymbol } from "./lib/use-currency";
export {
  TIMEZONES,
  TIMEZONE_INFOS,
  getTimezoneInfo,
  groupTimezonesByRegion,
  currentTimeInZone,
  detectBrowserTimezone,
} from "./lib/timezones";
export type { TimezoneInfo } from "./lib/timezones";
export {
  useSubjects,
  useSubjectMap,
  resolveSubjectNames,
  generateSubjectId,
} from "./lib/subjects";

// ---- Auth store ----
export { useAuthStore } from "./store/auth-store";

// ---- Feature: auth ----
export {
  exchangeFirebaseToken,
  verifyRequest,
  refreshRequest,
  revokeRefreshToken,
  useVerifyToken,
} from "./features/auth/api";

// ---- Feature: dashboard ----
// `generateMeetLinkRequest` and `recordAttendanceRequest` are also defined in
// the schedule feature (identical implementations); they are re-exported via
// schedule below, so here we only surface dashboard's unique exports to avoid
// a duplicate-export error.
export {
  useDashboardSummary,
  useGenerateMeetLink,
  useMarkLessonDone,
  getDashboardSummaryRequest,
} from "./features/dashboard/api";

// ---- Feature: schedule ----
export * from "./features/schedule/api";

// ---- Feature: students ----
export * from "./features/students/api";

// ---- Feature: payments ----
export * from "./features/payments/api";

// ---- Feature: lessons (via schedule) ----
export * from "./features/emails/api";
export * from "./features/feedback/api";
export * from "./features/templates/api";
export * from "./features/tutor-profile/api";
export * from "./features/public-tutor/api";
export * from "./features/onboarding/api";
export * from "./features/tour/api";
export * from "./features/subjects/api";
export * from "./features/settings/api";
export * from "./features/stripe-payments/api";
export * from "./features/admin-dashboard/api";
export * from "./features/admin-tutors/api";
