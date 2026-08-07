const fs = require('fs');
const path = require('path');

// Use __dirname to get the script's directory (interfaces/scripts/)
// Then navigate to dist/index.d.ts from there
const distPath = path.join(__dirname, '..', 'dist', 'index.d.ts');

const content = fs.readFileSync(distPath, 'utf8');

// Auto-derive the list of schema names from the generated `components.schemas`
// block instead of maintaining a hardcoded array (which historically drifted
// and dropped types like `BillingEmailSource`, `VerifyTokenRequest`, etc.).
// Schema keys are the only top-level entries in `schemas: { … }`, emitted by
// openapi-typescript at 8-space indentation as `Name:`.
function deriveSchemaNames(src) {
  const start = src.indexOf('schemas: {');
  if (start === -1) return [];
  const block = src.slice(start);
  const names = new Set();
  const re = /^        ([A-Z]\w*):/gm;
  let m;
  while ((m = re.exec(block)) !== null) {
    names.add(m[1]);
  }
  return [...names].sort();
}

const types = deriveSchemaNames(content);

const reexports =
  '\n// Re-export types at top level for backward compatibility\n' +
  types.map(t => `export type ${t} = components['schemas']['${t}']`).join(';\n') +
  ';\n';

// Append the runtime feature-flags re-export so the flag types are reachable
// from the package's declared entry (the `types` field points here).
const flagReexport = '\nexport * from "./featureFlags";\n';

fs.writeFileSync(distPath, content + reexports + flagReexport);

// Write a CJS barrel as the package's runtime entry (the `main` field).
// We emit EXPLICIT named re-exports (auto-detected from featureFlags.ts,
// skipping type-only exports) instead of `module.exports = require(...)`, so
// bundlers like Rollup/Vite can statically resolve the named exports —
// `module.exports = require(...)` hides the names and breaks the frontend build.
const distDir = path.join(__dirname, '..', 'dist');
const indexPath = path.join(distDir, 'index.js');
const flagsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'featureFlags.ts'),
  'utf8',
);
const runtimeExports = [
  ...flagsSrc.matchAll(
    /^export\s+(?:async\s+)?(?:function|const|let|var)\s+(\w+)/gm,
  )].map((m) => m[1]);

const indexJs =
  '"use strict";\n' +
  'Object.defineProperty(exports, "__esModule", { value: true });\n' +
  'var __flags = require("./featureFlags");\n' +
  runtimeExports.map((n) => `exports.${n} = __flags.${n};`).join('\n') +
  '\n';
fs.writeFileSync(indexPath, indexJs);

// ESM barrel for bundlers (Vite/Rollup prefer ESM over CJS; a CJS-only entry
// hides named exports and breaks the frontend build). Points at the ESM build
// emitted to dist/esm/featureFlags.js by build:flags:esm.
const indexMjsPath = path.join(distDir, 'index.mjs');
const indexMjs =
  runtimeExports.map((n) => `  ${n},`).join('\n') +
  '\n';
fs.writeFileSync(
  indexMjsPath,
  `export {\n${indexMjs}} from "./esm/featureFlags.js";\n`,
);

console.log(`✓ Added ${types.length} type re-exports for backward compatibility`);
console.log('✓ Wrote dist/index.js (CJS) + dist/index.mjs (ESM) barrels');
