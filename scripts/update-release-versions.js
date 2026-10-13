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
const { shouldUpdateVersion } = require('./release-package-selection');

const releaseVersion = process.argv[2];

if (!releaseVersion) {
  console.error('Error: version argument required');
  process.exit(1);
}

console.log(`Updating packages to version ${releaseVersion}`);

// Find all package.json files using fs.globSync (Node 20+)
const packageFiles = fs.globSync('packages/*/package.json', {
  ignore: '**/node_modules/**'
});

if (packageFiles.length === 0) {
  console.error('Error: No package.json files found in packages/');
  process.exit(1);
}

let updatedCount = 0;
let errorCount = 0;

packageFiles.forEach(pkgPath => {
  let pkg;

  // Parse package.json with error handling
  try {
    const content = fs.readFileSync(pkgPath, 'utf8');
    pkg = JSON.parse(content);
  } catch (error) {
    console.error(`✗ Error parsing ${pkgPath}: ${error.message}`);
    errorCount++;
    return; // Skip this file, continue with others
  }

  // Check if package should be versioned
  if (shouldUpdateVersion(pkg)) {
    console.log(`  Updating ${path.dirname(pkgPath)}`);
    pkg.version = releaseVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    updatedCount++;
  }
});

// Report results
if (errorCount > 0) {
  console.error(`\n⚠️  Warning: ${errorCount} package.json file(s) had parse errors and were skipped`);
  console.error('Please fix the JSON syntax in the files listed above');
}

console.log(`Updated ${updatedCount} packages`);

// Always update pnpm-lock.yaml to maintain dependency graph integrity.
// This ensures workspace package versions match package.json after version bumps.
console.log('Updating pnpm-lock.yaml to match new versions');
try {
  execSync('pnpm install --ignore-scripts --lockfile-only', { stdio: 'inherit' });
  console.log('✓ pnpm-lock.yaml updated successfully');
} catch (error) {
  console.error('Error updating pnpm-lock.yaml:', error.message);
  console.error('This may cause version mismatches during build. Please fix manually.');
  process.exit(1);
}
