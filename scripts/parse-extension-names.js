#!/usr/bin/env node

/**
 * Extract extension names from VSIX filenames in a directory.
 *
 * Usage: node scripts/parse-extension-names.js <directory>
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
  console.error('Usage: node parse-extension-names.js <directory>');
  process.exit(1);
}

// Match a dash followed by a semver (digits.digits.digits) at the end of the
// filename before .vsix. This strips the version suffix while preserving any
// digits that are part of the extension name itself (e.g. "vscode-i18n").
const VSIX_VERSION_SUFFIX = /-\d+\.\d+\.\d+\.vsix$/;

const names = [
  ...new Set(
    fs
      .readdirSync(dir)
      .filter(filename => filename.endsWith('.vsix'))
      .map(filename => filename.replace(VSIX_VERSION_SUFFIX, ''))
  )
].sort();

if (names.length === 0) {
  console.error(`No .vsix files found in ${dir}`);
  process.exit(1);
}

process.stdout.write(names.join(','));
