import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
// App version is derived from the code, so the same commit always produces the
// same version no matter which environment (or how many times) it's deployed
// to: base semver from the repo-root package.json + the short git commit SHA.
// Falls back to the bare semver if git isn't available (e.g. a shallow export).
var rootPkg = JSON.parse(readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"));
function shortSha() {
    try {
        return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
            .toString()
            .trim();
    }
    catch (_a) {
        return "";
    }
}
var sha = shortSha();
var appVersion = sha ? "".concat(rootPkg.version, "+").concat(sha) : rootPkg.version;
export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true,
            },
        },
    },
});
