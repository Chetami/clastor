/**
 * Feature flags — THE single source of truth for the whole monorepo.
 * Flip a boolean here and it cascades to frontend + backend via the
 * @examify-tms/interfaces package (imported by both).
 */
export const featureFlags = {
  publicProfile: false, // <-- off for now
  templates: true,
  sentEmails: true, // UI + GET endpoints (outbound sends are always logged)
} as const;

export type FeatureFlags = typeof featureFlags;
export type FeatureFlagKey = keyof FeatureFlags;

export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  return featureFlags[key] as boolean;
}
