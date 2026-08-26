/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// vscode:bundle:migration writes to dist-migration/ (not dist/) so its wireit output never collides
// with vscode:bundle's dist/ output. package.json's main/browser fields are static and shared by every
// `vsce package` invocation, so they're swapped to dist-migration/ paths here for just this packaging
// run, then restored, rather than baked in permanently.
const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url));
const original = readFileSync(packageJsonPath, 'utf8');
const manifest = JSON.parse(original);
manifest.main = 'dist-migration/index.js';
manifest.browser = 'dist-migration/web/index.js';
writeFileSync(packageJsonPath, `${JSON.stringify(manifest, null, 2)}\n`);

try {
  execFileSync(
    'vsce',
    ['package', '--allow-package-all-secrets', '--out', 'salesforcedx-vscode-soql-lit-migration.vsix'],
    { stdio: 'inherit' }
  );
} finally {
  writeFileSync(packageJsonPath, original);
}
