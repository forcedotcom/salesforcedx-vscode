#!/usr/bin/env node

/**
 * Shared helper for locating the repo root from any CWD. Used by changelog scripts that
 * read/write files at fixed repo-relative paths (root CHANGELOG.md, packages/.../CHANGELOG.md).
 */

const { execSync } = require('child_process');

function getRepoRoot() {
  try {
    return execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
  } catch {
    console.error('Error: Not in a git repository');
    process.exit(1);
  }
}

module.exports = { getRepoRoot };
