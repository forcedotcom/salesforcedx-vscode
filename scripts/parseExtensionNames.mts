#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Extract extension names from VSIX filenames in a directory.
 *
 * Usage: node scripts/parseExtensionNames.mts <directory>
 *
 * VSIX files follow the naming convention: <extension-name>-<semver>.vsix
 * For example: salesforcedx-vscode-apex-log-66.5.2.vsix → salesforcedx-vscode-apex-log
 *
 * Outputs a comma-separated list of unique extension names to stdout.
 */

import fs from 'node:fs';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node parseExtensionNames.mts <directory>');
  process.exit(1);
}

// Match a dash followed by a semver (digits.digits.digits) with optional prerelease
// tag (e.g., -beta, -nightly.1) at the end of the filename before .vsix. This strips
// the version suffix while preserving any digits that are part of the extension name
// itself (e.g. "vscode-i18n").
const VSIX_VERSION_SUFFIX = /-\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?\.vsix$/;

const names = [
  ...new Set(
    fs
      .readdirSync(dir)
      .filter(filename => filename.endsWith('.vsix'))
      .map(filename => filename.replace(VSIX_VERSION_SUFFIX, ''))
  )
].toSorted();

if (names.length === 0) {
  console.error(`No .vsix files found in ${dir}`);
  process.exit(1);
}

process.stdout.write(names.join(','));
