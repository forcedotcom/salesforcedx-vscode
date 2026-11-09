#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/**
 * Removes compiled outputs and Wireit caches across the repo without deleting
 * node_modules, without `git clean`, and without unlinking npm-linked packages.
 * For full reset (including deps), use `pnpm clean`.
 */

import { getErrorMessage } from '@salesforce/salesforcedx-utils';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

const rmPath = (p: string) => {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (err) {
    console.error(`Failed to remove ${p}:`, getErrorMessage(err));
    process.exitCode = 1;
  }
};

const rmIfExists = (p: string) => {
  if (fs.existsSync(p)) {
    rmPath(p);
  }
};

const rmVsixInDir = (dir: string) => {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.endsWith('.vsix')) {
      rmIfExists(path.join(dir, name));
    }
  }
};

const rmTgzInDir = (dir: string) => {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name.endsWith('.tgz')) {
      rmIfExists(path.join(dir, name));
    }
  }
};

/** Default outputs matching workspace `clean` scripts minus node_modules. */
const cleanPackageStandard = (
  pkgRoot: string,
  directories = ['out', 'dist', 'lib', 'coverage', '.nyc_output', '.wireit']
) => {
  for (const d of directories) {
    rmIfExists(path.join(pkgRoot, d));
  }
  for (const f of ['.eslintcache', '.circular-deps.json']) {
    rmIfExists(path.join(pkgRoot, f));
  }
  rmVsixInDir(pkgRoot);
  rmIfExists(path.join(pkgRoot, 'tsconfig.tsbuildinfo'));
};

const cleanGithubActionsLib = () => {
  const actionsRoot = path.join(repoRoot, '.github', 'actions');
  if (!fs.existsSync(actionsRoot)) {
    return;
  }
  for (const name of fs.readdirSync(actionsRoot)) {
    rmIfExists(path.join(actionsRoot, name, 'lib'));
  }
};

/** Aligns with packages/salesforcedx-vscode-apex `clean` but skips node_modules. */
const cleanApexPackage = (pkgRoot: string) => {
  cleanPackageStandard(pkgRoot, ['dist', 'lib', 'coverage', '.nyc_output', '.wireit']);
  const outDir = path.join(pkgRoot, 'out');
  if (fs.existsSync(outDir)) {
    const jarCleaner = path.join(repoRoot, 'scripts', 'cleanAllButJar.mts');
    const r = spawnSync(process.execPath, [jarCleaner], {
      cwd: outDir,
      stdio: 'inherit'
    });
    if (r.status !== 0) {
      process.exitCode = r.status ?? 1;
    }
  }
};

const cleanServicesTypes = (pkgRoot: string) => {
  for (const d of ['out', 'dist', '.wireit']) {
    rmIfExists(path.join(pkgRoot, d));
  }
  rmIfExists(path.join(pkgRoot, '.eslintcache'));
  rmTgzInDir(pkgRoot);
};

const main = () => {
  rmIfExists(path.join(repoRoot, '.wireit'));
  rmIfExists(path.join(repoRoot, 'coverage'));
  cleanGithubActionsLib();

  const packagesDir = path.join(repoRoot, 'packages');
  const names = fs.readdirSync(packagesDir, { withFileTypes: true });
  for (const ent of names) {
    if (!ent.isDirectory()) {
      continue;
    }
    const pkgRoot = path.join(packagesDir, ent.name);
    switch (ent.name) {
      case 'salesforcedx-vscode-apex':
        cleanApexPackage(pkgRoot);
        break;
      case 'salesforcedx-vscode-services':
        cleanPackageStandard(pkgRoot);
        rmIfExists(path.join(pkgRoot, 'resources'));
        break;
      case 'salesforcedx-vscode-services-types':
        cleanServicesTypes(pkgRoot);
        break;
      case 'salesforcedx-vscode-soql':
        cleanPackageStandard(pkgRoot);
        rmIfExists(path.join(pkgRoot, 'src', 'soql-builder-ui', 'dist'));
        break;
      default:
        cleanPackageStandard(pkgRoot);
        break;
    }
  }
};

main();
