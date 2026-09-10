/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { generateDeltaChangeLog } from './change-log-generator-utils';

const [, , version, toRefArg, fromRefArg] = process.argv;

if (!version || !toRefArg) {
  console.error('Usage: generate-release-delta-changelog.ts <version> <toRef> [fromRef]');
  process.exit(1);
}

const toRef = toRefArg;

/**
 * Auto-detects the previous weekly prerelease baseline: the newest marketplace-prerelease
 * tracking tag (set by last week's promote run) if present, else the last stable release
 * tag. The stable tag (not the latest nightly, which is cut daily) is the correct fallback
 * for the pipeline's first-ever run, before any tracking tag exists -- it covers everything
 * since what actually shipped to users, instead of just ~1 day of nightly commits.
 */
function detectPreviousPrereleaseRef(): string {
  const trackingTag = execSync("git tag -l 'marketplace-prerelease-*' --sort=-creatordate", { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)[0];
  if (trackingTag) {
    return trackingTag;
  }

  const stableTag = execSync("git tag -l 'v[0-9]*' --sort=-version:refname", { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(tag => tag && !tag.includes('-nightly.'))[0];

  if (!stableTag) {
    console.error('Could not auto-detect a previous prerelease baseline. Pass fromRef explicitly.');
    process.exit(1);
  }
  return stableTag;
}

const fromRef = fromRefArg || detectPreviousPrereleaseRef();

console.log(`Generating changelog for ${version}: (${fromRef}, ${toRef}]`);
const generated = generateDeltaChangeLog(fromRef, toRef, version);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `generated=${generated}\n`);
}
