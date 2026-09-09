/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execSync } from 'node:child_process';
import { generateDeltaChangeLog } from './change-log-generator-utils';

const [, , version, toRefArg, fromRefArg] = process.argv;

if (!version || !toRefArg) {
  console.error('Usage: generate-release-delta-changelog.ts <version> <toRef> [fromRef]');
  process.exit(1);
}

const toRef = toRefArg;

/**
 * Auto-detects the previous weekly prerelease baseline: the newest marketplace-prerelease
 * tracking tag (set by last week's promote run) if present, else the newest nightly.develop
 * tag that isn't the one currently being promoted (first-ever run, before any tracking tag
 * exists).
 */
function detectPreviousPrereleaseRef(): string {
  const trackingTag = execSync("git tag -l 'marketplace-prerelease-*' --sort=-creatordate", { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)[0];
  if (trackingTag) {
    return trackingTag;
  }

  const currentSha = execSync(`git rev-parse ${toRef}`, { encoding: 'utf8' }).trim();
  const nightlyTag = execSync("git tag -l 'v*-nightly.develop.*' --sort=-version:refname", { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(tag => tag && execSync(`git rev-parse ${tag}^{commit}`, { encoding: 'utf8' }).trim() !== currentSha)[0];

  if (!nightlyTag) {
    console.error('Could not auto-detect a previous prerelease baseline. Pass fromRef explicitly.');
    process.exit(1);
  }
  return nightlyTag;
}

const fromRef = fromRefArg || detectPreviousPrereleaseRef();

console.log(`Generating changelog for ${version}: (${fromRef}, ${toRef}]`);
generateDeltaChangeLog(fromRef, toRef, version);
