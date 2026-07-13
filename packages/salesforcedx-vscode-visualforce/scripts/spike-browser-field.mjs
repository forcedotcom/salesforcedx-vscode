/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// W-23358899 spike: VS Code Web reads the `browser` field from the manifest at extensionDevelopmentPath.
// The committed package.json intentionally has NO top-level `browser` so the shipped VSIX (`vsce package`)
// never enables web. `run:web`/`test:web` set VF_WEB_SPIKE=1 so this injects `browser` for the dev/test run only,
// and the manifest is restored to its browser-less committed state afterward.
//
// TIME-BOXED SPIKE ARTIFACT — this manifest-mutating script is a known anti-pattern (see `packageJson` skill).
// It must be DELETED once the go/no-go WI decides how to ship (or not ship) web support; do NOT copy this
// pattern to other extensions. Callers wrap it in a shell `trap ... EXIT INT TERM` so restore runs on Ctrl-C /
// signal termination, not only on normal exit; a SIGKILL / machine crash between add and remove can still leave
// `browser` injected (recover with `git checkout package.json`).
//
// Usage:
//   node scripts/spike-browser-field.mjs add      # inject browser (no-op unless VF_WEB_SPIKE is set)
//   node scripts/spike-browser-field.mjs remove    # restore browser-less manifest
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', 'package.json');
const BROWSER_ENTRY = './dist/web/index.js';

const [, , mode] = process.argv;

const readPkg = async () => JSON.parse(await readFile(pkgPath, 'utf8'));
// 2-space indent + trailing newline matches the committed file, so a no-op run leaves no diff.
const writePkg = async pkg => writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

if (mode === 'add') {
  if (process.env.VF_WEB_SPIKE !== '1') {
    process.exit(0);
  }
  const pkg = await readPkg();
  if (pkg.browser === BROWSER_ENTRY) {
    process.exit(0);
  }
  // Insert `browser` right after `main` so the manifest reads naturally.
  const rebuilt = {};
  for (const [key, value] of Object.entries(pkg)) {
    rebuilt[key] = value;
    if (key === 'main') {
      rebuilt.browser = BROWSER_ENTRY;
    }
  }
  await writePkg(pkg.main ? rebuilt : { ...pkg, browser: BROWSER_ENTRY });
  console.log('[spike-browser-field] injected browser field (VF_WEB_SPIKE=1)');
} else if (mode === 'remove') {
  const pkg = await readPkg();
  if (pkg.browser === undefined) {
    process.exit(0);
  }
  delete pkg.browser;
  await writePkg(pkg);
  console.log('[spike-browser-field] removed browser field');
} else {
  console.error(`[spike-browser-field] unknown mode "${mode}" (expected "add" or "remove")`);
  process.exit(1);
}
