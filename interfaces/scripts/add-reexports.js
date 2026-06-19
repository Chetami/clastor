const fs = require('fs');

const content = fs.readFileSync('dist/index.d.ts', 'utf8');

const types = ['ApiError', 'JwtPayload', 'LoginRequest', 'LoginResponse', 'UserInfo', 'Role', 'User'];

const reexports =
  '\n// Re-export types at top level for backward compatibility\n' +
  types.map(t => `export type ${t} = components['schemas']['${t}']`).join(';\n') +
  ';\n';

fs.writeFileSync('dist/index.d.ts', content + reexports);

console.log('✓ Added type re-exports for backward compatibility');
