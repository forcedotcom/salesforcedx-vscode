/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NpmPackageDetails, VersionBumpType } from './npm-types';
import { log, setOutput } from './utils';

/**
 * Parse package.json and extract details
 */
function getPackageDetails(packageName: string): {
  name: string;
  version: string;
  description: string;
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
      description: pkg.description || 'No description',
    };
  } catch (error) {
    log.warning(`Failed to parse package.json for ${packageName}: ${error}`);
    return null;
  }
}

/**
 * Extract package details from JSON array string
 */
export function extractPackageDetails(
  selectedPackagesJson: string,
  versionBump: VersionBumpType,
): NpmPackageDetails {
  log.info('Extracting package details...');
  log.debug(`Selected packages JSON: ${selectedPackagesJson}`);
  log.debug(`Version bump: ${versionBump}`);

  const packageNames: string[] = [];
  const packageVersions: string[] = [];
  const packageDescriptions: string[] = [];

  try {
    // Parse the JSON array of selected packages
    if (selectedPackagesJson && selectedPackagesJson !== '[]') {
      const packages = JSON.parse(selectedPackagesJson);

      if (Array.isArray(packages)) {
        for (const packageName of packages) {
          if (packageName && typeof packageName === 'string') {
            const details = getPackageDetails(packageName);

            if (details) {
              packageNames.push(details.name);
              packageVersions.push(details.version);
              packageDescriptions.push(details.description);

              log.debug(
                `Package ${packageName}: ${details.name}@${details.version}`,
              );
            }
          }
        }
      }
    }
  } catch (error) {
    log.error(`Failed to parse selected packages JSON: ${error}`);
  }

  log.info(`Extracted details for ${packageNames.length} packages`);
  log.info(`Package names: ${packageNames.join(', ')}`);
  log.info(`Package versions: ${packageVersions.join(', ')}`);

  return {
    packageNames,
    packageVersions,
    packageDescriptions,
    versionBump,
  };
}

/**
 * Set GitHub Actions outputs for package details
 */
export function setPackageDetailsOutputs(details: NpmPackageDetails): void {
  setOutput('package_names', details.packageNames.join(', '));
  setOutput('package_versions', details.packageVersions.join(', '));
  setOutput('package_descriptions', details.packageDescriptions.join(', '));
  setOutput('version_bump', details.versionBump);

  log.success('Package details outputs set');
}

/**
 * Main function for CLI usage
 */
export async function main(): Promise<void> {
  try {
    const selectedPackagesJson = process.env.SELECTED_PACKAGES || '[]';
    const versionBump =
      (process.env.VERSION_BUMP as VersionBumpType) || 'patch';

    const details = extractPackageDetails(selectedPackagesJson, versionBump);
    setPackageDetailsOutputs(details);
  } catch (error) {
    log.error(`Failed to extract package details: ${error}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
