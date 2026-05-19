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
  BuildContext,
  ChangeDetectionResult,
  ExtensionInfo,
  TagWithVersion,
} from './types';
import {
  log,
  setOutput,
  getExtensionInfo,
  compareSemver,
  extractVersionFromTag,
} from './utils';

/**
 * Get all available VS Code extensions (packages with publisher field)
 */
function getAvailableExtensions(): ExtensionInfo[] {
  const extensions: ExtensionInfo[] = [];
  const packagesDir = join(process.cwd(), 'packages');

  if (!existsSync(packagesDir)) {
    log.warning('packages directory not found');
    return extensions;
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

        // Only include packages that have a publisher (VS Code extensions)
        if (info.publisher) {
          extensions.push({
            name: packageName,
            path: packagePath,
            currentVersion: info.version,
            publisher: info.publisher,
            displayName: info.displayName,
          });
          log.debug(
            `Found VS Code extension: ${packageName} (publisher: ${info.publisher})`,
          );
        } else {
          log.debug(`Skipping NPM package: ${packageName} (no publisher)`);
        }
      } catch (error) {
        log.warning(`Failed to read package.json for ${packageName}: ${error}`);
      }
    }
  }

  return extensions;
}

/**
 * Check if extension has changes since last release
 */
async function hasExtensionChanges(
  git: any,
  extensionPath: string,
  lastTag: string | null,
): Promise<boolean> {
  if (!lastTag) {
    // No previous tag, check if extension has any files
    const files = readdirSync(extensionPath, { recursive: true });
    return files.length > 0;
  }

  try {
    // Check for changes since the last release tag
    const diff = await git.diff([lastTag, 'HEAD', '--', extensionPath]);
    return diff.trim().length > 0;
  } catch (error) {
    log.warning(`Failed to check changes for ${extensionPath}: ${error}`);
    return false;
  }
}

/**
 * Find the last release tag for a specific extension
 */
async function findLastReleaseTagForExtension(
  git: any,
  extensionName: string,
): Promise<string | null> {
  try {
    const tags = await git.tags();
    const extensionTags: TagWithVersion[] = tags.all
      .filter((tag: string) => tag.startsWith(`${extensionName}-v`))
      .map((tag: string) => {
        const version = extractVersionFromTag(tag);
        return { tag, version };
      })
      .filter((item) => item.version !== null) // Filter out tags we couldn't parse
      .sort((a, b) =>
        // Use proper semver comparison (descending order - newest first)
        compareSemver(b.version!, a.version!),
      );

    return extensionTags.length > 0 ? extensionTags[0].tag : null;
  } catch (error) {
    log.warning(`Failed to get tags for ${extensionName}: ${error}`);
    return null;
  }
}

/**
 * Parse user-selected extensions from environment variable
 */
function parseUserSelectedExtensions(
  selectedExtensionsInput?: string,
): string[] {
  if (!selectedExtensionsInput || selectedExtensionsInput.trim() === '') {
    log.info('No user selection provided - will use all available extensions');
    return [];
  }

  const selected = selectedExtensionsInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  log.info(`User selected extensions: ${selected.join(', ')}`);
  return selected;
}

/**
 * Intersect user selection with detected changes
 */
function intersectExtensions(
  userSelected: string[],
  changedExtensions: string[],
  availableExtensions: ExtensionInfo[],
  buildContext: BuildContext,
): string[] {
  const availableNames = availableExtensions.map((e) => e.name);

  // If no user selection, use all changed extensions
  if (userSelected.length === 0) {
    log.info('No user selection - using all detected changes');
    return changedExtensions;
  }

  // Handle special values
  const normalizedSelection = userSelected.map((s) => s.toLowerCase());

  if (normalizedSelection.includes('none')) {
    log.info('User selected "none" - returning empty selection');
    return [];
  }

  if (normalizedSelection.includes('all')) {
    log.info('User selected "all" - using all available extensions');
    return availableNames;
  }

  if (normalizedSelection.includes('changed')) {
    log.info('User selected "changed" - using all detected changes');
    return changedExtensions;
  }

  // Validate user selection against available extensions
  const validUserSelected = userSelected.filter((ext) => {
    if (!availableNames.includes(ext)) {
      log.warning(
        `User selected extension '${ext}' is not available - skipping`,
      );
      return false;
    }
    return true;
  });

  if (validUserSelected.length === 0) {
    log.warning('No valid extensions in user selection');
    return [];
  }

  // For nightly builds and promotions, use user selection if provided
  if (buildContext.isNightly || buildContext.isPromotion) {
    const buildType = buildContext.isNightly ? 'Nightly' : 'Promotion';
    log.info(
      `${buildType} build - using user selection: ${validUserSelected.join(', ')}`,
    );
    return validUserSelected;
  }

  // For regular builds, intersect user selection with detected changes
  const intersection = validUserSelected.filter((ext) =>
    changedExtensions.includes(ext),
  );

  log.info(`User selection: ${validUserSelected.join(', ')}`);
  log.info(`Detected changes: ${changedExtensions.join(', ')}`);
  log.info(`Intersection: ${intersection.join(', ')}`);

  return intersection;
}

/**
 * Determine the highest required version bump from conventional commits since a tag.
 * Returns 'major', 'minor', or 'patch'.
 */
async function detectBumpTypeFromCommits(
  git: any,
  extensionPath: string,
  lastTag: string | null,
): Promise<'major' | 'minor' | 'patch'> {
  try {
    const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
    const log_ = await git.log({
      from: lastTag || undefined,
      to: 'HEAD',
      '--': null,
      _: [extensionPath],
    });
    const messages: string[] = log_.all.map((c: any) => c.message as string);

    let bump: 'major' | 'minor' | 'patch' = 'patch';
    for (const msg of messages) {
      const firstLine = msg.split('\n')[0];
      const body = msg;
      if (
        /BREAKING CHANGE/i.test(body) ||
        /^[a-z]+(\([^)]*\))?!:/i.test(firstLine)
      ) {
        return 'major';
      }
      if (/^feat(\([^)]*\))?:/i.test(firstLine) && bump !== 'major') {
        bump = 'minor';
      }
    }
    log.debug(`Detected bump type from commits (${range}): ${bump}`);
    return bump;
  } catch (error) {
    log.warning(`Failed to analyze commits for bump type: ${error}`);
    return 'patch';
  }
}

/**
 * Detect changes in extensions
 */
export async function detectExtensionChanges(
  buildContext: BuildContext,
  promotionCommitSha?: string,
  userSelectedExtensions?: string,
): Promise<ChangeDetectionResult> {
  log.info('Detecting changes in extensions...');
  log.debug(`Build context: ${JSON.stringify(buildContext)}`);
  log.debug(`Promotion commit SHA: ${promotionCommitSha || 'none'}`);
  log.debug(`User selected extensions: ${userSelectedExtensions || 'none'}`);

  const git = simpleGit();
  const extensions = getAvailableExtensions();
  const changedExtensions: string[] = [];
  let versionBumps = buildContext.versionBump;

  log.info(
    `Found ${extensions.length} extensions: ${extensions.map((e) => e.name).join(', ')}`,
  );

  // Parse user selection
  const userSelected = parseUserSelectedExtensions(userSelectedExtensions);

  // For promotions, always include all extensions
  if (buildContext.isPromotion) {
    log.info('Promotion detected - including all extensions');
    changedExtensions.push(...extensions.map((e) => e.name));
  }
  // For nightly and regular builds, check for changes since last release
  else {
    const buildType = buildContext.isNightly ? 'Nightly' : 'Regular';
    log.info(`${buildType} build - checking for changes...`);

    for (const extension of extensions) {
      log.debug(`Checking extension: ${extension.name}`);

      // Find the last release tag for this specific extension
      const lastTag = await findLastReleaseTagForExtension(git, extension.name);

      if (lastTag) {
        log.info(
          `Comparing ${extension.name} against last release tag: ${lastTag}`,
        );
      } else {
        log.info(
          `No previous release tag found for ${extension.name} - treating as first release`,
        );
      }

      const hasChanges = await hasExtensionChanges(
        git,
        extension.path,
        lastTag,
      );

      if (hasChanges) {
        log.info(
          `Found changes in ${extension.name} - including in ${buildType.toLowerCase()} release`,
        );
        changedExtensions.push(extension.name);

        // For nightly builds with auto bump type, analyze conventional commits
        // to determine the appropriate bump level
        if (
          buildContext.isNightly &&
          (buildContext.versionBump === 'auto' ||
            buildContext.versionBump === 'patch')
        ) {
          const detectedBump = await detectBumpTypeFromCommits(
            git,
            extension.path,
            lastTag,
          );
          if (
            detectedBump === 'major' ||
            (detectedBump === 'minor' && versionBumps !== 'major')
          ) {
            log.info(
              `Upgrading bump type for ${extension.name}: ${versionBumps} → ${detectedBump} (conventional commits)`,
            );
            versionBumps = detectedBump;
          }
        }
      } else {
        log.info(
          `No changes found in ${extension.name} - skipping ${buildType.toLowerCase()} release`,
        );
      }
    }
  }

  // Intersect user selection with detected changes
  const finalSelectedExtensions = intersectExtensions(
    userSelected,
    changedExtensions,
    extensions,
    buildContext,
  );

  log.info(`Final selected extensions: ${finalSelectedExtensions.join(', ')}`);
  log.info(`Version bump type: ${versionBumps}`);

  return {
    selectedExtensions: finalSelectedExtensions,
    versionBumps,
    promotionCommitSha,
  };
}

/**
 * Set GitHub Actions outputs for change detection
 */
export function setChangeDetectionOutputs(result: ChangeDetectionResult): void {
  setOutput('selected-extensions', result.selectedExtensions.join(','));
  setOutput('version-bumps', result.versionBumps);
  if (result.promotionCommitSha) {
    setOutput('promotion-commit-sha', result.promotionCommitSha);
  }

  log.success('Change detection outputs set');
}

/**
 * Main function for CLI usage
 */
export async function main(): Promise<void> {
  try {
    // For CLI usage, we need to parse the build context from environment
    // This would typically come from the previous job's outputs
    const isNightly = process.env.IS_NIGHTLY === 'true';
    const versionBump = (process.env.VERSION_BUMP as any) || 'auto';
    const preRelease = process.env.PRE_RELEASE === 'true';
    const isPromotion = process.env.IS_PROMOTION === 'true';
    const promotionCommitSha = process.env.PROMOTION_COMMIT_SHA;
    const userSelectedExtensions = process.env.SELECTED_EXTENSIONS;
    log.info(
      `Raw SELECTED_EXTENSIONS env var: "${process.env.SELECTED_EXTENSIONS}"`,
    );

    const buildContext: BuildContext = {
      isNightly,
      versionBump,
      preRelease,
      isPromotion,
      promotionCommitSha,
    };

    const result = await detectExtensionChanges(
      buildContext,
      promotionCommitSha,
      userSelectedExtensions,
    );
    setChangeDetectionOutputs(result);
  } catch (error) {
    log.error(`Failed to determine changes: ${error}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
