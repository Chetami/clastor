/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Vitest configuration, kept separate from vite.config.ts so the production
// build pipeline is untouched. Mirrors the same `@` alias and React plugin so
// tests resolve modules exactly the way the app does.
export default defineConfig({
  plugins: [react()],
  define: {
    // vite.config.ts derives this from git; in tests we only need it defined.
    __APP_VERSION__: JSON.stringify("0.0.0-test"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // jsdom gives us the browser globals (window, localStorage,
    // IntersectionObserver polyfill hooks) that Radix/recharts/sonner expect.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", "dist", "node_modules/**"],
    // Clicks/typing are async; relax the default 5s ceiling so CI on a cold
    // cache doesn't flake.
    testTimeout: 10_000,
    restoreMocks: true,
    unstubGlobals: true,
    css: false,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/index.ts",
        // The frontend re-export shims — they add no logic of their own.
        "src/lib/api.ts",
        "src/lib/utils.ts",
        "src/lib/query-client.ts",
        "src/store/auth-store.ts",
        "src/features/**/api/index.ts",
        "src/features/**/api/requests.ts",
        "src/features/**/api/use-*.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/test/**",
      ],
      thresholds: {
        // Deliberately conservative starting points — raise as coverage grows.
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
