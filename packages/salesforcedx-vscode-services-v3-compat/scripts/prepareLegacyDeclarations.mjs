import fs from 'node:fs';

const snapshot = fs.readFileSync(
  new URL('../../salesforcedx-vscode-services-types/legacy/services.d.ts', import.meta.url),
  'utf8'
);
// Preserve the original CommonJS declaration scope, including extensionless SDK type imports.
const declarations = `${snapshot}\nexport type { ConnectionService, AliasService, ConfigService, getDefaultOrgRef };\n`;
for (const relative of ['../src/legacy/services.d.cts', '../out/legacy/services.d.cts']) {
  const destination = new URL(relative, import.meta.url);
  fs.mkdirSync(new URL('.', destination), { recursive: true });
  fs.writeFileSync(destination, declarations);
}
