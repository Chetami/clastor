// Generate native DTOs from the same YAML contracts as TypeScript.
// Deliberately reject unsupported schemas instead of silently changing a type.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'src/openapi.yaml');
const students = process.argv.includes('--students');
const namespace = students ? 'StudentModels' : 'AuthModels';
const command = students ? 'swift-students' : 'swift-auth';
const output = path.resolve(root, `../ios/Clastor/Clastor/${students ? 'Students' : 'Auth'}/Generated/${namespace}.swift`);
const spec = yaml.load(fs.readFileSync(entry, 'utf8'));
const schemas = new Map();
const names = new Map();
const roots = students ? ['StudentListResponse'] : ['LoginResponse', 'RefreshTokenResponse', 'VerifyTokenResponse', 'RefreshTokenRequest', 'ApiError'];
const identifier = value => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Unsupported Swift identifier: ${value}`);
  return '`' + value + '`';
};

function register(file) {
  if (schemas.has(file)) return schemas.get(file);
  const name = path.basename(file, '.yaml');
  if (names.has(name) && names.get(name) !== file) throw new Error(`Duplicate schema name: ${name}`);
  names.set(name, file);
  const item = { name, file, schema: yaml.load(fs.readFileSync(file, 'utf8')) };
  schemas.set(file, item);
  return item;
}

function swiftType(schema, file) {
  let type;
  let nullable = schema.nullable === true;
  if (schema.$ref) {
    if (schema.$ref.includes('#')) throw new Error('Only file schema references are supported');
    const item = register(path.resolve(path.dirname(file), schema.$ref));
    type = identifier(item.name);
    nullable ||= item.schema.nullable === true;
  } else if (schema.allOf) {
    if (schema.allOf.length !== 1) throw new Error('Composite allOf requires explicit generator support');
    type = swiftType(schema.allOf[0], file);
  } else {
    type = { string: 'String', boolean: 'Bool', integer: 'Int', number: 'Double' }[schema.type];
    if (schema.type === 'array') type = `[${swiftType(schema.items, file)}]`;
    if (!type) throw new Error(`Unsupported schema type in ${file}: ${schema.type}`);
  }
  return nullable && !type.endsWith('?') ? `${type}?` : type;
}

for (const name of roots) register(path.resolve(path.dirname(entry), spec.components.schemas[name].$ref));
const declarations = [];
// Map iteration also visits dependencies discovered while rendering properties.
for (const { name, file, schema } of schemas.values()) {
  const source = path.relative(root, file).split(path.sep).join('/');
  if (schema.type === 'string' && schema.enum) {
    // Raw string aliases preserve compatibility with newly added server enum values.
    declarations.push(`    // ${source}\n    typealias ${identifier(name)} = String`);
    continue;
  }
  if (schema.type !== 'object' || schema.additionalProperties) throw new Error(`Unsupported object: ${source}`);
  const properties = Object.entries(schema.properties ?? {}).map(([key, property]) => {
    let type = swiftType(property, file);
    if (!(schema.required ?? []).includes(key) && !type.endsWith('?')) type += '?';
    return `        var ${identifier(key)}: ${type}${type.endsWith('?') ? ' = nil' : ''}`;
  });
  declarations.push(`    // ${source}\n    struct ${identifier(name)}: Codable, Equatable, Sendable {\n${properties.join('\n')}\n    }`);
}
const generated = '// Generated from interfaces/src/openapi.yaml. Do not edit.\n' +
  `// Regenerate: npm run build:${command} --workspace=interfaces\n\n` +
  `nonisolated enum ${namespace} {\n${declarations.join('\n\n')}\n}\n`;
if (process.argv.includes('--check')) {
  if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== generated) {
    throw new Error(`Swift models are stale. Run npm run build:${command} --workspace=interfaces`);
  }
} else {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, generated);
}
