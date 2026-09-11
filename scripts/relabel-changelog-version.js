#!/usr/bin/env node

/**
 * Rewrites a changelog's `# <fromVersion> ...` header to `# <toVersion> ...`, preserving
 * everything else on that line (e.g. the date). Used to relabel a prerelease's changelog
 * entry with its stable version once the prerelease ships as a stable release.
 *
 * Idempotent: no-op if the fromVersion header isn't found (e.g. already relabeled).
 *
 * Usage:
 *   node scripts/relabel-changelog-version.js <fromVersion> <toVersion> [filePath]
 *
 * filePath defaults to the repo-root CHANGELOG.md.
 */

const fs = require('fs');
const path = require('path');
const { getRepoRoot } = require('./repo-root');

const [, , fromVersion, toVersion, filePathArg] = process.argv;

if (!fromVersion || !toVersion) {
  console.error('Usage: relabel-changelog-version.js <fromVersion> <toVersion> [filePath]');
  process.exit(1);
}

const filePath = filePathArg ? path.resolve(filePathArg) : path.join(getRepoRoot(), 'CHANGELOG.md');

if (!fs.existsSync(filePath)) {
  console.error(`Error: File not found at ${filePath}`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const escapedFrom = fromVersion.replace(/\./g, '\\.');
const headerRegex = new RegExp(`^# ${escapedFrom}(\\s.*)?$`, 'm');
const match = headerRegex.exec(content);

if (!match) {
  console.log(`No "# ${fromVersion}" header found in ${filePath}. Nothing to relabel (already applied or absent).`);
  process.exit(0);
}

const relabeled = content.replace(headerRegex, `# ${toVersion}${match[1] ?? ''}`);
fs.writeFileSync(filePath, relabeled, 'utf8');
console.log(`Relabeled "# ${fromVersion}" -> "# ${toVersion}" in ${filePath}`);
