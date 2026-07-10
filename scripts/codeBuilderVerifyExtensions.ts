#! /usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Version gate: assert each in-scope extension is installed at the version under test, exactly once.
 *
 * The expected version comes from the VSIX filenames (the bytes about to ship). Reads the on-disk
 * package.json in each override dir — activation-independent, so it reflects what the host loads,
 * unlike "Show Running Extensions" which omits un-activated extensions. Fails loud on any mismatch
 * or leftover published-version dir, so specs never run against stale code.
 *
 * Usage: ts-node scripts/codeBuilderVerifyExtensions.ts <container> <vsix-dir>
 */

import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import { readdirSync } from 'node:fs';

const OVERRIDES_DIR = '/base/extension-overrides';

const container = process.argv[2];
const vsixDir = process.argv[3];
if (!container || !vsixDir) {
  console.error('Usage: codeBuilderVerifyExtensions.ts <container> <vsix-dir>');
  process.exit(2);
}

const dockerBash = (script: string): string =>
  execFileSync('docker', ['exec', container, 'bash', '-lc', script], { encoding: 'utf-8' });

const vsixFiles = readdirSync(vsixDir).filter(f => f.endsWith('.vsix'));
if (vsixFiles.length === 0) {
  console.error(`No VSIX found in ${vsixDir}`);
  process.exit(1);
}

/*
 * Built versions come from the monorepo package.json values baked into the VSIX filenames (vsce
 * names them "<name>-<version>.vsix"). Derive expected id→version from the VSIX dir so the gate has
 * a single source of truth and needs no hardcoded version.
 */
const expected = new Map<string, string>();
for (const vsix of vsixFiles) {
  const base = basename(vsix, '.vsix'); // salesforcedx-vscode-core-67.4.0
  const version = base.slice(base.lastIndexOf('-') + 1); // 67.4.0
  const name = base.slice(0, base.lastIndexOf('-')); // salesforcedx-vscode-core
  expected.set(`salesforce.${name}`, version);
}

let failed = false;
for (const [id, want] of expected) {
  /*
   * Exactly one override dir per id (a leftover published-version dir would be a second match). The
   * dir is "<id>-<version>" and versions start with a digit; anchor on "-[0-9]" so a shorter id
   * (salesforcedx-vscode, -org) doesn't prefix-match longer siblings (-apex, -org-browser).
   */
  const dirs = dockerBash(`ls -d ${OVERRIDES_DIR}/${id}-[0-9]* 2>/dev/null || true`)
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);
  if (dirs.length !== 1) {
    console.log(`FAIL ${id}: expected exactly 1 override dir, found ${dirs.length}: ${dirs.join(' ')}`);
    failed = true;
    continue;
  }

  const got = dockerBash(`cat ${dirs[0]}/package.json | jq -r .version`).trim();
  if (got !== want) {
    console.log(`FAIL ${id}: installed version ${got}, expected version under test ${want}`);
    failed = true;
  } else {
    console.log(`OK   ${id}@${got}`);
  }
}

if (failed) {
  console.error('::error::Code Builder extension version gate failed — container is running wrong/mixed versions.');
  process.exit(1);
}
console.log('==> Version gate passed: all in-scope extensions at the versions under test.');
