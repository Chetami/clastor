import type { FeatureFlagKey, ApiError } from "@examify-tms/interfaces";
import type { RequestHandler } from "express";

// Local mirror of interfaces/src/featureFlags.ts. The backend must NOT take a
// runtime dependency on @examify-tms/interfaces (it isn't on the npm registry
// and isn't shipped to the server), so every import here is type-only and gets
// erased by tsc. Keep these values in sync with the source of truth in
// interfaces/src/featureFlags.ts (which the frontend reads at runtime).
const backendFeatureFlags: Record<FeatureFlagKey, boolean> = {
  publicProfile: false,
  templates: false,
  sentEmails: false,
};

/**
 * Guard that 404s a route when its feature flag is disabled, so disabled
 * features are indistinguishable from a non-existent route.
 */
export const requireFeature =
  (key: FeatureFlagKey): RequestHandler =>
  (_req, res, next) => {
    if (!backendFeatureFlags[key]) {
      return res.status(404).json({ message: "Feature unavailable" } as ApiError);
    }
    next();
  };
