#!/usr/bin/env node
/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 * Runs VS Code for the Web with the LWC extension loaded from a built VSIX.
 * 1. Finds the .vsix in the package directory (run `npm run vscode:package:legacy` first).
 * 2. Extracts it to .vsix-web-run/
 * 3. Launches vscode-test-web with --extensionDevelopmentPath pointing at the extracted folder.
 */

import { execSync, spawn } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(__dirname, '..');

const vsixFiles = readdirSync(packageDir).filter(f => f.endsWith('.vsix'));
if (vsixFiles.length === 0) {
  console.error('No .vsix found. Run: npm run vscode:package:legacy');
  process.exit(1);
}
if (vsixFiles.length > 1) {
  console.error('Multiple .vsix files found. Remove old ones or run vscode:package:legacy once.');
  process.exit(1);
}

const vsixPath = join(packageDir, vsixFiles[0]);
const extractDir = join(packageDir, '.vsix-web-run');

if (existsSync(extractDir)) {
  rmSync(extractDir, { recursive: true });
}
mkdirSync(extractDir, { recursive: true });
execSync(`unzip -o -q "${vsixPath}" -d "${extractDir}"`, { stdio: 'inherit' });

const args = [
  'vscode-test-web',
  '--browserType=chromium',
  '--browserOption=--disable-web-security',
  '--browserOption=--remote-debugging-port=9222',
  '--extensionDevelopmentPath',
  extractDir,
  '--extensionPath',
  resolve(packageDir, '../salesforcedx-vscode-org-browser'),
  '--extensionPath',
  resolve(packageDir, '../salesforcedx-vscode-services'),
  '--open-devtools',
  '--port',
  '3001',
  '--verbose',
  '--printServerLog',
  '--quality',
  'stable'
];

const child = spawn('npx', args, {
  stdio: 'inherit',
  cwd: packageDir,
  shell: true
});
child.on('exit', (code, signal) => {
  rmSync(extractDir, { recursive: true, force: true });
  process.exit(code ?? (signal ? 1 : 0));
});
