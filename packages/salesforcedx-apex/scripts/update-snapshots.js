#!/usr/bin/env node

/**
 * Script to update snapshots for the library change verification tests
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🔄 Updating snapshots for library change verification...');

try {
  // Run the snapshot tests with update flag for mocha-snap
  execSync('yarn test -- --grep "Snapshot Tests" --update-snapshots', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..')
  });

  console.log('✅ Snapshots updated successfully!');
  console.log('📝 Review the updated snapshot files and commit them if the changes are expected.');
  console.log('📁 Snapshots are created as .snap.md files in the test directories');

} catch (error) {
  console.error('❌ Failed to update snapshots:', error.message);
  process.exit(1);
}
