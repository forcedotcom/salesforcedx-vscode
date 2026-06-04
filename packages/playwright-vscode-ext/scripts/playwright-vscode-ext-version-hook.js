'use strict';

const fs = require('fs');
const path = require('path');

/**
 * pre-changelog-generation hook for TriPSs/conventional-changelog-action.
 * When RELEASE_TYPE env var is set (from workflow_dispatch input), override
 * the version bump type instead of relying solely on conventional commits.
 */
exports.preVersionGeneration = proposedVersion => {
  const releaseType = process.env.RELEASE_TYPE;
  if (!releaseType || !['major', 'minor', 'patch'].includes(releaseType)) {
    return proposedVersion;
  }
  const { version } = require('../package.json');
  // Strip any prerelease/build suffix (e.g. `1.0.0-beta` -> `1.0.0`) before bumping.
  const core = version.split(/[-+]/)[0];
  const parts = core.split('.').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Cannot parse semver core from version "${version}"`);
  }
  const [major, minor, patch] = parts;
  if (releaseType === 'major') return `${major + 1}.0.0`;
  if (releaseType === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

/**
 * pre-commit hook for TriPSs/conventional-changelog-action.
 * Patches the playwright-vscode-ext version in the root package-lock.json so it stays
 * in sync with the bumped packages/playwright-vscode-ext/package.json.
 */
exports.preCommit = ({ version }) => {
  const lockPath = path.join(process.env.GITHUB_WORKSPACE, 'package-lock.json');
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  if (lock.packages?.['packages/playwright-vscode-ext']) {
    lock.packages['packages/playwright-vscode-ext'].version = version;
  }
  fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
};
