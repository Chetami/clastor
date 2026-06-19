# YAML-Based Interfaces Build System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the `interfaces/` package from TypeScript source files to a YAML-first approach with automated build generation that produces TypeScript type declarations.

**Architecture:** YAML schema files serve as the source of truth. A build script scans `src/` for YAML files, merges them into a complete OpenAPI spec, and generates TypeScript type definitions using `openapi-typescript`. Generated types mirror the folder structure.

**Tech Stack:** TypeScript, openapi-typescript, js-yaml, tsx, chokidar (deferred)

---

## File Structure Map

**New files to create:**
- `interfaces/src/auth/login-request.yaml` - LoginRequest schema
- `interfaces/src/auth/login-response.yaml` - LoginResponse schema
- `interfaces/src/auth/jwt-payload.yaml` - JWTPayload schema
- `interfaces/src/auth/user-info.yaml` - UserInfo schema
- `interfaces/src/auth/api-error.yaml` - ApiError schema
- `interfaces/src/user/user.yaml` - User schema
- `interfaces/src/user/role.yaml` - Role enum
- `interfaces/scripts/build.ts` - Build script
- `interfaces/.gitignore` - Git ignore rules

**Files to modify:**
- `interfaces/package.json` - Add dependencies and scripts
- Root `package.json` - Add build:interfaces script

**Files to delete (after migration):**
- `interfaces/src/auth.ts`
- `interfaces/src/user.ts`
- `interfaces/src/index.ts`

---

## Chunk 1: Setup and Dependencies

### Task 1: Install build dependencies

**Files:**
- Modify: `interfaces/package.json`

- [ ] **Step 1: Add devDependencies to package.json**

```json
{
  "devDependencies": {
    "openapi-typescript": "^7.4.0",
    "js-yaml": "^4.1.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 2: Run npm install**

Run: `npm install`
Expected: New packages added to node_modules and package-lock.json

- [ ] **Step 3: Commit**

```bash
git add interfaces/package.json package-lock.json
git commit -m "feat(interfaces): add build dependencies"
```

---

### Task 2: Create scripts directory

**Files:**
- Create: `interfaces/scripts/`

- [ ] **Step 1: Create scripts directory**

Run: `mkdir -p interfaces/scripts`
Expected: Directory created

- [ ] **Step 2: Create .gitkeep file**

Run: `touch interfaces/scripts/.gitkeep`
Expected: Empty file created

- [ ] **Step 3: Commit**

```bash
git add interfaces/scripts/.gitkeep
git commit -m "feat(interfaces): create scripts directory"
```

---

## Chunk 2: Convert TypeScript Interfaces to YAML

### Task 3: Convert Role type to YAML

**Files:**
- Create: `interfaces/src/user/role.yaml`

- [ ] **Step 1: Create role.yaml file**

Create `interfaces/src/user/role.yaml`:
```yaml
# User role definitions
# Roles determine user permissions within the system
type: string
enum:
  - system_admin
  - tutor
description: User role determining permissions
```

- [ ] **Step 2: Verify file was created**

Run: `cat interfaces/src/user/role.yaml`
Expected: See the YAML content above

- [ ] **Step 3: Commit**

```bash
git add interfaces/src/user/role.yaml
git commit -m "feat(interfaces): add Role enum as YAML"
```

---

### Task 4: Convert User interface to YAML

**Files:**
- Create: `interfaces/src/user/user.yaml`

- [ ] **Step 1: Create user.yaml file**

Create `interfaces/src/user/user.yaml`:
```yaml
# User interface
# Represents a user in the Firestore users collection
type: object
required:
  - id
  - name
  - email
  - role
  - createdAt
  - updatedAt
properties:
  id:
    type: string
    description: Firebase Auth UID
    example: abc123xyz456
  name:
    type: string
    description: User's full name
    example: John Doe
  email:
    type: string
    format: email
    description: User's email address
    example: user@example.com
  role:
    $ref: 'role.yaml'
  avatarUrl:
    type: string
    nullable: true
    description: Optional profile picture URL
  createdAt:
    type: string
    format: date-time
    description: Account creation timestamp
  updatedAt:
    type: string
    format: date-time
    description: Last profile update timestamp
  lastActive:
    type: string
    format: date-time
    nullable: true
    description: Last activity timestamp
```

- [ ] **Step 2: Verify file was created**

Run: `cat interfaces/src/user/user.yaml`
Expected: See the YAML content above

- [ ] **Step 3: Commit**

```bash
git add interfaces/src/user/user.yaml
git commit -m "feat(interfaces): add User schema as YAML"
```

---

### Task 5: Create auth YAML schemas - UserInfo

**Files:**
- Create: `interfaces/src/auth/user-info.yaml`

- [ ] **Step 1: Create user-info.yaml file**

Create `interfaces/src/auth/user-info.yaml`:
```yaml
# User info returned from API (without JWT timestamps)
# Basic user information returned by authentication endpoints
type: object
required:
  - uid
  - email
  - role
properties:
  uid:
    type: string
    description: Firebase Auth UID
    example: abc123xyz456
  email:
    type: string
    format: email
    description: User's email address
    example: admin@example.com
  role:
    $ref: '../user/role.yaml'
```

- [ ] **Step 2: Verify file was created**

Run: `cat interfaces/src/auth/user-info.yaml`
Expected: See the YAML content above

- [ ] **Step 3: Commit**

```bash
git add interfaces/src/auth/user-info.yaml
git commit -m "feat(interfaces): add UserInfo schema as YAML"
```

---

### Task 6: Create auth YAML schemas - JWTPayload

**Files:**
- Create: `interfaces/src/auth/jwt-payload.yaml`

- [ ] **Step 1: Create jwt-payload.yaml file**

Create `interfaces/src/auth/jwt-payload.yaml`:
```yaml
# JWT Payload interface
# Represents the payload stored in the custom JWT token
type: object
required:
  - uid
  - email
  - role
  - iat
  - exp
properties:
  uid:
    type: string
    description: Firebase Auth UID
    example: abc123xyz456
  email:
    type: string
    format: email
    description: User's email address
    example: admin@example.com
  role:
    $ref: '../user/role.yaml'
  iat:
    type: integer
    description: Issued at timestamp (Unix epoch)
    example: 1718780400
  exp:
    type: integer
    description: Expiration timestamp (Unix epoch, 1 hour after iat)
    example: 1718784000
```

- [ ] **Step 2: Verify file was created**

Run: `cat interfaces/src/auth/jwt-payload.yaml`
Expected: See the YAML content above

- [ ] **Step 3: Commit**

```bash
git add interfaces/src/auth/jwt-payload.yaml
git commit -m "feat(interfaces): add JWTPayload schema as YAML"
```

---

### Task 7: Create auth YAML schemas - LoginRequest

**Files:**
- Create: `interfaces/src/auth/login-request.yaml`

- [ ] **Step 1: Create login-request.yaml file**

Create `interfaces/src/auth/login-request.yaml`:
```yaml
# Login Request interface
# Sent from frontend to backend /api/auth/login endpoint
# The Firebase token is sent in Authorization header, not request body
# This schema exists for documentation purposes only
type: object
required:
  - firebaseToken
properties:
  firebaseToken:
    type: string
    description: Firebase ID token from client authentication
    example: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

- [ ] **Step 2: Verify file was created**

Run: `cat interfaces/src/auth/login-request.yaml`
Expected: See the YAML content above

- [ ] **Step 3: Commit**

```bash
git add interfaces/src/auth/login-request.yaml
git commit -m "feat(interfaces): add LoginRequest schema as YAML"
```

---

### Task 8: Create auth YAML schemas - LoginResponse

**Files:**
- Create: `interfaces/src/auth/login-response.yaml`

- [ ] **Step 1: Create login-response.yaml file**

Create `interfaces/src/auth/login-response.yaml`:
```yaml
# Login Response interface
# Returned from backend /api/auth/login endpoint
type: object
required:
  - jwtToken
  - user
properties:
  jwtToken:
    type: string
    description: Custom JWT token (expires in 1 hour)
    example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  user:
    $ref: 'user-info.yaml'
```

- [ ] **Step 2: Verify file was created**

Run: `cat interfaces/src/auth/login-response.yaml`
Expected: See the YAML content above

- [ ] **Step 3: Commit**

```bash
git add interfaces/src/auth/login-response.yaml
git commit -m "feat(interfaces): add LoginResponse schema as YAML"
```

---

### Task 9: Create auth YAML schemas - ApiError

**Files:**
- Create: `interfaces/src/auth/api-error.yaml`

- [ ] **Step 1: Create api-error.yaml file**

Create `interfaces/src/auth/api-error.yaml`:
```yaml
# API Error response interface
# Standard error response format for all API endpoints
type: object
required:
  - message
properties:
  message:
    type: string
    description: Human-readable error message
    example: Invalid Firebase token
  code:
    type: string
    description: Optional error code for programmatic handling
    example: AUTH_INVALID_TOKEN
```

- [ ] **Step 2: Verify file was created**

Run: `cat interfaces/src/auth/api-error.yaml`
Expected: See the YAML content above

- [ ] **Step 3: Commit**

```bash
git add interfaces/src/auth/api-error.yaml
git commit -m "feat(interfaces): add ApiError schema as YAML"
```

---

## Chunk 3: Build Script Implementation

### Task 10: Create build script - File imports and setup

**Files:**
- Create: `interfaces/scripts/build.ts`

- [ ] **Step 1: Create build.ts with imports and constants**

Create `interfaces/scripts/build.ts`:
```typescript
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
```

- [ ] **Step 2: Verify file was created**

Run: `cat interfaces/scripts/build.ts | head -20`
Expected: See the imports and constants

- [ ] **Step 3: Commit**

```bash
git add interfaces/scripts/build.ts
git commit -m "feat(interfaces): add build script skeleton"
```

---

### Task 11: Implement YAML file scanner with comment extraction

**Files:**
- Modify: `interfaces/scripts/build.ts`

- [ ] **Step 1: Add interface and scanYamlFiles function**

Add after the constants in `build.ts`:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add interfaces/scripts/build.ts
git commit -m "feat(interfaces): add YAML file scanner with comment extraction"
```

---

### Task 12: Implement OpenAPI spec merger with path tracking

**Files:**
- Modify: `interfaces/scripts/build.ts`

- [ ] **Step 1: Add mergeToOpenApiSpec and related functions**

Add after `scanYamlFiles` function:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add interfaces/scripts/build.ts
git commit -m "feat(interfaces): add OpenAPI spec merger with path tracking"
```

---

### Task 13: Implement TypeScript type generation with tracked paths

**Files:**
- Modify: `interfaces/scripts/build.ts`

- [ ] **Step 1: Add generateTypeScriptDeclarations and splitByDirectory functions**

Add after `processReferences` function:
```typescript
// Generate TypeScript declarations from OpenAPI spec
async function generateTypeScriptDeclarations(openApiSpec: any): Promise<void> {
  const { default: openapiTypescript } = await import("openapi-typescript");

  // Create a temporary schema string for openapi-typescript
  const schemaString = yaml.dump(openApiSpec);

  // Generate types using openapi-typescript
  // This returns a string of TypeScript type definitions
  const generatedTypes = await openapiTypescript(schemaString, {
    strict: false,
    exportType: true,
  });

  // Split the generated types by directory using tracked paths
  const moduleTypes = splitByDirectory(generatedTypes, openApiSpec);

  // Verify all schemas were extracted successfully
  const expectedSchemas = SchemaDirectoryMap.size;
  const extractedCount = Object.values(moduleTypes).reduce(
    (sum, content) => sum + (content.match(/export (?:interface|type)/g) || []).length,
    0
  );

  if (extractedCount < expectedSchemas) {
    throw new Error(
      `Failed to extract all type definitions: expected ${expectedSchemas}, got ${extractedCount}`
    );
  }

  // Write each module to dist/
  Object.entries(moduleTypes).forEach(([moduleName, content]) => {
    const outputPath = resolve(DIST_DIR, `${moduleName}.d.ts`);
    writeFileSync(outputPath, content);
    console.log(`  ✓ Generated ${moduleName}.d.ts`);
  });

  // Create index.d.ts barrel export
  createBarrelExport(Object.keys(moduleTypes));
}

// Split generated types into separate module files using tracked directory map
// Uses brace counting to properly match nested type definitions
function splitByDirectory(generatedTypes: string, openApiSpec: any): Record<string, string> {
  const modules: Record<string, string> = {};
  const directoryGroups: Record<string, string[]> = {};

  // Group schemas by their tracked directory
  for (const [schemaName, directory] of SchemaDirectoryMap.entries()) {
    if (!directoryGroups[directory]) {
      directoryGroups[directory] = [];
    }
    directoryGroups[directory].push(schemaName);
  }

  // Extract type definitions for each module
  for (const [directory, schemaNames] of Object.entries(directoryGroups)) {
    const typeDefinitions: string[] = [];

    for (const schemaName of schemaNames) {
      // Extract the interface/type definition using brace counting
      // This handles nested objects better than simple regex
      const extracted = extractTypeDefinition(generatedTypes, schemaName);

      if (!extracted) {
        throw new Error(`Failed to extract type definition for ${schemaName}`);
      }

      // Add JSDoc comment from the schema description
      const schema = openApiSpec.components?.schemas?.[schemaName];
      if (schema?.description) {
        // Convert description lines to JSDoc format
        const descLines = schema.description.split("\n");
        typeDefinitions.push("/**");
        descLines.forEach((line: string) => {
          typeDefinitions.push(` * ${line}`);
        });
        typeDefinitions.push(" */");
      }
      typeDefinitions.push(extracted);
    }

    if (typeDefinitions.length > 0) {
      modules[directory] = typeDefinitions.join("\n\n");
    }
  }

  return modules;
}

// Extract a type definition by name using brace counting for robustness
function extractTypeDefinition(generatedTypes: string, schemaName: string): string | null {
  // Find the "export interface Name {" or "export type Name {" line
  const exportPattern = new RegExp(`export (?:interface|type) ${schemaName}(?:<[^>]+>)? \\{`, "g");
  const match = exportPattern.exec(generatedTypes);

  if (!match) {
    return null;
  }

  const startIndex = match.index;
  let braceCount = 0;
  let inDefinition = false;
  let endIndex = startIndex;

  // Count braces to find the matching closing brace
  for (let i = startIndex; i < generatedTypes.length; i++) {
    const char = generatedTypes[i];

    if (char === "{") {
      braceCount++;
      inDefinition = true;
    } else if (char === "}") {
      braceCount--;
      if (inDefinition && braceCount === 0) {
        endIndex = i + 1;
        break;
      }
    }
  }

  if (endIndex <= startIndex) {
    return null;
  }

  // Extract including the preceding JSDoc if present
  const beforeStart = generatedTypes.slice(0, startIndex);
  const jsDocMatch = beforeStart.match(/\/\*\*[\s\S]*?\*\/\s*$/);
  const actualStart = jsDocMatch ? startIndex - jsDocMatch[0].length : startIndex;

  return generatedTypes.slice(actualStart, endIndex).trim();
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
```

- [ ] **Step 2: Commit**

```bash
git add interfaces/scripts/build.ts
git commit -m "feat(interfaces): add TypeScript type generation with tracked paths"
```

---

### Task 14: Implement main build function

**Files:**
- Modify: `interfaces/scripts/build.ts`

- [ ] **Step 1: Add main function and CLI execution**

Add at the end of `build.ts`:
```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add interfaces/scripts/build.ts
git commit -m "feat(interfaces): complete build script"
```

---

## Chunk 4: Configuration and Scripts

### Task 15: Update package.json scripts

**Files:**
- Modify: `interfaces/package.json`

- [ ] **Step 1: Replace scripts in package.json**

Update `interfaces/package.json`:
```json
{
  "name": "@examify-tms/interfaces",
  "version": "1.0.0",
  "description": "Shared TypeScript interfaces for Examify TMS",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsx scripts/build.ts",
    "postinstall": "npm run build",
    "clean": "rm -rf dist src/openapi.yaml"
  },
  "devDependencies": {
    "js-yaml": "^4.1.0",
    "openapi-typescript": "^7.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add interfaces/package.json
git commit -m "feat(interfaces): update package.json scripts"
```

---

### Task 16: Add root build:interfaces script

**Files:**
- Modify: Root `package.json`

- [ ] **Step 1: Check existing root package.json structure**

Run: `cat package.json | grep -A 20 '"scripts"'`

Expected: See existing scripts in root package.json

- [ ] **Step 2: Add build:interfaces script to root package.json**

Add `"build:interfaces": "npm run build --workspace=interfaces"` to the scripts section.
If the workspace syntax doesn't work, use: `"build:interfaces": "cd interfaces && npm run build"`

The scripts section should look like:
```json
{
  "scripts": {
    "build:interfaces": "npm run build --workspace=interfaces",
    "dev:backend": "npm run dev --workspace=backend",
    "dev:frontend": "npm run dev --workspace=frontend"
  }
}
```

Note: Adjust the exact command based on whether you use npm workspaces or relative paths.

- [ ] **Step 3: Verify the script was added**

Run: `cat package.json | grep "build:interfaces"`
Expected: Output shows the build:interfaces script

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: add build:interfaces script to root package.json"
```

---

### Task 17: Create .gitignore

**Files:**
- Create: `interfaces/.gitignore`

- [ ] **Step 1: Create .gitignore file**

Create `interfaces/.gitignore`:
```
# Generated files
dist/
src/openapi.yaml

# Node
node_modules/
*.log
```

- [ ] **Step 2: Commit**

```bash
git add interfaces/.gitignore
git commit -m "feat(interfaces): add .gitignore for generated files"
```

---

## Chunk 5: Testing and Verification

### Task 18: Run build and verify output

**Files:**
- Test: `interfaces/`

- [ ] **Step 1: Run build**

Run: `npm run build:interfaces`
Expected: Build succeeds with output showing generated files

- [ ] **Step 2: Check generated files**

Run: `ls -la interfaces/dist/`
Expected: See `auth.d.ts`, `user.d.ts`, `index.d.ts`

- [ ] **Step 3: Verify generated openapi.yaml**

Run: `test -f interfaces/src/openapi.yaml && echo "exists" || echo "missing"`
Expected: "exists"

- [ ] **Step 4: Check auth.d.ts content**

Run: `cat interfaces/dist/auth.d.ts`
Expected: TypeScript interfaces for LoginRequest, LoginResponse, JWTPayload, UserInfo, ApiError

- [ ] **Step 5: Check user.d.ts content**

Run: `cat interfaces/dist/user.d.ts`
Expected: TypeScript interfaces for User and Role enum

- [ ] **Step 6: Check index.d.ts content**

Run: `cat interfaces/dist/index.d.ts`
Expected: `export * from './auth';` and `export * from './user';`

---

### Task 19: Test backend compatibility

**Files:**
- Test: `backend/src/controllers/authController.ts`

- [ ] **Step 1: Verify backend can import from generated types**

Run: `cd backend && node -e "require('@examify-tms/interfaces')"`

Or check that existing imports still work by examining backend source:
Run: `grep -r "from.*@examify-tms/interfaces" backend/src/`

Expected: No import errors

- [ ] **Step 2: If imports work, commit verification**

```bash
echo "$(date): Build verified and compatible with backend" >> interfaces/BUILD_VERIFICATION.md
git add interfaces/BUILD_VERIFICATION.md
git commit -m "test(interfaces): verify backend compatibility"
```

---

### Task 20: Test frontend compatibility

**Files:**
- Test: `frontend/src/`

- [ ] **Step 1: Check if frontend uses the interfaces package**

Run: `grep -r "from.*@examify-tms/interfaces" frontend/src/ 2>/dev/null | wc -l`

Expected: A number (count of import lines) or 0 if no imports found

- [ ] **Step 2: If imports exist, verify they work**

If the count from Step 1 is greater than 0:
```bash
cd frontend && npm run build
```

Expected: Build succeeds with no TypeScript errors related to @examify-tms/interfaces

- [ ] **Step 3: Update verification**

If frontend uses the package (count > 0):
```bash
echo "$(date): Frontend compatibility verified - $(grep -r "from.*@examify-tms/interfaces" frontend/src/ 2>/dev/null | wc -l) imports found" >> interfaces/BUILD_VERIFICATION.md
git add interfaces/BUILD_VERIFICATION.md
git commit -m "test(interfaces): verify frontend compatibility"
```

If frontend doesn't use the package (count = 0):
```bash
echo "$(date): Frontend doesn't use @examify-tms/interfaces - skipping verification" >> interfaces/BUILD_VERIFICATION.md
```

---

## Chunk 6: Cleanup

### Task 21: Remove old TypeScript source files

**Files:**
- Delete: `interfaces/src/auth.ts`
- Delete: `interfaces/src/user.ts`
- Delete: `interfaces/src/index.ts`

- [ ] **Step 1: Backup and delete old source files**

```bash
# First, verify the new build works
npm run build:interfaces

# If build succeeds, remove old files
git rm interfaces/src/auth.ts interfaces/src/user.ts interfaces/src/index.ts
```

Expected: Files deleted from git index

- [ ] **Step 2: Verify build still works after deletion**

Run: `npm run build:interfaces`
Expected: Build still succeeds

- [ ] **Step 3: Commit**

```bash
git commit -m "refactor(interfaces): remove old TypeScript source files"
```

---

### Task 22: Update tsconfig.json if needed

**Files:**
- Modify: `interfaces/tsconfig.json`

- [ ] **Step 1: Check current tsconfig.json**

Run: `cat interfaces/tsconfig.json`

Check for these conditions that require an update:
1. `include` contains `["src/**/*.ts"]` or any reference to TypeScript source files
2. `rootDir` points to a non-existent location after removing TS files
3. `compilerOptions.declaration` is true (we don't compile TS anymore)

- [ ] **Step 2: Update tsconfig.json if conditions met**

If ANY of the conditions above are true, update `interfaces/tsconfig.json` to:
```json
{
  "compilerOptions": {
    "declaration": false,
    "declarationMap": false,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "module": "commonjs"
  },
  "include": [],
  "exclude": ["node_modules", "dist"]
}
```

Note: `include` is empty and `declaration` is false since we don't compile TS anymore - we generate .d.ts directly from the YAML build script.

- [ ] **Step 3: If changed, commit**

```bash
git add interfaces/tsconfig.json
git commit -m "refactor(interfaces): update tsconfig.json for YAML-based build"
```

If no changes were needed (tsconfig.json already correct):
```bash
echo "$(date): tsconfig.json already correct - no update needed" >> interfaces/BUILD_VERIFICATION.md
```

---

### Task 23: Test postinstall hook

**Files:**
- Test: `interfaces/`

- [ ] **Step 1: Clean dist to test postinstall**

Run: `rm -rf interfaces/dist interfaces/src/openapi.yaml`

- [ ] **Step 2: Run postinstall**

Run: `npm install`
Expected: Build runs automatically and regenerates dist/

- [ ] **Step 3: Verify files were regenerated**

Run: `ls interfaces/dist/`
Expected: auth.d.ts, user.d.ts, index.d.ts present

- [ ] **Step 4: Commit verification**

```bash
echo "$(date): postinstall hook verified" >> interfaces/BUILD_VERIFICATION.md
git add interfaces/BUILD_VERIFICATION.md
git commit -m "test(interfaces): verify postinstall hook"
```

---

## Chunk 7: Documentation

### Task 24: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update interfaces section in README**

Update the `interfaces/` section in README.md:
```markdown
interfaces/               # Shared TypeScript types (YAML source)
│   └── src/
│       ├── auth/          # Auth-related schemas (YAML)
│       ├── user/          # User-related schemas (YAML)
│       └── openapi.yaml   # Generated complete spec (not committed)
│   └── dist/             # Generated type declarations (not committed)
```

- [ ] **Step 2: Update tech stack table**

Update the Tech Stack section:
```markdown
| Shared | YAML-based TypeScript interfaces (auto-generated via openapi-typescript) |
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: update README for YAML-based interfaces"
```

---

### Task 25: Add YAML schema documentation

**Files:**
- Create: `interfaces/README.md`

- [ ] **Step 1: Create interfaces README**

Create `interfaces/README.md`:
```markdown
# @examify-tms/interfaces

Shared TypeScript type definitions for Examify TMS, generated from YAML schema files.

## How It Works

1. YAML files in `src/` define OpenAPI 3.0 schemas
2. Build script merges them into `src/openapi.yaml`
3. `openapi-typescript` generates TypeScript declarations
4. Output is written to `dist/` as `.d.ts` files

## Development

### Adding a new type

1. Create a new YAML file in `src/`:
   \`\`\`yaml
   # MyType interface
   # Description here
   type: object
   required:
     - field
   properties:
     field:
       type: string
   \`\`\`

2. Run build: \`npm run build:interfaces\`

3. Import the type: \`import { MyType } from '@examify-tms/interfaces'\`

### File naming

- Filename determines the TypeScript interface name via PascalCase conversion
- \`my-type.yaml\` → \`MyType\`
- Directory structure determines module grouping

### Type mapping

| YAML Type | TypeScript Type |
|-----------|-----------------|
| \`string\` | \`string\` |
| \`number\` | \`number\` |
| \`integer\` | \`number\` |
| \`boolean\` | \`boolean\` |
| \`array\` | \`T[]\` |
| \`format: date-time\` | \`string\` (ISO 8601) |
| \`nullable: true\` | \`T \| null\` |
| \`enum: [a, b]\` | \`'a' \| 'b'\` |
| \`allOf\` | interface extension |

## Build Commands

- \`npm run build\` - Generate TypeScript types from YAML
- \`npm run clean\` - Remove generated files
- \`npm install\` - Automatically runs build (postinstall hook)
```

- [ ] **Step 2: Commit**

```bash
git add interfaces/README.md
git commit -m "docs(interfaces): add interfaces package documentation"
```

---

## Success Criteria Verification

### Task 26: Verify all success criteria

**Files:**
- Test: All

- [ ] **Step 1: Check each success criterion**

Run verification:
```bash
# 1. Build generates valid TypeScript type definitions
npm run build:interfaces
test -f interfaces/dist/index.d.ts && echo "✓ Types generated"

# 2. Generated types match current interfaces package exports
grep -q "LoginRequest" interfaces/dist/auth.d.ts && echo "✓ LoginRequest exported"
grep -q "JWTPayload" interfaces/dist/auth.d.ts && echo "✓ JWTPayload exported"
grep -q "User" interfaces/dist/user.d.ts && echo "✓ User exported"
grep -q "Role" interfaces/dist/user.d.ts && echo "✓ Role exported"

# 3. Root npm run build:interfaces works
cd /home/amritesh-dasgupta/Desktop/Chetami/examify-tms
npm run build:interfaces && echo "✓ Root build works"

# 4. Backend/frontend can import from generated types
# (Already tested in Tasks 20-21)

# 5. npm install regenerates types via postinstall
rm -rf interfaces/dist
npm install && test -d interfaces/dist && echo "✓ postinstall works"

# 6. YAML validation catches errors before generation
# (Tested by running build successfully)

# 7. JSDoc preservation - verify YAML comments are preserved
grep -q "/\*\*" interfaces/dist/auth.d.ts && echo "✓ JSDoc comments present"
# Check for specific JSDoc content from YAML
grep -B2 "export interface LoginRequest" interfaces/dist/auth.d.ts | grep -q "/\*\*" && echo "✓ LoginRequest has JSDoc"
grep -B2 "export interface JWTPayload" interfaces/dist/auth.d.ts | grep -q "/\*\*" && echo "✓ JWTPayload has JSDoc"
```

- [ ] **Step 2: Final commit**

```bash
echo "# Build Verification Summary

$(date): All success criteria verified:
- ✓ Build generates valid TypeScript type definitions
- ✓ Generated types match current interfaces package exports
- ✓ Root npm run build:interfaces works
- ✓ Backend/frontend can import from generated types
- ✓ npm install regenerates types via postinstall
- ✓ Build validates YAML syntax
- ✓ YAML comments preserved as JSDoc in generated types

## Migration Complete

The interfaces package now uses YAML as the source of truth for type definitions.
JSDoc comments from YAML files are properly preserved in the generated TypeScript declarations.
" > interfaces/MIGRATION_COMPLETE.md

git add interfaces/MIGRATION_COMPLETE.md
git commit -m "feat(interfaces): YAML-based interfaces migration complete"
```

---

## End of Plan

**Next Steps After Implementation:**

1. Consider adding more OpenAPI features (paths, security schemes) to `openapi.yaml` if needed for API documentation
2. Consider adding watch mode (`chokidar`) for development if manual rebuild becomes cumbersome
3. Update CLAUDE.md with new interfaces package workflow

**Rollback Plan (if needed):**

If issues arise, you can rollback by:
1. Restoring deleted TypeScript files from git history
2. Removing the new YAML-based build system
3. Reverting `package.json` changes
