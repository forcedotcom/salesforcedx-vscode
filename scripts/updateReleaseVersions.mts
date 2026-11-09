#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Update package.json versions for all publishable packages
 * Usage: node updateReleaseVersions.mts <version>
 *
 * Example: node updateReleaseVersions.mts 67.12.0
 */

import { Schema } from 'effect';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { shouldUpdateVersion } from './releasePackageSelection.mts';
import { PackageJsonTextSchema } from './shared/packageJsonSchema.mts';

const releaseVersion = process.argv[2];

if (!releaseVersion) {
  console.error('Error: version argument required');
  process.exit(1);
}

console.log(`Updating packages to version ${releaseVersion}`);

// Find all workspace package.json files using fs.globSync.
const packageFiles = fs.globSync('packages/*/package.json', {
  exclude: ['**/node_modules/**']
});

if (packageFiles.length === 0) {
  console.error('Error: No package.json files found in packages/');
  process.exit(1);
}

let updatedCount = 0;
let errorCount = 0;

packageFiles.forEach(pkgPath => {
  let pkg: Record<string, unknown>;

  // Parse package.json with error handling
  try {
    const content = fs.readFileSync(pkgPath, 'utf8');
    pkg = Schema.decodeUnknownSync(PackageJsonTextSchema)(content);
  } catch (error) {
    console.error(`✗ Error parsing ${pkgPath}: ${error instanceof Error ? error.message : String(error)}`);
    errorCount++;
    return; // Skip this file, continue with others
  }

  // Check if package should be versioned
  if (shouldUpdateVersion(pkg)) {
    console.log(`  Updating ${path.dirname(pkgPath)}`);
    pkg.version = releaseVersion;
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    updatedCount++;
  }
});

// Report results
if (errorCount > 0) {
  console.error(`\n⚠️  Warning: ${errorCount} package.json file(s) had parse errors and were skipped`);
  console.error('Please fix the JSON syntax in the files listed above');
}

console.log(`Updated ${updatedCount} packages`);

// Always update pnpm-lock.yaml to maintain dependency graph integrity.
// This ensures workspace package versions match package.json after version bumps.
console.log('Updating pnpm-lock.yaml to match new versions');
try {
  execSync('pnpm install --ignore-scripts --lockfile-only', { stdio: 'inherit' });
  console.log('✓ pnpm-lock.yaml updated successfully');
} catch (error) {
  console.error('Error updating pnpm-lock.yaml:', error instanceof Error ? error.message : String(error));
  console.error('This may cause version mismatches during build. Please fix manually.');
  process.exit(1);
}
