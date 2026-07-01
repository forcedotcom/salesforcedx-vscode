#!/usr/bin/env node

/**
 * Prepares the CHANGELOG.md for marketplace publishing by:
 * 1. Backing up the full changelog history
 * 2. Replacing it with just the latest release notes
 *
 * This should be run BEFORE packaging the VSIX.
 * Use restore-full-changelog.js after packaging to restore the full history.
 */

const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(process.cwd(), 'packages', 'salesforcedx-vscode', 'CHANGELOG.md');
const BACKUP_PATH = path.join(process.cwd(), 'packages', 'salesforcedx-vscode', 'CHANGELOG.full.md');

const { extractLatestRelease } = require('./extract-latest-changelog');

function main() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    console.error(`ERROR: CHANGELOG.md not found at ${CHANGELOG_PATH}`);
    process.exit(1);
  }

  console.log('📝 Preparing CHANGELOG.md for marketplace publishing...');

  // Read full changelog
  const fullChangelog = fs.readFileSync(CHANGELOG_PATH, 'utf8');

  // Backup full changelog
  fs.writeFileSync(BACKUP_PATH, fullChangelog, 'utf8');
  console.log(`✅ Backed up full changelog to ${BACKUP_PATH}`);

  // Extract latest release
  const latestRelease = extractLatestRelease(fullChangelog);

  // Replace with latest release only
  fs.writeFileSync(CHANGELOG_PATH, latestRelease, 'utf8');
  console.log(`✅ Replaced CHANGELOG.md with latest release notes only`);
  console.log(`   Full history preserved in git and will be restored after packaging`);
}

if (require.main === module) {
  main();
}

module.exports = { main };
