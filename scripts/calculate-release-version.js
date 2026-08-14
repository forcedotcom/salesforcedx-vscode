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

if (overrideVersion) {
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
const [major, minor] = prereleaseVersion.split('.');

// Bump minor version: 67.11.1 → 67.12.0
const newMinor = parseInt(minor, 10) + 1;
const releaseVersion = `${major}.${newMinor}.0`;

console.log(releaseVersion);
