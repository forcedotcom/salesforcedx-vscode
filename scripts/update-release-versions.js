#!/usr/bin/env node

/**
 * Update package.json versions for all publishable packages
 * Usage: node update-release-versions.js <version>
 *
 * Example: node update-release-versions.js 67.12.0
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const releaseVersion = process.argv[2];

if (!releaseVersion) {
  console.error('Error: version argument required');
  process.exit(1);
}

console.log(`Updating packages to version ${releaseVersion}`);

// Find all package.json files
const packageFiles = execSync('find packages -name "package.json" -type f', { encoding: 'utf8' }).trim().split('\n');

let updatedCount = 0;

packageFiles.forEach(pkgPath => {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // Check if package should be versioned
  const hasVscodePublish = pkg.scripts?.['vscode:publish'];
  const hasPublishConfig = pkg.publishConfig;
  const versionedIndependently = pkg.versionedIndependently;

  if (!versionedIndependently && (hasVscodePublish || hasPublishConfig)) {
    console.log(`  Updating ${path.dirname(pkgPath)}`);
    pkg.version = releaseVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    updatedCount++;
  }
});

console.log(`Updated ${updatedCount} packages`);

// Update package-lock.json (skip if --skip-lockfile flag provided)
const skipLockfile = process.argv.includes('--skip-lockfile');
if (skipLockfile) {
  console.log('Skipping package-lock.json update (--skip-lockfile flag provided)');
} else {
  console.log('Updating package-lock.json');
  execSync('npm install --ignore-scripts --package-lock-only --no-audit', { stdio: 'inherit' });
}
