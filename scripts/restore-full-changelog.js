#!/usr/bin/env node

/**
 * Restores the full CHANGELOG.md after marketplace packaging.
 * This reverses the changes made by prepare-changelog-for-marketplace.js
 */

const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(process.cwd(), 'packages', 'salesforcedx-vscode', 'CHANGELOG.md');
const BACKUP_PATH = path.join(process.cwd(), 'packages', 'salesforcedx-vscode', 'CHANGELOG.full.md');

function main() {
  if (!fs.existsSync(BACKUP_PATH)) {
    console.log('ℹ️  No backup found. CHANGELOG.md already contains full history.');
    return;
  }

  console.log('📝 Restoring full CHANGELOG.md...');

  // Restore from backup
  const fullChangelog = fs.readFileSync(BACKUP_PATH, 'utf8');
  fs.writeFileSync(CHANGELOG_PATH, fullChangelog, 'utf8');

  // Remove backup
  fs.unlinkSync(BACKUP_PATH);

  console.log('✅ Full changelog history restored');
}

if (require.main === module) {
  main();
}

module.exports = { main };
