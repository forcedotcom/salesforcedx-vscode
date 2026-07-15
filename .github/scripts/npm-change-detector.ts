/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { simpleGit } from 'simple-git';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import {
  NpmPackageInfo,
  NpmChangeDetectionResult,
  VersionBumpType,
} from './npm-types.js';
import { log, setOutput, getExtensionInfo } from './utils';

/**
 * Get all available NPM packages (packages without publisher field)
 */
function getAvailableNpmPackages(): NpmPackageInfo[] {
  const packages: NpmPackageInfo[] = [];
  const packagesDir = join(process.cwd(), 'packages');

  if (!existsSync(packagesDir)) {
    log.warning('packages directory not found');
    return packages;
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
          packages.push({
            name: packageName,
            path: packagePath,
            currentVersion: info.version,
            description: info.displayName,
            isExtension: false,
          });
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

  return packages;
}

/**
 * Check if package has changes since base branch
 */
async function hasPackageChanges(
  git: any,
  packagePath: string,
  baseBranch: string,
): Promise<boolean> {
  try {
    // Check for changes since the base branch
    const diff = await git.diff([
      `origin/${baseBranch}`,
      'HEAD',
      '--',
      packagePath,
    ]);
    return diff.trim().length > 0;
  } catch (error) {
    log.warning(`Failed to check changes for ${packagePath}: ${error}`);
    return false;
  }
}

/**
 * Determine version bump type from commit messages
 */
async function determineVersionBump(git: any): Promise<VersionBumpType> {
  try {
    const logResult = await git.log({ maxCount: 5 });
    const commitMessages = logResult.all
      .map((commit: any) => commit.message)
      .join('\n');

    log.debug('Analyzing commit messages for version bump:');
    log.debug(commitMessages);

    if (
      commitMessages.toLowerCase().includes('breaking') ||
      commitMessages.toLowerCase().includes('major')
    ) {
      log.info('Found breaking change - using major bump');
      return 'major';
    } else if (
      commitMessages.toLowerCase().includes('feat') ||
      commitMessages.toLowerCase().includes('feature') ||
      commitMessages.toLowerCase().includes('minor')
    ) {
      log.info('Found feature - using minor bump');
      return 'minor';
    } else {
      log.info('No breaking changes or features found - using patch bump');
      return 'patch';
    }
  } catch (error) {
    log.warning(
      `Failed to determine version bump: ${error}, defaulting to patch`,
    );
    return 'patch';
  }
}

/**
 * Detect changes in NPM packages
 */
export async function detectNpmChanges(
  baseBranch: string = 'main',
): Promise<NpmChangeDetectionResult> {
  log.info('Detecting changes in NPM packages...');
  log.debug(`Base branch: ${baseBranch}`);

  const git = simpleGit();

  // Verify base branch exists
  try {
    const branches = await git.branch(['-r']);
    const baseBranchExists = branches.all.some((branch: string) =>
      branch.includes(`origin/${baseBranch}`),
    );

    if (!baseBranchExists) {
      log.warning(
        `Base branch 'origin/${baseBranch}' does not exist, falling back to 'main'`,
      );
      baseBranch = 'main';
    }
  } catch (error) {
    log.warning(`Failed to check base branch: ${error}, using 'main'`);
    baseBranch = 'main';
  }

  // Get all NPM packages (packages without publisher field)
  const npmPackages = getAvailableNpmPackages();

  log.info(
    `Found ${npmPackages.length} NPM packages: ${npmPackages.map((p) => p.name).join(', ')}`,
  );

  // Check for changes in each package
  const changedPackages: string[] = [];

  for (const pkg of npmPackages) {
    log.debug(`Checking package: ${pkg.name}`);

    const hasChanges = await hasPackageChanges(git, pkg.path, baseBranch);

    if (hasChanges) {
      log.info(`Found changes in ${pkg.name} - including in release`);
      changedPackages.push(pkg.name);
    } else {
      log.info(`No changes found in ${pkg.name} - skipping release`);
    }
  }

  // Determine version bump type
  const versionBump = await determineVersionBump(git);

  log.info(`Changed packages: ${changedPackages.join(', ')}`);
  log.info(`Version bump type: ${versionBump}`);

  return {
    changedPackages,
    selectedPackages: [], // Will be set by package selector
    versionBump,
  };
}

/**
 * Set GitHub Actions outputs for NPM change detection
 */
export function setNpmChangeDetectionOutputs(
  result: NpmChangeDetectionResult,
): void {
  setOutput('packages', result.changedPackages.join(','));
  setOutput('bump', result.versionBump);

  log.success('NPM change detection outputs set');
}

/**
 * Main function for CLI usage
 */
export async function main(): Promise<void> {
  try {
    const baseBranch = process.env.INPUT_BASE_BRANCH || 'main';
    const result = await detectNpmChanges(baseBranch);
    setNpmChangeDetectionOutputs(result);
  } catch (error) {
    log.error(`Failed to detect NPM changes: ${error}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
