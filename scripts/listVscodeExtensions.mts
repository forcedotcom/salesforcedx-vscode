#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * List all VS Code extension names from the monorepo workspace.
 *
 * Usage: node scripts/listVscodeExtensions.mts
 *
 * Scans all packages in the workspace and outputs a comma-separated list
 * of VS Code extension names (those with "engines.vscode" in package.json).
 *
 * Example output: salesforcedx-vscode-apex,salesforcedx-vscode-core,...
 */

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

// Find all VS Code extensions in packages/
const extensions: string[] = [];
const packageDirs = fs.readdirSync(PACKAGES_DIR);

for (const dir of packageDirs) {
  const packageJsonPath = path.join(PACKAGES_DIR, dir, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    continue;
  }

  try {
    const pkg: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Publishable VS Code extensions have "engines.vscode", "publisher", "categories"
    // Includes main bundle (salesforcedx-vscode) + individual extensions (salesforcedx-vscode-*)
    // Filters out language servers, scoped packages, internal packages
    if (
      typeof pkg === 'object' &&
      pkg !== null &&
      'engines' in pkg &&
      typeof pkg.engines === 'object' &&
      pkg.engines !== null &&
      'vscode' in pkg.engines &&
      pkg.engines.vscode &&
      'publisher' in pkg &&
      pkg.publisher &&
      'categories' in pkg &&
      Array.isArray(pkg.categories) &&
      pkg.categories.length > 0 &&
      'name' in pkg &&
      typeof pkg.name === 'string' &&
      pkg.name.startsWith('salesforcedx-vscode')
    ) {
      extensions.push(pkg.name);
    }
  } catch (err) {
    console.error(`Warning: Failed to parse ${packageJsonPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

if (extensions.length === 0) {
  console.error('No VS Code extensions found in packages/');
  process.exit(1);
}

// Sort with main bundle (salesforcedx-vscode) first, then alphabetical
const sortedExtensions = extensions.toSorted((a, b) => {
  if (a === 'salesforcedx-vscode') return -1;
  if (b === 'salesforcedx-vscode') return 1;
  return a.localeCompare(b);
});

process.stdout.write(sortedExtensions.join(','));
