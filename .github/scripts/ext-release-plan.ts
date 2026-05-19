#!/usr/bin/env tsx
/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Extension Release Plan Display Script
 *
 * This script displays a detailed release plan for VS Code extensions during dry runs.
 * It shows what would happen for each extension including version bumps, release creation,
 * and marketplace publishing.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface PackageJson {
  name: string;
  version: string;
  publisher?: string;
  displayName?: string;
}

interface ReleasePlanOptions {
  branch?: string;
  buildType: string;
  isNightly: string;
  versionBump: string;
  registries: string;
  preRelease: string;
  selectedExtensions: string;
}

function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const [major, minor, patch] = version.split('.').map(Number);
  return { major, minor, patch };
}

function calculateNewVersion(
  currentVersion: string,
  versionBump: string,
): string {
  const { major, minor, patch } = parseVersion(currentVersion);

  switch (versionBump) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    case 'auto':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

function getPackageDetails(extensionPath: string): PackageJson | null {
  try {
    const packageJsonPath = join(
      process.cwd(),
      'packages',
      extensionPath,
      'package.json',
    );
    const content = readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn(
      `Warning: Could not read package.json for ${extensionPath}:`,
      error,
    );
    return null;
  }
}

function displayReleasePlan(options: ReleasePlanOptions): void {
  const {
    branch = 'main',
    buildType,
    isNightly,
    versionBump,
    registries,
    preRelease,
    selectedExtensions,
  } = options;

  console.log('=== EXTENSION RELEASE PLAN ===');
  console.log(`Branch: ${branch}`);
  console.log(`Build type: ${buildType}`);
  console.log(`Is nightly: ${isNightly}`);
  console.log(`Version bump type: ${versionBump}`);
  console.log(`Registries: ${registries}`);
  console.log(`Pre-release: ${preRelease}`);
  console.log('Dry run mode: ENABLED');
  console.log('');

  console.log(`Extensions to release: ${selectedExtensions}`);
  console.log('');

  const extensions = selectedExtensions.split(',').filter(Boolean);

  for (const ext of extensions) {
    const packageDetails = getPackageDetails(ext);
    if (!packageDetails) {
      console.log(`Extension: ${ext} (package.json not found)`);
      continue;
    }

    console.log(`Extension: ${ext}`);
    console.log(`  Current version: ${packageDetails.version}`);
    console.log(`  Publisher: ${packageDetails.publisher || 'N/A'}`);

    const newVersion = calculateNewVersion(packageDetails.version, versionBump);
    console.log(`  Would bump to: ${newVersion}`);

    if (isNightly === 'true') {
      console.log(
        '  Version strategy: Nightly build (odd minor + nightly timestamp)',
      );
    } else {
      console.log(
        `  Version strategy: ${versionBump} (conventional commit) + VS Code even/odd (pre-release: ${preRelease})`,
      );
    }

    const preReleaseText = preRelease === 'true' ? ' (pre-release)' : '';
    console.log(`  Would create GitHub release: ${ext}${preReleaseText}`);

    // Determine which registries to include (same logic as ext-publish-matrix.ts)
    const registryList =
      registries === 'all'
        ? ['vsce', 'ovsx']
        : registries.split(',').filter(Boolean);

    // Show publishing destinations for each registry
    for (const registry of registryList) {
      switch (registry) {
        case 'vsce':
          console.log(
            `  Would publish to: VSCode Marketplace${preReleaseText}`,
          );
          break;
        case 'ovsx':
          console.log(`  Would publish to: Open VSX Registry${preReleaseText}`);
          break;
        default:
          console.log(`  Would publish to: ${registry}${preReleaseText}`);
          break;
      }
    }
    console.log('');
  }

  console.log('✅ Extension release dry run completed');
}

// Export for use in other modules
export { displayReleasePlan as displayExtensionReleasePlan };
