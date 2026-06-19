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

// Schema metadata including original path and extracted comments
interface SchemaMetadata {
  schema: any;
  originalPath: string;  // e.g., "auth/login-request"
  comments: string[];    // YAML comments above the schema
  directory: string;     // e.g., "auth" or "user"
}

// Recursively scan directory for YAML files and extract comments
function scanYamlFiles(dir: string, baseDir: string = dir): Map<string, SchemaMetadata> {
  const schemas = new Map<string, SchemaMetadata>();

  const items = readdirSync(dir);

  for (const item of items) {
    const fullPath = resolve(dir, item);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (!item.startsWith(".") && item !== "node_modules") {
        const nested = scanYamlFiles(fullPath, baseDir);
        nested.forEach((metadata, path) => schemas.set(path, metadata));
      }
    } else if (item.endsWith(".yaml") || item.endsWith(".yml")) {
      // Read file content to extract comments
      const content = readFileSync(fullPath, "utf8");

      // Extract comments from lines before the schema content
      const lines = content.split("\n");
      const comments: string[] = [];
      let schemaStartIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith("#")) {
          // Remove the # and trim
          comments.push(line.replace(/^#\s*/, "").trim());
        } else if (line.trim() && !line.trim().startsWith("#")) {
          // Found first non-comment line - this is where schema starts
          schemaStartIndex = i;
          break;
        }
      }

      // Parse YAML (starting from schema content to avoid comment parsing issues)
      const schemaContent = lines.slice(schemaStartIndex).join("\n");
      let schema: any;
      try {
        schema = yaml.load(schemaContent);
      } catch (err) {
        throw new Error(`Invalid YAML in ${fullPath}: ${err}`);
      }

      if (!schema || typeof schema !== "object") {
        throw new Error(`Invalid schema in ${fullPath}`);
      }

      // Store with relative path from src/ (without extension)
      const relPath = relative(baseDir, fullPath);
      const key = relPath.replace(/\.(yaml|yml)$/, "");
      const pathParts = key.split("/");
      const directory = pathParts.length > 1 ? pathParts[0] : "index";

      schemas.set(key, {
        schema,
        originalPath: key,
        comments,
        directory,
      });
    }
  }

  return schemas;
}

// Tracks which directory each schema belongs to for module splitting
const SchemaDirectoryMap = new Map<string, string>();

// Merge individual schemas into complete OpenAPI spec
function mergeToOpenApiSpec(schemas: Map<string, SchemaMetadata>): any {
  const components: any = { schemas: {} };

  schemas.forEach((metadata, key) => {
    // Convert path to PascalCase for schema name
    // e.g., "auth/login-request" -> "LoginRequest"
    const parts = key.split("/");
    const schemaName = toPascalCase(parts[parts.length - 1]);

    // Track which directory this schema belongs to
    SchemaDirectoryMap.set(schemaName, metadata.directory);

    // Process references in the schema
    const processedSchema = processReferences(metadata.schema, key);

    // Build JSDoc from YAML comments
    const jsDoc = buildJSDoc(metadata.comments, metadata.schema);

    components.schemas[schemaName] = {
      ...processedSchema,
      // Use YAML comments as description, fallback to schema's description
      description: jsDoc || processedSchema.description || `Auto-generated from ${key}.yaml`,
    };
  });

  return {
    openapi: "3.0.3",
    info: {
      title: "Examify TMS API - Type Definitions",
      description: "Auto-generated OpenAPI spec from YAML schema files",
      version: "1.0.0",
    },
    components,
  };
}

// Build JSDoc comment from YAML comment lines
function buildJSDoc(comments: string[], schema: any): string {
  if (!comments || comments.length === 0) {
    return schema.description || "";
  }
  // Join multiple comment lines with newlines
  return comments.join("\n");
}

// Process $ref values to use proper OpenAPI format
function processReferences(schema: any, currentPath: string): any {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) => processReferences(item, currentPath));
  }

  const result: any = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "$ref" && typeof value === "string") {
      // Convert filename references to proper OpenAPI references
      // e.g., 'role.yaml' -> '#/components/schemas/Role'
      // e.g., '../user/role.yaml' -> '#/components/schemas/Role'
      const refName = toPascalCase(value.replace(/^.+\//, "").replace(/\.(yaml|yml)$/, ""));
      result[key] = `#/components/schemas/${refName}`;
    } else if (key === "allOf" && Array.isArray(value)) {
      result[key] = value.map((item) => processReferences(item, currentPath));
    } else {
      result[key] = processReferences(value, currentPath);
    }
  }

  return result;
}
