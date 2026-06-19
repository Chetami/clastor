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

Example `src/auth/login-request.yaml`:
```yaml
type: object
required:
  - firebaseToken
properties:
  firebaseToken:
    type: string
    description: Firebase ID token from client authentication
```

**Reference handling**: Use filename-based references. To reference another schema, use `$ref: 'filename.yaml'` (relative path). The build script converts these to proper OpenAPI `#/components/schemas/{CamelCaseName}` references during merging.

**Type mapping**:
- `string` → `string`
- `number` → `number`
- `integer` → `number`
- `boolean` → `boolean`
- `array` → `T[]`
- `object` → interface with properties
- `format: date-time` → `string` (ISO 8601 timestamp)
- Nullable → `T | null`

### Build Script

**Location**: `interfaces/scripts/build.ts`

**Flow**:
1. Clean `dist/` and generated `src/openapi.yaml`
2. Recursively scan `src/` for `*.yaml` files
3. Merge into complete OpenAPI spec with `components.schemas` wrapper
4. Write merged spec to `src/openapi.yaml` (for reference)
5. Run `openapi-typescript` to generate type definitions
6. Split output into per-feature `.d.ts` files
7. Create `dist/index.d.ts` barrel export

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
    "tsx": "^4.19.0"
  },
  "scripts": {
    "build": "tsx scripts/build.ts",
    "clean": "rm -rf dist src/openapi.yaml"
  }
}
```

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

**Note**: The `dist/` directory is not committed to git. The `interfaces` package includes a `postinstall` script that runs the build automatically when other developers run `npm install`. This ensures generated types are always available without committing build artifacts.

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
