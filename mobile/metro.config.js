const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

/** Absolute paths — the mobile app lives inside an npm-workspaces monorepo. */
const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

let config = getDefaultConfig(projectRoot);

// ── NativeWind: compile Tailwind classes at build time ───────────────────────
config = withNativeWind(config, { input: "./global.css" });

// ── Monorepo: let Metro resolve & transpile workspace packages ───────────────
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

// ── Mock react-native-reanimated ─────────────────────────────────────────────
// We don't use animations, but react-native-css-interop (NativeWind's engine)
// has a lazy require() for it. If the real module loads, its worklets JSI proxy
// crashes Expo Go 57 on Apple Silicon. This mock prevents it from ever loading.
const reanimatedMock = path.resolve(projectRoot, "src/mocks/empty-reanimated.js");
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "react-native-reanimated" ||
    moduleName === "react-native-worklets"
  ) {
    return { filePath: reanimatedMock, type: "sourceFile" };
  }
  return originalResolveRequest(context, moduleName, platform);
};

module.exports = config;
