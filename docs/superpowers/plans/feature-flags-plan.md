Feature Flags System

   Context                                                                                                        ↑

   There is currently no way to toggle whole features on/off across the monorepo. The user wants a single boolean in one place that cascades through the frontend, backend, and shared types — and the public profile feature (currently partially built on the invoice branch) should be flipped off for now.

   Today the interfaces package ships only a generated dist/index.d.ts (type-only — every import { X } from "@examify-tms/interfaces" is type-only and gets elided at compile time). To host a runtime flag value shared by both apps, we extend that package to also emit a small runtime module. That keeps the single source of truth in the one package both apps already depend on.
                                                                                                                  ↑
   Flag scope (confirmed): publicProfile disables the public tutor page (/t/:slug), the /profile editor route + its sidebar nav item, and the backend GET /api/tutor-profiles/public/:slug endpoint. Stripe and /pay/* stay fully working.                                                                                                       ↑

   Design

   1. interfaces — single source of truth + runtime build

   New file interfaces/src/featureFlags.ts (the one place to flip booleans):
   /**
    * Feature flags — THE single source of truth for the whole monorepo.
    * Flip a boolean here and it cascades to frontend + backend via the
    * @examify-tms/interfaces package (imported by both).
    */
   export const featureFlags = {
     publicProfile: false, // <-- off for now
   } as const;

   export type FeatureFlags = typeof featureFlags;
   export type FeatureFlagKey = keyof FeatureFlags;

   export function isFeatureEnabled(key: FeatureFlagKey): boolean {
     return featureFlags[key] === true;
   }

   New interfaces/tsconfig.json — compiles only the flags module to CJS (matches backend's module: commonjs), emitting dist/featureFlags.js + dist/featureFlags.d.ts. Leaves the openapi-generated dist/index.d.ts untouched.
   - target: ES2020, module: commonjs, moduleResolution: node, declaration: true, outDir: dist, include: ["src/featureFlags.ts"].

   Extend interfaces/scripts/add-reexports.js to also:
   1. Append export * from "./featureFlags"; to dist/index.d.ts so the flag types are reachable from the package's declared entry (the types field).
   2. Write dist/index.js as a CJS barrel: module.exports = require("./featureFlags");

   interfaces/package.json:
   - Add "main": "dist/index.js" (enables runtime resolution; types already points to dist/index.d.ts).
   - Add "build:flags": "tsc -p tsconfig.json" and append && npm run build:flags to build (after build:reexports). postinstall already runs build, so installs/rebuilds pick it up.

   2. Frontend — consume the flag

   export {                                                                                                       ↑
     featureFlags,
     isFeatureEnabled,
     type FeatureFlagKey,
   } from "@examify-tms/interfaces";

   frontend/src/config/nav.ts — add optional feature?: FeatureFlagKey to NavItem, tag the "Public Profile" item with feature: "publicProfile", and filter at export so disabled features drop out of the sidebar:
   export const navItems = allNavItems.filter(
     (item) => !item.feature || isFeatureEnabled(item.feature),
   );

   frontend/src/routes/index.tsx — gate the two public-profile routes with conditional spread (omit them entirely when off, so they 404):
 - { path: "profile", element: <TutorProfileEditor /> } (inside DashboardLayout children)
 - { path: "t/:slug", element: <PublicTutorPage /> } (top-level)

   Use ...(isFeatureEnabled("publicProfile") ? [{ ... }] : []). Leave /pay/*, /login, /signup, and all protected utes untouched.

 Backend — gate the public endpoint

   New backend/src/middleware/featureFlags.ts — small guard factory:
   import { isFeatureEnabled, FeatureFlagKey, ApiError } from "@examify-tms/interfaces";
 import { RequestHandler } from "express";

   export const requireFeature = (key: FeatureFlagKey): RequestHandler => (_req, res, next) => {
     if (!isFeatureEnabled(key)) {
     return res.status(404).json({ message: "Feature unavailable" } as ApiError);
   }
     next();
   };

 backend/src/routes/tutorProfileRoutes.ts — apply only to the public route (line 18):
 router.get("/public/:slug", requireFeature("publicProfile"), getPublicProfile);
   The authenticated /me, /check-slug, publish/unpublish endpoints stay as-is — harmless when the UI is hidden, no need to gate them.

 Files touched

 - New: interfaces/src/featureFlags.ts, interfaces/tsconfig.json, frontend/src/config/features.ts, backend/src/middleware/featureFlags.ts
   - Edit: interfaces/scripts/add-reexports.js, interfaces/package.json, frontend/src/config/nav.ts, frontend/src/routes/index.tsx, backend/src/routes/tutorProfileRoutes.ts

 Verification

   1. cd interfaces && npm run build — confirm dist/featureFlags.js, dist/featureFlags.d.ts, and dist/index.js exist; dist/index.d.ts ends with the export * from "./featureFlags" line.
   2. cd backend && npx tsc --noEmit — typechecks; importing isFeatureEnabled resolves at runtime.
 3. cd frontend && npx tsc --noEmit then npm run dev — confirm: no "Public Profile" in sidebar, navigating to /profile and /t/anything shows NotFound.
   4. npm run dev:backend — GET /api/tutor-profiles/public/any-slug returns 404 { message: "Feature unavailable" }; /api/tutor-profiles/me still requires auth (unchanged).
   5. Flip check — temporarily set publicProfile: true in interfaces/src/featureFlags.ts, rebuild interfaces, and confirm the nav item + routes reappear and the public endpoint serves again. Revert to false.

 Future (not in this change)

   Adding a new flag = add a key to featureFlags in interfaces/src/featureFlags.ts, then tag the route/nav/backend-middleware with requireFeature("newFlag") / feature: "newFlag". Optional env override can be yered onto isFeatureEnabled later if per-environment toggling is needed.            