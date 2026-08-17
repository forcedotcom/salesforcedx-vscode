#!/usr/bin/env node

/**
 * Calculate release version from a prerelease tag
 * Usage: node calculate-release-version.js [prereleaseTag] [overrideVersion]
 *
 * Examples:
 *   node calculate-release-version.js v67.11.1-nightly.develop.20260812
 *   # Output: 67.12.0
 *
 *   node calculate-release-version.js v67.11.1-nightly.develop.20260812 67.13.0
 *   # Output: 67.13.0 (override)
 */

const prereleaseTag = process.argv[2];
const overrideVersion = process.argv[3];

if (!prereleaseTag) {
  console.error('Error: prereleaseTag argument required');
  process.exit(1);
}

// Validate override version format if provided
if (overrideVersion) {
  const semverRegex = /^[0-9]+\.[0-9]+\.[0-9]+$/;
  if (!semverRegex.test(overrideVersion)) {
    console.error(`Error: Invalid version format '${overrideVersion}'. Expected format: X.Y.Z (e.g., 67.12.0)`);
    process.exit(1);
  }
  console.log(overrideVersion);
  process.exit(0);
}

// Extract version from tag: v67.11.1-nightly.develop.20260812 → 67.11.1
const match = prereleaseTag.match(/^v([0-9]+\.[0-9]+\.[0-9]+)/);
if (!match) {
  console.error(`Error: Could not extract version from tag: ${prereleaseTag}`);
  process.exit(1);
}

const prereleaseVersion = match[1];
const [major, minor, patch] = prereleaseVersion.split('.');

// Validate version components are reasonable numbers
const majorNum = parseInt(major, 10);
const minorNum = parseInt(minor, 10);
const patchNum = parseInt(patch, 10);

if (isNaN(majorNum) || isNaN(minorNum) || isNaN(patchNum)) {
  console.error(`Error: Invalid version components in ${prereleaseVersion}`);
  process.exit(1);
}

// Check for integer overflow (versions should be reasonable)
if (majorNum > 9999 || minorNum > 9999 || patchNum > 9999) {
  console.error(`Error: Version component too large in ${prereleaseVersion}. Maximum allowed: 9999`);
  process.exit(1);
}

// Bump minor version: 67.11.1 → 67.12.0
const newMinor = minorNum + 1;
const releaseVersion = `${majorNum}.${newMinor}.0`;

console.log(releaseVersion);
