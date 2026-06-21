import {
  isFeatureEnabled,
  type FeatureFlagKey,
  type ApiError,
} from "@examify-tms/interfaces";
import type { RequestHandler } from "express";

/**
 * Guard that 404s a route when its feature flag is disabled, so disabled
 * features are indistinguishable from a non-existent route.
 */
export const requireFeature =
  (key: FeatureFlagKey): RequestHandler =>
  (_req, res, next) => {
    if (!isFeatureEnabled(key)) {
      return res.status(404).json({ message: "Feature unavailable" } as ApiError);
    }
    next();
  };
