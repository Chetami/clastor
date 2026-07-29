const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// The mobile app lives inside an npm workspaces monorepo, so Metro needs to
// know to look in the repo-root `node_modules` (where hoisted deps like
// `@examify-tms/shared`, axios, zustand and react-query end up) in addition
// to its own.
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = false;

// NOTE: do NOT enable `unstable_enablePackageExports` here. `expo-router` ships
// an EMPTY `exports` map (and no `./entry` subpath), so enforcing package
// exports makes the dev server fail to resolve `expo-router/entry` and fall
// back to the default `expo/AppEntry.js` (→ "Unable to resolve ../../App").
// The shared package resolves fine without it via its `main` field; Metro's
// transformer handles its ESM output regardless of the resolution mode.


// ── Single-React guarantee ────────────────────────────────────────────────
// This is a workspaces monorepo where the other apps use a different React
// patch (e.g. 19.2.8) than the one RN/Expo pins for mobile (19.2.3). Without
// this, a hoisted package (e.g. @tanstack/react-query) could resolve React
// from the repo root while the app resolves its own, shipping TWO React
// copies in the bundle → "Invalid hook call" at runtime. Pin every React
// import to the mobile copy.
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-dom": path.resolve(projectRoot, "node_modules/react-dom"),
};

module.exports = config;
