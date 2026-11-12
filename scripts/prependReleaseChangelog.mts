#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Prepends the release CHANGELOG from packages/salesforcedx-vscode/ to root CHANGELOG.md.
 *
 * This script is run after merging a release branch to develop. It takes the new release notes
 * from packages/salesforcedx-vscode/CHANGELOG.md and prepends them to the root CHANGELOG.md
 * (full cumulative history). Idempotent: skips if the version is already present in root.
 *
 * Usage:
 *   node scripts/prependReleaseChangelog.mts
 *
 * The script reads the package CHANGELOG and prepends to root if the version isn't already there.
 */

import fs from 'node:fs';
import path from 'node:path';
import { getRepoRoot } from './repoRoot.mts';

const REPO_ROOT = getRepoRoot();
const ROOT_CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');
const PACKAGE_CHANGELOG_PATH = path.join(REPO_ROOT, 'packages', 'salesforcedx-vscode', 'CHANGELOG.md');

/**
 * Extract version from first line of changelog (e.g., "# 67.6.0 - July 22, 2026")
 */
const extractVersion = (changelogText: string) => {
  const firstLine = changelogText.split('\n')[0];
  const match = firstLine.match(/^#\s+(\d+\.\d+\.\d+)/);
  return match?.[1];
};

/**
 * Read the package CHANGELOG (current release notes only)
 */
const readPackageChangelog = () => {
  console.log(`📥 Reading package CHANGELOG from ${PACKAGE_CHANGELOG_PATH}...`);

  try {
    if (!fs.existsSync(PACKAGE_CHANGELOG_PATH)) {
      console.error(`❌ Error: Package CHANGELOG not found at ${PACKAGE_CHANGELOG_PATH}`);
      process.exit(1);
    }

    const packageChangelog = fs.readFileSync(PACKAGE_CHANGELOG_PATH, 'utf8');

    if (!packageChangelog?.trim()) {
      console.error('❌ Error: Package CHANGELOG is empty');
      process.exit(1);
    }

    const version = extractVersion(packageChangelog);
    if (!version) {
      console.error('❌ Error: Could not extract version from package CHANGELOG');
      console.error(`   First line: ${packageChangelog.split('\n')[0]}`);
      process.exit(1);
    }

    console.log(`✅ Read package CHANGELOG (version ${version}, ${packageChangelog.split('\n').length} lines)`);
    return { content: packageChangelog, version };
  } catch (error) {
    console.error('❌ Error reading package CHANGELOG:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

/**
 * Prepend package changelog to root changelog (idempotent)
 */
const prependToRootChangelog = (packageChangelog: string, version: string) => {
  console.log(`📝 Prepending v${version} to root CHANGELOG...`);

  // Read existing root changelog
  let rootChangelog;
  try {
    rootChangelog = fs.readFileSync(ROOT_CHANGELOG_PATH, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.error(`❌ Error: Root CHANGELOG does not exist at ${ROOT_CHANGELOG_PATH}`);
      process.exit(1);
    }
    console.error(
      `❌ Error reading root CHANGELOG from ${ROOT_CHANGELOG_PATH}:`,
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }

  // Check if this version is already in the root changelog (idempotent)
  // Use line-anchored check to avoid false positives from body text
  const versionRegex = new RegExp(`^# ${version.replaceAll('.', '\\.')}(?:\\s|$)`, 'm');
  if (versionRegex.test(rootChangelog)) {
    console.log(`✅ Version ${version} already exists in root CHANGELOG (skipping, idempotent)`);
    return false;
  }

  // Prepend package changelog to root
  const combinedChangelog = `${packageChangelog.trim()}\n\n${rootChangelog}`;

  // Write back to file
  try {
    fs.writeFileSync(ROOT_CHANGELOG_PATH, combinedChangelog, 'utf8');
  } catch (error) {
    console.error(
      `❌ Error writing root CHANGELOG to ${ROOT_CHANGELOG_PATH}:`,
      error instanceof Error ? error.message : String(error)
    );
    if (error instanceof Error && 'code' in error && error.code === 'ENOSPC') {
      console.error('   Disk is full. Free up space and try again.');
    } else if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
      console.error('   Permission denied. Check file permissions.');
    } else {
      console.error('   This could be a disk space, permissions, or I/O error.');
    }
    process.exit(1);
  }

  console.log('✅ Successfully prepended release notes to root CHANGELOG');
  console.log(`   Total lines: ${combinedChangelog.split('\n').length}`);
  return true;
};

/**
 * Main execution
 */
export const main = () => {
  console.log('🔧 Prepending package CHANGELOG to root CHANGELOG...\n');

  const { content, version } = readPackageChangelog();
  const updated = prependToRootChangelog(content, version);

  if (updated) {
    console.log(`\n✅ Done! Root CHANGELOG.md updated with v${version}`);
    console.log(`   Package CHANGELOG: ${PACKAGE_CHANGELOG_PATH}`);
    console.log(`   Root CHANGELOG: ${ROOT_CHANGELOG_PATH}`);
  } else {
    console.log('\n✅ Done! No changes needed (version already present).');
  }
  process.exit(0);
};

if (import.meta.main) {
  main();
}
