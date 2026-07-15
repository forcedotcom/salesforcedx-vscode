/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NpmReleasePlan, VersionBumpType } from './npm-types';
import { log, parseVersion, formatVersion } from './utils';

/**
 * Calculate new version based on current version and bump type
 */
function calculateNewVersion(
  currentVersion: string,
  versionBump: VersionBumpType,
): string {
  try {
    const { major, minor, patch } = parseVersion(currentVersion);

    switch (versionBump) {
      case 'major':
        return formatVersion(major + 1, 0, 0);
      case 'minor':
        return formatVersion(major, minor + 1, 0);
      case 'patch':
        return formatVersion(major, minor, patch + 1);
      default:
        log.warning(
          `Unknown version bump type: ${versionBump}, defaulting to patch`,
        );
        return formatVersion(major, minor, patch + 1);
    }
  } catch (error) {
    log.error(`Failed to calculate new version: ${error}`);
    return currentVersion;
  }
}

/**
 * Get package information
 */
function getPackageInfo(packageName: string): {
  name: string;
  version: string;
} | null {
  const packagePath = join(process.cwd(), 'packages', packageName);
  const packageJsonPath = join(packagePath, 'package.json');

  if (!existsSync(packageJsonPath)) {
    log.warning(`package.json not found for ${packageName}`);
    return null;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    return {
      name: pkg.name || packageName,
      version: pkg.version || '0.0.0',
    };
  } catch (error) {
    log.warning(`Failed to parse package.json for ${packageName}: ${error}`);
    return null;
  }
}

/**
 * Generate release plan for a package
 */
export function generateReleasePlan(
  packageName: string,
  versionBump: VersionBumpType,
  dryRun: boolean = false,
): NpmReleasePlan | null {
  log.info(`Generating release plan for ${packageName}...`);

  const packageInfo = getPackageInfo(packageName);
  if (!packageInfo) {
    log.error(`Failed to get package info for ${packageName}`);
    return null;
  }

  const newVersion = calculateNewVersion(packageInfo.version, versionBump);

  log.info(`Package: ${packageInfo.name}`);
  log.info(`Current version: ${packageInfo.version}`);
  log.info(`New version: ${newVersion}`);
  log.info(`Version bump: ${versionBump}`);
  log.info(`Dry run: ${dryRun}`);

  return {
    package: packageInfo.name,
    currentVersion: packageInfo.version,
    newVersion,
    versionBump,
    dryRun,
  };
}

/**
 * Display release plan
 */
export function displayReleasePlan(plan: NpmReleasePlan): void {
  console.log('=== NPM RELEASE PLAN ===');
  console.log(`Package: ${plan.package}`);
  console.log(`Current version: ${plan.currentVersion}`);
  console.log(`New version: ${plan.newVersion}`);
  console.log(`Version bump type: ${plan.versionBump}`);
  console.log(`Dry run mode: ${plan.dryRun ? 'ENABLED' : 'DISABLED'}`);
  console.log('');
  console.log(`Would bump to: ${plan.newVersion}`);
  console.log('Would publish to: npmjs.org');
  console.log('');
}

/**
 * Main function for CLI usage
 */
export async function main(): Promise<void> {
  try {
    const packageName = process.env.MATRIX_PACKAGE;
    const versionBump =
      (process.env.VERSION_BUMP as VersionBumpType) || 'patch';
    const dryRun = process.env.DRY_RUN === 'true';

    if (!packageName) {
      log.error('MATRIX_PACKAGE environment variable is required');
      process.exit(1);
    }

    const plan = generateReleasePlan(packageName, versionBump, dryRun);
    if (plan) {
      displayReleasePlan(plan);
    } else {
      log.error('Failed to generate release plan');
      process.exit(1);
    }
  } catch (error) {
    log.error(`Failed to generate release plan: ${error}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
