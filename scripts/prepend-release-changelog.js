#!/usr/bin/env node

/**
 * Prepends the release CHANGELOG from packages/salesforcedx-vscode/ to root CHANGELOG.md.
 *
 * This script is run after merging a release branch to develop. It takes the new release notes
 * from packages/salesforcedx-vscode/CHANGELOG.md and prepends them to the root CHANGELOG.md
 * (full cumulative history). Idempotent: skips if the version is already present in root.
 *
 * Usage:
 *   node scripts/prepend-release-changelog.js
 *
 * The script reads the package CHANGELOG and prepends to root if the version isn't already there.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Validate we're at repo root
function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('❌ Error: Not in a git repository');
    process.exit(1);
  }
}

const REPO_ROOT = getRepoRoot();
const ROOT_CHANGELOG_PATH = path.join(REPO_ROOT, 'CHANGELOG.md');
const PACKAGE_CHANGELOG_PATH = path.join(REPO_ROOT, 'packages', 'salesforcedx-vscode', 'CHANGELOG.md');

/**
 * Extract version from first line of changelog (e.g., "# 67.6.0 - July 22, 2026")
 */
function extractVersion(changelogText) {
  const firstLine = changelogText.split('\n')[0];
  const match = firstLine.match(/^#\s+(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

/**
 * Read the package CHANGELOG (current release notes only)
 */
function readPackageChangelog() {
  console.log(`📥 Reading package CHANGELOG from ${PACKAGE_CHANGELOG_PATH}...`);

  try {
    if (!fs.existsSync(PACKAGE_CHANGELOG_PATH)) {
      console.error(`❌ Error: Package CHANGELOG not found at ${PACKAGE_CHANGELOG_PATH}`);
      process.exit(1);
    }

    const packageChangelog = fs.readFileSync(PACKAGE_CHANGELOG_PATH, 'utf8');

    if (!packageChangelog || !packageChangelog.trim()) {
      console.error(`❌ Error: Package CHANGELOG is empty`);
      process.exit(1);
    }

    const version = extractVersion(packageChangelog);
    if (!version) {
      console.error(`❌ Error: Could not extract version from package CHANGELOG`);
      console.error(`   First line: ${packageChangelog.split('\n')[0]}`);
      process.exit(1);
    }

    console.log(`✅ Read package CHANGELOG (version ${version}, ${packageChangelog.split('\n').length} lines)`);
    return { content: packageChangelog, version };
  } catch (error) {
    console.error(`❌ Error reading package CHANGELOG:`, error.message);
    process.exit(1);
  }
}

/**
 * Prepend package changelog to root changelog (idempotent)
 */
function prependToRootChangelog(packageChangelog, version) {
  console.log(`📝 Prepending v${version} to root CHANGELOG...`);

  // Read existing root changelog
  let rootChangelog;
  try {
    rootChangelog = fs.readFileSync(ROOT_CHANGELOG_PATH, 'utf8');

    // Sanity check: root CHANGELOG should have substantial content
    // A healthy changelog with 10+ releases should have 50+ lines
    const lineCount = rootChangelog.split('\n').length;
    if (lineCount < 50) {
      console.error(`❌ Error: Root CHANGELOG has only ${lineCount} lines`);
      console.error('   Expected changelog should have 50+ lines (typically 100+ for mature repos).');
      console.error('   This suggests the file was accidentally truncated or deleted.');
      console.error('   If this is a new repo, this check can be adjusted.');
      process.exit(1);
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: Root CHANGELOG does not exist at ${ROOT_CHANGELOG_PATH}`);
      console.error('   This file should contain the full historical changelog.');
      console.error('   Create this file before running the prepend script.');
      process.exit(1);
    }
    console.error(`❌ Error reading root CHANGELOG from ${ROOT_CHANGELOG_PATH}:`, error.message);
    process.exit(1);
  }

  // Check if this version is already in the root changelog (idempotent)
  // Use line-anchored check to avoid false positives from body text
  const versionRegex = new RegExp(`^# ${version.replace(/\./g, '\\.')}(?:\\s|$)`, 'm');
  if (versionRegex.test(rootChangelog)) {
    console.log(`✅ Version ${version} already exists in root CHANGELOG (skipping, idempotent)`);
    return false;
  }

  // Prepend package changelog to root
  const combinedChangelog = packageChangelog.trim() + '\n\n' + rootChangelog;

  // Write back to file
  try {
    fs.writeFileSync(ROOT_CHANGELOG_PATH, combinedChangelog, 'utf8');
  } catch (error) {
    console.error(`❌ Error writing root CHANGELOG to ${ROOT_CHANGELOG_PATH}:`, error.message);
    if (error.code === 'ENOSPC') {
      console.error('   Disk is full. Free up space and try again.');
    } else if (error.code === 'EACCES') {
      console.error('   Permission denied. Check file permissions.');
    } else {
      console.error('   This could be a disk space, permissions, or I/O error.');
    }
    process.exit(1);
  }

  console.log('✅ Successfully prepended release notes to root CHANGELOG');
  console.log(`   Total lines: ${combinedChangelog.split('\n').length}`);
  return true;
}

/**
 * Main execution
 */
function main() {
  console.log('🔧 Prepending package CHANGELOG to root CHANGELOG...\n');

  const { content, version } = readPackageChangelog();
  const updated = prependToRootChangelog(content, version);

  if (updated) {
    console.log('\n✅ Done! Root CHANGELOG.md updated with v' + version);
    console.log('   Package CHANGELOG: ' + PACKAGE_CHANGELOG_PATH);
    console.log('   Root CHANGELOG: ' + ROOT_CHANGELOG_PATH);
    process.exit(0);
  } else {
    console.log('\n✅ Done! No changes needed (version already present).');
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
