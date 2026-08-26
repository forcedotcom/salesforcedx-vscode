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
  // TODO: Extract this logic to shared module (scripts/lib/package-utils.js)
  // This is duplicated from create-release-branch.js shouldUpdateVersion()
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

// Report results
if (errorCount > 0) {
  console.error(`\n⚠️  Warning: ${errorCount} package.json file(s) had parse errors and were skipped`);
  console.error('Please fix the JSON syntax in the files listed above');
}

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
