# @examify-tms/interfaces

Shared TypeScript type definitions for Examify TMS, generated from YAML schema files.

## How It Works

1. YAML files in `src/` define OpenAPI 3.0 schemas
2. Build script merges them into `src/openapi.yaml`
3. TypeScript type declarations are generated from the schemas
4. Output is written to `dist/` as `.d.ts` files

## Development

### Adding a new type

1. Create a new YAML file in `src/`:

```yaml
# MyType interface
# Description here
type: object
required:
  - field
properties:
  field:
    type: string
```

2. Run build: `npm run build:interfaces`

3. Import the type: `import { MyType } from '@examify-tms/interfaces'`

### File naming

- Filename determines the TypeScript interface name via PascalCase conversion
- `my-type.yaml` → `MyType`
- Directory structure determines module grouping

### Type mapping

| YAML Type | TypeScript Type |
|-----------|-----------------|
| `string` | `string` |
| `number` | `number` |
| `integer` | `number` |
| `boolean` | `boolean` |
| `array` | `T[]` |
| `format: date-time` | `string` (ISO 8601) |
| `nullable: true` | `T | null` |
| `enum: [a, b]` | `'a' | 'b'` |
| `allOf` | interface extension |

### YAML schema structure

Each YAML file defines a single OpenAPI 3.0 schema:

```yaml
# Interface description (JSDoc)
# Additional description lines
type: object
required:
  - requiredField
properties:
  requiredField:
    type: string
    description: Field description
  optionalField:
    type: string
    nullable: true
```

## Build Commands

- `npm run build` - Generate TypeScript types from YAML
- `npm run clean` - Remove generated files
- `npm install` - Automatically runs build (postinstall hook)

## Module Organization

Generated types are organized by directory:

- `src/auth/*.yaml` → `dist/auth.d.ts`
- `src/user/*.yaml` → `dist/user.d.ts`
- `dist/index.d.ts` - Barrel export of all modules
