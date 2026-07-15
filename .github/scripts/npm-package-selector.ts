/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { log, setOutput, getExtensionInfo } from './utils';

/**
 * Get all available NPM packages
 */
export function getAvailableNpmPackages(): string[] {
  log.info('Getting all available NPM packages...');

  // Get all packages from the packages directory
  const packagesDir = join(process.cwd(), 'packages');
  const packages: string[] = [];

  if (!existsSync(packagesDir)) {
    log.warning('packages directory not found');
    return [];
  }

  const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const packageName of packageDirs) {
    const packagePath = join(packagesDir, packageName);
    const packageJsonPath = join(packagePath, 'package.json');

    if (existsSync(packageJsonPath)) {
      try {
        const info = getExtensionInfo(packagePath);

        // Only include packages that don't have a publisher (NPM packages)
        if (!info.publisher) {
          packages.push(packageName);
          log.debug(`Found NPM package: ${packageName}`);
        } else {
          log.debug(
            `Skipping VS Code extension: ${packageName} (publisher: ${info.publisher})`,
          );
        }
      } catch (error) {
        log.warning(`Failed to read package.json for ${packageName}: ${error}`);
      }
    }
  }

  log.info(`Found ${packages.length} NPM packages: ${packages.join(', ')}`);
  return packages;
}

/**
 * Parse user-selected packages from environment variable
 */
function parseUserSelectedPackages(selectedPackagesInput?: string): string[] {
  if (!selectedPackagesInput || selectedPackagesInput.trim() === '') {
    log.info('No user selection provided - will use all available packages');
    return [];
  }

  const selected = selectedPackagesInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  log.info(`User selected packages: ${selected.join(', ')}`);
  return selected;
}

/**
 * Intersect user selection with detected changes
 */
function intersectPackages(
  userSelected: string[],
  changedPackages: string[],
  availablePackages: string[],
): string[] {
  // If no user selection, use all changed packages
  if (userSelected.length === 0) {
    log.info('No user selection - using all detected changes');
    return changedPackages;
  }

  // Handle special values
  const normalizedSelection = userSelected.map((s) => s.toLowerCase());

  if (normalizedSelection.includes('none')) {
    log.info('User selected "none" - returning empty selection');
    return [];
  }

  if (normalizedSelection.includes('all')) {
    log.info('User selected "all" - using all available packages');
    return availablePackages;
  }

  if (normalizedSelection.includes('changed')) {
    log.info('User selected "changed" - using all detected changes');
    return changedPackages;
  }

  // Validate user selection against available packages
  const validUserSelected = userSelected.filter((pkg) => {
    if (!availablePackages.includes(pkg)) {
      log.warning(`User selected package '${pkg}' is not available - skipping`);
      return false;
    }
    return true;
  });

  if (validUserSelected.length === 0) {
    log.warning('No valid packages in user selection');
    return [];
  }

  // For specific package selection, intersect with detected changes
  const intersection = validUserSelected.filter((pkg) =>
    changedPackages.includes(pkg),
  );

  log.info(`User selection: ${validUserSelected.join(', ')}`);
  log.info(`Detected changes: ${changedPackages.join(', ')}`);
  log.info(`Intersection: ${intersection.join(', ')}`);

  return intersection;
}

/**
 * Select NPM packages based on user input and detected changes
 */
export function selectNpmPackages(
  userSelectedPackages?: string,
  availablePackages?: string,
  changedPackages?: string,
): string[] {
  log.info('Selecting NPM packages for release...');
  log.debug(`User selected packages: ${userSelectedPackages || 'none'}`);
  log.debug(`Available packages: ${availablePackages || 'none'}`);
  log.debug(`Changed packages: ${changedPackages || 'none'}`);

  // Parse inputs
  const userSelected = parseUserSelectedPackages(userSelectedPackages);
  const available = availablePackages
    ? availablePackages.split(',').filter(Boolean)
    : getAvailableNpmPackages();
  const changed = changedPackages
    ? changedPackages.split(',').filter(Boolean)
    : [];

  log.info(`Available packages: ${available.join(', ')}`);
  log.info(`Changed packages: ${changed.join(', ')}`);

  // Intersect user selection with detected changes
  const finalSelectedPackages = intersectPackages(
    userSelected,
    changed,
    available,
  );

  log.info(`Final selected packages: ${finalSelectedPackages.join(', ')}`);
  return finalSelectedPackages;
}

/**
 * Set GitHub Actions outputs for package selection
 */
export function setPackageSelectionOutputs(selectedPackages: string[]): void {
  setOutput('packages', JSON.stringify(selectedPackages));
  log.success('NPM package selection outputs set');
}

/**
 * Set GitHub Actions outputs for package discovery
 */
export function setPackageDiscoveryOutputs(npmPackages: string[]): void {
  setOutput('npm-packages', JSON.stringify(npmPackages));
  log.success('NPM package discovery outputs set');
}

/**
 * Main function for CLI usage
 */
export async function main(): Promise<void> {
  try {
    const userSelectedPackages = process.env.SELECTED_PACKAGE;
    const availablePackages = process.env.AVAILABLE_PACKAGES;
    const changedPackages = process.env.CHANGED_PACKAGES;

    log.debug(`SELECTED_PACKAGE: "${userSelectedPackages}"`);
    log.debug(`AVAILABLE_PACKAGES: "${availablePackages}"`);
    log.debug(`CHANGED_PACKAGES: "${changedPackages}"`);

    // If we have selection parameters, handle package selection
    if (userSelectedPackages || availablePackages || changedPackages) {
      log.info('Handling package selection...');
      const selectedPackages = selectNpmPackages(
        userSelectedPackages,
        availablePackages,
        changedPackages,
      );
      setPackageSelectionOutputs(selectedPackages);
    } else {
      // Otherwise, just discover available packages
      log.info('Discovering available packages...');
      const npmPackages = getAvailableNpmPackages();
      setPackageDiscoveryOutputs(npmPackages);
    }
  } catch (error) {
    log.error(`Failed to handle NPM packages: ${error}`);
    process.exit(1);
  }
}

// Export main function for use in index.ts
export { main as npmPackageSelectorMain };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
