/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

interface PackageJson {
  name: string;
  version: string;
  publisher?: string;
  displayName?: string;
}

interface VersionBumpOptions {
  versionBump: string;
  selectedExtensions: string;
  preRelease: string;
  isNightly: string;
  isPromotion: string;
  promotionCommitSha?: string;
}

// Export for use in other modules
export type { VersionBumpOptions };

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
  isNightly: boolean,
  isPromotion: boolean,
  preRelease: boolean,
): string {
  const { major, minor, patch } = parseVersion(currentVersion);

  if (isNightly) {
    // Nightly build strategy: respect conventional commit bump type, enforce odd minor
    if (versionBump === 'major') {
      // Breaking change: new major, start at first odd minor
      return `${major + 1}.1.0`;
    } else if (versionBump === 'minor') {
      // New feature: skip to next odd minor (even minors reserved for stable)
      const nextMinor = minor % 2 === 0 ? minor + 1 : minor + 2;
      return `${major}.${nextMinor}.0`;
    } else {
      // Patch / auto / default: ensure odd minor then increment patch
      if (minor % 2 === 0) {
        // Even minor — enter nightly track at next odd minor
        return `${major}.${minor + 1}.0`;
      }
      return `${major}.${minor}.${patch + 1}`;
    }
  } else if (isPromotion) {
    // Promotion strategy: bump from odd minor (nightly) to even minor (stable)
    if (minor % 2 === 1) {
      // Current is odd (nightly), bump to next even (stable)
      return `${major}.${minor + 1}.0`;
    } else {
      // Current is already even, this shouldn't happen for promotions
      console.warn(
        'Warning: Current version has even minor, expected odd for promotion',
      );
      return `${major}.${minor + 2}.0`;
    }
  } else {
    // Regular build strategy: use smart version bumping
    switch (versionBump) {
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      case 'minor':
        if (preRelease) {
          // Pre-release: ensure odd minor version (no auto-update)
          if (minor % 2 === 0) {
            return `${major}.${minor + 1}.0`;
          } else {
            return `${major}.${minor + 2}.0`;
          }
        } else {
          // Stable release: ensure even minor version (auto-update enabled)
          if (minor % 2 === 1) {
            return `${major}.${minor + 1}.0`;
          } else {
            return `${major}.${minor + 2}.0`;
          }
        }
      case 'major':
        if (preRelease) {
          return `${major + 1}.1.0`; // Pre-release: start with odd minor
        } else {
          return `${major + 1}.0.0`; // Stable release: start with even minor
        }
      case 'auto':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
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

function createGitTag(
  packageName: string,
  version: string,
  isPreRelease: boolean,
  promotionCommitSha?: string,
  isNightly?: boolean,
): void {
  // For nightly builds, create tag in format: v{version}-nightly.{date}
  // This matches what GitHub release creation expects
  let tagName: string;
  if (isNightly) {
    const nightlyDate = new Date()
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '');
    const branch = process.env.BRANCH || 'main';
    const branchSuffix =
      branch === 'main' ? '' : `.${branch.replace(/\//g, '-')}`;
    tagName = `v${version}-nightly${branchSuffix}.${nightlyDate}`;
  } else {
    // For non-nightly builds, use package name format
    tagName = isPreRelease
      ? `${packageName}-v${version}-pre-release`
      : `${packageName}-v${version}`;
  }

  try {
    // Check if tag already exists locally or remotely (idempotency)
    let tagExists = false;
    try {
      // Check local tags first
      execSync(`git rev-parse "${tagName}"`, { encoding: 'utf8', stdio: 'pipe' });
      tagExists = true;
    } catch {
      // Tag doesn't exist locally, check remote
      try {
        execSync(`git ls-remote --tags origin "${tagName}"`, { encoding: 'utf8', stdio: 'pipe' });
        tagExists = true;
      } catch {
        // Tag doesn't exist locally or remotely, proceed to create
        tagExists = false;
      }
    }

    if (tagExists) {
      console.log(`⏭️ Tag ${tagName} already exists — skipping (idempotent rerun)`);
      return;
    }

    if (promotionCommitSha) {
      // For promotions, create tag on specific commit
      console.log(
        `Creating tag ${tagName} on promotion commit ${promotionCommitSha}...`,
      );
      execSync(`git tag "${tagName}" "${promotionCommitSha}"`, {
        stdio: 'inherit',
      });
    } else {
      // For regular builds, create tag on current commit
      console.log(`Creating tag ${tagName} on current commit...`);
      execSync(`git tag "${tagName}"`, {
        stdio: 'inherit',
      });
    }
    console.log(`✅ Tag created: ${tagName}`);
  } catch (error) {
    console.error(`Failed to create tag ${tagName}:`, error);
    throw error;
  }
}

function bumpVersions(options: VersionBumpOptions): void {
  const {
    versionBump,
    selectedExtensions,
    preRelease,
    isNightly,
    isPromotion,
    promotionCommitSha,
  } = options;

  console.log(`Version bump type: ${versionBump}`);
  console.log(`Selected extensions: ${selectedExtensions}`);
  console.log(`Pre-release mode: ${preRelease}`);
  console.log(`Is nightly build: ${isNightly}`);
  console.log(`Is promotion: ${isPromotion}`);
  console.log(`Promotion commit SHA: ${promotionCommitSha || 'N/A'}`);

  const extensions = selectedExtensions.split(',').filter(Boolean);

  for (const ext of extensions) {
    const packageDetails = getPackageDetails(ext);
    if (!packageDetails) {
      console.warn(`Skipping ${ext}: package.json not found`);
      continue;
    }

    console.log(`Processing ${ext}...`);
    console.log(`Current version: ${packageDetails.version}`);

    const newVersion = calculateNewVersion(
      packageDetails.version,
      versionBump,
      isNightly === 'true',
      isPromotion === 'true',
      preRelease === 'true',
    );

    console.log(
      `🔄 Bumping ${ext} from ${packageDetails.version} to ${newVersion}`,
    );

    // Update package.json version
    const originalDir = process.cwd();
    try {
      process.chdir(join(originalDir, 'packages', ext));
      execSync(`npm version "${newVersion}" --no-git-tag-version`, {
        stdio: 'inherit',
      });
      process.chdir(originalDir);

      // Create git tag for this extension
      const isNightlyBuild = isNightly === 'true';
      let expectedTagName: string;
      if (isNightlyBuild) {
        const nightlyDate = new Date()
          .toISOString()
          .split('T')[0]
          .replace(/-/g, '');
        const branch = process.env.BRANCH || 'main';
        const branchSuffix =
          branch === 'main' ? '' : `.${branch.replace(/\//g, '-')}`;
        expectedTagName = `v${newVersion}-nightly${branchSuffix}.${nightlyDate}`;
      } else {
        expectedTagName = preRelease === 'true'
          ? `${packageDetails.name}-v${newVersion}-pre-release`
          : `${packageDetails.name}-v${newVersion}`;
      }
      createGitTag(
        packageDetails.name,
        newVersion,
        preRelease === 'true',
        promotionCommitSha,
        isNightlyBuild,
      );
    } catch (error) {
      console.error(`Failed to bump version for ${ext}:`, error);
      process.chdir(originalDir);
      throw error;
    }
  }

  console.log('✅ Version bumps and tags applied');
}

// Export for use in other modules
export { bumpVersions };
