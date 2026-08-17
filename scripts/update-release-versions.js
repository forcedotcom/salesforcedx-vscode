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

// Verify packages directory exists
if (!fs.existsSync('packages')) {
  console.error('Error: packages/ directory not found');
  console.error('Current directory:', process.cwd());
  console.error('This script must be run from the repository root');
  process.exit(1);
}

// Find all package.json files (excluding node_modules)
let packageFiles;
try {
  const output = execSync('find packages -name "package.json" -type f -not -path "*/node_modules/*"', {
    encoding: 'utf8'
  }).trim();

  if (!output) {
    console.error('Error: No package.json files found in packages/');
    process.exit(1);
  }

  packageFiles = output.split('\n');
} catch (error) {
  console.error('Error running find command:', error.message);
  process.exit(1);
}

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

// Always update package-lock.json to maintain dependency graph integrity
// Note: This ensures package-lock.json versions match package.json after version bumps
console.log('Updating package-lock.json to match new versions');
try {
  execSync('npm install --ignore-scripts --package-lock-only --no-audit', { stdio: 'inherit' });
  console.log('✓ package-lock.json updated successfully');
} catch (error) {
  console.error('Error updating package-lock.json:', error.message);
  console.error('This may cause version mismatches during build. Please fix manually.');
  process.exit(1);
}
