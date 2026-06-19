# YAML-Based Interfaces Build System

**Date**: 2024-06-19
**Status**: Design Approved
**Related**: [README.md](../../../README.md)

## Overview

Convert the `interfaces/` package from TypeScript source files to a YAML-first approach with automated build generation. The YAML files serve as the source of truth for type definitions, and a build script generates TypeScript type declarations.

## Motivation

- **Single source of truth**: YAML specs are easier to maintain and share
- **Better documentation**: OpenAPI schema format is self-documenting
- **Flexible generation**: Can generate multiple output formats from one source
- **Tooling ecosystem**: Leverages existing OpenAPI tooling

## Design

### File Structure

```
interfaces/
├── src/
│   ├── auth/
│   │   ├── login-request.yaml
│   │   ├── login-response.yaml
│   │   ├── jwt-payload.yaml
│   │   └── user-info.yaml
│   ├── user/
│   │   ├── user.yaml
│   │   └── role.yaml
│   └── openapi.yaml                 # Generated complete spec (not committed)
├── dist/                             # Generated, .gitignore
│   ├── auth.d.ts
│   ├── user.d.ts
│   └── index.d.ts                    # Barrel export
├── scripts/
│   └── build.ts                     # Build script
├── package.json
└── tsconfig.json
```

### YAML File Format

Each YAML file contains a **pure OpenAPI 3.0 schema object** (the contents of what would go under `components.schemas.{Name}`). The build script wraps these into a complete OpenAPI spec.

**Schema naming**: Filename determines the TypeScript interface name via camelCase conversion:
- `login-request.yaml` → `LoginRequest`
- `jwt-payload.yaml` → `JWTPayload`
- `user-info.yaml` → `UserInfo`

**Example**: `src/auth/login-request.yaml`
```yaml
# Login Request interface
# Sent from frontend to backend /api/auth/login endpoint
type: object
required:
  - firebaseToken
properties:
  firebaseToken:
    type: string
    description: Firebase ID token from client authentication
```

**Documentation**: Use YAML comments (`#`) above the schema for JSDoc-style documentation. The build script preserves these as JSDoc comments in the generated TypeScript.

**Reference handling**: Use filename-based references. To reference another schema, use `$ref: 'filename.yaml'` (relative path). The build script converts these to proper OpenAPI `#/components/schemas/{CamelCaseName}` references during merging.

**Optional properties**: Properties not in the `required` array become optional (with `?`) in TypeScript.

**Nullable properties**: Use `nullable: true` on a property to make it `T | null` in TypeScript.
```yaml
properties:
  avatarUrl:
    type: string
    nullable: true
    # Generates: avatarUrl?: string | null
```

**Interface extension**: Use `allOf` to extend another interface:
```yaml
allOf:
  - $ref: 'base-entity.yaml'
  - type: object
    properties:
      specificField:
        type: string
```

**Type mapping**:
- `string` → `string`
- `number` → `number`
- `integer` → `number`
- `boolean` → `boolean`
- `array` → `T[]`
- `object` → interface with properties
- `format: date-time` → `string` (ISO 8601 timestamp)
- `nullable: true` → `T | null`
- `enum: [a, b]` → `'a' | 'b'`
- `allOf` → interface extension

### Build Script

**Location**: `interfaces/scripts/build.ts`

**Flow**:
1. Clean `dist/` and generated `src/openapi.yaml`
2. Recursively scan `src/` for `*.yaml` files
3. Merge into complete OpenAPI spec with `components.schemas` wrapper
4. Write merged spec to `src/openapi.yaml` (for reference/Swagger UI)
5. Run `openapi-typescript` to generate type definitions
6. **Split by directory**: Group schemas by their parent directory (e.g., `auth/*.yaml` → `auth.d.ts`, `user/*.yaml` → `user.d.ts`)
7. Create `dist/index.d.ts` barrel export that re-exports all modules

**File-to-module splitting logic**:
- Each directory in `src/` becomes a `.d.ts` file in `dist/`
- Filename determines the interface name via camelCase conversion
- Comments at the top of each YAML file become JSDoc comments

**Root usage**:
```bash
npm run build:interfaces
```

### Dependencies

```json
{
  "devDependencies": {
    "openapi-typescript": "^7.4.0",
    "js-yaml": "^4.1.0",
    "typescript": "^5.5.0",
    "tsx": "^4.19.0",
    "chokidar": "^4.0.0"
  },
  "scripts": {
    "build": "tsx scripts/build.ts",
    "postinstall": "npm run build",
    "clean": "rm -rf dist src/openapi.yaml",
    "dev": "tsx scripts/watch.ts"
  }
}
```

**postinstall**: Ensures types are regenerated when developers run `npm install`, so `dist/` doesn't need to be committed.

### TypeScript Output

Generated `dist/` mirrors folder structure:

**`dist/auth.d.ts`**:
```typescript
export interface LoginRequest {
  firebaseToken: string;
}

export interface JWTPayload {
  uid: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}
```

**`dist/index.d.ts`**:
```typescript
export * from './auth';
export * from './user';
```

### Git Ignore

```
interfaces/dist/
interfaces/src/openapi.yaml
```

**Note**:
- `dist/` is not committed. The `postinstall` script regenerates it on `npm install`.
- `src/openapi.yaml` is the merged OpenAPI spec generated from individual schema files. It's useful for local Swagger UI reference but doesn't need to be committed since the source YAML files are the true source.

**For API documentation**: The backend can serve the generated `openapi.yaml` for Swagger UI, or a separate full OpenAPI spec can be maintained in `interfaces/src/api-spec.yaml` (with paths, servers, etc.) if needed for documentation purposes.

### Optional: Watch Mode

For development, a watch script can rebuild automatically on YAML changes:

```json
{
  "scripts": {
    "dev": "tsx scripts/watch.ts"
  }
}
```

The watch script uses a file watcher (like `chokidar`) to trigger rebuilds when `src/**/*.yaml` files change.

### Validation

The build script validates YAML syntax and structure before generation. It checks:
- Valid YAML syntax
- Required properties for schema objects
- Reference file existence
- Proper OpenAPI schema typing

Errors are reported with file path and line numbers for easy debugging.

## Migration Plan

1. Create new folder structure in `src/`
2. Convert existing TypeScript interfaces to YAML schema files
3. Implement build script
4. Test build output matches current types
5. Update root `package.json` scripts
6. Remove old TypeScript source files

## Success Criteria

- [ ] Build generates valid TypeScript type definitions
- [ ] Generated types match current `interfaces` package exports
- [ ] Root `npm run build:interfaces` works
- [ ] Backend/frontend can import from generated types
- [ ] `npm install` regenerates types via postinstall
- [ ] YAML validation catches errors before generation
