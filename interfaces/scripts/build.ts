#!/usr/bin/env tsx
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, rmSync } from "fs";
import { resolve, dirname, relative, basename, extname } from "path";
import yaml from "js-yaml";

const ROOT = resolve(__dirname, "..");
const SRC_DIR = resolve(ROOT, "src");
const DIST_DIR = resolve(ROOT, "dist");
const GENERATED_OPENAPI_PATH = resolve(SRC_DIR, "openapi.yaml");

// CamelCase converter: "login-request" -> "LoginRequest"
function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
}

console.log("🔨 Building @examify-tms/interfaces from YAML sources...");
