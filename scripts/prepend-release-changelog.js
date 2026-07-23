#!/usr/bin/env node

/**
 * Prepends the release branch CHANGELOG to develop's CHANGELOG.
 *
 * This script is run after merging a release branch to main, and before merging main back to develop.
 * It takes the new release notes from the release branch and prepends them to develop's full history.
 *
 * Usage:
 *   node scripts/prepend-release-changelog.js <release-branch-name>
 *
 * Example:
 *   node scripts/prepend-release-changelog.js release/v67.4.0
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(process.cwd(), 'packages', 'salesforcedx-vscode', 'CHANGELOG.md');

/**
 * Get the release branch name from command line args
 */
function getReleaseBranch() {
  const releaseBranch = process.argv[2];
  if (!releaseBranch) {
    console.error('❌ Error: Release branch name required');
    console.error('Usage: node scripts/prepend-release-changelog.js <release-branch>');
    console.error('Example: node scripts/prepend-release-changelog.js release/v67.4.0');
    process.exit(1);
  }

  // Validate branch name to prevent command injection
  // Only allow alphanumeric, forward slash, hyphen, underscore, and dot
  if (!/^[a-zA-Z0-9/_.-]+$/.test(releaseBranch)) {
    console.error('❌ Error: Invalid branch name. Only alphanumeric characters, /, -, _, and . are allowed.');
    console.error(`Received: ${releaseBranch}`);
    process.exit(1);
  }

  return releaseBranch;
}

/**
 * Fetch the changelog from the release branch
 */
function fetchReleaseChangelog(releaseBranch) {
  console.log(`📥 Fetching CHANGELOG from ${releaseBranch}...`);

  try {
    const releaseChangelog = execSync(`git show ${releaseBranch}:packages/salesforcedx-vscode/CHANGELOG.md`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });

    if (!releaseChangelog || !releaseChangelog.trim()) {
      console.error(`❌ Error: No CHANGELOG found in ${releaseBranch}`);
      process.exit(1);
    }

    console.log(`✅ Fetched ${releaseChangelog.split('\n').length} lines from release branch`);
    return releaseChangelog;
  } catch (error) {
    console.error(`❌ Error fetching changelog from ${releaseBranch}:`, error.message);
    process.exit(1);
  }
}

/**
 * Prepend release changelog to develop's changelog
 */
function prependChangelog(releaseChangelog) {
  console.log('📝 Prepending release notes to develop CHANGELOG...');

  // Check if we're on develop
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  if (currentBranch !== 'develop') {
    console.error(`❌ Error: Must be on develop branch (currently on ${currentBranch})`);
    process.exit(1);
  }

  // Read existing changelog from develop
  let developChangelog;
  try {
    if (!fs.existsSync(CHANGELOG_PATH)) {
      console.error(`❌ Error: CHANGELOG not found at ${CHANGELOG_PATH}`);
      process.exit(1);
    }

    developChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading CHANGELOG from ${CHANGELOG_PATH}:`, error.message);
    console.error('   This could be a permissions issue or I/O error.');
    process.exit(1);
  }

  // Prepend release notes to develop changelog
  const combinedChangelog = releaseChangelog.trim() + '\n\n' + developChangelog;

  // Write back to file
  try {
    fs.writeFileSync(CHANGELOG_PATH, combinedChangelog, 'utf8');
  } catch (error) {
    console.error(`❌ Error writing CHANGELOG to ${CHANGELOG_PATH}:`, error.message);
    if (error.code === 'ENOSPC') {
      console.error('   Disk is full. Free up space and try again.');
    } else if (error.code === 'EACCES') {
      console.error('   Permission denied. Check file permissions.');
    } else {
      console.error('   This could be a disk space, permissions, or I/O error.');
    }
    console.error('   The merge was completed but the changelog was not updated.');
    console.error('   Manual intervention required to prepend the changelog.');
    process.exit(1);
  }

  console.log('✅ Successfully prepended release notes to develop CHANGELOG');
  console.log(`   Total lines: ${combinedChangelog.split('\n').length}`);
}

/**
 * Main execution
 */
function main() {
  console.log('🔧 Prepending release CHANGELOG to develop...\n');

  const releaseBranch = getReleaseBranch();
  const releaseChangelog = fetchReleaseChangelog(releaseBranch);
  prependChangelog(releaseChangelog);

  console.log('\n✅ Done! CHANGELOG.md updated on develop branch.');
  console.log('   Next: Review the changes and commit if satisfied.');
}

if (require.main === module) {
  main();
}

module.exports = { main };
