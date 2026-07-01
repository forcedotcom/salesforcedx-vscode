#!/usr/bin/env node

/**
 * ONE-TIME SCRIPT: Restores full CHANGELOG.md history from GitHub releases.
 *
 * This script fetches all release notes from GitHub and reconstructs the full
 * changelog that was lost due to weekly truncation. Run this once to restore
 * the complete history.
 *
 * Prerequisites:
 * - gh CLI must be installed and authenticated
 * - Must be run from the repository root
 *
 * Usage:
 *   node scripts/restore-changelog-history-from-github.js [--dry-run]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(process.cwd(), 'packages', 'salesforcedx-vscode', 'CHANGELOG.md');
const REPO = 'forcedotcom/salesforcedx-vscode';

// Check for dry-run flag
const isDryRun = process.argv.includes('--dry-run');

/**
 * Fetches all extension releases (not npm package releases) from GitHub
 * @returns {Array} List of releases sorted newest to oldest
 */
function fetchReleases() {
  console.log('📥 Fetching releases from GitHub...');

  try {
    // First, get list of all release tags
    const listOutput = execSync(`gh release list --repo ${REPO} --limit 1000 --json tagName,publishedAt`, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024
    });

    const allReleases = JSON.parse(listOutput);

    // Filter to only main extension releases (v66.7.0 format, not soql-common-v1.0.0)
    const extensionReleaseTags = allReleases.filter(r => {
      return /^v\d+\.\d+\.\d+$/.test(r.tagName) && !r.tagName.includes('-v');
    });

    console.log(`✅ Found ${extensionReleaseTags.length} extension releases`);
    console.log('📥 Fetching release bodies...');

    // Now fetch each release's body individually
    const extensionReleases = extensionReleaseTags.map((release, index) => {
      if (index % 10 === 0 && index > 0) {
        console.log(`   Progress: ${index}/${extensionReleaseTags.length}`);
      }

      try {
        const viewOutput = execSync(
          `gh release view ${release.tagName} --repo ${REPO} --json tagName,body,publishedAt`,
          { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
        );
        return JSON.parse(viewOutput);
      } catch (error) {
        console.warn(`⚠️  Could not fetch body for ${release.tagName}, using metadata only`);
        return { ...release, body: '' };
      }
    });

    console.log(`✅ Fetched bodies for ${extensionReleases.length} releases`);
    return extensionReleases;
  } catch (error) {
    console.error('❌ Error fetching releases:', error.message);
    console.error('Make sure gh CLI is installed and authenticated: gh auth login');
    process.exit(1);
  }
}

/**
 * Parses release body to extract ONLY the first changelog section.
 * Older releases included full historical changelog, so we extract only
 * the section for THIS release (everything up to the next version header).
 * @param {Object} release - Release object from GitHub
 * @returns {string} Formatted changelog entry for this release only
 */
function formatReleaseAsChangelog(release) {
  const version = release.tagName.replace(/^v/, '');
  const date = new Date(release.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // If no body, create a minimal entry
  if (!release.body || !release.body.trim()) {
    return `# ${version} - ${date}\n\nSee [GitHub Release](https://github.com/${REPO}/releases/tag/v${version}) for details.\n`;
  }

  const body = release.body.trim();
  const lines = body.split('\n');
  const extractedLines = [];
  let foundFirstHeader = false;

  for (const line of lines) {
    // Version headers start with "# " followed by a version number
    const isVersionHeader = /^# \d+\.\d+\.\d+/.test(line);

    if (isVersionHeader) {
      if (foundFirstHeader) {
        // Found the SECOND version header - stop here
        // This release included historical changelog, we only want the first section
        break;
      }
      foundFirstHeader = true;
    }

    extractedLines.push(line);
  }

  const extracted = extractedLines.join('\n').trim();

  // Ensure it has the version header
  if (!extracted.startsWith(`# ${version}`)) {
    return `# ${version} - ${date}\n\n${extracted}`;
  }

  return extracted;
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
function main() {
  console.log('🔧 Starting changelog history restoration...\n');

  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }

  // Check if CHANGELOG exists
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error(`❌ CHANGELOG.md not found at ${CHANGELOG_PATH}`);
    process.exit(1);
  }

  // Backup current changelog
  const backupPath = `${CHANGELOG_PATH}.backup-${Date.now()}`;
  fs.copyFileSync(CHANGELOG_PATH, backupPath);
  console.log(`✅ Backed up current CHANGELOG to ${path.basename(backupPath)}\n`);

  // Fetch releases
  const releases = fetchReleases();

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
