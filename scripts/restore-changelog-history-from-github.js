#!/usr/bin/env node

/**
 * ONE-TIME SCRIPT: Restores full CHANGELOG.md history from GitHub releases.
 *
 * This script fetches all release notes from GitHub and reconstructs the full
 * changelog that was lost due to weekly truncation. Run this once to restore
 * the complete history to the root CHANGELOG.md.
 *
 * Note: With the new changelog strategy, root CHANGELOG.md contains full history
 * and is automatically updated via prepend-release-changelog.js. This script is
 * preserved for reference and historical restoration if needed.
 *
 * Prerequisites:
 * - gh CLI must be installed and authenticated
 * - Must be run from the repository root
 *
 * Usage:
 *   pnpm changelog:restore [-- --dry-run]
 */

const { GitHub } = require('@salesforce/effect-octokit');
const Effect = require('effect/Effect');
const { GitHubCliLive } = require('./githubCli.mts');
const { formatReleaseAsChangelog, selectExtensionReleases } = require('./changelogReleases.mts');
const fs = require('fs');
const path = require('path');

// Note: Update this path based on which changelog you want to restore
// Root CHANGELOG.md = full history (default)
// packages/salesforcedx-vscode/CHANGELOG.md = current release notes only
const CHANGELOG_PATH = path.join(process.cwd(), 'CHANGELOG.md');

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

/**
 * Fetches all extension releases (not npm package releases) from GitHub
 * @returns {Promise<Array>} List of releases sorted newest to oldest
 */
async function fetchReleases() {
  console.log('📥 Fetching releases from GitHub...');

  try {
    // The paginated release API includes release bodies with the metadata.
    const allReleases = await GitHub.releases({ owner: 'forcedotcom', repo: 'salesforcedx-vscode' }).pipe(
      Effect.provide(GitHubCliLive),
      Effect.runPromise
    );

    const extensionReleases = selectExtensionReleases(allReleases);

    console.log(`✅ Found ${extensionReleases.length} extension releases`);
    console.log(`✅ Fetched bodies for ${extensionReleases.length} releases`);
    return extensionReleases;
  } catch (error) {
    console.error('❌ Error fetching releases:', error.message);
    console.error('Make sure gh CLI is installed and authenticated: gh auth login');
    process.exit(1);
  }
}

/**
 * Reconstructs the full CHANGELOG from releases
 * @param {Array} releases - List of releases sorted newest to oldest
 * @returns {string} Complete changelog content
 */
function reconstructChangelog(releases) {
  console.log('📝 Reconstructing changelog...');

  const changelogSections = releases.map(release => {
    return formatReleaseAsChangelog(release);
  });

  return changelogSections.join('\n\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('🔧 Starting changelog history restoration...\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  // Check if CHANGELOG exists
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error(`❌ CHANGELOG.md not found at ${CHANGELOG_PATH}`);
    process.exit(1);
  }

  // Fetch releases
  const releases = await fetchReleases();

  if (releases.length === 0) {
    console.error('❌ No releases found');
    process.exit(1);
  }

  // Reconstruct changelog
  const newChangelog = reconstructChangelog(releases);

  if (isDryRun) {
    console.log('\n📄 Preview of reconstructed changelog:\n');
    console.log('='.repeat(80));
    console.log(newChangelog.substring(0, 2000)); // Show first 2000 chars
    console.log('='.repeat(80));
    console.log(`\n... (${newChangelog.length} total characters)`);
    console.log('\n✅ Dry run complete. Run without --dry-run to apply changes.');
  } else {
    // Backup current changelog before writing
    const backupPath = `${CHANGELOG_PATH}.backup-${Date.now()}`;
    fs.copyFileSync(CHANGELOG_PATH, backupPath);
    console.log(`✅ Backed up current CHANGELOG to ${path.basename(backupPath)}`);

    // Write new changelog
    fs.writeFileSync(CHANGELOG_PATH, newChangelog, 'utf8');
    console.log(`\n✅ Full changelog history restored!`);
    console.log(`   ${releases.length} releases included`);
    console.log(`   Backup saved as ${path.basename(backupPath)}`);
    console.log(`\n📝 Review the restored changelog and commit if satisfied.`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchReleases, formatReleaseAsChangelog, reconstructChangelog };
