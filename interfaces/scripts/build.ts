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

// Generate TypeScript declarations from OpenAPI spec
async function generateTypeScriptDeclarations(openApiSpec: any): Promise<void> {
  // Generate types directly from schemas instead of parsing openapi-typescript output
  const moduleTypes = generateTypesFromSchemas(openApiSpec);

  // Write each module to dist/
  Object.entries(moduleTypes).forEach(([moduleName, content]) => {
    const outputPath = resolve(DIST_DIR, `${moduleName}.d.ts`);
    writeFileSync(outputPath, content);
    console.log(`  ✓ Generated ${moduleName}.d.ts`);
  });

  // Create index.d.ts barrel export
  createBarrelExport(Object.keys(moduleTypes));
}

// Generate TypeScript types directly from OpenAPI schemas
function generateTypesFromSchemas(openApiSpec: any): Record<string, string> {
  const modules: Record<string, string> = {};
  const directoryGroups: Record<string, string[]> = {};

  // Group schemas by their tracked directory
  for (const [schemaName, directory] of SchemaDirectoryMap.entries()) {
    if (!directoryGroups[directory]) {
      directoryGroups[directory] = [];
    }
    directoryGroups[directory].push(schemaName);
  }

  // Generate type definitions for each module
  for (const [directory, schemaNames] of Object.entries(directoryGroups)) {
    const typeDefinitions: string[] = [];

    for (const schemaName of schemaNames) {
      const schema = openApiSpec.components?.schemas?.[schemaName];
      if (!schema) {
        throw new Error(`Schema ${schemaName} not found in OpenAPI spec`);
      }

      // Generate JSDoc from description
      let jsDoc = "";
      if (schema.description) {
        const descLines = schema.description.split("\n").filter((line: string) => line.trim());
        if (descLines.length > 0) {
          jsDoc = "/**\n" + descLines.map((line: string) => ` * ${line}`).join("\n") + "\n */\n";
        }
      }

      // Generate type definition based on schema type
      const typeDef = generateTypeDefinition(schemaName, schema);
      typeDefinitions.push(jsDoc + typeDef);
    }

    if (typeDefinitions.length > 0) {
      modules[directory] = typeDefinitions.join("\n\n");
    }
  }

  return modules;
}

// Generate a TypeScript type definition from an OpenAPI schema
function generateTypeDefinition(name: string, schema: any): string {
  // Handle enum types
  if (schema.enum) {
    const enumValues = schema.enum.map((v: string) => `'${v}'`).join(" | ");
    return `export type ${name} = ${enumValues};`;
  }

  // Handle object types
  if (schema.type === "object" || schema.properties) {
    let interfaceDef = `export interface ${name} {\n`;

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const prop = propSchema as any;
        const isRequired = schema.required?.includes(propName);
        const propType = schemaToTypeString(prop);
        const optional = isRequired ? "" : "?";
        interfaceDef += `  ${propName}${optional}: ${propType};\n`;
      }
    }

    interfaceDef += "}";
    return interfaceDef;
  }

  // Handle primitive types
  if (schema.type) {
    return `export type ${name} = ${schema.type};`;
  }

  // Fallback
  return `export interface ${name} {\n  [key: string]: any;\n}`;
}

// Convert an OpenAPI schema to TypeScript type string
function schemaToTypeString(schema: any): string {
  if (!schema || typeof schema !== "object") {
    return "any";
  }

  // Handle references
  if (schema.$ref) {
    const refName = schema.$ref.replace(/^.+\//, "").replace(/^["']|["']$/g, "");
    return toPascalCase(refName);
  }

  // Handle array types
  if (schema.type === "array" || schema.items) {
    const items = schema.items || {};
    return `${schemaToTypeString(items)}[]`;
  }

  // Handle nullable types
  if (schema.nullable) {
    return `${schemaToTypeString({...schema, nullable: undefined})} | null`;
  }

  // Handle allOf (extension)
  if (schema.allOf && Array.isArray(schema.allOf)) {
    const types = schema.allOf.map((s: any) => schemaToTypeString(s));
    return types.join(" & ");
  }

  // Handle primitive types
  const typeMap: Record<string, string> = {
    string: "string",
    number: "number",
    integer: "number",
    boolean: "boolean",
    array: "any[]",
    object: "any",
  };

  if (schema.type && typeMap[schema.type]) {
    let result = typeMap[schema.type];

    // Add format annotations as comments for special string formats
    if (schema.type === "string" && schema.format) {
      return result; // Could add format info as comment
    }

    return result;
  }

  // Handle enum (inline)
  if (schema.enum) {
    return schema.enum.map((v: string) => `'${v}'`).join(" | ");
  }

  return "any";
}

// Create barrel export file
function createBarrelExport(moduleNames: string[]): void {
  const exports = moduleNames
    .filter((name) => name !== "index")
    .sort()
    .map((name) => `export * from './${name}';`)
    .join("\n");

  writeFileSync(resolve(DIST_DIR, "index.d.ts"), exports);
  console.log(`  ✓ Generated index.d.ts`);
}

// Clear the directory map before each build
SchemaDirectoryMap.clear();

// Main build function
async function build(): Promise<void> {
  console.log("🧹 Cleaning dist/ and generated files...");

  // Clean dist/
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true, force: true });
  }
  mkdirSync(DIST_DIR, { recursive: true });

  // Clean generated openapi.yaml
  if (existsSync(GENERATED_OPENAPI_PATH)) {
    rmSync(GENERATED_OPENAPI_PATH);
  }

  console.log("📂 Scanning src/ for YAML files...");
  const schemas = scanYamlFiles(SRC_DIR);
  console.log(`  Found ${schemas.size} schema files`);

  console.log("🔗 Merging schemas into OpenAPI spec...");
  const openApiSpec = mergeToOpenApiSpec(schemas);

  console.log("💾 Writing generated openapi.yaml...");
  writeFileSync(GENERATED_OPENAPI_PATH, yaml.dump(openApiSpec));
  console.log(`  ✓ Generated ${relative(ROOT, GENERATED_OPENAPI_PATH)}`);

  console.log("📝 Generating TypeScript type definitions...");
  await generateTypeScriptDeclarations(openApiSpec);

  console.log("\n✅ Build complete!");
}

// Run build
build().catch((err) => {
  console.error("❌ Build failed:", err);
  process.exit(1);
});
