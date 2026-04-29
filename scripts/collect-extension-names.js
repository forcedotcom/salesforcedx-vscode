#!/usr/bin/env node

/**
 * Extract extension names from VSIX filenames in a directory.
 *
 * Usage: node scripts/collect-extension-names.js <directory>
 *
 * VSIX files follow the naming convention: <extension-name>-<semver>.vsix
 * For example: salesforcedx-vscode-apex-log-66.5.2.vsix → salesforcedx-vscode-apex-log
 *
 * Outputs a comma-separated list of unique extension names to stdout.
 */

const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node collect-extension-names.js <directory>');
  process.exit(1);
}

// Match a dash followed by a semver (digits.digits.digits) at the end of the
// filename before .vsix. This strips the version suffix while preserving any
// digits that are part of the extension name itself (e.g. "vscode-i18n").
const VSIX_VERSION_SUFFIX = /-\d+\.\d+\.\d+\.vsix$/;

const names = fs
  .readdirSync(dir)
  .filter(f => f.endsWith('.vsix'))
  .map(f => f.replace(VSIX_VERSION_SUFFIX, ''))
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort();

if (names.length === 0) {
  console.error(`No .vsix files found in ${dir}`);
  process.exit(1);
}

process.stdout.write(names.join(','));
