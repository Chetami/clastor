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
export { cn, getInitials } from "./lib/utils";
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
  exchangeGoogleFirebaseToken,
  verifyRequest,
  refreshRequest,
  revokeRefreshToken,
  useVerifyToken,
} from "./features/auth/api";

// ---- Feature: schedule ----
export * from "./features/schedule/api";
export * from "./features/schedule/event-schema";
export * from "./features/schedule/working-hours";

// ---- Feature: lessons (domain utils; schedule owns the API hooks above) ----
export * from "./features/lessons/lesson-utils";
export * from "./features/lessons/lesson-series-utils";

// ---- Feature: dashboard ----
export * from "./features/dashboard/api";
export * from "./features/dashboard/lib";

// ---- Feature: account (mirrors backend enums) ----
export * from "./features/account/currency-options";
export * from "./features/account/reminder-options";

// ---- Feature: students ----
export * from "./features/students/api";
export * from "./features/students/student-schema";
export * from "./features/students/student-utils";

// ---- Feature: payments ----
export * from "./features/payments/api";
export * from "./features/payments/invoice-config";
export * from "./features/payments/invoice-schema";
export * from "./features/payments/invoice-utils";

// ---- Feature: lessons (via schedule) ----
export * from "./features/emails/api";
export * from "./features/emails/review-contexts";
export * from "./features/feedback/api";
export * from "./features/templates/api";
export * from "./features/tutor-profile/api";
export * from "./features/public-tutor/api";
export {
  getCtaLabel,
  formatRate as formatProfileRate,
} from "./features/public-tutor/profile-utils";
export * from "./features/onboarding/api";
export * from "./features/tour/api";
export * from "./features/subjects/api";
export * from "./features/settings/api";
export * from "./features/stripe-payments/api";
export * from "./features/admin-dashboard/api";
export * from "./features/admin-tutors/api";
